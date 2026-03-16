import {
  createSupabaseHeaders,
  createSupabaseUrl,
  getSupabaseConfig,
  getSupabaseClient,
  isSupabaseConfigured,
} from "./supabase.js";
import { rememberOwnStellarId } from "./stellar-id.js";
import { hasKnownBirthTime } from "./birth.js";
import { buildProfileDerivedFieldsFromInput } from "./profile-derived.js";
import { normalizeProfileBio } from "./profile-text.js";

let ensureOwnProfileRpcUnavailable = false;
let notificationQueryMode = "full";
let profileImageFunctionUnavailable = false;
let profileImageStorageUnavailable = false;
let accessTokenRefreshPromise = null;
let seoProfilesCachePromise = null;

export const AUTH_STATE_STATUS = Object.freeze({
  UNKNOWN: "unknown",
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
});

const authStore = {
  initialized: false,
  status: isSupabaseConfigured() ? AUTH_STATE_STATUS.UNKNOWN : AUTH_STATE_STATUS.UNAUTHENTICATED,
  session: null,
  subscribers: new Set(),
  bootstrapPromise: null,
  refreshTimerId: null,
  authSubscription: null,
  manualSignOut: false,
  lifecycleInstalled: false,
};

function getPersistedSupabaseStorageKey() {
  if (typeof window === "undefined") return "";

  try {
    const { url } = getSupabaseConfig();
    const host = new URL(url).host || "";
    const projectRef = host.split(".")[0] || "";
    return projectRef ? `sb-${projectRef}-auth-token` : "";
  } catch {
    return "";
  }
}

function pickPersistedSessionCandidate(payload) {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const candidate = pickPersistedSessionCandidate(item);
      if (candidate?.user) return candidate;
    }
    return null;
  }

  if (typeof payload !== "object") {
    return null;
  }

  if (payload.access_token && payload.user) {
    return payload;
  }

  return pickPersistedSessionCandidate(payload.currentSession || payload.session || null);
}

function readPersistedSupabaseSession() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  const storageKey = getPersistedSupabaseStorageKey();
  if (!storageKey) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return null;
    return pickPersistedSessionCandidate(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

function getSessionExpiresAt(session) {
  const expiresAtSeconds = Number(session?.expires_at || 0);
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= 0) {
    return 0;
  }

  return expiresAtSeconds * 1000;
}

function buildAuthSnapshot() {
  return {
    status: authStore.status,
    session: authStore.session,
    user: authStore.session?.user || null,
  };
}

function emitAuthSnapshot() {
  const snapshot = buildAuthSnapshot();
  authStore.subscribers.forEach((callback) => {
    callback(snapshot);
  });
}

function clearAuthRefreshTimer() {
  if (authStore.refreshTimerId && typeof window !== "undefined") {
    window.clearTimeout(authStore.refreshTimerId);
  }
  authStore.refreshTimerId = null;
}

function scheduleAuthRefreshTimer(session) {
  clearAuthRefreshTimer();

  if (typeof window === "undefined" || !session?.refresh_token) {
    return;
  }

  const expiresAtMs = getSessionExpiresAt(session);
  if (!expiresAtMs) {
    return;
  }

  const remainingMs = expiresAtMs - Date.now();
  const delayMs = remainingMs > 90_000 ? remainingMs - 60_000 : 60_000;

  authStore.refreshTimerId = window.setTimeout(() => {
    void refreshAuthSession({
      reason: "timer",
      markUnauthenticatedOnFailure: false,
    });
  }, Math.max(15_000, delayMs));
}

function updateAuthStore({ status = authStore.status, session = authStore.session } = {}) {
  const previousStatus = authStore.status;
  const previousSession = authStore.session;
  const previousToken = String(previousSession?.access_token || "");
  const nextToken = String(session?.access_token || "");
  const previousUserId = String(previousSession?.user?.id || "");
  const nextUserId = String(session?.user?.id || "");
  const previousExpiry = Number(previousSession?.expires_at || 0);
  const nextExpiry = Number(session?.expires_at || 0);

  authStore.status = status;
  authStore.session = session || null;
  scheduleAuthRefreshTimer(authStore.session);

  if (
    previousStatus === authStore.status &&
    previousToken === nextToken &&
    previousUserId === nextUserId &&
    previousExpiry === nextExpiry
  ) {
    return;
  }

  emitAuthSnapshot();
}

function markAuthenticated(session, reason = "auth") {
  if (!session?.user) return;
  updateAuthStore({
    status: AUTH_STATE_STATUS.AUTHENTICATED,
    session,
  });
}

function markUnauthenticated(reason = "auth") {
  updateAuthStore({
    status: AUTH_STATE_STATUS.UNAUTHENTICATED,
    session: null,
  });
}

async function refreshAuthSession({
  reason = "refresh",
  markUnauthenticatedOnFailure = false,
} = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  if (!accessTokenRefreshPromise) {
    const previousSession = authStore.session;
    const persistedSession = !previousSession ? readPersistedSupabaseSession() : null;
    const recoverySession = previousSession || persistedSession || null;

    accessTokenRefreshPromise = (async () => {
      const { data: currentData, error: currentError } = await supabase.auth.getSession();
      if (currentError) {
        if (recoverySession && !authStore.manualSignOut) {
          markAuthenticated(recoverySession, `${reason}:preserve`);
          return recoverySession;
        }

        if (markUnauthenticatedOnFailure || authStore.manualSignOut) {
          markUnauthenticated(`${reason}:get-session-failed`);
        }
        return null;
      }

      const currentSession = currentData?.session || recoverySession || null;
      if (!currentSession?.refresh_token) {
        if (currentSession?.user) {
          markAuthenticated(currentSession, `${reason}:current-session`);
          return currentSession;
        }

        if (recoverySession && !authStore.manualSignOut) {
          markAuthenticated(recoverySession, `${reason}:preserve-no-refresh-token`);
          return recoverySession;
        }

        if (markUnauthenticatedOnFailure || authStore.manualSignOut) {
          markUnauthenticated(`${reason}:no-refresh-token`);
        }
        return null;
      }

      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: currentSession.refresh_token,
      });

      const refreshedSession = refreshedData?.session || null;
      if (refreshError || !refreshedSession?.user) {
        if (currentSession?.user && !authStore.manualSignOut) {
          markAuthenticated(currentSession, `${reason}:refresh-failed`);
          return currentSession;
        }

        if (markUnauthenticatedOnFailure || authStore.manualSignOut) {
          markUnauthenticated(`${reason}:refresh-failed`);
        }
        return null;
      }

      authStore.manualSignOut = false;
      markAuthenticated(refreshedSession, reason);
      return refreshedSession;
    })().finally(() => {
      accessTokenRefreshPromise = null;
    });
  }

  return accessTokenRefreshPromise;
}

async function hydrateAuthStore({
  reason = "bootstrap",
  allowUnauthenticatedFallback = true,
} = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    markUnauthenticated(`${reason}:unconfigured`);
    return null;
  }

  if (!authStore.bootstrapPromise) {
    const previousSession = authStore.session || readPersistedSupabaseSession() || null;

    if (!previousSession) {
      updateAuthStore({
        status: AUTH_STATE_STATUS.LOADING,
        session: null,
      });
    } else {
      markAuthenticated(previousSession, `${reason}:preserve`);
    }

    authStore.bootstrapPromise = (async () => {
      const { data, error } = await supabase.auth.getSession();
      const directSession = !error ? data?.session || null : null;

      if (directSession?.user) {
        authStore.manualSignOut = false;
        markAuthenticated(directSession, reason);
        return directSession;
      }

      if (previousSession && !authStore.manualSignOut) {
        const refreshedSession = await refreshAuthSession({
          reason: `${reason}:recovery`,
          markUnauthenticatedOnFailure: false,
        }).catch(() => previousSession);

        if (refreshedSession?.user) {
          markAuthenticated(refreshedSession, `${reason}:recovered`);
          return refreshedSession;
        }

        markAuthenticated(previousSession, `${reason}:preserve`);
        return previousSession;
      }

      if (allowUnauthenticatedFallback || authStore.manualSignOut) {
        markUnauthenticated(reason);
      }

      return null;
    })().finally(() => {
      authStore.bootstrapPromise = null;
    });
  }

  return authStore.bootstrapPromise;
}

