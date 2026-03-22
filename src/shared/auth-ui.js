import {
  AUTH_STATE_STATUS,
  buildSessionProfileStub,
  fetchProfile,
  isSupabaseConfigured,
  subscribeAuthSnapshot,
} from "./auth.js";
import { renderSocialNav } from "./social-nav.js";
import { buildSignedInHomeUrl } from "./stellar-id.js";

function getPageName() {
  return document.body.dataset.pageName || "";
}

function buildLoggedInHomeUrl(session, profile) {
  return buildSignedInHomeUrl(session, profile);
}

function renderPageNav(container, pageName, session, profile = null, authStatus = AUTH_STATE_STATUS.UNAUTHENTICATED) {
  return renderSocialNav(container, {
    authStatus,
    session,
    viewerProfile: profile || buildSessionProfileStub(session),
    homeUrlOverride: session ? buildLoggedInHomeUrl(session, profile) : null,
    hideGuestSignin: pageName === "signin",
  });
}

export function setupAuthUi() {
  const container = document.querySelector("[data-social-nav]");
  if (!container) return () => {};

  const pageName = getPageName();

  if (!isSupabaseConfigured()) {
    return renderPageNav(container, pageName, null, null);
  }

  let activeCleanup = null;
  let renderVersion = 0;

  activeCleanup = renderPageNav(container, pageName, null, null, AUTH_STATE_STATUS.LOADING);

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
        pageName,
        null,
        null,
        authStatus === AUTH_STATE_STATUS.UNAUTHENTICATED ? AUTH_STATE_STATUS.UNAUTHENTICATED : AUTH_STATE_STATUS.LOADING
      );
      return;
    }

    if (pageName === "home") {
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

    activeCleanup = renderPageNav(container, pageName, session, null, AUTH_STATE_STATUS.AUTHENTICATED);

    fetchProfile(session.user.id)
      .then((profile) => {
        if (version !== renderVersion) return;
        if (activeCleanup) {
          activeCleanup();
          activeCleanup = null;
        }
        activeCleanup = renderPageNav(container, pageName, session, profile, AUTH_STATE_STATUS.AUTHENTICATED);
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
