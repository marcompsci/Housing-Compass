/**
 * Practical checklists: what to gather before applying, and what to check on tour day.
 * General guidance only — each program or landlord sets its own list, and these never
 * replace what the official application asks for.
 */
import { categorize } from "./categories";
import type { Listing } from "./schema";

export interface ChecklistEntry {
  id: string;
  label: string;
  detail?: string;
  /** Shown with a caution icon: privacy or scam-safety advice. */
  caution?: boolean;
}

const BASE_DOCS: ChecklistEntry[] = [
  { id: "photo_id", label: "Government photo ID", detail: "Driver's license, state ID or passport." },
  { id: "income", label: "Proof of income", detail: "Recent pay stubs, a benefits award letter, or an offer letter. Self-employed: recent bank statements or tax return." },
  { id: "rental_history", label: "Rental history", detail: "Past addresses, dates and landlord contacts for the last 2–3 years." },
  { id: "references", label: "References", detail: "One or two people who agreed to be contacted (employer, past landlord, caseworker)." },
  { id: "screening_report", label: "A recent screening/credit report (optional)", detail: "Some landlords accept a report you already have, which can save a fee. Ask before paying for a new one." },
];

const SAFETY: ChecklistEntry = {
  id: "privacy",
  label: "Send documents only through the official application",
  detail: "Never text or email your SSN, ID photos or bank login to someone you haven't verified. Cover account numbers except the last 4 digits.",
  caution: true,
};

export function applicationDocuments(l: Pick<Listing, "unit" | "pricing" | "eligibility" | "amenities">): ChecklistEntry[] {
  const out = [...BASE_DOCS];
  const restricted = l.eligibility.incomeRestricted || categorize(l as Listing) === "INCOME_RESTRICTED";
  if (restricted) {
    out.push(
      { id: "household_income", label: "Income documents for every adult in the household", detail: "Programs usually count everyone 18+ who will live there." },
      { id: "household_list", label: "Names and birth dates of everyone in the household", detail: "Household size sets your income limit." },
      { id: "tax_return", label: "Most recent tax return or non-filing statement", detail: "Many affordable programs ask for one." },
      { id: "assets", label: "Recent bank statements (2–3 months)", detail: "Used to confirm assets; cover account numbers except the last 4 digits." },
    );
    if (l.eligibility.programType === "lottery" || l.eligibility.programType === "waitlist") {
      out.push({ id: "confirmation", label: "Save your lottery / waitlist confirmation number", detail: "Write it in your application notes." });
    }
  }
  if (l.amenities.acceptsVouchers) {
    out.push({ id: "voucher", label: "Voucher paperwork", detail: "Your voucher and the housing authority's request-for-tenancy forms, plus your caseworker's contact." });
  }
  if (l.eligibility.minIncomeMultipleOfRent) {
    out.push({ id: "income_multiple", label: `Show income of about ${l.eligibility.minIncomeMultipleOfRent}× the rent`, detail: "If you're short, ask whether a co-signer or voucher income counts." });
  }
  out.push(SAFETY);
  return out;
}

export const TOUR_DAY_CHECKLIST: ChecklistEntry[] = [
  { id: "address", label: "The address and unit match the listing", detail: "Compare the building number, unit and photos." },
  { id: "access", label: "The person can open the unit and show the inside", detail: "\"I'm out of town, drive by and look through the window\" is a classic scam." },
  { id: "identity", label: "You confirmed who they work for", detail: "Call the management company using a number from their official website, not the ad." },
  { id: "costs", label: "You got the full cost in writing", detail: "Rent, every monthly fee, deposit, application fee and move-in total." },
  { id: "basis", label: "You know exactly what the price buys", detail: "A whole unit, a private room, or one bed in a shared room?" },
  { id: "lease", label: "You read the lease before signing", detail: "Term, who pays utilities, guest and pet rules, how the deposit is returned." },
  { id: "condition", label: "Water, heat, windows, locks and smoke alarms work", detail: "Take dated photos of any damage before moving in." },
  { id: "no_pay", label: "You haven't paid anything yet", detail: "Never pay a deposit or fee by wire, gift card, crypto or a payment app before seeing the home and signing.", caution: true },
  { id: "buddy", label: "Someone knows where you are", detail: "Bring a friend or share your location during the tour.", caution: true },
];

export function checklistProgress(items: ChecklistEntry[], done: string[]): { done: number; total: number } {
  const d = new Set(done);
  return { done: items.filter((i) => d.has(i.id)).length, total: items.length };
}
