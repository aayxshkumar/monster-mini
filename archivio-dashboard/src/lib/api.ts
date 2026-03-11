const PI_URL = process.env.NEXT_PUBLIC_PI_URL || "http://monster-pi.local:5000";
const PI_API_KEY = process.env.NEXT_PUBLIC_PI_API_KEY || "";

function piHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (PI_API_KEY) h["X-API-Key"] = PI_API_KEY;
  return h;
}

function piFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = piHeaders(
    init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : (init?.headers as Record<string, string>) ?? undefined
  );
  return fetch(url, { ...init, headers });
}

export interface StickerParam {
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridPhotoParam {
  filename: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface PrintParams {
  job_id?: string;
  logo?: string;
  photo?: string;
  grid_photos?: GridPhotoParam[];
  grid_layout?: string;
  grid_canvas_mode?: boolean;
  memo: string;
  memo_font?: string;
  memo_font_size?: number;
  memo_bold?: boolean;
  memo_italic?: boolean;
  qr_url: string;
  algorithm: string;
  header_height?: number;
  section_order?: string[];
  stamp_text?: string;
  stickers?: StickerParam[];
  photo_aspect_ratio?: string;
  photo_rotation?: number;
  header_text?: string;
  header_text_font?: string;
  header_text_size?: number;
  header_text_bold?: boolean;
  header_text_italic?: boolean;
  header_text_underline?: boolean;
}

export const api = {
  base: PI_URL,

  async health(): Promise<{ status: string; camera: boolean; printer: boolean; printer_ready?: boolean }> {
    const res = await piFetch(`${PI_URL}/api/health`);
    return res.json();
  },

  async uploadLogo(file: File | Blob): Promise<{ url: string; filename: string }> {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "cropped_logo.png");
    const res = await piFetch(`${PI_URL}/api/upload/logo`, { method: "POST", body: form });
    return res.json();
  },

  async uploadPhoto(file: File | Blob): Promise<{ url: string; filename: string }> {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "cropped_photo.png");
    const res = await piFetch(`${PI_URL}/api/upload/photo`, { method: "POST", body: form });
    return res.json();
  },

  async capturePhoto(): Promise<{ url: string; filename: string }> {
    const res = await piFetch(`${PI_URL}/api/camera/capture`, { method: "POST" });
    return res.json();
  },

  async cameraStatus(): Promise<{ available: boolean; info: string }> {
    const res = await piFetch(`${PI_URL}/api/camera/status`);
    return res.json();
  },

  async printEnqueue(params: PrintParams): Promise<{ job_id: string }> {
    const res = await piFetch(`${PI_URL}/api/print/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  /** Send a canvas-exported image directly for printing (WYSIWYG). */
  async printImage(
    blob: Blob,
    jobId: string,
    opts?: { algorithm?: string; contrast?: number; brightness?: number }
  ): Promise<{ job_id: string; status: string; error?: string }> {
    const form = new FormData();
    form.append("file", blob, "receipt.png");
    form.append("job_id", jobId);
    if (opts?.algorithm) form.append("algorithm", opts.algorithm);
    if (opts?.contrast != null) form.append("contrast", String(opts.contrast));
    if (opts?.brightness != null) form.append("brightness", String(opts.brightness));
    const res = await piFetch(`${PI_URL}/api/print/image`, {
      method: "POST",
      body: form,
    });
    return res.json();
  },

  async printStatus(jobId: string): Promise<{ status: string; message: string }> {
    const res = await piFetch(`${PI_URL}/api/print/status/${jobId}`);
    return res.json();
  },

  async uploadSticker(file: File | Blob): Promise<{ url: string; filename: string }> {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "sticker.png");
    const res = await piFetch(`${PI_URL}/api/upload/sticker`, { method: "POST", body: form });
    return res.json();
  },

  imageUrl(filename: string): string {
    return `${PI_URL}/api/images/${filename}`;
  },

  galleryImageUrl(filename: string): string {
    return `${PI_URL}/api/gallery/images/${filename}`;
  },

  previewUrl(filename: string): string {
    return `${PI_URL}/api/previews/${filename}`;
  },

  // ── Templates ──────────────────────────────

  async saveTemplate(
    name: string,
    state: string,
    thumbnail?: string
  ): Promise<{ id: string }> {
    const res = await piFetch(`${PI_URL}/api/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, state, thumbnail: thumbnail || "" }),
    });
    return res.json();
  },

  async listTemplates(): Promise<
    { id: string; name: string; thumbnail: string; created_at: string; updated_at: string }[]
  > {
    const res = await piFetch(`${PI_URL}/api/templates`);
    return res.json();
  },

  async getTemplate(
    id: string
  ): Promise<{
    id: string;
    name: string;
    thumbnail: string;
    state: string;
    created_at: string;
    updated_at: string;
  }> {
    const res = await piFetch(`${PI_URL}/api/templates/${id}`);
    return res.json();
  },

  async updateTemplate(
    id: string,
    data: { name?: string; state?: string; thumbnail?: string }
  ): Promise<void> {
    await piFetch(`${PI_URL}/api/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async deleteTemplate(id: string): Promise<void> {
    await piFetch(`${PI_URL}/api/templates/${id}`, { method: "DELETE" });
  },

  // ── Gallery ──────────────────────────────

  async saveToGallery(
    blob: Blob,
    type: string = "print",
    templateId?: string
  ): Promise<{ id: string; filename: string }> {
    const form = new FormData();
    form.append("file", blob, "image.png");
    form.append("type", type);
    if (templateId) form.append("template_id", templateId);
    const res = await piFetch(`${PI_URL}/api/gallery`, { method: "POST", body: form });
    return res.json();
  },

  async listGallery(
    type?: string
  ): Promise<
    { id: string; filename: string; type: string; template_id: string | null; created_at: string }[]
  > {
    const url = type ? `${PI_URL}/api/gallery?type=${type}` : `${PI_URL}/api/gallery`;
    const res = await piFetch(url);
    return res.json();
  },

  async deleteGalleryItem(id: string): Promise<void> {
    await piFetch(`${PI_URL}/api/gallery/${id}`, { method: "DELETE" });
  },

  // ── Cafe Config ─────────────────────────────

  async getConfig(): Promise<Record<string, unknown>> {
    const res = await piFetch(`${PI_URL}/api/config`);
    return res.json();
  },

  async putConfig(config: Record<string, unknown>): Promise<void> {
    await piFetch(`${PI_URL}/api/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  },

  // ── Thumbnail upload ──────────────────────

  async uploadThumbnail(blob: Blob): Promise<{ filename: string }> {
    const form = new FormData();
    form.append("file", blob, "thumbnail.png");
    const res = await piFetch(`${PI_URL}/api/upload/thumbnail`, { method: "POST", body: form });
    return res.json();
  },
};
