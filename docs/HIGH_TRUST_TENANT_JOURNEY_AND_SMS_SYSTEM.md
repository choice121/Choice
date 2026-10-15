# Choice Properties — High-Trust Tenant Journey, Document Generation & SMS Dispatch Architecture

> **Document Version:** 1.0.0  
> **Target Audience:** Future AI Agents, Full-Stack Engineers, Operations Specialists, and Leasing Administrators.  
> **Status:** Authoritative Architectural & Implementation Blueprint.

---

## 1. Executive Summary & Operational Reality

Choice Properties operates a nationwide rental platform designed to provide a premium, corporate-grade leasing experience while utilizing **direct, dynamic payment coordination** (Zelle, Cash App, PayPal Friends & Family, Venmo, Apple Pay, Chime, Cashier's Check) without static corporate bank accounts or third-party merchant processing gateways.

### The Operational Challenge & Solution
* **The Reality:** The leasing desk rotates payment accounts/tags dynamically (frequently personal tags or regional account names) and coordinates payments directly via SMS with applicants.
* **The Psychological Hurdle:** Renters who pay via peer-to-peer apps can experience anxiety or suspect rental fraud if the process feels informal or unorganized.
* **The Architectural Solution:** 
  1. **Pre-Payment:** Never print static bank/account details on invoices or forms. Frame dynamic coordination as an institutional convenience (*"fee-waived direct officer routing"*).
  2. **Payment Intake:** Coordinator texts applicant using structured, reassuring leasing scripts that explain the account name in advance and specify the transaction memo.
  3. **Post-Payment:** Immediately upon recording the transaction in the Admin Dashboard, the system produces an **official, serial-numbered, digitally stamped Corporate Transaction Ledger & Receipt PDF** (`#CP-REC-XXXX`).
  4. **Communication:** At every milestone, the platform automatically generates an accurate, ready-to-send **SMS Dispatch Snippet** delivered to the Admin (via email notification and a 1-click clipboard copy button in `/admin/applications.html`) ensuring fast, professional mobile texting with zero spam filter risks or 10DLC fees.

---

## 2. Platform Compliance Rules (Strict Invariants)

Per `AGENTS.md` and Choice Properties core policies, any engineer or AI working on this implementation **must strictly observe the following rules**:
1. **Application Fee:** Strictly `$50.00`. Database field: `application_fee: 50`. Descriptions and documents must never claim free or waived fees.
2. **Security Deposit:** Strictly 1x monthly rent in structured database fields, but **never mentioned in listing descriptions**.
3. **No Lease Term Display:** Never display lease lengths, lease durations, or minimum lease months on property detail pages or cards.
4. **No Available Date or Move-In Tables:** Never display "Available From", move-in dates, or availability tables on property pages.
5. **No Smoking Policies:** Never display smoking restrictions or tabs on property pages.
6. **Pet Policy:** Always pet-friendly.
7. **No Synthetic or Artificial Brackets:** Do not display misleading tags like `[Zelle] Direct Bank-to-Bank Transfer` on consumer forms.
8. **Sight-Unseen Remote Leasing:** Do not require video walkthroughs or pre-qualification; trust is established through contractual inspection contingencies and institutional documentation.

---

## 3. The 7-Stage End-to-End Tenant Journey

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: PROPERTY BROWSING & APPLICATION INTENT                                        │
│ • Clear $50 Application Fee badge                                                      │
│ • "45-Day Reapplication Guarantee" (2 free transfer credits if denied)                 │
│ • "48-Hour Move-In Inspection Contingency" guarantee badge                             │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: APPLICATION FORM SUBMISSION (/apply/index.html)                               │
│ • Step 5: "Resident Billing Allocation"                                                │
│ • Explains: "Direct coordination waives convenience surcharges"                        │
│ • Collects applicant's active payment services (Cash App, Zelle, PayPal, etc.)         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: APPLICATION INTAKE & FEE COORDINATION (SMS STAGE 1)                           │
│ • System generates Stage 1 SMS Dispatch for Admin                                      │
│ • Admin texts applicant with assigned tag/account & memo instructions                  │
│ • Reminds applicant to inspect email inbox & spam folder for file confirmation         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: FEE VERIFIED & STAMPED RECEIPT ISSUED (SMS STAGE 2)                           │
│ • Admin records payment in /admin/applications.html                                    │
│ • System generates Stamped Corporate Receipt PDF (#CP-REC-APP-XXXX)                    │
│ • System sends Stage 2 SMS to Admin -> Admin texts applicant with portal receipt link  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 5: APPROVAL & HOLDING ESCROW AGREEMENT (SMS STAGE 3 & 4)                         │
│ • Application approved by underwriting                                                 │
│ • Holding Agreement generated (#CP-AGR-HOLD-XXXX) reserving unit 7-14 days             │
│ • 100% of holding fee credited to move-in security deposit                             │
│ • Stage 3 SMS sent to Admin -> Tenant reviews agreement & remits escrow                │
│ • Admin verifies holding fee -> Stamped Escrow Receipt PDF issued (#CP-REC-HOLD-XXXX)  │
│ • Stage 4 SMS sent to Admin -> Property locked & off the market                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 6: RESIDENTIAL LEASE EXECUTION (SMS STAGE 5 & 6)                                 │
│ • Lease Agreement generated with electronic signing link                               │
│ • Stage 5 SMS sent to Admin -> Admin texts tenant to review & sign                     │
│ • Tenant signs -> Admin countersigns -> Fully Executed Package compiled                │
│ • Stage 6 SMS sent to Admin -> Admin texts Welcome Home packet to tenant               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 7: KEY HANDOVER PROTOCOL & MOVE-IN (SMS STAGE 7)                                 │
│ • Move-in balance verified                                                             │
│ • Stage 7 SMS sent to Admin -> Admin texts electronic lockbox code (9:00 AM)           │
│ • 48-Hour Move-In Condition Checklist submitted by tenant in portal                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. The Automated SMS Dispatch System for Administrators

Because carrier 10DLC restrictions and third-party SMS gateway fees can result in blocked messages or unexpected downtime, the platform uses an **Automated Admin Dispatch Architecture**.

### How It Works:
1. **Trigger Event:** Whenever a milestone occurs (submission, fee recorded, approval, holding deposit, lease dispatch, countersign, move-in), the system generates an event payload.
2. **Dual Delivery:**
   * **In Admin Email Notification:** The system sends an email to the leasing desk with a prominent, formatted box containing the exact SMS text.
   * **In Admin Dashboard (`/admin/applications.html`):** A dedicated **"Quick SMS Dispatch"** drawer with 1-click clipboard copy (`navigator.clipboard.writeText`) and native mobile `sms:` links.

### The 7 Official SMS Dispatch Templates

#### Stage 1: New Application Submitted (Fee Intake Coordination)
* **Trigger:** Applicant submits form on `/apply/index.html`.
* **Admin Email Subject:** `[ACTION: Send SMS] New Application Intake: {Applicant_Name} - {Address}`
* **Generated SMS Content:**
```text
Hello {First_Name}, this is the Choice Properties Leasing Desk regarding your rental application for {Property_Address} (Ref: #{App_ID}). 

We have received your submission. Your file is queued for underwriting verification. To proceed with processing, your $50 screening fee can be coordinated via your selected method ({Preferred_Method}). 

Please reply directly to this text so I can provide the active routing details for your transaction. 

Note: We also dispatched your formal application confirmation to {Email}. If you do not see it in your inbox, please check your spam or promotions folder.
```

#### Stage 2: Application Fee Received & Stamped Receipt Issued
* **Trigger:** Admin clicks "Record Payment" and confirms $50 in dashboard.
* **Admin Email Subject:** `[ACTION: Send SMS] Fee Received - Stamped Receipt for {Applicant_Name}`
* **Generated SMS Content:**
```text
Hello {First_Name}, your $50 application screening fee for {Property_Address} has been received and verified. 

Your official stamped corporate ledger receipt has been generated. You can access your file and view your receipt directly in your resident portal here:
https://choice-properties-site.pages.dev/tenant/portal.html?app={App_ID}

Your full file is now with our underwriting department. We have also emailed a copy of your receipt to {Email} (please check your spam/junk folder if not visible).
```

#### Stage 3: Application Approved & Holding Priority Active
* **Trigger:** Admin sets application status to "Approved".
* **Admin Email Subject:** `[ACTION: Send SMS] APPROVAL NOTICE & Holding Agreement for {Applicant_Name}`
* **Generated SMS Content:**
```text
Congratulations {First_Name}! Your rental application for {Property_Address} has been officially APPROVED by Choice Properties underwriting.

Under our reservation protocol, this property is eligible to be held exclusively in your name while we prepare your lease documents. Your holding deposit is 100% credited toward your move-in balance.

Please review your Approval & Reservation Agreement here:
https://choice-properties-site.pages.dev/tenant/portal.html?app={App_ID}

We also sent your official approval packet to {Email}. Please check your inbox and spam folder. Reply to this text to coordinate your reservation holding details.
```

#### Stage 4: Holding Deposit Verified (Property Secured)
* **Trigger:** Admin confirms holding deposit received.
* **Admin Email Subject:** `[ACTION: Send SMS] Property Locked & Escrow Receipt for {Applicant_Name}`
* **Generated SMS Content:**
```text
Great news {First_Name}! Your reservation holding deposit for {Property_Address} has been verified and posted to your account ledger. 

The home is now officially off the market and secured for your upcoming move-in! Your Stamped Escrow Receipt (#CP-REC-HOLD-{App_ID}) is now available in your portal:
https://choice-properties-site.pages.dev/tenant/portal.html?app={App_ID}

Our leasing team is currently preparing your official Residential Lease Agreement. We have also emailed your escrow statement to {Email} (please check spam if needed).
```

#### Stage 5: Lease Agreement Ready for Electronic Signature
* **Trigger:** Admin generates and dispatches lease agreement.
* **Admin Email Subject:** `[ACTION: Send SMS] Lease Dispatched for E-Sign: {Applicant_Name}`
* **Generated SMS Content:**
```text
Hello {First_Name}, your official Residential Lease Agreement for {Property_Address} is prepared and ready for electronic signature!

Please review and execute your agreement securely using your signing link:
https://choice-properties-site.pages.dev/tenant/sign.html?token={Signing_Token}

A direct signing copy was also dispatched to {Email}. Because this contains formal legal contracts, some email providers filter it—please inspect your spam, junk, or promotions folder. Feel free to text me here once signed!
```

#### Stage 6: Lease Fully Countersigned & Executed
* **Trigger:** Admin countersigns the lease.
* **Admin Email Subject:** `[ACTION: Send SMS] Fully Executed Lease & Welcome Packet for {Applicant_Name}`
* **Generated SMS Content:**
```text
Welcome home, {First_Name}! Your lease for {Property_Address} has been fully countersigned and finalized by Choice Properties management. 

Your complete, executed legal lease package and initial move-in orientation guide are now available in your resident portal:
https://choice-properties-site.pages.dev/tenant/portal.html?app={App_ID}

We also emailed your executed documents to {Email} (check your spam folder if not in primary inbox). Our move-in coordination team will reach out with your key handover protocol as your move-in date approaches!
```

#### Stage 7: Pre-Move-In Key Handover Protocol (Access Code Dispatch)
* **Trigger:** Move-in morning activation (9:00 AM).
* **Admin Email Subject:** `[ACTION: Send SMS] Key Access Code & Move-In Instructions for {Applicant_Name}`
* **Generated SMS Content:**
```text
Hello {First_Name}, today is your official move-in day for {Property_Address}! 

Your electronic lockbox / keypad access code is: [ENTER_CODE]
(Code activates at 9:00 AM local time).

Please remember to complete your 48-Hour Move-In Condition Checklist in your portal to document initial property condition and protect your deposit:
https://choice-properties-site.pages.dev/tenant/portal.html?app={App_ID}

Full move-in packet and emergency maintenance contacts have been emailed to {Email} (check spam if needed). Welcome to Choice Properties!
```

---

## 5. Document & Stamped Receipt Generation Engine

### 1. Database Schema
The database already has the required financial tracking columns on the `applications` table (`supabase/migrations/20240419_phase7_financial_columns.sql`):
```sql
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS holding_fee_requested    BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holding_fee_amount        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS holding_fee_due_date      DATE,
  ADD COLUMN IF NOT EXISTS holding_fee_paid          BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holding_fee_paid_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_amount_collected  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_method_confirmed  TEXT,
  ADD COLUMN IF NOT EXISTS payment_transaction_ref   TEXT,
  ADD COLUMN IF NOT EXISTS receipt_pdf_path          TEXT,
  ADD COLUMN IF NOT EXISTS holding_receipt_pdf_path  TEXT;
```

### 2. PDF Rendering Engine (`_shared/receipt-render.ts`)
Using the project's existing `pdf-lib` dependency (already powering `_shared/deposit-letter-render.ts` and `generate-lease`), receipts are rendered server-side or generated on demand:
```typescript
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

export interface ReceiptData {
  receiptNumber: string;        // e.g. CP-REC-2026-94810
  receiptType: 'APPLICATION_FEE' | 'HOLDING_DEPOSIT' | 'MOVE_IN_RENT';
  tenantName: string;
  propertyAddress: string;
  amountPaid: number;
  paymentMethod: string;        // e.g. "Direct Verified Transfer (Channel: PayPal)"
  transactionRef: string;       // e.g. "Ref: PP-4819204"
  datePaid: string;
  adminOfficer: string;         // e.g. "Regional Billing Desk"
}

export async function buildReceiptPDF(data: ReceiptData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Standard US Letter
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Corporate Header
  page.drawText('CHOICE PROPERTIES', { x: 50, y: 730, size: 18, font: fontBold, color: rgb(0.08, 0.12, 0.22) });
  page.drawText('RESIDENTIAL LEASING & ESCROW MANAGEMENT', { x: 50, y: 715, size: 8, font: fontBold, color: rgb(0.3, 0.4, 0.5) });
  
  // Document Serial Badge
  page.drawRectangle({ x: 380, y: 705, width: 182, height: 42, color: rgb(0.95, 0.97, 1.0) });
  page.drawText('OFFICIAL TRANSACTION RECEIPT', { x: 390, y: 732, size: 8, font: fontBold, color: rgb(0.15, 0.35, 0.8) });
  page.drawText(`REF: ${data.receiptNumber}`, { x: 390, y: 715, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  page.drawLine({ start: { x: 50, y: 690 }, end: { x: 562, y: 690 }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });

  // Payer & Premises Info
  page.drawText(`Date Issued: ${data.datePaid}`, { x: 50, y: 660, size: 10, font: fontRegular });
  page.drawText(`Issued To: ${data.tenantName}`, { x: 50, y: 642, size: 10, font: fontBold });
  page.drawText(`Property: ${data.propertyAddress}`, { x: 50, y: 624, size: 10, font: fontRegular });

  // Ledger Table Box
  page.drawRectangle({ x: 50, y: 520, width: 512, height: 80, color: rgb(0.98, 0.98, 0.99) });
  page.drawText('DESCRIPTION', { x: 65, y: 580, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('PAYMENT METHOD / REF', { x: 260, y: 580, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('AMOUNT CLEARED', { x: 450, y: 580, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });

  const desc = data.receiptType === 'APPLICATION_FEE' 
    ? 'Residential Screening Fee (45-Day Transfer Guarantee)' 
    : 'Property Reservation Holding Escrow (100% Deposit Credit)';
  page.drawText(desc, { x: 65, y: 550, size: 8.5, font: fontRegular });
  page.drawText(`${data.paymentMethod} (${data.transactionRef})`, { x: 260, y: 550, size: 8.5, font: fontRegular });
  page.drawText(`$${data.amountPaid.toFixed(2)}`, { x: 450, y: 550, size: 10, font: fontBold, color: rgb(0.1, 0.5, 0.2) });

  // Stamped Operating Ledger Seal
  page.drawRectangle({ x: 50, y: 410, width: 512, height: 75, color: rgb(0.94, 0.98, 0.95) });
  page.drawText('• AUDIT VERIFIED & POSTED TO OPERATING ESCROW LEDGER •', { x: 120, y: 460, size: 9, font: fontBold, color: rgb(0.1, 0.5, 0.2) });
  page.drawText(`Status: CLEARED & RECORDED  |  Accounting Desk: ${data.adminOfficer}`, { x: 130, y: 440, size: 8, font: fontRegular, color: rgb(0.15, 0.35, 0.2) });
  page.drawText('Funds accounted for in full compliance with state landlord-tenant escrow rules.', { x: 125, y: 425, size: 8, font: fontRegular, color: rgb(0.3, 0.4, 0.3) });

  // Institutional Footer
  page.drawText('Choice Properties Residential Operations  |  https://choiceproperties.com', { x: 170, y: 50, size: 8, font: fontRegular, color: rgb(0.6, 0.6, 0.6) });

  return await pdfDoc.save();
}
```

### 3. Client-Side Print View (`/receipt.html`)
To ensure receipts can be viewed or printed instantly without edge function dependencies:
* `/receipt.html?app_id={id}&type={fee|holding}` renders the exact vector receipt using CSS styling with `@media print`.
* Includes an embossed SVG stamp and a "Download / Print PDF" button.

---

## 6. Admin Dashboard Integration (`/admin/applications.html`)

### 1. Payment Recording Modal
When an administrator clicks **"Record Payment"** in `/admin/applications.html`:
1. Modal displays:
   * **Target:** `$50.00 Application Fee` OR `$500.00 Holding Deposit`.
   * **Payment Channel Selector:** `Cash App`, `Zelle`, `PayPal`, `Venmo`, `Apple Pay`, `Chime`, `Cashier's Check`, `Other`.
   * **Transaction Memo / Confirmation Ref Input:** (e.g., confirmation string from text/screenshot).
2. On Submit:
   * Writes to `applications` table.
   * Calls receipt generator.
   * Uploads PDF to `lease-pdfs` Supabase storage bucket under `<app_id>/receipts/`.
   * Displays the generated Stage 2 or Stage 4 SMS in a ready-to-copy modal for the admin.

### 2. "Quick SMS Dispatch" Component
Add a prominent button to each application card:
```html
<button class="btn btn-sm btn-outline" onclick="openSmsModal(app)">
  📱 Copy SMS for Tenant
</button>
```
Clicking this opens a tabbed panel with all 7 stages pre-filled with the applicant's real name, address, reference number, and portal URL. A single tap copies the exact text to the admin's device clipboard.

---

## 7. Implementation Checklist for Future AI Agents

When instructed to implement this system, execute in the following sequence:

- [ ] **Phase 1: Step 5 Application Form Refinement** (`/apply/index.html` & `apply/js/script.js`)
  - Update copy on Step 5 to "Resident Billing Allocation".
  - Explain that coordinators provide active fee-waived routing tags via SMS upon submission.
- [ ] **Phase 2: Property Page Trust Badges** (`/property.html` & `js/property.js`)
  - Ensure the "45-Day Reapplication Guarantee" is visibly rendered near the application card.
  - Ensure the "48-Hour Move-In Inspection Contingency" is clearly detailed in the terms section.
- [ ] **Phase 3: Automated SMS Generation in Email Relay** (`supabase/functions/send-email/` or `GAS-EMAIL-RELAY.gs`)
  - In every admin alert email, embed the copy-ready SMS dispatch text block with the applicant's phone number.
- [ ] **Phase 4: Admin Dashboard Modal & Copy Button** (`/admin/applications.html` & `js/admin/applications.js`)
  - Add the "Record Payment" modal with payment channel and transaction reference fields.
  - Add the "Quick SMS Dispatch" 1-click clipboard copy drawer.
- [ ] **Phase 5: Stamped Receipt PDF Generation** (`supabase/functions/_shared/receipt-render.ts` & `/receipt.html`)
  - Wire `buildReceiptPDF` to persist receipts to the `lease-pdfs` storage bucket.
  - Implement `/receipt.html` as the instantaneous client-side fallback.
- [ ] **Phase 6: Tenant Portal Document Display** (`/tenant/portal.html` & `js/tenant/portal.js`)
  - Render download buttons for `#CP-REC-APP-XXXX` and `#CP-REC-HOLD-XXXX` once verified.
