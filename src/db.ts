import { parseISODate, toISODate } from "./dates";

export interface Memory {
  id: number;
  file_id: string | null;
  caption: string | null;
  location: string | null;
  memory_date: string;
  created_by: number;
  created_at: string;
}

export interface Anniversary {
  id: number;
  name: string;
  event_date: string;
  recurring: number;
  created_by: number;
  created_at: string;
}

export interface Pending {
  user_id: number;
  flow: string;
  step: string;
  data: Record<string, unknown>;
}

export interface Mood {
  user_id: number;
  mood_date: string;
  mood: string;
  created_at: string;
}

export interface SecretMessage {
  id: number;
  from_user_id: number;
  to_user_id: number;
  hint: string | null;
  content: string;
  deliver_date: string | null;
  delivered: number;
  created_at: string;
}

// ---------- memories ----------

export async function addMemory(
  db: D1Database,
  fileId: string | null,
  caption: string | null,
  location: string | null,
  memoryDate: string,
  createdBy: number
): Promise<number> {
  const res = await db
    .prepare(
      "INSERT INTO memories (file_id, caption, location, memory_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(fileId, caption, location, memoryDate, createdBy, new Date().toISOString())
    .run();
  return res.meta.last_row_id as number;
}

export async function getMemory(db: D1Database, id: number): Promise<Memory | null> {
  const row = await db.prepare("SELECT * FROM memories WHERE id = ?").bind(id).first<Memory>();
  return row ?? null;
}

export async function updateMemoryCaption(db: D1Database, memoryId: number, caption: string): Promise<void> {
  await db.prepare("UPDATE memories SET caption = ? WHERE id = ?").bind(caption, memoryId).run();
}

export async function updateMemoryLocation(db: D1Database, memoryId: number, location: string): Promise<void> {
  await db.prepare("UPDATE memories SET location = ? WHERE id = ?").bind(location, memoryId).run();
}

export async function updateMemoryDate(db: D1Database, memoryId: number, memoryDate: string): Promise<void> {
  await db.prepare("UPDATE memories SET memory_date = ? WHERE id = ?").bind(memoryDate, memoryId).run();
}

export async function deleteMemory(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM memories WHERE id = ?").bind(id).run();
}

export async function getAllMemories(db: D1Database): Promise<Memory[]> {
  const res = await db.prepare("SELECT * FROM memories ORDER BY memory_date").all<Memory>();
  return res.results ?? [];
}

export async function listRecentMemories(db: D1Database, limit = 5): Promise<Memory[]> {
  const res = await db
    .prepare("SELECT * FROM memories ORDER BY memory_date DESC, id DESC LIMIT ?")
    .bind(limit)
    .all<Memory>();
  return res.results ?? [];
}

export async function countMemoriesBetween(db: D1Database, startDate: string, endDate: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS c FROM memories WHERE memory_date >= ? AND memory_date < ?")
    .bind(startDate, endDate)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

export async function findMemoriesOnMonthDay(
  db: D1Database,
  month: number,
  day: number,
  excludeYear: number
): Promise<Memory[]> {
  const res = await db
    .prepare(
      "SELECT * FROM memories WHERE strftime('%m', memory_date) = ? AND strftime('%d', memory_date) = ? " +
        "AND strftime('%Y', memory_date) != ?"
    )
    .bind(String(month).padStart(2, "0"), String(day).padStart(2, "0"), String(excludeYear))
    .all<Memory>();
  return res.results ?? [];
}

export async function wasOnThisDaySent(db: D1Database, memoryId: number, year: number): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM on_this_day_log WHERE memory_id = ? AND year = ?")
    .bind(memoryId, year)
    .first();
  return row !== null;
}

export async function markOnThisDaySent(db: D1Database, memoryId: number, year: number): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO on_this_day_log (memory_id, year) VALUES (?, ?)")
    .bind(memoryId, year)
    .run();
}

// ---------- anniversaries ----------

