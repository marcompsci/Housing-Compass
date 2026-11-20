import { BASIS_LABEL, LEVEL_LABEL, feeChecks, formatRent, formatUsd, groupByBasis, moveInTotal, rentBurden, totalMonthly, type HouseholdProfile, type Listing, type PriceBasis } from "@housing-compass/core";
import { useHousehold } from "../../state/household";
import { useStore as useAppStore } from "../../state/store";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Button } from "../../components/ui";
import { useListings } from "../../data/hooks";
import { lastVerifiedText } from "../../lib/format";
import { useStore } from "../../state/store";
import { color, radius, space, type } from "../../theme";

const NC = "Not confirmed";

const ROWS: Array<[string, (l: Listing) => string]> = [
  ["Trust", (l) => (l.isDemo ? `DEMO · ${LEVEL_LABEL[l.verification.level]}` : LEVEL_LABEL[l.verification.level])],
  ["Rent", formatRent],
  ["Total monthly", (l) => { const t = totalMonthly(l); return t.amountCents === null ? NC : formatUsd(t.amountCents) + (t.complete ? "" : "*"); }],
  ["Deposit", (l) => (l.pricing.depositCents === null ? NC : formatUsd(l.pricing.depositCents))],
  ["Due at move-in", (l) => { const m = moveInTotal(l); return m.amountCents === null ? NC : formatUsd(m.amountCents); }],
  ["Application fee", (l) => (l.pricing.applicationFeeCents === null ? NC : formatUsd(l.pricing.applicationFeeCents))],
  ["Cost checks", (l) => { const c = feeChecks(l); return c.length ? c.map((x) => (x.code === "app_fee_over_cap" ? "Fee above CA cap?" : x.code === "deposit_over_two_months" ? "Deposit > 2 months" : "Deposit > 1 month")).join(" · ") : l.pricing.depositCents === null && l.pricing.applicationFeeCents === null ? NC : "No issues found"; }],
  ["City", (l) => l.address.city],
  ["Pets", (l) => l.amenities.pets?.replace(/_/g, " ") ?? NC],
  ["Furnished", (l) => (l.amenities.furnished === null ? NC : l.amenities.furnished ? "Yes" : "No")],
  ["Min. lease", (l) => (l.lease.minTermMonths ? `${l.lease.minTermMonths} mo` : NC)],
  ["Income-restricted", (l) => (l.eligibility.incomeRestricted ? `Yes${l.eligibility.amiPercent ? ` (${l.eligibility.amiPercent}% AMI)` : ""}` : "No / not stated")],
  ["Last verified", lastVerifiedText],
];

function incomeRow(h: HouseholdProfile | null): [string, (l: Listing) => string][] {
  if (!h || h.annualIncomeCents <= 0) return [];
  return [["Share of income", (l) => { const t = totalMonthly(l); const cents = t.amountCents ?? l.pricing.baseRentCents; const b = rentBurden(cents, h.annualIncomeCents); return `${Math.round(b.share * 100)}%${b.burden === "affordable" ? "" : b.burden === "cost_burdened" ? " (over 30%)" : " (over 50%)"}${t.amountCents === null ? " · rent only" : ""}`; }]];
}

function Notes({ listings }: { listings: Listing[] }) {
  const notes = useAppStore((s) => s.notes);
  const withNotes = listings.filter((l) => notes[l.id]);
  if (!withNotes.length) return null;
  return (
    <View style={{ gap: 4 }}>
      {withNotes.map((l) => (
        <Text key={l.id} style={type.tiny}>
          <Text style={{ fontWeight: "700" }}>{l.title}:</Text> {notes[l.id]}
        </Text>
      ))}
    </View>
  );
}

function Table({ listings }: { listings: Listing[] }) {
  const household = useHousehold((s) => s.profile);
  const rows = [...ROWS, ...incomeRow(household)];
  return (
    <ScrollView horizontal contentContainerStyle={{ paddingBottom: 4 }}>
      <View style={styles.table}>
        <View style={styles.row}>
          <View style={[styles.cell, styles.labelCell]} />
          {listings.map((l) => (
            <View key={l.id} style={[styles.cell, styles.head]}>
              <Text style={type.h3} numberOfLines={3} onPress={() => router.push(`/listing/${encodeURIComponent(l.id)}`)}>
                {l.title}
              </Text>
            </View>
          ))}
        </View>
        {rows.map(([label, fn]) => (
          <View key={label} style={styles.row}>
            <View style={[styles.cell, styles.labelCell]}>
              <Text style={[type.small, { fontWeight: "700" }]}>{label}</Text>
            </View>
            {listings.map((l) => {
              const v = fn(l);
              return (
                <View key={l.id} style={styles.cell}>
                  <Text style={[type.body, v === NC && { color: color.muted, fontStyle: "italic" }]}>{v}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function Compare() {
  const ids = useStore((s) => s.compare);
  const clear = useStore((s) => s.clearCompare);
  const listings = useListings(ids);
  const groups = groupByBasis(listings);
  const nonEmpty = (Object.keys(groups) as PriceBasis[]).filter((b) => groups[b].length > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={type.title} accessibilityRole="header">
            Compare
          </Text>
          {listings.length ? <Button kind="ghost" label="Clear" onPress={clear} /> : null}
        </View>
        {listings.length === 0 ? <Text style={type.small}>Add up to 3 listings with the Compare button.</Text> : null}
        {nonEmpty.length > 1 ? (
          <Banner tone="info" icon="git-branch-outline" title="Shown in separate tables">
            A per-bed price, a per-room price and a whole-apartment price buy different things, so they are never compared side by side.
          </Banner>
        ) : null}
        {nonEmpty.map((b) => (
          <View key={b} style={{ gap: 8 }}>
            <Text style={type.h2}>Priced {BASIS_LABEL[b]}</Text>
            <Table listings={groups[b]} />
            <Notes listings={groups[b]} />
          </View>
        ))}
        {listings.length ? <Text style={type.tiny}>* Some monthly costs are not confirmed yet.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60 },
  table: { borderWidth: 1, borderColor: color.line, borderRadius: radius.md, backgroundColor: color.surface, overflow: "hidden" },
  row: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  cell: { width: 170, padding: 10 },
  labelCell: { width: 120, backgroundColor: color.bg },
  head: { backgroundColor: color.brandSoft },
});
