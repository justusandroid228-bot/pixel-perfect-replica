import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/auth";

export type Member = { user_id: string; joined_at: string; last_read_at: string; display_name: string };
type RoomState = { loading: boolean; roomId: string | null; members: Member[]; error: string | null };

/** The signed-in user's room (at most one) and its members, kept live. */
export function useRoom(userId: string | undefined) {
  const [state, setState] = useState<RoomState>({ loading: true, roomId: null, members: [], error: null });

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: mine, error } = await supabase.from("room_members").select("room_id").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (!mine) return setState({ loading: false, roomId: null, members: [], error: null });
      const { data: rows, error: e2 } = await supabase
        .from("room_members")
        .select("user_id, joined_at, last_read_at")
        .eq("room_id", mine.room_id);
      if (e2) throw e2;
      const ids = (rows ?? []).map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const names = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      setState({
        loading: false,
        roomId: mine.room_id,
        members: (rows ?? []).map((r) => ({ ...r, display_name: names.get(r.user_id) ?? "Love" })),
        error: null,
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: friendlyError(err) }));
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: partner joining, partner read position.
  useEffect(() => {
    if (!state.roomId) return;
    const channel = supabase
      .channel(`members-${state.roomId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${state.roomId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.roomId, load]);

  // While waiting alone, also re-check periodically (covers missed realtime events).
  useEffect(() => {
    if (!state.roomId || state.members.length >= 2) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [state.roomId, state.members.length, load]);

  const me = state.members.find((m) => m.user_id === userId);
  const partner = state.members.find((m) => m.user_id !== userId);
  return { ...state, me, partner, reload: load };
}
