(function () {
  'use strict';

  function detectDeviceLabel() {
    const ua = navigator.userAgent || '';
    let os = 'Device';
    if (/iPhone/i.test(ua)) os = 'iPhone';
    else if (/iPad/i.test(ua)) os = 'iPad';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
    else if (/Windows/i.test(ua)) os = 'Windows PC';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = '';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua)) browser = 'Safari';

    return browser ? `${browser} on ${os}` : os;
  }

  function fmtDateShort(iso) {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch (_) {
      return String(iso);
    }
  }

  async function apiFetch(url, opts = {}) {
    const token = await CP.Auth.getAccessToken();
    if (!token) throw new Error('Admin session expired. Please sign in again.');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Requested-With': 'ChoiceAdmin',
      ...(opts.headers || {}),
    };
    const res = await fetch(url, {
      ...opts,
      credentials: 'include',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderDevices(S, listEl, devices, revokeAllBtn) {
    clearEl(listEl);
    const active = (devices || []).filter((d) => !d.revoked_at);
    if (revokeAllBtn) revokeAllBtn.style.display = active.length > 0 ? '' : 'none';

    if (!active.length) {
      const empty = document.createElement('div');
      empty.className = 'td-device-meta';
      empty.textContent = 'No trusted devices enabled yet.';
      listEl.appendChild(empty);
      return;
    }

    for (const d of active) {
      const row = document.createElement('div');
      row.className = 'td-device-item';

      const left = document.createElement('div');
      const titleLine = document.createElement('div');
      titleLine.style.fontWeight = '700';
      titleLine.style.fontSize = '.88rem';
      titleLine.textContent = d.label || 'Trusted Device';

      if (d.current_device) {
        const badge = document.createElement('span');
        badge.className = 'td-badge';
        badge.textContent = 'This device';
        titleLine.appendChild(badge);
      }
      if (d.failed_attempts > 0) {
        const warn = document.createElement('span');
        warn.className = 'td-badge td-badge-warn';
        warn.textContent = `${d.failed_attempts}/3 wrong taps`;
        titleLine.appendChild(warn);
      }

      const meta = document.createElement('div');
      meta.className = 'td-device-meta';
      meta.textContent = `Last used: ${fmtDateShort(d.last_used_at)} · Expires: ${fmtDateShort(d.expires_at)}`;

      left.appendChild(titleLine);
      left.appendChild(meta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost btn-sm';
      btn.textContent = 'Revoke';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Revoking…';
        try {
          await apiFetch('/api/admin/trusted-devices', {
            method: 'DELETE',
            body: JSON.stringify({ device_id: d.id }),
          });
          S.toast('Device quick login revoked', 'success');
          await refresh(S);
        } catch (err) {
          S.toast(err.message || 'Failed to revoke device', 'error');
          btn.disabled = false;
          btn.textContent = 'Revoke';
        }
      });

      row.appendChild(left);
      row.appendChild(btn);
      listEl.appendChild(row);
    }
  }

  async function refresh(S) {
    const section = document.getElementById('trusted-devices-section');
    const statusEl = document.getElementById('td-status-pill');
    const listEl = document.getElementById('td-device-list');
    const revokeAllBtn = document.getElementById('td-revoke-all-btn');
    const labelInput = document.getElementById('td-device-label');
    const submitBtn = document.getElementById('td-enable-btn');
    if (!section || !listEl) return;

    if (labelInput && !labelInput.value) {
      labelInput.value = detectDeviceLabel();
    }

    const msgEl = document.getElementById('td-msg');
    section.style.display = '';

    try {
      const [cookieRes, listRes] = await Promise.all([
        fetch('/api/admin/trusted-devices', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
        apiFetch('/api/admin/trusted-devices?list=1', { method: 'GET' }),
      ]);

      const enrolled = Boolean(cookieRes && cookieRes.enrolled);
      if (statusEl) {
        statusEl.textContent = enrolled ? 'Active on this device' : 'Not set up on this device';
        statusEl.className = enrolled ? 'td-badge' : 'td-badge td-badge-warn';
      }
      if (submitBtn) {
        submitBtn.textContent = enrolled ? 'Update 2-Digit PIN' : 'Enable 2-Digit Quick Login';
      }
      renderDevices(S, listEl, listRes.devices || [], revokeAllBtn);
    } catch (err) {
      console.warn('[trusted-devices] failed to load:', err);
      if (statusEl) {
        statusEl.textContent = 'Not set up on this device';
        statusEl.className = 'td-badge td-badge-warn';
      }
      if (msgEl && !msgEl.textContent) {
        msgEl.textContent = err.message || '';
      }
    }
  }

  function wire(S) {
    const form = document.getElementById('td-enroll-form');
    const pinInput = document.getElementById('td-pin-input');
    const labelInput = document.getElementById('td-device-label');
    const submitBtn = document.getElementById('td-enable-btn');
    const revokeAllBtn = document.getElementById('td-revoke-all-btn');
    const msgEl = document.getElementById('td-msg');

    if (pinInput) {
      pinInput.addEventListener('input', () => {
        pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 2);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (msgEl) msgEl.textContent = '';
        const pin = (pinInput?.value || '').trim();
        if (!/^\d{2}$/.test(pin)) {
          if (msgEl) msgEl.textContent = 'Enter exactly 2 numbers (00–99).';
          pinInput?.focus();
          return;
        }
        submitBtn.disabled = true;
        const prevText = submitBtn.textContent;
        submitBtn.textContent = 'Saving…';
        try {
          await apiFetch('/api/admin/trusted-devices', {
            method: 'POST',
            body: JSON.stringify({
              pin,
              label: (labelInput?.value || '').trim() || detectDeviceLabel(),
            }),
          });
          if (pinInput) pinInput.value = '';
          S.toast('2-Digit Quick Login enabled for this device!', 'success');
          if (msgEl) msgEl.textContent = 'Saved! Next time you open the login page on this device, just tap those 2 numbers.';
          await refresh(S);
        } catch (err) {
          if (msgEl) msgEl.textContent = err.message || 'Could not enable quick login.';
          S.toast(err.message || 'Could not enable quick login', 'error');
          submitBtn.textContent = prevText;
        } finally {
          submitBtn.disabled = false;
        }
      });
    }

    if (revokeAllBtn) {
      revokeAllBtn.addEventListener('click', async () => {
        revokeAllBtn.disabled = true;
        try {
          await apiFetch('/api/admin/trusted-devices', {
            method: 'DELETE',
            body: JSON.stringify({ all: true }),
          });
          S.toast('All trusted devices revoked', 'success');
          await refresh(S);
        } catch (err) {
          S.toast(err.message || 'Failed to revoke devices', 'error');
        } finally {
          revokeAllBtn.disabled = false;
        }
      });
    }
  }

  function waitForDepsAndInit(attempt = 0) {
    const shell = window.CPShell || window.AdminShell;
    const authReady = window.CP && window.CP.Auth && typeof window.CP.Auth.getAccessToken === 'function';
    if (!shell || !authReady) {
      if (attempt < 100) {
        setTimeout(() => waitForDepsAndInit(attempt + 1), 60);
      }
      return;
    }

    Promise.resolve(shell.ready || shell)
      .then(async (resolved) => {
        const S = resolved || shell;
        const okAuth = await S.requireAdmin();
        if (!okAuth) return;
        wire(S);
        await refresh(S);
      })
      .catch((err) => {
        console.warn('[trusted-devices] init failed:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForDepsAndInit(0));
  } else {
    waitForDepsAndInit(0);
  }
})();
