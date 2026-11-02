/**
 * First-run onboarding: three short screens — how trust labels work, what you're looking for,
 * and where. Skippable; never asks for anything personal.
 */
import { CATEGORIES, formatUsd, type Category } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Banner, Button, Chip, Icon, type IconName } from "../components/ui";
import { useT } from "../i18n";
import { usePrefs } from "../state/prefs";
import { useStore } from "../state/store";
import { color, levelTone, radius, space, type } from "../theme";

const LEVELS = ["OFFICIAL_PORTAL", "PROPERTY_MANAGER_VERIFIED", "SOURCE_LISTED_UNVERIFIED"] as const;

export default function Welcome() {
  const { t, d } = useT();
  const [step, setStep] = useState(0);
  const finish = usePrefs((s) => s.finishOnboarding);
  const category = useStore((s) => s.filters.category);
  const budget = useStore((s) => s.filters.budget);
  const setCategory = useStore((s) => s.setCategory);
  const done = (next?: "/location") => {
    finish();
    if (next) router.replace(next);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const roomish = (c: Category) => c === "PRIVATE_ROOM" || c === "SHARED_COLIVING";

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="welcome">
      <View style={styles.dots} accessibilityLabel={t("welcome.step", { n: step + 1, total: 3 })}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
        ))}
      </View>

      {step === 0 ? (
        <View style={{ gap: space.lg }}>
          <Text style={type.title} accessibilityRole="header">
            {t("welcome.title")}
          </Text>
          <Text style={type.body}>{t("welcome.intro")}</Text>
          {LEVELS.map((lvl) => {
            const tone = levelTone[lvl];
            return (
              <View key={lvl} style={[styles.level, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                <Icon name={tone.icon as IconName} size={22} tint={tone.fg} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.h3, { color: tone.fg }]}>{d.level[lvl]}</Text>
                  <Text style={type.small}>{d.levelExplainer[lvl]}</Text>
                </View>
              </View>
            );
          })}
          <Banner tone="warn" icon="cash-outline" title={t("welcome.neverPay")} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: space.lg }}>
          <Text style={type.title} accessibilityRole="header">
            {t("welcome.lookingFor")}
          </Text>
          <View style={styles.row}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={d.category[c]} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
          <Text style={type.small}>{d.categoryHelp[category]}</Text>
          <View style={styles.card}>
            <Text style={type.h3}>{t("welcome.budget")}</Text>
            <Text style={type.small}>
              {roomish(category)
                ? t("welcome.budgetRooms", { min: formatUsd(budget.roomMinCents), max: formatUsd(budget.roomMaxCents) })
                : t("welcome.budgetUnits", { pref: formatUsd(budget.unitPreferredMaxCents), max: formatUsd(budget.unitHardMaxCents) })}
            </Text>
            <Text style={type.tiny}>{t("welcome.budgetChange")}</Text>
          </View>
          <Text style={type.small}>{t("welcome.basis")}</Text>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: space.lg }}>
          <Text style={type.title} accessibilityRole="header">
            {t("welcome.where")}
          </Text>
          <Text style={type.body}>{t("welcome.whereBody")}</Text>
          <Banner tone="info" icon="lock-closed-outline" title={t("welcome.privacyTitle")}>
            {t("welcome.privacyBody")}
          </Banner>
          <Button icon="location-outline" label={t("welcome.chooseArea")} onPress={() => done("/location")} />
          <Button kind="secondary" label={t("welcome.startBrowsing")} onPress={() => done()} testID="welcome-finish" />
        </View>
      ) : null}

      {step < 2 ? (
        <View style={styles.nav}>
          <Button kind="ghost" label={t("welcome.skip")} onPress={() => done()} testID="welcome-skip" />
          <Button label={t("welcome.next")} icon="arrow-forward" onPress={() => setStep(step + 1)} testID="welcome-next" />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.xl, gap: space.xl, maxWidth: 640, width: "100%", alignSelf: "center", paddingBottom: 60 },
  dots: { flexDirection: "row", gap: 6, alignSelf: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.line },
  dotOn: { backgroundColor: color.brand, width: 22 },
  level: { flexDirection: "row", gap: 12, padding: space.md, borderRadius: radius.md, borderWidth: 1, alignItems: "flex-start" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { gap: 6, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  nav: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
});
