/**
 * Security-deposit interest: in some cities landlords of covered units owe yearly interest on
 * the deposit. Shows the official rate and a rough estimate; the local office decides.
 */
import { DEPOSIT_INTEREST, depositInterestEstimate, RENT_FIGURES_CHECKED_ON } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, Chip, KV } from "../components/ui";
import { useT } from "../i18n";
import { openExternal } from "../lib/links";
import { space, type } from "../theme";

export default function DepositInterest() {
  const { t } = useT();
  const [city, setCity] = useState(DEPOSIT_INTEREST[0]!.id);
  const [deposit, setDeposit] = useState("");
  const [months, setMonths] = useState("12");
  const c = DEPOSIT_INTEREST.find((x) => x.id === city)!;
  const d = toCents(deposit);
  const m = Math.max(1, Math.min(12, Math.round(Number(months) || 12)));
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="deposit-interest">
      <Banner tone="info" icon="wallet-outline" title={t("dep.title")}>
        {t("dep.intro")}
      </Banner>
      <View style={formStyles.row}>
        {DEPOSIT_INTEREST.map((x) => (
          <Chip key={x.id} label={x.city} selected={city === x.id} onPress={() => setCity(x.id)} />
        ))}
      </View>
      <View style={formStyles.card}>
        <KV k={t("dep.rate")} v={`${c.ratePct}%`} strong />
        <KV k={t("dep.period")} v={c.period} />
        <Text style={type.small}>{c.how}</Text>
      </View>
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("dep.deposit")} value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" testID="dep-amount" />
        </View>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Field label={t("dep.months")} value={months} onChangeText={setMonths} keyboardType="number-pad" testID="dep-months" />
        </View>
      </View>
      {d > 0 ? (
        <View style={formStyles.card} testID="dep-result">
          <Text style={type.tiny}>{t("dep.estimate")}</Text>
          <Text style={type.title}>{usd(depositInterestEstimate(d, c.ratePct, m))}</Text>
          <Text style={type.tiny}>{t("dep.note")}</Text>
        </View>
      ) : null}
      <Button kind="secondary" icon="open-outline" label={t("dep.official", { city: c.city })} onPress={() => openExternal(c.url)} />
      <Text style={type.tiny}>{t("dep.checked", { date: RENT_FIGURES_CHECKED_ON })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
