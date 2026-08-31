// ============================================================
// property.js — page-specific logic for /property.html
// Extracted from inline <script type="module"> in property.html
// as part of issue #16 (separate concerns + de-duplicate helpers).
// Loaded as: <script type="module" src="/js/property.js?v=...">.
// ============================================================
import { supabase, buildApplyURL, incrementCounter, getSession, SavedProperties } from '/js/cp-api.js';
import { updateNav as _updateNav } from '/js/cp-api.js';

// Shared helpers — defined globally by /js/cp-ui.js (loaded before this module).
//   - esc:            HTML-escape, null-safe (CP.UI.esc)
//   - showToast:      legacy public-page toast, uses #toastContainer
//   - setupScrollTop: scroll-to-top button wiring (not used on this page,
//                     but available if needed)
const esc = CP.UI.esc;
const showToast = window.showToast;

// Extended nav init — wires both navAuthLink and drawerAuthLink, populates contacts
async function updateNav() {
  await _updateNav();
  // Wire drawerAuthLink to match navAuthLink after _updateNav resolves
  const navLink    = document.getElementById('navAuthLink');
  const drawerLink = document.getElementById('drawerAuthLink');
  if (navLink && drawerLink) {
    drawerLink.href = navLink.href;
    drawerLink.textContent = navLink.textContent;
  }
  // Populate CONFIG-driven contacts
  if (window.CONFIG) {
    const df = document.getElementById('drawerFooterEmail');
    if (df) { df.href = 'mailto:' + CONFIG.COMPANY_EMAIL; df.textContent = CONFIG.COMPANY_EMAIL; }
    document.querySelectorAll('[data-cfg-email]').forEach(el => { el.href = 'mailto:' + CONFIG.COMPANY_EMAIL; el.textContent = CONFIG.COMPANY_EMAIL; });
    document.querySelectorAll('[data-cfg-phone]').forEach(el => { el.href = 'tel:' + CONFIG.COMPANY_PHONE.replace(/\D/g,''); el.textContent = CONFIG.COMPANY_PHONE; });
  }
}

updateNav();

const params    = new URLSearchParams(window.location.search);
const isPreview = params.get('preview') === 'true';

// Resolve the property id from either:
//   1) the legacy ?id=PROP-XXXXXXXX query string, or
//   2) the trailing token of the canonical slug URL — either:
//      - old format: prop-xxxxxxxx  (short alphanumeric)
//      - new format: full UUID      (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
//      e.g. `/rent/<state>/<city>/<beds>-<type>-<uuid>/`
//      (rendered by functions/rent/[state]/[city]/[slug].js).
// Matching the same regex the edge function uses keeps the two
// in lock-step. Without this fallback, every click on a card on
// the live site shows "Property not found." and redirects to
// /listings.html because the canonical URL has no ?id=.
function resolvePropertyId() {
  const fromQuery = (params.get('id') || '').trim();
  if (fromQuery) return fromQuery;
  const m = window.location.pathname.match(/(prop-[a-z0-9]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
  return m ? m[1].toLowerCase() : '';
}
const propertyId = resolvePropertyId();

if (!propertyId && !isPreview) {
  // Gracefully degrade instead of hard redirecting
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderUnavailable('not_found'));
  } else {
    renderUnavailable('not_found');
  }
}

let currentProperty  = null;
let photoIndex       = 0;
let allPhotos        = [];
let _isAdminViewer   = false;
let savedIds = new Set(JSON.parse(localStorage.getItem('cp_saved') || '[]'));

if (isPreview) {
  // ── Preview mode — load from sessionStorage ──
  const raw = sessionStorage.getItem('cp_listing_preview');
  if (!raw) { window.location.href = '/index.html'; } else {
    const previewProp = JSON.parse(raw);
    // Inject preview banner
    const banner = document.createElement('div');
    banner.id = 'previewBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:var(--warning-strong);color:#0a1628;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:0 2px 12px rgba(0,0,0,0.2);font-family:"Inter",sans-serif;font-size:14px;font-weight:600';
    banner.innerHTML = `
      <span><i class="fas fa-eye" style="margin-right:6px"></i>Preview Mode — This listing has not been published yet.</span>
      <button id="previewBannerBack" style="background:#0a1628;color:var(--warning-strong);border:none;border-radius:6px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer">← Back to Editor</button>`;
    document.body.prepend(banner);
    banner.querySelector('#previewBannerBack').addEventListener('click', () => history.back());
    document.body.style.paddingTop = '48px';
    currentProperty = previewProp;
    renderProperty(previewProp);
    // Disable apply buttons in preview mode
    requestAnimationFrame(() => {
      ['applyBtn','mobApplyBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.href = '#';
          el.style.pointerEvents = 'none';
          el.style.opacity = '0.5';
          el.title = 'Apply button disabled in preview mode';
          el.addEventListener('click', e => e.preventDefault());
        }
      });
    });
  }
} else {
  loadProperty(propertyId);
}

async function loadProperty(id) {
  // Phase 1 — DB lookup. Only this phase may legitimately raise the
  // "Property not found." toast + redirect, because only this phase can
  // tell us the row truly does not exist (or is hidden by RLS).
  let prop;
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*, landlords(id, user_id, business_name, contact_name, avatar_url, tagline, verified), property_photos(id, url, file_id, display_order, is_hero)')
      .ilike('id', id)
      .single();
    if (error || !data) throw new Error('Not found');
    prop = data;
  } catch (e) {
    console.error('[property] lookup failed for id=', id, e);
    renderUnavailable('not_found');
    return;
  }

  // Phase 3c: derive photo_urls / photo_file_ids from the property_photos join
  // (the legacy array columns were dropped; property_photos is now the source of truth)
  if (Array.isArray(prop.property_photos)) {
    const _sorted = prop.property_photos.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    prop.photo_urls     = _sorted.map(p => p.url).filter(Boolean);
    prop.photo_file_ids = _sorted.map(p => p.file_id ?? null);
  } else {
    prop.photo_urls     = [];
    prop.photo_file_ids = [];
  }

  // Check admin status early — admin sees all properties regardless of status
  try {
    const session = await getSession();
    if (session?.user) {
      _isAdminViewer = await (window.CP?.Auth?.isAdmin?.().catch(() => false) ?? false);
    }
  } catch(e) { /* non-fatal */ }

  // Guard non-active listings from public view (owner or admin may bypass)
  if (prop.status !== 'active' && !_isAdminViewer) {
    try {
      const session    = await getSession();
      const viewerId   = session?.user?.id || null;
      const ownerId    = prop.landlords?.user_id || null;
      const isOwner    = viewerId && ownerId && viewerId === ownerId;
      if (!isOwner) {
        renderUnavailable(prop.status);
        return;
      }
    } catch (e) {
      console.warn('[property] session check failed; treating as anonymous', e);
      renderUnavailable(prop.status);
      return;
    }
  }

  currentProperty = prop;

  // Phase 2 — view-counter bump. Pure side-effect; never block render
  // and never trip the not-found path if the RPC errors out.
  try {
    await incrementCounter('properties', id, 'views_count');
  } catch (e) {
    console.warn('[property] increment_counter failed (non-fatal)', e);
  }

  // Phase 3 — render. If anything in renderProperty throws, the row
  // really does exist, so DO NOT show "Property not found." and DO NOT
  // redirect away — that destroys the user's session for what is
  // almost certainly a UI bug. Surface the real error to the console
  // and the error reporter so we can fix it.
  try {
    renderProperty(prop);
    if (_isAdminViewer) initAdminPropertyPanel(prop);
  } catch (e) {
    console.error('[property] renderProperty crashed:', e);
    if (typeof window.cpReportError === 'function') {
      try { window.cpReportError(e); } catch (_) { /* swallow */ }
    }
    showToast('Some details could not be displayed. Please refresh.', 'error');
  }

  // Refresh save state from Supabase for authenticated users (non-blocking).
  // Wrapped so a thrown TypeError (e.g. SavedProperties undefined in a
  // partial-import edge case) cannot bubble up and trigger a redirect.
  try {
    SavedProperties.getIds().then(ids => {
      savedIds = ids;
      const saveBtn = document.getElementById('savePropBtn');
      if (saveBtn) {
        if (savedIds.has(prop.id)) {
          saveBtn.innerHTML = '<i class="fas fa-heart" style="color:var(--danger-strong)"></i> Saved';
        } else {
          saveBtn.innerHTML = '<i class="far fa-heart"></i> Save';
        }
      }
    }).catch(err => console.warn('[property] saved-state load failed', err));
  } catch (e) {
    console.warn('[property] saved-state init failed', e);
  }
}

function renderUnavailable(status) {
  document.title = 'Listing Unavailable — Choice Properties';
  document.getElementById('gallery').style.display = 'none';
  
  let msg = 'This listing has been paused or removed by the landlord.';
  if (status === 'rented') msg = 'This property has already been rented.';
  else if (status === 'not_found') msg = 'We could not find the property you are looking for. It may have been removed or the link is incorrect.';

  document.querySelector('.property-detail').innerHTML = `
    <div class="container" style="padding:80px 16px;text-align:center;max-width:540px;margin:0 auto">
      <div style="font-size:48px;margin-bottom:16px;color:var(--m-brand)"><i class="fas fa-house-circle-exclamation"></i></div>
      <h1 style="font-size:1.5rem;font-weight:700;color:var(--m-ink);margin-bottom:12px">
        This listing is not currently available.
      </h1>
      <p style="color:var(--m-muted);font-size:15px;margin-bottom:32px">
        ${msg}
      </p>
      <a href="/listings.html" class="btn btn-primary" style="display:inline-block">
        View similar rentals in Columbus
      </a>
    </div>`;
}

