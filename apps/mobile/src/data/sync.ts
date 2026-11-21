import { planSync } from "@housing-compass/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "../lib/log";
import { useStore } from "../state/store";

export interface SyncResult {
  favoritesUploaded: number;
  searchesUploaded: number;
  reportsUploaded: number;
  reportsKeptLocal: number;
}

/** Push on-device favorites/searches/reports to the account, then adopt the server's lists. */
export async function syncAccount(client: SupabaseClient, userId: string): Promise<SyncResult> {
  const s = useStore.getState();
  const [{ data: favRows, error: e1 }, { data: searchRows, error: e2 }] = await Promise.all([
    client.from("favorites").select("listing_id"),
    client.from("saved_searches").select("id,name"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);

  const plan = planSync(
    { favorites: s.favorites, savedSearches: s.savedSearches, reports: s.reports },
    { favorites: (favRows ?? []).map((r) => r.listing_id as string), savedSearchNames: (searchRows ?? []).map((r) => r.name as string) },
  );

  if (plan.favoritesToUpload.length) {
    const { error } = await client.from("favorites").upsert(plan.favoritesToUpload.map((listing_id) => ({ user_id: userId, listing_id })), { ignoreDuplicates: true });
    if (error) log.warn("favorite upload partially failed", { message: error.message });
  }
  for (const ss of plan.searchesToUpload) {
    const { data, error } = await client.from("saved_searches").insert({ user_id: userId, name: ss.name, filters: ss.filters, alerts_enabled: !!(ss as { alertsEnabled?: boolean }).alertsEnabled }).select("id").single();
    if (!error && data) useStore.getState().markSearchSynced(ss.id, data.id as string);
  }
  let reportsUploaded = 0;
  for (const r of plan.reportsToUpload) {
    const { error } = await client.from("reports").insert({ listing_id: r.listingId, reporter_id: userId, reason: r.reason, details: r.details || null });
    if (!error) {
      useStore.getState().markReportSynced(r.id);
      reportsUploaded += 1;
    } else log.warn("report upload failed", { code: error.code });
  }
  useStore.setState({ favorites: plan.mergedFavorites });
  return { favoritesUploaded: plan.favoritesToUpload.length, searchesUploaded: plan.searchesToUpload.length, reportsUploaded, reportsKeptLocal: plan.reportsRejected.length };
}