function handleSupabaseAuthStateChange(event, session) {
  if (session?.user) {
    authStore.manualSignOut = false;
    markAuthenticated(session, `event:${event}`);
    return;
  }

  if (event === "SIGNED_OUT") {
    if (authStore.manualSignOut) {
      authStore.manualSignOut = false;
      markUnauthenticated(`event:${event}`);
      return;
    }

    const persistedSession = authStore.session || readPersistedSupabaseSession();
    if (persistedSession?.user) {
      markAuthenticated(persistedSession, `event:${event}:preserve`);
      void hydrateAuthStore({
        reason: `event:${event}`,
        allowUnauthenticatedFallback: false,
      });
      return;
    }

    void hydrateAuthStore({
      reason: `event:${event}`,
      allowUnauthenticatedFallback: true,
    });
    return;
  }

  const persistedSession = authStore.session || readPersistedSupabaseSession();
  if (persistedSession?.user && !authStore.manualSignOut) {
    markAuthenticated(persistedSession, `event:${event}:preserve`);
    void hydrateAuthStore({
      reason: `event:${event}`,
      allowUnauthenticatedFallback: false,
    });
    return;
  }

  if ([AUTH_STATE_STATUS.UNKNOWN, AUTH_STATE_STATUS.LOADING].includes(authStore.status)) {
    void hydrateAuthStore({
      reason: `event:${event}`,
      allowUnauthenticatedFallback: true,
    });
    return;
  }

  markUnauthenticated(`event:${event}`);
}

function installAuthLifecycleObservers() {
  if (authStore.lifecycleInstalled || typeof window === "undefined") {
    return;
  }

  const handleSessionResume = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    if (authStore.session?.user) {
      void refreshAuthSession({
        reason: "resume",
        markUnauthenticatedOnFailure: false,
      });
      return;
    }

    void hydrateAuthStore({
      reason: "resume",
      allowUnauthenticatedFallback: true,
    });
  };

  window.addEventListener("focus", handleSessionResume);
  document.addEventListener("visibilitychange", handleSessionResume);
  authStore.lifecycleInstalled = true;
}

function ensureAuthStoreInitialized() {
  if (authStore.initialized) {
    return;
  }

  authStore.initialized = true;

  if (!isSupabaseConfigured()) {
    markUnauthenticated("bootstrap:unconfigured");
    return;
  }

  installAuthLifecycleObservers();

  const supabase = ensureSupabase();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    handleSupabaseAuthStateChange(event, session || null);
  });

  authStore.authSubscription = subscription;
  void hydrateAuthStore({
    reason: "bootstrap",
    allowUnauthenticatedFallback: true,
  });
}

export function getAuthSnapshot() {
  ensureAuthStoreInitialized();
  return buildAuthSnapshot();
}

export async function waitForAuthBootstrap() {
  ensureAuthStoreInitialized();

  if (!authStore.session && [AUTH_STATE_STATUS.UNKNOWN, AUTH_STATE_STATUS.LOADING].includes(authStore.status)) {
    await hydrateAuthStore({
      reason: "wait",
      allowUnauthenticatedFallback: true,
    });
  }

  return buildAuthSnapshot();
}

export function subscribeAuthSnapshot(callback) {
  ensureAuthStoreInitialized();

  authStore.subscribers.add(callback);
  queueMicrotask(() => {
    callback(buildAuthSnapshot());
  });

  return () => {
    authStore.subscribers.delete(callback);
  };
}

function ensureSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase 연결 정보가 아직 설정되지 않았습니다.");
  }
  return supabase;
}

function normalizeAuthError(error, mode = "signin") {
  const rawMessage = String(error?.message || "").trim();
  const rawHint = String(error?.hint || error?.details || "").trim();
  const combined = `${rawMessage} ${rawHint}`.toLowerCase();

  if (combined.includes("no api key found")) {
    return new Error("Supabase API 키가 요청에 포함되지 않았습니다. 배포 환경변수 `VITE_SUPABASE_PUBLISHABLE_KEY` 또는 클라이언트 초기화 설정을 확인해 주세요.");
  }

  if (combined.includes("invalid login credentials")) {
    return new Error("가입된 이메일이 아니거나 비밀번호가 올바르지 않습니다.");
  }

  if (combined.includes("email not confirmed")) {
    return new Error("이메일 인증을 완료한 뒤 로그인해 주세요.");
  }

  if (combined.includes("user already registered") || combined.includes("already been registered")) {
    return new Error("이미 가입된 이메일입니다.");
  }

  if (combined.includes("password should be at least")) {
    return new Error("비밀번호는 6자 이상이어야 합니다.");
  }

  if (mode === "signup" && (rawMessage || rawHint)) {
    return new Error(rawHint ? `${rawMessage || "회원가입 요청이 거절되었습니다."} (${rawHint})` : rawMessage);
  }

  return new Error(rawMessage || rawHint || "인증 처리 중 오류가 발생했습니다.");
}

function isUniqueViolation(error) {
  return error?.code === "23505" || String(error?.message || "").toLowerCase().includes("duplicate");
}

function normalizeStorageUploadError(error, context = {}) {
  const rawMessage = String(error?.message || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const statusCode = String(error?.statusCode || error?.status || "");
  const mimeDebug = [context.originalMimeType, context.safeContentType].filter(Boolean).join(" -> ");

  if (normalizedMessage.includes("bucket not found")) {
    return new Error("Supabase Storage에 `profile-images` 버킷이 없습니다. SQL Editor에서 최신 schema.sql을 다시 실행해 주세요.");
  }

  if (normalizedMessage.includes("row-level security") || normalizedMessage.includes("policy")) {
    return new Error("Supabase Storage 업로드 권한이 아직 적용되지 않았습니다. SQL Editor에서 `profile-images` 버킷/정책 구간을 다시 실행해 주세요.");
  }

  if (normalizedMessage.includes("mime") || normalizedMessage.includes("content type")) {
    return new Error("이미지 형식이 Storage 설정과 맞지 않습니다. PNG, JPG, WEBP, GIF 파일로 다시 시도해 주세요.");
  }

  if (normalizedMessage.includes("object not found")) {
    return new Error("Supabase Storage가 업로드 경로를 찾지 못했습니다. 현재 버킷/정책 또는 업로드 API 설정을 확인해 주세요.");
  }

  if (statusCode === "400") {
    return new Error(rawMessage
      ? `Supabase Storage가 업로드 요청을 거절했습니다. 버킷과 정책 설정을 확인해 주세요. (${rawMessage})`
      : `Supabase Storage가 업로드 요청을 거절했습니다. 업로드 MIME 타입과 버킷 제한을 확인해 주세요.${mimeDebug ? ` (전송 MIME: ${mimeDebug})` : ""}`);
  }

  return new Error(rawMessage || "프로필 이미지를 업로드하지 못했습니다.");
}

function needsDerivedProfileFields(profile) {
  return Boolean(
    profile?.birth_year &&
    profile?.birth_month &&
    profile?.birth_day &&
    profile?.gender
  );
}

function normalizeStellarId(value) {
  if (value == null || value === "") return null;
  return String(value).trim() || null;
}

function normalizeInteger(value) {
  if (value == null || value === "") return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off", ""].includes(normalized)) return false;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (value == null) return fallback;
  return Boolean(value);
}

function normalizeStringField(value, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim();
}

function normalizeNullableStringField(value) {
  const normalized = normalizeStringField(value, "");
  return normalized || null;
}

function findSmallestAvailableStellarId(stellarIds = []) {
  const occupied = new Set(
    stellarIds
      .map((value) => normalizeStellarId(value))
      .filter((value) => /^[1-9]\d*$/.test(String(value || "")))
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value > 0)
  );

  let candidate = 1;
  while (occupied.has(candidate)) {
    candidate += 1;
  }

  return String(candidate);
}

