// ============================================================
// Import to Choice Properties — Background Service Worker v5.0
// Zero-Tab Batch Pre-Flight, Prohibited Profile Cache,
// Offline Retry Queue, Folder/Batch Management & BG Tab Fallback.
// ============================================================

// Orion/Safari compatibility: some environments expose `browser` instead
// of `chrome`, and `chrome.storage.session` is not available.
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  try { globalThis.chrome = browser; } catch (_) {}
}

// Polyfill AbortSignal.timeout for older browsers (Orion/Safari)
if (typeof AbortSignal !== 'undefined' && !AbortSignal.timeout) {
  AbortSignal.timeout = function (ms) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

const EDGE_URL = (typeof window !== 'undefined' && window.CP_CONFIG && window.CP_CONFIG.EDGE_URL) ||
  'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import';
const SECRET = (typeof window !== 'undefined' && window.CP_CONFIG && window.CP_CONFIG.IMPORT_SECRET) ||
  'cp_import_7Kx3m9P2w5';
const MAX_QUEUE_ITEMS = 75;
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

const IS_MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const QUEUE_FLUSH_CONCURRENCY = IS_MOBILE ? 2 : 4;
const PROHIBITED_CACHE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_SETTINGS = {
  offlineQueue: true,
  autoSkipForSale: true,
  autoSkipDuplicates: true,
  autoSkipProhibited: true,
  bgTabFallback: false,
};

// ── Session count storage with fallback ──────────────────────
const _SESSION_KEY = '_cp_session_count';
const _SESSION_DATE_KEY = '_cp_session_date';

async function _getToday() {
  try { return new Date().toDateString(); } catch (_) { return ''; }
}

async function getCount() {
  try {
    if (chrome.storage && chrome.storage.session) {
      const data = await chrome.storage.session.get({ sessionCount: 0 });
      return data.sessionCount;
    }
  } catch (_) {}
  try {
    const today = await _getToday();
    const data = await chrome.storage.local.get({ [_SESSION_KEY]: 0, [_SESSION_DATE_KEY]: '' });
    if (data[_SESSION_DATE_KEY] !== today) {
      await chrome.storage.local.set({ [_SESSION_KEY]: 0, [_SESSION_DATE_KEY]: today });
      return 0;
    }
    return data[_SESSION_KEY] || 0;
  } catch (_) {}
  return 0;
}

async function incrementCount(delta = 1) {
  const step = Math.max(1, parseInt(delta, 10) || 1);
  try {
    if (chrome.storage && chrome.storage.session) {
      const n = (await getCount()) + step;
      await chrome.storage.session.set({ sessionCount: n });
      return n;
    }
  } catch (_) {}
  try {
    const today = await _getToday();
    const data = await chrome.storage.local.get({ [_SESSION_KEY]: 0, [_SESSION_DATE_KEY]: '' });
    const n = (data[_SESSION_KEY] || 0) + step;
    await chrome.storage.local.set({ [_SESSION_KEY]: n, [_SESSION_DATE_KEY]: today });
    return n;
  } catch (_) {}
  return 0;
}

async function getQueue() {
  try {
    const data = await chrome.storage.local.get({ cp_queue: [] });
    return data.cp_queue || [];
  } catch (_) {
    return [];
  }
}

async function setQueue(queue) {
  try {
    await chrome.storage.local.set({ cp_queue: queue });
  } catch (_) {}
}

function queueItemKey(item) {
  return `${item.source || 'unknown'}|${item.source_listing_id || 'unknown'}`;
}

async function addQueueItem(item, errorMessage) {
  const queue = await getQueue();
  const existingIndex = queue.findIndex(q => queueItemKey(q) === queueItemKey(item));
  const now = Date.now();
  if (existingIndex >= 0) {
    queue[existingIndex] = Object.assign({}, queue[existingIndex], {
      _last_attempt_at: now,
      _last_error: errorMessage || queue[existingIndex]._last_error || 'Retry pending',
      _retry_count: (queue[existingIndex]._retry_count || 0) + 1,
    });
    await setQueue(queue);
    await updateBadge();
    return queue.length;
  }
  queue.push(Object.assign({}, item, {
    _queued_at: now,
    _last_attempt_at: now,
    _retry_count: 0,
    _last_error: errorMessage || null,
  }));
  const trimmed = queue.slice(-MAX_QUEUE_ITEMS);
  await setQueue(trimmed);
  await updateBadge();
  return trimmed.length;
}

async function updateBadge() {
  try {
    const q = await getQueue();
    if (q.length > 0) {
      await chrome.action.setBadgeText({ text: String(q.length) });
      await chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
    } else {
      const n = await getCount();
      if (n > 0) {
        await chrome.action.setBadgeText({ text: String(n) });
        await chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
      } else {
        await chrome.action.setBadgeText({ text: '' });
      }
    }
  } catch (_) {}
}

async function postPayload(payload) {
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Payload exceeds the 2 MB import limit');
  }
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json', 'x-import-secret': SECRET },
    body: serialized,
    signal: AbortSignal.timeout(22000),
  });
  let body;
  try {
    body = await res.json();
  } catch (_) {
    body = {};
  }
  if (!res.ok) {
    body = body && typeof body === 'object' ? body : {};
    body.ok = false;
    body.httpStatus = res.status;
    body.error = body.error || `Server rejected import (HTTP ${res.status})`;
  }
  return body;
}

