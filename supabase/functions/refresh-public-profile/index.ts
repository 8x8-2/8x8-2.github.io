import { createClient } from "npm:@supabase/supabase-js@2";

import { buildProfileDerivedFieldsFromInput } from "../../../src/shared/profile-derived.js";
import {
  getKstDateParts,
  getPublicProfileRefreshState,
  refreshPublicProfileSnapshot,
} from "../../../src/shared/profile-insights.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getProfileRefreshDecision(profile: Record<string, unknown> | null, now = new Date()) {
  const refreshState = getPublicProfileRefreshState(profile?.public_snapshot, now);
  const missingBaseFields = !profile
    || !profile.day_pillar_key
    || !profile.preview_summary
    || !profile.element_class;

  return {
    refreshState,
    missingBaseFields,
    needsRefresh: missingBaseFields || refreshState.needsRefresh,
    requiresFullRebuild: missingBaseFields || refreshState.requiresFullRebuild,
  };
}

function buildRefreshPayload(profile: Record<string, unknown> | null, fields: Record<string, unknown>) {
  const publicSnapshot = fields.public_snapshot || profile?.public_snapshot || null;

  return {
    generatedDateKst: publicSnapshot?.meta?.generated_date_kst || null,
    generatedMonthKst: publicSnapshot?.meta?.generated_month_kst || null,
    generatedYearKst: publicSnapshot?.meta?.generated_year_kst || null,
    previewSummary: fields.preview_summary || profile?.preview_summary || null,
    dayPillarKey: fields.day_pillar_key || profile?.day_pillar_key || publicSnapshot?.dayPillar?.key || null,
    dayPillarHanja: fields.day_pillar_hanja || publicSnapshot?.dayPillar?.hanja || null,
    dayPillarMetaphor: fields.day_pillar_metaphor || publicSnapshot?.dayPillar?.metaphor || null,
    elementClass: fields.element_class || profile?.element_class || publicSnapshot?.dayPillar?.elementClass || null,
    publicSnapshot,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  let payload: { stellarId?: number | string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const stellarId = String(payload?.stellarId || "").trim();
  if (!/^[1-9]\d{0,15}$/.test(stellarId)) {
    return json({ error: "invalid_stellar_id" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`
      id,
      stellar_id,
      gender,
      calendar_type,
      is_leap_month,
      birth_year,
      birth_month,
      birth_day,
      birth_hour,
      birth_minute,
      birth_time_known,
      day_pillar_key,
      preview_summary,
      element_class,
      public_snapshot
    `)
    .eq("stellar_id", stellarId)
    .maybeSingle();

  if (profileError) {
    return json({
      error: "profile_lookup_failed",
      detail: profileError.message,
    }, 500);
  }

  if (!profile) {
    return json({ error: "profile_not_found" }, 404);
  }

  if (!profile.birth_year || !profile.birth_month || !profile.birth_day || !profile.gender) {
    return json({ error: "profile_birth_data_incomplete" }, 409);
  }

  const now = new Date();
  const refreshDecision = getProfileRefreshDecision(profile, now);

  if (!refreshDecision.needsRefresh) {
    return json({
      refreshed: false,
      stellarId,
      refreshScope: "none",
      generatedDateKst: profile.public_snapshot?.meta?.generated_date_kst || null,
    });
  }

  const kstDate = getKstDateParts(now);
  let fields: Record<string, unknown>;
  let refreshScope = "insights";

  if (refreshDecision.requiresFullRebuild) {
    ({ fields } = buildProfileDerivedFieldsFromInput({
      birthYear: profile.birth_year,
      birthMonth: profile.birth_month,
      birthDay: profile.birth_day,
      birthHour: profile.birth_hour,
      birthMinute: profile.birth_minute,
      birthTimeKnown: profile.birth_time_known,
      calendarType: profile.calendar_type,
      isLeapMonth: profile.is_leap_month,
      gender: profile.gender,
    }, {
      currentDate: kstDate.referenceDate,
    }));
    refreshScope = "full";
  } else {
    const refreshedSnapshot = refreshPublicProfileSnapshot(profile.public_snapshot, kstDate.referenceDate);
    if (!refreshedSnapshot) {
      return json({ error: "snapshot_refresh_failed" }, 500);
    }

    fields = {
      public_snapshot: refreshedSnapshot,
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", profile.id);

  if (updateError) {
    return json({
      error: "profile_update_failed",
      detail: updateError.message,
    }, 500);
  }

  return json({
    refreshed: true,
    stellarId,
    refreshScope,
    ...buildRefreshPayload(profile, fields),
  });
});
