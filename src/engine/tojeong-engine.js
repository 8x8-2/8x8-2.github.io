import {
  calculateFourPillars,
  getLeapMonthForYear,
  getLunarMonthLength,
  solarToLunar,
} from "./soulscan-engine.js";

const TOJEONG_REFERENCE_CSV = `
갑자,20,18,18
을축,21,16,19
병인,17,14,15
정묘,16,12,14
무진,18,10,16
기사,18,13,16
경오,17,17,15
신미,20,15,18
임신,18,13,16
계유,17,11,15
갑술,22,14,20
을해,19,12,17
병자,18,16,16
정축,19,14,17
무인,15,12,13
기묘,19,15,17
경진,21,13,19
신사,16,11,14
임오,15,15,13
계미,18,13,16
갑신,21,16,19
을유,20,14,18
병술,20,12,18
정해,17,10,15
무자,16,14,14
기축,22,17,20
경인,18,15,16
신묘,17,13,15
임진,19,11,17
계사,14,9,12
갑오,18,18,16
을미,21,16,19
병신,19,14,17
정유,18,12,16
무술,18,10,16
기해,20,13,18
경자,19,17,17
신축,20,15,18
임인,16,13,14
계묘,15,11,13
갑진,22,14,20
을사,17,12,15
병오,16,16,14
정미,19,14,17
무신,17,12,15
기유,21,15,19
경술,21,13,19
신해,18,11,16
임자,17,15,15
계축,18,13,16
갑인,19,16,17
을묘,18,14,16
병진,20,12,18
정사,15,10,13
무오,14,14,12
기미,22,17,20
경신,20,15,18
신유,19,13,17
임술,19,11,17
계해,16,9,14
`.trim();

const TOJEONG_REFERENCE_MAP = new Map(
  TOJEONG_REFERENCE_CSV.split("\n").map((row) => {
    const [pillar, ageNumber, monthNumber, dayNumber] = row.split(",");
    return [pillar, {
      ageNumber: Number(ageNumber),
      monthNumber: Number(monthNumber),
      dayNumber: Number(dayNumber),
    }];
  })
);

const THEME_RULES = [
  {
    label: "재물",
    tone: "good",
    keywords: ["財", "재물", "진재", "생재", "천금", "금전", "풍요", "횡재", "재리", "재성", "득재"],
  },
  {
    label: "귀인",
    tone: "good",
    keywords: ["貴人", "귀인", "人助", "상조", "來助", "助我", "신조아"],
  },
  {
    label: "경사",
    tone: "good",
    keywords: ["喜", "慶", "기쁜", "경사", "喜事", "家有吉慶", "有慶", "농장", "득남", "貴子"],
  },
  {
    label: "성사",
    tone: "good",
    keywords: ["成", "亨通", "如意", "順成", "大吉", "吉", "고명", "登科", "榮", "通", "所望"],
  },
  {
    label: "명예·관록",
    tone: "good",
    keywords: ["官", "祿", "名", "科甲", "登科", "榮貴", "관록", "명예", "고명"],
  },
  {
    label: "가정·자녀",
    tone: "good",
    keywords: ["家", "膝下", "子", "妻", "弄璋", "가중", "자손", "슬하", "부부", "가인"],
  },
  {
    label: "이동",
    tone: "neutral",
    keywords: ["遠行", "出行", "奔走", "驛馬", "移", "원행", "출행", "분주", "이사", "객지"],
  },
  {
    label: "구설·분쟁",
    tone: "warn",
    keywords: ["口舌", "是非", "訟", "相爭", "시비", "구설", "송사", "다툼"],
  },
  {
    label: "손재",
    tone: "warn",
    keywords: ["損財", "失物", "破財", "虛費", "財消", "손재", "재물자거", "손실", "허비"],
  },
  {
    label: "건강·액운",
    tone: "warn",
    keywords: ["病", "疾病", "厄", "災", "禍", "驚", "憂", "危", "困辱", "질병", "액", "재화", "상복"],
  },
  {
    label: "속도 조절",
    tone: "warn",
    keywords: ["勿", "莫", "守分", "愼", "安居", "妄進", "불리", "조심", "분수", "수분", "망동"],
  },
];

const POSITIVE_MARKERS = [
  "吉",
  "喜",
  "慶",
  "福",
  "貴",
  "榮",
  "成",
  "得",
  "利",
  "通",
  "如意",
  "和平",
  "亨通",
  "順成",
  "풍요",
  "대길",
  "경사",
];

const NEGATIVE_MARKERS = [
  "凶",
  "厄",
  "病",
  "災",
  "禍",
  "憂",
  "危",
  "困",
  "辱",
  "口舌",
  "損",
  "失",
  "破",
  "虛",
  "不利",
  "無益",
  "가외",
  "불리",
  "구설",
  "액",
  "손재",
  "질병",
];

const DIRECTION_LABELS = [
  { char: "東", label: "동쪽" },
  { char: "西", label: "서쪽" },
  { char: "南", label: "남쪽" },
  { char: "北", label: "북쪽" },
];

