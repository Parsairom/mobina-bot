-- User-submitted truth/dare prompts, mixed into the built-in pool during play.
CREATE TABLE IF NOT EXISTS custom_td_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    spice TEXT NOT NULL,
    text TEXT NOT NULL,
    added_by INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
