// ============================================================
// Choice Properties — Live Content Script v26.0.0
// Universal High-Quality Browser Extension UI for eight supported portals
//
// Key Features:
// 1. Sleek Floating Action Card (Glassmorphism, collision-aware)
// 2. Pre-flight Live Inspection (Shows parsed rent, beds, baths, photo count before saving)
// 3. One-Click Fast Save + Integrated Photo Upload Progress Bar
// 4. Post-Save Quick Actions (Open Pipeline, Copy Link)
// 5. Zillow Search / Feed Card Quick-Save Buttons
// 6. Instant Live-Update Architecture (Zero reinstall needed)
// ============================================================
(function () {
  'use strict';

  var EXTENSION_API = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome :
    ((typeof browser !== 'undefined' && browser.runtime) ? browser : null);

  // Prevent multiple executions
  if (window.__CP_LIVE_CONTENT_LOADED__) return;
  window.__CP_LIVE_CONTENT_LOADED__ = true;

  // ── Configuration ──────────────────────────────────────────
  var EDGE_URL = (window.CP_CONFIG && window.CP_CONFIG.EDGE_URL) || 'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import';
  var SECRET   = (window.CP_CONFIG && window.CP_CONFIG.IMPORT_SECRET) || 'cp_import_7Kx3m9P2w5';
  var VERSION  = '26.0.0-live';

  var IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var PHOTO_BATCH_SIZE = IS_MOBILE ? 2 : 12;
  var MAX_PHOTOS = IS_MOBILE ? 20 : 50;
  var MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

  var lastUrl = location.href;
  var activeWidget = null;
  var isExpanded = false;
  var isMinimized = false;
  var currentExtractedData = null;
  var renderedListingSignature = '';
  var listingGeneration = 0;
  var cachedFolders = [];
  var activeDefaultFolder = null;
  var isSaving = false;
  var listingRefreshTimer = null;
  var hydrationRefreshTimers = [];

  // ── Fast In-Memory, Extension Storage & LocalStorage Folder Cache ───────────────
  function getCachedFolders() {
    if (cachedFolders && cachedFolders.length > 0) return cachedFolders;
    try {
      var localData = localStorage.getItem('cp_pipeline_folders_cache');
      if (localData) {
        var parsed = JSON.parse(localData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedFolders = parsed;
          return cachedFolders;
        }
      }
    } catch (e) {}
    return [];
  }

  function setCachedFolders(folders) {
    if (!Array.isArray(folders)) return;
    cachedFolders = folders;
    try {
      localStorage.setItem('cp_pipeline_folders_cache', JSON.stringify(folders));
    } catch (e) {}
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        EXTENSION_API.storage.local.set({ cp_folders_cache: folders });
      }
    } catch (e) {}
  }

  function getDefaultFolderSync() {
    if (activeDefaultFolder) return activeDefaultFolder;
    try {
      var raw = localStorage.getItem('cp_default_folder');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && (parsed.id || parsed.name != null)) {
          activeDefaultFolder = parsed;
          return activeDefaultFolder;
        }
      }
    } catch (e) {}
    return null;
  }

  function setDefaultFolder(folder) {
    activeDefaultFolder = folder && (folder.id || folder.name != null)
      ? { id: folder.id || null, name: String(folder.name != null ? folder.name : ''), description: folder.description || '' }
      : null;
    try {
      if (activeDefaultFolder) {
        localStorage.setItem('cp_default_folder', JSON.stringify(activeDefaultFolder));
      } else {
        localStorage.removeItem('cp_default_folder');
      }
    } catch (e) {}
    try {
      if (EXTENSION_API && EXTENSION_API.runtime && EXTENSION_API.runtime.sendMessage) {
        EXTENSION_API.runtime.sendMessage({ type: 'SET_DEFAULT_FOLDER', folder: activeDefaultFolder });
      }
    } catch (e) {}
  }

  async function apiListFolders() {
    if (EXTENSION_API && EXTENSION_API.runtime && EXTENSION_API.runtime.sendMessage) {
      var bgRes = await new Promise(function (resolve) {
        try {
          EXTENSION_API.runtime.sendMessage({ type: 'LIST_FOLDERS' }, function (resp) {
            resolve(EXTENSION_API.runtime.lastError ? null : resp);
          });
        } catch (e) { resolve(null); }
      });
      if (bgRes && bgRes.ok && Array.isArray(bgRes.folders)) {
        return bgRes.folders;
      }
    }
    var url = EDGE_URL + '?secret=' + encodeURIComponent(SECRET) + '&action=list_folders';
    var res = await fetch(url);
    if (res.ok) {
      var data = await res.json();
      if (data && Array.isArray(data.folders)) return data.folders;
    }
    return null;
  }

  async function apiCreateFolder(name, description) {
    var rawName = name != null ? String(name) : '';
    var rawDesc = description != null ? String(description) : '';
    if (EXTENSION_API && EXTENSION_API.runtime && EXTENSION_API.runtime.sendMessage) {
      var bgRes = await new Promise(function (resolve) {
        try {
          EXTENSION_API.runtime.sendMessage({
            type: 'CREATE_FOLDER',
            name: rawName,
            description: rawDesc
          }, function (resp) {
            resolve(EXTENSION_API.runtime.lastError ? null : resp);
          });
        } catch (e) { resolve(null); }
      });
      if (bgRes && bgRes.ok && bgRes.id) {
        return bgRes.folder || { id: bgRes.id, name: bgRes.name != null ? String(bgRes.name) : rawName, description: rawDesc };
      }
    }
    var res = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-import-secret': SECRET },
      body: JSON.stringify({
        action: 'create_folder',
        name: rawName,
        description: rawDesc
      })
    });
    var data = await res.json();
    if (res.ok && data && data.ok && data.id) {
      return { id: data.id, name: data.name != null ? String(data.name) : rawName, description: rawDesc };
    }
    throw new Error((data && data.error) || 'Failed to create folder');
  }

  // ── Inject Custom Styles ────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cp-live-styles')) return;
    var style = document.createElement('style');
    style.id = 'cp-live-styles';
    style.textContent = `
      #cp-widget-container {
        position: fixed;
        bottom: max(16px, env(safe-area-inset-bottom));
        right: max(12px, env(safe-area-inset-right));
        z-index: 2147483647;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 18px;
        box-shadow: 0 16px 40px -6px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.25);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #f8fafc;
        overflow: hidden;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, bottom 0.2s ease;
        box-sizing: border-box;
        touch-action: none;
      }
      #cp-widget-container.cp-dragging {
        opacity: 0.98;
        box-shadow: 0 24px 50px -4px rgba(0, 0, 0, 0.75), 0 0 0 2px rgba(99, 102, 241, 0.6);
        transition: none !important;
        cursor: grabbing !important;
      }
      #cp-widget-container * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      #cp-widget-container.cp-minimized {
        width: auto;
        border-radius: 28px;
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      #cp-widget-container.cp-minimized .cp-full-body {
        display: none !important;
      }
      .cp-mini-trigger {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        cursor: pointer;
        user-select: none;
        font-size: 13px;
        font-weight: 600;
        color: #e2e8f0;
      }
      #cp-widget-container.cp-minimized .cp-mini-trigger {
        display: flex !important;
      }
      .cp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: rgba(30, 41, 59, 0.75);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
      }
      .cp-header:active,
      #cp-widget-container.cp-dragging .cp-header {
        cursor: grabbing;
      }
      .cp-drag-grip {
        display: inline-flex;
        align-items: center;
        margin-right: 2px;
        color: #64748b;
        opacity: 0.7;
        cursor: grab;
      }
      .cp-header:hover .cp-drag-grip {
        color: #94a3b8;
        opacity: 1;
      }
      .cp-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cp-logo-icon {
        width: 22px;
        height: 22px;
        background: linear-gradient(135deg, #10b981 0%, #6366f1 100%);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
      }
      .cp-brand-title {
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: -0.01em;
      }
      .cp-header-badges {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .cp-badge-verified {
        font-size: 10px;
        font-weight: 600;
        background: rgba(16, 185, 129, 0.18);
        color: #34d399;
        padding: 2px 7px;
        border-radius: 999px;
        border: 1px solid rgba(52, 211, 153, 0.25);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .cp-header-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        width: 44px;
        height: 44px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: color 0.15s, background 0.15s;
      }
      .cp-header-btn:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.1);
      }
      .cp-body {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .cp-property-snapshot {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cp-address-line {
        font-size: 13px;
        font-weight: 600;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cp-chips-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .cp-chip {
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
      }
      .cp-chip-price {
        background: rgba(99, 102, 241, 0.2);
        color: #a5b4fc;
        border: 1px solid rgba(165, 180, 252, 0.25);
      }
      .cp-chip-photos {
        background: rgba(16, 185, 129, 0.18);
        color: #6ee7b7;
      }
      .cp-accordion-toggle {
        font-size: 11px;
        color: #818cf8;
        background: none;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 600;
        min-height: 44px;
        padding: 8px 0;
        text-align: left;
      }
      .cp-accordion-toggle:hover {
        color: #a5b4fc;
      }
      .cp-inspector-tray {
        display: none;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.6;
      }
      .cp-inspector-tray.cp-open {
        display: block;
      }
      .cp-inspector-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .cp-inspector-item strong {
        color: #e2e8f0;
      }
      /* Folder Pill & Auto-Collapsing Folder Popover */
      .cp-folder-bar {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cp-folder-pill-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 7px 11px;
        background: rgba(30, 41, 59, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.11);
        border-radius: 10px;
        color: #e2e8f0;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.16s ease;
        user-select: none;
        text-align: left;
      }
      .cp-folder-pill-trigger:hover {
        background: rgba(30, 41, 59, 0.95);
        border-color: rgba(99, 102, 241, 0.45);
      }
      .cp-folder-pill-trigger.cp-folder-active {
        background: rgba(99, 102, 241, 0.16);
        border-color: rgba(129, 140, 248, 0.4);
      }
      .cp-folder-pill-left {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        flex: 1;
      }
      .cp-folder-pill-icon {
        font-size: 13px;
        flex-shrink: 0;
      }
      .cp-folder-pill-text {
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        overflow: hidden;
      }
      .cp-folder-pill-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #94a3b8;
        flex-shrink: 0;
      }
      .cp-folder-pill-name {
        font-size: 12px;
        font-weight: 700;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cp-folder-active .cp-folder-pill-name {
        color: #c7d2fe;
      }
      .cp-folder-pill-action {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 600;
        color: #818cf8;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(99, 102, 241, 0.14);
        flex-shrink: 0;
        margin-left: 8px;
      }
      .cp-folder-pill-trigger:hover .cp-folder-pill-action {
        background: rgba(99, 102, 241, 0.28);
        color: #c7d2fe;
      }
      .cp-folder-popover {
        display: none;
        flex-direction: column;
        gap: 10px;
        background: rgba(15, 23, 42, 0.98);
        border: 1px solid rgba(129, 140, 248, 0.35);
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
      }
      .cp-folder-popover.cp-open {
        display: flex;
      }
      .cp-folder-popover-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .cp-folder-popover-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #a5b4fc;
      }
      .cp-folder-popover-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 15px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
      }
      .cp-folder-popover-close:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.1);
      }
      .cp-folder-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 135px;
        overflow-y: auto;
        padding-right: 2px;
      }
      .cp-folder-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 7px 9px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: rgba(30, 41, 59, 0.55);
        color: #e2e8f0;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
      }
      .cp-folder-item:hover {
        background: rgba(51, 65, 85, 0.75);
        border-color: rgba(255, 255, 255, 0.12);
      }
      .cp-folder-item.cp-selected {
        background: rgba(99, 102, 241, 0.22);
        border-color: rgba(129, 140, 248, 0.45);
        color: #ffffff;
        font-weight: 700;
      }
      .cp-folder-item-main {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
        flex: 1;
      }
      .cp-folder-item-name {
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cp-folder-item-desc {
        font-size: 10px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 400;
      }
      .cp-folder-item-check {
        color: #34d399;
        font-size: 12px;
        font-weight: 800;
        margin-left: 6px;
        flex-shrink: 0;
      }
      .cp-folder-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 2px 0;
      }
      .cp-folder-create-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        padding: 7px 10px;
        border-radius: 8px;
        border: 1px dashed rgba(129, 140, 248, 0.45);
        background: rgba(99, 102, 241, 0.1);
        color: #a5b4fc;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .cp-folder-create-toggle:hover {
        background: rgba(99, 102, 241, 0.2);
        border-color: #818cf8;
        color: #e0e7ff;
      }
      .cp-folder-create-form {
        display: none;
        flex-direction: column;
        gap: 7px;
        padding-top: 2px;
      }
      .cp-folder-create-form.cp-open {
        display: flex;
      }
      .cp-folder-input {
        width: 100%;
        padding: 7px 10px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(15, 23, 42, 0.9);
        color: #f8fafc;
        font-size: 12px;
        font-family: inherit;
        outline: none;
      }
      .cp-folder-input::placeholder {
        color: #64748b;
      }
      .cp-folder-input:focus {
        border-color: #818cf8;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
      }
      .cp-folder-form-actions {
        display: flex;
        gap: 6px;
      }
      .cp-folder-btn-cancel {
        flex: 1;
        padding: 7px 10px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        color: #cbd5e1;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .cp-folder-btn-submit {
        flex: 1.5;
        padding: 7px 12px;
        border-radius: 7px;
        border: none;
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        color: #ffffff;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .cp-folder-btn-submit:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .cp-save-action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        min-height: 48px;
        padding: 13px 20px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 9999px;
        background: linear-gradient(135deg, #10b981 0%, #059669 30%, #4f46e5 100%);
        color: #ffffff;
        font-size: 14.5px;
        font-weight: 800;
        letter-spacing: -0.01em;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
        transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
        touch-action: manipulation;
      }
      .cp-save-action-btn svg {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
      }
      @media (max-width: 480px) {
        #cp-widget-container {
          width: calc(100vw - 20px);
          max-width: calc(100vw - 20px);
          right: 10px;
        }
        .cp-header {
          padding: 8px 10px;
        }
        .cp-body {
          padding: 10px;
        }
        .cp-inspector-grid {
          grid-template-columns: 1fr;
        }
      }
      .cp-save-action-btn:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 30%, #4338ca 100%);
        box-shadow: 0 10px 28px rgba(16, 185, 129, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.3) inset;
        transform: translateY(-2px) scale(1.01);
      }
      .cp-save-action-btn:active {
        transform: scale(0.98);
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
      }
      .cp-save-action-btn:disabled {
        opacity: 0.8;
        cursor: not-allowed;
        transform: none !important;
      }
      /* Integrated Progress State */
      .cp-progress-box {
        display: none;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
      }
      .cp-progress-header {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 600;
        color: #cbd5e1;
      }
      .cp-progress-bar-track {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        overflow: hidden;
      }
      .cp-progress-bar-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #6366f1, #10b981);
        border-radius: 999px;
        transition: width 0.25s ease;
      }
      /* Success State */
      .cp-success-box {
        display: none;
        flex-direction: column;
        gap: 10px;
        padding: 6px 0;
      }
      .cp-success-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #34d399;
        font-size: 14px;
        font-weight: 700;
      }
      .cp-success-actions {
        display: flex;
        gap: 8px;
      }
      .cp-btn-secondary {
        flex: 1;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        transition: background 0.15s;
      }
      .cp-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.16);
      }
      .cp-btn-primary-sm {
        flex: 1.2;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        border: none;
        background: #10b981;
        color: #ffffff;
        box-shadow: 0 2px 10px rgba(16, 185, 129, 0.4);
        transition: background 0.15s;
      }
      .cp-btn-primary-sm:hover {
        background: #059669;
      }
      /* Spinner */
      .cp-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: cp-spin 0.7s linear infinite;
        display: inline-block;
      }
      @keyframes cp-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Smart Layout Collision Avoidance ────────────────────────
  function updateWidgetPosition() {
    if (!activeWidget || activeWidget._userPositioned) return;
    var bottomOffset = 24;

    // Check Zillow's sticky bottom bars or action panels
    var stickySelectors = [
      '[data-testid="bottom-bar"]',
      '.hdp-bottom-bar',
      'div[class*="BottomBar"]',
      'div[class*="sticky-bottom"]',
      '#search-detail-root [data-testid="bottom-bar"]',
      '.floating-bottom-bar',
      'div[class*="StickyBanner"]'
    ];

    for (var i = 0; i < stickySelectors.length; i++) {
      var el = document.querySelector(stickySelectors[i]);
      if (el) {
        var rect = el.getBoundingClientRect();
        if (rect.height > 20 && rect.top < window.innerHeight && rect.bottom > 0) {
          var barHeight = window.innerHeight - rect.top;
          if (barHeight > 10 && barHeight < 250) {
            bottomOffset = Math.max(bottomOffset, barHeight + 14);
          }
        }
      }
    }

    activeWidget.style.bottom = 'max(' + bottomOffset + 'px, env(safe-area-inset-bottom))';
  }

  // ── URL & Page Support Detection ────────────────────────────
  function isDetailPage(url) {
    return /zillow\.com\/(homedetails|homes|b|community|apartments)\/.*_zpid/i.test(url) ||
           /zillow\.com\/.*_zpid/i.test(url) ||
           /zillow\.com\/(homedetails|b|community)\//i.test(url) ||
           /realtor\.com\/realestateandhomes-detail/i.test(url) ||
           /apartments\.com\/[^/]+\/[^/]+/i.test(url) ||
           /redfin\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+/i.test(url) ||
           /opendoor\.com\/(homes|properties|listings|[^/]+\/[^/]+)/i.test(url) ||
           /rentprogress\.com\/(houses-for-rent|homes|properties|rental-homes|property-details|[^/]+\/[^/]+)/i.test(url) ||
           /(cjproperties\.org|cjrealestate\.com|appfolio\.com)\/[^/]+/i.test(url) ||
           /invitationhomes\.com\/(?:property|homes-for-rent|houses-for-rent)\/[^/?#]+/i.test(url);
  }

  function isSearchPage(url) {
    return /zillow\.com\/(homes|for_rent|b\/|search)/i.test(url);
  }

  function extractCurrentListing() {
    if (!window.CP_Extractors || typeof window.CP_Extractors.extract !== 'function') return null;
    try {
      return window.CP_Extractors.extract(location.href, document);
    } catch (err) {
      console.warn('[CP] Listing extraction notice:', err);
      return null;
    }
  }

  function extractionSignature(data) {
    if (!data) return '';
    var photos = extractPhotoUrls(data.original_image_urls);
    if (!photos.length && Array.isArray(data.photo_urls)) photos = data.photo_urls;
    return [
      data.source,
      data.source_listing_id,
      data.source_url,
      data.address,
      data.city,
      data.state,
      data.zip,
      data.monthly_rent != null ? data.monthly_rent : data.rent,
      data.bedrooms != null ? data.bedrooms : data.beds,
      data.bathrooms != null ? data.bathrooms : data.baths,
      data.square_footage != null ? data.square_footage : data.sqft,
      photos.length,
      data.description ? String(data.description).length : 0
    ].join('|');
  }

  function scheduleListingRefresh(delay) {
    if (listingRefreshTimer) clearTimeout(listingRefreshTimer);
    var refreshGeneration = listingGeneration;
    listingRefreshTimer = setTimeout(function () {
      listingRefreshTimer = null;
      if (refreshGeneration !== listingGeneration || !isDetailPage(location.href)) return;
      var next = extractCurrentListing();
      if (!next) return;
      var nextSignature = extractionSignature(next);
      if (!activeWidget || nextSignature !== renderedListingSignature) {
        injectWidget(next);
      }
    }, delay == null ? 220 : delay);
  }

  function scheduleHydrationRefreshes() {
    hydrationRefreshTimers.forEach(function (timer) { clearTimeout(timer); });
    hydrationRefreshTimers = [0, 250, 800, 1800, 3500].map(function (delay) {
      return setTimeout(function () {
        scheduleListingRefresh(0);
      }, delay);
    });
  }

  // ── Extract Photo URLs Helper ───────────────────────────────
  function extractPhotoUrls(raw) {
    var urls = [];
    if (!raw) return urls;
    try {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        parsed.forEach(function (item) {
          if (!item) return;
          if (typeof item === 'string') urls.push(item);
          else if (typeof item === 'object' && typeof item.url === 'string') urls.push(item.url);
        });
      }
    } catch (e) {}
    return urls;
  }

  function dedupePhotoUrls(urls) {
    var seen = new Set();
    var unique = [];
    if (!Array.isArray(urls)) return unique;
    urls.forEach(function (raw) {
      if (!raw) return;
      var url = typeof raw === 'string' ? raw.trim() : (raw.url || '');
      if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
      seen.add(url);
      unique.push(url);
    });
    return unique;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  // ── Build & Inject Main Widget ──────────────────────────────
  function removeWidget() {
    if (activeWidget) {
      activeWidget.remove();
      activeWidget = null;
    }
    renderedListingSignature = '';
  }

  function injectWidget(extractedOverride) {
    removeWidget();
    if (!isDetailPage(location.href)) return;

    injectStyles();

    // Run pre-flight extraction
    var extracted = extractedOverride || extractCurrentListing();
    currentExtractedData = extracted;
    renderedListingSignature = extractionSignature(extracted);

    var container = document.createElement('div');
    container.id = 'cp-widget-container';

    // Format display attributes
    var rentStr = 'Rent pending';
    if (extracted && (extracted.monthly_rent || extracted.rent)) {
      var rentNum = extracted.monthly_rent || extracted.rent;
      rentStr = '$' + Number(rentNum).toLocaleString() + '/mo';
    }

    var bedsBaths = 'Listing details';
    if (extracted && (extracted.bedrooms != null || extracted.bathrooms != null)) {
      var beds = extracted.bedrooms != null ? extracted.bedrooms + ' bd' : '';
      var baths = extracted.bathrooms != null ? extracted.bathrooms + ' ba' : '';
      bedsBaths = [beds, baths].filter(Boolean).join(' • ');
      if (extracted.square_footage) {
        bedsBaths += ' • ' + Number(extracted.square_footage).toLocaleString() + ' sqft';
      }
    }

    var photoUrls = [];
    if (extracted) {
      photoUrls = extractPhotoUrls(extracted.original_image_urls);
      if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
        photoUrls = extracted.photo_urls;
      }
    }
    var photoCount = photoUrls.length;
    var sourceLabel = extracted && extracted.source ? String(extracted.source).replace(/_/g, ' ') : 'Listing';

    var addressStr = (extracted && extracted.address) ? extracted.address : 'Detected Listing';
    if (extracted && extracted.city && extracted.state) {
      addressStr += ', ' + extracted.city + ', ' + extracted.state;
    }

    var defaultFolder = getDefaultFolderSync();
    var currentFolderLabel = defaultFolder && defaultFolder.name != null && String(defaultFolder.name) !== ''
      ? String(defaultFolder.name)
      : 'Main Inbox (Default)';
    var isCustomFolderActive = Boolean(defaultFolder && (defaultFolder.id || (defaultFolder.name != null && String(defaultFolder.name) !== '')));

    container.innerHTML = `
      <!-- Minimized State Trigger -->
      <div class="cp-mini-trigger" id="cp-expand-trigger" title="Click to expand Choice Properties importer">
        <div class="cp-logo-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
        </div>
        <span>${escapeHtml(rentStr)} • Choice Import</span>
      </div>

      <!-- Full Body -->
      <div class="cp-full-body">
        <div class="cp-header" id="cp-header-bar" title="Drag to move widget anywhere on screen">
          <div class="cp-brand">
            <span class="cp-drag-grip" title="Drag to move">
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                <circle cx="2" cy="7" r="1.5"/><circle cx="8" cy="7" r="1.5"/>
                <circle cx="2" cy="12" r="1.5"/><circle cx="8" cy="12" r="1.5"/>
              </svg>
            </span>
            <div class="cp-logo-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            </div>
            <span class="cp-brand-title">Choice Properties</span>
          </div>
          <div class="cp-header-badges">
            <span class="cp-badge-verified">${escapeHtml(sourceLabel)} Verified</span>
            <button class="cp-header-btn" id="cp-btn-minimize" title="Minimize widget">_</button>
            <button class="cp-header-btn" id="cp-btn-close" title="Close widget">×</button>
          </div>
        </div>

        <div class="cp-body">
          <div class="cp-property-snapshot">
            <div class="cp-address-line" title="${escapeHtml(addressStr)}">${escapeHtml(addressStr)}</div>
            <div class="cp-chips-row">
              <span class="cp-chip cp-chip-price">${escapeHtml(rentStr)}</span>
              <span class="cp-chip">${escapeHtml(bedsBaths)}</span>
              <span class="cp-chip cp-chip-photos">📸 ${escapeHtml(photoCount)} photos</span>
            </div>
            <button class="cp-accordion-toggle" id="cp-toggle-tray">
              <span>View details breakdown</span> <span id="cp-chevron">▾</span>
            </button>
            <div class="cp-inspector-tray" id="cp-inspector-tray">
              <div class="cp-inspector-grid">
                <div class="cp-inspector-item">Deposit: <strong>1x Rent</strong></div>
                <div class="cp-inspector-item">App Fee: <strong>$50</strong></div>
                <div class="cp-inspector-item">Pets: <strong>Pet Friendly ✓</strong></div>
                <div class="cp-inspector-item">Lease Term: <strong>Omitted ✓</strong></div>
              </div>
            </div>
          </div>

          <!-- Compact Folder Pill & Auto-Collapsing Popover -->
          <div class="cp-folder-bar">
            <button type="button" class="cp-folder-pill-trigger ${isCustomFolderActive ? 'cp-folder-active' : ''}" id="cp-folder-pill-btn" title="Click to switch folder or create a new folder">
              <div class="cp-folder-pill-left">
                <span class="cp-folder-pill-icon">📁</span>
                <div class="cp-folder-pill-text">
                  <span class="cp-folder-pill-label">Folder:</span>
                  <span class="cp-folder-pill-name" id="cp-folder-pill-name">${escapeHtml(currentFolderLabel)}</span>
                </div>
              </div>
              <span class="cp-folder-pill-action" id="cp-folder-pill-action">Change / + New ▾</span>
            </button>

            <div class="cp-folder-popover" id="cp-folder-popover">
              <div class="cp-folder-popover-header">
                <span class="cp-folder-popover-title">Target Pipeline Folder</span>
                <button type="button" class="cp-folder-popover-close" id="cp-folder-popover-close" title="Close">×</button>
              </div>

              <div class="cp-folder-list" id="cp-folder-list"></div>

              <div class="cp-folder-divider"></div>

              <button type="button" class="cp-folder-create-toggle" id="cp-folder-create-toggle">
                <span>+ Create New Folder</span>
              </button>

              <div class="cp-folder-create-form" id="cp-folder-create-form">
                <input type="text" id="cp-new-folder-name" class="cp-folder-input" placeholder="Folder name (e.g. 1, 102, Columbus)" autocomplete="off" />
                <input type="text" id="cp-new-folder-desc" class="cp-folder-input" placeholder="Description (optional)" autocomplete="off" />
                <div class="cp-folder-form-actions">
                  <button type="button" class="cp-folder-btn-cancel" id="cp-folder-btn-cancel">Cancel</button>
                  <button type="button" class="cp-folder-btn-submit" id="cp-folder-btn-create">Create &amp; Set Default</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Action Button with Large Accessible Hit Area -->
          <button class="cp-save-action-btn" id="cp-btn-save" title="Save to Choice Pipeline (Cmd/Ctrl+Shift+S)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Save to Pipeline</span>
          </button>

          <!-- Integrated Progress Box -->
          <div class="cp-progress-box" id="cp-progress-box">
            <div class="cp-progress-header">
              <span id="cp-progress-status">Uploading photos to ImageKit…</span>
              <span id="cp-progress-count">0%</span>
            </div>
            <div class="cp-progress-bar-track">
              <div class="cp-progress-bar-fill" id="cp-progress-fill"></div>
            </div>
          </div>

          <!-- Success State -->
          <div class="cp-success-box" id="cp-success-box">
            <div class="cp-success-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span id="cp-success-text">Saved to Choice Pipeline!</span>
            </div>
            <div class="cp-success-actions">
              <a class="cp-btn-secondary" id="cp-copy-link-btn" href="javascript:void(0)">Copy Link</a>
              <a class="cp-btn-primary-sm" id="cp-open-pipeline-btn" target="_blank" href="https://choice-properties-site.pages.dev/admin/pipeline.html">Open Pipeline ↗</a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    activeWidget = container;

    // ── Draggable Window Controller (Move anywhere on screen) ──
    var headerBar = container.querySelector('#cp-header-bar') || container.querySelector('.cp-header');
    var isDragging = false;
    var dragStartX = 0, dragStartY = 0;
    var initLeft = 0, initTop = 0;

    function handleDragStart(clientX, clientY, target) {
      if (target && target.closest('.cp-header-btn')) return;
      isDragging = true;
      dragStartX = clientX;
      dragStartY = clientY;
      var rect = container.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;
      container.classList.add('cp-dragging');
      container.style.transition = 'none';
      container.style.bottom = 'auto';
      container.style.right = 'auto';
      container.style.left = initLeft + 'px';
      container.style.top = initTop + 'px';
      container._userPositioned = true;
    }

    function handleDragMove(clientX, clientY) {
      if (!isDragging) return;
      var dx = clientX - dragStartX;
      var dy = clientY - dragStartY;
      var rect = container.getBoundingClientRect();
      var maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
      var maxTop = Math.max(8, window.innerHeight - rect.height - 8);
      var newLeft = Math.min(Math.max(8, initLeft + dx), maxLeft);
      var newTop = Math.min(Math.max(8, initTop + dy), maxTop);
      container.style.left = newLeft + 'px';
      container.style.top = newTop + 'px';
    }

    function handleDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      container.classList.remove('cp-dragging');
      container.style.transition = '';
    }

    if (headerBar) {
      headerBar.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        handleDragStart(e.clientX, e.clientY, e.target);
        e.preventDefault();
      });

      headerBar.addEventListener('touchstart', function (e) {
        if (e.touches && e.touches.length === 1) {
          handleDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }
      }, { passive: true });
    }

    window.addEventListener('mousemove', function (e) {
      if (isDragging) {
        handleDragMove(e.clientX, e.clientY);
        e.preventDefault();
      }
    });

    window.addEventListener('touchmove', function (e) {
      if (isDragging && e.touches && e.touches.length === 1) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);

    // Attach Event Listeners
    var minimizeBtn = container.querySelector('#cp-btn-minimize');
    var closeBtn = container.querySelector('#cp-btn-close');
    var expandTrigger = container.querySelector('#cp-expand-trigger');
    var toggleTrayBtn = container.querySelector('#cp-toggle-tray');
    var inspectorTray = container.querySelector('#cp-inspector-tray');
    var chevron = container.querySelector('#cp-chevron');
    var saveBtn = container.querySelector('#cp-btn-save');
    var copyLinkBtn = container.querySelector('#cp-copy-link-btn');

    // Folder UI Elements
    var folderPillBtn = container.querySelector('#cp-folder-pill-btn');
    var folderPillName = container.querySelector('#cp-folder-pill-name');
    var folderPillAction = container.querySelector('#cp-folder-pill-action');
    var folderPopover = container.querySelector('#cp-folder-popover');
    var folderPopoverClose = container.querySelector('#cp-folder-popover-close');
    var folderListEl = container.querySelector('#cp-folder-list');
    var folderCreateToggle = container.querySelector('#cp-folder-create-toggle');
    var folderCreateForm = container.querySelector('#cp-folder-create-form');
    var newFolderNameInput = container.querySelector('#cp-new-folder-name');
    var newFolderDescInput = container.querySelector('#cp-new-folder-desc');
    var folderBtnCancel = container.querySelector('#cp-folder-btn-cancel');
    var folderBtnCreate = container.querySelector('#cp-folder-btn-create');

    function closeFolderPopover() {
      if (!folderPopover) return;
      folderPopover.classList.remove('cp-open');
      if (folderCreateForm) folderCreateForm.classList.remove('cp-open');
      if (folderCreateToggle) folderCreateToggle.style.display = 'flex';
      if (folderPillAction) folderPillAction.textContent = 'Change / + New ▾';
    }

    function updateFolderPillDisplay() {
      var def = getDefaultFolderSync();
      if (def && (def.id || (def.name != null && String(def.name) !== ''))) {
        if (folderPillName) folderPillName.textContent = String(def.name);
        if (folderPillBtn) folderPillBtn.classList.add('cp-folder-active');
      } else {
        if (folderPillName) folderPillName.textContent = 'Main Inbox (Default)';
        if (folderPillBtn) folderPillBtn.classList.remove('cp-folder-active');
      }
    }

    function renderFolderList() {
      if (!folderListEl) return;
      var folders = getCachedFolders();
      var def = getDefaultFolderSync();
      var selectedId = def && def.id ? String(def.id) : '';
      var selectedName = def && def.name != null ? String(def.name) : '';

      var html = '';
      var isInboxSelected = !selectedId && !selectedName;
      html += '<button type="button" class="cp-folder-item ' + (isInboxSelected ? 'cp-selected' : '') + '" data-folder-id="" data-folder-name="">' +
        '<div class="cp-folder-item-main">' +
          '<div class="cp-folder-item-name">📥 Main Inbox (Default)</div>' +
          '<div class="cp-folder-item-desc">Unassigned pipeline staging</div>' +
        '</div>' +
        (isInboxSelected ? '<span class="cp-folder-item-check">✓</span>' : '') +
      '</button>';

      folders.forEach(function (f) {
        if (!f) return;
        var fId = f.id ? String(f.id) : '';
        var fName = f.name != null ? String(f.name) : '';
        var fDesc = f.description != null ? String(f.description) : '';
        var isSel = (selectedId && fId === selectedId) || (!selectedId && selectedName && fName === selectedName);
        html += '<button type="button" class="cp-folder-item ' + (isSel ? 'cp-selected' : '') + '" data-folder-id="' + escapeHtml(fId) + '" data-folder-name="' + escapeHtml(fName) + '" data-folder-desc="' + escapeHtml(fDesc) + '">' +
          '<div class="cp-folder-item-main">' +
            '<div class="cp-folder-item-name">' + escapeHtml(f.icon || '📁') + ' ' + escapeHtml(fName) + '</div>' +
            (fDesc ? '<div class="cp-folder-item-desc">' + escapeHtml(fDesc) + '</div>' : '') +
          '</div>' +
          (isSel ? '<span class="cp-folder-item-check">✓</span>' : '') +
        '</button>';
      });

      folderListEl.innerHTML = html;

      var items = folderListEl.querySelectorAll('.cp-folder-item');
      items.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var fId = btn.getAttribute('data-folder-id') || '';
          var fName = btn.getAttribute('data-folder-name') || '';
          var fDesc = btn.getAttribute('data-folder-desc') || '';
          if (!fId && !fName) {
            setDefaultFolder(null);
          } else {
            setDefaultFolder({ id: fId || null, name: fName, description: fDesc });
          }
          updateFolderPillDisplay();
          renderFolderList();
          closeFolderPopover();
        });
      });
    }

    renderFolderList();

    if (folderPillBtn) {
      folderPillBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = folderPopover && folderPopover.classList.contains('cp-open');
        if (isOpen) {
          closeFolderPopover();
        } else if (folderPopover) {
          renderFolderList();
          folderPopover.classList.add('cp-open');
          if (folderPillAction) folderPillAction.textContent = 'Close ▴';
        }
      });
    }

    if (folderPopoverClose) {
      folderPopoverClose.addEventListener('click', function (e) {
        e.stopPropagation();
        closeFolderPopover();
      });
    }

    if (folderCreateToggle) {
      folderCreateToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        folderCreateToggle.style.display = 'none';
        if (folderCreateForm) {
          folderCreateForm.classList.add('cp-open');
          if (newFolderNameInput) newFolderNameInput.focus();
        }
      });
    }

    if (folderBtnCancel) {
      folderBtnCancel.addEventListener('click', function (e) {
        e.stopPropagation();
        if (folderCreateForm) folderCreateForm.classList.remove('cp-open');
        if (folderCreateToggle) folderCreateToggle.style.display = 'flex';
      });
    }

    [newFolderNameInput, newFolderDescInput].forEach(function (inp) {
      if (!inp) return;
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          if (folderBtnCreate) folderBtnCreate.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeFolderPopover();
        }
      });
    });

    if (folderBtnCreate) {
      folderBtnCreate.addEventListener('click', async function (e) {
        e.stopPropagation();
        var rawName = newFolderNameInput ? String(newFolderNameInput.value) : '';
        var rawDesc = newFolderDescInput ? String(newFolderDescInput.value) : '';
        if (!rawName.length) {
          rawName = '1';
        }
        folderBtnCreate.disabled = true;
        folderBtnCreate.textContent = 'Creating…';
        try {
          var created = await apiCreateFolder(rawName, rawDesc);
          var folderObj = {
            id: created && created.id ? created.id : null,
            name: created && created.name != null ? String(created.name) : rawName,
            description: rawDesc,
            icon: '📁'
          };
          var existingList = getCachedFolders().filter(function (f) {
            return f && f.id !== folderObj.id && String(f.name) !== String(folderObj.name);
          });
          existingList.unshift(folderObj);
          setCachedFolders(existingList);
          setDefaultFolder(folderObj);
          updateFolderPillDisplay();
          renderFolderList();
          if (newFolderNameInput) newFolderNameInput.value = '';
          if (newFolderDescInput) newFolderDescInput.value = '';
          closeFolderPopover();
        } catch (err) {
          var fallbackObj = { id: null, name: rawName, description: rawDesc, icon: '📁' };
          var list = getCachedFolders();
          list.unshift(fallbackObj);
          setCachedFolders(list);
          setDefaultFolder(fallbackObj);
          updateFolderPillDisplay();
          renderFolderList();
          closeFolderPopover();
        } finally {
          folderBtnCreate.disabled = false;
          folderBtnCreate.textContent = 'Create & Set Default';
        }
      });
    }

    minimizeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      container.classList.add('cp-minimized');
      isMinimized = true;
    });

    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      removeWidget();
    });

    expandTrigger.addEventListener('click', function () {
      container.classList.remove('cp-minimized');
      isMinimized = false;
    });

    toggleTrayBtn.addEventListener('click', function () {
      isExpanded = !isExpanded;
      if (isExpanded) {
        inspectorTray.classList.add('cp-open');
        chevron.textContent = '▴';
      } else {
        inspectorTray.classList.remove('cp-open');
        chevron.textContent = '▾';
      }
    });

    saveBtn.addEventListener('click', handleSave);

    copyLinkBtn.addEventListener('click', function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href);
        copyLinkBtn.textContent = 'Copied! ✓';
        setTimeout(function () { copyLinkBtn.textContent = 'Copy Link'; }, 2500);
      }
    });

    updateWidgetPosition();

    // Sync Default Folder & Revalidate Folders in background
    (async function fetchFolders() {
      try {
        if (EXTENSION_API && EXTENSION_API.runtime && EXTENSION_API.runtime.sendMessage) {
          EXTENSION_API.runtime.sendMessage({ type: 'GET_DEFAULT_FOLDER' }, function (resp) {
            if (!EXTENSION_API.runtime.lastError && resp && resp.ok) {
              if (resp.defaultFolder && !activeDefaultFolder) {
                activeDefaultFolder = resp.defaultFolder;
                try { localStorage.setItem('cp_default_folder', JSON.stringify(activeDefaultFolder)); } catch (_) {}
                updateFolderPillDisplay();
                renderFolderList();
              }
              if (Array.isArray(resp.folders) && resp.folders.length > 0 && cachedFolders.length === 0) {
                setCachedFolders(resp.folders);
                renderFolderList();
              }
            }
          });
        }
        var foldersList = await apiListFolders();
        if (Array.isArray(foldersList) && foldersList.length > 0) {
          setCachedFolders(foldersList);
          var def = getDefaultFolderSync();
          if (def && !def.id && def.name != null) {
            var matched = foldersList.find(function (f) { return f && String(f.name) === String(def.name); });
            if (matched && matched.id) {
              setDefaultFolder({ id: matched.id, name: matched.name, description: matched.description || def.description });
            }
          }
          updateFolderPillDisplay();
          renderFolderList();
        }
      } catch (e) {}
    })();
  }

  // ── Save Execution Flow ─────────────────────────────────────
  async function handleSave() {
    if (isSaving) return;
    var saveBtn = document.querySelector('#cp-btn-save');
    var progressBox = document.querySelector('#cp-progress-box');
    var progressStatus = document.querySelector('#cp-progress-status');
    var progressCount = document.querySelector('#cp-progress-count');
    var progressFill = document.querySelector('#cp-progress-fill');
    var successBox = document.querySelector('#cp-success-box');
    var successText = document.querySelector('#cp-success-text');

    if (!saveBtn) return;
    isSaving = true;

    var openPopover = document.querySelector('#cp-folder-popover.cp-open');
    if (openPopover) {
      openPopover.classList.remove('cp-open');
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="cp-spinner"></span> <span>Saving to pipeline…</span>';
    saveBtn.style.background = '#6366f1';

    try {
      var extractor = window.CP_Extractors && window.CP_Extractors.detect(location.href);
      var extracted = currentExtractedData;
      if (!extracted && window.CP_Extractors) {
        extracted = window.CP_Extractors.extract(location.href, document);
      }

      if (!extracted) {
        setError('Could not extract listing');
        isSaving = false;
        return;
      }

      // Re-read before saving so a same-tab SPA navigation cannot submit the
      // previous property's data through a stale widget.
      var liveExtracted = extractCurrentListing();
      if (!liveExtracted) {
        setError('Listing is still loading');
        isSaving = false;
        return;
      }
      var liveSignature = extractionSignature(liveExtracted);
      if (renderedListingSignature && liveSignature !== renderedListingSignature) {
        currentExtractedData = liveExtracted;
        injectWidget(liveExtracted);
        setError('Listing changed; refreshed');
        isSaving = false;
        return;
      }

      var photoUrls = extractPhotoUrls(extracted.original_image_urls);
      if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
        photoUrls = extracted.photo_urls;
      }
      photoUrls = dedupePhotoUrls(photoUrls);

      var defaultFolder = getDefaultFolderSync();
      var selectedFolderId = defaultFolder && defaultFolder.id ? String(defaultFolder.id) : null;
      var selectedFolderName = defaultFolder && defaultFolder.name != null && String(defaultFolder.name) !== ''
        ? String(defaultFolder.name)
        : null;

      if (selectedFolderId || selectedFolderName) {
        setDefaultFolder({
          id: selectedFolderId,
          name: selectedFolderName || '',
          description: (defaultFolder && defaultFolder.description) || ''
        });
      }

      var rentVal = extracted.monthly_rent != null ? extracted.monthly_rent : extracted.rent;
      var bathsVal = extracted.bathrooms != null ? extracted.bathrooms : extracted.baths;
      var totalBathsVal = extracted.total_bathrooms != null ? extracted.total_bathrooms : bathsVal;

      var payload = {
        source: extracted.source || 'zillow',
        source_listing_id: extracted.source_listing_id,
        source_url: extracted.source_url || extracted.url || location.href,
        title: extracted.title,
        address: extracted.address,
        city: extracted.city,
        state: extracted.state,
        zip: extracted.zip,
        lat: extracted.lat,
        lng: extracted.lng,
        monthly_rent: rentVal,
        bedrooms: extracted.bedrooms != null ? extracted.bedrooms : extracted.beds,
        bathrooms: bathsVal,
        half_bathrooms: extracted.half_bathrooms,
        total_bathrooms: totalBathsVal,
        square_footage: extracted.square_footage != null ? extracted.square_footage : extracted.sqft,
        lot_size_sqft: extracted.lot_size_sqft != null ? extracted.lot_size_sqft : extracted.lot_sqft,
        year_built: extracted.year_built,
        floors: extracted.floors,
        garage_spaces: extracted.garage_spaces,
        total_units: extracted.total_units,
        property_type: extracted.property_type || 'APARTMENT',
        description: extracted.description,
        original_description: extracted.original_description || extracted.description,
        available_date: extracted.available_date,
        pets_allowed: true, // Choice Properties standard
        application_fee: 50, // Choice Properties standard
        security_deposit: rentVal,
        last_months_rent: extracted.last_months_rent,
        move_in_special: extracted.move_in_special,
        parking_fee: extracted.parking_fee,
        hoa_fee: extracted.hoa_fee,
        amenities: typeof extracted.amenities === 'string' ? extracted.amenities : JSON.stringify(extracted.amenities || []),
        appliances: typeof extracted.appliances === 'string' ? extracted.appliances : JSON.stringify(extracted.appliances || []),
        flooring: typeof extracted.flooring === 'string' ? extracted.flooring : (extracted.flooring ? JSON.stringify(extracted.flooring) : null),
        utilities_included: typeof extracted.utilities_included === 'string' ? extracted.utilities_included : JSON.stringify(extracted.utilities_included || []),
        parking: extracted.parking,
        heating_type: extracted.heating_type,
        cooling_type: extracted.cooling_type,
        laundry_type: extracted.laundry_type,
        has_basement: extracted.has_basement,
        has_central_air: extracted.has_central_air,
        neighborhood: extracted.neighborhood,
        county: extracted.county,
        location_context: extracted.location_context,
        virtual_tour_url: extracted.virtual_tour_url,
        agent_name: extracted.agent_name,
        broker_name: extracted.broker_name,
        listed_at: extracted.listed_at,
        folder_id: selectedFolderId,
        folder_name: selectedFolderName,
        original_image_urls: JSON.stringify(photoUrls.map(function (u) { return { url: u }; })),
        _import: 'browser-extension-v26.0.0-live',
      };

      if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
        isSaving = false;
        setError('Listing payload is too large');
        return;
      }

      // ── Step 1: Save property record first (Instant < 2s) ───
      var resp = await submitPayload(payload);

      if (resp && resp.queued) {
        saveBtn.style.display = 'none';
        if (successText) successText.textContent = 'Queued for pipeline sync';
        successBox.style.display = 'flex';
        isSaving = false;
      } else if (resp && resp.ok) {
        saveBtn.style.display = 'none';
        if (resp.folder && resp.folder.name != null) {
          if (resp.folder.folder_id) {
            setDefaultFolder({
              id: resp.folder.folder_id,
              name: String(resp.folder.name),
              description: (defaultFolder && defaultFolder.description) || ''
            });
          }
          if (successText) {
            successText.textContent = 'Saved to ' + resp.folder.name + (resp.folder.serial ? ' (#' + resp.folder.serial + ')' : '');
          }
        }
        if (resp.photos_queued && successText) {
          successText.textContent = (successText.textContent || 'Saved to Choice Pipeline') + ' • Photos processing';
        }
        successBox.style.display = 'flex';
        isSaving = false;
      } else if (resp && resp.duplicate) {
        isSaving = false;
        if (resp.folder && resp.folder.folder) {
          if (resp.folder.folder_id) {
            setDefaultFolder({
              id: resp.folder.folder_id,
              name: String(resp.folder.folder),
              description: (defaultFolder && defaultFolder.description) || ''
            });
          }
          saveBtn.innerHTML = '<span>Updated Folder (' + escapeHtml(String(resp.folder.folder).slice(0, 14)) + ')</span>';
          saveBtn.style.background = '#059669';
        } else {
          saveBtn.innerHTML = '<span>Already in Pipeline</span>';
          saveBtn.style.background = '#b45309';
        }
        setTimeout(function () {
          saveBtn.innerHTML = '<span>Save to Pipeline</span>';
          saveBtn.style.background = 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)';
          saveBtn.disabled = false;
        }, 4000);
      } else {
        isSaving = false;
        setError(resp && resp.error ? resp.error.slice(0, 45) : 'Save failed');
      }
    } catch (e) {
      console.error('[CP] handleSave error:', e);
      isSaving = false;
      setError('Network connection error');
    }
  }

  async function submitPayload(payload) {
    var lastResponse = null;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        if (EXTENSION_API && EXTENSION_API.runtime && EXTENSION_API.runtime.sendMessage) {
          lastResponse = await new Promise(function (resolve) {
            EXTENSION_API.runtime.sendMessage({
              type: 'UPLOAD_PAYLOAD',
              payload: payload,
              settings: { offlineQueue: true }
            }, function (response) {
              resolve(EXTENSION_API.runtime.lastError ? { ok: false, error: EXTENSION_API.runtime.lastError.message } : response);
            });
          });
        } else {
          var saveRes = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          lastResponse = await saveRes.json();
        }
        if (lastResponse && (lastResponse.ok || lastResponse.duplicate || lastResponse.queued)) return lastResponse;
      } catch (err) {
        lastResponse = { ok: false, error: err.message || 'Network connection error' };
      }
      if (attempt < 2) await new Promise(function (resolve) { setTimeout(resolve, 600 * (attempt + 1)); });
    }
    return lastResponse || { ok: false, error: 'Network connection error' };
  }

  function setError(msg) {
    var saveBtn = document.querySelector('#cp-btn-save');
    if (!saveBtn) return;
    saveBtn.innerHTML = '<span>Failed: ' + escapeHtml(msg) + '</span>';
    saveBtn.style.background = '#dc2626';
    saveBtn.disabled = false;
    setTimeout(function () {
      if (saveBtn) {
        saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Save to Pipeline</span>';
        saveBtn.style.background = 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)';
      }
    }, 4000);
  }

  // ── Photo Upload Pipeline ───────────────────────────────────
  async function uploadPhotosInBackground(photoUrls, progressCallback) {
    var uploaded = [];
    var failed = 0;
    var urls = dedupePhotoUrls(photoUrls);
    var limit = Math.min(urls.length, MAX_PHOTOS);
    var total = limit;

    for (var i = 0; i < limit; i += PHOTO_BATCH_SIZE) {
      var batch = urls.slice(i, i + PHOTO_BATCH_SIZE);
      if (progressCallback) progressCallback(Math.min(i, total), total);
      var results = await Promise.all(batch.map(function (url, batchIndex) {
        return uploadOnePhoto(url, i + batchIndex);
      }));
      for (var j = 0; j < results.length; j++) {
        if (results[j]) uploaded.push(results[j]);
        else failed++;
        if (progressCallback) progressCallback(Math.min(i + j + 1, total), total);
      }
    }
    return { uploaded: uploaded, failed: failed, total: total };
  }

  async function downloadViaBackground(url) {
    return new Promise(function (resolve) {
      try {
        if (!EXTENSION_API || !EXTENSION_API.runtime || !EXTENSION_API.runtime.sendMessage) {
          var requestId = 'cp-photo-' + Date.now() + '-' + Math.random().toString(36).slice(2);
          var timer = setTimeout(function () {
            window.removeEventListener('message', onResult);
            resolve(null);
          }, 25000);
          function onResult(event) {
            var data = event && event.data;
            if (event.source !== window || !data ||
                data.type !== 'CP_DOWNLOAD_PHOTO_RESULT' ||
                data.requestId !== requestId) return;
            clearTimeout(timer);
            window.removeEventListener('message', onResult);
            resolve(data.ok && data.dataUri ? data : null);
          }
          window.addEventListener('message', onResult);
          window.postMessage({ type: 'CP_DOWNLOAD_PHOTO', requestId: requestId, url: url }, '*');
          return;
        }
        EXTENSION_API.runtime.sendMessage(
          { type: 'DOWNLOAD_PHOTO', url: url },
          function (response) {
            var runtimeError = EXTENSION_API.runtime.lastError;
            if (runtimeError) {
              resolve(null);
              return;
            }
            resolve(response && response.ok && response.dataUri ? response : null);
          }
        );
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function downloadViaDirectFetch(url) {
    try {
      var imgRes = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Accept': 'image/jpeg,image/png,image/webp,image/*;q=0.8' }
      });
      if (!imgRes.ok) return null;
      var blob = await imgRes.blob();
      var base64 = await blobToBase64(blob);
      var ext = (blob.type || 'image/jpeg').split('/')[1] || 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
      return {
        dataUri: base64,
        contentType: blob.type || 'image/jpeg',
        ext: ext,
        size: blob.size,
      };
    } catch (e) {
      return null;
    }
  }

  async function uploadOnePhoto(url, index) {
    try {
      var photo = await downloadViaBackground(url);
      if (!photo) photo = await downloadViaDirectFetch(url);
      if (!photo) return null;

      var ikRes = await fetch('https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/pipeline-photo-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-import-secret': SECRET
        },
        body: JSON.stringify({
          fileData: photo.dataUri,
          fileName: 'photo_' + (index + 1) + '.' + photo.ext,
          folder: '/pipeline/temp'
        })
      });
      var ikData = await ikRes.json();
      if (!ikData || !ikData.url) return null;

      return {
        url: ikData.url,
        fileId: ikData.fileId || null,
        width: ikData.width || null,
        height: ikData.height || null,
      };
    } catch (e) {
      return null;
    }
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function updatePipelinePhotos(originalPayload, uploadedPhotos) {
    try {
      if (!uploadedPhotos || !uploadedPhotos.length) return;
      var updatePayload = Object.assign({}, originalPayload, {
        _update_photos_only: true,
        original_image_urls: JSON.stringify(uploadedPhotos),
      });
      await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
    } catch (e) {}
  }

  // ── Navigation & Lifecycle Watcher ──────────────────────────
  function hookHistoryMethods() {
    var rawPushState = history.pushState;
    var rawReplaceState = history.replaceState;

    history.pushState = function () {
      var result = rawPushState.apply(this, arguments);
      onPageChange();
      return result;
    };

    history.replaceState = function () {
      var result = rawReplaceState.apply(this, arguments);
      onPageChange();
      return result;
    };
  }

  function onPageChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      listingGeneration += 1;
      currentExtractedData = null;
      removeWidget();
      scheduleHydrationRefreshes();
    } else {
      scheduleListingRefresh();
      updateWidgetPosition();
    }
  }

  function setupWatchers() {
    hookHistoryMethods();
    window.addEventListener('popstate', onPageChange);
    window.addEventListener('resize', updateWidgetPosition);
    window.addEventListener('scroll', updateWidgetPosition, { passive: true });

    var observer = new MutationObserver(function () {
      scheduleListingRefresh();
      updateWidgetPosition();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ── Startup ─────────────────────────────────────────────────
  injectWidget();
  setupWatchers();
  scheduleHydrationRefreshes();
  console.log('[Choice Properties] Live extension UI v' + VERSION + ' active');
})();
