/**
 * Local rent rules & free tenant help: the official rent board or program for the city,
 * plus the statewide fallback. Opens with the city you're searching (or one passed in).
 */
import { LOCAL_RENT_OFFICES, LOCAL_RULES_CHECKED_ON, rentOfficesFor } from "@housing-compass/core";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { formStyles } from "../components/forms";
import { Banner, Button, Chip } from "../components/ui";
import { useT } from "../i18n";
import { openExternal } from "../lib/links";
import { useStore } from "../state/store";
import { space, type } from "../theme";

const CITY_CHOICES = ["San Francisco", "Oakland", "Berkeley", "San Jose", "Los Angeles", "Unincorporated Los Angeles County"];

export default function LocalHelp() {
  const { t, locale } = useT();
  const { city: cityParam } = useLocalSearchParams<{ city?: string }>();
  const areaLabel = useStore((s) => s.area.label);
  const guess = cityParam ?? CITY_CHOICES.find((c) => areaLabel.toLowerCase().includes(c.toLowerCase())) ?? null;
  const [city, setCity] = useState<string | null>(guess);
  const offices = rentOfficesFor(city);
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="local-help">
      <Banner tone="info" icon="business-outline" title={t("local.title")}>
        {t("local.intro")}
      </Banner>
      <View style={formStyles.row} accessibilityRole="radiogroup" accessibilityLabel={t("local.pickCity")}>
        {CITY_CHOICES.map((c) => (
          <Chip key={c} label={c} selected={city === c} onPress={() => setCity(c)} />
        ))}
        <Chip label={t("local.otherCity")} selected={city === null} onPress={() => setCity(null)} />
      </View>
      {locale !== "en" ? <Text style={type.tiny}>{t("rights.englishOnly")}</Text> : null}
      {offices.map((o) => (
        <View key={o.id} style={formStyles.card} testID="rent-office">
          <Text style={type.h3}>{o.name}</Text>
          <Text style={type.body}>{o.summary}</Text>
          <Text style={type.small}>
            <Text style={{ fontWeight: "800" }}>{t("local.covered")} </Text>
            {o.coverageHint}
          </Text>
          <View style={formStyles.row}>
            <Button style={{ flex: 1 }} kind="secondary" icon="open-outline" label={t("local.website")} onPress={() => openExternal(o.url)} />
            {o.phone ? (
              <Button
                style={{ flex: 1 }}
                kind="secondary"
                icon="call-outline"
                label={o.phone}
                onPress={() => (Platform.OS === "web" ? openExternal(o.url) : Linking.openURL(`tel:${o.phone!.replace(/[^\d]/g, "")}`))}
              />
            ) : null}
          </View>
        </View>
      ))}
      <Text style={[type.tiny, { textAlign: "center" }]}>{t("local.footer", { date: LOCAL_RULES_CHECKED_ON, n: LOCAL_RENT_OFFICES.length })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
});
