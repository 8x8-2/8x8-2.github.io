import {
  calculateFourPillars,
  EARTHLY_BRANCHES,
  EARTHLY_BRANCHES_HANJA,
  HEAVENLY_STEMS,
  HEAVENLY_STEMS_HANJA,
} from "./src/engine/soulscan-engine.js";
import {
  buildAdvancedSajuData,
  formatHiddenStemLine,
  getTenGodBrief,
} from "./src/engine/saju-advanced.js";
import { initCommonPageTracking, trackEvent } from "./src/shared/analytics.js";
import {
  isSupabaseConfigured,
  saveReading,
  subscribeAuthState,
} from "./src/shared/auth.js";
import { setupAuthUi } from "./src/shared/auth-ui.js";
import {
  consumeHomeAutoRun,
  loadBirthDraft,
  requestHomeAutoRun,
  saveBirthDraft,
} from "./src/shared/drafts.js";
import { getDayPillarArchetype } from "./data/daypillars.js";
import { buildSajuReading } from "./src/engine/saju-interpretation.js";

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
const resultContentEl = $("resultContent");
const resultPreviewGateEl = $("resultPreviewGate");
const pillarsEl = $("pillars");
const dayPillarProfileEl = $("dayPillarProfile");
const sectionsEl = $("sections");
const tenGodsSummaryEl = $("tenGodsSummary");
const tenGodsEl = $("tenGods");
const diagnosisSummaryEl = $("diagnosisSummary");
const diagnosisEl = $("diagnosis");
const wealthSummaryEl = $("wealthSummary");
const wealthCardsEl = $("wealthCards");
const majorLuckSummaryEl = $("majorLuckSummary");
const majorLuckEl = $("majorLuck");
const yearLuckSummaryEl = $("yearLuckSummary");
const yearLuckEl = $("yearLuck");
const saveReadingButtonEl = $("saveReadingButton");
const previewSignupLinkEl = $("previewSignupLink");
const previewSigninLinkEl = $("previewSigninLink");
const saveReadingModalEl = $("saveReadingModal");
const saveReadingFormEl = $("saveReadingForm");
const saveEntryNameEl = $("saveEntryName");
const saveEntryMemoEl = $("saveEntryMemo");
const saveReadingStatusEl = $("saveReadingStatus");
const saveReadingErrorEl = $("saveReadingError");

let currentSession = null;
let lastRenderedReading = null;
let shouldAutoRunAfterAuth = consumeHomeAutoRun();

function syncCurrentYear() {
  const currentYear = String(new Date().getFullYear());
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = currentYear;
  });
}

syncCurrentYear();
initCommonPageTracking();
setupAuthUi();
trackEvent("home_view", {
  page_name: "home",
});

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

function getBirthDraftFromForm() {
  return {
    calendar: calendarEl.value,
    leapMonth: leapEl.checked,
    year: yearEl.value.trim(),
    month: monthEl.value.trim(),
    day: dayEl.value.trim(),
    birthTime: birthTimeEl?.value.trim() || "",
    unknownTime: unknownTimeEl?.checked === true,
  };
}