let tojeongFortunesPromise = null;
const TOJEONG_FORTUNES_URL = new URL("../../data/tojeong-fortunes.json", import.meta.url);

function oneBasedModulo(value, divisor) {
  const remainder = ((Number(value) % divisor) + divisor) % divisor;
  return remainder === 0 ? divisor : remainder;
}

function buildPillarKey(pillar) {
  return `${pillar.heavenlyStem}${pillar.earthlyBranch}`;
}

function normalizeSearchText(lines) {
  return lines
    .map((line) => `${line.hanja} ${line.reading}`)
    .join(" ")
    .normalize("NFKC");
}

function countMatches(text, markers) {
  return markers.reduce((count, marker) => {
    if (!marker) return count;
    return count + (text.includes(marker.normalize("NFKC")) ? 1 : 0);
  }, 0);
}

function extractThemes(text) {
  return THEME_RULES
    .map((rule) => ({
      label: rule.label,
      tone: rule.tone,
      count: countMatches(text, rule.keywords),
    }))
    .filter((rule) => rule.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label, "ko");
    });
}

function buildTone(score) {
  if (score >= 2) return { key: "good", label: "상승" };
  if (score <= -2) return { key: "warn", label: "주의" };
  return { key: "neutral", label: "혼합" };
}

function buildMonthInsight(month) {
  const text = normalizeSearchText(month.lines);
  const goodCount = countMatches(text, POSITIVE_MARKERS);
  const warnCount = countMatches(text, NEGATIVE_MARKERS);
  const score = goodCount - warnCount;
  const tone = buildTone(score);
  const themes = extractThemes(text);
  const goodThemes = themes.filter((theme) => theme.tone === "good").map((theme) => theme.label);
  const warnThemes = themes.filter((theme) => theme.tone === "warn").map((theme) => theme.label);

  let summary = "길흉이 함께 보이는 달입니다.";
  if (tone.key === "good") {
    summary = `${(goodThemes[0] || "기회")} 흐름이 비교적 또렷하게 보이는 달입니다.`;
  } else if (tone.key === "warn") {
    summary = `${(warnThemes[0] || "변수")} 관리에 더 신경 쓰는 편이 좋은 달입니다.`;
  } else if (goodThemes[0] && warnThemes[0]) {
    summary = `${goodThemes[0]} 기회가 있으나 ${warnThemes[0]} 변수도 함께 보이는 달입니다.`;
  } else if (goodThemes[0]) {
    summary = `${goodThemes[0]} 흐름을 조심스럽게 밀어볼 만한 달입니다.`;
  } else if (warnThemes[0]) {
    summary = `${warnThemes[0]} 키워드를 먼저 살피는 편이 좋은 달입니다.`;
  }

  return {
    month: month.month,
    lines: month.lines,
    score,
    tone,
    summary,
    themes,
  };
}

function detectDirections(text) {
  return DIRECTION_LABELS
    .filter((item) => text.includes(item.char))
    .map((item) => item.label);
}

function buildAnnualHeadline(score) {
  if (score >= 9) return "기회가 넓게 열리는 해";
  if (score >= 3) return "상승 흐름이 살아나는 해";
  if (score <= -9) return "보수적으로 갈수록 유리한 해";
  if (score <= -3) return "속도 조절이 중요한 해";
  return "길흉이 함께 오는 해";
}

function buildAnnualSummary(fortune, monthInsights) {
  const overallText = normalizeSearchText(fortune.overall);
  const overallThemes = extractThemes(overallText);
  const goodThemes = overallThemes.filter((theme) => theme.tone === "good").slice(0, 3).map((theme) => theme.label);
  const warnThemes = overallThemes.filter((theme) => theme.tone === "warn").slice(0, 3).map((theme) => theme.label);
  const score = countMatches(overallText, POSITIVE_MARKERS)
    - countMatches(overallText, NEGATIVE_MARKERS)
    + monthInsights.reduce((total, month) => total + month.score, 0);
  const headline = buildAnnualHeadline(score);
  const risingMonths = monthInsights
    .filter((month) => month.score > 0)
    .sort((left, right) => right.score - left.score || left.month - right.month)
    .slice(0, 3)
    .map((month) => `${month.month}월`);
  const cautionMonths = monthInsights
    .filter((month) => month.score < 0)
    .sort((left, right) => left.score - right.score || left.month - right.month)
    .slice(0, 3)
    .map((month) => `${month.month}월`);
  const directions = detectDirections(overallText);

  const sentences = [];
  if (goodThemes.length) {
    sentences.push(`${goodThemes.join(", ")} 신호가 총운 원문에 자주 반복됩니다.`);
  }
  if (warnThemes.length) {
    sentences.push(`${warnThemes.join(", ")} 키워드도 함께 보여 무리한 확장은 피하는 편이 좋습니다.`);
  }
  if (risingMonths.length) {
    sentences.push(`비교적 힘을 실어볼 달은 ${risingMonths.join(", ")}입니다.`);
  }
  if (cautionMonths.length) {
    sentences.push(`보수적으로 보는 달은 ${cautionMonths.join(", ")}입니다.`);
  }
  if (directions.length) {
    sentences.push(`원문에 반복되는 방향 키워드는 ${directions.join(", ")}입니다.`);
  }

  return {
    score,
    headline,
    summary: sentences.join(" "),
    goodThemes,
    warnThemes,
    directions,
    risingMonths,
    cautionMonths,
  };
}

