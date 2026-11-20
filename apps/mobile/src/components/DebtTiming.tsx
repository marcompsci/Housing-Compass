/** Card timing for one debt: statement closing day and promo-rate end, with what to pay and when. */
import { promoPlan, statementTiming, type Debt } from "@housing-compass/core";
import { useState } from "react";
import { Text, View } from "react-native";
import { now } from "../config";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, type } from "../theme";
import { Field, formStyles, today, usd } from "./forms";
import { Button } from "./ui";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function DebtTiming({ debt }: { debt: Debt }) {
  const { t } = useT();
  const update = useRenter((s) => s.updateDebt);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(debt.statementDay ? String(debt.statementDay) : "");
  const [promo, setPromo] = useState(debt.promoEnds ?? "");
  const [err, setErr] = useState<string | null>(null);
  const td = today(now());
  const st = statementTiming(debt, td);
  const pr = promoPlan(debt, td);
  return (
    <View style={{ gap: 4 }}>
      {st ? (
        <Text style={type.tiny} testID="debt-statement">
          {t("card.payBy", { payBy: st.payBy, closes: st.closes })}
        </Text>
      ) : null}
      {pr ? (
        <Text style={[type.tiny, { color: pr.ended ? color.danger : color.ink, fontWeight: "700" }]} testID="debt-promo">
          {pr.ended ? t("card.promoEnded", { date: pr.promoEnds }) : t("card.promo", { date: pr.promoEnds, amount: usd(pr.perMonthCents ?? 0), n: pr.monthsLeft })}
        </Text>
      ) : null}
      {open ? (
        <View style={formStyles.card}>
          <View style={formStyles.row}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Field label={t("card.statementDay")} value={day} onChangeText={setDay} keyboardType="number-pad" testID="debt-stmt-day" />
            </View>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Field label={t("card.promoEnds")} value={promo} onChangeText={setPromo} autoCapitalize="none" placeholder="2027-06-30" testID="debt-promo-ends" />
            </View>
          </View>
          {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
          <Button
            kind="secondary"
            label={t("rent.saveSetup")}
            testID="debt-timing-save"
            onPress={() => {
              const d = Number(day);
              if ((day.trim() && !(Number.isInteger(d) && d >= 1 && d <= 31)) || (promo.trim() && !isDate(promo.trim()))) return setErr(t("card.err"));
              update(debt.id, { statementDay: day.trim() ? d : undefined, promoEnds: promo.trim() || undefined });
              setErr(null);
              setOpen(false);
            }}
          />
        </View>
      ) : (
        <Button kind="ghost" icon="calendar-outline" label={t("card.edit")} onPress={() => setOpen(true)} testID="debt-timing-edit" />
      )}
    </View>
  );
}
