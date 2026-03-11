# Archivio Photo Booth

A complete thermal-printer photo booth platform with a **receipt designer dashboard**, **admin management panel**, **digital sharing service**, and **Raspberry Pi print server**. Designed for cafes, events, and activations — guests take photos, customize receipts, print on 80 mm thermal paper, and share digitally via QR code.

---

## Architecture

```
                     ┌─────────────────────────────┐
                     │     archivio-platform        │  Port 3001
                     │     (Admin SaaS Panel)       │  Next.js 15 + Supabase Auth
                     │     Vercel deployment        │  Turso (multi-tenant DB)
                     └──────────┬──────────────────┘
                                │
                   postMessage (iframe embed)
                                │
         ┌──────────────────────▼───────────────────────────┐
         │              archivio-dashboard                   │  Port 3000
         │        (Booth Kiosk / Self-Service UI)            │  Next.js 16 + Zustand
         │    Runs on Mac (dev) or Pi browser (prod)         │  Konva (canvas render)
         └──────────┬──────────────────┬────────────────────┘
                    │                  │
           REST API (LAN)       HMAC-signed upload
                    │                  │
         ┌──────────▼──────────┐   ┌──▼────────────────────┐
         │   archivio-server   │   │   archivio-share       │  Port 3002
         │   (Raspberry Pi)    │   │   (Photo Sharing +     │  Next.js 15
         │   Flask + ESC/POS   │   │    Time Capsules)      │  Turso + Vercel Blob
         │   Camera + Printer  │   │   Vercel deployment    │  Resend + QStash
         └─────────────────────┘   └────────────────────────┘
```

---

## Tech Stack

| Component | Framework | Database | Auth | Hosting |
|---|---|---|---|---|
| **archivio-platform** | Next.js 15, React 19, Tailwind 4 | Turso (SQLite) | Supabase | Vercel |
| **archivio-dashboard** | Next.js 16, React 19, Zustand, Konva | IndexedDB (persist) | None (LAN-only) | Local / Pi browser |
| **archivio-server** | Flask, Pillow, ESC/POS | SQLite (WAL) | None (LAN-only) | Raspberry Pi (systemd) |
| **archivio-share** | Next.js 15, Drizzle ORM | Turso (SQLite) | NextAuth (admin) | Vercel |

### External Services

| Service | Purpose | Used By |
|---|---|---|
| Supabase | User auth + management | Platform |
| Turso (LibSQL) | Hosted SQLite databases | Platform, Share |
| Vercel Blob | Image storage | Share |
| Resend | Transactional email | Share |
| Upstash QStash | Scheduled delivery (time capsules) | Share |
| Cloudflare Tunnel | Remote Pi access | Server |
| Google Fonts API | Dynamic font loading + Montserrat/Inconsolata | All services |

---

## Quick Start

### Prerequisites

- **Mac**: Node.js 20+, npm
- **Raspberry Pi**: Python 3.11+, pip, USB thermal printer (80 mm ESC/POS), `cloudflared`
- Both devices on the same local network

### 1. Install dependencies

```bash
# Dashboard
cd archivio-dashboard && npm install

# Platform
cd archivio-platform && npm install

# Share service
cd archivio-share && npm install

# Pi server (on Pi via SSH)
ssh monster-pi@monster-pi.local
cd ~/archivio-server && pip install -r requirements.txt
```

### 2. Configure environment variables

Each service has an `.env.local` file. See the Environment Variables section below.

### 3. Start all servers

#### One-command pipeline (recommended)

```bash
# Deploy all services to Vercel/Pi, then start local dev servers:
./pipeline.sh

# Deploy + start but skip Pi sync (if Pi is offline):
./pipeline.sh --skip-pi

# Start local servers only (no deploy):
./pipeline.sh --start-only

# Deploy only (no local servers):
./pipeline.sh --deploy-only

# Check status of all services:
./pipeline.sh --status

# Stop all local dev servers:
./pipeline.sh --stop
```

