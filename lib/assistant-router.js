/**
 * Choice Properties — Assistant Router
 * Handles all /api/assistant/* REST endpoints for the Inquiry Assistant & Customer Memory System.
 */

const CustomerStore = require('./customer-store');
const AIAssistant = require('./ai-assistant');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

function json(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({ rawText: body.trim(), text: body.trim() });
      }
    });
    req.on('error', reject);
  });
}

async function handleAssistantApi(req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  try {
    // 1. GET /api/assistant/customers
    if (pathname === '/api/assistant/customers' && method === 'GET') {
      const search = urlObj.searchParams.get('search') || '';
      const phone_last4 = urlObj.searchParams.get('phone_last4') || '';
      const alias = urlObj.searchParams.get('alias') || '';
      const customers = CustomerStore.listCustomers({ search, phone_last4, alias });
      return json(res, 200, { ok: true, customers });
    }

    // 2. POST /api/assistant/customers
    if (pathname === '/api/assistant/customers' && method === 'POST') {
      const body = await readBody(req);
      const customer = CustomerStore.createCustomer(body);
      return json(res, 201, { ok: true, customer });
    }

    // 3. POST /api/assistant/customers/lookup
    if (pathname === '/api/assistant/customers/lookup' && method === 'POST') {
      const body = await readBody(req);
      const identifier = body.identifier;
      const result = CustomerStore.findByIdentifier(identifier);
      if (!result) {
        return json(res, 200, { ok: true, found: false });
      }
      if (result.collision) {
        return json(res, 200, { ok: true, found: true, collision: true, matches: result.matches, phone_last4: result.phone_last4 });
      }
      return json(res, 200, { ok: true, found: true, customer: result });
    }

    // 4. POST /api/assistant/customers/link
    if (pathname === '/api/assistant/customers/link' && method === 'POST') {
      const body = await readBody(req);
      const { primaryId, secondaryId } = body;
      if (!primaryId || !secondaryId) {
        return json(res, 400, { ok: false, error: 'primaryId and secondaryId are required' });
      }
      const linked = CustomerStore.linkCustomers(primaryId, secondaryId);
      return json(res, 200, { ok: true, customer: linked });
    }

    // 5. GET /api/assistant/customers/:id
    const custIdMatch = pathname.match(/^\/api\/assistant\/customers\/([a-zA-Z0-9_-]+)$/);
    if (custIdMatch && method === 'GET') {
      const id = custIdMatch[1];
      const customer = CustomerStore.getCustomer(id);
      if (!customer) {
        return json(res, 404, { ok: false, error: 'Customer not found' });
      }
      return json(res, 200, { ok: true, customer });
    }

    // 6. PUT /api/assistant/customers/:id
    if (custIdMatch && method === 'PUT') {
      const id = custIdMatch[1];
      const body = await readBody(req);
      const updated = CustomerStore.updateCustomer(id, body);
      if (!updated) {
        return json(res, 404, { ok: false, error: 'Customer not found' });
      }
      return json(res, 200, { ok: true, customer: updated });
    }

    // 7. POST /api/assistant/customers/:id/messages
    const custMsgMatch = pathname.match(/^\/api\/assistant\/customers\/([a-zA-Z0-9_-]+)\/messages$/);
    if (custMsgMatch && method === 'POST') {
      const id = custMsgMatch[1];
      const body = await readBody(req);
      const message = CustomerStore.addMessage(id, body);
      if (!message) {
        return json(res, 404, { ok: false, error: 'Customer not found' });
      }
      return json(res, 201, { ok: true, message });
    }

    // 8. PATCH /api/assistant/customers/:id/messages/:msgId
    const patchMsgMatch = pathname.match(/^\/api\/assistant\/customers\/([a-zA-Z0-9_-]+)\/messages\/([a-zA-Z0-9_-]+)$/);
    if (patchMsgMatch && method === 'PATCH') {
      const customerId = patchMsgMatch[1];
      const messageId = patchMsgMatch[2];
      const body = await readBody(req);
      const updatedMsg = CustomerStore.updateMessage(customerId, messageId, body);
      if (!updatedMsg) {
        return json(res, 404, { ok: false, error: 'Message not found' });
      }
      return json(res, 200, { ok: true, message: updatedMsg });
    }

    // 9. POST /api/assistant/customers/:id/notes
    const custNoteMatch = pathname.match(/^\/api\/assistant\/customers\/([a-zA-Z0-9_-]+)\/notes$/);
    if (custNoteMatch && method === 'POST') {
      const id = custNoteMatch[1];
      const body = await readBody(req);
      const note = CustomerStore.addNote(id, body);
      if (!note) {
        return json(res, 404, { ok: false, error: 'Customer not found' });
      }
      return json(res, 201, { ok: true, note });
    }

    // 10. DELETE /api/assistant/customers/:id/notes/:noteId
    const delNoteMatch = pathname.match(/^\/api\/assistant\/customers\/([a-zA-Z0-9_-]+)\/notes\/([a-zA-Z0-9_-]+)$/);
    if (delNoteMatch && method === 'DELETE') {
      const customerId = delNoteMatch[1];
      const noteId = delNoteMatch[2];
      const success = CustomerStore.deleteNote(customerId, noteId);
      return json(res, 200, { ok: true, deleted: success });
    }

    // 11. POST /api/assistant/quick-draft & /api/assistant/mobile-quick (Mobile iPhone Copilot)
    if ((pathname === '/api/assistant/quick-draft' || pathname === '/api/assistant/mobile-quick') && method === 'POST') {
      const body = await readBody(req);
      const incomingText = body.text || body.message || body.rawText || '';
      if (!incomingText) {
        return json(res, 400, { ok: false, error: 'text or message parameter is required' });
      }

      // 1. Automatically resolve existing customer or auto-create one seamlessly
      const { customer, cleanMessage } = CustomerStore.resolveOrAutoCreate({
        identifier: body.identifier || body.phone_last4,
        phone: body.phone,
        alias: body.alias,
        messageText: incomingText
      });

      // 2. Automatically extract preferences and persist to customer memory
      const updates = AIAssistant.extractPreferenceUpdates(cleanMessage);
      if (Object.keys(updates).length > 0) {
        CustomerStore.updateCustomer(customer.id, updates);
      }

      // 3. Record customer's incoming message in conversation history
      CustomerStore.addMessage(customer.id, {
        sender: 'customer',
        message_text: cleanMessage,
        channel: body.channel || 'mobile'
      });

      // 4. Generate context-aware response
      const replyResult = await AIAssistant.generateReply({
        customerId: customer.id,
        incomingMessage: cleanMessage,
        operatorNotes: body.operatorNotes || ''
      });

      // 5. Store generated draft in conversation history
      CustomerStore.addMessage(customer.id, {
        sender: 'assistant',
        message_text: replyResult.draftText,
        channel: body.channel || 'mobile',
        status: 'draft'
      });

      // Check format request (plain text for direct iOS Clipboard or JSON)
      const format = urlObj.searchParams.get('format') || body.format || '';
      const acceptsText = (req.headers.accept || '').includes('text/plain');
      if (format === 'text' || acceptsText) {
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(replyResult.draftText);
      }

      return json(res, 200, {
        ok: true,
        reply: replyResult.draftText,
        customer: {
          id: customer.id,
          alias: customer.alias,
          phone_last4: customer.phone_last4,
          target_city: customer.target_city,
          target_beds: customer.target_beds,
          max_budget: customer.max_budget
        },
        detectedUpdates: replyResult.detectedUpdates,
        modelUsed: replyResult.modelUsed
      });
    }

    // 12. POST /api/assistant/generate-reply
    if (pathname === '/api/assistant/generate-reply' && method === 'POST') {
      const body = await readBody(req);
      const { customerId, incomingMessage, operatorNotes } = body;
      if (!customerId || !incomingMessage) {
        return json(res, 400, { ok: false, error: 'customerId and incomingMessage are required' });
      }
      const replyResult = await AIAssistant.generateReply({ customerId, incomingMessage, operatorNotes });
      return json(res, 200, { ok: true, ...replyResult });
    }

    // 12. GET /api/assistant/export
    if (pathname === '/api/assistant/export' && method === 'GET') {
      const exportData = CustomerStore.exportAll();
      return json(res, 200, { ok: true, export: exportData });
    }

    // 13. POST /api/assistant/import
    if (pathname === '/api/assistant/import' && method === 'POST') {
      const body = await readBody(req);
      const importResult = CustomerStore.importAll(body.backup || body);
      return json(res, 200, { ok: true, ...importResult });
    }

    // 14. GET /api/assistant/policies
    if (pathname === '/api/assistant/policies' && method === 'GET') {
      const policies = CustomerStore.getPolicies();
      return json(res, 200, { ok: true, policies });
    }

    // 14.1 GET /api/assistant/version (Live heartbeat & update indicator)
    if (pathname === '/api/assistant/version' && method === 'GET') {
      return json(res, 200, {
        ok: true,
        version: 'v2.6.0',
        buildTimestamp: new Date().toISOString(),
        environment: 'production',
        engine: 'Choice Properties AI Inquiry Assistant & Master Spec Engine',
        rules: {
          applicationFee: '$50',
          depositInText: 'Stripped (1x monthly rent in DB)',
          zeroRelocation: true,
          voucherFriendly: true,
          autoSyncShortcuts: true,
          modeBUserInitiatedEnrichment: true
        },
        supabaseConnected: true
      });
    }

    // 15. PUT /api/assistant/policies
    if (pathname === '/api/assistant/policies' && method === 'PUT') {
      const body = await readBody(req);
      const updated = CustomerStore.updatePolicies(body.policies || body);
      return json(res, 200, { ok: true, policies: updated });
    }

    // 16. GET /api/assistant/active-properties (for matching listings)
    if (pathname === '/api/assistant/active-properties' && method === 'GET') {
      const city = urlObj.searchParams.get('city') || '';
      let url = `${SUPABASE_URL}/rest/v1/properties?select=id,title,address,city,state,zip_code,price,bedrooms,bathrooms,property_type,status&limit=30`;
      if (city) {
        url += `&city=ilike.%${encodeURIComponent(city)}%`;
      }
      try {
        const pRes = await fetch(url, {
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`
          }
        });
        if (pRes.ok) {
          const properties = await pRes.json();
          return json(res, 200, { ok: true, properties });
        }
      } catch (err) {}
      return json(res, 200, { ok: true, properties: [] });
    }

    // 17. POST /api/assistant/rewrite-description (Mode B User-Initiated Factual Rewriter)
    if (pathname === '/api/assistant/rewrite-description' && method === 'POST') {
      const body = await readBody(req);
      const { propertyId, lengthStyle = 'standard', rawDescription, sourceFacts = {} } = body;
      
      let sourceDesc = rawDescription || '';
      let facts = sourceFacts;
      
      // If propertyId is provided, optionally read source facts from Supabase
      if (propertyId && (!sourceDesc || !Object.keys(facts).length)) {
        try {
          const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${encodeURIComponent(propertyId)}&select=original_description,description,source_facts_ledger,bedrooms,bathrooms,square_footage,parking,laundry_type,appliances,amenities,heating_type,cooling_type`, {
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'Accept': 'application/vnd.pgrst.object+json'
            }
          });
          if (fetchRes.ok) {
            const pData = await fetchRes.json();
            if (!sourceDesc) sourceDesc = pData.original_description || pData.description || '';
            if (!Object.keys(facts).length) facts = pData.source_facts_ledger || pData;
          }
        } catch (_) {}
      }

      if (!sourceDesc) {
        return json(res, 400, { ok: false, error: 'rawDescription or valid propertyId is required' });
      }

      const rewritten = rewriteDescriptionFactual(sourceDesc, facts, lengthStyle);
      const validation = validateDescriptionClaims(sourceDesc, rewritten, facts);

      // Save draft into pipeline_properties if propertyId given
      if (propertyId) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${encodeURIComponent(propertyId)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              ai_description_draft: rewritten,
              updated_at: new Date().toISOString()
            })
          });
        } catch (dbErr) {
          console.warn('[rewrite-description] Failed to update draft in DB:', dbErr);
        }
      }

      return json(res, 200, {
        ok: true,
        propertyId: propertyId || null,
        rewrittenDescription: rewritten,
        lengthStyle,
        validation
      });
    }

    // 18. POST /api/assistant/validate-description (Claim-Level Validation)
    if (pathname === '/api/assistant/validate-description' && method === 'POST') {
      const body = await readBody(req);
      const { originalDescription = '', rewrittenDescription = '', sourceFacts = {} } = body;
      if (!rewrittenDescription) {
        return json(res, 400, { ok: false, error: 'rewrittenDescription is required' });
      }
      const validation = validateDescriptionClaims(originalDescription, rewrittenDescription, sourceFacts);
      return json(res, 200, { ok: true, ...validation });
    }

    // 19. POST /api/assistant/approve-description (Human-Controlled Approval)
    if (pathname === '/api/assistant/approve-description' && method === 'POST') {
      const body = await readBody(req);
      const { propertyId, approvedDescription } = body;
      if (!propertyId || !approvedDescription) {
        return json(res, 400, { ok: false, error: 'propertyId and approvedDescription are required' });
      }

      try {
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${encodeURIComponent(propertyId)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            description: approvedDescription,
            approved_description: approvedDescription,
            operator_approved: true,
            updated_at: new Date().toISOString()
          })
        });
        if (!patchRes.ok) {
          const errText = await patchRes.text();
          return json(res, patchRes.status, { ok: false, error: errText });
        }
      } catch (dbErr) {
        return json(res, 500, { ok: false, error: dbErr.message });
      }

      return json(res, 200, { ok: true, propertyId, approved: true });
    }

    return json(res, 404, { ok: false, error: 'Endpoint not found' });
  } catch (err) {
    console.error('Assistant API error:', err);
    return json(res, 500, { ok: false, error: err.message });
  }
}

