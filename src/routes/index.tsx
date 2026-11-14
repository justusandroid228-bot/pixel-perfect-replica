import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BrandMark, FloatingHearts } from "@/components/Hearts";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Just Us — Some conversations are meant for two" },
      { name: "description", content: "A private, romantic 1-to-1 messenger. Pair with your person using a one-time code." },
      { property: "og:title", content: "Just Us" },
      { property: "og:description", content: "Some conversations are meant for two." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Splash,
});

function Splash() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && session) navigate({ to: "/chat", replace: true });
  }, [loading, session, navigate]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden bg-romance px-6 safe-top safe-bottom">
      <FloatingHearts />
      <div />
      <div className="relative flex flex-col items-center text-center">
        <BrandMark size={96} />
        <h1 className="mt-8 text-6xl font-semibold tracking-tight text-primary">Just Us</h1>
        <p className="mt-3 max-w-xs text-lg italic text-secondary-foreground" style={{ fontFamily: "var(--font-display)" }}>
          Some conversations are meant for two.
        </p>
      </div>
      <div className="relative mb-6 flex w-full max-w-sm flex-col gap-3">
        {loading || session ? (
          <p className="text-center text-sm text-muted-foreground" role="status">Opening your space…</p>
        ) : (
          <>
            <Link to="/auth" search={{ mode: "signup" }} className="h-14 rounded-full bg-heart text-center text-base font-semibold leading-[3.5rem] text-primary-foreground shadow-glow active:scale-[0.98] transition">
              Create our space
            </Link>
            <Link to="/auth" search={{ mode: "login" }} className="h-14 rounded-full border border-border bg-card/70 text-center text-base font-semibold leading-[3.5rem] text-primary backdrop-blur active:scale-[0.98] transition">
              I already have an account
            </Link>
            <Link to="/privacy" className="pt-2 text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
              Privacy notice
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
