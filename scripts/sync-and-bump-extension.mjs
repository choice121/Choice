#!/usr/bin/env node
/**
 * Choice Properties — Automatic Extension Version & Live Sync Engine
 * ===================================================================
 * 1. Checks the current v18 version across both extension manifests
 * 2. Increments the major, minor, or patch version
 * 3. Syncs extractor rules into chrome-extension, .pages-orion, and edge functions
 * 4. Regenerates .pages-orion/live-content.js with updated version stamps
 * 5. Packages Chromium and Orion extension archives
 * 6. Generates extension metadata and the Chrome update manifest
 *
 * Usage:
 *   node scripts/sync-and-bump-extension.mjs           (Bumps major)
 *   node scripts/sync-and-bump-extension.mjs --minor   (Bumps minor)
 *   node scripts/sync-and-bump-extension.mjs --patch   (Bumps patch)
 *   node scripts/sync-and-bump-extension.mjs --no-bump (Rebuilds current version)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MANIFEST_PATH = path.join(ROOT, 'chrome-extension', 'manifest.json');
const ORION_MANIFEST_PATH = path.join(ROOT, '.pages-orion', 'manifest.json');
const ROOT_MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const LIVE_CONTENT_PATH = path.join(ROOT, '.pages-orion', 'live-content.js');
const EXTENSION_DIR = path.join(ROOT, 'chrome-extension');
const ORION_DIR = path.join(ROOT, '.pages-orion');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ZIP_PATH = path.join(PUBLIC_DIR, 'choice-properties-extension.zip');
const ORION_ZIP_PATH = path.join(PUBLIC_DIR, 'choice-properties-orion-extension.zip');
const UPDATE_XML_PATH = path.join(PUBLIC_DIR, 'extension-updates.xml');
const ROOT_UPDATE_XML_PATH = path.join(ROOT, 'extension-updates.xml');

// ── 1. Read and bump version ──────────────────────────────────────────
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('Error: manifest.json not found at', MANIFEST_PATH);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const orionManifest = fs.existsSync(ORION_MANIFEST_PATH)
  ? JSON.parse(fs.readFileSync(ORION_MANIFEST_PATH, 'utf8'))
  : null;
const rootManifest = fs.existsSync(ROOT_MANIFEST_PATH)
  ? JSON.parse(fs.readFileSync(ROOT_MANIFEST_PATH, 'utf8'))
  : null;

function versionParts(version) {
  return String(version || '0.0.0').split('.').map(n => parseInt(n, 10) || 0).slice(0, 3);
}

function compareVersions(a, b) {
  const aa = versionParts(a);
  const bb = versionParts(b);
  for (let i = 0; i < 3; i++) {
    if (aa[i] !== bb[i]) return aa[i] - bb[i];
  }
  return 0;
}

const currentVersion = [manifest.version, orionManifest?.version, rootManifest?.version]
  .filter(Boolean)
  .sort(compareVersions)
  .pop() || '18.0.0';
const parts = currentVersion.split('.').map(n => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);

const isMinor = process.argv.includes('--minor');
const isPatch = process.argv.includes('--patch');
const shouldBump = !process.argv.includes('--no-bump');

let newVersion;
if (!shouldBump) {
  newVersion = currentVersion;
} else if (isPatch) {
  parts[2] += 1;
  newVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
} else if (isMinor) {
  parts[1] += 1;
  parts[2] = 0;
  newVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
} else {
  // Default: bump the major version.
  parts[0] += 1;
  parts[1] = 0;
  parts[2] = 0;
  newVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
}

console.log(shouldBump
  ? `🚀 Bumping Extension Version: v${currentVersion} ➔ v${newVersion}`
  : `🔄 Rebuilding Extension Version: v${currentVersion}`);

manifest.version = newVersion;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

if (orionManifest) {
  orionManifest.version = newVersion;
  fs.writeFileSync(ORION_MANIFEST_PATH, JSON.stringify(orionManifest, null, 2) + '\n', 'utf8');
}

if (rootManifest) {
  // The root manifest is copied into dist by the static-site build. Keep it
  // from advertising the retired v2 package or the old permissions.
  rootManifest.version = newVersion;
  rootManifest.description = manifest.description;
  rootManifest.permissions = manifest.permissions;
  rootManifest.host_permissions = manifest.host_permissions;
  rootManifest.content_scripts = manifest.content_scripts;
  fs.writeFileSync(ROOT_MANIFEST_PATH, JSON.stringify(rootManifest, null, 2) + '\n', 'utf8');
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

function updateTextFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, 'utf8');
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  fs.writeFileSync(filePath, text, 'utf8');
}

updateTextFile(path.join(ROOT, 'chrome-extension', 'config.js'), [
  [/VERSION:\s*['"][^'"]+['"]/, `VERSION: '${newVersion}'`],
]);
updateTextFile(path.join(ROOT, '.pages-orion', 'config.js'), [
  [/VERSION:\s*['"][^'"]+['"]/, `VERSION: '${newVersion}'`],
]);
updateTextFile(path.join(ROOT, '.pages-orion', 'content.js'), [
  [/Choice Properties — Orion Content Bridge v[^\n]+/, `Choice Properties — Orion Content Bridge v${newVersion}`],
]);
updateTextFile(path.join(ROOT, 'chrome-extension', 'README.md'), [
  [/^# Choice Properties — Universal Chrome Extension \(v[^)]+\)/m, `# Choice Properties — Universal Chrome Extension (v${newVersion})`],
]);
updateTextFile(path.join(ROOT, '.pages-orion', 'live-content.js'), [
  [/browser-extension-v[0-9.]+-live/g, `browser-extension-v${newVersion}-live`],
]);

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

const ORION_POPUP_HTML_PATH = path.join(ROOT, '.pages-orion', 'popup.html');
if (fs.existsSync(ORION_POPUP_HTML_PATH)) {
  let popupHtml = fs.readFileSync(ORION_POPUP_HTML_PATH, 'utf8');
  popupHtml = popupHtml.replace(
    /<span id="ext-version-pill"[^>]*>v[^<]*<\/span>/,
    `<span id="ext-version-pill" style="font-size:10px;font-weight:600;background:rgba(99,102,241,0.25);color:#a5b4fc;padding:2px 6px;border-radius:4px;border:1px solid rgba(165,180,252,0.3);margin-left:4px">v${newVersion}</span>`
  );
  fs.writeFileSync(ORION_POPUP_HTML_PATH, popupHtml, 'utf8');
  console.log(`✓ Updated .pages-orion/popup.html with v${newVersion}`);
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
fs.writeFileSync(ROOT_UPDATE_XML_PATH, updateXml, 'utf8');
console.log('✓ Generated public/extension-updates.xml');

// ── 5. Zip both extension packages ─────────────────────────────────────
function packageExtension(sourceDir, outputPath, label) {
  const python = [
    'import zipfile, os',
    `output_path = ${JSON.stringify(outputPath)}`,
    `source_dir = ${JSON.stringify(sourceDir)}`,
    'with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:',
    '    for root, dirs, files in os.walk(source_dir):',
    '        for file in files:',
    '            file_path = os.path.join(root, file)',
    '            arcname = os.path.relpath(file_path, source_dir)',
    '            zipf.write(file_path, arcname)',
    `print("✅ Packaged ${label} v${newVersion} (" + str(os.path.getsize(output_path)) + " bytes)")`,
  ].join('\n');
  execFileSync('python3', ['-c', python], { cwd: ROOT, stdio: 'inherit' });
}

console.log('📦 Packaging extension zips...');
packageExtension(EXTENSION_DIR, ZIP_PATH, 'choice-properties-extension.zip');
packageExtension(ORION_DIR, ORION_ZIP_PATH, 'choice-properties-orion-extension.zip');

// Also copy to root and dist for universal HTTP serving
try {
  fs.copyFileSync(ZIP_PATH, path.join(ROOT, 'choice-properties-extension.zip'));
  fs.copyFileSync(ORION_ZIP_PATH, path.join(ROOT, 'choice-properties-orion-extension.zip'));
  const distZip = path.join(ROOT, 'dist', 'choice-properties-extension.zip');
  const distOrionZip = path.join(ROOT, 'dist', 'choice-properties-orion-extension.zip');
  if (fs.existsSync(path.join(ROOT, 'dist'))) {
    fs.copyFileSync(ZIP_PATH, distZip);
    fs.copyFileSync(ORION_ZIP_PATH, distOrionZip);
    fs.copyFileSync(ROOT_META_PATH, path.join(ROOT, 'dist', 'extension-meta.json'));
    fs.copyFileSync(ROOT_UPDATE_XML_PATH, path.join(ROOT, 'dist', 'extension-updates.xml'));
  }
} catch (_) {}

// ── 6. Run Extractors Test Suite to Guarantee Zero Breakage ───────────
console.log('🧪 Running extractor test suite...');
execSync('node chrome-extension/test-extractors.js', { cwd: ROOT, stdio: 'inherit' });
console.log('🔍 Validating both extension packages...');
execSync('node scripts/validate-extension.mjs', { cwd: ROOT, stdio: 'inherit' });

console.log(`\n🎉 Choice Properties Extension v${newVersion} is compiled, synced, and ready to deploy!`);
