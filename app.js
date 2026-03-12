import {
  calculateFourPillars,
  EARTHLY_BRANCHES,
  EARTHLY_BRANCHES_HANJA,
  HEAVENLY_STEMS,
  HEAVENLY_STEMS_HANJA,
} from "./src/engine/soulscan-engine.js";

const $ = (id) => document.getElementById(id);

const calendarEl = $("calendar");
const leapEl = $("leapMonth");
const genderEl = $("gender");
const unknownTimeEl = $("unknownTime");
const birthTimeEl = $("birthTime");
const yearEl = $("yyyy");
const monthEl = $("mm");
const dayEl = $("dd");
const timeFeedbackEl = $("timeFeedback");
const btn = $("btnCalc");
const statusEl = $("status");
const errEl = $("error");
const resultEl = $("result");
const pillarsEl = $("pillars");
const sectionsEl = $("sections");

function trackEvent(name, params = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

calendarEl.addEventListener("change", () => {
  const isLunar = calendarEl.value === "lunar";
  leapEl.disabled = !isLunar;
  if (!isLunar) leapEl.checked = false;
});

function normalizeBirthTimeInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;

  const hh = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  return `${hh}:${mm}`;
}

function normalizeDigitsOnlyInput(value, maxLength) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

function bindDigitsOnlyInput(input, maxLength) {
  if (!input) return;

  input.addEventListener("beforeinput", (event) => {
    if (event.isComposing) return;
    if (event.inputType?.startsWith("delete") || event.inputType === "historyUndo" || event.inputType === "historyRedo") return;
    if (event.data && !/^\d+$/.test(event.data)) {
      event.preventDefault();
      return;
    }

    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? input.value.length;
    const nextLength = input.value.length - (selectionEnd - selectionStart) + (event.data?.length || 0);
    if (nextLength > maxLength) {
      event.preventDefault();
    }
  });

  input.addEventListener("input", () => {
    const normalized = normalizeDigitsOnlyInput(input.value, maxLength);
    if (input.value !== normalized) {
      input.value = normalized;
    }
  });
}

function isValidBirthTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hh, mm] = value.split(":").map(Number);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return false;
  if (hh < 0 || hh > 24) return false;
  if (mm < 0 || mm > 59) return false;
  if (hh === 24 && mm !== 0) return false;
  return true;
}

function updateBirthTimeState() {
  if (!unknownTimeEl || !birthTimeEl || !timeFeedbackEl) return;

  const unknown = unknownTimeEl.checked;

  if (unknown) {
    birthTimeEl.value = "";
    birthTimeEl.disabled = true;
    birthTimeEl.readOnly = true;
    birthTimeEl.placeholder = "시간 모름";
    birthTimeEl.classList.remove("invalid");
    birthTimeEl.setCustomValidity("");
    timeFeedbackEl.textContent = "올바른 시간을 입력해 주세요.";
    timeFeedbackEl.classList.add("hidden");
    btn.disabled = false;
    return;
  }

  birthTimeEl.disabled = false;
  birthTimeEl.readOnly = false;
  birthTimeEl.placeholder = "00:00";

  const normalized = normalizeBirthTimeInput(birthTimeEl.value);
  if (birthTimeEl.value !== normalized) {
    birthTimeEl.value = normalized;
  }

  const value = birthTimeEl.value.trim();
  const valid = isValidBirthTime(value);

  if (!value) {
    birthTimeEl.classList.add("invalid");
    birthTimeEl.setCustomValidity("올바른 시간을 입력해 주세요.");
    timeFeedbackEl.textContent = "올바른 시간을 입력해 주세요.";
    timeFeedbackEl.classList.remove("hidden");
    btn.disabled = true;
    return;
  }

  birthTimeEl.classList.toggle("invalid", !valid);
  birthTimeEl.setCustomValidity(valid ? "" : "올바른 시간을 입력해 주세요.");
  timeFeedbackEl.textContent = "올바른 시간을 입력해 주세요.";
  timeFeedbackEl.classList.toggle("hidden", valid);
  btn.disabled = !valid;
}

if (birthTimeEl) {
  birthTimeEl.addEventListener("input", (e) => {
    const nextValue = normalizeBirthTimeInput(e.target.value);
    e.target.value = nextValue;
    updateBirthTimeState();
  });

  birthTimeEl.addEventListener("blur", () => {
    updateBirthTimeState();
  });
}

bindDigitsOnlyInput(yearEl, 4);
bindDigitsOnlyInput(monthEl, 2);
bindDigitsOnlyInput(dayEl, 2);