function normalizeProfileRecord(profile, fallbackStellarId = null) {
  if (!profile) return profile;

  const birthHour = normalizeInteger(profile.birth_hour);
  const birthMinute = normalizeInteger(profile.birth_minute);
  const normalizedBirthTimeKnown = normalizeBoolean(profile.birth_time_known, false);

  return {
    ...profile,
    full_name: normalizeStringField(profile.full_name, ""),
    gender: normalizeStringField(profile.gender, "male") || "male",
    phone: normalizeNullableStringField(profile.phone),
    calendar_type: normalizeStringField(profile.calendar_type, "solar") || "solar",
    is_leap_month: normalizeBoolean(profile.is_leap_month, false),
    birth_year: normalizeInteger(profile.birth_year),
    birth_month: normalizeInteger(profile.birth_month),
    birth_day: normalizeInteger(profile.birth_day),
    birth_hour: birthHour,
    birth_minute: birthMinute,
    birth_time_known: hasKnownBirthTime({
      ...profile,
      birth_hour: birthHour,
      birth_minute: birthMinute,
      birth_time_known: normalizedBirthTimeKnown,
    }),
    marketing_opt_in: normalizeBoolean(profile.marketing_opt_in, false),
    stellar_id: fallbackStellarId || normalizeStellarId(profile.stellar_id),
    profile_image_path: normalizeNullableStringField(profile.profile_image_path),
    profile_image_url: normalizeStringField(profile.profile_image_url, ""),
    mbti: normalizeStringField(profile.mbti, ""),
    region_country: normalizeStringField(profile.region_country, ""),
    region_name: normalizeStringField(profile.region_name, ""),
    bio: normalizeProfileBio(profile.bio || ""),
    personality_visibility: normalizeStringField(profile.personality_visibility, "public") || "public",
    health_visibility: normalizeStringField(profile.health_visibility, "public") || "public",
    love_visibility: normalizeStringField(profile.love_visibility, "public") || "public",
    ability_visibility: normalizeStringField(profile.ability_visibility, "public") || "public",
    major_luck_visibility: normalizeStringField(profile.major_luck_visibility, "public") || "public",
  };
}

function createRequestError(message, status = 500) {
  const safeMessage = typeof message === "string" ? message : "";
  const error = new Error(safeMessage);
  error.status = status;
  return error;
}

function shouldRetrySupabaseAuthFailure(status, detail = "") {
  const normalizedDetail = String(detail || "").toLowerCase();

  return Boolean(
    [400, 401, 403].includes(Number(status || 0))
    || normalizedDetail.includes("jwt")
    || normalizedDetail.includes("token")
    || normalizedDetail.includes("auth")
    || normalizedDetail.includes("session")
  );
}

function isProfileRpcCompatibilityError(error) {
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || 0);

  return Boolean(
    message.includes("get_my_profile")
    || message.includes("ensure_my_profile")
    || message.includes("could not find the function")
    || message.includes("structure of query does not match function result type")
    || message.includes("return type mismatch")
    || message.includes("returned type")
    || (status === 400 && !message)
  );
}

function isNotificationSchemaCompatibilityError(error) {
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || 0);

  return Boolean(
    message.includes("profile_notifications")
    || message.includes("actor_profile_image_url")
    || message.includes("actor_stellar_id")
    || message.includes("read_at")
    || message.includes("schema cache")
    || message.includes("could not find the table")
    || message.includes("does not exist")
    || (status === 400 && !message)
  );
}

function normalizeNotificationRecord(notification) {
  if (!notification) return null;

  return {
    ...notification,
    actor_stellar_id: normalizeStellarId(notification.actor_stellar_id),
    actor_full_name: notification.actor_full_name || "누군가",
    actor_profile_image_url: notification.actor_profile_image_url || "",
    event_type: notification.event_type || "follow",
    read_at: notification.read_at || null,
    created_at: notification.created_at || null,
  };
}

function normalizeSeoProfileRecord(profile) {
  if (!profile) return null;

  return {
    profile_id: null,
    stellar_id: normalizeStellarId(profile.stellar_id),
    full_name: profile.full_name || "회원",
    gender: profile.gender || "male",
    profile_image_url: profile.profile_image_url || "",
    day_pillar_key: profile.day_pillar_key || "",
    day_pillar_hanja: profile.day_pillar_hanja || "",
    day_pillar_metaphor: profile.day_pillar_metaphor || "",
    element_class: profile.element_class || "unknown",
    mbti: profile.mbti || "",
    follower_count: Number(profile.follower_count || 0),
    is_following: Boolean(profile.is_following),
  };
}

function scoreSeoSearchRow(row, normalizedQuery, numericQuery) {
  const stellarText = String(row?.stellar_id || "");
  const lowerName = String(row?.full_name || "").toLowerCase();
  const lowerDayPillar = String(row?.day_pillar_key || "").toLowerCase();
  const lowerMbti = String(row?.mbti || "").toLowerCase();
  const numericPosition = numericQuery ? stellarText.indexOf(numericQuery) : -1;

  let rank = 5;
  if (numericQuery && stellarText === numericQuery) {
    rank = 0;
  } else if (numericQuery && numericPosition >= 0) {
    rank = 1;
  } else if (!numericQuery && lowerName === normalizedQuery) {
    rank = 0;
  } else if (lowerName.includes(normalizedQuery)) {
    rank = 2;
  } else if (lowerDayPillar.includes(normalizedQuery) || lowerMbti.includes(normalizedQuery)) {
    rank = 3;
  }

  return {
    rank,
    numericPosition,
    stellarLength: stellarText.length || Number.MAX_SAFE_INTEGER,
    followerCount: Number(row?.follower_count || 0),
    stellarNumeric: Number(stellarText || Number.MAX_SAFE_INTEGER),
  };
}

