import type { Session } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { supabase } from "../data/supabase";
import { syncAccount, type SyncResult } from "../data/sync";
import { log } from "../lib/log";
import { useStore } from "../state/store";

interface SessionState {
  session: Session | null;
  lastSync: SyncResult | null;
  syncing: boolean;
  set(p: Partial<Omit<SessionState, "set">>): void;
}
export const useSessionStore = create<SessionState>((set) => ({ session: null, lastSync: null, syncing: false, set }));

export async function runSync() {
  const { session, set } = useSessionStore.getState();
  if (!supabase || !session) return;
  set({ syncing: true });
  try {
    set({ lastSync: await syncAccount(supabase, session.user.id) });
  } catch (e) {
    log.warn("sync failed", { message: (e as Error).message });
  } finally {
    set({ syncing: false });
  }
}

/** Mount once at the root: tracks auth state, syncs on sign-in, mirrors favorite toggles to the server. */
export function useAuthBootstrap() {
  const set = useSessionStore((s) => s.set);
  const session = useSessionStore((s) => s.session);
  const favorites = useStore((s) => s.favorites);
  const prev = useRef<string[] | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => set({ session: data.session }));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      set({ session: s });
      if (event === "SIGNED_IN") void runSync();
    });
    return () => data.subscription.unsubscribe();
  }, [set]);

  useEffect(() => {
    const before = prev.current;
    prev.current = favorites;
    if (!supabase || !session || !before) return;
    const added = favorites.filter((f) => !before.includes(f));
    const removed = before.filter((f) => !favorites.includes(f));
    if (added.length) void supabase.from("favorites").upsert(added.map((listing_id) => ({ user_id: session.user.id, listing_id })), { ignoreDuplicates: true });
    if (removed.length) void supabase.from("favorites").delete().in("listing_id", removed).eq("user_id", session.user.id);
  }, [favorites, session]);
}

export function useSession() {
  return useSessionStore((s) => s.session);
}

/** Email one-time code: works on iOS, Android and web without deep-link setup. */
export function useEmailOtp() {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return {
    stage,
    busy,
    error,
    async send(email: string) {
      if (!supabase) return;
      setBusy(true);
      setError("");
      const { error: e } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      setBusy(false);
      if (e) setError(e.status === 429 ? "Too many attempts. Wait a minute and try again." : "We couldn't send a code to that email.");
      else setStage("code");
    },
    async verify(email: string, token: string) {
      if (!supabase) return;
      setBusy(true);
      setError("");
      const { error: e } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
      setBusy(false);
      if (e) setError("That code didn't work. Check it, or request a new one.");
    },
    reset: () => setStage("email"),
  };
}
