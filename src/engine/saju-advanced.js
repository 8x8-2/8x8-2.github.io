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

const GOD_IMPACT = {
  비견: {
    background: "배경에는 독립 실행, 자기 기준, 혼자 결정해야 하는 상황이 깔리기 쉽습니다.",
    result: "실제 체감은 내 뜻대로 밀고 가려는 마음과 정면 승부의 장면으로 드러나기 쉽습니다.",
    boosts: ["독립 실행", "자기 재정비"],
    cautions: ["고집", "정면 경쟁"],
  },
  겁재: {
    background: "배경에는 사람, 팀, 네트워크, 경쟁 구도가 함께 들어오는 경우가 많습니다.",
    result: "현실에서는 협업과 경쟁이 동시에 커지고, 돈이나 관계가 새는 문제를 같이 보게 되기 쉽습니다.",
    boosts: ["협업·인맥", "동료 추진력"],
    cautions: ["돈 샘", "관계 소모"],
  },
  식신: {
    background: "배경에는 꾸준히 만들고 쌓는 일, 생산성과 생활력의 흐름이 깔리기 쉽습니다.",
    result: "실제로는 결과물 생산, 실무 성과, 반복 숙련의 힘으로 체감되기 쉽습니다.",
    boosts: ["꾸준한 성과", "생산성"],
    cautions: ["페이스 늘어짐", "안일함"],
  },
  상관: {
    background: "배경에는 표현, 기획, 돌파, 기존 규칙을 넘고 싶은 마음이 강해질 수 있습니다.",
    result: "현실에서는 말, 기획, 성과 공개, 창의적 돌파가 눈에 띄는 대신 마찰도 함께 생기기 쉽습니다.",
    boosts: ["표현·기획", "돌파력"],
    cautions: ["말실수", "규칙 충돌"],
  },
  편재: {
    background: "배경에는 외부 기회, 사업성, 인맥, 유동적인 돈 흐름이 깔릴 수 있습니다.",
    result: "현실에서는 영업, 부수입, 투자·거래, 갑작스러운 지출 변동으로 체감되기 쉽습니다.",
    boosts: ["영업·기회", "부수입 감각"],
    cautions: ["변동성", "충동 지출"],
  },
  정재: {
    background: "배경에는 수입, 계약, 예산, 생활 안정처럼 현실 관리 이슈가 깔리기 쉽습니다.",
    result: "실제로는 돈, 계약, 생활비, 실속 챙기기 문제를 직접 체감하기 쉽습니다.",
    boosts: ["수입 안정", "계약·예산"],
    cautions: ["돈 압박", "책임 소비"],
  },
  편관: {
    background: "배경에는 압박, 승부, 경쟁 과제, 버텨야 하는 환경이 생기기 쉽습니다.",
    result: "현실에서는 긴장감, 권위 문제, 갑작스러운 도전 과제로 체감되기 쉽습니다.",
    boosts: ["승부력", "문제 돌파"],
    cautions: ["스트레스", "권위 충돌"],
  },
  정관: {
    background: "배경에는 직장, 규칙, 책임, 평가, 역할 정리가 깔릴 가능성이 큽니다.",
    result: "현실에서는 조직 내 자리, 평판, 승진, 책임 증가 같은 식으로 나타나기 쉽습니다.",
    boosts: ["직장 안정", "평판·책임"],
    cautions: ["압박 증가", "경직된 규칙"],
  },
  편인: {
    background: "배경에는 전문성, 직감, 혼자 파고드는 공부, 비정형적 사고가 깔리기 쉽습니다.",
    result: "현실에서는 아이디어는 많아지지만 예민함이나 고립감이 함께 올라올 수 있습니다.",
    boosts: ["전문성", "아이디어"],
    cautions: ["예민함", "고립감"],
  },
  정인: {
    background: "배경에는 학습, 문서, 자격, 보호, 도움을 받는 흐름이 들어오기 쉽습니다.",
    result: "현실에서는 공부, 서류, 멘토, 회복, 지원 체감으로 나타나기 쉬운 편입니다.",
    boosts: ["학습·문서", "지원·회복"],
    cautions: ["생각 과다", "행동 지연"],
  },
};

const BRANCH_HARMONY = {
  자: "축",
  축: "자",
  인: "해",
  해: "인",
  묘: "술",
  술: "묘",
  진: "유",
  유: "진",
  사: "신",
  신: "사",
  오: "미",
  미: "오",
};

const BRANCH_CLASH = {
  자: "오",
  오: "자",
  축: "미",
  미: "축",
  인: "신",
  신: "인",
  묘: "유",
  유: "묘",
  진: "술",
  술: "진",
  사: "해",
  해: "사",
};

const BRANCH_PUNISHMENT = {
  자: "묘",
  묘: "자",
  인: "사",
  사: "신",
  신: "인",
  축: "술",
  술: "미",
  미: "축",
};

const SELF_PUNISH_BRANCHES = new Set(["진", "오", "유", "해"]);

const BRANCH_BREAK = {
  자: "유",
  유: "자",
  축: "진",
  진: "축",
  인: "해",
  해: "인",
  묘: "오",
  오: "묘",
  사: "신",
  신: "사",
  미: "술",
  술: "미",
};

const BRANCH_HARM = {
  자: "미",
  미: "자",
  축: "오",
  오: "축",
  인: "사",
  사: "인",
  묘: "진",
  진: "묘",
  신: "해",
  해: "신",
  유: "술",
  술: "유",
};

const BRANCH_TRIADS = [
  { branches: ["해", "묘", "미"], element: "목" },
  { branches: ["인", "오", "술"], element: "화" },
  { branches: ["사", "유", "축"], element: "금" },
  { branches: ["신", "자", "진"], element: "수" },
];

const PILLAR_AREA = {
  year: "가족·바깥 환경",
  month: "직장·일상 리듬",
  day: "관계·생활",
  hour: "계획·후반부",
};

const STRENGTH_POSITION_WEIGHTS = {
  yearStem: 10,
  yearBranch: 10,
  monthStem: 10,
  monthBranch: 30,
  dayBranch: 20,
  hourStem: 10,
  hourBranch: 10,
};

