export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function nextOccurrence(eventDateStr: string, recurring: boolean, today: Date = todayUTC()): Date {
  const eventDate = parseISODate(eventDateStr);
  if (!recurring) return eventDate;

  const thisYear = new Date(Date.UTC(today.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()));
  if (thisYear.getTime() >= today.getTime()) return thisYear;
  return new Date(Date.UTC(today.getUTCFullYear() + 1, eventDate.getUTCMonth(), eventDate.getUTCDate()));
}

export function daysUntil(eventDateStr: string, recurring: boolean, today: Date = todayUTC()): number {
  const occurrence = nextOccurrence(eventDateStr, recurring, today);
  return Math.round((occurrence.getTime() - today.getTime()) / 86_400_000);
}

export function yearsSince(eventDateStr: string, today: Date = todayUTC()): number {
  const eventDate = parseISODate(eventDateStr);
  let years = today.getUTCFullYear() - eventDate.getUTCFullYear();
  const beforeAnniversary =
    today.getUTCMonth() < eventDate.getUTCMonth() ||
    (today.getUTCMonth() === eventDate.getUTCMonth() && today.getUTCDate() < eventDate.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return years;
}
