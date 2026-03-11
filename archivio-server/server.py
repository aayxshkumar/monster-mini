#!/usr/bin/env python3
"""
ARCHIVIO Photo Booth — Flask API Server v2.1
Runs on Raspberry Pi. Handles image upload, camera capture, print queue.
Supports: single photo, grid photos, freestyle positioning, stickers, rounded corners.
"""
import os
import sys
import time
import uuid
import json
import select
import sqlite3
import threading
import queue as qmod
import logging
import subprocess
from logging.handlers import RotatingFileHandler
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

# === Config ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
PREVIEW_DIR = os.path.join(BASE_DIR, "previews")
STICKER_DIR = os.path.join(BASE_DIR, "stickers")
LP_DEVICE = os.environ.get("LP_DEVICE", "/dev/usb/lp0")
CUPS_PRINTER = os.environ.get("CUPS_PRINTER", "")
WIDTH = int(os.environ.get("WIDTH", "576"))
MARGIN = int(os.environ.get("MARGIN", "0"))
LOG_DIR = os.path.join(BASE_DIR, "logs")
LOG_FILE = os.path.join(LOG_DIR, "archivio.log")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)
os.makedirs(STICKER_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

# === Logging ===
logger = logging.getLogger("archivio")
logger.setLevel(logging.DEBUG)
_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
_handler = RotatingFileHandler(LOG_FILE, maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8")
_handler.setFormatter(_formatter)
logger.addHandler(_handler)
_console = logging.StreamHandler(sys.stdout)
_console.setFormatter(_formatter)
logger.addHandler(_console)

# === Database ===
DB_PATH = os.path.join(BASE_DIR, "archivio.db")


def get_db():
    """Get a thread-local SQLite connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            thumbnail TEXT,
            state TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS cafe_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            config TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO cafe_config (id, config) VALUES (1, '{}');

        CREATE TABLE IF NOT EXISTS gallery (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            type TEXT,
            template_id TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()
    logger.info("Database initialized")


init_db()

# Copy default logo if exists
DEFAULT_LOGO = os.path.expanduser("~/archivio_logo.png")
if os.path.exists(DEFAULT_LOGO) and not os.path.exists(os.path.join(UPLOAD_DIR, "archivio_logo.png")):
    import shutil
    shutil.copy2(DEFAULT_LOGO, os.path.join(UPLOAD_DIR, "archivio_logo.png"))

app = Flask(__name__)
CORS(app)

# === API Key Authentication ===
API_KEY = os.environ.get("API_KEY", "")

@app.before_request
def check_api_key():
    if not API_KEY:
        return  # no key configured, allow all
    if request.path == "/api/health" and request.method == "GET":
        return  # health check is always public
    if not request.path.startswith("/api/"):
        return
    key = request.headers.get("X-API-Key") or request.args.get("api_key")
    if key != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401


# ==============================
#  Print Queue
# ==============================
print_queue = qmod.Queue()
print_jobs = {}  # job_id -> {status, message, params}
jobs_lock = threading.Lock()


JOB_TTL_SECONDS = 300  # Auto-remove completed jobs after 5 minutes


def cleanup_old_jobs():
    """Remove completed/errored jobs older than JOB_TTL_SECONDS."""
    now = time.time()
    with jobs_lock:
        to_remove = [
            jid for jid, job in print_jobs.items()
            if job["status"] in ("done", "error")
            and now - job.get("finished_at", now) > JOB_TTL_SECONDS
        ]
        for jid in to_remove:
            del print_jobs[jid]
    if to_remove:
        logger.info("Cleanup: removed %d old jobs", len(to_remove))


def print_worker():
    """Background thread that processes print jobs sequentially."""
    while True:
        job_id, params = print_queue.get()

        # Cleanup old jobs before processing new ones
        cleanup_old_jobs()

        with jobs_lock:
            if job_id not in print_jobs:
                print_queue.task_done()
                continue
            print_jobs[job_id]["status"] = "printing"
            print_jobs[job_id]["message"] = "Printing..."

        try:
            # Check if this is a WYSIWYG image job (canvas export)
            if params.get("_image_print"):
                with jobs_lock:
                    receipt = print_jobs[job_id].pop("_image", None)
                if receipt is None:
                    raise ValueError("Image data missing for image print job")
            else:
                receipt = build_receipt_from_params(params)
                receipt.save(os.path.join(PREVIEW_DIR, "last_receipt.png"))
            ok, msg = do_print(receipt)
            with jobs_lock:
                if job_id in print_jobs:
                    print_jobs[job_id]["status"] = "done" if ok else "error"
                    print_jobs[job_id]["message"] = msg
                    print_jobs[job_id]["finished_at"] = time.time()
        except Exception as e:
            import traceback
            traceback.print_exc()
            with jobs_lock:
                if job_id in print_jobs:
                    print_jobs[job_id]["status"] = "error"
                    print_jobs[job_id]["message"] = str(e)
                    print_jobs[job_id]["finished_at"] = time.time()
        finally:
            print_queue.task_done()


worker_thread = threading.Thread(target=print_worker, daemon=True)
worker_thread.start()


# ==============================
#  Printer Engine
# ==============================

def write_wait(fd, data, timeout_s=120):
    total = len(data)
    sent = 0
    deadline = time.time() + timeout_s
    while sent < total:
        remaining = deadline - time.time()
        if remaining <= 0:
            raise TimeoutError(f"Timed out ({sent}/{total})")
        _, wlist, _ = select.select([], [fd], [], min(remaining, 2.0))
        if wlist:
            try:
                n = os.write(fd, data[sent:])
                sent += n
            except BlockingIOError:
                time.sleep(0.05)
    return sent


def image_to_single_raster(img):
    w, h = int(img.size[0]), int(img.size[1])
    bpl = (w + 7) // 8
    pixels = img.load()
    buf = bytearray()
    buf.extend(b"\x1d\x76\x30\x00")
    buf.append(bpl & 0xFF)
    buf.append((bpl >> 8) & 0xFF)
    buf.append(h & 0xFF)
    buf.append((h >> 8) & 0xFF)
    for y in range(h):
        for bx in range(bpl):
            byte_val = 0
            for bit in range(8):
                x = bx * 8 + bit
                if x < w and pixels[x, y] == 0:
                    byte_val |= (128 >> bit)
            buf.append(byte_val)
    return bytes(buf)


# --- Dithering algorithms ---

def dither_atkinson(gray):
    w, h = gray.size
    pixels = list(gray.getdata())
    grid = [float(p) for p in pixels]
    kernel = [(1,0,1/8),(2,0,1/8),(-1,1,1/8),(0,1,1/8),(1,1,1/8),(0,2,1/8)]
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            old = grid[idx]
            new = 255.0 if old >= 128 else 0.0
            err = old - new
            grid[idx] = new
            for dx, dy, weight in kernel:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    grid[ny * w + nx] = max(0, min(255, grid[ny * w + nx] + err * weight))
    out = Image.new("1", (w, h))
    for y in range(h):
        for x in range(w):
            out.putpixel((x, y), 255 if grid[y * w + x] >= 128 else 0)
    return out


def dither_floyd_steinberg(gray):
    w, h = gray.size
    pixels = list(gray.getdata())
    grid = [float(p) for p in pixels]
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            old = grid[idx]
            new = 255.0 if old >= 128 else 0.0
            err = old - new
            grid[idx] = new
            if x + 1 < w:
                grid[idx + 1] = max(0, min(255, grid[idx + 1] + err * 7/16))
            if y + 1 < h:
                if x - 1 >= 0:
                    grid[(y+1)*w + x-1] = max(0, min(255, grid[(y+1)*w + x-1] + err * 3/16))
                grid[(y+1)*w + x] = max(0, min(255, grid[(y+1)*w + x] + err * 5/16))
                if x + 1 < w:
                    grid[(y+1)*w + x+1] = max(0, min(255, grid[(y+1)*w + x+1] + err * 1/16))
    out = Image.new("1", (w, h))
    for y in range(h):
        for x in range(w):
            out.putpixel((x, y), 255 if grid[y * w + x] >= 128 else 0)
    return out


def dither_stucki(gray):
    w, h = gray.size
    pixels = list(gray.getdata())
    grid = [float(p) for p in pixels]
    kernel = [
        (1,0,8/42),(2,0,4/42),
        (-2,1,2/42),(-1,1,4/42),(0,1,8/42),(1,1,4/42),(2,1,2/42),
        (-2,2,1/42),(-1,2,2/42),(0,2,4/42),(1,2,2/42),(2,2,1/42),
    ]
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            old = grid[idx]
            new = 255.0 if old >= 128 else 0.0
            err = old - new
            grid[idx] = new
            for dx, dy, weight in kernel:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    grid[ny * w + nx] = max(0, min(255, grid[ny * w + nx] + err * weight))
    out = Image.new("1", (w, h))
    for y in range(h):
        for x in range(w):
            out.putpixel((x, y), 255 if grid[y * w + x] >= 128 else 0)
    return out


def dither_bayer8(gray):
    BAYER8 = [
        [ 0,48,12,60, 3,51,15,63],
        [32,16,44,28,35,19,47,31],
        [ 8,56, 4,52,11,59, 7,55],
        [40,24,36,20,43,27,39,23],
        [ 2,50,14,62, 1,49,13,61],
        [34,18,46,30,33,17,45,29],
        [10,58, 6,54, 9,57, 5,53],
        [42,26,38,22,41,25,37,21],
    ]
    w, h = gray.size
    pixels = gray.load()
    out = Image.new("1", (w, h))
    out_pixels = out.load()
    for y in range(h):
        for x in range(w):
            threshold = (BAYER8[y % 8][x % 8] / 64.0) * 255
            out_pixels[x, y] = 255 if pixels[x, y] > threshold else 0
    return out


DITHER_MAP = {
    "atkinson": dither_atkinson,
    "bayer8": dither_bayer8,
    "floyd_steinberg": dither_floyd_steinberg,
    "stucki": dither_stucki,
}


def enhance_for_thermal(gray, contrast=1.4, brightness=1.05, sharpness=1.5):
    img = ImageEnhance.Contrast(gray).enhance(contrast)
    img = ImageEnhance.Brightness(img).enhance(brightness)
    img = ImageEnhance.Sharpness(img).enhance(sharpness)
    return img


FONT_CACHE_DIR = os.path.join(BASE_DIR, "font_cache")
os.makedirs(FONT_CACHE_DIR, exist_ok=True)


def download_google_font(font_family, bold=False):
    """Download a Google Font TTF file and cache it locally. Returns path or None."""
    import urllib.request
    import re

    weight = "700" if bold else "400"
    safe_name = font_family.replace(" ", "_").lower()
    cache_key = f"{safe_name}_{weight}.ttf"
    cached_path = os.path.join(FONT_CACHE_DIR, cache_key)

    # Return cached font if it exists
    if os.path.exists(cached_path):
        return cached_path

    try:
        # Fetch CSS from Google Fonts API (use a browser user-agent to get TTF format)
        css_url = f"https://fonts.googleapis.com/css2?family={font_family.replace(' ', '+')}:wght@{weight}&display=swap"
        req = urllib.request.Request(css_url, headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req, timeout=10) as response:
            css_text = response.read().decode("utf-8")

        # Extract TTF/WOFF2 URL from the CSS
        url_match = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)", css_text)
        if not url_match:
            # Try woff2 as fallback
            url_match = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css_text)
        if not url_match:
            logger.warning("Font: could not find URL for '%s' weight=%s", font_family, weight)
            return None

        font_url = url_match.group(1)
        req2 = urllib.request.Request(font_url, headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req2, timeout=15) as response:
            font_data = response.read()

        with open(cached_path, "wb") as f:
            f.write(font_data)

        logger.info("Font: downloaded and cached %s (weight=%s)", font_family, weight)
        return cached_path

    except Exception as e:
        logger.warning("Font: failed to download '%s': %s", font_family, e)
        return None


def get_font(size, bold=False, font_family=None):
    """Get a font for rendering. Tries Google Font first, falls back to system fonts."""
    # Try loading requested Google Font
    if font_family and font_family not in ("Inter", "sans-serif", ""):
        cached = download_google_font(font_family, bold=bold)
        if cached:
            try:
                return ImageFont.truetype(cached, size)
            except Exception:
                pass

    # Fall back to system fonts
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def generate_qr(data, box_size=5):
    import qrcode
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M,
                        box_size=box_size, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("1")


# ==============================
#  Image Helpers
# ==============================

def apply_rounded_corners(img, radius=20):
    """Apply rounded corners to an image. Works with both L and RGBA modes."""
    if img.mode == "1":
        img = img.convert("L")

    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (w-1, h-1)], radius=radius, fill=255)

    # Where mask is 0 (corners), set to white (255 = white on thermal)
    result = Image.new("L", (w, h), 255)
    result.paste(img, (0, 0), mask)
    return result


def get_aspect_ratio_float(ratio_str):
    """Convert aspect ratio string like '4:3' to float."""
    mapping = {
        "1:1": 1.0, "4:3": 4/3, "3:4": 3/4, "4:5": 4/5, "5:4": 5/4,
        "9:16": 9/16, "16:9": 16/9, "2:3": 2/3, "3:2": 3/2,
        "1:2": 0.5, "2:1": 2.0,
    }
    return mapping.get(ratio_str, None)


def create_logo_section(logo_path, width, header_height=64,
                        header_text="", header_text_size=12,
                        header_text_bold=False, header_text_font=None):
    """Create the logo section with optional header text below the logo."""
    logo_h = 0
    logo_img = None
    logo_w = 0

    if logo_path and os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("L")
        target_w = int(width * 0.5)
        lw, lh = logo.size
        ratio = min(target_w / lw, header_height / lh)
        logo_w = int(lw * ratio)
        logo_h = int(lh * ratio)
        logo_img = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
        logo_img = logo_img.point(lambda x: 255 if x > 128 else 0, mode="1")

    # Calculate text height if header_text is provided
    text_h = 0
    text_lines = []
    text_font = None
    if header_text:
        text_font = get_font(max(10, int(header_text_size * 1.4)), bold=header_text_bold,
                             font_family=header_text_font)
        # Word-wrap the header text
        dummy = Image.new("1", (width, 10), 255)
        draw_dummy = ImageDraw.Draw(dummy)
        current_line = ""
        for word in header_text.split():
            test = f"{current_line} {word}" if current_line else word
            bbox = draw_dummy.textbbox((0, 0), test, font=text_font)
            if bbox[2] - bbox[0] > width - 40:
                text_lines.append(current_line)
                current_line = word
            else:
                current_line = test
        if current_line:
            text_lines.append(current_line)
        text_h = len(text_lines) * (int(header_text_size * 1.4) + 4) + 6

    # Total section height
    total_h = max(logo_h + 10, header_height + 10) + text_h
    if not logo_img and not header_text:
        return Image.new("1", (width, 20), 255)

    # Use grayscale ("L") for drawing text (mode "1" renders text poorly)
    section = Image.new("L", (width, total_h), 255)

    # Paste logo (convert from 1-bit to L for pasting)
    if logo_img:
        logo_gray = logo_img.convert("L")
        section.paste(logo_gray, ((width - logo_w) // 2, (header_height - logo_h) // 2 + 5))

    # Draw header text below logo
    if header_text and text_font and text_lines:
        draw = ImageDraw.Draw(section)
        y = (header_height + 10) if logo_img else 5
        for line in text_lines:
            bbox = draw.textbbox((0, 0), line, font=text_font)
            tw = bbox[2] - bbox[0]
            draw.text(((width - tw) // 2, y), line, fill=0, font=text_font)
            y += bbox[3] - bbox[1] + 4
        logger.debug("Build: header text rendered (%s lines)", len(text_lines))

    # Convert back to 1-bit
    return section.point(lambda x: 255 if x > 128 else 0, mode="1")


def create_photo_section_single(photo_path, width, algorithm, aspect_ratio=None, rotation=0):
    """Create a single photo section with optional aspect ratio crop and rotation."""
    if not photo_path or not os.path.exists(photo_path):
        logger.warning("Build: no photo file at path=%s", photo_path)
        return Image.new("1", (width, 10), 255)

    photo = Image.open(photo_path).convert("L")

    # Apply rotation
    if rotation and rotation != 0:
        photo = photo.rotate(-rotation, expand=True, fillcolor=255)

    pw, ph = photo.size

    # Apply aspect ratio crop
    ar = get_aspect_ratio_float(aspect_ratio) if aspect_ratio else None
    if ar:
        current_ar = pw / ph
        if current_ar > ar:
            new_w = int(ph * ar)
            offset = (pw - new_w) // 2
            photo = photo.crop((offset, 0, offset + new_w, ph))
        elif current_ar < ar:
            new_h = int(pw / ar)
            offset = (ph - new_h) // 2
            photo = photo.crop((0, offset, pw, offset + new_h))
        pw, ph = photo.size

    # Scale to full paper width
    ratio = width / pw
    photo_height = int(ph * ratio)
    photo = photo.resize((width, photo_height), Image.Resampling.LANCZOS)

    # Enhance and dither
    photo = enhance_for_thermal(photo)
    dither_fn = DITHER_MAP.get(algorithm, dither_atkinson)
    photo_dithered = dither_fn(photo)

    # Apply rounded corners
    photo_gray = photo_dithered.convert("L")
    photo_rounded = apply_rounded_corners(photo_gray, radius=24)
    photo_1bit = photo_rounded.point(lambda x: 255 if x > 128 else 0, mode="1")

    section = Image.new("1", (width, photo_height + 10), 255)
    section.paste(photo_1bit, (0, 5))
    logger.debug("Build: single photo section %sx%s", width, photo_height)
    return section


def create_photo_section_grid(grid_photos, width, grid_layout, canvas_mode, algorithm, aspect_ratio=None):
    """Create a grid photo section from multiple images.

    grid_photos: list of dicts with {filename, x?, y?, w?, h?}
    grid_layout: layout key like '2-side', '4-grid', etc.
    canvas_mode: boolean, if True use freestyle positions from x/y/w/h
    """
    if not grid_photos:
        logger.debug("Build: no grid photos")
        return Image.new("1", (width, 10), 255)

    # Determine photo section height based on aspect ratio
    ar = get_aspect_ratio_float(aspect_ratio) if aspect_ratio else None
    if ar:
        photo_height = int(width / ar)
    else:
        photo_height = int(width * 5 / 4)  # default 4:5 ratio

    # Create the composite canvas (grayscale)
    canvas = Image.new("L", (width, photo_height), 255)

    # Layout definitions matching frontend grid-layouts.ts
    LAYOUTS = {
        # === 1 photo ===
        "1-full": [{"x": 0, "y": 0, "w": 100, "h": 100}],
        # === 2 photos ===
        "2-side": [
            {"x": 0, "y": 0, "w": 50, "h": 100},
            {"x": 50, "y": 0, "w": 50, "h": 100},
        ],
        "2-stack": [
            {"x": 0, "y": 0, "w": 100, "h": 50},
            {"x": 0, "y": 50, "w": 100, "h": 50},
        ],
        "2-big-small": [
            {"x": 0, "y": 0, "w": 65, "h": 100},
            {"x": 65, "y": 25, "w": 35, "h": 50},
        ],
        "2-diagonal": [
            {"x": 0, "y": 0, "w": 55, "h": 55},
            {"x": 45, "y": 45, "w": 55, "h": 55},
        ],
        # === 3 photos ===
        "3-left": [
            {"x": 0, "y": 0, "w": 60, "h": 100},
            {"x": 60, "y": 0, "w": 40, "h": 50},
            {"x": 60, "y": 50, "w": 40, "h": 50},
        ],
        "3-top": [
            {"x": 0, "y": 0, "w": 100, "h": 60},
            {"x": 0, "y": 60, "w": 50, "h": 40},
            {"x": 50, "y": 60, "w": 50, "h": 40},
        ],
        "3-cols": [
            {"x": 0, "y": 0, "w": 33.33, "h": 100},
            {"x": 33.33, "y": 0, "w": 33.33, "h": 100},
            {"x": 66.66, "y": 0, "w": 33.34, "h": 100},
        ],
        "3-right": [
            {"x": 0, "y": 0, "w": 40, "h": 50},
            {"x": 0, "y": 50, "w": 40, "h": 50},
            {"x": 40, "y": 0, "w": 60, "h": 100},
        ],
        "3-tshape": [
            {"x": 0, "y": 0, "w": 100, "h": 50},
            {"x": 25, "y": 50, "w": 50, "h": 50},
            {"x": 0, "y": 0, "w": 0, "h": 0},
        ],
        "3-strip": [
            {"x": 0, "y": 0, "w": 100, "h": 33.33},
            {"x": 0, "y": 33.33, "w": 100, "h": 33.33},
            {"x": 0, "y": 66.66, "w": 100, "h": 33.34},
        ],
        # === 4 photos ===
        "4-grid": [
            {"x": 0, "y": 0, "w": 50, "h": 50},
            {"x": 50, "y": 0, "w": 50, "h": 50},
            {"x": 0, "y": 50, "w": 50, "h": 50},
            {"x": 50, "y": 50, "w": 50, "h": 50},
        ],
        "4-left": [
            {"x": 0, "y": 0, "w": 60, "h": 100},
            {"x": 60, "y": 0, "w": 40, "h": 33.33},
            {"x": 60, "y": 33.33, "w": 40, "h": 33.33},
            {"x": 60, "y": 66.66, "w": 40, "h": 33.34},
        ],
        "4-top": [
            {"x": 0, "y": 0, "w": 100, "h": 60},
            {"x": 0, "y": 60, "w": 33.33, "h": 40},
            {"x": 33.33, "y": 60, "w": 33.33, "h": 40},
            {"x": 66.66, "y": 60, "w": 33.34, "h": 40},
        ],
        "4-strip": [
            {"x": 0, "y": 0, "w": 100, "h": 25},
            {"x": 0, "y": 25, "w": 100, "h": 25},
            {"x": 0, "y": 50, "w": 100, "h": 25},
            {"x": 0, "y": 75, "w": 100, "h": 25},
        ],
        "4-diamond": [
            {"x": 25, "y": 0, "w": 50, "h": 50},
            {"x": 0, "y": 25, "w": 50, "h": 50},
            {"x": 50, "y": 25, "w": 50, "h": 50},
            {"x": 25, "y": 50, "w": 50, "h": 50},
        ],
        "4-masonry": [
            {"x": 0, "y": 0, "w": 50, "h": 60},
            {"x": 50, "y": 0, "w": 50, "h": 40},
            {"x": 0, "y": 60, "w": 50, "h": 40},
            {"x": 50, "y": 40, "w": 50, "h": 60},
        ],
        # === 5 photos ===
        "5-left": [
            {"x": 0, "y": 0, "w": 60, "h": 50},
            {"x": 60, "y": 0, "w": 40, "h": 50},
            {"x": 0, "y": 50, "w": 33.33, "h": 50},
            {"x": 33.33, "y": 50, "w": 33.33, "h": 50},
            {"x": 66.66, "y": 50, "w": 33.34, "h": 50},
        ],
        "5-grid": [
            {"x": 0, "y": 0, "w": 50, "h": 50},
            {"x": 50, "y": 0, "w": 50, "h": 50},
            {"x": 0, "y": 50, "w": 33.33, "h": 50},
            {"x": 33.33, "y": 50, "w": 33.33, "h": 50},
            {"x": 66.66, "y": 50, "w": 33.34, "h": 50},
        ],
        "5-cross": [
            {"x": 25, "y": 0, "w": 50, "h": 33.33},
            {"x": 0, "y": 33.33, "w": 33.33, "h": 33.33},
            {"x": 33.33, "y": 33.33, "w": 33.33, "h": 33.33},
            {"x": 66.66, "y": 33.33, "w": 33.34, "h": 33.33},
            {"x": 25, "y": 66.66, "w": 50, "h": 33.34},
        ],
        "5-magazine": [
            {"x": 0, "y": 0, "w": 100, "h": 50},
            {"x": 0, "y": 50, "w": 25, "h": 50},
            {"x": 25, "y": 50, "w": 25, "h": 50},
            {"x": 50, "y": 50, "w": 25, "h": 50},
            {"x": 75, "y": 50, "w": 25, "h": 50},
        ],
        # === 6 photos ===
        "6-grid": [
            {"x": 0, "y": 0, "w": 33.33, "h": 50},
            {"x": 33.33, "y": 0, "w": 33.33, "h": 50},
            {"x": 66.66, "y": 0, "w": 33.34, "h": 50},
            {"x": 0, "y": 50, "w": 33.33, "h": 50},
            {"x": 33.33, "y": 50, "w": 33.33, "h": 50},
            {"x": 66.66, "y": 50, "w": 33.34, "h": 50},
        ],
        "6-mosaic": [
            {"x": 0, "y": 0, "w": 66.66, "h": 50},
            {"x": 66.66, "y": 0, "w": 33.34, "h": 25},
            {"x": 66.66, "y": 25, "w": 33.34, "h": 25},
            {"x": 0, "y": 50, "w": 33.33, "h": 25},
            {"x": 0, "y": 75, "w": 33.33, "h": 25},
            {"x": 33.33, "y": 50, "w": 66.67, "h": 50},
        ],
        "6-magazine": [
            {"x": 0, "y": 0, "w": 50, "h": 66.66},
            {"x": 50, "y": 0, "w": 50, "h": 33.33},
            {"x": 50, "y": 33.33, "w": 50, "h": 33.33},
            {"x": 0, "y": 66.66, "w": 33.33, "h": 33.34},
            {"x": 33.33, "y": 66.66, "w": 33.33, "h": 33.34},
            {"x": 66.66, "y": 66.66, "w": 33.34, "h": 33.34},
        ],
        "6-strip": [
            {"x": 0, "y": 0, "w": 50, "h": 33.33},
            {"x": 50, "y": 0, "w": 50, "h": 33.33},
            {"x": 0, "y": 33.33, "w": 50, "h": 33.33},
            {"x": 50, "y": 33.33, "w": 50, "h": 33.33},
            {"x": 0, "y": 66.66, "w": 50, "h": 33.34},
            {"x": 50, "y": 66.66, "w": 50, "h": 33.34},
        ],
    }

    gap = 4  # pixel gap between images

    for i, gp in enumerate(grid_photos):
        # Handle both dict and string formats
        if isinstance(gp, str):
            gp = {"filename": gp}
        filename = gp.get("filename", "")

        photo_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(photo_path):
            logger.warning("Grid: photo not found %s", photo_path)
            continue

        img = Image.open(photo_path).convert("L")

        if canvas_mode:
            # Freestyle mode: use x, y, w, h percentages
            cx = gp.get("x", 10) or 10
            cy = gp.get("y", 10) or 10
            cw = gp.get("w", 55) or 55
            ch = gp.get("h", 55) or 55

            px_x = int(cx / 100 * width)
            px_y = int(cy / 100 * photo_height)
            px_w = int(cw / 100 * width)
            px_h = int(ch / 100 * photo_height)
        else:
            # Layout mode
            layout_cells = LAYOUTS.get(grid_layout, LAYOUTS.get("1-full"))
            if i >= len(layout_cells):
                continue
            cell = layout_cells[i]
            px_x = int(cell["x"] / 100 * width) + gap
            px_y = int(cell["y"] / 100 * photo_height) + gap
            px_w = int(cell["w"] / 100 * width) - gap * 2
            px_h = int(cell["h"] / 100 * photo_height) - gap * 2

        if px_w <= 0 or px_h <= 0:
            continue

        # Resize image to fill the cell (cover mode)
        iw, ih = img.size
        scale = max(px_w / iw, px_h / ih)
        new_w = int(iw * scale)
        new_h = int(ih * scale)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Center crop to cell size
        left = (new_w - px_w) // 2
        top = (new_h - px_h) // 2
        img = img.crop((left, top, left + px_w, top + px_h))

        # Paste into canvas
        paste_x = max(0, min(px_x, width - px_w))
        paste_y = max(0, min(px_y, photo_height - px_h))
        canvas.paste(img, (paste_x, paste_y))
        logger.debug("Grid: photo %s (%s,%s) %sx%s", i, px_x, px_y, px_w, px_h)

    # Enhance and dither the composite
    canvas = enhance_for_thermal(canvas)
    dither_fn = DITHER_MAP.get(algorithm, dither_atkinson)
    canvas_dithered = dither_fn(canvas)

    # Apply rounded corners
    canvas_gray = canvas_dithered.convert("L")
    canvas_rounded = apply_rounded_corners(canvas_gray, radius=24)
    canvas_1bit = canvas_rounded.point(lambda x: 255 if x > 128 else 0, mode="1")

    section = Image.new("1", (width, photo_height + 10), 255)
    section.paste(canvas_1bit, (0, 5))
    logger.debug("Build: grid section %sx%s (%s photos)", width, photo_height, len(grid_photos))
    return section


def composite_stickers(receipt, stickers, width):
    """Composite sticker images onto the receipt.

    stickers: list of {filename, x, y, width, height} where positions are percentages
    receipt: PIL Image (mode "1" or "L")
    """
    if not stickers:
        return receipt

    receipt_w, receipt_h = receipt.size
    result = receipt.convert("L")

    for sticker_data in stickers:
        filename = sticker_data.get("filename", "")
        sx = sticker_data.get("x", 0) / 100 * receipt_w
        sy = sticker_data.get("y", 0) / 100 * receipt_h
        sw = sticker_data.get("width", 10) / 100 * receipt_w
        sh = sticker_data.get("height", 10) / 100 * receipt_h

        # Look for sticker in stickers dir, then uploads dir
        sticker_path = os.path.join(STICKER_DIR, filename)
        if not os.path.exists(sticker_path):
            sticker_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(sticker_path):
            logger.warning("Sticker: not found %s", filename)
            continue

        try:
            sticker_img = Image.open(sticker_path)

            # If sticker has alpha channel, use it as mask
            if sticker_img.mode in ("RGBA", "LA", "PA"):
                sticker_rgba = sticker_img.convert("RGBA")
                sticker_resized = sticker_rgba.resize((max(1, int(sw)), max(1, int(sh))), Image.Resampling.LANCZOS)

                # Convert sticker to grayscale for thermal
                sticker_gray = sticker_resized.convert("L")

                # Extract and threshold alpha mask
                alpha = sticker_resized.split()[3]
                alpha_mask = alpha.point(lambda p: 255 if p > 128 else 0, mode="L")

                paste_x = max(0, int(sx))
                paste_y = max(0, int(sy))
                result.paste(sticker_gray, (paste_x, paste_y), alpha_mask)
            else:
                sticker_gray = sticker_img.convert("L")
                sticker_resized = sticker_gray.resize((max(1, int(sw)), max(1, int(sh))), Image.Resampling.LANCZOS)
                paste_x = max(0, int(sx))
                paste_y = max(0, int(sy))
                result.paste(sticker_resized, (paste_x, paste_y))

            logger.debug("Sticker: composited %s", filename)
        except Exception as e:
            logger.warning("Sticker: error compositing %s: %s", filename, e)
            continue

    return result.point(lambda x: 255 if x > 128 else 0, mode="1")


def create_memo_section(memo_text, width, font_size=20, bold=False, font_family=None):
    font = get_font(font_size, bold=bold, font_family=font_family)
    section_h = max(60, font_size * 5)
    section = Image.new("1", (width, section_h), 255)
    draw = ImageDraw.Draw(section)
    quoted = f'"{memo_text}"'
    lines, current = [], ""
    for word in quoted.split():
        test = f"{current} {word}" if current else word
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] > width - 60:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    y = 8
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        draw.text(((width - tw) // 2, y), line, fill=0, font=font)
        y += bbox[3] - bbox[1] + 4
    return section.crop((0, 0, width, min(y + 10, section_h)))


def create_stamp_section(stamp_text, width):
    font = get_font(12)
    section = Image.new("1", (width, 25), 255)
    draw = ImageDraw.Draw(section)
    bbox = draw.textbbox((0, 0), stamp_text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((width - tw) // 2, 5), stamp_text, fill=0, font=font)
    return section


def create_separator(width):
    section = Image.new("1", (width, 15), 255)
    draw = ImageDraw.Draw(section)
    for x in range(20, width - 20, 6):
        draw.point((x, 7), fill=0)
        draw.point((x + 1, 7), fill=0)
    return section


def build_receipt_from_params(params):
    """Build receipt from dashboard parameters.
    Supports: single photo, grid photos (layout + freestyle), stickers, rounded corners.
    """
    photo_filename = params.get("photo", "")
    grid_photos = params.get("grid_photos", [])
    grid_layout = params.get("grid_layout", "2-side")
    grid_canvas_mode = params.get("grid_canvas_mode", False)
    memo = params.get("memo", "")
    qr_url = params.get("qr_url", "https://archivio.app")
    algorithm = params.get("algorithm", "atkinson")
    logo_filename = params.get("logo", "")
    header_height = int(params.get("header_height", 64))
    section_order = params.get("section_order", ["logo", "photo", "memo", "qr", "stamp"])
    stamp_text = params.get("stamp_text", "")
    memo_font_size = int(params.get("memo_font_size", 14))
    stickers = params.get("stickers", [])
    photo_aspect_ratio = params.get("photo_aspect_ratio", "free")
    photo_rotation = int(params.get("photo_rotation", 0))
    width = WIDTH

    logger.debug("Build: photo=%s grid_photos=%s logo=%s", photo_filename, len(grid_photos), logo_filename)

    # Resolve paths
    logo_path = os.path.join(UPLOAD_DIR, logo_filename) if logo_filename else None
    if logo_path and not os.path.exists(logo_path):
        logger.warning("Build: logo not found %s", logo_path)
        logo_path = None

    photo_path = os.path.join(UPLOAD_DIR, photo_filename) if photo_filename else None
    if photo_path and not os.path.exists(photo_path):
        logger.warning("Build: photo not found %s", photo_path)
        photo_path = None

    sep = create_separator(width)

    # Build sections dict
    section_images = {}

    # Header text params (coerce to int so JSON floats from dashboard don't break PIL/range)
    header_text = params.get("header_text", "")
    header_text_size = int(params.get("header_text_size", 12))
    header_text_bold = params.get("header_text_bold", False)
    header_text_font = params.get("header_text_font", "")

    # Logo (with optional header text below)
    section_images["logo"] = create_logo_section(
        logo_path, width, header_height,
        header_text=header_text,
        header_text_size=header_text_size,
        header_text_bold=header_text_bold,
        header_text_font=header_text_font,
    )

    # Photo section — single or grid
    if grid_photos and len(grid_photos) > 0:
        section_images["photo"] = create_photo_section_grid(
            grid_photos, width, grid_layout, grid_canvas_mode, algorithm, photo_aspect_ratio
        )
    elif photo_path:
        section_images["photo"] = create_photo_section_single(
            photo_path, width, algorithm, photo_aspect_ratio, photo_rotation
        )
    else:
        section_images["photo"] = Image.new("1", (width, 10), 255)
        logger.warning("Build: no photo")

    # Memo
    memo_bold = params.get("memo_bold", False)
    memo_font = params.get("memo_font", "")
    if memo:
        print_font_size = max(12, int(memo_font_size * 1.4))
        section_images["memo"] = create_memo_section(
            memo, width, print_font_size, bold=memo_bold, font_family=memo_font
        )
    else:
        section_images["memo"] = Image.new("1", (width, 5), 255)

    # QR
    qr = generate_qr(qr_url, box_size=5)
    qr_w, qr_h = qr.size
    qr_section = Image.new("1", (width, qr_h + 30), 255)
    qr_section.paste(qr, ((width - qr_w) // 2, 10))
    draw_qr = ImageDraw.Draw(qr_section)
    scan_font = get_font(14)
    scan_text = "scan for your digital copy"
    bbox = draw_qr.textbbox((0, 0), scan_text, font=scan_font)
    draw_qr.text(((width - (bbox[2] - bbox[0])) // 2, qr_h + 12), scan_text, fill=0, font=scan_font)
    section_images["qr"] = qr_section

    # Stamp
    if stamp_text:
        section_images["stamp"] = create_stamp_section(stamp_text, width)
    else:
        section_images["stamp"] = Image.new("1", (width, 1), 255)

    # Compose in section_order
    parts = []
    for section_id in section_order:
        img = section_images.get(section_id)
        if img and img.size[1] > 1:
            parts.append(img)
            parts.append(sep.copy())

    # Bottom padding
    parts.append(Image.new("1", (width, 20), 255))

    total_h = sum(p.size[1] for p in parts)
    receipt = Image.new("1", (width, total_h), 255)
    y = 0
    for p in parts:
        receipt.paste(p, (0, y))
        y += p.size[1]

    # Composite stickers on top of the full receipt
    if stickers:
        receipt = composite_stickers(receipt, stickers, width)

    return receipt


def _raw_device_path():
    """First existing raw device from env, then common paths, then any /dev/usb/lp*."""
    if LP_DEVICE and os.path.exists(LP_DEVICE):
        return LP_DEVICE
    for path in ["/dev/usb/lp0", "/dev/usb/lp1", "/dev/usb/lp2"]:
        if os.path.exists(path):
            return path
    try:
        import glob
        for path in sorted(glob.glob("/dev/usb/lp*")):
            if os.path.exists(path):
                return path
    except Exception:
        pass
    return None


def _print_via_cups(receipt):
    """Print via lp (CUPS). Returns (success, message)."""
    import tempfile
    path = _raw_device_path()
    if path:
        return False, "Use raw device"
    try:
        r = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            return False, "lpstat failed (no CUPS?)"
        out = (r.stdout or "") + (r.stderr or "")
        if "unknown" in out.lower() or not out.strip():
            return False, "No CUPS printers found"
    except FileNotFoundError:
        return False, "lp not available"
    except subprocess.TimeoutExpired:
        return False, "lpstat timeout"

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        receipt.save(f.name)
        tmp = f.name
    try:
        cmd = ["lp", "-o", "fit-to-page", "-o", "scaling=100"]
        if CUPS_PRINTER:
            cmd.extend(["-d", CUPS_PRINTER])
        cmd.append(tmp)
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            return False, (r.stderr or r.stdout or "lp failed").strip()
        return True, "Printed via CUPS"
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def do_print(receipt):
    """Send a receipt image to the thermal printer (raw device or CUPS)."""
    path = _raw_device_path()
    if path:
        fd = os.open(path, os.O_WRONLY | os.O_NONBLOCK)
        try:
            write_wait(fd, b"\x1b\x40")
            time.sleep(0.3)
            raster = image_to_single_raster(receipt)
            write_wait(fd, raster, timeout_s=240)
            time.sleep(1)
            write_wait(fd, b"\x0a\x0a\x0a")
            time.sleep(0.3)
            write_wait(fd, b"\x1d\x56\x00")
            time.sleep(0.5)
            return True, "Printed successfully"
        except Exception as e:
            return False, str(e)
        finally:
            os.close(fd)
    return _print_via_cups(receipt)


# ==============================
#  Camera
# ==============================

def check_camera():
    """Return True if Pi camera is available. On failure, returns False and logs a clear reason."""
    try:
        from picamera2 import Picamera2
        cams = Picamera2.global_camera_info()
        if len(cams) == 0:
            return False
        return True
    except ImportError as e:
        logger.info("Pi camera: picamera2 not installed or not available (Pi only). %s", e)
        return False
    except Exception as e:
        logger.warning("Pi camera detection failed: %s", e)
        return False


def capture_from_camera():
    from picamera2 import Picamera2
    cam = Picamera2()
    config = cam.create_still_configuration()
    cam.configure(config)
    cam.start()
    time.sleep(2)
    filename = f"capture_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    cam.capture_file(filepath)
    cam.stop()
    cam.close()
    return filename


# ==============================
#  Printer status (beyond device exists)
# ==============================

def check_printer_ready():
    """True if raw device exists or CUPS has an enabled printer."""
    path = _raw_device_path()
    if path:
        try:
            r = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=5)
            if r.returncode != 0:
                return True
            out = (r.stdout or "") + (r.stderr or "")
            if "is idle" in out or "now printing" in out or "enabled" in out:
                return True
            if "disabled" in out or "out of paper" in out.lower():
                return False
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return True
    try:
        r = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            return False
        out = (r.stdout or "") + (r.stderr or "")
        if "disabled" in out or "out of paper" in out.lower():
            return False
        if "is idle" in out or "now printing" in out or "enabled" in out:
            return True
        return bool(out.strip())
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


# ==============================
#  API Routes
# ==============================

@app.route("/api/health")
def health():
    printer_device = _raw_device_path() is not None
    if not printer_device:
        try:
            r = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=5)
            printer_device = r.returncode == 0 and bool((r.stdout or "").strip())
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    printer_ready = check_printer_ready()
    camera_ok = check_camera()
    return jsonify({
        "status": "ok",
        "camera": camera_ok,
        "printer": printer_device,
        "printer_ready": printer_ready,
    })


@app.route("/api/upload/logo", methods=["POST"])
def upload_logo():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    ext = os.path.splitext(f.filename or "logo.png")[1].lower() or ".png"
    filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    f.save(filepath)
    return jsonify({"url": f"/api/images/{filename}", "filename": filename})


@app.route("/api/upload/photo", methods=["POST"])
def upload_photo():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    ext = os.path.splitext(f.filename or "photo.jpg")[1].lower() or ".jpg"
    filename = f"photo_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    f.save(filepath)
    return jsonify({"url": f"/api/images/{filename}", "filename": filename})


@app.route("/api/upload/sticker", methods=["POST"])
def upload_sticker():
    """Upload a sticker image (PNG/SVG/WebP with transparency)."""
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    ext = os.path.splitext(f.filename or "sticker.png")[1].lower() or ".png"
    filename = f"sticker_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(STICKER_DIR, filename)
    f.save(filepath)
    return jsonify({"url": f"/api/stickers/{filename}", "filename": filename})


@app.route("/api/camera/status")
def camera_status():
    available = check_camera()
    if available:
        return jsonify({"available": True, "info": "Pi Camera"})
    # Helpful message for dashboard
    try:
        from picamera2 import Picamera2
        return jsonify({"available": False, "info": "No Pi camera detected (check connection)"})
    except ImportError:
        return jsonify({"available": False, "info": "picamera2 not installed (install on Pi: pip install picamera2)"})


@app.route("/api/camera/capture", methods=["POST"])
def camera_capture():
    if not check_camera():
        return jsonify({"error": "No camera available"}), 503
    try:
        filename = capture_from_camera()
        return jsonify({"url": f"/api/images/{filename}", "filename": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Print Queue endpoints ---

@app.route("/api/print/queue", methods=["POST"])
def enqueue_print():
    """Add a print job to the queue. Returns immediately."""
    data = request.get_json() or {}
    if not data:
        return jsonify({"error": "Empty or invalid JSON body"}), 400
    job_id = data.get("job_id", f"job_{uuid.uuid4().hex[:8]}")

    with jobs_lock:
        print_jobs[job_id] = {"status": "pending", "message": "Queued", "params": data}

    print_queue.put((job_id, data))
    logger.info("Queue: job %s enqueued (%s in queue)", job_id, print_queue.qsize())
    return jsonify({"job_id": job_id, "status": "pending"})


@app.route("/api/print/status/<job_id>")
def get_print_status(job_id):
    with jobs_lock:
        job = print_jobs.get(job_id)
    if not job:
        return jsonify({"status": "unknown", "message": "Job not found"}), 404
    return jsonify({"status": job["status"], "message": job["message"]})


@app.route("/api/print/queue", methods=["GET"])
def list_print_queue():
    with jobs_lock:
        jobs = [{"id": k, "status": v["status"], "message": v["message"]}
                for k, v in print_jobs.items()]
    return jsonify({"jobs": jobs})


@app.route("/api/print/queue/<job_id>", methods=["DELETE"])
def delete_print_job(job_id):
    """Cancel/remove a print job."""
    with jobs_lock:
        if job_id in print_jobs:
            if print_jobs[job_id]["status"] == "printing":
                return jsonify({"error": "Cannot cancel a job that is currently printing"}), 409
            del print_jobs[job_id]
            return jsonify({"status": "removed"})
    return jsonify({"error": "Job not found"}), 404


# --- WYSIWYG image print (canvas export) ---

@app.route("/api/print/image", methods=["POST"])
def print_image_direct():
    """Receive a ready-to-print PNG image from the dashboard canvas and print it.
    The dashboard exports the Konva canvas at 576px width (matching thermal printer).
    Supports optional form fields: algorithm, contrast, brightness for dithering.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400

    job_id = request.form.get("job_id", f"job_{uuid.uuid4().hex[:8]}")
    algorithm = request.form.get("algorithm", "atkinson")
    contrast = float(request.form.get("contrast", 1.4))
    brightness = float(request.form.get("brightness", 1.05))

    try:
        img = Image.open(request.files["file"]).convert("L")

        # Ensure width matches printer
        if img.width != WIDTH:
            ratio = WIDTH / img.width
            img = img.resize((WIDTH, int(img.height * ratio)), Image.Resampling.LANCZOS)

        # Apply enhancement (contrast, brightness, sharpness) for thermal printing
        img = enhance_for_thermal(img, contrast=contrast, brightness=brightness)

        # Apply selected dithering algorithm
        dither_fn = DITHER_MAP.get(algorithm, dither_atkinson)
        img_1bit = dither_fn(img)

        logger.debug("Print/Image: algo=%s contrast=%s brightness=%s", algorithm, contrast, brightness)
        img_1bit.save(os.path.join(PREVIEW_DIR, "last_receipt.png"))

        # Enqueue for async printing
        with jobs_lock:
            print_jobs[job_id] = {"status": "pending", "message": "Queued (image)", "params": {}, "_image": img_1bit}

        # Put in queue — worker will check for _image key
        print_queue.put((job_id, {"_image_print": True}))
        logger.info("Queue: image job %s enqueued", job_id)
        return jsonify({"job_id": job_id, "status": "pending"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/print/test", methods=["POST", "GET"])
def print_test():
    """Print a simple test page (text + line) to verify printer is working."""
    try:
        img = Image.new("L", (WIDTH, 200), 255)
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        except OSError:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
            except OSError:
                font = ImageFont.load_default()
        draw.text((20, 20), "Archivio Test Print", fill=0, font=font)
        draw.text((20, 60), "If you see this, the printer is working.", fill=0, font=font)
        draw.line([(20, 120), (WIDTH - 20, 120)], fill=0, width=2)
        draw.text((20, 140), "Time: %s" % time.strftime("%Y-%m-%d %H:%M:%S"), fill=0, font=font)
        receipt = dither_atkinson(img)
        ok, msg = do_print(receipt)
        return jsonify({"success": ok, "message": msg})
    except Exception as e:
        logger.exception("Test print failed")
        return jsonify({"success": False, "message": str(e)}), 500


# Keep old /api/print for backwards compat
@app.route("/api/print", methods=["POST"])
def print_receipt_sync():
    data = request.get_json() or {}
    try:
        receipt = build_receipt_from_params(data)
        receipt.save(os.path.join(PREVIEW_DIR, "last_receipt.png"))
        ok, msg = do_print(receipt)
        return jsonify({"success": ok, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/images/<filename>")
def serve_image(filename):
    if os.path.exists(os.path.join(UPLOAD_DIR, filename)):
        return send_from_directory(UPLOAD_DIR, filename)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/previews/<filename>")
def serve_preview(filename):
    if os.path.exists(os.path.join(PREVIEW_DIR, filename)):
        return send_from_directory(PREVIEW_DIR, filename)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/stickers/<filename>")
def serve_sticker(filename):
    if os.path.exists(os.path.join(STICKER_DIR, filename)):
        return send_from_directory(STICKER_DIR, filename)
    return jsonify({"error": "Not found"}), 404


# ==============================
#  Template CRUD
# ==============================

@app.route("/api/templates", methods=["POST"])
def create_template():
    """Save a new template. Body: {name, state (JSON string), thumbnail? (filename)}."""
    data = request.get_json() or {}
    name = data.get("name", "Untitled")
    state = data.get("state", "{}")
    thumbnail = data.get("thumbnail", "")
    tid = f"tpl_{uuid.uuid4().hex[:8]}"
    conn = get_db()
    conn.execute(
        "INSERT INTO templates (id, name, thumbnail, state) VALUES (?, ?, ?, ?)",
        (tid, name, thumbnail, state if isinstance(state, str) else json.dumps(state)),
    )
    conn.commit()
    conn.close()
    return jsonify({"id": tid})


@app.route("/api/templates", methods=["GET"])
def list_templates():
    conn = get_db()
    rows = conn.execute("SELECT id, name, thumbnail, created_at, updated_at FROM templates ORDER BY updated_at DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/templates/<tid>", methods=["GET"])
def get_template(tid):
    conn = get_db()
    row = conn.execute("SELECT * FROM templates WHERE id = ?", (tid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Not found"}), 404
    return jsonify(dict(row))


@app.route("/api/templates/<tid>", methods=["PUT"])
def update_template(tid):
    data = request.get_json() or {}
    conn = get_db()
    row = conn.execute("SELECT id FROM templates WHERE id = ?", (tid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    sets = []
    vals = []
    if "name" in data:
        sets.append("name = ?")
        vals.append(data["name"])
    if "state" in data:
        sets.append("state = ?")
        s = data["state"]
        vals.append(s if isinstance(s, str) else json.dumps(s))
    if "thumbnail" in data:
        sets.append("thumbnail = ?")
        vals.append(data["thumbnail"])
    sets.append("updated_at = datetime('now')")
    vals.append(tid)
    conn.execute(f"UPDATE templates SET {', '.join(sets)} WHERE id = ?", vals)
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})


@app.route("/api/templates/<tid>", methods=["DELETE"])
def delete_template(tid):
    conn = get_db()
    conn.execute("DELETE FROM templates WHERE id = ?", (tid,))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})


# ==============================
#  Cafe Config
# ==============================

@app.route("/api/config", methods=["GET"])
def get_config():
    conn = get_db()
    row = conn.execute("SELECT config, updated_at FROM cafe_config WHERE id = 1").fetchone()
    conn.close()
    if not row:
        return jsonify({})
    try:
        data = json.loads(row["config"])
    except Exception:
        data = {}
    data["_updatedAt"] = row["updated_at"]
    return jsonify(data)


@app.route("/api/config", methods=["PUT"])
def put_config():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400
    data.pop("_updatedAt", None)
    conn = get_db()
    conn.execute(
        "UPDATE cafe_config SET config = ?, updated_at = datetime('now') WHERE id = 1",
        (json.dumps(data),),
    )
    conn.commit()
    conn.close()
    logger.info("Cafe config updated")
    return jsonify({"status": "ok"})


# ==============================
#  Gallery CRUD
# ==============================

GALLERY_DIR = os.path.join(BASE_DIR, "gallery")
os.makedirs(GALLERY_DIR, exist_ok=True)


@app.route("/api/gallery", methods=["POST"])
def save_to_gallery():
    """Save an image to the gallery. Expects multipart form with 'file', optional 'type' and 'template_id'."""
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    img_type = request.form.get("type", "print")
    template_id = request.form.get("template_id", "")
    ext = os.path.splitext(f.filename or "image.png")[1].lower() or ".png"
    filename = f"gallery_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(GALLERY_DIR, filename)
    f.save(filepath)
    gid = f"gal_{uuid.uuid4().hex[:8]}"
    conn = get_db()
    conn.execute(
        "INSERT INTO gallery (id, filename, type, template_id) VALUES (?, ?, ?, ?)",
        (gid, filename, img_type, template_id or None),
    )
    conn.commit()
    conn.close()
    return jsonify({"id": gid, "filename": filename})


@app.route("/api/gallery", methods=["GET"])
def list_gallery():
    conn = get_db()
    img_type = request.args.get("type")
    if img_type:
        rows = conn.execute(
            "SELECT * FROM gallery WHERE type = ? ORDER BY created_at DESC", (img_type,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM gallery ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/gallery/<gid>", methods=["DELETE"])
def delete_gallery_item(gid):
    conn = get_db()
    row = conn.execute("SELECT filename FROM gallery WHERE id = ?", (gid,)).fetchone()
    if row:
        filepath = os.path.join(GALLERY_DIR, row["filename"])
        if os.path.exists(filepath):
            os.remove(filepath)
    conn.execute("DELETE FROM gallery WHERE id = ?", (gid,))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})


@app.route("/api/gallery/images/<filename>")
def serve_gallery_image(filename):
    if os.path.exists(os.path.join(GALLERY_DIR, filename)):
        return send_from_directory(GALLERY_DIR, filename)
    return jsonify({"error": "Not found"}), 404


# ==============================
#  Admin: file cleanup & DB backup
# ==============================

def cleanup_old_files(days=30):
    """Delete files in uploads, previews, stickers older than `days`. Returns (deleted_count, errors)."""
    import glob
    now = time.time()
    cutoff = now - (days * 24 * 3600)
    deleted = 0
    errors = []
    for directory in (UPLOAD_DIR, PREVIEW_DIR, STICKER_DIR):
        if not os.path.isdir(directory):
            continue
        for path in glob.glob(os.path.join(directory, "*")):
            try:
                if os.path.isfile(path) and os.path.getmtime(path) < cutoff:
                    os.remove(path)
                    deleted += 1
            except OSError as e:
                errors.append(f"{path}: {e}")
    return deleted, errors


@app.route("/api/admin/cleanup")
def admin_cleanup():
    """Delete upload/preview/sticker files older than ?days=30."""
    days = min(365, max(1, int(request.args.get("days", 30))))
    deleted, errors = cleanup_old_files(days)
    if errors:
        logger.warning("Cleanup: %s errors: %s", len(errors), errors[:3])
    logger.info("Cleanup: removed %s files older than %s days", deleted, days)
    return jsonify({"deleted": deleted, "days": days, "errors": errors[:10]})


def backup_db():
    """Copy DB to .backup and optionally run WAL checkpoint. Returns path or None."""
    import shutil
    backup_path = DB_PATH + ".backup"
    try:
        conn = get_db()
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.close()
        shutil.copy2(DB_PATH, backup_path)
        return backup_path
    except Exception as e:
        logger.warning("DB backup failed: %s", e)
        return None


@app.route("/api/admin/backup")
def admin_backup():
    """Create a backup copy of the database."""
    path = backup_db()
    if path:
        logger.info("DB backup created: %s", path)
        return jsonify({"status": "ok", "path": path})
    return jsonify({"error": "Backup failed"}), 500


# ==============================
#  Upload thumbnail (for templates)
# ==============================

@app.route("/api/upload/thumbnail", methods=["POST"])
def upload_thumbnail():
    """Upload a template thumbnail image."""
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    filename = f"thumb_{uuid.uuid4().hex[:8]}.png"
    filepath = os.path.join(PREVIEW_DIR, filename)
    f.save(filepath)
    return jsonify({"filename": filename})


if __name__ == "__main__":
    logger.info("ARCHIVIO Photo Booth Server v2.1")
    logger.info("Uploads: %s | Stickers: %s", UPLOAD_DIR, STICKER_DIR)
    raw = _raw_device_path()
    if raw:
        logger.info("Printer: %s (raw device)", raw)
    else:
        try:
            r = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=5)
            if r.returncode == 0 and (r.stdout or "").strip():
                logger.info("Printer: CUPS (lp)")
            else:
                logger.info("Printer: no raw device or CUPS")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            logger.info("Printer: no raw device, CUPS not available")
    logger.info("Camera: %s", "detected" if check_camera() else "not detected")
    logger.info("Print queue: background worker started")
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
