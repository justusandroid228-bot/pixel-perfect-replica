import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy notice — Just Us" },
      { name: "description", content: "How Just Us stores your messages and media, and what it does not promise." },
      { property: "og:title", content: "Privacy notice — Just Us" },
      { property: "og:description", content: "How Just Us stores your messages and media." },
    ],
  }),
  component: Privacy,
});

export const PRIVACY_POINTS = [
  ["Only two people", "Each private room holds exactly two members. There is no public profile, feed, search, or group chat."],
  ["What we store", "Your email, the display name you choose, your messages, photos, videos, voice notes, and read receipts. Nothing else is collected."],
  ["Encryption", "Data is encrypted in transit (HTTPS) and stored on secured servers, but messages and media are not end-to-end encrypted. The service operator could technically access stored data."],
  ["Messages can't be edited or deleted", "Once sent, messages stay as they were. The server refuses edits and deletions. There are no disappearing messages."],
  ["No storage guarantee", "We do our best to keep your data available, but permanent storage cannot be guaranteed."],
  ["Screenshots", "We cannot prevent your partner from taking screenshots or recording the screen."],
  ["Media links", "Photos, videos and voice notes live in private storage and are shown through short-lived links only to the two members of the room."],
] as const;

function Privacy() {
  const router = useRouter();
  return (
    <main className="min-h-dvh bg-romance px-6 pb-10 safe-top">
      <button aria-label="Back" onClick={() => router.history.back()} className="mt-2 grid h-11 w-11 place-items-center rounded-full text-primary">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="mx-auto max-w-md">
        <h1 className="mt-2 text-4xl font-semibold text-primary">Privacy notice</h1>
        <div className="mt-6 space-y-3">
          {PRIVACY_POINTS.map(([t, d]) => (
            <section key={t} className="rounded-2xl bg-card/80 p-4 shadow-soft">
              <h2 className="text-xl font-semibold text-primary">{t}</h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">{d}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
