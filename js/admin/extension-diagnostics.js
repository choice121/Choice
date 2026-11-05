import { sb } from '../cp-api.js';

const reportsEl = document.getElementById('diagnostics-reports');
const refreshBtn = document.getElementById('diagnostics-refresh');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

async function loadReports() {
  reportsEl.innerHTML = '<div class="diagnostics-state">Loading diagnostics…</div>';
  refreshBtn.disabled = true;
  try {
    const { data, error } = await sb().functions.invoke('extension-diagnostics', {
      body: { action: 'list' },
    });
    if (error) throw error;
    if (!data?.ok || !Array.isArray(data.reports)) {
      throw new Error(data?.error || 'Diagnostics could not be loaded');
    }
    if (!data.reports.length) {
      reportsEl.innerHTML = '<div class="diagnostics-state">No unexpired extension reports.</div>';
      return;
    }
    reportsEl.innerHTML = data.reports.map((report) => {
      const title = `${report.source} · ${report.status} · v${report.extension_version}`;
      const details = JSON.stringify(report.diagnostic, null, 2);
      return `<details class="diagnostic-report">
        <summary>${escapeHtml(title)}</summary>
        <div class="diagnostic-meta">
          <span>${escapeHtml(new Date(report.created_at).toLocaleString())}</span>
          <span>Report ${escapeHtml(report.id)}</span>
          <a href="${escapeHtml(report.source_url)}" target="_blank" rel="noopener noreferrer">Source listing</a>
        </div>
        <pre>${escapeHtml(details)}</pre>
      </details>`;
    }).join('');
  } catch (error) {
    console.error('[extension-diagnostics] Could not load reports', error);
    reportsEl.innerHTML = `<div class="diagnostics-state">Could not load reports: ${escapeHtml(error.message || error)}</div>`;
  } finally {
    refreshBtn.disabled = false;
  }
}

async function init() {
  if (!window.CP?.Auth?.requireAdmin) throw new Error('Admin authentication is not ready');
  const isAdmin = await window.CP.Auth.requireAdmin();
  if (!isAdmin) return;
  refreshBtn.addEventListener('click', loadReports);
  await loadReports();
}

init().catch((error) => {
  console.error('[extension-diagnostics] Admin page failed to initialize', error);
  reportsEl.innerHTML = `<div class="diagnostics-state">Could not initialize diagnostics: ${escapeHtml(error.message || error)}</div>`;
});
