(function (root) {
  'use strict';

  const FREE_APPLICATION_FEE_RE =
    /free\s+(?:to\s+)?apply|apply\s+for\s+free|no\s+(?:application\s+|app\s+)?fee|(?:^|[^\d])\$?\s*0\.?0*\s+(?:application\s+|app\s+)?fee|\b0\s+(?:application\s+|app\s+)?fee|zero\s+(?:application\s+)?fee|complimentary\s+application|(?:application|app)\s+fee\s+(?:is\s+|of\s+|:\s*)?0\b|application\s+(?:is\s+)?free|fee[- ]?free\s+application|free\s+application|(?:application\s+|app\s+)?fee\s+(?:will\s+be\s+|is\s+)?waived/i;
  const REQUIRED_FEE_MENTION_RE =
    /(?:\$50\s+application\s+fee|application\s+fee\s*:\s*\$?50\b)/i;
  const APPLICATION_FEE_PATTERNS = [
    /(?:application|app)\s+fee(?:\s+is|\s+of|:|\s+)\s*\$?\s*(\d+(?:\.\d{2})?)/gi,
    /\$?\s*(\d+(?:\.\d{2})?)\s+(?:application|app)\s+fee/gi,
  ];
  const PROHIBITED_DESCRIPTION_RULES = [
    {
      label: 'security-deposit language',
      pattern: /\b(?:security\s+)?deposit\b/i,
    },
    {
      label: 'availability or move-in timing',
      pattern: /\b(?:available|availability)\b|\bmove[-\s]?in\b/i,
    },
    {
      label: 'lease-term language',
      pattern: /\blease\b/i,
    },
    {
      label: 'pet information',
      pattern: /\b(?:pets?|cats?|dogs?)\b/i,
    },
    {
      label: 'smoking policy',
      pattern: /\bsmok(?:e|ing|er)\b/i,
    },
    {
      label: 'third-party application instructions',
      pattern: /\b(?:turbotenant|zillow|apartments\.com|rentspree|rentcafe|appfolio)\b|listing\s*id/i,
    },
    {
      label: 'tour, showing, or contact instructions',
      pattern: /\b(?:schedule|book)\s+(?:a\s+)?(?:tour|showing|viewing)\b|\bopen\s+house\b|\bcontact\s+(?:us|the\s+agent|the\s+landlord|owner)\b/i,
    },
    {
      label: 'agent contact details',
      pattern: /(?:\b(?:call|text|contact)\s+(?:the\s+)?(?:agent|broker|owner|landlord|manager)\b|\b\d{3}[-.\s)]\d{3}[-.\s]\d{4}\b|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b)/i,
    },
  ];

  function validateForPublish(listing) {
    const failures = [];
    const property = listing || {};
    const description = typeof property.description === 'string'
      ? property.description.trim()
      : '';

    const monthlyRent = Number(property.monthly_rent);
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      failures.push('Monthly rent is not set');
    } else if (monthlyRent > 100000) {
      failures.push('Monthly rent looks incorrect ($' + monthlyRent + ') — please verify');
    }

    if (Number(property.application_fee) !== 50) {
      failures.push('Application fee must be set to exactly $50');
    }

    if (!description) {
      failures.push('A reviewed property description is required');
    } else {
      if (FREE_APPLICATION_FEE_RE.test(description)) {
        failures.push('Description contains zero/free/waived application fee language');
      }

      if (!REQUIRED_FEE_MENTION_RE.test(description)) {
        failures.push('Description must state "$50 application fee" or "Application Fee: $50"');
      }

      for (const pattern of APPLICATION_FEE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(description)) !== null) {
          const amount = Number.parseFloat(match[1]);
          if (Math.abs(amount - 50) > 0.01) {
            failures.push(
              'Description references a non-$50 application fee ($' + amount + ')',
            );
          }
        }
      }

      for (const rule of PROHIBITED_DESCRIPTION_RULES) {
        if (rule.pattern.test(description)) {
          failures.push('Description contains prohibited ' + rule.label);
        }
      }
    }

    return { ok: failures.length === 0, failures };
  }

  const api = { validateForPublish };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.PipelineValidation = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
