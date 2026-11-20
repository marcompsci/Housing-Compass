/**
 * Roommate split: share rent and bills equally or by agreed shares (for example by room size).
 * Nothing is saved; names stay on screen only.
 */
import { splitByShares } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, usd } from "../components/forms";
import { Banner, Button, KV, Section } from "../components/ui";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { space, type } from "../theme";

type P = { name: string; share: string };

export default function Split() {
  const { t } = useT();
  const rent = useRenter((s) => s.rentSetup);
  const bills = useRenter((s) => s.bills);
  const [total, setTotal] = useState(rent ? String((rent.amountCents + bills.filter((b) => b.category === "utilities" || b.category === "internet").reduce((s, b) => s + b.amountCents, 0)) / 100) : "");
  const [people, setPeople] = useState<P[]>([
    { name: "", share: "1" },
    { name: "", share: "1" },
  ]);
  const tc = toCents(total) || 0;
  const parts = splitByShares(tc, people.map((p) => Number(p.share)));
  const set = (i: number, k: keyof P, v: string) => setPeople(people.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="split">
      <Banner tone="info" icon="people-outline" title={t("split.title")}>
        {t("split.intro")}
      </Banner>
      <Field label={t("split.total")} value={total} onChangeText={setTotal} keyboardType="decimal-pad" hint={t("split.totalHint")} testID="split-total" />
      <Section title={t("split.people")}>
        {people.map((p, i) => (
          <View key={i} style={formStyles.row}>
            <View style={{ flex: 2, minWidth: 140 }}>
              <Field label={t("split.name", { n: i + 1 })} value={p.name} onChangeText={(v) => set(i, "name", v)} />
            </View>
            <View style={{ flex: 1, minWidth: 90 }}>
              <Field label={t("split.share")} value={p.share} onChangeText={(v) => set(i, "share", v)} keyboardType="decimal-pad" testID={`split-share-${i}`} />
            </View>
          </View>
        ))}
        <View style={formStyles.row}>
          <Button kind="ghost" icon="person-add-outline" label={t("split.add")} onPress={() => people.length < 8 && setPeople([...people, { name: "", share: "1" }])} testID="split-add" />
          {people.length > 2 ? <Button kind="ghost" icon="person-remove-outline" label={t("split.remove")} onPress={() => setPeople(people.slice(0, -1))} /> : null}
        </View>
        <Text style={type.tiny}>{t("split.shareHint")}</Text>
      </Section>
      {tc > 0 ? (
        <View style={formStyles.card} testID="split-result">
          {parts.map((c, i) => (
            <KV key={i} k={people[i]!.name.trim() || t("split.name", { n: i + 1 })} v={usd(c)} strong />
          ))}
          <Text style={type.tiny}>{t("split.exact")}</Text>
        </View>
      ) : null}
      <Button kind="secondary" icon="people-circle-outline" label={t("rm.fromSplit")} onPress={() => router.push("/roommates")} testID="split-roommates" />
      <Text style={type.tiny}>{t("split.footer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" } });
