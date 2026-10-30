// ============================================================
// Choice Properties — Canonical Multi-site Listing Extractor
// ============================================================
// THIS IS THE SINGLE SOURCE OF TRUTH for all listing extraction.
// Supported sites: Zillow, Realtor.com, Apartments.com, Redfin, Opendoor,
// Progress Residential, CJ Real Estate, Invitation Homes
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

  function findZillowProperty(root) {
    const stack = [{ value: root, depth: 0, key: '' }];
    const seen = new Set();
    let visited = 0;

    while (stack.length && visited < 20000) {
      const current = stack.pop();
      let value = current.value;
      if (typeof value === 'string' && /gdpClientCache/i.test(current.key)) {
        try { value = JSON.parse(value); } catch (_) { continue; }
      }
      if (!value || typeof value !== 'object' || seen.has(value) || current.depth > 12) continue;
      seen.add(value);
      visited++;

      if (value.zpid != null && (
        value.address || value.streetAddress || value.price != null ||
        value.bedrooms != null || value.homeType || value.responsivePhotos ||
        value.photos || value.hugePhotos
      )) return value;

      for (const key of Object.keys(value)) {
        const child = value[key];
        if (child && typeof child === 'object') {
          stack.push({ value: child, depth: current.depth + 1, key });
        } else if (typeof child === 'string' && /gdpClientCache/i.test(key)) {
          stack.push({ value: child, depth: current.depth + 1, key });
        }
      }
    }
    return null;
  }

  function parseZillowStreetAddress(text) {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/(?:^|[\n\r])\s*(\d{1,6}\s+[^,\n\r]{2,100}),\s*([^,\n\r]{2,60}),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/i);
    if (!match) return null;
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: match[3].toUpperCase(),
      zip: match[4]
    };
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

  function inferMediaProvider(url, fallback) {
    if (fallback && typeof fallback === 'string') return fallback.trim();
    const u = String(url || '').toLowerCase();
    if (u.includes('matterport.com')) return 'matterport';
    if (u.includes('zillow.com/view-3d-home') || u.includes('zillow.com/view-imx')) return 'zillow_3d';
    if (u.includes('insidemaps.com')) return 'insidemaps';
    if (u.includes('youriguide.com') || u.includes('iguide.com')) return 'iguide';
    if (u.includes('kuula.co')) return 'kuula';
    if (u.includes('cloudpano.com')) return 'cloudpano';
    if (u.includes('ricoh360.com')) return 'ricoh360';
    if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('youtube-nocookie.com')) return 'youtube';
    if (u.includes('vimeo.com')) return 'vimeo';
    if (u.includes('wistia.net') || u.includes('wistia.com')) return 'wistia';
    if (u.includes('loom.com')) return 'loom';
    if (/\.(?:mp4|webm|mov|m3u8)(?:[?#]|$)/i.test(u)) return 'direct_video';
    return null;
  }

  function normalizeExplicitFloorLabel(raw) {
    if (raw == null) return null;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 200) {
      return raw === 0 ? 'Ground Floor' : `Floor ${Math.trunc(raw)}`;
    }
    const text = String(raw).trim();
    if (!text) return null;
    if (/^\d{1,3}$/.test(text)) {
      const num = parseInt(text, 10);
      return num === 0 ? 'Ground Floor' : `Floor ${num}`;
    }
    return text.slice(0, 60);
  }

  function collectStructuredMedia(prop, virtualTourUrl) {
    const media = [];
    const seen = new Set();
    const add = (value, hint) => {
      const item = typeof value === 'string' ? { url: value } : value;
      if (!item || typeof item !== 'object') return;
      const url = item.url || item.href || item.src || item.embedUrl || item.embed_url || item.contentUrl || item.content_url;
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;

      const descriptor = [item.kind, item.type, item['@type'], item.mediaType, item.media_type, item.category, item.title, item.name, hint]
        .filter(Boolean).join(' ').toLowerCase();
      let kind = null;
      if (/floor[\s_-]*plan|floorplan/.test(descriptor)) kind = 'floor_plan';
      else if (/video|walkthrough|youtube|youtu\.be|vimeo|wistia|loom|\.mp4(?:\?|$)|\.webm(?:\?|$)|\.mov(?:\?|$)|\.m3u8(?:\?|$)/i.test(descriptor + ' ' + url)) kind = 'video';
      else if (/virtual[\s_-]*tour|3d[\s_-]*tour|matterport|insidemaps|iguide|youriguide|ricoh360|kuula|cloudpano|view-3d|view-imx|tour3d|\btour\b/i.test(descriptor + ' ' + url)) kind = 'virtual_tour';
      if (!kind) return;

      const key = `${kind}::${url.trim().toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const rawFloor = item.floor_label ?? item.floorLabel ?? item.floor ?? null;
      const rawBuilding = item.building_name ?? item.buildingName ?? (item.building && typeof item.building === 'string' ? item.building : null);
      const rawUnit = item.unit_number ?? item.unitNumber ?? (item.unit && typeof item.unit === 'string' ? item.unit : null);
      media.push({
        kind,
        title: item.title || item.name || (kind === 'floor_plan' ? 'Floor plan' : kind === 'video' ? 'Video walkthrough' : '3D Virtual Tour'),
        floor_label: normalizeExplicitFloorLabel(rawFloor),
        building_name: rawBuilding ? String(rawBuilding).trim().slice(0, 80) : null,
        unit_number: rawUnit ? String(rawUnit).trim().replace(/^unit\s+/i, '').slice(0, 40) : null,
        provider: inferMediaProvider(url, item.provider || item.source || null),
        url: url.trim(),
        poster_url: item.poster_url || item.posterUrl || item.thumbnailUrl || null,
        display_order: Number.isInteger(item.display_order) ? item.display_order : media.length,
        metadata: item.metadata || {},
      });
    };

    const mediaFields = [
      ['floorPlans', 'floor plan'], ['floor_plans', 'floor plan'], ['floorPlanImages', 'floor plan'],
      ['floorPlan', 'floor plan'], ['floorplan', 'floor plan'], ['floor_plan', 'floor plan'],
      ['videos', 'video'], ['video', 'video'], ['propertyVideos', 'video'], ['videoWalkthroughs', 'video'],
      ['virtualTours', 'virtual tour'], ['virtual_tours', 'virtual tour'],
      ['virtualTour', 'virtual tour'], ['threeDimensionalTours', '3d tour'], ['matterportTours', '3d tour'],
      ['tours', 'virtual tour'], ['media', 'media'],
    ];
    mediaFields.forEach(([field, hint]) => {
      const value = prop && prop[field];
      if (Array.isArray(value)) value.forEach(item => add(item, hint));
      else if (value) add(value, hint);
    });

    add(virtualTourUrl, 'virtual tour');
    return media;
  }

  function collectDomMedia(doc) {
    const groups = { floorPlans: [], videos: [], virtualTours: [] };
    const orderByKey = new Map();
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];

    const elements = doc.querySelectorAll([
      'iframe[src]', 'video', 'video source[src]', 'source[src]', 'a[href]',
      'img[alt]', 'img[title]', '[data-video-url]', '[data-virtual-tour-url]',
      '[data-floor-plan-url]', '[data-media-url]'
    ].join(', '));
    elements.forEach(el => {
      const tag = String(el.tagName || '').toLowerCase();
      const label = [
        el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('alt'),
        el.getAttribute('data-testid'), el.getAttribute('class'), el.textContent,
      ].filter(Boolean).join(' ').trim();
      const explicitFloor = el.getAttribute && (el.getAttribute('data-floor-label') || el.getAttribute('data-floor'));
      const explicitBuilding = el.getAttribute && (el.getAttribute('data-building-name') || el.getAttribute('data-building'));
      const explicitUnit = el.getAttribute && (el.getAttribute('data-unit-number') || el.getAttribute('data-unit'));
      const candidates = [
        el.currentSrc, el.src, el.href, el.getAttribute('src'), el.getAttribute('href'),
        el.getAttribute('data-video-url'), el.getAttribute('data-virtual-tour-url'),
        el.getAttribute('data-floor-plan-url'), el.getAttribute('data-media-url'),
      ];
      if (tag === 'video' && el.poster) candidates.push(el.poster);
      candidates.forEach(url => {
        if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;
        const descriptor = `${label} ${url}`;
        const matchedFloor = explicitFloor || (label.match(/\b(?:basement|ground|main|lower|upper|attic|penthouse|first|second|third|fourth)(?:\s+(?:floor|level))?\b|\b\d+(?:st|nd|rd|th)?\s+(?:floor|level)\b/i) || [])[0] || null;
        const item = {
          url,
          title: label.slice(0, 120),
          floor_label: normalizeExplicitFloorLabel(matchedFloor),
          building_name: explicitBuilding ? String(explicitBuilding).trim().slice(0, 80) : null,
          unit_number: explicitUnit ? String(explicitUnit).trim().replace(/^unit\s+/i, '').slice(0, 40) : null,
          poster_url: tag === 'video' && el.poster ? el.poster : null,
        };

        let kind = null;
        if (/floor[\s_-]*plan|floorplan/i.test(descriptor)) {
          groups.floorPlans.push(item);
          kind = 'floor_plan';
        } else if (tag === 'video' || tag === 'source' || /youtube\.com|youtu\.be|vimeo\.com|wistia\.net|loom\.com|\.(?:mp4|webm|mov|m3u8)(?:[?#]|$)/i.test(url) || /video|walkthrough/i.test(label)) {
          groups.videos.push(item);
          kind = 'video';
        } else if (/virtual[\s_-]*tour|3d[\s_-]*tour|matterport|insidemaps|iguide|youriguide|ricoh360|kuula|cloudpano|view-3d|view-imx|tour3d/i.test(descriptor)) {
          groups.virtualTours.push(item);
          kind = 'virtual_tour';
        }
        if (kind) orderByKey.set(`${kind}::${url.trim().toLowerCase()}`, orderByKey.size);
      });
    });

    const media = collectStructuredMedia(groups, null);
    media.sort((left, right) => {
      const leftOrder = orderByKey.get(`${left.kind}::${left.url.toLowerCase()}`) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderByKey.get(`${right.kind}::${right.url.toLowerCase()}`) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
    media.forEach((item, index) => { item.display_order = index; });
    return media;
  }

  function parseZillowUnitOption(value, sourceOrder, sourceKind) {
    if (!value || typeof value !== 'object') return null;
    const rawUnitNumber = value.unitNumber ?? value.unit_number ?? value.apartmentNumber ??
      value.apartment_number ?? value.unitLabel ?? value.unit_label ?? value.unit ?? null;
    const unitNumber = rawUnitNumber && typeof rawUnitNumber === 'object'
      ? rawUnitNumber.unitNumber ?? rawUnitNumber.unit_number ??
        rawUnitNumber.number ?? rawUnitNumber.label ?? rawUnitNumber.name ?? rawUnitNumber.value ?? null
      : rawUnitNumber;
    const unitLabel = unitNumber == null ? null : String(unitNumber).trim().replace(/^unit\s+/i, '');
    const validUnitLabel = isValidZillowUnitLabel(unitLabel) ? unitLabel : null;
    const rawFloorPlan = value.floorPlanName ?? value.floor_plan_name ??
      value.floorplanName ?? value.floorPlan ?? value.floor_plan ?? value.layoutName ?? value.layout_name ?? value.modelName ?? value.model_name;
    const parsedFloorPlanName = rawFloorPlan && typeof rawFloorPlan === 'object'
      ? rawFloorPlan.name ?? rawFloorPlan.title ?? rawFloorPlan.label ?? null
      : rawFloorPlan;
    const floorPlanName = parsedFloorPlanName == null ||
        /^(?:unit|floor[\s_-]*plan|plan)$/i.test(String(parsedFloorPlanName).trim())
      ? null
      : String(parsedFloorPlanName).trim();
    const rawBuilding = value.buildingName ?? value.building_name ??
      (value.building && typeof value.building === 'object'
        ? value.building.name ?? value.building.title ?? value.building.label ?? null
        : value.building) ?? null;
    const buildingName = rawBuilding && typeof rawBuilding === 'string' && rawBuilding.trim()
      ? rawBuilding.trim().slice(0, 80)
      : null;
    const rawFloor = value.floorLabel ?? value.floor_label ??
      (value.floor && typeof value.floor === 'object'
        ? value.floor.label ?? value.floor.name ?? value.floor.number ?? null
        : value.floor) ??
      value.floorNumber ?? value.floor_number ?? value.level ?? null;
    const floorLabel = normalizeExplicitFloorLabel(rawFloor);
    const rawPlanImg = value.floorPlanImageUrl ?? value.floor_plan_image_url ??
      value.floorPlanImage ?? value.floorplanImage ?? value.diagramUrl ?? value.diagram_url ??
      (rawFloorPlan && typeof rawFloorPlan === 'object' ? (rawFloorPlan.imageUrl ?? rawFloorPlan.image ?? rawFloorPlan.url) : null) ??
      (sourceKind === 'floor_plan' ? (value.image ?? value.imageUrl ?? null) : null);
    const planImgCandidate = rawPlanImg && typeof rawPlanImg === 'object'
      ? (rawPlanImg.url ?? rawPlanImg.src ?? rawPlanImg.href ?? null)
      : rawPlanImg;
    const floorPlanImageUrl = typeof planImgCandidate === 'string' && /^https?:\/\//i.test(planImgCandidate.trim())
      ? planImgCandidate.trim()
      : null;
    const rawUnitPhotos = value.unitPhotos ?? value.unit_photos ?? value.photos ?? value.images ?? [];
    const unitPhotos = (Array.isArray(rawUnitPhotos) ? rawUnitPhotos : [])
      .map(p => typeof p === 'string' ? p.trim() : (p && typeof p === 'object' ? String(p.url || p.src || p.href || '').trim() : ''))
      .filter(u => /^https?:\/\//i.test(u))
      .slice(0, 10);

    const rawBeds = value.bedrooms ?? value.beds ?? value.bedroomCount ??
      value.bedroom_count ?? value.bedCount ?? value.bed_count;
    const bedValue = rawBeds && typeof rawBeds === 'object'
      ? rawBeds.min ?? rawBeds.minimum ?? rawBeds.value ?? rawBeds.count
      : rawBeds;
    const bedText = String(bedValue ?? '');
    const bedMatch = bedText.match(/(\d+(?:\.\d+)?)/);
    const bedrooms = /\bstudio\b/i.test(bedText) ? 0 : (bedMatch ? Number(bedMatch[1]) : null);
    const rawBaths = value.bathrooms ?? value.baths ?? value.bathroomCount ??
      value.bathroom_count ?? value.bathCount ?? value.bath_count;
    const bathValue = rawBaths && typeof rawBaths === 'object'
      ? rawBaths.min ?? rawBaths.minimum ?? rawBaths.value ?? rawBaths.count
      : rawBaths;
    const baths = parseBaths(bathValue, '');
    const rawSqft = value.squareFootage ?? value.square_footage ?? value.sqft ??
      value.squareFeet ?? value.square_feet ?? value.minSquareFootage ??
      value.min_square_footage ?? value.livingArea ?? value.area;
    const sqftValue = rawSqft && typeof rawSqft === 'object'
      ? rawSqft.min ?? rawSqft.minimum ?? rawSqft.value
      : rawSqft;
    const sqftMatch = String(sqftValue ?? '').replace(/,/g, '').match(/\d+/);
    const squareFootage = sqftMatch ? Number(sqftMatch[0]) : null;
    const priceValue = value.monthlyRent ?? value.monthly_rent ?? value.startingRent ??
      value.starting_rent ?? value.minRent ?? value.min_rent ?? value.rent ??
      value.priceRange ?? value.price_range ?? value.rentRange ?? value.rent_range ??
      value.price ?? null;
    const price = priceValue && typeof priceValue === 'object'
      ? priceValue.min ?? priceValue.minimum ?? priceValue.lowPrice ?? priceValue.low_price ??
        priceValue.amount ?? priceValue.value ?? priceValue.price ?? null
      : priceValue;
    const rentDisplay = price == null ? null : String(price).trim();
    const rentAmount = price == null ? null : parseRent(price);
    if (unitLabel != null && !validUnitLabel && !floorPlanName) return null;
    if (!validUnitLabel && !floorPlanName && bedrooms == null && baths.bathrooms == null && squareFootage == null) return null;

    const option = {
      source_kind: validUnitLabel ? 'available_unit' : 'floor_plan',
      unit_number: validUnitLabel || null,
      floor_plan_name: floorPlanName == null ? null : String(floorPlanName).trim(),
      bedrooms,
      bathrooms: baths.bathrooms,
      half_bathrooms: baths.half_bathrooms,
      square_footage: squareFootage,
      monthly_rent: validUnitLabel ? rentAmount : null,
      starting_rent: validUnitLabel ? null : rentAmount,
      rent_display: rentDisplay,
      source_order: sourceOrder,
    };
    if (buildingName) option.building_name = buildingName;
    if (floorLabel) option.floor_label = floorLabel;
    if (floorPlanImageUrl) option.floor_plan_image_url = floorPlanImageUrl;
    if (unitPhotos.length > 0) option.unit_photos = unitPhotos;
    return option;
  }

  function getZillowRentBasis(doc) {
    const headers = doc && typeof doc.querySelectorAll === 'function'
      ? Array.from(doc.querySelectorAll('th, [role="columnheader"]'))
        .map(header => String(header.innerText || header.textContent || '').trim())
      : [];
    if (headers.length) {
      const hasTotalMonthlyPrice = headers.some(text => /\btotal\s+monthly\s+(?:leasing\s+)?price\b/i.test(text));
      const hasBaseRent = headers.some(text => /\bbase\s+rent\b/i.test(text));
      if (hasTotalMonthlyPrice !== hasBaseRent) {
        return hasTotalMonthlyPrice ? 'total_monthly_price' : 'base_rent';
      }
      return null;
    }

    return null;
  }

  function isValidZillowUnitLabel(value) {
    const label = String(value == null ? '' : value).trim().replace(/^#/, '');
    return /^(?:\d{1,6}[a-z]?|[a-z]{1,3}\d{1,5}|[a-z]|[a-z]{1,4}-\d{1,5}|\d{1,4}[a-z]?-\d{1,4})$/i.test(label);
  }

  function zillowUnitOptionKey(option) {
    if (option.source_kind === 'available_unit' && isValidZillowUnitLabel(option.unit_number)) {
      return 'unit:' + String(option.unit_number).toLowerCase();
    }
    return [
      'floor-plan',
      String(option.floor_plan_name || '').trim().toLowerCase(),
      option.bedrooms,
      option.bathrooms,
      option.square_footage,
      option.starting_rent,
    ].join('|');
  }

  function zillowUnitOptionCompleteness(option) {
    return [
      option.floor_plan_name,
      option.building_name,
      option.floor_label,
      option.floor_plan_image_url,
      option.bedrooms,
      option.bathrooms,
      option.half_bathrooms,
      option.square_footage,
      option.monthly_rent,
      option.starting_rent,
    ].filter(value => value !== null && value !== undefined && value !== '').length;
  }

  function mergeZillowFloorPlanOptions(left, right) {
    if (!left || !right || left.source_kind !== 'floor_plan' || right.source_kind !== 'floor_plan') return null;
    const leftName = String(left.floor_plan_name || '').trim().toLowerCase();
    const rightName = String(right.floor_plan_name || '').trim().toLowerCase();
    if (leftName && rightName && leftName !== rightName) return null;
    const fields = ['bedrooms', 'bathrooms', 'half_bathrooms', 'square_footage', 'starting_rent'];
    if (fields.some(field => left[field] != null && right[field] != null && left[field] !== right[field])) return null;
    const sharedIdentity = (left.square_footage != null && left.square_footage === right.square_footage) ||
      (left.starting_rent != null && left.starting_rent === right.starting_rent);
    if (!leftName && !rightName && !sharedIdentity) return null;
    if ((!leftName || !rightName) &&
        (left.bedrooms == null || left.bedrooms !== right.bedrooms ||
          left.bathrooms == null || left.bathrooms !== right.bathrooms || !sharedIdentity)) return null;

    const merged = Object.assign({}, left);
    fields.forEach(field => {
      if (merged[field] == null) merged[field] = right[field];
    });
    merged.floor_plan_name = left.floor_plan_name || right.floor_plan_name || null;
    if (left.building_name || right.building_name) merged.building_name = left.building_name || right.building_name;
    if (left.floor_label || right.floor_label) merged.floor_label = left.floor_label || right.floor_label;
    if (left.floor_plan_image_url || right.floor_plan_image_url) {
      merged.floor_plan_image_url = left.floor_plan_image_url || right.floor_plan_image_url;
    }
    merged.rent_display = left.rent_display || right.rent_display || null;
    merged.source_order = Math.min(left.source_order ?? Number.MAX_SAFE_INTEGER, right.source_order ?? Number.MAX_SAFE_INTEGER);
    return merged;
  }

  function addZillowUnitOption(options, option) {
    if (!option) return;
    for (const [key, existing] of options.entries()) {
      const merged = mergeZillowFloorPlanOptions(existing, option);
      if (!merged) continue;
      options.delete(key);
      options.set(zillowUnitOptionKey(merged), merged);
      return;
    }
    const key = zillowUnitOptionKey(option);
    const existing = options.get(key);
    if (!existing || zillowUnitOptionCompleteness(option) > zillowUnitOptionCompleteness(existing)) {
      options.set(key, option);
    }
  }

  function mergeZillowFloorPlanFragments(source) {
    const options = source.slice();
    const groupKey = option => [option.bedrooms, option.bathrooms, option.half_bathrooms].join('|');
    const groups = new Map();
    options.forEach(option => {
      if (!option || option.source_kind !== 'floor_plan' || option.bedrooms == null || option.bathrooms == null) return;
      const key = groupKey(option);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(option);
    });

    const replacements = new Map();
    const removed = new Set();
    groups.forEach(group => {
      const namedPrice = group.filter(option =>
        option.floor_plan_name && option.starting_rent != null && option.square_footage == null
      ).sort((a, b) => a.source_order - b.source_order);
      const sizeOnly = group.filter(option =>
        !option.floor_plan_name && option.starting_rent == null && option.square_footage != null
      ).sort((a, b) => a.source_order - b.source_order);

      if (namedPrice.length && namedPrice.length === sizeOnly.length) {
        namedPrice.forEach((plan, index) => {
          const size = sizeOnly[index];
          replacements.set(plan, Object.assign({}, plan, {
            square_footage: size.square_footage,
            source_order: Math.min(plan.source_order, size.source_order),
          }));
          removed.add(size);
        });
      }

      const hasNamedPlans = group.some(option => option.floor_plan_name);
      if (hasNamedPlans) {
        group.forEach(option => {
          if (!option.floor_plan_name && option.square_footage == null && option.starting_rent == null) {
            removed.add(option);
          }
        });
      }
    });

    return options.filter(option => !removed.has(option)).map(option => replacements.get(option) || option);
  }

  function mergeZillowUnitOptions(...sources) {
    const byKey = new Map();
    sources.forEach(source => {
      (Array.isArray(source) ? source : []).forEach(option => {
        if (!option || typeof option !== 'object') return;
        addZillowUnitOption(byKey, option);
      });
    });
    return mergeZillowFloorPlanFragments(Array.from(byKey.values())).map((option, index) =>
      Object.assign({}, option, { source_order: index })
    );
  }

  function parseZillowUnitText(text, sourceOrder, sourceKind, unitNumber, floorPlanName) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    const bedMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:bd|beds?|bedrooms?)\b/i);
    const studio = /\bstudio\b/i.test(normalized);
    const bathMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:ba|baths?|bathrooms?)\b/i);
    const sqftMatch = normalized.match(/\b([\d,]+)\s*(?:sqft|sq\s*ft|square\s*feet)\b/i);
    const prices = [...normalized.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)(?:\s*\+)?/g)]
      .filter(match => !/\b(?:application|admin|deposit|fee|special|discount|concession)\b/i.test(
        normalized.slice(Math.max(0, match.index - 24), match.index)
      ));
    const priceMatch = prices.length ? prices[0] : null;
    const priceText = priceMatch ? priceMatch[0].replace(/\s+/g, '') : null;
    if ((!priceText && sourceKind !== 'floor_plan') ||
        (!unitNumber && !studio && !bedMatch && !bathMatch && !sqftMatch)) return null;

    return parseZillowUnitOption({
      unitNumber,
      floorPlanName,
      bedrooms: studio ? 0 : (bedMatch ? bedMatch[1] : null),
      bathrooms: bathMatch ? bathMatch[1] : null,
      squareFootage: sqftMatch ? sqftMatch[1] : null,
      monthlyRent: priceText,
    }, sourceOrder, sourceKind);
  }

  function extractZillowUnitOptions(prop, doc, pageData) {
    const options = new Map();
    const add = option => {
      addZillowUnitOption(options, option);
    };
    const optionCount = () => options.size;
    const sourceArrays = [
      ['units', 'available_unit'], ['availableUnits', 'available_unit'],
      ['available_units', 'available_unit'], ['unitsAvailable', 'available_unit'],
      ['unitDetails', 'available_unit'], ['unit_details', 'available_unit'],
      ['rentals', 'available_unit'], ['apartments', 'available_unit'],
      ['floorPlans', 'floor_plan'], ['floorplans', 'floor_plan'],
      ['floor_plans', 'floor_plan'], ['floorPlanList', 'floor_plan'],
      ['floorPlanData', 'floor_plan'], ['unitTypes', 'floor_plan'], ['unit_types', 'floor_plan'],
      ['models', 'floor_plan'], ['layouts', 'floor_plan'],
    ];
    sourceArrays.forEach(([key, kind]) => {
      if (!Array.isArray(prop && prop[key])) return;
      prop[key].forEach(item => add(parseZillowUnitOption(item, optionCount(), kind)));
    });

    const visited = new Set();
    let visitedCount = 0;
    const walkUnitArrays = (node, parentKey, depth) => {
      if (typeof node === 'string' && /(?:gdpClientCache|unit|floor[\s_-]*plan|layout)/i.test(parentKey)) {
        try {
          walkUnitArrays(JSON.parse(node), parentKey, depth + 1);
        } catch (_) {}
        return;
      }
      if (!node || typeof node !== 'object' || visited.has(node) || depth > 10 || visitedCount >= 10000) return;
      visited.add(node);
      visitedCount++;
      if (Array.isArray(node)) {
        if (/(?:unit|floor[\s_-]*plan|layout|inventory|rent[\s_-]*option)/i.test(parentKey)) {
          const kind = /floor|plan|layout/i.test(parentKey) ? 'floor_plan' : 'available_unit';
          node.forEach(item => add(parseZillowUnitOption(item, optionCount(), kind)));
        }
        node.forEach(item => {
          if (item && typeof item === 'object') walkUnitArrays(item, parentKey, depth + 1);
        });
        return;
      }
      Object.keys(node).forEach(key => {
        const child = node[key];
        if (child && (typeof child === 'object' ||
          (typeof child === 'string' && /(?:gdpClientCache|unit|floor[\s_-]*plan|layout)/i.test(key)))) {
          walkUnitArrays(child, key, depth + 1);
        }
      });
    };
    walkUnitArrays(prop, '', 0);
    if (pageData && pageData !== prop) walkUnitArrays(pageData, '', 0);

    const rowTexts = [];
    if (doc && typeof doc.querySelectorAll === 'function') {
      const rows = doc.querySelectorAll([
        'tr', '[role="row"]', '[data-testid*="unit"]', '[data-test*="unit"]',
        '[data-testid*="floorplan"]', '[data-testid*="floor-plan"]',
        '[data-test*="floorplan"]', '[data-test*="floor-plan"]',
        '[class*="floorplan"]', '[class*="floorPlan"]', '[class*="floor-plan"]',
        '[role="listitem"]', 'article', 'li', 'div',
      ].join(', '));
      Array.from(rows).slice(0, 1000).forEach(row => {
        const text = String(row.innerText || row.textContent || '').trim();
        if (!text || text.length > 2000) return;
        const className = row.className && typeof row.className === 'string' ? row.className : '';
        const descriptor = [
          row.getAttribute && row.getAttribute('data-testid'),
          row.getAttribute && row.getAttribute('data-test'),
          row.getAttribute && row.getAttribute('aria-label'),
          className,
          row.getAttribute && row.getAttribute('data-unit-number'),
          row.getAttribute && row.getAttribute('data-unit'),
          row.getAttribute && row.getAttribute('data-floor-plan-name'),
        ].filter(Boolean).join(' ');
        let unitNumber = null;
        if (row.getAttribute) {
          unitNumber = row.getAttribute('data-unit-number') || row.getAttribute('data-unit') ||
            row.getAttribute('data-apartment-number');
        }
        const explicitUnit = text.match(/\bunit\s+#?([a-z0-9-]+)\b/i);
        if (!unitNumber && explicitUnit && isValidZillowUnitLabel(explicitUnit[1])) unitNumber = explicitUnit[1];
        if (!isValidZillowUnitLabel(unitNumber)) unitNumber = null;
        if (!unitNumber && row.querySelectorAll) {
          const cells = row.querySelectorAll('td, [role="cell"]');
          const firstCell = cells && cells.length ? String(cells[0].innerText || cells[0].textContent || '').trim() : '';
          if (isValidZillowUnitLabel(firstCell)) unitNumber = firstCell;
        }
        const hasPlanFacts = /(?:\bstudio\b|\b\d+(?:\.\d+)?\s*(?:bd|beds?|bedrooms?)\b)/i.test(text) &&
          (/\b\d+(?:\.\d+)?\s*(?:ba|baths?|bathrooms?)\b/i.test(text) ||
            /\b[\d,]+\s*(?:sqft|sq\s*ft|square\s*feet)\b/i.test(text));
        if (unitNumber || /floor[\s_-]*plan|floorplan|layout/i.test(descriptor) ||
            (hasPlanFacts && !/\bunit\s+#?[a-z0-9-]+\b/i.test(text))) {
          rowTexts.push({
            text,
            unitNumber,
            descriptor,
            floorPlanName: row.getAttribute && row.getAttribute('data-floor-plan-name'),
          });
        }
      });
    }
    const bodyText = doc && doc.body && typeof doc.body.innerText === 'string' ? doc.body.innerText : '';
    const lines = bodyText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const hasUnitLabel = line => {
      const match = String(line || '').match(/\bunit\s+#?([a-z0-9-]+)\b/i);
      return Boolean(match && isValidZillowUnitLabel(match[1]));
    };
    for (let index = 0; index < lines.length; index++) {
      if (!hasUnitLabel(lines[index])) continue;
      let end = index + 1;
      while (end < lines.length && end < index + 8 && !hasUnitLabel(lines[end])) end++;
      rowTexts.push({ text: lines.slice(index, end).join(' '), unitNumber: null, descriptor: 'body-unit-row' });
    }

    rowTexts.forEach(row => {
      const explicitUnit = row.text.match(/\bunit\s+#?([a-z0-9-]+)\b/i);
      const unitNumber = isValidZillowUnitLabel(row.unitNumber)
        ? row.unitNumber
        : (explicitUnit && isValidZillowUnitLabel(explicitUnit[1]) ? explicitUnit[1] : null);
      if (unitNumber) {
        add(parseZillowUnitText(row.text, optionCount(), 'available_unit', unitNumber, null));
      } else {
        const lines = row.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const firstLine = lines.find(line =>
          line && !/^(?:studio|\d+(?:\.\d+)?\s*(?:bd|beds?|ba|baths?|bedrooms?|bathrooms?)|[\d,]+\s*(?:sqft|sq\s*ft|square\s*feet)|starting\s+(?:at|from)|from\s+\$|see\s+(?:all|availability)|available\s+units?)\b/i.test(line) &&
          !/\$\s*[\d,]+/.test(line)
        );
        const hintedName = row.floorPlanName && String(row.floorPlanName)
          .replace(/^(?:floor[\s_-]*plan|plan)[\s:_-]*/i, '').trim();
        const candidateName = hintedName && !/floor[\s_-]*plan|^unit$/i.test(hintedName)
          ? hintedName
          : firstLine;
        const floorPlanName = candidateName && /^[a-z][a-z0-9 ._-]{0,24}$/i.test(candidateName) &&
          !/^(?:unit|floor plan|plan|availability|pricing)$/i.test(candidateName)
          ? candidateName
          : null;
        add(parseZillowUnitText(row.text, optionCount(), 'floor_plan', null, floorPlanName));
      }
    });
    return mergeZillowFloorPlanFragments(Array.from(options.values())).map((option, index) =>
      Object.assign({}, option, { source_order: index })
    );
  }

  function hasUsefulZillowCommunityData(payload) {
    return Boolean(payload && (
      payload.community_starting_rent != null ||
      (Array.isArray(payload.unit_options) && payload.unit_options.length > 0)
    ));
  }

  function isZillowBuildingPage(url, prop, text) {
    const hasUnitData = Boolean(prop && (
      Array.isArray(prop.units) || Array.isArray(prop.availableUnits) ||
      Array.isArray(prop.available_units) || Array.isArray(prop.floorPlans) ||
      Array.isArray(prop.unitTypes) || Array.isArray(prop.unit_types)
    ));
    const apartmentType = /apartment|multi[\s_-]*family|building/i.test(String(prop && (prop.homeType || prop.propertyType) || ''));
    return /zillow\.com\/(?:apartments|community)\//i.test(String(url || '')) ||
      /apartment\s+building|available\s+units/i.test(String(text || '')) ||
      (apartmentType && hasUnitData);
  }

  function mergeStructuredMedia(...sources) {
    const merged = [];
    const seen = new Set();
    sources.forEach(source => {
      (Array.isArray(source) ? source : []).forEach(item => {
        if (!item || typeof item.url !== 'string') return;
        const key = `${item.kind}::${item.url.trim().toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(item);
      });
    });
    return merged;
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

  function parseRent(rawPrice) {
    let rent = null;
    if (typeof rawPrice === 'number' && rawPrice > 0) rent = rawPrice;
    else if (rawPrice) {
      const match = String(rawPrice).replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/);
      rent = match ? parseFloat(match[1]) : null;
    }
    return rent;
  }

  function formatZillowPriceRange(value) {
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number' && Number.isFinite(value)) return '$' + value.toLocaleString();
    if (!value || typeof value !== 'object') return null;
    const min = value.min ?? value.minimum ?? value.lowPrice ?? value.low_price ?? null;
    const max = value.max ?? value.maximum ?? value.highPrice ?? value.high_price ?? null;
    const format = price => {
      const amount = parseRent(price);
      return amount == null ? null : '$' + amount.toLocaleString();
    };
    const minText = format(min);
    const maxText = format(max);
    if (minText && maxText) return minText + ' – ' + maxText;
    if (minText) return minText + '+';
    return null;
  }

  const TYPE_MAP = {
    SINGLE_FAMILY: 'SINGLE_FAMILY', MULTI_FAMILY: 'MULTI_FAMILY', CONDO: 'CONDOS',
    CONDO_TOWNHOME: 'CONDOS', TOWNHOUSE: 'TOWNHOMES', APARTMENT: 'APARTMENT',
    MANUFACTURED: 'MOBILE', MOBILE: 'MOBILE', LOT: 'LAND', LAND: 'LAND', FARM: 'FARM',
  };
  function normalizeType(homeType) {
    const values = Array.isArray(homeType) ? homeType : [homeType];
    const types = values
      .filter(type => typeof type === 'string' && type.trim())
      .map(type => type.split(/[\/#]/).pop().toUpperCase().replace(/[^A-Z_]/g, '_'));
    const type = types.find(value => TYPE_MAP[value]) || types[0];
    return TYPE_MAP[type] || type || null;
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
  function extractFeaturesFromNarrative(desc) {
    if (!desc || typeof desc !== 'string') return {};
    const text = desc.toLowerCase();
    const res = {};

    // 1. Appliances
    const appSet = new Set();
    if (/\b(?:gas\s*range|gas\s*stove)\b/i.test(text)) appSet.add('Gas Range');
    else if (/\b(?:electric\s*range|electric\s*stove|range|stove)\b/i.test(text)) appSet.add('Range / Oven');
    if (/\b(?:double\s*ovens?)\b/i.test(text)) appSet.add('Double Oven');
    else if (/\bovens?\b/i.test(text) && !appSet.has('Range / Oven')) appSet.add('Oven');
    if (/\bdishwashers?\b/i.test(text)) appSet.add('Dishwasher');
    if (/\b(?:refrigerators?|fridge)\b/i.test(text)) appSet.add('Refrigerator');
    if (/\bmicrowaves?\b/i.test(text)) appSet.add('Microwave');
    if (/\b(?:garbage\s*disposal|disposal)\b/i.test(text)) appSet.add('Garbage Disposal');
    if (/\bfreezer\b/i.test(text)) appSet.add('Freezer');
    if (/\b(?:full\s*size\s*washer|washer\s*(?:and|&)\s*dryer|washer\s*and\s*dryer\s*units?)\b/i.test(text)) {
      appSet.add('Washer');
      appSet.add('Dryer');
    } else {
      if (/\bwashers?\b/i.test(text) && !/\bdishwasher/i.test(text)) appSet.add('Washer');
      if (/\bdryers?\b/i.test(text)) appSet.add('Dryer');
    }
    if (appSet.size > 0) res.appliances = Array.from(appSet);

    // 2. Garage / Parking
    const garageMatch = text.match(/\b([1-4])\s*(?:car|bay)\s*garage\b/i);
    if (garageMatch) {
      res.garage_spaces = parseInt(garageMatch[1], 10);
      res.parking = `${garageMatch[1]}-Car Garage`;
    } else if (/\b(?:attached\s*garage|2-car\s*garage|garage)\b/i.test(text)) {
      res.parking = 'Attached Garage';
    } else if (/\bcarport\b/i.test(text)) {
      res.parking = 'Carport';
    } else if (/\b(?:off-street\s*parking|off\s*street\s*parking|driveway)\b/i.test(text)) {
      res.parking = 'Off-Street Parking';
    }

    // 3. Laundry
    if (/\b(?:separate\s*laundry\s*room|laundry\s*room|in-unit\s*washer|in\s*unit\s*washer|washer\s*and\s*dryer\s*in\s*unit)\b/i.test(text)) {
      res.laundry_type = 'In Unit (Dedicated Laundry Room)';
    } else if (/\b(?:washer\s*and\s*dryer\s*hookups?|w\/d\s*hookups?|washer\s*hookups?|dryer\s*hookups?)\b/i.test(text)) {
      res.laundry_type = 'Washer/Dryer Hookups';
    } else if (/\b(?:shared\s*laundry|on-site\s*laundry)\b/i.test(text)) {
      res.laundry_type = 'On-Site Laundry';
    }

    // 4. Flooring
    const floorSet = new Set();
    if (/\b(?:hardwood|hardwood\s*floors?|wood\s*floors?)\b/i.test(text)) floorSet.add('Hardwood');
    if (/\b(?:carpet|carpeted|carpeting)\b/i.test(text)) floorSet.add('Carpet');
    if (/\b(?:tile|ceramic\s*tile|tiled)\b/i.test(text)) floorSet.add('Tile');
    if (/\b(?:vinyl|luxury\s*vinyl|lvp|plank)\b/i.test(text)) floorSet.add('Vinyl Plank');
    if (floorSet.size > 0) res.flooring = Array.from(floorSet);

    // 5. HVAC
    if (/\b(?:central\s*air|central\s*a\/c|central\s*ac|central\s*cooling)\b/i.test(text)) {
      res.cooling_type = 'Central Air';
      res.has_central_air = true;
    }
    if (/\b(?:wall\s*furnace|forced\s*air|heat\s*pump|central\s*heat)\b/i.test(text)) {
      if (/\bwall\s*furnace\b/i.test(text)) res.heating_type = 'Wall Furnace';
      else if (/\bheat\s*pump\b/i.test(text)) res.heating_type = 'Heat Pump';
      else res.heating_type = 'Forced Air Heat';
    }

    // 6. Amenities
    const extraAmenities = [];
    if (/\b(?:swimming\s*pool|pool)\b/i.test(text)) extraAmenities.push('Swimming Pool');
    if (/\b(?:private\s*backyard|backyard|fenced\s*yard|large\s*yard|landscaped\s*backyard)\b/i.test(text)) extraAmenities.push('Private Fenced Yard');
    if (/\b(?:patio|balcony|deck)\b/i.test(text)) extraAmenities.push('Patio / Outdoor Living Area');
    if (/\bfireplaces?\b/i.test(text)) extraAmenities.push('Fireplace');
    if (/\bbasement\b/i.test(text) && !/\bno\s*basement\b/i.test(text)) {
      extraAmenities.push('Basement Storage');
      res.has_basement = true;
    }
    if (extraAmenities.length > 0) res.amenities = extraAmenities;

    return res;
  }

  function detectPropType(homeType, descText, titleText, addressText) {
    const fullText = (String(descText || '') + ' ' + String(titleText || '') + ' ' + String(addressText || '')).toLowerCase();

    // Strict Duplex check (Rule 6B)
    if (/\b(?:1\/2\s*duplex|half\s*duplex|half-duplex|duplex|side-by-side|two-family)\b/i.test(fullText)) {
      return 'DUPLEX';
    }
    // Strict Townhouse check (Rule 6B)
    if (/\b(?:townhouse|townhome|rowhouse|row-house)\b/i.test(fullText)) {
      return 'TOWNHOUSE';
    }

    // Clean out agent/manager contact signatures before evaluating apartment keywords so broker lines do not trigger false positives
    const cleanDesc = String(descText || '')
      .replace(/(?:call|contact|managed by|professionally managed|agent|broker|cell|phone|realtor|showing)[\s\S]{0,120}apartments?/gi, '')
      .toLowerCase();
    const combinedDesc = (cleanDesc + ' ' + String(titleText || '')).toLowerCase();

    if (/\b(?:apartment|unit complex|multi-family|high-rise|mid-rise)\b/i.test(combinedDesc)) {
      if (!/\b(?:single family|single-family|craftsman home|detached house)\b/i.test(combinedDesc)) {
        return 'APARTMENT';
      }
    }

    // Detached Single Family cues
    if (/\b(?:single family|single-family|detached single family|detached house|craftsman home)\b/i.test(fullText)) {
      return 'SINGLE_FAMILY';
    }

    const t = (homeType || '').toUpperCase().replace(/[^A-Z_]/g, '_');
    return TYPE_MAP[t] || t || 'SINGLE_FAMILY';
  }
  function buildTitle(beds, propType, city, street, rawTitle, state, zip, baths, sqft, yearBuilt) {
    const typeNames = {
      'SINGLE_FAMILY': 'Single-Family Home',
      'TOWNHOUSE': 'Townhome',
      'DUPLEX': 'Duplex',
      'APARTMENT': 'Apartment Unit'
    };
    const tName = typeNames[(propType || '').toUpperCase()] || 'Residence';
    const cityName = city || 'Property';
    return `${cityName} ${tName}`;
  }

  function cleanForSaleText(text) {
    if (!text) return null;
    let s = String(text);
    s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\b(?:for\s+sale|listed\s+for\s+sale|on\s+the\s+market|priced\s+to\s+sell|motivated\s+seller|mortgage|down\s*payment|fha|conventional\s+financing|va\s+loan|seller\s+financing|title\s+company|escrow|closing\s+costs?|earnest\s+money|open\s+house|investor\s+special|cash\s+flow|arv\b|opendoor\s+brokerage|make\s+an\s+offer)\b[^\n.!?]*[.!?]?/gi, ' ');
    s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\bsecurity\s+deposit\b[^\n.!?]*[.!?]?/gi, ' ');
    s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\b(?:available\s+(?:now|immediately|today|soon|for\s+rent|on\s+\w+|from\s+\w+)|move-?in\s+ready|ready\s+for\s+(?:immediate\s+)?move-?in|available\s+date)\b[^\n.!?]*[.!?]?/gi, ' ');
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
      monthly_rent: null, community_starting_rent: null, bedrooms: null, bathrooms: null, half_bathrooms: null,
      rent_basis: null,
      square_footage: null, year_built: null, lot_size_sqft: null, floors: null,
      garage_spaces: null, total_units: null, property_type: null, description: null, original_description: null,
      building_name: null, is_multi_unit: null, price_range: null,
      neighborhood: null, county: null, location_context: null, pets_allowed: null,
      pet_types_allowed: null, available_date: null, listed_at: null, minimum_lease_months: null,
      smoking_allowed: null, security_deposit: null, pet_deposit: null, admin_fee: null,
      parking_fee: null, application_fee: null, hoa_fee: null, last_months_rent: null,
      move_in_special: null, parking: null, amenities: null, appliances: null, flooring: null,
      utilities_included: null, heating_type: null, cooling_type: null, laundry_type: null,
      virtual_tour_url: null, has_basement: null, has_central_air: null,
      media: [], unit_options: [],
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
    if (!prop) prop = findZillowProperty(nd);
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
    const unitOptions = extractZillowUnitOptions(prop, doc, nd);
    const buildingPage = isZillowBuildingPage(url, prop, doc && doc.body && doc.body.innerText);
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
    const vtour  = prop.virtualTourUrl || prop.threeDimensionalTourUrl || prop.tour3d || prop.view3dUrl || (rf && (rf.virtualTourUrl || rf.threeDimensionalTourUrl)) || (prop.view3dHomeId ? 'https://www.zillow.com/view-3d-home/' + prop.view3dHomeId : null) || null;
    const propType = buildingPage ? 'APARTMENT' : detectPropType(prop.homeType, rawDesc, prop.title || '', street);
    const rawBuildingNameValue = prop.buildingName || prop.communityName ||
      (prop.building && (prop.building.name || prop.building.title)) ||
      prop.name || (prop.title && prop.title !== 'Property Apartment Unit' ? prop.title : null);
    const rawBuildingName = rawBuildingNameValue && typeof rawBuildingNameValue === 'object'
      ? rawBuildingNameValue.name || rawBuildingNameValue.title || rawBuildingNameValue.label || null
      : rawBuildingNameValue;
    const buildingName = buildingPage && typeof rawBuildingName === 'string' &&
      !/^(?:property|property apartment unit|apartment unit)$/i.test(rawBuildingName.trim())
      ? rawBuildingName.trim()
      : null;

    const ctxParts = [];
    if (prop.walkScore    != null) ctxParts.push('Walk score: '    + prop.walkScore);
    if (prop.transitScore != null) ctxParts.push('Transit score: ' + prop.transitScore);
    if (prop.bikeScore    != null) ctxParts.push('Bike score: '    + prop.bikeScore);

    const schoolList = [];
    if (rf.elementarySchool) schoolList.push('Elementary: ' + rf.elementarySchool);
    if (rf.middleOrJuniorSchool) schoolList.push('Middle: ' + rf.middleOrJuniorSchool);
    if (rf.highSchool) schoolList.push('High: ' + rf.highSchool);
    if (Array.isArray(rf.schools)) {
      rf.schools.forEach(s => {
        if (s && s.name) schoolList.push(s.name + (s.level ? ' (' + s.level + ')' : ''));
      });
    }
    if (schoolList.length) ctxParts.push('Schools: ' + schoolList.slice(0, 3).join(', '));

    const amenityMap = {};
    const addA = (v) => {
      if (v && typeof v === 'string') {
        const t = v.trim();
        if (!t) return;
        // Rule 1 & Rule 14: Never ingest smoking policies or lease durations as amenity badges
        if (/smoke|smoking|tobacco|\bpets?\b|pet[-\s]?friendly|animal policy/i.test(t)) return;
        if (/\b(?:\d+[\s-]*month|lease\s*term|month\s*to\s*month)\b/i.test(t)) return;
        amenityMap[t] = true;
      }
    };
    for (const t of (prop.tags || [])) addA(t);
    for (const f of [...(rf.communityFeatures || []), ...(rf.interiorFeatures || []), ...(rf.exteriorFeatures || []), ...(rf.poolFeatures || [])]) addA(f);

    let parking = null;
    if (rf.parkingFeatures && rf.parkingFeatures.length) parking = rf.parkingFeatures.join(', ');
    else if (prop.parkingType) parking = String(prop.parkingType).replace(/_/g, ' ');

    let hasBasement = null;
    if (typeof rf.basement === 'boolean') hasBasement = rf.basement;
    else if (typeof rf.basement === 'string' && rf.basement.trim()) {
      hasBasement = !/^(?:none|no(?:\s+basement)?|false|n\/a)$/i.test(rf.basement.trim());
    }
    let hasCentralAir = rf.hasCooling === false ? false : null;
    if (Array.isArray(rf.cooling) && rf.cooling.length) {
      hasCentralAir = rf.cooling.some(c => String(c).toLowerCase().includes('central'));
    }
    let heatingType = rf.heating && rf.heating.length ? rf.heating.join(', ') : null;
    let coolingType = rf.cooling && rf.cooling.length ? rf.cooling.join(', ') : null;
    let appliances = rf.appliances ? [...rf.appliances] : [];
    let laundryType = rf.laundryFeatures && rf.laundryFeatures.length ? rf.laundryFeatures.join(', ') : null;
    let lotSizeSqft = null;
    let flooring = null;
    if (rf.flooring && Array.isArray(rf.flooring)) flooring = JSON.stringify(rf.flooring);
    else if (rf.flooring) flooring = JSON.stringify([String(rf.flooring)]);

    // --- Deep traversal of resoFacts.features categories ---
    if (Array.isArray(rf.features)) {
      rf.features.forEach(group => {
        const cat = (group.categoryName || group.name || '').toLowerCase();
        const items = group.features || group.items || [];
        if (Array.isArray(items)) {
          items.forEach(item => {
            const str = typeof item === 'string' ? item : item?.name;
            if (!str) return;
            if (cat.includes('appliance')) {
              if (!appliances.includes(str)) appliances.push(str);
            } else if (cat.includes('parking') && !parking) {
              parking = str;
            } else if (cat.includes('flooring')) {
              try {
                const cur = flooring ? JSON.parse(flooring) : [];
                if (!cur.includes(str)) cur.push(str);
                flooring = JSON.stringify(cur);
              } catch (_) {}
            } else if (cat.includes('laundry') && !laundryType) {
              laundryType = str;
            } else if (cat.includes('cooling') && !coolingType) {
              coolingType = str;
              if (str.toLowerCase().includes('central')) hasCentralAir = true;
            } else if (cat.includes('heating') && !heatingType) {
              heatingType = str;
            } else {
              addA(str);
            }
          });
        }
      });
    }

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
      hasCentralAir = coolingType.toLowerCase().includes('central');
    }
    if (factMap['parking']) parking = factMap['parking'];
    if (factMap['lot size']) lotSizeSqft = parseInt(factMap['lot size'].replace(/[^0-9]/g, ''), 10) || lotSizeSqft;
    if (factMap['basement']) {
      hasBasement = !/^(?:none|no(?:\s+basement)?|false|n\/a)$/i.test(factMap['basement'].trim());
    }
    if (factMap['appliances']) {
      const splitApps = factMap['appliances'].split(',').map(s => s.trim());
      splitApps.forEach(sa => { if (!appliances.includes(sa)) appliances.push(sa); });
    }
    if (factMap['laundry']) laundryType = factMap['laundry'];
    if (factMap['flooring']) {
      const splitFloors = factMap['flooring'].split(',').map(s => s.trim());
      flooring = JSON.stringify(splitFloors);
    }

    if (prop.amenityCategories && Array.isArray(prop.amenityCategories)) {
      prop.amenityCategories.forEach(cat => {
        if (cat.amenities && Array.isArray(cat.amenities)) {
          if (/pet/i.test(String(cat.category || ''))) return;
          cat.amenities.forEach(a => addA(a));
        }
      });
    }
    // -----------------------------------------------------------------------------

    // --- In-Extractor Narrative Fallback Harvesting (Eliminates Feature Blindness) ---
    let garageSpaces = safeI(prop.garageParkingCapacity || prop.garageSpaces);
    const harvested = extractFeaturesFromNarrative(rawDesc);
    if ((!appliances || appliances.length === 0) && harvested.appliances) {
      appliances = harvested.appliances;
    }
    if (!parking && harvested.parking) {
      parking = harvested.parking;
    }
    if (garageSpaces == null && harvested.garage_spaces) {
      garageSpaces = harvested.garage_spaces;
    }
    if (!laundryType && harvested.laundry_type) {
      laundryType = harvested.laundry_type;
    }
    if ((!flooring || flooring === '[]' || flooring.length === 0) && harvested.flooring) {
      flooring = JSON.stringify(harvested.flooring);
    }
    if (!coolingType && harvested.cooling_type) {
      coolingType = harvested.cooling_type;
      if (harvested.has_central_air) hasCentralAir = true;
    }
    if (!heatingType && harvested.heating_type) {
      heatingType = harvested.heating_type;
    }
    if (harvested.has_basement) hasBasement = true;
    if (harvested.amenities) {
      harvested.amenities.forEach(a => addA(a));
    }

    let utilitiesInc = rf.utilities || rf.utilitiesIncluded || [];
    if ((!utilitiesInc || !utilitiesInc.length) && factMap['utilities']) {
      utilitiesInc = factMap['utilities'].split(',').map(s => s.trim());
    }

    const zTitle = (street
      ? (city ? street + ', ' + city + ', ' + state + (zip ? ' ' + zip : '') : street).trim()
      : (prop.title && String(prop.title).trim()) ||
        (buildingPage && prop.name && String(prop.name).trim())) ||
      buildTitle(beds, propType, city, street, null, state, zip);

    return basePayload('zillow', zpid, canonicalZillowUrl(url, zpid), {
      title: zTitle,
      address: street, city, state, zip, lat, lng,
      monthly_rent: buildingPage ? null : parseRent(prop.price || prop.unformattedPrice),
      community_starting_rent: buildingPage ? parseRent(prop.price || prop.unformattedPrice) : null,
      bedrooms: buildingPage ? null : beds,
      bathrooms: buildingPage ? null : bathVal,
      half_bathrooms: buildingPage ? null : bathH,
      total_bathrooms: buildingPage ? null : bathVal,
      square_footage: buildingPage ? null : (sqft ? parseInt(String(sqft), 10) : null),
      year_built: yr ? parseInt(String(yr), 10) : null,
      lot_size_sqft: lotSizeSqft,
      floors: safeI(prop.stories ?? prop.numberOfStories ?? rf.stories ?? rf.numberOfStories),
      garage_spaces: garageSpaces,
      total_units: safeI(prop.unitCount ?? prop.totalUnits ?? prop.numberOfUnitsTotal ?? rf.numberOfUnitsTotal),
      building_name: buildingName,
      is_multi_unit: buildingPage,
      price_range: buildingPage ? formatZillowPriceRange(prop.priceRange ?? prop.price_range ?? prop.rentRange ?? prop.rent_range) : null,
      property_type: propType,
      description: prop.description || null,
      original_description: prop.description || rf.description || null,
      neighborhood: hood, county,
      location_context: ctxParts.length ? ctxParts.join('; ') : null,
      pets_allowed: null,
      pet_types_allowed: null,
      available_date: null,
      minimum_lease_months: null,
      smoking_allowed: null,
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
      flooring,
      utilities_included: JSON.stringify(utilitiesInc),
      heating_type: heatingType,
      cooling_type: coolingType,
      laundry_type: laundryType,
      virtual_tour_url: vtour,
      media: collectStructuredMedia(prop, vtour),
      unit_options: unitOptions,
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
      if (p) rent = parseRent(p, null);
    }

    const beds = prop.numberOfBedrooms || prop.numberOfRooms || null;
    const baths = prop.numberOfBathroomsTotal || prop.numberOfFullBathrooms || null;
    const desc = prop.description || null;
    const propertyTypes = Array.isArray(prop['@type']) ? prop['@type'] : [prop['@type']];
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
    const media = collectStructuredMedia(prop, null);
    const virtualTour = media.find(item => item.kind === 'virtual_tour' || item.kind === 'tour_3d');

    return basePayload(sourceName, sourceId, url, {
      title: prop.name || (street ? buildTitle(beds, 'APARTMENT', city, street) : null),
      address: street || prop.name || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      lat, lng,
      monthly_rent: rent,
      bedrooms: beds ? Number(beds) : null,
      bathrooms: baths ? parseBaths(baths, desc).bathrooms : null,
      half_bathrooms: baths && (Number(baths) % 1 !== 0) ? 1 : null,
      property_type: propertyTypes.some(type =>
        typeof type === 'string' && /SingleFamilyResidence|House|Residence/i.test(type)
      )
        ? 'SINGLE_FAMILY'
        : normalizeType(propertyTypes) || 'APARTMENT',
      description: desc,
      original_description: desc,
      virtual_tour_url: virtualTour ? virtualTour.url : null,
      media,
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
    let headingText = '';

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
      headingText = h1El.textContent.trim();
      const parts = headingText.split(',').map(s => s.trim());
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
        address = headingText;
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

    const summaryText = doc.body ? doc.body.innerText : '';
    const buildingPage = isZillowBuildingPage(url, null, summaryText);
    if (buildingPage && address && !/\d/.test(address)) {
      address = null;
      city = null;
      state = null;
      zip = null;
    }
    if (!address || !city || !state || !zip) {
      const parsedAddress = parseZillowStreetAddress(summaryText);
      if (parsedAddress) {
        address = parsedAddress.street;
        city = parsedAddress.city;
        state = parsedAddress.state;
        zip = parsedAddress.zip;
      }
    }
    if (buildingPage && (!city || !state)) {
      const locationMatch = (headingText + '\n' + summaryText).match(/\bin\s+([A-Z][A-Za-z .'-]+),\s*([A-Z]{2})(?:\s+(\d{5}))?/);
      if (locationMatch) {
        city = city || locationMatch[1].trim();
        state = state || locationMatch[2];
        zip = zip || locationMatch[3] || null;
      }
    }

    // 2. Price detection
    let price = null;
    const priceSelector = [
      'span[data-testid="price"]',
      '[data-testid="price"] span',
      'span[data-test="price"]',
      '.summary-container [data-testid="price"]',
      'span[class*="Price-c11n"]',
      '[data-test="bdp-price-range"]',
      'span[data-testid="price-summary"]',
      '[data-testid*="rent"]',
      '[data-test-id*="rent"]',
      '[data-testid*="price"]',
      '[data-test-id*="price"]',
      '[class*="rent"]',
      '[class*="price"]'
    ].join(', ');
    const priceEls = doc.querySelectorAll(priceSelector);
    const priceCandidates = priceEls && priceEls.length
      ? Array.from(priceEls)
      : [doc.querySelector(priceSelector)].filter(Boolean);
    for (const candidate of priceCandidates) {
      const priceText = (candidate.textContent || '').trim();
      const testId = candidate.getAttribute && (
        candidate.getAttribute('data-testid') || candidate.getAttribute('data-test-id') ||
        candidate.getAttribute('data-test') || ''
      );
      const unitContainer = candidate.closest
        ? candidate.closest('[data-testid*="unit"], [data-test*="unit"], tr, [role="row"]')
        : null;
      const priceContext = [
        priceText,
        testId,
        candidate.parentElement && candidate.parentElement.textContent,
        unitContainer && unitContainer.textContent,
      ].filter(Boolean).join(' ');
      if (buildingPage) {
        const unitSpecific = Boolean(unitContainer || /\bunit\s+[a-z0-9-]+\b/i.test(priceContext));
        const labeledCommunityPrice = /\b(?:starting\s+(?:at|from)|from\s+\$|rent\s+range|price\s+range)\b/i.test(priceContext) ||
          /(?:bdp-price-range|price-summary|community-price|building-price)/i.test(testId);
        if (unitSpecific || !labeledCommunityPrice) continue;
      }
      const parsedPrice = parseRent(priceText);
      if (parsedPrice >= 100 && !/\b(?:application|admin|deposit|special|discount|savings|concession)\b/i.test(priceText)) {
        price = parsedPrice;
        break;
      }
    }

    // 3. Beds, Baths, Sqft detection
    let beds = null;
    let baths = null;
    let sqft = null;

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

    // 4. Photos from rendered DOM
    const photos = [];
    const imgEls = doc.querySelectorAll('img, picture source, source, video[poster], [style*="background-image"], [data-photo-url], [data-image-url]');
    imgEls.forEach(el => {
      const attributes = ['src', 'data-src', 'data-lazy-src', 'data-original', 'srcset', 'data-srcset', 'data-photo-url', 'data-image-url'];
      const candidates = [el.currentSrc, el.src];
      if (el.poster) candidates.push(el.poster);
      attributes.forEach(name => {
        const value = el.getAttribute(name);
        if (value) candidates.push(value);
      });
      if (el.attributes) {
        Array.from(el.attributes).forEach(attribute => {
          if (attribute && attribute.value) candidates.push(attribute.value);
        });
      }
      const style = el.getAttribute('style') || '';
      const backgroundMatch = style.match(/url\(['"]?(https?:\/\/[^'")]+)['"]?\)/i);
      if (backgroundMatch) candidates.push(backgroundMatch[1]);

      candidates.forEach(candidate => {
        if (!candidate || typeof candidate !== 'string') return;
        const urls = candidate.match(/https?:\/\/[^\s,'")]+/gi) || [];
        urls.forEach(rawUrl => {
          const src = rawUrl.replace(/&amp;/g, '&');
          if (!/^https?:\/\/(?:[^/]+\.)?zillowstatic\.com\/fp\//i.test(src)) return;
          if (!photos.includes(src)) photos.push(src);
        });
      });
    });

    // Keep the Zillow CDN photo variants deduplicated and prefer the highest
    // resolution URL when several gallery elements expose the same photo.
    const normalizedPhotos = dedupZillowPhotos(photos).map(src => {
      return src.replace(/_[a-z0-9]+\.jpg(?:\?.*)?$/i, '-uncropped_scaled_within_1536_1152.jpg');
    });

    // 5. Description
    let description = null;
    const descEl = doc.querySelector('[data-testid="description"], [class*="DescriptionWrapper"], .summary-container p');
    if (descEl && descEl.textContent) {
      description = descEl.textContent.trim().slice(0, 2000);
    }

    const zpidMatch = (url.match(/(\d+)_zpid/i) || url.match(/\/b\/([^/]+)/i) || [])[1];
    const buildingIdMatch = url.match(/\/apartments\/(?:[^/?#]+\/){1,2}([^/?#]+)\/?(?:[?#]|$)/i);
    const sourceId = zpidMatch || (buildingIdMatch && buildingIdMatch[1]) || String(Date.now());

    const rawDomDesc = (description || '') + ' ' + summaryText;
    const domMedia = collectDomMedia(doc);
    const domVirtualTour = domMedia.find(item => item.kind === 'virtual_tour' || item.kind === 'tour_3d');
    const harvestedDom = extractFeaturesFromNarrative(rawDomDesc);
    const { bathrooms: domBaths, half_bathrooms: domHalf } = parseBaths(baths, rawDomDesc);
    const domPropType = buildingPage ? 'APARTMENT' : detectPropType(null, rawDomDesc, headingText || address || '', address || '');
    const domTitle = buildingPage
      ? (headingText || (address ? [address, city, state, zip].filter(Boolean).join(', ') : null))
      : (headingText || buildTitle(beds, domPropType, city, address, null, state, zip));
    const buildingName = buildingPage && headingText &&
      headingText !== address &&
      !/^(?:property|property apartment unit|apartment unit)$/i.test(headingText.trim())
      ? headingText.trim()
      : null;
    const unitOptions = extractZillowUnitOptions(null, doc);

    return basePayload('zillow', sourceId, url, {
      title: domTitle,
      building_name: buildingName,
      is_multi_unit: buildingPage,
      price_range: null,
      address: address || (!buildingPage && price ? 'Zillow Property' : null),
      city: city || null,
      state: state || null,
      zip: zip || null,
      monthly_rent: buildingPage ? null : price,
      community_starting_rent: buildingPage ? price : null,
      bedrooms: buildingPage ? null : beds,
      bathrooms: buildingPage ? null : domBaths,
      half_bathrooms: buildingPage ? null : domHalf,
      total_bathrooms: buildingPage ? null : domBaths,
      square_footage: buildingPage ? null : sqft,
      year_built: yr,
      heating_type: heatingType || harvestedDom.heating_type || null,
      cooling_type: coolingType || harvestedDom.cooling_type || null,
      parking: parking || harvestedDom.parking || null,
      garage_spaces: harvestedDom.garage_spaces || null,
      lot_size_sqft: lotSizeSqft,
      pets_allowed: null,
      pet_types_allowed: null,
      property_type: domPropType,
      appliances: harvestedDom.appliances ? JSON.stringify(harvestedDom.appliances) : null,
      flooring: harvestedDom.flooring ? JSON.stringify(harvestedDom.flooring) : null,
      laundry_type: harvestedDom.laundry_type || null,
      amenities: harvestedDom.amenities ? JSON.stringify(harvestedDom.amenities) : null,
      has_basement: harvestedDom.has_basement ?? null,
      has_central_air: harvestedDom.has_central_air ?? null,
      description,
      original_description: description || null,
      virtual_tour_url: domVirtualTour ? domVirtualTour.url : null,
      media: domMedia,
      unit_options: unitOptions,
      original_image_urls: JSON.stringify(dedupZillowPhotos(normalizedPhotos).slice(0, 50)),
      _import: 'zillow-dom-deep-scanner'
    });
  }

  // ── Zillow Dispatcher (Tiers 1, 2, 3) ─────────────────────────
  function extractZillow(doc, url) {
    // Tier 1: NextData / gdpClientCache
    let res = extractZillowNextData(doc, url);
    const resPhotos = res ? (JSON.parse(res.original_image_urls || '[]')) : [];

    // Tier 2: Live DOM Scraper (accurate for client-side rendered listings)
    const dom = extractZillowFromDom(doc, url);
    const domPhotos = dom ? (JSON.parse(dom.original_image_urls || '[]')) : [];

    // Tier 3: JSON-LD (filtered)
    let ld = null;
    try {
      ld = extractFromJsonLd(doc, url, 'zillow');
    } catch (error) {
      console.warn('[CP] Zillow JSON-LD fallback failed:', error && error.name || 'Error');
    }
    const ldPhotos = ld ? (JSON.parse(ld.original_image_urls || '[]')) : [];

    // Prefer NextData > DOM > JSON-LD, but don't let empty NextData fields
    // erase values that are present in the rendered building page.
    let merged = basePayload('zillow', null, url);
    [ld, dom, res].forEach(source => {
      if (!source) return;
      Object.keys(source).forEach(key => {
        const value = source[key];
        if (value !== null && value !== undefined && value !== '' && value !== '[]') merged[key] = value;
      });
    });
    // Ensure best photo collection is kept
    const bestPhotos = [resPhotos, domPhotos, ldPhotos].sort((a, b) => b.length - a.length)[0] || [];
    if (bestPhotos.length > 0) {
      merged.original_image_urls = JSON.stringify(bestPhotos.slice(0, 50));
    }

    merged.media = mergeStructuredMedia(res && res.media, dom && dom.media, ld && ld.media);
    const unitOptions = mergeZillowUnitOptions(dom && dom.unit_options, res && res.unit_options);
    const rentBasis = getZillowRentBasis(doc);
    merged.rent_basis = rentBasis;
    merged.unit_options = unitOptions.map(option => Object.assign({}, option, { rent_basis: rentBasis }));
    if (isZillowBuildingPage(url, null, doc && doc.body && doc.body.innerText)) {
      merged.is_multi_unit = true;
      merged.building_name = merged.building_name || (dom && dom.building_name) || (res && res.building_name) || null;
      if ((!merged.title || /^(?:property apartment unit|property apartment|apartment unit)$/i.test(merged.title)) &&
          merged.address) {
        merged.title = [merged.address, merged.city, merged.state, merged.zip].filter(Boolean).join(', ');
      } else if ((!merged.title || /^(?:property apartment unit|property apartment|apartment unit)$/i.test(merged.title)) &&
          merged.building_name) {
        merged.title = merged.building_name;
      }
    }
    if (!merged.address && !merged.monthly_rent && !hasUsefulZillowCommunityData(merged)) return null;

    if (isZillowBuildingPage(url, null, doc && doc.body && doc.body.innerText)) {
      merged.property_type = 'APARTMENT';
      merged.monthly_rent = null;
      merged.bedrooms = null;
      merged.bathrooms = null;
      merged.half_bathrooms = null;
      merged.total_bathrooms = null;
      merged.square_footage = null;
    }
    if (!merged.virtual_tour_url) {
      const tour = merged.media.find(item => item.kind === 'virtual_tour' || item.kind === 'tour_3d');
      if (tour) merged.virtual_tour_url = tour.url;
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

    const rTitle = (prop.title && String(prop.title).trim()) || buildTitle(beds, propType, city, street, null, state, zip);

    const virtualTourUrl = prop.virtual_tour_url || prop.tour3d_url || (Array.isArray(prop.virtual_tours) && prop.virtual_tours[0] && (prop.virtual_tours[0].href || prop.virtual_tours[0].url)) || null;
    const rUnitOptions = extractZillowUnitOptions(prop, doc, nd);
    const rIsMultiUnit = rUnitOptions.length > 0 || Boolean(prop.is_multi_unit || prop.community_name);
    const rBuildingName = prop.building_name || prop.community_name || null;
    const rRent = parseRent(prop.price || prop.list_price, null);
    const rMedia = mergeStructuredMedia(collectStructuredMedia(prop, virtualTourUrl), collectDomMedia(doc));
    rUnitOptions.forEach(u => {
      if (u.floor_plan_image_url) {
        rMedia.push({
          kind: 'floor_plan',
          title: u.floor_plan_name ? `${u.floor_plan_name} Floor Plan` : 'Floor plan',
          floor_label: u.floor_label || null,
          building_name: u.building_name || null,
          unit_number: u.unit_number || null,
          provider: null,
          url: u.floor_plan_image_url,
          poster_url: null,
          display_order: rMedia.length,
          metadata: {},
        });
      }
    });

    return basePayload('realtor', String(prop.property_id || prop.rdc_web_url || ''), url, {
      title: rTitle,
      address: street, city, state, zip, lat, lng,
      monthly_rent: rIsMultiUnit && beds == null ? null : rRent,
      community_starting_rent: rIsMultiUnit ? rRent : null,
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      floors: safeI(prop.stories || prop.floors),
      total_units: safeI(prop.units_count || prop.total_units || prop.unit_count),
      building_name: rBuildingName ? String(rBuildingName).trim() : null,
      is_multi_unit: rIsMultiUnit ? true : null,
      price_range: formatZillowPriceRange(prop.price_range || prop.rent_range),
      property_type: propType,
      description: prop.description || prop.text || null,
      original_description: prop.description || prop.text || null,
      neighborhood: prop.neighborhood_name || null,
      county: prop.county || null,
      available_date: parseDate(prop.available_date || prop.date_available),
      virtual_tour_url: virtualTourUrl || (rMedia.find(m => m.kind === 'virtual_tour' || m.kind === 'tour_3d')?.url || null),
      media: mergeStructuredMedia(rMedia),
      unit_options: rUnitOptions,
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
    const aptTitle = (prop.name && String(prop.name).trim()) || (prop.title && String(prop.title).trim()) || buildTitle(beds, 'APARTMENT', city, street, null, state, zip);
    const aptUnitOptions = extractZillowUnitOptions(prop, doc, nd);
    const aptIsMultiUnit = aptUnitOptions.length > 0 || Boolean(prop.isMultiUnit || prop.models?.length || prop.rentals?.length);
    const aptBuildingName = (prop.name && String(prop.name).trim() && prop.name !== street)
      ? String(prop.name).trim()
      : (prop.buildingName ? String(prop.buildingName).trim() : null);
    const aptRent = parseRent(prop.price || prop.minPrice, null);
    const aptTourUrl = prop.virtualTourUrl || prop.matterportUrl || prop.tour3d || null;
    const aptMedia = mergeStructuredMedia(collectStructuredMedia(prop, aptTourUrl), collectDomMedia(doc));
    aptUnitOptions.forEach(u => {
      if (u.floor_plan_image_url) {
        aptMedia.push({
          kind: 'floor_plan',
          title: u.floor_plan_name ? `${u.floor_plan_name} Floor Plan` : 'Floor plan',
          floor_label: u.floor_label || null,
          building_name: u.building_name || null,
          unit_number: u.unit_number || null,
          provider: null,
          url: u.floor_plan_image_url,
          poster_url: null,
          display_order: aptMedia.length,
          metadata: {},
        });
      }
    });
    const dedupedAptMedia = mergeStructuredMedia(aptMedia);

    return basePayload('apartments', String(prop.id || ''), url, {
      title: aptTitle,
      address: street, city, state, zip, lat, lng,
      monthly_rent: aptIsMultiUnit && beds == null ? null : aptRent,
      community_starting_rent: aptIsMultiUnit ? aptRent : null,
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      floors: safeI(prop.stories || prop.floors || prop.numberOfStories),
      total_units: safeI(prop.unitCount || prop.totalUnits || prop.numberOfUnits),
      building_name: aptBuildingName,
      is_multi_unit: aptIsMultiUnit ? true : null,
      price_range: formatZillowPriceRange(prop.priceRange || prop.rentRange),
      property_type: 'APARTMENT',
      description: prop.description || null,
      original_description: prop.description || null,
      neighborhood: prop.neighborhood || null,
      pets_allowed: prop.petsAllowed != null ? !!prop.petsAllowed : null,
      available_date: parseDate(prop.availableDate || prop.availabilityDate),
      virtual_tour_url: aptTourUrl || (dedupedAptMedia.find(m => m.kind === 'virtual_tour' || m.kind === 'tour_3d')?.url || null),
      media: dedupedAptMedia,
      unit_options: aptUnitOptions,
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
    const rfTitle = (prop.title && String(prop.title).trim()) || buildTitle(beds, propType, city, street, null, state, zip);

    return basePayload('redfin', String(prop.propertyId || prop.id || ''), url, {
      title: rfTitle,
      address: street, city, state, zip, lat, lng,
      monthly_rent: parseRent(prop.price || prop.rent, null),
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft ? parseInt(String(sqft), 10) : null,
      year_built: yr ? parseInt(String(yr), 10) : null,
      property_type: propType,
      description: prop.description || null,
      original_description: prop.description || null,
      neighborhood: prop.neighborhood || null,
      available_date: parseDate(prop.availableDate || prop.dateAvailable),
      virtual_tour_url: prop.virtualTourUrl || prop.matterportUrl || prop.tour3d || null,
      media: collectStructuredMedia(prop, prop.virtualTourUrl || prop.matterportUrl || prop.tour3d || null),
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

    // Prefer listing-owned hydrated and gallery photos. A full-document
    // script scan can include recommendation assets and make every listing
    // appear to have the artificial 50-photo cap.
    if (dom && dom.original_image_urls) {
      try {
        const domUrls = JSON.parse(dom.original_image_urls);
        if (Array.isArray(domUrls)) domUrls.forEach(addPhoto);
      } catch (_) {}
    }
    if (photos.length === 0) {
      extractPhotosFromHtmlScripts(doc).forEach(addPhoto);
    }

    const rent = parseRent(prop.price || prop.listPrice || prop.estimatedRent || prop.rent, null) || (dom ? dom.monthly_rent : null);
    const sourceId = String(prop.id || prop.listingId || prop.homeId || idFromUrl);

    const odTitle = (prop.title && String(prop.title).trim()) || buildTitle(beds, propType, city, street, null, state, zip);

    const virtualTourUrl = prop.virtualTourUrl || prop.matterportUrl || prop.tour3d || (dom ? dom.virtual_tour_url : null) || null;

    return basePayload('opendoor', sourceId, url, {
      title: odTitle,
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
      virtual_tour_url: virtualTourUrl,
      media: collectStructuredMedia(prop, virtualTourUrl),
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

    // Only use page-wide script URLs when the rendered gallery has not
    // exposed any images yet. This prevents unrelated assets from inflating
    // the displayed count to 50.
    if (photos.length === 0) {
      extractPhotosFromHtmlScripts(doc).forEach(addPhoto);
    }

    const validPhotos = photos.filter(u => {
      return !/logo|icon|avatar|favicon|badge|app-store|google-play|map/i.test(u);
    });

    const propType = detectPropType(null, rawDesc, street);
    const domMedia = collectDomMedia(doc);
    const domVirtualTour = domMedia.find(item => item.kind === 'virtual_tour' || item.kind === 'tour_3d');

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
      virtual_tour_url: domVirtualTour ? domVirtualTour.url : null,
      media: domMedia,
      original_image_urls: JSON.stringify(validPhotos.slice(0, 50)),
      _import: 'opendoor-dom-deep-scanner'
    });
  }

  // ── Progress Residential ─────────────────────────────────────
  function extractProgressResidential(doc, url) {
    const idFromUrl = (url.match(/\/([a-z0-9_-]+)\/?(?:[?#].*)?$/i) || [])[1] || 'pr_' + Date.now();

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
      // AEM state can contain listing facts before its image array is
      // hydrated. Supplement it with the rendered gallery.
      const dom = extractProgressResidentialDom(doc, url);
      if (dom && dom.original_image_urls) {
        try {
          const domPhotos = JSON.parse(dom.original_image_urls);
          if (Array.isArray(domPhotos)) domPhotos.forEach(addPhoto);
        } catch (_) {}
      }

      const prTitle = (prop.title && String(prop.title).trim()) || buildTitle(beds, 'SINGLE_FAMILY', city, street, null, state, zip);

      return basePayload('progress_residential', String(prop.id || prop.propertyId || idFromUrl), url, {
        title: prTitle,
        address: street, city, state, zip,
        monthly_rent: rent,
        bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
        square_footage: sqft ? parseInt(String(sqft), 10) : null,
        year_built: yr ? parseInt(String(yr), 10) : null,
        property_type: 'SINGLE_FAMILY',
        description: prop.description || prop.overview || null,
        original_description: prop.description || prop.overview || null,
        pets_allowed: true,
        available_date: parseDate(prop.availableDate || prop.readyDate),
        virtual_tour_url: prop.virtualTourUrl || prop.matterportUrl || (dom ? dom.virtual_tour_url : null) || null,
        media: collectStructuredMedia(prop, prop.virtualTourUrl || prop.matterportUrl || (dom ? dom.virtual_tour_url : null) || null),
        original_image_urls: JSON.stringify(photos.slice(0, 50)),
      });
    }

    // 3. DOM Fallback for Progress Residential
    const dom = extractProgressResidentialDom(doc, url);
    if (ld && ld.address) {
      // The AEM detail page exposes the complete gallery and exact half-bath
      // count in rendered HTML, while JSON-LD usually has the rent and geo.
      // Merge both instead of returning the first partial representation.
      const ldPhotos = (() => {
        try { return JSON.parse(ld.original_image_urls || '[]'); } catch (_) { return []; }
      })();
      const domPhotos = (() => {
        try { return JSON.parse((dom && dom.original_image_urls) || '[]'); } catch (_) { return []; }
      })();
      const mergedMedia = mergeStructuredMedia(dom && dom.media, ld.media);
      const mergedTour = mergedMedia.find(item => item.kind === 'virtual_tour' || item.kind === 'tour_3d');
      return basePayload('progress_residential', String(
        (doc && doc.querySelector && doc.querySelector('[data-property-node-path]') &&
          doc.querySelector('[data-property-node-path]').getAttribute('data-property-node-path')) ||
        ld.source_listing_id || idFromUrl
      ), url, Object.assign({}, ld, dom || {}, {
        source: 'progress_residential',
        source_listing_id: String(
          (doc && doc.querySelector && doc.querySelector('[data-property-node-path]') &&
            doc.querySelector('[data-property-node-path]').getAttribute('data-property-node-path')) ||
          ld.source_listing_id || idFromUrl
        ),
        source_url: url,
        monthly_rent: (ld.monthly_rent != null ? ld.monthly_rent : (dom && dom.monthly_rent)),
        lat: ld.lat != null ? ld.lat : (dom && dom.lat),
        lng: ld.lng != null ? ld.lng : (dom && dom.lng),
        virtual_tour_url: (dom && dom.virtual_tour_url) || ld.virtual_tour_url || (mergedTour && mergedTour.url) || null,
        media: mergedMedia,
        original_image_urls: JSON.stringify([...new Set(domPhotos.concat(ldPhotos))].slice(0, 50)),
      }));
    }
    return dom;
  }

  function extractProgressResidentialDom(doc, url) {
    if (!doc || typeof doc.querySelector !== 'function') return null;
    const idFromUrl = (url.match(/\/([a-z0-9_-]+)\/?(?:[?#].*)?$/i) || [])[1] || 'pr_' + Date.now();

    const headingEl = doc.querySelector('.property-details-page-container h1, .property-details-page h1, .property-details-header h1, h1.property-title, .pdp-address, .property-info .address h1, h1');
    const fullHeading = headingEl ? headingEl.textContent.replace(/\s+/g, ' ').trim() : '';
    const m = fullHeading.match(/^([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/i);
    const street = m ? m[1].trim() : fullHeading;
    const city   = m ? m[2].trim() : '';
    const state  = m ? m[3].trim().toUpperCase() : '';
    const zip    = m && m[4] ? m[4].trim() : '';

    const rentEl = doc.querySelector('.property-price, .market-rent, .price-display, [data-testid="rent-price"], .estimated-cost, [class*="rent"], [class*="price"], img[alt*="/Mo"], img[alt*="/mo"]');
    const rent = rentEl
      ? parseRent(rentEl.textContent || rentEl.getAttribute('alt') || '', null)
      : null;

    let beds = null, baths = null, sqft = null;
    const pageText = doc.body && doc.body.innerText ? doc.body.innerText.replace(/\s+/g, ' ') : '';
    const pageBeds = pageText.match(/(\d+)\s*(?:bed|beds|bedroom|bedrooms)\b/i);
    const pageBaths = pageText.match(/(\d+(?:\.\d+)?)\s*(?:bath|baths|bathroom|bathrooms)\b/i);
    const pageSqft = pageText.match(/([\d,]+)\s*(?:sq\.?\s*ft|square\s*feet)\b/i);
    if (pageBeds) beds = parseInt(pageBeds[1], 10);
    if (pageBaths) baths = parseFloat(pageBaths[1]);
    if (pageSqft) sqft = parseInt(pageSqft[1].replace(/,/g, ''), 10);
    const specItems = doc.querySelectorAll('.spec-item, .property-amenity, .badge-detail, .property-meta-item, .key-features-and-services-icons__list-item, li');
    specItems.forEach(item => {
      const t = item.textContent.toLowerCase();
      if (t.includes('bed') && !beds) beds = safeI(t);
      if (t.includes('bath') && !baths) {
        const bm = t.match(/([\d.]+)\s*ba/i);
        if (bm) baths = parseFloat(bm[1]);
      }
      if (t.includes('sq') || t.includes('sqft')) sqft = safeI(t);
    });

    const descEl = doc.querySelector('.property-description, .property-overview, #description, .container-dynamic-info-desc-property, .dynamic-info-desc-property');
    const rawDesc = descEl ? descEl.textContent.replace(/\s+/g, ' ').trim() : '';
    const { bathrooms: bathVal, half_bathrooms: bathH } = parseBaths(baths, rawDesc);

    const photos = [];
    const imgs = doc.querySelectorAll('.property-details-page-container img, .gallery-slider img, .property-photos img, .swiper-slide img, img[data-image-ordinal], img[src*="photos.rentprogress.com"], img[src*="rentprogress"], img.testimonial-image, picture source[srcset]');
    imgs.forEach(img => {
      const raw = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') ||
        img.getAttribute('srcset') || '';
      const candidates = raw.split(',').map(s => s.trim().split(/\s+/)[0]);
      candidates.forEach(src => {
        if (/^https?:\/\/photos\.rentprogress\.com\//i.test(src) && !photos.includes(src)) photos.push(src);
      });
    });

    const prDomTitle = buildTitle(beds, 'SINGLE_FAMILY', city, street, fullHeading, state, zip);

    return basePayload('progress_residential', idFromUrl, url, {
      title: prDomTitle,
      address: street, city, state, zip,
      monthly_rent: rent,
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft,
      property_type: 'SINGLE_FAMILY',
      description: rawDesc || null,
      original_description: rawDesc || null,
      pets_allowed: true,
      original_image_urls: JSON.stringify(photos.slice(0, 50)),
    });
  }

  // ── Invitation Homes ──────────────────────────────────────────
  // Invitation Homes is a Svelte application. Listing pages expose JSON-LD
  // inconsistently, so use it when present and supplement it with the
  // server-rendered address/spec/photo elements.
  function extractInvitationHomes(doc, url) {
    const routeMatch = url.match(/\/(?:property|homes-for-rent|houses-for-rent)\/([^?#]+)/i);
    const routeParts = routeMatch && routeMatch[1]
      ? routeMatch[1].split('/').filter(Boolean)
      : [];
    const idFromUrl = routeParts.length ? routeParts[routeParts.length - 1] :
      (url.match(/\/([^/?#]+)\/?$/i) || [])[1] || 'invh_' + Date.now();
    const ld = extractFromJsonLd(doc, url, 'invitation_homes');
    if (!doc || typeof doc.querySelector !== 'function') return ld;

    const textOf = (selector) => {
      const el = doc.querySelector(selector);
      return el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    };
    const meta = (selector) => {
      const el = doc.querySelector(selector);
      return el && el.getAttribute ? (el.getAttribute('content') || '').trim() : '';
    };
    const titleText = textOf('h1, [data-testid*="address"], [data-testid*="property-title"]') ||
      meta('meta[property="og:title"]') || doc.title || '';
    const addressMatch = titleText.match(/^([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/i);
    const street = addressMatch ? addressMatch[1].trim() : titleText;
    const city = addressMatch ? addressMatch[2].trim() : '';
    const state = addressMatch ? addressMatch[3].toUpperCase() : '';
    const zip = addressMatch && addressMatch[4] ? addressMatch[4] : '';
    const bodyText = doc.body && doc.body.innerText ? doc.body.innerText.replace(/\s+/g, ' ') : '';
    const rentMatch = bodyText.match(/\$[\s]*([\d,]+(?:\.\d{1,2})?)(?:\s*\/\s*(?:mo|month)|\s*per\s+month)?/i);
    const bedsMatch = bodyText.match(/(\d+)\s*(?:bed|beds|bedroom|bedrooms)\b/i);
    const bathsMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*(?:bath|baths|bathroom|bathrooms)\b/i);
    const sqftMatch = bodyText.match(/([\d,]+)\s*(?:sq\.?\s*ft|square\s*feet)\b/i);
    const description = textOf('[data-testid*="description"], [class*="description"], [class*="Description"]') ||
      meta('meta[name="description"]') || null;
    const photos = [];
    const addPhoto = (raw) => {
      String(raw || '').split(',').map(s => s.trim().split(/\s+/)[0]).forEach(src => {
        if (/^https?:\/\//i.test(src) && !/logo|icon|favicon|avatar|map/i.test(src) && !photos.includes(src)) photos.push(src);
      });
    };
    doc.querySelectorAll('img, picture source').forEach(el => {
      addPhoto(el.src || el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('srcset'));
    });
    const ldPhotos = (() => {
      try { return JSON.parse((ld && ld.original_image_urls) || '[]'); } catch (_) { return []; }
    })();
    const rawDesc = description || (ld && ld.description) || '';
    const propType = detectPropType(null, rawDesc, titleText);
    const domMedia = collectDomMedia(doc);
    const mergedMedia = mergeStructuredMedia(domMedia, ld && ld.media);
    const mergedTour = mergedMedia.find(item => item.kind === 'virtual_tour' || item.kind === 'tour_3d');
    return basePayload('invitation_homes', String(
      (ld && ld.source_listing_id) || idFromUrl
    ), url, Object.assign({}, ld || {}, {
      source: 'invitation_homes',
      source_listing_id: String((ld && ld.source_listing_id) || idFromUrl),
      source_url: url,
      title: (ld && ld.title) || buildTitle(bedsMatch && Number(bedsMatch[1]), propType, city, street),
      address: (ld && ld.address) || street || null,
      city: (ld && ld.city) || city || null,
      state: (ld && ld.state) || state || null,
      zip: (ld && ld.zip) || zip || null,
      monthly_rent: ld && ld.monthly_rent != null ? ld.monthly_rent : (rentMatch ? parseRent(rentMatch[1], null) : null),
      bedrooms: ld && ld.bedrooms != null ? ld.bedrooms : (bedsMatch ? Number(bedsMatch[1]) : null),
      bathrooms: ld && ld.bathrooms != null ? ld.bathrooms : (bathsMatch ? parseBaths(Number(bathsMatch[1]), rawDesc).bathrooms : null),
      half_bathrooms: ld && ld.half_bathrooms != null ? ld.half_bathrooms : (bathsMatch && Number(bathsMatch[1]) % 1 !== 0 ? 1 : null),
      square_footage: ld && ld.square_footage != null ? ld.square_footage : (sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ''), 10) : null),
      property_type: (ld && ld.property_type) || propType,
      description: (ld && ld.description) || description,
      virtual_tour_url: (ld && ld.virtual_tour_url) || (mergedTour && mergedTour.url) || null,
      media: mergedMedia,
      original_image_urls: JSON.stringify([...new Set(photos.concat(ldPhotos))].slice(0, 50)),
      pets_allowed: ld && ld.pets_allowed != null ? ld.pets_allowed : /pet friendly|pets allowed|dogs? allowed|cats? allowed/i.test(bodyText) ? true : null,
    }));
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

    const cjTitle = (doc && doc.querySelector && doc.querySelector('.listing-title, .property-title, h1, .rental-title')?.textContent?.trim()) || buildTitle(beds, propType, city, street, fullTitle, state, zip);
    const domMedia = collectDomMedia(doc);
    const domVirtualTour = domMedia.find(item => item.kind === 'virtual_tour' || item.kind === 'tour_3d');

    return basePayload('cj_real_estate', idFromUrl, url, {
      title: cjTitle,
      address: street, city, state, zip,
      monthly_rent: rent,
      bedrooms: beds, bathrooms: bathVal, half_bathrooms: bathH,
      square_footage: sqft,
      property_type: propType,
      description: rawDesc || null,
      original_description: rawDesc || null,
      pets_allowed: true,
      virtual_tour_url: domVirtualTour ? domVirtualTour.url : null,
      media: domMedia,
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
      // Zillow multi-unit building pages commonly use /apartments/{slug}/{id}
      // and do not always include a `_zpid` suffix.
      match: /zillow\.com\/apartments\/[^/?#]+\/[^/?#]+(?:\/|$)/i,
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
      match: /(cjrealestate\.com|cjproperties\.org|appfolio\.com)\/[^/]+/i,
      fn: extractCJRealEstate
    },
    {
      id: 'invitation_homes',
      match: /invitationhomes\.com\/(?:property|homes-for-rent|houses-for-rent)\/[^/?#]+/i,
      fn: extractInvitationHomes
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
    if (/cjproperties\.org|cjrealestate\.com|appfolio\.com/i.test(url)) {
      return { id: 'cj_real_estate', match: /cjproperties|cjrealestate|appfolio/i, fn: extractCJRealEstate };
    }
    if (/invitationhomes\.com\/(?:property|homes-for-rent|houses-for-rent)\/[^/?#]+/i.test(url)) {
      return { id: 'invitation_homes', match: /invitationhomes/i, fn: extractInvitationHomes };
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
      if (res && (res.address || hasUsefulZillowCommunityData(res))) return res;
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

  function diagnose(url, doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return { status: 'failed', reason: 'document_unavailable' };

    const detected = detect(url);
    let pageSource = detected && detected.id || null;
    if (!pageSource) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (host === 'zillow.com' || host.endsWith('.zillow.com')) pageSource = 'zillow';
        else if (host === 'realtor.com' || host.endsWith('.realtor.com')) pageSource = 'realtor';
        else if (host === 'apartments.com' || host.endsWith('.apartments.com')) pageSource = 'apartments';
        else if (host === 'redfin.com' || host.endsWith('.redfin.com')) pageSource = 'redfin';
        else if (host === 'opendoor.com' || host.endsWith('.opendoor.com')) pageSource = 'opendoor';
        else if (host === 'rentprogress.com' || host.endsWith('.rentprogress.com')) pageSource = 'progress_residential';
        else if (host.includes('cjproperties.org') || host.includes('cjrealestate.com') || host.endsWith('.appfolio.com') || host === 'appfolio.com') pageSource = 'cj_real_estate';
        else if (host === 'invitationhomes.com' || host.endsWith('.invitationhomes.com')) pageSource = 'invitation_homes';
      } catch (_) {}
    }
    let directStatus = 'not_run';
    let directError = null;
    let directResult = null;
    const safeErrorFrames = (error) => {
      const stack = error && typeof error.stack === 'string' ? error.stack : '';
      return stack.split(/\r?\n/).slice(0, 20).flatMap((line) => {
        const location = line.match(/(?:^|\/)(shared-extractors|live-shared-extractors|content|live-content)\.js:(\d+):(\d+)/);
        if (!location) return [];
        const functionMatch = line.match(/^\s*at\s+([A-Za-z_$][\w$<>.]*)\s+\(/) ||
          line.match(/^([A-Za-z_$][\w$<>.]*)@/);
        return [{
          file: location[1] + '.js',
          line: Math.min(Number(location[2]), 10_000_000),
          column: Math.min(Number(location[3]), 10_000_000),
          function: functionMatch ? functionMatch[1].slice(0, 100) : null,
        }];
      }).slice(0, 8);
    };
    if (detected) {
      try {
        directResult = detected.fn(d, url);
        directStatus = directResult ? 'returned_data' : 'returned_empty';
      } catch (error) {
        directStatus = 'threw';
        const errorName = String(error && error.name || 'Error');
        const errorMessage = error && error.message;
        directError = {
          name: /^(?:Error|TypeError|SyntaxError|RangeError|ReferenceError|URIError|AggregateError|DOMException)$/.test(errorName)
            ? errorName
            : 'Error',
          message_length: typeof errorMessage === 'string' ? errorMessage.length : 0,
          stack_frames: safeErrorFrames(error),
        };
      }
    }

    let extracted = null;
    let fallbackResult = null;
    if (d.querySelectorAll) {
      try { fallbackResult = extractFromJsonLd(d, url, detected && detected.id); } catch (_) {}
    }
    try { extracted = extract(url, d); } catch (_) {}

    const safeFields = [
      'source_listing_id', 'title', 'address', 'city', 'state', 'zip',
      'property_type', 'building_name', 'is_multi_unit', 'price_range', 'rent_basis', 'monthly_rent', 'community_starting_rent',
      'bedrooms', 'bathrooms', 'half_bathrooms', 'square_footage',
      'year_built', 'lot_size_sqft', 'floors', 'total_units',
      'heating_type', 'cooling_type', 'has_central_air', 'has_basement',
      'garage_spaces', 'appliances', 'flooring', 'parking',
      'utilities_included', 'laundry_type',
    ];
    const facts = {};
    if (extracted) {
      safeFields.forEach((key) => {
        const value = extracted[key];
        if (value == null || typeof value === 'function') return;
        if (typeof value === 'string') facts[key] = value.slice(0, 500);
        else if (typeof value === 'number' || typeof value === 'boolean') facts[key] = value;
        else if (Array.isArray(value)) {
          facts[key] = value.slice(0, 100).map((item) =>
            typeof item === 'string' ? item.slice(0, 160) : item
          );
        }
      });
    }

    const unitOptions = extracted && Array.isArray(extracted.unit_options)
      ? extracted.unit_options.slice(0, 100).map((unit) => ({
        source_kind: unit.source_kind || null,
        unit_number: unit.unit_number == null ? null : String(unit.unit_number).slice(0, 40),
        floor_plan_name: unit.floor_plan_name == null ? null : String(unit.floor_plan_name).slice(0, 80),
        building_name: unit.building_name == null ? null : String(unit.building_name).slice(0, 80),
        floor_label: unit.floor_label == null ? null : String(unit.floor_label).slice(0, 60),
        bedrooms: unit.bedrooms ?? null,
        bathrooms: unit.bathrooms ?? null,
        half_bathrooms: unit.half_bathrooms ?? null,
        square_footage: unit.square_footage ?? null,
        monthly_rent: unit.monthly_rent ?? null,
        starting_rent: unit.starting_rent ?? null,
        rent_basis: unit.rent_basis ?? extracted.rent_basis ?? null,
        source_order: unit.source_order ?? null,
      }))
      : [];

    const mediaKinds = {};
    const mediaDetails = [];
    (extracted && Array.isArray(extracted.media) ? extracted.media : []).forEach((item) => {
      const kind = String(item && item.kind || 'unknown').slice(0, 40);
      mediaKinds[kind] = (mediaKinds[kind] || 0) + 1;
      if (mediaDetails.length < 50) {
        let urlHost = null;
        try { urlHost = item && item.url ? new URL(item.url).hostname.slice(0, 100) : null; } catch (_) {}
        mediaDetails.push({
          kind,
          title: item && item.title ? String(item.title).slice(0, 120) : null,
          provider: item && item.provider ? String(item.provider).slice(0, 80) : null,
          floor_label: item && item.floor_label ? String(item.floor_label).slice(0, 80) : null,
          building_name: item && item.building_name ? String(item.building_name).slice(0, 80) : null,
          unit_number: item && item.unit_number ? String(item.unit_number).slice(0, 40) : null,
          display_order: Number.isInteger(item && item.display_order) ? item.display_order : null,
          url_host: urlHost,
          has_url: Boolean(item && item.url),
          has_poster: Boolean(item && item.poster_url),
        });
      }
    });
    let photoCount = 0;
    const photoHosts = {};
    try {
      const rawPhotos = extracted && extracted.original_image_urls;
      const parsedPhotos = typeof rawPhotos === 'string' ? JSON.parse(rawPhotos) : rawPhotos;
      if (Array.isArray(parsedPhotos)) photoCount = parsedPhotos.length;
      else if (Array.isArray(extracted && extracted.photo_urls)) photoCount = extracted.photo_urls.length;
      (Array.isArray(parsedPhotos) ? parsedPhotos : Array.isArray(extracted && extracted.photo_urls) ? extracted.photo_urls : [])
        .slice(0, 100)
        .forEach((photo) => {
          try {
            const host = new URL(typeof photo === 'string' ? photo : photo && photo.url).hostname.slice(0, 100);
            photoHosts[host] = (photoHosts[host] || 0) + 1;
          } catch (_) {}
        });
    } catch (_) {}

    const structure = [];
    let structureNodes = 0;
    const addShape = (value, path, depth) => {
      if (structure.length >= 100 || structureNodes >= 250 || depth > 8) return;
      structureNodes += 1;
      if (Array.isArray(value)) {
        structure.push({ path, type: 'array', length: value.length });
        value.slice(0, 2).forEach((item, index) => addShape(item, path + '[' + index + ']', depth + 1));
      } else if (value && typeof value === 'object') {
        const keys = Object.keys(value).filter((key) => /^[A-Za-z0-9_$.-]{1,60}$/.test(key)).slice(0, 30);
        structure.push({ path, type: 'object', key_count: Object.keys(value).length });
        keys.forEach((key) => addShape(value[key], path ? path + '.' + key : key, depth + 1));
      } else {
        structure.push({
          path,
          type: value === null ? 'null' : typeof value,
          ...(typeof value === 'string' ? { length: value.length } : {}),
        });
        if (typeof value === 'string' && value.length <= 2_000_000 &&
            /(?:gdpClientCache|reactServerState|initialData|dehydratedState|apolloState)/i.test(path)) {
          try { addShape(JSON.parse(value), path + '.__parsed', depth + 1); } catch (_) {}
        }
      }
    };
    let nextDataStatus = 'missing';
    if (d.getElementById) {
      const script = d.getElementById('__NEXT_DATA__');
      if (script) {
        const raw = String(script.textContent || '');
        nextDataStatus = raw.length > 2_000_000 ? 'too_large' : 'invalid';
        if (raw.length <= 2_000_000) {
          try {
            addShape(JSON.parse(raw), '', 0);
            nextDataStatus = 'parsed';
          } catch (_) {}
        }
      }
      if (d.querySelectorAll) {
        const jsonLdScripts = Array.from(d.querySelectorAll('script[type="application/ld+json"]')).slice(0, 10);
        jsonLdScripts.forEach((script, index) => {
          if (structure.length >= 100) return;
          const raw = String(script.textContent || '');
          if (raw.length > 200_000) {
            structure.push({ path: 'json_ld[' + index + ']', type: 'too_large', length: raw.length });
            return;
          }
          try {
            addShape(JSON.parse(raw), 'json_ld[' + index + ']', 0);
          } catch (_) {
            structure.push({ path: 'json_ld[' + index + ']', type: 'invalid_json' });
          }
        });
      }
    }

    const countSelector = (selector) => {
      try { return d.querySelectorAll ? d.querySelectorAll(selector).length : 0; } catch (_) { return 0; }
    };
    const countFloorPlanCandidates = () => {
      try {
        if (!d.querySelectorAll) return 0;
        return Array.from(d.querySelectorAll('div, li, article, [role="listitem"]'))
          .slice(0, 1000)
          .filter((element) => {
            const text = String(element.innerText || element.textContent || '');
            return text.length <= 2000 &&
              /(?:\bstudio\b|\b\d+(?:\.\d+)?\s*(?:bd|beds?|bedrooms?)\b)/i.test(text) &&
              (/\b\d+(?:\.\d+)?\s*(?:ba|baths?|bathrooms?)\b/i.test(text) ||
                /\b[\d,]+\s*(?:sqft|sq\s*ft|square\s*feet)\b/i.test(text));
          }).length;
      } catch (_) {
        return 0;
      }
    };
    const scriptSignals = d.querySelectorAll
      ? Array.from(d.querySelectorAll('script')).slice(0, 40).map((script) => {
        let sourceHost = null;
        try {
          const source = script.getAttribute && script.getAttribute('src');
          sourceHost = source ? new URL(source, url).hostname.slice(0, 100) : null;
        } catch (_) {}
        return {
          id: script.id && /^[A-Za-z0-9_.:-]{1,80}$/.test(script.id) ? script.id : null,
          type: script.getAttribute && /^[A-Za-z0-9_+./-]{1,80}$/.test(script.getAttribute('type') || '')
            ? script.getAttribute('type')
            : null,
          source_host: sourceHost,
          content_length: String(script.textContent || '').length,
        };
      })
      : [];
    let cleanUrl = '';
    try {
      const parsedUrl = new URL(url);
      cleanUrl = parsedUrl.origin + parsedUrl.pathname;
    } catch (_) {}

    return {
      schema_version: 1,
      status: extracted ? 'success' : 'failed',
      reason: extracted
        ? null
        : (!detected ? 'unsupported_url' : (directStatus === 'threw' ? 'extractor_exception' : 'no_listing_data')),
      source: pageSource,
      source_url: cleanUrl,
      page: {
        title: String(d.title || '').slice(0, 300),
        body_text_length: d.body && typeof d.body.innerText === 'string' ? d.body.innerText.length : 0,
        next_data: nextDataStatus,
        script_signals: scriptSignals,
        json_ld_script_count: countSelector('script[type="application/ld+json"]'),
        script_count: countSelector('script'),
        image_count: countSelector('img'),
        video_count: countSelector('video'),
        iframe_count: countSelector('iframe'),
        unit_element_count: countSelector('[data-testid*="unit"], [data-test*="unit"], tr, [role="row"]'),
        floor_plan_element_count: countSelector('[data-testid*="floorplan"], [data-testid*="floor-plan"], [data-test*="floorplan"], [data-test*="floor-plan"], [class*="floorplan"], [class*="floorPlan"], [class*="floor-plan"]'),
        floor_plan_candidate_count: countFloorPlanCandidates(),
      },
      extractor: {
        matched: Boolean(detected),
        direct_status: directStatus,
        direct_error: directError,
        direct_had_data: Boolean(directResult),
        json_ld_had_data: Boolean(fallbackResult),
        extracted_fields: extracted ? Object.keys(extracted).slice(0, 100) : [],
      },
      facts,
      unit_options: unitOptions,
      media_kinds: mediaKinds,
      media: mediaDetails,
      photo_count: photoCount,
      photo_hosts: photoHosts,
      source_data_shape: structure,
    };
  }

  const api = {
    detect,
    extract,
    diagnose,
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
    extractInvitationHomes,
    extractFromJsonLd,
    EXTRACTORS
  };

  global.CP_Extractors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
