/**
 * Choice Properties — AI Rental Inquiry Assistant Engine
 * 
 * Generates context-aware, copy-ready customer responses based on:
 * - Dynamic knowledge-base documents from /docs/customer-support-ai/
 * - Customer profile memory and past conversation history
 * - Confirmed application status and private operator notes
 * - Strict Choice Properties policies ($50 fee, no deposit quotes, 24-72h review,
 *   30-day 2-reapplication policy, holistic credit/eviction handling, zero internal IDs).
 */

const fs = require('fs');
const path = require('path');
const CustomerStore = require('./customer-store');

let GoogleGenAI = null;
try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI;
} catch (e) {
  // Graceful fallback if package is loading
}

const DOCS_DIR = path.join(process.cwd(), 'docs', 'customer-support-ai');

/**
 * Load knowledge base documents from docs/customer-support-ai
 */
function loadKnowledgeBase() {
  const kb = {};
  const docFiles = [
    'company-profile.md',
    'business-policies.md',
    'response-style.md',
    'application-process.md',
    'qualification-guidelines.md',
    'customer-memory.md'
  ];

  for (const file of docFiles) {
    const fullPath = path.join(DOCS_DIR, file);
    if (fs.existsSync(fullPath)) {
      kb[file] = fs.readFileSync(fullPath, 'utf8');
    }
  }
  return kb;
}

/**
 * Extract potential preference updates from a message
 * e.g., "my budget is actually 1500 to 1800", "need 3 bedrooms now", "move in Dec 1", "have a section 8 voucher"
 */
function extractPreferenceUpdates(message) {
  if (!message || typeof message !== 'string') return {};
  const rawText = message.toLowerCase();
  const text = rawText.replace(/(\d+),(\d+)/g, '$1$2');
  const updates = {};

  // Budget detection: e.g. "budget is $1,600", "under 1800", "1500 - 1800", "1.8k", "2k"
  const kBudgetMatch = text.match(/(?:budget|pay|afford|max|up to|around|under)?\s*\$?([1-9](?:\.\d)?)\s*k\b/i);
  if (kBudgetMatch) {
    const valK = Math.round(parseFloat(kBudgetMatch[1]) * 1000);
    if (valK >= 500 && valK <= 15000) {
      updates.max_budget = valK;
    }
  } else {
    const budgetMatch = text.match(/(?:budget|pay|afford|max|up to|around|under)?\s*\$?([1-9]\d{2,3})(?:\s*[-–to]+\s*\$?([1-9]\d{2,3}))?\s*(?:monthly|\/mo|a month)?/i);
    if (budgetMatch) {
      const val1 = parseInt(budgetMatch[1], 10);
      const val2 = budgetMatch[2] ? parseInt(budgetMatch[2], 10) : null;
      if (val1 >= 500 && val1 <= 15000) {
        updates.max_budget = val2 ? Math.max(val1, val2) : val1;
      }
    }
  }

  // Bedroom detection: e.g. "3 bed", "3 bedroom", "3br", "need 4 beds"
  const bedMatch = text.match(/\b([1-6])\s*(?:bed|bedroom|br|beds)\b/i);
  if (bedMatch) {
    updates.target_beds = parseInt(bedMatch[1], 10);
  }

  // Bathroom detection: e.g. "2 bath", "2.5 baths", "1.5 bathroom"
  const bathMatch = text.match(/\b([1-4](?:\.[50])?)\s*(?:bath|bathroom|ba|baths)\b/i);
  if (bathMatch) {
    updates.target_baths = parseFloat(bathMatch[1]);
  }

  // City detection: comprehensive multi-market list
  const cities = [
    'Oklahoma City', 'Yukon', 'Mustang', 'Tulsa', 'Broken Arrow', 'Edmond', 'Norman',
    'Charlotte', 'Matthews', 'Monroe', 'Huntersville', 'Concord', 'Gastonia',
    'Dallas', 'Fort Worth', 'Arlington', 'Plano', 'Frisco', 'Irving', 'Garland', 'McKinney',
    'Atlanta', 'Marietta', 'Decatur', 'Tampa', 'Orlando', 'Phoenix', 'Scottsdale', 'Denver',
    'Columbus', 'Albuquerque', 'Kansas City', 'St. Louis', 'Austin', 'San Antonio', 'Houston'
  ];
  for (const c of cities) {
    if (text.includes(c.toLowerCase())) {
      updates.target_city = c;
      break;
    }
  }

  // Pet detection
  if (text.includes('dog') || text.includes('cat') || text.includes('pet') || text.includes('puppy') || text.includes('esa')) {
    updates.has_pets = true;
    if (text.includes('dog')) updates.pet_details = 'Dog';
    if (text.includes('cat')) updates.pet_details = 'Cat';
    if (text.includes('esa')) updates.pet_details = 'ESA';
  }

  // Voucher / Section 8 detection
  if (text.includes('voucher') || text.includes('section 8') || text.includes('housing choice')) {
    updates.is_voucher_holder = true;
  }

  // Co-signer detection
  if (text.includes('cosign') || text.includes('co-sign') || text.includes('guarantor')) {
    updates.has_cosigner = true;
  }

  // Property Owner / Landlord inquiry detection
  if (text.includes('list my') || text.includes('i own') || text.includes('landlord') || text.includes('manage my')) {
    updates.is_property_owner = true;
  }

  // Move-in timeframe
  const moveInMatch = text.match(/(?:move in|moving|need by|ready by)\s+(?:in\s+)?([a-z]+(?:\s+\d{1,2})?|\d{1,2}\/\d{1,2}|asap|immediately|next month|next week)/i);
  if (moveInMatch) {
    updates.move_in_date = moveInMatch[1].trim();
  }

  // Credit / Eviction disclosure detection
  if (text.includes('credit') && (text.includes('bad') || text.includes('low') || text.includes('rough') || text.includes('score') || text.includes('poor') || text.includes('5') || text.includes('6'))) {
    updates.credit_concerns = message.trim();
  }
  if (text.includes('eviction') || text.includes('evicted') || text.includes('broken lease') || text.includes('judgment')) {
    updates.eviction_history = message.trim();
  }

  return updates;
}

