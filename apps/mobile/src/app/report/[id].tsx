import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { Banner, Button, Chip } from "../../components/ui";
import { useStore } from "../../state/store";
import { useSession } from "../../auth/session";
import { supabase } from "../../data/supabase";
import { HIT, color, radius, space, type } from "../../theme";

const REASONS = [
  ["upfront_payment", "Asked for money before a tour"],
  ["off_platform_payment", "Asked for wire, crypto or gift cards"],
  ["impersonation", "Pretending to be a manager or owner"],
  ["not_available", "Not available / doesn't exist"],
  ["wrong_price", "Price or fees are wrong"],
  ["duplicate", "Duplicate or copied listing"],
  ["discrimination", "Discriminatory terms"],
  ["other", "Something else"],
] as const;

export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = decodeURIComponent(String(id));
  const addReport = useStore((s) => s.addReport);
  const recent = useStore((s) => s.reports.filter((r) => Date.now() - new Date(r.createdAt).getTime() < 3_600_000).length);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState<"" | "local" | "server">("");
  const session = useSession();
  const limited = recent >= 10; // mirrors the server-side rate limit

  if (sent) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        <Banner tone="info" icon="checkmark-circle-outline" title={sent === "server" ? "Thanks — a reviewer will look at this" : "Thanks — report saved"}>
          {sent === "server"
            ? "Payment-related reports hide the listing right away while a person reviews it."
            : "It's stored on this device and will be sent when you sign in."}
        </Banner>
        <Button label="Done" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={type.small}>A person reviews every report. Reports alone never label a listing as fraud.</Text>
      {REASONS.map(([v, label]) => (
        <Chip key={v} label={label} selected={reason === v} onPress={() => setReason(v)} />
      ))}
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="What happened? (optional — don't include passwords or bank details)"
        style={styles.input}
        multiline
        maxLength={2000}
        accessibilityLabel="Report details"
      />
      {limited ? <Banner tone="warn" icon="hourglass-outline" title="You've sent a lot of reports this hour. Please try again later." /> : null}
      <Button
        label="Send report"
        disabled={!reason || limited}
        onPress={async () => {
          if (supabase && session) {
            const { error } = await supabase.from("reports").insert({ listing_id: listingId, reporter_id: session.user.id, reason: reason!, details: details.trim() || null });
            if (!error) return setSent("server");
          }
          addReport({ listingId, reason: reason!, details: details.trim() });
          setSent("local");
        }}
      />
      <Text style={[type.tiny, { color: color.muted }]}>If you've lost money, contact your local police non-emergency line and the FTC at reportfraud.ftc.gov.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, maxWidth: 640, width: "100%", alignSelf: "center" },
  input: { minHeight: HIT * 2.5, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: 12, fontSize: 15, color: color.ink, backgroundColor: color.surface, textAlignVertical: "top" },
});
