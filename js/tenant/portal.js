'use strict';

async function waitForSB(ms){
  const end=Date.now()+ms;
  while(Date.now()<end){
    if(window.supabase&&typeof CONFIG!=='undefined'&&CONFIG.SUPABASE_URL)return true;
    await new Promise(r=>setTimeout(r,80));
  }
  return false;
}

let _sb=null;
function getSB(){
  if(!_sb){
    _sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        // I-411: Was `true`. We manually parse all 3 magic-link URL shapes in
        // waitForMagicLinkSession() (hash tokens, token_hash, PKCE code). With
        // detectSessionInUrl ALSO on, the SDK silently consumed the hash on
        // load — then our manual setSession() raced it and one path always
        // failed, occasionally clearing the freshly-created session and
        // bouncing the user straight back to /tenant/login.html.
        detectSessionInUrl:false,
        // PKCE flow returns a refresh token so sessions survive past the 1-hour
        // JWT expiry — autoRefreshToken silently re-issues new access tokens.
        flowType:'pkce'
      }
    });
    // Quiets the SDK's internal background refresh failure logging.
    _sb.auth.onAuthStateChange(()=>{});
  }
  return _sb;
}

let _portalApplicants = [];
let _portalCredits = [];
let _portalDocs = [];
let _portalReceipts = [];
let _portalTransactions = [];
let _portalUserEmail = '';
let _receiptAccessToken = '';

function cacheReceiptToken(appId, token){
  if(!token) return;
  _receiptAccessToken = String(token);
  if(appId){
    try{ sessionStorage.setItem('cpReceiptToken:' + normalizePortalAppId(appId), _receiptAccessToken); }catch(_){}
  }
}

function readCachedReceiptToken(appId){
  if(_receiptAccessToken) return _receiptAccessToken;
  if(!appId) return '';
  try{ return sessionStorage.getItem('cpReceiptToken:' + normalizePortalAppId(appId)) || ''; }catch(_){ return ''; }
}

function buildReceiptUrl(app, opts){
  opts = opts || {};
  const appId = (app && app.app_id) || opts.app_id || '';
  const base = opts.receipt_id
    ? '/receipt.html?receipt_id=' + encodeURIComponent(opts.receipt_id) + (appId ? '&app_id=' + encodeURIComponent(appId) : '')
    : '/receipt.html?app_id=' + encodeURIComponent(appId)
      + '&type=' + encodeURIComponent(opts.type || 'application_fee')
      + (opts.applicant_id ? '&applicant_id=' + encodeURIComponent(opts.applicant_id) : '');
  const rt = readCachedReceiptToken(appId);
  return rt ? base + '#rt=' + encodeURIComponent(rt) : base;
}

async function autoSignInWithEndpoint(sb, opts){
  opts = opts || {};
  const payload = {};
  if(opts.appId) payload.app_id = opts.appId;
  if(opts.app) payload.app = opts.app;
  if(opts.applicantId) payload.applicant_id = opts.applicantId;
  if(opts.receiptId) payload.receipt_id = opts.receiptId;
  if(opts.email) payload.email = opts.email;
  if(!payload.app_id && !payload.app && !payload.receipt_id && !payload.email){
    return { ok:false, session:null, appId:'' };
  }
  try{
    const res = await fetch('/api/tenant/auto-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.ok || !data.token_hash){
      return { ok:false, session:null, appId: data.app_id || '', error: data.error || '' };
    }
    const resolvedAppId = normalizePortalAppId(data.app_id || opts.appId || '');
    if(resolvedAppId){
      try{ sessionStorage.setItem('pendingPortalAppId', resolvedAppId); }catch(_){}
    }
    if(data.receipt_access_token){
      cacheReceiptToken(resolvedAppId, data.receipt_access_token);
    }
    const { data: otpData, error: otpErr } = await sb.auth.verifyOtp({
      token_hash: data.token_hash,
      type: data.verification_type || 'magiclink',
    });
    if(otpErr || !otpData?.session){
      return { ok:false, session:null, appId: resolvedAppId, receiptToken: data.receipt_access_token || '', error: otpErr?.message || '' };
    }
    return { ok:true, session: otpData.session, appId: resolvedAppId, email: data.email || '', receiptToken: data.receipt_access_token || '' };
  }catch(e){
    return { ok:false, session:null, appId:'', error: e?.message || '' };
  }
}

function openExternalUrl(url){
  if(!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ try{ a.remove(); }catch(_){} }, 250);
}

function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function fmtDate(d){if(!d)return '—';try{return new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}catch{return d;}}
function fmtDateShort(d){if(!d)return '—';try{return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch{return d;}}
function fmtMoney(v){if(v==null)return '—';return '$'+Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}

function _isMissingColErr(err){
  const msg=String(err?.message||err?.details||err?.hint||'');
  const code=String(err?.code||'');
  return code==='PGRST204'||code==='42703'||/column .* does not exist|could not find the .* column/i.test(msg);
}
function formatPortalChannel(ch){
  if(!ch) return '';
  const map={ card:'Debit / Credit Card', cash_app:'Cash App', paypal:'PayPal', apple_pay:'Apple Pay', venmo:'Venmo' };
  return map[String(ch).toLowerCase()] || String(ch);
}
function resolvePortalPayState(app){
  const raw = String(app?.application_payment_state||'').trim();
  if(raw) return raw;
  const st = String(app?.payment_status||'unpaid').toLowerCase();
  if(st==='paid'||st==='waived') return 'Payment Confirmed';
  if(st==='refunded') return 'Fee Refunded';
  if(app?.external_payment_reference || app?.payment_submitted_at) return 'Payment Submitted for Verification';
  if(app?.selected_payment_method) return 'Payment Method Selected';
  if(app?.payment_assistance_required) return 'Payment Assistance Required';
  if(app?.payment_failure_reason) return 'Payment Unsuccessful';
  return 'Payment Required';
}
function isPortalPayConfirmed(state){
  return state==='Payment Confirmed' || state==='Payment Successful';
}
function isPortalPayFailed(state){
  return state==='Payment Unsuccessful' || state==='Payment Failed';
}
function normalizePortalRole(a){
  if(a?.is_primary) return 'primary';
  const raw=String(a?.applicant_type||a?.role||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  if(raw==='primary'||raw==='primary_applicant') return 'primary';
  if(raw==='guarantor'||raw==='non_occupying_guarantor') return 'guarantor';
  if(raw==='co_signer'||raw==='cosigner') return 'co_signer';
  return 'co_applicant';
}
function isPortalOccupyingRole(norm){
  return norm==='primary'||norm==='co_applicant';
}
function formatPortalRole(norm, rawRole){
  if(norm==='primary') return 'Primary Applicant';
  if(norm==='guarantor') return 'Guarantor (Non-Occupying)';
  if(norm==='co_signer') return 'Co-Signer';
  if(rawRole && String(rawRole).trim() && !/^(co[-_\s]?applicant)$/i.test(String(rawRole).trim())) return String(rawRole).trim();
  return 'Co-Applicant (Occupying)';
}
function parseMoneyVal(v){
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  const n=parseFloat(String(v??'').replace(/[$,\s]/g,''));
  return Number.isFinite(n)?n:0;
}
function calculatePortalFee(app, applicants){
  const list=Array.isArray(applicants)&&applicants.length ? applicants : null;
  const creditApplied = Boolean(app?.credit_applied_id);
  if(Array.isArray(app?.fee_breakdown)&&app.fee_breakdown.length){
    const total=app.application_fee!=null ? Number(app.application_fee) : app.fee_breakdown.reduce((s,r)=>s+(Number(r?.fee)||0),0);
    return { total, items:app.fee_breakdown };
  }
  if(!list){
    const extraCo=Math.max(0, Number(app?.co_applicant_count||(app?.has_co_applicant?1:0)));
    const perFee = creditApplied ? 0 : 50;
    const items=[{ label:'Primary Applicant', role:'primary', fee:perFee, note: creditApplied ? 'Application credit applied ($0)' : 'Primary applicant screening ($50)' }];
    for(let i=0;i<extraCo;i++){
      items.push({ label:'Household Member #'+(i+2), role:'co_applicant', fee:perFee, note: creditApplied ? 'Application credit applied ($0)' : 'Additional adult screening ($50)' });
    }
    const calc=(1+extraCo)*perFee;
    const total=app?.application_fee!=null ? Number(app.application_fee) : calc;
    return { total, items };
  }
  let total=0;
  const items=[];
  list.forEach((a,idx)=>{
    const norm=normalizePortalRole(a);
    const name=[a.first_name,a.last_name].filter(Boolean).join(' ').trim()||formatPortalRole(norm,a.role);
    const explicitFee = a.screening_fee_amount != null ? Number(a.screening_fee_amount) : null;
    const fee = creditApplied ? 0 : (Number.isFinite(explicitFee) ? explicitFee : 50);
    const note = creditApplied ? 'Application credit applied ($0)' : (idx===0||norm==='primary' ? 'Primary applicant screening ($50)' : formatPortalRole(norm,a.role)+' screening ($50)');
    total+=fee;
    items.push({ applicant_id:a.id||null, label:name, role:norm, roleLabel:formatPortalRole(norm,a.role), fee, note, payment_status:a.payment_status||null });
  });
  return { total: app?.application_fee!=null ? Number(app.application_fee) : total, items };
}
function getHouseholdPaymentMode(app){
  return app?.household_payment_mode === 'individual' ? 'individual' : 'centralized';
}
function calculateHouseholdPaymentRollup(app, applicants){
  const list = Array.isArray(applicants) ? applicants : [];
  const mode = getHouseholdPaymentMode(app);
  const feeCalc = calculatePortalFee(app, list);
  const totalFee = Number(app?.application_fee ?? feeCalc.total ?? 50);
  if (!list.length) {
    const appPaid = app?.payment_status === 'paid' || app?.payment_status === 'waived';
    const collected = Number(app?.payment_amount_collected ?? (appPaid ? totalFee : 0)) || 0;
    return {
      mode, totalFee, totalCollected: collected, remaining: Math.max(0, totalFee - collected),
      paidCount: appPaid ? 1 : 0, totalCount: 1, allPaid: appPaid || totalFee === 0,
    };
  }
  let paidCount = 0;
  let collected = 0;
  const appPaidOrWaived = app?.payment_status === 'paid' || app?.payment_status === 'waived';
  list.forEach((a, idx) => {
    const mFee = Number(a.screening_fee_amount ?? (feeCalc.items[idx]?.fee ?? 50));
    const mStatus = a.payment_status || (appPaidOrWaived ? app.payment_status : 'unpaid');
    if (mStatus === 'paid' || mStatus === 'waived') {
      paidCount++;
      collected += Number(a.payment_amount ?? (mStatus === 'waived' ? 0 : mFee));
    }
  });
  if (collected === 0 && Number(app?.payment_amount_collected || 0) > 0) {
    collected = Number(app.payment_amount_collected);
  }
  const allPaid = app?.payment_status === 'paid' || app?.payment_status === 'waived' || paidCount >= list.length;
  return {
    mode,
    totalFee,
    totalCollected: Math.min(totalFee, collected),
    remaining: Math.max(0, totalFee - collected),
    paidCount,
    totalCount: list.length,
    allPaid,
  };
}
function calculatePortalFinancials(app, applicants){
  const list=Array.isArray(applicants)?applicants:[];
  const primaryRow=list.find(a=>normalizePortalRole(a)==='primary');
  const primaryIncome=primaryRow
    ? parseMoneyVal(primaryRow.monthly_income)+parseMoneyVal(primaryRow.other_income)
    : parseMoneyVal(app?.monthly_income);
  let coAppIncome=0, guarantorSupport=0, coSignerSupport=0, occupyingAdults=list.length?0:(1+Number(app?.co_applicant_count||(app?.has_co_applicant?1:0))), guarantorCount=0, coSignerCount=0;
  if(list.length){
    list.forEach(a=>{
      const norm=normalizePortalRole(a);
      const inc=parseMoneyVal(a.monthly_income)+parseMoneyVal(a.other_income);
      if(norm==='primary'){ occupyingAdults++; }
      else if(norm==='co_applicant'){ occupyingAdults++; coAppIncome+=inc; }
      else if(norm==='guarantor'){ guarantorCount++; guarantorSupport+=inc; }
      else if(norm==='co_signer'){ coSignerCount++; coSignerSupport+=inc; }
    });
  }
  const hasAppCols=app?.household_monthly_income!=null||app?.guarantor_monthly_income!=null||app?.co_signer_monthly_income!=null;
  const hhIncome=app?.household_monthly_income!=null ? parseMoneyVal(app.household_monthly_income) : (primaryIncome+coAppIncome);
  const gSup=app?.guarantor_monthly_income!=null ? parseMoneyVal(app.guarantor_monthly_income) : guarantorSupport;
  const csSup=app?.co_signer_monthly_income!=null ? parseMoneyVal(app.co_signer_monthly_income) : coSignerSupport;
  const totalSupport=app?.total_financial_support!=null ? parseMoneyVal(app.total_financial_support) : (hhIncome+gSup+csSup);
  return {
    primaryIncome,
    coAppIncome,
    householdIncome: hhIncome,
    guarantorSupport: gSup,
    coSignerSupport: csSup,
    totalFinancialSupport: totalSupport,
    occupyingAdults: app?.occupying_adult_count!=null ? Number(app.occupying_adult_count) : occupyingAdults,
    guarantorCount: app?.guarantor_count!=null ? Number(app.guarantor_count) : guarantorCount,
    coSignerCount: app?.co_signer_count!=null ? Number(app.co_signer_count) : coSignerCount,
    hasBreakdown: hasAppCols || list.some(a=>a.monthly_income!=null||a.other_income!=null||normalizePortalRole(a)==='guarantor'||normalizePortalRole(a)==='co_signer')
  };
}

// ── Time-of-day greeting (used by the property hero) ─────────────────────────
function greetingFor(name){
  const h = new Date().getHours();
  const t = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? t + ', ' + name : t;
}

// ── Relative time (Twitter-style) ────────────────────────────────────────────
function relTime(d){
  if(!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  if(isNaN(ms)) return '';
  const s = Math.floor(ms/1000);
  if(s < 45)   return 'just now';
  if(s < 90)   return '1 min ago';
  const m = Math.floor(s/60);
  if(m < 45)   return m + ' min ago';
  if(m < 90)   return '1 hour ago';
  const h = Math.floor(m/60);
  if(h < 24)   return h + ' hours ago';
  if(h < 36)   return 'yesterday';
  const days = Math.floor(h/24);
  if(days < 7) return days + ' days ago';
  return fmtDateShort(d);
}

// ── Toast notifications ──────────────────────────────────────────────────────
function showToast(msg, kind, opts){
  kind = kind || 'info';
  opts = opts || {};
  const stack = document.getElementById('toast-stack');
  if(!stack) return;
  const iconMap = {success:'i-check', warn:'i-clock', danger:'i-x', info:'i-bell'};
  const icon = opts.icon || iconMap[kind] || 'i-bell';
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.setAttribute('role', kind === 'danger' || kind === 'warn' ? 'alert' : 'status');
  el.innerHTML = '<svg class="ico"><use href="#' + esc(icon) + '"/></svg><span>' + esc(msg) + '</span>';
  stack.appendChild(el);
  const dur = opts.duration || 3800;
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => { try{ stack.removeChild(el); }catch(_){} }, 280);
  }, dur);
}

