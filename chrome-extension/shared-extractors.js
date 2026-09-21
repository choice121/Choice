// ============================================================
// Choice Properties — Multi-site Listing Extractor Registry
// GENERATED FILE — DO NOT EDIT DIRECTLY.
// Edit src/extractors/shared-extractors.js and run:
//   node scripts/build-extractors.js
// ============================================================
// ============================================================
// Choice Properties — Canonical Multi-site Listing Extractor
// ============================================================
// THIS IS THE SINGLE SOURCE OF TRUTH for all listing extraction.
// Supported sites: Zillow, Realtor.com, Apartments.com, Redfin
// Multi-Tier Resilient Ingestion: NextData -> JSON-LD -> Meta -> DOM
// ============================================================
(function (global) {
  'use strict';

  // ── DOM helpers ──────────────────────────────────────────────
  function getNextData(source) {
    if (!source) return null;
    if (typeof source.getElementById === 'function') {
      const el = source.getElementById('__NEXT_DATA__');
      if (!el) return null;
      try { return JSON.parse(el.textContent); } catch (_) { return null; }
    }
    if (typeof source === 'string') {
      try { return JSON.parse(source); } catch (_) { return null; }
    }
    if (typeof source === 'object') {
      return source;
    }
    return null;
  }

  function getJsonLdData(doc) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const items = [];
    scripts.forEach(s => {
      try {
        const raw = JSON.parse(s.textContent || '{}');
        if (Array.isArray(raw)) items.push(...raw);
        else if (raw['@graph'] && Array.isArray(raw['@graph'])) items.push(...raw['@graph']);
        else items.push(raw);
      } catch (_) {}
    });
    return items;
  }

  function walk(obj, path) {
    let node = obj;
    for (const key of path) {
      if (!node || typeof node !== 'object') return null;
      node = node[key];
    }
    return node;
  }

  // ── Value helpers ────────────────────────────────────────────
  function bestJpeg(ms) {
    const jpegs = (ms && ms.jpeg) || [];
    let best = null, bestW = 0;
    for (const j of jpegs) { if ((j.width || 0) > bestW) { bestW = j.width || 0; best = j.url || null; } }
    return best;
  }

  // Zillow CDN serves the same photo at multiple variant suffixes.
  // Dedup by base image hash, keep highest-resolution variant.
  function dedupZillowPhotos(urls) {
    const byHash = new Map();
    const scoreOf = (u) => {
      if (/-uncropped_scaled_within_1536_1152\.jpg/.test(u)) return 3;
      if (/-cc_ft_1536\.jpg/.test(u)) return 2;
      if (/-p_h\.jpg/.test(u)) return 1;
      return 0;
    };
    for (const u of urls) {
      if (!u || typeof u !== 'string') continue;
      const m = u.match(/\/fp\/([a-f0-9]{16,})-/i);
      const hash = m ? m[1] : u;
      const score = scoreOf(u);
      const cur = byHash.get(hash);
      if (!cur || score > cur.score) byHash.set(hash, { url: u, score });
    }
    return [...byHash.values()].map(v => v.url);
  }

  function collectPhotos(prop) {
    const photos = [], seen = new Set();
    const add = (u) => { if (u && typeof u === 'string' && u.startsWith('http') && !seen.has(u)) { photos.push(u); seen.add(u); } };
    for (const p of (prop.responsivePhotosOriginalRatio || [])) add(bestJpeg(p.mixedSources) || p.url);
    for (const p of (prop.responsivePhotos || []))              add(bestJpeg(p.mixedSources) || p.url);
    for (const p of (prop.hugePhotos || prop.largePhotos || [])) add(typeof p === 'string' ? p : (p && p.url));
    for (const p of (prop.photos || []))                         add(typeof p === 'string' ? p : (p && p.url));
    add(prop.desktopWebHdpImageLink);
    add(prop.heroImage);
    return dedupZillowPhotos(photos).slice(0, 50);
  }

  function collectPhotoUrls(prop, keys) {
    const photos = [], seen = new Set();
    const add = (u) => { if (u && typeof u === 'string' && u.startsWith('http') && !seen.has(u)) { photos.push(u); seen.add(u); } };
    for (const key of keys) {
      for (const p of (prop[key] || [])) add(typeof p === 'string' ? p : (p && (p.href || p.url)));
    }
    return photos.slice(0, 50);
  }

  function parseDate(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (/now|immediate|today|ready|available/i.test(s)) {
      return new Date().toISOString().slice(0, 10);
    }
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1];
    if (/^\d{13}$/.test(s)) { try { return new Date(parseInt(s, 10)).toISOString().slice(0, 10); } catch (_) {} }
    if (/^\d{10}$/.test(s)) { try { return new Date(parseInt(s, 10) * 1000).toISOString().slice(0, 10); } catch (_) {} }
    try { const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); } catch (_) {}
    return s.slice(0, 40);
  }

  function safeI(v) {
    if (!v && v !== 0) return null;
    const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) || n <= 0 ? null : n;
  }

  function parseRent(rawPrice, rentZestimate) {
    let rent = null;
    if (typeof rawPrice === 'number' && rawPrice > 0) rent = rawPrice;
    else if (rawPrice) { const d = String(rawPrice).replace(/[^0-9]/g, ''); rent = d ? parseInt(d, 10) : null; }
    if (!rent && rentZestimate) rent = parseInt(String(rentZestimate), 10) || null;
    return rent;
  }

  const TYPE_MAP = {
    SINGLE_FAMILY: 'SINGLE_FAMILY', MULTI_FAMILY: 'MULTI_FAMILY', CONDO: 'CONDOS',
    CONDO_TOWNHOME: 'CONDOS', TOWNHOUSE: 'TOWNHOMES', APARTMENT: 'APARTMENT',
    MANUFACTURED: 'MOBILE', MOBILE: 'MOBILE', LOT: 'LAND', LAND: 'LAND', FARM: 'FARM',
  };
  function normalizeType(homeType) {
    const t = (homeType || '').toUpperCase().replace(/[^A-Z_]/g, '_');
    return TYPE_MAP[t] || t || null;
  }
  function fmtType(t) {
    return !t ? 'Rental' : t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  function parseBaths(rawBaths, descText) {
    let baths = rawBaths != null ? parseFloat(rawBaths) : null;
    let half = null;
    if (baths != null && baths % 1 !== 0) {
      half = 1;
    }
    const text = String(descText || '').toLowerCase();
    if (baths === 1 || baths === null) {
      if (text.includes('1.5 bath') || text.includes('1 and a half bath') || text.includes('one and a half bath') || text.includes('half bath') || text.includes('powder room')) {
        baths = 1.5;
        half = 1;
      }
    } else if (baths === 2) {
      if (text.includes('2.5 bath') || text.includes('2 and a half bath') || text.includes('two and a half bath')) {
        baths = 2.5;
        half = 1;
      }
    } else if (baths === 3) {
      if (text.includes('3.5 bath') || text.includes('3 and a half bath') || text.includes('three and a half bath')) {
        baths = 3.5;
        half = 1;
      }
    }
    return { bathrooms: baths, half_bathrooms: half };
  }
  function detectPropType(homeType, descText, titleText) {
    const text = (String(descText || '') + ' ' + String(titleText || '')).toLowerCase();
    if (text.includes('1/2 duplex') || text.includes('half duplex') || text.includes('half-duplex') || text.includes('duplex') || text.includes('side-by-side')) {
      return 'DUPLEX';
    }
    if (text.includes('townhouse') || text.includes('townhome') || text.includes('rowhouse')) {
      return 'TOWNHOUSE';
    }
    const t = (homeType || '').toUpperCase().replace(/[^A-Z_]/g, '_');
    return TYPE_MAP[t] || t || 'SINGLE_FAMILY';
  }
  function buildTitle(beds, propType, city, street) {
    return city ? ((beds ? beds + 'BR ' : '') + fmtType(propType) + ' in ' + city) : (street || 'Rental Listing');
  }

  function cleanForSaleText(text) {
    if (!text) return null;
    let s = String(text);
    s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\b(?:for\s+sale|listed\s+for\s+sale|on\s+the\s+market|priced\s+to\s+sell|motivated\s+seller|mortgage|down\s*payment|fha|conventional\s+financing|va\s+loan|seller\s+financing|title\s+company|escrow|closing\s+costs?|earnest\s+money|open\s+house|investor\s+special|cash\s+flow|arv\b|opendoor\s+brokerage|make\s+an\s+offer)\b[^\n.!?]*[.!?]?/gi, ' ');
    s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\bsecurity\s+deposit\b[^\n.!?]*[.!?]?/gi, ' ');
    s = s.replace(/,\s*\./g, '.').replace(/\band\s*\./gi, '.').replace(/[ \t]{2,}/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n');
    s = s.trim();
    return s || null;
  }

  function canonicalZillowUrl(url, zpid) {
    if (!zpid) return url;
    const m = url.match(/(https?:\/\/[^/]+\/homedetails\/[^/]+)\/\d+_zpid\/?/i);
    if (m) {
      const urlZpid = (url.match(/(\d+)_zpid/i) || [])[1];
      if (urlZpid && urlZpid !== zpid) {
        return m[1] + '/' + zpid + '_zpid/';
      }
    }
    return url;
  }

  // ── Base payload ─────────────────────────────────────────────
  function basePayload(source, id, url, overrides) {
    return Object.assign({
      source, source_listing_id: id, source_url: url,
      title: null, address: null, city: null, state: null, zip: null, lat: null, lng: null,
      monthly_rent: null, bedrooms: null, bathrooms: null, half_bathrooms: null,
      square_footage: null, year_built: null, lot_size_sqft: null, floors: null,
      garage_spaces: null, total_units: null, property_type: null, description: null, original_description: null,
      neighborhood: null, county: null, location_context: null, pets_allowed: null,
      pet_types_allowed: null, available_date: null, listed_at: null, minimum_lease_months: null,
      smoking_allowed: null, security_deposit: null, pet_deposit: null, admin_fee: null,
      parking_fee: null, application_fee: null, hoa_fee: null, last_months_rent: null,
      move_in_special: null, parking: null, amenities: null, appliances: null,
      utilities_included: null, heating_type: null, cooling_type: null, laundry_type: null,
      virtual_tour_url: null, has_basement: null, has_central_air: null,
      original_image_urls: '[]', agent_name: null, broker_name: null,
      _import: 'browser-extension-v5.0-resilient'
    }, overrides);
  }

  // ── Zillow Primary NextData Extractor ─────────────────────────
  function extractZillowNextData(doc, url) {
    const nd = getNextData(doc);
    if (!nd) return null;

    let prop = null;
    const cachePaths = [
      ['props', 'pageProps', 'componentProps', 'gdpClientCache'],
      ['props', 'pageProps', 'initialData', 'gdpClientCache'],
      ['props', 'pageProps', 'gdpClientCache'],
      ['props', 'pageProps', 'initialReduxState', 'gdpClientCache'],
    ];
    for (const path of cachePaths) {
      if (prop) break;
      try {
        let node = nd;
        for (const key of path) { node = node[key]; if (!node) break; }
        if (!node) continue;
        const cache = typeof node === 'string' ? JSON.parse(node) : node;
        if (!cache || typeof cache !== 'object') continue;
        for (const k of Object.keys(cache)) {
          const v = cache[k];
          if (!v || typeof v !== 'object') continue;
          if (v.property && v.property.zpid) { prop = v.property; break; }
          if (v.data && v.data.property && v.data.property.zpid) { prop = v.data.property; break; }
          if (v.zpid !== undefined && (v.bedrooms !== undefined || v.price !== undefined || v.address !== undefined)) { prop = v; break; }
        }
      } catch (_) {}
    }
    if (!prop) {
      try {
        const cp = nd.props && nd.props.pageProps && nd.props.pageProps.componentProps;
        if (cp && cp.homeDetails && cp.homeDetails.zpid) prop = cp.homeDetails;
      } catch (_) {}
    }
    if (!prop) return null;

    const rf   = prop.resoFacts || {};
    const addr = prop.address   || {};
    const zpid = String(prop.zpid || '');
    const street = addr.streetAddress || prop.streetAddress || '';
    const city   = addr.city    || prop.city    || '';
    const state  = addr.state   || prop.state   || '';
    const zip    = addr.zipcode || prop.zipcode || '';
    const beds   = prop.bedrooms != null ? prop.bedrooms : (prop.beds != null ? prop.beds : null);
    const rawDesc = (prop.description || '') + ' ' + (rf.description || '');
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(
      prop.bathrooms != null ? prop.bathrooms : (prop.baths != null ? prop.baths : null),
      rawDesc
    );
    const lat    = prop.latitude  || (prop.latLong && prop.latLong.latitude)  || null;
    const lng    = prop.longitude || (prop.latLong && prop.latLong.longitude) || null;
    const sqft   = prop.livingArea || prop.area || null;
    let yr       = prop.yearBuilt || rf.yearBuilt || null;
    const hood   = prop.neighborhoodName || prop.neighborhood || rf.subdivision || addr.neighborhood || null;
    const county = prop.county || addr.county || null;
    const vtour  = prop.virtualTourUrl || prop.threeDimensionalTourUrl || null;
    const propType = detectPropType(prop.homeType, rawDesc, prop.title || '');

    const ctxParts = [];
    if (prop.walkScore    != null) ctxParts.push('Walk score: '    + prop.walkScore);
    if (prop.transitScore != null) ctxParts.push('Transit score: ' + prop.transitScore);
    if (prop.bikeScore    != null) ctxParts.push('Bike score: '    + prop.bikeScore);

    const amenityMap = {};
    const addA = (v) => { if (v && typeof v === 'string') { const t = v.trim(); if (t) amenityMap[t] = true; } };
    for (const t of (prop.tags || [])) addA(t);
    for (const f of [...(rf.communityFeatures || []), ...(rf.interiorFeatures || []), ...(rf.exteriorFeatures || []), ...(rf.poolFeatures || [])]) addA(f);

    let pets = prop.isPetFriendly != null ? prop.isPetFriendly : (rf.petsAllowed != null ? rf.petsAllowed : null);
    const petTypes = [];
    if (rf.catsAllowed) petTypes.push('cats');
    if (rf.dogsAllowed) petTypes.push('dogs');

    let parking = null;
    if (rf.parkingFeatures && rf.parkingFeatures.length) parking = rf.parkingFeatures.join(', ');
    else if (prop.parkingType) parking = String(prop.parkingType).replace(/_/g, ' ');

    let hasBasement = !!(rf.basement && rf.basement !== 'None' && rf.basement !== 'false' && rf.basement !== false);
    let hasCentralAir = !!(rf.hasCooling || (rf.cooling && rf.cooling.some(c => c.toLowerCase().includes('central'))));
    let heatingType = rf.heating && rf.heating.length ? rf.heating.join(', ') : null;
    let coolingType = rf.cooling && rf.cooling.length ? rf.cooling.join(', ') : null;
    let appliances = rf.appliances || [];
    let laundryType = rf.laundryFeatures && rf.laundryFeatures.length ? rf.laundryFeatures.join(', ') : null;
    let lotSizeSqft = null;

    // --- Enhanced attribute extraction from attrMap.facts and amenityCategories ---
    const factMap = {};
    if (prop.attrMap && prop.attrMap.facts && Array.isArray(prop.attrMap.facts)) {
      prop.attrMap.facts.forEach(f => {
        if (f.name && f.value) factMap[f.name.toLowerCase()] = String(f.value);
      });
    } else if (prop.attrMap && typeof prop.attrMap === 'object') {
      Object.keys(prop.attrMap).forEach(k => {
        factMap[k.toLowerCase()] = String(prop.attrMap[k]);
      });
    }

    if (factMap['year built']) yr = parseInt(factMap['year built'], 10) || yr;
    if (factMap['heating']) heatingType = factMap['heating'];
    if (factMap['cooling']) {
      coolingType = factMap['cooling'];
      if (coolingType.toLowerCase().includes('central')) hasCentralAir = true;
    }
    if (factMap['parking']) parking = factMap['parking'];
    if (factMap['lot size']) lotSizeSqft = parseInt(factMap['lot size'].replace(/[^0-9]/g, ''), 10) || lotSizeSqft;
    if (factMap['basement'] && factMap['basement'].toLowerCase() !== 'none') hasBasement = true;
    if (factMap['appliances']) appliances = factMap['appliances'].split(',').map(s => s.trim());
    if (factMap['laundry']) laundryType = factMap['laundry'];

    if (prop.amenityCategories && Array.isArray(prop.amenityCategories)) {
      prop.amenityCategories.forEach(cat => {
        if (cat.amenities && Array.isArray(cat.amenities)) {
          cat.amenities.forEach(a => addA(a));
          if (cat.category && cat.category.toLowerCase().includes('pet')) {
            cat.amenities.forEach(a => {
              if (/cat/i.test(a)) { petTypes.push('cats'); pets = true; }
              if (/dog/i.test(a)) { petTypes.push('dogs'); pets = true; }
            });
          }
        }
      });
    }
    // -----------------------------------------------------------------------------

    let minLease = null;
    const ltRaw = rf.leaseTerm || rf.leaseTerms || rf.minimumLease || null;
    if (ltRaw) {
      const lt = String(ltRaw).toLowerCase();
      const mmo = lt.match(/(\d+)\s*month/);
      if (mmo) minLease = parseInt(mmo[1], 10);
      else if (/month.to.month|m2m|mtm/.test(lt)) minLease = 1;
      else if (/\byear\b|12[\s-]*month|annual/.test(lt)) minLease = 12;
    }

    return basePayload('zillow', zpid, canonicalZillowUrl(url, zpid), {
      title: buildTitle(beds, propType, city, street),
      address: street, city, state, zip, lat, lng,
      monthly_rent: parseRent(prop.price || prop.unformattedPrice, prop.rentZestimate),
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      lot_size_sqft: lotSizeSqft,
      floors: safeI(prop.stories || rf.stories),
      garage_spaces: safeI(prop.garageParkingCapacity || prop.garageSpaces),
      total_units: safeI(prop.unitCount),
      property_type: propType,
      description: prop.description || null,
      neighborhood: hood, county,
      location_context: ctxParts.length ? ctxParts.join('; ') : null,
      pets_allowed: pets,
      pet_types_allowed: JSON.stringify([...new Set(petTypes)]),
      available_date: parseDate(rf.dateAvailable || rf.availableFrom || prop.dateAvailable),
      minimum_lease_months: minLease,
      smoking_allowed: rf.smokingAllowed != null ? !!rf.smokingAllowed : null,
      security_deposit: safeI(rf.securityDeposit),
      pet_deposit: safeI(rf.petFee || rf.petDepositFee),
      admin_fee: safeI(rf.adminFee),
      parking_fee: safeI(rf.parkingFee),
      application_fee: safeI(rf.applicationFeeAmount || rf.applicationFee),
      hoa_fee: safeI(prop.monthlyHoaFee || prop.hoaFee),
      last_months_rent: safeI(rf.lastMonthRent),
      move_in_special: rf.concessions ? String(rf.concessions).slice(0, 200) : null,
      parking,
      amenities: JSON.stringify(Object.keys(amenityMap)),
      appliances: JSON.stringify(appliances),
      utilities_included: JSON.stringify(rf.utilities || rf.utilitiesIncluded || []),
      heating_type: heatingType,
      cooling_type: coolingType,
      laundry_type: laundryType,
      virtual_tour_url: vtour,
      has_basement: hasBasement,
      has_central_air: hasCentralAir,
      original_image_urls: JSON.stringify(collectPhotos(prop)),
      agent_name: (prop.attributionInfo && prop.attributionInfo.agentName)  || null,
      broker_name: (prop.attributionInfo && prop.attributionInfo.brokerName) || null,
    });
  }

  // ── JSON-LD Fallback Extractor (All Sites) ─────────────────────
  function extractFromJsonLd(doc, url, sourceName) {
    const items = getJsonLdData(doc);
    if (!items.length) return null;
    const prop = items.find(i => {
      if (!i || typeof i !== 'object') return false;
      const t = String(i['@type'] || '');
      // Exclude generic Place, WebPage, LocalBusiness unless it has an explicit street address with street number
      if (/Place|WebPage|LocalBusiness|BreadcrumbList|Organization|SearchAction/i.test(t)) {
        const addr = i.address;
        const hasStreet = addr && (typeof addr === 'string' ? addr.length > 5 && /\d/.test(addr) : (addr.streetAddress && /\d/.test(addr.streetAddress)));
        if (!hasStreet && !i.offers) return false;
      }
      return /Residence|Apartment|House|SingleFamilyResidence|RealEstateListing|Accommodation/i.test(t) || i.offers || (i.address && (typeof i.address === 'object' ? !!i.address.streetAddress : /\d/.test(i.address)));
    });
    if (!prop) return null;

    const addr = prop.address || {};
    let street = typeof addr === 'string' ? addr : (addr.streetAddress || '');
    let city = addr.addressLocality || '';
    let state = addr.addressRegion || '';
    let zip = addr.postalCode || '';

    // If street contains full address, split it
    if (street && (!city || !state)) {
      const parts = street.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        street = parts[0];
        city = parts[1];
        const stateZip = parts[2].split(/\s+/);
        state = stateZip[0] || state;
        zip = stateZip[1] || zip;
      }
    }

    const geo = prop.geo || {};
    const lat = geo.latitude ? parseFloat(String(geo.latitude)) : null;
    const lng = geo.longitude ? parseFloat(String(geo.longitude)) : null;

    let rent = null;
    if (prop.offers) {
      const off = Array.isArray(prop.offers) ? prop.offers[0] : prop.offers;
      const p = off.price || off.lowPrice || (off.priceSpecification && off.priceSpecification.price);
      if (p) rent = parseInt(String(p).replace(/[^0-9]/g, ''), 10) || null;
    }

    const beds = prop.numberOfBedrooms || prop.numberOfRooms || null;
    const baths = prop.numberOfBathroomsTotal || prop.numberOfFullBathrooms || null;
    const desc = prop.description || null;
    const photos = [];
    if (Array.isArray(prop.image)) {
      prop.image.forEach(img => {
        const u = typeof img === 'string' ? img : (img && (img.url || img.contentUrl));
        if (u && typeof u === 'string') photos.push(u);
      });
    } else if (prop.image) {
      const u = typeof prop.image === 'string' ? prop.image : prop.image.url;
      if (u) photos.push(u);
    }

    const zpidMatch = (url.match(/(\d+)_zpid/i) || [])[1];
    const sourceId = zpidMatch || String(prop.identifier || prop.sku || prop['@id'] || Date.now());

    return basePayload(sourceName, sourceId, url, {
      title: prop.name || (street ? buildTitle(beds, 'APARTMENT', city, street) : null),
      address: street || prop.name || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      lat, lng,
      monthly_rent: rent,
      bedrooms: beds ? Number(beds) : null,
      bathrooms: baths ? Math.floor(Number(baths)) : null,
      half_bathrooms: baths && (Number(baths) % 1 !== 0) ? 1 : null,
      property_type: normalizeType(prop['@type'] || 'APARTMENT'),
      description: desc,
      original_image_urls: JSON.stringify(dedupZillowPhotos(photos).slice(0, 50)),
    });
  }

  // ── Zillow Comprehensive DOM Fallback Extractor ───────────────
  // Reads directly from rendered HTML elements for client-side navigated SPAs
  function extractZillowFromDom(doc, url) {
    if (!doc || typeof doc.querySelector !== 'function') return null;

    // 1. Address detection
    let address = null;
    let city = null;
    let state = null;
    let zip = null;

    const h1El = doc.querySelector([
      'h1[data-test-id="bdp-building-title"]',
      '[data-testid="home-details-chip-container"] h1',
      '[data-testid="bdp-property-header"] h1',
      '.summary-container h1',
      'h1[class*="Text-c11n"]',
      'header h1',
      'h1'
    ].join(', '));

    if (h1El && h1El.textContent) {
      const h1Text = h1El.textContent.trim();
      const parts = h1Text.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        address = parts[0];
        city = parts[1];
        const sz = parts[2].split(/\s+/);
        state = sz[0] || '';
        zip = sz[1] || '';
      } else if (parts.length === 2) {
        address = parts[0];
        city = parts[1];
      } else {
        address = h1Text;
      }
    }

    if (!address) {
      // Try meta og:title or document.title
      const metaTitle = doc.querySelector('meta[property="og:title"]');
      const rawTitle = (metaTitle && metaTitle.getAttribute('content')) || doc.title || '';
      const m = rawTitle.match(/^([^,|]+),\s*([^,|]+),\s*([A-Z]{2})\s*(\d{5})?/i);
      if (m) {
        address = m[1].trim();
        city = m[2].trim();
        state = m[3].trim();
        zip = m[4] ? m[4].trim() : null;
      }
    }

    // 2. Price detection
    let price = null;
    const priceEl = doc.querySelector([
      'span[data-testid="price"]',
      '[data-testid="price"] span',
      'span[data-test="price"]',
      '.summary-container [data-testid="price"]',
      'span[class*="Price-c11n"]',
      '[data-test="bdp-price-range"]',
      'span[data-testid="price-summary"]'
    ].join(', '));
    if (priceEl && priceEl.textContent) {
      price = parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) || null;
    }

    // 3. Beds, Baths, Sqft detection
    let beds = null;
    let baths = null;
    let sqft = null;

    const summaryText = doc.body ? doc.body.innerText : '';
    const bedMatch = summaryText.match(/(\d+)\s*(?:bd|bed|bedroom)/i);
    if (bedMatch) beds = parseInt(bedMatch[1], 10);

    const bathMatch = summaryText.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|bathroom)/i);
    if (bathMatch) baths = parseFloat(bathMatch[1]);

    const sqftMatch = summaryText.match(/([\d,]+)\s*(?:sqft|sq\s*ft|square\s*feet)/i);
    if (sqftMatch) sqft = parseInt(sqftMatch[1].replace(/,/g, ''), 10);

    let yr = null;
    let heatingType = null;
    let coolingType = null;
    let parking = null;
    let lotSizeSqft = null;
    let pets = null;
    let petTypes = [];

    const yearMatch = summaryText.match(/Year built:?\s*(\d{4})/i);
    if (yearMatch) yr = parseInt(yearMatch[1], 10);
    
    const heatingMatch = summaryText.match(/Heating:?\s*([^\n]+)/i);
    if (heatingMatch && !heatingMatch[1].toLowerCase().includes('no data')) heatingType = heatingMatch[1].trim();
    
    const coolingMatch = summaryText.match(/Cooling:?\s*([^\n]+)/i);
    if (coolingMatch && !coolingMatch[1].toLowerCase().includes('no data')) coolingType = coolingMatch[1].trim();

    const parkingMatch = summaryText.match(/Parking:?\s*([^\n]+)/i);
    if (parkingMatch && !parkingMatch[1].toLowerCase().includes('no data')) parking = parkingMatch[1].trim();
    
    const lotMatch = summaryText.match(/Lot size:?\s*([\d,]+)\s*sqft/i);
    if (lotMatch) lotSizeSqft = parseInt(lotMatch[1].replace(/,/g, ''), 10);

    const petsTextMatch = summaryText.match(/(?:Pets|Pet policy):?\s*([^\n]+)/i);
    if (petsTextMatch) {
      const pText = petsTextMatch[1].toLowerCase();
      if (pText.includes('allowed') || pText.includes('ok') || pText.includes('yes') || pText.includes('cat') || pText.includes('dog')) {
        pets = true;
        if (pText.includes('cat')) petTypes.push('cats');
        if (pText.includes('dog')) petTypes.push('dogs');
      }
    }

    // 4. Photos from rendered DOM
    const photos = [];
    const imgEls = doc.querySelectorAll('img[src*="zillowstatic.com"], picture source[srcset*="zillowstatic.com"]');
    imgEls.forEach(el => {
      let src = el.src || el.getAttribute('srcset') || el.getAttribute('data-src') || '';
      if (src) {
        // Pick high res source
        if (src.includes(',')) {
          const split = src.split(',');
          src = split[split.length - 1].trim().split(' ')[0];
        }
        // Upgrade thumbnail to high-res
        src = src.replace(/_[a-z0-9]+\.jpg$/i, '-uncropped_scaled_within_1536_1152.jpg');
        photos.push(src);
      }
    });

    // 5. Description
    let description = null;
    const descEl = doc.querySelector('[data-testid="description"], [class*="DescriptionWrapper"], .summary-container p');
    if (descEl && descEl.textContent) {
      description = descEl.textContent.trim().slice(0, 2000);
    }

    const zpidMatch = (url.match(/(\d+)_zpid/i) || url.match(/\/b\/([^/]+)/i) || [])[1];
    const sourceId = zpidMatch || String(Date.now());

    if (!address && !price) return null;

    return basePayload('zillow', sourceId, url, {
      title: buildTitle(beds, 'APARTMENT', city, address),
      address: address || 'Zillow Property',
      city: city || null,
      state: state || null,
      zip: zip || null,
      monthly_rent: price,
      bedrooms: beds,
      bathrooms: baths ? Math.floor(baths) : null,
      half_bathrooms: baths && (baths % 1 !== 0) ? 1 : null,
      square_footage: sqft,
      year_built: yr,
      heating_type: heatingType,
      cooling_type: coolingType,
      parking,
      lot_size_sqft: lotSizeSqft,
      pets_allowed: pets,
      pet_types_allowed: petTypes.length ? JSON.stringify(petTypes) : null,
      property_type: 'APARTMENT',
      description,
      original_image_urls: JSON.stringify(dedupZillowPhotos(photos).slice(0, 50)),
      _import: 'zillow-dom-deep-scanner'
    });
  }

  // ── Zillow Dispatcher (Tiers 1, 2, 3) ─────────────────────────
  function extractZillow(doc, url) {
    // Tier 1: NextData / gdpClientCache
    let res = extractZillowNextData(doc, url);
    const resPhotos = res ? (JSON.parse(res.original_image_urls || '[]')) : [];
    if (res && res.address && res.monthly_rent && res.bedrooms != null && resPhotos.length >= 6) return res;

    // Tier 2: Live DOM Scraper (accurate for client-side rendered listings)
    const dom = extractZillowFromDom(doc, url);
    const domPhotos = dom ? (JSON.parse(dom.original_image_urls || '[]')) : [];

    // Tier 3: JSON-LD (filtered)
    const ld = extractFromJsonLd(doc, url, 'zillow');
    const ldPhotos = ld ? (JSON.parse(ld.original_image_urls || '[]')) : [];

    // Merge best available attributes: NextData > DOM > JSON-LD
    let merged = Object.assign({}, ld || {}, dom || {}, res || {});
    if (!merged.address && !merged.monthly_rent) return null;

    // Ensure best photo collection is kept
    const bestPhotos = [resPhotos, domPhotos, ldPhotos].sort((a, b) => b.length - a.length)[0] || [];
    if (bestPhotos.length > 0) {
      merged.original_image_urls = JSON.stringify(bestPhotos.slice(0, 50));
    }

    // Ensure street address isn't just city
    if (merged.address === merged.city && dom && dom.address && dom.address !== dom.city) {
      merged.address = dom.address;
    }

    return merged;
  }

  // ── Realtor.com ──────────────────────────────────────────────
  function extractRealtor(doc, url) {
    const nd = getNextData(doc);
    let prop = null;
    if (nd) {
      const paths = [
        ['props', 'pageProps', 'initialReduxState', 'propertyDetails'],
        ['props', 'pageProps', 'initialReduxState', 'searchResults', 'homeDetails'],
        ['props', 'pageProps', 'initialReduxState', 'listing'],
        ['props', 'pageProps', 'property'],
      ];
      for (const p of paths) {
        const v = walk(nd, p);
        if (v && (v.property_id || v.address || v.rdc_web_url)) { prop = v; break; }
      }
    }

    if (!prop) {
      const ld = extractFromJsonLd(doc, url, 'realtor');
      if (ld) return ld;
      return null;
    }

    const addr = prop.address || {};
    const street = addr.line || addr.streetAddress || prop.line || '';
    const city   = addr.city || prop.city || '';
    const state  = addr.state_code || addr.state || prop.state || '';
    const zip    = addr.postal_code || addr.zipcode || prop.zipcode || '';
    const beds   = prop.beds != null ? prop.beds : (prop.bedrooms != null ? prop.bedrooms : null);
    const rawDesc = String(prop.description || prop.text || '');
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(
      prop.baths != null ? prop.baths : (prop.bathrooms != null ? prop.bathrooms : null),
      rawDesc
    );
    const lat    = prop.lat || addr.lat || null;
    const lng    = prop.lng || addr.lng || null;
    const sqft   = prop.sqft || prop.square_feet || null;
    const yr     = prop.year_built || null;
    const propType = detectPropType(prop.prop_type || prop.property_type || prop.home_type, rawDesc, prop.title || '');

    const photos = collectPhotoUrls(prop, ['photos']);
    if (prop.primary_photo) {
      const u = typeof prop.primary_photo === 'string' ? prop.primary_photo : prop.primary_photo.href;
      if (u && !photos.includes(u)) photos.unshift(u);
    }

    return basePayload('realtor', String(prop.property_id || prop.rdc_web_url || ''), url, {
      title: buildTitle(beds, propType, city, street),
      address: street, city, state, zip, lat, lng,
      monthly_rent: parseRent(prop.price || prop.list_price, null),
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      property_type: propType,
      description: prop.description || prop.text || null,
      neighborhood: prop.neighborhood_name || null,
      county: prop.county || null,
      available_date: parseDate(prop.available_date || prop.date_available),
      virtual_tour_url: prop.virtual_tour_url || null,
      original_image_urls: JSON.stringify(photos.slice(0, 50)),
    });
  }

  // ── Apartments.com ───────────────────────────────────────────
  function extractApartments(doc, url) {
    const nd = getNextData(doc);
    let prop = null;
    if (nd) {
      const paths = [
        ['props', 'pageProps', 'listing'],
        ['props', 'pageProps', 'initialState', 'listing'],
        ['props', 'pageProps', 'property'],
        ['props', 'pageProps', 'apartment'],
      ];
      for (const p of paths) {
        const v = walk(nd, p);
        if (v && (v.id || v.address || v.name)) { prop = v; break; }
      }
    }

    if (!prop) {
      const ld = extractFromJsonLd(doc, url, 'apartments');
      if (ld) return ld;
      return null;
    }

    const addr = prop.address || {};
    const street = addr.street || addr.line || '';
    const city   = addr.city || '';
    const state  = addr.state || addr.stateCode || '';
    const zip    = addr.zip || addr.postalCode || '';
    const beds   = prop.bedrooms != null ? prop.bedrooms : null;
    const rawDesc = String(prop.description || '');
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(prop.bathrooms, rawDesc);
    const lat    = prop.latitude || (prop.geo && prop.geo.lat) || null;
    const lng    = prop.longitude || (prop.geo && prop.geo.lng) || null;
    const sqft   = prop.squareFeet || prop.sqft || null;
    const yr     = prop.yearBuilt || null;

    const photos = collectPhotoUrls(prop, ['photos', 'images']);

    return basePayload('apartments', String(prop.id || ''), url, {
      title: buildTitle(beds, 'APARTMENT', city, street),
      address: street, city, state, zip, lat, lng,
      monthly_rent: parseRent(prop.price || prop.minPrice, null),
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      property_type: 'APARTMENT',
      description: prop.description || null,
      neighborhood: prop.neighborhood || null,
      pets_allowed: prop.petsAllowed != null ? !!prop.petsAllowed : null,
      available_date: parseDate(prop.availableDate || prop.availabilityDate),
      original_image_urls: JSON.stringify(photos.slice(0, 50)),
    });
  }

  // ── Redfin ───────────────────────────────────────────────────
  function extractRedfin(doc, url) {
    const nd = getNextData(doc);
    let prop = null;
    if (nd) {
      const paths = [
        ['props', 'pageProps', 'initialReduxState', 'searchResults', 'homeDetails'],
        ['props', 'pageProps', 'initialReduxState', 'propertyData'],
        ['props', 'pageProps', 'initialReduxState', 'homeDetails'],
        ['props', 'pageProps', 'property'],
      ];
      for (const p of paths) {
        const v = walk(nd, p);
        if (v && (v.propertyId || v.address || v.id)) { prop = v; break; }
      }
    }

    if (!prop) {
      const ld = extractFromJsonLd(doc, url, 'redfin');
      if (ld) return ld;
      return null;
    }

    const addr = prop.address || {};
    const street = addr.streetAddress || addr.line || '';
    const city   = addr.city || '';
    const state  = addr.state || addr.stateCode || '';
    const zip    = addr.zip || addr.postalCode || '';
    const beds   = prop.beds != null ? prop.beds : null;
    const rawDesc = String(prop.description || '');
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(prop.baths, rawDesc);
    const lat    = prop.latitude || (prop.location && prop.location.latitude) || null;
    const lng    = prop.longitude || (prop.location && prop.location.longitude) || null;
    const sqft   = prop.sqft || prop.livingArea || null;
    const yr     = prop.yearBuilt || null;
    const propType = detectPropType(prop.propertyType || prop.homeType, rawDesc, prop.title || '');

    const photos = collectPhotoUrls(prop, ['photos', 'images', 'media']);

    return basePayload('redfin', String(prop.propertyId || prop.id || ''), url, {
      title: buildTitle(beds, propType, city, street),
      address: street, city, state, zip, lat, lng,
      monthly_rent: parseRent(prop.price || prop.rent, null),
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      property_type: propType,
      description: prop.description || null,
      neighborhood: prop.neighborhood || null,
      available_date: parseDate(prop.availableDate || prop.dateAvailable),
      virtual_tour_url: prop.virtualTourUrl || null,
      original_image_urls: JSON.stringify(photos.slice(0, 50)),
    });
  }

  // ── Opendoor Helpers ─────────────────────────────────────────
  function parseOpendoorUrlSlug(url) {
    if (!url || typeof url !== 'string') return null;
    const m = url.match(/\/properties\/([^\/]+)\/aid_([a-f0-9-]+)/i) ||
              url.match(/\/properties\/([^\/]+)\/([a-z0-9_-]+)/i) ||
              url.match(/\/properties\/([^\/]+)/i) ||
              url.match(/\/homes\/([^\/]+)/i);
    if (!m) return null;
    const slug = m[1];
    const aid = m[2] || (url.match(/aid_([a-f0-9-]+)/i) || [])[1] || 'od_' + Date.now();

    const geoMatch = slug.match(/^(.*?)-([A-Z]{2})-(\d{5})$/i);
    if (geoMatch) {
      const rawStreetCity = geoMatch[1].replace(/-/g, ' ');
      const state = geoMatch[2].toUpperCase();
      const zip = geoMatch[3];

      const streetSuffixMatch = rawStreetCity.match(/^(.*?\b(?:Dr|Drive|St|Street|Rd|Road|Ave|Avenue|Ct|Court|Blvd|Boulevard|Ln|Lane|Way|Pl|Place|Cir|Circle|Ter|Terrace|Trl|Trail|Pkwy|Parkway|Loop|Cove|Cv|Run|Trace|Crossing|Walk|Pass|Path)\b)(.*)$/i);
      if (streetSuffixMatch) {
        return {
          street: streetSuffixMatch[1].trim(),
          city: streetSuffixMatch[2].trim(),
          state,
          zip,
          aid
        };
      }
      return { street: rawStreetCity, city: '', state, zip, aid };
    }
    return { street: slug.replace(/-/g, ' '), city: '', state: '', zip: '', aid };
  }

  function extractPhotosFromHtmlScripts(doc) {
    const urls = [];
    const seen = new Set();
    if (!doc || typeof doc.querySelectorAll !== 'function') return urls;
    try {
      const scripts = doc.querySelectorAll('script');
      scripts.forEach(s => {
        const text = s.textContent || '';
        if (!text || (!text.includes('cloudinary') && !text.includes('opendoor') && !text.includes('rentprogress') && !text.includes('photos') && !text.includes('images') && !text.includes('.jpg') && !text.includes('.webp'))) return;
        const re = /https?:\/\/[^"'\s\\]+?\.(?:jpg|jpeg|webp|png)(?:\?[^"'\s\\]*)?/gi;
        let match;
        while ((match = re.exec(text)) !== null) {
          let u = match[0].replace(/\\u002F/gi, '/').replace(/\\/g, '');
          if (/logo|icon|avatar|favicon|badge|app-store|google-play|map/i.test(u)) continue;
          if (u.includes('opendoor') || u.includes('cloudinary') || u.includes('rentprogress') || u.includes('fastly') || u.includes('amazonaws') || u.includes('s3') || u.includes('image')) {
            const clean = u.replace(/\?.*$/, '');
            if (!seen.has(clean)) {
              urls.push(u);
              seen.add(clean);
            }
          }
        }
      });
    } catch (_) {}
    return urls;
  }

  // ── Opendoor ─────────────────────────────────────────────────
  function extractOpendoor(doc, url) {
    const slugInfo = parseOpendoorUrlSlug(url);
    const idFromUrl = (slugInfo && slugInfo.aid) || (url.match(/aid_([a-f0-9-]+)/i) || url.match(/\/properties\/[^\/]+\/([a-z0-9_-]+)/i) || url.match(/\/homes\/[^\/]+\/[^\/]+\/([a-z0-9_-]+)/i) || url.match(/\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i) || [])[1] || 'od_' + Date.now();

    const nd = getNextData(doc);
    let prop = null;
    if (nd) {
      const paths = [
        ['props', 'pageProps', 'home'],
        ['props', 'pageProps', 'listing'],
        ['props', 'pageProps', 'property'],
        ['props', 'pageProps', 'initialData', 'home'],
        ['props', 'pageProps', 'initialState', 'home'],
        ['props', 'pageProps', 'initialState', 'property'],
      ];
      for (const p of paths) {
        const v = walk(nd, p);
        if (v && (v.id || v.address || v.streetAddress || v.price || v.listPrice)) { prop = v; break; }
      }

      // Check React Query dehydrated state
      if (!prop && nd.props && nd.props.pageProps && nd.props.pageProps.dehydratedState) {
        const queries = nd.props.pageProps.dehydratedState.queries || [];
        for (const q of queries) {
          const d = q && q.state && q.state.data;
          if (d && (d.home || d.property || d.listing)) {
            prop = d.home || d.property || d.listing;
            break;
          }
          if (d && (d.streetAddress || d.address) && (d.price || d.beds || d.bedrooms)) {
            prop = d;
            break;
          }
        }
      }
    }

    // Tier 2: DOM
    const dom = extractOpendoorDom(doc, url);

    if (!prop) {
      const ld = extractFromJsonLd(doc, url, 'opendoor');
      if (ld && ld.address && (ld.monthly_rent || ld.bedrooms != null)) {
        return Object.assign({ source_listing_id: idFromUrl }, dom || {}, ld);
      }
      return dom;
    }

    const addr = prop.address || {};
    let street = addr.streetAddress || addr.line || prop.streetAddress || prop.addressString || (dom ? dom.address : '') || (slugInfo ? slugInfo.street : '');
    let city   = addr.city || prop.city || (dom ? dom.city : '') || (slugInfo ? slugInfo.city : '');
    let state  = addr.state || addr.stateCode || prop.state || (dom ? dom.state : '') || (slugInfo ? slugInfo.state : '');
    let zip    = addr.zip || addr.postalCode || addr.zipcode || prop.zip || (dom ? dom.zip : '') || (slugInfo ? slugInfo.zip : '');
    const beds   = prop.beds != null ? prop.beds : (prop.bedrooms != null ? prop.bedrooms : (dom ? dom.bedrooms : null));
    const rawDesc = String(prop.description || prop.publicRemarks || prop.overview || (dom ? dom.original_description : '') || '');
    const rawBaths = prop.baths != null ? prop.baths : (prop.bathrooms != null ? prop.bathrooms : (dom ? dom.bathrooms : null));
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(rawBaths, rawDesc);
    const lat    = prop.latitude || (addr.lat) || (prop.geo && prop.geo.latitude) || (dom ? dom.lat : null);
    const lng    = prop.longitude || (addr.lng) || (prop.geo && prop.geo.longitude) || (dom ? dom.lng : null);
    const sqft   = prop.sqft || prop.squareFeet || prop.livingArea || (dom ? dom.square_footage : null);
    const yr     = prop.yearBuilt || prop.year_built || (dom ? dom.year_built : null);
    const propType = detectPropType(prop.propertyType || prop.homeType || prop.type, rawDesc, prop.title || (dom ? dom.title : ''));

    const photos = [];
    const seen = new Set();
    const addPhoto = (u) => {
      if (u && typeof u === 'string' && u.startsWith('http')) {
        const clean = u.replace(/\?.*$/, '');
        if (!seen.has(clean)) {
          photos.push(u);
          seen.add(clean);
          seen.add(u);
        }
      }
    };

    if (Array.isArray(prop.photos)) {
      prop.photos.forEach(p => addPhoto(typeof p === 'string' ? p : (p.url || p.large || p.href || p.src || p.largeImageUrl)));
    }
    if (Array.isArray(prop.images)) {
      prop.images.forEach(p => addPhoto(typeof p === 'string' ? p : (p.url || p.large || p.href || p.src || p.largeImageUrl)));
    }
    if (Array.isArray(prop.media)) {
      prop.media.forEach(p => addPhoto(typeof p === 'string' ? p : (p.url || p.photoUrl || p.largeImageUrl)));
    }
    if (Array.isArray(prop.gallery)) {
      prop.gallery.forEach(p => addPhoto(typeof p === 'string' ? p : (p.url || p.largeImageUrl || p.src)));
    }
    if (prop.heroImage) addPhoto(prop.heroImage);
    if (prop.primaryPhoto) addPhoto(typeof prop.primaryPhoto === 'string' ? prop.primaryPhoto : (prop.primaryPhoto.url || prop.primaryPhoto.href));

    // Also include DOM & script photos
    const scriptPhotos = extractPhotosFromHtmlScripts(doc);
    scriptPhotos.forEach(addPhoto);

    if (dom && dom.original_image_urls) {
      try {
        const domUrls = JSON.parse(dom.original_image_urls);
        if (Array.isArray(domUrls)) domUrls.forEach(addPhoto);
      } catch (_) {}
    }

    const rent = parseRent(prop.price || prop.listPrice || prop.estimatedRent || prop.rent, null) || (dom ? dom.monthly_rent : null);
    const sourceId = String(prop.id || prop.listingId || prop.homeId || idFromUrl);

    return basePayload('opendoor', sourceId, url, {
      title: buildTitle(beds, propType, city, street),
      address: street, city, state, zip, lat, lng,
      monthly_rent: rent,
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      property_type: propType,
      description: cleanForSaleText(rawDesc) || null,
      original_description: rawDesc || null,
      pets_allowed: true,
      application_fee: 50,
      security_deposit: rent,
      minimum_lease_months: null,
      neighborhood: prop.neighborhood || (dom ? dom.neighborhood : null),
      hoa_fee: prop.hoaFee != null ? safeI(prop.hoaFee) : (dom ? dom.hoa_fee : null),
      garage_spaces: prop.garageSpaces != null ? safeI(prop.garageSpaces) : (dom ? dom.garage_spaces : null),
      available_date: parseDate(prop.availableDate || prop.listDate || (dom ? dom.available_date : null)),
      original_image_urls: JSON.stringify(photos.slice(0, 50)),
    });
  }

  function extractOpendoorDom(doc, url) {
    if (!doc || typeof doc.querySelector !== 'function') return null;
    const slugInfo = parseOpendoorUrlSlug(url);
    const idFromUrl = (slugInfo && slugInfo.aid) || (url.match(/aid_([a-f0-9-]+)/i) || url.match(/\/properties\/[^\/]+\/([a-z0-9_-]+)/i) || url.match(/\/homes\/[^\/]+\/[^\/]+\/([a-z0-9_-]+)/i) || url.match(/\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i) || [])[1] || 'od_' + Date.now();

    // 1. Address
    const titleEl = doc.querySelector('h1, [data-testid="pdp-address"], .pdp-address, [class*="PropertyAddress"]');
    let street = titleEl ? titleEl.textContent.trim() : '';

    // City State Zip usually sits in the line / element below or in subtitle
    let city = '', state = '', zip = '';
    const subTitleEl = doc.querySelector('h1 + div, h1 + p, [data-testid="pdp-city-state"], .pdp-city-state-zip, [class*="CityStateZip"]');
    const fullSubtitle = subTitleEl ? subTitleEl.textContent.trim() : '';
    const mSub = fullSubtitle.match(/^([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
    if (mSub) {
      city  = mSub[1].trim();
      state = mSub[2].trim().toUpperCase();
      zip   = mSub[3] ? mSub[3].trim() : '';
    } else {
      // Try from document.title or meta
      const metaTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title || '';
      const mMeta = metaTitle.match(/(\d+[^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
      if (mMeta) {
        if (!street) street = mMeta[1].trim();
        city  = mMeta[2].trim();
        state = mMeta[3].trim().toUpperCase();
        zip   = mMeta[4] ? mMeta[4].trim() : '';
      }
    }

    // If street contains city, state, zip formatted
    if (street && (!city || !state)) {
      const mFull = street.match(/^([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
      if (mFull) {
        street = mFull[1].trim();
        city   = mFull[2].trim();
        state  = mFull[3].trim().toUpperCase();
        zip    = mFull[4] ? mFull[4].trim() : zip;
      }
    }

    // URL slug fallback if DOM address was incomplete
    if (slugInfo) {
      if (!street && slugInfo.street) street = slugInfo.street;
      if (!city && slugInfo.city) city = slugInfo.city;
      if (!state && slugInfo.state) state = slugInfo.state;
      if (!zip && slugInfo.zip) zip = slugInfo.zip;
    }

    // 2. Price
    let rent = null;
    const priceEl = doc.querySelector('[data-testid="pdp-price"], .pdp-price, .price, [class*="Price"], [class*="price"]');
    if (priceEl) {
      rent = parseRent(priceEl.textContent, null);
    }
    if (!rent) {
      const bodyText = doc.body ? (doc.body.innerText || doc.body.textContent || '') : '';
      const pm = bodyText.match(/\$([\d,]{4,})/);
      if (pm) rent = parseInt(pm[1].replace(/,/g, ''), 10);
    }

    // 3. Beds, Baths, Sqft
    let beds = null, baths = null, sqft = null;
    const bodyText = doc.body ? (doc.body.innerText || doc.body.textContent || '') : '';
    const bedMatch = bodyText.match(/(\d+)\s*(?:bds|beds|bd|bed)\b/i);
    if (bedMatch) beds = parseInt(bedMatch[1], 10);

    const bathMatch = bodyText.match(/([\d.]+)\s*(?:ba|baths|bath)\b/i);
    if (bathMatch) baths = parseFloat(bathMatch[1]);

    const sqftMatch = bodyText.match(/([\d,]+)\s*(?:sqft|sq\s*ft|square\s*feet)\b/i);
    if (sqftMatch) sqft = parseInt(sqftMatch[1].replace(/,/g, ''), 10);

    // 4. Description
    const descEl = doc.querySelector('[data-testid="pdp-description"], .pdp-description, #listing-description, [class*="Description"]');
    const rawDesc = descEl ? descEl.textContent.trim() : '';
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(baths, rawDesc);

    // 5. Photos - Comprehensive Multi-Selector & Script Extraction
    const photos = [];
    const seen = new Set();
    const addPhoto = (u) => {
      if (u && typeof u === 'string' && u.startsWith('http')) {
        let clean = u;
        if (clean.includes('opendoor.com') || clean.includes('cloudinary')) {
          clean = clean.replace(/\?.*$/, '');
        }
        if (!seen.has(clean)) {
          photos.push(clean);
          seen.add(clean);
        }
      }
    };

    const scriptPhotos = extractPhotosFromHtmlScripts(doc);
    scriptPhotos.forEach(addPhoto);

    const mediaEls = doc.querySelectorAll('img, picture source, [data-testid*="carousel"] img, [data-testid*="gallery"] img, [data-testid*="photo"] img, [data-testid*="media"] img, button[aria-label*="photo"] img, [class*="gallery"] img, [class*="carousel"] img');
    mediaEls.forEach(el => {
      const src = el.src || el.getAttribute('data-src') || el.getAttribute('srcset') || el.getAttribute('data-srcset');
      if (src) {
        if (src.includes(',')) {
          const parts = src.split(',');
          const last = parts[parts.length - 1].trim().split(' ')[0];
          addPhoto(last);
        } else {
          addPhoto(src.split(' ')[0]);
        }
      }
    });

    const bgEls = doc.querySelectorAll('[style*="background-image"], [style*="background:url"]');
    bgEls.forEach(el => {
      const style = el.getAttribute('style') || '';
      const bgM = style.match(/url\(['"]?(https?:\/\/[^'")]+)['"]?\)/i);
      if (bgM) addPhoto(bgM[1]);
    });

    const validPhotos = photos.filter(u => {
      return !/logo|icon|avatar|favicon|badge|app-store|google-play|map/i.test(u);
    });

    const propType = detectPropType(null, rawDesc, street);

    return basePayload('opendoor', idFromUrl, url, {
      title: buildTitle(beds, propType, city, street),
      address: street || 'Opendoor Property',
      city: city || null,
      state: state || null,
      zip: zip || null,
      monthly_rent: rent,
      bedrooms: beds,
      bathrooms: bathVal,
      half_bathrooms: bathH,
      square_footage: sqft,
      property_type: propType,
      description: cleanForSaleText(rawDesc) || null,
      original_description: rawDesc || null,
      pets_allowed: true,
      application_fee: 50,
      security_deposit: rent,
      minimum_lease_months: null,
      original_image_urls: JSON.stringify(validPhotos.slice(0, 50)),
      _import: 'opendoor-dom-deep-scanner'
    });
  }

  // ── Progress Residential ─────────────────────────────────────
  function extractProgressResidential(doc, url) {
    const idFromUrl = (url.match(/\/([a-z0-9_-]+)$/i) || [])[1] || 'pr_' + Date.now();

    // 1. Check JSON-LD
    const ld = extractFromJsonLd(doc, url, 'progress_residential');

    // 2. Check window state or next/hydrated script
    const nd = getNextData(doc);
    let prop = null;
    if (nd) {
      const paths = [
        ['props', 'pageProps', 'property'],
        ['props', 'pageProps', 'home'],
        ['props', 'pageProps', 'listingData'],
        ['props', 'pageProps', 'initialState', 'property'],
      ];
      for (const p of paths) {
        const v = walk(nd, p);
        if (v && (v.id || v.streetAddress || v.address || v.marketRent)) { prop = v; break; }
      }
    }

    if (prop) {
      const street = prop.streetAddress || prop.address || prop.line1 || '';
      const city   = prop.city || '';
      const state  = prop.state || prop.stateCode || '';
      const zip    = prop.zip || prop.postalCode || '';
      const beds   = prop.bedrooms != null ? prop.bedrooms : (prop.beds != null ? prop.beds : null);
      const rawDesc = String(prop.description || prop.overview || '');
      const rawBaths = prop.bathrooms != null ? prop.bathrooms : (prop.baths != null ? prop.baths : null);
      const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(rawBaths, rawDesc);
      const sqft   = prop.squareFeet || prop.sqft || prop.livingArea || null;
      const yr     = prop.yearBuilt || null;
      const rent   = parseRent(prop.marketRent || prop.rent || prop.price, null);

      const photos = [];
      const seen = new Set();
      const addPhoto = (u) => {
        if (u && typeof u === 'string' && u.startsWith('http') && !seen.has(u)) {
          photos.push(u);
          seen.add(u);
        }
      };
      if (Array.isArray(prop.images || prop.photos || prop.media)) {
        (prop.images || prop.photos || prop.media).forEach(m => {
          addPhoto(typeof m === 'string' ? m : (m.url || m.largeImageUrl || m.href || m.src));
        });
      }

      return basePayload('progress_residential', String(prop.id || prop.propertyId || idFromUrl), url, {
        title: buildTitle(beds, 'SINGLE_FAMILY', city, street),
        address: street, city, state, zip,
        monthly_rent: rent,
        bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
        square_footage: sqft ? parseInt(String(sqft), 10) : null,
        year_built: yr ? parseInt(String(yr), 10) : null,
        property_type: 'SINGLE_FAMILY',
        description: prop.description || prop.overview || null,
        pets_allowed: true,
        available_date: parseDate(prop.availableDate || prop.readyDate),
        original_image_urls: JSON.stringify(photos.slice(0, 50)),
      });
    }

    if (ld && ld.address) return ld;

    // 3. DOM Fallback for Progress Residential
    return extractProgressResidentialDom(doc, url);
  }

  function extractProgressResidentialDom(doc, url) {
    if (!doc || typeof doc.querySelector !== 'function') return null;
    const idFromUrl = (url.match(/\/([a-z0-9_-]+)$/i) || [])[1] || 'pr_' + Date.now();

    const headingEl = doc.querySelector('.property-details-header h1, h1.property-title, .pdp-address, h1');
    const fullHeading = headingEl ? headingEl.textContent.trim() : '';
    const m = fullHeading.match(/^([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
    const street = m ? m[1].trim() : fullHeading;
    const city   = m ? m[2].trim() : '';
    const state  = m ? m[3].trim().toUpperCase() : '';
    const zip    = m && m[4] ? m[4].trim() : '';

    const rentEl = doc.querySelector('.property-price, .market-rent, .price-display, [data-testid="rent-price"]');
    const rent = rentEl ? parseRent(rentEl.textContent, null) : null;

    let beds = null, baths = null, sqft = null;
    const specItems = doc.querySelectorAll('.spec-item, .property-amenity, .badge-detail, .property-meta-item, li');
    specItems.forEach(item => {
      const t = item.textContent.toLowerCase();
      if (t.includes('bed') && !beds) beds = safeI(t);
      if (t.includes('bath') && !baths) {
        const bm = t.match(/([\d.]+)\s*ba/i);
        if (bm) baths = parseFloat(bm[1]);
      }
      if (t.includes('sq') || t.includes('sqft')) sqft = safeI(t);
    });

    const descEl = doc.querySelector('.property-description, .property-overview, #description');
    const rawDesc = descEl ? descEl.textContent.trim() : '';
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(baths, rawDesc);

    const photos = [];
    const imgs = doc.querySelectorAll('.gallery-slider img, .property-photos img, .swiper-slide img, img[src*="rentprogress"]');
    imgs.forEach(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy');
      if (src && src.startsWith('http') && !photos.includes(src)) photos.push(src);
    });

    return basePayload('progress_residential', idFromUrl, url, {
      title: buildTitle(beds, 'SINGLE_FAMILY', city, street),
      address: street, city, state, zip,
      monthly_rent: rent,
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft,
      property_type: 'SINGLE_FAMILY',
      description: rawDesc || null,
      pets_allowed: true,
      original_image_urls: JSON.stringify(photos.slice(0, 50)),
    });
  }

  // ── CJ Real Estate ───────────────────────────────────────────
  function extractCJRealEstate(doc, url) {
    const idFromUrl = (url.match(/\/detail\/([a-z0-9_-]+)/i) || url.match(/\/listings\/([a-z0-9_-]+)/i) || url.match(/\/([a-z0-9_-]+)$/i) || [])[1] || 'cj_' + Date.now();

    // Check JSON-LD
    const ld = extractFromJsonLd(doc, url, 'cj_real_estate');
    if (ld && ld.address && ld.monthly_rent) return ld;

    if (!doc || typeof doc.querySelector !== 'function') return ld || null;

    // CJ Real Estate uses AppFolio/Propertyware layout or custom WordPress listing template
    const titleEl = doc.querySelector('.listing-title, .property-title, h1, .rental-title');
    const fullTitle = titleEl ? titleEl.textContent.trim() : '';
    const m = fullTitle.match(/^([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
    const street = m ? m[1].trim() : (doc.querySelector('.property-address, .address')?.textContent.trim() || fullTitle);
    const city   = m ? m[2].trim() : (doc.querySelector('.property-city, .city')?.textContent.trim() || '');
    const state  = m ? m[3].trim().toUpperCase() : (doc.querySelector('.property-state, .state')?.textContent.trim() || '');
    const zip    = m && m[4] ? m[4].trim() : (doc.querySelector('.property-zip, .zip')?.textContent.trim() || '');

    const rentEl = doc.querySelector('.listing-price, .rental-price, .rent-amount, .price');
    const rent = rentEl ? parseRent(rentEl.textContent, null) : null;

    let beds = null, baths = null, sqft = null;
    const details = doc.querySelectorAll('.detail-item, .property-specs li, .meta-item, .amenity-item, tr');
    details.forEach(el => {
      const text = el.textContent.toLowerCase();
      if (text.includes('bed') && !beds) beds = safeI(text);
      if (text.includes('bath') && !baths) {
        const bm = text.match(/([\d.]+)\s*ba/i) || text.match(/([\d.]+)\s*bath/i);
        if (bm) baths = parseFloat(bm[1]);
      }
      if ((text.includes('sq') || text.includes('square')) && !sqft) sqft = safeI(text);
    });

    const descEl = doc.querySelector('.listing-desc, .property-description, .rental-description, .description-body');
    const rawDesc = descEl ? descEl.textContent.trim() : '';
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(baths, rawDesc);
    const propType = detectPropType(null, rawDesc, fullTitle);

    const photos = [];
    const imgs = doc.querySelectorAll('.property-gallery img, .listing-gallery img, .slider img, img[src*="appfolio"], img[src*="s3.amazonaws.com"], img[src*="cjproperties"]');
    imgs.forEach(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-large');
      if (src && src.startsWith('http') && !photos.includes(src)) photos.push(src);
    });

    return basePayload('cj_real_estate', idFromUrl, url, {
      title: buildTitle(beds, propType, city, street),
      address: street, city, state, zip,
      monthly_rent: rent,
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft,
      property_type: propType,
      description: rawDesc || null,
      pets_allowed: true,
      original_image_urls: JSON.stringify(photos.slice(0, 50)),
    });
  }

  // ── Registry + Multi-pattern URL Detection ────────────────────
  const EXTRACTORS = [
    { 
      id: 'zillow',     
      match: /zillow\.com\/(homedetails|homes|b|community|apartments)\/.*_zpid/i, 
      fn: extractZillow 
    },
    { 
      id: 'zillow',     
      match: /zillow\.com\/.*_zpid(\/|\?|$)/i, 
      fn: extractZillow 
    },
    { 
      id: 'zillow',     
      match: /zillow\.com\/(homedetails|b|community)\//i, 
      fn: extractZillow 
    },
    { 
      id: 'zillow',     
      match: /zillow\.com\/apartments\/[^/]+\/[^/]+\/[a-z0-9]+/i, 
      fn: extractZillow 
    },
    { 
      id: 'realtor',    
      match: /realtor\.com\/realestateandhomes-detail/i, 
      fn: extractRealtor 
    },
    { 
      id: 'apartments', 
      match: /apartments\.com\/[^/]+\/[^/]+/i, 
      fn: extractApartments 
    },
    { 
      id: 'redfin',     
      match: /redfin\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+/i, 
      fn: extractRedfin 
    },
    { 
      id: 'opendoor',     
      match: /opendoor\.com\/(homes|properties|listings)\/[^/]+/i, 
      fn: extractOpendoor 
    },
    { 
      id: 'opendoor',     
      match: /opendoor\.com\/[^/]+\/[^/]+/i, 
      fn: extractOpendoor 
    },
    { 
      id: 'progress_residential',     
      match: /rentprogress\.com\/(houses-for-rent|homes|properties|rental-homes)\/[^/]+/i, 
      fn: extractProgressResidential 
    },
    { 
      id: 'progress_residential',     
      match: /rentprogress\.com\/[^/]+\/[^/]+/i, 
      fn: extractProgressResidential 
    },
    { 
      id: 'cj_real_estate',     
      match: /cjproperties\.org\/(listings|rentals|properties|homes)\/[^/]+/i, 
      fn: extractCJRealEstate 
    },
    { 
      id: 'cj_real_estate',     
      match: /(cjrealestate\.com|cjproperties\.org)\/[^/]+/i, 
      fn: extractCJRealEstate 
    },
  ];

  function detect(url) {
    if (!url) return null;
    for (const e of EXTRACTORS) {
      if (e.match.test(url)) return e;
    }
    // General fallback for Zillow domain if detail modal or zpid is present
    if (/zillow\.com/i.test(url)) {
      if (url.includes('_zpid') || url.includes('/b/') || url.includes('/homedetails/')) {
        return { id: 'zillow', match: /zillow\.com/i, fn: extractZillow };
      }
    }
    if (/opendoor\.com/i.test(url)) {
      return { id: 'opendoor', match: /opendoor\.com/i, fn: extractOpendoor };
    }
    if (/rentprogress\.com/i.test(url)) {
      return { id: 'progress_residential', match: /rentprogress\.com/i, fn: extractProgressResidential };
    }
    if (/cjproperties\.org|cjrealestate\.com/i.test(url)) {
      return { id: 'cj_real_estate', match: /cjproperties|cjrealestate/i, fn: extractCJRealEstate };
    }
    return null;
  }

  function extract(url, doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return null;
    const e = detect(url);
    if (!e) {
      // Fallback: Check if Zillow detail modal is in DOM
      if (/zillow\.com/i.test(url) && d.querySelector && d.querySelector('[data-test="detail-modal"], [data-testid="search-detail-panel"], #search-detail-root, .layout-detail, [data-testid="hdp-top-bar"]')) {
        return extractZillow(d, url);
      }
      return null;
    }
    try {
      const res = e.fn(d, url);
      if (res && res.address) return res;
      // Secondary fallback to JSON-LD
      const ldRes = extractFromJsonLd(d, url, e.id);
      return ldRes || res;
    } catch (_) {
      try {
        return extractFromJsonLd(d, url, e.id);
      } catch (_) {
        return null;
      }
    }
  }

  const api = { 
    detect, 
    extract, 
    extractZillow, 
    extractZillowNextData, 
    extractZillowFromDom, 
    extractRealtor, 
    extractApartments, 
    extractRedfin, 
    extractOpendoor,
    extractOpendoorDom,
    extractProgressResidential,
    extractProgressResidentialDom,
    extractCJRealEstate,
    extractFromJsonLd, 
    EXTRACTORS 
  };

  global.CP_Extractors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
