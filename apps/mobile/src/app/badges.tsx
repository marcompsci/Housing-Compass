/** Badges earned from real progress — on-time rent, bills paid, goals reached, debts paid off and more. */
import { debtMinStreak, allPaidStreak, badges, debtProgress, emergencyFund, goalPlan, netWorthHistory, rentSummary, underLimitStreak, type BadgeId } from "@housing-compass/core";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { today } from "../components/forms";
import { Banner, Icon, type IconName } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

const ICON: Record<BadgeId, IconName> = {
  first_rent: "home-outline",
  on_time_3: "time-outline",
  all_bills_3: "checkmark-done-outline",
  first_goal: "flag-outline",
  debt_free_one: "trophy-outline",
  emergency_month: "shield-outline",
  bill_win: "call-outline",
  under_limit_4: "cart-outline",
  challenge_10: "calendar-number-outline",
  report_checked: "document-text-outline",
  net_worth_up: "trending-up-outline",
  side_hustle: "car-outline",
  debt_min_3: "card-outline",
};

export default function Badges() {
  const { t } = useT();
  const r = useRenter();
  const n = now();
  const td = today(n);
  const rs = r.rentSetup ? rentSummary(r.rentSetup, r.payments, n) : null;
  const essentials = (r.rentSetup?.amountCents ?? 0) + r.bills.reduce((s, b) => s + b.amountCents, 0);
  const b = badges({
    onTimeRentMonths: rs?.onTimeStreak ?? 0,
    rentMonths: new Set(r.payments.map((p) => p.month)).size,
    allBillsStreak: allPaidStreak(r.bills, r.billPaid, n),
    goalsDone: r.goals.filter((g) => goalPlan(g, n, r.pay).remainingCents === 0).length,
    debtsPaidOff: debtProgress(r.debts).paidOff,
    emergencyMonths: essentials ? emergencyFund(r.emergencyCents ?? 0, essentials).months : null,
    wins: r.negotiations.filter((x) => x.result === "lower" || x.result === "credit").length,
    underLimitWeeks: underLimitStreak(r.spends, r.weeklyLimitCents, td),
    challengeWeeks: r.challenge?.done.length ?? 0,
    reportChecks: r.reportChecks.length,
    netWorthChange: netWorthHistory(r.netWorth).changeCents,
    sideIncomeEntries: r.sideIncome.length,
    debtMinStreak: debtMinStreak(r.debts, r.debtPaid, n),
  });
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="badges">
      <Banner tone="info" icon="ribbon-outline" title={t("bd.title", { n: b.earned, total: b.total })}>
        {t("bd.intro")}
      </Banner>
      <View style={styles.grid}>
        {b.list.map((x) => (
          <View key={x.id} style={[styles.card, x.earned && styles.earned]} testID={x.earned ? "badge-earned" : "badge-locked"} accessibilityLabel={`${t(`bd.${x.id}`)}: ${x.earned ? t("bd.earned") : t("bd.progress", { n: x.progress, goal: x.goal })}`}>
            <Icon name={ICON[x.id]} size={28} tint={x.earned ? color.verified : color.muted} />
            <Text style={[type.small, { fontWeight: "800", textAlign: "center" }]}>{t(`bd.${x.id}`)}</Text>
            <Text style={[type.tiny, { textAlign: "center" }]}>{x.earned ? t("bd.earned") : t("bd.progress", { n: x.progress, goal: x.goal })}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { width: 150, flexGrow: 1, padding: 12, gap: 4, alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, opacity: 0.75 },
  earned: { borderColor: color.verified, backgroundColor: color.verifiedSoft, opacity: 1 },
});