export async function addAnniversary(
  db: D1Database,
  name: string,
  eventDate: string,
  recurring: boolean,
  createdBy: number
): Promise<number> {
  const res = await db
    .prepare(
      "INSERT INTO anniversaries (name, event_date, recurring, created_by, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(name, eventDate, recurring ? 1 : 0, createdBy, new Date().toISOString())
    .run();
  return res.meta.last_row_id as number;
}

export async function getAnniversary(db: D1Database, id: number): Promise<Anniversary | null> {
  const row = await db.prepare("SELECT * FROM anniversaries WHERE id = ?").bind(id).first<Anniversary>();
  return row ?? null;
}

export async function updateAnniversaryName(db: D1Database, id: number, name: string): Promise<void> {
  await db.prepare("UPDATE anniversaries SET name = ? WHERE id = ?").bind(name, id).run();
}

export async function updateAnniversaryDate(db: D1Database, id: number, eventDate: string): Promise<void> {
  await db.prepare("UPDATE anniversaries SET event_date = ? WHERE id = ?").bind(eventDate, id).run();
}

export async function listAnniversaries(db: D1Database): Promise<Anniversary[]> {
  const res = await db.prepare("SELECT * FROM anniversaries ORDER BY event_date").all<Anniversary>();
  return res.results ?? [];
}

export async function deleteAnniversary(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM anniversaries WHERE id = ?").bind(id).run();
}

export async function wasReminderSent(
  db: D1Database,
  anniversaryId: number,
  year: number,
  daysBefore: number
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM reminder_log WHERE anniversary_id = ? AND year = ? AND days_before = ?")
    .bind(anniversaryId, year, daysBefore)
    .first();
  return row !== null;
}

export async function markReminderSent(
  db: D1Database,
  anniversaryId: number,
  year: number,
  daysBefore: number
): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO reminder_log (anniversary_id, year, days_before) VALUES (?, ?, ?)")
    .bind(anniversaryId, year, daysBefore)
    .run();
}

// ---------- pending wizard state (menu-driven add/edit flows) ----------

export async function setPending(
  db: D1Database,
  userId: number,
  flow: string,
  step: string,
  data: Record<string, unknown>
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO pending_actions (user_id, flow, step, data, created_at) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET flow = excluded.flow, step = excluded.step, " +
        "data = excluded.data, created_at = excluded.created_at"
    )
    .bind(userId, flow, step, JSON.stringify(data), new Date().toISOString())
    .run();
}

export async function getPending(db: D1Database, userId: number): Promise<Pending | null> {
  const row = await db
    .prepare("SELECT * FROM pending_actions WHERE user_id = ?")
    .bind(userId)
    .first<{ user_id: number; flow: string; step: string; data: string }>();
  if (!row) return null;
  return { user_id: row.user_id, flow: row.flow, step: row.step, data: JSON.parse(row.data) };
}

export async function clearPending(db: D1Database, userId: number): Promise<void> {
  await db.prepare("DELETE FROM pending_actions WHERE user_id = ?").bind(userId).run();
}

// ---------- mood tracker ----------

export async function setMood(db: D1Database, userId: number, moodDate: string, mood: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO moods (user_id, mood_date, mood, created_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(user_id, mood_date) DO UPDATE SET mood = excluded.mood, created_at = excluded.created_at"
    )
    .bind(userId, moodDate, mood, new Date().toISOString())
    .run();
}

export async function getMoodsSince(db: D1Database, sinceDateInclusive: string): Promise<Mood[]> {
  const res = await db
    .prepare("SELECT * FROM moods WHERE mood_date >= ? ORDER BY mood_date")
    .bind(sinceDateInclusive)
    .all<Mood>();
  return res.results ?? [];
}

// ---------- secret (hidden love) messages ----------

