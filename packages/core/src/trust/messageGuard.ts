/**
 * In-app message guard. Mirrors the Postgres `message_guard()` trigger so the app can warn
 * BEFORE sending. The database remains the enforcement point; parity is tested.
 */
export interface GuardResult {
  body: string;
  masked: boolean;
  held: boolean;
  holdReasons: string[];
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const LINK = /(https?:\/\/|www\.)\S+/gi;

const HOLDS: Array<[RegExp, string]> = [
  [/\b(wire( transfer)?|western union|moneygram|gift ?cards?|bitcoin|crypto(currency)?|usdt)\b/i, "off-platform payment"],
  [/(paypal\.me|venmo\.com\/|cash\.app\/)/i, "payment link"],
  [/\b(deposit|payment|pay|fee)\b.{0,60}\b(before|prior to)\b.{0,30}\b(tour|viewing|showing|see|seeing|visit)/i, "payment before tour"],
  [/\b(ssn|social security( number)?|bank (login|password)|routing number)\b/i, "sensitive personal data request"],
];

export const CONTACT_HIDDEN = "[contact hidden until a tour is confirmed]";
export const LINK_HIDDEN = "[link hidden until a tour is confirmed]";

export function messageGuard(raw: string, opts: { tourConfirmed: boolean }): GuardResult {
  let body = raw;
  let masked = false;
  if (!opts.tourConfirmed && (EMAIL.test(body) || PHONE.test(body) || LINK.test(body))) {
    body = body.replace(EMAIL, CONTACT_HIDDEN).replace(PHONE, CONTACT_HIDDEN).replace(LINK, LINK_HIDDEN);
    masked = true;
  }
  EMAIL.lastIndex = PHONE.lastIndex = LINK.lastIndex = 0;
  const holdReasons = HOLDS.filter(([re]) => re.test(body)).map(([, r]) => r);
  return { body, masked, held: holdReasons.length > 0, holdReasons };
}