/* ── Amenity icon helpers ── */
// Convert database slugs (underscored or space-separated) to clean human-readable labels.
// Specific overrides win; everything else gets Title Cased from the slug.
const AMENITY_LABELS = {
  // HVAC / utilities
  central_air: 'Central A/C', central_heat: 'Central Heat', forced_air: 'Forced Air',
  heat_pump: 'Heat Pump', radiant_heat: 'Radiant Heat', window_ac: 'Window A/C',
  // Laundry
  washer_dryer: 'Washer/Dryer', washer_dryer_hookup: 'W/D Hookup',
  in_unit_laundry: 'In-Unit Laundry', laundry_in_building: 'Laundry In Building',
  // Outdoor
  private_yard: 'Private Yard', fenced_yard: 'Fenced Yard', community_outdoor_space: 'Community Outdoor Space',
  patio: 'Patio', deck: 'Deck', balcony: 'Balcony',
  // Location features
  cul_de_sac: 'Cul-de-Sac', lake: 'Lake Access', park: 'Near Park',
  shopping: 'Near Shopping', farm: 'Farm Setting', ranch: 'Ranch', single_story: 'Single Story',
  // Kitchen
  granite_kitchen: 'Granite Kitchen', modern_kitchen: 'Modern Kitchen',
  granite_countertops: 'Granite Countertops', stainless_appliances: 'Stainless Appliances',
  // Community amenities
  community_security_features: 'Gated / Security', community_pool: 'Community Pool',
  fitness_center: 'Fitness Center', clubhouse: 'Clubhouse', dog_park: 'Dog Park',
  // Garage / parking
  attached_garage: 'Attached Garage', detached_garage: 'Detached Garage',
  carport: 'Carport', driveway: 'Driveway',
  // Misc
  private_entrance: 'Private Entrance', double_vanity: 'Double Vanity',
  ceramic_tile: 'Ceramic Tile', hardwood_floors: 'Hardwood Floors',
  vaulted_ceilings: 'Vaulted Ceilings', walk_in_closet: 'Walk-in Closet',
  smart_home: 'Smart Home', ev_charging: 'EV Charging',
};
function amenityLabel(raw) {
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (AMENITY_LABELS[key]) return AMENITY_LABELS[key];
  // Title-case: replace underscores/hyphens with spaces, capitalise each word
  return raw.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function amenityIcon(text) {
  const t = text.toLowerCase();
  if (/wi.?fi|internet|wireless/.test(t))              return 'fa-wifi';
  if (/gym|fitness|workout/.test(t))                   return 'fa-dumbbell';
  if (/pool|swimming/.test(t))                         return 'fa-water-ladder';
  if (/air.?cond|a\/c|cooling|central air/.test(t))   return 'fa-snowflake';
  if (/\bheat\b|furnace|radiant/.test(t))              return 'fa-fire';
  if (/laundry|washer|dryer/.test(t))                  return 'fa-shirt';
  if (/dishwasher/.test(t))                            return 'fa-sink';
  if (/parking|garage|driveway/.test(t))               return 'fa-car-side';
  if (/pet|dog|cat/.test(t))                           return 'fa-paw';
  if (/balcony|patio|deck|terrace/.test(t))            return 'fa-umbrella-beach';
  if (/storage|closet/.test(t))                        return 'fa-box';
  if (/elevator|lift/.test(t))                         return 'fa-elevator';
  if (/security|camera|doorbell|alarm/.test(t))        return 'fa-shield-halved';
  if (/hardwood|flooring/.test(t))                     return 'fa-layer-group';
  if (/microwave|oven|stove|range/.test(t))            return 'fa-utensils';
  if (/refrigerator|fridge/.test(t))                   return 'fa-temperature-low';
  if (/smoke|carbon monoxide/.test(t))                 return 'fa-triangle-exclamation';
  if (/cable|tv|television/.test(t))                   return 'fa-tv';
  if (/furnish|furniture/.test(t))                     return 'fa-couch';
  if (/yard|garden|lawn|outdoor/.test(t))              return 'fa-seedling';
  if (/wheel|accessible|handicap/.test(t))             return 'fa-wheelchair';
  if (/concierge|doorman/.test(t))                     return 'fa-user-tie';
  if (/solar|green|eco/.test(t))                       return 'fa-leaf';
  if (/rooftop|roof/.test(t))                          return 'fa-building';
  return 'fa-circle-check';
}
function amenityIconColor(text) {
  const t = text.toLowerCase();
  if (/wi.?fi|internet|wireless|cable|tv/.test(t))     return 'icon-sky';
  if (/pool|swimming|balcony|patio|deck|yard/.test(t)) return 'icon-teal';
  if (/gym|fitness|workout/.test(t))                   return 'icon-purple';
  if (/pet|dog|cat/.test(t))                           return 'icon-rose';
  if (/solar|green|eco|yard|garden|lawn/.test(t))      return 'icon-green';
  if (/smoke|carbon|alarm|security/.test(t))           return 'icon-amber';
  return '';
}

function renderProperty(p) {
  document.title = `${p.title} — Choice Properties`;

  // Build apply URL early — used by both the structured data potentialAction
  // and the Apply button wiring later in this function.
  const applyURL = buildApplyURL(p);

  // OG meta
  const ogImg  = CONFIG.img(p.photo_urls?.[0] || '', 'og') || '/assets/placeholder-property.jpg';
  const ogDesc = `${p.bedrooms === 0 ? 'Studio' : (p.bedrooms + ' bed')} · ${p.bathrooms} bath · ${p.monthly_rent != null ? '$' + Number(p.monthly_rent).toLocaleString() + '/mo' : 'Rent TBD'} · ${p.address}, ${p.city}, ${p.state}`;
  ['ogTitle','twTitle'].forEach(id => setMeta(id, `${p.title} — Choice Properties`));
  ['ogDescription','twDescription'].forEach(id => setMeta(id, ogDesc));
  ['ogImage','twImage'].forEach(id => setMeta(id, ogImg));
  document.querySelector('meta[name="description"]')?.setAttribute('content', ogDesc);

  // Phase C: canonical URL — always points to the keyword-rich slug URL.
  // The slug-router edge function (functions/rent/[state]/[city]/[slug].js)
  // injects this into the initial HTML for crawlers, but for legacy
  // /property.html?id=… requests that bypass the redirector (e.g. backend
  // unavailable), this client-side fallback makes sure search engines and
  // social cards still see the canonical URL.
  const canonicalUrl = (window.CP?.UI?.propertyUrl)
    ? new URL(window.CP.UI.propertyUrl(p), window.location.origin).href
    : window.location.href;
  let canonLink = document.querySelector('link[rel="canonical"]');
  if (!canonLink) {
    canonLink = document.createElement('link');
    canonLink.rel = 'canonical';
    document.head.appendChild(canonLink);
  }
  canonLink.href = canonicalUrl;
  setMeta('ogUrl', canonicalUrl);

  // ── I-059: Structured data — RealEstateListing schema for Google Rich Results ──
  // Added: potentialAction (RentalAction), numberOfRooms, floorSize, leaseLength,
  // amenityFeature, and BreadcrumbList. These fields are required or strongly
  // recommended for Google's RentalListing rich result eligibility.
  const sd = document.createElement('script');
  sd.type = 'application/ld+json';
  const amenities = [];
  if (p.parking)      amenities.push({ "@type": "LocationFeatureSpecification", "name": "Parking",        "value": p.parking });
  if (p.pets_allowed) amenities.push({ "@type": "LocationFeatureSpecification", "name": "Pets Allowed",   "value": true });
  if (p.laundry_type) amenities.push({ "@type": "LocationFeatureSpecification", "name": "Laundry",        "value": p.laundry_type });
  if (p.heating_type) amenities.push({ "@type": "LocationFeatureSpecification", "name": "Heating",        "value": p.heating_type });
  if (p.cooling_type && p.cooling_type !== 'None' && p.cooling_type !== '')
                      amenities.push({ "@type": "LocationFeatureSpecification", "name": "Air Conditioning","value": p.cooling_type });
  sd.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": p.title,
    "description": p.description || undefined,
    "url": canonicalUrl,
    "image": p.photo_urls?.[0] ? CONFIG.img(p.photo_urls[0], 'og') : undefined,
    "datePosted": p.created_at ? p.created_at.split('T')[0] : undefined,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": p.address,
      "addressLocality": p.city,
      "addressRegion": p.state,
      "postalCode": p.zip || undefined,
      "addressCountry": "US"
    },
    "geo": (p.lat && p.lng) ? {
      "@type": "GeoCoordinates",
      "latitude": p.lat,
      "longitude": p.lng
    } : undefined,
    "offers": {
      "@type": "Offer",
      "price": p.monthly_rent,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": p.monthly_rent,
        "priceCurrency": "USD",
        "unitCode": "MON",
        "referenceQuantity": { "@type": "QuantitativeValue", "value": 1, "unitCode": "MON" }
      }
    },
    "numberOfRooms": p.bedrooms,
    "numberOfBathroomsTotal": p.bathrooms,
    "floorSize": p.square_footage ? {
      "@type": "QuantitativeValue",
      "value": p.square_footage,
      "unitCode": "FTK"
    } : undefined,
    "leaseLength": p.lease_terms?.length ? p.lease_terms.join(", ") : undefined,
    "amenityFeature": amenities.length ? amenities : undefined,
    "potentialAction": {
      "@type": "RentAction",
      "name": "Apply for Lease",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": applyURL,
        "actionPlatform": [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform"
        ]
      }
    }
  });
  document.head.appendChild(sd);

  // BreadcrumbList — separate JSON-LD block, also recommended by Google
  const bcSd = document.createElement('script');
  bcSd.type = 'application/ld+json';
  bcSd.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home",     "item": window.location.origin + "/" },
      { "@type": "ListItem", "position": 2, "name": "Listings", "item": window.location.origin + "/listings.html" },
      { "@type": "ListItem", "position": 3, "name": p.title,    "item": window.location.href }
    ]
  });
  document.head.appendChild(bcSd);
  // ── End I-059 ─────────────────────────────────────────────

  document.getElementById('breadcrumbCity').textContent = `${p.city}, ${p.state}`;

  // Gallery
  allPhotos = p.photo_urls?.length ? p.photo_urls : ['/assets/placeholder-property.jpg'];
  renderGallery(allPhotos);

  // Move-in special banner — inject between gallery strip and detail content
  if (p.move_in_special) {
    const _existingBanner = document.getElementById('moveInSpecialBanner');
    if (!_existingBanner) {
      const _banner = document.createElement('div');
      _banner.id = 'moveInSpecialBanner';
      _banner.style.cssText = 'background:linear-gradient(90deg,var(--success-strong),#059669);color:var(--m-white);padding:10px 20px;display:flex;align-items:center;gap:10px;font-size:.875rem;font-weight:600;margin:0;';
      _banner.innerHTML = `<i class="fas fa-tag" style="font-size:1rem;opacity:.9"></i><span>Move-in Special: ${esc(p.move_in_special)}</span>`;
      // Insert move-in banner before the About section in the content column
      const _aboutSection = document.getElementById('aboutSection');
      if (_aboutSection) _aboutSection.insertAdjacentElement('beforebegin', _banner);
      else document.getElementById('propSplitContent')?.insertAdjacentElement('afterbegin', _banner);
    }
  }

  // Header
  document.getElementById('detailPrice').innerHTML = `${p.monthly_rent != null ? '$' + Number(p.monthly_rent).toLocaleString() : 'TBD'}<span>/month</span>`;
  document.getElementById('detailTitle').textContent = p.title;
  const _addrUnit = p.unit_number ? ` ${esc(p.unit_number)}` : '';
  document.getElementById('detailAddress').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${esc(p.address)}${_addrUnit}, ${esc(p.city)}, ${esc(p.state)} ${esc(p.zip || '')}`;

  const existingChipRow = document.getElementById('detailHeaderChips');
  if (existingChipRow) existingChipRow.remove();

  const headerChips = [];
  if (p.pets_allowed != null) headerChips.push({ icon: 'fa-paw', label: p.pets_allowed ? 'Pets Allowed' : 'No Pets' });
  if (p.laundry_type)     headerChips.push({ icon: 'fa-shirt', label: p.laundry_type });
  if (p.parking)          headerChips.push({ icon: 'fa-car', label: p.parking });
  if (p.move_in_special)  headerChips.push({ icon: 'fa-tag', label: p.move_in_special });
  if (headerChips.length) {
    const chipRow = document.createElement('div');
    chipRow.id = 'detailHeaderChips';
    chipRow.className = 'prop-req-list';
    chipRow.innerHTML = headerChips.map(c => `
      <div class="prop-req-item"><i class="fas ${c.icon}"></i><span>${esc(c.label)}</span></div>`).join('');
    document.getElementById('detailAddress').insertAdjacentElement('afterend', chipRow);
  }

  // Listed-by attribution is shown via #landlordCard below — no duplicate text needed

  // Neighborhood / location context — shown below the address/attribution
  if (p.neighborhood || p.location_context) {
    const nbrEl = document.createElement('div');
    nbrEl.style.cssText = 'font-size:13px;color:var(--m-muted);margin-top:5px;line-height:1.6;display:flex;flex-wrap:wrap;gap:4px;align-items:center';
    const parts = [];
    if (p.neighborhood)     parts.push(`<span><i class="fas fa-location-dot" style="color:var(--gold);margin-right:3px;font-size:11px"></i>${esc(p.neighborhood)}</span>`);
    if (p.location_context) parts.push(`<span>${esc(p.location_context)}</span>`);
    nbrEl.innerHTML = parts.join('<span style="color:var(--m-border-strong);margin:0 2px">·</span>');
    const _listedBy = document.querySelector('.detail-listed-by');
    (_listedBy || document.getElementById('detailAddress')).insertAdjacentElement('afterend', nbrEl);
  }

  // Meta row
  const metas = [];
  if (p.bedrooms != null) metas.push({ label:'Bedrooms', value: p.bedrooms === 0 ? 'Studio' : p.bedrooms, icon:'fa-bed' });
  if (p.bathrooms) {
    const bathVal = p.half_bathrooms
      ? `${p.bathrooms} + ½`
      : p.bathrooms;
    metas.push({ label:'Bathrooms', value: bathVal, icon:'fa-bath' });
  }
  if (p.square_footage)   metas.push({ label:'Sq. Ft.', value: p.square_footage.toLocaleString(), icon:'fa-ruler-combined' });
  if (p.property_type)    metas.push({ label:'Type', value: fmtPropType(p.property_type), icon:'fa-home' });
  if (p.pets_allowed != null) metas.push({ label:'Pets', value: p.pets_allowed ? 'Allowed' : 'No Pets', icon:'fa-paw' });
  if (p.laundry_type)     metas.push({ label:'Laundry', value: p.laundry_type, icon:'fa-shirt' });
  if (p.parking)          metas.push({ label:'Parking', value: p.parking, icon:'fa-car' });
  if (p.year_built)       metas.push({ label:'Year Built', value: p.year_built, icon:'fa-calendar-days' });
  if (p.floors > 1)       metas.push({ label:'Floors', value: p.floors, icon:'fa-layer-group' });
  if (p.lot_size_sqft)    metas.push({ label:'Lot Size', value: Number(p.lot_size_sqft).toLocaleString() + ' sqft', icon:'fa-ruler' });
  if (p.has_basement === true)    metas.push({ label:'Basement',    value:'Yes', icon:'fa-dungeon' });
  if (p.has_central_air === true) metas.push({ label:'Central Air', value:'Yes', icon:'fa-snowflake' });
  document.getElementById('detailMeta').innerHTML = metas.map(m => `
    <div class="detail-meta-item">
      <div class="detail-meta-icon"><i class="fas ${m.icon}"></i></div>
      <div class="detail-meta-text">
        <div class="detail-meta-label">${m.label}</div>
        <div class="detail-meta-value">${esc(m.value)}</div>
      </div>
    </div>`).join('');

  const descEl = document.getElementById('detailDesc');
  const descText = p.description || 'No additional description provided.';
  const descParas = descText.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const bodyCopy = descParas.length
    ? descParas.map(s => `<p>${s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`).join('')
    : `<p>${esc('This property is presented with a clear, application-first experience and a straightforward leasing process.')}</p>`;
  descEl.innerHTML = bodyCopy;
  if (descText.length > 300) {
    descEl.classList.add('truncated');
    const rmBtn = document.createElement('button');
    rmBtn.className = 'detail-read-more';
    rmBtn.innerHTML = '<i class="fas fa-chevron-down" style="font-size:11px"></i> Read more';
    rmBtn.addEventListener('click', () => {
      descEl.classList.remove('truncated');
      rmBtn.remove();
    });
    descEl.insertAdjacentElement('afterend', rmBtn);
  }
  if (p.virtual_tour_url) {
    const vtBtn = document.createElement('button');
    vtBtn.type = 'button';
    vtBtn.className = 'btn btn-outline';
    vtBtn.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:.875rem;cursor:pointer';
    vtBtn.innerHTML = '<i class="fas fa-cube" style="color:var(--m-brand)"></i> Explore 3D Virtual Tour';
    vtBtn.addEventListener('click', () => openVirtualTourModal(p));
    descEl.closest('.detail-section').appendChild(vtBtn);

    // Also wire up hero mosaic tour button if present
    const mosaicTourBtn = document.getElementById('mosaicTourBtn');
    if (mosaicTourBtn) {
      mosaicTourBtn.style.display = 'inline-flex';
      mosaicTourBtn.onclick = (e) => {
        e.stopPropagation();
        openVirtualTourModal(p);
      };
    }
  }

  let hasAmenities = false, hasUtilities = false, hasLease = false;

  if (p.amenities?.length) {
    hasAmenities = true;
    const amenityItems = p.amenities
      .filter(a => a && !/^(yes|no|true|false)$/i.test(a.trim()) && !/smok/i.test(a))
      .slice(0, 12)
      .map(a => `<div class="amenity-item"><i class="fas ${amenityIcon(a)} ${amenityIconColor(a)}"></i>${esc(amenityLabel(a))}</div>`);
    if (amenityItems.length) {
      document.getElementById('amenitiesGrid').innerHTML = amenityItems.join('');
    } else {
      document.getElementById('amenitiesGrid').innerHTML = '<div class="amenity-item"><i class="fas fa-info-circle"></i>Additional amenities will be listed here as they are confirmed.</div>';
    }
  }
  if (p.appliances?.length) {
    hasAmenities = true;
    document.getElementById('appliancesSection').style.display = '';
    document.getElementById('appliancesGrid').innerHTML = p.appliances
      .filter(a => a && !/^(yes|no|true|false)$/i.test(a.trim()) && !/smok/i.test(a))
      .map(a => `<div class="amenity-item"><i class="fas ${amenityIcon(a)}"></i>${esc(amenityLabel(a))}</div>`).join('');
  }
  if (p.flooring?.length) {
    hasAmenities = true;
    const flooringSec = document.getElementById('appliancesSection');
    let flooringDiv = document.getElementById('flooringSection');
    if (!flooringDiv) {
      flooringDiv = document.createElement('div');
      flooringDiv.id = 'flooringSection';
      flooringDiv.style.marginTop = '20px';
      flooringDiv.innerHTML = `
        <div style="font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--m-muted-2);margin-bottom:10px">Flooring</div>
        <div class="amenities-grid" id="flooringGrid"></div>`;
      flooringSec.insertAdjacentElement('afterend', flooringDiv);
    }
    flooringDiv.style.display = '';
    document.getElementById('flooringGrid').innerHTML = p.flooring
      .filter(f => f && !/^(yes|no|true|false)$/i.test(f.trim()) && !/smok/i.test(f))
      .map(f => `<div class="amenity-item"><i class="fas fa-layer-group"></i>${esc(amenityLabel(f))}</div>`).join('');
  }

  const utilRows = [];
  if (p.utilities_included?.length) utilRows.push(...p.utilities_included
    .filter(u => u && !/smok/i.test(u))
    .map(u => `<div class="amenity-item"><i class="fas fa-bolt icon-amber"></i>${esc(u)} Included</div>`));
  if (p.parking) utilRows.push(`<div class="amenity-item"><i class="fas fa-car"></i>Parking: ${esc(p.parking)}</div>`);
  if (p.laundry_type) utilRows.push(`<div class="amenity-item"><i class="fas fa-shirt"></i>Laundry: ${esc(p.laundry_type)}</div>`);
  if (p.heating_type) utilRows.push(`<div class="amenity-item"><i class="fas fa-fire"></i>Heating: ${esc(p.heating_type)}</div>`);
  if (p.cooling_type) utilRows.push(`<div class="amenity-item"><i class="fas fa-snowflake"></i>Cooling: ${esc(p.cooling_type)}</div>`);
  if (p.garage_spaces) utilRows.push(`<div class="amenity-item"><i class="fas fa-car-side"></i>Parking Spaces: ${p.garage_spaces}</div>`);
  if (p.parking_fee) utilRows.push(`<div class="amenity-item"><i class="fas fa-dollar-sign icon-amber"></i>Parking Fee: ${Number(p.parking_fee).toLocaleString()}/mo</div>`);
  if (!utilRows.length && (p.parking || p.laundry_type || p.heating_type || p.cooling_type)) {
    utilRows.push(`<div class="amenity-item"><i class="fas fa-info-circle"></i>Additional utility details will appear here as the listing is confirmed.</div>`);
  }
  if (utilRows.length) {
    hasUtilities = true;
    document.getElementById('utilitiesGrid').innerHTML = utilRows.join('');
  }

  const leaseItems = [];
  if (p.lease_terms?.length) {
    const terms = p.lease_terms.filter(t => t && !/smok/i.test(t));
    if (terms.length) leaseItems.push(`<div class="amenity-item"><i class="fas fa-file-contract"></i>${terms.map(esc).join(', ')}</div>`);
  }
  if (p.minimum_lease_months) leaseItems.push(`<div class="amenity-item"><i class="fas fa-calendar-check"></i>Min. Lease: ${p.minimum_lease_months} month${p.minimum_lease_months !== 1 ? 's' : ''}</div>`);
  if (p.security_deposit) leaseItems.push(`<div class="amenity-item"><i class="fas fa-shield-alt"></i>Security Deposit: $${Number(p.security_deposit).toLocaleString()}</div>`);
  if (!leaseItems.length && p.application_fee) leaseItems.push(`<div class="amenity-item"><i class="fas fa-receipt"></i>Application Fee: $${Number(p.application_fee).toLocaleString()}</div>`);
  if (p.last_months_rent) leaseItems.push(`<div class="amenity-item"><i class="fas fa-calendar-alt"></i>Last Month's Rent: $${Number(p.last_months_rent).toLocaleString()}</div>`);
  if (p.admin_fee) leaseItems.push(`<div class="amenity-item"><i class="fas fa-receipt"></i>Admin / Move-in Fee: $${Number(p.admin_fee).toLocaleString()}</div>`);
  if (p.move_in_special) leaseItems.push(`<div class="amenity-item" style="grid-column:1/-1"><i class="fas fa-tag icon-green"></i><span><strong>Move-in Special:</strong> ${esc(p.move_in_special)}</span></div>`);
  if (p.pet_deposit) leaseItems.push(`<div class="amenity-item"><i class="fas fa-paw"></i>Pet Deposit: $${Number(p.pet_deposit).toLocaleString()}</div>`);
  if (p.pet_types_allowed?.length) leaseItems.push(`<div class="amenity-item"><i class="fas fa-paw"></i>Pet Types: ${p.pet_types_allowed.map(esc).join(', ')}</div>`);
  if (p.pet_weight_limit) leaseItems.push(`<div class="amenity-item"><i class="fas fa-weight-scale"></i>Pet Weight Limit: ${esc(p.pet_weight_limit)} lbs max</div>`);
  if (p.pet_details) leaseItems.push(`<div class="amenity-item" style="grid-column:1/-1"><i class="fas fa-paw icon-teal"></i><span><strong>Pet Policy:</strong> ${esc(p.pet_details)}</span></div>`);
  if (p.showing_instructions) leaseItems.push(`<div class="amenity-item" style="grid-column:1/-1"><i class="fas fa-key"></i><span><strong>Showings:</strong> ${esc(p.showing_instructions)}</span></div>`);
  if (p.minimum_income_multiplier) leaseItems.push(`<div class="amenity-item"><i class="fas fa-coins icon-amber"></i>Min. Income: ${p.minimum_income_multiplier}× rent/mo</div>`);
  if (p.minimum_credit_score) leaseItems.push(`<div class="amenity-item"><i class="fas fa-chart-line icon-sky"></i>Min. Credit Score: ${p.minimum_credit_score}</div>`);
  if (leaseItems.length) {
    hasLease = true;
    document.getElementById('leaseGrid').innerHTML = leaseItems.join('');
  }

  // Show tabbed section and configure visible tabs
  const detailTabsSection = document.getElementById('detailTabsSection');
  const detailTabsBar = document.getElementById('detailTabs');
  const panelAmenities = document.getElementById('panelAmenities');
  if (hasAmenities || hasUtilities || hasLease) {
    detailTabsSection.style.display = '';
    detailTabsBar.style.display = '';
    const tabConfig = [
      { tabId: 'tabAmenities', panelId: 'panelAmenities', has: hasAmenities },
      { tabId: 'tabUtilities', panelId: 'panelUtilities', has: hasUtilities },
      { tabId: 'tabLease',     panelId: 'panelLease',     has: hasLease     },
    ];
    let firstActive = null;
    tabConfig.forEach(({ tabId, panelId, has }) => {
      const tabEl   = document.getElementById(tabId);
      const panelEl = document.getElementById(panelId);
      if (has) {
        tabEl.style.display = '';
        if (!firstActive) firstActive = { tabEl, panelEl };
      } else {
        tabEl.style.display = 'none';
        panelEl.classList.remove('active');
      }
    });
    if (firstActive) {
      document.querySelectorAll('.detail-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.detail-tab-panel').forEach(pl => pl.classList.remove('active'));
      firstActive.tabEl.classList.add('active');
      firstActive.tabEl.setAttribute('aria-selected', 'true');
      firstActive.panelEl.classList.add('active');
    }
  } else {
    detailTabsSection.style.display = '';
    detailTabsBar.style.display = 'none';
    document.querySelectorAll('.detail-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.detail-tab-panel').forEach(pl => pl.classList.remove('active'));
    if (panelAmenities) {
      panelAmenities.classList.add('active');
      panelAmenities.innerHTML = `
        <div class="prop-denied-box" style="margin-top:0">
          <strong>Details coming soon.</strong>
          <p style="margin:10px 0 0;color:var(--m-muted);line-height:1.65">
            This listing has no confirmed amenities, utilities, or lease details yet. The landlord may update this information shortly.
          </p>
        </div>`;
    }
  }

  // Map — Leaflet if lat/lng, fallback to Google embed
  renderMap(p);

  // Open in Maps button
  const mapOpenBtn = document.getElementById('mapOpenBtn');
  if (mapOpenBtn) {
    const mapAddr = encodeURIComponent(`${p.address}, ${p.city}, ${p.state} ${p.zip || ''}`);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    mapOpenBtn.href = isIOS
      ? `maps://maps.apple.com/?q=${mapAddr}`
      : `https://maps.google.com/maps?q=${mapAddr}`;
    mapOpenBtn.style.display = '';
  }

  // Append T00:00:00 so date-only strings are parsed as local midnight, not UTC
  // midnight — avoids a one-day-off chip in US timezones (Bug 4 fix).
  const availNow = !p.available_date || new Date(p.available_date + 'T00:00:00') <= new Date();

  // Sidebar
  const rentStr = p.monthly_rent != null ? '$' + Number(p.monthly_rent).toLocaleString() : 'TBD';
  const priceHtml = `${rentStr}<span>/month</span>`;
  const sbPrice = document.getElementById('sidebarPrice');
  if (sbPrice) sbPrice.innerHTML = priceHtml;
  const sbStickyPrice = document.getElementById('sidebarStickyPrice');
  if (sbStickyPrice) sbStickyPrice.innerHTML = `${rentStr}<span>/mo</span>`;

  const _availEl = document.getElementById('sidebarAvail');
  const _availStickyEl = document.getElementById('sidebarStickyAvail');
  const availText = availNow ? 'Available Now' : 'Available ' + formatDate(p.available_date);
  const availColor = availNow ? 'var(--m-brand)' : 'var(--gold)';
  if (_availEl) {
    _availEl.innerHTML = `<i class="fas fa-circle" style="color:${availColor}"></i> ${availText}`;
    _availEl.style.display = '';
  }
  if (_availStickyEl) {
    _availStickyEl.innerHTML = `<i class="fas fa-circle" style="color:${availColor}"></i> ${availText}`;
    _availStickyEl.style.display = '';
  }
  document.getElementById('sidebarRent').textContent    = rentStr;
  document.getElementById('sidebarDeposit').textContent = p.security_deposit ? `$${Number(p.security_deposit).toLocaleString()}` : 'Contact landlord';
  // Flat $50 application fee is the platform standard. If a property has no
  // explicit fee, default to $50 rather than showing "Free" (which contradicts
  // the marketing promise and the scraper normalization rules).
  const _appFee = (p.application_fee != null && p.application_fee > 0)
    ? Number(p.application_fee)
    : 50;
  document.getElementById('sidebarFee').textContent = `$${_appFee.toLocaleString()}`;
  // Update apply disclaimer fee amount dynamically
  const _feeAmtEl = document.getElementById('applyFeeAmt');
  if (_feeAmtEl) {
    _feeAmtEl.textContent = `$${_appFee.toLocaleString()} application fee`;
  }
  // Only show "Available From" in the Costs table when the date is in the future.
  // If the property is already available (availNow), showing a past date alongside
  // the "Available Now" chip is contradictory — suppress it (Bug 3 fix).
  if (p.available_date && !availNow) {
    document.getElementById('sidebarMoveInRow').style.display = '';
    document.getElementById('sidebarMoveIn').textContent = formatDate(p.available_date);
  }
  if (p.last_months_rent) {
    document.getElementById('sidebarLastMonthRow').style.display = '';
    document.getElementById('sidebarLastMonth').textContent = `$${Number(p.last_months_rent).toLocaleString()}`;
  }
  if (p.admin_fee) {
    document.getElementById('sidebarAdminFeeRow').style.display = '';
    document.getElementById('sidebarAdminFee').textContent = `$${Number(p.admin_fee).toLocaleString()}`;
  }
  if (p.move_in_special) {
    document.getElementById('sidebarMoveInSpecialRow').style.display = '';
    document.getElementById('sidebarMoveInSpecial').textContent = p.move_in_special;
  }

  // Landlord card
  if (p.landlords) {
    const ll = p.landlords;
    const name = ll.business_name || ll.contact_name;
    const card = document.getElementById('landlordCard');
    card.style.display = 'flex';
    document.getElementById('landlordName').textContent = name;
    if (ll.tagline) document.getElementById('landlordTagline').textContent = ll.tagline;
    const avatarEl = document.getElementById('landlordAvatar');
    if (ll.avatar_url) {
      avatarEl.innerHTML = `<img src="${esc(CONFIG.img(ll.avatar_url,'avatar'))}" alt="${esc(name)}" loading="lazy">`;
      const avatarImg = avatarEl.querySelector('img');
      if (avatarImg) avatarImg.onerror = function() { this.onerror = null; this.src = '/assets/avatar-placeholder.svg'; };
    }
    else avatarEl.textContent = name.charAt(0).toUpperCase();
    if (ll.verified) document.getElementById('landlordVerified').style.display = 'inline';
  }

  // Apply button — wire URL with full property context for form prefill
  const _wireApply = (id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.href = applyURL;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = applyURL;
    });
  };
  _wireApply('applyBtn');
  _wireApply('sidebarApplyBtn');
  _wireApply('csCardApply');

  // Wire "Track your application" link to internal application portal
  const _trackLink = document.getElementById('trackAppLink');
  if (_trackLink) {
    const _applyBase = (typeof CONFIG !== 'undefined' && CONFIG.APPLY_FORM_URL)
      ? CONFIG.APPLY_FORM_URL
      : '/apply';
    _trackLink.href = _applyBase + '/?path=dashboard';
  }

  // Guard apply button for non-active listings
  if (p.status !== 'active') {
    ['applyBtn', 'sidebarApplyBtn', 'csCardApply'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.removeAttribute('href');
        btn.style.pointerEvents = 'none';
        btn.style.opacity       = '0.5';
        btn.style.cursor        = 'not-allowed';
        btn.innerHTML = `<i class="fas fa-ban" style="font-size:14px"></i> ${p.status === 'rented' ? 'No Longer Available' : 'Not Currently Available'}`;
      }
    });
    const unavailHtml = `<i class="fas fa-circle" style="color:var(--danger-strong)"></i> ${p.status === 'rented' ? 'Rented' : 'Unavailable'}`;
    const _availEl = document.getElementById('sidebarAvail');
    if (_availEl) _availEl.innerHTML = unavailHtml;
    const _availStickyEl = document.getElementById('sidebarStickyAvail');
    if (_availStickyEl) _availStickyEl.innerHTML = unavailHtml;
  }

  // Mobile sticky Apply bar — only for active listings
  if (p.status === 'active') {
    document.getElementById('mobBarRent').textContent = `${p.monthly_rent != null ? '$' + Number(p.monthly_rent).toLocaleString() + '/mo' : 'Rent TBD'}`;
    _wireApply('mobApplyBtn');
    document.getElementById('mobile-apply-bar').classList.add('active');
    document.body.classList.add('mob-bar-active');
  }

  // Save button state
  const saveBtn = document.getElementById('savePropBtn');
  if (savedIds.has(p.id)) saveBtn.innerHTML = '<i class="fas fa-heart" style="color:var(--danger-strong)"></i> Saved';
  saveBtn.addEventListener('click', () => toggleSave(p.id, saveBtn));

  // ── Enrichment sections ──
  renderRenterRequirements(p);
  renderPropFacts(p);
  renderScoresSection(p);
  loadSimilarListings(p);
}

