import {
  calculateFourPillars,
  getHeavenlyStemElement,
  getHeavenlyStemYinYang,
  getPillarByCycleIndex,
  getPillarCycleIndex,
  getSolarTermDate,
  getYearPillar,
  normalizeBirthInfo,
} from "./soulscan-engine.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TEN_GODS = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];

const BRANCH_HIDDEN_STEMS = {
  자: ["계"],
  축: ["기", "계", "신"],
  인: ["갑", "병", "무"],
  묘: ["을"],
  진: ["무", "을", "계"],
  사: ["병", "무", "경"],
  오: ["정", "기"],
  미: ["기", "정", "을"],
  신: ["경", "임", "무"],
  유: ["신"],
  술: ["무", "신", "정"],
  해: ["임", "갑"],
};

const ELEMENT_GENERATES = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
};

const ELEMENT_CONTROLS = {
  목: "토",
  화: "금",
  토: "수",
  금: "목",
  수: "화",
};

const ELEMENT_LABEL = {
  목: "목",
  화: "화",
  토: "토",
  금: "금",
  수: "수",
};

const PILLAR_LABEL = {
  year: "년주",
  month: "월주",
  day: "일주",
  hour: "시주",
};

const GOD_BRIEF = {
  비견: "자기주도, 독립, 같은 결의 사람",
  겁재: "경쟁, 네트워크, 분산과 지출",
  식신: "생산성, 꾸준한 실력, 생활력",
  상관: "표현력, 기획력, 규범 돌파",
  편재: "사업성, 기회 포착, 외부 자원",
  정재: "안정 수입, 관리, 실속",
  편관: "압박, 승부, 도전 과제",
  정관: "직장, 규칙, 책임, 평판",
  편인: "전문성, 직감, 비정형 사고",
  정인: "학습, 보호, 문서, 자격",
};

function controls(fromElement, toElement) {
  return ELEMENT_CONTROLS[fromElement] === toElement;
}

function generates(fromElement, toElement) {
  return ELEMENT_GENERATES[fromElement] === toElement;
}

function getWealthElement(dayElement) {
  return ELEMENT_CONTROLS[dayElement];
}

function isSameYinYang(stemA, stemB) {
  return getHeavenlyStemYinYang(stemA) === getHeavenlyStemYinYang(stemB);
}

function isWealthGod(god) {
  return god === "정재" || god === "편재";
}

function isOutputGod(god) {
  return god === "식신" || god === "상관";
}

function isResourceGod(god) {
  return god === "정인" || god === "편인";
}

function isOfficialGod(god) {
  return god === "정관" || god === "편관";
}

function isPeerGod(god) {
  return god === "비견" || god === "겁재";
}

function formatOneDecimal(value) {
  return Number(value.toFixed(1));
}

function getTenGod(dayStem, targetStem, { selfLabel = false } = {}) {
  if (!dayStem || !targetStem) return "";
  if (selfLabel && dayStem === targetStem) return "일원";

  const dayElement = getHeavenlyStemElement(dayStem);
  const targetElement = getHeavenlyStemElement(targetStem);
  const sameYinYang = isSameYinYang(dayStem, targetStem);

  if (dayElement === targetElement) {
    return sameYinYang ? "비견" : "겁재";
  }

  if (generates(dayElement, targetElement)) {
    return sameYinYang ? "식신" : "상관";
  }

  if (generates(targetElement, dayElement)) {
    return sameYinYang ? "편인" : "정인";
  }

  if (controls(dayElement, targetElement)) {
    return sameYinYang ? "편재" : "정재";
  }

  if (controls(targetElement, dayElement)) {
    return sameYinYang ? "편관" : "정관";
  }

  return "";
}

function getHiddenStemDetails(dayStem, branch) {
  return (BRANCH_HIDDEN_STEMS[branch] || []).map((stem, index) => ({
    stem,
    tenGod: getTenGod(dayStem, stem),
    isPrimary: index === 0,
  }));
}

function sortTopCounts(counts) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || TEN_GODS.indexOf(a[0]) - TEN_GODS.indexOf(b[0]));
}

