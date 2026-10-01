export const ZILLOW_BATCH_RENT_CAP = 1800;

const RENT_PRICE_RE =
  /\b((?:monthly\s+)?rent\b(?:\s+(?:is|of|at))?\s*[:=]?\s*)\$\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:\/\s*(?:mo(?:nth)?|month)|per\s+month))?/gi;

function formatRent(rent) {
  return `$${rent.toLocaleString('en-US', { maximumFractionDigits: 2 })}/month`;
}

/**
 * Apply the temporary $1,800 rent ceiling to one property in the master
 * Zillow batch. Keep the security deposit synchronized with the final rent
 * and correct any explicit rent quote in the listing description.
 */
export function capZillowBatchRent(property) {
  if (!property || typeof property !== 'object') {
    throw new TypeError('A Zillow batch property record is required.');
  }

  const sourceRent = Number(property.monthly_rent);
  if (!Number.isFinite(sourceRent) || sourceRent <= 0) {
    throw new RangeError('Zillow batch monthly_rent must be a positive number.');
  }

  const monthlyRent = Math.min(sourceRent, ZILLOW_BATCH_RENT_CAP);
  const rentText = formatRent(monthlyRent);
  const description = typeof property.description === 'string'
    ? property.description.replace(RENT_PRICE_RE, (_match, prefix) => `${prefix}${rentText}`)
    : property.description;

  return {
    ...property,
    monthly_rent: monthlyRent,
    security_deposit: monthlyRent,
    description,
  };
}