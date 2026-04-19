# MIGRATION_PATTERNS.md — Choice Properties Coding Conventions
## Every AI Working on This Project Must Read This

---

> **This document is authoritative.** If you are about to write code for the Choice Properties
> admin panel, serve.js, or any part of this project, you must read this document first.
> It was written by studying the actual source code across both repos. Do not deviate from
> these conventions — consistency across AI sessions and platforms is the only way this
> multi-session project succeeds.

---

## 1. Project Structure

```
/                          ← main repo root (choice121/Choice)
├── serve.js               ← Node.js static server (http.createServer — NOT Express)
├── config.js              ← Cloudflare Pages env vars exposed to browser
├── SETUP.sql              ← Authoritative base schema (run this first)
├── MIGRATION.md           ← Migration guide (you read this already)
├── MIGRATION_SCHEMA.sql   ← Migration-specific SQL (run after SETUP.sql)
├── MIGRATION_PATTERNS.md  ← This file
├── js/
│   ├── cp-api.js          ← Shared Supabase client + API helpers (ALL pages import this)
│   └── supabase.min.js    ← Supabase JS SDK (loaded as defer script, NOT as module)
├── css/
│   ├── main.css           ← Global styles and CSS variables
│   ├── admin.css          ← Admin panel styles
│   └── mobile.css         ← Mobile overrides
├── admin/                 ← Admin panel pages (static HTML)
│   ├── dashboard.html
│   ├── applications.html
│   ├── leases.html
│   ├── move-ins.html
│   ├── messages.html
│   ├── landlords.html
│   ├── listings.html
│   ├── email-logs.html
│   ├── audit-log.html
│   └── watermark-review.html
└── landlord/              ← Landlord portal pages (static HTML)
```

The apply form is a SEPARATE repo (`apply-choice-properties (separate project, no connection to this repo)`). Do not modify that repo unless explicitly told to (Phase 2 work only).

---

## 2. The Supabase Client (`CP.sb()`)

**Every admin page gets the Supabase client via `CP.sb()`**, not by importing Supabase directly.

`cp-api.js` defines a lazy singleton:

```javascript
let _sb = null;
function sb() {
  if (!_sb) {
    // Creates the Supabase client using CONFIG.SUPABASE_URL and CONFIG.SUPABASE_ANON_KEY
    // CONFIG comes from config.js (defer script)
    // window.supabase comes from supabase.min.js (defer script)
    _sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {...});
  }
  return _sb;
}
```

`cp-api.js` also exports helpers: `CP.Auth.getUser()`, `CP.sb()`, and more.

**All page scripts access Supabase like this:**
```javascript
const { data, error } = await CP.sb().from('applications')
  .select('*')
  .order('created_at', { ascending: false });
```

**Never** do this in an admin page:
```javascript
// WRONG — don't create your own Supabase client
const supabase = createClient(url, key);
```

---

## 3. Admin Page Structure — Exact Pattern

Every admin page follows this exact HTML structure. Do NOT deviate.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="theme-color" content="#006aff">
  <link rel="manifest" href="/manifest.json">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>[Page Title] — Choice Properties Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <script defer src="/config.js"></script>
  <link rel="stylesheet" href="/css/main.css?v=1775137055043">
  <link rel="stylesheet" href="/assets/fontawesome.css">
  <link rel="stylesheet" href="/css/admin.css?v=1775137055043">
  <link rel="stylesheet" href="/css/mobile.css?v=1775137055043">
  <script defer src="/js/supabase.min.js"></script>
  <!-- Page-specific styles ONLY if needed — keep minimal -->
  <style>/* page-specific only */</style>
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
</head>
<body>

