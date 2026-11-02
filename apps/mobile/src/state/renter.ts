/**
 * Renter tools: rent payments, move-in condition record, move-out/deposit, program waitlists
 * and recent searches. Payment amounts and dates are personal finance data, so everything here
 * stays ON THIS DEVICE ONLY — never synced, never sent to our servers, never logged.
 * Move-in photos are copied into the app's private folder on this phone.
 * Export it yourself (CSV / text) when you want to share it with a landlord or rent-reporting service.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rememberSearch, type Bill, type ConditionEntry, type RentPayment, type RentSetup, type WaitlistEntry } from "@housing-compass/core";
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
  bills: Bill[];
  /** bill id → months (YYYY-MM) marked paid */
  billPaid: Record<string, string[]>;
  takeHomeCents: number | null;
  /** "room:item" → photos stored in this app's private folder */
  photos: Record<string, Array<{ uri: string; at: string }>>;
  lockOn: boolean;
  addBill(b: Omit<Bill, "id">): void;
  removeBill(id: string): void;
  toggleBillPaid(id: string, month: string): void;
  setTakeHome(c: number | null): void;
  addPhoto(key: string, p: { uri: string; at: string }): void;
  removePhoto(key: string, uri: string): void;
  setLockOn(on: boolean): void;
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

const EMPTY = { rentSetup: null, payments: [], remindersOn: false, moveIn: null, condition: [], moveOut: null, waitlists: [], recentSearches: [], bills: [], billPaid: {}, takeHomeCents: null, photos: {}, lockOn: false };

export const useRenter = create<RenterState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      setRentSetup: (rentSetup) => set({ rentSetup }),
      addPayment: (p) => set({ payments: [...get().payments, { ...p, id: uuid() }] }),
      removePayment: (id) => set({ payments: get().payments.filter((p) => p.id !== id) }),
      setRemindersOn: (remindersOn) => set({ remindersOn }),
      setMoveIn: (moveIn) => set(moveIn ? { moveIn } : { moveIn: null, condition: [], photos: {} }),
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
      addBill: (b) => set({ bills: [...get().bills, { ...b, id: uuid() }] }),
      removeBill: (id) => {
        const { [id]: _gone, ...billPaid } = get().billPaid;
        set({ bills: get().bills.filter((b) => b.id !== id), billPaid });
      },
      toggleBillPaid: (id, month) => {
        const cur = get().billPaid[id] ?? [];
        set({ billPaid: { ...get().billPaid, [id]: cur.includes(month) ? cur.filter((m) => m !== month) : [...cur, month].slice(-36) } });
      },
      setTakeHome: (takeHomeCents) => set({ takeHomeCents }),
      addPhoto: (key, p) => set({ photos: { ...get().photos, [key]: [...(get().photos[key] ?? []), p].slice(-6) } }),
      removePhoto: (key, uri) => set({ photos: { ...get().photos, [key]: (get().photos[key] ?? []).filter((p) => p.uri !== uri) } }),
      setLockOn: (lockOn) => set({ lockOn }),
      clearAll: () => set(EMPTY),
    }),
    { name: "housing-compass-renter-local-only", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
