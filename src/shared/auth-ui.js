import {
  fetchProfile,
  isSupabaseConfigured,
  subscribeAuthState,
} from "./auth.js";
import { renderSocialNav } from "./social-nav.js";
import { buildAccountUrl, buildPublicProfileUrl } from "./stellar-id.js";

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
      return "무료 사주";
    case "signin":
      return "로그인";
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
      return "스텔라 ID";
  }
}

function buildLoggedInHomeUrl(session, profile) {
  if (profile?.stellar_id) {
    return buildPublicProfileUrl(profile.stellar_id);
  }

  return buildAccountUrl(session?.user?.id || null);
}

function buildSessionProfileStub(session) {
  if (!session?.user) return null;

  return {
    full_name: session.user.user_metadata?.full_name || session.user.email || "스텔라 ID",
    profile_image_url: session.user.user_metadata?.profile_image_url || "",
  };
}

function renderPageNav(container, meta, session, profile = null) {
  return renderSocialNav(container, {
    session,
    viewerProfile: profile || buildSessionProfileStub(session),
    pageTitle: resolvePageTitle(meta),
    homeUrlOverride: session ? buildLoggedInHomeUrl(session, profile) : null,
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

  const unsubscribe = subscribeAuthState((session) => {
    renderVersion += 1;
    const version = renderVersion;

    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    if (!session) {
      activeCleanup = renderPageNav(container, meta, null, null);
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
          window.location.replace(buildAccountUrl(session.user.id));
        });
      return;
    }

    activeCleanup = renderPageNav(container, meta, session, null);

    fetchProfile(session.user.id)
      .then((profile) => {
        if (version !== renderVersion) return;
        if (activeCleanup) {
          activeCleanup();
          activeCleanup = null;
        }
        activeCleanup = renderPageNav(container, meta, session, profile);
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