if (unknownTimeEl) {
  unknownTimeEl.addEventListener("change", () => {
    updateBirthTimeState();
  });
}

updateBirthTimeState();

const STEM_TO_ELEMENT = {
  "갑": "목", "을": "목",
  "병": "화", "정": "화",
  "무": "토", "기": "토",
  "경": "금", "신": "금",
  "임": "수", "계": "수",
};

const BRANCH_TO_ELEMENT = {
  "자": "수",
  "축": "토",
  "인": "목",
  "묘": "목",
  "진": "토",
  "사": "화",
  "오": "화",
  "미": "토",
  "신": "금",
  "유": "금",
  "술": "토",
  "해": "수",
};

const STEM_TO_HANJA = Object.fromEntries(
  HEAVENLY_STEMS.map((stem, index) => [stem, HEAVENLY_STEMS_HANJA[index]])
);

const BRANCH_TO_HANJA = Object.fromEntries(
  EARTHLY_BRANCHES.map((branch, index) => [branch, EARTHLY_BRANCHES_HANJA[index]])
);

const ELEMENT_DISPLAY = {
  "목": "나무",
  "화": "불",
  "토": "땅",
  "금": "금",
  "수": "물",
};

const ELEMENT_CLASS = {
  "목": "wood",
  "화": "fire",
  "토": "earth",
  "금": "metal",
  "수": "water",
};

const PILLAR_COLUMNS = [
  { key: "hour", label: "시" },
  { key: "day", label: "일" },
  { key: "month", label: "월" },
  { key: "year", label: "년" },
];

const PILLAR_ROWS = [
  { key: "stem", label: "천간" },
  { key: "branch", label: "지지" },
];

// (선택) 특정 일주만 수동 고퀄 문구를 넣고 싶을 때
const DAY_PILLAR_DB = {
  // 예시 1개만
  "계유": {
    male: {
      love: "표현은 절제되어 보이지만 한 번 마음 주면 깊게 갑니다. 신뢰가 핵심입니다.",
      career: "디테일/분석/품질 기준이 강합니다. 데이터·기획·QA에 강점이 납니다.",
      money: "큰 베팅보다 규칙형 관리(예산/한도/분산)가 안정적입니다.",
      health: "수면/신경 피로 누적에 민감. 회복 루틴을 고정하세요.",
    },
    female: {
      love: "기준이 분명해 관계가 안정적입니다. 감정 표현을 조금만 더 해주면 좋아요.",
      career: "정밀함과 완성도가 강점. 기획·분석·디자인/QA에 강합니다.",
      money: "계획소비에 강합니다. 자동이체/목표예산으로 안정성이 커집니다.",
      health: "컨디션 편차가 생기기 쉬워 수면/면역 루틴 관리가 중요합니다.",
    },
  },
};

// 자동 생성 템플릿 (DB 없는 일주는 여기로)
const STEM_BASE = {
  "갑": { love: "주도적·개척형", career: "리더·기획형", money: "축적 선호", health: "간/눈 피로" },
  "을": { love: "섬세·관계형", career: "조율·기획형", money: "분산 선호", health: "피로/면역" },
  "병": { love: "표현·열정형", career: "세일즈·리딩", money: "단기 성과", health: "수면/과열" },
  "정": { love: "깊고 은근", career: "정밀·콘텐츠", money: "계획형", health: "신경/스트레스" },
  "무": { love: "보호·책임형", career: "운영·관리", money: "자산형", health: "소화/체중" },
  "기": { love: "배려·조율형", career: "행정·정리", money: "저축형", health: "위장/피로" },
  "경": { love: "직설·원칙형", career: "기술·결단", money: "성과형", health: "폐/피부" },
  "신": { love: "정교·기준형", career: "품질·분석", money: "절약형", health: "호흡기" },
  "임": { love: "자유·전략형", career: "확장·전략", money: "변동성", health: "수면/리듬" },
  "계": { love: "감성·직관형", career: "연구·상담", money: "분산형", health: "신경/면역" },
};

const BRANCH_MOD = {
  "자": "관계가 빠르게 형성되지만 감정 기복 관리가 중요합니다.",
  "축": "안정/루틴을 만들면 성과가 커집니다.",
  "인": "도전성이 강해 변화가 잦을 수 있습니다.",
  "묘": "감성·취향이 중요해 ‘맞음’이 핵심입니다.",
  "진": "책임이 커지기 쉬워 역할 분담이 포인트입니다.",
  "사": "속도가 빠르니 과열/과로를 조심하세요.",
  "오": "표현력은 강하지만 감정 과잉에 주의하세요.",
  "미": "돌봄/관계 피로가 누적되지 않게 경계를 세우세요.",
  "신": "성과 압박을 받기 쉬워 기준 조정이 필요합니다.",
  "유": "완성도/디테일 강점, 완벽주의로 지치지 않게 조절하세요.",
  "술": "원칙을 세우면 흔들림이 줄어듭니다.",
  "해": "감수성이 깊어 휴식 루틴이 중요합니다.",
};

