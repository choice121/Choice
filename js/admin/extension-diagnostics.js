(function () {
  'use strict';

  const ENDPOINT = 'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/extension-diagnostics';

  function setStatus(message, isError) {
    const status = document.getElementById('diagnostics-status');
    status.textContent = message;
    status.classList.toggle('error', Boolean(isError));
  }

  function renderReports(reports) {
    const list = document.getElementById('diagnostic-list');
    list.replaceChildren();
    if (!reports.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No diagnostic reports have been submitted.';
      list.appendChild(empty);
      return;
    }

    reports.forEach((report) => {
      const card = document.createElement('article');
      card.className = 'diagnostic-card';
      const meta = document.createElement('div');
      meta.className = 'diagnostic-meta';

      const summary = document.createElement('strong');
      summary.textContent = `${report.source} · ${report.status} · v${report.extension_version}`;
      meta.appendChild(summary);

      const date = document.createElement('time');
      date.dateTime = report.created_at;
      date.textContent = new Date(report.created_at).toLocaleString();
      meta.appendChild(date);

      const listing = document.createElement('a');
      listing.href = report.source_url;
      listing.target = '_blank';
      listing.rel = 'noopener noreferrer';
      listing.textContent = report.report?.facts?.title || report.source_url;
      meta.appendChild(listing);

      const id = document.createElement('small');
      id.textContent = `Report ${report.id} · expires ${new Date(report.expires_at).toLocaleDateString()}`;
      meta.appendChild(id);
      card.appendChild(meta);

      const details = document.createElement('details');
      details.style.marginTop = '12px';
      const toggle = document.createElement('summary');
      toggle.textContent = 'View sanitized diagnostic report';
      details.appendChild(toggle);
      const pre = document.createElement('pre');
      pre.className = 'diagnostic-report';
      pre.textContent = JSON.stringify(report.report, null, 2);
      details.appendChild(pre);
      card.appendChild(details);
      list.appendChild(card);
    });
  }

  async function loadReports() {
    const config = window.CONFIG;
    if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      throw new Error('Supabase configuration is unavailable');
    }
    const session = await window.CP.Auth.getSession();
    if (!session?.access_token) {
      window.location.href = '/admin/login.html';
      return;
    }

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'list' }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Could not load reports (${response.status})`);
    }
    renderReports(Array.isArray(result.reports) ? result.reports : []);
    setStatus(`${result.reports.length} unexpired report${result.reports.length === 1 ? '' : 's'}.`, false);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!window.CP?.Auth || !await window.CP.Auth.requireAdmin('/admin/login.html')) return;
      await loadReports();
    } catch (error) {
      setStatus(error.message || 'Could not load diagnostic reports.', true);
    }

    document.getElementById('refresh-diagnostics').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      setStatus('Loading reports…', false);
      try {
        await loadReports();
      } catch (error) {
        setStatus(error.message || 'Could not load diagnostic reports.', true);
      } finally {
        button.disabled = false;
      }
    });
  });
})();
