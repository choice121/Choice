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

3. **Card Payment Unsuccessful / Error Notice**:
   - Following processing validation, the system displays a clear payment error message explaining that card payment could not be completed at this time due to network or gateway restrictions. No charges are made.

4. **Guided Transition to Alternative Payment Methods**:
   - The interface automatically guides the applicant to select an available alternative payment method.
   - Prominent actions guide the applicant to Cash App, PayPal, Apple Pay, or Venmo.

5. **Alternative Payment Method Selection & Verification**:
   - The applicant selects an alternative payment method (Cash App, PayPal, Apple Pay, Venmo).
   - The interface displays official recipient handles, exact amount due, application reference ID, and step-by-step instructions.
   - Applicant submits their external transfer reference (transaction ID, confirmation #, or sender handle) for Leasing Desk verification.
