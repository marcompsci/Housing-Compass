import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Banner, Button, Icon } from "../components/ui";
import { useStore } from "../state/store";
import { color, space, type } from "../theme";

const POINTS = [
  ["eye-outline", "They come from other websites' public ads, not from the owner or manager. A property can be real while its ad is fake."],
  ["pricetag-outline", "Prices may be per bed, student, promotional, or already gone. “1 bedroom” on a listing site isn't always a whole apartment."],
  ["call-outline", "Contact the manager using a number you find yourself — their official website or county records — not one from the ad."],
  ["card-outline", "Never pay a deposit, application fee or “holding fee” before you tour the home and confirm who can rent it. Never pay by wire, crypto or gift cards."],
  ["time-outline", "Leads hide automatically after 14 days unless someone rechecks them."],
] as const;

export default function UnverifiedWarning() {
  const ack = useStore((s) => s.acknowledgeUnverified);
  const patch = useStore((s) => s.patchFilters);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Banner tone="warn" icon="warning-outline" title="Unverified leads have not been checked by anyone">
        Housing Compass shows them only so you can research further. We cannot guarantee any listing is real or scam-free.
      </Banner>
      {POINTS.map(([icon, text]) => (
        <View key={text} style={styles.point}>
          <Icon name={icon} size={22} tint={color.warn} />
          <Text style={[type.body, { flex: 1 }]}>{text}</Text>
        </View>
      ))}
      <Button
        label="I understand — show unverified leads"
        onPress={() => {
          ack();
          patch({ includeUnverified: true });
          router.back();
        }}
        testID="ack-unverified"
      />
      <Button kind="secondary" label="Keep showing verified only" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  point: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
});
