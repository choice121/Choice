# Choice Properties — AI Rental Inquiry Assistant & Customer Memory System

Welcome to the documentation for the Choice Properties Customer Support AI and Customer Memory Engine.

## Directory Structure
- `business-policies.md` — Single source of truth for financial rules, fees ($50 per screened adult), deposits (1x in DB, 0 in text), 24-72h review, and 30-day/two-property reapplication courtesy.
- `response-style.md` — Brand voice, copy-ready format rules, "we" perspective, missing-information discipline, zero internal IDs in customer messages.
- `application-process.md` — 11-step application lifecycle, distinction between workflow explanation and confirmed database status.
- `qualification-guidelines.md` — Empathetic, confident handling of low credit, past evictions, non-traditional income without guaranteeing approval or frightening renters.
- `customer-memory.md` — 4-digit phone suffix indexing, collision disambiguation, structured profile schema, GitHub import & migration guide.

## How Runtime Loads Instructions
The backend server (`serve.js`) reads these markdown files dynamically via the `/api/assistant/policies` and `/api/assistant/generate-reply` endpoints. When business policies change, editing `business-policies.md` or saving policies through the Admin UI updates the assistant's behavior across all sessions.

## Portability & Deploying to a New Repository / Host
1. Customer memory records are decoupled from git commits.
2. The database migration is located at `/supabase/migrations/20261023000001_customer_memory_assistant.sql`.
3. Use the Admin UI under **Inquiry Assistant > Backup / Restore** to export a complete JSON snapshot of all customer profiles, chat histories, and notes at any time.
4. On a new deployment, import the JSON backup file to instantly restore full conversational memory.
