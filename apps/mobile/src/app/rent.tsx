/**
 * Rent tracker: log each payment, see the next due date and your on-time streak, export the
 * history as a spreadsheet (for a landlord reference or a rent-reporting service), and turn on
 * local reminders. Device-only; nothing here is uploaded.
 */
import { paymentTiming, paymentsCsv, rentSummary, validatePayment, type RentPayment } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { askReminderPermission, remindersSupported } from "../lib/reminders";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

const METHODS: RentPayment["method"][] = ["portal", "bank_transfer", "check", "money_order", "cash_with_receipt", "other"];

function Setup({ onDone }: { onDone?: () => void }) {
  const { t } = useT();
  const cur = useRenter((s) => s.rentSetup);
  const setRentSetup = useRenter((s) => s.setRentSetup);
  const [amount, setAmount] = useState(cur ? String(cur.amountCents / 100) : "");
  const [dueDay, setDueDay] = useState(cur ? String(cur.dueDay) : "1");
  const [grace, setGrace] = useState(cur ? String(cur.graceDays) : "0");
  const [payee, setPayee] = useState(cur?.payee ?? "");
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const amountCents = toCents(amount);
    const d = Number(dueDay);
    const g = Number(grace);
    if (!(amountCents > 0 && amountCents <= 2_000_000)) return setErr(t("rent.errAmount"));
    if (!Number.isInteger(d) || d < 1 || d > 31) return setErr(t("rent.errDueDay"));
    if (!Number.isInteger(g) || g < 0 || g > 15) return setErr(t("rent.errGrace"));
    setRentSetup({ amountCents, dueDay: d, graceDays: g, payee: payee.trim().slice(0, 80) });
    setErr(null);
    onDone?.();
  };
  return (
    <Section title={t("rent.setupTitle")}>
      <Field label={t("rent.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1400" testID="rent-amount" />
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("rent.dueDay")} value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" testID="rent-due-day" />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("rent.grace")} value={grace} onChangeText={setGrace} keyboardType="number-pad" />
        </View>
      </View>
      <Field label={t("rent.payee")} value={payee} onChangeText={setPayee} placeholder={t("rent.payeePh")} />
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Button label={t("rent.saveSetup")} onPress={save} testID="rent-save-setup" />
    </Section>
  );
}

function LogPayment() {
  const { t } = useT();
  const setup = useRenter((s) => s.rentSetup)!;
  const payments = useRenter((s) => s.payments);
  const addPayment = useRenter((s) => s.addPayment);
  const d = today(now());
  const [month, setMonth] = useState(d.slice(0, 7));
  const [paidOn, setPaidOn] = useState(d);
  const [amount, setAmount] = useState(String(setup.amountCents / 100));
  const [method, setMethod] = useState<RentPayment["method"]>("portal");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const add = () => {
    const p = { month, paidOn, amountCents: toCents(amount), method, confirmation: conf.trim().slice(0, 60) };
    const err = validatePayment(p, payments);
    if (err) return setMsg({ ok: false, text: err });
    addPayment(p);
    setConf("");
    setMsg({ ok: true, text: paymentTiming({ ...p, id: "" }, setup) === "on_time" ? t("rent.loggedOnTime") : t("rent.loggedLate") });
  };
  return (
    <Section title={t("rent.logTitle")}>
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("rent.month")} value={month} onChangeText={setMonth} placeholder="2026-11" autoCapitalize="none" testID="pay-month" />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("rent.paidOn")} value={paidOn} onChangeText={setPaidOn} placeholder="2026-11-01" autoCapitalize="none" testID="pay-date" />
        </View>
      </View>
      <Field label={t("rent.paidAmount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="pay-amount" />
      <Text style={[type.small, { color: color.ink, fontWeight: "600" }]}>{t("rent.method")}</Text>
      <View style={formStyles.row}>
        {METHODS.map((m) => (
          <Chip key={m} label={t(`rent.m.${m}`)} selected={method === m} onPress={() => setMethod(m)} />
        ))}
      </View>
      <Field label={t("rent.confirmation")} value={conf} onChangeText={setConf} placeholder={t("rent.confirmationPh")} autoCapitalize="none" />
      {msg ? <Text style={[type.small, { color: msg.ok ? color.verified : color.danger }]} testID="pay-msg">{msg.text}</Text> : null}
      <Button icon="checkmark-circle-outline" label={t("rent.logButton")} onPress={add} testID="pay-add" />
      <Text style={type.tiny}>{t("rent.receiptTip")}</Text>
    </Section>
  );
}

