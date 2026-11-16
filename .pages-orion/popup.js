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
      /redfin\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/[^/]+/i.test(tab.url) ||
      /opendoor\.com\/(?:homes|properties|listings)\//i.test(tab.url) ||
      /rentprogress\.com\/(?:houses-for-rent|homes|properties|rental-homes)\//i.test(tab.url) ||
      /invitationhomes\.com\/(?:property|homes-for-rent|houses-for-rent)\//i.test(tab.url) ||
      /(?:cjproperties\.org|cjrealestate\.com|appfolio\.com)\/[^/]+/i.test(tab.url)
    );

    const countEl   = document.getElementById('session-count');
    const pillEl    = document.getElementById('page-pill');
    const rowEl     = document.getElementById('status-row');
    const tipDef    = document.getElementById('tip-default');
    const tipOn     = document.getElementById('tip-on-listing');
    const queueRow  = document.getElementById('queue-row');
    const queueCount = document.getElementById('queue-count');
    const queueError = document.getElementById('queue-error');
    const flushBtn  = document.getElementById('flush-btn');
    const exportBtn = document.getElementById('export-queue-btn');
    const versionPill = document.getElementById('ext-version-pill');

    // Authoritative installed manifest version
    if (versionPill && EXTENSION_API && EXTENSION_API.runtime && EXTENSION_API.runtime.getManifest) {
      try {
        const manifest = EXTENSION_API.runtime.getManifest();
        if (manifest && manifest.version) {
          versionPill.textContent = 'v' + manifest.version;
        }
      } catch (_) {}
    }

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
          const lastError = queue.map(item => item && item._last_error).filter(Boolean).pop();
          if (queueError && lastError) {
            queueError.textContent = String(lastError).slice(0, 140);
            queueError.style.display = 'block';
          }
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

        exportBtn?.addEventListener('click', async () => {
          try {
            const latest = await EXTENSION_API.storage.local.get({ cp_queue: [] });
            const blob = new Blob([JSON.stringify(latest.cp_queue || [], null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'choice-properties-import-queue.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (_) {}
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
      let s = { offlineQueue: true };
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const settings = await EXTENSION_API.storage.local.get({ cp_settings: { offlineQueue: true } });
        s = settings.cp_settings || s;
      }

      const oqToggle = document.getElementById('toggle-queue');
      oqToggle.checked = s.offlineQueue;

      const save = async () => {
        try {
          if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
            await EXTENSION_API.storage.local.set({
              cp_settings: { offlineQueue: oqToggle.checked }
            });
          }
        } catch (_) {}
      };
      oqToggle.addEventListener('change', save);
    } catch (_) {}
  } catch (e) {
    console.warn('[CP Popup]', e);
  }
})();