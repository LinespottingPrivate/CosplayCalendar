/**
 * POST /api/coach — Cloudflare Worker (module syntax).
 *
 * Deployer key (used only when the request does not send a non-empty userKey):
 *   npx wrangler secret put XAI_API_KEY
 *
 * A $9 pass is NOT charged here — the key is the visitor's or the deployer's.
 * This worker does not sell, redeem, or bill any pass. It only forwards one
 * chat completion to xAI. Quota is spent on the visitor's userKey when that
 * field is a non-empty string; otherwise it is spent on the deployer's
 * XAI_API_KEY secret. The key is never logged and never returned.
 */
export interface Env {
  XAI_API_KEY?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

type OkBody = { ok: true; text: string };
type ErrBody = { ok: false; error: string };

function json(body: OkBody | ErrBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function bearerFrom(userKey: unknown, envKey: string | undefined): string | null {
  if (typeof userKey === "string" && userKey.length > 0) return userKey;
  if (typeof envKey === "string" && envKey.length > 0) return envKey;
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/coach") {
      return json({ ok: false, error: "Not found" }, 404);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    if (payload === null || typeof payload !== "object") {
      return json({ ok: false, error: "Expected a JSON object" }, 400);
    }

    const { prompt, locale, userKey } = payload as {
      prompt?: unknown;
      locale?: unknown;
      userKey?: unknown;
    };

    if (typeof prompt !== "string" || prompt.length === 0) {
      return json({ ok: false, error: "prompt must be a non-empty string" }, 400);
    }
    if (typeof locale !== "string") {
      return json({ ok: false, error: "locale must be a string" }, 400);
    }

    const apiKey = bearerFrom(userKey, env.XAI_API_KEY);
    if (!apiKey) {
      return json({ ok: false, error: "No API key" }, 401);
    }

    let upstream: Response;
    try {
      upstream = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 480,
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: `You are a coach. Reply in locale ${JSON.stringify(locale)}. Be direct and practical.`,
            },
            { role: "user", content: prompt },
          ],
        }),
      });
    } catch {
      return json({ ok: false, error: "Upstream request failed" }, 502);
    }

    if (!upstream.ok) {
      return json({ ok: false, error: `xAI API error ${upstream.status}` }, 502);
    }

    let data: { choices?: { message?: { content?: string | null } }[] };
    try {
      data = (await upstream.json()) as {
        choices?: { message?: { content?: string | null } }[];
      };
    } catch {
      return json({ ok: false, error: "Invalid upstream response" }, 502);
    }

    const text = data.choices?.[0]?.message?.content ?? "";
    return json({ ok: true, text });
  },
};
