/**
 * "Does this home fit?" on a listing: monthly cost against your take-home pay and other bills
 * (from the Money tools, on this phone), and how long saving the move-in cost would take.
 * Offers to create a savings goal for the move-in total.
 */
import { listingFit, monthlyIncomeCents, type Listing, effectiveMonthlyCents, moveInTotal } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, type } from "../theme";
import { usd } from "./forms";
import { Button, KV, Section } from "./ui";

export function FitPanel({ listing }: { listing: Listing }) {
  const { t } = useT();
  const r = useRenter();
  const [made, setMade] = useState(false);
  const income = r.pay ? monthlyIncomeCents(r.pay) : r.takeHomeCents;
  const monthly = effectiveMonthlyCents(listing).cents;
  const movein = moveInTotal(listing).amountCents;
  const saved = r.goals.reduce((s, g) => s + g.savedCents, 0);
  const fit = listingFit({ monthlyCents: monthly, moveInCents: movein, takeHomeMonthlyCents: income, otherBillsCents: r.bills.reduce((s, b) => s + b.amountCents, 0), savedCents: saved });
  const goalName = `Move-in: ${listing.title}`.slice(0, 60);
  const hasGoal = r.goals.some((g) => g.name === goalName);
  return (
    <Section title={t("fit.title")}>
      {fit.status === "unknown" ? (
        <View style={{ gap: 8 }}>
          <Text style={type.small}>{t("fit.needPay")}</Text>
          <Button kind="secondary" icon="wallet-outline" label={t("money.setupStart")} onPress={() => router.push("/setup")} />
        </View>
      ) : (
        <View style={{ gap: 4 }} testID="fit-panel">
          <Text style={[type.body, { fontWeight: "800", color: fit.status === "fits" ? color.verified : color.danger }]}>{t(`fit.s.${fit.status}`)}</Text>
          <KV k={t("fit.share")} v={`${Math.round((fit.rentShare ?? 0) * 100)}%`} />
          <KV k={t("fit.left")} v={usd(fit.leftoverCents ?? 0)} strong />
          {fit.moveInGapCents !== null ? <KV k={t("fit.gap")} v={usd(fit.moveInGapCents)} /> : null}
          {fit.monthsToMoveIn !== null && fit.moveInGapCents ? <Text style={type.small}>{t("fit.months", { n: fit.monthsToMoveIn })}</Text> : null}
        </View>
      )}
      {movein !== null && !hasGoal && !made ? (
        <Button
          kind="ghost"
          icon="flag-outline"
          label={t("fit.saveFor")}
          testID="fit-goal"
          onPress={() => {
            r.addGoal({ name: goalName, targetCents: movein, savedCents: 0, targetDate: listing.lease.moveInDate ?? null });
            setMade(true);
          }}
        />
      ) : null}
      {made || hasGoal ? (
        <Button kind="ghost" icon="flag" label={t("fit.goalMade")} onPress={() => router.push("/goals")} />
      ) : null}
      <Text style={type.tiny}>{t("fit.note")}</Text>
    </Section>
  );
}
