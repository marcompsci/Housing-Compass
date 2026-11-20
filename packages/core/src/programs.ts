/**
 * Official affordable-housing programs and resources, by region. Programs, waitlists,
 * eligibility and vacancies are SEPARATE fields: a program being listed here never means
 * a unit is open, or that anyone qualifies. Facts checked 2026-11-01 against the sources listed.
 */
import type { RegionId } from "./geo";

export interface HousingProgram {
  id: string;
  regions: RegionId[];
  name: string;
  operator: string;
  kind: "affordable_portal" | "accessible_registry" | "property_map" | "resource_center" | "referral_line";
  url: string;
  phone: string | null;
  tty: string | null;
  hours: string | null;
  whatItIs: string;
  /** How applications / waitlists work, in plain words. */
  waitlistInfo: string;
  eligibilityInfo: string;
  /** What this resource does and does NOT tell you about open units. */
  vacancyInfo: string;
  checkedOn: string;
  sources: string[];
}

export const PROGRAMS: HousingProgram[] = [
  {
    id: "doorway",
    regions: ["bay_area"],
    name: "Doorway Housing Portal",
    operator: "Bay Area Housing Finance Authority (BAHFA)",
    kind: "affordable_portal",
    url: "https://housingbayarea.mtc.ca.gov/",
    phone: null,
    tty: null,
    hours: null,
    whatItIs: "The Bay Area's official portal for affordable rental listings across the nine counties.",
    waitlistInfo: "Listings are run as lotteries, waitlists or first-come-first-served. Each listing says which.",
    eligibilityInfo: "Each listing sets its own income limits and rules. Doorway helps you check eligibility before applying.",
    vacancyInfo: "Listings are housing opportunities. Being listed does not guarantee acceptance or an immediate vacancy.",
    checkedOn: "2026-11-01",
    sources: ["https://housingbayarea.mtc.ca.gov/housing-basics"],
  },
  {
    id: "211-alameda",
    regions: ["bay_area"],
    name: "211 Alameda County",
    operator: "Eden I&R",
    kind: "referral_line",
    url: "https://211alamedacounty.org/find-help-information/alameda-county-housing/",
    phone: "211",
    tty: null,
    hours: null,
    whatItIs: "Free referral line for housing help, shelter and county services. You can also text 898211.",
    waitlistInfo: "Referrals, not applications.",
    eligibilityInfo: "Depends on the program you're referred to.",
    vacancyInfo: "Shelter availability is posted on its site. It doesn't list individual rental vacancies.",
    checkedOn: "2026-11-01",
    sources: ["https://211alamedacounty.org/find-help-information/alameda-county-housing/"],
  },
  {
    id: "la-aahr",
    regions: ["la_city", "la_county"],
    name: "Affordable & Accessible Housing Registry (AAHR)",
    operator: "Los Angeles Housing Department (LAHD), Accessible Housing Program",
    kind: "accessible_registry",
    url: "https://accesshousingla.org/",
    phone: "(213) 808-8550",
    tty: "(213) 473-3231",
    hours: null,
    whatItIs: "The City of LA's registry of affordable and accessible units in covered housing developments.",
    waitlistInfo: "Register, then apply to open conventional waitlists or to an accessible-unit waitlist. You can get notified when properties open applications.",
    eligibilityInfo: "Each property has income and rent limits. The registry publishes current AMI income and rent limits.",
    vacancyInfo: "Shows properties and whether applications or waitlists are open. That is not a promise of an immediate vacancy.",
    checkedOn: "2026-11-01",
    sources: ["https://housing.lacity.gov/housing/how-do-i-find-accessible-rental-housing"],
  },
  {
    id: "la-lahd-properties",
    regions: ["la_city", "la_county"],
    name: "LAHD — Find our properties",
    operator: "Los Angeles Housing Department (LAHD)",
    kind: "property_map",
    url: "https://housing.lacity.gov/housing/find-our-properties",
    phone: null,
    tty: null,
    hours: null,
    whatItIs: "A map of LAHD-supported affordable housing developments since 2003, plus a link to an affordable rental search.",
    waitlistInfo: "Apply through the property or the registry. The map itself is not an application.",
    eligibilityInfo: "Set per property.",
    vacancyInfo: "A list of properties, NOT of open units. Contact the property to ask about vacancies or waitlists.",
    checkedOn: "2026-11-01",
    sources: ["https://housing.lacity.gov/housing/find-our-properties"],
  },
  {
    id: "la-county-hrc",
    regions: ["la_city", "la_county"],
    name: "LA County Housing Resource Center",
    operator: "Los Angeles County Development Authority (LACDA)",
    kind: "resource_center",
    url: "https://housing.lacounty.gov/",
    phone: "1-877-428-8844",
    tty: "7-1-1",
    hours: "Mon–Fri, 6 a.m.–5 p.m. Pacific (English and Spanish)",
    whatItIs: "Free search and listing of affordable, special-needs, accessible and emergency housing in LA County, with a toll-free call center.",
    waitlistInfo: "Each listing explains how to apply.",
    eligibilityInfo: "Set per listing or program.",
    vacancyInfo: "Listings are updated regularly, but each unit's availability still needs to be confirmed with the owner or manager.",
    checkedOn: "2026-11-01",
    sources: ["https://www.housing.lacounty.gov/About.html"],
  },
  {
    id: "211-la",
    regions: ["la_city", "la_county"],
    name: "211 LA",
    operator: "211 LA County",
    kind: "referral_line",
    url: "https://211la.org/",
    phone: "211",
    tty: null,
    hours: "24 hours, 7 days",
    whatItIs: "Free referrals for shelter, housing help and other services in LA County.",
    waitlistInfo: "Referrals, not applications.",
    eligibilityInfo: "Depends on the program you're referred to.",
    vacancyInfo: "Doesn't list individual rental vacancies.",
    checkedOn: "2026-11-01",
    sources: ["https://211la.org/"],
  },
];

