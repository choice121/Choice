import crypto from 'crypto';
import { CREDENTIALS_CONFIG } from '../../credentials-config.mjs';

export const SUPABASE_URL = (process.env.SUPABASE_URL || CREDENTIALS_CONFIG.SUPABASE_URL).replace(/\/$/, '');
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || CREDENTIALS_CONFIG.SUPABASE_API_KEY;
export const SITE_URL = (process.env.SITE_URL || 'https://choice-properties-site.pages.dev').replace(/\/$/, '');

export function publicHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export function pipelineHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Accept-Profile': 'pipeline',
    'Content-Profile': 'pipeline',
    ...extra,
  };
}

export async function fetchJson(url, options = {}) {
  const opts = { ...options };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} on ${url}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

export async function callRpc(fnName, params = {}) {
  return fetchJson(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: publicHeaders(),
    body: params,
  });
}

export function generateBatchId(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hex = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PB-${y}${m}${d}-${hex}`;
}

export async function listRawPayloadObjects(prefix = '', limit = 1000) {
  const all = [];
  let offset = 0;
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  while (true) {
    const batch = await fetchJson(`${SUPABASE_URL}/storage/v1/object/list/pipeline-raw-payloads`, {
      method: 'POST',
      headers: publicHeaders(),
      body: { limit, offset, prefix: cleanPrefix },
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const item of batch) {
      if (!item || !item.name) continue;
      const fullPath = cleanPrefix ? `${cleanPrefix}/${item.name}` : item.name;
      if (item.id) {
        all.push(fullPath);
      } else if (item.name !== 'recovery' && !fullPath.startsWith('recovery/')) {
        const nested = await listRawPayloadObjects(fullPath, limit);
        all.push(...nested);
      }
    }
    if (batch.length < limit) break;
    offset += batch.length;
  }
  return all;
}

export async function uploadRawPayload(path, content) {
  const cleanPath = path.replace(/^\/+/, '');
  return fetchJson(`${SUPABASE_URL}/storage/v1/object/pipeline-raw-payloads/${cleanPath}`, {
    method: 'POST',
    headers: publicHeaders({ 'Content-Type': 'application/json' }),
    body: typeof content === 'string' ? content : JSON.stringify(content),
  });
}

export async function moveRawPayloadToRecovery(objectPath, batchId) {
  if (!objectPath || objectPath.startsWith('recovery/')) return objectPath;
  const relPath = objectPath.replace(/^\/+/, '');
  const destPath = `recovery/${batchId}/${relPath}`;
  try {
    await fetchJson(`${SUPABASE_URL}/storage/v1/object/move`, {
      method: 'POST',
      headers: publicHeaders(),
      body: {
        bucketId: 'pipeline-raw-payloads',
        sourceKey: objectPath,
        destinationKey: destPath,
      },
    });
    return destPath;
  } catch {
    return objectPath;
  }
}

export async function restoreRawPayloadFromRecovery(objectPath) {
  if (!objectPath || !objectPath.startsWith('recovery/')) return objectPath;
  const match = objectPath.match(/^recovery\/[^/]+\/(.+)$/);
  const destPath = match ? match[1] : objectPath.split('/').pop();
  if (!destPath) return objectPath;
  try {
    await fetchJson(`${SUPABASE_URL}/storage/v1/object/move`, {
      method: 'POST',
      headers: publicHeaders(),
      body: {
        bucketId: 'pipeline-raw-payloads',
        sourceKey: objectPath,
        destinationKey: destPath,
      },
    });
    return destPath;
  } catch {
    return objectPath;
  }
}

export async function removeRawPayloads(paths = []) {
  const cleanPaths = paths.filter((p) => typeof p === 'string' && p.length > 0);
  if (cleanPaths.length === 0) return { deleted: 0, errors: [] };

  const errors = [];
  let deleted = 0;
  for (let i = 0; i < cleanPaths.length; i += 50) {
    const chunk = cleanPaths.slice(i, i + 50);
    try {
      await fetchJson(`${SUPABASE_URL}/storage/v1/object/pipeline-raw-payloads`, {
        method: 'DELETE',
        headers: publicHeaders(),
        body: { prefixes: chunk },
      });
      deleted += chunk.length;
    } catch (err) {
      errors.push(err.message);
    }
  }
  return { deleted, errors };
}

export async function checkSchemaDeployed() {
  try {
    const defs = await fetchJson(`${SUPABASE_URL}/rest/v1/`, {
      headers: publicHeaders(),
    });
    const tables = Object.keys(defs?.definitions || {});
    const paths = Object.keys(defs?.paths || {});
    return {
      publishingBatches: tables.includes('publishing_batches'),
      publishingBatchProperties: tables.includes('publishing_batch_properties'),
      archiveRpc: paths.includes('/rpc/pipeline_archive_and_remove'),
      restoreRpc: paths.includes('/rpc/pipeline_restore_batch'),
    };
  } catch {
    return {
      publishingBatches: false,
      publishingBatchProperties: false,
      archiveRpc: false,
      restoreRpc: false,
    };
  }
}
