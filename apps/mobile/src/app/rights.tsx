/**
 * Know your rights (California): deposit limits, screening-fee rules, reusable reports,
 * positive rent reporting (credit building) and voucher protection — each with its source.
 * General information, not legal advice.
 */
import { CA_RIGHTS, CA_RIGHTS_GUIDE, RIGHTS_CHECKED_ON } from "@housing-compass/core";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Banner, Button, Section } from "../components/ui";
import { useT } from "../i18n";
import { openExternal } from "../lib/links";
import { color, space, type } from "../theme";

export default function Rights() {
  const { t, locale } = useT();
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const topics = topic ? [...CA_RIGHTS.filter((x) => x.id === topic), ...CA_RIGHTS.filter((x) => x.id !== topic)] : CA_RIGHTS;
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="rights">
      <Banner tone="info" icon="school-outline" title={t("rights.title")}>
        {t("rights.intro")}
      </Banner>
      {locale !== "en" ? <Text style={type.tiny}>{t("rights.englishOnly")}</Text> : null}
      {topics.map((x) => (
        <Section key={x.id} title={x.title}>
          <Text style={type.body}>{x.summary}</Text>
          <View style={styles.ask}>
            <Text style={[type.small, { color: color.ink }]}>
              <Text style={{ fontWeight: "800" }}>{t("rights.ask")} </Text>
              {x.ask}
            </Text>
          </View>
          <Text style={[type.tiny, styles.link]} onPress={() => openExternal(x.source.url)} accessibilityRole="link">
            {x.source.label} ↗
          </Text>
        </Section>
      ))}
      <Button kind="secondary" icon="book-outline" label={`${CA_RIGHTS_GUIDE.label} ↗`} onPress={() => openExternal(CA_RIGHTS_GUIDE.url)} />
      <Text style={[type.tiny, { textAlign: "center" }]}>{t("rights.footer", { date: RIGHTS_CHECKED_ON })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  ask: { padding: space.md, borderRadius: 10, backgroundColor: color.brandSoft },
  link: { color: color.official, fontWeight: "600", textDecorationLine: "underline" },
});
