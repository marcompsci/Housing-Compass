import type { Category, Listing } from "./schema";

export const CATEGORY_LABEL: Record<Category, string> = {
  PRIVATE_ROOM: "Private Room",
  SHARED_COLIVING: "Shared / Co-living",
  STUDIO: "Studio",
  ENTIRE_1BR: "Entire 1BR",
  INCOME_RESTRICTED: "Income-Restricted",
};

export const CATEGORY_HELP: Record<Category, string> = {
  PRIVATE_ROOM: "Your own bedroom in a shared home. Priced per room.",
  SHARED_COLIVING: "A bed in a shared room, student-style or co-living housing. Often priced per bed.",
  STUDIO: "An entire studio apartment to yourself.",
  ENTIRE_1BR: "An entire one-bedroom apartment to yourself — never a room or a bed.",
  INCOME_RESTRICTED: "Below-market-rate homes with income limits, lotteries or waitlists.",
};

/**
 * Exactly one category per listing. Income-restricted homes live ONLY in the
 * Income-Restricted tab, because eligibility rules change what the price means.
 */
export function categorize(l: Listing): Category | null {
  if (l.eligibility.incomeRestricted) return "INCOME_RESTRICTED";
  switch (l.unit.unitType) {
    case "bed_in_shared_room":
    case "coliving_room":
      return "SHARED_COLIVING";
    case "room_in_shared_home":
      return "PRIVATE_ROOM";
    case "studio":
      return "STUDIO";
    case "one_bedroom":
      return l.unit.isEntireUnit && l.pricing.basis === "PER_UNIT" ? "ENTIRE_1BR" : "PRIVATE_ROOM";
    case "two_plus_bedroom":
      // An entire 2BR+ is NOT an "Entire 1BR". Out of v1 scope → no market tab.
      return l.unit.isEntireUnit ? null : "PRIVATE_ROOM";
  }
}
