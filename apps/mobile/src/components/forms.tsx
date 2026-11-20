import type { ComponentProps } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { HIT, color, radius, type } from "../theme";

/** A labeled text input. The label is also the accessibility label. */
export function Field({ label, hint, ...input }: { label: string; hint?: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={[type.small, { color: color.ink, fontWeight: "600" }]}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={color.muted} style={styles.input} {...input} />
      {hint ? <Text style={type.tiny}>{hint}</Text> : null}
    </View>
  );
}

export const toCents = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
export const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const today = (d: Date) => d.toISOString().slice(0, 10);

export const formStyles = StyleSheet.create({
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 16, color: color.ink, backgroundColor: color.surface },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  card: { padding: 14, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, gap: 6 },
});
const styles = formStyles;
