'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────
let _pendingPortalAppId = '';
let _resendTimer = null;

// HTML-escape any value that gets pasted into innerHTML. Anything from
// URL params (?email=, ?redirect=, etc.) MUST go through this — without it
// a crafted link like ?email=<img src=x onerror=…> would execute on the
// login page and could steal the session that the tenant is about to create.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Validates a "?redirect=" or "?next=" param so we don't get used as an
// open-redirect (e.g. /tenant/login.html?redirect=//evil.com phishing).
// Only same-origin tenant paths are allowed; everything else falls back
// to the portal home so the tenant always lands somewhere safe.
function sanitizeNext(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Must start with a single slash and not be a protocol-relative URL
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '';
  if (raw.includes('\\')) return '';
  // Only allow paths inside /tenant/. Reject /admin/, /landlord/, etc.
  if (!/^\/tenant\//.test(raw)) return '';
  return raw;
}

// Reads `?redirect=` first, then `?next=`, returns a sanitized path or ''.
function readNextParam() {
  const params = new URLSearchParams(window.location.search);
  return sanitizeNext(params.get('redirect') || params.get('next') || '');
}

async function waitForSB(maxMs) {
  const end = Date.now() + (maxMs || 8000);
  while (Date.now() < end) {
    if (window.supabase && typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) return true;
    await new Promise(r => setTimeout(r, 80));
  }
  return false;
}

// I-411: Singleton — multiple createClient() calls in the same page each spin
// up their own auth listener and refresh-token timer, causing one client to
// race the other on POST /auth/v1/token and silently invalidating the session
// (refresh token gets marked "already used"). Always reuse one instance.
let _sb = null;
function getSB() {
  if (_sb) return _sb;
  _sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE returns a refresh token so portal sessions don't drop after 1h.
      // Must match flowType in tenant/portal.html.
      flowType: 'pkce'
    }
  });
  // Keep the SDK's internal refresh-failure paths quiet by attaching at least
  // one listener (matches the pattern in js/cp-api.js).
  _sb.auth.onAuthStateChange(() => {});
  return _sb;
}

function showError(msg) {
  const el = document.getElementById('field-error');
  const input = document.getElementById('email');
  el.textContent = msg;
  el.classList.add('visible');
  input.focus();
}
function clearError() {
  const el = document.getElementById('field-error');
  el.classList.remove('visible');
}

function parseSBError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('email rate limit exceeded')) {
    return 'Too many requests. Please wait a minute before trying again.';
  }
  if (msg.includes('invalid email') || msg.includes('unable to validate')) {
    return 'That email address doesn\'t look valid. Please double-check it.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  return err?.message || 'Something went wrong. Please try again.';
}

function startResendCountdown(seconds) {
  const btn = document.getElementById('resend-btn');
  const cd = document.getElementById('resend-countdown');
  let remaining = seconds || 60;
  btn.disabled = true;
  cd.textContent = remaining;
  clearInterval(_resendTimer);
  _resendTimer = setInterval(() => {
    remaining--;
    cd.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(_resendTimer);
      btn.disabled = false;
      btn.textContent = 'Resend sign-in link';
      document.getElementById('resend-note').textContent = '';
    }
  }, 1000);
}

function showSuccessScreen(email) {
  document.getElementById('form-view').style.display = 'none';
  const sv = document.getElementById('success-view');
  sv.classList.add('visible');
  document.getElementById('success-email').textContent = email;
  startResendCountdown(60);
}

function resetToForm(prefillEmail) {
  clearInterval(_resendTimer);
  document.getElementById('success-view').classList.remove('visible');
  document.getElementById('form-view').style.display = '';
  const sendBtn = document.getElementById('send-btn');
  document.getElementById('btn-label').textContent = 'Send Sign-In Link';
  sendBtn.classList.remove('loading');
  sendBtn.disabled = false;
  clearError();
  if (prefillEmail) document.getElementById('email').value = prefillEmail;
  document.getElementById('signed-in-banner').classList.remove('visible');
  document.getElementById('login-form').style.display = 'block';
}

