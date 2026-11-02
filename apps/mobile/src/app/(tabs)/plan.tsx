/**
 * My plan: one list of what's coming up — rent due, tours, application deadlines and
 * follow-ups, the deposit-return deadline and waitlist check-ins — plus the renter tools.
 */
import { billPlanItems, billStatuses, buildPlan, rentSummary, type PlanItem } from "@housing-compass/core";
import { useEffect, useState } from "react";
import { authenticate, canUseLock } from "../../lib/lock";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usd } from "../../components/forms";
import { Button, Icon, Section, Tag, type IconName } from "../../components/ui";
import { now } from "../../config";
import { useT } from "../../i18n";
import { useApplications } from "../../state/applications";
import { useConversations } from "../../state/conversations";
import { useRenter } from "../../state/renter";
import { HIT, color, radius, space, type } from "../../theme";

const KIND_ICON: Record<PlanItem["kind"], IconName> = {
  rent_due: "cash-outline",
  tour: "walk-outline",
  app_deadline: "document-text-outline",
  follow_up: "chatbubble-ellipses-outline",
  deposit_return: "wallet-outline",
  waitlist_check_in: "hourglass-outline",
  bill_due: "receipt-outline",
};

export default function Plan() {
  const { t } = useT();
  const r = useRenter();
  const threads = useConversations((s) => s.threads);
  const apps = useApplications((s) => s.items);
  const n = now();
  const plan = buildPlan({
    rent: r.rentSetup ? { setup: r.rentSetup, payments: r.payments } : null,
    tours: threads.flatMap((th) => th.tours.map((x) => ({ id: x.id, threadId: th.id, title: th.title, startsAt: x.startsAt, status: x.status }))),
    applications: apps.map((a) => ({ id: a.id, title: a.title, deadline: a.deadline, nextActionAt: a.nextActionAt, status: a.status })),
    moveOut: r.moveOut,
    waitlists: r.waitlists,
    now: n,
    extra: billPlanItems(billStatuses(r.bills, r.billPaid, n), n),
  });
  const [lockAvailable, setLockAvailable] = useState(false);
  useEffect(() => {
    void canUseLock().then(setLockAvailable);
  }, []);
  const detail = (p: PlanItem) => {
    if (p.at) return new Date(p.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const c = p.detailCode;
    const txt =
      c === "in_days" ? (p.kind === "deposit_return" ? t("move.daysLeft", { n: p.n ?? 0 }) : t("rent.dueIn", { n: p.n ?? 0 })) : c === "due_today" ? t("rent.dueToday") : c === "days_late" ? t("rent.lateBy", { n: p.n ?? 0 }) : c === "overdue_days" ? t("move.overdue", { n: p.n ?? 0 })
      : c === "check_in_soon" ? t("wl.soon") : c === "check_in_overdue" ? t("wl.overdue") : c === "official_application" ? t("plan.official") : c === "your_reminder" ? t("plan.yourReminder") : c === "autopay" ? t("plan.autopay") : p.detail;
    return `${p.date} · ${txt}`;
  };
  const rs = r.rentSetup ? rentSummary(r.rentSetup, r.payments, n) : null;
  const tools: Array<{ icon: IconName; label: string; sub: string; href: string; testID: string }> = [
    { icon: "cash-outline", label: t("plan.toolRent"), sub: rs && rs.onTimeStreak ? t("rent.streak", { n: rs.onTimeStreak }) : t("plan.toolRentSub"), href: "/rent", testID: "tool-rent" },
    { icon: "receipt-outline", label: t("plan.toolBills"), sub: r.bills.length ? t("plan.billsCount", { n: r.bills.length }) : t("plan.toolBillsSub"), href: "/bills", testID: "tool-bills" },
    { icon: "trending-up-outline", label: t("inc.link"), sub: t("plan.toolIncSub"), href: "/rent-increase", testID: "tool-increase" },
    { icon: "clipboard-outline", label: t("plan.toolMove"), sub: t("plan.toolMoveSub"), href: "/move", testID: "tool-move" },
    { icon: "hourglass-outline", label: t("plan.toolWaitlists"), sub: r.waitlists.length ? t("plan.tracking", { n: r.waitlists.length }) : t("plan.toolWaitlistsSub"), href: "/waitlists", testID: "tool-waitlists" },
    { icon: "business-outline", label: t("plan.toolLocal"), sub: t("plan.toolLocalSub"), href: "/local-help", testID: "tool-local" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.wrap} testID="plan">
        <Text style={type.title} accessibilityRole="header">
          {t("plan.title")}
        </Text>
        <Text style={type.small}>{t("plan.intro")}</Text>

        <Section title={t("plan.next30")}>
          {plan.length === 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={type.small}>{t("plan.empty")}</Text>
              {!r.rentSetup ? <Button icon="cash-outline" label={t("plan.setUpRent")} onPress={() => router.push("/rent")} testID="plan-setup-rent" /> : null}
            </View>
          ) : null}
          {plan.map((p, i) => (
            <Pressable key={`${p.kind}:${p.date}:${i}`} onPress={() => router.push(p.href as never)} accessibilityRole="button" style={styles.item} testID="plan-item">
              <View style={[styles.iconBox, p.urgent && { backgroundColor: color.dangerSoft }]}>
                <Icon name={KIND_ICON[p.kind]} size={20} tint={p.urgent ? color.danger : color.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.h3}>{p.kind === "rent_due" && r.rentSetup ? t("plan.rentDue", { amount: usd(r.rentSetup.amountCents) }) : p.title}</Text>
                <Text style={type.tiny}>
                  {detail(p)}
                </Text>
              </View>
              {p.urgent ? <Tag label={t("plan.soon")} tone="warn" /> : null}
              <Icon name="chevron-forward" tint={color.muted} />
            </Pressable>
          ))}
        </Section>

        <Section title={t("plan.tools")}>
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
        {lockAvailable ? (
          <Section title={t("lock.settingTitle")}>
            <Text style={type.small}>{t("lock.settingBody")}</Text>
            <Button
              kind={r.lockOn ? "secondary" : "primary"}
              icon={r.lockOn ? "lock-open-outline" : "lock-closed-outline"}
              label={r.lockOn ? t("lock.turnOff") : t("lock.turnOn")}
              onPress={async () => {
                if (await authenticate(t("lock.prompt"))) r.setLockOn(!r.lockOn);
              }}
            />
          </Section>
        ) : null}
        <Text style={type.tiny}>{t("plan.privacy")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: HIT, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBox: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: color.brandSoft, alignItems: "center", justifyContent: "center" },
});
