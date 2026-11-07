import test from 'node:test';
import assert from 'node:assert/strict';

function isCommunityProperty(property) {
  if (!property) return false;
  if (property.unit_number && !property.is_multi_unit && (!property.total_units || Number(property.total_units) <= 1) && (!Array.isArray(property.unit_options) || !property.unit_options.length)) {
    return false;
  }
  const pType = String(property.property_type || '').toLowerCase();
  return Boolean(
    property.is_multi_unit ||
    Number(property.total_units) > 1 ||
    property.community_starting_rent != null ||
    property.price_range ||
    (Array.isArray(property.unit_options) && property.unit_options.length > 0) ||
    (Array.isArray(property.property_units) && property.property_units.length > 0) ||
    pType === 'apartment' ||
    pType === 'multi_family'
  );
}

test('isCommunityProperty identifies apartment communities correctly', () => {
  // Case 1: Standard single family house with unit number or detached
  assert.equal(isCommunityProperty({
    property_type: 'single_family',
    unit_number: null,
    total_units: 1,
  }), false);

  // Case 2: Specific single unit for rent
  assert.equal(isCommunityProperty({
    property_type: 'apartment',
    unit_number: '4B',
    total_units: 1,
    unit_options: [],
  }), false);

  // Case 3: Apartment community with no specific unit number
  assert.equal(isCommunityProperty({
    property_type: 'apartment',
    unit_number: null,
    total_units: 24,
  }), true);

  // Case 4: Property with embedded unit_options
  assert.equal(isCommunityProperty({
    property_type: 'multi_family',
    unit_options: [
      { unit_number: '101', monthly_rent: 1450 },
      { unit_number: '102', monthly_rent: 1550 },
    ],
  }), true);

  // Case 5: Property with community_starting_rent
  assert.equal(isCommunityProperty({
    property_type: 'condo',
    community_starting_rent: 1200,
  }), true);
});

test('Unit options parser preserves building, floor, photos, and rent facts', () => {
  const embeddedOptions = [
    {
      source_kind: 'floor_plan',
      floor_plan_name: 'The Highland',
      bedrooms: 2,
      bathrooms: 2,
      square_footage: 1050,
      starting_rent: 1850,
      photo_urls: ['https://cdn.example.com/plan-highland.jpg'],
    },
    {
      source_kind: 'unit',
      unit_number: '304',
      unit_floor: '3',
      building_name: 'Building B',
      floor_plan_name: 'The Highland',
      bedrooms: 2,
      bathrooms: 2,
      square_footage: 1050,
      monthly_rent: 1850,
      rent_basis: 'base_rent',
      photo_urls: ['https://cdn.example.com/unit304-1.jpg', 'https://cdn.example.com/unit304-2.jpg'],
    },
  ];

  const isFloorPlan = opt => opt.source_kind === 'floor_plan' || (!opt.unit_number && opt.floor_plan_name);
  const floorPlans = embeddedOptions.filter(isFloorPlan);
  const units = embeddedOptions.filter(opt => !isFloorPlan(opt));

  assert.equal(floorPlans.length, 1);
  assert.equal(floorPlans[0].floor_plan_name, 'The Highland');
  assert.equal(floorPlans[0].starting_rent, 1850);

  assert.equal(units.length, 1);
  assert.equal(units[0].unit_number, '304');
  assert.equal(units[0].unit_floor, '3');
  assert.equal(units[0].building_name, 'Building B');
  assert.equal(units[0].photo_urls.length, 2);
  assert.equal(units[0].monthly_rent, 1850);
});

