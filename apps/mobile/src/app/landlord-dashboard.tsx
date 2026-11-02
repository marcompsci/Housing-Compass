/**
 * Landlord / manager dashboard: your listings, their trust status, inquiry and tour counts,
 * a renter's-eye preview, the change history (audit trail) and photo pipeline status.
 * Server: my_manager_listings() + listing_audit_trail() (RLS: your listings only).
 * No server: a clearly labeled demo built from the fictional demo listings.
 */
import { LEVEL_LABEL, PHOTO_TYPES, RIGHTS_ATTESTATION, demoListings } from "@housing-compass/core";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSession } from "../auth/session";
import { Banner, Button, KV, Section, Tag } from "../components/ui";
import { EditRequestForm } from "../components/EditRequestForm";
import { config, now } from "../config";
import { supabase } from "../data/supabase";
import { shortDate } from "../lib/format";
import { threadStatus, useConversations } from "../state/conversations";
import { color, radius, space, type } from "../theme";

interface Row {
  id: string;
  title: string;
  status: string;
  level: keyof typeof LEVEL_LABEL;
  lastVerifiedAt: string | null;
  conversations: number;
  awaitingReply: number;
  toursProposed: number;
  toursConfirmed: number;
  photos?: Record<string, number>;
}
interface AuditRow { at: string; action: string; actor_kind: string; from_value: string | null; to_value: string | null; reason: string | null }

export default function LandlordDashboard() {
  const session = useSession();
  const threads = useConversations((s) => s.threads);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [mode, setMode] = useState<"server" | "demo" | "none">("none");
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [audit, setAudit] = useState<Record<string, AuditRow[]>>({});
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (supabase && session) {
          const { data, error: e } = await supabase.rpc("my_manager_listings");
          if (!alive) return;
          if (e) return setError("Couldn't load your listings.");
          const ids = (data ?? []).map((r: { id: string }) => r.id);
          const photos: Record<string, Record<string, number>> = {};
          if (ids.length) {
            const { data: ph } = await supabase.from("listing_photos").select("listing_id,status").in("listing_id", ids);
            for (const p of ph ?? []) {
              const m = (photos[p.listing_id as string] ??= {});
              m[p.status as string] = (m[p.status as string] ?? 0) + 1;
            }
          }
          setMode("server");
          setRows(
            (data ?? []).map((r: Record<string, unknown>) => ({
              id: r.id as string, title: r.title as string, status: r.status as string, level: r.verification_level as Row["level"], lastVerifiedAt: r.last_verified_at as string | null,
              conversations: Number(r.conversations), awaitingReply: Number(r.awaiting_reply), toursProposed: Number(r.tours_proposed), toursConfirmed: Number(r.tours_confirmed), photos: photos[r.id as string],
            })),
          );
          return;
        }
        if (config.demoMode) {
          const mine = demoListings(now()).filter((l) => l.managerId === "demo-manager");
          setMode("demo");
          setRows(
            mine.map((l) => {
              const ts = threads.filter((t) => t.listingId === l.id);
              return {
                id: l.id, title: l.title, status: l.status, level: l.verification.level, lastVerifiedAt: l.verification.lastVerifiedAt,
                conversations: ts.length, awaitingReply: ts.filter((t) => threadStatus(t) === "awaiting_reply").length,
                toursProposed: ts.flatMap((t) => t.tours).filter((x) => x.status === "proposed").length,
                toursConfirmed: ts.flatMap((t) => t.tours).filter((x) => x.status === "confirmed").length,
              };
            }),
          );
        } else {
          setMode("none");
          setRows([]);
        }
      })();
      return () => {
        alive = false;
      };
    }, [session, threads]),
  );

  const loadAudit = async (id: string) => {
    setOpen(open === id ? null : id);
    if (audit[id] || mode !== "server") return;
    const { data, error: e } = await supabase!.rpc("listing_audit_trail", { p_listing: id });
    if (e) return setError("Couldn't load the change history.");
    setAudit((a) => ({ ...a, [id]: (data as AuditRow[]) ?? [] }));
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="landlord-dashboard">
      {mode === "demo" ? (
        <Banner tone="demo" icon="flask-outline" title="Demo dashboard">
          These are fictional demo listings. Counts come from demo conversations on this device.
        </Banner>
      ) : null}
      {mode === "none" && rows ? (
        <Banner tone="info" icon="key-outline" title="No verified manager account yet">
          Apply to list first. Once a reviewer confirms your authority to rent, your listings appear here.
        </Banner>
      ) : null}
      {error ? <Banner tone="danger" icon="alert-circle-outline" title={error} /> : null}
      {rows?.length === 0 && mode === "server" ? <Text style={type.small}>No listings are linked to your manager account yet.</Text> : null}

      {rows?.map((r) => (
        <View key={r.id} style={styles.card} testID="dashboard-listing">
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Tag label={LEVEL_LABEL[r.level]} tone={r.level === "PROPERTY_MANAGER_VERIFIED" || r.level === "OFFICIAL_PORTAL" ? "good" : "warn"} />
            <Tag label={r.status} />
          </View>
          <Text style={type.h3}>{r.title}</Text>
          <KV k="Last verified" v={r.lastVerifiedAt ? shortDate(r.lastVerifiedAt) : "Never"} />
          <KV k="Conversations" v={`${r.conversations}${r.awaitingReply ? ` · ${r.awaitingReply} waiting for your reply` : ""}`} strong={r.awaitingReply > 0} />
          <KV k="Tours" v={`${r.toursProposed} requested · ${r.toursConfirmed} confirmed`} />
          {r.photos ? <KV k="Photos" v={Object.entries(r.photos).map(([k, n]) => `${n} ${k}`).join(" · ")} /> : null}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button kind="secondary" icon="eye-outline" label="Preview as renters see it" onPress={() => router.push(`/listing/${encodeURIComponent(r.id)}`)} />
            <Button kind="secondary" icon="create-outline" label={editing === r.id ? "Close" : "Request a change"} onPress={() => setEditing(editing === r.id ? null : r.id)} testID="request-change" />
            {mode === "server" ? <Button kind="ghost" icon="time-outline" label={open === r.id ? "Hide history" : "Change history"} onPress={() => void loadAudit(r.id)} /> : null}
          </View>
          {editing === r.id ? <EditRequestForm listingId={r.id} /> : null}
          {open === r.id
            ? (audit[r.id] ?? []).map((a, i) => (
                <Text key={i} style={type.tiny}>
                  {new Date(a.at).toLocaleString()} · {a.action.replace(/_/g, " ")}
                  {a.from_value || a.to_value ? ` · ${a.from_value ?? "—"} → ${a.to_value ?? "—"}` : ""}
                  {a.reason ? ` · ${a.reason}` : ""}
                </Text>
              ))
            : null}
        </View>
      ))}

      <Section title="Photos">
        <Text style={type.small}>Every photo goes to private storage first. It's scanned for malware and compared with photos on other listings before it can be published.</Text>
        <Text style={type.small}>Accepted: {PHOTO_TYPES.map((p) => p.replace("image/", "").toUpperCase()).join(", ")} · up to 10 MB · at least 400 px.</Text>
        <Text style={[type.small, { fontStyle: "italic" }]}>“{RIGHTS_ATTESTATION}”</Text>
        <Text style={type.tiny}>You'll confirm this for each photo. Photo upload opens in the app once the scanning service is connected; until then a reviewer can add photos you send through your private upload link.</Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, maxWidth: 760, width: "100%", alignSelf: "center" },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: 6, borderWidth: 1, borderColor: color.line },
});