function sanitizeDescriptionForChoice(text) {
  if (!text) return '';
  let s = String(text);
  
  // Prohibited requirements & qualifications
  s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\b(?:requirements?\s*(?:&|and)\s*qualifications?|no\s*corporate\s*leases?|credit\s*score\s*must|minimum\s*credit\s*score|income\s*must\s*exceed|3\.0\s*times|no\s*evictions?|no\s*broken\s*leases?|no\s*criminal\s*history|application\s*pending|waiting\s*list|photos\s*are\s*stock|pictures\s*are\s*for\s*marketing)\b[^\n.!?]*[.!?]?/gi, ' ');
  
  // Prohibited scam/fraud warnings & platform disclaimers
  s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\b(?:beware\s*of\s*scams?|protect\s*yourself\s*from\s*fraud|we\s*do\s*not\s*post\s*on\s*(?:craigslist|facebook|marketplace|tiktok|offerup))\b[^\n.!?]*[.!?]?/gi, ' ');
  
  // Prohibited P2P / third-party payment platforms
  s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\b(?:cash\s*app|zelle|venmo|paypal|apple\s*pay|western\s*union|money\s*orders?|wire\s*transfers?)\b[^\n.!?]*[.!?]?/gi, ' ');
  
  // Security deposit mentions (strictly zero mentions in descriptions)
  s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\b(?:security\s*deposit|deposit\s*is|deposit\s*of|holding\s*deposit)\b[^\n.!?]*[.!?]?/gi, ' ');
  
  // Available / move-in dates & lease durations
  s = s.replace(/(?:(?<=[\n.!?])|\A)\s*[-*•]?[^\n.!?]*\b(?:available\s+(?:now|immediately|today|soon|for\s+rent|on\s+\w+|from\s+\w+)|move-?in\s+ready|ready\s+for\s+(?:immediate\s+)?move-?in|available\s+date|lease\s*terms?|minimum\s*lease)\b[^\n.!?]*[.!?]?/gi, ' ');
  
  // Broker phone numbers, personal emails, URLs
  s = s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '');
  s = s.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '');
  s = s.replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '');
  
  // Clean whitespace and punctuation
  s = s.replace(/,\s*\./g, '.').replace(/\band\s*\./gi, '.').replace(/[ \t]{2,}/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n');
  return s.trim();
}

