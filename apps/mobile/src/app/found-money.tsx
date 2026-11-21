/**
 * Found money: official programs that put cash back or cut bills — unclaimed property, tax
 * credits, food benefits, energy and phone discounts, free credit reports. Official sites only,
 * and a warning that none of them ever charges a fee to apply.
 */
import { FOUND_MONEY, FOUND_MONEY_CHECKED_ON } from "@housing-compass/core";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { formStyles } from "../components/forms";
import { Banner, Button, Tag } from "../components/ui";
import { useT } from "../i18n";
import { openExternal } from "../lib/links";
import { space, type } from "../theme";

export default function FoundMoney() {
  const { t, locale } = useT();
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="found-money">
      <Banner tone="info" icon="gift-outline" title={t("found.title")}>
        {t("found.intro")}
      </Banner>
      <Banner tone="warn" icon="shield-checkmark-outline" title={t("found.scamTitle")}>
        {t("found.scamBody")}
      </Banner>
      {locale !== "en" ? <Text style={type.tiny}>{t("rights.englishOnly")}</Text> : null}
      {FOUND_MONEY.map((p) => (
        <View key={p.id} style={formStyles.card} testID="program-card">
          <View style={formStyles.row}>
            <Tag label={t(`found.k.${p.kind}`)} tone={p.kind === "cash" ? "good" : "neutral"} />
          </View>
          <Text style={type.h3}>{p.name}</Text>
          <Text style={type.body}>{p.what}</Text>
          <Text style={type.small}>
            <Text style={{ fontWeight: "800" }}>{t("found.who")} </Text>
            {p.who}
          </Text>
          <View style={formStyles.row}>
            <Button style={{ flex: 1 }} kind="secondary" icon="open-outline" label={t("local.website")} onPress={() => openExternal(p.url)} />
            {p.phone ? (
              <Button style={{ flex: 1 }} kind="secondary" icon="call-outline" label={p.phone} onPress={() => (Platform.OS === "web" ? openExternal(p.url) : Linking.openURL(`tel:${p.phone!.replace(/[^\d]/g, "")}`))} />
            ) : null}
          </View>
        </View>
      ))}
      <Text style={[type.tiny, { textAlign: "center" }]}>{t("found.footer", { date: FOUND_MONEY_CHECKED_ON })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
