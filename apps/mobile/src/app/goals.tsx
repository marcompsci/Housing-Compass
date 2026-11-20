/**
 * Savings goals: a move-in fund, an emergency fund, a deposit — with how much to put away each
 * month and from each paycheck to get there by the target date. Device-only.
 */
import { goalPlan } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export default function Goals() {
  return (
    <LockGate>
      <GoalsScreen />
    </LockGate>
  );
}

function GoalCard({ id }: { id: string }) {
  const { t } = useT();
  const g = useRenter((s) => s.goals.find((x) => x.id === id))!;
  const pay = useRenter((s) => s.pay);
  const update = useRenter((s) => s.updateGoal);
  const remove = useRenter((s) => s.removeGoal);
  const [add, setAdd] = useState("");
  const p = goalPlan(g, now(), pay);
  return (
    <View style={formStyles.card} testID="goal-card">
      <View style={formStyles.row}>
        <Text style={[type.h3, { flex: 1 }]}>{g.name}</Text>
        <Pressable onPress={() => remove(g.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: g.name })} hitSlop={10}>
          <Icon name="trash-outline" tint={color.muted} />
        </Pressable>
      </View>
      <View style={styles.track} accessibilityLabel={t("goal.progress", { pct: Math.round(p.progress * 100) })}>
        <View style={[styles.fill, { width: `${Math.round(p.progress * 100)}%` }]} />
      </View>
      <KV k={t("goal.saved")} v={`${usd(g.savedCents)} / ${usd(g.targetCents)}`} strong />
      {p.perMonthCents !== null ? <KV k={t("goal.perMonth")} v={usd(p.perMonthCents)} /> : null}
      {p.perPaycheckCents !== null ? <KV k={t("goal.perCheck")} v={usd(p.perPaycheckCents)} /> : null}
      {g.targetDate ? <Text style={type.tiny}>{p.overdue ? t("goal.overdue", { date: g.targetDate }) : t("goal.by", { date: g.targetDate })}</Text> : null}
      {p.remainingCents === 0 ? <Text style={[type.small, { color: color.verified, fontWeight: "700" }]}>{t("goal.done")}</Text> : null}
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("goal.add")} value={add} onChangeText={setAdd} keyboardType="decimal-pad" testID="goal-add-amount" />
        </View>
        <Button
          kind="secondary"
          label={t("goal.addBtn")}
          testID="goal-add-btn"
          onPress={() => {
            const c = toCents(add);
            if (c > 0) update(g.id, { savedCents: Math.min(100_000_000, g.savedCents + c) });
            setAdd("");
          }}
        />
      </View>
    </View>
  );
}

function GoalsScreen() {
  const { t } = useT();
  const goals = useRenter((s) => s.goals);
  const addGoal = useRenter((s) => s.addGoal);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const presets = [t("goal.p.movein"), t("goal.p.emergency"), t("goal.p.deposit")];
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="goals">
      <Banner tone="info" icon="flag-outline" title={t("goal.title")}>
        {t("goal.intro")}
      </Banner>
      {goals.map((g) => (
        <GoalCard key={g.id} id={g.id} />
      ))}
      <Section title={t("goal.new")}>
        <View style={formStyles.row}>
          {presets.map((p) => (
            <Chip key={p} label={p} selected={name === p} onPress={() => setName(p)} />
          ))}
        </View>
        <Field label={t("goal.name")} value={name} onChangeText={setName} testID="goal-name" />
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("goal.target")} value={target} onChangeText={setTarget} keyboardType="decimal-pad" testID="goal-target" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("goal.already")} value={saved} onChangeText={setSaved} keyboardType="decimal-pad" testID="goal-saved" />
          </View>
        </View>
        <Field label={t("goal.date")} value={date} onChangeText={setDate} autoCapitalize="none" placeholder="2027-03-01" testID="goal-date" />
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="add-circle-outline"
          label={t("goal.create")}
          testID="goal-create"
          onPress={() => {
            const tc = toCents(target);
            const sc = saved.trim() ? toCents(saved) : 0;
            if (name.trim().length < 2 || !(tc > 0) || !(sc >= 0) || (date && !isDate(date))) return setErr(t("goal.err"));
            addGoal({ name: name.trim().slice(0, 60), targetCents: tc, savedCents: Math.min(sc, tc), targetDate: date || null });
            setName("");
            setTarget("");
            setSaved("");
            setDate("");
            setErr(null);
          }}
        />
      </Section>
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  track: { height: 10, borderRadius: radius.md, backgroundColor: color.neutralSoft, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: color.brand },
});