export async function addSecretMessage(
  db: D1Database,
  fromUserId: number,
  toUserId: number,
  hint: string | null,
  content: string,
  deliverDate: string | null
): Promise<number> {
  const res = await db
    .prepare(
      "INSERT INTO secret_messages (from_user_id, to_user_id, hint, content, deliver_date, delivered, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(fromUserId, toUserId, hint, content, deliverDate, deliverDate ? 0 : 1, new Date().toISOString())
    .run();
  return res.meta.last_row_id as number;
}

export async function getSecretMessage(db: D1Database, id: number): Promise<SecretMessage | null> {
  const row = await db.prepare("SELECT * FROM secret_messages WHERE id = ?").bind(id).first<SecretMessage>();
  return row ?? null;
}

export async function listInboxSecretMessages(db: D1Database, toUserId: number): Promise<SecretMessage[]> {
  const res = await db
    .prepare(
      "SELECT * FROM secret_messages WHERE to_user_id = ? AND (deliver_date IS NULL OR delivered = 1) " +
        "ORDER BY created_at DESC"
    )
    .bind(toUserId)
    .all<SecretMessage>();
  return res.results ?? [];
}

export async function findDueSecretMessages(db: D1Database, today: string): Promise<SecretMessage[]> {
  const res = await db
    .prepare("SELECT * FROM secret_messages WHERE deliver_date = ? AND delivered = 0")
    .bind(today)
    .all<SecretMessage>();
  return res.results ?? [];
}

export async function markSecretMessageDelivered(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE secret_messages SET delivered = 1 WHERE id = ?").bind(id).run();
}

// ---------- prompt anti-repeat (couple questions / weekly challenges) ----------

export async function pickUnusedPrompt(db: D1Database, kind: string, all: string[]): Promise<string> {
  const usedRows = await db.prepare("SELECT item FROM used_prompts WHERE kind = ?").bind(kind).all<{ item: string }>();
  const used = new Set((usedRows.results ?? []).map((r) => r.item));

  let candidates = all.filter((item) => !used.has(item));
  if (candidates.length === 0) {
    await db.prepare("DELETE FROM used_prompts WHERE kind = ?").bind(kind).run();
    candidates = all;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  await db
    .prepare("INSERT INTO used_prompts (kind, item, used_at) VALUES (?, ?, ?)")
    .bind(kind, pick, new Date().toISOString())
    .run();
  return pick;
}

// ---------- bot stats ----------

export interface Stats {
  memoryCount: number;
  anniversaryCount: number;
  secretMessageCount: number;
  moodCount: number;
  noteCount: number;
  savingsTotal: number;
  promptsUsedCount: number;
  tttGamesPlayed: number;
  dailyChallengesCompleted: number;
  dailyChallengeStreak: number;
  earliestDate: string | null;
}

export async function getStats(db: D1Database): Promise<Stats> {
  const [
    memoryRow,
    annivRow,
    secretRow,
    moodRow,
    noteRow,
    savingsRow,
    promptsRow,
    tttRow,
    dailyDoneRow,
    dailyStreak,
    earliestMemory,
    earliestAnniv,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS c FROM memories").first<{ c: number }>(),
    db.prepare("SELECT COUNT(*) AS c FROM anniversaries").first<{ c: number }>(),
    db.prepare("SELECT COUNT(*) AS c FROM secret_messages").first<{ c: number }>(),
    db.prepare("SELECT COUNT(*) AS c FROM moods").first<{ c: number }>(),
    db.prepare("SELECT COUNT(*) AS c FROM notes").first<{ c: number }>(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM savings_transactions").first<{ s: number }>(),
    db.prepare("SELECT COUNT(*) AS c FROM used_prompts").first<{ c: number }>(),
    db.prepare("SELECT COALESCE(SUM(wins), 0) AS s FROM ttt_scores").first<{ s: number }>(),
    db.prepare("SELECT COUNT(*) AS c FROM daily_challenge_log WHERE completed = 1").first<{ c: number }>(),
    getDailyChallengeStreak(db),
    db.prepare("SELECT MIN(memory_date) AS d FROM memories").first<{ d: string | null }>(),
    db.prepare("SELECT MIN(event_date) AS d FROM anniversaries").first<{ d: string | null }>(),
  ]);

  const dates = [earliestMemory?.d, earliestAnniv?.d].filter((d): d is string => !!d);
  const earliestDate = dates.length > 0 ? dates.sort()[0] : null;

  return {
    memoryCount: memoryRow?.c ?? 0,
    anniversaryCount: annivRow?.c ?? 0,
    secretMessageCount: secretRow?.c ?? 0,
    moodCount: moodRow?.c ?? 0,
    noteCount: noteRow?.c ?? 0,
    savingsTotal: savingsRow?.s ?? 0,
    promptsUsedCount: promptsRow?.c ?? 0,
    tttGamesPlayed: tttRow?.s ?? 0,
    dailyChallengesCompleted: dailyDoneRow?.c ?? 0,
    dailyChallengeStreak: dailyStreak.current_streak,
    earliestDate,
  };
}

// ---------- location visit reminders ----------

export interface LocationVisit {
  location: string;
  last_visit: string;
}

export async function getLastVisitPerLocation(db: D1Database): Promise<LocationVisit[]> {
  const res = await db
    .prepare(
      "SELECT location, MAX(memory_date) AS last_visit FROM memories " +
        "WHERE location IS NOT NULL AND location != '' GROUP BY location"
    )
    .all<LocationVisit>();
  return res.results ?? [];
}

export async function getLocationReminderDate(db: D1Database, location: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT last_reminded_date FROM location_visit_reminders WHERE location = ?")
    .bind(location)
    .first<{ last_reminded_date: string }>();
  return row?.last_reminded_date ?? null;
}

export async function setLocationReminderDate(db: D1Database, location: string, date: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO location_visit_reminders (location, last_reminded_date) VALUES (?, ?) " +
        "ON CONFLICT(location) DO UPDATE SET last_reminded_date = excluded.last_reminded_date"
    )
    .bind(location, date)
    .run();
}

// ---------- little-things notes ----------

export interface Note {
  id: number;
  author_id: number;
  note: string;
  created_at: string;
}

export async function addNote(db: D1Database, authorId: number, note: string): Promise<number> {
  const res = await db
    .prepare("INSERT INTO notes (author_id, note, created_at) VALUES (?, ?, ?)")
    .bind(authorId, note, new Date().toISOString())
    .run();
  return res.meta.last_row_id as number;
}

export async function listNotes(db: D1Database, limit = 20): Promise<Note[]> {
  const res = await db.prepare("SELECT * FROM notes ORDER BY id DESC LIMIT ?").bind(limit).all<Note>();
  return res.results ?? [];
}

// ---------- shared savings fund ----------

export interface SavingTransaction {
  id: number;
  user_id: number;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface SavingsGoal {
  id: number;
  goal_name: string | null;
  goal_amount: number | null;
}

export async function addSavingTransaction(
  db: D1Database,
  userId: number,
  amount: number,
  note: string | null
): Promise<number> {
  const res = await db
    .prepare("INSERT INTO savings_transactions (user_id, amount, note, created_at) VALUES (?, ?, ?, ?)")
    .bind(userId, amount, note, new Date().toISOString())
    .run();
  return res.meta.last_row_id as number;
}

export async function listSavingTransactions(db: D1Database, limit = 8): Promise<SavingTransaction[]> {
  const res = await db
    .prepare("SELECT * FROM savings_transactions ORDER BY id DESC LIMIT ?")
    .bind(limit)
    .all<SavingTransaction>();
  return res.results ?? [];
}

export async function getSavingsTotal(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM savings_transactions")
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function getSavingsTotalsByUser(db: D1Database): Promise<{ user_id: number; total: number }[]> {
  const res = await db
    .prepare("SELECT user_id, SUM(amount) AS total FROM savings_transactions GROUP BY user_id")
    .all<{ user_id: number; total: number }>();
  return res.results ?? [];
}

export async function setSavingsGoal(db: D1Database, name: string, amount: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO savings_goal (id, goal_name, goal_amount) VALUES (1, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET goal_name = excluded.goal_name, goal_amount = excluded.goal_amount"
    )
    .bind(name, amount)
    .run();
}

export async function getSavingsGoal(db: D1Database): Promise<SavingsGoal | null> {
  const row = await db.prepare("SELECT * FROM savings_goal WHERE id = 1").first<SavingsGoal>();
  return row ?? null;
}

// ---------- rock-paper-scissors ----------

export interface RpsMove {
  user_id: number;
  move: string;
}

export async function setRpsMove(db: D1Database, userId: number, move: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO rps_moves (user_id, move, created_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET move = excluded.move, created_at = excluded.created_at"
    )
    .bind(userId, move, new Date().toISOString())
    .run();
}

export async function getRpsMove(db: D1Database, userId: number): Promise<RpsMove | null> {
  const row = await db.prepare("SELECT * FROM rps_moves WHERE user_id = ?").bind(userId).first<RpsMove>();
  return row ?? null;
}

export async function clearRpsMoves(db: D1Database, userIds: number[]): Promise<void> {
  for (const id of userIds) {
    await db.prepare("DELETE FROM rps_moves WHERE user_id = ?").bind(id).run();
  }
}

// ---------- two truths and a lie ----------

export interface TtalGame {
  id: number;
  author_id: number;
  statement1: string;
  statement2: string;
  statement3: string;
  lie_index: number;
  guessed_index: number | null;
  resolved: number;
  created_at: string;
}

export async function createTtalGame(
  db: D1Database,
  authorId: number,
  statements: [string, string, string],
  lieIndex: number
): Promise<number> {
  const res = await db
    .prepare(
      "INSERT INTO ttal_games (author_id, statement1, statement2, statement3, lie_index, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(authorId, statements[0], statements[1], statements[2], lieIndex, new Date().toISOString())
    .run();
  return res.meta.last_row_id as number;
}

export async function getTtalGame(db: D1Database, id: number): Promise<TtalGame | null> {
  const row = await db.prepare("SELECT * FROM ttal_games WHERE id = ?").bind(id).first<TtalGame>();
  return row ?? null;
}

export async function resolveTtalGame(db: D1Database, id: number, guessedIndex: number): Promise<void> {
  await db
    .prepare("UPDATE ttal_games SET resolved = 1, guessed_index = ? WHERE id = ?")
    .bind(guessedIndex, id)
    .run();
}

// ---------- speed tap / reaction game ----------

export interface ReactionRound {
  id: number;
  status: string;
  go_at: string | null;
}

export async function getReactionRound(db: D1Database): Promise<ReactionRound | null> {
  const row = await db.prepare("SELECT * FROM reaction_rounds WHERE id = 1").first<ReactionRound>();
  return row ?? null;
}

export async function startReactionRound(db: D1Database): Promise<void> {
  await db
    .prepare(
      "INSERT INTO reaction_rounds (id, status, go_at) VALUES (1, 'waiting', NULL) " +
        "ON CONFLICT(id) DO UPDATE SET status = 'waiting', go_at = NULL"
    )
    .run();
}

export async function activateReactionRound(db: D1Database): Promise<void> {
  await db
    .prepare("UPDATE reaction_rounds SET status = 'active', go_at = ? WHERE id = 1")
    .bind(new Date().toISOString())
    .run();
}

export async function finishReactionRound(db: D1Database): Promise<void> {
  await db.prepare("UPDATE reaction_rounds SET status = 'finished' WHERE id = 1").run();
}

export async function getReactionRecord(db: D1Database, userId: number): Promise<number | null> {
  const row = await db
    .prepare("SELECT best_ms FROM reaction_records WHERE user_id = ?")
    .bind(userId)
    .first<{ best_ms: number }>();
  return row?.best_ms ?? null;
}

export async function setReactionRecord(db: D1Database, userId: number, ms: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO reaction_records (user_id, best_ms) VALUES (?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET best_ms = excluded.best_ms"
    )
    .bind(userId, ms)
    .run();
}

// ---------- tic-tac-toe ----------

export interface TttGame {
  id: number;
  board: string;
  turn: number;
  player_x: number;
  player_o: number;
  status: string;
  created_at: string;
}

export async function getTttGame(db: D1Database): Promise<TttGame | null> {
  const row = await db.prepare("SELECT * FROM ttt_games WHERE id = 1").first<TttGame>();
  return row ?? null;
}

export async function startTttGame(db: D1Database, playerX: number, playerO: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO ttt_games (id, board, turn, player_x, player_o, status, created_at) " +
        "VALUES (1, '_________', ?, ?, ?, 'active', ?) " +
        "ON CONFLICT(id) DO UPDATE SET board = excluded.board, turn = excluded.turn, " +
        "player_x = excluded.player_x, player_o = excluded.player_o, status = excluded.status, " +
        "created_at = excluded.created_at"
    )
    .bind(playerX, playerX, playerO, new Date().toISOString())
    .run();
}

export async function updateTttGame(db: D1Database, board: string, turn: number, status: string): Promise<void> {
  await db
    .prepare("UPDATE ttt_games SET board = ?, turn = ?, status = ? WHERE id = 1")
    .bind(board, turn, status)
    .run();
}

export async function incrementTttWins(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO ttt_scores (user_id, wins) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET wins = wins + 1"
    )
    .bind(userId)
    .run();
}

export async function getTttScores(db: D1Database, userIds: number[]): Promise<Record<number, number>> {
  const result: Record<number, number> = {};
  for (const id of userIds) {
    const row = await db.prepare("SELECT wins FROM ttt_scores WHERE user_id = ?").bind(id).first<{ wins: number }>();
    result[id] = row?.wins ?? 0;
  }
  return result;
}

// ---------- connect four ----------

export interface C4Game {
  id: number;
  board: string;
  turn: number;
  player_r: number;
  player_y: number;
  status: string;
  created_at: string;
}

export async function getC4Game(db: D1Database): Promise<C4Game | null> {
  const row = await db.prepare("SELECT * FROM c4_games WHERE id = 1").first<C4Game>();
  return row ?? null;
}

export async function startC4Game(db: D1Database, playerR: number, playerY: number): Promise<void> {
  const emptyBoard = "_".repeat(42);
  await db
    .prepare(
      "INSERT INTO c4_games (id, board, turn, player_r, player_y, status, created_at) " +
        "VALUES (1, ?, ?, ?, ?, 'active', ?) " +
        "ON CONFLICT(id) DO UPDATE SET board = excluded.board, turn = excluded.turn, " +
        "player_r = excluded.player_r, player_y = excluded.player_y, status = excluded.status, " +
        "created_at = excluded.created_at"
    )
    .bind(emptyBoard, playerR, playerR, playerY, new Date().toISOString())
    .run();
}

export async function updateC4Game(db: D1Database, board: string, turn: number, status: string): Promise<void> {
  await db.prepare("UPDATE c4_games SET board = ?, turn = ?, status = ? WHERE id = 1").bind(board, turn, status).run();
}

// ---------- battleship ----------

export interface BattleshipGame {
  id: number;
  player_a: number;
  player_b: number;
  board_a: string;
  board_b: string;
  hits_a: string;
  hits_b: string;
  turn: number;
  status: string;
  created_at: string;
}

export async function getBattleshipGame(db: D1Database): Promise<BattleshipGame | null> {
  const row = await db.prepare("SELECT * FROM battleship_games WHERE id = 1").first<BattleshipGame>();
  return row ?? null;
}

export async function startBattleshipGame(
  db: D1Database,
  playerA: number,
  playerB: number,
  boardA: string,
  boardB: string
): Promise<void> {
  const emptyHits = ".".repeat(boardA.length);
  await db
    .prepare(
      "INSERT INTO battleship_games " +
        "(id, player_a, player_b, board_a, board_b, hits_a, hits_b, turn, status, created_at) " +
        "VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'active', ?) " +
        "ON CONFLICT(id) DO UPDATE SET player_a=excluded.player_a, player_b=excluded.player_b, " +
        "board_a=excluded.board_a, board_b=excluded.board_b, hits_a=excluded.hits_a, hits_b=excluded.hits_b, " +
        "turn=excluded.turn, status=excluded.status, created_at=excluded.created_at"
    )
    .bind(playerA, playerB, boardA, boardB, emptyHits, emptyHits, playerA, new Date().toISOString())
    .run();
}

export async function updateBattleshipGame(
  db: D1Database,
  hitsA: string,
  hitsB: string,
  turn: number,
  status: string
): Promise<void> {
  await db
    .prepare("UPDATE battleship_games SET hits_a = ?, hits_b = ?, turn = ?, status = ? WHERE id = 1")
    .bind(hitsA, hitsB, turn, status)
    .run();
}

// ---------- blackjack ----------

export async function getBlackjackPoints(db: D1Database, userId: number): Promise<number> {
  const row = await db
    .prepare("SELECT points FROM blackjack_points WHERE user_id = ?")
    .bind(userId)
    .first<{ points: number }>();
  if (row) return row.points;
  await db.prepare("INSERT INTO blackjack_points (user_id, points) VALUES (?, 1000)").bind(userId).run();
  return 1000;
}

export async function setBlackjackPoints(db: D1Database, userId: number, points: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO blackjack_points (user_id, points) VALUES (?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET points = excluded.points"
    )
    .bind(userId, points)
    .run();
}

export interface BlackjackGame {
  user_id: number;
  player_cards: string;
  dealer_cards: string;
  deck: string;
  bet: number;
  status: string;
  created_at: string;
}

export async function startBlackjackGame(
  db: D1Database,
  userId: number,
  playerCards: string[],
  dealerCards: string[],
  deck: string[],
  bet: number
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO blackjack_games (user_id, player_cards, dealer_cards, deck, bet, status, created_at) " +
        "VALUES (?, ?, ?, ?, ?, 'active', ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET player_cards=excluded.player_cards, dealer_cards=excluded.dealer_cards, " +
        "deck=excluded.deck, bet=excluded.bet, status=excluded.status, created_at=excluded.created_at"
    )
    .bind(userId, playerCards.join(","), dealerCards.join(","), deck.join(","), bet, new Date().toISOString())
    .run();
}

export async function getBlackjackGame(db: D1Database, userId: number): Promise<BlackjackGame | null> {
  const row = await db.prepare("SELECT * FROM blackjack_games WHERE user_id = ?").bind(userId).first<BlackjackGame>();
  return row ?? null;
}

export async function updateBlackjackGame(
  db: D1Database,
  userId: number,
  playerCards: string[],
  dealerCards: string[],
  deck: string[],
  status: string
): Promise<void> {
  await db
    .prepare("UPDATE blackjack_games SET player_cards = ?, dealer_cards = ?, deck = ?, status = ? WHERE user_id = ?")
    .bind(playerCards.join(","), dealerCards.join(","), deck.join(","), status, userId)
    .run();
}

export async function clearBlackjackGame(db: D1Database, userId: number): Promise<void> {
  await db.prepare("DELETE FROM blackjack_games WHERE user_id = ?").bind(userId).run();
}

// ---------- word chain ----------

export interface WordChain {
  id: number;
  last_word: string;
  turn: number;
  streak: number;
  active: number;
}

export async function getWordChain(db: D1Database): Promise<WordChain | null> {
  const row = await db.prepare("SELECT * FROM word_chain WHERE id = 1").first<WordChain>();
  return row ?? null;
}

export async function startWordChain(db: D1Database, firstWord: string, nextTurn: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO word_chain (id, last_word, turn, streak, active) VALUES (1, ?, ?, 1, 1) " +
        "ON CONFLICT(id) DO UPDATE SET last_word = excluded.last_word, turn = excluded.turn, streak = 1, active = 1"
    )
    .bind(firstWord, nextTurn)
    .run();
}