// ── Instant auto-login / fallback magic link ────────────────────────────────
async function performInstantAutoLogin(sb, ctx) {
  if (!sb || (!ctx.app_id && !ctx.app && !ctx.email)) return { ok: false };
  try {
    const res = await fetch('/api/tenant/auto-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.token_hash) return { ok: false, error: data.error || '' };
    const canonicalAppId = data.app_id || ctx.app_id || '';
    if (canonicalAppId) {
      try { sessionStorage.setItem('pendingPortalAppId', canonicalAppId); } catch (_) {}
    }
    try { await sb.auth.signOut(); } catch (_) {}
    const { data: otpData, error: otpErr } = await sb.auth.verifyOtp({
      token_hash: data.token_hash,
      type: data.verification_type || 'magiclink',
    });
    if (otpErr || !otpData?.session) return { ok: false, error: otpErr?.message || '' };
    return { ok: true, appId: canonicalAppId, session: otpData.session };
  } catch (e) {
    return { ok: false, error: e?.message || '' };
  }
}

async function sendMagicLink(emailOverride) {
  clearError();
  const emailEl = document.getElementById('email');
  const sendBtn = document.getElementById('send-btn');
  const rawInput = (emailOverride || emailEl.value || '').trim();
  const email = rawInput.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const rawAppId = (params.get('app_id') || params.get('id') || _pendingPortalAppId || sessionStorage.getItem('pendingPortalAppId') || '').trim();
  const appId = /^cp-/i.test(rawAppId) ? rawAppId.toUpperCase() : rawAppId;
  const looksLikeAppId = /^cp-/i.test(rawInput);

  if (!rawInput || (!looksLikeAppId && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    showError('Please enter a valid email address or Application ID.');
    return;
  }

  document.getElementById('btn-label').textContent = 'Opening Portal…';
  sendBtn.classList.add('loading');
  sendBtn.disabled = true;

  const ready = await waitForSB(6000);
  if (!ready) {
    document.getElementById('btn-label').textContent = 'Send Sign-In Link';
    sendBtn.classList.remove('loading');
    sendBtn.disabled = false;
    showError('Page failed to initialize. Please refresh and try again.');
    return;
  }

  try {
    const sb = getSB();
    const instant = await performInstantAutoLogin(
      sb,
      looksLikeAppId
        ? { app_id: rawInput.toUpperCase() }
        : { ...(appId ? { app_id: appId } : {}), email }
    );
    if (instant.ok) {
      const next = readNextParam();
      const targetApp = instant.appId || appId;
      const dest = next || ('/tenant/portal.html' + (targetApp ? '?app_id=' + encodeURIComponent(targetApp) : ''));
      window.location.replace(dest);
      return;
    }

    if (looksLikeAppId) {
      throw new Error(instant.error || 'No application found for that Reference ID.');
    }

    const { data: { session: existing } } = await sb.auth.getSession();
    if (existing && existing.user.email.toLowerCase() !== email) {
      await sb.auth.signOut().catch(() => {});
    }

    const redirectUrl = new URL('/tenant/portal.html', window.location.origin);
    if (appId) redirectUrl.searchParams.set('app_id', appId);
    const nextPath = readNextParam();
    if (nextPath) redirectUrl.searchParams.set('next', nextPath);

    let sentViaCustom = false;
    try {
      const fnUrl = `${CONFIG.SUPABASE_URL}/functions/v1/send-magic-link`;
      const resp = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email, redirectTo: redirectUrl.toString() }),
      });
      if (resp.ok) {
        sentViaCustom = true;
      } else if (resp.status === 429) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.message || 'Too many sign-in requests. Please wait a few minutes.');
      }
    } catch (customErr) {
      if (/Too many sign-in requests/.test(customErr.message || '')) throw customErr;
    }

    if (!sentViaCustom) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl.toString() },
      });
      if (error) throw error;
    }

    if (appId) sessionStorage.setItem('pendingPortalAppId', appId);
    showSuccessScreen(email);

  } catch (err) {
    document.getElementById('btn-label').textContent = 'Send Sign-In Link';
    sendBtn.classList.remove('loading');
    sendBtn.disabled = false;
    showError(parseSBError(err));
  }
}