// ── Theme management (light / auto / dark) ───────────────────────────────────
const THEME_KEY = 'cp-theme';
function applyTheme(mode){
  const root = document.documentElement;
  let resolved = mode;
  if(mode === 'auto'){
    resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', resolved);
  document.querySelectorAll('.theme-toggle button').forEach(b => {
    b.dataset.active = (b.dataset.mode === mode) ? '1' : '0';
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1020' : '#ffffff');
}
function initTheme(){
  const saved = (function(){ try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch(_) { return 'auto'; }})();
  // Inject the floating toggle (only if not already there)
  if(!document.querySelector('.theme-toggle')){
    const wrap = document.createElement('div');
    wrap.className = 'theme-toggle';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Theme');
    wrap.innerHTML =
      '<button type="button" data-theme-mode="light" aria-label="Light mode"><svg class="ico"><use href="#i-sun"/></svg></button>' +
      '<button type="button" data-theme-mode="auto"  aria-label="Auto theme"><svg class="ico"><use href="#i-spark"/></svg></button>' +
      '<button type="button" data-theme-mode="dark"  aria-label="Dark mode"><svg class="ico"><use href="#i-moon"/></svg></button>';
    document.body.appendChild(wrap);
    wrap.querySelectorAll('button').forEach(b => {
      b.dataset.mode = b.dataset.themeMode;
      b.addEventListener('click', () => {
        const m = b.dataset.themeMode;
        try { localStorage.setItem(THEME_KEY, m); } catch(_) {}
        applyTheme(m);
      });
    });
  }
  applyTheme(saved);
  // Re-apply when the OS theme changes (only relevant when in 'auto' mode)
  if(window.matchMedia){
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener && mq.addEventListener('change', () => {
        const cur = (function(){ try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch(_) { return 'auto'; }})();
        if(cur === 'auto') applyTheme('auto');
      });
    } catch(_) {}
  }
}

// ── Property fetch (photo + beds/baths) ──────────────────────────────────────
async function fetchProperty(propertyId){
  if(!propertyId) return null;
  try{
    const sb = getSB();
    const { data, error } = await sb
      .from('properties')
      .select('id,address,city,state,zip,bedrooms,bathrooms,property_type,property_photos(url,display_order)')
      .eq('id', propertyId)
      .maybeSingle();
    if(error || !data) return null;
    let photo = null;
    if(Array.isArray(data.property_photos) && data.property_photos.length){
      const sorted = data.property_photos.slice().sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      photo = sorted[0]?.url || null;
    }
    return { ...data, _photo: photo };
  } catch(_) { return null; }
}

// ── Property hero render ─────────────────────────────────────────────────────
function renderPropertyHero(app, prop){
  const first = (app.first_name || '').trim();
  const greet = greetingFor(first);
  const photo = prop?._photo;
  const addr  = app.property_address ||
    [prop?.address, prop?.city && (prop.city + (prop.state ? ', ' + prop.state : ''))]
      .filter(Boolean).join(', ') || 'Your future home';
  const bedTxt  = prop?.bedrooms != null ? (prop.bedrooms + (prop.bedrooms === 1 ? ' bed' : ' beds')) : '';
  const bathTxt = prop?.bathrooms != null ? (prop.bathrooms + (prop.bathrooms === 1 ? ' bath' : ' baths')) : '';
  const stats = (bedTxt || bathTxt) ?
    '<div class="prop-hero-stats">' +
      (bedTxt  ? '<span><svg class="ico"><use href="#i-bed"/></svg>'  + esc(bedTxt)  + '</span>' : '') +
      (bathTxt ? '<span><svg class="ico"><use href="#i-bath"/></svg>' + esc(bathTxt) + '</span>' : '') +
    '</div>' : '';
  const imgPart = photo
    ? '<img class="prop-hero-img" src="' + esc(photo) + '" alt="' + esc(addr) + '" loading="eager" decoding="async" data-hero-fallback="1">'
    : '<div class="prop-hero-img is-placeholder">Your future home</div>';
  return '' +
    '<div class="prop-hero">' +
      imgPart +
      '<div class="prop-hero-overlay">' +
        '<div class="prop-hero-greet">' + esc(greet) + '</div>' +
        '<div class="prop-hero-title">Your application for this home is in motion.</div>' +
        '<div class="prop-hero-addr"><svg class="ico"><use href="#i-pin"/></svg>' + esc(addr) + '</div>' +
        stats +
      '</div>' +
    '</div>';
}

// ── Activity feed builder (synthesized from app date fields) ────────────────
function buildActivity(app){
  const items = [];
  const push = (when, kind, dot, text, sub) => {
    if(!when) return;
    items.push({ when: new Date(when), kind, dot, text, sub: sub || '' });
  };

  push(app.created_at, 'submit',  'success', 'Application submitted',
       'We received your rental application and locked in your place in the queue.');

  const actPayState = resolvePortalPayState(app);
  if(app.payment_status === 'paid' || app.payment_status === 'waived'){
    push(app.payment_date || app.payment_confirmed_at, 'fee', 'success',
      app.payment_status === 'waived' ? 'Application fee waived' : 'Payment Confirmed',
      'All required screening fees are complete.');
  } else if(actPayState === 'Payment Submitted for Verification'){
    const chLabel = formatPortalChannel(app.selected_payment_method) || 'Alternative method';
    push(app.payment_submitted_at || app.updated_at, 'fee-verify', 'info', 'Payment submitted for verification',
      `${chLabel} confirmation submitted${app.external_payment_reference ? ' (Ref: ' + app.external_payment_reference + ')' : ''}. Leasing Desk will verify receipt.`);
  } else if(actPayState === 'Payment Method Selected'){
    const chLabel = formatPortalChannel(app.selected_payment_method) || 'Alternative method';
    push(app.updated_at, 'fee-method', 'info', 'Payment method selected',
      `${chLabel} selected — complete payment externally or return to payment options.`);
  } else if(actPayState === 'Payment Cancelled'){
    push(app.updated_at, 'fee-cancel', 'warn', 'Payment cancelled',
      'Your application remains saved. Return to the payment page anytime to choose a payment method.');
  } else if(isPortalPayFailed(actPayState)){
    push(app.updated_at, 'fee-fail', 'warn', 'Payment Unsuccessful',
      app.payment_failure_reason || 'Please choose an available payment method to complete your application fee.');
  } else if(app.payment_assistance_required || actPayState === 'Payment Assistance Required'){
    push(app.updated_at, 'fee-help', 'warn', 'Payment Assistance Required',
      'Our leasing support team is available at 707-706-3137.');
  }

  if(app.holding_fee_requested){
    push(app.updated_at, 'hf-req', 'warn', 'Holding fee requested',
      'A holding fee was requested to reserve your unit.');
  }
  if(app.holding_fee_paid && app.holding_fee_paid_at){
    push(app.holding_fee_paid_at, 'hf-paid', 'success', 'Holding fee received',
      'Your unit is now held for you.');
  }

  if(app.status === 'under_review'){
    push(app.updated_at, 'review', 'info', 'Under Review',
      'Our underwriting team is actively reviewing your application.');
  }
  if(app.status === 'additional_info_required'){
    push(app.updated_at, 'info-req', 'warn', 'Additional Information Required',
      app.additional_info_note || 'Please upload the requested information or documents below.');
  }
  if(app.status === 'approved'){
    push(app.updated_at, 'approved', 'success', 'Application Approved',
      'Congratulations — your application was approved.');
  }
  if(app.status === 'denied'){
    push(app.updated_at, 'denied', 'warn', 'Not Approved', 'Your application was not approved for this property.');
  }
  if(app.status === 'waitlisted'){
    push(app.updated_at, 'wait', 'purple', 'Added to the waitlist',
      'We will contact you the moment a unit opens up.');
  }
  if(app.status === 'withdrawn'){
    push(app.updated_at, 'wd', 'info', 'Application withdrawn', '');
  }

  if(app.lease_sent_date){
    push(app.lease_sent_date, 'lease-sent', 'info', 'Lease ready to sign',
      'Your lease was generated and sent for signature.');
  }
  if(app.lease_signed_date && (app.lease_status === 'signed' || app.lease_status === 'co_signed' || app.lease_status === 'awaiting_co_sign')){
    push(app.lease_signed_date, 'lease-signed', 'success', 'Lease signed',
      app.lease_status === 'awaiting_co_sign' ? 'Waiting for all required household signers to sign.' : 'Lease executed.');
  }

  if(app.move_in_date_actual && (app.move_in_status === 'confirmed' || app.move_in_status === 'completed')){
    push(app.move_in_date_actual, 'movein', 'success',
      app.move_in_status === 'completed' ? 'Move-in completed' : 'Move-in confirmed',
      'Welcome home.');
  }

  if(app.admin_notes){
    push(app.updated_at, 'note', 'info', 'A note from our team',
      app.admin_notes.length > 90 ? app.admin_notes.slice(0,87) + '…' : app.admin_notes);
  }

  // Most recent first; cap at 8 to keep the card focused.
  items.sort((a,b) => b.when - a.when);
  return items.slice(0, 8);
}

function renderActivityFeed(app){
  const items = buildActivity(app);
  if(!items.length) return '';
  const dotIcon = {
    success:'i-check', info:'i-bell', warn:'i-clock', purple:'i-bell'
  };
  const rows = items.map(it => {
    return '<li class="activity-item">' +
      '<span class="activity-dot ' + esc(it.dot) + '"><svg class="ico"><use href="#' + esc(dotIcon[it.dot]||'i-bell') + '"/></svg></span>' +
      '<div class="activity-body">' +
        '<div class="activity-text">' + esc(it.text) + '</div>' +
        (it.sub ? '<div class="activity-sub">' + esc(it.sub) + '</div>' : '') +
        '<div class="activity-time" title="' + esc(fmtDate(it.when)) + '">' + esc(relTime(it.when)) + '</div>' +
      '</div>' +
    '</li>';
  }).join('');
  return '<div class="activity">' +
    '<div class="activity-card">' +
      '<div class="activity-head">' +
        '<div class="activity-head-l">' +
          '<div class="activity-title">Activity</div>' +
        '</div>' +
        '<span class="live-pill" id="live-pill" data-state="off" title="Live updates">Live</span>' +
      '</div>' +
      '<ul class="activity-list">' + rows + '</ul>' +
    '</div>' +
  '</div>';
}

// ── Realtime: subscribe to this application's row for instant updates ───────
let _rtChannel = null;
function setupRealtime(sb, appPk, onChange){
  try{
    if(_rtChannel){ try { sb.removeChannel(_rtChannel); } catch(_) {} _rtChannel = null; }
    if(!appPk) return;
    _rtChannel = sb.channel('portal-app-' + appPk)
      .on('postgres_changes',
          { event:'UPDATE', schema:'public', table:'applications', filter:'id=eq.'+appPk },
          (payload) => { try { onChange && onChange(payload); } catch(_) {} })
      .subscribe((status) => {
        const pill = document.getElementById('live-pill');
        if(!pill) return;
        if(status === 'SUBSCRIBED'){
          pill.dataset.state = 'on';
          pill.title = 'Receiving live updates';
        } else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'){
          pill.dataset.state = 'off';
          pill.title = 'Live updates unavailable — refresh to see latest';
        }
      });
  } catch(_) {}
}

// ── Drag & drop on the doc card (desktop only via CSS visibility) ───────────
function setupDropzone(){
  const dz = document.getElementById('doc-dropzone');
  if(!dz) return;
  const onOver = (e) => { e.preventDefault(); dz.dataset.active = '1'; };
  const onLeave = () => { dz.dataset.active = '0'; };
  const onDrop = (e) => {
    e.preventDefault();
    dz.dataset.active = '0';
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if(!files.length) return;
    // Phase 2 — Single file: route to first empty required slot (legacy
    // behaviour). Multiple files: dump them all into the "other" bucket
    // as a single batched upload (the upload pipeline will fan them out
    // in parallel). We can't reliably auto-classify multiple files at
    // once and putting them all in one slot at least keeps them grouped.
    if(files.length === 1){
      routeDroppedFile(files[0]);
    } else {
      routeDroppedFiles(files, 'other');
    }
  };
  dz.addEventListener('dragover', onOver);
  dz.addEventListener('dragenter', onOver);
  dz.addEventListener('dragleave', onLeave);
  dz.addEventListener('drop', onDrop);
}
function routeDroppedFile(file){
  // Find first empty required slot, else 'other'.
  const cards = document.querySelectorAll('.doc-check[data-state="required"]');
  const target = cards[0] || document.querySelector('.doc-check[data-state="optional"]');
  if(!target) return;
  const input = target.querySelector('input[type=file][data-doc-type]');
  if(!input) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles:true }));
  showToast('Uploading ' + file.name + '…', 'info', { icon:'i-upload-cloud' });
}
function routeDroppedFiles(files, preferredType){
  // Find the input matching the preferred doc type (default 'other'); if
  // missing, just pick the first input that exists.
  let input = document.querySelector('input[type=file][data-doc-type="' + preferredType + '"]')
           || document.querySelector('input[type=file][data-doc-type]');
  if(!input) return;
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles:true }));
  showToast('Uploading ' + files.length + ' files…', 'info', { icon:'i-upload-cloud' });
}

async function signOut(){
  try { await getSB().auth.signOut(); } catch(_) {}
  sessionStorage.removeItem('pendingPortalAppId');
  sessionStorage.removeItem('lastSuccessAppId');
  location.href = '/tenant/portal.html?signed_out=1';
}

async function lookupByAppId(){
  const input=document.getElementById('manual-app-id');
  const msg=document.getElementById('appid-msg');
  if(!input||!msg)return;
  const raw=(input.value||'').trim();
  const isEmail=raw.includes('@');
  const appId=isEmail?'':normalizePortalAppId(raw);
  if(!raw){msg.textContent='Please enter your Application ID or email.';msg.style.color='#a16207';msg.style.display='block';return;}
  msg.textContent='Opening application…';msg.style.color='var(--muted)';msg.style.display='block';
  try{
    const sb=getSB();
    if(!isEmail){
      const {data:{session}}=await sb.auth.getSession();
      const userEmail=(session?.user?.email||'').toLowerCase();
      if(userEmail){
        const {data:claimResult,error:claimErr}=await sb.rpc('claim_application',{p_app_id:appId,p_email:userEmail});
        if(!claimErr&&claimResult?.success!==false){
          sessionStorage.setItem('pendingPortalAppId',appId);
          location.href='/tenant/portal.html?app_id='+encodeURIComponent(appId);
          return;
        }
      }
    }
    try{await sb.auth.signOut();}catch(_){}
    const autoRes=await autoSignInWithEndpoint(sb,isEmail?{email:raw.toLowerCase()}:{appId});
    if(autoRes.ok&&autoRes.appId){
      sessionStorage.setItem('pendingPortalAppId',autoRes.appId);
      location.href='/tenant/portal.html?app_id='+encodeURIComponent(autoRes.appId);
      return;
    }
    if(!isEmail){
      const guestOk=await loadGuestApplication(appId);
      if(guestOk)return;
    }
    msg.textContent=autoRes.error||'No matching application was found. Check your Application ID or email, or contact 707-706-3137.';
    msg.style.color='#b91c1c';msg.style.display='block';
  }catch(e){
    msg.textContent='Error: '+(e.message||'Could not look up application.');
    msg.style.color='#b91c1c';msg.style.display='block';
  }
}