async function fetchProfilesForSeoData() {
  if (!seoProfilesCachePromise) {
    seoProfilesCachePromise = (async () => {
      const response = await fetchSupabaseRestResponse("/rest/v1/rpc/get_profiles_for_seo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    })().catch((error) => {
      seoProfilesCachePromise = null;
      throw error;
    });
  }

  return seoProfilesCachePromise;
}

async function warmSupabaseAuthSession(supabase) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

export function getDisplayName(user, profile = null) {
  const preferred = profile?.full_name || user?.user_metadata?.full_name || user?.email || "회원";
  return String(preferred).trim() || "회원";
}

export function getProfileInitial(user, profile = null) {
  return getDisplayName(user, profile).charAt(0).toUpperCase();
}

export function buildSessionProfileStub(session, profile = null) {
  if (!session?.user) {
    return normalizeProfileRecord(profile);
  }

  const metadata = session.user.user_metadata || {};

  return normalizeProfileRecord({
    ...(profile || {}),
    id: profile?.id || session.user.id,
    email: profile?.email || session.user.email || metadata.email || "",
    full_name: profile?.full_name || metadata.full_name || session.user.email || "회원",
    gender: profile?.gender || metadata.gender || "male",
    phone: profile?.phone ?? metadata.phone ?? null,
    calendar_type: profile?.calendar_type || metadata.calendar_type || "solar",
    is_leap_month: profile?.is_leap_month ?? metadata.is_leap_month ?? false,
    birth_year: profile?.birth_year ?? metadata.birth_year ?? null,
    birth_month: profile?.birth_month ?? metadata.birth_month ?? null,
    birth_day: profile?.birth_day ?? metadata.birth_day ?? null,
    birth_hour: profile?.birth_hour ?? metadata.birth_hour ?? null,
    birth_minute: profile?.birth_minute ?? metadata.birth_minute ?? null,
    birth_time_known: profile?.birth_time_known ?? metadata.birth_time_known ?? false,
    marketing_opt_in: profile?.marketing_opt_in ?? metadata.marketing_opt_in ?? false,
    stellar_id: profile?.stellar_id ?? metadata.stellar_id ?? null,
    profile_image_path: profile?.profile_image_path ?? metadata.profile_image_path ?? null,
    profile_image_url: profile?.profile_image_url ?? metadata.profile_image_url ?? "",
    mbti: profile?.mbti ?? metadata.mbti ?? "",
    region_country: profile?.region_country ?? metadata.region_country ?? "",
    region_name: profile?.region_name ?? metadata.region_name ?? "",
    bio: profile?.bio ?? metadata.bio ?? "",
    day_pillar_key: profile?.day_pillar_key ?? metadata.day_pillar_key ?? "",
    day_pillar_hanja: profile?.day_pillar_hanja ?? metadata.day_pillar_hanja ?? "",
    day_pillar_metaphor: profile?.day_pillar_metaphor ?? metadata.day_pillar_metaphor ?? "",
    element_class: profile?.element_class ?? metadata.element_class ?? "unknown",
    preview_summary: profile?.preview_summary ?? metadata.preview_summary ?? "",
    public_snapshot: profile?.public_snapshot ?? metadata.public_snapshot ?? {},
    personality_visibility: profile?.personality_visibility ?? metadata.personality_visibility ?? "public",
    health_visibility: profile?.health_visibility ?? metadata.health_visibility ?? "public",
    love_visibility: profile?.love_visibility ?? metadata.love_visibility ?? "public",
    ability_visibility: profile?.ability_visibility ?? metadata.ability_visibility ?? "public",
    major_luck_visibility: profile?.major_luck_visibility ?? metadata.major_luck_visibility ?? "public",
  }, normalizeStellarId(profile?.stellar_id ?? metadata.stellar_id ?? null));
}

function normalizeEnsureProfileError(error) {
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();

  if (isProfileRpcCompatibilityError(error) || normalized.includes("ensure_my_profile")) {
    return new Error("Supabase 프로필 복구 함수가 아직 적용되지 않았습니다. SQL Editor에서 최신 schema.sql을 다시 실행해 주세요.");
  }

  if (isUniqueViolation(error)) {
    return new Error("이미 사용 중인 스텔라 등록번호입니다.");
  }

  return new Error(message || "프로필을 생성하지 못했습니다.");
}

async function readSupabaseErrorDetail(response) {
  try {
    const errorPayload = await response.json();
    return errorPayload?.message
      || errorPayload?.detail
      || errorPayload?.error
      || errorPayload?.hint
      || errorPayload?.details
      || "";
  } catch {
    return await response.text().catch(() => "");
  }
}

async function refreshAccessTokenOnce() {
  const session = await refreshAuthSession({
    reason: "request-refresh",
    markUnauthenticatedOnFailure: false,
  }).catch(() => null);

  return String(session?.access_token || "").trim() || null;
}

async function fetchSupabaseRestResponse(path, {
  accessToken = null,
  method = "GET",
  headers = null,
  body = undefined,
  searchParams = null,
  retryOnAuthFailure = true,
  allowAnonFallback = false,
} = {}) {
  const requestUrl = createSupabaseUrl(path);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value == null || value === "") return;
      requestUrl.searchParams.append(key, String(value));
    });
  }

  const response = await fetch(requestUrl, {
    method,
    headers: createSupabaseHeaders({
      accessToken,
      headers,
    }),
    body,
  });

  if (!response.ok) {
    const detail = await readSupabaseErrorDetail(response);
    if (retryOnAuthFailure && accessToken && shouldRetrySupabaseAuthFailure(response.status, detail)) {
      const refreshedAccessToken = await refreshAccessTokenOnce().catch(() => null);
      if (refreshedAccessToken && refreshedAccessToken !== String(accessToken || "").trim()) {
        return fetchSupabaseRestResponse(path, {
          accessToken: refreshedAccessToken,
          method,
          headers,
          body,
          searchParams,
          retryOnAuthFailure: false,
          allowAnonFallback,
        });
      }

      if (allowAnonFallback) {
        return fetchSupabaseRestResponse(path, {
          accessToken: null,
          method,
          headers,
          body,
          searchParams,
          retryOnAuthFailure: false,
          allowAnonFallback: false,
        });
      }
    }

    throw createRequestError(detail || "Supabase 요청을 처리하지 못했습니다.", response.status);
  }

  return response;
}