async function signOutAndReset(prefillEmail) {
  try {
    const sb = getSB();
    await sb.auth.signOut();
  } catch (_) {}
  sessionStorage.removeItem('pendingPortalAppId');
  document.getElementById('signed-in-banner').classList.remove('visible');
  document.getElementById('wrong-account-notice').classList.remove('visible');
  document.getElementById('signout-btn').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('heading').textContent = 'Sign In';
  document.getElementById('subtitle').textContent = 'Enter your email to receive a secure sign-in link.';
  clearError();
  const params = new URLSearchParams(window.location.search);
  const emailParam = prefillEmail || params.get('email') || '';
  if (emailParam) document.getElementById('email').value = emailParam;
  document.getElementById('email').focus();
}

function goToPortal() {
  // If the tenant landed here via /tenant/login.html?redirect=/tenant/deposit.html
  // (or ?next=) — e.g. they were trying to use deposit.html or inspection.html
  // and got bounced because their session was missing — send them straight to
  // the page they were trying to reach instead of the portal home.
  const next = readNextParam();
  if (next) {
    window.location.href = next;
    return;
  }
  const portalUrl = new URL('/tenant/portal.html', window.location.origin);
  if (_pendingPortalAppId) portalUrl.searchParams.set('app_id', _pendingPortalAppId);
  window.location.href = portalUrl.pathname + portalUrl.search;
}

// ── Wire buttons ─────────────────────────────────────────────────────────────
document.getElementById('send-btn').addEventListener('click', () => sendMagicLink());
document.getElementById('email').addEventListener('keydown', e => { if (e.key === 'Enter') sendMagicLink(); });
document.getElementById('btn-continue').addEventListener('click', goToPortal);
document.getElementById('btn-switch').addEventListener('click', () => signOutAndReset());
document.getElementById('btn-switch-wrong').addEventListener('click', () => {
  const params = new URLSearchParams(window.location.search);
  signOutAndReset(params.get('email') || '');
});
document.getElementById('signout-btn').addEventListener('click', () => signOutAndReset());
document.getElementById('resend-btn').addEventListener('click', () => {
  const email = document.getElementById('success-email').textContent.trim();
  sendMagicLink(email);
});
document.getElementById('btn-wrong-email').addEventListener('click', () => {
  resetToForm('');
  document.getElementById('email').focus();
});

// ── Initialize — auto-login immediately when any app/email context exists ───
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  let localAppId = '';
  try {
    const rawLocal = localStorage.getItem('cpLastSubmittedApplication');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed?.app_id) localAppId = String(parsed.app_id).trim();
    }
  } catch (_) {}
  const rawAppId = (params.get('app_id') || params.get('id') || sessionStorage.getItem('pendingPortalAppId') || sessionStorage.getItem('lastSuccessAppId') || localAppId || '').trim();
  const appId = /^cp-/i.test(rawAppId) ? rawAppId.toUpperCase() : rawAppId;
  const appUuid = (params.get('app') || '').trim();
  const emailParam = (params.get('email') || '').trim();
  const nextDest = readNextParam();

  _pendingPortalAppId = appId;
  if (appId) sessionStorage.setItem('pendingPortalAppId', appId);
  if (emailParam) document.getElementById('email').value = emailParam;

  const initOverlay = document.getElementById('init-overlay');
  initOverlay.style.display = 'flex';
  document.getElementById('send-btn').disabled = true;

  const ready = await waitForSB(8000);
  if (!ready) {
    initOverlay.style.display = 'none';
    document.getElementById('send-btn').disabled = false;
    return;
  }

  const sb = getSB();

  // If we have app_id, app uuid, or email from a link or recent submission, log straight in and forward!
  if (appId || appUuid || emailParam) {
    const auto = await performInstantAutoLogin(sb, {
      ...(appId ? { app_id: appId } : {}),
      ...(appUuid ? { app: appUuid } : {}),
      ...(emailParam ? { email: emailParam.toLowerCase() } : {}),
    });
    if (auto.ok) {
      const targetApp = auto.appId || appId;
      const dest = nextDest || ('/tenant/portal.html' + (targetApp ? '?app_id=' + encodeURIComponent(targetApp) : ''));
      window.location.replace(dest);
      return;
    }
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (!userErr && userData?.user) {
      const dest = nextDest || ('/tenant/portal.html' + (appId ? '?app_id=' + encodeURIComponent(appId) : ''));
      window.location.replace(dest);
      return;
    }
    await sb.auth.signOut().catch(() => {});
  }

  initOverlay.style.display = 'none';
  document.getElementById('send-btn').disabled = false;
});
