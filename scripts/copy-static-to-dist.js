const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
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
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // If destination file exists (e.g. from vite build), only copy if not dist/index.html
    if (path.resolve(dest) === path.resolve(DIST_DIR, 'index.html')) {
      return; // Keep Vite built index.html as main SPA root
    }
    fs.copyFileSync(src, dest);
  }
}

// 1. Copy directories
const dirsToCopy = [
  'admin',
  
  'landlord',
  'tenant',
  'auth',
  'components',
  'js',
  'css',
  'assets',
  'webfonts',
  '.well-known',
];

dirsToCopy.forEach((dir) => {
  const src = path.join(ROOT_DIR, dir);
  const dest = path.join(DIST_DIR, dir);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log(`✅ Copied ${dir}/ to dist/${dir}/`);
  }
});

// 2. Copy root files
const filesToCopy = [
  // React will provide these via SPA routing:
  // 'index.html',     // Provided by React SPA entry
  // 'property.html',  // Served by React /property route
  // 'listings.html',  // Served by React /listings route
  
  // Keep these legacy files and configs
  'config.js',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'sitemap-pages.xml',
  '_headers',
  '_redirects',
  'about.html',
  'fair-housing.html',
  'faq.html',
  'health.html',
  'holding-deposit-policy.html',
  'how-it-works.html',
  'how-to-apply.html',
  'landlord-platform-agreement.html',
  'lease-sign.html',
  'policies.html',
  'policy-changelog.html',
  'privacy.html',
  'rental-application-policy.html',
  'terms.html',
  'verify-lease.html',
  'matches.html',
  'count.html',
  'setup-credentials.html',
  '404.html',
];

filesToCopy.forEach((file) => {
  const src = path.join(ROOT_DIR, file);
  const dest = path.join(DIST_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied ${file} to dist/${file}`);
  }
});

console.log('🎉 Successfully populated dist/ with all static admin, landlord, tenant, apply, and platform resources.');
