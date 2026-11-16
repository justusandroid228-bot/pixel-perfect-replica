import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Hearts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError, siteUrl, useSession } from "@/lib/auth";

type Mode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({
    mode: s["mode"] === "signup" || s["mode"] === "forgot" ? s["mode"] : "login",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Just Us" },
      { name: "description", content: "Sign in or create your private Just Us account." },
      { property: "og:title", content: "Sign in — Just Us" },
      { property: "og:description", content: "Sign in or create your private Just Us account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passSchema = z.string().min(8, "Use at least 8 characters").max(72);

function AuthPage() {
  const { mode = "login" } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const signingUp = useRef(false);

  useEffect(() => {
    if (session && !created && !signingUp.current) navigate({ to: "/chat", replace: true });
  }, [session, created, navigate]);

  const setMode = (m: Mode) => {
    setError(null);
    setNotice(null);
    navigate({ to: "/auth", search: { mode: m }, replace: true });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const em = emailSchema.safeParse(email);
    if (!em.success) return setError(em.error.issues[0]?.message ?? "Invalid input");
    if (mode !== "forgot") {
      const pw = passSchema.safeParse(password);
      if (!pw.success) return setError(pw.error.issues[0]?.message ?? "Invalid input");
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: em.data, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const display = name.trim().slice(0, 40);
        if (!display) throw new Error("Tell us what your partner should call you");
        signingUp.current = true;
        const { data, error } = await supabase.auth.signUp({
          email: em.data,
          password,
          options: { emailRedirectTo: siteUrl(), data: { display_name: display } },
        });
        if (error) throw error;
        if (data.user && data.user.identities?.length === 0) throw new Error("This email already has an account. Log in instead.");
        if (data.session) setCreated(em.data);
        else setNotice("Account created. Check your email to confirm it, then log in here.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(em.data, { redirectTo: `${siteUrl()}/reset-password` });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(authError(err));
    } finally {
      signingUp.current = false;
      setBusy(false);
    }
  }

  if (created) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-romance px-6 text-center safe-top safe-bottom">
        <div role="status" className="w-full max-w-sm rounded-3xl bg-card/80 p-8 shadow-soft backdrop-blur">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 text-3xl font-semibold text-primary">You're signed up!</h1>
          <p className="mt-3 text-sm text-muted-foreground">Your account for <span className="font-semibold text-foreground">{created}</span> was created successfully.</p>
          <button onClick={() => navigate({ to: "/chat", replace: true })} className="mt-6 h-12 w-full rounded-full bg-heart font-semibold text-primary-foreground shadow-glow">Continue</button>
        </div>
      </main>
    );
  }

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back";

  return (
    <main className="flex min-h-dvh flex-col bg-romance px-6 safe-top safe-bottom">
      <Link to="/" aria-label="Back" className="mt-2 grid h-11 w-11 place-items-center rounded-full text-primary">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={56} />
          <h1 className="mt-4 text-4xl font-semibold text-primary">{title}</h1>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-card/80 p-6 shadow-soft backdrop-blur" noValidate>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">What should they call you?</Label>
              <Input id="name" className="h-12 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" inputMode="email" className="h-12 rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" className="h-12 rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
          )}
          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground">{notice}</p>}
          <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-heart font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Sign up" : mode === "forgot" ? "Send reset link" : "Log in"}
          </button>
        </form>
        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          {mode === "login" && (
            <>
              <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("forgot")}>Forgot password?</button>
              <button className="text-muted-foreground" onClick={() => setMode("signup")}>New here? <span className="font-semibold text-primary">Sign up</span></button>
            </>
          )}
          {mode !== "login" && (
            <button className="text-muted-foreground" onClick={() => setMode("login")}>Have an account? <span className="font-semibold text-primary">Log in</span></button>
          )}
        </div>
      </div>
    </main>
  );
}

function authError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? "";
  if (/already registered|already exists/i.test(msg)) return "This email already has an account. Log in instead.";
  if (/invalid login credentials/i.test(msg)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first, then log in.";
  if (/pwned|weak|compromised/i.test(msg)) return "This password is too common or was leaked. Please choose a different one.";
  if (/rate limit|too many/i.test(msg)) return "Too many tries. Please wait a few minutes and try again.";
  return friendlyError(err);
}
