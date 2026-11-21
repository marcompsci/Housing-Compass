/** Monthly money report from the user's own records: rent, bills, spending, side income, savings. Shareable as text. */
import { monthRecap, monthReport, previousMonth } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { formStyles, today, usd } from "../components/forms";
import { Banner, Button, Chip, KV } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { space } from "../theme";

export default function MonthReportRoute() {
  return (
    <LockGate>
      <MonthReport />
    </LockGate>
  );
}

function MonthReport() {
  const { t } = useT();
  const r = useRenter();
  const td = today(now());
  const months = [previousMonth(td), td.slice(0, 7)];
  const [month, setMonth] = useState(months[0]!);
  const rep = monthReport({ month, payments: r.payments, billPaid: r.billPaid, bills: r.bills, spends: r.spends, side: r.sideIncome, contribs: r.contribs, debts: r.debts, debtPaid: r.debtPaid });
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="month-report">
      <Banner tone="info" icon="document-text-outline" title={t("mr.title", { month })}>
        {t("mr.intro")}
      </Banner>
      <View style={formStyles.row}>
        {months.map((m) => (
          <Chip key={m} label={m} selected={month === m} onPress={() => setMonth(m)} />
        ))}
      </View>
      <View style={formStyles.card} testID="mr-card">
        <KV k={t("yir.rent")} v={usd(rep.rentCents)} strong />
        {rep.lateFeesCents ? <KV k={t("yir.late")} v={usd(rep.lateFeesCents)} /> : null}
        <KV k={t("mr.bills")} v={t("mr.billsV", { n: rep.billsPaid, total: rep.billsTotal, amount: usd(rep.billsCents) })} />
        <KV k={t("mr.spent")} v={usd(rep.spentCents)} />
        {monthRecap(r.spends, month).top ? <KV k={t("mr.top")} v={t(`spc.${monthRecap(r.spends, month).top!}`)} /> : null}
        <KV k={t("yir.side")} v={usd(rep.sideCents)} />
        <KV k={t("yir.saved")} v={usd(rep.savedCents)} />
        {rep.debtPaidCents ? <KV k={t("mr.debt")} v={usd(rep.debtPaidCents)} /> : null}
      </View>
      <Button icon="share-outline" label={t("yir.share")} onPress={() => void saveAndShare(`money-${month}.txt`, rep.text, "text/plain", "public.plain-text")} testID="mr-share" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
