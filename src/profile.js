import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  buildSessionProfileStub,
  fetchProfile,
  getSession,
  isSupabaseConfigured,
  updateProfile,
} from "./shared/auth.js";
import {
  bindDigitsOnlyInput,
  formatBirthDisplay,
  formatGenderLabel,
  formatPhoneForInput,
  hasKnownBirthTime,
  isValidBirthTime,
  normalizeBirthTimeInput,
  normalizePhone,
  validateBirthInput,
} from "./shared/birth.js";
import { escapeHtml } from "./shared/html.js";
import { renderSocialNav } from "./shared/social-nav.js";
import { showToast } from "./shared/ui.js";

function $(id) {
  return document.getElementById(id);
}

function buildProfileUrl(userId, extraParams = {}) {
  const url = new URL(document.body.dataset.linkProfile || "./", window.location.href);
  url.searchParams.set("user_id", userId);

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value == null || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function buildPasswordUrl(userId) {
  const url = new URL(document.body.dataset.linkPassword || "../account/password/", window.location.href);
  url.searchParams.set("user_id", userId);
  return url.toString();
}

function setGuestLinks() {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  $("profileGuestSignin").href = `${document.body.dataset.linkSignin || "../signin/"}?next=${encodeURIComponent(currentPath)}`;
  $("profileGuestSignup").href = `${document.body.dataset.linkSignup || "../signup/"}?next=${encodeURIComponent(currentPath)}`;
}

function renderGuestNav() {
  renderSocialNav(document.querySelector("[data-social-nav]"), {
    session: null,
    viewerProfile: null,
    pageTitle: "계정 정보",
  });
}

function updateCalendarState() {
  const isLunar = $("profileCalendar").value === "lunar";
  $("profileLeapMonth").disabled = !isLunar;
  if (!isLunar) {
    $("profileLeapMonth").checked = false;
  }
}

function updateBirthTimeState() {
  const birthTimeEl = $("profileBirthTime");
  const unknownTimeEl = $("profileUnknownTime");
  const feedbackEl = $("profileTimeFeedback");

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

function fillProfileSummary(profile, session) {
  $("profileSummary").innerHTML = `
    <div class="profile-summary-grid">
      <div class="box profile-summary-box">
        <div class="title">이름</div>
        <div class="text">${escapeHtml(profile.full_name)}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">이메일(ID)</div>
        <div class="text">${escapeHtml(session.user.email || "")}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">성별</div>
        <div class="text">${escapeHtml(formatGenderLabel(profile.gender))}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">전화번호</div>
        <div class="text">${escapeHtml(profile.phone ? formatPhoneForInput(profile.phone) : "미입력")}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">생년월일시</div>
        <div class="text">${escapeHtml(formatBirthDisplay(profile, { includeCalendar: true }))}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">마케팅 수신 동의</div>
        <div class="text">${profile.marketing_opt_in ? "동의함" : "동의 안 함"}</div>
      </div>
    </div>
  `;
}

function fillEditForm(profile) {
  const birthTimeKnown = hasKnownBirthTime(profile);

  $("profileName").value = profile.full_name || "";
  $("profileGender").value = profile.gender || "male";
  $("profilePhone").value = formatPhoneForInput(profile.phone || "");
  $("profileCalendar").value = profile.calendar_type || "solar";
  $("profileLeapMonth").checked = Boolean(profile.is_leap_month);
  $("profileYear").value = String(profile.birth_year || "");
  $("profileMonth").value = String(profile.birth_month || "");
  $("profileDay").value = String(profile.birth_day || "");
  $("profileUnknownTime").checked = !birthTimeKnown;
  $("profileBirthTime").value = birthTimeKnown
    ? `${String(profile.birth_hour ?? 0).padStart(2, "0")}:${String(profile.birth_minute ?? 0).padStart(2, "0")}`
    : "";
  $("profileMarketing").checked = Boolean(profile.marketing_opt_in);

  updateCalendarState();
  updateBirthTimeState();
}

function setEditMode(active) {
  $("profileEditCard").classList.toggle("hidden", !active);
  $("profileEditButton").classList.toggle("hidden", active);
}

function consumeToastFromUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("password_changed") !== "1") return;

  showToast("새롭게 암호가 변경되었습니다.");
  url.searchParams.delete("password_changed");
  window.history.replaceState({}, "", url.toString());
}

