import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, Loader2, Settings, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/auth";
import { uploadMedia } from "@/lib/media";
import { playChime, type Prefs } from "@/lib/prefs";
import type { Member } from "@/lib/room";
import { checkMedia, deliveryState, isTypingFresh, mergeMessages, TYPING_FRESH_MS } from "@/lib/rules";
import type { Sticker } from "@/lib/stickers";
import { Composer } from "./Composer";
import { MessageBubble, type ChatMessage } from "./MessageBubble";

const PAGE = 40;
type Receipt = { delivered_at: string | null; read_at: string | null };
type Outgoing = ChatMessage & { file?: Blob; uploaded?: boolean; ext?: string };

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function ChatRoom({ roomId, meId, partner, prefs }: { roomId: string; meId: string; partner: Member; prefs: Prefs }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [receipts, setReceipts] = useState<Map<string, Receipt>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingAt, setTypingAt] = useState<string | null>(null);
  const [, tick] = useState(0);
  const [online, setOnline] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const keepOffset = useRef<number | null>(null);
  const lastTypingSent = useRef(0);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // ---- loading ----
  const loadReceipts = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase.from("message_receipts").select("message_id, delivered_at, read_at").in("message_id", ids);
    if (data) setReceipts((prev) => {
      const next = new Map(prev);
      data.forEach((r) => next.set(r.message_id, r));
      return next;
    });
  }, []);

  const loadLatest = useCallback(async () => {
    const { data, error } = await supabase.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(PAGE);
    setLoading(false);
    if (error) return setLoadError(friendlyError(error));
    setLoadError(null);
    const rows = (data ?? []).reverse();
    setMsgs((prev) => {
      if (!prev.length) setHasMore(rows.length === PAGE);
      return mergeMessages(prev, rows);
    });
    loadReceipts(rows.filter((r) => r.sender_id === meId).map((r) => r.id));
  }, [roomId, meId, loadReceipts]);

  async function loadOlder() {
    const oldest = msgs[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const { data, error } = await supabase
      .from("messages").select("*").eq("room_id", roomId).lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false }).limit(PAGE);
    setLoadingOlder(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    const rows = (data ?? []).reverse();
    const el = scroller.current;
    if (el) keepOffset.current = el.scrollHeight - el.scrollTop;
    setHasMore(rows.length === PAGE);
    setMsgs((prev) => mergeMessages(prev, rows));
    loadReceipts(rows.filter((r) => r.sender_id === meId).map((r) => r.id));
  }

  // ---- read / delivered ----
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markSeen = useCallback(() => {
    if (markTimer.current) clearTimeout(markTimer.current);
    markTimer.current = setTimeout(() => {
      if (document.visibilityState === "visible") supabase.rpc("mark_room_read", { _room: roomId }).then(() => {});
      else supabase.rpc("mark_delivered", { _room: roomId }).then(() => {});
    }, 600);
  }, [roomId]);

  useEffect(() => {
    loadLatest().then(markSeen);
    const vis = () => {
      if (document.visibilityState === "visible") {
        document.title = "Just Us";
        markSeen();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [loadLatest, markSeen]);

  // ---- realtime ----
  const hiddenUnread = useRef(0);
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, (p) => {
        const m = p.new as ChatMessage;
        setMsgs((prev) => mergeMessages(prev, [m]));
        if (m.sender_id === meId) return;
        setTypingAt(null);
        markSeen();
        const hidden = document.visibilityState !== "visible";
        if (prefsRef.current.sound_enabled) playChime();
        if (hidden) {
          hiddenUnread.current += 1;
          document.title = `(${hiddenUnread.current}) Just Us`;
        } else {
          hiddenUnread.current = 0;
          if (!atBottom.current) {
            setNewBelow((n) => n + 1);
            if (prefsRef.current.in_app_notifications) toast(`New message from ${partner.display_name}`, { duration: 2500 });
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_receipts" }, (p) => {
        const r = p.new as { message_id?: string; delivered_at: string | null; read_at: string | null };
        if (!r?.message_id) return;
        setReceipts((prev) => new Map(prev).set(r.message_id!, r));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "typing_status", filter: `room_id=eq.${roomId}` }, (p) => {
        const r = p.new as { user_id?: string };
        if (r?.user_id && r.user_id !== meId) setTypingAt(new Date().toISOString()); // receive time avoids clock skew
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") loadLatest(); // fill any gap after (re)connect
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, meId, partner.display_name, loadLatest, markSeen]);

  // typing indicator expiry
  useEffect(() => {
    if (!typingAt) return;
    const t = setTimeout(() => tick((n) => n + 1), TYPING_FRESH_MS + 50);
    return () => clearTimeout(t);
  }, [typingAt]);

  // online/offline
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      loadLatest();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [loadLatest]);

  // ---- sending ----
  const patchOut = (client_id: string, patch: Partial<Outgoing>) =>
    setOutbox((o) => o.map((m) => (m.client_id === client_id ? { ...m, ...patch } : m)));

  async function deliver(item: Outgoing) {
    patchOut(item.client_id, { pending: true, failed: false, error: undefined });
    try {
      let uploaded = item.uploaded;
      if (item.media_path && item.file && !uploaded) {
        try {
          await uploadMedia(item.media_path, item.file, item.media_mime!, (pct) => patchOut(item.client_id, { progress: pct }));
        } catch (e) {
          if (!/exists|Duplicate/i.test((e as Error).message)) throw e; // a retry after a successful upload
        }
        uploaded = true;
        patchOut(item.client_id, { uploaded: true, progress: 100 });
      }
      const { data, error } = await supabase
        .from("messages")
        .insert({
          room_id: roomId,
          client_id: item.client_id,
          kind: item.kind,
          body: item.body,
          media_path: item.media_path,
          media_mime: item.media_mime,
          media_size: item.media_size,
        })
        .select("*")
        .single();
      let row = data;
      if (error) {
        if (error.code !== "23505") throw error;
        const again = await supabase.from("messages").select("*").eq("sender_id", meId).eq("client_id", item.client_id).single();
        if (again.error) throw again.error;
        row = again.data;
      }
      if (row) {
        setMsgs((prev) => mergeMessages(prev, [row as ChatMessage]));
        setOutbox((o) => o.filter((m) => m.client_id !== item.client_id));
        if (item.localUrl) setTimeout(() => URL.revokeObjectURL(item.localUrl!), 60_000);
      }
    } catch (err) {
      patchOut(item.client_id, { pending: false, failed: true, error: friendlyError(err) });
    }
  }

  function enqueue(partial: Partial<Outgoing> & { kind: string }) {
    const client_id = crypto.randomUUID();
    const item: Outgoing = {
      id: `local-${client_id}`,
      client_id,
      room_id: roomId,
      sender_id: meId,
      body: null,
      media_path: null,
      media_mime: null,
      media_size: null,
      created_at: new Date().toISOString(),
      pending: true,
      ...partial,
    };
    if (item.file && item.ext) item.media_path = `${roomId}/${meId}/${client_id}.${item.ext}`;
    setOutbox((o) => [...o, item]);
    atBottom.current = true;
    deliver(item);
  }

  const sendText = (t: string) => enqueue({ kind: "text", body: t });
  const sendSticker = (s: Sticker) => enqueue({ kind: "sticker", body: s.id });
  function sendFile(file: File | Blob, mimeOverride?: string) {
    const c = checkMedia({ type: mimeOverride ?? file.type, size: file.size });
    if (!c.ok) {
      toast.error(c.error);
      return;
    }
    enqueue({ kind: c.kind, file, ext: c.ext, media_mime: c.mime, media_size: file.size, progress: 0, localUrl: URL.createObjectURL(file) });
  }

  function onTyping() {
    if (!prefsRef.current.show_typing) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    supabase
      .from("typing_status")
      .upsert({ room_id: roomId, user_id: meId, updated_at: new Date().toISOString() })
      .then(() => {});
  }

  // ---- scrolling ----
  const all = useMemo(() => [...msgs, ...outbox.filter((o) => !msgs.some((m) => m.client_id === o.client_id))], [msgs, outbox]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [all.length, loading]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current && newBelow) setNewBelow(0);
  }

  const partnerTyping = isTypingFresh(typingAt);
  let lastDay = "";

  return (
    <main className="flex h-dvh flex-col bg-romance">
      <header className="flex items-center gap-3 border-b border-border bg-card/85 px-4 pb-2.5 pt-2.5 backdrop-blur safe-top">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-heart text-lg font-semibold text-primary-foreground" aria-hidden>
          {partner.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold leading-tight text-primary">{partner.display_name}</h1>
          <p className="h-4 text-xs text-muted-foreground" aria-live="polite">{partnerTyping ? "typing…" : "just the two of you"}</p>
        </div>
        <Link to="/settings" aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-full text-primary">
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      {!online && (
        <div role="status" className="flex items-center justify-center gap-2 bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <WifiOff className="h-3.5 w-3.5" /> You're offline. Messages will fail until you reconnect.
        </div>
      )}

      <div ref={scroller} onScroll={onScroll} className="relative flex-1 overflow-y-auto px-3 py-3" aria-label="Messages" role="log">
        {loading ? (
          <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : loadError ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="text-sm text-destructive">{loadError}</p>
              <button onClick={() => loadLatest()} className="mt-2 text-sm font-semibold text-primary">Try again</button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
            {hasMore && (
              <button onClick={loadOlder} disabled={loadingOlder} className="mx-auto mb-2 flex items-center gap-2 rounded-full bg-card/80 px-4 py-1.5 text-xs font-semibold text-primary shadow-soft">
                {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />} Load earlier messages
              </button>
            )}
            {all.length === 0 && (
              <p className="mt-16 text-center text-sm italic text-muted-foreground" style={{ fontFamily: "var(--font-display)" }}>
                Say hello to {partner.display_name} 💗
              </p>
            )}
            {all.map((m) => {
              const day = dayLabel(m.created_at);
              const showDay = day !== lastDay;
              lastDay = day;
              const mine = m.sender_id === meId;
              return (
                <div key={m.client_id}>
                  {showDay && <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{day}</p>}
                  <MessageBubble
                    m={m}
                    mine={mine}
                    state={mine ? deliveryState(m, receipts.get(m.id), partner.last_read_at) : undefined}
                    onRetry={() => {
                      const o = outbox.find((x) => x.client_id === m.client_id);
                      if (o) deliver(o);
                    }}
                  />
                </div>
              );
            })}
            {partnerTyping && (
              <div className="flex items-center gap-1 self-start rounded-3xl rounded-bl-lg bg-bubble-them px-4 py-3 shadow-soft" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-rose" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {newBelow > 0 && (
        <button
          onClick={() => {
            scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
            setNewBelow(0);
          }}
          className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
        >
          <ArrowDown className="h-3.5 w-3.5" /> {newBelow} new
        </button>
      )}

      <Composer onText={sendText} onSticker={sendSticker} onFile={sendFile} onTyping={onTyping} />
    </main>
  );
}
