import { describe, expect, it } from "vitest";

import {
  computeActivityStreak,
  meaningfulWordChainText,
  parseAmount,
  rpsWinner,
  wordChainLastLetter,
} from "../src/bot";

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe("rpsWinner", () => {
  it("declares a tie when both pick the same move", () => {
    expect(rpsWinner("rock", "rock")).toBe("tie");
  });

  it("rock beats scissors", () => {
    expect(rpsWinner("rock", "scissors")).toBe("a");
    expect(rpsWinner("scissors", "rock")).toBe("b");
  });

  it("scissors beats paper", () => {
    expect(rpsWinner("scissors", "paper")).toBe("a");
    expect(rpsWinner("paper", "scissors")).toBe("b");
  });

  it("paper beats rock", () => {
    expect(rpsWinner("paper", "rock")).toBe("a");
    expect(rpsWinner("rock", "paper")).toBe("b");
  });
});

describe("parseAmount", () => {
  it("parses a plain integer", () => {
    expect(parseAmount("200000")).toBe(200000);
  });

  it("strips thousands separators", () => {
    expect(parseAmount("200,000")).toBe(200000);
  });

  it("converts Persian digits", () => {
    expect(parseAmount("۲۰۰۰۰۰")).toBe(200000);
  });

  it("rejects zero and negative amounts", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-500")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseAmount("not a number")).toBeNull();
  });
});

describe("computeActivityStreak", () => {
  it("is 0 when there's no activity at all", () => {
    expect(computeActivityStreak([], utc(2026, 9, 27))).toBe(0);
  });

  it("counts today if both were active today", () => {
    const dates = ["2026-09-27", "2026-09-26", "2026-09-25"];
    expect(computeActivityStreak(dates, utc(2026, 9, 27))).toBe(3);
  });

  it("still counts the streak from yesterday if today hasn't happened yet", () => {
    const dates = ["2026-09-26", "2026-09-25"];
    expect(computeActivityStreak(dates, utc(2026, 9, 27))).toBe(2);
  });

  it("stops at the first gap", () => {
    const dates = ["2026-09-27", "2026-09-26", "2026-09-24"];
    expect(computeActivityStreak(dates, utc(2026, 9, 27))).toBe(2);
  });

  it("is 0 if neither today nor yesterday had joint activity", () => {
    const dates = ["2026-09-20"];
    expect(computeActivityStreak(dates, utc(2026, 9, 27))).toBe(0);
  });
});

describe("word-chain emoji regression (previously hijacked every message)", () => {
  it("strips a trailing emoji so the real last letter is used", () => {
    expect(meaningfulWordChainText("کون😂")).toBe("کون");
    expect(wordChainLastLetter("کون😂")).toBe("ن");
  });

  it("strips leading/trailing punctuation and whitespace", () => {
    expect(meaningfulWordChainText("  «سلام»! ")).toBe("سلام");
  });

  it("returns an empty string for an all-emoji/punctuation word", () => {
    expect(meaningfulWordChainText("😂🎉")).toBe("");
    expect(wordChainLastLetter("😂🎉")).toBe("");
  });

  it("leaves an ordinary word untouched", () => {
    expect(meaningfulWordChainText("سلام")).toBe("سلام");
    expect(wordChainLastLetter("سلام")).toBe("م");
  });
});
