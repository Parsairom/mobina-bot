-- Rock-paper-scissors: each partner's pending move for the current round.
-- Cleared once both have moved and the round is resolved.
CREATE TABLE IF NOT EXISTS rps_moves (
    user_id INTEGER PRIMARY KEY,
    move TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Two truths and a lie: author writes 3 statements and marks which is the
-- lie, partner guesses one, then it's resolved.
CREATE TABLE IF NOT EXISTS ttal_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    statement1 TEXT NOT NULL,
    statement2 TEXT NOT NULL,
    statement3 TEXT NOT NULL,
    lie_index INTEGER NOT NULL,
    guessed_index INTEGER,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
