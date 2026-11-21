/**
 * Windfall planner: a tax refund, bonus or gift split in a sensible order — anything overdue,
 * a one-month emergency cushion, the highest-rate debt, goals — with some kept for you.
 */
import { billStatuses, goalPlan, windfallPlan } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, Chip, KV, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { space, type } from "../theme";

export default function WindfallRoute() {
  return (
    <LockGate>
      <Windfall />
    </LockGate>
  );
}

function Windfall() {
  const { t } = useT();
  const r = useRenter();
  const [amount, setAmount] = useState("");
  const [fun, setFun] = useState(10);
  const [shown, setShown] = useState(false);
  const n = now();
  const overdue = billStatuses(r.bills, r.billPaid, n).filter((b) => b.state === "overdue").reduce((s, b) => s + b.bill.amountCents, 0);
  const essentials = (r.rentSetup?.amountCents ?? 0) + r.bills.reduce((s, b) => s + b.amountCents, 0);
  const goalsLeft = r.goals.reduce((s, g) => s + goalPlan(g, n, r.pay).remainingCents, 0);
  const c = toCents(amount);
  const plan = c > 0 ? windfallPlan({ amountCents: c, overdueCents: overdue, emergencyCents: r.emergencyCents ?? 0, monthlyEssentialsCents: essentials, debts: r.debts, goalsLeftCents: goalsLeft, funPct: fun }) : null;
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="windfall">
      <Banner tone="info" icon="sparkles-outline" title={t("wf.title")}>
        {t("wf.intro")}
      </Banner>
      <Field label={t("wf.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="wf-amount" />
      <Text style={[type.small, { fontWeight: "700" }]}>{t("wf.fun")}</Text>
      <View style={formStyles.row}>
        {[0, 10, 20].map((p) => (
          <Chip key={p} label={`${p}%`} selected={fun === p} onPress={() => setFun(p)} />
        ))}
      </View>
      <Button icon="git-branch-outline" label={t("wf.plan")} onPress={() => setShown(true)} testID="wf-plan" />
      {shown && plan ? (
        <View style={formStyles.card} testID="wf-result">
          {plan.rows.map((row) => (
            <KV key={row.id} k={row.id === "debt" ? t("wf.r.debt", { name: (row as { name?: string | null }).name ?? "" }) : t(`wf.r.${row.id as "overdue" | "emergency" | "goals" | "fun"}`)} v={usd(row.cents)} strong={row.id !== "fun"} />
          ))}
          <Text style={type.tiny}>{t("wf.why")}</Text>
        </View>
      ) : null}
      <View style={formStyles.row}>
        <Tag label={t("money.notAdvice")} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
