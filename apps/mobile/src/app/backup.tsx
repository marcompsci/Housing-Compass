/**
 * Backup & restore: save your renter and money tools to a file (to move to a new phone or keep
 * a copy), and restore by pasting the file's contents. Checked before anything is replaced.
 * Photos aren't included. Nothing is sent to our servers.
 */
import { backupSummary, parseBackup, type RenterBackup } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { Banner, Button, Section } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { shareBackup } from "../lib/backup";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

export default function Backup() {
  return (
    <LockGate>
      <BackupScreen />
    </LockGate>
  );
}

function BackupScreen() {
  const { t } = useT();
  const restore = useRenter((s) => s.restore);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<RenterBackup | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="backup">
      <Banner tone="info" icon="save-outline" title={t("bk.title")}>
        {t("bk.intro")}
      </Banner>
      <Section title={t("bk.saveTitle")}>
        <Text style={type.small}>{t("bk.saveBody")}</Text>
        <Button icon="download-outline" label={t("bk.save")} onPress={() => void shareBackup(now())} testID="backup-save" />
      </Section>
      <Section title={t("bk.restoreTitle")}>
        <Text style={type.small}>{t("bk.restoreBody")}</Text>
        <TextInput value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} style={styles.box} accessibilityLabel={t("bk.paste")} placeholder={t("bk.paste")} placeholderTextColor={color.muted} testID="backup-input" />
        <Button
          kind="secondary"
          label={t("bk.check")}
          disabled={!text.trim()}
          testID="backup-check"
          onPress={() => {
            const r = parseBackup(text);
            if (r.ok) {
              setPending(r.backup);
              setMsg({ ok: true, text: t("bk.found", { summary: backupSummary(r.backup), date: r.backup.createdAt.slice(0, 10) }) });
            } else {
              setPending(null);
              setMsg({ ok: false, text: r.error });
            }
          }}
        />
        {msg ? <Text style={[type.small, { color: msg.ok ? color.ink : color.danger }]} testID="backup-msg">{msg.text}</Text> : null}
        {pending ? (
          <Banner tone="warn" icon="alert-circle-outline" title={t("bk.replaceTitle")}>
            {t("bk.replaceBody")}
          </Banner>
        ) : null}
        {pending ? (
          <Button
            icon="refresh-outline"
            label={t("bk.restore")}
            testID="backup-restore"
            onPress={() => {
              restore(pending);
              setPending(null);
              setText("");
              setMsg({ ok: true, text: t("bk.done") });
            }}
          />
        ) : null}
      </Section>
      <Text style={type.tiny}>{t("bk.footer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  box: { minHeight: 120, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: 12, fontSize: 13, color: color.ink, backgroundColor: color.surface, textAlignVertical: "top" },
});
