# Photo Booth Dashboard — Mega Update Plan

## Phase 1: Critical Fixes (Print, Crop, Sticker Handles, Queue)

### 1A. Fix Crop Dialog — Don't auto-zoom
**File: `src/components/crop-dialog.tsx`**
- Change `react-easy-crop` props: set `minZoom={0.5}`, default `zoom` to fit entire image
- Add `showGrid` prop, `cropSize` awareness so the default view shows the full image
- Add `objectFit="contain"` style so the full image is visible at zoom=1

### 1B. Fix Sticker Layer — Handles floating off
**File: `src/components/sticker-layer.tsx`**
- The close (X) and resize handle use `absolute -top-2 -right-2` and `-bottom-1 -right-1` which are relative to the outer div. These are correct — the bug is that the outer div positions via `left/top` in pixels but the image uses `object-contain` which may not fill the div.
- Fix: Change image from `object-contain` to `object-cover` or ensure the div size matches the actual rendered image dimensions. Better approach: keep `object-contain` but position handles relative to the image bounds, not the container.
- Simplest fix: Remove `object-contain`, use `object-fill` so image fills the box completely. Handles stay at corners of the box.

### 1C. Fix Print Queue — Cancel/Remove stuck jobs
**File: `src/components/print-queue-panel.tsx`**
- Add a remove button (X) on each job badge for pending/printing/error jobs
- **File: `src/store/booth-store.ts`** — Add `removePrintJob(id)` action
- **File: `src/lib/api.ts`** — Add `cancelPrintJob(id)` API call
- **File: Flask backend** — Add `DELETE /api/print/queue/<job_id>` endpoint to cancel/remove jobs

### 1D. Fix Grid/Freestyle Photos Not Printing
**File: `src/app/page.tsx` (handlePrint)**
- The grid photo upload already works from last session. But the backend `build_receipt_from_params` doesn't handle `grid_photos` param at all! Only handles single `photo`.
- **File: Flask backend** — Add grid photo compositing in `build_receipt_from_params`: read `grid_photos` list, create a composite image using PIL, lay out per grid_layout or freestyle positions.

### 1E. Send Stickers to Printer
**File: `src/app/page.tsx` (handlePrint)**
- Before printing, upload each sticker image (from blob URLs) to Pi
- Send sticker positions as percentage-based coordinates (relative to 280px preview → 576px print)
- **File: `src/lib/api.ts`** — Add `uploadSticker(file)` API, add `stickers` field to `PrintParams`
- **File: Flask backend** — Add sticker upload endpoint + sticker compositing in `build_receipt_from_params`: load sticker PNGs with alpha, composite onto receipt after section assembly but before final dithering. Use PIL paste with mask.

### 1F. Rounded Corners on Printed Photo
**File: Flask backend (build_receipt_from_params)**
- After resizing photo but before dithering, apply rounded corner mask using PIL: draw rounded rectangle on alpha channel, paste with mask.

---

## Phase 2: Header Text, Memo Formatting, Stamps

### 2A. Header Sub-text Option
**File: `src/store/booth-store.ts`**
- Add fields: `headerTextEnabled: boolean`, `headerText: string`, `headerTextFont: string`, `headerTextSize: number`, `headerTextBold: boolean`, `headerTextItalic: boolean`, `headerTextUnderline: boolean`
- Add setters for each

**File: `src/app/page.tsx`**
- Below header height slider, add a Switch "Add text below logo"
- If enabled: text input, font picker (reuse FontPicker pattern), size slider, B/I/U toggle buttons

**File: `src/components/receipt-canvas.tsx`**
- In `renderSection("logo")`, render header text below the logo image

**File: Flask backend**
- Add `header_text`, `header_text_font_size`, `header_text_bold`, `header_text_italic`, `header_text_underline` params
- Render text below logo in `create_logo_section`

### 2B. Bold/Italic/Underline for Memo
**File: `src/store/booth-store.ts`**
- Add: `memoBold: boolean`, `memoItalic: boolean`, `memoUnderline: boolean` + setters

**File: `src/components/font-picker.tsx`**
- Add B/I/U toggle buttons row below font selector

**File: `src/components/receipt-canvas.tsx`**
- Apply `fontWeight: bold`, `fontStyle: italic`, `textDecoration: underline` to memo text

**File: Flask backend**
- Accept `memo_bold`, `memo_italic`, `memo_underline` params, use bold font variant for thermal print

