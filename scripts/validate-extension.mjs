#!/usr/bin/env node
/**
 * Validate the v18 extension sources and generated packages.
 *
 * This deliberately checks packaging/version consistency, not credentials.
 * The current credential arrangement remains unchanged by this validator.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  try {
    return { path: filePath, value: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return { path: filePath, value: null };
  }
}

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) failures.push(`Missing required file: ${relativePath}`);
}

function checkVersionedPackage(name, relativeDir, requiredFiles) {
  const manifestResult = readJson(path.join(relativeDir, 'manifest.json'));
  const manifest = manifestResult.value;
  if (!manifest) return null;
  if (manifest.manifest_version !== 3) failures.push(`${name}: manifest_version must be 3`);
  if (!/^18\.\d+\.\d+$/.test(manifest.version || '')) {
    failures.push(`${name}: expected a v18 semantic version, got ${manifest.version}`);
  }
  for (const file of requiredFiles) requireFile(path.join(relativeDir, file));
  for (const script of manifest.background?.service_worker ? [manifest.background.service_worker] : []) {
    requireFile(path.join(relativeDir, script));
  }
  for (const contentScript of manifest.content_scripts || []) {
    for (const script of contentScript.js || []) requireFile(path.join(relativeDir, script));
    for (const css of contentScript.css || []) requireFile(path.join(relativeDir, css));
  }
  return manifest;
}

const chromeManifest = checkVersionedPackage('Chromium', 'chrome-extension', [
  'config.js', 'background.js', 'content.js', 'content.css', 'popup.html', 'popup.js',
  'shared-extractors.js', 'test-extractors.js',
]);
const orionManifest = checkVersionedPackage('Orion', '.pages-orion', [
  'config.js', 'background.js', 'content.js', 'content.css', 'live-content.js',
  'live-shared-extractors.js', 'popup.html', 'popup.js', 'shared-extractors.js',
]);

if (chromeManifest && orionManifest && chromeManifest.version !== orionManifest.version) {
  failures.push(`Source package versions differ: Chromium ${chromeManifest.version}, Orion ${orionManifest.version}`);
}

const rootManifest = readJson('manifest.json').value;
if (rootManifest && chromeManifest && rootManifest.version !== chromeManifest.version) {
  failures.push(`Root manifest is stale: ${rootManifest.version}; expected ${chromeManifest.version}`);
}

const requiredContentMatches = [
  'https://cjrealestate.com/*',
  'https://*.cjrealestate.com/*',
  'https://appfolio.com/*',
  'https://*.appfolio.com/*',
];
for (const [name, manifest] of [['Chromium', chromeManifest], ['Orion', orionManifest]]) {
  if (!manifest) continue;
  const matches = new Set((manifest.content_scripts || []).flatMap(script => script.matches || []));
  for (const requiredMatch of requiredContentMatches) {
    if (!matches.has(requiredMatch)) {
      failures.push(`${name}: missing content-script match ${requiredMatch}`);
    }
  }
}

for (const [name, manifest] of [['Chromium', chromeManifest], ['Orion', orionManifest]]) {
  if (!manifest) continue;
  if ((manifest.permissions || []).some(permission => ['downloads', 'alarms'].includes(permission))) {
    failures.push(`${name}: retired downloads/alarms permission is still present`);
  }
}

const extractorFiles = [
  'chrome-extension/shared-extractors.js',
  '.pages-orion/shared-extractors.js',
  '.pages-orion/live-shared-extractors.js',
];
const extractorContents = extractorFiles.map(file => fs.existsSync(path.join(ROOT, file))
  ? fs.readFileSync(path.join(ROOT, file), 'utf8')
  : null);
if (extractorContents.some(content => content === null) || new Set(extractorContents).size !== 1) {
  failures.push('Generated browser extractor files are not identical');
}

function checkJavaScript(relativeDir) {
  const dir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const filePath = path.join(dir, entry.name);
    try {
      execFileSync(process.execPath, ['--check', filePath], { stdio: 'pipe' });
    } catch (error) {
      failures.push(`${relativeDir}/${entry.name}: JavaScript syntax check failed`);
    }
  }
}
checkJavaScript('chrome-extension');
checkJavaScript('.pages-orion');

function checkArchive(relativePath, expectedVersion) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) {
    failures.push(`Missing generated archive: ${relativePath}`);
    return;
  }
  try {
    const manifestText = execFileSync('unzip', ['-p', path.join(ROOT, relativePath), 'manifest.json'], { encoding: 'utf8' });
    const manifest = JSON.parse(manifestText);
    if (manifest.version !== expectedVersion) {
      failures.push(`${relativePath}: contains ${manifest.version}; expected ${expectedVersion}`);
    }
  } catch (error) {
    failures.push(`${relativePath}: could not inspect archive`);
  }
}

if (chromeManifest && orionManifest && chromeManifest.version === orionManifest.version) {
  checkArchive('public/choice-properties-extension.zip', chromeManifest.version);
  checkArchive('public/choice-properties-orion-extension.zip', orionManifest.version);
}

if (chromeManifest) {
  const expectedVersion = chromeManifest.version;
  const chromeReadme = fs.existsSync(path.join(ROOT, 'chrome-extension/README.md'))
    ? fs.readFileSync(path.join(ROOT, 'chrome-extension/README.md'), 'utf8')
    : '';
  const rootReadme = fs.existsSync(path.join(ROOT, 'README.md'))
    ? fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
    : '';
  if (!chromeReadme.includes(`(v${expectedVersion})`)) {
    failures.push(`chrome-extension/README.md does not advertise v${expectedVersion}`);
  }
  if (!rootReadme.includes(`v${expectedVersion}`)) {
    failures.push(`README.md does not advertise v${expectedVersion}`);
  }

  for (const releaseFile of [
    'dist/choice-properties-extension.zip',
    'dist/choice-properties-orion-extension.zip',
    'dist/extension-meta.json',
    'dist/extension-updates.xml',
  ]) {
    requireFile(releaseFile);
  }

  const distMeta = readJson('dist/extension-meta.json').value;
  if (distMeta && distMeta.version !== expectedVersion) {
    failures.push(`dist/extension-meta.json is stale: ${distMeta.version}; expected ${expectedVersion}`);
  }
}

if (failures.length) {
  console.error('Extension validation failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Extension validation passed for v${chromeManifest.version} Chromium + Orion packages.`);