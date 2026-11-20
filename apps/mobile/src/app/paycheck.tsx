/**
 * Paycheck planner: enter how often you're paid and how much, and see which paycheck has to
 * cover rent and each bill (and how much to set aside), plus a 30-day balance forecast.
 */
import { cashFlowForecast, leftoverSplit, monthlyIncomeCents, paycheckPlan, upcomingObligations } from "@housing-compass/core";
import { PaySetupForm } from "../components/PaySetupForm";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, KV, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { askReminderPermission, remindersSupported } from "../lib/reminders";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

export default function Paycheck() {
  return (
    <LockGate>
      <PaycheckScreen />
    </LockGate>
  );
}

function PaycheckScreen() {
  const { t } = useT();
  const r = useRenter();
  const n = now();
  const from = today(n);
  const [editing, setEditing] = useState(!r.pay);
  const [bal, setBal] = useState(r.startBalanceCents !== null ? String(r.startBalanceCents / 100) : "");
  const [remMsg, setRemMsg] = useState<string | null>(null);
  const obligations = upcomingObligations({ rent: r.rentSetup, rentPayments: r.payments, bills: r.bills, billPaid: r.billPaid, from, days: 45 });
  const plan = r.pay ? paycheckPlan(r.pay, obligations, from) : null;
  const fc = r.startBalanceCents !== null ? cashFlowForecast(r.startBalanceCents, r.pay, obligations, from, 30) : null;
  const maxAbs = fc ? Math.max(1, ...fc.series.map((d) => Math.abs(d.balanceCents))) : 1;

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="paycheck">
      <Banner tone="info" icon="wallet-outline" title={t("pay.title")}>
        {t("pay.intro")}
      </Banner>
      {editing || !r.pay ? (
        <Section title={t("pay.setupTitle")}>
          <PaySetupForm onSaved={() => setEditing(false)} />
        </Section>
      ) : (
        <View style={formStyles.row}>
          <Tag label={`${t(`pay.f.${r.pay.frequency}`)} · ${usd(r.pay.amountCents)}`} tone="good" />
          <Tag label={t("pay.monthly", { amount: usd(monthlyIncomeCents(r.pay)) })} />
          <Button kind="ghost" label={t("pay.edit")} onPress={() => setEditing(true)} />
        </View>
      )}

      {plan ? (
        <Section title={t("pay.planTitle")}>
          {plan.dueBeforeFirstPay.length ? (
            <Text style={[type.small, { color: color.danger, fontWeight: "700" }]}>
              {t("pay.beforeFirst", { list: plan.dueBeforeFirstPay.map((o) => `${o.name} ${usd(o.amountCents)} (${o.dueDate})`).join(", ") })}
            </Text>
          ) : null}
          {plan.buckets.map((b) => (
            <View key={b.payday} style={[formStyles.card, b.leftCents < 0 && { borderColor: color.danger }]} testID="pay-bucket">
              <View style={formStyles.row}>
                <Text style={[type.h3, { flex: 1 }]}>{t("pay.check", { date: b.payday, amount: usd(b.incomeCents) })}</Text>
                {b.leftCents < 0 ? <Tag label={t("pay.short")} tone="warn" /> : null}
              </View>
              {b.covers.length === 0 ? <Text style={type.small}>{t("pay.nothingDue")}</Text> : null}
              {b.covers.map((o) => (
                <KV key={o.id} k={`${o.kind === "rent" ? t("bills.rent") : o.name} · ${o.dueDate}`} v={usd(o.amountCents)} />
              ))}
              <KV k={t("pay.setAsideK")} v={usd(b.setAsideCents)} strong />
              <KV k={t("pay.leftK")} v={usd(b.leftCents)} />
              {b.leftCents > 0 ? (
                (() => {
                  const sp = leftoverSplit(b.leftCents, r.splitPct);
                  return <Text style={type.tiny}>{t("split2.line", { goals: usd(sp.goalsCents), debt: usd(sp.debtCents), buffer: usd(sp.bufferCents) })}</Text>;
                })()
              ) : null}
            </View>
          ))}
          <View style={formStyles.card} testID="split-pct">
            <Text style={type.h3}>{t("split2.title")}</Text>
            <Text style={type.tiny}>{t("split2.body")}</Text>
            <View style={formStyles.row}>
              {[
                [50, 30],
                [30, 30],
                [20, 50],
                [0, 0],
              ].map(([g, d]) => (
                <Chip key={`${g}-${d}`} label={g || d ? t("split2.opt", { goals: g!, debt: d! }) : t("split2.none")} selected={r.splitPct.goals === g && r.splitPct.debt === d} onPress={() => r.setSplitPct({ goals: g!, debt: d! })} />
              ))}
            </View>
          </View>
          <Button
            kind={r.remindersOn ? "secondary" : "primary"}
            icon="notifications-outline"
            label={r.remindersOn ? t("pay.remOn") : t("pay.remTurnOn")}
            onPress={async () => {
              if (r.remindersOn) return;
              if (!remindersSupported) return setRemMsg(t("rent.remWeb"));
              const ok = await askReminderPermission();
              r.setRemindersOn(ok);
              setRemMsg(ok ? t("rent.remOn") : t("rent.remDenied"));
            }}
          />
          {remMsg ? <Text style={type.tiny}>{remMsg}</Text> : null}
        </Section>
      ) : null}

      <Section title={t("pay.forecastTitle")}>
        <Field label={t("pay.balance")} value={bal} onChangeText={setBal} keyboardType="numbers-and-punctuation" hint={t("pay.balanceHint")} testID="start-balance" />
        <Button
          kind="secondary"
          label={t("pay.forecast")}
          testID="forecast-btn"
          onPress={() => {
            const c = toCents(bal.replace(/^-/, ""));
            r.setStartBalance(Number.isFinite(c) ? (bal.trim().startsWith("-") ? -c : c) : null);
          }}
        />
        {fc ? (
          <View style={{ gap: 6 }} testID="forecast">
            <KV k={t("money.lowest")} v={`${usd(fc.lowest.balanceCents)} · ${fc.lowest.date}`} strong />
            <KV k={t("pay.end")} v={usd(fc.endBalanceCents)} />
            {fc.goesNegative ? <Text style={[type.small, { color: color.danger, fontWeight: "700" }]}>{t("money.negativeWarn", { date: fc.lowest.date })}</Text> : <Text style={[type.small, { color: color.verified }]}>{t("pay.staysPositive")}</Text>}
            <View style={styles.chart} accessibilityLabel={t("pay.chartLabel")}>
              {fc.series.map((d) => (
                <View key={d.date} style={styles.barSlot}>
                  <View style={[styles.bar, { height: `${Math.max(2, (Math.abs(d.balanceCents) / maxAbs) * 100)}%`, backgroundColor: d.balanceCents < 0 ? color.danger : color.brand }]} />
                </View>
              ))}
            </View>
            <Text style={type.tiny}>{t("pay.chartNote")}</Text>
          </View>
        ) : null}
      </Section>
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 90, gap: 1, backgroundColor: color.neutralSoft, borderRadius: radius.md, padding: 4 },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 2 },
});