// ── Payment status rendering ─────────────────────────────────────────────────
function renderPaymentStatus(app){
  const status=app.payment_status||'unpaid';
  const rollup=calculateHouseholdPaymentRollup(app,_portalApplicants);
  const mode=rollup.mode;
  const payState=resolvePortalPayState(app);
  const feeCalc=calculatePortalFee(app,_portalApplicants);
  const fee=rollup.totalFee;
  const paid=status==='paid';
  const waived=status==='waived';
  const refunded=status==='refunded';
  const currentUserApp = Array.isArray(_portalApplicants)
    ? (_portalApplicants.find(a=>(a.email||'').toLowerCase()===(_portalUserEmail||'').toLowerCase()) || _portalApplicants.find(a=>a.is_primary) || _portalApplicants[0])
    : null;
  const userNeedsIndividualPay = mode==='individual' && currentUserApp && currentUserApp.payment_status!=='paid' && currentUserApp.payment_status!=='waived';
  const payUrl='/apply/pay.html?app_id='+encodeURIComponent(app.app_id||'')
    + (mode==='individual' && currentUserApp?.id ? '&applicant_id='+encodeURIComponent(currentUserApp.id) : '');

  const modeLabel = mode==='individual'
    ? 'Option B · Each Household Member Pays Own $50 Share'
    : 'Option A · Primary Applicant Pays Full Household Total';
  const pct = rollup.totalFee > 0 ? Math.min(100, Math.round((rollup.totalCollected / rollup.totalFee) * 100)) : (rollup.allPaid ? 100 : 0);
  const householdProgressHtml = (rollup.totalCount > 1 || mode === 'individual')
    ? `<div class="hh-progress-box">
        <div class="hh-progress-head">
          <span>${esc(modeLabel)}</span>
          <span>${fmtMoney(rollup.totalCollected)} / ${fmtMoney(rollup.totalFee)} (${rollup.paidCount}/${rollup.totalCount} Paid)</span>
        </div>
        <div class="hh-progress-track"><div class="hh-progress-fill" style="width:${pct}%"></div></div>
      </div>`
    : '';

  const breakdownHtml = feeCalc.items.length > 0
    ? `<div style="margin:10px 0 12px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--hairline);border-radius:var(--r-sm);font-size:.77rem">
        <div style="font-weight:700;margin-bottom:6px;color:var(--text)">Per-Adult Screening Fee Schedule ($50 / Screened Adult)</div>
        ${feeCalc.items.map((it,idx)=>{
          const appRow = Array.isArray(_portalApplicants) ? (_portalApplicants.find(a=>a.id===it.applicant_id) || _portalApplicants[idx]) : null;
          const mPaid = appRow?.payment_status==='paid' || appRow?.payment_status==='waived' || paid || waived;
          const mStatusTag = mPaid ? ' <span style="color:#15803d;font-weight:700">&middot; Paid</span>' : (mode==='individual' ? ' <span style="color:#a16207;font-weight:600">&middot; Due</span>' : '');
          return `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;color:var(--muted)">
            <span>${esc(it.label||it.name)}${it.roleLabel&&it.roleLabel!==(it.label||it.name)?' ('+esc(it.roleLabel)+')':''}${mStatusTag}</span>
            <strong style="color:var(--text)">${Number(it.fee)===0?'$0.00 (Credit/Waived)':fmtMoney(it.fee)}</strong>
          </div>`;
        }).join('')}
      </div>`
    : '';

  const receiptsListHtml = (_portalReceipts && _portalReceipts.length)
    ? `<div style="margin-top:14px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px">Payment Receipts</div>
        <div class="receipt-list">
          ${_portalReceipts.map(r=>{
            const rUrl = r.id
              ? buildReceiptUrl(app, { receipt_id: r.id })
              : buildReceiptUrl(app, { type: r.receipt_type || 'application_fee', applicant_id: r.applicant_id || '' });
            return `<div class="receipt-row">
              <div>
                <div style="font-weight:600;color:var(--text)">${esc(r.receipt_number || 'Official Receipt')} · ${fmtMoney(r.amount)}</div>
                <div class="tx-meta">${esc(r.payment_method || 'Card')} · ${fmtDateShort(r.paid_at || r.issued_at)}${r.transaction_ref?' · Ref '+esc(r.transaction_ref):''}</div>
              </div>
              <a class="member-pay-btn" href="${rUrl}" target="_blank" rel="noopener">View Receipt</a>
            </div>`;
          }).join('')}
        </div>
      </div>`
    : '';

  const txHistoryHtml = (_portalTransactions && _portalTransactions.length)
    ? `<div style="margin-top:14px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px">Payment Activity History</div>
        <div class="tx-list">
          ${_portalTransactions.map(tx=>{
            const ok = isPortalPayConfirmed(tx.state);
            const bad = isPortalPayFailed(tx.state);
            const verify = tx.state === 'Payment Submitted for Verification';
            const cancel = tx.state === 'Payment Cancelled';
            const col = ok ? '#15803d' : (bad ? '#b91c1c' : (cancel ? '#64748b' : (verify ? '#b45309' : '#a16207')));
            const methodMask = tx.card_last4 ? `${tx.card_brand||'Card'} •••• ${tx.card_last4}` : (formatPortalChannel(tx.provider) || 'Payment Flow');
            return `<div class="tx-row">
              <div>
                <div style="font-weight:600;color:${col}">${esc(tx.state)} · ${fmtMoney(tx.amount)}</div>
                <div class="tx-meta">${esc(tx.payer_name || app.first_name || 'Applicant')} · ${esc(methodMask)} · ${esc(tx.transaction_ref||'')} · ${fmtDateShort(tx.created_at)}</div>
                ${tx.failure_reason ? `<div class="tx-meta" style="color:#b91c1c">${esc(tx.failure_reason)}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`
    : '';

  const supportRowHtml = `<div class="pay-support-row">
    <span>Questions about screening fees or payment verification?</span>
    <span>Call/Text <a href="tel:7077063137" style="color:#1d4ed8;font-weight:700;text-decoration:none">707-706-3137</a></span>
  </div>`;

  const blocks = [];

  if(paid||waived){
    const lines=[];
    if(fee!=null)lines.push(`<div class="meta-item"><span class="meta-label">Household Fee Total</span><span class="meta-val">${fmtMoney(fee)}</span></div>`);
    lines.push(`<div class="meta-item"><span class="meta-label">Payment Status</span><span class="meta-val" style="color:#15803d">&#10003; ${paid?'Payment Confirmed':waived?'Waived':''}</span></div>`);
    if(app.payment_confirmed_at||app.payment_date)lines.push(`<div class="meta-item"><span class="meta-label">Confirmed</span><span class="meta-val">${fmtDateShort(app.payment_confirmed_at||app.payment_date)}</span></div>`);
    if(app.payment_amount_collected||app.payment_amount_recorded)lines.push(`<div class="meta-item"><span class="meta-label">Collected</span><span class="meta-val">${fmtMoney(app.payment_amount_collected??app.payment_amount_recorded)}</span></div>`);
    if(app.payment_card_last4||app.payment_method_confirmed||app.payment_method_recorded){
      const mLabel = app.payment_card_last4 ? `${app.payment_card_brand||'Card'} •••• ${app.payment_card_last4}` : (app.payment_method_confirmed||app.payment_method_recorded);
      lines.push(`<div class="meta-item"><span class="meta-label">Method</span><span class="meta-val">${esc(mLabel)}</span></div>`);
    }
    if(app.payment_transaction_ref)lines.push(`<div class="meta-item"><span class="meta-label">Transaction Ref</span><span class="meta-val" style="font-family:monospace">${esc(app.payment_transaction_ref)}</span></div>`);
    blocks.push(`<div class="section"><div class="section-label">Payment</div>
      <div class="payment-card"><div class="payment-title"><span style="font-size:1.1rem">&#10003;</span> ${paid?'Payment Confirmed':'Application Fee Waived'}</div>
      ${householdProgressHtml}
      <div class="meta-grid">${lines.join('')}</div>
      ${breakdownHtml}
      ${paid?`<a class="btn-sign" href="${buildReceiptUrl(app, { type: 'application_fee' })}" target="_blank" rel="noopener">View official receipt</a>`:''}
      ${receiptsListHtml}
      ${txHistoryHtml}
      ${supportRowHtml}
      </div></div>`);
  } else if(refunded){
    blocks.push(`<div class="section"><div class="section-label">Payment</div>
      <div class="pay-unpaid-card"><div class="pay-unpaid-title">&#8592; Fee Refunded</div>
      <p style="color:var(--muted);font-size:.83rem">Your application fee has been refunded. Please contact us with any questions.</p>
      ${txHistoryHtml}${supportRowHtml}</div></div>`);
  } else if(payState==='Payment Submitted for Verification'){
    const chLabel = formatPortalChannel(app.selected_payment_method) || 'Alternative Payment';
    blocks.push(`<div class="section"><div class="section-label">Payment</div>
      <div class="pay-unpaid-card" style="border-color:rgba(217,119,6,.35);background:rgba(254,243,199,.35)">
        <div class="pay-unpaid-title" style="color:#b45309">Payment Submitted for Verification — ${fmtMoney(rollup.remaining || fee)}</div>
        <p style="color:var(--muted);font-size:.83rem;margin-bottom:10px;line-height:1.55">Your external payment notice via <strong>${esc(chLabel)}</strong>${app.external_payment_reference ? ' (Ref: <strong>' + esc(app.external_payment_reference) + '</strong>)' : ''} was logged on ${fmtDateShort(app.payment_submitted_at || app.updated_at)}. Your balance remains <strong>pending verification</strong> until our Leasing Desk confirms receipt.</p>
        ${householdProgressHtml}
        ${breakdownHtml}
        <a class="btn-sign" href="${payUrl}" style="display:inline-block;margin-top:6px;">View Payment Instructions / Change Method</a>
        ${receiptsListHtml}${txHistoryHtml}${supportRowHtml}
      </div></div>`);
  } else if(payState==='Payment Assistance Required'||app.payment_assistance_required){
    const ctaText = userNeedsIndividualPay ? 'Open Payment Options ($50.00 Share)' : 'Open Payment Options';
    blocks.push(`<div class="section"><div class="section-label">Payment</div>
      <div class="pay-unpaid-card">
        <div class="pay-unpaid-title">Payment Assistance Required — ${fmtMoney(fee)}</div>
        <p style="color:var(--muted);font-size:.83rem;margin-bottom:10px">Your submitted application remains active while our support team assists you with payment. Call or text <strong>707-706-3137</strong> or return to available payment methods.</p>
        ${householdProgressHtml}
        ${breakdownHtml}
        <a class="btn-sign" href="${payUrl}" style="display:inline-block;margin-top:6px;">${ctaText}</a>
        ${receiptsListHtml}${txHistoryHtml}${supportRowHtml}
      </div></div>`);
  } else if(isPortalPayFailed(payState)){
    blocks.push(`<div class="section"><div class="section-label">Payment</div>
      <div class="pay-unpaid-card">
        <div class="pay-unpaid-title">Payment Unsuccessful — ${fmtMoney(rollup.remaining || fee)}</div>
        <p style="color:var(--muted);font-size:.83rem;margin-bottom:10px">${esc(app.payment_failure_reason||'Your previous payment attempt could not be completed. Your application remains saved — choose another available payment method below.')}</p>
        ${householdProgressHtml}
        ${breakdownHtml}
        <a class="btn-sign" href="${payUrl}" style="display:inline-block;margin-top:6px;">Choose Another Payment Method</a>
        ${receiptsListHtml}${txHistoryHtml}${supportRowHtml}
      </div></div>`);
  } else if(payState==='Payment Cancelled'){
    blocks.push(`<div class="section"><div class="section-label">Payment</div>
      <div class="pay-unpaid-card">
        <div class="pay-unpaid-title">Payment Cancelled — ${fmtMoney(rollup.remaining || fee)} Still Due</div>
        <p style="color:var(--muted);font-size:.83rem;margin-bottom:10px">Your submitted rental application remains saved and active. Whenever you are ready, select a payment method to complete your application fee.</p>
        ${householdProgressHtml}
        ${breakdownHtml}
        <a class="btn-sign" href="${payUrl}" style="display:inline-block;margin-top:6px;">Choose Payment Method</a>
        ${receiptsListHtml}${txHistoryHtml}${supportRowHtml}
      </div></div>`);
  } else if(status==='unpaid'&&fee){
    const dueNow = userNeedsIndividualPay ? Number(currentUserApp.screening_fee_amount ?? 50) : (mode==='individual' ? rollup.remaining : fee);
    const chSelected = app.selected_payment_method ? formatPortalChannel(app.selected_payment_method) : '';
    const ctaLabel = chSelected ? `Continue ${chSelected} Payment (${fmtMoney(dueNow)})` : (userNeedsIndividualPay ? `Pay My ${fmtMoney(dueNow)} Share` : `Complete ${fmtMoney(dueNow)} Payment`);
    blocks.push(`<div class="section"><div class="section-label">Payment</div>
      <div class="pay-unpaid-card">
        <div class="pay-unpaid-title">${esc(payState)}${chSelected ? ' (' + esc(chSelected) + ')' : ''} — ${fmtMoney(rollup.remaining || fee)} Remaining</div>
        <p style="color:var(--muted);font-size:.83rem;margin-bottom:8px">Screening fees are <strong>$50.00 per adult applicant, co-applicant, guarantor, and co-signer</strong>. Total household screening fee: <strong>${fmtMoney(fee)}</strong>.</p>
        ${householdProgressHtml}
        ${breakdownHtml}
        <p style="color:#1d4ed8;font-size:.78rem;margin-bottom:12px;font-weight:600">${mode==='individual'?'Option B selected: each household adult pays their own $50.00 screening fee independently.':'View available payment options (including Cash App, PayPal, and Venmo) to complete your screening fee.'}</p>
        <a class="btn-sign" href="${payUrl}" style="display:inline-block;">${ctaLabel}</a>
        ${receiptsListHtml}${txHistoryHtml}${supportRowHtml}
      </div></div>`);
  } else if(_portalReceipts.length || _portalTransactions.length){
    blocks.push(`<div class="section"><div class="section-label">Payment Records</div>
      <div class="card">${receiptsListHtml}${txHistoryHtml}${supportRowHtml}</div></div>`);
  }

  // Holding fee flow
  if(app.holding_fee_requested){
    const hfPaid=app.holding_fee_paid;
    const hfAmt=app.holding_fee_amount;
    const hfDue=app.holding_fee_due_date;
    if(hfPaid){
      blocks.push(`<div class="section"><div class="section-label">Holding Deposit</div>
        <div class="payment-card"><div class="payment-title"><span>&#10003;</span> Holding Fee Received</div>
        <div class="meta-grid">
          ${hfAmt?`<div class="meta-item"><span class="meta-label">Amount</span><span class="meta-val">${fmtMoney(hfAmt)}</span></div>`:''}
          ${app.holding_fee_paid_at?`<div class="meta-item"><span class="meta-label">Received</span><span class="meta-val">${fmtDateShort(app.holding_fee_paid_at)}</span></div>`:''}
        </div><a class="btn-sign" href="${buildReceiptUrl(app, { type: 'holding_deposit' })}" target="_blank" rel="noopener">View official receipt</a>
        </div></div>`);
    } else {
      blocks.push(`<div class="section"><div class="section-label">Reservation</div>
        <div class="pay-unpaid-card"><div class="pay-unpaid-title">&#128176; Holding Fee Requested${hfAmt?' — '+fmtMoney(hfAmt):''}</div>
        <p style="color:var(--text);font-size:.83rem;margin-bottom:8px;line-height:1.55">
          The holding fee temporarily reserves this property and removes it from active availability while your lease is being finalized.${hfDue?' Please complete by <strong>'+fmtDate(hfDue)+'</strong>.':''}
        </p>
        <p style="color:#15803d;font-size:.78rem;margin-bottom:12px;font-weight:600">&#10003; 100% of this fee is credited toward your move-in balance — it is not an additional charge.</p>
        <p style="color:var(--muted);font-size:.78rem;line-height:1.55;margin-bottom:8px">Active transaction routing is provided directly by your billing coordinator via secure text to waive payment surcharges.</p>
        <p style="color:var(--muted);font-size:.76rem">Reply directly to your approval text or contact us: <a href="sms:+17077063137" style="color:#1d4ed8;font-weight:600">Text 707-706-3137</a></p></div></div>`);
    }
  }

  return blocks.join('');
}

// ── Household & multi-applicant status ────────────────────────────────────────
function renderHouseholdSection(app, applicants){
  const list = Array.isArray(applicants) ? applicants : [];
  const hasMulti = list.length > 1 || !!app.has_co_applicant || Number(app.co_applicant_count || 0) > 0 || Number(app.guarantor_count || 0) > 0 || Number(app.co_signer_count || 0) > 0;
  if(!hasMulti) return '';

  const rollup = calculateHouseholdPaymentRollup(app, list);
  const mode = rollup.mode;
  const appClosed = ['denied', 'withdrawn'].includes(app.status || '');
  const showLeaseSig = app.lease_status && app.lease_status !== 'none';

  const rows = list.map(a => {
    const norm = normalizePortalRole(a);
    const fullName = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || ('Participant ' + (a.applicant_index || ''));
    const roleLabel = formatPortalRole(norm, a.role);
    const consentOk = a.is_primary || !!a.screening_consent;
    const methodBadge = !a.is_primary
      ? (a.submission_method === 'invited'
          ? (a.info_completed ? '<span class="badge b-approved">Method B · Self-Completed</span>' : '<span class="badge b-pending">Invited · Info Pending</span>')
          : `<span class="badge b-sent">${consentOk ? 'Method A · Authorized by Primary' : 'Method A · Primary Completed'}</span>`)
      : '';
    const consentBadge = consentOk
      ? '<span class="badge b-approved">Screening Authorized</span>'
      : '<span class="badge b-pending">Consent Pending</span>';

    const mFee = Number(a.screening_fee_amount ?? 50);
    const mPayStatus = a.payment_status || (app.payment_status === 'paid' || app.payment_status === 'waived' ? app.payment_status : 'unpaid');
    const mPayState = a.application_payment_state || (mPayStatus === 'paid' || mPayStatus === 'waived' ? 'Payment Confirmed' : (a.external_payment_reference ? 'Payment Submitted for Verification' : (a.selected_payment_method ? 'Payment Method Selected' : 'Payment Required')));
    const mPayBadgeClass = (mPayStatus === 'paid' || mPayStatus === 'waived' || isPortalPayConfirmed(mPayState)) ? 'b-approved'
      : (isPortalPayFailed(mPayState) ? 'b-denied' : 'b-pending');
    const mPayBadgeLabel = (mPayStatus === 'paid') ? `Fee Paid (${fmtMoney(mFee)})`
      : (mPayStatus === 'waived') ? 'Fee Waived ($0.00)'
      : isPortalPayFailed(mPayState) ? `Payment Unsuccessful (${fmtMoney(mFee)})`
      : (mPayState === 'Payment Submitted for Verification') ? `Verification Pending (${fmtMoney(mFee)})`
      : (mPayState === 'Payment Cancelled') ? `Cancelled — Due (${fmtMoney(mFee)})`
      : `Fee Due (${fmtMoney(mFee)})`;
    const mPayBadge = `<span class="badge ${mPayBadgeClass}">${esc(mPayBadgeLabel)}</span>`;

    const showMemberPayCta = !appClosed && mode === 'individual' && mPayStatus !== 'paid' && mPayStatus !== 'waived' && mFee > 0 && a.id;
    const memberPayHref = `/apply/pay.html?app_id=${encodeURIComponent(app.app_id || '')}&applicant_id=${encodeURIComponent(a.id || '')}`;
    const memberPayBtn = showMemberPayCta
      ? `<a class="member-pay-btn" href="${memberPayHref}">Pay My ${fmtMoney(mFee)} Fee</a>`
      : '';

    const leaseBadge = showLeaseSig
      ? (a.lease_signature ? '<span class="badge b-approved">Lease Signed</span>' : '<span class="badge b-sent">Signature Pending</span>')
      : '';
    const housingMeta = (!isPortalOccupyingRole(norm) && a.housing_status) ? ' · Housing: ' + a.housing_status : '';
    return `<div class="household-row">
      <div>
        <div style="font-size:.86rem;font-weight:650;color:var(--text)">${esc(fullName)}</div>
        <div style="font-size:.74rem;color:var(--muted)">${esc(roleLabel)}${esc(housingMeta)}${a.email ? ' · ' + esc(a.email) : ''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${methodBadge}
        ${consentBadge}
        ${mPayBadge}
        ${memberPayBtn}
        ${leaseBadge}
      </div>
    </div>`;
  }).join('');

  const arrangementBar = `<div class="hh-arrangement-bar">
    <div>
      <strong>Payment Arrangement:</strong> ${mode === 'individual' ? 'Option B — Individual Member Payments ($50 each)' : 'Option A — Centralized Payment by Primary Applicant'}
    </div>
    <div><strong>${fmtMoney(rollup.totalCollected)}</strong> of <strong>${fmtMoney(rollup.totalFee)}</strong> collected (${rollup.paidCount}/${rollup.totalCount} paid)</div>
  </div>`;

  const fin = calculatePortalFinancials(app, list);
  let incomeSummaryHtml = '';
  if(fin.hasBreakdown || fin.householdIncome > 0 || fin.totalFinancialSupport > 0){
    const parts = [];
    parts.push(`<div class="meta-item"><span class="meta-label">Household Income (Occupants Only)</span><span class="meta-val">${fmtMoney(fin.householdIncome)}/mo</span></div>`);
    if(fin.guarantorSupport > 0 || fin.guarantorCount > 0){
      parts.push(`<div class="meta-item"><span class="meta-label">Guarantor Support</span><span class="meta-val">${fmtMoney(fin.guarantorSupport)}/mo</span></div>`);
    }
    if(fin.coSignerSupport > 0 || fin.coSignerCount > 0){
      parts.push(`<div class="meta-item"><span class="meta-label">Co-Signer Support</span><span class="meta-val">${fmtMoney(fin.coSignerSupport)}/mo</span></div>`);
    }
    if(fin.guarantorSupport > 0 || fin.coSignerSupport > 0){
      parts.push(`<div class="meta-item"><span class="meta-label">Total Financial Support Available</span><span class="meta-val">${fmtMoney(fin.totalFinancialSupport)}/mo</span></div>`);
    }
    parts.push(`<div class="meta-item"><span class="meta-label">Occupying Adults</span><span class="meta-val">${fin.occupyingAdults}</span></div>`);
    incomeSummaryHtml = `<div class="meta-grid" style="margin-top:12px">${parts.join('')}</div>`;
  } else if(app.combined_monthly_income != null && Number(app.combined_monthly_income) > 0){
    incomeSummaryHtml = `<div style="margin-top:10px;font-size:.78rem;color:var(--muted)">Combined household gross monthly income: <strong style="color:var(--text)">${fmtMoney(app.combined_monthly_income)}</strong></div>`;
  }

  return `<div class="section">
    <div class="section-label">Household &amp; Financial Participants (${list.length || (Number(app.co_applicant_count || 0) + 1)})</div>
    <div class="card">
      ${arrangementBar}
      <div class="household-list">${rows || '<p style="font-size:.82rem;color:var(--muted)">Household participant details are synced with our underwriting team.</p>'}</div>
      ${incomeSummaryHtml}
    </div>
  </div>`;
}

// ── Application credits (45-day re-apply credit policy) ───────────────────────
function renderCreditsSection(credits){
  const list = (Array.isArray(credits) ? credits : []).filter(c => c && c.status !== 'revoked');
  if(!list.length) return '';
  const active = list.filter(c => Number(c.remaining_credits || 0) > 0 && (!c.expires_at || new Date(c.expires_at).getTime() > Date.now()));
  if(!active.length) return '';

  const totalRemaining = active.reduce((sum, c) => sum + Number(c.remaining_credits || 0), 0);
  const itemsHtml = active.map(c => {
    const exp = c.expires_at ? fmtDateShort(c.expires_at) : '30 days from issuance';
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 0;border-top:1px solid rgba(16,185,129,.22)">
      <div style="font-size:.82rem;color:#065f46">
        <strong>${Number(c.remaining_credits || 0)} of ${Number(c.total_credits || 2)} credits remaining</strong>
        <div style="font-size:.74rem;color:#047857">Valid through ${esc(exp)}${c.original_app_id ? ' · From ' + esc(c.original_app_id) : ''}</div>
      </div>
      <a href="/apply/start.html" class="btn-sign" style="padding:8px 14px;font-size:.78rem;background:#047857;text-decoration:none">Apply with Credit &rarr;</a>
    </div>`;
  }).join('');

  return `<div class="section">
    <div class="section-label">Application Credits</div>
    <div class="credit-card">
      <div style="font-size:.92rem;font-weight:700;color:#065f46;margin-bottom:4px">&#10003; ${totalRemaining} Reusable Application Credit${totalRemaining === 1 ? '' : 's'} Available</div>
      <p style="font-size:.79rem;color:#047857;margin-bottom:10px;line-height:1.5">Under our Application Credit Policy, you can apply to other eligible Choice Properties without paying another primary screening fee ($50 credit value per reuse).</p>
      ${itemsHtml}
    </div>
  </div>`;
}

// ── Documents submitted with the original application ────────────────────────
function renderSubmittedDocs(app){
  if(['denied','withdrawn'].includes(app.status)) return '';
  return `<div class="section" id="submitted-docs-section" style="display:none">
    <div class="section-label">Documents on File</div>
    <div class="card" id="submitted-docs-card">
      <p style="color:var(--muted);font-size:.82rem;margin-bottom:10px">Files attached to your application or uploaded in this portal. Shared only with our leasing team.</p>
      <div id="submitted-docs-list" style="display:flex;flex-direction:column;gap:8px"></div>
    </div>
  </div>`;
}

async function loadSubmittedDocs(appId){
  try{
    const sb=getSB();
    const folders=[
      appId+'/applicant_upload',
      appId,
      appId+'/government_id',
      appId+'/pay_stub',
      appId+'/bank_statement',
      appId+'/proof_of_income',
      appId+'/guarantor_support',
      appId+'/other',
    ];
    for(let i=0;i<=6;i++) folders.push(appId+'/applicant_'+i);
    const listRes = await Promise.allSettled(
      folders.map(f=>sb.storage.from('application-docs').list(f,{limit:40,sortBy:{column:'created_at',order:'desc'}}).then(r=>({folder:f,files:r?.error?[]:(r?.data||[])})))
    );

    const byPath=new Map();
    const applicantMap=new Map((_portalApplicants||[]).map(a=>[a.id,a]));

    (_portalDocs||[]).forEach(d=>{
      const path=d.storage_path||'';
      if(!path) return;
      const name=d.original_file_name||path.split('/').pop()||'document';
      const owner=d.applicant_id?applicantMap.get(d.applicant_id):null;
      const ownerName=owner?[owner.first_name,owner.last_name].filter(Boolean).join(' ').trim():'';
      byPath.set(path,{
        path,
        bucket:d.bucket||'application-docs',
        name,
        docType:d.doc_type||'',
        reviewStatus:d.review_status||'',
        ownerName
      });
    });

    listRes.forEach(r=>{
      if(r.status!=='fulfilled') return;
      const {folder,files}=r.value;
      (files||[]).forEach(f=>{
        if(!f?.name || f.id==null && !/\.[a-z0-9]{2,5}$/i.test(f.name)) return;
        const name=f.name||'document';
        const path=folder+'/'+name;
        if(!byPath.has(path)){
          byPath.set(path,{path,bucket:'application-docs',name,docType:'',reviewStatus:'',ownerName:''});
        }
      });
    });

    const merged=Array.from(byPath.values());
    const section=document.getElementById('submitted-docs-section');
    const list=document.getElementById('submitted-docs-list');
    if(!section||!list) return;
    if(!merged.length){section.style.display='none';return;}

    const reviewLabel={verified:'Verified',rejected:'Needs Attention',pending:'In Review'};
    list.innerHTML=merged.map(item=>{
      const isPdf=/\.pdf$/i.test(item.name);
      const icon=isPdf?'&#128196;':'&#128247;';
      const metaParts=[];
      if(item.docType) metaParts.push(item.docType.replace(/_/g,' '));
      if(item.ownerName) metaParts.push(item.ownerName);
      if(item.reviewStatus && reviewLabel[item.reviewStatus]) metaParts.push(reviewLabel[item.reviewStatus]);
      const meta=metaParts.length?`<span style="font-size:.72rem;color:var(--muted);display:block">${esc(metaParts.join(' · '))}</span>`:'';
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;background:var(--surface-2);border-radius:var(--r-md);border:1px solid var(--hairline)">
        <span style="display:flex;align-items:center;gap:8px;font-size:.83rem;font-weight:500;min-width:0">
          <span>${icon}</span>
          <span style="min-width:0">
            <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.name)}</span>
            ${meta}
          </span>
        </span>
        <button type="button" style="flex-shrink:0;font-size:.75rem;font-weight:600;color:#1d4ed8;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;white-space:nowrap"
          data-action="dl-submitted-doc" data-path="${esc(item.path)}" data-bucket="${esc(item.bucket)}">Download</button>
      </div>`;
    }).join('');
    section.style.display='';
  } catch(_){}
}

