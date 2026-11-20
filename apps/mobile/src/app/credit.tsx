/**
 * Credit builder: a utilization calculator (balances aren't saved), the statement-date tip,
 * and a checklist of steps that help a credit score, with official links. General information.
 */
import { CREDIT_CHECKLIST, utilization, type CreditStep } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, Icon, KV, Section } from "../components/ui";
import { useT } from "../i18n";
import { openExternal } from "../lib/links";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

type Row = { name: string; bal: string; lim: string };

export default function Credit() {
  const { t } = useT();
  const done = useRenter((s) => s.creditDone);
  const toggle = useRenter((s) => s.toggleCreditStep);
  const [rows, setRows] = useState<Row[]>([{ name: "", bal: "", lim: "" }]);
  const cards = rows.map((r, i) => ({ name: r.name || `#${i + 1}`, balanceCents: toCents(r.bal) || 0, limitCents: toCents(r.lim) || 0 }));
  const u = utilization(cards);
  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const link: Partial<Record<CreditStep, () => void>> = {
    reports: () => openExternal("https://www.annualcreditreport.com"),
    rent_reporting: () => router.push("/rights?topic=rent_reporting"),
    dispute_errors: () => openExternal("https://consumer.ftc.gov/disputing-errors-your-credit-reports"),
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="credit">
      <Banner tone="info" icon="speedometer-outline" title={t("cr.title")}>
        {t("cr.intro")}
      </Banner>
      <Section title={t("cr.utilTitle")}>
        <Text style={type.small}>{t("cr.utilBody")}</Text>
        {rows.map((r, i) => (
          <View key={i} style={formStyles.row}>
            <View style={{ flex: 1, minWidth: 100 }}>
              <Field label={t("cr.card")} value={r.name} onChangeText={(v) => set(i, "name", v)} />
            </View>
            <View style={{ flex: 1, minWidth: 100 }}>
              <Field label={t("cr.balance")} value={r.bal} onChangeText={(v) => set(i, "bal", v)} keyboardType="decimal-pad" testID={`card-bal-${i}`} />
            </View>
            <View style={{ flex: 1, minWidth: 100 }}>
              <Field label={t("cr.limit")} value={r.lim} onChangeText={(v) => set(i, "lim", v)} keyboardType="decimal-pad" testID={`card-lim-${i}`} />
            </View>
          </View>
        ))}
        <Button kind="ghost" icon="add-outline" label={t("cr.addCard")} onPress={() => setRows([...rows, { name: "", bal: "", lim: "" }])} />
        {u.overall !== null ? (
          <View style={formStyles.card} testID="util-result">
            <KV k={t("cr.overall")} v={`${Math.round(u.overall * 100)}%`} strong />
            <Text style={[type.small, { fontWeight: "700", color: u.band === "excellent" || u.band === "good" ? color.verified : color.danger }]}>{t(`cr.band.${u.band!}`)}</Text>
            {u.payDownTo30Cents > 0 ? <KV k={t("cr.to30")} v={usd(u.payDownTo30Cents)} /> : null}
            {u.payDownTo10Cents > 0 ? <KV k={t("cr.to10")} v={usd(u.payDownTo10Cents)} /> : null}
            {u.perCard.filter((c) => c.ratio >= 0.3).map((c) => (
              <Text key={c.name} style={type.tiny}>
                {t("cr.cardHigh", { name: c.name, pct: Math.round(c.ratio * 100) })}
              </Text>
            ))}
          </View>
        ) : null}
        <Text style={type.tiny}>{t("cr.notSaved")}</Text>
      </Section>

      <Section title={t("cr.statementTitle")}>
        <Text style={type.small}>{t("cr.statementBody")}</Text>
      </Section>

      <Section title={t("cr.checklist")}>
        {CREDIT_CHECKLIST.map((s) => {
          const on = done.includes(s);
          return (
            <View key={s} style={styles.row}>
              <Pressable onPress={() => toggle(s)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={t(`cr.s.${s}`)} hitSlop={8} testID={`credit-step-${s}`}>
                <Icon name={on ? "checkmark-circle" : "ellipse-outline"} size={24} tint={on ? color.verified : color.muted} />
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.h3, on && { color: color.muted }]}>{t(`cr.s.${s}`)}</Text>
                <Text style={type.tiny}>{t(`cr.d.${s}`)}</Text>
              </View>
              {link[s] ? (
                <Pressable onPress={link[s]} accessibilityRole="link" accessibilityLabel={t("cr.open")} hitSlop={8}>
                  <Icon name="open-outline" tint={color.brand} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <Text style={type.small}>{t("cr.progress", { n: done.length, total: CREDIT_CHECKLIST.length })}</Text>
      </Section>
      <Text style={type.tiny}>{t("cr.footer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
