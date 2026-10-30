function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function stripHtml(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '');
}

function safeImageUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch (_) {
    return '';
  }
}

function unitPhotoUrls(value) {
  let photos = value;
  if (typeof photos === 'string') {
    try { photos = JSON.parse(photos); } catch (_) { photos = []; }
  }
  if (!Array.isArray(photos)) return [];
  return photos
    .map(photo => safeImageUrl(typeof photo === 'string' ? photo : photo?.url))
    .filter(Boolean)
    .slice(0, 8);
}

function allowedAmenities(value) {
  if (!Array.isArray(value)) return [];
  const prohibited = /\b(?:pets?|smoking|lease|deposit|move[\s-]?in|available\s+(?:from|date)|application\s+requirements|credit\s+score|income\s+requirement|eviction|criminal\s+history|cash\s*app|zelle|paypal|venmo|apple\s*pay|wire\s+transfer|money\s+order|scam|fraud)\b/i;
  return value
    .map(stripHtml)
    .map(item => item.trim())
    .filter(item => item && !prohibited.test(item))
    .slice(0, 10);
}

function numericValues(units, field) {
  return [...new Set(units
    .map(unit => unit?.[field] == null || unit[field] === '' ? NaN : Number(unit[field]))
    .filter(value => Number.isFinite(value) && value >= 0))]
    .sort((a, b) => a - b);
}

function numberRange(values) {
  if (!values.length) return '';
  const format = value => Number(value).toLocaleString();
  return values.length === 1 ? format(values[0]) : `${format(values[0])}–${format(values[values.length - 1])}`;
}

export function summarizePropertyUnits(units) {
  const safeUnits = Array.isArray(units) ? units.filter(unit => unit && typeof unit === 'object') : [];
  const rents = numericValues(safeUnits, 'monthly_rent').filter(value => value > 0);
  const bedrooms = numericValues(safeUnits, 'bedrooms');
  const bathrooms = numericValues(safeUnits, 'bathrooms');
  const squareFootage = numericValues(safeUnits, 'square_footage').filter(value => value > 0);
  const planCount = safeUnits.filter(unit =>
    typeof unit.floor_plan_name === 'string' &&
    unit.floor_plan_name.trim() &&
    !(typeof unit.unit_number === 'string' && unit.unit_number.trim())
  ).length;

  function specRange(values, singular, plural) {
    if (!values.length) return '';
    const label = value => value === 0 && singular === 'bed'
      ? 'Studio'
      : `${value} ${value === 1 ? singular : plural}`;
    if (values.length === 1) return label(values[0]);
    if (values[0] === 0 && singular === 'bed') {
      return values.length === 2
        ? `Studio, ${label(values[1])}`
        : `Studio–${values[values.length - 1]} ${plural}`;
    }
    return `${values[0]}–${values[values.length - 1]} ${plural}`;
  }

  const isCommunity = planCount > 0;
  const minRent = rents.length ? rents[0] : null;
  const maxRent = rents.length ? rents[rents.length - 1] : null;

  return {
    isCommunity,
    count: planCount || safeUnits.length,
    minRent,
    maxRent,
    bedrooms: specRange(bedrooms, 'bed', 'beds'),
    bathrooms: specRange(bathrooms, 'bath', 'baths'),
    squareFootage: squareFootage.length ? `${numberRange(squareFootage)} sqft` : '',
  };
}

