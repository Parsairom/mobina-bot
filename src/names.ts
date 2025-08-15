import type { Env } from "./env";

let cache: Record<string, string> | null = null;

function namesMap(env: Env): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(env.USER_NAMES || "{}");
  } catch {
    cache = {};
  }
  return cache!;
}

export function getUserName(env: Env, userId: number): string {
  return namesMap(env)[String(userId)] ?? "عزیزم";
}
