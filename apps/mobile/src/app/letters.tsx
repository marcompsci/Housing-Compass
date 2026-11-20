/**
 * Letters: ask your landlord to report on-time rent to a credit bureau (Civil Code §1954.07),
 * or ask a landlord or utility for a payment plan. Made on the phone; you send it yourself.
 * General information, not legal advice.
 */
import { paymentPlanRequest, rentReportingRequest } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today } from "../components/forms";
import { Banner, Button, Chip, Section } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

export default function Letters() {
  const { t } = useT();
  const rent = useRenter((s) => s.rentSetup);
  const moveIn = useRenter((s) => s.moveIn);
  const [name, setName] = useState("");
  const [landlord, setLandlord] = useState(rent?.payee ?? "");
  const [address, setAddress] = useState(moveIn?.address ?? "");
  const [kind, setKind] = useState<"rent" | "utility">("rent");
  const [to, setTo] = useState("");
  const [account, setAccount] = useState("");
  const [owed, setOwed] = useState("");
  const [payments, setPayments] = useState("3");
  const [start, setStart] = useState(today(now()));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const d = today(now());

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="letters">
      <Banner tone="info" icon="mail-outline" title={t("let.title")}>
        {t("let.intro")}
      </Banner>
      <Field label={t("move.yourName")} value={name} onChangeText={setName} testID="let-name" />

      <Section title={t("let.rrTitle")}>
        <Text style={type.small}>{t("let.rrBody")}</Text>
        <Field label={t("let.landlord")} value={landlord} onChangeText={setLandlord} />
        <Field label={t("move.address")} value={address} onChangeText={setAddress} />
        <Button icon="document-text-outline" label={t("let.make")} testID="let-rr" onPress={() => void saveAndShare(`rent-reporting-request-${d}.txt`, rentReportingRequest({ tenantName: name.trim(), address: address.trim(), landlord: landlord.trim(), today: d }), "text/plain", "public.plain-text")} />
      </Section>

      <Section title={t("let.ppTitle")}>
        <Text style={type.small}>{t("let.ppBody")}</Text>
        <View style={formStyles.row}>
          <Chip label={t("let.kRent")} selected={kind === "rent"} onPress={() => setKind("rent")} />
          <Chip label={t("let.kUtility")} selected={kind === "utility"} onPress={() => setKind("utility")} />
        </View>
        <Field label={kind === "rent" ? t("let.landlord") : t("let.utility")} value={to} onChangeText={setTo} />
        <Field label={kind === "rent" ? t("let.unit") : t("let.account")} value={account} onChangeText={setAccount} autoCapitalize="none" />
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("let.owed")} value={owed} onChangeText={setOwed} keyboardType="decimal-pad" testID="let-owed" />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("let.payments")} value={payments} onChangeText={setPayments} keyboardType="number-pad" />
          </View>
        </View>
        <Field label={t("let.start")} value={start} onChangeText={setStart} autoCapitalize="none" />
        <Field label={t("let.reason")} value={reason} onChangeText={setReason} placeholder={t("let.reasonPh")} hint={t("let.reasonHint")} />
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="document-text-outline"
          label={t("let.make")}
          testID="let-pp"
          onPress={() => {
            const c = toCents(owed);
            if (!(c > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return setErr(t("let.err"));
            setErr(null);
            void saveAndShare(`payment-plan-request-${d}.txt`, paymentPlanRequest({ kind, tenantName: name.trim(), to: to.trim(), account: account.trim(), amountDueCents: c, payments: Number(payments) || 1, startDate: start, reason: reason.trim().slice(0, 200), today: d }), "text/plain", "public.plain-text");
          }}
        />
      </Section>
      <Text style={type.tiny}>{t("let.footer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
