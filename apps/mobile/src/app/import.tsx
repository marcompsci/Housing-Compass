/**
 * Bank statement import: paste the CSV your bank lets you download. We read it on the phone,
 * suggest which rows are rent or bill payments, and you confirm each one. No bank login, and
 * the statement is never stored or uploaded — only the payments you confirm are recorded.
 */
import { matchTransactions, parseBankCsv, type TxnMatch } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formStyles, usd } from "../components/forms";
import { Banner, Button, Icon, Section, Tag } from "../components/ui";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

export default function Import() {
  return (
    <LockGate>
      <ImportScreen />
    </LockGate>
  );
}

function ImportScreen() {
  const { t } = useT();
  const r = useRenter();
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<TxnMatch[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const read = () => {
    const p = parseBankCsv(text);
    if (p.error) {
      setErr(p.error);
      setMatches(null);
      return;
    }
    setErr(null);
    const m = matchTransactions(p.txns, { rent: r.rentSetup, rentPayments: r.payments, bills: r.bills, billPaid: r.billPaid });
    setMatches(m);
    setPicked(new Set(m.map((x, i) => (x.confidence === "high" ? i : -1)).filter((i) => i >= 0)));
    setInfo(t("imp.read", { n: p.txns.length, skipped: p.skipped, found: m.length }));
  };

  const apply = () => {
    if (!matches) return;
    let n = 0;
    matches.forEach((m, i) => {
      if (!picked.has(i)) return;
      if (m.target.kind === "rent") r.addPayment({ month: m.target.month, paidOn: m.txn.date, amountCents: -m.txn.amountCents, method: "bank_transfer", confirmation: "" });
      else r.markBillPaid(m.target.billId, m.target.month);
      n++;
    });
    setMatches(null);
    setText("");
    setInfo(t("imp.applied", { n }));
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="import">
      <Banner tone="info" icon="cloud-upload-outline" title={t("imp.title")}>
        {t("imp.intro")}
      </Banner>
      {!r.rentSetup && !r.bills.length ? <Text style={[type.small, { color: color.danger }]}>{t("imp.needSetup")}</Text> : null}
      <Text style={[type.small, { fontWeight: "600", color: color.ink }]}>{t("imp.paste")}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={"Date,Description,Amount\n11/01/2026,OAK STREET APTS,-1400.00"}
        placeholderTextColor={color.muted}
        style={styles.box}
        accessibilityLabel={t("imp.paste")}
        testID="csv-input"
      />
      <Button icon="search-outline" label={t("imp.find")} onPress={read} disabled={!text.trim()} testID="csv-read" />
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      {info ? <Text style={type.small} testID="imp-info">{info}</Text> : null}

      {matches ? (
        <Section title={t("imp.review")}>
          {matches.length === 0 ? <Text style={type.small}>{t("imp.none")}</Text> : null}
          {matches.map((m, i) => {
            const on = picked.has(i);
            return (
              <Pressable
                key={i}
                style={styles.row}
                onPress={() => {
                  const next = new Set(picked);
                  if (on) next.delete(i);
                  else next.add(i);
                  setPicked(next);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                testID="match-row"
              >
                <Icon name={on ? "checkbox" : "square-outline"} size={22} tint={on ? color.brand : color.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{m.label}</Text>
                  <Text style={type.tiny}>
                    {m.txn.date} · {m.txn.description} · {usd(-m.txn.amountCents)}
                  </Text>
                </View>
                <Tag label={t(m.confidence === "high" ? "imp.likely" : "imp.check")} tone={m.confidence === "high" ? "good" : "warn"} />
              </Pressable>
            );
          })}
          {matches.length ? <Button icon="checkmark-done-outline" label={t("imp.apply", { n: picked.size })} onPress={apply} disabled={!picked.size} testID="match-apply" /> : null}
        </Section>
      ) : null}
      <View style={formStyles.card}>
        <Text style={type.h3}>{t("imp.howTitle")}</Text>
        <Text style={type.small}>{t("imp.how")}</Text>
      </View>
      <Text style={type.tiny}>{t("imp.privacy")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  box: { minHeight: 140, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: 12, fontSize: 14, color: color.ink, backgroundColor: color.surface, textAlignVertical: "top", fontFamily: "Courier" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
