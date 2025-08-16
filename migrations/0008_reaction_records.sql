-- Personal best reaction times, so the speed-tap game has something to chase
-- beyond just winning a single round.
CREATE TABLE IF NOT EXISTS reaction_records (
    user_id INTEGER PRIMARY KEY,
    best_ms INTEGER NOT NULL
);
