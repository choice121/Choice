const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const REACT_DIST_DIR = path.resolve(ROOT_DIR, 'frontend', 'dist');

console.log('📦 Merging React build with legacy dist...');

if (!fs.existsSync(REACT_DIST_DIR)) {
  console.warn('⚠️  React dist not found at', REACT_DIST_DIR);
  console.warn('Make sure to run: npm run build:frontend');
  process.exit(1);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy React's index.html (SPA entry point)
const reactIndexSrc = path.join(REACT_DIST_DIR, 'index.html');
const reactIndexDest = path.join(DIST_DIR, 'index.html');
if (fs.existsSync(reactIndexSrc)) {
  fs.copyFileSync(reactIndexSrc, reactIndexDest);
  console.log('✅ Copied React index.html to dist/index.html');
}

// Copy React's assets directly to dist/assets/ (matching the paths in index.html)
const reactAssetsSrc = path.join(REACT_DIST_DIR, 'assets');
const reactAssetsDest = path.join(DIST_DIR, 'assets');
if (fs.existsSync(reactAssetsSrc)) {
  copyRecursive(reactAssetsSrc, reactAssetsDest);
  console.log('✅ Copied React assets to dist/assets/');
}

// Create direct and alternative routes for property.html, listings.html, and migration.html that serve React index
const propertyRoutePath = path.join(DIST_DIR, 'property-react.html');
const listingsRoutePath = path.join(DIST_DIR, 'listings-react.html');
const migrationRoutePath = path.join(DIST_DIR, 'migration.html');
const propertyHtmlPath = path.join(DIST_DIR, 'property.html');
const listingsHtmlPath = path.join(DIST_DIR, 'listings.html');

fs.copyFileSync(reactIndexSrc, propertyRoutePath);
fs.copyFileSync(reactIndexSrc, listingsRoutePath);
fs.copyFileSync(reactIndexSrc, migrationRoutePath);
fs.copyFileSync(reactIndexSrc, propertyHtmlPath);
fs.copyFileSync(reactIndexSrc, listingsHtmlPath);
console.log('✅ Created property.html, listings.html, and migration.html as React entry points');

console.log('\n🎉 React build successfully merged with dist/');
console.log('   Public pages now served by React (SPA)');
console.log('   Protected flows remain on legacy HTML');
