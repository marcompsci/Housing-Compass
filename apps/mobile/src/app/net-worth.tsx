/**
 * Net worth: what you have (cash you entered, emergency fund, goal savings, anything else you
 * add) minus what you owe, saved once a month so you can watch it grow. Device-only.
 */
import { netWorthHistory, netWorthNow } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, KV, Section } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

export default function NetWorthRoute() {
  return (
    <LockGate>
      <NetWorth />
    </LockGate>
  );
}

function NetWorth() {
  const { t } = useT();
  const r = useRenter();
  const nw = netWorthNow({ otherAssetsCents: r.otherAssetsCents, emergencyCents: r.emergencyCents, goals: r.goals, balanceCents: r.startBalanceCents, debts: r.debts });
  const h = netWorthHistory(r.netWorth);
  const [other, setOther] = useState(r.otherAssetsCents ? String(r.otherAssetsCents / 100) : "");
  const month = today(now()).slice(0, 7);
  const span = Math.max(1, ...h.rows.map((x) => Math.abs(x.netCents)));
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="net-worth">
      <Banner tone="info" icon="trending-up-outline" title={t("nw.title")}>
        {t("nw.intro")}
      </Banner>
      <View style={[formStyles.card, { backgroundColor: nw.netCents >= 0 ? color.verifiedSoft : color.warnSoft }]} testID="nw-now">
        <Text style={type.tiny}>{t("nw.now")}</Text>
        <Text style={type.title}>{usd(nw.netCents)}</Text>
        <KV k={t("nw.cash")} v={usd(nw.parts.cash)} />
        <KV k={t("nw.emergency")} v={usd(nw.parts.emergency)} />
        <KV k={t("nw.goals")} v={usd(nw.parts.goals)} />
        <KV k={t("nw.other")} v={usd(nw.parts.other)} />
        <KV k={t("nw.debts")} v={`-${usd(nw.debtsCents)}`} strong />
      </View>
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Field label={t("nw.otherField")} value={other} onChangeText={setOther} keyboardType="decimal-pad" hint={t("nw.otherHint")} testID="nw-other" />
        </View>
        <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => r.setOtherAssets(toCents(other) > 0 ? toCents(other) : null)} testID="nw-other-save" />
      </View>
      <Button icon="save-outline" label={t("nw.save", { month })} onPress={() => r.saveNetWorth({ month, assetsCents: nw.assetsCents, debtsCents: nw.debtsCents })} testID="nw-save" />

      {h.rows.length ? (
        <Section title={t("nw.history")}>
          {h.changeCents !== null ? <Text style={[type.body, { fontWeight: "800", color: h.changeCents >= 0 ? color.verified : color.danger }]} testID="nw-change">{t("nw.change", { amount: `${h.changeCents >= 0 ? "+" : ""}${usd(h.changeCents)}` })}</Text> : null}
          {[...h.rows].reverse().slice(0, 24).map((x) => (
            <View key={x.month} style={styles.row} testID="nw-row">
              <Text style={[type.small, { width: 64 }]}>{x.month}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round((Math.abs(x.netCents) / span) * 100)}%`, backgroundColor: x.netCents >= 0 ? color.verified : color.danger }]} />
              </View>
              <Text style={[type.small, { fontWeight: "700", width: 90, textAlign: "right" }]}>{usd(x.netCents)}</Text>
            </View>
          ))}
        </Section>
      ) : null}
      <Text style={type.tiny}>{t("nw.note")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  track: { flex: 1, height: 10, borderRadius: radius.md, backgroundColor: color.neutralSoft, overflow: "hidden" },
  fill: { height: "100%" },
});
