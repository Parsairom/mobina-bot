import type { Env } from "./env";

// Strips lone (unpaired) UTF-16 surrogates. Telegram hard-rejects any
// sendMessage call containing one, and since every outgoing message runs
// through getUserName, one bad byte here would break the entire bot.
function stripLoneSurrogates(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

// Deliberately not cached at module scope: a Worker isolate can stay warm
// and keep serving requests for a long time, and a stale in-memory cache
// would keep echoing an old (possibly bad) secret value forever, invisible
// to every later `wrangler secret put` / deploy. This parse is cheap enough
// to redo on every call.
function namesMap(env: Env): Record<string, string> {
  try {
    const parsed = JSON.parse(env.USER_NAMES || "{}") as Record<string, string>;
    return Object.fromEntries(Object.entries(parsed).map(([id, name]) => [id, stripLoneSurrogates(name)]));
  } catch {
    return {};
  }
}

export function getUserName(env: Env, userId: number): string {
  return namesMap(env)[String(userId)] ?? "عزیزم";
}
