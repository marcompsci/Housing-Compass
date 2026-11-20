/**
 * Money: one screen for paychecks, debts, credit, savings and "found money". Shows today's
 * snapshot (next payday and what to set aside, lowest balance ahead, debt-free date, goals)
 * and links to each tool. Everything is calculated on the phone.
 */
import { CREDIT_CHECKLIST, billStatuses, cashFlowForecast, emergencyFund, goalPlan, moneyCheck, paycheckPlan, payoffPlan, rentSummary, upcomingObligations } from "@housing-compass/core";
import { useState } from "react";
import { Field, toCents } from "../components/forms";
import { askReminderPermission, remindersSupported } from "../lib/reminders";
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
  const essentials = (r.rentSetup?.amountCents ?? 0) + r.bills.reduce((s, b) => s + b.amountCents, 0);
  const ef = emergencyFund(r.emergencyCents ?? 0, essentials);
  const [efText, setEfText] = useState(r.emergencyCents !== null ? String(r.emergencyCents / 100) : "");
  const [remMsg, setRemMsg] = useState<string | null>(null);
  const check = moneyCheck({
    onTimeStreak: r.rentSetup ? rentSummary(r.rentSetup, r.payments, n).onTimeStreak : 0,
    overdueBills: billStatuses(r.bills, r.billPaid, n).filter((b) => b.state === "overdue").length,
    hasPaySetup: !!r.pay,
    forecastGoesNegative: fc ? fc.goesNegative : null,
    emergencyMonths: ef.months,
    utilization: null,
    utilizationConfirmed: r.creditDone.includes("utilization"),
    creditStepsDone: r.creditDone.length,
    creditStepsTotal: CREDIT_CHECKLIST.length,
    hasGoal: r.goals.length > 0,
  });
  const nextHref: Record<string, string> = { rent_on_time: "/rent", no_overdue: "/bills", paycheck_plan: "/paycheck", emergency: "/money", utilization: "/credit", credit_steps: "/credit", goal: "/goals" };
  const tools: Array<{ icon: IconName; label: string; sub: string; href: string; testID: string }> = [
    { icon: "wallet-outline", label: t("money.paycheck"), sub: t("money.paycheckSub"), href: "/paycheck", testID: "tool-paycheck" },
    { icon: "cloud-upload-outline", label: t("money.import"), sub: t("money.importSub"), href: "/import", testID: "tool-import" },
    { icon: "trending-down-outline", label: t("money.debts"), sub: t("money.debtsSub"), href: "/debts", testID: "tool-debts" },
    { icon: "speedometer-outline", label: t("money.credit"), sub: t("money.creditSub"), href: "/credit", testID: "tool-credit" },
    { icon: "flag-outline", label: t("money.goals"), sub: t("money.goalsSub"), href: "/goals", testID: "tool-goals" },
    { icon: "gift-outline", label: t("money.found"), sub: t("money.foundSub"), href: "/found-money", testID: "tool-found" },
    { icon: "people-outline", label: t("money.split"), sub: t("money.splitSub"), href: "/split", testID: "tool-split" },
    { icon: "calendar-number-outline", label: t("cal.title"), sub: t("plan.calSub"), href: "/calendar", testID: "tool-calendar" },
    { icon: "mail-outline", label: t("let.title"), sub: t("let.sub"), href: "/letters", testID: "tool-letters" },
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

      <Section title={t("mc.title")}>
        <View style={formStyles.row} testID="money-check">
          <View style={styles.score}>
            <Text style={[type.title, { color: color.brandInk }]}>{check.score}</Text>
            <Text style={[type.tiny, { color: color.brandInk }]}>/ 100</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            {check.items.map((it) => {
              const ok = it.ok;
              return (
                <View key={it.id} style={formStyles.row}>
                  <Icon name={ok ? "checkmark-circle" : "ellipse-outline"} size={16} tint={ok ? color.verified : color.muted} />
                  <Text style={[type.tiny, { flex: 1 }]}>{t(`mc.i.${it.id}`)}</Text>
                </View>
              );
            })}
          </View>
        </View>
        {check.next ? <Button kind="secondary" icon="arrow-forward-outline" label={t(`mc.next.${check.next}`)} onPress={() => router.push(nextHref[check.next!] as never)} testID="money-check-next" /> : <Text style={[type.small, { color: color.verified, fontWeight: "700" }]}>{t("mc.allDone")}</Text>}
        <Text style={type.tiny}>{t("mc.note")}</Text>
      </Section>

      <Section title={t("ef.title")}>
        <Text style={type.small}>{t("ef.body")}</Text>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Field label={t("ef.saved")} value={efText} onChangeText={setEfText} keyboardType="decimal-pad" testID="ef-saved" />
          </View>
          <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => r.setEmergency(toCents(efText) >= 0 ? toCents(efText) : null)} testID="ef-save" />
        </View>
        {ef.months !== null ? (
          <View style={{ gap: 4 }} testID="ef-meter">
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, Math.round((ef.months / 3) * 100))}%` }]} />
            </View>
            <Text style={[type.small, { fontWeight: "700" }]}>{t("ef.months", { n: ef.months })}</Text>
            {ef.toThreeMonthsCents ? <Text style={type.tiny}>{t("ef.toThree", { amount: usd(ef.toThreeMonthsCents) })}</Text> : <Text style={[type.tiny, { color: color.verified }]}>{t("ef.strong")}</Text>}
          </View>
        ) : (
          <Text style={type.tiny}>{t("ef.needRent")}</Text>
        )}
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
      <Section title={t("wk.title")}>
        <Text style={type.small}>{t("wk.body")}</Text>
        <Button
          kind={r.weeklyCheckIn ? "secondary" : "primary"}
          icon="notifications-outline"
          label={r.weeklyCheckIn ? t("wk.off") : t("wk.on")}
          testID="weekly-toggle"
          onPress={async () => {
            if (r.weeklyCheckIn) return r.setWeeklyCheckIn(false);
            if (!remindersSupported) return setRemMsg(t("rent.remWeb"));
            const ok = await askReminderPermission();
            if (ok) {
              r.setWeeklyCheckIn(true);
              r.setRemindersOn(true);
            }
            setRemMsg(ok ? t("rent.remOn") : t("rent.remDenied"));
          }}
        />
        {remMsg ? <Text style={type.tiny} testID="weekly-msg">{remMsg}</Text> : null}
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
  score: { width: 76, height: 76, borderRadius: 38, backgroundColor: color.brand, alignItems: "center", justifyContent: "center" },
  track: { height: 10, borderRadius: radius.md, backgroundColor: color.neutralSoft, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: color.verified },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: 150, padding: 12, borderRadius: radius.md, backgroundColor: color.brandSoft, gap: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: HIT, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBox: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: color.brandSoft, alignItems: "center", justifyContent: "center" },
});
