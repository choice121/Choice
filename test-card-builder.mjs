import fs from 'fs';
const buildPropertyCardCode = fs.readFileSync('./js/card-builder.js', 'utf8');

// Mock browser globals
global.window = {
  CP: { UI: { propertyUrl: () => '/prop/123' } },
  CONFIG: { baseUrl: 'https://choice-properties-site.pages.dev' }
};
global.document = {};

eval(buildPropertyCardCode);

const prop = {
  id: '35ef2606-6a78-40fa-89b9-e3d118c990b3',
  title: 'Test',
  monthly_rent: 1000,
  photo_urls: ['/test.jpg'],
  address_street: '123 Main',
  address_city: 'City',
  address_state: 'ST',
  address_zip: '12345',
  bedrooms: 2,
  bathrooms: 1,
  sqft: 1000
};

try {
  const html = window.buildPropertyCard(prop);
  console.log("SUCCESS");
} catch(e) {
  console.log("ERROR:", e);
}
