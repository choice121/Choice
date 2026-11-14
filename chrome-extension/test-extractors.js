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

const O = 'https://www.opendoor.com/homes/dallas-tx/789-elm-st-75202/od123456';
const OD = doc({
  props: {
    pageProps: {
      home: {
        id: 'od123456',
        address: { streetAddress: '789 Elm St', city: 'Dallas', state: 'TX', zip: '75202' },
        price: 2450,
        beds: 3,
        baths: 2.5,
        sqft: 1850,
        photos: [{ url: 'https://cdn.opendoor.com/photos/1.jpg' }, { url: 'https://cdn.opendoor.com/photos/2.jpg' }],
        description: 'Spacious home with updated kitchen and 2.5 baths.'
      }
    }
  }
});

const PR = 'https://rentprogress.com/houses-for-rent/tx/san-antonio/1204-cedar-ln-78201';
const PRD = doc({
  props: {
    pageProps: {
      property: {
        id: 'pr99988',
        streetAddress: '1204 Cedar Ln',
        city: 'San Antonio',
        state: 'TX',
        zip: '78201',
        marketRent: 2150,
        bedrooms: 4,
        bathrooms: 2,
        squareFeet: 2100,
        images: [{ url: 'https://media.rentprogress.com/p1.jpg' }, { url: 'https://media.rentprogress.com/p2.jpg' }],
        description: 'Beautiful 4 bed rental in San Antonio.'
      }
    }
  }
});
const PRLIVE = 'https://rentprogress.com/property-details/3187-andy-ter/columbus/oh/43223/1008555';
const PRLIVE_D = {
  body: { innerText: '3 Beds 2.5 Baths 1,506 Sq Ft' },
  querySelector: (sel) => {
    if (sel.includes('data-property-node-path')) return { getAttribute: () => '1008555' };
    if (sel.includes('h1')) return { textContent: '3187 Andy Ter, Columbus, OH 43223' };
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('application/ld+json')) return [{
      textContent: JSON.stringify({
        '@type': 'SingleFamilyResidence',
        identifier: '1008555',
        name: '3187 Andy Ter',
        address: { streetAddress: '3187 Andy Ter', addressLocality: 'Columbus', addressRegion: 'OH', postalCode: '43223' },
        geo: { latitude: 39.96, longitude: -83.01 },
        offers: { price: '1890.98' },
        numberOfBedrooms: 3,
        numberOfBathroomsTotal: 2.5,
        image: 'https://photos.rentprogress.com/WebPhotos/Columbus/1008555/01-Hero-md.jpg',
      }),
    }];
    if (sel.includes('rentprogress') || sel.includes('testimonial-image') || sel.includes('srcset')) {
      return [
        { src: 'https://photos.rentprogress.com/WebPhotos/Columbus/1008555/01-Hero-lg.jpg', getAttribute: () => null },
        { src: 'https://photos.rentprogress.com/WebPhotos/Columbus/1008555/05-LivingRoom-lg.jpg', getAttribute: () => null },
      ];
    }
    return [];
  },
};
const PRAEM = {
  body: { innerText: '4 Beds 2 Baths 1820 Sq Ft' },
  querySelector: (sel) => {
    if (sel.includes('property-details-page-container h1')) {
      return { textContent: '1610 E Campbell Ave, Gilbert, AZ 85234' };
    }
    if (sel.includes('img[alt*="/Mo"]')) {
      return {
        textContent: '',
        getAttribute: (name) => name === 'alt'
          ? '2,810/Mo, 1610 E Campbell Ave Gilbert, AZ 85234 Living Room View'
          : null,
      };
    }
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('.property-details-page-container')) {
      return [
        { src: 'https://photos.rentprogress.com/WebPhotos/Phoenix/996058/01-Hero-lg.jpg', getAttribute: () => null },
        { src: 'https://photos.rentprogress.com/WebPhotos/Phoenix/996058/03-LivingRoom-lg.jpg', getAttribute: () => null },
      ];
    }
    if (sel.includes('application/ld+json') || sel.includes('srcset')) return [];
    return [];
  },
};
const PRAEM_URL = 'https://rentprogress.com/property-details/1610-e-campbell-ave/gilbert/az/85234/996058?source=search';

