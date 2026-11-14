import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Hearts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Just Us" },
      { name: "description", content: "Choose a new password for your Just Us account." },
      { property: "og:title", content: "Set a new password — Just Us" },
      { property: "og:description", content: "Choose a new password for your Just Us account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      if (d.session && isRecovery) setReady(true);
      else if (d.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    navigate({ to: "/chat", replace: true });
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-romance px-6">
      <BrandMark size={56} />
      <h1 className="mt-4 text-4xl font-semibold text-primary">New password</h1>
      {!ready ? (
        <p className="mt-6 max-w-xs text-center text-sm text-muted-foreground">Open this page from the reset link in your email. If the link expired, request a new one from the login screen.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 w-full max-w-sm space-y-4 rounded-3xl bg-card/80 p-6 shadow-soft">
          <div className="space-y-1.5">
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" className="h-12 rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-heart font-semibold text-primary-foreground disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save password
          </button>
        </form>
      )}
    </main>
  );
}
