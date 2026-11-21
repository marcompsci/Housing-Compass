/** One-off money in — a tax refund, a gift, a bonus — counted in the month's cash flow and report. */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { now } from "../config";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, type } from "../theme";
import { Field, formStyles, toCents, today, usd } from "./forms";
import { Button, Chip, Icon, Section } from "./ui";

export function OtherIncomeForm() {
  const { t } = useT();
  const list = useRenter((s) => s.otherIncome);
  const add = useRenter((s) => s.addOtherIncome);
  const remove = useRenter((s) => s.removeOtherIncome);
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const presets = [t("oi.p.refund"), t("oi.p.gift"), t("oi.p.bonus"), t("oi.p.sold")];
  return (
    <Section title={t("oi.title")}>
      <Text style={type.small}>{t("oi.body")}</Text>
      <View style={formStyles.row}>
        {presets.map((p) => (
          <Chip key={p} label={p} selected={source === p} onPress={() => setSource(p)} />
        ))}
      </View>
      <View style={formStyles.row}>
        <View style={{ flex: 2, minWidth: 150 }}>
          <Field label={t("oi.source")} value={source} onChangeText={setSource} testID="oi-source" />
        </View>
        <View style={{ flex: 1, minWidth: 110 }}>
          <Field label={t("side.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="oi-amount" />
        </View>
      </View>
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Button
        kind="secondary"
        icon="add-circle-outline"
        label={t("oi.add")}
        testID="oi-add"
        onPress={() => {
          const c = toCents(amount);
          if (source.trim().length < 2 || !(c > 0)) return setErr(t("side.err"));
          add({ date: today(now()), source: source.trim().slice(0, 60), amountCents: c });
          setAmount("");
          setErr(null);
        }}
      />
      {list.slice(0, 10).map((x) => (
        <View key={x.id} style={formStyles.row} testID="oi-row">
          <Text style={[type.small, { flex: 1 }]}>
            {x.date} · {x.source}
          </Text>
          <Text style={[type.small, { fontWeight: "700" }]}>{usd(x.amountCents)}</Text>
          <Pressable onPress={() => remove(x.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: x.source })} hitSlop={10}>
            <Icon name="trash-outline" size={16} tint={color.muted} />
          </Pressable>
        </View>
      ))}
    </Section>
  );
}
