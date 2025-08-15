-- Daily mood tracker: one mood per user per day (upserted).
CREATE TABLE IF NOT EXISTS moods (
    user_id INTEGER NOT NULL,
    mood_date TEXT NOT NULL,
    mood TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, mood_date)
);

-- Hidden love messages: delivered automatically on deliver_date, or
-- available to open anytime in the recipient's inbox when deliver_date is NULL.
CREATE TABLE IF NOT EXISTS secret_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    hint TEXT,
    content TEXT NOT NULL,
    deliver_date TEXT,
    delivered INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Tracks which couple's-question / weekly-challenge prompts have already
-- been used, so the same one doesn't repeat until the whole list cycles.
CREATE TABLE IF NOT EXISTS used_prompts (
    kind TEXT NOT NULL,
    item TEXT NOT NULL,
    used_at TEXT NOT NULL
);
