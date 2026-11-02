import { PROGRAMS, PROGRAM_EDITABLE_FIELDS, REGIONS, VOUCHER_NOTE_CA, programFromRow, type HousingProgram, type ProgramEditableField, type RegionId } from "@housing-compass/core";
import { useEffect, useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../auth/session";
import { supabase } from "../data/supabase";
import { HIT, color, radius } from "../theme";
import { Banner, Button, Chip, KV, Section } from "../components/ui";
import { openExternal } from "../lib/links";
import { useStore } from "../state/store";
import { space, type } from "../theme";

export default function Programs() {
  const areaRegion = useStore((s) => s.area.region ?? "bay_area");
  const [region, setRegion] = useState<RegionId>(areaRegion);
  const [all, setAll] = useState<HousingProgram[]>(PROGRAMS);
  const [source, setSource] = useState<"bundled" | "server">("bundled");
  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("programs")
      .select("*")
      .eq("status", "published")
      .then(({ data }) => {
        const rows = (data ?? []).map((r) => programFromRow(r as Record<string, unknown>)).filter((p): p is HousingProgram => !!p);
        if (rows.length) {
          setAll(rows);
          setSource("server");
        }
      });
  }, []);
  const list = all.filter((p) => p.regions.includes(region));
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.row}>
        {(Object.keys(REGIONS) as RegionId[]).map((r) => (
          <Chip key={r} label={REGIONS[r].label} selected={region === r} onPress={() => setRegion(r)} />
        ))}
      </View>
      {source === "server" ? <Text style={type.tiny}>Live list · corrections are reviewed before they appear.</Text> : null}
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
          <SuggestEdit programId={p.id} />
        </Section>
      ))}
      <Section title="Housing vouchers (Section 8)">
        <Text style={type.small}>{VOUCHER_NOTE_CA}</Text>
        <Text style={type.tiny}>General information, not legal advice.</Text>
      </Section>
    </ScrollView>
  );
}

const FIELD_LABEL: Record<ProgramEditableField, string> = {
  url: "Website", phone: "Phone", tty: "TTY", hours: "Hours", what_it_is: "What it is",
  waitlist_info: "Waitlists & applying", eligibility_info: "Who qualifies", vacancy_info: "Open units?",
};

/** Anyone signed in can suggest a correction; a reviewer (not the same person) checks it against the official source. */
function SuggestEdit({ programId }: { programId: string }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<ProgramEditableField>("hours");
  const [value, setValue] = useState("");
  const [evidence, setEvidence] = useState("");
  const [state, setState] = useState<"" | "sent" | "error">("");
  if (!supabase) return null;
  if (!open) return <Button kind="ghost" icon="create-outline" label="Suggest a correction" onPress={() => setOpen(true)} />;
  if (!session) return <Text style={type.tiny}>Sign in (Saved → Account) to suggest a correction.</Text>;
  const valid = value.trim().length >= 2 && (!evidence || /^https:\/\//.test(evidence.trim()));
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        {PROGRAM_EDITABLE_FIELDS.map((f) => (
          <Chip key={f} label={FIELD_LABEL[f]} selected={field === f} onPress={() => setField(f)} />
        ))}
      </View>
      <TextInput value={value} onChangeText={setValue} placeholder="Correct information" multiline style={styles.input} accessibilityLabel="Correct information" />
      <TextInput value={evidence} onChangeText={setEvidence} placeholder="Official page that shows it (https://…)" autoCapitalize="none" style={styles.input} accessibilityLabel="Source link" />
      <Button
        label="Send for review"
        disabled={!valid || state === "sent"}
        onPress={async () => {
          const { error } = await supabase!.from("program_edits").insert({ program_id: programId, proposed_by: session.user.id, changes: { [field]: value.trim() }, evidence_url: evidence.trim() || null });
          setState(error ? "error" : "sent");
        }}
      />
      {state === "sent" ? <Text style={type.tiny}>Thanks — a reviewer will check it against the official source.</Text> : null}
      {state === "error" ? <Text style={[type.tiny, { color: color.danger }]}>Couldn't send. Try again.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: color.ink, backgroundColor: color.surface },
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
