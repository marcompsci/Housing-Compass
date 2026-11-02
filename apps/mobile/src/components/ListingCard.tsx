import {
  categorize,
  moveInTotal,
  formatRent,
  formatUsd,
  priceMayBeOutdated,
  totalMonthly,
  type SearchHit,
} from "@housing-compass/core";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { now } from "../config";
import { addressText, ago, shortDate } from "../lib/format";
import { useT } from "../i18n";
import { hostOf, openExternal } from "../lib/links";
import { useStore } from "../state/store";
import { HIT, color, radius, space, type } from "../theme";
import { DemoTag, TrustBadge } from "./TrustBadge";
import { Icon, Tag } from "./ui";

export function ListingCard({ hit, compact }: { hit: SearchHit; compact?: boolean }) {
  const l = hit.listing;
  const { t, d } = useT();
  const rent = formatRent(l, d.basisSuffix);
  const verifiedText = l.verification.lastVerifiedAt
    ? t("card.verified", { date: shortDate(l.verification.lastVerifiedAt), ago: ago(l.verification.lastVerifiedAt) })
    : t("card.neverVerified", { date: shortDate(l.source.capturedAt) });
  const fav = useStore((s) => s.favorites.includes(l.id));
  const inCompare = useStore((s) => s.compare.includes(l.id));
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const prefMax = useStore((s) => s.filters.budget.unitPreferredMaxCents);
  const total = totalMonthly(l);
  const move = moveInTotal(l);
  const money = (c: number | null) => (c === null ? "not confirmed" : formatUsd(c));
  const unverified = l.verification.level === "SOURCE_LISTED_UNVERIFIED";
  const sourceUrl = l.source.listingUrl ?? l.source.searchPageUrls[0] ?? null;
  const sourceLabel = l.isDemo ? l.source.sourceName : t("card.source", { name: l.source.sourceName });

  return (
    <Pressable
      onPress={() => router.push(`/listing/${encodeURIComponent(l.id)}`)}
      accessibilityRole="button"
      accessibilityLabel={`${l.title}. ${rent}. ${addressText(l)}. ${d.level[l.verification.level]}.`}
      style={({ pressed }) => [styles.card, unverified && styles.cardWarn, l.isDemo && styles.cardDemo, pressed && { opacity: 0.92 }]}
      testID="listing-card"
    >
      <View style={styles.topRow}>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {l.isDemo ? <DemoTag /> : null}
          <TrustBadge listing={l} />
        </View>
        <Pressable
          onPress={() => toggleFavorite(l.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={fav ? "Remove from saved" : "Save listing"}
          accessibilityState={{ selected: fav }}
          style={styles.iconBtn}
        >
          <Icon name={fav ? "heart" : "heart-outline"} size={22} tint={fav ? color.danger : color.sub} />
        </Pressable>
      </View>

      <Text style={type.h3} numberOfLines={2}>
        {l.title}
      </Text>
      <Text style={type.small} numberOfLines={1}>
        {addressText(l)}
        {l.location.precision === "city_approx" ? "  ·  map pin is city-level" : ""}
      </Text>

      <View style={styles.priceRow}>
        <Text style={type.price} testID="rent">
          {rent}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Tag label={`${t("card.rentBasis", { basis: d.basis[l.pricing.basis] })}${l.pricing.basisConfirmed ? "" : ` ${t("card.unconfirmed")}`}`} tone={l.pricing.basisConfirmed ? "neutral" : "warn"} />
        {hit.budget === "over_preferred" ? <Tag label={`Above your ${formatUsd(prefMax)} preference`} tone="warn" /> : null}
        {!l.unit.unitTypeConfirmed ? <Tag label="Unit type unconfirmed" tone="warn" /> : null}
      </View>
      <Text style={[type.small, total.amountCents === null && { fontStyle: "italic" }]}>{total.label}</Text>
      <Text style={type.tiny} testID="cost-facts">
        {d.category[categorize(l) ?? "PRIVATE_ROOM"]} · Deposit {money(l.pricing.depositCents)} · Application fee {money(l.pricing.applicationFeeCents)} · Move-in {move.amountCents === null ? "not confirmed" : formatUsd(move.amountCents)}
      </Text>
      <Text style={type.tiny} testID="availability">
        {l.verification.availabilityConfirmedAt ? `Availability confirmed ${shortDate(l.verification.availabilityConfirmedAt)}` : "Availability not confirmed"}
      </Text>
      {hit.unconfirmed.length ? <Tag label={`Not confirmed: ${hit.unconfirmed.join(", ")}`} tone="warn" /> : null}

      {!compact ? (
        <View style={styles.meta}>
          <Text style={type.tiny} testID="last-verified">
            {verifiedText}
            {priceMayBeOutdated(l, now()) ? " · price may have changed" : ""}
          </Text>
          {sourceUrl ? (
            <Pressable onPress={() => openExternal(sourceUrl)} accessibilityRole="link" accessibilityLabel={`${sourceLabel}. Opens ${hostOf(sourceUrl)}`} hitSlop={6} testID="source-link">
              <Text style={styles.link}>
                {sourceLabel} ↗ <Text style={type.tiny}>({hostOf(sourceUrl)})</Text>
              </Text>
            </Pressable>
          ) : (
            <Text style={type.tiny} testID="source-link">
              {sourceLabel}
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.actions}>
        {hit.distanceKm !== null ? <Text style={type.tiny}>{(hit.distanceKm * 0.621371).toFixed(1)} mi away (straight line)</Text> : <View />}
        <Pressable
          onPress={() => toggleCompare(l.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: inCompare }}
          accessibilityLabel={inCompare ? "Remove from compare" : "Add to compare"}
          style={[styles.compareBtn, inCompare && { backgroundColor: color.ink }]}
        >
          <Icon name={inCompare ? "checkmark" : "git-compare-outline"} size={15} tint={inCompare ? "#fff" : color.ink} />
          <Text style={[styles.compareText, inCompare && { color: "#fff" }]}>{inCompare ? t("card.comparing") : t("card.compare")}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: 8, borderWidth: 1, borderColor: color.line },
  cardWarn: { borderColor: color.warnLine, borderLeftWidth: 5 },
  cardDemo: { borderColor: color.demo, borderStyle: "dashed" },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  iconBtn: { width: HIT, height: HIT, marginTop: -10, marginRight: -10, alignItems: "center", justifyContent: "center" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 2 },
  meta: { gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, paddingTop: 8 },
  link: { fontSize: 13, color: color.official, fontWeight: "700", textDecorationLine: "underline" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compareBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: color.ink },
  compareText: { fontSize: 13, fontWeight: "700", color: color.ink },
});
