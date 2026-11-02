/** Gather (for export) or wipe everything Housing Compass keeps on this device. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildDataExport, exportFileName } from "@housing-compass/core";
import { now } from "../config";
import { supabase } from "../data/supabase";
import { useApplications } from "../state/applications";
import { useConversations } from "../state/conversations";
import { useHousehold } from "../state/household";
import { usePrefs } from "../state/prefs";
import { usePriceHistory } from "../state/priceHistory";
import { useStore } from "../state/store";
import { saveAndShare } from "./files";
import { useSavedCopies } from "../data/savedCopies";

export async function exportMyData(signedIn: boolean): Promise<string> {
  const s = useStore.getState();
  const p = usePrefs.getState();
  let server: unknown = null;
  if (signedIn && supabase) {
    const { data, error } = await supabase.rpc("export_my_data");
    if (error) throw new Error("Couldn't download your account data. Try again.");
    server = data;
  }
  const json = buildDataExport(
    {
      favorites: s.favorites,
      savedSearches: s.savedSearches,
      reports: s.reports,
      applications: useApplications.getState().items,
      conversations: useConversations.getState().threads,
      priceHistory: usePriceHistory.getState().history,
      alertPrefs: p.alertPrefs,
      checklists: p.checklists,
      savings: p.savings,
      household: useHousehold.getState().profile,
      notes: s.notes,
      savedAreas: s.savedAreas,
    },
    server,
    now(),
  );
  return saveAndShare(exportFileName(now()), json, "application/json", "public.json");
}

/** Removes every Housing Compass key from this device's storage and resets in-memory state. */
export async function clearThisDevice(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("housing-compass"));
  await AsyncStorage.multiRemove(keys);
  useStore.setState({ favorites: [], compare: [], savedSearches: [], reports: [], readNotifications: [], unverifiedWarningAcknowledged: false, notes: {}, savedAreas: [] });
  useSavedCopies.setState({ docs: {} });
  useApplications.setState({ items: [] });
  useConversations.setState({ threads: [] });
  usePriceHistory.getState().clear();
  useHousehold.getState().set(null);
  usePrefs.setState({ checklists: {}, savings: null, onboarded: false });
}
