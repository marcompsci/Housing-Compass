/**
 * Bills & budget: the rest of the monthly bills next to rent, checked off as they're paid,
 * with a simple take-home budget and a calendar file of every due date. Device-only.
 */
import { BILL_CATEGORIES, billStatuses, budgetSnapshot, buildIcs, dueDateEvents, validateBill, type BillCategory } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function AddBill() {
  const { t } = useT();
  const add = useRenter((s) => s.addBill);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [cat, setCat] = useState<BillCategory>("utilities");
  const [autopay, setAutopay] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Section title={t("bills.addTitle")}>
      <Field label={t("bills.name")} value={name} onChangeText={setName} placeholder={t("bills.namePh")} testID="bill-name" />
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("bills.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="bill-amount" />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("rent.dueDay")} value={day} onChangeText={setDay} keyboardType="number-pad" testID="bill-day" />
        </View>
      </View>
      <View style={formStyles.row}>
        {BILL_CATEGORIES.map((c) => (
          <Chip key={c} label={t(`bills.c.${c}`)} selected={cat === c} onPress={() => setCat(c)} />
        ))}
      </View>
      <Chip icon={autopay ? "checkbox-outline" : "square-outline"} label={t("bills.autopay")} selected={autopay} onPress={() => setAutopay(!autopay)} />
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Button
        icon="add-circle-outline"
        label={t("bills.add")}
        testID="bill-add"
        onPress={() => {
          const b = { name: name.trim().slice(0, 60), amountCents: toCents(amount), dueDay: Number(day), category: cat, autopay };
          const e = validateBill(b);
          if (e) return setErr(e);
          add(b);
          setName("");
          setAmount("");
          setDay("");
          setAutopay(false);
          setErr(null);
        }}
      />
    </Section>
  );
}

export default function Bills() {
  const { t } = useT();
  const r = useRenter();
  const n = now();
  const month = today(n).slice(0, 7);
  const statuses = billStatuses(r.bills, r.billPaid, n);
  const [takeHome, setTakeHome] = useState(r.takeHomeCents ? String(r.takeHomeCents / 100) : "");
  const budget = r.takeHomeCents ? budgetSnapshot(r.takeHomeCents, r.rentSetup?.amountCents ?? 0, r.bills) : null;
  const stateTag = (s: (typeof statuses)[number]) =>
    s.state === "paid" ? <Tag label={t("bills.paid")} tone="good" /> : s.state === "overdue" ? <Tag label={t("rent.lateBy", { n: -s.daysUntilDue })} tone="warn" /> : s.state === "due_soon" ? <Tag label={s.daysUntilDue === 0 ? t("rent.dueToday") : t("rent.dueIn", { n: s.daysUntilDue })} tone="warn" /> : null;

  return (
    <LockGate>
      <ScrollView contentContainerStyle={styles.wrap} testID="bills">
        <Banner tone="info" icon="receipt-outline" title={t("bills.title")}>
          {t("bills.intro")}
        </Banner>

        <Section title={t("bills.thisMonth")}>
          {r.rentSetup ? (
            <Pressable style={styles.row} onPress={() => router.push("/rent")} accessibilityRole="button">
              <Icon name="home-outline" tint={color.brand} />
              <Text style={[type.h3, { flex: 1 }]}>{t("bills.rentRow", { amount: usd(r.rentSetup.amountCents), day: r.rentSetup.dueDay })}</Text>
              <Icon name="chevron-forward" tint={color.muted} />
            </Pressable>
          ) : null}
          {statuses.length === 0 ? <Text style={type.small}>{t("bills.none")}</Text> : null}
          {statuses.map((s) => {
            const paid = s.paidThisMonth;
            return (
              <View key={s.bill.id} style={styles.row} testID="bill-row">
                <Pressable
                  onPress={() => r.toggleBillPaid(s.bill.id, month)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: paid }}
                  accessibilityLabel={t("bills.markPaid", { name: s.bill.name })}
                  hitSlop={8}
                  testID="bill-paid"
                >
                  <Icon name={paid ? "checkmark-circle" : "ellipse-outline"} size={24} tint={paid ? color.verified : color.muted} />
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.h3, paid && { color: color.muted }]}>
                    {s.bill.name} · {usd(s.bill.amountCents)}
                  </Text>
                  <Text style={type.tiny}>
                    {t(`bills.c.${s.bill.category}`)} · {t("bills.dueOn", { date: s.nextDue })}
                    {s.bill.autopay ? ` · ${t("bills.autopayShort")}` : ""}
                  </Text>
                </View>
                {stateTag(s)}
                <Pressable onPress={() => r.removeBill(s.bill.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: s.bill.name })} hitSlop={10}>
                  <Icon name="trash-outline" tint={color.muted} />
                </Pressable>
              </View>
            );
          })}
          {r.bills.length || r.rentSetup ? (
            <Button
              kind="secondary"
              icon="calendar-outline"
              label={t("bills.calendar")}
              testID="bills-calendar"
              onPress={() => void saveAndShare("housing-compass-due-dates.ics", buildIcs(dueDateEvents(r.rentSetup, r.bills, n), n), "text/calendar", "com.apple.ical.ics")}
            />
          ) : null}
          <Text style={type.tiny}>{t("bills.remindersNote")}</Text>
        </Section>

        <AddBill />

        <Section title={t("bills.budgetTitle")}>
          <Field label={t("bills.takeHome")} value={takeHome} onChangeText={setTakeHome} keyboardType="decimal-pad" hint={t("bills.takeHomeHint")} testID="take-home" />
          <Button
            kind="secondary"
            label={t("rent.saveSetup")}
            testID="take-home-save"
            onPress={() => {
              const c = toCents(takeHome);
              r.setTakeHome(c > 0 ? c : null);
            }}
          />
          {budget ? (
            <View style={{ gap: 4 }} testID="budget">
              <KV k={t("bills.income")} v={usd(budget.incomeCents)} />
              <KV k={t("bills.rent")} v={`${usd(budget.rentCents)} · ${pct(budget.rentShare)}`} />
              <KV k={t("bills.otherBills")} v={usd(budget.billsCents)} />
              <KV k={t("bills.leftover")} v={usd(budget.leftoverCents)} strong />
              <Text style={[type.small, { color: budget.status === "ok" ? color.verified : color.danger, fontWeight: "700" }]}>{t(`bills.status.${budget.status}`)}</Text>
              {budget.rentShare !== null && budget.rentShare > 0.3 ? <Text style={type.tiny}>{t("bills.over30")}</Text> : null}
            </View>
          ) : null}
        </Section>

        <Button kind="ghost" icon="trending-up-outline" label={t("inc.link")} onPress={() => router.push("/rent-increase")} />
        <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
      </ScrollView>
    </LockGate>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
