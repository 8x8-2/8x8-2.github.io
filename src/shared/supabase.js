import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

let supabaseClient = null;

function getHeaderValue(headers, key) {
  return String(headers.get(key) || "").trim();
}

export function createSupabaseHeaders({ accessToken = null, headers: sourceHeaders = null } = {}) {
  const headers = new Headers(sourceHeaders || {});
  const safePublishableKey = String(supabasePublishableKey || "").trim();
  const safeAccessToken = String(accessToken || "").trim();

  if (!getHeaderValue(headers, "apikey") && safePublishableKey) {
    headers.set("apikey", safePublishableKey);
  }

  const existingAuthorization = getHeaderValue(headers, "Authorization");
  const hasBearerToken = /^Bearer\s+\S+/i.test(existingAuthorization);
  if (!hasBearerToken && safeAccessToken) {
    headers.set("Authorization", `Bearer ${safeAccessToken}`);
  }

  return headers;
}

function withSupabaseHeaders(input, init = {}) {
  const sourceHeaders = input instanceof Request
    ? new Headers(input.headers)
    : new Headers();

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      sourceHeaders.set(key, value);
    });
  }

  const headers = createSupabaseHeaders({
    headers: sourceHeaders,
  });

  return fetch(input, {
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

export function createSupabaseUrl(path = "/") {
  return new URL(path, supabaseUrl);
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  if (!supabaseClient) {
    const projectRef = (() => {
      try {
        return new URL(supabaseUrl).host.split(".")[0] || "supabase";
      } catch {
        return "supabase";
      }
    })();

    supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          apikey: supabasePublishableKey,
        },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: `sb-${projectRef}-auth-token`,
      },
    });
  }

  return supabaseClient;
}
