/**
 * Bank statement import: paste the CSV your bank lets you download. We read it on the phone,
 * suggest which rows are rent or bill payments, and you confirm each one. No bank login, and
 * the statement is never stored or uploaded — only the payments you confirm are recorded.
 */
import { billChanges, detectIncome, findRecurring, matchTransactions, parseBankCsv, spendingSummary, type BankTxn, type TxnMatch } from "@housing-compass/core";
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
  const [txns, setTxns] = useState<BankTxn[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const read = () => {
    const p = parseBankCsv(text);
    if (p.error) {
      setErr(p.error);
      setMatches(null);
      return;
    }
    setErr(null);
    setTxns(p.txns);
    setAdded([]);
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
      {txns ? <StatementInsights txns={txns} added={added} onAdded={(k) => setAdded([...added, k])} /> : null}
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
  track: { height: 8, borderRadius: radius.md, backgroundColor: color.neutralSoft, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: color.brand },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});

function StatementInsights({ txns, added, onAdded }: { txns: BankTxn[]; added: string[]; onAdded: (k: string) => void }) {
  const { t } = useT();
  const r = useRenter();
  const sum = spendingSummary(txns);
  const recurring = findRecurring(txns, r.bills);
  const income = detectIncome(txns);
  const changes = billChanges(txns, r.bills);
  const max = Math.max(1, ...sum.ranked.map((b) => sum.byBucket[b]));
  return (
    <>
      <Section title={t("ins.spendTitle")}>
        <Text style={type.small}>{t("ins.spendBody", { days: sum.days, out: usd(sum.totalOutCents), in: usd(sum.moneyInCents) })}</Text>
        <View style={{ gap: 6 }} testID="spend-summary">
          {sum.ranked.map((b) => (
            <View key={b} style={{ gap: 2 }}>
              <View style={formStyles.row}>
                <Text style={[type.small, { flex: 1 }]}>{t(`ins.b.${b}`)}</Text>
                <Text style={[type.small, { fontWeight: "700" }]}>{usd(sum.byBucket[b])}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round((sum.byBucket[b] / max) * 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>
        <Text style={type.tiny}>{t("ins.spendNote")}</Text>
      </Section>
      {changes.length ? (
        <Section title={t("bc.title")}>
          {changes.map((c) => (
            <View key={c.billId} style={[formStyles.card, { borderColor: color.warn }]} testID="bill-change">
              <Text style={[type.small, { fontWeight: "800" }]}>{t(c.changePct > 0 ? "bc.up" : "bc.down", { name: c.name, pct: Math.abs(c.changePct) })}</Text>
              <Text style={type.tiny}>{t("bc.line", { tracked: usd(c.trackedCents), latest: usd(c.latestCents), date: c.date })}</Text>
              <Button kind="secondary" label={t("bc.update", { amount: usd(c.latestCents) })} onPress={() => r.updateBill(c.billId, { amountCents: c.latestCents })} testID="bill-change-update" />
            </View>
          ))}
          <Text style={type.tiny}>{t("bc.note")}</Text>
        </Section>
      ) : null}
      {recurring.length ? (
        <Section title={t("ins.recTitle")}>
          <Text style={type.small}>{t("ins.recBody")}</Text>
          {recurring.map((c) => {
            const key = `${c.name}:${c.amountCents}`;
            const done = added.includes(key);
            return (
              <View key={key} style={styles.row} testID="recurring-row">
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>
                    {c.name} · {usd(c.amountCents)}
                  </Text>
                  <Text style={type.tiny}>{t("ins.recLine", { n: c.count, day: c.dueDay })}</Text>
                </View>
                <Button
                  kind={done ? "ghost" : "secondary"}
                  label={done ? t("ins.added") : t("ins.addBill")}
                  disabled={done}
                  onPress={() => {
                    r.addBill({ name: c.name, amountCents: c.amountCents, dueDay: c.dueDay, category: c.category, autopay: false });
                    onAdded(key);
                  }}
                />
              </View>
            );
          })}
        </Section>
      ) : null}
      {income ? (
        <Section title={t("ins.incTitle")}>
          <Text style={type.small} testID="income-found">
            {t("ins.incBody", { freq: t(`pay.f.${income.frequency}`), amount: usd(income.amountCents), n: income.count })}
          </Text>
          {r.pay ? null : (
            <Button
              kind="secondary"
              icon="wallet-outline"
              label={t("ins.usePay")}
              testID="use-income"
              onPress={() => r.setPay({ frequency: income.frequency, amountCents: income.amountCents, anchorDate: income.lastDate })}
            />
          )}
        </Section>
      ) : null}
    </>
  );
}
