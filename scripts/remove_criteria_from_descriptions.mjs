import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json'
};

const HEADERS_PIPELINE = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

const CLEANED_DESCRIPTIONS = {
  // 1. 285 S Champion Ave
  '29790138-d8c0-4b9d-bf58-3062158bc6a9': {
    pipelineId: 'PP-E6E3682A',
    description: `Welcome to 285 S. Champion Avenue, a charming 3-bedroom, 2-bath townhome conveniently located near downtown Columbus. This home features beautiful wood-style flooring, exposed brick accents, spacious living areas, ceiling fans, and a kitchen with plenty of counter space. Enjoy the character of this unique home while being just minutes from downtown dining, shopping, entertainment, and regional commuter corridors.

Tenant is responsible for all utilities. Application fee: $50 per adult applicant.`
  },

  // 2. 4808 McAllister Ave
  '5be1d239-259f-41d2-b712-0f5061d2e9d4': {
    pipelineId: 'PP-93486427',
    description: `Remodeled 3-bedroom, 2-bath single-family house with full basement and 1-car garage. Features plenty of storage, a private fenced-in backyard, and central heating. Situated in a quiet residential neighborhood with convenient access to regional commuter corridors and shopping.

Rent: $1,500/month. Application fee: $50 per adult applicant.`
  },

  // 3. 1138-1140 Wilson Ave
  '76ce9415-b18b-4b53-a6fa-4c3106548bbc': {
    pipelineId: 'PP-38376A79',
    description: `Spacious 3BR/1.5BA duplex unit with original hardwood floors in Columbus's South Side.

A well-maintained 3-bedroom, 1.5-bath duplex unit combining classic character with thoughtful updates. Original hardwood floors run throughout the main living areas, paired with freshly painted light French gray walls and large windows that keep every room bright and naturally lit. The living room features a picture window, a handsome decommissioned brick fireplace, and generous proportions with plenty of space for a sectional and dining setup.

The kitchen has been freshly modernized with updated cabinetry and countertop, an upgraded sink and faucet, and new wood-look luxury vinyl plank flooring—clean, practical, and easy to maintain.

New Energy Star Certified double-hung windows installed throughout help keep heating and cooling costs down. Ceiling fans in all dry rooms add comfort year-round. Glazed panels on both the front and rear exterior doors bring in additional natural light.

All three bedrooms are well-proportioned with good natural light. The full bath upstairs features a shower/tub combo and vanity; a convenient half bath is located on the main level.

The full basement provides laundry hookups and bonus storage space. Covered front porch and off-street parking in the rear round out the home. Recent exterior work like aluminum trim, fascia, soffit, and porch components means the building is in excellent shape with years of low-maintenance living ahead.

Location:
Located in Columbus's South Side, steps from local markets, restaurants, and transit. Deshler Park, a beautiful tree-lined neighborhood park, is just a short walk away. Nationwide Children's Hospital is close by, with convenient access to regional commuter corridors and shopping.

Tenant responsible for gas and electric utilities, yard maintenance, and snow removal. Application fee: $50 per adult applicant.`
  },

  // 4. 1875 Ward Rd
  '3c047dfc-228f-4003-ad46-9364c5bc387a': {
    pipelineId: 'PP-1177CFF1',
    description: `Completely updated kitchen, bath, flooring, roof, furnace, and central AC. Three-bedroom ranch with first-floor laundry, 1.5 baths, large backyard, and an oversized 2.5 car garage with extra storage area. Convenient to shopping, schools, and commuter corridors.

Rent: $1,425/month. Tenant pays all utilities, including water. Application fee: $50 per adult applicant.`
  },

  // 5. 1191 Duxberry Ave
  '05dc44a2-5f6c-41fe-b8ec-12e07c9dde54': {
    pipelineId: 'PP-E2FE6CAA',
    description: `Charming 3-bedroom, 1.5-bathroom single-family home for rent. This home features central air conditioning, a fenced backyard, and a private driveway for off-street parking. The kitchen includes a stainless steel stove and refrigerator, and washer/dryer hookups are located in the full basement. Conveniently located with easy access to downtown Columbus, regional commuter corridors, shopping, schools, and public transit.

Tenant is responsible for providing their own washer and dryer and for paying all utilities, lawn care, and weed control.

Financial Details:
- Rent: $1,495/month.
- Application fee: $50 per adult applicant.`
  }
};

async function cleanDescriptions() {
  console.log('Stripping rental criteria, minimum credit score/income, renter insurance, and submission/opportunity boilerplate from descriptions...');

  for (const [propId, item] of Object.entries(CLEANED_DESCRIPTIONS)) {
    // 1. Update public.properties
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ description: item.description })
    });
    console.log(`Updated public.properties (${propId}):`, res.status);

    // 2. Update pipeline.pipeline_properties
    const resPipe = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipelineId}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({ description: item.description })
    });
    console.log(`Updated pipeline_properties (${item.pipelineId}):`, resPipe.status);
  }

  console.log('All 5 property descriptions updated successfully!');
}

cleanDescriptions().catch(console.error);
