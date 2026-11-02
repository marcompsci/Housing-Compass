import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { log } from "../lib/log";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthBootstrap } from "../auth/session";
import { color } from "../theme";

export default function RootLayout() {
  useAuthBootstrap();
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: color.ink,
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: color.bg },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ title: "Listing details" }} />
        <Stack.Screen name="filters" options={{ presentation: "modal", title: "Filters" }} />
        <Stack.Screen name="location" options={{ presentation: "modal", title: "Search area" }} />
        <Stack.Screen name="unverified" options={{ presentation: "modal", title: "Before you see unverified leads" }} />
        <Stack.Screen name="report/[id]" options={{ presentation: "modal", title: "Report a problem" }} />
        <Stack.Screen name="account" options={{ presentation: "modal", title: "Account" }} />
        <Stack.Screen name="inbox" options={{ title: "Alerts" }} />
        <Stack.Screen name="programs" options={{ title: "Official programs" }} />
        <Stack.Screen name="inquiries" options={{ title: "Messages & tours" }} />
        <Stack.Screen name="conversation/[id]" options={{ title: "Conversation" }} />
        <Stack.Screen name="landlord" options={{ title: "For landlords & managers" }} />
        <Stack.Screen name="check-message" options={{ presentation: "modal", title: "Is this message safe?" }} />
        <Stack.Screen name="affordability" options={{ presentation: "modal", title: "My numbers" }} />
        <Stack.Screen name="review/index" options={{ title: "Review queue" }} />
        <Stack.Screen name="review/[id]" options={{ title: "Review listing" }} />
      </Stack>
    </SafeAreaProvider>
  );
}

/** Route-level crash screen: logs (redacted) and offers a retry instead of a white screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    log.error("screen crashed", { message: error.message, name: error.name });
  }, [error]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: color.bg }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: color.ink }}>Something went wrong</Text>
      <Text style={{ fontSize: 15, color: color.sub, textAlign: "center" }}>Your saved homes are safe. Try again, and if it keeps happening, restart the app.</Text>
      <Pressable onPress={retry} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 20, justifyContent: "center", borderRadius: 12, backgroundColor: color.brand }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Try again</Text>
      </Pressable>
    </View>
  );
}
