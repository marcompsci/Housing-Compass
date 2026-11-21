/**
 * Bills & budget: the rest of the monthly bills next to rent, checked off as they're paid,
 * with a simple take-home budget and a calendar file of every due date. Device-only.
 */
import { BILL_CATEGORIES, BILL_SCRIPTS, partialKey, autopayChecklist, billPriceTrend, yearlyBillCost, billStatuses, dueDateSuggestions, hoursToCover, noteKey, paidThisMonth, subscriptionSavings, budgetSnapshot, buildIcs, dueDateEvents, validateBill, type BillCategory } from "@housing-compass/core";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, Icon, KV, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { LockGate } from "../lib/lock";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function PartialRow({ id, month, name, amountCents, paid }: { id: string; month: string; name: string; amountCents: number; paid: number }) {
  const { t } = useT();
  const setPartial = useRenter((s) => s.setBillPartial);
  const markPaid = useRenter((s) => s.markBillPaid);
  const [v, setV] = useState(paid ? String(paid / 100) : "");
  return (
    <View style={{ gap: 2 }} testID="partial-row">
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Field label={t("pp2.field", { name, amount: usd(amountCents) })} value={v} onChangeText={setV} keyboardType="decimal-pad" testID="partial-input" />
        </View>
        <Button
          kind="secondary"
          label={t("rent.saveSetup")}
          testID="partial-save"
          onPress={() => {
            const c = toCents(v);
            if (c >= amountCents) {
              setPartial(partialKey(id, month), null);
              markPaid(id, month);
            } else setPartial(partialKey(id, month), c > 0 ? c : null);
          }}
        />
      </View>
      {paid ? <Text style={type.tiny} testID="partial-left">{t("pp2.left", { paid: usd(paid), left: usd(amountCents - paid) })}</Text> : null}
    </View>
  );
}

function PayInfoRow({ id, name, value }: { id: string; name: string; value: string }) {
  const { t } = useT();
  const save = useRenter((s) => s.setBillPayInfo);
  const [v, setV] = useState(value);
  return (
    <View style={formStyles.row} testID="payinfo-row">
      <View style={{ flex: 1, minWidth: 180 }}>
        <Field label={name} value={v} onChangeText={setV} placeholder={t("pi.ph")} testID="payinfo-input" />
      </View>
      <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => save(id, v)} testID="payinfo-save" />
    </View>
  );
}

function ProofRow({ id, month, name, amount, note }: { id: string; month: string; name: string; amount: string; note: string }) {
  const { t } = useT();
  const setNote = useRenter((s) => s.setBillNote);
  const [v, setV] = useState(note);
  return (
    <View style={{ gap: 4 }} testID="proof-row">
      <Text style={[type.small, { fontWeight: "700" }]}>
        {name} · {amount}
      </Text>
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Field label={t("pp.conf")} value={v} onChangeText={setV} placeholder={t("pp.confPh")} testID="proof-input" />
        </View>
        <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => setNote(noteKey(id, month), v)} testID="proof-save" />
      </View>
    </View>
  );
}