function buildTenGodData(pillars, options = {}) {
  const dayStem = pillars.day.stem.char;
  const counts = Object.fromEntries(TEN_GODS.map((god) => [god, 0]));

  const items = ["year", "month", "day", "hour"].map((pillarKey) => {
    const pillar = pillars[pillarKey];
    const isUnknown = !pillar || pillar.stem.empty || pillar.branch.empty;

    if (isUnknown) {
      return {
        key: pillarKey,
        title: PILLAR_LABEL[pillarKey],
        stem: "",
        stemTenGod: "미상",
        branch: "",
        branchTenGod: "미상",
        hiddenStems: [],
      };
    }

    const hiddenStems = getHiddenStemDetails(dayStem, pillar.branch.char);
    const stemTenGod = pillarKey === "day"
      ? getTenGod(dayStem, pillar.stem.char, { selfLabel: true })
      : getTenGod(dayStem, pillar.stem.char);
    const branchTenGod = hiddenStems[0]?.tenGod || "";

    if (stemTenGod && stemTenGod !== "일원" && counts[stemTenGod] !== undefined) {
      counts[stemTenGod] += 1;
    }

    hiddenStems.forEach((item) => {
      if (counts[item.tenGod] !== undefined) {
        counts[item.tenGod] += 1;
      }
    });

    return {
      key: pillarKey,
      title: PILLAR_LABEL[pillarKey],
      stem: pillar.stem.char,
      stemTenGod,
      branch: pillar.branch.char,
      branchTenGod,
      hiddenStems,
    };
  });

  const topCounts = sortTopCounts(counts);
  const summaryBits = topCounts.slice(0, 3).map(([god, count]) => `${god} ${count}`);
  const summary = summaryBits.length
    ? `원국에서 자주 드러나는 십성은 ${summaryBits.join(", ")}입니다. 천간보다 지장간까지 같이 보면 숨어 있는 성향이 더 또렷해집니다.`
    : "시주가 비어 있거나 입력 정보가 제한되어 있어 십성 분포는 보수적으로 표시했습니다.";
  const note = options.unknownTime
    ? "시간을 모르는 경우 시주의 십성과 지장간은 제외되어 전체 분포가 실제보다 단순하게 보일 수 있습니다."
    : "";

  return {
    summary,
    note,
    counts: topCounts,
    items,
  };
}

function getLuckDirection(gender, yearStem) {
  const yearIsYang = getHeavenlyStemYinYang(yearStem) === "양";
  if (gender === "male") return yearIsYang ? 1 : -1;
  return yearIsYang ? -1 : 1;
}

function getBoundaryTermsAround(date) {
  const termDates = [];
  const year = date.getFullYear();

  for (let currentYear = year - 1; currentYear <= year + 1; currentYear += 1) {
    for (let termIndex = 0; termIndex < 24; termIndex += 2) {
      termDates.push(getSolarTermDate(currentYear, termIndex));
    }
  }

  termDates.sort((a, b) => a.getTime() - b.getTime());

  const next = termDates.find((termDate) => termDate.getTime() >= date.getTime()) || termDates[termDates.length - 1];
  const previous = [...termDates].reverse().find((termDate) => termDate.getTime() <= date.getTime()) || termDates[0];

  return { next, previous };
}

function getCurrentFortuneYear(currentDate) {
  const year = currentDate.getFullYear();
  const lichun = getSolarTermDate(year, 2);
  return currentDate.getTime() < lichun.getTime() ? year - 1 : year;
}

function buildLuckFocus(stemGod, branchGod) {
  const gods = [stemGod, branchGod].filter(Boolean);

  if (gods.some(isWealthGod) && gods.some(isOutputGod)) return "수익화·성과";
  if (gods.some(isWealthGod)) return "재물·실속";
  if (gods.some(isOfficialGod)) return "직장·책임";
  if (gods.some(isOutputGod)) return "표현·확장";
  if (gods.some(isResourceGod)) return "학습·정비";
  if (gods.some(isPeerGod)) return "경쟁·협업";
  return "기본 흐름";
}

function buildLuckNote(stemGod, branchGod) {
  const gods = [stemGod, branchGod].filter(Boolean);

  if (gods.some(isWealthGod) && gods.some(isOutputGod)) {
    return "실력이나 결과물을 실제 수익으로 연결하기 좋은 흐름입니다.";
  }

  if (gods.some(isWealthGod)) {
    return "실속, 계약, 현금흐름 관리, 수익화 포인트가 눈에 띄는 시기입니다.";
  }

  if (gods.some(isOfficialGod)) {
    return "직장, 책임, 평가, 규칙, 역할 변화가 앞쪽으로 드러나기 쉬운 시기입니다.";
  }

  if (gods.some(isOutputGod)) {
    return "표현, 확장, 기획, 성과 공개, 실행 속도가 중요해지는 흐름입니다.";
  }

  if (gods.some(isResourceGod)) {
    return "학습, 자격, 문서, 준비, 회복, 내공 축적에 힘이 실리는 시기입니다.";
  }

  if (gods.some(isPeerGod)) {
    return "경쟁과 협업이 동시에 들어오기 쉬워 사람 문제와 지출 관리가 중요합니다.";
  }

  return "기본기를 다지고 생활 리듬을 정돈하는 쪽에 무게가 실리는 흐름입니다.";
}

