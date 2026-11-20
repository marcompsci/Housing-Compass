/**
 * Yearly and irregular costs (sinking funds): car registration, renters insurance, a
 * subscription billed once a year. Spreads each into a monthly amount so it never lands as a
 * surprise. Device-only.
 */
import { yearlyPlan } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export default function YearlyRoute() {
  return (
    <LockGate>
      <YearlyScreen />
    </LockGate>
  );
}

function YearlyScreen() {
  const { t } = useT();
  const r = useRenter();
  const plan = yearlyPlan(r.yearly, now());
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [saved, setSaved] = useState("");
  const [add, setAdd] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const presets = [t("yr.p.reg"), t("yr.p.ins"), t("yr.p.gifts"), t("yr.p.sub")];
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="yearly">
      <Banner tone="info" icon="file-tray-stacked-outline" title={t("yr.title")}>
        {t("yr.intro")}
      </Banner>
      {plan.rows.length ? (
        <View style={[formStyles.card, { backgroundColor: color.brandSoft }]} testID="yearly-total">
          <Text style={type.tiny}>{t("yr.monthly")}</Text>
          <Text style={type.title}>{usd(plan.monthlyTotalCents)}</Text>
        </View>
      ) : null}
      {plan.rows.map((x) => (
        <View key={x.id} style={[formStyles.card, x.overdue && { borderColor: color.danger }]} testID="yearly-card">
          <View style={formStyles.row}>
            <Text style={[type.h3, { flex: 1 }]}>{x.name}</Text>
            <Pressable onPress={() => r.removeYearly(x.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: x.name })} hitSlop={10}>
              <Icon name="trash-outline" tint={color.muted} />
            </Pressable>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, Math.round((x.savedCents / Math.max(1, x.amountCents)) * 100))}%` }]} />
          </View>
          <KV k={t("goal.saved")} v={`${usd(x.savedCents)} / ${usd(x.amountCents)}`} strong />
          <KV k={t("yr.due")} v={x.nextDue} />
          {x.ready ? <Text style={[type.small, { color: color.verified, fontWeight: "700" }]}>{t("yr.ready")}</Text> : <KV k={t("goal.perMonth")} v={usd(x.perMonthCents)} />}
          {x.overdue ? <Text style={[type.small, { color: color.danger, fontWeight: "700" }]}>{t("yr.overdue")}</Text> : null}
          <View style={formStyles.row}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Field label={t("goal.add")} value={add[x.id] ?? ""} onChangeText={(v) => setAdd({ ...add, [x.id]: v })} keyboardType="decimal-pad" testID="yearly-add-amount" />
            </View>
            <Button
              kind="secondary"
              label={t("goal.addBtn")}
              testID="yearly-add-btn"
              onPress={() => {
                const c = toCents(add[x.id] ?? "");
                if (c > 0) r.updateYearly(x.id, { savedCents: Math.min(x.amountCents, x.savedCents + c) });
                setAdd({ ...add, [x.id]: "" });
              }}
            />
          </View>
          {x.ready || x.overdue ? (
            <Button
              kind="ghost"
              icon="refresh-outline"
              label={t("yr.paid")}
              testID="yearly-paid"
              onPress={() => {
                const d = new Date(`${x.nextDue}T12:00:00Z`);
                d.setUTCFullYear(d.getUTCFullYear() + 1);
                r.updateYearly(x.id, { savedCents: 0, nextDue: d.toISOString().slice(0, 10) });
              }}
            />
          ) : null}
        </View>
      ))}
      <Section title={t("yr.new")}>
        <View style={formStyles.row}>
          {presets.map((p) => (
            <Chip key={p} label={p} selected={name === p} onPress={() => setName(p)} />
          ))}
        </View>
        <Field label={t("goal.name")} value={name} onChangeText={setName} testID="yearly-name" />
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("yr.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="yearly-amount" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("yr.nextDue")} value={due} onChangeText={setDue} autoCapitalize="none" placeholder="2027-05-20" testID="yearly-due" />
          </View>
        </View>
        <Field label={t("goal.already")} value={saved} onChangeText={setSaved} keyboardType="decimal-pad" testID="yearly-saved" />
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="add-circle-outline"
          label={t("yr.create")}
          testID="yearly-create"
          onPress={() => {
            const a = toCents(amount);
            const sc = saved.trim() ? toCents(saved) : 0;
            if (name.trim().length < 2 || !(a > 0) || !(sc >= 0) || !isDate(due)) return setErr(t("yr.err"));
            r.addYearly({ name: name.trim().slice(0, 60), amountCents: a, nextDue: due, savedCents: Math.min(sc, a) });
            setName("");
            setAmount("");
            setDue("");
            setSaved("");
            setErr(null);
          }}
        />
      </Section>
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  track: { height: 10, borderRadius: radius.md, backgroundColor: color.neutralSoft, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: color.verified },
});
