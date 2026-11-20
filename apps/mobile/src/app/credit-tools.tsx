/**
 * Credit tracker: when each free weekly credit report can be checked again, hard inquiries and
 * when they stop counting, and disputes with the bureau's 30-day response date. Device-only.
 */
import { BUREAUS, disputeStatus, FREE_REPORT_URL, inquiryStatus, reportCheckStatus, type Bureau } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, today } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { openExternal } from "../lib/links";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const FTC_DISPUTE = "https://consumer.ftc.gov/disputing-errors-your-credit-reports";

export default function CreditToolsRoute() {
  return (
    <LockGate>
      <CreditTools />
    </LockGate>
  );
}

function CreditTools() {
  const { t } = useT();
  const r = useRenter();
  const td = today(now());
  const reports = reportCheckStatus(r.reportChecks, td);
  const inq = inquiryStatus(r.inquiries, td);
  const disputes = disputeStatus(r.disputes, td);
  const [lender, setLender] = useState("");
  const [qDate, setQDate] = useState(td);
  const [item, setItem] = useState("");
  const [bureau, setBureau] = useState<Bureau>("equifax");
  const [sent, setSent] = useState(td);
  const [err, setErr] = useState<string | null>(null);
  const bn = (b: Bureau) => t(`ct.b.${b}`);
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="credit-tools">
      <Banner tone="info" icon="shield-checkmark-outline" title={t("ct.title")}>
        {t("ct.intro")}
      </Banner>

      <Section title={t("ct.reports")}>
        <Text style={type.small}>{t("ct.reportsBody")}</Text>
        {reports.map((x) => (
          <View key={x.bureau} style={styles.row} testID="report-row">
            <Icon name={x.canCheck ? "ellipse-outline" : "checkmark-circle"} size={20} tint={x.canCheck ? color.muted : color.verified} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{bn(x.bureau)}</Text>
              <Text style={type.tiny}>{x.last ? (x.canCheck ? t("ct.lastCanCheck", { date: x.last }) : t("ct.next", { date: x.next })) : t("ct.never")}</Text>
            </View>
            <Button kind="secondary" label={t("ct.checked")} onPress={() => r.markReportChecked(x.bureau, td)} testID={`report-${x.bureau}`} />
          </View>
        ))}
        <Button kind="ghost" icon="open-outline" label="AnnualCreditReport.com ↗" onPress={() => openExternal(FREE_REPORT_URL)} />
        <Text style={type.tiny}>{t("ct.onlyOfficial")}</Text>
      </Section>

      <Section title={t("ct.inq")}>
        <Text style={type.small}>{t("ct.inqBody")}</Text>
        {inq.rows.length ? <KV k={t("ct.inqCounting")} v={String(inq.countingNow)} strong /> : null}
        {inq.rows.map((q) => (
          <View key={q.id} style={styles.row} testID="inquiry-row">
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{q.lender}</Text>
              <Text style={type.tiny}>{q.counts ? t("ct.inqCounts", { date: q.scoreUntil, off: q.reportUntil }) : q.onReport ? t("ct.inqNoCount", { off: q.reportUntil }) : t("ct.inqGone")}</Text>
            </View>
            <Pressable onPress={() => r.removeInquiry(q.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: q.lender })} hitSlop={10}>
              <Icon name="trash-outline" size={18} tint={color.muted} />
            </Pressable>
          </View>
        ))}
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("ct.lender")} value={lender} onChangeText={setLender} testID="inq-lender" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("side.date")} value={qDate} onChangeText={setQDate} autoCapitalize="none" testID="inq-date" />
          </View>
        </View>
        <Button
          kind="secondary"
          icon="add-circle-outline"
          label={t("ct.addInq")}
          testID="inq-add"
          onPress={() => {
            if (lender.trim().length < 2 || !isDate(qDate)) return setErr(t("ct.err"));
            r.addInquiry({ lender: lender.trim().slice(0, 60), date: qDate });
            setLender("");
            setErr(null);
          }}
        />
      </Section>

      <Section title={t("ct.disputes")}>
        <Text style={type.small}>{t("ct.disputesBody")}</Text>
        {disputes.map((d) => (
          <View key={d.id} style={[formStyles.card, d.late && { borderColor: color.danger }]} testID="dispute-row">
            <View style={formStyles.row}>
              <Text style={[type.h3, { flex: 1 }]}>{d.item}</Text>
              <Tag label={d.resolved ? t("ct.resolved") : d.late ? t("ct.late") : t("ct.open")} tone={d.resolved ? "good" : d.late ? "warn" : "neutral"} />
            </View>
            <Text style={type.tiny}>{t("ct.disputeLine", { bureau: bn(d.bureau), sent: d.sentOn, due: d.responseDue })}</Text>
            {d.late ? <Text style={[type.small, { color: color.danger }]}>{t("ct.lateBody")}</Text> : null}
            <View style={formStyles.row}>
              {!d.resolved ? <Button kind="secondary" label={t("ct.markResolved")} onPress={() => r.resolveDispute(d.id)} testID="dispute-resolve" /> : null}
              <Button kind="ghost" label={t("ct.remove")} onPress={() => r.removeDispute(d.id)} />
            </View>
          </View>
        ))}
        <View style={formStyles.row}>
          {BUREAUS.map((b) => (
            <Chip key={b} label={bn(b)} selected={bureau === b} onPress={() => setBureau(b)} />
          ))}
        </View>
        <Field label={t("ct.item")} value={item} onChangeText={setItem} placeholder={t("ct.itemPh")} testID="dispute-item" />
        <Field label={t("ct.sentOn")} value={sent} onChangeText={setSent} autoCapitalize="none" testID="dispute-sent" />
        <Button
          kind="secondary"
          icon="add-circle-outline"
          label={t("ct.addDispute")}
          testID="dispute-add"
          onPress={() => {
            if (item.trim().length < 2 || !isDate(sent)) return setErr(t("ct.err"));
            r.addDispute({ bureau, item: item.trim().slice(0, 120), sentOn: sent });
            setItem("");
            setErr(null);
          }}
        />
        <Button kind="ghost" icon="open-outline" label={t("ct.ftc")} onPress={() => openExternal(FTC_DISPUTE)} />
      </Section>
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
