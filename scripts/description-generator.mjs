/**
 * CHOICE PROPERTIES — DESCRIPTION SANITIZER (SOURCE-ONLY)
 * ========================================================
 * Produces a description from the source listing text only.
 * No features, amenities, appliances, or policies are invented.
 * Prohibited content is stripped. $50 application fee is appended.
 */

export function extractMinedFacts(rawDescription = '', structuredData = {}) {
  const text = (rawDescription || '').toLowerCase();
  const finishes = [];
  if (text.includes('hardwood') || text.includes('hard woods') || text.includes('oak')) finishes.push('Hardwood Flooring');
  if (text.includes('luxury vinyl') || text.includes('lvp') || text.includes('vinyl plank')) finishes.push('Luxury Vinyl Plank');
  if (text.includes('ceramic tile') || text.includes('tile floor') || text.includes('subway tile')) finishes.push('Ceramic Tile');
  if (text.includes('carpet')) finishes.push('Carpet');
  if (text.includes('granite')) finishes.push('Granite Countertops');
  if (text.includes('quartz')) finishes.push('Quartz Countertops');
  if (text.includes('butcher block')) finishes.push('Butcher-Block Countertops');
  if (text.includes('shaker')) finishes.push('Shaker Cabinetry');

  const kitchenFeatures = [];
  if (text.includes('island')) kitchenFeatures.push('Kitchen Island');
  if (text.includes('peninsula') || text.includes('breakfast bar')) kitchenFeatures.push('Breakfast Bar / Peninsula');
  if (text.includes('pantry')) kitchenFeatures.push('Pantry Storage');
  if (text.includes('backsplash')) kitchenFeatures.push('Tile Backsplash');

  const layoutFeatures = [];
  if (text.includes('finished basement') || text.includes('finished lower')) layoutFeatures.push('Finished Lower-Level Suite');
  if (text.includes('walkout') || text.includes('walk out')) layoutFeatures.push('Walkout Access');
  if (text.includes('open concept') || text.includes('open floor')) layoutFeatures.push('Open-Concept Living');
  if (text.includes('tray ceiling') || text.includes('vaulted')) layoutFeatures.push('Vaulted / Tray Ceilings');
  if (text.includes('jetted tub') || text.includes('soaking tub')) layoutFeatures.push('Soaking / Jetted Tub');
  if (text.includes('walk-in shower') || text.includes('walk in shower')) layoutFeatures.push('Tiled Walk-In Shower');
  if (text.includes('walk-in closet') || text.includes('walk in closet')) layoutFeatures.push('Walk-In Closets');
  if (text.includes('fireplace')) layoutFeatures.push('Fireplace');

  const outdoorFeatures = [];
  if (text.includes('fenced yard') || text.includes('privacy fence')) outdoorFeatures.push('Fully Fenced Backyard');
  if (text.includes('deck')) outdoorFeatures.push('Sun Deck');
  if (text.includes('patio')) outdoorFeatures.push('Concrete Patio');
  if (text.includes('balcony')) outdoorFeatures.push('Private Balcony');
  if (text.includes('storage shed') || text.includes('shed')) outdoorFeatures.push('Storage Shed');
  if (text.includes('carport')) outdoorFeatures.push('Sheltered Carport');

  const appliances = new Set(structuredData.appliances || []);
  if (text.includes('refrigerator') || text.includes('fridge')) appliances.add('Refrigerator');
  if (text.includes('dishwasher')) appliances.add('Dishwasher');
  if (text.includes('microwave')) appliances.add('Microwave');
  if (text.includes('oven') || text.includes('stove') || text.includes('range')) appliances.add('Range / Oven');
  if (text.includes('cooktop')) appliances.add('Cooktop Range');
  if (text.includes('wall oven')) appliances.add('Built-in Wall Oven');
  if (text.includes('disposal')) appliances.add('Garbage Disposal');
  if (text.includes('freezer')) appliances.add('Auxiliary Freezer');
  if (text.includes('washer') || text.includes('dryer') || text.includes('hookup')) appliances.add('Washer/Dryer Hookups');

  // Only include parking/outdoor features actually mentioned in source text.
  const parkingFeatures = [];
  if (text.includes('garage')) parkingFeatures.push('Garage Parking');

  return {
    finishes,
    kitchenFeatures,
    layoutFeatures,
    outdoorFeatures,
    appliances: Array.from(appliances),
    parkingFeatures
  };
}

