import {
  AUTH_STATE_STATUS,
  buildSessionProfileStub,
  fetchProfile,
  isSupabaseConfigured,
  subscribeAuthSnapshot,
} from "./auth.js";
import { renderSocialNav } from "./social-nav.js";
import { buildSignedInHomeUrl } from "./stellar-id.js";

function getPageMeta() {
  const body = document.body;

  return {
    pageName: body.dataset.pageName || "",
    navTitle: body.dataset.navTitle || "",
  };
}

function resolvePageTitle(meta) {
  if (meta.navTitle) {
    return meta.navTitle;
  }

  switch (meta.pageName) {
    case "home":
      return "STELLAR-ID";
    case "signin":
      return "STELLAR-ID";
    case "signup":
      return "회원가입";
    case "privacy":
      return "개인정보처리방침";
    case "soulday_list":
      return "일주별 보기";
    case "soulday_detail":
      return document.body.dataset.souldayName || "일주 정보";
    case "reading":
      return "저장된 사주 정보";
    case "my_saju":
      return "내 사주";
    case "password":
      return "암호 변경";
    default:
      return "STELLAR-ID";
  }
}

function resolveGuestPageTitle(meta) {
  switch (meta.pageName) {
    case "home":
      return "STELLAR-ID";
    case "soulday_list":
    case "soulday_detail":
      return "스텔라 ID";
    default:
      return resolvePageTitle(meta);
  }
}

function buildLoggedInHomeUrl(session, profile) {
  return buildSignedInHomeUrl(session, profile);
}

function renderPageNav(container, meta, session, profile = null, authStatus = AUTH_STATE_STATUS.UNAUTHENTICATED) {
  return renderSocialNav(container, {
    authStatus,
    session,
    viewerProfile: profile || buildSessionProfileStub(session),
    pageTitle: session ? resolvePageTitle(meta) : resolveGuestPageTitle(meta),
    homeUrlOverride: session ? buildLoggedInHomeUrl(session, profile) : null,
    hideGuestSignin: meta.pageName === "signin",
  });
}

export function setupAuthUi() {
  const container = document.querySelector("[data-social-nav]");
  if (!container) return () => {};

  const meta = getPageMeta();

  if (!isSupabaseConfigured()) {
    return renderPageNav(container, meta, null, null);
  }

  let activeCleanup = null;
  let renderVersion = 0;

  activeCleanup = renderPageNav(container, meta, null, null, AUTH_STATE_STATUS.LOADING);

  const unsubscribe = subscribeAuthSnapshot((snapshot) => {
    const session = snapshot.session || null;
    const authStatus = snapshot.status || AUTH_STATE_STATUS.UNKNOWN;

    renderVersion += 1;
    const version = renderVersion;

    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    if (!session) {
      activeCleanup = renderPageNav(
        container,
        meta,
        null,
        null,
        authStatus === AUTH_STATE_STATUS.UNAUTHENTICATED ? AUTH_STATE_STATUS.UNAUTHENTICATED : AUTH_STATE_STATUS.LOADING
      );
      return;
    }

    if (meta.pageName === "home") {
      fetchProfile(session.user.id)
        .then((profile) => {
          if (version !== renderVersion) return;
          window.location.replace(buildLoggedInHomeUrl(session, profile));
        })
        .catch(() => {
          if (version !== renderVersion) return;
          window.location.replace(buildLoggedInHomeUrl(session, null));
        });
      return;
    }

    activeCleanup = renderPageNav(container, meta, session, null, AUTH_STATE_STATUS.AUTHENTICATED);

    fetchProfile(session.user.id)
      .then((profile) => {
        if (version !== renderVersion) return;
        if (activeCleanup) {
          activeCleanup();
          activeCleanup = null;
        }
        activeCleanup = renderPageNav(container, meta, session, profile, AUTH_STATE_STATUS.AUTHENTICATED);
      })
      .catch(() => {
        // Keep the session-based nav if the profile request is slow or fails.
      });
  });

  return () => {
    if (activeCleanup) {
      activeCleanup();
    }
    unsubscribe();
  };
}
