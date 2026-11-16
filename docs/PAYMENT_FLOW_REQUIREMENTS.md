# Payment Flow Architecture & Specifications

> **STATUS: PERMANENT PLATFORM INVARIANT (CHOICE PROPERTIES)**
> **INTENTION & ARCHITECTURAL DIRECTIVE:**
> This document records the mandatory application payment workflow for Choice Properties. Future AI agents must preserve this sequence without modification.

## Mandatory Application Payment Sequence

1. **Card Payment Interface Display**:
   - When an applicant reaches the payment stage (`/apply/pay.html`), the interface displays a complete credit card payment form featuring:
     - **Card Number** (with real-time brand detection and Luhn validation)
     - **Expiration Date** (MM / YY parsing and expiry checking)
     - **CVV / Security Code** (dynamic 3 or 4 digit verification)
     - **Cardholder Name & Billing ZIP**

2. **Real-Time Validation & Processing Experience**:
   - Applicant enters credit card details.
   - Real-time validation checks format, Luhn checksum, and expiration.
   - Submitting the card triggers a multi-stage processing animation (*Encrypting & tokenizing card details*, *Connecting to card network*, *Verifying billing & issuing bank*, *Finalizing processing*).

3. **Transparent Card Payment Failure Pop-Up Right on Payment Screen**:
   - Following processing validation, the applicant stays on the credit card payment screen and a modern modal dialog appears directly over the payment form explaining that the card payment could not be completed because online card checkout is disabled on the portal — explicitly clarifying this is a portal checkout restriction and **not** a bank decline or card issue. No charges are made.
   - Dismissing the modal keeps the applicant cleanly on the card checkout screen with a subtle, dismissible inline notice banner and Leasing Desk contact details.

4. **Professional Institutional Checkout Experience**:
   - The applicant-facing payment screen remains a clean, high-trust debit/credit card checkout page paired with the application fee summary sidebar and does not expose informal peer-to-peer payment grids.
