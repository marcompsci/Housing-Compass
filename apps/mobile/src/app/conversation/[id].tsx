import { TOUR_DAY_CHECKLIST, buildIcs, checklistProgress, messageGuard, tourEvent } from "@housing-compass/core";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Checklist } from "../../components/Checklist";
import { useListing } from "../../data/hooks";
import { useT } from "../../i18n";
import { saveAndShare } from "../../lib/files";
import { addressText } from "../../lib/format";
import { usePrefs } from "../../state/prefs";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Banner, Button, Chip, Section, Tag } from "../../components/ui";
import { now } from "../../config";
import { shortDate } from "../../lib/format";
import { useConversations } from "../../state/conversations";
import { HIT, color, radius, space, type } from "../../theme";

const SLOTS = [10, 14, 18];

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const thread = useConversations((s) => s.threads.find((t) => t.id === String(id)));
  const send = useConversations((s) => s.send);
  const proposeTour = useConversations((s) => s.proposeTour);
  const confirmDemoTour = useConversations((s) => s.confirmDemoTour);
  const refreshTours = useConversations((s) => s.refreshTours);
  const { listing } = useListing(thread?.listingId ?? null);
  const checks = usePrefs((s) => s.checklists);
  const toggleCheck = usePrefs((s) => s.toggleCheck);
  const [openTour, setOpenTour] = useState<string | null>(null);
  const [calMsg, setCalMsg] = useState("");
  const { t } = useT();
  useFocusEffect(
    useCallback(() => {
      if (thread && !thread.demo) void refreshTours(thread.id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [thread?.id]),
  );
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"in_person" | "live_video">("in_person");
  if (!thread) return <Text style={{ padding: space.xl }}>Conversation not found.</Text>;
  const preview = text.trim() ? messageGuard(text, { tourConfirmed: thread.tours.some((t) => t.status === "confirmed") }) : null;
  const days = [1, 2, 3, 4, 5].map((d) => {
    const x = new Date(now().getTime() + d * 86_400_000);
    return x;
  });

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={type.h2}>{thread.title}</Text>
      {thread.demo ? (
        <Banner tone="demo" icon="flask-outline" title="Demo conversation">
          This is a fictional listing. Messages stay on this device and nobody will reply.
        </Banner>
      ) : null}
      <Banner tone="info" icon="shield-checkmark-outline" title="Messages are protected">
        Phone numbers, emails and links are hidden until a tour is confirmed. Requests for deposits before a tour, wire/crypto/gift-card payments or your SSN are held for review.
      </Banner>

      {thread.messages.map((m) => (
        <View key={m.id} style={[styles.bubble, m.mine ? styles.mine : styles.theirs]} testID="message">
          <Text style={type.body}>{m.body}</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {m.masked ? <Tag label="Contact details hidden" /> : null}
            {m.held ? <Tag label={`Held for review: ${m.holdReasons.join(", ")}`} tone="warn" /> : null}
            <Text style={type.tiny}>{new Date(m.at).toLocaleString()}</Text>
          </View>
        </View>
      ))}
      {thread.messages.length === 0 ? <Text style={type.small}>Ask about availability, total monthly cost, fees and how to tour. Don't share your SSN or bank details.</Text> : null}

      <TextInput value={text} onChangeText={(t) => { setText(t); setError(""); }} placeholder="Write a message" multiline maxLength={2000} style={styles.input} accessibilityLabel="Message text" />
      {preview?.masked ? <Text style={[type.tiny, { color: color.warn }]}>Contact details in this message will be hidden until a tour is confirmed.</Text> : null}
      {preview?.held ? <Text style={[type.tiny, { color: color.danger }]}>This will be held for a safety review ({preview.holdReasons.join(", ")}).</Text> : null}
      {error ? <Banner tone="danger" icon="alert-circle-outline" title={error} /> : null}
      <Button label="Send" icon="send-outline" disabled={!text.trim()} testID="send-message" onPress={async () => {
        try { await send(thread.id, text); setText(""); } catch (e) { setError((e as Error).message); }
      }} />

      <Section title="Request a tour">
        <Text style={type.small}>Tour in person or by live video before paying anything.</Text>
        <View style={styles.row}>
          <Chip label="In person" selected={mode === "in_person"} onPress={() => setMode("in_person")} />
          <Chip label="Live video" selected={mode === "live_video"} onPress={() => setMode("live_video")} />
        </View>
        <View style={styles.row}>
          {days.flatMap((d) =>
            SLOTS.map((h) => {
              const at = new Date(d);
              at.setHours(h, 0, 0, 0);
              return <Chip key={at.toISOString()} label={`${at.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${h > 12 ? h - 12 : h}${h >= 12 ? "pm" : "am"}`} onPress={() => void proposeTour(thread.id, at.toISOString(), mode)} />;
            }),
          )}
        </View>
        {thread.tours.map((tour) => {
          const key = `tour:${tour.id}`;
          const prog = checklistProgress(TOUR_DAY_CHECKLIST, checks[key] ?? []);
          return (
            <View key={tour.id} style={styles.tour} testID="tour">
              <Text style={type.small}>
                {tour.mode === "in_person" ? "In-person" : "Video"} tour · {shortDate(tour.startsAt)} {new Date(tour.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {tour.status}
              </Text>
              {thread.demo && tour.status === "proposed" ? (
                <Chip icon="flask-outline" label={t("tour.simulateConfirm")} onPress={() => confirmDemoTour(thread.id, tour.id)} accessibilityHint="Demo only: pretends the fictional manager confirmed" />
              ) : null}
              {tour.status === "confirmed" ? (
                <View style={{ gap: 8 }}>
                  <View style={styles.row}>
                    <Button
                      kind="secondary"
                      icon="calendar-outline"
                      label={t("tour.addToCalendar")}
                      testID="add-to-calendar"
                      onPress={async () => {
                        try {
                          const ics = buildIcs([tourEvent(tour, { title: thread.title, addressText: listing ? addressText(listing) : null })], now());
                          const r = await saveAndShare(`tour-${tour.startsAt.slice(0, 10)}.ics`, ics, "text/calendar", "com.apple.ical.ics");
                          setCalMsg(r === "downloaded" ? t("tour.calDownloaded") : "");
                        } catch {
                          setCalMsg(t("tour.calFailed"));
                        }
                      }}
                    />
                    <Button kind="ghost" icon="checkbox-outline" label={`${t("tour.checklist")} (${prog.done}/${prog.total})`} onPress={() => setOpenTour(openTour === tour.id ? null : tour.id)} />
                  </View>
                  {openTour === tour.id ? <Checklist items={TOUR_DAY_CHECKLIST} done={checks[key] ?? []} onToggle={(id) => toggleCheck(key, id)} /> : null}
                </View>
              ) : null}
            </View>
          );
        })}
        {calMsg ? <Text style={type.tiny}>{calMsg}</Text> : null}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, paddingBottom: 60, maxWidth: 680, width: "100%", alignSelf: "center" },
  bubble: { padding: space.md, borderRadius: radius.md, gap: 6, maxWidth: "90%" },
  mine: { alignSelf: "flex-end", backgroundColor: color.brandSoft },
  theirs: { alignSelf: "flex-start", backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tour: { gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  input: { minHeight: HIT * 2, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: 12, fontSize: 15, color: color.ink, backgroundColor: color.surface, textAlignVertical: "top" },
});
