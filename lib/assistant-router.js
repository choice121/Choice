/**
 * Choice Properties — Assistant Router
 * Handles all /api/assistant/* REST endpoints for the Inquiry Assistant & Customer Memory System.
 */

const CustomerStore = require('./customer-store');
const AIAssistant = require('./ai-assistant');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

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

    return json(res, 404, { ok: false, error: 'Endpoint not found' });
  } catch (err) {
    console.error('Assistant API error:', err);
    return json(res, 500, { ok: false, error: err.message });
  }
}

module.exports = { handleAssistantApi };
