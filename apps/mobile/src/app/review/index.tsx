import { LEVEL_LABEL, type ReviewQueueItem } from "@housing-compass/core";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DemoTag, TrustBadge } from "../../components/TrustBadge";
import { Banner, Tag } from "../../components/ui";
import { decideLead, loadLeadQueue, loadQueue, reviewMode, type ReviewMode } from "../../review/service";
import { Button, Chip } from "../../components/ui";
import { formatRent, neutralLanguageIssue, type Listing } from "@housing-compass/core";
import { TextInput } from "react-native";
import { HIT, color, radius, space, type } from "../../theme";
import { openExternal } from "../../lib/links";

export default function ReviewQueue() {
  const [mode, setMode] = useState<ReviewMode | null>(null);
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [tab, setTab] = useState<"risk" | "leads">("risk");
  const [leads, setLeads] = useState<Listing[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      reviewMode()
        .then(async (m) => {
          if (!alive) return;
          setMode(m);
          setItems(await loadQueue(m));
          setLeads(await loadLeadQueue(m));
        })
        .catch((e: Error) => setError(e.message));
      return () => {
        alive = false;
      };
    }, []),
  );

  if (mode === "none") {
    return (
      <View style={styles.wrap}>
        <Banner tone="danger" icon="lock-closed-outline" title="Reviewers only">
          Ask an admin to give your account the reviewer role.
        </Banner>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {mode === "local-demo" ? (
        <Banner tone="demo" icon="flask-outline" title="Demo review mode">
          No server is connected. Decisions run through the real rules but stay on this device, and only fictional demo listings can be verified.
        </Banner>
      ) : null}
      {error ? <Banner tone="danger" icon="alert-circle-outline" title={error} /> : null}
      <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="tablist">
        <Chip label={`Risk & reports (${items.length})`} selected={tab === "risk"} onPress={() => setTab("risk")} />
        <Chip label={`Research leads (${leads.length})`} selected={tab === "leads"} onPress={() => setTab("leads")} />
      </View>
      {tab === "leads" ? (
        <View style={{ gap: space.md }}>
          <Text style={type.small}>Open the source page. If the ad is still posted at this price, mark “Still posted” (keeps it from expiring as an unverified lead). If it's gone or wrong, reject it. Neither step verifies the listing — use the six-check form for that.</Text>
          <TextInput value={reason} onChangeText={setReason} placeholder="What you saw (e.g. 'Ad still up at $815 on Nov 2')" style={styles.input} accessibilityLabel="Lead decision reason" />
          {leads.slice(0, 50).map((l) => (
            <View key={l.id} style={styles.item} testID="lead-item">
              <Text style={type.h3}>{l.title}</Text>
              <Text style={type.tiny}>
                {l.address.city} · {formatRent(l)} · {l.intake?.rawLabel}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {l.source.searchPageUrls[0] ? <Button kind="ghost" label="Open source ↗" onPress={() => openExternal(l.source.searchPageUrls[0]!)} /> : <Text style={type.tiny}>No source recorded — reject unless you can find it.</Text>}
                <Button kind="secondary" label="Still posted" disabled={!!neutralLanguageIssue(reason) || !l.source.searchPageUrls.length} onPress={async () => { await decideLead(mode!, l, "source_found", reason); setLeads((x) => x.filter((y) => y.id !== l.id)); }} />
                <Button kind="danger" label="Reject" disabled={!!neutralLanguageIssue(reason)} onPress={async () => { await decideLead(mode!, l, "reject", reason); setLeads((x) => x.filter((y) => y.id !== l.id)); }} />
              </View>
            </View>
          ))}
          {leads.length > 50 ? <Text style={type.tiny}>Showing 50 of {leads.length}.</Text> : null}
        </View>
      ) : null}
      {tab === "risk" ? <Text style={type.small}>{items.length} item(s) waiting. Highest risk first.</Text> : null}
      {(tab === "risk" ? items : []).map((it) => (
        <Pressable
          key={it.listing.id}
          onPress={() => router.push(`/review/${encodeURIComponent(it.listing.id)}`)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.item, pressed && { opacity: 0.9 }]}
          testID="review-item"
        >
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {it.listing.isDemo ? <DemoTag /> : null}
            <TrustBadge listing={it.listing} />
            {it.holdSignals ? <Tag label={`${it.holdSignals} hold signal${it.holdSignals > 1 ? "s" : ""}`} tone="warn" /> : null}
            {it.openReports ? <Tag label={`${it.openReports} report${it.openReports > 1 ? "s" : ""}`} tone="warn" /> : null}
            {it.openAppeals ? <Tag label="Appeal" /> : null}
          </View>
          <Text style={type.h3}>{it.listing.title}</Text>
          <Text style={type.tiny}>
            {it.listing.address.city} · {LEVEL_LABEL[it.listing.verification.level]} · {it.reportReasons.join(", ").replace(/_/g, " ") || "no reports"}
          </Text>
        </Pressable>
      ))}
      {mode && tab === "risk" && items.length === 0 ? <Text style={type.small}>Nothing to review. 🎉</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, maxWidth: 820, width: "100%", alignSelf: "center" },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 15, color: color.ink, backgroundColor: color.surface },
  item: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: 6, borderWidth: 1, borderColor: color.line },
});
