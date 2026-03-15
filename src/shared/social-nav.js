import { trackEvent } from "./analytics.js";
import { escapeHtml } from "./html.js";
import { getBellIcon, setupNotificationCenter } from "./notifications.js";
import { buildAccountUrl, buildFollowingUrl, buildPublicProfileUrl, buildSearchUrl } from "./stellar-id.js";
import { signOut } from "./auth.js";

function getBrandMarkup(stellarId, pageTitle, showProfileIdentity) {
  const safeStellarId = stellarId ? escapeHtml(String(stellarId)) : "";

  return `
    <div class="social-brand">
      <a class="social-brand-logo-link" href="#" data-social-home aria-label="스텔라 ID 홈">
        <span class="social-brand-logo" aria-hidden="true">
          <img src="/src/img/bi/symbol-stellarid.png" alt="" />
        </span>
      </a>
      <span class="social-brand-copy">
        <a class="social-brand-name social-brand-home-link" href="#" data-social-home>${escapeHtml(pageTitle || "스텔라 ID")}</a>
        ${showProfileIdentity
          ? `
            <span class="social-brand-meta">
              <span class="social-brand-label">STELLAR-ID</span>
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

function getBackIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.78 5.47a1.25 1.25 0 0 1 0 1.77L10.02 12l4.76 4.76a1.25 1.25 0 0 1-1.77 1.77l-5.64-5.64a1.25 1.25 0 0 1 0-1.77l5.64-5.64a1.25 1.25 0 0 1 1.77 0Z" fill="currentColor"/>
    </svg>
  `;
}

function getAvatarMarkup(profile) {
  if (profile?.profile_image_url) {
    return `<img src="${escapeHtml(profile.profile_image_url)}" alt="" />`;
  }

  return `<span>${escapeHtml(String(profile?.full_name || "스").charAt(0))}</span>`;
}

export function renderSocialNav(container, {
  variant = "profile",
  session,
  viewerProfile,
  currentStellarId = null,
  pageTitle = "스텔라 ID",
  searchTitle = "스텔라 프로필 검색",
  showProfileIdentity = false,
}) {
  if (!container) return () => {};

  const homeUrl = buildPublicProfileUrl(viewerProfile?.stellar_id);
  const searchUrl = buildSearchUrl();
  const followingUrl = buildFollowingUrl();
  const accountUrl = buildAccountUrl(session?.user?.id || null);

  container.innerHTML = `
    <div class="social-topbar">
      <div class="social-topbar-left">
        ${variant === "search"
          ? `
            <button class="social-icon-button" type="button" data-social-back aria-label="이전 페이지로 이동">
              ${getBackIcon()}
            </button>
            <div class="social-page-title">${escapeHtml(searchTitle)}</div>
          `
          : getBrandMarkup(currentStellarId || viewerProfile?.stellar_id, pageTitle, showProfileIdentity)}
      </div>
      <div class="social-topbar-right">
        <a class="social-icon-button" href="${escapeHtml(searchUrl)}" aria-label="스텔라 프로필 검색">
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
            <a class="social-profile-panel-link" href="${escapeHtml(homeUrl)}">내 스텔라 프로필</a>
            <a class="social-profile-panel-link" href="${escapeHtml(followingUrl)}">팔로잉 프로필</a>
            <span class="social-profile-divider" aria-hidden="true"></span>
            <a class="social-profile-panel-link" href="${escapeHtml(accountUrl)}">계정 정보</a>
            <button class="social-profile-panel-link social-profile-panel-button" type="button" data-social-logout>로그아웃</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const menu = container.querySelector("[data-social-menu]");
  const toggle = container.querySelector("[data-social-toggle]");
  const backButton = container.querySelector("[data-social-back]");
  const logoutButton = container.querySelector("[data-social-logout]");
  const notificationButton = container.querySelector("[data-notification-toggle]");
  const notificationCleanup = setupNotificationCenter(notificationButton);

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

  container.querySelectorAll("[data-social-home]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = homeUrl;
    });
  });

  backButton?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = homeUrl;
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

  return () => {
    notificationCleanup?.();
    document.removeEventListener("click", handleDocumentClick);
  };
}
