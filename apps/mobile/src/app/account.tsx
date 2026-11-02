import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { runSync, useEmailOtp, useSession, useSessionStore } from "../auth/session";
import { Banner, Button, KV, Section } from "../components/ui";
import { backendEnabled, supabase } from "../data/supabase";
import { useStore } from "../state/store";
import { clearThisDevice, exportMyData } from "../lib/myData";
import { useT } from "../i18n";
import { HIT, color, radius, space, type } from "../theme";

function DeviceDataSection({ signedIn }: { signedIn: boolean }) {
  const { t } = useT();
  const [msg, setMsg] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <Section title={t("acct.dataTitle")}>
      <Text style={type.small}>
        {signedIn ? t("acct.dataBodyAccount") : t("acct.dataBodyDevice")}
      </Text>
      <Button
        kind="secondary"
        icon="download-outline"
        label={t("acct.download")}
        testID="export-data"
        onPress={async () => {
          try {
            const r = await exportMyData(signedIn);
            setMsg(r === "downloaded" ? t("acct.downloaded") : "");
          } catch (e) {
            setMsg((e as Error).message);
          }
        }}
      />
      {msg ? <Text style={type.tiny}>{msg}</Text> : null}
      {confirmClear ? (
        <Button
          kind="danger"
          label={t("acct.clearConfirm")}
          onPress={async () => {
            await clearThisDevice();
            setConfirmClear(false);
            setMsg(t("acct.cleared"));
          }}
        />
      ) : (
        <Button kind="danger" icon="phone-portrait-outline" label={t("acct.clear")} onPress={() => setConfirmClear(true)} />
      )}
      <Text style={type.tiny}>{t("acct.clearNote")}</Text>
    </Section>
  );
}

export default function Account() {
  const { t } = useT();
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
        <Banner tone="info" icon="cloud-offline-outline" title={t("acct.offTitle")}>
          {t("acct.offBody")}
        </Banner>
        <KV k={t("acct.onDevice")} v={t("acct.counts", { fav: local.fav, searches: local.searches, reports: local.reports })} />
        <Button kind="secondary" icon="flag-outline" label={t("reports.open")} onPress={() => router.push("/my-reports")} testID="my-reports-link" />
        <DeviceDataSection signedIn={false} />
      </ScrollView>
    );
  }

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={type.small}>{t("acct.signInIntro")}</Text>
        {otp.stage === "email" ? (
          <Section title={t("acct.email")}>
            <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={styles.input} accessibilityLabel="Email address" />
            <Button label={otp.busy ? t("acct.sending") : t("acct.sendCode")} disabled={otp.busy || !/^\S+@\S+\.\S+$/.test(email)} onPress={() => otp.send(email)} />
          </Section>
        ) : (
          <Section title={t("acct.enterCode")}>
            <Text style={type.small}>Sent to {email}. It expires in a few minutes.</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} style={styles.input} accessibilityLabel="Six digit code" />
            <Button label={otp.busy ? t("acct.checking") : t("acct.signIn")} disabled={otp.busy || code.length !== 6} onPress={() => otp.verify(email, code)} />
            <Button kind="ghost" label={t("acct.otherEmail")} onPress={otp.reset} />
          </Section>
        )}
        {otp.error ? <Banner tone="danger" icon="alert-circle-outline" title={otp.error} /> : null}
        <Text style={type.tiny}>{t("acct.emailNote")}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Section title={t("acct.signedIn")}>
        <KV k="Email" v={session.user.email ?? "—"} />
        <KV k="Sync" v={syncing ? "Syncing…" : lastSync ? `Uploaded ${lastSync.favoritesUploaded} favorites, ${lastSync.searchesUploaded} searches, ${lastSync.reportsUploaded} reports` : "Up to date"} />
        <Button kind="secondary" icon="sync-outline" label={t("acct.sync")} onPress={() => void runSync()} disabled={syncing} />
        <Button kind="secondary" icon="log-out-outline" label={t("acct.signOut")} onPress={async () => { await supabase!.auth.signOut(); router.back(); }} />
      </Section>
      <Section title={t("acct.serverData")}>
        <Text style={type.small}>{t("acct.deleteBody")}</Text>
        {confirmDelete ? (
          <Button
            kind="danger"
            label={t("acct.deleteConfirm")}
            onPress={async () => {
              await supabase!.rpc("delete_my_data");
              useStore.setState({ favorites: [], savedSearches: [], reports: [] });
              await supabase!.auth.signOut();
              router.back();
            }}
          />
        ) : (
          <Button kind="danger" icon="trash-outline" label={t("acct.delete")} onPress={() => setConfirmDelete(true)} />
        )}
      </Section>
      <Button kind="secondary" icon="flag-outline" label={t("reports.open")} onPress={() => router.push("/my-reports")} />
      <DeviceDataSection signedIn />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 16, color: color.ink, backgroundColor: color.surface },
});