/**
 * Intelligent Rule-Based Policy Engine (Guarantees 100% Policy Compliance)
 */
function generateDomainFallbackResponse({ customer, incomingMessage, policies, activeProperties = [] }) {
  const msgLower = (incomingMessage || '').toLowerCase();
  const name = customer.alias || customer.full_name || '';
  const greeting = name ? `Hi ${name},` : 'Hello!';

  // Check if this is an ongoing thread (has previous messages)
  const isOngoing = Array.isArray(customer.messages) && customer.messages.length > 0;
  const opener = isOngoing ? '' : `${greeting}\n\n`;

  // 1. Credit / Eviction / Qualification Inquiry
  if (msgLower.includes('credit') || msgLower.includes('eviction') || msgLower.includes('evicted') || msgLower.includes('broken lease') || msgLower.includes('bankruptcy') || msgLower.includes('score') || msgLower.includes('qualify') || msgLower.includes('disqualif') || msgLower.includes('prevent me')) {
    let response = `${opener}We work with applicants who have different credit and rental backgrounds, and we review applications based on the applicable property requirements and the overall information provided.

Once you submit your application with complete, accurate, and truthful information, our team will review how it fits the property's requirements. If additional information, documentation, or clarification is needed during the review, we will reach out directly to guide you through what is needed.

There is no additional fee for our assistance with the application process. Your main responsibility is providing accurate and complete information, and we'll assist you throughout the review process and keep you updated.`;

    if (customer.application_status === 'not_started' || !customer.application_status) {
      response += `\n\nWhen you are ready, you can submit your rental application online at Choice Properties.`;
    }
    return response.trim();
  }

  // 2. 30-Day Reapplication / What happens if denied
  if (msgLower.includes('denied') || msgLower.includes('if i don\'t get approved') || msgLower.includes('reapply') || msgLower.includes('second chance') || msgLower.includes('another house')) {
    return `${opener}If an initial paid application is not approved for a specific property, our policy allows the same screened adults to apply for up to two additional properties within 30 days without paying another application fee. A newly screened adult is subject to the standard fee. Contact our team before payment so we can verify eligibility and apply the courtesy.

Our team will help you review available options in the area that best align with your qualifications and move-in timeframe.`.trim();
  }

  // 3. Application Fee Inquiry
  if (msgLower.includes('fee') || msgLower.includes('cost to apply') || msgLower.includes('application fee') || msgLower.includes('how much is it to apply')) {
    const fee = policies.application_fee || 50;
    return `${opener}The application fee is $${fee} per adult being screened, and the total is shown before submission. If your initial paid application was not approved, the same screened adults may qualify to apply for up to two additional properties within 30 days without another fee. Newly screened adults are subject to the standard fee. Contact our team before paying so we can verify eligibility.

Once submitted, our team typically reviews completed applications within 24 to 72 hours.`.trim();
  }

  // 4. Security Deposit Inquiry
  if (msgLower.includes('deposit') || msgLower.includes('security deposit') || msgLower.includes('move-in cost')) {
    return `${opener}Upon application approval, the standard security deposit is equal to one month's rent. Any applicable holding deposit placed to reserve the home is credited directly toward your first month's rent.`.trim();
  }

  // 5. Viewing / Tour Request
  if (msgLower.includes('tour') || msgLower.includes('view') || msgLower.includes('see the house') || msgLower.includes('look inside') || msgLower.includes('showing')) {
    return `${opener}In accordance with our property management guidelines, applications are submitted and reviewed prior to scheduling private walkthroughs.

Once your application is reviewed and approved, our leasing coordinator will reach out directly to schedule a convenient viewing time with you.`.trim();
  }

  // 6. Application Status / Under Review Inquiry
  if (msgLower.includes('status') || msgLower.includes('update on my application') || msgLower.includes('did you get my') || msgLower.includes('hear back') || msgLower.includes('any news')) {
    const status = customer.application_status || 'not_confirmed';
    if (status === 'in_review') {
      return `${opener}Your application is currently with our underwriting team for review. Standard application reviews typically take between 24 and 72 hours. We will notify you immediately once the review is complete or if any additional verification is needed.`.trim();
    }
    if (status === 'submitted') {
      return `${opener}We have received your application submission and it is queued for review. Our standard review timeframe is 24 to 72 hours. We'll keep you updated as soon as the team begins processing your file.`.trim();
    }
    if (status === 'fee_pending') {
      return `${opener}We see that your application file has been initiated, and we are currently awaiting the application fee shown in your application, calculated at $50 per adult being screened. Once received, review typically takes 24 to 72 hours.`.trim();
    }
    if (status === 'approved') {
      return `${opener}Congratulations! Your application has been approved. Our team is preparing your reservation and viewing details, and we will be in touch shortly with the next steps.`.trim();
    }
    return `${opener}We are currently checking the status of your application. Reviews typically take 24 to 72 hours once all information and the fee shown in your application are received. We will update you directly as soon as our coordinator confirms the record.`.trim();
  }

  // 7. Housing Choice Voucher / Section 8 Inquiry
  if (msgLower.includes('voucher') || msgLower.includes('section 8') || msgLower.includes('housing choice') || msgLower.includes('pha')) {
    let response = `${opener}We welcome Housing Choice Vouchers and Section 8 participants! Voucher acceptance is coordinated directly with participating property owners and the local housing authority based on the property's rent limits and payment standards.`;
    if (!customer.target_city || !customer.target_beds) {
      response += ` Could you share your voucher bedroom count and the target city or county you are looking in so we can check available participating options?`;
    } else {
      response += ` We will review our active participating options in ${customer.target_city} matching your ${customer.target_beds || ''}-bedroom voucher.`;
    }
    return response.trim();
  }

  // 8. Co-Signer / Guarantor Inquiry
  if (msgLower.includes('cosign') || msgLower.includes('co-sign') || msgLower.includes('guarantor')) {
    return `${opener}Yes, co-signers and guarantors are welcome to apply alongside you to help strengthen your application!

Your co-signer or guarantor is charged $50 when they are individually screened. The application form shows the total before submission.`.trim();
  }

  // 9. Property Owner / Landlord / Business Partnership Inquiry
  if (msgLower.includes('list my') || msgLower.includes('i own') || msgLower.includes('landlord') || msgLower.includes('marketing partnership') || msgLower.includes('manage my') || msgLower.includes('partner with')) {
    return `${opener}Choice Properties partners directly with independent owners, landlords, and property management firms across our markets to market residential rentals, conduct applicant intake, and assist with placements.

Could you share the location (city/state) and target rent of your property? We'll have our property onboarding team connect with you with partnership details.`.trim();
  }

  // 10. Company Background / Legitimacy ("Who is Choice Properties?")
  if (msgLower.includes('who are you') || msgLower.includes('what is choice properties') || msgLower.includes('legit') || msgLower.includes('scam') || msgLower.includes('are you a real') || msgLower.includes('about your company')) {
    return `${opener}Choice Properties is a residential rental marketplace and housing placement coordinator. We work alongside property owners, investors, and management companies across multiple markets to help renters find verified homes and streamline the application process.

Applications are processed securely with a fee of $50 per adult being screened; the total is shown before submission. Fees are subject to applicable law. Let us know how we can assist with your housing search!`.trim();
  }

  // 11. Follow-up Check-in Trigger
  if (msgLower.includes('follow up') || msgLower.includes('check in') || msgLower.includes('touch base') || msgLower.includes('any update')) {
    if (customer.target_city) {
      return `${opener}Just touching base to see if you had any questions on the rental process or if you're still looking for a home in ${customer.target_city}. Let us know how we can help!`.trim();
    }
    return `${opener}Just checking in to see how your housing search is going and if you had any questions on our application process. Feel free to reach out anytime!`.trim();
  }

  // 12. Short Greeting / General Chit-Chat (e.g. "hi", "hello", "hey")
  if (/^(?:hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening)[\s!.]*$/i.test(msgLower.trim())) {
    return `${opener}Hello! How can we help you today with your housing search or rental questions?`.trim();
  }

  // 13. Unavailable Property / Social Media Link Pivot
  if (msgLower.includes('tiktok') || msgLower.includes('screenshot') || msgLower.includes('link') || msgLower.includes('is this available') || msgLower.includes('is it still available') || msgLower.includes('still for rent')) {
    let response = `${opener}Thank you for checking in. That specific property has already been reserved and is no longer available.`;

    if (customer.target_city && customer.target_beds) {
      response += ` We do have other verified rental homes in ${customer.target_city} matching your ${customer.target_beds}-bedroom preference. We would be happy to share available options with you.`;
    } else if (customer.target_city) {
      response += ` We have several active homes in ${customer.target_city}. Could you share how many bedrooms you are looking for so we can send the best matches?`;
    } else {
      response += ` We'd love to help you find an available home. Could you let us know which city or area you are looking in, as well as your ideal bedroom count and move-in date?`;
    }
    return response.trim();
  }

  // 8. General / Missing Information Discovery
  const missing = [];
  if (!customer.target_city) missing.push('preferred city or area');
  if (!customer.target_beds) missing.push('number of bedrooms needed');
  if (!customer.max_budget) missing.push('approximate monthly budget');
  if (!customer.move_in_date) missing.push('target move-in timeframe');

  if (missing.length === 0) {
    // All preferences are known!
    let response = `${opener}Thank you for the update. We have noted your preferences for a ${customer.target_beds || ''}-bedroom home in ${customer.target_city || 'the area'} with a budget of up to $${customer.max_budget ? customer.max_budget.toLocaleString() : '1,800'}/month.`;
    if (customer.credit_concerns || customer.eviction_history) {
      response += ` As mentioned, our team reviews applications holistically based on the complete file.`;
    }
    response += ` We are preparing currently available options for your review and will follow up shortly.`;
    return response.trim();
  }

  // Ask strictly for the missing pieces
  const missingText = missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
  return `${opener}Thank you for reaching out to Choice Properties! To help us find available homes that match what you're looking for, could you share your ${missingText}?`.trim();
}