const IH = 'https://www.invitationhomes.com/property/abc-123';
const IH_NESTED = 'https://www.invitationhomes.com/homes-for-rent/oh/columbus/abc-123';
const IH_LIVE = 'https://www.invitationhomes.com/houses-for-rent/8920-sw-228th-ln-miami-fl-33190';
const IHD = {
  title: 'Invitation Homes',
  body: { innerText: '$2,150/mo 3 Beds 2 Baths 1,650 Sq Ft Pet friendly' },
  querySelector: (sel) => {
    if (sel.includes('h1')) return { textContent: '123 Oak Street, Dallas, TX 75201' };
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('application/ld+json')) return [{
      textContent: JSON.stringify({
        '@type': 'SingleFamilyResidence',
        identifier: 'ih-abc-123',
        address: { streetAddress: '123 Oak Street', addressLocality: 'Dallas', addressRegion: 'TX', postalCode: '75201' },
        offers: { price: '2150' },
        numberOfBedrooms: 3,
        numberOfBathroomsTotal: 2,
        image: ['https://res.cloudinary.com/invh-web/image/upload/home-1.jpg'],
      }),
    }];
    if (sel.includes('img') || sel.includes('source')) {
      return [
        { src: 'https://res.cloudinary.com/invh-web/image/upload/home-1.jpg', getAttribute: () => null },
        { src: 'https://res.cloudinary.com/invh-web/image/upload/home-2.jpg', getAttribute: () => null },
      ];
    }
    return [];
  },
};

const CJ = 'https://cjproperties.org/listings/detail/3305-grand-view-blvd-columbus-oh';
const AF = 'https://choice.appfolio.com/listings/detail/3305-grand-view-blvd-columbus-oh';
const CJD = {
  querySelector: (sel) => {
    if (sel.includes('title') || sel.includes('h1')) return { textContent: '3305 Grand View Blvd, Columbus, OH 43219' };
    if (sel.includes('price')) return { textContent: '$1,350/mo' };
    if (sel.includes('desc')) return { textContent: 'Quiet side-by-side half duplex with 2 beds and 1.5 baths.' };
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('detail') || sel.includes('specs')) {
      return [
        { textContent: '2 Beds' },
        { textContent: '1.5 Baths' },
        { textContent: '1,100 Sq Ft' }
      ];
    }
    if (sel.includes('img')) {
      return [
        { src: 'https://cjproperties.org/photos/img1.jpg', getAttribute: () => null },
        { src: 'https://cjproperties.org/photos/img2.jpg', getAttribute: () => null }
      ];
    }
    return [];
  }
};

