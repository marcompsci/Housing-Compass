import { AREA_PROBLEM_TEXT, CATEGORIES, validateArea, validateAreaName, type LatLng, type SearchHit } from "@housing-compass/core";
import { useT } from "../../i18n";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrefs } from "../../state/prefs";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinkOutPanel } from "../../components/LinkOutPanel";
import { ListingCard } from "../../components/ListingCard";
import { Banner, Chip, Icon } from "../../components/ui";
import { config } from "../../config";
import { useSearch } from "../../data/hooks";
import { useInbox } from "../../alerts/inbox";
import ListingsMap from "../../map/ListingsMap";
import { useStore } from "../../state/store";
import { useRenter } from "../../state/renter";
import { HIT, color, radius, space, type } from "../../theme";

function activeFilterCount(f: ReturnType<typeof useStore.getState>["filters"]): number {
  return [f.petsRequired, f.furnished !== "any", f.accessibilityRequired, f.utilitiesIncludedRequired, f.parkingRequired, f.vouchersRequired, f.maxTransitWalkMinutes !== null, f.maxMinLeaseMonths !== null, f.moveInBy !== null, f.radiusKm !== null, f.commuteTo !== null, !!f.area].filter(Boolean).length;
}

export default function Explore() {
  const { t, d } = useT();
  const filters = useStore((s) => s.filters);
  const area = useStore((s) => s.area);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setCategory = useStore((s) => s.setCategory);
  const patchFilters = useStore((s) => s.patchFilters);
  const acknowledged = useStore((s) => s.unverifiedWarningAcknowledged);
  const [cityFocus, setCityFocus] = useState<string | null>(null);
  const onboarded = usePrefs((s) => s.onboarded);
  const [prefsReady, setPrefsReady] = useState(usePrefs.persist.hasHydrated());
  useEffect(() => usePrefs.persist.onFinishHydration(() => setPrefsReady(true)), []);
  useEffect(() => {
    if (!prefsReady || onboarded) return;
    const id = setTimeout(() => router.push("/welcome"), 0);
    return () => clearTimeout(id);
  }, [prefsReady, onboarded]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [queryText, setQueryText] = useState(filters.query ?? "");
  useEffect(() => {
    const id = setTimeout(() => {
      const q = queryText.trim() || null;
      if (q !== (useStore.getState().filters.query ?? null)) patchFilters({ query: q });
    }, 250);
    return () => clearTimeout(id);
  }, [queryText, patchFilters]);
  const recentSearches = useRenter((s) => s.recentSearches);
  const rememberSearch = useRenter((s) => s.rememberSearch);
  const clearRecent = useRenter((s) => s.clearRecentSearches);
  const savedAreas = useStore((s) => s.savedAreas);
  const saveArea = useStore((s) => s.saveArea);
  const deleteArea = useStore((s) => s.deleteArea);
  const [areaName, setAreaName] = useState("");
  const [naming, setNaming] = useState(false);
  const areaNameProblem = naming ? validateAreaName(areaName, savedAreas.map((a) => a.name)) : null;
  const currentAreaSaved = !!filters.area && savedAreas.some((a) => JSON.stringify(a.points) === JSON.stringify(filters.area));
  const [draft, setDraft] = useState<LatLng[]>([]);
  const draftProblem = draft.length ? validateArea(draft) : null;
  const onMapPress = useCallback((p: LatLng) => setDraft((d) => (d.length >= 20 ? d : [...d, p])), []);
  const startDrawing = () => {
    setSelectedId(null);
    setDraft([]);
    setDrawing(true);
  };
  const applyDraft = () => {
    if (validateArea(draft)) return;
    patchFilters({ area: draft });
    setDrawing(false);
  };

  const { result, loading, error, expiredLeads, offlineSince } = useSearch(filters);
  const hits = useMemo(() => (cityFocus ? result.hits.filter((h) => h.listing.address.city === cityFocus) : result.hits), [result, cityFocus]);
  const selected = selectedId ? hits.find((h) => h.listing.id === selectedId) : undefined;

  const onSelectArea = useCallback((city: string) => {
    setCityFocus(city);
    setView("list");
  }, [setView]);
  const onSelectListing = useCallback((id: string) => setSelectedId(id), []);

  const showUnverified = () => (acknowledged ? patchFilters({ includeUnverified: true }) : router.push("/unverified"));
  const nFilters = activeFilterCount(filters);
  const inbox = useInbox();
  const readKeys = useStore((s) => s.readNotifications);
  const unread = inbox.items.filter((n) => !readKeys.includes(n.key)).length;
  const linkCity = cityFocus ?? (area.source === "default" || area.source === "region" ? (area.region === "bay_area" || !area.region ? "Bay Area" : "Los Angeles") : area.label.split(",")[0]!.replace(/^Near /, ""));
  const firstUnverifiedId = hits.find((h) => h.listing.verification.level === "SOURCE_LISTED_UNVERIFIED")?.listing.id;

  const header = (
    <View style={{ gap: space.md }}>
      {config.demoMode ? (
        <Banner tone="demo" icon="flask-outline" title={t("explore.demoTitle")}>
          {t("explore.demoBody")}
        </Banner>
      ) : null}
      {filters.includeUnverified ? (
        <Banner
          tone="warn"
          icon="warning-outline"
          title={t("explore.unverifiedShowing")}
          action={
            <Pressable onPress={() => patchFilters({ includeUnverified: false })} accessibilityRole="button" style={styles.inlineBtn}>
              <Text style={styles.inlineBtnText}>{t("explore.hideUnverified")}</Text>
            </Pressable>
          }
        >
          {t("explore.unverifiedBody")}
        </Banner>
      ) : result.hiddenUnverifiedCount > 0 ? (
        <Banner
          tone="info"
          icon="shield-checkmark-outline"
          title={t("explore.verifiedOnly")}
          action={
            <Pressable onPress={showUnverified} accessibilityRole="button" style={styles.inlineBtn} testID="show-unverified">
              <Text style={styles.inlineBtnText}>
                {t("explore.showUnverified", { n: result.hiddenUnverifiedCount })}
              </Text>
            </Pressable>
          }
        />
      ) : null}
      {error ? <Banner tone="danger" icon="cloud-offline-outline" title={error} /> : null}
      {offlineSince ? (
        <Banner tone="warn" icon="cloud-offline-outline" title="You're offline — showing saved results">
          Last updated {new Date(offlineSince).toLocaleString()}. Expired listings are still hidden. Check again before contacting anyone.
        </Banner>
      ) : null}
      {expiredLeads > 0 ? (
        <Text style={type.tiny}>{expiredLeads} research leads expired because nobody rechecked them within 14 days; they stay hidden until re-verified.</Text>
      ) : null}
      {area.region == null ? (
        <Banner tone="info" icon="globe-outline" title={`No checked listings near ${area.label} yet`}>
          Housing Compass covers the Bay Area and Los Angeles so far. Use the official and external links below for this area.
        </Banner>
      ) : null}
      <Text style={type.small}>{d.categoryHelp[filters.category]}</Text>
      {filters.area ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Chip icon="shapes-outline" label={`${savedAreas.find((a) => JSON.stringify(a.points) === JSON.stringify(filters.area))?.name ?? t("area.drawn")}  ✕`} selected onPress={() => patchFilters({ area: null })} accessibilityHint="Removes the drawn search area" />
          {!currentAreaSaved && !naming ? <Chip icon="bookmark-outline" label={t("area.save")} onPress={() => setNaming(true)} /> : null}
          {result.hiddenApproximateCount ? <Text style={[type.tiny, { alignSelf: "center", flexShrink: 1 }]}>{t("area.approxHidden", { n: result.hiddenApproximateCount })}</Text> : null}
        </View>
      ) : null}
      {naming && filters.area ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={areaName} onChangeText={setAreaName} placeholder={t("area.namePh")} style={styles.search} accessibilityLabel={t("area.namePh")} maxLength={40} testID="area-name" />
            <Chip
              label={t("area.saveConfirm")}
              selected={!areaNameProblem}
              onPress={() => {
                if (areaNameProblem || !filters.area) return;
                saveArea(areaName, filters.area);
                setNaming(false);
                setAreaName("");
              }}
            />
          </View>
          {areaName && areaNameProblem ? <Text style={type.tiny}>{areaNameProblem}</Text> : null}
        </View>
      ) : null}
      {cityFocus ? (
        <View style={{ flexDirection: "row" }}>
          <Chip label={`Only ${cityFocus}  ✕`} selected onPress={() => setCityFocus(null)} accessibilityHint="Clears the city filter" />
        </View>
      ) : null}
      <Text style={[type.small, { fontWeight: "700", color: color.ink }]} accessibilityLiveRegion="polite">
        {t("explore.count", { n: hits.length })}
        {result.hiddenOverBudgetCount ? ` · ${result.hiddenOverBudgetCount} outside your budget hidden` : ""}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.top}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => router.push("/location")} style={styles.locBtn} accessibilityRole="button" accessibilityLabel={`Search area: ${area.label}. Change`}>
            <Icon name="location" size={18} tint={color.brand} />
            <View style={{ flex: 1 }}>
              <Text style={type.tiny}>{t("explore.searchingNear")}</Text>
              <Text style={[type.h3, { fontSize: 15 }]} numberOfLines={1}>
                {area.label}
              </Text>
            </View>
            <Icon name="chevron-down" size={16} tint={color.sub} />
          </Pressable>
          <Pressable onPress={() => router.push("/inbox")} style={styles.filterBtn} accessibilityRole="button" accessibilityLabel={`Alerts${unread ? `, ${unread} unread` : ""}`}>
            <Icon name="notifications-outline" size={20} tint={color.ink} />
            {unread ? (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{unread}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={() => router.push("/filters")} style={styles.filterBtn} accessibilityRole="button" accessibilityLabel={`Filters and budget${nFilters ? `, ${nFilters} active` : ""}`}>
            <Icon name="options-outline" size={20} tint={color.ink} />
            {nFilters ? (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{nFilters}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} accessibilityRole="tablist">
          {CATEGORIES.map((c) => (
            <Chip key={c} label={d.category[c]} selected={filters.category === c} onPress={() => { setCategory(c); setSelectedId(null); }} />
          ))}
        </ScrollView>
        <View style={styles.searchRow}>
          <Icon name="search" size={18} tint={color.sub} />
          <TextInput
            value={queryText}
            onChangeText={setQueryText}
            placeholder={t("search.placeholder")}
            style={styles.searchInput}
            accessibilityLabel={t("search.placeholder")}
            returnKeyType="search"
            autoCorrect={false}
            onBlur={() => {
              rememberSearch(queryText);
            }}
            onSubmitEditing={() => rememberSearch(queryText)}
            testID="search-input"
          />
          {queryText ? (
            <Pressable onPress={() => setQueryText("")} accessibilityRole="button" accessibilityLabel={t("search.clear")} hitSlop={10}>
              <Icon name="close-circle" size={18} tint={color.muted} />
            </Pressable>
          ) : null}
        </View>
        {!queryText && recentSearches.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, alignItems: "center" }} testID="recent-searches" accessibilityLabel={t("recent.label")}>
            <Icon name="time-outline" size={16} tint={color.muted} />
            {recentSearches.map((q) => (
              <Chip key={q} label={q} onPress={() => setQueryText(q)} accessibilityHint={t("recent.hint")} />
            ))}
            <Pressable onPress={clearRecent} accessibilityRole="button" hitSlop={8} style={{ minHeight: HIT, justifyContent: "center" }}>
              <Text style={[type.tiny, { textDecorationLine: "underline" }]}>{t("recent.clear")}</Text>
            </Pressable>
          </ScrollView>
        ) : null}
        <View style={styles.segment} accessibilityRole="tablist">
          {(["list", "map"] as const).map((v) => (
            <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }} style={[styles.segBtn, view === v && styles.segOn]}>
              <Icon name={v === "list" ? "list" : "map-outline"} size={16} tint={view === v ? "#fff" : color.ink} />
              <Text style={[styles.segText, view === v && { color: "#fff" }]}>{v === "list" ? t("explore.list") : t("explore.map")}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {view === "list" ? (
        <FlatList<SearchHit>
          data={hits}
          keyExtractor={(h) => h.listing.id}
          renderItem={({ item }) =>
            item.listing.id === firstUnverifiedId ? (
              <View style={{ gap: space.md }}>
                <View style={styles.sectionHead} accessibilityRole="header" testID="unverified-section">
                  <Icon name="warning-outline" size={18} tint={color.warn} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.h3, { color: color.warn }]}>Unverified research leads</Text>
                    <Text style={type.tiny}>Seen on other websites. Not checked by anyone. Never pay before a tour.</Text>
                  </View>
                </View>
                <ListingCard hit={item} />
              </View>
            ) : (
              <ListingCard hit={item} />
            )
          }
          ListHeaderComponent={header}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={color.brand} />
                <Text style={type.small}>Loading homes…</Text>
              </View>
            ) : (
            <View style={styles.empty}>
              <Icon name="home-outline" size={28} tint={color.muted} />
              <Text style={[type.h3, { textAlign: "center" }]}>{t("explore.emptyTitle")}</Text>
              <Text style={[type.small, { textAlign: "center" }]}>
                {t("explore.emptyBody")}
              </Text>
            </View>
            )
          }
          ListFooterComponent={<LinkOutPanel region={area.region ?? null} city={linkCity} category={filters.category} maxRentDollars={Math.round((filters.category === "ENTIRE_1BR" || filters.category === "STUDIO" ? filters.budget.unitHardMaxCents : filters.budget.roomMaxCents) / 100)} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <ListingsMap
            hits={hits}
            center={area.center}
            selectedId={selectedId}
            onSelectListing={onSelectListing}
            onSelectArea={onSelectArea}
            drawing={drawing}
            areaPoints={drawing ? draft : (filters.area ?? [])}
            onMapPress={onMapPress}
          />
          <View style={styles.drawBar} pointerEvents="box-none">
            {drawing ? (
              <View style={styles.drawPanel} testID="draw-panel">
                <Text style={[type.small, { color: color.ink, fontWeight: "700" }]} accessibilityLiveRegion="polite">
                  {draft.length < 3 ? t("area.tapHint", { n: draft.length }) : draftProblem ? AREA_PROBLEM_TEXT[draftProblem] : t("area.ready", { n: draft.length })}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Chip icon="arrow-undo-outline" label={t("area.undo")} onPress={() => setDraft((d) => d.slice(0, -1))} />
                  <Chip label={t("area.cancel")} onPress={() => setDrawing(false)} />
                  <Chip icon="search" label={t("area.search")} selected={!draftProblem && draft.length >= 3} onPress={applyDraft} accessibilityHint="Shows only homes inside the outline" />
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 8, alignSelf: "flex-start" }}>
                  <Chip icon="pencil-outline" label={filters.area ? t("area.redraw") : t("area.draw")} onPress={startDrawing} />
                  {filters.area ? <Chip label={t("area.clear")} onPress={() => patchFilters({ area: null })} /> : null}
                </View>
                {savedAreas.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {savedAreas.map((a) => (
                      <Chip
                        key={a.id}
                        icon="bookmark"
                        label={a.name}
                        selected={JSON.stringify(a.points) === JSON.stringify(filters.area)}
                        onPress={() => patchFilters({ area: a.points })}
                        accessibilityHint={t("area.useSaved")}
                      />
                    ))}
                    {filters.area && currentAreaSaved ? (
                      <Chip icon="trash-outline" label={t("area.deleteSaved")} onPress={() => { const a = savedAreas.find((x) => JSON.stringify(x.points) === JSON.stringify(filters.area)); if (a) deleteArea(a.id); }} />
                    ) : null}
                  </ScrollView>
                ) : null}
              </View>
            )}
          </View>
          <View style={styles.mapOverlay} pointerEvents="box-none">
            {config.demoMode ? (
              <View style={styles.mapLegend}>
                <Legend c={color.official} label="Official" />
                <Legend c={color.verified} label="Verified" />
                <Legend c={color.warnLine} label="Unverified" dashed />
                <Legend c={color.demo} label="Demo" />
              </View>
            ) : null}
            {drawing ? null : selected ? (
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => setSelectedId(null)} style={styles.closeSel} accessibilityRole="button" accessibilityLabel="Close preview">
                  <Icon name="close" size={18} />
                </Pressable>
                <ListingCard hit={selected} compact />
              </View>
            ) : (
              <Text style={styles.mapHint}>
                {hits.length} homes · tap a price pin, or a dashed area to list its approximate-location leads
              </Text>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function Legend({ c, label, dashed }: { c: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dashed ? color.warnSoft : c, borderWidth: 2, borderColor: c, borderStyle: dashed ? "dashed" : "solid" }} />
      <Text style={type.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.md, backgroundColor: color.bg, borderBottomWidth: 1, borderBottomColor: color.line },
  locBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: HIT + 6, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  filterBtn: { width: HIT + 6, height: HIT + 6, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  dotText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  segment: { flexDirection: "row", backgroundColor: color.neutralSoft, borderRadius: radius.md, padding: 3 },
  segBtn: { flex: 1, minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.sm },
  segOn: { backgroundColor: color.ink },
  segText: { fontSize: 14, fontWeight: "700", color: color.ink },
  list: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  empty: { alignItems: "center", gap: 8, padding: space.xl, marginVertical: space.md, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line },
  inlineBtn: { marginTop: 6, alignSelf: "flex-start", minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  inlineBtnText: { fontSize: 13, fontWeight: "700", color: color.ink },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: HIT, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  searchInput: { flex: 1, minHeight: HIT, fontSize: 15, color: color.ink, outlineWidth: 0 },
  search: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 15, color: color.ink, backgroundColor: color.surface },
  drawBar: { position: "absolute", left: space.md, right: space.md, top: space.md + 28, gap: 8 },
  drawPanel: { gap: 8, padding: space.md, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.97)", borderWidth: 1, borderColor: color.brand },
  mapOverlay: { position: "absolute", left: space.md, right: space.md, bottom: space.lg, gap: 8 },
  mapLegend: { flexDirection: "row", gap: 12, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line },
  mapHint: { alignSelf: "center", backgroundColor: color.ink, color: "#fff", fontSize: 13, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, overflow: "hidden", textAlign: "center" },
  sectionHead: { flexDirection: "row", gap: 10, alignItems: "center", padding: space.md, borderRadius: radius.md, backgroundColor: color.warnSoft, borderWidth: 1, borderColor: color.warnLine, marginTop: space.sm },
  closeSel: { alignSelf: "flex-end", width: 36, height: 36, borderRadius: 18, backgroundColor: color.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: color.line },
});
