#!/usr/bin/env python3
"""
Choice Properties -- ImageKit Upload Module (WebP Optimized + Multi-Account Pool)
================================================================================
Uploads scraped property images to ImageKit CDN with:
  1. Ultra-high efficiency WebP compression (~95% byte reduction to save quota)
  2. Multi-account failover pool (auto-switches to backup account if primary hits limits)
  3. Image verification & ordered gallery preservation
  4. Resilient retry logic with exponential backoff

Supported Environment Variables:
  IMAGEKIT_PRIVATE_KEY       -- Primary ImageKit private API key
  IMAGEKIT_URL_ENDPOINT      -- Primary endpoint (e.g. https://ik.imagekit.io/21rg7lvzo)
  IMAGEKIT_PRIVATE_KEY_2     -- Secondary backup private key (optional)
  IMAGEKIT_URL_ENDPOINT_2    -- Secondary backup endpoint (optional)
  IMAGEKIT_PRIVATE_KEY_3     -- Tertiary backup private key (optional)
  IMAGEKIT_URL_ENDPOINT_3    -- Tertiary backup endpoint (optional)
"""

import os
import re
import io
import time
import base64
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from PIL import Image as _PIL_Image
    _PIL_OK = True
except ImportError:
    _PIL_OK = False

try:
    import requests as _req
    _REQUESTS_OK = True
except ImportError:
    _REQUESTS_OK = False

# -- Constants -----------------------------------------------------------------

IMAGEKIT_UPLOAD_URL  = "https://upload.imagekit.io/api/v1/files/upload"
VERIFY_TIMEOUT       = 10    # seconds for HEAD check per URL
UPLOAD_TIMEOUT       = 45    # seconds per upload request
DOWNLOAD_TIMEOUT     = 25    # seconds per image download
MAX_UPLOAD_RETRIES   = 3     # retry count per image
RETRY_BACKOFF        = 2.0   # base seconds between retries
MAX_WORKERS          = 4     # concurrent upload threads
MAX_IMAGE_BYTES      = 20 * 1024 * 1024  # 20 MB hard cap per image
TARGET_IMAGE_MAX_DIM = 1400  # max width/height in px for optimal clarity vs weight
TARGET_WEBP_QUALITY  = 80    # visually lossless WebP quality

logger = logging.getLogger("imagekit_upload")


# -- Multi-Account Pool Helpers ------------------------------------------------

def get_account_pool():
    """Return all configured ImageKit accounts in order of priority."""
    pool = []
    
    # 1. Primary
    k1 = os.environ.get("IMAGEKIT_PRIVATE_KEY", "").strip()
    e1 = (os.environ.get("IMAGEKIT_URL_ENDPOINT") or os.environ.get("IMAGEKIT_URL") or "https://ik.imagekit.io/21rg7lvzo").strip().rstrip("/")
    if k1 and e1:
        pool.append({"id": "primary", "key": k1, "endpoint": e1})
        
    # 2. Secondary
    k2 = os.environ.get("IMAGEKIT_PRIVATE_KEY_2", "").strip()
    e2 = (os.environ.get("IMAGEKIT_URL_ENDPOINT_2") or os.environ.get("IMAGEKIT_URL_2") or "").strip().rstrip("/")
    if k2 and e2:
        pool.append({"id": "secondary", "key": k2, "endpoint": e2})
        
    # 3. Tertiary
    k3 = os.environ.get("IMAGEKIT_PRIVATE_KEY_3", "").strip()
    e3 = (os.environ.get("IMAGEKIT_URL_ENDPOINT_3") or os.environ.get("IMAGEKIT_URL_3") or "").strip().rstrip("/")
    if k3 and e3:
        pool.append({"id": "tertiary", "key": k3, "endpoint": e3})
        
    return pool


def is_configured():
    """Return True if at least one ImageKit account is configured."""
    return len(get_account_pool()) > 0


# -- Path helpers --------------------------------------------------------------

def _make_folder(listing_id):
    """
    Derive a clean ImageKit folder path from a pipeline listing ID.
    e.g. 'PP-A1B2C3D4' -> 'properties/PP-A1B2C3D4'
    """
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", str(listing_id or "unknown"))
    return "properties/" + safe


def _safe_filename(index, ext="webp"):
    """Return a safe, numbered filename for position `index` (0-based)."""
    return "photo_{:02d}.{}".format(index + 1, ext)


# -- Image compression & optimization -----------------------------------------

def compress_image_to_webp(raw_bytes):
    """
    Downscale and compress raw image bytes into an optimized WebP.
    Reduces file size by ~95% (e.g. 4 MB JPEG -> 60 KB WebP).
    Returns (optimized_bytes, 'webp') or (raw_bytes, 'jpg') if PIL unavailable.
    """
    if not _PIL_OK or not raw_bytes:
        return raw_bytes, "jpg"
    try:
        img = _PIL_Image.open(io.BytesIO(raw_bytes))
        
        # Convert RGBA / P / CMYK to RGB
        if img.mode in ("RGBA", "LA"):
            background = _PIL_Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
            
        # Scale if exceeds max dimension
        w, h = img.size
        if w > TARGET_IMAGE_MAX_DIM or h > TARGET_IMAGE_MAX_DIM:
            if w >= h:
                new_w = TARGET_IMAGE_MAX_DIM
                new_h = int(h * (TARGET_IMAGE_MAX_DIM / float(w)))
            else:
                new_h = TARGET_IMAGE_MAX_DIM
                new_w = int(w * (TARGET_IMAGE_MAX_DIM / float(h)))
            img = img.resize((new_w, new_h), _PIL_Image.Resampling.LANCZOS)
            
        # Save as WebP
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=TARGET_WEBP_QUALITY, method=6)
        compressed = out.getvalue()
        if compressed and len(compressed) < len(raw_bytes):
            return compressed, "webp"
        return raw_bytes, "webp"
    except Exception as e:
        logger.debug("WebP compression fallback: %s", e)
        return raw_bytes, "jpg"


