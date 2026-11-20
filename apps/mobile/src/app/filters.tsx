import { HARD_MAX_CEILING_CENTS, findCity, formatUsd, type BudgetPrefs } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { useT } from "../i18n";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Button, Chip, Section } from "../components/ui";
import { now } from "../config";
import { useStore } from "../state/store";
import { HIT, color, radius, space, type } from "../theme";

function Stepper({ label, cents, onChange, min, max, step = 5000 }: { label: string; cents: number; onChange(v: number): void; min: number; max: number; step?: number }) {
  return (
    <View style={styles.stepRow} accessible accessibilityRole="adjustable" accessibilityLabel={`${label}: ${formatUsd(cents)}`}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, cents + (e.nativeEvent.actionName === "increment" ? step : -step))))}
    >
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, cents - step))} accessibilityLabel={`Decrease ${label}`} accessibilityRole="button">
        <Text style={styles.stepTxt}>−</Text>
      </Pressable>
      <Text style={[type.h3, { minWidth: 72, textAlign: "center" }]}>{formatUsd(cents)}</Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, cents + step))} accessibilityLabel={`Increase ${label}`} accessibilityRole="button">
        <Text style={styles.stepTxt}>+</Text>
      </Pressable>
    </View>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange(v: boolean): void; hint?: string }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{label}</Text>
        {hint ? <Text style={type.tiny}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: color.brand, false: color.line }} />
    </View>
  );
}

const plusDays = (d: number) => new Date(now().getTime() + d * 86_400_000).toISOString().slice(0, 10);

