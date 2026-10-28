import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrandMark } from "@/components/Hearts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — Just Us" }, { name: "description", content: "Your private space for two." }] }),
  component: Chat,
});

function Chat() {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-romance px-6 text-center">
      <BrandMark size={64} />
      <h1 className="text-4xl font-semibold text-primary">You're signed in</h1>
      <p className="max-w-xs text-sm text-muted-foreground">Pairing and messaging screens are not built yet.</p>
      <button
        className="h-12 rounded-full bg-heart px-8 font-semibold text-primary-foreground"
        onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}
      >Log out</button>
    </main>
  );
}
