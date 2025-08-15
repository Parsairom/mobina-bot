CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    caption TEXT,
    location TEXT,
    memory_date TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anniversaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    recurring INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_log (
    anniversary_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    days_before INTEGER NOT NULL,
    PRIMARY KEY (anniversary_id, year, days_before)
);

CREATE TABLE IF NOT EXISTS on_this_day_log (
    memory_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    PRIMARY KEY (memory_id, year)
);

-- Cloudflare Workers are stateless between requests, so the "waiting for a
-- location/date reply" state that the Python bot kept in memory has to be
-- persisted here instead.
CREATE TABLE IF NOT EXISTS pending_actions (
    user_id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    memory_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
