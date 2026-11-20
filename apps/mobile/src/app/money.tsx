/**
 * Money: one screen for paychecks, debts, credit, savings and "found money". Shows today's
 * snapshot (next payday and what to set aside, lowest balance ahead, debt-free date, goals)
 * and links to each tool. Everything is calculated on the phone.
 */
import { cashFlowForecast, goalPlan, paycheckPlan, payoffPlan, upcomingObligations } from "@housing-compass/core";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formStyles, today, usd } from "../components/forms";
import { Banner, Button, Icon, Section, Tag, type IconName } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { HIT, color, radius, space, type } from "../theme";

export default function Money() {
  return (
    <LockGate>
      <MoneyScreen />
    </LockGate>
  );
}

function MoneyScreen() {
  const { t } = useT();
  const r = useRenter();
  const n = now();
  const from = today(n);
  const obligations = upcomingObligations({ rent: r.rentSetup, rentPayments: r.payments, bills: r.bills, billPaid: r.billPaid, from, days: 45 });
  const plan = r.pay ? paycheckPlan(r.pay, obligations, from) : null;
  const next = plan?.buckets[0] ?? null;
  const fc = r.startBalanceCents !== null ? cashFlowForecast(r.startBalanceCents, r.pay, obligations, from, 30) : null;
  const debt = r.debts.length ? payoffPlan(r.debts, 0, "avalanche") : null;
  const tools: Array<{ icon: IconName; label: string; sub: string; href: string; testID: string }> = [
    { icon: "wallet-outline", label: t("money.paycheck"), sub: t("money.paycheckSub"), href: "/paycheck", testID: "tool-paycheck" },
    { icon: "cloud-upload-outline", label: t("money.import"), sub: t("money.importSub"), href: "/import", testID: "tool-import" },
    { icon: "trending-down-outline", label: t("money.debts"), sub: t("money.debtsSub"), href: "/debts", testID: "tool-debts" },
    { icon: "speedometer-outline", label: t("money.credit"), sub: t("money.creditSub"), href: "/credit", testID: "tool-credit" },
    { icon: "flag-outline", label: t("money.goals"), sub: t("money.goalsSub"), href: "/goals", testID: "tool-goals" },
    { icon: "gift-outline", label: t("money.found"), sub: t("money.foundSub"), href: "/found-money", testID: "tool-found" },
    { icon: "people-outline", label: t("money.split"), sub: t("money.splitSub"), href: "/split", testID: "tool-split" },
    { icon: "save-outline", label: t("money.backup"), sub: t("money.backupSub"), href: "/backup", testID: "tool-backup" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="money">
      {!r.setupDone && !r.pay ? (
        <Banner tone="info" icon="sparkles-outline" title={t("money.setupTitle")}>
          {t("money.setupBody")}
        </Banner>
      ) : null}
      {!r.setupDone && !r.pay ? <Button icon="rocket-outline" label={t("money.setupStart")} onPress={() => router.push("/setup")} testID="setup-start" /> : null}

      <Section title={t("money.snapshot")}>
        <View style={styles.tiles} testID="money-snapshot">
          <View style={styles.tile}>
            <Text style={type.tiny}>{t("money.nextPayday")}</Text>
            <Text style={type.h3}>{next ? next.payday : "—"}</Text>
            {next ? <Text style={type.small}>{t("money.setAside", { amount: usd(next.setAsideCents) })}</Text> : <Text style={type.small}>{t("money.addPay")}</Text>}
          </View>
          <View style={[styles.tile, fc?.goesNegative && { backgroundColor: color.dangerSoft }]}>
            <Text style={type.tiny}>{t("money.lowest")}</Text>
            <Text style={[type.h3, fc?.goesNegative && { color: color.danger }]}>{fc ? usd(fc.lowest.balanceCents) : "—"}</Text>
            <Text style={type.small}>{fc ? fc.lowest.date : t("money.addBalance")}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={type.tiny}>{t("money.debtFree")}</Text>
            <Text style={type.h3}>{debt ? (debt.feasible ? t("money.months", { n: debt.months }) : t("money.never")) : "—"}</Text>
            <Text style={type.small}>{debt ? t("money.minsOnly") : t("money.noDebts")}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={type.tiny}>{t("money.goalsTile")}</Text>
            <Text style={type.h3}>{r.goals.length ? `${Math.round((r.goals.reduce((s, g) => s + goalPlan(g, n, r.pay).progress, 0) / r.goals.length) * 100)}%` : "—"}</Text>
            <Text style={type.small}>{r.goals.length ? t("money.goalsCount", { n: r.goals.length }) : t("money.noGoals")}</Text>
          </View>
        </View>
        {fc?.goesNegative ? <Text style={[type.small, { color: color.danger, fontWeight: "700" }]}>{t("money.negativeWarn", { date: fc.lowest.date })}</Text> : null}
      </Section>

      <Section title={t("money.tools")}>
        {tools.map((x) => (
          <Pressable key={x.href} onPress={() => router.push(x.href as never)} accessibilityRole="button" style={styles.item} testID={x.testID}>
            <View style={styles.iconBox}>
              <Icon name={x.icon} size={20} tint={color.brand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.h3}>{x.label}</Text>
              <Text style={type.tiny}>{x.sub}</Text>
            </View>
            <Icon name="chevron-forward" tint={color.muted} />
          </Pressable>
        ))}
      </Section>
      <View style={formStyles.row}>
        <Tag label={t("money.notAdvice")} />
      </View>
      <Text style={type.tiny}>{t("plan.privacy")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: 150, padding: 12, borderRadius: radius.md, backgroundColor: color.brandSoft, gap: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: HIT, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBox: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: color.brandSoft, alignItems: "center", justifyContent: "center" },
});
