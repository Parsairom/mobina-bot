-- Allow text-only memories (no photo) for the manual "add memory" wizard.
CREATE TABLE memories_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT,
    caption TEXT,
    location TEXT,
    memory_date TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

INSERT INTO memories_new (id, file_id, caption, location, memory_date, created_by, created_at)
SELECT id, file_id, caption, location, memory_date, created_by, created_at FROM memories;

DROP TABLE memories;
ALTER TABLE memories_new RENAME TO memories;

-- Replace the narrow location/date-only pending state with a generic
-- multi-step wizard state (flow + step + a JSON data blob), needed for the
-- menu-driven add/edit flows.
DROP TABLE IF EXISTS pending_actions;
CREATE TABLE pending_actions (
    user_id INTEGER PRIMARY KEY,
    flow TEXT NOT NULL,
    step TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