async function downloadSubmittedDoc(path, bucket){
  try{
    const bkt=bucket||'application-docs';
    const {data,error}=await getSB().storage.from(bkt).createSignedUrl(path,300);
    if(error||!data?.signedUrl){showToast('Could not get download link','danger');return;}
    openExternalUrl(data.signedUrl);
  }catch(e){showToast(e.message,'danger');}
}

// ── Document upload (checklist with live file list) ──────────────────────────
function renderDocUpload(app){
  if(['denied','withdrawn'].includes(app.status))return '';
  const checklist = renderDocChecklist({});
  let ownerSelector = '';
  if(Array.isArray(_portalApplicants) && _portalApplicants.length > 1){
    const currentEmail = (_portalUserEmail || '').toLowerCase();
    const defaultApp = _portalApplicants.find(a => (a.email || '').toLowerCase() === currentEmail)
      || _portalApplicants.find(a => a.is_primary)
      || _portalApplicants[0];
    const opts = _portalApplicants.map(a => {
      const label = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || ('Participant ' + (a.applicant_index || ''));
      const roleTag = formatPortalRole(normalizePortalRole(a), a.role);
      const sel = defaultApp && defaultApp.id === a.id ? ' selected' : '';
      return `<option value="${esc(a.id)}"${sel}>${esc(label)} (${esc(roleTag)})</option>`;
    }).join('');
    ownerSelector = `<div class="doc-owner-bar">
      <label for="doc-applicant-select">Document belongs to</label>
      <select id="doc-applicant-select">${opts}</select>
    </div>`;
  }
  return `<div class="section"><div class="section-label">Documents</div>
    <div class="card" id="doc-checklist-card" data-app-id="${esc(app.app_id)}">
      <p style="color:var(--muted);font-size:.82rem;margin-bottom:6px">PDF, JPG, or PNG accepted. Files are private and shared only with our team.</p>
      ${ownerSelector}
      <div class="dropzone" id="doc-dropzone" data-active="0" aria-label="Drag and drop documents here">
        <svg class="ico"><use href="#i-upload-cloud"/></svg>
        <div><strong>Drag &amp; drop files here</strong> &middot; we'll route them to the right slot below.</div>
      </div>
      <div id="doc-checklist-list">${checklist}</div>
    </div></div>`;
}

// Phase 2: accepts an optional `prefetchedDocs` array (rows from
// application_documents, returned by the tenant_portal_state RPC). When
// supplied, we skip the storage.list round-trip entirely. When omitted,
// we fall back to listing the storage bucket (legacy path, still works
// even if the migration is not applied).
async function populateDocChecklist(appId, prefetchedDocs){
  const card = document.getElementById('doc-checklist-card');
  const list = document.getElementById('doc-checklist-list');
  if(!card || !list) return;
  const grouped = Array.isArray(prefetchedDocs)
    ? groupDocsFromTable(prefetchedDocs)
    : await loadUploadedDocsList(appId);
  list.innerHTML = renderDocChecklist(grouped);
  // Restamp the data-app-id attribute on each file input (uploadDoc reads it).
  list.querySelectorAll('input[type=file][data-doc-type]').forEach(el => {
    el.dataset.appId = appId;
  });
}

// Convert application_documents rows into the same shape that
// loadUploadedDocsList (storage list) returns: { docType: [{name}, ...] }.
function groupDocsFromTable(rows){
  const grouped = {};
  (rows || []).forEach(d => {
    const type = String(d.doc_type || '').toLowerCase();
    const key = REQUIRED_DOCS.find(x => x.type === type)?.type || 'other';
    const name = d.original_file_name || String(d.storage_path || '').split('/').pop() || 'document';
    (grouped[key] = grouped[key] || []).push({ name: name });
  });
  return grouped;
}

// ── Document upload (Phase 2: multi-file with parallel uploads) ─────────────
// uploadOneFile is the single-file primitive — signs an upload URL via the
// request-upload-url Edge Function and PUTs the file. Returns true/false.
// uploadDocFiles is the multi-file orchestrator: reads every file from the
// input, runs uploads in parallel (capped at 4 concurrent — polite to the
// signing function), shows live progress in the per-doc status line, and
// refreshes the checklist once all uploads settle.
async function uploadOneFile(docType, appId, file){
  if(!file) return { ok:false, name:'', error:'No file' };
  try {
    const { data:{ session } } = await getSB().auth.getSession();
    const token = session?.access_token;
    if(!token) return { ok:false, name:file.name, error:'Not signed in' };
    const applicantId = document.getElementById('doc-applicant-select')?.value || '';
    const payload = { app_id:appId, file_name:file.name, file_type:file.type, doc_type:docType };
    if(applicantId) payload.applicant_id = applicantId;
    const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/request-upload-url', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer ' + token },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if(!res.ok || !d.signed_url) return { ok:false, name:file.name, error: d.error || ('HTTP ' + res.status) };
    const up = await fetch(d.signed_url, { method:'PUT', headers:{ 'Content-Type':file.type, 'x-upsert':'true' }, body:file });
    if(!up.ok) return { ok:false, name:file.name, error:'Upload PUT failed' };
    return { ok:true, name:file.name };
  } catch(e) {
    return { ok:false, name:file?.name || '', error:e.message };
  }
}

