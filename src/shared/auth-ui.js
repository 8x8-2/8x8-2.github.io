import { trackEvent } from "./analytics.js";
import {
  fetchProfile,
  getDisplayName,
  getProfileInitial,
  isSupabaseConfigured,
  signOut,
  subscribeAuthState,
} from "./auth.js";
import { escapeHtml } from "./html.js";
import { getBellIcon, setupNotificationCenter } from "./notifications.js";
import { buildAccountUrl, buildFollowingUrl, buildPublicProfileUrl, buildSearchUrl } from "./stellar-id.js";

function getPageMeta() {
  const body = document.body;
  const homeLink = body.dataset.linkHome || "./";
  const homeUrl = new URL(homeLink, window.location.href);

  return {
    pageName: body.dataset.pageName || "",
    links: {
      home: homeLink,
      soulday: body.dataset.linkSoulday || "./soulday/",
      signin: body.dataset.linkSignin || "./signin/",
      signup: body.dataset.linkSignup || "./signup/",
      profile: body.dataset.linkProfile || new URL("p/", homeUrl).toString(),
      saved: body.dataset.linkSaved || new URL("saved/", homeUrl).toString(),
    },
    authMode: body.dataset.authMode || "default",
  };
}

function buildUrl(path, withNext = false) {
  const url = new URL(path, window.location.href);
  if (withNext) {
    url.searchParams.set("next", `${window.location.pathname}${window.location.search}${window.location.hash}`);
  }
  return url.toString();
}

function buildProfileUrl(path, userId) {
  const url = new URL(path, window.location.href);
  if (userId) {
    url.searchParams.set("user_id", userId);
  }
  return url.toString();
}

function syncBrand(profile = null) {
  const brandLink = document.querySelector(".brand");
  const brandSubtitle = document.querySelector(".brand-subtitle");

  if (!brandLink) return;

  if (profile?.stellar_id) {
    brandLink.href = buildPublicProfileUrl(profile.stellar_id);
    if (brandSubtitle) {
      brandSubtitle.textContent = `/ ${profile.stellar_id}`;
    }
    document.body.classList.add("is-authenticated");
    return;
  }

  brandLink.href = buildUrl(document.body.dataset.linkHome || "./");
  if (brandSubtitle) {
    brandSubtitle.textContent = "STELLAR PROFILE";
  }
  document.body.classList.remove("is-authenticated");
}

function closeMenu(menu) {
  if (!menu) return;
  menu.classList.remove("is-open");
}

function renderPending(slot) {
  slot.innerHTML = `
    <div class="topbar-auth-pending" aria-hidden="true">
      <span class="topbar-auth-pending-link"></span>
      <span class="topbar-auth-pending-avatar"></span>
    </div>
  `;
}

function renderLoggedOut(slot, meta) {
  syncBrand(null);

  if (meta.authMode === "hidden") {
    slot.innerHTML = "";
    return;
  }

  slot.innerHTML = `
    <a class="topbar-auth-link" href="${buildUrl(meta.links.signin, true)}" data-auth-action="signin">로그인</a>
  `;

  slot.querySelector("[data-auth-action='signin']")?.addEventListener("click", () => {
    trackEvent("signin_click", {
      source: "top_nav",
      page_name: meta.pageName,
    });
  });
}

