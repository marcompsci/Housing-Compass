import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { HIT, color, radius, space, type } from "../theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 18, tint = color.ink }: { name: IconName; size?: number; tint?: string }) {
  return <Ionicons name={name} size={size} color={tint} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  accessibilityHint,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected: !!selected }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.8 }]}
    >
      {icon ? <Icon name={icon} size={15} tint={selected ? color.brandInk : color.sub} /> : null}
      <Text style={[styles.chipText, selected && { color: color.brandInk }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = "primary",
  icon,
  disabled,
  style,
  accessibilityHint,
  testID,
}: {
  label: string;
  testID?: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger" | "ghost";
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const fg = kind === "primary" ? color.brandInk : kind === "danger" ? color.danger : color.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.btn, styles[`btn_${kind}`], disabled && { opacity: 0.45 }, pressed && { opacity: 0.85 }, style]}
    >
      {icon ? <Icon name={icon} size={18} tint={fg} /> : null}
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Banner({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: "warn" | "demo" | "info" | "danger";
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = {
    warn: { bg: color.warnSoft, fg: color.warn, line: color.warnLine },
    demo: { bg: color.demoSoft, fg: color.demo, line: color.demo },
    info: { bg: color.officialSoft, fg: color.official, line: color.official },
    danger: { bg: color.dangerSoft, fg: color.danger, line: color.danger },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.line }]} accessibilityRole="alert">
      <Icon name={icon} size={20} tint={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.h3, { color: t.fg, fontSize: 14 }]}>{title}</Text>
        {children ? <Text style={[type.small, { color: color.ink }]}>{children}</Text> : null}
        {action}
      </View>
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={type.h2} accessibilityRole="header">
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function KV({ k, v, strong, unknown }: { k: string; v: string; strong?: boolean; unknown?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={[type.small, { flex: 1 }]}>{k}</Text>
      <Text style={[type.body, { flexShrink: 1, textAlign: "right" }, strong && { fontWeight: "800" }, unknown && { color: color.muted, fontStyle: "italic" }]}>{v}</Text>
    </View>
  );
}

export function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "warn" | "demo" | "good" }) {
  const t = {
    neutral: { bg: color.neutralSoft, fg: color.sub },
    warn: { bg: color.warnSoft, fg: color.warn },
    demo: { bg: color.demo, fg: "#fff" },
    good: { bg: color.brandSoft, fg: color.brand },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      <Text style={[styles.tagText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipOn: { backgroundColor: color.ink, borderColor: color.ink },
  chipText: { fontSize: 14, fontWeight: "600", color: color.ink },
  btn: { minHeight: HIT, paddingHorizontal: space.lg, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btn_primary: { backgroundColor: color.brand },
  btn_secondary: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  btn_danger: { backgroundColor: color.dangerSoft },
  btn_ghost: { backgroundColor: "transparent" },
  btnText: { fontSize: 15, fontWeight: "700" },
  banner: { flexDirection: "row", gap: 10, padding: space.md, borderRadius: radius.md, borderWidth: 1, alignItems: "flex-start" },
  section: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: color.line },
  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.md, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, maxWidth: "100%" },
  tagText: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
});
