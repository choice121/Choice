const http = require('http');
  const fs = require('fs');
  const path = require('path');
  const { createClient } = require('@supabase/supabase-js');

  const PORT = process.env.PORT || 5000;
  const HOST = '0.0.0.0';
  const ROOT = __dirname;

  // ─── Supabase admin client (service role — server-side only) ───────────────
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || ''
  );

  // ─── MIME types ───────────────────────────────────────────────────────────
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml':  'application/xml; charset=utf-8',
    '.txt':  'text/plain; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.eot':  'application/vnd.ms-fontobject',
    '.webmanifest': 'application/manifest+json',
    '.pdf':  'application/pdf',
  };

  function serveFile(res, filePath) {
    fs.readFile(filePath, function(err, data) {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  }

  // ─── CORS headers (lease-sign.html is served from same origin; just in case) ─
  function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // ─── Auth helper — verifies Bearer token and checks admin_roles ───────────
  async function verifyAdmin(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return { ok: false, status: 401, error: 'Missing authorization header' };

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return { ok: false, status: 401, error: 'Invalid or expired token' };

    const { data: adminRole } = await supabaseAdmin
      .from('admin_roles').select('id').eq('user_id', user.id).single();
    if (!adminRole) return { ok: false, status: 403, error: 'Not an admin' };

    return { ok: true, user };
  }

  // ─── Read full request body as string ─────────────────────────────────────
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  function jsonError(res, status, message) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  function jsonOk(res, data) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // ─── PDF generation (pdfkit) ──────────────────────────────────────────────
  function substituteLeaseVariables(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return (vars[key] !== undefined && vars[key] !== null) ? String(vars[key]) : '';
    });
  }

  async function generateLeasePDF(app, templateText) {
    const PDFDocument = require('pdfkit');
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 72, size: 'LETTER' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const vars = {
        tenant_full_name:   ((app.first_name || '') + ' ' + (app.last_name || '')).trim(),
        tenant_email:       app.email || '',
        tenant_phone:       app.phone || '',
        property_address:   app.property_address || '',
        lease_start_date:   app.lease_start_date ? new Date(app.lease_start_date).toLocaleDateString('en-US') : '',
        lease_end_date:     app.lease_end_date   ? new Date(app.lease_end_date).toLocaleDateString('en-US')   : '',
        monthly_rent:       app.monthly_rent     ? '$' + Number(app.monthly_rent).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '',
        security_deposit:   app.security_deposit ? '$' + Number(app.security_deposit).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '',
        move_in_costs:      app.move_in_costs    ? '$' + Number(app.move_in_costs).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '',
        landlord_name:      app.lease_landlord_name    || 'Choice Properties',
        landlord_address:   app.lease_landlord_address || '2265 Livernois Suite 500, Troy MI 48083',
        late_fee_flat:      app.lease_late_fee_flat    ? '$' + Number(app.lease_late_fee_flat).toLocaleString('en-US') : '',
        late_fee_daily:     app.lease_late_fee_daily   ? '$' + Number(app.lease_late_fee_daily).toLocaleString('en-US') : '',
        state_code:         app.lease_state_code       || 'MI',
        pets_policy:        app.lease_pets_policy      || (app.has_pets ? 'Pets allowed per application.' : 'No pets allowed.'),
        smoking_policy:     app.lease_smoking_policy   || 'No smoking permitted on premises.',
        desired_lease_term: app.desired_lease_term     || '',
        app_id:             app.app_id || app.id || '',
        signature_date:     app.signature_timestamp ? new Date(app.signature_timestamp).toLocaleDateString('en-US') : '',
        tenant_signature:   app.tenant_signature    || '',
      };

      const rendered = substituteLeaseVariables(templateText, vars);

      doc.fontSize(16).font('Helvetica-Bold')
         .text('RESIDENTIAL LEASE AGREEMENT', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#555')
         .text('Choice Properties  ·  2265 Livernois Suite 500, Troy MI 48083  ·  choicepropertygroup@hotmail.com', { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(11).font('Helvetica').fillColor('#000').text(rendered, { align: 'left', lineGap: 4 });

      if (app.tenant_signature) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('SIGNATURES', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica');
        doc.text('Tenant Signature (Electronically Signed):');
        doc.moveDown(0.3);
        doc.fontSize(13).font('Helvetica-Oblique').text(app.tenant_signature);
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');
        doc.text('Date: ' + (app.signature_timestamp ? new Date(app.signature_timestamp).toLocaleString('en-US') : ''));
        if (app.lease_ip_address) doc.text('IP Address: ' + app.lease_ip_address);
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor('#666').text('This document was electronically signed via the Choice Properties tenant portal. The signature above constitutes a legally binding electronic signature.');
      }

      doc.end();
    });
  }

  // ─── Nodemailer setup ─────────────────────────────────────────────────────
  function createTransporter() {
    const nodemailer = require('nodemailer');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  async function sendEmail({ to, subject, html, attachments }) {
    const transporter = createTransporter();
    return transporter.sendMail({
      from: `"Choice Properties" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      attachments: attachments || [],
    });
  }

  // ─── /generate-lease ─────────────────────────────────────────────────────
  // POST — admin only. Accepts lease term data, generates PDF, uploads to
  // Supabase Storage, calls generate_lease_tokens(), sends signing email.
  // Body: { app_id: string, lease_data: { lease_start_date, lease_end_date, monthly_rent,
  //         security_deposit, move_in_costs, lease_notes, lease_landlord_name,
  //         lease_landlord_address, lease_late_fee_flat, lease_late_fee_daily,
  //         lease_state_code, lease_pets_policy, lease_smoking_policy } }
  async function handleGenerateLease(req, res) {
    setCORS(res);
    const auth = await verifyAdmin(req);
    if (!auth.ok) return jsonError(res, auth.status, auth.error);

    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return jsonError(res, 400, 'Invalid JSON body'); }

    const { app_id, lease_data = {} } = body;
    if (!app_id) return jsonError(res, 400, 'Missing app_id');

    // 1. Fetch the application
    const { data: app, error: appErr } = await supabaseAdmin
      .from('applications').select('*').eq('app_id', app_id).single();
    if (appErr || !app) return jsonError(res, 404, 'Application not found: ' + (appErr?.message || ''));

    // 2. Merge lease_data fields into the app object (admin-provided overrides)
    const mergedApp = { ...app, ...lease_data };

    // 3. Fetch active lease template
    const { data: tmpl, error: tmplErr } = await supabaseAdmin
      .from('lease_templates').select('*').eq('is_active', true).single();
    if (tmplErr || !tmpl) return jsonError(res, 500, 'No active lease template found. Please add one in the database.');

    // 4. Update application with lease terms before generating
    const leaseFields = {
      lease_start_date:      lease_data.lease_start_date      || app.lease_start_date,
      lease_end_date:        lease_data.lease_end_date        || app.lease_end_date,
      monthly_rent:          lease_data.monthly_rent          || app.monthly_rent,
      security_deposit:      lease_data.security_deposit      || app.security_deposit,
      move_in_costs:         lease_data.move_in_costs         || app.move_in_costs,
      lease_notes:           lease_data.lease_notes           || app.lease_notes,
      lease_landlord_name:   lease_data.lease_landlord_name   || app.lease_landlord_name   || 'Choice Properties',
      lease_landlord_address:lease_data.lease_landlord_address|| app.lease_landlord_address|| '2265 Livernois Suite 500, Troy MI 48083',
      lease_late_fee_flat:   lease_data.lease_late_fee_flat   || app.lease_late_fee_flat,
      lease_late_fee_daily:  lease_data.lease_late_fee_daily  || app.lease_late_fee_daily,
      lease_state_code:      lease_data.lease_state_code      || app.lease_state_code      || 'MI',
      lease_pets_policy:     lease_data.lease_pets_policy     || app.lease_pets_policy,
      lease_smoking_policy:  lease_data.lease_smoking_policy  || app.lease_smoking_policy,
      updated_at: new Date().toISOString(),
    };
    await supabaseAdmin.from('applications').update(leaseFields).eq('app_id', app_id);

    // 5. Generate PDF
    let pdfBuffer;
    try { pdfBuffer = await generateLeasePDF(mergedApp, tmpl.template_body); }
    catch (e) { return jsonError(res, 500, 'PDF generation failed: ' + e.message); }

    // 6. Upload PDF to Supabase Storage
    const storagePath = app_id + '/lease_' + Date.now() + '.pdf';
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('lease-pdfs')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) return jsonError(res, 500, 'PDF upload failed: ' + uploadErr.message);

    // 7. Update applications.lease_pdf_url
    await supabaseAdmin.from('applications')
      .update({ lease_pdf_url: storagePath, updated_at: new Date().toISOString() })
      .eq('app_id', app_id);

    // 8. Call generate_lease_tokens() to create signing tokens + set lease_status = 'sent'
    const { data: tokenData, error: tokenErr } = await supabaseAdmin
      .rpc('generate_lease_tokens', { p_app_id: app_id });
    if (tokenErr) return jsonError(res, 500, 'Token generation failed: ' + tokenErr.message);

    // 9. Re-fetch app with tokens
    const { data: updatedApp } = await supabaseAdmin
      .from('applications').select('*').eq('app_id', app_id).single();

    // 10. Send signing email
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && updatedApp?.email) {
      const signingUrl = 'https://choice-properties-site.pages.dev/lease-sign.html?token=' + (updatedApp.tenant_sign_token || '');
      const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#006aff;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Your Lease is Ready to Sign</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${updatedApp.first_name || 'Applicant'},</p>
      <p style="color:#4a5568;font-size:14px">Your lease agreement for <strong>${updatedApp.property_address || 'your property'}</strong> is ready for review and signature.</p>
      <div style="margin:24px 0;text-align:center">
        <a href="${signingUrl}" style="display:inline-block;padding:14px 32px;background:#006aff;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
          Review &amp; Sign Your Lease
        </a>
      </div>
      <p style="color:#718096;font-size:13px">This link is unique to you and expires in 7 days. Do not share it with anyone.</p>
      <p style="color:#718096;font-size:13px">Application ID: <strong>${app_id}</strong></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083 · choicepropertygroup@hotmail.com · 707-706-3137</p>
    </div>
  </div>`;
      try {
        await sendEmail({ to: updatedApp.email, subject: 'Your Lease Agreement is Ready — Choice Properties', html: emailHtml });
      } catch (emailErr) {
        console.error('Signing email failed (non-fatal):', emailErr.message);
      }
    }

    jsonOk(res, { success: true, app_id, storage_path: storagePath, lease_status: 'sent' });
  }

  // ─── /get-lease ───────────────────────────────────────────────────────────
  // GET — public. Used by lease-sign.html to fetch application data by token.
  // Query: ?token=<tenant_sign_token>
  async function handleGetLease(req, res) {
    setCORS(res);
    const urlObj = new URL(req.url, 'http://localhost');
    const token = urlObj.searchParams.get('token');
    if (!token) return jsonError(res, 400, 'Missing token');

    const { data: app, error } = await supabaseAdmin
      .from('applications')
      .select('app_id,first_name,last_name,email,property_address,property_name,' +
              'lease_start_date,lease_end_date,monthly_rent,security_deposit,move_in_costs,' +
              'lease_notes,lease_status,lease_pdf_url,tenant_sign_token,' +
              'lease_landlord_name,lease_landlord_address,lease_late_fee_flat,lease_late_fee_daily,' +
              'lease_state_code,lease_pets_policy,lease_smoking_policy,desired_lease_term,' +
              'signature_timestamp,tenant_signature,has_co_applicant')
      .eq('tenant_sign_token', token)
      .single();

    if (error || !app) return jsonError(res, 404, 'Lease not found or signing link has expired.');
    if (app.lease_status === 'signed' || app.lease_status === 'co_signed' || app.signature_timestamp) {
      return jsonError(res, 410, 'This lease has already been signed.');
    }

    // Fetch active lease template for display
    const { data: tmpl } = await supabaseAdmin
      .from('lease_templates').select('template_body').eq('is_active', true).single();

    jsonOk(res, { app, template_body: tmpl?.template_body || '' });
  }

  // ─── /sign-lease ──────────────────────────────────────────────────────────
  // POST — public. Called by lease-sign.html on tenant signature.
  // Body: { token, signature, user_agent }
  async function handleSignLease(req, res) {
    setCORS(res);
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return jsonError(res, 400, 'Invalid JSON body'); }

    const { token, signature, user_agent } = body;
    if (!token)     return jsonError(res, 400, 'Missing token');
    if (!signature) return jsonError(res, 400, 'Missing signature');

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    // Call sign_lease_tenant RPC
    const { data, error } = await supabaseAdmin.rpc('sign_lease_tenant', {
      p_token:      token,
      p_signature:  signature,
      p_ip:         ip,
      p_user_agent: user_agent || '',
    });

    if (error) return jsonError(res, 400, error.message || 'Signing failed. The link may have expired.');

    // Fetch updated app to regenerate PDF with signature
    const { data: app } = await supabaseAdmin
      .from('applications').select('*').eq('tenant_sign_token', null).eq('tenant_signature', signature).order('updated_at', { ascending: false }).limit(1).single();

    // Also find by signature (since token was just nulled)
    const { data: appSigned } = await supabaseAdmin
      .from('applications').select('*').eq('tenant_signature', signature).order('updated_at', { ascending: false }).limit(1).single();

    if (appSigned) {
      // Regenerate PDF with signature block
      const { data: tmpl } = await supabaseAdmin.from('lease_templates').select('*').eq('is_active', true).single();
      if (tmpl && appSigned.lease_pdf_url) {
        try {
          const pdfBuffer = await generateLeasePDF(appSigned, tmpl.template_body);
          await supabaseAdmin.storage.from('lease-pdfs').upload(appSigned.lease_pdf_url, pdfBuffer, { contentType: 'application/pdf', upsert: true });
        } catch (e) { console.error('PDF re-generation failed (non-fatal):', e.message); }
      }

      // Send confirmation emails
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        const confirmHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#16a34a;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Lease Signed Successfully</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${appSigned.first_name || 'Applicant'},</p>
      <p style="color:#4a5568;font-size:14px">Your lease for <strong>${appSigned.property_address || 'your property'}</strong> has been signed successfully.</p>
      <p style="color:#718096;font-size:13px">Signed: ${new Date().toLocaleString('en-US')}</p>
      <p style="color:#718096;font-size:13px">Application ID: <strong>${appSigned.app_id}</strong></p>
      <p style="color:#4a5568;font-size:14px">Our team will be in touch regarding your move-in date. If you have any questions, reply to this email or call 707-706-3137.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083</p>
    </div>
  </div>`;
        try {
          await sendEmail({ to: appSigned.email, subject: 'Lease Signed — Choice Properties', html: confirmHtml });
        } catch (e) { console.error('Confirmation email (tenant) failed:', e.message); }

        // Notify admin
        if (process.env.ADMIN_EMAIL) {
          const adminHtml = `<p><strong>Lease signed</strong> by ${appSigned.first_name} ${appSigned.last_name} (${appSigned.email})</p>
  <p>Application: ${appSigned.app_id}<br>Property: ${appSigned.property_address}<br>Signed: ${new Date().toLocaleString('en-US')}</p>
  <p><a href="https://choice-properties-site.pages.dev/admin/leases.html">View in Admin Panel →</a></p>`;
          try {
            await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `[Lease Signed] ${appSigned.first_name} ${appSigned.last_name} — ${appSigned.app_id}`, html: adminHtml });
          } catch (e) { console.error('Admin notification email failed:', e.message); }
        }
      }
    }

    jsonOk(res, { success: true, message: 'Lease signed successfully.' });
  }

  // ─── /send-email ──────────────────────────────────────────────────────────
  // POST — admin only. General email sender for approval/denial/move-in notices.
  // Body: { app_id, type: 'approved'|'denied'|'movein_confirmed'|'custom', message?: string }
  async function handleSendEmail(req, res) {
    setCORS(res);
    const auth = await verifyAdmin(req);
    if (!auth.ok) return jsonError(res, auth.status, auth.error);

    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return jsonError(res, 400, 'Invalid JSON body'); }

    const { app_id, type, message } = body;
    if (!app_id || !type) return jsonError(res, 400, 'Missing app_id or type');

    const { data: app, error: appErr } = await supabaseAdmin
      .from('applications').select('*').eq('app_id', app_id).single();
    if (appErr || !app) return jsonError(res, 404, 'Application not found');

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return jsonError(res, 500, 'Email not configured — set GMAIL_USER and GMAIL_APP_PASSWORD env vars');
    }

    const name = (app.first_name || 'Applicant');
    const prop = app.property_address || 'your property';

    const templates = {
      approved: {
        subject: 'Your Application Has Been Approved — Choice Properties',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#16a34a;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Application Approved</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${name},</p>
      <p style="color:#4a5568;font-size:14px">Congratulations! Your application for <strong>${prop}</strong> has been approved.</p>
      <p style="color:#4a5568;font-size:14px">Our team will be in touch shortly regarding your lease agreement. If you have questions, reply to this email or call us at 707-706-3137.</p>
      ${message ? `<p style="color:#4a5568;font-size:14px;background:#fff;padding:14px;border-radius:6px;border:1px solid #e2e8f0">${message}</p>` : ''}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083 · choicepropertygroup@hotmail.com · 707-706-3137</p>
    </div>
  </div>`,
      },
      denied: {
        subject: 'Update on Your Application — Choice Properties',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#374151;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Application Status Update</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${name},</p>
      <p style="color:#4a5568;font-size:14px">Thank you for applying to <strong>${prop}</strong>. After careful review, we are unable to move forward with your application at this time.</p>
      ${message ? `<p style="color:#4a5568;font-size:14px;background:#fff;padding:14px;border-radius:6px;border:1px solid #e2e8f0">${message}</p>` : ''}
      <p style="color:#4a5568;font-size:14px">We appreciate your interest in Choice Properties and wish you the best in your housing search.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083 · choicepropertygroup@hotmail.com · 707-706-3137</p>
    </div>
  </div>`,
      },
      movein_confirmed: {
        subject: 'Move-In Confirmed — Choice Properties',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#006aff;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Move-In Confirmed</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${name},</p>
      <p style="color:#4a5568;font-size:14px">Your move-in to <strong>${prop}</strong> has been confirmed.</p>
      ${app.move_in_date_actual ? `<p style="color:#4a5568;font-size:14px">Move-in Date: <strong>${new Date(app.move_in_date_actual).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>` : ''}
      ${message ? `<p style="color:#4a5568;font-size:14px;background:#fff;padding:14px;border-radius:6px;border:1px solid #e2e8f0">${message}</p>` : ''}
      <p style="color:#4a5568;font-size:14px">Please contact us at 707-706-3137 if you need assistance.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083 · choicepropertygroup@hotmail.com · 707-706-3137</p>
    </div>
  </div>`,
      },
    };

    const tmpl = templates[type];
    const subject = tmpl?.subject || 'Message from Choice Properties';
    const html = tmpl?.html || `<p>Dear ${name},</p><p>${message || ''}</p><p>— Choice Properties</p>`;

    try {
      await sendEmail({ to: app.email, subject, html });
      // Log to email_logs
      await supabaseAdmin.from('email_logs').insert({
        recipient_email: app.email,
        subject,
        type,
        related_id: app.id,
        sent_at: new Date().toISOString(),
      }).catch(() => {});
      jsonOk(res, { success: true, to: app.email });
    } catch (e) {
      jsonError(res, 500, 'Email send failed: ' + e.message);
    }
  }

  // ─── /download-lease ──────────────────────────────────────────────────────
  // GET — admin only. Creates a signed URL for a lease PDF.
  // Query: ?app_id=<app_id>
  async function handleDownloadLease(req, res) {
    setCORS(res);
    const auth = await verifyAdmin(req);
    if (!auth.ok) return jsonError(res, auth.status, auth.error);

    const urlObj = new URL(req.url, 'http://localhost');
    const app_id = urlObj.searchParams.get('app_id');
    if (!app_id) return jsonError(res, 400, 'Missing app_id');

    const { data: app, error } = await supabaseAdmin
      .from('applications').select('lease_pdf_url').eq('app_id', app_id).single();
    if (error || !app?.lease_pdf_url) return jsonError(res, 404, 'Lease PDF not found');

    const { data: signedData, error: signErr } = await supabaseAdmin.storage
      .from('lease-pdfs').createSignedUrl(app.lease_pdf_url, 3600);
    if (signErr) return jsonError(res, 500, 'Could not generate download link: ' + signErr.message);

    jsonOk(res, { signed_url: signedData.signedUrl });
  }

  // ─── Static file server ───────────────────────────────────────────────────
  const server = http.createServer(function(req, res) {
    let urlPath = req.url.split('?')[0];

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      setCORS(res);
      res.writeHead(204);
      res.end();
      return;
    }

    // ── API endpoints ──────────────────────────────────────────────────────
    if (urlPath === '/generate-lease' && req.method === 'POST') {
      handleGenerateLease(req, res).catch(e => jsonError(res, 500, e.message));
      return;
    }

    if (urlPath === '/get-lease' && req.method === 'GET') {
      handleGetLease(req, res).catch(e => jsonError(res, 500, e.message));
      return;
    }

    if (urlPath === '/sign-lease' && req.method === 'POST') {
      handleSignLease(req, res).catch(e => jsonError(res, 500, e.message));
      return;
    }

    if (urlPath === '/send-email' && req.method === 'POST') {
      handleSendEmail(req, res).catch(e => jsonError(res, 500, e.message));
      return;
    }

    if (urlPath === '/download-lease' && req.method === 'GET') {
      handleDownloadLease(req, res).catch(e => jsonError(res, 500, e.message));
      return;
    }

    // ── Static file serving ───────────────────────────────────────────────
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    let filePath = path.join(ROOT, urlPath);

    fs.stat(filePath, function(err, stat) {
      if (!err && stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        serveFile(res, filePath);
      } else if (!err && stat.isFile()) {
        serveFile(res, filePath);
      } else {
        const withHtml = filePath + '.html';
        fs.stat(withHtml, function(err2, stat2) {
          if (!err2 && stat2.isFile()) {
            serveFile(res, withHtml);
          } else {
            serveFile(res, path.join(ROOT, '404.html'));
          }
        });
      }
    });
  });

  server.listen(PORT, HOST, function() {
    console.log('Choice Properties server running at http://' + HOST + ':' + PORT);
  });
  