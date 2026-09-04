// ============================================================
// Choice Properties — ImageKit Delete Edge Function
// Supabase → Functions → imagekit-delete
//
// Supports:
//   • Single file:      { fileId: "..." }
//   • Batch files:      { fileIds: ["...", "..."] }
//   • Property folder:  { propertyId: "..." } or { propertyIds: ["...", "..."] }
//   • Custom folder:    { folderPath: "properties/..." }
//
// Admin & service-role callers can delete orphaned assets and
// property folders directly even after DB records have been cascaded.
// ============================================================

import { corsResponse } from '../_shared/cors.ts';
import { requireAuth }  from '../_shared/auth.ts';
import { jsonResponse } from '../_shared/utils.ts';
import { isDbRateLimited } from '../_shared/rate-limit.ts';

const DELETE_MAX_PER_WINDOW = 500;
const DELETE_WINDOW_MS      = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req.headers.get('origin'));

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const isServiceRole = user.id === 'service-role';
  let isAdmin = isServiceRole;

  if (!isAdmin) {
    const { data: adminRow } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (adminRow) isAdmin = true;
  }

  // Rate-limit non-service-role requests
  if (!isServiceRole && await isDbRateLimited('user:' + user.id, 'imagekit-delete', DELETE_MAX_PER_WINDOW, DELETE_WINDOW_MS)) {
    return jsonResponse({ success: false, error: 'Too many delete requests. Please wait a few minutes and try again.' }, 429, {}, req);
  }

  try {
    const IMAGEKIT_PRIVATE_KEY = Deno.env.get('IMAGEKIT_PRIVATE_KEY');
    if (!IMAGEKIT_PRIVATE_KEY) {
      return jsonResponse({ success: false, error: 'ImageKit not configured' }, 500, {}, req);
    }

    const body = await req.json().catch(() => ({}));
    const credentials = btoa(`${IMAGEKIT_PRIVATE_KEY}:`);
    const ikHeaders = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };

    // ── 1. Batch / Single Folder Deletion ───────────────────────
    const folderPaths: string[] = [];
    if (body.folderPath && typeof body.folderPath === 'string') {
      folderPaths.push(body.folderPath.replace(/^\/+/, ''));
    }
    if (body.propertyId && typeof body.propertyId === 'string') {
      folderPaths.push(`properties/${body.propertyId.trim()}`);
    }
    if (Array.isArray(body.propertyIds)) {
      body.propertyIds.forEach((pid: any) => {
        if (typeof pid === 'string' && pid.trim()) {
          folderPaths.push(`properties/${pid.trim()}`);
        }
      });
    }

    if (folderPaths.length > 0) {
      if (!isAdmin) {
        // Non-admin must own all target properties
        for (const fp of folderPaths) {
          const propId = fp.replace(/^properties\//, '');
          const { data: prop } = await supabase
            .from('properties')
            .select('landlord_id')
            .eq('id', propId)
            .maybeSingle();
          if (prop && prop.landlord_id !== user.id) {
            return jsonResponse({ success: false, error: 'Forbidden' }, 403, {}, req);
          }
        }
      }

      for (const fp of folderPaths) {
        try {
          const cleanFp = fp.replace(/^\/+/, '').replace(/\/+$/, '');
          await fetch('https://api.imagekit.io/v1/folder', {
            method: 'DELETE',
            headers: ikHeaders,
            body: JSON.stringify({ folderPath: cleanFp }),
          });
        } catch (fErr) {
          console.warn('[imagekit-delete] Folder delete error:', fp, fErr);
        }
      }
    }

    // ── 2. Batch / Single File Deletion ─────────────────────────
    const rawFileIds: string[] = [];
    if (typeof body.fileId === 'string' && body.fileId.trim()) {
      rawFileIds.push(body.fileId.trim());
    }
    if (Array.isArray(body.fileIds)) {
      body.fileIds.forEach((fid: any) => {
        if (typeof fid === 'string' && fid.trim()) rawFileIds.push(fid.trim());
      });
    }

    const uniqueFileIds = Array.from(new Set(rawFileIds));

    if (uniqueFileIds.length > 0) {
      // If non-admin, verify ownership via RPC for each file
      if (!isAdmin) {
        for (const fid of uniqueFileIds) {
          const { data: rpcDeleted, error: rpcErr } = await supabase.rpc(
            'delete_property_photo_by_file_id',
            { p_file_id: fid }
          );
          if (rpcErr || rpcDeleted === false) {
            return jsonResponse({ success: false, error: 'Forbidden' }, 403, {}, req);
          }
        }
      }

      // Execute ImageKit file deletions in chunks of 100
      for (let i = 0; i < uniqueFileIds.length; i += 100) {
        const chunk = uniqueFileIds.slice(i, i + 100);
        if (chunk.length === 1) {
          const fid = chunk[0];
          const ikRes = await fetch(
            `https://api.imagekit.io/v1/files/${encodeURIComponent(fid)}`,
            { method: 'DELETE', headers: { Authorization: `Basic ${credentials}` } }
          );
          if (!ikRes.ok && ikRes.status !== 404) {
            console.warn('[imagekit-delete] Single delete HTTP:', ikRes.status);
          }
        } else {
          const batchRes = await fetch('https://api.imagekit.io/v1/files/batch/deleteByFileIds', {
            method: 'POST',
            headers: ikHeaders,
            body: JSON.stringify({ fileIds: chunk }),
          });
          if (!batchRes.ok && batchRes.status !== 404) {
            console.warn('[imagekit-delete] Batch delete HTTP:', batchRes.status);
          }
        }
      }
    }

    return jsonResponse({
      success: true,
      deletedFolders: folderPaths.length,
      deletedFiles: uniqueFileIds.length,
    }, 200, {}, req);
  } catch (err: any) {
    console.error('[imagekit-delete] handler error:', err);
    return jsonResponse({ success: false, error: err?.message || 'Failed to delete assets' }, 500, {}, req);
  }
});
