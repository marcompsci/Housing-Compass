import { LEVEL_LABEL, type ReviewQueueItem } from "@housing-compass/core";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DemoTag, TrustBadge } from "../../components/TrustBadge";
import { Banner, Tag } from "../../components/ui";
import { loadEditRequests, loadHeld, loadLandlordApps, loadLeadQueue, loadQueue, reviewMode, type EditRequest, type HeldItem, type LandlordApp, type ReviewMode } from "../../review/service";
import { EditsTab, HeldTab, LandlordTab, LeadExpiryTab } from "../../components/ReviewTabs";
import { Button, Chip } from "../../components/ui";
import { formatRent, neutralLanguageIssue, type Listing } from "@housing-compass/core";
import { TextInput } from "react-native";
import { HIT, color, radius, space, type } from "../../theme";
import { openExternal } from "../../lib/links";

export default function ReviewQueue() {
  const [mode, setMode] = useState<ReviewMode | null>(null);
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [tab, setTab] = useState<"risk" | "leads" | "held" | "landlords" | "edits">("risk");
  const [edits, setEdits] = useState<EditRequest[]>([]);
  const [leads, setLeads] = useState<Listing[]>([]);
  const [held, setHeld] = useState<HeldItem[]>([]);
  const [apps, setApps] = useState<LandlordApp[]>([]);
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
          setHeld(await loadHeld(m));
          setApps(await loadLandlordApps(m));
          setEdits(await loadEditRequests(m));
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
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }} accessibilityRole="tablist">
        <Chip label={`Risk & reports (${items.length})`} selected={tab === "risk"} onPress={() => setTab("risk")} />
        <Chip label={`Research leads (${leads.length})`} selected={tab === "leads"} onPress={() => setTab("leads")} />
        <Chip label={`Held messages (${held.length})`} selected={tab === "held"} onPress={() => setTab("held")} />
        <Chip label={`Landlords (${apps.length})`} selected={tab === "landlords"} onPress={() => setTab("landlords")} />
        <Chip label={`Listing edits (${edits.length})`} selected={tab === "edits"} onPress={() => setTab("edits")} />
      </View>
      {tab === "edits" && mode ? <EditsTab mode={mode} items={edits} onDone={(id) => setEdits((x) => x.filter((y) => y.id !== id))} /> : null}
      {tab === "held" && mode ? <HeldTab mode={mode} items={held} onDone={(id) => setHeld((x) => x.filter((y) => y.id !== id))} /> : null}
      {tab === "landlords" && mode ? <LandlordTab mode={mode} apps={apps} onDone={(id) => setApps((x) => x.filter((y) => y.id !== id))} /> : null}
      {tab === "leads" && mode ? <LeadExpiryTab mode={mode} leads={leads} onDone={(id) => setLeads((x) => x.filter((y) => y.id !== id))} /> : null}
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
