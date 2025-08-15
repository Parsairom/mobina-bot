-- Throttles "haven't been to X in a while" reminders so a given location
-- only triggers once per cooldown window, not every morning.
CREATE TABLE IF NOT EXISTS location_visit_reminders (
    location TEXT PRIMARY KEY,
    last_reminded_date TEXT NOT NULL
);

-- Shared journal of small preferences/things one partner mentioned
-- ("she likes coffee without sugar"), used as context for AI gift ideas.
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL
);
