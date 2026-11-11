import fs from 'fs';
const props = JSON.parse(fs.readFileSync('scripts/detailed_19_properties.json', 'utf8'));

props.forEach(p => {
  console.log(`\n============================================================`);
  console.log(`PROPERTY #${p.index}: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);
  console.log(`Source URL: ${p.source_url}`);
  console.log(`FULL ORIGINAL DESCRIPTION:\n${p.original_description}`);
});