<!-- SIDEBAR — copy exactly from dashboard.html, update active nav item -->
<div class="sidebar-overlay" id="sidebarOverlay"></div>
<aside class="sidebar" id="adminSidebar">
  <div class="sidebar-logo">
    <div class="name">Choice Properties</div>
    <div class="sub">Admin Portal</div>
  </div>
  <nav>
    <div class="nav-section">Overview</div>
    <a class="nav-item" href="dashboard.html"><span class="icon">⊞</span> Dashboard</a>
    <div class="nav-section">Applications</div>
    <a class="nav-item" href="applications.html"><span class="icon">📋</span> All Applications</a>
    <a class="nav-item" href="leases.html"><span class="icon">📄</span> Leases</a>
    <a class="nav-item" href="move-ins.html"><span class="icon">🏠</span> Move-Ins</a>
    <a class="nav-item" href="messages.html"><span class="icon">💬</span> Messages</a>
    <div class="nav-section">Platform</div>
    <a class="nav-item" href="landlords.html"><span class="icon">👤</span> Landlords</a>
    <a class="nav-item" href="listings.html"><span class="icon">🏢</span> Listings</a>
    <a class="nav-item" href="email-logs.html"><span class="icon">📧</span> Email Logs</a>
    <a class="nav-item" href="audit-log.html"><span class="icon">🔍</span> Audit Log</a>
    <div class="nav-section">Tools</div>
    <a class="nav-item" href="watermark-review.html"><span class="icon">🔎</span> Watermark Review</a>
  </nav>
  <div class="sidebar-footer">
    <a href="/index.html" target="_blank" style="display:block;font-size:12px;color:var(--muted,#8892a2);text-decoration:none;margin-bottom:8px;text-align:center">
      <i class="fas fa-external-link-alt" style="margin-right:4px"></i> View Live Site
    </a>
    <div class="admin-name" id="admin-name">Loading…</div>
    <button class="sign-out" onclick="CP.sb().auth.signOut().then(()=>location.href='login.html')">Sign Out</button>
  </div>
</aside>

<!-- MAIN CONTENT -->
<div class="main">
  <div class="topbar">
    <button class="menu-toggle" id="menuToggle" onclick="toggleSidebar()">☰</button>
    <h1 class="page-title">[Page Title]</h1>
  </div>

  <!-- YOUR PAGE CONTENT HERE -->
  <div class="content-area">
    <!-- loading state -->
    <div id="loading" style="text-align:center;padding:60px 20px;color:var(--muted)">Loading…</div>
    <!-- content container -->
    <div id="content" style="display:none"></div>
  </div>
</div>

