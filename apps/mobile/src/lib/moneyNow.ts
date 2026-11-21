/** Shared "right now" numbers for the money screens: obligations, next payday, safe to spend and the forecast. */
import { applyPartials, debtObligations, cashFlowForecast, paydays, safeToSpend, upcomingObligations } from "@housing-compass/core";
import { today } from "../components/forms";
import { now } from "../config";
import { useRenter } from "../state/renter";

export function useMoneyNow() {
  const r = useRenter();
  const n = now();
  const from = today(n);
  const obligations = applyPartials([...upcomingObligations({ rent: r.rentSetup, rentPayments: r.payments, bills: r.bills, billPaid: r.billPaid, from, days: 45 }), ...debtObligations(r.debts, r.debtPaid, from, 45)], r.billPartial).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextPay = r.pay ? (paydays(r.pay, from, 45).find((d) => d > from) ?? null) : null;
  const sts = r.startBalanceCents !== null ? safeToSpend({ balanceCents: r.startBalanceCents, obligations, nextPayday: nextPay, today: from }) : null;
  const fc = r.startBalanceCents !== null ? cashFlowForecast(r.startBalanceCents, r.pay, obligations, from, 30) : null;
  return { from, obligations, nextPay, sts, fc };
}
