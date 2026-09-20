#!/usr/bin/env node
/**
 * Choice Properties — Automatic Extension Version & Live Sync Engine
 * ===================================================================
 * 1. Checks current version in chrome-extension/manifest.json
 * 2. Increments major or minor version (e.g. 5.0.0 -> 6.0.0)
 * 3. Syncs extractor rules into chrome-extension, .pages-orion, and edge functions
 * 4. Regenerates .pages-orion/live-content.js with updated version stamps
 * 5. Packages public/choice-properties-extension.zip
 * 6. Generates Chrome update manifest (updates.xml) for auto-updating clients
 *
 * Usage:
 *   node scripts/sync-and-bump-extension.mjs           (Bumps major: 5.0.0 -> 6.0.0)
 *   node scripts/sync-and-bump-extension.mjs --minor   (Bumps minor: 5.0.0 -> 5.1.0)
 *   node scripts/sync-and-bump-extension.mjs --patch   (Bumps patch: 5.0.0 -> 5.0.1)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MANIFEST_PATH = path.join(ROOT, 'chrome-extension', 'manifest.json');
const ORION_MANIFEST_PATH = path.join(ROOT, '.pages-orion', 'manifest.json');
const LIVE_CONTENT_PATH = path.join(ROOT, '.pages-orion', 'live-content.js');
const EXTENSION_DIR = path.join(ROOT, 'chrome-extension');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ZIP_PATH = path.join(PUBLIC_DIR, 'choice-properties-extension.zip');
const UPDATE_XML_PATH = path.join(PUBLIC_DIR, 'extension-updates.xml');

// ── 1. Read and bump version ──────────────────────────────────────────
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('Error: manifest.json not found at', MANIFEST_PATH);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const currentVersion = manifest.version || '5.0.0';
const parts = currentVersion.split('.').map(n => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);

const isMinor = process.argv.includes('--minor');
const isPatch = process.argv.includes('--patch');

let newVersion;
if (isPatch) {
  parts[2] += 1;
  newVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
} else if (isMinor) {
  parts[1] += 1;
  parts[2] = 0;
  newVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
} else {
  // Default: bump major version as requested by user (5.0.0 -> 6.0.0)
  parts[0] += 1;
  parts[1] = 0;
  parts[2] = 0;
  newVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
}

console.log(`🚀 Bumping Extension Version: v${currentVersion} ➔ v${newVersion}`);

manifest.version = newVersion;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

if (fs.existsSync(ORION_MANIFEST_PATH)) {
  const orionManifest = JSON.parse(fs.readFileSync(ORION_MANIFEST_PATH, 'utf8'));
  orionManifest.version = newVersion;
  fs.writeFileSync(ORION_MANIFEST_PATH, JSON.stringify(orionManifest, null, 2) + '\n', 'utf8');
}

// ── 2. Run Canonical Extractor Synchronizer ───────────────────────────
console.log('🔄 Building extractor variants...');
execSync('node scripts/build-extractors.js', { cwd: ROOT, stdio: 'inherit' });

// ── 3. Update version headers & constants in files ─────────────────
const EXT_CONTENT_PATH = path.join(ROOT, 'chrome-extension', 'content.js');
if (fs.existsSync(EXT_CONTENT_PATH)) {
  let contentJs = fs.readFileSync(EXT_CONTENT_PATH, 'utf8');
  contentJs = contentJs.replace(
    /var VERSION\s*=\s*['"][^'"]+['"];/,
    `var VERSION  = '${newVersion}';`
  );
  contentJs = contentJs.replace(
    /\/\/\s*Choice Properties — Universal Content Script & UI Engine v[^\n]+/,
    `// Choice Properties — Universal Content Script & UI Engine v${newVersion}`
  );
  fs.writeFileSync(EXT_CONTENT_PATH, contentJs, 'utf8');
  console.log(`✓ Updated chrome-extension/content.js with v${newVersion}`);
}

const POPUP_HTML_PATH = path.join(ROOT, 'chrome-extension', 'popup.html');
if (fs.existsSync(POPUP_HTML_PATH)) {
  let popupHtml = fs.readFileSync(POPUP_HTML_PATH, 'utf8');
  popupHtml = popupHtml.replace(
    /<span id="ext-version-pill"[^>]*>v[^<]*<\/span>/,
    `<span id="ext-version-pill" style="font-size:10px;font-weight:600;background:rgba(99,102,241,0.25);color:#a5b4fc;padding:2px 6px;border-radius:4px;border:1px solid rgba(165,180,252,0.3);margin-left:4px">v${newVersion}</span>`
  );
  fs.writeFileSync(POPUP_HTML_PATH, popupHtml, 'utf8');
  console.log(`✓ Updated chrome-extension/popup.html with v${newVersion}`);
}

if (fs.existsSync(LIVE_CONTENT_PATH)) {
  let liveContent = fs.readFileSync(LIVE_CONTENT_PATH, 'utf8');
  liveContent = liveContent.replace(
    /var VERSION\s*=\s*['"][^'"]+['"];/,
    `var VERSION  = '${newVersion}-live';`
  );
  liveContent = liveContent.replace(
    /\/\/\s*Choice Properties — Live Content Script v[^\n]+/,
    `// Choice Properties — Live Content Script v${newVersion}`
  );
  fs.writeFileSync(LIVE_CONTENT_PATH, liveContent, 'utf8');
  console.log(`✓ Updated .pages-orion/live-content.js with v${newVersion}-live`);
}

// ── 4. Generate Live Extension Metadata & Chrome Update XML ─────────
const metaData = {
  version: newVersion,
  updated_at: new Date().toISOString(),
  timestamp: Date.now(),
  channel: 'stable',
  name: 'Import to Choice Properties',
  download_url: 'https://choice-properties-site.pages.dev/choice-properties-extension.zip',
  github_url: 'https://raw.githubusercontent.com/choice121/Choice/main/public/choice-properties-extension.zip'
};
const META_PATH = path.join(PUBLIC_DIR, 'extension-meta.json');
const ROOT_META_PATH = path.join(ROOT, 'extension-meta.json');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
fs.writeFileSync(META_PATH, JSON.stringify(metaData, null, 2), 'utf8');
fs.writeFileSync(ROOT_META_PATH, JSON.stringify(metaData, null, 2), 'utf8');
console.log(`✓ Generated extension-meta.json with live v${newVersion}`);

const updateXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='choicepropertiesautoupdate'>
    <updatecheck codebase='https://choice-properties-site.pages.dev/choice-properties-extension.zip' version='${newVersion}' />
  </app>
</gupdate>
`;
fs.writeFileSync(UPDATE_XML_PATH, updateXml, 'utf8');
console.log('✓ Generated public/extension-updates.xml');

// ── 5. Zip Extension into public/choice-properties-extension.zip ───────
console.log('📦 Packaging extension zip...');
execSync(`python3 -c "
import zipfile, os
output_path = '${ZIP_PATH}'
source_dir = '${EXTENSION_DIR}'
with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(source_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, source_dir)
            zipf.write(file_path, arcname)
print(f'✅ Successfully packaged choice-properties-extension.zip v${newVersion} ({os.path.getsize(output_path)} bytes)')
"`, { cwd: ROOT, stdio: 'inherit' });

// ── 6. Run Extractors Test Suite to Guarantee Zero Breakage ───────────
console.log('🧪 Running extractor test suite...');
execSync('node chrome-extension/test-extractors.js', { cwd: ROOT, stdio: 'inherit' });

console.log(`\n🎉 Choice Properties Extension v${newVersion} is compiled, synced, and ready to deploy!`);
