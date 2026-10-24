const PROHIBITED_BLOCK_PATTERNS = [
  /\*\*\*\s*BEWARE[\s\S]*?\*\*\*/gi,
  /\*\*\*\s*IF\s+YOU\s+READ\s+THIS[\s\S]*?\*\*\*/gi,
  /BEWARE\s+OF\s+(?:RENTAL\s+)?SCAMS?:?[\s\S]*?(?=(?:Key Property Features|Property Highlights|•|\n\n[A-Z]|$))/gi,
  /Beware\s+of\s+scammers!?:?[\s\S]*?(?=(?:Key Property Features|Property Highlights|•|\n\n[A-Z]|$))/gi,
  /(?:REQUIREMENTS\s*&\s*QUALIFICATIONS|QUALIFICATIONS\s*&\s*REQUIREMENTS):?[\s\S]*?(?=(?:Key Property Features|Property Highlights|•|\n\n[A-Z]|$))/gi,
  /Rental\s+Requirements:?[\s\S]*?(?=(?:Key Property Features|Property Highlights|•|\n\n[A-Z]|Ready to make this|$))/gi,
  /Some photos may feature virtual furniture staging[\s\S]*?(?=(?:Key Property Features|Property Highlights|•|\n\n[A-Z]|$))/gi
];

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
  /\b(?:requirements\s*&\s*qualifications|qualifications\s*&\s*requirements)\b/i,
  /\bno\s+corporate\s+leases\b|\bairbnb\b/i,
  /\bcredit\s+score\s+must\b|\bminimum\s+\d{3}\s+credit\b|\bmin(?:imum)?\s+\d{3}\s+credit\b/i,
  /\bincome\s+must\s+exceed\b|\b3\.0\s*x?\s*(?:the\s+)?(?:monthly\s+)?rent\b|\bthree\s+times\s+the\s+monthly\s+rent\b/i,
  /\bno\s+evictions\s+or\s+broken\s+leases\b/i,
  /\bno\s+criminal\s+history\b/i,
  /\bapplication\s+pending\b|\bwaiting\s+list\s+options?\b/i,
  /\bphotos\s+are\s+stock\s+images\b|\bpictures\s+are\s+for\s+marketing\s+purposes\b|\billustrative\s+purposes\s+only\b|\bvirtual\s+furniture\s+staging\b/i,
  /\bno\s+vouchers?\s+accepted\b/i,
  /\b(?:beware|warning|alert|notice|protect yourself)\s*(?:of|from|against)?\s*(?:scams?|fraud|scammers?)\b|\bscam(?:s|mer|mers)?\b/i,
  /\b(?:craigslist|facebook\s+marketplace|tiktok|offerup)\b/i,
  /\b(?:do\s+not|don['']t|never)\s+(?:advertise|post|list)\s+on\b/i,
  /\b(?:cash\s*apps?|cashapp|zelle|paypal|venmo|apple\s*pay|wire\s*transfers?|western\s*union|money\s*orders?)\b/i,
  /\bnever\s+wire\s+money\b|\bwire\s+funds\b|\bask\s+for\s+payment\s+via\b/i,
  /\brental\s+requirements\b|\blease\s+requirements\b|\bqualifications?\b/i,
  /\bmeets\s+all\s+lease\s+requirements\b/i
];

const PHONE_OR_EMAIL = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;

export function sanitizeProhibitedDescription(description = '') {
  if (typeof description !== 'string' || !description) return '';

  let cleaned = description;

  // 1. Strip major multi-line boilerplate blocks
  for (const blockPattern of PROHIBITED_BLOCK_PATTERNS) {
    cleaned = cleaned.replace(blockPattern, '');
  }

  // 2. Direct surgical removals of phrases that appear mid-sentence
  cleaned = cleaned.replace(/We\s+do\s+not\s+advertise\s+on\s+Craigslist\s+or\s+TikTok\.\s*/gi, '');
  cleaned = cleaned.replace(/We\s+also\s+do\s+not\s+ask\s+for\s+payment\s+via\s+check,\s*cash,\s*wire\s*transfer,\s*or\s*cash\s*apps\.\s*/gi, '');
  cleaned = cleaned.replace(/upon\s+acceptance\s+that\s+it\s+meets\s+all\s+lease\s+requirements,?\s*/gi, '');
  cleaned = cleaned.replace(/Rental\s+Requirements:?\s*/gi, '');
  cleaned = cleaned.replace(/REQUIREMENTS\s*&\s*QUALIFICATIONS:?\s*/gi, '');

  // 3. Sentence-level filtering
  return cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !PROHIBITED_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence)) && !PHONE_OR_EMAIL.test(sentence))
    .join(' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}