<script defer src="/js/cp-api.js"></script>
<script>
// Admin auth check — always first
(async function initAdminPage() {
  const { data: userData } = await CP.Auth.getUser();
  if (!userData?.user) {
    window.location.href = 'login.html';
    return;
  }
  const { data: adminData } = await CP.sb()
    .from('admin_roles').select('id').eq('user_id', userData.user.id).single();
  if (!adminData) {
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('admin-name').textContent = userData.user.email || 'Admin';

  // Now load page data
  await loadPageData();
})();

async function loadPageData() {
  // ... page-specific code here
}
</script>
</body>
</html>
```

**Key rules:**
- `cp-api.js` loads with `defer` AFTER `supabase.min.js` — do not change this order
- The auth check pattern (`CP.Auth.getUser()` → check `admin_roles`) is the same on every admin page
- Use `var(--muted)`, `var(--text)`, `var(--surface2)`, `var(--color-border)` etc. for all colors — never hardcode colors
- Add the `active` class to the current page's `nav-item` in the sidebar

---

## 4. Application Status Values

The `status` enum on the `applications` table:
```
pending         → just received, no action taken yet
under_review    → admin or landlord is reviewing
approved        → approved for tenancy
denied          → rejected
waitlisted      → qualified but no unit available
withdrawn       → applicant withdrew
```

The `lease_status` enum:
```
none            → no lease created yet
sent            → lease PDF generated and signing email sent
signed          → tenant has signed (awaiting co-sign if applicable)
awaiting_co_sign → tenant signed, waiting for co-applicant
co_signed       → all required signers have signed
voided          → lease cancelled/voided
expired         → signing link expired before tenant signed
```

The `move_in_status` enum:
```
pending         → move-in not yet scheduled
scheduled       → date set, not yet confirmed
confirmed       → confirmed by admin/landlord
completed       → move-in has occurred
```

The `payment_status` enum:
```
unpaid          → application fee not paid
paid            → application fee received
waived          → fee waived by admin
refunded        → fee refunded
```

**All decisions are manual.** No status should ever be set automatically except:
- `lease_status = 'sent'` when lease email is sent (by `generate_lease_tokens()` DB function)
- `lease_status = 'signed'` or `'awaiting_co_sign'` when tenant signs (by `sign_lease_tenant()` DB function)
- `lease_status = 'co_signed'` when co-applicant signs (by `sign_lease_co_applicant()` DB function)

---

## 5. serve.js — Adding New Endpoints

`serve.js` uses Node.js `http.createServer` — it is NOT Express. Adding endpoints follows this exact pattern:

```javascript
// In serve.js, inside the createServer callback:
const server = http.createServer(function(req, res) {
  let urlPath = req.url.split('?')[0];

  // ── New API endpoints ──────────────────────────────────────
  if (urlPath === '/generate-lease' && req.method === 'POST') {
    handleGenerateLease(req, res);
    return;
  }

  if (urlPath === '/sign-lease' && req.method === 'POST') {
    handleSignLease(req, res);
    return;
  }

  if (urlPath === '/send-email' && req.method === 'POST') {
    handleSendEmail(req, res);
    return;
  }

  // ... existing static file serving code below (do not touch)
});
```

**Endpoint handler pattern:**
```javascript
async function handleGenerateLease(req, res) {
  // 1. Verify caller is admin (check Supabase JWT in Authorization header)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // 2. Validate token with Supabase admin client (server-side, service role key)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid token' }));
    return;
  }

  // 3. Check admin_roles
  const { data: adminRole } = await supabaseAdmin
    .from('admin_roles').select('id').eq('user_id', user.id).single();
  if (!adminRole) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not an admin' }));
    return;
  }

  // 4. Parse request body
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      // ... process and respond
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, pdfUrl: '...' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}
```

**Environment variables for serve.js** (set in Replit Secrets or deployment env):
```
SUPABASE_URL             → https://tlfmwetmhthpyrytrcfo.supabase.co
SUPABASE_SERVICE_KEY     → (service role key — never expose to browser)
GMAIL_USER               → the Gmail address for sending
GMAIL_APP_PASSWORD       → Gmail App Password (not account password)
ADMIN_EMAIL              → admin notification email
DASHBOARD_URL            → https://choice-properties-site.pages.dev/admin/dashboard.html
```

**Supabase admin client for serve.js:**
```javascript
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
```

---

## 6. PDF Generation with pdfkit

**Package:** `pdfkit` (install: `npm install pdfkit`)

```javascript
const PDFDocument = require('pdfkit');

async function generateLeasePDF(applicationData, templateText) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72, size: 'LETTER' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).font('Helvetica-Bold')
       .text('RESIDENTIAL LEASE AGREEMENT', { align: 'center' });
    doc.moveDown();

    // Substitute variables in template
    const rendered = substituteLeaseVariables(templateText, applicationData);

    // Body text
    doc.fontSize(11).font('Helvetica').text(rendered, { align: 'left', lineGap: 4 });

    // If signed: add signature block
    if (applicationData.tenant_signature) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('SIGNATURES', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11).font('Helvetica');
      doc.text(`Tenant: ${applicationData.tenant_signature}`);
      doc.text(`Date: ${applicationData.signature_timestamp}`);
      doc.text(`IP Address: ${applicationData.lease_ip_address}`);
      doc.text('(Electronically signed via Choice Properties portal)');
    }

    doc.end();
  });
}

