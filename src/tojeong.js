import { calculateTojeongReading } from "./engine/tojeong-engine.js";
import { getLeapMonthForYear, getLunarMonthLength } from "./engine/soulscan-engine.js";
import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import { setupAuthUi } from "./shared/auth-ui.js";
import {
  bindDigitsOnlyInput,
  formatCalendarLabel,
  isValidBirthTime,
  normalizeBirthTimeInput,
} from "./shared/birth.js";
import { saveBirthDraft } from "./shared/drafts.js";
import { escapeHtml } from "./shared/html.js";
import { setupScrollTopButton } from "./shared/ui.js";

function $(id) {
  return document.getElementById(id);
}

const nameEl = $("tojeongName");
const fortuneYearEl = $("tojeongYearSelect");
const calendarEl = $("tojeongCalendar");
const leapEl = $("tojeongLeapMonth");
const birthYearEl = $("tojeongBirthYear");
const birthMonthEl = $("tojeongBirthMonth");
const birthDayEl = $("tojeongBirthDay");
const birthTimeEl = $("tojeongBirthTime");
const unknownTimeEl = $("tojeongUnknownTime");
const timeFeedbackEl = $("tojeongTimeFeedback");
const calcButtonEl = $("tojeongCalcButton");
const statusEl = $("tojeongStatus");
const errorEl = $("tojeongError");
const resultEl = $("tojeongResult");
const resultContentEl = $("tojeongResultContent");
const floatingCtaEl = $("tojeongFloatingCta");
const scrollTopButtonEl = $("scrollTopButton");

function currentYear() {
  return new Date().getFullYear();
}

function buildFortuneYearOptions() {
  const year = currentYear();
  const options = [];

  for (let value = year - 4; value <= year + 4; value += 1) {
    options.push(`<option value="${value}"${value === year ? " selected" : ""}>${value}년</option>`);
  }

  fortuneYearEl.innerHTML = options.join("");
}

function updateCalendarState() {
  const isLunar = calendarEl.value === "lunar";
  leapEl.disabled = !isLunar;

  if (!isLunar) {
    leapEl.checked = false;
  }
}

function updateBirthTimeState() {
  const unknown = unknownTimeEl.checked;

  if (unknown) {
    birthTimeEl.value = "";
    birthTimeEl.disabled = true;
    birthTimeEl.readOnly = true;
    birthTimeEl.placeholder = "시간 모름";
    birthTimeEl.classList.remove("invalid");
    birthTimeEl.setCustomValidity("");
    timeFeedbackEl.classList.add("hidden");
    calcButtonEl.disabled = false;
    return;
  }

  birthTimeEl.disabled = false;
  birthTimeEl.readOnly = false;
  birthTimeEl.placeholder = "00:00";
  birthTimeEl.value = normalizeBirthTimeInput(birthTimeEl.value);

  const value = birthTimeEl.value.trim();
  const valid = isValidBirthTime(value);

  if (!value) {
    birthTimeEl.classList.add("invalid");
    birthTimeEl.setCustomValidity("올바른 시간을 입력해 주세요.");
    timeFeedbackEl.classList.remove("hidden");
    calcButtonEl.disabled = true;
    return;
  }

  birthTimeEl.classList.toggle("invalid", !valid);
  birthTimeEl.setCustomValidity(valid ? "" : "올바른 시간을 입력해 주세요.");
  timeFeedbackEl.classList.toggle("hidden", valid);
  calcButtonEl.disabled = !valid;
}

function buildBirthDraft() {
  return {
    name: nameEl.value.trim(),
    calendar: calendarEl.value,
    leapMonth: leapEl.checked,
    year: birthYearEl.value.trim(),
    month: birthMonthEl.value.trim(),
    day: birthDayEl.value.trim(),
    birthTime: birthTimeEl.value.trim(),
    unknownTime: unknownTimeEl.checked,
  };
}

function persistBirthDraft() {
  saveBirthDraft(buildBirthDraft());
}

