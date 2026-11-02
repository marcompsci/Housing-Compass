/**
 * California renter protections that matter when you're applying for a home, plus soft
 * checks of a listing's stated deposit and application fee against them.
 *
 * General information, not legal advice. Every rule carries its source and the date we
 * checked it. Checks never accuse: they say "may be above" and suggest what to ask, because
 * exceptions exist (e.g. small landlords may charge two months' deposit).
 */
import { formatUsd } from "./pricing";
import type { Listing } from "./schema";

export const RIGHTS_CHECKED_ON = "2026-11-02";

/** Statewide cap on screening fees per applicant (Civ. Code §1950.6(b), $30 in 1998 adjusted by CPI each December).
 *  2026 figure as reported by the California Apartment Association; some cities publish their own figure. */
export const CA_SCREENING_FEE_CAP_2026_CENTS = 6586;

export interface RightsTopic {
  id: string;
  title: string;
  summary: string;
  ask: string;
  source: { label: string; url: string };
}

const leginfo = (section: string) => `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=${section}`;

export const CA_RIGHTS: RightsTopic[] = [
  {
    id: "deposit",
    title: "Security deposits: usually one month's rent at most",
    summary:
      "Since July 1, 2024, most California landlords can't take more than one month's rent as a security deposit, furnished or not, and other deposits (pet, key) count toward that limit. A small landlord — a person, family trust or LLC of people owning no more than two rental properties with four or fewer units — may take up to two months, except from service members.",
    ask: "Ask whether the landlord is using the small-landlord exception, and get the deposit amount in the lease.",
    source: { label: "Civil Code §1950.5 (AB 12)", url: leginfo("1950.5") },
  },
  {
    id: "screening_fee",
    title: "Application screening fees are capped",
    summary:
      `The fee can't be more than the landlord's actual screening cost and never more than the statewide cap (about ${formatUsd(CA_SCREENING_FEE_CAP_2026_CENTS)} per applicant in 2026; it changes each December). You're owed an itemized receipt, a refund of any unused part, and a copy of your credit report if one was run.`,
    ask: "Ask what the fee covers and for an itemized receipt.",
    source: { label: "Civil Code §1950.6", url: leginfo("1950.6") },
  },
  {
    id: "no_unit_no_fee",
    title: "No screening fee when there's no unit — and no fee if you weren't considered",
    summary:
      "Since 2025 a landlord can't charge a screening fee when no unit is available within a reasonable time. They must either review applications in the order received and rent to the first qualified applicant, or refund the fee to applicants who aren't selected.",
    ask: "Ask which option they use, and when you'd get a refund.",
    source: { label: "Civil Code §1950.6 (AB 2493)", url: leginfo("1950.6") },
  },
  {
    id: "reusable_report",
    title: "Reusable screening reports",
    summary:
      "If a landlord chooses to accept a recent screening report you already paid for, they can't also charge you a screening fee or a fee to view it.",
    ask: "Ask whether they accept a reusable tenant screening report before you pay.",
    source: { label: "Civil Code §1950.1", url: leginfo("1950.1") },
  },
  {
    id: "rent_reporting",
    title: "Build credit with on-time rent",
    summary:
      "Since April 2025, landlords of buildings with more than 15 units (and some larger owners of smaller buildings) must offer to report your on-time rent payments to at least one credit bureau. It's optional for you, may cost a small fee, and only positive payments are reported.",
    ask: "Ask whether the building offers positive rent reporting — it can help your credit score.",
    source: { label: "Civil Code §1954.07 (AB 2747)", url: leginfo("1954.07") },
  },
  {
    id: "vouchers",
    title: "Housing vouchers are income",
    summary: "California treats Section 8 and other housing assistance as a source of income, so “No Section 8” ads are not allowed.",
    ask: "If you're turned away because of a voucher, you can contact the California Civil Rights Department.",
    source: { label: "Gov. Code §12955 (SB 329)", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=12955" },
  },
];

export const CA_RIGHTS_GUIDE = { label: "California Tenants guide (Department of Real Estate)", url: "https://www.dre.ca.gov/publications/ResourceGuidebook/index.html" };

export type FeeCheckCode = "deposit_over_one_month" | "deposit_over_two_months" | "app_fee_over_cap";

export interface FeeCheck {
  code: FeeCheckCode;
  severity: "info" | "warn";
  message: string;
  topicId: string;
}

/** Soft checks of stated costs against California rules. Only for California addresses; unknown amounts are skipped. */
export function feeChecks(l: Pick<Listing, "pricing" | "address">): FeeCheck[] {
  if (l.address.state !== "CA") return [];
  const out: FeeCheck[] = [];
  const rent = l.pricing.baseRentCents;
  const dep = l.pricing.depositCents;
  if (dep !== null && rent > 0) {
    if (dep > rent * 2) {
      out.push({ code: "deposit_over_two_months", severity: "warn", topicId: "deposit", message: `The ${formatUsd(dep)} deposit is more than two months' rent, above what any California landlord may take as security. Ask before paying.` });
    } else if (dep > rent) {
      out.push({ code: "deposit_over_one_month", severity: "info", topicId: "deposit", message: `The ${formatUsd(dep)} deposit is more than one month's rent. That's only allowed for some small landlords — ask whether that applies.` });
    }
  }
  const fee = l.pricing.applicationFeeCents;
  if (fee !== null && fee > CA_SCREENING_FEE_CAP_2026_CENTS) {
    out.push({ code: "app_fee_over_cap", severity: "warn", topicId: "screening_fee", message: `The ${formatUsd(fee)} application fee is above California's screening-fee cap (about ${formatUsd(CA_SCREENING_FEE_CAP_2026_CENTS)} per applicant in 2026). Ask what it covers before paying.` });
  }
  return out;
}
