import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function getUserIdFromAuthHeader(authHeader: string | null) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const decoded = decodeBase64Url(payload);
    const claims = JSON.parse(decoded);
    return typeof claims?.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
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
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const userId = getUserIdFromAuthHeader(request.headers.get("Authorization"));

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  if (!userId) {
    return json({ error: "unauthorized" }, 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "invalid_form_data" }, 400);
  }

  const fileValue = formData.get("file") || formData.get("");
  if (!(fileValue instanceof File)) {
    return json({ error: "missing_file" }, 400);
  }

  const { extension, mimeType } = normalizeExtension(fileValue);
  if (!extension || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return json({ error: "invalid_mime_type", detail: mimeType || "unknown" }, 400);
  }

  if (fileValue.size > 5 * 1024 * 1024) {
    return json({ error: "file_too_large" }, 400);
  }

  const requestedPath = String(formData.get("path") || "").trim();
  const fallbackPath = `${userId}/avatar-${crypto.randomUUID()}.${extension}`;
  const filePath = requestedPath || fallbackPath;

  if (!filePath.startsWith(`${userId}/`)) {
    return json({ error: "invalid_path" }, 403);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: uploadError } = await supabase.storage
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
    }, Number(uploadError.status || 400));
  }

  const { data } = supabase.storage
    .from("profile-images")
    .getPublicUrl(filePath);

  return json({
    path: filePath,
    publicUrl: data.publicUrl,
  });
});
