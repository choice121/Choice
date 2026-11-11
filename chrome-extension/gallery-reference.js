(function () {
  'use strict';

  const SITE_CONFIG_URL = 'https://choice-properties-site.pages.dev/config.js';
  const FUNCTION_NAME = 'zillow-gallery-reference';
  const STORAGE_REFRESH_TOKEN = 'cp_extension_admin_refresh_token';
  const STORAGE_RECENT_REPORTS = 'cp_gallery_reference_recent_reports';

  const loginPanel = document.getElementById('gallery-reference-login');
  const connectedPanel = document.getElementById('gallery-reference-connected');
  const emailInput = document.getElementById('gallery-reference-email');
  const passwordInput = document.getElementById('gallery-reference-password');
  const loginButton = document.getElementById('gallery-reference-login-button');
  const captureButton = document.getElementById('gallery-reference-capture-button');
  const logoutButton = document.getElementById('gallery-reference-logout-button');
  const statusEl = document.getElementById('gallery-reference-status');
  const reportLink = document.getElementById('gallery-reference-link');
  const recentEl = document.getElementById('gallery-reference-recent');

  let projectConfigPromise;

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = kind || '';
  }

  function setConnected(connected) {
    loginPanel.hidden = connected;
    connectedPanel.hidden = !connected;
  }

  async function getProjectConfig() {
    if (!projectConfigPromise) {
      projectConfigPromise = (async function () {
        const response = await fetch(SITE_CONFIG_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error('Choice configuration could not be loaded');
        const source = await response.text();
        const url = source.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/)?.[1];
        const anonKey = source.match(/SUPABASE_ANON_KEY:\s*['"]([^'"]+)['"]/)?.[1];
        if (!url || !anonKey) throw new Error('Choice Supabase configuration is incomplete');
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'tlfmwetmhthpyrytrcfo.supabase.co') {
          throw new Error('Choice Supabase configuration did not match the expected project');
        }
        return { url: parsedUrl.origin, anonKey };
      })();
    }
    return projectConfigPromise;
  }

  async function sendBackgroundMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function getAccessToken() {
    const response = await sendBackgroundMessage({ type: 'GET_ADMIN_ACCESS_TOKEN' });
    if (!response?.ok || !response.accessToken) {
      throw new Error(response?.error || 'Connect your Choice admin account first');
    }
    return response.accessToken;
  }

  function collectGalleryState() {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        rect.bottom > 0 && rect.right > 0 &&
        rect.top < window.innerHeight && rect.left < window.innerWidth &&
        style.display !== 'none' && style.visibility !== 'hidden' &&
        Number(style.opacity) !== 0;
    };
    const roundedRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const short = (value, limit) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
    const images = [...document.images]
      .filter(visible)
      .map((image) => ({
        element: image,
        area: image.getBoundingClientRect().width * image.getBoundingClientRect().height,
      }))
      .filter(({ element }) => {
        const rect = element.getBoundingClientRect();
        return rect.width >= 120 && rect.height >= 80;
      })
      .sort((a, b) => b.area - a.area)
      .slice(0, 12);

    const ancestorNodes = [];
    for (const { element } of images) {
      for (let node = element, depth = 0; node && depth < 5; node = node.parentElement, depth++) {
        if (!ancestorNodes.includes(node) && visible(node)) ancestorNodes.push(node);
      }
    }

    const containers = ancestorNodes.slice(0, 32).map((element) => {
      const style = getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        role: short(element.getAttribute('role'), 40),
        classes: short(typeof element.className === 'string' ? element.className : '', 180),
        rect: roundedRect(element),
        styles: {
          display: style.display,
          position: style.position,
          gridTemplateColumns: style.gridTemplateColumns,
          gridTemplateRows: style.gridTemplateRows,
          flexDirection: style.flexDirection,
          gap: style.gap,
          borderRadius: style.borderRadius,
          objectFit: style.objectFit,
          objectPosition: style.objectPosition,
          aspectRatio: style.aspectRatio,
          overflow: style.overflow,
          backgroundColor: style.backgroundColor,
          zIndex: style.zIndex,
          alignItems: style.alignItems,
          justifyContent: style.justifyContent,
        },
      };
    });

    const photoControlPattern = /photo|image|gallery|picture|carousel/i;
    const navigationControlPattern = /^(?:close|next|previous|prev)(?:\s+photo)?$/i;
    const controls = [...document.querySelectorAll('button, [role="button"], [role="tab"]')]
      .filter(visible)
      .map((element) => ({
        element,
        label: short(element.innerText || element.value || '', 100),
        ariaLabel: short(element.getAttribute('aria-label'), 100),
        title: short(element.getAttribute('title'), 100),
        groupLabel: short(element.closest('[role="group"][aria-label]')?.getAttribute('aria-label'), 100),
      }))
      .filter(({ label, ariaLabel, title, groupLabel }) =>
        photoControlPattern.test(`${label} ${ariaLabel} ${title}`) ||
        navigationControlPattern.test(label) ||
        /^photo scenes$/i.test(groupLabel)
      )
      .slice(0, 30)
      .map(({ element, label, ariaLabel, title, groupLabel }) => ({
        tag: element.tagName.toLowerCase(),
        role: short(element.getAttribute('role'), 40),
        label,
        ariaLabel,
        title,
        groupLabel,
        rect: roundedRect(element),
        disabled: Boolean(element.disabled),
        expanded: short(element.getAttribute('aria-expanded'), 10),
      }));

    return {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      visibleImageCount: images.length,
      images: images.map(({ element }) => ({
        alt: short(element.alt, 160),
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
        rect: roundedRect(element),
      })),
      containers,
      controls,
    };
  }

  async function captureCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error('No active browser tab was found');
    const pageUrl = new URL(tab.url);
    if (!['www.zillow.com', 'm.zillow.com'].includes(pageUrl.hostname)) {
      throw new Error('Open one of the Zillow listing pages before capturing');
    }

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectGalleryState,
    });
    const snapshot = injected?.[0]?.result;
    if (!snapshot || !Array.isArray(snapshot.images) || snapshot.images.length === 0) {
      throw new Error('No visible gallery images were found. Wait for the gallery to load and try again');
    }

    const config = await getProjectConfig();
    const accessToken = await getAccessToken();
    const sourceUrl = `${pageUrl.origin}${pageUrl.pathname}`;
    const response = await fetch(`${config.url}/functions/v1/${FUNCTION_NAME}`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source_url: sourceUrl, snapshot }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !result.report_url) {
      if (response.status === 401) {
        await sendBackgroundMessage({ type: 'ADMIN_SIGN_OUT' });
        setConnected(false);
      }
      if (response.status === 403) {
        throw new Error('This Choice account is not authorized to save gallery references');
      }
      throw new Error(result.error || 'The gallery report could not be saved');
    }

    const recentData = await chrome.storage.local.get(STORAGE_RECENT_REPORTS);
    const recent = Array.isArray(recentData[STORAGE_RECENT_REPORTS])
      ? recentData[STORAGE_RECENT_REPORTS]
      : [];
    recent.unshift({
      url: result.report_url,
      source: sourceUrl,
      createdAt: result.created_at || new Date().toISOString(),
    });
    await chrome.storage.local.set({
      [STORAGE_RECENT_REPORTS]: recent.slice(0, 8),
    });
    renderRecentReports(recent.slice(0, 8));

    reportLink.href = result.report_url;
    reportLink.textContent = `Saved report ${result.report_id} — copy/share this link`;
    reportLink.style.display = 'block';
    setStatus('Gallery state saved to Choice Supabase.', 'success');
  }

  function renderRecentReports(reports) {
    recentEl.replaceChildren();
    if (!reports.length) return;
    const heading = document.createElement('p');
    heading.textContent = 'Recent saved reports';
    recentEl.append(heading);
    for (const report of reports) {
      const link = document.createElement('a');
      link.href = report.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${new URL(report.source).pathname} · ${new Date(report.createdAt).toLocaleDateString()}`;
      recentEl.append(link);
    }
  }

  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    setStatus('Connecting to Choice…');
    try {
      const session = await sendBackgroundMessage({
        type: 'ADMIN_SIGN_IN',
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });
      if (!session?.ok) throw new Error(session?.error || 'Choice sign-in failed');
      passwordInput.value = '';
      setConnected(true);
      setStatus('Connected. Pipeline imports and gallery reports are enabled.', 'success');
    } catch (error) {
      setStatus(String(error.message || error).slice(0, 180), 'error');
    } finally {
      loginButton.disabled = false;
    }
  });

  captureButton.addEventListener('click', async () => {
    captureButton.disabled = true;
    reportLink.style.display = 'none';
    setStatus('Measuring the visible gallery…');
    try {
      await captureCurrentTab();
    } catch (error) {
      setStatus(String(error.message || error).slice(0, 220), 'error');
    } finally {
      captureButton.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    await sendBackgroundMessage({ type: 'ADMIN_SIGN_OUT' });
    setConnected(false);
    setStatus('Disconnected from Choice.');
  });

  (async function initialize() {
    try {
      const [session, recentData] = await Promise.all([
        chrome.storage.local.get(STORAGE_REFRESH_TOKEN),
        chrome.storage.local.get(STORAGE_RECENT_REPORTS),
      ]);
      setConnected(Boolean(session[STORAGE_REFRESH_TOKEN]));
      renderRecentReports(Array.isArray(recentData[STORAGE_RECENT_REPORTS])
        ? recentData[STORAGE_RECENT_REPORTS]
        : []);
    } catch {
      setStatus('Extension storage is unavailable.', 'error');
    }
  })();
})();