export async function advanceWordChain(db: D1Database, word: string, nextTurn: number): Promise<void> {
  await db
    .prepare("UPDATE word_chain SET last_word = ?, turn = ?, streak = streak + 1 WHERE id = 1")
    .bind(word, nextTurn)
    .run();
}

export async function endWordChain(db: D1Database): Promise<void> {
  await db.prepare("UPDATE word_chain SET active = 0 WHERE id = 1").run();
}

// ---------- hangman ----------

export interface HangmanGame {
  id: number;
  word: string;
  category: string;
  guessed_letters: string;
  wrong_count: number;
  status: string;
  created_at: string;
}

export async function getHangmanGame(db: D1Database): Promise<HangmanGame | null> {
  const row = await db.prepare("SELECT * FROM hangman_games WHERE id = 1").first<HangmanGame>();
  return row ?? null;
}

export async function startHangmanGame(db: D1Database, word: string, category: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO hangman_games (id, word, category, guessed_letters, wrong_count, status, created_at) " +
        "VALUES (1, ?, ?, '', 0, 'active', ?) " +
        "ON CONFLICT(id) DO UPDATE SET word=excluded.word, category=excluded.category, guessed_letters='', " +
        "wrong_count=0, status='active', created_at=excluded.created_at"
    )
    .bind(word, category, new Date().toISOString())
    .run();
}

