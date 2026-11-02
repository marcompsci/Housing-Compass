import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { runSync, useEmailOtp, useSession, useSessionStore } from "../auth/session";
import { Banner, Button, KV, Section } from "../components/ui";
import { backendEnabled, supabase } from "../data/supabase";
import { useStore } from "../state/store";
import { clearThisDevice, exportMyData } from "../lib/myData";
import { HIT, color, radius, space, type } from "../theme";

function DeviceDataSection({ signedIn }: { signedIn: boolean }) {
  const [msg, setMsg] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <Section title="Download or clear your data">
      <Text style={type.small}>
        {signedIn ? "Download a copy of everything Housing Compass keeps for you — on this device and in your account — as a readable file." : "Download a copy of everything Housing Compass keeps on this device as a readable file."}
      </Text>
      <Button
        kind="secondary"
        icon="download-outline"
        label="Download my data"
        testID="export-data"
        onPress={async () => {
          try {
            const r = await exportMyData(signedIn);
            setMsg(r === "downloaded" ? "Saved to your downloads." : "");
          } catch (e) {
            setMsg((e as Error).message);
          }
        }}
      />
      {msg ? <Text style={type.tiny}>{msg}</Text> : null}
      {confirmClear ? (
        <Button
          kind="danger"
          label="Yes, clear this device"
          onPress={async () => {
            await clearThisDevice();
            setConfirmClear(false);
            setMsg("Everything on this device was cleared.");
          }}
        />
      ) : (
        <Button kind="danger" icon="phone-portrait-outline" label="Clear everything on this device" onPress={() => setConfirmClear(true)} />
      )}
      <Text style={type.tiny}>Clearing removes saved homes, searches, applications, messages, checklists and your numbers from this device. It doesn't delete your account.</Text>
    </Section>
  );
}

export default function Account() {
  const session = useSession();
  const { lastSync, syncing } = useSessionStore();
  const otp = useEmailOtp();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const local = {
    fav: useStore((s) => s.favorites.length),
    searches: useStore((s) => s.savedSearches.length),
    reports: useStore((s) => s.reports.filter((r) => !r.syncedAt).length),
  };

  if (!backendEnabled) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        <Banner tone="info" icon="cloud-offline-outline" title="Accounts aren't switched on in this build">
          Everything you save stays on this device. Accounts sync favorites, saved searches and reports once the app is connected to its server.
        </Banner>
        <KV k="Saved on this device" v={`${local.fav} favorites · ${local.searches} searches · ${local.reports} reports`} />
        <DeviceDataSection signedIn={false} />
      </ScrollView>
    );
  }

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={type.small}>Sign in with a one-time code to keep favorites, searches, alerts and applications on all your devices. No password needed.</Text>
        {otp.stage === "email" ? (
          <Section title="Your email">
            <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={styles.input} accessibilityLabel="Email address" />
            <Button label={otp.busy ? "Sending…" : "Email me a code"} disabled={otp.busy || !/^\S+@\S+\.\S+$/.test(email)} onPress={() => otp.send(email)} />
          </Section>
        ) : (
          <Section title="Enter the 6-digit code">
            <Text style={type.small}>Sent to {email}. It expires in a few minutes.</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} style={styles.input} accessibilityLabel="Six digit code" />
            <Button label={otp.busy ? "Checking…" : "Sign in"} disabled={otp.busy || code.length !== 6} onPress={() => otp.verify(email, code)} />
            <Button kind="ghost" label="Use a different email" onPress={otp.reset} />
          </Section>
        )}
        {otp.error ? <Banner tone="danger" icon="alert-circle-outline" title={otp.error} /> : null}
        <Text style={type.tiny}>We use your email only to sign you in and send alerts you turn on.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Section title="Signed in">
        <KV k="Email" v={session.user.email ?? "—"} />
        <KV k="Sync" v={syncing ? "Syncing…" : lastSync ? `Uploaded ${lastSync.favoritesUploaded} favorites, ${lastSync.searchesUploaded} searches, ${lastSync.reportsUploaded} reports` : "Up to date"} />
        <Button kind="secondary" icon="sync-outline" label="Sync now" onPress={() => void runSync()} disabled={syncing} />
        <Button kind="secondary" icon="log-out-outline" label="Sign out" onPress={async () => { await supabase!.auth.signOut(); router.back(); }} />
      </Section>
      <Section title="Your data">
        <Text style={type.small}>Delete your favorites, saved searches, applications and notifications from our servers. Reports you sent are kept without your comments, because they protect other renters.</Text>
        {confirmDelete ? (
          <Button
            kind="danger"
            label="Yes, delete my data"
            onPress={async () => {
              await supabase!.rpc("delete_my_data");
              useStore.setState({ favorites: [], savedSearches: [], reports: [] });
              await supabase!.auth.signOut();
              router.back();
            }}
          />
        ) : (
          <Button kind="danger" icon="trash-outline" label="Delete my data" onPress={() => setConfirmDelete(true)} />
        )}
      </Section>
      <DeviceDataSection signedIn />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 16, color: color.ink, backgroundColor: color.surface },
});