The pipeline script:
1. Runs pre-flight checks (Node.js, dependencies, Vercel CLI)
2. Deploys `archivio-share` and `archivio-platform` to Vercel (production)
3. Syncs `archivio-server` to the Raspberry Pi and restarts it
4. Starts all three frontend dev servers in the background
5. Waits for each server to be ready and prints a summary table
6. Logs go to `.logs/{dashboard,platform,share}.log`

#### Manual start (separate terminals)

```bash
# Terminal 1 — Dashboard (port 3000)
cd archivio-dashboard && npm run dev

# Terminal 2 — Platform (port 3001)
cd archivio-platform && npm run dev

# Terminal 3 — Share service (port 3002)
cd archivio-share && npm run dev

# Pi server runs via systemd (auto-starts on boot)
# To sync code and restart:
./sync-to-pi.sh --restart

# To check status:
./sync-to-pi.sh --status
```

### 4. Verify everything is running

| Service | URL | Expected |
|---------|-----|----------|
| Dashboard | http://localhost:3000 | Receipt designer UI |
| Platform | http://localhost:3001 | Login page |
| Share | http://localhost:3002 | Home page |
| Share health | http://localhost:3002/api/health | `{"ok":true,...}` |
| Pi health | http://monster-pi.local:5000/api/health | `{"status":"ok","printer":true,...}` |

---

## Credentials

### Platform Admin (Supabase auth)

| Field | Value |
|-------|-------|
| Email | `aayush@archivio.app` |
| Password | `archivio2026` |
| Role | Super Admin (set via `SUPER_ADMIN_EMAILS` env var) |
| Login URL | http://localhost:3001/login |

This account has full access: create cafes, manage configs, design templates, invite users.

### Share Service Admin (NextAuth credentials)

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |
| Login URL | http://localhost:3002/admin |

This panel shows photo stats, capsule management, email templates, and events.

### Raspberry Pi (SSH)

| Field | Value |
|-------|-------|
| User | `monster-pi` |
| Host | `monster-pi.local` or `192.168.0.106` |
| Server path | `~/archivio-server/` |
| Server port | `5000` |

---

## Environment Variables

### archivio-dashboard/.env.local

```env
NEXT_PUBLIC_PI_URL=http://monster-pi.local:5000
NEXT_PUBLIC_SHARE_URL=https://archivio-share.vercel.app
NEXT_PUBLIC_SHARE_SHORT_URL=https://archivio-share.vercel.app/s
NEXT_PUBLIC_SHARE_SECRET=<hmac-shared-secret>
```

