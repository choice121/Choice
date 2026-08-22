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
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.vscode') continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 1. Copy full directories
const dirsToCopy = [
  'admin',
  'apply',
  'landlord',
  'tenant',
  'auth',
  'components',
  'js',
  'css',
  'assets',
  'webfonts',
  '.well-known',
  'functions'
];

dirsToCopy.forEach((dir) => {
  const src = path.join(ROOT_DIR, dir);
  const dest = path.join(DIST_DIR, dir);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log(`✅ Copied ${dir}/ to dist/${dir}/`);
  }
});

// 2. Copy all root-level HTML files, configs, and headers/redirects
const rootFiles = fs.readdirSync(ROOT_DIR).filter(file => {
  const stat = fs.statSync(path.join(ROOT_DIR, file));
  if (stat.isDirectory()) return false;
  return file.endsWith('.html') || 
         file.endsWith('.json') || 
         file.endsWith('.xml') || 
         file.endsWith('.txt') || 
         file.endsWith('.js') || 
         file === '_headers' || 
         file === '_redirects' || 
         file === '.cfpagesignore' || 
         file === '.nojekyll';
});

rootFiles.forEach((file) => {
  if (file === 'generate-config.js' || file === 'serve.js' || file === 'server.js') return;
  const src = path.join(ROOT_DIR, file);
  const dest = path.join(DIST_DIR, file);
  fs.copyFileSync(src, dest);
  console.log(`✅ Copied ${file} to dist/${file}`);
});

console.log('🎉 Successfully populated dist/ directory for Cloudflare Pages deployment.');
