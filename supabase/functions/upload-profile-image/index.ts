import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCorsHeaders(origin),
  });
}

function getBearerToken(authHeader: string | null) {
  return String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
}

function normalizeExtension(file: File) {
  const type = String(file.type || "").toLowerCase();
  if (type === "image/png") return { extension: "png", mimeType: "image/png" };
  if (type === "image/jpeg" || type === "image/jpg") return { extension: "jpg", mimeType: "image/jpeg" };
  if (type === "image/webp") return { extension: "webp", mimeType: "image/webp" };
  if (type === "image/gif") return { extension: "gif", mimeType: "image/gif" };

  const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  if (extension === "png") return { extension: "png", mimeType: "image/png" };
  if (extension === "jpg" || extension === "jpeg") return { extension: "jpg", mimeType: "image/jpeg" };
  if (extension === "webp") return { extension: "webp", mimeType: "image/webp" };
  if (extension === "gif") return { extension: "gif", mimeType: "image/gif" };

  return { extension: "", mimeType: type };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = getBearerToken(request.headers.get("Authorization"));

  if (!supabaseUrl || !serviceRoleKey || !(anonKey || serviceRoleKey)) {
    return json({ error: "missing_supabase_env" }, 500, origin);
  }

  if (!accessToken) {
    return json({ error: "unauthorized" }, 401, origin);
  }

  const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const authResult = await authClient.auth.getUser(accessToken);
  const userId = authResult.data.user?.id || null;

  if (authResult.error || !userId) {
    return json({
      error: "unauthorized",
      detail: authResult.error?.message || null,
    }, 401, origin);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "invalid_form_data" }, 400, origin);
  }

  const fileValue = formData.get("file") || formData.get("");
  if (!(fileValue instanceof File)) {
    return json({ error: "missing_file" }, 400, origin);
  }

  const { extension, mimeType } = normalizeExtension(fileValue);
  if (!extension || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return json({ error: "invalid_mime_type", detail: mimeType || "unknown" }, 400, origin);
  }

  if (fileValue.size > 5 * 1024 * 1024) {
    return json({ error: "file_too_large" }, 400, origin);
  }

  const requestedPath = String(formData.get("path") || "").trim();
  const fallbackPath = `${userId}/avatar-${crypto.randomUUID()}.${extension}`;
  const filePath = requestedPath || fallbackPath;

  if (!filePath.startsWith(`${userId}/`)) {
    return json({ error: "invalid_path" }, 403, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: uploadError } = await adminClient.storage
    .from("profile-images")
    .upload(filePath, fileValue, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return json({
      error: "storage_upload_failed",
      detail: uploadError.message,
      statusCode: uploadError.statusCode || uploadError.status || null,
    }, Number(uploadError.status || 400), origin);
  }

  const { data } = adminClient.storage
    .from("profile-images")
    .getPublicUrl(filePath);

  return json({
    path: filePath,
    publicUrl: data.publicUrl,
  }, 200, origin);
});