async function uploadDocFiles(docType, appId, inputId, statusId){
  const input  = document.getElementById(inputId);
  const status = document.getElementById(statusId);
  if(!input) return;
  const files = Array.from(input.files || []);
  if(!files.length) return;
  const total = files.length;
  if(status){
    status.style.color = '#1d4ed8';
    status.textContent = total === 1 ? 'Uploading…' : ('Uploading 0 / ' + total + '…');
  }

  const CONCURRENCY = 4;
  const queue = files.slice();
  let done = 0, failed = 0;
  const failures = [];
  const updateStatus = () => {
    if(!status || total <= 1) return;
    const seen = done + failed;
    status.textContent = 'Uploading ' + seen + ' / ' + total + (failed ? ' (' + failed + ' failed)' : '') + '…';
  };
  const worker = async () => {
    while(queue.length){
      const f = queue.shift();
      const r = await uploadOneFile(docType, appId, f);
      if(r.ok){ done++; } else { failed++; failures.push(r); }
      updateStatus();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

  if(status){
    if(failed === 0){
      status.innerHTML = '&#10003; ' + (total === 1 ? esc(files[0].name) : (total + ' files uploaded'));
      status.style.color = 'var(--acc-success-text)';
      showToast(total === 1 ? (esc(files[0].name) + ' uploaded') : (total + ' files uploaded'), 'success');
    } else if(done === 0){
      status.textContent = total === 1 ? 'Upload failed. Try again.' : 'All ' + total + ' uploads failed.';
      status.style.color = 'var(--acc-danger-text)';
      showToast(failures[0]?.error || 'Upload failed. Try again.', 'danger');
    } else {
      status.innerHTML = '&#10003; ' + done + ' uploaded · ' + failed + ' failed';
      status.style.color = 'var(--acc-warn-text)';
      showToast(done + ' uploaded, ' + failed + ' failed', 'warn');
    }
  }
  input.value = '';
  if(window._portalAppId){
    try{
      const {data:refreshedDocs}=await getSB().from('application_documents')
        .select('id,app_id,applicant_id,bucket,storage_path,original_file_name,doc_type,review_status,review_notes,uploaded_by_email,created_at')
        .eq('app_id',window._portalAppId)
        .order('created_at',{ascending:false});
      if(Array.isArray(refreshedDocs)) _portalDocs=refreshedDocs;
    }catch(_){}
    populateDocChecklist(window._portalAppId, _portalDocs.length ? _portalDocs : undefined);
    loadSubmittedDocs(window._portalAppId);
  }
}

// Back-compat alias — older code paths referenced uploadDoc().
async function uploadDoc(docType, appId, inputId, statusId){
  return uploadDocFiles(docType, appId, inputId, statusId);
}

// ── Required documents (also used by checklist + uploader) ──────────────────
const REQUIRED_DOCS = [
  { type:'government_id',     label:'Government ID',           required:true,  hint:"Driver's license, passport, or state ID" },
  { type:'pay_stub',          label:'Pay Stub (last 2 months)',required:true,  hint:'Most recent 2 months of pay stubs' },
  { type:'bank_statement',    label:'Bank Statement',          required:true,  hint:'Most recent statement' },
  { type:'guarantor_support', label:'Financial Support Docs',  required:false, hint:'Optional guarantor / co-signer income or asset verification' },
  { type:'other',             label:'Other Document',          required:false, hint:'Optional supporting documents' },
];

// ── Next-step decision engine ─────────────────────────────────────────────────
// Returns { tone, eyebrow, title, sub, ctaLabel, ctaHref, ctaAction, deadline }
function nextStepFor(app){
  const status      = app.status || 'pending';
  const lease       = app.lease_status || 'none';
  const mi          = app.move_in_status || null;
  const payStatus   = app.payment_status || 'unpaid';
  const hfReq       = !!app.holding_fee_requested;
  const hfPaid      = !!app.holding_fee_paid;

  // Move-in done — it's home time.
  if(mi === 'completed' || mi === 'confirmed'){
    return { tone:'success', eyebrow:'You\'re all set', title:'Welcome home.',
      sub: app.move_in_date_actual
        ? 'Move-in date: ' + fmtDate(app.move_in_date_actual) + '. We\'ll be in touch with key pickup details.'
        : 'Your move-in is confirmed. We\'ll be in touch with key pickup details.' };
  }

  // Lease awaiting tenant signature
  if(lease === 'sent' && app.tenant_sign_token){
    return { tone:'info', eyebrow:'Action required', title:'Your lease is ready to sign.',
      sub:'Please review and sign as soon as possible — your move-in date depends on it.',
      ctaLabel:'Sign your lease', ctaHref:'/lease-sign.html?token=' + encodeURIComponent(app.tenant_sign_token),
      ctaIcon:'i-edit',
      deadline: app.lease_sent_date ? new Date(new Date(app.lease_sent_date).getTime() + 1000*60*60*48).toISOString() : null,
      deadlineLabel:'48-hr signing window' };
  }
  if(lease === 'awaiting_co_sign'){
    return { tone:'info', eyebrow:'Almost there', title:'Waiting for additional household signers.',
      sub:'You\'ve signed — we\'re waiting for all required household signers (co-applicants / guarantors / co-signers) to complete their signatures.' };
  }
  if(lease === 'signed' || lease === 'co_signed'){
    return { tone:'success', eyebrow:'Lease executed', title:'Your lease is signed.',
      sub: app.lease_start_date ? 'Lease starts ' + fmtDate(app.lease_start_date) + '. Move-in details to follow.' : 'Move-in scheduling next. Your team will be in touch.',
      ctaLabel:'Download lease', ctaAction:'download-lease', ctaIcon:'i-download' };
  }

  // Holding fee
  if(hfReq && !hfPaid){
    return { tone:'warn', eyebrow:'Time-sensitive', title:'Complete your holding fee to reserve the unit.',
      sub: (app.holding_fee_amount ? 'Amount: ' + fmtMoney(app.holding_fee_amount) + '. ' : '') +
           'This is fully credited toward your move-in costs. Without it, the unit remains available to other approved applicants.',
      ctaLabel:'Call to confirm payment', ctaHref:'tel:7077063137', ctaIcon:'i-dollar',
      deadline: app.holding_fee_due_date || null, deadlineLabel:'Due' };
  }
  if(hfPaid && lease === 'none'){
    return { tone:'info', eyebrow:'Reserved', title:'Holding fee received — your unit is held.',
      sub:'We\'re preparing your lease now. You\'ll be notified the moment it\'s ready to sign.' };
  }

  // Approved, no holding fee in motion yet
  if(status === 'approved'){
    return { tone:'success', eyebrow:'You were selected', title:'You\'ve been approved.',
      sub:'Your team will reach out shortly with next steps to reserve the unit and prepare your lease.' };
  }

  // Additional information requested by underwriting
  if(status === 'additional_info_required'){
    return { tone:'warn', eyebrow:'Action required', title:'Additional Information Required.',
      sub: app.additional_info_note || 'Our underwriting team requested additional documents or clarification to continue reviewing your application.',
      ctaLabel:'Upload Requested Documents', ctaHref:'#doc-checklist-card', ctaIcon:'i-upload' };
  }

  // Application fee unpaid / failed / assistance
  const rollup = calculateHouseholdPaymentRollup(app, _portalApplicants);
  const currentUserApp = Array.isArray(_portalApplicants)
    ? (_portalApplicants.find(a=>(a.email||'').toLowerCase()===(_portalUserEmail||'').toLowerCase()) || _portalApplicants.find(a=>a.is_primary) || _portalApplicants[0])
    : null;
  const userNeedsIndividualPay = rollup.mode==='individual' && currentUserApp && currentUserApp.payment_status!=='paid' && currentUserApp.payment_status!=='waived';
  const payUrl = '/apply/pay.html?app_id=' + encodeURIComponent(app.app_id || '')
    + (rollup.mode==='individual' && currentUserApp?.id ? '&applicant_id=' + encodeURIComponent(currentUserApp.id) : '');
  const payState = resolvePortalPayState(app);
  const dueDisplay = userNeedsIndividualPay ? Number(currentUserApp.screening_fee_amount ?? 50) : (rollup.remaining || Number(app.application_fee || 0));
  if(payStatus === 'unpaid' && dueDisplay > 0){
    if(payState === 'Payment Submitted for Verification'){
      const chLabel = formatPortalChannel(app.selected_payment_method) || 'alternative payment method';
      return { tone:'info', eyebrow:'Verification Pending', title:'Payment submitted for verification — ' + fmtMoney(dueDisplay) + '.',
        sub:`We received your external ${chLabel} confirmation notice. Your balance stays pending until Leasing Desk confirms receipt (707-706-3137).`,
        ctaLabel:'View Payment Details', ctaHref: payUrl, ctaIcon:'i-dollar' };
    }
    if(payState === 'Payment Method Selected'){
      const chLabel = formatPortalChannel(app.selected_payment_method) || 'payment method';
      return { tone:'warn', eyebrow:'Method Selected', title:`Complete ${chLabel} payment — ${fmtMoney(dueDisplay)}.`,
        sub:'Your application is saved. Follow your selected payment instructions or switch to another available method.',
        ctaLabel:'Continue Payment', ctaHref: payUrl, ctaIcon:'i-dollar' };
    }
    if(payState === 'Payment Cancelled'){
      return { tone:'warn', eyebrow:'Payment Cancelled', title:'Choose a payment method — ' + fmtMoney(dueDisplay) + '.',
        sub:'Your previous payment attempt was cancelled, but your rental application remains saved.',
        ctaLabel:'Select Payment Method', ctaHref: payUrl, ctaIcon:'i-dollar' };
    }
    if(payState === 'Payment Assistance Required' || app.payment_assistance_required){
      return { tone:'warn', eyebrow:'Support Requested', title:'Payment assistance requested — ' + fmtMoney(dueDisplay) + '.',
        sub:'Your application remains saved. Our support team (707-706-3137) can help, or you can view available payment methods.',
        ctaLabel:'Open Payment Options', ctaHref: payUrl, ctaIcon:'i-dollar' };
    }
    if(isPortalPayFailed(payState)){
      return { tone:'warn', eyebrow:'Payment Unsuccessful', title:'Complete application fee — ' + fmtMoney(dueDisplay) + '.',
        sub:'Your previous payment attempt could not be finalized. Your application is saved — select another available payment method.',
        ctaLabel:'Choose Another Payment Method', ctaHref: payUrl, ctaIcon:'i-dollar' };
    }
    return { tone:'warn', eyebrow:'Payment Required', title:(userNeedsIndividualPay ? 'Your screening share due — ' : 'Application fee due — ') + fmtMoney(dueDisplay) + '.',
      sub:'View available payment options (including Cash App, PayPal, or Venmo) to complete your screening fee.',
      ctaLabel:'Complete Payment', ctaHref: payUrl, ctaIcon:'i-dollar' };
  }

  if(status === 'waitlisted'){
    return { tone:'purple', eyebrow:'On waitlist', title:'You\'re on the waitlist.',
      sub:'We\'ll contact you the moment a unit opens up. Browsing other listings in the meantime is welcome.' };
  }
  if(status === 'denied'){
    return { tone:'danger', eyebrow:'Decision', title:'Not Approved.',
      sub:'We were unable to approve this application for the property. You\'re welcome to apply for other available properties.',
      ctaLabel:'Browse properties', ctaHref:'/listings.html', ctaIcon:'i-arrow' };
  }
  if(status === 'withdrawn'){
    return { tone:'info', eyebrow:'Withdrawn', title:'This application has been withdrawn.',
      sub:'If you\'d like to reapply in the future, we\'re here to help.' };
  }
  if(status === 'under_review'){
    return { tone:'info', eyebrow:'Under Review', title:'Your application is under active review.',
      sub:'Our leasing team is evaluating your household screening and documents. Decisions typically arrive within 24–48 hours of completed payment.' };
  }

  // Default — pending review
  return { tone:'info', eyebrow:'Application Submitted', title:'Your application is submitted.',
    sub:'Decisions typically come within 24–48 hours after screening payments are completed. Applicants who respond promptly are often prioritized.' };
}

// ── Countdown badge ──────────────────────────────────────────────────────────
function countdownHtml(deadlineISO, label){
  if(!deadlineISO) return '';
  return `<span class="countdown" data-deadline="${esc(deadlineISO)}" data-label="${esc(label||'')}">
    <svg class="ico"><use href="#i-clock"/></svg><span class="cd-text">…</span>
  </span>`;
}
function tickCountdown(el){
  const deadline = new Date(el.dataset.deadline).getTime();
  if(isNaN(deadline)) return;
  const now = Date.now();
  const diff = deadline - now;
  const label = el.dataset.label || '';
  const txt = el.querySelector('.cd-text');
  if(diff <= 0){
    el.dataset.expired = '1';
    el.dataset.urgent = '0';
    if(txt) txt.textContent = (label ? label + ' · ' : '') + 'Past due';
    return;
  }
  const hrs = diff / (1000*60*60);
  el.dataset.urgent = (hrs <= 12) ? '1' : '0';
  el.dataset.expired = '0';
  let str;
  if(hrs >= 24){
    const d = Math.floor(hrs / 24);
    const h = Math.floor(hrs - d*24);
    str = d + 'd ' + h + 'h left';
  } else if(hrs >= 1){
    const h = Math.floor(hrs);
    const m = Math.floor((diff - h*1000*60*60) / (1000*60));
    str = h + 'h ' + m + 'm left';
  } else {
    const m = Math.max(1, Math.ceil(diff / (1000*60)));
    str = m + 'm left';
  }
  if(txt) txt.textContent = (label ? label + ' · ' : '') + str;
}
let _cdTimer = null;
function startCountdownTickers(root){
  if(_cdTimer){ clearInterval(_cdTimer); _cdTimer = null; }
  const els = (root || document).querySelectorAll('.countdown[data-deadline]');
  if(!els.length) return;
  els.forEach(tickCountdown);
  _cdTimer = setInterval(() => {
    document.querySelectorAll('.countdown[data-deadline]').forEach(tickCountdown);
  }, 30000);
}

// ── Hero block ───────────────────────────────────────────────────────────────
function renderHero(app, step){
  const cta = step.ctaLabel
    ? (step.ctaHref
        ? `<a class="hero-cta" href="${esc(step.ctaHref)}"><svg class="ico ico-lg"><use href="#${esc(step.ctaIcon||'i-arrow')}"/></svg>${esc(step.ctaLabel)}</a>`
        : `<button class="hero-cta" type="button" data-action="${esc(step.ctaAction||'')}"><svg class="ico ico-lg"><use href="#${esc(step.ctaIcon||'i-arrow')}"/></svg>${esc(step.ctaLabel)}</button>`)
    : '';
  const cd = step.deadline ? countdownHtml(step.deadline, step.deadlineLabel) : '';
  // Tone-appropriate hero icon (defaults to step.ctaIcon, then a tone-based fallback).
  const toneIconMap = {success:'i-check', warn:'i-clock', danger:'i-x', info:'i-bell', purple:'i-bell'};
  const heroIcon = step.heroIcon || step.ctaIcon || toneIconMap[step.tone] || 'i-bell';
  return `<div class="hero" data-tone="${esc(step.tone||'info')}">
    <div class="hero-icon"><svg class="ico"><use href="#${esc(heroIcon)}"/></svg></div>
    <div class="hero-eyebrow">${esc(step.eyebrow||'')}${cd?' &nbsp;'+cd:''}</div>
    <div class="hero-title">${esc(step.title||'')}</div>
    <div class="hero-sub">${esc(step.sub||'')}</div>
    ${cta}
  </div>`;
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function renderProgress(steps){
  const totalUnits = steps.length;
  let done = 0;
  steps.forEach(s => { if(s.done) done++; });
  // Half-credit for the active step.
  const active = steps.find(s => s.active && !s.done);
  const pct = Math.round(((done + (active ? 0.5 : 0)) / totalUnits) * 100);
  const labelIdx = active ? steps.indexOf(active) + 1 : done;
  return `<div class="progress-wrap">
    <div class="progress-row"><span>Step ${labelIdx} of ${totalUnits}</span><span>${pct}%</span></div>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
      <div class="progress-fill" style="width:${pct}%"></div>
    </div>
  </div>`;
}

// ── Uploaded documents (live list from storage) ──────────────────────────────
async function loadUploadedDocsList(appId){
  try{
    const sb = getSB();
    const folders = [appId, appId+'/applicant_upload', appId+'/government_id', appId+'/pay_stub', appId+'/bank_statement', appId+'/proof_of_income', appId+'/guarantor_support', appId+'/other'];
    for(let i=0;i<=6;i++) folders.push(appId+'/applicant_'+i);
    const listRes = await Promise.allSettled(
      folders.map(f => sb.storage.from('application-docs').list(f, { limit:100, sortBy:{ column:'created_at', order:'desc' } }).then(r => ({ folder:f, files:r?.error ? [] : (r?.data||[]) })))
    );
    const grouped = {};
    listRes.forEach(r => {
      if(r.status !== 'fulfilled') return;
      const { folder, files } = r.value;
      const folderType = folder.split('/')[1] || '';
      (files||[]).forEach(f => {
        if(!f?.name || (f.id==null && !/\.[a-z0-9]{2,5}$/i.test(f.name))) return;
        const m = (f.name||'').match(/^([a-z_]+?)(?:_\d+)?[_-]/i) || (f.name||'').match(/^([a-z_]+)/i);
        const type = (REQUIRED_DOCS.find(d => d.type === folderType)?.type) || (m && m[1] ? m[1].toLowerCase() : 'other');
        const key = REQUIRED_DOCS.find(d => d.type === type)?.type || 'other';
        (grouped[key] = grouped[key] || []).push(f);
      });
    });
    return grouped;
  } catch(_){ return {}; }
}

function renderDocChecklist(grouped){
  return REQUIRED_DOCS.map(d => {
    const files = grouped[d.type] || [];
    const has = files.length > 0;
    const state = has ? 'done' : (d.required ? 'required' : 'optional');
    const icon = has ? '<svg class="ico"><use href="#i-check"/></svg>' : (d.required ? '!' : '+');
    const statusText = has
      ? files.length + ' file' + (files.length!==1?'s':'') + ' uploaded'
      : (d.required ? 'Required · ' + d.hint : 'Optional · ' + d.hint);
    const filesList = has
      ? `<div class="doc-check-files">${files.slice(0,3).map(f =>
          `<span class="doc-check-file"><svg class="ico"><use href="#i-doc"/></svg>${esc(f.name)}</span>`
        ).join('')}${files.length>3?`<span class="doc-check-file" style="color:var(--muted)">+ ${files.length-3} more</span>`:''}</div>`
      : '';
    const btnLabel = has ? 'Replace' : (d.required ? 'Upload' : 'Add');
    const camId = 'cam-' + d.type;
    return `<div class="doc-check" data-state="${state}" style="position:relative">
      <button class="cam-btn" type="button" data-action="choose-file" data-target="${camId}" aria-label="Take photo for ${esc(d.label)}">
        <svg class="ico"><use href="#i-cam"/></svg>
      </button>
      <span class="doc-check-icon">${icon}</span>
      <div class="doc-check-body">
        <div class="doc-check-label">${esc(d.label)}</div>
        <div class="doc-check-status">${statusText}</div>
        ${filesList}
      </div>
      <input type="file" id="fi-${esc(d.type)}" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="display:none"
        data-doc-type="${esc(d.type)}" data-status-id="ds-${esc(d.type)}">
      <input type="file" id="${camId}" accept="image/*" capture="environment" style="display:none"
        data-doc-type="${esc(d.type)}" data-status-id="ds-${esc(d.type)}">
      <button class="btn-choose-mini" type="button" data-action="choose-file" data-target="fi-${esc(d.type)}">${btnLabel}</button>
    </div>
    <div class="doc-status" id="ds-${esc(d.type)}" style="font-size:.74rem;padding:0 0 6px 40px"></div>`;
  }).join('');
}

// ── Approval & Reservation Agreement (Institutional high-trust view) ──────────
function renderReservationAgreement(app){
  if(app.status !== 'approved') return '';
  const firstName = esc(app.first_name || 'Resident');
  const address = esc(app.property_address || 'Selected Property');
  const appId = esc(app.app_id || app.id || '');
  const holdingPaid = !!app.holding_fee_paid;
  const holdingAmount = app.holding_fee_amount ? Number(app.holding_fee_amount) : 500;
  const holdingAmountFmt = fmtMoney(holdingAmount);

  return `
    <div class="section" id="approval-reservation-agreement" style="margin-bottom:var(--sp-6)">
      <div class="section-label">Underwriting Decision &amp; Reservation Protocol</div>
      <div class="card" style="border:1.5px solid ${holdingPaid ? 'var(--acc-success-border)' : '#10b981'};background:linear-gradient(180deg, ${holdingPaid ? 'rgba(240,253,244,.8)' : 'rgba(236,253,245,.85)'} 0%, var(--surface) 100%);padding:var(--sp-6)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;margin-bottom:var(--sp-4)">
          <div>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:var(--r-pill);background:#065f46;color:#fff;font-size:.68rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">
              &#10003; Official Underwriting Approval
            </span>
            <h2 style="font-size:1.35rem;font-weight:750;color:var(--text);margin:0;letter-spacing:-.015em">
              Property Reservation Protocol
            </h2>
            <p style="margin:4px 0 0;font-size:.82rem;color:var(--muted)">
              Reference: <strong style="font-family:var(--font-mono);color:var(--text)">${appId}</strong> &middot; Property: <strong style="color:var(--text)">${address}</strong>
            </p>
          </div>
          <div style="text-align:right">
            <span class="badge ${holdingPaid ? 'b-approved' : 'b-pending'}" style="font-size:.74rem;padding:6px 13px">
              ${holdingPaid ? '✓ Property Exclusively Held' : 'Reservation Window Active'}
            </span>
          </div>
        </div>

        <div style="background:var(--surface);border:1px solid var(--hairline);border-radius:var(--r-md);padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);font-size:.85rem;line-height:1.65;color:var(--text)">
          <p style="margin:0 0 10px">
            Congratulations, <strong>${firstName}</strong>! Your rental application for <strong>${address}</strong> has been officially approved by Choice Properties underwriting.
          </p>
          <p style="margin:0 0 10px">
            Under our reservation protocol, this property is eligible to be placed on <strong>exclusive hold in your name</strong> while our leasing desk finalizes your formal state-specific Residential Lease Agreement.
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid var(--hairline)">
            <div style="display:flex;align-items:flex-start;gap:8px">
              <span style="color:#059669;font-weight:700;font-size:1rem">&#10003;</span>
              <span style="font-size:.8rem;line-height:1.5"><strong>100% Move-In Credit:</strong> Your holding deposit is fully credited toward your first month's rent. It is never an additional charge.</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px">
              <span style="color:#059669;font-weight:700;font-size:1rem">&#10003;</span>
              <span style="font-size:.8rem;line-height:1.5"><strong>Off-Market Guarantee:</strong> Once recorded, the listing is officially taken off the market and reserved exclusively for you.</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px">
              <span style="color:#059669;font-weight:700;font-size:1rem">&#10003;</span>
              <span style="font-size:.8rem;line-height:1.5"><strong>Direct Text Routing:</strong> To waive payment surcharges, reservation details are coordinated via secure text with your leasing coordinator.</span>
            </div>
          </div>
        </div>

        ${holdingPaid ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r-md);padding:14px 18px">
            <div>
              <div style="font-size:.82rem;font-weight:700;color:#166534">&#10003; Holding Escrow Deposit Confirmed</div>
              <div style="font-size:.76rem;color:#15803d;margin-top:2px">Amount: ${holdingAmountFmt} &middot; Recorded to operating ledger &middot; Credited to move-in</div>
            </div>
            <a href="/receipt.html?app_id=${encodeURIComponent(appId)}&amp;type=holding_deposit" class="btn-sign" style="padding:9px 16px;font-size:.8rem;background:#15803d;text-decoration:none">
              View Stamped Escrow Receipt
            </a>
          </div>
        ` : `
          <div style="background:#fefce8;border:1px solid #fde047;border-radius:var(--r-md);padding:14px 18px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div>
                <div style="font-size:.82rem;font-weight:700;color:#854d0e">&#9888; Holding Coordination in Progress</div>
                <div style="font-size:.77rem;color:#713f12;margin-top:2px">Reservation Hold: <strong>${holdingAmountFmt}</strong> (100% credited to move-in). Reply to your approval SMS or text below to receive active routing details.</div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <a href="sms:+17077063137?body=Hello, I received my approval for ${encodeURIComponent(address)} (Ref: ${encodeURIComponent(appId)}) and would like to coordinate my reservation hold." class="btn-sign" style="padding:9px 16px;font-size:.8rem;background:#15803d;text-decoration:none">
                  Text Coordinator to Complete Hold
                </a>
                <button type="button" class="btn-download" onclick="window.print()" style="padding:9px 14px;font-size:.8rem">
                  Print Approval Notice
                </button>
              </div>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

// ── Portal render ─────────────────────────────────────────────────────────────
function renderPortal(app){
  const name=esc(((app.first_name||'')+' '+(app.last_name||'')).trim())||'Applicant';
  const prop=esc(app.property_address||'Your Property');
  const status=app.status||'pending';
  const payStatus=app.payment_status||'unpaid';
  const leaseStatus=app.lease_status||'none';
  const miStatus=app.move_in_status||null;
  const rollup=calculateHouseholdPaymentRollup(app,_portalApplicants);

  const statusBadge=(s)=>{
    const m={
      pending:'b-pending',
      under_review:'b-review',
      additional_info_required:'b-info-req',
      approved:'b-approved',
      denied:'b-denied',
      waitlisted:'b-waitlisted',
      withdrawn:'b-withdrawn',
    };
    const l={
      pending:'Application Submitted',
      under_review:'Under Review',
      additional_info_required:'Additional Info Required',
      approved:'Approved',
      denied:'Not Approved',
      waitlisted:'Waitlisted',
      withdrawn:'Withdrawn',
    };
    return `<span class="badge ${m[s]||'b-none'}">${l[s]||s}</span>`;
  };
  const paymentBadge=(a)=>{
    const pState = resolvePortalPayState(a);
    const cls = (a.payment_status==='paid'||a.payment_status==='waived'||isPortalPayConfirmed(pState)) ? 'b-approved'
      : (isPortalPayFailed(pState) ? 'b-denied' : 'b-pending');
    return `<span class="badge ${cls}">${esc(pState)}</span>`;
  };
  const leaseBadge=(s)=>{
    if(!s||s==='none')return `<span class="badge b-none">No Lease</span>`;
    const l={sent:'Lease Sent',signed:'Lease Signed',co_signed:'Fully Executed',awaiting_co_sign:'Awaiting Co-Sign',voided:'Voided',expired:'Expired'};
    return `<span class="badge b-sent">${l[s]||s}</span>`;
  };

  // 6-Stage Lifecycle Pipeline:
  // Submitted -> Payment -> Under Review -> Decision (Approved / Not Approved) -> Lease -> Move-In
  const feePaid = payStatus === 'paid' || payStatus === 'waived' || rollup.allPaid;
  const portalPayState = resolvePortalPayState(app);
  const decisionDone = ['approved', 'denied'].includes(status);
  const inReviewPhase = !decisionDone && (status === 'under_review' || status === 'additional_info_required' || feePaid);
  const steps=[
    {
      done:true,
      label:'Application Submitted',
      sub:'Received '+fmtDateShort(app.created_at),
    },
    {
      done:feePaid,
      active:!feePaid && status!=='denied' && status!=='withdrawn',
      label:feePaid?(payStatus==='waived'?'Fee Waived':'Payment Confirmed'):portalPayState,
      sub:feePaid
        ? (`${fmtMoney(rollup.totalCollected || rollup.totalFee)} confirmed`+(app.payment_transaction_ref?' · Ref '+app.payment_transaction_ref:''))
        : (portalPayState === 'Payment Submitted for Verification'
            ? (`Verification pending (${formatPortalChannel(app.selected_payment_method) || 'External'}) — ${fmtMoney(rollup.totalFee)}`)
            : (`${fmtMoney(rollup.totalCollected)} of ${fmtMoney(rollup.totalFee)} paid` + (rollup.mode==='individual'?' (Option B · Individual Shares)':' (Option A · Centralized)'))),
    },
    {
      done:decisionDone,
      active:inReviewPhase && status!=='withdrawn',
      label:status==='additional_info_required' ? 'Additional Information Required'
        : status==='under_review' ? 'Under Review'
        : decisionDone ? 'Underwriting Review Completed'
        : 'Under Review',
      sub:status==='additional_info_required'
        ? (app.additional_info_note || 'Please upload the requested information or documents below.')
        : status==='under_review'
          ? 'Your application and screening details are being evaluated by our underwriting team.'
          : decisionDone ? 'Evaluation complete.' : 'Begins once required screening payments are completed.',
    },
    {
      done:decisionDone,
      active:status==='waitlisted',
      label:status==='approved' ? 'Approved' : status==='denied' ? 'Not Approved' : status==='waitlisted' ? 'Waitlisted' : 'Application Decision',
      sub:status==='approved'
        ? 'Your application was approved. Proceed to unit reservation and lease signing.'
        : status==='denied'
          ? 'Your application was not approved for this property.'
          : status==='waitlisted'
            ? 'You are on our waitlist. We will contact you if a unit opens.'
            : 'Decisions typically arrive within 24 to 48 hours after screening completes.',
    },
    {
      done:['signed','co_signed'].includes(leaseStatus),
      active:leaseStatus==='sent'||leaseStatus==='awaiting_co_sign',
      label:leaseStatus==='co_signed'?'Lease Fully Executed':leaseStatus==='signed'?'Lease Signed':leaseStatus==='sent'?'Lease Ready to Sign':leaseStatus==='awaiting_co_sign'?'Awaiting Co-Signature':'Lease Agreement',
      sub:leaseStatus==='co_signed'?'All parties have signed — fully executed.':leaseStatus==='signed'?'Signed on '+fmtDateShort(app.lease_signed_date):leaseStatus==='sent'?'Your lease is ready. Please sign as soon as possible.':leaseStatus==='awaiting_co_sign'?'Waiting for all required household signers.':'Will be prepared after approval.',
    },
    {
      done:miStatus==='confirmed'||miStatus==='completed',
      active:miStatus==='scheduled',
      label:miStatus==='confirmed'?'Move-In Confirmed':miStatus==='scheduled'?'Move-In Scheduled':'Move-In',
      sub:app.move_in_date_actual?'Date: '+fmtDate(app.move_in_date_actual):app.lease_start_date?'Lease starts '+fmtDate(app.lease_start_date):'To be scheduled after lease is signed.',
    },
  ];

  const stepsHtml=steps.map((s,i)=>{
    const cls=s.done?'step-done':s.active?'step-active':'step-wait';
    const icon=s.done
      ?'<svg class="ico"><use href="#i-check"/></svg>'
      :s.active
        ?'<svg class="ico"><use href="#i-clock"/></svg>'
        :String(i+1);
    return `<li class="step-item">
      <span class="step-icon ${cls}">${icon}</span>
      <div><div class="step-text">${s.label}</div><div class="step-sub">${s.sub}</div></div>
    </li>`;
  }).join('');

  const nextStep = nextStepFor(app);
  const heroHtml = renderHero(app, nextStep);
  const progressHtml = renderProgress(steps);

  // Additional Information Required amber banner
  const infoReqHtml = status === 'additional_info_required'
    ? `<div class="info-req-card">
        <div class="info-req-title">&#9888; Additional Information Required</div>
        <p style="font-size:.84rem;color:var(--text);margin:0;line-height:1.5">Our underwriting team needs the following details or documents to complete your review:</p>
        <div class="info-req-note">${esc(app.additional_info_note || 'Please upload updated proof of income, ID, or supporting documents in the Documents section below.')}</div>
        <a href="#doc-checklist-card" class="btn-sign" style="display:inline-flex;background:#b45309;font-size:.82rem;padding:10px 16px">Upload Requested Documents &darr;</a>
      </div>`
    : '';

  // Lease actions
  let leaseHtml='';
  if(leaseStatus==='sent'&&app.tenant_sign_token){
    leaseHtml=`<div class="lease-section"><a href="/lease-sign.html?token=${esc(app.tenant_sign_token)}" class="btn-sign">&#9998; Sign Your Lease</a></div>`;
  } else if(leaseStatus==='signed'||leaseStatus==='co_signed'){
    leaseHtml=`<div class="lease-section"><button class="btn-download" type="button" data-action="download-lease">&#8595; Download Lease</button></div>`;
  }

  // Phase 8 closeout — Move-in / move-out inspection wizard CTA.
  if(leaseStatus==='co_signed' && app.id){
    leaseHtml += `<div class="lease-section" style="margin-top:var(--sp-3)">`
      + `<a href="/tenant/inspection.html?app=${esc(app.id)}&amp;app_id=${esc(app.app_id||'')}&amp;type=move_in" class="btn-sign" style="background:linear-gradient(135deg,#0891b2,#06b6d4);box-shadow:0 4px 14px rgba(8,145,178,.25)">`
      +   `&#128247; Complete Move-In Inspection`
      + `</a>`
      + `<div style="font-size:.76rem;color:var(--muted);margin-top:8px;text-align:center;line-height:1.5">`
      +   `Document the property's condition with photos before move-in. Required to protect your security deposit in many states.`
      + `</div>`
      + `</div>`;
  }

  // Not Approved card (DB value: 'denied')
  let deniedHtml='';
  if(status==='denied'){
    deniedHtml=`<div class="denied-card">
      <div class="denied-title">Not Approved</div>
      <p style="color:#7f1d1d;font-size:.85rem;line-height:1.65;margin-bottom:10px">We were unable to approve your application for this property at this time based on our standard screening criteria.</p>
      <p style="color:var(--muted);font-size:.82rem;line-height:1.65">You are welcome to apply for other available properties. Browse our listings or call us at <strong style="color:var(--text)">707-706-3137</strong> to discuss your options.</p>
      <a href="/listings.html" style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:8px 16px;background:#dbeafe;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:8px;font-size:.8rem;font-weight:600;text-decoration:none">Browse Available Listings &rarr;</a>
    </div>`;
  }

  // Waitlisted card
  let waitlistHtml='';
  if(status==='waitlisted'){
    waitlistHtml=`<div class="waitlist-card">
      <div class="waitlist-title">You're on the Waitlist</div>
      <p style="color:#581c87;font-size:.85rem;line-height:1.65">You have been added to the waitlist for this property. We will contact you as soon as it becomes available or a comparable unit opens up.</p>
      <p style="color:var(--muted);font-size:.82rem;margin-top:8px">In the meantime, feel free to browse our other available listings. Questions? Call <strong style="color:var(--text)">707-706-3137</strong>.</p>
      <a href="/listings.html" style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:8px 16px;background:#f3e8ff;border:1px solid #d8b4fe;color:#6b21a8;border-radius:8px;font-size:.8rem;font-weight:600;text-decoration:none">Browse Available Listings &rarr;</a>
    </div>`;
  }

  // Move-in card
  let moveInHtml='';
  if(miStatus==='confirmed'||miStatus==='scheduled'){
    moveInHtml=`<div class="section"><div class="section-label">Move-In Details</div>
      <div class="movein-card">
        <div class="movein-title">${miStatus==='confirmed'?'&#10003; Move-In Confirmed':'&#128197; Move-In Scheduled'}</div>
        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">Move-In Date</span><span class="meta-val">${fmtDate(app.move_in_date_actual||app.lease_start_date)}</span></div>
          <div class="meta-item"><span class="meta-label">Property</span><span class="meta-val">${esc(app.property_address||'—')}</span></div>
          ${app.monthly_rent?`<div class="meta-item"><span class="meta-label">Monthly Rent</span><span class="meta-val">${fmtMoney(app.monthly_rent)}</span></div>`:''}
          ${app.move_in_notes?`<div class="meta-item" style="grid-column:1/-1"><span class="meta-label">Notes from Team</span><span class="meta-val" style="font-weight:400;color:var(--muted)">${esc(app.move_in_notes)}</span></div>`:''}
        </div>
      </div></div>`;
  }

  const withdrawHtml=(['pending','under_review','additional_info_required'].includes(status)&&leaseStatus==='none')
    ?`<button class="btn-withdraw" type="button" data-action="withdraw">&#215; Withdraw Application</button>`:'';

  // Admin notes — visible message from the team
  const adminNotesHtml=app.admin_notes
    ?`<div class="section"><div class="section-label">Message from our team</div>
      <div class="card" style="background:#eff6ff;border:1px solid #bfdbfe;padding:16px 20px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:1rem">&#128172;</span>
          <span style="font-size:.75rem;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.06em">Note from Choice Properties</span>
        </div>
        <p style="color:var(--text);font-size:.88rem;line-height:1.7;white-space:pre-wrap">${esc(app.admin_notes)}</p>
      </div></div>`
    :'';

  const reservationAgreementHtml = renderReservationAgreement(app);

  return `
    <div id="prop-hero-slot"><div class="prop-hero"><div class="prop-hero-skel"></div></div></div>
    ${heroHtml}
    ${infoReqHtml}
    ${reservationAgreementHtml}
    <div class="section">
      <div class="section-label">Your Application</div>
      <div class="card">
        <div class="status-header">
          <div>
            <div class="status-name">${name}</div>
            <div class="status-prop"><svg class="ico" style="color:var(--muted)"><use href="#i-pin"/></svg>${prop}</div>
          </div>
          <div class="badges-group">${statusBadge(status)}${paymentBadge(app)}${leaseBadge(leaseStatus)}</div>
        </div>
        ${progressHtml}
        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">App ID</span><span class="meta-val" style="font-family:monospace;font-size:.78rem">${esc(app.app_id||app.id)}</span></div>
          <div class="meta-item"><span class="meta-label">Submitted</span><span class="meta-val">${fmtDateShort(app.created_at)}</span></div>
          ${app.monthly_rent?`<div class="meta-item"><span class="meta-label">Monthly Rent</span><span class="meta-val">${fmtMoney(app.monthly_rent)}</span></div>`:''}
        </div>
        <hr class="divider">
        <div class="pipeline-label">Application Status</div>
        <ul class="step-list">${stepsHtml}</ul>
        ${leaseHtml}
        ${deniedHtml}
        ${waitlistHtml}
        ${withdrawHtml}
      </div>
    </div>
    ${adminNotesHtml}
    ${moveInHtml}
    ${renderPaymentStatus(app)}
    ${renderHouseholdSection(app, _portalApplicants)}
    ${renderCreditsSection(_portalCredits)}
    ${renderSubmittedDocs(app)}
    ${renderDocUpload(app)}
    ${renderActivityFeed(app)}
    <div class="trust-strip" aria-label="Privacy and security">
      <span><svg class="ico"><use href="#i-shield"/></svg>Documents encrypted in transit &amp; at rest</span>
      <span><svg class="ico"><use href="#i-check"/></svg>Identity verified securely</span>
      <span><svg class="ico"><use href="#i-spark"/></svg>Live updates from your team</span>
    </div>
    <div class="portal-footer">
      Questions? Text our leasing team: <a href="tel:7077063137">707-706-3137 (Text Only)</a>
    </div>`;
}

async function downloadLease(){
  try{
    const {data:sd}=await getSB().auth.getSession();
    const token=sd?.session?.access_token;
    if(!token){showToast('Please sign in again.','danger');return;}
    const res=await fetch(CONFIG.SUPABASE_URL+'/functions/v1/download-lease',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':CONFIG.SUPABASE_ANON_KEY,'Authorization':'Bearer '+token},
      body:JSON.stringify({app_id:window._portalAppId}),
    });
    const d=await res.json();
    const signedUrl=d.signed_url||d.signedUrl;
    if(signedUrl) openExternalUrl(signedUrl);
    else showToast(d.error||'Could not get download link.','danger');
  }catch(e){showToast(e.message||'Download failed.','danger');}
}

function askWithdrawConfirmation(){
  const overlay=document.getElementById('portal-modal');
  const cancelBtn=document.getElementById('portal-modal-cancel');
  const confirmBtn=document.getElementById('portal-modal-confirm');
  const reasonEl=document.getElementById('portal-modal-reason');
  if(!overlay||!cancelBtn||!confirmBtn) return Promise.resolve({confirmed:false,reason:''});
  if(reasonEl) reasonEl.value='';
  overlay.classList.add('open');
  return new Promise(resolve=>{
    const cleanup=(confirmed)=>{
      overlay.classList.remove('open');
      cancelBtn.removeEventListener('click',onCancel);
      confirmBtn.removeEventListener('click',onConfirm);
      overlay.removeEventListener('click',onBackdrop);
      resolve({confirmed,reason:(reasonEl?.value||'').trim()});
    };
    const onCancel=()=>cleanup(false);
    const onConfirm=()=>cleanup(true);
    const onBackdrop=(e)=>{if(e.target===overlay)cleanup(false);};
    cancelBtn.addEventListener('click',onCancel);
    confirmBtn.addEventListener('click',onConfirm);
    overlay.addEventListener('click',onBackdrop);
  });
}

async function withdrawApplication(){
  const {confirmed,reason}=await askWithdrawConfirmation();
  if(!confirmed) return;
  const sb=getSB();
  const {data:{session}}=await sb.auth.getSession();
  if(!session){
    showToast('Please sign in to withdraw this application.','warn');
    return;
  }
  const {data:wdRes,error}=await sb.rpc('withdraw_my_application',{
    p_app_id:window._portalAppId,
    p_reason:reason||null,
  });
  if(error||!wdRes?.success){
    const msg=wdRes?.error||error?.message||'Could not process withdrawal automatically.';
    showToast(msg,'danger');
    const ct=document.getElementById('portal-content');
    if(ct&&error){
      ct.insertAdjacentHTML('afterbegin',`<div class="error-card" style="margin-bottom:16px">${esc(msg)}<br><br>
        Need help? <a href="tel:7077063137" style="color:#1d4ed8;font-weight:700">707-706-3137 (Text Only)</a> &middot;
        Reference: <span style="font-family:monospace">${esc(window._portalAppId||'')}</span></div>`);
    }
    return;
  }
  try{
    if(session?.access_token){
      fetch(CONFIG.SUPABASE_URL+'/functions/v1/send-email',{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':CONFIG.SUPABASE_ANON_KEY,'Authorization':'Bearer '+session.access_token},
        body:JSON.stringify({type:'custom',subject:'Application Withdrawn — '+window._portalAppId,html:`<p>Application <strong>${esc(window._portalAppId)}</strong> has been withdrawn by the tenant (${esc(session.user?.email||'')}).</p>${reason?`<p>Reason: ${esc(reason)}</p>`:''}`}),
      }).catch(()=>{});
    }
  }catch(_){}
  document.getElementById('portal-content').innerHTML=`<div class="card" style="text-align:center;padding:36px">
    <div style="font-size:2.2rem;margin-bottom:14px;color:#15803d">&#10003;</div>
    <h3 style="color:var(--text);margin-bottom:8px">Application Withdrawn</h3>
    <p style="color:var(--muted);font-size:.88rem;line-height:1.65">Your application has been withdrawn. If you'd like to reapply in the future, please contact us at <a href="tel:7077063137" style="color:#1d4ed8">707-706-3137</a>.</p>
  </div>`;
}

// ── Auto-claim applications linked by email ──────────────────────────────────
async function autoClaimApplications(sb, userEmail){
  try{
    const {data:lookupResult,error}=await sb.rpc('get_apps_by_email',{p_email:userEmail});
    if(error||!lookupResult)return;
    const apps=typeof lookupResult==='string'?JSON.parse(lookupResult):lookupResult;
    if(!Array.isArray(apps)||!apps.length)return;
    for(const a of apps){
      if(a.app_id){
        await sb.rpc('claim_application',{p_app_id:a.app_id,p_email:userEmail}).catch(()=>{});
      }
    }
  }catch(_){}
}

function normalizePortalAppId(raw){
  const trimmed=String(raw||'').trim();
  if(!trimmed)return '';
  return /^cp-/i.test(trimmed)?trimmed.toUpperCase():trimmed;
}

function clearPendingLocalApp(appId){
  try{
    const raw=localStorage.getItem('cpLastSubmittedApplication');
    if(!raw)return;
    const parsed=JSON.parse(raw);
    if(parsed&&(!appId||normalizePortalAppId(parsed.app_id)===normalizePortalAppId(appId))){
      localStorage.removeItem('cpLastSubmittedApplication');
    }
  }catch(_){}
}

function getRequestedAppId(){
  const params=new URLSearchParams(window.location.search);
  const direct=(params.get('app_id')||params.get('app')||params.get('id')||'').trim();
  if(direct){
    const normalized=normalizePortalAppId(direct);
    if(normalized)sessionStorage.setItem('pendingPortalAppId',normalized);
    return normalized;
  }
  if(params.get('signed_out')==='1') return '';
  let localAppId='';
  try{
    const rawLocal=localStorage.getItem('cpLastSubmittedApplication');
    if(rawLocal){
      const parsed=JSON.parse(rawLocal);
      if(parsed?.app_id) localAppId=String(parsed.app_id).trim();
    }
  }catch(_){}
  const raw=(sessionStorage.getItem('pendingPortalAppId')||sessionStorage.getItem('lastSuccessAppId')||localAppId||'').trim();
  const appId=normalizePortalAppId(raw);
  if(appId)sessionStorage.setItem('pendingPortalAppId',appId);
  return appId;
}

async function loadGuestApplication(appId){
  const loading=document.getElementById('portal-loading');
  const content=document.getElementById('portal-content');
  const errorEl=document.getElementById('portal-error');

  try{
    const res=await fetch(CONFIG.SUPABASE_URL+'/functions/v1/get-tenant-portal-app',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':CONFIG.SUPABASE_ANON_KEY,
      },
      body:JSON.stringify({app_id:appId}),
    });
    if(!res.ok) return false;
    const d=await res.json().catch(()=>({}));
    if(!d||!d.success||!d.app) return false;

    const fullApp=d.app;
    const canonicalAppId=fullApp.app_id||appId;
    window._portalAppId=canonicalAppId;
    sessionStorage.setItem('pendingPortalAppId',canonicalAppId);
    if(fullApp.payment_status==='paid'||fullApp.payment_status==='waived'||Number(fullApp.application_fee||0)===0){
      clearPendingLocalApp(canonicalAppId);
    }
    window._activeGuestApp=fullApp;
    _portalApplicants=Array.isArray(d.applicants)?d.applicants:[];
    _portalCredits=Array.isArray(d.credits)?d.credits:[];
    _portalDocs=Array.isArray(d.docs)?d.docs:[];
    _portalReceipts=Array.isArray(d.receipts)?d.receipts:[];
    _portalTransactions=Array.isArray(d.transactions)?d.transactions:[];

    if(loading)loading.style.display='none';
    if(content){
      content.style.display='block';
      content.innerHTML=renderPortal(fullApp);
      startCountdownTickers(content);
      populateDocChecklist(canonicalAppId, _portalDocs);
      loadSubmittedDocs(canonicalAppId);
      setupDropzone();

      if(d.property){
        const prop=Object.assign({},d.property,{_photo:d.property.property_photos?.[0]?.url||null});
        const slot=document.getElementById('prop-hero-slot');
        if(slot)slot.innerHTML=renderPropertyHero(fullApp,prop);
      }
    }
    return true;
  }catch(e){
    console.warn('Guest portal load exception:',e);
    return false;
  }
}

