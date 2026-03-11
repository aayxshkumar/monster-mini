/**
 * Generate 12 BEST filter combinations as print-ready 576px thermal images.
 * Each image has a number label at the top and filter info so the user
 * can identify them after printing on the thermal printer.
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const INPUT = join(import.meta.dirname, "archivio-dashboard/public/test-photo.jpg");
const OUT_DIR = join(import.meta.dirname, "print-ready");
const PRINT_W = 576; // thermal printer width

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── Filter pipeline (same as receipt-canvas.tsx) ────────────
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
function applyContrastBrightness(data, contrast, brightness) {
  for (let i = 0; i < data.length; i += 4) {
    let v = data[i];
    v = (v - 128) * contrast + 128 + brightness;
    v = Math.max(0, Math.min(255, v));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

const BAYER_8 = [
   0, 32,  8, 40,  2, 34, 10, 42,  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,  63, 31, 55, 23, 61, 29, 53, 21,
].map(v => (v / 63) * 255);

function ditheringFloydSteinberg(data, w, h) {
  const buf = new Float32Array(w * h);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const idx = y * w + x; const old = buf[idx]; const nw = old < 128 ? 0 : 255;
    const err = old - nw; buf[idx] = nw;
    if (x + 1 < w) buf[idx + 1] += err * 7 / 16;
    if (y + 1 < h) { if (x > 0) buf[idx + w - 1] += err * 3 / 16; buf[idx + w] += err * 5 / 16; if (x + 1 < w) buf[idx + w + 1] += err / 16; }
  }
  for (let i = 0; i < buf.length; i++) { const v = Math.max(0, Math.min(255, buf[i])); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; }
}
function ditheringAtkinson(data, w, h) {
  const buf = new Float32Array(w * h);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const idx = y * w + x; const old = buf[idx]; const nw = old < 128 ? 0 : 255;
    const err = Math.round((old - nw) / 8); buf[idx] = nw;
    if (x + 1 < w) buf[idx + 1] += err; if (x + 2 < w) buf[idx + 2] += err;
    if (y + 1 < h) { if (x > 0) buf[idx + w - 1] += err; buf[idx + w] += err; if (x + 1 < w) buf[idx + w + 1] += err; }
    if (y + 2 < h) buf[idx + w * 2] += err;
  }
  for (let i = 0; i < buf.length; i++) { const v = Math.max(0, Math.min(255, buf[i])); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; }
}
function ditheringStucki(data, w, h) {
  const buf = new Float32Array(w * h);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];
  const add = (idx, err) => { if (idx >= 0 && idx < buf.length) buf[idx] += err; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const idx = y * w + x; const old = buf[idx]; const nw = old < 128 ? 0 : 255;
    const err = old - nw; buf[idx] = nw; const e = err / 42;
    add(idx + 1, e * 8); add(idx + 2, e * 4);
    if (y + 1 < h) { add(idx + w - 2, e * 2); add(idx + w - 1, e * 4); add(idx + w, e * 8); add(idx + w + 1, e * 4); add(idx + w + 2, e * 2); }
    if (y + 2 < h) { add(idx + w * 2 - 2, e); add(idx + w * 2 - 1, e * 2); add(idx + w * 2, e * 4); add(idx + w * 2 + 1, e * 2); add(idx + w * 2 + 2, e); }
  }
  for (let i = 0; i < buf.length; i++) { const v = Math.max(0, Math.min(255, buf[i])); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; }
}
function ditheringBayer8(data, w) {
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % w; const py = Math.floor(i / 4 / w);
    const v = data[i] < BAYER_8[(py % 8) * 8 + (px % 8)] ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

function processCombo(rawData, w, h, filter, algo, brightness) {
  const data = new Uint8ClampedArray(rawData);
  if (filter === "sepia" || filter === "vintage") applySepiaGray(data); else applyGrayscale(data);
  const cMap = { low: 0.75, medium: 1.1, high: 1.5 };
  const bMap = { low: -20, medium: 8, high: 25 };
  const boost = filter === "vintage" ? 0.25 : filter === "contrast" ? 0.4 : 0;
  applyContrastBrightness(data, (cMap[brightness] ?? 1.1) + boost, bMap[brightness] ?? 8);
  switch (algo) {
    case "atkinson": ditheringAtkinson(data, w, h); break;
    case "floyd_steinberg": ditheringFloydSteinberg(data, w, h); break;
    case "stucki": ditheringStucki(data, w, h); break;
    case "bayer8": ditheringBayer8(data, w); break;
  }
  return data;
}

// ── 12 best combinations ───────────────────────────────────
const BEST = [
  { num: 1,  orig: 8,  filter: "none",     algo: "stucki",          bright: "medium", label: "Standard BW - Stucki - Medium" },
  { num: 2,  orig: 5,  filter: "none",     algo: "floyd_steinberg", bright: "medium", label: "Standard BW - Floyd-Steinberg - Medium" },
  { num: 3,  orig: 2,  filter: "none",     algo: "atkinson",        bright: "medium", label: "Standard BW - Atkinson - Medium" },
  { num: 4,  orig: 20, filter: "sepia",    algo: "stucki",          bright: "medium", label: "Warm Sepia - Stucki - Medium" },
  { num: 5,  orig: 14, filter: "sepia",    algo: "atkinson",        bright: "medium", label: "Warm Sepia - Atkinson - Medium" },
  { num: 6,  orig: 17, filter: "sepia",    algo: "floyd_steinberg", bright: "medium", label: "Warm Sepia - Floyd-Steinberg - Medium" },
  { num: 7,  orig: 44, filter: "vintage",  algo: "stucki",          bright: "medium", label: "Vintage - Stucki - Medium" },
  { num: 8,  orig: 38, filter: "vintage",  algo: "atkinson",        bright: "medium", label: "Vintage - Atkinson - Medium" },
  { num: 9,  orig: 56, filter: "contrast", algo: "stucki",          bright: "medium", label: "High Contrast - Stucki - Medium" },
  { num: 10, orig: 11, filter: "none",     algo: "bayer8",          bright: "medium", label: "Standard BW - Newspaper - Medium" },
  { num: 11, orig: 47, filter: "vintage",  algo: "bayer8",          bright: "medium", label: "Vintage - Newspaper - Medium" },
  { num: 12, orig: 9,  filter: "none",     algo: "stucki",          bright: "high",   label: "Standard BW - Stucki - High" },
];

async function main() {
  console.log("Loading image at 576px print width...");
  const resized = await sharp(INPUT)
    .resize(PRINT_W, null, { fit: "inside" })
    .raw().ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const W = resized.info.width;
  const H = resized.info.height;
  const rawData = new Uint8ClampedArray(resized.data);
  console.log(`Image: ${W}x${H}`);

  // Label height for the number + description header
  const LABEL_H = 60;
  const FOOTER_H = 40;
  const GAP = 20; // whitespace between label and photo

  for (const combo of BEST) {
    console.log(`  #${String(combo.num).padStart(2, "0")} — ${combo.label}`);

    const processed = processCombo(rawData, W, H, combo.filter, combo.algo, combo.bright);

    // Create the processed photo buffer
    const photoBuf = await sharp(Buffer.from(processed.buffer), {
      raw: { width: W, height: H, channels: 4 }
    }).removeAlpha().png().toBuffer();

    // Build header label SVG with number
    const headerSvg = Buffer.from(`<svg width="${W}" height="${LABEL_H}">
      <rect width="100%" height="100%" fill="white"/>
      <text x="${W/2}" y="32" font-family="monospace" font-size="28" font-weight="bold" fill="black" text-anchor="middle">#${String(combo.num).padStart(2, "0")}</text>
      <text x="${W/2}" y="52" font-family="sans-serif" font-size="13" fill="#555" text-anchor="middle">${combo.label}</text>
    </svg>`);

    // Build footer with separator line
    const footerSvg = Buffer.from(`<svg width="${W}" height="${FOOTER_H}">
      <rect width="100%" height="100%" fill="white"/>
      <line x1="20" y1="20" x2="${W - 20}" y2="20" stroke="#ccc" stroke-width="1" stroke-dasharray="4,4"/>
    </svg>`);

    // Gap (white space)
    const gapBuf = await sharp({
      create: { width: W, height: GAP, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).png().toBuffer();

    // Compose: header + gap + photo + footer
    const totalH = LABEL_H + GAP + H + FOOTER_H;
    await sharp({
      create: { width: W, height: totalH, channels: 3, background: { r: 255, g: 255, b: 255 } }
    })
      .composite([
        { input: headerSvg, top: 0, left: 0 },
        { input: gapBuf, top: LABEL_H, left: 0 },
        { input: photoBuf, top: LABEL_H + GAP, left: 0 },
        { input: footerSvg, top: LABEL_H + GAP + H, left: 0 },
      ])
      .png()
      .toFile(join(OUT_DIR, `print_${String(combo.num).padStart(2, "0")}.png`));
  }

  // Also generate a single "all 12 in sequence" file for batch printing
  console.log("\nBuilding batch print file (all 12 in sequence)...");
  const singleH = LABEL_H + GAP + H + FOOTER_H;
  const batchH = singleH * BEST.length;

  const allComposites = [];
  for (let i = 0; i < BEST.length; i++) {
    const imgBuf = await sharp(join(OUT_DIR, `print_${String(BEST[i].num).padStart(2, "0")}.png`)).toBuffer();
    allComposites.push({ input: imgBuf, top: i * singleH, left: 0 });
  }

  await sharp({
    create: { width: W, height: batchH, channels: 3, background: { r: 255, g: 255, b: 255 } }
  })
    .composite(allComposites)
    .png()
    .toFile(join(OUT_DIR, "BATCH_ALL_12.png"));

  console.log(`\nDone! 12 print-ready images saved to ${OUT_DIR}/`);
  console.log(`  - Individual: print_01.png through print_12.png`);
  console.log(`  - Batch: BATCH_ALL_12.png (all 12 in one continuous strip)`);
  console.log(`\nEach image is ${W}px wide (thermal printer native resolution)`);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║              12 BEST COMBOS — PRINT READY                  ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  for (const c of BEST) {
    console.log(`║ #${String(c.num).padStart(2,"0")} │ ${c.label.padEnd(48)} ║`);
  }
  console.log("╚══════════════════════════════════════════════════════════════╝");
}

main().catch(console.error);
