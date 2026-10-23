const PROHIBITED_SENTENCE_PATTERNS = [
  /\bsecurity\s+deposit\b/i,
  /\b(?:minimum\s+)?lease\s+(?:term|duration|length)\b|\b\d+[- ]month\s+lease\b/i,
  /\bavailable\s+(?:now|immediately|today|on|from|starting|date)\b|\bmove[- ]in\s+(?:ready|date)\b|\bready\s+for\s+move[- ]in\b/i,
  /\bsmok(?:e|ing)(?:-free|\s+policy|\s+allowed|\s+not\s+allowed)?\b/i,
  /\bpet[- ]friendly\b|\bpets?\s+(?:are\s+)?(?:welcome|allowed|not\s+allowed)\b|\b(?:cats|dogs)\s+(?:are\s+)?(?:ok|allowed)\b/i,
  /\b(?:schedule|book|request|arrange)\s+(?:a\s+)?(?:tour|showing|viewing)\b|\bopen\s+house\b|\bcontact\s+(?:the\s+)?(?:agent|owner|landlord|manager)\b/i,
  /\b(?:apply|application)\s+(?:through|via|on|at)\s+(?:zillow|realtor|turbotenant|apartments\.com|rentcafe|rentspree|appfolio)\b|https?:\/\/\S+/i,
  /\bMLS\s*#?\s*\d+\b|\blisted\s+by\b|\bcourtesy\s+of\b/i,
  /\bfor\s+sale\b|\bmortgage\b|\bdown\s+payment\b|\bclosing\s+costs?\b|\bmake\s+an\s+offer\b/i,
  /\b(?:free|no|zero|waived|complimentary)\s+(?:application\s+)?fee\b|\b(?:application|app)\s+fee\b[^.!?\n]*\$\s*(?:0|[1-4]?\d|5[1-9]|[6-9]\d|\d{3,})\b|\$\s*(?:0|[1-4]?\d|5[1-9]|[6-9]\d|\d{3,})\s*(?:application|app)\s+fee\b/i,
];

const PHONE_OR_EMAIL = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;

export function sanitizeProhibitedDescription(description = '') {
  if (typeof description !== 'string' || !description) return '';

  return description
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !PROHIBITED_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence)) && !PHONE_OR_EMAIL.test(sentence))
    .join(' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}