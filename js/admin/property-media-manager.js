(function () {
  'use strict';

  const propertyId = new URLSearchParams(location.search).get('id');
  let media = [];
  let buildings = [];
  let floors = [];
  let units = [];
  let dialog;
  let status;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function scopeType(item = {}) {
    if (item.unit_id) return 'unit';
    if (item.floor_id) return 'floor';
    if (item.building_id) return 'building';
    return 'none';
  }

  function scopeOptions(type, selectedId = '') {
    const options = type === 'building'
      ? buildings.map((item) => [item.id, item.name])
      : type === 'floor'
        ? floors.map((item) => [item.id, `${buildings.find((building) => building.id === item.building_id)?.name || 'Building'} · ${item.floor_label}`])
        : type === 'unit'
          ? units.map((item) => [item.id, item.unit_number ? `Unit ${item.unit_number}` : item.floor_plan_name || 'Unit layout'])
          : [];
    return options.map(([id, label]) => `<option value="${escapeHtml(id)}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  }

  function scopeSelector(item = {}) {
    const type = scopeType(item);
    const selectedId = item.unit_id || item.floor_id || item.building_id || '';
    return `<label>Property section<select data-field="scope_type">
      <option value="none" ${type === 'none' ? 'selected' : ''}>General property</option>
      <option value="building" ${type === 'building' ? 'selected' : ''}>Building</option>
      <option value="floor" ${type === 'floor' ? 'selected' : ''}>Floor</option>
      <option value="unit" ${type === 'unit' ? 'selected' : ''}>Unit</option>
    </select></label>
    <label>Assigned to<select data-field="scope_id" ${type === 'none' ? 'disabled' : ''}>
      <option value="">Choose section</option>${scopeOptions(type, selectedId)}
    </select></label>`;
  }

  function scopePayload(root) {
    return {
      scope_type: root.querySelector('[data-field="scope_type"]')?.value || 'none',
      scope_id: root.querySelector('[data-field="scope_id"]')?.value || null,
    };
  }

  function message(text, isError = false) {
    if (!status) return;
    status.textContent = text;
    status.dataset.error = isError ? 'true' : 'false';
  }

  async function invoke(body) {
    const { data, error } = await window.CP.sb().functions.invoke('property-media', { body });
    if (error) throw new Error(error.message || 'Media request failed.');
    if (data?.error) throw new Error(data.detail || data.error);
    return data;
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'pd-media-dialog';
    dialog.innerHTML = `
      <style>
        .pd-media-dialog{width:min(920px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);box-shadow:0 24px 70px #0005}
        .pd-media-dialog::backdrop{background:#07101dbb;backdrop-filter:blur(3px)}
        .pd-media-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;background:var(--surface);border-bottom:1px solid var(--border)}
        .pd-media-head h2{margin:0;font-size:1rem}
        .pd-media-close{width:36px;height:36px;border:0;border-radius:6px;background:var(--surface-2);color:var(--text);font-size:1.2rem;cursor:pointer}
        .pd-media-body{padding:16px 18px;overflow:auto;max-height:calc(100dvh - 92px)}
        .pd-media-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px;margin-bottom:16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2)}
        .pd-media-form label,.pd-media-row label{display:flex;flex-direction:column;gap:4px;font-size:.72rem;font-weight:700}
        .pd-media-form input,.pd-media-form select,.pd-media-row input,.pd-media-row select{min-width:0;width:100%;padding:8px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font:inherit}
        .pd-media-wide{grid-column:1/-1}
        .pd-media-note{grid-column:1/-1;margin:0;color:var(--muted);font-size:.72rem}
        .pd-media-list{display:grid;gap:10px}
        .pd-media-row{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:12px;padding:12px;border:1px solid var(--border);border-radius:6px;align-items:start}
        .pd-media-thumb{width:92px;aspect-ratio:4/3;object-fit:cover;background:var(--surface-2);border-radius:4px}
        .pd-media-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .pd-media-actions{display:flex;flex-direction:column;gap:6px}
        .pd-media-actions button{min-width:36px;min-height:34px}
        .pd-media-kind{font-size:.65rem;color:var(--muted);text-transform:uppercase}
        .pd-media-status{min-height:1.4em;margin:8px 0;color:var(--muted);font-size:.78rem}
        .pd-media-status[data-error="true"]{color:#dc2626}
        @media(max-width:600px){.pd-media-form{grid-template-columns:1fr}.pd-media-wide{grid-column:auto}.pd-media-row{grid-template-columns:64px minmax(0,1fr)}.pd-media-thumb{width:64px}.pd-media-actions{grid-column:1/-1;flex-direction:row}.pd-media-fields{grid-template-columns:1fr}}
      </style>
      <div class="pd-media-head"><h2>Floor plans, videos and tours</h2><button class="pd-media-close" type="button" aria-label="Close">&times;</button></div>
      <div class="pd-media-body">
        <form class="pd-media-form" id="pd-media-create">
          <label>Media type<select name="kind"><option value="floor_plan">Floor plan</option><option value="video">Video walkthrough</option><option value="virtual_tour">Virtual tour</option><option value="tour_3d">3D tour</option></select></label>
          <label>Title<input name="title" maxlength="120" required placeholder="Main level floor plan"></label>
          <label>Level / floor<input name="floor_label" maxlength="60" placeholder="Main level, 2nd floor"></label>
          <label>Provider<input name="provider" maxlength="60" placeholder="Matterport, YouTube"></label>
          ${scopeSelector()}
          <label class="pd-media-wide">Secure URL<input name="url" type="url" placeholder="https://..."></label>
          <label class="pd-media-wide">Video poster image URL<input name="poster_url" type="url" placeholder="https://..."></label>
          <label class="pd-media-wide">Or upload a floor-plan image<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
          <p class="pd-media-note">Floor plans can be uploaded as images. Videos and tours use a secure hosted URL. Only active listings are visible publicly.</p>
          <button class="btn btn-primary pd-media-wide" type="submit">Add media</button>
        </form>
        <p class="pd-media-status" id="pd-media-status" role="status" aria-live="polite"></p>
        <div class="pd-media-list" id="pd-media-list"></div>
      </div>`;
    document.body.appendChild(dialog);
    status = dialog.querySelector('#pd-media-status');
    dialog.querySelector('.pd-media-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelector('#pd-media-create').addEventListener('submit', addMedia);
    dialog.querySelector('#pd-media-list').addEventListener('click', handleListClick);
    dialog.addEventListener('change', (event) => {
      const typeSelect = event.target.closest('[data-field="scope_type"]');
      if (!typeSelect) return;
      const root = typeSelect.closest('form, [data-id]');
      const idSelect = root.querySelector('[data-field="scope_id"]');
      idSelect.innerHTML = `<option value="">Choose section</option>${scopeOptions(typeSelect.value)}`;
      idSelect.disabled = typeSelect.value === 'none';
    });
    return dialog;
  }

  function renderList() {
    const list = dialog.querySelector('#pd-media-list');
    if (!media.length) {
      list.innerHTML = '<p class="pd-media-note">No floor plans or tours added yet.</p>';
      return;
    }
    list.innerHTML = media.map((item, index) => `
      <article class="pd-media-row" data-id="${escapeHtml(item.id)}">
        ${item.kind === 'floor_plan' ? `<img class="pd-media-thumb" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}" loading="lazy">` : '<div class="pd-media-thumb" aria-hidden="true"></div>'}
        <div>
          <div class="pd-media-kind">${escapeHtml(item.kind.replace('_', ' '))}${item.floor_label ? ` / ${escapeHtml(item.floor_label)}` : ''}</div>
          <div class="pd-media-fields">
            <label>Title<input data-field="title" maxlength="120" value="${escapeHtml(item.title)}"></label>
            <label>Level / floor<input data-field="floor_label" maxlength="60" value="${escapeHtml(item.floor_label || '')}"></label>
            <label>Provider<input data-field="provider" maxlength="60" value="${escapeHtml(item.provider || '')}"></label>
            <label>URL<input data-field="url" type="url" value="${escapeHtml(item.url)}" ${item.file_id ? 'readonly aria-label="Uploaded file URL; delete and re-add to replace"' : ''}></label>
            <label>Poster image URL<input data-field="poster_url" type="url" value="${escapeHtml(item.poster_url || '')}"></label>
            ${scopeSelector(item)}
          </div>
        </div>
        <div class="pd-media-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-action="up" aria-label="Move up" title="Move up" ${index === 0 ? 'disabled' : ''}>Up</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="down" aria-label="Move down" title="Move down" ${index === media.length - 1 ? 'disabled' : ''}>Down</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="save">Save</button>
          <button class="btn btn-danger btn-sm" type="button" data-action="delete">Delete</button>
        </div>
      </article>`).join('');
  }

  async function refresh() {
    message('Loading media...');
    const result = await invoke({ action: 'list', property_id: propertyId });
    const [hierarchyResult, unitResult] = await Promise.all([
      window.CP.sb().functions.invoke('property-hierarchy', { body: { action: 'list', property_id: propertyId } }),
      window.CP.sb().functions.invoke('property-units', { body: { action: 'list', property_id: propertyId } }),
    ]);
    if (hierarchyResult.error) throw new Error(hierarchyResult.error.message || 'Could not load building and floor data.');
    if (hierarchyResult.data?.error) throw new Error(hierarchyResult.data.detail || hierarchyResult.data.error);
    if (unitResult.error) throw new Error(unitResult.error.message || 'Could not load unit data.');
    if (unitResult.data?.error) throw new Error(unitResult.data.detail || unitResult.data.error);
    buildings = Array.isArray(hierarchyResult.data?.buildings) ? hierarchyResult.data.buildings : [];
    floors = Array.isArray(hierarchyResult.data?.floors) ? hierarchyResult.data.floors : [];
    units = Array.isArray(unitResult.data?.units) ? unitResult.data.units : [];
    media = Array.isArray(result.media) ? result.media : [];
    renderList();
    message('Changes save to this property.');
  }

  async function addMedia(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const values = new FormData(form);
    const kind = String(values.get('kind') || '');
    const file = values.get('file');
    let url = String(values.get('url') || '').trim();
    let fileId = null;
    submit.disabled = true;
    try {
      if (file instanceof File && file.size > 0) {
        if (kind !== 'floor_plan' || !file.type.startsWith('image/')) throw new Error('Upload an image for a floor plan, or enter a hosted URL.');
        message('Uploading floor plan...');
        const { uploadToImageKit } = await import('/js/imagekit.js');
        const uploaded = await uploadToImageKit(file, { folder: `/properties/${propertyId}/media` });
        url = uploaded.url;
        fileId = uploaded.fileId;
      }
      if (!url) throw new Error('Enter a secure URL or select a floor-plan image.');
      message('Saving media...');
      try {
        await invoke({
          action: 'create', property_id: propertyId, kind,
          title: values.get('title'), floor_label: values.get('floor_label'),
          provider: values.get('provider'), url, file_id: fileId, poster_url: values.get('poster_url'),
          ...scopePayload(form),
          display_order: media.length,
        });
      } catch (error) {
        if (fileId) {
          const session = await window.CP.Auth.getSession();
          const { deleteFromImageKit } = await import('/js/imagekit.js');
          const cleaned = await deleteFromImageKit(fileId, { supabaseUrl: CONFIG.SUPABASE_URL, anonKey: CONFIG.SUPABASE_ANON_KEY, userToken: session?.access_token });
          if (!cleaned) throw new Error(`${error.message || 'Could not save media.'} The uploaded file could not be removed from storage.`);
        }
        throw error;
      }
      form.reset();
      await refresh();
    } catch (error) {
      message(error.message || 'Could not add media.', true);
    } finally {
      submit.disabled = false;
    }
  }

  async function handleListClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('[data-id]');
    const index = media.findIndex((item) => item.id === row?.dataset.id);
    if (index < 0) return;
    const action = button.dataset.action;
    try {
      button.disabled = true;
      if (action === 'save') {
        const values = Object.fromEntries([...row.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value.trim()]));
        await invoke({ action: 'update', property_id: propertyId, id: media[index].id, ...values });
        await refresh();
      } else if (action === 'delete') {
        const confirmed = await window.AdminShell.confirm({ title: 'Delete this media item?', message: 'This removes it from the listing. Uploaded floor-plan images will also be removed from storage.', ok: 'Delete', cancel: 'Cancel', danger: true });
        if (!confirmed) return;
        const deleted = await invoke({ action: 'delete', property_id: propertyId, id: media[index].id });
        if (deleted.file_id) {
          const session = await window.CP.Auth.getSession();
          const { deleteFromImageKit } = await import('/js/imagekit.js');
          const cleaned = await deleteFromImageKit(deleted.file_id, { supabaseUrl: CONFIG.SUPABASE_URL, anonKey: CONFIG.SUPABASE_ANON_KEY, userToken: session?.access_token });
          if (!cleaned) {
            await refresh();
            message('Removed from the listing, but the uploaded file could not be removed from storage.', true);
            return;
          }
        }
        await refresh();
      } else if (action === 'up' || action === 'down') {
        const nextIndex = index + (action === 'up' ? -1 : 1);
        [media[index], media[nextIndex]] = [media[nextIndex], media[index]];
        await invoke({ action: 'reorder', property_id: propertyId, ids: media.map((item) => item.id) });
        await refresh();
      }
    } catch (error) {
      message(error.message || 'Could not save media changes.', true);
      try { await refresh(); } catch (_) {}
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener('click', async (event) => {
    if (!event.target.closest('#pd-btn-media')) return;
    if (!propertyId) return;
    ensureDialog().showModal();
    try { await refresh(); }
    catch (error) { message(error.message || 'Could not load media.', true); }
  });
})();