function buildMajorLuckData({ birthInfo, pillars, gender, unknownTime, currentDate = new Date() }) {
  const dayStem = pillars.day.stem.char;
  const safeBirthInfo = {
    ...birthInfo,
    hour: birthInfo.hour ?? 12,
    minute: birthInfo.minute ?? 0,
  };
  const normalizedBirth = normalizeBirthInfo(safeBirthInfo);
  const baseFourPillars = calculateFourPillars(safeBirthInfo);
  const direction = getLuckDirection(gender, baseFourPillars.year.heavenlyStem);
  const birthDate = new Date(
    normalizedBirth.year,
    normalizedBirth.month - 1,
    normalizedBirth.day,
    normalizedBirth.hour,
    normalizedBirth.minute,
  );
  const { next, previous } = getBoundaryTermsAround(birthDate);
  const boundaryDate = direction === 1 ? next : previous;
  const diffDays = Math.abs(boundaryDate.getTime() - birthDate.getTime()) / MS_PER_DAY;
  const startAge = formatOneDecimal(diffDays / 3);
  const monthCycleIndex = getPillarCycleIndex(baseFourPillars.month);
  const currentYear = currentDate.getFullYear();

  const items = Array.from({ length: 8 }, (_, index) => {
    const pillar = getPillarByCycleIndex(monthCycleIndex + direction * (index + 1));
    const primaryHiddenStem = BRANCH_HIDDEN_STEMS[pillar.earthlyBranch]?.[0] || "";
    const stemGod = getTenGod(dayStem, pillar.heavenlyStem);
    const branchGod = primaryHiddenStem ? getTenGod(dayStem, primaryHiddenStem) : "";
    const ageStart = formatOneDecimal(startAge + index * 10);
    const ageEnd = formatOneDecimal(ageStart + 9.9);
    const startYear = normalizedBirth.year + Math.floor(ageStart);
    const endYear = normalizedBirth.year + Math.floor(ageEnd);
    const wealthHitCount = [stemGod, branchGod].filter(isWealthGod).length;

    return {
      index: index + 1,
      pillarString: `${pillar.heavenlyStem}${pillar.earthlyBranch}`,
      stemGod,
      branchGod,
      ageStart,
      ageEnd,
      startYear,
      endYear,
      focus: buildLuckFocus(stemGod, branchGod),
      note: buildLuckNote(stemGod, branchGod),
      wealthHitCount,
      isCurrent: currentYear >= startYear && currentYear <= endYear,
    };
  });

  const currentMajorLuck = items.find((item) => item.isCurrent) || items[0];
  const directionText = direction === 1 ? "순행" : "역행";
  const note = unknownTime
    ? "태어난 시간을 모르는 경우 대운 시작 시점은 정오 기준으로 계산해 실제보다 몇 개월 차이가 날 수 있습니다."
    : "";

  return {
    direction: directionText,
    startAge,
    note,
    summary: `대운은 ${directionText}으로 흐르며, 출생 후 약 ${startAge}세부터 첫 대운이 시작되는 구조로 계산했습니다.`,
    current: currentMajorLuck,
    items,
  };
}

function buildYearLuckData({ dayStem, currentDate = new Date(), count = 10 }) {
  const currentFortuneYear = getCurrentFortuneYear(currentDate);

  const items = Array.from({ length: count }, (_, index) => {
    const targetYear = currentFortuneYear + index;
    const yearPillar = getYearPillar(targetYear, 6, 15);
    const primaryHiddenStem = BRANCH_HIDDEN_STEMS[yearPillar.earthlyBranch]?.[0] || "";
    const stemGod = getTenGod(dayStem, yearPillar.heavenlyStem);
    const branchGod = primaryHiddenStem ? getTenGod(dayStem, primaryHiddenStem) : "";
    const wealthHitCount = [stemGod, branchGod].filter(isWealthGod).length;

    return {
      year: targetYear,
      pillarString: `${yearPillar.heavenlyStem}${yearPillar.earthlyBranch}`,
      stemGod,
      branchGod,
      focus: buildLuckFocus(stemGod, branchGod),
      note: buildLuckNote(stemGod, branchGod),
      wealthHitCount,
      isCurrent: index === 0,
    };
  });

  return {
    summary: `세운은 현재 기준 ${currentFortuneYear}년부터 앞으로 ${count}년 흐름을 함께 보여줍니다.`,
    items,
  };
}

