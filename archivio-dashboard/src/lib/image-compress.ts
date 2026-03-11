const THUMB_SIZE = 800;
const SOCIAL_SIZE = 1080;
const THUMB_QUALITY = 0.82;
const SOCIAL_QUALITY = 0.85;

function drawToCanvas(
  img: ImageBitmap,
  maxSize: number
): { canvas: HTMLCanvasElement; width: number; height: number } {
  let { width, height } = img;
  if (width > maxSize || height > maxSize) {
    const r = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * r);
    height = Math.round(height * r);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d not available");
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

function canvasToWebP(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/webp",
      quality
    );
  });
}

export interface CompressedResult {
  original: Blob;
  thumbnail: Blob;
  social: Blob;
}

export async function compressForUpload(blob: Blob): Promise<CompressedResult> {
  const img = await createImageBitmap(blob);
  const thumb = drawToCanvas(img, THUMB_SIZE);
  const social = drawToCanvas(img, SOCIAL_SIZE);
  img.close();
  const [thumbnail, socialBlob] = await Promise.all([
    canvasToWebP(thumb.canvas, THUMB_QUALITY),
    canvasToWebP(social.canvas, SOCIAL_QUALITY),
  ]);
  return {
    original: blob,
    thumbnail,
    social: socialBlob,
  };
}
