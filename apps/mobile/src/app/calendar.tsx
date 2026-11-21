/**
 * Money calendar: a month view with paydays and every rent and bill due date, so you can see
 * at a glance which week is heavy. Tap a day to see what's due.
 */
import { monthCalendar, paydays, upcomingObligations, type CalendarCell } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formStyles, today, usd } from "../components/forms";
import { Banner, Icon, KV } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

const shiftMonth = (m: string, n: number) => {
  const [y, mm] = m.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 7);
};

export default function Calendar() {
  return (
    <LockGate>
      <CalendarScreen />
    </LockGate>
  );
}

function CalendarScreen() {
  const { t, locale } = useT();
  const r = useRenter();
  const todayIso = today(now());
  const [month, setMonth] = useState(todayIso.slice(0, 7));
  const [picked, setPicked] = useState<CalendarCell | null>(null);
  const obligations = upcomingObligations({ rent: r.rentSetup, rentPayments: r.payments, bills: r.bills, billPaid: r.billPaid, from: `${month}-01`, days: 41 });
  const pays = r.pay ? paydays(r.pay, `${month}-01`, 41) : [];
  const weeks = monthCalendar(month, pays, obligations);
  const monthTotal = obligations.filter((o) => o.dueDate.startsWith(month)).reduce((s, o) => s + o.amountCents, 0);
  const label = new Date(`${month}-15T12:00:00Z`).toLocaleDateString(locale === "zh" ? "zh-CN" : locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const dow = [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(Date.UTC(2026, 10, 1 + i, 12)).toLocaleDateString(locale === "zh" ? "zh-CN" : locale, { weekday: "narrow", timeZone: "UTC" }));

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="calendar">
      <Banner tone="info" icon="calendar-outline" title={t("cal.title")}>
        {t("cal.intro")}
      </Banner>
      <View style={[formStyles.row, { justifyContent: "space-between" }]}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel={t("cal.prev")} style={styles.nav}>
          <Icon name="chevron-back" tint={color.ink} />
        </Pressable>
        <Text style={type.h2} accessibilityRole="header">
          {label}
        </Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityRole="button" accessibilityLabel={t("cal.next")} style={styles.nav} testID="cal-next">
          <Icon name="chevron-forward" tint={color.ink} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        <View style={styles.row}>
          {dow.map((d, i) => (
            <Text key={i} style={[type.tiny, styles.dow]}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((w, i) => (
          <View key={i} style={styles.row}>
            {w.map((c) => {
              const due = c.due.reduce((s, x) => s + x.amountCents, 0);
              return (
                <Pressable
                  key={c.date}
                  onPress={() => setPicked(c)}
                  style={[styles.cell, !c.inMonth && { opacity: 0.35 }, c.date === todayIso && styles.today, picked?.date === c.date && styles.picked]}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.date}${c.payday ? `, ${t("cal.payday")}` : ""}${due ? `, ${t("cal.due", { amount: usd(due) })}` : ""}`}
                  testID={c.due.length || c.payday ? "cal-mark" : undefined}
                >
                  <Text style={[type.small, { fontWeight: "700" }]}>{Number(c.date.slice(8, 10))}</Text>
                  <View style={styles.dots}>
                    {c.payday ? <View style={[styles.dot, { backgroundColor: color.verified }]} /> : null}
                    {c.due.some((x) => x.kind === "rent") ? <View style={[styles.dot, { backgroundColor: color.danger }]} /> : null}
                    {c.due.some((x) => x.kind === "bill") ? <View style={[styles.dot, { backgroundColor: color.warn }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={formStyles.row}>
        <Legend c={color.verified} label={t("cal.payday")} />
        <Legend c={color.danger} label={t("bills.rent")} />
        <Legend c={color.warn} label={t("cal.bills")} />
      </View>
      <KV k={t("cal.monthTotal")} v={usd(monthTotal)} strong />
      {picked ? (
        <View style={formStyles.card} testID="cal-day">
          <Text style={type.h3}>{picked.date}</Text>
          {picked.payday && r.pay ? <KV k={t("cal.payday")} v={usd(r.pay.amountCents)} /> : null}
          {picked.due.map((x, i) => (
            <KV key={i} k={x.kind === "rent" ? t("bills.rent") : x.name} v={usd(x.amountCents)} />
          ))}
          {!picked.payday && !picked.due.length ? <Text style={type.small}>{t("cal.nothing")}</Text> : null}
        </View>
      ) : null}
      {!r.pay && !r.rentSetup && !r.bills.length ? (
        <View style={formStyles.row}>
          <Icon name="information-circle-outline" tint={color.muted} />
          <Text style={type.small}>{t("cal.empty")}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Legend({ c, label }: { c: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={type.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  nav: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  grid: { gap: 4 },
  row: { flexDirection: "row", gap: 4 },
  dow: { flex: 1, textAlign: "center" },
  cell: { flex: 1, aspectRatio: 0.9, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center", gap: 2 },
  today: { borderColor: color.brand, borderWidth: 2 },
  picked: { backgroundColor: color.brandSoft },
  dots: { flexDirection: "row", gap: 2, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