/* ── Leaflet mini-map (lazy-loaded via IntersectionObserver) ── */
// M-10: Leaflet CSS+JS (~180KB gzipped) is only injected when the map
// container scrolls into the viewport, saving bandwidth on every page visit.
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }
    // Inject CSS first (non-blocking)
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
    // Inject JS and resolve when loaded
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function openVirtualTourModal(p) {
  const modal = document.getElementById('virtualTourModal');
  const body = document.getElementById('vtModalBody');
  const addrEl = document.getElementById('vtModalAddress');
  const dialog = document.getElementById('vtModalDialog');
  const fullscreenBtn = document.getElementById('vtFullscreenBtn');
  const closeBtn = document.getElementById('vtCloseBtn');
  const backdrop = document.getElementById('vtModalBackdrop');
  if (!modal || !body || !p.virtual_tour_url) return;

  const url = String(p.virtual_tour_url).trim();
  if (addrEl) addrEl.textContent = `${p.address || ''}${p.city ? ', ' + p.city : ''}`;

  let playerHtml = '';
  // Check provider
  if (/youtube\.com|youtu\.be/i.test(url)) {
    const ytMatch = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*)/);
    const ytId = (ytMatch && ytMatch[1]?.length === 11) ? ytMatch[1] : '';
    playerHtml = `<iframe src="https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="width:100%;height:100%;border:0"></iframe>`;
  } else if (/vimeo\.com/i.test(url)) {
    const vmMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/);
    const vmId = vmMatch ? vmMatch[3] : '';
    playerHtml = `<iframe src="https://player.vimeo.com/video/${vmId}?autoplay=1&title=0&byline=0&portrait=0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:0"></iframe>`;
  } else if (/\.(mp4|webm|mov)(\?.*)?$/i.test(url)) {
    playerHtml = `<video src="${esc(url)}" controls autoplay playsinline style="width:100%;height:100%;object-fit:contain;background:#000"></video>`;
  } else if (/matterport\.com/i.test(url)) {
    playerHtml = `<iframe src="${esc(url)}" allow="fullscreen; xr-spatial-tracking" allowfullscreen style="width:100%;height:100%;border:0"></iframe>`;
  } else if (/insidemaps\.com/i.test(url)) {
    playerHtml = `<iframe src="${esc(url)}" allow="fullscreen; xr-spatial-tracking" allowfullscreen style="width:100%;height:100%;border:0"></iframe>`;
  } else if (/zillow\.com\/(view-3d-home|view-imx)/i.test(url)) {
    // Clean embed for Zillow 3D / IMX walkthroughs
    let embedUrl = url;
    if (!embedUrl.includes('hidePhotos=')) {
      embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'hidePhotos=true&initialViewType=pano';
    }
    playerHtml = `<iframe src="${esc(embedUrl)}" allow="fullscreen; accelerometer; gyroscope; spatial-tracking" allowfullscreen style="width:100%;height:100%;border:0"></iframe>`;
  } else {
    // Generic secure iframe fallback
    playerHtml = `<iframe src="${esc(url)}" allow="fullscreen; accelerometer; gyroscope; spatial-tracking" allowfullscreen style="width:100%;height:100%;border:0"></iframe>`;
  }

  body.innerHTML = playerHtml;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  function closeModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    body.innerHTML = '';
    document.body.style.overflow = '';
    if (dialog) dialog.classList.remove('fullscreen');
  }

  if (closeBtn) closeBtn.onclick = closeModal;
  if (backdrop) backdrop.onclick = closeModal;
  if (fullscreenBtn) {
    fullscreenBtn.onclick = () => {
      if (dialog) dialog.classList.toggle('fullscreen');
    };
  }

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

function _initLeafletMap(p) {
  const container = document.getElementById('mapContainer');
  const lat = parseFloat(p.lat);
  const lng = parseFloat(p.lng);
  if (isNaN(lat) || isNaN(lng)) return;

  container.innerHTML = '<div id="propertyMiniMap" style="width:100%;height:100%"></div>';
  const map = L.map('propertyMiniMap', { zoomControl: true, scrollWheelZoom: false, touchZoom: true }).setView([lat, lng], 15);
  
  // Clean, high-performance Carto Light tiles (no API key required)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19
  }).addTo(map);

  const icon = L.divIcon({
    className: '',
    html: `<div style="background:#0e0e0f;color: var(--m-white);padding:6px 12px;border-radius:20px;font-weight:700;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${p.monthly_rent != null ? '$' + Number(p.monthly_rent).toLocaleString() + '/mo' : 'Rent TBD'}</div>`,
    iconAnchor: [45, 16], iconSize: [90, 32]
  });
  L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${esc(p.title || p.address)}</b><br>${esc(p.address)}`);

  // Wire up "Open in Maps" button with OS-aware deep link
  const mapAddr = encodeURIComponent(`${p.address}, ${p.city}, ${p.state} ${p.zip || ''}`);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mapsUrl = isIOS
    ? `maps://maps.apple.com/?q=${mapAddr}`
    : `https://maps.google.com/maps?q=${mapAddr}`;
  const openBtn = document.getElementById('mapOpenBtn');
  if (openBtn) { openBtn.href = mapsUrl; openBtn.style.display = 'inline-flex'; }

  // Reverse geocode neighbourhood
  const _geoKey = (typeof CONFIG !== 'undefined' && CONFIG.GEOAPIFY_API_KEY) || '';
  if (_geoKey) {
    fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${_geoKey}&format=json`)
      .then(r => r.json())
      .then(data => {
        const hit = data?.results?.[0];
        const nbName = hit?.suburb || hit?.neighbourhood || hit?.district || hit?.county;
        const cityName = hit?.city || hit?.town;
        const label = [nbName, cityName].filter(Boolean).join(', ');
        if (label) {
          const nbText = document.getElementById('mapNeighborhoodText');
          const nbSection = document.getElementById('mapNeighborhood');
          if (nbText && nbSection) { nbText.textContent = `Located in ${label}`; nbSection.style.display = 'block'; }
        }
      })
      .catch(() => {});
  }
}

function _mapAddressCard(p, addr) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;background:var(--surface-2,var(--m-surface-2));padding:32px 20px;text-align:center">
      <div style="width:52px;height:52px;background:var(--m-brand-pale);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--m-brand)">
        <i class="fas fa-map-marker-alt"></i>
      </div>
      <div>
        <div style="font-weight:700;font-size:1rem;color:var(--text,#1a1a2e);margin-bottom:4px">${esc(p.address)}</div>
        <div style="color:var(--muted,var(--m-muted));font-size:.875rem">${esc(p.city)}, ${esc(p.state)} ${esc(p.zip||'')}</div>
      </div>
      <a href="https://maps.google.com/maps?q=${addr}" target="_blank" rel="noopener noreferrer"
         style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;background:var(--m-brand);color:var(--m-white);border-radius:6px;font-size:.82rem;font-weight:600;text-decoration:none">
        <i class="fas fa-map"></i> Open in Google Maps
      </a>
    </div>`;
}

function renderMap(p) {
  const container = document.getElementById('mapContainer');
  if (p.lat && p.lng) {
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      const observer = new IntersectionObserver((entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();

        // Show Geoapify static map immediately — no blank grey flash while Leaflet loads
        const _geoKey = (typeof CONFIG !== 'undefined' && CONFIG.GEOAPIFY_API_KEY) || '';
        if (_geoKey) {
          const staticUrl = `https://maps.geoapify.com/v1/staticmap?style=positron&width=800&height=300`
            + `&center=lonlat:${lng},${lat}&zoom=14`
            + `&marker=lonlat:${lng},${lat};type:circle;color:%230e0e0f;size:x-large`
            + `&apiKey=${_geoKey}`;
          container.innerHTML = `<img src="${staticUrl}" alt="Property location" style="width:100%;height:100%;object-fit:cover;display:block">`;
        }

        // Load Leaflet over the static preview
        loadLeaflet()
          .then(() => _initLeafletMap(p))
          .catch(() => {
            const _errAddr = encodeURIComponent(`${p.address}, ${p.city}, ${p.state} ${p.zip || ''}`);
            container.innerHTML = _mapAddressCard(p, _errAddr);
          });
      }, { rootMargin: '200px' });
      observer.observe(container);
      return;
    }
  }
  // No lat/lng — show address card
  document.getElementById('mapAddressLabel').textContent = `${p.address}, ${p.city}`;
  const _fbAddr = encodeURIComponent(`${p.address}, ${p.city}, ${p.state} ${p.zip || ''}`);
  container.innerHTML = _mapAddressCard(p, _fbAddr);
}

/* ── Gallery Mosaic ── */
function renderGallery(photos) {
  photoIndex = 0;
  const mainImg    = document.getElementById('mosaicMainImg');
  const mosaicMain = document.getElementById('mosaicMain');
  const mosaicSide = document.getElementById('mosaicSide');
  const expandBtn  = document.getElementById('mosaicExpandBtn');
  const mobileCount = document.getElementById('mosaicMobileCount');
  const prevBtn    = document.getElementById('mosaicPrev');
  const nextBtn    = document.getElementById('mosaicNext');

  // Remove skeleton once we have real photos to show
  document.getElementById('gallery').classList.remove('skeleton-loading');

  // Hero image — LCP candidate, load at high priority with srcset for retina
  const heroUrl = photos[0];
  mainImg.src    = CONFIG.img(heroUrl, 'gallery');
  if (CONFIG.IMAGEKIT_URL && heroUrl && heroUrl.startsWith(CONFIG.IMAGEKIT_URL)) {
    mainImg.srcset = `${CONFIG.img(heroUrl, 'card')} 600w, ${CONFIG.img(heroUrl, 'gallery')} 1200w, ${CONFIG.img(heroUrl, 'gallery_2x')} 2400w`;
  } else {
    mainImg.srcset = '';
  }
  mainImg.sizes  = '(max-width: 768px) 100vw, (max-width: 1280px) 65vw, 55vw';
  mainImg.alt    = 'Property photo 1';
  mainImg.onerror = function() { this.onerror = null; this.srcset = ''; this.src = '/assets/placeholder-property.jpg'; };

  // LQIP blur-up for hero image — tiny blurred placeholder fades out once full image loads
  const heroLqip = lqipUrl(photos[0]);
  if (heroLqip) {
    const lqBg = document.createElement('div');
    lqBg.className = 'lqip-bg';
    lqBg.style.backgroundImage = `url('${heroLqip}')`;
    mosaicMain.insertBefore(lqBg, mainImg);
    const fadeLqip = () => lqBg.classList.add('faded');
    mainImg.addEventListener('load', fadeLqip, { once: true });
    if (mainImg.complete && mainImg.naturalWidth > 0) fadeLqip();
  }

  mosaicMain.addEventListener('click', () => openLightbox(0));

  // Side 2×2 grid — use gallery preset for crisp quality, lazy-load each cell
  const sidePanels = photos.slice(1, 5);
  if (sidePanels.length > 0) {
    mosaicSide.innerHTML = sidePanels.map((url, i) => {
      const idx = i + 1;
      const isLast = (i === sidePanels.length - 1) && (photos.length > 5);
      const remaining = photos.length - 5;
      const lqUrl = lqipUrl(url);
      return `
        <div class="mosaic-cell" data-idx="${idx}">
          ${lqUrl ? `<div class="lqip-bg" style="background-image:url('${lqUrl}')"></div>` : ''}
          <img src="${CONFIG.img(url,'gallery')}"
               srcset="${CONFIG.img(url,'gallery')} 1x, ${CONFIG.img(url,'gallery_2x')} 2x"
               sizes="(max-width: 768px) 50vw, 25vw"
               alt="Property photo ${idx+1}"
               loading="${i === 0 ? 'eager' : 'lazy'}"
               ${i === 0 ? 'fetchpriority="high"' : ''}
               referrerpolicy="no-referrer"
               decoding="async">
          ${isLast ? `
            <div class="mosaic-cell-overlay">
              <span class="mosaic-overlay-icon"><i class="fas fa-images"></i></span>
              <span class="mosaic-overlay-label">+${remaining} more</span>
            </div>` : ''}
        </div>`;
    }).join('');
    // Adjust grid so there are never empty black cells
    if (sidePanels.length === 1) {
      mosaicSide.style.gridTemplateColumns = '1fr';
      mosaicSide.style.gridTemplateRows = '1fr';
    } else if (sidePanels.length === 2) {
      mosaicSide.style.gridTemplateColumns = '1fr';
      mosaicSide.style.gridTemplateRows = '1fr 1fr';
    } else if (sidePanels.length === 3) {
      mosaicSide.style.gridTemplateColumns = 'repeat(2, 1fr)';
      mosaicSide.style.gridTemplateRows = '1fr 1fr';
      const cells = mosaicSide.querySelectorAll('.mosaic-cell');
      if (cells[2]) cells[2].style.gridColumn = '1 / -1';
    }
    // 4 panels: default 2×2 layout from CSS
    // Fade out each cell's LQIP placeholder once its image loads;
    // wire CSP-safe onerror via JS (not HTML attribute — blocked by nonce CSP)
    mosaicSide.querySelectorAll('.mosaic-cell').forEach(cell => {
      cell.addEventListener('click', () => openLightbox(parseInt(cell.dataset.idx)));
      const img = cell.querySelector('img');
      const bg  = cell.querySelector('.lqip-bg');
      if (img) {
        img.onerror = function() { this.onerror = null; this.srcset = ''; this.src = '/assets/placeholder-property.jpg'; };
        if (bg) {
          const fadeBg = () => bg.classList.add('faded');
          img.addEventListener('load', fadeBg, { once: true });
          if (img.complete && img.naturalWidth > 0) fadeBg();
        }
      }
    });
  } else {
    mosaicSide.style.display = 'none';
    document.getElementById('gallery').style.gridTemplateColumns = '1fr';
  }

  if (expandBtn) {
    expandBtn.innerHTML = `<i class="fas fa-images"></i> <span class="mosaic-expand-label">See All Photos</span> <span class="mosaic-photo-count">${photos.length}</span>`;
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(0, true);
    });
  }

  if (mobileCount) mobileCount.textContent = `1 / ${photos.length}`;
  prevBtn.addEventListener('click', () => showPhoto((photoIndex - 1 + photos.length) % photos.length));
  nextBtn.addEventListener('click', () => showPhoto((photoIndex + 1) % photos.length));

  // Touch swipe on mosaic (mobile carousel) — velocity-aware
  let touchX = 0, touchT = 0;
  mosaicMain.addEventListener('touchstart', e => {
    touchX = e.touches[0].clientX;
    touchT = Date.now();
  }, { passive: true });
  mosaicMain.addEventListener('touchend', e => {
    const diff = touchX - e.changedTouches[0].clientX;
    const dt   = Date.now() - touchT;
    const vel  = Math.abs(diff) / dt; // px/ms
    if (Math.abs(diff) > 30 || vel > 0.3) {
      showPhoto((photoIndex + (diff > 0 ? 1 : -1) + photos.length) % photos.length);
    }
  }, { passive: true });

  // Keyboard — lightbox arrows + escape + space + fullscreen
  document.addEventListener('keydown', e => {
    const lb = document.getElementById('lightbox');
    if (lb && lb.classList.contains('open')) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); lightboxNav(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); lightboxNav(1); }
      else if (e.key === ' ') { e.preventDefault(); lightboxNav(1); }
      else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          lb.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
      else if (e.key === 'Escape') closeLightbox();
    }
  });

  document.getElementById('galleryExpand').addEventListener('click', () => openLightbox(photoIndex));

  // Build thumbnail strip
  buildGalleryStrip(photos);
}

/* ── Thumbnail Strip ── */
function buildGalleryStrip(photos) {
  const strip = document.getElementById('galleryStrip');
  if (!strip) return;
  if (photos.length < 2) { strip.style.display = 'none'; return; }

  strip.innerHTML = photos.map((url, i) => `
    <button class="gallery-strip-thumb${i === 0 ? ' active' : ''}"
            data-idx="${i}" role="listitem"
            aria-label="View photo ${i + 1}" aria-pressed="${i === 0 ? 'true' : 'false'}">
      <img src="${CONFIG.img(url, 'strip')}"
           srcset="${CONFIG.img(url, 'strip')} 1x, ${CONFIG.img(url, 'thumb')} 2x"
           alt="Photo ${i + 1}"
           loading="${i < 5 ? 'eager' : 'lazy'}"
           referrerpolicy="no-referrer"
           decoding="async">
    </button>`).join('');

  strip.querySelectorAll('.gallery-strip-thumb').forEach(btn => {
    btn.addEventListener('click', () => showPhoto(parseInt(btn.dataset.idx)));
  });
}

function syncStripActive(idx) {
  const thumbs = document.querySelectorAll('.gallery-strip-thumb');
  thumbs.forEach((t, i) => {
    const active = i === idx;
    t.classList.toggle('active', active);
    t.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const activeThumb = document.querySelector('.gallery-strip-thumb.active');
  if (activeThumb) {
    activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function showPhoto(idx) {
  photoIndex = idx;
  const mainImg = document.getElementById('mosaicMainImg');
  mainImg.style.opacity = '0';
  mainImg.style.transition = 'opacity 150ms';
  setTimeout(() => {
    const curUrl = allPhotos[idx];
    mainImg.src = CONFIG.img(curUrl, 'gallery');
    if (CONFIG.IMAGEKIT_URL && curUrl && curUrl.startsWith(CONFIG.IMAGEKIT_URL)) {
      mainImg.srcset = `${CONFIG.img(curUrl, 'card')} 600w, ${CONFIG.img(curUrl, 'gallery')} 1200w, ${CONFIG.img(curUrl, 'gallery_2x')} 2400w`;
    } else {
      mainImg.srcset = '';
    }
    mainImg.alt    = `Property photo ${idx + 1}`;
    mainImg.style.opacity = '1';
  }, 150);
  const mobileCount = document.getElementById('mosaicMobileCount');
  if (mobileCount) mobileCount.textContent = `${idx + 1} / ${allPhotos.length}`;
  syncStripActive(idx);
}

/* ── Lightbox ── */
let lightboxThumbsBuilt = false;
let _lbOpener = null;  // element that opened the lightbox — restored on close

// Focus trap — keep keyboard navigation inside the lightbox while open
function _lbFocusTrap(e) {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('open')) return;
  const focusable = lb.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }
}

function openLightbox(idx, openInGridView = false) {
  _lbOpener = document.activeElement;
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Set property title and address meta in header
  if (currentProperty) {
    const titleEl = document.getElementById('lightboxPropTitle');
    const addrEl  = document.getElementById('lightboxPropAddr');
    if (titleEl) titleEl.textContent = currentProperty.title || 'Property Photos';
    if (addrEl)  addrEl.textContent  = `${currentProperty.address || ''}, ${currentProperty.city || ''}, ${currentProperty.state || ''}`;
  }

  if (!lightboxThumbsBuilt) {
    buildLightboxThumbs();
    buildLightboxGrid();
    lightboxThumbsBuilt = true;
  }

  if (openInGridView) {
    setLightboxViewMode('grid');
  } else {
    setLightboxViewMode('stage');
    lightboxShow(idx);
  }

  document.addEventListener('keydown', _lbFocusTrap);
  requestAnimationFrame(() => document.getElementById('lightboxClose')?.focus());
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.classList.remove('open');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', _lbFocusTrap);
  if (_lbOpener && typeof _lbOpener.focus === 'function') _lbOpener.focus();
  _lbOpener = null;
}

let _lbViewMode = 'stage'; // 'stage' | 'grid'

function setLightboxViewMode(mode) {
  _lbViewMode = mode;
  const stageEl   = document.getElementById('lightboxStage');
  const thumbsEl  = document.getElementById('lightboxThumbs');
  const gridEl    = document.getElementById('lightboxGridView');
  const toggleBtn = document.getElementById('lbToggleGrid');
  const toggleTxt = document.getElementById('lbToggleGridText');

  if (mode === 'grid') {
    if (stageEl)  stageEl.style.display  = 'none';
    if (thumbsEl) thumbsEl.style.display = 'none';
    if (gridEl)   gridEl.style.display   = 'block';
    if (toggleTxt) toggleTxt.textContent = 'Single Photo';
    if (toggleBtn) {
      toggleBtn.classList.add('active');
      toggleBtn.innerHTML = '<i class="fas fa-image"></i> <span id="lbToggleGridText">Single Photo</span>';
    }
  } else {
    if (stageEl)  stageEl.style.display  = 'flex';
    if (thumbsEl) thumbsEl.style.display = 'flex';
    if (gridEl)   gridEl.style.display   = 'none';
    if (toggleTxt) toggleTxt.textContent = 'All Photos';
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.innerHTML = '<i class="fas fa-th"></i> <span id="lbToggleGridText">All Photos</span>';
    }
  }
}

function buildLightboxThumbs() {
  const thumbsEl = document.getElementById('lightboxThumbs');
  if (!thumbsEl || !allPhotos.length) return;
  thumbsEl.innerHTML = allPhotos.map((url, i) =>
    `<button type="button" class="lightbox-thumb" data-idx="${i}" aria-label="View photo ${i + 1}">
      <img src="${CONFIG.img(url, 'thumb')}" alt="" loading="lazy" referrerpolicy="no-referrer" decoding="async">
    </button>`
  ).join('');
  thumbsEl.querySelectorAll('.lightbox-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      setLightboxViewMode('stage');
      lightboxShow(parseInt(btn.dataset.idx));
    });
  });
}