### 2C. Split Date/Time/Location Stamps
**File: `src/store/booth-store.ts`**
- Replace `stampEnabled`/`stampText` with: `dateStampEnabled`, `timeStampEnabled`, `locationStampEnabled`, `locationText`
- Add setters

**File: `src/app/page.tsx`**
- 3 separate Switch toggles: Date, Time, Location
- Location: text input field (type address/place name)

**File: `src/components/receipt-canvas.tsx`**
- Render stamp section with date | time | location as separate lines

**File: Flask backend**
- Accept individual stamp fields, compose stamp text on backend

---

## Phase 3: Doodles System

### 3A. Doodle Types & Store
**File: `src/store/booth-store.ts`**
- Add `Doodle` interface: `{ id, type: "image"|"text", src?, text?, fontFamily?, x, y, width, height, rotation }`
- Add `doodleLibrary: Doodle[]`, `doodles: Doodle[]` (placed on receipt)
- Add actions: `addDoodleToLibrary`, `removeDoodleFromLibrary`, `addDoodle`, `updateDoodle`, `removeDoodle`

### 3B. Premade Doodles
**File: NEW `src/lib/premade-doodles.ts`**
- Define ~15 premade text doodles with fancy fonts: "xoxo", "♡", "bestie", "vibes", "mood", etc.
- Each has a default font from GOOGLE_FONTS (script/display category)

### 3C. Doodle Panel Component
**File: NEW `src/components/doodle-panel.tsx`**
- Below sticker panel (or as second tab in column 3)
- Two sub-sections: "Image Doodles" (upload), "Text Doodles" (premade + custom)
- Text doodle: click to edit text, choose font, add to receipt
- Click any doodle thumbnail → adds to receipt as draggable/resizable/rotatable element

### 3D. Doodle Layer Component
**File: NEW `src/components/doodle-layer.tsx`**
- Similar to `sticker-layer.tsx` but supports:
  - Image doodles: same as sticker (drag, resize)
  - Text doodles: render text in chosen font, double-click to edit, rotation handle
  - Rotation handle (circular handle at top-center, drag to rotate)

### 3E. Doodle Overlay on Receipt
**File: `src/components/receipt-canvas.tsx`**
- Add `<DoodlesOverlay>` alongside `<StickersOverlay>`

### 3F. Print Doodles
**File: Flask backend**
- Accept `doodles` array in print params
- For image doodles: composite like stickers
- For text doodles: render text with PIL at specified position/rotation/font

---

## Phase 4: More Layouts, Font Range, Header Range

### 4A. Expand Grid Layouts
**File: `src/lib/grid-layouts.ts`**
- Add ~20 more layouts:
  - 2 photos: diagonal, overlap, polaroid stack, big-small
  - 3 photos: T-shape, L-shape, panoramic strip, feature+2 small
  - 4 photos: diamond, 3+1 banner, horizontal strip, masonry
  - 5 photos: cross, pentagon, magazine style
  - 6 photos: 3x2 variations, honeycomb, mosaic

**File: `src/store/booth-store.ts`**
- Update `GRID_LAYOUT_OPTIONS` to include new layout keys

### 4B. Expand Font Sizes & Header Range
**File: `src/app/page.tsx`**
- Header height slider: expand range from `24–120` to `10–200`
- Font size slider: expand from `8–28` to `6–48`

**File: `src/components/font-picker.tsx`**
- Update size slider max to 48

### 4C. More Aspect Ratios
- Already have: free, 1:1, 4:3, 3:4, 4:5, 2:3, 9:16, 16:9
- Add: 5:4, 3:2, 1:2, 2:1 (horizontal panorama)

---

## Phase 5: Background Removal, Paste URLs, Pinterest

### 5A. Client-side Background Removal
**File: NEW `src/lib/bg-removal.ts`**
- Use `@imgly/background-removal` npm package (runs in browser via WASM/WebGL)
- Export `removeBackground(imageBlob): Promise<Blob>`
- Toggle in sticker panel: "Remove BG" checkbox before adding

**File: `src/components/sticker-panel.tsx`**
- Add toggle switch "Remove background"
- When uploading sticker, if toggle is on, process through bg removal before adding to library

### 5B. Paste Image URLs
**File: `src/app/page.tsx`**
- Add global `paste` event listener
- Detect pasted image files (from clipboard) or URLs (text starting with http)
- For URLs: fetch the image, create blob, add to sticker library or photo slot
- For image data: read from clipboard API, add directly

