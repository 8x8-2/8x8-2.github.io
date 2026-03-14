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
  const savedActive = ["saved", "reading", "my_saju"].includes(meta.pageName) ? " is-active" : "";
  const profileUrl = buildProfileUrl(meta.links.profile, session.user.id);

  slot.innerHTML = `
    <div class="profile-menu" data-profile-menu>
      <button class="profile-button" type="button" aria-haspopup="menu" aria-expanded="false" data-profile-toggle>
        <span>${escapeHtml(initial)}</span>
      </button>
      <div class="profile-panel" role="menu" data-profile-panel>
        <div class="profile-panel-name">${escapeHtml(displayName)}</div>
        <div class="profile-panel-email">${escapeHtml(session.user.email || "")}</div>
        <div class="profile-panel-links">
          <a class="profile-panel-link${profileActive}" href="${profileUrl}" data-nav-target="profile">내 정보</a>
          <a class="profile-panel-link${savedActive}" href="${buildUrl(meta.links.saved)}" data-nav-target="saved_readings">사주 보관함</a>
        </div>
        <button class="profile-signout-button" type="button" data-profile-signout>로그아웃</button>
      </div>
    </div>
  `;

  const menu = slot.querySelector("[data-profile-menu]");
  const toggle = slot.querySelector("[data-profile-toggle]");
  const signoutButton = slot.querySelector("[data-profile-signout]");
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
    document.removeEventListener("click", handleDocumentClick);
  };
}

export function setupAuthUi() {
  const slot = document.querySelector("[data-auth-slot]");
  if (!slot) return () => {};

  const meta = getPageMeta();

  if (!isSupabaseConfigured()) {
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