// --- Tests ---
console.log('CP_Extractors tests\n');
t('detect Zillow', () => assert.strictEqual(api.detect(Z).id, 'zillow'));
t('detect Realtor', () => assert.strictEqual(api.detect(R).id, 'realtor'));
t('detect Apartments', () => assert.strictEqual(api.detect(A).id, 'apartments'));
t('detect Redfin', () => assert.strictEqual(api.detect(F).id, 'redfin'));
t('detect Opendoor', () => assert.strictEqual(api.detect(O).id, 'opendoor'));
t('detect Progress Residential', () => assert.strictEqual(api.detect(PR).id, 'progress_residential'));
t('detect CJ Real Estate', () => assert.strictEqual(api.detect(CJ).id, 'cj_real_estate'));
t('detect AppFolio', () => assert.strictEqual(api.detect(AF).id, 'cj_real_estate'));
t('detect null', () => assert.strictEqual(api.detect('https://fb.com/'), null));
t('Zillow payload', () => { const p = api.extractZillow(ZD, Z); assert.strictEqual(p.source_listing_id, '98765432'); assert.strictEqual(p.address, '123 Main St'); assert.strictEqual(p.monthly_rent, 1850); assert.strictEqual(p.bedrooms, 3); assert.strictEqual(p.bathrooms, 2); assert.strictEqual(p.square_footage, 1450); assert.strictEqual(p.property_type, 'SINGLE_FAMILY'); assert.strictEqual(p.pets_allowed, true); assert.strictEqual(p.available_date, '2026-09-01'); assert.strictEqual(p.minimum_lease_months, null); assert.strictEqual(p.smoking_allowed, null); assert.strictEqual(p.security_deposit, 1850); assert.ok(p.location_context.includes('Walk score: 78')); assert.strictEqual(JSON.parse(p.original_image_urls).length, 1); assert.strictEqual(p.agent_name, 'Jane Agent'); });
t('Realtor payload', () => { const p = api.extractRealtor(RD, R); assert.strictEqual(p.source_listing_id, '1012345678'); assert.strictEqual(p.address, '456 Oak Ave'); assert.strictEqual(p.state, 'TX'); assert.strictEqual(p.monthly_rent, 2200); assert.strictEqual(p.bedrooms, 2); assert.strictEqual(p.property_type, 'CONDOS'); const ph = JSON.parse(p.original_image_urls); assert.strictEqual(ph.length, 2); assert.ok(ph[0].includes('primary')); });
t('Apartments payload', () => { const p = api.extractApartments(AD, A); assert.strictEqual(p.source_listing_id, 'abc123'); assert.strictEqual(p.address, '789 Pine St'); assert.strictEqual(p.monthly_rent, 1500); assert.strictEqual(p.property_type, 'APARTMENT'); assert.strictEqual(p.pets_allowed, true); assert.strictEqual(p.available_date, '2026-07-15'); assert.strictEqual(JSON.parse(p.original_image_urls).length, 1); });
t('Redfin payload', () => { const p = api.extractRedfin(FD, F); assert.strictEqual(p.source_listing_id, '123456789'); assert.strictEqual(p.address, '101 Maple Dr'); assert.strictEqual(p.monthly_rent, 2300); assert.strictEqual(p.bedrooms, 4); assert.strictEqual(p.bathrooms, 3); assert.strictEqual(p.property_type, 'SINGLE_FAMILY'); assert.strictEqual(JSON.parse(p.original_image_urls).length, 1); });
t('Opendoor payload', () => { const p = api.extractOpendoor(OD, O); assert.strictEqual(p.source_listing_id, 'od123456'); assert.strictEqual(p.address, '789 Elm St'); assert.strictEqual(p.monthly_rent, 2450); assert.strictEqual(p.bedrooms, 3); assert.strictEqual(p.bathrooms, 2.5); assert.strictEqual(p.half_bathrooms, 1); assert.strictEqual(p.square_footage, 1850); assert.strictEqual(JSON.parse(p.original_image_urls).length, 2); });
t('Opendoor does not count unrelated script photos when listing photos exist', () => {
  const d = doc({
    props: { pageProps: { home: {
      id: 'od-gallery',
      address: { streetAddress: '9 Gallery Way', city: 'Dallas', state: 'TX', zip: '75202' },
      price: 2400,
      photos: [{ url: 'https://cdn.opendoor.com/photos/home-1.jpg' }],
    } } }
  });
  d.querySelectorAll = (sel) => sel === 'script'
    ? [{ textContent: 'https://cdn.opendoor.com/photos/recommendation-1.jpg' }]
    : [];
  const urls = JSON.parse(api.extractOpendoor(d, O).original_image_urls);
  assert.deepStrictEqual(urls, ['https://cdn.opendoor.com/photos/home-1.jpg']);
});
t('Progress Residential payload', () => { const p = api.extractProgressResidential(PRD, PR); assert.strictEqual(p.source_listing_id, 'pr99988'); assert.strictEqual(p.address, '1204 Cedar Ln'); assert.strictEqual(p.monthly_rent, 2150); assert.strictEqual(p.bedrooms, 4); assert.strictEqual(p.bathrooms, 2); assert.strictEqual(p.square_footage, 2100); assert.strictEqual(p.pets_allowed, true); assert.strictEqual(JSON.parse(p.original_image_urls).length, 2); });
t('Progress Residential live AEM payload', () => { const p = api.extractProgressResidential(PRLIVE_D, PRLIVE); assert.strictEqual(p.source_listing_id, '1008555'); assert.strictEqual(p.address, '3187 Andy Ter'); assert.strictEqual(p.monthly_rent, 1890.98); assert.strictEqual(p.bathrooms, 2.5); assert.strictEqual(p.half_bathrooms, 1); assert.strictEqual(p.square_footage, 1506); assert.strictEqual(JSON.parse(p.original_image_urls).length, 3); });
t('Progress Residential current AEM DOM payload', () => { const p = api.extractProgressResidential(PRAEM, PRAEM_URL); assert.strictEqual(p.source_listing_id, '996058'); assert.strictEqual(p.address, '1610 E Campbell Ave'); assert.strictEqual(p.monthly_rent, 2810); assert.strictEqual(p.bedrooms, 4); assert.strictEqual(p.bathrooms, 2); assert.strictEqual(p.square_footage, 1820); assert.strictEqual(JSON.parse(p.original_image_urls).length, 2); });
t('Invitation Homes payload', () => { const p = api.extractInvitationHomes(IHD, IH); assert.strictEqual(p.source_listing_id, 'ih-abc-123'); assert.strictEqual(p.address, '123 Oak Street'); assert.strictEqual(p.city, 'Dallas'); assert.strictEqual(p.monthly_rent, 2150); assert.strictEqual(p.bedrooms, 3); assert.strictEqual(p.bathrooms, 2); assert.strictEqual(p.property_type, 'SINGLE_FAMILY'); assert.strictEqual(p.pets_allowed, true); assert.strictEqual(JSON.parse(p.original_image_urls).length, 2); });
t('CJ Real Estate payload', () => { const p = api.extractCJRealEstate(CJD, CJ); assert.strictEqual(p.address, '3305 Grand View Blvd'); assert.strictEqual(p.city, 'Columbus'); assert.strictEqual(p.state, 'OH'); assert.strictEqual(p.monthly_rent, 1350); assert.strictEqual(p.bedrooms, 2); assert.strictEqual(p.bathrooms, 1.5); assert.strictEqual(p.half_bathrooms, 1); assert.strictEqual(p.property_type, 'DUPLEX'); assert.strictEqual(JSON.parse(p.original_image_urls).length, 2); });
t('AppFolio payload', () => { const p = api.extractCJRealEstate(CJD, AF); assert.strictEqual(p.source, 'cj_real_estate'); assert.strictEqual(p.source_url, AF); assert.strictEqual(p.monthly_rent, 1350); });
t('dispatch', () => { assert.strictEqual(api.extract(Z, ZD).source, 'zillow'); assert.strictEqual(api.extract(O, OD).source, 'opendoor'); assert.strictEqual(api.extract(PR, PRD).source, 'progress_residential'); assert.strictEqual(api.extract(CJ, CJD).source, 'cj_real_estate'); assert.strictEqual(api.extract('https://fb.com/', doc({})), null); });
t('detect Invitation Homes', () => { assert.strictEqual(api.detect(IH).id, 'invitation_homes'); });
t('detect nested Invitation Homes route', () => { assert.strictEqual(api.detect(IH_NESTED).id, 'invitation_homes'); });
t('detect live Invitation Homes route', () => { assert.strictEqual(api.detect(IH_LIVE).id, 'invitation_homes'); });
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

