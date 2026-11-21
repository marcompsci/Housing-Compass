/**
 * Can I afford this? Checks a one-time purchase against what's safe to spend today and the
 * 30-day forecast, and says yes, tight, wait until payday, or no. Device-only.
 */
import { canAfford, goalEta, purchaseImpact } from "@housing-compass/core";
import { today } from "../components/forms";
import { now } from "../config";
import { useRenter } from "../state/renter";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, Icon, KV } from "../components/ui";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useMoneyNow } from "../lib/moneyNow";
import { color, space, type } from "../theme";

export default function AffordRoute() {
  return (
    <LockGate>
      <Afford />
    </LockGate>
  );
}

function Afford() {
  const { t } = useT();
  const m = useMoneyNow();
  const r = useRenter();
  const [price, setPrice] = useState("");
  const [res, setRes] = useState<ReturnType<typeof canAfford> | null>(null);
  const tone = res ? { yes: color.verified, tight: color.warn, wait: color.warn, no: color.danger }[res.verdict] : color.ink;
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="afford">
      <Banner tone="info" icon="help-circle-outline" title={t("aff.title")}>
        {t("aff.intro")}
      </Banner>
      {!m.sts || !m.fc ? (
        <>
          <Text style={type.body}>{t("today.needBalance")}</Text>
          <Button icon="wallet-outline" label={t("money.paycheck")} onPress={() => router.push("/paycheck")} />
        </>
      ) : (
        <>
          <KV k={t("today.safe")} v={usd(m.sts.safeCents)} strong />
          <Field label={t("aff.price")} value={price} onChangeText={setPrice} keyboardType="decimal-pad" testID="aff-price" />
          <Button
            icon="calculator-outline"
            label={t("aff.check")}
            testID="aff-check"
            onPress={() => {
              const c = toCents(price);
              if (c > 0) setRes(canAfford({ priceCents: c, safeCents: m.sts!.safeCents, series: m.fc!.series, nextPayday: m.nextPay }));
            }}
          />
          {res ? (
            <View style={[formStyles.card, { borderColor: tone }]} testID="aff-result">
              <View style={formStyles.row}>
                <Icon name={res.verdict === "yes" ? "checkmark-circle" : res.verdict === "no" ? "close-circle" : "time-outline"} size={28} tint={tone} />
                <Text style={[type.h2, { color: tone, flex: 1 }]}>{t(`aff.v.${res.verdict}`)}</Text>
              </View>
              <Text style={type.body}>{res.verdict === "wait" ? t("aff.waitBody", { date: res.waitUntil ?? "" }) : t(`aff.b.${res.verdict}`, { left: usd(Math.abs(res.leftCents)) })}</Text>
              {res.lowestAfterCents !== null ? <KV k={t("aff.lowest")} v={usd(res.lowestAfterCents)} /> : null}
              {(() => {
                const g = r.goals[0];
                const imp = purchaseImpact({ priceCents: toCents(price), hourlyCents: r.hourlyCents, goalPerWeekCents: g ? goalEta(g, r.contribs, today(now())).perWeekCents : null });
                return (
                  <>
                    {imp.hours !== null ? <Text style={type.small} testID="aff-hours">{t("ask.a.hours", { n: imp.hours })}</Text> : null}
                    {imp.goalDelayWeeks !== null && g ? <Text style={type.small}>{t("ask.a.delay", { n: imp.goalDelayWeeks, goal: g.name })}</Text> : null}
                  </>
                );
              })()}
            </View>
          ) : null}
        </>
      )}
      <Text style={type.tiny}>{t("aff.note")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
