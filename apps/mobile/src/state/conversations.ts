/**
 * Conversations with property managers. Server mode uses the conversations/messages/viewings
 * tables (guarded by Postgres triggers + RLS). Local demo mode only works for fictional DEMO
 * listings, stores threads on this device, and nobody replies — it exists to try the flow.
 * Both modes run the same messageGuard so masking/holds look identical.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { messageGuard, type Listing } from "@housing-compass/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { now } from "../config";
import { supabase } from "../data/supabase";
import { useSessionStore } from "../auth/session";
import { uuid } from "./applications";

export interface ThreadMessage { id: string; mine: boolean; body: string; held: boolean; holdReasons: string[]; masked: boolean; at: string }
export interface Tour { id: string; startsAt: string; mode: "in_person" | "live_video"; status: "proposed" | "confirmed" | "declined" | "cancelled" | "completed" }
export interface Thread {
  id: string;
  listingId: string;
  title: string;
  demo: boolean;
  messages: ThreadMessage[];
  tours: Tour[];
  createdAt: string;
  firstResponseAt: string | null;
}

export type ThreadStatus = "awaiting_reply" | "replied" | "tour_proposed" | "tour_confirmed";
export function threadStatus(t: Thread): ThreadStatus {
  if (t.tours.some((x) => x.status === "confirmed")) return "tour_confirmed";
  if (t.tours.some((x) => x.status === "proposed")) return "tour_proposed";
  return t.messages.some((m) => !m.mine) ? "replied" : "awaiting_reply";
}

interface ConvState {
  threads: Thread[];
  open(l: Listing): Promise<string>;
  send(threadId: string, text: string): Promise<ThreadMessage>;
  proposeTour(threadId: string, startsAt: string, mode: Tour["mode"]): Promise<void>;
}

export const canMessage = (l: Listing) =>
  !!l.managerId && l.status === "active" && (l.verification.level === "OFFICIAL_PORTAL" || l.verification.level === "PROPERTY_MANAGER_VERIFIED");

export const useConversations = create<ConvState>()(
  persist(
    (set, get) => ({
      threads: [],
      open: async (l) => {
        const existing = get().threads.find((t) => t.listingId === l.id);
        if (existing) return existing.id;
        let id = uuid();
        const session = useSessionStore.getState().session;
        if (!l.isDemo) {
          if (!supabase || !session) throw new Error("Sign in to message property managers.");
          const { data, error } = await supabase.from("conversations").insert({ listing_id: l.id, renter_id: session.user.id, manager_id: l.managerId }).select("id").single();
          if (error) throw new Error(error.code === "P0429" ? "You've started a lot of conversations today. Try again tomorrow." : "This listing can't receive messages right now.");
          id = data.id as string;
        }
        const t: Thread = { id, listingId: l.id, title: l.title, demo: l.isDemo, messages: [], tours: [], createdAt: now().toISOString(), firstResponseAt: null };
        set({ threads: [t, ...get().threads] });
        return id;
      },
      send: async (threadId, text) => {
        const t = get().threads.find((x) => x.id === threadId)!;
        const tourConfirmed = t.tours.some((x) => x.status === "confirmed");
        const g = messageGuard(text.trim().slice(0, 2000), { tourConfirmed });
        const msg: ThreadMessage = { id: uuid(), mine: true, body: g.body, held: g.held, holdReasons: g.holdReasons, masked: g.masked, at: now().toISOString() };
        if (!t.demo) {
          const session = useSessionStore.getState().session!;
          // Send the raw text: the database applies the same guard and is the source of truth.
          const { data, error } = await supabase!.from("messages").insert({ conversation_id: threadId, sender_id: session.user.id, body: text.trim().slice(0, 2000) }).select("id,body,held,hold_reason,masked,created_at").single();
          if (error) throw new Error(error.code === "P0429" ? "You're sending messages too quickly. Wait a bit." : "Message not sent. Try again.");
          Object.assign(msg, { id: data.id, body: data.body, held: data.held, holdReasons: data.hold_reason ? String(data.hold_reason).split(", ") : [], masked: data.masked, at: data.created_at });
        }
        set({ threads: get().threads.map((x) => (x.id === threadId ? { ...x, messages: [...x.messages, msg] } : x)) });
        return msg;
      },
      proposeTour: async (threadId, startsAt, mode) => {
        const t = get().threads.find((x) => x.id === threadId)!;
        const tour: Tour = { id: uuid(), startsAt, mode, status: "proposed" };
        if (!t.demo) {
          const session = useSessionStore.getState().session!;
          const { data, error } = await supabase!.from("viewings").insert({ conversation_id: threadId, proposed_by: session.user.id, starts_at: startsAt, mode }).select("id").single();
          if (error) throw new Error("Couldn't send the tour request.");
          tour.id = data.id as string;
        }
        set({ threads: get().threads.map((x) => (x.id === threadId ? { ...x, tours: [...x.tours, tour] } : x)) });
      },
    }),
    { name: "housing-compass-conversations-v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
