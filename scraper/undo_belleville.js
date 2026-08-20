#!/usr/bin/env node
/**
 * Undo Publishing: Belleville IL Listings
 * =======================================
 * Deletes all published Belleville, IL listings and their associated photo records.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../.env.local')
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#') && line.includes('=')) {
          const [k, ...v] = line.split('=');
          const val = v.join('=').trim().replace(/^["']|["']$/g, '');
          if (k.trim() && !process.env[k.trim()]) {
            process.env[k.trim()] = val;
          }
        }
      });
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function querySupabase(pathStr, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${pathStr}`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : null;
          resolve(data);
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function undoPublishing() {
  console.log('🔄 Finding all Belleville properties to unpublish...');
  const properties = await querySupabase('properties?city=eq.Belleville&select=id,address');
  
  if (!properties || properties.length === 0) {
    console.log('No Belleville properties found.');
    return;
  }

  console.log(`Found ${properties.length} Belleville properties. Deleting associated photos and records...`);

  for (const p of properties) {
    // 1. Delete property_photos
    await querySupabase(`property_photos?property_id=eq.${p.id}`, 'DELETE');
    // 2. Delete property record
    await querySupabase(`properties?id=eq.${p.id}`, 'DELETE');
    console.log(`   🗑️ Deleted: ${p.address} (${p.id})`);
  }

  console.log('\n✅ All Belleville listings have been completely unpublished and removed.');
}

undoPublishing().catch(console.error);