function substituteLeaseVariables(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : match;
  });
}
```

**Variable mapping from `applications` row to template variables:**
```javascript
const templateVars = {
  tenant_full_name:  `${app.first_name} ${app.last_name}`,
  tenant_email:      app.email,
  tenant_phone:      app.phone,
  property_address:  app.property_address,
  lease_start_date:  app.lease_start_date,
  lease_end_date:    app.lease_end_date,
  monthly_rent:      app.monthly_rent,
  security_deposit:  app.security_deposit,
  move_in_costs:     app.move_in_costs,
  landlord_name:     app.lease_landlord_name,
  landlord_address:  app.lease_landlord_address,
  late_fee_flat:     app.lease_late_fee_flat,
  late_fee_daily:    app.lease_late_fee_daily,
  state_code:        app.lease_state_code,
  pets_policy:       app.lease_pets_policy,
  smoking_policy:    app.lease_smoking_policy,
  desired_lease_term: app.desired_lease_term,
  app_id:            app.app_id,
  signature_date:    app.signature_timestamp ? new Date(app.signature_timestamp).toLocaleDateString() : '',
  tenant_signature:  app.tenant_signature || '',
};
```

**Uploading PDF to Supabase Storage:**
```javascript
const pdfBuffer = await generateLeasePDF(app, templateText);
const storagePath = `${app.app_id}/lease_${Date.now()}.pdf`;

const { error: uploadError } = await supabaseAdmin.storage
  .from('lease-pdfs')
  .upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,  // Allow regeneration
  });

if (!uploadError) {
  // Update applications row with storage path (not a signed URL — path only)
  await supabaseAdmin.from('applications')
    .update({ lease_pdf_url: storagePath })
    .eq('app_id', app.app_id);
}
```

**Creating a signed URL for download (from admin page):**
```javascript
// In admin page JS (browser-side)
const { data: { signedUrl } } = await CP.sb().storage
  .from('lease-pdfs')
  .createSignedUrl(app.lease_pdf_url, 3600); // 1 hour expiry
window.open(signedUrl);
```

---

## 7. Email via Nodemailer (Gmail SMTP)

**Package:** `nodemailer` (install: `npm install nodemailer`)

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,  // Gmail App Password, NOT account password
  },
});

async function sendEmail({ to, subject, html, attachments }) {
  return transporter.sendMail({
    from: `"Choice Properties" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    attachments: attachments || [],
  });
}
```

**Email types and when to send:**
| Email | Trigger | To |
|-------|---------|-----|
| Application received | Phase 2: new app submitted to Supabase | Applicant + Admin |
| Application approved | Admin clicks Approve | Applicant |
| Application denied | Admin clicks Deny | Applicant |
| Lease signing invitation | Admin clicks "Send Lease" | Applicant (+ co-applicant if applicable) |
| Lease signed confirmation | Tenant completes signing | Admin + Landlord + Applicant |
| Move-in confirmed | Admin/Landlord clicks "Confirm Move-In" | Applicant |

**Lease signing email format:**
```html
<!-- HTML email body for signing invitation -->
<p>Dear {{tenant_first_name}},</p>
<p>Your lease for <strong>{{property_address}}</strong> is ready to review and sign.</p>
<p>
  <a href="{{signing_url}}" style="display:inline-block;padding:12px 24px;background:#006aff;color:#fff;text-decoration:none;border-radius:6px">
    Review &amp; Sign Your Lease
  </a>
</p>
<p>This link is unique to you and expires in 7 days. Do not share it.</p>
<p>Application ID: {{app_id}}</p>
```

The signing URL format:
```
https://choice-properties-site.pages.dev/lease-sign.html?token={{tenant_sign_token}}
```

---

## 8. E-Signing Flow — Complete Sequence

```
Admin generates lease:
  1. Admin fills in lease terms (start date, end date, monthly rent, security deposit, etc.)
  2. Admin clicks "Generate & Send Lease"
  3. serve.js /generate-lease endpoint:
     a. Fetch application data from Supabase (service role)
     b. Fetch active lease template from lease_templates
     c. Build templateVars from application data
     d. Generate PDF using pdfkit
     e. Upload PDF to Supabase Storage (lease-pdfs bucket)
     f. Call generate_lease_tokens(app_id) DB function → creates signing tokens
     g. Send signing email via Nodemailer to tenant (+ co-applicant if applicable)
     h. Return { success: true, app_id }
  4. application.lease_status becomes 'sent'

