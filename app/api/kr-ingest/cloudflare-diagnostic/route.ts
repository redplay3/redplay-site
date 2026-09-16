import { NextResponse } from "next/server";

const DIAG_KEY = "redplay-cfdiag-16092026";
const TEST_MODEL = "@cf/google/gemma-4-26b-a4b-it";

function compactError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const errors = Array.isArray(root.errors) ? root.errors : [];
  return errors.slice(0, 3).map((entry) => {
    if (!entry || typeof entry !== "object") return String(entry);
    const row = entry as Record<string, unknown>;
    return { code: row.code ?? null, message: row.message ?? null };
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== DIAG_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || "";

  const base = {
    env: {
      accountIdPresent: Boolean(accountId),
      accountIdLength: accountId.length,
      tokenPresent: Boolean(apiToken),
      tokenPrefix: apiToken ? apiToken.slice(0, 5) : null,
      tokenLength: apiToken.length,
    },
  };

  if (!accountId || !apiToken) {
    return NextResponse.json({ ...base, stage: "env", ok: false });
  }

  try {
    const verifyResponse = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { authorization: `Bearer ${apiToken}` },
      cache: "no-store",
    });
    const verifyPayload = await verifyResponse.json() as Record<string, unknown>;
    const verify = {
      httpStatus: verifyResponse.status,
      success: verifyPayload.success === true,
      status: verifyPayload.result && typeof verifyPayload.result === "object"
        ? (verifyPayload.result as Record<string, unknown>).status ?? null
        : null,
      errors: compactError(verifyPayload),
    };

    if (!verifyResponse.ok || verifyPayload.success !== true) {
      return NextResponse.json({ ...base, stage: "token_verify", ok: false, verify });
    }

    const runResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${TEST_MODEL}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ prompt: "Reply with OK only.", max_tokens: 8, stream: false }),
        cache: "no-store",
      },
    );
    const runPayload = await runResponse.json() as Record<string, unknown>;
    const run = {
      httpStatus: runResponse.status,
      success: runPayload.success === true,
      errors: compactError(runPayload),
      hasResult: Boolean(runPayload.result),
    };

    return NextResponse.json({
      ...base,
      stage: "workers_ai_run",
      ok: runResponse.ok && runPayload.success !== false,
      verify,
      run,
    });
  } catch (error) {
    return NextResponse.json({
      ...base,
      stage: "exception",
      ok: false,
      error: error instanceof Error ? error.message : "Unknown diagnostic error",
    }, { status: 500 });
  }
}
