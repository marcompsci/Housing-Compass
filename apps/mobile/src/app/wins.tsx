/**
 * Bill wins: log each call or chat asking a company for a lower rate, a waived fee or a credit,
 * and see what asking has saved — plus subscriptions you marked to cancel. Device-only.
 */
import { savingsWon, type Negotiation } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

const RESULTS: Negotiation["result"][] = ["lower", "credit", "no", "pending"];

export default function WinsRoute() {
  return (
    <LockGate>
      <Wins />
    </LockGate>
  );
}

function Wins() {
  const { t } = useT();
  const r = useRenter();
  const w = savingsWon(r.negotiations, r.bills, r.unusedSubs);
  const [company, setCompany] = useState("");
  const [ask, setAsk] = useState("");
  const [result, setResult] = useState<Negotiation["result"]>("lower");
  const [monthly, setMonthly] = useState("");
  const [once, setOnce] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const companies = [...new Set(r.bills.map((b) => b.name))].slice(0, 8);
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="wins">
      <Banner tone="info" icon="trophy-outline" title={t("win.title")}>
        {t("win.intro")}
      </Banner>
      <View style={styles.tiles} testID="wins-summary">
        <View style={styles.tile}>
          <Text style={type.tiny}>{t("win.next12")}</Text>
          <Text style={type.h2} testID="wins-year">{usd(w.nextYearCents)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={type.tiny}>{t("win.monthly")}</Text>
          <Text style={type.h2}>{usd(w.monthlyCents + w.subsMonthlyCents)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={type.tiny}>{t("win.rate")}</Text>
          <Text style={type.h2}>{w.asked ? `${w.wins}/${w.asked}` : "—"}</Text>
        </View>
      </View>
      {w.subsMonthlyCents ? <KV k={t("win.subs")} v={`${usd(w.subsMonthlyCents)}/mo`} /> : null}
      <Button kind="secondary" icon="bulb-outline" label={t("win.scripts")} onPress={() => router.push("/bills")} />

      {r.negotiations.map((n) => (
        <View key={n.id} style={formStyles.card} testID="win-card">
          <View style={formStyles.row}>
            <Text style={[type.h3, { flex: 1 }]}>{n.company}</Text>
            <Tag label={t(`win.r.${n.result}`)} tone={n.result === "lower" || n.result === "credit" ? "good" : n.result === "no" ? "neutral" : "warn"} />
            <Pressable onPress={() => r.removeNegotiation(n.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: n.company })} hitSlop={10}>
              <Icon name="trash-outline" size={18} tint={color.muted} />
            </Pressable>
          </View>
          <Text style={type.tiny}>
            {n.date}
            {n.ask ? ` · ${n.ask}` : ""}
          </Text>
          {n.monthlySavingsCents ? <KV k={t("win.saves")} v={`${usd(n.monthlySavingsCents)}/mo`} /> : null}
          {n.oneTimeCents ? <KV k={t("win.credit")} v={usd(n.oneTimeCents)} /> : null}
          {n.result === "pending" ? (
            <View style={formStyles.row}>
              <Button kind="secondary" label={t("win.r.lower")} onPress={() => r.updateNegotiation(n.id, { result: "lower" })} />
              <Button kind="ghost" label={t("win.r.no")} onPress={() => r.updateNegotiation(n.id, { result: "no" })} />
            </View>
          ) : null}
        </View>
      ))}

      <Section title={t("win.log")}>
        {companies.length ? (
          <View style={formStyles.row}>
            {companies.map((c) => (
              <Chip key={c} label={c} selected={company === c} onPress={() => setCompany(c)} />
            ))}
          </View>
        ) : null}
        <Field label={t("win.company")} value={company} onChangeText={setCompany} testID="win-company" />
        <Field label={t("win.ask")} value={ask} onChangeText={setAsk} placeholder={t("win.askPh")} testID="win-ask" />
        <View style={formStyles.row}>
          {RESULTS.map((x) => (
            <Chip key={x} label={t(`win.r.${x}`)} selected={result === x} onPress={() => setResult(x)} />
          ))}
        </View>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("win.monthlyField")} value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" testID="win-monthly" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("win.onceField")} value={once} onChangeText={setOnce} keyboardType="decimal-pad" testID="win-once" />
          </View>
        </View>
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="add-circle-outline"
          label={t("win.add")}
          testID="win-add"
          onPress={() => {
            const m = monthly.trim() ? toCents(monthly) : 0;
            const o = once.trim() ? toCents(once) : 0;
            if (company.trim().length < 2 || !(m >= 0) || !(o >= 0)) return setErr(t("win.err"));
            r.addNegotiation({ date: today(now()), company: company.trim().slice(0, 60), ask: ask.trim().slice(0, 120), result, monthlySavingsCents: m, oneTimeCents: o });
            setAsk("");
            setMonthly("");
            setOnce("");
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
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: 140, padding: 12, borderRadius: radius.md, backgroundColor: color.verifiedSoft, gap: 2 },
});