async function fetchNotificationRowsViaRest({
  accessToken,
  userId,
  select = "*",
  offset = 0,
  limit = 40,
  unreadOnly = false,
} = {}) {
  const response = await fetchSupabaseRestResponse("/rest/v1/profile_notifications", {
    accessToken,
    headers: {
      Accept: "application/json",
    },
    allowAnonFallback: true,
    searchParams: {
      select,
      user_id: `eq.${userId}`,
      event_type: "eq.follow",
      order: "created_at.desc,id.desc",
      offset,
      limit,
      ...(unreadOnly ? { read_at: "is.null" } : {}),
    },
  });

  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function fetchNotificationRowsViaClient({
  userId,
  select = "*",
  offset = 0,
  limit = 40,
  unreadOnly = false,
} = {}) {
  const supabase = ensureSupabase();
  await warmSupabaseAuthSession(supabase);

  let query = supabase
    .from("profile_notifications")
    .select(select)
    .eq("user_id", userId)
    .eq("event_type", "follow")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, Math.max(offset, offset + limit - 1));

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function markNotificationRowsReadViaRest({ accessToken, userId, readAt }) {
  await fetchSupabaseRestResponse("/rest/v1/profile_notifications", {
    accessToken,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    searchParams: {
      user_id: `eq.${userId}`,
      event_type: "eq.follow",
      read_at: "is.null",
    },
    body: JSON.stringify({
      read_at: readAt,
    }),
  });
}

async function markNotificationRowsReadViaClient({ userId, readAt }) {
  const supabase = ensureSupabase();
  await warmSupabaseAuthSession(supabase);

  const { error } = await supabase
    .from("profile_notifications")
    .update({ read_at: readAt })
    .eq("user_id", userId)
    .eq("event_type", "follow")
    .is("read_at", null);

  if (error) {
    throw error;
  }
}

async function fetchProfileRecordById(userId, accessToken = null) {
  const response = await fetchSupabaseRestResponse("/rest/v1/profiles", {
    accessToken,
    allowAnonFallback: true,
    searchParams: {
      select: "*",
      id: `eq.${userId}`,
    },
  });
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function fetchOwnProfileRecordViaClient(userId) {
  const supabase = ensureSupabase();
  await warmSupabaseAuthSession(supabase);

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function fetchOwnProfileRecordWithFallback(userId, accessToken = null) {
  const clientProfile = await fetchOwnProfileRecordViaClient(userId).catch(() => null);
  if (clientProfile) {
    return clientProfile;
  }

  const directProfile = await fetchProfileRecordById(userId, accessToken).catch(() => null);
  if (directProfile) {
    return directProfile;
  }

  return null;
}

export async function getSession(options = {}) {
  ensureAuthStoreInitialized();

  if (authStore.session?.user) {
    return authStore.session;
  }

  const persistedSession = readPersistedSupabaseSession();
  if (persistedSession?.user && !authStore.manualSignOut) {
    markAuthenticated(persistedSession, "get-session:persisted");
    void hydrateAuthStore({
      reason: "get-session:persisted",
      allowUnauthenticatedFallback: false,
    });
    return persistedSession;
  }

  if (authStore.status === AUTH_STATE_STATUS.UNAUTHENTICATED) {
    const recoveredSession = await refreshAuthSession({
      reason: "get-session:recover",
      markUnauthenticatedOnFailure: false,
    }).catch(() => null);

    if (recoveredSession?.user) {
      return recoveredSession;
    }

    return null;
  }

  const snapshot = await waitForAuthBootstrap();
  if (snapshot.session?.user) {
    return snapshot.session;
  }

  const recoveredSession = await refreshAuthSession({
    reason: "get-session:post-bootstrap",
    markUnauthenticatedOnFailure: false,
  }).catch(() => null);

  return recoveredSession?.user ? recoveredSession : null;
}

export async function getUser(options = {}) {
  return (await getSession(options))?.user || null;
}

export async function ensureOwnProfile() {
  const session = await getSession();
  const currentUser = session?.user || null;
  if (!currentUser || !session?.access_token) return null;
  const fallbackStellarId = normalizeStellarId(currentUser.user_metadata?.stellar_id);
  const fetchExistingProfile = async () => {
    const existingProfile = await fetchOwnProfileRecordWithFallback(currentUser.id, session.access_token).catch(() => null);
    return normalizeProfileRecord(existingProfile, fallbackStellarId);
  };

  if (ensureOwnProfileRpcUnavailable) {
    const existingProfile = await fetchExistingProfile();
    if (existingProfile) {
      return existingProfile;
    }

    throw normalizeEnsureProfileError(createRequestError("", 400));
  }

  try {
    const response = await fetchSupabaseRestResponse("/rest/v1/rpc/ensure_my_profile", {
      accessToken: session.access_token,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.pgrst.object+json",
      },
      body: JSON.stringify({}),
    });
    const profile = await response.json();
    const normalizedProfile = normalizeProfileRecord(profile, fallbackStellarId);
    rememberOwnStellarId(normalizedProfile?.stellar_id, currentUser.id);
    return normalizedProfile;
  } catch (requestError) {

    if (isProfileRpcCompatibilityError(requestError)) {
      ensureOwnProfileRpcUnavailable = true;
      const existingProfile = await fetchExistingProfile();
      if (existingProfile) {
        rememberOwnStellarId(existingProfile?.stellar_id, currentUser.id);
        return existingProfile;
      }
    }

    throw normalizeEnsureProfileError(requestError);
  }
}

export async function fetchProfile(userId = null, options = {}) {
  if (!isSupabaseConfigured()) return null;

  const {
    allowRepair = true,
    allowSessionFallback = true,
  } = options || {};

  let session = await getSession();
  const currentUser = session?.user || null;
  const resolvedUserId = userId || currentUser?.id;
  if (!resolvedUserId) return null;

  const canRepairOwnProfile = currentUser?.id === resolvedUserId;
  const fallbackStellarId = canRepairOwnProfile
    ? normalizeStellarId((session?.user || currentUser)?.user_metadata?.stellar_id)
    : null;
  const sessionProfileStub = canRepairOwnProfile && allowSessionFallback
    ? buildSessionProfileStub(session)
    : null;

  let data = null;

  try {
    data = canRepairOwnProfile
      ? await fetchOwnProfileRecordWithFallback(resolvedUserId, session?.access_token || null)
      : await fetchProfileRecordById(resolvedUserId, session?.access_token || null);
  } catch (error) {
    if (canRepairOwnProfile) {
      if (allowRepair) {
        try {
          return await ensureOwnProfile();
        } catch (repairError) {
          if (sessionProfileStub) {
            return sessionProfileStub;
          }
          throw repairError;
        }
      }

      if (sessionProfileStub) {
        return sessionProfileStub;
      }
    }
    throw new Error(error?.message || "프로필을 불러오지 못했습니다.");
  }

  if (data) {
    const normalizedProfile = normalizeProfileRecord(data, fallbackStellarId);
    if (canRepairOwnProfile) {
      rememberOwnStellarId(normalizedProfile?.stellar_id, currentUser?.id || resolvedUserId);
    }
    return normalizedProfile;
  }

  if (canRepairOwnProfile) {
    if (sessionProfileStub) {
      rememberOwnStellarId(sessionProfileStub?.stellar_id, currentUser?.id || resolvedUserId);
      return sessionProfileStub;
    }

    if (allowRepair) {
      return ensureOwnProfile();
    }
  }

  return null;
}

export async function updateProfile(updates) {
  const supabase = ensureSupabase();
  const session = await getSession();
  const user = (await warmSupabaseAuthSession(supabase)) || session?.user || null;

  if (!user) {
    throw new Error("로그인 후 내 정보를 수정할 수 있습니다.");
  }

  const currentProfile = await fetchProfile(user.id);
  if (!currentProfile) {
    throw new Error("내 정보를 찾지 못했습니다.");
  }

  const mergedProfile = {
    ...currentProfile,
    ...updates,
  };

  const payload = {
    full_name: mergedProfile.full_name,
    gender: mergedProfile.gender,
    phone: mergedProfile.phone || null,
    calendar_type: mergedProfile.calendar_type,
    is_leap_month: Boolean(mergedProfile.is_leap_month),
    birth_year: mergedProfile.birth_year,
    birth_month: mergedProfile.birth_month,
    birth_day: mergedProfile.birth_day,
    birth_hour: mergedProfile.birth_time_known ? mergedProfile.birth_hour : null,
    birth_minute: mergedProfile.birth_time_known ? mergedProfile.birth_minute : null,
    birth_time_known: Boolean(mergedProfile.birth_time_known),
    marketing_opt_in: Boolean(mergedProfile.marketing_opt_in),
    stellar_id: mergedProfile.stellar_id || null,
    profile_image_path: mergedProfile.profile_image_path || null,
    profile_image_url: mergedProfile.profile_image_url || null,
    mbti: mergedProfile.mbti || null,
    region_country: mergedProfile.region_country || null,
    region_name: mergedProfile.region_name || null,
    bio: normalizeProfileBio(mergedProfile.bio || ""),
    personality_visibility: mergedProfile.personality_visibility || "public",
    health_visibility: mergedProfile.health_visibility || "public",
    love_visibility: mergedProfile.love_visibility || "public",
    ability_visibility: mergedProfile.ability_visibility || "public",
    major_luck_visibility: mergedProfile.major_luck_visibility || "public",
    updated_at: new Date().toISOString(),
  };

  if (needsDerivedProfileFields(mergedProfile)) {
    const { fields } = buildProfileDerivedFieldsFromInput({
      birthYear: mergedProfile.birth_year,
      birthMonth: mergedProfile.birth_month,
      birthDay: mergedProfile.birth_day,
      birthHour: mergedProfile.birth_hour,
      birthMinute: mergedProfile.birth_minute,
      birthTimeKnown: mergedProfile.birth_time_known,
      calendarType: mergedProfile.calendar_type,
      isLeapMonth: mergedProfile.is_leap_month,
      gender: mergedProfile.gender,
    });

    Object.assign(payload, fields);
  }

  let data = null;
  try {
    const performUpdate = async () => {
      const { data: updatedRow, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id)
        .select("*")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return updatedRow || null;
    };

    data = await performUpdate();

    if (!data) {
      await ensureOwnProfile();
      data = await performUpdate();
    }

    if (!data) {
      throw new Error("내 정보를 저장하지 못했습니다.");
    }
  } catch (error) {
    if (isUniqueViolation(error) || String(error?.message || "").toLowerCase().includes("duplicate")) {
      throw new Error("이미 사용 중인 스텔라 ID입니다.");
    }
    throw new Error(error?.message || "내 정보를 저장하지 못했습니다.");
  }

  const resolvedData = normalizeProfileRecord(
    data,
    normalizeStellarId(mergedProfile.stellar_id) || normalizeStellarId(user.user_metadata?.stellar_id)
  );
  rememberOwnStellarId(resolvedData?.stellar_id, user.id);

  try {
    await supabase.auth.updateUser({
      data: {
        full_name: resolvedData.full_name,
        gender: resolvedData.gender,
        phone: resolvedData.phone || "",
        calendar_type: resolvedData.calendar_type,
        is_leap_month: resolvedData.is_leap_month,
        birth_year: resolvedData.birth_year,
        birth_month: resolvedData.birth_month,
        birth_day: resolvedData.birth_day,
        birth_hour: resolvedData.birth_time_known ? resolvedData.birth_hour : "",
        birth_minute: resolvedData.birth_time_known ? resolvedData.birth_minute : "",
        birth_time_known: resolvedData.birth_time_known,
        marketing_opt_in: resolvedData.marketing_opt_in,
        stellar_id: resolvedData.stellar_id || "",
        profile_image_path: resolvedData.profile_image_path || "",
        profile_image_url: resolvedData.profile_image_url || "",
        mbti: resolvedData.mbti || "",
        region_country: resolvedData.region_country || "",
        region_name: resolvedData.region_name || "",
        bio: resolvedData.bio || "",
        day_pillar_key: resolvedData.day_pillar_key || "",
        day_pillar_hanja: resolvedData.day_pillar_hanja || "",
        day_pillar_metaphor: resolvedData.day_pillar_metaphor || "",
        element_class: resolvedData.element_class || "unknown",
        preview_summary: resolvedData.preview_summary || "",
        public_snapshot: resolvedData.public_snapshot || {},
        personality_visibility: resolvedData.personality_visibility || "public",
        health_visibility: resolvedData.health_visibility || "public",
        love_visibility: resolvedData.love_visibility || "public",
        ability_visibility: resolvedData.ability_visibility || "public",
        major_luck_visibility: resolvedData.major_luck_visibility || "public",
      },
    });
  } catch {
    // profiles 테이블이 실제 표시용 데이터 소스라서, 메타데이터 동기화 실패는 저장 실패로 보지 않습니다.
  }

  return resolvedData;
}

export function subscribeAuthState(callback) {
  return subscribeAuthSnapshot((snapshot) => {
    if (snapshot.session?.user) {
      callback(snapshot.session);
      return;
    }

    if (snapshot.status === AUTH_STATE_STATUS.UNAUTHENTICATED) {
      callback(null);
    }
  });
}

export async function signInWithPassword({ email, password }) {
  const supabase = ensureSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw normalizeAuthError(error, "signin");
  if (data?.session?.user) {
    authStore.manualSignOut = false;
    markAuthenticated(data.session, "signin");
  }
  return data;
}

export async function signUpWithPassword({
  email,
  password,
  emailRedirectTo,
  profile,
}) {
  const supabase = ensureSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: profile,
    },
  });

  if (error) throw normalizeAuthError(error, "signup");
  if (data?.session?.user) {
    authStore.manualSignOut = false;
    markAuthenticated(data.session, "signup");
  }
  return data;
}

