'use strict';
const assert = require('assert');
const api = require('./shared-extractors.js');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('OK   ' + n); } catch (e) { fail++; console.error('FAIL ' + n + ' - ' + e.message); } };

const doc = (o) => ({ getElementById: (id) => id === '__NEXT_DATA__' ? { textContent: JSON.stringify(o) } : null, querySelectorAll: () => [] });
const cache = (p) => ({ props: { pageProps: { componentProps: { gdpClientCache: JSON.stringify({ k: { property: p } }) } } } });

// --- Fixtures ---
const Z = 'https://www.zillow.com/homedetails/123-Main-St-Dallas-TX-75201/98765432_zpid/';
const ZD = doc(cache({ zpid: 98765432, address: { streetAddress: '123 Main St', city: 'Dallas', state: 'TX', zipcode: '75201' }, price: 1850, bedrooms: 3, bathrooms: 2, livingArea: 1450, yearBuilt: 1998, homeType: 'SINGLE_FAMILY', isPetFriendly: true, walkScore: 78, responsivePhotos: [{ mixedSources: { jpeg: [{ width: 1024, url: 'https://photos.zillowstatic.com/fp/1.jpg' }] } }], attributionInfo: { agentName: 'Jane Agent' }, resoFacts: { dateAvailable: '2026-09-01', securityDeposit: 1850, petsAllowed: true } }));

const R = 'https://www.realtor.com/realestateandhomes-detail/456-Oak-Ave_Austin_TX_78701/M1012345678';
const RD = doc({ props: { pageProps: { initialReduxState: { propertyDetails: { property_id: '1012345678', address: { line: '456 Oak Ave', city: 'Austin', state_code: 'TX', postal_code: '78701' }, price: 2200, beds: 2, baths: 2, sqft: 1100, prop_type: 'condo', photos: [{ href: 'https://ar.rdcpix.com/p1.jpg' }], primary_photo: { href: 'https://ar.rdcpix.com/primary.jpg' } } } } } });

const A = 'https://www.apartments.com/sunset-apartments-houston-tx/abc123/';
const AD = doc({ props: { pageProps: { listing: { id: 'abc123', address: { street: '789 Pine St', city: 'Houston', state: 'TX', zip: '77002' }, price: 1500, bedrooms: 1, bathrooms: 1, squareFeet: 750, photos: [{ url: 'https://images1.apartments.com/a1.jpg' }], petsAllowed: true, availableDate: '2026-07-15' } } } });

const F = 'https://www.redfin.com/TX/Plano/101-Maple-Dr-75074/home/123456789';
const FD = doc({
  props: {
    pageProps: {
      initialReduxState: {
        searchResults: {
          homeDetails: {
            propertyId: 123456789,
            address: { streetAddress: '101 Maple Dr', city: 'Plano', state: 'TX', zip: '75074' },
            beds: 4, baths: 3, sqft: 2100, rent: 2300, propertyType: 'SINGLE_FAMILY',
            photos: [{ url: 'https://ssl.cdn-redfin.com/f1.jpg' }]
          }
        }
      }
    }
  }
});

