import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { log } from "../lib/log";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthBootstrap } from "../auth/session";
import { usePriceWatcher } from "../state/priceHistory";
import { useSavedCopyWatcher } from "../data/savedCopies";
import { useReminderSync } from "../lib/reminders";
import { color } from "../theme";

export default function RootLayout() {
  useAuthBootstrap();
  usePriceWatcher();
  useSavedCopyWatcher();
  useReminderSync();
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
        <Stack.Screen name="welcome" options={{ presentation: "modal", title: "Welcome", headerShown: false }} />
        <Stack.Screen name="alert-settings" options={{ title: "Alert settings" }} />
        <Stack.Screen name="landlord-dashboard" options={{ title: "Your listings" }} />
        <Stack.Screen name="rights" options={{ title: "Know your rights (CA)" }} />
        <Stack.Screen name="my-reports" options={{ title: "Reports I sent" }} />
        <Stack.Screen name="rent" options={{ title: "Rent tracker" }} />
        <Stack.Screen name="move" options={{ title: "Move in & move out" }} />
        <Stack.Screen name="waitlists" options={{ title: "Program waitlists" }} />
        <Stack.Screen name="local-help" options={{ title: "Local rent rules & help" }} />
        <Stack.Screen name="bills" options={{ title: "Bills & budget" }} />
        <Stack.Screen name="rent-increase" options={{ title: "Rent increase checker" }} />
        <Stack.Screen name="money" options={{ title: "Money" }} />
        <Stack.Screen name="paycheck" options={{ title: "Paycheck planner" }} />
        <Stack.Screen name="import" options={{ title: "Import bank statement" }} />
        <Stack.Screen name="debts" options={{ title: "Debt payoff" }} />
        <Stack.Screen name="credit" options={{ title: "Credit builder" }} />
        <Stack.Screen name="goals" options={{ title: "Savings goals" }} />
        <Stack.Screen name="found-money" options={{ title: "Found money" }} />
        <Stack.Screen name="side-income" options={{ title: "Side income" }} />
        <Stack.Screen name="yearly" options={{ title: "Yearly costs" }} />
        <Stack.Screen name="deposit-interest" options={{ title: "Deposit interest" }} />
        <Stack.Screen name="year-review" options={{ title: "Year in review" }} />
        <Stack.Screen name="credit-tools" options={{ title: "Credit tracker" }} />
        <Stack.Screen name="wins" options={{ title: "Bill wins" }} />
        <Stack.Screen name="roommates" options={{ title: "Roommates" }} />
        <Stack.Screen name="afford" options={{ title: "Can I afford this?" }} />
        <Stack.Screen name="spending" options={{ title: "Weekly spending" }} />
        <Stack.Screen name="windfall" options={{ title: "Windfall planner" }} />
        <Stack.Screen name="scores" options={{ title: "Score journal" }} />
        <Stack.Screen name="net-worth" options={{ title: "Net worth" }} />
        <Stack.Screen name="challenge" options={{ title: "52-week challenge" }} />
        <Stack.Screen name="ask" options={{ title: "Ask" }} />
        <Stack.Screen name="trials" options={{ title: "Trials & returns" }} />
        <Stack.Screen name="month-report" options={{ title: "Monthly report" }} />
        <Stack.Screen name="badges" options={{ title: "Badges" }} />
        <Stack.Screen name="settings" options={{ title: "Money settings" }} />
        <Stack.Screen name="split" options={{ title: "Split with roommates" }} />
        <Stack.Screen name="backup" options={{ title: "Backup & restore" }} />
        <Stack.Screen name="setup" options={{ title: "Quick setup" }} />
        <Stack.Screen name="calendar" options={{ title: "Money calendar" }} />
        <Stack.Screen name="letters" options={{ title: "Letters" }} />
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