function parseNumber(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function isValidSolarDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function validateForm() {
  const birthYear = parseNumber(birthYearEl.value);
  const birthMonth = parseNumber(birthMonthEl.value);
  const birthDay = parseNumber(birthDayEl.value);
  const fortuneYear = parseNumber(fortuneYearEl.value);
  const isLunar = calendarEl.value === "lunar";
  const isLeapMonth = leapEl.checked;
  const unknownTime = unknownTimeEl.checked;
  const birthTime = birthTimeEl.value.trim();

  if (!birthYear || birthYear < 1900 || birthYear > 2100) {
    return "년은 1900~2100 사이로 입력해 주세요.";
  }

  if (!birthMonth || birthMonth < 1 || birthMonth > 12) {
    return "월은 1~12 사이로 입력해 주세요.";
  }

  if (!birthDay || birthDay < 1 || birthDay > 31) {
    return "일은 1~31 사이로 입력해 주세요.";
  }

  if (!fortuneYear) {
    return "보고 싶은 연도를 선택해 주세요.";
  }

  if (!unknownTime && !isValidBirthTime(birthTime)) {
    return "태어난 시간을 올바르게 입력해 주세요.";
  }

  if (!isLunar && !isValidSolarDate(birthYear, birthMonth, birthDay)) {
    return "양력 생년월일이 올바르지 않습니다.";
  }

  if (isLunar) {
    const leapMonth = getLeapMonthForYear(birthYear);
    if (isLeapMonth && leapMonth !== birthMonth) {
      return `${birthYear}년 음력에는 ${birthMonth}월 윤달이 없습니다.`;
    }

    const maxDay = getLunarMonthLength(birthYear, birthMonth, isLeapMonth);
    if (birthDay > maxDay) {
      return `${birthYear}년 음력 ${birthMonth}월${isLeapMonth ? " 윤달" : ""}은 ${maxDay}일까지입니다.`;
    }
  }

  return null;
}

function renderThemeChips(themes = []) {
  if (!themes.length) return "";

  return `
    <div class="impact-pills">
      ${themes.map((theme) => `<span class="impact-chip impact-chip-${escapeHtml(theme.tone)}">${escapeHtml(theme.label)}</span>`).join("")}
    </div>
  `;
}

function renderLineList(lines) {
  return `
    <ul class="tojeong-line-list">
      ${lines.map((line) => `
        <li class="tojeong-line-item">
          <div class="tojeong-line-hanja">${escapeHtml(line.hanja)}</div>
          <div class="tojeong-line-reading">${escapeHtml(line.reading)}</div>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderMonthCards(reading) {
  return reading.monthInsights
    .map((month) => `
      <article class="box tojeong-month-card">
        <div class="tojeong-month-head">
          <div class="title">음력 ${escapeHtml(String(month.month))}월 운</div>
          <span class="luck-pill tojeong-tone-pill tojeong-tone-${escapeHtml(month.tone.key)}">${escapeHtml(month.tone.label)}</span>
        </div>
        <p class="tojeong-month-summary">${escapeHtml(month.summary)}</p>
        ${renderThemeChips(month.themes.slice(0, 4))}
        ${renderLineList(month.lines)}
      </article>
    `)
    .join("");
}

function renderCalculationCards(reading) {
  const inputBirth = `${reading.birth.input.year}.${String(reading.birth.input.month).padStart(2, "0")}.${String(reading.birth.input.day).padStart(2, "0")}`;
  const lunarBirth = `${reading.birth.lunar.year}.${String(reading.birth.lunar.month).padStart(2, "0")}.${String(reading.birth.lunar.day).padStart(2, "0")}${reading.birth.lunar.isLeapMonth ? " (윤달)" : ""}`;
  const pillars = `${reading.birth.pillars.year}년 · ${reading.birth.pillars.month}월 · ${reading.birth.pillars.day}일`;

  return `
    <div class="tojeong-meta-grid">
      <article class="box tojeong-meta-card">
        <div class="title">입력 정보</div>
        <div class="metric-row">
          <span class="metric-label">이름</span>
          <span class="metric-value">${escapeHtml(reading.name || "이름 미입력")}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">입력 기준</span>
          <span class="metric-value">${escapeHtml(formatCalendarLabel(reading.birth.input.isLunar ? "lunar" : "solar", reading.birth.input.isLeapMonth))}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">입력 생일</span>
          <span class="metric-value">${escapeHtml(inputBirth)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">변환 음력</span>
          <span class="metric-value">${escapeHtml(lunarBirth)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">태어난 시간</span>
          <span class="metric-value">${escapeHtml(reading.birth.hourLabel)}</span>
        </div>
      </article>

      <article class="box tojeong-meta-card">
        <div class="title">작괘 정보</div>
        <div class="metric-row">
          <span class="metric-label">보고 싶은 해</span>
          <span class="metric-value">${escapeHtml(String(reading.fortuneYear))}년</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">세는나이</span>
          <span class="metric-value">${escapeHtml(String(reading.calculation.age))}세</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">출생 간지</span>
          <span class="metric-value">${escapeHtml(pillars)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">올해 생월 길이</span>
          <span class="metric-value">${escapeHtml(String(reading.calculation.birthMonthLength))}일</span>
        </div>
        <p class="mini-note">
          전통 작괘법에 따라 세는나이, 출생 시점의 음력 년·월·일 간지, 선택한 연도의 음력 생월 길이를 함께 사용했습니다.
        </p>
      </article>

      <article class="box tojeong-meta-card">
        <div class="title">괘상수 계산</div>
        <div class="tojeong-formula-grid">
          <div class="tojeong-formula-item">
            <span class="tojeong-formula-label">태세수</span>
            <strong>${escapeHtml(String(reading.calculation.yearNumber))}</strong>
          </div>
          <div class="tojeong-formula-item">
            <span class="tojeong-formula-label">중수</span>
            <strong>${escapeHtml(String(reading.calculation.monthNumber))}</strong>
          </div>
          <div class="tojeong-formula-item">
            <span class="tojeong-formula-label">하수</span>
            <strong>${escapeHtml(String(reading.calculation.dayNumber))}</strong>
          </div>
          <div class="tojeong-formula-item">
            <span class="tojeong-formula-label">상괘</span>
            <strong>${escapeHtml(String(reading.calculation.upper))}</strong>
          </div>
          <div class="tojeong-formula-item">
            <span class="tojeong-formula-label">중괘</span>
            <strong>${escapeHtml(String(reading.calculation.middle))}</strong>
          </div>
          <div class="tojeong-formula-item">
            <span class="tojeong-formula-label">하괘</span>
            <strong>${escapeHtml(String(reading.calculation.lower))}</strong>
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderResult(reading) {
  const title = `${reading.code} ${reading.fortune.titleHanja}`;
  const titleKorean = `${reading.fortune.titleKorean}`;

  resultContentEl.innerHTML = `
    <section class="card tojeong-highlight-card">
      <div class="tojeong-highlight-head">
        <div>
          <p class="eyebrow">괘상수 ${escapeHtml(reading.code)}</p>
          <h3 class="tojeong-highlight-title">${escapeHtml(title)}</h3>
          <p class="tojeong-highlight-subtitle">${escapeHtml(titleKorean)} · ${escapeHtml(reading.annualSummary.headline)}</p>
        </div>
        <div class="tojeong-code-badge">${escapeHtml(reading.code)}</div>
      </div>
      ${renderThemeChips([
        ...reading.annualSummary.goodThemes.map((label) => ({ label, tone: "good" })),
        ...reading.annualSummary.warnThemes.map((label) => ({ label, tone: "warn" })),
      ].slice(0, 6))}
      <p class="tojeong-summary-copy">${escapeHtml(reading.annualSummary.summary)}</p>
    </section>

    ${renderCalculationCards(reading)}

    <section class="card">
      <div class="section-intro">
        <h3>한해 총운 원문</h3>
        <p class="muted">괘상수 ${escapeHtml(reading.code)}에 해당하는 총운 원문 9구입니다.</p>
      </div>
      ${renderLineList(reading.fortune.overall)}
    </section>

    <section class="card">
      <div class="section-intro">
        <h3>12개월 흐름</h3>
        <p class="muted">음력 기준 월별 운세 원문과 키워드 요약을 함께 보여드립니다.</p>
      </div>
      <div class="tojeong-month-grid">
        ${renderMonthCards(reading)}
      </div>
    </section>

    <section class="card tojeong-conversion-card">
      <div class="section-intro">
        <h3>이 흐름을 내 프로필로 이어가세요</h3>
        <p class="muted">
          토정비결은 올해의 흐름을 읽는 데 강하고, STELLAR-ID는 같은 생년월일시로 무료 사주·사주팔자 요약과 저장, 공유까지 이어집니다.
        </p>
      </div>
      <div class="actions tojeong-cta-actions">
        <a class="cta-link-button" href="../signup/" data-tojeong-draft-link data-track-name="tojeong_signup_click">회원가입하고 프로필 만들기</a>
        <a class="text-link-button" href="../signin/" data-tojeong-draft-link data-track-name="tojeong_signin_click">이미 계정이 있다면 로그인</a>
        <a class="text-link-button" href="../" data-tojeong-draft-link data-track-name="tojeong_home_click">로그인 전 홈으로 가기</a>
      </div>
    </section>
  `;
}

function bindDraftLinks() {
  document.querySelectorAll("[data-tojeong-draft-link]").forEach((link) => {
    link.addEventListener("click", () => {
      persistBirthDraft();
      trackEvent(link.dataset.trackName || "tojeong_draft_link_click", {
        page_name: "tojeong",
      });
    });
  });
}

async function handleCalculate() {
  errorEl.textContent = "";
  statusEl.textContent = "";

  const validationError = validateForm();
  if (validationError) {
    errorEl.textContent = validationError;
    return;
  }

  persistBirthDraft();

  const birthYear = parseNumber(birthYearEl.value);
  const birthMonth = parseNumber(birthMonthEl.value);
  const birthDay = parseNumber(birthDayEl.value);
  const fortuneYear = parseNumber(fortuneYearEl.value);
  const birthTime = birthTimeEl.value.trim();
  const unknownTime = unknownTimeEl.checked;

  calcButtonEl.disabled = true;
  statusEl.textContent = "토정비결 계산 중...";

  try {
    const reading = await calculateTojeongReading({
      name: nameEl.value.trim(),
      year: birthYear,
      month: birthMonth,
      day: birthDay,
      birthTime,
      unknownTime,
      isLunar: calendarEl.value === "lunar",
      isLeapMonth: leapEl.checked,
      fortuneYear,
    });

    renderResult(reading);
    bindDraftLinks();
    resultEl.classList.remove("hidden");
    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
    trackEvent("tojeong_calculate", {
      page_name: "tojeong",
      fortune_year: fortuneYear,
      fortune_code: reading.code,
      calendar_type: calendarEl.value,
      birth_time_known: unknownTime ? "no" : "yes",
    });
  } catch (error) {
    errorEl.textContent = error.message || "토정비결 결과를 계산하지 못했습니다.";
  } finally {
    calcButtonEl.disabled = unknownTimeEl.checked ? false : !isValidBirthTime(birthTimeEl.value.trim());
    statusEl.textContent = "";
  }
}

initCommonPageTracking();
setupAuthUi();
trackEvent("tojeong_view", {
  page_name: "tojeong",
});

buildFortuneYearOptions();
updateCalendarState();

[
  [birthYearEl, 4],
  [birthMonthEl, 2],
  [birthDayEl, 2],
].forEach(([input, maxLength]) => bindDigitsOnlyInput(input, maxLength));

birthTimeEl.addEventListener("input", (event) => {
  event.target.value = normalizeBirthTimeInput(event.target.value);
  updateBirthTimeState();
});

birthTimeEl.addEventListener("blur", updateBirthTimeState);
unknownTimeEl.addEventListener("change", updateBirthTimeState);
calendarEl.addEventListener("change", updateCalendarState);
calcButtonEl.addEventListener("click", () => {
  handleCalculate().catch(() => {});
});

floatingCtaEl.addEventListener("click", () => {
  persistBirthDraft();
  trackEvent("tojeong_floating_cta_click", {
    page_name: "tojeong",
  });
});

setupScrollTopButton(scrollTopButtonEl);
updateBirthTimeState();
