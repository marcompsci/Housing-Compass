/**
 * Reviewer tabs added in v0.14: held messages, landlord applications, and the
 * research-lead expiry countdown. Decisions are validated by core before anything is sent,
 * and again by Postgres.
 */
import {
  AUTHORITY_CHECKS,
  AUTHORITY_CHECK_LABEL,
  HOLD_REASON_HELP,
  formatRent,
  leadExpiry,
  leadExpirySummary,
  neutralLanguageIssue,
  releaseNeedsSecondLook,
  type AuthorityCheckRecord,
  type LeadExpiry,
  type Listing,
} from "@housing-compass/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { now } from "../config";
import { openExternal } from "../lib/links";
import { decideEditRequest, decideHeld, decideLandlordApp, decideLead, type EditRequest, type HeldItem, type LandlordApp, type ReviewMode } from "../review/service";
import { describeEdit, feeChecks as costChecks } from "@housing-compass/core";
import { useListing } from "../data/hooks";
import { HIT, color, radius, space, type } from "../theme";
import { Banner, Button, Icon, Tag } from "./ui";

// ───────── Held messages ─────────
export function HeldTab({ mode, items, onDone }: { mode: ReviewMode; items: HeldItem[]; onDone(id: string): void }) {
  return (
    <View style={{ gap: space.md }}>
      <Text style={type.small}>
        These messages were stopped before reaching the other person. Release only when you're sure it's safe (e.g. the manager meant their official portal). Rejected messages stay hidden; the sender is not told the reason.
      </Text>
      {items.length === 0 ? <Text style={type.small}>No held messages. 🎉</Text> : null}
      {items.map((m) => (
        <HeldCard key={m.id} mode={mode} item={m} onDone={() => onDone(m.id)} />
      ))}
    </View>
  );
}

