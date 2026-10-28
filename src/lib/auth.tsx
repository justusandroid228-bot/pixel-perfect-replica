import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const user: User | null = session?.user ?? null;
  return { session, user, loading };
}

/** Where email links (confirm signup, reset password) should land. Native builds have no web origin. */
export function siteUrl() {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined;
  if (typeof window === "undefined") return configured ?? "";
  const isNative = window.location.protocol === "capacitor:" || window.location.hostname === "localhost" && !!(window as unknown as { Capacitor?: unknown }).Capacitor;
  if (isNative && configured) return configured.replace(/\/+$/, "");
  return window.location.origin;
}

export function friendlyError(err: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You're offline. Check your connection and try again.";
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Couldn't reach the server. Please try again.";
  if (/JWT|session/i.test(msg) && /expired|invalid/i.test(msg)) return "Your session expired. Please sign in again.";
  return msg.replace(/^.*?ERROR:\s*/, "");
}
