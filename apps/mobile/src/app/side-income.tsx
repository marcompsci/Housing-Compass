/**
 * Side income: gig and freelance earnings, a mileage log at the IRS standard rate, a tax
 * set-aside and the quarterly estimated-tax due dates. Device-only. General information,
 * not tax advice.
 */
import { hourlyBySource, estimatedTaxDates, EXPENSE_CATEGORIES, IRS_MILEAGE_RATES, mileageRateFor, sideGoalProgress, sideIncomeSummary, sideProfit, type ExpenseCategory } from "@housing-compass/core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { openExternal } from "../lib/links";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, radius, space, type } from "../theme";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const ES_URL = "https://www.irs.gov/forms-pubs/about-form-1040-es";
const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export default function SideIncomeRoute() {
  return (
    <LockGate>
      <SideIncomeScreen />
    </LockGate>
  );
}

function SideIncomeScreen() {
  const { t } = useT();
  const r = useRenter();
  const n = now();
  const s = sideIncomeSummary(r.sideIncome, r.mileage, r.sideSetAsidePct, n);
  const pr = sideProfit({ income: r.sideIncome, miles: r.mileage, expenses: r.sideExpenses, setAsidePct: r.sideSetAsidePct, now: n });
  const goal = sideGoalProgress(r.sideIncome, r.sideGoalCents, n);
  const [hours, setHours] = useState("");
  const [goalText, setGoalText] = useState(r.sideGoalCents ? String(r.sideGoalCents / 100) : "");
  const [eCat, setECat] = useState<ExpenseCategory>("phone");
  const [eAmt, setEAmt] = useState("");
  const [eNote, setENote] = useState("");
  const [date, setDate] = useState(today(n));
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [mDate, setMDate] = useState(today(n));
  const [miles, setMiles] = useState("");
  const [purpose, setPurpose] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const sources = [...new Set(r.sideIncome.map((x) => x.source))].slice(0, 6);
  const year = n.getUTCFullYear();
  const dates = [...estimatedTaxDates(year - 1).slice(3), ...estimatedTaxDates(year)].filter((d) => d.due >= today(n)).slice(0, 4);
  const rate = mileageRateFor(today(n));

  const exportCsv = () => {
    const rows = [
      "type,date,source_or_purpose,amount_usd,miles,irs_rate_cents",
      ...r.sideIncome.map((x) => ["income", x.date, csvCell(x.source), (x.amountCents / 100).toFixed(2), "", ""].join(",")),
      ...r.mileage.map((m) => ["mileage", m.date, csvCell(m.purpose), "", String(m.miles), String(mileageRateFor(m.date) ?? "")].join(",")),
      ...r.sideExpenses.map((x) => ["expense", x.date, csvCell(`${x.category}${x.note ? `: ${x.note}` : ""}`), (x.amountCents / 100).toFixed(2), "", ""].join(",")),
    ];
    void saveAndShare(`side-income-${today(n)}.csv`, rows.join("\n"), "text/csv", "public.comma-separated-values-text");
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="side-income">
      <Banner tone="info" icon="car-outline" title={t("side.title")}>
        {t("side.intro")}
      </Banner>

      <View style={styles.tiles} testID="side-summary">
        <View style={styles.tile}>
          <Text style={type.tiny}>{t("side.month")}</Text>
          <Text style={type.h2}>{usd(s.earnedMonthCents)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={type.tiny}>{t("side.year", { year })}</Text>
          <Text style={type.h2} testID="side-year">{usd(s.earnedYearCents)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={type.tiny}>{t("side.mileageDed", { miles: s.milesYear })}</Text>
          <Text style={type.h2} testID="side-mileage">{usd(s.mileageDeductionCents)}</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: color.warnSoft }]}>
          <Text style={type.tiny}>{t("side.setAside", { pct: r.sideSetAsidePct })}</Text>
          <Text style={type.h2} testID="side-setaside">{usd(pr.setAsideCents)}</Text>
        </View>
        {pr.expensesCents ? (
          <View style={styles.tile}>
            <Text style={type.tiny}>{t("side.expensesTile")}</Text>
            <Text style={type.h2} testID="side-expenses">{usd(pr.expensesCents)}</Text>
          </View>
        ) : null}
        {pr.netHourlyCents !== null ? (
          <View style={styles.tile}>
            <Text style={type.tiny}>{t("side.hourly", { hours: pr.hours })}</Text>
            <Text style={type.h2} testID="side-hourly">{usd(pr.netHourlyCents)}/h</Text>
            <Text style={type.tiny}>{t("side.hourlyGross", { amount: usd(pr.grossHourlyCents ?? 0) })}</Text>
          </View>
        ) : null}
      </View>

      <Section title={t("side.goalTitle")}>
        {goal.goalCents ? (
          <View style={{ gap: 4 }} testID="side-goal">
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((goal.progress ?? 0) * 100)}%` }]} />
            </View>
            <Text style={[type.small, { fontWeight: "700" }]}>{t("side.goalLine", { earned: usd(goal.earnedCents), goal: usd(goal.goalCents) })}</Text>
            <Text style={type.tiny}>{goal.leftCents ? t("side.goalLeft", { left: usd(goal.leftCents), day: usd(goal.perDayCents ?? 0) }) : t("side.goalHit")}</Text>
          </View>
        ) : (
          <Text style={type.small}>{t("side.goalBody")}</Text>
        )}
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Field label={t("side.goalField")} value={goalText} onChangeText={setGoalText} keyboardType="decimal-pad" testID="side-goal-input" />
          </View>
          <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => r.setSideGoal(toCents(goalText) > 0 ? toCents(goalText) : null)} testID="side-goal-save" />
        </View>
      </Section>

      <Section title={t("side.taxTitle")}>
        <Text style={type.small}>{t("side.taxBody")}</Text>
        <View style={formStyles.row}>
          {[15, 20, 25, 30].map((p) => (
            <Chip key={p} label={`${p}%`} selected={r.sideSetAsidePct === p} onPress={() => r.setSideSetAsidePct(p)} />
          ))}
        </View>
        <Text style={[type.small, { fontWeight: "700" }]}>{t("side.datesTitle")}</Text>
        {dates.map((d) => (
          <KV key={d.due} k={t("side.quarterN", { q: d.quarter })} v={d.due} />
        ))}
        <Button kind="ghost" icon="open-outline" label="IRS Form 1040-ES ↗" onPress={() => openExternal(ES_URL)} />
      </Section>

      <Section title={t("side.addIncome")}>
        {sources.length ? (
          <View style={formStyles.row}>
            {sources.map((x) => (
              <Chip key={x} label={x} selected={source === x} onPress={() => setSource(x)} />
            ))}
          </View>
        ) : null}
        <Field label={t("side.source")} value={source} onChangeText={setSource} placeholder="Uber, DoorDash, tutoring…" testID="side-source" />
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("side.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="side-amount" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("side.date")} value={date} onChangeText={setDate} autoCapitalize="none" testID="side-date" />
          </View>
          <View style={{ flex: 1, minWidth: 100 }}>
            <Field label={t("side.hours")} value={hours} onChangeText={setHours} keyboardType="decimal-pad" testID="side-hours" />
          </View>
        </View>
        <Button
          icon="add-circle-outline"
          label={t("side.add")}
          testID="side-add"
          onPress={() => {
            const c = toCents(amount);
            if (source.trim().length < 2 || !(c > 0) || !isDate(date)) return setErr(t("side.err"));
            const h = Number(hours.replace(",", "."));
            r.addSideIncome({ date, source: source.trim().slice(0, 60), amountCents: c, ...(hours.trim() && h > 0 && h <= 744 ? { hours: Math.round(h * 10) / 10 } : {}) });
            setAmount("");
            setHours("");
            setErr(null);
          }}
        />
      </Section>

      <Section title={t("side.milesTitle")}>
        <Text style={type.small}>{rate ? t("side.rate", { rate }) : t("side.noRate")}</Text>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("side.miles")} value={miles} onChangeText={setMiles} keyboardType="decimal-pad" testID="side-miles" />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Field label={t("side.date")} value={mDate} onChangeText={setMDate} autoCapitalize="none" testID="side-mdate" />
          </View>
        </View>
        <Field label={t("side.purpose")} value={purpose} onChangeText={setPurpose} testID="side-purpose" />
        <Button
          kind="secondary"
          icon="speedometer-outline"
          label={t("side.logMiles")}
          testID="side-log-miles"
          onPress={() => {
            const m = Number(miles.replace(/,/g, ""));
            if (!(m > 0) || m > 5000 || !isDate(mDate)) return setErr(t("side.err"));
            r.addMileage({ date: mDate, miles: Math.round(m * 10) / 10, purpose: purpose.trim().slice(0, 80) || "Business" });
            setMiles("");
            setErr(null);
          }}
        />
        <Text style={type.tiny}>{t("side.milesNote")}</Text>
      </Section>
      <Section title={t("side.expTitle")}>
        <Text style={type.small}>{t("side.expBody")}</Text>
        <View style={formStyles.row}>
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip key={c} label={t(`side.exp.${c}`)} selected={eCat === c} onPress={() => setECat(c)} />
          ))}
        </View>
        <View style={formStyles.row}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Field label={t("side.amount")} value={eAmt} onChangeText={setEAmt} keyboardType="decimal-pad" testID="side-exp-amount" />
          </View>
          <View style={{ flex: 2, minWidth: 160 }}>
            <Field label={t("side.expNote")} value={eNote} onChangeText={setENote} testID="side-exp-note" />
          </View>
        </View>
        <Button
          kind="secondary"
          icon="receipt-outline"
          label={t("side.expAdd")}
          testID="side-exp-add"
          onPress={() => {
            const c = toCents(eAmt);
            if (!(c > 0)) return setErr(t("side.err"));
            r.addSideExpense({ date: today(n), category: eCat, amountCents: c, note: eNote.trim().slice(0, 80) });
            setEAmt("");
            setENote("");
            setErr(null);
          }}
        />
        {r.sideExpenses.slice(0, 10).map((x) => (
          <View key={x.id} style={styles.row} testID="side-exp-row">
            <Text style={[type.small, { flex: 1 }]}>
              {x.date} · {t(`side.exp.${x.category}`)}
              {x.note ? ` · ${x.note}` : ""}
            </Text>
            <Text style={[type.small, { fontWeight: "700" }]}>{usd(x.amountCents)}</Text>
            <Pressable onPress={() => r.removeSideExpense(x.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: x.note || t(`side.exp.${x.category}`) })} hitSlop={10}>
              <Icon name="trash-outline" size={18} tint={color.muted} />
            </Pressable>
          </View>
        ))}
      </Section>
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}

      {r.sideIncome.length || r.mileage.length ? (
        <Section title={t("side.recent")}>
          {[...r.sideIncome.map((x) => ({ id: x.id, date: x.date, label: x.source, v: usd(x.amountCents), kind: "i" as const })), ...r.mileage.map((m) => ({ id: m.id, date: m.date, label: m.purpose, v: t("side.milesShort", { n: m.miles }), kind: "m" as const }))]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 30)
            .map((x) => (
              <View key={x.id} style={styles.row} testID="side-entry">
                <Icon name={x.kind === "i" ? "cash-outline" : "car-outline"} size={18} tint={color.brand} />
                <Text style={[type.small, { flex: 1 }]}>
                  {x.date} · {x.label}
                </Text>
                <Text style={[type.small, { fontWeight: "700" }]}>{x.v}</Text>
                <Pressable onPress={() => (x.kind === "i" ? r.removeSideIncome(x.id) : r.removeMileage(x.id))} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: x.label })} hitSlop={10}>
                  <Icon name="trash-outline" size={18} tint={color.muted} />
                </Pressable>
              </View>
            ))}
          {s.bySource.length > 1 ? s.bySource.map((b) => <KV key={b.source} k={b.source} v={usd(b.cents)} />) : null}
          {hourlyBySource(r.sideIncome).length > 1 ? (
            <View testID="side-best">
              <Text style={[type.small, { fontWeight: "700" }]}>{t("bg.title", { source: hourlyBySource(r.sideIncome)[0]!.source })}</Text>
              {hourlyBySource(r.sideIncome).map((b) => (
                <KV key={b.source} k={`${b.source} (${b.hours} h)`} v={`${usd(b.perHourCents)}/h`} />
              ))}
            </View>
          ) : null}
          <Button kind="secondary" icon="download-outline" label={t("side.export")} onPress={exportCsv} testID="side-export" />
        </Section>
      ) : null}

      <View style={formStyles.row}>
        <Tag label={t("side.notTax")} />
      </View>
      <Text style={type.tiny}>{t("side.sources", { from: IRS_MILEAGE_RATES.map((x) => x.source).join(", ") })}</Text>
      <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: 150, padding: 12, borderRadius: radius.md, backgroundColor: color.brandSoft, gap: 2 },
  track: { height: 10, borderRadius: radius.md, backgroundColor: color.neutralSoft, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: color.verified },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