export async function updateHangmanGame(
  db: D1Database,
  guessedLetters: string,
  wrongCount: number,
  status: string
): Promise<void> {
  await db
    .prepare("UPDATE hangman_games SET guessed_letters = ?, wrong_count = ?, status = ? WHERE id = 1")
    .bind(guessedLetters, wrongCount, status)
    .run();
}

// ---------- daily couple challenge ----------

export interface DailyChallengeStreak {
  id: number;
  current_streak: number;
  last_completed_date: string | null;
}

export interface DailyChallengeEntry {
  challenge_date: string;
  challenge_text: string;
  completed: number;
}

export async function logDailyChallenge(db: D1Database, date: string, text: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO daily_challenge_log (challenge_date, challenge_text, completed) VALUES (?, ?, 0) " +
        "ON CONFLICT(challenge_date) DO NOTHING"
    )
    .bind(date, text)
    .run();
}

export async function getDailyChallenge(db: D1Database, date: string): Promise<DailyChallengeEntry | null> {
  const row = await db
    .prepare("SELECT * FROM daily_challenge_log WHERE challenge_date = ?")
    .bind(date)
    .first<DailyChallengeEntry>();
  return row ?? null;
}

export async function markDailyChallengeCompleted(db: D1Database, date: string): Promise<boolean> {
  const existing = await getDailyChallenge(db, date);
  if (!existing || existing.completed) return false;
  await db.prepare("UPDATE daily_challenge_log SET completed = 1 WHERE challenge_date = ?").bind(date).run();
  return true;
}

