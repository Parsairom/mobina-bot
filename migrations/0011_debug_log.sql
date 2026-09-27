-- Persistent error log for the global bot.catch handler and the top-level
-- fetch() try/catch in index.ts, so production failures are queryable later
-- (Workers console logs aren't). Only actual errors are logged here, never
-- the raw body of every request — that would capture private message content.
CREATE TABLE IF NOT EXISTS debug_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    info TEXT,
    created_at TEXT
);