// --- Tests ---
console.log('CP_Extractors tests\n');
t('detect Zillow', () => assert.strictEqual(api.detect(Z).id, 'zillow'));
t('detect Realtor', () => assert.strictEqual(api.detect(R).id, 'realtor'));
t('detect Apartments', () => assert.strictEqual(api.detect(A).id, 'apartments'));
t('detect Redfin', () => assert.strictEqual(api.detect(F).id, 'redfin'));
t('detect null', () => assert.strictEqual(api.detect('https://fb.com/'), null));
t('Zillow payload', () => { const p = api.extractZillow(ZD, Z); assert.strictEqual(p.source_listing_id, '98765432'); assert.strictEqual(p.address, '123 Main St'); assert.strictEqual(p.monthly_rent, 1850); assert.strictEqual(p.bedrooms, 3); assert.strictEqual(p.bathrooms, 2); assert.strictEqual(p.square_footage, 1450); assert.strictEqual(p.property_type, 'SINGLE_FAMILY'); assert.strictEqual(p.pets_allowed, true); assert.strictEqual(p.available_date, '2026-09-01'); assert.strictEqual(p.minimum_lease_months, null); assert.strictEqual(p.smoking_allowed, null); assert.strictEqual(p.security_deposit, 1850); assert.ok(p.location_context.includes('Walk score: 78')); assert.strictEqual(JSON.parse(p.original_image_urls).length, 1); assert.strictEqual(p.agent_name, 'Jane Agent'); });
t('Realtor payload', () => { const p = api.extractRealtor(RD, R); assert.strictEqual(p.source_listing_id, '1012345678'); assert.strictEqual(p.address, '456 Oak Ave'); assert.strictEqual(p.state, 'TX'); assert.strictEqual(p.monthly_rent, 2200); assert.strictEqual(p.bedrooms, 2); assert.strictEqual(p.property_type, 'CONDOS'); const ph = JSON.parse(p.original_image_urls); assert.strictEqual(ph.length, 2); assert.ok(ph[0].includes('primary')); });
t('Apartments payload', () => { const p = api.extractApartments(AD, A); assert.strictEqual(p.source_listing_id, 'abc123'); assert.strictEqual(p.address, '789 Pine St'); assert.strictEqual(p.monthly_rent, 1500); assert.strictEqual(p.property_type, 'APARTMENT'); assert.strictEqual(p.pets_allowed, true); assert.strictEqual(p.available_date, '2026-07-15'); assert.strictEqual(JSON.parse(p.original_image_urls).length, 1); });
t('Redfin payload', () => { const p = api.extractRedfin(FD, F); assert.strictEqual(p.source_listing_id, '123456789'); assert.strictEqual(p.address, '101 Maple Dr'); assert.strictEqual(p.monthly_rent, 2300); assert.strictEqual(p.bedrooms, 4); assert.strictEqual(p.bathrooms, 3); assert.strictEqual(p.property_type, 'SINGLE_FAMILY'); assert.strictEqual(JSON.parse(p.original_image_urls).length, 1); });
t('dispatch', () => { assert.strictEqual(api.extract(Z, ZD).source, 'zillow'); assert.strictEqual(api.extract('https://fb.com/', doc({})), null); });
t('Zillow minimal', () => { const d = doc(cache({ zpid: 111, address: { streetAddress: '1 Empty St', city: 'Nowhere', state: 'TX' }, price: 1000 })); const p = api.extractZillow(d, Z); assert.ok(p); assert.strictEqual(p.monthly_rent, 1000); assert.strictEqual(p.bedrooms, null); assert.strictEqual(p.security_deposit, null); });
t('Zillow does not substitute Zestimate for asking rent or treat unknown features as false', () => {
  const d = doc(cache({ zpid: 222, address: { streetAddress: '2 Unknown St', city: 'Nowhere', state: 'TX' }, rentZestimate: 1750 }));
  const p = api.extractZillow(d, Z);
  assert.strictEqual(p.monthly_rent, null);
  assert.strictEqual(p.has_basement, null);
  assert.strictEqual(p.has_central_air, null);
});
t('Zillow distinguishes no basement and non-central cooling from unknown features', () => {
  const d = doc(cache({
    zpid: 223,
    address: { streetAddress: '3 Known St', city: 'Nowhere', state: 'TX' },
    resoFacts: { basement: 'No basement', hasCooling: true, cooling: ['Window units'] },
  }));
  const p = api.extractZillow(d, Z);
  assert.strictEqual(p.has_basement, false);
  assert.strictEqual(p.has_central_air, false);
});

