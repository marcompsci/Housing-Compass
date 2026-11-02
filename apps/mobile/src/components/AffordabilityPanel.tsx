import { formatUsd, summarizeAffordability, type Listing, type Verdict } from "@housing-compass/core";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { useHousehold } from "../state/household";
import { color, type } from "../theme";
import { Button, Icon, KV, Section } from "./ui";

const V: Record<Verdict, { icon: "checkmark-circle" | "close-circle" | "help-circle"; tint: string; word: string }> = {
  yes: { icon: "checkmark-circle", tint: color.verified, word: "Likely yes" },
  no: { icon: "close-circle", tint: color.danger, word: "Likely no" },
  unknown: { icon: "help-circle", tint: color.muted, word: "Unknown — ask" },
};

function Row({ label, verdict, reason }: { label: string; verdict: Verdict; reason: string }) {
  const v = V[verdict];
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 4 }} accessible accessibilityLabel={`${label}: ${v.word}. ${reason}`}>
      <Icon name={v.icon} size={20} tint={v.tint} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontWeight: "700" }]}>
          {label}: <Text style={{ color: v.tint }}>{v.word}</Text>
        </Text>
        <Text style={type.small}>{reason}</Text>
      </View>
    </View>
  );
}

export function AffordabilityPanel({ listing }: { listing: Listing }) {
  const profile = useHousehold((s) => s.profile);
  if (!profile) {
    return (
      <Section title="Can I afford & qualify?">
        <Text style={type.small}>Add your household size, income and savings (kept on this phone only) to check this home against its own rules.</Text>
        <Button kind="secondary" icon="calculator-outline" label="Add my numbers" onPress={() => router.push("/affordability")} />
      </Section>
    );
  }
  const s = summarizeAffordability(listing, profile);
  const pct = Number.isFinite(s.burden.share) ? Math.round(s.burden.share * 100) : null;
  const burdenText = { affordable: "Within 30% of income", cost_burdened: "30–50% of income (cost-burdened)", severely_cost_burdened: "Over 50% of income (severely cost-burdened)" }[s.burden.burden];
  return (
    <Section title="Can I afford & qualify?" right={<Text style={type.tiny} onPress={() => router.push("/affordability")}>Edit numbers</Text>}>
      <KV k={`Monthly cost${s.monthlyIsComplete ? "" : " (known parts)"}`} v={`${formatUsd(s.monthlyCents)}${pct !== null ? ` · ${pct}% of income` : ""}`} strong />
      <Text style={[type.small, { color: s.burden.burden === "affordable" ? color.verified : color.warn }]}>{burdenText}</Text>
      <Row label="Income limit" verdict={s.eligibility.incomeLimit.verdict} reason={s.eligibility.incomeLimit.reason} />
      <Row label="Minimum income" verdict={s.eligibility.minimumIncome.verdict} reason={s.eligibility.minimumIncome.reason} />
      <KV k="Upfront to move in" v={s.moveIn.complete ? formatUsd(s.moveIn.knownUpfrontCents) : "Not fully known"} unknown={!s.moveIn.complete} />
      {s.moveIn.complete && s.moveIn.shortfallCents > 0 ? <Text style={[type.small, { color: color.warn }]}>You'd need about {formatUsd(s.moveIn.shortfallCents)} more than your savings.</Text> : null}
      {s.moveIn.unknownItems.length ? <Text style={type.tiny}>Ask about: {s.moveIn.unknownItems.join(", ")}.</Text> : null}
      <Text style={type.tiny}>A guide, not a decision. The property makes the final call.</Text>
    </Section>
  );
}
