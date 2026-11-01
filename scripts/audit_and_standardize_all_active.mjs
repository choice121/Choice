/**
 * CHOICE PROPERTIES — UNIVERSAL AUDIT & STANDARDIZATION RUNNER
 * =============================================================
 * Scans all active properties across the entire Supabase database and
 * applies the exact standard validation rules:
 * 1. Decimal bathroom precision (1.5, 2.5, 3.5 baths, zero truncation)
 * 2. Accurate architectural property classification (DUPLEX vs TOWNHOUSE vs SINGLE_FAMILY)
 * 3. Exact source title preservation / standard titling
 * 4. Strips prohibited text (deposits, tour CTAs, lease terms, smoking)
 *
 * Usage: node scripts/audit_and_standardize_all_active.mjs [--fix]
 */

import { CREDENTIALS_CONFIG } from "../credentials-config.mjs";
import { standardizeAndValidateProperty } from "./pipeline_standardizer.mjs";

const url = CREDENTIALS_CONFIG.SUPABASE_URL;
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const isFixMode = process.argv.includes("--fix");

async function runAudit() {
  console.log(`Starting Database Audit (Fix Mode: ${isFixMode ? "ENABLED" : "DRY RUN"})...`);

  let offset = 0;
  const limit = 100;
  let totalAudited = 0;
  let discrepanciesFound = 0;

  while (true) {
    const res = await fetch(
      `${url}/rest/v1/properties?status=eq.active&select=*&limit=${limit}&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );

    const props = await res.json();
    if (!props || !props.length) break;

    for (const prop of props) {
      totalAudited++;
      const std = standardizeAndValidateProperty(prop);

      const typeDiff = std.property_type !== prop.property_type;
      const bathDiff = std.bathrooms !== prop.bathrooms;
      const feeDiff = prop.application_fee !== 50;

      if (typeDiff || bathDiff || feeDiff) {
        discrepanciesFound++;
        console.log(`\n[Discrepancy #${discrepanciesFound}] ID: ${prop.id} | ${prop.address}, ${prop.city}, ${prop.state}`);
        if (typeDiff) console.log(`  - Property Type: '${prop.property_type}' -> '${std.property_type}'`);
        if (bathDiff) console.log(`  - Bathrooms: ${prop.bathrooms} -> ${std.bathrooms}`);
        if (feeDiff) console.log(`  - Application Fee: ${prop.application_fee} -> 50`);

        if (isFixMode) {
          const patchPayload = {
            property_type: std.property_type,
            bathrooms: std.bathrooms,
            half_bathrooms: std.half_bathrooms,
            total_bathrooms: std.total_bathrooms,
            application_fee: 50,
            pets_allowed: true,
            smoking_allowed: false,
            description: std.description
          };

          const patchRes = await fetch(`${url}/rest/v1/properties?id=eq.${prop.id}`, {
            method: "PATCH",
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(patchPayload)
          });
          console.log(`  ✓ Auto-corrected in Supabase (Status: ${patchRes.status})`);
        }
      }
    }

    if (props.length < limit) break;
    offset += limit;
  }

  console.log(`\n======================================================`);
  console.log(`Audit Complete: ${totalAudited} properties audited, ${discrepanciesFound} discrepancies ${isFixMode ? "corrected" : "detected"}.`);
  console.log(`======================================================`);
}

runAudit().catch(err => {
  console.error("Audit error:", err);
});
