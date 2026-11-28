(function () {
  'use strict';

  let S;
  let _activeTab = 'rules';
  let _scopeBatch = '';

  const state = {
    policy: null,
    versions: [],
    changeLog: [],
    profiles: [],
    providers: [],
    batches: [],
    folders: [],
    namespaceStats: null,
    apifyStatus: null,
    apifyKeys: [],
    apifyRuns: [],
    jobs: [],
    workers: [],
    pipelineProps: [],
    valSummary: null,
    enrSummary: null,
    prcSummary: null,
    registryBatches: [],
    recoverableBatches: [],
    recoveryHistory: [],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pillClass(status) {
    const s = String(status || '').toLowerCase();
    if (['active', 'passed', 'enriched', 'calculated', 'completed', 'published', 'ok', 'true', 'deleted', 'idle', 'succeeded'].includes(s)) {
      return 'cc-pill-ok';
    }
    if (['needs_review', 'paused', 'warning', 'held_out_of_range', 'reaped', 'partial', 'archived', 'queued', 'rate_limited'].includes(s)) {
      return 'cc-pill-warn';
    }
    if (['rejected', 'expired', 'revoked', 'failed', 'abandoned', 'error', 'exhausted', 'invalid'].includes(s)) {
      return 'cc-pill-bad';
    }
    if (['scraping', 'validating', 'enriching', 'pricing', 'publishing', 'verifying', 'cleaning_up', 'busy', 'running'].includes(s)) {
      return 'cc-pill-info';
    }
    return 'cc-pill-muted';
  }

  function badge(label, status) {
    return `<span class="cc-pill ${pillClass(status == null ? label : status)}">${S.esc(String(label || '—'))}</span>`;
  }

  function fmtMoney(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    return Number.isFinite(n) ? '$' + Math.round(n).toLocaleString() : '—';
  }

  function unwrapRuleVal(v) {
    if (v && typeof v === 'object' && 'value' in v) return v.value;
    return v;
  }

  function filteredPipelineProps() {
    if (!_scopeBatch) return state.pipelineProps;
    return state.pipelineProps.filter((p) => String(p.batch_id || '') === _scopeBatch);
  }

  function setTab(tabKey) {
    const valid = ['rules', 'batches', 'jobs', 'validation', 'enrichment', 'pricing', 'registry', 'recovery'];
    if (!valid.includes(tabKey)) tabKey = 'rules';
    _activeTab = tabKey;

    document.querySelectorAll('#cc-tabs .cc-tab').forEach((btn) => {
      const active = btn.dataset.tab === tabKey;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    document.querySelectorAll('.cc-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === 'panel-' + tabKey);
    });

    try {
      const nextHash = '#tab=' + encodeURIComponent(tabKey) + (_scopeBatch ? '&batch=' + encodeURIComponent(_scopeBatch) : '');
      if (location.hash !== nextHash) history.replaceState(null, '', nextHash);
    } catch (_) {}
  }

  function setBatchScope(batchId) {
    _scopeBatch = String(batchId || '').replace(/^#/, '').trim();
    const sel = $('cc-scope-batch');
    if (sel) sel.value = _scopeBatch;

    renderAllPanels();
    refreshScopedSummaries().catch(() => {});

    try {
      const nextHash = '#tab=' + encodeURIComponent(_activeTab) + (_scopeBatch ? '&batch=' + encodeURIComponent(_scopeBatch) : '');
      history.replaceState(null, '', nextHash);
    } catch (_) {}
  }

  async function copyText(text, btn) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      S.toast('Copied to clipboard', 'success', 1800);
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = prev; }, 1400);
      }
    } catch (_) {
      S.toast('Could not copy automatically', 'warning');
    }
  }

  const LEASE_LOCK_ERRORS = new Set([
    'lease_held_by_other_worker',
    'lease_ownership_mismatch',
    'lease_expired',
    'job_is_paused',
  ]);

  async function callBatchAction(fnPath, payload, opts = {}) {
    const res = await S.callFn(fnPath, payload, { ...opts, toastErrors: false });
    if (res.ok) return res;

    const errCode = String(res.json?.error || '');
    if (LEASE_LOCK_ERRORS.has(errCode)) {
      const holder = res.json?.holder_worker_id ? ` by worker "${res.json.holder_worker_id}"` : '';
      const ok = await S.confirm({
        title: 'Batch Locked by Active Worker',
        message: `${res.json?.message || `This batch is currently locked${holder}.`} Override the worker reservation ticket and run this action as Admin?`,
        danger: true,
        ok: 'Override Lock & Run',
      });
      if (!ok) return res;
      return await S.callFn(fnPath, { ...payload, admin_override: true }, opts);
    }

    if (opts.toastErrors !== false) {
      S.toast(res.json?.message || res.json?.error || 'Request failed', 'error');
    }
    return res;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────
  async function loadRulesModule() {
    const [activeRes, versRes, profRes, provRes] = await Promise.all([
      S.callFn('/rules-engine', { action: 'get_active_policy', batch_id: _scopeBatch || null }, { toastErrors: false }),
      S.callFn('/rules-engine', { action: 'list_versions' }, { toastErrors: false }),
      S.callFn('/rules-engine', { action: 'prohibited_profiles', sub_action: 'list' }, { toastErrors: false }),
      S.callFn('/rules-engine', { action: 'scraping_providers', sub_action: 'list' }, { toastErrors: false }),
    ]);

    if (activeRes.ok && activeRes.json?.ok) state.policy = activeRes.json;
    if (versRes.ok && versRes.json?.ok) {
      state.versions = versRes.json.versions || [];
      state.changeLog = versRes.json.change_log || [];
    }
    if (profRes.ok && profRes.json?.ok) state.profiles = profRes.json.profiles || [];
    if (provRes.ok && provRes.json?.ok) state.providers = provRes.json.providers || [];
  }

  async function loadBatchesAndJobs() {
    const [batchRes, folderRes, jobsRes, apifyStatRes, apifyRunsRes] = await Promise.all([
      CP.sb().rpc('batch_list', { p_limit: 200, p_batch_format: null }).then((r) => r).catch((e) => ({ error: e })),
      CP.sb().rpc('pipeline_folder_list').then((r) => r).catch((e) => ({ error: e })),
      S.callFn('/job-manager', { action: 'list_jobs', limit: 150 }, { toastErrors: false }),
      S.callFn('/apify-scrape-worker', { action: 'get_provider_status' }, { toastErrors: false }),
      S.callFn('/apify-scrape-worker', { action: 'list_runs', limit: 30 }, { toastErrors: false }),
    ]);

    if (!batchRes.error && Array.isArray(batchRes.data)) state.batches = batchRes.data;
    if (!folderRes.error && Array.isArray(folderRes.data)) state.folders = folderRes.data;
    if (jobsRes.ok && jobsRes.json?.ok) {
      state.jobs = jobsRes.json.jobs || [];
      state.workers = jobsRes.json.workers || [];
      state.namespaceStats = jobsRes.json.namespace_stats || state.namespaceStats;
    }
    if (apifyStatRes.ok && apifyStatRes.json?.ok) {
      state.apifyStatus = apifyStatRes.json;
      state.apifyKeys = Array.isArray(apifyStatRes.json.key_pool) ? apifyStatRes.json.key_pool : [];
    }
    if (apifyRunsRes.ok && apifyRunsRes.json?.ok) state.apifyRuns = apifyRunsRes.json.runs || [];
  }

  async function loadPipelineProps() {
    const { data, error } = await CP.sb().rpc('pipeline_list', { p_status: 'all', p_limit: 250, p_offset: 0 });
    if (!error && Array.isArray(data)) {
      state.pipelineProps = data;
    }
  }

  async function refreshScopedSummaries() {
    const b = _scopeBatch || null;
    const [valRes, enrRes, prcRes] = await Promise.all([
      S.callFn('/property-validator', { action: 'validation_summary', batch_id: b }, { toastErrors: false }),
      S.callFn('/enrich-description', { action: 'enrichment_summary', batch_id: b }, { toastErrors: false }),
      S.callFn('/calculate-pricing', { action: 'pricing_summary', batch_id: b }, { toastErrors: false }),
    ]);

    if (valRes.ok && valRes.json?.ok) state.valSummary = valRes.json;
    if (enrRes.ok && enrRes.json?.ok) state.enrSummary = enrRes.json;
    if (prcRes.ok && prcRes.json?.ok) state.prcSummary = prcRes.json;

    renderValidationPanel();
    renderEnrichmentPanel();
    renderPricingPanel();
    renderTopKpis();
  }

  async function loadRegistryAndRecovery() {
    const [regRes, recRes, histRes] = await Promise.all([
      S.callFn('/private-placement-registry', { action: 'list_registry', limit: 200 }, { toastErrors: false }),
      S.callFn('/pipeline-recovery', { action: 'list_recoverable' }, { toastErrors: false }),
      S.callFn('/pipeline-recovery', { action: 'list_history', limit: 50 }, { toastErrors: false }),
    ]);

    if (regRes.ok && regRes.json?.ok) {
      state.registryBatches = regRes.json.batches || [];
      if (regRes.json.namespace_stats) state.namespaceStats = regRes.json.namespace_stats;
    }
    if (recRes.ok && recRes.json?.ok) {
      state.recoverableBatches = recRes.json.batches || recRes.json.recoverable || [];
    }
    if (histRes.ok && histRes.json?.ok) {
      state.recoveryHistory = histRes.json.batches || histRes.json.history || [];
    }
  }

  async function loadAll() {
    await Promise.all([
      loadRulesModule(),
      loadBatchesAndJobs(),
      loadPipelineProps(),
      loadRegistryAndRecovery(),
    ]);
    await refreshScopedSummaries();
    populateBatchScopeSelector();
    renderAllPanels();
  }

  function populateBatchScopeSelector() {
    const sel = $('cc-scope-batch');
    if (!sel) return;
    const known = new Map();
    for (const b of state.batches) {
      known.set(String(b.batch_id), `${b.batch_id} · ${b.target_market || 'Unspecified'} (${b.batch_format === 'four_digit' ? '4-digit' : 'legacy'})`);
    }
    for (const r of state.registryBatches) {
      if (!known.has(String(r.batch_id))) {
        known.set(String(r.batch_id), `${r.batch_id} · ${r.target_market || 'Registry'}`);
      }
    }
    const opts = ['<option value="">All Batches (System-Wide)</option>'];
    Array.from(known.entries()).forEach(([id, label]) => {
      opts.push(`<option value="${S.esc(id)}"${id === _scopeBatch ? ' selected' : ''}>${S.esc(label)}</option>`);
    });
    sel.innerHTML = opts.join('');
    sel.value = _scopeBatch;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render Top KPIs
  // ─────────────────────────────────────────────────────────────────────────
  function renderTopKpis() {
    const pSet = state.policy?.policy_set;
    $('kpi-policy').textContent = pSet?.version_label || 'v1';
    $('kpi-policy-sub').textContent = state.policy?.pinned_to_batch
      ? `Pinned to Batch ${_scopeBatch}`
      : `${(state.policy?.rules || []).length} rules · ${state.profiles.length} blocked profiles`;

    const ns = state.namespaceStats;
    const activeFourDigit = state.batches.filter((b) => b.batch_format === 'four_digit').length;
    $('kpi-batches').textContent = ns ? `${ns.used_four_digit ?? activeFourDigit} / 10k` : String(state.batches.length);
    $('kpi-batches-sub').textContent = `${ns?.legacy_pb_batches ?? 18} legacy PB-* preserved`;

    const activeJobs = state.jobs.filter((j) => !['completed', 'failed', 'abandoned'].includes(String(j.stage))).length;
    $('kpi-jobs').textContent = `${activeJobs} / ${state.workers.length}`;
    $('kpi-jobs-sub').textContent = `${state.jobs.length} tracked jobs · ${state.workers.length} workers`;

    const vc = state.valSummary?.counts || { needs_review: 0, rejected: 0, passed: 0, pending: 0 };
    $('kpi-validation').textContent = String((vc.needs_review || 0) + (vc.rejected || 0));
    $('kpi-validation-sub').textContent = `${vc.passed || 0} passed · ${vc.pending || 0} pending`;

    $('kpi-recovery').textContent = String(state.recoverableBatches.length);
    const totalArchiveRows = state.recoverableBatches.reduce((sum, b) => sum + Number(b.recoverable_count || 0), 0);
    $('kpi-recovery-sub').textContent = `${totalArchiveRows} recoverable row(s) in 24h window`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel 1: Rules & Policies
  // ─────────────────────────────────────────────────────────────────────────
  function renderRulesPanel() {
    const pSet = state.policy?.policy_set;
    const rules = state.policy?.rules || [];
    const rMap = state.policy?.rules_map || {};

    $('rules-active-meta').textContent = pSet
      ? `Active: ${pSet.version_label} (${pSet.status}) · Activated ${S.fmtDate(pSet.activated_at || pSet.created_at)}`
      : 'No policy loaded';

    if ($('rule-desc-mode')) $('rule-desc-mode').value = String(unwrapRuleVal(rMap.description_mode) || 'baseline_rewrite');
    if ($('rule-desc-variance')) $('rule-desc-variance').value = String(Number(unwrapRuleVal(rMap.max_description_length_variance_pct) ?? 25));
    if ($('rule-recovery-hours')) $('rule-recovery-hours').value = String(Number(unwrapRuleVal(rMap.recovery_retention_hours) ?? 24));
    if ($('rule-share-ttl')) $('rule-share-ttl').value = String(Number(unwrapRuleVal(rMap.share_link_ttl_days) ?? 90));
    if ($('rule-show-pet')) $('rule-show-pet').checked = Boolean(unwrapRuleVal(rMap.show_pet_policy_on_client_page));
    if ($('rule-show-lease')) $('rule-show-lease').checked = Boolean(unwrapRuleVal(rMap.show_lease_summary_on_client_page));

    const immutableRules = rules.filter((r) => r.is_immutable);
    const immBody = $('rules-immutable-tbody');
    immBody.innerHTML = immutableRules.length
      ? immutableRules.map((r) => `
          <tr>
            <td><span class="cc-mono">${S.esc(r.rule_key)}</span>${r.description ? `<div class="text-xs muted">${S.esc(r.description)}</div>` : ''}</td>
            <td>${S.esc(r.category || 'core')}</td>
            <td><span class="cc-mono">${S.esc(JSON.stringify(unwrapRuleVal(r.value_json)))}</span></td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="cc-empty-row">No immutable rules found.</td></tr>';

    renderProhibitedProfiles();
    renderScrapingProviders();
    renderPolicyVersions();
  }

  function renderProhibitedProfiles() {
    const q = ($('prohibited-search')?.value || '').trim().toLowerCase();
    const list = state.profiles.filter((p) => {
      if (!q) return true;
      const hay = [p.canonical_name, ...(p.aliases || []), ...(p.zillow_profile_urls || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
    const tbody = $('prohibited-profiles-tbody');
    tbody.innerHTML = list.length
      ? list.map((p) => {
          const aliases = Array.isArray(p.aliases) ? p.aliases.join(', ') : '';
          const urls = Array.isArray(p.zillow_profile_urls) ? p.zillow_profile_urls : [];
          return `
            <tr>
              <td>
                <strong>${S.esc(p.canonical_name)}</strong>
                ${aliases ? `<div class="text-xs muted">Aliases: ${S.esc(aliases)}</div>` : ''}
                ${urls.length ? `<div class="text-xs cc-mono muted">${S.esc(urls.join(' · '))}</div>` : ''}
              </td>
              <td>${p.is_immutable ? badge('Core Locked', 'ok') : badge('Custom', 'info')}</td>
              <td>${p.enabled === false ? badge('Paused', 'warn') : badge('Active', 'ok')}</td>
              <td class="cc-nowrap">
                ${p.is_immutable ? '<span class="text-xs muted">Protected</span>' : `
                  <button type="button" class="btn btn-ghost btn-sm" data-cc="toggle-profile" data-id="${S.esc(p.id)}" data-enabled="${p.enabled !== false}">${p.enabled !== false ? 'Pause' : 'Enable'}</button>
                  <button type="button" class="btn btn-danger btn-sm" data-cc="delete-profile" data-id="${S.esc(p.id)}" data-name="${S.esc(p.canonical_name)}">Delete</button>
                `}
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="4" class="cc-empty-row">No prohibited profiles match the filter.</td></tr>';
  }

  function renderScrapingProviders() {
    const tbody = $('scraping-providers-tbody');
    tbody.innerHTML = state.providers.length
      ? state.providers.map((p) => {
          const modeLabel = p.channel_type === 'automated' ? 'on-demand (api)' : 'manual (extension)';
          return `
          <tr>
            <td><strong>${S.esc(p.display_name || p.provider_key)}</strong><div class="text-xs cc-mono muted">${S.esc(p.provider_key)}</div></td>
            <td>${S.esc(modeLabel)}</td>
            <td>${p.is_default ? badge('Default', 'ok') : '—'}</td>
            <td>${p.enabled ? badge('Enabled', 'ok') : badge('Disabled', 'muted')}</td>
            <td>
              <button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="toggle-provider" data-key="${S.esc(p.provider_key)}" data-enabled="${Boolean(p.enabled)}">${p.enabled ? 'Disable' : 'Enable'}</button>
            </td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="5" class="cc-empty-row">No providers configured.</td></tr>';
  }

  function renderPolicyVersions() {
    const tbody = $('policy-versions-tbody');
    tbody.innerHTML = state.versions.length
      ? state.versions.map((v) => `
          <tr>
            <td><strong>${S.esc(v.version_label)}</strong><div class="text-xs muted">${S.esc(v.notes || '')}</div></td>
            <td>${badge(v.status, v.status === 'active' ? 'active' : (v.status === 'draft' ? 'queued' : 'muted'))}</td>
            <td class="text-xs">${S.esc(v.created_by || 'system')}<div class="muted">${S.fmtDate(v.created_at)}</div></td>
            <td>
              ${v.status === 'draft'
                ? `<button type="button" class="btn btn-primary btn-sm cc-nowrap" data-cc="activate-version" data-id="${S.esc(v.id)}" data-label="${S.esc(v.version_label)}">Activate</button>`
                : (v.status === 'active' ? '<span class="text-xs muted">Current</span>' : '<span class="text-xs muted">Archived</span>')}
            </td>
          </tr>`).join('')
      : '<tr><td colspan="4" class="cc-empty-row">No versions found.</td></tr>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel 2: Batch Manager
  // ─────────────────────────────────────────────────────────────────────────
  function renderBatchesPanel() {
    const apifyOk = Boolean(state.apifyStatus?.apify_token_configured);
    const activeKeys = Number(state.apifyStatus?.apify_active_key_count ?? state.apifyKeys.filter((k) => k.usable_now).length);
    const totalKeys = Number(state.apifyStatus?.apify_token_count ?? state.apifyKeys.length);
    const remainingUsd = state.apifyKeys
      .filter((k) => k.usable_now && k.limit_usd_cached != null && k.usage_usd_cached != null)
      .reduce((acc, k) => acc + Math.max(0, Number(k.limit_usd_cached) - Number(k.usage_usd_cached)), 0);
    const creditNote = remainingUsd > 0 ? ` · ~$${remainingUsd.toFixed(2)} free credit` : '';
    $('apify-status-sub').textContent = apifyOk
      ? `On-demand only (runs when you click) · ${activeKeys} key(s) ready${creditNote} · Instant failover`
      : totalKeys > 0
      ? `On-demand only · All ${totalKeys} key(s) exhausted or disabled`
      : `On-demand only · Add an Apify key below to start`;

    const poolSub = $('apify-pool-sub');
    if (poolSub) {
      const exhaustedCount = state.apifyKeys.filter((k) => k.status === 'exhausted').length;
      const limitedCount = state.apifyKeys.filter((k) => k.status === 'rate_limited').length;
      poolSub.textContent = totalKeys
        ? `${activeKeys} active · ${limitedCount} rate-limited · ${exhaustedCount} exhausted${creditNote} · Exhausted keys are skipped in 0ms`
        : 'No Apify keys configured yet. Add free-tier keys for seamless automatic failover.';
    }

    const keysBody = $('apify-keys-tbody');
    if (keysBody) {
      keysBody.innerHTML = state.apifyKeys.length
        ? state.apifyKeys.map((k) => {
            const quotaText = k.limit_usd_cached != null && k.usage_usd_cached != null
              ? `$${Number(k.usage_usd_cached).toFixed(2)} / $${Number(k.limit_usd_cached).toFixed(2)}`
              : '—';
            const statusHint = k.status === 'rate_limited' && k.cooldown_until
              ? `<div class="text-xs muted">Retry after ${S.esc(new Date(k.cooldown_until).toLocaleTimeString())}</div>`
              : k.status === 'exhausted' && k.monthly_reset_at
              ? `<div class="text-xs muted">Resets ${S.esc(new Date(k.monthly_reset_at).toLocaleDateString())}</div>`
              : k.last_error
              ? `<div class="text-xs muted">${S.esc(String(k.last_error).slice(0, 72))}</div>`
              : '';
            return `
              <tr>
                <td>
                  <div><strong>#${Number(k.priority || 100)} · ${S.esc(k.label)}</strong> <span class="cc-mono muted">••••${S.esc(k.token_suffix)}</span></div>
                  ${k.apify_username ? `<div class="text-xs muted">${S.esc(k.apify_username)}</div>` : ''}
                </td>
                <td>${badge(k.source === 'edge_secret' ? 'Edge Secret' : 'Admin Pool', k.source === 'edge_secret' ? 'info' : 'muted')}</td>
                <td>${badge(k.status || 'active', k.status)}${statusHint}</td>
                <td class="cc-mono">${S.esc(quotaText)}</td>
                <td class="cc-num">${Number(k.runs_started || 0)} runs · ${Number(k.failover_count || 0)} failover(s)</td>
                <td>
                  <div class="row-flex gap-1" style="flex-wrap:wrap">
                    <button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="probe-apify-key" data-fp="${S.esc(k.key_fingerprint)}">Test</button>
                    ${k.status !== 'active' || !k.enabled
                      ? `<button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="reset-apify-key" data-fp="${S.esc(k.key_fingerprint)}">Reset</button>`
                      : `<button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="disable-apify-key" data-fp="${S.esc(k.key_fingerprint)}">Disable</button>`}
                    ${k.source === 'admin_pool'
                      ? `<button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="delete-apify-key" data-fp="${S.esc(k.key_fingerprint)}">Remove</button>`
                      : ''}
                  </div>
                </td>
              </tr>`;
          }).join('')
        : '<tr><td colspan="6" class="cc-empty-row">No Apify API keys configured yet. Click "+ Add Apify Key" above to load your free Apify keys.</td></tr>';
    }

    const runsBody = $('apify-runs-tbody');
    runsBody.innerHTML = state.apifyRuns.length
      ? state.apifyRuns.map((r) => {
          const runRef = r.provider_run_id || r.apify_run_id || r.id;
          const failovers = Array.isArray(r.failover_events) ? r.failover_events.length : 0;
          const keyMeta = [
            r.key_label ? S.esc(r.key_label) : null,
            r.parent_scrape_run_id ? `Continued from #${S.esc(String(r.parent_scrape_run_id))}` : null,
            failovers > 0 ? `${failovers} failover(s)` : null,
          ].filter(Boolean).join(' · ');
          const isTerminal = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT', 'CANCELLED'].includes(String(r.status || '').toUpperCase());
          return `
            <tr>
              <td class="cc-mono"><strong>${S.esc(r.batch_id || '—')}</strong></td>
              <td>
                <div class="cc-mono">${S.esc(String(runRef))}</div>
                ${keyMeta ? `<div class="text-xs muted">${keyMeta}</div>` : ''}
              </td>
              <td>${badge(r.status || 'unknown', r.status)}</td>
              <td class="cc-num">${Number(r.count_new ?? r.ingested_count ?? 0)} imported · ${Number(r.count_duplicate ?? r.deduped_count ?? 0)} skipped</td>
              <td>
                ${r.provider_run_id && !isTerminal
                  ? `<button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="poll-apify" data-scrape-id="${S.esc(String(r.id))}" data-run="${S.esc(r.provider_run_id)}" data-batch="${S.esc(r.batch_id || '')}">Poll &amp; Ingest</button>`
                  : '<span class="text-xs muted">—</span>'}
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="5" class="cc-empty-row">No Apify scrape runs recorded yet.</td></tr>';

    const fmtFilter = $('batches-format-filter')?.value || '';
    const q = ($('batches-search')?.value || '').trim().toLowerCase();
    const list = state.batches.filter((b) => {
      if (fmtFilter && b.batch_format !== fmtFilter) return false;
      if (_scopeBatch && String(b.batch_id) !== _scopeBatch) return false;
      if (q) {
        const hay = `${b.batch_id} ${b.target_market || ''} ${b.status || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const tbody = $('batches-tbody');
    tbody.innerHTML = list.length
      ? list.map((b) => {
          const folderCell = b.disposable_folder_id
            ? badge(b.folder_cleanup_state || 'active', b.folder_cleanup_state === 'deleted' ? 'ok' : 'info')
            : badge(b.folder_cleanup_state === 'deleted' ? 'deleted' : 'none', 'muted');
          const regRow = state.registryBatches.find((r) => String(r.batch_id) === String(b.batch_id));
          const verified = regRow?.link_verified_at ? badge('Verified', 'ok') : badge('Pending', 'muted');
          return `
            <tr>
              <td class="cc-mono"><strong>${S.esc(b.batch_id)}</strong></td>
              <td>${b.batch_format === 'four_digit' ? badge('4-Digit', 'info') : badge('Legacy PB', 'muted')}</td>
              <td>${S.esc(b.target_market || '—')}</td>
              <td>${folderCell}</td>
              <td class="cc-num">${Number(b.staging_count || 0)}</td>
              <td class="cc-num">${Number(b.published_count || 0)} / ${Number(b.failed_count || 0)}</td>
              <td>${verified}</td>
              <td class="cc-nowrap">
                <div class="row-flex gap-1">
                  <button type="button" class="btn btn-ghost btn-sm" data-cc="focus-batch" data-batch="${S.esc(b.batch_id)}">Scope</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-cc="validate-batch" data-batch="${S.esc(b.batch_id)}">Validate</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-cc="publish-batch" data-batch="${S.esc(b.batch_id)}">Publish</button>
                </div>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="8" class="cc-empty-row">No batches match the active filter.</td></tr>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel 3: Job Monitor
  // ─────────────────────────────────────────────────────────────────────────
  function renderJobsPanel() {
    const stageFilter = $('jobs-stage-filter')?.value || '';
    const list = state.jobs.filter((j) => {
      if (_scopeBatch && String(j.batch_id) !== _scopeBatch) return false;
      if (stageFilter && String(j.stage) !== stageFilter) return false;
      return true;
    });

    const jobsBody = $('jobs-tbody');
    jobsBody.innerHTML = list.length
      ? list.map((j) => {
          const canPause = !['completed', 'paused', 'failed', 'abandoned'].includes(String(j.stage));
          const canResume = ['paused', 'failed', 'abandoned', 'queued'].includes(String(j.stage));
          const prog = j.progress_json && Object.keys(j.progress_json).length ? JSON.stringify(j.progress_json) : '—';
          return `
            <tr>
              <td class="cc-mono"><strong>${S.esc(j.batch_id)}</strong><div class="text-xs muted">${S.esc(j.target_market || '')}</div></td>
              <td>
                ${badge(j.stage, j.stage)}
                ${j.resume_stage ? `<div class="text-xs muted" style="margin-top:2px">Resume: ${S.esc(j.resume_stage)}</div>` : ''}
                ${j.error_message ? `<div class="text-xs" style="color:var(--danger);margin-top:2px">${S.esc(j.error_message)}</div>` : ''}
              </td>
              <td class="cc-mono">${S.esc(j.worker_id || 'unassigned')}</td>
              <td class="text-xs">${j.lease_expires_at ? S.fmtRelative(j.lease_expires_at) : '—'}</td>
              <td class="cc-mono text-xs" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${S.esc(prog)}">${S.esc(prog)}</td>
              <td class="cc-nowrap">
                <div class="row-flex gap-1">
                  ${canPause ? `<button type="button" class="btn btn-ghost btn-sm" data-cc="pause-job" data-batch="${S.esc(j.batch_id)}">Pause</button>` : ''}
                  ${canResume ? `<button type="button" class="btn btn-primary btn-sm" data-cc="resume-job" data-batch="${S.esc(j.batch_id)}" data-worker="${S.esc(j.worker_id || '')}">Resume</button>` : ''}
                  <button type="button" class="btn btn-ghost btn-sm" data-cc="inspect-job" data-batch="${S.esc(j.batch_id)}">Inspect</button>
                </div>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="6" class="cc-empty-row">No jobs match the active filter.</td></tr>';

    const wBody = $('workers-tbody');
    wBody.innerHTML = state.workers.length
      ? state.workers.map((w) => `
          <tr>
            <td class="cc-mono"><strong>${S.esc(w.worker_id)}</strong></td>
            <td>${S.esc(w.worker_type || 'ai_worker')}</td>
            <td>${badge(w.status || 'idle', w.status)}</td>
            <td class="cc-mono">${S.esc(w.current_batch_id || '—')}</td>
            <td class="text-xs">${w.last_heartbeat_at ? S.fmtRelative(w.last_heartbeat_at) : '—'}</td>
            <td class="cc-num">${Number(w.leases_reaped_count || 0)}</td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="cc-empty-row">No registered workers yet.</td></tr>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel 4: Validation Queue
  // ─────────────────────────────────────────────────────────────────────────
  function renderValidationPanel() {
    const counts = state.valSummary?.counts || { pending: 0, passed: 0, needs_review: 0, rejected: 0 };
    $('val-counts-strip').innerHTML = [
      badge(`Needs Review: ${counts.needs_review || 0}`, 'needs_review'),
      badge(`Rejected: ${counts.rejected || 0}`, 'rejected'),
      badge(`Pending: ${counts.pending || 0}`, 'pending'),
      badge(`Passed: ${counts.passed || 0}`, 'passed'),
    ].join('');

    const statusFilter = $('val-status-filter')?.value || '';
    const q = ($('val-search')?.value || '').trim().toLowerCase();
    const list = filteredPipelineProps().filter((p) => {
      if (p.status === 'archived') return false;
      const vs = String(p.validation_status || 'pending');
      if (statusFilter && vs !== statusFilter) return false;
      if (q) {
        const hay = `${p.address || ''} ${p.city || ''} ${p.agent_name || ''} ${p.broker_name || ''} ${p.review_reason || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const tbody = $('validation-tbody');
    tbody.innerHTML = list.length
      ? list.map((p) => {
          const vs = String(p.validation_status || 'pending');
          const photoCount = Array.isArray(p.original_image_urls) ? p.original_image_urls.length : 0;
          const poster = [p.agent_name, p.broker_name].filter(Boolean).join(' · ') || 'Unspecified';
          return `
            <tr>
              <td>
                <strong>${S.esc(p.address || p.title || 'Untitled')}</strong>
                <div class="text-xs muted">${S.esc([p.city, p.state, p.zip].filter(Boolean).join(', '))} · ${fmtMoney(p.monthly_rent)}/mo</div>
              </td>
              <td class="cc-mono">${S.esc(p.batch_id || 'manual')}</td>
              <td class="text-xs">${S.esc(poster)}<div class="muted">${S.esc(p.property_type || '—')}</div></td>
              <td class="cc-num">${photoCount}</td>
              <td>
                ${badge(vs, vs)}
                ${p.review_reason ? `<div class="text-xs muted" style="margin-top:3px">${S.esc(p.review_reason)}</div>` : ''}
              </td>
              <td class="cc-nowrap">
                <div class="row-flex gap-1">
                  <button type="button" class="btn btn-ghost btn-sm" data-cc="inspect-validation" data-id="${S.esc(p.id)}">Report</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-cc="validate-one" data-id="${S.esc(p.id)}">Re-run</button>
                  ${vs !== 'passed' ? `<button type="button" class="btn btn-primary btn-sm" data-cc="resolve-val" data-id="${S.esc(p.id)}" data-decision="approve">Approve</button>` : ''}
                  ${vs !== 'rejected' ? `<button type="button" class="btn btn-danger btn-sm" data-cc="resolve-val" data-id="${S.esc(p.id)}" data-decision="reject">Reject</button>` : ''}
                </div>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="6" class="cc-empty-row">No staged properties match the validation filter.</td></tr>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel 5: Enrichment Review
  // ─────────────────────────────────────────────────────────────────────────
  function renderEnrichmentPanel() {
    const counts = state.enrSummary?.counts || { pending: 0, enriched: 0, needs_review: 0, failed: 0 };
    $('enr-counts-strip').innerHTML = [
      badge(`Enriched: ${counts.enriched || 0}`, 'enriched'),
      badge(`Needs Review: ${counts.needs_review || 0}`, 'needs_review'),
      badge(`Pending: ${counts.pending || 0}`, 'pending'),
      badge(`Failed: ${counts.failed || 0}`, 'failed'),
    ].join('');

    const statusFilter = $('enr-status-filter')?.value || '';
    const q = ($('enr-search')?.value || '').trim().toLowerCase();
    const list = filteredPipelineProps().filter((p) => {
      if (p.status === 'archived') return false;
      const es = String(p.enrichment_status || 'pending');
      if (statusFilter && es !== statusFilter) return false;
      if (q) {
        const hay = `${p.address || ''} ${p.original_description || ''} ${p.approved_description || p.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).slice(0, 40);

    const compWrap = $('enr-comparison-list');
    compWrap.innerHTML = list.length
      ? list.map((p) => {
          const es = String(p.enrichment_status || 'pending');
          const orig = p.original_description || '';
          const draftOrApproved = p.approved_description || p.ai_description_draft || p.description || '';
          const meta = p.description_enrichment_meta || {};
          return `
            <div class="cc-surface">
              <div class="cc-surface-hd">
                <div>
                  <strong>${S.esc(p.address || 'Untitled')}</strong>
                  <span class="cc-mono muted" style="margin-left:8px">${S.esc(p.batch_id || 'manual')}</span>
                  ${badge(es, es)}
                </div>
                <div class="row-flex gap-2">
                  ${meta.mode ? `<span class="text-xs muted">${S.esc(meta.mode)} · ${S.esc(meta.model || 'rules')}</span>` : ''}
                  <button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="enrich-one" data-id="${S.esc(p.id)}">Re-Enrich</button>
                </div>
              </div>
              <div class="cc-surface-body">
                <div class="cc-diff-grid">
                  <div>
                    <div class="cc-diff-label"><span>Original Baseline</span><span class="cc-num">${orig.length} chars</span></div>
                    <div class="cc-diff-box">${orig ? S.esc(orig) : '<span class="muted">No original description captured.</span>'}</div>
                  </div>
                  <div>
                    <div class="cc-diff-label"><span>AI Draft / Approved Output</span><span class="cc-num">${draftOrApproved.length} chars</span></div>
                    <div class="cc-diff-box">${draftOrApproved ? S.esc(draftOrApproved) : '<span class="muted">Not enriched yet.</span>'}</div>
                  </div>
                </div>
              </div>
            </div>`;
        }).join('')
      : '<div class="cc-alert">No properties match the enrichment filter.</div>';

    const audits = state.enrSummary?.recent_audits || [];
    const auditBody = $('enr-audit-tbody');
    auditBody.innerHTML = audits.length
      ? audits.map((a) => `
          <tr>
            <td class="cc-mono">${S.esc(a.batch_id || '—')}</td>
            <td class="cc-mono text-xs">${S.esc(String(a.pipeline_property_id || a.property_id || '—').slice(0, 8))}</td>
            <td class="text-xs">${S.esc(a.mode || '—')} · ${S.esc(a.model || '—')}</td>
            <td class="cc-num">${a.confidence != null ? Number(a.confidence).toFixed(2) : '—'}</td>
            <td class="text-xs">${S.esc((a.reasons || []).join(', ') || 'Clean')}</td>
            <td class="text-xs">${S.fmtRelative(a.created_at)}</td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="cc-empty-row">No enrichment audits recorded yet.</td></tr>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel 6: Pricing Audit
  // ─────────────────────────────────────────────────────────────────────────
  function renderPricingPanel() {
    const counts = state.prcSummary?.counts || { pending: 0, calculated: 0, held_out_of_range: 0, error: 0 };
    $('prc-counts-strip').innerHTML = [
      badge(`Calculated: ${counts.calculated || 0}`, 'calculated'),
      badge(`Out of Range: ${counts.held_out_of_range || 0}`, 'held_out_of_range'),
      badge(`Pending: ${counts.pending || 0}`, 'pending'),
      badge(`Errors: ${counts.error || 0}`, 'error'),
    ].join('');

    const calcs = state.prcSummary?.calculations || [];
    const tbody = $('pricing-audit-tbody');
    tbody.innerHTML = calcs.length
      ? calcs.map((c) => {
          const rangeText = c.source_min != null && c.source_max != null
            ? `[${fmtMoney(c.source_min)}–${fmtMoney(c.source_max)}] -> [${fmtMoney(c.target_min)}–${fmtMoney(c.target_max)}]`
            : '—';
          return `
            <tr>
              <td class="cc-mono">${S.esc(c.batch_id || '—')}</td>
              <td class="cc-mono text-xs">${S.esc(String(c.pipeline_property_id || '—').slice(0, 8))}</td>
              <td class="cc-num">${fmtMoney(c.original_rent)}</td>
              <td class="cc-num"><strong>${fmtMoney(c.calculated_rent)}</strong>${c.was_clamped ? ' <span class="text-xs muted">(clamped)</span>' : ''}</td>
              <td class="text-xs">${S.esc(c.method || '—')}<div class="muted cc-num">${S.esc(rangeText)}</div></td>
              <td>${badge(c.status || '—', c.status)}${c.reason ? `<div class="text-xs muted">${S.esc(c.reason)}</div>` : ''}</td>
              <td class="cc-mono text-xs">${S.esc(c.policy_version || 'v1')}</td>
              <td class="text-xs">${S.fmtRelative(c.created_at)}</td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="8" class="cc-empty-row">No pricing calculations recorded yet.</td></tr>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel 7: Private Placement Registry
  // ─────────────────────────────────────────────────────────────────────────
  function renderRegistryLookupResult(reg) {
    const wrap = $('reg-lookup-result');
    if (!wrap) return;
    if (!reg) {
      wrap.innerHTML = '';
      return;
    }
    if (!reg.found) {
      wrap.innerHTML = `<div class="cc-alert cc-alert-warn">No registry record found for Batch <strong>${S.esc(reg.batch_id || '')}</strong>.</div>`;
      return;
    }

    const st = reg.effective_share_status || 'not_generated';
    const expNote = st === 'expired'
      ? `Expired ${reg.days_expired ?? 0}d ago (${S.fmtDate(reg.expires_at)})`
      : (reg.expires_at ? `Expires ${S.fmtDate(reg.expires_at)} (${reg.days_remaining ?? 0}d left)` : 'No expiration');
    const props = Array.isArray(reg.properties) ? reg.properties : [];

    wrap.innerHTML = `
      <div class="cc-surface" style="border-color:var(--border-strong)">
        <div class="cc-surface-hd">
          <div>
            <strong>Batch #${S.esc(reg.batch_id)}</strong> · ${S.esc(reg.target_market || 'Unspecified')}
            ${badge(st, st)}
            ${reg.link_verified_at ? badge('Link Verified', 'ok') : ''}
          </div>
          <div class="row-flex gap-2">
            ${reg.magic_link_url ? `<button type="button" class="btn btn-primary btn-sm cc-nowrap" id="reg-spotlight-copy">Copy Link</button>` : ''}
            ${reg.magic_link_url && st === 'active' ? `<a href="${S.esc(reg.magic_link_url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm cc-nowrap">Open Link</a>` : ''}
            <button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="replace-link" data-batch="${S.esc(reg.batch_id)}" data-status="${S.esc(st)}">Replace Link</button>
          </div>
        </div>
        <div class="cc-surface-body cc-stack" style="gap:10px">
          ${reg.magic_link_url ? `<div class="cc-code-block">${S.esc(reg.magic_link_url)}</div>` : '<div class="cc-alert">No share link minted yet for this batch.</div>'}
          <div class="cc-grid-3 text-xs muted">
            <div><strong style="color:var(--text)">Expiration:</strong> ${S.esc(expNote)}</div>
            <div><strong style="color:var(--text)">Disposable Folder:</strong> ${S.esc(reg.folder_cleanup_state || (reg.folder_exists ? 'active' : 'deleted'))}</div>
            <div><strong style="color:var(--text)">Views / Props:</strong> ${Number(reg.view_count || 0)} views · ${Number(reg.published_count || props.length || 0)} properties</div>
          </div>
          ${props.length ? `
            <div class="cc-table-wrap">
              <table class="cc-table">
                <thead><tr><th>Address</th><th>Rent</th><th>Layout</th><th>Status</th></tr></thead>
                <tbody>
                  ${props.map((pr) => `
                    <tr>
                      <td>${S.esc(pr.address || pr.title || pr.property_id)}<div class="text-xs muted">${S.esc([pr.city, pr.state, pr.zip].filter(Boolean).join(', '))}</div></td>
                      <td class="cc-num">${fmtMoney(pr.published_rent ?? pr.monthly_rent)}/mo</td>
                      <td class="text-xs">${S.esc(pr.bedrooms ?? '—')} bd / ${S.esc(pr.bathrooms ?? '—')} ba</td>
                      <td>${badge(pr.published_status || pr.status || 'published', 'published')}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>` : ''}
        </div>
      </div>`;

    const copyBtn = $('reg-spotlight-copy');
    if (copyBtn && reg.magic_link_url) {
      copyBtn.addEventListener('click', () => copyText(reg.magic_link_url, copyBtn));
    }
  }

  function renderRegistryPanel() {
    const stFilter = $('reg-status-filter')?.value || '';
    const fmtFilter = $('reg-format-filter')?.value || '';
    const q = ($('reg-search')?.value || '').trim().toLowerCase();

    const list = state.registryBatches.filter((r) => {
      if (_scopeBatch && String(r.batch_id) !== _scopeBatch) return false;
      if (stFilter && String(r.effective_share_status) !== stFilter) return false;
      if (fmtFilter && String(r.batch_format) !== fmtFilter) return false;
      if (q) {
        const hay = `${r.batch_id} ${r.target_market || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const tbody = $('registry-tbody');
    tbody.innerHTML = list.length
      ? list.map((r) => `
          <tr>
            <td class="cc-mono"><strong>${S.esc(r.batch_id)}</strong><div class="text-xs muted">${S.esc(r.batch_format || '')}</div></td>
            <td>${S.esc(r.target_market || '—')}</td>
            <td class="cc-num">${Number(r.published_count || 0)}</td>
            <td>${badge(r.effective_share_status || 'not_generated', r.effective_share_status)}</td>
            <td class="text-xs">${r.expires_at ? S.fmtDate(r.expires_at) : '—'}<div class="muted">${Number(r.view_count || 0)} views</div></td>
            <td>${badge(r.folder_cleanup_state || (r.folder_exists ? 'active' : 'deleted'), r.folder_cleanup_state === 'deleted' ? 'ok' : 'info')}</td>
            <td class="cc-nowrap">
              <div class="row-flex gap-1">
                <button type="button" class="btn btn-ghost btn-sm" data-cc="reg-inspect" data-batch="${S.esc(r.batch_id)}">Inspect</button>
                ${r.magic_link_url ? `<button type="button" class="btn btn-ghost btn-sm" data-cc="copy-url" data-url="${S.esc(r.magic_link_url)}">Copy Link</button>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" data-cc="replace-link" data-batch="${S.esc(r.batch_id)}" data-status="${S.esc(r.effective_share_status || '')}">Replace</button>
              </div>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="7" class="cc-empty-row">No registry records match the filter.</td></tr>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel 8: Recovery & Cleanup Manager
  // ─────────────────────────────────────────────────────────────────────────
  function renderRecoveryPanel() {
    const batchFolders = state.folders.filter((f) => f.is_disposable_batch || f.batch_id);
    const cfBody = $('cleanup-folders-tbody');
    cfBody.innerHTML = batchFolders.length
      ? batchFolders.map((f) => {
          const bId = String(f.batch_id || f.name);
          const reg = state.registryBatches.find((r) => String(r.batch_id) === bId);
          const verified = Boolean(reg?.link_verified_at);
          return `
            <tr>
              <td><strong class="cc-mono">${S.esc(bId)}</strong><div class="text-xs muted">${S.esc(f.name)}</div></td>
              <td class="cc-num">${Number(f.property_count || 0)} total · ${Number(f.published_count || 0)} pub</td>
              <td>${verified ? badge('Verified', 'ok') : badge('Unverified', 'warn')}</td>
              <td>
                <button type="button" class="btn btn-ghost btn-sm cc-nowrap" data-cc="cleanup-folder" data-batch="${S.esc(bId)}" ${verified ? '' : 'title="Blocked until link_verified_at is set"'}>Run Safe Cleanup</button>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="4" class="cc-empty-row">No active disposable batch folders in staging.</td></tr>';

    const recBody = $('recoverable-tbody');
    recBody.innerHTML = state.recoverableBatches.length
      ? state.recoverableBatches.map((b) => `
          <tr>
            <td class="cc-mono"><strong>${S.esc(b.batch_id)}</strong></td>
            <td>${S.esc(b.target_market || '—')}</td>
            <td class="cc-num">${Number(b.recoverable_count || 0)}</td>
            <td class="text-xs">${b.recovery_expires_at ? S.fmtDate(b.recovery_expires_at) : '—'}</td>
            <td>
              <button type="button" class="btn btn-primary btn-sm cc-nowrap" data-cc="restore-batch" data-batch="${S.esc(b.batch_id)}">Restore</button>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="cc-empty-row">No batches currently awaiting restoration in the 24h recovery archive.</td></tr>';

    const histBody = $('recovery-history-tbody');
    histBody.innerHTML = state.recoveryHistory.length
      ? state.recoveryHistory.map((h) => `
          <tr>
            <td class="cc-mono"><strong>${S.esc(h.id || h.batch_id)}</strong></td>
            <td>${S.esc(h.target_market || '—')}</td>
            <td class="cc-num">${Number(h.published_count || 0)} / ${Number(h.failed_count || 0)}</td>
            <td>${badge(h.recovery_status || 'active', h.recovery_status)}</td>
            <td class="text-xs">${S.fmtRelative(h.completed_at || h.started_at)}</td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="cc-empty-row">No publishing history entries found.</td></tr>';
  }

  function renderAllPanels() {
    renderTopKpis();
    renderRulesPanel();
    renderBatchesPanel();
    renderJobsPanel();
    renderValidationPanel();
    renderEnrichmentPanel();
    renderPricingPanel();
    renderRegistryPanel();
    renderRecoveryPanel();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interactive Actions
  // ─────────────────────────────────────────────────────────────────────────
  function readRulesFormUpdates() {
    return {
      description_mode: $('rule-desc-mode').value,
      max_description_length_variance_pct: Number($('rule-desc-variance').value || 25),
      recovery_retention_hours: Number($('rule-recovery-hours').value || 24),
      share_link_ttl_days: Number($('rule-share-ttl').value || 90),
      show_pet_policy_on_client_page: Boolean($('rule-show-pet').checked),
      show_lease_summary_on_client_page: Boolean($('rule-show-lease').checked),
    };
  }

  function wireEvents() {
    // Tabs
    $('cc-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.cc-tab');
      if (!btn || !btn.dataset.tab) return;
      setTab(btn.dataset.tab);
    });

    // Global batch scope + refresh
    $('cc-scope-batch')?.addEventListener('change', (e) => setBatchScope(e.target.value));
    $('cc-refresh-all-btn')?.addEventListener('click', () => {
      S.toast('Refreshing Control Center…', 'info', 1400);
      loadAll().catch((err) => S.toast('Refresh failed: ' + (err.message || err), 'error'));
    });

    // Rules Engine: Dry Run
    $('btn-dry-run-policy')?.addEventListener('click', async () => {
      const updates = readRulesFormUpdates();
      const res = await S.callFn('/rules-engine', {
        action: 'evaluate_dry_run',
        proposed_updates: updates,
        sample_listing: { monthly_rent: 1650, photo_count: 5, description: 'Clean 3 bed home.' },
      });
      if (!res.ok) return;
      const box = $('rules-dry-run-output');
      box.style.display = 'block';
      box.innerHTML = `<div class="cc-diff-label"><span>Dry-Run Result (Zero Live Mutations)</span><span class="cc-mono">${(res.json.diffs || []).length} diff(s)</span></div>` +
        `<pre class="cc-code-block">${S.esc(JSON.stringify(res.json, null, 2))}</pre>`;
      S.toast('Policy dry-run completed with 0 live DB writes', 'success');
    });

    // Rules Engine: Save Draft
    $('btn-save-draft-policy')?.addEventListener('click', async () => {
      const updates = readRulesFormUpdates();
      const reason = ($('rule-change-reason')?.value || '').trim() || 'Draft policy update from Control Center';
      const res = await S.callFn('/rules-engine', {
        action: 'create_draft_version',
        updates,
        notes: reason,
      });
      if (!res.ok) return;
      S.toast(`Saved draft ${res.json?.draft_policy_set?.version_label || ''}`, 'success');
      await loadRulesModule();
      renderRulesPanel();
    });

    // Rules Engine: Publish & Activate
    $('rules-config-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = ($('rule-change-reason')?.value || '').trim();
      if (reason.length < 3) {
        S.toast('Enter a change reason before activating a new policy version', 'warning');
        return;
      }
      const ok = await S.confirm({
        title: 'Publish & activate new policy version?',
        message: 'Existing in-flight batches stay pinned to their starting policy version. Only new batches will inherit the updated settings.',
        ok: 'Activate Version',
      });
      if (!ok) return;
      const res = await S.callFn('/rules-engine', {
        action: 'update_rules',
        updates: readRulesFormUpdates(),
        reason,
      });
      if (!res.ok) return;
      S.toast('New policy version activated', 'success');
      $('rule-change-reason').value = '';
      await loadRulesModule();
      renderAllPanels();
    });

    // Prohibited Profiles search + Add modal
    $('prohibited-search')?.addEventListener('input', renderProhibitedProfiles);
    $('btn-add-prohibited')?.addEventListener('click', async () => {
      const form = await S.formSheet({
        title: 'Add Prohibited Source Profile',
        submit: 'Save Profile',
        fields: [
          { name: 'canonical_name', label: 'Operator / Company Name', required: true, placeholder: 'e.g. Invitation Homes' },
          { name: 'aliases', label: 'Comma-separated Aliases', placeholder: 'e.g. IH Rental, InvHomes' },
          { name: 'zillow_profile_urls', label: 'Zillow Profile URL (optional)', placeholder: 'https://www.zillow.com/profile/...' },
          { name: 'notes', label: 'Notes', placeholder: 'Reason for permanent block' },
        ],
      });
      if (!form) return;
      const res = await S.callFn('/rules-engine', {
        action: 'prohibited_profiles',
        sub_action: 'create',
        canonical_name: form.canonical_name,
        aliases: form.aliases ? form.aliases.split(',').map((s) => s.trim()).filter(Boolean) : [],
        zillow_profile_urls: form.zillow_profile_urls ? [form.zillow_profile_urls.trim()] : [],
        notes: form.notes || null,
      });
      if (!res.ok) return;
      S.toast(`Added "${form.canonical_name}" to Prohibited Profiles`, 'success');
      await loadRulesModule();
      renderRulesPanel();
    });

    // Batch Creation Form
    const prcSelect = $('cb-pricing-method');
    if (prcSelect) {
      prcSelect.addEventListener('change', () => {
        const m = prcSelect.value;
        $('cb-pricing-extra').style.display = m === 'fixed' ? 'grid' : 'none';
        $('cb-range-extra').style.display = m === 'proportional_range' ? 'grid' : 'none';
      });
    }

    $('create-batch-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const batchId = ($('cb-batch-id').value || '').trim();
      if (!/^[0-9]{4}$/.test(batchId)) {
        S.toast('Batch ID must be strictly 4 digits (0000–9999)', 'error');
        return;
      }
      const method = $('cb-pricing-method').value;
      const pricingConfig = { method };
      if (method === 'fixed') pricingConfig.fixed_rent = Number($('cb-fixed-rent').value || 0);
      if (method === 'proportional_range') {
        pricingConfig.source_min = Number($('cb-smin').value || 0);
        pricingConfig.source_max = Number($('cb-smax').value || 0);
        pricingConfig.target_min = Number($('cb-tmin').value || 0);
        pricingConfig.target_max = Number($('cb-tmax').value || 0);
      }
      const visibility = $('cb-visibility').value || 'private_placement';
      let explicitPublicOverride = false;
      if (visibility === 'active') {
        const okPublic = await S.confirm({
          title: `Confirm PUBLIC Marketplace Override for Batch #${batchId}?`,
          message: 'Strict Policy: every job publishes as Private Placement unless you explicitly instruct Public (active) visibility.',
          ok: 'Confirm Public Override',
        });
        if (!okPublic) return;
        explicitPublicOverride = true;
      }
      const workerId = ($('cb-worker-id')?.value || '').trim() || null;
      const res = await S.callFn('/job-manager', {
        action: 'register_job',
        batch_id: batchId,
        target_market: $('cb-market').value.trim(),
        visibility,
        explicit_public_override: explicitPublicOverride,
        public_override_reason: explicitPublicOverride ? 'Explicit Admin Control Center override' : undefined,
        description: $('cb-notes').value.trim() || null,
        worker_id: workerId,
        claim_immediately: Boolean(workerId),
        task_config: {
          pricing_config: pricingConfig,
          ...(explicitPublicOverride ? { explicit_public_override: true } : {}),
        },
      });
      if (!res.ok) return;
      S.toast(`Registered Batch #${batchId} (${res.json?.policy_set_id ? 'policy pinned' : 'ready'})`, 'success');
      $('cb-batch-id').value = '';
      await loadBatchesAndJobs();
      await loadRegistryAndRecovery();
      populateBatchScopeSelector();
      renderAllPanels();
    });

    // Launch Apify Scrape Modal (Strictly Operator-Triggered On-Demand)
    $('btn-launch-apify')?.addEventListener('click', async () => {
      const recentBatch = state.batches.find((b) => b.batch_format === 'four_digit')?.batch_id || '';
      const form = await S.formSheet({
        title: 'Launch On-Demand Apify Zillow Scrape',
        submit: 'Run Scrape Now',
        fields: [
          { name: 'batch_id', label: 'Target 4-Digit Batch ID (must be registered first)', required: true, value: _scopeBatch || recentBatch, placeholder: '4821' },
          { name: 'locations', label: 'City / State or ZIPs (comma-separated)', placeholder: 'Yukon OK, Mustang OK' },
          { name: 'search_urls', label: 'Zillow Search URLs (optional, one per line)', type: 'textarea', rows: 2, placeholder: 'https://www.zillow.com/yukon-ok/rentals/' },
          { name: 'max_items', label: 'Target Listing Count', type: 'number', value: '25' },
          { name: 'min_rent', label: 'Min Rent $/mo (optional)', type: 'number', placeholder: '1200' },
          { name: 'max_rent', label: 'Max Rent $/mo (optional)', type: 'number', placeholder: '2200' },
        ],
      });
      if (!form) return;
      const urls = form.search_urls ? form.search_urls.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
      const locs = form.locations ? form.locations.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const targetQty = Math.max(1, Number(form.max_items || 25));
      const minRent = Number(form.min_rent || 0) || undefined;
      const maxRent = Number(form.max_rent || 0) || undefined;

      const res = await callBatchAction('/apify-scrape-worker', {
        action: 'start_run',
        batch_id: form.batch_id.trim(),
        locations: locs,
        search_urls: urls,
        target_qty: targetQty,
        min_rent: minRent,
        max_rent: maxRent,
        task_config: {
          locations: locs,
          search_urls: urls,
          target_qty: targetQty,
          ...(minRent ? { min_rent: minRent } : {}),
          ...(maxRent ? { max_rent: maxRent } : {}),
        },
      });
      if (!res.ok) return;

      const keyLabel = res.json?.used_key ? ` using ${res.json.used_key.label} (••••${res.json.used_key.token_suffix})` : '';
      const foCount = Array.isArray(res.json?.failover_events) ? res.json.failover_events.length : 0;
      const foNote = foCount > 0 ? ` after ${foCount} instant key failover(s)` : '';
      const importedNow = res.json?.chunk_outcome?.count_new ?? 0;

      if (!res.json?.has_more) {
        S.toast(`Scrape finished for Batch #${form.batch_id}${keyLabel}${foNote}: ${importedNow} imported.`, 'success', 5000);
      } else {
        S.toast(`Apify run started for Batch #${form.batch_id}${keyLabel}${foNote}. Polling results…`, 'info', 4000);
        let activeScrapeId = res.json?.scrape_run_id;
        let activeRunId = res.json?.apify_run_id;
        for (let attempt = 0; attempt < 12 && activeScrapeId; attempt++) {
          await new Promise((r) => setTimeout(r, 5000));
          const poll = await callBatchAction('/apify-scrape-worker', {
            action: 'poll_and_ingest',
            scrape_run_id: activeScrapeId,
            provider_run_id: activeRunId,
            batch_id: form.batch_id.trim(),
          }, { toastErrors: false });
          if (!poll.ok) break;
          if (poll.json?.auto_handed_off && poll.json?.continuation_run) {
            activeScrapeId = poll.json.continuation_run.id;
            activeRunId = poll.json.continuation_run.provider_run_id;
            S.toast(poll.json.message || 'Switched to next healthy Apify key cleanly!', 'warning', 4500);
            continue;
          }
          if (!poll.json?.has_more) {
            const totalNew = poll.json?.totals?.count_new ?? poll.json?.chunk_outcome?.count_new ?? 0;
            S.toast(`Batch #${form.batch_id} scrape complete: ${totalNew} property listing(s) imported.`, 'success', 5500);
            break;
          }
        }
      }

      await loadBatchesAndJobs();
      await loadPipelineProps();
      renderAllPanels();
    });

    // Add Apify Key Modal
    $('btn-add-apify-key')?.addEventListener('click', async () => {
      const form = await S.formSheet({
        title: 'Add Apify API Key to Failover Pool',
        submit: 'Validate & Save Key',
        fields: [
          { name: 'label', label: 'Key Label', placeholder: 'Free Account #2' },
          { name: 'token', label: 'Apify API Token', type: 'password', required: true, placeholder: 'apify_api_...' },
          { name: 'priority', label: 'Priority Order (lower runs first)', type: 'number', value: String((state.apifyKeys.length + 1) * 10) },
        ],
      });
      if (!form) return;
      const res = await S.callFn('/apify-scrape-worker', {
        action: 'add_key',
        label: form.label.trim() || undefined,
        token: form.token.trim(),
        priority: Number(form.priority || 50),
        validate_live: true,
      });
      if (!res.ok) return;
      const st = res.json?.key?.status || 'active';
      S.toast(`Saved Apify key ••••${res.json?.key?.token_suffix || ''} (${st})`, st === 'active' ? 'success' : 'warning');
      await loadBatchesAndJobs();
      renderBatchesPanel();
    });

    // Probe All Apify Key Quotas
    $('btn-probe-apify-keys')?.addEventListener('click', async () => {
      const btn = $('btn-probe-apify-keys');
      if (btn) btn.disabled = true;
      try {
        const res = await S.callFn('/apify-scrape-worker', { action: 'probe_keys' });
        if (!res.ok) return;
        state.apifyKeys = Array.isArray(res.json?.keys) ? res.json.keys : state.apifyKeys;
        S.toast(`Checked ${res.json?.total_count || 0} key(s): ${res.json?.active_count || 0} active`, 'success');
        await loadBatchesAndJobs();
        renderBatchesPanel();
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    // Batch filters + Job filters + Validation/Enrichment/Registry filters
    $('batches-format-filter')?.addEventListener('change', renderBatchesPanel);
    $('batches-search')?.addEventListener('input', renderBatchesPanel);
    $('jobs-stage-filter')?.addEventListener('change', renderJobsPanel);
    $('val-status-filter')?.addEventListener('change', renderValidationPanel);
    $('val-search')?.addEventListener('input', renderValidationPanel);
    $('enr-status-filter')?.addEventListener('change', renderEnrichmentPanel);
    $('enr-search')?.addEventListener('input', renderEnrichmentPanel);
    $('reg-status-filter')?.addEventListener('change', renderRegistryPanel);
    $('reg-format-filter')?.addEventListener('change', renderRegistryPanel);
    $('reg-search')?.addEventListener('input', renderRegistryPanel);

    // Reap stale leases
    $('btn-reap-leases')?.addEventListener('click', async () => {
      const res = await S.callFn('/job-manager', { action: 'reap_stale_leases', worker_stale_minutes: 10 });
      if (!res.ok) return;
      S.toast(`Reaped ${res.json?.reaped_jobs_count ?? 0} expired job lease(s)`, 'success');
      await loadBatchesAndJobs();
      renderJobsPanel();
      renderTopKpis();
    });

    // Run Validation Queue/Batch
    $('btn-run-validation-batch')?.addEventListener('click', async () => {
      const res = await callBatchAction('/property-validator', {
        action: 'validate_batch',
        batch_id: _scopeBatch || null,
        limit: 100,
        check_photo_reachability: Boolean($('val-check-reachability')?.checked),
      });
      if (!res.ok) return;
      S.toast(`Validated ${res.json.total}: ${res.json.passed_count} passed, ${res.json.needs_review_count} review, ${res.json.rejected_count} rejected`, 'success');
      await loadPipelineProps();
      await refreshScopedSummaries();
    });

    // Run Enrichment Batch
    $('btn-run-enrich-batch')?.addEventListener('click', async () => {
      const mode = $('enr-mode-select')?.value || undefined;
      const res = await callBatchAction('/enrich-description', {
        action: 'enrich_batch',
        batch_id: _scopeBatch || null,
        mode,
        only_validated: Boolean($('enr-only-validated')?.checked),
      });
      if (!res.ok) return;
      S.toast(`Enriched ${res.json.enriched_count}/${res.json.total} (${res.json.needs_review_count} held for review)`, 'success');
      await loadPipelineProps();
      await refreshScopedSummaries();
    });

    // Pricing Dry Run & Apply
    async function runPricing(dryRun) {
      if (!_scopeBatch && !dryRun) {
        S.toast('Select a Scope Batch in the top bar before applying batch pricing', 'warning');
        return;
      }
      const method = $('prc-method').value;
      const cfg = { method };
      if (method === 'fixed') cfg.fixed_rent = Number($('prc-fixed-rent').value || 0);
      if (method === 'proportional_range') {
        cfg.source_min = Number($('prc-smin').value || 0);
        cfg.source_max = Number($('prc-smax').value || 0);
        cfg.target_min = Number($('prc-tmin').value || 0);
        cfg.target_max = Number($('prc-tmax').value || 0);
      }
      const res = await callBatchAction('/calculate-pricing', {
        action: 'calculate_batch',
        batch_id: _scopeBatch || null,
        pricing_config: cfg,
        dry_run: dryRun,
        force: Boolean($('prc-force')?.checked),
        only_validated: Boolean($('prc-only-validated')?.checked),
      });
      if (!res.ok) return;

      const box = $('prc-preview-box');
      box.style.display = 'block';
      box.innerHTML = `<div class="cc-diff-label"><span>${dryRun ? 'Dry-Run Preview' : 'Applied Calculation'} (${res.json.total} rows)</span><span>${res.json.calculated_count} calculated · ${res.json.held_out_of_range_count} out-of-range</span></div>` +
        `<pre class="cc-code-block">${S.esc(JSON.stringify(res.json.results || res.json, null, 2))}</pre>`;
      S.toast(dryRun ? 'Pricing dry-run complete' : `Applied pricing to Batch #${_scopeBatch}`, 'success');
      if (!dryRun) {
        await loadPipelineProps();
        await refreshScopedSummaries();
      }
    }

    $('btn-prc-dry-run')?.addEventListener('click', () => runPricing(true));
    $('pricing-run-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      runPricing(false);
    });

    // Registry Instant Lookup ("Give me batch 4821")
    $('registry-lookup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bId = ($('reg-lookup-input').value || '').replace(/^#/, '').trim();
      if (!bId) {
        S.toast('Enter a 4-digit or legacy PB-* Batch ID', 'warning');
        return;
      }
      const res = await S.callFn('/private-placement-registry', { action: 'get_batch', batch_id: bId }, { toastErrors: false });
      renderRegistryLookupResult(res.json?.batch_id ? res.json : { found: false, batch_id: bId });
      if (!res.ok && res.status !== 404) S.toast(res.json?.error || 'Lookup failed', 'error');
    });

    // Purge Expired Archive
    async function runPurge(dryRun) {
      if (!dryRun) {
        const ok = await S.confirm({
          title: 'Purge expired (>24h) recovery rows permanently?',
          message: 'This removes archived staging snapshots whose 24-hour recovery window has elapsed. Published properties and permanent registry entries remain untouched.',
          danger: true,
          ok: 'Execute Purge',
        });
        if (!ok) return;
      }
      const res = await S.callFn('/purge-expired-pipeline-recovery', { dry_run: dryRun });
      if (!res.ok) return;
      const box = $('purge-result-box');
      box.style.display = 'block';
      box.innerHTML = `<pre class="cc-code-block">${S.esc(JSON.stringify(res.json, null, 2))}</pre>`;
      S.toast(dryRun ? 'Purge dry-run complete' : 'Expired archive purge completed', 'success');
      if (!dryRun) {
        await loadRegistryAndRecovery();
        renderRecoveryPanel();
        renderTopKpis();
      }
    }
    $('btn-purge-dry')?.addEventListener('click', () => runPurge(true));
    $('btn-purge-live')?.addEventListener('click', () => runPurge(false));

    // Delegated table & row actions
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-cc]');
      if (!btn) return;
      const act = btn.dataset.cc;

      if (act === 'activate-version') {
        const ok = await S.confirm({
          title: `Activate policy ${btn.dataset.label}?`,
          message: 'This switches the default active policy for newly registered batches.',
          ok: 'Activate',
        });
        if (!ok) return;
        const res = await S.callFn('/rules-engine', {
          action: 'activate_version',
          policy_set_id: btn.dataset.id,
          reason: `Activated ${btn.dataset.label} from Control Center`,
        });
        if (!res.ok) return;
        S.toast(`Activated ${btn.dataset.label}`, 'success');
        await loadRulesModule();
        renderAllPanels();
      } else if (act === 'toggle-profile') {
        const nextEnabled = btn.dataset.enabled !== 'true';
        const res = await S.callFn('/rules-engine', {
          action: 'prohibited_profiles',
          sub_action: 'update',
          id: btn.dataset.id,
          enabled: nextEnabled,
        });
        if (!res.ok) return;
        S.toast('Updated prohibited profile status', 'success');
        await loadRulesModule();
        renderProhibitedProfiles();
      } else if (act === 'delete-profile') {
        const ok = await S.confirm({
          title: `Delete prohibited profile "${btn.dataset.name}"?`,
          message: 'Custom profile will be permanently removed from auto-rejection matching.',
          danger: true,
          ok: 'Delete',
        });
        if (!ok) return;
        const res = await S.callFn('/rules-engine', {
          action: 'prohibited_profiles',
          sub_action: 'delete',
          id: btn.dataset.id,
        });
        if (!res.ok) return;
        S.toast('Removed prohibited profile', 'success');
        await loadRulesModule();
        renderProhibitedProfiles();
      } else if (act === 'toggle-provider') {
        const nextEnabled = btn.dataset.enabled !== 'true';
        const res = await S.callFn('/rules-engine', {
          action: 'scraping_providers',
          sub_action: 'update_config',
          provider_key: btn.dataset.key,
          enabled: nextEnabled,
        });
        if (!res.ok) return;
        S.toast(`Updated provider ${btn.dataset.key}`, 'success');
        await loadRulesModule();
        renderScrapingProviders();
      } else if (act === 'focus-batch') {
        setBatchScope(btn.dataset.batch);
        S.toast(`Scoped Control Center to Batch #${btn.dataset.batch}`, 'info', 1800);
      } else if (act === 'validate-batch') {
        const res = await callBatchAction('/property-validator', { action: 'validate_batch', batch_id: btn.dataset.batch, check_photo_reachability: true });
        if (!res.ok) return;
        S.toast(`Batch #${btn.dataset.batch}: ${res.json.passed_count} passed, ${res.json.needs_review_count} review`, 'success');
        await loadPipelineProps();
        await refreshScopedSummaries();
      } else if (act === 'publish-batch') {
        const ok = await S.confirm({
          title: `Publish Batch #${btn.dataset.batch}?`,
          message: 'Validates eligible staged listings, isolates failures, mints one #share= link, and runs live verification.',
          ok: 'Publish & Verify',
        });
        if (!ok) return;
        const res = await callBatchAction('/publish-batch', { batch_id: btn.dataset.batch, verify: true });
        if (!res.ok) return;
        S.toast(`Batch #${btn.dataset.batch}: ${res.json.published_count} published, ${res.json.failed_count} failed`, 'success');
        await loadAll();
      } else if (act === 'poll-apify') {
        const res = await callBatchAction('/apify-scrape-worker', {
          action: 'poll_and_ingest',
          scrape_run_id: btn.dataset.scrapeId ? Number(btn.dataset.scrapeId) : undefined,
          provider_run_id: btn.dataset.run,
          batch_id: btn.dataset.batch || null,
        });
        if (!res.ok) return;
        if (res.json?.auto_handed_off) {
          S.toast(res.json.message || 'Auto-switched to next Apify key and continued run!', 'warning', 5000);
        } else {
          S.toast('Polled Apify run', 'success');
        }
        await loadBatchesAndJobs();
        await loadPipelineProps();
        renderAllPanels();
      } else if (act === 'probe-apify-key') {
        const res = await S.callFn('/apify-scrape-worker', { action: 'probe_keys', key_fingerprint: btn.dataset.fp });
        if (!res.ok) return;
        S.toast('Refreshed Apify key quota status', 'success');
        await loadBatchesAndJobs();
        renderBatchesPanel();
      } else if (act === 'reset-apify-key') {
        const res = await S.callFn('/apify-scrape-worker', { action: 'update_key', key_fingerprint: btn.dataset.fp, enabled: true, reset_status: true });
        if (!res.ok) return;
        S.toast('Key reset to active', 'success');
        await loadBatchesAndJobs();
        renderBatchesPanel();
      } else if (act === 'disable-apify-key') {
        const res = await S.callFn('/apify-scrape-worker', { action: 'update_key', key_fingerprint: btn.dataset.fp, enabled: false });
        if (!res.ok) return;
        S.toast('Key disabled in pool', 'info');
        await loadBatchesAndJobs();
        renderBatchesPanel();
      } else if (act === 'delete-apify-key') {
        const ok = await S.confirm({
          title: 'Remove Apify Key?',
          message: 'Deletes this key from the encrypted Admin pool. Active runs on other keys are unaffected.',
          ok: 'Remove Key',
          danger: true,
        });
        if (!ok) return;
        const res = await S.callFn('/apify-scrape-worker', { action: 'delete_key', key_fingerprint: btn.dataset.fp });
        if (!res.ok) return;
        S.toast('Removed Apify key', 'success');
        await loadBatchesAndJobs();
        renderBatchesPanel();
      } else if (act === 'pause-job') {
        const res = await S.callFn('/job-manager', { action: 'pause_job', batch_id: btn.dataset.batch, reason: 'Paused via Control Center', admin_override: true });
        if (!res.ok) return;
        S.toast(`Paused Batch #${btn.dataset.batch}`, 'info');
        await loadBatchesAndJobs();
        renderJobsPanel();
      } else if (act === 'resume-job') {
        const res = await S.callFn('/job-manager', { action: 'resume_job', batch_id: btn.dataset.batch, worker_id: btn.dataset.worker || 'admin-console' });
        if (!res.ok) return;
        S.toast(`Resumed Batch #${btn.dataset.batch}`, 'success');
        await loadBatchesAndJobs();
        renderJobsPanel();
      } else if (act === 'inspect-job') {
        const res = await S.callFn('/job-manager', { action: 'get_job', batch_id: btn.dataset.batch });
        if (!res.ok) return;
        S.openSheet({
          title: `Job Telemetry · Batch #${btn.dataset.batch}`,
          body: `<pre class="cc-code-block">${S.esc(JSON.stringify(res.json, null, 2))}</pre>`,
        });
      } else if (act === 'inspect-validation') {
        const p = state.pipelineProps.find((x) => String(x.id) === String(btn.dataset.id));
        if (!p) return;
        S.openSheet({
          title: `Validation Report · ${p.address || p.id}`,
          body: `<pre class="cc-code-block">${S.esc(JSON.stringify(p.validation_report || { status: p.validation_status, reason: p.review_reason }, null, 2))}</pre>`,
        });
      } else if (act === 'validate-one') {
        const res = await callBatchAction('/property-validator', { action: 'validate_property', pipeline_id: btn.dataset.id, check_photo_reachability: true });
        if (!res.ok) return;
        S.toast(`Validation: ${res.json.report.status}`, res.json.report.status === 'passed' ? 'success' : 'warning');
        await loadPipelineProps();
        await refreshScopedSummaries();
      } else if (act === 'resolve-val') {
        const decision = btn.dataset.decision;
        const ok = await S.confirm({
          title: `${decision === 'approve' ? 'Approve' : 'Reject'} listing validation?`,
          message: `Records explicit admin ${decision} decision in property validation audit.`,
          danger: decision === 'reject',
          ok: decision === 'approve' ? 'Approve' : 'Reject',
        });
        if (!ok) return;
        const res = await callBatchAction('/property-validator', {
          action: 'resolve_review',
          property_id: btn.dataset.id,
          decision,
          note: `Resolved via Admin Control Center (${decision})`,
        });
        if (!res.ok) return;
        S.toast(`Validation marked ${decision}`, 'success');
        await loadPipelineProps();
        await refreshScopedSummaries();
      } else if (act === 'enrich-one') {
        const mode = $('enr-mode-select')?.value || undefined;
        const res = await callBatchAction('/enrich-description', { action: 'enrich_property', pipeline_id: btn.dataset.id, mode });
        if (!res.ok) return;
        S.toast(`Enrichment: ${res.json.result?.status || 'done'}`, 'success');
        await loadPipelineProps();
        await refreshScopedSummaries();
      } else if (act === 'reg-inspect') {
        setTab('registry');
        $('reg-lookup-input').value = btn.dataset.batch;
        const res = await S.callFn('/private-placement-registry', { action: 'get_batch', batch_id: btn.dataset.batch });
        if (res.ok) renderRegistryLookupResult(res.json);
      } else if (act === 'copy-url') {
        await copyText(btn.dataset.url, btn);
      } else if (act === 'replace-link') {
        const bId = btn.dataset.batch;
        const isActive = btn.dataset.status === 'active';
        const form = await S.formSheet({
          title: `Replace Share Link · Batch #${bId}`,
          submit: 'Mint Replacement Link',
          danger: isActive,
          fields: [
            { name: 'reason', label: 'Explicit Reason (Audited)', required: true, placeholder: 'e.g. Client requested fresh 90-day private link' },
            { name: 'ttl_days', label: 'Expiration TTL (Days)', type: 'number', value: '90', required: true },
            { name: 'force', type: 'checkbox', checkLabel: 'Force rotation even if current link is still active', value: isActive },
          ],
        });
        if (!form) return;
        const res = await S.callFn('/private-placement-registry', {
          action: 'replace_expired_link',
          batch_id: bId,
          reason: form.reason,
          ttl_days: Number(form.ttl_days || 90),
          force: Boolean(form.force),
        });
        if (!res.ok) return;
        S.toast(`Minted replacement link for Batch #${bId}`, 'success');
        await loadRegistryAndRecovery();
        renderRegistryPanel();
        if (res.json?.registry) renderRegistryLookupResult(res.json.registry);
      } else if (act === 'cleanup-folder') {
        const bId = btn.dataset.batch;
        const ok = await S.confirm({
          title: `Cleanup disposable folder for Batch #${bId}?`,
          message: 'Archives verified-published rows for 24h recovery and deletes the disposable folder while preserving live properties and the permanent registry link.',
          ok: 'Cleanup Folder',
        });
        if (!ok) return;
        const res = await S.callFn('/job-manager', {
          action: 'cleanup_disposable_folder',
          batch_id: bId,
          admin_override: true,
        });
        if (!res.ok) return;
        S.toast(`Cleanup complete: ${res.json.archived_count ?? 0} archived, folder deleted: ${res.json.folder_deleted ? 'yes' : 'no'}`, 'success');
        await loadAll();
      } else if (act === 'restore-batch') {
        const bId = btn.dataset.batch;
        const form = await S.formSheet({
          title: `Restore Batch #${bId} to Pipeline Staging`,
          submit: 'Restore Batch',
          fields: [
            { name: 'reason', label: 'Restoration Reason', required: true, value: 'Administrator restoration from Control Center' },
          ],
        });
        if (!form) return;
        const res = await S.callFn('/pipeline-recovery', {
          action: 'restore_batch',
          batch_id: bId,
          reason: form.reason,
        });
        if (!res.ok) return;
        S.toast(`Restored Batch #${bId} (${res.json.restored_count ?? 0} rows)`, 'success');
        await loadAll();
      }
    });
  }

  function applyHashParams() {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return;
    const params = new URLSearchParams(raw);
    const t = params.get('tab');
    const b = params.get('batch');
    if (b) _scopeBatch = b.replace(/^#/, '').trim();
    if (t) setTab(t);
  }

  (window.CPShell && window.CPShell.ready ? window.CPShell.ready : Promise.resolve(window.AdminShell))
    .then(async (shell) => {
      S = shell || window.AdminShell;
      const okAuth = await S.requireAdmin();
      if (!okAuth) return;
      applyHashParams();
      wireEvents();
      await loadAll();
    })
    .catch((err) => {
      console.error('[control-center] init failed', err);
      if (S && S.toast) S.toast('Control Center initialization failed: ' + (err.message || err), 'error');
    });
})();
