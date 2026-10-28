/**
 * Choice Properties — Customer Memory Store
 * Multi-layer persistent storage for customer profiles, conversation history,
 * private operator notes, and business policies.
 * 
 * Supports:
 * - Local file storage in data/customer-memory/customers.json
 * - Remote Supabase sync via service-role key
 * - Export and Import JSON backups
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(process.cwd(), 'data', 'customer-memory');
const DATA_FILE = path.join(DATA_DIR, 'customers.json');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache backed by file and remote sync
let state = {
  customers: {}, // id -> profile
  conversations: {}, // customerId -> [ { id, sender, message_text, channel, status, created_at } ]
  notes: {}, // customerId -> [ { id, note_text, author, created_at } ]
  lastSync: 0
};

// Default centralized policies
const DEFAULT_POLICIES = {
  application_fee: 50,
  review_window_hours: '24–72 hours',
  reapplication_days: 30,
  reapplication_count: 2,
  security_deposit_rule: 'Equal to 1x monthly rent in DB; never quote in initial descriptions',
  pet_policy: 'Pet friendly (dogs and cats welcome)',
  viewing_policy: 'Application reviewed prior to private tour scheduling',
  holding_policy: 'Applicable holding fees credit toward first month rent upon approved application'
};

function loadLocal() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state.customers = parsed.customers || {};
      state.conversations = parsed.conversations || {};
      state.notes = parsed.notes || {};
    }
  } catch (err) {
    console.error('Error reading local customer memory:', err.message);
  }

  try {
    if (!fs.existsSync(POLICIES_FILE)) {
      fs.writeFileSync(POLICIES_FILE, JSON.stringify(DEFAULT_POLICIES, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error initializing policies file:', err.message);
  }
}

function saveLocal() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = {
      customers: state.customers,
      conversations: state.conversations,
      notes: state.notes,
      saved_at: new Date().toISOString()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving local customer memory:', err.message);
  }
}

// Remote Supabase sync helper (runs in background)
async function syncToSupabaseBackup() {
  try {
    const payload = JSON.stringify({
      customers: state.customers,
      conversations: state.conversations,
      notes: state.notes,
      updated_at: new Date().toISOString()
    });

    // Store in draft_applications as a resilient cloud backup snapshot
    await fetch(`${SUPABASE_URL}/rest/v1/draft_applications`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        token: 'custmem:backup_snapshot',
        email: 'system:customer-memory',
        data: { payload },
        property_fingerprint: 'customer-memory-store'
      })
    });
  } catch (err) {
    // Non-fatal background sync
  }
}

async function loadFromSupabaseBackup() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/draft_applications?token=eq.custmem:backup_snapshot&select=data`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows[0] && rows[0].data && rows[0].data.payload) {
        const remote = JSON.parse(rows[0].data.payload);
        if (remote && remote.customers && Object.keys(remote.customers).length > 0) {
          // Merge remote if local is empty
          if (Object.keys(state.customers).length === 0) {
            state.customers = remote.customers;
            state.conversations = remote.conversations || {};
            state.notes = remote.notes || {};
            saveLocal();
          }
        }
      }
    }
  } catch (err) {
    // Ignore remote sync errors during startup
  }
}

// Initial bootstrap
loadLocal();
loadFromSupabaseBackup();

const CustomerStore = {
  /**
   * List all customers with optional search and filters
   */
  listCustomers({ search = '', phone_last4 = '', alias = '' } = {}) {
    let list = Object.values(state.customers);

    if (phone_last4) {
      list = list.filter(c => c.phone_last4 === String(phone_last4).trim());
    }

    if (alias) {
      const q = String(alias).trim().toLowerCase();
      list = list.filter(c => (c.alias || '').toLowerCase().includes(q));
    }

    if (search) {
      const q = String(search).trim().toLowerCase();
      list = list.filter(c => {
        const last4 = (c.phone_last4 || '').toLowerCase();
        const a = (c.alias || '').toLowerCase();
        const fn = (c.full_name || '').toLowerCase();
        const city = (c.target_city || '').toLowerCase();
        const notes = (c.additional_notes || '').toLowerCase();
        return last4.includes(q) || a.includes(q) || fn.includes(q) || city.includes(q) || notes.includes(q);
      });
    }

    // Sort by last activity descending
    list.sort((a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0));
    return list;
  },

  /**
   * Find customers sharing the exact 4-digit phone suffix
   */
  findCollisions(phone_last4) {
    if (!phone_last4) return [];
    const normalized = String(phone_last4).trim();
    return Object.values(state.customers).filter(c => c.phone_last4 === normalized);
  },

  /**
   * Get single customer with full conversations and internal notes
   */
  getCustomer(id) {
    if (!id || !state.customers[id]) return null;
    const profile = state.customers[id];
    const messages = state.conversations[id] || [];
    const notes = state.notes[id] || [];
    return {
      ...profile,
      messages: [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      notes: [...notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    };
  },

  /**
   * Resolve an existing customer or auto-create one seamlessly from incoming text
   * Extracts phone suffix or alias if prefixed (e.g. "8376: Hello" or "Sarah - Hi"),
   * detects identity, links to memory, and applies any preference updates.
   */
  resolveOrAutoCreate({ identifier = '', phone = '', alias = '', messageText = '' } = {}) {
    let cleanMessage = String(messageText || '').trim();
    let detectedId = identifier || '';
    let detectedPhoneLast4 = '';
    let detectedAlias = alias || '';

    // If identifier was not passed explicitly, check if message has a prefix
    // e.g. "8376: message", "8376 - message", "Sarah: message", "(214) 555-8376: message"
    const prefixMatch = cleanMessage.match(/^([A-Za-z0-9()+\-\s]{2,20})[:–—\-]\s*(.*)$/s);
    if (prefixMatch && !detectedId) {
      const potentialPrefix = prefixMatch[1].trim();
      if (/^\d{4}$/.test(potentialPrefix)) {
        detectedPhoneLast4 = potentialPrefix;
        detectedId = potentialPrefix;
        cleanMessage = prefixMatch[2].trim();
      } else if (/\d{4}$/.test(potentialPrefix)) {
        const digits = potentialPrefix.replace(/\D/g, '');
        if (digits.length >= 4) {
          detectedPhoneLast4 = digits.slice(-4);
          detectedId = detectedPhoneLast4;
          cleanMessage = prefixMatch[2].trim();
        }
      } else if (/^[A-Za-z\s]{2,15}$/.test(potentialPrefix) && !/^(re|fwd|fw|note)$/i.test(potentialPrefix)) {
        detectedAlias = potentialPrefix;
        detectedId = potentialPrefix;
        cleanMessage = prefixMatch[2].trim();
      }
    }

    if (!detectedPhoneLast4 && phone) {
      const digits = String(phone).replace(/\D/g, '');
      if (digits.length >= 4) detectedPhoneLast4 = digits.slice(-4);
    }

    // Try finding customer
    let customer = null;
    if (detectedId) {
      const found = this.findByIdentifier(detectedId);
      if (found && !found.collision) {
        customer = found;
      } else if (found && found.collision) {
        customer = found.matches[0];
      }
    } else if (detectedPhoneLast4) {
      const found = this.findByIdentifier(detectedPhoneLast4);
      if (found && !found.collision) customer = found;
      else if (found && found.collision) customer = found.matches[0];
    } else if (detectedAlias) {
      const found = this.findByIdentifier(detectedAlias);
      if (found) customer = found;
    }

    // If still not found, check if there's an ongoing thread or auto-create new
    if (!customer) {
      const newAlias = detectedAlias || (detectedPhoneLast4 ? `Client ${detectedPhoneLast4}` : 'New Renter');
      customer = this.createCustomer({
        phone_last4: detectedPhoneLast4 || null,
        alias: newAlias,
        contact_info: phone || null
      });
    }

    return {
      customer: this.getCustomer(customer.id),
      cleanMessage: cleanMessage || messageText
    };
  },

  /**
   * Find customer by 4-digit identifier or alias
   */
  findByIdentifier(identifier) {
    if (!identifier) return null;
    const raw = String(identifier).trim();
    const isDigits = /^\d{4}$/.test(raw);

    if (isDigits) {
      const matches = Object.values(state.customers).filter(c => c.phone_last4 === raw);
      if (matches.length === 1) return this.getCustomer(matches[0].id);
      if (matches.length > 1) {
        return {
          collision: true,
          phone_last4: raw,
          matches: matches.map(m => this.getCustomer(m.id))
        };
      }
    }

    // Try finding by alias or full name
    const lower = raw.toLowerCase();
    const aliasMatches = Object.values(state.customers).filter(c => 
      (c.alias || '').toLowerCase() === lower || (c.full_name || '').toLowerCase() === lower
    );

    if (aliasMatches.length > 0) {
      return this.getCustomer(aliasMatches[0].id);
    }

    return null;
  },

  /**
   * Create new customer profile
   */
  createCustomer(data = {}) {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const newCustomer = {
      id,
      phone_last4: data.phone_last4 ? String(data.phone_last4).trim() : null,
      alias: data.alias ? String(data.alias).trim() : null,
      full_name: data.full_name ? String(data.full_name).trim() : null,
      contact_info: data.contact_info || null,
      
      // Rental Preferences
      target_city: data.target_city || null,
      target_neighborhoods: data.target_neighborhoods || null,
      target_beds: data.target_beds != null ? Number(data.target_beds) : null,
      target_baths: data.target_baths != null ? Number(data.target_baths) : null,
      max_budget: data.max_budget != null ? Number(data.max_budget) : null,
      property_type: data.property_type || 'single_family',
      move_in_date: data.move_in_date || null,
      has_pets: Boolean(data.has_pets),
      pet_details: data.pet_details || null,
      requested_features: Array.isArray(data.requested_features) ? data.requested_features : [],

      // Application & Rental Context
      interested_property_ids: Array.isArray(data.interested_property_ids) ? data.interested_property_ids : [],
      recommended_property_ids: Array.isArray(data.recommended_property_ids) ? data.recommended_property_ids : [],
      application_status: data.application_status || 'not_started',
      application_fee_status: data.application_fee_status || 'not_confirmed',
      payment_status: data.payment_status || 'not_confirmed',
      viewing_status: data.viewing_status || 'not_scheduled',
      holding_status: data.holding_status || 'none',
      outstanding_questions: data.outstanding_questions || null,
      next_action: data.next_action || null,

      // Rental History & Qualification Context
      credit_concerns: data.credit_concerns || null,
      eviction_history: data.eviction_history || null,
      income_notes: data.income_notes || null,
      additional_notes: data.additional_notes || null,

      created_at: now,
      updated_at: now,
      last_activity_at: now
    };

    state.customers[id] = newCustomer;
    state.conversations[id] = [];
    state.notes[id] = [];

    saveLocal();
    syncToSupabaseBackup();

    return this.getCustomer(id);
  },

  /**
   * Update existing customer profile
   */
  updateCustomer(id, data = {}) {
    if (!id || !state.customers[id]) return null;
    const existing = state.customers[id];
    const now = new Date().toISOString();

    const updated = {
      ...existing,
      ...data,
      id: existing.id, // prevent changing primary ID
      created_at: existing.created_at,
      updated_at: now,
      last_activity_at: now
    };

    // Ensure numeric fields stay numeric
    if (data.target_beds !== undefined) updated.target_beds = data.target_beds !== null ? Number(data.target_beds) : null;
    if (data.target_baths !== undefined) updated.target_baths = data.target_baths !== null ? Number(data.target_baths) : null;
    if (data.max_budget !== undefined) updated.max_budget = data.max_budget !== null ? Number(data.max_budget) : null;

    state.customers[id] = updated;
    saveLocal();
    syncToSupabaseBackup();

    return this.getCustomer(id);
  },

  /**
   * Link two customer records (e.g., when an alias record is confirmed to belong to a 4-digit ID)
   */
  linkCustomers(primaryId, secondaryId) {
    if (!state.customers[primaryId] || !state.customers[secondaryId]) return null;
    const primary = state.customers[primaryId];
    const secondary = state.customers[secondaryId];

    // Merge non-null fields from secondary to primary
    primary.alias = primary.alias || secondary.alias;
    primary.full_name = primary.full_name || secondary.full_name;
    primary.phone_last4 = primary.phone_last4 || secondary.phone_last4;
    primary.target_city = primary.target_city || secondary.target_city;
    primary.target_beds = primary.target_beds ?? secondary.target_beds;
    primary.target_baths = primary.target_baths ?? secondary.target_baths;
    primary.max_budget = primary.max_budget ?? secondary.max_budget;
    primary.credit_concerns = primary.credit_concerns || secondary.credit_concerns;
    primary.eviction_history = primary.eviction_history || secondary.eviction_history;

    // Merge conversations
    const secondaryMsgs = state.conversations[secondaryId] || [];
    state.conversations[primaryId] = [...(state.conversations[primaryId] || []), ...secondaryMsgs];

    // Merge notes
    const secondaryNotes = state.notes[secondaryId] || [];
    state.notes[primaryId] = [...(state.notes[primaryId] || []), ...secondaryNotes];

    // Delete secondary
    delete state.customers[secondaryId];
    delete state.conversations[secondaryId];
    delete state.notes[secondaryId];

    saveLocal();
    syncToSupabaseBackup();

    return this.getCustomer(primaryId);
  },

  /**
   * Add a message to the customer's conversation history
   */
  addMessage(customerId, { sender, message_text, channel = 'sms', status = 'sent', metadata = {} }) {
    if (!customerId || !state.customers[customerId]) return null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const msg = {
      id,
      customer_id: customerId,
      sender: sender || 'customer', // 'customer' | 'assistant' | 'staff'
      message_text: String(message_text || '').trim(),
      channel,
      status: status || 'sent', // 'received' | 'draft' | 'sent'
      metadata: metadata || {},
      created_at: now
    };

    if (!state.conversations[customerId]) {
      state.conversations[customerId] = [];
    }

    state.conversations[customerId].push(msg);

    // Update customer last_activity_at
    state.customers[customerId].last_activity_at = now;
    state.customers[customerId].updated_at = now;

    saveLocal();
    syncToSupabaseBackup();

    return msg;
  },

  /**
   * Update message status (e.g. approve draft -> mark as sent)
   */
  updateMessage(customerId, messageId, updates = {}) {
    if (!customerId || !state.conversations[customerId]) return null;
    const msg = state.conversations[customerId].find(m => m.id === messageId);
    if (!msg) return null;

    if (updates.status) msg.status = updates.status;
    if (updates.message_text) msg.message_text = String(updates.message_text).trim();
    if (updates.metadata) msg.metadata = { ...msg.metadata, ...updates.metadata };

    state.customers[customerId].last_activity_at = new Date().toISOString();

    saveLocal();
    syncToSupabaseBackup();

    return msg;
  },

  /**
   * Add private internal staff note
   */
  addNote(customerId, { note_text, author = 'Staff' }) {
    if (!customerId || !state.customers[customerId]) return null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const note = {
      id,
      customer_id: customerId,
      note_text: String(note_text || '').trim(),
      author: author || 'Staff',
      created_at: now
    };

    if (!state.notes[customerId]) {
      state.notes[customerId] = [];
    }

    state.notes[customerId].push(note);
    state.customers[customerId].last_activity_at = now;

    saveLocal();
    syncToSupabaseBackup();

    return note;
  },

  /**
   * Delete internal note
   */
  deleteNote(customerId, noteId) {
    if (!customerId || !state.notes[customerId]) return false;
    const lenBefore = state.notes[customerId].length;
    state.notes[customerId] = state.notes[customerId].filter(n => n.id !== noteId);
    const removed = state.notes[customerId].length < lenBefore;
    if (removed) {
      saveLocal();
      syncToSupabaseBackup();
    }
    return removed;
  },

  /**
   * Export all customer records for backup
   */
  exportAll() {
    return {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      platform: 'Choice Properties Inquiry Memory System',
      data: {
        customers: state.customers,
        conversations: state.conversations,
        notes: state.notes
      }
    };
  },

  /**
   * Import customer records from JSON backup
   */
  importAll(backup) {
    if (!backup || !backup.data || !backup.data.customers) {
      throw new Error('Invalid backup file format: missing data.customers');
    }

    if (backup.replace === true || backup.mode === 'replace' || Object.keys(backup.data.customers).length === 0) {
      state.customers = { ...backup.data.customers };
      state.conversations = { ...(backup.data.conversations || {}) };
      state.notes = { ...(backup.data.notes || {}) };
    } else {
      state.customers = { ...state.customers, ...backup.data.customers };
      state.conversations = { ...state.conversations, ...(backup.data.conversations || {}) };
      state.notes = { ...state.notes, ...(backup.data.notes || {}) };
    }

    saveLocal();
    syncToSupabaseBackup();

    return {
      success: true,
      customers_count: Object.keys(state.customers).length
    };
  },

  /**
   * Read centralized business policies
   */
  getPolicies() {
    try {
      if (fs.existsSync(POLICIES_FILE)) {
        return JSON.parse(fs.readFileSync(POLICIES_FILE, 'utf8'));
      }
    } catch (e) {}
    return DEFAULT_POLICIES;
  },

  /**
   * Update centralized business policies
   */
  updatePolicies(newPolicies = {}) {
    const current = this.getPolicies();
    const merged = { ...current, ...newPolicies };
    try {
      fs.writeFileSync(POLICIES_FILE, JSON.stringify(merged, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving policies:', e.message);
    }
    return merged;
  }
};

module.exports = CustomerStore;
