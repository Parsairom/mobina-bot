import { Api } from "grammy";

import { DAILY_CHALLENGES, WEEKLY_CHALLENGES } from "./content";
import * as db from "./db";
import { daysUntil, nextOccurrence, parseISODate, todayUTC, toISODate, yearsSince } from "./dates";
import { type Env, parseAllowedIds } from "./env";
import { formatMemoryCaption } from "./format";
import { MOOD_LABELS, moodKeyboard } from "./keyboards";
import { getUserName } from "./names";

const REMINDER_DAYS_BEFORE = new Set([30, 14, 7, 3, 1, 0]);

async function broadcastText(api: Api, ids: number[], text: string): Promise<void> {
  for (const id of ids) {
    try {
      await api.sendMessage(id, text);
    } catch (err) {
      console.error(`failed to send message to ${id}`, err);
    }
  }
}

async function broadcastPhoto(api: Api, ids: number[], fileId: string, caption: string): Promise<void> {
  for (const id of ids) {
    try {
      await api.sendPhoto(id, fileId, { caption });
    } catch (err) {
      console.error(`failed to send photo to ${id}`, err);
    }
  }
}

async function checkAnniversaries(env: Env, api: Api, ids: number[]): Promise<void> {
  const today = todayUTC();
  const anniversaries = await db.listAnniversaries(env.DB);

  for (const a of anniversaries) {
    const recurring = !!a.recurring;
    const d = daysUntil(a.event_date, recurring, today);
    if (!REMINDER_DAYS_BEFORE.has(d)) continue;

    const occurrenceYear = nextOccurrence(a.event_date, recurring, today).getUTCFullYear();
    if (await db.wasReminderSent(env.DB, a.id, occurrenceYear, d)) continue;

    let text: string;
    if (d === 0) {
      const years = yearsSince(a.event_date, today);
      text = `🎉 امروز سالگرد «${a.name}»ـه! (${years} سال گذشته دیگه، باورتون میشه؟) 💜`;
    } else {
      text = `⏳ ${d} روز تا سالگرد «${a.name}» مونده، حسابی منتظرشیم 💫`;
    }

    await broadcastText(api, ids, text);
    await db.markReminderSent(env.DB, a.id, occurrenceYear, d);
  }
}

async function checkOnThisDay(env: Env, api: Api, ids: number[]): Promise<void> {
  const today = todayUTC();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const memories = await db.findMemoriesOnMonthDay(env.DB, month, day, today.getUTCFullYear());

  for (const m of memories) {
    if (await db.wasOnThisDaySent(env.DB, m.id, today.getUTCFullYear())) continue;

    const memoryYear = Number(m.memory_date.slice(0, 4));
    const yearsAgo = today.getUTCFullYear() - memoryYear;
    const caption = `📸 ${yearsAgo} سال پیش، دقیقاً همین روز، این خاطره رو ثبت کردید 💜\n\n${formatMemoryCaption(m)}`;

    if (m.file_id) {
      await broadcastPhoto(api, ids, m.file_id, caption);
    } else {
      await broadcastText(api, ids, caption);
    }
    await db.markOnThisDaySent(env.DB, m.id, today.getUTCFullYear());
  }
}

async function monthlyRecap(env: Env, api: Api, ids: number[]): Promise<void> {
  const today = todayUTC();
  if (today.getUTCDate() !== 1) return;

  const lastDayPrevMonth = new Date(today.getTime() - 86_400_000);
  const start = toISODate(new Date(Date.UTC(lastDayPrevMonth.getUTCFullYear(), lastDayPrevMonth.getUTCMonth(), 1)));
  const end = toISODate(today);

  const count = await db.countMemoriesBetween(env.DB, start, end);
  if (count === 0) return;

  await broadcastText(api, ids, `📅 ماه گذشته با هم ${count} خاطره‌ی قشنگ ساختید 💜`);
}

async function deliverDueSecretMessages(env: Env, api: Api): Promise<void> {
  const today = toISODate(todayUTC());
  const due = await db.findDueSecretMessages(env.DB, today);

  for (const m of due) {
    const fromName = getUserName(env, m.from_user_id);
    const text = m.hint
      ? `💌 یه پیام مخفی که ${fromName} برات نوشته بود رسید:\n(${m.hint})\n\n${m.content}`
      : `💌 یه پیام از ${fromName} برات رسید:\n\n${m.content}`;
    try {
      await api.sendMessage(m.to_user_id, text);
      await db.markSecretMessageDelivered(env.DB, m.id);
    } catch (err) {
      console.error(`secret message delivery failed for ${m.id}`, err);
    }
  }
}