function HeldCard({ mode, item, onDone }: { mode: ReviewMode; item: HeldItem; onDone(): void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirmRelease, setConfirmRelease] = useState(false);
  const risky = releaseNeedsSecondLook(item.holdReasons);
  const act = async (d: "release" | "reject") => {
    if (d === "release" && risky && !confirmRelease) return setConfirmRelease(true);
    try {
      await decideHeld(mode, item, d, reason);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <View style={styles.item} testID="held-item">
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {item.demo ? <Tag label="DEMO" tone="demo" /> : null}
        <Tag label={item.fromRenter ? "From renter" : "From manager"} />
        {item.holdReasons.map((r) => (
          <Tag key={r} label={r} tone="warn" />
        ))}
      </View>
      <Text style={type.tiny}>{item.listingTitle} · {new Date(item.at).toLocaleString()}</Text>
      <Text style={[type.body, styles.quote]}>{item.body}</Text>
      {item.holdReasons.map((r) => (HOLD_REASON_HELP[r] ? <Text key={r} style={type.tiny}>• {HOLD_REASON_HELP[r]}</Text> : null))}
      <TextInput value={reason} onChangeText={(t) => { setReason(t); setError(""); }} placeholder="What you checked (e.g. 'Called office: deposit due at lease signing')" style={styles.input} accessibilityLabel="Reason for your decision" />
      {confirmRelease ? (
        <Banner tone="danger" icon="warning-outline" title="Release a payment or SSN request?">
          This is the pattern most rental scams use. Release only if you confirmed with the manager through an independently found contact. Tap Release again to confirm.
        </Banner>
      ) : null}
      {error ? <Text style={[type.tiny, { color: color.danger }]}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button kind="danger" label="Keep hidden" onPress={() => void act("reject")} disabled={!!neutralLanguageIssue(reason)} />
        <Button kind="secondary" label="Release" onPress={() => void act("release")} disabled={reason.trim().length < 15} />
      </View>
    </View>
  );
}

// ───────── Landlord applications ─────────
export function LandlordTab({ mode, apps, onDone }: { mode: ReviewMode; apps: LandlordApp[]; onDone(id: string): void }) {
  return (
    <View style={{ gap: space.md }}>
      <Text style={type.small}>
        Approve only after all four checks pass. Use contact details you find yourself (official website, county records, licensing boards) — never only what the applicant typed. Documents stay in private storage.
      </Text>
      {apps.length === 0 ? <Text style={type.small}>No open applications.</Text> : null}
      {apps.map((a) => (
        <LandlordCard key={a.id} mode={mode} app={a} onDone={() => onDone(a.id)} />
      ))}
    </View>
  );
}

function LandlordCard({ mode, app, onDone }: { mode: ReviewMode; app: LandlordApp; onDone(): void }) {
  const [checks, setChecks] = useState<AuthorityCheckRecord[]>(AUTHORITY_CHECKS.map((check) => ({ check, passed: false, note: "" })));
  const [notes, setNotes] = useState(app.reviewerNotes ?? "");
  const [error, setError] = useState("");
  const patch = (i: number, p: Partial<AuthorityCheckRecord>) => setChecks((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const act = async (d: "approve" | "needs_info" | "reject") => {
    try {
      await decideLandlordApp(mode, app, d, checks, notes);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <View style={styles.item} testID="landlord-item">
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {app.demo ? <Tag label="DEMO" tone="demo" /> : null}
        <Tag label={app.status === "needs_info" ? "Waiting on applicant" : "New"} tone={app.status === "needs_info" ? "warn" : "neutral"} />
      </View>
      <Text style={type.h3}>{app.companyName}</Text>
      <Text style={type.tiny}>
        Says: {app.officialWebsite ?? "no website"} · {app.officialPhone ?? "no phone"} · applied {new Date(app.createdAt).toLocaleDateString()}
      </Text>
      {app.propertyAddresses.map((p) => (
        <Text key={p} style={type.small}>• {p}</Text>
      ))}
      {checks.map((c, i) => (
        <View key={c.check} style={styles.check}>
          <Pressable onPress={() => patch(i, { passed: !c.passed })} accessibilityRole="checkbox" accessibilityState={{ checked: c.passed }} style={styles.checkHead}>
            <Icon name={c.passed ? "checkbox" : "square-outline"} size={22} tint={c.passed ? color.verified : color.sub} />
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{AUTHORITY_CHECK_LABEL[c.check].label}</Text>
              <Text style={type.tiny}>{AUTHORITY_CHECK_LABEL[c.check].help}</Text>
            </View>
          </Pressable>
          <TextInput value={c.note} onChangeText={(t) => patch(i, { note: t })} placeholder="Where you found / saw it" style={styles.input} accessibilityLabel={`Note for ${AUTHORITY_CHECK_LABEL[c.check].label}`} />
        </View>
      ))}
      <TextInput value={notes} onChangeText={(t) => { setNotes(t); setError(""); }} placeholder="Reviewer notes (shown to other reviewers)" multiline style={[styles.input, { minHeight: HIT * 1.5 }]} accessibilityLabel="Reviewer notes" />
      {error ? <Text style={[type.tiny, { color: color.danger }]}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button label="Approve" onPress={() => void act("approve")} disabled={!checks.every((c) => c.passed)} />
        <Button kind="secondary" label="Ask for more info" onPress={() => void act("needs_info")} />
        <Button kind="danger" label="Reject" onPress={() => void act("reject")} />
      </View>
    </View>
  );
}

// ───────── Research leads, most urgent first ─────────
const BUCKET_TEXT: Record<LeadExpiry["bucket"], string> = { expired: "Past due", this_week_urgent: "≤ 2 days", this_week: "This week", later: "Later" };

export function LeadExpiryTab({ mode, leads, onDone }: { mode: ReviewMode; leads: Listing[]; onDone(id: string): void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const q = leads.map((l) => leadExpiry(l, now())).sort((a, b) => a.daysLeft - b.daysLeft || a.listing.address.city.localeCompare(b.listing.address.city));
  const sum = leadExpirySummary(q);
  const decide = async (l: Listing, d: "source_found" | "reject") => {
    try {
      await decideLead(mode, l, d, reason);
      onDone(l.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.summary} testID="lead-expiry-summary">
        {(Object.keys(BUCKET_TEXT) as LeadExpiry["bucket"][]).map((b) => (
          <View key={b} style={{ alignItems: "center", flex: 1 }}>
            <Text style={[type.h2, { color: b === "expired" || b === "this_week_urgent" ? color.danger : color.ink }]}>{sum[b]}</Text>
            <Text style={type.tiny}>{BUCKET_TEXT[b]}</Text>
          </View>
        ))}
      </View>
      <Text style={type.small}>
        Unverified leads auto-hide 14 days after anyone last saw the ad. Open the source: if the ad is still posted at this price, mark “Still posted” (resets the clock; it does not verify the listing). If it's gone or different, reject it.
      </Text>
      <TextInput value={reason} onChangeText={(t) => { setReason(t); setError(""); }} placeholder="What you saw (e.g. 'Ad still up at $815 on Nov 3')" style={styles.input} accessibilityLabel="Lead decision reason" />
      {error ? <Text style={[type.tiny, { color: color.danger }]}>{error}</Text> : null}
      {q.slice(0, 60).map(({ listing: l, daysLeft, bucket }) => (
        <View key={l.id} style={styles.item} testID="lead-item">
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Tag label={daysLeft < 0 ? `${-daysLeft} days past due` : daysLeft === 0 ? "Hides today" : `${daysLeft} days left`} tone={bucket === "expired" || bucket === "this_week_urgent" ? "warn" : "neutral"} />
            <Tag label={l.address.city} />
          </View>
          <Text style={type.h3}>{l.title}</Text>
          <Text style={type.tiny}>
            {formatRent(l)} · {l.intake?.rawLabel}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {l.source.searchPageUrls[0] ? <Button kind="ghost" label="Open source ↗" onPress={() => openExternal(l.source.searchPageUrls[0]!)} /> : <Text style={type.tiny}>No source recorded — reject unless you can find it.</Text>}
            <Button kind="secondary" label="Still posted" disabled={!!neutralLanguageIssue(reason) || !l.source.searchPageUrls.length || l.verification.level !== "SOURCE_LISTED_UNVERIFIED"} onPress={() => void decide(l, "source_found")} />
            <Button kind="danger" label="Reject" disabled={!!neutralLanguageIssue(reason)} onPress={() => void decide(l, "reject")} />
          </View>
        </View>
      ))}
      {q.length > 60 ? <Text style={type.tiny}>Showing the 60 most urgent of {q.length}.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: 8, borderWidth: 1, borderColor: color.line },
  input: { minHeight: HIT, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: color.ink, backgroundColor: color.surface },
  quote: { padding: space.md, backgroundColor: color.neutralSoft, borderRadius: radius.md },
  check: { gap: 6, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  checkHead: { flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: HIT },
  summary: { flexDirection: "row", backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: color.line },
});

// ───────── Manager edit requests ─────────
export function EditsTab({ mode, items, onDone }: { mode: ReviewMode; items: EditRequest[]; onDone(id: string): void }) {
  return (
    <View style={{ gap: space.md }}>
      <Text style={type.small}>
        Managers ask to change rent, fees, move-in date or availability. Confirm with the manager through the contact on record before approving. Approving updates the listing and tells people who saved it about price changes.
      </Text>
      {items.length === 0 ? <Text style={type.small}>No change requests.</Text> : null}
      {items.map((r) => (
        <EditCard key={r.id} mode={mode} r={r} onDone={() => onDone(r.id)} />
      ))}
    </View>
  );
}

function EditCard({ mode, r, onDone }: { mode: ReviewMode; r: EditRequest; onDone(): void }) {
  const { listing: l } = useListing(r.listingId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const after = l ? costChecks({ address: l.address, pricing: { ...l.pricing, baseRentCents: r.changes.baseRentCents ?? l.pricing.baseRentCents, depositCents: r.changes.depositCents ?? l.pricing.depositCents, applicationFeeCents: r.changes.applicationFeeCents ?? l.pricing.applicationFeeCents } }) : [];
  const act = async (approve: boolean) => {
    try {
      await decideEditRequest(mode, r, approve, reason);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <View style={styles.item} testID="edit-item">
      <View style={{ flexDirection: "row", gap: 6 }}>
        {r.demo ? <Tag label="DEMO" tone="demo" /> : null}
        <Tag label={new Date(r.createdAt).toLocaleDateString()} />
      </View>
      <Text style={type.h3}>{l?.title ?? r.listingTitle}</Text>
      {l ? describeEdit(l, r.changes).map((d) => <Text key={d} style={type.body}>• {d}</Text>) : null}
      <Text style={[type.small, styles.quote]}>“{r.note}”</Text>
      {after.map((c) => (
        <Text key={c.code} style={[type.tiny, { color: color.warn }]}>⚠ {c.message}</Text>
      ))}
      <TextInput value={reason} onChangeText={(t) => { setReason(t); setError(""); }} placeholder="What you confirmed (e.g. 'Called office: new rent from Dec 1')" style={styles.input} accessibilityLabel="Reason for your decision on this change" />
      {error ? <Text style={[type.tiny, { color: color.danger }]}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Approve change" onPress={() => void act(true)} disabled={!!neutralLanguageIssue(reason)} />
        <Button kind="danger" label="Don't approve" onPress={() => void act(false)} disabled={!!neutralLanguageIssue(reason)} />
      </View>
    </View>
  );
}
