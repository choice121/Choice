const PROHIBITED_SENTENCE_PATTERNS = [
  /\b(?:security\s+)?deposit\b/i,
  /\bapplicable\s+deposits?\b/i,
  /\bfirst\s+(?:and\s+last\s+)?month(?:'s|s)?\s+rent\s+due\b|\blast\s+month(?:'s|s)?\s+rent\s+due\b/i,
  /\b(?:minimum\s+)?lease\s+(?:term|terms|duration|length|details|commencement)\b|\b\d+[- ]?(?:year|month)s?\s+lease\b|\bto\s+a\s+year\s+lease\b|\b\d+\s+year\s+rental\s+terms?\b|\bshorter\s+terms?\b|\blease\s+(?:is\s+for|signed)\b|\bsigning\s+of\s+lease\b|\bmonth[- ]to[- ]month\s+after\b|\bas\s+specified\s+in\s+the\s+lease\b/i,
  /\bavailable\s+(?:now|immediately|today|asap|on|from|starting|date|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{1,2}(?:st|nd|rd|th))?\b|\bmove[- ]?in\s+(?:ready|date|special|fee|policy)\b|\bready\s+for\s+move[- ]?in\b|\bcheck\s+availability\b|\bmove\s+in\s+by\b/i,
  /\bsmok(?:e|ing)(?:-free|\s+policy|\s+allowed|\s+not\s+allowed)?\b|\bnon[- ]?smoker\b/i,
  /\bpet[- ]friendly\b|\bpets?\s+(?:are\s+|is\s+)?(?:welcome|allowed|not\s+allowed|case\s+by\s+case|negotiable|subject\s+to\s+approval|considered|on\s+approval|to\s+be\s+changed)\b|\bdoes\s+(?:not\s+)?have\s+(?:any\s+)?pets\b|\b(?:cats|dogs|small\s+dogs)\b.*\b(?:ok|allowed|welcome)\b|\bpet\s+(?:fee|rent|deposit|policy|charge|screening|move-in)\b|\bpetscreening\b|\bfour-legged\s+best\s+friend\b|\bper\s+(?:approved\s+)?pet\b|\bphoto\s+of\s+pet(?:\(s\)|s)?\b|\bno\s+pets\b|\bpets?\s*:\s*/i,
  /\b(?:schedule|book|request|arrange|scheduling)\s+(?:a\s+|your\s+)?(?:private\s+|in[- ]person\s+)?(?:property\s+)?(?:tour|showing|viewing|walkthrough)\b|\b(?:in[- ]person|private)\s+(?:property\s+)?showings?\b|\bno\s+charge\s+to\s+schedule\b|\btours?\s*(?::|\s+(?:are\s+)?(?:available|scheduled))\b|\bopen\s+house\b|\bcontact\s+(?:us|me|the\s+(?:agent|owner|landlord|manager|property\s+manager)|landlord|for\s+details)\b|\bmessage\s+us\s+to\s+check\b|\bsee\s+leasing\s+realtor\b|\bwithout\s+a\s+scheduled\s+appointment\b|\blandlord\/property\s+manager\b|\bproperty\s+manager\b|\bplease\s+call\s*:?\b|\bplease\s+feel\s+free\s+to\s+reach\s+out\b|\bi\s+am\s+open\s+to\s+working\s+with\s+you\b|\bcontact\s+via\s+email\b|\bafter\s+your\s+showing\b/i,
  /\b(?:zillow|realtor\.com|turbotenant|apartments\s*(?:\.|dot)\s*com|rentcafe|rentspree|appfolio|craigslist|facebook\s+marketplace)\b|https?:\/\/\S+|\bwww\.[a-z0-9.-]+/i,
  /\bMLS\s*#?\s*\d+\b|\blisted\s+by\b|\bcourtesy\s+of\b|\blicense\s*#\s*[A-Z0-9]+\b/i,
  /\bfor\s+sale\b|\bmortgage\b|\bdown\s+payment\b|\bclosing\s+costs?\b|\bmake\s+an\s+offer\b/i,
  /\b(?:free|no|zero|waived|complimentary)\s+(?:application\s+)?fee\b|\b(?:application|app|screening|administrative|administration|admin|single\s+applicants?|co-applicants?|one\s+time\s+move\s+in)\s+(?:and\s+background\s+check\s+)?fee\b|\$\s*(?:\d+(?:\.\d{2})?)\s+(?:non[- ]refundable\s+)?(?:application|app|screening|administrative|administration|admin)(?:\s+and\s+background\s+check)?\s+fee\b|\breimburse\s+the\s+application\s+fee\b|\bpaying\s+the\s+fee\b|\bthe\s+only\s+fee\s+associated\s+with\s+applying\b/i,
  /\brent\s+special\b|\$\s*200\s+off\s+rent\b|\bsplit\s+the\s+payment\b/i,
  /\bresidents?\s+benefits?\s+package\b|\bRBP\b|\bmore\s+details\s+upon\s+application\b/i,
  /\b(?:camber|hco\s+leasing|mynd(?:\s+property\s+management)?|tom\s+williams\s+realty|t\.?\s*r\.?\s*lawing(?:\s+realty)?|anthony\s+little)\b/i,
  /\bproperty\s+management\s+company\b|\bplease\s+visit\s+our\s+website\b|\bequal\s+opportunity\s+housing\b|\bfederal\s+occupancy\s+guidelines\b|\bwarning\s+avoid\s+scams\b|\bpre-?application\s+process\b|\bdetermine\s+eligibility\s+before\s+proceeding\b|\bplease\s+send\s+me\s+the\s+following\s+information\b|\bafter\s+i\s+review\s+it\b/i,
  /^(?:\d+\.\s*)?(?:full\s+name|number\s+of\s+people|your\s+relationship|estimated\s+credit\s+score|total\s+gross\s+household\s+income|current\s+job\s+title|employer\s+name|length\s+of\s+employment|preferred\s+move-in\s+date|do\s+you\s+have\s+any\s+eviction)/i,
  /^3d\s+tour(?:\s+link)?$/i,
  /^important\s+showing\s*&\s+application\s+information$/i,
  /^(?:1st|com|application\s+review\s+process\s+may\s+take\s+\d+\s+days\s+to\s+complete|\d{1,2})\.?$/i,
];

