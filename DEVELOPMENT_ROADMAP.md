# Archivio Photo Booth - Complete Development Roadmap

> **Last updated:** 3 March 2026
> **Status:** Audit complete, development pending
> **Author:** Generated from full codebase + Raspberry Pi audit

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Current State of Each Component](#2-current-state-of-each-component)
3. [Active Flaws & Bugs](#3-active-flaws--bugs)
4. [Integration Gaps](#4-integration-gaps)
5. [Features Yet To Build](#5-features-yet-to-build)
6. [Complete User Flow Analysis](#6-complete-user-flow-analysis)
7. [Database Schema Reference](#7-database-schema-reference)
8. [API Endpoint Reference](#8-api-endpoint-reference)
9. [Environment & Deployment Reference](#9-environment--deployment-reference)
10. [Prioritised Development Phases](#10-prioritised-development-phases)

---

## 1. System Architecture Overview

```
                        +-----------------------+
                        |   archivio-platform   |  Port 3001
                        |   (Admin SaaS Panel)  |  Next.js 15 + Supabase Auth
                        |   Vercel deployment   |  Turso (multi-tenant DB)
                        +-----------+-----------+
                                    |
                       postMessage (iframe embed)
                                    |
            +-----------------------v--------------------------+
            |              archivio-dashboard                  |  Port 3000
            |        (Booth Kiosk / Self-Service UI)           |  Next.js 16 + Zustand
            |    Runs on Mac (dev) or Pi browser (prod)        |  Konva (canvas render)
            +-----------+--------------------+-----------------+
                        |                    |
               REST API (LAN)         HMAC-signed upload
                        |                    |
            +-----------v-----------+    +---v-------------------+
            |   archivio-server     |    |   archivio-share      |  Port 3002
            |   (Raspberry Pi)      |    |   (Photo Sharing +    |  Next.js 15
            |   Flask + ESC/POS     |    |    Time Capsules)     |  Turso + R2
            |   Camera + Printer    |    |   Vercel deployment   |  Resend + QStash
            +-----------------------+    +-----------------------+
```

### Tech Stack Summary

| Component | Framework | Database | Auth | Hosting |
|---|---|---|---|---|
| **archivio-platform** | Next.js 15, React 19, Tailwind 4 | Turso (SQLite) | Supabase | Vercel |
| **archivio-dashboard** | Next.js 16, React 19, Zustand, Konva | IndexedDB (Zustand persist) | None (LAN-only) | Local / Pi browser |
| **archivio-server** | Flask, Pillow, ESC/POS | SQLite (WAL mode) | None (LAN-only) | Raspberry Pi (systemd) |
| **archivio-share** | Next.js 15, Drizzle ORM | Turso (SQLite) | NextAuth (admin) | Vercel |

### External Services

| Service | Purpose | Used By |
|---|---|---|
| **Supabase** | User auth + management | Platform |
| **Turso (LibSQL)** | Hosted SQLite databases | Platform, Share |
| **Cloudflare R2** | Image storage (S3-compatible) | Share |
| **Resend** | Transactional email delivery | Share |
| **Upstash QStash** | Scheduled job delivery (time capsules) | Share |
| **Vercel Blob** | Fallback image storage | Share |
| **Google Fonts API** | Dynamic font loading | Dashboard, Pi Server |

---

## 2. Current State of Each Component

### 2.1 archivio-dashboard (Booth Kiosk UI)

**Status: Functional, needs kiosk mode**

#### What works:
- Full receipt designer with live preview (Konva canvas)
- Logo upload with crop, header text with Google Fonts
- Single photo + grid mode (25+ layouts for 1-6 photos)
- 4 dithering algorithms: Atkinson, Floyd-Steinberg, Stucki, Bayer8
- 2 photo filters: Standard B&W, Warm Sepia (reduced from 5 for thermal optimisation)
- 2 brightness presets: Medium, High (removed Low for thermal optimisation)
- 10 photo border styles including Polaroid, Double, Rounded
- Sticker panel with upload and placement
- Memo/quote text with font picker
- QR code with configurable URL and caption
- Date/time/location stamps with format options
- Section reorder via drag-and-drop
- Multi-capture mode (1-6 photos)
- Print queue with job status polling
- Device camera capture + Pi camera capture
- Background removal (WASM-based)
- Templates page (save/load/apply booth state)
- Gallery page (view past prints)
- Dark mode toggle
- Share upload queue (IndexedDB + exponential backoff)
- Cafe config listener (postMessage from platform iframe)
- Feature flag respect (23 boolean flags + maxCopies)
- Zustand persist with IDB storage + migration (v0 -> v1)
- Korean beige aesthetic (OKLCH warm cream colour palette)

#### What's missing:
- Customer-facing kiosk mode (simplified one-button flow)
- Auto-print workflow (countdown -> capture -> print)
- "Save as Template" button for exporting to platform
- Preview-only mode (no Pi required, for self-service users)

### 2.2 archivio-platform (Admin SaaS Panel)

**Status: Functional locally, not deployed**

#### What works:
- Supabase authentication (email/password)
- Role-based access: `super_admin`, `cafe_admin`, `cafe_operator`
- Cafe CRUD (create, edit, deactivate)
- Per-cafe configuration editor:
  - Branding: header text, font, size, height
  - Print defaults: algorithm, brightness, filter, border
  - 23 feature flags with toggle UI
  - Max copies limit
- Template management (CRUD with state JSON + locked fields + thumbnails)
- Embedded booth page at `/booth/[slug]` (loads dashboard in iframe)
- postMessage config injection to dashboard
- Audit log (tracks admin actions: cafe.create, config.update, etc.)
- User management (invite, assign roles, link to cafes)

#### What's missing:
- Production deployment to Vercel
- Platform config editor still shows old filter options (5 filters, 3 brightness) -- MISMATCH with dashboard
- No visual template builder (admin must manually craft state JSON)
- No logo upload from platform (field exists, no upload UI)
- No "preview booth" without Pi
- No event management linked to share service
- No billing/subscription enforcement (schema has free/pro/enterprise but no Stripe)
- No remote Pi management

### 2.3 archivio-server (Raspberry Pi Flask Server)

**Status: Running, systemd enabled, printer working**

#### Pi System State:
- **OS:** Raspberry Pi OS (Debian, aarch64), kernel 6.12.62
- **Hostname:** `monster-pi` at `monster-pi.local` (192.168.0.106)
- **Disk:** 59GB total, 7.3GB used (13%), 49GB free
- **Memory:** 1.8GB total, 425MB used, 1.4GB available
- **Server:** Gunicorn (2 workers, 4 threads, timeout 300s)
- **Systemd:** `archivio-server.service` enabled, auto-restart
- **Printer:** `/dev/usb/lp0` detected, ready (crw-rw---- root:lp)
- **Camera:** picamera2 installed but camera reports `false` (hardware not connected)
- **Cron:** Daily cleanup at 3 AM (removes files older than 30 days)
- **Database:** SQLite `archivio.db` - 0 templates, 0 gallery items
- **SSH user:** `monster-pi`
- **Server path:** `~/archivio-server/`

#### What works:
- Async print queue with background worker thread
- ESC/POS thermal printing (576px width, raw USB + CUPS fallback)
- 4 dithering algorithms (identical to dashboard)
- Full receipt builder in Python (Pillow-based):
  - Logo section with Google Fonts
  - Photo section (single + 25 grid layouts + freestyle canvas)
  - Memo section with custom fonts
  - QR code section with caption
  - Stamp section (date/time/location)
  - Sticker compositing with alpha blending
  - Section reordering, decorative separators
- Template CRUD (SQLite)
- Gallery save/list/delete (SQLite)
- Image upload endpoints (logo, photo, sticker, thumbnail)
- Admin cleanup + database backup endpoints
- CORS enabled for all origins
- Rotating log files (2MB x 3 backups)
- Health check endpoint

#### What's missing:
- Camera hardware not physically connected
- Gallery has 0 items (never tested end-to-end or never used)
- Templates DB empty
- No authentication (relies on LAN isolation)
- No remote access (LAN only)
- No cloud backup of gallery/templates
- No auto-discovery or registration with platform
- Stale `youmee-server` directory still on Pi (old naming, wastes space)
- Root-owned files in home directory (permission issues)

### 2.4 archivio-share (Photo Sharing + Time Capsules)

**Status: Fully implemented, not deployed**

#### What works:
- Photo upload endpoint with HMAC signature verification
- 3-variant storage: original, thumbnail, social (R2/Blob/local fallback)
- Short code redirect: `/s/[8-char-code]` -> `/photo/[id]`
- Photo viewing page with action buttons
- Photo download endpoint (Content-Disposition: attachment)
- Email photo to self (Resend integration, rate-limited: 3/photo/hour)
- Instagram share button with 6 canvas-based templates:
  - Minimal (white), Dark, Gradient (purple-pink), Warm (sunset), Ocean (blue), Film Strip
  - Output: 1080x1920 PNG (Instagram story dimensions)
  - Download or native share API
- Time capsule creation with delivery scheduling:
  - Presets: 1 week, 3 months, 6 months, 1 year, custom
  - Max message: 500 characters
  - QStash for scheduled delivery, setTimeout fallback
  - Confirmation email with cancel link
  - Cancel via token-based URL
- Email templates with `{{photo}}`, `{{message}}`, `{{event}}` placeholders
- Admin dashboard (NextAuth credentials):
  - Photo count, scan count, capsule count
  - Capsule list with status filter (sealed/delivered/cancelled/failed)
  - Email template editor
  - Event management (name, slug, date, location, branding, expiry)
- Photo expiry mechanism (90 days default, null for events)
- Resend webhook handler for email status tracking
- Health check endpoint

#### Rate limits:
- 3 capsules per photo (total)
- 5 capsules per email per day
- 3 email-to-self per photo per hour
- Upload signature valid for 5 minutes
- Custom date max: 1 year from today

#### What's missing:
- Production deployment to Vercel
- R2 bucket not configured for production
- Resend sending from `onboarding@resend.dev` (dev/sandbox)
- Admin password is `admin123` (dev-only)
- No link to platform events (share events are separate)
- Photo expiry not shown to user on photo page ("expires in X days")
- No Instagram deep link (`instagram://story-camera`) -- downloads only
- No analytics beyond view count
- Capsule retry logic for failed deliveries not implemented
- Image width/height fields in DB never populated

---

## 3. Active Flaws & Bugs

### FLAW A1: Platform config editor filter/brightness mismatch

**Severity: High**
**Location:** `archivio-platform/src/components/admin/cafe-config-editor.tsx` lines 78-90

The platform admin UI still exposes 5 photo filters and 3 brightness levels that were removed from the dashboard:

```
Platform shows:           Dashboard now has:
-----------------         ------------------
Filters:                  Filters:
  none                      none (Standard B&W)
  sepia                     sepia (Warm Sepia)
  grayscale (REMOVED)
  vintage (REMOVED)
  contrast (REMOVED)

Brightness:               Brightness:
  low (REMOVED)             medium
  medium                    high
  high
```

**Impact:** Admin can set `photoFilter: "vintage"` or `printBrightness: "low"` as cafe defaults. Dashboard ignores these (non-persisted filter resets to "none", persisted brightness migrates "low" to "medium"), but the admin sees incorrect options and the config doesn't match reality.

**Fix:**
- Update `BRIGHTNESS_PRESETS` in cafe-config-editor.tsx to remove "low"
- Update `FILTERS` in cafe-config-editor.tsx to remove grayscale, vintage, contrast
- Rename remaining options to match dashboard labels

---

### FLAW A2: Duplicate server directories on Pi

**Severity: Low**
**Location:** Raspberry Pi home directory

Two server directories exist:
- `~/archivio-server/` -- **Active** (systemd points here, sync-to-pi.sh syncs here)
- `~/youmee-server/` -- **Stale** (old naming, separate .git, old youmee.db)

Both contain copies of stickers, gallery, .git history, logs. Wastes ~80MB+ disk and causes confusion.

**Fix:**
```bash
ssh monster-pi@monster-pi.local "rm -rf ~/youmee-server"
```

---

### FLAW A3: Pi camera reports false

**Severity: Medium**
**Location:** Raspberry Pi hardware

`GET /api/health` returns `camera: false`. Python `import picamera2` succeeds (module installed), but `libcamera-hello` command not found and no camera hardware detected.

**Root cause:** Either:
1. Camera module not physically connected (ribbon cable)
2. Camera not enabled in Pi config (`raspi-config` -> Interface Options -> Camera)
3. `libcamera` packages not installed (even though picamera2 is)

**Impact:** No photo capture from Pi. Users must use device camera (phone/laptop webcam) or upload photos manually.

**Fix:**
1. Physically connect Pi camera module
2. Run `sudo raspi-config` -> Interface Options -> Camera -> Enable
3. Reboot Pi
4. Test with `python3 -c "from picamera2 import Picamera2; cam = Picamera2(); print(cam.sensor_modes)"`

---

### FLAW A4: Root-owned files on Pi home directory

**Severity: Low**
**Location:** `/home/monster-pi/`

Files owned by root scattered in home:
```
-rw-r--r--  1 root root 59064 Feb 11 last_print.png
-rw-r--r--  1 root root 28802 Feb 11 last_receipt_1.png
-rw-r--r--  1 root root 49624 Feb 11 last_receipt_2.png
-rw-r--r--  1 root root 28455 Feb 11 last_receipt_3.png
-rw-r--r--  1 root root 54017 Feb 11 last_receipt_4.png
-rw-r--r--  1 root root 20986 Feb 11 last_receipt.png
```

Also ~20 test scripts (`print_*.py`, `dither_test_print.py`, etc.) cluttering the home directory.

**Fix:**
```bash
ssh monster-pi@monster-pi.local "sudo chown monster-pi:monster-pi ~/last_*.png && mkdir -p ~/old-tests && mv ~/print_*.py ~/dither_test_print.py ~/photobooth_print*.py ~/print_all_tests.py ~/old-tests/"
```

---

### FLAW A5: Empty gallery and templates on Pi

**Severity: Medium**
**Location:** Pi SQLite database `archivio.db`

Both tables are empty:
- `templates`: 0 rows
- `gallery`: 0 rows
- `gallery/` directory: 0 files

**Impact:** Gallery save feature never verified end-to-end. If gallery save is broken, printed photos are lost forever.

**Fix:** Test the gallery save flow:
1. Print a receipt from dashboard
2. Check if `POST /api/gallery` is called
3. Verify image is saved to Pi `gallery/` directory
4. Verify database row is created
5. Verify `GET /api/gallery` returns the saved item

---

### FLAW A6: Share service pointing to localhost

**Severity: Critical**
**Location:** `archivio-dashboard/.env.local`

```env
NEXT_PUBLIC_SHARE_URL=http://localhost:3002
NEXT_PUBLIC_SHARE_SHORT_URL=http://localhost:3002/s
```

QR codes on thermal prints encode URLs like `http://localhost:3002/s/ABC12345`. When a customer scans this QR with their phone, it leads nowhere.

**Impact:** The entire digital sharing flow is broken for end users. QR codes on printed receipts are useless.

**Fix:** Deploy archivio-share to Vercel (or similar), get production URL (e.g., `share.archivio.app`), update env vars.

---

### FLAW A7: Duplicate receipt rendering logic

**Severity: Low (Architectural debt)**
**Location:**
- `archivio-dashboard/src/components/receipt-canvas.tsx` -- JavaScript/Konva canvas rendering
- `archivio-server/server.py` lines 418-1037 -- Python/Pillow receipt building

Two completely separate implementations of the same receipt builder. The dashboard renders the receipt on the client (Canvas/Konva) and sends the finished image to Pi via `POST /api/print/image` (WYSIWYG path). The Python renderer on Pi is used by the legacy `POST /api/print/queue` endpoint.

**Impact:** Maintenance burden, potential visual differences between paths.

**Current reality:** The WYSIWYG path (`/api/print/image`) is the primary print path. The Python renderer is legacy.

**Fix:** Consider deprecating the Python receipt builder or keeping it as a fallback for headless printing scenarios.

---

## 4. Integration Gaps

### GAP B1: Dashboard -> Share service upload pipeline not deployed

**What exists:**
- Dashboard has `share-upload.ts` with a robust offline-first IndexedDB queue
- Uses Dexie for queue persistence, exponential backoff (max 10 retries)
- Signs uploads with HMAC-SHA256 (shared secret: `bce8c938...`)
- Uploads 3 image variants: original, thumbnail, social (Instagram-sized)
- Share service has `POST /api/upload` with signature verification
- Secrets match between dashboard and share service

**What's broken:**
- Share service runs only on localhost:3002
- Dashboard's `NEXT_PUBLIC_SHARE_URL` points to localhost
- The actual upload from a Pi-connected dashboard to the share service never reaches a production server

**What's needed:**
1. Deploy share service to Vercel with production domain
2. Configure R2 bucket for image storage
3. Set up Resend production sending domain (currently `onboarding@resend.dev`)
4. Set up QStash production endpoint
5. Update dashboard env vars with production URLs
6. Test end-to-end: print receipt -> QR generated -> scan QR -> photo loads on share page

---

### GAP B2: Platform -> Pi communication limited to local network

**What exists:**
- Platform's booth page at `/booth/[slug]` embeds dashboard in an iframe
- Config is sent via `window.postMessage()` to the embedded dashboard
- Dashboard connects to Pi at `NEXT_PUBLIC_PI_URL` (default: `http://monster-pi.local:5000`)

**What's broken:**
- Pi is only accessible on the same WiFi network (`monster-pi.local` resolves via mDNS)
- Admin at `platform.archivio.app` cannot manage a Pi at a cafe on a different network
- No remote health monitoring or alerting

**What's needed:**
- **Option A: Cloudflare Tunnel** (recommended, free tier)
  - Install `cloudflared` on Pi
  - Create tunnel: `cloudflared tunnel create archivio-booth-1`
  - Expose: `cloudflared tunnel route dns archivio-booth-1 booth-1.archivio.app`
  - Pi server accessible at `https://booth-1.archivio.app` from anywhere
- **Option B: Tailscale VPN** (simpler for dev, $0 for personal)
  - Install Tailscale on Pi and admin machine
  - Pi gets a stable IP on Tailscale network
  - Platform connects to Pi via Tailscale IP
- **Option C: Pi phones home via WebSocket**
  - Pi opens persistent WebSocket to a relay server
  - Platform sends commands through relay
  - More complex but works behind any NAT

---

### GAP B3: Template creation workflow is disconnected

**What exists:**
- Platform stores templates as JSON blobs in `cafeTemplates` table:
  - `state`: full Zustand booth-store snapshot
  - `lockedFields`: array of field names operator can't modify
  - `thumbnailUrl`: preview image
- Dashboard can load/save templates locally (Pi SQLite)
- Dashboard respects template + locked fields when received via postMessage

**What's broken:**
- No way to design a template visually from the platform admin
- Admin would need to: (1) open dashboard, (2) design receipt, (3) manually extract Zustand state JSON, (4) paste into API call
- No "Save as Platform Template" button in dashboard
- No thumbnail auto-generation when creating a template

**What's needed:**
1. Dashboard: "Save as Template" button (visible when `userRole === 'cafe_admin' | 'super_admin'`)
   - Captures current Zustand state
   - Renders canvas to thumbnail PNG
   - Sends both to platform API via postMessage
2. Platform: "Design Template" button that opens dashboard in an iframe in design mode
3. Platform: Lock field picker (checkboxes per field)
4. Platform: Template preview with thumbnail

---

### GAP B4: No end-to-end event flow between platform and share service

**What exists:**
- Platform has event mode fields on cafe config: `eventModeEnabled`, `eventName`, `eventDate`, `eventLocation`
- Share service has a separate `events` table with: `name`, `slug`, `date`, `location`, `organizer`, `branding`, `photoExpiryDays`
- Dashboard can enable event mode and stamp event details on receipts
- Share service groups photos by eventId and uses event-specific email templates

**What's broken:**
- Creating an "event" on the platform does NOT create a corresponding event in the share service
- There's no API call from platform -> share service to sync events
- The `eventId` passed during share upload has no corresponding record in share DB
- Event-specific features (custom expiry, branding, email templates) are inaccessible

**What's needed:**
1. Either: Platform API creates events in both platform DB and share service DB
2. Or: Unified event management in one place (share service admin) with platform reading from it
3. Dashboard's share upload should include `eventId` when event mode is on
4. Share service should auto-create event record if it receives an unknown eventId (with defaults)

---

### GAP B5: No billing or subscription enforcement

**What exists:**
- Platform `cafes` table has `plan` field: `"free" | "pro" | "enterprise"`
- Feature flags exist for access control
- Default feature flags are restrictive (most advanced features disabled)

**What's broken:**
- No payment integration (no Stripe, no payment flow)
- No plan-based feature gating logic
- All cafes are effectively "free" regardless of plan field
- No usage tracking (prints per month, storage used, etc.)

**What's needed (Phase 6):**
1. Stripe Checkout integration for plan upgrades
2. Stripe webhook handler for subscription lifecycle
3. Plan-based defaults for feature flags
4. Usage tracking: prints/month, photos stored, emails sent
5. Overage handling or hard limits per plan
6. Billing dashboard for cafe admins

---

## 5. Features Yet To Build

### FEATURE C1: Kiosk / Customer Mode

**Priority: Critical**
**Effort: ~2 weeks**

The current system is entirely operator-facing. For the target use case ("user just clicks photo and gets print"), we need a simplified customer-facing UI.

#### Requirements:
1. **Start Screen**: Large "Take Photo" button with cafe branding
2. **Countdown**: 3-2-1 countdown with animated display before capture
3. **Preview**: Show captured photo with "Print" and "Retake" buttons
4. **Auto-Template**: Receipt template auto-applied from cafe's default template
5. **QR Auto-Generation**: Unique short code created for every print, QR placed on receipt
6. **Auto-Upload**: Photo queued for share service upload immediately
7. **Print Confirmation**: "Your photo is printing!" screen with QR code large enough to scan from screen
8. **Loop Back**: After 10 seconds, return to start screen for next customer

#### Technical approach:
- New route: `/kiosk` in archivio-dashboard
- Uses same ReceiptCanvas + printer logic but with locked settings
- Pi camera capture with `POST /api/camera/capture`
- Device camera fallback with MediaStream API
- Full-screen mode (`document.documentElement.requestFullscreen()`)
- No header, no settings panels, no navigation
- Template loaded from cafe config or Pi templates DB
- Short code generated via `nanoid(8)` for each print
- Background share upload via existing `enqueueUpload()` queue

#### UI Flow:
```
[Start Screen]           [Countdown]          [Preview]
+------------------+   +------------------+   +------------------+
|                  |   |                  |   |  +------------+  |
|   Cafe Logo      |   |                  |   |  |   Photo    |  |
|                  |   |      3...2...1   |   |  |   Preview  |  |
|  +----------+    |   |                  |   |  +------------+  |
|  |  TAKE    |    |   |                  |   |                  |
|  |  PHOTO   |    |   |                  |   |  [Retake] [Print]|
|  +----------+    |   |                  |   |                  |
+------------------+   +------------------+   +------------------+

[Printing]                [Done]
+------------------+   +------------------+
|                  |   |                  |
|   Printing...    |   |   Scan the QR    |
|                  |   |   on your print  |
|   [spinner]      |   |   to save your   |
|                  |   |   photo!          |
|                  |   |                  |
+------------------+   +------------------+
                            (auto-reset 10s)
```

---

### FEATURE C2: Visual Template Builder in Platform

**Priority: Important**
**Effort: ~1.5 weeks**

Currently there's no visual way for admins to create templates from the platform. They need to use the dashboard and manually transfer state.

#### Requirements:
1. "Design Template" button in platform template management
2. Opens dashboard in iframe with `mode=design` query parameter
3. Dashboard detects design mode and shows "Save as Template" button
4. On save: captures Zustand state + renders thumbnail + sends via postMessage
5. Platform receives and stores in `cafeTemplates` table
6. Lock field picker: admin checks which fields operators CANNOT change
7. Template list with visual thumbnails

#### Technical approach:
- Platform: New `TemplateDesigner` component wrapping dashboard iframe
- Dashboard: Detect `?mode=design` in URL params
- Dashboard: New "Save Template" button (visible in design mode)
  - `receiptCanvasRef.current.exportThumbnail()` for thumbnail
  - `useBoothStore.getState()` for full state snapshot
  - `window.parent.postMessage({ type: 'archivio:save-template', state, thumbnail })` to platform
- Platform: Listen for postMessage, show name/description dialog, save to DB
- Lock fields UI: Checkbox per editable field (memo, photo, stickers, QR URL, etc.)

---

### FEATURE C3: Share Service Deployment

**Priority: Critical**
**Effort: ~3 days**

The share service is fully implemented but runs only on localhost. Without deployment, QR codes on thermal prints are useless.

#### Deployment Steps:

1. **Vercel Project Setup:**
   ```bash
   cd archivio-share
   vercel link
   vercel env add SHARE_SECRET
   vercel env add TURSO_DATABASE_URL
   vercel env add TURSO_AUTH_TOKEN
   vercel env add R2_ACCOUNT_ID
   vercel env add R2_ACCESS_KEY_ID
   vercel env add R2_SECRET_ACCESS_KEY
   vercel env add R2_BUCKET_NAME
   vercel env add R2_PUBLIC_URL
   vercel env add RESEND_API_KEY
   vercel env add RESEND_FROM
   vercel env add RESEND_WEBHOOK_SECRET
   vercel env add QSTASH_TOKEN
   vercel env add QSTASH_CURRENT_SIGNING_KEY
   vercel env add QSTASH_NEXT_SIGNING_KEY
   vercel env add AUTH_SECRET
   vercel env add ADMIN_USERNAME
   vercel env add ADMIN_PASSWORD
   vercel env add NEXT_PUBLIC_APP_URL
   ```

2. **Turso Database (Production):**
   ```bash
   turso db create archivio-share
   turso db tokens create archivio-share
   # Run migrations
   cd archivio-share && npx drizzle-kit push
   ```

3. **Cloudflare R2 Bucket:**
   - Create bucket `archivio-photos` in Cloudflare dashboard
   - Create R2 API token with Object Read & Write permissions
   - Set up custom domain: `images.archivio.app` -> R2 public access

4. **Resend Domain Verification:**
   - Add domain `archivio.app` in Resend dashboard
   - Add DNS records (SPF, DKIM, DMARC)
   - Update `RESEND_FROM` to `Archivio <hello@archivio.app>`

5. **QStash Webhook URL:**
   - Update QStash to POST to `https://share.archivio.app/api/capsule/send`
   - Verify signing keys match

6. **Custom Domain:**
   - Add `share.archivio.app` as custom domain in Vercel
   - Add CNAME DNS record

7. **Update Dashboard env:**
   ```env
   NEXT_PUBLIC_SHARE_URL=https://share.archivio.app
   NEXT_PUBLIC_SHARE_SHORT_URL=https://share.archivio.app/s
   ```

---

### FEATURE C4: Link Expiry Display

**Priority: Nice-to-have**
**Effort: ~1 day**

#### Requirements:
1. Show "This photo expires in X days" badge on `/photo/[id]` page
2. Warning badge when < 7 days remaining
3. Configurable expiry per cafe (not just default 90 days)
4. Optional: "Extend link" button (adds 30 days, max 1 extension)

#### Technical approach:
- `GET /api/photo/[id]` already returns `expiresAt` timestamp
- PhotoFrame component: calculate days remaining, show badge
- Cafe config: add `photoExpiryDays` field (default 90)
- Pass to share upload as metadata
- Extension: new `POST /api/photo/[id]/extend` endpoint

---

### FEATURE C5: Instagram Deep Link

**Priority: Important**
**Effort: ~2 days**

#### Current state:
The `InstagramShareButton` component generates 1080x1920 Instagram story images with 6 beautiful templates (Minimal, Dark, Gradient, Warm, Ocean, Film Strip). It downloads the image or uses the Web Share API.

#### What's missing:
- Direct Instagram app integration via URL schemes
- "Add to Story" button that opens Instagram directly
- Seamless mobile experience

#### Technical approach:
1. **Web Share API** (already implemented, works on iOS/Android):
   ```javascript
   navigator.share({ files: [imageFile], title: 'My Photo' })
   ```
   - This already shows Instagram in the share sheet on mobile

2. **Instagram URL Scheme** (enhancement):
   ```
   instagram://story-camera
   instagram://library?AssetPath=...
   ```
   - Limited and unreliable across OS versions

3. **Facebook Sharing SDK** (heavyweight but reliable):
   - Requires Facebook App approval
   - `FB.ui({ method: 'share_open_graph', ... })`
   - Not recommended due to approval complexity

4. **Recommended approach: Optimise existing Web Share API path**
   - Ensure the share sheet shows "Instagram Stories" option
   - Add "Copy to Clipboard" as fallback
   - Add instruction text: "Tap Share -> Instagram -> Stories"
   - Track share method analytics

---

### FEATURE C6: Remote Pi Management

**Priority: Important**
**Effort: ~1 week**

#### Requirements:
1. Admin can view Pi health status from platform (any network)
2. Admin can push config changes to Pi remotely
3. Admin can view print queue remotely
4. Admin can trigger test print remotely
5. Alert when Pi goes offline

#### Recommended approach: Cloudflare Tunnel

```bash
# On Raspberry Pi:
curl -L https://pkg.cloudflare.com/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
cloudflared tunnel create cafe-booth-1
cloudflared tunnel route dns cafe-booth-1 booth-1.archivio.app
```

Tunnel config (`~/.cloudflared/config.yml`):
```yaml
tunnel: <tunnel-id>
credentials-file: /home/monster-pi/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: booth-1.archivio.app
    service: http://localhost:5000
  - service: http_status:404
```

Systemd service for tunnel:
```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=monster-pi
ExecStart=/usr/bin/cloudflared tunnel run cafe-booth-1
Restart=always

[Install]
WantedBy=multi-user.target
```

**Platform integration:**
- Store tunnel URL in `cafes.piServerUrl` (e.g., `https://booth-1.archivio.app`)
- Platform dashboard polls `/api/health` every 60s for status
- Red/green indicator for each cafe's Pi

---

### FEATURE C7: Self-Service Public Dashboard

**Priority: Important**
**Effort: ~1 week**

User requirement: "Separate link where user can go and create everything themselves (the dashboard)"

#### Requirements:
1. Public URL (e.g., `create.archivio.app`) where anyone can design receipts
2. No Pi connection required -- preview-only mode
3. Download receipt as image (PNG/PDF)
4. Optional: "Print at Cafe" -- save design, get a code, bring to any partnered cafe
5. Optional: Sign up to save designs

#### Technical approach:
- Dashboard already works standalone (Zustand state is local)
- New route `/create` or deploy separate instance
- Detect Pi connection: if offline, hide "Print" button, show "Download" button
- Add "Download as PNG" button: `receiptCanvasRef.current.toDataURL('image/png')`
- Add "Download as PDF" using canvas-to-PDF (jsPDF or similar)
- "Print at Cafe" flow:
  1. User designs receipt -> generates short code
  2. Short code encodes Zustand state (base64 compressed)
  3. At cafe, operator enters code -> loads design -> prints
  4. Or: save to platform DB, load by code at any cafe

---

### FEATURE C8: Multi-Pi Per Cafe

**Priority: Future**
**Effort: ~2 weeks**

#### Requirements:
1. Cafe can have multiple Pi devices (multiple booths)
2. Each Pi has its own printer/camera
3. Platform shows health of all devices per cafe
4. Templates and config shared across all devices in a cafe
5. Print analytics per device

#### Technical approach:
- New `devices` table in platform DB:
  ```sql
  CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    cafeId TEXT REFERENCES cafes(id),
    name TEXT NOT NULL,
    piServerUrl TEXT NOT NULL,
    tunnelUrl TEXT,
    lastSeenAt INTEGER,
    isActive BOOLEAN DEFAULT true,
    createdAt INTEGER,
    updatedAt INTEGER
  );
  ```
- Move `piServerUrl` from `cafes` table to `devices` table
- Platform UI: device list per cafe with health indicators
- Booth page: device selector dropdown if multiple devices

---

### FEATURE C9: Analytics & Reporting

**Priority: Future**
**Effort: ~2 weeks**

#### Requirements:
1. Print count per cafe per day/week/month
2. Photo view count from share links
3. Capsule creation and delivery stats
4. Popular times (hourly distribution)
5. Template usage ranking
6. Revenue tracking (if charging per print)
7. Export to CSV

#### Technical approach:
- Share service: Already tracks `viewCount` per photo
- Pi server: Add print counter (currently only in queue, not persisted)
- New `analytics` table in platform or share DB:
  ```sql
  CREATE TABLE analytics_events (
    id TEXT PRIMARY KEY,
    cafeId TEXT,
    deviceId TEXT,
    eventType TEXT, -- 'print', 'share_view', 'capsule_created', 'capsule_delivered'
    metadata TEXT,  -- JSON
    createdAt INTEGER
  );
  ```
- Platform admin: Charts page using Recharts or similar
- Daily aggregation cron job for performance

---

### FEATURE C10: Auto-Sync Pi to Cloud

**Priority: Important**
**Effort: ~1 week**

#### Requirements:
1. Gallery images automatically backed up to cloud storage (R2)
2. Templates synced between Pi and platform
3. Config pushed from platform to Pi periodically
4. Recovery: If Pi SD card fails, new Pi can restore from cloud

#### Technical approach:
- Pi server: New background thread for cloud sync
- Sync interval: Every 5 minutes (configurable)
- Gallery sync:
  1. Pi: After each print, upload receipt image to R2 (`gallery/{cafeId}/{timestamp}.png`)
  2. Platform: Gallery viewer reads from R2
- Template sync:
  1. Platform: `PUT /api/templates` pushes to Pi via tunnel URL
  2. Pi: `GET /api/templates` pulls from platform on startup
- Config sync:
  1. Platform: Webhook to Pi on config change
  2. Pi: Apply new config (restart not needed -- hot reload)
- Restore:
  1. New Pi registers with platform (auth token)
  2. Platform pushes all templates + config
  3. Pi downloads gallery from R2

---

## 6. Complete User Flow Analysis

### Flow 1: Admin Setup (One-time)

```
Admin signs up at platform.archivio.app
    |
    v
Creates new cafe (name, slug, logo)
    |
    v
Configures cafe settings:
  - Feature flags (what operators can change)
  - Default template (logo, memo, QR, stamps)
  - Print settings (dithering, brightness, filter)
  - Section order
    |
    v
Creates templates:
  - Opens template designer (dashboard in iframe)
  - Designs receipt layout
  - Saves as template with locked fields
  - Sets one as default
    |
    v
Sets up Pi device:
  - Installs Cloudflare Tunnel on Pi
  - Registers Pi URL in platform
  - Pi auto-loads cafe config
    |
    v
Invites cafe operators:
  - Email invite with role assignment
  - Operator creates Supabase account
  - Linked to cafe with cafe_operator role
```

**Status:** Partially built. Cafe CRUD and config work. Template designer missing. Pi setup is manual. Cloudflare Tunnel not set up.

---

### Flow 2: Operator Daily Use

```
Operator goes to platform.archivio.app/booth/[slug]
    |
    v
Platform loads dashboard in iframe
  - Injects cafe config via postMessage
  - Features locked per admin settings
    |
    v
Operator selects template (if allowed)
  - Or: default template auto-loaded
    |
    v
Operator can adjust unlocked settings:
  - Change memo text
  - Toggle stickers
  - Adjust brightness
  - (Only what admin permits)
    |
    v
Customer arrives, operator takes photo:
  - Upload from gallery
  - Capture from Pi camera
  - Capture from device camera
    |
    v
Photo placed in template
  - Live preview updates in real-time
    |
    v
Operator clicks "Print"
  - Receipt canvas exported as PNG blob
  - Sent to Pi via POST /api/print/image
  - Pi dithers and prints via ESC/POS
  - QR code included with unique short code
    |
    v
Share upload queued:
  - 3 variants (original, thumbnail, social) uploaded to share service
  - HMAC-signed, retries with exponential backoff
  - Happens in background, doesn't block printing
```

**Status:** Mostly works on local network. Share upload pipeline not tested with production deployment. Operator flow through platform iframe works.

---

### Flow 3: Customer Kiosk (NOT YET BUILT)

```
Customer walks up to kiosk
    |
    v
Sees start screen with cafe branding
  - Large "Take Photo" button
    |
    v
Presses button -> countdown 3-2-1
    |
    v
Photo captured from Pi camera
    |
    v
Preview shown with [Retake] and [Print] buttons
    |
    v
Customer presses [Print]
    |
    v
Template auto-applied, receipt prints
    |
    v
"Scan the QR on your print!" screen
  - Auto-resets to start after 10 seconds
```

**Status:** NOT BUILT. Requires Feature C1 (Kiosk Mode).

---

### Flow 4: Customer Scans QR (Share Flow)

```
Customer scans QR code on thermal receipt
    |
    v
QR links to: share.archivio.app/s/ABC12345
    |
    v
Short code resolves to photo record
  - Redirect to /photo/[uuid]
    |
    v
Photo page loads with action buttons:
  |
  +---> [Share] - Native share sheet or copy link
  |
  +---> [Instagram] - 6 canvas templates (story-sized)
  |       - Minimal, Dark, Gradient, Warm, Ocean, Film Strip
  |       - Downloads 1080x1920 PNG
  |       - Or uses Web Share API -> Instagram
  |       - NOTE: Shares just the photo, NOT the full receipt template
  |
  +---> [Save] - Download original photo
  |
  +---> [Email Me] - Send photo to own email
  |       - Rate limited: 3 per photo per hour
  |
  +---> [Time Capsule] - Write a message to future self
          |
          v
        Capsule form:
          - Email address
          - Message (max 500 chars)
          - Delivery date:
            - 1 week
            - 3 months
            - 6 months
            - 1 year
            - Custom date (max 1 year)
          |
          v
        Capsule sealed:
          - Confirmation email sent with cancel link
          - Scheduled delivery via QStash
          - At delivery time: email with photo + message
```

**Status:** Fully implemented in code. NOT deployed (localhost:3002). After deployment (Feature C3), this flow works end-to-end.

**Link expiry:** Photos expire after 90 days by default (configurable). Expired photos return 404. Expiry timer not shown to user on page (Feature C4).

---

### Flow 5: Self-Service Dashboard (NOT YET BUILT)

```
User visits create.archivio.app
    |
    v
Full receipt designer (same as operator dashboard)
  - No Pi connection needed
  - No print button (replaced with Download)
  - All features unlocked
    |
    v
User designs their receipt:
  - Upload photo
  - Choose filter, dithering, brightness
  - Add memo text
  - Add stickers
  - Configure QR code
  - Add stamps
    |
    v
User downloads:
  - PNG image
  - Or: "Print at Cafe" flow
    - Generates design code
    - Bring to partnered cafe
    - Operator loads design and prints
```

**Status:** NOT BUILT. Requires Feature C7 (Self-Service Public Dashboard). The dashboard already works without Pi (preview-only), just needs a dedicated route and download button.

---

## 7. Database Schema Reference

### archivio-platform (Turso/SQLite)

```sql
-- Cafe organisations
CREATE TABLE cafes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logoUrl     TEXT,
  piServerUrl TEXT,
  plan        TEXT DEFAULT 'free',     -- 'free' | 'pro' | 'enterprise'
  isActive    INTEGER DEFAULT 1,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL
);

-- Users linked to Supabase auth
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  supabaseId  TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  role        TEXT NOT NULL,            -- 'super_admin' | 'cafe_admin' | 'cafe_operator'
  cafeId      TEXT REFERENCES cafes(id),
  avatarUrl   TEXT,
  isActive    INTEGER DEFAULT 1,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL
);

-- Per-cafe configuration (1:1 with cafes)
CREATE TABLE cafe_configs (
  cafeId          TEXT PRIMARY KEY REFERENCES cafes(id),
  logoUrl         TEXT,
  headerText      TEXT,
  headerTextFont  TEXT,
  headerTextSize  INTEGER,
  headerTextBold  INTEGER,
  headerTextItalic INTEGER,
  headerHeight    INTEGER,
  algorithm       TEXT,
  printBrightness TEXT,
  photoBorderId   TEXT,
  photoFilter     TEXT,
  features        TEXT,                 -- JSON: CafeFeatureFlags
  sectionOrder    TEXT,                 -- JSON: string[]
  photoAspectRatio TEXT,
  qrEnabled       INTEGER,
  qrUrl           TEXT,
  qrCaption       TEXT,
  dateStampEnabled INTEGER,
  timeStampEnabled INTEGER,
  locationStampEnabled INTEGER,
  locationText    TEXT,
  defaultMemo     TEXT,
  memoFont        TEXT,
  memoFontSize    INTEGER,
  eventModeEnabled INTEGER,
  eventName       TEXT,
  eventDate       TEXT,
  eventLocation   TEXT,
  updatedAt       INTEGER NOT NULL
);

-- Receipt design templates
CREATE TABLE cafe_templates (
  id           TEXT PRIMARY KEY,
  cafeId       TEXT NOT NULL REFERENCES cafes(id),
  name         TEXT NOT NULL,
  description  TEXT,
  thumbnailUrl TEXT,
  state        TEXT NOT NULL,           -- JSON: full Zustand booth-store snapshot
  lockedFields TEXT,                    -- JSON: string[] of locked field names
  isDefault    INTEGER DEFAULT 0,
  isActive     INTEGER DEFAULT 1,
  createdAt    INTEGER NOT NULL,
  updatedAt    INTEGER NOT NULL
);

-- Admin action audit trail
CREATE TABLE audit_log (
  id        TEXT PRIMARY KEY,
  userId    TEXT REFERENCES users(id),
  cafeId    TEXT REFERENCES cafes(id),
  action    TEXT NOT NULL,              -- e.g., 'cafe.create', 'config.update'
  details   TEXT,                       -- JSON
  createdAt INTEGER NOT NULL
);
```

### archivio-share (Turso/SQLite)

```sql
-- Photo events/sessions
CREATE TABLE events (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  slug            TEXT UNIQUE,
  date            TEXT,
  location        TEXT,
  organizer       TEXT,
  branding        TEXT,                 -- JSON
  photoExpiryDays INTEGER DEFAULT 90,
  isActive        INTEGER DEFAULT 1,
  createdAt       INTEGER NOT NULL,
  updatedAt       INTEGER NOT NULL
);

-- Uploaded photos (3 variants stored in R2)
CREATE TABLE photos (
  id           TEXT PRIMARY KEY,
  eventId      TEXT REFERENCES events(id),
  shortCode    TEXT UNIQUE NOT NULL,    -- 8-char code for QR URLs
  status       TEXT DEFAULT 'pending',  -- 'pending' | 'uploaded'
  originalUrl  TEXT,                    -- R2 URL: full resolution
  thumbnailUrl TEXT,                    -- R2 URL: display size
  socialUrl    TEXT,                    -- R2 URL: Instagram 9:16
  fileSize     INTEGER,
  width        INTEGER,
  height       INTEGER,
  expiresAt    INTEGER,                -- Unix timestamp, null = no expiry
  viewCount    INTEGER DEFAULT 0,
  createdAt    INTEGER NOT NULL
);

-- Time capsules (sealed messages delivered later)
CREATE TABLE capsules (
  id              TEXT PRIMARY KEY,
  photoId         TEXT NOT NULL REFERENCES photos(id),
  email           TEXT NOT NULL,
  message         TEXT NOT NULL,
  includeTemplate INTEGER DEFAULT 0,
  deliveryOption  TEXT NOT NULL,        -- '1week' | '3months' | '6months' | '1year' | 'custom'
  deliverAt       INTEGER NOT NULL,     -- Unix timestamp
  status          TEXT DEFAULT 'sealed', -- 'sealed' | 'delivered' | 'cancelled' | 'failed'
  deliveredAt     INTEGER,
  cancelToken     TEXT UNIQUE NOT NULL,
  qstashMessageId TEXT,
  emailTemplateId TEXT REFERENCES emailTemplates(id),
  createdAt       INTEGER NOT NULL
);

-- Customisable email templates for capsules
CREATE TABLE email_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  subject     TEXT,
  heading     TEXT,
  bodyHtml    TEXT,                     -- Supports {{photo}}, {{message}}, {{event}}
  footerText  TEXT,
  previewText TEXT,
  eventId     TEXT REFERENCES events(id),
  isActive    INTEGER DEFAULT 0,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL
);

-- Email delivery event log (from Resend webhooks)
CREATE TABLE email_events (
  id        TEXT PRIMARY KEY,
  capsuleId TEXT REFERENCES capsules(id),
  eventType TEXT,                       -- 'bounce', 'delivered', 'complaint', etc.
  payload   TEXT,                       -- JSON from webhook
  createdAt INTEGER NOT NULL
);

-- Rate limit tracking for "email me" feature
CREATE TABLE email_self_log (
  id        TEXT PRIMARY KEY,
  photoId   TEXT REFERENCES photos(id),
  email     TEXT,
  createdAt INTEGER NOT NULL
);
```

### archivio-server / Pi (SQLite)

```sql
CREATE TABLE templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  thumbnail  TEXT,
  state      TEXT NOT NULL,             -- JSON: booth state
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gallery (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  type        TEXT DEFAULT 'print',     -- 'print' | 'digital'
  template_id TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. API Endpoint Reference

### archivio-server (Flask, Pi, port 5000)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/health` | System health (camera, printer status) | None |
| `GET` | `/api/camera/status` | Camera availability check | None |
| `POST` | `/api/camera/capture` | Capture photo from Pi camera | None |
| `POST` | `/api/upload/logo` | Upload company logo (multipart) | None |
| `POST` | `/api/upload/photo` | Upload photo (multipart) | None |
| `POST` | `/api/upload/sticker` | Upload sticker PNG/WebP (multipart) | None |
| `POST` | `/api/upload/thumbnail` | Upload template thumbnail (multipart) | None |
| `POST` | `/api/print/queue` | Enqueue print job (async, returns job_id) | None |
| `GET` | `/api/print/queue` | List all print jobs | None |
| `GET` | `/api/print/status/<job_id>` | Get job status | None |
| `DELETE` | `/api/print/queue/<job_id>` | Cancel pending print job | None |
| `POST` | `/api/print/image` | Print canvas-exported image (WYSIWYG) | None |
| `POST` | `/api/print` | Synchronous print (legacy) | None |
| `POST` | `/api/print/test` | Test print page | None |
| `POST` | `/api/templates` | Save template | None |
| `GET` | `/api/templates` | List all templates | None |
| `GET` | `/api/templates/<id>` | Get template | None |
| `PUT` | `/api/templates/<id>` | Update template | None |
| `DELETE` | `/api/templates/<id>` | Delete template | None |
| `POST` | `/api/gallery` | Save to gallery | None |
| `GET` | `/api/gallery` | List gallery (filter by `?type=`) | None |
| `DELETE` | `/api/gallery/<id>` | Delete from gallery | None |
| `GET` | `/api/admin/cleanup` | Remove old files (`?days=30`) | None |
| `GET` | `/api/admin/backup` | Backup database | None |
| `GET` | `/api/images/<file>` | Serve uploaded image | None |
| `GET` | `/api/stickers/<file>` | Serve sticker | None |
| `GET` | `/api/previews/<file>` | Serve preview | None |
| `GET` | `/api/gallery/images/<file>` | Serve gallery image | None |

### archivio-share (Next.js, Vercel, port 3002)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `POST` | `/api/upload` | Upload photo (3 variants, HMAC-signed) | HMAC |
| `GET` | `/api/photo/[id]` | Get photo metadata | None |
| `GET` | `/api/photo/[id]/download` | Download original photo | None |
| `POST` | `/api/photo/[id]/email` | Email photo to self | None (rate limited) |
| `POST` | `/api/capsule` | Create time capsule | None (rate limited) |
| `POST` | `/api/capsule/send` | Deliver capsule (QStash webhook) | QStash signature |
| `GET` | `/api/capsule/cancel` | Cancel capsule (`?token=`) | Token |
| `GET` | `/api/events` | List events | NextAuth |
| `GET` | `/api/events/[id]` | Get event | NextAuth |
| `PUT` | `/api/events/[id]` | Update event | NextAuth |
| `GET` | `/api/templates` | List email templates | NextAuth |
| `GET` | `/api/templates/[id]` | Get email template | NextAuth |
| `PUT` | `/api/templates/[id]` | Update email template | NextAuth |
| `POST` | `/api/webhook/email-status` | Resend delivery status webhook | None |
| `GET` | `/api/health` | Health check | None |
| `*` | `/api/auth/[...nextauth]` | NextAuth endpoints | Varies |

### archivio-platform (Next.js, Vercel, port 3001)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/config/[cafeId]` | Get cafe configuration | Supabase (cafe member) |
| `PUT` | `/api/config/[cafeId]` | Update cafe configuration | Supabase (cafe admin+) |
| Various | `/api/cafes/*` | Cafe CRUD | Supabase |
| Various | `/api/users/*` | User management | Supabase |
| Various | `/api/templates/*` | Template CRUD for cafe | Supabase |

---

## 9. Environment & Deployment Reference

### archivio-dashboard/.env.local
```env
# Raspberry Pi server (LAN)
NEXT_PUBLIC_PI_URL=http://monster-pi.local:5000

# Share service (production URL required)
NEXT_PUBLIC_SHARE_URL=http://localhost:3002          # TODO: Update to production
NEXT_PUBLIC_SHARE_SHORT_URL=http://localhost:3002/s   # TODO: Update to production

# HMAC secret for signing share uploads
NEXT_PUBLIC_SHARE_SECRET=bce8c938d3b27576d0f5640c26e31b0967b6269a7e6d67fa0dbb223c0a3fd8d6
```

### archivio-platform/.env.local
```env
# Supabase authentication
NEXT_PUBLIC_SUPABASE_URL=https://mkimrmaikhieqnocrger.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Database (Turso for production, SQLite for dev)
TURSO_DATABASE_URL=file:local.db                     # TODO: Turso production URL

# Super admin emails
SUPER_ADMIN_EMAILS=aayush@archivio.app

# URLs
NEXT_PUBLIC_APP_URL=http://localhost:3001             # TODO: Production URL
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3000        # TODO: Production URL
```

### archivio-share/.env.local
```env
# Upload signature verification
SHARE_SECRET=bce8c938d3b27576d0f5640c26e31b0967b6269a7e6d67fa0dbb223c0a3fd8d6

# Admin auth (NextAuth)
AUTH_SECRET=dev-auth-secret-change-in-prod            # TODO: Secure secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123                               # TODO: Secure password

# Database
TURSO_DATABASE_URL=file:local.db                     # TODO: Turso production URL

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3002             # TODO: Production URL

# Resend (email)
RESEND_API_KEY=re_aYfF3YeQ_...
RESEND_FROM=Archivio <onboarding@resend.dev>         # TODO: Production domain

# QStash (scheduled delivery)
QSTASH_TOKEN=eyJ...
QSTASH_URL=https://qstash-eu-central-1.upstash.io
QSTASH_CURRENT_SIGNING_KEY=sig_6s8M...
QSTASH_NEXT_SIGNING_KEY=sig_7eLDP...

# Cloudflare R2 (image storage) -- NOT CONFIGURED
# R2_ACCOUNT_ID=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_BUCKET_NAME=archivio-photos
# R2_PUBLIC_URL=https://images.archivio.app
```

### Raspberry Pi
```
Hostname:     monster-pi
IP:           192.168.0.106
SSH User:     monster-pi
Server Path:  ~/archivio-server/
Server Port:  5000
Printer:      /dev/usb/lp0 (576px width thermal)
Camera:       Not connected (picamera2 installed)
Systemd:      archivio-server.service (enabled, auto-restart)
Cron:         0 3 * * * cleanup (30 days)
Deployment:   ./sync-to-pi.sh [--restart|--status|--fix-permissions]
```

---

## 10. Prioritised Development Phases

### Phase 1: Fix Flaws & Deploy Share Service (Week 1-2)

**Goal:** Make the QR -> share -> time capsule flow work end-to-end.

| # | Task | Effort | Flaw/Feature |
|---|------|--------|--------------|
| 1.1 | Fix platform config editor: remove stale filter/brightness options | 2h | A1 |
| 1.2 | Clean up Pi: remove `youmee-server`, fix file ownership | 1h | A2, A4 |
| 1.3 | Create Turso production DB for share service | 1h | C3 |
| 1.4 | Create Cloudflare R2 bucket + API tokens | 2h | C3 |
| 1.5 | Set up Resend production domain (DNS verification) | 2h | C3 |
| 1.6 | Deploy archivio-share to Vercel | 2h | C3 |
| 1.7 | Update dashboard env vars with production share URL | 30m | A6 |
| 1.8 | Test end-to-end: print -> QR scan -> share page -> email -> capsule | 4h | All |
| 1.9 | Fix Pi camera connection (hardware + config) | 2h | A3 |
| 1.10 | Verify gallery save flow on Pi | 1h | A5 |
| **Total** | | **~17h** | |

### Phase 2: Customer Kiosk Mode (Week 3-4)

**Goal:** Customers can walk up and take photos themselves.

| # | Task | Effort | Feature |
|---|------|--------|---------|
| 2.1 | Design kiosk UI wireframes (start, countdown, preview, done) | 3h | C1 |
| 2.2 | Create `/kiosk` route in dashboard | 2h | C1 |
| 2.3 | Build start screen with cafe branding | 3h | C1 |
| 2.4 | Build countdown component (3-2-1 animation) | 2h | C1 |
| 2.5 | Integrate Pi camera capture with auto-trigger | 3h | C1 |
| 2.6 | Build preview screen with retake/print buttons | 3h | C1 |
| 2.7 | Auto-template application (load default template, inject photo) | 4h | C1 |
| 2.8 | Auto QR generation (short code + share upload queue) | 3h | C1 |
| 2.9 | Build print confirmation screen with QR display | 2h | C1 |
| 2.10 | Auto-reset loop (10s timer back to start) | 1h | C1 |
| 2.11 | Full-screen mode + touch optimisation | 2h | C1 |
| 2.12 | Device camera fallback (for setups without Pi camera) | 3h | C1 |
| 2.13 | Kiosk config: load from cafe config or Pi templates | 2h | C1 |
| 2.14 | End-to-end testing | 4h | C1 |
| **Total** | | **~37h** | |

### Phase 3: Template Builder & Admin Polish (Week 5-6)

**Goal:** Admins can visually create and manage templates.

| # | Task | Effort | Feature |
|---|------|--------|---------|
| 3.1 | Dashboard: "Save as Template" button (visible in admin/design mode) | 4h | C2 |
| 3.2 | Dashboard: Canvas thumbnail export function | 2h | C2 |
| 3.3 | Dashboard: postMessage to platform with state + thumbnail | 2h | C2 |
| 3.4 | Platform: "Design Template" button -> iframe with `?mode=design` | 3h | C2 |
| 3.5 | Platform: Template save dialog (name, description) | 2h | C2 |
| 3.6 | Platform: Lock field picker (checkboxes per field) | 4h | C2 |
| 3.7 | Platform: Template list with thumbnails | 2h | C2 |
| 3.8 | Platform: Logo upload for cafe branding | 3h | B3 |
| 3.9 | Sync platform events -> share service events | 4h | B4 |
| 3.10 | Deploy archivio-platform to Vercel | 2h | |
| 3.11 | Create Turso production DB for platform | 1h | |
| 3.12 | End-to-end testing | 4h | |
| **Total** | | **~33h** | |

### Phase 4: Self-Service Public Dashboard (Week 7-8)

**Goal:** Public users can design receipts without a cafe.

| # | Task | Effort | Feature |
|---|------|--------|---------|
| 4.1 | Dashboard: `/create` route (no Pi required) | 3h | C7 |
| 4.2 | Dashboard: Detect Pi connection, toggle Print/Download buttons | 2h | C7 |
| 4.3 | Dashboard: "Download as PNG" button | 2h | C7 |
| 4.4 | Dashboard: "Download as PDF" (jsPDF integration) | 4h | C7 |
| 4.5 | Optional: "Print at Cafe" flow with design code | 6h | C7 |
| 4.6 | Optional: Sign-up to save designs (Supabase auth) | 4h | C7 |
| 4.7 | Deploy to `create.archivio.app` | 2h | C7 |
| 4.8 | Share page: Show expiry countdown ("expires in X days") | 3h | C4 |
| 4.9 | Instagram: Optimise Web Share API flow with instructions | 3h | C5 |
| **Total** | | **~29h** | |

### Phase 5: Remote Management & Instagram (Week 9-10)

**Goal:** Admins can manage booths from anywhere.

| # | Task | Effort | Feature |
|---|------|--------|---------|
| 5.1 | Install Cloudflare Tunnel on Pi | 2h | C6 |
| 5.2 | Create systemd service for tunnel (auto-start) | 1h | C6 |
| 5.3 | Platform: Store tunnel URL in `cafes.piServerUrl` | 1h | C6 |
| 5.4 | Platform: Health polling (green/red indicator per cafe) | 4h | C6 |
| 5.5 | Platform: Remote print queue viewer | 3h | C6 |
| 5.6 | Platform: Remote test print trigger | 2h | C6 |
| 5.7 | Platform: Alert when Pi goes offline (email notification) | 4h | C6 |
| 5.8 | Instagram deep link testing on iOS + Android | 3h | C5 |
| 5.9 | Instagram: "Add to Story" instruction overlay | 2h | C5 |
| **Total** | | **~22h** | |

### Phase 6: Scale & Monetise (Week 11+)

**Goal:** Multi-tenant revenue generation.

| # | Task | Effort | Feature |
|---|------|--------|---------|
| 6.1 | Multi-Pi support: `devices` table + UI | 2 weeks | C8 |
| 6.2 | Analytics dashboard: Recharts charts + daily aggregation | 2 weeks | C9 |
| 6.3 | Stripe integration: plans, checkout, webhooks | 2 weeks | B5 |
| 6.4 | Plan-based feature gating | 1 week | B5 |
| 6.5 | Cloud backup: Pi gallery -> R2, template sync | 1 week | C10 |
| 6.6 | White-label: custom domains, branding per cafe | 1 week | Future |
| **Total** | | **~9 weeks** | |

---

## Summary

| Metric | Count |
|---|---|
| Active flaws/bugs | 7 |
| Integration gaps | 5 |
| Features to build | 10 |
| **Total items** | **22** |
| Phase 1 effort (critical) | ~17 hours |
| Phase 2 effort (kiosk) | ~37 hours |
| Phase 3 effort (templates) | ~33 hours |
| Phase 4 effort (self-service) | ~29 hours |
| Phase 5 effort (remote) | ~22 hours |
| Phase 6 effort (scale) | ~9 weeks |

**Critical path to minimum viable product:**
1. Deploy share service (Phase 1) -- QR codes work
2. Build kiosk mode (Phase 2) -- Customers can self-serve
3. Template builder (Phase 3) -- Admins can manage remotely

Everything else enhances but isn't required for the core cafe photo booth experience.