function AddBill() {
  const { t } = useT();
  const add = useRenter((s) => s.addBill);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [cat, setCat] = useState<BillCategory>("utilities");
  const [autopay, setAutopay] = useState(false);
  const [promo, setPromo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Section title={t("bills.addTitle")}>
      <Field label={t("bills.name")} value={name} onChangeText={setName} placeholder={t("bills.namePh")} testID="bill-name" />
      <View style={formStyles.row}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("bills.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="bill-amount" />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={t("rent.dueDay")} value={day} onChangeText={setDay} keyboardType="number-pad" testID="bill-day" />
        </View>
      </View>
      <View style={formStyles.row}>
        {BILL_CATEGORIES.map((c) => (
          <Chip key={c} label={t(`bills.c.${c}`)} selected={cat === c} onPress={() => setCat(c)} />
        ))}
      </View>
      <Chip icon={autopay ? "checkbox-outline" : "square-outline"} label={t("bills.autopay")} selected={autopay} onPress={() => setAutopay(!autopay)} />
      <Field label={t("bp.field")} value={promo} onChangeText={setPromo} autoCapitalize="none" placeholder="2027-03-01" hint={t("bp.hint")} testID="bill-promo" />
      {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
      <Button
        icon="add-circle-outline"
        label={t("bills.add")}
        testID="bill-add"
        onPress={() => {
          const b = { name: name.trim().slice(0, 60), amountCents: toCents(amount), dueDay: Number(day), category: cat, autopay };
          const e = validateBill(b);
          if (e) return setErr(e);
          if (promo.trim() && !(/^\d{4}-\d{2}-\d{2}$/.test(promo.trim()) && !Number.isNaN(Date.parse(promo.trim())))) return setErr(t("bp.err"));
          add({ ...b, ...(promo.trim() ? { promoEnds: promo.trim() } : {}) });
          setPromo("");
          setName("");
          setAmount("");
          setDay("");
          setAutopay(false);
          setErr(null);
        }}
      />
    </Section>
  );
}

export default function Bills() {
  const { t } = useT();
  const r = useRenter();
  const [tipsFor, setTipsFor] = useState<string | null>(null);
  const n = now();
  const month = today(n).slice(0, 7);
  const statuses = billStatuses(r.bills, r.billPaid, n);
  const [takeHome, setTakeHome] = useState(r.takeHomeCents ? String(r.takeHomeCents / 100) : "");
  const [wage, setWage] = useState(r.hourlyCents ? String(r.hourlyCents / 100) : "");
  const budget = r.takeHomeCents ? budgetSnapshot(r.takeHomeCents, r.rentSetup?.amountCents ?? 0, r.bills) : null;
  const stateTag = (s: (typeof statuses)[number]) =>
    s.state === "paid" ? <Tag label={t("bills.paid")} tone="good" /> : s.state === "overdue" ? <Tag label={t("rent.lateBy", { n: -s.daysUntilDue })} tone="warn" /> : s.state === "due_soon" ? <Tag label={s.daysUntilDue === 0 ? t("rent.dueToday") : t("rent.dueIn", { n: s.daysUntilDue })} tone="warn" /> : null;

  return (
    <LockGate>
      <ScrollView contentContainerStyle={styles.wrap} testID="bills">
        <Banner tone="info" icon="receipt-outline" title={t("bills.title")}>
          {t("bills.intro")}
        </Banner>

        {(() => {
          const sug = dueDateSuggestions(r.bills, r.pay, now());
          if (!sug.length) return null;
          return (
            <Section title={t("dd.title")}>
              <Text style={type.small}>{t("dd.body")}</Text>
              {sug.map((x) => (
                <View key={x.billId} style={formStyles.row} testID="due-suggestion">
                  <Icon name="swap-horizontal-outline" size={18} tint={color.brand} />
                  <Text style={[type.small, { flex: 1 }]}>{t("dd.line", { name: x.name, from: x.currentDay, to: x.suggestedDay })}</Text>
                </View>
              ))}
              <Text style={type.tiny}>{t("dd.note")}</Text>
            </Section>
          );
        })()}

        <Section title={t("bills.thisMonth")}>
          {r.rentSetup ? (
            <Pressable style={styles.row} onPress={() => router.push("/rent")} accessibilityRole="button">
              <Icon name="home-outline" tint={color.brand} />
              <Text style={[type.h3, { flex: 1 }]}>{t("bills.rentRow", { amount: usd(r.rentSetup.amountCents), day: r.rentSetup.dueDay })}</Text>
              <Icon name="chevron-forward" tint={color.muted} />
            </Pressable>
          ) : null}
          {statuses.length === 0 ? <Text style={type.small}>{t("bills.none")}</Text> : null}
          {statuses.map((s) => {
            const paid = s.paidThisMonth;
            return (
              <View key={s.bill.id}>
              <View style={styles.row} testID="bill-row">
                <Pressable
                  onPress={() => r.toggleBillPaid(s.bill.id, month)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: paid }}
                  accessibilityLabel={t("bills.markPaid", { name: s.bill.name })}
                  hitSlop={8}
                  testID="bill-paid"
                >
                  <Icon name={paid ? "checkmark-circle" : "ellipse-outline"} size={24} tint={paid ? color.verified : color.muted} />
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.h3, paid && { color: color.muted }]}>
                    {s.bill.name} · {usd(s.bill.amountCents)}
                  </Text>
                  <Text style={type.tiny}>
                    {t(`bills.c.${s.bill.category}`)} · {t("bills.dueOn", { date: s.nextDue })}
                    {s.bill.autopay ? ` · ${t("bills.autopayShort")}` : ""}
                    {billPriceTrend(r.billHistory, s.bill) ? ` · ${t("bh.trend", { from: usd(billPriceTrend(r.billHistory, s.bill)!.firstCents), pct: billPriceTrend(r.billHistory, s.bill)!.pct })}` : ""}
                    {r.billPayInfo[s.bill.id] ? ` · ${t("pi.short", { info: r.billPayInfo[s.bill.id]! })}` : ""}
                    {s.bill.promoEnds ? ` · ${t("bp.ends", { date: s.bill.promoEnds })}` : ""}
                    {r.hourlyCents ? ` · ${t("hrs.short", { n: hoursToCover(s.bill.amountCents, r.hourlyCents) ?? 0 })}` : ""}
                  </Text>
                </View>
                {s.bill.category === "subscription" ? (
                  <Pressable onPress={() => r.toggleUnusedSub(s.bill.id)} accessibilityRole="checkbox" accessibilityState={{ checked: r.unusedSubs.includes(s.bill.id) }} accessibilityLabel={t("sub.notUsing", { name: s.bill.name })} hitSlop={8} testID="sub-unused">
                    <Tag label={r.unusedSubs.includes(s.bill.id) ? t("sub.cancel") : t("sub.using")} tone={r.unusedSubs.includes(s.bill.id) ? "warn" : "neutral"} />
                  </Pressable>
                ) : null}
                {stateTag(s)}
                <Pressable onPress={() => setTipsFor(tipsFor === s.bill.id ? null : s.bill.id)} accessibilityRole="button" accessibilityLabel={t("tips.for", { name: s.bill.name })} hitSlop={8} testID="bill-tips">
                  <Icon name="bulb-outline" tint={tipsFor === s.bill.id ? color.brand : color.muted} />
                </Pressable>
                <Pressable onPress={() => r.removeBill(s.bill.id)} accessibilityRole="button" accessibilityLabel={t("bills.remove", { name: s.bill.name })} hitSlop={10}>
                  <Icon name="trash-outline" tint={color.muted} />
                </Pressable>
              </View>
              {tipsFor === s.bill.id ? (
                <View style={styles.tips} testID="bill-tips-box">
                  <Text style={[type.small, { fontWeight: "700" }]}>{t("tips.title")}</Text>
                  {BILL_SCRIPTS[s.bill.category].map((x) => (
                    <Text key={x} style={type.small}>
                      • {x}
                    </Text>
                  ))}
                  <Button kind="ghost" icon="mail-outline" label={t("tips.letter")} onPress={() => router.push("/letters")} />
                </View>
              ) : null}
              </View>
            );
          })}
          {r.bills.length || r.rentSetup ? (
            <Button
              kind="secondary"
              icon="calendar-outline"
              label={t("bills.calendar")}
              testID="bills-calendar"
              onPress={() => void saveAndShare("housing-compass-due-dates.ics", buildIcs(dueDateEvents(r.rentSetup, r.bills, n), n), "text/calendar", "com.apple.ical.ics")}
            />
          ) : null}
          {(() => {
            const sv = subscriptionSavings(r.bills, r.unusedSubs);
            return sv.subscriptions ? (
              <View style={styles.subBox} testID="sub-savings">
                <Text style={type.small}>{t("sub.total", { n: sv.subscriptions, amount: usd(sv.monthlyAllCents), year: usd(sv.monthlyAllCents * 12) })}</Text>
                {sv.cutMonthlyCents ? <Text style={[type.small, { fontWeight: "800", color: color.verified }]}>{t("sub.save", { amount: usd(sv.cutYearlyCents) })}</Text> : <Text style={type.tiny}>{t("sub.hint")}</Text>}
              </View>
            ) : null;
          })()}
          <Text style={type.tiny}>{t("bills.remindersNote")}</Text>
        </Section>

        <AddBill />

        <Section title={t("hrs.title")}>
          <Text style={type.small}>{t("hrs.body")}</Text>
          <View style={formStyles.row}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Field label={t("hrs.wage")} value={wage} onChangeText={setWage} keyboardType="decimal-pad" testID="hourly-wage" />
            </View>
            <Button kind="secondary" label={t("rent.saveSetup")} onPress={() => r.setHourly(toCents(wage) > 0 ? toCents(wage) : null)} testID="hourly-save" />
          </View>
          {r.hourlyCents && r.rentSetup ? <Text style={[type.small, { fontWeight: "700" }]} testID="rent-hours">{t("hrs.rent", { n: hoursToCover(r.rentSetup.amountCents, r.hourlyCents) ?? 0 })}</Text> : null}
        </Section>

        <Banner tone="warn" icon="alert-circle-outline" title={t("scam.billTitle")}>
          {t("scam.billBody")}
        </Banner>
        <Button kind="secondary" icon="trophy-outline" label={t("win.fromBills")} onPress={() => router.push("/wins")} testID="bills-wins" />

        <Section title={t("bills.budgetTitle")}>
          <Field label={t("bills.takeHome")} value={takeHome} onChangeText={setTakeHome} keyboardType="decimal-pad" hint={t("bills.takeHomeHint")} testID="take-home" />
          <Button
            kind="secondary"
            label={t("rent.saveSetup")}
            testID="take-home-save"
            onPress={() => {
              const c = toCents(takeHome);
              r.setTakeHome(c > 0 ? c : null);
            }}
          />
          {budget ? (
            <View style={{ gap: 4 }} testID="budget">
              <KV k={t("bills.income")} v={usd(budget.incomeCents)} />
              <KV k={t("bills.rent")} v={`${usd(budget.rentCents)} · ${pct(budget.rentShare)}`} />
              <KV k={t("bills.otherBills")} v={usd(budget.billsCents)} />
              <KV k={t("bills.leftover")} v={usd(budget.leftoverCents)} strong />
              <Text style={[type.small, { color: budget.status === "ok" ? color.verified : color.danger, fontWeight: "700" }]}>{t(`bills.status.${budget.status}`)}</Text>
              {budget.rentShare !== null && budget.rentShare > 0.3 ? <Text style={type.tiny}>{t("bills.over30")}</Text> : null}
            </View>
          ) : null}
        </Section>

        {(() => {
          const month = today(now()).slice(0, 7);
          const unpaid = r.bills.filter((b) => !(r.billPaid[b.id] ?? []).includes(month));
          if (!unpaid.length) return null;
          return (
            <Section title={t("pp2.title")}>
              <Text style={type.small}>{t("pp2.body")}</Text>
              {unpaid.slice(0, 10).map((b) => (
                <PartialRow key={b.id} id={b.id} month={month} name={b.name} amountCents={b.amountCents} paid={r.billPartial[partialKey(b.id, month)] ?? 0} />
              ))}
            </Section>
          );
        })()}

        {(() => {
          const month = today(now()).slice(0, 7);
          const paid = paidThisMonth(r.bills, r.billPaid, r.billNotes, month);
          if (!paid.length) return null;
          return (
            <Section title={t("pp.title")}>
              <Text style={type.small}>{t("pp.body")}</Text>
              {paid.map((p) => (
                <ProofRow key={p.id} id={p.id} month={month} name={p.name} amount={usd(p.amountCents)} note={p.note} />
              ))}
            </Section>
          );
        })()}

        {r.bills.length ? (
          <Section title={t("pi.title")}>
            <Text style={type.small}>{t("pi.body")}</Text>
            {r.bills.slice(0, 12).map((b) => (
              <PayInfoRow key={b.id} id={b.id} name={b.name} value={r.billPayInfo[b.id] ?? ""} />
            ))}
            <Text style={type.tiny}>{t("pi.noSecrets")}</Text>
          </Section>
        ) : null}

        {r.bills.length ? (
          <Section title={t("yc.title", { amount: usd(yearlyBillCost(r.bills).totalCents) })}>
            <View testID="yearly-cost">
              {yearlyBillCost(r.bills).rows.slice(0, 8).map((x) => (
                <KV key={x.id} k={x.name} v={t("yc.line", { amount: usd(x.yearlyCents) })} />
              ))}
            </View>
          </Section>
        ) : null}

        {(() => {
          const a = autopayChecklist(r.bills);
          if (!a.off.length) return null;
          return (
            <Section title={t("ap.title", { on: a.onCount, total: a.total })}>
              <Text style={type.small}>{t("ap.body")}</Text>
              {a.off.slice(0, 8).map((b) => (
                <View key={b.id} style={formStyles.row} testID="autopay-off">
                  <Icon name="square-outline" size={18} tint={color.muted} />
                  <Text style={[type.small, { flex: 1 }]}>{t("ap.line", { name: b.name, day: b.dueDay })}</Text>
                </View>
              ))}
            </Section>
          );
        })()}

        <Button kind="ghost" icon="trending-up-outline" label={t("inc.link")} onPress={() => router.push("/rent-increase")} />
        <Text style={type.tiny}>{t("rent.deviceOnly")}</Text>
      </ScrollView>
    </LockGate>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  tips: { padding: 10, borderRadius: 10, backgroundColor: color.neutralSoft, gap: 4, marginBottom: 6 },
  subBox: { padding: 10, borderRadius: 10, backgroundColor: color.brandSoft, gap: 4 },
  row: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
