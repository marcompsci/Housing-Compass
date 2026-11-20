import type { ChecklistEntry } from "@housing-compass/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HIT, color, space, type } from "../theme";
import { Icon } from "./ui";

/** Tickable checklist; state lives in the caller (persisted per key in usePrefs). */
export function Checklist({ items, done, onToggle }: { items: ChecklistEntry[]; done: string[]; onToggle(id: string): void }) {
  return (
    <View style={{ gap: 2 }} accessibilityRole="list">
      {items.map((it) => {
        const on = done.includes(it.id);
        return (
          <Pressable
            key={it.id}
            onPress={() => onToggle(it.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${it.label}. ${it.detail ?? ""}`}
            style={styles.row}
            testID="checklist-item"
          >
            <Icon name={on ? "checkbox" : it.caution ? "alert-circle-outline" : "square-outline"} size={22} tint={on ? color.verified : it.caution ? color.danger : color.sub} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.body, on && { color: color.sub, textDecorationLine: "line-through" }]}>{it.label}</Text>
              {it.detail ? <Text style={type.tiny}>{it.detail}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, alignItems: "flex-start", minHeight: HIT, paddingVertical: 6 },
});
