# How to Test the Photo Booth Improvements

This guide covers testing for **Tier 1 (Bugs)**, **Tier 2 (UX)**, **Tier 3 (Production)**, and **Tier 4 (Nice-to-have)**.

---

## Start the app (quick reference)

**Terminal 1 – backend:**
```bash
cd archivio-server && PORT=5051 python3 server.py
```
Backend: **http://localhost:5051** (health: http://localhost:5051/api/health)

**Terminal 2 – dashboard:**
```bash
cd archivio-dashboard && npm run dev
```
Dashboard: **http://localhost:3000** (or **http://127.0.0.1:3000** if localhost doesn’t resolve)

If “site can’t be reached”: try **http://127.0.0.1:3000** in the browser. From another device on the same network use **http://&lt;this-machine-ip&gt;:3000** after running `npm run dev:host`.

---

## Prerequisites

- **Dashboard (frontend):** From repo root run `cd archivio-dashboard && npm install && npm run dev`. Open **http://localhost:3000** or **http://127.0.0.1:3000**.
- **Server (backend, optional for full tests):** `cd archivio-server && pip install -r requirements.txt`. On non-Pi you may need to skip `picamera2` (comment it out or `pip install flask flask-cors Pillow 'qrcode[pil]'`). On a Pi with printer/camera: `python server.py` (or use the systemd service). Set `NEXT_PUBLIC_PI_URL` in the dashboard to your Pi URL (e.g. `http://monster-pi.local:5000`) for Pi-dependent tests.

---

## Tier 1: Bugs

### B1. Header text italic/underline
- In the dashboard, enable **header text** below the logo and enter some text.
- Turn on **Bold**, **Italic**, and **Underline** for the header (if you have B/I/U toggles).
- **Check:** The live receipt preview shows the header in bold, italic, and underlined.

### B2. Memo italic/underline
- Add a **Memo / Quote** and enable **Bold**, **Italic**, **Underline** for the memo.
- **Check:** The receipt preview shows the memo with all three styles.

### B3. QR caption
- Enable **QR Code** and enter a URL.
- Find the **Caption (below QR)** field and type e.g. "Scan for your digital copy".
- **Check:** The receipt preview shows this caption under the QR code; the counter shows 0/80.

### B4. Grid photo rotation
- Switch to **Photo Grid**, add 2+ photos, and use the **Rotate** control (single rotation applies to all grid photos).
- **Check:** In the receipt preview, all grid photos are rotated the same way.

### B5. Print queue auto-remove
- Print a job and wait for it to complete.
- **Check:** The job stays in the queue for about **8 seconds** after completion, then disappears (not 3 seconds).

### B6. Sticker default position
- Add a **sticker** from the sticker panel.
- **Check:** The new sticker appears **near the center** of the receipt (not fixed at 80,200). Try with different receipt heights (e.g. with/without memo, QR) to see it stay centered.

---

## Tier 2: UX

### U1. Print preview confirmation
- Add a photo and click **Print Receipt**.
- **Check:** A **dialog** opens with the receipt preview and **Cancel** / **Confirm & Print**.
- Cancel and confirm that no print is sent. Then open again and confirm; the print job should be sent.

### U2. Retake photo
- In **Single Photo**, add or capture a photo.
- **Check:** A **Retake photo** button appears; clicking it clears the photo so you can capture/upload again.

### U4. Pi connection status
- With the Pi **disconnected** (or wrong `NEXT_PUBLIC_PI_URL`), open the dashboard.
- **Check:** An **amber “Printer offline — connect to the Pi to print”** message appears near the print button, and the print button is **disabled**.

### U5. Section order
- In **Receipt order**, drag e.g. **Logo** below **Photo**.
- **Check:** The live preview reorders sections; the new order is reflected on the receipt.

### U6. Event mode
- Enable **Event mode** and set **Event name**, **Event date**, **Event location**.
- **Check:** The receipt preview shows the event name as header and the stamp shows event date and location (instead of live date/time/location).

### U7. Photo filters
- Add a photo and open **Photo filter** (None, Sepia, B&W, Vintage, High contrast).
- **Check:** The receipt preview updates with the selected filter.

---

## Tier 3: Production

### P1. Pi camera dependency and errors
- On a **non-Pi** machine (or without `picamera2`), run the server and call `GET /api/camera/status`.
- **Check:** Response has `"available": false` and an **informative message** (e.g. "picamera2 not installed (install on Pi: pip install picamera2)").
- **Check:** `requirements.txt` includes **picamera2** (with a comment that it’s Pi-only).

### P2. Printer status in health
- Call `GET /api/health` (with or without a printer).
- **Check:** Response includes `printer` (device exists) and **`printer_ready`** (ready/idle when `lpstat -p` is available). Dashboard uses this for printer status.

### P4. Systemd service
- On the Pi: `sudo cp archivio-server/archivio-server.service /etc/systemd/system/`, then `sudo systemctl daemon-reload && sudo systemctl enable archivio-server && sudo systemctl start archivio-server`.
- **Check:** `systemctl status archivio-server` shows active; after `sudo systemctl restart archivio-server` the server comes back.

### P5. Logging
- Run the server and trigger a few actions (upload, print, etc.).
- **Check:** No `print()` in `server.py`; logs go to **stdout** and to **`archivio-server/logs/archivio.log`** with rotation (e.g. 2MB × 3 backups).

### P6. File cleanup
- Call `GET /api/admin/cleanup?days=30` (or another `days` value).
- **Check:** Response has `deleted` (count) and `days`; old files in uploads/previews/stickers are removed. Log message: "Cleanup: removed N files older than D days".

### P7. Database backup
- Call `GET /api/admin/backup`.
- **Check:** Response has `"status": "ok"` and `"path": "...archivio.db.backup"`; file exists. Log: "DB backup created: ...".

---

## Tier 4: Nice-to-have

### N1. Social sharing
- Add a photo, click **Print Receipt** to open the print preview dialog.
- **Check:** With a **receipt preview image** shown, you see **Share / Save** and **Save to device**.
- **Share / Save:** On supported devices uses `navigator.share`; otherwise triggers download.
- **Save to device:** Downloads the preview image as `photo-booth-receipt.png`.

### N5. Photo borders
- Add a photo and open **Photo border** (None, Thin, Rounded, Polaroid, Vintage, etc.).
- **Check:** The receipt preview draws a **frame** around the single photo (stroke, rounded corners, or dash as per the style). Changing border updates the preview.

---

## Quick smoke test (no Pi)

1. `cd archivio-dashboard && npm run dev` → open http://localhost:3000.
2. Upload a photo (single or grid), add memo, enable QR with caption.
3. Toggle event mode and set name/date/location.
4. Change photo filter and photo border; drag section order.
5. Click Print → confirm preview dialog with Share / Save and Save to device; cancel (no Pi needed).
6. Run server locally: `cd archivio-server && python server.py` → call `GET /api/health` and `GET /api/admin/cleanup?days=365`, `GET /api/admin/backup` to verify P2, P6, P7.

---

## Pi-specific smoke test

1. Deploy dashboard (build + serve or dev with `NEXT_PUBLIC_PI_URL=http://<pi>:5000`).
2. On Pi: install deps, run server (or systemd), ensure printer and (optionally) camera are connected.
3. In dashboard: confirm Pi badge green, printer status, then capture (if camera), print preview, confirm print, and check queue and printed receipt.
