import { describe, expect, it } from "vitest";

import { daysUntil, nextOccurrence, parseISODate, yearsSince } from "../src/dates";

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe("parseISODate", () => {
  it("parses a YYYY-MM-DD string as a UTC date", () => {
    const d = parseISODate("2024-08-10");
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(7); // 0-indexed
    expect(d.getUTCDate()).toBe(10);
  });
});

describe("nextOccurrence", () => {
  it("returns the exact date unchanged for a non-recurring event", () => {
    const result = nextOccurrence("2020-03-14", false, utc(2024, 1, 1));
    expect(result.getTime()).toBe(utc(2020, 3, 14).getTime());
  });

  it("returns this year's date if it hasn't happened yet", () => {
    const result = nextOccurrence("2020-08-10", true, utc(2024, 1, 1));
    expect(result.getTime()).toBe(utc(2024, 8, 10).getTime());
  });

  it("rolls over to next year once this year's date has passed", () => {
    const result = nextOccurrence("2020-01-01", true, utc(2024, 6, 15));
    expect(result.getTime()).toBe(utc(2025, 1, 1).getTime());
  });

  it("treats the event date itself as the current occurrence, not passed", () => {
    const result = nextOccurrence("2020-08-10", true, utc(2024, 8, 10));
    expect(result.getTime()).toBe(utc(2024, 8, 10).getTime());
  });
});

describe("daysUntil", () => {
  it("is 0 on the day of a recurring anniversary", () => {
    expect(daysUntil("2020-08-10", true, utc(2024, 8, 10))).toBe(0);
  });

  it("counts down correctly for an upcoming recurring anniversary", () => {
    expect(daysUntil("2020-08-10", true, utc(2024, 8, 3))).toBe(7);
  });

  it("wraps around the new year correctly", () => {
    // 2 days before Jan 1 -> the next Jan 1 is 2 days away.
    expect(daysUntil("2020-01-01", true, utc(2023, 12, 30))).toBe(2);
  });
});

describe("yearsSince", () => {
  it("counts a full year as 1", () => {
    expect(yearsSince("2020-08-10", utc(2021, 8, 10))).toBe(1);
  });

  it("doesn't count the year until the anniversary date has passed", () => {
    expect(yearsSince("2020-08-10", utc(2021, 8, 9))).toBe(0);
  });

  it("counts the year on the anniversary date itself", () => {
    expect(yearsSince("2020-08-10", utc(2021, 8, 10))).toBe(1);
  });
});
