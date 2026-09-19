/**
 * CHOICE PROPERTIES — CENTRALIZED PIPELINE STANDARDIZER & VALIDATOR
 * =================================================================
 * Enforces:
 * 1. Bathroom precision (zero-truncation, 1.5/2.5 baths, narrative cross-checking)
 * 2. Architectural property classification (DUPLEX vs TOWNHOUSE vs SINGLE_FAMILY)
 * 3. Exact original source title preservation
 * 4. Mandatory Choice Properties policies ($50 app fee, pet-friendly, zero security deposit in text, zero lease terms)
 */

export function standardizeAndValidateProperty(prop) {
  const result = { ...prop };

  // 1. Bathroom Parsing & Decimal Precision
  let baths = parseFloat(result.bathrooms || result.baths || 1);
  let halfBaths = parseInt(result.half_bathrooms || 0, 10);
  const text = (result.description || "").toLowerCase() + " " + (result.title || "").toLowerCase();

  // Cross-check with narrative text
  if (
    text.includes("1.5 bath") ||
    text.includes("1 and a half bath") ||
    text.includes("one and a half bath") ||
    text.includes("half bath") ||
    text.includes("powder room")
  ) {
    if (baths === 1) {
      baths = 1.5;
      halfBaths = 1;
    }
  } else if (
    text.includes("2.5 bath") ||
    text.includes("2 and a half bath") ||
    text.includes("two and a half bath")
  ) {
    if (baths === 2) {
      baths = 2.5;
      halfBaths = 1;
    }
  } else if (
    text.includes("3.5 bath") ||
    text.includes("3 and a half bath") ||
    text.includes("three and a half bath")
  ) {
    if (baths === 3) {
      baths = 3.5;
      halfBaths = 1;
    }
  }

  result.bathrooms = baths;
  result.half_bathrooms = halfBaths;
  result.total_bathrooms = Math.ceil(baths);

  // 2. Architectural Property Classification
  const rawType = (result.property_type || result.type || "").toUpperCase();
  if (
    text.includes("1/2 duplex") ||
    text.includes("half duplex") ||
    text.includes("half-duplex") ||
    text.includes("duplex") ||
    text.includes("side-by-side")
  ) {
    result.property_type = "DUPLEX";
  } else if (
    text.includes("townhouse") ||
    text.includes("townhome") ||
    text.includes("rowhouse") ||
    rawType.includes("TOWN")
  ) {
    result.property_type = "TOWNHOUSE";
  } else if (
    text.includes("single-family") ||
    text.includes("single family") ||
    text.includes("detached") ||
    rawType.includes("SINGLE") ||
    rawType.includes("HOUSE")
  ) {
    result.property_type = "SINGLE_FAMILY";
  } else {
    result.property_type = rawType || "SINGLE_FAMILY";
  }

  // 3. Exact Source Title Preservation
  if (result.source_title && !result.title) {
    result.title = result.source_title;
  }

  // 4. Policy Standardizations
  result.application_fee = 50;
  result.pets_allowed = true;
  if (!result.pet_types_allowed || result.pet_types_allowed === "[]") {
    result.pet_types_allowed = ["Dogs", "Cats"];
  }
  result.smoking_allowed = false;

  // 5. Strip security deposit mentions from description
  if (result.description) {
    result.description = result.description
      .replace(/security deposit:?\s*\$?[0-9,]+(\.[0-9]{2})?/gi, "")
      .replace(/deposit:?\s*\$?[0-9,]+(\.[0-9]{2})?/gi, "")
      .replace(/move-in expenses:?[^\n.]*/gi, "")
      .replace(/admin(?:istrative)? fee:?[^\n.]*/gi, "")
      .replace(/application fee:?[^\n.]*/gi, "")
      .replace(/lease term:?[^\n.]*/gi, "")
      .replace(/minimum lease:?[^\n.]*/gi, "")
      .replace(/no smoking[^\n.]*/gi, "")
      .replace(/no smokers[^\n.]*/gi, "")
      .replace(/call today for a private tour[^\n.]*/gi, "")
      .replace(/schedule a showing today[^\n.]*/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return result;
}
