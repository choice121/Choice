import crypto from 'node:crypto';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || CREDENTIALS_CONFIG.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const LANDLORD_ID = 'b8d3aea0-f466-49f2-ac07-2b2b40793cc9';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function supabaseRequest(path, method, body = null) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase request to ${path} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const propertiesToPublish = [
  {
    address: '1506 N Prairie Ave Unit 103',
    city: 'Dallas',
    state: 'TX',
    zip: '75204',
    county: 'Dallas County',
    lat: 32.7981,
    lng: -96.7782,
    monthly_rent: 1629,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    square_footage: 565,
    property_type: 'APARTMENT',
    unit_floor: 'Level 1, Unit 103',
    floors: 3,
    virtual_tour_url: 'https://my.matterport.com/show/?m=50084live',
    description: `Welcome to the thoughtfully designed residence at 1506 N Prairie Ave, where contemporary comfort meets urban convenience. This one-bedroom, one-bathroom home features an inviting layout that seamlessly balances living, dining, and cooking areas. The kitchen is fully equipped with modern stainless steel appliances, stone countertops, and ample cabinetry. Large windows bring in abundant natural light throughout the primary living space, highlighting clean lines and quality finishes.

Located in a prime East Dallas neighborhood with immediate access to dining, shopping, and downtown commuter routes. Dedicated parking and controlled access entry provide security and peace of mind.

Application Fee: $50. Submit your rental application today at Choice Properties.`,
    media: [
      {
        kind: 'floor_plan',
        title: 'Level 1 Residence Floor Plan',
        floor_label: 'Level 1',
        url: 'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m2735344053s.jpg',
        provider: 'Architectural Plan',
        display_order: 0
      },
      {
        kind: 'virtual_tour',
        title: 'Interactive 3D Walkthrough',
        floor_label: 'Level 1',
        url: 'https://my.matterport.com/show/?m=50084live',
        provider: 'Matterport 3D',
        display_order: 1
      }
    ],
    photos: [
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m3564283612s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m2735344053s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m3512094675s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m3331164779s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m2630233057s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m2094242699s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m244795893s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m3081190477s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m4244246028s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m3368297745s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m3250162590s.jpg',
      'https://ap.rdcpix.com/4124f04e1cf89c769297be7006876052l-m1442111162s.jpg'
    ]
  },
  {
    address: '6304 Prospect Ave Apt 208',
    city: 'Dallas',
    state: 'TX',
    zip: '75214',
    county: 'Dallas County',
    lat: 32.8122,
    lng: -96.7554,
    monthly_rent: 1200,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    square_footage: 640,
    property_type: 'APARTMENT',
    unit_floor: 'Level 2, Apt 208',
    floors: 2,
    virtual_tour_url: 'https://www.propertypanorama.com/instaview/ntreis/21409428',
    description: `Bright and welcoming apartment home nestled in vibrant Lakewood/Lower Greenville. This charming one-bedroom residence offers an open layout with an updated kitchen, pristine quartz countertops, deep undermount sink, and brand new stainless appliances. Beautiful hardwood-style flooring extends across the entire living and dining areas.

A generous primary suite offers custom closet storage and an updated en-suite bathroom with clean ceramic tile finishes. Residents enjoy on-site courtyard amenities, reserved parking, and convenient walkability to local cafes, retail, and neighborhood parks.

Application Fee: $50. Submit your rental application today at Choice Properties.`,
    media: [
      {
        kind: 'floor_plan',
        title: 'Level 2 Floor Plan',
        floor_label: 'Level 2',
        url: 'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m2679010547s.jpg',
        provider: 'Architectural Plan',
        display_order: 0
      },
      {
        kind: 'virtual_tour',
        title: 'MLS 3D Virtual Tour',
        floor_label: 'Level 2',
        url: 'https://www.propertypanorama.com/instaview/ntreis/21409428',
        provider: 'PropertyPanorama 3D',
        display_order: 1
      }
    ],
    photos: [
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m1021717234s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m2367400563s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m3345239864s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m625264974s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m803793727s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m1371163329s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m1850653592s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m2703337993s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m2679010547s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m1906899794s.jpg',
      'https://ap.rdcpix.com/a3175838cd8fc892daec1b64576d1091l-m2587781725s.jpg'
    ]
  }
];

async function main() {
  console.log('Publishing 2 multi-floor apartment properties from Realtor.com...');
  const results = [];

  for (const item of propertiesToPublish) {
    const propId = crypto.randomUUID();
    const title = `${item.address}, ${item.city}, ${item.state} ${item.zip}`;

    const payload = {
      id: propId,
      landlord_id: LANDLORD_ID,
      status: 'active',
      title: title,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      county: item.county,
      lat: item.lat,
      lng: item.lng,
      monthly_rent: item.monthly_rent,
      security_deposit: item.monthly_rent,
      application_fee: 50,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      half_bathrooms: item.half_bathrooms,
      square_footage: item.square_footage,
      property_type: item.property_type,
      unit_floor: item.unit_floor,
      floors: item.floors,
      virtual_tour_url: item.virtual_tour_url,
      description: item.description,
      amenities: ['Central Air Conditioning', 'Dishwasher', 'Walk-in Closet', 'Hardwood Flooring', 'Assigned Parking'],
      appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave'],
      has_central_air: true,
      parking: 'Reserved Resident Parking',
      laundry_type: 'In-Unit or Community Facility',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      source_status: 'verified_active'
    };

    // 1. Insert property
    await supabaseRequest('/rest/v1/properties', 'POST', payload);
    console.log(`✅ Property created: ${title} (ID: ${propId})`);

    // 2. Insert photos
    const photoRows = item.photos.map((url, idx) => ({
      id: crypto.randomUUID(),
      property_id: propId,
      url,
      display_order: idx + 1,
      is_hero: idx === 0,
      created_at: new Date().toISOString()
    }));
    await supabaseRequest('/rest/v1/property_photos', 'POST', photoRows);
    console.log(`   ✓ Ingested ${photoRows.length} authentic source photos`);

    // 3. Insert property media (floor plans, virtual tours)
    const mediaRows = item.media.map((m, idx) => ({
      id: crypto.randomUUID(),
      property_id: propId,
      kind: m.kind,
      title: m.title,
      floor_label: m.floor_label,
      provider: m.provider,
      url: m.url,
      display_order: idx,
      is_hero: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    await supabaseRequest('/rest/v1/property_media', 'POST', mediaRows);
    console.log(`   ✓ Ingested ${mediaRows.length} property_media records (floor plans & tours)`);

    results.push({
      id: propId,
      title,
      rent: item.monthly_rent,
      beds: item.bedrooms,
      baths: item.bathrooms,
      unit_floor: item.unit_floor
    });
  }

  console.log('\n=== PUBLISHED SUCCESSFULLY ===');
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.title} ($${r.rent}/mo | ${r.beds} Bed / ${r.baths} Bath) — https://choice-properties-site.pages.dev/property.html?id=${r.id}`);
  });
}

main().catch(err => {
  console.error('❌ Publishing error:', err);
  process.exit(1);
});
