#!/usr/bin/env node
/**
 * One-shot migration: move public legal/policy pages from
 * legacy main.css/mobile.css + page-specific <style> block
 * to the unified cp-design.css + cp-marketing.css system.
 *
 * Idempotent — running twice on an already-migrated file is a no-op.
 *
 * Phase 7 batch 2 (DESIGN_EXTENSION_PLAN.md).
 */

const fs   = require('fs');
const path = require('path');

const PAGES = [
  { file: 'terms.html',                          slug: 'terms',                     desc: 'Terms of service for Choice Properties — Nationwide rental marketplace.' },
  { file: 'privacy.html',                        slug: 'privacy',                   desc: 'How Choice Properties collects, uses, and protects your personal information.' },
  { file: 'fair-housing.html',                   slug: 'fair-housing',              desc: 'Choice Properties is committed to equal housing opportunity under the federal Fair Housing Act.' },
  { file: 'application-credit-policy.html',      slug: 'application-credit-policy', desc: 'How application credits work when an application is denied at Choice Properties.' },
  { file: 'holding-deposit-policy.html',         slug: 'holding-deposit-policy',    desc: 'Holding deposit terms and refundability for approved applications at Choice Properties.' },
  { file: 'rental-application-policy.html',      slug: 'rental-application-policy', desc: 'Choice Properties rental application policy — fees, screening, decisions, and applicant rights.' },
  { file: 'landlord-platform-agreement.html',    slug: 'landlord-platform-agreement', desc: 'Platform agreement governing landlord and agent use of Choice Properties.' },
];

const ROOT = path.resolve(__dirname, '..');
const CACHE_BUST = '20260423';

/* Build a clean, unified head block. Preserves the page <title> and meta description. */
function buildHead(title, descFallback, slug) {
  const canonical = `https://choice-properties-site.pages.dev/${slug}.html`;
  const desc = descFallback;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#ffffff">
  <link rel="manifest" href="/manifest.json">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="/assets/og-cover.jpg">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="/assets/og-cover.jpg">
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="/assets/fontawesome.css">
  <link rel="stylesheet" href="/css/cp-design.css?v=${CACHE_BUST}">
  <link rel="stylesheet" href="/css/cp-marketing.css?v=${CACHE_BUST}">
</head>`;
}

const SCRIPTS = `
<script defer src="/config.js"></script>
<script type="module" src="/js/cp-api.js"></script>
<script defer src="/js/components.js"></script>
</body>
</html>`;

function migrate(page) {
  const filePath = path.join(ROOT, page.file);
  const original = fs.readFileSync(filePath, 'utf8');

  // Idempotency guard
  if (original.includes('cp-marketing.css') && original.includes('data-portal="public"')) {
    console.log(`SKIP  ${page.file}  (already migrated)`);
    return false;
  }

  // Pull the title (preserve exactly)
  const titleMatch = original.match(/<title>([^<]+)<\/title>/);
  if (!titleMatch) throw new Error(`No <title> in ${page.file}`);
  const title = titleMatch[1].trim();

  // Pull the description if present (else fall back to default)
  const descMatch = original.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  const desc = descMatch ? descMatch[1] : page.desc;

  // Extract the hero block (preserve as-is)
  const heroMatch = original.match(/<div class="info-hero">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  if (!heroMatch) throw new Error(`No hero block in ${page.file}`);
  const heroBlock = heroMatch[0].trim();

  // Extract the info-body block (the main content). Match the entire wrapper.
  const bodyMatch = original.match(/<div class="info-body">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  if (!bodyMatch) throw new Error(`No info-body block in ${page.file}`);
  const bodyBlock = bodyMatch[0].trim();

  const newHead = buildHead(title, desc, page.slug);
  const newDoc = `${newHead}
<body data-portal="public" data-page="${page.slug}">

<div id="site-nav"></div>

  ${heroBlock}

  ${bodyBlock}

<div id="site-footer"></div>
${SCRIPTS}`;

  fs.writeFileSync(filePath, newDoc, 'utf8');
  console.log(`OK    ${page.file}  (${original.length} -> ${newDoc.length} bytes)`);
  return true;
}

let migrated = 0;
for (const p of PAGES) {
  if (migrate(p)) migrated++;
}
console.log(`\nDone. Migrated ${migrated}/${PAGES.length} pages.`);
