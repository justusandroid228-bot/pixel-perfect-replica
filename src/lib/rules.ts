// Pure app rules shared by the UI and unit tests. The database enforces the same rules server-side.

const CODE_ALPHABET = /^[A-HJ-NP-Z2-9]{8}$/;

/** Turns whatever the user typed/pasted into the canonical "JU-XXXX-XXXX" form, or null if it can't be a code. */
export function normalizeInviteCode(input: string): string | null {
  let s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length === 10 && s.startsWith("JU")) s = s.slice(2);
  if (!CODE_ALPHABET.test(s)) return null;
  return `JU-${s.slice(0, 4)}-${s.slice(4)}`;
}

export type MediaKind = "image" | "video" | "audio";

export const MB = 1024 * 1024;
export const MEDIA_LIMITS: Record<MediaKind, number> = {
  image: 10 * MB,
  video: 25 * MB,
  audio: 10 * MB,
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/wav": "wav",
};

export type MediaCheck = { ok: true; kind: MediaKind; mime: string; ext: string } | { ok: false; error: string };

export function checkMedia(file: { type: string; size: number }): MediaCheck {
  const mime = (file.type || "").split(";")[0]!.trim().toLowerCase();
  const ext = EXT_BY_MIME[mime];
  const kind = mime.split("/")[0] as MediaKind;
  if (!ext || !(kind in MEDIA_LIMITS)) return { ok: false, error: "That file type isn't supported." };
  if (file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > MEDIA_LIMITS[kind]) {
    return { ok: false, error: `That ${kind === "image" ? "photo" : kind === "video" ? "video" : "voice note"} is too large (max ${MEDIA_LIMITS[kind] / MB} MB).` };
  }
  return { ok: true, kind, mime, ext };
}

export const MAX_TEXT = 4000;

export type DeliveryState = "sending" | "failed" | "sent" | "delivered" | "read";

/** Status shown under one of MY messages. Only backend-confirmed rows count as sent. */
export function deliveryState(
  msg: { pending?: boolean; failed?: boolean; created_at: string },
  receipt: { delivered_at: string | null; read_at: string | null } | undefined,
  partnerLastReadAt: string | null | undefined,
): DeliveryState {
  if (msg.failed) return "failed";
  if (msg.pending) return "sending";
  if (receipt?.read_at || (partnerLastReadAt && partnerLastReadAt >= msg.created_at)) return "read";
  if (receipt?.delivered_at) return "delivered";
  return "sent";
}

export const TYPING_FRESH_MS = 6000;
export function isTypingFresh(updatedAt: string | null | undefined, now = Date.now()) {
  return !!updatedAt && now - new Date(updatedAt).getTime() < TYPING_FRESH_MS;
}

/** Merge server rows into a list by id, keeping chronological order and dropping duplicates. */
export function mergeMessages<T extends { id: string; client_id: string; created_at: string }>(list: T[], incoming: T[]): T[] {
  const byClient = new Map<string, T>();
  for (const m of list) byClient.set(m.client_id, m);
  for (const m of incoming) byClient.set(m.client_id, m);
  return [...byClient.values()].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}
