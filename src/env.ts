export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ALLOWED_USER_IDS: string;
  /** JSON map of Telegram user id -> display name, e.g. {"111111111":"Alice"} */
  USER_NAMES: string;
  /** Telegram user id allowed to switch the bot on/off. Optional; defaults to the first id in ALLOWED_USER_IDS. */
  ADMIN_USER_ID?: string;
  /** Gemini API key (free tier) for the AI-powered narrator/gift-suggestion features. Optional. */
  GEMINI_API_KEY?: string;
}

export function parseAllowedIds(env: Env): number[] {
  return (env.ALLOWED_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

export function getAdminId(env: Env): number | null {
  const explicit = Number((env.ADMIN_USER_ID || "").trim());
  if (explicit) return explicit;
  return parseAllowedIds(env)[0] ?? null;
}
