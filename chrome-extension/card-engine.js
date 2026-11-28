// ============================================================
// Choice Properties — Search-Card Quick-Save & Hydration Engine
// GENERATED FILE — DO NOT EDIT DIRECTLY.
// Edit src/extractors/shared-card-engine.js and run:
//   node scripts/build-extractors.js
// ============================================================
// ============================================================
// Choice Properties — Canonical Search-Card & Favorites Quick-Save
// High-Speed Adaptive Zero-Tab Hydration + Micro-Batch Engine
// ============================================================
// Compiled to chrome-extension/card-engine.js and
// .pages-orion/card-engine.js via scripts/build-extractors.js.
// ============================================================
(function (global) {
  'use strict';

  var DEFAULT_SETTINGS = {
    offlineQueue: true,
    autoSkipForSale: true,
    autoSkipDuplicates: true,
    autoSkipProhibited: true,
    bgTabFallback: false
  };

  var HUD_POS_KEY = 'cp_search_hud_pos_v1';
  var MAX_BATCH_CHUNK_ITEMS = 10;
  var MAX_BATCH_CHUNK_BYTES = 1400 * 1024;

  function createEngine() {
    var ctx = null;
    var active = false;
    var settings = Object.assign({}, DEFAULT_SETTINGS);
    var prohibitedProfiles = [];
    var prohibitedFetchedAt = 0;
    var batchCheckCache = {}; // key: `${scopeKey}:${zpid}` -> result
    var cardRecords = new Map(); // zpid -> record
    var selectedZpids = new Set();
    var failedRecords = new Map(); // zpid -> { zpid, title, reason }
    var hdpCache = {}; // zpid -> extracted HDP payload
    var queue = [];
    var pendingBatch = []; // { zpid, rec, payload, warnings }
    var batchFlushTimer = null;
    var batchFlushPromise = Promise.resolve();
    var activeWorkers = 0;
    var queueStopped = false;
    var last429Until = 0;
    var adaptiveConcurrency = 4;
    var cleanSuccessStreak = 0;
    var stats = { totalQueued: 0, completed: 0, saved: 0, skipped: 0, failed: 0 };
    var hudEl = null;
    var hudMinimized = false;
    var hudDragCleanup = null;
    var scanTimer = null;
    var mutationObserver = null;
    var discoveredQueryIds = { hdp: null, scannedAt: 0 };
    var localSessionState = {};
    var bgTabLock = Promise.resolve();

    // Favorites discovery state
    var isFavoritesMode = false;
    var reportedFavoritesTotal = null;
    var favoritesTotalPages = 1;
    var favoritesDiscovering = false;
    var favoritesDiscoveryPromise = null;
    var favoritesDiscoveredForUrl = '';

    function sleep(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function jitterMs(minMs, maxMs) {
      return Math.floor(minMs + Math.random() * (maxMs - minMs));
    }

    function getBaseConcurrency() {
      return (ctx && ctx.IS_MOBILE) ? 2 : 4;
    }

    function getScopeKey() {
      var def = ctx && ctx.getDefaultFolder ? ctx.getDefaultFolder() : null;
      if (def && (def.is_disposable_batch || def.batch_id)) {
        return 'batch:' + String(def.batch_id || def.name || '');
      }
      if (def && def.id) return 'folder:' + String(def.id);
      return 'inbox';
    }

    function escapeHtml(v) {
      if (ctx && ctx.escapeHtml) return ctx.escapeHtml(v);
      return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    async function sendBg(msg, timeoutMs) {
      if (!ctx || !ctx.sendRuntimeMessage) return null;
      return ctx.sendRuntimeMessage(msg, timeoutMs || 15000);
    }

    async function loadSettings() {
      try {
        var res = await sendBg({ type: 'GET_CARD_SETTINGS' }, 3000);
        if (res && res.ok && res.settings) {
          settings = Object.assign({}, DEFAULT_SETTINGS, res.settings);
          return;
        }
      } catch (_) {}
      try {
        var raw = localStorage.getItem('cp_card_settings_v1');
        if (raw) {
          settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
        }
      } catch (_) {}
    }

    async function saveSettings(partial) {
      settings = Object.assign({}, settings, partial || {});
      try {
        localStorage.setItem('cp_card_settings_v1', JSON.stringify(settings));
      } catch (_) {}
      try {
        await sendBg({ type: 'SET_CARD_SETTINGS', settings: settings }, 3000);
      } catch (_) {}
      updateHudSummary();
    }

    async function ensureProhibitedProfiles(force) {
      var now = Date.now();
      if (!force && prohibitedProfiles.length > 0 && (now - prohibitedFetchedAt) < 10 * 60 * 1000) {
        return prohibitedProfiles;
      }
      try {
        var bgRes = await sendBg({ type: 'LIST_PROHIBITED_PROFILES', force: Boolean(force) }, 6000);
        if (bgRes && bgRes.ok && Array.isArray(bgRes.profiles)) {
          prohibitedProfiles = bgRes.profiles;
          prohibitedFetchedAt = now;
          return prohibitedProfiles;
        }
      } catch (_) {}

      try {
        if (ctx && ctx.EDGE_URL && ctx.SECRET) {
          var url = ctx.EDGE_URL + '?secret=' + encodeURIComponent(ctx.SECRET) + '&action=list_prohibited_profiles';
          var res = await fetch(url, { headers: { 'x-import-secret': ctx.SECRET } });
          var data = await res.json().catch(function () { return null; });
          if (res.ok && data && data.ok && Array.isArray(data.profiles)) {
            prohibitedProfiles = data.profiles;
            prohibitedFetchedAt = now;
          }
        }
      } catch (_) {}
      return prohibitedProfiles;
    }

    async function runBatchPreCheck(zpids) {
      if (!zpids || !zpids.length) return;
      var scopeKey = getScopeKey();
      var missing = zpids.filter(function (id) {
        return !batchCheckCache[scopeKey + ':' + id];
      });
      if (!missing.length) return;

      var def = ctx && ctx.getDefaultFolder ? ctx.getDefaultFolder() : null;
      var reqBatchId = def && def.batch_id ? String(def.batch_id) : undefined;
      var reqFolderId = def && def.id ? String(def.id) : undefined;
      var reqFolderName = def && def.name != null ? String(def.name) : undefined;

      for (var i = 0; i < missing.length; i += 80) {
        var slice = missing.slice(i, i + 80);
        var addresses = {};
        slice.forEach(function (id) {
          var r = cardRecords.get(id);
          if (r && r.card && r.card.address && r.card.city) {
            addresses[id] = {
              address: r.card.address,
              city: r.card.city,
              state: r.card.state || null
            };
          }
        });
        var resp = null;
        try {
          resp = await sendBg({
            type: 'CHECK_LISTINGS_BATCH',
            source: 'zillow',
            source_listing_ids: slice,
            addresses: addresses,
            batch_id: reqBatchId,
            folder_id: reqFolderId,
            folder_name: reqFolderName
          }, 8000);
        } catch (_) {}

        if (!resp || !resp.ok) {
          try {
            var directRes = await fetch(ctx.EDGE_URL + '?secret=' + encodeURIComponent(ctx.SECRET), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-import-secret': ctx.SECRET },
              body: JSON.stringify({
                action: 'check_listings_batch',
                source: 'zillow',
                source_listing_ids: slice,
                addresses: addresses,
                batch_id: reqBatchId,
                folder_id: reqFolderId,
                folder_name: reqFolderName
              })
            });
            if (directRes.ok) resp = await directRes.json().catch(function () { return null; });
          } catch (_) {}
        }

        if (resp && resp.ok && resp.results && typeof resp.results === 'object') {
          Object.keys(resp.results).forEach(function (id) {
            batchCheckCache[scopeKey + ':' + id] = resp.results[id];
          });
        }
      }
    }

    // Attempt to discover Zillow HDP GraphQL queryId from client-side performance entries
    function discoverZillowHdpQueryId() {
      if (discoveredQueryIds.hdp && (Date.now() - discoveredQueryIds.scannedAt) < 5 * 60 * 1000) {
        return discoveredQueryIds.hdp;
      }
      discoveredQueryIds.scannedAt = Date.now();
      try {
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
          var entries = performance.getEntriesByType('resource') || [];
          for (var i = entries.length - 1; i >= 0; i--) {
            var name = String(entries[i].name || '');
            if (name.includes('/graphql') && /queryId=([a-f0-9]{16,64})/i.test(name)) {
              discoveredQueryIds.hdp = name.match(/queryId=([a-f0-9]{16,64})/i)[1];
              return discoveredQueryIds.hdp;
            }
          }
        }
      } catch (_) {}
      return discoveredQueryIds.hdp;
    }

    function countPayloadPhotos(obj) {
      if (!obj) return 0;
      try {
        var arr = typeof obj.original_image_urls === 'string'
          ? JSON.parse(obj.original_image_urls || '[]')
          : obj.original_image_urls;
        return Array.isArray(arr) ? arr.length : 0;
      } catch (_) { return 0; }
    }

    function isLosslessHdpPayload(merged, tier, hdpPayload) {
      if (!merged || !merged.address) return false;
      if (hdpPayload && (
        tier === 'tier1_ssr_html' ||
        tier === 'tier2_graphql' ||
        tier === 'tier3_bg_tab' ||
        tier === 'tier1_partial_html' ||
        tier === 'hdp_cache'
      )) {
        return true;
      }
      // Tier-0 search/favorites cache fallback only accepted if already rich
      var descLen = merged.description ? String(merged.description).trim().length : 0;
      var photos = countPayloadPhotos(merged);
      return descLen >= 20 && photos >= 2;
    }

    function registerRateLimitBackoff(ms) {
      var cooldown = Math.min(15000, ms || 6500);
      last429Until = Math.max(last429Until, Date.now() + cooldown);
      adaptiveConcurrency = Math.max(1, Math.floor(adaptiveConcurrency / 2));
      cleanSuccessStreak = 0;
      updateHudSummary();
    }

    function recordHealthySuccess() {
      cleanSuccessStreak += 1;
      var cap = getBaseConcurrency();
      if (cleanSuccessStreak >= 4 && adaptiveConcurrency < cap) {
        adaptiveConcurrency += 1;
        cleanSuccessStreak = 0;
      }
    }

    function runWithBgTabLock(taskFn) {
      var run = bgTabLock.then(taskFn, taskFn);
      bgTabLock = run.catch(function () {});
      return run;
    }

    async function fetchZillowHdpFromNetwork(card, options) {
      var opts = options || {};
      if (hdpCache[card.zpid]) {
        return { payload: hdpCache[card.zpid], tier: 'hdp_cache', blocked: false };
      }

      var waitNow = last429Until - Date.now();
      if (waitNow > 0) {
        await sleep(Math.min(waitNow, 12000));
      }

      var targetUrl = card.detailUrl || ('https://www.zillow.com/homedetails/' + card.zpid + '_zpid/');
      var wasBlocked = false;

      // Tier 1: Same-origin authenticated HTML fetch + __NEXT_DATA__ parse (up to 2 attempts)
      for (var attempt = 0; attempt < 2; attempt++) {
        try {
          var res = await fetch(targetUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });

          if (res.status === 429 || res.status === 403) {
            wasBlocked = true;
            registerRateLimitBackoff(attempt === 0 ? 5000 : 9000);
            if (attempt === 0) {
              await sleep(jitterMs(450, 900));
              continue;
            }
          } else if (res.ok) {
            var html = await res.text();
            var parsed = global.CP_Extractors.extractZillowFromHtml(html, targetUrl);
            if (parsed && parsed._blocked) {
              wasBlocked = true;
            } else if (parsed && parsed.address) {
              var photos = countPayloadPhotos(parsed);
              hdpCache[card.zpid] = parsed;
              if (parsed.description || photos >= 2) {
                recordHealthySuccess();
                return { payload: parsed, tier: 'tier1_ssr_html', blocked: false };
              }
              break; // Partial HDP cached; try Tier 2 for richer description/photos
            }
          }
        } catch (_) {
          if (attempt === 0) await sleep(jitterMs(250, 550));
        }
      }

      // Tier 2: Dynamic Zillow HDP GraphQL endpoint
      try {
        var qid = discoverZillowHdpQueryId();
        if (qid) {
          var gqlUrl = 'https://www.zillow.com/graphql/?zpid=' + encodeURIComponent(card.zpid) +
            '&operationName=ForRentDoubleScrollFullRenderQuery';
          var gqlRes = await fetch(gqlUrl, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              operationName: 'ForRentDoubleScrollFullRenderQuery',
              variables: {
                zpid: Number(card.zpid) || card.zpid,
                contactFormRenderParameter: {
                  zpid: Number(card.zpid) || card.zpid,
                  platform: 'desktop',
                  isDoubleScroll: true
                }
              },
              queryId: qid
            })
          });
          if (gqlRes.status === 429 || gqlRes.status === 403) {
            wasBlocked = true;
            registerRateLimitBackoff(6500);
          } else if (gqlRes.ok) {
            var gqlJson = await gqlRes.json().catch(function () { return null; });
            var propObj = gqlJson && gqlJson.data && (gqlJson.data.property || gqlJson.data.viewer);
            if (propObj && global.CP_Extractors.normalizeZillowGraphqlProperty) {
              var norm = global.CP_Extractors.normalizeZillowGraphqlProperty(propObj, targetUrl);
              if (norm && norm.address) {
                hdpCache[card.zpid] = norm;
                recordHealthySuccess();
                return { payload: norm, tier: 'tier2_graphql', blocked: false };
              }
            }
          }
        }
      } catch (_) {}

      // Tier 3: Serialized silent background tab rescue when blocked or missing HDP richness
      var shouldTryBgTab = Boolean(
        settings.bgTabFallback ||
        (!hdpCache[card.zpid] && (wasBlocked || opts.allowBgRescue))
      );
      if (shouldTryBgTab && ctx && ctx.sendRuntimeMessage) {
        try {
          var bgHydrate = await runWithBgTabLock(function () {
            return sendBg({ type: 'HYDRATE_URL_IN_BG_TAB', url: targetUrl }, 16000);
          });
          if (bgHydrate && bgHydrate.ok && bgHydrate.extracted && bgHydrate.extracted.address) {
            hdpCache[card.zpid] = bgHydrate.extracted;
            return { payload: bgHydrate.extracted, tier: 'tier3_bg_tab', blocked: false };
          }
        } catch (_) {}
      }

      if (hdpCache[card.zpid]) {
        return { payload: hdpCache[card.zpid], tier: 'tier1_partial_html', blocked: false };
      }
      return { payload: null, tier: 'tier0_search_cache', blocked: wasBlocked };
    }

    function buildSubmitPayload(extracted, tier) {
      var def = ctx && ctx.getDefaultFolder ? ctx.getDefaultFolder() : null;
      var selectedFolderId = def && def.id ? String(def.id) : null;
      var selectedFolderName = def && def.name != null && String(def.name) !== '' ? String(def.name) : null;
      var selectedBatchId = def && def.batch_id ? String(def.batch_id) : null;

      var photoUrls = [];
      try {
        var rawImgs = typeof extracted.original_image_urls === 'string'
          ? JSON.parse(extracted.original_image_urls || '[]')
          : extracted.original_image_urls;
        if (Array.isArray(rawImgs)) {
          var seenU = new Set();
          rawImgs.forEach(function (item) {
            var u = typeof item === 'string' ? item : (item && item.url);
            if (u && /^https?:\/\//i.test(u) && !seenU.has(u)) {
              seenU.add(u);
              photoUrls.push(u);
            }
          });
        }
      } catch (_) {}

      var cap = ctx && ctx.IS_MOBILE ? 25 : 50;
      photoUrls = photoUrls.slice(0, cap);

      var metaByUrl = {};
      if (Array.isArray(extracted.photo_metadata)) {
        extracted.photo_metadata.forEach(function (pm) {
          if (pm && pm.url) metaByUrl[pm.url] = pm;
        });
      }
      var richPhotos = photoUrls.map(function (u) {
        var pm = metaByUrl[u];
        if (!pm) return { url: u };
        var entry = { url: u };
        if (pm.caption) entry.caption = pm.caption;
        if (pm.room_label) entry.room_label = pm.room_label;
        if (pm.source_url) entry.source_url = pm.source_url;
        if (pm.media_type) entry.media_type = pm.media_type;
        return entry;
      });

      var rentVal = extracted.monthly_rent != null ? extracted.monthly_rent : extracted.rent;
      var bathsVal = extracted.bathrooms != null ? extracted.bathrooms : extracted.baths;
      var totalBathsVal = extracted.total_bathrooms != null ? extracted.total_bathrooms : bathsVal;
      var nonce = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

      var payload = {
        source: 'zillow',
        source_listing_id: extracted.source_listing_id,
        source_url: extracted.source_url,
        title: extracted.title,
        address: extracted.address,
        unit_number: extracted.unit_number || null,
        city: extracted.city,
        state: extracted.state,
        zip: extracted.zip,
        lat: extracted.lat,
        lng: extracted.lng,
        monthly_rent: rentVal,
        bedrooms: extracted.bedrooms != null ? extracted.bedrooms : extracted.beds,
        bathrooms: bathsVal,
        half_bathrooms: extracted.half_bathrooms,
        total_bathrooms: totalBathsVal,
        square_footage: extracted.square_footage != null ? extracted.square_footage : extracted.sqft,
        lot_size_sqft: extracted.lot_size_sqft || null,
        year_built: extracted.year_built || null,
        floors: extracted.floors || null,
        garage_spaces: extracted.garage_spaces || null,
        total_units: extracted.total_units || null,
        property_type: extracted.property_type || 'APARTMENT',
        property_subtype: extracted.property_subtype || null,
        description: extracted.description || null,
        original_description: extracted.original_description || extracted.description || null,
        showing_instructions: extracted.showing_instructions || null,
        available_date: extracted.available_date || null,
        minimum_lease_months: extracted.minimum_lease_months != null ? extracted.minimum_lease_months : null,
        lease_terms: typeof extracted.lease_terms === 'string' ? extracted.lease_terms : (extracted.lease_terms ? JSON.stringify(extracted.lease_terms) : null),
        pets_allowed: extracted.pets_allowed != null ? extracted.pets_allowed : null,
        pet_types_allowed: typeof extracted.pet_types_allowed === 'string' ? extracted.pet_types_allowed : (extracted.pet_types_allowed ? JSON.stringify(extracted.pet_types_allowed) : null),
        pet_weight_limit: extracted.pet_weight_limit != null ? extracted.pet_weight_limit : null,
        pet_details: extracted.pet_details || null,
        smoking_allowed: extracted.smoking_allowed != null ? extracted.smoking_allowed : null,
        application_fee: 50,
        security_deposit: extracted.security_deposit != null ? extracted.security_deposit : rentVal,
        pet_deposit: extracted.pet_deposit != null ? extracted.pet_deposit : null,
        admin_fee: extracted.admin_fee != null ? extracted.admin_fee : null,
        last_months_rent: extracted.last_months_rent || null,
        move_in_special: extracted.move_in_special || null,
        parking_fee: extracted.parking_fee || null,
        hoa_fee: extracted.hoa_fee || null,
        hoa_fee_frequency: extracted.hoa_fee_frequency || null,
        tax_annual_amount: extracted.tax_annual_amount != null ? extracted.tax_annual_amount : null,
        amenities: typeof extracted.amenities === 'string' ? extracted.amenities : JSON.stringify(extracted.amenities || []),
        appliances: typeof extracted.appliances === 'string' ? extracted.appliances : JSON.stringify(extracted.appliances || []),
        flooring: typeof extracted.flooring === 'string' ? extracted.flooring : (extracted.flooring ? JSON.stringify(extracted.flooring) : null),
        utilities_included: typeof extracted.utilities_included === 'string' ? extracted.utilities_included : JSON.stringify(extracted.utilities_included || []),
        parking: extracted.parking || null,
        ev_charging: extracted.ev_charging || null,
        heating_type: extracted.heating_type || null,
        cooling_type: extracted.cooling_type || null,
        laundry_type: extracted.laundry_type || null,
        has_basement: extracted.has_basement ?? null,
        has_central_air: extracted.has_central_air ?? null,
        neighborhood: extracted.neighborhood || null,
        county: extracted.county || null,
        location_context: extracted.location_context || null,
        virtual_tour_url: extracted.virtual_tour_url || null,
        agent_name: extracted.agent_name || null,
        broker_name: extracted.broker_name || null,
        listed_at: extracted.listed_at || null,
        source_last_updated_at: extracted.source_last_updated_at || null,
        source_status: extracted.source_status || null,
        folder_id: selectedFolderId,
        folder_name: selectedFolderName,
        batch_id: selectedBatchId,
        original_image_urls: JSON.stringify(richPhotos),
        structural_details: extracted.structural_details || null,
        utility_details: extracted.utility_details || null,
        financial_details: extracted.financial_details || null,
        location_details: extracted.location_details || null,
        floor_plans: extracted.floor_plans || null,
        videos: extracted.videos || null,
        source_raw_payload: extracted.source_raw_payload || null,
        enforce_prohibited_block: Boolean(settings.autoSkipProhibited),
        field_provenance: {
          source: 'zillow',
          extractor_version: 'v' + (ctx ? ctx.VERSION : '36.0.0'),
          captured_at: new Date().toISOString(),
          save_nonce: nonce,
          hydration_tier: tier,
          zero_tab_card_save: true,
          normalized_defaults: ['application_fee']
        },
        _import: 'browser-extension-v' + (ctx ? ctx.VERSION : '36.0.0')
      };

      if (JSON.stringify(payload).length > 1900000 && payload.source_raw_payload) {
        payload.source_raw_payload = null;
      }
      return payload;
    }

    function markRecordFailure(rec, reason) {
      if (!rec) return;
      var msg = reason ? String(reason) : 'Save failed';
      failedRecords.set(rec.zpid, {
        zpid: rec.zpid,
        title: (rec.card && (rec.card.address || rec.card.title)) || ('Listing #' + rec.zpid),
        reason: msg
      });
      stats.failed = failedRecords.size;
      updateCardPill(rec, 'error', 'Retry', msg.slice(0, 60));
    }

    function clearRecordFailure(zpid) {
      if (failedRecords.delete(zpid)) {
        stats.failed = failedRecords.size;
      }
    }

    function applySubmissionResult(entry, resp) {
      var rec = entry.rec;
      var zpid = entry.zpid;
      var scopeKey = getScopeKey();

      if (resp && resp.prohibited) {
        clearRecordFailure(zpid);
        updateCardPill(rec, 'prohibited', 'Blocked ⛔', resp.message || 'Prohibited profile');
        return 'skipped';
      }
      if (resp && resp.queued) {
        clearRecordFailure(zpid);
        localSessionState[scopeKey + ':' + zpid] = { kind: 'queued', label: 'Queued' };
        updateCardPill(rec, 'queued', 'Queued ✓');
        return 'saved';
      }
      if (resp && (resp.ok || resp.duplicate)) {
        clearRecordFailure(zpid);
        var label = '✓ Saved';
        if (resp.folder && resp.folder.batch_id) {
          label = '✓ #' + resp.folder.batch_id + (resp.folder.serial ? ' (#' + resp.folder.serial + ')' : '');
        } else if (resp.folder && resp.folder.name) {
          label = '✓ ' + String(resp.folder.name).slice(0, 12);
        } else if (resp.duplicate) {
          label = resp.batch_id ? ('✓ In #' + resp.batch_id) : '✓ In Pipeline';
        }
        localSessionState[scopeKey + ':' + zpid] = {
          kind: resp.duplicate ? 'in_pipeline' : 'saved',
          label: label
        };
        batchCheckCache[scopeKey + ':' + zpid] = {
          exists_in_scope: true,
          pipeline_id: resp.id || null,
          status: resp.status || 'scraped',
          batch_id: resp.batch_id || (resp.folder && resp.folder.batch_id) || null,
          folder: resp.folder || null,
          published: Boolean(resp.active_on_site),
          active_on_site: Boolean(resp.active_on_site),
          other_batches: []
        };
        selectedZpids.delete(zpid);
        updateCardPill(
          rec,
          resp.duplicate ? 'in_pipeline' : 'saved',
          label,
          entry.warnings && entry.warnings.length ? ('Saved with notice: ' + entry.warnings.join(', ')) : ''
        );
        return 'saved';
      }

      var errText = (resp && resp.error) ? String(resp.error) : 'Save failed';
      markRecordFailure(rec, errText);
      return 'failed';
    }

    async function submitChunkToServer(chunk) {
      if (!chunk || !chunk.length) return { ok: false, results: [] };
      var def = ctx && ctx.getDefaultFolder ? ctx.getDefaultFolder() : null;
      var batchId = def && def.batch_id ? String(def.batch_id) : null;
      var folderId = def && def.id ? String(def.id) : null;
      var folderName = def && def.name != null && String(def.name) !== '' ? String(def.name) : null;
      var listings = chunk.map(function (c) { return c.payload; });

      var batchResp = await sendBg({
        type: 'SUBMIT_BATCH_IMPORT',
        listings: listings,
        batch_id: batchId,
        folder_id: folderId,
        folder_name: folderName,
        enforce_prohibited_block: Boolean(settings.autoSkipProhibited)
      }, 28000);

      if ((!batchResp || batchResp.bridgeFailure) && ctx && ctx.EDGE_URL && ctx.SECRET) {
        try {
          var directRes = await fetch(ctx.EDGE_URL + '?secret=' + encodeURIComponent(ctx.SECRET), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-import-secret': ctx.SECRET },
            body: JSON.stringify({
              action: 'import_batch',
              listings: listings,
              batch_id: batchId,
              folder_id: folderId,
              folder_name: folderName,
              enforce_prohibited_block: Boolean(settings.autoSkipProhibited)
            })
          });
          var directBody = await directRes.json().catch(function () { return null; });
          if (directRes.ok && directBody && directBody.ok) {
            batchResp = directBody;
            if (directBody.saved > 0) {
              sendBg({ type: 'SAVED', count: directBody.saved }, 2500).catch(function () {});
            }
          }
        } catch (_) {}
      }

      return batchResp;
    }

    async function flushPendingBatch() {
      if (!pendingBatch.length) return;
      var batchToProcess = pendingBatch.splice(0, pendingBatch.length);
      var chunks = [];
      var currentChunk = [];
      var currentBytes = 256;

      for (var i = 0; i < batchToProcess.length; i++) {
        var entry = batchToProcess[i];
        var itemSize = JSON.stringify(entry.payload).length;
        if (currentChunk.length > 0 && (
          currentChunk.length >= MAX_BATCH_CHUNK_ITEMS ||
          (currentBytes + itemSize) > MAX_BATCH_CHUNK_BYTES
        )) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentBytes = 256;
        }
        currentChunk.push(entry);
        currentBytes += itemSize + 4;
      }
      if (currentChunk.length > 0) chunks.push(currentChunk);

      for (var cIdx = 0; cIdx < chunks.length; cIdx++) {
        var chunk = chunks[cIdx];
        var batchResp = await submitChunkToServer(chunk);

        if (batchResp && batchResp.ok && Array.isArray(batchResp.results)) {
          for (var j = 0; j < chunk.length; j++) {
            var e = chunk[j];
            var matched = batchResp.results[j];
            if (!matched || (matched.source_listing_id && matched.source_listing_id !== String(e.zpid))) {
              matched = batchResp.results.find(function (r) {
                return r && String(r.source_listing_id) === String(e.zpid);
              });
            }
            var outcome = applySubmissionResult(e, matched || { ok: false, error: 'Missing item result' });
            stats.completed += 1;
            if (outcome === 'saved') stats.saved += 1;
            else if (outcome === 'skipped') stats.skipped += 1;
          }
          updateHudSummary();
          continue;
        }

        // Chunk batch request failed (e.g. partial payload issue / timeout):
        // Fall back per-item cleanly via ctx.submitPayload (and offline queue if enabled)
        for (var k = 0; k < chunk.length; k++) {
          var singleEntry = chunk[k];
          var singleResp = null;
          try {
            singleResp = ctx && ctx.submitPayload
              ? await ctx.submitPayload(singleEntry.payload)
              : { ok: false, error: (batchResp && batchResp.error) || 'Submit unavailable' };
          } catch (err) {
            singleResp = { ok: false, error: err && err.message ? err.message : 'Network error' };
          }
          if (singleResp && singleResp.ok) {
            sendBg({ type: 'SAVED', count: 1 }, 2000).catch(function () {});
          }
          var singleOutcome = applySubmissionResult(singleEntry, singleResp);
          stats.completed += 1;
          if (singleOutcome === 'saved') stats.saved += 1;
          else if (singleOutcome === 'skipped') stats.skipped += 1;
        }
        updateHudSummary();
      }
    }

    function scheduleBatchFlush(immediate) {
      if (batchFlushTimer) {
        clearTimeout(batchFlushTimer);
        batchFlushTimer = null;
      }
      if (immediate) {
        batchFlushPromise = batchFlushPromise.then(flushPendingBatch, flushPendingBatch);
        return batchFlushPromise;
      }
      batchFlushTimer = setTimeout(function () {
        batchFlushTimer = null;
        batchFlushPromise = batchFlushPromise.then(flushPendingBatch, flushPendingBatch);
      }, 420);
      return batchFlushPromise;
    }

    function enqueueSubmission(entry, flushNow) {
      pendingBatch.push(entry);
      var shouldFlushImmediate = Boolean(
        flushNow ||
        pendingBatch.length >= MAX_BATCH_CHUNK_ITEMS ||
        (queue.length === 0 && activeWorkers <= 1)
      );
      return scheduleBatchFlush(shouldFlushImmediate);
    }

    async function processCardSave(zpid) {
      var rec = cardRecords.get(zpid);
      if (!rec) return { status: 'skipped', deferred: false };

      var preState = computeCardVisualState(rec);
      if (preState.kind === 'for_sale' && settings.autoSkipForSale && !rec.forceExplicit) {
        updateCardPill(rec, 'for_sale', 'For Sale — Skip');
        return { status: 'skipped', deferred: false };
      }
      if (preState.kind === 'prohibited' && settings.autoSkipProhibited) {
        updateCardPill(rec, 'prohibited', 'Blocked ⛔');
        return { status: 'skipped', deferred: false };
      }
      if ((preState.kind === 'in_pipeline' || preState.kind === 'saved' || preState.kind === 'published') && settings.autoSkipDuplicates && !rec.forceExplicit) {
        return { status: 'skipped', deferred: false };
      }

      clearRecordFailure(zpid);
      updateCardPill(rec, 'hydrating', 'Hydrating…');

      var searchCache = global.CP_Extractors.extractZillowSearchCache(document, location.href);
      var searchEntry = (searchCache && searchCache.byZpid && searchCache.byZpid[zpid]) || null;
      var favData = (global.CP_Extractors.extractZillowFavoritesData
        ? global.CP_Extractors.extractZillowFavoritesData(document, location.href, document)
        : null);
      if (!searchEntry && favData && favData.byZpid && favData.byZpid[zpid]) {
        searchEntry = favData.byZpid[zpid];
      }

      var hdpResult = await fetchZillowHdpFromNetwork(rec.card, {
        allowBgRescue: Boolean(rec.forceExplicit || isFavoritesMode)
      });
      var merged = global.CP_Extractors.hydrateZillowCardPayload(
        hdpResult.payload,
        searchEntry,
        rec.card,
        rec.card.detailUrl
      );

      // Re-run full eligibility check after HDP hydration
      await ensureProhibitedProfiles(false);
      var elig = global.CP_Extractors.evaluateZillowEligibility(merged, prohibitedProfiles);

      if (elig.isNonRental && settings.autoSkipForSale && !rec.forceExplicit) {
        updateCardPill(rec, 'for_sale', 'For Sale — Skip', elig.blockedReason);
        return { status: 'skipped', deferred: false };
      }
      if (elig.prohibitedMatch && elig.prohibitedMatch.matched && settings.autoSkipProhibited) {
        updateCardPill(rec, 'prohibited', 'Blocked ⛔', elig.blockedReason);
        return { status: 'skipped', deferred: false };
      }

      if (!isLosslessHdpPayload(merged, hdpResult.tier, hdpResult.payload)) {
        var failReason = !merged.address
          ? 'Could not extract property address'
          : (hdpResult.blocked
            ? 'Zillow rate-limited or challenged HDP request — click Retry Failed'
            : 'Incomplete property details (no description or photos) — click Retry Failed');
        markRecordFailure(rec, failReason);
        return { status: 'failed', deferred: false };
      }

      updateCardPill(rec, 'saving', 'Saving…');

      var payload = buildSubmitPayload(merged, hdpResult.tier);
      var flushNow = queue.length === 0 && activeWorkers <= 1;
      enqueueSubmission({
        zpid: zpid,
        rec: rec,
        payload: payload,
        warnings: elig.warnings || []
      }, flushNow);

      return { status: 'queued_batch', deferred: true };
    }

    function enqueueSave(zpids, forceExplicit) {
      queueStopped = false;
      var added = 0;
      zpids.forEach(function (zpid) {
        var rec = cardRecords.get(zpid);
        if (!rec) return;
        rec.forceExplicit = Boolean(forceExplicit);
        clearRecordFailure(zpid);
        if (queue.indexOf(zpid) === -1) {
          queue.push(zpid);
          stats.totalQueued += 1;
          added += 1;
          updateCardPill(rec, 'queued', 'Queued…');
        }
      });
      if (added > 0) {
        updateHudSummary();
        pumpQueue();
      }
    }

    async function pumpQueue() {
      while (active && !queueStopped && activeWorkers < adaptiveConcurrency && queue.length > 0) {
        var nextZpid = queue.shift();
        activeWorkers += 1;
        updateHudSummary();
        (async function (zpid) {
          try {
            var res = await processCardSave(zpid);
            if (!res.deferred) {
              stats.completed += 1;
              if (res.status === 'skipped') stats.skipped += 1;
            }
          } catch (err) {
            stats.completed += 1;
            var rec = cardRecords.get(zpid);
            markRecordFailure(rec, err && err.message ? err.message : 'Unexpected save error');
          } finally {
            activeWorkers -= 1;
            if (!queueStopped && queue.length > 0) {
              updateHudSummary();
              await sleep(jitterMs(40, 110));
              pumpQueue();
            } else {
              if (pendingBatch.length > 0) {
                scheduleBatchFlush(true);
              }
              updateHudSummary();
            }
          }
        })(nextZpid);
      }
    }

    function buildPaginatedFavoritesUrl(baseHref, pageNum) {
      try {
        var u = new URL(baseHref);
        if (u.searchParams.has('page')) {
          u.searchParams.set('page', String(pageNum));
        } else {
          u.searchParams.set('p', String(pageNum));
        }
        return u.toString();
      } catch (_) {
        var sep = baseHref.indexOf('?') !== -1 ? '&' : '?';
        return baseHref + sep + 'p=' + pageNum;
      }
    }

    function registerFavoritesItems(items) {
      if (!Array.isArray(items) || !items.length) return [];
      var newlyAdded = [];
      items.forEach(function (item) {
        if (!item || !item.zpid) return;
        var zpid = String(item.zpid);
        if (cardRecords.has(zpid)) return;
        var detailUrl = item.detailUrl || ('https://www.zillow.com/homedetails/' + zpid + '_zpid/');
        cardRecords.set(zpid, {
          zpid: zpid,
          offscreen: true,
          forceExplicit: false,
          card: {
            zpid: zpid,
            detailUrl: detailUrl,
            address: item.address || null,
            city: item.city || null,
            state: item.state || null,
            zip: item.zip || null,
            monthly_rent: item.monthly_rent != null ? item.monthly_rent : item.rent,
            bedrooms: item.bedrooms != null ? item.bedrooms : item.beds,
            bathrooms: item.bathrooms != null ? item.bathrooms : item.baths,
            square_footage: item.square_footage != null ? item.square_footage : item.sqft,
            statusType: item.statusType || null,
            broker_name: item.broker_name || null,
            agent_name: item.agent_name || null,
            carousel_photos: item.carousel_photos || [],
            cardEl: null
          }
        });
        newlyAdded.push(zpid);
      });
      return newlyAdded;
    }

    async function discoverAllFavorites() {
      if (!isFavoritesMode || !active) return;
      if (favoritesDiscoveredForUrl === location.href && favoritesDiscoveryPromise) {
        return favoritesDiscoveryPromise;
      }
      if (favoritesDiscoveryPromise) return favoritesDiscoveryPromise;

      favoritesDiscovering = true;
      var currentHref = location.href;
      favoritesDiscoveredForUrl = currentHref;
      updateHudSummary();

      favoritesDiscoveryPromise = (async function () {
        try {
          var maxPages = favoritesTotalPages > 1 ? Math.min(favoritesTotalPages, 20) : 4;
          var discoveredZpids = [];
          for (var p = 2; p <= maxPages; p += 2) {
            if (!active || location.href !== currentHref) break;
            var batchPages = [p];
            if (p + 1 <= maxPages) batchPages.push(p + 1);

            var addedThisRound = 0;
            await Promise.all(batchPages.map(async function (pageNum) {
              try {
                var pageUrl = buildPaginatedFavoritesUrl(currentHref, pageNum);
                var res = await fetch(pageUrl, {
                  method: 'GET',
                  credentials: 'include',
                  headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' }
                });
                if (!res.ok) return;
                var html = await res.text();
                if (!html || html.length < 500) return;
                var pageFav = global.CP_Extractors.extractZillowFavoritesData
                  ? global.CP_Extractors.extractZillowFavoritesData(html, pageUrl, null)
                  : null;
                var items = (pageFav && pageFav.list && pageFav.list.length)
                  ? pageFav.list
                  : ((global.CP_Extractors.extractZillowSearchCache(html, pageUrl) || {}).list || []);
                if (pageFav && pageFav.totalCount && (!reportedFavoritesTotal || pageFav.totalCount > reportedFavoritesTotal)) {
                  reportedFavoritesTotal = pageFav.totalCount;
                }
                var added = registerFavoritesItems(items);
                if (added.length > 0) {
                  addedThisRound += added.length;
                  added.forEach(function (id) { discoveredZpids.push(id); });
                }
              } catch (_) {}
            }));

            // Stop probing if explicit totalPages wasn't known and page returned no new items
            if (favoritesTotalPages <= 1 && addedThisRound === 0) break;
            if (reportedFavoritesTotal && cardRecords.size >= reportedFavoritesTotal) break;
          }

          if (discoveredZpids.length > 0 && active) {
            await runBatchPreCheck(discoveredZpids);
          }
        } finally {
          favoritesDiscovering = false;
          updateHudSummary();
        }
      })();

      return favoritesDiscoveryPromise;
    }

    function computeCardVisualState(rec) {
      var zpid = rec.zpid;
      var scopeKey = getScopeKey();
      var sess = localSessionState[scopeKey + ':' + zpid];
      if (sess) return sess;

      var batchEntry = batchCheckCache[scopeKey + ':' + zpid];
      if (batchEntry) {
        if (batchEntry.exists_in_scope) {
          var bLabel = batchEntry.batch_id
            ? ('✓ In #' + batchEntry.batch_id)
            : (batchEntry.folder && batchEntry.folder.name ? ('✓ ' + String(batchEntry.folder.name).slice(0, 12)) : '✓ In Pipeline');
          return { kind: 'in_pipeline', label: bLabel, title: 'Already in current batch/folder' };
        }
        if (batchEntry.active_on_site || batchEntry.published) {
          var rentNote = batchEntry.public_monthly_rent ? (' ($' + Number(batchEntry.public_monthly_rent).toLocaleString() + '/mo)') : '';
          return { kind: 'published', label: '✓ Live on Site', title: 'Currently active on public Choice Properties site' + rentNote };
        }
      }

      var elig = global.CP_Extractors.evaluateZillowEligibility(rec.card, prohibitedProfiles);
      if (elig.isNonRental) {
        return { kind: 'for_sale', label: 'For Sale — Skip', title: elig.blockedReason };
      }
      if (elig.prohibitedMatch && elig.prohibitedMatch.matched) {
        return { kind: 'prohibited', label: 'Blocked ⛔', title: elig.blockedReason };
      }

      var otherTag = (batchEntry && Array.isArray(batchEntry.other_batches) && batchEntry.other_batches.length > 0)
        ? (' • In #' + batchEntry.other_batches[0])
        : '';
      var lowPhoto = rec.card.carousel_photos && rec.card.carousel_photos.length > 0 && rec.card.carousel_photos.length < 4
        ? (' (' + rec.card.carousel_photos.length + '📸)')
        : '';
      return {
        kind: 'ready',
        label: '+ Save' + lowPhoto,
        subLabel: otherTag ? ('#' + batchEntry.other_batches[0]) : '',
        title: 'Save full listing to Choice Properties without opening tab' + (otherTag ? ' (also in batch ' + batchEntry.other_batches.join(', ') + ')' : '')
      };
    }

    function updateCardPill(rec, kind, label, title) {
      if (!rec || !rec.btnEl) return;
      rec.btnEl.className = 'cp-card-pill cp-card-pill-' + kind;
      rec.btnEl.textContent = label;
      if (title) rec.btnEl.title = title;
      rec.btnEl.disabled = (kind === 'hydrating' || kind === 'saving' || kind === 'queued');
      if (rec.cbEl) {
        rec.cbEl.checked = selectedZpids.has(rec.zpid);
        var hideCb = (kind === 'for_sale' && settings.autoSkipForSale) ||
                     (kind === 'prohibited' && settings.autoSkipProhibited) ||
                     (kind === 'saved' || kind === 'in_pipeline' || kind === 'published');
        rec.cbEl.style.display = hideCb ? 'none' : '';
      }
    }

    function injectPillIntoCard(rec) {
      if (!rec || !rec.card) return;
      var cardEl = rec.card.cardEl;
      if (!cardEl || !cardEl.isConnected) return;
      var computed = computeCardVisualState(rec);

      var existingWrap = cardEl.querySelector('.cp-card-pill-wrap[data-cp-zpid="' + rec.zpid + '"]');
      if (existingWrap) {
        rec.wrapEl = existingWrap;
        rec.btnEl = existingWrap.querySelector('.cp-card-pill');
        rec.cbEl = existingWrap.querySelector('.cp-card-select-cb');
        if (queue.indexOf(rec.zpid) === -1 && (!rec.btnEl || !/Hydrating|Saving|Queued/.test(rec.btnEl.textContent))) {
          updateCardPill(rec, computed.kind, computed.label, computed.title);
        }
        return;
      }

      try {
        var pos = getComputedStyle(cardEl).position;
        if (pos === 'static') cardEl.style.position = 'relative';
      } catch (_) {}

      var wrap = document.createElement('div');
      wrap.className = 'cp-card-pill-wrap';
      wrap.setAttribute('data-cp-zpid', rec.zpid);
      wrap.addEventListener('click', function (e) {
        e.stopPropagation();
      });

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'cp-card-select-cb';
      cb.title = 'Select card for batch save';
      cb.checked = selectedZpids.has(rec.zpid);
      cb.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      cb.addEventListener('change', function () {
        if (cb.checked) selectedZpids.add(rec.zpid);
        else selectedZpids.delete(rec.zpid);
        updateHudSummary();
      });

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cp-card-pill cp-card-pill-' + computed.kind;
      btn.textContent = computed.label;
      if (computed.title) btn.title = computed.title;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        enqueueSave([rec.zpid], true);
      });

      wrap.appendChild(cb);
      wrap.appendChild(btn);

      if (computed.subLabel) {
        var badge = document.createElement('span');
        badge.className = 'cp-card-sub-badge';
        badge.textContent = computed.subLabel;
        wrap.appendChild(badge);
      }

      cardEl.appendChild(wrap);
      rec.wrapEl = wrap;
      rec.btnEl = btn;
      rec.cbEl = cb;
      updateCardPill(rec, computed.kind, computed.label, computed.title);
    }

    function countUnsavedAll() {
      var list = [];
      cardRecords.forEach(function (rec) {
        if (!rec.offscreen && (!rec.card.cardEl || !rec.card.cardEl.isConnected)) return;
        var st = computeCardVisualState(rec);
        if (st.kind === 'for_sale' && settings.autoSkipForSale) return;
        if (st.kind === 'prohibited' && settings.autoSkipProhibited) return;
        if ((st.kind === 'in_pipeline' || st.kind === 'saved' || st.kind === 'published') && settings.autoSkipDuplicates) return;
        if (st.kind === 'queued') return;
        list.push(rec.zpid);
      });
      return list;
    }

    async function scanAndSyncCards() {
      if (!active || !global.CP_Extractors || !global.CP_Extractors.extractZillowCardRefs) return;

      isFavoritesMode = Boolean(
        global.CP_Extractors.isZillowFavoritesPage &&
        global.CP_Extractors.isZillowFavoritesPage(location.href, document)
      );

      var searchCache = global.CP_Extractors.extractZillowSearchCache(document, location.href);
      var favData = (isFavoritesMode && global.CP_Extractors.extractZillowFavoritesData)
        ? global.CP_Extractors.extractZillowFavoritesData(document, location.href, document)
        : null;

      if (favData) {
        if (favData.totalCount && (!reportedFavoritesTotal || favData.totalCount > reportedFavoritesTotal)) {
          reportedFavoritesTotal = favData.totalCount;
        }
        if (favData.totalPages && favData.totalPages > favoritesTotalPages) {
          favoritesTotalPages = favData.totalPages;
        }
      }

      var cards = global.CP_Extractors.extractZillowCardRefs(document, location.href, searchCache);
      var zpids = [];
      var activeSet = new Set();

      cards.forEach(function (c) {
        if (!c || !c.zpid) return;
        activeSet.add(c.zpid);
        zpids.push(c.zpid);
        var existing = cardRecords.get(c.zpid);
        if (existing) {
          existing.card = c;
          existing.offscreen = false;
        } else {
          cardRecords.set(c.zpid, { zpid: c.zpid, card: c, offscreen: false, forceExplicit: false });
        }
      });

      if (favData && Array.isArray(favData.list)) {
        var addedFromFav = registerFavoritesItems(favData.list);
        addedFromFav.forEach(function (id) {
          activeSet.add(id);
          zpids.push(id);
        });
      }

      // Prune stale disconnected cards (keep offscreen favorites!)
      cardRecords.forEach(function (rec, zpid) {
        if (rec.offscreen) {
          zpids.push(zpid);
          return;
        }
        if (!activeSet.has(zpid) && (!rec.card.cardEl || !rec.card.cardEl.isConnected)) {
          cardRecords.delete(zpid);
          selectedZpids.delete(zpid);
        }
      });

      cardRecords.forEach(function (rec) {
        if (!rec.offscreen) injectPillIntoCard(rec);
      });
      updateHudSummary();

      if (zpids.length > 0) {
        var uniqueZpids = Array.from(new Set(zpids));
        await Promise.all([
          ensureProhibitedProfiles(false),
          runBatchPreCheck(uniqueZpids)
        ]);
        if (!active) return;
        cardRecords.forEach(function (rec) {
          if (!rec.offscreen) injectPillIntoCard(rec);
        });
        updateHudSummary();
      }

      if (isFavoritesMode && (favoritesTotalPages > 1 || (reportedFavoritesTotal && reportedFavoritesTotal > cardRecords.size))) {
        discoverAllFavorites();
      }
    }

    function scheduleScan(delay) {
      if (!active) return;
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(function () {
        scanTimer = null;
        scanAndSyncCards();
      }, delay == null ? 300 : delay);
    }

    function buildHudFolderLabel() {
      var def = ctx && ctx.getDefaultFolder ? ctx.getDefaultFolder() : null;
      if (!def || (!def.id && !def.name && !def.batch_id)) return 'Main Inbox (Default)';
      var isBatch = Boolean(def.is_disposable_batch || def.batch_id);
      return isBatch ? ('Batch #' + String(def.batch_id || def.name)) : String(def.name);
    }

    function renderHudFolderList() {
      if (!hudEl || !ctx) return;
      var listEl = hudEl.querySelector('#cp-hud-folder-list');
      if (!listEl) return;
      var def = ctx.getDefaultFolder ? ctx.getDefaultFolder() : null;
      var folders = ctx.getCachedFolders ? ctx.getCachedFolders() : [];
      var defId = def && def.id ? String(def.id) : '';
      var defBatch = def && def.batch_id ? String(def.batch_id) : '';

      var html = '<div class="cp-folder-option ' + (!defId && !defBatch ? 'cp-selected' : '') + '" data-folder-id="" data-folder-name="" data-batch-id="">' +
        '<span class="cp-folder-opt-icon">📥</span>' +
        '<div class="cp-folder-opt-text"><span class="cp-folder-opt-name">Main Inbox</span><span class="cp-folder-opt-sub">Unassigned imports</span></div>' +
        '<span class="cp-folder-opt-check">' + (!defId && !defBatch ? '✓' : '') + '</span>' +
      '</div>';

      folders.forEach(function (f) {
        if (!f || f.cleanup_state === 'deleted') return;
        var isB = Boolean(f.is_disposable_batch || f.batch_id);
        var isSel = (defId && String(f.id) === defId) || (defBatch && f.batch_id && String(f.batch_id) === defBatch);
        var displayName = isB ? ('Batch #' + (f.batch_id || f.name)) : String(f.name || 'Folder');
        html += '<div class="cp-folder-option ' + (isSel ? 'cp-selected' : '') + '" ' +
          'data-folder-id="' + escapeHtml(f.id || '') + '" ' +
          'data-folder-name="' + escapeHtml(f.name || '') + '" ' +
          'data-batch-id="' + escapeHtml(f.batch_id || '') + '" ' +
          'data-batch-uuid="' + escapeHtml(f.batch_uuid || '') + '" ' +
          'data-is-batch="' + (isB ? '1' : '0') + '">' +
          '<span class="cp-folder-opt-icon">' + (isB ? '📦' : escapeHtml(f.icon || '📁')) + '</span>' +
          '<div class="cp-folder-opt-text">' +
            '<span class="cp-folder-opt-name">' + escapeHtml(displayName) + '</span>' +
            (f.property_count != null ? '<span class="cp-folder-opt-sub">' + escapeHtml(String(f.property_count)) + ' listings</span>' : '') +
          '</div>' +
          '<span class="cp-folder-opt-check">' + (isSel ? '✓' : '') + '</span>' +
        '</div>';
      });
      listEl.innerHTML = html;

      listEl.querySelectorAll('.cp-folder-option').forEach(function (row) {
        row.addEventListener('click', function () {
          var fid = row.getAttribute('data-folder-id');
          var fname = row.getAttribute('data-folder-name');
          var fbatch = row.getAttribute('data-batch-id');
          var fbuuid = row.getAttribute('data-batch-uuid');
          var isB = row.getAttribute('data-is-batch') === '1';
          if (!fid && !fname && !fbatch) {
            ctx.setDefaultFolder(null);
          } else {
            ctx.setDefaultFolder({
              id: fid || null,
              name: fname || fbatch || '',
              batch_id: fbatch || null,
              batch_uuid: fbuuid || null,
              is_disposable_batch: isB,
              icon: isB ? '📦' : '📁'
            });
          }
          var pop = hudEl.querySelector('#cp-hud-folder-popover');
          if (pop) pop.classList.remove('cp-open');
          updateHudFolderPill();
          scheduleScan(30);
        });
      });
    }

    function updateHudFolderPill() {
      if (!hudEl) return;
      var def = ctx && ctx.getDefaultFolder ? ctx.getDefaultFolder() : null;
      var isB = Boolean(def && (def.is_disposable_batch || def.batch_id));
      var iconEl = hudEl.querySelector('#cp-hud-folder-icon');
      var nameEl = hudEl.querySelector('#cp-hud-folder-name');
      var triggerEl = hudEl.querySelector('#cp-hud-folder-pill');
      if (iconEl) iconEl.textContent = isB ? '📦' : '📁';
      if (nameEl) nameEl.textContent = buildHudFolderLabel();
      if (triggerEl) triggerEl.classList.toggle('cp-folder-active', Boolean(def && (def.id || def.name || def.batch_id)));
    }

    function renderFailedPanel() {
      if (!hudEl) return;
      var panel = hudEl.querySelector('#cp-hud-failed-panel');
      var summaryEl = hudEl.querySelector('#cp-hud-failed-summary');
      var listEl = hudEl.querySelector('#cp-hud-failed-list');
      var retryBtn = hudEl.querySelector('#cp-hud-retry-failed');
      if (!panel) return;

      if (failedRecords.size === 0) {
        panel.style.display = 'none';
        return;
      }

      panel.style.display = 'flex';
      if (summaryEl) {
        summaryEl.textContent = failedRecords.size + ' listing' + (failedRecords.size === 1 ? '' : 's') + ' failed (zero silent drops):';
      }
      if (retryBtn) {
        retryBtn.textContent = 'Retry Failed (' + failedRecords.size + ')';
      }
      if (listEl) {
        var entries = Array.from(failedRecords.values());
        var rowsHtml = entries.slice(0, 3).map(function (item) {
          return '<div class="cp-hud-failed-item">' +
            '<strong>' + escapeHtml(String(item.title).slice(0, 28)) + ':</strong> ' +
            escapeHtml(String(item.reason).slice(0, 64)) +
          '</div>';
        }).join('');
        if (entries.length > 3) {
          rowsHtml += '<div class="cp-hud-failed-more">+ ' + (entries.length - 3) + ' more — click Retry Failed</div>';
        }
        listEl.innerHTML = rowsHtml;
      }
    }

    function updateHudSummary() {
      if (!hudEl) return;
      var unsaved = countUnsavedAll();
      var detectedTotal = cardRecords.size;
      var displayTotal = (isFavoritesMode && reportedFavoritesTotal && reportedFavoritesTotal > detectedTotal)
        ? reportedFavoritesTotal
        : detectedTotal;
      var activeCount = activeWorkers + queue.length + pendingBatch.length;

      var countEl = hudEl.querySelector('#cp-hud-stats');
      var titleEl = hudEl.querySelector('#cp-hud-title-text');
      var saveAllBtn = hudEl.querySelector('#cp-hud-save-visible');
      var saveSelBtn = hudEl.querySelector('#cp-hud-save-selected');
      var stopBtn = hudEl.querySelector('#cp-hud-stop');
      var progWrap = hudEl.querySelector('#cp-hud-progress');
      var progFill = hudEl.querySelector('#cp-hud-progress-fill');
      var progText = hudEl.querySelector('#cp-hud-progress-text');
      var miniLabel = hudEl.querySelector('#cp-hud-mini-label');

      if (titleEl) {
        titleEl.textContent = isFavoritesMode ? 'Choice Favorites Saver' : 'Choice Search Saver';
      }

      if (countEl) {
        if (isFavoritesMode) {
          var statusNote = favoritesDiscovering ? ' (scanning pages…)' : '';
          countEl.textContent = '★ Favorites: ' + displayTotal + ' total • ' + unsaved.length + ' unsaved' +
            (stats.saved > 0 ? ' • ' + stats.saved + ' saved' : '') + statusNote;
        } else {
          countEl.textContent = detectedTotal + ' cards • ' + unsaved.length + ' unsaved' +
            (stats.saved > 0 ? ' • ' + stats.saved + ' saved' : '');
        }
      }
      if (miniLabel) {
        miniLabel.textContent = activeCount > 0
          ? ('Saving ' + activeCount + '…')
          : ((isFavoritesMode ? 'Favorites (' : 'Search Saver (') + unsaved.length + ')');
      }
      if (saveAllBtn) {
        saveAllBtn.textContent = isFavoritesMode
          ? ('Save All Unsaved (' + unsaved.length + ')')
          : ('Save Unsaved (' + unsaved.length + ')');
        saveAllBtn.disabled = unsaved.length === 0;
      }
      if (saveSelBtn) {
        if (selectedZpids.size > 0) {
          saveSelBtn.style.display = 'inline-flex';
          saveSelBtn.textContent = 'Save Selected (' + selectedZpids.size + ')';
        } else {
          saveSelBtn.style.display = 'none';
        }
      }
      if (stopBtn) {
        stopBtn.style.display = activeCount > 0 ? 'inline-flex' : 'none';
      }
      if (progWrap && progFill && progText) {
        if (activeCount > 0 || (stats.totalQueued > 0 && stats.completed < stats.totalQueued)) {
          progWrap.style.display = 'flex';
          var pct = stats.totalQueued > 0 ? Math.min(100, Math.round((stats.completed / stats.totalQueued) * 100)) : 0;
          progFill.style.width = pct + '%';
          progText.textContent = 'Hydrating & batching ' + stats.completed + '/' + stats.totalQueued +
            (last429Until > Date.now() ? ' (adaptive backoff…)' : '');
        } else {
          progWrap.style.display = 'none';
        }
      }
      renderFailedPanel();
    }

    function clampHudToViewport(el) {
      if (!el || !el.isConnected) return;
      if (!el._userPositioned) return;
      var rect = el.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth || 1024;
      var vh = window.innerHeight || document.documentElement.clientHeight || 768;
      var maxLeft = Math.max(8, vw - rect.width - 8);
      var maxTop = Math.max(8, vh - rect.height - 8);
      var clampedLeft = Math.min(Math.max(8, rect.left), maxLeft);
      var clampedTop = Math.min(Math.max(8, rect.top), maxTop);
      el.style.left = clampedLeft + 'px';
      el.style.top = clampedTop + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }

    function restoreHudPosition(el) {
      if (!el) return;
      try {
        var raw = localStorage.getItem(HUD_POS_KEY);
        if (!raw) return;
        var pos = JSON.parse(raw);
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
          el._userPositioned = true;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          el.style.left = pos.left + 'px';
          el.style.top = pos.top + 'px';
          requestAnimationFrame(function () { clampHudToViewport(el); });
        }
      } catch (_) {}
    }

    function persistHudPosition(el) {
      if (!el || !el._userPositioned) return;
      try {
        var rect = el.getBoundingClientRect();
        localStorage.setItem(HUD_POS_KEY, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
      } catch (_) {}
    }

    function attachHudDraggable(el) {
      if (!el) return function () {};
      var header = el.querySelector('#cp-hud-header');
      var miniTrigger = el.querySelector('#cp-hud-mini-trigger');
      var dragging = false;
      var movedBeyondThreshold = false;
      var startX = 0, startY = 0;
      var initLeft = 0, initTop = 0;
      var suppressClickUntil = 0;

      function beginDrag(clientX, clientY, target) {
        if (target && target.closest('.cp-header-btn, button, input, select, textarea, a')) return false;
        dragging = true;
        movedBeyondThreshold = false;
        startX = clientX;
        startY = clientY;
        var rect = el.getBoundingClientRect();
        initLeft = rect.left;
        initTop = rect.top;
        return true;
      }

      function moveDrag(clientX, clientY) {
        if (!dragging) return false;
        var dx = clientX - startX;
        var dy = clientY - startY;
        if (!movedBeyondThreshold) {
          if (Math.hypot(dx, dy) < 6) return false;
          movedBeyondThreshold = true;
          el.classList.add('cp-dragging');
          el.style.transition = 'none';
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          el.style.left = initLeft + 'px';
          el.style.top = initTop + 'px';
          el._userPositioned = true;
        }
        var rect = el.getBoundingClientRect();
        var vw = window.innerWidth || document.documentElement.clientWidth || 1024;
        var vh = window.innerHeight || document.documentElement.clientHeight || 768;
        var maxLeft = Math.max(8, vw - rect.width - 8);
        var maxTop = Math.max(8, vh - rect.height - 8);
        el.style.left = Math.min(Math.max(8, initLeft + dx), maxLeft) + 'px';
        el.style.top = Math.min(Math.max(8, initTop + dy), maxTop) + 'px';
        return true;
      }

      function endDrag() {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('cp-dragging');
        el.style.transition = '';
        if (movedBeyondThreshold) {
          suppressClickUntil = Date.now() + 260;
          persistHudPosition(el);
        }
        movedBeyondThreshold = false;
      }

      function onMouseDown(e) {
        if (e.button !== 0) return;
        beginDrag(e.clientX, e.clientY, e.target);
      }

      function onTouchStart(e) {
        if (e.touches && e.touches.length === 1) {
          beginDrag(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }
      }

      function onMouseMove(e) {
        if (dragging && moveDrag(e.clientX, e.clientY)) {
          e.preventDefault();
        }
      }

      function onTouchMove(e) {
        if (dragging && e.touches && e.touches.length === 1) {
          if (moveDrag(e.touches[0].clientX, e.touches[0].clientY)) {
            e.preventDefault();
          }
        }
      }

      function onResize() {
        clampHudToViewport(el);
      }

      if (header) {
        header.addEventListener('mousedown', onMouseDown);
        header.addEventListener('touchstart', onTouchStart, { passive: true });
      }
      if (miniTrigger) {
        miniTrigger.addEventListener('mousedown', onMouseDown);
        miniTrigger.addEventListener('touchstart', onTouchStart, { passive: true });
        miniTrigger.addEventListener('click', function (e) {
          if (Date.now() < suppressClickUntil) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }, true);
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchend', endDrag);
      window.addEventListener('resize', onResize);

      return function cleanup() {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('mouseup', endDrag);
        window.removeEventListener('touchend', endDrag);
        window.removeEventListener('resize', onResize);
      };
    }

    function mountHud() {
      if (hudEl) return;
      var el = document.createElement('div');
      el.id = 'cp-search-hud';
      el.innerHTML =
        '<div class="cp-hud-mini" id="cp-hud-mini-trigger" title="Drag to move or tap to expand">' +
          '<span class="cp-hud-dot"></span>' +
          '<span id="cp-hud-mini-label">Search Saver (0)</span>' +
        '</div>' +
        '<div class="cp-hud-body">' +
          '<div class="cp-hud-header" id="cp-hud-header" title="Drag to move anywhere on screen">' +
            '<div class="cp-hud-title-row">' +
              '<span class="cp-drag-grip" title="Drag to move">⠿</span>' +
              '<span class="cp-hud-dot"></span>' +
              '<span id="cp-hud-title-text">Choice Search Saver</span>' +
              '<span class="cp-badge-verified">v' + escapeHtml(ctx ? ctx.VERSION : '36.0.0') + '</span>' +
            '</div>' +
            '<div class="cp-header-badges">' +
              '<button type="button" class="cp-header-btn" id="cp-hud-btn-min" title="Minimize">_</button>' +
              '<button type="button" class="cp-header-btn" id="cp-hud-btn-close" title="Hide Search Saver">×</button>' +
            '</div>' +
          '</div>' +
          '<div class="cp-hud-content">' +
            '<div class="cp-hud-stats" id="cp-hud-stats">Scanning Zillow cards…</div>' +
            '<div class="cp-folder-bar" style="margin-bottom:8px">' +
              '<button type="button" class="cp-folder-pill-trigger" id="cp-hud-folder-pill">' +
                '<div class="cp-folder-pill-left">' +
                  '<span class="cp-folder-pill-icon" id="cp-hud-folder-icon">📁</span>' +
                  '<div class="cp-folder-pill-text">' +
                    '<span class="cp-folder-pill-label">Target:</span>' +
                    '<span class="cp-folder-pill-name" id="cp-hud-folder-name">Main Inbox</span>' +
                  '</div>' +
                '</div>' +
                '<span class="cp-folder-pill-action">Switch ▾</span>' +
              '</button>' +
              '<div class="cp-folder-popover" id="cp-hud-folder-popover">' +
                '<div class="cp-folder-popover-header">' +
                  '<span class="cp-folder-popover-title">Target Pipeline Batch / Folder</span>' +
                  '<button type="button" class="cp-folder-popover-close" id="cp-hud-popover-close">×</button>' +
                '</div>' +
                '<div class="cp-folder-list" id="cp-hud-folder-list"></div>' +
                '<div class="cp-folder-divider"></div>' +
                '<button type="button" class="cp-folder-create-toggle" id="cp-hud-create-toggle">+ Create Batch / Folder</button>' +
                '<div class="cp-folder-create-form" id="cp-hud-create-form">' +
                  '<input type="text" id="cp-hud-new-folder-name" class="cp-folder-input" placeholder="4-digit Batch (e.g. 4821) or Folder" autocomplete="off" />' +
                  '<div id="cp-hud-folder-err" style="display:none;font-size:11px;color:#fca5a5"></div>' +
                  '<div class="cp-folder-form-actions">' +
                    '<button type="button" class="cp-folder-btn-cancel" id="cp-hud-folder-cancel">Cancel</button>' +
                    '<button type="button" class="cp-folder-btn-submit" id="cp-hud-folder-submit">Create</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="cp-hud-toggles">' +
              '<label class="cp-hud-chk"><input type="checkbox" id="cp-hud-skip-sale" ' + (settings.autoSkipForSale ? 'checked' : '') + '><span>Skip For-Sale</span></label>' +
              '<label class="cp-hud-chk"><input type="checkbox" id="cp-hud-skip-dupes" ' + (settings.autoSkipDuplicates ? 'checked' : '') + '><span>Skip In-Batch</span></label>' +
              '<label class="cp-hud-chk"><input type="checkbox" id="cp-hud-skip-proh" ' + (settings.autoSkipProhibited ? 'checked' : '') + '><span>Skip Blocked</span></label>' +
            '</div>' +
            '<div class="cp-hud-progress" id="cp-hud-progress" style="display:none">' +
              '<span class="cp-hud-progress-text" id="cp-hud-progress-text">Hydrating…</span>' +
              '<div class="cp-progress-bar-track"><div class="cp-progress-bar-fill" id="cp-hud-progress-fill"></div></div>' +
            '</div>' +
            '<div class="cp-hud-failed-panel" id="cp-hud-failed-panel" style="display:none">' +
              '<div class="cp-hud-failed-header">' +
                '<span id="cp-hud-failed-summary">Some listings failed</span>' +
                '<button type="button" class="cp-hud-btn-dismiss" id="cp-hud-clear-failed">Dismiss</button>' +
              '</div>' +
              '<div class="cp-hud-failed-list" id="cp-hud-failed-list"></div>' +
              '<button type="button" class="cp-hud-btn-retry" id="cp-hud-retry-failed">Retry Failed (0)</button>' +
            '</div>' +
            '<div class="cp-hud-actions">' +
              '<button type="button" class="cp-hud-btn-primary" id="cp-hud-save-visible">Save Unsaved (0)</button>' +
              '<button type="button" class="cp-hud-btn-secondary" id="cp-hud-save-selected" style="display:none">Save Selected (0)</button>' +
              '<button type="button" class="cp-hud-btn-stop" id="cp-hud-stop" style="display:none">Stop</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.body.appendChild(el);
      hudEl = el;
      restoreHudPosition(el);
      hudDragCleanup = attachHudDraggable(el);
      updateHudFolderPill();
      renderHudFolderList();

      // Wire events
      el.querySelector('#cp-hud-btn-min').addEventListener('click', function () {
        hudMinimized = true;
        el.classList.add('cp-hud-minimized');
        requestAnimationFrame(function () { clampHudToViewport(el); });
      });
      el.querySelector('#cp-hud-mini-trigger').addEventListener('click', function () {
        hudMinimized = false;
        el.classList.remove('cp-hud-minimized');
        requestAnimationFrame(function () { clampHudToViewport(el); });
      });
      el.querySelector('#cp-hud-btn-close').addEventListener('click', function () {
        el.style.display = 'none';
      });
      el.querySelector('#cp-hud-save-visible').addEventListener('click', async function () {
        if (isFavoritesMode && favoritesDiscoveryPromise) {
          try { await favoritesDiscoveryPromise; } catch (_) {}
        }
        var list = countUnsavedAll();
        if (list.length > 0) enqueueSave(list, false);
      });
      el.querySelector('#cp-hud-save-selected').addEventListener('click', function () {
        var list = Array.from(selectedZpids);
        if (list.length > 0) enqueueSave(list, true);
      });
      el.querySelector('#cp-hud-retry-failed').addEventListener('click', function () {
        var retryIds = Array.from(failedRecords.keys());
        if (retryIds.length > 0) enqueueSave(retryIds, true);
      });
      el.querySelector('#cp-hud-clear-failed').addEventListener('click', function () {
        failedRecords.clear();
        stats.failed = 0;
        updateHudSummary();
      });
      el.querySelector('#cp-hud-stop').addEventListener('click', function () {
        queueStopped = true;
        queue = [];
        updateHudSummary();
      });

      el.querySelector('#cp-hud-skip-sale').addEventListener('change', function (e) {
        saveSettings({ autoSkipForSale: e.target.checked }).then(function () { scheduleScan(20); });
      });
      el.querySelector('#cp-hud-skip-dupes').addEventListener('change', function (e) {
        saveSettings({ autoSkipDuplicates: e.target.checked }).then(function () { scheduleScan(20); });
      });
      el.querySelector('#cp-hud-skip-proh').addEventListener('change', function (e) {
        saveSettings({ autoSkipProhibited: e.target.checked }).then(function () { scheduleScan(20); });
      });

      // Folder popover controls
      var pop = el.querySelector('#cp-hud-folder-popover');
      el.querySelector('#cp-hud-folder-pill').addEventListener('click', function () {
        pop.classList.toggle('cp-open');
        if (pop.classList.contains('cp-open') && ctx && ctx.apiListFolders) {
          ctx.apiListFolders().then(function (list) {
            if (Array.isArray(list)) {
              ctx.setCachedFolders(list);
              renderHudFolderList();
            }
          });
        }
      });
      el.querySelector('#cp-hud-popover-close').addEventListener('click', function () {
        pop.classList.remove('cp-open');
      });
      var createForm = el.querySelector('#cp-hud-create-form');
      el.querySelector('#cp-hud-create-toggle').addEventListener('click', function () {
        createForm.style.display = createForm.style.display === 'flex' ? 'none' : 'flex';
      });
      el.querySelector('#cp-hud-folder-cancel').addEventListener('click', function () {
        createForm.style.display = 'none';
      });
      el.querySelector('#cp-hud-folder-submit').addEventListener('click', async function () {
        var inp = el.querySelector('#cp-hud-new-folder-name');
        var errBox = el.querySelector('#cp-hud-folder-err');
        var nameVal = (inp.value || '').trim();
        if (!nameVal) {
          errBox.textContent = 'Enter a folder name or 4-digit batch ID';
          errBox.style.display = 'block';
          return;
        }
        errBox.style.display = 'none';
        try {
          var created = await ctx.apiCreateFolder(nameVal, '');
          if (created && created.id) {
            ctx.setDefaultFolder(created);
            var existing = ctx.getCachedFolders() || [];
            ctx.setCachedFolders([created].concat(existing.filter(function (x) { return x && x.id !== created.id; })));
            renderHudFolderList();
            updateHudFolderPill();
            createForm.style.display = 'none';
            pop.classList.remove('cp-open');
            inp.value = '';
            scheduleScan(20);
          }
        } catch (err) {
          errBox.textContent = err && err.message ? err.message : 'Failed to create folder';
          errBox.style.display = 'block';
        }
      });

      if (ctx && ctx.apiListFolders) {
        ctx.apiListFolders().then(function (list) {
          if (Array.isArray(list)) {
            ctx.setCachedFolders(list);
            renderHudFolderList();
            updateHudFolderPill();
          }
        });
      }
    }

    function unmountHud() {
      if (hudDragCleanup) {
        try { hudDragCleanup(); } catch (_) {}
        hudDragCleanup = null;
      }
      if (hudEl) {
        hudEl.remove();
        hudEl = null;
      }
    }

    async function start(userCtx) {
      ctx = userCtx;
      adaptiveConcurrency = getBaseConcurrency();
      if (active) {
        updateHudFolderPill();
        renderHudFolderList();
        scheduleScan(120);
        return;
      }
      active = true;
      await loadSettings();
      mountHud();

      if (document.body && !mutationObserver) {
        mutationObserver = new MutationObserver(function (records) {
          if (!active) return;
          var relevant = records.some(function (r) {
            if (r.target && r.target.closest && (r.target.closest('#cp-search-hud') || r.target.closest('.cp-card-pill-wrap'))) {
              return false;
            }
            var nodes = Array.from(r.addedNodes || []);
            return nodes.some(function (n) {
              return n.nodeType === 1 && !n.closest('#cp-search-hud') && !n.closest('.cp-card-pill-wrap');
            });
          });
          if (relevant) scheduleScan(320);
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      }

      scheduleScan(100);
    }

    function stop() {
      active = false;
      queueStopped = true;
      queue = [];
      pendingBatch = [];
      if (batchFlushTimer) { clearTimeout(batchFlushTimer); batchFlushTimer = null; }
      if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      document.querySelectorAll('.cp-card-pill-wrap').forEach(function (w) { w.remove(); });
      cardRecords.clear();
      selectedZpids.clear();
      failedRecords.clear();
      favoritesDiscovering = false;
      favoritesDiscoveryPromise = null;
      favoritesDiscoveredForUrl = '';
      reportedFavoritesTotal = null;
      favoritesTotalPages = 1;
      unmountHud();
    }

    return {
      start: start,
      stop: stop,
      refreshCards: function () { scheduleScan(50); },
      syncSettings: function (nextSettings) {
        settings = Object.assign({}, DEFAULT_SETTINGS, nextSettings || {});
        if (hudEl) {
          var s1 = hudEl.querySelector('#cp-hud-skip-sale');
          var s2 = hudEl.querySelector('#cp-hud-skip-dupes');
          var s3 = hudEl.querySelector('#cp-hud-skip-proh');
          if (s1) s1.checked = settings.autoSkipForSale;
          if (s2) s2.checked = settings.autoSkipDuplicates;
          if (s3) s3.checked = settings.autoSkipProhibited;
        }
        scheduleScan(20);
      },
      syncScope: function () {
        updateHudFolderPill();
        renderHudFolderList();
        scheduleScan(20);
      },
      _testHooks: {
        buildSubmitPayload: buildSubmitPayload,
        computeCardVisualState: computeCardVisualState,
        isLosslessHdpPayload: isLosslessHdpPayload,
        countUnsavedAll: countUnsavedAll,
        registerFavoritesItems: registerFavoritesItems,
        applySubmissionResult: applySubmissionResult,
        getFailedRecords: function () { return Array.from(failedRecords.values()); },
        clearFailedRecords: function () { failedRecords.clear(); stats.failed = 0; },
        setFavoritesState: function (opts) {
          if (!opts) return;
          if ('isFavoritesMode' in opts) isFavoritesMode = Boolean(opts.isFavoritesMode);
          if ('reportedTotal' in opts) reportedFavoritesTotal = opts.reportedTotal;
        },
        setProhibitedProfiles: function (list) { prohibitedProfiles = list || []; prohibitedFetchedAt = Date.now(); },
        setBatchCheckCache: function (map) { batchCheckCache = map || {}; },
        setContext: function (c) { ctx = c; },
        getSettings: function () { return Object.assign({}, settings); }
      }
    };
  }

  var engine = createEngine();
  global.CP_CardEngine = engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine: createEngine };
})(typeof globalThis !== 'undefined' ? globalThis : this);