const ELEMENT_PROXIMITY_WEIGHTS = {
  yearStem: 0.6,
  yearBranch: 0.6,
  monthStem: 1.1,
  monthBranch: 1.4,
  dayBranch: 1.2,
  hourStem: 0.8,
  hourBranch: 0.7,
};

const HIDDEN_STEM_WEIGHTS = [1, 0.45, 0.2];

const STEM_HARMONY = {
  갑: "기",
  기: "갑",
  을: "경",
  경: "을",
  병: "신",
  신: "병",
  정: "임",
  임: "정",
  무: "계",
  계: "무",
};

const COLD_BRANCHES = new Set(["해", "자", "축"]);
const HOT_BRANCHES = new Set(["사", "오", "미"]);

function controls(fromElement, toElement) {
  return ELEMENT_CONTROLS[fromElement] === toElement;
}

function generates(fromElement, toElement) {
  return ELEMENT_GENERATES[fromElement] === toElement;
}

function getGeneratedByElement(element) {
  return Object.keys(ELEMENT_GENERATES).find((key) => ELEMENT_GENERATES[key] === element) || "";
}

function getControlledByElement(element) {
  return Object.keys(ELEMENT_CONTROLS).find((key) => ELEMENT_CONTROLS[key] === element) || "";
}

function getWealthElement(dayElement) {
  return ELEMENT_CONTROLS[dayElement];
}

function getOutputElement(dayElement) {
  return ELEMENT_GENERATES[dayElement];
}

function getResourceElement(dayElement) {
  return getGeneratedByElement(dayElement);
}

function getOfficialElement(dayElement) {
  return getControlledByElement(dayElement);
}

function getBranchPrimaryStem(branch) {
  return BRANCH_HIDDEN_STEMS[branch]?.[0] || "";
}

function getBranchPrimaryElement(branch) {
  const primaryStem = getBranchPrimaryStem(branch);
  return primaryStem ? getHeavenlyStemElement(primaryStem) : "";
}

function getElementRole(dayElement, targetElement) {
  if (!dayElement || !targetElement) return "";
  if (dayElement === targetElement) return "self";
  if (generates(targetElement, dayElement)) return "resource";
  if (generates(dayElement, targetElement)) return "output";
  if (controls(dayElement, targetElement)) return "wealth";
  if (controls(targetElement, dayElement)) return "official";
  return "";
}

function isSupportRole(role) {
  return role === "self" || role === "resource";
}

function getPatternName(god) {
  switch (god) {
    case "비견":
      return "건록격";
    case "겁재":
      return "양인격";
    case "편관":
      return "칠살격";
    case "정관":
      return "정관격";
    case "편재":
      return "편재격";
    case "정재":
      return "정재격";
    case "식신":
      return "식신격";
    case "상관":
      return "상관격";
    case "편인":
      return "편인격";
    case "정인":
      return "정인격";
    default:
      return `${god}격`;
  }
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

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}

function createElementCounter() {
  return Object.fromEntries(Object.keys(ELEMENT_LABEL).map((element) => [element, 0]));
}

function createToneTag(label, tone = "neutral") {
  return { label, tone };
}

function getKnownStemEntries(pillars) {
  return ["year", "month", "day", "hour"]
    .map((pillarKey) => {
      const pillar = pillars[pillarKey];
      if (!pillar?.stem?.char || pillar.stem.empty) return null;
      return {
        pillarKey,
        label: PILLAR_LABEL[pillarKey],
        area: PILLAR_AREA[pillarKey],
        stem: pillar.stem.char,
      };
    })
    .filter(Boolean);
}

function getKnownBranchEntries(pillars) {
  return ["year", "month", "day", "hour"]
    .map((pillarKey) => {
      const pillar = pillars[pillarKey];
      if (!pillar?.branch?.char || pillar.branch.empty) return null;
      return {
        pillarKey,
        label: PILLAR_LABEL[pillarKey],
        area: PILLAR_AREA[pillarKey],
        branch: pillar.branch.char,
      };
    })
    .filter(Boolean);
}

function buildElementProfile(pillars) {
  const totals = createElementCounter();
  const proximity = createElementCounter();
  const positionElements = [];

  const addElement = (element, weightFactor, proximityWeight, meta) => {
    if (!element || !weightFactor) return;
    totals[element] += weightFactor;
    proximity[element] += proximityWeight;
    positionElements.push({
      ...meta,
      element,
      weightFactor,
      proximityWeight,
    });
  };

  for (const pillarKey of ["year", "month", "day", "hour"]) {
    const pillar = pillars[pillarKey];

    if (pillar?.stem?.char && !pillar.stem.empty) {
      const weight = STRENGTH_POSITION_WEIGHTS[`${pillarKey}Stem`] / 10;
      const proximityWeight = ELEMENT_PROXIMITY_WEIGHTS[`${pillarKey}Stem`];
      addElement(getHeavenlyStemElement(pillar.stem.char), weight, proximityWeight, {
        pillarKey,
        source: "stem",
        label: `${PILLAR_LABEL[pillarKey]} 천간`,
      });
    }

    if (pillar?.branch?.char && !pillar.branch.empty) {
      const branchWeight = STRENGTH_POSITION_WEIGHTS[`${pillarKey}Branch`] / 10;
      const proximityWeight = ELEMENT_PROXIMITY_WEIGHTS[`${pillarKey}Branch`];
      const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch.char] || [];

      hiddenStems.forEach((stem, index) => {
        const hiddenWeight = HIDDEN_STEM_WEIGHTS[index] || 0;
        addElement(getHeavenlyStemElement(stem), branchWeight * hiddenWeight, proximityWeight * hiddenWeight, {
          pillarKey,
          source: "branch",
          label: `${PILLAR_LABEL[pillarKey]} 지지`,
          stem,
          isPrimary: index === 0,
        });
      });
    }
  }

  const totalValue = Object.values(totals).reduce((sum, value) => sum + value, 0);

  return {
    totals: Object.fromEntries(
      Object.entries(totals).map(([element, value]) => [element, formatOneDecimal(value)])
    ),
    proximity: Object.fromEntries(
      Object.entries(proximity).map(([element, value]) => [element, formatOneDecimal(value)])
    ),
    totalValue: formatOneDecimal(totalValue),
    averageValue: formatOneDecimal(totalValue / Math.max(Object.keys(ELEMENT_LABEL).length, 1)),
    positionElements,
  };
}

