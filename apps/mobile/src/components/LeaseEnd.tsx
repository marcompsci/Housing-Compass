/** Lease end date, with a reminder in My plan starting 90 days before. */
import { useState } from "react";
import { Text, View } from "react-native";
import { now } from "../config";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, type } from "../theme";
import { Field, formStyles, today } from "./forms";
import { Button, Section } from "./ui";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function LeaseEnd() {
  const { t } = useT();
  const leaseEnd = useRenter((s) => s.leaseEnd);
  const setLeaseEnd = useRenter((s) => s.setLeaseEnd);
  const [v, setV] = useState(leaseEnd ?? "");
  const [err, setErr] = useState<string | null>(null);
  const days = leaseEnd ? Math.round((Date.parse(`${leaseEnd}T12:00:00Z`) - Date.parse(`${today(now())}T12:00:00Z`)) / 86_400_000) : null;
  return (
    <Section title={t("le.title")}>
      <Text style={type.small}>{t("le.body")}</Text>
      {days !== null ? <Text style={[type.body, { fontWeight: "700", color: days <= 30 ? color.warn : color.ink }]} testID="lease-days">{days >= 0 ? t("le.days", { n: days, date: leaseEnd! }) : t("le.past", { date: leaseEnd! })}</Text> : null}
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Field label={t("le.field")} value={v} onChangeText={setV} autoCapitalize="none" placeholder="2027-06-30" testID="lease-end" />
        </View>
        <Button
          kind="secondary"
          label={t("rent.saveSetup")}
          testID="lease-save"
          onPress={() => {
            if (v.trim() && !isDate(v.trim())) return setErr(t("le.err"));
            setErr(null);
            setLeaseEnd(v.trim() || null);
          }}
        />
      </View>
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Text style={type.tiny}>{t("le.tip")}</Text>
    </Section>
  );
}
