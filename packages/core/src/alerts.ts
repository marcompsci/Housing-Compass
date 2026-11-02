/**
 * Alert planning. Pure: given a user's saved searches, favorites, applications and the
 * current listings, produce notification drafts with stable dedupe keys. The DB's
 * unique (user_id, dedupe_key) makes re-running the planner safe.
 */
import { search, type SearchFilters } from "./filters";
import { formatRent } from "./pricing";
import type { Listing } from "./schema";
import { LEVEL_LABEL } from "./trust/verification";

export type NotificationKind = "saved_search_match" | "deadline_reminder" | "listing_changed" | "listing_expired";

export interface NotificationDraft {
  userId: string;
  kind: NotificationKind;
  channel: "push" | "in_app";
  dedupeKey: string;
  title: string;
  body: string;
  listingId: string | null;
  scheduledFor: string;
}

export interface AlertPrefs {
  /** Local hour [0-23] quiet hours start/end; null = no quiet hours. */
  quietStart: number | null;
  quietEnd: number | null;
  /** Minutes east of UTC for the user's time zone, e.g. Pacific Standard = -480. */
  utcOffsetMinutes: number;
  maxPushPerDay: number;
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = { quietStart: 21, quietEnd: 8, utcOffsetMinutes: -480, maxPushPerDay: 5 };

export interface AlertInput {
  userId: string;
  savedSearches: Array<{ id: string; name: string; filters: SearchFilters; alertsEnabled: boolean; lastAlertedAt: string | null }>;
  favorites: string[];
  applications: Array<{ listingId: string | null; deadline: string | null; status: string }>;
  listings: Listing[];
  priceChanges: Array<{ listingId: string; oldCents: number | null; newCents: number }>;
  prefs: AlertPrefs;
  now: Date;
}

const DAY = 86_400_000;

/** Move a send time out of quiet hours (to the end of the quiet window, user-local). */
export function respectQuietHours(at: Date, p: AlertPrefs): Date {
  if (p.quietStart === null || p.quietEnd === null) return at;
  const local = new Date(at.getTime() + p.utcOffsetMinutes * 60_000);
  const h = local.getUTCHours();
  const inQuiet = p.quietStart > p.quietEnd ? h >= p.quietStart || h < p.quietEnd : h >= p.quietStart && h < p.quietEnd;
  if (!inQuiet) return at;
  const end = new Date(local);
  end.setUTCHours(p.quietEnd, 0, 0, 0);
  if (end.getTime() <= local.getTime()) end.setTime(end.getTime() + DAY);
  return new Date(end.getTime() - p.utcOffsetMinutes * 60_000);
}

function trustPhrase(l: Listing): string {
  return l.verification.level === "SOURCE_LISTED_UNVERIFIED" ? "Unverified lead — check before contacting" : LEVEL_LABEL[l.verification.level];
}

export function planAlerts(i: AlertInput): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  const nowIso = i.now.toISOString();
  const byId = new Map(i.listings.map((l) => [l.id, l]));

  // 1) New matches for saved searches (only listings first seen / verified since the last alert)
  for (const ss of i.savedSearches.filter((s) => s.alertsEnabled)) {
    const since = ss.lastAlertedAt ?? new Date(i.now.getTime() - DAY).toISOString();
    const hits = search(i.listings, ss.filters).hits.filter((h) => {
      const l = h.listing;
      const fresh = [l.source.capturedAt, l.verification.lastVerifiedAt].some((t) => t !== null && t > since);
      return fresh && !l.isDemo;
    });
    if (hits.length > 3) {
      out.push({
        userId: i.userId, kind: "saved_search_match", channel: "push",
        dedupeKey: `ss:${ss.id}:digest:${nowIso.slice(0, 10)}`,
        title: `${hits.length} new homes for “${ss.name}”`,
        body:
          hits.slice(0, 3).map((h) => formatRent(h.listing)).join(" · ") +
          " …" +
          (hits.some((h) => h.listing.verification.level === "SOURCE_LISTED_UNVERIFIED") ? " Includes unverified leads — check before contacting." : ""),
        listingId: null, scheduledFor: nowIso,
      });
    } else {
      for (const h of hits) {
        out.push({
          userId: i.userId, kind: "saved_search_match", channel: "push",
          dedupeKey: `ss:${ss.id}:${h.listing.id}`,
          title: `New match for “${ss.name}”`,
          body: `${h.listing.title} · ${formatRent(h.listing)} · ${trustPhrase(h.listing)}`,
          listingId: h.listing.id, scheduledFor: nowIso,
        });
      }
    }
  }

  // 2) Deadline reminders: 7 days, 2 days, and day-of, for favorites and tracked applications
  const watched = new Map<string, string>();
  for (const id of i.favorites) {
    const d = byId.get(id)?.eligibility.applicationDeadline;
    if (d) watched.set(id, d);
  }
  for (const a of i.applications) {
    if (a.listingId && a.deadline && !["applied", "leased", "declined", "withdrawn"].includes(a.status)) watched.set(a.listingId, a.deadline);
  }
  for (const [listingId, deadline] of watched) {
    const daysLeft = Math.ceil((new Date(deadline).getTime() - i.now.getTime()) / DAY);
    const bucket = daysLeft <= 0 ? 0 : daysLeft <= 2 ? 2 : daysLeft <= 7 ? 7 : null;
    if (bucket === null || daysLeft < 0) continue;
    const l = byId.get(listingId);
    out.push({
      userId: i.userId, kind: "deadline_reminder", channel: "push",
      dedupeKey: `dl:${listingId}:${bucket}`,
      title: daysLeft <= 0 ? "Application deadline is today" : `Application deadline in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body: l ? l.title : "A home you're tracking",
      listingId, scheduledFor: nowIso,
    });
  }

  // 3) Price changes and expiry on favorites (in-app; not worth a push)
  const fav = new Set(i.favorites);
  for (const c of i.priceChanges.filter((c) => fav.has(c.listingId))) {
    const l = byId.get(c.listingId);
    out.push({
      userId: i.userId, kind: "listing_changed", channel: "in_app",
      dedupeKey: `pc:${c.listingId}:${c.newCents}`,
      title: c.oldCents !== null && c.newCents < c.oldCents ? "Price dropped on a saved home" : "Price changed on a saved home",
      body: l ? `${l.title}: now ${formatRent(l)}` : "Open the listing for details",
      listingId: c.listingId, scheduledFor: nowIso,
    });
  }
  for (const id of i.favorites) {
    const l = byId.get(id);
    if (l && (l.verification.level === "EXPIRED" || l.status === "expired" || l.status === "removed")) {
      out.push({
        userId: i.userId, kind: "listing_expired", channel: "in_app",
        dedupeKey: `ex:${id}`,
        title: "A saved home is no longer shown",
        body: `${l.title} expired or was removed pending review.`,
        listingId: id, scheduledFor: nowIso,
      });
    }
  }

  // Quiet hours + daily push cap (extra pushes become in-app only)
  let pushes = 0;
  return out.map((n) => {
    let channel = n.channel;
    if (channel === "push") {
      pushes += 1;
      if (pushes > i.prefs.maxPushPerDay) channel = "in_app";
    }
    return { ...n, channel, scheduledFor: channel === "push" ? respectQuietHours(i.now, i.prefs).toISOString() : n.scheduledFor };
  });
}