function applyBirthDraftToForm() {
  const draft = loadBirthDraft();
  if (!draft) return;

  calendarEl.value = draft.calendar || calendarEl.value;
  leapEl.checked = Boolean(draft.leapMonth);
  yearEl.value = draft.year || yearEl.value;
  monthEl.value = draft.month || monthEl.value;
  dayEl.value = draft.day || dayEl.value;
  if (birthTimeEl) {
    birthTimeEl.value = draft.birthTime || "";
  }
  if (unknownTimeEl) {
    unknownTimeEl.checked = Boolean(draft.unknownTime);
  }
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
applyBirthDraftToForm();
calendarEl.dispatchEvent(new Event("change"));
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

function renderSummaryBox(element, summary, note = "") {
  element.innerHTML = `
    <div class="text">${summary}</div>
    ${note ? `<p class="mini-note">${note}</p>` : ""}
  `;
}

function renderDayPillarKeywords(keywords = []) {
  if (!keywords.length) return "";

  return `
    <div class="impact-pills day-pillar-keywords">
      ${keywords.map((keyword) => `<span class="impact-chip impact-chip-neutral">${keyword}</span>`).join("")}
    </div>
  `;
}

function renderDayPillarProfile(pillars) {
  const dayPillarKey = `${pillars.day.stem.char}${pillars.day.branch.char}`;
  const info = getDayPillarArchetype(dayPillarKey);

  if (!info) {
    dayPillarProfileEl.innerHTML = `
      <div class="title">${dayPillarKey} 일주</div>
      <div class="text">이 일주에 대한 물상 설명은 아직 준비 중입니다.</div>
    `;
    return;
  }

  dayPillarProfileEl.innerHTML = `
    <div class="title">${dayPillarKey}(${info.hanja}) 일주</div>
    <div class="day-pillar-metaphor">${info.metaphor}</div>
    ${renderDayPillarKeywords(info.keywords)}
    <div class="text day-pillar-overview">${info.overview || "전통 물상 해석에서는 이 일주를 위와 같은 이미지로 비유합니다."}</div>
    <p class="mini-note">물상 개요는 공개 일주론 자료와 물상 비유를 바탕으로, 처음 보는 사람도 이해하기 쉽게 풀어쓴 요약입니다.</p>
  `;
}

function renderTenGodCards(tenGods) {
  return tenGods.items
    .map((item) => {
      const leadGod = item.stemTenGod === "일원" ? item.branchTenGod : item.stemTenGod;
      const brief = leadGod && leadGod !== "미상" ? getTenGodBrief(leadGod) : "";

      return `
        <article class="box insight-card">
          <div class="title">${item.title}</div>
          <div class="metric-row">
            <span class="metric-label">천간 십성</span>
            <span class="metric-value">${item.stemTenGod || "미상"}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">지지 주기</span>
            <span class="metric-value">${item.branchTenGod || "미상"}</span>
          </div>
          <div class="metric-row metric-row-wide">
            <span class="metric-label">지장간</span>
            <span class="metric-value">${formatHiddenStemLine(item.hiddenStems)}</span>
          </div>
          ${brief ? `<p class="mini-note">${brief}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderTextBoxes(items) {
  return items
    .map(
      (item) => `
        <div class="box">
          <div class="title">${item.title}</div>
          <div class="text">${item.text}</div>
        </div>
      `
    )
    .join("");
}

function renderImpactChips(items, variant, emptyText) {
  const source = items.length ? items : [emptyText];
  return source
    .map((item) => `<span class="impact-chip impact-chip-${variant}">${item}</span>`)
    .join("");
}

function renderToneChips(tags) {
  return tags
    .map((tag) => `<span class="impact-chip impact-chip-${tag.tone || "neutral"}">${tag.label}</span>`)
    .join("");
}

function renderDiagnosisCards(diagnosis) {
  return diagnosis.cards
    .map((card) => `
      <article class="box insight-card diagnosis-card">
        <div class="luck-head">
          <div class="title">${card.title}</div>
          ${card.headline ? `<span class="luck-pill">${card.headline}</span>` : ""}
        </div>
        ${card.tags?.length ? `<div class="impact-pills diagnosis-pills">${renderToneChips(card.tags)}</div>` : ""}
        <div class="text">${card.text}</div>
        ${card.note ? `<p class="mini-note">${card.note}</p>` : ""}
      </article>
    `)
    .join("");
}

function renderLuckCards(items, type) {
  return items
    .map((item) => {
      const periodText = type === "major"
        ? `${item.startYear}~${item.endYear} · 약 ${item.ageStart}세~${item.ageEnd}세`
        : `${item.year}년`;
      const detailNote = item.interactionNote || item.note;

      return `
        <article class="box luck-card ${item.isCurrent ? "is-current" : ""}">
          <div class="luck-head">
            <div class="title">${type === "major" ? `${item.index}대운 ${item.pillarString}` : `${item.year}년 ${item.pillarString}`}</div>
            <span class="luck-pill ${item.isCurrent ? "is-active" : ""}">${item.isCurrent ? "현재" : item.focus}</span>
          </div>
          <div class="luck-period">${periodText}</div>
          <div class="luck-meta">천간 ${item.stemGod} · 지지 ${item.branchGod}</div>
          <div class="badge-row">
            <span class="luck-badge">${item.focus}</span>
            ${item.wealthHitCount > 0 ? `<span class="luck-badge">재성 신호 ${item.wealthHitCount}</span>` : ""}
            ${item.alignmentText ? `<span class="luck-badge luck-badge-emphasis">${item.alignmentText}</span>` : ""}
          </div>
          <div class="luck-track">
            <span class="metric-label">배경</span>
            <span class="metric-value">${item.background}</span>
          </div>
          <div class="luck-track">
            <span class="metric-label">체감</span>
            <span class="metric-value">${item.result}</span>
          </div>
          <div class="impact-block">
            <div class="impact-title">힘 받는 점</div>
            <div class="impact-pills">${renderImpactChips(item.boosts, "good", "기본기 정비")}</div>
          </div>
          <div class="impact-block">
            <div class="impact-title">주의할 점</div>
            <div class="impact-pills">${renderImpactChips(item.cautions, "warn", "무리한 확장")}</div>
          </div>
          ${item.interactionTags?.length ? `
            <div class="impact-block">
              <div class="impact-title">합·형·충·파·해</div>
              <div class="impact-pills">${renderToneChips(item.interactionTags)}</div>
            </div>
          ` : ""}
          ${detailNote ? `<p class="mini-note">${detailNote}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function buildReadingSnapshot({ pillars, sections, advanced, gender, unknownTime, birthInfo }) {
  const dayPillarKey = `${pillars.day.stem.char}${pillars.day.branch.char}`;
  const dayPillarInfo = getDayPillarArchetype(dayPillarKey) || {};

  return {
    gender,
    unknownTime,
    birthInfo,
    pillars,
    sections,
    advanced,
    dayPillar: {
      key: dayPillarKey,
      hanja: dayPillarInfo.hanja || "",
      metaphor: dayPillarInfo.metaphor || "",
      elementClass: ELEMENT_CLASS[pillars.day.stem.element] || "unknown",
    },
  };
}

function updateResultAccessState() {
  const hasReading = Boolean(lastRenderedReading);
  const loggedIn = Boolean(currentSession);
  const shouldLock = hasReading && !loggedIn;

  resultEl.classList.toggle("is-preview-locked", shouldLock);
  resultPreviewGateEl?.classList.toggle("hidden", !shouldLock);
  saveReadingButtonEl?.classList.toggle("hidden", !hasReading || !loggedIn || !isSupabaseConfigured());
}

function openSaveReadingModal() {
  if (!lastRenderedReading || !currentSession) return;

  saveReadingErrorEl.textContent = "";
  saveReadingStatusEl.textContent = "";
  saveEntryMemoEl.value = "";
  saveEntryNameEl.value = saveEntryNameEl.value.trim() || currentSession.user.user_metadata?.full_name || "나의 사주";
  saveReadingModalEl.classList.remove("hidden");
  saveReadingModalEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
}

function closeSaveReadingModal() {
  saveReadingModalEl.classList.add("hidden");
  saveReadingModalEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-modal");
}

function rememberBirthDraftForAuth() {
  saveBirthDraft(getBirthDraftFromForm());
  requestHomeAutoRun();
}

function bindPreviewLink(link, eventName) {
  if (!link) return;
  link.addEventListener("click", () => {
    rememberBirthDraftForAuth();
    trackEvent(eventName, {
      page_name: "home",
    });
  });
}

bindPreviewLink(previewSignupLinkEl, "home_preview_signup_click");
bindPreviewLink(previewSigninLinkEl, "home_preview_signin_click");

document.addEventListener("click", (event) => {
  const signinTrigger = event.target.closest("[data-auth-action='signin']");
  if (signinTrigger && lastRenderedReading) {
    rememberBirthDraftForAuth();
  }
});

saveReadingButtonEl?.addEventListener("click", () => {
  trackEvent("reading_save_modal_open", {
    page_name: "home",
  });
  openSaveReadingModal();
});

document.querySelectorAll("[data-save-close]").forEach((button) => {
  button.addEventListener("click", () => {
    closeSaveReadingModal();
  });
});

saveReadingFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!lastRenderedReading) return;

  const entryName = saveEntryNameEl.value.trim();
  const memo = saveEntryMemoEl.value.trim();

  saveReadingErrorEl.textContent = "";
  saveReadingStatusEl.textContent = "";

  if (entryName.length < 1) {
    saveReadingErrorEl.textContent = "저장 이름을 입력해 주세요.";
    return;
  }

  if (memo.length > 500) {
    saveReadingErrorEl.textContent = "메모는 500자 이하로 입력해 주세요.";
    return;
  }

  try {
    saveReadingStatusEl.textContent = "저장 중...";

    await saveReading({
      entry_name: entryName,
      memo,
      gender: lastRenderedReading.gender,
      calendar_type: lastRenderedReading.birthInfo.isLunar ? "lunar" : "solar",
      is_leap_month: Boolean(lastRenderedReading.birthInfo.isLeapMonth),
      birth_year: lastRenderedReading.birthInfo.year,
      birth_month: lastRenderedReading.birthInfo.month,
      birth_day: lastRenderedReading.birthInfo.day,
      birth_hour: lastRenderedReading.unknownTime ? null : lastRenderedReading.birthInfo.hour,
      birth_minute: lastRenderedReading.unknownTime ? null : lastRenderedReading.birthInfo.minute,
      birth_time_known: !lastRenderedReading.unknownTime,
      day_pillar_key: lastRenderedReading.dayPillar.key,
      day_pillar_hanja: lastRenderedReading.dayPillar.hanja,
      day_pillar_metaphor: lastRenderedReading.dayPillar.metaphor,
      element_class: lastRenderedReading.dayPillar.elementClass,
      preview_summary: lastRenderedReading.sections[0]?.text || lastRenderedReading.advanced.diagnosis.summary,
      pillars_json: lastRenderedReading.pillars,
      reading_json: {
        birthInfo: lastRenderedReading.birthInfo,
        sections: lastRenderedReading.sections,
        advanced: lastRenderedReading.advanced,
        dayPillar: lastRenderedReading.dayPillar,
      },
    });

    trackEvent("reading_save_success", {
      page_name: "home",
      day_pillar_name: lastRenderedReading.dayPillar.key,
    });
    saveReadingStatusEl.textContent = "저장되었습니다.";
    setTimeout(() => {
      closeSaveReadingModal();
    }, 600);
  } catch (error) {
    saveReadingErrorEl.textContent = error.message || "사주 결과를 저장하지 못했습니다.";
    saveReadingStatusEl.textContent = "";
  }
});

subscribeAuthState((session) => {
  currentSession = session;
  updateResultAccessState();

  if (session && shouldAutoRunAfterAuth) {
    shouldAutoRunAfterAuth = false;
    setTimeout(() => {
      btn.click();
    }, 0);
  }
});

function validateInput({ year, month, day, birthTime, isLunar, unknownTime }) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return "년은 1900~2100 사이여야 합니다.";
  if (!Number.isInteger(month) || month < 1 || month > 12) return "월은 1~12 사이여야 합니다.";

  const maxDay = isLunar ? 30 : 31;
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return `일은 ${isLunar ? "음력 기준 1~30" : "1~31"} 사이여야 합니다.`;

  if (!unknownTime && !isValidBirthTime(birthTime)) return "올바른 시간을 입력해 주세요.";

  return null;
}

function render(pillars, { gender, unknownTime, birthInfo }) {
  pillarsEl.innerHTML = renderPillarsTable(pillars);
  renderDayPillarProfile(pillars);

  const sections = buildSajuReading(pillars, { gender, unknownTime });
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

  const advanced = buildAdvancedSajuData({
    birthInfo,
    pillars,
    gender,
    unknownTime,
    currentDate: new Date(),
  });

  renderSummaryBox(tenGodsSummaryEl, advanced.tenGods.summary, advanced.tenGods.note);
  tenGodsEl.innerHTML = renderTenGodCards(advanced.tenGods);

  renderSummaryBox(diagnosisSummaryEl, advanced.diagnosis.summary, advanced.diagnosis.note);
  diagnosisEl.innerHTML = renderDiagnosisCards(advanced.diagnosis);

  renderSummaryBox(wealthSummaryEl, advanced.wealth.summary);
  wealthCardsEl.innerHTML = renderTextBoxes(advanced.wealth.cards);

  renderSummaryBox(majorLuckSummaryEl, advanced.majorLuck.summary, advanced.majorLuck.note);
  majorLuckEl.innerHTML = renderLuckCards(advanced.majorLuck.items, "major");

  renderSummaryBox(yearLuckSummaryEl, advanced.yearLuck.summary, advanced.yearLuck.note);
  yearLuckEl.innerHTML = renderLuckCards(advanced.yearLuck.items, "year");

  lastRenderedReading = buildReadingSnapshot({
    pillars,
    sections,
    advanced,
    gender,
    unknownTime,
    birthInfo,
  });
  updateResultAccessState();
  resultEl.classList.remove("hidden");
}

btn.addEventListener("click", async () => {
  errEl.textContent = "";
  statusEl.textContent = "";
  btn.disabled = true;
  trackEvent("home_ctabtn_click", {
    page_name: "home",
  });

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

    saveBirthDraft(getBirthDraftFromForm());

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

    render(pillars, {
      gender,
      unknownTime,
      birthInfo: {
        year,
        month,
        day,
        hour,
        minute,
        isLunar: isLunar ? true : false,
        isLeapMonth: isLunar ? isLeapMonth : undefined,
      },
    });
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
