/** Backup & restore for renter tools: a JSON file the user saves or sends to themselves. Nothing goes to our servers. */
import { type RenterBackup } from "@housing-compass/core";
import { useRenter } from "../state/renter";
import { saveAndShare } from "./files";

export function makeBackup(now: Date): RenterBackup {
  const r = useRenter.getState();
  return {
    app: "housing-compass",
    kind: "renter-backup",
    version: 1,
    createdAt: now.toISOString(),
    data: {
      rentSetup: r.rentSetup,
      payments: r.payments,
      bills: r.bills,
      billPaid: r.billPaid,
      takeHomeCents: r.takeHomeCents,
      waitlists: r.waitlists,
      pay: r.pay,
      debts: r.debts,
      goals: r.goals,
      unusedSubs: r.unusedSubs,
      creditDone: r.creditDone,
      emergencyCents: r.emergencyCents,
      splitPct: r.splitPct,
      sideIncome: r.sideIncome,
      mileage: r.mileage,
      sideSetAsidePct: r.sideSetAsidePct,
      yearly: r.yearly,
      contribs: r.contribs,
      sideExpenses: r.sideExpenses,
      sideGoalCents: r.sideGoalCents,
      negotiations: r.negotiations,
      reportChecks: r.reportChecks,
      inquiries: r.inquiries,
      disputes: r.disputes,
      ious: r.ious,
      hourlyCents: r.hourlyCents,
    },
  };
}

export async function shareBackup(now: Date) {
  return saveAndShare(`housing-compass-backup-${now.toISOString().slice(0, 10)}.json`, JSON.stringify(makeBackup(now), null, 2), "application/json", "public.json");
}
