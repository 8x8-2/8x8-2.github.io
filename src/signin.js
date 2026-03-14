import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  getSession,
  isSupabaseConfigured,
  signInWithPassword,
} from "./shared/auth.js";
import { setupAuthUi } from "./shared/auth-ui.js";

function $(id) {
  return document.getElementById(id);
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

function isValidEmail(value) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
}

const form = $("signinForm");
const emailEl = $("signinEmail");
const passwordEl = $("signinPassword");
const errorEl = $("signinError");
const statusEl = $("signinStatus");
const configEl = $("signinConfigError");
const homePath = document.body.dataset.linkHome || "../";

initCommonPageTracking();
setupAuthUi();
trackEvent("signin_view", {
  page_name: "signin",
});

if (!isSupabaseConfigured() && configEl) {
  configEl.classList.remove("hidden");
}

getSession()
  .then((session) => {
    if (session) {
      window.location.replace(resolveRedirect(homePath));
    }
  })
  .catch(() => {});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";
  statusEl.textContent = "";

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!isValidEmail(email)) {
    errorEl.textContent = "올바른 이메일 주소를 입력해 주세요.";
    return;
  }

  if (!password) {
    errorEl.textContent = "비밀번호를 입력해 주세요.";
    return;
  }

  trackEvent("signin_submit", {
    page_name: "signin",
  });

  try {
    statusEl.textContent = "로그인 중...";
    await signInWithPassword({ email, password });
    window.location.replace(resolveRedirect(homePath));
  } catch (error) {
    errorEl.textContent = error.message || "로그인에 실패했습니다.";
    statusEl.textContent = "";
  }
});
