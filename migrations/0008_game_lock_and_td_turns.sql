-- Only one shared 2-player game may be active at a time, across every game
-- type, so starting a new one while another is in progress is blocked.
CREATE TABLE IF NOT EXISTS active_game (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    game_type TEXT,
    started_at TEXT
);

-- Turn-based truth-or-dare session: alternates whose turn it is to pick
-- truth/dare (or write their own prompt) and answer.
CREATE TABLE IF NOT EXISTS td_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    spice TEXT NOT NULL,
    turn INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);