function buildMoneyStyleText(properCount, irregularCount, counts) {
  if (properCount > irregularCount) {
    return "정재 쪽 비중이 더 커서 안정 수입, 계약, 고정적인 현금흐름, 예산 관리형 돈 운과 비교적 잘 맞는 편입니다.";
  }

  if (irregularCount > properCount) {
    return "편재 비중이 더 커서 영업, 사업, 외부 기회, 네트워크, 부수입처럼 유동적인 돈 흐름에 감각이 살아날 수 있습니다.";
  }

  if (properCount + irregularCount > 0) {
    return "정재와 편재가 함께 보이는 편이라 안정 수입과 기회형 수입을 병행할 때 장점이 잘 살아날 수 있습니다.";
  }

  if (counts.식신 + counts.상관 >= 2) {
    return "재성이 겉으로 강하게 많지는 않지만 식상 쪽이 살아 있어, 실력과 결과물을 수익으로 연결하는 방식이 더 안정적으로 맞을 수 있습니다.";
  }

  return "재성이 겉으로 많이 드러난 구조는 아니라, 돈은 한 번에 크게 벌기보다 생활 구조와 경력의 안정 속에서 서서히 쌓는 방식이 더 맞을 수 있습니다.";
}

function buildCurrentMoneyFlowText(majorLuck, yearLuck) {
  const currentMajor = majorLuck.current;
  const currentYear = yearLuck.items[0];
  const totalWealthHits = currentMajor.wealthHitCount + currentYear.wealthHitCount;
  const currentMajorLabel = `대운 ${currentMajor.pillarString}(${currentMajor.stemGod}/${currentMajor.branchGod})`;
  const currentYearLabel = `세운 ${currentYear.year}년 ${currentYear.pillarString}(${currentYear.stemGod}/${currentYear.branchGod})`;

  if (totalWealthHits >= 3) {
    return `현재 ${currentMajorLabel}와 ${currentYearLabel}에서 재성 신호가 강하게 겹쳐, 실속 챙기기와 수익화, 계약 관리에 특히 신경 쓸 만한 시기입니다.`;
  }

  if (totalWealthHits >= 1) {
    return `현재 ${currentMajorLabel}, ${currentYearLabel}에서는 재성 신호가 일부 들어와 있어 돈 문제를 정리하고 실속을 챙기기 좋은 흐름이 열려 있습니다.`;
  }

  if (isOutputGod(currentMajor.stemGod) || isOutputGod(currentMajor.branchGod) || isOutputGod(currentYear.stemGod) || isOutputGod(currentYear.branchGod)) {
    return `현재는 재성이 직접 강하게 들어오기보다 ${currentMajorLabel}과 ${currentYearLabel}을 통해 실력, 결과물, 성과를 먼저 키우고 그것을 돈으로 연결하는 흐름에 가깝습니다.`;
  }

  if (isOfficialGod(currentMajor.stemGod) || isOfficialGod(currentMajor.branchGod) || isOfficialGod(currentYear.stemGod) || isOfficialGod(currentYear.branchGod)) {
    return `현재는 재물 자체보다 직장, 책임, 역할 변화가 돈의 흐름을 좌우하기 쉬운 시기라 커리어 안정이 곧 재물 관리의 핵심이 됩니다.`;
  }

  return `현재 흐름은 돈이 갑자기 커지기보다 생활 구조와 지출 관리, 역할 정리가 함께 맞물리며 실속을 만드는 쪽에 가깝습니다.`;
}

function buildUpcomingMoneyText(yearLuck) {
  const richYears = yearLuck.items.filter((item) => item.wealthHitCount > 0).slice(0, 3);

  if (!richYears.length) {
    return "앞으로 바로 재성 신호가 강하게 들어오는 해가 많지는 않아, 성급한 투자보다 준비된 기회를 기다리는 편이 유리합니다.";
  }

  return `가까이서 재성 신호가 비교적 또렷한 해는 ${richYears.map((item) => `${item.year}년`).join(", ")} 정도로 보여, 해당 시기에는 수익화와 계약, 저축 계획을 더 적극적으로 점검해 볼 만합니다.`;
}

