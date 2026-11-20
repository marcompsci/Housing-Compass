/**
 * Reports I sent, and what happened to them. Signed in: the server's status (RLS: own reports
 * only). Device-only: reports saved here, waiting to be sent.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSession } from "../auth/session";
import { Banner, Tag } from "../components/ui";
import { supabase } from "../data/supabase";
import { useT, type TFn } from "../i18n";
import { shortDate } from "../lib/format";
import { useStore } from "../state/store";
import { color, radius, space, type } from "../theme";

type Status = "local" | "open" | "triaged" | "actioned" | "dismissed";
interface Row { id: string; listingId: string; reason: string; status: Status; at: string; resolvedAt: string | null }

const STATUS_KEY = {
  local: ["rs.local", "rs.localBody"],
  open: ["rs.open", "rs.openBody"],
  triaged: ["rs.triaged", "rs.triagedBody"],
  actioned: ["rs.actioned", "rs.actionedBody"],
  dismissed: ["rs.dismissed", "rs.dismissedBody"],
} as const;

function statusText(t: TFn, s: Status) {
  const [a, b] = STATUS_KEY[s];
  return { label: t(a), detail: t(b) };
}

export default function MyReports() {
  const { t } = useT();
  const session = useSession();
  const local = useStore((s) => s.reports);
  const [server, setServer] = useState<Row[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!supabase || !session) return setServer(null);
      let alive = true;
      void supabase
        .from("reports")
        .select("id,listing_id,reason,status,created_at,resolved_at")
        .order("created_at", { ascending: false })
        .limit(100)
        .then(({ data }) => {
          if (alive) setServer((data ?? []).map((r) => ({ id: r.id as string, listingId: r.listing_id as string, reason: r.reason as string, status: r.status as Status, at: r.created_at as string, resolvedAt: r.resolved_at as string | null })));
        });
      return () => {
        alive = false;
      };
    }, [session]),
  );

  const pending: Row[] = local.filter((r) => !r.syncedAt).map((r) => ({ id: r.id, listingId: r.listingId, reason: r.reason, status: "local", at: r.createdAt, resolvedAt: null }));
  const rows = [...pending, ...(server ?? local.filter((r) => r.syncedAt).map((r) => ({ id: r.id, listingId: r.listingId, reason: r.reason, status: "open" as Status, at: r.createdAt, resolvedAt: null })))];

  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="my-reports">
      <Text style={type.small}>{t("rs.intro")}</Text>
      {rows.length === 0 ? <Banner tone="info" icon="flag-outline" title={t("rs.none")} /> : null}
      {rows.map((r) => {
        const st = statusText(t, r.status);
        return (
          <Pressable key={r.id} style={styles.item} onPress={() => router.push(`/listing/${encodeURIComponent(r.listingId)}`)} accessibilityRole="button" testID="report-row">
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Tag label={st.label} tone={r.status === "actioned" ? "good" : r.status === "local" ? "warn" : "neutral"} />
              <Tag label={r.reason.replace(/_/g, " ")} />
            </View>
            <Text style={type.small}>{st.detail}</Text>
            <Text style={type.tiny}>
              {t("rs.sent", { date: shortDate(r.at) })}
              {r.resolvedAt ? ` · ${t("rs.decided", { date: shortDate(r.resolvedAt) })}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, maxWidth: 640, width: "100%", alignSelf: "center" },
  item: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: 6, borderWidth: 1, borderColor: color.line },
});
