import { affordableMonthlyCents, formatUsd } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Banner, Button, Chip, KV, Section } from "../components/ui";
import { useHousehold } from "../state/household";
import { HIT, color, radius, space, type } from "../theme";

const toCents = (s: string) => Math.round(Number(s.replace(/[$,\s]/g, "") || "0") * 100);

export default function MyNumbers() {
  const { profile, set } = useHousehold();
  const [size, setSize] = useState(profile?.householdSize ?? 1);
  const [income, setIncome] = useState(profile ? String(profile.annualIncomeCents / 100) : "");
  const [savings, setSavings] = useState(profile ? String(profile.savingsCents / 100) : "");
  const incomeCents = toCents(income);
  const valid = incomeCents >= 0 && !Number.isNaN(incomeCents) && !Number.isNaN(toCents(savings));

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Banner tone="info" icon="lock-closed-outline" title="Stays on this phone">
        These numbers are never uploaded, synced or shared. They're used only to check listings against their own stated rules.
      </Banner>
      <Section title="Household size">
        <View style={styles.row}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <Chip key={n} label={String(n)} selected={size === n} onPress={() => setSize(n)} accessibilityHint={`${n} people`} />
          ))}
        </View>
      </Section>
      <Section title="Yearly household income (before taxes)">
        <TextInput value={income} onChangeText={setIncome} keyboardType="decimal-pad" placeholder="e.g. 52000" style={styles.input} accessibilityLabel="Yearly household income in dollars" />
        {incomeCents > 0 ? <KV k="Rent at 30% of income" v={`${formatUsd(affordableMonthlyCents(incomeCents))} / mo`} strong /> : null}
        <Text style={type.tiny}>Paying more than 30% of income on housing is “cost-burdened” (HUD definition); more than 50% is severe.</Text>
      </Section>
      <Section title="Savings for moving in">
        <TextInput value={savings} onChangeText={setSavings} keyboardType="decimal-pad" placeholder="e.g. 2500" style={styles.input} accessibilityLabel="Savings available for move-in costs in dollars" />
      </Section>
      <Button
        label="Save on this device"
        disabled={!valid || incomeCents <= 0}
        onPress={() => {
          set({ householdSize: size, annualIncomeCents: incomeCents, savingsCents: toCents(savings) });
          router.back();
        }}
      />
      {profile ? <Button kind="danger" label="Clear my numbers" onPress={() => { set(null); setIncome(""); setSavings(""); }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 16, color: color.ink, backgroundColor: color.surface },
});
