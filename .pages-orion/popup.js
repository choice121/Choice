// ============================================================
// Import to Choice Properties — Popup Script v2.1
// Orion-compatible: handles missing chrome APIs gracefully.
// ============================================================

(async function () {
  try {
    const EXTENSION_API = (typeof chrome !== 'undefined' && chrome.tabs) ? chrome :
      ((typeof browser !== 'undefined' && browser.tabs) ? browser : null);

    // Query the active tab to see context
    let tab = null;
    try {
      if (EXTENSION_API && EXTENSION_API.tabs && EXTENSION_API.tabs.query) {
        const tabs = await EXTENSION_API.tabs.query({ active: true, currentWindow: true });
        tab = tabs && tabs[0];
      }
    } catch (_) {}

    const isSupportedListing = tab && tab.url && (
      /zillow\.com\/homedetails\//i.test(tab.url) ||
      /realtor\.com\/realestateandhomes-detail\//i.test(tab.url) ||
      /apartments\.com\//i.test(tab.url) ||
      /redfin\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/[^/]+/i.test(tab.url)
    );

    const countEl   = document.getElementById('session-count');
    const pillEl    = document.getElementById('page-pill');
    const rowEl     = document.getElementById('status-row');
    const tipDef    = document.getElementById('tip-default');
    const tipOn     = document.getElementById('tip-on-listing');
    const queueRow  = document.getElementById('queue-row');
    const queueCount = document.getElementById('queue-count');
    const flushBtn  = document.getElementById('flush-btn');

    // Get session count from badge (fallback to "—" if API not available)
    let count = 0;
    try {
      if (EXTENSION_API && EXTENSION_API.action && EXTENSION_API.action.getBadgeText) {
        const badgeText = await EXTENSION_API.action.getBadgeText({});
        count = parseInt(badgeText, 10) || 0;
      }
    } catch (_) {}
    countEl.textContent = count > 0 ? String(count) : '0';

    // Queue status
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const data = await EXTENSION_API.storage.local.get({ cp_queue: [] });
        const queue = data.cp_queue || [];
        if (queue.length > 0) {
          queueRow.style.display = 'flex';
          queueCount.textContent = String(queue.length);
          flushBtn.disabled = false;
        } else {
          queueRow.style.display = 'none';
        }

        flushBtn.addEventListener('click', async () => {
          flushBtn.disabled = true;
          flushBtn.textContent = 'Syncing…';
          try {
            await EXTENSION_API.runtime.sendMessage({ type: 'FLUSH_QUEUE' });
          } catch (_) {}
          setTimeout(() => window.close(), 800);
        });
      }
    } catch (_) {}

    if (isSupportedListing) {
      pillEl.textContent = '✓ On supported listing';
      pillEl.className = 'pill';
      rowEl.className = 'status-row on-listing';
      tipDef.style.display = 'none';
      tipOn.style.display  = 'block';
    } else {
      pillEl.textContent = 'Not on listing';
      pillEl.className = 'pill inactive';
    }

    // ── Settings toggles ──────────────────────────────────────
    try {
      let s = { downloadToPC: true, offlineQueue: true };
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const settings = await EXTENSION_API.storage.local.get({ cp_settings: { downloadToPC: true, offlineQueue: true } });
        s = settings.cp_settings || s;
      }

      const dlToggle = document.getElementById('toggle-download');
      const oqToggle = document.getElementById('toggle-queue');
      dlToggle.checked = s.downloadToPC;
      oqToggle.checked = s.offlineQueue;

      const save = async () => {
        try {
          if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
            await EXTENSION_API.storage.local.set({
              cp_settings: { downloadToPC: dlToggle.checked, offlineQueue: oqToggle.checked }
            });
          }
        } catch (_) {}
      };
      dlToggle.addEventListener('change', save);
      oqToggle.addEventListener('change', save);
    } catch (_) {}
  } catch (e) {
    console.warn('[CP Popup]', e);
  }
})();