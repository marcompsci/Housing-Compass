/** Manager form: request a change to one listing. A reviewer approves it before anything changes. */
import { describeEdit, formatUsd, type ListingEditChanges } from "@housing-compass/core";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useListing } from "../data/hooks";
import { myEditRequests, requestEdit, type EditRequest } from "../review/service";
import { HIT, color, radius, space, type } from "../theme";
import { Banner, Button, Tag } from "./ui";

const dollarsToCents = (s: string) => (s.trim() ? Math.round(Number(s.replace(/[$,\s]/g, "")) * 100) : undefined);

export function EditRequestForm({ listingId }: { listingId: string }) {
  const { listing: l } = useListing(listingId);
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [fee, setFee] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [available, setAvailable] = useState(false);
  const [leased, setLeased] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [history, setHistory] = useState<EditRequest[]>([]);
  useEffect(() => {
    void myEditRequests([listingId]).then(setHistory);
  }, [listingId]);
  if (!l) return <Text style={type.small}>Loading…</Text>;

  const changes: ListingEditChanges = leased
    ? { markLeased: true }
    : {
        ...(dollarsToCents(rent) !== undefined ? { baseRentCents: dollarsToCents(rent) } : {}),
        ...(dollarsToCents(deposit) !== undefined ? { depositCents: dollarsToCents(deposit) } : {}),
        ...(dollarsToCents(fee) !== undefined ? { applicationFeeCents: dollarsToCents(fee) } : {}),
        ...(moveIn.trim() ? { moveInDate: moveIn.trim() } : {}),
        ...(available ? { confirmAvailable: true as const } : {}),
      };

  return (
    <View style={styles.box} testID="edit-form">
      <Text style={type.small}>Changes go to a reviewer first. Listed now: {formatUsd(l.pricing.baseRentCents)} rent · deposit {l.pricing.depositCents === null ? "not stated" : formatUsd(l.pricing.depositCents)} · fee {l.pricing.applicationFeeCents === null ? "not stated" : formatUsd(l.pricing.applicationFeeCents)}</Text>
      <View style={styles.row}>
        <Text style={[type.body, { flex: 1 }]}>Mark as rented (hide it)</Text>
        <Switch value={leased} onValueChange={setLeased} trackColor={{ true: color.brand, false: color.line }} accessibilityLabel="Mark as rented" />
      </View>
      {!leased ? (
        <>
          <TextInput value={rent} onChangeText={setRent} placeholder="New monthly rent ($)" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="New monthly rent" testID="edit-rent" />
          <TextInput value={deposit} onChangeText={setDeposit} placeholder="Security deposit ($)" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Security deposit" />
          <TextInput value={fee} onChangeText={setFee} placeholder="Application fee per applicant ($)" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Application fee" />
          <TextInput value={moveIn} onChangeText={setMoveIn} placeholder="Move-in date (YYYY-MM-DD)" autoCapitalize="none" style={styles.input} accessibilityLabel="Move-in date" />
          <View style={styles.row}>
            <Text style={[type.body, { flex: 1 }]}>It's still available today</Text>
            <Switch value={available} onValueChange={setAvailable} trackColor={{ true: color.brand, false: color.line }} accessibilityLabel="Still available today" />
          </View>
        </>
      ) : null}
      <TextInput value={note} onChangeText={setNote} placeholder="Note for the reviewer (what changed, since when)" multiline style={[styles.input, { minHeight: HIT * 1.5 }]} accessibilityLabel="Note for the reviewer" testID="edit-note" />
      {describeEdit(l, changes).map((d) => (
        <Text key={d} style={type.tiny}>• {d}</Text>
      ))}
      {msg ? <Banner tone={msg.tone} icon={msg.tone === "info" ? "checkmark-circle-outline" : "alert-circle-outline"} title={msg.text} /> : null}
      <Button
        label="Send for review"
        icon="send-outline"
        testID="send-edit"
        onPress={async () => {
          try {
            const r = await requestEdit(l, changes, note);
            setHistory((h) => [r, ...h]);
            setMsg({ tone: "info", text: r.demo ? "Sent (demo): try approving it in Reviewer tools → Listing edits." : "Sent. A reviewer will check it, usually within a day." });
            setRent(""); setDeposit(""); setFee(""); setMoveIn(""); setAvailable(false); setLeased(false); setNote("");
          } catch (e) {
            setMsg({ tone: "danger", text: (e as Error).message });
          }
        }}
      />
      {history.length ? <Text style={type.h3}>Your requests</Text> : null}
      {history.map((r) => (
        <View key={r.id} style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Tag label={r.status === "open" ? "Waiting for review" : r.status === "approved" ? "Approved" : "Not approved"} tone={r.status === "approved" ? "good" : r.status === "open" ? "warn" : "neutral"} />
          <Text style={[type.tiny, { flexShrink: 1 }]}>{describeEdit(l, r.changes).join(" · ")}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: HIT },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: color.ink, backgroundColor: color.surface },
});
