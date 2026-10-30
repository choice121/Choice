# Choice Properties — AI Rental Inquiry Assistant & iPhone Copilot System

> **Status**: Production Deployed & Active  
> **Platforms Supported**: Web Admin Console, iOS Shortcuts (Google Voice, WhatsApp, iMessage, SMS)  
> **Backend Engine**: `lib/inquiry-assistant-engine.mjs` & `serve.js`  
> **Live Web Endpoints**:
> - Mobile Setup & Shortcut Generator: `https://choice-properties-site.pages.dev/admin/mobile-setup.html`
> - Web Management Console: `https://choice-properties-site.pages.dev/admin/inquiry-assistant.html`
> - Direct Plain-Text Quick Draft API: `POST https://choice-properties-site.pages.dev/api/assistant/quick-draft?format=text`

---

## 1. Executive Summary & Capabilities

The **Choice Properties AI Rental Inquiry Assistant** provides high-conversion, professional tenant communication without requiring manual copy-pasting into a complex CRM or looking up properties by hand.

### Key Capabilities
1. **Zero-Manual Data Entry Memory**:
   - Automatically parses incoming inquiries for phone number suffixes (e.g. `(9182)`), bedroom counts, monthly rental budgets, target cities, housing vouchers/Section 8, and pet details.
   - Creates or updates the customer's persistent profile in Supabase seamlessly behind the scenes.
2. **iPhone 1-Tap & Back-Tap Copilot**:
   - Integrates natively with iOS Shortcuts via clipboard automation.
   - When communicating on **Google Voice**, **WhatsApp**, or **iMessage**, copying the lead's message and double-tapping the back of the iPhone generates a polished, context-aware reply on the clipboard in under 1 second.
3. **Independent Company Knowledge & General Intake**:
   - Fully capable of answering high-level questions without being tied to a specific property listing (e.g. general screening standards, housing voucher acceptance, co-signers, landlord partnership intake, and application procedures).
4. **Platform Invariant Guardrails**:
   - States the **$50 fee per adult screened** and does not charge adult occupants who are not applying or being screened.
   - Strictly adheres to zero deposit mentions in conversational texts.
   - Respects privacy: internal database IDs and private operator notes are never leaked to customers.
5. **Decoupled & Portable**:
   - Persists data to Supabase PostgreSQL with an automated JSON file fallback in `data/customer-memory/`.
   - Supports 1-click JSON backup and restore from the Web Admin Console.

---

## 2. Architecture & Data Flow

```
   ┌─────────────────────────────────────────────────────────┐
   │                Operator's iPhone / Mobile               │
   │  (Google Voice / WhatsApp / iMessage / SMS / Social DM) │
   └────────────────────────────┬────────────────────────────┘
                                │
                        1. Copy Message
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │               iOS Shortcut (Back-Tap / Action)          │
   │  POST /api/assistant/quick-draft?format=text            │
   └────────────────────────────┬────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │            Choice Properties Express Server             │
   │                 (serve.js /api/assistant/*)             │
   └────────────────────────────┬────────────────────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
   ┌───────────────────────────┐   ┌───────────────────────────┐
   │ AI Inquiry Assistant      │   │ Customer Memory Engine    │
   │ (lib/ai-assistant.js)     │   │ (lib/customer-store.js)   │
   │ - Policy Guardrails       │   │ - Preference Parsing      │
   │ - Voucher / Credit Engine │   │ - Phone Last-4 Indexing   │
   │ - 4-Digit ID Matching     │   │ - Deduplication & Memory  │
   └──────────────┬────────────┘   └─────────────┬─────────────┘
                  │                              │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
   ┌─────────────────────────────────────────────────────────┐
   │                 Persistent Storage                      │
   │  - Primary: Supabase PostgreSQL (customer_profiles)     │
   │  - Fallback: data/customer-memory/customers.json        │
   └─────────────────────────────────────────────────────────┘
```

---

## 3. iOS Shortcut Setup (Takes ~60 Seconds)

To install the copilot on an iPhone:

1. Open **Safari** on your iPhone and go to:  
   `https://choice-properties-site.pages.dev/admin/mobile-setup.html`
2. Open the **Shortcuts** app on your iPhone and tap **+** (New Shortcut).
3. Add the following 4 actions:
   - **Action 1**: `Get Clipboard`
   - **Action 2**: `Get Contents of URL`
     - URL: `https://choice-properties-site.pages.dev/api/assistant/quick-draft?format=text`
     - Method: `POST`
     - Headers: `Content-Type: application/json`
     - Request Body: `JSON`
       - Key `text`: select `Clipboard` variable
   - **Action 3**: `Copy to Clipboard`
     - Pass the response text directly into the clipboard.
   - **Action 4**: `Show Notification` (Optional)
     - Text: *"Choice reply copied to clipboard!"*