### archivio-platform/.env.local

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
TURSO_DATABASE_URL=file:local.db              # local dev; Turso URL for production
TURSO_AUTH_TOKEN=                              # only needed for production Turso
SUPER_ADMIN_EMAILS=aayush@archivio.app
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3000
SHARE_SERVICE_URL=https://archivio-share.vercel.app
SHARE_SERVICE_SECRET=<hmac-shared-secret>
```

### archivio-share/.env.local

```env
SHARE_SECRET=<hmac-shared-secret>
AUTH_SECRET=<nextauth-secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
TURSO_DATABASE_URL=file:local.db              # local dev; Turso URL for production
NEXT_PUBLIC_APP_URL=http://localhost:3002
RESEND_API_KEY=<resend-api-key>
RESEND_FROM=Archivio <onboarding@resend.dev>
QSTASH_TOKEN=<qstash-token>
QSTASH_URL=https://qstash-eu-central-1.upstash.io
QSTASH_CURRENT_SIGNING_KEY=<key>
QSTASH_NEXT_SIGNING_KEY=<key>
```

---

## Production Deployments

| Service | URL |
|---------|-----|
| Share service | https://archivio-share.vercel.app |
| Platform | https://archivio-platform-aayushkumrs-projects.vercel.app |
| Pi (tunnel) | Changes on restart — check `journalctl -u cloudflared-tunnel` on Pi |

---

## Features & Routes

### Dashboard (archivio-dashboard)

| Route | Purpose |
|-------|---------|
| `/` | Main receipt designer — upload photos, customize, print |
| `/create` | Self-service mode — design receipts without a Pi, download as PNG |
| `/kiosk` | Customer-facing kiosk — full-screen auto flow (start → countdown → capture → print → done) |
| `/templates` | Local template management |
| `/gallery` | View past prints saved on Pi |

**Receipt designer features:**
- Live WYSIWYG preview (Konva canvas, 80 mm thermal paper scale)
- Photo upload, device camera capture, Pi camera capture
- 4 dithering algorithms: Atkinson, Floyd-Steinberg, Stucki, Bayer
- 2 filters: Standard B&W, Warm Sepia
- 2 brightness presets: Medium, High
- 10 border styles (Polaroid, Rounded, Double, etc.)
- Logo upload with crop
- Header text with Google Fonts picker
- Memo text with font, size, bold/italic/underline
- Sticker panel with drag/resize/rotate
- QR code with configurable URL
- Date/time/location stamps
- Section reorder via drag-and-drop
- Multi-photo grid mode (25+ layouts for 1–6 photos)
- Background removal (WASM, client-side)
- Dark mode
- Print queue with status polling
- Share upload queue (IndexedDB, HMAC-signed, exponential backoff)

### Platform (archivio-platform)

| Route | Purpose |
|-------|---------|
| `/login` | Supabase email/password auth |
| `/admin` | Admin dashboard home |
| `/admin/cafes` | Cafe list — create, edit, deactivate |
| `/admin/cafes/[id]` | Cafe detail — config editor, templates, members |
| `/admin/settings` | User settings |
| `/booth/[slug]` | Embedded booth page — loads dashboard in iframe with cafe config |

**Admin features:**
- Role-based access: `super_admin`, `cafe_admin`, `cafe_operator`
- Per-cafe configuration: branding, print defaults, 23 feature flags, event mode
- Visual template builder (embeds dashboard in iframe with `?mode=design`)
- Template lock fields (restrict what operators can change)
- Event mode with auto-sync to share service
- Audit log
- User/member management

### Share Service (archivio-share)

| Route | Purpose |
|-------|---------|
| `/` | Home page |
| `/s/[code]` | Short code redirect → photo page |
| `/photo/[id]` | Photo viewing with action buttons |
| `/admin` | Admin dashboard with stats overview |
| `/admin/photos` | Photo management — grid view, bulk select, delete |
| `/admin/capsules` | Capsule management — status filters, bulk delete |
| `/admin/events` | Event list and editor |
| `/admin/templates` | Email template list and editor |

**Share features:**
- HMAC-signed photo upload (3 variants: original, thumbnail, social)
- Short code redirect for QR codes
- Photo download
- Instagram share with 6 canvas templates (Minimal, Dark, Gradient, Warm, Ocean, Film Strip) — uses Web Share API on mobile, clipboard on desktop
- Time capsule creation (schedule future email delivery via QStash + Resend)
- Photo expiry (90 days default, shown as countdown badge)
- Admin dashboard with stat cards (photos, scans, capsules, events), recent photo grid, recent capsules
- Photo management with thumbnail grid, multi-select, bulk delete (cleans up storage + associated capsules)
- Capsule management with status filter tabs, counts, bulk delete, pagination

### Pi Server (archivio-server)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Printer + camera status |
| `/api/print/image` | POST | Print a pre-rendered image (WYSIWYG path) |
| `/api/print/queue` | POST | Enqueue a structured print job |
| `/api/print/queue` | GET | List print jobs |
| `/api/print/status/<id>` | GET | Job status |
| `/api/gallery` | POST | Save image to gallery |
| `/api/gallery` | GET | List gallery items |
| `/api/gallery/<id>` | DELETE | Delete gallery item |
| `/api/templates` | GET/POST | Template CRUD |
| `/api/upload/logo` | POST | Upload logo |
| `/api/upload/photo` | POST | Upload photo |
| `/api/upload/sticker` | POST | Upload sticker |
| `/api/camera/capture` | POST | Capture from Pi camera |

---

## Testing Guide

### 1. Receipt Designer (localhost:3000)

1. Open http://localhost:3000
2. **Upload a photo** — drag into the dropzone or click to browse
3. **Customize** — try filters (Standard B&W / Warm Sepia), borders (Polaroid, Rounded), dithering modes
4. **Header** — toggle on, type a name, pick a Google Font
5. **Memo** — type a message, change font/size/bold/italic
6. **Stickers** — open the sticker panel, drag stickers onto the canvas, resize/rotate
7. **QR code** — toggle on, enter a URL
8. **Stamps** — toggle date/time/location
9. **Print** — click Print to send to Pi (requires Pi on same network)
10. **Dark mode** — toggle the moon/sun icon; bleed zone adapts to theme

### 2. Self-Service Mode (localhost:3000/create)

1. Open http://localhost:3000/create
2. Same editing features, no Pi needed
3. Click **Download PNG** to save the receipt as an image

### 3. Kiosk Mode (localhost:3000/kiosk)

1. Open http://localhost:3000/kiosk
2. Full-screen start screen with cafe branding
3. Tap **Start** → 3-second countdown → auto-capture from device camera
4. **Preview** with Retake / Print buttons
5. Print triggers: canvas export → Pi print → gallery save → share upload
6. Done screen with QR code, auto-resets after 12 seconds

### 4. Platform Admin (localhost:3001)

1. Open http://localhost:3001/login
2. Sign in with `aayush@archivio.app` / `archivio2026`
3. **Create a cafe** at `/admin/cafes` — enter name, slug, Pi server URL
4. **Configure** — click into the cafe, adjust branding, print settings, feature flags, event mode
5. **Design templates** — click "Design Template" to open the dashboard in an iframe, design a receipt, click "Save Template"
6. **Test booth page** — visit `/booth/[your-slug]` to see the embedded dashboard with config applied

### 5. Share Service (localhost:3002)

1. After printing from the dashboard, a QR code is generated on the receipt
2. Scan the QR or visit the short URL (e.g. `archivio-share.vercel.app/s/ABC12345`)
3. **Download** the photo
4. **Instagram share** — pick a template, generate, then share via mobile share sheet or copy to clipboard on desktop
5. **Time capsule** — schedule a future email delivery
7. **Admin panel** at `/admin` — login with `admin` / `admin123`

### 6. Cross-Service End-to-End Flow

The complete user journey:

```
Dashboard (design receipt)
    │
    ├── Print → Pi server → thermal printer → physical receipt with QR
    ├── Save → Pi gallery (POST /api/gallery)
    └── Upload → share service (HMAC-signed, 3 image variants)
            │
            └── Share page (archivio-share.vercel.app/s/CODE)
                    ├── Download original
                    ├── Instagram share (6 templates, Web Share API)
                    └── Time capsule (scheduled email via QStash)