### 5C. Pinterest URL Support
**File: `src/lib/api.ts`**
- Add `fetchExternalImage(url)` endpoint on backend
- **File: Flask backend** — Add `POST /api/fetch-image` that downloads from URL (handles Pinterest redirects), saves to uploads, returns filename
- Frontend: detect Pinterest URLs (pin.it, pinterest.com), send to backend for download

---

## Phase 6: Image Gallery & QR Page

### 6A. Save Printed Images on Pi
**File: Flask backend**
- In `build_receipt_from_params`, save both the receipt (B&W) and original photo (color) with unique IDs
- Save to `gallery/` directory: `{id}_receipt.png`, `{id}_original.jpg`
- Add endpoint: `GET /api/gallery` — list saved images
- Add endpoint: `GET /api/gallery/<id>` — get image details + serve files

### 6B. QR Code Auto-Link Toggle
**File: `src/store/booth-store.ts`**
- Add `qrMode: "auto" | "custom"`, setter
- When "auto": QR points to `http://{pi-ip}:5000/gallery/{image-id}`
- When "custom": user enters URL

**File: `src/app/page.tsx`**
- Toggle between "Auto (image page)" and "Custom URL" for QR section

### 6C. Image Gallery Page (New Next.js Route)
**File: NEW `src/app/gallery/[id]/page.tsx`**
- Server-side or client-side fetch from Pi
- Layout: Beautiful centered colorful image, gradient background
- 3 buttons: "Save to Device" (download link), "Customize", "Share"
- Share: Use `navigator.share()` API with fallback
- Customize: Opens effect picker

### 6D. Image Effects/Customization
**File: NEW `src/components/image-effects.tsx`**
- 10+ CSS/Canvas effects: duotone, halftone, vintage, noir, sepia, high contrast, pop art, thermal, sketch, vignette
- Preview grid showing all effects applied to the image
- Click to select, then save/download/share

**File: NEW `src/lib/image-effects.ts`**
- Canvas-based effect functions for each effect type
- Each takes an image blob, returns processed blob

---

## Phase 7: Freestyle Resize, Crop Enhancements

### 7A. Freestyle Image Resize Handles
**File: `src/components/receipt-canvas.tsx` (FreePhoto)**
- Add resize handle (bottom-right corner) to FreePhoto component
- Track mouse drag to update `w` and `h` in store
- Add crop button (scissors icon) that opens CropDialog for individual grid photos

**File: `src/components/photo-grid-editor.tsx` (DraggableGridPhoto)**
- Same resize handles in the mini preview

### 7B. Crop Utils Update
**File: `src/lib/crop-utils.ts`**
- Update `getAspectNumber` to support all new ratios (4:5, 9:16, 16:9, 2:3, 5:4, 3:2, 1:2, 2:1)

---

## Implementation Order (Priority)

1. **Phase 1** — Critical fixes (print, crop, stickers, queue) — MUST DO FIRST
2. **Phase 4** — Quick wins (more layouts, ranges, ratios)
3. **Phase 2** — Header text + memo formatting + stamps
4. **Phase 7** — Freestyle resize/crop
5. **Phase 3** — Doodles system
6. **Phase 5** — BG removal, paste, Pinterest
7. **Phase 6** — Gallery & QR page

## New Dependencies Needed
- `@imgly/background-removal` (Phase 5 — bg removal)

## New Files to Create
- `src/lib/premade-doodles.ts`
- `src/components/doodle-panel.tsx`
- `src/components/doodle-layer.tsx`
- `src/components/doodles-overlay.tsx`
- `src/app/gallery/[id]/page.tsx`
- `src/components/image-effects.tsx`
- `src/lib/image-effects.ts`
- `src/lib/bg-removal.ts`

## Files to Modify
- `src/store/booth-store.ts` (major — new state for all features)
- `src/app/page.tsx` (major — new controls, paste handler, QR toggle)
- `src/components/receipt-canvas.tsx` (major — doodles overlay, header text)
- `src/components/crop-dialog.tsx` (fix default zoom)
- `src/components/sticker-layer.tsx` (fix handle positioning)
- `src/components/sticker-panel.tsx` (bg removal toggle)
- `src/components/font-picker.tsx` (B/I/U buttons, larger range)
- `src/components/print-queue-panel.tsx` (cancel/remove buttons)
- `src/components/photo-grid-editor.tsx` (resize handles)
- `src/lib/grid-layouts.ts` (20+ new layouts)
- `src/lib/crop-utils.ts` (more ratios)
- `src/lib/api.ts` (new endpoints)
- Flask backend `/tmp/archivio_server_v2.py` (grid printing, sticker compositing, doodles, gallery, rounded corners, bg fetch)