function renderInstantAccessLookup(prefillValue, noticeMsg){
  const loading=document.getElementById('portal-loading');
  const content=document.getElementById('portal-content');
  if(loading) loading.style.display='none';
  if(!content) return;
  content.style.display='block';
  content.innerHTML=`<div class="no-app" style="max-width:480px;margin:28px auto">
    <div style="font-size:2.2rem;margin-bottom:12px">&#128273;</div>
    <h3 style="margin-bottom:8px">Open Your Tenant Portal</h3>
    <p style="color:var(--muted);font-size:.86rem;line-height:1.6;margin-bottom:16px">
      ${esc(noticeMsg || 'Enter your Application Reference ID (e.g. CP-...) or your application email address to open your application dashboard immediately.')}
    </p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <input type="text" id="instant-portal-query" value="${esc(prefillValue||'')}" placeholder="Application ID (CP-...) or Email" autocomplete="email"
        style="flex:1;min-width:190px;padding:11px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:.88rem;font-family:inherit;-webkit-appearance:none">
      <button type="button" id="instant-portal-btn" data-action="instant-portal-lookup"
        style="padding:11px 18px;border-radius:8px;background:#1d4ed8;border:none;color:#fff;font-size:.86rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;min-height:44px">Open Portal</button>
    </div>
    <div id="instant-portal-msg" style="margin-top:8px;font-size:.8rem;color:#b91c1c;display:none;text-align:left"></div>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center">
      <a href="/listings.html" style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:8px;font-size:.82rem;font-weight:600;text-decoration:none">Browse Available Listings &rarr;</a>
      <a href="tel:7077063137" style="font-size:.8rem;color:var(--muted);text-decoration:none">Support: <strong style="color:var(--text)">707-706-3137</strong></a>
    </div>
  </div>`;
  const input = document.getElementById('instant-portal-query');
  if(input){
    input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') instantPortalLookup(); });
  }
}

