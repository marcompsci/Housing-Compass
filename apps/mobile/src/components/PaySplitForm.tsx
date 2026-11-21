/** Paycheck split: percentages of each check for bills, savings, debt and spending, with the dollar amounts. */
import { splitPaycheck } from "@housing-compass/core";
import { useState } from "react";
import { Text, View } from "react-native";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, type } from "../theme";
import { Field, formStyles, usd } from "./forms";
import { Button, Chip, KV, Section } from "./ui";

const PRESETS = [
  { id: "50/20/10/20", v: { bills: 50, savings: 20, debt: 10, spending: 20 } },
  { id: "60/10/10/20", v: { bills: 60, savings: 10, debt: 10, spending: 20 } },
  { id: "50/30/0/20", v: { bills: 50, savings: 30, debt: 0, spending: 20 } },
];

export function PaySplitForm() {
  const { t } = useT();
  const pay = useRenter((s) => s.pay);
  const split = useRenter((s) => s.paySplit);
  const setSplit = useRenter((s) => s.setPaySplit);
  const [v, setV] = useState(split ?? PRESETS[0]!.v);
  const total = v.bills + v.savings + v.debt + v.spending;
  const res = pay ? splitPaycheck(pay.amountCents, v) : null;
  const keys = ["bills", "savings", "debt", "spending"] as const;
  return (
    <Section title={t("ps.title")}>
      <Text style={type.small}>{t("ps.body")}</Text>
      <View style={formStyles.row}>
        {PRESETS.map((p) => (
          <Chip key={p.id} label={p.id} selected={JSON.stringify(p.v) === JSON.stringify(v)} onPress={() => setV(p.v)} />
        ))}
      </View>
      <View style={formStyles.row}>
        {keys.map((k) => (
          <View key={k} style={{ flex: 1, minWidth: 90 }}>
            <Field label={`${t(`ps.${k}`)} %`} value={String(v[k])} onChangeText={(x) => setV({ ...v, [k]: Math.max(0, Math.min(100, Math.round(Number(x) || 0))) })} keyboardType="number-pad" testID={`ps-${k}`} />
          </View>
        ))}
      </View>
      <Text style={[type.small, { color: total === 100 ? color.verified : color.warn, fontWeight: "700" }]}>{t("ps.total", { n: total })}</Text>
      {res ? (
        <View testID="ps-amounts">
          {keys.map((k) => (
            <KV key={k} k={t(`ps.${k}`)} v={usd(res.rows[k])} />
          ))}
        </View>
      ) : (
        <Text style={type.tiny}>{t("ask.a.noPay")}</Text>
      )}
      <View style={formStyles.row}>
        <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => setSplit(v)} testID="ps-save" />
        {split ? <Button kind="ghost" label={t("dg.off")} onPress={() => setSplit(null)} /> : null}
      </View>
    </Section>
  );
}
