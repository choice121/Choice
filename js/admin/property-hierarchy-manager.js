(function () {
  'use strict';

  const propertyId = new URLSearchParams(location.search).get('id');
  let buildings = [];
  let floors = [];
  let dialog;
  let status;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function message(text, isError = false) {
    status.textContent = text;
    status.dataset.error = isError ? 'true' : 'false';
  }

  async function invoke(body) {
    const { data, error } = await window.CP.sb().functions.invoke('property-hierarchy', { body });
    if (error) throw new Error(error.message || 'Hierarchy request failed.');
    if (data?.error) {
      const messages = {
        building_in_use: 'Remove its floors, units, and media before deleting this building.',
        floor_in_use: 'Move its assigned units and media before deleting this floor.',
        hierarchy_code_exists: 'That code is already used for this property.',
      };
      throw new Error(messages[data.error] || data.detail || data.error);
    }
    return data;
  }

  function render() {
    const list = dialog.querySelector('#ph-list');
    if (!buildings.length) {
      list.innerHTML = '<p class="ph-empty">No buildings have been added.</p>';
      return;
    }
    list.innerHTML = buildings.map((building) => {
      const buildingFloors = floors.filter((floor) => floor.building_id === building.id);
      return `<section class="ph-building" data-building-id="${escapeHtml(building.id)}">
        <form class="ph-building-form" data-action="save-building">
          <label>Building name<input name="name" maxlength="100" required value="${escapeHtml(building.name)}"></label>
          <label>Code<input name="building_code" maxlength="40" value="${escapeHtml(building.building_code || '')}"></label>
          <label>Order<input name="sort_order" type="number" min="0" max="10000" value="${escapeHtml(building.sort_order ?? 0)}"></label>
          <button class="btn btn-primary btn-sm" type="submit">Save</button>
          <button class="btn btn-danger btn-sm" type="button" data-action="delete-building">Delete</button>
        </form>
        <div class="ph-floors">
          ${buildingFloors.map((floor) => `<form class="ph-floor" data-floor-id="${escapeHtml(floor.id)}" data-action="save-floor">
            <label>Floor<input name="floor_label" maxlength="100" required value="${escapeHtml(floor.floor_label)}"></label>
            <label>Code<input name="floor_code" maxlength="40" value="${escapeHtml(floor.floor_code || '')}"></label>
            <label>Order<input name="sort_order" type="number" min="0" max="10000" value="${escapeHtml(floor.sort_order ?? 0)}"></label>
            <button class="btn btn-ghost btn-sm" type="submit">Save</button>
            <button class="btn btn-danger btn-sm" type="button" data-action="delete-floor">Delete</button>
          </form>`).join('')}
          <form class="ph-floor-create" data-action="create-floor">
            <input type="hidden" name="building_id" value="${escapeHtml(building.id)}">
            <label>New floor<input name="floor_label" maxlength="100" required placeholder="Ground floor"></label>
            <label>Code<input name="floor_code" maxlength="40" placeholder="G"></label>
            <label>Order<input name="sort_order" type="number" min="0" max="10000" value="${buildingFloors.length}"></label>
            <button class="btn btn-ghost btn-sm" type="submit">Add floor</button>
          </form>
        </div>
      </section>`;
    }).join('');
  }

  async function refresh() {
    message('Loading building and floor data...');
    const result = await invoke({ action: 'list', property_id: propertyId });
    buildings = Array.isArray(result.buildings) ? result.buildings : [];
    floors = Array.isArray(result.floors) ? result.floors : [];
    render();
    message('Building and floor changes are saved to this property.');
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'ph-dialog';
    dialog.innerHTML = `
      <style>
        .ph-dialog{width:min(900px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);box-shadow:0 24px 70px #0005}
        .ph-dialog::backdrop{background:#07101dbb;backdrop-filter:blur(3px)}
        .ph-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--surface);border-bottom:1px solid var(--border)}
        .ph-head h2{margin:0;font-size:1rem}.ph-close{width:36px;height:36px;border:0;border-radius:6px;background:var(--surface-2);color:var(--text);font-size:1.2rem;cursor:pointer}
        .ph-body{padding:16px 18px;overflow:auto;max-height:calc(100dvh - 90px)}
        .ph-create,.ph-building-form,.ph-floor,.ph-floor-create{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:end}
        .ph-create{padding:14px;margin-bottom:14px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2)}
        .ph-building{padding:12px;border:1px solid var(--border);border-radius:6px;margin-top:10px}
        .ph-floors{display:grid;gap:8px;padding:12px 0 0 14px}
        .ph-floor,.ph-floor-create{padding:8px;border-top:1px solid var(--border)}
        .ph-dialog label{display:flex;flex-direction:column;gap:4px;font-size:.72rem;font-weight:700}
        .ph-dialog input{min-width:0;width:100%;padding:8px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2);color:var(--text);font:inherit}
        .ph-status{min-height:1.4em;color:var(--muted);font-size:.78rem}.ph-status[data-error="true"]{color:#dc2626}.ph-empty{color:var(--muted);font-size:.8rem}
        @media(max-width:620px){.ph-create,.ph-building-form,.ph-floor,.ph-floor-create{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style>
      <div class="ph-head"><h2>Buildings and floors</h2><button class="ph-close" type="button" aria-label="Close">&times;</button></div>
      <div class="ph-body">
        <form class="ph-create" data-action="create-building">
          <label>Building name<input name="name" maxlength="100" required placeholder="Building A"></label>
          <label>Code<input name="building_code" maxlength="40" placeholder="A"></label>
          <label>Order<input name="sort_order" type="number" min="0" max="10000" value="0"></label>
          <button class="btn btn-primary btn-sm" type="submit">Add building</button>
        </form>
        <p class="ph-status" role="status" aria-live="polite"></p>
        <div id="ph-list"></div>
      </div>`;
    document.body.appendChild(dialog);
    status = dialog.querySelector('.ph-status');
    dialog.querySelector('.ph-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
      const button = event.target.closest('button[data-action]');
      if (button) handleDelete(button);
    });
    dialog.addEventListener('submit', handleSubmit);
    return dialog;
  }

  async function handleSubmit(event) {
    const form = event.target.closest('form[data-action]');
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const action = form.dataset.action;
    const building = form.closest('[data-building-id]');
    const floor = form.closest('[data-floor-id]');
    const body = { action, property_id: propertyId, ...values };
    if (action === 'save-building') body.id = building.dataset.buildingId;
    if (action === 'save-floor') {
      body.id = floor.dataset.floorId;
      body.building_id = building.dataset.buildingId;
    }
    try {
      message('Saving hierarchy...');
      await invoke(body);
      await refresh();
    } catch (error) {
      message(error.message || 'Could not save hierarchy.', true);
    }
  }

  async function handleDelete(button) {
    const building = button.closest('[data-building-id]');
    const floor = button.closest('[data-floor-id]');
    const isBuilding = button.dataset.action === 'delete-building';
    const item = isBuilding
      ? buildings.find((entry) => entry.id === building?.dataset.buildingId)
      : floors.find((entry) => entry.id === floor?.dataset.floorId);
    if (!item) return;
    const confirmed = await window.AdminShell.confirm({
      title: `Delete ${isBuilding ? 'this building' : 'this floor'}?`,
      message: 'Assigned floors, units, or media must be moved or removed first.',
      ok: 'Delete', cancel: 'Cancel', danger: true,
    });
    if (!confirmed) return;
    try {
      const action = isBuilding ? 'delete_building' : 'delete_floor';
      await invoke({ action, property_id: propertyId, id: item.id });
      await refresh();
    } catch (error) {
      message(error.message || 'Could not delete hierarchy item.', true);
    }
  }

  document.addEventListener('click', async (event) => {
    if (!event.target.closest('#pd-btn-hierarchy') || !propertyId) return;
    ensureDialog().showModal();
    try { await refresh(); }
    catch (error) { message(error.message || 'Could not load hierarchy.', true); }
  });
})();