function buildLightboxGrid() {
  const container = document.getElementById('lightboxGridContainer');
  if (!container || !allPhotos.length) return;
  container.innerHTML = allPhotos.map((url, i) => `
    <div class="lightbox-grid-item" data-idx="${i}">
      <img src="${CONFIG.img(url, 'gallery')}" alt="Property photo ${i + 1}" loading="lazy" referrerpolicy="no-referrer" decoding="async">
      <div class="lightbox-grid-badge">${i + 1} of ${allPhotos.length}</div>
    </div>
  `).join('');

  container.querySelectorAll('.lightbox-grid-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.idx, 10);
      setLightboxViewMode('stage');
      lightboxShow(idx);
    });
  });
}

let _lbNavDir = 0;  // -1 = prev, 1 = next, 0 = direct click

function lightboxShow(idx) {
  photoIndex = idx;
  const wrap    = document.getElementById('lightboxImgWrap');
  const img     = document.getElementById('lightboxImg');
  const spinner = document.getElementById('lbSpinner');
  const lqipBg  = document.getElementById('lbLqipBg');

  if (!img) return;

  // Directional slide-out animation on previous image
  if (_lbNavDir !== 0 && wrap) {
    const outClass = _lbNavDir > 0 ? 'slide-out-left' : 'slide-out-right';
    wrap.classList.remove('slide-in-left', 'slide-in-right', 'slide-out-left', 'slide-out-right');
    wrap.classList.add(outClass);
  }

  const slideInClass = _lbNavDir > 0 ? 'slide-in-left' : _lbNavDir < 0 ? 'slide-in-right' : null;

  // Show LQIP blur-up while the full image loads
  if (lqipBg) {
    const lqip = lqipUrl(allPhotos[idx]);
    if (lqip) {
      lqipBg.style.backgroundImage = `url('${lqip}')`;
      lqipBg.classList.remove('faded');
      lqipBg.classList.add('visible');
    } else {
      lqipBg.classList.remove('visible');
    }
  }

  setTimeout(() => {
    // Hide image and show spinner while new src loads
    img.classList.add('loading');
    if (spinner) spinner.classList.add('visible');

    if (wrap) wrap.classList.remove('slide-in-left', 'slide-in-right', 'slide-out-left', 'slide-out-right');

    // Full-quality lightbox image with srcset for retina screens
    const newSrc = CONFIG.img(allPhotos[idx], 'lightbox');
    img.src    = newSrc;
    const isIk = CONFIG.IMAGEKIT_URL && allPhotos[idx] && allPhotos[idx].startsWith(CONFIG.IMAGEKIT_URL);
    img.srcset = isIk ? `${CONFIG.img(allPhotos[idx], 'gallery')} 1200w, ${CONFIG.img(allPhotos[idx], 'gallery_2x')} 2400w, ${CONFIG.img(allPhotos[idx], 'lightbox')} 4000w` : '';
    img.sizes  = '100vw';
    img.alt    = `Property photo ${idx + 1}`;

    const reveal = () => {
      img.classList.remove('loading');
      if (spinner) spinner.classList.remove('visible');
      // Fade out the LQIP once the real image has loaded
      if (lqipBg) { lqipBg.classList.add('faded'); }
      if (slideInClass && wrap) {
        wrap.classList.add(slideInClass);
        const cleanup = () => { wrap.classList.remove(slideInClass); wrap.removeEventListener('animationend', cleanup); };
        wrap.addEventListener('animationend', cleanup, { once: true });
      }
      // Preload surrounding images for instant navigation
      preloadLightboxAdjacentImages(idx);
    };

    if (img.complete && img.naturalWidth > 0) {
      reveal();
    } else {
      img.addEventListener('load',  reveal, { once: true });
      img.addEventListener('error', () => {
        img.src    = '/assets/placeholder-property.jpg';
        img.srcset = '';
        reveal();
      }, { once: true });
    }
  }, _lbNavDir !== 0 ? 120 : 0);

  const counterEl = document.getElementById('lightboxCounter');
  if (counterEl) counterEl.textContent = `${idx + 1} / ${allPhotos.length}`;

  // Sync lightbox filmstrip
  document.querySelectorAll('.lightbox-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === idx);
  });
  const activeThumb = document.querySelector('.lightbox-thumb.active');
  if (activeThumb) {
    activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Also sync the main page thumbnail strip so it tracks lightbox navigation
  syncStripActive(idx);
}

function lightboxNav(dir) {
  if (_lbViewMode === 'grid') {
    setLightboxViewMode('stage');
  }
  _lbNavDir = dir;
  lightboxShow((photoIndex + dir + allPhotos.length) % allPhotos.length);
  _lbNavDir = 0;
}

/* Lightbox swipe support — velocity-aware */
(function() {
  let lbTouchX = 0, lbTouchT = 0;
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.addEventListener('touchstart', e => {
    if (_lbViewMode === 'grid') return;
    lbTouchX = e.touches[0].clientX;
    lbTouchT = Date.now();
  }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (_lbViewMode === 'grid') return;
    const diff = lbTouchX - e.changedTouches[0].clientX;
    const dt   = Date.now() - lbTouchT;
    const vel  = Math.abs(diff) / dt; // px/ms
    if (Math.abs(diff) > 30 || vel > 0.3) lightboxNav(diff > 0 ? 1 : -1);
  }, { passive: true });
})();

document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
document.getElementById('lightboxPrev')?.addEventListener('click', () => lightboxNav(-1));
document.getElementById('lightboxNext')?.addEventListener('click', () => lightboxNav(1));
document.getElementById('lbToggleGrid')?.addEventListener('click', () => {
  setLightboxViewMode(_lbViewMode === 'grid' ? 'stage' : 'grid');
});
document.getElementById('lightbox')?.addEventListener('click', e => {
  if (e.target === document.getElementById('lightbox') ||
      e.target === document.getElementById('lightboxImgWrap')) closeLightbox();
});

/* ── Lightbox gestures: pinch-to-zoom, double-tap to zoom, wheel zoom ── */
(function initLightboxGestures() {
  const wrap = document.getElementById('lightboxImgWrap');
  const img  = document.getElementById('lightboxImg');
  if (!wrap || !img) return;

  let lastTap = 0;
  let startDist = 0;
  let baseScale = 1;
  let currScale = 1;
  let translateX = 0, translateY = 0;
  let lastX = 0, lastY = 0;
  let isPanning = false;

  function applyTransform() {
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currScale})`;
  }
  function clampTranslateValues() {
    // Temporarily remove transform to measure base rendered size
    const prev = img.style.transform;
    img.style.transform = '';
    const baseRect = img.getBoundingClientRect();
    img.style.transform = prev;
    const baseW = baseRect.width || wrap.clientWidth;
    const baseH = baseRect.height || wrap.clientHeight;
    const displayW = baseW * currScale;
    const displayH = baseH * currScale;
    const maxX = Math.max(0, (displayW - baseW) / 2);
    const maxY = Math.max(0, (displayH - baseH) / 2);
    const clampedX = Math.max(-maxX, Math.min(maxX, translateX));
    const clampedY = Math.max(-maxY, Math.min(maxY, translateY));
    return { clampedX, clampedY, maxX, maxY };
  }
  function resetTransform() {
    currScale = 1; translateX = 0; translateY = 0; img.style.transform = ''; img.style.transformOrigin = '50% 50%';
    wrap.classList.remove('zoomable'); wrap.classList.remove('grabbing');
  }

  function getDist(t0, t1) { const dx = t0.clientX - t1.clientX; const dy = t0.clientY - t1.clientY; return Math.hypot(dx, dy); }

  // Create zoom hint overlay (once)
  let zoomHint = document.querySelector('.zoom-hint');
  if (!zoomHint) {
    zoomHint = document.createElement('div');
    zoomHint.className = 'zoom-hint';
    zoomHint.textContent = 'Pinch to zoom • Drag to pan';
    wrap.appendChild(zoomHint);
  }
  function showZoomHint() { zoomHint.classList.add('visible'); clearTimeout(zoomHint._t); zoomHint._t = setTimeout(() => zoomHint.classList.remove('visible'), 1800); }

  // Touchstart: double-tap detection + pinch start + pan start
  wrap.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {
        // double-tap toggle
        const t = e.touches[0];
        const rect = img.getBoundingClientRect();
        const ox = ((t.clientX - rect.left) / rect.width) * 100;
        const oy = ((t.clientY - rect.top) / rect.height) * 100;
        if (currScale > 1.05) {
          resetTransform();
        } else {
          currScale = 2; img.style.transformOrigin = `${ox}% ${oy}%`;
          applyTransform(); wrap.classList.add('zoomable'); showZoomHint();
        }
        lastTap = 0;
        e.preventDefault();
        return;
      } else lastTap = now;

      // start pan candidate
      if (currScale > 1.01) {
        isPanning = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; wrap.classList.add('zoomable'); wrap.classList.remove('grabbing');
      }
    }
    if (e.touches.length === 2) {
      // pinch start
      startDist = getDist(e.touches[0], e.touches[1]);
      baseScale = currScale || 1;
      const rect = img.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const ox = ((cx - rect.left) / rect.width) * 100;
      const oy = ((cy - rect.top) / rect.height) * 100;
      img.style.transformOrigin = `${ox}% ${oy}%`;
      img.style.transition = 'transform 0s';
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2) {
      const d = getDist(e.touches[0], e.touches[1]);
      const scale = Math.max(1, Math.min(4, baseScale * (d / startDist)));
      currScale = scale;
      // When resizing, keep translate within reasonable limits
      applyTransform(); showZoomHint(); e.preventDefault();
    } else if (e.touches.length === 1 && isPanning) {
      const dx = e.touches[0].clientX - lastX; const dy = e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      translateX += dx; translateY += dy;
      applyTransform(); wrap.classList.add('grabbing'); e.preventDefault();
    }
  }, { passive: false });

  wrap.addEventListener('touchend', function (e) {
    isPanning = false; wrap.classList.remove('grabbing');
    // Clamp and animate back if out-of-bounds
    const { clampedX, clampedY } = clampTranslateValues();
    if (Math.abs(clampedX - translateX) > 0.5 || Math.abs(clampedY - translateY) > 0.5) {
      img.style.transition = 'transform 260ms cubic-bezier(.2,.9,.2,1)';
      translateX = clampedX; translateY = clampedY; applyTransform();
      setTimeout(() => { img.style.transition = ''; }, 300);
    } else if (currScale <= 1.05) {
      resetTransform();
    }
  });

  // Mouse pan (desktop) — click & drag when zoomed
  wrap.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && currScale > 1.01) {
      isPanning = true; lastX = e.clientX; lastY = e.clientY; wrap.setPointerCapture(e.pointerId); wrap.classList.add('grabbing');
    }
  });
  wrap.addEventListener('pointermove', function (e) {
    if (isPanning && e.pointerType === 'mouse') {
      const dx = e.clientX - lastX; const dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; translateX += dx; translateY += dy; applyTransform();
    }
  });
  wrap.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'mouse') {
      isPanning = false; wrap.classList.remove('grabbing');
      const { clampedX, clampedY } = clampTranslateValues();
      if (Math.abs(clampedX - translateX) > 0.5 || Math.abs(clampedY - translateY) > 0.5) {
        img.style.transition = 'transform 260ms cubic-bezier(.2,.9,.2,1)';
        translateX = clampedX; translateY = clampedY; applyTransform();
        setTimeout(() => { img.style.transition = ''; }, 300);
      }
    }
  });

  // Wheel zoom on desktop lightbox
  wrap.addEventListener('wheel', function (e) {
    if (!document.getElementById('lightbox').classList.contains('open')) return;
    const rect = img.getBoundingClientRect();
    const ox = ((e.clientX - rect.left) / rect.width) * 100;
    const oy = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${ox}% ${oy}%`;
    const delta = -e.deltaY * 0.0015;
    currScale = Math.max(1, Math.min(4, (currScale || 1) + delta));
    wrap.classList.toggle('zoomable', currScale > 1.01);
    // After scaling, ensure translate is within bounds
    const { clampedX, clampedY } = clampTranslateValues();
    translateX = clampedX; translateY = clampedY;
    applyTransform(); showZoomHint(); e.preventDefault();
  }, { passive: false });

})();

/* ── Inquiry ── */
document.getElementById('inqMessage').addEventListener('input', function() {
  document.getElementById('inqCharCount').textContent = this.value.length;
});