```

### 7. Remote Pi Access (Cloudflare Tunnel)

The Pi runs a Cloudflare quick tunnel as a systemd service. To find the current public URL:

```bash
ssh monster-pi@monster-pi.local "journalctl -u cloudflared-tunnel | grep trycloudflare.com | tail -1"
```

Test remotely:
```bash
curl https://<tunnel-url>/api/health
```

Note: Quick tunnel URLs change on restart. For a permanent URL, create a named tunnel with a custom domain.

---

## Deployment

### Deploy server to Pi (from Mac)

```bash
./sync-to-pi.sh              # Sync files only
./sync-to-pi.sh --restart    # Sync + restart systemd service
./sync-to-pi.sh --status     # Check server status
./sync-to-pi.sh --fix-permissions  # Fix ownership issues
```

### Deploy share service to Vercel

The share service is deployed at `archivio-share.vercel.app`. To redeploy:

```bash
cd archivio-share && vercel --prod
```

### Deploy platform to Vercel

The platform is deployed at `archivio-platform-aayushkumrs-projects.vercel.app`. To redeploy:

```bash
cd archivio-platform
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

### Push database schema changes

```bash
# Platform
cd archivio-platform
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx drizzle-kit push

# Share
cd archivio-share
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx drizzle-kit push
```