export async function getDailyChallengeStreak(db: D1Database): Promise<DailyChallengeStreak> {
  const row = await db.prepare("SELECT * FROM daily_challenge_streak WHERE id = 1").first<DailyChallengeStreak>();
  return row ?? { id: 1, current_streak: 0, last_completed_date: null };
}

export async function bumpDailyChallengeStreak(db: D1Database, date: string): Promise<number> {
  const current = await getDailyChallengeStreak(db);
  const yesterday = toISODate(new Date(parseISODate(date).getTime() - 86_400_000));
  const newStreak = current.last_completed_date === yesterday ? current.current_streak + 1 : 1;
  await db
    .prepare(
      "INSERT INTO daily_challenge_streak (id, current_streak, last_completed_date) VALUES (1, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET current_streak = excluded.current_streak, " +
        "last_completed_date = excluded.last_completed_date"
    )
    .bind(newStreak, date)
    .run();
  return newStreak;
}

export async function listDailyChallengeHistory(db: D1Database, limit = 10): Promise<DailyChallengeEntry[]> {
  const res = await db
    .prepare("SELECT * FROM daily_challenge_log ORDER BY challenge_date DESC LIMIT ?")
    .bind(limit)
    .all<DailyChallengeEntry>();
  return res.results ?? [];
}

