import {
  BASIS_LABEL,
  CATEGORY_LABEL,
  CHECK_LABEL,
  VERIFICATION_CHECKS,
  budgetStatus,
  categorize,
  formatRent,
  formatUsd,
  haversineKm,
  kmToMiles,
  moveInTotal,
  priceMayBeOutdated,
  totalMonthly,
  type Listing,
} from "@housing-compass/core";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { DemoTag, TrustPanel } from "../../components/TrustBadge";
import { AffordabilityPanel } from "../../components/AffordabilityPanel";
import { Banner, Button, Icon, KV, Section, Tag } from "../../components/ui";
import { now } from "../../config";
import { useListing } from "../../data/hooks";
import { addressText, daysUntil, shortDate } from "../../lib/format";
import { hostOf, openExternal } from "../../lib/links";
import { useStore } from "../../state/store";
import { useApplications } from "../../state/applications";
import { canMessage, useConversations } from "../../state/conversations";
import { color, space, type } from "../../theme";

const NC = "Not confirmed";
const yesNo = (b: boolean | null, yes = "Yes", no = "No") => (b === null ? NC : b ? yes : no);

const PETS: Record<NonNullable<Listing["amenities"]["pets"]>, string> = { allowed: "Allowed", cats_only: "Cats only", dogs_only: "Dogs only", not_allowed: "Not allowed" };
const PROGRAM: Record<NonNullable<Listing["eligibility"]["programType"]>, string> = { lottery: "Lottery", waitlist: "Waitlist", first_come_first_served: "First come, first served", market: "Market rate" };

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listing: l, loading } = useListing(decodeURIComponent(String(id)));
  const fav = useStore((s) => (l ? s.favorites.includes(l.id) : false));
  const inCompare = useStore((s) => (l ? s.compare.includes(l.id) : false));
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const budget = useStore((s) => s.filters.budget);
  const commuteTo = useStore((s) => s.filters.commuteTo);
  const track = useApplications((s) => s.track);
  const openThread = useConversations((s) => s.open);
  const [msgError, setMsgError] = useState("");
  const tracked = useApplications((s) => (l ? s.items.some((a) => a.listingId === l.id) : false));

  if (!l && loading) {
    return (
      <View style={{ padding: space.xl }}>
        <Text style={type.small}>Loading…</Text>
      </View>
    );
  }
  if (!l) {
    return (
      <View style={{ padding: space.xl }}>
        <Text style={type.h2}>Listing not found</Text>
        <Text style={type.small}>It may have expired or been removed pending review.</Text>
      </View>
    );
  }

  const hidden = l.verification.level === "FLAGGED" || l.verification.level === "EXPIRED" || l.status !== "active";
  const total = totalMonthly(l);
  const movein = moveInTotal(l);
  const cat = categorize(l);
  const b = budgetStatus(l, budget);
  const unverified = l.verification.level === "SOURCE_LISTED_UNVERIFIED";
  const deadline = l.eligibility.applicationDeadline;

  const contact = () => {
    if (l.isDemo) return;
    const url = l.source.listingUrl ?? l.source.searchPageUrls[0];
    if (url) openExternal(url);
  };

  return (
    <>
      <Stack.Screen options={{ title: l.isDemo ? "Demo listing" : "Listing details" }} />
      <ScrollView contentContainerStyle={styles.wrap}>
        {l.isDemo ? (
          <Banner tone="demo" icon="flask-outline" title="Fictional demo listing">
            This record exists only to test the app. The address, price and contact are made up.
          </Banner>
        ) : null}
        {hidden ? (
          <Banner tone="danger" icon="eye-off-outline" title="Hidden from search">
            {l.verification.level === "FLAGGED" ? "A person is reviewing this listing. This is not a finding of fraud." : "This listing is no longer current."}
          </Banner>
        ) : null}

        <View style={{ gap: 6 }}>
          {l.isDemo ? <DemoTag /> : null}
          <Text style={type.title}>{l.title}</Text>
          <Text style={type.small}>{addressText(l)}</Text>
          {l.location.precision === "city_approx" ? <Text style={type.tiny}>Map location is the city center — the address has not been geocoded or confirmed.</Text> : null}
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {cat ? <Tag label={CATEGORY_LABEL[cat]} /> : null}
            {b === "over_preferred" ? <Tag label={`Above your ${formatUsd(budget.unitPreferredMaxCents)} preference`} tone="warn" /> : null}
            {!l.unit.unitTypeConfirmed ? <Tag label="Unit type unconfirmed" tone="warn" /> : null}
          </View>
        </View>

        <TrustPanel listing={l} />

        {unverified ? (
          <Banner tone="warn" icon="warning-outline" title="Before you contact anyone">
            Open the original site, confirm the exact unit and address, then contact the manager using a phone number you find independently (their official website or county records) — not one from the ad. Never send money, IDs or deposits before a tour and a signed lease.
          </Banner>
        ) : null}
        {unverified ? (
          <Button kind="secondary" icon="chatbubble-ellipses-outline" label="Got a reply? Check if it's safe" onPress={() => router.push("/check-message")} />
        ) : null}

        <Section title="What it costs">
          <View style={{ gap: 2 }}>
            <Text style={type.price}>{formatRent(l)}</Text>
            <Text style={type.small}>
              Rent basis: <Text style={{ fontWeight: "800" }}>{BASIS_LABEL[l.pricing.basis]}</Text>
              {l.pricing.basisConfirmed ? "" : " — not yet confirmed with the manager"}
              {l.pricing.qualifier === "STARTING_AT" ? " · advertised as a starting price" : ""}
            </Text>
          </View>
          <KV k="Base rent" v={formatRent(l)} />
          {l.pricing.recurringFees === null ? (
            <KV k="Recurring fees" v={NC} unknown />
          ) : l.pricing.recurringFees.length === 0 ? (
            <KV k="Recurring fees" v="None" />
          ) : (
            l.pricing.recurringFees.map((f) => <KV key={f.label} k={f.label} v={`${formatUsd(f.amountCents)} / mo`} />)
          )}
          <KV k="Utilities included" v={yesNo(l.pricing.utilitiesIncluded)} unknown={l.pricing.utilitiesIncluded === null} />
          <KV k="Total recurring monthly" v={total.amountCents === null ? NC : total.label} strong unknown={total.amountCents === null} />
          <KV k="Security deposit" v={l.pricing.depositCents === null ? NC : formatUsd(l.pricing.depositCents)} unknown={l.pricing.depositCents === null} />
          {l.pricing.moveInCosts?.map((c) => <KV key={c.label} k={c.label} v={formatUsd(c.amountCents)} />)}
          <KV k="Application fee" v={l.pricing.applicationFeeCents === null ? NC : formatUsd(l.pricing.applicationFeeCents)} unknown={l.pricing.applicationFeeCents === null} />
          <KV k="Due at move-in" v={movein.amountCents === null ? NC : formatUsd(movein.amountCents)} strong unknown={movein.amountCents === null} />
          <Text style={type.tiny}>Ask before paying any application fee: what it covers, whether it's refundable, and whether a screening report you already have can be reused.</Text>
          {l.pricing.concessions ? <KV k="Concessions" v={l.pricing.concessions} /> : null}
          {priceMayBeOutdated(l, now()) ? <Text style={type.tiny}>Price last checked {l.source.lastPriceCheckAt ? shortDate(l.source.lastPriceCheckAt) : "never"} — it may have changed.</Text> : null}
        </Section>

        <AffordabilityPanel listing={l} />

        <Section title="The home">
          <KV k="Type" v={l.unit.isEntireUnit ? `Entire ${l.unit.unitType === "studio" ? "studio" : `${l.unit.bedrooms ?? "?"}-bedroom`}` : l.unit.unitType === "bed_in_shared_room" ? "One bed in a shared room" : "Private room in a shared home"} />
          {l.unit.householdBedrooms ? <KV k="Bedrooms in the household" v={String(l.unit.householdBedrooms)} /> : null}
          <KV k="Bathrooms" v={l.unit.bathrooms === null ? NC : String(l.unit.bathrooms)} unknown={l.unit.bathrooms === null} />
          <KV k="Size" v={l.unit.sqft ? `${l.unit.sqft} sq ft` : NC} unknown={!l.unit.sqft} />
          <KV k="Furnished" v={yesNo(l.amenities.furnished)} unknown={l.amenities.furnished === null} />
          <KV k="Pets" v={l.amenities.pets ? PETS[l.amenities.pets] : NC} unknown={!l.amenities.pets} />
          <KV k="Housing vouchers" v={l.amenities.acceptsVouchers === null ? NC : l.amenities.acceptsVouchers ? "Accepted (confirmed)" : "Not stated"} unknown={l.amenities.acceptsVouchers === null} />
          <KV k="Accessibility" v={l.amenities.accessibility === null ? NC : l.amenities.accessibility.length ? l.amenities.accessibility.map((a) => a.replace(/_/g, " ")).join(", ") : "None listed"} unknown={l.amenities.accessibility === null} />
          <KV k="Minimum lease" v={l.lease.minTermMonths ? `${l.lease.minTermMonths} months` : NC} unknown={!l.lease.minTermMonths} />
          <KV k="Move-in date" v={l.lease.moveInDate ? shortDate(l.lease.moveInDate) : NC} unknown={!l.lease.moveInDate} />
        </Section>

        <Section title="Getting around">
          {l.transit.nearestStops?.length ? (
            l.transit.nearestStops.map((s) => <KV key={s.name} k={s.name} v={`${s.walkMinutes} min walk`} />)
          ) : (
            <KV k="Nearby transit" v={NC} unknown />
          )}
          {commuteTo ? <KV k="To your commute destination" v={`${kmToMiles(haversineKm(commuteTo, l.location)).toFixed(1)} mi straight-line`} /> : null}
          <Text style={type.tiny}>Travel times need a routing provider (511.org / transit feeds) — planned for a later phase.</Text>
        </Section>

        <Section title="Eligibility">
          <KV k="Income-restricted" v={l.eligibility.incomeRestricted ? "Yes" : "No / not stated"} />
          {l.eligibility.amiPercent ? <KV k="Area median income (AMI) level" v={`${l.eligibility.amiPercent}% AMI`} /> : null}
          {l.eligibility.programType ? <KV k="How you get it" v={PROGRAM[l.eligibility.programType]} /> : null}
          {deadline ? <KV k="Application deadline" v={`${shortDate(deadline)} (${daysUntil(deadline) >= 0 ? `${daysUntil(deadline)} days left` : "passed"})`} strong /> : null}
          {l.eligibility.incomeLimits?.map((r) => <KV key={r.householdSize} k={`Max income · household of ${r.householdSize}`} v={`${formatUsd(r.maxAnnualIncomeCents)} / yr`} />)}
          {l.eligibility.minIncomeMultipleOfRent ? <KV k="Minimum income" v={`${l.eligibility.minIncomeMultipleOfRent}× monthly rent`} /> : null}
          {l.eligibility.notes ? <Text style={type.small}>{l.eligibility.notes}</Text> : null}
        </Section>

        <Section title="Where this came from">
          <KV k="Source" v={l.source.sourceName} />
          <KV k="Original listing URL" v={l.source.listingUrl ? hostOf(l.source.listingUrl) : "Not captured"} unknown={!l.source.listingUrl} />
          <KV k="Source listing ID" v={l.source.sourceListingId ?? "Not captured"} unknown={!l.source.sourceListingId} />
          <KV k="First seen" v={shortDate(l.source.capturedAt)} />
          <KV k="Price last checked" v={l.source.lastPriceCheckAt ? shortDate(l.source.lastPriceCheckAt) : "Never"} />
          <KV k="Last verified" v={l.verification.lastVerifiedAt ? shortDate(l.verification.lastVerifiedAt) : "Never"} strong />
          <KV k="Availability last confirmed" v={l.verification.availabilityConfirmedAt ? shortDate(l.verification.availabilityConfirmedAt) : "Never"} unknown={!l.verification.availabilityConfirmedAt} />
          {l.intake ? (
            <View style={{ gap: 4, paddingTop: 6 }}>
              <Text style={type.small}>
                Research intake · {l.intake.reviewStatus.replace(/_/g, " ")} · observed {shortDate(l.intake.observedAt)}
              </Text>
              <Text style={[type.tiny, { fontStyle: "italic" }]}>As recorded: “{l.intake.rawLabel}” — {l.intake.researchDoc}</Text>
            </View>
          ) : null}
          {l.source.searchPageUrls.length ? (
            <View style={{ gap: 6 }}>
              <Text style={type.small}>Search pages this lead was found on (the exact listing link was not recorded):</Text>
              {l.source.searchPageUrls.map((u) => (
                <Text key={u} style={styles.link} onPress={() => openExternal(u)} accessibilityRole="link">
                  {hostOf(u)}
                  {new URL(u).pathname} ↗
                </Text>
              ))}
            </View>
          ) : null}
        </Section>

        <Section title="Verification checklist">
          {VERIFICATION_CHECKS.map((c) => {
            const item = l.verification.checklist.find((x) => x.check === c);
            const ok = !!item?.passed && item.evidenceIds.length > 0;
            const official = l.verification.level === "OFFICIAL_PORTAL";
            return (
              <View key={c} style={styles.checkRow}>
                <Icon name={ok ? "checkmark-circle" : official ? "shield-outline" : "ellipse-outline"} size={18} tint={ok ? color.verified : official ? color.official : color.muted} />
                <Text style={[type.body, { flex: 1 }]}>{CHECK_LABEL[c]}</Text>
                <Text style={type.tiny}>{ok ? "Confirmed" : official ? "Official portal" : "Not checked"}</Text>
              </View>
            );
          })}
        </Section>

        <View style={styles.actions}>
          <Button
            label={l.isDemo ? "Contact (disabled for demo)" : unverified ? "Open original site ↗" : "Contact via official channel ↗"}
            icon="open-outline"
            onPress={contact}
            disabled={l.isDemo || hidden}
            accessibilityHint="Opens the source in your browser"
          />
          {canMessage(l) ? (
            <Button
              icon="chatbubbles-outline"
              label={l.isDemo ? "Message the manager (demo)" : "Message the manager"}
              testID="message-manager"
              onPress={async () => {
                try {
                  const id = await openThread(l);
                  router.push(`/conversation/${id}`);
                } catch (e) {
                  setMsgError((e as Error).message);
                }
              }}
            />
          ) : null}
          {msgError ? <Banner tone="warn" icon="person-circle-outline" title={msgError} /> : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button style={{ flex: 1 }} kind="secondary" icon={fav ? "heart" : "heart-outline"} label={fav ? "Saved" : "Save"} onPress={() => toggleFavorite(l.id)} />
            <Button style={{ flex: 1 }} kind="secondary" icon="git-compare-outline" label={inCompare ? "Comparing" : "Compare"} onPress={() => toggleCompare(l.id)} />
          </View>
          <Button
            kind="secondary"
            icon="document-text-outline"
            label={tracked ? "Tracking application ✓" : "Track application"}
            onPress={() => {
              track(l);
              router.push("/applications");
            }}
            disabled={hidden}
          />
          <Button kind="danger" icon="flag-outline" label="Report a problem" onPress={() => router.push(`/report/${encodeURIComponent(l.id)}`)} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  link: { fontSize: 13, color: color.official, fontWeight: "600", textDecorationLine: "underline" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  actions: { gap: space.sm },
});
