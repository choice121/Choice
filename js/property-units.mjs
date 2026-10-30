function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
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

export function renderPropertyUnitsHtml(units) {
  if (!Array.isArray(units) || units.length === 0) return '';

  return units.map(unit => {
    const planUrl = safeImageUrl(unit.floor_plan_image_url);
    const photos = unitPhotoUrls(unit.unit_photos);
    const amenities = Array.isArray(unit.amenities)
      ? unit.amenities.filter(value => typeof value === 'string' && value.trim()).slice(0, 10)
      : [];
    const specs = [];
    if (unit.bedrooms != null) {
      specs.push(`<span><i class="fas fa-bed" aria-hidden="true"></i>${Number(unit.bedrooms) === 0 ? 'Studio' : `${escapeHtml(unit.bedrooms)} bd`}</span>`);
    }
    if (unit.bathrooms != null) specs.push(`<span><i class="fas fa-bath" aria-hidden="true"></i>${escapeHtml(unit.bathrooms)} ba</span>`);
    if (unit.square_footage != null) specs.push(`<span><i class="fas fa-ruler-combined" aria-hidden="true"></i>${Number(unit.square_footage).toLocaleString()} sqft</span>`);
    const rent = Number(unit.monthly_rent);
    const price = Number.isFinite(rent) && rent > 0 ? `$${rent.toLocaleString()}` : '';
    const mediaPhotos = photos.length
      ? `<div class="unit-layout-photos" role="group" aria-label="Unit photos">${photos.map((url, index) => `<img class="unit-layout-photo" src="${escapeHtml(url)}" alt="${escapeHtml(`Unit ${unit.unit_number} photo ${index + 1}`)}" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>`
      : '';

    return `<article class="unit-layout-card">
      ${planUrl ? `<img class="unit-layout-plan" src="${escapeHtml(planUrl)}" alt="${escapeHtml(unit.floor_plan_name || `Unit ${unit.unit_number} floor plan`)}" loading="lazy" referrerpolicy="no-referrer">` : ''}
      <div class="unit-layout-body">
        <div class="unit-layout-head">
          <div><h3 class="unit-layout-number">${escapeHtml(unit.floor_plan_name || `Unit ${unit.unit_number}`)}</h3>${unit.floor_plan_name ? `<div style="font-size:.72rem;color:var(--m-muted);margin-top:3px">Unit ${escapeHtml(unit.unit_number)}</div>` : ''}</div>
          ${price ? `<div class="unit-layout-price">${price}<small>per month</small></div>` : ''}
        </div>
        ${specs.length ? `<div class="unit-layout-specs">${specs.join('')}</div>` : ''}
        ${amenities.length ? `<div class="unit-layout-amenities">${amenities.map(item => `<span class="unit-layout-amenity">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
        ${mediaPhotos}
      </div>
    </article>`;
  }).join('');
}
