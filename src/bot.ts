import { Api, Bot, InlineKeyboard, InputFile, Keyboard, type Context } from "grammy";

import { askAi, askAiVision, isAiConfigured } from "./ai";
import {
  COUPLE_QUESTIONS,
  DARE_NORMAL,
  DARE_SPICY,
  HANGMAN_CATEGORIES,
  NEVER_HAVE_I_EVER,
  THIS_OR_THAT,
  TRUTH_NORMAL,
  TRUTH_SPICY,
  type Tier,
  WEEKLY_CHALLENGES,
} from "./content";
import * as db from "./db";
import { daysUntil, parseISODate, todayUTC, toISODate, yearsSince } from "./dates";
import { type Env, parseAllowedIds } from "./env";
import { formatMemoryCaption } from "./format";
import {
  BATTLESHIP_SIZE,
  C4_COLS,
  C4_ROWS,
  checkConnectFourWinner,
  checkTicTacToeWinner,
  dropConnectFour,
  fireAt,
  formatHand,
  handValue,
  isConnectFourFull,
  isFleetSunk,
  newShuffledDeck,
  placeShipsRandomly,
} from "./gamelogic";
import { formatJalali, parseDateInput, toLatinDigits, toPersianDigits } from "./jalali";
import { moodKeyboard } from "./keyboards";
import { getUserName } from "./names";

const DATE_HINT = "شمسی بفرست، مثلاً ۱۴۰۳-۰۵-۲۰";

const HELP_TEXT =
  "سلاااام پارسا و مبینا 💜\n" +
  "منم اون رباتی که خاطراتتون رو یادش می‌مونه، که هیچی یادتون نره.\n\n" +
  "📸 هر عکسی بفرستی خودش ذخیره می‌شه.\n" +
  "برای بقیه‌ی کارا از دکمه‌های پایین استفاده کن، یا هر وقت گم شدی /menu رو بزن.";

function mainMenuText(name: string): string {
  return `${name} جان، دلت چی می‌خواد؟ 💜`;
}

function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("➕ خاطره جدید", "menu:add_memory")
    .text("➕ سالگرد جدید", "menu:add_anniversary")
    .row()
    .text("📋 خاطرات", "menu:list_memories")
    .text("📋 سالگردها", "menu:list_anniversaries")
    .row()
    .text("📅 خلاصه این ماه", "menu:month_recap")
    .text("😊 حالم چطوره", "menu:mood")
    .row()
    .text("💌 پیام‌های مخفی", "menu:secret_messages")
    .text("📝 نکته‌های کوچیک", "menu:notes")
    .row()
    .text("🎮 بازی‌ها", "menu:games")
    .row()
    .text("💰 کیف پول مشترک", "menu:savings")
    .row()
    .text("📊 آمار بات", "menu:stats")
    .text("📤 دانلود خاطرات", "menu:export")
    .row()
    .text("🖼 کلاژ و مقایسه", "menu:photo_media")
    .row()
    .text("📖 داستان رابطه", "menu:ai_story")
    .text("🎁 پیشنهاد هدیه", "menu:ai_gift");
}

// Persistent bottom keyboard (stays docked under the chat, like most Telegram bots),
// as opposed to the inline keyboard above which is attached to one specific message.
const BTN_ADD_MEMORY = "➕ خاطره جدید";
const BTN_ADD_ANNIVERSARY = "➕ سالگرد جدید";
const BTN_LIST_MEMORIES = "📋 خاطرات";
const BTN_LIST_ANNIVERSARIES = "📋 سالگردها";
const BTN_MONTH_RECAP = "📅 خلاصه این ماه";
const BTN_MOOD = "😊 حالم چطوره";
const BTN_SECRET = "💌 پیام‌های مخفی";
const BTN_NOTES = "📝 نکته‌های کوچیک";
const BTN_GAMES = "🎮 بازی‌ها";
const BTN_SAVINGS = "💰 کیف پول مشترک";
const BTN_STATS = "📊 آمار بات";
const BTN_EXPORT = "📤 دانلود خاطرات";
const BTN_MEDIA = "🖼 کلاژ و مقایسه";
const BTN_AI_STORY = "📖 داستان رابطه";
const BTN_AI_GIFT = "🎁 پیشنهاد هدیه";

const REPLY_BUTTON_ACTIONS: Record<string, string> = {
  [BTN_ADD_MEMORY]: "add_memory",
  [BTN_ADD_ANNIVERSARY]: "add_anniversary",
  [BTN_LIST_MEMORIES]: "list_memories",
  [BTN_LIST_ANNIVERSARIES]: "list_anniversaries",
  [BTN_MONTH_RECAP]: "month_recap",
  [BTN_MOOD]: "mood",
  [BTN_SECRET]: "secret_messages",
  [BTN_NOTES]: "notes",
  [BTN_GAMES]: "games",
  [BTN_SAVINGS]: "savings",
  [BTN_STATS]: "stats",
  [BTN_EXPORT]: "export",
  [BTN_MEDIA]: "photo_media",
  [BTN_AI_STORY]: "ai_story",
  [BTN_AI_GIFT]: "ai_gift",
};

function mainReplyKeyboard(): Keyboard {
  return new Keyboard()
    .text(BTN_ADD_MEMORY)
    .text(BTN_ADD_ANNIVERSARY)
    .row()
    .text(BTN_LIST_MEMORIES)
    .text(BTN_LIST_ANNIVERSARIES)
    .row()
    .text(BTN_MONTH_RECAP)
    .text(BTN_MOOD)
    .row()
    .text(BTN_SECRET)
    .text(BTN_NOTES)
    .row()
    .text(BTN_GAMES)
    .row()
    .text(BTN_SAVINGS)
    .row()
    .text(BTN_STATS)
    .text(BTN_EXPORT)
    .row()
    .text(BTN_MEDIA)
    .row()
    .text(BTN_AI_STORY)
    .text(BTN_AI_GIFT)
    .resized();
}

function otherUserId(env: Env, fromId: number): number | null {
  const ids = parseAllowedIds(env);
  return ids.find((id) => id !== fromId) ?? null;
}

async function broadcastToBoth(api: Api, env: Env, text: string): Promise<void> {
  for (const id of parseAllowedIds(env)) {
    try {
      await api.sendMessage(id, text);
    } catch (err) {
      console.error(`broadcast failed for ${id}`, err);
    }
  }
}

async function broadcastWithKeyboard(api: Api, env: Env, text: string, keyboard: InlineKeyboard): Promise<void> {
  for (const id of parseAllowedIds(env)) {
    try {
      await api.sendMessage(id, text, { reply_markup: keyboard });
    } catch (err) {
      console.error(`broadcast (with keyboard) failed for ${id}`, err);
    }
  }
}

// Only one ongoing 2-player game session may run at a time, so starting a
// new one doesn't collide with a game already in progress.
const GAME_LABELS: Record<string, string> = {
  reaction: "⚡ بازی واکنش",
  ttt: "❌⭕ دوز",
  c4: "🔴🟡 چهار در ردیف",
  battleship: "🚢 کشتی‌جنگی",
  word_chain: "🔤 زنجیره‌ی کلمات",
  hangman: "🎪 دار",
  truth_dare: "🎲 جرأت یا حقیقت",
};

async function tryStartGame(env: Env, gameType: string): Promise<boolean> {
  const active = await db.getActiveGame(env.DB);
  if (active) return false;
  await db.setActiveGame(env.DB, gameType);
  return true;
}

async function gameLockedMessage(env: Env): Promise<string> {
  const active = await db.getActiveGame(env.DB);
  const label = active ? (GAME_LABELS[active] ?? active) : "یه بازی";
  return `یه بازی دیگه (${label}) الان در جریانه — اول تمومش کنید، یا از «🎮 بازی‌ها» بزنید «🏳️ لغو بازی فعلی».`;
}

const RPS_LABELS: Record<string, string> = { rock: "✊ سنگ", paper: "✋ کاغذ", scissors: "✌️ قیچی" };
const RPS_BEATS: Record<string, string> = { rock: "scissors", paper: "rock", scissors: "paper" };

export function rpsWinner(a: string, b: string): "a" | "b" | "tie" {
  if (a === b) return "tie";
  return RPS_BEATS[a] === b ? "a" : "b";
}

function renderTttBoard(board: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const cell = board[i];
      const label = cell === "_" ? "・" : cell === "X" ? "❌" : "⭕";
      kb.text(label, `ttt:move:${i}`);
    }
    kb.row();
  }
  return kb;
}

function renderC4Board(board: string): InlineKeyboard {
  // Every visible cell drops into its own column (not just a separate number
  // row above the board) — tapping the board itself is what people expect.
  const kb = new InlineKeyboard();
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const cell = board[r * C4_COLS + c];
      const label = cell === "_" ? "⚪" : cell === "R" ? "🔴" : "🟡";
      kb.text(label, `c4:drop:${c}`);
    }
    kb.row();
  }
  return kb;
}

function renderBattleshipBoard(hits: string, prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let r = 0; r < BATTLESHIP_SIZE; r++) {
    for (let c = 0; c < BATTLESHIP_SIZE; c++) {
      const i = r * BATTLESHIP_SIZE + c;
      const cell = hits[i];
      const label = cell === "H" ? "💥" : cell === "M" ? "🌊" : "▫️";
      kb.text(label, `${prefix}:${i}`);
    }
    kb.row();
  }
  return kb;
}

function skipCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("⏭ رد شدن", "newmem:skip").text("❌ انصراف", "newmem:cancel");
}

function cancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("❌ انصراف", "newmem:cancel");
}

function dateStepKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("📅 امروز", "newmem:today").text("❌ انصراف", "newmem:cancel");
}

type AddMemoryData = { fileId?: string | null; caption?: string; location?: string; date?: string };

async function askLocationStep(ctx: Context, env: Env, data: AddMemoryData): Promise<void> {
  await db.setPending(env.DB, ctx.from!.id, "add_memory", "await_location", data);
  await ctx.reply("کجا بود؟ (دوست نداری بگو، مهم نیست) 📍", {
    reply_markup: skipCancelKeyboard(),
  });
}

async function askDateStep(ctx: Context, env: Env, data: AddMemoryData): Promise<void> {
  await db.setPending(env.DB, ctx.from!.id, "add_memory", "await_date", data);
  await ctx.reply(`این خاطره کِی بود؟ (${DATE_HINT})`, { reply_markup: dateStepKeyboard() });
}

async function finishAddMemory(ctx: Context, env: Env, data: AddMemoryData): Promise<void> {
  const date = data.date ?? new Date().toISOString().slice(0, 10);
  const memoryId = await db.addMemory(
    env.DB,
    data.fileId ?? null,
    data.caption ?? null,
    data.location ?? null,
    date,
    ctx.from!.id
  );
  await db.clearPending(env.DB, ctx.from!.id);

  const memory = await db.getMemory(env.DB, memoryId);
  if (memory?.file_id) {
    await ctx.replyWithPhoto(memory.file_id, {
      caption: `ثبت شد، یکی دیگه اضافه شد به خاطراتتون 💜\n\n${formatMemoryCaption(memory)}`,
    });
  } else if (memory) {
    await ctx.reply(`ثبت شد، یکی دیگه اضافه شد به خاطراتتون 💜\n\n${formatMemoryCaption(memory)}`);
  }
  await ctx.reply(mainMenuText(getUserName(env, ctx.from!.id)), { reply_markup: mainMenuKeyboard() });
}

