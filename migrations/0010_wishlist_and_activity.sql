-- Shared wishlist / bucket list of things to do together.
CREATE TABLE IF NOT EXISTS wishlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    done_at TEXT
);

-- One row per (user, day) they interacted with the bot at all — used to
-- compute the "both of you were active today" daily streak.
CREATE TABLE IF NOT EXISTS activity_log (
    user_id INTEGER NOT NULL,
    activity_date TEXT NOT NULL,
    PRIMARY KEY (user_id, activity_date)
);