t('Zillow lossless fields, acre lot conversion, schools, floor plans, photo metadata, and raw payload', () => {
  const d = doc(cache({
    zpid: 55566677,
    homeStatus: 'FOR_RENT',
    address: { streetAddress: '500 Park Ave Unit 4B', unitNumber: '4B', city: 'Denver', state: 'CO', zipcode: '80202' },
    price: 2950,
    bedrooms: 3,
    bathrooms: 2.5,
    livingArea: 1920,
    lotAreaValue: 0.5,
    lotAreaUnit: 'acres',
    monthlyHoaFee: 125,
    taxAnnualAmount: 4200,
    zestimate: 625000,
    rentZestimate: 3000,
    schools: [{ name: 'Lincoln Elementary', rating: 8, grades: 'K-5', level: 'Elementary', distance: 0.4 }],
    floorPlans: [{ name: 'Plan A', bedrooms: 3, bathrooms: 2.5, sqft: 1920, price: 2950 }],
    videos: [{ url: 'https://videos.zillowstatic.com/tour.mp4', title: 'Walkthrough' }],
    responsivePhotos: [
      { caption: 'Chef Kitchen', subjectType: 'Kitchen', mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/aabbccdd11223344aabbccdd11223344-uncropped_scaled_within_1536_1152.jpg' }] } }
    ],
    resoFacts: {
      propertySubType: 'Detached Single Family',
      architecturalStyle: 'Craftsman',
      roofType: 'Composition Shingle',
      fencing: 'Privacy Wood',
      electricVehicleChargingStations: 'Level 2 Charger',
      utilitiesIncluded: ['Water', 'Trash'],
      utilities: ['Cable Available', 'Sewer Connected'],
      leaseTerm: '12 Months',
      smokingAllowed: false,
      petWeightLimit: 45
    }
  }));
  const p = api.extractZillow(d, Z);
  assert.strictEqual(p.unit_number, '4B');
  assert.strictEqual(p.property_subtype, 'Detached Single Family');
  assert.strictEqual(p.lot_size_sqft, 21780);
  assert.strictEqual(p.hoa_fee, 125);
  assert.strictEqual(p.hoa_fee_frequency, 'Monthly');
  assert.strictEqual(p.tax_annual_amount, 4200);
  assert.strictEqual(p.ev_charging, 'Level 2 Charger');
  assert.strictEqual(p.minimum_lease_months, 12);
  assert.strictEqual(p.smoking_allowed, false);
  assert.strictEqual(p.pet_weight_limit, 45);
  assert.strictEqual(p.source_status, 'FOR_RENT');
  assert.strictEqual(p.structural_details.architectural_style, 'Craftsman');
  assert.strictEqual(p.utility_details.utilities_included_confirmed[0], 'Water');
  assert.strictEqual(p.financial_details.zestimate, 625000);
  assert.strictEqual(p.location_details.schools[0].name, 'Lincoln Elementary');
  assert.strictEqual(p.floor_plans.length, 1);
  assert.strictEqual(p.videos[0].url, 'https://videos.zillowstatic.com/tour.mp4');
  assert.strictEqual(p.photo_metadata[0].caption, 'Chef Kitchen');
  assert.strictEqual(p.photo_metadata[0].room_label, 'Kitchen');
  assert.strictEqual(p.source_raw_payload.zpid, 55566677);
});

t('Zillow dispatcher merges without null overwrite and keeps >2000 char DOM description', () => {
  const longDesc = 'Spacious remodeled home with gourmet kitchen. '.repeat(60); // > 2500 chars
  assert.ok(longDesc.length > 2200);
  const domAndNextDoc = {
    body: { innerText: '3 bd 2 ba 1,800 sqft Year built: 2012 Heating: Forced air Lot size: 0.25 acres' },
    getElementById: (id) => id === '__NEXT_DATA__' ? {
      textContent: JSON.stringify(cache({
        zpid: 44455566,
        address: { streetAddress: '77 Merge Rd', city: 'Austin', state: 'TX', zipcode: '78701' },
        price: 2400,
        bedrooms: 3,
        yearBuilt: null
      }))
    } : null,
    querySelector: (sel) => {
      if (sel.includes('h1')) return { textContent: '77 Merge Rd, Austin, TX 78701' };
      if (sel.includes('DescriptionWrapper') || sel.includes('description')) return { textContent: longDesc };
      if (sel.includes('price')) return { textContent: '$2,400/mo' };
      return null;
    },
    querySelectorAll: () => []
  };
  const p = api.extractZillow(domAndNextDoc, Z);
  assert.strictEqual(p.year_built, 2012, 'DOM year_built must not be overwritten by NextData null');
  assert.strictEqual(p.lot_size_sqft, 10890, 'DOM acre lot must convert cleanly');
  assert.strictEqual(p.heating_type, 'Forced air', 'DOM heating_type must survive merge');
  assert.strictEqual(p.description.length, longDesc.trim().length, 'DOM description must not truncate at 2000 chars');
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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);

