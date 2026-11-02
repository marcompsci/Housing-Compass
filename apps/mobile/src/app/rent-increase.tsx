/**
 * Rent increase checker: compares a rent-increase notice with California's statewide cap
 * (5% + regional CPI change, at most 10% in 12 months) and the notice period (30 days, or
 * 90 days for more than 10%). Many homes are exempt and local rules can be stricter, so it
 * always points to the local office. General information, not legal advice.
 */
import { NOTICE_SOURCE, RENT_CAP_SOURCE, rentIncreaseCheck } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents } from "../components/forms";
import { Banner, Button, KV } from "../components/ui";
import { useT } from "../i18n";
import { openExternal } from "../lib/links";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export default function RentIncrease() {
  const { t } = useT();
  const rent = useRenter((s) => s.rentSetup);
  const [cur, setCur] = useState(rent ? String(rent.amountCents / 100) : "");
  const [next, setNext] = useState("");
  const [cpi, setCpi] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [effective, setEffective] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ReturnType<typeof rentIncreaseCheck> | null>(null);

  const check = () => {
    const c = toCents(cur);
    const nw = toCents(next);
    const cp = Number(cpi.replace("%", ""));
    if (!(c > 0) || !(nw > 0)) return setErr(t("inc.errRent"));
    if (!Number.isFinite(cp) || cpi.trim() === "") return setErr(t("inc.errCpi"));
    if ((noticeDate && !isDate(noticeDate)) || (effective && !isDate(effective))) return setErr(t("move.errDate"));
    setErr(null);
    setRes(rentIncreaseCheck({ currentRentCents: c, newRentCents: nw, cpiPercent: cp, noticeDate: noticeDate || null, effectiveDate: effective || null }));
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="rent-increase">
      <Banner tone="info" icon="trending-up-outline" title={t("inc.title")}>
        {t("inc.intro")}
      </Banner>
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("inc.current")} value={cur} onChangeText={setCur} keyboardType="decimal-pad" testID="inc-current" />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("inc.new")} value={next} onChangeText={setNext} keyboardType="decimal-pad" testID="inc-new" />
        </View>
      </View>
      <Field label={t("inc.cpi")} value={cpi} onChangeText={setCpi} keyboardType="decimal-pad" hint={t("inc.cpiHint")} testID="inc-cpi" />
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("inc.noticeDate")} value={noticeDate} onChangeText={setNoticeDate} autoCapitalize="none" placeholder="2026-11-01" testID="inc-notice" />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("inc.effective")} value={effective} onChangeText={setEffective} autoCapitalize="none" placeholder="2026-12-01" testID="inc-effective" />
        </View>
      </View>
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Button icon="calculator-outline" label={t("inc.check")} onPress={check} testID="inc-check" />

      {res ? (
        <View style={[formStyles.card, (res.overCap || res.noticeShort) && { borderColor: color.danger, backgroundColor: color.dangerSoft }]} testID="inc-result">
          <KV k={t("inc.increase")} v={`${res.increasePct}%`} strong />
          <KV k={t("inc.cap")} v={`${res.capPct}%`} />
          <Text style={[type.body, { fontWeight: "700", color: res.overCap ? color.danger : color.verified }]}>{res.overCap ? t("inc.over") : t("inc.within")}</Text>
          <KV k={t("inc.noticeNeeded")} v={t("inc.days", { n: res.noticeDaysRequired })} />
          {res.noticeDaysGiven !== null ? <KV k={t("inc.noticeGiven")} v={t("inc.days", { n: res.noticeDaysGiven })} /> : null}
          {res.noticeShort ? <Text style={[type.body, { fontWeight: "700", color: color.danger }]}>{t("inc.short")}</Text> : null}
          <Text style={type.small}>{res.overCap || res.noticeShort ? t("inc.whatNext") : t("inc.exemptions")}</Text>
        </View>
      ) : null}

      <Button kind="secondary" icon="business-outline" label={t("help.localHelp")} onPress={() => router.push("/local-help")} />
      <Button kind="ghost" icon="book-outline" label={`${RENT_CAP_SOURCE.label} ↗`} onPress={() => openExternal(RENT_CAP_SOURCE.url)} />
      <Button kind="ghost" icon="book-outline" label={`${NOTICE_SOURCE.label} ↗`} onPress={() => openExternal(NOTICE_SOURCE.url)} />
      <Text style={type.tiny}>{t("move.footer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
});
