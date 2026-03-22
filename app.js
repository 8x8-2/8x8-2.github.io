import { initCommonPageTracking, trackEvent } from "./src/shared/analytics.js";
import {
  fetchProfile,
  isSupabaseConfigured,
  saveReading,
  subscribeAuthState,
  upsertSharedReading,
} from "./src/shared/auth.js";
import {
  bindDigitsOnlyInput,
  isValidBirthTime,
  normalizeBirthTimeInput,
} from "./src/shared/birth.js";
import { setupAuthUi } from "./src/shared/auth-ui.js";
import {
  buildReadingSharePayload,
  buildShareUrl,
  shareLink,
} from "./src/shared/share.js";
import { buildSignedInHomeUrl } from "./src/shared/stellar-id.js";
import {
  buildSharedReadingPayload,
  buildStoredReadingPayload,
  calculateReadingSnapshot,
  getReadingPreviewSummary,
} from "./src/shared/reading.js";
import {
  getReadingRenderElements,
  renderReadingSnapshot,
} from "./src/shared/reading-renderer.js";
import {
  consumeHomeAutoRun,
  loadBirthDraft,
  requestHomeAutoRun,
  saveBirthDraft,
} from "./src/shared/drafts.js";
import {
  closeModal,
  openModal,
  setupScrollTopButton,
} from "./src/shared/ui.js";

const $ = (id) => document.getElementById(id);

const calendarEl = $("calendar");
const leapEl = $("leapMonth");
const nameEl = $("homeName");
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
const resultPreviewGateEl = $("resultPreviewGate");
const saveReadingButtonEl = $("saveReadingButton");
const shareReadingButtonEl = $("shareReadingButton");
const previewSignupLinkEl = $("previewSignupLink");
const previewSigninLinkEl = $("previewSigninLink");
const saveReadingModalEl = $("saveReadingModal");
const saveReadingFormEl = $("saveReadingForm");
const saveEntryNameEl = $("saveEntryName");
const saveEntryMemoEl = $("saveEntryMemo");
const saveReadingStatusEl = $("saveReadingStatus");
const saveReadingErrorEl = $("saveReadingError");
const scrollTopButtonEl = $("scrollTopButton");

const readingElements = getReadingRenderElements(document);

let currentSession = null;
let lastRenderedReading = null;
let shouldAutoRunAfterAuth = consumeHomeAutoRun();
let signedInHomeRedirectPending = false;

