import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  getSession,
  isSupabaseConfigured,
  signUpWithPassword,
} from "./shared/auth.js";
import { setupAuthUi } from "./shared/auth-ui.js";
import { loadBirthDraft, saveBirthDraft } from "./shared/drafts.js";

function $(id) {
  return document.getElementById(id);
}

function isValidEmail(value) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
}

function normalizeDigitsOnlyInput(value, maxLength) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

function normalizeBirthTimeInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;

  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function isValidBirthTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);

  if (hour < 0 || hour > 24) return false;
  if (minute < 0 || minute > 59) return false;
  if (hour === 24 && minute !== 0) return false;
  return true;
}

function validateBirthInput({ year, month, day, birthTime, calendarType, unknownTime }) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return "년은 1900~2100 사이여야 합니다.";
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "월은 1~12 사이여야 합니다.";
  }

  const maxDay = calendarType === "lunar" ? 30 : 31;
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    return `일은 ${calendarType === "lunar" ? "음력 기준 1~30" : "1~31"} 사이여야 합니다.`;
  }

  if (!unknownTime && !isValidBirthTime(birthTime)) {
    return "태어난 시간을 올바르게 입력해 주세요.";
  }

  return null;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function formatPhoneForInput(value) {
  const digits = normalizePhone(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function fillDraft() {
  const draft = loadBirthDraft();
  if (!draft) return;

  $("signupCalendar").value = draft.calendar || "solar";
  $("signupLeapMonth").checked = Boolean(draft.leapMonth);
  $("signupYear").value = draft.year || "";
  $("signupMonth").value = draft.month || "";
  $("signupDay").value = draft.day || "";
  $("signupBirthTime").value = draft.birthTime || "";
  $("signupUnknownTime").checked = Boolean(draft.unknownTime);
}

function updateLunarState() {
  const calendarEl = $("signupCalendar");
  const leapEl = $("signupLeapMonth");
  const isLunar = calendarEl.value === "lunar";
  leapEl.disabled = !isLunar;
  if (!isLunar) leapEl.checked = false;
}

function updateBirthTimeState() {
  const birthTimeEl = $("signupBirthTime");
  const unknownTimeEl = $("signupUnknownTime");
  const feedbackEl = $("signupTimeFeedback");

  if (unknownTimeEl.checked) {
    birthTimeEl.value = "";
    birthTimeEl.disabled = true;
    birthTimeEl.placeholder = "시간 모름";
    feedbackEl.classList.add("hidden");
    return;
  }

  birthTimeEl.disabled = false;
  birthTimeEl.placeholder = "00:00";
  birthTimeEl.value = normalizeBirthTimeInput(birthTimeEl.value);
  feedbackEl.classList.toggle("hidden", isValidBirthTime(birthTimeEl.value));
}

function resolveRedirect(fallbackPath) {
  const next = new URLSearchParams(window.location.search).get("next");
  const fallbackUrl = new URL(fallbackPath, window.location.href);

  if (!next) return fallbackUrl.toString();

  try {
    const targetUrl = new URL(next, window.location.href);
    if (targetUrl.origin !== window.location.origin) return fallbackUrl.toString();
    return targetUrl.toString();
  } catch {
    return fallbackUrl.toString();
  }
}

const homePath = document.body.dataset.linkHome || "../";
const signInPath = document.body.dataset.linkSignin || "../signin/";

initCommonPageTracking();
setupAuthUi();
trackEvent("signup_view", {
  page_name: "signup",
});

fillDraft();
updateLunarState();
updateBirthTimeState();

if (!isSupabaseConfigured()) {
  $("signupConfigError")?.classList.remove("hidden");
}

["signupYear", "signupMonth", "signupDay"].forEach((id) => {
  const input = $(id);
  const maxLength = id === "signupYear" ? 4 : 2;
  input?.addEventListener("input", () => {
    input.value = normalizeDigitsOnlyInput(input.value, maxLength);
  });
});

$("signupBirthTime")?.addEventListener("input", (event) => {
  event.target.value = normalizeBirthTimeInput(event.target.value);
  updateBirthTimeState();
});

$("signupPhone")?.addEventListener("input", (event) => {
  event.target.value = formatPhoneForInput(event.target.value);
});

$("signupCalendar")?.addEventListener("change", () => {
  updateLunarState();
});

$("signupUnknownTime")?.addEventListener("change", () => {
  updateBirthTimeState();
});

getSession()
  .then((session) => {
    if (session) {
      window.location.replace(resolveRedirect(homePath));
    }
  })
  .catch(() => {});

$("signupForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const errorEl = $("signupError");
  const statusEl = $("signupStatus");

  errorEl.textContent = "";
  statusEl.textContent = "";

  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const confirmPassword = $("signupPasswordConfirm").value;
  const fullName = $("signupName").value.trim();
  const gender = $("signupGender").value.trim();
  const calendarType = $("signupCalendar").value;
  const isLeapMonth = $("signupLeapMonth").checked;
  const birthYear = Number($("signupYear").value);
  const birthMonth = Number($("signupMonth").value);
  const birthDay = Number($("signupDay").value);
  const birthTime = $("signupBirthTime").value.trim();
  const birthTimeKnown = !$("signupUnknownTime").checked;
  const phoneInput = $("signupPhone").value.trim();
  const marketingOptIn = $("signupMarketing").checked;

  if (!isValidEmail(email)) {
    errorEl.textContent = "올바른 이메일 주소를 입력해 주세요.";
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = "비밀번호는 6자 이상이어야 합니다.";
    return;
  }

  if (password !== confirmPassword) {
    errorEl.textContent = "비밀번호 확인이 일치하지 않습니다.";
    return;
  }

  if (fullName.length < 2) {
    errorEl.textContent = "이름은 2글자 이상 입력해 주세요.";
    return;
  }

  if (!["male", "female"].includes(gender)) {
    errorEl.textContent = "성별을 선택해 주세요.";
    return;
  }

  const birthError = validateBirthInput({
    year: birthYear,
    month: birthMonth,
    day: birthDay,
    birthTime,
    calendarType,
    unknownTime: !birthTimeKnown,
  });

  if (birthError) {
    errorEl.textContent = birthError;
    return;
  }

  const normalizedPhone = normalizePhone(phoneInput);
  if (normalizedPhone && normalizedPhone.length < 9) {
    errorEl.textContent = "전화번호는 숫자 기준 9자리 이상 입력해 주세요.";
    return;
  }

  const [birthHour, birthMinute] = birthTimeKnown
    ? birthTime.split(":").map(Number)
    : [null, null];

  const birthDraft = {
    calendar: calendarType,
    leapMonth: calendarType === "lunar" ? isLeapMonth : false,
    year: String(birthYear),
    month: String(birthMonth),
    day: String(birthDay),
    birthTime: birthTimeKnown ? birthTime : "",
    unknownTime: !birthTimeKnown,
  };

  saveBirthDraft(birthDraft);

  trackEvent("signup_submit", {
    page_name: "signup",
  });

  try {
    statusEl.textContent = "가입 처리 중...";

    const data = await signUpWithPassword({
      email,
      password,
      emailRedirectTo: new URL(signInPath, window.location.href).toString(),
      profile: {
        full_name: fullName,
        gender,
        phone: normalizedPhone,
        calendar_type: calendarType,
        is_leap_month: calendarType === "lunar" ? isLeapMonth : false,
        birth_year: birthYear,
        birth_month: birthMonth,
        birth_day: birthDay,
        birth_hour: birthTimeKnown ? birthHour : "",
        birth_minute: birthTimeKnown ? birthMinute : "",
        birth_time_known: birthTimeKnown,
        marketing_opt_in: marketingOptIn,
      },
    });

    if (data.session) {
      window.location.replace(resolveRedirect(homePath));
      return;
    }

    statusEl.textContent = "가입이 완료되었습니다. 메일함에서 인증 후 로그인해 주세요.";
    setTimeout(() => {
      window.location.replace(new URL(signInPath, window.location.href).toString());
    }, 1600);
  } catch (error) {
    errorEl.textContent = error.message || "회원가입에 실패했습니다.";
    statusEl.textContent = "";
  }
});