# -- Image download ------------------------------------------------------------

def _download_image(url):
    """
    Download an image from `url`.
    Returns raw bytes or None on failure.
    """
    if not _REQUESTS_OK:
        return None
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": "https://cjproperties.org/",
        }
        r = _req.get(url, headers=headers, timeout=DOWNLOAD_TIMEOUT, stream=True)
        if r.status_code != 200:
            logger.debug("Download HTTP %d: %s", r.status_code, url[:80])
            return None

        chunks = []
        total = 0
        for chunk in r.iter_content(chunk_size=65536):
            if chunk:
                total += len(chunk)
                if total > MAX_IMAGE_BYTES:
                    logger.warning("  [IK] Image exceeds size cap: %s", url[:80])
                    return None
                chunks.append(chunk)
        return b"".join(chunks)

    except Exception as e:
        logger.debug("  [IK] Download error for %s: %s", url[:80], str(e)[:80])
        return None


# -- Upload one image with multi-account failover ------------------------------

def _upload_one(source_url, index, listing_id, account_pool):
    """
    Download source_url, optimize to WebP, and upload to ImageKit.
    If an account hits quota (400/403/429), fails over to the next account in the pool.
    """
    raw_data = _download_image(source_url)
    if raw_data is None:
        logger.warning("  [IK] Image %d download failed: %s", index + 1, source_url[:80])
        return None

    # Compress to WebP
    data, ext = compress_image_to_webp(raw_data)
    fname = _safe_filename(index, ext)
    folder = _make_folder(listing_id)
    mime = "image/webp" if ext == "webp" else "image/jpeg"

    # Attempt upload across account pool
    for acc_idx, account in enumerate(account_pool):
        private_key = account["key"]
        credentials = base64.b64encode((private_key + ":").encode()).decode()

        for attempt in range(1, MAX_UPLOAD_RETRIES + 1):
            try:
                files  = {"file": (fname, data, mime)}
                fields = {"fileName": fname, "folder": folder}
                r = _req.post(
                    IMAGEKIT_UPLOAD_URL,
                    headers={"Authorization": "Basic " + credentials},
                    files=files,
                    data=fields,
                    timeout=UPLOAD_TIMEOUT,
                )
                if r.status_code == 200:
                    ik_url = r.json().get("url")
                    if ik_url:
                        return ik_url

                # Check if account quota reached (400, 403, 429)
                if r.status_code in (400, 403, 429) and acc_idx < len(account_pool) - 1:
                    logger.warning(
                        "  [IK] Account %s reached capacity (%d). Failing over to next account...",
                        account["id"], r.status_code
                    )
                    break # break to next account in pool

                logger.warning(
                    "  [IK] Upload HTTP %d (attempt %d/%d): %s",
                    r.status_code, attempt, MAX_UPLOAD_RETRIES, r.text[:100]
                )
            except Exception as e:
                logger.warning("  [IK] Upload exception attempt %d: %s", attempt, str(e)[:80])

            if attempt < MAX_UPLOAD_RETRIES:
                time.sleep(RETRY_BACKOFF * attempt)

    return None


# -- URL verification ----------------------------------------------------------

def _verify_url(url):
    """HEAD-check that an ImageKit URL is accessible (<400)."""
    if not _REQUESTS_OK:
        return True
    try:
        r = _req.head(url, timeout=VERIFY_TIMEOUT, allow_redirects=True)
        return r.status_code < 400
    except Exception:
        return False


# -- Public entry point --------------------------------------------------------

def upload_images(source_urls, listing_id, verify=True, verbose=True):
    """
    Upload all images for a listing to ImageKit with automatic WebP compression
    and multi-account failover.
    """
    if not source_urls:
        return [], 0

    if not _REQUESTS_OK:
        if verbose:
            print("  [IK] requests not installed -- skipping ImageKit upload")
        return [], len(source_urls)

    pool = get_account_pool()
    if not pool:
        if verbose:
            print("  [IK] No ImageKit accounts configured -- skipping upload")
        return [], len(source_urls)

    if verbose:
        print("  [IK] Uploading " + str(len(source_urls)) + " image(s) for " + str(listing_id) + " (WebP auto-compressed)...")

    results = [None] * len(source_urls)
    workers = min(MAX_WORKERS, len(source_urls))

    with ThreadPoolExecutor(max_workers=workers) as ex:
        future_map = {
            ex.submit(_upload_one, url, i, listing_id, pool): i
            for i, url in enumerate(source_urls)
        }
        for fut in as_completed(future_map):
            idx = future_map[fut]
            try:
                results[idx] = fut.result()
            except Exception as e:
                logger.warning("  [IK] Worker exception image %d: %s", idx + 1, str(e)[:80])

    failed = 0
    imagekit_urls = []
    for idx, ik_url in enumerate(results):
        if ik_url is None:
            failed += 1
            if verbose:
                print("  [IK] FAILED image " + str(idx + 1) + ": " + source_urls[idx][:60])
            continue

        if verify and not _verify_url(ik_url):
            failed += 1
            if verbose:
                print("  [IK] FAILED verification: " + ik_url)
            continue

        imagekit_urls.append(ik_url)

    if verbose:
        print("  [IK] Done: " + str(len(imagekit_urls)) + " uploaded OK, " + str(failed) + " failed")

    return imagekit_urls, failed
