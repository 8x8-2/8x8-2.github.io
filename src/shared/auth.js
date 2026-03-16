import {
  createSupabaseHeaders,
  createSupabaseUrl,
  getSupabaseClient,
  isSupabaseConfigured,
} from "./supabase.js";
import { hasKnownBirthTime } from "./birth.js";
import { buildProfileDerivedFieldsFromInput } from "./profile-derived.js";
import { normalizeProfileBio } from "./profile-text.js";

let ownProfileRpcUnavailable = false;
let ensureOwnProfileRpcUnavailable = false;
let notificationQueryMode = "full";

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

  return {
    ...profile,
    birth_time_known: hasKnownBirthTime(profile),
    stellar_id: fallbackStellarId || normalizeStellarId(profile.stellar_id),
  };
}

function createRequestError(message, status = 500) {
  const safeMessage = typeof message === "string" ? message : "";
  const error = new Error(safeMessage);
  error.status = status;
  return error;
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

export function getDisplayName(user, profile = null) {
  const preferred = profile?.full_name || user?.user_metadata?.full_name || user?.email || "회원";
  return String(preferred).trim() || "회원";
}

export function getProfileInitial(user, profile = null) {
  return getDisplayName(user, profile).charAt(0).toUpperCase();
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
    return errorPayload?.message || errorPayload?.hint || errorPayload?.details || "";
  } catch {
    return await response.text().catch(() => "");
  }
}

async function fetchProfileRecordById(userId, accessToken = null) {
  const requestUrl = createSupabaseUrl("/rest/v1/profiles");
  requestUrl.searchParams.set("select", "*");
  requestUrl.searchParams.set("id", `eq.${userId}`);

  const response = await fetch(requestUrl, {
    headers: createSupabaseHeaders({
      accessToken,
    }),
  });

  if (!response.ok) {
    const detail = await readSupabaseErrorDetail(response);
    throw createRequestError(detail || "프로필을 불러오지 못했습니다.", response.status);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function fetchOwnProfileRecord(accessToken) {
  const response = await fetch(createSupabaseUrl("/rest/v1/rpc/get_my_profile"), {
    method: "POST",
    headers: createSupabaseHeaders({
      accessToken,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.pgrst.object+json",
      },
    }),
    body: JSON.stringify({}),
  });

  if (response.status === 406) {
    return null;
  }

  if (!response.ok) {
    const detail = await readSupabaseErrorDetail(response);
    throw createRequestError(detail || "내 정보를 불러오지 못했습니다.", response.status);
  }

  return await response.json();
}

async function fetchOwnProfileRecordWithFallback(userId, accessToken = null) {
  const directProfile = await fetchProfileRecordById(userId, accessToken).catch(() => null);
  if (directProfile) {
    return directProfile;
  }

  if (!ownProfileRpcUnavailable) {
    try {
      return await fetchOwnProfileRecord(accessToken);
    } catch (error) {
      if (isProfileRpcCompatibilityError(error)) {
        ownProfileRpcUnavailable = true;
      }

      throw error;
    }
  }

  return null;
}

export async function getSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw normalizeAuthError(error);
  return data.session || null;
}

export async function getUser() {
  return (await getSession())?.user || null;
}

export async function ensureOwnProfile() {
  const session = await getSession();
  const currentUser = session?.user || null;
  if (!currentUser || !session?.access_token) return null;
  const fallbackStellarId = normalizeStellarId(currentUser.user_metadata?.stellar_id);
  const fetchExistingProfile = async () => {
    const existingProfile = await fetchProfileRecordById(currentUser.id, session.access_token).catch(() => null);
    return normalizeProfileRecord(existingProfile, fallbackStellarId);
  };

  if (ensureOwnProfileRpcUnavailable) {
    const existingProfile = await fetchExistingProfile();
    if (existingProfile) {
      return existingProfile;
    }

    throw normalizeEnsureProfileError(createRequestError("", 400));
  }

  const response = await fetch(createSupabaseUrl("/rest/v1/rpc/ensure_my_profile"), {
    method: "POST",
    headers: createSupabaseHeaders({
      accessToken: session.access_token,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.pgrst.object+json",
      },
    }),
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const detail = await readSupabaseErrorDetail(response);
    const requestError = createRequestError(detail, response.status);

    if (isProfileRpcCompatibilityError(requestError)) {
      ensureOwnProfileRpcUnavailable = true;
      const existingProfile = await fetchExistingProfile();
      if (existingProfile) {
        return existingProfile;
      }
    }

    throw normalizeEnsureProfileError(requestError);
  }

  const profile = await response.json();
  return normalizeProfileRecord(profile, fallbackStellarId);
}

export async function fetchProfile(userId = null) {
  if (!isSupabaseConfigured()) return null;

  const session = await getSession();
  const currentUser = session?.user || null;
  const resolvedUserId = userId || currentUser?.id;
  if (!resolvedUserId) return null;

  const canRepairOwnProfile = currentUser?.id === resolvedUserId;
  const fallbackStellarId = canRepairOwnProfile
    ? normalizeStellarId(currentUser?.user_metadata?.stellar_id)
    : null;

  let data = null;

  try {
    data = canRepairOwnProfile
      ? await fetchOwnProfileRecordWithFallback(resolvedUserId, session?.access_token || null)
      : await fetchProfileRecordById(resolvedUserId, session?.access_token || null);
  } catch (error) {
    if (canRepairOwnProfile) {
      return ensureOwnProfile();
    }
    throw new Error(error?.message || "프로필을 불러오지 못했습니다.");
  }

  if ((!data || !(fallbackStellarId || data.stellar_id)) && canRepairOwnProfile) {
    return ensureOwnProfile();
  }

  return normalizeProfileRecord(data, fallbackStellarId);
}

