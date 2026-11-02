/**
 * Local reminders (rent due, tours). Scheduled ON THE DEVICE with the system notification
 * center: nothing is sent to our servers, and they work offline. Permission is asked only
 * when the user turns reminders on. On the web there are no scheduled notifications; the
 * "My plan" tab shows the same items instead.
 */
import { billReminders, billStatuses, reminderSchedule, type ReminderPlan } from "@housing-compass/core";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { now } from "../config";
import { useConversations } from "../state/conversations";
import { useRenter } from "../state/renter";
import { log } from "./log";

const PREFIX = "hc-reminder:";
export const remindersSupported = Platform.OS !== "web";

export async function askReminderPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  return req.granted;
}

export async function cancelAllReminders(): Promise<void> {
  if (!remindersSupported) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch (e) {
    log.warn("cancel reminders failed", { message: (e as Error).message });
  }
}

async function apply(plans: ReminderPlan[]): Promise<void> {
  await cancelAllReminders();
  for (const p of plans.slice(0, 40)) {
    await Notifications.scheduleNotificationAsync({
      identifier: PREFIX + p.id,
      content: { title: p.title, body: p.body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.at) },
    });
  }
}

export function currentReminderPlans(): ReminderPlan[] {
  const r = useRenter.getState();
  const tours = useConversations.getState().threads.flatMap((t) => t.tours.map((x) => ({ id: x.id, threadId: t.id, title: t.title, startsAt: x.startsAt, status: x.status })));
  const n = now();
  const offset = -n.getTimezoneOffset();
  const base = reminderSchedule({ rent: r.rentSetup ? { setup: r.rentSetup, payments: r.payments } : null, tours, now: n, utcOffsetMinutes: offset });
  return [...base, ...billReminders(billStatuses(r.bills, r.billPaid, n), n, offset)].sort((a, b) => a.at.localeCompare(b.at));
}

/** Keeps the scheduled reminders in step with rent, payments and tours. Mounted once in the root layout. */
export function useReminderSync() {
  const on = useRenter((s) => s.remindersOn);
  const setup = useRenter((s) => s.rentSetup);
  const payments = useRenter((s) => s.payments);
  const threads = useConversations((s) => s.threads);
  const bills = useRenter((s) => s.bills);
  const billPaid = useRenter((s) => s.billPaid);
  useEffect(() => {
    if (!remindersSupported) return;
    const id = setTimeout(() => {
      (on ? Notifications.getPermissionsAsync().then((p) => (p.granted ? apply(currentReminderPlans()) : undefined)) : cancelAllReminders()).catch((e: Error) =>
        log.warn("reminder sync failed", { message: e.message }),
      );
    }, 500);
    return () => clearTimeout(id);
  }, [on, setup, payments, threads, bills, billPaid]);
}
