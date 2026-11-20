/**
 * Debt payoff planner: list debts with balance, APR and minimum, add an extra monthly amount,
 * and compare avalanche (highest rate first, least interest) with snowball (smallest balance
 * first, quickest wins). Device-only. General information, not financial advice.
 */
import { payoffPlan, type Debt } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, Icon, KV, Section, Tag } from "../components/ui";
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
      <Section title={t("debt.list")}>
        {debts.length === 0 ? <Text style={type.small}>{t("debt.none")}</Text> : null}
        {debts.map((d) => (
          <View key={d.id} style={styles.row} testID="debt-row">
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>
                {d.name} · {usd(d.balanceCents)}
              </Text>
              <Text style={type.tiny}>{t("debt.line", { apr: d.apr, min: usd(d.minPaymentCents) })}</Text>
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
          {av.feasible && sn.feasible && sn.totalInterestCents > av.totalInterestCents ? <Tag label={t("debt.saves", { amount: usd(sn.totalInterestCents - av.totalInterestCents) })} tone="good" /> : null}
          {!av.feasible ? <Text style={[type.small, { color: color.danger, fontWeight: "700" }]}>{t("debt.infeasible")}</Text> : null}
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