export async function updateProfile(updates) {
  const supabase = ensureSupabase();
  const user = await getUser();

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

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("이미 사용 중인 스텔라 등록번호입니다.");
    }
    throw new Error("내 정보를 저장하지 못했습니다.");
  }

  const resolvedData = normalizeProfileRecord(
    data,
    normalizeStellarId(mergedProfile.stellar_id) || normalizeStellarId(user.user_metadata?.stellar_id)
  );

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
  const supabase = getSupabaseClient();

  if (!supabase) {
    queueMicrotask(() => callback(null));
    return () => {};
  }

  getSession()
    .then((session) => callback(session))
    .catch(() => callback(null));

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session || null);
  });

  return () => subscription.unsubscribe();
}

export async function signInWithPassword({ email, password }) {
  const supabase = ensureSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw normalizeAuthError(error, "signin");
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
  return data;
}

export async function signOut() {
  const supabase = ensureSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("로그아웃 중 오류가 발생했습니다.");
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

export async function fetchPublicProfileByStellarId(stellarId, { accessToken = null } = {}) {
  const normalizedStellarId = normalizeStellarId(stellarId);
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const requestUrl = createSupabaseUrl("/rest/v1/rpc/get_public_profile_by_stellar_id");

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: createSupabaseHeaders({
      accessToken,
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
  if (!String(query || "").trim()) {
    return [];
  }

  const supabase = ensureSupabase();
  const { data, error } = await supabase.rpc("search_stellar_profiles", {
    search_query: query || "",
    limit_count: limit,
  });

  if (error) throw new Error("스텔라 프로필 검색에 실패했습니다.");
  return data || [];
}

export async function fetchFollowingProfiles({ sort = "recent", query = "" } = {}) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 팔로잉 프로필을 볼 수 있습니다.");
  }

  const { data, error } = await supabase.rpc("get_following_profiles", {
    sort_key: sort,
    search_query: query,
  });

  if (error) throw new Error("팔로잉 프로필을 불러오지 못했습니다.");
  return data || [];
}

async function fetchLegacyNotificationRows(supabase, userId, safeOffset, safeLimit) {
  const { data, error } = await supabase
    .from("profile_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) throw error;

  return (data || [])
    .filter((row) => !row?.event_type || row.event_type === "follow")
    .map((row) => normalizeNotificationRecord(row))
    .filter(Boolean);
}

export async function fetchFollowNotifications({ offset = 0, limit = 40 } = {}) {
  const supabase = ensureSupabase();
  const user = await getUser();

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
      return await fetchLegacyNotificationRows(supabase, user.id, safeOffset, safeLimit);
    } catch (error) {
      if (isNotificationSchemaCompatibilityError(error)) {
        notificationQueryMode = "unavailable";
        return [];
      }
      throw new Error("알림을 불러오지 못했습니다.");
    }
  }

  const { data, error } = await supabase
    .from("profile_notifications")
    .select("id, actor_id, actor_stellar_id, actor_full_name, actor_profile_image_url, event_type, read_at, created_at")
    .eq("user_id", user.id)
    .eq("event_type", "follow")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    if (isNotificationSchemaCompatibilityError(error)) {
      notificationQueryMode = "legacy";

      try {
        return await fetchLegacyNotificationRows(supabase, user.id, safeOffset, safeLimit);
      } catch (legacyError) {
        if (isNotificationSchemaCompatibilityError(legacyError)) {
          notificationQueryMode = "unavailable";
          return [];
        }
      }
    }

    throw new Error("알림을 불러오지 못했습니다.");
  }

  return (data || []).map((row) => normalizeNotificationRecord(row)).filter(Boolean);
}

export async function fetchUnreadFollowNotificationCount() {
  const supabase = ensureSupabase();
  const user = await getUser();

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

  const { count, error } = await supabase
    .from("profile_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("event_type", "follow")
    .is("read_at", null);

  if (error) {
    if (isNotificationSchemaCompatibilityError(error)) {
      notificationQueryMode = "legacy";
      const rows = await fetchFollowNotifications({ offset: 0, limit: 100 });
      return rows.filter((row) => !row?.read_at).length;
    }

    throw new Error("읽지 않은 알림 수를 불러오지 못했습니다.");
  }

  return Number(count || 0);
}

export async function markFollowNotificationsRead() {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 알림을 확인할 수 있습니다.");
  }

  const readAt = new Date().toISOString();

  if (notificationQueryMode === "unavailable" || notificationQueryMode === "legacy") {
    return readAt;
  }

  const { error } = await supabase
    .from("profile_notifications")
    .update({ read_at: readAt })
    .eq("user_id", user.id)
    .eq("event_type", "follow")
    .is("read_at", null);

  if (error) {
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

export async function uploadProfileImage(file) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
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
  const uploadOptions = {
    cacheControl: "3600",
    upsert: false,
  };

  if (safeContentType) {
    uploadOptions.contentType = safeContentType;
  }

  let uploadError = null;

  const uploadAttempt = await supabase.storage
    .from("profile-images")
    .upload(filePath, file, uploadOptions);
  uploadError = uploadAttempt.error;

  if (uploadError && typeof file?.arrayBuffer === "function") {
    const bytes = await file.arrayBuffer();
    const retryBody = new Blob([bytes], {
      type: safeContentType || "application/octet-stream",
    });
    const retryAttempt = await supabase.storage
      .from("profile-images")
      .upload(filePath, retryBody, uploadOptions);
    uploadError = retryAttempt.error;
  }

  if (uploadError) {
    throw normalizeStorageUploadError(uploadError, {
      originalMimeType: normalizedMimeType,
      safeContentType,
    });
  }

  const { data } = supabase.storage
    .from("profile-images")
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: data.publicUrl,
  };
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
