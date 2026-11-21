/** Pay frequency, take-home per paycheck and a real payday. Used by Quick setup and the Paycheck planner. */
import { validatePaySetup, type PayFrequency } from "@housing-compass/core";
import { useState } from "react";
import { Text, View } from "react-native";
import { now } from "../config";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, type } from "../theme";
import { Field, formStyles, toCents, today } from "./forms";
import { Button, Chip } from "./ui";

const FREQS: PayFrequency[] = ["weekly", "biweekly", "semimonthly", "monthly"];

export function PaySetupForm({ onSaved }: { onSaved?: () => void }) {
  const { t } = useT();
  const cur = useRenter((s) => s.pay);
  const setPay = useRenter((s) => s.setPay);
  const [freq, setFreq] = useState<PayFrequency>(cur?.frequency ?? "biweekly");
  const [amount, setAmount] = useState(cur ? String(cur.amountCents / 100) : "");
  const [anchor, setAnchor] = useState(cur?.anchorDate ?? today(now()));
  const [err, setErr] = useState<string | null>(null);
  return (
    <View style={{ gap: 10 }}>
      <Text style={[type.small, { fontWeight: "600", color: color.ink }]}>{t("pay.freq")}</Text>
      <View style={formStyles.row}>
        {FREQS.map((f) => (
          <Chip key={f} label={t(`pay.f.${f}`)} selected={freq === f} onPress={() => setFreq(f)} />
        ))}
      </View>
      <Field label={t("pay.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" hint={t("pay.amountHint")} testID="pay-amount-in" />
      <Field label={freq === "semimonthly" ? t("pay.anchorSemi") : t("pay.anchor")} value={anchor} onChangeText={setAnchor} autoCapitalize="none" testID="pay-anchor" />
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Button
        label={t("rent.saveSetup")}
        testID="pay-save"
        onPress={() => {
          const p = { frequency: freq, amountCents: toCents(amount), anchorDate: anchor.trim() };
          const e = validatePaySetup(p);
          if (e) return setErr(e);
          setErr(null);
          setPay(p);
          onSaved?.();
        }}
      />
    </View>
  );
}