export default function Filters() {
  const { t } = useT();
  const f = useStore((s) => s.filters);
  const patch = useStore((s) => s.patchFilters);
  const setBudget = useStore((s) => s.setBudget);
  const reset = useStore((s) => s.resetFilters);
  const saveSearch = useStore((s) => s.saveSearch);
  const [commuteText, setCommuteText] = useState("");
  const [commuteError, setCommuteError] = useState("");
  const [name, setName] = useState("");
  const b = f.budget;
  const setB = (p: Partial<BudgetPrefs>) => setBudget({ ...b, ...p });

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Section title={t("f.budget")}>
        <Text style={type.small}>{t("f.rooms")}</Text>
        <Stepper label={t("f.min")} cents={b.roomMinCents} min={0} max={b.roomMaxCents} onChange={(v) => setB({ roomMinCents: v })} />
        <Stepper label={t("f.max")} cents={b.roomMaxCents} min={b.roomMinCents} max={HARD_MAX_CEILING_CENTS} onChange={(v) => setB({ roomMaxCents: v })} />
        <Text style={[type.small, { marginTop: 8 }]}>{t("f.units")}</Text>
        <Stepper label={t("f.prefUpTo")} cents={b.unitPreferredMaxCents} min={50000} max={b.unitHardMaxCents} onChange={(v) => setB({ unitPreferredMaxCents: v })} />
        <Stepper label={t("f.hardMax")} cents={b.unitHardMaxCents} min={b.unitPreferredMaxCents} max={HARD_MAX_CEILING_CENTS} onChange={(v) => setB({ unitHardMaxCents: v })} />
        <Text style={type.tiny}>{t("f.budgetNote", { max: formatUsd(HARD_MAX_CEILING_CENTS) })}</Text>
      </Section>

      <Section title={t("f.mustHaves")}>
        <Toggle label={t("f.pets")} value={f.petsRequired} onChange={(v) => patch({ petsRequired: v })} />
        <Toggle label={t("f.utilities")} value={f.utilitiesIncludedRequired} onChange={(v) => patch({ utilitiesIncludedRequired: v })} />
        <Toggle label={t("f.parking")} value={f.parkingRequired} onChange={(v) => patch({ parkingRequired: v })} />
        <Toggle label={t("f.vouchers")} value={f.vouchersRequired} onChange={(v) => patch({ vouchersRequired: v })} hint={t("f.vouchersHint")} />
        <Toggle label={t("f.transit")} value={f.maxTransitWalkMinutes !== null} onChange={(v) => patch({ maxTransitWalkMinutes: v ? 10 : null })} />
        <Toggle label={t("f.access")} value={f.accessibilityRequired} onChange={(v) => patch({ accessibilityRequired: v })} hint={t("f.accessHint")} />
        <Text style={type.small}>{t("f.furnished")}</Text>
        <View style={styles.row}>
          {(["any", "furnished", "unfurnished"] as const).map((v) => (
            <Chip key={v} label={v === "any" ? t("f.any") : v === "furnished" ? t("f.furnishedYes") : t("f.unfurnished")} selected={f.furnished === v} onPress={() => patch({ furnished: v })} />
          ))}
        </View>
        <Text style={type.small}>{t("f.lease")}</Text>
        <View style={styles.row}>
          {[null, 1, 6, 12].map((m) => (
            <Chip key={String(m)} label={m === null ? t("f.any") : m === 1 ? t("f.monthToMonth") : t("f.upToMonths", { n: m })} selected={f.maxMinLeaseMonths === m} onPress={() => patch({ maxMinLeaseMonths: m })} />
          ))}
        </View>
        <Text style={type.small}>{t("f.moveInBy")}</Text>
        <View style={styles.row}>
          {[null, 14, 30, 60].map((d) => (
            <Chip key={String(d)} label={d === null ? t("f.anyTime") : t("f.withinDays", { n: d })} selected={d === null ? f.moveInBy === null : f.moveInBy === plusDays(d)} onPress={() => patch({ moveInBy: d === null ? null : plusDays(d) })} />
          ))}
        </View>
        <Toggle
          label={t("f.possible")}
          value={f.includeUnconfirmedMatches}
          onChange={(v) => patch({ includeUnconfirmedMatches: v })}
          hint={t("f.possibleHint")}
        />
      </Section>

      <Section title={t("f.distance")}>
        <Text style={type.small}>{t("f.radius")}</Text>
        <View style={styles.row}>
          {[null, 10, 25, 50].map((r) => (
            <Chip key={String(r)} label={r === null ? t("f.wholeRegion") : `${Math.round(r * 0.621)} mi`} selected={f.radiusKm === r} onPress={() => patch({ radiusKm: r })} />
          ))}
        </View>
        <Text style={type.small}>{t("f.commute")}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={commuteText}
            onChangeText={(t) => { setCommuteText(t); setCommuteError(""); }}
            placeholder={t("f.commutePh")}
            style={styles.input}
            accessibilityLabel={t("f.commute")}
            autoCapitalize="words"
          />
          <Button
            label={t("f.set")}
            kind="secondary"
            onPress={() => {
              const c = findCity(commuteText);
              if (!c) return setCommuteError(t("f.commuteError"));
              patch({ commuteTo: { lat: c.lat, lng: c.lng }, maxCommuteKm: f.maxCommuteKm });
            }}
          />
        </View>
        {commuteError ? <Text style={[type.tiny, { color: color.danger }]}>{commuteError}</Text> : null}
        {f.commuteTo ? (
          <>
            <View style={styles.row}>
              {[null, 10, 20, 40].map((k) => (
                <Chip key={String(k)} label={k === null ? t("f.anyDistance") : `≤ ${Math.round(k * 0.621)} mi`} selected={f.maxCommuteKm === k} onPress={() => patch({ maxCommuteKm: k })} />
              ))}
              <Chip label={t("f.clearDest")} onPress={() => patch({ commuteTo: null, maxCommuteKm: null })} />
            </View>
            <Text style={type.tiny}>{t("f.commuteNote")}</Text>
          </>
        ) : null}
      </Section>

      <Section title={t("f.sort")}>
        <View style={styles.row}>
          {(
            [
              ["price_asc", t("f.sortRent")],
              ["total_monthly", t("f.sortTotal")],
              ["distance", t("f.sortClosest")],
              ["recently_checked", t("f.sortChecked")],
            ] as const
          ).map(([v, label]) => (
            <Chip key={v} label={label} selected={f.sort === v} onPress={() => patch({ sort: v })} />
          ))}
        </View>
        <Text style={type.tiny}>{t("f.sortNote")}</Text>
      </Section>

      <Section title={t("f.saveSearch")}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={name} onChangeText={setName} placeholder={t("f.saveNamePh")} style={styles.input} accessibilityLabel={t("f.saveNamePh")} maxLength={80} />
          <Button label={t("f.save")} onPress={() => { saveSearch(name.trim() || t("f.mySearch")); setName(""); router.back(); }} />
        </View>
        <Text style={type.tiny}>{t("f.saveNote")}</Text>
      </Section>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button style={{ flex: 1 }} kind="secondary" label={t("f.reset")} onPress={reset} />
        <Button style={{ flex: 1 }} label={t("f.show")} onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: HIT, height: HIT, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center", backgroundColor: color.bg },
  stepTxt: { fontSize: 22, fontWeight: "700", color: color.ink },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: HIT },
  input: { flex: 1, minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 15, color: color.ink, backgroundColor: color.surface },
});
