import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json'
};

const DETAILED_ENRICHMENTS = {
  // 1. 891 Lane Ave, Memphis, TN 38105
  '52d07e58-83cc-4bb0-8ad2-a0ee83a4532e': {
    amenities: [
      'Private Fenced Yard',
      'High Ceilings',
      'Eat-in Kitchen',
      'Window Coverings',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Garbage Disposal', 'Water Heater'],
    flooring: ['Hardwood', 'Tile', 'Vinyl Plank'],
    heating_type: 'Forced Air / Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Washer / Dryer Hookups in Unit',
    parking: 'Private Driveway / Off-Street Parking',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 2. 1473 Oberle Ave, Memphis, TN 38127
  'ace56bbe-a9cc-430c-82e1-0fd4b7515778': {
    amenities: [
      'Large Private Lot',
      'Spacious Backyard',
      'Eat-in Kitchen',
      'Solid Cabinetry',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Dishwasher', 'Range / Oven', 'Range Hood / Vent Hood', 'Water Heater'],
    flooring: ['Hardwood', 'Tile', 'Carpet'],
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Hookups',
    parking: 'Dedicated Driveway Parking',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 3. 756 S Graham St, Memphis, TN 38111
  'feea2592-0822-467c-bbe4-b74f32ebb3f4': {
    amenities: [
      'Original Hardwood Flooring',
      'Fenced Backyard',
      'Outdoor Storage Shed',
      'Walk to University Area / Audubon Park',
      'Ceiling Fans',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Water Heater'],
    flooring: ['Original Hardwood', 'Tile'],
    heating_type: 'Forced Air Gas Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Laundry Room with Hookups',
    parking: 'Private Driveway Parking',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 4. 970 Maple Dr, Memphis, TN 38108
  'd35b5b9c-e47a-4c3f-82f9-12d5b0fad8d9': {
    amenities: [
      'All-Brick Exterior',
      'Dual Living Areas (Living Room + Family Room)',
      'Primary Ensuite Bathroom',
      'Covered Carport',
      'Large Fenced Backyard',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Garbage Disposal', 'Water Heater'],
    flooring: ['Hardwood', 'Ceramic Tile', 'LVP'],
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Utility Room',
    parking: 'Covered Carport + Long Private Driveway',
    garage_spaces: 1,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 5. 3542 E Regency Park Cir, Memphis, TN 38115
  'b9e0e02d-83ef-4453-8465-6b73e9ba6126': {
    amenities: [
      'Quiet Residential Cul-de-sac / Circle',
      'Private Master Suite with Ensuite Bath',
      'Fully Fenced Backyard',
      'Smart Lock Ready',
      'Ceiling Fans',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Water Heater'],
    flooring: ['Hardwood Laminate', 'Tile', 'Carpet'],
    heating_type: 'Central Electric Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Washer / Dryer Hookups in Unit',
    parking: 'Private Multi-Car Driveway',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 6. 4697 Grecco Dr, Memphis, TN 38128
  'e545988f-889e-4e68-8512-45c55a36465a': {
    amenities: [
      'Expansive 1,800 Sq Ft Living Space',
      'Spacious Formal Living & Dining Rooms',
      'Oversized Private Backyard',
      'Ample Storage & Walk-in Closets',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Range / Oven', 'Dishwasher', 'Garbage Disposal', 'Water Heater'],
    flooring: ['Hardwood', 'Ceramic Tile', 'Carpet'],
    heating_type: 'Central Heating System',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Closet with Hookups',
    parking: 'Paved Driveway Parking',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 7. 736 King Ave, Memphis, TN 38109
  '00efe94f-6915-4ca0-9060-8f8206f504a7': {
    amenities: [
      'Private Primary Ensuite Bathroom',
      'Updated Modern Kitchen',
      'Fenced Backyard',
      'Low-Maintenance Luxury Flooring',
      'Minutes to Downtown & I-55',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Range / Oven', 'Range Hood', 'Refrigerator Hookup', 'Water Heater'],
    flooring: ['Luxury Vinyl Plank', 'Tile'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Home Laundry Hookups',
    parking: 'Private Driveway',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 8. 4398 Ridgewood Rd, Memphis, TN 38116
  '310c0ec7-f5c5-4ac1-b44c-aefc421bad0e': {
    amenities: [
      'Attached 1-Car Garage',
      'All-Brick Construction',
      'Enclosed Screened Back Porch',
      'Detached Storage Shed',
      'Triple Living Spaces (Living Room, Formal Dining, Bonus Den)',
      'Primary Suite with Walk-In Shower',
      'Fully Fenced Backyard',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Water Heater'],
    flooring: ['Hardwood', 'Ceramic Tile'],
    heating_type: 'Central Gas Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Separate Laundry Utility Room',
    parking: 'Attached Garage + Private Driveway',
    garage_spaces: 1,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 9. 7691 Mesa Dr, Memphis, TN 38133
  'a3b7db03-0181-4aa0-b1ce-fee033664357': {
    amenities: [
      'Bartlett School District Corridor',
      'Covered Carport',
      'Separate Outdoor Storage Cabin / Shed',
      'Fully Fenced Private Backyard',
      'Freshly Painted Interior',
      'Upgraded Master Bedroom Flooring',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Water Heater'],
    flooring: ['Luxury Vinyl Plank', 'Tile', 'Carpet'],
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Washer / Dryer Hookups in Unit',
    parking: 'Covered Carport + Driveway',
    garage_spaces: 1,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 10. 6326 Valleydale Dr, Memphis, TN 38141
  '88e99e19-ed2d-4766-af24-e29371f80a65': {
    amenities: [
      'Soaring High Vaulted Ceilings',
      'Centerpiece Brick Fireplace',
      'Attached 1-Car Garage',
      'Open Chef Kitchen with Tile Flooring',
      'Dedicated Formal Dining Room',
      'Spacious Fully Fenced Backyard Oasis',
      'Desirable Southwind Area',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Disposal', 'Water Heater'],
    flooring: ['Hardwood', 'Ceramic Tile', 'Plush Carpet'],
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Closet with Full Hookups',
    parking: 'Attached 1-Car Garage + Private Driveway',
    garage_spaces: 1,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 11. 1477 Lyndale Ave, Memphis, TN 38107
  'b1e88a0b-847e-48b8-a38b-f53ff371749d': {
    amenities: [
      'Spacious 1,492 Sq Ft 2-Bedroom Layout',
      'Dual Private Bathrooms (2 Full Baths)',
      'Large Open Living Area',
      'Private Fenced Yard',
      'Rapid Access to Downtown & Medical District',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Water Heater'],
    flooring: ['Hardwood Laminate', 'Tile'],
    heating_type: 'Central Heating System',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Room with Hookups',
    parking: 'Private Off-Street Driveway',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 12. 523 Shofner Dr, Memphis, TN 38109
  '6d2e46a2-41ee-4328-9710-1bcc0eb9eaca': {
    amenities: [
      'Triple Living Zones (Living Room, Dining Room, & Den)',
      'Gleaming Refinished Hardwood Floors',
      'Renovated Primary Bathroom Suite',
      'Included In-Home Washer & Dryer Appliances',
      'Included Refrigerator',
      'Expansive Serenity Backyard Retreat',
      'Ceiling Fans Throughout',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Washing Machine', 'Dryer', 'Refrigerator', 'Range / Oven', 'Water Heater'],
    flooring: ['Refinished Hardwood', 'New Carpet', 'Tile'],
    heating_type: 'Central Heating System',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Included',
    parking: 'Private Driveway',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 13. 949 Kney St, Memphis, TN 38107
  'e27f6d1a-1cd0-40fb-a9a7-abc16fa6fca3': {
    amenities: [
      'Complete Top-to-Bottom Renovation',
      'Soaring High Ceilings & Smooth Ceilings',
      'Open-Concept Living & Dining with Breakfast Bar Island',
      'Dedicated Work-From-Home Office Nook',
      'Southern-Style Covered Front Porch',
      'Private Rear Concrete Parking Pad',
      'Walking Distance to $150M+ Northside Square & 5 Mins to St. Jude',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Range / Oven', 'Dishwasher', 'Range Hood', 'Refrigerator', 'Water Heater'],
    flooring: ['Luxury Vinyl Plank', 'Tile'],
    heating_type: 'High-Efficiency Central Heat',
    cooling_type: 'High-Efficiency Central Air',
    laundry_type: 'Separate Dedicated Laundry Room with Storage',
    parking: 'Private Rear Parking Pad + Street Parking',
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    has_central_air: true,
    has_basement: false
  },

  // 14. 3290 Myrtle Dr, Loveland, OH 45140
  '3b7175dd-fd47-4015-ab20-fc5568c3e35f': {
    amenities: [
      'Flexible Layout (3BR or 2BR + Mother-in-Law Suite w/ 2nd Kitchen)',
      'Unfinished Full Basement (Abundant Storage / Workshop)',
      'Attached 1-Car Garage + Driveway',
      'Expansive Backyard',
      'Kings Local School District',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Secondary Kitchenette Appliances', 'Water Heater'],
    flooring: ['Hardwood', 'Tile', 'Carpet'],
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Laundry Hookups',
    parking: 'Attached Garage + Private Driveway',
    garage_spaces: 1,
    has_basement: true,
    has_central_air: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300
  },

  // 15. 4257 Spyglass Hl, Mason, OH 45040
  'fff7b810-87d7-4ce8-89a3-bf6004b250cf': {
    amenities: [
      '2 Bedrooms + Dedicated Loft / Home Office Space',
      'Attached Garage + Private Driveway',
      'Large Private Backyard',
      'Hardwood Floors & Brand New Carpeting',
      'New Energy-Efficient Windows',
      'HOA Fees Covered by Owner',
      'Mason City School District',
      'Pet Friendly',
      'Smoke Free'
    ],
    appliances: ['Washer', 'Dryer', 'Refrigerator', 'Dishwasher', 'Range / Oven', 'Disposal', 'Water Heater'],
    flooring: ['Hardwood', 'New Carpet', 'Ceramic Tile'],
    heating_type: 'Central Gas Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Included',
    parking: 'Attached Garage + Private Driveway',
    garage_spaces: 1,
    has_basement: false,
    has_central_air: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300
  }
};

async function updatePropertyEnrichments() {
  console.log('Enriching all properties with detailed amenities, appliances, heating/cooling, flooring & parking...');

  for (const [propId, data] of Object.entries(DETAILED_ENRICHMENTS)) {
    console.log(`Updating ${propId}...`);
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${encodeURIComponent(propId)}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify(data)
    });
    console.log(`Updated ${propId}: Status ${patchRes.status}`);
  }

  console.log('\nAll properties have been enriched with high-detail specs!');
}

updatePropertyEnrichments().catch(console.error);
