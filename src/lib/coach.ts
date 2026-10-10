import { createServerFn } from "@tanstack/react-start";

const SYSTEM = `You are the runway coach inside Cosplay Calendar. Help one cosplayer plan a single convention: packing, call times, stage presence, and budget. You are not a general assistant.

Reply in the locale code you are given. Under 220 words. Order:
1. Plan — tie it to this show, this trip, and the model. Call win chance a model estimate, not a promise.
2. Call-time schedule — concrete local times, or say a time is unknown and give a relative offset.
3. Packing — a short checklist justified by the trip.
4. Budget tradeoffs — one cheaper option and one spend-up, marked estimate when the input says so.

Never present an estimated purse or fare as official. No medical or legal advice. Do not ask for or repeat an API key. If the request is off-topic, refuse in one sentence and steer back to this show.`;

type AskInput = {
  prompt: string;
  locale: string;
  context: string;
  userKey: string;
  hosted: boolean;
};

function readAsk(input: unknown): AskInput {
  const o = (input ?? {}) as Partial<AskInput>;
  const prompt = String(o.prompt ?? "").trim().slice(0, 1800);
  if (!prompt) throw new Error("Write a note first");
  return {
    prompt,
    locale: String(o.locale ?? "en").slice(0, 16),
    context: String(o.context ?? "").slice(0, 4000),
    userKey: String(o.userKey ?? "").trim().slice(0, 240),
    hosted: Boolean(o.hosted),
  };
}

async function complete(key: string, system: string, user: string, maxTokens: number) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
  const body = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  return { ok: true as const, text: body.choices?.[0]?.message?.content ?? "" };
}

function pickKey(userKey: string, hosted: boolean) {
  if (userKey.length > 12) return userKey;
  if (!hosted) return "";
  return process.env.XAI_API_KEY ?? "";
}

export const askCoach = createServerFn({ method: "POST" })
  .validator(readAsk)
  .handler(async ({ data }) => {
    const key = pickKey(data.userKey, data.hosted);
    if (!key) return { ok: false as const, error: "No API key" };
    return complete(
      key,
      `${SYSTEM}\nLocale: ${data.locale}`,
      `Locale: ${data.locale}\n\nContext:\n${data.context}\n\nRequest:\n${data.prompt}`,
      480,
    );
  });

export const translatePack = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const o = (input ?? {}) as { locale?: string; userKey?: string; hosted?: boolean; pack?: Record<string, string> };
    const locale = String(o.locale ?? "").slice(0, 16);
    if (!locale) throw new Error("Missing locale");
    const pack = o.pack && typeof o.pack === "object" ? o.pack : {};
    const slim: Record<string, string> = {};
    for (const [k, v] of Object.entries(pack).slice(0, 80)) {
      slim[k] = String(v).slice(0, 240);
    }
    return {
      locale,
      userKey: String(o.userKey ?? "").trim().slice(0, 240),
      hosted: Boolean(o.hosted),
      pack: slim,
    };
  })
  .handler(async ({ data }) => {
    const key = pickKey(data.userKey, data.hosted);
    if (!key) return { ok: false as const, error: "No API key" };
    const result = await complete(
      key,
      "You translate UI strings. Return only a JSON object with the same keys. No markdown. Keep proper nouns Cosplay Calendar, xAI, Grok, Cloudflare.",
      `Translate every value into locale ${data.locale}.\n${JSON.stringify(data.pack)}`,
      1400,
    );
    if (!result.ok) return result;
    const raw = result.text.trim().replace(/^```json\s*|```$/g, "");
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (!parsed || typeof parsed !== "object") {
        return { ok: false as const, error: "Translator returned no strings" };
      }
      return { ok: true as const, text: result.text, pack: parsed };
    } catch {
      return { ok: false as const, error: "Translator returned invalid JSON" };
    }
  });