function buildStrengthData(pillars) {
  const dayStem = pillars.day.stem.char;
  const dayElement = getHeavenlyStemElement(dayStem);
  const resourceElement = getResourceElement(dayElement);
  const supportElements = [dayElement, resourceElement];

  let totalWeight = 0;
  let supportWeight = 0;
  let rootBonus = 0;
  let otherSupportWeight = 0;
  let otherSupportCount = 0;

  const supportMarks = [];
  const rootMarks = [];

  const hasSupportInBranch = (branch) => {
    const hiddenStems = BRANCH_HIDDEN_STEMS[branch] || [];
    return hiddenStems.some((stem) => supportElements.includes(getHeavenlyStemElement(stem)));
  };

  const monthBranch = pillars.month.branch.char;
  const dayBranch = pillars.day.branch.char;
  const deukRyeong = hasSupportInBranch(monthBranch);
  const deukJi = hasSupportInBranch(dayBranch);

  const positions = [
    { pillarKey: "year", source: "stem" },
    { pillarKey: "year", source: "branch" },
    { pillarKey: "month", source: "stem" },
    { pillarKey: "month", source: "branch" },
    { pillarKey: "day", source: "branch" },
    { pillarKey: "hour", source: "stem" },
    { pillarKey: "hour", source: "branch" },
  ];

  positions.forEach(({ pillarKey, source }) => {
    const pillar = pillars[pillarKey];
    const glyph = pillar?.[source];
    if (!glyph?.char || glyph.empty) return;

    const positionKey = `${pillarKey}${source[0].toUpperCase()}${source.slice(1)}`;
    const weight = STRENGTH_POSITION_WEIGHTS[positionKey];
    if (!weight) return;

    totalWeight += weight;

    if (source === "stem") {
      const element = getHeavenlyStemElement(glyph.char);
      const role = getElementRole(dayElement, element);
      if (isSupportRole(role)) {
        supportWeight += weight;
        supportMarks.push(`${PILLAR_LABEL[pillarKey]} 생조`);
        if (pillarKey !== "month" && pillarKey !== "day") {
          otherSupportWeight += weight;
          otherSupportCount += 1;
        }
      }
      return;
    }

    const branch = glyph.char;
    const primaryElement = getBranchPrimaryElement(branch);
    const primaryRole = getElementRole(dayElement, primaryElement);
    const hiddenSupportCount = (BRANCH_HIDDEN_STEMS[branch] || []).filter((stem) => {
      const element = getHeavenlyStemElement(stem);
      return supportElements.includes(element);
    }).length;

    if (isSupportRole(primaryRole)) {
      supportWeight += weight;
      supportMarks.push(`${PILLAR_LABEL[pillarKey]} 통근`);
      if (pillarKey !== "month" && pillarKey !== "day") {
        otherSupportWeight += weight;
        otherSupportCount += 1;
      }
    }

    if (hiddenSupportCount > 0) {
      const bonusRate = isSupportRole(primaryRole) ? 0.18 : 0.38;
      const bonusWeight = Math.min(weight * 0.45, weight * (bonusRate + (hiddenSupportCount - 1) * 0.08));
      rootBonus += bonusWeight;
      rootMarks.push(`${PILLAR_LABEL[pillarKey]} 뿌리`);
      if (pillarKey !== "month" && pillarKey !== "day") {
        otherSupportWeight += formatOneDecimal(bonusWeight * 0.6);
      }
    }
  });

  const supportScore = Math.min(100, formatOneDecimal(((supportWeight + rootBonus) / Math.max(totalWeight, 1)) * 100));
  const deukSe = otherSupportWeight >= 30 || otherSupportCount >= 3;

  let label = "중화";
  let detailLabel = "균형권";

  if (supportScore >= 67) {
    label = "신강";
    detailLabel = "태강에 가까운 편";
  } else if (supportScore >= 55) {
    label = "신강";
    detailLabel = "강한 편";
  } else if (supportScore <= 34) {
    label = "신약";
    detailLabel = "태약에 가까운 편";
  } else if (supportScore <= 44) {
    label = "신약";
    detailLabel = "약한 편";
  }

  const flags = [
    deukRyeong ? "득령" : "월령 부담",
    deukJi ? "득지" : "뿌리 약함",
    deukSe ? "득세" : "세력 분산",
  ];

  const text = `월지의 계절감(득령), 일지의 뿌리(득지), 다른 천간·지지의 생조 분포(득세)를 함께 봤을 때 일간은 ${label} 쪽으로 읽힙니다. 현재 점수는 ${supportScore}점으로 ${detailLabel}이며, ${supportMarks.length ? `${supportMarks.slice(0, 3).join(", ")}에서 힘을 받는 편입니다.` : "생조 오행이 넉넉한 편은 아닙니다."}`;
  const note = `${deukRyeong ? "월지에서 기운을 받고" : "월지에서 직접 힘을 얻는 정도는 크지 않고"}, ${deukJi ? "일지 뿌리도 어느 정도 있습니다." : "일지 뿌리는 약한 편입니다."} ${rootMarks.length ? `${rootMarks.slice(0, 3).join(", ")}가 보조 신호로 작동합니다.` : ""}`.trim();

  return {
    label,
    detailLabel,
    supportScore,
    deukRyeong,
    deukJi,
    deukSe,
    supportElements,
    text,
    note,
    tags: flags.map((flag) => createToneTag(flag)),
    bias: supportScore >= 50 ? "supportHeavy" : "drainHeavy",
  };
}