function splitGanji(str) {
  if (!str || typeof str !== "string" || str.length < 2) return { stem: "", branch: "" };
  return { stem: str[0], branch: str[1] };
}

function buildGlyph(char, hanja, element, empty = false) {
  return { char, hanja, element, empty };
}

function buildStemGlyph(stem, element) {
  return buildGlyph(stem, STEM_TO_HANJA[stem] || "", element || STEM_TO_ELEMENT[stem] || "");
}

function buildBranchGlyph(branch, element) {
  return buildGlyph(branch, BRANCH_TO_HANJA[branch] || "", element || BRANCH_TO_ELEMENT[branch] || "");
}

function normalizePillar(stem, branch, stemElement, branchElement) {
  return {
    stem: buildStemGlyph(stem, stemElement),
    branch: buildBranchGlyph(branch, branchElement),
  };
}

function normalizeFourPillarsResult(r) {
  if (r?.year?.heavenlyStem && r?.year?.earthlyBranch) {
    return {
      year: normalizePillar(r.year.heavenlyStem, r.year.earthlyBranch, r.yearElement?.stem, r.yearElement?.branch),
      month: normalizePillar(r.month.heavenlyStem, r.month.earthlyBranch, r.monthElement?.stem, r.monthElement?.branch),
      day: normalizePillar(r.day.heavenlyStem, r.day.earthlyBranch, r.dayElement?.stem, r.dayElement?.branch),
      hour: normalizePillar(r.hour.heavenlyStem, r.hour.earthlyBranch, r.hourElement?.stem, r.hourElement?.branch),
    };
  }

  if (r && typeof r.toObject === "function") {
    const o = r.toObject();
    const year = splitGanji(o.year);
    const month = splitGanji(o.month);
    const day = splitGanji(o.day);
    const hour = splitGanji(o.hour);

    return {
      year: normalizePillar(year.stem, year.branch),
      month: normalizePillar(month.stem, month.branch),
      day: normalizePillar(day.stem, day.branch),
      hour: normalizePillar(hour.stem, hour.branch),
    };
  }

  return null;
}

function buildUnknownHourPillar() {
  return {
    stem: buildGlyph("미상", "?", "", true),
    branch: buildGlyph("미상", "?", "", true),
  };
}

function renderGlyphCell(glyph) {
  const elementClass = glyph.empty ? "unknown" : (ELEMENT_CLASS[glyph.element] || "unknown");
  const elementText = glyph.empty ? "시간 모름" : (ELEMENT_DISPLAY[glyph.element] || "");

  return `
    <div class="pillar-card ${glyph.empty ? "is-empty" : ""}" data-element="${elementClass}">
      <span class="pillar-korean">${glyph.char || "-"}</span>
      <span class="pillar-hanja">${glyph.hanja || "?"}</span>
      <span class="pillar-element">${elementText}</span>
    </div>
  `;
}

function renderPillarsTable(pillars) {
  return PILLAR_ROWS
    .map(
      (row) => `
        <tr>
          <th scope="row"><span class="axis-label">${row.label}</span></th>
          ${PILLAR_COLUMNS.map((column) => `<td>${renderGlyphCell(pillars[column.key][row.key])}</td>`).join("")}
        </tr>
      `
    )
    .join("");
}

function validateInput({ year, month, day, birthTime, isLunar, unknownTime }) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return "년은 1900~2100 사이여야 합니다.";
  if (!Number.isInteger(month) || month < 1 || month > 12) return "월은 1~12 사이여야 합니다.";

  const maxDay = isLunar ? 30 : 31;
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return `일은 ${isLunar ? "음력 기준 1~30" : "1~31"} 사이여야 합니다.`;

  if (!unknownTime && !isValidBirthTime(birthTime)) return "올바른 시간을 입력해 주세요.";

  return null;
}

