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

function readEnv(name: string, fallback = "") {
  return String(Deno.env.get(name) || fallback).trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ queued: false, reason: "method_not_allowed" }, 405);
  }

  const githubToken = readEnv("GITHUB_REBUILD_TOKEN");
  const githubRepository = readEnv("GITHUB_REPOSITORY");
  const githubWorkflow = readEnv("GITHUB_DEPLOY_WORKFLOW", "deploy-pages.yml");
  const githubRef = readEnv("GITHUB_DEPLOY_REF", "main");

  if (!githubToken || !githubRepository) {
    return json({
      queued: false,
      reason: "missing_github_env",
    });
  }

  let payload: {
    reason?: string;
    stellarId?: string | number;
  } = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const triggerSource = String(payload?.reason || "profile_update").trim() || "profile_update";
  const stellarId = String(payload?.stellarId || "").trim();

  if (stellarId && !/^[1-9]\d{0,15}$/.test(stellarId)) {
    return json({
      queued: false,
      reason: "invalid_stellar_id",
    });
  }

  const dispatchResponse = await fetch(
    `https://api.github.com/repos/${githubRepository}/actions/workflows/${encodeURIComponent(githubWorkflow)}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: githubRef,
        inputs: {
          trigger_source: triggerSource,
          stellar_id: stellarId,
        },
      }),
    },
  );

  if (dispatchResponse.ok) {
    return json({
      queued: true,
      workflow: githubWorkflow,
      ref: githubRef,
      stellarId: stellarId || null,
      triggerSource,
    });
  }

  return json({
    queued: false,
    reason: "github_dispatch_failed",
    status: dispatchResponse.status,
    detail: await dispatchResponse.text(),
    workflow: githubWorkflow,
    ref: githubRef,
  });
});
