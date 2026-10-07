import { CREDENTIALS_CONFIG } from "../credentials-config.mjs";

function normalizeFeeInDescription(desc) {
  if (!desc) return desc;

  let updated = desc;

  // 1. "0 application fee" / "0 app fee" -> "$50 application fee"
  updated = updated.replace(/\b0\s+application\s+fee/gi, "$50 application fee");
  updated = updated.replace(/\b0\s+app\s+fee/gi, "$50 application fee");

  // 2. "application fee is 0" -> "application fee is $50"
  updated = updated.replace(/application\s+fee\s+is\s+0\b/gi, "application fee is $50");
  updated = updated.replace(/app\s+fee\s+is\s+0\b/gi, "application fee is $50");

  // 3. "application fee of $55" -> "application fee of $50"
  updated = updated.replace(/application\s+fee\s+of\s+\$55\b/gi, "application fee of $50");

  // 4. "Application fee $45" -> "Application Fee: $50"
  updated = updated.replace(/application\s+fee\s+\$45\b/gi, "Application Fee: $50");

  // 5. "$55 application fee" -> "$50 application fee"
  updated = updated.replace(/\$55\s+application\s+fee/gi, "$50 application fee");

  // 6. "Application fee will be waived for ACTIVE DUTY MILITARY. Thank you for your service." -> "Application Fee: $50."
  updated = updated.replace(/Application\s+fee\s+will\s+be\s+waived[^.!?\n]*[.!?\n](?:\s*Thank\s+you\s+for\s+your\s+service[.!?\n])?/gi, "Application Fee: $50. ");

  // 7. General cleanup of any lingering "zero application fee" or "$0 application fee"
  updated = updated.replace(/(?:zero|\$0)\s+application\s+fee/gi, "$50 application fee");
  updated = updated.replace(/application\s+fee\s+(?:is\s+)?(?:zero|\$0)/gi, "application fee is $50");

  // Collapse excess whitespace
  updated = updated.replace(/[ \t]{2,}/g, " ").trim();

  return updated;
}

async function fetchAllActiveProperties() {
  let all = [];
  let from = 0;
  const pageSize = 500;
  while (true) {
    const to = from + pageSize - 1;
    const url = `${CREDENTIALS_CONFIG.SUPABASE_URL}/rest/v1/properties?status=eq.active&select=id,address,city,state,application_fee,description,created_at&order=created_at.desc`;
    const res = await fetch(url, {
      headers: {
        apikey: CREDENTIALS_CONFIG.SUPABASE_API_KEY,
        Authorization: `Bearer ${CREDENTIALS_CONFIG.SUPABASE_API_KEY}`,
        "Range": `${from}-${to}`
      }
    });
    const data = await res.json();
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function updateProperty(id, payload) {
  const url = `${CREDENTIALS_CONFIG.SUPABASE_URL}/rest/v1/properties?id=eq.${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      Authorization: `Bearer ${CREDENTIALS_CONFIG.SUPABASE_API_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update ${id} (${res.status}): ${text}`);
  }
}

async function main() {
  console.log("Fetching all active properties (ordered from most recently published)...");
  const props = await fetchAllActiveProperties();
  console.log(`Fetched ${props.length} active properties.`);

  let updatedCount = 0;

  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const origDesc = p.description || "";
    const newDesc = normalizeFeeInDescription(origDesc);

    const descChanged = origDesc !== newDesc;
    const feeChanged = p.application_fee !== 50;

    if (descChanged || feeChanged) {
      console.log(`\n[${i + 1}/${props.length}] Updating property ${p.address} (${p.id}) [Published: ${p.created_at}]...`);
      
      const payload = {};
      if (descChanged) {
        payload.description = newDesc;
        console.log("  Diff in description:");
        // Find changed snippet
        const beforeMatch = origDesc.match(/(.{0,30}(?:application|app)\s*fee.{0,30})/i);
        const afterMatch = newDesc.match(/(.{0,30}(?:application|app)\s*fee.{0,30})/i);
        console.log(`    Before: "${beforeMatch ? beforeMatch[0] : ""}"`);
        console.log(`    After:  "${afterMatch ? afterMatch[0] : ""}"`);
      }
      if (feeChanged) {
        payload.application_fee = 50;
        console.log(`  Updating application_fee: ${p.application_fee} -> 50`);
      }

      payload.updated_at = new Date().toISOString();

      await updateProperty(p.id, payload);
      updatedCount++;
      console.log(`  ✓ Successfully updated ${p.address}`);
    }
  }

  console.log(`\n🎉 Complete! Successfully updated ${updatedCount} properties to $50 application fee.`);
}

main().catch(err => {
  console.error("Error running update script:", err);
  process.exit(1);
});
