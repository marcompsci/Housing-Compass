/**
 * Letters: ask your landlord to report on-time rent to a credit bureau (Civil Code §1954.07),
 * or ask a landlord or utility for a payment plan. Made on the phone; you send it yourself.
 * General information, not legal advice.
 */
import { BUREAUS, disputeLetter, lateFeeWaiverLetter, paymentPlanRequest, rentReportingRequest, type Bureau } from "@housing-compass/core";
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
  const [bureau, setBureau] = useState<Bureau>("equifax");
  const [mail, setMail] = useState("");
  const [item, setItem] = useState("");
  const [why, setWhy] = useState("");
  const [dlErr, setDlErr] = useState<string | null>(null);
  const [lfCo, setLfCo] = useState("");
  const [lfFee, setLfFee] = useState("");
  const [lfPaid, setLfPaid] = useState("");
  const [lfWhy, setLfWhy] = useState("");

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
      <Section title={t("lf.title")}>
        <Text style={type.small}>{t("lf.body")}</Text>
        <Field label={t("win.company")} value={lfCo} onChangeText={setLfCo} testID="lf-company" />
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("lf.fee")} value={lfFee} onChangeText={setLfFee} keyboardType="decimal-pad" testID="lf-fee" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("lf.paidOn")} value={lfPaid} onChangeText={setLfPaid} autoCapitalize="none" placeholder={d} />
          </View>
        </View>
        <Field label={t("lf.why")} value={lfWhy} onChangeText={setLfWhy} placeholder={t("lf.whyPh")} />
        <Button icon="document-text-outline" label={t("let.make")} testID="let-lf" onPress={() => void saveAndShare(`late-fee-waiver-${d}.txt`, lateFeeWaiverLetter({ name: name.trim(), company: lfCo.trim(), account: "", feeCents: lfFee.trim() ? toCents(lfFee) : 0, paidOn: lfPaid.trim(), reason: lfWhy.trim(), today: d }), "text/plain", "public.plain-text")} />
        <Text style={type.tiny}>{t("lf.note")}</Text>
      </Section>

      <Section title={t("dl.title")}>
        <Text style={type.small}>{t("dl.body")}</Text>
        <View style={formStyles.row}>
          {BUREAUS.map((b) => (
            <Chip key={b} label={t(`ct.b.${b}`)} selected={bureau === b} onPress={() => setBureau(b)} />
          ))}
        </View>
        <Field label={t("dl.address")} value={mail} onChangeText={setMail} />
        <Field label={t("ct.item")} value={item} onChangeText={setItem} placeholder={t("dl.itemPh")} testID="dl-item" />
        <Field label={t("dl.why")} value={why} onChangeText={setWhy} placeholder={t("dl.whyPh")} />
        {dlErr ? <Text style={[type.small, { color: color.danger }]}>{dlErr}</Text> : null}
        <Button
          icon="document-text-outline"
          label={t("let.make")}
          testID="let-dl"
          onPress={() => {
            if (item.trim().length < 3) return setDlErr(t("dl.err"));
            setDlErr(null);
            void saveAndShare(`credit-dispute-${bureau}-${d}.txt`, disputeLetter({ name: name.trim(), address: mail.trim(), bureau, item: item.trim(), why: why.trim(), today: d }), "text/plain", "public.plain-text");
          }}
        />
        <Text style={type.tiny}>{t("dl.note")}</Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