---

## Raspberry Pi Setup

| Detail | Value |
|--------|-------|
| Hostname | `monster-pi` |
| IP | `192.168.0.106` |
| SSH user | `monster-pi` |
| Server path | `~/archivio-server/` |
| Server port | `5000` |
| Printer | `/dev/usb/lp0` (576px width thermal) |
| Camera | Pi camera module (requires physical connection) |
| Systemd services | `archivio-server.service`, `cloudflared-tunnel.service` |
| Cron | `0 3 * * *` cleanup (removes files > 30 days) |

### Systemd services

```bash
# Server
sudo systemctl status archivio-server
sudo systemctl restart archivio-server
sudo journalctl -u archivio-server -f

# Tunnel
sudo systemctl status cloudflared-tunnel
sudo systemctl restart cloudflared-tunnel
sudo journalctl -u cloudflared-tunnel -f
```

---

## Dithering Algorithms

| Algorithm | Style | Best For |
|-----------|-------|----------|
| Atkinson | Retro Mac look, high contrast | Logos, text-heavy receipts |
| Floyd-Steinberg | Standard fine dots | General purpose |
| Stucki | Smooth gradients | Portraits, photos |
| Bayer 8x8 | Crosshatch pattern | Stylized/artistic prints |

---

## Project Structure

```
Photobooth-Related/
├── README.md                          # This file
├── DEVELOPMENT_ROADMAP.md             # Full development roadmap
├── sync-to-pi.sh                      # Deploy server to Pi
│
├── archivio-dashboard/                # Receipt designer (Next.js 16)
│   ├── src/app/
│   │   ├── page.tsx                   # Main dashboard
│   │   ├── create/page.tsx            # Self-service (no Pi)
│   │   ├── kiosk/page.tsx             # Customer kiosk
│   │   ├── templates/page.tsx         # Template manager
│   │   └── gallery/page.tsx           # Print gallery
│   ├── src/components/
│   │   ├── receipt-canvas.tsx         # Konva WYSIWYG canvas
│   │   ├── image-dropzone.tsx         # Photo upload
│   │   ├── sticker-panel.tsx          # Sticker library
│   │   ├── font-picker.tsx            # Google Fonts picker
│   │   └── ui/                        # shadcn/ui components
│   ├── src/store/booth-store.ts       # Zustand state
│   └── src/lib/
│       ├── api.ts                     # Pi REST client
│       ├── share-upload.ts            # HMAC upload queue
│       └── fonts.ts                   # Font loader
│
├── archivio-platform/                 # Admin panel (Next.js 15)
│   ├── src/app/
│   │   ├── login/                     # Supabase auth
│   │   ├── admin/cafes/               # Cafe CRUD + config
│   │   ├── booth/[slug]/              # Embedded booth
│   │   └── api/                       # REST endpoints
│   ├── src/components/admin/
│   │   ├── cafe-config-editor.tsx     # Config form
│   │   └── template-manager.tsx       # Template CRUD
│   └── src/lib/
│       ├── schema.ts                  # Drizzle schema
│       ├── auth.ts                    # Role checks
│       └── share-sync.ts             # Event sync to share service
│
├── archivio-share/                    # Photo sharing (Next.js 15)
│   ├── src/app/
│   │   ├── photo/[id]/               # Photo page
│   │   ├── s/[code]/                  # Short code redirect
│   │   ├── admin/                     # Admin dashboard
│   │   └── api/
│   │       ├── upload/                # HMAC-signed upload
│   │       ├── capsule/               # Time capsule CRUD
│   │       └── events/                # Event management
│   └── src/components/
│       ├── photo/photo-frame.tsx      # Photo display
│       └── actions/                   # Share, save, Instagram
│
└── archivio-server/                   # Pi print server (Flask)
    ├── server.py                      # Main app (1500+ lines)
    ├── requirements.txt               # Python deps
    ├── uploads/                       # Uploaded images
    ├── stickers/                      # Sticker library
    ├── gallery/                       # Saved prints
    └── font_cache/                    # Google Fonts cache
```