const AIAssistant = {
  extractPreferenceUpdates,

  /**
   * Main entry point to generate a customer-ready response
   */
  async generateReply({ customerId, incomingMessage, operatorNotes = '' }) {
    if (!customerId) {
      throw new Error('customerId is required');
    }

    const customer = CustomerStore.getCustomer(customerId);
    if (!customer) {
      throw new Error(`Customer not found for id: ${customerId}`);
    }

    const policies = CustomerStore.getPolicies();
    const knowledgeBase = loadKnowledgeBase();
    const preferenceUpdates = extractPreferenceUpdates(incomingMessage);

    // Build context summary
    const conversationHistory = (customer.messages || []).slice(-8).map(m => {
      const senderLabel = m.sender === 'customer' ? 'Customer' : 'Choice Properties (Us)';
      return `${senderLabel} [${m.created_at ? m.created_at.slice(0, 10) : ''}]: ${m.message_text}`;
    }).join('\n');

    const internalNotes = (customer.notes || []).map(n => `- ${n.note_text}`).join('\n');

    // System prompt synthesizing rules, knowledge base, and profile
    const systemInstruction = `You are the Choice Properties AI Rental Inquiry Assistant.
Your job is to draft a customer-ready response for a Choice Properties operator to review, copy, and send.

CHOICE PROPERTIES CORE RULES & INVARIANTS:
1. APPLICATION FEE: $${policies.application_fee || 50} per adult being screened. State the total before submission. A qualifying 30-day reapplication courtesy may waive fees for up to two additional properties; management verifies and applies it before payment.
2. SECURITY DEPOSIT: Exactly 1x monthly rent in DB. NEVER quote deposit amounts, clauses, or numbers in initial inquiry drafts unless customer explicitly asked for deposit terms.
3. APPLICATION REVIEW WINDOW: 24–72 hours estimate. Never promise guaranteed decision timing.
4. REAPPLICATION POLICY: If denied after an initial paid application, applicant may apply for up to 2 additional properties within 30 days without another fee for the same screened adults. Management verifies and applies the waiver before payment; newly screened adults are subject to the standard fee.
5. VIEWING POLICY: Applications are reviewed prior to scheduling private in-person showings.
6. PETS: Broadly pet friendly (dogs and cats welcome).
7. QUALIFICATION INQUIRIES (CREDIT / EVICTIONS): Confident, natural, respectful reassurance. Explain applications are reviewed holistically based on overall information and property requirements. NEVER guarantee approval, but NEVER discourage or frighten the renter.
8. FORMATTING & STYLE:
   - Write clean, conversational, copy-ready plain text.
   - Do NOT use markdown headings (#) or aggressive bolding (**).
   - Use "we" rather than "I".
   - NEVER include the customer's 4-digit internal identifier (${customer.phone_last4 || 'none'}) or database IDs in the message.
   - NEVER expose private internal staff notes to the customer.
   - Ask only for missing information. Do NOT ask for information already recorded in the profile.
   - Do not add repetitive greetings if this is an ongoing text exchange.

CUSTOMER PROFILE:
- ID: ${customer.id} (INTERNAL ONLY - DO NOT OUTPUT TO CUSTOMER)
- Phone Last 4: ${customer.phone_last4 || 'None'} (INTERNAL ONLY - DO NOT OUTPUT)
- Alias / Name: ${customer.alias || customer.full_name || 'Customer'}
- Location Preference: ${customer.target_city || 'Not provided yet'}
- Beds Preference: ${customer.target_beds ? customer.target_beds + ' beds' : 'Not provided yet'}
- Baths Preference: ${customer.target_baths ? customer.target_baths + ' baths' : 'Not provided yet'}
- Max Budget: ${customer.max_budget ? '$' + customer.max_budget.toLocaleString() : 'Not provided yet'}
- Move-in Date: ${customer.move_in_date || 'Not provided yet'}
- Pets: ${customer.has_pets ? 'Yes (' + (customer.pet_details || 'pets') + ')' : 'No'}
- Disclosed Credit History: ${customer.credit_concerns || 'None disclosed'}
- Disclosed Eviction History: ${customer.eviction_history || 'None disclosed'}
- Application Status: ${customer.application_status || 'not_confirmed'}
- Fee Status: ${customer.application_fee_status || 'not_confirmed'}

RECENT CONVERSATION HISTORY:
${conversationHistory || '(No previous conversation)'}

INTERNAL STAFF NOTES:
${internalNotes || '(None)'}
${operatorNotes ? 'Operator note for this draft: ' + operatorNotes : ''}

LATEST CUSTOMER MESSAGE:
"${incomingMessage}"

Draft a clear, warm, professional, copy-ready response answering the customer's latest message based on their profile and our policies.`;

    let generatedText = null;
    let modelUsed = 'domain-rules-engine';

    // Attempt Gemini call if API key and client available
    if (GoogleGenAI && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI();
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: systemInstruction
        });
        if (response && response.text) {
          generatedText = response.text.trim();
          modelUsed = 'gemini-3.8-flash';
        }
      } catch (geminiError) {
        console.warn('Gemini API call bypassed or failed:', geminiError.message);
        // Fall back seamlessly to domain engine
      }
    }

    // If Gemini was unavailable or threw, use our domain engine
    if (!generatedText) {
      generatedText = generateDomainFallbackResponse({
        customer,
        incomingMessage,
        policies
      });
      modelUsed = 'domain-rules-engine (policy-verified)';
    }

    // Safety scrub: ensure internal identifier never leaked into text
    if (customer.phone_last4) {
      generatedText = generatedText.replace(new RegExp(`\\b${customer.phone_last4}\\b`, 'g'), '');
    }
    // Safety scrub: ensure application fee invariant
    generatedText = generatedText.replace(/\$(?:0|35|40|45|55|60|65|75)\s*(?:application fee|app fee)/gi, '$50 per adult applicant being screened');
    generatedText = generatedText.replace(/(?:free|waived)\s*application/gi, '$50 per adult applicant being screened');

    return {
      success: true,
      customerId: customer.id,
      draftText: generatedText,
      modelUsed,
      detectedUpdates: preferenceUpdates,
      hasDetectedUpdates: Object.keys(preferenceUpdates).length > 0
    };
  }
};

module.exports = AIAssistant;