4. Go to **Settings > Accessibility > Touch > Back Tap > Double Tap** (or **Action Button** on iPhone 15 Pro/16) and select your new shortcut.
5. In any chat app, copy the lead's message, double-tap the back of your phone, and paste the answer!

---

## 4. API Reference

All endpoints are hosted on the primary site server and support both JSON and plain-text responses:

### 1. `POST /api/assistant/quick-draft`
Designed for mobile copy-paste workflows and Apple Shortcuts.

- **Query Parameters**:
  - `format=text`: Returns a pure plain-text string ready for the clipboard.
  - `format=json` (default): Returns a structured JSON payload with extracted customer profile data and draft details.
- **Request Body**:
  ```json
  {
    "text": "Hi, this is Marcus (9182). Looking for a 3 bed in Dallas under $1800. Do you accept Section 8?"
  }
  ```
- **Response (`format=json`)**:
  ```json
  {
    "ok": true,
    "draft": "Hi Marcus! Thanks for reaching out to Choice Properties. Yes, we gladly accept housing choice vouchers and Section 8...",
    "detected_customer": {
      "phone_last4": "9182",
      "target_beds": 3,
      "max_budget": 1800,
      "target_city": "Dallas",
      "has_pets": false
    },
    "customer_id": "c8a4110f-f446-4ee8-a5b8-5cf7818aa12b"
  }
  ```

### 2. `POST /api/assistant/query`
Searches customer memory by 4-digit identifier, phone number, name, or free-text query.

### 3. `POST /api/assistant/draft`
Generates a draft response with custom context (matched properties, tone adjustment, or follow-up mode).

### 4. `POST /api/assistant/customer`
Creates or updates a customer profile and stores internal notes or updated rental criteria.

### 5. `POST /api/assistant/policy`
Updates platform-wide business rules centrally without modifying code.

---

## 5. Database Schema (Supabase)

The migration is located at:  
`supabase/migrations/20261023000001_customer_memory_assistant.sql`

### Tables
1. **`public.customer_profiles`**:
   - `id`: UUID (Primary Key)
   - `phone_last4`: VARCHAR(4) (Indexed for fast lookups)
   - `alias` / `full_name`: TEXT
   - `target_city`, `target_beds`, `target_baths`, `max_budget`: Structured rental criteria
   - `has_pets`, `pet_details`: Pet accommodation details
   - `credit_concerns`, `eviction_history`, `income_notes`: Qualification context
   - `application_status`, `payment_status`, `next_action`: Workflow state
2. **`public.customer_conversations`**:
   - `customer_id`: Foreign key to `customer_profiles`
   - `channel`: `sms`, `whatsapp`, `google_voice`, `imessage`, `web_chat`
   - `sender`: `customer`, `assistant`, `staff`
   - `message_text`: Full body text
   - `metadata`: JSONB containing extracted entities and delivery status
3. **`public.customer_internal_notes`**:
   - Private leasing team notes, inspection notes, and internal flags (never exposed to customers).

---

## 6. Testing & Quality Assurance

To run the automated test suite locally:

```bash
# Test the core assistant engine & business policies (12 tests)
node scripts/test-inquiry-assistant.mjs

# Test mobile shortcut endpoints, voucher intelligence, and memory extraction (22 tests)
node scripts/test-mobile-assistant.mjs
```

All 34 tests must pass before deploying updates to production.

---

## 7. Operational Guidelines for Future AI Assistants

1. **Application Fee**: State **$50 per adult screened**. The total is shown before submission; do not imply that adult occupants who are not applying or being screened are charged. Fees are subject to applicable law.
2. **No Security Deposit Mentions in Text**: Deposits are stored strictly in the database as 1x monthly rent. Never quote deposit dollar figures in chat or SMS copy.
3. **Warm, Holistic Qualification**: If applicants mention low credit scores, past evictions, or non-traditional income, respond reassuringly and explain that applications are evaluated holistically based on income stability and rental references. Never issue automatic rejections or false approval guarantees.
4. **Voucher & Section 8 Welcoming**: Choice Properties welcomes housing choice vouchers and subsidy programs. Respond with enthusiasm and provide the application steps.
