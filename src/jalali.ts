// Dates are stored internally as Gregorian ISO ("YYYY-MM-DD") so the existing
// date arithmetic in dates.ts keeps working unchanged. This module only
// handles the display/input boundary: showing dates in Shamsi (Jalali) and
// parsing Shamsi (or legacy Gregorian) text the user types back to Gregorian.
//
// Conversion relies on workerd's built-in Intl Persian-calendar support
// (verified against known reference dates, including a leap day) rather than
// a hand-rolled leap-year algorithm.

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
// Arabic-Indic digits (U+0660-0669) are a different Unicode range from the
// Persian ones above (U+06F0-06F9) — some phone keyboards produce these
// instead, depending on whether the device's keyboard is set to Arabic or Farsi.
const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toPersianDigits(input: number | string): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const p = PERSIAN_DIGITS.indexOf(d);
    if (p !== -1) return String(p);
    return String(ARABIC_INDIC_DIGITS.indexOf(d));
  });
}

// Mobile keyboards often insert invisible bidi-control characters (LRM U+200E,
// RLM U+200F, ALM U+061C) or zero-width joiners around numbers/separators
// when typing in an RTL context. They're invisible but break regex matching,
// so strip them before parsing.
function stripInvisibleMarks(input: string): string {
  return input.replace(/[​‌‍‎‏؜]/g, "");
}

interface JalaliParts {
  jy: number;
  jm: number;
  jd: number;
}

function persianPartsOf(date: Date): JalaliParts {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

export function gregorianToJalali(isoDate: string): JalaliParts {
  const [y, m, d] = isoDate.split("-").map(Number);
  return persianPartsOf(new Date(Date.UTC(y, m - 1, d)));
}

/** e.g. "۲۰ مرداد ۱۴۰۳" */
export function formatJalali(isoDate: string): string {
  const { jy, jm, jd } = gregorianToJalali(isoDate);
  return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

/** e.g. "۱۴۰۳-۰۵-۲۰", useful when echoing back what was just parsed */
export function formatJalaliNumeric(isoDate: string): string {
  const { jy, jm, jd } = gregorianToJalali(isoDate);
  return toPersianDigits(`${jy}-${String(jm).padStart(2, "0")}-${String(jd).padStart(2, "0")}`);
}

function jalaliToGregorian(jy: number, jm: number, jd: number): string | null {
  const approxGy = jy + 621;
  const guess = new Date(Date.UTC(approxGy, 2, 21) + ((jm - 1) * 30 + (jd - 1)) * 86_400_000);

  // The estimate above can drift a few days depending on leap years; a small
  // local search against the real Intl conversion finds the exact match.
  for (let offset = -10; offset <= 10; offset++) {
    const candidate = new Date(guess.getTime() + offset * 86_400_000);
    const parts = persianPartsOf(candidate);
    if (parts.jy === jy && parts.jm === jm && parts.jd === jd) {
      return candidate.toISOString().slice(0, 10);
    }
  }
  return null;
}

// Accepts any of: "-", "/", ".", or plain whitespace as the separator between
// the three date parts, in either order (year first, or year last).
const DATE_PARTS_RE = /^(\d{1,4})[-./\s]+(\d{1,4})[-./\s]+(\d{1,4})$/;

/**
 * Parses a date typed by the user — deliberately lenient, since people type
 * dates in whatever order/format/keyboard they're used to. Accepts:
 *  - Shamsi or Gregorian year
 *  - year-first (YYYY-MM-DD) or year-last (DD-MM-YYYY) order
 *  - "-", "/", ".", or spaces as separators
 *  - Persian, Arabic-Indic, or plain digits
 * Returns Gregorian ISO for storage, or null if no valid date can be found.
 */
export function parseDateInput(text: string): string | null {
  const cleaned = stripInvisibleMarks(toLatinDigits(text)).trim();
  const match = DATE_PARTS_RE.exec(cleaned);
  if (!match) return null;

  const a = Number(match[1]);
  const b = Number(match[2]);
  const c = Number(match[3]);

  let year: number;
  let month: number;
  let day: number;

  if (a > 99) {
    // YYYY-MM-DD
    year = a;
    month = b;
    day = c;
  } else if (c > 99) {
    // DD-MM-YYYY, the common informal Persian/European writing order
    year = c;
    day = a;
    month = b;
  } else {
    // No group looks like a year (need at least 3 digits somewhere).
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Jalali years for this app realistically run ~1300-1500; Gregorian years
  // for the same real-world range are ~1900-2100. 1600 cleanly separates them.
  if (year >= 1600) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }

  return jalaliToGregorian(year, month, day);
}
