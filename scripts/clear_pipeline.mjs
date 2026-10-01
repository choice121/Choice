import fetch from 'node-fetch';

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";

const pipelineHeaders = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Accept-Profile": "pipeline",
  "Content-Profile": "pipeline"
};

async function main() {
  console.log("=== CLEARING PIPELINE STAGING PROPERTIES ===");

  // 1. Fetch current count and IDs
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?select=id,address,status`, {
    headers: pipelineHeaders
  });

  if (!getRes.ok) {
    console.error("Failed to query pipeline_properties:", getRes.status, await getRes.text());
    process.exit(1);
  }

  const rows = await getRes.json();
  console.log(`Found ${rows.length} records in pipeline_properties.`);

  if (rows.length === 0) {
    console.log("Pipeline is already empty.");
    return;
  }

  // 2. Delete all records from pipeline_properties
  // PostgREST requires a filter to prevent accidental full-table deletion
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=neq.placeholder`, {
    method: "DELETE",
    headers: {
      ...pipelineHeaders,
      "Prefer": "return=representation"
    }
  });

  if (!delRes.ok) {
    console.error("Failed to delete pipeline properties:", delRes.status, await delRes.text());
    process.exit(1);
  }

  const deletedRows = await delRes.json();
  console.log(`Successfully deleted ${deletedRows.length} records from pipeline.pipeline_properties.`);

  // 3. Verify table is completely empty
  const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?select=id`, {
    headers: {
      ...pipelineHeaders,
      "Prefer": "count=exact"
    }
  });

  const remaining = await verifyRes.json();
  console.log(`Remaining pipeline records: ${remaining.length}`);
}

main().catch(console.error);
