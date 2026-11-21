import { describe, expect, it } from "vitest";
import { DEFAULT_ALERT_PREFS, DEFAULT_FILTERS, demoListings, planAlerts, respectQuietHours, researchLeads, type AlertInput } from "../src/index";

const NOW = new Date("2026-11-03T20:00:00Z"); // 12:00 Pacific
const leads = researchLeads();
const demo = demoListings(NOW);

const base = (p: Partial<AlertInput> = {}): AlertInput => ({
  userId: "u1",
  savedSearches: [],
  favorites: [],
  applications: [],
  listings: [...leads, ...demo],
  priceChanges: [],
  prefs: DEFAULT_ALERT_PREFS,
  now: NOW,
  ...p,
});

describe("alerts", () => {
  it("matches only fresh, non-demo listings and dedupes per search+listing", () => {
    const ss = { id: "s1", name: "SF rooms", alertsEnabled: true, lastAlertedAt: "2026-10-31T00:00:00Z", filters: { ...DEFAULT_FILTERS, category: "PRIVATE_ROOM" as const, includeUnverified: true, center: { lat: 37.7749, lng: -122.4194 }, radiusKm: 5 } };
    const n = planAlerts(base({ savedSearches: [ss] }));
    expect(n.length).toBeGreaterThan(0);
    expect(n.every((x) => !x.listingId?.startsWith("demo-"))).toBe(true);
    expect(new Set(n.map((x) => x.dedupeKey)).size).toBe(n.length);
    expect(n[0]!.body).toMatch(/nverified lead.*check before contacting/);
    const later = planAlerts(base({ savedSearches: [{ ...ss, lastAlertedAt: "2026-11-02T00:00:00Z" }] }));
    expect(later.filter((x) => x.kind === "saved_search_match")).toHaveLength(0);
  });
  it("collapses many matches into one digest", () => {
    const ss = { id: "s2", name: "Bay 1BR", alertsEnabled: true, lastAlertedAt: "2026-10-31T00:00:00Z", filters: { ...DEFAULT_FILTERS, category: "ENTIRE_1BR" as const, includeUnverified: true } };
    const n = planAlerts(base({ savedSearches: [ss] }));
    expect(n).toHaveLength(1);
    expect(n[0]!.dedupeKey).toMatch(/digest/);
  });
  it("reminds about deadlines at 7, 2 and 0 days, not for applied", () => {
    const fav = demo.find((d) => d.eligibility.applicationDeadline)!; // deadline now+30d
    const at = (days: number) => new Date(new Date(fav.eligibility.applicationDeadline!).getTime() - days * 86_400_000);
    expect(planAlerts(base({ favorites: [fav.id], now: at(6) })).map((n) => n.dedupeKey)).toEqual([`dl:${fav.id}:7`]);
    expect(planAlerts(base({ favorites: [fav.id], now: at(1.5) })).map((n) => n.dedupeKey)).toEqual([`dl:${fav.id}:2`]);
    expect(planAlerts(base({ favorites: [fav.id], now: at(20) }))).toHaveLength(0);
    expect(planAlerts(base({ applications: [{ listingId: fav.id, deadline: fav.eligibility.applicationDeadline, status: "applied" }], now: at(1) }))).toHaveLength(0);
  });
  it("tells you when a favorite drops in price or expires", () => {
    const n = planAlerts(base({ favorites: [leads[0]!.id, "demo-expired-official"], priceChanges: [{ listingId: leads[0]!.id, oldCents: 90000, newCents: 85000 }] }));
    expect(n.map((x) => x.kind).sort()).toEqual(["listing_changed", "listing_expired"]);
    expect(n.find((x) => x.kind === "listing_changed")!.title).toMatch(/dropped/);
  });
  it("defers pushes during quiet hours and caps pushes per day", () => {
    const night = new Date("2026-11-04T07:00:00Z"); // 23:00 Pacific
    expect(respectQuietHours(night, DEFAULT_ALERT_PREFS).toISOString()).toBe("2026-11-04T16:00:00.000Z"); // 08:00 Pacific
    expect(respectQuietHours(NOW, DEFAULT_ALERT_PREFS)).toEqual(NOW);
    const ss = (id: string) => ({ id, name: id, alertsEnabled: true, lastAlertedAt: "2026-10-31T00:00:00Z", filters: { ...DEFAULT_FILTERS, category: "PRIVATE_ROOM" as const, includeUnverified: true } });
    const n = planAlerts(base({ savedSearches: ["a", "b", "c", "d", "e", "f", "g"].map(ss), prefs: { ...DEFAULT_ALERT_PREFS, maxPushPerDay: 2 } }));
    expect(n.filter((x) => x.channel === "push")).toHaveLength(2);
  });
});