// ---------- single-active-game lock ----------

export async function getActiveGame(db: D1Database): Promise<string | null> {
  const row = await db.prepare("SELECT game_type FROM active_game WHERE id = 1").first<{ game_type: string | null }>();
  return row?.game_type ?? null;
}

export async function setActiveGame(db: D1Database, gameType: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO active_game (id, game_type, started_at) VALUES (1, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET game_type = excluded.game_type, started_at = excluded.started_at"
    )
    .bind(gameType, new Date().toISOString())
    .run();
}

export async function clearActiveGame(db: D1Database): Promise<void> {
  await db.prepare("UPDATE active_game SET game_type = NULL, started_at = NULL WHERE id = 1").run();
}

// ---------- turn-based truth or dare ----------

export interface TdSession {
  id: number;
  spice: string;
  turn: number;
  status: string;
  created_at: string;
}

export async function getTdSession(db: D1Database): Promise<TdSession | null> {
  const row = await db.prepare("SELECT * FROM td_session WHERE id = 1").first<TdSession>();
  return row ?? null;
}

export async function startTdSession(db: D1Database, spice: string, turn: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO td_session (id, spice, turn, status, created_at) VALUES (1, ?, ?, 'active', ?) " +
        "ON CONFLICT(id) DO UPDATE SET spice = excluded.spice, turn = excluded.turn, status = 'active', " +
        "created_at = excluded.created_at"
    )
    .bind(spice, turn, new Date().toISOString())
    .run();
}

