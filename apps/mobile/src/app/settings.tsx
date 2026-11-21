/**
 * Money settings: privacy mode, morning summary, weekly limit, hourly pay and Face ID lock in
 * one place, plus clearing a single section of data without wiping everything.
 */
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents } from "../components/forms";
import { Banner, Button, Chip, Section } from "../components/ui";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

const SECTIONS = ["otherIncome", "spends", "side", "scores", "wins", "roommates", "trials", "netWorth", "credit"] as const;

export default function Settings() {
  const { t } = useT();
  const r = useRenter();
  const [limit, setLimit] = useState(r.weeklyLimitCents ? String(r.weeklyLimitCents / 100) : "");
  const [wage, setWage] = useState(r.hourlyCents ? String(r.hourlyCents / 100) : "");
  const [cleared, setCleared] = useState<string | null>(null);
  const clear = (s: (typeof SECTIONS)[number]) => {
    const go = () => {
      r.clearSection(s);
      setCleared(t(`set.s.${s}`));
    };
    if (Platform.OS === "web") return go();
    Alert.alert(t("set.confirmTitle", { what: t(`set.s.${s}`) }), t("set.confirmBody"), [
      { text: t("set.cancel"), style: "cancel" },
      { text: t("set.clear"), style: "destructive", onPress: go },
    ]);
  };
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="settings">
      <Banner tone="info" icon="settings-outline" title={t("set.title")}>
        {t("set.intro")}
      </Banner>

      <Section title={t("set.privacy")}>
        <View style={formStyles.row}>
          <Chip label={t("set.show")} selected={!r.hideAmounts} onPress={() => r.setHideAmounts(false)} />
          <Chip label={t("priv.label")} selected={r.hideAmounts} onPress={() => r.setHideAmounts(true)} />
        </View>
        <Text style={type.tiny}>{r.lockOn ? t("set.lockOn") : t("set.lockOff")}</Text>
      </Section>

      <Section title={t("dg.title")}>
        <View style={formStyles.row} testID="set-digest">
          {[null, 7, 8, 9].map((h) => (
            <Chip key={String(h)} label={h === null ? t("dg.off") : t("dg.at", { h })} selected={r.digestHour === h} onPress={() => r.setDigestHour(h)} />
          ))}
        </View>
      </Section>

      <Section title={t("set.numbers")}>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Field label={t("sp.limit")} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" testID="set-limit" />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Field label={t("hrs.wage")} value={wage} onChangeText={setWage} keyboardType="decimal-pad" testID="set-wage" />
          </View>
        </View>
        <Button
          kind="secondary"
          label={t("rent.saveSetup")}
          testID="set-save"
          onPress={() => {
            r.setWeeklyLimit(toCents(limit) > 0 ? toCents(limit) : null);
            r.setHourly(toCents(wage) > 0 ? toCents(wage) : null);
            setCleared(t("set.saved"));
          }}
        />
        <View style={formStyles.row}>
          <Button kind="ghost" icon="pie-chart-outline" label={t("ps.title")} onPress={() => router.push("/paycheck")} />
          <Button kind="ghost" icon="save-outline" label={t("money.backup")} onPress={() => router.push("/backup")} />
        </View>
      </Section>

      <Section title={t("set.clearTitle")}>
        <Text style={type.small}>{t("set.clearBody")}</Text>
        <View style={formStyles.row}>
          {SECTIONS.map((s) => (
            <Button key={s} kind="ghost" icon="trash-outline" label={t(`set.s.${s}`)} onPress={() => clear(s)} testID={`clear-${s}`} />
          ))}
        </View>
      </Section>
      {cleared ? (
        <Text style={[type.small, { color: color.verified, fontWeight: "700" }]} testID="set-msg">
          {cleared === t("set.saved") ? cleared : t("set.cleared", { what: cleared })}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
