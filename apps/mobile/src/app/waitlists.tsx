/**
 * Program waitlists: Section 8 / Housing Choice Voucher lists, public housing and building
 * waitlists can take years, and many drop you if you miss a check-in. Track where you are,
 * your confirmation number and the next date you must confirm interest. Device-only.
 */
import { waitlistAttention, type WaitlistEntry } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, today } from "../components/forms";
import { Banner, Button, Chip, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const STATUSES: WaitlistEntry["status"][] = ["waiting", "invited", "closed"];

function Card({ w }: { w: WaitlistEntry }) {
  const { t } = useT();
  const update = useRenter((s) => s.updateWaitlist);
  const remove = useRenter((s) => s.removeWaitlist);
  const [checkIn, setCheckIn] = useState(w.nextCheckIn ?? "");
  const att = waitlistAttention(w, now());
  return (
    <View style={formStyles.card} testID="waitlist-card">
      <View style={formStyles.row}>
        <Tag label={t(`wl.s.${w.status}`)} tone={w.status === "invited" ? "good" : "neutral"} />
        {att ? <Tag label={t(att === "check_in_overdue" ? "wl.overdue" : "wl.soon")} tone="warn" /> : null}
      </View>
      <Text style={type.h3}>{w.programName}</Text>
      <Text style={type.tiny}>
        {t("wl.joined", { date: w.joinedOn })}
        {w.confirmation ? ` · #${w.confirmation}` : ""}
      </Text>
      <Field
        label={t("wl.nextCheckIn")}
        value={checkIn}
        onChangeText={setCheckIn}
        onBlur={() => update(w.id, { nextCheckIn: isDate(checkIn) ? checkIn : null })}
        placeholder="2027-01-15"
        autoCapitalize="none"
      />
      <View style={formStyles.row}>
        {STATUSES.map((s) => (
          <Chip key={s} label={t(`wl.s.${s}`)} selected={w.status === s} onPress={() => update(w.id, { status: s })} />
        ))}
      </View>
      <Button kind="ghost" icon="trash-outline" label={t("wl.remove")} onPress={() => remove(w.id)} />
    </View>
  );
}

export default function Waitlists() {
  const { t } = useT();
  const waitlists = useRenter((s) => s.waitlists);
  const add = useRenter((s) => s.addWaitlist);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(today(now()));
  const [conf, setConf] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="waitlists">
      <Banner tone="info" icon="hourglass-outline" title={t("wl.title")}>
        {t("wl.intro")}
      </Banner>
      {waitlists.map((w) => (
        <Card key={w.id} w={w} />
      ))}
      <Section title={t("wl.addTitle")}>
        <Field label={t("wl.program")} value={name} onChangeText={setName} placeholder={t("wl.programPh")} testID="wl-name" />
        <Field label={t("wl.joinedOn")} value={joined} onChangeText={setJoined} autoCapitalize="none" />
        <Field label={t("wl.confirmation")} value={conf} onChangeText={setConf} autoCapitalize="none" />
        <Field label={t("wl.nextCheckIn")} value={checkIn} onChangeText={setCheckIn} placeholder="2027-01-15" autoCapitalize="none" hint={t("wl.checkInHint")} testID="wl-checkin" />
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="add-circle-outline"
          label={t("wl.add")}
          testID="wl-add"
          onPress={() => {
            if (name.trim().length < 2) return setErr(t("wl.errName"));
            if (!isDate(joined) || (checkIn && !isDate(checkIn))) return setErr(t("move.errDate"));
            add({ programName: name.trim().slice(0, 100), joinedOn: joined, confirmation: conf.trim().slice(0, 60), nextCheckIn: checkIn || null, status: "waiting", notes: "" });
            setName("");
            setConf("");
            setCheckIn("");
            setErr(null);
          }}
        />
      </Section>
      <Button kind="secondary" icon="business-outline" label={t("help.programs")} onPress={() => router.push("/programs")} />
      <Text style={type.tiny}>{t("wl.footer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
});
