# Customer Identification & Persistent Memory Architecture

This document governs the customer identification system, memory hierarchy, collision handling, and data migration standards.

## 1. Customer Identifiers
- **4-Digit Phone Suffix (e.g. `8376`, `1954`, `6063`)**:
  - Used as a convenient operational shorthand by leasing staff.
  - **Not globally unique**: The system must treat 4-digit numbers as convenient indexing keys, not absolute cryptographic IDs.
  - Suffixes are **strictly internal**. They must NEVER be included in outgoing customer-facing messages.
- **Assigned Name / Alias (e.g. `Riley`, `Suited`, `Marcus`)**:
  - Staff can assign a distinct alias or customer name.
  - Can be linked to a 4-digit suffix once confirmed.

## 2. Collision Detection & Disambiguation Protocol
- When searching by or assigning a 4-digit identifier:
  - If multiple customers share the same 4-digit suffix, the system MUST flag a collision alert.
  - The operator is prompted to choose between existing profiles or link records with a unique internal UUID (`id`).
  - Never automatically merge two customer records simply because they share a suffix, similar name, or city preference.

## 3. Profile Schema Structure
Each profile maintains six structured facets:
1. **Identity**:
   - `id`: Internal UUID
   - `phone_last4`: 4-digit string
   - `alias`: Assigned name / handle
   - `full_name`: Real name if provided
   - `contact_info`: Phone or email (stored only when authorized)
   - `created_at`: Profile creation timestamp
   - `last_activity_at`: Latest conversation or update timestamp
2. **Rental Preferences**:
   - `target_city`, `target_neighborhoods` (or ZIPs)
   - `target_beds`, `target_baths`
   - `max_budget` (numeric or range)
   - `property_type`: single_family, townhouse, duplex, apartment, condo
   - `move_in_date`: Target move-in timeframe
   - `has_pets`: Boolean / pet description
   - `requested_features`: Laundry, garage, fenced yard, etc.
3. **Application & Rental Context**:
   - `interested_property_ids`: Array of property IDs/addresses
   - `recommended_property_ids`: Array of links/IDs sent to renter
   - `application_status`: not_started, submitted, fee_pending, payment_confirmed, in_review, approved, denied, viewing_pending, reserved, leased, closed
   - `application_fee_status`: unpaid, paid, waived, not_confirmed
   - `outstanding_questions`: Items requiring operator follow-up
4. **Rental History & Qualification Context**:
   - `credit_concerns`: Disclosed credit score or issues
   - `eviction_history`: Disclosed past evictions, year, state
   - `income_notes`: Disclosed earnings, employer, pay frequency
5. **Conversation History**:
   - Chronological list of incoming customer messages and outgoing approved responses with channel (`sms`, `tiktok`, `web`) and status (`received`, `draft`, `sent`).
6. **Private Internal Notes**:
   - Staff-only operational observations (e.g., *"Waiting on Friday paycheck to pay fee"*, *"Prefers evening text messages"*). Visible only in admin, never to renters.

## 4. Active Preference vs. History Preservation
- When a customer updates a preference (e.g. changing maximum budget from $2,200 down to $1,800, or switching target city from Dallas to Charlotte):
  - Update the active preference fields in the profile.
  - Keep the original messages and context in the conversation history.
  - Never erase historical chat context when preferences evolve.

## 5. Portability & Migration Across GitHub Repositories & Deployments
- **Database Decoupling**: Customer records reside in persistent storage (Supabase PostgreSQL / persistent storage), not inside git commit history.
- **Connecting a New Deployment**:
  1. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in deployment environment variables.
  2. If deploying to a fresh database, run the migration in `/supabase/migrations/20261023000001_customer_memory_assistant.sql`.
  3. Use the built-in **Export / Import JSON** tool in the admin panel to migrate or restore customer memory snapshots across environments with one click.
- **Local Fallback Persistence**: In environments where direct Supabase DDL execution is pending, the server automatically maintains an encrypted/safe local store (`data/customer-memory/customers.json`) synchronized to database backups.
