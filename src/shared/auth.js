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

export async function fetchProfile(userId = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const resolvedUserId = userId || (await getUser())?.id;
  if (!resolvedUserId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", resolvedUserId)
    .maybeSingle();

  if (error) throw new Error("프로필을 불러오지 못했습니다.");
  return data;
}

export async function updateProfile(updates) {
  const supabase = ensureSupabase();
  const user = await getUser();

  if (!user) {
    throw new Error("로그인 후 내 정보를 수정할 수 있습니다.");
  }

  const payload = {
    ...updates,
    phone: updates.phone || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error("내 정보를 저장하지 못했습니다.");
  }

  try {
    await supabase.auth.updateUser({
      data: {
        full_name: data.full_name,
        gender: data.gender,
        phone: data.phone || "",
        calendar_type: data.calendar_type,
        is_leap_month: data.is_leap_month,
        birth_year: data.birth_year,
        birth_month: data.birth_month,
        birth_day: data.birth_day,
        birth_hour: data.birth_time_known ? data.birth_hour : "",
        birth_minute: data.birth_time_known ? data.birth_minute : "",
        birth_time_known: data.birth_time_known,
        marketing_opt_in: data.marketing_opt_in,
      },
    });
  } catch {
    // profiles 테이블이 실제 표시용 데이터 소스라서, 메타데이터 동기화 실패는 저장 실패로 보지 않습니다.
  }

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
