/**
 * Local rent rules and free tenant help, by city. Only official government offices are
 * listed, each with the page we checked and the date. General information, not legal advice:
 * whether a home is covered depends on the building, so every entry says who to ask.
 */
import { normalizeText } from "./filters";

export const LOCAL_RULES_CHECKED_ON = "2026-11-02";

export interface LocalRentOffice {
  id: string;
  /** Cities (lowercase, normalized) this office serves. */
  cities: string[];
  name: string;
  summary: string;
  coverageHint: string;
  phone: string | null;
  url: string;
}

export const LOCAL_RENT_OFFICES: LocalRentOffice[] = [
  {
    id: "sf_rent_board",
    cities: ["san francisco"],
    name: "San Francisco Rent Board",
    summary: "Limits yearly rent increases for many older buildings, handles eviction-protection questions, and offers free phone counseling.",
    coverageHint: "Many units in buildings first occupied before mid-1979 have rent-increase limits; most units have eviction protections. Ask the Rent Board about a specific address.",
    phone: "(415) 252-4600",
    url: "https://www.sf.gov/departments/rent-board",
  },
  {
    id: "oakland_rap",
    cities: ["oakland"],
    name: "Oakland Rent Adjustment Program (RAP)",
    summary: "Oversees allowed rent increases and tenant petitions in Oakland, and answers questions by phone and email.",
    coverageHint: "Coverage depends on the building's age and type. RAP can tell you whether an address is covered.",
    phone: "(510) 238-3721",
    url: "https://www.oaklandca.gov/Community/Housing-Programs-Support/Rent-Adjustment-Program-RAP",
  },
  {
    id: "berkeley_rent_board",
    cities: ["berkeley"],
    name: "Berkeley Rent Stabilization Board",
    summary: "Registers covered units, publishes the yearly allowed increase, and counsels tenants and landlords.",
    coverageHint: "Look up an address on the Rent Board site to see its registered rent and coverage.",
    phone: null,
    url: "https://rentboard.berkeleyca.gov",
  },
  {
    id: "san_jose_rent",
    cities: ["san jose"],
    name: "San José Rent Stabilization Program",
    summary: "Limits yearly increases for many apartments and runs tenant protection programs.",
    coverageHint: "Coverage depends on the building's age and number of units. Call the program to confirm an address.",
    phone: "(408) 975-4480",
    url: "https://sanjoseca.gov/your-government/departments-offices/housing/tenants",
  },
  {
    id: "la_city_rso",
    cities: ["los angeles"],
    name: "Los Angeles Housing Department — Rent Stabilization (RSO)",
    summary: "Sets the allowed yearly increase for rent-stabilized units in the City of Los Angeles and runs a renter hotline.",
    coverageHint: "Generally covers buildings of 2+ units built on or before October 1, 1978. Check an address with LAHD.",
    phone: "(866) 557-7368",
    url: "https://housing.lacity.gov/residents/what-is-covered-under-the-rso",
  },
  {
    id: "la_county_dcba",
    cities: ["unincorporated los angeles county"],
    name: "LA County Rent Stabilization Program (DCBA)",
    summary: "Covers renters in unincorporated parts of Los Angeles County (areas without their own city government).",
    coverageHint: "Only for unincorporated areas. If your address is in a city like Long Beach or Pasadena, check with that city instead.",
    phone: "(833) 223-7368",
    url: "https://dcba.lacounty.gov/rentstabilizationprogram",
  },
];

/** Statewide fallback: California's rent cap and just-cause law apply to many homes without a local program. */
export const CA_STATEWIDE_OFFICE: LocalRentOffice = {
  id: "ca_statewide",
  cities: [],
  name: "California Tenant Protection Act (statewide)",
  summary: "Many homes without a local program are still covered by the statewide limit on yearly increases and just-cause eviction rules.",
  coverageHint: "Some homes are exempt (for example, many newer buildings and some single-family homes). Read the state tenant guide or ask local legal aid.",
  phone: null,
  url: "https://www.dre.ca.gov/publications/ResourceGuidebook/index.html",
};

export function rentOfficesFor(city: string | null | undefined, county?: string | null): LocalRentOffice[] {
  const c = normalizeText(city ?? "");
  const hits = LOCAL_RENT_OFFICES.filter((o) => o.cities.includes(c));
  if (!hits.length && normalizeText(county ?? "").startsWith("los angeles") && (!c || c === "unincorporated")) {
    hits.push(LOCAL_RENT_OFFICES.find((o) => o.id === "la_county_dcba")!);
  }
  return [...hits, CA_STATEWIDE_OFFICE];
}

// ───────── Recent searches (stored on the device only) ─────────
export const MAX_RECENT_SEARCHES = 6;

export function rememberSearch(recent: string[], query: string): string[] {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return recent;
  const key = normalizeText(q);
  return [q, ...recent.filter((r) => normalizeText(r) !== key)].slice(0, MAX_RECENT_SEARCHES);
}

/** What the app declares to Apple: data it collects and why. Kept here so tests can check it matches app.json. */
export const PRIVACY_DECLARATION = {
  tracking: false,
  collected: [
    { type: "NSPrivacyCollectedDataTypeEmailAddress", linked: true, tracking: false, purpose: "NSPrivacyCollectedDataTypePurposeAppFunctionality" },
    { type: "NSPrivacyCollectedDataTypeCoarseLocation", linked: false, tracking: false, purpose: "NSPrivacyCollectedDataTypePurposeAppFunctionality" },
    { type: "NSPrivacyCollectedDataTypeOtherUserContent", linked: true, tracking: false, purpose: "NSPrivacyCollectedDataTypePurposeAppFunctionality" },
  ],
} as const;
