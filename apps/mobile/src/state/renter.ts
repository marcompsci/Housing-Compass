/**
 * Renter tools: rent payments, move-in condition record, move-out/deposit, program waitlists
 * and recent searches. Payment amounts and dates are personal finance data, so everything here
 * stays ON THIS DEVICE ONLY — never synced, never sent to our servers, never logged.
 * Export it yourself (CSV / text) when you want to share it with a landlord or rent-reporting service.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rememberSearch, type ConditionEntry, type RentPayment, type RentSetup, type WaitlistEntry } from "@housing-compass/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uuid } from "./applications";

export interface MoveIn {
  address: string;
  moveInDate: string;
}
export interface MoveOut {
  moveOutDate: string;
  depositCents: number;
  forwardingAddress: string;
  requestSentOn: string | null;
}

interface RenterState {
  rentSetup: RentSetup | null;
  payments: RentPayment[];
  remindersOn: boolean;
  moveIn: MoveIn | null;
  condition: ConditionEntry[];
  moveOut: MoveOut | null;
  waitlists: WaitlistEntry[];
  recentSearches: string[];
  setRentSetup(s: RentSetup | null): void;
  addPayment(p: Omit<RentPayment, "id">): void;
  removePayment(id: string): void;
  setRemindersOn(on: boolean): void;
  setMoveIn(m: MoveIn | null): void;
  recordCondition(e: ConditionEntry): void;
  setMoveOut(m: MoveOut | null): void;
  addWaitlist(w: Omit<WaitlistEntry, "id">): void;
  updateWaitlist(id: string, p: Partial<Omit<WaitlistEntry, "id">>): void;
  removeWaitlist(id: string): void;
  rememberSearch(q: string): void;
  clearRecentSearches(): void;
  clearAll(): void;
}

const EMPTY = { rentSetup: null, payments: [], remindersOn: false, moveIn: null, condition: [], moveOut: null, waitlists: [], recentSearches: [] };

export const useRenter = create<RenterState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      setRentSetup: (rentSetup) => set({ rentSetup }),
      addPayment: (p) => set({ payments: [...get().payments, { ...p, id: uuid() }] }),
      removePayment: (id) => set({ payments: get().payments.filter((p) => p.id !== id) }),
      setRemindersOn: (remindersOn) => set({ remindersOn }),
      setMoveIn: (moveIn) => set(moveIn ? { moveIn } : { moveIn: null, condition: [] }),
      recordCondition: (e) => set({ condition: [...get().condition.filter((c) => !(c.room === e.room && c.item === e.item)), e] }),
      setMoveOut: (moveOut) => set({ moveOut }),
      addWaitlist: (w) => set({ waitlists: [{ ...w, id: uuid() }, ...get().waitlists] }),
      updateWaitlist: (id, p) => set({ waitlists: get().waitlists.map((w) => (w.id === id ? { ...w, ...p } : w)) }),
      removeWaitlist: (id) => set({ waitlists: get().waitlists.filter((w) => w.id !== id) }),
      rememberSearch: (q) => {
        const next = rememberSearch(get().recentSearches, q);
        if (next !== get().recentSearches) set({ recentSearches: next });
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
      clearAll: () => set(EMPTY),
    }),
    { name: "housing-compass-renter-local-only", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