function rewriteDescriptionFactual(originalText, facts, style) {
  let cleaned = sanitizeDescriptionForChoice(originalText);
  cleaned = cleaned.replace(/\s*Application Fee:?\s*\$?\d+.*$/i, '').trim();
  
  const standardFeeNote = 'Application Fee: $50. Submit your rental application today at Choice Properties.';
  
  if (style === 'concise') {
    const paras = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    const conciseBody = paras.slice(0, 1).join(' ').trim() || cleaned;
    return `${conciseBody}\n\n${standardFeeNote}`;
  }
  
  if (style === 'bulleted') {
    const paras = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    const intro = paras[0] || 'Welcome home to this well-maintained rental residence.';
    const bullets = [];
    if (facts.bedrooms && facts.bathrooms) bullets.push(`• ${facts.bedrooms} Bedrooms, ${facts.bathrooms} Bathrooms`);
    if (facts.square_footage) bullets.push(`• Approx. ${Number(facts.square_footage).toLocaleString()} sq. ft. of living space`);
    if (facts.parking) bullets.push(`• Parking: ${facts.parking}`);
    if (facts.laundry_type) bullets.push(`• Laundry: ${facts.laundry_type}`);
    if (facts.cooling_type) bullets.push(`• Cooling: ${facts.cooling_type}`);
    if (facts.heating_type) bullets.push(`• Heating: ${facts.heating_type}`);
    if (Array.isArray(facts.appliances) && facts.appliances.length) {
      bullets.push(`• Appliances: ${facts.appliances.join(', ')}`);
    }
    if (Array.isArray(facts.amenities) && facts.amenities.length) {
      bullets.push(`• Highlights: ${facts.amenities.join(', ')}`);
    }
    return `${intro}\n\nKey Highlights:\n${bullets.join('\n')}\n\n${standardFeeNote}`;
  }
  
  return `${cleaned}\n\n${standardFeeNote}`;
}

