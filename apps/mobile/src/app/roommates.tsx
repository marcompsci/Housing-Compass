/**
 * Roommates: a simple who-owes-whom list and a ready-to-send "your share" message.
 * Nothing is sent automatically; the share sheet lets the user pick the app. Device-only.
 */
import { iouBalances, shareMessage } from "@housing-compass/core";
import { useState } from "react";
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, Section } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

export default function RoommatesRoute() {
  return (
    <LockGate>
      <Roommates />
    </LockGate>
  );
}

function Roommates() {
  const { t } = useT();
  const r = useRenter();
  const bal = iouBalances(r.ious);
  const people = [...new Set(r.ious.map((x) => x.person))].slice(0, 8);
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [dir, setDir] = useState<"owes_me" | "i_owe">("owes_me");
  const [err, setErr] = useState<string | null>(null);
  const [bill, setBill] = useState(r.bills[0]?.name ?? "");
  const [total, setTotal] = useState(r.bills[0] ? String(r.bills[0].amountCents / 100) : "");
  const [ways, setWays] = useState("2");
  const [payTo, setPayTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const n = Math.max(2, Math.min(10, Math.round(Number(ways) || 2)));

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="roommates">
      <Banner tone="info" icon="people-outline" title={t("rm.title")}>
        {t("rm.intro")}
      </Banner>

      <Section title={t("rm.balances")}>
        {bal.people.length ? (
          bal.people.map((p) => (
            <View key={p.person} style={styles.row} testID="iou-balance">
              <Icon name={p.cents > 0 ? "arrow-down-circle-outline" : "arrow-up-circle-outline"} tint={p.cents > 0 ? color.verified : color.warn} />
              <Text style={[type.body, { flex: 1 }]}>{p.cents > 0 ? t("rm.owesYou", { name: p.person, amount: usd(p.cents) }) : t("rm.youOwe", { name: p.person, amount: usd(-p.cents) })}</Text>
              <Button kind="secondary" label={t("rm.settle")} onPress={() => r.settlePerson(p.person)} testID="iou-settle" />
            </View>
          ))
        ) : (
          <Text style={type.small}>{t("rm.even")}</Text>
        )}
        {people.length ? (
          <View style={formStyles.row}>
            {people.map((p) => (
              <Chip key={p} label={p} selected={person === p} onPress={() => setPerson(p)} />
            ))}
          </View>
        ) : null}
        <View style={formStyles.row}>
          <Chip label={t("rm.owesMe")} selected={dir === "owes_me"} onPress={() => setDir("owes_me")} />
          <Chip label={t("rm.iOwe")} selected={dir === "i_owe"} onPress={() => setDir("i_owe")} />
        </View>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("rm.person")} value={person} onChangeText={setPerson} testID="iou-person" />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("side.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="iou-amount" />
          </View>
        </View>
        <Field label={t("rm.for")} value={note} onChangeText={setNote} testID="iou-note" />
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="add-circle-outline"
          label={t("rm.add")}
          testID="iou-add"
          onPress={() => {
            const c = toCents(amount);
            if (person.trim().length < 1 || !(c > 0)) return setErr(t("rm.err"));
            r.addIou({ date: today(now()), person: person.trim().slice(0, 40), amountCents: dir === "owes_me" ? c : -c, note: note.trim().slice(0, 80) });
            setAmount("");
            setNote("");
            setErr(null);
          }}
        />
        {r.ious.filter((x) => !x.settled).slice(0, 20).map((x) => (
          <View key={x.id} style={styles.row}>
            <Text style={[type.tiny, { flex: 1 }]}>
              {x.date} · {x.person}
              {x.note ? ` · ${x.note}` : ""}
            </Text>
            <Text style={[type.small, { fontWeight: "700", color: x.amountCents > 0 ? color.verified : color.warn }]}>{usd(Math.abs(x.amountCents))}</Text>
            <Pressable onPress={() => r.removeIou(x.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: x.person })} hitSlop={10}>
              <Icon name="trash-outline" size={16} tint={color.muted} />
            </Pressable>
          </View>
        ))}
      </Section>

      <Section title={t("rm.shareTitle")}>
        <Text style={type.small}>{t("rm.shareBody")}</Text>
        {r.bills.length ? (
          <View style={formStyles.row}>
            {r.bills.slice(0, 8).map((b) => (
              <Chip key={b.id} label={b.name} selected={bill === b.name} onPress={() => (setBill(b.name), setTotal(String(b.amountCents / 100)))} />
            ))}
          </View>
        ) : null}
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("rm.bill")} value={bill} onChangeText={setBill} testID="share-bill" />
          </View>
          <View style={{ flex: 1, minWidth: 100 }}>
            <Field label={t("rm.total")} value={total} onChangeText={setTotal} keyboardType="decimal-pad" testID="share-total" />
          </View>
          <View style={{ flex: 1, minWidth: 80 }}>
            <Field label={t("rm.ways")} value={ways} onChangeText={setWays} keyboardType="number-pad" testID="share-ways" />
          </View>
        </View>
        <Field label={t("rm.payTo")} value={payTo} onChangeText={setPayTo} placeholder={t("rm.payToPh")} testID="share-payto" />
        <Button
          kind="secondary"
          icon="chatbubble-ellipses-outline"
          label={t("rm.write")}
          testID="share-write"
          onPress={() => {
            const tc = toCents(total);
            if (bill.trim().length < 2 || !(tc > 0)) return setMsg(null);
            const b = r.bills.find((x) => x.name === bill.trim());
            const td = today(now());
            const nextDue = (day: number) => {
              const [y, m] = td.split("-").map(Number) as [number, number];
              const s = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(day, 28)).padStart(2, "0")}`;
              const here = s(y, m);
              return here >= td ? here : m === 12 ? s(y + 1, 1) : s(y, m + 1);
            };
            const due = b ? nextDue(b.dueDay) : null;
            setMsg(shareMessage({ bill: bill.trim(), totalCents: tc, shareCents: Math.ceil(tc / n), dueDate: due, payTo }));
          }}
        />
        {msg ? (
          <View style={formStyles.card} testID="share-msg">
            <Text style={type.body} selectable>
              {msg}
            </Text>
            {Platform.OS !== "web" ? <Button icon="share-outline" label={t("rm.send")} onPress={() => void Share.share({ message: msg })} /> : <Text style={type.tiny}>{t("rm.copy")}</Text>}
          </View>
        ) : null}
        <Text style={type.tiny}>{t("rm.note")}</Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
