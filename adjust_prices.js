async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
  const getHeaders = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

  const targetIds = [
    "0b12ac7f-e316-4d60-8e09-9e362ca73f48", // 1095
    "2009bdfd-016e-43c5-a1cd-6d43043a93a3", // 1050
    "26febe5b-ef75-480a-9ff1-b9422aa56e3e", // 1100
    "3e474851-b13d-4c72-b6b1-4bc8934174c8", // 1045
    "743ecfdf-0500-463d-a88e-502ee54dfb27", // 1075
    "83b9bf7a-a174-49ce-8309-2e79d71bae7a", // 1060
    "cf79b604-a004-4ca6-8b1a-7de2f1ab7cd3", // 1090
    "PROP-09B6CBF4", // 1025
    "PROP-1738B099", // 1065
    "PROP-B3F4F1CD"  // 1080
  ];
  
  const rents = {
    "0b12ac7f-e316-4d60-8e09-9e362ca73f48": 1095,
    "2009bdfd-016e-43c5-a1cd-6d43043a93a3": 1050,
    "26febe5b-ef75-480a-9ff1-b9422aa56e3e": 1100,
    "3e474851-b13d-4c72-b6b1-4bc8934174c8": 1045,
    "743ecfdf-0500-463d-a88e-502ee54dfb27": 1075,
    "83b9bf7a-a174-49ce-8309-2e79d71bae7a": 1060,
    "cf79b604-a004-4ca6-8b1a-7de2f1ab7cd3": 1090,
    "PROP-09B6CBF4": 1025,
    "PROP-1738B099": 1065,
    "PROP-B3F4F1CD": 1080
  };

  for (const oldId of targetIds) {
    const newRent = rents[oldId];
    
    if (oldId.toLowerCase().startsWith('prop-')) {
      // Just PATCH
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${oldId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ monthly_rent: newRent, security_deposit: newRent })
      });
      console.log(`Updated existing prop- ID ${oldId}: status`, patchRes.status);
    } else {
      // Need to migrate to new ID
      const newId = 'prop-' + Math.random().toString(16).substring(2, 10);
      
      // Fetch property
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${oldId}`, { headers: getHeaders });
      const pData = await pRes.json();
      const p = pData[0];
      
      p.id = newId;
      p.monthly_rent = newRent;
      p.security_deposit = newRent;
      delete p.search_tsv;
      
      // POST new property
      const postPRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers,
        body: JSON.stringify(p)
      });
      if (postPRes.status >= 300) {
        console.error(`Failed to create ${newId}:`, await postPRes.text());
        continue;
      }
      
      // Fetch photos
      const phRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${oldId}`, { headers: getHeaders });
      const photos = await phRes.json();
      
      // POST photos
      if (photos.length > 0) {
        const newPhotos = photos.map(photo => {
          delete photo.id;
          photo.property_id = newId;
          return photo;
        });
        
        const postPhRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(newPhotos)
        });
        if (postPhRes.status >= 300) {
          console.error(`Failed to create photos for ${newId}:`, await postPhRes.text());
        }
      }
      
      // DELETE old photos
      await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${oldId}`, { method: 'DELETE', headers: getHeaders });
      // DELETE old property
      await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${oldId}`, { method: 'DELETE', headers: getHeaders });
      
      console.log(`Migrated ${oldId} -> ${newId} with rent ${newRent}`);
    }
  }
}
run();
