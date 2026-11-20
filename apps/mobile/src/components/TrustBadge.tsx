import { type Listing } from "@housing-compass/core";
import { useT } from "../i18n";
import { StyleSheet, Text, View } from "react-native";
import { color, levelTone, radius, type } from "../theme";
import { Icon, type IconName } from "./ui";

export function TrustBadge({ listing, size = "sm" }: { listing: Listing; size?: "sm" | "lg" }) {
  const { d } = useT();
  const LEVEL_LABEL = d.level;
  const LEVEL_EXPLAINER = d.levelExplainer;
  const lvl = listing.verification.level;
  const t = levelTone[lvl];
  return (
    <View
      style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }, size === "lg" && styles.lg]}
      accessible
      accessibilityLabel={`Trust level: ${LEVEL_LABEL[lvl]}. ${LEVEL_EXPLAINER[lvl]}`}
    >
      <Icon name={t.icon as IconName} size={size === "lg" ? 18 : 14} tint={t.fg} />
      <Text style={[styles.text, { color: t.fg }, size === "lg" && { fontSize: 15 }]}>{LEVEL_LABEL[lvl]}</Text>
    </View>
  );
}

export function DemoTag() {
  return (
    <View style={styles.demo} accessible accessibilityLabel="Demo listing. Fictional, not a real home.">
      <Text style={styles.demoText}>DEMO · FICTIONAL</Text>
    </View>
  );
}

export function TrustPanel({ listing }: { listing: Listing }) {
  const { d } = useT();
  const LEVEL_EXPLAINER = d.levelExplainer;
  const lvl = listing.verification.level;
  const t = levelTone[lvl];
  return (
    <View style={[styles.panel, { backgroundColor: t.bg, borderColor: t.border }]}>
      <TrustBadge listing={listing} size="lg" />
      <Text style={[type.body, { color: color.ink }]}>{LEVEL_EXPLAINER[lvl]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  lg: { paddingHorizontal: 12, paddingVertical: 6 },
  text: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },
  demo: { backgroundColor: color.demo, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  demoText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 8 },
});
