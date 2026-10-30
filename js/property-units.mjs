const PROHIBITED_CONTENT_RE = /\b(?:pets?|smoking|lease|deposit|move[\s-]?in|available\s+(?:from|date|now)|application\s+requirements|requirements\s*(?:&|and)\s*qualifications|credit\s+score|income\s+requirement|eviction|criminal\s+history|cash\s*app|zelle|paypal|venmo|apple\s*pay|wire\s+transfer|money\s+order|scam|fraud)\b/i;

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
  let list = value;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch (_) { list = list.split(','); }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map(stripHtml)
    .map(item => item.trim())
    .filter(item => item && !PROHIBITED_CONTENT_RE.test(item))
    .slice(0, 10);
}

function cleanUnitNotes(value) {
  if (typeof value !== 'string') return '';
  const cleaned = stripHtml(value).trim();
  if (!cleaned || PROHIBITED_CONTENT_RE.test(cleaned)) return '';
  return cleaned.slice(0, 180);
}

function isUnitInactive(unit) {
  const s = String(unit?.status || 'available').trim().toLowerCase();
  return s === 'leased' || s === 'rented' || s === 'unavailable' || s === 'occupied';
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

export function summarizePropertyUnits(units, isMultiUnit = false) {
  const safeUnits = Array.isArray(units) ? units.filter(unit => unit && typeof unit === 'object') : [];
  const activeUnits = safeUnits.filter(unit => !isUnitInactive(unit));
  const targetUnits = activeUnits.length ? activeUnits : safeUnits;

  const rents = numericValues(targetUnits, 'monthly_rent').filter(value => value > 0);
  const bedrooms = numericValues(targetUnits, 'bedrooms');
  const bathrooms = numericValues(targetUnits, 'bathrooms');
  const squareFootage = numericValues(targetUnits, 'square_footage').filter(value => value > 0);

  const numberedCount = targetUnits.filter(unit =>
    typeof unit.unit_number === 'string' && unit.unit_number.trim()
  ).length;
  const planCount = targetUnits.filter(unit =>
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

  const isCommunity = planCount > 0 || targetUnits.length > 1 || (Boolean(isMultiUnit) && targetUnits.length >= 1);
  const hasRange = targetUnits.length > 1 || planCount >= 1 || rents.length > 1;
  const minRent = rents.length ? rents[0] : null;
  const maxRent = rents.length ? rents[rents.length - 1] : null;

  return {
    isCommunity,
    hasRange,
    count: targetUnits.length,
    availableCount: activeUnits.length,
    totalCount: safeUnits.length,
    numberedCount,
    planCount,
    minRent,
    maxRent,
    bedrooms: specRange(bedrooms, 'bed', 'beds'),
    bathrooms: specRange(bathrooms, 'bath', 'baths'),
    squareFootage: squareFootage.length ? `${numberRange(squareFootage)} sqft` : '',
  };
}

function renderUnit(unit, index, context) {
  const { buildingById, floorById, mediaItems, buildUnitApplyUrl, canApply } = context;
  const unitNumber = typeof unit.unit_number === 'string' ? unit.unit_number.trim() : '';
  const floorPlanName = typeof unit.floor_plan_name === 'string' ? unit.floor_plan_name.trim() : '';
  const bedrooms = unit.bedrooms == null || unit.bedrooms === '' ? null : Number(unit.bedrooms);
  const bathrooms = unit.bathrooms == null || unit.bathrooms === '' ? null : Number(unit.bathrooms);
  const squareFootage = unit.square_footage == null || unit.square_footage === '' ? null : Number(unit.square_footage);
  const rent = unit.monthly_rent == null || unit.monthly_rent === '' ? null : Number(unit.monthly_rent);

  const building = unit.building_id ? buildingById.get(unit.building_id) : null;
  const floor = unit.floor_id ? floorById.get(unit.floor_id) : null;
  const buildingName = building?.name || '';
  const floorLabel = floor?.floor_label || '';

  const layoutLabel = unitNumber && floorPlanName
    ? `Unit ${unitNumber} · ${floorPlanName}`
    : (floorPlanName || (unitNumber
      ? `Unit ${unitNumber}`
      : Number.isFinite(bedrooms)
        ? (bedrooms === 0 ? 'Studio layout' : `${bedrooms} bedroom layout`)
        : (Number.isFinite(squareFootage) ? `${squareFootage.toLocaleString()} sqft layout` : 'Unit layout')));

  const unitPlanMedia = mediaItems.find(m =>
    m && m.url && m.kind === 'floor_plan' &&
    ((unit.id && m.unit_id === unit.id) || (!m.unit_id && unit.floor_id && m.floor_id === unit.floor_id))
  );
  const planUrl = safeImageUrl(unit.floor_plan_image_url) || safeImageUrl(unitPlanMedia?.url);

  const unitTours = mediaItems.filter(m =>
    m && m.url && (m.kind === 'tour_3d' || m.kind === 'virtual_tour' || m.kind === 'video') &&
    ((unit.id && m.unit_id === unit.id) || (!m.unit_id && unit.floor_id && m.floor_id === unit.floor_id))
  );
  const tour3d = unitTours.find(m => m.kind === 'tour_3d' || m.kind === 'virtual_tour');
  const videoTour = unitTours.find(m => m.kind === 'video');

  const photos = unitPhotoUrls(unit.unit_photos);
  const amenities = allowedAmenities(unit.amenities);
  const notes = cleanUnitNotes(unit.notes);
  const inactive = isUnitInactive(unit);
  const isPending = String(unit.status || '').toLowerCase() === 'pending';

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

  const rentBasisLabel = unit.rent_basis === 'per_person' ? 'per bed / mo' : 'monthly rent';
  const price = Number.isFinite(rent) && rent > 0
    ? `<div class="unit-layout-price">$${rent.toLocaleString()}<small>${escapeHtml(rentBasisLabel)}</small></div>`
    : `<div class="unit-layout-price unit-layout-price--unknown">Pricing on request</div>`;

  const metaParts = [
    buildingName,
    floorLabel,
    isPending ? 'Application pending' : (inactive ? 'Currently leased' : ''),
  ].filter(Boolean);

  const mediaPhotos = photos.length
    ? `<div class="unit-layout-photos" role="group" aria-label="${escapeHtml(`${layoutLabel} photos`)}">${photos.map((url, photoIndex) => `<img class="unit-layout-photo" src="${escapeHtml(url)}" alt="${escapeHtml(`${layoutLabel}, photo ${photoIndex + 1}`)}" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>`
    : '';

  const image = planUrl
    ? `<button class="unit-layout-plan-button" type="button" data-unit-action="view-plan" data-plan-url="${escapeHtml(planUrl)}" data-plan-label="${escapeHtml(layoutLabel)}" aria-label="View ${escapeHtml(layoutLabel)} floor plan"><img class="unit-layout-plan" src="${escapeHtml(planUrl)}" alt="${escapeHtml(`${layoutLabel} floor plan`)}" loading="lazy" referrerpolicy="no-referrer"><span><i class="fas fa-expand" aria-hidden="true"></i> View floor plan</span></button>`
    : (photos[0]
      ? `<div class="unit-layout-plan-button" style="cursor:default"><img class="unit-layout-plan" style="object-fit:cover" src="${escapeHtml(photos[0])}" alt="${escapeHtml(`${layoutLabel} interior`)}" loading="lazy" referrerpolicy="no-referrer"></div>`
      : `<div class="unit-layout-plan-placeholder" aria-hidden="true"><i class="fas fa-vector-square"></i><span>${escapeHtml(floorLabel || buildingName || 'Unit details')}</span></div>`);

  let applyHref = '';
  if (canApply && !inactive && typeof buildUnitApplyUrl === 'function') {
    try { applyHref = buildUnitApplyUrl(unit) || ''; } catch (_) { applyHref = ''; }
  }

  const mediaQuickBtns = [];
  if (tour3d) {
    mediaQuickBtns.push(`<button type="button" class="unit-layout-media-btn" data-unit-action="open-tour" data-tour-id="${escapeHtml(tour3d.id || '')}" data-tour-url="${escapeHtml(tour3d.url)}"><i class="fas fa-cube" aria-hidden="true"></i> 3D Tour</button>`);
  }
  if (videoTour) {
    mediaQuickBtns.push(`<button type="button" class="unit-layout-media-btn" data-unit-action="open-tour" data-tour-id="${escapeHtml(videoTour.id || '')}" data-tour-url="${escapeHtml(videoTour.url)}"><i class="fas fa-play" aria-hidden="true"></i> Video</button>`);
  }

  const applyCtaHtml = canApply
    ? (inactive
      ? `<span class="unit-layout-apply-btn is-disabled" aria-disabled="true">Unavailable</span>`
      : (applyHref
        ? `<a href="${escapeHtml(applyHref)}" class="unit-layout-apply-btn" data-unit-action="apply-unit" data-plan-index="${index}">${escapeHtml(unitNumber ? `Apply · Unit ${unitNumber}` : 'Apply Now')} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
        : ''))
    : '';

  const searchTokens = [layoutLabel, unitNumber, floorPlanName, buildingName, floorLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return `<article class="unit-layout-card${inactive ? ' is-inactive' : ''}" data-unit-plan data-plan-index="${index}" data-beds="${Number.isFinite(bedrooms) ? bedrooms : ''}" data-baths="${Number.isFinite(bathrooms) ? bathrooms : ''}" data-rent="${Number.isFinite(rent) && rent > 0 ? rent : ''}" data-sqft="${Number.isFinite(squareFootage) && squareFootage > 0 ? squareFootage : ''}" data-building="${escapeHtml(unit.building_id || '')}" data-building-name="${escapeHtml(buildingName)}" data-floor="${escapeHtml(unit.floor_id || '')}" data-floor-label="${escapeHtml(floorLabel)}" data-apply-url="${escapeHtml(applyHref)}" data-name="${escapeHtml(searchTokens)}">
    ${image}
    <div class="unit-layout-body">
      <div class="unit-layout-head">
        <div>
          <h3 class="unit-layout-number">${escapeHtml(layoutLabel)}</h3>
          ${metaParts.length ? `<div class="unit-layout-meta-line">${escapeHtml(metaParts.join(' · '))}</div>` : ''}
        </div>
        ${price}
      </div>
      ${specs.length ? `<div class="unit-layout-specs">${specs.join('')}</div>` : '<div class="unit-layout-specs unit-layout-specs--unknown">Specifications not listed</div>'}
      ${notes ? `<p class="unit-layout-notes">${escapeHtml(notes)}</p>` : ''}
      ${amenities.length ? `<div class="unit-layout-amenities">${amenities.map(item => `<span class="unit-layout-amenity">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
      ${mediaPhotos}
      <div class="unit-layout-footer">
        <label class="unit-layout-compare-toggle"><input type="checkbox" data-unit-action="compare" value="${index}"><span>Compare</span></label>
        <div class="unit-layout-actions">
          ${mediaQuickBtns.join('')}
          ${applyCtaHtml}
        </div>
      </div>
    </div>
  </article>`;
}

export function renderPropertyUnitsHtml(units, buildings = [], floors = [], options = {}) {
  if (!Array.isArray(units) || units.length === 0) return '';

  const safeUnits = units.filter(unit => unit && typeof unit === 'object');
  if (!safeUnits.length) return '';

  const safeBuildings = Array.isArray(buildings) ? buildings : [];
  const safeFloors = Array.isArray(floors) ? floors : [];
  const buildingById = new Map(safeBuildings.map(building => [building.id, building]));
  const floorById = new Map(safeFloors.map(floor => [floor.id, floor]));
  const context = {
    buildingById,
    floorById,
    mediaItems: Array.isArray(options?.media) ? options.media : [],
    buildUnitApplyUrl: typeof options?.buildUnitApplyUrl === 'function' ? options.buildUnitApplyUrl : null,
    canApply: options?.canApply !== false,
  };

  const bedroomValues = numericValues(safeUnits, 'bedrooms');
  const bedroomOptions = bedroomValues.map(value =>
    `<option value="${escapeHtml(value)}">${value === 0 ? 'Studio' : `${escapeHtml(value)} ${value === 1 ? 'bedroom' : 'bedrooms'}`}</option>`
  ).join('');

  const usedBuildingIds = [...new Set(safeUnits.map(u => u.building_id).filter(id => id && buildingById.has(id)))];
  const buildingOptions = usedBuildingIds.length > 1
    ? usedBuildingIds.map(id => {
        const b = buildingById.get(id);
        return `<option value="${escapeHtml(id)}">${escapeHtml(b.name || 'Building')}</option>`;
      }).join('')
    : '';

  const usedFloorIds = [...new Set(safeUnits.map(u => u.floor_id).filter(id => id && floorById.has(id)))];
  const floorOptions = usedFloorIds.length > 1
    ? usedFloorIds
        .map(id => floorById.get(id))
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
        .map(f => {
          const bName = usedBuildingIds.length > 1 && f.building_id && buildingById.has(f.building_id)
            ? `${buildingById.get(f.building_id).name} · `
            : '';
          return `<option value="${escapeHtml(f.id)}">${escapeHtml(`${bName}${f.floor_label || 'Floor'}`)}</option>`;
        }).join('')
    : '';

  const cardsByUnit = new Map(safeUnits.map((unit, index) => [unit, renderUnit(unit, index, context)]));
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
    for (const building of safeBuildings) {
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
          <h4>${escapeHtml(group.floor?.floor_label || 'General Building Units')}</h4>
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
        <h3>Additional Units &amp; Floor Plans</h3>
        <div class="unit-layout-grid">${unassigned.map(unit => cardsByUnit.get(unit)).join('')}</div>
      </section>`);
    }
    layoutSections = sections.join('');
  }

  const summary = summarizePropertyUnits(safeUnits, true);
  const noun = summary.numberedCount > 0 && summary.planCount === 0
    ? (summary.count === 1 ? 'unit' : 'units')
    : (summary.numberedCount > 0 && summary.planCount > 0 ? 'units & layouts' : (summary.count === 1 ? 'layout' : 'layouts'));
  const countLabel = `${summary.count} ${noun} available to explore`;

  return `<div class="unit-layout-experience" data-unit-layout-experience data-unit-noun="${escapeHtml(noun)}">
    <div class="unit-layout-toolbar">
      <div class="unit-layout-count">${escapeHtml(countLabel)}</div>
      <div class="unit-layout-controls">
        <label>Search<input type="search" data-unit-filter="search" placeholder="Unit #, floor plan, or level" autocomplete="off"></label>
        ${buildingOptions ? `<label>Building<select data-unit-filter="building"><option value="">All buildings</option>${buildingOptions}</select></label>` : ''}
        ${floorOptions ? `<label>Floor / Level<select data-unit-filter="floor"><option value="">All floors</option>${floorOptions}</select></label>` : ''}
        ${bedroomOptions ? `<label>Bedrooms<select data-unit-filter="bedrooms"><option value="">All bedrooms</option>${bedroomOptions}</select></label>` : ''}
        <label>Sort by<select data-unit-filter="sort"><option value="source">Recommended</option><option value="rent">Price: low to high</option><option value="beds">Bedrooms</option><option value="sqft">Square footage</option></select></label>
      </div>
    </div>
    <p class="unit-layout-results" data-unit-results aria-live="polite"></p>
    ${layoutSections}
    <section class="unit-layout-compare" data-unit-compare hidden aria-label="Unit and floor plan comparison">
      <div class="unit-layout-compare-heading"><div><strong>Compare options</strong><span data-unit-compare-count></span></div><button type="button" data-unit-action="clear-compare">Clear selection</button></div>
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

export function initPropertyUnits(container, callbacks = {}) {
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
  const units = new Map(cards.map(card => {
    const idx = Number(card.dataset.planIndex);
    return [idx, {
      index: idx,
      name: card.querySelector('.unit-layout-number')?.textContent || 'Unit',
      buildingName: card.dataset.buildingName || '',
      floorLabel: card.dataset.floorLabel || '',
      rent: card.dataset.rent ? Number(card.dataset.rent) : null,
      beds: card.dataset.beds !== '' ? Number(card.dataset.beds) : null,
      baths: card.dataset.baths !== '' ? card.dataset.baths : '',
      sqft: card.dataset.sqft ? Number(card.dataset.sqft) : null,
      applyUrl: card.dataset.applyUrl || '',
    }];
  }));

  function renderComparison() {
    const compared = [...selected].map(index => units.get(index)).filter(Boolean);
    comparePanel.hidden = compared.length === 0;
    if (!compared.length) return;
    compareCount.textContent = ` · ${compared.length} selected`;
    compareMessage.textContent = compared.length < 2
      ? 'Select one more unit or layout to compare pricing and specifications side by side.'
      : 'Comparing source-verified specifications side by side.';
    if (compared.length < 2) {
      compareTable.innerHTML = '';
      return;
    }

    const rows = [];
    if (compared.some(item => item.buildingName)) {
      rows.push(['Building', item => escapeHtml(item.buildingName || '—')]);
    }
    if (compared.some(item => item.floorLabel)) {
      rows.push(['Floor / Level', item => escapeHtml(item.floorLabel || '—')]);
    }
    rows.push(
      ['Monthly rent', item => escapeHtml(item.rent == null ? 'On request' : `$${item.rent.toLocaleString()}/mo`)],
      ['Bedrooms', item => escapeHtml(item.beds == null ? 'Not listed' : item.beds === 0 ? 'Studio' : String(item.beds))],
      ['Bathrooms', item => escapeHtml(item.baths || 'Not listed')],
      ['Square footage', item => escapeHtml(item.sqft == null ? 'Not listed' : `${item.sqft.toLocaleString()} sqft`)],
    );
    if (compared.some(item => item.applyUrl)) {
      rows.push(['Application', item => item.applyUrl
        ? `<a href="${escapeHtml(item.applyUrl)}" class="unit-layout-apply-btn is-compact" data-unit-action="apply-unit" data-plan-index="${item.index}">Apply <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
        : '<span style="color:var(--m-muted)">Unavailable</span>'
      ]);
    }

    compareTable.innerHTML = `<table><thead><tr><th scope="col">Details</th>${compared.map(item => `<th scope="col">${escapeHtml(item.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, renderCell]) => `<tr><th scope="row">${escapeHtml(label)}</th>${compared.map(item => `<td>${renderCell(item)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function updateFilters() {
    const search = (root.querySelector('[data-unit-filter="search"]')?.value || '').trim().toLowerCase();
    const building = root.querySelector('[data-unit-filter="building"]')?.value || '';
    const floor = root.querySelector('[data-unit-filter="floor"]')?.value || '';
    const bedroom = root.querySelector('[data-unit-filter="bedrooms"]')?.value || '';
    let visible = 0;
    cards.forEach(card => {
      const show = (!search || card.dataset.name.includes(search)) &&
        (!building || card.dataset.building === building) &&
        (!floor || card.dataset.floor === floor) &&
        (!bedroom || card.dataset.beds === bedroom);
      card.hidden = !show;
      if (show) visible++;
    });
    root.querySelectorAll('[data-unit-group]').forEach(group => {
      group.hidden = !group.querySelector('[data-unit-plan]:not([hidden])');
    });
    if (count) {
      count.textContent = `${visible} ${visible === 1 ? 'option' : 'options'} shown`;
    }
  }

  function sortCards(value) {
    root.querySelectorAll('.unit-layout-grid').forEach(grid => {
      const sorted = [...grid.querySelectorAll('[data-unit-plan]')].sort((a, b) => {
        if (value === 'source') {
          return Number(a.dataset.planIndex) - Number(b.dataset.planIndex);
        }
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
      if (compareMessage) compareMessage.textContent = 'You can compare up to three options at a time.';
      return;
    }
    if (checkbox.checked) selected.add(index);
    else selected.delete(index);
    renderComparison();
  });
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-unit-action]');
    if (!action) return;
    const act = action.dataset.unitAction;
    if (act === 'clear-compare') {
      selected.clear();
      root.querySelectorAll('[data-unit-action="compare"]').forEach(input => { input.checked = false; });
      renderComparison();
    } else if (act === 'view-plan') {
      if (typeof callbacks?.onOpenPlan === 'function' && action.dataset.planUrl) {
        callbacks.onOpenPlan(action.dataset.planUrl, action.dataset.planLabel || 'Floor plan');
        return;
      }
      const dialog = root.querySelector('[data-unit-dialog]');
      const image = dialog?.querySelector('[data-unit-dialog-image]');
      const caption = dialog?.querySelector('[data-unit-dialog-caption]');
      if (!dialog || !image || !action.dataset.planUrl) return;
      image.src = action.dataset.planUrl;
      image.alt = `${action.dataset.planLabel || 'Floor plan'} floor plan`;
      if (caption) caption.textContent = action.dataset.planLabel || 'Floor plan';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (act === 'open-tour') {
      if (typeof callbacks?.onOpenTour === 'function') {
        callbacks.onOpenTour(action.dataset.tourId || '', action.dataset.tourUrl || '');
      }
    } else if (act === 'apply-unit') {
      if (typeof callbacks?.onApplyUnit === 'function') {
        callbacks.onApplyUnit(Number(action.dataset.planIndex), event);
      }
    }
  });

  root.querySelectorAll('[data-unit-plan]').forEach(card => {
    if (!unitAt(Number(card.dataset.planIndex))) card.hidden = true;
  });
  updateFilters();
}
