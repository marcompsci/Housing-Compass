/**
 * Ask: a money assistant that answers short questions ("can I afford $40?", "what's due this
 * week?", "¿cuándo me pagan?") from the user's own data on this phone. Rules-based — no AI
 * service, nothing is sent anywhere.
 */
import { canAfford, cardUtilization, goalEta, monthRecap, netWorthNow, parseAsk, payoffPlan, purchaseImpact, scoreTrend, weekAhead, weekSpending, type AskIntent } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, today, usd } from "../components/forms";
import { Banner, Button, Chip } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useMoneyNow } from "../lib/moneyNow";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

type Turn = { q: string; a: string; link?: { label: string; href: string } };

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
  const examples = [t("ask.ex.due"), t("ask.ex.afford"), t("ask.ex.safe"), t("ask.ex.debt"), t("ask.ex.payday"), t("ask.ex.credit")];

  const answer = (text: string): Turn => {
    const { intent, amountCents } = parseAsk(text);
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
      unknown: () => ({ a: t("ask.a.unknown") }),
    };
    return { q: text, ...by[intent]() };
  };

  const submit = (text: string) => {
    if (!text.trim()) return;
    setTurns([answer(text.trim()), ...turns].slice(0, 20));
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
      {turns.map((x, i) => (
        <View key={turns.length - i} style={{ gap: 6 }} testID="ask-turn">
          <View style={[styles.bubble, styles.me]}>
            <Text style={[type.body, { color: "#fff" }]}>{x.q}</Text>
          </View>
          <View style={[styles.bubble, styles.app]}>
            <Text style={type.body} testID="ask-answer">
              {x.a}
            </Text>
            {x.link ? <Button kind="ghost" icon="arrow-forward-outline" label={x.link.label} onPress={() => router.push(x.link!.href as never)} /> : null}
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
