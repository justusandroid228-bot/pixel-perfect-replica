import { createFileRoute } from "@tanstack/react-router";
import { FullScreenLoader } from "@/components/Hearts";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { Pairing } from "@/components/chat/Pairing";
import { useSession } from "@/lib/auth";
import { usePrefs } from "@/lib/prefs";
import { useRoom } from "@/lib/room";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Just Us" },
      { name: "description", content: "Your private space for two." },
      { property: "og:title", content: "Chat — Just Us" },
      { property: "og:description", content: "Your private space for two." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { user, loading } = useSession();
  const room = useRoom(user?.id);
  const { prefs } = usePrefs(user?.id);

  if (loading || !user || room.loading) return <FullScreenLoader label="Opening your space…" />;
  if (room.error)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-romance px-6 text-center">
        <p className="text-sm text-destructive">{room.error}</p>
        <button onClick={room.reload} className="h-11 rounded-full bg-heart px-6 font-semibold text-primary-foreground">Try again</button>
      </div>
    );
  if (!room.roomId || !room.partner) return <Pairing roomId={room.roomId} onChanged={room.reload} />;
  return <ChatRoom roomId={room.roomId} meId={user.id} partner={room.partner} prefs={prefs} />;
}