export function stripProhibitedContent(text = '') {
  if (!text) return '';
  let cleaned = text;
  // Requirements & Qualifications block and individual clauses
  cleaned = cleaned.replace(/\b(?:requirements\s*&\s*qualifications|qualifications\s*&\s*requirements)\b:?/gi, '');
  cleaned = cleaned.replace(/no\s+corporate\s+leases\s+(allowed\s+)?(or\s+)?airbnb[^.\n]*/gi, '');
  cleaned = cleaned.replace(/credit\s+score\s+must\s+be\s+a\s+minimum[^.\n]*/gi, '');
  cleaned = cleaned.replace(/income\s+must\s+exceed[^.\n]*/gi, '');
  cleaned = cleaned.replace(/no\s+evictions\s+or\s+broken\s+leases[^.\n]*/gi, '');
  cleaned = cleaned.replace(/no\s+criminal\s+history[^.\n]*/gi, '');
  cleaned = cleaned.replace(/application\s+pending\s*-\s*waiting\s+list[^.\n]*/gi, '');
  cleaned = cleaned.replace(/photos\s+are\s+stock\s+images[^.\n]*/gi, '');
  cleaned = cleaned.replace(/pictures\s+are\s+for\s+marketing\s+purposes[^.\n]*/gi, '');

  // Scam & fraud disclaimers
  cleaned = cleaned.replace(/\b(?:beware|warning|alert|notice|protect yourself)\s*(?:of|from|against)?\s*(?:scams?|fraud|scammers?)[^.\n]*/gi, '');
  cleaned = cleaned.replace(/we\s+(do\s+not|don['']t|never)\s+(post|list|advertise)\s+on[^.\n]*/gi, '');
  cleaned = cleaned.replace(/\b(?:craigslist|facebook\s+marketplace|tiktok|offerup)[^.\n]*/gi, '');
  cleaned = cleaned.replace(/\bscam(?:s|mer|mers)?\b[^.\n]*/gi, '');

  // Third-party payment methods
  cleaned = cleaned.replace(/\b(?:cash\s*app|cashapp|zelle|paypal|venmo|apple\s*pay|wire\s*transfer|western\s*union|money\s*order)[^.\n]*/gi, '');
  cleaned = cleaned.replace(/never\s+wire\s+money[^.\n]*/gi, '');

  // Contact info, URLs, portals
  cleaned = cleaned.replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '');
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, '');
  cleaned = cleaned.replace(/(zillow|realtor|opendoor|turbotenant|apartments\.com|redfin|trulia)[^,\s.]*/gi, '');
  cleaned = cleaned.replace(/(call|text|contact|reach out to)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?[^.\n]*/gi, '');
  cleaned = cleaned.replace(/schedule\s+(a\s+)?(showing|tour|viewing)[^.\n]*/gi, '');
  cleaned = cleaned.replace(/open\s+house[^.\n]*/gi, '');

  // Security deposit
  cleaned = cleaned.replace(/(security\s+)?deposit\s*(is|of|amount)?\s*:?\s*\$?\s*[\d,]+[^.\n]*/gi, '');
  cleaned = cleaned.replace(/\$?\s*[\d,]+\s*(security\s+)?deposit[^.\n]*/gi, '');
  cleaned = cleaned.replace(/deposit\s+free[^.\n]*/gi, '');

  // Lease duration
  cleaned = cleaned.replace(/\b\d+[- ]month(s)?\s+lease\b[^.\n]*/gi, '');
  cleaned = cleaned.replace(/\b\d+[- ]year(s)?\s+lease\b[^.\n]*/gi, '');
  cleaned = cleaned.replace(/lease\s+(duration|term|length|period)[^.\n]*/gi, '');

  // Move-in / Availability
  cleaned = cleaned.replace(/available\s+(now|immediately|for\s+rent|on\s+[A-Za-z0-9/,-]+)[^.\n]*/gi, '');
  cleaned = cleaned.replace(/move[- ]in\s*(ready|date|special)?[^.\n]*/gi, '');
  cleaned = cleaned.replace(/ready\s+for\s+move[- ]in[^.\n]*/gi, '');

  // Smoking
  cleaned = cleaned.replace(/no\s+smoking[^.\n]*/gi, '');
  cleaned = cleaned.replace(/smoking\s+(is\s+)?(prohibited|not\s+allowed|policy)[^.\n]*/gi, '');

  // Application fee variations ($0, free, waived)
  cleaned = cleaned.replace(/(no|\$0|zero|free)\s+application\s+fee[^.\n]*/gi, '');
  cleaned = cleaned.replace(/application\s+fee\s*(is\s*)?(waived|\$0|free)[^.\n]*/gi, '');

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

