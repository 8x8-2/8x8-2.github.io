import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  changePassword,
  getSession,
  isSupabaseConfigured,
} from "./shared/auth.js";
import { setupAuthUi } from "./shared/auth-ui.js";

function $(id) {
  return document.getElementById(id);
}

function buildProfileUrl(userId, { passwordChanged = false } = {}) {
  const url = new URL(document.body.dataset.linkProfile || "../../p/", window.location.href);
  url.searchParams.set("user_id", userId);
  if (passwordChanged) {
    url.searchParams.set("password_changed", "1");
  }
  return url.toString();
}

function buildPasswordUrl(userId) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("user_id", userId);
  return url.toString();
}

function setGuestLinks() {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  $("passwordGuestSignin").href = `${document.body.dataset.linkSignin || "../../signin/"}?next=${encodeURIComponent(currentPath)}`;
  $("passwordGuestSignup").href = `${document.body.dataset.linkSignup || "../../signup/"}?next=${encodeURIComponent(currentPath)}`;
}

async function init() {
  initCommonPageTracking();
  setupAuthUi();
  setGuestLinks();

  trackEvent("password_view", {
    page_name: "password",
  });

  if (!isSupabaseConfigured()) {
    $("passwordConfigError").classList.remove("hidden");
    return;
  }

  const session = await getSession();
  if (!session) {
    $("passwordGuest").classList.remove("hidden");
    return;
  }

  const requestedUserId = new URLSearchParams(window.location.search).get("user_id");
  if (requestedUserId !== session.user.id) {
    window.location.replace(buildPasswordUrl(session.user.id));
    return;
  }

  $("passwordSection").classList.remove("hidden");
  $("passwordBackLink").href = buildProfileUrl(session.user.id);

  $("passwordForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const errorEl = $("passwordError");
    const statusEl = $("passwordStatus");
    errorEl.textContent = "";
    statusEl.textContent = "";

    const currentPassword = $("currentPassword").value;
    const newPassword = $("newPassword").value;
    const confirmPassword = $("newPasswordConfirm").value;

    if (!currentPassword) {
      errorEl.textContent = "현재 암호를 입력해 주세요.";
      return;
    }

    if (newPassword.length < 6) {
      errorEl.textContent = "새 암호는 6자 이상이어야 합니다.";
      return;
    }

    if (newPassword !== confirmPassword) {
      errorEl.textContent = "새 암호 확인이 일치하지 않습니다.";
      return;
    }

    if (newPassword === currentPassword) {
      errorEl.textContent = "현재 암호와 다른 새 암호를 입력해 주세요.";
      return;
    }

    try {
      statusEl.textContent = "암호 변경 중...";
      await changePassword({
        currentPassword,
        newPassword,
      });

      trackEvent("password_update_success", {
        page_name: "password",
      });

      window.location.replace(buildProfileUrl(session.user.id, { passwordChanged: true }));
    } catch (error) {
      errorEl.textContent = error.message || "암호를 변경하지 못했습니다.";
      statusEl.textContent = "";
    }
  });
}

init().catch((error) => {
  $("passwordPageError").textContent = error.message || "암호 변경 페이지를 불러오지 못했습니다.";
});
