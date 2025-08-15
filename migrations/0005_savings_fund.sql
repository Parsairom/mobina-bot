-- Shared savings fund: each partner logs contributions (or withdrawals, via
-- a negative amount) toward an optional shared goal.
CREATE TABLE IF NOT EXISTS savings_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_goal (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    goal_name TEXT,
    goal_amount INTEGER
);