const LOCATION_REMINDER_COOLDOWN_DAYS = 90;

async function checkLocationReminders(env: Env, api: Api, ids: number[]): Promise<void> {
  const today = todayUTC();
  const visits = await db.getLastVisitPerLocation(env.DB);

  for (const visit of visits) {
    const daysSinceVisit = Math.floor((today.getTime() - parseISODate(visit.last_visit).getTime()) / 86_400_000);
    if (daysSinceVisit < LOCATION_REMINDER_COOLDOWN_DAYS) continue;

    const lastReminded = await db.getLocationReminderDate(env.DB, visit.location);
    if (lastReminded) {
      const daysSinceReminder = Math.floor((today.getTime() - parseISODate(lastReminded).getTime()) / 86_400_000);
      if (daysSinceReminder < LOCATION_REMINDER_COOLDOWN_DAYS) continue;
    }

    const months = Math.floor(daysSinceVisit / 30);
    await broadcastText(
      api,
      ids,
      `😄 ${months} ماهه که نرفتید «${visit.location}» — دلمون براش تنگ شده، نظرتون چیه یه سر بزنید؟`
    );
    await db.setLocationReminderDate(env.DB, visit.location, toISODate(today));
  }
}

async function sendWeeklyChallenge(env: Env, api: Api, ids: number[]): Promise<void> {
  const challenge = await db.pickUnusedPrompt(env.DB, "weekly_challenge", WEEKLY_CHALLENGES);
  await broadcastText(api, ids, `🎯 چالش این هفته:\n\n${challenge}`);
}

async function postDailyChallenge(env: Env, api: Api, ids: number[]): Promise<void> {
  const today = toISODate(todayUTC());
  const existing = await db.getDailyChallenge(env.DB, today);
  if (existing) return;

  const text = await db.pickUnusedPrompt(env.DB, "daily_challenge", DAILY_CHALLENGES);
  await db.logDailyChallenge(env.DB, today, text);
  await broadcastText(api, ids, `📆 چالش امروز:\n\n${text}\n\nهر وقت انجامش دادید از «📆 چالش روزانه» توی منوی بازی‌ها بزنید ✅`);
}

async function sendMoodPrompt(env: Env, api: Api, ids: number[]): Promise<void> {
  for (const id of ids) {
    const name = getUserName(env, id);
    try {
      await api.sendMessage(id, `${name} جان، امروز دلت چطوره؟ 💜`, { reply_markup: moodKeyboard() });
    } catch (err) {
      console.error(`mood prompt failed for ${id}`, err);
    }
  }
}

async function sendWeeklyMoodSummary(env: Env, api: Api, ids: number[]): Promise<void> {
  const today = todayUTC();
  const weekAgo = toISODate(new Date(today.getTime() - 6 * 86_400_000));
  const moods = await db.getMoodsSince(env.DB, weekAgo);
  if (moods.length === 0) return;

  const lines: string[] = ["📊 مرور حال‌وهوای این هفته‌ی عشقتون:"];

  for (const userId of ids) {
    const userMoods = moods.filter((m) => m.user_id === userId);
    if (userMoods.length === 0) continue;

    const counts: Record<string, number> = {};
    for (const m of userMoods) counts[m.mood] = (counts[m.mood] ?? 0) + 1;

    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([mood, count]) => `${MOOD_LABELS[mood] ?? mood} ×${count}`)
      .join("، ");

    lines.push(`${getUserName(env, userId)}: ${summary}`);
  }

  await broadcastText(api, ids, lines.join("\n"));
}

export async function runMorningJob(env: Env): Promise<void> {
  const ids = parseAllowedIds(env);
  if (ids.length === 0) return;

  const api = new Api(env.BOT_TOKEN);

  await checkAnniversaries(env, api, ids);
  await checkOnThisDay(env, api, ids);
  await monthlyRecap(env, api, ids);
  await deliverDueSecretMessages(env, api);
  await checkLocationReminders(env, api, ids);
  await postDailyChallenge(env, api, ids);

  if (todayUTC().getUTCDay() === 6) {
    // Saturday: start of the Iranian work week.
    await sendWeeklyChallenge(env, api, ids);
  }
}

export async function runEveningJob(env: Env): Promise<void> {
  const ids = parseAllowedIds(env);
  if (ids.length === 0) return;

  const api = new Api(env.BOT_TOKEN);

  if (todayUTC().getUTCDay() === 5) {
    // Friday evening: wrap up the week before the weekend.
    await sendWeeklyMoodSummary(env, api, ids);
  }
  await sendMoodPrompt(env, api, ids);
}