export function programsFor(region: RegionId): HousingProgram[] {
  return PROGRAMS.filter((p) => p.regions.includes(region));
}

/** Plain-language voucher rights note (California). Reviewed by counsel before launch — see docs. */
export const VOUCHER_NOTE_CA =
  "In California, it is generally unlawful for a landlord to refuse a tenant only because they use a housing voucher such as Section 8, or to advertise “No Section 8” (SB 329, in effect since 2020). Landlords may still apply their other usual screening criteria.";

/** A row of the `programs` table (reviewed edits) → the app's HousingProgram shape. */
export function programFromRow(r: Record<string, unknown>): HousingProgram | null {
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
  const arr = (k: string) => (Array.isArray(r[k]) ? (r[k] as string[]) : []);
  const id = str("id");
  const url = str("url");
  if (!id || !url || !/^https:\/\//.test(url)) return null;
  const regions = arr("regions").filter((x): x is RegionId => x === "bay_area" || x === "la_city" || x === "la_county");
  if (!regions.length) return null;
  const kind = str("kind") as HousingProgram["kind"] | null;
  if (!kind) return null;
  return {
    id, regions, kind, url,
    name: str("name") ?? id,
    operator: str("operator") ?? "",
    phone: str("phone"), tty: str("tty"), hours: str("hours"),
    whatItIs: str("what_it_is") ?? "",
    waitlistInfo: str("waitlist_info") ?? "",
    eligibilityInfo: str("eligibility_info") ?? "",
    vacancyInfo: str("vacancy_info") ?? "",
    checkedOn: (str("checked_on") ?? "").slice(0, 10),
    sources: arr("sources"),
  };
}

/** Fields the public may suggest corrections for (mirrors decide_program_edit's whitelist). */
export const PROGRAM_EDITABLE_FIELDS = ["url", "phone", "tty", "hours", "what_it_is", "waitlist_info", "eligibility_info", "vacancy_info"] as const;
export type ProgramEditableField = (typeof PROGRAM_EDITABLE_FIELDS)[number];
