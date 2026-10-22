/**
 * Choice Properties — AI Rental Inquiry Assistant Admin Module
 */

(function () {
  'use strict';

  // State
  let currentCustomer = null;
  let activeDraft = null;
  let detectedUpdates = null;
  let activeProperties = [];

  // DOM Elements
  const searchInput = document.getElementById('cust-search-input');
  const searchBtn = document.getElementById('cust-search-btn');
  const newCustBtn = document.getElementById('btn-new-cust');
  const viewPoliciesBtn = document.getElementById('btn-view-policies');
  const backupRestoreBtn = document.getElementById('btn-backup-restore');
  const collisionAlert = document.getElementById('collision-alert');
  const collisionMsg = document.getElementById('collision-msg');
  const collisionActions = document.getElementById('collision-actions');

  // Profile DOM
  const pName = document.getElementById('p-name');
  const pIdBadge = document.getElementById('p-id-badge');
  const pActivity = document.getElementById('p-activity');
  const pEditBtn = document.getElementById('btn-edit-profile');
  const pSpecsSec = document.getElementById('p-specs-section');
  const pStatusSec = document.getElementById('p-status-section');
  const pNotesSec = document.getElementById('p-notes-section');
  const pEmptyState = document.getElementById('p-empty-state');
  const pCity = document.getElementById('p-city');
  const pBedsBaths = document.getElementById('p-beds-baths');
  const pBudget = document.getElementById('p-budget');
  const pMovein = document.getElementById('p-movein');
  const pType = document.getElementById('p-type');
  const pPets = document.getElementById('p-pets');
  const pAppStatus = document.getElementById('p-app-status');
  const pFeeStatus = document.getElementById('p-fee-status');
  const pQualBox = document.getElementById('p-qual-box');
  const pQualText = document.getElementById('p-qual-text');
  const pNotesList = document.getElementById('p-notes-list');
  const newNoteInput = document.getElementById('new-note-input');
  const addNoteBtn = document.getElementById('btn-add-note');
  const recentList = document.getElementById('recent-customers-list');

  // Generator DOM
  const msgInput = document.getElementById('incoming-message-input');
  const generateBtn = document.getElementById('btn-generate-ai');
  const modelTag = document.getElementById('ai-model-tag');
  const draftSlot = document.getElementById('draft-output-slot');
  const draftText = document.getElementById('draft-response-text');
  const draftCount = document.getElementById('draft-char-count');
  const copyBtn = document.getElementById('btn-copy-draft');
  const markSentBtn = document.getElementById('btn-mark-sent');
  const saveDraftBtn = document.getElementById('btn-save-draft');
  const copyStatus = document.getElementById('copy-status');
  const detectedBanner = document.getElementById('detected-updates-banner');
  const detectedText = document.getElementById('detected-updates-text');
  const applyDetectedBtn = document.getElementById('btn-apply-detected');
  const propMatcherSelect = document.getElementById('property-matcher-select');
  const chatContainer = document.getElementById('chat-messages-container');
  const addManualIncomingBtn = document.getElementById('btn-add-incoming-manual');

  // Modals
  const modalCust = document.getElementById('modal-customer');
  const formCust = document.getElementById('form-customer');
  const modalCustTitle = document.getElementById('modal-cust-title');
  const modalPolicies = document.getElementById('modal-policies');
  const formPolicies = document.getElementById('form-policies');
  const modalBackup = document.getElementById('modal-backup');
  const exportDownloadBtn = document.getElementById('btn-export-download');
  const importUploadBtn = document.getElementById('btn-import-upload');
  const importFileInput = document.getElementById('import-file-input');

  // Initial Load
  init();

  async function init() {
    setupEventListeners();
    await loadRecentCustomers();
    await loadActiveProperties();
  }

  function setupEventListeners() {
    searchBtn.addEventListener('click', () => performLookup(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performLookup(searchInput.value);
    });

    newCustBtn.addEventListener('click', () => openCustomerModal(null));
    pEditBtn.addEventListener('click', () => openCustomerModal(currentCustomer));

    addNoteBtn.addEventListener('click', handleAddNote);
    newNoteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddNote();
    });

    generateBtn.addEventListener('click', handleGenerateReply);
    copyBtn.addEventListener('click', handleCopyDraft);
    markSentBtn.addEventListener('click', handleMarkSent);
    saveDraftBtn.addEventListener('click', handleSaveDraft);
    applyDetectedBtn.addEventListener('click', handleApplyDetectedUpdates);

    addManualIncomingBtn.addEventListener('click', handleAddManualIncoming);

    viewPoliciesBtn.addEventListener('click', openPoliciesModal);
    formPolicies.addEventListener('submit', handleSavePolicies);

    backupRestoreBtn.addEventListener('click', () => modalBackup.classList.add('active'));
    exportDownloadBtn.addEventListener('click', handleExportDownload);
    importUploadBtn.addEventListener('click', handleImportUpload);

    // Prompt shortcut chips
    document.querySelectorAll('.as-action-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        msgInput.value = chip.getAttribute('data-prompt');
        msgInput.focus();
      });
    });

    // Property matcher dropdown
    propMatcherSelect.addEventListener('change', () => {
      const val = propMatcherSelect.value;
      if (!val) return;
      msgInput.value += (msgInput.value ? '\n\n' : '') + val;
      propMatcherSelect.value = '';
    });

    // Form Customer Submit
    formCust.addEventListener('submit', handleSaveCustomerForm);
  }

  async function loadRecentCustomers() {
    try {
      const res = await fetch('/api/assistant/customers');
      const data = await res.json();
      if (data.ok && data.customers) {
        renderRecentList(data.customers);
      }
    } catch (e) {
      recentList.innerHTML = '<div style="font-size:0.8rem;color:var(--muted)">Failed to load directory.</div>';
    }
  }

  function renderRecentList(customers) {
    if (!customers || customers.length === 0) {
      recentList.innerHTML = '<div style="font-size:0.8rem;color:var(--muted)">No customer records yet.</div>';
      return;
    }

    recentList.innerHTML = customers.slice(0, 8).map(c => {
      const name = c.alias || c.full_name || 'Customer';
      const idStr = c.phone_last4 ? `#${c.phone_last4}` : 'ID';
      const city = c.target_city || 'Location unset';
      const budget = c.max_budget ? `$${c.max_budget.toLocaleString()}` : '';
      return `
        <div class="as-recent-item" data-id="${c.id}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface-2);border-radius:6px;cursor:pointer;transition:all 0.15s">
          <div>
            <span style="font-weight:700;font-size:0.85rem;color:var(--text)">${name}</span>
            <span class="as-id-badge" style="margin-left:6px;font-size:0.7rem">${idStr}</span>
            <div style="font-size:0.75rem;color:var(--muted)">${city} ${budget ? '• ' + budget : ''}</div>
          </div>
          <svg class="i i-sm" style="color:var(--muted)"><use href="#i-arrow"/></svg>
        </div>
      `;
    }).join('');

    recentList.querySelectorAll('.as-recent-item').forEach(el => {
      el.addEventListener('click', () => loadCustomerById(el.getAttribute('data-id')));
    });
  }

  async function loadActiveProperties() {
    try {
      const res = await fetch('/api/assistant/active-properties');
      const data = await res.json();
      if (data.ok && data.properties) {
        activeProperties = data.properties;
        propMatcherSelect.innerHTML = '<option value="">Insert Verified Listing Link...</option>' +
          activeProperties.map(p => {
            const label = `${p.address || p.title} (${p.bedrooms}b/${p.bathrooms}ba • $${p.price})`;
            const link = `https://choice-properties-site.pages.dev/property.html?id=${p.id}`;
            return `<option value="${link}">${label}</option>`;
          }).join('');
      }
    } catch (e) {}
  }

  async function performLookup(query) {
    if (!query || !query.trim()) return;
    const clean = query.trim();

    collisionAlert.classList.remove('active');

    try {
      const res = await fetch('/api/assistant/customers/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: clean })
      });
      const data = await res.json();

      if (data.collision) {
        // Collision detected!
        renderCollisionAlert(data.phone_last4, data.matches);
        return;
      }

      if (data.found && data.customer) {
        renderCustomerProfile(data.customer);
      } else {
        // Offer to create
        if (confirm(`No profile found for "${clean}". Would you like to create a new customer profile?`)) {
          const isDigits = /^\d{4}$/.test(clean);
          openCustomerModal({
            phone_last4: isDigits ? clean : '',
            alias: !isDigits ? clean : ''
          });
        }
      }
    } catch (e) {
      alert('Error looking up customer: ' + e.message);
    }
  }

  function renderCollisionAlert(last4, matches) {
    collisionAlert.classList.add('active');
    collisionMsg.innerHTML = `Found <strong>${matches.length}</strong> different customer profiles sharing 4-digit identifier <strong>#${last4}</strong>. Disambiguate below:`;
    
    collisionActions.innerHTML = matches.map(m => `
      <button class="as-btn as-btn-sm as-btn-brand btn-pick-match" data-id="${m.id}">
        ${m.alias || m.full_name || 'Customer'} (${m.target_city || 'City unset'})
      </button>
    `).join('') + `
      <button class="as-btn as-btn-sm btn-link-all" style="background:#ef4444;color:#fff">
        Link Both as Same Person
      </button>
    `;

    collisionActions.querySelectorAll('.btn-pick-match').forEach(btn => {
      btn.addEventListener('click', () => {
        collisionAlert.classList.remove('active');
        loadCustomerById(btn.getAttribute('data-id'));
      });
    });

    const linkAllBtn = collisionActions.querySelector('.btn-link-all');
    if (linkAllBtn && matches.length >= 2) {
      linkAllBtn.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to merge these ${matches.length} records into one profile?`)) {
          const primaryId = matches[0].id;
          const secondaryId = matches[1].id;
          const res = await fetch('/api/assistant/customers/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ primaryId, secondaryId })
          });
          const d = await res.json();
          if (d.ok) {
            collisionAlert.classList.remove('active');
            renderCustomerProfile(d.customer);
            loadRecentCustomers();
          }
        }
      });
    }
  }

  async function loadCustomerById(id) {
    try {
      const res = await fetch(`/api/assistant/customers/${id}`);
      const data = await res.json();
      if (data.ok && data.customer) {
        renderCustomerProfile(data.customer);
      }
    } catch (e) {
      alert('Failed to load customer: ' + e.message);
    }
  }

  function renderCustomerProfile(cust) {
    currentCustomer = cust;

    pEmptyState.style.display = 'none';
    pSpecsSec.style.display = 'block';
    pStatusSec.style.display = 'block';
    pNotesSec.style.display = 'block';
    pEditBtn.style.display = 'inline-flex';

    pName.textContent = cust.alias || cust.full_name || 'Customer Profile';
    pIdBadge.textContent = cust.phone_last4 ? `#${cust.phone_last4}` : 'NO LAST-4';
    pActivity.textContent = `Last active ${new Date(cust.last_activity_at || cust.created_at).toLocaleString()}`;

    // Specs
    pCity.textContent = cust.target_city || '—';
    const beds = cust.target_beds != null ? `${cust.target_beds} Beds` : '';
    const baths = cust.target_baths != null ? `${cust.target_baths} Baths` : '';
    pBedsBaths.textContent = (beds && baths) ? `${beds} / ${baths}` : (beds || baths || '—');
    pBudget.textContent = cust.max_budget ? `$${cust.max_budget.toLocaleString()}/mo` : '—';
    pMovein.textContent = cust.move_in_date || '—';
    pType.textContent = (cust.property_type || 'single_family').replace('_', ' ').toUpperCase();
    pPets.textContent = cust.has_pets ? 'Yes (Dogs/Cats)' : 'No';

    // Status
    const statusMap = {
      not_started: { label: 'App: Not Started', cls: 'pill-muted' },
      submitted: { label: 'App: Submitted', cls: 'pill-info' },
      fee_pending: { label: 'App: Fee Pending', cls: 'pill-warning' },
      in_review: { label: 'App: In Review (24–72h)', cls: 'pill-info' },
      approved: { label: 'App: Approved', cls: 'pill-success' },
      denied: { label: 'App: Denied (7-Day Reapply)', cls: 'pill-danger' }
    };
    const sInfo = statusMap[cust.application_status] || { label: cust.application_status, cls: 'pill-muted' };
    pAppStatus.textContent = sInfo.label;
    pAppStatus.className = `pill ${sInfo.cls}`;

    const feeMap = {
      not_confirmed: { label: 'Fee: Not Confirmed', cls: 'pill-muted' },
      paid: { label: 'Fee: $50 Paid', cls: 'pill-success' },
      unpaid: { label: 'Fee: $50 Unpaid', cls: 'pill-warning' }
    };
    const fInfo = feeMap[cust.application_fee_status] || { label: 'Fee: $50 Pending', cls: 'pill-warning' };
    pFeeStatus.textContent = fInfo.label;
    pFeeStatus.className = `pill ${fInfo.cls}`;

    // Qualification notes
    const quals = [];
    if (cust.credit_concerns) quals.push(`Credit: ${cust.credit_concerns}`);
    if (cust.eviction_history) quals.push(`Eviction: ${cust.eviction_history}`);
    if (cust.income_notes) quals.push(`Income: ${cust.income_notes}`);
    if (quals.length > 0) {
      pQualBox.style.display = 'block';
      pQualText.innerHTML = quals.map(q => `<div>• ${escapeHtml(q)}</div>`).join('');
    } else {
      pQualBox.style.display = 'none';
    }

    // Notes
    renderNotesList(cust.notes || []);

    // Conversation feed
    renderMessagesFeed(cust.messages || []);

    // Filter properties dropdown by customer city if set
    if (cust.target_city) {
      const cityFiltered = activeProperties.filter(p => (p.city || '').toLowerCase().includes(cust.target_city.toLowerCase()));
      if (cityFiltered.length > 0) {
        propMatcherSelect.innerHTML = `<option value="">Available Homes in ${cust.target_city} (${cityFiltered.length})...</option>` +
          cityFiltered.map(p => {
            const label = `${p.address} (${p.bedrooms}b/${p.bathrooms}ba • $${p.price})`;
            const link = `https://choice-properties-site.pages.dev/property.html?id=${p.id}`;
            return `<option value="${link}">${label}</option>`;
          }).join('');
      }
    }
  }

  function renderNotesList(notes) {
    if (!notes || notes.length === 0) {
      pNotesList.innerHTML = '<div style="font-size:0.78rem;color:var(--muted)">No private staff notes yet.</div>';
      return;
    }

    pNotesList.innerHTML = notes.map(n => `
      <div style="background:var(--surface-2);border-radius:6px;padding:6px 10px;font-size:0.8rem;display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div>
          <span style="color:#e2e8f0">${escapeHtml(n.note_text)}</span>
          <div style="font-size:0.68rem;color:var(--muted-2);margin-top:2px">${n.author || 'Staff'} • ${new Date(n.created_at).toLocaleDateString()}</div>
        </div>
        <button class="btn-del-note" data-id="${n.id}" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px">
          <svg class="i i-sm"><use href="#i-x"/></svg>
        </button>
      </div>
    `).join('');

    pNotesList.querySelectorAll('.btn-del-note').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteNote(btn.getAttribute('data-id')));
    });
  }

  function renderMessagesFeed(messages) {
    if (!messages || messages.length === 0) {
      chatContainer.innerHTML = '<div style="text-align:center;padding:30px 10px;color:var(--muted);font-size:0.85rem">No conversation history loaded for this customer.</div>';
      return;
    }

    chatContainer.innerHTML = messages.map(m => {
      const isCust = m.sender === 'customer';
      const isDraft = m.status === 'draft';
      const bubbleCls = isCust ? 'as-bubble-cust' : (isDraft ? 'as-bubble-draft' : 'as-bubble-staff');
      const senderLabel = isCust ? 'Customer' : (isDraft ? 'Assistant Draft (Pending Review)' : 'Choice Properties');
      const channelLabel = (m.channel || 'SMS').toUpperCase();

      return `
        <div class="as-chat-bubble ${bubbleCls}">
          <div class="as-bubble-meta">
            <span>${senderLabel} • ${channelLabel}</span>
            <span>${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style="white-space:pre-wrap">${escapeHtml(m.message_text)}</div>
          ${isDraft ? `
            <div style="margin-top:8px;display:flex;gap:6px">
              <button class="as-btn as-btn-sm as-btn-brand btn-approve-feed-draft" data-id="${m.id}" data-text="${escapeHtml(m.message_text)}">
                Send / Mark as Sent
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    chatContainer.querySelectorAll('.btn-approve-feed-draft').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await fetch(`/api/assistant/customers/${currentCustomer.id}/messages/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent' })
        });
        loadCustomerById(currentCustomer.id);
      });
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  async function handleAddNote() {
    if (!currentCustomer) return alert('Select or create a customer profile first');
    const noteText = newNoteInput.value.trim();
    if (!noteText) return;

    try {
      const res = await fetch(`/api/assistant/customers/${currentCustomer.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: noteText, author: 'Staff' })
      });
      const data = await res.json();
      if (data.ok) {
        newNoteInput.value = '';
        loadCustomerById(currentCustomer.id);
      }
    } catch (e) {
      alert('Failed to add note: ' + e.message);
    }
  }

  async function handleDeleteNote(noteId) {
    if (!currentCustomer) return;
    try {
      await fetch(`/api/assistant/customers/${currentCustomer.id}/notes/${noteId}`, {
        method: 'DELETE'
      });
      loadCustomerById(currentCustomer.id);
    } catch (e) {}
  }

  async function handleAddManualIncoming() {
    if (!currentCustomer) return alert('Select a customer first');
    const text = prompt('Enter customer incoming message:');
    if (!text || !text.trim()) return;

    try {
      await fetch(`/api/assistant/customers/${currentCustomer.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'customer',
          message_text: text.trim(),
          channel: 'sms',
          status: 'received'
        })
      });
      loadCustomerById(currentCustomer.id);
      loadRecentCustomers();
    } catch (e) {
      alert('Failed to log message: ' + e.message);
    }
  }

  async function handleGenerateReply() {
    if (!currentCustomer) {
      return alert('Please identify or select a customer profile first!');
    }
    const incoming = msgInput.value.trim();
    if (!incoming) {
      return alert('Please enter or paste the customer message to generate a response!');
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<svg class="i i-sm spin"><use href="#i-refresh"/></svg> Generating...';
    draftSlot.classList.remove('active');
    detectedBanner.style.display = 'none';

    try {
      // 1. Log incoming message if not already logged
      await fetch(`/api/assistant/customers/${currentCustomer.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'customer',
          message_text: incoming,
          channel: 'sms',
          status: 'received'
        })
      });

      // 2. Generate AI response
      const res = await fetch('/api/assistant/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          incomingMessage: incoming
        })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Generation failed');

      activeDraft = data.draftText;
      detectedUpdates = data.detectedUpdates || {};

      modelTag.textContent = data.modelUsed || 'Gemini 3.8 Flash';
      draftText.textContent = activeDraft;
      draftCount.textContent = `${activeDraft.length} chars`;
      draftSlot.classList.add('active');

      if (data.hasDetectedUpdates) {
        detectedBanner.style.display = 'inline-flex';
        const parts = [];
        if (detectedUpdates.max_budget) parts.push(`Budget: $${detectedUpdates.max_budget.toLocaleString()}`);
        if (detectedUpdates.target_beds) parts.push(`Beds: ${detectedUpdates.target_beds}`);
        if (detectedUpdates.target_baths) parts.push(`Baths: ${detectedUpdates.target_baths}`);
        if (detectedUpdates.target_city) parts.push(`City: ${detectedUpdates.target_city}`);
        if (detectedUpdates.move_in_date) parts.push(`Move-in: ${detectedUpdates.move_in_date}`);
        detectedText.textContent = `Detected preference update: ${parts.join(', ')}`;
      }

      loadCustomerById(currentCustomer.id);
      loadRecentCustomers();
    } catch (e) {
      alert('Error generating reply: ' + e.message);
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<svg class="i i-sm"><use href="#i-spark"/></svg> Generate AI Response';
    }
  }

  function handleCopyDraft() {
    const text = draftText.innerText || draftText.textContent;
    navigator.clipboard.writeText(text).then(() => {
      copyStatus.textContent = '✓ Copied to clipboard!';
      setTimeout(() => copyStatus.textContent = '', 3000);
    });
  }

  async function handleMarkSent() {
    if (!currentCustomer) return;
    const text = (draftText.innerText || draftText.textContent).trim();
    if (!text) return;

    try {
      await fetch(`/api/assistant/customers/${currentCustomer.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'assistant',
          message_text: text,
          channel: 'sms',
          status: 'sent'
        })
      });
      draftSlot.classList.remove('active');
      msgInput.value = '';
      copyStatus.textContent = '✓ Marked as sent!';
      setTimeout(() => copyStatus.textContent = '', 3000);
      loadCustomerById(currentCustomer.id);
    } catch (e) {
      alert('Failed to mark message as sent: ' + e.message);
    }
  }

  async function handleSaveDraft() {
    if (!currentCustomer) return;
    const text = (draftText.innerText || draftText.textContent).trim();
    if (!text) return;

    try {
      await fetch(`/api/assistant/customers/${currentCustomer.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'assistant',
          message_text: text,
          channel: 'sms',
          status: 'draft'
        })
      });
      copyStatus.textContent = '✓ Saved as draft!';
      setTimeout(() => copyStatus.textContent = '', 3000);
      loadCustomerById(currentCustomer.id);
    } catch (e) {
      alert('Failed to save draft: ' + e.message);
    }
  }

  async function handleApplyDetectedUpdates() {
    if (!currentCustomer || !detectedUpdates) return;
    try {
      await fetch(`/api/assistant/customers/${currentCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detectedUpdates)
      });
      detectedBanner.style.display = 'none';
      loadCustomerById(currentCustomer.id);
      copyStatus.textContent = '✓ Profile preferences updated!';
      setTimeout(() => copyStatus.textContent = '', 3000);
    } catch (e) {
      alert('Failed to update preferences: ' + e.message);
    }
  }

  // Customer Modal handlers
  function openCustomerModal(existing) {
    formCust.reset();
    if (existing && existing.id) {
      modalCustTitle.textContent = 'Edit Customer Profile';
      document.getElementById('cust-form-id').value = existing.id;
      document.getElementById('cust-form-last4').value = existing.phone_last4 || '';
      document.getElementById('cust-form-alias').value = existing.alias || '';
      document.getElementById('cust-form-fullname').value = existing.full_name || '';
      document.getElementById('cust-form-city').value = existing.target_city || '';
      document.getElementById('cust-form-type').value = existing.property_type || 'single_family';
      document.getElementById('cust-form-beds').value = existing.target_beds || '';
      document.getElementById('cust-form-baths').value = existing.target_baths || '';
      document.getElementById('cust-form-budget').value = existing.max_budget || '';
      document.getElementById('cust-form-movein').value = existing.move_in_date || '';
      document.getElementById('cust-form-pets').value = existing.has_pets ? 'true' : 'false';
      document.getElementById('cust-form-credit').value = existing.credit_concerns || '';
      document.getElementById('cust-form-eviction').value = existing.eviction_history || '';
      document.getElementById('cust-form-status').value = existing.application_status || 'not_started';
      document.getElementById('cust-form-fee-status').value = existing.application_fee_status || 'not_confirmed';
    } else {
      modalCustTitle.textContent = 'New Customer Profile';
      document.getElementById('cust-form-id').value = '';
      if (existing) {
        if (existing.phone_last4) document.getElementById('cust-form-last4').value = existing.phone_last4;
        if (existing.alias) document.getElementById('cust-form-alias').value = existing.alias;
      }
    }
    modalCust.classList.add('active');
  }

  async function handleSaveCustomerForm(e) {
    e.preventDefault();
    const id = document.getElementById('cust-form-id').value;
    const payload = {
      phone_last4: document.getElementById('cust-form-last4').value.trim() || null,
      alias: document.getElementById('cust-form-alias').value.trim() || null,
      full_name: document.getElementById('cust-form-fullname').value.trim() || null,
      target_city: document.getElementById('cust-form-city').value.trim() || null,
      property_type: document.getElementById('cust-form-type').value,
      target_beds: document.getElementById('cust-form-beds').value ? Number(document.getElementById('cust-form-beds').value) : null,
      target_baths: document.getElementById('cust-form-baths').value ? Number(document.getElementById('cust-form-baths').value) : null,
      max_budget: document.getElementById('cust-form-budget').value ? Number(document.getElementById('cust-form-budget').value) : null,
      move_in_date: document.getElementById('cust-form-movein').value.trim() || null,
      has_pets: document.getElementById('cust-form-pets').value === 'true',
      credit_concerns: document.getElementById('cust-form-credit').value.trim() || null,
      eviction_history: document.getElementById('cust-form-eviction').value.trim() || null,
      application_status: document.getElementById('cust-form-status').value,
      application_fee_status: document.getElementById('cust-form-fee-status').value
    };

    try {
      let res;
      if (id) {
        res = await fetch(`/api/assistant/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/assistant/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const data = await res.json();
      if (data.ok && data.customer) {
        modalCust.classList.remove('active');
        renderCustomerProfile(data.customer);
        loadRecentCustomers();
      }
    } catch (err) {
      alert('Error saving profile: ' + err.message);
    }
  }

  // Policies Modal
  async function openPoliciesModal() {
    try {
      const res = await fetch('/api/assistant/policies');
      const data = await res.json();
      if (data.ok && data.policies) {
        document.getElementById('pol-fee').value = data.policies.application_fee || 50;
        document.getElementById('pol-review-window').value = data.policies.review_window_hours || '24–72 hours';
        document.getElementById('pol-reapply-days').value = data.policies.reapplication_days || 7;
        document.getElementById('pol-reapply-count').value = data.policies.reapplication_count || 2;
        document.getElementById('pol-deposit').value = data.policies.security_deposit_rule || 'Equal to 1x monthly rent in DB';
        document.getElementById('pol-pets').value = data.policies.pet_policy || 'Pet friendly';
        modalPolicies.classList.add('active');
      }
    } catch (e) {
      alert('Failed to load policies: ' + e.message);
    }
  }

  async function handleSavePolicies(e) {
    e.preventDefault();
    const payload = {
      application_fee: Number(document.getElementById('pol-fee').value) || 50,
      review_window_hours: document.getElementById('pol-review-window').value.trim(),
      reapplication_days: Number(document.getElementById('pol-reapply-days').value) || 7,
      reapplication_count: Number(document.getElementById('pol-reapply-count').value) || 2,
      security_deposit_rule: document.getElementById('pol-deposit').value.trim(),
      pet_policy: document.getElementById('pol-pets').value.trim()
    };

    try {
      const res = await fetch('/api/assistant/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies: payload })
      });
      const data = await res.json();
      if (data.ok) {
        alert('Central policies updated successfully!');
        modalPolicies.classList.remove('active');
      }
    } catch (err) {
      alert('Failed to save policies: ' + err.message);
    }
  }

  // Backup & Restore
  async function handleExportDownload() {
    try {
      const res = await fetch('/api/assistant/export');
      const data = await res.json();
      if (data.ok && data.export) {
        const str = JSON.stringify(data.export, null, 2);
        const blob = new Blob([str], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `choice-properties-customer-memory-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  async function handleImportUpload() {
    const file = importFileInput.files[0];
    if (!file) return alert('Please select a JSON backup file to import');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonContent = JSON.parse(e.target.result);
        const res = await fetch('/api/assistant/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup: jsonContent })
        });
        const data = await res.json();
        if (data.ok) {
          alert(`Successfully restored ${data.customers_count} customer profiles!`);
          modalBackup.classList.remove('active');
          loadRecentCustomers();
        } else {
          alert('Import failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
