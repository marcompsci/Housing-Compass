/**
 * Quick setup: three short steps — rent, paycheck, first bills — so My plan, reminders and the
 * paycheck planner work right away. Every step can be skipped.
 */
import { validateBill } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents } from "../components/forms";
import { PaySetupForm } from "../components/PaySetupForm";
import { Banner, Button, Chip, Section } from "../components/ui";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

export default function Setup() {
  const { t } = useT();
  const r = useRenter();
  const [step, setStep] = useState(0);
  const [rent, setRent] = useState(r.rentSetup ? String(r.rentSetup.amountCents / 100) : "");
  const [due, setDue] = useState(r.rentSetup ? String(r.rentSetup.dueDay) : "1");
  const [bill, setBill] = useState("");
  const [billAmt, setBillAmt] = useState("");
  const [billDay, setBillDay] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const finish = () => {
    r.setSetupDone(true);
    if (router.canGoBack()) router.back();
    else router.replace("/money");
  };
  const steps = [t("setup.s1"), t("setup.s2"), t("setup.s3")];

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="setup">
      <View style={formStyles.row} accessibilityRole="progressbar" accessibilityLabel={t("setup.stepOf", { n: step + 1, total: 3 })}>
        {steps.map((s, i) => (
          <Chip key={s} label={`${i + 1}. ${s}`} selected={i === step} onPress={() => setStep(i)} />
        ))}
      </View>

      {step === 0 ? (
        <Section title={t("setup.rentTitle")}>
          <Text style={type.small}>{t("setup.rentBody")}</Text>
          <Field label={t("rent.amount")} value={rent} onChangeText={setRent} keyboardType="decimal-pad" testID="setup-rent" />
          <Field label={t("rent.dueDay")} value={due} onChangeText={setDue} keyboardType="number-pad" testID="setup-due" />
          {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
          <Button
            label={t("setup.next")}
            testID="setup-next-1"
            onPress={() => {
              const c = toCents(rent);
              const d = Number(due);
              if (!(c > 0) || !(d >= 1 && d <= 31)) return setErr(t("rent.errAmount"));
              setErr(null);
              r.setRentSetup({ amountCents: c, dueDay: d, graceDays: r.rentSetup?.graceDays ?? 0, payee: r.rentSetup?.payee ?? "" });
              setStep(1);
            }}
          />
          <Button kind="ghost" label={t("setup.skip")} onPress={() => setStep(1)} />
        </Section>
      ) : null}

      {step === 1 ? (
        <Section title={t("setup.payTitle")}>
          <Text style={type.small}>{t("setup.payBody")}</Text>
          <PaySetupForm onSaved={() => setStep(2)} />
          <Button kind="ghost" label={t("setup.skip")} onPress={() => setStep(2)} />
        </Section>
      ) : null}

      {step === 2 ? (
        <Section title={t("setup.billsTitle")}>
          <Text style={type.small}>{t("setup.billsBody")}</Text>
          {r.bills.length ? <Text style={type.small}>{t("plan.billsCount", { n: r.bills.length })}</Text> : null}
          <Field label={t("bills.name")} value={bill} onChangeText={setBill} placeholder={t("bills.namePh")} testID="setup-bill-name" />
          <View style={formStyles.row}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Field label={t("bills.amount")} value={billAmt} onChangeText={setBillAmt} keyboardType="decimal-pad" testID="setup-bill-amount" />
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Field label={t("rent.dueDay")} value={billDay} onChangeText={setBillDay} keyboardType="number-pad" testID="setup-bill-day" />
            </View>
          </View>
          {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
          <Button
            kind="secondary"
            icon="add-circle-outline"
            label={t("bills.add")}
            testID="setup-bill-add"
            onPress={() => {
              const b = { name: bill.trim(), amountCents: toCents(billAmt), dueDay: Number(billDay), category: "other" as const, autopay: false };
              const e = validateBill(b);
              if (e) return setErr(e);
              setErr(null);
              r.addBill(b);
              setBill("");
              setBillAmt("");
              setBillDay("");
            }}
          />
          <Button icon="checkmark-circle-outline" label={t("setup.done")} onPress={finish} testID="setup-done" />
        </Section>
      ) : null}

      <Banner tone="info" icon="lock-closed-outline" title={t("setup.privateTitle")}>
        {t("plan.privacy")}
      </Banner>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