Tenant signs:
  1. Tenant opens signing URL: /lease-sign.html?token=<token>
  2. Page fetches application data using the token (serve.js /get-lease endpoint)
  3. Page shows full lease text for review
  4. Tenant types legal name, ticks confirmation checkbox, clicks Sign
  5. serve.js /sign-lease endpoint:
     a. Call sign_lease_tenant(token, signature, ip, userAgent) DB function
     b. Regenerate PDF with signature block appended
     c. Re-upload to same storage path (upsert: true)
     d. Send confirmation emails (applicant + admin)
  6. lease_status → 'signed' or 'awaiting_co_sign'

Admin sees status update in /admin/leases.html
```

**Token generation:** `generate_lease_tokens()` DB function uses `gen_random_bytes(32)` → 64 hex chars. This is cryptographically secure. Never generate tokens client-side.

**Token consumption:** After signing, `tenant_sign_token` is set to NULL. A second submission with the same token fails because `WHERE tenant_sign_token = p_token` finds no row.

---

## 9. RLS Conventions

Follow the exact pattern from SETUP.sql. All RLS policies:

1. **Admin all-access:** `FOR ALL USING (is_admin())`
2. **Landlord scoped read:** Always use the double-condition pattern (direct `landlord_id` match OR via `property_id` join through `properties`):
   ```sql
   USING (
     landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
     OR property_id IN (
       SELECT id FROM properties
       WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
     )
   )
   ```
3. **Applicant own-row read:** `USING (applicant_user_id = auth.uid())`
4. **Never allow anonymous INSERT** on sensitive tables — use Edge Functions or serve.js endpoints with service-role key for those writes.

The `is_admin()` function is defined in SETUP.sql as `SECURITY DEFINER`:
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid());
END;
$$;
```

---

## 10. Admin Action Buttons — Pattern

All admin action buttons follow this pattern in the page JS:

```javascript
async function setApplicationStatus(appId, newStatus) {
  const { error } = await CP.sb()
    .from('applications')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('app_id', appId);

  if (error) {
    showToast(`Error: ${error.message}`, 'error');
    return;
  }

  // Log action to admin_actions table
  await CP.sb().from('admin_actions').insert({
    action: `set_status_${newStatus}`,
    target_type: 'application',
    target_id: appId,
    metadata: { new_status: newStatus },
  });

  showToast(`Status updated to ${newStatus}`, 'success');

  // Refresh the displayed card
  refreshApplicationCard(appId);
}
```

**Standard action buttons for each application:**
- **Approve** → `status = 'approved'`
- **Deny** → `status = 'denied'`
- **Shortlist / Waitlist** → `status = 'waitlisted'`
- **Under Review** → `status = 'under_review'`
- **Save Notes** → `admin_notes = <textarea value>`

**Landlord-specific actions** (landlord portal only):
- **Approve** → `status = 'approved'`
- **Decline** → `status = 'denied'`
- **Shortlist** → `status = 'waitlisted'`

**Lease actions** (admin only):
- **Generate & Send Lease** → calls serve.js `/generate-lease`
- **Void Lease** → `lease_status = 'voided'`
- **Confirm Move-In** → `move_in_status = 'confirmed'`, set `move_in_date_actual`

---

## 11. Application Card UI Pattern

Application cards in both the admin panel and landlord portal follow this structure (from applications.html):