function validateDescriptionClaims(originalText, rewrittenText, facts) {
  const issues = [];
  const hallucinations = [];
  const lowerRewritten = (rewrittenText || '').toLowerCase();
  const lowerOriginal = (originalText || '').toLowerCase();
  
  const prohibitedChecks = [
    { pattern: /\b(?:requirements?\s*(?:&|and)\s*qualifications?|no\s*corporate\s*leases?|credit\s*score\s*must)\b/i, name: 'Qualifications clause' },
    { pattern: /\b(?:beware\s*of\s*scams?|we\s*do\s*not\s*post\s*on\s*craigslist)\b/i, name: 'Scam/Fraud warning' },
    { pattern: /\b(?:cash\s*app|zelle|venmo|paypal)\b/i, name: 'P2P Payment method' },
    { pattern: /\bsecurity\s*deposit\b/i, name: 'Security deposit in text' },
    { pattern: /\b(?:available\s+(?:now|immediately|today)|move-?in\s+ready)\b/i, name: 'Available / move-in date' },
  ];
  
  prohibitedChecks.forEach(chk => {
    if (chk.pattern.test(lowerRewritten)) {
      issues.push(chk.name);
    }
  });
  
  const feeCompliant = /\$50(?:\.00)?\s*(?:application\s*fee|fee)/i.test(lowerRewritten) || lowerRewritten.includes('application fee: $50');
  if (!feeCompliant) {
    issues.push('Missing or invalid $50 application fee note');
  }
  
  if (lowerRewritten.includes('fenced yard') || lowerRewritten.includes('private fenced yard')) {
    const rawAmen = (facts && facts.amenities) || [];
    if (!lowerOriginal.includes('fence') && !(Array.isArray(rawAmen) ? rawAmen : []).some(a => /fence/i.test(String(a)))) {
      hallucinations.push('Claims private fenced yard, but fence is not mentioned in source facts');
    }
  }
  
  if (/\b(?:washer\s*and\s*dryer\s*(?:included|provided)|washer\s*included)\b/i.test(lowerRewritten)) {
    const origHasHookups = /\bhookups?\b/i.test(lowerOriginal);
    const origHasIncluded = /\b(?:included|in-unit\s*washer)\b/i.test(lowerOriginal);
    if (origHasHookups && !origHasIncluded) {
      hallucinations.push('Claims washer and dryer are included, but source specifies hookups only');
    }
  }

  const score = Math.max(0, 100 - (issues.length * 25) - (hallucinations.length * 25));
  return {
    valid: issues.length === 0 && hallucinations.length === 0 && feeCompliant,
    score,
    prohibitedFound: issues,
    hallucinations,
    feeCompliant
  };
}

module.exports = { handleAssistantApi };
