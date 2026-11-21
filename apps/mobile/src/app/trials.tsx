/**
 * Free trials and returns: remember when a free trial turns into a charge and the last day to
 * return something, with reminders in My plan. Device-only.
 */
import { returnStatus, trialStatus } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, KV, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export default function TrialsRoute() {
  return (
    <LockGate>
      <Trials />
    </LockGate>
  );
}

function Trials() {
  const { t } = useT();
  const r = useRenter();
  const td = today(now());
  const ts = trialStatus(r.trials, td);
  const rs = returnStatus(r.returns, td);
  const [name, setName] = useState("");
  const [ends, setEnds] = useState("");
  const [cost, setCost] = useState("");
  const [cycle, setCycle] = useState<"month" | "year">("month");
  const [item, setItem] = useState("");
  const [store, setStore] = useState("");
  const [amt, setAmt] = useState("");
  const [by, setBy] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="trials">
      <Banner tone="info" icon="hourglass-outline" title={t("tr.title")}>
        {t("tr.intro")}
      </Banner>

      <Section title={t("tr.trials")}>
        {ts.active ? <Text style={[type.body, { fontWeight: "800" }]} testID="tr-cost">{t("tr.wouldCost", { amount: usd(ts.wouldCostYearCents), n: ts.active })}</Text> : null}
        {ts.savedYearCents ? <Text style={[type.small, { color: color.verified }]}>{t("tr.saved", { amount: usd(ts.savedYearCents) })}</Text> : null}
        {ts.rows.map((x) => (
          <View key={x.id} style={formStyles.card} testID="tr-row">
            <View style={formStyles.row}>
              <Text style={[type.h3, { flex: 1 }]}>{x.name}</Text>
              <Tag label={x.canceled ? t("tr.canceled") : x.daysLeft < 0 ? t("tr.ended") : t("tr.daysLeft", { n: x.daysLeft })} tone={x.canceled ? "good" : x.daysLeft <= 2 ? "warn" : "neutral"} />
            </View>
            <KV k={t("tr.endsOn")} v={x.endsOn} />
            <KV k={t("tr.then")} v={`${usd(x.costCents)}/${t(x.cycle === "month" ? "tr.mo" : "tr.yr")}`} />
            <View style={formStyles.row}>
              {!x.canceled ? <Button kind="secondary" label={t("tr.cancelDone")} onPress={() => r.cancelTrial(x.id)} testID="tr-cancel" /> : null}
              <Button kind="ghost" label={t("ct.remove")} onPress={() => r.removeTrial(x.id)} />
            </View>
          </View>
        ))}
        <Field label={t("tr.name")} value={name} onChangeText={setName} testID="tr-name" />
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("tr.endsField")} value={ends} onChangeText={setEnds} autoCapitalize="none" placeholder="2026-12-01" testID="tr-ends" />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("tr.costField")} value={cost} onChangeText={setCost} keyboardType="decimal-pad" testID="tr-cost-input" />
          </View>
        </View>
        <View style={formStyles.row}>
          <Chip label={t("tr.monthly")} selected={cycle === "month"} onPress={() => setCycle("month")} />
          <Chip label={t("tr.yearly")} selected={cycle === "year"} onPress={() => setCycle("year")} />
        </View>
        <Button
          icon="add-circle-outline"
          label={t("tr.add")}
          testID="tr-add"
          onPress={() => {
            const c = toCents(cost);
            if (name.trim().length < 2 || !isDate(ends) || !(c >= 0)) return setErr(t("tr.err"));
            r.addTrial({ name: name.trim().slice(0, 60), endsOn: ends, costCents: c, cycle });
            setName("");
            setEnds("");
            setCost("");
            setErr(null);
          }}
        />
      </Section>

      <Section title={t("tr.returns")}>
        {rs.openCents ? <Text style={[type.body, { fontWeight: "800" }]} testID="rt-open">{t("tr.openReturns", { amount: usd(rs.openCents) })}</Text> : null}
        {rs.recoveredCents ? <Text style={[type.small, { color: color.verified }]}>{t("tr.recovered", { amount: usd(rs.recoveredCents) })}</Text> : null}
        {rs.rows.map((x) => (
          <View key={x.id} style={formStyles.card} testID="rt-row">
            <View style={formStyles.row}>
              <Text style={[type.h3, { flex: 1 }]}>
                {x.item}
                {x.store ? ` · ${x.store}` : ""}
              </Text>
              <Tag label={x.returned ? t("tr.returned") : x.daysLeft < 0 ? t("tr.ended") : t("tr.daysLeft", { n: x.daysLeft })} tone={x.returned ? "good" : x.daysLeft <= 2 ? "warn" : "neutral"} />
            </View>
            <KV k={t("tr.returnBy")} v={`${x.returnBy} · ${usd(x.amountCents)}`} />
            <View style={formStyles.row}>
              {!x.returned ? <Button kind="secondary" label={t("tr.markReturned")} onPress={() => r.markReturned(x.id)} testID="rt-done" /> : null}
              <Button kind="ghost" label={t("ct.remove")} onPress={() => r.removeReturn(x.id)} />
            </View>
          </View>
        ))}
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("tr.item")} value={item} onChangeText={setItem} testID="rt-item" />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("tr.store")} value={store} onChangeText={setStore} testID="rt-store" />
          </View>
        </View>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("side.amount")} value={amt} onChangeText={setAmt} keyboardType="decimal-pad" testID="rt-amount" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("tr.returnByField")} value={by} onChangeText={setBy} autoCapitalize="none" placeholder="2026-12-15" testID="rt-by" />
          </View>
        </View>
        <Button
          icon="add-circle-outline"
          label={t("tr.addReturn")}
          testID="rt-add"
          onPress={() => {
            const c = toCents(amt);
            if (item.trim().length < 2 || !isDate(by) || !(c >= 0)) return setErr(t("tr.err"));
            r.addReturn({ item: item.trim().slice(0, 60), store: store.trim().slice(0, 60), amountCents: c, returnBy: by });
            setItem("");
            setStore("");
            setAmt("");
            setBy("");
            setErr(null);
          }}
        />
      </Section>
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
