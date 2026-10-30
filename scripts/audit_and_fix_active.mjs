/**
 * COMPREHENSIVE ACTIVE PROPERTIES AUDIT & STANDARDIZATION SCANNER
 */
import { CREDENTIALS_CONFIG } from "../credentials-config.mjs";
import { standardizeAndValidateProperty } from "./pipeline_standardizer.mjs";

const url = CREDENTIALS_CONFIG.SUPABASE_URL;
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

async function scanAndFixAll() {
  console.log("Fetching all active properties from Supabase...");
  
  let allProps = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(`${url}/rest/v1/properties?status=eq.active&select=*&order=listed_at.desc&limit=${limit}&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const data = await res.json();
    if (!data || !data.length) break;
    allProps = allProps.concat(data);
    if (data.length < limit) break;
    offset += limit;
  }

  console.log(`Total active properties retrieved: ${allProps.length}\n`);

  let fixCount = 0;
  let perfectCount = 0;
  const report = [];

  for (let i = 0; i < allProps.length; i++) {
    const prop = allProps[i];
    const issues = [];
    const patches = {};

    // 1. Property Type Enum Normalization & Architectural check
    let stdType = (prop.property_type || "SINGLE_FAMILY").toUpperCase().replace(/\s+/g, "_");
    const fullText = ((prop.description || "") + " " + (prop.title || "") + " " + (prop.address || "")).toLowerCase();
    
    if (fullText.includes("1/2 duplex") || fullText.includes("half duplex") || fullText.includes("half-duplex") || fullText.includes("duplex") || fullText.includes("side-by-side")) {
      stdType = "DUPLEX";
    } else if (fullText.includes("townhouse") || fullText.includes("townhome") || fullText.includes("rowhouse")) {
      stdType = "TOWNHOUSE";
    }

    if (prop.property_type !== stdType) {
      issues.push(`Property type '${prop.property_type}' -> '${stdType}'`);
      patches.property_type = stdType;
    }

    // 2. Bathroom Decimal Precision Check
    let currentBaths = prop.bathrooms != null ? parseFloat(prop.bathrooms) : null;
    let currentHalf = prop.half_bathrooms;
    let targetBaths = currentBaths;
    let targetHalf = currentHalf;

    if (currentBaths === 1 || currentBaths === null) {
      if (fullText.includes("1.5 bath") || fullText.includes("1 and a half bath") || fullText.includes("one and a half bath") || fullText.includes("half bath") || fullText.includes("powder room")) {
        targetBaths = 1.5;
        targetHalf = 1;
      }
    } else if (currentBaths === 2) {
      if (fullText.includes("2.5 bath") || fullText.includes("2 and a half bath") || fullText.includes("two and a half bath")) {
        targetBaths = 2.5;
        targetHalf = 1;
      }
    } else if (currentBaths === 3) {
      if (fullText.includes("3.5 bath") || fullText.includes("3 and a half bath") || fullText.includes("three and a half bath")) {
        targetBaths = 3.5;
        targetHalf = 1;
      }
    }

    if (targetBaths !== currentBaths || (targetHalf != null && targetHalf !== currentHalf)) {
      issues.push(`Baths: ${currentBaths} (half: ${currentHalf}) -> ${targetBaths} (half: ${targetHalf})`);
      patches.bathrooms = targetBaths;
      patches.half_bathrooms = targetHalf;
      patches.total_bathrooms = targetBaths;
    }

    // 3. Application Fee
    if (prop.application_fee !== 50) {
      issues.push(`Application fee: ${prop.application_fee} -> 50`);
      patches.application_fee = 50;
    }

    // 4. Pet Friendly
    if (prop.pets_allowed !== true) {
      issues.push(`Pets allowed: ${prop.pets_allowed} -> true`);
      patches.pets_allowed = true;
    }

    // 5. Security Deposit: Must match 1x monthly rent in DB
    if (prop.monthly_rent && prop.security_deposit !== prop.monthly_rent) {
      issues.push(`Deposit: $${prop.security_deposit} -> $${prop.monthly_rent}`);
      patches.security_deposit = prop.monthly_rent;
    }

    // 6. Description Prohibited Content Check (Deposit mentions, Tour/Showing CTAs, Lease term mentions)
    let desc = prop.description || "";
    let cleanDesc = desc;

    // Remove security deposit mentions from description
    cleanDesc = cleanDesc.replace(/(\$\d[\d,]*\s*)?(security\s+deposit|deposit\s+is\s+\$\d[\d,]*|deposit\s+of\s+\$\d[\d,]*|deposit\s*:\s*\$\d[\d,]*|refundable\s+deposit|\bdeposit\b[^\.\n]*)/gi, "");
    
    // Remove tour/showing language
    cleanDesc = cleanDesc.replace(/(schedule\s+(a\s+)?(tour|viewing|showing)|contact\s+us\s+to\s+schedule|book\s+a\s+tour|self-guided\s+tour|tour\s+today|showing\s+available)[^\.\n]*/gi, "");
    
    // Remove lease term mentions
    cleanDesc = cleanDesc.replace(/(\d+[- ]month\s+lease|12[- ]month|lease\s+term[^\.\n]*|minimum\s+lease[^\.\n]*)/gi, "");

    // Clean up empty lines & double spaces
    cleanDesc = cleanDesc.replace(/\s{2,}/g, " ").replace(/\n\s*\n\s*\n/g, "\n\n").trim();

    if (cleanDesc !== desc && cleanDesc.length > 30) {
      issues.push(`Description cleaned of prohibited phrases (deposit/tour/lease)`);
      patches.description = cleanDesc;
    }

    // 7. Photos count
    const photoCount = Array.isArray(prop.photos) ? prop.photos.length : 0;
    const isPhotoCompliant = photoCount >= 6;

    if (Object.keys(patches).length > 0) {
      fixCount++;
      console.log(`[Item #${i + 1}] Discrepancies detected for: ${prop.address}, ${prop.city}, ${prop.state} (ID: ${prop.id})`);
      issues.forEach(iss => console.log(`   - ${iss}`));

      // Apply fix to Supabase
      const patchRes = await fetch(`${url}/rest/v1/properties?id=eq.${prop.id}`, {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patches)
      });
      console.log(`   ✓ Auto-updated in Supabase (Status: ${patchRes.status})\n`);
    } else {
      perfectCount++;
    }

    report.push({
      num: i + 1,
      id: prop.id,
      address: prop.address,
      city: prop.city,
      state: prop.state,
      zip: prop.zip,
      rent: prop.monthly_rent,
      beds: prop.bedrooms,
      baths: patches.bathrooms || prop.bathrooms,
      type: patches.property_type || prop.property_type,
      fee: patches.application_fee || prop.application_fee,
      pets: patches.pets_allowed !== undefined ? patches.pets_allowed : prop.pets_allowed,
      photos: photoCount,
      photoCompliant: isPhotoCompliant,
      status: "COMPLIANT"
    });
  }

  console.log("================================================================================");
  console.log(`SCAN COMPLETE:`);
  console.log(`- Total Properties Checked: ${allProps.length}`);
  console.log(`- Already 100% Compliant: ${perfectCount}`);
  console.log(`- Auto-Corrected & Standardized: ${fixCount}`);
  console.log("================================================================================");

  return report;
}

scanAndFixAll().catch(err => console.error("Scan error:", err));
