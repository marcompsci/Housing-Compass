/**
 * Renter tools: rent payments, move-in condition record, move-out/deposit, program waitlists
 * and recent searches. Payment amounts and dates are personal finance data, so everything here
 * stays ON THIS DEVICE ONLY — never synced, never sent to our servers, never logged.
 * Move-in photos are copied into the app's private folder on this phone.
 * Export it yourself (CSV / text) when you want to share it with a landlord or rent-reporting service.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rememberSearch, type Bill, type ConditionEntry, type Bureau, type Contribution, type CreditStep, type Debt, type Dispute, type Inquiry, type Iou, type Negotiation, type SideExpense, type MileageEntry, type SideIncome, type YearlyExpense, type PaySetup, type RenterBackup, type RentPayment, type RentSetup, type SavingsGoal, type WaitlistEntry } from "@housing-compass/core";
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
  pay: PaySetup | null;
  startBalanceCents: number | null;
  debts: Debt[];
  goals: SavingsGoal[];
  unusedSubs: string[];
  creditDone: CreditStep[];
  setupDone: boolean;
  emergencyCents: number | null;
  splitPct: { goals: number; debt: number };
  weeklyCheckIn: boolean;
  sideIncome: SideIncome[];
  mileage: MileageEntry[];
  sideSetAsidePct: number;
  yearly: YearlyExpense[];
  contribs: Contribution[];
  sideExpenses: SideExpense[];
  sideGoalCents: number | null;
  negotiations: Negotiation[];
  reportChecks: Array<{ bureau: Bureau; date: string }>;
  inquiries: Inquiry[];
  disputes: Dispute[];
  ious: Iou[];
  hourlyCents: number | null;
  updateDebt(id: string, p: Partial<Omit<Debt, "id">>): void;
  addSideExpense(x: Omit<SideExpense, "id">): void;
  removeSideExpense(id: string): void;
  setSideGoal(c: number | null): void;
  addNegotiation(x: Omit<Negotiation, "id">): void;
  updateNegotiation(id: string, p: Partial<Omit<Negotiation, "id">>): void;
  removeNegotiation(id: string): void;
  markReportChecked(bureau: Bureau, date: string): void;
  addInquiry(x: Omit<Inquiry, "id">): void;
  removeInquiry(id: string): void;
  addDispute(x: Omit<Dispute, "id" | "resolved">): void;
  resolveDispute(id: string): void;
  removeDispute(id: string): void;
  addIou(x: Omit<Iou, "id" | "settled">): void;
  settlePerson(person: string): void;
  removeIou(id: string): void;
  setHourly(c: number | null): void;
  addSideIncome(x: Omit<SideIncome, "id">): void;
  removeSideIncome(id: string): void;
  addMileage(x: Omit<MileageEntry, "id">): void;
  removeMileage(id: string): void;
  setSideSetAsidePct(p: number): void;
  addYearly(x: Omit<YearlyExpense, "id">): void;
  updateYearly(id: string, p: Partial<Omit<YearlyExpense, "id">>): void;
  removeYearly(id: string): void;
  contribute(goalId: string, amountCents: number, date: string): void;
  setEmergency(c: number | null): void;
  setSplitPct(p: { goals: number; debt: number }): void;
  setWeeklyCheckIn(on: boolean): void;
  setPay(p: PaySetup | null): void;
  setStartBalance(c: number | null): void;
  addDebt(d: Omit<Debt, "id">): void;
  removeDebt(id: string): void;
  addGoal(g: Omit<SavingsGoal, "id">): void;
  updateGoal(id: string, p: Partial<Omit<SavingsGoal, "id">>): void;
  removeGoal(id: string): void;
  toggleUnusedSub(id: string): void;
  toggleCreditStep(s: CreditStep): void;
  setSetupDone(d: boolean): void;
  markBillPaid(id: string, month: string): void;
  restore(b: RenterBackup): void;
  addBill(b: Omit<Bill, "id">): void;
  removeBill(id: string): void;
  updateBill(id: string, p: Partial<Omit<Bill, "id">>): void;
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

const EMPTY = { rentSetup: null, payments: [], remindersOn: false, moveIn: null, condition: [], moveOut: null, waitlists: [], recentSearches: [], bills: [], billPaid: {}, takeHomeCents: null, photos: {}, lockOn: false, pay: null, startBalanceCents: null, debts: [], goals: [], unusedSubs: [], creditDone: [], setupDone: false, emergencyCents: null, splitPct: { goals: 50, debt: 30 }, weeklyCheckIn: false, sideIncome: [], mileage: [], sideSetAsidePct: 25, yearly: [], contribs: [], sideExpenses: [], sideGoalCents: null, negotiations: [], reportChecks: [], inquiries: [], disputes: [], ious: [], hourlyCents: null };

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
      updateBill: (id, p) => set({ bills: get().bills.map((b) => (b.id === id ? { ...b, ...p } : b)) }),
      removeBill: (id) => {
        const { [id]: _gone, ...billPaid } = get().billPaid;
        set({ bills: get().bills.filter((b) => b.id !== id), billPaid, unusedSubs: get().unusedSubs.filter((x) => x !== id) });
      },
      toggleBillPaid: (id, month) => {
        const cur = get().billPaid[id] ?? [];
        set({ billPaid: { ...get().billPaid, [id]: cur.includes(month) ? cur.filter((m) => m !== month) : [...cur, month].slice(-36) } });
      },
      setTakeHome: (takeHomeCents) => set({ takeHomeCents }),
      addPhoto: (key, p) => set({ photos: { ...get().photos, [key]: [...(get().photos[key] ?? []), p].slice(-6) } }),
      removePhoto: (key, uri) => set({ photos: { ...get().photos, [key]: (get().photos[key] ?? []).filter((p) => p.uri !== uri) } }),
      setLockOn: (lockOn) => set({ lockOn }),
      setPay: (pay) => set({ pay }),
      setStartBalance: (startBalanceCents) => set({ startBalanceCents }),
      addDebt: (d) => set({ debts: [...get().debts, { ...d, id: uuid() }] }),
      removeDebt: (id) => set({ debts: get().debts.filter((d) => d.id !== id) }),
      addGoal: (g) => set({ goals: [...get().goals, { ...g, id: uuid() }] }),
      updateGoal: (id, p) => set({ goals: get().goals.map((g) => (g.id === id ? { ...g, ...p } : g)) }),
      removeGoal: (id) => set({ goals: get().goals.filter((g) => g.id !== id), contribs: get().contribs.filter((c) => c.goalId !== id) }),
      toggleUnusedSub: (id) => set({ unusedSubs: get().unusedSubs.includes(id) ? get().unusedSubs.filter((x) => x !== id) : [...get().unusedSubs, id] }),
      toggleCreditStep: (st) => set({ creditDone: get().creditDone.includes(st) ? get().creditDone.filter((x) => x !== st) : [...get().creditDone, st] }),
      setSetupDone: (setupDone) => set({ setupDone }),
      setEmergency: (emergencyCents) => set({ emergencyCents }),
      setSplitPct: (splitPct) => set({ splitPct }),
      setWeeklyCheckIn: (weeklyCheckIn) => set({ weeklyCheckIn }),
      updateDebt: (id, p) => set({ debts: get().debts.map((d) => (d.id === id ? { ...d, ...p } : d)) }),
      addSideExpense: (x) => set({ sideExpenses: [{ ...x, id: uuid() }, ...get().sideExpenses].slice(0, 5000) }),
      removeSideExpense: (id) => set({ sideExpenses: get().sideExpenses.filter((x) => x.id !== id) }),
      setSideGoal: (sideGoalCents) => set({ sideGoalCents }),
      addNegotiation: (x) => set({ negotiations: [{ ...x, id: uuid() }, ...get().negotiations].slice(0, 500) }),
      updateNegotiation: (id, p) => set({ negotiations: get().negotiations.map((x) => (x.id === id ? { ...x, ...p } : x)) }),
      removeNegotiation: (id) => set({ negotiations: get().negotiations.filter((x) => x.id !== id) }),
      markReportChecked: (bureau, date) => set({ reportChecks: [...get().reportChecks, { bureau, date }].slice(-2000) }),
      addInquiry: (x) => set({ inquiries: [{ ...x, id: uuid() }, ...get().inquiries].slice(0, 200) }),
      removeInquiry: (id) => set({ inquiries: get().inquiries.filter((x) => x.id !== id) }),
      addDispute: (x) => set({ disputes: [{ ...x, id: uuid(), resolved: false }, ...get().disputes].slice(0, 200) }),
      resolveDispute: (id) => set({ disputes: get().disputes.map((x) => (x.id === id ? { ...x, resolved: true } : x)) }),
      removeDispute: (id) => set({ disputes: get().disputes.filter((x) => x.id !== id) }),
      addIou: (x) => set({ ious: [{ ...x, id: uuid(), settled: false }, ...get().ious].slice(0, 2000) }),
      settlePerson: (person) => set({ ious: get().ious.map((x) => (x.person === person ? { ...x, settled: true } : x)) }),
      removeIou: (id) => set({ ious: get().ious.filter((x) => x.id !== id) }),
      setHourly: (hourlyCents) => set({ hourlyCents }),
      addSideIncome: (x) => set({ sideIncome: [{ ...x, id: uuid() }, ...get().sideIncome].slice(0, 5000) }),
      removeSideIncome: (id) => set({ sideIncome: get().sideIncome.filter((x) => x.id !== id) }),
      addMileage: (x) => set({ mileage: [{ ...x, id: uuid() }, ...get().mileage].slice(0, 5000) }),
      removeMileage: (id) => set({ mileage: get().mileage.filter((x) => x.id !== id) }),
      setSideSetAsidePct: (sideSetAsidePct) => set({ sideSetAsidePct }),
      addYearly: (x) => set({ yearly: [...get().yearly, { ...x, id: uuid() }] }),
      updateYearly: (id, p) => set({ yearly: get().yearly.map((x) => (x.id === id ? { ...x, ...p } : x)) }),
      removeYearly: (id) => set({ yearly: get().yearly.filter((x) => x.id !== id) }),
      contribute: (goalId, amountCents, date) =>
        set({
          goals: get().goals.map((g) => (g.id === goalId ? { ...g, savedCents: Math.min(100_000_000, g.savedCents + amountCents) } : g)),
          contribs: [...get().contribs, { goalId, date, amountCents }].slice(-5000),
        }),
      markBillPaid: (id, month) => {
        const cur = get().billPaid[id] ?? [];
        if (!cur.includes(month)) set({ billPaid: { ...get().billPaid, [id]: [...cur, month].slice(-36) } });
      },
      restore: (b) =>
        set({
          rentSetup: b.data.rentSetup,
          payments: b.data.payments,
          bills: b.data.bills,
          billPaid: b.data.billPaid,
          takeHomeCents: b.data.takeHomeCents,
          waitlists: b.data.waitlists,
          pay: b.data.pay,
          debts: b.data.debts,
          goals: b.data.goals,
          unusedSubs: b.data.unusedSubs,
          creditDone: b.data.creditDone,
          emergencyCents: b.data.emergencyCents ?? null,
          splitPct: b.data.splitPct ?? { goals: 50, debt: 30 },
          sideIncome: b.data.sideIncome ?? [],
          mileage: b.data.mileage ?? [],
          sideSetAsidePct: b.data.sideSetAsidePct ?? 25,
          yearly: b.data.yearly ?? [],
          contribs: b.data.contribs ?? [],
          sideExpenses: b.data.sideExpenses ?? [],
          sideGoalCents: b.data.sideGoalCents ?? null,
          negotiations: b.data.negotiations ?? [],
          reportChecks: b.data.reportChecks ?? [],
          inquiries: b.data.inquiries ?? [],
          disputes: b.data.disputes ?? [],
          ious: b.data.ious ?? [],
          hourlyCents: b.data.hourlyCents ?? null,
          setupDone: true,
        }),
      clearAll: () => set(EMPTY),
    }),
    { name: "housing-compass-renter-local-only", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
