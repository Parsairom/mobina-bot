import { describe, expect, it } from "vitest";

import { formatJalali, gregorianToJalali, parseDateInput, toLatinDigits, toPersianDigits } from "../src/jalali";

describe("gregorianToJalali / formatJalali", () => {
  // Reference values cross-checked against known Nowruz dates and a leap day.
  const cases: Array<[string, number, number, number]> = [
    ["2024-08-10", 1403, 5, 20],
    ["2024-03-20", 1403, 1, 1], // Nowruz 1403
    ["2024-03-19", 1402, 12, 29], // day before Nowruz
    ["2024-02-29", 1402, 12, 10], // Gregorian leap day
    ["1979-02-11", 1357, 11, 22],
  ];

  it.each(cases)("converts %s to the correct Jalali date", (iso, jy, jm, jd) => {
    expect(gregorianToJalali(iso)).toEqual({ jy, jm, jd });
  });

  it("formats a Jalali date with Persian digits and month name", () => {
    expect(formatJalali("2024-08-10")).toBe("۲۰ مرداد ۱۴۰۳");
  });
});

describe("toPersianDigits / toLatinDigits", () => {
  it("converts Latin digits to Persian digits", () => {
    expect(toPersianDigits("1403")).toBe("۱۴۰۳");
  });

  it("converts Persian digits back to Latin", () => {
    expect(toLatinDigits("۱۴۰۳")).toBe("1403");
  });

  it("converts Arabic-Indic digits to Latin", () => {
    expect(toLatinDigits("١٤٠٣")).toBe("1403");
  });
});

describe("parseDateInput", () => {
  it("parses a plain Gregorian YYYY-MM-DD date", () => {
    expect(parseDateInput("2024-08-10")).toBe("2024-08-10");
  });

  it("parses a Shamsi date with Persian digits and dashes", () => {
    expect(parseDateInput("۱۴۰۳-۰۵-۲۰")).toBe("2024-08-10");
  });

  it("parses a Shamsi date with slashes", () => {
    expect(parseDateInput("1403/05/20")).toBe("2024-08-10");
  });

  it("parses day-month-year order when the year is clearly last", () => {
    expect(parseDateInput("20-05-1403")).toBe("2024-08-10");
  });

  it("round-trips a Gregorian date formatted as Jalali back to itself", () => {
    const jalaliText = "1403-05-20";
    const iso = parseDateInput(jalaliText);
    expect(iso).toBe("2024-08-10");
    expect(gregorianToJalali(iso as string)).toEqual({ jy: 1403, jm: 5, jd: 20 });
  });

  it("returns null for garbage input", () => {
    expect(parseDateInput("not a date")).toBeNull();
  });

  it("returns null for an out-of-range month", () => {
    expect(parseDateInput("2024-13-01")).toBeNull();
  });
});
