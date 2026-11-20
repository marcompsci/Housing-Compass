/**
 * Fair Housing language screen for listing text and manager submissions. It flags phrases
 * that commonly signal unlawful preferences (federal Fair Housing Act; California FEHA,
 * including source-of-income protection for voucher holders since SB 329). Output is a
 * REVIEW signal for a moderator. It is not a legal finding, and counsel should review the
 * pattern list before launch.
 *
 * Note: shared-living ads (renting a room in your own home) and lawful senior housing can
 * state some preferences that would be unlawful elsewhere, which is why this flags for a
 * person to look at rather than auto-removing.
 */
import type { FraudSignal } from "../schema";

const PATTERNS: Array<{ re: RegExp; topic: string }> = [
  { re: /\bno\s+(section\s*8|sec\.?\s*8|vouchers?|hcv|housing\s+vouchers?|public\s+assistance|hud|government\s+assistance)\b/i, topic: "refusing housing vouchers / source of income" },
  { re: /\b(section\s*8|vouchers?)\s+(not\s+accepted|not\s+allowed|need\s+not\s+apply)\b/i, topic: "refusing housing vouchers / source of income" },
  { re: /\bno\s+(kids|children|families|babies|minors)\b|\badults\s+only\b/i, topic: "familial status" },
  { re: /\b(christians?|muslims?|jews|jewish|catholics?|hindus?|buddhists?)\s+only\b/i, topic: "religion" },
  { re: /\b(citizens?|americans?)\s+only\b|\bno\s+(immigrants|foreigners)\b|\bmust\s+(be\s+a\s+citizen|have\s+(a\s+)?green\s+card)\b/i, topic: "national origin / immigration status" },
  { re: /\bno\s+(wheelchairs?|disabled|handicapped)\b|\bmust\s+be\s+able[-\s]bodied\b/i, topic: "disability" },
  { re: /\b(english\s+speakers?\s+only|must\s+speak\s+english)\b/i, topic: "national origin" },
  { re: /\b(whites?|blacks?|asians?|hispanics?|latinos?)\s+only\b/i, topic: "race / ethnicity" },
];

export function fairHousingIssues(text: string, now: Date): FraudSignal[] {
  const out: FraudSignal[] = [];
  const seen = new Set<string>();
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (m && !seen.has(p.topic)) {
      seen.add(p.topic);
      out.push({
        code: "DISCRIMINATORY_LANGUAGE",
        severity: "review",
        message: `Wording may express an unlawful preference (${p.topic}). A moderator should review it before publishing.`,
        evidence: { phrase: m[0], topic: p.topic },
        detectedAt: now.toISOString(),
      });
    }
  }
  return out;
}

/** Search must never filter people by protected characteristics. Used by tests and the API guard. */
export const PROTECTED_FILTER_WORDS = /race|color|religion|sex|gender|familial|children|kids|national|origin|ancestry|citizenship|immigration|disabilit|age\b|marital|orientation|veteran|military|income_source|source_of_income/i;
