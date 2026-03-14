import { getSupabaseClient, isSupabaseConfigured } from "./supabase.js";

function ensureSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase 연결 정보가 아직 설정되지 않았습니다.");
  }
  return supabase;
}

function normalizeAuthError(error, mode = "signin") {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return new Error("가입된 이메일이 아니거나 비밀번호가 올바르지 않습니다.");
  }

  if (message.includes("email not confirmed")) {
    return new Error("이메일 인증을 완료한 뒤 로그인해 주세요.");
  }

  if (message.includes("user already registered") || message.includes("already been registered")) {
    return new Error("이미 가입된 이메일입니다.");
  }

  if (message.includes("password should be at least")) {
    return new Error("비밀번호는 6자 이상이어야 합니다.");
  }

  if (mode === "signup" && error?.message) {
    return new Error(error.message);
  }

  return new Error(error?.message || "인증 처리 중 오류가 발생했습니다.");
}

export function getDisplayName(user, profile = null) {
  const preferred = profile?.full_name || user?.user_metadata?.full_name || user?.email || "회원";
  return String(preferred).trim() || "회원";
}

export function getProfileInitial(user, profile = null) {
  return getDisplayName(user, profile).charAt(0).toUpperCase();
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

export async function fetchProfile() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const user = await getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error("프로필을 불러오지 못했습니다.");
  return data;
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

export { isSupabaseConfigured };
