import Dexie from "dexie";
import { signUploadPayloadBrowser } from "./share-hmac";

const SHARE_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SHARE_URL
    ? String(process.env.NEXT_PUBLIC_SHARE_URL).replace(/\/$/, "")
    : "";
export const SHARE_SHORT_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SHARE_SHORT_URL
    ? String(process.env.NEXT_PUBLIC_SHARE_SHORT_URL).replace(/\/$/, "")
    : SHARE_URL;
const SHARE_SECRET =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SHARE_SECRET
    ? process.env.NEXT_PUBLIC_SHARE_SECRET
    : "";

export interface UploadQueueItem {
  id?: number;
  photoId: string;
  shortCode: string;
  eventId: string | null;
  cafeSlug: string | null;
  original: Blob;
  thumbnail: Blob;
  social: Blob;
  createdAt: number;
  status: "pending" | "uploading" | "failed";
  retries: number;
  lastError?: string;
}

const db = new Dexie("ArchivioShareQueue") as Dexie & {
  uploadQueue: Dexie.Table<UploadQueueItem, number>;
};
db.version(1).stores({
  uploadQueue: "++id, photoId, shortCode, createdAt, status",
});
db.version(2).stores({
  uploadQueue: "++id, photoId, shortCode, cafeSlug, createdAt, status",
});

async function uploadOne(item: UploadQueueItem): Promise<boolean> {
  if (!SHARE_URL || !SHARE_SECRET) return false;
  const timestamp = Date.now();
  const signature = await signUploadPayloadBrowser(
    SHARE_SECRET,
    item.photoId,
    item.shortCode,
    timestamp
  );
  const form = new FormData();
  form.set("photoId", item.photoId);
  form.set("shortCode", item.shortCode);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);
  if (item.eventId) form.set("eventId", item.eventId);
  if (item.cafeSlug) form.set("cafeSlug", item.cafeSlug);
  form.set("original", item.original, "original.webp");
  form.set("thumbnail", item.thumbnail, "thumbnail.webp");
  form.set("social", item.social, "social.webp");
  const res = await fetch(`${SHARE_URL}/api/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return true;
}

export async function enqueueUpload(
  photoId: string,
  shortCode: string,
  original: Blob,
  thumbnail: Blob,
  social: Blob,
  eventId: string | null = null,
  cafeSlug: string | null = null
): Promise<void> {
  await db.uploadQueue.add({
    photoId,
    shortCode,
    eventId,
    cafeSlug,
    original,
    thumbnail,
    social,
    createdAt: Date.now(),
    status: "pending",
    retries: 0,
  });
  processQueue();
}

const MAX_RETRIES = 10;
const BACKOFF_MS = 1000;

async function processQueue(): Promise<void> {
  const items = await db.uploadQueue.where("status").equals("pending").toArray();
  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      await db.uploadQueue.update(item.id!, { status: "failed" });
      continue;
    }
    try {
      await db.uploadQueue.update(item.id!, { status: "uploading" });
      const ok = await uploadOne(item);
      if (!ok) throw new Error("Share service not configured (missing SHARE_URL or SHARE_SECRET)");
      await db.uploadQueue.delete(item.id!);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const nextRetries = (item.retries ?? 0) + 1;
      const isFinal = nextRetries >= MAX_RETRIES;
      await db.uploadQueue.update(item.id!, {
        status: isFinal ? "failed" : "pending",
        retries: nextRetries,
        lastError: errMsg,
      });
      if (!isFinal) {
        setTimeout(processQueue, BACKOFF_MS * Math.min(nextRetries, 5));
      }
    }
  }
}

export function startShareUploadQueue(): void {
  processQueue();
  if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((reg) => {
      (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
        .sync?.register?.("archivio-upload")
        .catch(() => {});
    });
  }
}

export function getShareServiceOnline(): Promise<boolean> {
  if (!SHARE_URL) return Promise.resolve(false);
  return fetch(`${SHARE_URL}/api/health`, { method: "GET" })
    .then((r) => r.ok)
    .catch(() => false);
}
