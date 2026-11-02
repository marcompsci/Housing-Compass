/**
 * Listing-detail panels added in v0.14: travel estimates + real directions, price history,
 * manager response metrics, and sharing.
 */
import {
  TRAVEL_MODES,
  directionsUrl,
  estimateTravel,
  formatResponseStats,
  formatUsd,
  historyFromRows,
  listingShareContent,
  priceTrend,
  responseStatsFromRow,
  type Listing,
  type PriceObservation,
  type ResponseStats,
  type TravelMode,
} from "@housing-compass/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Share, Text, View } from "react-native";
import { supabase } from "../data/supabase";
import { useT } from "../i18n";
import { shortDate } from "../lib/format";
import { openExternal } from "../lib/links";
import { usePriceHistory } from "../state/priceHistory";
import { useStore } from "../state/store";
import { color, type } from "../theme";
import { Button, Chip, KV, Section } from "./ui";

const MODE_KEY = { transit: "travel.transit", walk: "travel.walk", bike: "travel.bike", drive: "travel.drive" } as const;

export function TravelPanel({ listing: l }: { listing: Listing }) {
  const { t } = useT();
  const commuteTo = useStore((s) => s.filters.commuteTo);
  const approx = l.location.precision === "city_approx" || l.location.precision === "zip_approx";
  const [mode, setMode] = useState<TravelMode>("transit");
  return (
    <Section title={t("ld.gettingAround")}>
      {l.transit.nearestStops?.length ? (
        l.transit.nearestStops.map((s) => <KV key={s.name} k={s.name} v={t("ld.walkMin", { n: s.walkMinutes })} />)
      ) : (
        <KV k={t("ld.nearbyTransit")} v={t("common.notConfirmed")} unknown />
      )}
      {commuteTo ? (
        <View style={{ gap: 6 }} testID="travel-estimates">
          <Text style={type.h3}>{t("travel.toDestination")}</Text>
          {TRAVEL_MODES.map((m) => {
            const e = estimateTravel(commuteTo, l.location, m, { approximateEndpoint: approx });
            return <KV key={m} k={t(MODE_KEY[m])} v={t("travel.range", { min: e.minMinutes, max: e.maxMinutes })} />;
          })}
          <Text style={type.tiny}>{approx ? t("travel.approxNote") : t("travel.note")}</Text>
          <Text style={type.small}>{t("travel.directionsBy")}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {TRAVEL_MODES.map((m) => (
              <Chip key={m} label={t(MODE_KEY[m])} selected={m === mode} onPress={() => setMode(m)} />
            ))}
          </View>
          <Button
            kind="secondary"
            icon="navigate-outline"
            label={Platform.OS === "ios" ? t("travel.openApple") : t("travel.openGoogle")}
            onPress={() => openExternal(directionsUrl(Platform.OS === "ios" ? "apple" : "google", commuteTo, l.location, mode))}
            accessibilityHint={t("travel.directionsHint")}
          />
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={type.small}>{t("travel.setDestination")}</Text>
          <Button kind="ghost" icon="briefcase-outline" label={t("travel.addDestination")} onPress={() => router.push("/filters")} />
        </View>
      )}
    </Section>
  );
}

export function PriceHistoryPanel({ listing: l }: { listing: Listing }) {
  const { t } = useT();
  const local = usePriceHistory((s) => s.history[l.id]);
  const saved = useStore((s) => s.favorites.includes(l.id));
  const [server, setServer] = useState<PriceObservation[] | null>(null);
  useEffect(() => {
    if (!supabase || l.isDemo) return;
    let alive = true;
    void supabase
      .from("price_history")
      .select("new_cents,observed_at")
      .eq("listing_id", l.id)
      .order("observed_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (alive && data) setServer(historyFromRows(l.id, l.pricing.basis, data as Array<{ new_cents: number; observed_at: string }>));
      });
    return () => {
      alive = false;
    };
  }, [l.id, l.isDemo, l.pricing.basis]);
  const obs = server && server.length ? server : (local ?? []);
  const trend = priceTrend(obs);
  return (
    <Section title={t("price.title")}>
      {l.isDemo ? <Text style={type.small}>{t("price.demo")}</Text> : null}
      {!l.isDemo && (!trend || trend.points < 2) ? <Text style={type.small}>{saved || server ? t("price.noChanges") : t("price.saveToTrack")}</Text> : null}
      {trend && trend.points >= 2 ? (
        <View style={{ gap: 4 }} testID="price-history">
          <Text style={[type.h3, { color: trend.direction === "down" ? color.verified : trend.direction === "up" ? color.warn : color.ink }]}>
            {trend.direction === "down" ? t("price.down", { amount: formatUsd(-trend.changeCents) }) : trend.direction === "up" ? t("price.up", { amount: formatUsd(trend.changeCents) }) : t("price.flat")}
          </Text>
          {obs.slice(-6).map((o) => (
            <KV key={o.at + o.cents} k={shortDate(o.at)} v={formatUsd(o.cents)} />
          ))}
        </View>
      ) : null}
      <Text style={type.tiny}>{t("price.note")}</Text>
    </Section>
  );
}

const DEMO_STATS: ResponseStats = { managerId: "demo-manager", conversations: 12, replyRatePct: 92, medianReplyHours: 5.2 };

export function ResponseMetrics({ listing: l }: { listing: Listing }) {
  const { t } = useT();
  const [stats, setStats] = useState<ResponseStats | null>(l.isDemo && l.managerId === "demo-manager" ? DEMO_STATS : null);
  useEffect(() => {
    if (!supabase || !l.managerId || l.isDemo) return;
    let alive = true;
    void supabase
      .from("manager_response_stats")
      .select("manager_id,conversations,reply_rate_pct,median_reply_hours")
      .eq("manager_id", l.managerId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setStats(responseStatsFromRow(data as never));
      });
    return () => {
      alive = false;
    };
  }, [l.managerId, l.isDemo]);
  if (!l.managerId) return null;
  const f = formatResponseStats(stats);
  return (
    <View style={{ gap: 2 }} testID="response-metrics">
      <Text style={[type.small, { fontWeight: "700", color: color.ink }]}>
        {t("resp.title")}: {f.headline}
        {l.isDemo && f.show ? ` (${t("resp.demo")})` : ""}
      </Text>
      <Text style={type.tiny}>{f.detail}</Text>
    </View>
  );
}

export function ShareListingButton({ listing: l }: { listing: Listing }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <Button
      kind="secondary"
      icon="share-outline"
      label={done ? t("share.shared") : t("share.button")}
      testID="share-listing"
      onPress={async () => {
        const c = listingShareContent(l, { webBaseUrl: Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : null });
        try {
          if (Platform.OS === "web") {
            const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
            if (nav?.share) await nav.share({ title: c.title, text: c.message });
            else await nav?.clipboard?.writeText(c.message);
          } else {
            await Share.share({ title: c.title, message: c.message });
          }
          setDone(true);
        } catch {
          /* user dismissed the share sheet */
        }
      }}
    />
  );
}

export { shortDate };