export default function Rent() {
  const { t } = useT();
  const setup = useRenter((s) => s.rentSetup);
  const payments = useRenter((s) => s.payments);
  const removePayment = useRenter((s) => s.removePayment);
  const remindersOn = useRenter((s) => s.remindersOn);
  const setRemindersOn = useRenter((s) => s.setRemindersOn);
  const [editing, setEditing] = useState(false);
  const [remMsg, setRemMsg] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  if (!setup || editing) {
    return (
      <ScrollView contentContainerStyle={styles.wrap} testID="rent">
        <Banner tone="info" icon="trending-up-outline" title={t("rent.introTitle")}>
          {t("rent.introBody")}
        </Banner>
        <Setup onDone={() => setEditing(false)} />
        <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
      </ScrollView>
    );
  }

  const s = rentSummary(setup, payments, now());
  const dueText = s.daysUntilDue < 0 ? t("rent.lateBy", { n: -s.daysUntilDue }) : s.daysUntilDue === 0 ? t("rent.dueToday") : t("rent.dueIn", { n: s.daysUntilDue });
  const toggleReminders = async () => {
    if (remindersOn) return setRemindersOn(false);
    if (!remindersSupported) return setRemMsg(t("rent.remWeb"));
    const ok = await askReminderPermission();
    setRemindersOn(ok);
    setRemMsg(ok ? t("rent.remOn") : t("rent.remDenied"));
  };
  const sorted = [...payments].sort((a, b) => b.month.localeCompare(a.month) || b.paidOn.localeCompare(a.paidOn));

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="rent">
      <View style={[styles.hero, s.daysUntilDue <= 2 && !s.currentMonthPaid && { borderColor: color.danger }]} testID="rent-summary">
        <Text style={type.small}>{t("rent.nextDue")}</Text>
        <Text style={type.title}>
          {usd(setup.amountCents)} · {s.nextDue}
        </Text>
        <Text style={[type.body, { color: s.daysUntilDue < 0 ? color.danger : color.ink, fontWeight: "700" }]}>{dueText}</Text>
        <View style={formStyles.row}>
          <Tag label={s.onTimeStreak ? t("rent.streak", { n: s.onTimeStreak }) : t("rent.noStreak")} tone={s.onTimeStreak ? "good" : "neutral"} />
          <Tag label={t("rent.onTimeOf", { n: s.onTimeMonths, total: s.monthsLogged })} />
        </View>
      </View>

      <LogPayment />

      <Section title={t("rent.historyTitle")}>
        {sorted.length === 0 ? <Text style={type.small}>{t("rent.noPayments")}</Text> : null}
        {sorted.map((p) => (
          <View key={p.id} style={styles.payRow} testID="payment-row">
            <Icon name={paymentTiming(p, setup) === "on_time" ? "checkmark-circle" : "time-outline"} tint={paymentTiming(p, setup) === "on_time" ? color.verified : color.warn} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>
                {p.month} · {usd(p.amountCents)}
              </Text>
              <Text style={type.tiny}>
                {t("rent.paidOnShort", { date: p.paidOn })} · {t(`rent.m.${p.method}`)}
                {p.confirmation ? ` · #${p.confirmation}` : ""}
              </Text>
            </View>
            <Pressable onPress={() => removePayment(p.id)} accessibilityRole="button" accessibilityLabel={t("rent.remove", { month: p.month })} hitSlop={10}>
              <Icon name="trash-outline" tint={color.muted} />
            </Pressable>
          </View>
        ))}
        {payments.length ? (
          <Button
            kind="secondary"
            icon="download-outline"
            label={t("rent.export")}
            testID="rent-export"
            onPress={async () => {
              const r = await saveAndShare(`rent-payments-${today(now())}.csv`, paymentsCsv(setup, payments), "text/csv", "public.comma-separated-values-text");
              setExportMsg(r === "downloaded" ? t("rent.exported") : null);
            }}
          />
        ) : null}
        {exportMsg ? <Text style={type.tiny}>{exportMsg}</Text> : null}
        <KV k={t("rent.totalLogged")} v={usd(s.totalPaidCents)} />
      </Section>

      <Section title={t("rent.remTitle")}>
        <Text style={type.small}>{t("rent.remBody")}</Text>
        <Button kind={remindersOn ? "secondary" : "primary"} icon={remindersOn ? "notifications-off-outline" : "notifications-outline"} label={remindersOn ? t("rent.remTurnOff") : t("rent.remTurnOn")} onPress={toggleReminders} testID="rent-reminders" />
        {remMsg ? <Text style={type.tiny} testID="rent-rem-msg">{remMsg}</Text> : null}
      </Section>

      <Section title={t("rent.creditTitle")}>
        <Text style={type.small}>{t("rent.creditBody")}</Text>
        <Button kind="ghost" icon="school-outline" label={t("rent.creditLink")} onPress={() => router.push("/rights?topic=rent_reporting")} />
      </Section>

      <Button kind="ghost" icon="create-outline" label={t("rent.editSetup")} onPress={() => setEditing(true)} />
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  hero: { ...formStyles.card, borderWidth: 2, borderColor: color.brand, gap: 8 },
  payRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
