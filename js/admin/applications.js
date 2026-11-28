(function(){
  'use strict';
  // I-410: Inline scripts run before deferred scripts. window.AdminShell is
  // undefined at this point, so the previous early-return left the page
  // spinning forever. Use the same waitReady pattern as the working pages.
  function readyDeps(){ return window.AdminShell && window.CP && CP.Applications && CP.Auth; }
  function waitReady(ms){
    return new Promise((res,rej)=>{
      const start=Date.now();
      (function tick(){
        if(readyDeps()) return res();
        if(Date.now()-start>ms) return rej(new Error('Admin tools failed to load.'));
        setTimeout(tick,80);
      })();
    });
  }
  let S; // assigned after waitReady resolves

  let _allData=[], _status='all', _search='', _payFilter='', _debounce;
  // Bulk-selection state. Set of application UUIDs (db id) currently checked.
  // Cleared whenever loadApps() runs so stale selections never linger after
  // a filter / search change.
  const _selected = new Set();
  const _detailState = new Map();
  const _ssnTimers = new Map();

  // ───── URL pre-seed (so dashboard deep-links with ?status=… or ?pay=… work) ─────
  try {
    const usp = new URLSearchParams(location.search);
    if(usp.get('status')) _status = usp.get('status');
    if(usp.get('pay')) _payFilter = usp.get('pay');
  } catch{}

  function fmtDate(d){ if(!d) return '—'; try{ return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }catch{ return d; } }
  function fmtMoney(v){ if(v==null||v==='') return '—'; return '$' + Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function avatar(app){
    const initials = S.initials(app.first_name, app.last_name);
    const seed = app.email || (app.first_name||'') + (app.last_name||'');
    return `<div class="avatar" style="background:${S.avatarColor(seed)}">${S.esc(initials)}</div>`;
  }

  function statusBadge(s){
    const m={pending:'b-pending',under_review:'b-under_review',additional_info_required:'b-additional_info_required',approved:'b-approved',denied:'b-denied',waitlisted:'b-waitlisted',withdrawn:'b-withdrawn',archived:'b-archived'};
    const l={pending:'Pending',under_review:'Under Review',additional_info_required:'Additional Info Required',approved:'Approved',denied:'Not Approved',waitlisted:'Waitlisted',withdrawn:'Withdrawn',archived:'Archived'};
    return `<span class="badge ${m[s]||'b-pending'}">${S.esc(l[s]||s||'—')}</span>`;
  }
  function formatManualMethod(method, other){
    const m = String(method || '').trim();
    if(!m) return '';
    if(m === 'Other' && other && String(other).trim()) return 'Other (' + String(other).trim() + ')';
    return m;
  }
  function payBadge(app){
    const s = typeof app === 'string' ? app : String(app?.payment_status || 'unpaid').toLowerCase();
    const m = { paid:'b-paid', unpaid:'b-unpaid', waived:'b-waived', refunded:'b-refunded' };
    const l = { paid:'Fee paid', unpaid:'Fee unpaid', waived:'Fee waived', refunded:'Refunded' };
    return `<span class="badge ${m[s]||'b-unpaid'}">${S.esc(l[s]||s||'—')}</span>`;
  }
  function leaseBadge(s){
    if(!s||s==='none') return '';
    const m={sent:'b-lease-sent',signed:'b-lease-signed',co_signed:'b-lease-signed',awaiting_co_sign:'b-lease-sent'};
    const l={sent:'Lease sent',signed:'Lease signed',co_signed:'Fully executed',awaiting_co_sign:'Awaiting co-sign',voided:'Voided',expired:'Expired'};
    return `<span class="badge ${m[s]||''}">${S.esc(l[s]||s)}</span>`;
  }

  function getRules(){
    return (window.CP && window.CP.HouseholdRules) || {
      normalizeApplicantType: (v, isPrim) => {
        if(isPrim) return 'primary';
        const r = String(v||'').toLowerCase().replace(/[\s-]+/g,'_');
        if(r.includes('guarantor')) return 'guarantor';
        if(r.includes('co_signer')||r.includes('cosigner')) return 'co_signer';
        return 'co_applicant';
      },
      normalizeSubmissionMethod: (v) => String(v||'').toLowerCase() === 'invited' ? 'invited' : 'primary_completed',
      isOccupyingRole: (t) => t === 'primary' || t === 'co_applicant',
      getRoleDisplayLabel: (t) => ({ primary:'Primary Applicant', guarantor:'Guarantor (Non-Occupying)', co_signer:'Co-Signer (Financial Support)', co_applicant:'Co-Applicant (Occupying Adult)' }[t] || 'Co-Applicant'),
      getShortRoleLabel: (t) => ({ primary:'Primary', guarantor:'Guarantor', co_signer:'Co-Signer', co_applicant:'Co-Applicant' }[t] || 'Co-Applicant'),
      getJurisdictionFeeNote: () => null,
      calculateHouseholdApplicationFee: (members = [], opts = {}) => {
        const list = Array.isArray(members) && members.length ? members : [{}];
        if(opts.creditApplied){
          return { totalFee: 0, standardFee: 0, feeBreakdown: [], occupyingAdultCount: Math.max(1, list.length), coApplicantCount: Math.max(0, list.length - 1), guarantorCount: 0, coSignerCount: 0, additionalCount: Math.max(0, list.length - 1), screenedAdultCount: list.length };
        }
        let occupyingCo = 0, total = 0;
        list.forEach((m, idx) => {
          const t = String(m.applicant_type || m.role || (idx === 0 ? 'primary' : 'co_applicant')).toLowerCase();
          if(idx === 0 || m.is_primary || t === 'primary'){ total += 50; }
          else if(!t.includes('guarantor') && !t.includes('signer')){
            occupyingCo++;
            total += (occupyingCo === 1 ? 0 : 50);
          } else { total += 50; }
        });
        return { totalFee: total, standardFee: total, feeBreakdown: [], occupyingAdultCount: Math.max(1, list.length), coApplicantCount: Math.max(0, list.length - 1), guarantorCount: 0, coSignerCount: 0, additionalCount: Math.max(0, list.length - 1), screenedAdultCount: list.length };
      },
      calculateHouseholdFinancials: (members = []) => {
        const tot = members.reduce((s, m) => s + numVal(m.monthly_income) + numVal(m.other_income), 0);
        return { primaryMonthlyIncome: tot, coApplicantMonthlyIncome: 0, householdMonthlyIncome: tot, guarantorMonthlyIncome: 0, coSignerMonthlyIncome: 0, totalFinancialSupport: tot, occupyingAdultCount: Math.max(1, members.length), guarantorCount: 0, coSignerCount: 0 };
      },
    };
  }

  function fmtFeeShort(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return '$50';
    return Number.isInteger(n) ? ('$' + n.toLocaleString('en-US')) : ('$' + n.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }));
  }

  // ───── Render card ─────
  function renderCard(app){
    const name = ((app.first_name||'') + ' ' + (app.last_name||'')).trim() || '(no name)';
    const prop = app.property_address || app.property_id || '—';
    const isPaid = app.payment_status === 'paid';
    const isWaived = app.payment_status === 'waived';
    const isApproved = app.status === 'approved';
    const isDenied = app.status === 'denied';
    const isWaitlisted = app.status === 'waitlisted';
    const isArchived = app.status === 'archived';
    const hfRequested = !!app.holding_fee_requested;
    const hfPaid = !!app.holding_fee_paid;
    const occCoCount = app.occupying_adult_count != null
      ? Math.max(0, Number(app.occupying_adult_count) - 1)
      : Math.max(0, Number(app.co_applicant_count || (app.has_co_applicant ? 1 : 0)) - Number(app.guarantor_count || 0) - Number(app.co_signer_count || 0));
    const gCount = Number(app.guarantor_count || 0);
    const csCount = Number(app.co_signer_count || 0);
    const appFeeNum = app.application_fee != null ? Number(app.application_fee) : 50;

    const prefPrimary = formatManualMethod(app.primary_payment_method, app.primary_payment_method_other);
    const hasRecorded = app.payment_amount_collected || app.payment_amount_recorded || app.payment_method_confirmed || app.payment_method_recorded || app.payment_confirmed_at || app.payment_date;
    const txRefShort = app.payment_transaction_ref ? ` · Ref ${S.esc(app.payment_transaction_ref)}` : '';
    const recordedMethod = app.payment_method_confirmed || app.payment_method_recorded || '';
    const paidDate = app.payment_confirmed_at || app.payment_date;
    const paymentInfo = (isPaid && hasRecorded)
      ? `<span class="text-xs muted" style="font-variant-numeric:tabular-nums;">${fmtMoney(app.payment_amount_collected ?? app.payment_amount_recorded ?? appFeeNum)}${recordedMethod ? ' · ' + S.esc(recordedMethod) : ''}${txRefShort}${paidDate ? ' · ' + fmtDate(paidDate) : ''}</span>`
      : `<span class="text-xs muted" style="font-variant-numeric:tabular-nums;">${prefPrimary ? 'Pref: ' + S.esc(prefPrimary) + ' · ' : ''}Fee: ${fmtMoney(appFeeNum)}</span>`;

    const ds = `data-id="${S.esc(app.id)}" data-app-id="${S.esc(app.app_id||app.id)}" data-name="${S.esc(name)}" data-status="${S.esc(app.status||'')}"`;

    const checked = _selected.has(app.id) ? 'checked' : '';
    return `<div class="app-card" id="card-${S.esc(app.id)}">
      <div class="app-card-header" data-action="toggle" ${ds}>
        <input type="checkbox" class="bulk-cb" data-id="${S.esc(app.id)}" data-app-id="${S.esc(app.app_id||app.id)}" data-name="${S.esc(name)}" data-status="${S.esc(app.status||'')}" data-payment="${S.esc(app.payment_status||'')}" aria-label="Select ${S.esc(name)}" ${checked}>
        ${avatar(app)}
        <div class="app-info">
          <div class="app-id-row">
            <span>${S.esc(app.app_id||app.id)}</span>
            <span class="app-date">${fmtDate(app.created_at)}</span>
            ${occCoCount > 0 ? `<span class="badge b-co">${occCoCount > 1 ? '+' + occCoCount + ' Co-Apps' : '+1 Co-App'}</span>` : ''}
            ${gCount > 0 ? `<span class="badge b-co" style="background:rgba(124,58,237,.15);color:#c4b5fd">${gCount > 1 ? '+' + gCount + ' Guarantors' : '+1 Guarantor'}</span>` : ''}
            ${csCount > 0 ? `<span class="badge b-co" style="background:rgba(14,165,233,.15);color:#7dd3fc">${csCount > 1 ? '+' + csCount + ' Co-Signers' : '+1 Co-Signer'}</span>` : ''}
            ${appFeeNum > 50 ? `<span class="badge" style="background:rgba(37,99,235,.15);color:#93c5fd">Fee ${S.esc(fmtFeeShort(appFeeNum))}</span>` : ''}
            ${app.credit_applied_id ? '<span class="badge b-credit">Credit Applied</span>' : ''}
            ${app.has_pets ? '<span class="badge b-pets">Pets</span>' : ''}
          </div>
          <div class="app-name">${S.esc(name)}</div>
          <div class="app-addr">${S.esc(prop)}</div>
          <div class="badges-row">
            ${statusBadge(app.status)}
            ${payBadge(app)}
            ${leaseBadge(app.lease_status)}
            ${app.last_contacted_at ? `<span class="badge b-contacted" title="Contacted by ${S.esc(app.last_contacted_by||'admin')}">Contacted ${S.esc(S.fmtRelative(app.last_contacted_at))}</span>` : ''}
            ${paymentInfo}
          </div>
        </div>
        <svg class="i chev" id="chev-${S.esc(app.id)}"><use href="#i-arrow"/></svg>
      </div>

      <div class="card-actions">
        ${!isArchived && !isApproved   ? `<button class="btn-act btn-approve"  data-action="status" data-set="approved"   ${ds}><svg class="i i-sm"><use href="#i-check"/></svg> Approve</button>` : ''}
        ${!isArchived && app.status!=='under_review' ? `<button class="btn-act btn-review" data-action="status" data-set="under_review" ${ds}><svg class="i i-sm"><use href="#i-clock"/></svg> Under Review</button>` : ''}
        ${!isArchived ? `<button class="btn-act btn-info-req" data-action="request-info" ${ds}>Request Info</button>` : ''}
        ${!isArchived && !isDenied     ? `<button class="btn-act btn-deny"     data-action="status" data-set="denied"     ${ds}><svg class="i i-sm"><use href="#i-x"/></svg> Not Approved</button>` : ''}
        ${!isArchived && !isWaitlisted ? `<button class="btn-act btn-waitlist" data-action="status" data-set="waitlisted" ${ds}><svg class="i i-sm"><use href="#i-clock"/></svg> Waitlist</button>` : ''}
        ${!isArchived && app.status!=='pending' ? `<button class="btn-act btn-pending" data-action="status" data-set="pending" ${ds}><svg class="i i-sm"><use href="#i-refresh"/></svg> Reset</button>` : ''}
        ${!isArchived ? `<button class="btn-act btn-archive" data-action="status" data-set="archived" ${ds} style="opacity:.7"><svg class="i i-sm"><use href="#i-trash"/></svg> Archive</button>` : `<button class="btn-act btn-pending" data-action="status" data-set="pending" ${ds}><svg class="i i-sm"><use href="#i-refresh"/></svg> Unarchive</button>`}

        ${!isPaid && !isWaived ? `<button class="btn-act btn-pay"   data-action="pay"   ${ds}><svg class="i i-sm"><use href="#i-card"/></svg> Mark paid</button>` : ''}
        ${isPaid                ? `<button class="btn-act btn-unpay" data-action="unpay" ${ds}><svg class="i i-sm"><use href="#i-refresh"/></svg> Mark unpaid</button>` : ''}
        ${isPaid                ? `<button class="btn-act btn-refund" data-action="refund" ${ds}>Refund</button>` : ''}
        ${!isWaived             ? `<button class="btn-act"           data-action="waive"  ${ds}>Waive</button>` : ''}

        ${isApproved && !hfRequested ? `<button class="btn-act btn-hf-send"  data-action="hf-send" ${ds} title="Send holding fee request email and reserve the unit"><svg class="i i-sm"><use href="#i-clock"/></svg> Send holding</button>` : ''}
        ${hfRequested && !hfPaid     ? `<button class="btn-act btn-hf-paid"  data-action="hf-paid" ${ds} title="Mark holding fee as received and notify applicant"><svg class="i i-sm"><use href="#i-card"/></svg> Mark holding paid</button>` : ''}
        ${hfPaid                     ? `<button class="btn-act btn-hf-undo"  data-action="hf-undo" ${ds} title="Undo: mark holding fee unpaid"><svg class="i i-sm"><use href="#i-refresh"/></svg> Undo holding paid</button>` : ''}

        ${!isArchived ? `<button class="btn-act" data-action="mark-contacted" ${ds} title="Record outreach timestamp"><svg class="i i-sm"><use href="#i-check"/></svg> ${app.last_contacted_at ? 'Contacted' : 'Mark contacted'}</button>` : ''}
        ${!isArchived ? `<button class="btn-act btn-email" data-action="review-summary" ${ds} title="Email full applicant summary for underwriting"><svg class="i i-sm"><use href="#i-mail"/></svg> Review summary</button>` : ''}
        <button class="btn-act btn-email" data-action="resend" ${ds} title="Resend any notification email"><svg class="i i-sm"><use href="#i-mail"/></svg> Resend</button>
        ${!isArchived ? `<button class="btn-act" data-action="sms-dispatch" data-sms-app-id="${S.esc(app.app_id||app.id)}" data-sms-first-name="${S.esc(app.first_name||name.split(' ')[0])}" data-sms-address="${S.esc(app.property_address||prop)}" data-sms-phone="${S.esc(app.phone||'')}" data-sms-email="${S.esc(app.email||'')}" data-sms-method="${S.esc(app.primary_payment_method||'preferred method')}" data-sms-fee="${S.esc(String(appFeeNum))}" data-sms-sign-token="${S.esc(app.tenant_sign_token||'')}" title="Prepare a stage-specific tenant text"><i class="fas fa-comment-sms" aria-hidden="true"></i> Quick SMS</button>` : ''}
        <button class="btn-act"           data-action="toggle" ${ds}>Details</button>
      </div>

      <div class="detail-panel" id="detail-${S.esc(app.id)}">
        <div id="detail-inner-${S.esc(app.id)}">
          <div class="muted text-sm">Loading details…</div>
        </div>
      </div>
    </div>`;
  }

  // ───── Render detail ─────
  function row(k,v){ return `<div class="detail-row"><span class="detail-key">${S.esc(k)}</span><span class="detail-val">${S.esc(String(v||'—'))}</span></div>`; }

  function numVal(v){
    if(v == null || v === '') return 0;
    const n = Number(String(v).replace(/[^0-9.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function formatMaskedSsn(last4, fallback){
    const clean = String(last4 || '').replace(/\D/g,'').slice(-4) || String(fallback || '').replace(/\D/g,'').slice(-4);
    return clean ? ('•••-••-' + clean) : '—';
  }

  function renderApplicantPane(app, person, idx, isActive, docCount, feeLine){
    const rules = getRules();
    const fullName = ((person.first_name||'') + ' ' + (person.last_name||'')).trim() || 'Applicant';
    const roleType = rules.normalizeApplicantType(person.applicant_type || person.role, !!person.is_primary);
    const isSupporter = !rules.isOccupyingRole(roleType);
    const roleLabel = rules.getRoleDisplayLabel(roleType, 'en');
    const subMethod = person.is_primary ? 'primary_completed' : rules.normalizeSubmissionMethod(person.submission_method);
    const infoCompleted = person.info_completed !== false;
    const last4 = String(person.ssn_last4 || '').replace(/\D/g,'').slice(-4);
    const slotId = person.id ? String(person.id) : ('legacy-' + app.id + '-' + idx);
    const maskedSsn = formatMaskedSsn(last4, person.is_primary ? app.ssn : app.co_applicant_ssn);
    const canReveal = !!person.id && !String(person.id).startsWith('legacy-');
    const consented = person.is_primary ? true : !!person.screening_consent;

    const methodBadge = person.is_primary
      ? `<span class="badge">Method A · Primary Completed</span>`
      : (subMethod === 'invited'
          ? (infoCompleted
              ? `<span class="badge b-approved">Method B · Self-Completed${person.info_completed_at ? ' · ' + fmtDate(person.info_completed_at) : ''}</span>`
              : `<span class="badge b-pending">Method B · Invited (Awaiting Info)</span>`)
          : `<span class="badge">${consented ? 'Method A · Completed &amp; Authorized by Primary' : 'Method A · Primary Completed'}</span>`);

    const feeAmount = feeLine ? Number(feeLine.fee) : Number(person.screening_fee_amount ?? 50);
    const feeBadge = `<span class="badge" style="background:var(--surface-2)">Fee: ${S.esc(fmtFeeShort(feeAmount))}${feeAmount === 0 ? ' (Free / Credit)' : ''}</span>`;
    const memberPayBadge = '';

    const docBadge = `<span class="badge" style="background:var(--surface-2)">Docs: ${docCount || 0}</span>`;

    const consentBlock = person.is_primary
      ? `<span class="badge b-approved">✓ Primary Screening Consent</span>`
      : (consented
          ? `<span class="badge b-approved">✓ ${subMethod === 'primary_completed' ? 'Authorized (by Primary)' : 'Consented'}${person.screening_consent_timestamp ? ' · ' + fmtDate(person.screening_consent_timestamp) : ''}</span>`
          : `<span class="badge b-pending">Pending Consent</span>
             <button class="btn-act btn-email" data-action="send-consent" data-db-id="${S.esc(app.id)}" data-app-id="${S.esc(app.app_id||app.id)}" data-applicant-id="${canReveal ? S.esc(person.id) : ''}" data-email="${S.esc(person.email||'')}">${subMethod === 'invited' && !infoCompleted ? 'Resend Private Invite Link' : 'Send Consent Link'}</button>`);

    const roleControl = (!person.is_primary && canReveal)
      ? `<label style="display:inline-flex;align-items:center;gap:6px;font-size:.74rem;color:var(--muted)">
           <span>Role:</span>
           <select class="role-change-select" data-action="change-role" data-db-id="${S.esc(app.id)}" data-applicant-id="${S.esc(person.id)}" data-prev-role="${S.esc(roleType)}" style="font-size:.76rem;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)">
             <option value="co_applicant" ${roleType==='co_applicant'?'selected':''}>Co-Applicant (Occupying)</option>
             <option value="guarantor" ${roleType==='guarantor'?'selected':''}>Guarantor (Non-Occupying)</option>
             <option value="co_signer" ${roleType==='co_signer'?'selected':''}>Co-Signer (Financial Support)</option>
           </select>
         </label>`
      : '';

    const personalSection = `
        <div class="detail-section">
          <div class="detail-section-title">Personal &amp; Identity</div>
          <div class="detail-grid">
            ${row('Email', person.email)}
            ${row('Phone', person.phone)}
            ${row('DOB', person.dob)}
            <div class="detail-row">
              <span class="detail-key">SSN (Last 4)</span>
              <span class="detail-val">
                <div class="ssn-inline" id="ssn-slot-${S.esc(slotId)}" data-masked="${S.esc(maskedSsn)}">
                  <span class="ssn-code">${S.esc(last4 ? maskedSsn : (person.government_id_type ? ('Alt ID (' + person.government_id_type + ')') : maskedSsn))}</span>
                </div>
              </span>
            </div>
            ${row('Gov ID type', person.government_id_type)}
            ${row('Gov ID #', person.government_id_number)}
            ${isSupporter ? '' : row('Ever evicted', person.ever_evicted ? 'Yes' : 'No')}
            ${isSupporter ? '' : row('Smoker', person.smoker ? 'Yes' : 'No')}
          </div>
        </div>`;

    const hStatus = String(person.housing_status || '').trim();
    const rentKey = hStatus === 'Mortgage'
      ? 'Current mortgage'
      : (hStatus === 'Living with Family' || hStatus === 'Family')
        ? 'Housing contribution'
        : hStatus === 'Other' ? 'Housing cost' : 'Current rent';
    const llNameKey = hStatus === 'Mortgage'
      ? 'Lender / servicer'
      : (hStatus === 'Living with Family' || hStatus === 'Family')
        ? 'Host / family'
        : hStatus === 'Other' ? 'Property contact' : 'Current landlord';
    const llPhoneKey = hStatus === 'Mortgage'
      ? 'Lender phone'
      : (hStatus === 'Living with Family' || hStatus === 'Family')
        ? 'Host phone'
        : hStatus === 'Other' ? 'Contact phone' : 'Landlord phone';

    const residenceSection = isSupporter
      ? `
        <div class="detail-section">
          <div class="detail-section-title">Residential Address &amp; Housing Status (Non-Occupying ${S.esc(rules.getShortRoleLabel(roleType))})</div>
          <div class="detail-grid">
            ${row('Residential address', person.current_address)}
            ${row('Housing status', person.housing_status)}
            ${row('Years / duration at address', person.residency_duration)}
            ${row('Occupancy status', 'Non-occupying financial support')}
          </div>
        </div>`
      : `
        <div class="detail-section">
          <div class="detail-section-title">Residence History</div>
          <div class="detail-grid">
            ${person.housing_status ? row('Housing status', person.housing_status) : ''}
            ${row('Current address', person.current_address)}
            ${row('Duration', person.residency_duration)}
            ${hStatus === 'Own' ? '' : row(rentKey, person.current_rent_amount)}
            ${row('Reason leaving', person.reason_for_leaving)}
            ${hStatus === 'Own' ? '' : row(llNameKey, person.current_landlord_name)}
            ${hStatus === 'Own' ? '' : row(llPhoneKey, person.landlord_phone)}
            ${row('Prior address', person.previous_address)}
            ${row('Prior duration', person.previous_residency_duration)}
            ${row('Prior landlord', person.previous_landlord_name)}
            ${row('Prior landlord ph.', person.previous_landlord_phone)}
          </div>
        </div>`;

    const empSt = String(person.employment_status || '').trim();
    const empKey = empSt === 'Self-employed' || empSt === 'Self-Employed'
      ? 'Business name'
      : empSt === 'Retired' ? 'Pension / retirement'
      : empSt === 'Student' ? 'School / institution' : 'Employer';
    const empAddrKey = empSt === 'Self-employed' || empSt === 'Self-Employed'
      ? 'Business address'
      : empSt === 'Student' ? 'Institution address' : 'Employer address';
    const jobKey = empSt === 'Self-employed' || empSt === 'Self-Employed'
      ? 'Role / occupation'
      : empSt === 'Retired' ? 'Former title'
      : empSt === 'Student' ? 'Program / field' : 'Job title';

    const hasMonthlyIncome = person.monthly_income !== null && person.monthly_income !== undefined && person.monthly_income !== '';
    const hasOtherIncome = person.other_income !== null && person.other_income !== undefined && person.other_income !== '' && Number(person.other_income) > 0;
    const personTotalIncome = numVal(person.monthly_income) + numVal(person.other_income);
    const employmentSection = `
        <div class="detail-section">
          <div class="detail-section-title">Employment &amp; ${isSupporter ? 'Financial Capacity' : 'Income'}</div>
          <div class="detail-grid">
            ${row('Status', person.employment_status)}
            ${row(empKey, person.employer)}
            ${row(empAddrKey, person.employer_address)}
            ${row(jobKey, person.job_title)}
            ${row('Start date', person.employment_start_date)}
            ${row('Duration', person.employment_duration)}
            ${row('Supervisor', person.supervisor_name)}
            ${row('Supervisor ph.', person.supervisor_phone)}
            ${row('Monthly income', hasMonthlyIncome ? fmtMoney(person.monthly_income) : '—')}
            ${row('Other income', hasOtherIncome ? fmtMoney(person.other_income) : '—')}
            ${isSupporter ? row('Total supporter capacity / mo', personTotalIncome ? fmtMoney(personTotalIncome) : '—') : ''}
            ${isSupporter && person.financial_support_notes ? row('Financial support notes', person.financial_support_notes) : ''}
          </div>
        </div>`;

    const disclosuresSection = `
        <div class="detail-section">
          <div class="detail-section-title">Background Disclosures</div>
          <div class="detail-grid">
            ${row('Bankruptcy', person.has_bankruptcy ? 'Yes — ' + (person.bankruptcy_explanation||'') : 'No')}
            ${row('Criminal history', person.has_criminal_history ? 'Yes — ' + (person.criminal_history_explanation||'') : 'No')}
            ${roleType === 'guarantor' ? '' : row('Evicted', person.ever_evicted ? 'Yes' : 'No')}
          </div>
        </div>`;

    const referencesSection = `
        <div class="detail-section">
          <div class="detail-section-title">References &amp; Emergency Contact</div>
          <div class="detail-grid">
            ${row('Reference 1', person.reference_1_name ? (person.reference_1_name + (person.reference_1_relationship ? ' (' + person.reference_1_relationship + ')' : '') + ' — ' + (person.reference_1_phone||'')) : '—')}
            ${row('Reference 2', person.reference_2_name ? (person.reference_2_name + (person.reference_2_relationship ? ' (' + person.reference_2_relationship + ')' : '') + ' — ' + (person.reference_2_phone||'')) : '—')}
            ${row('Emergency contact', person.emergency_contact_name ? (person.emergency_contact_name + ' (' + (person.emergency_contact_relationship||'') + ') ' + (person.emergency_contact_phone||'')) : '—')}
          </div>
        </div>`;

    return `
      <div class="app-tab-pane ${isActive ? 'active' : ''}" data-pane-app="${S.esc(app.id)}" data-pane-idx="${idx}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:12px">
          <div>
            <div style="font-weight:700;font-size:.9rem">${S.esc(fullName)}</div>
            <div class="text-xs muted">${S.esc(roleLabel)} · ${S.esc(person.email||'—')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${methodBadge}
            ${feeBadge}
            ${memberPayBadge}
            ${docBadge}
            ${consentBlock}
            ${roleControl}
          </div>
        </div>
        ${personalSection}
        ${residenceSection}
        ${employmentSection}
        ${disclosuresSection}
        ${referencesSection}
      </div>`;
  }

  async function listAllAppStorageFiles(appId){
    if(!appId) return [];
    const sb = CP.sb();
    const prefixes = [
      appId,
      appId + '/applicant_upload',
      appId + '/government_id',
      appId + '/pay_stub',
      appId + '/bank_statement',
      appId + '/proof_of_income',
      appId + '/guarantor_support',
      appId + '/other',
    ];
    for(let i = 0; i <= 6; i++) prefixes.push(appId + '/applicant_' + i);

    const results = await Promise.all(prefixes.map(async (prefix) => {
      try {
        const { data, error } = await sb.storage.from('application-docs').list(prefix, { limit:50, sortBy:{ column:'created_at', order:'desc' } });
        if(error || !Array.isArray(data)) return [];
        return data
          .filter(f => f && f.name && f.id !== null && !/^\.empty/.test(f.name))
          .map(f => ({ name: f.name, storage_path: prefix + '/' + f.name, folder: prefix }));
      } catch(_) { return []; }
    }));
    const flat = [];
    const seen = new Set();
    results.flat().forEach(item => {
      if(!seen.has(item.storage_path)){
        seen.add(item.storage_path);
        flat.push(item);
      }
    });
    return flat;
  }

  function renderDocsListHtml(dbId, appId, docRows, storageFiles, applicants){
    const nameMap = {};
    (applicants || []).forEach(a => {
      if(a.id) nameMap[a.id] = ((a.first_name||'') + ' ' + (a.last_name||'')).trim() || (a.role || 'Applicant');
    });
    const parts = [];
    const seenPaths = new Set();

    (docRows || []).forEach(d => {
      if(d.storage_path) seenPaths.add(d.storage_path);
      const rev = d.review_status || 'pending';
      const revCls = rev === 'verified' ? 'b-approved' : (rev === 'rejected' ? 'b-denied' : 'b-pending');
      const ownerName = d.applicant_id && nameMap[d.applicant_id] ? nameMap[d.applicant_id] : (d.uploaded_by_email || 'Applicant');
      parts.push(`<div class="doc-review-row">
        <div class="doc-review-meta">
          <div style="font-weight:600;font-size:.8rem">${S.esc(d.original_file_name || d.doc_type || 'Document')}</div>
          <div class="text-xs muted">${S.esc((d.doc_type || 'document').replace(/_/g,' '))} · ${S.esc(ownerName)} · ${fmtDate(d.created_at)}</div>
        </div>
        <div class="doc-review-actions">
          <span class="badge ${revCls}">${S.esc(rev)}</span>
          ${rev !== 'verified' ? `<button class="btn-act btn-approve" data-action="review-doc" data-doc-id="${S.esc(d.id)}" data-review="verified" data-db-id="${S.esc(dbId)}">Verify</button>` : ''}
          ${rev !== 'rejected' ? `<button class="btn-act btn-deny" data-action="review-doc" data-doc-id="${S.esc(d.id)}" data-review="rejected" data-db-id="${S.esc(dbId)}">Reject</button>` : ''}
          <button class="btn-act" data-action="download-doc" data-path="${S.esc(d.storage_path)}" data-bucket="${S.esc(d.bucket || 'application-docs')}">Download</button>
        </div>
      </div>`);
    });

    (storageFiles || []).forEach(f => {
      const fullPath = f.storage_path || (appId + '/applicant_upload/' + f.name);
      if(seenPaths.has(fullPath)) return;
      parts.push(`<div class="doc-review-row">
        <div class="doc-review-meta">
          <div style="font-weight:600;font-size:.8rem">${S.esc(f.name||'—')}</div>
          <div class="text-xs muted">Storage attachment${f.folder && f.folder !== appId ? ' · ' + S.esc(f.folder.replace(appId + '/', '')) : ''}</div>
        </div>
        <div class="doc-review-actions">
          <button class="btn-act" data-action="download-doc" data-path="${S.esc(fullPath)}" data-bucket="application-docs">Download</button>
        </div>
      </div>`);
    });

    if(!parts.length) return '<span class="text-sm muted">No documents uploaded yet.</span>';
    return parts.join('');
  }

  function renderDetail(app, applicants, docs, credits, storageFiles){
    const rules = getRules();
    const isPaid = app.payment_status === 'paid';
    const hfPaid = !!app.holding_fee_paid;

    let people = Array.isArray(applicants) && applicants.length ? applicants.slice() : [];
    if(!people.length){
      people.push({
        id: null,
        is_primary: true,
        applicant_type: 'primary',
        role: 'Primary Applicant',
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        phone: app.phone,
        dob: app.dob,
        ssn_last4: String(app.ssn||'').replace(/\D/g,'').slice(-4),
        government_id_type: app.government_id_type,
        government_id_number: app.government_id_number,
        current_address: app.current_address,
        residency_duration: app.residency_duration,
        current_rent_amount: app.current_rent_amount,
        reason_for_leaving: app.reason_for_leaving,
        current_landlord_name: app.current_landlord_name,
        landlord_phone: app.landlord_phone,
        previous_address: app.previous_address,
        previous_residency_duration: app.previous_residency_duration,
        previous_landlord_name: app.previous_landlord_name,
        previous_landlord_phone: app.previous_landlord_phone,
        employment_status: app.employment_status,
        employer: app.employer,
        employer_address: app.employer_address,
        job_title: app.job_title,
        employment_start_date: app.employment_start_date,
        employment_duration: app.employment_duration,
        supervisor_name: app.supervisor_name,
        supervisor_phone: app.supervisor_phone,
        monthly_income: app.monthly_income,
        other_income: app.other_income,
        has_bankruptcy: app.has_bankruptcy,
        bankruptcy_explanation: app.bankruptcy_explanation,
        has_criminal_history: app.has_criminal_history,
        criminal_history_explanation: app.criminal_history_explanation,
        ever_evicted: app.ever_evicted,
        smoker: app.smoker,
        reference_1_name: app.reference_1_name,
        reference_1_phone: app.reference_1_phone,
        reference_2_name: app.reference_2_name,
        reference_2_phone: app.reference_2_phone,
        emergency_contact_name: app.emergency_contact_name,
        emergency_contact_phone: app.emergency_contact_phone,
        emergency_contact_relationship: app.emergency_contact_relationship,
        screening_consent: true,
        submission_method: 'primary_completed',
        info_completed: true,
      });
    }

    const fin = rules.calculateHouseholdFinancials(people, app.monthly_rent);
    const feeSummary = rules.calculateHouseholdApplicationFee(people, {
      creditApplied: !!app.credit_applied_id,
      stateCode: app.lease_state_code,
    });
    const effectiveFee = (Array.isArray(applicants) && applicants.length)
      ? feeSummary.totalFee
      : (app.application_fee != null ? Number(app.application_fee) : feeSummary.totalFee);
    const householdIncome = fin.householdMonthlyIncome || numVal(app.household_monthly_income) || numVal(app.combined_monthly_income);
    const supporterIncome = fin.guarantorMonthlyIncome + fin.coSignerMonthlyIncome;
    const totalSupport = householdIncome + supporterIncome;
    const nonPrimary = people.filter(p => !p.is_primary);
    const consentedCount = nonPrimary.filter(p => !!p.screening_consent).length;
    const pendingConsentCount = nonPrimary.length - consentedCount;
    const infoCompletedCount = nonPrimary.filter(p => p.info_completed !== false).length;

    const docCountsByApplicant = {};
    (docs || []).forEach(d => {
      if(d.applicant_id) docCountsByApplicant[d.applicant_id] = (docCountsByApplicant[d.applicant_id] || 0) + 1;
    });

    const tabsHtml = people.length > 1 ? `
      <div class="app-tabs" role="tablist">
        ${people.map((p, idx) => {
          const pName = ((p.first_name||'') + ' ' + (p.last_name||'')).trim() || ('Person ' + (idx + 1));
          const rType = rules.normalizeApplicantType(p.applicant_type || p.role, !!p.is_primary);
          const roleShort = rules.getShortRoleLabel(rType, 'en');
          const cDot = p.is_primary ? '' : (p.screening_consent && p.info_completed !== false ? '<span style="color:#22c55e">●</span>' : '<span style="color:#f59e0b">●</span>');
          return `<button type="button" class="app-tab ${idx===0?'active':''}" data-action="switch-applicant-tab" data-app="${S.esc(app.id)}" data-idx="${idx}">${cDot} ${S.esc(pName)} <span class="role-chip">${S.esc(roleShort)}</span></button>`;
        }).join('')}
      </div>` : '';

    const panesHtml = people.map((p, idx) => {
      const feeLine = feeSummary.feeBreakdown[idx] || null;
      return renderApplicantPane(app, p, idx, idx === 0, p.id ? (docCountsByApplicant[p.id] || 0) : (docs||[]).length, feeLine);
    }).join('');

    const feeBreakdownHtml = (feeSummary.feeBreakdown && feeSummary.feeBreakdown.length) ? `
      <div class="detail-section">
        <div class="detail-section-title">Itemized Per-Screening Fee Schedule</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${feeSummary.feeBreakdown.map(item => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;font-size:.8rem">
              <div>
                <strong>${S.esc(item.name)}</strong>
                <span class="muted"> · ${S.esc(item.role_label)}</span>
                <span class="muted"> · ${item.submission_method === 'invited' ? 'Method B (Private Link)' : 'Method A'}</span>
                <div class="text-xs muted">${S.esc(item.note || '')}</div>
              </div>
              <div style="font-weight:700;white-space:nowrap">${Number(item.fee) === 0 ? '<span style="color:#16a34a">$0.00 (Credit/Waived)</span>' : fmtMoney(item.fee)}</div>
            </div>`).join('')}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;font-weight:700;border-top:1px solid var(--border)">
            <span>Total Household Screening Fee (${people.length} adult${people.length===1?'':'s'} × $50)</span>
            <span>${fmtMoney(effectiveFee)}</span>
          </div>
        </div>
        ${(app.jurisdiction_fee_note || feeSummary.jurisdictionFeeNote) ? `<div style="margin-top:8px;padding:8px 10px;border-radius:6px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);font-size:.78rem;color:var(--text)">${S.esc(app.jurisdiction_fee_note || feeSummary.jurisdictionFeeNote)}</div>` : ''}
      </div>` : '';

    const creditsHtml = (credits && credits.length) ? `
      <div class="detail-section">
        <div class="detail-section-title">Application Credits (${S.esc(app.email||'')})</div>
        ${credits.map(cr => `
          <div class="credit-row">
            <div>
              <strong>${S.esc(String(cr.remaining_credits ?? 0))} / ${S.esc(String(cr.total_credits ?? 2))} remaining</strong>
              <span class="muted"> · from ${S.esc(cr.original_app_id || 'denied app')} · expires ${fmtDate(cr.expires_at)}</span>
            </div>
            <span class="badge ${cr.status==='active' && cr.remaining_credits > 0 ? 'b-approved' : 'b-archived'}">${S.esc(cr.status||'active')}</span>
          </div>`).join('')}
      </div>` : '';

    return `
      <div class="household-banner">
        <div class="household-metrics">
          <div class="hm-item">
            <span class="hm-label">Occupying Adults</span>
            <span class="hm-val">${fin.occupyingAdultCount} occupant${fin.occupyingAdultCount===1?'':'s'}${(fin.guarantorCount || fin.coSignerCount) ? ` (+${fin.guarantorCount + fin.coSignerCount} non-occupying)` : ''}</span>
          </div>
          <div class="hm-item">
            <span class="hm-label">Primary Applicant Income</span>
            <span class="hm-val">${fin.primaryMonthlyIncome ? fmtMoney(fin.primaryMonthlyIncome) : '—'}</span>
          </div>
          ${fin.coApplicantCount > 0 ? `<div class="hm-item">
            <span class="hm-label">Occupying Co-App Income</span>
            <span class="hm-val">${fin.coApplicantMonthlyIncome ? fmtMoney(fin.coApplicantMonthlyIncome) : '—'}</span>
          </div>` : ''}
          <div class="hm-item">
            <span class="hm-label">Household Income (Occupants Only)</span>
            <span class="hm-val">${householdIncome ? fmtMoney(householdIncome) : '—'}${fin.householdRentRatio ? ` (${fin.householdRentRatio.toFixed(1)}x rent)` : ''}</span>
          </div>
          ${supporterIncome > 0 || fin.guarantorCount > 0 || fin.coSignerCount > 0 ? `<div class="hm-item">
            <span class="hm-label">Guarantor / Co-Signer Support</span>
            <span class="hm-val">${supporterIncome ? fmtMoney(supporterIncome) : '—'}</span>
          </div>
          <div class="hm-item">
            <span class="hm-label">Total Financial Support Available</span>
            <span class="hm-val">${totalSupport ? fmtMoney(totalSupport) : '—'}${fin.combinedSupportRentRatio ? ` (${fin.combinedSupportRentRatio.toFixed(1)}x rent)` : ''}</span>
          </div>` : ''}
          <div class="hm-item">
            <span class="hm-label">Application Fee</span>
            <span class="hm-val">${fmtMoney(effectiveFee)}</span>
          </div>
          ${nonPrimary.length ? `<div class="hm-item">
            <span class="hm-label">Member Info &amp; Consent</span>
            <span class="hm-val">${infoCompletedCount}/${nonPrimary.length} completed · ${consentedCount}/${nonPrimary.length} consented</span>
          </div>` : ''}
          ${app.last_contacted_at ? `<div class="hm-item">
            <span class="hm-label">Last Contacted</span>
            <span class="hm-val">${fmtDate(app.last_contacted_at)}${app.last_contacted_by ? ' · ' + S.esc(app.last_contacted_by) : ''}</span>
          </div>` : ''}
        </div>
        ${pendingConsentCount > 0 ? `<button class="btn-act btn-email" data-action="send-consent" data-db-id="${S.esc(app.id)}" data-app-id="${S.esc(app.app_id||app.id)}">Send Pending Consent / Invites (${pendingConsentCount})</button>` : ''}
      </div>

      ${tabsHtml}
      ${panesHtml}
      ${feeBreakdownHtml}

      <div class="detail-section">
        <div class="detail-section-title">Application Details, Household &amp; Vehicle</div>
        <div class="detail-grid">
          ${row('Move-in date', app.requested_move_in_date)}
          ${row('Lease term', app.desired_lease_term)}
          ${row('Occupying adults', fin.occupyingAdultCount)}
          ${row('Total occupants (incl. minors)', app.total_occupants)}
          ${row('Additional occupants', app.additional_occupants)}
          ${row('Vehicle', [app.vehicle_year, app.vehicle_make, app.vehicle_model].filter(Boolean).join(' ') || '—')}
          ${row('License plate', app.vehicle_license_plate)}
          ${row('Preferred contact', app.preferred_contact_method)}
          ${row('Best time', app.preferred_time)}
        </div>
        ${app.pet_details ? `<div class="detail-row"><span class="detail-key">Pet details</span><span class="detail-val">${S.esc(app.pet_details)}</span></div>` : ''}
      </div>

      ${creditsHtml}

      <div class="detail-section">
        <div class="detail-section-title">Application Fee &amp; Payment Preferences</div>
        ${(app.status === 'additional_info_required' || app.additional_info_note) ? `
        <div class="pay-detail-alert pay-detail-alert--warn">
          <strong>Additional Information Required:</strong> ${S.esc(app.additional_info_note || 'Pending additional verification from applicant.')}
        </div>` : ''}
        <div class="detail-grid" style="margin-top:8px;">
          ${row('Payment Status', app.payment_status || 'unpaid')}
          ${row('Application Fee', fmtMoney(effectiveFee))}
          ${row('Primary Payment Method', formatManualMethod(app.primary_payment_method, app.primary_payment_method_other) || '—')}
          ${row('Alternative Method', formatManualMethod(app.alternative_payment_method, app.alternative_payment_method_other) || '—')}
          ${row('Third Choice Method', formatManualMethod(app.third_choice_payment_method, app.third_choice_payment_method_other) || '—')}
          ${row('Amount Recorded', fmtMoney(app.payment_amount_collected ?? app.payment_amount_recorded))}
          ${row('Method Recorded', app.payment_method_confirmed || app.payment_method_recorded || '—')}
          ${row('Transaction Ref', app.payment_transaction_ref || '—')}
          ${row('Paid Date', fmtDate(app.payment_confirmed_at || app.payment_date))}
          ${row('Notes', app.payment_notes)}
          ${isPaid ? `<div class="detail-row"><span class="detail-key">Receipt</span><span class="detail-val"><button class="btn-act" data-action="receipt" data-app-id="${S.esc(app.app_id||app.id)}" data-receipt-type="application_fee">Generate / View</button></span></div>` : ''}
          ${hfPaid ? `<div class="detail-row"><span class="detail-key">Receipt</span><span class="detail-val"><button class="btn-act" data-action="receipt" data-app-id="${S.esc(app.app_id||app.id)}" data-receipt-type="holding_deposit">Generate / View</button></span></div>` : ''}
        </div>
      </div>

      <div class="detail-section">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
          <div class="detail-section-title" style="margin-bottom:0">Documents &amp; Verification</div>
          <button class="btn-act" data-action="docs" data-id="${S.esc(app.id)}" data-app-id="${S.esc(app.app_id||app.id)}">Refresh docs</button>
        </div>
        <div id="docs-${S.esc(app.id)}">
          ${renderDocsListHtml(app.id, app.app_id||app.id, docs, storageFiles, people)}
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Admin notes <span class="text-xs muted" style="text-transform:none;font-weight:400">(not visible to applicant)</span></div>
        <textarea class="notes-area" id="notes-${S.esc(app.id)}" placeholder="Internal notes…">${S.esc(app.admin_notes||'')}</textarea>
        <div style="margin-top:6px"><button class="btn-act" data-action="save-notes" data-id="${S.esc(app.id)}">Save notes</button></div>
      </div>`;
  }

  // ───── Toggle detail ─────
  async function toggleDetail(id, forceReload){
    const panel = document.getElementById('detail-' + id);
    const chev = document.getElementById('chev-' + id);
    if(!panel) return;
    if(!forceReload){
      const isOpen = panel.classList.contains('open');
      if(isOpen){ panel.classList.remove('open'); if(chev) chev.classList.remove('open'); return; }
      panel.classList.add('open');
      if(chev) chev.classList.add('open');
      if(panel.dataset.loaded) return;
    }
    panel.dataset.loaded = '1';
    const app = _allData.find(a => String(a.id) === String(id));
    if(!app) return;
    const appId = app.app_id || app.id;
    const [applicantsRes, docsRes, creditsRes, storageFiles] = await Promise.all([
      CP.Applications.getApplicants(appId),
      CP.Applications.getDocuments(appId),
      CP.Applications.getCreditsForEmail(app.email),
      listAllAppStorageFiles(appId),
    ]);
    let applicants = applicantsRes.ok ? applicantsRes.data : [];
    if(!applicants.length && app.has_co_applicant){
      const { data: legacyCo } = await CP.sb().from('co_applicants').select('*').eq('app_id', appId).maybeSingle();
      if(legacyCo){
        applicants = [
          {
            id: null, is_primary: true, applicant_type: 'primary', role: 'Primary Applicant',
            first_name: app.first_name, last_name: app.last_name, email: app.email, phone: app.phone, dob: app.dob,
            ssn_last4: String(app.ssn||'').replace(/\D/g,'').slice(-4),
            government_id_type: app.government_id_type, government_id_number: app.government_id_number,
            current_address: app.current_address, residency_duration: app.residency_duration, current_rent_amount: app.current_rent_amount,
            reason_for_leaving: app.reason_for_leaving, current_landlord_name: app.current_landlord_name, landlord_phone: app.landlord_phone,
            previous_address: app.previous_address, previous_residency_duration: app.previous_residency_duration,
            previous_landlord_name: app.previous_landlord_name, previous_landlord_phone: app.previous_landlord_phone,
            employment_status: app.employment_status, employer: app.employer, employer_address: app.employer_address,
            job_title: app.job_title, employment_start_date: app.employment_start_date, employment_duration: app.employment_duration,
            supervisor_name: app.supervisor_name, supervisor_phone: app.supervisor_phone,
            monthly_income: app.monthly_income, other_income: app.other_income,
            has_bankruptcy: app.has_bankruptcy, bankruptcy_explanation: app.bankruptcy_explanation,
            has_criminal_history: app.has_criminal_history, criminal_history_explanation: app.criminal_history_explanation,
            ever_evicted: app.ever_evicted, smoker: app.smoker,
            reference_1_name: app.reference_1_name, reference_1_phone: app.reference_1_phone,
            reference_2_name: app.reference_2_name, reference_2_phone: app.reference_2_phone,
            emergency_contact_name: app.emergency_contact_name, emergency_contact_phone: app.emergency_contact_phone,
            emergency_contact_relationship: app.emergency_contact_relationship, screening_consent: true,
          },
          { ...legacyCo, id: null, is_primary: false, ssn_last4: String(app.co_applicant_ssn||'').replace(/\D/g,'').slice(-4), screening_consent: !!app.co_applicant_consent }
        ];
      }
    }
    const docs = docsRes.ok ? docsRes.data : [];
    const credits = creditsRes.ok ? creditsRes.data : [];
    _detailState.set(String(id), { app, applicants, docs, credits, storageFiles: storageFiles || [] });
    const inner = document.getElementById('detail-inner-' + id);
    if(inner) inner.innerHTML = renderDetail(app, applicants, docs, credits, storageFiles || []);
  }

  // ───── Load + stats ─────
  function withTimeout(p, ms, label){
    return Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error((label||'Operation') + ' timed out after ' + ms + 'ms')), ms))]);
  }

  // ═══════════════════════════════════════════════════════════
  // Bulk-action helpers (Batch B #4)
  // ═══════════════════════════════════════════════════════════

  function clearSelection(){
    _selected.clear();
    document.querySelectorAll('.bulk-cb').forEach(cb => { cb.checked = false; });
    const all = document.getElementById('bulk-cb-all');
    if(all){ all.checked = false; all.indeterminate = false; }
    refreshBulkBar();
  }

  function refreshSelectAllState(){
    const all = document.getElementById('bulk-cb-all');
    if(!all) return;
    const visible = document.querySelectorAll('.bulk-cb');
    const total = visible.length;
    const sel = Array.from(visible).filter(cb => cb.checked).length;
    all.checked = (total > 0 && sel === total);
    all.indeterminate = (sel > 0 && sel < total);
  }

  function refreshBulkBar(){
    const slot = document.getElementById('bulk-bar-slot');
    if(!slot) return;
    const n = _selected.size;
    if(n === 0){ slot.innerHTML = ''; return; }
    slot.innerHTML = `
      <div class="bulk-bar" role="region" aria-label="Bulk actions">
        <span class="bulk-bar-count">${n} selected</span>
        <div class="bulk-bar-actions">
          <button class="btn-act btn-approve"  data-action="bulk-status" data-set="approved">✓ Approve all</button>
          <button class="btn-act btn-review"   data-action="bulk-status" data-set="under_review">Under Review</button>
          <button class="btn-act btn-deny"     data-action="bulk-status" data-set="denied">✗ Mark Not Approved</button>
          <button class="btn-act btn-waitlist" data-action="bulk-status" data-set="waitlisted">⧗ Waitlist all</button>
          <button class="btn-act"              data-action="bulk-status" data-set="archived" style="opacity:.7">🗄 Archive all</button>
          <button class="btn-act btn-pay"      data-action="bulk-pay">$ Mark paid</button>
          <button class="btn-act"               data-action="bulk-waive">Waive fees</button>
          <button class="btn-act"               data-action="bulk-unpay">↺ Mark unpaid</button>
          <button class="btn-act"               data-action="bulk-clear">Clear</button>
        </div>
      </div>`;
    refreshSelectAllState();
  }

  // Run bulk operation against every selected app id.
  // `fn` returns the API promise for one row. We process sequentially to
  // avoid hammering the database; with typical selections of <50 rows the
  // user-perceived latency is dominated by the email sends, not the DB.
  async function runBulk(label, fn, opts){
    const ids = Array.from(_selected);
    if(!ids.length) return;
    opts = opts || {};
    const confirmMsg = opts.confirm !== false
      ? await S.confirm({
          title: label + '?',
          message: 'This will affect ' + ids.length + ' application' + (ids.length===1?'':'s') + '. Are you sure?',
          ok: label,
          danger: !!opts.danger
        })
      : true;
    if(!confirmMsg) return;
    let okN = 0, failN = 0;
    const failures = [];
    for(let i = 0; i < ids.length; i++){
      const id = ids[i];
      try {
        const res = await fn(id, i);
        if(res && res.ok === false){ failN++; failures.push(res.error || 'unknown'); }
        else okN++;
      } catch(e){
        failN++; failures.push(e.message || String(e));
      }
    }
    const msg = okN + ' succeeded' + (failN ? ', ' + failN + ' failed' : '');
    S.toast(msg, failN ? 'warn' : 'success');
    if(failN && failures.length) console.warn('[bulk] failures:', failures);
    clearSelection();
    await loadApps();
  }

  function bulkSetStatus(status){
    const label = ({ approved:'Approve', under_review:'Set Under Review', denied:'Mark Not Approved', waitlisted:'Waitlist', archived:'Archive', withdrawn:'Withdraw' })[status] || 'Update status';
    return runBulk(label, (id) => CP.Applications.updateStatus(id, status), { danger: status === 'denied' });
  }
  function bulkMarkPaid(){
    return runBulk('Mark paid', (id) => CP.Applications.updatePayment(id, 'paid'));
  }
  function bulkMarkUnpaid(){
    return runBulk('Mark unpaid', (id) => CP.Applications.updatePayment(id, 'unpaid'));
  }
  function bulkWaive(){
    return runBulk('Waive fee', (id) => CP.Applications.updatePayment(id, 'waived'));
  }

  // Wire row-level checkbox changes (delegated, so it survives re-renders).
  function wireBulkSelection(){
    const list = document.getElementById('apps-list');
    if(!list) return;
    list.addEventListener('click', e => {
      if(e.target.closest('.bulk-cb') || e.target.closest('.role-change-select')) e.stopPropagation();
    }, true);
    list.addEventListener('change', async e => {
      const roleSel = e.target.closest('.role-change-select');
      if(roleSel){
        await handleRoleChange(roleSel);
        return;
      }
      const cb = e.target.closest('.bulk-cb');
      if(!cb) return;
      const id = cb.dataset.id;
      if(cb.checked) _selected.add(id); else _selected.delete(id);
      refreshSelectAllState();
      refreshBulkBar();
    });
    const all = document.getElementById('bulk-cb-all');
    if(all){
      all.addEventListener('change', () => {
        const want = all.checked;
        document.querySelectorAll('.bulk-cb').forEach(cb => {
          cb.checked = want;
          if(want) _selected.add(cb.dataset.id); else _selected.delete(cb.dataset.id);
        });
        refreshBulkBar();
      });
    }
  }

  async function loadApps(){
    const list = document.getElementById('apps-list');
    list.innerHTML = '<div class="list">' + S.skeletonRows(5) + '</div>';
    // Wipe any prior selection — the row IDs about to render may not match.
    _selected.clear();
    refreshBulkBar();
    const filters = { status:_status, search:_search };
    if(_payFilter) filters.payment_status = _payFilter;
    let res;
    try { res = await withTimeout(CP.Applications.getAll(filters), 15000, 'Applications query'); }
    catch(e){
      list.innerHTML = '<div class="empty"><svg class="i"><use href="#i-alert"/></svg><h3>Request timed out</h3><p>' + S.esc(e.message) + '</p><p style="margin-top:12px"><button class="btn btn-primary" data-action="reload-apps">Retry</button></p></div>';
      return;
    }
    if(!res.ok){
      list.innerHTML = '<div class="empty"><svg class="i"><use href="#i-alert"/></svg><h3>Error loading</h3><p>' + S.esc(res.error||'Unknown') + '</p><p style="margin-top:12px"><button class="btn btn-primary" data-action="reload-apps">Retry</button></p></div>';
      return;
    }
    let rows = res.data || [];

    if(_payFilter){
      rows = rows.filter(r => {
        const ps = String(r.payment_status || 'unpaid').toLowerCase();
        if(_payFilter === 'needs_payment') return ps !== 'paid' && ps !== 'waived';
        return ps === _payFilter;
      });
    }

    _allData = rows;
    document.querySelector('.appbar-sub').textContent =
      _allData.length + ' application' + (_allData.length!==1?'s':'') + (_status!=='all' ? ' · ' + _status : '');
    updateStats(_allData);
    if(!_allData.length){
      list.innerHTML = '<div class="empty"><svg class="i"><use href="#i-apps"/></svg><h3>No applications found</h3><p>Try adjusting the filters.</p></div>';
      // Hide the select-all / bulk toolbar when there are zero rows.
      const tr = document.getElementById('bulk-toolbar-row');
      if(tr) tr.hidden = true;
      return;
    }
    list.innerHTML = _allData.map(renderCard).join('');
    // Reveal the select-all toolbar once we have rows to act on.
    const tr = document.getElementById('bulk-toolbar-row');
    if(tr) tr.hidden = false;
    refreshSelectAllState();
  }

  function updateStats(rows){
    const bar = document.getElementById('stats-bar');
    if(!bar) return;
    bar.style.display = 'grid';
    const c = { total: rows.length, unpaid:0, paid:0, waived:0, approved:0, archived:0 };
    rows.forEach(r => {
      const ps = String(r.payment_status || 'unpaid').toLowerCase();
      if(ps === 'unpaid' || !ps) c.unpaid++;
      if(ps === 'paid') c.paid++;
      if(ps === 'waived') c.waived++;
      if(r.status === 'approved') c.approved++;
      if(r.status === 'archived') c.archived++;
    });
    bar.innerHTML = `
      <div class="stat-card"><div class="stat-num" style="font-variant-numeric:tabular-nums">${c.total}</div><div class="stat-label">Total</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--warning);font-variant-numeric:tabular-nums">${c.unpaid}</div><div class="stat-label">Unpaid</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--success);font-variant-numeric:tabular-nums">${c.paid}</div><div class="stat-label">Paid</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#60a5fa;font-variant-numeric:tabular-nums">${c.waived}</div><div class="stat-label">Waived</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#a855f7;font-variant-numeric:tabular-nums">${c.approved}</div><div class="stat-label">Approved</div></div>
      ${c.archived ? `<div class="stat-card"><div class="stat-num" style="color:#9ca3af;font-variant-numeric:tabular-nums">${c.archived}</div><div class="stat-label">Archived</div></div>` : ''}`;
  }

  // ───── Status change ─────
  async function setStatus(dbId, appId, status){
    const willEmail = ['approved','denied','waitlisted','under_review','additional_info_required'].includes(status);
    const labels = {
      approved: 'Approve application?',
      under_review: 'Move application to Under Review?',
      denied: 'Mark application as Not Approved?',
      waitlisted: 'Move to waitlist?',
      pending: 'Reset to pending?',
      new: 'Reset to new?',
      archived: 'Archive application?',
      withdrawn: 'Mark as withdrawn?',
    };
    const verbs = {
      approved: 'Approve',
      under_review: 'Set Under Review',
      denied: 'Mark Not Approved',
      waitlisted: 'Waitlist',
      pending: 'Reset',
      new: 'Reset',
      archived: 'Archive',
      withdrawn: 'Withdraw',
    };
    const displayLabel = ({ denied:'Not Approved', under_review:'Under Review', additional_info_required:'Additional Information Required' })[status] || status;
    const proceed = await S.confirm({
      title: labels[status] || ('Set status to ' + displayLabel + '?'),
      message: willEmail
        ? 'The applicant will be notified by email that their application status is ' + displayLabel + '.'
        : 'The application status will be changed to "' + displayLabel + '".',
      ok: verbs[status] || 'Confirm',
      danger: status === 'denied'
    });
    if(!proceed) return;
    const card = document.getElementById('card-' + dbId);
    if(card) card.style.opacity = '.55';
    const { ok, error } = await CP.Applications.updateStatus(dbId, status, undefined, { sendEmail: false });
    if(!ok){ S.toast('Error: ' + error, 'error'); if(card) card.style.opacity = '1'; return; }
    if(willEmail) await autoSendEmail(appId, status);
    S.toast('Status updated to ' + displayLabel + '.');
    await loadApps();
  }

  async function requestAdditionalInfo(dbId, appId, name){
    const app = _allData.find(a => String(a.id) === String(dbId));
    const data = await S.formSheet({
      title: 'Request Additional Information · ' + (name || appId),
      submit: 'Request Info & Notify Applicant',
      fields: [
        {
          name: 'note',
          label: 'Information or documents needed from applicant',
          type: 'textarea',
          rows: 4,
          required: true,
          value: app?.additional_info_note || '',
          placeholder: 'e.g. Please upload your two most recent pay stubs and a clear front/back photo of your government ID in the portal.'
        }
      ]
    });
    if(!data) return;
    const note = String(data.note || '').trim();
    if(!note){ S.toast('Please describe what additional information is needed.', 'error'); return; }
    const card = document.getElementById('card-' + dbId);
    if(card) card.style.opacity = '.55';
    const { ok, error } = await CP.Applications.updateStatus(dbId, 'additional_info_required', undefined, {
      sendEmail: false,
      additional_info_note: note,
    });
    if(!ok){ S.toast('Error: ' + error, 'error'); if(card) card.style.opacity = '1'; return; }
    await autoSendEmail(appId, 'additional_info_required', note);
    S.toast('Status set to Additional Information Required.');
    await loadApps();
  }

  async function autoSendEmail(appId, type, message){
    try {
      const session = await CP.Auth.getSession();
      const token = session?.access_token || CONFIG.SUPABASE_ANON_KEY;
      const body = { app_id: appId, type };
      if(message) body.message = message;
      const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/send-email', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer ' + token },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));
      if(!res.ok || json.success === false) S.toast('Status saved, email failed: ' + (json.error||res.statusText), 'warn');
      else S.toast('Email sent to applicant.');
    } catch(e){ S.toast('Email error: ' + e.message, 'warn'); }
  }

  // ───── Payment ─────
  async function openPaySheet(dbId, appId, name){
    const app = _allData.find(a => String(a.id) === String(dbId));
    const detail = _detailState.get(String(dbId));
    const rules = getRules();
    let expectedFee = app && app.application_fee != null ? Number(app.application_fee) : 50;
    if(detail && Array.isArray(detail.applicants) && detail.applicants.length){
      expectedFee = rules.calculateHouseholdApplicationFee(detail.applicants, {
        creditApplied: !!(app && app.credit_applied_id),
        stateCode: app && app.lease_state_code,
      }).totalFee;
    }
    if(!Number.isFinite(expectedFee) || expectedFee < 0) expectedFee = 50;
    const expectedStr = expectedFee.toFixed(2);

    const prefRaw = String(app && app.primary_payment_method || '').trim();
    const mappedPref = prefRaw === 'Credit / Debit Card' ? 'Debit / Credit Card' : prefRaw;
    const allowedMethods = ['Zelle', 'Cash App', 'Venmo', 'PayPal', 'Apple Pay', 'Chime', 'Debit / Credit Card', 'Bank Transfer / ACH', 'Money Order / Check', 'Other'];
    const defaultChannel = allowedMethods.includes(mappedPref) ? mappedPref : 'Zelle';
    const data = await S.formSheet({
      title: 'Mark as paid · ' + name,
      submit: 'Mark as paid',
      fields: [
        { name:'amount', label:'Application fee collected (' + fmtMoney(expectedFee) + ' household total)', type:'number', value:expectedStr, placeholder:expectedStr },
        { name:'method', label:'Payment method', type:'select', value:defaultChannel, options:[
          { value:'Zelle', label:'Zelle' },
          { value:'Cash App', label:'Cash App' },
          { value:'Venmo', label:'Venmo' },
          { value:'PayPal', label:'PayPal' },
          { value:'Apple Pay', label:'Apple Pay' },
          { value:'Chime', label:'Chime' },
          { value:'Debit / Credit Card', label:'Debit / Credit Card' },
          { value:'Bank Transfer / ACH', label:'Bank Transfer / ACH' },
          { value:'Money Order / Check', label:'Money Order / Check' },
          { value:'Other', label:'Other' }
        ]},
        { name:'notes', label:'Transaction reference / notes', type:'textarea', rows:2, value:'' },
        { name:'send_email', type:'checkbox', label:'Email', checkLabel:'Send payment confirmation email to applicant', value:true }
      ]
    });
    if(!data) return;
    const amount = data.amount !== '' && data.amount != null ? parseFloat(data.amount) : expectedFee;
    if(!Number.isFinite(amount) || amount < 0){ S.toast('Enter a valid non-negative payment amount.', 'error'); return; }
    if(Math.abs(amount - expectedFee) > 0.01){
      const okDiff = await S.confirm({
        title: 'Fee amount differs from ' + fmtMoney(expectedFee),
        message: 'Expected household screening fee is ' + fmtMoney(expectedFee) + '. Record ' + fmtMoney(amount) + ' anyway?',
        ok: 'Record ' + fmtMoney(amount),
      });
      if(!okDiff) return;
    }
    const method = data.method || null;
    const notes  = data.notes || null;
    const { ok, error } = await CP.Applications.updatePaymentWithDetails(dbId, 'paid', amount, method, notes, { sendEmail:false });
    if(!ok){ S.toast('Error: ' + error, 'error'); return; }
    let receiptNumber = '';
    if(appId){
      try {
        const receipt = await requestReceipt(appId, 'application_fee');
        receiptNumber = receipt.receipt_number || '';
      } catch(e) {
        S.toast('Payment saved, but receipt generation failed: ' + e.message, 'warn');
      }
    }
    if(data.send_email && appId){
      try {
        const session = await CP.Auth.getSession();
        const token = session?.access_token || CONFIG.SUPABASE_ANON_KEY;
        const body = { app_id: appId, type:'payment_confirmed' };
        if(amount != null) body.amount_collected = amount;
        if(method) body.payment_method = method;
        if(notes) body.transaction_ref = notes;
        const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/send-email', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer ' + token },
          body: JSON.stringify(body)
        });
        const json = await res.json().catch(() => ({}));
        if(!res.ok || json.success === false) S.toast('Payment saved, email failed: ' + (json.error||''), 'warn');
        else S.toast('Payment confirmation email sent.');
      } catch(e){ S.toast('Email error: ' + e.message, 'warn'); }
    }
    S.toast(receiptNumber ? 'Payment recorded. Receipt ' + receiptNumber + ' issued.' : 'Payment recorded.','success');
    await loadApps();
  }

  async function markUnpaid(dbId){
    const proceed = await S.confirm({
      title: 'Mark as unpaid?',
      message: 'This reverses any recorded payment for this application. The applicant will not be notified.',
      ok: 'Mark unpaid',
      danger: true
    });
    if(!proceed) return;
    const { ok, error } = await CP.Applications.updatePayment(dbId, 'unpaid');
    if(!ok){ S.toast('Error: ' + error, 'error'); return; }
    S.toast('Marked as unpaid.');
    await loadApps();
  }
  async function markWaived(dbId){
    const ok2 = await S.confirm({ title:'Waive application fee?', message:'The applicant will not be charged.', ok:'Waive fee' });
    if(!ok2) return;
    const { ok, error } = await CP.Applications.updatePayment(dbId, 'waived');
    if(!ok){ S.toast('Error: ' + error, 'error'); return; }
    S.toast('Fee waived.');
    await loadApps();
  }

  async function openRefundSheet(dbId, name){
    const data = await S.formSheet({
      title: 'Refund payment · ' + name,
      submit: 'Confirm refund', danger:true,
      fields: [
        { name:'notes', label:'Refund notes / reason', type:'textarea', rows:3, placeholder:'Optional notes about this refund…' }
      ]
    });
    if(!data) return;
    const notes = data.notes || null;
    const { error } = await CP.sb().from('applications')
      .update({ payment_status:'refunded', payment_notes:notes, updated_at: new Date().toISOString() })
      .eq('id', dbId);
    if(error){ S.toast('Error: ' + error.message, 'error'); return; }
    S.toast('Marked as refunded.','success');
    await loadApps();
  }

  // ───── Holding fee ─────
  async function openHoldingSendSheet(dbId, appId, name){
    const due = new Date(); due.setDate(due.getDate() + 2);
    const dueStr = due.toISOString().slice(0,10);
    const data = await S.formSheet({
      title: 'Send holding fee request · ' + name,
      submit: 'Send request',
      fields: [
        { name:'fee_amount', label:'Holding fee amount ($)', type:'number', placeholder:'e.g. 500.00' },
        { name:'due_date',   label:'Due by', type:'date', value: dueStr, help:'Typically 24–48 hours from now.' }
      ]
    });
    if(!data) return;
    const fee_amount = data.fee_amount ? parseFloat(data.fee_amount) : null;
    const due_date   = data.due_date || null;
    if(!fee_amount || fee_amount <= 0){ S.toast('Enter a holding fee amount.', 'error'); return; }
    try {
      const session = await CP.Auth.getSession();
      const token = session?.access_token || CONFIG.SUPABASE_ANON_KEY;
      const body = { app_id: appId, type:'holding_fee_request', fee_amount, due_date };
      const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/send-email', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer ' + token },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));
      if(!res.ok || json.success === false){
        S.toast('Holding fee request failed: ' + (json.error||res.statusText), 'error');
        return;
      }
      S.toast('Holding fee request sent.', 'success');
      await loadApps();
    } catch(e){ S.toast('Error: ' + e.message, 'error'); }
  }

  async function markHoldingPaid(dbId, appId, name){
    const ok2 = await S.confirm({ title:'Mark holding fee as paid?', message:'This confirms the holding fee for ' + name + ' and emails the applicant.', ok:'Mark paid' });
    if(!ok2) return;
    try {
      const session = await CP.Auth.getSession();
      const token = session?.access_token || CONFIG.SUPABASE_ANON_KEY;
      const body = { app_id: appId, type:'holding_fee_received' };
      const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/send-email', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer ' + token },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));
      if(!res.ok || json.success === false){
        S.toast('Could not mark holding paid: ' + (json.error||res.statusText), 'error');
        return;
      }
      S.toast('Holding fee marked paid.', 'success');
      await loadApps();
    } catch(e){ S.toast('Error: ' + e.message, 'error'); }
  }

  async function undoHoldingPaid(dbId){
    const ok2 = await S.confirm({ title:'Undo holding fee paid?', message:'Reverts the holding fee to "requested but unpaid". No email is sent.', ok:'Undo' });
    if(!ok2) return;
    const { error } = await CP.sb().from('applications')
      .update({ holding_fee_paid:false, holding_fee_paid_at:null, updated_at: new Date().toISOString() })
      .eq('id', dbId);
    if(error){ S.toast('Error: ' + error.message, 'error'); return; }
    S.toast('Holding fee marked unpaid.');
    await loadApps();
  }

  // ───── Resend notification ─────
  const RESEND_TYPE_DESC = {
    under_review: 'Notifies the applicant their application is actively Under Review with our underwriting team.',
    additional_info_required: 'Requests additional documents or verification details from the applicant and links them directly to their portal.',
    approved: 'Sends the full approval email with congratulations, next steps, and a link to the tenant portal.',
    denied: 'Sends the Not Approved decision update email with a courteous note and reapplication credit details.',
    waitlisted: 'Notifies the applicant they are on the active waitlist and will be contacted if a unit becomes available.',
    payment_confirmed: 'Confirms receipt of the application fee and lets the applicant know their file is now in active review (24–48h target).',
    holding_fee_request: 'Asks the selected applicant to complete the holding fee — reserves the unit and removes it from active availability. Time-sensitive (24–48h).',
    holding_fee_received: 'Confirms holding fee received — the unit is reserved for the applicant while the lease is finalized.',
    lease_ready: 'Notifies the applicant their lease is ready and provides a link to e-sign.',
    lease_signing_reminder: 'Friendly 48-hour reminder that the lease is awaiting their signature.',
    lease_fully_executed: 'Congratulatory email confirming both parties have signed — lease is fully executed.',
    movein_confirmed: 'Sends the official move-in date, key pickup details, and what to expect on move-in day.',
    move_in_prep: 'Detailed move-in preparation guide: utilities, mail forwarding, what to bring, etc.',
    lease_expiry_alert: 'Internal admin alert (sent to admin inbox) — lease has been unsigned for 48+ hours.',
    admin_review_summary: 'Internal admin summary email with full applicant profile for lease generation.'
  };

  async function openResendSheet(appId, currentStatus, name){
    const defaultType = ({ approved:'approved', denied:'denied', waitlisted:'waitlisted' })[currentStatus] || 'approved';
    const options = Object.keys(RESEND_TYPE_DESC).map(k => ({ value:k, label:k.replace(/_/g,' ') }));
    const data = await S.formSheet({
      title: 'Resend notification · ' + name,
      submit: 'Send email',
      fields: [
        { name:'type', label:'Email type', type:'select', value:defaultType, options },
        { name:'message', label:'Optional custom message', type:'textarea', rows:3, help:'If the template supports it, this message will be inserted.' }
      ]
    });
    if(!data) return;
    await autoSendEmail(appId, data.type, data.message || undefined);
  }

  function openSmsDispatch(details){
    document.getElementById('sms-dispatch-dialog')?.remove();
    const appId = details.appId || '';
    const firstName = details.firstName || 'there';
    const address = details.address || 'your property';
    const phone = details.phone || '';
    const email = details.email || 'your email address';
    const method = details.method || 'preferred method';
    const feeLabel = fmtFeeShort(details.fee != null ? details.fee : 50);
    const portalUrl = `${window.location.origin}/tenant/portal.html?app=${encodeURIComponent(appId)}`;
    const signingUrl = details.signToken
      ? `${window.location.origin}/lease-sign.html?token=${encodeURIComponent(details.signToken)}`
      : portalUrl;
    const templates = {
      intake: `Hello ${firstName}, this is the Choice Properties Leasing Desk regarding your rental application for ${address} (Ref: #${appId}).\n\nWe received your application with ${method} listed as your preferred payment method for the ${feeLabel} application fee. A coordinator can finalize your fee arrangement here via text so we can begin underwriting review.\n\nTrack your live status anytime in your portal:\n${portalUrl}\n\nNote: We also emailed your confirmation to ${email} (check spam/promotions if not visible).`,
      fee: `Hello ${firstName}, your ${feeLabel} application screening fee for ${address} has been received and verified.\n\nYour official stamped corporate ledger receipt has been generated. You can access your file and view your receipt directly in your resident portal here:\n${portalUrl}\n\nYour full file is now with our underwriting department. We have also emailed a copy of your receipt to ${email} (please check your spam/junk folder if not visible).`,
      approved: `Congratulations ${firstName}! Your rental application for ${address} has been officially APPROVED by Choice Properties underwriting.\n\nUnder our reservation protocol, this property is eligible to be held exclusively in your name while we prepare your lease documents. Your holding deposit is 100% credited toward your move-in balance.\n\nPlease review your Approval & Reservation Agreement here:\n${portalUrl}\n\nWe also sent your official approval packet to ${email}. Please check your inbox and spam folder. Reply to this text to coordinate your reservation holding details.`,
      holding: `Great news ${firstName}! Your reservation holding deposit for ${address} has been verified and posted to your account ledger.\n\nThe home is now officially off the market and secured for your upcoming move-in! Your stamped receipt is now available in your portal:\n${portalUrl}\n\nOur leasing team is currently preparing your official Residential Lease Agreement. We have also emailed your receipt to ${email} (please check spam if needed).`,
      lease: `Hello ${firstName}, your official Residential Lease Agreement for ${address} is prepared and ready for electronic signature!\n\nPlease review and execute your agreement securely using your signing link:\n${signingUrl}\n\nA direct signing copy was also dispatched to ${email}. Because this contains formal legal contracts, some email providers filter it—please inspect your spam, junk, or promotions folder. Feel free to text me here once signed!`,
      executed: `Welcome home, ${firstName}! Your lease for ${address} has been fully countersigned and finalized by Choice Properties management.\n\nYour complete, executed legal lease package and initial move-in orientation guide are now available in your resident portal:\n${portalUrl}\n\nWe also emailed your executed documents to ${email} (check your spam folder if not in primary inbox). Our move-in coordination team will reach out with your key handover protocol as your move-in date approaches!`,
      handover: `Hello ${firstName}, today is your official move-in day for ${address}!\n\nYour electronic lockbox / keypad access code is: [ENTER_CODE]\n(Code activates at 9:00 AM local time).\n\nPlease remember to complete your 48-Hour Move-In Condition Checklist in your portal to document initial property condition and protect your deposit:\n${portalUrl}\n\nFull move-in packet and emergency maintenance contacts have been emailed to ${email} (check spam if needed). Welcome to Choice Properties!`,
    };
    const stages = [
      ['intake', 'Stage 1 · New application'],
      ['fee', 'Stage 2 · Application fee received'],
      ['approved', 'Stage 3 · Approved'],
      ['holding', 'Stage 4 · Holding payment received'],
      ['lease', 'Stage 5 · Lease ready to sign'],
      ['executed', 'Stage 6 · Lease fully executed'],
      ['handover', 'Stage 7 · Key handover'],
    ];
    const overlay = document.createElement('div');
    overlay.id = 'sms-dispatch-dialog';
    overlay.innerHTML = `<style>
      #sms-dispatch-dialog{position:fixed;inset:0;z-index:10000;background:rgba(15,25,22,.58);display:grid;place-items:center;padding:18px}
      #sms-dispatch-dialog .sms-panel{width:min(100%,620px);max-height:min(90dvh,760px);overflow:auto;background:#fff;border-radius:7px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:22px;color:#172321}
      #sms-dispatch-dialog .sms-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}
      #sms-dispatch-dialog h2{margin:0;font-size:1.1rem;font-weight:750;letter-spacing:0}
      #sms-dispatch-dialog .sms-sub{margin:5px 0 0;color:#65716d;font-size:.8rem}
      #sms-dispatch-dialog label{display:block;margin:12px 0 6px;font-size:.73rem;font-weight:700;color:#42514b}
      #sms-dispatch-dialog input,#sms-dispatch-dialog select,#sms-dispatch-dialog textarea{width:100%;border:1px solid #ccd6d1;border-radius:4px;background:#fff;color:#172321;padding:10px 11px;font:500 .88rem 'DM Sans',sans-serif}
      #sms-dispatch-dialog textarea{min-height:240px;resize:vertical;line-height:1.55}
      #sms-dispatch-dialog .sms-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap}
      #sms-dispatch-dialog .sms-actions{display:flex;align-items:center;gap:8px}
      #sms-dispatch-dialog button,#sms-dispatch-dialog a{min-height:38px;border:0;border-radius:4px;padding:9px 13px;font:700 .82rem 'DM Sans',sans-serif;text-decoration:none;cursor:pointer}
      #sms-dispatch-dialog .sms-copy{background:#176345;color:#fff}
      #sms-dispatch-dialog .sms-native{background:#edf3ef;color:#234b3b}
      #sms-dispatch-dialog .sms-close{padding:7px 10px;background:#f0f3f1;color:#394841}
      #sms-dispatch-dialog .sms-count{color:#65716d;font-size:.72rem}
      @media(max-width:520px){#sms-dispatch-dialog{padding:0;align-items:end}#sms-dispatch-dialog .sms-panel{width:100%;max-height:94dvh;border-radius:8px 8px 0 0;padding:20px 16px calc(18px + env(safe-area-inset-bottom))}#sms-dispatch-dialog textarea{min-height:34dvh}}
    </style>
    <section class="sms-panel" role="dialog" aria-modal="true" aria-labelledby="sms-title">
      <header class="sms-head"><div><h2 id="sms-title">Quick SMS Dispatch</h2><p class="sms-sub">${S.esc(firstName)} · ${S.esc(address)}</p></div><button type="button" class="sms-close" data-sms-close aria-label="Close SMS dispatch"><i class="fas fa-xmark" aria-hidden="true"></i></button></header>
      <label for="sms-stage">Milestone</label><select id="sms-stage">${stages.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select>
      <label for="sms-phone">Applicant phone</label><input id="sms-phone" type="tel" value="${S.esc(phone)}" autocomplete="tel">
      <label for="sms-message">Message</label><textarea id="sms-message" maxlength="1600"></textarea>
      <footer class="sms-foot"><span id="sms-count" class="sms-count"></span><div class="sms-actions"><a id="sms-native" class="sms-native" href="#" hidden><i class="fas fa-message" aria-hidden="true"></i> Open Messages</a><button type="button" class="sms-copy" id="sms-copy"><i class="fas fa-copy" aria-hidden="true"></i> Copy message</button></div></footer>
    </section>`;
    document.body.appendChild(overlay);
    const stageSelect = overlay.querySelector('#sms-stage');
    const messageField = overlay.querySelector('#sms-message');
    const phoneField = overlay.querySelector('#sms-phone');
    const nativeLink = overlay.querySelector('#sms-native');
    const count = overlay.querySelector('#sms-count');

    function updateNativeLink(){
      const digits = phoneField.value.replace(/[^+\d]/g, '');
      nativeLink.hidden = !digits;
      nativeLink.href = digits ? `sms:${digits}?body=${encodeURIComponent(messageField.value)}` : '#';
      count.textContent = `${messageField.value.length} characters`;
    }
    function setStage(){ messageField.value = templates[stageSelect.value]; updateNativeLink(); }
    stageSelect.addEventListener('change', setStage);
    messageField.addEventListener('input', updateNativeLink);
    phoneField.addEventListener('input', updateNativeLink);
    overlay.addEventListener('click', event => {
      if(event.target === overlay || event.target.closest('[data-sms-close]')) overlay.remove();
    });
    overlay.querySelector('#sms-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(messageField.value);
        S.toast('SMS copied to clipboard.', 'success');
      } catch {
        messageField.focus();
        messageField.select();
        const copied = document.execCommand('copy');
        S.toast(copied ? 'SMS copied to clipboard.' : 'Select and copy the message.', copied ? 'success' : 'warn');
      }
    });
    const onEscape = event => {
      if(event.key === 'Escape'){
        overlay.remove();
        document.removeEventListener('keydown', onEscape);
      }
    };
    document.addEventListener('keydown', onEscape);
    setStage();
    stageSelect.focus();
  }

  // ───── Notes ─────
  async function saveNotes(id){
    const ta = document.getElementById('notes-' + id);
    if(!ta) return;
    const { ok, error } = await CP.Applications.saveNotes(id, ta.value);
    if(!ok){ S.toast('Error: ' + error, 'error'); return; }
    S.toast('Notes saved.');
  }

  // ───── Documents, SSN Reveal, Consent, Contacted, Review Summary ─────
  function triggerExternalDownload(url){
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function switchApplicantTab(appId, idx){
    document.querySelectorAll(`.app-tab[data-app="${appId}"]`).forEach(btn => {
      btn.classList.toggle('active', String(btn.dataset.idx) === String(idx));
    });
    document.querySelectorAll(`.app-tab-pane[data-pane-app="${appId}"]`).forEach(pane => {
      pane.classList.toggle('active', String(pane.dataset.paneIdx) === String(idx));
    });
  }

  function hideSsnSlot(slotId){
    if(_ssnTimers.has(slotId)){ clearTimeout(_ssnTimers.get(slotId)); _ssnTimers.delete(slotId); }
    const slot = document.getElementById('ssn-slot-' + slotId);
    if(!slot) return;
    const masked = slot.dataset.masked || '•••-••-****';
    slot.innerHTML = `<span class="ssn-code">${S.esc(masked)}</span>`;
  }

  async function revealApplicantSsn(applicantId, slotId, name, last4){
    if(!applicantId) return;
    const data = await S.formSheet({
      title: 'Reveal Full SSN · ' + (name || 'Applicant'),
      submit: 'Decrypt & Reveal (Audited)',
      fields: [
        { name:'reason', label:'Audit reason (required, min 3 characters)', required:true, placeholder:'e.g. Underwriting credit & background verification' }
      ]
    });
    if(!data) return;
    const reason = (data.reason || '').trim();
    if(reason.length < 3){ S.toast('Please enter an audit reason (at least 3 characters).', 'error'); return; }
    S.toast('Decrypting SSN…');
    const res = await CP.Applications.revealApplicantSsn(applicantId, reason);
    if(!res.ok || !res.data?.ssn){
      S.toast('SSN reveal failed: ' + (res.error || res.data?.error || 'Unavailable'), 'error');
      return;
    }
    if(res.data.encrypted_available === false){
      S.toast(res.data.note || 'Only the last 4 digits were collected for this applicant.', 'info');
      return;
    }
    const slot = document.getElementById('ssn-slot-' + slotId);
    if(!slot) return;
    slot.dataset.applicantId = applicantId;
    slot.dataset.name = name || '';
    slot.dataset.last4 = last4 || '';
    const fullSsn = String(res.data.ssn);
    slot.innerHTML = `
      <span class="ssn-code" style="color:var(--warning)">${S.esc(fullSsn)}</span>
      <button class="btn-act" data-action="copy-ssn" data-ssn="${S.esc(fullSsn)}">Copy</button>
      <button class="btn-act" data-action="hide-ssn" data-slot-id="${S.esc(slotId)}">Hide</button>
      <span class="text-xs muted">(auto-hides in 30s)</span>`;
    if(_ssnTimers.has(slotId)) clearTimeout(_ssnTimers.get(slotId));
    _ssnTimers.set(slotId, setTimeout(() => hideSsnSlot(slotId), 30000));
    S.toast('Full SSN revealed and recorded in audit log.', 'success');
  }

  async function markContacted(dbId, appId){
    const user = await CP.Auth.getUser().catch(() => null);
    const { ok, error } = await CP.Applications.markContacted(dbId, appId, user?.email || 'admin');
    if(!ok){ S.toast('Could not mark contacted: ' + error, 'error'); return; }
    S.toast('Marked as contacted.', 'success');
    await loadApps();
  }

  async function sendReviewSummary(appId, name){
    const ok2 = await S.confirm({
      title: 'Send admin review summary?',
      message: 'Emails the internal review summary packet for ' + (name || appId) + ' to the admin inbox.',
      ok: 'Send summary'
    });
    if(!ok2) return;
    await autoSendEmail(appId, 'admin_review_summary');
  }

  async function sendConsentInvitation(dbId, applicationId, applicantId){
    S.toast('Sending screening consent email…');
    const res = await CP.Applications.sendCoApplicantConsent(applicationId, applicantId || undefined);
    if(!res.ok){ S.toast('Consent email failed: ' + (res.error || 'Error'), 'error'); return; }
    const sent = res.data?.sent_count ?? 1;
    S.toast(`Sent ${sent} screening consent email${sent===1?'':'s'}.`, 'success');
    await toggleDetail(dbId, true);
  }

  async function reviewDocument(docId, reviewStatus, dbId){
    let notes = '';
    if(reviewStatus === 'rejected'){
      const f = await S.formSheet({
        title: 'Reject document',
        submit: 'Mark Rejected',
        danger: true,
        fields: [{ name:'notes', label:'Rejection reason (optional)', type:'textarea', rows:2, placeholder:'e.g. Blurry image, please re-upload' }]
      });
      if(!f) return;
      notes = (f.notes || '').trim();
    }
    const user = await CP.Auth.getUser().catch(() => null);
    const { ok, error } = await CP.Applications.updateDocumentReview(docId, reviewStatus, notes, user?.email || 'admin');
    if(!ok){ S.toast('Could not update document: ' + error, 'error'); return; }
    S.toast('Document marked ' + reviewStatus + '.', 'success');
    await toggleDetail(dbId, true);
  }

  async function handleRoleChange(sel){
    const dbId = sel.dataset.dbId;
    const applicantId = sel.dataset.applicantId;
    const prevRole = sel.dataset.prevRole || 'co_applicant';
    const nextRole = sel.value;
    if(!dbId || !applicantId || !nextRole || nextRole === prevRole) return;

    const ok2 = await S.confirm({
      title: 'Change household member role?',
      message: 'Changing role recalculates occupying adult count, separated household income, and screening fees automatically.',
      ok: 'Update Role',
    });
    if(!ok2){ sel.value = prevRole; return; }

    sel.disabled = true;
    try {
      const user = await CP.Auth.getUser().catch(() => null);
      const { ok, error } = await CP.Applications.updateApplicantRole(dbId, applicantId, nextRole, { actor: user?.email || 'admin' });
      if(!ok){
        S.toast('Role update failed: ' + (error || 'Error'), 'error');
        sel.value = prevRole;
        return;
      }
      S.toast('Role updated and household fees/income recalculated.', 'success');
      await loadApps();
      const reopened = document.getElementById('detail-' + dbId);
      if(reopened){
        reopened.classList.add('open');
        const chev = document.getElementById('chev-' + dbId);
        if(chev) chev.classList.add('open');
        await toggleDetail(dbId, true);
      }
    } finally {
      sel.disabled = false;
    }
  }

  async function loadDocs(dbId, appId){
    const container = document.getElementById('docs-' + dbId);
    if(!container) return;
    container.innerHTML = '<span class="text-sm muted">Refreshing…</span>';
    try {
      const state = _detailState.get(String(dbId)) || {};
      const [docsRes, files] = await Promise.all([
        CP.Applications.getDocuments(appId),
        listAllAppStorageFiles(appId)
      ]);
      const docs = docsRes.ok ? docsRes.data : [];
      container.innerHTML = renderDocsListHtml(dbId, appId, docs, files || [], state.applicants || []);
    } catch(e){ container.innerHTML = '<span class="text-sm" style="color:var(--danger)">Error loading docs.</span>'; }
  }
  async function downloadDoc(path, bucket){
    const { data, error } = await CP.sb().storage.from(bucket || 'application-docs').createSignedUrl(path, 300);
    if(error || !data?.signedUrl){ S.toast('Could not get download link', 'error'); return; }
    triggerExternalDownload(data.signedUrl);
  }

  async function requestReceipt(appId, receiptType){
    const session = await CP.Auth.getSession();
    if(!session?.access_token) throw new Error('Session expired. Please sign in again.');
    const response = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/issue-payment-receipt', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer ' + session.access_token },
      body:JSON.stringify({ app_id:appId, receipt_type:receiptType })
    });
    const result = await response.json().catch(() => ({}));
    if(!response.ok || !result.receipt?.id) throw new Error(result.error || 'Could not issue receipt.');
    return result.receipt;
  }

  async function issueReceipt(appId, receiptType){
    try {
      const receipt = await requestReceipt(appId, receiptType);
      S.toast('Receipt issued: ' + receipt.receipt_number, 'success');
      triggerExternalDownload('/receipt.html?receipt_id=' + encodeURIComponent(receipt.id));
    } catch(error) {
      S.toast('Receipt error: ' + (error.message || 'Could not issue receipt.'), 'error');
    }
  }

  // ───── Init ─────
  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); }
    catch(e){
      const el = document.getElementById('apps-list');
      if(el) el.innerHTML = '<div class="empty"><h3>Could not load admin tools</h3><p>'+e.message+'</p></div>';
      return;
    }
    S = window.AdminShell;

    // ───── Wiring (after S is available) ─────
    S.on('toggle',       (t) => toggleDetail(t.dataset.id));
    S.on('status',       (t) => setStatus(t.dataset.id, t.dataset.appId, t.dataset.set));
    S.on('request-info', (t) => requestAdditionalInfo(t.dataset.id, t.dataset.appId, t.dataset.name));
    S.on('pay',          (t) => openPaySheet(t.dataset.id, t.dataset.appId, t.dataset.name));
    S.on('unpay',        (t) => markUnpaid(t.dataset.id));
    S.on('refund',       (t) => openRefundSheet(t.dataset.id, t.dataset.name));
    S.on('waive',        (t) => markWaived(t.dataset.id));
    S.on('resend',       (t) => openResendSheet(t.dataset.appId, t.dataset.status, t.dataset.name));
    S.on('mark-contacted', (t) => markContacted(t.dataset.id, t.dataset.appId));
    S.on('review-summary', (t) => sendReviewSummary(t.dataset.appId, t.dataset.name));
    S.on('send-consent', (t) => sendConsentInvitation(t.dataset.dbId, t.dataset.dbId, t.dataset.applicantId));
    S.on('switch-applicant-tab', (t) => switchApplicantTab(t.dataset.app, t.dataset.idx));
    S.on('reveal-ssn',   (t) => revealApplicantSsn(t.dataset.applicantId, t.dataset.slotId, t.dataset.name, t.dataset.last4));
    S.on('hide-ssn',     (t) => hideSsnSlot(t.dataset.slotId));
    S.on('copy-ssn',     async (t) => {
      try { await navigator.clipboard.writeText(t.dataset.ssn || ''); S.toast('SSN copied to clipboard.', 'success'); }
      catch { S.toast('Could not copy automatically.', 'warn'); }
    });
    S.on('review-doc',   (t) => reviewDocument(t.dataset.docId, t.dataset.review, t.dataset.dbId));
    S.on('hf-send',      (t) => openHoldingSendSheet(t.dataset.id, t.dataset.appId, t.dataset.name));
    S.on('hf-paid',      (t) => markHoldingPaid(t.dataset.id, t.dataset.appId, t.dataset.name));
    S.on('hf-undo',      (t) => undoHoldingPaid(t.dataset.id));
    S.on('docs',         (t) => loadDocs(t.dataset.id, t.dataset.appId));
    S.on('save-notes',   (t) => saveNotes(t.dataset.id));
    S.on('download-doc', (t) => downloadDoc(t.dataset.path, t.dataset.bucket));
    S.on('receipt',      (t) => issueReceipt(t.dataset.appId, t.dataset.receiptType));
    S.on('sms-dispatch', (t) => openSmsDispatch({
      appId:t.dataset.smsAppId,
      firstName:t.dataset.smsFirstName,
      address:t.dataset.smsAddress,
      phone:t.dataset.smsPhone,
      email:t.dataset.smsEmail,
      method:t.dataset.smsMethod,
      fee:t.dataset.smsFee ? Number(t.dataset.smsFee) : 50,
      signToken:t.dataset.smsSignToken,
    }));
    S.on('reload-apps',  () => loadApps());
    // Bulk-action handlers (Batch B #4)
    S.on('bulk-status',  (t) => bulkSetStatus(t.dataset.set));
    S.on('bulk-pay',     () => bulkMarkPaid());
    S.on('bulk-unpay',   () => bulkMarkUnpaid());
    S.on('bulk-waive',   () => bulkWaive());
    S.on('bulk-clear',   () => clearSelection());
    wireBulkSelection();

    // Pre-select chip & payment filter from URL
    document.querySelectorAll('#filter-tabs .chip').forEach(b => {
      b.classList.toggle('active', b.dataset.status === _status);
    });
    const paySel = document.getElementById('pay-filter');
    if(paySel && _payFilter) paySel.value = _payFilter;

    document.getElementById('filter-tabs').addEventListener('click', async e => {
      const btn = e.target.closest('.chip');
      if(!btn) return;
      document.querySelectorAll('#filter-tabs .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _status = btn.dataset.status;
      await loadApps();
    });

    document.getElementById('search-input').addEventListener('input', e => {
      _search = e.target.value;
      clearTimeout(_debounce);
      _debounce = setTimeout(loadApps, 350);
    });

    document.getElementById('pay-filter').addEventListener('change', e => {
      _payFilter = e.target.value;
      loadApps();
    });

    document.getElementById('btn-nudge-drafts').addEventListener('click', async () => {
      const btn = document.getElementById('btn-nudge-drafts');
      btn.disabled = true;
      btn.textContent = 'Checking…';
      try {
        const { ok: pOk, json: pJson } = await S.callFn('/nudge-expiring-drafts', { dry_run: true });
        if (!pOk) return;
        const count = pJson?.would_nudge ?? 0;
        if (count === 0) {
          S.toast('No drafts in the expiry window right now — nothing to nudge.', 'success', 4000);
          return;
        }
        const confirmed = await S.confirm({
          title: 'Send expiry reminder emails?',
          message: `Found ${count} draft${count !== 1 ? 's' : ''} expiring within 48 hours that haven't been emailed yet. Send reminder email${count !== 1 ? 's' : ''} now?`,
          ok: 'Send reminders',
        });
        if (!confirmed) return;
        btn.textContent = 'Sending…';
        const { ok: dOk, json: dJson } = await S.callFn('/nudge-expiring-drafts', {});
        if (!dOk) return;
        const nudged = dJson?.nudged ?? count;
        const failed = dJson?.failed ?? 0;
        const msg = failed > 0
          ? `Sent ${nudged} nudge${nudged !== 1 ? 's' : ''}, ${failed} failed — check console.`
          : `Sent ${nudged} expiry reminder${nudged !== 1 ? 's' : ''} successfully.`;
        S.toast(msg, failed > 0 ? 'warn' : 'success', 5000);
      } finally {
        btn.disabled = false;
        btn.textContent = '📧 Nudge expiring';
      }
    });

    document.getElementById('btn-cleanup-drafts').addEventListener('click', async () => {
      const btn = document.getElementById('btn-cleanup-drafts');
      btn.disabled = true;
      btn.textContent = 'Checking…';
      try {
        const { ok: pOk, json: pJson } = await S.callFn('/cleanup-expired-drafts', { dry_run: true });
        if (!pOk) return;  // callFn already toasted the error
        const count = pJson?.would_delete ?? 0;
        if (count === 0) {
          S.toast('No expired drafts found — everything is clean.', 'success', 4000);
          return;
        }
        const confirmed = await S.confirm({
          title: 'Delete expired draft applications?',
          message: `Found ${count} draft application${count !== 1 ? 's' : ''} older than 7 days. Delete them permanently?`,
          ok: 'Delete drafts',
          danger: true,
        });
        if (!confirmed) return;
        btn.textContent = 'Deleting…';
        const { ok: dOk, json: dJson } = await S.callFn('/cleanup-expired-drafts', {});
        if (!dOk) return;
        const deleted = dJson?.deleted ?? count;
        S.toast(`Deleted ${deleted} expired draft${deleted !== 1 ? 's' : ''}.`, 'success', 5000);
      } finally {
        btn.disabled = false;
        btn.textContent = '🗑 Clean drafts';
      }
    });

    const okAuth = await S.requireAdmin();
    if(!okAuth) return;

    await loadApps().catch(err => {
      console.error('[applications] load failed', err);
      S.toast('Failed to load applications', 'error');
    });

    // Deep-link: ?id=APP-XXXX or ?id=<uuid> from dashboard / email-logs / audit-log.
    // Find the matching card, expand its detail panel, and scroll it into view.
    try {
      const targetId = (new URLSearchParams(location.search)).get('id');
      if(targetId){
        const t = String(targetId).trim();
        const match = _allData.find(a => String(a.app_id) === t || String(a.id) === t);
        if(match){
          await toggleDetail(match.id);
          const el = document.getElementById('card-' + match.id);
          if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });
        } else {
          S.toast('Application ' + t + ' not found in the current view.', 'warn', 4000);
        }
      }
    } catch(e){ console.warn('[applications] deep-link failed', e); }
  });
})();
