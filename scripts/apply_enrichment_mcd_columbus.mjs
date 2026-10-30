import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import https from 'https';

const fetchSB = (endpoint) => new Promise((resolve, reject) => {
  https.get(endpoint, {
    headers: {
      'apikey': CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      'Authorization': 'Bearer ' + CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      'Accept': 'application/json'
    }
  }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
    });
  }).on('error', reject);
});

const patchJSON = (endpoint, body, key) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const u = new URL(endpoint);
  const req = https.request(u, {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    }
  }, resp => {
    let d = '';
    resp.on('data', chunk => d += chunk);
    resp.on('end', () => {
      try { resolve(JSON.parse(d)); }
      catch(e) { resolve(d); }
    });
  });
  req.on('error', reject);
  req.write(data);
  req.end();
});

async function main() {
  const configs = await fetchSB(CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/credentials_config?select=*');
  const serviceKey = (configs.find(c => c.key === 'SUPABASE_SERVICE_ROLE_KEY') || {}).value;

  const mcdonoughEnrichments = [
    {
      id: '8e45b56d-a609-43d8-a848-b5deb6f98322',
      address: '308 J C Ct',
      monthly_rent: 1600,
      security_deposit: 1600,
      application_fee: 50,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      pet_deposit: 300,
      minimum_lease_months: 12,
      has_central_air: true,
      has_basement: false,
      garage_spaces: 1,
      parking: 'Attached 1-Car Garage + Driveway',
      heating_type: 'Central Heat / Fireplace',
      cooling_type: 'Central Air Conditioning',
      laundry_type: 'In-Unit Dedicated Laundry Room',
      flooring: ['Hardwood', 'Carpet', 'Tile'],
      appliances: ['Gas Stove / Range', 'Refrigerator', 'Dishwasher', 'Water Heater'],
      amenities: [
        'Attached 1-Car Garage w/ Remote Opener',
        'Cozy Fireplace in Family Room',
        'Spacious Primary Bedroom w/ Walk-In Closet & En-Suite Bath',
        'Split Bedroom Floor Plan',
        'Quiet Cul-de-sac Setting (Dead-End Street)',
        'Private Backyard',
        'Pet Friendly',
        'Smoke Free'
      ],
      description: 'Welcome to 308 J C Ct — a charming 3-bedroom, 2-bathroom ranch-style home offering 1,113 sq. ft. of comfortable living tucked away on a quiet cul-de-sac in McDonough, GA.\n\nFreshly painted and immaculate throughout, this home features a bright and spacious family room centered by a cozy fireplace, formal dining area, and a split-bedroom floor plan for optimal privacy. The roomy primary suite boasts a generous walk-in closet and dedicated en-suite bath. The bright kitchen is fully equipped with a gas range, refrigerator, and dishwasher. Outside, enjoy a peaceful yard and attached 1-car garage with automatic opener. Conveniently located minutes from McDonough Square, top-rated schools, local dining, and easy access to I-75.\n\nHome Features & Highlights:\n• 3 Bedrooms, 2 Full Bathrooms (1,113 sq. ft.)\n• Split bedroom plan with private primary ensuite & walk-in closet\n• Family room with inviting fireplace\n• Bright kitchen with gas stove, refrigerator, and dishwasher included\n• Attached 1-car garage with opener plus private driveway\n• Quiet cul-de-sac location close to McDonough Square and I-75\n• Central air conditioning and heating\n• Pet-friendly living (dogs and cats welcome)\n\nLease Terms:\n• Monthly Rent: $1600\n• Security Deposit: $1600\n• Application Fee: $50 per adult applicant\n• 12-Month Lease Minimum\n\nYour next home is waiting. Submit your application at Choice Properties to get started.',
      virtual_tour_url: null
    },
    {
      id: '89636dd9-3150-4d0b-9a53-66146b74d788',
      address: '2125 Marlin Dr',
      monthly_rent: 1525,
      security_deposit: 1525,
      application_fee: 50,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      pet_deposit: 300,
      minimum_lease_months: 12,
      has_central_air: true,
      has_basement: false,
      parking: 'Private Driveway / Off-Street Parking',
      heating_type: 'Forced Air Central Heat',
      cooling_type: 'Central Air Conditioning',
      laundry_type: 'Dedicated Laundry Hookups',
      flooring: ['Hardwood', 'Tile', 'Vinyl Plank'],
      appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Water Heater'],
      amenities: [
        'Classic Brick-Front Exterior',
        'Two Spacious Primary-Sized Bedrooms with 2 Full Baths',
        'Private Rear Patio for Outdoor Relaxation',
        'Bright Living Room with Abundant Natural Light',
        'Large Yard Space',
        'Pet Friendly',
        'Smoke Free'
      ],
      description: 'Welcome to 2125 Marlin Dr — a charming 2-bedroom, 2-bathroom single-family home offering 1,400 sq. ft. of comfortable living in McDonough, GA.\n\nThis home welcomes you with a classic brick-front exterior that feels both warm and timeless. Natural light enhances the inviting living areas, while thoughtful updates ensure a refreshed look throughout. With two spacious bedrooms and two full bathrooms, the layout offers ideal comfort and everyday privacy. Step outside onto the private rear patio to relax and enjoy the quiet outdoor setting. Conveniently situated near local restaurants, coffee shops, grocery stores, and major transit routes in McDonough.\n\nHome Features & Highlights:\n• 2 Bedrooms, 2 Full Bathrooms (1,400 sq. ft.)\n• Dual full bathrooms for optimal comfort\n• Classic brick-front architecture with attractive curb appeal\n• Private rear patio and spacious yard\n• Bright living room with abundant natural light\n• Central air conditioning and heating\n• Pet-friendly living (dogs and cats welcome)\n\nLease Terms:\n• Monthly Rent: $1525\n• Security Deposit: $1525\n• Application Fee: $50 per adult applicant\n• 12-Month Lease Minimum\n\nYour next home is waiting. Submit your application at Choice Properties to get started.',
      virtual_tour_url: null
    },
    {
      id: 'eea7ab47-8dfd-467f-bdc8-f9452c593834',
      address: '120 Sherwood Loop',
      monthly_rent: 1485,
      security_deposit: 1485,
      application_fee: 50,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      pet_deposit: 300,
      minimum_lease_months: 12,
      has_central_air: true,
      has_basement: false,
      parking: 'Private Driveway / Off-Street Parking',
      heating_type: 'Central Heating',
      cooling_type: 'Central Air Conditioning',
      laundry_type: 'Dedicated Laundry Hookups',
      flooring: ['Luxury Vinyl Plank', 'Tile'],
      appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Water Heater'],
      amenities: [
        'Updated Modern Interior with Luxury Vinyl Plank',
        'Bright Eat-In Kitchen with Solid Cabinetry',
        'Smart Home Technology Enabled',
        'Private Backyard',
        'Pet Friendly',
        'Smoke Free'
      ],
      description: 'Welcome to 120 Sherwood Loop — an inviting 3-bedroom, 1-bathroom single-family home offering 984 sq. ft. of clean, modern living in McDonough, GA.\n\nThis charming home features low-maintenance luxury vinyl plank flooring, fresh neutral interior paint, and a bright open living area. The spacious eat-in kitchen comes equipped with full appliances and ample cabinetry. Enjoy a private backyard perfect for outdoor gatherings and dedicated off-street driveway parking. Located in an established residential neighborhood close to McDonough Square, parks, dining, and convenient highway access.\n\nHome Features & Highlights:\n• 3 Bedrooms, 1 Full Bathroom (984 sq. ft.)\n• Luxury vinyl plank flooring and modern finishes throughout\n• Bright eat-in kitchen with full appliance suite\n• Generous private backyard\n• Dedicated off-street driveway parking\n• Central air conditioning and heating\n• Pet-friendly living (dogs and cats welcome)\n\nLease Terms:\n• Monthly Rent: $1485\n• Security Deposit: $1485\n• Application Fee: $50 per adult applicant\n• 12-Month Lease Minimum\n\nYour next home is waiting. Submit your application at Choice Properties to get started.',
      virtual_tour_url: null
    }
  ];

  for (const item of mcdonoughEnrichments) {
    const { id, ...updateData } = item;
    const res = await patchJSON(
      CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?id=eq.' + id,
      updateData,
      serviceKey
    );
    console.log('Enriched McDonough', item.address, res?.length ? 'OK' : res);
  }

  const columbusIds = [
    '72e560b8-3565-42e8-91b8-4a57a0357c84', '8c6a4ba6-b3bb-418d-827d-bcdc22e942ac',
    '4d780308-202b-4457-a840-f90ee62dbe59', 'eef0a90a-83ab-4cee-9d0e-1c49221accd4',
    'db1cba36-eed1-4f3c-acce-e978829307c3', 'ce3ab8c2-c23e-4729-94b6-05775fd59796',
    '301dff56-bc40-4d18-b149-d1ad6ba422e0', 'b62cfddf-5d84-44a9-ad99-6da225f44bef',
    '5f3eab40-dd93-4237-8a38-ea0b3f650dea', '872612e0-be61-48db-a5be-b5f4b68de927'
  ];

  for (const cid of columbusIds) {
    await patchJSON(
      CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?id=eq.' + cid,
      {
        virtual_tour_url: null,
        pets_allowed: true,
        pet_types_allowed: ['Dogs', 'Cats'],
        pet_deposit: 300,
        application_fee: 50,
        minimum_lease_months: 12
      },
      serviceKey
    );
  }
  console.log('All 10 Columbus properties verified and enriched.');
}

main().catch(console.error);
