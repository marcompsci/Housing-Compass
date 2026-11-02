/**
 * Small per-device preferences: first-run onboarding, alert settings, checklist ticks,
 * and the move-in savings plan. Nothing here is location data.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_ALERT_PREFS, normalizeAlertPrefs, type AlertPrefs } from "@housing-compass/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface SavingsGoal {
  targetCents: number;
  savedCents: number;
  perPeriodCents: number;
  period: "week" | "month";
  listingId: string | null;
}

interface PrefsState {
  onboarded: boolean;
  alertPrefs: AlertPrefs;
  /** checklist key (e.g. "docs:<applicationId>" or "tour:<tourId>") → ticked item ids */
  checklists: Record<string, string[]>;
  savings: SavingsGoal | null;
  finishOnboarding(): void;
  resetOnboarding(): void;
  setAlertPrefs(p: Partial<AlertPrefs>): void;
  toggleCheck(key: string, itemId: string): void;
  setSavings(s: SavingsGoal | null): void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      alertPrefs: DEFAULT_ALERT_PREFS,
      checklists: {},
      savings: null,
      finishOnboarding: () => set({ onboarded: true }),
      resetOnboarding: () => set({ onboarded: false }),
      setAlertPrefs: (p) => set({ alertPrefs: normalizeAlertPrefs({ ...get().alertPrefs, ...p }) }),
      toggleCheck: (key, itemId) => {
        const cur = get().checklists[key] ?? [];
        set({ checklists: { ...get().checklists, [key]: cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId] } });
      },
      setSavings: (savings) => set({ savings }),
    }),
    {
      name: "housing-compass-prefs-v1",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PrefsState>;
        return { ...current, ...p, alertPrefs: normalizeAlertPrefs(p.alertPrefs ?? {}) };
      },
    },
  ),
);