// --- Photo dedup ---
const ZDUP = doc(cache({
  zpid: 98765432,
  address: { streetAddress: '123 Main St', city: 'Dallas', state: 'TX', zipcode: '75201' },
  price: 1850, bedrooms: 3, bathrooms: 2, livingArea: 1450, yearBuilt: 1998,
  homeType: 'SINGLE_FAMILY',
  responsivePhotos: [
    { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/aaa111bbb222ccc333ddd444eee555fff-uncropped_scaled_within_1536_1152.jpg' }] } },
    { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/aaa111bbb222ccc333ddd444eee555fff-cc_ft_1536.jpg' }] } },
    { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/aaa111bbb222ccc333ddd444eee555fff-p_h.jpg' }] } },
    { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/9ce6ff107193275cd385d1332a79ba02-uncropped_scaled_within_1536_1152.jpg' }] } },
    { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/9ce6ff107193275cd385d1332a79ba02-cc_ft_1536.jpg' }] } },
  ],
}));
t('Zillow photo dedup', () => {
  const p = api.extractZillow(ZDUP, Z);
  const urls = JSON.parse(p.original_image_urls);
  assert.strictEqual(urls.length, 2, 'should dedup 5 URLs to 2 unique hashes');
  assert.ok(urls[0].includes('uncropped_scaled_within_1536_1152'), 'should keep highest-res variant');
  assert.ok(urls[1].includes('uncropped_scaled_within_1536_1152'), 'should keep highest-res variant for 2nd hash');
});

// --- Source URL validation ---
const ZBAD = 'https://www.zillow.com/homedetails/8907-Meadow-Vista-Blvd-Houston-TX-77064/439698245_zpid/';
const ZGOOD = 'https://www.zillow.com/homedetails/123-Main-St-Dallas-TX-75201/98765432_zpid/';
t('Zillow URL zpid mismatch fix', () => {
  const p = api.extractZillow(ZD, ZBAD);
  assert.ok(p.source_url.includes('98765432_zpid'), 'should rebuild URL with data zpid, got: ' + p.source_url);
  assert.ok(!p.source_url.includes('439698245'), 'should not keep stale zpid');
});
t('Zillow URL zpid match passthrough', () => {
  const p = api.extractZillow(ZD, ZGOOD);
  assert.strictEqual(p.source_url, ZGOOD, 'should keep URL when zpid matches');
});

t('Zillow accepts 4+ photos in Tier-1 NextData without noisy DOM image scraping', () => {
  const fourPhotoDoc = {
    body: { innerText: '3 bd 2 ba 1,500 sqft' },
    getElementById: (id) => id === '__NEXT_DATA__' ? {
      textContent: JSON.stringify(cache({
        zpid: 77889900,
        address: { streetAddress: '400 Four Photo Way', city: 'Charlotte', state: 'NC', zipcode: '28202' },
        price: 1650,
        bedrooms: 3,
        bathrooms: 2,
        livingArea: 1500,
        homeType: 'SINGLE_FAMILY',
        responsivePhotos: [
          { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/11111111111111111111111111111111-cc_ft_1536.jpg' }] } },
          { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/22222222222222222222222222222222-cc_ft_1536.jpg' }] } },
          { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/33333333333333333333333333333333-cc_ft_1536.jpg' }] } },
          { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/44444444444444444444444444444444-cc_ft_1536.jpg' }] } },
        ],
      }))
    } : null,
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (String(sel).includes('zillowstatic.com')) {
        return [
          { src: 'https://photos.zillowstatic.com/fp/99999999999999999999999999999991-cc_ft_1536.jpg', getAttribute: () => null },
          { src: 'https://photos.zillowstatic.com/fp/99999999999999999999999999999992-cc_ft_1536.jpg', getAttribute: () => null },
          { src: 'https://photos.zillowstatic.com/fp/99999999999999999999999999999993-cc_ft_1536.jpg', getAttribute: () => null },
          { src: 'https://photos.zillowstatic.com/fp/99999999999999999999999999999994-cc_ft_1536.jpg', getAttribute: () => null },
          { src: 'https://photos.zillowstatic.com/fp/99999999999999999999999999999995-cc_ft_1536.jpg', getAttribute: () => null },
        ];
      }
      return [];
    },
  };
  const p = api.extractZillow(fourPhotoDoc, 'https://www.zillow.com/homedetails/400-Four-Photo-Way-Charlotte-NC-28202/77889900_zpid/');
  assert.ok(p);
  const urls = JSON.parse(p.original_image_urls);
  assert.strictEqual(urls.length, 4);
  assert.ok(urls[0].includes('11111111111111111111111111111111'));
  assert.ok(!urls.some(u => u.includes('9999999999999999999999999999999')), 'must not fall back to unrelated DOM photos when 4 NextData photos exist');
});

// --- Search-Card Extraction & Zero-Tab Hydration Tests ---
t('Zillow search URL detection distinguishes search grid from HDP detail page', () => {
  assert.strictEqual(api.isZillowSearchUrl('https://www.zillow.com/dallas-tx/rentals/', null), true);
  assert.strictEqual(api.isZillowSearchUrl('https://www.zillow.com/homes/for_rent/', null), true);
  assert.strictEqual(api.isZillowSearchUrl('https://www.zillow.com/myzillow/savedhomes', null), true);
  assert.strictEqual(api.isZillowSearchUrl('https://www.zillow.com/homedetails/123-Main-St/98765432_zpid/', null), false);
});

t('extractZillowFromHtml parses SSR __NEXT_DATA__ and detects challenge HTML', () => {
  const ssrHtml = '<html><body><script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify(cache({
      zpid: 44556677,
      homeStatus: 'FOR_RENT',
      address: { streetAddress: '210 Birch Rd', city: 'Edmond', state: 'OK', zipcode: '73034' },
      price: 1995,
      bedrooms: 3,
      bathrooms: 2.5,
      livingArea: 1740,
      homeType: 'SINGLE_FAMILY',
      description: 'Clean brick home in Edmond with 2.5 baths and fenced yard.',
      responsivePhotos: [
        { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/11112222333344445555666677778801-uncropped_scaled_within_1536_1152.jpg' }] } },
        { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/11112222333344445555666677778802-uncropped_scaled_within_1536_1152.jpg' }] } }
      ]
    })) + '</script></body></html>';
  const ext = api.extractZillowFromHtml(ssrHtml, 'https://www.zillow.com/homedetails/210-Birch-Rd-Edmond-OK-73034/44556677_zpid/');
  assert.ok(ext && !ext._blocked);
  assert.strictEqual(ext.source_listing_id, '44556677');
  assert.strictEqual(ext.bathrooms, 2.5);
  assert.strictEqual(ext.half_bathrooms, 1);

  const blocked = api.extractZillowFromHtml('<html><title>Access to this page has been denied</title><div>px-captcha</div></html>', 'https://www.zillow.com/homedetails/1_zpid/');
  assert.ok(blocked && blocked._blocked === true);
});

t('evaluateZillowEligibility screens FOR_SALE, prohibited profiles, and low photo warnings', () => {
  const rules = [{
    canonical_name: 'Bad Actor Properties',
    aliases: ['Bad Actor PM'],
    zillow_profile_urls: ['https://www.zillow.com/profile/Bad-Actor-Profile'],
    match_mode: 'token_phrase'
  }];
  const saleRes = api.evaluateZillowEligibility({ source_status: 'FOR_SALE', monthly_rent: 300000, description: 'For sale home' }, rules);
  assert.strictEqual(saleRes.eligible, false);
  assert.strictEqual(saleRes.isNonRental, true);

  const prohRes = api.evaluateZillowEligibility({
    source_status: 'FOR_RENT',
    monthly_rent: 1650,
    broker_name: 'Listed by Bad Actor PM LLC',
    description: 'Nice rental'
  }, rules);
  assert.strictEqual(prohRes.eligible, false);
  assert.strictEqual(prohRes.prohibitedMatch.matched, true);

  const okLowPhotoRes = api.evaluateZillowEligibility({
    source_status: 'FOR_RENT',
    monthly_rent: 1500,
    description: 'Good rental home',
    original_image_urls: JSON.stringify(['https://photos.zillowstatic.com/fp/1.jpg', 'https://photos.zillowstatic.com/fp/2.jpg'])
  }, rules);
  assert.strictEqual(okLowPhotoRes.eligible, true);
  assert.strictEqual(okLowPhotoRes.lowPhotoCount, true);
});

t('resolveResoBaths reconstructs 2.5 baths and half_bathrooms=1 when Zillow SSR stores room count 3 with bathroomsFull=2 and bathroomsHalf=1', () => {
  const ssrHtml = '<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify({
      props: {
        pageProps: {
          componentProps: {
            gdpClientCache: {
              'HomeQuery{"zpid":70342873}': {
                property: {
                  zpid: 70342873,
                  address: { streetAddress: '8312 Minnesota Ln', city: 'Austin', state: 'TX', zipcode: '78745' },
                  price: 2850,
                  bedrooms: 4,
                  livingArea: 2372,
                  homeType: 'SINGLE_FAMILY',
                  description: 'Spacious Austin home with 2 full baths and 1 half bath downstairs.',
                  resoFacts: { bathrooms: 3, bathroomsFull: 2, bathroomsHalf: 1 },
                  responsivePhotos: [
                    { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/aabbccdd112233445566778899001101-uncropped_scaled_within_1536_1152.jpg' }] } },
                    { mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/aabbccdd112233445566778899001102-uncropped_scaled_within_1536_1152.jpg' }] } }
                  ]
                }
              }
            }
          }
        }
      }
    }) + '</script></body></html>';

  const hdp = api.extractZillowFromHtml(ssrHtml, 'https://www.zillow.com/homedetails/8312-Minnesota-Ln-Austin-TX-78745/70342873_zpid/');
  assert.strictEqual(hdp.bathrooms, 2.5);
  assert.strictEqual(hdp.half_bathrooms, 1);

  const hydrated = api.hydrateZillowCardPayload(
    hdp,
    { zpid: '70342873', bathrooms: 3 },
    { zpid: '70342873', bathrooms: 3 },
    'https://www.zillow.com/homedetails/8312-Minnesota-Ln-Austin-TX-78745/70342873_zpid/'
  );
  assert.strictEqual(hydrated.bathrooms, 2.5);
  assert.strictEqual(hydrated.half_bathrooms, 1);
});

t('Zillow Favorites route detection + link-anchored cards without property-card', () => {
  assert.strictEqual(api.isZillowFavoritesPage('https://www.zillow.com/myzillow/favorites', null), true);
  assert.strictEqual(api.isZillowFavoritesPage('https://www.zillow.com/myzillow/saved-homes', null), true);
  assert.strictEqual(api.isZillowSearchUrl('https://www.zillow.com/myzillow/favorites', null), true);
  assert.strictEqual(api.isZillowFavoritesPage('https://www.zillow.com/dallas-tx/rentals/', null), false);

  const favLinkA = {
    getAttribute: (a) => a === 'href' ? '/homedetails/501-Maple-St-Tulsa-OK-74104/11223344_zpid/' : null,
    closest: () => null,
    parentElement: null
  };
  const favCardA = {
    textContent: '501 Maple St, Tulsa, OK 74104 $1,750/mo 3 bd 2.5 ba',
    closest: () => null,
    querySelectorAll: (sel) => String(sel).includes('_zpid') ? [favLinkA] : [],
    querySelector: (sel) => String(sel).includes('img') ? { currentSrc: 'https://photos.zillowstatic.com/fp/aaaabbbbccccddddeeeeffff11112222-p_e.jpg' } : null,
    parentElement: null
  };
  favLinkA.parentElement = favCardA;

  const favNextData = {
    props: {
      pageProps: {
        savedHomesCount: 28,
        totalPages: 2,
        favorites: [
          {
            zpid: 11223344,
            detailUrl: '/homedetails/501-Maple-St-Tulsa-OK-74104/11223344_zpid/',
            streetAddress: '501 Maple St',
            city: 'Tulsa',
            state: 'OK',
            zipcode: '74104',
            price: 1750,
            bedrooms: 3,
            bathrooms: 2.5,
            statusType: 'FOR_RENT'
          }
        ]
      }
    }
  };

  const favDoc = {
    getElementById: (id) => id === '__NEXT_DATA__' ? { textContent: JSON.stringify(favNextData) } : null,
    querySelectorAll: (sel) => {
      if (String(sel).includes('property-card')) return [];
      if (String(sel).includes('a[href*="_zpid"]')) return [favLinkA];
      return [];
    },
    querySelector: () => null
  };

  const favData = api.extractZillowFavoritesData(favDoc, 'https://www.zillow.com/myzillow/favorites', favDoc);
  assert.strictEqual(favData.totalCount, 28);
  assert.strictEqual(favData.totalPages, 2);

  const cards = api.extractZillowCardRefs(favDoc, 'https://www.zillow.com/myzillow/favorites', favData);
  assert.strictEqual(cards.length, 1);
  assert.strictEqual(cards[0].zpid, '11223344');
  assert.strictEqual(cards[0].bathrooms, 2.5);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
