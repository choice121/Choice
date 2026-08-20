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
  function buildTitle(beds, propType, city, street) {
    return city ? ((beds ? beds + 'BR ' : '') + fmtType(propType) + ' in ' + city) : (street || 'Rental Listing');
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
      garage_spaces: null, total_units: null, property_type: null, description: null,
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
    const bathsR = prop.bathrooms != null ? prop.bathrooms : (prop.baths != null ? prop.baths : null);
    const bathF  = bathsR != null ? Math.floor(bathsR) : null;
    const bathH  = bathsR != null && bathsR !== bathF ? 1 : null;
    const lat    = prop.latitude  || (prop.latLong && prop.latLong.latitude)  || null;
    const lng    = prop.longitude || (prop.latLong && prop.latLong.longitude) || null;
    const sqft   = prop.livingArea || prop.area || null;
    const yr     = prop.yearBuilt || rf.yearBuilt || null;
    const hood   = prop.neighborhoodName || prop.neighborhood || rf.subdivision || addr.neighborhood || null;
    const county = prop.county || addr.county || null;
    const vtour  = prop.virtualTourUrl || prop.threeDimensionalTourUrl || null;
    const propType = normalizeType(prop.homeType);

    const ctxParts = [];
    if (prop.walkScore    != null) ctxParts.push('Walk score: '    + prop.walkScore);
    if (prop.transitScore != null) ctxParts.push('Transit score: ' + prop.transitScore);
    if (prop.bikeScore    != null) ctxParts.push('Bike score: '    + prop.bikeScore);

    const amenityMap = {};
    const addA = (v) => { if (v && typeof v === 'string') { const t = v.trim(); if (t) amenityMap[t] = true; } };
    for (const t of (prop.tags || [])) addA(t);
    for (const f of [...(rf.communityFeatures || []), ...(rf.interiorFeatures || []), ...(rf.exteriorFeatures || []), ...(rf.poolFeatures || [])]) addA(f);

    let parking = null;
    if (rf.parkingFeatures && rf.parkingFeatures.length) parking = rf.parkingFeatures.join(', ');
    else if (prop.parkingType) parking = String(prop.parkingType).replace(/_/g, ' ');

    const pets = prop.isPetFriendly != null ? prop.isPetFriendly : (rf.petsAllowed != null ? rf.petsAllowed : null);
    const petTypes = [];
    if (rf.catsAllowed) petTypes.push('cats');
    if (rf.dogsAllowed) petTypes.push('dogs');

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
      bedrooms: beds, bathrooms: bathF, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      floors: safeI(prop.stories || rf.stories),
      garage_spaces: safeI(prop.garageParkingCapacity || prop.garageSpaces),
      total_units: safeI(prop.unitCount),
      property_type: propType,
      description: prop.description || null,
      neighborhood: hood, county,
      location_context: ctxParts.length ? ctxParts.join('; ') : null,
      pets_allowed: pets,
      pet_types_allowed: JSON.stringify(petTypes),
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
      appliances: JSON.stringify(rf.appliances || []),
      utilities_included: JSON.stringify(rf.utilities || rf.utilitiesIncluded || []),
      heating_type: rf.heating && rf.heating.length ? rf.heating.join(', ') : null,
      cooling_type: rf.cooling && rf.cooling.length ? rf.cooling.join(', ') : null,
      laundry_type: rf.laundryFeatures && rf.laundryFeatures.length ? rf.laundryFeatures.join(', ') : null,
      virtual_tour_url: vtour,
      has_basement: !!(rf.basement && rf.basement !== 'None' && rf.basement !== 'false' && rf.basement !== false),
      has_central_air: !!(rf.hasCooling || (rf.cooling && rf.cooling.some(c => c.toLowerCase().includes('central')))),
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
      const t = String(i['@type'] || '');
      return /Residence|Apartment|House|SingleFamilyResidence|RealEstateListing|Place|Product|Accommodation/i.test(t) || i.offers || i.address;
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
    if (res && res.address && res.monthly_rent) return res;

    // Tier 2: JSON-LD
    const ld = extractFromJsonLd(doc, url, 'zillow');
    if (ld && ld.address) {
      if (res) return Object.assign({}, ld, res, { address: res.address || ld.address, monthly_rent: res.monthly_rent || ld.monthly_rent });
      return ld;
    }

    // Tier 3: Live DOM Scraper
    const dom = extractZillowFromDom(doc, url);
    if (dom) {
      if (res) return Object.assign({}, dom, res, { address: res.address || dom.address, monthly_rent: res.monthly_rent || dom.monthly_rent });
      return dom;
    }

    return res || null;
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
    const bathsR = prop.baths != null ? prop.baths : (prop.bathrooms != null ? prop.bathrooms : null);
    const bathF  = bathsR != null ? Math.floor(bathsR) : null;
    const bathH  = bathsR != null && bathsR !== bathF ? 1 : null;
    const lat    = prop.lat || addr.lat || null;
    const lng    = prop.lng || addr.lng || null;
    const sqft   = prop.sqft || prop.square_feet || null;
    const yr     = prop.year_built || null;
    const propType = normalizeType(prop.prop_type || prop.property_type || prop.home_type);

    const photos = collectPhotoUrls(prop, ['photos']);
    if (prop.primary_photo) {
      const u = typeof prop.primary_photo === 'string' ? prop.primary_photo : prop.primary_photo.href;
      if (u && !photos.includes(u)) photos.unshift(u);
    }

    return basePayload('realtor', String(prop.property_id || prop.rdc_web_url || ''), url, {
      title: buildTitle(beds, propType, city, street),
      address: street, city, state, zip, lat, lng,
      monthly_rent: parseRent(prop.price || prop.list_price, null),
      bedrooms: beds, bathrooms: bathF, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      property_type: propType,
      description: prop.description || prop.text || null,
      neighborhood: prop.neighborhood_name || null,
      county: prop.county || null,
      available_date: parseDate(prop.available_date || prop.date_available),
      virtual_tour_url: prop.virtualTourUrl || null,
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
    const bathsR = prop.bathrooms != null ? prop.bathrooms : null;
    const bathF  = bathsR != null ? Math.floor(bathsR) : null;
    const bathH  = bathsR != null && bathsR !== bathF ? 1 : null;
    const lat    = prop.latitude || (prop.geo && prop.geo.lat) || null;
    const lng    = prop.longitude || (prop.geo && prop.geo.lng) || null;
    const sqft   = prop.squareFeet || prop.sqft || null;
    const yr     = prop.yearBuilt || null;

    const photos = collectPhotoUrls(prop, ['photos', 'images']);

    return basePayload('apartments', String(prop.id || ''), url, {
      title: buildTitle(beds, 'APARTMENT', city, street),
      address: street, city, state, zip, lat, lng,
      monthly_rent: parseRent(prop.price || prop.minPrice, null),
      bedrooms: beds, bathrooms: bathF, half_bathrooms: bathH,
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
    const zip    = addr.postal_code || addr.zipcode || prop.zipcode || '';
    const beds   = prop.beds != null ? prop.beds : null;
    const bathsR = prop.baths != null ? prop.baths : null;
    const bathF  = bathsR != null ? Math.floor(bathsR) : null;
    const bathH  = bathsR != null && bathsR !== bathF ? 1 : null;
    const lat    = prop.latitude || (prop.location && prop.location.latitude) || null;
    const lng    = prop.longitude || (prop.location && prop.location.longitude) || null;
    const sqft   = prop.sqft || prop.livingArea || null;
    const yr     = prop.yearBuilt || null;
    const propType = normalizeType(prop.propertyType || prop.homeType);

    const photos = collectPhotoUrls(prop, ['photos', 'images', 'media']);

    return basePayload('redfin', String(prop.propertyId || prop.id || ''), url, {
      title: buildTitle(beds, propType, city, street),
      address: street, city, state, zip, lat, lng,
      monthly_rent: parseRent(prop.price || prop.rent, null),
      bedrooms: beds, bathrooms: bathF, half_bathrooms: bathH,
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
    extractFromJsonLd, 
    EXTRACTORS 
  };

  global.CP_Extractors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