async function sendMemoriesList(ctx: Context, env: Env): Promise<void> {
  const memories = await db.listRecentMemories(env.DB, 5);
  if (memories.length === 0) {
    await ctx.reply("هنوز چیزی ثبت نکردید، بزن بریم اولیش رو بسازیم 💜", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  for (const m of memories) {
    const keyboard = new InlineKeyboard()
      .text("✏️ توضیح", `mementry:${m.id}:caption`)
      .text("📍 مکان", `mementry:${m.id}:location`)
      .row()
      .text("📅 تاریخ", `mementry:${m.id}:date`)
      .text("🗑 حذف", `memdel:${m.id}`);

    const caption = formatMemoryCaption(m);
    if (m.file_id) {
      await ctx.replyWithPhoto(m.file_id, { caption, reply_markup: keyboard });
    } else {
      await ctx.reply(caption, { reply_markup: keyboard });
    }
  }

  await ctx.reply(mainMenuText(getUserName(env, ctx.from!.id)), { reply_markup: mainMenuKeyboard() });
}

async function sendAnniversariesList(ctx: Context, env: Env): Promise<void> {
  const anniversaries = await db.listAnniversaries(env.DB);
  if (anniversaries.length === 0) {
    await ctx.reply("هنوز سالگردی نداریم، یکی اضافه کن 💫", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  const sorted = [...anniversaries].sort(
    (a, b) => daysUntil(a.event_date, !!a.recurring) - daysUntil(b.event_date, !!b.recurring)
  );

  for (const a of sorted) {
    const d = daysUntil(a.event_date, !!a.recurring);
    const status = d === 0 ? "🎉 امروزه!" : `${d} روز مونده`;
    const years = yearsSince(a.event_date) + (a.recurring ? 1 : 0);
    const yearNote = a.recurring ? ` (سال ${years}م)` : "";

    const keyboard = new InlineKeyboard()
      .text("✏️ اسم", `annentry:${a.id}:name`)
      .text("📅 تاریخ", `annentry:${a.id}:date`)
      .row()
      .text("🗑 حذف", `anndel:${a.id}`);

    await ctx.reply(`${a.name} — ${status}${yearNote}\n📅 ${formatJalali(a.event_date)}`, {
      reply_markup: keyboard,
    });
  }

  await ctx.reply(mainMenuText(getUserName(env, ctx.from!.id)), { reply_markup: mainMenuKeyboard() });
}

async function sendMonthRecap(ctx: Context, env: Env): Promise<void> {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

  const count = await db.countMemoriesBetween(env.DB, start, nextMonth);
  await ctx.reply(`این ماه ${count} تا خاطره ثبت کردید، ایول 📸💜`, { reply_markup: mainMenuKeyboard() });
}

export function parseAmount(text: string): number | null {
  const cleaned = toLatinDigits(text).replace(/[,،٬\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 ? n : null;
}

function formatToman(n: number): string {
  return `${toPersianDigits(n.toLocaleString())} تومان`;
}

async function sendSavingsStatus(ctx: Context, env: Env): Promise<void> {
  const total = await db.getSavingsTotal(env.DB);
  const byUser = await db.getSavingsTotalsByUser(env.DB);
  const goal = await db.getSavingsGoal(env.DB);
  const recent = await db.listSavingTransactions(env.DB, 8);

  const lines = ["💰 وضعیت کیف پول مشترک", "", `جمع کل: ${formatToman(total)}`];

  for (const row of byUser) {
    lines.push(`${getUserName(env, row.user_id)}: ${formatToman(row.total)}`);
  }

  if (goal?.goal_amount) {
    const percent = Math.min(100, Math.max(0, Math.round((total / goal.goal_amount) * 100)));
    const filled = Math.round(percent / 10);
    const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
    lines.push("", `🎯 هدف: ${goal.goal_name ?? "بدون اسم"} (${formatToman(goal.goal_amount)})`, `${bar} ${toPersianDigits(percent)}٪`);
  }

  if (recent.length > 0) {
    lines.push("", "آخرین تراکنش‌ها:");
    for (const t of recent) {
      const sign = t.amount >= 0 ? "+" : "";
      lines.push(`${getUserName(env, t.user_id)}: ${sign}${formatToman(t.amount)}${t.note ? ` (${t.note})` : ""}`);
    }
  }

  await ctx.reply(lines.join("\n"), { reply_markup: mainMenuKeyboard() });
}

async function sendStats(ctx: Context, env: Env): Promise<void> {
  const stats = await db.getStats(env.DB);
  const daysTogether = stats.earliestDate
    ? Math.floor((todayUTC().getTime() - parseISODate(stats.earliestDate).getTime()) / 86_400_000)
    : null;

  const lines = [
    "📊 آمار بات 💜",
    "",
    `📸 ${toPersianDigits(stats.memoryCount)} خاطره ثبت شده`,
    `🎉 ${toPersianDigits(stats.anniversaryCount)} سالگرد ثبت شده`,
    `💌 ${toPersianDigits(stats.secretMessageCount)} پیام مخفی رد و بدل شده`,
    `😊 ${toPersianDigits(stats.moodCount)} بار حال‌وهوا ثبت شده`,
    `📝 ${toPersianDigits(stats.noteCount)} نکته‌ی کوچیک ثبت شده`,
    `💰 ${toPersianDigits(stats.savingsTotal)} تومان توی کیف پول مشترک`,
    `🎮 ${toPersianDigits(stats.promptsUsedCount)} سوال/چالش بازی شده`,
    `❌⭕ ${toPersianDigits(stats.tttGamesPlayed)} دوز برده شده`,
    `📆 ${toPersianDigits(stats.dailyChallengesCompleted)} چالش روزانه انجام شده (استریک فعلی: ${toPersianDigits(stats.dailyChallengeStreak)} روز)`,
  ];
  if (daysTogether !== null && stats.earliestDate) {
    lines.push(`💕 ${toPersianDigits(daysTogether)} روزه که این خاطرات رو با هم می‌سازید (از ${formatJalali(stats.earliestDate)})`);
  }

  await ctx.reply(lines.join("\n"), { reply_markup: mainMenuKeyboard() });
}

// Strips lone (unpaired) UTF-16 surrogates. Some mobile keyboards/paste
// sources can leave these behind, and Telegram's API hard-rejects the whole
// sendMessage call with "strings must be encoded in UTF-8" if a relayed
// message contains one — which, unhandled, previously jammed the entire
// webhook queue. Sanitizing at the point text enters the bot prevents that
// for every downstream store/relay/reply of that text.
function sanitizeForTelegram(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

// Word-chain words are often typed with trailing emoji/punctuation ("کون😂").
// Using the raw last character as the "next word must start with" rule turns
// the game unwinnable the moment that happens (an emoji is never a valid
// first letter), which silently hijacks every future message from whoever's
// turn it is — including unrelated things like an add-memory caption. Strip
// non-letter characters from both ends before picking the letter to match.
function meaningfulWordChainText(word: string): string {
  return word.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

function wordChainLastLetter(word: string): string {
  const trimmed = meaningfulWordChainText(word);
  return trimmed ? trimmed[trimmed.length - 1] : "";
}

// Splits a bulk-pasted block of text into individual prompts — one per
// line, stripping any leading numbering/bullets ("1.", "2)", "-", "•").
function splitBulkLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/^(\d+[.)]|[-•*])\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchPhotoBase64(ctx: Context, env: Env, fileId: string): Promise<string | null> {
  try {
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) return null;
    const res = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`);
    if (!res.ok) return null;
    return bufferToBase64(await res.arrayBuffer());
  } catch (err) {
    console.error("failed to fetch photo", err);
    return null;
  }
}

async function fetchPhotoImgTag(ctx: Context, env: Env, fileId: string): Promise<string> {
  const base64 = await fetchPhotoBase64(ctx, env, fileId);
  return base64 ? `<img src="data:image/jpeg;base64,${base64}" />` : "";
}

async function sendExport(ctx: Context, env: Env): Promise<void> {
  await ctx.reply("دارم آلبومتون رو آماده می‌کنم، چند لحظه صبر کن... 📖");

  const [memories, anniversaries] = await Promise.all([db.getAllMemories(env.DB), db.listAnniversaries(env.DB)]);

  const memoryBlocks: string[] = [];
  for (const m of memories) {
    const imgTag = m.file_id ? await fetchPhotoImgTag(ctx, env, m.file_id) : "";
    memoryBlocks.push(
      `<div class="memory">${imgTag}<div class="date">📅 ${formatJalali(m.memory_date)}</div>` +
        (m.location ? `<div class="location">📍 ${escapeHtml(m.location)}</div>` : "") +
        (m.caption ? `<div class="caption">${escapeHtml(m.caption)}</div>` : "") +
        `</div>`
    );
  }

  const anniversaryItems = anniversaries
    .map((a) => `<li>${escapeHtml(a.name)} — ${formatJalali(a.event_date)}</li>`)
    .join("");

  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8" />
<title>خاطرات پارسا و مبینا</title>
<style>
body{font-family:Tahoma,Arial,sans-serif;background:#fff5f7;color:#3a2e35;padding:24px;max-width:720px;margin:0 auto}
h1{color:#b23a6b;text-align:center}
h2{color:#b23a6b;border-bottom:2px solid #f3c6d6;padding-bottom:6px}
.memory{background:#fff;border-radius:16px;padding:16px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.memory img{max-width:100%;border-radius:12px;margin-bottom:8px;display:block}
.date{color:#b23a6b;font-weight:bold}
.location{color:#666}
.caption{margin-top:8px}
ul{background:#fff;border-radius:16px;padding:16px 32px;list-style:none}
li{padding:6px 0;border-bottom:1px solid #f3c6d6}
li:last-child{border-bottom:none}
</style></head><body>
<h1>💜 خاطرات پارسا و مبینا 💜</h1>
<h2>🎉 سالگردها</h2>
<ul>${anniversaryItems || "<li>هنوز سالگردی ثبت نشده</li>"}</ul>
<h2>📸 خاطرات (${memories.length})</h2>
${memoryBlocks.join("") || "<p>هنوز خاطره‌ای ثبت نشده</p>"}
</body></html>`;

  await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(html), "khaterat-parsa-mobina.html"), {
    caption: "این کل خاطرات و سالگردهاتونه 💜 بازش کن توی مرورگر.",
  });
}

async function sendPhotoCollage(ctx: Context, env: Env): Promise<void> {
  await ctx.reply("دارم کلاژ این ماه رو می‌سازم... 🎞");

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);

  const all = await db.getAllMemories(env.DB);
  const photosThisMonth = all.filter((m) => m.file_id && m.memory_date >= start && m.memory_date < nextMonth);

  if (photosThisMonth.length === 0) {
    await ctx.reply("این ماه هنوز عکسی ثبت نکردید — چندتا بفرستید تا کلاژش رو بسازم براتون 📸", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  const cells: string[] = [];
  for (const m of photosThisMonth) {
    const imgTag = await fetchPhotoImgTag(ctx, env, m.file_id as string);
    if (!imgTag) continue;
    cells.push(`<div class="cell">${imgTag}<div class="cap">${formatJalali(m.memory_date)}</div></div>`);
  }

  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8" />
<title>کلاژ این ماه</title>
<style>
body{font-family:Tahoma,Arial,sans-serif;background:#fff5f7;color:#3a2e35;padding:24px;margin:0}
h1{color:#b23a6b;text-align:center}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;max-width:960px;margin:0 auto}
.cell{background:#fff;border-radius:12px;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);text-align:center}
.cell img{width:100%;border-radius:8px;display:block;margin-bottom:6px}
.cap{font-size:12px;color:#b23a6b}
</style></head><body>
<h1>💜 کلاژ این ماه پارسا و مبینا 💜</h1>
<div class="grid">${cells.join("")}</div>
</body></html>`;

  await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(html), "kolaj-in-mah.html"), {
    caption: `${toPersianDigits(cells.length)} تا لحظه‌ی قشنگ این ماه، بازش کن توی مرورگر 📸💜`,
  });
}

async function sendPhotoComparison(ctx: Context, env: Env): Promise<void> {
  const all = await db.getAllMemories(env.DB);
  const withPhotos = all.filter((m) => m.file_id);

  if (withPhotos.length < 2) {
    await ctx.reply("برای مقایسه حداقل به دوتا خاطره‌ی عکس‌دار نیاز داریم، یکم دیگه عکس بفرستید 📸", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  await ctx.reply("دارم مقایسه‌شون می‌کنم... 🔄");

  const first = withPhotos[0];
  const last = withPhotos[withPhotos.length - 1];
  const firstImg = await fetchPhotoImgTag(ctx, env, first.file_id as string);
  const lastImg = await fetchPhotoImgTag(ctx, env, last.file_id as string);
  const years = yearsSince(first.memory_date, parseISODate(last.memory_date));

  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8" />
<title>مقایسه عکس‌ها</title>
<style>
body{font-family:Tahoma,Arial,sans-serif;background:#fff5f7;color:#3a2e35;padding:24px;margin:0;text-align:center}
h1{color:#b23a6b}
.row{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;max-width:900px;margin:0 auto}
.side{background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08);flex:1;min-width:240px;max-width:400px}
.side img{width:100%;border-radius:12px;display:block;margin-bottom:8px}
.label{color:#b23a6b;font-weight:bold}
</style></head><body>
<h1>💜 چقدر تغییر کردید؟ 💜</h1>
<div class="row">
  <div class="side"><div class="label">اولین عکس</div>${firstImg}<div>${formatJalali(first.memory_date)}</div></div>
  <div class="side"><div class="label">آخرین عکس</div>${lastImg}<div>${formatJalali(last.memory_date)}</div></div>
</div>
<p>${years > 0 ? `${toPersianDigits(years)} سال از هم فاصله دارن ⏳` : "توی یه سال اتفاق افتادن ⏳"}</p>
</body></html>`;

  await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(html), "moghayese-akkasha.html"), {
    caption: "این اولین و آخرین عکستونه، بازش کن ببین چقدر تغییر کردید 😄💜",
  });
}

async function sendTdTurnPrompt(api: Api, env: Env, turnUserId: number): Promise<void> {
  const name = getUserName(env, turnUserId);
  const keyboard = new InlineKeyboard()
    .text("❓ حقیقت", "td:choose:truth")
    .text("🎯 جرأت", "td:choose:dare")
    .row()
    .text("✍️ خودم می‌نویسم", "td:custom")
    .row()
    .text("🏳️ پایان بازی", "td:end");
  await broadcastWithKeyboard(api, env, `نوبت ${name}ه! چی می‌خوای؟`, keyboard);
}

async function sendMemoryQuiz(ctx: Context, env: Env): Promise<void> {
  const [memories, anniversaries] = await Promise.all([db.getAllMemories(env.DB), db.listAnniversaries(env.DB)]);

  const candidates: { key: string; question: string }[] = [];
  for (const m of memories) {
    if (!m.location) continue;
    const hint = m.caption ? `\n${m.caption}` : "";
    candidates.push({ key: `mem_loc:${m.id}`, question: `این خاطره کجا بود؟\n📅 ${formatJalali(m.memory_date)}${hint}` });
  }
  for (const a of anniversaries) {
    candidates.push({ key: `ann_date:${a.id}`, question: `تاریخ سالگرد «${a.name}» رو یادته؟` });
  }

  if (candidates.length === 0) {
    await ctx.reply("هنوز داده‌ی کافی برای کوییز نداریم — چندتا خاطره با مکان یا سالگرد ثبت کنید 🧠", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  const pickedKey = await db.pickUnusedPrompt(
    env.DB,
    "memory_quiz",
    candidates.map((c) => c.key)
  );
  const item = candidates.find((c) => c.key === pickedKey) as { key: string; question: string };

  await broadcastToBoth(ctx.api, env, `🧠 کوییز خاطرات ما:\n\n${item.question}\n\nهرچی جواب بدید رو به هم بگید 💬`);

  for (const id of parseAllowedIds(env)) {
    await db.setPending(env.DB, id, "answer_relay", "active", {});
  }

  const keyboard = new InlineKeyboard().text("🔍 نمایش پاسخ درست", `quiz:reveal:${item.key}`);
  await ctx.reply("هر وقت خواستید جواب درست رو ببینید:", { reply_markup: keyboard });
}

// ---------- blackjack ----------

// Both partners get their own hand dealt at once (vs the dealer), so it plays
// out as a running points rivalry between the two rather than a solo game.
async function startBlackjackRound(ctx: Context, env: Env): Promise<void> {
  for (const userId of parseAllowedIds(env)) {
    const existing = await db.getBlackjackGame(env.DB, userId);
    if (existing && existing.status === "active") continue; // don't clobber their in-progress hand
    await dealBlackjackHand(ctx.api, env, userId);
  }
}

async function dealBlackjackHand(api: Api, env: Env, userId: number): Promise<void> {
  const points = await db.getBlackjackPoints(env.DB, userId);
  const bet = 50;

  if (points < bet) {
    try {
      await api.sendMessage(userId, `امتیازت کافی نیست (${toPersianDigits(points)} امتیاز داری) 😅`, {
        reply_markup: mainMenuKeyboard(),
      });
    } catch (err) {
      console.error("blackjack: failed to notify low points to", userId, err);
    }
    return;
  }

  const deck = newShuffledDeck();
  const playerCards = [deck.pop() as string, deck.pop() as string];
  const dealerCards = [deck.pop() as string, deck.pop() as string];
  await db.startBlackjackGame(env.DB, userId, playerCards, dealerCards, deck, bet);

  const playerValue = handValue(playerCards);
  if (playerValue === 21) {
    await resolveBlackjack(api, env, userId, playerCards, dealerCards, "win");
    return;
  }

  const keyboard = new InlineKeyboard().text("🃏 بکش", "bj:hit").text("✋ وایسا", "bj:stand");
  try {
    await api.sendMessage(
      userId,
      `🃏 بلک‌جک شروع شد! (شرط: ${toPersianDigits(bet)} امتیاز، موجودی: ${toPersianDigits(points)})\n\n` +
        `کارت‌های تو: ${formatHand(playerCards)} (${toPersianDigits(playerValue)})\n` +
        `کارت باز دیلر: ${dealerCards[0]}`,
      { reply_markup: keyboard }
    );
  } catch (err) {
    console.error("blackjack: failed to deal to", userId, err);
  }
}

async function resolveBlackjack(
  api: Api,
  env: Env,
  userId: number,
  playerCards: string[],
  dealerCards: string[],
  outcome: "win" | "lose" | "push"
): Promise<void> {
  const game = await db.getBlackjackGame(env.DB, userId);
  const bet = game?.bet ?? 50;
  const points = await db.getBlackjackPoints(env.DB, userId);

  const delta = outcome === "win" ? bet : outcome === "lose" ? -bet : 0;
  const newPoints = points + delta;
  await db.setBlackjackPoints(env.DB, userId, newPoints);
  await db.clearBlackjackGame(env.DB, userId);

  const resultText =
    outcome === "win"
      ? `🎉 بردی! +${toPersianDigits(bet)} امتیاز`
      : outcome === "lose"
        ? `😢 باختی! -${toPersianDigits(bet)} امتیاز`
        : "🤝 مساوی شد، امتیازی رد و بدل نشد";

  const other = otherUserId(env, userId);
  let standingsLine = `موجودی الان: ${toPersianDigits(newPoints)} امتیاز`;
  if (other) {
    const otherPoints = await db.getBlackjackPoints(env.DB, other);
    standingsLine = `📊 امتیازها: ${getUserName(env, userId)} ${toPersianDigits(newPoints)} | ${getUserName(env, other)} ${toPersianDigits(otherPoints)}`;
  }

  try {
    await api.sendMessage(
      userId,
      `کارت‌های تو: ${formatHand(playerCards)} (${toPersianDigits(handValue(playerCards))})\n` +
        `کارت‌های دیلر: ${formatHand(dealerCards)} (${toPersianDigits(handValue(dealerCards))})\n\n` +
        `${resultText}\n${standingsLine}`,
      { reply_markup: mainMenuKeyboard() }
    );
  } catch (err) {
    console.error("blackjack: failed to send result to", userId, err);
  }
}

// ---------- hangman ----------

const PERSIAN_ALPHABET = "ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی".split("");
const HANGMAN_STAGES = ["🙂", "😐", "😟", "😨", "😰", "😵", "💀"];

// Longer/harder words are more forgiving: they allow more wrong guesses
// instead of the same flat limit for every word.
function hangmanMaxWrong(word: string): number {
  return Math.max(6, 4 + Math.ceil(word.length / 2));
}

function renderHangmanText(word: string, guessed: string, wrong: number, category: string): string {
  const display = word
    .split("")
    .map((ch) => (guessed.includes(ch) ? ch : "_"))
    .join(" ");
  const maxWrong = hangmanMaxWrong(word);
  const stageIndex = Math.min(
    Math.floor((wrong / maxWrong) * (HANGMAN_STAGES.length - 1)),
    HANGMAN_STAGES.length - 1
  );
  const stage = HANGMAN_STAGES[stageIndex];
  return `🎪 دار (${category})\n\n${display}\n\n${stage} اشتباه: ${toPersianDigits(wrong)}/${toPersianDigits(maxWrong)}`;
}

function renderHangmanKeyboard(word: string, guessed: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  let count = 0;
  for (const letter of PERSIAN_ALPHABET) {
    const isGuessed = guessed.includes(letter);
    const isWrong = isGuessed && !word.includes(letter);
    const label = isWrong ? `${letter}̶` : letter;
    kb.text(label, isGuessed ? "hangman:noop" : `hangman:guess:${letter}`);
    count++;
    if (count % 6 === 0) kb.row();
  }
  return kb;
}

// ---------- daily couple challenge ----------

async function sendDailyChallengeStatus(ctx: Context, env: Env): Promise<void> {
  const today = toISODate(todayUTC());
  const challenge = await db.getDailyChallenge(env.DB, today);
  const streak = await db.getDailyChallengeStreak(env.DB);

  if (!challenge) {
    await ctx.reply(
      `هنوز چالش امروز پست نشده (هر روز صبح خودکار می‌فرستمش).\n🔥 استریک فعلی: ${toPersianDigits(streak.current_streak)} روز`,
      { reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  if (!challenge.completed) keyboard.text("✅ انجامش دادیم", "daily:done").row();
  keyboard.text("📜 تاریخچه", "daily:history");

  await ctx.reply(
    `📆 چالش امروز:\n${challenge.challenge_text}\n\n` +
      `${challenge.completed ? "✅ امروز انجام شده" : "هنوز انجام نشده"}\n` +
      `🔥 استریک: ${toPersianDigits(streak.current_streak)} روز`,
    { reply_markup: keyboard }
  );
}

async function sendAiStory(ctx: Context, env: Env): Promise<void> {
  if (!isAiConfigured(env)) {
    await ctx.reply("این قابلیت هنوز فعال نشده — باید یه کلید Gemini API تنظیم بشه 🔑", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  await ctx.reply("دارم داستانتون رو می‌نویسم... 📖✨");

  const memories = await db.listRecentMemories(env.DB, 15);
  const anniversaries = await db.listAnniversaries(env.DB);

  const memoryLines = memories
    .map((m) => `- ${formatJalali(m.memory_date)}${m.location ? ` در ${m.location}` : ""}: ${m.caption ?? "بدون توضیح"}`)
    .join("\n");
  const anniversaryLines = anniversaries.map((a) => `- ${a.name}: ${formatJalali(a.event_date)}`).join("\n");

  const prompt =
    `این خاطرات پارسا و مبیناست:\n\n${memoryLines || "(هنوز خاطره‌ای ثبت نشده)"}\n\n` +
    `سالگردهاشون:\n${anniversaryLines || "(هنوز سالگردی ثبت نشده)"}\n\n` +
    "بر اساس این‌ها، یه داستان کوتاه و گرم درباره‌ی رابطه‌شون بنویس.";

  try {
    const story = await askAi(
      env,
      "تو یه راوی گرم و شاعرمسلک فارسی‌زبانی که داستان زوج‌ها رو از روی خاطراتشون روایت می‌کنی. سوم‌شخص بنویس، رمانتیک ولی نه اغراق‌آمیز، حداکثر ۲۵۰ کلمه.",
      prompt
    );
    await broadcastToBoth(ctx.api, env, `📖 داستان رابطه‌تون:\n\n${story}`);
  } catch (err) {
    console.error("ai_story failed", err);
    await ctx.reply("الان نتونستم داستان رو بسازم، بعداً دوباره امتحان کن 🙏");
  }
}

async function sendAiGift(ctx: Context, env: Env): Promise<void> {
  if (!isAiConfigured(env)) {
    await ctx.reply("این قابلیت هنوز فعال نشده — باید یه کلید Gemini API تنظیم بشه 🔑", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  await ctx.reply("دارم چندتا ایده‌ی هدیه برات پیدا می‌کنم... 🎁 (این فقط پیش خودت می‌مونه)");

  const anniversaries = await db.listAnniversaries(env.DB);
  const upcoming = [...anniversaries].sort(
    (a, b) => daysUntil(a.event_date, !!a.recurring) - daysUntil(b.event_date, !!b.recurring)
  )[0];

  const notes = await db.listNotes(env.DB, 20);
  const noteLines = notes.map((n) => `- ${n.note}`).join("\n");

  const occasionLine = upcoming
    ? `نزدیک‌ترین سالگرد: «${upcoming.name}» (${daysUntil(upcoming.event_date, !!upcoming.recurring)} روز مونده)`
    : "سالگرد نزدیکی ثبت نشده.";

  const prompt =
    `${occasionLine}\n\nنکته‌های کوچیکی که ثبت شده:\n${noteLines || "(چیزی ثبت نشده)"}\n\n` +
    "با توجه به این‌ها، دقیقاً ۳ پیشنهاد هدیه‌ی خلاقانه و شخصی‌سازی‌شده بده، هرکدوم با یه دلیل کوتاه.";

  try {
    const suggestions = await askAi(
      env,
      "تو دستیار پیشنهاد هدیه‌ی فارسی‌زبانی برای زوج‌های ایرانی هستی. دقیقاً ۳ پیشنهاد بده، هرکدوم یک خط توضیح چرا مناسبه. کوتاه و کاربردی.",
      prompt
    );
    await ctx.reply(`🎁 چندتا ایده برات دارم:\n\n${suggestions}`);
  } catch (err) {
    console.error("ai_gift failed", err);
    await ctx.reply("الان نتونستم پیشنهاد بدم، بعداً دوباره امتحان کن 🙏");
  }
}

export function createBot(env: Env, cfCtx: ExecutionContext): Bot {
  const bot = new Bot(env.BOT_TOKEN);
  const allowed = new Set(parseAllowedIds(env));

  bot.catch((err) => {
    console.error("bot handler error:", err.message, err.error);
    const e = err.error as { message?: string; stack?: string; method?: string; payload?: unknown };
    const detail =
      err.error instanceof Error
        ? `${e.message}\nmethod=${e.method}\npayload=${JSON.stringify(e.payload)}\n${e.stack}`
        : String(err.error);
    cfCtx.waitUntil(
      env.DB.prepare("INSERT INTO debug_log (info, created_at) VALUES (?, ?)")
        .bind(`BOT_CATCH: ${detail}`.slice(0, 1900), new Date().toISOString())
        .run()
        .catch((dbErr) => console.error("debug_log insert failed", dbErr))
    );
    const chatId = err.ctx.chat?.id;
    if (chatId) {
      err.ctx.api.sendMessage(chatId, "یه مشکلی پیش اومد، دوباره امتحان کن 🙏").catch((sendErr) => {
        console.error("failed to notify user of error:", sendErr);
      });
    }
  });

  bot.use(async (ctx, next) => {
    // Fail closed: if ALLOWED_USER_IDS isn't configured, deny everyone rather
    // than silently opening the bot up to any Telegram user.
    if (allowed.size === 0) {
      console.error("ALLOWED_USER_IDS is not configured — denying all access.");
      await ctx.reply("این بات هنوز پیکربندی نشده 🔒");
      return;
    }

    const uid = ctx.from?.id;
    if (!uid || !allowed.has(uid)) {
      await ctx.reply(`این بات خصوصیه 🔒 (آیدی عددی تو: ${uid ?? "نامشخص"})`);
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    await ctx.reply(HELP_TEXT);
    await ctx.reply(mainMenuText(getUserName(env, ctx.from.id)), { reply_markup: mainReplyKeyboard() });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_TEXT);
  });

  bot.command("menu", async (ctx) => {
    if (!ctx.from) return;
    await db.clearPending(env.DB, ctx.from.id);
    await ctx.reply(mainMenuText(getUserName(env, ctx.from.id)), { reply_markup: mainReplyKeyboard() });
  });

  // ---------- main menu navigation ----------

  async function runMenuAction(ctx: Context, action: string): Promise<void> {
    const name = getUserName(env, ctx.from!.id);

    if (action === "main") {
      await ctx.reply(mainMenuText(name));
    } else if (action === "add_memory") {
      const keyboard = new InlineKeyboard()
        .text("📷 با عکس", "newmem:photo")
        .text("📝 فقط متن", "newmem:text")
        .row()
        .text("❌ انصراف", "newmem:cancel");
      await ctx.reply(`چجوری ثبتش کنم، ${name} جان؟ 💕`, { reply_markup: keyboard });
    } else if (action === "add_anniversary") {
      await db.setPending(env.DB, ctx.from!.id, "add_anniversary", "await_name", {});
      await ctx.reply(`اسمش چی بود، ${name} جان؟ (مثلاً «اولین قرار») ✨`, {
        reply_markup: cancelKeyboard(),
      });
    } else if (action === "list_memories") {
      await sendMemoriesList(ctx, env);
    } else if (action === "list_anniversaries") {
      await sendAnniversariesList(ctx, env);
    } else if (action === "month_recap") {
      await sendMonthRecap(ctx, env);
    } else if (action === "mood") {
      await ctx.reply(`دلت امروز چطوره، ${name} جان؟ 💜`, { reply_markup: moodKeyboard() });
    } else if (action === "secret_messages") {
      const keyboard = new InlineKeyboard()
        .text("✍️ نوشتن پیام جدید", "secret:new")
        .row()
        .text("📬 پیام‌های من", "secret:inbox")
        .row()
        .text("🔙 بازگشت به منو", "menu:main");
      await ctx.reply("اینجا جای رازای عاشقونتونه 💌", { reply_markup: keyboard });
    } else if (action === "games") {
      const active = await db.getActiveGame(env.DB);
      const keyboard = new InlineKeyboard()
        .text("🎮 سوال زوجی", "menu:couple_question")
        .text("🎲 جرأت یا حقیقت", "menu:truth_dare")
        .row()
        .text("⚖️ این یا اون", "menu:this_or_that")
        .text("🎯 چالش هفته", "menu:weekly_challenge")
        .row()
        .text("🙅 هیچوقت این کارو نکردم", "menu:never_have_i_ever")
        .row()
        .text("✊ سنگ کاغذ قیچی", "menu:rps")
        .text("🤥 دو راست یه دروغ", "menu:ttal")
        .row()
        .text("🧠 کوییز خاطرات ما", "menu:memory_quiz")
        .row()
        .text("⚡ بازی واکنش", "menu:reaction")
        .text("❌⭕ دوز", "menu:ttt")
        .row()
        .text("🔴🟡 چهار در ردیف", "menu:c4")
        .text("🚢 کشتی‌جنگی", "menu:battleship")
        .row()
        .text("🃏 بلک‌جک", "menu:blackjack")
        .text("🔤 زنجیره‌ی کلمات", "menu:word_chain")
        .row()
        .text("🎪 دار (حدس کلمه)", "menu:hangman")
        .text("📆 چالش روزانه", "menu:daily_challenge")
        .row()
        .text("📝 سوالات جرأت‌حقیقت من", "menu:td_manage")
        .row();
      if (active) {
        keyboard.text(`🏳️ لغو بازی فعلی (${GAME_LABELS[active] ?? active})`, "game:forcecancel").row();
      }
      keyboard.text("🔙 بازگشت به منو", "menu:main");
      const intro = active
        ? `یه بازی (${GAME_LABELS[active] ?? active}) الان در جریانه.\nکدوم بازی رو بازی کنیم؟ 🎮`
        : "کدوم بازی رو بازی کنیم؟ 🎮";
      await ctx.reply(intro, { reply_markup: keyboard });
    } else if (action === "couple_question") {
      const question = await db.pickUnusedPrompt(env.DB, "couple_question", COUPLE_QUESTIONS);
      await broadcastToBoth(
        ctx.api,
        env,
        `🎮 یه سوال برای هر دوتون:\n\n${question}\n\nهرچی جواب بدید رو میدم به اون یکی 💜`
      );
      for (const id of parseAllowedIds(env)) {
        await db.setPending(env.DB, id, "answer_relay", "active", {});
      }
    } else if (action === "weekly_challenge") {
      const challenge = await db.pickUnusedPrompt(env.DB, "weekly_challenge", WEEKLY_CHALLENGES);
      await broadcastToBoth(ctx.api, env, `🎯 چالش این هفته:\n\n${challenge}`);
    } else if (action === "truth_dare") {
      if (!(await tryStartGame(env, "truth_dare"))) {
        await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      } else {
        const keyboard = new InlineKeyboard()
          .text("😇 معمولی", "td:spice:normal")
          .text("🔥 خودمونی‌تر (۱۸+)", "td:spice:spicy")
          .row()
          .text("🏳️ بی‌خیال", "td:cancel");
        await ctx.reply("کدوم حالت باشه؟", { reply_markup: keyboard });
      }
    } else if (action === "td_manage") {
      const keyboard = new InlineKeyboard()
        .text("➕ حقیقت معمولی", "tdcustom:add:truth:normal")
        .text("➕ حقیقت ۱۸+", "tdcustom:add:truth:spicy")
        .row()
        .text("➕ جرأت معمولی", "tdcustom:add:dare:normal")
        .text("➕ جرأت ۱۸+", "tdcustom:add:dare:spicy")
        .row()
        .text("📋 لیست و حذف", "tdcustom:list")
        .row()
        .text("🔙 بازگشت به بازی‌ها", "menu:games");
      await ctx.reply(
        "سوالات و جرأت‌های خودتون رو اینجا اضافه کنید — موقع بازی جرأت‌حقیقت قاطی سوالات بات میان 📝",
        { reply_markup: keyboard }
      );
    } else if (action === "this_or_that") {
      const pick = await db.pickUnusedPrompt(env.DB, "this_or_that", THIS_OR_THAT);
      await broadcastToBoth(ctx.api, env, `⚖️ این یا اون؟\n\n${pick}\n\nهرچی جواب بدید رو میدم به اون یکی 💜`);
      for (const id of parseAllowedIds(env)) {
        await db.setPending(env.DB, id, "answer_relay", "active", {});
      }
    } else if (action === "never_have_i_ever") {
      const prompt = await db.pickUnusedPrompt(env.DB, "never_have_i_ever", NEVER_HAVE_I_EVER);
      await broadcastToBoth(ctx.api, env, `🙅 هیچوقت من...\n\n${prompt}\n\nهرکی این کارو کرده جواب بده 😄`);
      for (const id of parseAllowedIds(env)) {
        await db.setPending(env.DB, id, "answer_relay", "active", {});
      }
    } else if (action === "rps") {
      const keyboard = new InlineKeyboard()
        .text("✊ سنگ", "rps:move:rock")
        .text("✋ کاغذ", "rps:move:paper")
        .text("✌️ قیچی", "rps:move:scissors");
      await broadcastWithKeyboard(
        ctx.api,
        env,
        "سنگ کاغذ قیچی! حرکتت رو انتخاب کن، وقتی هر دوتون انتخاب کردین نتیجه رو می‌گم 🎲",
        keyboard
      );
    } else if (action === "ttal") {
      await db.setPending(env.DB, ctx.from!.id, "ttal_create", "await_s1", {});
      await ctx.reply("سه‌تا جمله بنویس، دوتاش راسته یکیش دروغ. اول جمله‌ی اول رو بفرست:", {
        reply_markup: cancelKeyboard(),
      });
    } else if (action === "memory_quiz") {
      await sendMemoryQuiz(ctx, env);
    } else if (action === "reaction") {
      if (!(await tryStartGame(env, "reaction"))) {
        await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      } else {
        await db.startReactionRound(env.DB);
        const waitingKeyboard = new InlineKeyboard().text("⏳ هنوز نه...", "reaction:early");
        await broadcastWithKeyboard(
          ctx.api,
          env,
          "⚡ آماده باش... فقط وقتی دکمه‌ی سبز اومد بزن! زودتر بزنی می‌بازی 😏",
          waitingKeyboard
        );

        const delayMs = 1500 + Math.floor(Math.random() * 4500);
        const api = ctx.api;
        cfCtx.waitUntil(
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            const round = await db.getReactionRound(env.DB);
            if (!round || round.status !== "waiting") return; // someone already jumped the gun
            await db.activateReactionRound(env.DB);
            const keyboard = new InlineKeyboard().text("🎯 بزن!", "reaction:tap");
            for (const id of parseAllowedIds(env)) {
              try {
                await api.sendMessage(id, "🎯 بزن بزن بزن!", { reply_markup: keyboard });
              } catch (err) {
                console.error("reaction: failed to send GO message", err);
              }
            }
          })()
        );
      }
    } else if (action === "ttt") {
      const other = otherUserId(env, ctx.from!.id);
      if (!other) {
        await ctx.reply("این بازی نیاز به هر دو آیدی مجاز داره.", { reply_markup: mainMenuKeyboard() });
      } else if (!(await tryStartGame(env, "ttt"))) {
        await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      } else {
        await db.startTttGame(env.DB, ctx.from!.id, other);
        await broadcastWithKeyboard(
          ctx.api,
          env,
          `❌⭕ دوز شروع شد! نوبت ${name}ه (❌)`,
          renderTttBoard("_________")
        );
      }
    } else if (action === "c4") {
      const other = otherUserId(env, ctx.from!.id);
      if (!other) {
        await ctx.reply("این بازی نیاز به هر دو آیدی مجاز داره.", { reply_markup: mainMenuKeyboard() });
      } else if (!(await tryStartGame(env, "c4"))) {
        await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      } else {
        await db.startC4Game(env.DB, ctx.from!.id, other);
        await broadcastWithKeyboard(
          ctx.api,
          env,
          `🔴🟡 چهار در ردیف شروع شد! نوبت ${name}ه (🔴)`,
          renderC4Board("_".repeat(42))
        );
      }
    } else if (action === "battleship") {
      const other = otherUserId(env, ctx.from!.id);
      if (!other) {
        await ctx.reply("این بازی نیاز به هر دو آیدی مجاز داره.", { reply_markup: mainMenuKeyboard() });
      } else if (!(await tryStartGame(env, "battleship"))) {
        await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      } else {
        const boardA = placeShipsRandomly();
        const boardB = placeShipsRandomly();
        await db.startBattleshipGame(env.DB, ctx.from!.id, other, boardA, boardB);
        const emptyHits = ".".repeat(BATTLESHIP_SIZE * BATTLESHIP_SIZE);
        await ctx.reply(`🚢 کشتی‌جنگی شروع شد! نوبت توئه، بزن رو تخته‌ی ${getUserName(env, other)}:`, {
          reply_markup: renderBattleshipBoard(emptyHits, "bship:fire:b"),
        });
        try {
          await ctx.api.sendMessage(other, `🚢 کشتی‌جنگی شروع شد! اول نوبت ${name}ه، منتظر بمون ⏳`, {
            reply_markup: renderBattleshipBoard(emptyHits, "bship:fire:a"),
          });
        } catch (err) {
          console.error("battleship: failed to notify other player", err);
        }
      }
    } else if (action === "blackjack") {
      await startBlackjackRound(ctx, env);
    } else if (action === "word_chain") {
      if (!(await tryStartGame(env, "word_chain"))) {
        await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      } else {
        await db.setPending(env.DB, ctx.from!.id, "word_chain_start", "await_word", {});
        await ctx.reply("یه کلمه بگو تا زنجیره شروع بشه، اون یکی باید با حرف آخرش یه کلمه‌ی جدید بگه:", {
          reply_markup: cancelKeyboard(),
        });
      }
    } else if (action === "hangman") {
      if (!(await tryStartGame(env, "hangman"))) {
        await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      } else {
        const keyboard = new InlineKeyboard();
        const categories = Object.keys(HANGMAN_CATEGORIES);
        for (const cat of categories) keyboard.text(cat, `hangman:cat:${categories.indexOf(cat)}`).row();
        await ctx.reply("کدوم دسته‌بندی؟", { reply_markup: keyboard });
      }
    } else if (action === "daily_challenge") {
      await sendDailyChallengeStatus(ctx, env);
    } else if (action === "savings") {
      const keyboard = new InlineKeyboard()
        .text("➕ افزودن واریزی", "savings:add")
        .text("🎯 تعیین هدف", "savings:goal")
        .row()
        .text("📊 وضعیت کیف پول", "savings:status")
        .row()
        .text("🔙 بازگشت به منو", "menu:main");
      await ctx.reply("کیف پول مشترکتون 💰", { reply_markup: keyboard });
    } else if (action === "notes") {
      const keyboard = new InlineKeyboard()
        .text("✍️ افزودن نکته", "notes:new")
        .row()
        .text("📋 لیست نکته‌ها", "notes:list")
        .row()
        .text("🔙 بازگشت به منو", "menu:main");
      await ctx.reply("هرچی درباره‌ی هم یادت می‌مونه رو اینجا بنویس ✨", { reply_markup: keyboard });
    } else if (action === "stats") {
      await sendStats(ctx, env);
    } else if (action === "export") {
      await sendExport(ctx, env);
    } else if (action === "photo_media") {
      const keyboard = new InlineKeyboard()
        .text("🎞 کلاژ این ماه", "photomedia:collage")
        .row()
        .text("🔄 مقایسه اولین و آخرین عکس", "photomedia:compare")
        .row()
        .text("🔍 این عکس چیه؟", "photomedia:recognize")
        .row()
        .text("🔙 بازگشت به منو", "menu:main");
      await ctx.reply("عکس‌هاتون رو چیکار کنم؟ 🖼", { reply_markup: keyboard });
    } else if (action === "ai_story") {
      await sendAiStory(ctx, env);
    } else if (action === "ai_gift") {
      await sendAiGift(ctx, env);
    }
  }

  bot.callbackQuery(/^menu:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await db.clearPending(env.DB, ctx.from.id);
    await runMenuAction(ctx, ctx.match[1]);
  });

  // ---------- photo collage & comparison ----------

  bot.callbackQuery(/^photomedia:(collage|compare|recognize)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.match[1] === "collage") {
      await sendPhotoCollage(ctx, env);
    } else if (ctx.match[1] === "compare") {
      await sendPhotoComparison(ctx, env);
    } else {
      if (!isAiConfigured(env)) {
        await ctx.reply("این قابلیت هنوز فعال نشده — باید یه کلید Gemini API تنظیم بشه 🔑", {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }
      await db.setPending(env.DB, ctx.from.id, "ai_photo_id", "await_photo", {});
      await ctx.reply("یه عکس بفرست تا برات بررسیش کنم 🔍", { reply_markup: cancelKeyboard() });
    }
  });

  // ---------- rock-paper-scissors ----------

  bot.callbackQuery(/^rps:move:(rock|paper|scissors)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const move = ctx.match[1] as "rock" | "paper" | "scissors";
    await db.setRpsMove(env.DB, ctx.from.id, move);

    const other = otherUserId(env, ctx.from.id);
    if (!other) {
      await ctx.reply("حرکتت ثبت شد ✅");
      return;
    }

    const otherMove = await db.getRpsMove(env.DB, other);
    if (!otherMove) {
      await ctx.reply(`حرکتت (${RPS_LABELS[move]}) ثبت شد، منتظر ${getUserName(env, other)} می‌مونیم... ⏳`);
      return;
    }

    await db.clearRpsMoves(env.DB, [ctx.from.id, other]);

    const result = rpsWinner(move, otherMove.move as "rock" | "paper" | "scissors");
    const myName = getUserName(env, ctx.from.id);
    const otherName = getUserName(env, other);
    const resultLine =
      result === "tie" ? "🤝 مساوی شدید!" : result === "a" ? `🏆 ${myName} برد!` : `🏆 ${otherName} برد!`;

    await broadcastToBoth(
      ctx.api,
      env,
      `✊✋✌️ نتیجه:\n${myName}: ${RPS_LABELS[move]}\n${otherName}: ${RPS_LABELS[otherMove.move]}\n\n${resultLine}`
    );
  });

  // ---------- two truths and a lie ----------

  bot.callbackQuery(/^ttal:setlie:([123])$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const pending = await db.getPending(env.DB, ctx.from.id);
    if (!pending || pending.flow !== "ttal_create" || pending.step !== "await_lie") return;
    const data = pending.data as { s1: string; s2: string; s3: string };
    const lieIndex = Number(ctx.match[1]);
    await db.clearPending(env.DB, ctx.from.id);

    const other = otherUserId(env, ctx.from.id);
    if (!other) {
      await ctx.reply("این بازی فقط وقتی کار می‌کنه که هر دو آیدی مجاز ست شده باشن.", {
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    const gameId = await db.createTtalGame(env.DB, ctx.from.id, [data.s1, data.s2, data.s3], lieIndex);
    const authorName = getUserName(env, ctx.from.id);

    const guessKeyboard = new InlineKeyboard()
      .text("۱", `ttal:guess:${gameId}:1`)
      .text("۲", `ttal:guess:${gameId}:2`)
      .text("۳", `ttal:guess:${gameId}:3`);
    try {
      await ctx.api.sendMessage(
        other,
        `🤥 ${authorName} سه‌تا جمله نوشته، یکیش دروغه — کدومو حدس می‌زنی؟\n\n۱. ${data.s1}\n۲. ${data.s2}\n۳. ${data.s3}`,
        { reply_markup: guessKeyboard }
      );
    } catch (err) {
      console.error("ttal: failed to send to other player", err);
    }

    await ctx.reply(`فرستادم برای ${getUserName(env, other)}، منتظر حدسش باش 😏`, { reply_markup: mainMenuKeyboard() });
  });

  bot.callbackQuery(/^ttal:guess:(\d+):([123])$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const gameId = Number(ctx.match[1]);
    const guessed = Number(ctx.match[2]);
    const game = await db.getTtalGame(env.DB, gameId);

    if (!game || game.resolved || game.author_id === ctx.from.id) {
      await ctx.reply("این بازی دیگه در دسترس نیست.");
      return;
    }

    await db.resolveTtalGame(env.DB, gameId, guessed);
    const correct = guessed === game.lie_index;
    const lieText = [game.statement1, game.statement2, game.statement3][game.lie_index - 1];

    await ctx.reply(
      correct
        ? `آفرین، درست حدس زدی! دروغه این بود:\n«${lieText}» 🎉`
        : `نچ، اشتباه حدس زدی! دروغه این بود:\n«${lieText}» 😄`
    );

    try {
      const guesserName = getUserName(env, ctx.from.id);
      await ctx.api.sendMessage(
        game.author_id,
        correct
          ? `${guesserName} درست حدس زد! فهمید دروغه کدومه 🕵️`
          : `${guesserName} اشتباه حدس زد و باورش کرد 😂`
      );
    } catch (err) {
      console.error("ttal: failed to notify author", err);
    }
  });

  // ---------- memory quiz ----------

  bot.callbackQuery(/^quiz:reveal:(mem_loc|ann_date):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const kind = ctx.match[1];
    const id = Number(ctx.match[2]);

    if (kind === "mem_loc") {
      const m = await db.getMemory(env.DB, id);
      await ctx.reply(m?.location ? `📍 جواب درست: ${m.location}` : "این خاطره دیگه در دسترس نیست.");
    } else {
      const a = await db.getAnniversary(env.DB, id);
      await ctx.reply(a ? `📅 جواب درست: ${formatJalali(a.event_date)}` : "این سالگرد دیگه در دسترس نیست.");
    }
  });

  // ---------- speed tap / reaction game ----------

  bot.callbackQuery(/^reaction:early$/, async (ctx) => {
    const round = await db.getReactionRound(env.DB);
    if (!round || round.status !== "waiting") {
      await ctx.answerCallbackQuery({ text: "این دوره تموم شده." });
      return;
    }
    await db.finishReactionRound(env.DB);
    await db.clearActiveGame(env.DB);
    await ctx.answerCallbackQuery({ text: "زود بودی! 😅" });

    const other = otherUserId(env, ctx.from.id);
    const otherName = other ? getUserName(env, other) : "اون یکی";
    await broadcastToBoth(
      ctx.api,
      env,
      `😅 ${getUserName(env, ctx.from.id)} زودتر از موعد زد و باخت! ${otherName} برد 🏆`
    );
  });

  bot.callbackQuery(/^reaction:tap$/, async (ctx) => {
    const round = await db.getReactionRound(env.DB);
    if (!round || round.status !== "active") {
      await ctx.answerCallbackQuery({ text: round?.status === "finished" ? "دیر کردی!" : "بازی‌ای در جریان نیست." });
      return;
    }
    await db.finishReactionRound(env.DB);
    await db.clearActiveGame(env.DB);
    await ctx.answerCallbackQuery({ text: "🏆 تو بردی!" });

    const goAt = round.go_at ? new Date(round.go_at).getTime() : Date.now();
    const reactionMs = Date.now() - goAt;

    const prevBest = await db.getReactionRecord(env.DB, ctx.from.id);
    let recordNote = "";
    if (prevBest === null) {
      recordNote = " 🆕 اولین رکوردت!";
      await db.setReactionRecord(env.DB, ctx.from.id, reactionMs);
    } else if (reactionMs < prevBest) {
      recordNote = ` 🥇 رکورد جدید! (رکورد قبلی: ${toPersianDigits(prevBest)}ms)`;
      await db.setReactionRecord(env.DB, ctx.from.id, reactionMs);
    }

    await broadcastToBoth(
      ctx.api,
      env,
      `⚡ ${getUserName(env, ctx.from.id)} برد! (${toPersianDigits(reactionMs)} میلی‌ثانیه)${recordNote} 🏆`
    );
  });

  // ---------- tic-tac-toe ----------

  bot.callbackQuery(/^ttt:move:(\d)$/, async (ctx) => {
    const index = Number(ctx.match[1]);
    const game = await db.getTttGame(env.DB);
    if (!game || game.status !== "active") {
      await ctx.answerCallbackQuery({ text: "بازی‌ای در جریان نیست." });
      return;
    }
    if (ctx.from.id !== game.turn) {
      await ctx.answerCallbackQuery({ text: "نوبت تو نیست ⏳" });
      return;
    }
    if (game.board[index] !== "_") {
      await ctx.answerCallbackQuery({ text: "این خونه پره." });
      return;
    }
    await ctx.answerCallbackQuery();

    const mark = ctx.from.id === game.player_x ? "X" : "O";
    const newBoard = game.board.slice(0, index) + mark + game.board.slice(index + 1);
    const winner = checkTicTacToeWinner(newBoard);

    if (winner) {
      await db.updateTttGame(env.DB, newBoard, 0, winner === "draw" ? "draw" : "finished");
      await db.clearActiveGame(env.DB);
      let resultText: string;
      if (winner === "draw") {
        resultText = "🤝 مساوی شد!";
      } else {
        const winnerId = winner === "X" ? game.player_x : game.player_o;
        await db.incrementTttWins(env.DB, winnerId);
        resultText = `🏆 ${getUserName(env, winnerId)} برد!`;
      }
      const scores = await db.getTttScores(env.DB, parseAllowedIds(env));
      const scoreLine = parseAllowedIds(env)
        .map((id) => `${getUserName(env, id)}: ${toPersianDigits(scores[id] ?? 0)}`)
        .join(" | ");
      const kb = renderTttBoard(newBoard).row().text("🔁 بازی دوباره", "ttt:rematch");
      await broadcastWithKeyboard(ctx.api, env, `${resultText}\n\n🏅 ${scoreLine}`, kb);
      return;
    }

    const nextTurn = mark === "X" ? game.player_o : game.player_x;
    await db.updateTttGame(env.DB, newBoard, nextTurn, "active");
    await broadcastWithKeyboard(ctx.api, env, `نوبت ${getUserName(env, nextTurn)}ه`, renderTttBoard(newBoard));
  });

  bot.callbackQuery(/^ttt:rematch$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const game = await db.getTttGame(env.DB);
    if (!game) return;
    if (!(await tryStartGame(env, "ttt"))) {
      await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      return;
    }
    await db.startTttGame(env.DB, game.player_o, game.player_x);
    await broadcastWithKeyboard(
      ctx.api,
      env,
      `❌⭕ بازی دوباره شروع شد! نوبت ${getUserName(env, game.player_o)}ه (❌)`,
      renderTttBoard("_________")
    );
  });

  // ---------- connect four ----------

  bot.callbackQuery(/^c4:drop:(\d)$/, async (ctx) => {
    const col = Number(ctx.match[1]);
    const game = await db.getC4Game(env.DB);
    if (!game || game.status !== "active") {
      await ctx.answerCallbackQuery({ text: "بازی‌ای در جریان نیست." });
      return;
    }
    if (ctx.from.id !== game.turn) {
      await ctx.answerCallbackQuery({ text: "نوبت تو نیست ⏳" });
      return;
    }

    const token = ctx.from.id === game.player_r ? "R" : "Y";
    const dropped = dropConnectFour(game.board, col, token);
    if (!dropped) {
      await ctx.answerCallbackQuery({ text: "این ستون پره." });
      return;
    }
    await ctx.answerCallbackQuery();

    const winner = checkConnectFourWinner(dropped.board);
    const full = isConnectFourFull(dropped.board);

    if (winner || full) {
      await db.updateC4Game(env.DB, dropped.board, 0, "finished");
      await db.clearActiveGame(env.DB);
      const resultText = winner
        ? `🏆 ${getUserName(env, token === "R" ? game.player_r : game.player_y)} برد!`
        : "🤝 مساوی شد!";
      const kb = renderC4Board(dropped.board).row().text("🔁 بازی دوباره", "c4:rematch");
      await broadcastWithKeyboard(ctx.api, env, resultText, kb);
      return;
    }

    const nextTurn = token === "R" ? game.player_y : game.player_r;
    await db.updateC4Game(env.DB, dropped.board, nextTurn, "active");
    await broadcastWithKeyboard(ctx.api, env, `نوبت ${getUserName(env, nextTurn)}ه`, renderC4Board(dropped.board));
  });

  bot.callbackQuery(/^c4:rematch$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const game = await db.getC4Game(env.DB);
    if (!game) return;
    if (!(await tryStartGame(env, "c4"))) {
      await ctx.reply(await gameLockedMessage(env), { reply_markup: mainMenuKeyboard() });
      return;
    }
    await db.startC4Game(env.DB, game.player_y, game.player_r);
    await broadcastWithKeyboard(
      ctx.api,
      env,
      `🔴🟡 بازی دوباره شروع شد! نوبت ${getUserName(env, game.player_y)}ه (🔴)`,
      renderC4Board("_".repeat(42))
    );
  });

  // ---------- battleship ----------

  bot.callbackQuery(/^bship:fire:(a|b):(\d+)$/, async (ctx) => {
    const target = ctx.match[1] as "a" | "b";
    const index = Number(ctx.match[2]);
    const game = await db.getBattleshipGame(env.DB);
    if (!game || game.status !== "active") {
      await ctx.answerCallbackQuery({ text: "بازی‌ای در جریان نیست." });
      return;
    }

    const attacker = target === "b" ? game.player_a : game.player_b;
    if (ctx.from.id !== attacker || ctx.from.id !== game.turn) {
      await ctx.answerCallbackQuery({ text: "نوبت تو نیست ⏳" });
      return;
    }

    const targetBoard = target === "a" ? game.board_a : game.board_b;
    const targetHits = target === "a" ? game.hits_a : game.hits_b;
    const { result, hits: newHits } = fireAt(targetBoard, targetHits, index);

    if (result === "already") {
      await ctx.answerCallbackQuery({ text: "قبلاً اینجا رو زدی." });
      return;
    }
    await ctx.answerCallbackQuery({ text: result === "hit" ? "💥 زدی!" : "🌊 آب بود." });

    const newHitsA = target === "a" ? newHits : game.hits_a;
    const newHitsB = target === "b" ? newHits : game.hits_b;
    const sunk = isFleetSunk(targetBoard, newHits);
    const defender = target === "b" ? game.player_b : game.player_a;
    const nextTurn = sunk ? game.turn : defender;
    const status = sunk ? "finished" : "active";

    await db.updateBattleshipGame(env.DB, newHitsA, newHitsB, nextTurn, status);

    const attackerName = getUserName(env, attacker);

    if (sunk) {
      await db.clearActiveGame(env.DB);
      await broadcastToBoth(ctx.api, env, `🏆 ${attackerName} همه‌ی کشتی‌های ${getUserName(env, defender)} رو غرق کرد و برد!`);
      return;
    }

    await ctx.reply(`${result === "hit" ? "💥 زدی!" : "🌊 آب بود."}\nنوبت ${getUserName(env, nextTurn)}ه`, {
      reply_markup: renderBattleshipBoard(newHits, `bship:fire:${target}`),
    });

    try {
      const otherTarget = target === "a" ? "b" : "a";
      const otherHits = otherTarget === "a" ? newHitsA : newHitsB;
      await ctx.api.sendMessage(
        defender,
        `${attackerName} ${result === "hit" ? "یه ضربه بهت زد 💥" : "آب زد 🌊"}\nنوبت توئه:`,
        { reply_markup: renderBattleshipBoard(otherHits, `bship:fire:${otherTarget}`) }
      );
    } catch (err) {
      console.error("battleship: failed to notify defender", err);
    }
  });

  // ---------- blackjack ----------

  bot.callbackQuery(/^bj:hit$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const game = await db.getBlackjackGame(env.DB, ctx.from.id);
    if (!game || game.status !== "active") return;

    const deck = game.deck.split(",");
    const playerCards = game.player_cards.split(",");
    const dealerCards = game.dealer_cards.split(",");
    const card = deck.pop() as string;
    playerCards.push(card);

    const value = handValue(playerCards);
    if (value > 21) {
      await db.updateBlackjackGame(env.DB, ctx.from.id, playerCards, dealerCards, deck, "bust");
      await resolveBlackjack(ctx.api, env, ctx.from.id, playerCards, dealerCards, "lose");
      return;
    }

    await db.updateBlackjackGame(env.DB, ctx.from.id, playerCards, dealerCards, deck, "active");
    const keyboard = new InlineKeyboard().text("🃏 بکش", "bj:hit").text("✋ وایسا", "bj:stand");
    await ctx.reply(`کارت‌های تو: ${formatHand(playerCards)} (${toPersianDigits(value)})`, { reply_markup: keyboard });
  });

  bot.callbackQuery(/^bj:stand$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const game = await db.getBlackjackGame(env.DB, ctx.from.id);
    if (!game || game.status !== "active") return;

    const deck = game.deck.split(",");
    const playerCards = game.player_cards.split(",");
    const dealerCards = game.dealer_cards.split(",");

    while (handValue(dealerCards) < 17 && deck.length > 0) {
      dealerCards.push(deck.pop() as string);
    }

    const playerValue = handValue(playerCards);
    const dealerValue = handValue(dealerCards);
    let outcome: "win" | "lose" | "push";
    if (dealerValue > 21) outcome = "win";
    else if (playerValue > dealerValue) outcome = "win";
    else if (playerValue < dealerValue) outcome = "lose";
    else outcome = "push";

    await db.updateBlackjackGame(env.DB, ctx.from.id, playerCards, dealerCards, deck, "finished");
    await resolveBlackjack(ctx.api, env, ctx.from.id, playerCards, dealerCards, outcome);
  });

  // ---------- hangman ----------

  bot.callbackQuery(/^hangman:cat:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const categories = Object.keys(HANGMAN_CATEGORIES);
    const category = categories[Number(ctx.match[1])];
    const words = HANGMAN_CATEGORIES[category];
    const word = words[Math.floor(Math.random() * words.length)];
    await db.startHangmanGame(env.DB, word, category);
    await broadcastWithKeyboard(
      ctx.api,
      env,
      renderHangmanText(word, "", 0, category),
      renderHangmanKeyboard(word, "")
    );
  });

  bot.callbackQuery(/^hangman:noop$/, async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^hangman:guess:(.)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const letter = ctx.match[1];
    const game = await db.getHangmanGame(env.DB);
    if (!game || game.status !== "active") return;
    if (game.guessed_letters.includes(letter)) return;

    const newGuessed = game.guessed_letters + letter;
    const correct = game.word.includes(letter);
    const newWrong = correct ? game.wrong_count : game.wrong_count + 1;
    const won = game.word.split("").every((ch) => newGuessed.includes(ch));
    const lost = newWrong >= hangmanMaxWrong(game.word);
    const status = won ? "won" : lost ? "lost" : "active";

    await db.updateHangmanGame(env.DB, newGuessed, newWrong, status);

    if (won || lost) {
      await db.clearActiveGame(env.DB);
    }
    if (won) {
      await broadcastToBoth(ctx.api, env, `🎉 بردید! کلمه «${game.word}» بود.`);
      return;
    }
    if (lost) {
      await broadcastToBoth(ctx.api, env, `💀 باختید! کلمه «${game.word}» بود.`);
      return;
    }

    await broadcastWithKeyboard(
      ctx.api,
      env,
      renderHangmanText(game.word, newGuessed, newWrong, game.category),
      renderHangmanKeyboard(game.word, newGuessed)
    );
  });

  // ---------- word chain ----------

  bot.callbackQuery(/^wordchain:stop$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await db.endWordChain(env.DB);
    await db.clearActiveGame(env.DB);
    await broadcastToBoth(ctx.api, env, "🏳️ زنجیره‌ی کلمات تموم شد. هر وقت خواستید از منو دوباره شروع کنید.");
  });

  // ---------- daily couple challenge ----------

  bot.callbackQuery(/^daily:done$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const today = toISODate(todayUTC());
    const marked = await db.markDailyChallengeCompleted(env.DB, today);
    if (!marked) {
      await ctx.reply("قبلاً ثبت شده بود ✅");
      return;
    }
    const streak = await db.bumpDailyChallengeStreak(env.DB, today);
    await broadcastToBoth(ctx.api, env, `🔥 چالش امروز انجام شد! استریک: ${toPersianDigits(streak)} روز پشت‌سرهم`);
  });

  bot.callbackQuery(/^daily:history$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const history = await db.listDailyChallengeHistory(env.DB, 10);
    if (history.length === 0) {
      await ctx.reply("هنوز تاریخچه‌ای نیست.");
      return;
    }
    const lines = history.map(
      (h) => `${h.completed ? "✅" : "◻️"} ${formatJalali(h.challenge_date)} — ${h.challenge_text}`
    );
    await ctx.reply(lines.join("\n"), { reply_markup: mainMenuKeyboard() });
  });

  // ---------- truth or dare (turn-based) ----------

  bot.callbackQuery(/^td:cancel$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await db.clearActiveGame(env.DB);
    await ctx.reply("باشه، بی‌خیالش شدیم.", { reply_markup: mainMenuKeyboard() });
  });

  bot.callbackQuery(/^td:spice:(normal|spicy)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const spice = ctx.match[1];
    await db.startTdSession(env.DB, spice, ctx.from.id);
    await sendTdTurnPrompt(ctx.api, env, ctx.from.id);
  });

  bot.callbackQuery(/^td:choose:(truth|dare)$/, async (ctx) => {
    const session = await db.getTdSession(env.DB);
    if (!session || session.status !== "active") {
      await ctx.answerCallbackQuery({ text: "بازی‌ای در جریان نیست." });
      return;
    }
    if (ctx.from.id !== session.turn) {
      await ctx.answerCallbackQuery({ text: "نوبت تو نیست ⏳" });
      return;
    }
    await ctx.answerCallbackQuery();

    const type = ctx.match[1] as "truth" | "dare";
    const spice = session.spice as "normal" | "spicy";
    const tiers: Tier[] = ["easy", "normal", "hard"];
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    const bucket =
      type === "truth" ? (spice === "spicy" ? TRUTH_SPICY : TRUTH_NORMAL)[tier] : (spice === "spicy" ? DARE_SPICY : DARE_NORMAL)[tier];

    const customTexts = await db.listCustomTdPromptTexts(env.DB, type, spice);
    const combined = [...bucket, ...customTexts];

    if (combined.length === 0) {
      const typeLabel = type === "truth" ? "حقیقت" : "جرأت";
      await ctx.reply(
        `هنوز هیچ ${typeLabel} ۱۸+ ای اضافه نکردید — از «📝 سوالات جرأت‌حقیقت من» توی منوی بازی‌ها اضافه کنید، یا گزینه‌ی دیگه رو بزنید.`
      );
      return;
    }

    const kind = `td_${spice}_${type}_${tier}_ext`;
    const prompt = await db.pickUnusedPrompt(env.DB, kind, combined);
    const header = type === "truth" ? "❓ حقیقت:" : "🎯 جرأت:";

    await db.setPending(env.DB, ctx.from.id, "td_answer", "active", {});
    await broadcastToBoth(ctx.api, env, `${header}\n\n${prompt}\n\nجوابتو (یا اینکه چیکار کردی) بنویس 💬`);
  });

  bot.callbackQuery(/^td:custom$/, async (ctx) => {
    const session = await db.getTdSession(env.DB);
    if (!session || session.status !== "active") {
      await ctx.answerCallbackQuery({ text: "بازی‌ای در جریان نیست." });
      return;
    }
    if (ctx.from.id !== session.turn) {
      await ctx.answerCallbackQuery({ text: "نوبت تو نیست ⏳" });
      return;
    }
    await ctx.answerCallbackQuery();
    await db.setPending(env.DB, ctx.from.id, "td_custom_write", "active", {});
    await ctx.reply("باشه، خودت یه سوال یا جرأت بنویس که می‌خوای بهش جواب بدی:");
  });

  bot.callbackQuery(/^td:end$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await db.endTdSession(env.DB);
    await db.clearActiveGame(env.DB);
    for (const id of parseAllowedIds(env)) {
      await db.clearPending(env.DB, id);
    }
    await broadcastToBoth(ctx.api, env, "🏁 بازی جرأت یا حقیقت تموم شد.");
  });

  // ---------- custom (user-submitted) truth-or-dare prompts ----------

  bot.callbackQuery(/^tdcustom:add:(truth|dare):(normal|spicy)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const type = ctx.match[1] as "truth" | "dare";
    const spice = ctx.match[2] as "normal" | "spicy";
    await db.setPending(env.DB, ctx.from.id, "custom_td_add", "await_text", { type, spice });
    const typeLabel = type === "truth" ? "حقیقت" : "جرأت";
    await ctx.reply(
      `متن ${typeLabel} رو بنویس — می‌تونی چندتا رو با هم بفرستی، فقط هر کدوم رو تو یه خط جدا بنویس:`,
      { reply_markup: cancelKeyboard() }
    );
  });

  bot.callbackQuery(/^tdcustom:list$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const prompts = await db.listAllCustomTdPrompts(env.DB);
    if (prompts.length === 0) {
      await ctx.reply("هنوز سوال/جرأتی اضافه نکردید.", { reply_markup: mainMenuKeyboard() });
      return;
    }
    for (const p of prompts) {
      const typeLabel = p.type === "truth" ? "❓ حقیقت" : "🎯 جرأت";
      const spiceLabel = p.spice === "spicy" ? "۱۸+" : "معمولی";
      const keyboard = new InlineKeyboard().text("🗑 حذف", `tdcustom:del:${p.id}`);
      await ctx.reply(`${typeLabel} (${spiceLabel}):\n${p.text}`, { reply_markup: keyboard });
    }
    await ctx.reply("🔙", { reply_markup: mainMenuKeyboard() });
  });

  bot.callbackQuery(/^tdcustom:del:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await db.deleteCustomTdPrompt(env.DB, Number(ctx.match[1]));
    await ctx.reply("حذف شد 🗑");
  });

  // ---------- shared game lock ----------

  bot.callbackQuery(/^game:forcecancel$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await db.clearActiveGame(env.DB);
    await ctx.reply("بازی فعلی لغو شد ✅ حالا می‌تونید یه بازی جدید شروع کنید.", { reply_markup: mainMenuKeyboard() });
  });

  // ---------- mood tracker ----------

  bot.callbackQuery(/^mood:(great|good|meh|tired|bad)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const mood = ctx.match[1];
    const today = new Date().toISOString().slice(0, 10);
    await db.setMood(env.DB, ctx.from.id, today, mood);
    const name = getUserName(env, ctx.from.id);
    await ctx.reply(`ثبت شد، ${name} جان 💜 حس و حالت برام مهمه.`);
  });

  // ---------- hidden love messages ----------

  bot.callbackQuery(/^secret:(new|inbox)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const action = ctx.match[1];

    if (action === "new") {
      const other = otherUserId(env, ctx.from.id);
      if (!other) {
        await ctx.reply("این قابلیت فقط وقتی کار می‌کنه که هر دو آیدی مجاز توی ALLOWED_USER_IDS ست شده باشن.", {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }
      await db.setPending(env.DB, ctx.from.id, "add_secret", "await_hint", { toUserId: other });
      await ctx.reply(
        "یه سرنخ کوچولو بنویس که بعداً بفهمه موضوعش چیه (رازش رو لو نده) — یا بزن رد شو ✨",
        { reply_markup: skipCancelKeyboard() }
      );
      return;
    }

    const messages = await db.listInboxSecretMessages(env.DB, ctx.from.id);
    if (messages.length === 0) {
      await ctx.reply("هنوز پیام مخفی‌ای برات نیومده، ولی به‌زودی میاد 💌", { reply_markup: mainMenuKeyboard() });
      return;
    }
    for (const m of messages) {
      const keyboard = new InlineKeyboard().text("🔓 بازش کن", `secretopen:${m.id}`);
      await ctx.reply(m.hint ? `💌 ${m.hint}` : "💌 یه پیام مخفی", { reply_markup: keyboard });
    }
    await ctx.reply(mainMenuText(getUserName(env, ctx.from.id)), { reply_markup: mainMenuKeyboard() });
  });

  bot.callbackQuery(/^secretmode:(date|anytime)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const pending = await db.getPending(env.DB, ctx.from.id);
    if (!pending || pending.flow !== "add_secret" || pending.step !== "await_mode") return;
    const data = pending.data as { toUserId: number; hint?: string; content: string };

    if (ctx.match[1] === "anytime") {
      await db.addSecretMessage(env.DB, ctx.from.id, data.toUserId, data.hint ?? null, data.content, null);
      await db.clearPending(env.DB, ctx.from.id);
      await ctx.reply("ثبت شد 💜 هر وقت خواست بازش می‌کنه.", { reply_markup: mainMenuKeyboard() });
      return;
    }

    await db.setPending(env.DB, ctx.from.id, "add_secret", "await_date", data);
    await ctx.reply(`چه روزی به دستش برسه؟ (${DATE_HINT})`, { reply_markup: cancelKeyboard() });
  });

  bot.callbackQuery(/^secretopen:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const message = await db.getSecretMessage(env.DB, Number(ctx.match[1]));
    if (!message || message.to_user_id !== ctx.from.id) {
      await ctx.reply("این پیام پیدا نشد.");
      return;
    }
    await ctx.reply(`💌 یه پیام از ته دل برات:\n\n${message.content}`);
  });

  // ---------- shared savings fund ----------

  bot.callbackQuery(/^savings:(add|goal|status)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const action = ctx.match[1];

    if (action === "add") {
      await db.setPending(env.DB, ctx.from.id, "add_saving", "await_amount", {});
      await ctx.reply("چقدر می‌خوای اضافه کنی؟ (فقط عدد، مثلاً 200000)", { reply_markup: cancelKeyboard() });
      return;
    }

    if (action === "goal") {
      await db.setPending(env.DB, ctx.from.id, "set_goal", "await_name", {});
      await ctx.reply("این پول رو دارید برای چی جمع می‌کنید؟", { reply_markup: cancelKeyboard() });
      return;
    }

    await sendSavingsStatus(ctx, env);
  });

  bot.callbackQuery(/^savings:skipnote$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const pending = await db.getPending(env.DB, ctx.from.id);
    if (!pending || pending.flow !== "add_saving" || pending.step !== "await_note") return;
    const amount = (pending.data as { amount: number }).amount;
    await db.addSavingTransaction(env.DB, ctx.from.id, amount, null);
    await db.clearPending(env.DB, ctx.from.id);
    await ctx.reply(`اضافه شد ✅ ${formatToman(amount)}`, { reply_markup: mainMenuKeyboard() });
  });

  // ---------- little-things notes ----------

  bot.callbackQuery(/^notes:(new|list)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const action = ctx.match[1];

    if (action === "new") {
      await db.setPending(env.DB, ctx.from.id, "add_note", "await_text", {});
      await ctx.reply("چی می‌خوای یادت بمونه؟ (مثلاً «قهوه‌ش رو بدون شکر دوست داره») ✨", {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    const notes = await db.listNotes(env.DB, 20);
    if (notes.length === 0) {
      await ctx.reply("هنوز نکته‌ای ثبت نشده 📝", { reply_markup: mainMenuKeyboard() });
      return;
    }
    await ctx.reply(
      notes.map((n) => `• ${n.note}`).join("\n"),
      { reply_markup: mainMenuKeyboard() }
    );
  });

  // ---------- add-memory wizard ----------

  bot.callbackQuery(/^newmem:(photo|text|skip|today|cancel)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const action = ctx.match[1];

    if (action === "cancel") {
      const pending = await db.getPending(env.DB, ctx.from.id);
      if (pending?.flow === "word_chain_start") {
        await db.clearActiveGame(env.DB);
      }
      await db.clearPending(env.DB, ctx.from.id);
      await ctx.reply("باشه عزیزم، بی‌خیالش شدیم 🤍", { reply_markup: mainMenuKeyboard() });
      return;
    }

    if (action === "photo") {
      await db.setPending(env.DB, ctx.from.id, "add_memory", "await_photo", {});
      await ctx.reply("بفرستش، مشتاق دیدنشم 📸💜", { reply_markup: cancelKeyboard() });
      return;
    }

    if (action === "text") {
      await db.setPending(env.DB, ctx.from.id, "add_memory", "await_caption", {});
      await ctx.reply("بگو چی توی دلته درباره این خاطره 💜", { reply_markup: cancelKeyboard() });
      return;
    }

    const pending = await db.getPending(env.DB, ctx.from.id);
    if (!pending || pending.flow !== "add_memory") return;
    const data = pending.data as AddMemoryData;

    if (action === "skip") {
      if (pending.step === "await_caption") {
        await askLocationStep(ctx, env, data);
      } else if (pending.step === "await_location") {
        await askDateStep(ctx, env, data);
      }
    } else if (action === "today") {
      if (pending.step === "await_date") {
        await finishAddMemory(ctx, env, { ...data, date: new Date().toISOString().slice(0, 10) });
      }
    }
  });

  // ---------- edit entry points (memory) ----------

  bot.callbackQuery(/^mementry:(\d+):(caption|location|date)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const memoryId = Number(ctx.match[1]);
    const field = ctx.match[2] as "caption" | "location" | "date";
    await db.setPending(env.DB, ctx.from.id, "edit_memory", "await_value", { memoryId, field });

    const prompts: Record<string, string> = {
      caption: "بگو چی جایگزین این توضیح بشه 💜",
      location: "مکان جدید کجاست؟ 📍",
      date: `تاریخ جدید؟ (${DATE_HINT})`,
    };
    await ctx.reply(prompts[field], { reply_markup: cancelKeyboard() });
  });

  bot.callbackQuery(/^memdel:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const memoryId = ctx.match[1];
    const keyboard = new InlineKeyboard()
      .text("✅ آره حذفش کن", `memdelyes:${memoryId}`)
      .text("❌ نه", "menu:list_memories");
    await ctx.reply("مطمئنی می‌خوای این خاطره رو برای همیشه پاک کنی؟ 🥺", { reply_markup: keyboard });
  });

  bot.callbackQuery(/^memdelyes:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await db.deleteMemory(env.DB, Number(ctx.match[1]));
    await ctx.reply("باشه، پاک شد 🗑", { reply_markup: mainMenuKeyboard() });
  });

  // ---------- edit entry points (anniversary) ----------

  bot.callbackQuery(/^annentry:(\d+):(name|date)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const anniversaryId = Number(ctx.match[1]);
    const field = ctx.match[2] as "name" | "date";
    await db.setPending(env.DB, ctx.from.id, "edit_anniversary", "await_value", { anniversaryId, field });

    const prompt = field === "name" ? "اسم جدیدش چی باشه؟ ✨" : `تاریخ جدید؟ (${DATE_HINT})`;
    await ctx.reply(prompt, { reply_markup: cancelKeyboard() });
  });

  bot.callbackQuery(/^anndel:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const anniversaryId = ctx.match[1];
    const keyboard = new InlineKeyboard()
      .text("✅ آره حذفش کن", `anndelyes:${anniversaryId}`)
      .text("❌ نه", "menu:list_anniversaries");
    await ctx.reply("مطمئنی می‌خوای این سالگرد رو برای همیشه پاک کنی؟ 🥺", { reply_markup: keyboard });
  });

  bot.callbackQuery(/^anndelyes:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await db.deleteAnniversary(env.DB, Number(ctx.match[1]));
    await ctx.reply("باشه، پاک شد 🗑", { reply_markup: mainMenuKeyboard() });
  });

  // ---------- photo messages ----------

  bot.on("message:photo", async (ctx) => {
    const photo = ctx.message.photo.at(-1);
    if (!photo) return;

    const pending = await db.getPending(env.DB, ctx.from.id);

    if (pending?.flow === "add_memory" && pending.step === "await_photo") {
      const data = { ...(pending.data as AddMemoryData), fileId: photo.file_id };
      if (ctx.message.caption) {
        await askLocationStep(ctx, env, { ...data, caption: sanitizeForTelegram(ctx.message.caption) });
      } else {
        await db.setPending(env.DB, ctx.from.id, "add_memory", "await_caption", data);
        await ctx.reply("توضیح کوتاهی براش داری؟", { reply_markup: skipCancelKeyboard() });
      }
      return;
    }

    if (pending?.flow === "ai_photo_id" && pending.step === "await_photo") {
      await db.clearPending(env.DB, ctx.from.id);
      await ctx.reply("دارم بررسیش می‌کنم... 🔍");

      const base64 = await fetchPhotoBase64(ctx, env, photo.file_id);
      if (!base64) {
        await ctx.reply("نتونستم عکس رو بگیرم، دوباره امتحان کن.", { reply_markup: mainMenuKeyboard() });
        return;
      }

      const memories = await db.getAllMemories(env.DB);
      const memoryLines = memories
        .filter((m) => m.file_id)
        .map(
          (m) => `- ${formatJalali(m.memory_date)}${m.location ? ` در ${m.location}` : ""}: ${m.caption ?? "بدون توضیح"}`
        )
        .join("\n");

      const system = "تو دستیار یه زوج هستی که خاطراتشون رو نگه می‌داره. عکس رو با دقت نگاه کن.";
      const prompt =
        `این خاطرات ثبت‌شده‌ی قبلیه:\n${memoryLines || "(هنوز خاطره‌ای ثبت نشده)"}\n\n` +
        "با توجه به این خاطرات، حدس بزن این عکس جدید احتمالاً مربوط به کدوم خاطره یا سفره (اگه شبیه هیچکدوم نبود بگو)." +
        " بعدشم خودت توصیف کوتاهی از چیزی که توی عکس می‌بینی بنویس. به فارسی و خودمونی جواب بده.";

      try {
        const answer = await askAiVision(env, system, prompt, base64, "image/jpeg");
        await ctx.reply(`🔍 ${answer}`, { reply_markup: mainMenuKeyboard() });
      } catch (err) {
        console.error("ai photo recognition failed", err);
        await ctx.reply("یه مشکلی توی بررسی عکس پیش اومد، دوباره امتحان کن.", { reply_markup: mainMenuKeyboard() });
      }
      return;
    }

    // No active wizard: quick spontaneous save, same as before.
    const caption = ctx.message.caption ? sanitizeForTelegram(ctx.message.caption) : null;
    const today = new Date().toISOString().slice(0, 10);
    const memoryId = await db.addMemory(env.DB, photo.file_id, caption, null, today, ctx.from.id);

    const keyboard = new InlineKeyboard()
      .text("✏️ توضیح", `mementry:${memoryId}:caption`)
      .text("📍 مکان", `mementry:${memoryId}:location`)
      .row()
      .text("📅 تاریخ", `mementry:${memoryId}:date`);

    await ctx.reply("ثبت شد 💜 اگه خواستی جزئیات بیشتری هم اضافه کن:", {
      reply_markup: keyboard,
    });
  });

  // ---------- text messages (routes to whichever wizard step is pending) ----------

  async function relayToPartner(ctx: Context, env: Env, text: string): Promise<void> {
    const other = otherUserId(env, ctx.from!.id);
    if (!other) return;
    const name = getUserName(env, ctx.from!.id);
    try {
      await ctx.api.sendMessage(other, `💬 ${name}: ${text}`);
    } catch (err) {
      console.error(`relay failed to ${other}`, err);
    }
  }

  bot.on("message:text", async (ctx) => {
    const text = sanitizeForTelegram(ctx.message.text.trim());

    const menuAction = REPLY_BUTTON_ACTIONS[text];
    if (menuAction) {
      await db.clearPending(env.DB, ctx.from.id);
      await runMenuAction(ctx, menuAction);
      return;
    }

    // Word chain is gated on the shared game row's `turn` field rather than on
    // this user's "pending" wizard slot, so it can't get silently derailed by
    // an unrelated pending flow, and it never swallows the other player's
    // normal chat (their messages just don't match `chain.turn`).
    const chain = await db.getWordChain(env.DB);
    if (chain?.active && ctx.from.id === chain.turn) {
      const stopKb = new InlineKeyboard().text("🏳️ تموم کردن بازی", "wordchain:stop");
      const expectedStart = wordChainLastLetter(chain.last_word);
      const candidate = meaningfulWordChainText(text);

      if (!expectedStart || !candidate) {
        // The stored word (or this reply) has no real letters at all — treat
        // it as an unrelated message rather than getting the game stuck.
        await db.endWordChain(env.DB);
        await relayToPartner(ctx, env, text);
        return;
      }

      if (!candidate.startsWith(expectedStart)) {
        await ctx.reply(`اشتباهه! باید با «${expectedStart}» شروع بشه. دوباره امتحان کن:`, { reply_markup: stopKb });
        return;
      }

      const other = otherUserId(env, ctx.from.id);
      if (other) {
        await db.advanceWordChain(env.DB, text, other);
        await ctx.reply(`آفرین! طول زنجیره: ${toPersianDigits(chain.streak + 1)} 🔗`, { reply_markup: stopKb });
        try {
          const nextChar = wordChainLastLetter(text) || "؟";
          await ctx.api.sendMessage(
            other,
            `🔤 ${getUserName(env, ctx.from.id)} گفت: «${text}»\nنوبت توئه، یه کلمه بگو که با «${nextChar}» شروع بشه.`,
            { reply_markup: stopKb }
          );
        } catch (err) {
          console.error("word_chain: failed to notify other", err);
        }
      }
      return;
    }

    const pending = await db.getPending(env.DB, ctx.from.id);
    if (!pending) {
      // Nothing active — behave like a normal two-way chat and forward this
      // message straight to the other person, same as answer_relay below.
      await relayToPartner(ctx, env, text);
      return;
    }

    if (pending.flow === "answer_relay") {
      await relayToPartner(ctx, env, text);
      return;
    }

    if (pending.flow === "ttal_create") {
      const data = pending.data as { s1?: string; s2?: string; s3?: string };

      if (pending.step === "await_s1") {
        await db.setPending(env.DB, ctx.from.id, "ttal_create", "await_s2", { s1: text });
        await ctx.reply("جمله‌ی دوم رو بفرست:", { reply_markup: cancelKeyboard() });
        return;
      }
      if (pending.step === "await_s2") {
        await db.setPending(env.DB, ctx.from.id, "ttal_create", "await_s3", { ...data, s2: text });
        await ctx.reply("جمله‌ی سوم رو بفرست:", { reply_markup: cancelKeyboard() });
        return;
      }
      if (pending.step === "await_s3") {
        const full = { ...data, s3: text };
        await db.setPending(env.DB, ctx.from.id, "ttal_create", "await_lie", full);
        const keyboard = new InlineKeyboard()
          .text("۱", "ttal:setlie:1")
          .text("۲", "ttal:setlie:2")
          .text("۳", "ttal:setlie:3")
          .row()
          .text("❌ انصراف", "newmem:cancel");
        await ctx.reply(`این سه‌تا رو نوشتی:\n۱. ${full.s1}\n۲. ${full.s2}\n۳. ${full.s3}\n\nکدومش دروغه؟`, {
          reply_markup: keyboard,
        });
        return;
      }
      return;
    }

    if (pending.flow === "custom_td_add" && pending.step === "await_text") {
      const data = pending.data as { type: "truth" | "dare"; spice: "normal" | "spicy" };
      const lines = splitBulkLines(text);
      for (const line of lines) {
        await db.addCustomTdPrompt(env.DB, data.type, data.spice, line, ctx.from.id);
      }
      await db.clearPending(env.DB, ctx.from.id);
      const confirmText =
        lines.length > 1
          ? `${toPersianDigits(lines.length)} تا اضافه شد ✅ دفعه‌ی بعد که بازی کنید ممکنه بیان.`
          : "اضافه شد ✅ دفعه‌ی بعد که بازی کنید ممکنه بیاد.";
      await ctx.reply(confirmText, { reply_markup: mainMenuKeyboard() });
      return;
    }

    if (pending.flow === "td_custom_write") {
      const session = await db.getTdSession(env.DB);
      if (!session || session.status !== "active" || ctx.from.id !== session.turn) {
        await db.clearPending(env.DB, ctx.from.id);
        return;
      }
      await db.setPending(env.DB, ctx.from.id, "td_answer", "active", {});
      await broadcastToBoth(ctx.api, env, `❓🎯 سوال/جرأتِ خودش:\n\n${text}\n\nجوابتو بنویس 💬`);
      return;
    }

    if (pending.flow === "td_answer") {
      const session = await db.getTdSession(env.DB);
      if (!session || session.status !== "active" || ctx.from.id !== session.turn) {
        await db.clearPending(env.DB, ctx.from.id);
        return;
      }
      const other = otherUserId(env, ctx.from.id);
      await db.clearPending(env.DB, ctx.from.id);
      if (!other) return;

      try {
        await ctx.api.sendMessage(other, `💬 ${getUserName(env, ctx.from.id)}: ${text}`);
      } catch (err) {
        console.error("td: failed to relay answer", err);
      }

      await db.setTdTurn(env.DB, other);
      await sendTdTurnPrompt(ctx.api, env, other);
      return;
    }

    if (pending.flow === "word_chain_start" && pending.step === "await_word") {
      const other = otherUserId(env, ctx.from.id);
      if (!other) {
        await db.clearPending(env.DB, ctx.from.id);
        await db.clearActiveGame(env.DB);
        await ctx.reply("این بازی نیاز به هر دو آیدی مجاز داره.", { reply_markup: mainMenuKeyboard() });
        return;
      }
      const word = text;
      if (!wordChainLastLetter(word)) {
        await ctx.reply("یه کلمه‌ی واقعی بفرست (فقط ایموجی/علامت نمی‌شه) 🔤");
        return;
      }
      await db.startWordChain(env.DB, word, other);
      await db.clearPending(env.DB, ctx.from.id);

      const stopKb = new InlineKeyboard().text("🏳️ تموم کردن بازی", "wordchain:stop");
      const lastChar = wordChainLastLetter(word);
      try {
        await ctx.api.sendMessage(
          other,
          `🔤 ${getUserName(env, ctx.from.id)} گفت: «${word}»\nنوبت توئه، یه کلمه بگو که با «${lastChar}» شروع بشه.`,
          { reply_markup: stopKb }
        );
      } catch (err) {
        console.error("word_chain: failed to notify other", err);
      }
      await ctx.reply(`زنجیره شروع شد! منتظر ${getUserName(env, other)} می‌مونیم ⏳`, { reply_markup: stopKb });
      return;
    }

    if (pending.flow === "add_note") {
      await db.addNote(env.DB, ctx.from.id, text);
      await db.clearPending(env.DB, ctx.from.id);
      await ctx.reply("ثبت شد ✨ یادم می‌مونه.", { reply_markup: mainMenuKeyboard() });
      return;
    }

    if (pending.flow === "add_saving") {
      if (pending.step === "await_amount") {
        const amount = parseAmount(text);
        if (amount === null) {
          await ctx.reply("فقط عدد بفرست، مثلاً 200000");
          return;
        }
        await db.setPending(env.DB, ctx.from.id, "add_saving", "await_note", { amount });
        const keyboard = new InlineKeyboard()
          .text("⏭ رد شدن", "savings:skipnote")
          .text("❌ انصراف", "newmem:cancel");
        await ctx.reply("یادداشتی هم داری؟ (مثلاً «برای کادوی تولدش») یا رد شو", { reply_markup: keyboard });
        return;
      }
      if (pending.step === "await_note") {
        const amount = (pending.data as { amount: number }).amount;
        await db.addSavingTransaction(env.DB, ctx.from.id, amount, text);
        await db.clearPending(env.DB, ctx.from.id);
        await ctx.reply(`اضافه شد ✅ ${formatToman(amount)}`, { reply_markup: mainMenuKeyboard() });
        return;
      }
      return;
    }

    if (pending.flow === "set_goal") {
      if (pending.step === "await_name") {
        await db.setPending(env.DB, ctx.from.id, "set_goal", "await_amount", { name: text });
        await ctx.reply("چقدر تومان هدفتونه؟ (فقط عدد)", { reply_markup: cancelKeyboard() });
        return;
      }
      if (pending.step === "await_amount") {
        const amount = parseAmount(text);
        if (amount === null) {
          await ctx.reply("فقط عدد بفرست، مثلاً 5000000");
          return;
        }
        const name = (pending.data as { name: string }).name;
        await db.setSavingsGoal(env.DB, name, amount);
        await db.clearPending(env.DB, ctx.from.id);
        await ctx.reply(`باشه، هدفتون ثبت شد: ${name} (${formatToman(amount)}) 🎯`, {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }
      return;
    }

    if (pending.flow === "add_memory") {
      const data = pending.data as AddMemoryData;

      if (pending.step === "await_photo") {
        await ctx.reply("منتظر عکسم — یا بزن ❌ انصراف از پیام بالا.");
        return;
      }
      if (pending.step === "await_caption") {
        await askLocationStep(ctx, env, { ...data, caption: text });
        return;
      }
      if (pending.step === "await_location") {
        await askDateStep(ctx, env, { ...data, location: text });
        return;
      }
      if (pending.step === "await_date") {
        const parsed = parseDateInput(text);
        if (!parsed) {
          await ctx.reply(`این فرمت تاریخ رو نشناختم، ${DATE_HINT}`);
          return;
        }
        await finishAddMemory(ctx, env, { ...data, date: parsed });
        return;
      }
      return;
    }

    if (pending.flow === "add_anniversary") {
      if (pending.step === "await_name") {
        await db.setPending(env.DB, ctx.from.id, "add_anniversary", "await_date", { name: text });
        await ctx.reply(`این لحظه‌ی خاص کِی بود؟ (${DATE_HINT})`, { reply_markup: cancelKeyboard() });
        return;
      }
      if (pending.step === "await_date") {
        const parsed = parseDateInput(text);
        if (!parsed) {
          await ctx.reply(`این تاریخ رو نشناختم، دوباره امتحان کن — ${DATE_HINT}`);
          return;
        }
        const name = (pending.data as { name: string }).name;
        await db.addAnniversary(env.DB, name, parsed, true, ctx.from.id);
        await db.clearPending(env.DB, ctx.from.id);
        await ctx.reply(`سالگرد «${name}» ثبت شد 🎉 هر سال بهتون می‌گم جشن بگیرید.`, {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }
      return;
    }

    if (pending.flow === "add_secret") {
      const data = pending.data as { toUserId: number; hint?: string; content?: string };

      if (pending.step === "await_hint") {
        await db.setPending(env.DB, ctx.from.id, "add_secret", "await_content", { ...data, hint: text });
        await ctx.reply("بنویس چی تو دلته، خجالت نکش 💜", { reply_markup: cancelKeyboard() });
        return;
      }
      if (pending.step === "await_content") {
        await db.setPending(env.DB, ctx.from.id, "add_secret", "await_mode", { ...data, content: text });
        const keyboard = new InlineKeyboard()
          .text("📅 یه تاریخ مشخص", "secretmode:date")
          .text("🔓 هر وقت خواست", "secretmode:anytime")
          .row()
          .text("❌ انصراف", "newmem:cancel");
        await ctx.reply("کی بهش برسه؟ 💌", { reply_markup: keyboard });
        return;
      }
      if (pending.step === "await_date") {
        const parsed = parseDateInput(text);
        if (!parsed) {
          await ctx.reply(`این فرمت تاریخ رو نشناختم، ${DATE_HINT}`);
          return;
        }
        await db.addSecretMessage(env.DB, ctx.from.id, data.toUserId, data.hint ?? null, data.content ?? "", parsed);
        await db.clearPending(env.DB, ctx.from.id);
        await ctx.reply(`باشه، ${formatJalali(parsed)} براش می‌فرستمش 💜`, { reply_markup: mainMenuKeyboard() });
        return;
      }
      return;
    }

    if (pending.flow === "edit_memory") {
      const { memoryId, field } = pending.data as { memoryId: number; field: "caption" | "location" | "date" };
      let dateValue: string | null = null;
      if (field === "date") {
        dateValue = parseDateInput(text);
        if (!dateValue) {
          await ctx.reply(`این فرمت تاریخ رو نشناختم، ${DATE_HINT}`);
          return;
        }
      }
      if (field === "caption") await db.updateMemoryCaption(env.DB, memoryId, text);
      if (field === "location") await db.updateMemoryLocation(env.DB, memoryId, text);
      if (field === "date") await db.updateMemoryDate(env.DB, memoryId, dateValue as string);
      await db.clearPending(env.DB, ctx.from.id);
      await ctx.reply("عالی شد، به‌روز شد ✅", { reply_markup: mainMenuKeyboard() });
      return;
    }

    if (pending.flow === "edit_anniversary") {
      const { anniversaryId, field } = pending.data as { anniversaryId: number; field: "name" | "date" };
      let dateValue: string | null = null;
      if (field === "date") {
        dateValue = parseDateInput(text);
        if (!dateValue) {
          await ctx.reply(`این فرمت تاریخ رو نشناختم، ${DATE_HINT}`);
          return;
        }
      }
      if (field === "name") await db.updateAnniversaryName(env.DB, anniversaryId, text);
      if (field === "date") await db.updateAnniversaryDate(env.DB, anniversaryId, dateValue as string);
      await db.clearPending(env.DB, ctx.from.id);
      await ctx.reply("عالی شد، به‌روز شد ✅", { reply_markup: mainMenuKeyboard() });
      return;
    }
  });

  // ---------- legacy shortcut commands (still work for quick typed entry) ----------

  bot.command("memories", async (ctx) => {
    await sendMemoriesList(ctx, env);
  });

  bot.command("thismonth", async (ctx) => {
    await sendMonthRecap(ctx, env);
  });

  bot.command("newanniversary", async (ctx) => {
    if (!ctx.from) return;
    const raw = ctx.match?.toString().trim() ?? "";
    const parts = raw.split(/\s+/).filter(Boolean);
    const parsed = parts.length >= 2 ? parseDateInput(parts[parts.length - 1]) : null;

    if (!parsed) {
      await ctx.reply(
        `اینطوری بفرست:\n/newanniversary اولین قرار ۱۴۰۳-۰۱-۲۴\n(اسم رویداد + تاریخ ${DATE_HINT} در آخر)`
      );
      return;
    }

    const name = parts.slice(0, -1).join(" ");
    await db.addAnniversary(env.DB, name, parsed, true, ctx.from.id);
    await ctx.reply(`سالگرد «${name}» ثبت شد 🎉 هر سال بهتون می‌گم جشن بگیرید.`);
  });

  bot.command("anniversaries", async (ctx) => {
    await sendAnniversariesList(ctx, env);
  });

  bot.command("delanniversary", async (ctx) => {
    const arg = ctx.match?.toString().trim() ?? "";
    if (!/^\d+$/.test(arg)) {
      await ctx.reply("اینطوری بفرست: /delanniversary <id>\n(آیدی رو از /anniversaries بگیر)");
      return;
    }
    await db.deleteAnniversary(env.DB, Number(arg));
    await ctx.reply("باشه، پاک شد.");
  });

  return bot;
}
