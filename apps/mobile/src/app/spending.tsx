/**
 * Weekly spending: set a limit for day-to-day spending, log what you spend in a tap, see what's
 * left this week and how many weeks in a row you stayed under. Device-only.
 */
import { budgetProgress, roundUps, spendHabits, weeklyTotals, monthRecap, SPEND_CATEGORIES, spendsCsv, underLimitStreak, weeklyReview, weekSpending, type SpendCategory } from "@housing-compass/core";
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
  const [cat, setCat] = useState<SpendCategory>("food");
  const [undo, setUndo] = useState(false);
  const recap = monthRecap(r.spends, td.slice(0, 7));
  const weeks = weeklyTotals(r.spends, td, 8);
  const maxWeek = Math.max(1, ...weeks.map((x) => x.cents), r.weeklyLimitCents ?? 0);
  const budgets = budgetProgress(r.spends, r.categoryBudgets, td.slice(0, 7));
  const ru = roundUps(r.spends, r.roundedSpendIds);
  const habits = spendHabits(r.spends, td);
  const [bCat, setBCat] = useState<SpendCategory>("coffee");
  const [bAmt, setBAmt] = useState("");
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
          {SPEND_CATEGORIES.map((c) => (
            <Chip key={c} label={t(`spc.${c}`)} selected={cat === c} onPress={() => setCat(c)} />
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
        {r.favSpends.length ? (
          <View style={{ gap: 4 }} testID="fav-spends">
            <Text style={[type.small, { fontWeight: "700" }]}>{t("fav.title")}</Text>
            <View style={formStyles.row}>
              {r.favSpends.map((f, i) => (
                <Chip key={i} label={`${f.note || t(`spc.${f.category}`)} ${usd(f.amountCents)}`} onPress={() => (r.addSpend({ date: td, amountCents: f.amountCents, note: f.note, category: f.category }), setUndo(true))} />
              ))}
            </View>
          </View>
        ) : null}
        <Button
          icon="add-circle-outline"
          label={t("sp.add")}
          testID="sp-add"
          onPress={() => {
            const c = toCents(amount);
            if (!(c > 0)) return;
            r.addSpend({ date: td, amountCents: c, note: note.trim().slice(0, 60), category: cat });
            setUndo(true);
            setAmount("");
          }}
        />
        <View style={formStyles.row}>
          {undo && r.spends[0] ? <Button kind="ghost" icon="arrow-undo-outline" label={t("fav.undo", { amount: usd(r.spends[0].amountCents) })} onPress={() => (r.removeLastSpend(), setUndo(false))} testID="sp-undo" /> : null}
          {r.spends[0] ? <Button kind="ghost" icon="star-outline" label={t("fav.save")} onPress={() => r.addFavSpend({ amountCents: r.spends[0]!.amountCents, category: r.spends[0]!.category ?? "other", note: r.spends[0]!.note })} testID="fav-save" /> : null}
        </View>
        {r.spends.filter((s) => s.date >= w.weekStart).slice(0, 30).map((s) => (
          <View key={s.id} style={styles.row} testID="sp-row">
            <Text style={[type.small, { flex: 1 }]}>
              {s.date} · {t(`spc.${s.category ?? "other"}`)}
              {s.note ? ` · ${s.note}` : ""}
            </Text>
            <Text style={[type.small, { fontWeight: "700" }]}>{usd(s.amountCents)}</Text>
            <Pressable onPress={() => r.removeSpend(s.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: s.note || usd(s.amountCents) })} hitSlop={10}>
              <Icon name="trash-outline" size={16} tint={color.muted} />
            </Pressable>
          </View>
        ))}
      </Section>

      {r.spends.length ? (
        <Section title={t("wk.chart")}>
          <View style={styles.chart} testID="sp-chart" accessibilityLabel={t("wk.chart")}>
            {weeks.map((w) => (
              <View key={w.weekStart} style={styles.barWrap}>
                <Text style={styles.barTop}>{w.cents ? usd(w.cents) : ""}</Text>
                <View style={[styles.bar, { height: `${Math.max(2, Math.round((w.cents / maxWeek) * 100))}%`, backgroundColor: r.weeklyLimitCents && w.cents > r.weeklyLimitCents ? color.danger : color.brand }]} />
                <Text style={styles.barLabel}>{w.weekStart.slice(5)}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={t("cb.title")}>
        <Text style={type.small}>{t("cb.body")}</Text>
        {budgets.map((b) => (
          <View key={b.category} style={{ gap: 2 }} testID="cb-row">
            <Text style={[type.small, { fontWeight: "700", color: b.over ? color.danger : color.ink }]}>{t(b.over ? "cb.over" : "cb.line", { cat: t(`spc.${b.category}`), spent: usd(b.spentCents), budget: usd(b.budgetCents), amount: usd(Math.abs(b.leftCents)) })}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, b.pct)}%`, backgroundColor: b.over ? color.danger : b.pct > 80 ? color.warn : color.verified }]} />
            </View>
          </View>
        ))}
        <View style={formStyles.row}>
          {SPEND_CATEGORIES.map((c) => (
            <Chip key={c} label={t(`spc.${c}`)} selected={bCat === c} onPress={() => (setBCat(c), setBAmt(r.categoryBudgets[c] ? String(r.categoryBudgets[c]! / 100) : ""))} />
          ))}
        </View>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Field label={t("cb.field", { cat: t(`spc.${bCat}`) })} value={bAmt} onChangeText={setBAmt} keyboardType="decimal-pad" testID="cb-amount" />
          </View>
          <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => r.setCategoryBudget(bCat, toCents(bAmt) > 0 ? toCents(bAmt) : null)} testID="cb-save" />
        </View>
      </Section>

      {ru.pendingCents ? (
        <Section title={t("ru.title")}>
          <Text style={type.body} testID="ru-pending">{t("ru.body", { amount: usd(ru.pendingCents), n: ru.count })}</Text>
          {r.goals.length ? (
            <View style={formStyles.row}>
              {r.goals.slice(0, 4).map((g) => (
                <Button key={g.id} kind="secondary" icon="arrow-forward-circle-outline" label={t("ru.move", { goal: g.name })} onPress={() => (r.contribute(g.id, ru.pendingCents, td), r.markRoundUpsMoved(ru.ids))} testID="ru-move" />
              ))}
            </View>
          ) : (
            <Text style={type.tiny}>{t("ru.noGoal")}</Text>
          )}
        </Section>
      ) : null}

      {habits.length ? (
        <Section title={t("hb.title")}>
          {habits.slice(0, 4).map((h) => (
            <View key={h.category + h.note} style={{ gap: 2 }} testID="habit-row">
              <Text style={[type.small, { fontWeight: "700" }]}>{t("hb.line", { what: h.note || t(`spc.${h.category}`), n: h.perWeek, amount: usd(h.monthlyCents) })}</Text>
              <Text style={type.tiny}>{t("hb.half", { amount: usd(h.halfYearlyCents) })}</Text>
            </View>
          ))}
        </Section>
      ) : null}

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
      {recap.totalCents || recap.lastTotalCents ? (
        <Section title={t("rc.title", { month: recap.month })}>
          <View testID="sp-recap">
            <Text style={[type.body, { fontWeight: "800" }]}>{t("rc.total", { amount: usd(recap.totalCents), days: recap.spendDays })}</Text>
            {recap.lastTotalCents ? <Text style={[type.small, { color: recap.changeCents > 0 ? color.danger : color.verified }]}>{t(recap.changeCents > 0 ? "rc.more" : "rc.less", { amount: usd(Math.abs(recap.changeCents)) })}</Text> : null}
            {recap.rows.map((x) => (
              <View key={x.category} style={styles.row}>
                <Text style={[type.small, { flex: 1 }]}>{t(`spc.${x.category}`)}</Text>
                <Text style={[type.tiny, { color: color.muted }]}>{x.lastCents ? t("rc.last", { amount: usd(x.lastCents) }) : ""}</Text>
                <Text style={[type.small, { fontWeight: "700", width: 80, textAlign: "right" }]}>{usd(x.cents)}</Text>
              </View>
            ))}
          </View>
          <Button kind="secondary" icon="download-outline" label={t("rc.export")} onPress={() => void saveAndShare(`spending-${td}.csv`, spendsCsv(r.spends), "text/csv", "public.comma-separated-values-text")} testID="sp-export" />
        </Section>
      ) : null}
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  track: { height: 10, borderRadius: radius.md, backgroundColor: color.neutralSoft, overflow: "hidden" },
  fill: { height: "100%" },
  chart: { height: 130, flexDirection: "row", alignItems: "flex-end", gap: 6 },
  barWrap: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", gap: 2 },
  bar: { width: "70%", borderRadius: radius.sm },
  barTop: { fontSize: 9, color: "#5B6472" },
  barLabel: { fontSize: 9, color: "#5B6472" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
