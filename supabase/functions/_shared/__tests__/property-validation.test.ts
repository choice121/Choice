import {
  extractZillowProfileSlug,
  isSafePublicHttpsUrl,
  matchProhibitedProfiles,
  validatePipelineProperty,
  type ProhibitedProfileRule,
} from '../property-validation.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

const DEFAULT_PROHIBITED: ProhibitedProfileRule[] = [
  {
    canonical_name: 'Main Street Renewal',
    aliases: ['MSR', 'Main St Renewal', 'Main Street Renewal LLC'],
    zillow_profile_urls: ['https://www.zillow.com/profile/Main-Street-Renewal/'],
    match_mode: 'token_phrase',
    enabled: true,
  },
  {
    canonical_name: 'American Homes 4 Rent',
    aliases: ['AMH', 'AMH Homes', 'American Homes for Rent'],
    zillow_profile_urls: ['https://www.zillow.com/profile/AMH-Homes/'],
    match_mode: 'token_phrase',
    enabled: true,
  },
];

const FOUR_VALID_PHOTOS = JSON.stringify([
  'https://photos.zillowstatic.com/fp/img1-cc_ft_960.jpg',
  'https://photos.zillowstatic.com/fp/img2-cc_ft_960.jpg',
  'https://photos.zillowstatic.com/fp/img3-cc_ft_960.jpg',
  'https://photos.zillowstatic.com/fp/img4-cc_ft_960.jpg',
]);

Deno.test('valid >=4-photo single-family listing with explicit owner passes cleanly', async () => {
  const report = await validatePipelineProperty(
    {
      address: '608 Maple Ave',
      city: 'Yukon',
      state: 'OK',
      zip: '73099',
      monthly_rent: 1595,
      bedrooms: 3,
      bathrooms: 2.5,
      property_type: 'SINGLE_FAMILY',
      source_status: 'available',
      original_description: 'Renovated kitchen with stainless steel appliances, hardwood flooring, and fenced yard.',
      original_image_urls: FOUR_VALID_PHOTOS,
      field_provenance: {
        poster_profile: {
          explicit_owner_landlord: true,
          poster_category: 'explicit_owner_landlord',
          seller_type: 'Property Owner',
        },
      },
    },
    { prohibitedProfiles: DEFAULT_PROHIBITED },
  );

  assert(report.status === 'passed', `Expected passed, got ${report.status}: ${report.reasons.join(',')}`);
  assert(report.poster_verification.verified_owner_landlord === true, 'Owner should be verified');
  assert(report.quality_signals.includes('renovated_interior'), 'Should extract renovated interior');
  assert(report.quality_signals.includes('fenced_yard'), 'Should extract fenced yard');
});

Deno.test('prohibited source profile & Zillow profile URLs are automatically rejected without Main St address false positive', async () => {
  // Valid house on "123 Main Street" should NOT match "Main Street Renewal"
  const safeMainSt = matchProhibitedProfiles(
    {
      address: '123 Main Street',
      description: 'Lovely rental near 123 Main Street in Yukon.',
      agent_name: 'Owner',
    },
    DEFAULT_PROHIBITED,
  );
  assert(safeMainSt.matched === false, 'Street name "Main Street" must not trigger Main Street Renewal');

  // Prohibited operator name in broker_name
  const msrMatch = await validatePipelineProperty(
    {
      address: '7400 Melrose Ln',
      city: 'Oklahoma City',
      state: 'OK',
      monthly_rent: 1750,
      bedrooms: 4,
      bathrooms: 2.5,
      property_type: 'SINGLE_FAMILY',
      broker_name: 'Main Street Renewal LLC',
      original_description: 'Nice home.',
      original_image_urls: FOUR_VALID_PHOTOS,
    },
    { prohibitedProfiles: DEFAULT_PROHIBITED },
  );
  assert(msrMatch.status === 'rejected', 'MSR should be rejected');
  assert(msrMatch.reasons.includes('prohibited_source_profile'), 'Should carry prohibited_source_profile reason');

  // Custom added Zillow profile URL match
  const customUrlProfile: ProhibitedProfileRule[] = [
    {
      canonical_name: 'Custom Bad Operator',
      aliases: [],
      zillow_profile_urls: ['https://www.zillow.com/profile/BadZillowPoster123/'],
      match_mode: 'token_phrase',
      enabled: true,
    },
  ];
  assert(extractZillowProfileSlug('https://www.zillow.com/profile/BadZillowPoster123/') === 'badzillowposter123', 'Slug parse');
  const urlMatched = matchProhibitedProfiles(
    {
      source_raw_payload: {
        attributionInfo: { profileUrl: 'https://www.zillow.com/profile/BadZillowPoster123/' },
      },
    },
    customUrlProfile,
  );
  assert(urlMatched.matched === true && urlMatched.matched_by === 'zillow_profile_url', 'Profile URL match expected');
});

