import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const UPDATES = [
  // 1. 3112 NE 12th St, Oklahoma City, OK 73117 ($1,000/mo)
  {
    id: '030052c5-495d-4847-83b4-622a5a01704a',
    address: '3112 NE 12th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73117',
    title: '3112 NE 12th St, Oklahoma City, OK 73117',
    monthly_rent: 1000,
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 1000,
    lot_size_sqft: 6000,
    property_type: 'SINGLE_FAMILY',
    year_built: 1955,
    parking: 'Private Driveway Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Brand New Forced Air Natural Gas HVAC',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Stainless Steel Gas Range / Oven',
      'Stainless Steel Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Brand New HVAC System',
      'Remodeled Kitchen with New Countertops',
      'Beautiful New Flooring Throughout',
      'New Plumbing & Light Fixtures',
      'Private Fenced Backyard',
      'Mature Shade Trees',
      'Pet-Friendly'
    ],
    description: `A tastefully renovated single-story home positioned on a pleasant, tree-lined street in an established Oklahoma City neighborhood. Showcasing 1,000 square feet of thoughtfully updated living space, this charming residence pairs dependable mid-century craft with substantial modern upgrades.

The main entry opens directly into a comfortable living room featuring fresh neutral paint, updated trim, and durable, beautiful new flooring that flows continuously across the primary living zones. Generous picture windows introduce steady natural light throughout the daytime hours.

Centering the home's daily routine, the remodeled kitchen has been comprehensively upgraded with brand-new countertops, fresh cabinetry, contemporary light fixtures, and a brand-new stainless steel appliance package including a gas range/oven and full refrigerator. Dedicated laundry utility hookups are cleanly positioned nearby.

Accommodations consist of 3 well-separated bedrooms, each appointed with fresh flooring, ample closet storage, and wide windows for balanced cross-ventilation. The central full bathroom features a modernized vanity, updated fixtures, and a clean tiled tub and shower surround.

Year-round interior comfort is managed by a newly installed central HVAC heating and cooling system. Outside, the large private backyard is completely enclosed by perimeter fencing and sheltered by mature shade trees, offering an ideal outdoor retreat. The long private driveway accommodates convenient off-street resident parking.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 2. 1240 NE 42nd St, Oklahoma City, OK 73111 ($900/mo)
  {
    id: '125c4ad8-0864-4fd2-bbcf-7da947e6fe7c',
    address: '1240 NE 42nd St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73111',
    title: '1240 NE 42nd St, Oklahoma City, OK 73111',
    monthly_rent: 900,
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 1039,
    lot_size_sqft: 6000,
    property_type: 'SINGLE_FAMILY',
    year_built: 1950,
    parking: 'Attached Garage & Private Driveway',
    garage_spaces: 1,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Range / Oven',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Attached Single-Car Garage',
      'Laminate Flooring Throughout',
      'Spacious Fenced Backyard',
      'Central Air Conditioning',
      'Direct I-235 Corridor Access',
      'Minutes to OU Health Sciences Center',
      'Pet-Friendly'
    ],
    description: `Positioned with exceptional commuter convenience just off the I-235 corridor, this attractive 1,039-square-foot single-family home delivers comfortable single-level living near the OU Health Sciences Center and downtown Oklahoma City.

The welcoming front entrance leads into a spacious main living area highlighted by low-maintenance laminate flooring, warm natural lighting, and clean, neutral wall tones. The connected flow makes entertaining guests and relaxed evenings effortless.

The home's culinary center features practical cabinet storage, solid counter surfaces, and an included kitchen appliance suite with a cooktop range, oven, and refrigerator. Dedicated laundry utility hookups provide full at-home washing convenience.

Restful accommodations feature 2 sizable bedrooms with generous closet organization and wide windows. The bright full bathroom serves the home with a solid vanity, updated hardware, and a combined tub and shower enclosure.

A single-car attached garage provides protected vehicle parking and valuable workshop or seasonal storage, complemented by a broad concrete driveway. Step out back to enjoy an expansive fenced backyard ideal for outdoor activities and private relaxation. Central air conditioning and natural gas heating keep every room comfortable in all seasons.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 3. 2541 NW 34th St, Oklahoma City, OK 73112 ($1,000/mo)
  {
    id: '57430ee0-61a4-4142-915b-946d228da9da',
    address: '2541 NW 34th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73112',
    title: '2541 NW 34th St, Oklahoma City, OK 73112',
    monthly_rent: 1000,
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 1013,
    lot_size_sqft: 7000,
    property_type: 'SINGLE_FAMILY',
    year_built: 1947,
    parking: 'Detached Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Upgraded Central Natural Gas HVAC',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Range / Oven',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Extensively Renovated Interior',
      'Upgraded Electrical & Plumbing',
      'New Energy-Efficient Windows & Roof',
      'Detached Garage',
      'Generous 7,000 Sqft Lot',
      'Large Fenced Backyard',
      'Pet-Friendly'
    ],
    description: `A classic 1947 bungalow beautifully reimagined through extensive renovations, situated in a sought-after northwest Oklahoma City enclave close to local dining, shopping, and entertainment. Covering 1,013 square feet on a spacious 7,000-square-foot lot, the home combines timeless character with modern infrastructure.

A welcoming covered front stoop ushers you into an open-concept living and gathering room adorned with contemporary architectural finishes, refined trim details, and new energy-efficient double-pane windows that fill the space with cheerful sunlight.

The kitchen is designed for efficiency and everyday culinary enjoyment, presenting updated cabinetry, expansive preparation surfaces, durable flooring, and essential cooking appliances with range, oven, and refrigerator. Dedicated washer/dryer hookups are neatly situated adjacent to the kitchen.

Two generously scaled bedrooms offer restful privacy, equipped with organized closets and easy access to the pristine full bathroom, which boasts modernized fixtures and a clean shower/tub combination. Comprehensive system renovations include upgraded plumbing, fresh wiring, a new roof, and modern central heating and air conditioning.

Outside, the property provides a detached garage for secure parking or hobby storage alongside a sprawling, fully fenced backyard that offers vast green lawn space for outdoor gatherings.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 4. 9308 Greystone Ave, Oklahoma City, OK 73120 ($950/mo)
  {
    id: '5d7c661a-167a-4d6a-8415-6b2a1a793c4a',
    address: '9308 Greystone Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73120',
    title: '9308 Greystone Ave, Oklahoma City, OK 73120',
    monthly_rent: 950,
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2.0,
    square_footage: 1110,
    lot_size_sqft: 7500,
    property_type: 'SINGLE_FAMILY',
    year_built: 1965,
    parking: 'Attached 2-Car Garage & Wide Driveway',
    garage_spaces: 2,
    heating_type: 'Updated Central HVAC System',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'The Village Residential Neighborhood',
      'Bonus Den / Home Office with Full Bath',
      'Two Full Bathrooms',
      'Covered Outdoor Patio',
      'Detached Backyard Storage Shed',
      'Attached 2-Car Garage',
      'Updated Windows & Roof',
      'Pet-Friendly'
    ],
    description: `Nestled in the highly desirable community of The Village in northwest Oklahoma City, this versatile 1,110-square-foot residence offers a rare combination of 2 bedrooms, 2 full bathrooms, and an adaptable bonus den or executive home office.

The expansive main living area welcomes you with an open ambiance, framed by updated windows and a seamless progression toward the dining area and kitchen. Contemporary updates include a new roof, updated windows, and modern interior lighting.

The kitchen is fully appointed for effortless meal preparation, featuring a dishwasher, cooktop range, oven, and refrigerator set among generous cabinetry and counter work areas. An interior laundry area with washer/dryer hookups completes the utility layout.

In addition to the primary bedroom quarters, the home features a flexible bonus room—ideal as an office, den, or guest space—served by its own dedicated second full bathroom. Both bathrooms showcase updated vanities, clean fixtures, and quality tile finishes.

Outdoor living shines with a substantial covered rear patio overlooking a deep, fully fenced backyard equipped with a private storage shed. An attached 2-car garage and extended driveway provide abundant parking and workspace capacity.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 5. 1453 SW 61st Ter, Oklahoma City, OK 73159 ($1,000/mo)
  {
    id: '8137e2d8-58af-4cfa-9308-2e8f57d2180e',
    address: '1453 SW 61st Ter',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73159',
    title: '1453 SW 61st Ter, Oklahoma City, OK 73159',
    monthly_rent: 1000,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2.0,
    square_footage: 1075,
    lot_size_sqft: 7013,
    property_type: 'SINGLE_FAMILY',
    year_built: 1961,
    parking: 'Attached Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Stove / Range',
      'Dishwasher',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Renovated Kitchen with Painted Cabinets',
      'Dedicated Primary Bedroom Suite',
      'Updated Flooring Throughout',
      'Attached Garage',
      'Large 7,013 Sqft Lot with Fenced Lawn',
      'Central Heating & Air Conditioning',
      'Pet-Friendly'
    ],
    description: `A comfortable, fully updated single-family residence spanning 1,075 square feet on a 7,013-square-foot lot in south Oklahoma City, convenient to shopping, parks, and major travel arteries.

The entrance introduces a generous main living room finished in crisp neutral tones and updated flooring, providing an easy-flowing environment tailored for relaxation and family gatherings. Large front-facing windows invite natural daylight inside.

The renovated kitchen features freshly painted cabinetry, durable countertops, and an integrated appliance arrangement that includes a dishwasher, cooktop range, oven, and refrigerator. Connected dining space ensures meal times are convenient and casual.

The private bedroom layout comprises 3 well-proportioned rooms, headlined by an accommodating primary suite featuring a private en-suite bathroom. A second full hallway bathroom services the remaining bedrooms, both bathrooms equipped with modern fixtures and clean vanity appointments.

Complete with an attached single-car garage and laundry hookups, the home extends outdoors to a large, fully fenced backyard that offers ample private grounds for outdoor leisure.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 6. 3701 NW 57th St, Oklahoma City, OK 73112 ($1,000/mo)
  {
    id: '9f76b12c-a216-4c60-9b7b-1d864e425906',
    address: '3701 NW 57th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73112',
    title: '3701 NW 57th St, Oklahoma City, OK 73112',
    monthly_rent: 1000,
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 995,
    lot_size_sqft: 6500,
    property_type: 'SINGLE_FAMILY',
    year_built: 1952,
    parking: 'Private Driveway Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Dishwasher',
      'Gas Stove / Range',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Refinished Original Hardwood Floors',
      'Remodeled Kitchen with Quartz Counters',
      'Custom Tile Backsplash',
      'New Cabinetry',
      'Central HVAC System',
      'Private Fenced Yard',
      'Pet-Friendly'
    ],
    description: `Full of authentic mid-century warmth and elevated by refined contemporary renovations, this 995-square-foot northwest Oklahoma City home delivers classic architecture and upscale finishes in a peaceful, established neighborhood.

Original hardwood floors have been carefully refinished to a lustrous shine throughout the living room, hallway, and bedrooms. The inviting living room is illuminated by ample natural light, creating an airy and stylish gathering center.

The remodeled kitchen stands out with custom cabinetry, sparkling quartz countertops, a designer tile backsplash, and quality appliances including a built-in dishwasher, gas stove/range, and refrigerator. Dedicated in-home laundry hookups provide seamless day-to-day convenience.

Both bedrooms are comfortably sized with warm hardwood flooring and generous wardrobe closets. The updated central full bathroom features a crisp vanity and a clean shower/tub surround with modern plumbing hardware.

Outside, the property boasts a private, fully fenced backyard that offers a peaceful retreat for open-air dining or pet playtime. A dedicated driveway ensures convenient off-street resident parking.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 7. 6101 Gaelic Glen Dr, Oklahoma City, OK 73142 ($1,000/mo)
  {
    id: 'b24d5acc-c557-4a5e-ab24-0a7b5ab63219',
    address: '6101 Gaelic Glen Dr',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73142',
    title: '6101 Gaelic Glen Dr, Oklahoma City, OK 73142',
    monthly_rent: 1000,
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 2.5,
    square_footage: 1450,
    lot_size_sqft: 3500,
    property_type: 'TOWNHOUSE',
    year_built: 2004,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Dishwasher',
      'Built-in Microwave',
      'Range / Oven',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Modern 2004 Townhome Construction',
      'Attached 2-Car Garage',
      'Open Great Room Design',
      'Main-Floor Powder Room',
      'Private Fenced Patio Yard',
      'Putnam City North High Attendance',
      'Pet-Friendly'
    ],
    description: `Constructed in 2004, this spacious 1,450-square-foot multi-level townhome in northwest Oklahoma City combines modern suburban architecture, generous living quarters, and top Putnam City North attendance boundaries.

The main level reveals an expansive great room layout where living and dining spaces integrate gracefully, enhanced by tall ceilings, large sunny windows, and durable, easy-care flooring. A convenient main-floor powder room serves guests effortlessly.

Overlooking the living area, the open kitchen is fully outfitted with rich cabinetry, an expansive breakfast bar, and a full appliance suite comprising a built-in microwave, dishwasher, range/oven, and refrigerator. Dedicated laundry utility connections are conveniently located.

Upstairs, the home provides 3 private bedrooms including a spacious primary suite featuring a walk-in closet and a private en-suite bathroom. A second full bathroom serves the additional bedrooms with clean tile work and modern vanities.

Vehicle parking and storage are well-accommodated by an attached 2-car garage with interior access. Step through sliding glass doors to a low-maintenance, fully fenced rear patio yard ideal for morning coffee and pet play.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 8. 733 NE 34th Ter, Oklahoma City, OK 73105 ($950/mo)
  {
    id: 'c518155b-bd7d-42cf-99f2-78df5b9416aa',
    address: '733 NE 34th Ter',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73105',
    title: '733 NE 34th Ter, Oklahoma City, OK 73105',
    monthly_rent: 950,
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 1202,
    lot_size_sqft: 6970,
    property_type: 'SINGLE_FAMILY',
    year_built: 1950,
    parking: 'Private Driveway Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Gas Range / Oven',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Vaulted Ceilings in Living & Primary Bedroom',
      'No Rear Neighbors (Backs to Open Green Space)',
      'Substantial Dedicated Laundry Utility Room',
      'Real Wood Flooring',
      'Large Shaded Fenced Yard',
      'Central Air Conditioning',
      'Pet-Friendly'
    ],
    description: `A distinctive 1,202-square-foot mid-century residence characterized by soaring vaulted ceilings, substantial lot dimensions, and exceptional privacy backing directly onto open community green space with no rear neighbors.

Stepping through the front door, the dramatic vaulted ceilings immediately impart an impressive sense of volume to the main living room, accentuated by natural wood flooring and broad picture windows overlooking the front lawn.

The central kitchen is efficiently configured with solid wood cabinetry, durable prep surfaces, and reliable cooking appliances including a gas range/oven and full-sized refrigerator. Adjoining the kitchen, an oversized dedicated laundry room offers extensive storage and utility washer/dryer hookups.

The home accommodates 3 spacious bedrooms, with the primary bedroom uniquely benefiting from its own elevated vaulted ceiling line and expansive closet. The full bathroom features updated vanity lighting, modern plumbing fixtures, and a classic tile-lined bath and shower.

Central heating and air conditioning ensure optimal climate control throughout every season. The deep, tree-canopied backyard is completely fenced, offering a private, quiet natural backdrop with no rear residences.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 9. 708 SE 60th St, Oklahoma City, OK 73149 ($900/mo)
  {
    id: 'd14dfdc2-181e-4949-a738-9c49da841fb0',
    address: '708 SE 60th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73149',
    title: '708 SE 60th St, Oklahoma City, OK 73149',
    monthly_rent: 900,
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 1074,
    lot_size_sqft: 6200,
    property_type: 'SINGLE_FAMILY',
    year_built: 1968,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Range / Oven',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Upgraded Kitchen Cabinetry',
      'Durable Ceramic Tile & Carpet Flooring',
      'Expansive Fully Fenced Backyard',
      'Single-Level Convenience',
      'South Oklahoma City Residential Setting',
      'Central Air Conditioning',
      'Pet-Friendly'
    ],
    description: `A comfortable, single-story 1,074-square-foot brick and frame home located in an established residential pocket of south Oklahoma City, offering easy access to Interstate 35, local parks, and shopping.

The front entry opens directly into a sun-filled living room featuring resilient tile and soft carpet surfaces, creating a warm and versatile space for daily relaxation and gatherings.

The upgraded kitchen is fitted with quality cabinetry, ample countertop work areas, and essential cooking equipment with range, oven, and refrigerator. Dedicated laundry utility connections make household routines straightforward.

Down the main hall, 3 nicely sized bedrooms each offer comfortable closet storage, ceiling fans, and large windows. The central full bathroom is neatly maintained with clean tile surrounds and updated fixtures.

A wide private driveway provides off-street parking, while the expansive rear yard is fully fenced with sturdy fencing, providing a safe, generous perimeter for pets and outdoor leisure.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 10. 4705 S Hudson Ave, Oklahoma City, OK 73109 ($950/mo)
  {
    id: 'eba435de-aa55-4d62-aa99-c5c370a704c5',
    address: '4705 S Hudson Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73109',
    title: '4705 S Hudson Ave, Oklahoma City, OK 73109',
    monthly_rent: 950,
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 850,
    lot_size_sqft: 6852,
    property_type: 'SINGLE_FAMILY',
    year_built: 1947,
    parking: 'Private Driveway Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Natural Gas Heating',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Stove / Range',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Refinished Real Hardwood Flooring',
      'Recently Remodeled Bathroom with Custom Shower',
      'New Interior Paint Throughout',
      'New Luxury Vinyl Plank in Kitchen & Bath',
      'Updated Countertops',
      'Spacious 6,852 Sqft Fenced Lot',
      'Pet-Friendly'
    ],
    description: `Impeccably remodeled and showcasing timeless craftsmanship, this delightful 850-square-foot cottage in south Oklahoma City features gleaming refinished original hardwood floors and a fresh, clean modern aesthetic.

The welcoming main living room greets guests with rich, restored genuine hardwoods, fresh interior paint, and sunny double-hung windows that highlight the fine architectural millwork.

The eat-in kitchen has been updated with brand-new luxury vinyl plank flooring, updated countertops, clean white cabinetry, and included cooking appliances with stove, range, and refrigerator. In-home washer/dryer hookups provide complete laundry convenience.

Both bedrooms feature polished original hardwood floors and comfortable wardrobe closets. The newly remodeled full bathroom stands out with an all-new custom shower surround, updated faucets, and contemporary vanity hardware.

Outside, the property sits on a spacious 6,852-square-foot parcel featuring an expansive, fully fenced private backyard and a long driveway for off-street parking. Central air conditioning and heating ensure complete seasonal comfort.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 11. 808 N Markwell Ave, Oklahoma City, OK 73127 ($950/mo)
  {
    id: 'f1d34ad5-9fdd-4509-abea-73ad5218adbd',
    address: '808 N Markwell Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73127',
    title: '808 N Markwell Ave, Oklahoma City, OK 73127',
    monthly_rent: 950,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2.0,
    square_footage: 1268,
    lot_size_sqft: 6500,
    property_type: 'SINGLE_FAMILY',
    year_built: 1975,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    laundry_type: 'Hookups',
    application_fee: 50,
    pets_allowed: true,
    appliances: [
      'Dishwasher',
      'Range / Oven',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    amenities: [
      'Classic Four-Sided Brick Exterior',
      'Attached 2-Car Garage',
      'Luxury Vinyl Plank (LVP) Flooring',
      'Fully Fenced Backyard with Storage Shed',
      '2 Minutes to Lake Overholser & Parks',
      'Putnam City School Attendance',
      'Pet-Friendly'
    ],
    description: `A solid brick-front residence encompassing 1,268 square feet in west Oklahoma City, located just 2 minutes from scenic Lake Overholser, recreational trails, and neighborhood parks within the Putnam City School District.

The front entry leads into an open, light-filled living area adorned with durable luxury vinyl plank (LVP) flooring, fresh interior tones, and broad windows for a modern, low-maintenance lifestyle.

The kitchen is designed for functionality and ease, offering generous cabinet storage, wrap-around prep counters, and a quality appliance inventory that includes a dishwasher, range/oven, and refrigerator. Dedicated washer/dryer hookups are neatly situated in an adjoining utility space.

Restful quarters include 3 spacious bedrooms with resilient LVP flooring and deep closet storage. The primary suite features an en-suite full bathroom, while a second full hallway bathroom services family members and guests with clean vanity fixtures and a solid tub/shower combination.

A spacious 2-car attached garage offers secure parking and abundant room for storage and workbench projects. The private rear yard is fully fenced and features a separate storage shed for tools and lawn equipment.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  }
];

async function run() {
  console.log(`Starting live enrichment and verification update for ${UPDATES.length} properties...`);

  // Verify uniqueness and quality rules across all descriptions before applying
  const openings = UPDATES.map(u => u.description.split('.')[0]);
  const uniqueOpenings = new Set(openings);
  if (uniqueOpenings.size !== UPDATES.length) {
    throw new Error('Description uniqueness check failed: duplicate opening sentences detected!');
  }

  for (const u of UPDATES) {
    const desc = u.description.toLowerCase();
    if (desc.includes('deposit')) {
      throw new Error(`Security deposit mention found in description for ${u.address}`);
    }
    if (desc.includes('lease') && !desc.includes('release')) {
      throw new Error(`Lease term mention found in description for ${u.address}`);
    }
    if (desc.includes('available now') || desc.includes('move-in ready') || desc.includes('ready for move-in')) {
      throw new Error(`Availability date mention found in description for ${u.address}`);
    }
    if (desc.includes('smoking')) {
      throw new Error(`Smoking mention found in description for ${u.address}`);
    }
    if (!desc.includes('$50') && !desc.includes('50 per adult applicant')) {
      throw new Error(`Application fee $50 missing from description for ${u.address}`);
    }
    if (!desc.includes('pet-friendly')) {
      throw new Error(`Pet-friendly missing from description for ${u.address}`);
    }
  }

  console.log('✅ All descriptions passed uniqueness, surgical cleaning, and compliance audits.');

  let updatedCount = 0;
  for (const item of UPDATES) {
    const { id, ...fields } = item;
    const url = `${SUPABASE_URL}/rest/v1/properties?id=eq.${id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify(fields)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ Failed to update ${item.address} (${id}):`, res.status, errText);
    } else {
      const returned = await res.json();
      console.log(`✅ [${++updatedCount}/${UPDATES.length}] Successfully enriched: ${item.address} | Rent: $${item.monthly_rent} | Beds: ${item.bedrooms} | Baths: ${item.bathrooms} | Sqft: ${item.square_footage}`);
    }
  }

  console.log(`\n🎉 Completed updating ${updatedCount}/${UPDATES.length} properties.`);
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
