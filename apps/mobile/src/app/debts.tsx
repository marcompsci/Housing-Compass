/**
 * Debt payoff planner: list debts with balance, APR and minimum, add an extra monthly amount,
 * and compare avalanche (highest rate first, least interest) with snowball (smallest balance
 * first, quickest wins). Device-only. General information, not financial advice.
 */
import { monthlyInterest, strategyCompare, cardUtilization, debtProgress, extraPaymentImpact, paymentForMonths, payoffDates, payoffPlan, type Debt } from "@housing-compass/core";
import { now } from "../config";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section, Tag } from "../components/ui";
import { DebtTiming } from "../components/DebtTiming";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

export default function Debts() {
  return (
    <LockGate>
      <DebtsScreen />
    </LockGate>
  );
}

function DebtsScreen() {
  const { t } = useT();
  const debts = useRenter((s) => s.debts);
  const add = useRenter((s) => s.addDebt);
  const remove = useRenter((s) => s.removeDebt);
  const [name, setName] = useState("");
  const [bal, setBal] = useState("");
  const [apr, setApr] = useState("");
  const [min, setMin] = useState("");
  const [extra, setExtra] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [byMonths, setByMonths] = useState(24);
  const extraC = Math.max(0, toCents(extra) || 0);
  const av = debts.length ? payoffPlan(debts, extraC, "avalanche") : null;
  const sn = debts.length ? payoffPlan(debts, extraC, "snowball") : null;
  const nameOf = (id: string) => debts.find((d: Debt) => d.id === id)?.name ?? "";
  const months = (m: number) => (Number.isFinite(m) ? t("money.months", { n: m }) : t("money.never"));

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="debts">
      <Banner tone="info" icon="trending-down-outline" title={t("debt.title")}>
        {t("debt.intro")}
      </Banner>
      {debts.length && debtProgress(debts).paidCents > 0 ? (
        <View style={formStyles.card} testID="debt-progress">
          <Text style={type.h3}>{t("dp.title", { amount: usd(debtProgress(debts).paidCents), pct: debtProgress(debts).pct })}</Text>
          <View style={{ height: 10, borderRadius: 8, backgroundColor: color.neutralSoft, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${debtProgress(debts).pct}%`, backgroundColor: color.verified }} />
          </View>
          {debtProgress(debts).paidOff ? <Tag label={t("dp.paidOff", { n: debtProgress(debts).paidOff })} tone="good" /> : null}
        </View>
      ) : null}
      {debts.some((d) => d.balanceCents > 0) ? (
        <View style={[formStyles.card, { borderColor: color.warn }]} testID="debt-interest">
          <Text style={type.h3}>{t("mi.title", { amount: usd(monthlyInterest(debts).totalCents) })}</Text>
          {monthlyInterest(debts).rows.map((x) => (
            <KV key={x.id} k={x.name} v={t("mi.line", { amount: usd(x.cents) })} />
          ))}
        </View>
      ) : null}
      {debts.filter((d) => d.balanceCents > 0).length > 1 ? (
        (() => {
          const c = strategyCompare(debts, extraC);
          return (
            <View style={formStyles.card} testID="debt-strategy">
              <Text style={type.h3}>{t("sc2.title")}</Text>
              <KV k={t("sc2.avalanche")} v={c.avalanche.feasible ? t("sc2.line", { n: c.avalanche.months, amount: usd(c.avalanche.interestCents) }) : "—"} />
              <KV k={t("sc2.snowball")} v={c.snowball.feasible ? t("sc2.line", { n: c.snowball.months, amount: usd(c.snowball.interestCents) }) : "—"} />
              <Text style={type.small}>{c.interestDiffCents > 0 ? t("sc2.diff", { amount: usd(c.interestDiffCents), n: c.snowball.firstPayoffMonth ?? 0 }) : t("sc2.same")}</Text>
            </View>
          );
        })()
      ) : null}
      {cardUtilization(debts).rows.length ? (
        <Section title={t("cu.title")}>
          {(() => {
            const u = cardUtilization(debts);
            return (
              <View style={{ gap: 6 }} testID="card-util">
                <Text style={[type.body, { fontWeight: "800", color: (u.overallPct ?? 0) < 30 ? color.verified : color.danger }]}>{t("cu.overall", { pct: u.overallPct ?? 0 })}</Text>
                {u.rows.map((c) => (
                  <View key={c.id} style={{ gap: 2 }}>
                    <Text style={type.small}>{t("cu.card", { name: c.name, pct: c.pct, bal: usd(c.balanceCents), limit: usd(c.limitCents) })}</Text>
                    <Text style={type.tiny}>{c.payTo30Cents ? t("cu.pay30", { amount: usd(c.payTo30Cents) }) : t("cu.under30")}{c.payTo10Cents ? ` · ${t("cu.pay10", { amount: usd(c.payTo10Cents) })}` : ""}</Text>
                  </View>
                ))}
                <Text style={type.tiny}>{t("cu.note")}</Text>
              </View>
            );
          })()}
        </Section>
      ) : null}
      <Section title={t("debt.list")}>
        {debts.length === 0 ? <Text style={type.small}>{t("debt.none")}</Text> : null}
        {debts.map((d) => (
          <View key={d.id} style={styles.row} testID="debt-row">
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>
                {d.name} · {d.balanceCents === 0 ? `🎉 ${t("dp.done")}` : usd(d.balanceCents)}
              </Text>
              <Text style={type.tiny}>{t("debt.line", { apr: d.apr, min: usd(d.minPaymentCents) })}</Text>
              <DebtTiming debt={d} />
            </View>
            <Pressable onPress={() => remove(d.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: d.name })} hitSlop={10}>
              <Icon name="trash-outline" tint={color.muted} />
            </Pressable>
          </View>
        ))}
      </Section>
      <Section title={t("debt.add")}>
        <Field label={t("debt.name")} value={name} onChangeText={setName} placeholder={t("debt.namePh")} testID="debt-name" />
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("debt.balance")} value={bal} onChangeText={setBal} keyboardType="decimal-pad" testID="debt-balance" />
          </View>
          <View style={{ flex: 1, minWidth: 90 }}>
            <Field label={t("debt.apr")} value={apr} onChangeText={setApr} keyboardType="decimal-pad" testID="debt-apr" />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("debt.min")} value={min} onChangeText={setMin} keyboardType="decimal-pad" testID="debt-min" />
          </View>
        </View>
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="add-circle-outline"
          label={t("debt.addBtn")}
          testID="debt-add"
          onPress={() => {
            const d = { name: name.trim().slice(0, 60), balanceCents: toCents(bal), apr: Number(apr), minPaymentCents: toCents(min) };
            if (d.name.length < 2 || !(d.balanceCents > 0) || !(d.apr >= 0 && d.apr <= 100) || !(d.minPaymentCents > 0)) return setErr(t("debt.err"));
            add(d);
            setName("");
            setBal("");
            setApr("");
            setMin("");
            setErr(null);
          }}
        />
      </Section>
      {av && sn ? (
        <Section title={t("debt.compare")}>
          <Field label={t("debt.extra")} value={extra} onChangeText={setExtra} keyboardType="decimal-pad" hint={t("debt.extraHint")} testID="debt-extra" />
          {(() => {
            const imp = extraC > 0 ? extraPaymentImpact(debts, extraC) : null;
            if (!imp) return null;
            return (
              <View style={[formStyles.card, { backgroundColor: color.verifiedSoft }]} testID="debt-whatif">
                <Text style={[type.small, { fontWeight: "800" }]}>{t("wi.title", { amount: usd(extraC) })}</Text>
                {imp.becomesFeasible ? <Text style={type.small}>{t("wi.feasible", { n: imp.newMonths })}</Text> : imp.monthsSaved !== null ? <Text style={type.small}>{t("wi.saves", { months: imp.monthsSaved, amount: usd(imp.interestSavedCents ?? 0) })}</Text> : <Text style={type.small}>{t("wi.still")}</Text>}
              </View>
            );
          })()}
          <View style={formStyles.row}>
            {[
              { k: "avalanche", p: av, title: t("debt.avalanche"), why: t("debt.avalancheWhy") },
              { k: "snowball", p: sn, title: t("debt.snowball"), why: t("debt.snowballWhy") },
            ].map((x) => (
              <View key={x.k} style={[formStyles.card, { flex: 1, minWidth: 220 }]} testID={`plan-${x.k}`}>
                <Text style={type.h3}>{x.title}</Text>
                <Text style={type.tiny}>{x.why}</Text>
                <KV k={t("debt.free")} v={months(x.p.months)} strong />
                <KV k={t("debt.interest")} v={x.p.feasible ? usd(x.p.totalInterestCents) : "—"} />
                <Text style={type.small}>{t("debt.order", { list: x.p.order.map(nameOf).join(" → ") })}</Text>
              </View>
            ))}
          </View>
          {av.feasible ? (
            <View style={formStyles.card} testID="payoff-dates">
              <Text style={type.h3}>{t("debt.datesTitle")}</Text>
              {payoffDates(debts, av, now()).map((d) => (
                <KV key={d.id} k={d.name} v={d.month ?? "—"} />
              ))}
            </View>
          ) : null}
          {av.feasible && sn.feasible && sn.totalInterestCents > av.totalInterestCents ? <Tag label={t("debt.saves", { amount: usd(sn.totalInterestCents - av.totalInterestCents) })} tone="good" /> : null}
          {!av.feasible ? <Text style={[type.small, { color: color.danger, fontWeight: "700" }]}>{t("debt.infeasible")}</Text> : null}
        </Section>
      ) : null}
      {debts.length ? (
        <Section title={t("pf.title")}>
          <Text style={type.small}>{t("pf.body")}</Text>
          <View style={formStyles.row}>
            {[12, 24, 36].map((m) => (
              <Chip key={m} label={t("money.months", { n: m })} selected={byMonths === m} onPress={() => setByMonths(m)} />
            ))}
          </View>
          <View testID="payoff-by">
            {debts.map((d) => {
              const p = paymentForMonths(d.balanceCents, d.apr, byMonths);
              return <KV key={d.id} k={d.name} v={t("pf.line", { amount: usd(p.perMonthCents), interest: usd(p.totalInterestCents) })} />;
            })}
            <KV k={t("pf.total")} v={usd(debts.reduce((s, d) => s + paymentForMonths(d.balanceCents, d.apr, byMonths).perMonthCents, 0))} strong />
          </View>
        </Section>
      ) : null}
      <Text style={type.tiny}>{t("debt.footer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