function detectClimateAdjustment(elementProfile, monthBranch) {
  const fire = elementProfile.totals.화 || 0;
  const water = elementProfile.totals.수 || 0;

  if (COLD_BRANCHES.has(monthBranch) && fire < 2.2 && water > fire + 0.8) {
    return {
      applied: true,
      methodLabel: "조후 우선",
      helpfulPrimary: "화",
      helpfulSecondary: "목",
      harmfulPrimary: "수",
      harmfulSecondary: "금",
      note: "한랭한 계절감이 강해 온기를 보태는 화, 그 화를 돕는 목을 우선 참고했습니다.",
    };
  }

  if (HOT_BRANCHES.has(monthBranch) && water < 2.2 && fire > water + 0.8) {
    return {
      applied: true,
      methodLabel: "조후 우선",
      helpfulPrimary: "수",
      helpfulSecondary: "금",
      harmfulPrimary: "화",
      harmfulSecondary: "목",
      note: "조열한 계절감이 강해 열기를 식히는 수, 그 수를 돕는 금을 우선 참고했습니다.",
    };
  }

  return {
    applied: false,
    methodLabel: "억부 기준",
    note: "",
  };
}

function chooseElementCandidate(candidates, elementProfile, { mode = "helpful", preferred = [] } = {}) {
  const uniqueCandidates = uniqueList(candidates);
  if (!uniqueCandidates.length) return "";

  const presentCandidates = uniqueCandidates.filter((element) => (elementProfile.totals[element] || 0) > 0.35);
  const pool = presentCandidates.length ? presentCandidates : uniqueCandidates;

  return pool
    .map((element) => {
      const current = elementProfile.totals[element] || 0;
      const proximity = elementProfile.proximity[element] || 0;
      const deficit = Math.max(0, elementProfile.averageValue - current);
      const excess = Math.max(0, current - elementProfile.averageValue);
      const preferredBonus = preferred.includes(element) ? 1.1 : 0;
      const presenceBonus = current > 0.35 ? 0.6 : 0;
      const score = mode === "helpful"
        ? deficit * 1.2 + proximity * 0.8 + presenceBonus + preferredBonus
        : excess * 1.35 + proximity * 0.7 + current * 0.25 + preferredBonus;

      return { element, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.element || pool[0];
}

function buildUseGodData({ pillars, strength, elementProfile }) {
  const dayElement = getHeavenlyStemElement(pillars.day.stem.char);
  const resourceElement = getResourceElement(dayElement);
  const peerElement = dayElement;
  const outputElement = getOutputElement(dayElement);
  const wealthElement = getWealthElement(dayElement);
  const officialElement = getOfficialElement(dayElement);
  const climate = detectClimateAdjustment(elementProfile, pillars.month.branch.char);

  let helpfulPool = [];
  let harmfulPool = [];
  let yongShin = "";
  let heeShin = "";
  let giShin = "";
  let guShin = "";
  let methodLabel = climate.methodLabel;
  let methodNote = climate.note;

  if (climate.applied) {
    helpfulPool = [climate.helpfulPrimary, climate.helpfulSecondary];
    harmfulPool = [climate.harmfulPrimary, climate.harmfulSecondary];
    yongShin = climate.helpfulPrimary;
    heeShin = climate.helpfulSecondary;
    giShin = climate.harmfulPrimary;
    guShin = climate.harmfulSecondary;
  } else {
    const strongSide = strength.label === "신강" || (strength.label === "중화" && strength.bias === "supportHeavy");

    helpfulPool = strongSide
      ? [outputElement, wealthElement, officialElement]
      : [resourceElement, peerElement];
    harmfulPool = strongSide
      ? [peerElement, resourceElement]
      : [outputElement, wealthElement, officialElement];

    yongShin = chooseElementCandidate(helpfulPool, elementProfile, { mode: "helpful" });
    heeShin = chooseElementCandidate(
      helpfulPool.filter((element) => element !== yongShin),
      elementProfile,
      { mode: "helpful", preferred: [getGeneratedByElement(yongShin)] },
    ) || getGeneratedByElement(yongShin);
    giShin = chooseElementCandidate(harmfulPool, elementProfile, { mode: "harmful" });
    guShin = chooseElementCandidate(
      harmfulPool.filter((element) => element !== giShin),
      elementProfile,
      { mode: "harmful", preferred: [getGeneratedByElement(giShin)] },
    ) || getGeneratedByElement(giShin);

    methodNote = strongSide
      ? "일간 쪽 힘이 상대적으로 앞서 설기·재성·관성 쪽에서 균형을 잡는 방향을 우선 참고했습니다."
      : "일간 쪽 힘이 상대적으로 약해 비겁·인성 쪽에서 바탕을 받쳐 주는 방향을 우선 참고했습니다.";
  }

  const helpfulElements = uniqueList([yongShin, heeShin, ...helpfulPool]);
  const harmfulElements = uniqueList([giShin, guShin, ...harmfulPool]);
  const text = `${methodLabel}으로 보면 용신은 ${ELEMENT_LABEL[yongShin]}, 희신은 ${ELEMENT_LABEL[heeShin]}, 기신은 ${ELEMENT_LABEL[giShin]}, 구신은 ${ELEMENT_LABEL[guShin]} 쪽으로 읽힙니다. ${methodNote}`;

  return {
    methodLabel,
    text,
    yongShin,
    heeShin,
    giShin,
    guShin,
    helpfulElements,
    harmfulElements,
    tags: [
      createToneTag(`용신 ${ELEMENT_LABEL[yongShin]}`, "good"),
      createToneTag(`희신 ${ELEMENT_LABEL[heeShin]}`, "good"),
      createToneTag(`기신 ${ELEMENT_LABEL[giShin]}`, "warn"),
      createToneTag(`구신 ${ELEMENT_LABEL[guShin]}`, "warn"),
    ],
  };
}

function buildGyeokData(pillars) {
  const dayStem = pillars.day.stem.char;
  const monthBranch = pillars.month.branch.char;
  const monthHiddenStems = BRANCH_HIDDEN_STEMS[monthBranch] || [];
  const visibleStems = ["year", "month", "hour"]
    .map((pillarKey) => {
      const pillar = pillars[pillarKey];
      if (!pillar?.stem?.char || pillar.stem.empty) return null;
      return {
        pillarKey,
        stem: pillar.stem.char,
      };
    })
    .filter(Boolean);

  const matches = monthHiddenStems
    .map((stem, index) => {
      const visible = visibleStems.find((item) => item.stem === stem);
      return visible
        ? {
            stem,
            index,
            pillarKey: visible.pillarKey,
            tenGod: getTenGod(dayStem, stem),
          }
        : null;
    })
    .filter(Boolean);

  const primaryStem = monthHiddenStems[0] || "";
  const primaryTenGod = getTenGod(dayStem, primaryStem);
  const mainMatch = matches.sort((a, b) => a.index - b.index)[0];
  const title = mainMatch ? getPatternName(mainMatch.tenGod) : `${getPatternName(primaryTenGod)} 성향`;
  const matchText = mainMatch
    ? `월지 ${monthBranch}의 지장간 ${mainMatch.stem}(${mainMatch.tenGod})가 ${PILLAR_LABEL[mainMatch.pillarKey]} 천간에 투간되어 ${title} 기준이 비교적 또렷한 편입니다.`
    : `월지 ${monthBranch}의 정기 ${primaryStem}(${primaryTenGod})를 먼저 쓰는 방식으로 ${title}을 잡았습니다.`;
  const secondaryMatches = matches.slice(1).map((item) => `${item.stem}(${item.tenGod})`);
  const note = secondaryMatches.length
    ? `같은 월지 안에서 ${secondaryMatches.join(", ")}도 함께 투간되어 겸격 성향을 참고할 수 있습니다.`
    : "격국은 월지와 지장간 투간 여부를 먼저 보는 기준으로 정리했습니다.";

  return {
    title,
    text: matchText,
    note,
    tags: [
      createToneTag(`월지 ${monthBranch}`),
      createToneTag(mainMatch ? `${mainMatch.stem} 투간` : `${primaryStem} 정기`),
      createToneTag(title),
    ],
  };
}

function getBranchInteractionTypes(branchA, branchB) {
  const types = [];
  if (!branchA || !branchB) return types;

  if (BRANCH_HARMONY[branchA] === branchB) types.push("합");
  if (BRANCH_CLASH[branchA] === branchB) types.push("충");
  if (BRANCH_PUNISHMENT[branchA] === branchB) types.push("형");
  if (BRANCH_BREAK[branchA] === branchB) types.push("파");
  if (BRANCH_HARM[branchA] === branchB) types.push("해");
  if (branchA === branchB && SELF_PUNISH_BRANCHES.has(branchA)) types.push("자형");

  return uniqueList(types);
}

function buildInteractionMessage(type, pillarKey, area) {
  switch (type) {
    case "합":
      return {
        tone: "good",
        boost: `${area} 협조`,
        note: `${PILLAR_LABEL[pillarKey]}와 합이 걸려 ${area} 쪽은 연결, 중재, 협조가 붙기 쉬운 편입니다.`,
      };
    case "충":
      return {
        tone: "warn",
        caution: `${area} 변동`,
        note: `${PILLAR_LABEL[pillarKey]}와 충이 걸려 ${area} 쪽은 이동, 일정 변화, 부딪힘이 실제 체감으로 커지기 쉽습니다.`,
      };
    case "형":
      return {
        tone: "warn",
        caution: `${area} 긴장`,
        note: `${PILLAR_LABEL[pillarKey]}와 형이 걸려 ${area} 쪽은 누적 스트레스와 갈등 관리가 중요해집니다.`,
      };
    case "파":
      return {
        tone: "warn",
        caution: `${area} 균열`,
        note: `${PILLAR_LABEL[pillarKey]}와 파가 걸려 ${area} 쪽은 약속, 관계, 계획의 틈이 벌어지기 쉽습니다.`,
      };
    case "해":
      return {
        tone: "warn",
        caution: `${area} 숨은 마찰`,
        note: `${PILLAR_LABEL[pillarKey]}와 해가 걸려 ${area} 쪽은 겉보다 속으로 쌓이는 오해와 소모를 조심할 만합니다.`,
      };
    case "자형":
      return {
        tone: "warn",
        caution: `${area} 반복 압박`,
        note: `${PILLAR_LABEL[pillarKey]}와 같은 지지가 겹쳐 ${area} 쪽 부담이 반복되거나 예민해질 수 있습니다.`,
      };
    default:
      return {
        tone: "neutral",
        note: "",
      };
  }
}

function buildStemInteractionSignals(luckStem, pillars) {
  const boosts = [];
  const notes = [];
  const tags = [];

  getKnownStemEntries(pillars).forEach(({ pillarKey, stem, area }) => {
    if (STEM_HARMONY[luckStem] !== stem) return;

    boosts.push(`${area} 연결`);
    notes.push(`${PILLAR_LABEL[pillarKey]} 천간과 합이 걸려 배경·환경 차원에서는 ${area} 쪽 연결고리가 붙을 수 있습니다.`);
    tags.push(createToneTag(`${PILLAR_LABEL[pillarKey]} 천간합`, "good"));
  });

  return {
    boosts: uniqueList(boosts),
    notes: uniqueList(notes),
    tags,
  };
}

function buildBranchInteractionSignals(luckBranch, pillars) {
  const boosts = [];
  const cautions = [];
  const notes = [];
  const tags = [];

  for (const pillarKey of ["year", "month", "day", "hour"]) {
    const pillar = pillars[pillarKey];
    if (!pillar?.branch?.char || pillar.branch.empty) continue;

    const natalBranch = pillar.branch.char;
    const area = PILLAR_AREA[pillarKey];
    const types = getBranchInteractionTypes(luckBranch, natalBranch);

    types.forEach((type) => {
      const message = buildInteractionMessage(type, pillarKey, area);
      if (message.boost) boosts.push(message.boost);
      if (message.caution) cautions.push(message.caution);
      if (message.note) notes.push(message.note);
      tags.push(createToneTag(`${PILLAR_LABEL[pillarKey]} ${type}`, message.tone));
    });
  }

  const natalBranches = getKnownBranchEntries(pillars).map((item) => item.branch);
  BRANCH_TRIADS.forEach((group) => {
    if (!group.branches.includes(luckBranch)) return;
    const matched = group.branches.filter((branch) => natalBranches.includes(branch));
    if (matched.length < 2) return;

    boosts.push(`${ELEMENT_LABEL[group.element]} 삼합`);
    notes.push(`${matched.join("·")}와 ${luckBranch}가 ${ELEMENT_LABEL[group.element]} 삼합을 이루어 관련 기운이 한 번에 묶이는 해로 볼 수 있습니다.`);
    tags.push(createToneTag(`${ELEMENT_LABEL[group.element]} 삼합`, "good"));
  });

  if (natalBranches.includes(luckBranch) && !SELF_PUNISH_BRANCHES.has(luckBranch)) {
    notes.push(`같은 지지가 겹쳐 해당 궁의 이슈가 유난히 크게 부각될 수 있습니다.`);
  }

  return {
    boosts: uniqueList(boosts),
    cautions: uniqueList(cautions),
    notes: uniqueList(notes),
    tags,
  };
}

function buildNatalInteractionData(pillars) {
  const branchEntries = getKnownBranchEntries(pillars);
  const pairNotes = [];
  const tags = [];
  let goodCount = 0;
  let warnCount = 0;

  for (let i = 0; i < branchEntries.length; i += 1) {
    for (let j = i + 1; j < branchEntries.length; j += 1) {
      const left = branchEntries[i];
      const right = branchEntries[j];
      const types = getBranchInteractionTypes(left.branch, right.branch);

      types.forEach((type) => {
        const tone = type === "합" ? "good" : "warn";
        if (tone === "good") goodCount += 1;
        if (tone === "warn") warnCount += 1;

        tags.push(createToneTag(`${left.label}-${right.label} ${type}`, tone));

        if (type === "합") {
          pairNotes.push(`${left.label}와 ${right.label}가 합을 이루어 두 축 사이를 묶어 주는 힘이 있습니다.`);
        } else if (type === "충") {
          pairNotes.push(`${left.label}와 ${right.label}가 충해 환경 변화와 관계 조정이 잦을 수 있습니다.`);
        } else if (type === "형" || type === "자형") {
          pairNotes.push(`${left.label}와 ${right.label}는 형 작용이 있어 긴장과 반복 스트레스가 쌓이기 쉬운 편입니다.`);
        } else if (type === "파") {
          pairNotes.push(`${left.label}와 ${right.label}에는 파가 있어 약속이나 관계의 균열을 조심할 만합니다.`);
        } else if (type === "해") {
          pairNotes.push(`${left.label}와 ${right.label}에는 해가 있어 겉보다 속마찰이 누적되기 쉽습니다.`);
        }
      });
    }
  }

  BRANCH_TRIADS.forEach((group) => {
    const matchedLabels = branchEntries
      .filter((item) => group.branches.includes(item.branch))
      .map((item) => item.label);

    if (matchedLabels.length >= 3) {
      goodCount += 1;
      tags.push(createToneTag(`${ELEMENT_LABEL[group.element]} 삼합`, "good"));
      pairNotes.push(`${matchedLabels.join(", ")}가 ${ELEMENT_LABEL[group.element]} 삼합을 이루어 해당 오행의 결속력이 비교적 강합니다.`);
    }
  });

  const headline = !tags.length
    ? "단순한 구조"
    : `협조 ${goodCount} · 긴장 ${warnCount}`;
  const text = pairNotes.length
    ? `원국 안에서는 ${pairNotes.slice(0, 3).join(" ")}`
    : "원국 내부에서 강한 합형충파해가 겹치는 구조는 비교적 단순한 편입니다.";

  return {
    headline,
    text,
    note: "합은 연결, 충은 변동, 형·파·해는 누적 갈등과 계획의 틈을 읽는 신호로 함께 봤습니다.",
    tags: tags.slice(0, 6),
  };
}

function buildDiagnosisData({ pillars, unknownTime }) {
  const elementProfile = buildElementProfile(pillars);
  const strength = buildStrengthData(pillars);
  const useGods = buildUseGodData({ pillars, strength, elementProfile });
  const gyeok = buildGyeokData(pillars);
  const interactions = buildNatalInteractionData(pillars);

  return {
    summary: "원국 진단은 일간의 강약, 월지 격국 성향, 용신·희신, 합형충파해를 한 번에 묶어 읽을 때 해석의 방향이 더 선명해집니다.",
    note: `용신과 격국은 월지·투간·억부를 중심으로 정리했고, 계절 편중이 크면 조후도 보조 기준으로 참고했습니다.${unknownTime ? " 시간을 모르면 시주가 빠져 강약·격국·합형충파해 판단이 실제보다 단순하게 보일 수 있습니다." : ""}`,
    strength,
    useGods,
    gyeok,
    interactions,
    cards: [
      {
        title: "신강/신약",
        headline: `${strength.label} · ${strength.supportScore}점`,
        tags: strength.tags,
        text: strength.text,
        note: strength.note,
      },
      {
        title: "용신/희신",
        headline: `용신 ${ELEMENT_LABEL[useGods.yongShin]} · 희신 ${ELEMENT_LABEL[useGods.heeShin]}`,
        tags: useGods.tags,
        text: useGods.text,
      },
      {
        title: "격국",
        headline: gyeok.title,
        tags: gyeok.tags,
        text: gyeok.text,
        note: gyeok.note,
      },
      {
        title: "합형충파해",
        headline: interactions.headline,
        tags: interactions.tags,
        text: interactions.text,
        note: interactions.note,
      },
    ],
  };
}

function buildUseGodSignals(item, diagnosis) {
  const signals = [];
  const boosts = [];
  const cautions = [];
  const useGods = diagnosis?.useGods;
  if (!useGods) {
    return {
      boosts,
      cautions,
      alignmentText: "",
    };
  }

  const stemElement = getHeavenlyStemElement(item.pillarString[0]);
  const branchElement = getBranchPrimaryElement(item.pillarString[1]);

  [
    { element: stemElement, source: "천간" },
    { element: branchElement, source: "지지" },
  ].forEach(({ element }) => {
    if (!element) return;

    if (element === useGods.yongShin) {
      boosts.push(`잘 맞는 기운(${ELEMENT_LABEL[element]})`);
      signals.push("good");
      return;
    }

    if (element === useGods.heeShin) {
      boosts.push(`도움이 되는 기운(${ELEMENT_LABEL[element]})`);
      signals.push("good");
      return;
    }

    if (element === useGods.giShin) {
      cautions.push(`부담이 되는 기운(${ELEMENT_LABEL[element]})`);
      signals.push("warn");
      return;
    }

    if (element === useGods.guShin) {
      cautions.push(`주의할 기운(${ELEMENT_LABEL[element]})`);
      signals.push("warn");
    }
  });

  let alignmentText = "";
  if (signals.includes("good") && signals.includes("warn")) {
    alignmentText = "좋은 흐름과 주의 흐름이 함께 옴";
  } else if (signals.includes("good")) {
    alignmentText = "잘 맞는 흐름이 강함";
  } else if (signals.includes("warn")) {
    alignmentText = "주의 흐름이 강함";
  }

  return {
    boosts: uniqueList(boosts),
    cautions: uniqueList(cautions),
    alignmentText,
  };
}

function enrichLuckItem(item, pillars, diagnosis) {
  const stemImpact = GOD_IMPACT[item.stemGod] || null;
  const branchImpact = GOD_IMPACT[item.branchGod] || null;
  const branchRelations = buildBranchInteractionSignals(item.pillarString[1], pillars);
  const stemRelations = buildStemInteractionSignals(item.pillarString[0], pillars);
  const useGodSignals = buildUseGodSignals(item, diagnosis);

  const boosts = uniqueList([
    ...(stemImpact?.boosts.slice(0, 1) || []),
    ...(branchImpact?.boosts.slice(0, 1) || []),
    ...branchRelations.boosts,
    ...stemRelations.boosts,
    ...useGodSignals.boosts,
  ]).slice(0, 5);

  const cautions = uniqueList([
    ...(stemImpact?.cautions.slice(0, 1) || []),
    ...(branchImpact?.cautions.slice(0, 1) || []),
    ...branchRelations.cautions,
    ...useGodSignals.cautions,
  ]).slice(0, 5);

  return {
    ...item,
    background: stemImpact?.background || "겉으로 보이는 환경 변화와 분위기를 읽는 참고 포인트입니다.",
    result: branchImpact?.result || "실제로 체감하기 쉬운 변화와 결과를 읽는 참고 포인트입니다.",
    boosts,
    cautions,
    interactionTags: [...stemRelations.tags, ...branchRelations.tags].slice(0, 5),
    interactionNote: uniqueList([...stemRelations.notes, ...branchRelations.notes]).slice(0, 2).join(" "),
    alignmentText: useGodSignals.alignmentText,
  };
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

export function getCurrentFortuneYear(currentDate) {
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

function buildMajorLuckData({ birthInfo, pillars, gender, unknownTime, diagnosis, currentDate = new Date() }) {
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

  const rawItems = Array.from({ length: 8 }, (_, index) => {
    const pillar = getPillarByCycleIndex(monthCycleIndex + direction * (index + 1));
    const primaryHiddenStem = BRANCH_HIDDEN_STEMS[pillar.earthlyBranch]?.[0] || "";
    const stemGod = getTenGod(dayStem, pillar.heavenlyStem);
    const branchGod = primaryHiddenStem ? getTenGod(dayStem, primaryHiddenStem) : "";
    const ageStart = formatOneDecimal(startAge + index * 10);
    const ageEnd = formatOneDecimal(ageStart + 9.9);
    const startYear = normalizedBirth.year + Math.floor(ageStart);
    const wealthHitCount = [stemGod, branchGod].filter(isWealthGod).length;

    return {
      index: index + 1,
      pillarString: `${pillar.heavenlyStem}${pillar.earthlyBranch}`,
      stemGod,
      branchGod,
      ageStart,
      ageEnd,
      startYear,
      focus: buildLuckFocus(stemGod, branchGod),
      note: buildLuckNote(stemGod, branchGod),
      wealthHitCount,
    };
  });

  const rangedItems = rawItems.map((item, index) => {
    const nextStartYear = rawItems[index + 1]?.startYear ?? (item.startYear + 10);

    return {
      ...item,
      endYear: nextStartYear - 1,
      isCurrent: currentYear >= item.startYear && currentYear < nextStartYear,
    };
  });

  const items = rangedItems.map((item) => enrichLuckItem(item, pillars, diagnosis));

  const currentMajorLuck = items.find((item) => item.isCurrent) || items[0];
  const directionText = direction === 1 ? "순행" : "역행";
  const guideText = "대운은 10년 단위의 큰 흐름으로 보고, 지금 삶의 분위기가 어디에 실리는지 쉽게 풀어 썼습니다.";
  const relationText = "도움이 되는 연결과 변동, 마찰 가능성도 함께 정리했습니다.";
  const useGodText = diagnosis ? "지금 시기에 잘 맞는 기운과 부담이 되는 기운도 함께 반영했습니다." : "";
  const note = [guideText, relationText, useGodText, unknownTime ? "태어난 시간을 모르면 대운 시작 시점은 실제와 몇 개월 정도 차이 날 수 있습니다." : ""]
    .filter(Boolean)
    .join(" ");

  return {
    direction: directionText,
    startAge,
    note,
    summary: `대운은 ${directionText}으로 흐르며, 출생 후 약 ${startAge}세부터 첫 흐름이 시작되는 구조로 계산했습니다. 각 10년마다 어떤 분위기가 강해지고 무엇을 챙기면 좋은지 읽기 쉽게 정리했습니다.`,
    current: currentMajorLuck,
    items,
  };
}

function buildYearLuckData({ dayStem, pillars, diagnosis, currentDate = new Date(), count = 10 }) {
  const currentFortuneYear = getCurrentFortuneYear(currentDate);

  const rawItems = Array.from({ length: count }, (_, index) => {
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

  const items = rawItems.map((item) => enrichLuckItem(item, pillars, diagnosis));

  return {
    summary: `세운은 현재 기준 ${currentFortuneYear}년부터 앞으로 ${count}년 흐름을 함께 보여줍니다. 해마다 힘이 실리는 점과 조심할 점을 바로 읽을 수 있게 정리했습니다.`,
    note: `세운은 그해 분위기와 체감 변화를 가볍게 읽는 참고 자료입니다. 큰 흐름 위에 어떤 해가 겹치는지 중심으로 풀었습니다.${diagnosis ? " 잘 맞는 흐름과 주의 흐름도 함께 반영했습니다." : ""}`,
    items,
  };
}

function buildMoneyStyleText(properCount, irregularCount, counts) {
  if (properCount > irregularCount) {
    return "안정적인 수입, 계약, 예산 관리처럼 꾸준히 쌓아 가는 방식이 특히 잘 맞는 편입니다.";
  }

  if (irregularCount > properCount) {
    return "영업, 사업, 외부 기회, 네트워크, 부수입처럼 움직이며 잡는 수입 흐름에 감각이 살아날 수 있습니다.";
  }

  if (properCount + irregularCount > 0) {
    return "안정적으로 챙기는 돈과 기회형 수입을 함께 가져갈 때 장점이 잘 살아날 수 있습니다.";
  }

  if (counts.식신 + counts.상관 >= 2) {
    return "돈 기회가 겉으로 아주 많지는 않아도, 실력과 결과물을 수익으로 연결하는 방식이 더 잘 맞을 수 있습니다.";
  }

  return "돈은 한 번에 크게 벌기보다 생활 구조와 경력의 안정 속에서 서서히 쌓는 방식이 더 잘 맞을 수 있습니다.";
}

function buildCurrentMoneyFlowText(majorLuck, yearLuck) {
  const currentMajor = majorLuck.current;
  const currentYear = yearLuck.items[0];
  const totalWealthHits = currentMajor.wealthHitCount + currentYear.wealthHitCount;
  const currentMajorLabel = `현재 대운 ${currentMajor.pillarString}`;
  const currentYearLabel = `올해 ${currentYear.year}년 ${currentYear.pillarString}`;

  if (totalWealthHits >= 3) {
    return `지금은 ${currentMajorLabel}과 ${currentYearLabel} 흐름이 함께 실속, 수익화, 계약 관리에 힘을 보태는 시기입니다.`;
  }

  if (totalWealthHits >= 1) {
    return `지금은 ${currentMajorLabel}과 ${currentYearLabel} 흐름을 타고 돈 문제를 정리하고 실속을 챙기기 좋은 시기입니다.`;
  }

  if (isOutputGod(currentMajor.stemGod) || isOutputGod(currentMajor.branchGod) || isOutputGod(currentYear.stemGod) || isOutputGod(currentYear.branchGod)) {
    return `지금은 바로 돈만 보기보다 ${currentMajorLabel}과 ${currentYearLabel} 흐름을 타고 실력과 결과물을 먼저 키우는 편이 유리합니다.`;
  }

  if (isOfficialGod(currentMajor.stemGod) || isOfficialGod(currentMajor.branchGod) || isOfficialGod(currentYear.stemGod) || isOfficialGod(currentYear.branchGod)) {
    return "지금은 직장, 책임, 역할 변화가 돈 흐름을 좌우하기 쉬운 시기라 커리어 안정이 곧 재물 관리의 핵심이 됩니다.";
  }

  return "지금은 돈이 갑자기 커지기보다 생활 구조와 지출 관리, 역할 정리를 통해 실속을 만드는 쪽에 가깝습니다.";
}

function buildUpcomingMoneyText(yearLuck) {
  const richYears = yearLuck.items.filter((item) => item.wealthHitCount > 0).slice(0, 3);

  if (!richYears.length) {
    return "앞으로 바로 돈 흐름이 강하게 들어오는 해가 많지는 않아, 성급한 투자보다 준비된 기회를 기다리는 편이 유리합니다.";
  }

  return `가까운 시기에는 ${richYears.map((item) => `${item.year}년`).join(", ")} 무렵에 돈과 계약 흐름이 비교적 또렷해 보여, 해당 해에는 수익화와 저축 계획을 더 적극적으로 점검해 볼 만합니다.`;
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
    ? "돈 기회가 비교적 많이 드러나는 편"
    : totalWealthCount >= 3
      ? "돈 흐름이 중간 이상으로 보이는 편"
      : totalWealthCount >= 1
        ? "돈 기회가 숨어 있는 형태로 보이는 편"
        : "돈 흐름이 강하게 드러나는 타입은 아닌 편";

  const cards = [
    {
      title: "돈 흐름 구조",
      text: `이 사주는 ${strengthText}입니다. 눈에 띄는 돈 기회는 ${visibleWealthCount}곳, 숨은 가능성까지 합치면 ${totalWealthCount}곳 정도로 읽힙니다. 안정형 흐름은 ${properCount}, 기회형 흐름은 ${irregularCount}로 잡힙니다.`,
    },
    {
      title: "돈 버는 방식",
      text: `${buildMoneyStyleText(properCount, irregularCount, countMap)} ${countMap.비견 + countMap.겁재 >= 3 ? "사람 문제, 경쟁, 충동 지출로 새는 돈은 의식적으로 관리하는 편이 좋습니다." : ""} ${countMap.정인 + countMap.편인 >= 3 ? "공부, 자격, 문서, 전문성 축적이 결국 돈의 안정으로 이어지기 쉬운 편입니다." : ""}`.trim(),
    },
    {
      title: "현재 재물 흐름",
      text: `${buildCurrentMoneyFlowText(majorLuck, yearLuck)} ${buildUpcomingMoneyText(yearLuck)} ${unknownTime ? "시주가 없으면 후반부 재물 강도는 실제와 조금 다를 수 있습니다." : ""}`.trim(),
    },
  ];

  return {
    summary: "재물운은 돈이 많고 적다기보다, 어떤 방식으로 벌기 쉬운지와 지금 시기가 어디에 힘을 싣는지를 함께 보는 편이 더 실용적입니다.",
    cards,
  };
}

export function buildAdvancedSajuData({ birthInfo, pillars, gender, unknownTime, currentDate = new Date() }) {
  const tenGods = buildTenGodData(pillars, { unknownTime });
  const diagnosis = buildDiagnosisData({ pillars, unknownTime });
  const majorLuck = buildMajorLuckData({ birthInfo, pillars, gender, unknownTime, diagnosis, currentDate });
  const yearLuck = buildYearLuckData({ dayStem: pillars.day.stem.char, pillars, diagnosis, currentDate });
  const wealth = buildWealthData({ pillars, tenGods, majorLuck, yearLuck, unknownTime });

  return {
    tenGods,
    diagnosis,
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
