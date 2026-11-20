/**
 * 52-week savings challenge: save $1 in week 1, $2 in week 2 … $52 in week 52 ($1,378 in a
 * year), or start with the biggest weeks. Pick the step size; check weeks off. Device-only.
 */
import { challengeAmount, challengeStatus } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formStyles, today, usd } from "../components/forms";
import { Banner, Button, Chip, KV } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

export default function ChallengeRoute() {
  return (
    <LockGate>
      <ChallengeScreen />
    </LockGate>
  );
}

function ChallengeScreen() {
  const { t } = useT();
  const r = useRenter();
  const td = today(now());
  const [unit, setUnit] = useState(100);
  const [reverse, setReverse] = useState(false);
  const c = r.challenge;
  if (!c) {
    const total = Array.from({ length: 52 }, (_, i) => (i + 1) * unit).reduce((s, x) => s + x, 0);
    return (
      <ScrollView contentContainerStyle={styles.wrap} testID="challenge">
        <Banner tone="info" icon="calendar-number-outline" title={t("ch.title")}>
          {t("ch.intro")}
        </Banner>
        <Text style={[type.small, { fontWeight: "700" }]}>{t("ch.step")}</Text>
        <View style={formStyles.row}>
          {[50, 100, 200, 500].map((u) => (
            <Chip key={u} label={usd(u)} selected={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>
        <View style={formStyles.row}>
          <Chip label={t("ch.small")} selected={!reverse} onPress={() => setReverse(false)} />
          <Chip label={t("ch.big")} selected={reverse} onPress={() => setReverse(true)} />
        </View>
        <KV k={t("ch.total")} v={usd(total)} strong />
        <Button icon="flag-outline" label={t("ch.start")} onPress={() => r.startChallenge({ start: td, reverse, unitCents: unit })} testID="ch-start" />
      </ScrollView>
    );
  }
  const s = challengeStatus(c, td);
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="challenge">
      <View style={[formStyles.card, { backgroundColor: color.brandSoft }]} testID="ch-status">
        <Text style={type.tiny}>{t("ch.weekOf", { n: s.week })}</Text>
        <Text style={type.title}>{s.finished ? t("ch.done") : t("ch.save", { amount: usd(s.thisWeekCents) })}</Text>
        <KV k={t("ch.saved")} v={`${usd(s.savedCents)} / ${usd(s.totalCents)}`} strong />
        {s.behind.length > 1 ? <Text style={type.small}>{t("ch.behind", { n: s.behind.length - 1 })}</Text> : null}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => {
          const done = c.done.includes(w);
          return (
            <Pressable key={w} onPress={() => r.toggleChallengeWeek(w)} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={t("ch.cell", { n: w, amount: usd(challengeAmount(c, w)) })} style={[styles.cell, done && styles.cellDone, w === s.week && styles.cellNow]} testID={`ch-week-${w}`}>
              <Text style={[styles.cellN, done && { color: "#fff" }]}>{w}</Text>
              <Text style={[styles.cellA, done && { color: "#fff" }]}>{usd(challengeAmount(c, w))}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={type.tiny}>{t("ch.tip")}</Text>
      <Button kind="ghost" label={t("ch.end")} onPress={r.endChallenge} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell: { width: 60, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: color.line, alignItems: "center", backgroundColor: color.surface },
  cellDone: { backgroundColor: color.verified, borderColor: color.verified },
  cellNow: { borderColor: color.brand, borderWidth: 2 },
  cellN: { fontSize: 12, fontWeight: "800", color: color.ink },
  cellA: { fontSize: 11, color: color.muted },
});