async function init() {
  initCommonPageTracking();
  setGuestLinks();
  trackEvent("profile_view", {
    page_name: "profile",
  });

  if (!isSupabaseConfigured()) {
    $("profileConfigError").classList.remove("hidden");
    return;
  }

  const session = await getSession();
  if (!session) {
    renderGuestNav();
    $("profileGuest").classList.remove("hidden");
    return;
  }

  const requestedUserId = new URLSearchParams(window.location.search).get("user_id");
  if (requestedUserId !== session.user.id) {
    window.location.replace(buildProfileUrl(session.user.id));
    return;
  }

  const navContainer = document.querySelector("[data-social-nav]");
  const sessionProfileStub = buildSessionProfileStub(session);
  let navCleanup = renderSocialNav(navContainer, {
    session,
    viewerProfile: sessionProfileStub,
    currentStellarId: sessionProfileStub?.stellar_id,
    pageTitle: "계정 정보",
  });

  let currentProfile = await fetchProfile(session.user.id, {
    allowSessionFallback: true,
  }) || sessionProfileStub;

  if (!currentProfile) {
    throw new Error("내 정보를 불러오지 못했습니다.");
  }

  navCleanup?.();
  navCleanup = renderSocialNav(navContainer, {
    session,
    viewerProfile: currentProfile,
    currentStellarId: currentProfile.stellar_id,
    pageTitle: "계정 정보",
  });

  fillProfileSummary(currentProfile, session);
  fillEditForm(currentProfile);

  $("profileSection").classList.remove("hidden");
  $("profilePasswordLink").href = buildPasswordUrl(session.user.id);

  $("profileEditButton").addEventListener("click", () => {
    setEditMode(true);
  });

  $("profileEditCancel").addEventListener("click", () => {
    fillEditForm(currentProfile);
    $("profileError").textContent = "";
    $("profileStatus").textContent = "";
    setEditMode(false);
  });

  $("profileCalendar").addEventListener("change", updateCalendarState);
  $("profileUnknownTime").addEventListener("change", updateBirthTimeState);
  $("profileBirthTime").addEventListener("input", (event) => {
    event.target.value = normalizeBirthTimeInput(event.target.value);
    updateBirthTimeState();
  });
  $("profilePhone").addEventListener("input", (event) => {
    event.target.value = formatPhoneForInput(event.target.value);
  });

  ["profileYear", "profileMonth", "profileDay"].forEach((id) => {
    bindDigitsOnlyInput($(id), id === "profileYear" ? 4 : 2);
  });

  $("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const errorEl = $("profileError");
    const statusEl = $("profileStatus");
    errorEl.textContent = "";
    statusEl.textContent = "";

    const fullName = $("profileName").value.trim();
    const gender = $("profileGender").value;
    const calendarType = $("profileCalendar").value;
    const isLeapMonth = $("profileLeapMonth").checked;
    const birthYear = Number($("profileYear").value);
    const birthMonth = Number($("profileMonth").value);
    const birthDay = Number($("profileDay").value);
    const birthTime = $("profileBirthTime").value.trim();
    const birthTimeKnown = !$("profileUnknownTime").checked;
    const phone = normalizePhone($("profilePhone").value.trim());
    const marketingOptIn = Boolean($("profileMarketing").checked);

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

    if (phone && phone.length < 9) {
      errorEl.textContent = "전화번호는 숫자 기준 9자리 이상 입력해 주세요.";
      return;
    }

    const [birthHour, birthMinute] = birthTimeKnown
      ? birthTime.split(":").map(Number)
      : [null, null];

    try {
      statusEl.textContent = "저장 중...";

      currentProfile = await updateProfile({
        full_name: fullName,
        gender,
        phone,
        calendar_type: calendarType,
        is_leap_month: calendarType === "lunar" ? isLeapMonth : false,
        birth_year: birthYear,
        birth_month: birthMonth,
        birth_day: birthDay,
        birth_hour: birthTimeKnown ? birthHour : null,
        birth_minute: birthTimeKnown ? birthMinute : null,
        birth_time_known: birthTimeKnown,
        marketing_opt_in: marketingOptIn,
      });

      fillProfileSummary(currentProfile, session);
      fillEditForm(currentProfile);
      setEditMode(false);
      statusEl.textContent = "";
      showToast("내 정보가 저장되었습니다.");

      trackEvent("profile_update_success", {
        page_name: "profile",
        calendar_type: calendarType,
        birth_time_known: birthTimeKnown ? "yes" : "no",
      });
    } catch (error) {
      errorEl.textContent = error.message || "내 정보를 저장하지 못했습니다.";
      statusEl.textContent = "";
    }
  });

  consumeToastFromUrl();
}

init().catch((error) => {
  $("profilePageError").textContent = error.message || "내 정보 페이지를 불러오지 못했습니다.";
});
