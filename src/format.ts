import type { Memory } from "./db";
import { formatJalali } from "./jalali";

export function formatMemoryCaption(m: Memory): string {
  const parts = [`📅 ${formatJalali(m.memory_date)}`];
  if (m.location) parts.push(`📍 ${m.location}`);
  if (m.caption) parts.push(m.caption);
  return parts.join("\n");
}
