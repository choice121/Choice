'use strict';
const assert = require('assert');
const api = require('./shared-extractors.js');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('OK   ' + n); } catch (e) { fail++; console.error('FAIL ' + n + ' - ' + e.message); } };

const doc = (o) => ({ getElementById: (id) => id === '__NEXT_DATA__' ? { textContent: JSON.stringify(o) } : null, querySelectorAll: () => [] });
const cache = (p) => ({ props: { pageProps: { componentProps: { gdpClientCache: JSON.stringify({ k: { property: p } }) } } } });

// --- Fixtures ---
const Z = 'https://www.zillow.com/homedetails/123-Main-St-Dallas-TX-75201/98765432_zpid/';
const ZMULTI = 'https://www.zillow.com/apartments/the-magnolia/5XjKMn/';
const ZPASEO = 'https://www.zillow.com/apartments/dallas-tx/paseo-apartments/5YLsV5/';
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
t('detect Zillow multi-unit apartment detail URL without zpid suffix', () => {
  assert.strictEqual(api.detect(ZMULTI).id, 'zillow');
});
t('detect Realtor', () => assert.strictEqual(api.detect(R).id, 'realtor'));
t('detect Apartments', () => assert.strictEqual(api.detect(A).id, 'apartments'));
t('detect Redfin', () => assert.strictEqual(api.detect(F).id, 'redfin'));
t('detect Opendoor', () => assert.strictEqual(api.detect(O).id, 'opendoor'));
t('detect Progress Residential', () => assert.strictEqual(api.detect(PR).id, 'progress_residential'));
t('detect CJ Real Estate', () => assert.strictEqual(api.detect(CJ).id, 'cj_real_estate'));
t('detect AppFolio', () => assert.strictEqual(api.detect(AF).id, 'cj_real_estate'));
t('detect null', () => assert.strictEqual(api.detect('https://fb.com/'), null));
t('Zillow payload', () => { const p = api.extractZillow(ZD, Z); assert.strictEqual(p.source_listing_id, '98765432'); assert.strictEqual(p.address, '123 Main St'); assert.strictEqual(p.monthly_rent, 1850); assert.strictEqual(p.bedrooms, 3); assert.strictEqual(p.bathrooms, 2); assert.strictEqual(p.square_footage, 1450); assert.strictEqual(p.property_type, 'SINGLE_FAMILY'); assert.strictEqual(p.pets_allowed, null); assert.strictEqual(p.available_date, null); assert.strictEqual(p.minimum_lease_months, null); assert.strictEqual(p.smoking_allowed, null); assert.strictEqual(p.security_deposit, 1850); assert.ok(p.location_context.includes('Walk score: 78')); assert.strictEqual(JSON.parse(p.original_image_urls).length, 1); assert.strictEqual(p.agent_name, 'Jane Agent'); });
t('Zillow structured media', () => {
  const d = doc(cache({
    zpid: 98765432,
    address: { streetAddress: '123 Main St', city: 'Dallas', state: 'TX', zipcode: '75201' },
    price: 1850,
    bedrooms: 3,
    bathrooms: 2,
    floorPlans: [{ title: 'Main Floor', floor: 'Main Floor', url: 'https://cdn.example.com/main-floor.jpg' }],
    videos: [{ title: 'Walkthrough', url: 'https://cdn.example.com/walkthrough.mp4' }],
    virtualTourUrl: 'https://my.matterport.com/show/?m=ZILLOW123',
  }));
  const media = api.extractZillow(d, Z).media;
  assert.strictEqual(media.length, 3);
  assert.deepStrictEqual(media.map(item => item.kind), ['floor_plan', 'video', 'virtual_tour']);
  assert.strictEqual(media[0].floor_label, 'Main Floor');
});
t('Structured media extraction across portal data shapes', () => {
  const mediaItems = [
    { kind: 'floor_plan', title: 'Main Floor', floor_label: 'Main Floor', url: 'https://cdn.example.com/main-floor.jpg' },
    { kind: 'video', title: 'Walkthrough', url: 'https://cdn.example.com/walkthrough.mp4' },
    { kind: 'virtual_tour', title: '3D Tour', url: 'https://my.matterport.com/show/?m=PORTAL123' },
  ];
  const expectedKinds = ['floor_plan', 'video', 'virtual_tour'];
  const extractors = [
    ['Realtor', api.extractRealtor, R, { property_id: 'media-realtor', address: { line: '1 Test St', city: 'Austin', state_code: 'TX', postal_code: '78701' }, price: 1800, beds: 2, baths: 1, floorPlans: [mediaItems[0]], videos: [mediaItems[1]], virtual_tours: [mediaItems[2]] }],
    ['Apartments.com', api.extractApartments, A, { id: 'media-apartments', address: { street: '2 Test St', city: 'Houston', state: 'TX', zip: '77002' }, price: 1500, bedrooms: 1, bathrooms: 1, videos: [mediaItems[1]] }],
    ['Redfin', api.extractRedfin, F, { propertyId: 'media-redfin', address: { streetAddress: '3 Test St', city: 'Plano', state: 'TX', zip: '75074' }, price: 1900, beds: 2, baths: 1, floorPlans: [mediaItems[0]], videos: [mediaItems[1]], virtualTours: [mediaItems[2]] }],
    ['Opendoor', api.extractOpendoor, O, { id: 'media-opendoor', address: { streetAddress: '4 Test St', city: 'Dallas', state: 'TX', zip: '75202' }, price: 2100, beds: 3, baths: 2, floorPlans: [mediaItems[0]], videos: [mediaItems[1]], virtualTours: [mediaItems[2]] }],
    ['Progress Residential', api.extractProgressResidential, PR, { id: 'media-progress', streetAddress: '5 Test St', city: 'San Antonio', state: 'TX', zip: '78201', marketRent: 2000, bedrooms: 3, bathrooms: 2, floorPlans: [mediaItems[0]], videos: [mediaItems[1]], virtualTours: [mediaItems[2]] }],
  ];

  extractors.forEach(([name, extract, url, property]) => {
    const data = { props: { pageProps: {} } };
    if (name === 'Realtor') data.props.pageProps.initialReduxState = { propertyDetails: property };
    else if (name === 'Redfin') data.props.pageProps.initialReduxState = { searchResults: { homeDetails: property } };
    else if (name === 'Opendoor') data.props.pageProps.home = property;
    else if (name === 'Progress Residential') data.props.pageProps.property = property;
    else data.props.pageProps.listing = property;

    const payload = extract(doc(data), url);
    assert.deepStrictEqual(payload.media.map(item => item.kind), name === 'Apartments.com' ? ['video'] : expectedKinds, `${name} media kinds`);
    if (name === 'Apartments.com') assert.strictEqual(payload.virtual_tour_url, null, 'video URL must not be stored as a legacy 3D tour');
  });

  const jsonLd = {
    '@type': 'Residence',
    name: '6 Test St',
    address: { streetAddress: '6 Test St', addressLocality: 'Austin', addressRegion: 'TX', postalCode: '78701' },
    offers: { price: 1750 },
    floorPlan: { name: 'First Floor', url: mediaItems[0].url },
    video: { '@type': 'VideoObject', name: 'Walkthrough', contentUrl: mediaItems[1].url },
    virtualTour: { name: '3D Tour', url: mediaItems[2].url },
  };
  const jsonLdPayload = api.extractFromJsonLd({ querySelectorAll: () => [{ textContent: JSON.stringify(jsonLd) }] }, 'https://example.com/listing', 'realtor');
  assert.deepStrictEqual(jsonLdPayload.media.map(item => item.kind), expectedKinds);
});
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
t('Zillow multi-unit starting rent with plus sign', () => {
  const d = doc(cache({
    zpid: 789,
    address: { streetAddress: '500 Magnolia Ave', city: 'Dallas', state: 'TX', zipcode: '75201' },
    price: '$1,450+',
    unitCount: 12,
    homeType: 'APARTMENT',
  }));
  const p = api.extract(ZMULTI, d);
  assert.ok(p);
  assert.strictEqual(p.monthly_rent, null);
  assert.strictEqual(p.community_starting_rent, 1450);
  assert.strictEqual(p.total_units, 12);
});
t('Zillow DOM starting rent with plus sign', () => {
  const d = doc({});
  d.querySelector = (selector) => selector.includes('data-testid="price"')
    ? { textContent: '$1,500+' }
    : null;
  d.body = { innerText: '$1,500+ rent' };
  const p = api.extractZillow(d, Z);
  assert.strictEqual(p.monthly_rent, 1500);
});
t('Zillow DOM rent range uses the starting rent', () => {
  const d = doc({});
  d.querySelector = (selector) => selector.includes('data-testid="price"')
    ? { textContent: '$1,500 – $2,000/mo' }
    : null;
  d.body = { innerText: '$1,500 – $2,000/mo rent' };
  const p = api.extractZillow(d, Z);
  assert.strictEqual(p.monthly_rent, 1500);
});
t('Zillow DOM extracts clearly labeled tours, videos, and floor plans', () => {
  const mediaElements = [
    {
      tagName: 'IFRAME',
      src: 'https://my.matterport.com/show/?m=DOM123',
      getAttribute: (name) => name === 'src' ? 'https://my.matterport.com/show/?m=DOM123' : name === 'title' ? 'Main Floor 3D Tour' : null,
    },
    {
      tagName: 'VIDEO',
      src: 'https://cdn.example.com/walkthrough.mp4',
      getAttribute: (name) => name === 'src' ? 'https://cdn.example.com/walkthrough.mp4' : name === 'title' ? 'Property Walkthrough' : null,
    },
    {
      tagName: 'IMG',
      src: 'https://cdn.example.com/second-floor-plan.jpg',
      getAttribute: (name) => name === 'src' ? 'https://cdn.example.com/second-floor-plan.jpg' : name === 'alt' ? 'Second Floor Plan' : null,
    },
  ];
  const d = doc({});
  d.querySelector = () => null;
  d.querySelectorAll = (selector) => selector.includes('iframe[src]')
    ? mediaElements
    : [];
  d.body = { innerText: '' };

  const payload = api.extractZillowFromDom(d, Z);
  assert.deepStrictEqual(payload.media.map(item => item.kind), ['virtual_tour', 'video', 'floor_plan']);
  assert.strictEqual(payload.virtual_tour_url, 'https://my.matterport.com/show/?m=DOM123');
  assert.strictEqual(payload.media[0].floor_label, 'Main Floor');
  assert.strictEqual(payload.media[2].floor_label, 'Second Floor');
});
t('Zillow DOM extracts lazy-loaded gallery photos and ignores non-photo CDN assets', () => {
  const photoUrls = Array.from({ length: 11 }, (_, index) =>
    `https://photos.zillowstatic.com/fp/${String(index).padStart(16, '0')}-photo.jpg`);
  const imageElements = photoUrls.map((url, index) => ({
    currentSrc: '',
    src: '',
    getAttribute: (name) => {
      if (name === 'data-src') return index % 2 === 0 ? url : null;
      if (name === 'data-srcset') return index % 2 === 1 ? `${url} 1536w` : null;
      return null;
    },
  }));
  imageElements.push({
    currentSrc: '',
    src: '',
    getAttribute: (name) => name === 'data-src'
      ? 'https://www.zillowstatic.com/images/logo.png'
      : null,
  });

  const d = doc(cache({
    zpid: 789,
    address: { streetAddress: '500 Magnolia Ave', city: 'Dallas', state: 'TX', zipcode: '75201' },
    price: '$1,450+',
    responsivePhotos: [],
  }));
  d.querySelector = () => null;
  d.querySelectorAll = (selector) => selector === 'script[type="application/ld+json"]'
    ? []
    : imageElements;
  d.body = { innerText: '' };

  const p = api.extractZillow(d, Z);
  assert.strictEqual(p.monthly_rent, 1450);
  assert.strictEqual(p.address, '500 Magnolia Ave');
  const photos = JSON.parse(p.original_image_urls);
  assert.strictEqual(photos.length, 11);
  assert.ok(photos.every((url) => url.includes('/fp/')));
});
t('Zillow building page extracts nested cache data, visible address, rent, and gallery photos', () => {
  const galleryUrls = Array.from({ length: 11 }, (_, index) =>
    `https://photos.zillowstatic.com/fp/${String(index + 1).padStart(16, '0')}-gallery.jpg`);
  const images = galleryUrls.map((url) => ({
    currentSrc: url,
    src: url,
    getAttribute: () => null,
  }));
  const priceElements = [
    { textContent: 'Special offer: $0 App Fee $0 Admin Fee' },
    { textContent: 'Starting at $1,450+ per month' },
  ];
  const paseoDoc = doc({
    props: {
      pageProps: {
        initialState: {
          clientCache: {
            gdpClientCache: JSON.stringify({
              building: {
                data: {
                  property: {
                    zpid: 461916207,
                    address: null,
                    responsivePhotos: [],
                  },
                },
              },
            }),
          },
        },
      },
    },
  });
  paseoDoc.title = 'Paseo Apartments - Zillow';
  paseoDoc.body = {
    innerText: 'Paseo Apartments\n4836 Sunnyvale St, Dallas, TX 75216\nStarting at $1,450+ per month',
  };
  paseoDoc.querySelector = (selector) => selector.includes('h1')
    ? { textContent: 'Paseo Apartments' }
    : null;
  paseoDoc.querySelectorAll = (selector) => {
    if (selector.includes('application/ld+json')) return [];
    if (selector.includes('data-testid*="rent"')) return priceElements;
    if (selector.startsWith('img,')) return images;
    return [];
  };

  const payload = api.extractZillow(paseoDoc, ZPASEO);
  assert.ok(payload);
  assert.strictEqual(payload.source_listing_id, '461916207');
  assert.strictEqual(payload.address, '4836 Sunnyvale St');
  assert.strictEqual(payload.city, 'Dallas');
  assert.strictEqual(payload.state, 'TX');
  assert.strictEqual(payload.zip, '75216');
  assert.strictEqual(payload.monthly_rent, null);
  assert.strictEqual(payload.community_starting_rent, 1450);
  assert.strictEqual(JSON.parse(payload.original_image_urls).length, 11);

  paseoDoc.getElementById = () => null;
  const domOnlyPayload = api.extractZillow(paseoDoc, ZPASEO);
  assert.strictEqual(domOnlyPayload.source_listing_id, '5YLsV5');
  assert.strictEqual(domOnlyPayload.address, '4836 Sunnyvale St');
  assert.strictEqual(JSON.parse(domOnlyPayload.original_image_urls).length, 11);
});
t('Zillow apartment communities preserve unit rows and media without flattening a sample unit', () => {
  const communityUrl = 'https://www.zillow.com/apartments/haltom-city-tx/range-vista/CqWYZs/';
  const communityRows = [
    ['2305', '1', '1', '604', '$1,538'],
    ['9303', '1', '1', '604', '$1,538'],
    ['9304', '1', '1', '604', '$1,538'],
    ['2307', '1', '1', '800', '$1,642'],
    ['4203', '1', '1', '800', '$1,667'],
    ['8303', '1', '1', '800', '$1,753'],
    ['10302', '2', '2', '1,142', '$2,053'],
    ['10307', '2', '2', '1,142', '$2,053'],
    ['11302', '2', '2', '1,142', '$2,053'],
    ['2111', '3', '2', '1,365', '$2,548'],
    ['2302', '3', '2', '1,365', '$2,668'],
    ['2311', '3', '2', '1,365', '$2,668'],
  ].map(([unit, beds, baths, sqft, rent]) => `Unit ${unit} ${beds} bd, ${baths} ba ${sqft} sqft Dec 4 ${rent}`);
  const rows = communityRows.map(text => ({ innerText: text, textContent: text }));
  const video = {
    tagName: 'VIDEO',
    currentSrc: 'https://videos.zillowstatic.com/community-tour.mp4',
    poster: 'https://photos.zillowstatic.com/fp/community-tour.jpg',
    getAttribute: () => null,
  };
  const property = {
    zpid: 461916207,
    title: 'Range Vista Apartments',
    address: { streetAddress: '4700 Fossil Vista Dr', city: 'Haltom City', state: 'TX', zipcode: '76137' },
    homeType: 'APARTMENT',
    price: 1538,
    bedrooms: 1,
    bathrooms: 1,
    livingArea: 604,
    units: communityRows.map((text, index) => {
      const [, unit, beds, baths, sqft, rent] = text.match(/Unit (\S+) (\d+) bd, (\d+) ba ([\d,]+) sqft .*?(\$[\d,]+)/);
      return {
        unitNumber: unit,
        bedrooms: beds,
        bathrooms: baths,
        squareFootage: sqft,
        monthlyRent: rent,
        availabilityDate: `2026-12-${String(index + 1).padStart(2, '0')}`,
      };
    }),
    responsivePhotos: [{
      mixedSources: { jpeg: [{ width: 1536, url: 'https://photos.zillowstatic.com/fp/community-photo-1.jpg' }] },
    }],
    videos: [{ url: 'https://videos.zillowstatic.com/community-tour.mp4', title: 'Community video' }],
    amenityCategories: [{ category: 'Pet policy', amenities: ['Pet Friendly'] }],
  };
  const communityDoc = doc(cache(property));
  communityDoc.title = 'Range Vista Apartments - Zillow';
  communityDoc.body = {
    innerText: [
      'Range Vista Apartments in Haltom City, TX',
      'Apartment building',
      '4700 Fossil Vista Dr, Haltom City, TX 76137',
      ...communityRows,
    ].join('\n'),
  };
  communityDoc.querySelector = selector => selector.includes('h1')
    ? { textContent: 'Range Vista Apartments' }
    : null;
  communityDoc.querySelectorAll = selector => {
    if (selector.includes('application/ld+json')) return [];
    if (selector.startsWith('tr,')) return rows;
    if (selector.includes('rent') || selector.includes('price')) return [];
    if (selector.startsWith('img,')) return [];
    if (selector.startsWith('iframe[')) return [video];
    return [];
  };

  assert.strictEqual(api.detect(communityUrl).id, 'zillow');
  const payload = api.extractZillow(communityDoc, communityUrl);
  assert.ok(payload);
  assert.strictEqual(payload.title, '4700 Fossil Vista Dr, Haltom City, TX 76137');
  assert.strictEqual(payload.property_type, 'APARTMENT');
  assert.strictEqual(payload.monthly_rent, null);
  assert.strictEqual(payload.bedrooms, null);
  assert.strictEqual(payload.bathrooms, null);
  assert.strictEqual(payload.square_footage, null);
  assert.strictEqual(payload.unit_options.length, 12);
  assert.deepStrictEqual(
    payload.unit_options.slice(0, 3).map(unit => [unit.unit_number, unit.bedrooms, unit.bathrooms, unit.square_footage, unit.monthly_rent]),
    [['2305', 1, 1, 604, 1538], ['9303', 1, 1, 604, 1538], ['9304', 1, 1, 604, 1538]]
  );
  assert.strictEqual(payload.unit_options[11].unit_number, '2311');
  assert.ok(payload.media.some(item => item.kind === 'video'));
  assert.strictEqual(payload.pets_allowed, null);
  assert.ok(!JSON.stringify(payload.unit_options).includes('availabilityDate'));
  assert.ok(!JSON.stringify(payload.unit_options).includes('Dec 4'));
});
t('Zillow community extraction survives missing street address and shows distinct unit prices', () => {
  const rows = [
    { innerText: 'Unit 1201\n1 bd\n1 ba\n650 sqft\n$1,450' },
    { innerText: 'Unit 1202\n2 bd\n2 ba\n980 sqft\n$1,895' },
  ];
  const unitPrices = rows.map((row) => ({ textContent: row.innerText }));
  const communityDoc = doc({});
  communityDoc.title = 'The Oaks Apartments - Zillow';
  communityDoc.body = { innerText: 'The Oaks Apartments\nApartments in Dallas, TX 75216' };
  communityDoc.querySelector = (selector) => selector.includes('h1')
    ? { textContent: 'The Oaks Apartments' }
    : null;
  communityDoc.querySelectorAll = (selector) => {
    if (selector.includes('application/ld+json')) return [];
    if (selector.includes('[data-testid*="rent"]')) return unitPrices;
    if (selector.includes('tr, [role="row"')) return rows;
    return [];
  };

  const payload = api.extract('https://www.zillow.com/apartments/dallas-tx/the-oaks/AbC123/', communityDoc);
  assert.ok(payload, 'unit data should keep a community extractable without a street address');
  assert.strictEqual(payload.title, 'The Oaks Apartments');
  assert.strictEqual(payload.address, null);
  assert.strictEqual(payload.city, 'Dallas');
  assert.strictEqual(payload.monthly_rent, null);
  assert.strictEqual(payload.community_starting_rent, null, 'a unit rent must not become the community starting rent');
  assert.deepStrictEqual(
    payload.unit_options.map((unit) => [unit.unit_number, unit.bedrooms, unit.bathrooms, unit.square_footage, unit.monthly_rent]),
    [['1201', 1, 1, 650, 1450], ['1202', 2, 2, 980, 1895]]
  );
});
t('Zillow community parser captures floor-plan cards without explicit unit numbers', () => {
  const card = {
    innerText: 'A2\n2 bd\n2 ba\n980 sqft\nStarting at $1,895 - $2,150',
    getAttribute: (name) => name === 'data-testid' ? 'floorplan-card' : null,
  };
  const communityDoc = doc({});
  communityDoc.body = { innerText: 'Apartments in Dallas, TX 75216' };
  communityDoc.querySelector = () => null;
  communityDoc.querySelectorAll = (selector) => {
    if (selector.includes('application/ld+json')) return [];
    if (selector.includes('floorplan')) return [card];
    return [];
  };

  const payload = api.extract('https://www.zillow.com/apartments/dallas-tx/the-oaks/AbC123/', communityDoc);
  assert.ok(payload);
  assert.strictEqual(payload.monthly_rent, null);
  assert.strictEqual(payload.unit_options.length, 1);
  assert.deepStrictEqual(
    [payload.unit_options[0].source_kind, payload.unit_options[0].floor_plan_name, payload.unit_options[0].bedrooms, payload.unit_options[0].bathrooms, payload.unit_options[0].square_footage, payload.unit_options[0].starting_rent],
    ['floor_plan', 'A2', 2, 2, 980, 1895]
  );
});
t('Zillow community parser reads nested unit inventory beside the property cache', () => {
  const communityDoc = doc({
    props: {
      pageProps: {
        componentProps: {
          gdpClientCache: JSON.stringify({
            community: {
              data: {
                property: {
                  zpid: 'AbC123',
                  address: null,
                  name: 'The Oaks Apartments',
                  price: '$1,450+',
                  homeType: 'APARTMENT',
                  floorPlans: [
                    { floorPlanName: 'A1', bedrooms: 1, bathrooms: 1, squareFootage: 650, startingRent: 1450 },
                  ],
                },
                unitInventory: [
                  { unitNumber: '1201', bedroomCount: 1, bathroomCount: 1, squareFeet: 650, minRent: 1450 },
                  { unitNumber: '1202', bedroomCount: 2, bathroomCount: 2, squareFeet: 980, minRent: 1895 },
                ],
              },
            },
          }),
        },
      },
    },
  });
  communityDoc.body = { innerText: 'Apartments in Dallas, TX 75216' };
  communityDoc.querySelector = () => null;
  communityDoc.querySelectorAll = () => [];

  const payload = api.extract('https://www.zillow.com/apartments/dallas-tx/the-oaks/AbC123/', communityDoc);
  assert.ok(payload);
  assert.strictEqual(payload.title, 'The Oaks Apartments');
  assert.strictEqual(payload.monthly_rent, null);
  assert.strictEqual(payload.community_starting_rent, 1450);
  assert.deepStrictEqual(
    payload.unit_options.map((unit) => [unit.source_kind, unit.unit_number, unit.floor_plan_name]),
    [['floor_plan', null, 'A1'], ['available_unit', '1201', null], ['available_unit', '1202', null]]
  );
  assert.deepStrictEqual(
    payload.unit_options.slice(1).map((unit) => [unit.unit_number, unit.bedrooms, unit.bathrooms, unit.square_footage, unit.monthly_rent]),
    [['1201', 1, 1, 650, 1450], ['1202', 2, 2, 980, 1895]]
  );
  assert.ok(!JSON.stringify(payload.unit_options).includes('availabilityDate'));
});
t('Zillow community inventory rejects prose labels, merges duplicate units, and preserves building counts', () => {
  const property = {
    zpid: 'Community123',
    name: 'Hunters Hill',
    address: { streetAddress: '18081 Midway Rd', city: 'Dallas', state: 'TX', zipcode: '75287' },
    homeType: 'APARTMENT',
    unitCount: 400,
    stories: 4,
    priceRange: { min: 1200, max: 1800 },
    units: [
      { unitNumber: 'to', bedrooms: 2, monthlyRent: 75 },
      { unitNumber: 'for', monthlyRent: 34 },
      { unitNumber: 'types', monthlyRent: 1390 },
      { unitNumber: 'in', monthlyRent: 1375 },
      { unitNumber: '1727', bedrooms: 1, bathrooms: 1, monthlyRent: 1111 },
      { unitNumber: '1727', bedrooms: 1, bathrooms: 1, squareFootage: 600, monthlyRent: 914 },
    ],
    floorPlans: [{ startingRent: 75 }],
    responsivePhotos: [
      { url: 'https://photos.zillowstatic.com/fp/abcdef0123456789-uncropped_scaled_within_1536_1152.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/abcdef0123456789-p_h.jpg' },
    ],
  };
  const communityDoc = doc(cache(property));
  communityDoc.body = { innerText: 'Hunters Hill Apartments\nUnit to $75\nUnits from $75 to $1,500\nUnit 1727\n1 bd\n1 ba\n600 sqft\n$914' };

  const payload = api.extract('https://www.zillow.com/apartments/dallas-tx/hunters-hill/Community123/', communityDoc);
  assert.ok(payload);
  assert.strictEqual(payload.title, '18081 Midway Rd, Dallas, TX 75287');
  assert.strictEqual(payload.building_name, 'Hunters Hill');
  assert.strictEqual(payload.is_multi_unit, true);
  assert.strictEqual(payload.total_units, 400);
  assert.strictEqual(payload.floors, 4);
  assert.strictEqual(payload.price_range, '$1,200 – $1,800');
  assert.deepStrictEqual(
    payload.unit_options.map(unit => [unit.unit_number, unit.monthly_rent, unit.square_footage]),
    [['1727', 914, 600]]
  );
  assert.strictEqual(JSON.parse(payload.original_image_urls).length, 1);
  const report = api.diagnose('https://www.zillow.com/apartments/dallas-tx/hunters-hill/Community123/', communityDoc);
  assert.strictEqual(report.facts.building_name, 'Hunters Hill');
  assert.strictEqual(report.facts.is_multi_unit, true);
  assert.strictEqual(report.facts.price_range, '$1,200 – $1,800');
});
t('diagnostics report extracted listing facts and page shape without raw descriptions or query data', () => {
  const d = doc(cache({
    zpid: 12345,
    title: 'Private Test Apartments',
    address: { streetAddress: '10 Main St', city: 'Dallas', state: 'TX', zipcode: '75201' },
    homeType: 'APARTMENT',
    price: 1500,
    units: [{ unitNumber: 'A101', bedrooms: 1, bathrooms: 1, monthlyRent: 1500 }],
    description: 'Do not include this private test description in diagnostics.',
  }));
  d.title = 'Private Test Apartments - Zillow';
  d.body = { innerText: 'Private Test Apartments listing page' };

  const report = api.diagnose(Z + '?session=private#section', d);
  assert.strictEqual(report.status, 'success');
  assert.strictEqual(report.source_url, Z);
  assert.strictEqual(report.facts.address, '10 Main St');
  assert.strictEqual(report.unit_options[0].unit_number, 'A101');
  assert.ok(!JSON.stringify(report).includes('Do not include this private test description'));
  assert.ok(!JSON.stringify(report).includes('session=private'));
  assert.ok(report.source_data_shape.length > 0);
  assert.ok(report.source_data_shape.some((entry) => entry.path.includes('gdpClientCache.__parsed')));
  assert.ok(report.source_data_shape.some((entry) => entry.path.endsWith('.property.description') && entry.type === 'string'));
  assert.ok(!JSON.stringify(report.source_data_shape).includes('Private Test Apartments listing page'));
});
t('diagnostics do not include extractor exception messages', () => {
  const zillow = api.EXTRACTORS.find((extractor) => extractor.id === 'zillow');
  const originalExtractor = zillow.fn;
  const privateMessage = 'PRIVATE LISTING DESCRIPTION must not be sent';
  let report;
  try {
    zillow.fn = () => {
      const error = new SyntaxError(privateMessage);
      error.stack = `${privateMessage}\n    at extractZillowNextData (chrome-extension://private-id/shared-extractors.js:321:17)\n    at privateFunction (https://example.com/private.js:4:5)`;
      throw error;
    };
    report = api.diagnose(Z, doc({}));
  } finally {
    zillow.fn = originalExtractor;
  }
  assert.strictEqual(report.extractor.direct_status, 'threw');
  assert.strictEqual(report.extractor.direct_error.name, 'SyntaxError');
  assert.strictEqual(report.extractor.direct_error.message_length, privateMessage.length);
  assert.deepStrictEqual(report.extractor.direct_error.stack_frames, [{
    file: 'shared-extractors.js',
    line: 321,
    column: 17,
    function: 'extractZillowNextData',
  }]);
  assert.ok(!JSON.stringify(report).includes(privateMessage));
  assert.ok(!JSON.stringify(report).includes('private-id'));
  assert.ok(!JSON.stringify(report).includes('example.com'));
});
t('Zillow extraction preserves primary listing data when JSON-LD uses an array type', () => {
  const d = doc(cache({
    zpid: 98765,
    title: 'Array Type Test',
    address: { streetAddress: '50 Test St', city: 'Dallas', state: 'TX', zipcode: '75201' },
    homeType: 'SINGLE_FAMILY',
    price: 1800,
    bedrooms: 3,
    bathrooms: 2,
  }));
  d.querySelector = () => null;
  d.body = { innerText: '' };
  d.querySelectorAll = (selector) => selector.includes('application/ld+json')
    ? [{
      textContent: JSON.stringify({
        '@type': ['https://schema.org/Apartment', 'Accommodation'],
        name: 'JSON-LD fallback listing',
        address: { streetAddress: '50 Test St', addressLocality: 'Dallas', addressRegion: 'TX', postalCode: '75201' },
      }),
    }]
    : [];

  const payload = api.extract(Z, d);
  assert.ok(payload);
  assert.strictEqual(payload.address, '50 Test St');
  assert.strictEqual(payload.monthly_rent, 1800);
  assert.strictEqual(payload.property_type, 'SINGLE_FAMILY');
});
t('diagnostics explain unsupported listing URLs without collecting page contents', () => {
  const report = api.diagnose('https://example.com/private?token=not-for-sharing', doc({}));
  assert.strictEqual(report.status, 'failed');
  assert.strictEqual(report.reason, 'unsupported_url');
  assert.strictEqual(report.source_url, 'https://example.com/private');
  assert.ok(!JSON.stringify(report).includes('token=not-for-sharing'));
});
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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
