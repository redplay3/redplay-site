import { NextResponse } from "next/server";

const TEST_MODEL = "@cf/google/gemma-4-26b-a4b-it";

function errorsOf(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.errors)) return [];
  return root.errors.slice(0, 2).map((value) => {
    if (!value || typeof value !== "object") return { message: String(value) };
    const row = value as Record<string, unknown>;
    return { code: row.code ?? null, message: row.message ?? null };
  });
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false, stage: "preview_only" }, { status: 404 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || "";
  const env = {
    accountIdPresent: Boolean(accountId),
    accountIdLength: accountId.length,
    tokenPresent: Boolean(apiToken),
    tokenPrefix: apiToken ? apiToken.slice(0, 5) : null,
    tokenLength: apiToken.length,
  };

  if (!accountId || !apiToken) return NextResponse.json({ ok: false, stage: "env", env });

  const verifyResponse = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  const verifyPayload = await verifyResponse.json() as Record<string, unknown>;
  if (!verifyResponse.ok || verifyPayload.success !== true) {
    return NextResponse.json({ ok: false, stage: "token_verify", env, verify: { httpStatus: verifyResponse.status, errors: errorsOf(verifyPayload) } });
  }

  const runResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${TEST_MODEL}`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Reply with OK only.", max_tokens: 8, stream: false }),
    cache: "no-store",
  });
  const runPayload = await runResponse.json() as Record<string, unknown>;
  return NextResponse.json({
    ok: runResponse.ok && runPayload.success !== false,
    stage: "workers_ai_run",
    env,
    verify: { httpStatus: verifyResponse.status, success: true },
    run: { httpStatus: runResponse.status, success: runPayload.success === true, hasResult: Boolean(runPayload.result), errors: errorsOf(runPayload) },
  });
}
