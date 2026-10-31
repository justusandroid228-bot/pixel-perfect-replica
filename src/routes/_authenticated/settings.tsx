import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { friendlyError, siteUrl, useSession } from "@/lib/auth";
import { usePrefs, type Prefs } from "@/lib/prefs";
import { useRoom } from "@/lib/room";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Just Us" },
      { name: "description", content: "Your Just Us account, notifications and privacy." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const TOGGLES: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "in_app_notifications", label: "In-app notifications", hint: "A small alert when a message arrives while you're scrolled up." },
  { key: "sound_enabled", label: "Message sound", hint: "A soft chime for new messages while the app is open." },
  { key: "show_typing", label: "Share typing status", hint: "Let your partner see when you're typing." },
];

function SettingsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const room = useRoom(user?.id);
  const { prefs, update } = usePrefs(user?.id);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (room.me) setName(room.me.display_name);
  }, [room.me?.display_name]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => data && setName((n) => n || data.display_name));
    supabase.rpc("unread_count").then(({ data }) => setUnread(data ?? 0));
  }, [user]);

  async function saveName() {
    const n = name.trim().slice(0, 40);
    if (!n || !user) return toast.error("Your name can't be empty.");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: n, updated_at: new Date().toISOString() }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(friendlyError(error));
    else toast.success("Saved");
  }

  async function sendReset() {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${siteUrl()}/reset-password` });
    if (error) toast.error(friendlyError(error));
    else toast.success("Password reset link sent to your email.");
  }

  return (
    <main className="min-h-dvh bg-romance px-4 pb-10 safe-top safe-bottom">
      <header className="mx-auto flex max-w-lg items-center gap-2 py-2">
        <Link to="/chat" aria-label="Back to chat" className="relative grid h-11 w-11 place-items-center rounded-full text-primary">
          <ArrowLeft className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground" aria-label={`${unread} unread`}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <h1 className="text-3xl font-semibold text-primary">Settings</h1>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <section className="rounded-3xl bg-card/85 p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-primary">Your space</h2>
          {room.loading ? (
            <Loader2 className="mt-2 h-4 w-4 animate-spin text-primary" />
          ) : room.partner ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
              <Heart className="h-4 w-4 fill-rose text-rose" /> Paired with <strong>{room.partner.display_name}</strong> since {new Date(room.partner.joined_at).toLocaleDateString()}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{room.roomId ? "Your room is waiting for your partner to join." : "You're not paired yet."}</p>
          )}
        </section>

        <section className="space-y-3 rounded-3xl bg-card/85 p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-primary">Account</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="space-y-1.5">
            <Label htmlFor="display">What your partner sees</Label>
            <div className="flex gap-2">
              <Input id="display" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
              <button onClick={saveName} disabled={saving} className="h-11 shrink-0 rounded-full bg-heart px-5 font-semibold text-primary-foreground disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
          <button onClick={sendReset} className="text-sm font-semibold text-primary">Send me a password reset link</button>
        </section>

        <section className="rounded-3xl bg-card/85 p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-primary">Notifications & privacy</h2>
          <ul className="mt-2 divide-y divide-border">
            {TOGGLES.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <Label htmlFor={t.key} className="text-sm font-semibold">{t.label}</Label>
                  <p className="text-xs text-muted-foreground">{t.hint}</p>
                </div>
                <Switch
                  id={t.key}
                  checked={prefs[t.key]}
                  onCheckedChange={(v) => update({ [t.key]: v }).catch((e) => toast.error(friendlyError(e)))}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Push notifications when the app is closed aren't set up yet.</p>
        </section>

        <section className="rounded-3xl bg-card/85 p-5 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary"><ShieldCheck className="h-5 w-5" /> Privacy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only you and your partner can open your messages and media. Sent messages can't be edited or deleted. Messages are protected in transit and at rest but are not end-to-end encrypted.
          </p>
          <Link to="/privacy" className="mt-2 inline-block text-sm font-semibold text-primary">Read the full privacy notice</Link>
        </section>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth", search: { mode: "login" }, replace: true });
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card font-semibold text-destructive"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </main>
  );
}
