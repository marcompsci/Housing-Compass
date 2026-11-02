import { NEXT_STEP, STATUS_LABEL, applicationDocuments, attention, checklistProgress, nextMoves, sortApplications, type TrackedApplication } from "@housing-compass/core";
import { Checklist } from "../../components/Checklist";
import { useListing } from "../../data/hooks";
import { useT } from "../../i18n";
import { usePrefs } from "../../state/prefs";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Button, Chip, Tag } from "../../components/ui";
import { now } from "../../config";
import { daysUntil, shortDate } from "../../lib/format";
import { useApplications } from "../../state/applications";
import { HIT, color, radius, space, type } from "../../theme";

const NO_TICKS: string[] = [];

const ATTENTION_TEXT = {
  deadline_soon: "Deadline soon",
  deadline_passed: "Deadline passed",
  follow_up_due: "Follow-up due",
  stale: "No update in 3+ weeks",
} as const;

function AppCard({ a }: { a: TrackedApplication }) {
  const move = useApplications((s) => s.move);
  const update = useApplications((s) => s.update);
  const remove = useApplications((s) => s.remove);
  const [open, setOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const { t } = useT();
  const { listing } = useListing(a.listingId);
  const docs = listing ? applicationDocuments(listing) : [];
  const key = `docs:${a.id}`;
  const ticked = usePrefs((s) => s.checklists[key]) ?? NO_TICKS;
  const toggleCheck = usePrefs((s) => s.toggleCheck);
  const prog = checklistProgress(docs, ticked);
  const att = attention(a, now());
  const plusDays = (d: number) => new Date(now().getTime() + d * 86_400_000).toISOString();

  return (
    <View style={styles.card} testID="application-card">
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Tag label={STATUS_LABEL[a.status]} tone={a.status === "leased" ? "good" : "neutral"} />
        {att ? <Tag label={ATTENTION_TEXT[att]} tone="warn" /> : null}
        {a.listingId?.startsWith("demo-") ? <Tag label="DEMO" tone="demo" /> : null}
      </View>
      <Text style={type.h3} onPress={() => a.listingId && router.push(`/listing/${encodeURIComponent(a.listingId)}`)}>
        {a.title}
      </Text>
      {a.deadline ? (
        <Text style={type.small}>
          Deadline {shortDate(a.deadline)} · {daysUntil(a.deadline) >= 0 ? `${daysUntil(a.deadline)} days left` : "passed"}
        </Text>
      ) : null}
      {NEXT_STEP[a.status] ? <Text style={type.small}>Next: {NEXT_STEP[a.status]}</Text> : null}
      {a.nextActionAt ? <Text style={type.tiny}>Follow up on {shortDate(a.nextActionAt)}</Text> : null}

      <View style={styles.row}>
        {nextMoves(a.status).map((s) => (
          <Chip key={s} label={`→ ${STATUS_LABEL[s]}`} onPress={() => move(a.id, s)} accessibilityHint={`Mark as ${STATUS_LABEL[s]}`} />
        ))}
      </View>
      {docs.length ? (
        <Button kind="ghost" icon="folder-open-outline" label={`${t("docs.title")} (${prog.done}/${prog.total})`} onPress={() => setDocsOpen(!docsOpen)} testID="docs-toggle" />
      ) : null}
      {docsOpen ? (
        <View style={{ gap: 6 }}>
          <Text style={type.tiny}>{t("docs.note")}</Text>
          <Checklist items={docs} done={ticked} onToggle={(id) => toggleCheck(key, id)} />
        </View>
      ) : null}
      <Button kind="ghost" label={open ? "Hide details" : "Notes & follow-up"} onPress={() => setOpen(!open)} />
      {open ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={a.notes}
            onChangeText={(t) => update(a.id, { notes: t })}
            placeholder="Confirmation number, who you spoke to, documents sent… (don't store passwords or SSNs)"
            multiline
            style={styles.input}
            accessibilityLabel="Application notes"
          />
          <View style={styles.row}>
            <Chip label="Remind me in 3 days" onPress={() => update(a.id, { nextActionAt: plusDays(3) })} />
            <Chip label="In 1 week" onPress={() => update(a.id, { nextActionAt: plusDays(7) })} />
            {a.nextActionAt ? <Chip label="Clear reminder" onPress={() => update(a.id, { nextActionAt: null })} /> : null}
          </View>
          <Text style={type.tiny}>History: {a.history.map((h) => `${STATUS_LABEL[h.status]} (${shortDate(h.at)})`).join(" → ")}</Text>
          <Button kind="danger" label="Stop tracking" onPress={() => remove(a.id)} />
        </View>
      ) : null}
    </View>
  );
}

export default function Applications() {
  const items = useApplications((s) => s.items);
  const sorted = sortApplications(items, now());
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={type.title} accessibilityRole="header">
            Applications
          </Text>
          <Button kind="secondary" icon="chatbubbles-outline" label="Messages & tours" onPress={() => router.push("/inquiries")} />
        </View>
        {items.length === 0 ? (
          <Banner tone="info" icon="document-text-outline" title="Track the homes you apply for">
            Open any listing and tap “Track application”. You'll see deadlines, next steps and reminders here.
          </Banner>
        ) : null}
        {sorted.map((a) => (
          <AppCard key={a.id} a={a} />
        ))}
        <Text style={[type.tiny, { textAlign: "center" }]}>Never pay an application fee or deposit before you've toured and confirmed who can rent the home.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: 8, borderWidth: 1, borderColor: color.line },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: { minHeight: HIT * 2, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: 10, fontSize: 15, color: color.ink, backgroundColor: color.surface, textAlignVertical: "top" },
});
