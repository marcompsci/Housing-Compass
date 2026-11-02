import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { useSession } from "../auth/session";
import { Banner, Button, Section } from "../components/ui";
import { supabase } from "../data/supabase";
import { HIT, color, radius, space, type } from "../theme";

export default function LandlordOnboarding() {
  const session = useSession();
  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState("");
  const [state, setState] = useState<"" | "sent" | "error" | "need_account">("");
  const valid = company.trim().length >= 2 && (!site || /^https:\/\//i.test(site.trim())) && addresses.trim().length > 3;

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={type.small}>
        List homes and message renters as a verified owner or manager. A person checks that you have the authority to rent each property before anything is published. Your documents are never shown publicly.
      </Text>
      <Button kind="secondary" icon="speedometer-outline" label="Already approved? Open your dashboard" onPress={() => router.push("/landlord-dashboard")} testID="open-dashboard" />
      <Section title="How verification works">
        <Text style={type.small}>1. Tell us who you are and which properties you manage.</Text>
        <Text style={type.small}>2. A reviewer contacts you through the phone or website on public records (not just what you type here) and asks for proof of authority — e.g. a management agreement or property tax record in your or your company's name.</Text>
        <Text style={type.small}>3. Once approved, your listings can be verified one by one (address, unit, rent, fees, availability). Verification expires and is rechecked regularly.</Text>
      </Section>
      <Section title="Your details">
        <TextInput value={company} onChangeText={setCompany} placeholder="Company or owner name" style={styles.input} accessibilityLabel="Company or owner name" />
        <TextInput value={site} onChangeText={setSite} placeholder="Official website (https://…) — optional" autoCapitalize="none" style={styles.input} accessibilityLabel="Official website" />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Office phone" keyboardType="phone-pad" style={styles.input} accessibilityLabel="Office phone" />
        <TextInput value={addresses} onChangeText={setAddresses} placeholder="Property addresses (one per line)" multiline style={[styles.input, { minHeight: HIT * 2 }]} accessibilityLabel="Property addresses" />
        <Text style={type.tiny}>Don't enter ID numbers, SSNs or bank details here. A reviewer will request documents through a private upload link.</Text>
        <Button
          label="Apply to list"
          disabled={!valid}
          onPress={async () => {
            if (!supabase || !session) return setState("need_account");
            const { error } = await supabase.from("landlord_applications").insert({
              user_id: session.user.id,
              company_name: company.trim(),
              official_website: site.trim() || null,
              official_phone: phone.trim() || null,
              property_addresses: addresses.split("\n").map((a) => a.trim()).filter(Boolean).slice(0, 50),
            });
            setState(error ? "error" : "sent");
          }}
        />
        {state === "sent" ? <Banner tone="info" icon="checkmark-circle-outline" title="Application received. A reviewer will contact you." /> : null}
        {state === "error" ? <Banner tone="danger" icon="alert-circle-outline" title="Couldn't submit. Please try again." /> : null}
        {state === "need_account" ? <Banner tone="warn" icon="person-circle-outline" title="Sign in first (Saved → Account) so we can contact you about your application." /> : null}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: color.ink, backgroundColor: color.surface },
});
