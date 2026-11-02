/**
 * Risk-signal detectors. These produce SIGNALS for a human reviewer — never a verdict.
 * Nothing in this module may label a listing or person "fraudulent"; the strongest
 * automated outcome is: hidden, pending human review.
 */
import type { FraudSignal, Listing } from "../schema";
import { fairHousingIssues } from "./fairhousing";
import { categorize } from "../categories";

export interface PropertyManagerRecord {
  id: string;
  name: string;
  aliases: string[];
  officialDomains: string[];
  officialPhones: string[]; // E.164
}

export interface DetectionContext {
  others: Listing[];
  managers: PropertyManagerRecord[];
  now: Date;
}

const UPFRONT_PATTERNS: RegExp[] = [
  /\b(deposit|payment|pay|fee|money)\b[^.]{0,60}\b(before|prior to)\b[^.]{0,30}\b(tour|viewing|showing|see(ing)?|visit|keys?)\b/i,
  /\b(hold|reserve|secure)\b[^.]{0,30}\b(the )?(unit|room|apartment|place)\b[^.]{0,40}\b(send|pay|deposit)\b/i,
  /\b(send|pay)\b[^.]{0,40}\b(and|then)\b[^.]{0,20}\b(i|we)('ll| will)\b[^.]{0,20}\b(mail|ship|send)\b[^.]{0,20}\bkeys?\b/i,
  /\bout of (the )?(country|town|state)\b[^.]{0,80}\b(keys?|mail|ship)\b/i,
];

const OFF_PLATFORM_PATTERNS: Array<[RegExp, string]> = [
  [/\bwire (transfer|the money|funds)\b|\bwestern union\b|\bmoneygram\b/i, "wire transfer"],
  [/\b(bitcoin|btc|crypto(currency)?|usdt|ethereum|eth wallet)\b/i, "cryptocurrency"],
  [/\b(gift ?cards?|itunes card|google play card|steam card|amazon card)\b/i, "gift cards"],
  [/\b(paypal\.me|venmo\.com\/|cash\.app\/|\$[a-z][a-z0-9_]{2,}\b)/i, "a payment link"],
];

const FREE_MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "proton.me", "protonmail.com"];

function signal(code: FraudSignal["code"], severity: FraudSignal["severity"], message: string, evidence: Record<string, unknown>, now: Date): FraudSignal {
  return { code, severity, message, evidence, detectedAt: now.toISOString() };
}

export function detectUpfrontPayment(text: string, now: Date): FraudSignal[] {
  const hit = UPFRONT_PATTERNS.find((p) => p.test(text));
  return hit
    ? [signal("UPFRONT_PAYMENT_BEFORE_TOUR", "hold", "Asks for money before a tour or before keys are handed over", { pattern: hit.source }, now)]
    : [];
}

export function detectOffPlatformPayment(text: string, now: Date): FraudSignal[] {
  return OFF_PLATFORM_PATTERNS.filter(([p]) => p.test(text)).map(([, label]) =>
    signal("OFF_PLATFORM_PAYMENT", "hold", `Mentions payment by ${label}`, { method: label }, now),
  );
}

// ---- duplicate images (perceptual hash, 64-bit hex) ----
export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

function sameProperty(a: Listing, b: Listing): boolean {
  return a.address.line1.toLowerCase() === b.address.line1.toLowerCase() && a.address.city.toLowerCase() === b.address.city.toLowerCase();
}

function sameContact(a: Listing, b: Listing): boolean {
  return !!a.contact && !!b.contact && a.contact.value.toLowerCase() === b.contact.value.toLowerCase();
}

export function detectDuplicateImages(l: Listing, others: Listing[], now: Date, maxDistance = 5): FraudSignal[] {
  const out: FraudSignal[] = [];
  for (const o of others) {
    if (o.id === l.id || sameProperty(l, o)) continue;
    for (const h of l.imageHashes) {
      const match = o.imageHashes.find((oh) => hammingHex(h, oh) <= maxDistance);
      if (match) {
        out.push(signal("DUPLICATE_IMAGE", "review", "A photo also appears on a listing at a different address", { otherListingId: o.id, hash: h }, now));
        break;
      }
    }
  }
  return out;
}

// ---- copied descriptions (word 5-shingle Jaccard) ----
function shingles(text: string, k = 5): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + k <= words.length; i += 1) s.add(words.slice(i, i + k).join(" "));
  return s;
}

