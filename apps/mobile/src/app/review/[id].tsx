import {
  CHECK_LABEL,
  VERIFICATION_CHECKS,
  detectAll,
  evidenceGaps,
  formatRent,
  neutralLanguageIssue,
  type EvidenceEntry,
  type ReviewDecision,
} from "@housing-compass/core";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { TrustPanel } from "../../components/TrustBadge";
import { Banner, Button, Chip, KV, Section } from "../../components/ui";
import { now } from "../../config";
import { useListing, useListingCache } from "../../data/hooks";
import { addressText } from "../../lib/format";
import { decide, reviewMode, type ReviewMode } from "../../review/service";
import { useStore } from "../../state/store";
import { HIT, color, radius, space, type } from "../../theme";

const KINDS: EvidenceEntry["kind"][] = ["official_record", "document", "phone_call", "email", "site_visit", "tour"];

export default function ReviewItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = decodeURIComponent(String(id));
  const { listing } = useListing(listingId);
  const byId = useListingCache((s) => s.byId);
  const others = Object.values(byId);
  const allReports = useStore((s) => s.reports);
  const reports = allReports.filter((r) => r.listingId === listingId);
  const [mode, setMode] = useState<ReviewMode | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [evidence, setEvidence] = useState<EvidenceEntry[]>(VERIFICATION_CHECKS.map((check) => ({ check, passed: false, kind: "phone_call", independentSource: "", notes: "" })));

  useEffect(() => {
    void reviewMode().then(setMode);
  }, []);

  if (!listing) return <Text style={{ padding: space.xl }}>Loading…</Text>;
  const signals = listing.verification.signals.length ? listing.verification.signals : detectAll(listing, { others, managers: [], now: now() });
  const gaps = evidenceGaps(evidence);
  const languageIssue = neutralLanguageIssue(reason);
  const patch = (i: number, p: Partial<EvidenceEntry>) => setEvidence((e) => e.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const run = async (d: ReviewDecision) => {
    setBusy(true);
    setMsg(null);
    try {
      const next = await decide(mode!, listing, d, reason, evidence);
      setMsg({ tone: "info", text: `Saved. Listing is now: ${next.verification.level.replace(/_/g, " ").toLowerCase()}.` });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={type.title}>{listing.title}</Text>
      <Text style={type.small}>
        {addressText(listing)} · {formatRent(listing)}
      </Text>
      <TrustPanel listing={listing} />

      <Section title="Risk signals (for review, not a verdict)">
        {signals.length === 0 ? <Text style={type.small}>No automated signals.</Text> : null}
        {signals.map((s, i) => (
          <KV key={i} k={`${s.severity.toUpperCase()} · ${s.code.replace(/_/g, " ").toLowerCase()}`} v={s.message} />
        ))}
        {reports.map((r) => (
          <KV key={r.id} k={`User report · ${r.reason.replace(/_/g, " ")}`} v={r.details || "(no details)"} />
        ))}
        {listing.description ? <Text style={[type.small, { fontStyle: "italic" }]}>“{listing.description}”</Text> : null}
      </Section>

      <Section title="Six-check verification">
        <Text style={type.tiny}>Contact the manager using a number or email you found yourself (official website, county records), never one from the ad.</Text>
        {evidence.map((e, i) => (
          <View key={e.check} style={styles.check}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Switch value={e.passed} onValueChange={(v) => patch(i, { passed: v })} accessibilityLabel={`${CHECK_LABEL[e.check]} confirmed`} trackColor={{ true: color.brand, false: color.line }} />
              <Text style={[type.h3, { flex: 1, fontSize: 15 }]}>{CHECK_LABEL[e.check]}</Text>
            </View>
            {e.passed ? (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {KINDS.map((k) => (
                    <Chip key={k} label={k.replace(/_/g, " ")} selected={e.kind === k} onPress={() => patch(i, { kind: k })} />
                  ))}
                </View>
                {e.check === "contact_channel" ? (
                  <TextInput value={e.independentSource} onChangeText={(t) => patch(i, { independentSource: t })} placeholder="Where you found the contact (e.g. manager's official site)" style={styles.input} accessibilityLabel="Independent source" />
                ) : null}
                <TextInput value={e.notes} onChangeText={(t) => patch(i, { notes: t })} placeholder="What you saw or were told, with date" style={styles.input} accessibilityLabel={`${CHECK_LABEL[e.check]} notes`} />
              </>
            ) : null}
          </View>
        ))}
        {gaps.length ? <Text style={[type.tiny, { color: color.warn }]}>Before verifying: {gaps.join(" · ")}</Text> : <Text style={[type.tiny, { color: color.verified }]}>All six checks have evidence.</Text>}
      </Section>

      <Section title="Decision">
        <TextInput value={reason} onChangeText={setReason} placeholder="Reason, in neutral words (what you checked or found)" style={[styles.input, { minHeight: 70 }]} multiline accessibilityLabel="Decision reason" />
        {reason && languageIssue ? <Text style={[type.tiny, { color: color.danger }]}>{languageIssue}</Text> : null}
        <Button label="Mark manager-verified" icon="checkmark-circle-outline" disabled={busy || !!languageIssue || gaps.length > 0 || !mode} onPress={() => run("verify")} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button style={{ flex: 1 }} kind="secondary" label="Clear flag (unverified)" disabled={busy || !!languageIssue || listing.verification.level !== "FLAGGED"} onPress={() => run("clear_flag")} />
          <Button style={{ flex: 1 }} kind="secondary" label="Expire" disabled={busy || !!languageIssue} onPress={() => run("expire")} />
        </View>
        <Button kind="danger" label="Remove from app" disabled={busy || !!languageIssue} onPress={() => run("remove")} />
        {msg ? <Banner tone={msg.tone} icon={msg.tone === "info" ? "checkmark-circle-outline" : "alert-circle-outline"} title={msg.text} /> : null}
        <Button kind="ghost" label="Back to queue" onPress={() => router.back()} />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 820, width: "100%", alignSelf: "center" },
  check: { gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: color.ink, backgroundColor: color.surface },
});