function renderLoggedIn(slot, meta, session, profile) {
  const displayName = getDisplayName(session.user, profile);
  const initial = getProfileInitial(session.user, profile);
  const profileActive = ["profile", "password"].includes(meta.pageName) ? " is-active" : "";
  const savedActive = ["saved"].includes(meta.pageName) ? " is-active" : "";
  const publicProfileUrl = profile?.stellar_id ? buildPublicProfileUrl(profile.stellar_id) : buildUrl(meta.links.home);
  const accountUrl = buildAccountUrl(session.user.id);
  const followingUrl = buildFollowingUrl();
  const searchUrl = buildSearchUrl();

  syncBrand(profile);

  slot.innerHTML = `
    <div class="topbar-auth-loggedin">
      <a class="topbar-icon-link" href="${searchUrl}" aria-label="스텔라 프로필 검색" data-nav-target="search_profiles">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.75 2a8.75 8.75 0 1 0 5.366 15.66l3.75 3.75a1.25 1.25 0 1 0 1.768-1.767l-3.75-3.75A8.75 8.75 0 0 0 10.75 2Zm0 2.5a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Z" fill="currentColor"/>
        </svg>
      </a>
      <button class="topbar-icon-link notification-button" type="button" aria-label="알림센터 열기" aria-haspopup="dialog" aria-expanded="false" data-notification-toggle>
        ${getBellIcon()}
        <span class="notification-dot" data-notification-dot aria-hidden="true"></span>
      </button>
      <div class="profile-menu" data-profile-menu>
        <button class="profile-button" type="button" aria-haspopup="menu" aria-expanded="false" data-profile-toggle>
          <span>${escapeHtml(initial)}</span>
        </button>
        <div class="profile-panel" role="menu" data-profile-panel>
          <div class="profile-panel-name">${escapeHtml(displayName)}</div>
          <div class="profile-panel-email">${escapeHtml(session.user.email || "")}</div>
          <div class="profile-panel-links">
            <a class="profile-panel-link${profileActive}" href="${publicProfileUrl}" data-nav-target="public_profile">내 스텔라 프로필</a>
            <a class="profile-panel-link${savedActive}" href="${followingUrl}" data-nav-target="following_profiles">팔로잉 프로필</a>
            <span class="profile-panel-divider" aria-hidden="true"></span>
            <a class="profile-panel-link" href="${accountUrl}" data-nav-target="account_profile">계정 정보</a>
          </div>
          <button class="profile-signout-button" type="button" data-profile-signout>로그아웃</button>
        </div>
      </div>
    </div>
  `;

  const menu = slot.querySelector("[data-profile-menu]");
  const toggle = slot.querySelector("[data-profile-toggle]");
  const signoutButton = slot.querySelector("[data-profile-signout]");
  const notificationButton = slot.querySelector("[data-notification-toggle]");
  const notificationCleanup = setupNotificationCenter(notificationButton);
  const handleDocumentClick = (event) => {
    if (!menu?.contains(event.target)) {
      closeMenu(menu);
      toggle?.setAttribute("aria-expanded", "false");
    }
  };

  toggle?.addEventListener("click", () => {
    const opened = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", opened ? "true" : "false");
  });

  document.addEventListener("click", handleDocumentClick);

  signoutButton?.addEventListener("click", async () => {
    try {
      await signOut();
      trackEvent("signout_click", {
        page_name: meta.pageName,
      });

      if (["saved", "profile", "password", "reading", "my_saju"].includes(meta.pageName)) {
        window.location.href = buildUrl(meta.links.home);
      }
    } catch (error) {
      window.alert(error.message || "로그아웃에 실패했습니다.");
    }
  });

  return () => {
    notificationCleanup?.();
    document.removeEventListener("click", handleDocumentClick);
  };
}

export function setupAuthUi() {
  const slot = document.querySelector("[data-auth-slot]");
  if (!slot) return () => {};

  const meta = getPageMeta();

  if (!isSupabaseConfigured()) {
    syncBrand(null);
    renderLoggedOut(slot, meta);
    return () => {};
  }

  let activeCleanup = null;
  let renderVersion = 0;

  renderPending(slot);

  const unsubscribe = subscribeAuthState((session) => {
    renderVersion += 1;
    const version = renderVersion;

    if (!session) {
      if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
      }
      renderLoggedOut(slot, meta);
      return;
    }

    if (meta.pageName === "home") {
      fetchProfile(session.user.id)
        .then((profile) => {
          if (version !== renderVersion) return;
          const redirectUrl = profile?.stellar_id
            ? buildPublicProfileUrl(profile.stellar_id)
            : buildAccountUrl(session.user.id);
          window.location.replace(redirectUrl);
        })
        .catch(() => {
          if (version !== renderVersion) return;
          window.location.replace(buildAccountUrl(session.user.id));
        });
      return;
    }

    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    // Render immediately from the auth session so the top-nav does not look blank.
    activeCleanup = renderLoggedIn(slot, meta, session, null);

    fetchProfile(session.user.id)
      .then((profile) => {
        if (!profile || version !== renderVersion) return;
        if (activeCleanup) {
          activeCleanup();
          activeCleanup = null;
        }
        activeCleanup = renderLoggedIn(slot, meta, session, profile);
      })
      .catch(() => {
        // Keep the session-based UI if the profile query is slow or fails.
      });
  });

  return () => {
    if (activeCleanup) activeCleanup();
    unsubscribe();
  };
}
