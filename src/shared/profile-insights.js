import { getDayPillarArchetype } from "../../data/daypillars.js";
import { getCurrentFortuneYear } from "../engine/saju-advanced.js";
import { calculateFourPillars } from "../engine/soulscan-engine.js";

export const PROFILE_REFRESH_POLICY = Object.freeze({
  personality: "daily",
  health: "monthly",
  love: "monthly",
  ability: "monthly",
  majorLuck: "yearly",
});

const GENERATES = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
};

const CONTROLS = {
  목: "토",
  화: "금",
  토: "수",
  금: "목",
  수: "화",
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

const STEM_TO_ELEMENT = {
  갑: "목",
  을: "목",
  병: "화",
  정: "화",
  무: "토",
  기: "토",
  경: "금",
  신: "금",
  임: "수",
  계: "수",
};

const DAILY_ROLE_COPY = {
  peer: {
    point: "감정 기준이 유독 또렷해져서, 좋고 싫음이 빠르게 드러나기 쉬운 날입니다.",
    goodEmotion: "내 마음을 솔직하게 표현하려는 힘이 살아납니다.",
    improve: "옳고 그름을 빨리 단정하면 말이 세게 나갈 수 있어요.",
    goodSignals: ["감정 솔직함", "자기 기준 선명화", "주도권 회복"],
    warnSignals: ["고집스런 반응", "정면 충돌", "예민한 말투"],
  },
  resource: {
    point: "감정이 안쪽으로 가라앉으며, 쉬고 싶고 정리하고 싶은 마음이 커지는 날입니다.",
    goodEmotion: "차분함과 배려가 자연스럽게 올라오기 쉽습니다.",
    improve: "혼자 생각을 오래 끌면 감정 표현이 늦어질 수 있어요.",
    goodSignals: ["정서 회복", "안정감", "배려심"],
    warnSignals: ["생각 과다", "행동 지연", "마음 닫기"],
  },
  output: {
    point: "감정을 말과 표정으로 바깥에 드러내고 싶어지는 흐름이 강한 날입니다.",
    goodEmotion: "표현력과 센스가 살아나서 호감 있게 보이기 쉽습니다.",
    improve: "리액션이 앞서면 말실수나 과한 표현으로 이어질 수 있어요.",
    goodSignals: ["표현력", "대화 매력", "분위기 환기"],
    warnSignals: ["말실수", "감정 과열", "오버페이스"],
  },
  wealth: {
    point: "감정을 현실 기준으로 가늠하게 되면서, 관계의 실속과 안정감을 따져보는 날입니다.",
    goodEmotion: "현실 감각과 센스가 살아나 관계의 균형을 잘 맞추기 쉽습니다.",
    improve: "손해 보기 싫은 마음이 앞서면 계산적으로 보일 수 있어요.",
    goodSignals: ["현실 감각", "관계 안정감", "실속 있는 판단"],
    warnSignals: ["마음 계산", "조급함", "거리감 형성"],
  },
  authority: {
    point: "감정에도 책임감이 실려서, 예민하지만 기준은 분명해지기 쉬운 날입니다.",
    goodEmotion: "관계에서 중심을 잡고 약속을 지키려는 태도가 강해집니다.",
    improve: "평가받는 느낌이 강해지면 압박감과 방어심이 커질 수 있어요.",
    goodSignals: ["책임감", "관계 기준 정리", "신뢰감"],
    warnSignals: ["압박감", "권위 충돌", "긴장 누적"],
  },
};

const YEARLY_HEALTH_COPY = {
  "수익화·성과": "올해는 바쁜 흐름 속에서도 체력 배분만 잘하면 생활 리듬을 결과로 연결하기 좋습니다.",
  "재물·실속": "올해는 생활 습관, 식사, 수면, 검진처럼 기본 건강 루틴을 현실적으로 정비하는 점이 강점이 됩니다.",
  "직장·책임": "올해는 일정 관리와 체력 관리가 바로 연결되기 쉬워, 규칙적인 루틴을 만드는 점이 건강상의 강점입니다.",
  "표현·확장": "올해는 활동량이 늘어나는 만큼 몸을 잘 쓰면 활력이 오르는 해로 읽힙니다.",
  "학습·정비": "올해는 몸 신호를 빨리 읽고 회복 루틴을 정리하는 점이 특히 도움이 됩니다.",
  "경쟁·협업": "올해는 주변 페이스에 휩쓸리지 않고 내 리듬을 지키는 힘이 건강상 장점으로 작동합니다.",
  "기본 흐름": "올해는 무리한 변화보다 기본 체력과 생활 리듬을 지키는 점이 가장 큰 장점입니다.",
};

const LOVE_STYLE_COPY = {
  output: {
    attraction: "반응이 분명하고 대화가 재미있는 사람에게 매력을 느끼기 쉽습니다.",
    dislike: "답답하게 감정을 숨기거나 반응이 지나치게 무딘 태도는 금방 식을 수 있습니다.",
    strategy: "센스 있는 리액션과 솔직한 표현으로 호흡을 맞추면 마음이 빨리 열릴 가능성이 큽니다.",
  },
  resource: {
    attraction: "차분하고 배려 깊으며, 같이 있을 때 마음이 편안해지는 사람에게 끌리기 쉽습니다.",
    dislike: "감정을 몰아붙이거나 관계 속도를 급하게 재촉하는 방식은 부담으로 느끼기 쉽습니다.",
    strategy: "안심감, 꾸준함, 세심한 배려를 보여주면 신뢰가 빠르게 쌓입니다.",
  },
  peer: {
    attraction: "친구처럼 편하게 대화가 통하고, 같이 움직일 때 자연스러운 사람에게 끌릴 수 있습니다.",
    dislike: "기싸움하거나 주도권을 과하게 잡으려는 태도는 금방 피로하게 느껴질 수 있습니다.",
    strategy: "친한 친구 같은 템포로 가까워지되, 경쟁심보다는 공감대를 먼저 만드는 편이 좋습니다.",
  },
  authority: {
    attraction: "기준이 분명하고 책임감 있게 관계를 다루는 사람에게 안정감을 느끼기 쉽습니다.",
    dislike: "애매한 태도, 말과 행동이 다른 모습, 약속을 가볍게 여기는 점에는 실망하기 쉽습니다.",
    strategy: "예의와 일관성을 갖추고, 관계를 가볍지 않게 대한다는 신호를 주면 호감이 커질 수 있습니다.",
  },
  wealth: {
    attraction: "센스 있고 현실 감각이 있으며, 관계를 실제 행동으로 보여주는 사람에게 끌리기 쉽습니다.",
    dislike: "감정은 크지만 생활감각이 없거나 약속이 헐거운 모습은 빠르게 거리감을 만들 수 있습니다.",
    strategy: "말보다 행동, 배려보다 실행력으로 안정감을 보여주면 마음을 얻기 쉽습니다.",
  },
};

const MONTHLY_VARIANT_COPY = {
  health: {
    peer: {
      point: "이번 달은 몸 상태를 내 기준으로 예민하게 느끼기 쉬워서, 컨디션의 좋고 나쁨을 빨리 알아차리기 쉽습니다.",
      goodPoint: "수면, 식사, 운동 시간을 내 리듬에 맞게 다시 고정하면 회복력이 붙기 쉬운 달입니다.",
      goodSignals: ["생활 리듬 정렬", "몸 신호 빠른 캐치", "기초 체력 점검"],
      warnSignals: ["예민한 피로감", "무리한 강행", "회복 신호 무시"],
    },
    resource: {
      point: "이번 달은 몸을 채우고 쉬는 흐름이 중요해지는 달이라, 회복 루틴이 곧 컨디션 차이로 이어지기 쉽습니다.",
      goodPoint: "휴식, 수면, 영양 보충을 꾸준히 챙기면 컨디션 반등 폭이 좋은 달입니다.",
      goodSignals: ["회복 탄력", "정서 안정", "차분한 컨디션 관리"],
      warnSignals: ["움직임 부족", "생각만 많은 피로", "잠·휴식 미루기"],
    },
    output: {
      point: "이번 달은 활동량이 늘거나 바깥 일정이 많아질 수 있어, 몸을 쓰는 만큼 회복도 같이 설계하는 게 중요합니다.",
      goodPoint: "움직임과 스트레스 배출을 잘 연결하면 활력이 살아나기 쉬운 달입니다.",
      goodSignals: ["활동성 회복", "기분 환기", "순환감 개선"],
      warnSignals: ["오버페이스", "과열성 피로", "생활 리듬 붕괴"],
    },
    wealth: {
      point: "이번 달은 건강도 현실 관리 항목처럼 다뤄야 할 달이라, 생활 습관을 숫자와 계획으로 잡는 편이 유리합니다.",
      goodPoint: "검진, 식사, 수면, 운동 루틴을 현실적으로 재정비하기 좋은 달입니다.",
      goodSignals: ["실속 있는 관리", "검진·기록 정리", "생활 습관 보정"],
      warnSignals: ["귀찮아서 미루기", "자잘한 불편 방치", "생활비 스트레스"],
    },
    authority: {
      point: "이번 달은 일정과 책임이 몸에 바로 반영되기 쉬워서, 규칙적인 루틴을 만드는 힘이 중요합니다.",
      goodPoint: "몸 관리에 기준을 세우고 지키면 안정감이 빠르게 올라오는 달입니다.",
      goodSignals: ["루틴 고정", "체력 관리 책임감", "무너지지 않는 페이스"],
      warnSignals: ["압박성 피로", "쉬지 못함", "긴장 누적"],
    },
  },
  love: {
    peer: {
      point: "이번 달은 관계에서 내 감정 기준과 템포가 분명해져서, 맞는 사람과 안 맞는 사람이 또렷하게 느껴질 수 있습니다.",
      goodSignals: ["감정 기준 선명화", "편한 템포 형성", "자연스러운 친밀감"],
      warnSignals: ["기싸움", "자존심 대치", "속도 차 민감"],
    },
    resource: {
      point: "이번 달은 감정을 안정적으로 주고받는 흐름이 중요해져서, 편안함과 배려가 관계 만족도를 크게 좌우하기 쉽습니다.",
      goodSignals: ["정서 안정감", "배려받는 느낌", "천천한 신뢰 형성"],
      warnSignals: ["마음 닫기", "표현 지연", "혼자 해석하기"],
    },
    output: {
      point: "이번 달은 표현력과 매력이 살아서, 말을 걸고 반응을 주고받는 과정에서 관계 진전이 생기기 쉬운 달입니다.",
      goodSignals: ["호감 표현", "대화 매력", "설렘 환기"],
      warnSignals: ["말실수", "감정 과열", "오해되는 표현"],
    },
    wealth: {
      point: "이번 달은 관계의 현실감과 안정성을 따져보는 흐름이 강해져서, 진짜로 편한 사람인지 더 분명히 보일 수 있습니다.",
      goodSignals: ["현실적 안정감", "생활감 있는 배려", "지속 가능한 관계 판단"],
      warnSignals: ["계산적인 반응", "손익 따지기", "거리감 형성"],
    },
    authority: {
      point: "이번 달은 연애에서도 기준과 책임을 중요하게 보는 달이라, 애매한 관계보다는 분명한 태도에 끌리기 쉽습니다.",
      goodSignals: ["신뢰감", "일관된 태도", "관계 기준 정리"],
      warnSignals: ["압박감", "주도권 다툼", "지나친 평가"],
    },
  },
  ability: {
    peer: {
      point: "이번 달은 내 방식과 추진력이 또렷해져서, 혼자 밀어붙이는 일에 속도가 붙기 쉬운 달입니다.",
      goodSignals: ["단독 추진력", "자기 기준 선명화", "빠른 실행"],
      warnSignals: ["고집스런 추진", "협업 마찰", "독주"],
    },
    resource: {
      point: "이번 달은 정리와 학습, 내실 다지기가 힘을 주는 달이라, 실력을 묶어두면 다음 결과로 이어지기 쉽습니다.",
      goodSignals: ["전문성 축적", "전략 정비", "기초 체력 강화"],
      warnSignals: ["실행 지연", "준비 과다", "결정 미루기"],
    },
    output: {
      point: "이번 달은 기획과 표현이 기회로 연결되기 쉬워서, 보여 주는 방식과 메시지가 성과 차이를 만들기 쉽습니다.",
      goodSignals: ["기획·표현력", "아이디어 발화", "성과 노출"],
      warnSignals: ["메시지 리스크", "오버페이스", "산만한 확장"],
    },
    wealth: {
      point: "이번 달은 돈과 결과의 연결을 현실적으로 보는 달이라, 수익 구조와 우선순위를 다듬는 힘이 중요합니다.",
      goodSignals: ["실속 있는 성과", "현금흐름 감각", "계약·예산 정리"],
      warnSignals: ["비용 누수", "즉흥 집행", "성과 조급증"],
    },
    authority: {
      point: "이번 달은 책임과 역할이 또렷해져서, 맡은 일을 구조화하고 끝까지 밀어붙이는 힘이 성과로 이어지기 쉽습니다.",
      goodSignals: ["책임감", "조직 신뢰", "과제 완결력"],
      warnSignals: ["압박 스트레스", "권위 충돌", "경직된 방식"],
    },
  },
};

function getKstFormatter() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function getKstDateParts(now = new Date()) {
  const parts = Object.fromEntries(
    getKstFormatter()
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  return {
    year,
    month,
    day,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    dateLabel: `${month}월 ${day}일`,
    referenceDate: new Date(Date.UTC(year, month - 1, day, 3, 0, 0)),
    monthKey: `${parts.year}-${parts.month}`,
    monthLabel: `${month}월`,
    monthReferenceDate: new Date(Date.UTC(year, month - 1, 15, 3, 0, 0)),
  };
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasList(values) {
  return Array.isArray(values) && values.some((value) => hasText(value));
}

function hasArray(values) {
  return Array.isArray(values);
}

function hasSectionText(snapshot, index) {
  return hasText(snapshot?.sections?.[index]?.text);
}

function hasWealthCards(snapshot) {
  const cards = snapshot?.advanced?.wealth?.cards;
  return Array.isArray(cards) && cards.length > 0 && cards.every((card) => hasText(card?.title) && hasText(card?.text));
}

function hasLuckItems(items) {
  return Array.isArray(items) && items.length > 0 && items.every((item) => hasText(item?.pillarString));
}

function isCompletePersonalityDailyInsight(insight, dateKey) {
  return insight?.dateKey === dateKey
    && hasText(insight?.point)
    && hasText(insight?.goodEmotion)
    && hasText(insight?.improve)
    && hasList(insight?.goodSignals)
    && hasList(insight?.warnSignals);
}

function isCompleteMonthlyInsight(insight, monthKey, { requireGoodPoint = false } = {}) {
  return insight?.monthKey === monthKey
    && hasText(insight?.point)
    && (!requireGoodPoint || hasText(insight?.goodPoint))
    && hasList(insight?.goodSignals)
    && hasList(insight?.warnSignals);
}

function isCompleteLoveDetailInsight(insight) {
  return hasText(insight?.summary)
    && hasText(insight?.attraction)
    && hasText(insight?.dislike)
    && hasText(insight?.strategy);
}

function isCompleteHealthYearlyInsight(insight, fortuneYear) {
  return Number(insight?.fortuneYear || 0) === Number(fortuneYear || 0)
    && hasText(insight?.goodPoint)
    && hasArray(insight?.supports);
}

function getRequiredFullRefreshReasons(publicSnapshot, currentKeys) {
  const reasons = [];

  if (!publicSnapshot?.dayPillar?.key || !publicSnapshot?.advanced || !Array.isArray(publicSnapshot?.sections)) {
    reasons.push("missing_snapshot_base");
    return reasons;
  }

  if (!hasSectionText(publicSnapshot, 0)) reasons.push("missing_personality_section");
  if (!hasSectionText(publicSnapshot, 1)) reasons.push("missing_ability_section");
  if (!hasSectionText(publicSnapshot, 2)) reasons.push("missing_love_section");
  if (!hasSectionText(publicSnapshot, 4)) reasons.push("missing_health_section");
  if (!hasText(publicSnapshot?.advanced?.majorLuck?.summary)) reasons.push("missing_major_luck_summary");
  if (!hasLuckItems(publicSnapshot?.advanced?.majorLuck?.items)) reasons.push("missing_major_luck_items");
  if (!hasText(publicSnapshot?.advanced?.yearLuck?.summary)) reasons.push("missing_year_luck_summary");
  if (!hasLuckItems(publicSnapshot?.advanced?.yearLuck?.items)) reasons.push("missing_year_luck_items");
  if (!hasText(publicSnapshot?.advanced?.wealth?.summary) || !hasWealthCards(publicSnapshot)) reasons.push("missing_wealth_cards");

  if (String(publicSnapshot?.meta?.generated_year_kst || "") !== currentKeys.yearKey) {
    reasons.push("stale_year_kst");
  }

  if (Number(publicSnapshot?.meta?.generated_fortune_year || 0) !== currentKeys.fortuneYear) {
    reasons.push("stale_fortune_year");
  }

  return reasons;
}

function getRequiredInsightRefreshReasons(publicSnapshot, currentKeys) {
  const reasons = [];

  if (!isCompletePersonalityDailyInsight(publicSnapshot?.insights?.personalityDaily, currentKeys.dateKey)) {
    reasons.push("stale_personality_daily");
  }

  if (!isCompleteMonthlyInsight(publicSnapshot?.insights?.healthMonthly, currentKeys.monthKey, { requireGoodPoint: true })) {
    reasons.push("stale_health_monthly");
  }

  if (!isCompleteHealthYearlyInsight(publicSnapshot?.insights?.healthYearly, currentKeys.fortuneYear)) {
    reasons.push("stale_health_yearly");
  }

  if (!isCompleteLoveDetailInsight(publicSnapshot?.insights?.loveDetail)) {
    reasons.push("stale_love_detail");
  }

  if (!isCompleteMonthlyInsight(publicSnapshot?.insights?.loveMonthly, currentKeys.monthKey)) {
    reasons.push("stale_love_monthly");
  }

  if (!isCompleteMonthlyInsight(publicSnapshot?.insights?.abilityMonthly, currentKeys.monthKey)) {
    reasons.push("stale_ability_monthly");
  }

  return reasons;
}

function getElementRole(dayElement, targetElement) {
  if (!dayElement || !targetElement) return "peer";
  if (dayElement === targetElement) return "peer";
  if (GENERATES[targetElement] === dayElement) return "resource";
  if (GENERATES[dayElement] === targetElement) return "output";
  if (CONTROLS[dayElement] === targetElement) return "wealth";
  if (CONTROLS[targetElement] === dayElement) return "authority";
  return "peer";
}

function getTopLoveRole(tenGods) {
  const counts = Object.fromEntries((tenGods?.counts || []).map(([god, count]) => [god, count]));
  const grouped = [
    { key: "output", value: (counts.식신 || 0) + (counts.상관 || 0) },
    { key: "resource", value: (counts.정인 || 0) + (counts.편인 || 0) },
    { key: "peer", value: (counts.비견 || 0) + (counts.겁재 || 0) },
    { key: "authority", value: (counts.정관 || 0) + (counts.편관 || 0) },
    { key: "wealth", value: (counts.정재 || 0) + (counts.편재 || 0) },
  ].sort((a, b) => b.value - a.value);

  return grouped[0]?.key || "resource";
}

function createTodayPillar(referenceDate) {
  const date = new Date(referenceDate);
  const result = calculateFourPillars({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 12,
    minute: 0,
    isLunar: false,
  });

  return result.day;
}

function createCurrentMonthPillar(referenceDate) {
  const date = new Date(referenceDate);
  const result = calculateFourPillars({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 12,
    minute: 0,
    isLunar: false,
  });

  return result.month;
}

function buildPersonalityDailyInsight(snapshot, kstDateParts) {
  const todayPillar = createTodayPillar(kstDateParts.referenceDate);
  const todayKey = `${todayPillar.heavenlyStem}${todayPillar.earthlyBranch}`;
  const todayArchetype = getDayPillarArchetype(todayKey) || {};
  const userDayStem = snapshot?.pillars?.day?.stem?.char || "";
  const userDayBranch = snapshot?.pillars?.day?.branch?.char || "";
  const userDayElement = snapshot?.pillars?.day?.stem?.element || STEM_TO_ELEMENT[userDayStem] || "";
  const todayStemElement = STEM_TO_ELEMENT[todayPillar.heavenlyStem] || "";
  const role = getElementRole(userDayElement, todayStemElement);
  const copy = DAILY_ROLE_COPY[role] || DAILY_ROLE_COPY.peer;
  const goodSignals = [...copy.goodSignals];
  const warnSignals = [...copy.warnSignals];

  if (BRANCH_HARMONY[userDayBranch] === todayPillar.earthlyBranch) {
    goodSignals.push("감정 호흡 부드러움");
  }

  if (BRANCH_CLASH[userDayBranch] === todayPillar.earthlyBranch) {
    warnSignals.push("감정 충돌 가능성");
  }

  return {
    dateKey: kstDateParts.dateKey,
    dateLabel: kstDateParts.dateLabel,
    pillarKey: todayKey,
    pillarHanja: todayArchetype.hanja || "",
    point: `${copy.point}${todayArchetype.metaphor ? ` 오늘 분위기는 '${todayArchetype.metaphor}' 이미지에 가깝습니다.` : ""}`.trim(),
    goodEmotion: copy.goodEmotion,
    improve: copy.improve,
    goodSignals: [...new Set(goodSignals)].slice(0, 4),
    warnSignals: [...new Set(warnSignals)].slice(0, 4),
  };
}

function buildHealthYearlyInsight(snapshot) {
  const currentYearItem = snapshot?.advanced?.yearLuck?.items?.find((item) => item?.isCurrent) || snapshot?.advanced?.yearLuck?.items?.[0] || null;
  const focus = currentYearItem?.focus || "기본 흐름";
  const boosts = [...new Set(currentYearItem?.boosts || [])].slice(0, 3);

  return {
    fortuneYear: currentYearItem?.year || null,
    focus,
    goodPoint: YEARLY_HEALTH_COPY[focus] || YEARLY_HEALTH_COPY["기본 흐름"],
    supports: boosts,
  };
}

function buildMonthlyInsight(snapshot, variant, kstDateParts) {
  const monthPillar = createCurrentMonthPillar(kstDateParts.monthReferenceDate);
  const monthKey = `${monthPillar.heavenlyStem}${monthPillar.earthlyBranch}`;
  const monthArchetype = getDayPillarArchetype(monthKey) || {};
  const userDayStem = snapshot?.pillars?.day?.stem?.char || "";
  const userDayBranch = snapshot?.pillars?.day?.branch?.char || "";
  const userDayElement = snapshot?.pillars?.day?.stem?.element || STEM_TO_ELEMENT[userDayStem] || "";
  const monthStemElement = STEM_TO_ELEMENT[monthPillar.heavenlyStem] || "";
  const role = getElementRole(userDayElement, monthStemElement);
  const copy = MONTHLY_VARIANT_COPY[variant]?.[role] || MONTHLY_VARIANT_COPY[variant]?.peer || {};
  const goodSignals = [...(copy.goodSignals || [])];
  const warnSignals = [...(copy.warnSignals || [])];

  if (BRANCH_HARMONY[userDayBranch] === monthPillar.earthlyBranch) {
    goodSignals.push(variant === "health" ? "리듬 안정감" : variant === "love" ? "호흡 맞음" : "협업 정렬");
  }

  if (BRANCH_CLASH[userDayBranch] === monthPillar.earthlyBranch) {
    warnSignals.push(variant === "health" ? "컨디션 기복" : variant === "love" ? "감정 마찰" : "진행 마찰");
  }

  return {
    monthKey: kstDateParts.monthKey,
    monthLabel: kstDateParts.monthLabel,
    pillarKey: monthKey,
    pillarHanja: monthArchetype.hanja || "",
    point: `${copy.point || ""}${monthArchetype.metaphor ? ` 이번 달 분위기는 '${monthArchetype.metaphor}' 이미지에 가깝습니다.` : ""}`.trim(),
    goodPoint: copy.goodPoint || "",
    goodSignals: [...new Set(goodSignals)].slice(0, 4),
    warnSignals: [...new Set(warnSignals)].slice(0, 4),
  };
}

function buildLoveDetailInsight(snapshot) {
  const dominantRole = getTopLoveRole(snapshot?.advanced?.tenGods);
  const roleCopy = LOVE_STYLE_COPY[dominantRole] || LOVE_STYLE_COPY.resource;
  const loveSummary = snapshot?.sections?.[2]?.text || "신뢰와 감정 표현의 균형이 연애 흐름의 핵심이 됩니다.";

  return {
    summary: loveSummary,
    attraction: roleCopy.attraction,
    dislike: roleCopy.dislike,
    strategy: roleCopy.strategy,
  };
}

export function buildProfileInsightBundle(snapshot, now = new Date()) {
  const kstDateParts = getKstDateParts(now);
  const fortuneYear = getCurrentFortuneYear(kstDateParts.referenceDate);

  return {
    meta: {
      generated_date_kst: kstDateParts.dateKey,
      generated_month_kst: kstDateParts.monthKey,
      generated_year_kst: String(kstDateParts.year),
      generated_fortune_year: fortuneYear,
      generated_at: new Date(now).toISOString(),
      refresh_policy: PROFILE_REFRESH_POLICY,
    },
    personalityDaily: buildPersonalityDailyInsight(snapshot, kstDateParts),
    healthMonthly: buildMonthlyInsight(snapshot, "health", kstDateParts),
    healthYearly: buildHealthYearlyInsight(snapshot),
    loveDetail: buildLoveDetailInsight(snapshot),
    loveMonthly: buildMonthlyInsight(snapshot, "love", kstDateParts),
    abilityMonthly: buildMonthlyInsight(snapshot, "ability", kstDateParts),
  };
}

export function buildEnrichedPublicProfileSnapshot(snapshot, now = new Date()) {
  const insightBundle = buildProfileInsightBundle(snapshot, now);

  return {
    gender: snapshot.gender,
    unknownTime: snapshot.unknownTime,
    pillars: snapshot.pillars,
    sections: snapshot.sections,
    advanced: snapshot.advanced,
    dayPillar: snapshot.dayPillar,
    meta: insightBundle.meta,
    insights: {
      personalityDaily: insightBundle.personalityDaily,
      healthMonthly: insightBundle.healthMonthly,
      healthYearly: insightBundle.healthYearly,
      loveDetail: insightBundle.loveDetail,
      loveMonthly: insightBundle.loveMonthly,
      abilityMonthly: insightBundle.abilityMonthly,
    },
  };
}

export function getPublicProfileRefreshState(publicSnapshot, now = new Date()) {
  const kstDateParts = getKstDateParts(now);
  const currentKeys = {
    dateKey: kstDateParts.dateKey,
    monthKey: kstDateParts.monthKey,
    yearKey: String(kstDateParts.year),
    fortuneYear: getCurrentFortuneYear(kstDateParts.referenceDate),
  };
  const fullReasons = getRequiredFullRefreshReasons(publicSnapshot, currentKeys);
  const insightReasons = fullReasons.length ? [] : getRequiredInsightRefreshReasons(publicSnapshot, currentKeys);

  return {
    needsRefresh: fullReasons.length > 0 || insightReasons.length > 0,
    requiresFullRebuild: fullReasons.length > 0,
    needsInsightRefresh: fullReasons.length === 0 && insightReasons.length > 0,
    fullReasons,
    insightReasons,
    currentKeys,
  };
}

export function refreshPublicProfileSnapshot(publicSnapshot, now = new Date()) {
  if (!publicSnapshot?.dayPillar?.key || !publicSnapshot?.advanced || !Array.isArray(publicSnapshot?.sections)) {
    return null;
  }

  return buildEnrichedPublicProfileSnapshot({
    gender: publicSnapshot.gender,
    unknownTime: publicSnapshot.unknownTime,
    pillars: publicSnapshot.pillars,
    sections: publicSnapshot.sections,
    advanced: publicSnapshot.advanced,
    dayPillar: publicSnapshot.dayPillar,
  }, now);
}

export function needsPublicProfileRefresh(publicSnapshot, now = new Date()) {
  return getPublicProfileRefreshState(publicSnapshot, now).needsRefresh;
}
