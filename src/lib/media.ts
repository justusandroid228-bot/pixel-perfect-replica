import { supabase } from "@/integrations/supabase/client";

const BUCKET = "media";
const URL_TTL_S = 300; // short-lived signed URLs

/** Upload to private storage with progress. Path: {room}/{me}/{uuid}.{ext}; storage rules check both. */
export async function uploadMedia(
  path: string,
  file: Blob,
  mime: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");
  const base = import.meta.env["VITE_SUPABASE_URL"] as string;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base.replace(/\/+$/, "")}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "Upload failed";
      try {
        msg = (JSON.parse(xhr.responseText) as { message?: string }).message ?? msg;
      } catch {
        /* keep default */
      }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Couldn't reach the server. Please try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

const cache = new Map<string, { url: string; exp: number }>();

export async function signedUrl(path: string): Promise<string> {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now() + 15_000) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL_S);
  if (error || !data) throw error ?? new Error("Couldn't open this file");
  cache.set(path, { url: data.signedUrl, exp: Date.now() + URL_TTL_S * 1000 });
  return data.signedUrl;
}
