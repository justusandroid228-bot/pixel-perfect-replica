import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Prefs = { sound_enabled: boolean; in_app_notifications: boolean; show_typing: boolean };
const DEFAULTS: Prefs = { sound_enabled: true, in_app_notifications: true, show_typing: true };

export function usePrefs(userId: string | undefined) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from("user_preferences")
      .select("sound_enabled, in_app_notifications, show_typing")
      .eq("user_id", userId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!alive) return;
        if (data) setPrefs(data);
        else await supabase.from("user_preferences").insert({ user_id: userId });
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const update = useCallback(
    async (patch: Partial<Prefs>) => {
      if (!userId) return;
      const prev = prefs;
      setPrefs({ ...prefs, ...patch });
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, ...prefs, ...patch, updated_at: new Date().toISOString() });
      if (error) {
        setPrefs(prev);
        throw error;
      }
    },
    [userId, prefs],
  );

  return { prefs, loaded, update };
}

let ctx: AudioContext | null = null;
/** A soft two-note chime, generated (no audio files). */
export function playChime() {
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + i * 0.12);
      g.gain.linearRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.35);
      o.connect(g).connect(ctx!.destination);
      o.start(now + i * 0.12);
      o.stop(now + i * 0.12 + 0.4);
    });
  } catch {
    /* audio unavailable */
  }
}