async function postBatchPayload(batchPayload) {
  const serialized = JSON.stringify(batchPayload);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    return { ok: false, payloadTooLarge: true, error: 'Batch payload exceeds the 2 MB import limit' };
  }
  const res = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json', 'x-import-secret': SECRET },
    body: serialized,
    signal: AbortSignal.timeout(28000),
  });
  let body;
  try {
    body = await res.json();
  } catch (_) {
    body = {};
  }
  if (!res.ok) {
    body = body && typeof body === 'object' ? body : {};
    body.ok = false;
    body.bridgeFailure = res.status >= 500 || res.status === 429;
    body.httpStatus = res.status;
    body.error = body.error || `Batch import rejected (HTTP ${res.status})`;
  }
  return body;
}

let queueFlushInFlight = null;
function flushQueue() {
  if (queueFlushInFlight) return queueFlushInFlight;
  queueFlushInFlight = flushQueueInternal().finally(() => {
    queueFlushInFlight = null;
  });
  return queueFlushInFlight;
}

async function flushQueueInternal() {
  const queue = await getQueue();
  if (queue.length === 0) return 0;

  let flushed = 0;
  let nextIndex = 0;
  const results = new Array(queue.length);
  const worker = async () => {
    while (nextIndex < queue.length) {
      const index = nextIndex++;
      const item = queue[index];
      try {
        const resp = await postPayload(item);
        if (resp && (resp.ok || resp.duplicate || resp.prohibited)) {
          results[index] = null;
          if (resp.ok || resp.duplicate) flushed++;
        } else {
          results[index] = Object.assign({}, item, {
            _last_attempt_at: Date.now(),
            _retry_count: (item._retry_count || 0) + 1,
            _last_error: (resp && resp.error) || 'Server rejected import',
          });
        }
      } catch (err) {
        results[index] = Object.assign({}, item, {
          _last_attempt_at: Date.now(),
          _retry_count: (item._retry_count || 0) + 1,
          _last_error: err && err.message ? err.message : 'Network error',
        });
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(QUEUE_FLUSH_CONCURRENCY, queue.length) },
      () => worker()
    )
  );
  const remaining = results.filter(Boolean);
  await setQueue(remaining);

  if (flushed > 0) {
    for (let i = 0; i < flushed; i++) {
      await incrementCount();
    }
  }
  await updateBadge();
  return flushed;
}

async function getCardSettings() {
  try {
    if (chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get({ cp_settings: DEFAULT_SETTINGS });
      return Object.assign({}, DEFAULT_SETTINGS, data.cp_settings || {});
    }
  } catch (_) {}
  return Object.assign({}, DEFAULT_SETTINGS);
}

async function setCardSettings(next) {
  const merged = Object.assign({}, DEFAULT_SETTINGS, next || {});
  try {
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ cp_settings: merged });
    }
  } catch (_) {}
  try {
    if (chrome.tabs && chrome.tabs.query && chrome.tabs.sendMessage) {
      const tabs = await chrome.tabs.query({ url: ['https://www.zillow.com/*', 'https://m.zillow.com/*'] });
      for (const tab of tabs || []) {
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'CP_SETTINGS_UPDATED', settings: merged }, () => {
            void chrome.runtime.lastError;
          });
        }
      }
    }
  } catch (_) {}
  return merged;
}

