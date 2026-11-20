import AsyncStorage from "@react-native-async-storage/async-storage";
import { moveApplication, type ApplicationStatus, type Listing, type TrackedApplication } from "@housing-compass/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { now } from "../config";
import { supabase } from "../data/supabase";
import { useSessionStore } from "../auth/session";
import { log } from "../lib/log";

/** RFC 4122 v4-shaped id (not security sensitive); doubles as the server row id. */
export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface AppsState {
  items: TrackedApplication[];
  track(l: Listing): string;
  move(id: string, to: ApplicationStatus): void;
  update(id: string, p: Partial<Pick<TrackedApplication, "notes" | "nextActionAt" | "deadline">>): void;
  remove(id: string): void;
}

async function mirror(a: TrackedApplication | { id: string; deleted: true }) {
  const session = useSessionStore.getState().session;
  if (!supabase || !session) return;
  if ("deleted" in a) {
    await supabase.from("applications").delete().eq("id", a.id);
    return;
  }
  const isDemo = a.listingId?.startsWith("demo-");
  const { error } = await supabase.from("applications").upsert({
    id: a.id, user_id: session.user.id, listing_id: isDemo ? null : a.listingId, title: a.title, status: a.status, deadline: a.deadline,
    next_action_at: a.nextActionAt, notes: a.notes, history: a.history, applied_at: a.history.find((h) => h.status === "applied")?.at ?? null,
  });
  if (error) log.warn("application sync failed", { code: error.code });
}

export const useApplications = create<AppsState>()(
  persist(
    (set, get) => ({
      items: [],
      track: (l) => {
        const existing = get().items.find((a) => a.listingId === l.id);
        if (existing) return existing.id;
        const at = now().toISOString();
        const a: TrackedApplication = { id: uuid(), listingId: l.id, title: l.title, status: "interested", deadline: l.eligibility.applicationDeadline, nextActionAt: null, notes: "", history: [{ status: "interested", at }], updatedAt: at };
        set({ items: [a, ...get().items] });
        void mirror(a);
        return a.id;
      },
      move: (id, to) => {
        const items = get().items.map((a) => (a.id === id ? moveApplication(a, to, now()) : a));
        set({ items });
        const a = items.find((x) => x.id === id);
        if (a) void mirror(a);
      },
      update: (id, p) => {
        const items = get().items.map((a) => (a.id === id ? { ...a, ...p, notes: (p.notes ?? a.notes).slice(0, 4000), updatedAt: now().toISOString() } : a));
        set({ items });
        const a = items.find((x) => x.id === id);
        if (a) void mirror(a);
      },
      remove: (id) => {
        set({ items: get().items.filter((a) => a.id !== id) });
        void mirror({ id, deleted: true });
      },
    }),
    { name: "housing-compass-applications-v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
