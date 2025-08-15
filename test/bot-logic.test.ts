import { describe, expect, it } from "vitest";

import { parseAmount, rpsWinner } from "../src/bot";

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
