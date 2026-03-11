# Archivio Photo Booth Dashboard — Implementation Plan

## Architecture
- **Frontend**: Next.js 15 + React + Tailwind CSS + shadcn/ui (runs on Mac, served locally)
- **Backend**: Flask API on Raspberry Pi (handles camera, printing, image storage)
- **Communication**: REST API over LAN (Mac browser → Pi Flask server)

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui components
- react-dropzone for image upload
- Flask + flask-cors on Pi
- picamera2 for camera capture (when camera is connected)

## Design (Checkpoint-inspired)
- Clean white background, warm orange-yellow accent gradient
- Rounded cards (rounded-2xl/3xl), generous spacing
- Modern sans-serif typography (Inter/Geist)
- Full-height viewport sections with smooth scroll
- Minimalist, content-focused layout

## Dashboard Layout

### Page Structure:
```
┌─────────────────────────────────────┐
│  Archivio  ·  Photo Booth Dashboard  │ ← Navbar
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐    ┌──────────────┐   │
│  │ RECEIPT   │    │  CONTROLS    │   │
│  │ PREVIEW   │    │              │   │
│  │           │    │ [Logo Drop]  │   │
│  │ ┌──────┐  │    │ [Photo Drop  │   │
│  │ │ Logo │  │    │  or Camera]  │   │
│  │ ├──────┤  │    │ [Memo Text]  │   │
│  │ │Photo │  │    │ [QR URL]     │   │
│  │ │      │  │    │ [Algorithm ▼]│   │
│  │ ├──────┤  │    │              │   │
│  │ │ Memo │  │    │              │   │
│  │ ├──────┤  │    │              │   │
│  │ │ QR   │  │    │              │   │
│  │ └──────┘  │    │ [🖨 PRINT]   │   │
│  └──────────┘    └──────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Left side**: Live receipt preview (white paper card, ~300px wide, actual thermal receipt proportions)
**Right side**: Control panel with dropzones, inputs, and settings

## Key Components:
1. **ReceiptPreview** — White paper card showing real-time preview of print output
2. **LogoDropzone** — Drag & drop for company logo (pre-filled with Archivio)
3. **PhotoDropzone** — Drag & drop OR camera capture button
4. **MemoInput** — Text area for 1-2 line quote
5. **QRInput** — URL input for QR code generation
6. **AlgorithmSelect** — Dropdown: Atkinson, Bayer 8x8, Floyd-Steinberg, Stucki
7. **PrintButton** — Sends print command to Pi
8. **CameraCapture** — Modal/overlay to take photo from Pi camera

## Flask API Endpoints (on Pi):
- `POST /api/upload/logo` — Upload logo image
- `POST /api/upload/photo` — Upload photo image
- `POST /api/camera/capture` — Capture from Pi camera, return image
- `GET /api/camera/status` — Check if camera is available
- `POST /api/print` — Print receipt with all settings
- `GET /api/preview` — Generate preview image of receipt
- `GET /api/images/<filename>` — Serve uploaded images
- `GET /api/health` — Health check

## File Structure:
```
/Users/aayushkumar/Desktop/Photobooth-Related/archivio-dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── receipt-preview.tsx
│   │   ├── logo-dropzone.tsx
│   │   ├── photo-dropzone.tsx
│   │   ├── memo-input.tsx
│   │   ├── qr-input.tsx
│   │   ├── algorithm-select.tsx
│   │   ├── print-button.tsx
│   │   ├── camera-capture.tsx
│   │   └── navbar.tsx
│   └── lib/
│       └── api.ts
├── package.json
├── tailwind.config.ts
└── ...

/home/monster-pi/archivio-server/
├── server.py          ← Flask API
├── printer.py         ← Print engine (from photobooth_print_all.py)
├── uploads/           ← Uploaded images
└── previews/          ← Generated preview images
```

## Flow:
1. User opens dashboard in browser
2. Logo is pre-loaded (Archivio default), user can replace via drag & drop
3. User either drags a photo or clicks "Take Photo" (camera capture)
4. As images are added, they appear instantly in the receipt preview
5. User types a memo quote
6. QR URL auto-generates or user customizes
7. User selects dithering algorithm from dropdown
8. Click PRINT → sends everything to Pi → Pi prints receipt
9. Preview updates in real-time as any field changes