async function hydrateUrlInBgTab(targetUrl) {
  if (!chrome.tabs || !chrome.tabs.create) {
    return { ok: false, error: 'Tabs API unavailable' };
  }
  let createdTab = null;
  try {
    createdTab = await chrome.tabs.create({ url: targetUrl, active: false });
    const tabId = createdTab && createdTab.id;
    if (!tabId) return { ok: false, error: 'Could not open background tab' };

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { chrome.tabs.onUpdated.removeListener(onUpdated); } catch (_) {}
        resolve();
      };
      const timer = setTimeout(finish, 9500);
      function onUpdated(updatedId, changeInfo) {
        if (updatedId === tabId && changeInfo && changeInfo.status === 'complete') {
          clearTimeout(timer);
          setTimeout(finish, 750);
        }
      }
      chrome.tabs.onUpdated.addListener(onUpdated);
    });

    const resp = await new Promise((resolve) => {
      const msgTimer = setTimeout(() => resolve(null), 4000);
      try {
        chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_LISTING' }, (res) => {
          clearTimeout(msgTimer);
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res || null);
        });
      } catch (_) {
        clearTimeout(msgTimer);
        resolve(null);
      }
    });

    if (resp && resp.ok && resp.extracted) {
      return { ok: true, extracted: resp.extracted };
    }
    return { ok: false, error: 'Background tab extraction returned no listing' };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'Background tab hydration error' };
  } finally {
    if (createdTab && createdTab.id) {
      try { await chrome.tabs.remove(createdTab.id); } catch (_) {}
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SAVED') {
    (async () => {
      const n = await incrementCount(msg.count || 1);
      await updateBadge();
      sendResponse({ ok: true, count: n });
    })();
    return true;
  }

  if (msg.type === 'SUBMIT_BATCH_IMPORT') {
    (async () => {
      try {
        const listings = Array.isArray(msg.listings) ? msg.listings : [];
        if (!listings.length) {
          sendResponse({ ok: true, total: 0, saved: 0, duplicates: 0, prohibited: 0, failed: 0, results: [] });
          return;
        }
        const resp = await postBatchPayload({
          action: 'import_batch',
          listings,
          batch_id: msg.batch_id || null,
          folder_id: msg.folder_id || null,
          folder_name: msg.folder_name || null,
          enforce_prohibited_block: msg.enforce_prohibited_block !== false,
        });
        if (resp && resp.ok) {
          if (resp.saved > 0) {
            await incrementCount(resp.saved);
            await updateBadge();
            resp._counted = true;
          }
          sendResponse(resp);
          return;
        }
        sendResponse({
          ...(resp || {}),
          ok: false,
          error: (resp && resp.error) || 'Batch import failed',
        });
      } catch (err) {
        sendResponse({
          ok: false,
          bridgeFailure: true,
          httpStatus: 0,
          error: err && err.message ? err.message : 'Batch import network error',
        });
      }
    })();
    return true;
  }

  if (msg.type === 'QUEUE_UPDATED') {
    (async () => {
      await updateBadge();
      const flushed = await flushQueue();
      sendResponse({ ok: true, flushed });
    })();
    return true;
  }

  if (msg.type === 'QUEUE_PAYLOAD') {
    (async () => {
      try {
        const queueLength = await addQueueItem(msg.payload, msg.error);
        sendResponse({ ok: true, queued: true, queueLength });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg.type === 'UPLOAD_PAYLOAD') {
    (async () => {
      let networkError = 'Network error';
      try {
        const resp = await postPayload(msg.payload);
        if (resp && (resp.ok || resp.duplicate || resp.prohibited)) {
          sendResponse(resp);
          return;
        }
        sendResponse({
          ...(resp || {}),
          ok: false,
          error: resp?.error || 'Server rejected import',
        });
        return;
      } catch (err) {
        networkError = err && err.message ? err.message : 'Network error';
        if (!msg.settings?.offlineQueue) {
          sendResponse({ ok: false, error: networkError });
          return;
        }
      }

      if (msg.settings?.offlineQueue) {
        try {
          const queueLength = await addQueueItem(msg.payload, networkError);
          sendResponse({ ok: false, queued: true, queueLength });
        } catch (queueErr) {
          sendResponse({ ok: false, error: String(queueErr) });
        }
      } else {
        sendResponse({ ok: false, error: 'Network error' });
      }
    })();
    return true;
  }

  if (msg.type === 'FLUSH_QUEUE') {
    (async () => {
      const flushed = await flushQueue();
      sendResponse({ ok: true, flushed });
    })();
    return true;
  }

  if (msg.type === 'LIST_FOLDERS') {
    (async () => {
      try {
        const res = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET) + '&action=list_folders', {
          method: 'GET',
          headers: { 'x-import-secret': SECRET },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && Array.isArray(data.folders)) {
          try {
            if (chrome.storage && chrome.storage.local) {
              await chrome.storage.local.set({ cp_folders_cache: data.folders });
            }
          } catch (_) {}
          sendResponse({ ok: true, folders: data.folders });
        } else {
          sendResponse({ ok: false, error: (data && data.error) || 'Failed to list folders' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg.type === 'CREATE_FOLDER') {
    (async () => {
      try {
        const name = msg.name != null ? String(msg.name) : '';
        const description = msg.description != null ? String(msg.description) : '';
        const res = await fetch(EDGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-import-secret': SECRET },
          body: JSON.stringify({
            action: 'create_folder',
            name: name,
            description: description,
            color: msg.color || '#6366f1',
            icon: msg.icon || '📁',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.ok && data.id) {
          const newFolder = {
            id: data.id,
            name: data.name != null ? String(data.name) : name,
            description: description,
            batch_id: data.batch_id || null,
            batch_uuid: data.batch_uuid || null,
            is_disposable_batch: Boolean(data.is_disposable_batch),
            icon: data.icon || msg.icon || '📁',
            color: data.color || msg.color || '#6366f1',
          };
          try {
            if (chrome.storage && chrome.storage.local) {
              const stored = await chrome.storage.local.get({ cp_folders_cache: [] });
              const list = Array.isArray(stored.cp_folders_cache) ? stored.cp_folders_cache : [];
              const filtered = list.filter(f => f && f.id !== newFolder.id);
              filtered.unshift(newFolder);
              await chrome.storage.local.set({
                cp_folders_cache: filtered,
                cp_default_folder: {
                  id: newFolder.id,
                  name: newFolder.name,
                  description: newFolder.description,
                  batch_id: newFolder.batch_id,
                  is_disposable_batch: newFolder.is_disposable_batch,
                }
              });
            }
          } catch (_) {}
          sendResponse({ ok: true, folder: newFolder, id: newFolder.id, name: newFolder.name });
        } else {
          sendResponse({
            ok: false,
            code: (data && data.error) || null,
            error: (data && (data.message || data.error)) || 'Folder creation failed'
          });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg.type === 'GET_DEFAULT_FOLDER') {
    (async () => {
      try {
        if (chrome.storage && chrome.storage.local) {
          const data = await chrome.storage.local.get({ cp_default_folder: null, cp_folders_cache: [] });
          sendResponse({
            ok: true,
            defaultFolder: data.cp_default_folder || null,
            folders: Array.isArray(data.cp_folders_cache) ? data.cp_folders_cache : [],
          });
          return;
        }
      } catch (_) {}
      sendResponse({ ok: true, defaultFolder: null, folders: [] });
    })();
    return true;
  }

  if (msg.type === 'SET_DEFAULT_FOLDER') {
    (async () => {
      try {
        const folder = msg.folder || null;
        if (chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ cp_default_folder: folder });
        }
        sendResponse({ ok: true, defaultFolder: folder });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg.type === 'CHECK_LISTING') {
    (async () => {
      try {
        const sourceId = msg.source_listing_id ? String(msg.source_listing_id) : '';
        const source = msg.source ? String(msg.source) : 'zillow';
        if (!sourceId) {
          sendResponse({ ok: false, error: 'source_listing_id is required' });
          return;
        }
        let checkUrl = EDGE_URL
          + '?secret=' + encodeURIComponent(SECRET)
          + '&action=check_listing'
          + '&source=' + encodeURIComponent(source)
          + '&source_listing_id=' + encodeURIComponent(sourceId);
        if (msg.batch_id) checkUrl += '&batch_id=' + encodeURIComponent(String(msg.batch_id));
        if (msg.folder_id) checkUrl += '&folder_id=' + encodeURIComponent(String(msg.folder_id));
        if (msg.folder_name) checkUrl += '&folder_name=' + encodeURIComponent(String(msg.folder_name));
        if (msg.address) checkUrl += '&address=' + encodeURIComponent(String(msg.address));
        if (msg.city) checkUrl += '&city=' + encodeURIComponent(String(msg.city));
        if (msg.state) checkUrl += '&state=' + encodeURIComponent(String(msg.state));
        const res = await fetch(checkUrl, {
          method: 'GET',
          headers: { 'x-import-secret': SECRET },
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.ok) {
          sendResponse(data);
        } else {
          sendResponse({ ok: false, error: (data && data.error) || 'Check failed' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg.type === 'CHECK_LISTINGS_BATCH') {
    (async () => {
      try {
        const ids = Array.isArray(msg.source_listing_ids) ? msg.source_listing_ids.slice(0, 100) : [];
        if (ids.length === 0) {
          sendResponse({ ok: true, results: {} });
          return;
        }
        const res = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-import-secret': SECRET },
          body: JSON.stringify({
            action: 'check_listings_batch',
            source: msg.source || 'zillow',
            source_listing_ids: ids,
            addresses: (msg.addresses && typeof msg.addresses === 'object') ? msg.addresses : undefined,
            batch_id: msg.batch_id || null,
            folder_id: msg.folder_id || null,
            folder_name: msg.folder_name || null,
          }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.ok) {
          sendResponse(data);
        } else {
          sendResponse({ ok: false, error: (data && data.error) || 'Batch check failed' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg.type === 'LIST_PROHIBITED_PROFILES') {
    (async () => {
      try {
        if (!msg.force && chrome.storage && chrome.storage.local) {
          const cached = await chrome.storage.local.get({ cp_prohibited_profiles_cache: null });
          const entry = cached && cached.cp_prohibited_profiles_cache;
          if (entry && Array.isArray(entry.profiles) && (Date.now() - (entry.fetchedAt || 0)) < PROHIBITED_CACHE_TTL_MS) {
            sendResponse({ ok: true, profiles: entry.profiles, cached: true });
            return;
          }
        }
        const res = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET) + '&action=list_prohibited_profiles', {
          method: 'GET',
          headers: { 'x-import-secret': SECRET },
          signal: AbortSignal.timeout(6000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.ok && Array.isArray(data.profiles)) {
          try {
            if (chrome.storage && chrome.storage.local) {
              await chrome.storage.local.set({
                cp_prohibited_profiles_cache: { profiles: data.profiles, fetchedAt: Date.now() },
              });
            }
          } catch (_) {}
          sendResponse({ ok: true, profiles: data.profiles });
        } else {
          sendResponse({ ok: false, error: (data && data.error) || 'Failed to load prohibited profiles' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg.type === 'GET_CARD_SETTINGS') {
    (async () => {
      const settings = await getCardSettings();
      sendResponse({ ok: true, settings });
    })();
    return true;
  }

  if (msg.type === 'SET_CARD_SETTINGS') {
    (async () => {
      const settings = await setCardSettings(msg.settings);
      sendResponse({ ok: true, settings });
    })();
    return true;
  }

  if (msg.type === 'HYDRATE_URL_IN_BG_TAB') {
    (async () => {
      if (!msg.url || !/^https:\/\/(?:www|m)\.zillow\.com\//i.test(String(msg.url))) {
        sendResponse({ ok: false, error: 'Unsupported URL for background hydration' });
        return;
      }
      const result = await hydrateUrlInBgTab(String(msg.url));
      sendResponse(result);
    })();
    return true;
  }
});

// Flush queue when network comes back online
try {
  if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
    self.addEventListener('online', async () => { await flushQueue(); });
  }
} catch (_) {}