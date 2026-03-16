import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

let supabaseClient = null;

export function createSupabaseHeaders({ accessToken = null, headers: sourceHeaders = null } = {}) {
  const headers = new Headers(sourceHeaders || {});

  if (!headers.has("apikey")) {
    headers.set("apikey", supabasePublishableKey);
  }

  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken || supabasePublishableKey}`);
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

  if (input instanceof Request) {
    return fetch(new Request(input, {
      ...init,
      headers,
    }));
  }

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