```html
<div class="app-card" id="card-${app.app_id}">
  <div class="app-card-top">
    <div>
      <div class="app-id">${app.app_id}</div>
      <div class="app-name">${app.first_name} ${app.last_name}</div>
      <div class="app-contact">${app.email} · ${app.phone}</div>
      <div class="app-badges">
        <span class="badge badge-${app.status}">${app.status}</span>
        <span class="badge badge-${app.lease_status}">Lease: ${app.lease_status}</span>
        <span class="badge badge-${app.payment_status}">Fee: ${app.payment_status}</span>
      </div>
    </div>
    <button onclick="toggleDetail('${app.app_id}')">Details ▼</button>
  </div>

  <div class="app-card-mid">
    <div class="app-meta-item">
      <div class="app-meta-label">Property</div>
      <div>${app.property_address || 'N/A'}</div>
    </div>
    <div class="app-meta-item">
      <div class="app-meta-label">Move-In Requested</div>
      <div>${app.requested_move_in_date || 'N/A'}</div>
    </div>
    <div class="app-meta-item">
      <div class="app-meta-label">Income</div>
      <div>${app.monthly_income || 'N/A'}</div>
    </div>
    <div class="app-meta-item">
      <div class="app-meta-label">Submitted</div>
      <div>${new Date(app.created_at).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="app-actions">
    <button onclick="setApplicationStatus('${app.app_id}', 'approved')">✓ Approve</button>
    <button onclick="setApplicationStatus('${app.app_id}', 'denied')">✕ Deny</button>
    <button onclick="setApplicationStatus('${app.app_id}', 'waitlisted')">★ Shortlist</button>
    <button onclick="setApplicationStatus('${app.app_id}', 'under_review')">⧖ Under Review</button>
  </div>

  <!-- Expandable detail panel -->
  <div class="detail-panel" id="detail-${app.app_id}">
    <!-- Full application detail in grid -->
  </div>
</div>
```

---

## 12. Dashboard Stat Cards Pattern

The GAS admin dashboard shows these stat categories. Match them exactly in the Supabase version:

```javascript
// Call the get_application_stats() DB function
const { data: stats } = await CP.sb().rpc('get_application_stats');

// Stat cards to render:
const cards = [
  { label: 'Total Applications', value: stats.total, color: 'blue' },
  { label: 'Pending Review', value: stats.pending, color: 'yellow' },
  { label: 'Under Review', value: stats.under_review, color: 'orange' },
  { label: 'Approved', value: stats.approved, color: 'green' },
  { label: 'Denied', value: stats.denied, color: 'red' },
  { label: 'Lease Sent', value: stats.lease_sent, color: 'purple' },
  { label: 'Lease Signed', value: stats.lease_signed + stats.lease_co_signed, color: 'teal' },
  { label: 'Move-In Confirmed', value: stats.move_in_confirmed, color: 'green' },
];
```

---

## 13. GAS → Supabase Field Mapping (for Phase 2 CSV Import)

| GAS Sheet Column | Supabase Column | Notes |
|-----------------|-----------------|-------|
| Application ID | app_id | Direct match |
| Timestamp | created_at | Convert to ISO 8601 |
| First Name | first_name | |
| Last Name | last_name | |
| Email | email | |
| Phone | phone | |
| DOB | dob | |
| SSN | ssn | Already masked (last 4) |
| Current Address | current_address | |
| Residency Duration | residency_duration | |
| Current Rent Amount | current_rent_amount | |
| Reason for leaving | reason_for_leaving | |
| Current Landlord Name | current_landlord_name | |
| Landlord Phone | landlord_phone | |
| Previous Address | previous_address | |
| Employment Status | employment_status | |
| Employer | employer | |
| Job Title | job_title | |
| Employment Duration | employment_duration | |
| Supervisor Name | supervisor_name | |
| Supervisor Phone | supervisor_phone | |
| Monthly Income | monthly_income | |
| Other Income | other_income | |
| Has Bankruptcy | has_bankruptcy | Convert 'yes'/'no' to boolean |
| Has Criminal History | has_criminal_history | Convert 'yes'/'no' to boolean |
| Government ID Type | government_id_type | |
| Government ID Number | government_id_number | |
| Reference 1 Name | reference_1_name | |
| Reference 1 Phone | reference_1_phone | |
| Reference 2 Name | reference_2_name | |
| Reference 2 Phone | reference_2_phone | |
| Emergency Contact Name | emergency_contact_name | |
| Emergency Contact Phone | emergency_contact_phone | |
| Primary Payment Method | primary_payment_method | |
| Alternative Payment Method | alternative_payment_method | |
| Has Pets | has_pets | Convert 'yes'/'no' to boolean |
| Pet Details | pet_details | |
| Total Occupants | total_occupants | |
| Ever Evicted | ever_evicted | Convert 'yes'/'no' to boolean |
| Smoker | smoker | Convert 'yes'/'no' to boolean |
| Vehicle Make | vehicle_make | |
| Vehicle Model | vehicle_model | |
| Status | status | Map: 'Approved'→'approved', 'Denied'→'denied', 'Pending'→'pending', etc. |
| Payment Status | payment_status | Map: 'Paid'→'paid', 'Unpaid'→'unpaid' |
| Lease Status | lease_status | Map: 'Sent'→'sent', 'Signed'→'co_signed', 'Active'→'co_signed' |
| Property ID | property_id | Must match existing properties.id |
| Property Address | property_address | |
| Admin Notes | admin_notes | |

