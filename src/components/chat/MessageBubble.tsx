import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCheck, Clock, ImageOff, Loader2, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { signedUrl } from "@/lib/media";
import { getSticker } from "@/lib/stickers";
import type { DeliveryState } from "@/lib/rules";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  client_id: string;
  room_id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_size: number | null;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
  error?: string | undefined;
  progress?: number;
  localUrl?: string;
};

function useMediaUrl(path: string | null, localUrl?: string) {
  const [url, setUrl] = useState<string | null>(localUrl ?? null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (localUrl || !path) return;
    let alive = true;
    signedUrl(path)
      .then((u) => alive && (setUrl(u), setError(false)))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [path, localUrl, nonce]);
  return { url, error, retry: () => setNonce((n) => n + 1) };
}

function Media({ m }: { m: ChatMessage }) {
  const { url, error, retry } = useMediaUrl(m.media_path, m.localUrl);
  const [open, setOpen] = useState(false);
  if (error)
    return (
      <button onClick={retry} className="flex items-center gap-2 px-3 py-2 text-sm">
        <ImageOff className="h-4 w-4" /> Couldn't load · tap to retry
      </button>
    );
  if (!url) return <div className="grid h-40 w-56 place-items-center"><Loader2 className="h-5 w-5 animate-spin opacity-60" /></div>;
  if (m.kind === "image")
    return (
      <>
        <button onClick={() => setOpen(true)} aria-label="Open photo" className="block">
          <img src={url} alt="Photo" onError={retry} className="max-h-72 w-full max-w-64 rounded-2xl object-cover" loading="lazy" />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none">
            <DialogTitle className="sr-only">Photo</DialogTitle>
            <img src={url} alt="Photo, full size" className="max-h-[85dvh] w-full rounded-2xl object-contain" />
          </DialogContent>
        </Dialog>
      </>
    );
  if (m.kind === "video")
    return <video src={url} controls playsInline preload="metadata" onError={retry} className="max-h-72 w-full max-w-64 rounded-2xl bg-foreground/10" />;
  return <audio src={url} controls preload="metadata" onError={retry} className="h-10 w-60 max-w-full" aria-label="Voice message" />;
}

const STATUS: Record<DeliveryState, { icon: typeof Check; label: string }> = {
  sending: { icon: Clock, label: "Sending" },
  failed: { icon: AlertCircle, label: "Not sent" },
  sent: { icon: Check, label: "Sent" },
  delivered: { icon: CheckCheck, label: "Delivered" },
  read: { icon: CheckCheck, label: "Read" },
};

export function MessageBubble({ m, mine, state, onRetry }: { m: ChatMessage; mine: boolean; state?: DeliveryState | undefined; onRetry?: (() => void) | undefined }) {
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sticker = m.kind === "sticker" ? getSticker(m.body) : undefined;
  const S = state ? STATUS[state] : null;
  const isMedia = m.kind === "image" || m.kind === "video" || m.kind === "audio";

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[80%] flex-col", mine ? "items-end" : "items-start")}>
        {sticker ? (
          <div className="flex flex-col items-center px-2 py-1">
            <span className="text-6xl leading-none drop-shadow-sm" aria-hidden>{sticker.emoji}</span>
            <span className="mt-1 rounded-full bg-card/80 px-2.5 py-0.5 text-xs font-semibold text-primary">{sticker.caption}</span>
            <span className="sr-only">Sticker: {sticker.caption}</span>
          </div>
        ) : (
          <div
            className={cn(
              "relative overflow-hidden rounded-3xl shadow-soft",
              isMedia ? "p-1" : "px-4 py-2.5",
              mine ? "rounded-br-lg bg-bubble-me text-bubble-me-foreground" : "rounded-bl-lg bg-bubble-them text-bubble-them-foreground",
              m.pending && "opacity-80",
            )}
          >
            {isMedia ? <Media m={m} /> : <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>}
            {m.pending && typeof m.progress === "number" && m.progress < 100 && (
              <div className="absolute inset-x-3 bottom-2 h-1.5 overflow-hidden rounded-full bg-card/40" role="progressbar" aria-valuenow={m.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <div className="h-full bg-card transition-all" style={{ width: `${m.progress}%` }} />
              </div>
            )}
          </div>
        )}
        <div className="mt-0.5 flex items-center gap-1 px-1.5 text-[11px] text-muted-foreground">
          <span>{time}</span>
          {S && (
            <span className={cn("flex items-center gap-0.5", state === "read" && "text-rose", state === "failed" && "text-destructive")}>
              <S.icon className="h-3.5 w-3.5" aria-hidden />
              <span className={state === "failed" ? "" : "sr-only"}>{S.label}</span>
            </span>
          )}
          {state === "failed" && onRetry && (
            <button onClick={onRetry} className="ml-1 flex items-center gap-0.5 font-semibold text-primary">
              <RotateCw className="h-3 w-3" /> Retry
            </button>
          )}
        </div>
        {state === "failed" && m.error && <p className="px-1.5 text-[11px] text-destructive">{m.error}</p>}
      </div>
    </div>
  );
}