export async function signOut() {
  const supabase = ensureSupabase();
  authStore.manualSignOut = true;
  const { error } = await supabase.auth.signOut();
  if (error) {
    authStore.manualSignOut = false;
    throw new Error("로그아웃 중 오류가 발생했습니다.");
  }
  markUnauthenticated("signout");
}

export async function changePassword({ currentPassword, newPassword }) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user?.email) {
    throw new Error("계정 정보를 확인할 수 없습니다.");
  }

  const signInResult = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInResult.error) {
    throw new Error("현재 암호가 올바르지 않습니다.");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw normalizeAuthError(error, "password");
}

export async function saveReading(record) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 저장할 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("saved_readings")
    .insert({
      ...record,
      user_id: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error("사주 결과를 저장하지 못했습니다.");
  return data;
}

export async function peekNextStellarId() {
  const supabase = ensureSupabase();

  try {
    const { data, error } = await supabase.rpc("get_profiles_for_seo");
    if (!error && Array.isArray(data)) {
      return findSmallestAvailableStellarId(data.map((profile) => profile?.stellar_id));
    }
  } catch {
    // Fall back to the legacy RPC below when the SEO RPC is unavailable.
  }

  const { data, error } = await supabase.rpc("peek_next_stellar_id");

  if (error) throw new Error("다음 스텔라 등록번호를 불러오지 못했습니다.");
  return normalizeStellarId(data);
}

export async function checkStellarIdAvailability(stellarId, exceptProfileId = null) {
  const supabase = ensureSupabase();
  const { data, error } = await supabase.rpc("is_stellar_id_available", {
    stellar_id_input: normalizeStellarId(stellarId),
    except_profile_id: exceptProfileId,
  });

  if (error) throw new Error("스텔라 등록번호 중복 여부를 확인하지 못했습니다.");
  return Boolean(data);
}

export async function fetchPublicProfileByStellarId(stellarId) {
  const normalizedStellarId = normalizeStellarId(stellarId);
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const requestUrl = createSupabaseUrl("/rest/v1/rpc/get_public_profile_by_stellar_id");

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: createSupabaseHeaders({
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.pgrst.object+json",
      },
    }),
    body: JSON.stringify({
      stellar_id_input: normalizedStellarId,
    }),
  });

  if (response.status === 406) {
    return null;
  }

  if (!response.ok) {
    const detail = await readSupabaseErrorDetail(response);

    throw new Error(detail ? `스텔라 프로필을 불러오지 못했습니다. (${detail})` : "스텔라 프로필을 불러오지 못했습니다.");
  }

  const data = await response.json();
  return normalizeProfileRecord(data, normalizedStellarId);
}

export async function refreshPublicProfileByStellarId(stellarId) {
  const supabase = ensureSupabase();
  const { data, error } = await supabase.functions.invoke("refresh-public-profile", {
    body: {
      stellarId: normalizeStellarId(stellarId),
    },
  });

  if (error) {
    throw new Error(error.message || "프로필 사주 정보를 새로 계산하지 못했습니다.");
  }

  return data || null;
}

export async function searchPublicProfiles(query, limit = 20) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    return [];
  }

  try {
    const response = await fetchSupabaseRestResponse("/rest/v1/rpc/search_stellar_profiles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        search_query: normalizedQuery,
        limit_count: limit,
      }),
    });

    const data = await response.json().catch(() => []);
    if (Array.isArray(data)) {
      return data;
    }
  } catch {
    const seoRows = (await fetchProfilesForSeoData()).map((row) => normalizeSeoProfileRecord(row)).filter(Boolean);
    const lowerQuery = normalizedQuery.toLowerCase();
    const numericQuery = normalizedQuery.replace(/\D/g, "");
    const matchedRows = seoRows
      .filter((row) => {
        const searchableValues = [
          String(row.full_name || "").toLowerCase(),
          String(row.day_pillar_key || "").toLowerCase(),
          String(row.mbti || "").toLowerCase(),
          String(row.stellar_id || ""),
        ];

        return searchableValues.some((value) => value.includes(numericQuery || lowerQuery));
      })
      .map((row) => ({
        ...row,
        _score: scoreSeoSearchRow(row, lowerQuery, numericQuery),
      }))
      .sort((left, right) => {
        const a = left._score;
        const b = right._score;
        return a.rank - b.rank
          || (a.numericPosition < 0 ? Number.MAX_SAFE_INTEGER : a.numericPosition) - (b.numericPosition < 0 ? Number.MAX_SAFE_INTEGER : b.numericPosition)
          || a.stellarLength - b.stellarLength
          || b.followerCount - a.followerCount
          || a.stellarNumeric - b.stellarNumeric;
      })
      .slice(0, Math.max(1, Math.min(Number(limit) || 20, 50)))
      .map(({ _score, ...row }) => row);

    return matchedRows;
  }

  throw new Error("스텔라 프로필 검색에 실패했습니다.");
}

