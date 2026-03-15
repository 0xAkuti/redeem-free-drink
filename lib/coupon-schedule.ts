import { generateCouponCodes } from "./coupon-code";

export type SundayCoupon = {
  code: string;
  validOn: string;
};

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nextSundayOnOrAfter(date: Date) {
  const candidate = startOfUtcDay(date);
  const day = candidate.getUTCDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  candidate.setUTCDate(candidate.getUTCDate() + daysUntilSunday);
  return candidate;
}

export function getUtcDateString(date: Date = new Date()) {
  return formatUtcDate(date);
}

export function buildSundayCoupons(years: number, startDate: Date = new Date()) {
  if (!Number.isInteger(years) || years <= 0) {
    throw new Error("--years must be a positive integer");
  }

  const firstSunday = nextSundayOnOrAfter(startDate);
  const endDate = startOfUtcDay(startDate);
  endDate.setUTCFullYear(endDate.getUTCFullYear() + years);

  const dates: string[] = [];
  const cursor = new Date(firstSunday);
  while (cursor < endDate) {
    dates.push(formatUtcDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  const codes = generateCouponCodes(dates.length);
  return dates.map((validOn, index) => ({
    validOn,
    code: codes[index],
  })) satisfies SundayCoupon[];
}