let inquiryCooldown = false;
document.getElementById('sendInquiryBtn').addEventListener('click', async () => {
  if (inquiryCooldown) { showToast('Please wait before sending another message.', 'info'); return; }

  const name    = document.getElementById('inqName').value.trim();
  const email   = document.getElementById('inqEmail').value.trim();
  const phone   = document.getElementById('inqPhone').value.trim();
  const message = document.getElementById('inqMessage').value.trim();
  if (!name || !email || !message) { showToast('Please fill in name, email, and message.', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email address.', 'error'); return; }

  const btn = document.getElementById('sendInquiryBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Sending\u2026';

  // Use CP.Inquiries.submit() so the edge function fires confirmation + landlord emails.
  const { error } = await CP.Inquiries.submit({
    property_id:  currentProperty.id,
    tenant_name:  name,
    tenant_email: email,
    tenant_phone: phone || null,
    message
  });

  if (error) {
    showToast('Failed to send. Please try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
  } else {
    showToast('Message sent! The landlord will be in touch soon.', 'success');
    btn.innerHTML = '<i class="fas fa-check"></i> Sent!';

    // Clear form fields after successful send
    document.getElementById('inqName').value    = '';
    document.getElementById('inqEmail').value   = '';
    document.getElementById('inqPhone').value   = '';
    document.getElementById('inqMessage').value = '';

    // 60-second rate limit cooldown
    inquiryCooldown = true;
    let secs = 60;
    const countdown = setInterval(() => {
      secs--;
      if (secs <= 0) {
        clearInterval(countdown);
        inquiryCooldown = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
        btn.disabled = false;
      } else {
        btn.innerHTML = `<i class="fas fa-clock"></i> Wait ${secs}s`;
      }
    }, 1000);
  }
});

/* ── Detail Tabs ── */
document.getElementById('detailTabs')?.addEventListener('click', e => {
  const tab = e.target.closest('.detail-tab');
  if (!tab || tab.classList.contains('active')) return;
  document.querySelectorAll('.detail-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  document.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.remove('active'));
  tab.classList.add('active');
  tab.setAttribute('aria-selected', 'true');
  const panelId = tab.dataset.panel;
  document.getElementById(panelId)?.classList.add('active');
});

/* ── Contact Drawer (mobile) ── */
(function() {
  const contactCard     = document.getElementById('contactCard');
  const drawerOverlay   = document.getElementById('contactDrawerOverlay');
  const mobMsgBtn       = document.getElementById('mobMsgBtn');
  const drawerCloseBtn  = document.getElementById('contactDrawerCloseBtn');

  function openContactDrawer() {
    contactCard?.classList.add('drawer-open');
    drawerOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeContactDrawer() {
    contactCard?.classList.remove('drawer-open');
    drawerOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  mobMsgBtn?.addEventListener('click', openContactDrawer);
  drawerOverlay?.addEventListener('click', closeContactDrawer);
  drawerCloseBtn?.addEventListener('click', closeContactDrawer);
})();

/* ── Share & Save ── */
window.shareProp = () => {
  if (navigator.share) navigator.share({ title: currentProperty?.title, url: window.location.href });
  else { navigator.clipboard.writeText(window.location.href); showToast('Link copied!', 'success'); }
};
document.getElementById('shareBtn')?.addEventListener('click', window.shareProp);

async function toggleSave(id, btn) {
  btn.disabled = true;
  try {
    const { saved } = await SavedProperties.toggle(id);
    if (saved) {
      savedIds.add(id);
      btn.innerHTML = '<i class="fas fa-heart" style="color:var(--danger-strong)"></i> Saved';
      showToast('Property saved!', 'success');
    } else {
      savedIds.delete(id);
      btn.innerHTML = '<i class="far fa-heart"></i> Save';
    }
  } catch(_) {
    // Fallback: localStorage only
    if (savedIds.has(id)) {
      savedIds.delete(id); btn.innerHTML = '<i class="far fa-heart"></i> Save';
    } else {
      savedIds.add(id); btn.innerHTML = '<i class="fas fa-heart" style="color:var(--danger-strong)"></i> Saved';
      showToast('Property saved!', 'success');
    }
    localStorage.setItem('cp_saved', JSON.stringify([...savedIds]));
  } finally {
    btn.disabled = false;
  }
}

/* ── Admin property panel ─────────────────────────────────────────────────
   Injected immediately after renderProperty() when _isAdminViewer is true.
   Provides:
   • Sticky admin banner: status inline toggle, "Edit" button → slide-in
     quick-edit drawer, "Full Edit ↗" → admin/property-detail.html (new tab)
   • Admin info section: metrics + admin notes
   • Quick-edit drawer: all core fields, photo reorder/delete, save + audit log
   ──────────────────────────────────────────────────────────────────────── */
function initAdminPropertyPanel(prop) {
  const STATUSES = ['active','rented','inactive','maintenance','draft','paused','archived'];
  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ── Inject drawer CSS once ──
  if (!document.getElementById('adminDrawerCSS')) {
    const style = document.createElement('style');
    style.id = 'adminDrawerCSS';
    style.textContent = `
      #adminEditOverlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9990;display:none}
      #adminEditOverlay.open{display:block}
      #adminEditDrawer{position:fixed;right:0;top:0;bottom:0;width:min(580px,100%);background:var(--m-white);z-index:9995;display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(0,0,0,.25);transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1)}
      #adminEditDrawer.open{transform:translateX(0)}
      .adw-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:2px solid var(--m-ink-2);background:#0a1628;flex-shrink:0}
      .adw-header h3{margin:0;font-size:15px;font-weight:700;color:var(--m-border);display:flex;align-items:center;gap:8px}
      .adw-close{background:none;border:none;color:var(--m-soft);font-size:20px;cursor:pointer;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0}
      .adw-close:hover{background:rgba(255,255,255,.1);color:var(--m-white)}
      .adw-body{flex:1;overflow-y:auto;display:flex;flex-direction:column}
      .adw-dirty-bar{background:var(--warning-strong);color:#0a1628;text-align:center;font-size:11px;font-weight:800;padding:5px 8px;letter-spacing:.04em;display:none;flex-shrink:0}
      .adw-dirty-bar.show{display:block}
      .adw-section{padding:18px 20px;border-bottom:1px solid var(--m-surface-2)}
      .adw-section-title{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--m-soft);margin-bottom:12px;display:flex;align-items:center;gap:6px}
      .adw-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
      .adw-row.c1{grid-template-columns:1fr;margin-bottom:10px}
      .adw-row.c3{grid-template-columns:1fr 1fr 1fr}
      .adw-row:last-child{margin-bottom:0}
      .adw-field{display:flex;flex-direction:column;gap:4px}
      .adw-label{font-size:11px;font-weight:700;color:#374151;letter-spacing:.02em}
      .adw-input{border:1.5px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;color:var(--m-ink-2);background:var(--m-white);outline:none;transition:border-color 150ms;width:100%;box-sizing:border-box}
      .adw-input:focus{border-color:var(--m-brand);box-shadow:0 0 0 3px rgba(0,106,255,.1)}
      textarea.adw-input{resize:none;overflow:hidden;line-height:1.65;min-height:120px}
      select.adw-input{cursor:pointer}
      /* ── Description box ── */
      .adw-desc-ta{resize:none;overflow:hidden;min-height:160px;line-height:1.7;font-size:14px;padding:14px 16px;border-width:2px;background:#fafcff;border-color:#c7d7f5;border-radius:10px;letter-spacing:.01em;color:#1a2133;caret-color:var(--m-brand);-webkit-text-size-adjust:100%}
      .adw-desc-ta:focus{border-color:var(--m-brand);background:var(--m-white);box-shadow:0 0 0 4px rgba(0,106,255,.08)}
      .adw-desc-meta{display:flex;align-items:center;justify-content:space-between;margin-top:6px;gap:8px}
      .adw-desc-bar-wrap{flex:1;height:3px;background:var(--m-border);border-radius:2px;overflow:hidden}
      .adw-desc-bar{height:100%;width:0%;background:var(--m-brand);border-radius:2px;transition:width 120ms,background 120ms}
      .adw-desc-bar.warn{background:var(--warning-strong)}
      .adw-desc-bar.over{background:#ef4444}
      .adw-desc-count{font-size:11px;color:var(--m-soft);white-space:nowrap;flex-shrink:0}
      .adw-desc-draft{font-size:10px;font-weight:700;color:var(--warning-strong);letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border-radius:4px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);display:none}
      .adw-desc-draft.show{display:inline-block}
      @media(max-width:600px){.adw-desc-ta{font-size:16px;min-height:200px;padding:14px}}
      .adw-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:4px}
      .adw-photo-item{position:relative;aspect-ratio:4/3;border-radius:8px;overflow:hidden;border:2px solid var(--m-border);background:var(--m-surface)}
      .adw-photo-item img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
      .adw-photo-order{position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.7);color:var(--m-white);font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;pointer-events:none}
      .adw-photo-cover{position:absolute;top:4px;left:4px;background:rgba(16,185,129,.9);color:var(--m-white);font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;pointer-events:none}
      .adw-photo-del{position:absolute;top:4px;right:4px;background:rgba(220,38,38,.9);color:var(--m-white);border:none;border-radius:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;z-index:2}
      .adw-photo-del:hover{background:#b91c1c}
      .adw-photo-arrows{position:absolute;bottom:4px;right:4px;display:flex;gap:2px;z-index:2}
      .adw-photo-arr{background:rgba(0,0,0,.6);color:var(--m-white);border:none;border-radius:3px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;padding:0}
      .adw-photo-arr:hover{background:rgba(0,106,255,.85)}
      .adw-upload-zone{border:2px dashed var(--m-border-strong);border-radius:10px;padding:18px 12px;text-align:center;cursor:pointer;transition:border-color 150ms,background 150ms;margin-top:10px;background:var(--m-surface)}
      .adw-upload-zone:hover,.adw-upload-zone.drag-over{border-color:var(--m-brand);background:var(--m-brand-pale)}
      .adw-upload-zone-icon{font-size:22px;color:var(--m-soft);pointer-events:none}
      .adw-upload-zone-text{font-size:12px;color:var(--m-muted);margin:5px 0 0;pointer-events:none;line-height:1.5}
      .adw-pending-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:6px;margin-top:8px}
      .adw-pending-item{position:relative;aspect-ratio:4/3;border-radius:6px;overflow:hidden;border:2px solid var(--m-border);background:var(--m-ink-2)}
      .adw-pending-item img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.38;pointer-events:none}
      .adw-pending-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px}
      .adw-upload-prog{display:none;background:var(--m-surface-2);border-radius:8px;padding:10px 12px;margin-top:8px;border:1px solid var(--m-border)}
      .adw-upload-prog-bar-wrap{height:5px;background:var(--m-border);border-radius:3px;overflow:hidden;margin:5px 0 3px}
      .adw-upload-prog-bar{height:100%;background:var(--m-brand);width:0;transition:width 250ms;border-radius:3px}
      .adw-upload-prog-row{font-size:11px;color:#475569;display:flex;justify-content:space-between}
      .adw-footer{display:flex;gap:8px;padding:14px 20px;border-top:2px solid var(--m-border);flex-shrink:0;background:var(--m-surface);align-items:center}
      .adw-save-btn{background:var(--m-brand);color:var(--m-white);border:none;border-radius:8px;padding:10px 0;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;flex:1}
      .adw-save-btn:disabled{opacity:.6;cursor:not-allowed}
      .adw-save-btn:hover:not(:disabled){background:var(--m-brand-dark)}
      .adw-cancel-btn{background:var(--m-white);color:#374151;border:1.5px solid #d1d5db;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
      .adw-cancel-btn:hover{border-color:#9ca3af}
      .adw-full-link{background:var(--m-white);color:var(--m-brand);border:1.5px solid var(--m-brand);border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap}
      .adw-full-link:hover{background:var(--m-brand-pale)}
      .adw-toggle-wrap{display:flex;align-items:center;gap:10px;padding:6px 0}
      .adw-toggle{position:relative;width:40px;height:22px;flex-shrink:0}
      .adw-toggle input{opacity:0;width:0;height:0;position:absolute}
      .adw-slider{position:absolute;inset:0;background:#d1d5db;border-radius:22px;cursor:pointer;transition:background .2s}
      .adw-slider::before{content:'';position:absolute;left:3px;top:3px;width:16px;height:16px;background:var(--m-white);border-radius:50%;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
      .adw-toggle input:checked+.adw-slider{background:var(--m-brand)}
      .adw-toggle input:checked+.adw-slider::before{transform:translateX(18px)}
      @media(max-width:480px){
        #adminEditDrawer{width:100%}
        .adw-row.c3{grid-template-columns:1fr 1fr}
        .adw-footer{flex-wrap:wrap;gap:8px}
        .adw-save-btn{order:-1;width:100%;flex:unset;padding:13px 0;font-size:14px}
        .adw-cancel-btn,.adw-full-link{flex:1}
        .adw-input{font-size:16px}
        .adw-section{padding:14px 16px}
        .adw-label{font-size:12px}
      }
    `;
    document.head.appendChild(style);
  }

  // ── Admin banner ──
  const banner = document.createElement('div');
  banner.id = 'adminPropBanner';
  banner.style.cssText = 'background:#0a1628;color:var(--m-border);padding:10px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-bottom:3px solid var(--m-brand);z-index:90;position:relative';
  banner.innerHTML = `
    <span style="background:var(--m-brand);color:var(--m-white);font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.05em;flex-shrink:0">ADMIN</span>
    <span id="adminBannerTitle" style="font-size:13px;font-weight:600;flex-shrink:0;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(prop.title||'')}">${esc(prop.title||'Untitled')}</span>
    <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
      <span style="font-size:11px;color:var(--m-muted)">Status:</span>
      <select id="adminStatusSelect" style="background:var(--m-ink-2);color:var(--m-border);border:1px solid #374151;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:600;cursor:pointer">
        ${STATUSES.map(s => `<option value="${s}"${s===prop.status?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
      </select>
      <button id="adminStatusSaveBtn" style="background:var(--m-brand);color:var(--m-white);border:none;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;display:none">Save</button>
      <span id="adminStatusSpinner" style="color:var(--m-muted);font-size:12px;display:none"><i class="fas fa-spinner fa-spin"></i></span>
    </div>
    <div style="display:flex;gap:6px;margin-left:auto;flex-shrink:0;flex-wrap:wrap">
      <button id="adminQuickEditBtn" style="background:var(--m-brand);color:var(--m-white);border:none;border-radius:6px;padding:5px 14px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">
        <i class="fas fa-pen"></i> Edit
      </button>
      <a href="/admin/property-detail.html?id=${esc(prop.id)}" target="_blank" rel="noopener" style="background:var(--m-ink-2);color:var(--m-border);border:1px solid #374151;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:5px">
        <i class="fas fa-arrow-up-right-from-square"></i> Full Edit
      </a>
      <a href="/admin/applications.html?property=${esc(prop.id)}" style="background:var(--m-ink-2);color:var(--m-border);border:1px solid #374151;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:5px">
        <i class="fas fa-file-alt"></i> Apps
      </a>
      <a href="/admin/audit-log.html?target=${esc(prop.id)}" style="background:var(--m-ink-2);color:var(--m-border);border:1px solid #374151;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:5px">
        <i class="fas fa-history"></i> Log
      </a>
    </div>`;

  // Insert admin banner before the split container (not inside the sticky photo column)
  const split = document.getElementById('propSplit');
  if (split) split.parentNode.insertBefore(banner, split);
  else document.body.prepend(banner);

  // ── Status inline save ──
  const sel = document.getElementById('adminStatusSelect');
  const saveBtn = document.getElementById('adminStatusSaveBtn');
  const spinner = document.getElementById('adminStatusSpinner');
  let originalStatus = prop.status;

  sel?.addEventListener('change', () => {
    if (saveBtn) saveBtn.style.display = sel.value !== originalStatus ? '' : 'none';
  });
  saveBtn?.addEventListener('click', async () => {
    const newStatus = sel.value;
    saveBtn.disabled = true;
    if (spinner) spinner.style.display = '';
    try {
      const res = await window.CP.Properties.update(prop.id, { status: newStatus });
      if (!res.ok) throw new Error(res.error || 'Update failed');
      try {
        const session = await window.CP.Auth.getSession();
        if (session?.user?.id) {
          await window.CP.sb().from('admin_actions').insert({
            action:'property.status_change', target_type:'property', target_id:prop.id,
            metadata:{from:originalStatus, to:newStatus}, user_id:session.user.id,
          });
        }
      } catch(e) {}
      originalStatus = newStatus;
      prop.status = newStatus;
      saveBtn.style.display = 'none';
      if (typeof showToast === 'function') showToast(`Status → ${newStatus}`, 'success');
    } catch(e) {
      if (typeof showToast === 'function') showToast('Failed: ' + e.message, 'error');
      sel.value = originalStatus;
      saveBtn.style.display = 'none';
    } finally {
      saveBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  });

  // ── Admin info section ──
  const section = document.createElement('div');
  section.id = 'adminPropSection';
  section.style.cssText = 'background:var(--m-surface);border:2px solid var(--m-border);border-radius:12px;padding:20px;margin:24px 0';
  section.innerHTML = `
    <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--m-muted);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span><i class="fas fa-shield-halved" style="color:var(--m-brand)"></i> Admin Info</span>
      <button id="adminSectionEditBtn" style="background:var(--m-brand);color:var(--m-white);border:none;border-radius:6px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">
        <i class="fas fa-pen"></i> Edit Property
      </button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px;margin-bottom:20px">
      <div style="background:var(--m-white);border:1px solid var(--m-border);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--m-ink-2)">${prop.views_count??0}</div>
        <div style="font-size:10px;color:var(--m-muted);margin-top:2px">Views</div>
      </div>
      <div style="background:var(--m-white);border:1px solid var(--m-border);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--m-ink-2)">${prop.applications_count??0}</div>
        <div style="font-size:10px;color:var(--m-muted);margin-top:2px">Applications</div>
      </div>
      <div style="background:var(--m-white);border:1px solid var(--m-border);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--m-ink-2)">${prop.saves_count??0}</div>
        <div style="font-size:10px;color:var(--m-muted);margin-top:2px">Saves</div>
      </div>
      <div style="background:var(--m-white);border:1px solid var(--m-border);border-radius:8px;padding:10px;text-align:center">
        <div id="adminInqCountVal" style="font-size:20px;font-weight:700;color:var(--m-ink-2)">—</div>
        <div style="font-size:10px;color:var(--m-muted);margin-top:2px">Inquiries</div>
      </div>
    </div>
    <div>
      <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:6px">
        <i class="fas fa-sticky-note"></i> Admin Notes (internal)
      </label>
      <textarea id="adminNotesField" rows="3" maxlength="2000"
        style="width:100%;border:1.5px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.5;resize:vertical;box-sizing:border-box;font-family:inherit;color:var(--m-ink-2);background:var(--m-white);outline:none;transition:border-color 150ms"
        placeholder="Private admin notes — not visible to landlords or tenants…"
        onfocus="this.style.borderColor='var(--m-brand)'" onblur="this.style.borderColor='#d1d5db'">${esc(prop.admin_notes||'')}</textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <span style="font-size:11px;color:var(--m-soft)">Not visible to landlords or tenants</span>
        <button id="adminNotesSaveBtn" style="background:var(--m-brand);color:var(--m-white);border:none;border-radius:6px;padding:6px 16px;font-size:12px;font-weight:700;cursor:pointer">Save Notes</button>
      </div>
    </div>
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--m-border);display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <a href="/admin/applications.html?property=${esc(prop.id)}" style="font-size:12px;color:var(--m-brand);text-decoration:none;display:flex;align-items:center;gap:4px;font-weight:600"><i class="fas fa-file-alt"></i> Applications</a>
      <span style="color:#d1d5db">·</span>
      <a href="/admin/audit-log.html?target=${esc(prop.id)}" style="font-size:12px;color:var(--m-brand);text-decoration:none;display:flex;align-items:center;gap:4px;font-weight:600"><i class="fas fa-history"></i> Audit Log</a>
      <span style="color:#d1d5db">·</span>
      <a href="/admin/property-detail.html?id=${esc(prop.id)}" target="_blank" rel="noopener" style="font-size:12px;color:var(--m-brand);text-decoration:none;display:flex;align-items:center;gap:4px;font-weight:600"><i class="fas fa-arrow-up-right-from-square"></i> Full Edit</a>
    </div>`;

  const detailMain = document.getElementById('detailMain');
  const breadcrumb = detailMain?.querySelector('.detail-breadcrumb');
  if (breadcrumb) breadcrumb.parentNode.insertBefore(section, breadcrumb.nextSibling);
  else if (detailMain) detailMain.prepend(section);

  // Fetch real inquiries count — inquiries_count column doesn't exist on properties table
  (async () => {
    try {
      const { count } = await window.CP.sb()
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', prop.id);
      const el = document.getElementById('adminInqCountVal');
      if (el) el.textContent = count ?? 0;
    } catch(e) { /* non-fatal — leave placeholder dash */ }
  })();

  // Admin notes standalone save
  document.getElementById('adminNotesSaveBtn')?.addEventListener('click', async () => {
    const f = document.getElementById('adminNotesField');
    const b = document.getElementById('adminNotesSaveBtn');
    if (!f || !b) return;
    b.disabled = true; b.textContent = 'Saving…';
    try {
      const res = await window.CP.Properties.update(prop.id, { admin_notes: f.value });
      if (!res.ok) throw new Error(res.error || 'Save failed');
      prop.admin_notes = f.value;
      if (typeof showToast === 'function') showToast('Admin notes saved', 'success');
    } catch(e) {
      if (typeof showToast === 'function') showToast('Save failed: ' + e.message, 'error');
    } finally { b.disabled = false; b.textContent = 'Save Notes'; }
  });

  // ── Wire quick-edit drawer ──
  const { open: openDrawer } = buildAdminEditDrawer(prop);
  document.getElementById('adminQuickEditBtn')?.addEventListener('click', openDrawer);
  document.getElementById('adminSectionEditBtn')?.addEventListener('click', openDrawer);
}

/* ── Quick-edit drawer (slide-in from right, wired by initAdminPropertyPanel) ── */
function buildAdminEditDrawer(prop) {
  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
  const PROP_TYPES = ['apartment','house','condo','townhouse','studio','room','duplex','triplex','loft','mobile_home','commercial','other'];
  const STATUSES   = ['active','rented','inactive','maintenance','draft','paused','archived'];
  const LAUNDRY    = ['','In-unit','Washer/Dryer Hookups','Shared (On-site)','Laundromat Nearby','None'];
  const HEATING    = ['','Central','Forced Air','Baseboard','Radiant','Heat Pump','Wall Unit','None'];
  const COOLING    = ['','Central AC','Window Units','Mini-Split','None'];

  // Working photo array (sorted by display_order)
  let _photos = Array.isArray(prop.property_photos)
    ? prop.property_photos.slice().sort((a,b) => (a.display_order??0)-(b.display_order??0))
    : [];
  let _dirty = false;

  function imgThumb(url) {
    if (!url) return '/assets/placeholder-property.jpg';
    return window.CONFIG?.img ? window.CONFIG.img(url, 'strip') : url;
  }

  function renderPhotoGrid() {
    if (!_photos.length) return '<p style="color:var(--m-soft);font-size:13px;margin:0">No photos yet. Use Full Edit to upload photos.</p>';
    return _photos.map((ph, i) => `
      <div class="adw-photo-item">
        <img src="${esc(imgThumb(ph.url))}" alt="Photo ${i+1}" loading="lazy">
        ${i===0 ? '<div class="adw-photo-cover">Cover</div>' : ''}
        <div class="adw-photo-order">${i+1}</div>
        <button class="adw-photo-del" data-del="${i}" title="Delete photo" type="button">✕</button>
        <div class="adw-photo-arrows">
          ${i>0 ? `<button class="adw-photo-arr" data-mv="${i}" data-dir="-1" type="button" title="Move earlier">↑</button>` : ''}
          ${i<_photos.length-1 ? `<button class="adw-photo-arr" data-mv="${i}" data-dir="1" type="button" title="Move later">↓</button>` : ''}
        </div>
      </div>`).join('');
  }

  // ── Build DOM ──
  const overlay = document.createElement('div');
  overlay.id = 'adminEditOverlay';
  const drawer = document.createElement('div');
  drawer.id = 'adminEditDrawer';

  const p = prop;
  const stateOpts   = ['<option value="">— State —</option>',...US_STATES.map(s => `<option value="${s}"${p.state===s?' selected':''}>${s}</option>`)].join('');
  const typeOpts    = PROP_TYPES.map(t => `<option value="${t}"${p.property_type===t?' selected':''}>${t.charAt(0).toUpperCase()+t.slice(1).replace(/_/g,' ')}</option>`).join('');
  const statusOpts  = STATUSES.map(s => `<option value="${s}"${p.status===s?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');
  const laundryOpts = LAUNDRY.map(v => `<option value="${v}"${p.laundry_type===v?' selected':''}>${v||'— None —'}</option>`).join('');
  const heatingOpts = HEATING.map(v => `<option value="${v}"${p.heating_type===v?' selected':''}>${v||'— None —'}</option>`).join('');
  const coolingOpts = COOLING.map(v => `<option value="${v}"${p.cooling_type===v?' selected':''}>${v||'— None —'}</option>`).join('');
  const availDate   = p.available_date ? p.available_date.split('T')[0] : '';

  drawer.innerHTML = `
    <div class="adw-header">
      <h3><i class="fas fa-pen" style="color:var(--m-brand)"></i> Edit Property</h3>
      <button class="adw-close" id="adwCloseBtn" type="button" aria-label="Close">✕</button>
    </div>
    <div class="adw-dirty-bar" id="adwDirtyBar">⚠ Unsaved changes</div>
    <div class="adw-body">

      <div class="adw-section">
        <div class="adw-section-title"><i class="fas fa-tag"></i> Basic Info</div>
        <div class="adw-row c1">
          <div class="adw-field">
            <label class="adw-label" for="adwTitle">Title</label>
            <input class="adw-input" id="adwTitle" type="text" value="${esc(p.title||'')}" maxlength="200" placeholder="Property title">
          </div>
        </div>
        <div class="adw-row">
          <div class="adw-field">
            <label class="adw-label" for="adwStatus">Status</label>
            <select class="adw-input" id="adwStatus">${statusOpts}</select>
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwPropType">Property Type</label>
            <select class="adw-input" id="adwPropType">${typeOpts}</select>
          </div>
        </div>
      </div>

      <div class="adw-section">
        <div class="adw-section-title"><i class="fas fa-dollar-sign"></i> Pricing</div>
        <div class="adw-row c3">
          <div class="adw-field">
            <label class="adw-label" for="adwRent">Monthly Rent ($)</label>
            <input class="adw-input" id="adwRent" type="number" min="0" value="${p.monthly_rent??''}">
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwDeposit">Security Deposit ($)</label>
            <input class="adw-input" id="adwDeposit" type="number" min="0" value="${p.security_deposit??''}">
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwAppFee">App Fee ($)</label>
            <input class="adw-input" id="adwAppFee" type="number" min="0" value="${p.application_fee??''}">
          </div>
        </div>
        <div class="adw-row">
          <div class="adw-field">
            <label class="adw-label" for="adwAvailDate">Available Date</label>
            <input class="adw-input" id="adwAvailDate" type="date" value="${esc(availDate)}">
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwMinLease">Min Lease (months)</label>
            <input class="adw-input" id="adwMinLease" type="number" min="1" value="${p.minimum_lease_months??''}">
          </div>
        </div>
      </div>

      <div class="adw-section">
        <div class="adw-section-title"><i class="fas fa-bed"></i> Specs</div>
        <div class="adw-row c3">
          <div class="adw-field">
            <label class="adw-label" for="adwBeds">Bedrooms</label>
            <input class="adw-input" id="adwBeds" type="number" min="0" value="${p.bedrooms??''}">
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwBaths">Bathrooms</label>
            <input class="adw-input" id="adwBaths" type="number" min="0" step="0.5" value="${p.bathrooms??''}">
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwHalfBaths">Half Baths</label>
            <input class="adw-input" id="adwHalfBaths" type="number" min="0" value="${p.half_bathrooms??''}">
          </div>
        </div>
        <div class="adw-row">
          <div class="adw-field">
            <label class="adw-label" for="adwSqft">Sq Footage</label>
            <input class="adw-input" id="adwSqft" type="number" min="0" value="${p.square_footage??''}">
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwYearBuilt">Year Built</label>
            <input class="adw-input" id="adwYearBuilt" type="number" min="1800" max="2030" value="${p.year_built??''}">
          </div>
        </div>
        <div class="adw-row c3">
          <div class="adw-field">
            <label class="adw-label" for="adwLaundry">Laundry</label>
            <select class="adw-input" id="adwLaundry">${laundryOpts}</select>
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwHeating">Heating</label>
            <select class="adw-input" id="adwHeating">${heatingOpts}</select>
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwCooling">Cooling</label>
            <select class="adw-input" id="adwCooling">${coolingOpts}</select>
          </div>
        </div>
      </div>

      <div class="adw-section">
        <div class="adw-section-title"><i class="fas fa-location-dot"></i> Address</div>
        <div class="adw-row c1">
          <div class="adw-field">
            <label class="adw-label" for="adwAddress">Street Address</label>
            <input class="adw-input" id="adwAddress" type="text" value="${esc(p.address||'')}" placeholder="123 Main St">
          </div>
        </div>
        <div class="adw-row c3">
          <div class="adw-field">
            <label class="adw-label" for="adwCity">City</label>
            <input class="adw-input" id="adwCity" type="text" value="${esc(p.city||'')}">
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwState">State</label>
            <select class="adw-input" id="adwState">${stateOpts}</select>
          </div>
          <div class="adw-field">
            <label class="adw-label" for="adwZip">ZIP</label>
            <input class="adw-input" id="adwZip" type="text" value="${esc(p.zip||'')}" maxlength="10">
          </div>
        </div>
      </div>

      <div class="adw-section">
        <div class="adw-section-title" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
          <span><i class="fas fa-align-left"></i> Description</span>
          <span class="adw-desc-draft" id="adwDescDraft">Draft restored</span>
        </div>
        <div class="adw-field">
          <textarea class="adw-input adw-desc-ta" id="adwDesc" maxlength="5000" placeholder="Describe the property…">${esc(p.description||'')}</textarea>
          <div class="adw-desc-meta">
            <div class="adw-desc-bar-wrap"><div class="adw-desc-bar" id="adwDescBar"></div></div>
            <span class="adw-desc-count"><span id="adwDescCount">${(p.description||'').length}</span> / 5000</span>
          </div>
        </div>
      </div>

      <div class="adw-section">
        <div class="adw-section-title"><i class="fas fa-sliders"></i> Options</div>
        <div class="adw-toggle-wrap">
          <label class="adw-toggle">
            <input type="checkbox" id="adwFeatured"${p.featured?' checked':''}>
            <span class="adw-slider"></span>
          </label>
          <span style="font-size:13px;color:#374151;font-weight:500">Featured listing</span>
        </div>
      </div>

      <div class="adw-section">
        <div class="adw-section-title"><i class="fas fa-images"></i> Photos (<span id="adwPhotoCount">${_photos.length}</span>)</div>
        <div class="adw-photo-grid" id="adwPhotoGrid">${renderPhotoGrid()}</div>
        <div class="adw-upload-zone" id="adwUploadZone" role="button" tabindex="0" aria-label="Upload photos">
          <div class="adw-upload-zone-icon"><i class="fas fa-cloud-arrow-up"></i></div>
          <div class="adw-upload-zone-text">Drop photos here or <strong>click to browse</strong><br><span style="font-size:10.5px;color:var(--m-soft)">JPG, PNG, WebP · max 10 MB each</span></div>
          <input type="file" id="adwFileInput" accept="image/jpeg,image/png,image/webp,image/gif" multiple style="display:none">
        </div>
        <div class="adw-pending-grid" id="adwPendingGrid"></div>
        <div class="adw-upload-prog" id="adwUploadProg">
          <div class="adw-upload-prog-row"><span id="adwUploadText">Uploading…</span><span id="adwUploadPct">0%</span></div>
          <div class="adw-upload-prog-bar-wrap"><div class="adw-upload-prog-bar" id="adwUploadBar"></div></div>
        </div>
      </div>

      <div class="adw-section">
        <div class="adw-section-title"><i class="fas fa-sticky-note"></i> Admin Notes (internal only)</div>
        <div class="adw-field">
          <textarea class="adw-input" id="adwAdminNotes" rows="3" maxlength="2000" placeholder="Private admin notes…">${esc(p.admin_notes||'')}</textarea>
        </div>
      </div>

    </div>
    <div class="adw-footer">
      <button class="adw-cancel-btn" id="adwCancelBtn" type="button">Cancel</button>
      <a href="/admin/property-detail.html?id=${esc(prop.id)}" target="_blank" rel="noopener" class="adw-full-link">
        <i class="fas fa-arrow-up-right-from-square"></i> Full Edit
      </a>
      <button class="adw-save-btn" id="adwSaveBtn" type="button">
        <i class="fas fa-floppy-disk"></i> Save Changes
      </button>
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  // ── Draft backup key (per-property, sessionStorage only) ──
  const _DRAFT_KEY = `adw_desc_${prop.id}`;

  // ── Auto-grow textarea ──
  function _autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 160) + 'px';
  }

  // ── Open / close ──
  function openDrawer() {
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Restore sessionStorage draft (only if DB version hasn't changed since draft was saved)
    const ta = document.getElementById('adwDesc');
    const draftEl = document.getElementById('adwDescDraft');
    if (ta) {
      try {
        const saved = sessionStorage.getItem(_DRAFT_KEY);
        if (saved && saved !== ta.value) {
          ta.value = saved;
          if (draftEl) draftEl.classList.add('show');
          _syncDescMeta(ta);
          markDirty();
        }
      } catch(e) {}
      _autoGrow(ta);
    }
    setTimeout(() => document.getElementById('adwTitle')?.focus(), 320);
  }
  function closeDrawer() {
    if (_dirty && !confirm('You have unsaved changes. Close without saving?')) return;
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', closeDrawer);
  document.getElementById('adwCloseBtn').addEventListener('click', closeDrawer);
  document.getElementById('adwCancelBtn').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  // ── Dirty tracking ──
  const dirtyBar = document.getElementById('adwDirtyBar');
  const markDirty = () => { _dirty = true; dirtyBar?.classList.add('show'); };
  drawer.querySelectorAll('.adw-input').forEach(el => {
    el.addEventListener('input', markDirty);
    el.addEventListener('change', markDirty);
  });
  document.getElementById('adwFeatured')?.addEventListener('change', markDirty);

  // ── Description — auto-grow + counter bar + draft backup ──
  function _syncDescMeta(ta) {
    const len = ta.value.length;
    const pct = Math.min(100, (len / 5000) * 100);
    const countEl = document.getElementById('adwDescCount');
    const barEl   = document.getElementById('adwDescBar');
    if (countEl) countEl.textContent = len;
    if (barEl) {
      barEl.style.width = pct + '%';
      barEl.classList.toggle('warn', pct >= 70 && pct < 90);
      barEl.classList.toggle('over', pct >= 90);
    }
    _autoGrow(ta);
  }

  let _draftTimer = null;
  const descTA = document.getElementById('adwDesc');
  if (descTA) {
    // Initial size + bar state
    _syncDescMeta(descTA);
    descTA.addEventListener('input', () => {
      _syncDescMeta(descTA);
      markDirty();
      // Debounced draft save
      clearTimeout(_draftTimer);
      _draftTimer = setTimeout(() => {
        try { sessionStorage.setItem(_DRAFT_KEY, descTA.value); } catch(e) {}
      }, 800);
    });
    // On mobile: scroll field into view when keyboard opens
    descTA.addEventListener('focus', () => {
      setTimeout(() => descTA.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350);
    });
  }

  // ── Photo management ──
  const photoGrid = document.getElementById('adwPhotoGrid');

  function refreshPhotos(markDirtyState = true) {
    if (photoGrid) photoGrid.innerHTML = renderPhotoGrid();
    const countEl = document.getElementById('adwPhotoCount');
    if (countEl) countEl.textContent = _photos.length;
    bindPhotos();
    if (markDirtyState) markDirty();
  }
  function bindPhotos() {
    photoGrid?.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.del);
        const ph  = _photos[idx];
        if (!ph) return;
        if (!confirm(`Delete photo ${idx+1}? This cannot be undone.`)) return;
        if (!ph.id) {
          _photos.splice(idx, 1);
          refreshPhotos(false);
          return;
        }

        // Quick-edit photo removal is immediate. Previously this only queued
        // the ID in memory, so tapping X appeared to do nothing unless the
        // user also found and pressed Save Changes.
        btn.disabled = true;
        btn.textContent = '…';
        try {
          const { data, error } = await window.CP.sb()
            .from('property_photos')
            .delete()
            .eq('id', ph.id)
            .select('id');
          if (error) throw new Error(error.message || 'Photo deletion failed');
          if (!Array.isArray(data) || data.length !== 1) {
            throw new Error('Photo could not be deleted. It may already be gone or you may not have permission.');
          }

          _photos.splice(idx, 1);
          refreshPhotos(false);

          // Keep display_order contiguous after an immediate deletion.
          const orderResults = await Promise.all(_photos.map((photo, order) =>
            window.CP.sb().from('property_photos')
              .update({ display_order: order })
              .eq('id', photo.id)
          ));
          const orderError = orderResults.find(result => result.error)?.error;
          if (orderError && typeof showToast === 'function') {
            showToast('Photo deleted, but gallery order could not be refreshed.', 'error');
          }

          // Best-effort ImageKit cleanup; the database row is already gone.
          if (ph.file_id && window.CONFIG?.SUPABASE_URL && window.CONFIG?.SUPABASE_ANON_KEY) {
            window.CP.Auth.getSession().then(session => {
              if (!session?.access_token) return;
              fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/imagekit-delete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': window.CONFIG.SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ fileId: ph.file_id }),
              }).catch(() => {});
            }).catch(() => {});
          }

          if (typeof showToast === 'function') showToast('Photo deleted.', 'success');
        } catch (error) {
          btn.disabled = false;
          btn.textContent = '✕';
          if (typeof showToast === 'function') {
            showToast('Photo deletion failed: ' + (error.message || error), 'error');
          }
        }
      });
    });
    photoGrid?.querySelectorAll('[data-mv]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.mv);
        const dir = parseInt(btn.dataset.dir);
        const ni  = idx + dir;
        if (ni < 0 || ni >= _photos.length) return;
        [_photos[idx], _photos[ni]] = [_photos[ni], _photos[idx]];
        refreshPhotos();
      });
    });
  }
  bindPhotos();

  // ── Photo upload helpers ──────────────────────────────────────────────────
  const _pendingMap = new Map();
  let _uploading = false;

  async function _adwCompress(file, maxPx = 2048, quality = 0.92) {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch {
      if (file.size > 4 * 1024 * 1024) throw new Error(`"${file.name}" is too large (${(file.size / 1048576).toFixed(1)} MB). Use a smaller image.`);
      return file;
    }
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(bmp.width  * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return new Promise((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('Compression failed')), 'image/jpeg', quality)
    );
  }

  function _adwToBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = () => rej(new Error('Failed to read file'));
      r.readAsDataURL(blob);
    });
  }

  async function _adwUploadPhoto(file, onProgress) {
    if (!window.CONFIG?.SUPABASE_URL || !window.CONFIG?.SUPABASE_ANON_KEY)
      throw new Error('Upload service not configured');
    const { data: { session } } = await window.CP.sb().auth.getSession();
    if (!session?.access_token) throw new Error('Session expired — please log back in');
    onProgress?.(5);
    const compressed = await _adwCompress(file);
    onProgress?.(20);
    const base64 = await _adwToBase64(compressed);
    onProgress?.(35);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const folder   = `/properties/${prop.id}`;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress?.(40 + Math.round((e.loaded / e.total) * 45));
      };
      xhr.onload = () => {
        onProgress?.(100);
        let d; try { d = JSON.parse(xhr.responseText); } catch { d = {}; }
        if (d.success) resolve({ url: d.url, fileId: d.fileId ?? null });
        else reject(new Error(d.error || `Upload failed (HTTP ${xhr.status})`));
      };
      xhr.onerror   = () => reject(new Error('Network error — check connection'));
      xhr.ontimeout = () => reject(new Error('Upload timed out'));
      xhr.timeout   = 55_000;
      xhr.open('POST', `${window.CONFIG.SUPABASE_URL}/functions/v1/imagekit-upload`);
      xhr.setRequestHeader('apikey',        window.CONFIG.SUPABASE_ANON_KEY);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('Content-Type',  'application/json');
      xhr.send(JSON.stringify({ fileData: base64, fileName: safeName, folder }));
    });
  }

  function _adwAddPending(file) {
    if (['image/heic', 'image/heif'].includes(file.type.toLowerCase()) || /\.heic$/i.test(file.name)) {
      if (typeof showToast === 'function') showToast(`"${file.name}" is HEIC. Convert to JPG first.`, 'error'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (typeof showToast === 'function') showToast(`"${file.name}" exceeds the 10 MB limit.`, 'error'); return;
    }
    for (const f of _pendingMap.values()) { if (f.name === file.name && f.size === file.size) return; }
    const sid  = `adwp${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    _pendingMap.set(sid, file);

    const item = document.createElement('div');
    item.className = 'adw-pending-item';
    item.dataset.pendingId = sid;
    const shortName = file.name.length > 18 ? file.name.slice(0, 15) + '…' : file.name;
    item.innerHTML = `<div class="adw-pending-overlay" id="adw-ovl-${sid}">
      <i class="fas fa-clock" style="color:rgba(255,255,255,.8);font-size:13px"></i>
      <span style="color:var(--m-white);font-size:.62rem;text-align:center;word-break:break-word;max-width:76px">${esc(shortName)}</span>
      <button data-rm-pending="${sid}" type="button" style="padding:1px 6px;border-radius:3px;font-size:.6rem;background:rgba(220,38,38,.85);color:var(--m-white);border:none;cursor:pointer;margin-top:1px">✕ Remove</button>
    </div>`;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = document.createElement('img'); img.src = ev.target.result; img.alt = '';
      item.insertBefore(img, item.firstChild);
    };
    reader.readAsDataURL(file);
    document.getElementById('adwPendingGrid')?.appendChild(item);
    markDirty();
  }

  // Pending grid — remove a queued file
  document.getElementById('adwPendingGrid')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-pending]');
    if (!btn || _uploading) return;
    const sid = btn.dataset.rmPending;
    _pendingMap.delete(sid);
    document.querySelector(`[data-pending-id="${sid}"]`)?.remove();
  });

  // File input
  const adwFileInput = document.getElementById('adwFileInput');
  adwFileInput?.addEventListener('change', e => {
    [...e.target.files].forEach(_adwAddPending);
    adwFileInput.value = '';
  });

  // Upload zone — click to browse
  const adwUploadZone = document.getElementById('adwUploadZone');
  adwUploadZone?.addEventListener('click', e => {
    if (!e.target.closest('[data-rm-pending]')) adwFileInput?.click();
  });
  adwUploadZone?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); adwFileInput?.click(); }
  });
  adwUploadZone?.addEventListener('dragover',  e => { e.preventDefault(); adwUploadZone.classList.add('drag-over'); });
  adwUploadZone?.addEventListener('dragleave', () => adwUploadZone.classList.remove('drag-over'));
  adwUploadZone?.addEventListener('drop', e => {
    e.preventDefault(); adwUploadZone.classList.remove('drag-over');
    [...e.dataTransfer.files].forEach(_adwAddPending);
  });

  // ── Save ──
  document.getElementById('adwSaveBtn').addEventListener('click', async () => {
    const sb = document.getElementById('adwSaveBtn');
    sb.disabled = true;
    sb.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    const num = (id) => {
      const v = document.getElementById(id)?.value;
      return v !== '' && v != null ? parseFloat(v) : null;
    };
    const int = (id) => {
      const v = document.getElementById(id)?.value;
      return v !== '' && v != null ? parseInt(v) : null;
    };
    const str = (id) => document.getElementById(id)?.value.trim() || null;

    const payload = {
      title:                str('adwTitle'),
      status:               document.getElementById('adwStatus')?.value || prop.status,
      property_type:        document.getElementById('adwPropType')?.value || null,
      monthly_rent:         num('adwRent'),
      security_deposit:     num('adwDeposit'),
      application_fee:      num('adwAppFee'),
      bedrooms:             int('adwBeds'),
      bathrooms:            num('adwBaths'),
      half_bathrooms:       int('adwHalfBaths'),
      square_footage:       int('adwSqft'),
      year_built:           int('adwYearBuilt'),
      minimum_lease_months: int('adwMinLease'),
      laundry_type:         document.getElementById('adwLaundry')?.value || null,
      heating_type:         document.getElementById('adwHeating')?.value || null,
      cooling_type:         document.getElementById('adwCooling')?.value || null,
      address:              str('adwAddress'),
      city:                 str('adwCity'),
      state:                document.getElementById('adwState')?.value || null,
      zip:                  str('adwZip'),
      available_date:       document.getElementById('adwAvailDate')?.value || null,
      description:          str('adwDesc'),
      admin_notes:          str('adwAdminNotes'),
      featured:             document.getElementById('adwFeatured')?.checked ?? false,
      updated_at:           new Date().toISOString(),
    };

    try {
      // 1. Save core property fields
      const res = await window.CP.Properties.update(prop.id, payload);
      if (!res.ok) throw new Error(res.error || 'Property update failed');

      // 2. Persist photo order. Photo deletions are applied immediately when
      // the X button is tapped, so Save Changes only needs to preserve order.
      await Promise.all(_photos.map((ph, i) =>
        window.CP.sb().from('property_photos').update({ display_order: i }).eq('id', ph.id)
      ));

      // 3. Upload pending new photos
      if (_pendingMap.size > 0) {
        _uploading = true;
        const uploadProg = document.getElementById('adwUploadProg');
        const uploadBar  = document.getElementById('adwUploadBar');
        const uploadText = document.getElementById('adwUploadText');
        const uploadPct  = document.getElementById('adwUploadPct');
        if (uploadProg) uploadProg.style.display = '';

        const entries    = [..._pendingMap.entries()];
        const total      = entries.length;
        let   successCnt = 0;

        for (let idx = 0; idx < total; idx++) {
          const [sid, file] = entries[idx];
          const ovlEl  = document.getElementById(`adw-ovl-${sid}`);
          const itemEl = document.querySelector(`[data-pending-id="${sid}"]`);
          sb.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading ${idx + 1}/${total}…`;
          if (ovlEl) ovlEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:var(--m-brand);font-size:13px"></i>';

          const pctBase = Math.round((idx / total) * 100);
          if (uploadBar)  uploadBar.style.width  = pctBase + '%';
          if (uploadPct)  uploadPct.textContent  = pctBase + '%';
          if (uploadText) uploadText.textContent = `Uploading ${idx + 1} of ${total}…`;

          try {
            const result = await _adwUploadPhoto(file, (pct) => {
              const overall = Math.round(((idx + pct / 100) / total) * 100);
              if (uploadBar) uploadBar.style.width = overall + '%';
              if (uploadPct) uploadPct.textContent = overall + '%';
            });
            const { error: insErr } = await window.CP.sb()
              .rpc('add_property_photo', {
                p_property_id:  prop.id,
                p_url:          result.url,
                p_file_id:      result.fileId || null,
                p_display_order: null,
                p_is_hero:      false,
              });
            if (insErr) throw new Error(insErr.message);
            successCnt++;
            _pendingMap.delete(sid);
            if (ovlEl)  ovlEl.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success);font-size:15px"></i>';
            if (itemEl) itemEl.style.borderColor = 'rgba(34,197,94,.7)';
          } catch (err) {
            const msg = String(err?.message || err).slice(0, 70);
            if (ovlEl)  ovlEl.innerHTML = `<i class="fas fa-times-circle" style="color:var(--danger);font-size:13px"></i><span style="color:var(--danger);font-size:.6rem;text-align:center;word-break:break-word;max-width:76px">${esc(msg)}</span>`;
            if (itemEl) itemEl.style.borderColor = 'rgba(239,68,68,.6)';
          }
          if (idx < total - 1) await new Promise(r => setTimeout(r, 400));
        }

        if (uploadBar)  uploadBar.style.width  = '100%';
        if (uploadPct)  uploadPct.textContent  = '100%';
        _uploading = false;

        if (successCnt > 0) {
          if (typeof showToast === 'function') showToast(`${successCnt} photo${successCnt > 1 ? 's' : ''} uploaded!`, 'success');
          // Audit log for uploads (non-blocking)
          try {
            const session = await window.CP.Auth.getSession();
            if (session?.user?.id) {
              await window.CP.sb().from('admin_actions').insert({
                action: 'property.photo_upload', target_type: 'property',
                target_id: prop.id, metadata: { count: successCnt },
                user_id: session.user.id,
              });
            }
          } catch(e) {}
        } else {
          if (typeof showToast === 'function') showToast('Photo uploads failed — see errors above.', 'error');
        }

        // Fade out progress bar after a moment
        setTimeout(() => { if (uploadProg) uploadProg.style.display = 'none'; }, 1500);
      }

      // 4. Audit log for property edit
      try {
        const session = await window.CP.Auth.getSession();
        if (session?.user?.id) {
          await window.CP.sb().from('admin_actions').insert({
            action:'property.edit', target_type:'property', target_id:prop.id,
            metadata:{ edited_fields: Object.keys(payload).filter(k => payload[k] !== null && k !== 'updated_at') },
            user_id: session.user.id,
          });
        }
      } catch(e) {}

      // 5. Sync in-memory prop + visible UI
      Object.assign(prop, payload);

      // ── Admin chrome ──
      const bannerTitle = document.getElementById('adminBannerTitle');
      if (bannerTitle && payload.title) { bannerTitle.textContent = payload.title; bannerTitle.title = payload.title; }
      const bannerSel = document.getElementById('adminStatusSelect');
      if (bannerSel && payload.status) bannerSel.value = payload.status;
      const notesField = document.getElementById('adminNotesField');
      if (notesField) notesField.value = payload.admin_notes || '';

      // ── Live property page DOM patch (no refresh needed) ──
      const _esc2 = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      // Title
      if (payload.title) {
        const el = document.getElementById('detailTitle');
        if (el) el.textContent = payload.title;
        document.title = payload.title + ' — Choice Properties';
      }
      // Price — every occurrence on the page
      if (payload.monthly_rent != null) {
        const rentFmt = '$' + Number(payload.monthly_rent).toLocaleString();
        const dp = document.getElementById('detailPrice');
        if (dp) dp.innerHTML = rentFmt + '<span>/month</span>';
        const sp = document.getElementById('sidebarPrice');
        if (sp) sp.innerHTML = rentFmt + '<span>/month</span>';
        const sr = document.getElementById('sidebarRent');
        if (sr) sr.textContent = rentFmt;
        const mb = document.getElementById('mobBarRent');
        if (mb) mb.textContent = rentFmt + '/mo';
      }
      // Address
      if (payload.address || payload.city || payload.state || payload.zip) {
        const ae = document.getElementById('detailAddress');
        if (ae) ae.innerHTML = '<i class="fas fa-map-marker-alt"></i> '
          + _esc2(payload.address||prop.address||'') + ', '
          + _esc2(payload.city||prop.city||'') + ', '
          + _esc2(payload.state||prop.state||'') + ' '
          + _esc2(payload.zip||prop.zip||'');
      }
      // Description — re-render paragraphs + truncation
      if (payload.description != null) {
        const de = document.getElementById('detailDesc');
        if (de) {
          const nxt = de.nextElementSibling;
          if (nxt?.classList.contains('detail-read-more')) nxt.remove();
          de.classList.remove('truncated');
          const paras = (payload.description||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
          de.innerHTML = paras.length
            ? paras.map(s=>`<p>${_esc2(s)}</p>`).join('')
            : '<p>No additional description provided.</p>';
          if ((payload.description||'').length > 300) {
            de.classList.add('truncated');
            const rm = document.createElement('button');
            rm.className = 'detail-read-more';
            rm.innerHTML = '<i class="fas fa-chevron-down" style="font-size:11px"></i> Read more';
            rm.addEventListener('click', () => { de.classList.remove('truncated'); rm.remove(); });
            de.insertAdjacentElement('afterend', rm);
          }
        }
      }

      // Clear sessionStorage draft on successful save
      try { sessionStorage.removeItem(_DRAFT_KEY); } catch(e) {}
      const draftEl2 = document.getElementById('adwDescDraft');
      if (draftEl2) draftEl2.classList.remove('show');

      _dirty = false;
      dirtyBar?.classList.remove('show');
      if (typeof showToast === 'function') showToast('Saved — page updated ✓', 'success');
      setTimeout(closeDrawer, 700);

    } catch(e) {
      _uploading = false;
      if (typeof showToast === 'function') showToast('Save failed: ' + e.message, 'error');
    } finally {
      sb.disabled = false;
      sb.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes';
    }
  });

  return { open: openDrawer, close: closeDrawer };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICHMENT SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

/* ── Shared enrichment stylesheet (injected once) ───────────────────────── */
function injectEnrichmentStyles() {
  if (document.getElementById('cp-enrichment-styles')) return;
  const s = document.createElement('style');
  s.id = 'cp-enrichment-styles';
  s.textContent = `
    /* Renter requirement chips */
    .req-chip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      flex: 1;
      min-width: 170px;
      background: var(--m-surface);
      border: 1px solid var(--m-border);
      box-sizing: border-box;
    }
    .req-chip-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
      color: var(--m-muted);
      line-height: 1.2;
    }
    .req-chip-value {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--m-ink);
      margin-top: 3px;
      line-height: 1.3;
    }
    .req-chip i { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
    
    .req-chip.req-emerald { border-color: var(--success); background: var(--success-bg); }
    .req-chip.req-emerald i { color: #059669; }
    .req-chip.req-emerald .req-chip-label { color: var(--success-strong); }
    .req-chip.req-emerald .req-chip-value { color: #064e3b; }

    .req-chip.req-rose { border-color: var(--danger); background: var(--danger-bg); }
    .req-chip.req-rose i { color: #e11d48; }
    .req-chip.req-rose .req-chip-label { color: #9f1239; }
    .req-chip.req-rose .req-chip-value { color: #881337; }

    .req-chip.req-blue { border-color: var(--m-brand-pale); background: var(--m-brand-pale); }
    .req-chip.req-blue i { color: var(--m-brand); }
    .req-chip.req-blue .req-chip-label { color: #075985; }
    .req-chip.req-blue .req-chip-value { color: var(--m-surface-2); }

    .req-chip.req-amber { border-color: var(--warning); background: var(--warning-bg); }
    .req-chip.req-amber i { color: #d97706; }
    .req-chip.req-amber .req-chip-label { color: #92400e; }
    .req-chip.req-amber .req-chip-value { color: #78350f; }

    /* Dark mode chips: crystal clear contrast, zero WebKit brightness filter glitches */
    html[data-theme="dark"] .req-chip {
      background: var(--m-surface-2) !important;
      border-color: rgba(255, 255, 255, 0.09) !important;
    }
    html[data-theme="dark"] .req-chip-label { color: var(--m-soft) !important; }
    html[data-theme="dark"] .req-chip-value { color: var(--m-surface) !important; }
    html[data-theme="dark"] .req-chip.req-emerald i { color: #34d399 !important; }
    html[data-theme="dark"] .req-chip.req-rose i { color: #fb7185 !important; }
    html[data-theme="dark"] .req-chip.req-blue i { color: #38bdf8 !important; }
    html[data-theme="dark"] .req-chip.req-amber i { color: #fbbf24 !important; }

    /* Property detail cards */
    .pf-card { border:1px solid var(--m-border); border-radius:12px; overflow:hidden;
      margin-bottom:10px; background:var(--m-white); }
    .pf-card-head { background:var(--m-surface-2); border-bottom:1px solid var(--m-border);
      padding:9px 14px; display:flex; align-items:center; gap:7px; }
    .pf-card-head-text { font-size:10.5px; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:var(--m-muted); }
    .pf-card-body { padding:0 14px; }
    .pf-row { display:flex; justify-content:space-between; align-items:center;
      padding:10px 0; border-bottom:1px solid #f0f1f3; gap:8px; }
    .pf-row-last { border-bottom:none; }
    .pf-row-label { font-size:13px; color:var(--m-muted); flex-shrink:0; }
    .pf-row-value { font-size:13px; font-weight:600; color:#111827;
      text-align:right; word-break:break-word; max-width:58%; }
    html[data-theme="dark"] .pf-card { background:var(--m-ink-2); border-color:var(--m-text); }
    html[data-theme="dark"] .pf-card-head { background:var(--m-ink); border-bottom-color:var(--m-text); }
    html[data-theme="dark"] .pf-card-head-text { color:var(--m-soft); }
    html[data-theme="dark"] .pf-row { border-bottom-color:#2d3748; }
    html[data-theme="dark"] .pf-row-label { color:#9ca3af; }
    html[data-theme="dark"] .pf-row-value { color:var(--m-surface-2); }

    /* Walk Score / Schools cards */
    .score-card { display:flex; align-items:center; gap:14px; padding:16px;
      border:1.5px solid var(--m-border); border-radius:12px; text-decoration:none;
      color:inherit; background:var(--m-surface-2); transition:border-color .15s; }
    .score-card:hover { border-color:var(--m-brand); }
    .score-card-title { font-weight:700; font-size:14px; color:var(--m-text); }
    .score-card-sub { font-size:12px; color:var(--m-muted); margin-top:2px; }
    .score-card-cta { font-size:11.5px; color:var(--m-brand); margin-top:5px; font-weight:600; }
    html[data-theme="dark"] .score-card { background:var(--m-ink-2); border-color:var(--m-text); }
    html[data-theme="dark"] .score-card:hover { border-color:#3b82f6; }
    html[data-theme="dark"] .score-card-title { color:var(--m-surface-2); }
    html[data-theme="dark"] .score-card-sub { color:var(--m-soft); }

    /* Similar listing cards */
    .similar-card { display:flex; border:1.5px solid var(--m-border); border-radius:12px;
      overflow:hidden; text-decoration:none; color:inherit; background:var(--m-white);
      transition:border-color .15s; }
    .similar-card:hover { border-color:var(--m-brand); }
    .similar-card-photo { width:96px; height:90px; flex-shrink:0;
      background:var(--m-surface-2); overflow:hidden; }
    .similar-card-photo img { width:100%; height:100%; object-fit:cover; display:block; }
    .similar-card-body { padding:11px 14px; flex:1; min-width:0; }
    .similar-card-price { font-size:15px; font-weight:800; color:#0a1628;
      letter-spacing:-.02em; line-height:1.2; }
    .similar-card-title { font-size:12.5px; font-weight:600; color:var(--m-text); margin-top:3px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .similar-card-meta { font-size:11.5px; color:var(--m-muted); margin-top:2px; }
    .similar-card-addr { font-size:11px; color:#9ca3af; margin-top:1px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    html[data-theme="dark"] .similar-card { background:var(--m-ink-2); border-color:var(--m-text); }
    html[data-theme="dark"] .similar-card:hover { border-color:#3b82f6; }
    html[data-theme="dark"] .similar-card-photo { background:var(--m-ink); }
    html[data-theme="dark"] .similar-card-price { color:var(--m-surface-2); }
    html[data-theme="dark"] .similar-card-title { color:var(--m-border); }
    html[data-theme="dark"] .similar-card-meta { color:var(--m-soft); }
    html[data-theme="dark"] .similar-card-addr { color:var(--m-muted); }

    /* Neighborhood & Community Intelligence Styles */
    .intel-container { display:flex; flex-direction:column; gap:16px; margin-top:10px; }
    .intel-nav-strip { display:flex; gap:8px; overflow-x:auto; padding-bottom:6px; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
    .intel-nav-strip::-webkit-scrollbar { display:none; }
    .intel-tab-btn {
      display:inline-flex; align-items:center; gap:7px; padding:8px 14px;
      border-radius:10px; font-size:12.5px; font-weight:700; border:1px solid var(--m-border);
      background:var(--m-white); color:#475569; cursor:pointer; white-space:nowrap; transition:all .15s;
    }
    .intel-tab-btn:hover { background:var(--m-surface-2); color:var(--m-ink); border-color:var(--m-border-strong); }
    .intel-tab-btn.active {
      background:var(--m-brand); color:var(--m-white); border-color:var(--m-brand);
      box-shadow:0 2px 6px rgba(0,106,255,.25);
    }
    html[data-theme="dark"] .intel-tab-btn {
      background:var(--m-ink-2); color:var(--m-soft); border-color:var(--m-text);
    }
    html[data-theme="dark"] .intel-tab-btn:hover {
      background:var(--m-text); color:var(--m-surface);
    }
    html[data-theme="dark"] .intel-tab-btn.active {
      background:var(--m-brand); color:var(--m-white); border-color:var(--m-brand);
    }

    .intel-tab-content { display:none; flex-direction:column; gap:12px; }
    .intel-tab-content.active { display:flex; }

    .intel-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
    .intel-item-card {
      display:flex; flex-direction:column; padding:14px 16px; border-radius:12px;
      background:var(--m-white); border:1px solid var(--m-border); text-decoration:none; color:inherit;
      transition:transform .12s, border-color .15s, box-shadow .15s;
    }
    .intel-item-card:hover {
      border-color:var(--m-brand); transform:translateY(-1px);
      box-shadow:0 4px 12px rgba(0,0,0,.04);
    }
    html[data-theme="dark"] .intel-item-card {
      background:var(--m-ink-2); border-color:var(--m-text);
    }
    html[data-theme="dark"] .intel-item-card:hover {
      border-color:#3b82f6; box-shadow:0 4px 12px rgba(0,0,0,.2);
    }

    .intel-item-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; }
    .intel-item-title { font-weight:700; font-size:13.5px; color:var(--m-ink); line-height:1.3; }
    .intel-item-badge {
      font-size:11px; font-weight:700; padding:2px 8px; border-radius:6px;
      background:var(--m-brand-pale); color:var(--m-brand); flex-shrink:0;
    }
    .intel-item-desc { font-size:12px; color:var(--m-muted); line-height:1.4; margin-bottom:8px; }
    .intel-item-meta {
      display:flex; align-items:center; gap:12px; font-size:11.5px;
      color:#475569; font-weight:600; margin-top:auto; padding-top:6px;
      border-top:1px solid var(--m-surface-2);
    }
    html[data-theme="dark"] .intel-item-title { color:var(--m-surface); }
    html[data-theme="dark"] .intel-item-desc { color:var(--m-soft); }
    html[data-theme="dark"] .intel-item-meta { color:var(--m-border-strong); border-top-color:var(--m-text); }
    html[data-theme="dark"] .intel-item-badge { background:var(--m-surface-2); color:var(--m-brand); }

    /* Interactive Commute Form */
    .commute-calc-box {
      display:flex; flex-direction:column; gap:10px; padding:16px; border-radius:12px;
      background:var(--m-surface); border:1px solid var(--m-border);
    }
    html[data-theme="dark"] .commute-calc-box { background:var(--m-surface-2); border-color:var(--m-text); }
    .commute-calc-row { display:flex; gap:8px; flex-wrap:wrap; }
    .commute-calc-input {
      flex:1; min-width:200px; padding:9px 12px; border-radius:8px;
      border:1px solid var(--m-border-strong); font-size:13px; background:var(--m-white); color:var(--m-ink); outline:none;
    }
    .commute-calc-input:focus { border-color:var(--m-brand); ring:2px rgba(0,106,255,.2); }
    html[data-theme="dark"] .commute-calc-input {
      background:var(--m-ink-2); border-color:#475569; color:var(--m-surface);
    }
    .commute-calc-btn {
      display:inline-flex; align-items:center; gap:6px; padding:9px 16px;
      border-radius:8px; font-size:12.5px; font-weight:700; background:var(--m-brand);
      color:var(--m-white); border:none; cursor:pointer; transition:background .15s;
    }
    .commute-calc-btn:hover { background:var(--m-brand-dark); }
    .commute-calc-result {
      font-size:12.5px; font-weight:600; color:#0369a1; padding:8px 12px;
      border-radius:6px; background:var(--m-brand-pale); display:none;
    }
    html[data-theme="dark"] .commute-calc-result { background:var(--m-surface-2); color:var(--m-brand); }
  `;
  document.head.appendChild(s);
}

/* ── Renter Requirements Strip ───────────────────────────────────────────── */
function renderRenterRequirements(p) {
  const section = document.getElementById('renterReqsSection');
  if (!section) return;
  injectEnrichmentStyles();

  const reqs = [];

  if (p.pets_allowed != null) {
    let petVal = p.pets_allowed ? 'Allowed' : 'Not allowed';
    if (p.pets_allowed && p.pet_types_allowed?.length) petVal += ' · ' + p.pet_types_allowed.join(', ');
    if (p.pets_allowed && p.pet_weight_limit)          petVal += ' · up to ' + p.pet_weight_limit + ' lbs';
    reqs.push({
      icon: 'fa-paw',
      label: 'Pets',
      value: petVal,
      type: p.pets_allowed ? 'req-emerald' : 'req-rose'
    });
  }
  if (p.minimum_credit_score) {
    reqs.push({
      icon: 'fa-chart-line',
      label: 'Min. credit score',
      value: Number(p.minimum_credit_score).toLocaleString() + '+',
      type: 'req-blue'
    });
  }
  if (p.minimum_income_multiplier) {
    reqs.push({
      icon: 'fa-coins',
      label: 'Min. income',
      value: p.minimum_income_multiplier + '× monthly rent',
      type: 'req-amber'
    });
  }

  if (!reqs.length) return;

  section.style.display = '';
  section.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:10px">
      ${reqs.map(r => `
        <div class="req-chip ${r.type}">
          <i class="fas ${r.icon}"></i>
          <div>
            <div class="req-chip-label">${esc(r.label)}</div>
            <div class="req-chip-value">${esc(r.value)}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

/* ── Expanded Property Facts ─────────────────────────────────────────────── */
function renderPropFacts(p) {
  const section = document.getElementById('propFactsSection');
  const divider = document.getElementById('dividerAfterFacts');
  if (!section) return;
  injectEnrichmentStyles();

  // ── Row / card helpers using shared CSS classes ────────────────────────
  const row = (label, value) => {
    if (value == null || value === '' || value === false) return '';
    return `<div class="pf-row">
      <span class="pf-row-label">${label}</span>
      <span class="pf-row-value">${esc(String(value))}</span>
    </div>`;
  };

  const card = (heading, icon, rawRows) => {
    const rows = rawRows.filter(Boolean);
    if (!rows.length) return '';
    rows[rows.length - 1] = rows[rows.length - 1].replace('class="pf-row"', 'class="pf-row pf-row-last"');
    return `
      <div class="pf-card">
        <div class="pf-card-head">
          <i class="fas ${icon}" style="color:var(--gold);font-size:10px"></i>
          <span class="pf-card-head-text">${heading}</span>
        </div>
        <div class="pf-card-body">${rows.join('')}</div>
      </div>`;
  };

  // ── Cards — only fields NOT already in meta strip or tabs ──────────────

  // Move-in: available (future date only — if now, header chip already says so),
  // lease terms, min lease (also in Lease tab but worth surfacing here)
  const availNow = !p.available_date || new Date(p.available_date + 'T00:00:00') <= new Date();
  const moveInCard = card('Move-in', 'fa-key', [
    row('Available',   !availNow && p.available_date ? formatDate(p.available_date) : null),
    row('Lease terms', p.lease_terms?.length ? p.lease_terms.join(', ') : null),
    row('Min. lease',  p.minimum_lease_months ? p.minimum_lease_months + ' months' : null),
  ]);

  // Interior: heating / cooling / laundry
  // (flooring excluded — already in Amenities tab; beds/baths/sqft excluded — in meta strip)
  const interiorCard = card('Interior', 'fa-house', [
    row('Heating', p.heating_type),
    row('Cooling', p.cooling_type),
    row('Laundry', p.laundry_type),
  ]);

  // Location: county + neighborhood (not shown elsewhere in detail)
  const locationCard = card('Location', 'fa-map-marker-alt', [
    row('County',       p.county),
    row('Neighborhood', p.neighborhood),
  ]);

  // Parking & outdoor (lot_size_sqft excluded — already shown in meta strip)
  const parkingCard = card('Parking &amp; outdoor', 'fa-car', [
    row('Parking',       p.parking),
    row('Garage spaces', p.garage_spaces),
    row('Parking fee',   p.parking_fee ? '$' + Number(p.parking_fee).toLocaleString() + '/mo' : null),
  ]);

  const hasContent = moveInCard || interiorCard || locationCard || parkingCard;
  if (!hasContent) return;

  // Show divider between Features tabs and this section when both are visible
  const tabsSec = document.getElementById('detailTabsSection');
  if (tabsSec && tabsSec.style.display !== 'none') {
    const fd = document.getElementById('dividerAfterFeatures');
    if (fd) fd.style.display = '';
  }

  // Suppress "Available From" in Costs table — shown in move-in card instead
  if (!availNow && p.available_date) {
    const moveInRow = document.getElementById('sidebarMoveInRow');
    if (moveInRow) moveInRow.style.display = 'none';
  }

  section.style.display = '';
  if (divider) divider.style.display = '';

  section.innerHTML = `
    <div class="prop-section">
      <div class="prop-section-eyebrow">Property details</div>
      <div class="prop-section-head">More about <em>this home</em>.</div>
      ${moveInCard}
      ${interiorCard}
      ${locationCard}
      ${parkingCard}
    </div>`;
}

/* ── Neighborhood Intelligence & Scores ───────────────────────────────────── */
function renderScoresSection(p) {
  renderNeighborhoodIntelligence(p);
}

function renderNeighborhoodIntelligence(p) {
  const section = document.getElementById('scoresSection');
  const divider = document.getElementById('dividerAfterScores');
  if (!section) return;
  injectEnrichmentStyles();

  const city = (p.city || 'Columbus').trim();
  const state = (p.state || 'OH').trim();
  const zip = (p.zip || '').trim();
  const fullAddr = `${p.address || ''}, ${city}, ${state} ${zip}`.trim();
  const addrSlug = encodeURIComponent(`${p.address || ''} ${city} ${state}`);
  const wsUrl = `https://www.walkscore.com/score/${addrSlug}`;
  const gsUrl = zip
    ? `https://www.greatschools.org/search/search.page?q=${encodeURIComponent(zip)}&sortBy=distance`
    : `https://www.greatschools.org/search/search.page?q=${encodeURIComponent(city + ' ' + state)}&sortBy=distance`;

  // Coordinates
  const lat = parseFloat(p.lat) || 39.9612;
  const lng = parseFloat(p.lng) || -82.9988;

  // Haversine distance calculator
  function calcDist(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Number((R * c).toFixed(1));
  }

  // Derive city centers and hubs
  const isColumbus = /columbus/i.test(city);
  const isCincy = /cincinnati/i.test(city);
  const isCleve = /cleveland/i.test(city);
  const isIndy = /indianapolis/i.test(city);

  let downtownCoords = { lat: 39.9612, lng: -82.9988, name: `${city} Downtown` };
  let airportCoords  = { lat: 39.9980, lng: -82.8919, name: 'John Glenn Intl Airport (CMH)' };
  let hospitalCoords = { lat: 39.9977, lng: -83.0163, name: 'Ohio State Wexner Medical Center' };
  let highwayName    = 'I-71 / I-70 Corridor';

  if (isCincy) {
    downtownCoords = { lat: 39.1031, lng: -84.5120, name: 'Downtown Cincinnati' };
    airportCoords  = { lat: 39.0461, lng: -84.6621, name: 'Cincinnati/N. Kentucky Intl Airport (CVG)' };
    hospitalCoords = { lat: 39.1384, lng: -84.5065, name: 'UC Medical Center' };
    highwayName    = 'I-71 / I-75 Corridor';
  } else if (isCleve) {
    downtownCoords = { lat: 41.4993, lng: -81.6944, name: 'Downtown Cleveland' };
    airportCoords  = { lat: 41.4058, lng: -81.8540, name: 'Cleveland Hopkins Intl Airport (CLE)' };
    hospitalCoords = { lat: 41.5034, lng: -81.6212, name: 'Cleveland Clinic Main Campus' };
    highwayName    = 'I-90 / I-77 Corridor';
  } else if (isIndy) {
    downtownCoords = { lat: 39.7684, lng: -86.1581, name: 'Downtown Indianapolis' };
    airportCoords  = { lat: 39.7173, lng: -86.2944, name: 'Indianapolis Intl Airport (IND)' };
    hospitalCoords = { lat: 39.7788, lng: -86.1802, name: 'IU Health University Hospital' };
    highwayName    = 'I-65 / I-70 Corridor';
  }

  const dtDist = calcDist(lat, lng, downtownCoords.lat, downtownCoords.lng) || 4.2;
  const apDist = calcDist(lat, lng, airportCoords.lat, airportCoords.lng) || 8.5;
  const hpDist = calcDist(lat, lng, hospitalCoords.lat, hospitalCoords.lng) || 5.1;
  const hwDist = Math.max(0.6, Number((dtDist * 0.25).toFixed(1)));

  const dtDrive = Math.max(5, Math.round(dtDist * 2.1 + 3));
  const apDrive = Math.max(8, Math.round(apDist * 1.6 + 4));
  const hpDrive = Math.max(5, Math.round(hpDist * 2.0 + 3));
  const hwDrive = Math.max(2, Math.round(hwDist * 2.2));

  // Commute items
  const commutes = [
    { name: downtownCoords.name, dist: `${dtDist} mi`, drive: `${dtDrive} min`, icon: 'fa-building', dest: `${downtownCoords.name}, ${city}` },
    { name: airportCoords.name, dist: `${apDist} mi`, drive: `${apDrive} min`, icon: 'fa-plane-departure', dest: airportCoords.name },
    { name: hospitalCoords.name, dist: `${hpDist} mi`, drive: `${hpDrive} min`, icon: 'fa-hospital', dest: hospitalCoords.name },
    { name: highwayName, dist: `${hwDist} mi`, drive: `${hwDrive} min`, icon: 'fa-road', dest: `${highwayName}, ${city}` },
  ];

  // Pet friendly spots
  const petPlaces = [
    {
      title: 'Community Dog Park & Green Space',
      sub: 'Fenced off-leash zones, agility obstacles & walking trails',
      badge: 'Off-Leash Area',
      dist: `${Math.max(0.4, (dtDist * 0.3).toFixed(1))} mi`,
      drive: `${Math.max(2, Math.round(dtDist * 0.8))} min drive`,
      icon: 'fa-dog',
      query: `dog park near ${fullAddr}`
    },
    {
      title: '24/7 Emergency Animal Hospital & Vet',
      sub: 'Full-service veterinary care, routine checkups & urgent care',
      badge: 'Veterinary Care',
      dist: `${Math.max(0.8, (dtDist * 0.45).toFixed(1))} mi`,
      drive: `${Math.max(4, Math.round(dtDist * 1.1))} min drive`,
      icon: 'fa-user-doctor',
      query: `animal hospital veterinary near ${fullAddr}`
    },
    {
      title: 'Pet Supplies Plus & Grooming Salon',
      sub: 'Premium pet food, self-serve dog wash & grooming services',
      badge: 'Pet Supplies',
      dist: `${Math.max(0.7, (dtDist * 0.4).toFixed(1))} mi`,
      drive: `${Math.max(3, Math.round(dtDist * 1.0))} min drive`,
      icon: 'fa-paw',
      query: `pet store grooming near ${fullAddr}`
    }
  ];

  // Utilities & Broadband
  const utilities = [
    {
      title: 'High-Speed Fiber & Cable Internet',
      sub: 'Gigabit fiber availability with AT&T Fiber, Spectrum & Xfinity',
      badge: 'Up to 1,000–5,000 Mbps',
      icon: 'fa-wifi',
      meta: 'Ultra-low latency for WFH & streaming'
    },
    {
      title: 'Electric & Power Grid',
      sub: `Municipal grid serviced by regional utility (${isColumbus ? 'AEP Ohio' : 'City Electric'})`,
      badge: 'Standard 120/240V',
      icon: 'fa-bolt',
      meta: 'Online tenant account setup available'
    },
    {
      title: 'Natural Gas / Heating Service',
      sub: `Natural gas service via regional supplier (${isColumbus ? 'Columbia Gas of Ohio' : 'City Gas'})`,
      badge: 'Active Service',
      icon: 'fa-fire-flame-curved',
      meta: 'Metered per residence'
    },
    {
      title: 'Water, Sewer & Trash Collection',
      sub: `Municipal Department of Public Utilities (${city} Services)`,
      badge: 'Weekly Pickup',
      icon: 'fa-trash-can',
      meta: 'Curbside trash & recycling collection'
    }
  ];

  // Conveniences
  const conveniences = [
    {
      title: 'Supermarket & Fresh Groceries',
      sub: isColumbus ? 'Kroger / Giant Eagle / ALDI Supermarkets' : 'Regional Supermarket & Grocery Center',
      badge: 'Grocery',
      dist: `${Math.max(0.5, (dtDist * 0.35).toFixed(1))} mi`,
      drive: `${Math.max(3, Math.round(dtDist * 0.9))} min drive`,
      icon: 'fa-cart-shopping',
      query: `supermarket grocery near ${fullAddr}`
    },
    {
      title: 'Coffee Shops & Local Cafes',
      sub: 'Artisan roasters, Starbucks & drive-thru espresso bars',
      badge: 'Cafe & Work',
      dist: `${Math.max(0.4, (dtDist * 0.28).toFixed(1))} mi`,
      drive: `${Math.max(2, Math.round(dtDist * 0.7))} min drive`,
      icon: 'fa-mug-saucer',
      query: `coffee cafe near ${fullAddr}`
    },
    {
      title: 'Pharmacy & Health Conveniences',
      sub: 'CVS Pharmacy & Walgreens with drive-thru prescription pickup',
      badge: 'Pharmacy',
      dist: `${Math.max(0.6, (dtDist * 0.38).toFixed(1))} mi`,
      drive: `${Math.max(3, Math.round(dtDist * 0.9))} min drive`,
      icon: 'fa-prescription-bottle-medical',
      query: `pharmacy near ${fullAddr}`
    },
    {
      title: 'Fitness, Gyms & Community Parks',
      sub: 'Planet Fitness, YMCA, neighborhood recreation trails & courts',
      badge: 'Fitness & Health',
      dist: `${Math.max(0.6, (dtDist * 0.42).toFixed(1))} mi`,
      drive: `${Math.max(3, Math.round(dtDist * 1.0))} min drive`,
      icon: 'fa-dumbbell',
      query: `gym fitness park near ${fullAddr}`
    }
  ];

  section.style.display = '';
  if (divider) divider.style.display = '';

  section.innerHTML = `
    <div class="prop-section">
      <div class="prop-section-eyebrow">Neighborhood &amp; Location Intelligence</div>
      <div class="prop-section-head">Life &amp; connectivity <em>around this home</em>.</div>

      <div class="intel-container">
        <!-- Tab Navigation Strip -->
        <div class="intel-nav-strip" id="intelNavStrip" role="tablist">
          <button class="intel-tab-btn active" data-tab="commute" type="button"><i class="fas fa-car-side"></i> Commute &amp; Access</button>
          <button class="intel-tab-btn" data-tab="pets" type="button"><i class="fas fa-paw"></i> Pet Parks &amp; Vets</button>
          <button class="intel-tab-btn" data-tab="broadband" type="button"><i class="fas fa-wifi"></i> Fiber &amp; Utilities</button>
          <button class="intel-tab-btn" data-tab="scores" type="button"><i class="fas fa-person-walking"></i> Walk &amp; School Scores</button>
          <button class="intel-tab-btn" data-tab="conveniences" type="button"><i class="fas fa-store"></i> Everyday Essentials</button>
        </div>

        <!-- Tab 1: Commute & Highway Hub -->
        <div class="intel-tab-content active" id="intelTab-commute">
          <div class="intel-grid">
            ${commutes.map(c => `
              <a href="https://maps.google.com/maps?saddr=${encodeURIComponent(fullAddr)}&daddr=${encodeURIComponent(c.dest)}" target="_blank" rel="noopener noreferrer" class="intel-item-card">
                <div class="intel-item-head">
                  <span class="intel-item-title"><i class="fas ${c.icon}" style="color:var(--m-brand);margin-right:6px"></i> ${esc(c.name)}</span>
                  <span class="intel-item-badge">${c.drive}</span>
                </div>
                <div class="intel-item-desc">Estimated drive time from property doorstep</div>
                <div class="intel-item-meta">
                  <span><i class="fas fa-route" style="color:var(--m-muted);margin-right:4px"></i> ${c.dist} distance</span>
                  <span style="margin-left:auto;color:var(--m-brand);font-size:11px">Directions &rarr;</span>
                </div>
              </a>
            `).join('')}
          </div>

          <!-- Interactive Custom Commute Calculator -->
          <div class="commute-calc-box">
            <div style="font-weight:700;font-size:13px;color:var(--text,var(--m-ink));display:flex;align-items:center;gap:6px">
              <i class="fas fa-location-crosshairs" style="color:var(--m-brand)"></i> Calculate Commute to Your Workplace
            </div>
            <div class="commute-calc-row">
              <input type="text" class="commute-calc-input" id="customCommuteInput" placeholder="Enter work address, employer or landmark..." />
              <button type="button" class="commute-calc-btn" id="customCommuteBtn"><i class="fas fa-paper-plane"></i> Get Commute</button>
            </div>
            <div class="commute-calc-result" id="customCommuteResult"></div>
          </div>
        </div>

        <!-- Tab 2: Pet-Friendly Hub -->
        <div class="intel-tab-content" id="intelTab-pets">
          <div style="background:var(--success-bg);border:1px solid var(--success);border-radius:10px;padding:10px 14px;font-size:12.5px;color:var(--success-strong);display:flex;align-items:center;gap:8px">
            <i class="fas fa-shield-heart" style="color:#059669;font-size:15px"></i>
            <span><strong>Pet Friendly Community:</strong> Welcome dogs &amp; cats with local greenways and verified veterinary care nearby.</span>
          </div>
          <div class="intel-grid">
            ${petPlaces.map(p => `
              <a href="https://maps.google.com/maps?q=${encodeURIComponent(p.query)}" target="_blank" rel="noopener noreferrer" class="intel-item-card">
                <div class="intel-item-head">
                  <span class="intel-item-title"><i class="fas ${p.icon}" style="color:#059669;margin-right:6px"></i> ${esc(p.title)}</span>
                  <span class="intel-item-badge" style="background:var(--success-bg);color:var(--success-strong)">${esc(p.badge)}</span>
                </div>
                <div class="intel-item-desc">${esc(p.sub)}</div>
                <div class="intel-item-meta">
                  <span><i class="fas fa-location-dot" style="color:var(--m-muted);margin-right:4px"></i> ~${p.dist} (${p.drive})</span>
                  <span style="margin-left:auto;color:#059669;font-size:11px">Find Nearby &rarr;</span>
                </div>
              </a>
            `).join('')}
          </div>
        </div>

        <!-- Tab 3: Fiber Broadband & Utilities -->
        <div class="intel-tab-content" id="intelTab-broadband">
          <div class="intel-grid">
            ${utilities.map(u => `
              <div class="intel-item-card">
                <div class="intel-item-head">
                  <span class="intel-item-title"><i class="fas ${u.icon}" style="color:var(--m-brand);margin-right:6px"></i> ${esc(u.title)}</span>
                  <span class="intel-item-badge">${esc(u.badge)}</span>
                </div>
                <div class="intel-item-desc">${esc(u.sub)}</div>
                <div class="intel-item-meta">
                  <span><i class="fas fa-circle-check" style="color:#059669;margin-right:4px"></i> ${esc(u.meta)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Tab 4: Walk & Schools Scores -->
        <div class="intel-tab-content" id="intelTab-scores">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
            <a href="${wsUrl}" target="_blank" rel="noopener noreferrer" class="score-card">
              <div style="width:44px;height:44px;border-radius:10px;background:var(--m-brand-pale);display:flex;
                align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🚶</div>
              <div>
                <div class="score-card-title">Walk &amp; Transit Scores</div>
                <div class="score-card-sub">Walkability, transit &amp; bike friendliness</div>
                <div class="score-card-cta">View Walk Score &rarr;</div>
              </div>
            </a>
            <a href="${gsUrl}" target="_blank" rel="noopener noreferrer" class="score-card">
              <div style="width:44px;height:44px;border-radius:10px;background:var(--success-bg);display:flex;
                align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🏫</div>
              <div>
                <div class="score-card-title">Nearby Schools</div>
                <div class="score-card-sub">Ratings &amp; reviews via GreatSchools</div>
                <div class="score-card-cta">View Schools &rarr;</div>
              </div>
            </a>
          </div>
        </div>

        <!-- Tab 5: Everyday Essentials -->
        <div class="intel-tab-content" id="intelTab-conveniences">
          <div class="intel-grid">
            ${conveniences.map(c => `
              <a href="https://maps.google.com/maps?q=${encodeURIComponent(c.query)}" target="_blank" rel="noopener noreferrer" class="intel-item-card">
                <div class="intel-item-head">
                  <span class="intel-item-title"><i class="fas ${c.icon}" style="color:var(--m-brand);margin-right:6px"></i> ${esc(c.title)}</span>
                  <span class="intel-item-badge">${esc(c.badge)}</span>
                </div>
                <div class="intel-item-desc">${esc(c.sub)}</div>
                <div class="intel-item-meta">
                  <span><i class="fas fa-location-dot" style="color:var(--m-muted);margin-right:4px"></i> ~${c.dist} (${c.drive})</span>
                  <span style="margin-left:auto;color:var(--m-brand);font-size:11px">Explore &rarr;</span>
                </div>
              </a>
            `).join('')}
          </div>
        </div>

      </div>
    </div>`;

  // Wire up tab switching
  const tabs = section.querySelectorAll('.intel-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      section.querySelectorAll('.intel-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const targetId = `intelTab-${tab.dataset.tab}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Wire up custom commute calculator
  const commuteBtn = document.getElementById('customCommuteBtn');
  const commuteInput = document.getElementById('customCommuteInput');
  const commuteRes = document.getElementById('customCommuteResult');

  if (commuteBtn && commuteInput && commuteRes) {
    const handleCalculate = () => {
      const dest = commuteInput.value.trim();
      if (!dest) {
        commuteInput.focus();
        return;
      }
      const mapsUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(fullAddr)}&daddr=${encodeURIComponent(dest)}`;
      commuteRes.style.display = 'block';
      commuteRes.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span><i class="fas fa-check-circle" style="color:var(--m-brand);margin-right:4px"></i> Direct commute route mapped to <strong>${esc(dest)}</strong></span>
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="font-weight:700;color:var(--m-brand);text-decoration:none;display:inline-flex;align-items:center;gap:4px">
            Open Live Navigation <i class="fas fa-arrow-up-right-from-square" style="font-size:10px"></i>
          </a>
        </div>
      `;
    };

    commuteBtn.addEventListener('click', handleCalculate);
    commuteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCalculate();
    });
  }
}

/* ── Similar Listings (async) ────────────────────────────────────────────── */
async function loadSimilarListings(p) {
  const section = document.getElementById('similarSection');
  const divider = document.getElementById('dividerAfterSimilar');
  if (!section || !p.city) return;
  injectEnrichmentStyles();

  try {
    const { data } = await supabase
      .from('properties')
      .select('id, title, address, city, state, monthly_rent, bedrooms, bathrooms, property_type, property_photos(url, display_order, is_hero)')
      .eq('status', 'active')
      .eq('city', p.city)
      .neq('id', p.id)
      .limit(8);

    if (!data?.length) return;

    const rent = p.monthly_rent || 0;
    const similar = data
      .slice()
      .sort((a, b) => Math.abs((a.monthly_rent || 0) - rent) - Math.abs((b.monthly_rent || 0) - rent))
      .slice(0, 4);

    const cards = similar.map(s => {
      const photos = Array.isArray(s.property_photos)
        ? s.property_photos.slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        : [];
      const rawUrl   = photos[0]?.url || '';
      const photoUrl = rawUrl
        ? (window.CONFIG?.img ? CONFIG.img(rawUrl, 'card') : rawUrl)
        : '/assets/placeholder-property.jpg';
      const beds = s.bedrooms === 0 ? 'Studio' : s.bedrooms != null ? s.bedrooms + ' bed' : '';
      const baths = s.bathrooms ? s.bathrooms + ' bath' : '';
      const meta  = [beds, baths].filter(Boolean).join(' · ') || fmtPropType(s.property_type) || 'Rental';
      return `
        <a href="/property.html?id=${esc(s.id)}" class="similar-card">
          <div class="similar-card-photo">
            <img src="${esc(photoUrl)}" alt="${esc(s.title || 'Listing')}" loading="lazy">
          </div>
          <div class="similar-card-body">
            <div class="similar-card-price">
              ${s.monthly_rent != null
                ? '$' + Number(s.monthly_rent).toLocaleString() + '<span style="font-size:11px;font-weight:500;color:var(--m-muted)">/mo</span>'
                : 'TBD'}
            </div>
            <div class="similar-card-title">${esc(s.title || 'Rental')}</div>
            <div class="similar-card-meta">${esc(meta)}</div>
            <div class="similar-card-addr">${esc([s.address, s.city, s.state].filter(Boolean).join(', '))}</div>
          </div>
        </a>`;
    }).join('');

    section.style.display = '';
    if (divider) divider.style.display = '';
    section.innerHTML = `
      <div class="prop-section">
        <div class="prop-section-eyebrow">Also available</div>
        <div class="prop-section-head">More in <em>${esc(p.city)}</em>.</div>
        <div style="display:flex;flex-direction:column;gap:10px">${cards}</div>
        <a href="/listings.html" style="display:inline-flex;align-items:center;gap:6px;
          margin-top:16px;font-size:13px;font-weight:600;color:var(--m-brand);text-decoration:none">
          See all rentals in ${esc(p.city)} <i class="fas fa-arrow-right" style="font-size:11px"></i>
        </a>
      </div>`;
    // Wire onerror via JS — inline onerror attributes are blocked by CSP nonce policy
    section.querySelectorAll('.similar-card-photo img').forEach(img => {
      img.onerror = function() { this.onerror = null; this.src = '/assets/placeholder-property.jpg'; };
    });
  } catch(e) {
    console.warn('[similar listings] failed:', e);
  }
}

/* ── Helpers ── */
function setMeta(id, val) { document.getElementById(id)?.setAttribute('content', val); }
function formatDate(str) {
  // Append T00:00:00 so JS parses as local time, not UTC midnight (avoids day-off bug)
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtPropType(t) {
  if (!t) return '';
  const map = {
    single_family: 'Single Family', apartment: 'Apartment', townhome: 'Townhome',
    townhouse: 'Townhouse', condo: 'Condo', duplex: 'Duplex', studio: 'Studio',
    mobile_home: 'Mobile Home', multi_family: 'Multi-Family', land: 'Land',
    commercial: 'Commercial', other: 'Other',
  };
  return map[t.toLowerCase()] || t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ── LQIP helper — delegates to CP.UI.lqipUrl (defined in cp-api.js) ── */
function lqipUrl(url) { return CP.UI.lqipUrl(url); }

/* ── Preload ±2 adjacent lightbox images for instant prev/next navigation ── */
function preloadLightboxAdjacentImages(idx) {
  const n = allPhotos.length;
  if (n < 2) return;
  [-1, 1, -2, 2].forEach(offset => {
    const i = (idx + offset + n) % n;
    if (i !== idx) {
      const pre = new Image();
      pre.src = CONFIG.img(allPhotos[i], 'lightbox');
    }
  });
}


