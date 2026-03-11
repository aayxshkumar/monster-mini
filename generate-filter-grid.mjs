/**
 * Generate all 60 filter combinations for a portrait photo.
 * Uses the exact same pipeline as receipt-canvas.tsx:
 *   1. Colour cast (grayscale or sepia)
 *   2. Contrast/brightness adjustment
 *   3. Dithering algorithm
 *
 * Output: numbered PNG files + a contact sheet grid.
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// ── Configuration ──────────────────────────────────────────
const INPUT = join(import.meta.dirname, "archivio-dashboard/public/test-photo.jpg");
const OUT_DIR = join(import.meta.dirname, "filter-outputs");
const THUMB_W = 300; // thumbnail width for each combo

const FILTERS = ["none", "sepia", "grayscale", "vintage", "contrast"];
const ALGORITHMS = ["atkinson", "floyd_steinberg", "stucki", "bayer8"];
const BRIGHTNESSES = ["low", "medium", "high"];

const FILTER_LABELS = {
  none: "Standard BW",
  sepia: "Warm Sepia",
  grayscale: "Grayscale",
  vintage: "Vintage",
  contrast: "High Contrast",
};
const ALGO_LABELS = {
  atkinson: "Film Grain",
  floyd_steinberg: "Fine Detail",
  stucki: "High Quality",
  bayer8: "Newspaper",
};

// ── Grayscale / colour cast ────────────────────────────────
function applyGrayscale(data) {
  for (let i = 0; i < data.length; i += 4) {
    const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    data[i] = data[i + 1] = data[i + 2] = l;
  }
}

function applySepiaGray(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const sr = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
    const sg = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
    const sb = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    const l = sr * 0.2126 + sg * 0.7152 + sb * 0.0722;
    data[i] = data[i + 1] = data[i + 2] = l;
  }
}

// ── Contrast / brightness ──────────────────────────────────
function applyContrastBrightness(data, contrast, brightness) {
  for (let i = 0; i < data.length; i += 4) {
    let v = data[i];
    v = (v - 128) * contrast + 128 + brightness;
    v = Math.max(0, Math.min(255, v));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

// ── Dithering algorithms ───────────────────────────────────
const BAYER_8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v / 63) * 255);

function ditheringFloydSteinberg(data, width, height) {
  const buf = new Float32Array(width * height);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = buf[idx];
      const nw = old < 128 ? 0 : 255;
      const err = old - nw;
      buf[idx] = nw;
      if (x + 1 < width) buf[idx + 1] += err * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) buf[idx + width - 1] += err * 3 / 16;
        buf[idx + width] += err * 5 / 16;
        if (x + 1 < width) buf[idx + width + 1] += err * 1 / 16;
      }
    }
  }
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(0, Math.min(255, buf[i]));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
  }
}

function ditheringAtkinson(data, width, height) {
  const buf = new Float32Array(width * height);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = buf[idx];
      const nw = old < 128 ? 0 : 255;
      const err = Math.round((old - nw) / 8);
      buf[idx] = nw;
      if (x + 1 < width) buf[idx + 1] += err;
      if (x + 2 < width) buf[idx + 2] += err;
      if (y + 1 < height) {
        if (x > 0) buf[idx + width - 1] += err;
        buf[idx + width] += err;
        if (x + 1 < width) buf[idx + width + 1] += err;
      }
      if (y + 2 < height) buf[idx + width * 2] += err;
    }
  }
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(0, Math.min(255, buf[i]));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
  }
}

function ditheringStucki(data, width, height) {
  const buf = new Float32Array(width * height);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];

  const add = (idx, err) => {
    if (idx >= 0 && idx < buf.length) buf[idx] += err;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = buf[idx];
      const nw = old < 128 ? 0 : 255;
      const err = old - nw;
      buf[idx] = nw;
      const e = err / 42;
      add(idx + 1, e * 8);
      add(idx + 2, e * 4);
      if (y + 1 < height) {
        add(idx + width - 2, e * 2);
        add(idx + width - 1, e * 4);
        add(idx + width,     e * 8);
        add(idx + width + 1, e * 4);
        add(idx + width + 2, e * 2);
      }
      if (y + 2 < height) {
        add(idx + width * 2 - 2, e * 1);
        add(idx + width * 2 - 1, e * 2);
        add(idx + width * 2,     e * 4);
        add(idx + width * 2 + 1, e * 2);
        add(idx + width * 2 + 2, e * 1);
      }
    }
  }
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(0, Math.min(255, buf[i]));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
  }
}

function ditheringBayer8(data, width) {
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % width;
    const py = Math.floor(i / 4 / width);
    const threshold = BAYER_8[(py % 8) * 8 + (px % 8)];
    const v = data[i] < threshold ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

// ── Process one combination ────────────────────────────────
function processCombo(rawData, width, height, filterName, algorithm, brightness) {
  // Clone
  const data = new Uint8ClampedArray(rawData);

  // Step 1: colour cast
  if (filterName === "sepia" || filterName === "vintage") {
    applySepiaGray(data);
  } else {
    applyGrayscale(data);
  }

  // Step 2: contrast / brightness
  const contrastMap = { low: 0.75, medium: 1.1, high: 1.5 };
  const brightnessMap = { low: -20, medium: 8, high: 25 };
  const filterContrastBoost = filterName === "vintage" ? 0.25 : filterName === "contrast" ? 0.4 : 0;
  const c = (contrastMap[brightness] ?? 1.1) + filterContrastBoost;
  const b = brightnessMap[brightness] ?? 8;
  applyContrastBrightness(data, c, b);

  // Step 3: dithering
  switch (algorithm) {
    case "atkinson":       ditheringAtkinson(data, width, height); break;
    case "floyd_steinberg": ditheringFloydSteinberg(data, width, height); break;
    case "stucki":         ditheringStucki(data, width, height); break;
    case "bayer8":         ditheringBayer8(data, width); break;
    default:               ditheringFloydSteinberg(data, width, height); break;
  }

  return data;
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log("Loading image...");
  // Resize to a reasonable processing size
  const img = sharp(INPUT).resize(THUMB_W, null, { fit: "inside" });
  const { width, height, channels } = await img.metadata();
  const resized = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const W = resized.info.width;
  const H = resized.info.height;
  console.log(`Image: ${W}x${H}, ${resized.info.channels}ch`);

  const rawData = new Uint8ClampedArray(resized.data);
  let combo = 1;
  const results = [];

  console.log("Processing 60 combinations...\n");

  for (const filter of FILTERS) {
    for (const algo of ALGORITHMS) {
      for (const bright of BRIGHTNESSES) {
        const label = `#${String(combo).padStart(2, "0")} | ${FILTER_LABELS[filter]} + ${ALGO_LABELS[algo]} + ${bright}`;
        process.stdout.write(`  ${label}\r`);

        const processed = processCombo(rawData, W, H, filter, algo, bright);

        // Save individual file
        const filename = `${String(combo).padStart(2, "0")}_${filter}_${algo}_${bright}.png`;
        await sharp(Buffer.from(processed.buffer), { raw: { width: W, height: H, channels: 4 } })
          .png()
          .toFile(join(OUT_DIR, filename));

        results.push({ combo, filter, algo, bright, filename, label });
        combo++;
      }
    }
  }

  console.log(`\nDone! ${results.length} combinations saved to ${OUT_DIR}`);

  // ── Build contact sheet (grid of all combos) ─────────────
  console.log("\nBuilding contact sheet...");

  // Layout: 5 filters (rows) × 4 algos (cols) × 3 brightness sub-cols = 12 cols × 5 rows
  // But 60 images is better as 12 cols × 5 rows
  const COLS = 12; // 4 algos × 3 brightness levels
  const ROWS = 5;  // 5 filters
  const LABEL_H = 30; // height for label
  const cellW = W;
  const cellH = H + LABEL_H;
  const HEADER_H = 40;
  const ROW_LABEL_W = 140;
  const gridW = ROW_LABEL_W + COLS * cellW;
  const gridH = HEADER_H + ROWS * cellH;

  // Create composites array
  const composites = [];

  // Column headers
  let colIdx = 0;
  for (const algo of ALGORITHMS) {
    for (const bright of BRIGHTNESSES) {
      const headerText = `${ALGO_LABELS[algo]} - ${bright}`;
      const headerSvg = Buffer.from(`<svg width="${cellW}" height="${HEADER_H}">
        <rect width="100%" height="100%" fill="#f5f0eb"/>
        <text x="${cellW/2}" y="${HEADER_H/2 + 5}" font-family="sans-serif" font-size="10" fill="#333" text-anchor="middle">${headerText}</text>
      </svg>`);
      composites.push({
        input: headerSvg,
        top: 0,
        left: ROW_LABEL_W + colIdx * cellW,
      });
      colIdx++;
    }
  }

  // For each combination, place the image in the grid
  let idx = 0;
  for (let row = 0; row < ROWS; row++) {
    // Row label
    const filter = FILTERS[row];
    const rowLabelSvg = Buffer.from(`<svg width="${ROW_LABEL_W}" height="${cellH}">
      <rect width="100%" height="100%" fill="#f5f0eb"/>
      <text x="${ROW_LABEL_W/2}" y="${cellH/2}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#333" text-anchor="middle" transform="rotate(-90,${ROW_LABEL_W/2},${cellH/2})">${FILTER_LABELS[filter]}</text>
    </svg>`);
    composites.push({
      input: rowLabelSvg,
      top: HEADER_H + row * cellH,
      left: 0,
    });

    for (let col = 0; col < COLS; col++) {
      const r = results[idx];
      // Number label at top
      const labelSvg = Buffer.from(`<svg width="${cellW}" height="${LABEL_H}">
        <rect width="100%" height="100%" fill="#f5f0eb"/>
        <text x="${cellW/2}" y="20" font-family="monospace" font-size="14" font-weight="bold" fill="#c4956a" text-anchor="middle">#${String(r.combo).padStart(2, "0")}</text>
      </svg>`);
      composites.push({
        input: labelSvg,
        top: HEADER_H + row * cellH,
        left: ROW_LABEL_W + col * cellW,
      });

      // Image
      const imgBuf = await sharp(join(OUT_DIR, r.filename)).toBuffer();
      composites.push({
        input: imgBuf,
        top: HEADER_H + row * cellH + LABEL_H,
        left: ROW_LABEL_W + col * cellW,
      });

      idx++;
    }
  }

  // Create background
  await sharp({
    create: {
      width: gridW,
      height: gridH,
      channels: 3,
      background: { r: 245, g: 240, b: 235 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(join(OUT_DIR, "CONTACT_SHEET.jpg"));

  console.log(`Contact sheet saved: ${OUT_DIR}/CONTACT_SHEET.jpg (${gridW}x${gridH})`);

  // Print summary table
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    ALL 60 FILTER COMBINATIONS                   ║");
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  for (const r of results) {
    console.log(`║ #${String(r.combo).padStart(2, "0")} │ ${FILTER_LABELS[r.filter].padEnd(14)} │ ${ALGO_LABELS[r.algo].padEnd(12)} │ ${r.bright.padEnd(6)} ║`);
  }
  console.log("╚══════════════════════════════════════════════════════════════════╝");
}

main().catch(console.error);
