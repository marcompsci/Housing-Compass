import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HouseholdProfile } from "@housing-compass/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Income and savings are sensitive. They stay ON THIS DEVICE ONLY: never synced,
 * never sent to the server, never logged. Clear them any time from the My Numbers screen.
 */
export const useHousehold = create<{ profile: HouseholdProfile | null; set(p: HouseholdProfile | null): void }>()(
  persist((set) => ({ profile: null, set: (profile) => set({ profile }) }), { name: "housing-compass-household-local-only", storage: createJSONStorage(() => AsyncStorage) }),
);