export async function setTdTurn(db: D1Database, turn: number): Promise<void> {
  await db.prepare("UPDATE td_session SET turn = ? WHERE id = 1").bind(turn).run();
}

export async function endTdSession(db: D1Database): Promise<void> {
  await db.prepare("UPDATE td_session SET status = 'ended' WHERE id = 1").run();
}

// ---------- custom (user-submitted) truth-or-dare prompts ----------

export interface CustomTdPrompt {
  id: number;
  type: string;
  spice: string;
  text: string;
  added_by: number;
  created_at: string;
}

export async function addCustomTdPrompt(
  db: D1Database,
  type: "truth" | "dare",
  spice: "normal" | "spicy",
  text: string,
  addedBy: number
): Promise<number> {
  const res = await db
    .prepare("INSERT INTO custom_td_prompts (type, spice, text, added_by, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(type, spice, text, addedBy, new Date().toISOString())
    .run();
  return res.meta.last_row_id as number;
}

export async function listCustomTdPromptTexts(
  db: D1Database,
  type: "truth" | "dare",
  spice: "normal" | "spicy"
): Promise<string[]> {
  const res = await db
    .prepare("SELECT text FROM custom_td_prompts WHERE type = ? AND spice = ?")
    .bind(type, spice)
    .all<{ text: string }>();
  return (res.results ?? []).map((r) => r.text);
}

export async function listAllCustomTdPrompts(db: D1Database): Promise<CustomTdPrompt[]> {
  const res = await db
    .prepare("SELECT * FROM custom_td_prompts ORDER BY created_at DESC")
    .all<CustomTdPrompt>();
  return res.results ?? [];
}

export async function deleteCustomTdPrompt(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM custom_td_prompts WHERE id = ?").bind(id).run();
}