async function instantPortalLookup(){
  const input = document.getElementById('instant-portal-query');
  const msg = document.getElementById('instant-portal-msg');
  const btn = document.getElementById('instant-portal-btn');
  if(!input || !msg) return;
  const raw = (input.value || '').trim();
  if(!raw){
    msg.textContent = 'Please enter your Application Reference ID or email address.';
    msg.style.display = 'block';
    return;
  }
  if(btn){ btn.disabled = true; btn.textContent = 'Opening…'; }
  msg.style.display = 'none';
  try{
    const sb = getSB();
    const isEmail = raw.includes('@');
    try{ await sb.auth.signOut(); }catch(_){}
    const res = await autoSignInWithEndpoint(sb, isEmail ? { email: raw.toLowerCase() } : { appId: normalizePortalAppId(raw) });
    if(res.ok && res.appId){
      location.href = '/tenant/portal.html?app_id=' + encodeURIComponent(res.appId);
      return;
    }
    if(!isEmail){
      const guestOk = await loadGuestApplication(normalizePortalAppId(raw));
      if(guestOk) return;
    }
    msg.textContent = res.error || 'No matching application was found. Check your Reference ID or email, or contact 707-706-3137.';
    msg.style.display = 'block';
  }catch(e){
    msg.textContent = e?.message || 'Unable to open portal right now. Please try again.';
    msg.style.display = 'block';
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = 'Open Portal'; }
  }
}

async function signOutAndRetry(){
  const requestedAppId=getRequestedAppId();
  try{await getSB().auth.signOut();}catch(_){}
  sessionStorage.removeItem('pendingPortalAppId');
  renderInstantAccessLookup(requestedAppId, 'Enter your Application Reference ID or email to open your application immediately.');
}

async function redirectWrongAccount(requestedAppId){
  const sb=getSB();
  try{await sb.auth.signOut();}catch(_){}
  if(requestedAppId){
    const params=new URLSearchParams(window.location.search);
    const res=await autoSignInWithEndpoint(sb,{appId:requestedAppId,applicantId:params.get('applicant_id')||''});
    if(res.ok&&res.session){
      const nextUrl='/tenant/portal.html?app_id='+encodeURIComponent(res.appId||requestedAppId);
      location.replace(nextUrl);
      return;
    }
    const guestOk=await loadGuestApplication(requestedAppId);
    if(guestOk)return;
  }
  sessionStorage.removeItem('pendingPortalAppId');
  renderInstantAccessLookup(requestedAppId, 'Enter your Application Reference ID or email to open your application.');
}

function renderWrongAccount(userEmail, requestedAppId, message){
  return `<div class="no-app">
    <h3>Switch Application Profile</h3>
    <p style="color:var(--muted);font-size:.88rem;line-height:1.65">
      This application link belongs to another household profile.<br><br>
      You are currently viewing as <strong style="color:var(--text)">${esc(userEmail)}</strong>.
    </p>
    <button class="btn-withdraw" type="button" data-action="signout-retry" style="margin-top:18px">&#8592; Open with Application ID or Email</button>
    ${requestedAppId?`<p style="margin-top:12px;font-size:.78rem;color:var(--muted)">Application: <span style="font-family:monospace">${esc(requestedAppId)}</span></p>`:''}
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
      <p style="font-size:.78rem;color:var(--muted);margin-bottom:6px"><strong style="color:var(--text)">Need to browse homes?</strong> <a href="/listings.html" style="color:#1d4ed8;font-weight:600">Browse Available Listings &rarr;</a></p>
      <p style="font-size:.78rem;color:var(--muted)">Need help? <a href="tel:7077063137" style="color:#1d4ed8">707-706-3137 (Text Only)</a></p>
    </div>
  </div>`;
}

