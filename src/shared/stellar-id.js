function getHomeUrl() {
  return new URL(document.body.dataset.linkHome || "/", window.location.href);
}

const OWN_STELLAR_ROUTE_CACHE_KEY = "stellar-id:own-route-cache";
const PRODUCTION_SITE_URL = "https://stellar-id.com";

function parseCachedOwnRoute() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(OWN_STELLAR_ROUTE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const stellarId = String(parsed.stellarId || "").trim();
    if (!isValidStellarId(stellarId)) return null;

    return {
      userId: String(parsed.userId || "").trim() || null,
      stellarId,
    };
  } catch {
    return null;
  }
}

function getCachedOwnStellarId(session) {
  const cached = parseCachedOwnRoute();
  if (!cached) return null;

  const sessionUserId = String(session?.user?.id || "").trim();
  if (!sessionUserId) {
    return cached.stellarId;
  }

  if (!cached.userId || cached.userId === sessionUserId) {
    return cached.stellarId;
  }

  return null;
}

export function isLocalDevelopment() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function normalizeStellarIdInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 16);
}

export function isValidStellarId(value) {
  return /^[1-9]\d{0,15}$/.test(String(value || ""));
}

export function buildInternalProfileUrl(stellarId) {
  const url = new URL(document.body.dataset.linkPublicProfile || new URL("profile/", getHomeUrl()).toString(), window.location.href);
  url.searchParams.set("sid", String(stellarId));
  return url.toString();
}

export function buildStaticPublicProfilePath(stellarId) {
  if (!stellarId) {
    return "/";
  }

  return `/profile/${encodeURIComponent(String(stellarId))}`;
}

export function buildStaticPublicProfileUrl(stellarId, { absolute = false } = {}) {
  const path = buildStaticPublicProfilePath(stellarId);
  return absolute ? new URL(path, PRODUCTION_SITE_URL).toString() : path;
}

export function buildPublicProfileUrl(stellarId, { absolute = false } = {}) {
  if (!stellarId) {
    return absolute ? getHomeUrl().toString() : getHomeUrl().pathname;
  }

  if (isLocalDevelopment()) {
    return buildInternalProfileUrl(stellarId);
  }

  const path = buildStaticPublicProfilePath(stellarId);
  return absolute ? new URL(path, window.location.origin).toString() : path;
}

export function resolveOwnStellarId(session, profile = null) {
  const profileStellarId = profile?.stellar_id;
  if (profileStellarId != null && String(profileStellarId).trim()) {
    return String(profileStellarId).trim();
  }

  const sessionStellarId = session?.user?.user_metadata?.stellar_id;
  if (sessionStellarId != null && String(sessionStellarId).trim()) {
    return String(sessionStellarId).trim();
  }

  const cachedStellarId = getCachedOwnStellarId(session);
  if (cachedStellarId) {
    return cachedStellarId;
  }

  return null;
}

export function rememberOwnStellarId(stellarId, userId = null) {
  if (typeof window === "undefined") return;

  const normalized = normalizeStellarIdInput(stellarId);
  if (!isValidStellarId(normalized)) return;

  try {
    window.localStorage.setItem(OWN_STELLAR_ROUTE_CACHE_KEY, JSON.stringify({
      userId: String(userId || "").trim() || null,
      stellarId: normalized,
    }));
  } catch {
    // Ignore storage errors silently.
  }
}

export function getRequestedStellarId() {
  const profilePathMatch = window.location.pathname.match(/^\/profile\/(\d{1,16})\/?$/);
  if (profilePathMatch) return profilePathMatch[1];

  const pathMatch = window.location.pathname.match(/^\/(\d{1,16})\/?$/);
  if (pathMatch) return pathMatch[1];

  return new URLSearchParams(window.location.search).get("sid");
}

export function applyPrettyProfilePath(stellarId) {
  if (!stellarId || isLocalDevelopment()) return;

  const targetPath = `/profile/${encodeURIComponent(String(stellarId))}`;
  const targetUrl = `${targetPath}${window.location.search || ""}${window.location.hash || ""}`;
  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

  if (currentPath === targetPath) return;
  window.history.replaceState({}, "", targetUrl);
}

export function buildSearchUrl() {
  return new URL(document.body.dataset.linkSearch || new URL("search/", getHomeUrl()).toString(), window.location.href).toString();
}

export function buildFollowingUrl() {
  return new URL(document.body.dataset.linkSaved || new URL("saved/", getHomeUrl()).toString(), window.location.href).toString();
}

export function buildAccountUrl(userId = null) {
  const url = new URL(document.body.dataset.linkAccount || document.body.dataset.linkProfile || new URL("p/", getHomeUrl()).toString(), window.location.href);
  if (userId) {
    url.searchParams.set("user_id", userId);
  }
  return url.toString();
}

export function buildSignedInHomeUrl(session, profile = null) {
  const stellarId = resolveOwnStellarId(session, profile);
  if (stellarId) {
    return buildPublicProfileUrl(stellarId);
  }

  return buildAccountUrl(session?.user?.id || null);
}

export function buildProfileSettingsUrl() {
  return new URL(document.body.dataset.linkProfileSettings || new URL("profile-settings/", getHomeUrl()).toString(), window.location.href).toString();
}
