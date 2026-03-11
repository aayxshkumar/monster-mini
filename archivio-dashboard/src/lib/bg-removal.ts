/**
 * Shared background removal utility using @imgly/background-removal.
 * Uses the lighter `isnet_quint8` model and disables worker proxy for Next.js compatibility.
 */

// Max dimension to scale images down to before BG removal (saves memory + time)
const MAX_DIM = 1024;
// Timeout in ms — abort if BG removal takes too long
const TIMEOUT_MS = 120_000; // 2 minutes

export async function removeBackground(
  imageUrl: string,
  onProgress?: (msg: string) => void,
): Promise<string> {
  onProgress?.("Loading BG removal model...");
  const { removeBackground: removeBg } = await import("@imgly/background-removal");

  // Load and re-encode to proper PNG blob for the WASM model
  onProgress?.("Preparing image...");
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });

  // Scale down large images to prevent WASM OOM and speed up processing
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > MAX_DIM || h > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const inputBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), "image/png");
  });

  console.log("[BG Removal] Starting, blob size:", inputBlob.size, `dimensions: ${w}x${h}`);
  onProgress?.("Downloading AI model...");

  // Race the BG removal against a timeout to prevent infinite hangs
  const resultBlob = await Promise.race([
    removeBg(inputBlob, {
      model: "isnet_quint8",    // smaller/faster model (~10MB vs ~40MB)
      proxyToWorker: false,     // disable worker — prevents Next.js hanging
      device: "cpu",
      output: { format: "image/png" as const, quality: 1 },
      progress: (key: string, current: number, total: number) => {
        const pct = Math.round((current / total) * 100);
        console.log(`[BG Removal] ${key}: ${pct}%`);
        if (key.includes("fetch") || key.includes("download")) {
          onProgress?.(`Downloading model... ${pct}%`);
        } else if (key.includes("compute") || key.includes("inference")) {
          onProgress?.(`Processing image... ${pct}%`);
        } else {
          onProgress?.(`${key}... ${pct}%`);
        }
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Background removal timed out")), TIMEOUT_MS)
    ),
  ]);

  console.log("[BG Removal] Done, result size:", resultBlob.size);
  onProgress?.("Background removed!");
  return URL.createObjectURL(resultBlob);
}
