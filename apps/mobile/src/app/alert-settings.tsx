/**
 * Alert preferences: which kinds, quiet hours, daily push cap. Stored on this device and,
 * when signed in, on the server (set_alert_prefs) so the scheduled notifier respects them.
 */
import { NOTIFICATION_KINDS, NOTIFICATION_KIND_LABEL } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSession } from "../auth/session";
import { Banner, Button, Chip, Section } from "../components/ui";
import { supabase } from "../data/supabase";
import { useT } from "../i18n";
import { usePrefs } from "../state/prefs";
import { HIT, color, space, type } from "../theme";

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

export default function AlertSettings() {
  const { t } = useT();
  const prefs = usePrefs((s) => s.alertPrefs);
  const setPrefs = usePrefs((s) => s.setAlertPrefs);
  const session = useSession();
  const [status, setStatus] = useState<"" | "saved" | "error">("");
  const kinds = prefs.kinds ?? NOTIFICATION_KINDS;
  const quiet = prefs.quietStart !== null && prefs.quietEnd !== null;

  const sync = async () => {
    if (!supabase || !session) return;
    const p = usePrefs.getState().alertPrefs;
    const { error } = await supabase.rpc("set_alert_prefs", {
      p_quiet_start: p.quietStart,
      p_quiet_end: p.quietEnd,
      p_utc_offset_minutes: -new Date().getTimezoneOffset(),
      p_max_push_per_day: p.maxPushPerDay,
      p_kinds: p.kinds ?? NOTIFICATION_KINDS,
    });
    setStatus(error ? "error" : "saved");
  };
  const update = (p: Parameters<typeof setPrefs>[0]) => {
    setPrefs({ ...p, utcOffsetMinutes: -new Date().getTimezoneOffset() });
    setStatus("");
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="alert-settings">
      <Section title={t("alerts.kinds")}>
        {NOTIFICATION_KINDS.map((k) => {
          const on = kinds.includes(k);
          return (
            <Pressable key={k} onPress={() => update({ kinds: on ? kinds.filter((x) => x !== k) : [...kinds, k] })} style={styles.row} accessible={false}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.body}>{NOTIFICATION_KIND_LABEL[k].label}</Text>
                <Text style={type.tiny}>{NOTIFICATION_KIND_LABEL[k].help}</Text>
              </View>
              <Switch value={on} onValueChange={() => update({ kinds: on ? kinds.filter((x) => x !== k) : [...kinds, k] })} trackColor={{ true: color.brand, false: color.line }} accessibilityLabel={NOTIFICATION_KIND_LABEL[k].label} />
            </Pressable>
          );
        })}
      </Section>

      <Section title={t("alerts.quiet")}>
        <View style={styles.row}>
          <Text style={[type.body, { flex: 1 }]}>{t("alerts.quietToggle")}</Text>
          <Switch value={quiet} onValueChange={(v) => update(v ? { quietStart: 21, quietEnd: 8 } : { quietStart: null, quietEnd: null })} trackColor={{ true: color.brand, false: color.line }} accessibilityLabel={t("alerts.quietToggle")} />
        </View>
        {quiet ? (
          <View style={{ gap: 8 }}>
            <Text style={type.small}>{t("alerts.from")}</Text>
            <View style={styles.chips}>
              {[19, 20, 21, 22, 23].map((h) => (
                <Chip key={h} label={hourLabel(h)} selected={prefs.quietStart === h} onPress={() => update({ quietStart: h })} />
              ))}
            </View>
            <Text style={type.small}>{t("alerts.until")}</Text>
            <View style={styles.chips}>
              {[6, 7, 8, 9, 10].map((h) => (
                <Chip key={h} label={hourLabel(h)} selected={prefs.quietEnd === h} onPress={() => update({ quietEnd: h })} />
              ))}
            </View>
          </View>
        ) : null}
      </Section>

      <Section title={t("alerts.cap")}>
        <View style={styles.chips}>
          {[1, 3, 5, 10].map((n) => (
            <Chip key={n} label={String(n)} selected={prefs.maxPushPerDay === n} onPress={() => update({ maxPushPerDay: n })} />
          ))}
        </View>
        <Text style={type.tiny}>{t("alerts.capNote")}</Text>
      </Section>

      {session && supabase ? (
        <Button label={t("alerts.saveSync")} icon="cloud-upload-outline" onPress={() => void sync()} />
      ) : (
        <Text style={type.tiny}>{t("alerts.deviceOnly")}</Text>
      )}
      {status === "saved" ? <Banner tone="info" icon="checkmark-circle-outline" title={t("alerts.saved")} /> : null}
      {status === "error" ? <Banner tone="danger" icon="alert-circle-outline" title={t("alerts.saveFailed")} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: HIT, paddingVertical: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
