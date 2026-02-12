const PI_URL = process.env.NEXT_PUBLIC_PI_URL || "http://monster-pi.local:5000";

export interface StickerParam {
  filename: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
}

export interface GridPhotoParam {
  filename: string;
  x?: number; // freestyle percentage positions
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
  // Header sub-text
  header_text?: string;
  header_text_font?: string;
  header_text_size?: number;
  header_text_bold?: boolean;
  header_text_italic?: boolean;
  header_text_underline?: boolean;
}

export const api = {
  base: PI_URL,

  async health(): Promise<{ status: string; camera: boolean; printer: boolean }> {
    const res = await fetch(`${PI_URL}/api/health`);
    return res.json();
  },

  async uploadLogo(file: File | Blob): Promise<{ url: string; filename: string }> {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "cropped_logo.png");
    const res = await fetch(`${PI_URL}/api/upload/logo`, { method: "POST", body: form });
    return res.json();
  },

  async uploadPhoto(file: File | Blob): Promise<{ url: string; filename: string }> {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "cropped_photo.png");
    const res = await fetch(`${PI_URL}/api/upload/photo`, { method: "POST", body: form });
    return res.json();
  },

  async capturePhoto(): Promise<{ url: string; filename: string }> {
    const res = await fetch(`${PI_URL}/api/camera/capture`, { method: "POST" });
    return res.json();
  },

  async cameraStatus(): Promise<{ available: boolean; info: string }> {
    const res = await fetch(`${PI_URL}/api/camera/status`);
    return res.json();
  },

  async printEnqueue(params: PrintParams): Promise<{ job_id: string }> {
    const res = await fetch(`${PI_URL}/api/print/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async printStatus(jobId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${PI_URL}/api/print/status/${jobId}`);
    return res.json();
  },

  async uploadSticker(file: File | Blob): Promise<{ url: string; filename: string }> {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "sticker.png");
    const res = await fetch(`${PI_URL}/api/upload/sticker`, { method: "POST", body: form });
    return res.json();
  },

  imageUrl(filename: string): string {
    return `${PI_URL}/api/images/${filename}`;
  },
};
