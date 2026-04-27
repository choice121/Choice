// ============================================================
// Choice Properties — ImageKit Upload Edge Function
// Supabase → Functions → imagekit-upload
//
// Required secret in Supabase Dashboard → Edge Functions → Secrets:
//   IMAGEKIT_PRIVATE_KEY  →  your ImageKit private key
//   IMAGEKIT_URL_ENDPOINT →  e.g. https://ik.imagekit.io/yourID
//
// This function:
//   1. Verifies the caller has an authenticated Supabase session
//   2. Receives a base64-encoded file + metadata from the browser
//   3. Authenticates with ImageKit using the private key (server-side)
//   4. Uploads to ImageKit and returns the final CDN URL
//   5. The private key is NEVER exposed to the browser
//
// Phase 3b additions (2026-04-22):
//   • Accepts an optional `propertyId` in the request body. When
//     present, calls the SECURITY INVOKER RPC `add_property_photo`
//     so the new row appears in `property_photos` immediately
//     (with the calling landlord's RLS context). Returns the new
//     row id as `photoId` for client-side state tracking.
//   • If `propertyId` is omitted (e.g. avatar uploads, brand-new
//     listings still in the create wizard), behaviour is identical
//     to the legacy contract — only `{url, fileId}` are returned
//     and DB persistence is the caller's responsibility.
// ============================================================

import { corsResponse } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { jsonResponse } from '../_shared/utils.ts';
import { isDbRateLimited } from '../_shared/rate-limit.ts';

// Per-user upload cap: 60 / 10 min. Allows landlord bulk-listing flows
// (typical new property = 20-30 photos) twice per window, while capping
// abuse that would burn ImageKit bandwidth + storage budget.
const UPLOAD_MAX_PER_WINDOW = 60;
const UPLOAD_WINDOW_MS      = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  // ── Auth check — reject unauthenticated callers ───────────
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;
  // ── End auth check ────────────────────────────────────────

  // ── Per-user rate limit (DB-backed, survives cold starts) ──
  if (await isDbRateLimited('user:' + user.id, 'imagekit-upload', UPLOAD_MAX_PER_WINDOW, UPLOAD_WINDOW_MS)) {
    return jsonResponse({ success: false, error: 'Too many uploads. Please wait a few minutes and try again.' }, 429);
  }

  try {
    const IMAGEKIT_PRIVATE_KEY  = Deno.env.get('IMAGEKIT_PRIVATE_KEY');
    const IMAGEKIT_URL_ENDPOINT = Deno.env.get('IMAGEKIT_URL_ENDPOINT');

    if (!IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
      return jsonResponse({ success: false, error: 'ImageKit not configured' }, 500);
    }

    const { fileData, fileName, folder, propertyId, altText, caption } =
      await req.json() as {
        fileData?: string;
        fileName?: string;
        folder?: string;
        propertyId?: string;
        altText?: string;
        caption?: string;
      };

    if (!fileData || !fileName) {
      return jsonResponse({ success: false, error: 'fileData and fileName required' }, 400);
    }

    // ── I-055: Input validation ───────────────────────────────
    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return jsonResponse(
        { success: false, error: `File type .${ext} not allowed. Accepted: jpg, jpeg, png, webp` },
        400
      );
    }

    const safeFileName = fileName.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\.{2,}/g, '_');

    const MAX_BASE64_BYTES = 20 * 1024 * 1024;
    const payloadSize = typeof fileData === 'string' ? fileData.length : 0;
    if (payloadSize > MAX_BASE64_BYTES) {
      return jsonResponse(
        { success: false, error: 'File too large. Maximum upload size is 15 MB.' },
        413
      );
    }
    // ── End I-055 validation ──────────────────────────────────

    // I-062: Strip the data URI prefix before sending to ImageKit.
    const base64Raw = typeof fileData === 'string' && fileData.includes(',')
      ? fileData.split(',')[1]
      : fileData;

    // CRITICAL: Decode base64 to binary before sending to ImageKit.
    const binaryData = Uint8Array.from(atob(base64Raw), c => c.charCodeAt(0));

    // Derive MIME from the (already-whitelisted) extension. Previously the
    // Blob was hard-coded to image/jpeg regardless of actual file type. Works
    // today because ImageKit infers MIME from content, but is a latent bug
    // if ImageKit ever tightens validation against the declared type.
    const MIME_BY_EXT: Record<string, string> = {
      jpg:  'image/jpeg',
      jpeg: 'image/jpeg',
      png:  'image/png',
      webp: 'image/webp',
    };
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';

    const credentials = btoa(`${IMAGEKIT_PRIVATE_KEY}:`);
    const formData = new FormData();
    formData.append('file', new Blob([binaryData], { type: mime }), safeFileName);
    formData.append('fileName', safeFileName);
    if (folder) formData.append('folder', folder);

    const ikRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      body: formData,
    });

    if (!ikRes.ok) {
      // Log full ImageKit response server-side for debugging, return generic
      // message to client (raw text could leak account internals or URLs).
      const errText = await ikRes.text().catch(() => `HTTP ${ikRes.status}`);
      console.error('[imagekit-upload] ImageKit error:', errText);
      return jsonResponse({ success: false, error: 'Image upload failed. Please try again.' }, 502);
    }

    const ikData = await ikRes.json();
    const url    = ikData.url    as string;
    const fileId = (ikData.fileId ?? null) as string | null;

    // ── Phase 3b: Persist directly into property_photos ───────
    let photoId: string | null = null;

    if (propertyId) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('add_property_photo', {
        p_property_id: propertyId,
        p_url:         url,
        p_file_id:     fileId ?? '',
        p_alt_text:    altText  ?? null,
        p_caption:     caption  ?? null,
        p_width:       ikData.width  ?? null,
        p_height:      ikData.height ?? null,
      });

      if (rpcErr) {
        // Best-effort cleanup: try to delete the orphaned ImageKit file.
        if (fileId) {
          fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Basic ${credentials}` },
          }).catch(() => undefined);
        }
        console.error('[imagekit-upload] add_property_photo failed:', rpcErr);
        return jsonResponse(
          { success: false, error: 'Photo metadata save failed' },
          500
        );
      }

      photoId = rpcData as unknown as string;
    }
    // ── End Phase 3b ──────────────────────────────────────────

    return jsonResponse({ success: true, url, fileId, photoId });
  } catch (err: any) {
    console.error('[imagekit-upload] Exception:', { message: err.message, stack: err.stack });
    return jsonResponse({ success: false, error: 'Image upload failed' }, 500);
  }
});
