import { ADAPTERS, LOCALES, LOCALE_NAME, VERIFICATION_LEVELS, alameda211, doorway } from "@housing-compass/core";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useLocale, useT } from "../../i18n";
import { usePrefs } from "../../state/prefs";
import { Chip } from "../../components/ui";
import { Button, Icon, Section } from "../../components/ui";
import { openExternal } from "../../lib/links";
import { color, levelTone, space, type } from "../../theme";
import type { IconName } from "../../components/ui";

const RED_FLAGS = ["help.flag1", "help.flag2", "help.flag3", "help.flag4", "help.flag5", "help.flag6"] as const;

export default function Help() {
  const { locale, setLocale } = useLocale();
  const { t, d } = useT();
  const resetOnboarding = usePrefs((s) => s.resetOnboarding);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={type.title} accessibilityRole="header">
          {t("help.title")}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }} accessibilityRole="radiogroup" accessibilityLabel="Language / Idioma / 语言">
          <Text style={type.small}>Language / Idioma / 语言:</Text>
          {LOCALES.map((l) => (
            <Chip key={l} label={LOCALE_NAME[l]} selected={locale === l} onPress={() => setLocale(l)} />
          ))}
        </View>
        {locale !== "en" ? <Text style={type.tiny}>{t("common.translationNote")}</Text> : null}

        <Button icon="business-outline" label={t("help.programs")} onPress={() => router.push("/programs")} />

        <Section title={t("help.freeHelp")}>
          <Text style={type.small}>{t("help.freeHelpBody")}</Text>
          <Button icon="shield-checkmark-outline" label="Doorway Housing Portal ↗" onPress={() => openExternal(doorway.homeUrl)} accessibilityHint="Official Bay Area affordable housing listings and applications" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button style={{ flex: 1 }} kind="secondary" icon="call-outline" label={t("help.call211")} onPress={() => (Platform.OS === "web" ? openExternal(alameda211.homeUrl) : Linking.openURL("tel:211"))} />
            <Button style={{ flex: 1 }} kind="secondary" icon="chatbubble-outline" label={t("help.text211")} onPress={() => (Platform.OS === "web" ? openExternal(alameda211.homeUrl) : Linking.openURL("sms:898211"))} />
          </View>
          <Button kind="ghost" label={t("help.alameda211")} onPress={() => openExternal(alameda211.homeUrl)} />
        </Section>

        <Button kind="secondary" icon="calculator-outline" label={t("help.myNumbers")} onPress={() => router.push("/affordability")} />

        <Section title={t("help.labels")}>
          {VERIFICATION_LEVELS.map((lvl) => {
            const tone = levelTone[lvl];
            return (
              <View key={lvl} style={styles.level}>
                <Icon name={tone.icon as IconName} size={20} tint={tone.fg} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.h3, { color: tone.fg }]}>{d.level[lvl]}</Text>
                  <Text style={type.small}>{d.levelExplainer[lvl]}</Text>
                </View>
              </View>
            );
          })}
          <Text style={type.tiny}>{t("help.noGuarantee")}</Text>
        </Section>

        <Section title={t("help.redFlags")}>
          {RED_FLAGS.map((f) => (
            <View key={f} style={styles.flag}>
              <Icon name="alert-circle-outline" size={18} tint={color.danger} />
              <Text style={[type.body, { flex: 1 }]}>{t(f)}</Text>
            </View>
          ))}
          <Button icon="chatbubble-ellipses-outline" label={t("help.checkMessage")} onPress={() => router.push("/check-message")} />
          <Button kind="secondary" label={t("help.ftc")} onPress={() => openExternal("https://reportfraud.ftc.gov/")} />
        </Section>

        <Section title={t("help.dataSources")}>
          {ADAPTERS.filter((a) => a.id !== "manual-review").map((a) => (
            <View key={a.id} style={styles.source}>
              <Text style={type.h3}>{a.name}</Text>
              <Text style={type.tiny}>
                {a.capabilities.ingest ? "Imported" : "Link-out only"} · {a.legalBasis}
              </Text>
            </View>
          ))}
        </Section>

        <Button kind="secondary" icon="key-outline" label={t("help.landlord")} onPress={() => router.push("/landlord")} />
        <Button kind="ghost" icon="play-circle-outline" label={t("help.tour")} onPress={() => { resetOnboarding(); router.push("/welcome"); }} />
        <Button kind="ghost" icon="construct-outline" label={t("help.reviewer")} onPress={() => router.push("/review")} accessibilityHint="For Housing Compass reviewers" />

        <Section title={t("help.privacy")}>
          <Text style={type.small}>{t("help.privacyBody")}</Text>
          <Button kind="ghost" icon="download-outline" label={t("help.myData")} onPress={() => router.push("/account")} />
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
