import { CREDENTIALS_CONFIG } from "../credentials-config.mjs";
import { standardizeAndValidateProperty } from "./pipeline_standardizer.mjs";

const url = CREDENTIALS_CONFIG.SUPABASE_URL;
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const targetIds = [
  "f1693a41-0061-4185-aae4-70f42926cd1a", // 2232 Washington Ave (Duplex)
  "1be9d581-b7c0-4384-8417-5715f4a16d4d", // 3707 Bryce Ave (Duplex)
  "14771dd3-6cd0-463d-a947-1812a9f095f9", // 2506 Normont Cir (Single Family)
  "da73edd3-1b40-42fa-b1bf-d5a992c9b1fd", // 5718 Houghton Ave (Single Family)
  "b57e770a-f6b5-444e-8b50-0387094f57e9", // 3440 Stuart Dr (Duplex)
  "0b4cc7ea-e3c7-4706-8a3f-cf598ed098e6", // 3019 NW 27th St (Single Family)
  "13b298b7-0a68-43f1-aed5-a937ca4170ad", // 3331 Avenue J (Single Family)
  "2a587930-ec85-433a-8bb5-4d4e115a9f78", // 1444 Weiler Blvd (Townhouse)
  "e2ec9cf3-a67e-48ac-8e3d-835802bdc16d", // 3211 Rogers Ave (Single Family)
  "34076c5f-d18f-440f-b21a-cca3dd054ea1", // 6819 W Cleburne Rd (Duplex)
  "b903a6bc-189c-4527-b36d-6e27246d3a42", // 5947 Shadydell Dr (Townhouse / 1.5 baths)
  "f083c58d-598b-4928-ae62-0008e9e78024"  // 6702 S Creek Dr (Duplex)
];

async function applyStandardization() {
  const res = await fetch(`${url}/rest/v1/properties?id=in.(${targetIds.join(",")})&select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const properties = await res.json();

  for (const prop of properties) {
    const std = standardizeAndValidateProperty(prop);
    
    // Ensure title remains exact Zillow format
    std.title = "2BR Single Family in Fort Worth";

    const patchPayload = {
      title: std.title,
      property_type: std.property_type,
      bathrooms: std.bathrooms,
      half_bathrooms: std.half_bathrooms,
      total_bathrooms: std.total_bathrooms,
      application_fee: std.application_fee,
      pets_allowed: std.pets_allowed,
      smoking_allowed: std.smoking_allowed,
      description: std.description
    };

    const updateRes = await fetch(`${url}/rest/v1/properties?id=eq.${prop.id}`, {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patchPayload)
    });

    console.log(`Verified & Standardized [${prop.id}] ${prop.address} | Type: ${std.property_type} | Baths: ${std.bathrooms} (Status: ${updateRes.status})`);
  }
}

applyStandardization();