export async function fetchFollowingProfiles({ sort = "recent", query = "" } = {}) {
  const supabase = ensureSupabase();
  const session = await getSession();
  const user = (await warmSupabaseAuthSession(supabase)) || session?.user || null;

  if (!user) {
    throw new Error("로그인 후 팔로잉 프로필을 볼 수 있습니다.");
  }

  const normalizedSort = ["recent", "name", "id"].includes(String(sort || "").toLowerCase())
    ? String(sort || "").toLowerCase()
    : "recent";
  const normalizedQuery = String(query || "").trim().toLowerCase();

  const sortFollowingProfilesFallback = (rows = [], followedAtByProfileId = new Map()) => {
    const records = rows.map((row) => ({
      ...row,
      followed_at: followedAtByProfileId.get(row.profile_id) || null,
    }));

    if (normalizedSort === "name") {
      return records.sort((left, right) => String(left.full_name || "").localeCompare(String(right.full_name || ""), "ko"));
    }

    if (normalizedSort === "id") {
      return records.sort((left, right) => Number(left.stellar_id || 0) - Number(right.stellar_id || 0));
    }

    return records.sort((left, right) => {
      const leftTime = left.followed_at ? Date.parse(left.followed_at) : 0;
      const rightTime = right.followed_at ? Date.parse(right.followed_at) : 0;
      return rightTime - leftTime || Number(left.stellar_id || 0) - Number(right.stellar_id || 0);
    });
  };

  const normalizeFollowingProfileRow = (row) => ({
    profile_id: row.id,
    stellar_id: normalizeStellarId(row.stellar_id),
    full_name: row.full_name || "회원",
    gender: row.gender || "male",
    day_pillar_key: row.day_pillar_key || "",
    profile_image_url: row.profile_image_url || "",
  });

  const fetchViaRpc = async () => {
    const response = await fetchSupabaseRestResponse("/rest/v1/rpc/get_following_profiles", {
      accessToken: session?.access_token || null,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sort_key: normalizedSort,
        search_query: query,
      }),
    });

    const data = await response.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  };

  try {
    return await fetchViaRpc();
  } catch (rpcError) {
    try {
      const { data: followRows, error: followError } = await supabase
        .from("profile_follows")
        .select("following_id,created_at")
        .eq("follower_id", user.id);

      if (followError) {
        throw followError;
      }

      const followedAtByProfileId = new Map(
        (followRows || []).map((row) => [row.following_id, row.created_at || null])
      );

      const followedIds = Array.from(followedAtByProfileId.keys()).filter(Boolean);
      if (!followedIds.length) {
        return [];
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id,stellar_id,full_name,gender,day_pillar_key,profile_image_url")
        .in("id", followedIds);

      if (profilesError) {
        throw profilesError;
      }

      let filteredRows = (profileRows || [])
        .map((row) => normalizeFollowingProfileRow(row))
        .filter((row) => row.profile_id && followedAtByProfileId.has(row.profile_id));

      if (normalizedQuery) {
        filteredRows = filteredRows.filter((row) => {
          const haystack = [
            row.full_name,
            row.stellar_id,
            row.day_pillar_key,
          ].map((value) => String(value || "").toLowerCase());

          return haystack.some((value) => value.includes(normalizedQuery));
        });
      }

      return sortFollowingProfilesFallback(filteredRows, followedAtByProfileId);
    } catch {
      console.warn("following profiles fallback failed", rpcError);
      throw new Error("팔로잉 프로필을 불러오지 못했습니다.");
    }
  }
}

export async function fetchOwnFollowCounts(userId = null) {
  const supabase = ensureSupabase();
  const session = await getSession();
  const resolvedUserId = userId || session?.user?.id || null;

  if (!resolvedUserId) {
    return {
      followerCount: 0,
      followingCount: 0,
    };
  }

  await warmSupabaseAuthSession(supabase);

  const [followersResult, followingResult] = await Promise.all([
    supabase
      .from("profile_follows")
      .select("follower_id")
      .eq("following_id", resolvedUserId),
    supabase
      .from("profile_follows")
      .select("following_id")
      .eq("follower_id", resolvedUserId),
  ]);

  if (followersResult.error || followingResult.error) {
    throw new Error("팔로우 수를 불러오지 못했습니다.");
  }

  return {
    followerCount: Array.isArray(followersResult.data) ? followersResult.data.length : 0,
    followingCount: Array.isArray(followingResult.data) ? followingResult.data.length : 0,
  };
}

async function fetchLegacyNotificationRows({ accessToken, userId, offset, limit }) {
  const data = await fetchNotificationRowsViaRest({
    accessToken,
    userId,
    select: "*",
    offset,
    limit,
  });

  return (data || [])
    .filter((row) => !row?.event_type || row.event_type === "follow")
    .map((row) => normalizeNotificationRecord(row))
    .filter(Boolean);
}

export async function fetchFollowNotifications({ offset = 0, limit = 40 } = {}) {
  ensureSupabase();
  const session = await getSession();
  const user = session?.user || null;

  if (!user) {
    throw new Error("로그인 후 알림을 볼 수 있습니다.");
  }

  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 40));

  if (notificationQueryMode === "unavailable") {
    return [];
  }

  if (notificationQueryMode === "legacy") {
    try {
      return await fetchLegacyNotificationRows({
        accessToken: session.access_token,
        userId: user.id,
        offset: safeOffset,
        limit: safeLimit,
      });
    } catch (error) {
      if (isNotificationSchemaCompatibilityError(error)) {
        notificationQueryMode = "unavailable";
        return [];
      }
      throw new Error("알림을 불러오지 못했습니다.");
    }
  }

  try {
    const data = await fetchNotificationRowsViaRest({
      accessToken: session.access_token,
      userId: user.id,
      select: "id,actor_id,actor_stellar_id,actor_full_name,actor_profile_image_url,event_type,read_at,created_at",
      offset: safeOffset,
      limit: safeLimit,
    });

    return (data || []).map((row) => normalizeNotificationRecord(row)).filter(Boolean);
  } catch (error) {
    if (isNotificationSchemaCompatibilityError(error)) {
      notificationQueryMode = "legacy";

      try {
        return await fetchLegacyNotificationRows({
          accessToken: session.access_token,
          userId: user.id,
          offset: safeOffset,
          limit: safeLimit,
        });
      } catch (legacyError) {
        if (isNotificationSchemaCompatibilityError(legacyError)) {
          notificationQueryMode = "unavailable";
          return [];
        }
      }
    }

    throw new Error("알림을 불러오지 못했습니다.");
  }
}

export async function fetchUnreadFollowNotificationCount() {
  ensureSupabase();
  const session = await getSession();
  const user = session?.user || null;

  if (!user) {
    return 0;
  }

  if (notificationQueryMode === "unavailable") {
    return 0;
  }

  if (notificationQueryMode === "legacy") {
    const rows = await fetchFollowNotifications({ offset: 0, limit: 100 });
    return rows.filter((row) => !row?.read_at).length;
  }

  try {
    const rows = await fetchNotificationRowsViaRest({
      accessToken: session.access_token,
      userId: user.id,
      select: "id",
      offset: 0,
      limit: 1,
      unreadOnly: true,
    });

    return rows.length;
  } catch (error) {
    if (isNotificationSchemaCompatibilityError(error)) {
      notificationQueryMode = "legacy";
      const rows = await fetchFollowNotifications({ offset: 0, limit: 100 });
      return rows.filter((row) => !row?.read_at).length;
    }

    throw new Error("읽지 않은 알림 수를 불러오지 못했습니다.");
  }
}

export async function markFollowNotificationsRead() {
  ensureSupabase();
  const session = await getSession();
  const user = session?.user || null;

  if (!user) {
    throw new Error("로그인 후 알림을 확인할 수 있습니다.");
  }

  const readAt = new Date().toISOString();

  if (notificationQueryMode === "unavailable" || notificationQueryMode === "legacy") {
    return readAt;
  }

  try {
    await markNotificationRowsReadViaRest({
      accessToken: session.access_token,
      userId: user.id,
      readAt,
    });
  } catch (error) {
    if (isNotificationSchemaCompatibilityError(error)) {
      notificationQueryMode = "legacy";
      return readAt;
    }

    throw new Error("알림 읽음 상태를 갱신하지 못했습니다.");
  }

  return readAt;
}

export async function followProfile(targetProfileId) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 팔로우할 수 있습니다.");
  }

  if (!targetProfileId || targetProfileId === user.id) {
    throw new Error("내 프로필은 팔로우할 수 없습니다.");
  }

  const { error } = await supabase
    .from("profile_follows")
    .insert({
      follower_id: user.id,
      following_id: targetProfileId,
    });

  if (error && !isUniqueViolation(error)) {
    throw new Error("팔로우를 시작하지 못했습니다.");
  }
}

export async function unfollowProfile(targetProfileId) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 팔로우를 취소할 수 있습니다.");
  }

  const { error } = await supabase
    .from("profile_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetProfileId);

  if (error) {
    throw new Error("팔로우를 취소하지 못했습니다.");
  }
}

