// ---------- tic-tac-toe ----------

const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function checkTicTacToeWinner(board: string): "X" | "O" | "draw" | null {
  for (const [a, b, c] of TTT_LINES) {
    if (board[a] !== "_" && board[a] === board[b] && board[b] === board[c]) {
      return board[a] as "X" | "O";
    }
  }
  return board.includes("_") ? null : "draw";
}

// ---------- connect four (7 cols x 6 rows, row-major, '_' empty) ----------

export const C4_COLS = 7;
export const C4_ROWS = 6;

export function dropConnectFour(board: string, col: number, token: string): { board: string; row: number } | null {
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    const idx = row * C4_COLS + col;
    if (board[idx] === "_") {
      return { board: board.slice(0, idx) + token + board.slice(idx + 1), row };
    }
  }
  return null;
}

export function checkConnectFourWinner(board: string): "R" | "Y" | null {
  const at = (r: number, c: number) => (r < 0 || r >= C4_ROWS || c < 0 || c >= C4_COLS ? null : board[r * C4_COLS + c]);
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const token = at(r, c);
      if (token === "_" || token === null) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let k = 1; k < 4; k++) {
          if (at(r + dr * k, c + dc * k) === token) count++;
          else break;
        }
        if (count === 4) return token as "R" | "Y";
      }
    }
  }
  return null;
}

export function isConnectFourFull(board: string): boolean {
  return !board.includes("_");
}

// ---------- battleship (6x6, 36 cells, '.' empty, 'S' ship) ----------

export const BATTLESHIP_SIZE = 6;
const SHIP_LENGTHS = [2, 2, 2];

export function placeShipsRandomly(): string {
  const cells = new Array(BATTLESHIP_SIZE * BATTLESHIP_SIZE).fill(".");

  for (const length of SHIP_LENGTHS) {
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * BATTLESHIP_SIZE);
      const col = Math.floor(Math.random() * BATTLESHIP_SIZE);
      const indices: number[] = [];

      for (let i = 0; i < length; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        if (r >= BATTLESHIP_SIZE || c >= BATTLESHIP_SIZE) {
          indices.length = 0;
          break;
        }
        indices.push(r * BATTLESHIP_SIZE + c);
      }

      if (indices.length === length && indices.every((idx) => cells[idx] === ".")) {
        for (const idx of indices) cells[idx] = "S";
        placed = true;
      }
    }
  }

  return cells.join("");
}

export type FireResult = "hit" | "miss" | "already";

export function fireAt(board: string, hits: string, index: number): { result: FireResult; hits: string } {
  if (hits[index] !== ".") return { result: "already", hits };
  const isHit = board[index] === "S";
  const newHits = hits.slice(0, index) + (isHit ? "H" : "M") + hits.slice(index + 1);
  return { result: isHit ? "hit" : "miss", hits: newHits };
}

export function isFleetSunk(board: string, hits: string): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === "S" && hits[i] !== "H") return false;
  }
  return true;
}

// ---------- blackjack ----------

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function newShuffledDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(rank + suit);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardRank(card: string): string {
  return card.slice(0, -1);
}

export function handValue(cards: string[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const rank = cardRank(card);
    if (rank === "A") {
      aces++;
      total += 11;
    } else if (rank === "J" || rank === "Q" || rank === "K") {
      total += 10;
    } else {
      total += Number(rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function formatHand(cards: string[]): string {
  return cards.join(" ");
}