// ── Magic link session resolver ───────────────────────────────────────────────
// Magic links land here in THREE possible forms; the client must handle all
// three explicitly because supabase-js with flowType:'pkce' will ONLY
// auto-process `?code=` and ignores hash-fragment tokens.
//
//   1. Hash tokens   #access_token=...&refresh_token=...
//   2. token_hash    ?token_hash=...&type=magiclink
//   3. PKCE code     ?code=...
async function waitForMagicLinkSession(sb){
  const hashStr = (window.location.hash || '').replace(/^#/, '');
  const hashParams = new URLSearchParams(hashStr);
  const qsParams   = new URLSearchParams(window.location.search || '');

  const accessToken  = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const tokenHash    = qsParams.get('token_hash');
  const tokenType    = qsParams.get('type');
  const codeParam    = qsParams.get('code');
  const errParam     = hashParams.get('error') || qsParams.get('error');

  if(errParam){
    const desc = hashParams.get('error_description') || qsParams.get('error_description') || errParam;
    console.warn('Magic link error:', desc);
    return {error: decodeURIComponent(desc.replace(/\+/g,' '))};
  }

  if(accessToken && refreshToken){
    try{
      const {data, error} = await sb.auth.setSession({access_token: accessToken, refresh_token: refreshToken});
      if(!error && data && data.session) return data.session;
      if(error) console.warn('setSession from hash failed:', error.message);
    }catch(e){ console.warn('setSession threw:', e); }
  }

  if(tokenHash && tokenType){
    try{
      const {data, error} = await sb.auth.verifyOtp({token_hash: tokenHash, type: tokenType});
      if(!error && data && data.session) return data.session;
      if(error) console.warn('verifyOtp failed:', error.message);
    }catch(e){ console.warn('verifyOtp threw:', e); }
  }

  if(codeParam){
    try{
      const {data:{session:existing}} = await sb.auth.getSession();
      if(existing) return existing;
    }catch(_){}

    return new Promise(resolve => {
      let sub=null;
      const t=setTimeout(()=>{ try{sub&&sub.unsubscribe();}catch(_){} resolve(null); }, 15000);
      const {data} = sb.auth.onAuthStateChange((event, session) => {
        if((event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION') && session){
          clearTimeout(t);
          try{ data.subscription.unsubscribe(); }catch(_){}
          resolve(session);
        }
      });
      sub = data.subscription;
    });
  }

  return null;
}

// ── CSP-safe image error fallback for prop-hero photo ────────────────────────
// Replaces the inline onerror="..." attribute (blocked by nonce CSP) with a
// delegated capture listener. When the hero property photo fails to load,
// swap it for the placeholder div.
document.addEventListener('error', function(e) {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.heroFallback) return;
  const placeholder = document.createElement('div');
  placeholder.className = 'prop-hero-img is-placeholder';
  placeholder.textContent = 'Your future home';
  if (img.parentNode) img.parentNode.replaceChild(placeholder, img);
}, true);

// ── CSP-safe delegated event handlers ────────────────────────────────────────
document.addEventListener('click', function(e){
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const action = btn.dataset.action;
  switch(action){
    case 'sign-out':            return signOut();
    case 'signout-retry':       return signOutAndRetry();
    case 'instant-portal-lookup': return instantPortalLookup();
    case 'withdraw':            return withdrawApplication();
    case 'download-lease':      return downloadLease();
    case 'dl-submitted-doc':    return downloadSubmittedDoc(btn.dataset.path, btn.dataset.bucket);
    case 'lookup-app-id':       return lookupByAppId();
    case 'switch-app':          return window._switchApp && window._switchApp(btn.dataset.appId);
    case 'choose-file': {
      const target = document.getElementById(btn.dataset.target);
      if(target) target.click();
      return;
    }
  }
  // Whole-card tap on a doc checklist row (mobile grid).
  const docCard = e.target.closest('.doc-check');
  if(docCard && !e.target.closest('button,a,input')){
    const fi = docCard.querySelector('input[type=file][data-doc-type]');
    if(fi) fi.click();
  }
});
document.addEventListener('change', function(e){
  const input = e.target.closest('input[type=file][data-doc-type]');
  if(!input || !input.files || !input.files[0]) return;
  uploadDoc(input.dataset.docType, input.dataset.appId, input.id, input.dataset.statusId);
});

document.addEventListener('DOMContentLoaded',async()=>{
  initTheme();
  const ready=await waitForSB(8000);
  if(!ready){
    document.getElementById('portal-loading').innerHTML='<div class="error-card">Page failed to load. Please refresh.</div>';
    return;
  }

  const sb=getSB();
  const urlParams=new URLSearchParams(window.location.search);
  const requestedAppId=getRequestedAppId();
  const requestedApplicantId=(urlParams.get('applicant_id')||'').trim();
  const requestedEmail=(urlParams.get('email')||'').trim().toLowerCase();
  const requestedReceiptId=(urlParams.get('receipt_id')||'').trim();

  const magicResult = await waitForMagicLinkSession(sb);

  // Capture ?next= from the ORIGINAL URL before the auth-token cleanup below
  // strips all params.
  const nextRawBeforeClean = urlParams.get('next') || '';

  const hadAuthInUrl = !!(window.location.hash || /[\?&](code|token_hash|error)=/.test(window.location.search));
  if(hadAuthInUrl){
    const cleanUrl = window.location.pathname + (requestedAppId ? '?app_id='+encodeURIComponent(requestedAppId) : '');
    history.replaceState(null, '', cleanUrl);
  }

  let magicSession = (magicResult && !magicResult.error) ? magicResult : null;
  if(magicResult && magicResult.error){
    if(requestedAppId || requestedEmail || requestedReceiptId){
      const recovered = await autoSignInWithEndpoint(sb, {
        appId: requestedAppId,
        applicantId: requestedApplicantId,
        receiptId: requestedReceiptId,
        email: requestedEmail,
      });
      if(recovered.ok && recovered.session) magicSession = recovered.session;
    }
  }

  const {data:{session}} = await sb.auth.getSession();
  let activeSession = magicSession || session;

  if(!activeSession){
    const autoRes = await autoSignInWithEndpoint(sb, {
      appId: requestedAppId,
      applicantId: requestedApplicantId,
      receiptId: requestedReceiptId,
      email: requestedEmail,
    });
    if(autoRes.ok && autoRes.session){
      activeSession = autoRes.session;
      if(autoRes.appId && !requestedAppId){
        requestedAppId = autoRes.appId;
      }
    }
  }

  if(!activeSession){
    const loaded = await loadGuestApplication(requestedAppId || 'latest');
    if(loaded) return;
    renderInstantAccessLookup(requestedAppId || requestedEmail || '');
    return;
  }

  let userEmail=(activeSession.user.email||'').toLowerCase();
  _portalUserEmail = userEmail;
  const emailEl=document.getElementById('user-email');
  if(emailEl)emailEl.textContent=userEmail;

  // Deep-link redirect inside /tenant/* if ?next= was passed cleanly.
  const nextRaw = nextRawBeforeClean || new URLSearchParams(window.location.search).get('next') || '';
  const nextOk = typeof nextRaw === 'string'
    && nextRaw.startsWith('/')
    && !nextRaw.startsWith('//')
    && !nextRaw.includes('\\')
    && /^\/tenant\//.test(nextRaw);
  if (nextOk) {
    location.replace(nextRaw);
    return;
  }

  const loading=document.getElementById('portal-loading');
  const content=document.getElementById('portal-content');
  const errorEl=document.getElementById('portal-error');

  if(requestedAppId){
    const {data:claimResult,error:claimErr}=await sb.rpc('claim_application',{p_app_id:requestedAppId,p_email:userEmail});
    if(claimErr||claimResult?.success===false){
      // Seamlessly switch to the application's authoritative owner session via auto-login
      try{ await sb.auth.signOut(); }catch(_){}
      const switched = await autoSignInWithEndpoint(sb, {
        appId: requestedAppId,
        applicantId: requestedApplicantId,
        receiptId: requestedReceiptId,
        email: requestedEmail,
      });
      if(switched.ok && switched.session){
        userEmail = (switched.session.user.email || '').toLowerCase();
        _portalUserEmail = userEmail;
        if(emailEl) emailEl.textContent = userEmail;
        const {data:c2,error:e2}=await sb.rpc('claim_application',{p_app_id:requestedAppId,p_email:userEmail});
        if(e2||c2?.success===false){
          const guestOk=await loadGuestApplication(requestedAppId);
          if(guestOk) return;
          renderInstantAccessLookup(requestedAppId);
          return;
        }
      } else {
        const guestOk=await loadGuestApplication(requestedAppId);
        if(guestOk) return;
        renderInstantAccessLookup(requestedAppId);
        return;
      }
    }
  }

  const {data:rpcResult,error:rpcErr}=await sb.rpc('get_my_applications');
  let myApps=[];
  if(!rpcErr&&rpcResult?.success&&Array.isArray(rpcResult.applications)){
    myApps=rpcResult.applications;
  }

  if(!myApps.length){
    await autoClaimApplications(sb,userEmail);
    const {data:r2}=await sb.rpc('get_my_applications');
    if(r2?.success&&Array.isArray(r2.applications)) myApps=r2.applications;
  }

  loading.style.display='none';
  content.style.display='block';

  if(!myApps.length){
    content.innerHTML=`<div class="no-app">
      <div style="font-size:2.4rem;margin-bottom:14px">&#128269;</div>
      <h3 style="margin-bottom:10px">No application found</h3>
      <p style="color:var(--muted);font-size:.87rem;line-height:1.7;margin-bottom:6px">
        We searched for an application linked to<br>
        <strong style="color:var(--text);font-size:.92rem">${esc(userEmail)}</strong>
      </p>
      <p style="color:var(--muted);font-size:.82rem;line-height:1.65;margin-bottom:18px">
        Make sure you are signed in with the exact email address you used on your rental application — even a slight difference (like a period or extra letter) will prevent a match.
      </p>

      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:18px;text-align:left">
        <div style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Open by Application ID or Email</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="text" id="manual-app-id" placeholder="e.g. CP-20260420-ABC123 or email" autocomplete="off"
            style="flex:1;min-width:160px;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:.85rem;font-family:inherit;-webkit-appearance:none">
          <button type="button" data-action="lookup-app-id" style="padding:9px 16px;border-radius:8px;background:#1d4ed8;border:none;color:#fff;font-size:.83rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap">Open Portal</button>
        </div>
        <div id="appid-msg" style="margin-top:8px;font-size:.78rem;color:var(--muted);display:none"></div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">
        <a href="/listings.html" style="flex:1;min-width:160px;display:inline-flex;align-items:center;justify-content:center;background:#1d4ed8;color:#fff;padding:11px 18px;border-radius:9px;text-decoration:none;font-size:.86rem;font-weight:600;min-height:44px">Browse Available Listings &rarr;</a>
        <button type="button" data-action="sign-out" style="flex:1;min-width:160px;background:#dbeafe;border:1px solid #bfdbfe;color:#1d4ed8;padding:11px 18px;border-radius:9px;cursor:pointer;font-family:inherit;font-size:.86rem;font-weight:600;touch-action:manipulation;min-height:44px">Try Different Email / ID</button>
      </div>

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);text-align:left">
        <p style="font-size:.79rem;color:var(--muted);margin-bottom:6px"><strong style="color:var(--text)">Co-applicant, guarantor, or co-signer?</strong> Enter your email or Application Reference ID above to open your application immediately.</p>
        <p style="font-size:.79rem;color:var(--muted)">Still need help? <a href="tel:7077063137" style="color:#1d4ed8;font-weight:600">Call or text 707-706-3137 (Text Only)</a></p>
      </div>
    </div>`;
    return;
  }

  const summary=requestedAppId
    ? (myApps.find(a=>normalizePortalAppId(a.app_id||a.id)===normalizePortalAppId(requestedAppId))||myApps[0])
    : myApps[0];

  if(!summary){
    content.innerHTML=renderWrongAccount(userEmail,requestedAppId,'This application is not linked to the current signed-in email.');
    return;
  }

  window._portalAppId=summary.app_id||summary.id;
  sessionStorage.setItem('pendingPortalAppId',window._portalAppId);

  async function loadAndRenderApp(appId){
    window._portalAppId=appId;
    sessionStorage.setItem('pendingPortalAppId',appId);

    // Phase 2 — single-shot tenant_portal_state RPC. Returns app +
    // property + cover_photo + documents in one round-trip. If the
    // function is missing on this Supabase project (e.g., migration
    // not applied yet) or the call fails for any reason, we fall back
    // to the legacy three-call path below — same as before this change.
    let fullApp = null;
    let prefetchedProperty = null;
    let prefetchedCoverPhoto = null;
    let prefetchedDocs = null;
    let prefetchedReceipts = [];
    let prefetchedTransactions = [];
    try {
      const { data:rpc, error:rpcErr } = await sb.rpc('tenant_portal_state', { p_app_id: appId });
      if(!rpcErr && rpc){
        if(rpc.success){
          fullApp = rpc.app;
          prefetchedProperty = rpc.property;
          prefetchedCoverPhoto = rpc.cover_photo;
          prefetchedDocs = rpc.documents;
        }
        if(Array.isArray(rpc.receipts)) prefetchedReceipts = rpc.receipts;
        if(Array.isArray(rpc.transactions)) prefetchedTransactions = rpc.transactions;
      } else if(rpc && rpc.success === false){
        // Server returned a structured error: not authenticated / not found / access denied.
        errorEl.style.display = 'block';
        errorEl.innerHTML = '<div class="error-card">' + esc(rpc.error || 'Could not load application') + '. Please refresh or <a href="tel:7077063137" style="color:#1d4ed8">call us</a>.</div>';
        return;
      }
    } catch(_) { /* legacy fallback */ }

    if(!fullApp){
      const baseAppSelect=
          'id,app_id,created_at,updated_at,status,payment_status,payment_date,application_fee,'+
          'payment_amount_recorded,payment_method_recorded,payment_notes,'+
          'holding_fee_requested,holding_fee_amount,holding_fee_due_date,holding_fee_paid,holding_fee_paid_at,'+
          'payment_confirmed_at,payment_amount_collected,payment_method_confirmed,'+
          'first_name,last_name,email,property_address,property_id,'+
          'lease_status,lease_sent_date,lease_signed_date,lease_start_date,lease_end_date,'+
          'monthly_rent,security_deposit,move_in_costs,'+
          'move_in_status,move_in_date_actual,move_in_notes,'+
          'tenant_sign_token,has_co_applicant,co_applicant_count,combined_monthly_income,monthly_income,credit_applied_id,last_contacted_at,admin_notes,desired_lease_term';
      const extAppSelect=baseAppSelect+
          ',household_payment_mode,additional_info_note,application_payment_state,payment_provider,payment_transaction_ref,payment_card_brand,payment_card_last4,payment_failure_code,payment_failure_reason,payment_attempts_count,payment_assistance_required'+
          ',selected_payment_method,external_payment_reference,payment_submitted_at'+
          ',household_monthly_income,guarantor_monthly_income,co_signer_monthly_income,total_financial_support,occupying_adult_count,guarantor_count,co_signer_count,fee_breakdown';
      let {data:legacyApp,error:fetchErr}=await sb.from('applications').select(extAppSelect).eq('app_id',appId).maybeSingle();
      if(!legacyApp && !fetchErr){
        const escaped=String(appId).replace(/[\\%_]/g,m=>'\\'+m);
        ({data:legacyApp,error:fetchErr}=await sb.from('applications').select(extAppSelect).ilike('app_id',escaped).maybeSingle());
      }
      if(fetchErr && _isMissingColErr(fetchErr)){
        ({data:legacyApp,error:fetchErr}=await sb.from('applications').select(baseAppSelect).eq('app_id',appId).maybeSingle());
        if(!legacyApp && !fetchErr){
          const escaped=String(appId).replace(/[\\%_]/g,m=>'\\'+m);
          ({data:legacyApp,error:fetchErr}=await sb.from('applications').select(baseAppSelect).ilike('app_id',escaped).maybeSingle());
        }
      }

      if(fetchErr||!legacyApp){
        errorEl.style.display='block';
        errorEl.innerHTML='<div class="error-card">Could not load application details. Please refresh or <a href="tel:7077063137" style="color:#1d4ed8">call us</a>.</div>';
        if(fetchErr)console.error('Portal fetch error:',fetchErr.message);
        return;
      }
      fullApp = legacyApp;
    }

    if(fullApp&&(fullApp.payment_status==='paid'||fullApp.payment_status==='waived'||Number(fullApp.application_fee||0)===0)){
      clearPendingLocalApp(fullApp.app_id||appId);
    }

    const fetchApplicants = async () => {
      const baseCols='id,app_id,applicant_index,applicant_type,is_primary,role,first_name,last_name,email,screening_consent,screening_consent_timestamp,lease_signature,lease_signed_at';
      const extCols=baseCols+',submission_method,info_completed,info_completed_at,housing_status,is_occupant,monthly_income,other_income,screening_fee_amount,payment_status,application_payment_state,payment_amount,payment_transaction_ref,payment_provider,payment_card_brand,payment_card_last4,payment_failure_code,payment_failure_reason,payment_attempts_count,payment_assistance_required,payment_confirmed_at,selected_payment_method,external_payment_reference,payment_submitted_at';
      let res=await sb.from('application_applicants').select(extCols).eq('app_id',appId).order('applicant_index',{ascending:true});
      if(res?.error && _isMissingColErr(res.error)){
        res=await sb.from('application_applicants').select(baseCols).eq('app_id',appId).order('applicant_index',{ascending:true});
      }
      return res;
    };

    const [applicantsRes, creditsRes, docsRes, receiptsRes, txRes] = await Promise.allSettled([
      fetchApplicants(),
      sb.from('application_credits')
        .select('id,original_app_id,total_credits,remaining_credits,issued_at,expires_at,status')
        .ilike('email', userEmail)
        .order('issued_at', { ascending: false }),
      sb.from('application_documents')
        .select('id,app_id,applicant_id,bucket,storage_path,original_file_name,doc_type,review_status,review_notes,uploaded_by_email,created_at')
        .eq('app_id', appId)
        .order('created_at', { ascending: false }),
      sb.from('payment_receipts')
        .select('id,app_id,applicant_id,receipt_type,receipt_number,amount,currency,payment_method,transaction_ref,paid_at,issued_at,status,fee_breakdown')
        .eq('app_id', appId)
        .in('status', ['issued', 'active'])
        .order('issued_at', { ascending: false }),
      sb.from('application_payment_transactions')
        .select('id,applicant_id,payer_name,transaction_ref,provider,state,amount,currency,card_brand,card_last4,failure_code,failure_reason,attempt_number,created_at')
        .eq('app_id', appId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    _portalApplicants = (applicantsRes.status === 'fulfilled' && Array.isArray(applicantsRes.value?.data))
      ? applicantsRes.value.data : [];
    _portalCredits = (creditsRes.status === 'fulfilled' && Array.isArray(creditsRes.value?.data))
      ? creditsRes.value.data : [];
    const tableDocs = (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value?.data))
      ? docsRes.value.data : (Array.isArray(prefetchedDocs) ? prefetchedDocs : []);
    _portalDocs = tableDocs;
    if(!prefetchedDocs && _portalDocs.length) prefetchedDocs = _portalDocs;
    _portalReceipts = (receiptsRes.status === 'fulfilled' && Array.isArray(receiptsRes.value?.data) && receiptsRes.value.data.length)
      ? receiptsRes.value.data : prefetchedReceipts;
    _portalTransactions = (txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data) && txRes.value.data.length)
      ? txRes.value.data : prefetchedTransactions;

    let switcherHtml='';
    if(myApps.length>1){
      const statusColor={pending:'#a16207',under_review:'#1d4ed8',additional_info_required:'#d97706',approved:'#15803d',denied:'#b91c1c',waitlisted:'#7e22ce',withdrawn:'#64748b'};
      const pills=myApps.map(a=>{
        const aId=a.app_id||a.id;
        const isActive=aId===appId;
        const col=statusColor[a.status]||'#64748b';
        const addr=esc((a.property_address||'Application').split(',')[0]);
        return `<button type="button" class="app-switch-pill" data-active="${isActive?'1':'0'}" data-action="switch-app" data-app-id="${esc(aId)}">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${col};margin-right:5px;vertical-align:middle"></span>
          ${addr}
        </button>`;
      }).join('');
      switcherHtml=`<div class="app-switch" role="tablist" aria-label="Switch application">${pills}</div>`;
    }

    content.innerHTML=switcherHtml+renderPortal(fullApp);
    // Live countdowns + the document checklist. When the portal-pulse RPC
    // returned docs, populateDocChecklist skips the storage.list round-trip.
    startCountdownTickers(content);
    populateDocChecklist(appId, _portalDocs.length ? _portalDocs : prefetchedDocs);
    loadSubmittedDocs(appId);
    setupDropzone();

    // Hydrate the property hero. When the portal-pulse RPC returned the
    // property + cover photo, render synchronously (zero extra round-trips).
    // Otherwise, fall back to fetchProperty() — same behaviour as before.
    if(prefetchedProperty){
      const prop = Object.assign({}, prefetchedProperty, { _photo: prefetchedCoverPhoto?.url || null });
      const slot = document.getElementById('prop-hero-slot');
      if(slot) slot.innerHTML = renderPropertyHero(fullApp, prop);
    } else if(fullApp.property_id){
      fetchProperty(fullApp.property_id).then(prop => {
        const slot = document.getElementById('prop-hero-slot');
        if(slot) slot.innerHTML = renderPropertyHero(fullApp, prop);
      }).catch(() => {
        const slot = document.getElementById('prop-hero-slot');
        if(slot) slot.innerHTML = renderPropertyHero(fullApp, null);
      });
    } else {
      const slot = document.getElementById('prop-hero-slot');
      if(slot) slot.innerHTML = renderPropertyHero(fullApp, null);
    }

    // Live updates: subscribe to this application's row.
    // Toast fires immediately on the first event so the tenant gets instant
    // feedback. Re-renders are debounced so that a burst of rapid admin edits
    // (e.g. setting rent + dates + status in quick succession) collapses into
    // a single RPC call instead of stacking concurrent fetches that could race.
    let _realtimeRenderTimer = null;
    setupRealtime(sb, fullApp.id, (payload) => {
      const next = payload && payload.new;
      if(!next) return;
      // Detect what changed (high-signal fields only) for a meaningful toast.
      const prev = window._portalAppSnapshot || {};
      let toastMsg = null, toastKind = 'info';
      if(prev.status !== next.status){
        if(next.status === 'approved'){ toastMsg = 'Your application was approved'; toastKind = 'success'; }
        else if(next.status === 'under_review'){ toastMsg = 'Your application is now under review'; toastKind = 'info'; }
        else if(next.status === 'additional_info_required'){ toastMsg = 'Additional information requested'; toastKind = 'warn'; }
        else if(next.status === 'denied'){ toastMsg = 'Status updated: Not Approved'; toastKind = 'warn'; }
        else if(next.status === 'waitlisted'){ toastMsg = 'You were added to the waitlist'; toastKind = 'info'; }
      }
      else if(prev.lease_status !== next.lease_status && (next.lease_status === 'sent' || next.lease_status === 'co_signed')){
        toastMsg = next.lease_status === 'sent' ? 'Your lease is ready to sign' : 'Your lease is fully executed';
        toastKind = 'success';
      }
      else if((prev.payment_status !== next.payment_status) && next.payment_status === 'paid'){
        toastMsg = 'Application fee received'; toastKind = 'success';
      }
      else if(prev.move_in_status !== next.move_in_status && next.move_in_status === 'confirmed'){
        toastMsg = 'Move-in confirmed'; toastKind = 'success';
      }
      else if(prev.admin_notes !== next.admin_notes && next.admin_notes){
        toastMsg = 'A new note from our team'; toastKind = 'info';
      }
      if(toastMsg) showToast(toastMsg, toastKind);
      // Re-render with the new row (this also rebuilds the activity feed).
      // Debounced: waits 600 ms after the last event before fetching, so a
      // rapid burst of admin saves collapses into one round-trip.
      clearTimeout(_realtimeRenderTimer);
      _realtimeRenderTimer = setTimeout(() => loadAndRenderApp(appId), 600);
    });
    window._portalAppSnapshot = fullApp;
  }

  window._switchApp=async function(appId){
    content.innerHTML='<div class="skeleton-set"><div class="skel skel-hero"></div><div class="skel-card"><div class="skel skel-line title"></div><div class="skel skel-line long"></div><div class="skel skel-line med"></div></div></div>';
    await loadAndRenderApp(appId);
  };

  await loadAndRenderApp(window._portalAppId);
});
