#!/usr/bin/env python3
"""
Choice Properties — AI Enrichment Engine (Gemini Powered)
=========================================================
Uses Gemini Flash to perform deep property rewriting, metadata extraction,
and policy compliance according to Choice Properties platform rules.

Features:
  - Rewrites messy descriptions into inviting, professional copy
  - Enforces $50 application fee & 1x monthly rent security deposit
  - Enforces pet-friendly policy
  - Strips all competitor branding, realtor names, phone numbers, and external links
  - Extracts structured amenities (HVAC, parking, laundry, yard)
  - Scores listing readiness (0-100)
"""

import json
import os
import re
import time
import urllib.request
import urllib.error
from typing import Any, Dict, Optional

# Load environment
def _load_env():
    for env_path in [".env", "scraper/.env", "../.env"]:
        if os.path.isfile(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k and k not in os.environ:
                            os.environ[k] = v

_load_env()
DEFAULT_MODEL = "gemini-3.6-flash"


def call_gemini(prompt: str, system_instruction: Optional[str] = None, model: str = DEFAULT_MODEL, max_retries: int = 3) -> str:
    """Call Gemini API via standard HTTPS with retry and backoff."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        _load_env()
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    payload: Dict[str, Any] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        }
    }

    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    data = json.dumps(payload).encode("utf-8")

    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; ChoiceProperties/1.0)",
                "Connection": "close"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                res_body = resp.read().decode("utf-8")
                res_json = json.loads(res_body)
                candidates = res_json.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
                return "{}"
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            if attempt == max_retries:
                err_msg = str(e)
                if isinstance(e, urllib.error.HTTPError):
                    try:
                        err_msg += f" - {e.read().decode('utf-8', errors='ignore')}"
                    except Exception:
                        pass
                raise RuntimeError(f"Gemini API failed after {max_retries} attempts: {err_msg}")
            time.sleep(2 * attempt)


SYSTEM_PROMPT = """
You are the AI Property Content Specialist for Choice Properties (a nationwide rental marketplace).
Your job is to transform raw, scraped real estate data into clean, compliant, high-converting listings.

STRICT PLATFORM RULES:
1. Application Fee is ALWAYS $50. Never mention any other application fee amount.
2. Security Deposit is ALWAYS equal to 1 month's rent.
3. Every property is Pet-Friendly (dogs and cats welcome).
4. Remove ALL competitor branding (e.g. Invitation Homes, Progress Residential, FirstKey, Main Street Renewal, Tricon, Streetlane, etc.).
5. Remove ALL real estate agent names, broker names, phone numbers, emails, and external application websites (e.g., TurboTenant, Zillow Applications, MLS numbers, showing IDs).
6. Never include smoking policies or mentions of smoking.
7. Tone must be warm, professional, clear, and inviting.
8. End the description with: "Apply now at Choice Properties to make this your next home!"

You must respond ONLY with valid JSON matching this schema:
{
  "title": "Inviting X-Bed, Y-Bath Home in City, State",
  "cleaned_description": "Cleaned, engaging, complete property description adhering strictly to all rules.",
  "amenities": ["Central AC", "Garage", "Fenced Yard", "Hardwood Floors", "Pet Friendly"],
  "features": {
    "heating": "string or null",
    "cooling": "string or null",
    "laundry": "string or null (e.g. In-Unit, Hookups, On-Site)",
    "parking": "string or null (e.g. 2-Car Garage, Driveway, Off-Street)",
    "pets_allowed": true,
    "application_fee": 50
  },
  "quality_score": 95,
  "validation_passed": true,
  "notes": "Any fixes or removals performed"
}
"""


def enrich_property_with_ai(property_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enriches raw property record using Gemini AI.
    Returns the structured AI output.
    """
    prompt = f"""
Analyze and enrich this property listing:

Address: {property_data.get('address', '')}, {property_data.get('city', '')}, {property_data.get('state', '')} {property_data.get('zip_code', '')}
Monthly Rent: ${property_data.get('monthly_rent', property_data.get('rent', ''))}
Beds: {property_data.get('beds', property_data.get('bedrooms', ''))}
Baths: {property_data.get('baths', property_data.get('bathrooms', ''))}
Sqft: {property_data.get('sqft', '')}
Property Type: {property_data.get('property_type', 'Single Family')}

Raw Description:
{property_data.get('description', '')}

Raw Amenities / Details:
{json.dumps(property_data.get('amenities', []))}
"""

    response_text = call_gemini(prompt, system_instruction=SYSTEM_PROMPT)
    try:
        enriched = json.loads(response_text)
        return enriched
    except Exception as e:
        return {
            "error": f"Failed to parse AI response: {str(e)}",
            "raw_response": response_text
        }


if __name__ == "__main__":
    # Test script directly
    sample = {
        "address": "5804 N Meadows Blvd",
        "city": "Columbus",
        "state": "OH",
        "zip_code": "43229",
        "monthly_rent": 1199,
        "beds": 2,
        "baths": 1,
        "sqft": 950,
        "description": "Call agent John at 555-0199 or apply at TurboTenant ID 44321. Move-in special: $75 app fee. No pets allowed by landlord LLC. Central heating and AC, nice yard, driveway parking."
    }
    print("Testing AI Property Enrichment with Gemini...")
    result = enrich_property_with_ai(sample)
    print(json.dumps(result, indent=2))
