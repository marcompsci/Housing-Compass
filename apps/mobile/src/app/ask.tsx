/**
 * Ask: a money assistant that answers short questions ("can I afford $40?", "what's due this
 * week?", "¿cuándo me pagan?") from the user's own data on this phone. Rules-based — no AI
 * service, nothing is sent anywhere.
 */
import { askExamples, monthCashFlow, monthRecap as monthRecap2, rule503020, biggestCosts, coverage, detectCategory, findByName, goalPlan, iouBalances, payPriority, allPaidStreak, emergencyFund, estimatedTaxDates, findBillByName, FOLLOW_UPS, sideGoalProgress, sideProfit, trialStatus, canAfford, cardUtilization, goalEta, monthRecap, netWorthNow, parseAsk, payoffPlan, purchaseImpact, scoreTrend, weekAhead, weekSpending, type AskIntent } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Share, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, today, usd } from "../components/forms";
import { Banner, Button, Chip } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useMoneyNow } from "../lib/moneyNow";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

type Turn = { q: string; a: string; intent?: AskIntent; link?: { label: string; href: string } };

export default function AskRoute() {
  return (
    <LockGate>
      <Ask />
    </LockGate>
  );
}

function Ask() {
  const { t } = useT();
  const r = useRenter();
  const m = useMoneyNow();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const td = today(now());
  const examples = [t("ask.ex.due"), ...askExamples(td, 7).filter((i) => i !== "due").slice(0, 5).map((i) => t(`ask.q.${i as "safe"}`))];

  const answer = (text: string): Turn => {
    const parsed = parseAsk(text);
    const { amountCents } = parsed;
    const bill = findBillByName(text, r.bills);
    if (bill && (parsed.intent === "unknown" || parsed.intent === "due" || parsed.intent === "budget")) {
      const paid = (r.billPaid[bill.id] ?? []).includes(td.slice(0, 7));
      return { q: text, intent: "due", a: t("ask.a.bill", { name: bill.name, amount: usd(bill.amountCents), day: bill.dueDay, status: paid ? t("ask.a.billPaid") : t("ask.a.billUnpaid") }), link: { label: t("plan.toolBills"), href: "/bills" } };
    }
    const goal = findByName(text, r.goals);
    if (goal && (parsed.intent === "save" || parsed.intent === "unknown")) {
      const gp = goalPlan(goal, now(), r.pay);
      const eta = goalEta(goal, r.contribs, td);
      return { q: text, intent: "save", a: t("ask.a.goal", { name: goal.name, saved: usd(goal.savedCents), target: usd(goal.targetCents), pct: Math.round(gp.progress * 100) }) + (eta.eta && eta.weeks ? ` ${t("eta.line", { amount: usd(eta.perWeekCents), date: eta.eta })}` : ""), link: { label: t("money.goals"), href: "/goals" } };
    }
    const intent = parsed.intent;
    const need = { a: t("today.needBalance"), link: { label: t("money.paycheck"), href: "/paycheck" } };
    const by: Record<AskIntent, () => Omit<Turn, "q">> = {
      afford: () => {
        if (!amountCents) return { a: t("ask.a.affordNeedAmount") };
        if (!m.sts || !m.fc) return need;
        const v = canAfford({ priceCents: amountCents, safeCents: m.sts.safeCents, series: m.fc.series, nextPayday: m.nextPay });
        const firstGoal = r.goals[0];
        const pace = firstGoal ? goalEta(firstGoal, r.contribs, td).perWeekCents : null;
        const imp = purchaseImpact({ priceCents: amountCents, hourlyCents: r.hourlyCents, goalPerWeekCents: pace });
        const extra = [imp.hours !== null ? t("ask.a.hours", { n: imp.hours }) : "", imp.goalDelayWeeks !== null && firstGoal ? t("ask.a.delay", { n: imp.goalDelayWeeks, goal: firstGoal.name }) : ""].filter(Boolean).join(" ");
        const base = v.verdict === "wait" ? t("aff.waitBody", { date: v.waitUntil ?? "" }) : t(`aff.b.${v.verdict}`, { left: usd(Math.abs(v.leftCents)) });
        return { a: `${t(`aff.v.${v.verdict}`)}. ${base}${extra ? ` ${extra}` : ""}`, link: { label: t("aff.title"), href: "/afford" } };
      },
      due: () => {
        const w = weekAhead(m.obligations, m.from);
        return w.items.length ? { a: t("ask.a.due", { n: w.items.length, amount: usd(w.totalCents), list: w.items.map((o) => `${o.name} (${o.dueDate.slice(5)})`).join(", ") }), link: { label: t("plan.toolBills"), href: "/bills" } } : { a: t("today.weekClear") };
      },
      safe: () => (m.sts ? { a: m.sts.shortCents ? t("today.short", { date: m.sts.until }) : t("ask.a.safe", { amount: usd(m.sts.safeCents), date: m.sts.until, day: usd(m.sts.perDayCents) }) } : need),
      payday: () => (r.pay ? { a: m.nextPay ? t("ask.a.payday", { date: m.nextPay }) : t("ask.a.noPayday") } : { a: t("ask.a.noPay"), link: { label: t("money.paycheck"), href: "/paycheck" } }),
      debt: () => {
        if (!r.debts.length) return { a: t("ask.a.noDebt") };
        const total = r.debts.reduce((s, d) => s + d.balanceCents, 0);
        const p = payoffPlan(r.debts, 0, "avalanche");
        return { a: p.feasible ? t("ask.a.debt", { amount: usd(total), n: p.months, interest: usd(p.totalInterestCents) }) : t("ask.a.debtStuck", { amount: usd(total) }), link: { label: t("money.debts"), href: "/debts" } };
      },
      budget: () => {
        const w = weekSpending(r.spends, r.weeklyLimitCents, td);
        const mr = monthRecap(r.spends, td.slice(0, 7));
        return { a: t("ask.a.budget", { week: usd(w.spentCents), month: usd(mr.totalCents) }) + (w.leftCents !== null ? ` ${w.over ? t("sp.over", { amount: usd(-w.leftCents) }) : t("sp.left", { amount: usd(w.leftCents) })}.` : ""), link: { label: t("sp.title"), href: "/spending" } };
      },
      net_worth: () => {
        const nw = netWorthNow({ otherAssetsCents: r.otherAssetsCents, emergencyCents: r.emergencyCents, goals: r.goals, balanceCents: r.startBalanceCents, debts: r.debts });
        return { a: t("ask.a.netWorth", { amount: usd(nw.netCents) }), link: { label: t("nw.title"), href: "/net-worth" } };
      },
      credit: () => {
        const u = cardUtilization(r.debts);
        const s = scoreTrend(r.scores).latest;
        const parts = [u.overallPct !== null ? t("cu.overall", { pct: u.overallPct }) : t("ask.a.noLimits"), s ? t("ask.a.score", { score: s.score, source: s.source, date: s.date }) : ""].filter(Boolean);
        return { a: parts.join(" "), link: { label: t("ct.title"), href: "/credit-tools" } };
      },
      save: () => {
        if (!r.goals.length) return { a: t("ru.noGoal"), link: { label: t("money.goals"), href: "/goals" } };
        const saved = r.goals.reduce((s, g) => s + g.savedCents, 0);
        const target = r.goals.reduce((s, g) => s + g.targetCents, 0);
        return { a: t("ask.a.save", { saved: usd(saved), target: usd(target), n: r.goals.length }), link: { label: t("money.goals"), href: "/goals" } };
      },
      rent: () => {
        if (!r.rentSetup) return { a: t("ask.a.noRent"), link: { label: t("rent.setupTitle"), href: "/rent" } };
        const next = m.obligations.find((o) => o.kind === "rent");
        return { a: next ? t("ask.a.rent", { amount: usd(next.amountCents), date: next.dueDate }) : t("ask.a.rentPaid", { amount: usd(r.rentSetup.amountCents) }), link: { label: t("rent.setupTitle"), href: "/rent" } };
      },
      side: () => {
        const p = sideProfit({ income: r.sideIncome, miles: r.mileage, expenses: r.sideExpenses, setAsidePct: r.sideSetAsidePct, now: now() });
        const g = sideGoalProgress(r.sideIncome, r.sideGoalCents, now());
        return { a: t("ask.a.side", { month: usd(g.earnedCents), year: usd(p.grossCents), setAside: usd(p.setAsideCents) }), link: { label: t("side.title"), href: "/side-income" } };
      },
      tax: () => {
        const y = Number(td.slice(0, 4));
        const next = [...estimatedTaxDates(y - 1), ...estimatedTaxDates(y), ...estimatedTaxDates(y + 1)].find((d) => d.due >= td);
        const p = sideProfit({ income: r.sideIncome, miles: r.mileage, expenses: r.sideExpenses, setAsidePct: r.sideSetAsidePct, now: now() });
        return { a: t("ask.a.tax", { date: next?.due ?? "", amount: usd(p.setAsideCents) }), link: { label: t("side.title"), href: "/side-income" } };
      },
      subs: () => {
        const subs = r.bills.filter((b) => b.category === "subscription");
        const monthly = subs.reduce((s, b) => s + b.amountCents, 0);
        return subs.length ? { a: t("ask.a.subs", { n: subs.length, amount: usd(monthly), year: usd(monthly * 12) }), link: { label: t("plan.toolBills"), href: "/bills" } } : { a: t("ask.a.noSubs") };
      },
      trials: () => {
        const s = trialStatus(r.trials, td);
        const next = s.rows.find((x) => !x.canceled && x.daysLeft >= 0);
        return { a: next ? t("ask.a.trial", { name: next.name, date: next.endsOn, amount: usd(next.costCents) }) : t("ask.a.noTrials"), link: { label: t("tr.title"), href: "/trials" } };
      },
      emergency: () => {
        const essentials = (r.rentSetup?.amountCents ?? 0) + r.bills.reduce((s, b) => s + b.amountCents, 0);
        const ef = emergencyFund(r.emergencyCents ?? 0, essentials);
        return { a: ef.months === null ? t("ask.a.noEssentials") : t("ask.a.emergency", { amount: usd(r.emergencyCents ?? 0), months: Math.round(ef.months * 10) / 10 }), link: { label: t("money.title"), href: "/money" } };
      },
      overview: () => {
        const parts = [
          m.sts ? (m.sts.shortCents ? t("today.short", { date: m.sts.until }) : t("ask.a.safe", { amount: usd(m.sts.safeCents), date: m.sts.until, day: usd(m.sts.perDayCents) })) : "",
          (() => {
            const w = weekAhead(m.obligations, m.from);
            return w.items.length ? t("ask.a.due", { n: w.items.length, amount: usd(w.totalCents), list: w.items.slice(0, 3).map((o) => o.name).join(", ") }) : t("today.weekClear");
          })(),
          allPaidStreak(r.bills, r.billPaid, now()) ? t("today.allPaid", { n: allPaidStreak(r.bills, r.billPaid, now()) }) + "." : "",
        ].filter(Boolean);
        return { a: parts.join(" ") };
      },
      category: () => {
        const c = detectCategory(text);
        const month = td.slice(0, 7);
        const sum = (cat: string | null) => r.spends.filter((s) => s.date.startsWith(month) && (cat === null || (s.category ?? "other") === cat)).reduce((x, s) => x + s.amountCents, 0);
        return c ? { a: t("ask.a.category", { cat: t(`spc.${c}`), amount: usd(sum(c)) }), link: { label: t("sp.title"), href: "/spending" } } : { a: t("ask.a.budget", { week: usd(weekSpending(r.spends, r.weeklyLimitCents, td).spentCents), month: usd(sum(null)) }), link: { label: t("sp.title"), href: "/spending" } };
      },
      roommates: () => {
        const b = iouBalances(r.ious);
        return b.people.length ? { a: b.people.map((p) => (p.cents > 0 ? t("rm.owesYou", { name: p.person, amount: usd(p.cents) }) : t("rm.youOwe", { name: p.person, amount: usd(-p.cents) }))).join(". ") + ".", link: { label: t("rm.title"), href: "/roommates" } } : { a: t("rm.even") };
      },
      lease: () => {
        if (!r.leaseEnd) return { a: t("ask.a.noLease"), link: { label: t("le.title"), href: "/rent" } };
        const d = Math.round((Date.parse(`${r.leaseEnd}T12:00:00Z`) - Date.parse(`${td}T12:00:00Z`)) / 86_400_000);
        return { a: d >= 0 ? t("le.days", { n: d, date: r.leaseEnd }) : t("le.past", { date: r.leaseEnd }), link: { label: t("le.title"), href: "/rent" } };
      },
      pay_first: () => {
        const until = m.sts?.until ?? m.nextPay ?? td;
        const order = payPriority(m.obligations.filter((o) => o.dueDate <= until || o.dueDate <= m.from), r.bills);
        if (!order.length) return { a: t("ask.a.nothingDue") };
        const cov = coverage(order, r.startBalanceCents ?? 0);
        return { a: t("ask.a.payFirst", { list: cov.slice(0, 5).map((o, i) => `${i + 1}. ${o.name} ${usd(o.amountCents)}${o.covered || r.startBalanceCents === null ? "" : ` (${t("pf3.short")})`}`).join("; ") }), link: { label: t("money.title"), href: "/money" } };
      },
      biggest: () => {
        const b = biggestCosts({ rentCents: r.rentSetup?.amountCents ?? null, bills: r.bills, debts: r.debts });
        return b.rows.length ? { a: t("ask.a.biggest", { list: b.rows.slice(0, 3).map((x) => `${x.name === "Rent" ? t("bills.rent") : x.name} ${usd(x.cents)}`).join(", "), total: usd(b.totalCents) }), link: { label: t("plan.toolBills"), href: "/bills" } } : { a: t("ask.a.noCosts") };
      },
      due_today: () => {
        const items = m.obligations.filter((o) => o.dueDate === m.from);
        return items.length ? { a: t("ask.a.dueDay", { when: t("today.today"), list: items.map((o) => `${o.name} ${usd(o.amountCents)}`).join(", ") }), link: { label: t("plan.toolBills"), href: "/bills" } } : { a: t("ask.a.nothingDay", { when: t("today.today") }) };
      },
      due_tomorrow: () => {
        const tm = new Date(Date.parse(`${m.from}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
        const items = m.obligations.filter((o) => o.dueDate === tm);
        return items.length ? { a: t("ask.a.dueDay", { when: t("ask.tomorrow"), list: items.map((o) => `${o.name} ${usd(o.amountCents)}`).join(", ") }), link: { label: t("plan.toolBills"), href: "/bills" } } : { a: t("ask.a.nothingDay", { when: t("ask.tomorrow") }) };
      },
      income: () => {
        const f = monthCashFlow({ month: td.slice(0, 7), pay: r.pay, other: r.otherIncome, side: r.sideIncome, rent: r.rentSetup, bills: r.bills, debts: r.debts, spends: r.spends });
        return r.pay || f.inCents ? { a: t("ask.a.income", { pay: usd(f.payCents), side: usd(f.sideCents), other: usd(f.otherCents), total: usd(f.inCents) }), link: { label: t("money.paycheck"), href: "/paycheck" } } : { a: t("ask.a.noPay"), link: { label: t("money.paycheck"), href: "/paycheck" } };
      },
      saved_month: () => {
        const saved = r.contribs.filter((c) => c.date.startsWith(td.slice(0, 7))).reduce((s, c) => s + c.amountCents, 0);
        return { a: t("ask.a.savedMonth", { amount: usd(saved) }), link: { label: t("money.goals"), href: "/goals" } };
      },
      changed: () => {
        const rc = monthRecap2(r.spends, td.slice(0, 7));
        return { a: rc.lastTotalCents || rc.totalCents ? t("ask.a.changed", { now: usd(rc.totalCents), last: usd(rc.lastTotalCents), diff: `${rc.changeCents >= 0 ? "+" : "-"}${usd(Math.abs(rc.changeCents))}` }) : t("ask.a.noSpends"), link: { label: t("sp.title"), href: "/spending" } };
      },
      rule_503020: () => {
        const month = td.slice(0, 7);
        const f = monthCashFlow({ month, pay: r.pay, other: r.otherIncome, side: r.sideIncome, rent: r.rentSetup, bills: r.bills, debts: r.debts, spends: r.spends });
        const rr = rule503020({ incomeCents: f.inCents, month, rent: r.rentSetup, bills: r.bills, debts: r.debts, spends: r.spends, contribs: r.contribs });
        return rr ? { a: t("ask.a.r5", { needs: rr.needsPct, wants: rr.wantsPct, savings: rr.savingsPct }), link: { label: t("money.title"), href: "/money" } } : { a: t("ask.a.noPay"), link: { label: t("money.paycheck"), href: "/paycheck" } };
      },
      unknown: () => ({ a: t("ask.a.unknown") }),
    };
    return { q: text, intent, ...by[intent]() };
  };

  const submit = (text: string) => {
    if (!text.trim()) return;
    setTurns([answer(text.trim()), ...turns].slice(0, 20));
    r.addAskHistory(text.trim());
    setQ("");
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="ask" keyboardShouldPersistTaps="handled">
      <Banner tone="info" icon="chatbubbles-outline" title={t("ask.title")}>
        {t("ask.intro")}
      </Banner>
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Field label={t("ask.label")} value={q} onChangeText={setQ} placeholder={t("ask.ph")} onSubmitEditing={() => submit(q)} returnKeyType="send" testID="ask-input" />
        </View>
        <Button icon="send-outline" label={t("ask.send")} onPress={() => submit(q)} testID="ask-send" />
      </View>
      <View style={formStyles.row}>
        {examples.map((e) => (
          <Chip key={e} label={e} onPress={() => submit(e)} />
        ))}
      </View>
      {r.askHistory.length && !turns.length ? (
        <View style={{ gap: 6 }} testID="ask-history">
          <Text style={[type.small, { fontWeight: "700" }]}>{t("ask.recent")}</Text>
          <View style={formStyles.row}>
            {r.askHistory.slice(0, 5).map((h) => (
              <Chip key={h} label={h} onPress={() => submit(h)} />
            ))}
          </View>
        </View>
      ) : null}
      {turns.map((x, i) => (
        <View key={turns.length - i} style={{ gap: 6 }} testID="ask-turn">
          <View style={[styles.bubble, styles.me]}>
            <Text style={[type.body, { color: "#fff" }]}>{x.q}</Text>
          </View>
          <View style={[styles.bubble, styles.app]}>
            <Text style={type.body} testID="ask-answer" selectable>
              {x.a}
            </Text>
            {Platform.OS !== "web" ? <Button kind="ghost" icon="share-outline" label={t("ask.share")} onPress={() => void Share.share({ message: `${x.q}\n${x.a}` })} /> : null}
            {x.link ? <Button kind="ghost" icon="arrow-forward-outline" label={x.link.label} onPress={() => router.push(x.link!.href as never)} /> : null}
            {i === 0 && x.intent && FOLLOW_UPS[x.intent]?.length ? (
              <View style={formStyles.row} testID="ask-followups">
                {FOLLOW_UPS[x.intent]!.map((f) => (
                  <Chip key={f} label={t(`ask.q.${f as "safe"}`)} onPress={() => submit(t(`ask.q.${f as "safe"}`))} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ))}
      <Text style={type.tiny}>{t("ask.note")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  bubble: { padding: 12, borderRadius: radius.lg, maxWidth: "88%" },
  me: { alignSelf: "flex-end", backgroundColor: color.brand },
  app: { alignSelf: "flex-start", backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
});
