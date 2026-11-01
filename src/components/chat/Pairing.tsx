import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, KeyRound, Loader2, RefreshCw, Settings, Share2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark, FloatingHearts } from "@/components/Hearts";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/auth";
import { normalizeInviteCode } from "@/lib/rules";

type Props = { roomId: string | null; onChanged: () => void };
type Active = { expires_at: string } | null;

export function Pairing({ roomId, onChanged }: Props) {
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [active, setActive] = useState<Active>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    supabase.rpc("active_invitation").then(({ data }) => setActive((data as Active) ?? null));
  }, [roomId, code]);

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key);
    try {
      return await fn();
    } catch (err) {
      toast.error(friendlyError(err));
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  const newCode = () =>
    run("code", async () => {
      if (!roomId) {
        const { error } = await supabase.rpc("create_room");
        if (error) throw error;
      }
      const { data, error } = await supabase.rpc("create_invitation");
      if (error) throw error;
      setCode(data as { code: string; expires_at: string });
      if (!roomId) onChanged();
    });

  const revoke = () =>
    run("revoke", async () => {
      const { error } = await supabase.rpc("revoke_invitations");
      if (error) throw error;
      setCode(null);
      setActive(null);
      toast.success("Code revoked. It can no longer be used.");
    });

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy. Long-press the code to copy it.");
    }
  }

  async function share() {
    if (!code) return;
    const text = `Join me on Just Us 💗 Our private code: ${code.code} (expires ${new Date(code.expires_at).toLocaleString()})`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Just Us", text });
      } catch {
        /* user cancelled */
      }
    } else copy();
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setJoinError(null);
    const norm = normalizeInviteCode(joinCode);
    if (!norm) return setJoinError("Codes look like JU-7K29-XP4M.");
    await run("join", async () => {
      const { error } = await supabase.rpc("join_room", { _code: norm });
      if (error) {
        setJoinError(friendlyError(error));
        return;
      }
      toast.success("You're paired 💞");
      onChanged();
    });
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-romance px-5 safe-top safe-bottom">
      <FloatingHearts />
      <header className="relative flex items-center justify-end pt-2">
        <Link to="/settings" aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-full text-primary">
          <Settings className="h-5 w-5" />
        </Link>
      </header>
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 pb-8">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={64} />
          <h1 className="mt-4 text-4xl font-semibold text-primary">{roomId ? "Waiting for your person" : "Your private space"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {roomId ? "Share your code. As soon as they join, your chat opens here." : "Create a room for two, or join the one your partner made."}
          </p>
        </div>

        <section className="rounded-3xl bg-card/85 p-5 shadow-soft backdrop-blur" aria-labelledby="invite-h">
          <h2 id="invite-h" className="text-xl font-semibold text-primary">Invite your partner</h2>
          {code ? (
            <div className="mt-3 space-y-3">
              <p
                className="select-all rounded-2xl bg-secondary/60 py-4 text-center font-mono text-2xl font-bold tracking-widest text-primary"
                aria-label={`Invitation code ${code.code.split("").join(" ")}`}
              >
                {code.code}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                Works once · expires {new Date(code.expires_at).toLocaleString()}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copy} className="flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card font-semibold text-primary">
                  <Copy className="h-4 w-4" /> Copy
                </button>
                <button onClick={share} className="flex h-11 items-center justify-center gap-2 rounded-full bg-heart font-semibold text-primary-foreground">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>
            </div>
          ) : active ? (
            <p className="mt-2 text-sm text-muted-foreground">
              A code is active until {new Date(active.expires_at).toLocaleString()}. For your safety it's only shown once — get a new one to see it again.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">You'll get a one-time code that expires in 24 hours.</p>
          )}
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={newCode}
              disabled={!!busy}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-heart font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {busy === "code" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {roomId ? (code || active ? "Get a new code" : "Get a code") : "Create our room"}
            </button>
            {(code || active) && (
              <button onClick={revoke} disabled={!!busy} className="flex h-10 items-center justify-center gap-2 text-sm font-semibold text-destructive disabled:opacity-60">
                {busy === "revoke" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Revoke code
              </button>
            )}
          </div>
        </section>

        <form onSubmit={join} className="rounded-3xl bg-card/85 p-5 shadow-soft backdrop-blur" aria-labelledby="join-h" noValidate>
          <h2 id="join-h" className="text-xl font-semibold text-primary">Have a code?</h2>
          <label htmlFor="join-code" className="sr-only">Invitation code</label>
          <Input
            id="join-code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="JU-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={20}
            className="mt-3 h-12 rounded-xl text-center font-mono text-lg tracking-widest"
          />
          {joinError && <p role="alert" className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{joinError}</p>}
          <button
            disabled={!!busy || !joinCode.trim()}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card font-semibold text-primary disabled:opacity-60"
          >
            {busy === "join" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Join
          </button>
          {roomId && <p className="mt-2 text-center text-xs text-muted-foreground">Joining replaces your empty room.</p>}
        </form>
      </div>
    </main>
  );
}
