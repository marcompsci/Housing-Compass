import { DEFAULT_ALERT_PREFS, planAlerts, type NotificationDraft } from "@housing-compass/core";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "../auth/session";
import { now } from "../config";
import { useListingCache } from "../data/hooks";
import { supabase } from "../data/supabase";
import { useApplications } from "../state/applications";
import { useStore } from "../state/store";

export interface InboxItem {
  key: string;
  title: string;
  body: string;
  listingId: string | null;
  at: string;
  kind: NotificationDraft["kind"];
}

/** Signed in → the server's notifications. Otherwise → the same planner run on this device. */
export function useInbox(): { items: InboxItem[]; source: "server" | "device" } {
  const session = useSession();
  const searches = useStore((s) => s.savedSearches);
  const favorites = useStore((s) => s.favorites);
  const apps = useApplications((s) => s.items);
  const byId = useListingCache((s) => s.byId);
  const [server, setServer] = useState<InboxItem[] | null>(null);

  useEffect(() => {
    if (!supabase || !session) return setServer(null);
    void supabase
      .from("notifications")
      .select("dedupe_key,title,body,listing_id,created_at,kind")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setServer((data ?? []).map((n) => ({ key: n.dedupe_key, title: n.title ?? "", body: n.body ?? "", listingId: n.listing_id, at: n.created_at, kind: n.kind }))));
  }, [session]);

  const local = useMemo(() => {
    const drafts = planAlerts({
      userId: "device",
      savedSearches: searches.map((s) => ({ id: s.id, name: s.name, filters: s.filters, alertsEnabled: !!s.alertsEnabled, lastAlertedAt: s.lastAlertedAt ?? s.createdAt })),
      favorites,
      applications: apps.map((a) => ({ listingId: a.listingId, deadline: a.deadline, status: a.status })),
      listings: Object.values(byId),
      priceChanges: [],
      prefs: DEFAULT_ALERT_PREFS,
      now: now(),
    });
    return drafts.map((d) => ({ key: d.dedupeKey, title: d.title, body: d.body, listingId: d.listingId, at: d.scheduledFor, kind: d.kind }));
  }, [searches, favorites, apps, byId]);

  return server ? { items: server, source: "server" } : { items: local, source: "device" };
}