async function loadTojeongFortunes() {
  if (!tojeongFortunesPromise) {
    tojeongFortunesPromise = fetch(TOJEONG_FORTUNES_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`토정비결 데이터를 불러오지 못했습니다. (${response.status})`);
        }
        return response.json();
      });
  }

  return tojeongFortunesPromise;
}

function normalizeBirthToLunar({ year, month, day, isLunar, isLeapMonth }) {
  if (isLunar) {
    return {
      year,
      month,
      day,
      isLeapMonth: Boolean(isLeapMonth),
    };
  }

  const lunar = solarToLunar(year, month, day);
  return {
    year: lunar.year,
    month: lunar.month,
    day: lunar.day,
    isLeapMonth: Boolean(lunar.isLeapMonth),
  };
}

function buildPillarLookup(lunarBirth) {
  const pillars = calculateFourPillars({
    year: lunarBirth.year,
    month: lunarBirth.month,
    day: lunarBirth.day,
    hour: 12,
    minute: 0,
    isLunar: true,
    isLeapMonth: lunarBirth.isLeapMonth,
  });

  const yearKey = buildPillarKey(pillars.year);
  const monthKey = buildPillarKey(pillars.month);
  const dayKey = buildPillarKey(pillars.day);
  const yearNumbers = TOJEONG_REFERENCE_MAP.get(yearKey);
  const monthNumbers = TOJEONG_REFERENCE_MAP.get(monthKey);
  const dayNumbers = TOJEONG_REFERENCE_MAP.get(dayKey);

  if (!yearNumbers || !monthNumbers || !dayNumbers) {
    throw new Error("토정비결 수표를 찾지 못했습니다.");
  }

  return {
    pillars,
    yearKey,
    monthKey,
    dayKey,
    yearNumbers,
    monthNumbers,
    dayNumbers,
  };
}

function resolveBirthMonthLength(fortuneYear, lunarBirth) {
  const leapMonth = getLeapMonthForYear(fortuneYear);
  const useLeapMonth = Boolean(lunarBirth.isLeapMonth && leapMonth === lunarBirth.month);
  return {
    days: getLunarMonthLength(fortuneYear, lunarBirth.month, useLeapMonth),
    useLeapMonth,
  };
}

export async function calculateTojeongReading({
  name = "",
  year,
  month,
  day,
  birthTime = "",
  unknownTime = false,
  isLunar = false,
  isLeapMonth = false,
  fortuneYear,
}) {
  const fortunes = await loadTojeongFortunes();
  const lunarBirth = normalizeBirthToLunar({
    year,
    month,
    day,
    isLunar,
    isLeapMonth,
  });
  const pillarLookup = buildPillarLookup(lunarBirth);
  const age = fortuneYear - lunarBirth.year + 1;

  if (age < 1) {
    throw new Error("선택한 연도는 출생년 이후여야 합니다.");
  }

  const birthMonthLength = resolveBirthMonthLength(fortuneYear, lunarBirth);
  const upper = oneBasedModulo(age + pillarLookup.yearNumbers.ageNumber, 8);
  const middle = oneBasedModulo(birthMonthLength.days + pillarLookup.monthNumbers.monthNumber, 6);
  const lower = oneBasedModulo(lunarBirth.day + pillarLookup.dayNumbers.dayNumber, 3);
  const code = `${upper}${middle}${lower}`;
  const fortune = fortunes[code];

  if (!fortune) {
    throw new Error("토정비결 원문 데이터를 찾지 못했습니다.");
  }

  const monthInsights = fortune.months.map(buildMonthInsight);
  const annualSummary = buildAnnualSummary(fortune, monthInsights);
  const hourLabel = unknownTime || !birthTime ? "시간 모름" : birthTime;

  return {
    code,
    name: String(name || "").trim(),
    fortuneYear,
    fortune,
    monthInsights,
    annualSummary,
    birth: {
      input: {
        year,
        month,
        day,
        birthTime,
        unknownTime,
        isLunar: Boolean(isLunar),
        isLeapMonth: Boolean(isLeapMonth),
      },
      lunar: lunarBirth,
      hourLabel,
      pillars: {
        year: pillarLookup.yearKey,
        month: pillarLookup.monthKey,
        day: pillarLookup.dayKey,
      },
    },
    calculation: {
      age,
      birthMonthLength: birthMonthLength.days,
      birthMonthUsesLeap: birthMonthLength.useLeapMonth,
      yearNumber: pillarLookup.yearNumbers.ageNumber,
      monthNumber: pillarLookup.monthNumbers.monthNumber,
      dayNumber: pillarLookup.dayNumbers.dayNumber,
      upper,
      middle,
      lower,
    },
  };
}
