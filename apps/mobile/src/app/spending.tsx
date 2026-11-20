/**
 * Weekly spending: set a limit for day-to-day spending, log what you spend in a tap, see what's
 * left this week and how many weeks in a row you stayed under. Device-only.
 */
import { underLimitStreak, weeklyReview, weekSpending } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

export default function SpendingRoute() {
  return (
    <LockGate>
      <Spending />
    </LockGate>
  );
}

function Spending() {
  const { t } = useT();
  const r = useRenter();
  const td = today(now());
  const w = weekSpending(r.spends, r.weeklyLimitCents, td);
  const streak = underLimitStreak(r.spends, r.weeklyLimitCents, td);
  const review = weeklyReview({ today: td, spends: r.spends, limitCents: r.weeklyLimitCents, side: r.sideIncome, billPaid: r.billPaid, bills: r.bills });
  const [limit, setLimit] = useState(r.weeklyLimitCents ? String(r.weeklyLimitCents / 100) : "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const quick = [t("sp.q.food"), t("sp.q.coffee"), t("sp.q.gas"), t("sp.q.fun")];
  const pct = r.weeklyLimitCents ? Math.min(100, Math.round((w.spentCents / r.weeklyLimitCents) * 100)) : 0;
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="spending">
      <Banner tone="info" icon="cart-outline" title={t("sp.title")}>
        {t("sp.intro")}
      </Banner>
      <View style={[formStyles.card, w.over && { borderColor: color.danger, backgroundColor: color.dangerSoft }]} testID="sp-week">
        <Text style={type.tiny}>{t("sp.weekOf", { date: w.weekStart })}</Text>
        <Text style={[type.title, w.over && { color: color.danger }]}>{w.leftCents === null ? usd(w.spentCents) : w.over ? t("sp.over", { amount: usd(-w.leftCents) }) : t("sp.left", { amount: usd(w.leftCents) })}</Text>
        {r.weeklyLimitCents ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: w.over ? color.danger : pct > 80 ? color.warn : color.verified }]} />
            </View>
            <Text style={type.small}>{t("sp.line", { spent: usd(w.spentCents), limit: usd(r.weeklyLimitCents), day: usd(w.perDayLeftCents ?? 0), n: w.daysLeft })}</Text>
          </>
        ) : (
          <Text style={type.small}>{t("sp.noLimit")}</Text>
        )}
        {streak ? <Tag label={t("sp.streak", { n: streak })} tone="good" /> : null}
      </View>

      <Section title={t("sp.log")}>
        <View style={formStyles.row}>
          {quick.map((q) => (
            <Chip key={q} label={q} selected={note === q} onPress={() => setNote(q)} />
          ))}
        </View>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("side.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="sp-amount" />
          </View>
          <View style={{ flex: 2, minWidth: 160 }}>
            <Field label={t("sp.note")} value={note} onChangeText={setNote} testID="sp-note" />
          </View>
        </View>
        <Button
          icon="add-circle-outline"
          label={t("sp.add")}
          testID="sp-add"
          onPress={() => {
            const c = toCents(amount);
            if (!(c > 0)) return;
            r.addSpend({ date: td, amountCents: c, note: note.trim().slice(0, 60) });
            setAmount("");
          }}
        />
        {r.spends.filter((s) => s.date >= w.weekStart).slice(0, 30).map((s) => (
          <View key={s.id} style={styles.row} testID="sp-row">
            <Text style={[type.small, { flex: 1 }]}>
              {s.date}
              {s.note ? ` · ${s.note}` : ""}
            </Text>
            <Text style={[type.small, { fontWeight: "700" }]}>{usd(s.amountCents)}</Text>
            <Pressable onPress={() => r.removeSpend(s.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: s.note || usd(s.amountCents) })} hitSlop={10}>
              <Icon name="trash-outline" size={16} tint={color.muted} />
            </Pressable>
          </View>
        ))}
      </Section>

      <Section title={t("sp.limitTitle")}>
        <Text style={type.small}>{t("sp.limitBody")}</Text>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Field label={t("sp.limit")} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" testID="sp-limit" />
          </View>
          <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => r.setWeeklyLimit(toCents(limit) > 0 ? toCents(limit) : null)} testID="sp-limit-save" />
        </View>
      </Section>

      <Section title={t("sp.review")}>
        <Text style={type.body} testID="sp-review">
          {review.text}
        </Text>
        <Button kind="secondary" icon="share-outline" label={t("yir.share")} onPress={() => void saveAndShare(`week-${review.weekStart}.txt`, review.text, "text/plain", "public.plain-text")} />
      </Section>
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  track: { height: 10, borderRadius: radius.md, backgroundColor: color.neutralSoft, overflow: "hidden" },
  fill: { height: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
