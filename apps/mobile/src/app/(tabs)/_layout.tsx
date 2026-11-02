import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform } from "react-native";
import { Tabs } from "expo-router/tabs";
import { useStore } from "../../state/store";
import { color } from "../../theme";
import { useT } from "../../i18n";

export default function TabsLayout() {
  const { t } = useT();
  const saved = useStore((s) => s.favorites.length);
  const comparing = useStore((s) => s.compare.length);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line, ...(Platform.OS === "web" ? { height: 72, paddingTop: 6, paddingBottom: 14 } : null) },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tab.explore"), tabBarIcon: ({ color: c, size }) => <Ionicons name="compass-outline" size={size} color={c as string} /> }} />
      <Tabs.Screen
        name="saved"
        options={{ title: t("tab.saved"), tabBarBadge: saved || undefined, tabBarIcon: ({ color: c, size }) => <Ionicons name="heart-outline" size={size} color={c as string} /> }}
      />
      <Tabs.Screen name="plan" options={{ title: t("tab.plan"), tabBarIcon: ({ color: c, size }) => <Ionicons name="calendar-outline" size={size} color={c as string} /> }} />
      <Tabs.Screen
        name="applications"
        options={{ title: t("tab.applications"), tabBarIcon: ({ color: c, size }) => <Ionicons name="document-text-outline" size={size} color={c as string} /> }}
      />
      <Tabs.Screen
        name="compare"
        options={{ title: t("tab.compare"), tabBarBadge: comparing || undefined, tabBarIcon: ({ color: c, size }) => <Ionicons name="git-compare-outline" size={size} color={c as string} /> }}
      />
      <Tabs.Screen name="help" options={{ title: t("tab.help"), tabBarIcon: ({ color: c, size }) => <Ionicons name="shield-checkmark-outline" size={size} color={c as string} /> }} />
    </Tabs>
  );
}