function getBirthDraftFromForm() {
  return {
    name: nameEl?.value.trim() || "",
    calendar: calendarEl.value,
    leapMonth: leapEl.checked,
    gender: genderEl.value,
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

  if (nameEl) {
    nameEl.value = draft.name || nameEl.value;
  }
  calendarEl.value = draft.calendar || calendarEl.value;
  leapEl.checked = Boolean(draft.leapMonth);
  genderEl.value = draft.gender || genderEl.value;
  yearEl.value = draft.year || yearEl.value;
  monthEl.value = draft.month || monthEl.value;
  dayEl.value = draft.day || dayEl.value;
  birthTimeEl.value = draft.birthTime || "";
  unknownTimeEl.checked = Boolean(draft.unknownTime);
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
    timeFeedbackEl.textContent = "올바른 시간을 입력해 주세요.";
    timeFeedbackEl.classList.add("hidden");
    btn.disabled = false;
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

function updateResultAccessState() {
  const hasReading = Boolean(lastRenderedReading);
  const loggedIn = Boolean(currentSession);
  const shouldLock = hasReading && !loggedIn;

  resultEl.classList.toggle("is-preview-locked", shouldLock);
  resultPreviewGateEl?.classList.toggle("hidden", !shouldLock);
  saveReadingButtonEl?.classList.toggle("hidden", !hasReading || !loggedIn || !isSupabaseConfigured());
  shareReadingButtonEl?.classList.toggle("hidden", !hasReading || !loggedIn || !isSupabaseConfigured());
}

async function redirectSignedInHome(session) {
  if (!session?.user || signedInHomeRedirectPending) return;
  signedInHomeRedirectPending = true;

  try {
    const profile = await fetchProfile(session.user.id, {
      allowRepair: false,
      allowSessionFallback: true,
    }).catch(() => null);

    const targetUrl = new URL(buildSignedInHomeUrl(session, profile), window.location.href);
    const currentUrl = new URL(window.location.href);
    const sameRoute = targetUrl.pathname === currentUrl.pathname
      && targetUrl.search === currentUrl.search;

    if (sameRoute) {
      signedInHomeRedirectPending = false;
      return;
    }

    window.location.replace(targetUrl.toString());
  } catch {
    signedInHomeRedirectPending = false;
  }
}

function openSaveReadingModal() {
  if (!lastRenderedReading || !currentSession) return;

  saveReadingErrorEl.textContent = "";
  saveReadingStatusEl.textContent = "";
  saveEntryMemoEl.value = "";
  saveEntryNameEl.value = saveEntryNameEl.value.trim() || currentSession.user.user_metadata?.full_name || "나의 사주";
  openModal(saveReadingModalEl);
}

function closeSaveReadingModal() {
  closeModal(saveReadingModalEl);
}

async function handleShareCurrentReading() {
  if (!lastRenderedReading || !currentSession) return;

  const sourceName = currentSession.user.user_metadata?.full_name || "공유한 사주";
  const previousLabel = shareReadingButtonEl.textContent;

  shareReadingButtonEl.disabled = true;
  shareReadingButtonEl.textContent = "공유 링크 준비 중...";

  try {
    const sharedReading = await upsertSharedReading(
      buildSharedReadingPayload(lastRenderedReading, {
        sourceType: "draft",
        entryName: `${sourceName}의 사주`,
        memo: "",
      })
    );

    const url = buildShareUrl(sharedReading.share_token);
    const sharePayload = buildReadingSharePayload({
      entryName: sharedReading.entry_name,
      dayPillarKey: lastRenderedReading.dayPillar.key,
      summary: getReadingPreviewSummary(lastRenderedReading),
      url,
    });

    await shareLink(sharePayload);

    trackEvent("reading_share_click", {
      page_name: "home",
      source_type: "draft",
      day_pillar_name: lastRenderedReading.dayPillar.key,
    });
  } catch (error) {
    window.alert(error.message || "공유 링크를 준비하지 못했습니다.");
  } finally {
    shareReadingButtonEl.disabled = false;
    shareReadingButtonEl.textContent = previousLabel;
  }
}

function render(snapshot) {
  renderReadingSnapshot(readingElements, snapshot);
  lastRenderedReading = snapshot;
  updateResultAccessState();
  resultEl.classList.remove("hidden");
}

function scrollToResult() {
  if (!resultEl) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  window.requestAnimationFrame(() => {
    resultEl.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
}

function validateInput({ year, month, day, birthTime, isLunar, unknownTime }) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return "년은 1900~2100 사이여야 합니다.";
  if (!Number.isInteger(month) || month < 1 || month > 12) return "월은 1~12 사이여야 합니다.";

  const maxDay = isLunar ? 30 : 31;
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return `일은 ${isLunar ? "음력 기준 1~30" : "1~31"} 사이여야 합니다.`;
  if (!unknownTime && !isValidBirthTime(birthTime)) return "올바른 시간을 입력해 주세요.";

  return null;
}

initCommonPageTracking();
setupAuthUi();
setupScrollTopButton(scrollTopButtonEl);
trackEvent("home_view", {
  page_name: "home",
});

bindDigitsOnlyInput(yearEl, 4);
bindDigitsOnlyInput(monthEl, 2);
bindDigitsOnlyInput(dayEl, 2);

applyBirthDraftToForm();
updateCalendarState();
updateBirthTimeState();

calendarEl.addEventListener("change", updateCalendarState);

birthTimeEl.addEventListener("input", (event) => {
  event.target.value = normalizeBirthTimeInput(event.target.value);
  updateBirthTimeState();
});

birthTimeEl.addEventListener("blur", () => {
  updateBirthTimeState();
});

unknownTimeEl.addEventListener("change", updateBirthTimeState);

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

shareReadingButtonEl?.addEventListener("click", () => {
  handleShareCurrentReading();
});

document.querySelectorAll("[data-save-close]").forEach((button) => {
  button.addEventListener("click", closeSaveReadingModal);
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

    await saveReading(
      buildStoredReadingPayload(lastRenderedReading, {
        entryName,
        memo,
      })
    );

    trackEvent("reading_save_success", {
      page_name: "home",
      day_pillar_name: lastRenderedReading.dayPillar.key,
    });

    saveReadingStatusEl.textContent = "저장되었습니다.";
    window.setTimeout(() => {
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

  if (session?.user) {
    redirectSignedInHome(session);
  }

  if (session && shouldAutoRunAfterAuth) {
    shouldAutoRunAfterAuth = false;
    window.setTimeout(() => {
      btn.click();
    }, 0);
  }
});

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
    const year = Number(yearEl.value);
    const month = Number(monthEl.value);
    const day = Number(dayEl.value);
    const unknownTime = unknownTimeEl.checked;
    const birthTime = birthTimeEl.value.trim();

    const validationError = validateInput({
      year,
      month,
      day,
      birthTime,
      isLunar,
      unknownTime,
    });

    if (validationError) {
      throw new Error(validationError);
    }

    saveBirthDraft(getBirthDraftFromForm());

    const [hour, minute] = unknownTime ? [null, null] : birthTime.split(":").map(Number);

    statusEl.textContent = "프로필 초안 준비 중...";

    const snapshot = calculateReadingSnapshot({
      year,
      month,
      day,
      hour,
      minute,
      isLunar,
      isLeapMonth,
      gender,
      unknownTime,
    });

    render(snapshot);
    scrollToResult();

    trackEvent("saju_calculation_success", {
      calendar_type: isLunar ? "lunar" : "solar",
      birth_time_known: unknownTime ? "no" : "yes",
    });

    updateBirthTimeState();
    statusEl.textContent = "초안 준비 완료";
  } catch (error) {
    errEl.textContent = error?.message || "오류가 발생했습니다.";
    updateBirthTimeState();
  } finally {
    if (!unknownTimeEl.checked && isValidBirthTime(birthTimeEl.value.trim())) {
      btn.disabled = false;
    }

    if (unknownTimeEl.checked) {
      btn.disabled = false;
    }
  }
});