function buildWealthData({ pillars, tenGods, majorLuck, yearLuck, unknownTime }) {
  const dayStem = pillars.day.stem.char;
  const dayElement = getHeavenlyStemElement(dayStem);
  const wealthElement = getWealthElement(dayElement);

  let visibleWealthCount = 0;
  let hiddenWealthCount = 0;
  let properCount = 0;
  let irregularCount = 0;

  tenGods.items.forEach((item) => {
    if (item.stemTenGod && isWealthGod(item.stemTenGod)) {
      visibleWealthCount += 1;
      if (item.stemTenGod === "정재") properCount += 1;
      if (item.stemTenGod === "편재") irregularCount += 1;
    }

    item.hiddenStems.forEach((hidden) => {
      if (isWealthGod(hidden.tenGod)) {
        hiddenWealthCount += 1;
        if (hidden.tenGod === "정재") properCount += 1;
        if (hidden.tenGod === "편재") irregularCount += 1;
      }
    });
  });

  const countMap = Object.fromEntries(TEN_GODS.map((god) => [god, 0]));
  tenGods.counts.forEach(([god, count]) => {
    countMap[god] = count;
  });

  const totalWealthCount = visibleWealthCount + hiddenWealthCount;
  const strengthText = totalWealthCount >= 5
    ? "재성이 비교적 두드러지는 편"
    : totalWealthCount >= 3
      ? "재성 신호가 중간 이상으로 보이는 편"
      : totalWealthCount >= 1
        ? "재성은 숨어 있는 형태로 보이는 편"
        : "재성이 강하게 드러난 사주는 아닌 편";

  const cards = [
    {
      title: "재성 구조",
      text: `일간 기준 재물 오행은 ${ELEMENT_LABEL[wealthElement]}입니다. 원국에서는 ${strengthText}으로, 천간에 드러난 재성은 ${visibleWealthCount}개이고 지장간까지 포함한 전체 재성은 ${totalWealthCount}개입니다. 정재 ${properCount}개, 편재 ${irregularCount}개 흐름으로 읽을 수 있습니다.`,
    },
    {
      title: "돈 버는 방식",
      text: `${buildMoneyStyleText(properCount, irregularCount, countMap)} ${countMap.비견 + countMap.겁재 >= 3 ? "비겁 기운도 적지 않아 사람 문제나 경쟁, 충동 지출로 새는 돈은 의식적으로 관리하는 편이 좋습니다." : ""} ${countMap.정인 + countMap.편인 >= 3 ? "인성 비중이 높다면 자격, 공부, 문서, 전문성 축적이 결국 돈의 안정으로 이어지기 쉽습니다." : ""}`.trim(),
    },
    {
      title: "현재 재물 흐름",
      text: `${buildCurrentMoneyFlowText(majorLuck, yearLuck)} ${buildUpcomingMoneyText(yearLuck)} ${unknownTime ? "시주가 없으면 후반부 재물 강도는 실제와 조금 다를 수 있습니다." : ""}`.trim(),
    },
  ];

  return {
    summary: `재물운은 단순히 돈이 많고 적다기보다, 재성이 어떤 형태로 보이고 현재 대운·세운이 어디에 힘을 싣는지 함께 보는 편이 정확합니다.`,
    cards,
  };
}

export function buildAdvancedSajuData({ birthInfo, pillars, gender, unknownTime, currentDate = new Date() }) {
  const tenGods = buildTenGodData(pillars, { unknownTime });
  const majorLuck = buildMajorLuckData({ birthInfo, pillars, gender, unknownTime, currentDate });
  const yearLuck = buildYearLuckData({ dayStem: pillars.day.stem.char, currentDate });
  const wealth = buildWealthData({ pillars, tenGods, majorLuck, yearLuck, unknownTime });

  return {
    tenGods,
    wealth,
    majorLuck,
    yearLuck,
  };
}

export function formatHiddenStemLine(hiddenStems) {
  if (!hiddenStems.length) return "없음";
  return hiddenStems
    .map((item) => `${item.stem}(${item.tenGod})`)
    .join(" · ");
}

export function getLuckItemMeta(item) {
  return `${item.stemGod} / ${item.branchGod}`;
}

export function getLuckItemCaption(item) {
  return `${item.focus} · ${item.note}`;
}

export function getTenGodBrief(god) {
  return GOD_BRIEF[god] || "";
}