function renderUnit(unit, index) {
  const unitNumber = typeof unit.unit_number === 'string' ? unit.unit_number.trim() : '';
  const bedrooms = unit.bedrooms == null ? null : Number(unit.bedrooms);
  const bathrooms = unit.bathrooms == null ? null : Number(unit.bathrooms);
  const squareFootage = unit.square_footage == null ? null : Number(unit.square_footage);
  const rent = unit.monthly_rent == null ? null : Number(unit.monthly_rent);
  const isPlan = !unitNumber && typeof unit.floor_plan_name === 'string' && unit.floor_plan_name.trim();
  const layoutLabel = unit.floor_plan_name || (unitNumber
    ? `Unit ${unitNumber}`
    : Number.isFinite(bedrooms)
      ? bedrooms === 0 ? 'Studio layout' : `${bedrooms} bedroom layout`
      : Number.isFinite(squareFootage) ? `${squareFootage.toLocaleString()} sqft layout` : 'Unit layout');
  const planUrl = safeImageUrl(unit.floor_plan_image_url);
  const photos = unitPhotoUrls(unit.unit_photos);
  const amenities = allowedAmenities(unit.amenities);
  const specs = [];
  if (bedrooms != null && Number.isFinite(bedrooms)) {
    specs.push(`<span><i class="fas fa-bed" aria-hidden="true"></i>${bedrooms === 0 ? 'Studio' : `${escapeHtml(bedrooms)} ${bedrooms === 1 ? 'bed' : 'beds'}`}</span>`);
  }
  if (bathrooms != null && Number.isFinite(bathrooms)) {
    specs.push(`<span><i class="fas fa-bath" aria-hidden="true"></i>${escapeHtml(bathrooms)} ${bathrooms === 1 ? 'bath' : 'baths'}</span>`);
  }
  if (squareFootage != null && Number.isFinite(squareFootage) && squareFootage > 0) {
    specs.push(`<span><i class="fas fa-ruler-combined" aria-hidden="true"></i>${squareFootage.toLocaleString()} sqft</span>`);
  }
  const price = Number.isFinite(rent) && rent > 0
    ? `<div class="unit-layout-price">$${rent.toLocaleString()}<small>monthly rent</small></div>`
    : `<div class="unit-layout-price unit-layout-price--unknown">Pricing not listed</div>`;
  const mediaPhotos = photos.length
    ? `<div class="unit-layout-photos" role="group" aria-label="${escapeHtml(`${layoutLabel} photos`)}">${photos.map((url, photoIndex) => `<img class="unit-layout-photo" src="${escapeHtml(url)}" alt="${escapeHtml(`${layoutLabel}, photo ${photoIndex + 1}`)}" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>`
    : '';
  const image = planUrl
    ? `<button class="unit-layout-plan-button" type="button" data-unit-action="view-plan" data-plan-url="${escapeHtml(planUrl)}" data-plan-label="${escapeHtml(layoutLabel)}" aria-label="View ${escapeHtml(layoutLabel)} floor plan"><img class="unit-layout-plan" src="${escapeHtml(planUrl)}" alt="${escapeHtml(`${layoutLabel} floor plan`)}" loading="lazy" referrerpolicy="no-referrer"><span><i class="fas fa-expand" aria-hidden="true"></i> View floor plan</span></button>`
    : `<div class="unit-layout-plan-placeholder" aria-hidden="true"><i class="fas fa-vector-square"></i><span>Floor plan details</span></div>`;

  return `<article class="unit-layout-card" data-unit-plan data-plan-index="${index}" data-beds="${Number.isFinite(bedrooms) ? bedrooms : ''}" data-rent="${Number.isFinite(rent) && rent > 0 ? rent : ''}" data-sqft="${Number.isFinite(squareFootage) && squareFootage > 0 ? squareFootage : ''}" data-name="${escapeHtml(layoutLabel.toLowerCase())}">
    ${image}
    <div class="unit-layout-body">
      <div class="unit-layout-head">
        <div><h3 class="unit-layout-number">${escapeHtml(layoutLabel)}</h3>${unitNumber && unit.floor_plan_name ? `<div class="unit-layout-unit-number">Unit ${escapeHtml(unitNumber)}</div>` : ''}</div>
        ${price}
      </div>
      ${specs.length ? `<div class="unit-layout-specs">${specs.join('')}</div>` : '<div class="unit-layout-specs unit-layout-specs--unknown">Plan specifications not listed</div>'}
      ${amenities.length ? `<div class="unit-layout-amenities">${amenities.map(item => `<span class="unit-layout-amenity">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
      ${mediaPhotos}
      ${isPlan ? `<label class="unit-layout-compare-toggle"><input type="checkbox" data-unit-action="compare" value="${index}"><span>Compare this layout</span></label>` : ''}
    </div>
  </article>`;
}

export function renderPropertyUnitsHtml(units, buildings = [], floors = []) {
  if (!Array.isArray(units) || units.length === 0) return '';

  const safeUnits = units.filter(unit => unit && typeof unit === 'object');
  const buildingById = new Map((Array.isArray(buildings) ? buildings : []).map(building => [building.id, building]));
  const floorById = new Map((Array.isArray(floors) ? floors : []).map(floor => [floor.id, floor]));
  const bedroomValues = numericValues(safeUnits, 'bedrooms');
  const bedroomOptions = bedroomValues.map(value =>
    `<option value="${escapeHtml(value)}">${value === 0 ? 'Studio' : `${escapeHtml(value)} ${value === 1 ? 'bedroom' : 'bedrooms'}`}</option>`
  ).join('');
  const cardsByUnit = new Map(safeUnits.map((unit, index) => [unit, renderUnit(unit, index)]));
  const assigned = new Map();
  const unassigned = [];

  for (const unit of safeUnits) {
    if (!unit?.building_id || !buildingById.has(unit.building_id)) {
      unassigned.push(unit);
      continue;
    }
    const key = `${unit.building_id}:${unit.floor_id || ''}`;
    if (!assigned.has(key)) assigned.set(key, []);
    assigned.get(key).push(unit);
  }

  let layoutSections;
  if (!assigned.size) {
    layoutSections = `<div class="unit-layout-grid">${safeUnits.map(unit => cardsByUnit.get(unit)).join('')}</div>`;
  } else {
    const sections = [];
    for (const building of buildings) {
      const buildingUnits = [...assigned.entries()]
        .filter(([key]) => key.startsWith(`${building.id}:`))
        .flatMap(([, groupedUnits]) => groupedUnits);
      if (!buildingUnits.length) continue;

      const floorGroups = new Map();
      for (const unit of buildingUnits) {
        const floor = unit.floor_id ? floorById.get(unit.floor_id) : null;
        const key = floor?.id || '';
        if (!floorGroups.has(key)) floorGroups.set(key, { floor, units: [] });
        floorGroups.get(key).units.push(unit);
      }
      const floorSections = [...floorGroups.values()]
        .sort((a, b) => (a.floor?.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.floor?.sort_order ?? Number.MAX_SAFE_INTEGER))
        .map(group => `<section class="unit-layout-floor" data-unit-group>
          <h4>${escapeHtml(group.floor?.floor_label || 'Building layouts')}</h4>
          <div class="unit-layout-grid">${group.units.map(unit => cardsByUnit.get(unit)).join('')}</div>
        </section>`)
        .join('');
      sections.push(`<section class="unit-layout-building" data-unit-group>
        <h3>${escapeHtml(building.name || 'Building')}</h3>
        ${floorSections}
      </section>`);
    }
    if (unassigned.length) {
      sections.push(`<section class="unit-layout-building" data-unit-group>
        <h3>Other layouts</h3>
        <div class="unit-layout-grid">${unassigned.map(unit => cardsByUnit.get(unit)).join('')}</div>
      </section>`);
    }
    layoutSections = sections.join('');
  }

  const summary = summarizePropertyUnits(safeUnits);
  const countLabel = `${summary.count} ${summary.count === 1 ? 'layout' : 'layouts'}`;
  return `<div class="unit-layout-experience" data-unit-layout-experience>
    <div class="unit-layout-toolbar">
      <div class="unit-layout-count">${escapeHtml(countLabel)} to explore</div>
      <div class="unit-layout-controls">
        <label>Search layouts<input type="search" data-unit-filter="search" placeholder="Plan name" autocomplete="off"></label>
        ${bedroomOptions ? `<label>Bedrooms<select data-unit-filter="bedrooms"><option value="">All bedrooms</option>${bedroomOptions}</select></label>` : ''}
        <label>Sort by<select data-unit-filter="sort"><option value="source">Recommended</option><option value="rent">Price: low to high</option><option value="beds">Bedrooms</option><option value="sqft">Square footage</option></select></label>
      </div>
    </div>
    <p class="unit-layout-results" data-unit-results aria-live="polite"></p>
    ${layoutSections}
    <section class="unit-layout-compare" data-unit-compare hidden aria-label="Floor plan comparison">
      <div class="unit-layout-compare-heading"><div><strong>Compare layouts</strong><span data-unit-compare-count></span></div><button type="button" data-unit-action="clear-compare">Clear selection</button></div>
      <p class="unit-layout-compare-message" data-unit-compare-message aria-live="polite"></p>
      <div class="unit-layout-compare-table-wrap" data-unit-compare-table></div>
    </section>
    <dialog class="unit-layout-dialog" data-unit-dialog aria-label="Floor plan image">
      <form method="dialog"><button class="unit-layout-dialog-close" aria-label="Close floor plan"><i class="fas fa-times" aria-hidden="true"></i></button></form>
      <img data-unit-dialog-image alt="">
      <p data-unit-dialog-caption></p>
    </dialog>
  </div>`;
}

export function initPropertyUnits(container) {
  const root = container?.querySelector('[data-unit-layout-experience]');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const cards = [...root.querySelectorAll('[data-unit-plan]')];
  const inputs = [...root.querySelectorAll('[data-unit-filter]')];
  const count = root.querySelector('[data-unit-results]');
  const comparePanel = root.querySelector('[data-unit-compare]');
  const compareCount = root.querySelector('[data-unit-compare-count]');
  const compareMessage = root.querySelector('[data-unit-compare-message]');
  const compareTable = root.querySelector('[data-unit-compare-table]');
  const selected = new Set();
  const unitAt = index => cards.find(card => Number(card.dataset.planIndex) === index);
  const units = new Map(cards.map(card => [Number(card.dataset.planIndex), {
    name: card.querySelector('.unit-layout-number')?.textContent || 'Layout',
    rent: card.dataset.rent ? Number(card.dataset.rent) : null,
    beds: card.dataset.beds !== '' ? Number(card.dataset.beds) : null,
    sqft: card.dataset.sqft ? Number(card.dataset.sqft) : null,
    baths: card.querySelector('.unit-layout-specs span:nth-child(2)')?.textContent.replace(/[^\d.]/g, '') || '',
  }]));

  function renderComparison() {
    const compared = [...selected].map(index => units.get(index)).filter(Boolean);
    comparePanel.hidden = compared.length === 0;
    if (!compared.length) return;
    compareCount.textContent = ` · ${compared.length} selected`;
    compareMessage.textContent = compared.length < 2
      ? 'Select one more layout to compare pricing and specifications.'
      : 'Compare source-provided details side by side.';
    if (compared.length < 2) {
      compareTable.innerHTML = '';
      return;
    }
    const rows = [
      ['Monthly rent', item => item.rent == null ? 'Not listed' : `$${item.rent.toLocaleString()}`],
      ['Bedrooms', item => item.beds == null ? 'Not listed' : item.beds === 0 ? 'Studio' : String(item.beds)],
      ['Bathrooms', item => item.baths || 'Not listed'],
      ['Square footage', item => item.sqft == null ? 'Not listed' : `${item.sqft.toLocaleString()} sqft`],
    ];
    compareTable.innerHTML = `<table><thead><tr><th scope="col">Details</th>${compared.map(item => `<th scope="col">${escapeHtml(item.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, render]) => `<tr><th scope="row">${label}</th>${compared.map(item => `<td>${escapeHtml(render(item))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function updateFilters() {
    const search = (root.querySelector('[data-unit-filter="search"]')?.value || '').trim().toLowerCase();
    const bedroom = root.querySelector('[data-unit-filter="bedrooms"]')?.value || '';
    let visible = 0;
    cards.forEach(card => {
      const show = (!search || card.dataset.name.includes(search)) &&
        (!bedroom || card.dataset.beds === bedroom);
      card.hidden = !show;
      if (show) visible++;
    });
    root.querySelectorAll('[data-unit-group]').forEach(group => {
      group.hidden = !group.querySelector('[data-unit-plan]:not([hidden])');
    });
    if (count) count.textContent = `${visible} ${visible === 1 ? 'layout' : 'layouts'} shown`;
  }

  function sortCards(value) {
    if (value === 'source') return;
    root.querySelectorAll('.unit-layout-grid').forEach(grid => {
      const sorted = [...grid.querySelectorAll('[data-unit-plan]')].sort((a, b) => {
        const key = value === 'rent' ? 'rent' : value === 'beds' ? 'beds' : 'sqft';
        const leftValue = a.dataset[key];
        const rightValue = b.dataset[key];
        const left = leftValue === '' ? NaN : Number(leftValue);
        const right = rightValue === '' ? NaN : Number(rightValue);
        if (!Number.isFinite(left)) return 1;
        if (!Number.isFinite(right)) return -1;
        return left - right;
      });
      sorted.forEach(card => grid.appendChild(card));
    });
  }

  inputs.forEach(input => input.addEventListener('input', updateFilters));
  inputs.forEach(input => input.addEventListener('change', () => {
    if (input.dataset.unitFilter === 'sort') sortCards(input.value);
    updateFilters();
  }));
  root.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-unit-action="compare"]');
    if (!checkbox) return;
    const index = Number(checkbox.value);
    if (checkbox.checked && selected.size >= 3) {
      checkbox.checked = false;
      if (compareMessage) compareMessage.textContent = 'You can compare up to three layouts at a time.';
      return;
    }
    if (checkbox.checked) selected.add(index);
    else selected.delete(index);
    renderComparison();
  });
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-unit-action]');
    if (!action) return;
    if (action.dataset.unitAction === 'clear-compare') {
      selected.clear();
      root.querySelectorAll('[data-unit-action="compare"]').forEach(input => { input.checked = false; });
      renderComparison();
    } else if (action.dataset.unitAction === 'view-plan') {
      const dialog = root.querySelector('[data-unit-dialog]');
      const image = dialog?.querySelector('[data-unit-dialog-image]');
      const caption = dialog?.querySelector('[data-unit-dialog-caption]');
      if (!dialog || !image || !action.dataset.planUrl) return;
      image.src = action.dataset.planUrl;
      image.alt = `${action.dataset.planLabel || 'Floor plan'} floor plan`;
      if (caption) caption.textContent = action.dataset.planLabel || 'Floor plan';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
  });

  root.querySelectorAll('[data-unit-plan]').forEach(card => {
    if (!unitAt(Number(card.dataset.planIndex))) card.hidden = true;
  });
  updateFilters();
}
