import {
  VERIFICATION_CHECKS,
  budgetStatus,
  categorize,
  feeChecks,
  formatRent,
  formatUsd,
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
import { PriceHistoryPanel, ResponseMetrics, ShareListingButton, TravelPanel } from "../../components/ListingExtras";
import { Banner, Button, Icon, KV, Section, Tag } from "../../components/ui";
import { now } from "../../config";
import { useListing } from "../../data/hooks";
import { useT, type TFn } from "../../i18n";
import { addressText, daysUntil, shortDate } from "../../lib/format";
import { hostOf, openExternal } from "../../lib/links";
import { useStore } from "../../state/store";
import { useApplications } from "../../state/applications";
import { canMessage, useConversations } from "../../state/conversations";
import { color, space, type } from "../../theme";

const PETS = { allowed: "pets.allowed", cats_only: "pets.cats", dogs_only: "pets.dogs", not_allowed: "pets.none" } as const;
const PROGRAM = { lottery: "program.lottery", waitlist: "program.waitlist", first_come_first_served: "program.fcfs", market: "program.market" } as const;
const CHECK = {
  authorization_to_rent: "check.authorization_to_rent",
  address: "check.address",
  unit_availability: "check.unit_availability",
  rent: "check.rent",
  contact_channel: "check.contact_channel",
  fees: "check.fees",
} as const;

function homeType(l: Listing, t: TFn): string {
  if (l.unit.isEntireUnit) return l.unit.unitType === "studio" ? t("home.entireStudio") : t("home.entireBr", { n: l.unit.bedrooms ?? "?" });
  return l.unit.unitType === "bed_in_shared_room" ? t("home.bed") : t("home.room");
}

export default function ListingDetail() {
  const { t, d, locale } = useT();
  const NC = t("common.notConfirmed");
  const yesNo = (b: boolean | null) => (b === null ? NC : b ? t("common.yes") : t("common.no"));
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listing: l, loading } = useListing(decodeURIComponent(String(id)));
  const fav = useStore((s) => (l ? s.favorites.includes(l.id) : false));
  const inCompare = useStore((s) => (l ? s.compare.includes(l.id) : false));
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const budget = useStore((s) => s.filters.budget);
  const track = useApplications((s) => s.track);
  const openThread = useConversations((s) => s.open);
  const [msgError, setMsgError] = useState("");
  const tracked = useApplications((s) => (l ? s.items.some((a) => a.listingId === l.id) : false));

  if (!l && loading) {
    return (
      <View style={{ padding: space.xl }}>
        <Text style={type.small}>{t("common.loading")}</Text>
      </View>
    );
  }
  if (!l) {
    return (
      <View style={{ padding: space.xl }}>
        <Text style={type.h2}>{t("ld.notFound")}</Text>
        <Text style={type.small}>{t("ld.notFoundBody")}</Text>
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
  const perMonth = t("common.perMonth");
  const rent = formatRent(l, d.basisSuffix);

  const contact = () => {
    if (l.isDemo) return;
    const url = l.source.listingUrl ?? l.source.searchPageUrls[0];
    if (url) openExternal(url);
  };

  return (
    <>
      <Stack.Screen options={{ title: l.isDemo ? t("ld.demoTitle") : t("ld.title") }} />
      <ScrollView contentContainerStyle={styles.wrap}>
        {l.isDemo ? (
          <Banner tone="demo" icon="flask-outline" title={t("ld.demoBannerTitle")}>
            {t("ld.demoBannerBody")}
          </Banner>
        ) : null}
        {hidden ? (
          <Banner tone="danger" icon="eye-off-outline" title={t("ld.hiddenTitle")}>
            {l.verification.level === "FLAGGED" ? t("ld.hiddenFlagged") : t("ld.hiddenOld")}
          </Banner>
        ) : null}

        <View style={{ gap: 6 }}>
          {l.isDemo ? <DemoTag /> : null}
          <Text style={type.title}>{l.title}</Text>
          <Text style={type.small}>{addressText(l)}</Text>
          {l.location.precision === "city_approx" ? <Text style={type.tiny}>{t("ld.cityApprox")}</Text> : null}
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {cat ? <Tag label={d.category[cat]} /> : null}
            {b === "over_preferred" ? <Tag label={t("ld.abovePref", { amount: formatUsd(budget.unitPreferredMaxCents) })} tone="warn" /> : null}
            {!l.unit.unitTypeConfirmed ? <Tag label={t("ld.unitTypeUnconfirmed")} tone="warn" /> : null}
          </View>
          <ResponseMetrics listing={l} />
        </View>

        <TrustPanel listing={l} />

        {unverified ? (
          <Banner tone="warn" icon="warning-outline" title={t("ld.beforeContactTitle")}>
            {t("ld.beforeContactBody")}
          </Banner>
        ) : null}
        {unverified ? <Button kind="secondary" icon="chatbubble-ellipses-outline" label={t("ld.checkReply")} onPress={() => router.push("/check-message")} /> : null}

        <Section title={t("ld.costs")}>
          <View style={{ gap: 2 }}>
            <Text style={type.price}>{rent}</Text>
            <Text style={type.small}>
              {t("ld.rentBasis")} <Text style={{ fontWeight: "800" }}>{d.basis[l.pricing.basis]}</Text>
              {l.pricing.basisConfirmed ? "" : ` — ${t("ld.basisUnconfirmed")}`}
              {l.pricing.qualifier === "STARTING_AT" ? ` · ${t("ld.startingPrice")}` : ""}
            </Text>
          </View>
          <KV k={t("ld.baseRent")} v={rent} />
          {l.pricing.recurringFees === null ? (
            <KV k={t("ld.recurringFees")} v={NC} unknown />
          ) : l.pricing.recurringFees.length === 0 ? (
            <KV k={t("ld.recurringFees")} v={t("common.none")} />
          ) : (
            l.pricing.recurringFees.map((f) => <KV key={f.label} k={f.label} v={`${formatUsd(f.amountCents)} ${perMonth}`} />)
          )}
          <KV k={t("ld.utilities")} v={yesNo(l.pricing.utilitiesIncluded)} unknown={l.pricing.utilitiesIncluded === null} />
          <KV k={t("ld.totalMonthly")} v={total.amountCents === null ? NC : locale === "en" ? total.label : `${formatUsd(total.amountCents)} ${perMonth}${total.complete ? "" : ` (${t("ld.someUnconfirmed")})`}`} strong unknown={total.amountCents === null} />
          <KV k={t("ld.deposit")} v={l.pricing.depositCents === null ? NC : formatUsd(l.pricing.depositCents)} unknown={l.pricing.depositCents === null} />
          {l.pricing.moveInCosts?.map((c) => <KV key={c.label} k={c.label} v={formatUsd(c.amountCents)} />)}
          <KV k={t("ld.appFee")} v={l.pricing.applicationFeeCents === null ? NC : formatUsd(l.pricing.applicationFeeCents)} unknown={l.pricing.applicationFeeCents === null} />
          <KV k={t("ld.dueAtMoveIn")} v={movein.amountCents === null ? NC : formatUsd(movein.amountCents)} strong unknown={movein.amountCents === null} />
          {feeChecks(l).map((c) => (
            <Banner key={c.code} tone={c.severity === "warn" ? "warn" : "info"} icon="scale-outline" title={c.message} action={<Button kind="ghost" label={t("rights.learn")} onPress={() => router.push(`/rights?topic=${c.topicId}`)} />} />
          ))}
          <Text style={type.tiny}>{t("ld.feeAdvice")}</Text>
          {l.pricing.concessions ? <KV k={t("ld.concessions")} v={l.pricing.concessions} /> : null}
          {priceMayBeOutdated(l, now()) ? <Text style={type.tiny}>{t("ld.priceOld", { date: l.source.lastPriceCheckAt ? shortDate(l.source.lastPriceCheckAt) : t("common.never") })}</Text> : null}
          {movein.amountCents !== null ? <Button kind="ghost" icon="wallet-outline" label={t("savings.planFor")} onPress={() => router.push(`/affordability?listing=${encodeURIComponent(l.id)}`)} /> : null}
        </Section>

        <PriceHistoryPanel listing={l} />

        <AffordabilityPanel listing={l} />

        <Section title={t("ld.home")}>
          <KV k={t("ld.type")} v={homeType(l, t)} />
          {l.unit.householdBedrooms ? <KV k={t("ld.householdBedrooms")} v={String(l.unit.householdBedrooms)} /> : null}
          <KV k={t("ld.bathrooms")} v={l.unit.bathrooms === null ? NC : String(l.unit.bathrooms)} unknown={l.unit.bathrooms === null} />
          <KV k={t("ld.size")} v={l.unit.sqft ? `${l.unit.sqft} sq ft` : NC} unknown={!l.unit.sqft} />
          <KV k={t("ld.furnished")} v={yesNo(l.amenities.furnished)} unknown={l.amenities.furnished === null} />
          <KV k={t("ld.pets")} v={l.amenities.pets ? t(PETS[l.amenities.pets]) : NC} unknown={!l.amenities.pets} />
          <KV k={t("ld.vouchers")} v={l.amenities.acceptsVouchers === null ? NC : l.amenities.acceptsVouchers ? t("ld.vouchersYes") : t("ld.notStated")} unknown={l.amenities.acceptsVouchers === null} />
          <KV k={t("ld.accessibility")} v={l.amenities.accessibility === null ? NC : l.amenities.accessibility.length ? l.amenities.accessibility.map((a) => a.replace(/_/g, " ")).join(", ") : t("ld.noneListed")} unknown={l.amenities.accessibility === null} />
          <KV k={t("ld.minLease")} v={l.lease.minTermMonths ? t("ld.months", { n: l.lease.minTermMonths }) : NC} unknown={!l.lease.minTermMonths} />
          <KV k={t("ld.moveInDate")} v={l.lease.moveInDate ? shortDate(l.lease.moveInDate) : NC} unknown={!l.lease.moveInDate} />
        </Section>

        <TravelPanel listing={l} />

        <Section title={t("ld.eligibility")}>
          <KV k={t("ld.incomeRestricted")} v={l.eligibility.incomeRestricted ? t("common.yes") : t("ld.noOrNotStated")} />
          {l.eligibility.amiPercent ? <KV k={t("ld.ami")} v={`${l.eligibility.amiPercent}% AMI`} /> : null}
          {l.eligibility.programType ? <KV k={t("ld.howYouGetIt")} v={t(PROGRAM[l.eligibility.programType])} /> : null}
          {deadline ? <KV k={t("ld.deadline")} v={`${shortDate(deadline)} (${daysUntil(deadline) >= 0 ? t("ld.daysLeft", { n: daysUntil(deadline) }) : t("ld.passed")})`} strong /> : null}
          {l.eligibility.incomeLimits?.map((r) => <KV key={r.householdSize} k={t("ld.maxIncome", { n: r.householdSize })} v={`${formatUsd(r.maxAnnualIncomeCents)} ${t("common.perYear")}`} />)}
          {l.eligibility.minIncomeMultipleOfRent ? <KV k={t("ld.minIncome")} v={t("ld.timesRent", { n: l.eligibility.minIncomeMultipleOfRent })} /> : null}
          {l.eligibility.notes ? <Text style={type.small}>{l.eligibility.notes}</Text> : null}
        </Section>

        <Section title={t("ld.source")}>
          <KV k={t("ld.sourceName")} v={l.source.sourceName} />
          <KV k={t("ld.originalUrl")} v={l.source.listingUrl ? hostOf(l.source.listingUrl) : t("ld.notCaptured")} unknown={!l.source.listingUrl} />
          <KV k={t("ld.sourceId")} v={l.source.sourceListingId ?? t("ld.notCaptured")} unknown={!l.source.sourceListingId} />
          <KV k={t("ld.firstSeen")} v={shortDate(l.source.capturedAt)} />
          <KV k={t("ld.priceChecked")} v={l.source.lastPriceCheckAt ? shortDate(l.source.lastPriceCheckAt) : t("common.never")} />
          <KV k={t("ld.lastVerified")} v={l.verification.lastVerifiedAt ? shortDate(l.verification.lastVerifiedAt) : t("common.never")} strong />
          <KV k={t("ld.availabilityConfirmed")} v={l.verification.availabilityConfirmedAt ? shortDate(l.verification.availabilityConfirmedAt) : t("common.never")} unknown={!l.verification.availabilityConfirmedAt} />
          {l.intake ? (
            <View style={{ gap: 4, paddingTop: 6 }}>
              <Text style={type.small}>{t("ld.intake", { status: l.intake.reviewStatus.replace(/_/g, " "), date: shortDate(l.intake.observedAt) })}</Text>
              <Text style={[type.tiny, { fontStyle: "italic" }]}>
                {t("ld.asRecorded")} “{l.intake.rawLabel}” — {l.intake.researchDoc}
              </Text>
            </View>
          ) : null}
          {l.source.searchPageUrls.length ? (
            <View style={{ gap: 6 }}>
              <Text style={type.small}>{t("ld.searchPages")}</Text>
              {l.source.searchPageUrls.map((u) => (
                <Text key={u} style={styles.link} onPress={() => openExternal(u)} accessibilityRole="link">
                  {hostOf(u)}
                  {new URL(u).pathname} ↗
                </Text>
              ))}
            </View>
          ) : null}
        </Section>

        <Section title={t("ld.checklist")}>
          {VERIFICATION_CHECKS.map((c) => {
            const item = l.verification.checklist.find((x) => x.check === c);
            const ok = !!item?.passed && item.evidenceIds.length > 0;
            const official = l.verification.level === "OFFICIAL_PORTAL";
            return (
              <View key={c} style={styles.checkRow}>
                <Icon name={ok ? "checkmark-circle" : official ? "shield-outline" : "ellipse-outline"} size={18} tint={ok ? color.verified : official ? color.official : color.muted} />
                <Text style={[type.body, { flex: 1 }]}>{t(CHECK[c])}</Text>
                <Text style={type.tiny}>{ok ? t("ld.confirmed") : official ? t("ld.officialPortal") : t("ld.notChecked")}</Text>
              </View>
            );
          })}
        </Section>

        <View style={styles.actions}>
          <Button
            label={l.isDemo ? t("ld.contactDemo") : unverified ? t("ld.openOriginal") : t("ld.contactOfficial")}
            icon="open-outline"
            onPress={contact}
            disabled={l.isDemo || hidden}
            accessibilityHint={t("ld.opensBrowser")}
          />
          {canMessage(l) ? (
            <Button
              icon="chatbubbles-outline"
              label={l.isDemo ? t("ld.messageDemo") : t("ld.message")}
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
            <Button style={{ flex: 1 }} kind="secondary" icon={fav ? "heart" : "heart-outline"} label={fav ? t("ld.saved") : t("ld.save")} onPress={() => toggleFavorite(l.id)} />
            <Button style={{ flex: 1 }} kind="secondary" icon="git-compare-outline" label={inCompare ? t("card.comparing") : t("card.compare")} onPress={() => toggleCompare(l.id)} />
          </View>
          <ShareListingButton listing={l} />
          <Button
            kind="secondary"
            icon="document-text-outline"
            label={tracked ? t("ld.tracking") : t("ld.track")}
            onPress={() => {
              track(l);
              router.push("/applications");
            }}
            disabled={hidden}
          />
          <Button kind="danger" icon="flag-outline" label={t("ld.report")} onPress={() => router.push(`/report/${encodeURIComponent(l.id)}`)} />
          {locale !== "en" ? <Text style={[type.tiny, { textAlign: "center" }]}>{t("common.translationNote")}</Text> : null}
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
