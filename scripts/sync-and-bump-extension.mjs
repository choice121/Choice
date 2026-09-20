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

// ── 3. Update live-content.js with new version header & constant ──────
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

// ── 4. Generate Chrome Update XML (extension-updates.xml) ─────────────
const updateXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='choicepropertiesautoupdate'>
    <updatecheck codebase='https://choice-properties-site.pages.dev/choice-properties-extension.zip' version='${newVersion}' />
  </app>
</gupdate>
`;
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
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
