import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

let supabaseClient = null;

async function withSupabaseHeaders(input, init = {}) {
  const requestUrl = new URL(typeof input === "string" ? input : input.url);
  const headers = new Headers(init.headers || {});

  if (requestUrl.origin === supabaseUrl) {
    requestUrl.searchParams.set("apikey", supabasePublishableKey);
  }

  if (!headers.has("apikey")) {
    headers.set("apikey", supabasePublishableKey);
  }

  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${supabasePublishableKey}`);
  }

  return fetch(requestUrl, {
    ...init,
    headers,
  });
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  };
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          apikey: supabasePublishableKey,
        },
        fetch: withSupabaseHeaders,
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}
