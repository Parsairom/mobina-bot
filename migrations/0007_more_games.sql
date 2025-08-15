-- Speed Tap / reaction game: a single active round at a time.
CREATE TABLE IF NOT EXISTS reaction_rounds (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT NOT NULL,
    go_at TEXT
);

-- Tic-tac-toe: a single active game at a time, plus a running scoreboard.
CREATE TABLE IF NOT EXISTS ttt_games (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    board TEXT NOT NULL,
    turn INTEGER NOT NULL,
    player_x INTEGER NOT NULL,
    player_o INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ttt_scores (
    user_id INTEGER PRIMARY KEY,
    wins INTEGER NOT NULL DEFAULT 0
);

-- Connect four: a single active game at a time.
CREATE TABLE IF NOT EXISTS c4_games (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    board TEXT NOT NULL,
    turn INTEGER NOT NULL,
    player_r INTEGER NOT NULL,
    player_y INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Battleship: 6x6 boards (36 cells), auto-placed ships. `hits_a` records
-- shots fired at player_a's board (by player_b), and vice versa.
CREATE TABLE IF NOT EXISTS battleship_games (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    player_a INTEGER NOT NULL,
    player_b INTEGER NOT NULL,
    board_a TEXT NOT NULL,
    board_b TEXT NOT NULL,
    hits_a TEXT NOT NULL,
    hits_b TEXT NOT NULL,
    turn INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Blackjack: solo hand vs the dealer, one active hand per user, plus a
-- running virtual points balance per user.
CREATE TABLE IF NOT EXISTS blackjack_points (
    user_id INTEGER PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 1000
);

CREATE TABLE IF NOT EXISTS blackjack_games (
    user_id INTEGER PRIMARY KEY,
    player_cards TEXT NOT NULL,
    dealer_cards TEXT NOT NULL,
    deck TEXT NOT NULL,
    bet INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Word chain: a single active chain at a time.
CREATE TABLE IF NOT EXISTS word_chain (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_word TEXT NOT NULL,
    turn INTEGER NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);

-- Hangman: a single active game at a time.
CREATE TABLE IF NOT EXISTS hangman_games (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    word TEXT NOT NULL,
    category TEXT NOT NULL,
    guessed_letters TEXT NOT NULL DEFAULT '',
    wrong_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Daily couple challenge: one row per calendar day it was posted, plus a
-- running streak counter.
CREATE TABLE IF NOT EXISTS daily_challenge_log (
    challenge_date TEXT PRIMARY KEY,
    challenge_text TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_challenge_streak (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_streak INTEGER NOT NULL DEFAULT 0,
    last_completed_date TEXT
);
