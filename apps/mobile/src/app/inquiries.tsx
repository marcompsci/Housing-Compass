import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Banner, Section, Tag } from "../components/ui";
import { now } from "../config";
import { shortDate } from "../lib/format";
import { threadStatus, useConversations } from "../state/conversations";
import { color, radius, space, type } from "../theme";

const LABEL = { awaiting_reply: "Awaiting reply", replied: "Replied", tour_proposed: "Tour requested", tour_confirmed: "Tour confirmed" } as const;

export default function Inquiries() {
  const threads = useConversations((s) => s.threads);
  const upcoming = threads
    .flatMap((t) => t.tours.filter((x) => x.status !== "cancelled" && x.status !== "declined" && new Date(x.startsAt) > now()).map((x) => ({ ...x, title: t.title, threadId: t.id })))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Section title="Upcoming tours">
        {upcoming.length === 0 ? <Text style={type.small}>No tours scheduled yet.</Text> : null}
        {upcoming.map((t) => (
          <Text key={t.id} style={type.body} onPress={() => router.push(`/conversation/${t.threadId}`)}>
            {shortDate(t.startsAt)} {new Date(t.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {t.title} · {t.mode === "in_person" ? "in person" : "video"} · {t.status}
          </Text>
        ))}
      </Section>
      {threads.length === 0 ? (
        <Banner tone="info" icon="chatbubbles-outline" title="No conversations yet">
          You can message managers of verified listings from the listing page.
        </Banner>
      ) : null}
      {threads.map((t) => {
        const st = threadStatus(t);
        const last = t.messages[t.messages.length - 1];
        return (
          <Pressable key={t.id} onPress={() => router.push(`/conversation/${t.id}`)} style={styles.item} accessibilityRole="button" testID="inquiry">
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Tag label={LABEL[st]} tone={st === "tour_confirmed" ? "good" : "neutral"} />
              {t.demo ? <Tag label="DEMO" tone="demo" /> : null}
            </View>
            <Text style={type.h3}>{t.title}</Text>
            <Text style={type.tiny} numberOfLines={1}>{last ? last.body : "No messages yet"} · started {shortDate(t.createdAt)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, maxWidth: 680, width: "100%", alignSelf: "center" },
  item: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: 6, borderWidth: 1, borderColor: color.line },
});