function generateSectionsAuto(pillars, gender) {
  const stem = pillars.day.stem.char;
  const branch = pillars.day.branch.char;
  const base = STEM_BASE[stem] || { love: "기본 성향", career: "기본 성향", money: "기본 성향", health: "기본 성향" };
  const mod = BRANCH_MOD[branch] || "";
  const tone = gender === "female" ? "조금 더" : "더";

  return [
    { title: "1) 연애·인간관계", text: `${base.love}. ${mod} 표현은 ${tone} 부드럽게 하면 안정됩니다.` },
    { title: "2) 직업·경력", text: `${base.career}. ${mod}` },
    { title: "3) 재물·돈", text: `${base.money}. 규칙(예산/자동이체/분산)으로 관리하면 유리합니다.` },
    { title: "4) 건강", text: `${base.health}. 루틴(수면/식사/운동) 고정이 핵심입니다. ${mod}` },
  ];
}

function generateSections(pillars, gender) {
  const key = `${pillars.day.stem.char}${pillars.day.branch.char}`; // 일주
  const manual = DAY_PILLAR_DB[key]?.[gender];
  if (manual) {
    return [
      { title: "1) 연애·인간관계", text: manual.love },
      { title: "2) 직업·경력", text: manual.career },
      { title: "3) 재물·돈", text: manual.money },
      { title: "4) 건강", text: manual.health },
    ];
  }
  return generateSectionsAuto(pillars, gender);
}

function render(pillars, gender) {
  pillarsEl.innerHTML = renderPillarsTable(pillars);

  const sections = generateSections(pillars, gender);
  sectionsEl.innerHTML = sections
    .map(
      (s) => `
        <div class="box">
          <div class="title">${s.title}</div>
          <div class="text">${s.text}</div>
        </div>
      `
    )
    .join("");

  resultEl.classList.remove("hidden");
}

btn.addEventListener("click", async () => {
  errEl.textContent = "";
  statusEl.textContent = "";
  btn.disabled = true;

  try {
    const isLunar = calendarEl.value === "lunar";
    const isLeapMonth = leapEl.checked;
    const gender = genderEl.value;

    const year = Number($("yyyy").value);
    const month = Number($("mm").value);
    const day = Number($("dd").value);
    const unknownTime = unknownTimeEl?.checked === true;
    const birthTime = birthTimeEl?.value.trim() || "";

    const validationError = validateInput({ year, month, day, birthTime, isLunar, unknownTime });
    if (validationError) throw new Error(validationError);

    const [rawHour, rawMinute] = unknownTime ? [null, null] : birthTime.split(":").map(Number);

    let hour = rawHour;
    let minute = rawMinute;

    statusEl.textContent = "계산 중...";

    let pillars;

    if (unknownTime) {
      const r = calculateFourPillars({
        year,
        month,
        day,
        hour: 12,
        minute: 0,
        isLunar: isLunar ? true : false,
        isLeapMonth: isLunar ? isLeapMonth : undefined,
      });

      pillars = normalizeFourPillarsResult(r);
      if (!pillars) {
        console.log("8x8 사주 계산 결과:", r);
        throw new Error("사주 계산 결과를 해석할 수 없습니다. 콘솔 출력 캡처를 보내주세요.");
      }

      pillars.hour = buildUnknownHourPillar();
    } else {
      const r = calculateFourPillars({
        year,
        month,
        day,
        hour,
        minute,
        isLunar: isLunar ? true : false,
        isLeapMonth: isLunar ? isLeapMonth : undefined,
      });

      pillars = normalizeFourPillarsResult(r);
      if (!pillars) {
        console.log("8x8 사주 계산 결과:", r);
        throw new Error("사주 계산 결과를 해석할 수 없습니다. 콘솔 출력 캡처를 보내주세요.");
      }
    }

    const allOk =
      pillars.year.stem.char && pillars.year.branch.char &&
      pillars.month.stem.char && pillars.month.branch.char &&
      pillars.day.stem.char && pillars.day.branch.char &&
      (unknownTime || (pillars.hour.stem.char && pillars.hour.branch.char));

    if (!allOk) {
      console.log("정규화된 사주 결과:", pillars);
      throw new Error("간지 문자열 분해에 실패했습니다. 콘솔 출력 캡처를 보내주세요.");
    }

    render(pillars, gender);
    trackEvent("saju_calculation_success", {
      calendar_type: isLunar ? "lunar" : "solar",
      birth_time_known: unknownTime ? "no" : "yes",
    });
    updateBirthTimeState();
    statusEl.textContent = "완료";
  } catch (e) {
    errEl.textContent = e?.message || "오류가 발생했습니다.";
    updateBirthTimeState();
  } finally {
    if (!unknownTimeEl?.checked && birthTimeEl && isValidBirthTime(birthTimeEl.value.trim())) {
      btn.disabled = false;
    }
    if (unknownTimeEl?.checked) {
      btn.disabled = false;
    }
  }
});