Deno.test('person name alone without explicit owner/landlord metadata routes to needs_review', async () => {
  const report = await validatePipelineProperty(
    {
      address: '215 Oak Ridge',
      city: 'Mustang',
      state: 'OK',
      monthly_rent: 1500,
      bedrooms: 3,
      bathrooms: 2,
      property_type: 'SINGLE_FAMILY',
      agent_name: 'John Doe',
      original_description: 'Spacious three bedroom home with central air.',
      original_image_urls: FOUR_VALID_PHOTOS,
    },
    { prohibitedProfiles: DEFAULT_PROHIBITED },
  );
  assert(report.status === 'needs_review', `Expected needs_review, got ${report.status}`);
  assert(report.poster_verification.verified_owner_landlord === false, 'Person name alone must never mark owner verified');
  assert(report.reasons.includes('unverified_source_profile'), 'Must include unverified_source_profile');
});

Deno.test('multi-unit apartment with floor plans or price range is rejected; <4 photos fails gate; watermarked image is flagged', async () => {
  const complexReport = await validatePipelineProperty(
    {
      address: '500 Complex Blvd',
      city: 'Dallas',
      state: 'TX',
      monthly_rent: 1600,
      bedrooms: 2,
      bathrooms: 2,
      property_type: 'APARTMENT',
      price_range: '$1,500 - $2,200/mo',
      floor_plans: [{ id: 'fp1', name: '2x2' }],
      original_description: 'Luxury apartment community with unit selector.',
      original_image_urls: FOUR_VALID_PHOTOS,
    },
    { prohibitedProfiles: DEFAULT_PROHIBITED },
  );
  assert(complexReport.status === 'rejected', 'Multi-unit complex must be rejected');
  assert(complexReport.reasons.includes('multi_unit_apartment_complex'), 'Must include multi_unit_apartment_complex');

  const lowPhotosReport = await validatePipelineProperty(
    {
      address: '501 Small Gallery',
      city: 'Dallas',
      state: 'TX',
      monthly_rent: 1600,
      bedrooms: 3,
      bathrooms: 2,
      property_type: 'SINGLE_FAMILY',
      original_description: 'Nice house.',
      original_image_urls: JSON.stringify([
        'https://photos.zillowstatic.com/fp/a.jpg',
        'https://photos.zillowstatic.com/fp/b.jpg',
        'https://photos.zillowstatic.com/fp/c.jpg',
      ]),
    },
    { prohibitedProfiles: DEFAULT_PROHIBITED },
  );
  assert(lowPhotosReport.status === 'rejected', '<4 photos must fail gate');
  assert(lowPhotosReport.reasons.includes('insufficient_usable_photos'), 'Must record insufficient_usable_photos');

  const watermarkReport = await validatePipelineProperty(
    {
      address: '502 Watermarked St',
      city: 'Dallas',
      state: 'TX',
      monthly_rent: 1800,
      bedrooms: 3,
      bathrooms: 2,
      property_type: 'SINGLE_FAMILY',
      original_description: 'Clean house.',
      original_image_urls: JSON.stringify([
        { url: 'https://photos.zillowstatic.com/fp/1.jpg', watermarked: true },
        'https://photos.zillowstatic.com/fp/2.jpg',
        'https://photos.zillowstatic.com/fp/3.jpg',
        'https://photos.zillowstatic.com/fp/4.jpg',
      ]),
    },
    { prohibitedProfiles: DEFAULT_PROHIBITED },
  );
  assert(watermarkReport.media_check.flagged_watermarked_urls.length === 1, 'Watermarked image must be flagged without cropping');
  assert(watermarkReport.status === 'rejected', 'Only 3 clean photos remain after watermark screen -> rejected');
});

Deno.test('SSRF URL guard blocks private/loopback/metadata URLs', () => {
  assert(isSafePublicHttpsUrl('https://photos.zillowstatic.com/fp/1.jpg') === true, 'Zillow CDN allowed');
  assert(isSafePublicHttpsUrl('http://photos.zillowstatic.com/fp/1.jpg') === false, 'HTTP blocked');
  assert(isSafePublicHttpsUrl('https://127.0.0.1/img.jpg') === false, 'Loopback IP blocked');
  assert(isSafePublicHttpsUrl('https://169.254.169.254/latest/meta-data') === false, 'Metadata IP blocked');
  assert(isSafePublicHttpsUrl('https://localhost/img.jpg') === false, 'localhost blocked');
});
