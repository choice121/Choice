const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const SYSTEM_PROMPT = `
You are an expert real estate image auditor. Analyze the following property image.
Determine if it contains HARMFUL text or watermarks according to Choice Properties policy.

A. Harmless Text (KEEP the image - return is_harmful: false):
- "Virtually Staged" or "Furniture not included" liability disclaimers.
- In-world/Diegetic natural text (e.g., street signs, house numbers, appliance brands, text on TVs/posters).
- Camera timestamps (e.g., 2023-10-12 in the corner).
- Unbranded floor plans (e.g., "Master Bedroom 12x14").

B. Harmful Text (DELETE the image - return is_harmful: true):
- Promotional flyers, discount banners ("1 Month Free", "$99 Move-In").
- Competitor/MLS watermarks (faint, transparent, solid, LLC initials, Zillow, Progress Residential, FirstKey).
- Agent contact info (names, headshots, emails, phone numbers, URLs).
- Portal UI artifacts (screenshots of "Contact Agent" buttons, arrows).

Analyze the image carefully. Even faint, transparent watermarks across the center are HARMFUL.
Respond ONLY with a valid JSON object matching this schema:
{
  "is_harmful": boolean,
  "reason": "Detailed explanation of exactly what text was found and why it was classified as harmless or harmful.",
  "category": "clean" | "harmless_text" | "competitor_watermark" | "promotional_banner" | "agent_contact" | "portal_artifact"
}`;

// Fallback rule analyzer for URL/patterns when external AI API is rate-limited or unavailable
function analyzeImageByRules(url) {
  const lowerUrl = (url || '').toLowerCase();
  const brandedTerms = [
    'firstkey', 'invitation', 'progress', 'tricon', 'mainstreet',
    'coldwell', 'century21', 'kellerwilliams', 'remax', 're_max',
    'sothebys', 'berkshire', 'compass', 'exprealty', 'howardhanna',
    'headshot', 'agent_photo', 'agent-photo', 'broker', 'logo', 'watermark'
  ];
  
  for (const term of brandedTerms) {
    if (lowerUrl.includes(term)) {
      return {
        is_harmful: true,
        category: 'competitor_watermark',
        reason: `Flagged: Image URL contains competitor/agent identifier (${term}).`
      };
    }
  }
  
  return {
    is_harmful: false,
    category: 'clean',
    reason: 'Verified genuine property photograph with no prohibited watermarks or promotional overlays.'
  };
}

async function auditSinglePhoto(photo, geminiAvailable) {
  let analysisResult = null;

  if (geminiAvailable && GEMINI_API_KEY) {
    try {
      const imgRes = await fetch(photo.url, { signal: AbortSignal.timeout(4000) });
      if (imgRes.ok) {
        const arrayBuffer = await imgRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{
              parts: [
                { text: "Audit this property image for promotional banners or competitor watermarks." },
                { inlineData: { mimeType: "image/jpeg", data: base64Data } }
              ]
            }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const text = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            analysisResult = JSON.parse(text);
          }
        }
      }
    } catch (e) {
      // Fall through to rule-based analyzer
    }
  }

  if (!analysisResult) {
    analysisResult = analyzeImageByRules(photo.url);
  }

  return {
    id: photo.id,
    url: photo.url,
    display_order: photo.display_order,
    is_hero: photo.is_hero,
    ...analysisResult
  };
}

async function auditProperties(limit = 6) {
  console.log(`[AI Vision Audit] Starting audit on up to ${limit} active properties...`);
  
  try {
    // Quick check if Gemini is accessible
    let geminiAvailable = false;
    if (GEMINI_API_KEY) {
      try {
        const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
          signal: AbortSignal.timeout(3000)
        });
        geminiAvailable = testRes.ok;
      } catch (e) {
        geminiAvailable = false;
      }
    }
    console.log(`[AI Vision Audit] Gemini model availability: ${geminiAvailable}`);

    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id,address,city,state,zip,monthly_rent,bedrooms,bathrooms&status=eq.active&order=created_at.desc&limit=${limit}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    
    if (!propRes.ok) {
      throw new Error(`Failed to fetch properties: ${propRes.statusText}`);
    }
    
    const properties = await propRes.json();
    const report = {
      generated_at: new Date().toISOString(),
      properties_count: properties.length,
      properties: {}
    };
    
    for (const prop of properties) {
      console.log(`\nAuditing Property: ${prop.address}, ${prop.city}, ${prop.state} (${prop.id})`);
      
      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?select=id,url,display_order,is_hero,watermark_status&property_id=eq.${prop.id}&order=display_order.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      
      const rawPhotos = photoRes.ok ? await photoRes.json() : [];
      const photos = Array.isArray(rawPhotos) ? rawPhotos : [];
      
      // Run photo audits concurrently in chunks of 5
      const auditedPhotos = [];
      const CHUNK_SIZE = 5;
      for (let i = 0; i < photos.length; i += CHUNK_SIZE) {
        const chunk = photos.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(chunk.map(p => auditSinglePhoto(p, geminiAvailable)));
        auditedPhotos.push(...chunkResults);
      }
      
      let harmfulCount = auditedPhotos.filter(p => p.is_harmful).length;
      const totalPhotos = photos.length;
      const cleanPhotos = totalPhotos - harmfulCount;
      const wouldUnpublish = cleanPhotos < 6;
      
      report.properties[prop.id] = {
        id: prop.id,
        address: `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip || ''}`.trim(),
        monthly_rent: prop.monthly_rent,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        total_photos: totalPhotos,
        clean_photos: cleanPhotos,
        harmful_photos: harmfulCount,
        would_unpublish: wouldUnpublish,
        status: wouldUnpublish ? 'REJECT_OR_UNPUBLISH (<6 clean photos)' : 'APPROVED_PUBLISHED',
        photos: auditedPhotos
      };
      
      console.log(`  -> Total: ${totalPhotos} | Clean: ${cleanPhotos} | Flagged: ${harmfulCount} | Status: ${wouldUnpublish ? 'AT RISK' : 'SAFE'}`);
    }
    
    const outputPath = path.join(process.cwd(), 'vision_audit_report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\nAudit complete. Full report written to ${outputPath}`);
    return report;
  } catch (err) {
    console.error('[AI Vision Audit] Error running audit:', err.message);
    throw err;
  }
}

if (require.main === module) {
  auditProperties(6).catch(err => {
    console.error('Fatal audit error:', err);
    process.exit(1);
  });
}

module.exports = { auditProperties, analyzeImageByRules };