---

## 14. Things You Must Never Do

1. **Never create a separate `leases` table** — lease data lives on `applications`. This decision was made deliberately in SETUP.sql and is documented in MIGRATION.md.
2. **Never expose `SUPABASE_SERVICE_KEY` to the browser** — it only goes in serve.js server-side code.
3. **Never modify `GAS-EMAIL-RELAY.gs`** during Phase 1 — GAS is untouched until Phase 2.
4. **Never change the apply form's `BACKEND_URL`** during Phase 1 — it must keep pointing to GAS.
5. **Never use `Express`** — serve.js uses bare `http.createServer`. Add endpoints as route handlers in the existing pattern.
6. **Never auto-approve/deny applications** — all status changes are manual admin or landlord decisions.
7. **Never expose the full `ssn` field** — it's already masked to last 4 by the Edge Function. Display it as stored.
8. **Never reuse a signing token** — call `generate_lease_tokens()` fresh for each send. Old tokens are consumed (set to NULL) after use.
9. **Never create a new Supabase client** in browser code — always use `CP.sb()`.
10. **Never skip the `admin_roles` check** on any admin page — every page must verify admin status.

---

## 15. The GitHub Commit Workflow — Mandatory for Every AI

This rule is stated in MIGRATION.md and repeated here because it is that important.

### After Every Successful Fix or Feature

Push to GitHub immediately. Do not proceed to the next task until the push is confirmed.

**Step 1 — Get the current file SHA** (required by GitHub API for updates):
```javascript
// Example: getting SHA for admin/applications.html
const res = await fetch(
  'https://api.github.com/repos/choice121/Choice/contents/admin/applications.html',
  { headers: { Authorization: 'Bearer YOUR_GITHUB_PAT_HERE' } }
);
const { sha } = await res.json();
```

**Step 2 — Push the updated file**:
```javascript
const content = Buffer.from(fileContents).toString('base64');
await fetch(
  'https://api.github.com/repos/choice121/Choice/contents/admin/applications.html',
  {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer YOUR_GITHUB_PAT_HERE',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: '[Phase 1] Wire admin/applications.html to live Supabase table',
      content,
      sha,  // Required — omitting this causes a 422 error
    }),
  }
);
```

**Step 3 — Confirm the push in your response**:
> "Pushed to GitHub: [Phase 1] Wire admin/applications.html to live Supabase table"

### After Completing a Phase

1. Open `MIGRATION.md` from GitHub (GET request to get latest content + SHA)
2. Update the Phase Tracker table — change the phase status to `Complete` and add a completion date
3. Push the updated `MIGRATION.md` to GitHub
4. Confirm the push in your response before starting the next phase

### Commit Message Format

```
[Phase 0] Description   — for Phase 0 work (running SETUP.sql, verifying DB)
[Phase 1] Description   — for Phase 1 work (admin panel, serve.js endpoints)
[Phase 2] Description   — for Phase 2 work (cutover, CSV import)
[Phase 3] Description   — for Phase 3 work (archiving GAS)
[Docs]    Description   — for documentation updates only
```

### Files That Belong in GitHub

All files you create or modify go to `choice121/Choice` repo EXCEPT:
- The apply form repo (`apply-choice-properties (separate project, no connection to this repo)`) — only touched in Phase 2

### If a Push Fails

Do not continue. Diagnose the failure (wrong SHA, bad token, conflict) and retry. A failed push means the next AI will not have your work.
