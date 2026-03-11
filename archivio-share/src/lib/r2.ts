import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { put, del, head } from "@vercel/blob";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME ?? "archivio-photos";
const publicUrl = process.env.R2_PUBLIC_URL ?? "";
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

type StorageBackend = "r2" | "vercel-blob" | "local";

function getBackend(): StorageBackend {
  if (accountId && accessKeyId && secretAccessKey) return "r2";
  if (blobToken) return "vercel-blob";
  return "local";
}

const s3 =
  getBackend() === "r2"
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
        forcePathStyle: true,
      })
    : null;

export function getR2PublicUrl(key: string): string {
  if (getBackend() === "r2" && publicUrl) {
    return `${publicUrl.replace(/\/$/, "")}/${key}`;
  }
  // For vercel-blob, the URL is set after upload (stored in DB directly)
  // Return a placeholder that will be replaced by the actual blob URL
  return `__BLOB_PENDING__/${key}`;
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string
): Promise<string> {
  const backend = getBackend();

  if (backend === "r2" && s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType ?? "application/octet-stream",
      })
    );
    return `${publicUrl.replace(/\/$/, "")}/${key}`;
  }

  if (backend === "vercel-blob") {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const blob = await put(`${key}.webp`, buf, {
      access: "public",
      contentType: contentType ?? "image/webp",
    });
    return blob.url;
  }

  // Local fallback (dev only)
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const dir = join(process.cwd(), "public", "r2");
  const filePath = join(dir, `${key}.webp`);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, body);
  return `/r2/${key}.webp`;
}

export async function getFromR2(key: string): Promise<ReadableStream | null> {
  const backend = getBackend();

  if (backend === "r2" && s3) {
    try {
      const res = await s3.send(
        new GetObjectCommand({ Bucket: bucketName, Key: key })
      );
      return (res.Body as ReadableStream) ?? null;
    } catch {
      return null;
    }
  }

  if (backend === "vercel-blob") {
    try {
      const meta = await head(`${key}.webp`);
      if (!meta?.url) return null;
      const res = await fetch(meta.url);
      return res.body;
    } catch {
      return null;
    }
  }

  // Local fallback
  const fs = await import("node:fs");
  const { join } = await import("node:path");
  const { Readable } = await import("node:stream");
  const dir = join(process.cwd(), "public", "r2");
  const withExt = join(dir, `${key}.webp`);
  const filePath = fs.existsSync(withExt) ? withExt : join(dir, key);
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const readable = new Readable({ read() { this.push(buf); this.push(null); } });
  return Readable.toWeb(readable) as ReadableStream;
}

export async function deleteFromR2(key: string): Promise<void> {
  const backend = getBackend();

  if (backend === "r2" && s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
    return;
  }

  if (backend === "vercel-blob") {
    try {
      const meta = await head(`${key}.webp`);
      if (meta?.url) await del(meta.url);
    } catch { /* noop */ }
    return;
  }

  // Local fallback
  const { unlinkSync } = await import("node:fs");
  const { join } = await import("node:path");
  const filePath = join(process.cwd(), "public", "r2", `${key}.webp`);
  try { unlinkSync(filePath); } catch { /* noop */ }
}
