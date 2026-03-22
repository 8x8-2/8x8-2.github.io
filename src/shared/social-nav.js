import { trackEvent } from "./analytics.js";
import { escapeHtml } from "./html.js";
import { getBellIcon, setupNotificationCenter } from "./notifications.js";
import { buildAccountUrl, buildFollowingUrl, buildSearchUrl, buildSignedInHomeUrl } from "./stellar-id.js";
import { signOut } from "./auth.js";
import symbolStellarIdUrl from "../img/bi/symbol-stellarid.png";

function getBrandMarkup(stellarId, showProfileIdentity) {
  const safeStellarId = stellarId ? escapeHtml(String(stellarId)) : "";

  return `
    <div class="social-brand">
      <a class="social-brand-logo-link" href="#" data-social-home aria-label="스텔라 ID 홈">
        <span class="social-brand-logo" aria-hidden="true">
          <img src="${symbolStellarIdUrl}" alt="" />
        </span>
      </a>
      <span class="social-brand-copy">
        <a class="social-brand-name social-brand-home-link" href="#" data-social-home>STELLAR-ID</a>
        ${showProfileIdentity
          ? `
            <span class="social-brand-meta">
              <span class="social-brand-label">stellar-id.com</span>
              <span class="social-brand-slash">/</span>
              ${safeStellarId
                ? `<a class="social-brand-id social-brand-home-link" href="#" data-social-home>${safeStellarId}</a>`
                : ""
              }
            </span>
          `
          : ""
        }
      </span>
    </div>
  `;
}

function getSearchIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.75 2a8.75 8.75 0 1 0 5.366 15.66l3.75 3.75a1.25 1.25 0 1 0 1.768-1.767l-3.75-3.75A8.75 8.75 0 0 0 10.75 2Zm0 2.5a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Z" fill="currentColor"/>
    </svg>
  `;
}

function getAvatarMarkup(profile) {
  if (profile?.profile_image_url) {
    return `<img src="${escapeHtml(profile.profile_image_url)}" alt="" />`;
  }

  return `<span>${escapeHtml(String(profile?.full_name || "STELLAR-ID").charAt(0))}</span>`;
}

function buildHomeUrl(session, viewerProfile, homeUrlOverride) {
  if (homeUrlOverride) {
    return homeUrlOverride;
  }

  if (session?.user?.id) {
    return buildSignedInHomeUrl(session, viewerProfile);
  }

  return new URL(document.body.dataset.linkHome || "/", window.location.href).toString();
}

function buildSigninUrl() {
  const url = new URL(document.body.dataset.linkSignin || "./signin/", window.location.href);
  url.searchParams.set("next", `${window.location.pathname}${window.location.search}${window.location.hash}`);
  return url.toString();
}

export function renderSocialNav(container, {
  authStatus = null,
  session,
  viewerProfile,
  currentStellarId = null,
  showProfileIdentity = false,
  homeUrlOverride = null,
  hideGuestSignin = false,
}) {
  if (!container) return () => {};

  const existingCleanup = typeof container.__stellarNavCleanup === "function"
    ? container.__stellarNavCleanup
    : null;

  if (existingCleanup) {
    container.__stellarNavCleanup = null;
    existingCleanup();
  }

  const homeUrl = buildHomeUrl(session, viewerProfile, homeUrlOverride);
  const signinUrl = buildSigninUrl();
  const searchUrl = buildSearchUrl();
  const followingUrl = buildFollowingUrl();
  const accountUrl = buildAccountUrl(session?.user?.id || null);
  const showAuthLoadingPlaceholder = !session && ["unknown", "loading"].includes(String(authStatus || ""));

  container.innerHTML = `
    <div class="social-topbar">
      <div class="social-topbar-left">
        ${getBrandMarkup(currentStellarId || viewerProfile?.stellar_id, showProfileIdentity)}
      </div>
      <div class="social-topbar-right">
        ${session
          ? `
            <a class="social-icon-button" href="${escapeHtml(searchUrl)}" aria-label="STELLAR-ID">
              ${getSearchIcon()}
            </a>
            <button class="social-icon-button notification-button" type="button" aria-label="알림센터 열기" aria-haspopup="dialog" aria-expanded="false" data-notification-toggle>
              ${getBellIcon()}
              <span class="notification-dot" data-notification-dot aria-hidden="true"></span>
            </button>
            <div class="social-profile-menu" data-social-menu>
              <button class="social-avatar-button" type="button" data-social-toggle aria-haspopup="menu" aria-expanded="false" aria-label="프로필 메뉴 열기">
                ${getAvatarMarkup(viewerProfile)}
              </button>
              <div class="social-profile-panel" role="menu" data-social-panel>
                <a class="social-profile-panel-link" href="${escapeHtml(homeUrl)}">내 프로필</a>
                <a class="social-profile-panel-link" href="${escapeHtml(followingUrl)}">팔로잉 프로필</a>
                <span class="social-profile-divider" aria-hidden="true"></span>
                <a class="social-profile-panel-link" href="${escapeHtml(accountUrl)}">계정 정보</a>
                <button class="social-profile-panel-link social-profile-panel-button" type="button" data-social-logout>로그아웃</button>
              </div>
            </div>
          `
          : hideGuestSignin
            ? ""
            : showAuthLoadingPlaceholder
            ? `<span class="social-auth-placeholder" aria-hidden="true"></span>`
            : `<a class="topbar-auth-link" href="${escapeHtml(signinUrl)}" data-auth-action="signin">로그인</a>`
        }
      </div>
    </div>
  `;

  const menu = container.querySelector("[data-social-menu]");
  const toggle = container.querySelector("[data-social-toggle]");
  const logoutButton = container.querySelector("[data-social-logout]");
  const notificationButton = container.querySelector("[data-notification-toggle]");
  const signinLink = container.querySelector("[data-auth-action='signin']");
  const notificationCleanup = notificationButton ? setupNotificationCenter(notificationButton) : null;

  const closeMenu = () => {
    menu?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  };

  const handleDocumentClick = (event) => {
    if (!menu?.contains(event.target)) {
      closeMenu();
    }
  };

  document.addEventListener("click", handleDocumentClick);

  toggle?.addEventListener("click", () => {
    const opened = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", opened ? "true" : "false");
  });

  signinLink?.addEventListener("click", () => {
    trackEvent("signin_click", {
      source: "top_nav",
      page_name: document.body.dataset.pageName || "",
    });
  });

  container.querySelectorAll("[data-social-home]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = homeUrl;
    });
  });

  logoutButton?.addEventListener("click", async () => {
    try {
      await signOut();
      trackEvent("signout_click", {
        page_name: document.body.dataset.pageName || "",
      });
      window.location.href = new URL(document.body.dataset.linkHome || "/", window.location.href).toString();
    } catch (error) {
      window.alert(error.message || "로그아웃에 실패했습니다.");
    }
  });

  const cleanup = () => {
    notificationCleanup?.();
    document.removeEventListener("click", handleDocumentClick);
    if (container.__stellarNavCleanup === cleanup) {
      container.__stellarNavCleanup = null;
    }
  };

  container.__stellarNavCleanup = cleanup;
  return cleanup;
}
