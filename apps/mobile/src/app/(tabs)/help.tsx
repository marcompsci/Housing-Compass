import { ADAPTERS, LEVEL_EXPLAINER, LEVEL_LABEL, VERIFICATION_LEVELS, alameda211, doorway } from "@housing-compass/core";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useLocale } from "../../i18n";
import { Chip } from "../../components/ui";
import { Button, Icon, Section } from "../../components/ui";
import { openExternal } from "../../lib/links";
import { color, levelTone, space, type } from "../../theme";
import type { IconName } from "../../components/ui";

const RED_FLAGS = [
  "Asks for a deposit, application fee or “holding fee” before you can tour",
  "Wants payment by wire transfer, crypto, gift cards or a payment app to a stranger",
  "Says they're out of the country and will mail the keys",
  "Rent is far below similar homes nearby",
  "Pressures you to decide today, or won't show the inside",
  "Email or phone doesn't match the property manager's official website",
];

export default function Help() {
  const { locale, setLocale } = useLocale();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={type.title} accessibilityRole="header">
          Help & safety
        </Text>

        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }} accessibilityRole="radiogroup" accessibilityLabel="Language / Idioma">
          <Text style={type.small}>Language / Idioma:</Text>
          <Chip label="English" selected={locale === "en"} onPress={() => setLocale("en")} />
          <Chip label="Español" selected={locale === "es"} onPress={() => setLocale("es")} />
        </View>

        <Button icon="business-outline" label="Official programs: Bay Area & Los Angeles" onPress={() => router.push("/programs")} />

        <Section title="Free help, right now">
          <Text style={type.small}>Official, free sources for affordable housing and shelter in the Bay Area.</Text>
          <Button icon="shield-checkmark-outline" label="Doorway Housing Portal ↗" onPress={() => openExternal(doorway.homeUrl)} accessibilityHint="Official Bay Area affordable housing listings and applications" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button style={{ flex: 1 }} kind="secondary" icon="call-outline" label="Call 211" onPress={() => (Platform.OS === "web" ? openExternal(alameda211.homeUrl) : Linking.openURL("tel:211"))} />
            <Button style={{ flex: 1 }} kind="secondary" icon="chatbubble-outline" label="Text 898211" onPress={() => (Platform.OS === "web" ? openExternal(alameda211.homeUrl) : Linking.openURL("sms:898211"))} />
          </View>
          <Button kind="ghost" label="211 Alameda County housing page ↗" onPress={() => openExternal(alameda211.homeUrl)} />
        </Section>

        <Button kind="secondary" icon="calculator-outline" label="My numbers: what can I afford?" onPress={() => router.push("/affordability")} />

        <Section title="What our labels mean">
          {VERIFICATION_LEVELS.map((lvl) => {
            const t = levelTone[lvl];
            return (
              <View key={lvl} style={styles.level}>
                <Icon name={t.icon as IconName} size={20} tint={t.fg} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.h3, { color: t.fg }]}>{LEVEL_LABEL[lvl]}</Text>
                  <Text style={type.small}>{LEVEL_EXPLAINER[lvl]}</Text>
                </View>
              </View>
            );
          })}
          <Text style={type.tiny}>No app can guarantee a listing is scam-free. Appearing on a big listing website never counts as verified.</Text>
        </Section>

        <Section title="Rental scam red flags">
          {RED_FLAGS.map((f) => (
            <View key={f} style={styles.flag}>
              <Icon name="alert-circle-outline" size={18} tint={color.danger} />
              <Text style={[type.body, { flex: 1 }]}>{f}</Text>
            </View>
          ))}
          <Button icon="chatbubble-ellipses-outline" label="Check a message I received" onPress={() => router.push("/check-message")} />
          <Button kind="secondary" label="Report a scam to the FTC ↗" onPress={() => openExternal("https://reportfraud.ftc.gov/")} />
        </Section>

        <Section title="Where our data comes from">
          {ADAPTERS.filter((a) => a.id !== "manual-review").map((a) => (
            <View key={a.id} style={styles.source}>
              <Text style={type.h3}>{a.name}</Text>
              <Text style={type.tiny}>
                {a.capabilities.ingest ? "Imported" : "Link-out only"} · {a.legalBasis}
              </Text>
            </View>
          ))}
        </Section>

        <Button kind="secondary" icon="key-outline" label="Are you a landlord or property manager?" onPress={() => router.push("/landlord")} />
        <Button kind="ghost" icon="construct-outline" label="Reviewer tools" onPress={() => router.push("/review")} accessibilityHint="For Housing Compass reviewers" />

        <Section title="Your privacy">
          <Text style={type.small}>
            Your location is used once, rounded to about 1 km, and never sent to our servers. Favorites, saved searches and reports stay on this device until accounts launch. We don't sell data or show ads.
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  level: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 4 },
  flag: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  source: { gap: 2, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
