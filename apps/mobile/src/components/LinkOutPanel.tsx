import { LINK_OUT_ADAPTERS, programsFor, type Category, type RegionId } from "@housing-compass/core";
import { router } from "expo-router";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { openExternal } from "../lib/links";
import { type } from "../theme";
import { Chip, Section } from "./ui";

const tel = (phone: string, url: string) => (Platform.OS === "web" ? openExternal(url) : Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`));

/** Official programs for the region first, then legal link-outs to listing sites (never copied). */
export function LinkOutPanel({ city, category, maxRentDollars, region }: { city: string; category: Category; maxRentDollars: number; region: RegionId | null }) {
  const q = { city, state: "CA" as const, category, maxRentDollars, region: region ?? undefined };
  const programs = region ? programsFor(region) : [];
  const sites = LINK_OUT_ADAPTERS.filter((a) => a.id !== "roomies" || region === "la_city" || region === "la_county");
  return (
    <Section title="Search beyond Housing Compass">
      {programs.length ? (
        <>
          <Text style={type.small}>Official programs and free help lines. A program being listed doesn't mean a unit is open, or that you qualify.</Text>
          <View style={styles.row}>
            {programs.map((p) => (
              <Chip key={p.id} icon="shield-checkmark-outline" label={`${p.name} ↗`} onPress={() => openExternal(p.url)} accessibilityHint={p.whatItIs} />
            ))}
            {programs.filter((p) => p.phone).map((p) => (
              <Chip key={`${p.id}-tel`} icon="call-outline" label={`Call ${p.phone}`} onPress={() => tel(p.phone!, p.url)} accessibilityHint={`${p.name}${p.hours ? `, ${p.hours}` : ""}`} />
            ))}
          </View>
          <Chip label="How these programs work →" onPress={() => router.push("/programs")} />
        </>
      ) : (
        <Text style={type.small}>We don't cover this area yet. Your local housing authority and 211 can point you to official programs.</Text>
      )}
      <Text style={[type.tiny, { marginTop: 4 }]}>Listing sites for {city} (open externally; not checked by us):</Text>
      <View style={styles.row}>
        {sites.map((a) => (
          <Chip key={a.id} label={`${a.name} ↗`} onPress={() => openExternal(a.buildSearchUrl!(q))} accessibilityHint={`Opens ${a.name}. Not verified by Housing Compass.`} />
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
