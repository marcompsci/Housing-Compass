/**
 * Year in review: rent paid and on time, late fees, bills checked off, side income and savings
 * for a calendar year — from the renter's own records. Share as plain text.
 */
import { yearInReview } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { formStyles, usd } from "../components/forms";
import { Banner, Button, Chip, KV } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

export default function YearReviewRoute() {
  return (
    <LockGate>
      <YearReview />
    </LockGate>
  );
}

function YearReview() {
  const { t } = useT();
  const r = useRenter();
  const thisYear = now().getUTCFullYear();
  const [year, setYear] = useState(thisYear);
  const y = yearInReview({ year, rent: r.rentSetup, payments: r.payments, billPaid: r.billPaid, bills: r.bills, side: r.sideIncome, contribs: r.contribs });
  const empty = !y.months && !y.billsChecked && !y.sideIncomeCents && !y.savedCents;
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="year-review">
      <Banner tone="info" icon="ribbon-outline" title={t("yir.title", { year })}>
        {t("yir.intro")}
      </Banner>
      <View style={formStyles.row}>
        {[thisYear - 1, thisYear].map((x) => (
          <Chip key={x} label={String(x)} selected={year === x} onPress={() => setYear(x)} />
        ))}
      </View>
      {empty ? (
        <Text style={type.body}>{t("yir.empty")}</Text>
      ) : (
        <View style={formStyles.card} testID="yir-card">
          <KV k={t("yir.rent")} v={usd(y.rentPaidCents)} strong />
          <KV k={t("yir.onTime")} v={`${y.onTimeMonths} / ${y.months}`} />
          <KV k={t("yir.late")} v={usd(y.lateFeesCents)} />
          <KV k={t("yir.bills")} v={String(y.billsChecked)} />
          <KV k={t("yir.side")} v={usd(y.sideIncomeCents)} />
          <KV k={t("yir.saved")} v={usd(y.savedCents)} />
          {y.months && y.onTimeMonths === y.months ? <Text style={[type.body, { color: color.verified, fontWeight: "800" }]}>{t("yir.perfect")}</Text> : null}
        </View>
      )}
      <Button icon="share-outline" label={t("yir.share")} disabled={empty} onPress={() => void saveAndShare(`my-${year}-in-money.txt`, y.text, "text/plain", "public.plain-text")} testID="yir-share" />
      <Text style={type.tiny}>{t("yir.note")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
