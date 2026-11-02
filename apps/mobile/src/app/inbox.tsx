import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useInbox } from "../alerts/inbox";
import { Banner, Button, Icon, type IconName } from "../components/ui";
import { useStore } from "../state/store";
import { color, radius, space, type } from "../theme";

const ICON: Record<string, IconName> = {
  saved_search_match: "sparkles-outline",
  deadline_reminder: "alarm-outline",
  listing_changed: "pricetag-outline",
  listing_expired: "eye-off-outline",
};

export default function Inbox() {
  const { items, source } = useInbox();
  const read = useStore((s) => s.readNotifications);
  const markRead = useStore((s) => s.markNotificationRead);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Button kind="secondary" icon="settings-outline" label="Alert settings" onPress={() => router.push("/alert-settings")} testID="alert-settings-link" />
      {source === "device" ? (
        <Text style={type.tiny}>Alerts are worked out on this device from your saved searches, favorites and applications. Sign in to get them as push notifications.</Text>
      ) : null}
      {items.length === 0 ? (
        <Banner tone="info" icon="notifications-outline" title="No alerts yet">
          Turn on alerts for a saved search, save homes with deadlines, or track an application.
        </Banner>
      ) : null}
      {items.map((n) => {
        const unread = !read.includes(n.key);
        return (
          <Pressable
            key={n.key}
            onPress={() => {
              markRead(n.key);
              if (n.listingId) router.push(`/listing/${encodeURIComponent(n.listingId)}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${unread ? "Unread. " : ""}${n.title}. ${n.body}`}
            style={[styles.item, unread && styles.unread]}
          >
            <Icon name={ICON[n.kind] ?? "notifications-outline"} size={22} tint={unread ? color.brand : color.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.h3, { fontSize: 15 }]}>{n.title}</Text>
              <Text style={type.small}>{n.body}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, maxWidth: 640, width: "100%", alignSelf: "center" },
  item: { flexDirection: "row", gap: 12, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, alignItems: "flex-start" },
  unread: { borderColor: color.brand, backgroundColor: color.brandSoft },
});
