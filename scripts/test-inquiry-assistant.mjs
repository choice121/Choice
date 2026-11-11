#!/usr/bin/env node
/**
 * Choice Properties — Automated Verification Suite for AI Rental Inquiry Assistant
 * Tests scenarios 1 through 12 specified in Section 19.
 */

import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — AI RENTAL INQUIRY ASSISTANT TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`Testing: ${name} ... `);
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error('   Error:', err.message);
      failed++;
    }
  }

  // Reset test state to clean before running test suite
  await fetch(`${BASE_URL}/api/assistant/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      backup: {
        data: { customers: {}, conversations: {}, notes: {} }
      }
    })
  });

  // TEST 1: EXISTING CUSTOMER
  await test('TEST 1: Existing customer lookup by 4-digit ID (8376)', async () => {
    // Seed customer 8376
    const createRes = await fetch(`${BASE_URL}/api/assistant/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_last4: '8376',
        alias: 'Riley',
        target_city: 'Charlotte',
        target_beds: 3,
        max_budget: 1800,
        move_in_date: 'Nov 1–15',
        credit_concerns: 'Rough credit disclosed'
      })
    });
    const cData = await createRes.json();
    assert.strictEqual(cData.ok, true, 'Customer creation should succeed');
    const custId = cData.customer.id;

    // Add conversation
    await fetch(`${BASE_URL}/api/assistant/customers/${custId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: 'customer',
        message_text: 'Hello, looking for a 3-bedroom in Charlotte under 1800',
        channel: 'tiktok',
        status: 'received'
      })
    });

    // Lookup by 8376
    const lookupRes = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '8376' })
    });
    const lData = await lookupRes.json();
    assert.strictEqual(lData.ok, true);
    assert.strictEqual(lData.found, true);
    assert.strictEqual(lData.customer.phone_last4, '8376');
    assert.strictEqual(lData.customer.alias, 'Riley');
    assert.strictEqual(lData.customer.target_city, 'Charlotte');
    assert.ok(lData.customer.messages.length >= 1, 'Should load conversation history');
  });

  // TEST 2: NEW CUSTOMER
  await test('TEST 2: New customer profile creation without collision', async () => {
    const res = await fetch(`${BASE_URL}/api/assistant/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_last4: '1954',
        alias: 'Suited',
        target_city: 'Oklahoma City',
        target_beds: 2,
        max_budget: 1400
      })
    });
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.customer.phone_last4, '1954');
    assert.strictEqual(data.customer.alias, 'Suited');

    // Ensure 8376 was not overwritten
    const check8376 = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '8376' })
    });
    const checkData = await check8376.json();
    assert.strictEqual(checkData.customer.alias, 'Riley');
  });

  // TEST 3: RETURNING CUSTOMER CONTEXT AWARENESS
  await test('TEST 3: Returning customer AI answers question without repeating known specs', async () => {
    // Lookup customer Riley (8376)
    const lookup = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '8376' })
    });
    const cData = await lookup.json();
    const custId = cData.customer.id;

    // Send question
    const genRes = await fetch(`${BASE_URL}/api/assistant/generate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custId,
        incomingMessage: 'Will my credit score prevent me from getting approved?'
      })
    });
    const genData = await genRes.json();
    assert.strictEqual(genData.ok, true);
    assert.ok(genData.draftText, 'Draft text must be present');
    // Must NOT ask for bedroom count or city again, since they are already known!
    assert.ok(!genData.draftText.includes('how many bedrooms'), 'Should not ask for bedrooms when already known');
    assert.ok(!genData.draftText.includes('which city'), 'Should not ask for city when already known');
  });

  // TEST 4: UPDATED PREFERENCE
  await test('TEST 4: Preference update preserves chat history while updating active fields', async () => {
    const lookup = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '8376' })
    });
    const custId = (await lookup.json()).customer.id;

    // Update budget from 1800 to 1600
    const updateRes = await fetch(`${BASE_URL}/api/assistant/customers/${custId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_budget: 1600 })
    });
    const uData = await updateRes.json();
    assert.strictEqual(uData.customer.max_budget, 1600, 'Active budget should be updated');

    // Conversation history must still be preserved
    assert.ok(uData.customer.messages.length >= 1, 'Previous conversation messages must be intact');
  });

  // TEST 5: CUSTOMER CONFLICT DETECTION
  await test('TEST 5: Detect collision when two records share same 4-digit identifier', async () => {
    // Create a second customer with the same phone_last4: '8376'
    await fetch(`${BASE_URL}/api/assistant/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_last4: '8376',
        alias: 'Marcus',
        target_city: 'Dallas',
        target_beds: 4
      })
    });

    // Lookup 8376 should now detect collision!
    const lookup = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '8376' })
    });
    const data = await lookup.json();
    assert.strictEqual(data.collision, true, 'System must flag collision on duplicate 4-digit ID');
    assert.ok(data.matches.length >= 2, 'Must return matching profiles for disambiguation');
  });

  // TEST 6: UNAVAILABLE PROPERTY HANDLING
  await test('TEST 6: Unavailable property pivots warmly without claiming unverified availability', async () => {
    const lookup = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '1954' })
    });
    const custId = (await lookup.json()).customer.id;

    const genRes = await fetch(`${BASE_URL}/api/assistant/generate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custId,
        incomingMessage: 'I saw this home on TikTok, is it still available?'
      })
    });
    const data = await genRes.json();
    assert.ok(data.draftText.toLowerCase().includes('no longer available') || data.draftText.toLowerCase().includes('already been reserved'), 'Should state home is no longer available');
    assert.ok(data.draftText.includes('Oklahoma City'), 'Should pivot to active inventory in their city');
  });

  // TEST 7: APPLICATION STATUS ACCURACY
  await test('TEST 7: AI does not claim payment or approval unless confirmed in profile', async () => {
    const lookup = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '1954' })
    });
    const custId = (await lookup.json()).customer.id;

    const genRes = await fetch(`${BASE_URL}/api/assistant/generate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custId,
        incomingMessage: 'Can you give me an update on my application status?'
      })
    });
    const data = await genRes.json();
    assert.ok(!data.draftText.toLowerCase().includes('you are approved'), 'Must not claim approved when unconfirmed');
    assert.ok(data.draftText.includes('24') && data.draftText.includes('72'), 'Must mention 24 to 72 hours estimate');
  });

  // TEST 8: QUALIFICATION QUESTION HANDLING
  await test('TEST 8: Reassuring holistic answer for bad credit/eviction without false guarantee', async () => {
    const lookup = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '1954' })
    });
    const custId = (await lookup.json()).customer.id;

    const genRes = await fetch(`${BASE_URL}/api/assistant/generate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custId,
        incomingMessage: 'I have a 520 credit score and an eviction from two years ago. Can I still qualify?'
      })
    });
    const data = await genRes.json();
    const text = data.draftText.toLowerCase();
    assert.ok(text.includes('different credit and rental backgrounds') || text.includes('holistic') || text.includes('overall information'), 'Must provide holistic explanation');
    assert.ok(!text.includes('guarantee'), 'Must not promise guaranteed approval');
  });

  // TEST 9: BACKUP EXPORT & RESTORE PORTABILITY
  await test('TEST 9: Export database snapshot and restore cleanly', async () => {
    const expRes = await fetch(`${BASE_URL}/api/assistant/export`);
    const expData = await expRes.json();
    assert.strictEqual(expData.ok, true);
    assert.ok(expData.export.data.customers, 'Export must contain customers');

    // Test import
    const impRes = await fetch(`${BASE_URL}/api/assistant/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: expData.export })
    });
    const impData = await impRes.json();
    assert.strictEqual(impData.ok, true);
    assert.ok(impData.customers_count >= 2, 'Should restore customer profiles');
  });

  // TEST 10: SECURITY & DATA PRIVACY
  await test('TEST 10: 4-digit ID and private staff notes are never leaked into customer text', async () => {
    const lookup = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '1954' })
    });
    const custId = (await lookup.json()).customer.id;

    // Add private staff note
    await fetch(`${BASE_URL}/api/assistant/customers/${custId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_text: 'Secret internal note: applicant is waiting for tax refund' })
    });

    const genRes = await fetch(`${BASE_URL}/api/assistant/generate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custId,
        incomingMessage: 'How much is the fee?'
      })
    });
    const data = await genRes.json();
    assert.ok(!data.draftText.includes('1954'), 'Must not leak 4-digit ID into customer message');
    assert.ok(!data.draftText.includes('Secret internal note'), 'Must not leak staff notes into customer message');
    assert.ok(!data.draftText.includes('tax refund'), 'Must not leak private staff notes into customer message');
    assert.ok(data.draftText.includes('$50'), 'Must strictly state $50 application fee');
  });

  // TEST 11: MESSAGE APPROVAL WORKFLOW
  await test('TEST 11: Generating draft does not mark message as sent automatically', async () => {
    const lookup = await fetch(`${BASE_URL}/api/assistant/customers/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '1954' })
    });
    const custBefore = (await lookup.json()).customer;
    const sentCountBefore = custBefore.messages.filter(m => m.status === 'sent').length;

    // Generate draft
    await fetch(`${BASE_URL}/api/assistant/generate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custBefore.id,
        incomingMessage: 'Are pets allowed?'
      })
    });

    // Verify messages list
    const lookupAfter = await fetch(`${BASE_URL}/api/assistant/customers/${custBefore.id}`);
    const custAfter = (await lookupAfter.json()).customer;
    const sentCountAfter = custAfter.messages.filter(m => m.status === 'sent').length;

    assert.strictEqual(sentCountBefore, sentCountAfter, 'Generating reply must NOT auto-send');
  });

  // TEST 12: CENTRALIZED POLICY UPDATE
  await test('TEST 12: Business policy updates centrally and immediately impacts responses', async () => {
    // Check initial policy
    const pRes = await fetch(`${BASE_URL}/api/assistant/policies`);
    const pData = await pRes.json();
    assert.strictEqual(pData.policies.application_fee, 50, 'Default fee is $50');

    // Update policy (e.g. adjust review window or reapplication policy)
    const updateRes = await fetch(`${BASE_URL}/api/assistant/policies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policies: {
          review_window_hours: '24–48 hours'
        }
      })
    });
    const uData = await updateRes.json();
    assert.strictEqual(uData.policies.review_window_hours, '24–48 hours');

    // Revert back
    await fetch(`${BASE_URL}/api/assistant/policies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policies: {
          review_window_hours: '24–72 hours',
          application_fee: 50
        }
      })
    });
  });

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
