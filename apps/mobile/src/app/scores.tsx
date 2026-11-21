/**
 * Score journal: credit scores the user sees in their bank or card app, written down with the
 * date and source so they can watch the trend. The app never estimates or invents a score.
 */
import { scoreTrend } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, today } from "../components/forms";
import { Banner, Button, Chip, Icon, Section } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export default function ScoresRoute() {
  return (
    <LockGate>
      <Scores />
    </LockGate>
  );
}

function Scores() {
  const { t } = useT();
  const r = useRenter();
  const tr = scoreTrend(r.scores);
  const [score, setScore] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(today(now()));
  const [err, setErr] = useState<string | null>(null);
  const sources = [...new Set(r.scores.map((s) => s.source))].slice(0, 6);
  const lo = Math.min(tr.min ?? 300, 550);
  const hi = Math.max(tr.max ?? 850, 750);
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="scores">
      <Banner tone="info" icon="analytics-outline" title={t("sc.title")}>
        {t("sc.intro")}
      </Banner>
      {tr.latest ? (
        <View style={formStyles.card} testID="sc-latest">
          <Text style={type.tiny}>{t("sc.latest", { date: tr.latest.date, source: tr.latest.source })}</Text>
          <Text style={type.title}>{tr.latest.score}</Text>
          {tr.sameSourceChange !== null ? <Text style={[type.small, { color: tr.sameSourceChange >= 0 ? color.verified : color.danger, fontWeight: "700" }]}>{t("sc.change", { n: sign(tr.sameSourceChange), source: tr.latest.source })}</Text> : null}
          <View style={styles.chart} accessibilityLabel={t("sc.chart")}>
            {tr.rows.slice(-12).map((x) => (
              <View key={x.id} style={styles.barWrap}>
                <View style={[styles.bar, { height: `${Math.max(6, Math.round(((x.score - lo) / (hi - lo)) * 100))}%` }]} />
                <Text style={styles.barLabel}>{x.date.slice(5)}</Text>
              </View>
            ))}
          </View>
          <Text style={type.tiny}>{t("sc.compare")}</Text>
        </View>
      ) : null}
      <Section title={t("sc.add")}>
        {sources.length ? (
          <View style={formStyles.row}>
            {sources.map((s) => (
              <Chip key={s} label={s} selected={source === s} onPress={() => setSource(s)} />
            ))}
          </View>
        ) : null}
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 110 }}>
            <Field label={t("sc.score")} value={score} onChangeText={setScore} keyboardType="number-pad" testID="sc-score" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("side.date")} value={date} onChangeText={setDate} autoCapitalize="none" testID="sc-date" />
          </View>
        </View>
        <Field label={t("sc.source")} value={source} onChangeText={setSource} placeholder={t("sc.sourcePh")} testID="sc-source" />
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="add-circle-outline"
          label={t("sc.save")}
          testID="sc-add"
          onPress={() => {
            const s = Number(score);
            if (!Number.isInteger(s) || s < 300 || s > 900 || !isDate(date) || source.trim().length < 2) return setErr(t("sc.err"));
            r.addScore({ score: s, date, source: source.trim().slice(0, 60) });
            setScore("");
            setErr(null);
          }}
        />
      </Section>
      {[...tr.rows].reverse().map((x) => (
        <View key={x.id} style={styles.row}>
          <Text style={[type.small, { flex: 1 }]}>
            {x.date} · {x.source}
          </Text>
          <Text style={[type.small, { fontWeight: "700" }]}>{x.score}</Text>
          <Pressable onPress={() => r.removeScore(x.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: `${x.score}` })} hitSlop={10}>
            <Icon name="trash-outline" size={16} tint={color.muted} />
          </Pressable>
        </View>
      ))}
      <Text style={type.tiny}>{t("sc.never")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  chart: { height: 110, flexDirection: "row", alignItems: "flex-end", gap: 6, paddingTop: 8 },
  barWrap: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", gap: 2 },
  bar: { width: "70%", borderRadius: radius.sm, backgroundColor: color.brand },
  barLabel: { fontSize: 9, color: color.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
