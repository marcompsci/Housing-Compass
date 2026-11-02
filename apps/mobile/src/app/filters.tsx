import { HARD_MAX_CEILING_CENTS, findCity, formatUsd, type BudgetPrefs } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
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
      <Section title="Budget">
        <Text style={type.small}>Rooms and shared housing</Text>
        <Stepper label="Minimum" cents={b.roomMinCents} min={0} max={b.roomMaxCents} onChange={(v) => setB({ roomMinCents: v })} />
        <Stepper label="Maximum" cents={b.roomMaxCents} min={b.roomMinCents} max={HARD_MAX_CEILING_CENTS} onChange={(v) => setB({ roomMaxCents: v })} />
        <Text style={[type.small, { marginTop: 8 }]}>Entire studios & 1-bedrooms</Text>
        <Stepper label="Preferred up to" cents={b.unitPreferredMaxCents} min={50000} max={b.unitHardMaxCents} onChange={(v) => setB({ unitPreferredMaxCents: v })} />
        <Stepper label="Hard maximum" cents={b.unitHardMaxCents} min={b.unitPreferredMaxCents} max={HARD_MAX_CEILING_CENTS} onChange={(v) => setB({ unitHardMaxCents: v })} />
        <Text style={type.tiny}>Budgets use the all-in monthly cost (rent + mandatory fees) whenever fees are known; otherwise advertised rent, labeled as such. Homes between your preference and hard maximum are labeled. Nothing above {formatUsd(HARD_MAX_CEILING_CENTS)} is ever shown.</Text>
      </Section>

      <Section title="Must-haves">
        <Toggle label="Pets allowed" value={f.petsRequired} onChange={(v) => patch({ petsRequired: v })} />
        <Toggle label="Utilities included" value={f.utilitiesIncludedRequired} onChange={(v) => patch({ utilitiesIncludedRequired: v })} />
        <Toggle label="Parking" value={f.parkingRequired} onChange={(v) => patch({ parkingRequired: v })} />
        <Toggle label="Accepts housing vouchers (confirmed)" value={f.vouchersRequired} onChange={(v) => patch({ vouchersRequired: v })} hint="In California, refusing voucher holders is generally unlawful — this shows homes where acceptance has been confirmed." />
        <Toggle label="Transit within a 10-minute walk" value={f.maxTransitWalkMinutes !== null} onChange={(v) => patch({ maxTransitWalkMinutes: v ? 10 : null })} />
        <Toggle label="Accessibility features" value={f.accessibilityRequired} onChange={(v) => patch({ accessibilityRequired: v })} hint="Wheelchair access, step-free entry, elevator…" />
        <Text style={type.small}>Furnished</Text>
        <View style={styles.row}>
          {(["any", "furnished", "unfurnished"] as const).map((v) => (
            <Chip key={v} label={v === "any" ? "Any" : v[0]!.toUpperCase() + v.slice(1)} selected={f.furnished === v} onPress={() => patch({ furnished: v })} />
          ))}
        </View>
        <Text style={type.small}>Lease I can commit to</Text>
        <View style={styles.row}>
          {[null, 1, 6, 12].map((m) => (
            <Chip key={String(m)} label={m === null ? "Any" : m === 1 ? "Month-to-month" : `≤ ${m} months`} selected={f.maxMinLeaseMonths === m} onPress={() => patch({ maxMinLeaseMonths: m })} />
          ))}
        </View>
        <Text style={type.small}>Move in by</Text>
        <View style={styles.row}>
          {[null, 14, 30, 60].map((d) => (
            <Chip key={String(d)} label={d === null ? "Any time" : `Within ${d} days`} selected={d === null ? f.moveInBy === null : f.moveInBy === plusDays(d)} onPress={() => patch({ moveInBy: d === null ? null : plusDays(d) })} />
          ))}
        </View>
        <Toggle
          label="Also show possible matches (not confirmed)"
          value={f.includeUnconfirmedMatches}
          onChange={(v) => patch({ includeUnconfirmedMatches: v })}
          hint="Off by default: unknown is never treated as yes. Turn on to also see homes where a must-have isn't confirmed — they're labeled."
        />
      </Section>

      <Section title="Distance & commute">
        <Text style={type.small}>Search radius from your search area</Text>
        <View style={styles.row}>
          {[null, 10, 25, 50].map((r) => (
            <Chip key={String(r)} label={r === null ? "Whole region" : `${Math.round(r * 0.621)} mi`} selected={f.radiusKm === r} onPress={() => patch({ radiusKm: r })} />
          ))}
        </View>
        <Text style={type.small}>Commute destination (city)</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={commuteText}
            onChangeText={(t) => { setCommuteText(t); setCommuteError(""); }}
            placeholder="e.g. San Francisco"
            style={styles.input}
            accessibilityLabel="Commute destination city"
            autoCapitalize="words"
          />
          <Button
            label="Set"
            kind="secondary"
            onPress={() => {
              const c = findCity(commuteText);
              if (!c) return setCommuteError("Pick a Bay Area city (street addresses need a geocoder — coming in Phase 3).");
              patch({ commuteTo: { lat: c.lat, lng: c.lng }, maxCommuteKm: f.maxCommuteKm });
            }}
          />
        </View>
        {commuteError ? <Text style={[type.tiny, { color: color.danger }]}>{commuteError}</Text> : null}
        {f.commuteTo ? (
          <>
            <View style={styles.row}>
              {[null, 10, 20, 40].map((k) => (
                <Chip key={String(k)} label={k === null ? "Any distance" : `≤ ${Math.round(k * 0.621)} mi`} selected={f.maxCommuteKm === k} onPress={() => patch({ maxCommuteKm: k })} />
              ))}
              <Chip label="Clear destination" onPress={() => patch({ commuteTo: null, maxCommuteKm: null })} />
            </View>
            <Text style={type.tiny}>Straight-line distance for now. Real transit and driving times arrive with a routing provider.</Text>
          </>
        ) : null}
      </Section>

      <Section title="Sort">
        <View style={styles.row}>
          {(
            [
              ["price_asc", "Lowest rent"],
              ["distance", "Closest"],
              ["recently_checked", "Recently checked"],
            ] as const
          ).map(([v, label]) => (
            <Chip key={v} label={label} selected={f.sort === v} onPress={() => patch({ sort: v })} />
          ))}
        </View>
        <Text style={type.tiny}>Verified homes always come before unverified leads, and per-bed prices are never sorted among per-room or whole-unit prices.</Text>
      </Section>

      <Section title="Save this search">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={name} onChangeText={setName} placeholder="Name, e.g. East Bay rooms" style={styles.input} accessibilityLabel="Saved search name" maxLength={80} />
          <Button label="Save" onPress={() => { saveSearch(name.trim() || "My search"); setName(""); router.back(); }} />
        </View>
        <Text style={type.tiny}>Saved on this device. Alerts for new matches arrive with accounts (Phase 3/6).</Text>
      </Section>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button style={{ flex: 1 }} kind="secondary" label="Reset filters" onPress={reset} />
        <Button style={{ flex: 1 }} label="Show results" onPress={() => router.back()} />
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
