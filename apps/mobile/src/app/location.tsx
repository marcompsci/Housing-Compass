import { ALL_PLACES, REGIONS, coarsen, findCity, haversineKm, isUsZip, lookupZip, regionForPoint, type RegionId } from "@housing-compass/core";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Banner, Button, Chip, Section } from "../components/ui";
import { useStore } from "../state/store";
import { HIT, color, radius, space, type } from "../theme";

const POPULAR: Record<RegionId, string[]> = {
  bay_area: ["San Francisco", "Oakland", "Berkeley", "San Jose", "Fremont", "Richmond", "Vallejo", "San Leandro"],
  la_city: ["Los Angeles", "North Hollywood", "Koreatown", "Hollywood", "San Pedro", "Pacoima"],
  la_county: ["Long Beach", "Pasadena", "Glendale", "Alhambra", "Inglewood", "Santa Clarita"],
};

export default function LocationScreen() {
  const setArea = useStore((s) => s.setArea);
  const current = useStore((s) => s.area.region ?? "bay_area");
  const [region, setRegion] = useState<RegionId>(current);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const done = () => router.back();

  const pickRegion = (r: RegionId) => {
    setArea({ label: REGIONS[r].label, center: REGIONS[r].center, source: "region", inBayArea: r === "bay_area", region: r });
    done();
  };

  const useDevice = async () => {
    setError("");
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return setError("Location permission was not granted. You can pick a region or type a city or ZIP instead.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const p = coarsen({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const r = regionForPoint(p);
      const nearest = [...ALL_PLACES].sort((a, b) => haversineKm(p, a) - haversineKm(p, b))[0]!;
      setArea({ label: r ? `Near ${nearest.name}` : "Your current area", center: p, source: "device", inBayArea: r === "bay_area", region: r });
      done();
    } catch {
      setError("Couldn't get your location. Pick a region or type a city or ZIP instead.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    if (isUsZip(q)) {
      const z = lookupZip(q);
      if (!z) return setError("We couldn't find that ZIP. California ZIP codes are supported today.");
      const r = regionForPoint(z);
      setArea({ label: `${z.city}, CA ${z.zip}`, center: z, source: "zip", inBayArea: r === "bay_area", region: r });
      return done();
    }
    const c = findCity(q);
    if (!c) return setError("Enter a Bay Area or Los Angeles–area city (e.g. Oakland, Long Beach) or a 5-digit California ZIP.");
    setArea({ label: `${c.name}, CA`, center: c, source: "city", inBayArea: c.region === "bay_area", region: c.region ?? null });
    done();
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Section title="Region">
        <View style={styles.row} accessibilityRole="radiogroup">
          {(Object.keys(REGIONS) as RegionId[]).map((r) => (
            <Chip key={r} label={REGIONS[r].label} selected={region === r} onPress={() => setRegion(r)} />
          ))}
        </View>
        <Button label={`Search all of ${REGIONS[region].label}`} onPress={() => pickRegion(region)} testID="pick-region" />
        <Text style={type.tiny}>LA County includes the City of Los Angeles. More regions are coming; elsewhere you'll get official links instead.</Text>
      </Section>

      <Section title="Use my location">
        <Text style={type.small}>We ask once, use an approximate (~1 km) position for this search only, and never send it to our servers or keep it after you close the app.</Text>
        <Button kind="secondary" icon="navigate-outline" label={busy ? "Finding you…" : "Use my approximate location"} onPress={useDevice} disabled={busy} />
      </Section>

      <Section title="Or enter a city, neighborhood or ZIP">
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError("");
          }}
          onSubmitEditing={submit}
          placeholder="Oakland, North Hollywood or 90012"
          style={styles.input}
          accessibilityLabel="City or ZIP code"
          autoCapitalize="words"
          returnKeyType="search"
        />
        <Button label="Search here" onPress={submit} />
        {error ? <Banner tone="danger" icon="alert-circle-outline" title={error} /> : null}
        <Text style={[type.tiny, { marginTop: 4 }]}>Popular in {REGIONS[region].label}</Text>
        <View style={styles.row}>
          {POPULAR[region].map((n) => (
            <Chip
              key={n}
              label={n}
              onPress={() => {
                const c = findCity(n)!;
                setArea({ label: `${c.name}, CA`, center: c, source: "city", inBayArea: c.region === "bay_area", region: c.region ?? null });
                done();
              }}
            />
          ))}
        </View>
      </Section>
      <Text style={[type.tiny, { textAlign: "center", color: color.muted }]}>ZIP centroids: zipcodes dataset (approximate).</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 16, color: color.ink, backgroundColor: color.surface },
});
