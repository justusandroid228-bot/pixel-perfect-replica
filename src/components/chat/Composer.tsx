import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Send, Smile, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StickerPicker } from "./StickerPicker";
import type { Sticker } from "@/lib/stickers";
import { MAX_TEXT } from "@/lib/rules";
import { cn } from "@/lib/utils";

const MAX_RECORD_S = 120;

type Props = {
  disabled?: boolean;
  onText: (text: string) => void;
  onFile: (file: File | Blob, nameMime?: string) => void;
  onSticker: (s: Sticker) => void;
  onTyping: () => void;
};

function pickAudioMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export function Composer({ disabled, onText, onFile, onSticker, onTyping }: Props) {
  const [text, setText] = useState("");
  const [stickers, setStickers] = useState(false);
  const [recording, setRecording] = useState<{ start: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - recording.start) / 1000);
      setElapsed(s);
      if (s >= MAX_RECORD_S) stopRecording(false);
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [text]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    if (t.length > MAX_TEXT) return toast.error(`Messages can be up to ${MAX_TEXT} characters.`);
    onText(t);
    setText("");
  }

  async function startRecording() {
    const mime = pickAudioMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) return toast.error("Voice recording isn't supported on this device.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      cancelled.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (cancelled.current) return;
        const type = (rec.mimeType || mime || "audio/webm").split(";")[0]!;
        const blob = new Blob(chunks.current, { type });
        if (blob.size < 1000) return toast.error("That recording was too short.");
        onFile(blob, type);
      };
      rec.start(250);
      recRef.current = rec;
      setElapsed(0);
      setRecording({ start: Date.now() });
    } catch {
      toast.error("Microphone access was denied. Allow it in your device settings to send voice notes.");
    }
  }

  function stopRecording(cancel: boolean) {
    cancelled.current = cancel;
    recRef.current?.state === "recording" && recRef.current.stop();
    recRef.current = null;
    setRecording(null);
  }

  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="border-t border-border bg-card/90 backdrop-blur safe-bottom">
      {stickers && (
        <StickerPicker
          onPick={(s) => {
            onSticker(s);
            setStickers(false);
          }}
        />
      )}
      {recording ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={() => stopRecording(true)} aria-label="Discard recording" className="grid h-11 w-11 place-items-center rounded-full text-destructive">
            <Trash2 className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-2 text-primary" role="status">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" aria-hidden />
            Recording {mm} <span className="text-xs text-muted-foreground">/ 2:00</span>
          </div>
          <button onClick={() => stopRecording(false)} aria-label="Stop and send voice note" className="grid h-11 w-11 place-items-center rounded-full bg-heart text-primary-foreground">
            <Square className="h-4 w-4 fill-current" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1 px-2 py-2">
          <button
            onClick={() => setStickers((v) => !v)}
            aria-label="Stickers"
            aria-pressed={stickers}
            className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary", stickers && "bg-secondary")}
          >
            <Smile className="h-5 w-5" />
          </button>
          <button onClick={() => fileRef.current?.click()} aria-label="Send photo or video" disabled={disabled} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary disabled:opacity-50">
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <label htmlFor="composer" className="sr-only">Message</label>
          <textarea
            id="composer"
            ref={taRef}
            rows={1}
            value={text}
            maxLength={MAX_TEXT}
            placeholder="Write something sweet…"
            onChange={(e) => {
              setText(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-36 min-h-11 flex-1 resize-none rounded-3xl border border-input bg-background px-4 py-2.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {text.trim() ? (
            <button onClick={submit} aria-label="Send" disabled={disabled} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-heart text-primary-foreground shadow-glow disabled:opacity-50">
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={startRecording} aria-label="Record voice note" disabled={disabled} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-heart text-primary-foreground shadow-glow disabled:opacity-50">
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
