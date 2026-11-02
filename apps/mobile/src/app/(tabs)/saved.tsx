import { CATEGORY_LABEL, budgetStatus, type SearchHit } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useT } from "../../i18n";
import type { Listing } from "@housing-compass/core";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListingCard } from "../../components/ListingCard";
import { Button, Section } from "../../components/ui";
import { useListings } from "../../data/hooks";
import { useSession } from "../../auth/session";
import { backendEnabled, supabase } from "../../data/supabase";
import { enablePush } from "../../alerts/push";
import { shortDate } from "../../lib/format";
import { useStore } from "../../state/store";
import { HIT, color, radius, space, type } from "../../theme";

/** A private note on a saved home (this device only). */
function NoteBox({ l }: { l: Listing }) {
  const { t } = useT();
  const note = useStore((s) => s.notes[l.id] ?? "");
  const setNote = useStore((s) => s.setNote);
  const [open, setOpen] = useState(!!note);
  if (!open) return <Button kind="ghost" icon="create-outline" label={t("notes.add")} onPress={() => setOpen(true)} testID="add-note" />;
  return (
    <View style={{ gap: 4 }}>
      <TextInput
        value={note}
        onChangeText={(v) => setNote(l.id, v)}
        placeholder={t("notes.placeholder")}
        multiline
        maxLength={1000}
        style={styles.note}
        accessibilityLabel={t("notes.label", { title: l.title })}
        testID="note-input"
      />
      <Text style={type.tiny}>{t("notes.private")}</Text>
    </View>
  );
}

export default function Saved() {
  const favorites = useStore((s) => s.favorites);
  const searches = useStore((s) => s.savedSearches);
  const budget = useStore((s) => s.filters.budget);
  const applySearch = useStore((s) => s.applySearch);
  const deleteSearch = useStore((s) => s.deleteSearch);
  const toggleAlerts = useStore((s) => s.toggleSearchAlerts);
  const listings = useListings(favorites);
  const session = useSession();
  const gone = favorites.length - listings.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={type.title} accessibilityRole="header">
            Saved
          </Text>
          <Button kind="secondary" icon="person-circle-outline" label={session ? "Account" : backendEnabled ? "Sign in" : "Account"} onPress={() => router.push("/account")} />
        </View>

        <Section title="Saved searches">
          {searches.length === 0 ? (
            <Text style={type.small}>Save a search from Filters to come back to it. New-match alerts arrive with accounts.</Text>
          ) : (
            searches.map((s) => (
              <View key={s.id} style={styles.searchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{s.name}</Text>
                  <Text style={type.tiny}>
                    {CATEGORY_LABEL[s.filters.category]} · {s.area.label} · saved {shortDate(s.createdAt)}
                  </Text>
                </View>
                <Button
                  kind={s.alertsEnabled ? "primary" : "secondary"}
                  icon={s.alertsEnabled ? "notifications" : "notifications-off-outline"}
                  label={s.alertsEnabled ? "On" : "Alerts"}
                  accessibilityHint={s.alertsEnabled ? "Turn off alerts for this search" : "Get alerted about new matches"}
                  onPress={() => {
                    toggleAlerts(s.id);
                    if (!s.alertsEnabled && session) void enablePush(session.user.id);
                    if (session && s.serverId) void supabase?.from("saved_searches").update({ alerts_enabled: !s.alertsEnabled }).eq("id", s.serverId);
                  }}
                />
                <Button kind="secondary" label="Open" onPress={() => { applySearch(s.id); router.navigate("/"); }} />
                <Button kind="ghost" icon="trash-outline" label="" onPress={() => deleteSearch(s.id)} accessibilityHint={`Delete saved search ${s.name}`} />
              </View>
            ))
          )}
        </Section>

        <Text style={type.h2}>Favorites ({listings.length})</Text>
        {gone > 0 ? <Text style={type.tiny}>{gone} saved listing(s) are no longer available.</Text> : null}
        {listings.length === 0 ? <Text style={type.small}>Tap the heart on any listing to keep it here.</Text> : null}
        {listings.map((l) => {
          const hit: SearchHit = { listing: l, budget: budgetStatus(l, budget), distanceKm: null, commuteKm: null, unconfirmed: [] };
          return (
            <View key={l.id} style={{ gap: 6 }}>
              <ListingCard hit={hit} />
              <NoteBox l={l} />
            </View>
          );
        })}
        <Text style={[type.tiny, { textAlign: "center" }]}>{session ? "Synced to your account. Saved homes also open offline." : "Favorites are stored on this device until you sign in. Saved homes also open offline."}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  note: { minHeight: HIT * 1.5, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: 10, fontSize: 15, color: color.ink, backgroundColor: color.surface, textAlignVertical: "top" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
});