export function jaccard(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function detectCopiedDescription(l: Listing, others: Listing[], now: Date, threshold = 0.7): FraudSignal[] {
  if (!l.description || l.description.split(/\s+/).length < 25) return [];
  const out: FraudSignal[] = [];
  for (const o of others) {
    if (o.id === l.id || !o.description || sameProperty(l, o) || sameContact(l, o)) continue;
    const score = jaccard(l.description, o.description);
    if (score >= threshold) {
      out.push(signal("COPIED_DESCRIPTION", "review", "Description closely matches a listing at a different address with a different contact", { otherListingId: o.id, similarity: Number(score.toFixed(2)) }, now));
    }
  }
  return out;
}

// ---- price anomaly ----
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function detectPriceAnomaly(l: Listing, others: Listing[], now: Date, ratio = 0.5, minComparables = 5): FraudSignal[] {
  const cat = categorize(l);
  const comps = others.filter(
    (o) => o.id !== l.id && !o.isDemo && o.pricing.basis === l.pricing.basis && categorize(o) === cat && o.address.city === l.address.city && o.verification.level !== "FLAGGED",
  );
  if (comps.length < minComparables) return [];
  const med = median(comps.map((o) => o.pricing.baseRentCents));
  if (l.pricing.baseRentCents < med * ratio) {
    return [signal("PRICE_ANOMALY", "review", "Rent is far below similar listings nearby", { medianCents: med, comparables: comps.length }, now)];
  }
  return [];
}

// ---- impersonation ----
function digits(s: string): string {
  return s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

export function detectImpersonation(l: Listing, managers: PropertyManagerRecord[], now: Date): FraudSignal[] {
  if (!l.contact) return [];
  const haystack = `${l.title} ${l.propertyName ?? ""} ${l.description ?? ""}`.toLowerCase();
  const claimed = managers.find((m) => [m.name, ...m.aliases].some((n) => haystack.includes(n.toLowerCase())));
  if (!claimed) return [];
  const { channel, value } = l.contact;
  if (channel === "email") {
    const domain = value.split("@")[1]?.toLowerCase() ?? "";
    if (!claimed.officialDomains.includes(domain)) {
      const severity = FREE_MAIL.includes(domain) ? "hold" : "review";
      return [signal("IMPERSONATION", severity, `Claims to be ${claimed.name} but the email domain is not one of theirs`, { managerId: claimed.id, domain }, now)];
    }
  }
  if (channel === "phone" && !claimed.officialPhones.map(digits).includes(digits(value))) {
    return [signal("IMPERSONATION", "review", `Claims to be ${claimed.name} but uses a phone number not on file for them`, { managerId: claimed.id }, now)];
  }
  return [];
}

/** Description names a street address whose number differs from the listing's own address. */
export function detectAddressMismatch(l: Listing, now: Date): FraudSignal[] {
  if (!l.description) return [];
  const own = l.address.line1.match(/^(\d+)/)?.[1];
  const m = l.description.match(/\b(\d{2,6})\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Pl|Place|Ct|Court)\b/);
  if (!own || !m || m[1] === own) return [];
  return [signal("ADDRESS_MISMATCH", "review", "The description names a different street address than the listing", { described: m[0] }, now)];
}

export function detectAll(l: Listing, ctx: DetectionContext): FraudSignal[] {
  const text = `${l.title}\n${l.description ?? ""}`;
  return [
    ...fairHousingIssues(text, ctx.now),
    ...detectAddressMismatch(l, ctx.now),
    ...detectUpfrontPayment(text, ctx.now),
    ...detectOffPlatformPayment(text, ctx.now),
    ...detectDuplicateImages(l, ctx.others, ctx.now),
    ...detectCopiedDescription(l, ctx.others, ctx.now),
    ...detectPriceAnomaly(l, ctx.others, ctx.now),
    ...detectImpersonation(l, ctx.managers, ctx.now),
  ];
}

export type RiskRecommendation = "publish" | "publish_with_caution" | "hold_for_human_review";

/** Never returns "fraud". The strongest outcome is a hold for a human reviewer. */
export function recommend(signals: FraudSignal[]): RiskRecommendation {
  if (signals.some((s) => s.severity === "hold" || s.severity === "review")) return "hold_for_human_review";
  if (signals.length) return "publish_with_caution";
  return "publish";
}

/** Screens a message a user is about to send or has received (contact flow). */
export function screenMessage(text: string, now: Date): { blocked: boolean; signals: FraudSignal[] } {
  const signals = [...detectUpfrontPayment(text, now), ...detectOffPlatformPayment(text, now)];
  return { blocked: signals.some((s) => s.severity === "hold"), signals };
}