export function determineArchetypeAndTier(prop, minedFacts = {}) {
  const sqft = Number(prop.square_footage || 0);
  const beds = Number(prop.bedrooms || 0);
  const baths = Number(prop.bathrooms || 0);
  const type = (prop.property_type || '').toUpperCase();
  const rawText = (prop.original_description || '').toLowerCase();

  let tier = 'STANDARD';
  if (sqft > 2100 || (baths >= 3 && sqft >= 1800) || rawText.includes('finished basement')) {
    tier = 'SHOWCASE';
  } else if ((sqft > 0 && sqft < 1350) || beds <= 2 || type === 'DUPLEX') {
    tier = 'COMPACT';
  }

  let archetype = 'neighborhood_walkthrough';
  if (rawText.includes('finished basement') || rawText.includes('lower level') || rawText.includes('split level')) {
    archetype = 'multi_tier_retreat';
  } else if (minedFacts.kitchenFeatures?.length > 0 || rawText.includes('island') || rawText.includes('chef')) {
    archetype = 'culinary_hub';
  } else if (type === 'TOWNHOUSE' || rawText.includes('end-unit') || rawText.includes('end unit')) {
    archetype = 'townhome_sanctuary';
  } else if ((prop.lot_size_sqft && prop.lot_size_sqft >= 13000) || minedFacts.outdoorFeatures?.includes('Sun Deck')) {
    archetype = 'expansive_grounds';
  } else if (prop.floors === 1 || rawText.includes('ranch')) {
    archetype = 'single_level_ease';
  }

  return { tier, archetype };
}

export function generateDynamicDescription(prop, options = {}) {
  const rawText = prop.original_description || prop.description || '';
  const sanitized = stripProhibitedContent(rawText);
  if (!sanitized) {
    return 'Application Fee: $50. Submit your rental application today at Choice Properties.';
  }
  let desc = sanitized;
  if (!desc.includes('Application Fee: $50') && !desc.includes('$50 application fee')) {
    desc += '\n\nApplication Fee: $50. Submit your rental application today at Choice Properties.';
  }
  return desc;
}

export function lintDescription(description = '', prop = {}) {
  const errors = [];
  const warnings = [];
  const text = (description || '').toLowerCase();

  if (text.includes('security deposit') || text.includes('deposit of') || text.includes('deposit:')) {
    errors.push('CRITICAL: Description contains security deposit mention. Security deposits must strictly be omitted from descriptions.');
  }
  if (text.includes('12 month') || text.includes('1 year lease') || text.includes('lease term') || text.includes('minimum lease')) {
    errors.push('CRITICAL: Description contains lease term or duration. Lease durations must never be displayed.');
  }
  if (text.includes('smoking') || text.includes('no smoking') || text.includes('smoke free')) {
    errors.push('CRITICAL: Description contains smoking restriction. Smoking policies are removed from property pages.');
  }
  if (text.includes('available now') || text.includes('available on') || text.includes('available immediately') || text.includes('move-in ready')) {
    errors.push('CRITICAL: Description contains move-in or availability date. Available dates must be omitted.');
  }
  if (!text.includes('$50') && !text.includes('50 application fee')) {
    errors.push('CRITICAL: Description is missing the mandatory "$50 application fee" or "Application Fee: $50" statement.');
  }
  if (text.includes('$0') || text.includes('free application') || text.includes('fee waived')) {
    errors.push('CRITICAL: Description mentions $0/free application fee. Fee must strictly be $50.');
  }
  if (text.includes('pet-friendly') || text.includes('pet friendly') || text.includes('pets allowed')) {
    warnings.push('Description mentions pet policy; pet information must be omitted per policy.');
  }
  if (prop.bathrooms) {
    const expectedBath = String(prop.bathrooms);
    if (!description.includes(expectedBath) && !description.includes(`${prop.bathrooms} Bath`)) {
      warnings.push(`Bathroom mismatch: DB specifies ${expectedBath} bathrooms, but description does not clearly match.`);
    }
  }
  if (/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(description)) {
    errors.push('CRITICAL: Description contains phone number. External contact info must be stripped.');
  }
  if (/https?:\/\//i.test(description)) {
    errors.push('CRITICAL: Description contains external URL. URLs must be stripped.');
  }
  if (/requirements\s*&\s*qualifications|no\s+corporate\s+leases|credit\s+score\s+must\s+be\s+a\s+minimum|income\s+must\s+exceed|no\s+evictions\s+or\s+broken\s+leases|no\s+criminal\s+history|pictures\s+are\s+for\s+marketing\s+purposes/i.test(description)) {
    errors.push('CRITICAL: Description contains prohibited qualifications/requirements text.');
  }
  if (/beware\s*(?:of)?\s*scam|scammers?|we\s+do\s+not\s+(?:post|list)\s+on\s+craigslist|facebook\s+marketplace/i.test(description)) {
    errors.push('CRITICAL: Description contains scam or social media listing warnings.');
  }
  if (/cash\s*app|cashapp|zelle|paypal|venmo|wire\s*transfer/i.test(description)) {
    errors.push('CRITICAL: Description mentions prohibited third-party payment methods.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    wordCount: description.split(/\s+/).filter(Boolean).length
  };
}