function buildUploadFile(file, extension, contentType) {
  if (typeof File !== "undefined" && file instanceof File) {
    return file;
  }

  return new File([file], `avatar.${extension}`, {
    type: contentType || "application/octet-stream",
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("프로필 이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromObjectUrl(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("프로필 이미지를 미리 처리하지 못했습니다."));
    image.src = objectUrl;
  });
}

async function createInlineProfileImageFallback(uploadFile) {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return {
      path: null,
      publicUrl: await readFileAsDataUrl(uploadFile),
    };
  }

  const objectUrl = URL.createObjectURL(uploadFile);

  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);

    if (!width || !height) {
      return {
        path: null,
        publicUrl: await readFileAsDataUrl(uploadFile),
      };
    }

    const maxDimension = 512;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return {
        path: null,
        publicUrl: await readFileAsDataUrl(uploadFile),
      };
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let dataUrl = canvas.toDataURL("image/webp", 0.88);
    if (!String(dataUrl || "").startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/png");
    }

    if (!String(dataUrl || "").startsWith("data:image/")) {
      dataUrl = await readFileAsDataUrl(uploadFile);
    }

    return {
      path: null,
      publicUrl: dataUrl,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadProfileImageViaFunction({ session, uploadFile, filePath }) {
  const formData = new FormData();
  formData.append("file", uploadFile, uploadFile.name || filePath.split("/").pop() || "avatar");
  formData.append("path", filePath);

  const response = await fetch(createSupabaseUrl("/functions/v1/upload-profile-image"), {
    method: "POST",
    headers: createSupabaseHeaders({
      accessToken: session.access_token,
    }),
    body: formData,
  });

  if (!response.ok) {
    const detail = await readSupabaseErrorDetail(response);
    throw createRequestError(detail || "프로필 이미지를 업로드하지 못했습니다.", response.status);
  }

  const data = await response.json().catch(() => null);
  if (!data?.path || !data?.publicUrl) {
    throw createRequestError("프로필 이미지를 업로드하지 못했습니다.", 500);
  }

  return data;
}

async function uploadProfileImageWithSignedUrl(supabase, { filePath, uploadFile, safeContentType }) {
  const signedAttempt = await supabase.storage
    .from("profile-images")
    .createSignedUploadUrl(filePath);

  if (signedAttempt.error) {
    throw signedAttempt.error;
  }

  const uploadAttempt = await supabase.storage
    .from("profile-images")
    .uploadToSignedUrl(filePath, signedAttempt.data.token, uploadFile, {
      cacheControl: "3600",
      contentType: safeContentType,
      upsert: false,
    });

  if (uploadAttempt.error) {
    throw uploadAttempt.error;
  }

  const { data } = supabase.storage
    .from("profile-images")
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: data.publicUrl,
  };
}

async function uploadProfileImageStandard(supabase, { filePath, uploadFile, safeContentType }) {
  const uploadAttempt = await supabase.storage
    .from("profile-images")
    .upload(filePath, uploadFile, {
      cacheControl: "3600",
      contentType: safeContentType,
      upsert: false,
    });

  if (uploadAttempt.error) {
    throw uploadAttempt.error;
  }

  const { data } = supabase.storage
    .from("profile-images")
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: data.publicUrl,
  };
}

export async function uploadProfileImage(file) {
  const supabase = ensureSupabase();
  const session = await getSession();
  const user = session?.user || null;

  if (!user || !session?.access_token) {
    throw new Error("로그인 후 프로필 이미지를 올릴 수 있습니다.");
  }

  const mimeToExtension = {
    "image/png": "png",
    "image/x-png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/pjpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const extensionToCanonicalMime = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  const normalizedMimeType = String(file?.type || "").toLowerCase();
  const extensionFromMime = mimeToExtension[normalizedMimeType] || "";
  const extensionFromName = String(file?.name || "png").split(".").pop()?.toLowerCase() || "png";
  const safeExtension = ["png", "jpg", "jpeg", "webp", "gif"].includes(extensionFromMime || extensionFromName)
    ? (extensionFromMime || extensionFromName)
    : "";

  if (!safeExtension) {
    throw new Error("프로필 이미지는 PNG, JPG, WEBP, GIF 형식만 올릴 수 있습니다.");
  }

  const safeContentType = extensionToCanonicalMime[safeExtension];
  const uniqueId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : String(Date.now());
  const filePath = `${user.id}/avatar-${uniqueId}.${safeExtension}`;
  const uploadFile = buildUploadFile(
    file,
    safeExtension,
    safeContentType || normalizedMimeType || "application/octet-stream"
  );
  const uploadErrors = [];

  try {
    return await createInlineProfileImageFallback(uploadFile);
  } catch (error) {
    uploadErrors.push(error);
  }

  if (!profileImageFunctionUnavailable) {
    try {
      return await uploadProfileImageViaFunction({
        session,
        uploadFile,
        filePath,
      });
    } catch (error) {
      profileImageFunctionUnavailable = true;
      uploadErrors.push(error);
      console.warn("profile image upload via function failed", error);
    }
  }

  if (!profileImageStorageUnavailable) {
    try {
      return await uploadProfileImageWithSignedUrl(supabase, {
        filePath,
        uploadFile,
        safeContentType,
      });
    } catch (error) {
      uploadErrors.push(error);
      console.warn("profile image signed upload failed", error);
    }

    try {
      return await uploadProfileImageStandard(supabase, {
        filePath,
        uploadFile,
        safeContentType,
      });
    } catch (error) {
      profileImageStorageUnavailable = true;
      uploadErrors.push(error);
    }
  }

  try {
    return await createInlineProfileImageFallback(uploadFile);
  } catch (error) {
    uploadErrors.push(error);
  }

  const finalError = uploadErrors[uploadErrors.length - 1] || createRequestError("프로필 이미지를 업로드하지 못했습니다.", 500);
  throw normalizeStorageUploadError(finalError, {
    originalMimeType: normalizedMimeType,
    safeContentType,
  });
}

export async function removeProfileImage(filePath) {
  const supabase = ensureSupabase();
  if (!filePath) return;

  const { error } = await supabase.storage
    .from("profile-images")
    .remove([filePath]);

  if (error) {
    throw new Error("기존 프로필 이미지를 삭제하지 못했습니다.");
  }
}

export async function fetchSavedReadings() {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 저장한 사주를 볼 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("saved_readings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error("저장한 사주를 불러오지 못했습니다.");
  return data || [];
}

export async function fetchSavedReadingById(id) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 저장한 사주를 볼 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("saved_readings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("저장한 사주를 불러오지 못했습니다.");
  return data;
}

export async function updateSavedReading(id, updates) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 저장한 사주를 수정할 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("saved_readings")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error("저장한 사주 정보를 수정하지 못했습니다.");
  return data;
}

export async function deleteSavedReading(id) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 저장한 사주를 삭제할 수 있습니다.");
  }

  const { error } = await supabase
    .from("saved_readings")
    .delete()
    .eq("id", id);

  if (error) throw new Error("저장한 사주를 삭제하지 못했습니다.");

  await supabase
    .from("shared_readings")
    .delete()
    .eq("owner_id", user.id)
    .eq("source_type", "saved_reading")
    .eq("source_record_id", id);
}

export async function upsertSharedReading(record) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 공유 링크를 만들 수 있습니다.");
  }

  const payload = {
    ...record,
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (record.source_record_id) {
    const { data: existing, error: existingError } = await supabase
      .from("shared_readings")
      .select("*")
      .eq("owner_id", user.id)
      .eq("source_type", record.source_type)
      .eq("source_record_id", record.source_record_id)
      .maybeSingle();

    if (existingError) {
      throw new Error("공유 링크를 준비하지 못했습니다.");
    }

    if (existing) {
      const { data, error } = await supabase
        .from("shared_readings")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw new Error("공유 링크를 준비하지 못했습니다.");
      return data;
    }
  }

  const { data, error } = await supabase
    .from("shared_readings")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error("공유 링크를 준비하지 못했습니다.");
  return data;
}

export async function fetchPublicSharedReading(shareToken) {
  const supabase = ensureSupabase();
  const { data, error } = await supabase
    .rpc("get_shared_reading", {
      share_token_input: shareToken,
    })
    .maybeSingle();

  if (error) throw new Error("공유된 사주 정보를 불러오지 못했습니다.");
  return data;
}

export { isSupabaseConfigured };
