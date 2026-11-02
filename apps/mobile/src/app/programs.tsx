import { PROGRAMS, REGIONS, VOUCHER_NOTE_CA, type RegionId } from "@housing-compass/core";
import { useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Banner, Button, Chip, KV, Section } from "../components/ui";
import { openExternal } from "../lib/links";
import { useStore } from "../state/store";
import { space, type } from "../theme";

export default function Programs() {
  const areaRegion = useStore((s) => s.area.region ?? "bay_area");
  const [region, setRegion] = useState<RegionId>(areaRegion);
  const list = PROGRAMS.filter((p) => p.regions.includes(region));
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.row}>
        {(Object.keys(REGIONS) as RegionId[]).map((r) => (
          <Chip key={r} label={REGIONS[r].label} selected={region === r} onPress={() => setRegion(r)} />
        ))}
      </View>
      <Banner tone="info" icon="information-circle-outline" title="Programs are not vacancies">
        These are official, free resources. Being listed here doesn't mean a unit is open or that you'll qualify. Each program decides eligibility.
      </Banner>
      {list.map((p) => (
        <Section key={p.id} title={p.name}>
          <Text style={type.tiny}>{p.operator}</Text>
          <Text style={type.body}>{p.whatItIs}</Text>
          <KV k="Waitlists & applying" v={p.waitlistInfo} />
          <KV k="Who qualifies" v={p.eligibilityInfo} />
          <KV k="Open units?" v={p.vacancyInfo} />
          {p.hours ? <KV k="Hours" v={p.hours} /> : null}
          {p.tty ? <KV k="TTY" v={p.tty} /> : null}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button icon="open-outline" label="Open official site ↗" onPress={() => openExternal(p.url)} />
            {p.phone ? <Button kind="secondary" icon="call-outline" label={`Call ${p.phone}`} onPress={() => (Platform.OS === "web" ? openExternal(p.url) : Linking.openURL(`tel:${p.phone!.replace(/[^\d+]/g, "")}`))} /> : null}
          </View>
          <Text style={type.tiny}>Checked {p.checkedOn}. Details can change — the official site is the source of truth.</Text>
        </Section>
      ))}
      <Section title="Housing vouchers (Section 8)">
        <Text style={type.small}>{VOUCHER_NOTE_CA}</Text>
        <Text style={type.tiny}>General information, not legal advice.</Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
