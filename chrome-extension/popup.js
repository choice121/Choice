// ============================================================
// Import to Choice Properties — Popup Script v2.1
// Orion-compatible: handles missing chrome APIs gracefully.
// ============================================================

(async function () {
  try {
    // Query the active tab to see context
    let tab = null;
    try {
      if (chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
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
      if (chrome.action && chrome.action.getBadgeText) {
        const badgeText = await chrome.action.getBadgeText({});
        count = parseInt(badgeText, 10) || 0;
      }
    } catch (_) {}
    countEl.textContent = count > 0 ? String(count) : '0';

    // Queue status
    try {
      if (chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get({ cp_queue: [] });
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
            await chrome.runtime.sendMessage({ type: 'FLUSH_QUEUE' });
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
      const aiTools = document.getElementById('ai-tools');
      if (aiTools) aiTools.style.display = 'block';
    } else {
      pillEl.textContent = 'Not on listing';
      pillEl.className = 'pill inactive';
    }

    // ── AI Extraction ─────────────────────────────────────────
    const btnExtractAi = document.getElementById('btn-extract-ai');
    const btnSaveAi = document.getElementById('btn-save-ai');
    const aiPreview = document.getElementById('ai-result-preview');
    let extractedPayload = null;

    if (btnExtractAi && tab) {
      btnExtractAi.addEventListener('click', async () => {
        btnExtractAi.disabled = true;
        btnExtractAi.textContent = '✨ Extracting... (may take 10s)';
        aiPreview.style.display = 'none';
        btnSaveAi.style.display = 'none';
        extractedPayload = null;

        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.innerText
          });
          const text = results[0]?.result;
          if (!text) throw new Error("Could not read page text.");

          const response = await fetch('https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/extract-listing-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: tab.url, text: text.substring(0, 30000) }) // max 30k chars
          });

          if (!response.ok) throw new Error("AI Extraction failed");
          const json = await response.json();
          if (!json.ok || !json.data) throw new Error("Invalid AI response");

          extractedPayload = json.data;
          
          aiPreview.textContent = JSON.stringify(extractedPayload, null, 2);
          aiPreview.style.display = 'block';
          btnSaveAi.style.display = 'block';
          btnExtractAi.textContent = '✨ Extracted Successfully';
        } catch (err) {
          console.error(err);
          btnExtractAi.textContent = '❌ Extraction Failed';
          aiPreview.textContent = String(err);
          aiPreview.style.display = 'block';
        }
        setTimeout(() => { if (!btnExtractAi.textContent.includes('Failed')) btnExtractAi.disabled = false; }, 2000);
      });
    }

    if (btnSaveAi) {
      btnSaveAi.addEventListener('click', async () => {
        if (!extractedPayload) return;
        btnSaveAi.disabled = true;
        btnSaveAi.textContent = 'Saving...';
        try {
          await chrome.runtime.sendMessage({ type: 'QUEUE_PAYLOAD', payload: extractedPayload });
          btnSaveAi.textContent = '✅ Saved to Queue';
          setTimeout(() => window.close(), 1000);
        } catch (err) {
          btnSaveAi.textContent = '❌ Failed to save';
        }
      });
    }

    // ── Settings toggles ──────────────────────────────────────
    try {
      let s = { downloadToPC: true, offlineQueue: true };
      if (chrome.storage && chrome.storage.local) {
        const settings = await chrome.storage.local.get({ cp_settings: { downloadToPC: true, offlineQueue: true } });
        s = settings.cp_settings || s;
      }

      const dlToggle = document.getElementById('toggle-download');
      const oqToggle = document.getElementById('toggle-queue');
      dlToggle.checked = s.downloadToPC;
      oqToggle.checked = s.offlineQueue;

      const save = async () => {
        try {
          if (chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({
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