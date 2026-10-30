(function () {
  'use strict';

  const propertyId = new URLSearchParams(location.search).get('id');
  let units = [];
  let dialog;
  let status;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function message(text, isError = false) {
    if (!status) return;
    status.textContent = text;
    status.dataset.error = isError ? 'true' : 'false';
  }

  async function invoke(body) {
    const { data, error } = await window.CP.sb().functions.invoke('property-units', { body });
    if (error) throw new Error(error.message || 'Unit request failed.');
    if (data?.error) throw new Error(data.detail || data.error);
    return data;
  }

  function unitPayload(root) {
    const read = (field) => root.querySelector(`[data-unit-field="${field}"]`);
    const number = (field) => {
      const value = read(field)?.value.trim() || '';
      return value ? Number(value) : null;
    };
    return {
      unit_number: read('unit_number')?.value.trim() || null,
      bedrooms: number('bedrooms'),
      bathrooms: number('bathrooms'),
      square_footage: number('square_footage'),
      monthly_rent: number('monthly_rent'),
      floor_plan_name: read('floor_plan_name')?.value.trim() || null,
      floor_plan_image_url: read('floor_plan_image_url')?.value.trim() || null,
      unit_photos: (read('unit_photos')?.value || '').split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
      amenities: (read('amenities')?.value || '').split(',').map((item) => item.trim()).filter(Boolean),
    };
  }

  function renderFormFields(unit = {}) {
    const photos = Array.isArray(unit.unit_photos) ? unit.unit_photos : [];
    const amenities = Array.isArray(unit.amenities) ? unit.amenities : [];
    return `
      <div class="pu-fields">
        <label>Unit number <span class="pu-hint">If provided by source</span><input data-unit-field="unit_number" maxlength="40" value="${escapeHtml(unit.unit_number || '')}"></label>
        <label>Bedrooms<input data-unit-field="bedrooms" type="number" min="0" max="20" step="0.5" value="${escapeHtml(unit.bedrooms ?? '')}"></label>
        <label>Bathrooms<input data-unit-field="bathrooms" type="number" min="0" max="20" step="0.5" value="${escapeHtml(unit.bathrooms ?? '')}"></label>
        <label>Square feet<input data-unit-field="square_footage" type="number" min="1" max="100000" step="1" value="${escapeHtml(unit.square_footage ?? '')}"></label>
        <label>Monthly rent<input data-unit-field="monthly_rent" type="number" min="1" max="100000" step="1" required value="${escapeHtml(unit.monthly_rent ?? '')}"></label>
        <label>Layout label<input data-unit-field="floor_plan_name" maxlength="120" placeholder="Studio layout" value="${escapeHtml(unit.floor_plan_name || '')}"></label>
        <label class="pu-wide">Floor-plan image URL<input data-unit-field="floor_plan_image_url" type="url" placeholder="https://..." value="${escapeHtml(unit.floor_plan_image_url || '')}"></label>
        <label class="pu-wide">Unit photo URLs <span class="pu-hint">One HTTPS URL per line</span><textarea data-unit-field="unit_photos" rows="3">${escapeHtml(photos.join('\n'))}</textarea></label>
        <label class="pu-wide">Amenities <span class="pu-hint">Comma-separated</span><textarea data-unit-field="amenities" rows="2">${escapeHtml(amenities.join(', '))}</textarea></label>
      </div>`;
  }

  function renderList() {
    const list = dialog.querySelector('#pu-list');
    if (!units.length) {
      list.innerHTML = '<p class="pu-empty">No unit layouts have been added.</p>';
      return;
    }
    list.innerHTML = units.map((unit) => `
      <details class="pu-row" data-unit-id="${escapeHtml(unit.id)}">
        <summary><strong>${escapeHtml(unit.unit_number ? `Unit ${unit.unit_number}` : unit.floor_plan_name || 'Unit layout')}</strong><span>${escapeHtml(unit.bedrooms ?? '—')} bd · ${escapeHtml(unit.bathrooms ?? '—')} ba · $${Number(unit.monthly_rent).toLocaleString()}/mo</span></summary>
        <div class="pu-row-body">
          ${renderFormFields(unit)}
          <div class="pu-row-actions">
            <button type="button" class="btn btn-primary btn-sm" data-action="save">Save unit</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete">Delete unit</button>
          </div>
        </div>
      </details>`).join('');
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'pu-dialog';
    dialog.innerHTML = `
      <style>
        .pu-dialog{width:min(900px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);box-shadow:0 24px 70px #0005}
        .pu-dialog::backdrop{background:#07101dbb;backdrop-filter:blur(3px)}
        .pu-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;background:var(--surface);border-bottom:1px solid var(--border)}
        .pu-head h2{margin:0;font-size:1rem}
        .pu-close{width:36px;height:36px;border:0;border-radius:6px;background:var(--surface-2);color:var(--text);font-size:1.2rem;cursor:pointer}
        .pu-body{padding:16px 18px;overflow:auto;max-height:calc(100dvh - 90px)}
        .pu-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .pu-fields label{display:flex;flex-direction:column;gap:4px;font-size:.72rem;font-weight:700}
        .pu-fields input,.pu-fields textarea{min-width:0;width:100%;padding:8px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2);color:var(--text);font:inherit}
        .pu-wide{grid-column:1/-1}
        .pu-hint{font-size:.65rem;font-weight:400;color:var(--muted)}
        .pu-add{padding:14px;margin-bottom:16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2)}
        .pu-add h3{margin:0 0 12px;font-size:.84rem}
        .pu-row{border:1px solid var(--border);border-radius:6px;margin-top:8px;overflow:hidden}
        .pu-row summary{display:flex;justify-content:space-between;gap:12px;padding:12px;cursor:pointer;font-size:.78rem}
        .pu-row summary span{color:var(--muted);text-align:right}
        .pu-row-body{padding:12px;border-top:1px solid var(--border)}
        .pu-row-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
        .pu-list{display:grid;gap:8px}
        .pu-status{min-height:1.4em;margin:8px 0;color:var(--muted);font-size:.78rem}
        .pu-status[data-error="true"]{color:#dc2626}
        .pu-empty{font-size:.8rem;color:var(--muted)}
        @media(max-width:640px){.pu-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.pu-row summary{flex-direction:column}.pu-row summary span{text-align:left}}
        @media(max-width:420px){.pu-fields{grid-template-columns:1fr}.pu-wide{grid-column:auto}}
      </style>
      <div class="pu-head"><h2>Unit layouts</h2><button class="pu-close" type="button" aria-label="Close">&times;</button></div>
      <div class="pu-body">
        <form class="pu-add" id="pu-add-form">
          <h3>Add unit layout</h3>
          ${renderFormFields()}
          <div class="pu-row-actions"><button class="btn btn-primary btn-sm" type="submit">Add unit</button></div>
        </form>
        <p class="pu-status" id="pu-status" role="status" aria-live="polite"></p>
        <div class="pu-list" id="pu-list"></div>
      </div>`;
    document.body.appendChild(dialog);
    status = dialog.querySelector('#pu-status');
    dialog.querySelector('.pu-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.querySelector('#pu-add-form').addEventListener('submit', createUnit);
    dialog.querySelector('#pu-list').addEventListener('click', handleUnitAction);
    return dialog;
  }

  async function refresh() {
    message('Loading unit layouts...');
    const result = await invoke({ action: 'list', property_id: propertyId });
    units = Array.isArray(result.units) ? result.units : [];
    renderList();
    message('Unit layouts saved to this property.');
  }

  async function createUnit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    message('Saving unit...');
    try {
      await invoke({ action: 'create', property_id: propertyId, ...unitPayload(form) });
      form.reset();
      await refresh();
    } catch (error) {
      message(error.message || 'Could not add unit.', true);
    } finally { button.disabled = false; }
  }

  async function handleUnitAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('[data-unit-id]');
    const unit = units.find((item) => item.id === row?.dataset.unitId);
    if (!row || !unit) return;
    const action = button.dataset.action;
    button.disabled = true;
    try {
      if (action === 'save') {
        await invoke({ action: 'update', property_id: propertyId, unit_id: unit.id, ...unitPayload(row) });
        await refresh();
      } else if (action === 'delete') {
        const confirmed = await window.AdminShell.confirm({ title: 'Delete this unit layout?', message: `Unit ${unit.unit_number} will be removed from this property.`, ok: 'Delete', cancel: 'Cancel', danger: true });
        if (!confirmed) return;
        await invoke({ action: 'delete', property_id: propertyId, unit_id: unit.id });
        await refresh();
      }
    } catch (error) {
      message(error.message || 'Could not save unit.', true);
    } finally { button.disabled = false; }
  }

  document.addEventListener('click', async (event) => {
    if (!event.target.closest('#pd-btn-units') || !propertyId) return;
    ensureDialog().showModal();
    try { await refresh(); }
    catch (error) { message(error.message || 'Could not load unit layouts.', true); }
  });
})();
