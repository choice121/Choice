import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { permissiveCorsHeaders, permissiveJsonOk, permissiveJsonErr, handleCors } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `You are a real estate listing parser. Extract property details from the provided text into a strict JSON format.
Only return valid JSON without any markdown formatting or code blocks.
Expected JSON fields (use null if not found):
- address (string)
- city (string)
- state (string, 2 letters)
- zip (string)
- bedrooms (number)
- bathrooms (number)
- square_footage (number)
- monthly_rent (number)
- property_type (string: 'house', 'apartment', 'condo', 'townhouse')
- description (string)
- year_built (number)
- parking (string)
- pets_allowed (boolean)
- available_date (string, YYYY-MM-DD)
- amenities (array of strings)
- original_image_urls (array of strings) - Only if URLs are explicitly found in the text.
`;

serve(async (req: Request) => {
  if (handleCors(req)) return new Response(null, { headers: permissiveCorsHeaders });

  try {
    const { url, text } = await req.json();

    if (!text) {
      return permissiveJsonErr(400, "Missing 'text' field in request body", req);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return permissiveJsonErr(500, "GEMINI_API_KEY is not configured", req);
    }

    const promptText = `URL: ${url || "Unknown"}\n\nListing Text:\n${text}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json",
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return permissiveJsonErr(502, "AI Extraction failed", req);
    }

    const result = await response.json();
    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!extractedText) {
      return permissiveJsonErr(500, "No content returned from AI", req);
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(extractedText);
    } catch (e) {
      console.error("Failed to parse JSON from AI:", extractedText);
      return permissiveJsonErr(500, "AI returned invalid JSON", req);
    }

    // Attach the source URL so it behaves like the standard payload
    if (url) {
      parsedData.original_url = url;
      // simple source heuristic
      if (url.includes('zillow')) parsedData.source = 'zillow';
      else if (url.includes('realtor')) parsedData.source = 'realtor';
      else if (url.includes('apartments')) parsedData.source = 'apartments';
      else if (url.includes('redfin')) parsedData.source = 'redfin';
      else parsedData.source = 'manual';
    } else {
      parsedData.source = 'manual';
    }

    return permissiveJsonOk({ ok: true, data: parsedData }, req);

  } catch (error: any) {
    console.error("Extract Listing AI Error:", error);
    return permissiveJsonErr(500, error.message, req);
  }
});