const PHONE_OR_EMAIL = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;

export function sanitizeProhibitedDescription(description = '') {
  if (typeof description !== 'string' || !description) return '';

  // Remove multi-sentence third-party RBP / property-manager boilerplate blocks and inline ownership prefixes first
  let text = description
    .replace(/(?:^|\n)\s*All\s+(?:[A-Z][A-Za-z0-9\s&.'-]{1,40}\s+)?residents\s+are\s+enrolled\s+in\s+the\s+Resident\s+Benefits\s+Package[\s\S]*?(?=\n\n|$)/gi, '')
    .replace(/_{3,}\s*RENT\s+WITH\s+MYND[\s\S]*$/gi, '')
    .replace(/\bAt\s+T\.?\s*R\.?\s*Lawing\s+Realty[\s\S]*$/gi, '')
    .replace(/^\s*(?:T\.?\s*R\.?\s*Lawing\s+Realty\s+Property|For\s+Rent\s+by\s+Private\s+Owner\s*:?|Privately\s+owned)\s*/gim, '')
    .replace(/\bschedule\s+your\s+showing\s+today[!.]?/gi, '')
    .replace(/\bRENT\s+SPECIAL\s*~\s*\$200\s+OFF\s+RENT[^!\n]*!*/gi, '')
    .replace(/\*\*WARNING\s+AVOID\s+SCAMS\*\*[\s\S]*?DETAILS\)\.?/gi, '')
    .replace(/\b1\.\s*Full\s+name:[\s\S]*?10\.\s*Do\s+you\s+have\s+any\s+eviction\s+history[^\n]*/gi, '')
    .replace(/^\s*3D\s+TOUR(?:\s+LINK)?\s*\n+/gim, '')
    .replace(/^\s*Lease\s+Terms\s*&\s*Rental\s+Requirements\s*/gim, '')
    .replace(/Apartments\s*\.\s*com/gi, 'apartments.com');

  // Split by newlines, sentence boundaries, or inline " - " bullet separators
  const segments = text
    .split(/\n+|(?<=[.!?])\s+|\s+-\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

  return segments
    .filter((segment) => {
      if (PHONE_OR_EMAIL.test(segment)) return false;
      return !PROHIBITED_SENTENCE_PATTERNS.some((pattern) => pattern.test(segment));
    })
    .join(' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.')
    .trim();
}