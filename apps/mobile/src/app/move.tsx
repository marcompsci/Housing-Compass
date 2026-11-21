/**
 * Move in & move out: a dated, room-by-room condition record at move-in (the best defense
 * against unfair deposit deductions), then the 21-day deposit-return countdown and a factual
 * request letter at move-out. Device-only. General information, not legal advice.
 */
import { CA_RIGHTS, ROOMS, ROOM_ITEMS, conditionProgress, conditionReport, depositRequestLetter, depositReturnStatus, roomItemText, type Condition, type Room } from "@housing-compass/core";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, formStyles, toCents, today, usd } from "../components/forms";
import { Banner, Button, Chip, Section, Tag } from "../components/ui";
import { now } from "../config";
import { useT } from "../i18n";
import { saveAndShare } from "../lib/files";
import { openExternal } from "../lib/links";
import { useRenter } from "../state/renter";
import { LockGate } from "../lib/lock";
import { addConditionPhoto, deletePhotoFile, photosSupported } from "../lib/photos";
import { Icon } from "../components/ui";
import { color, space, type } from "../theme";

const CONDITIONS: Condition[] = ["good", "worn", "damaged"];
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function Photos({ k }: { k: string }) {
  const { t } = useT();
  const photos = useRenter((s) => s.photos[k]) ?? NO_PHOTOS;
  const addPhoto = useRenter((s) => s.addPhoto);
  const removePhoto = useRenter((s) => s.removePhoto);
  const [msg, setMsg] = useState<string | null>(null);
  if (!photosSupported) return null;
  const add = async (src: "camera" | "library") => {
    const r = await addConditionPhoto(src);
    if (r === "denied") setMsg(t("photo.denied"));
    else if (r) {
      addPhoto(k, r);
      setMsg(null);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      {photos.length ? (
        <View style={formStyles.row}>
          {photos.map((p) => (
            <View key={p.uri}>
              <Image source={{ uri: p.uri }} style={styles.thumb} accessibilityLabel={t("photo.taken", { date: p.at.slice(0, 10) })} />
              <Pressable
                onPress={() => {
                  removePhoto(k, p.uri);
                  deletePhotoFile(p.uri);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("photo.remove")}
                hitSlop={8}
                style={styles.thumbX}
              >
                <Icon name="close-circle" size={20} tint={color.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={formStyles.row}>
        <Chip icon="camera-outline" label={t("photo.take")} onPress={() => void add("camera")} />
        <Chip icon="images-outline" label={t("photo.pick")} onPress={() => void add("library")} />
      </View>
      {msg ? <Text style={type.tiny}>{msg}</Text> : null}
    </View>
  );
}
const NO_PHOTOS: Array<{ uri: string; at: string }> = [];

function ItemRow({ room, item }: { room: Room; item: string }) {
  const { t, locale } = useT();
  const entry = useRenter((s) => s.condition.find((c) => c.room === room && c.item === item));
  const record = useRenter((s) => s.recordCondition);
  const [note, setNote] = useState(entry?.note ?? "");
  const save = (condition: Condition, n = note) => record({ room, item, condition, note: n.trim().slice(0, 200), at: now().toISOString() });
  return (
    <View style={styles.item} testID="condition-item">
      <Text style={type.h3}>{roomItemText(item, locale)}</Text>
      <View style={formStyles.row}>
        {CONDITIONS.map((c) => (
          <Chip key={c} label={t(`move.c.${c}`)} selected={entry?.condition === c} onPress={() => save(c)} />
        ))}
      </View>
      {entry && entry.condition !== "good" ? (
        <Field label={t("move.whatsWrong")} value={note} onChangeText={setNote} onBlur={() => save(entry.condition)} placeholder={t("move.whatsWrongPh")} />
      ) : null}
      {entry && entry.condition !== "good" ? <Photos k={`${room}:${item}`} /> : null}
    </View>
  );
}

function MoveInSection() {
  const { t } = useT();
  const moveIn = useRenter((s) => s.moveIn);
  const setMoveIn = useRenter((s) => s.setMoveIn);
  const condition = useRenter((s) => s.condition);
  const [address, setAddress] = useState(moveIn?.address ?? "");
  const [date, setDate] = useState(moveIn?.moveInDate ?? today(now()));
  const [room, setRoom] = useState<Room>("entry");
  const [err, setErr] = useState<string | null>(null);
  if (!moveIn) {
    return (
      <Section title={t("move.inTitle")}>
        <Text style={type.small}>{t("move.inIntro")}</Text>
        <Field label={t("move.address")} value={address} onChangeText={setAddress} placeholder={t("move.addressPh")} testID="movein-address" />
        <Field label={t("move.inDate")} value={date} onChangeText={setDate} autoCapitalize="none" placeholder="2026-11-01" />
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="clipboard-outline"
          label={t("move.start")}
          testID="movein-start"
          onPress={() => {
            if (address.trim().length < 3) return setErr(t("move.errAddress"));
            if (!isDate(date)) return setErr(t("move.errDate"));
            setMoveIn({ address: address.trim().slice(0, 120), moveInDate: date });
          }}
        />
      </Section>
    );
  }
  const p = conditionProgress(condition);
  return (
    <Section title={t("move.inTitle")}>
      <Text style={type.small}>
        {moveIn.address} · {moveIn.moveInDate}
      </Text>
      <View style={formStyles.row}>
        <Tag label={t("move.progress", { done: p.done, total: p.total })} tone={p.done === p.total ? "good" : "neutral"} />
        {p.damaged ? <Tag label={t("move.damagedCount", { n: p.damaged })} tone="warn" /> : null}
      </View>
      <View style={formStyles.row} accessibilityRole="tablist">
        {ROOMS.map((r) => (
          <Chip key={r} label={t(`move.r.${r}`)} selected={room === r} onPress={() => setRoom(r)} />
        ))}
      </View>
      {ROOM_ITEMS[room].map((item) => (
        <ItemRow key={`${room}:${item}`} room={room} item={item} />
      ))}
      <Text style={type.tiny}>{t("move.photoTip")}</Text>
      <Button
        kind="secondary"
        icon="share-outline"
        label={t("move.exportRecord")}
        disabled={!condition.length}
        testID="movein-export"
        onPress={() => {
          const photos = useRenter.getState().photos;
          const withPhotos = condition.map((c) => {
            const ps = photos[`${c.room}:${c.item}`] ?? [];
            return ps.length ? { ...c, note: `${c.note}${c.note ? "; " : ""}${ps.length} photo${ps.length > 1 ? "s" : ""} on file (${ps.map((p) => p.at.slice(0, 10)).join(", ")})` } : c;
          });
          void saveAndShare(`move-in-record-${moveIn.moveInDate}.txt`, conditionReport(withPhotos, moveIn, now()), "text/plain", "public.plain-text");
        }}
      />
      <Button kind="ghost" icon="trash-outline" label={t("move.resetIn")} onPress={() => setMoveIn(null)} />
    </Section>
  );
}

function MoveOutSection() {
  const { t } = useT();
  const moveOut = useRenter((s) => s.moveOut);
  const setMoveOut = useRenter((s) => s.setMoveOut);
  const moveIn = useRenter((s) => s.moveIn);
  const [date, setDate] = useState(moveOut?.moveOutDate ?? "");
  const [deposit, setDeposit] = useState(moveOut ? String(moveOut.depositCents / 100) : "");
  const [fwd, setFwd] = useState(moveOut?.forwardingAddress ?? "");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const depositTopic = CA_RIGHTS.find((x) => x.id === "deposit");

  if (!moveOut) {
    return (
      <Section title={t("move.outTitle")}>
        <Text style={type.small}>{t("move.outIntro")}</Text>
        <Field label={t("move.outDate")} value={date} onChangeText={setDate} autoCapitalize="none" placeholder="2026-12-31" testID="moveout-date" />
        <Field label={t("move.deposit")} value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" placeholder="1400" testID="moveout-deposit" />
        <Field label={t("move.forwarding")} value={fwd} onChangeText={setFwd} hint={t("move.forwardingHint")} testID="moveout-forwarding" />
        {err ? <Text style={[type.small, { color: color.danger }]}>{err}</Text> : null}
        <Button
          icon="timer-outline"
          label={t("move.startCountdown")}
          testID="moveout-start"
          onPress={() => {
            const c = toCents(deposit);
            if (!isDate(date)) return setErr(t("move.errDate"));
            if (!(c >= 0 && c <= 5_000_000)) return setErr(t("move.errDeposit"));
            if (fwd.trim().length < 5) return setErr(t("move.errForwarding"));
            setMoveOut({ moveOutDate: date, depositCents: c, forwardingAddress: fwd.trim().slice(0, 200), requestSentOn: null });
          }}
        />
      </Section>
    );
  }
  const st = depositReturnStatus(moveOut.moveOutDate, now());
  return (
    <Section title={t("move.outTitle")}>
      <View style={[styles.countdown, st.state !== "waiting" && { borderColor: color.danger, backgroundColor: color.dangerSoft }]} testID="deposit-countdown">
        <Text style={type.small}>{t("move.dueBack", { amount: usd(moveOut.depositCents) })}</Text>
        <Text style={type.title}>{st.deadline}</Text>
        <Text style={[type.body, { fontWeight: "700", color: st.state === "overdue" ? color.danger : color.ink }]}>
          {st.state === "overdue" ? t("move.overdue", { n: -st.daysLeft }) : t("move.daysLeft", { n: st.daysLeft })}
        </Text>
      </View>
      <Text style={type.small}>{t("move.rulesBody")}</Text>
      {depositTopic ? <Button kind="ghost" icon="book-outline" label={`${depositTopic.source.label} ↗`} onPress={() => openExternal(depositTopic.source.url)} /> : null}
      <Field label={t("move.yourName")} value={name} onChangeText={setName} />
      <Button
        kind={st.state === "waiting" ? "secondary" : "primary"}
        icon="mail-outline"
        label={t("move.letter")}
        testID="deposit-letter"
        onPress={() => {
          const letter = depositRequestLetter({ tenantName: name.trim() || "[Your name]", address: moveIn?.address ?? "[Rental address]", moveOutDate: moveOut.moveOutDate, depositCents: moveOut.depositCents, forwardingAddress: moveOut.forwardingAddress });
          setMoveOut({ ...moveOut, requestSentOn: today(now()) });
          void saveAndShare(`deposit-request-${moveOut.moveOutDate}.txt`, letter, "text/plain", "public.plain-text");
        }}
      />
      {moveOut.requestSentOn ? <Text style={type.tiny}>{t("move.letterMade", { date: moveOut.requestSentOn })}</Text> : null}
      <Banner tone="info" icon="help-buoy-outline" title={t("move.helpTitle")}>
        {t("move.helpBody")}
      </Banner>
      <Button kind="ghost" icon="trash-outline" label={t("move.resetOut")} onPress={() => setMoveOut(null)} />
    </Section>
  );
}

export default function Move() {
  return (
    <LockGate>
      <MoveScreen />
    </LockGate>
  );
}

function MoveScreen() {
  const { t } = useT();
  return (
    <ScrollView contentContainerStyle={styles.wrap} testID="move">
      <Banner tone="info" icon="home-outline" title={t("move.title")}>
        {t("move.intro")}
      </Banner>
      <MoveInSection />
      <MoveOutSection />
      <Text style={type.tiny}>{t("move.footer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
  item: { gap: 6, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: color.neutralSoft },
  thumbX: { position: "absolute", top: -6, right: -6, backgroundColor: color.surface, borderRadius: 10 },
  countdown: { ...formStyles.card, borderWidth: 2, borderColor: color.brand },
});
