/**
 * Choice Properties — Mobile Quick Assistant Test Suite
 * Validates automatic customer resolution, memory persistence, preference extraction,
 * voucher handling, landlord inquiries, company info, and follow-ups.
 */

import http from 'http';

function makeRequest(path, payload, format = 'json') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(format === 'text' ? { 'Accept': 'text/plain' } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (format === 'text') {
          resolve({ status: res.statusCode, body: data });
        } else {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Running Choice Properties Mobile Assistant Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  try {
    // Test 1: New customer via raw text with phone suffix prefix
    console.log('--- Test 1: Auto-detection and Memory Creation from Text Prefix ---');
    const res1 = await makeRequest('/api/assistant/quick-draft', {
      text: '9182: Hi, I need a 3 bedroom house in Dallas under $1,800. We have an ESA dog.'
    });
    assert(res1.status === 200, 'HTTP 200 returned');
    assert(res1.body.ok === true, 'Response ok is true');
    assert(res1.body.customer.phone_last4 === '9182', 'Phone last 4 extracted as 9182');
    assert(res1.body.detectedUpdates.target_beds === 3, 'Extracted 3 beds');
    assert(res1.body.detectedUpdates.max_budget === 1800, 'Extracted $1,800 max budget');
    assert(res1.body.detectedUpdates.target_city === 'Dallas', 'Extracted Dallas');
    assert(res1.body.detectedUpdates.has_pets === true, 'Extracted has_pets');

    // Test 2: Housing voucher / Section 8 inquiry (independent of property)
    console.log('\n--- Test 2: Housing Voucher & Section 8 Independent Capability ---');
    const res2 = await makeRequest('/api/assistant/quick-draft', {
      text: '9182: Do you guys accept Section 8 or housing vouchers?'
    });
    assert(res2.status === 200, 'HTTP 200 returned');
    assert(res2.body.reply.toLowerCase().includes('voucher') || res2.body.reply.toLowerCase().includes('section 8'), 'Acknowledges vouchers warmly');
    assert(!res2.body.reply.includes('9182'), 'Zero internal 4-digit ID leaks');

    // Test 3: Plain text format for Apple Shortcut clipboard
    console.log('\n--- Test 3: Apple Shortcut Plain-Text Format ---');
    const res3 = await makeRequest('/api/assistant/quick-draft?format=text', {
      text: 'Marcus (555-4321): Can my dad co-sign for me?'
    }, 'text');
    assert(res3.status === 200, 'HTTP 200 returned for text');
    assert(typeof res3.body === 'string' && res3.body.length > 20, 'Direct string returned');
    assert(res3.body.toLowerCase().includes('co-signer') || res3.body.toLowerCase().includes('co-sign'), 'Explains co-signer policy');
    assert(res3.body.includes('$50'), 'Enforces $50 application fee');

    // Test 4: Property Owner / Landlord inquiry
    console.log('\n--- Test 4: Landlord / Property Owner Partnership Inquiry ---');
    const res4 = await makeRequest('/api/assistant/quick-draft', {
      text: 'I own 2 rental properties in Charlotte and want to list them with Choice Properties'
    });
    assert(res4.status === 200, 'HTTP 200 returned');
    assert(res4.body.reply.toLowerCase().includes('partner') || res4.body.reply.toLowerCase().includes('onboarding'), 'Professional B2B owner onboarding response');

    // Test 5: Who is Choice Properties / Company Background
    console.log('\n--- Test 5: Independent Company Background Inquiry ---');
    const res5 = await makeRequest('/api/assistant/quick-draft', {
      text: 'Who is Choice Properties? Is this a legit company?'
    });
    assert(res5.status === 200, 'HTTP 200 returned');
    assert(res5.body.reply.toLowerCase().includes('choice properties'), 'Explains Choice Properties clearly');
    assert(res5.body.reply.includes('$50'), 'Maintains $50 application fee');

    // Test 6: Follow-up check-in trigger
    console.log('\n--- Test 6: Follow-up Check-in Generator ---');
    const res6 = await makeRequest('/api/assistant/quick-draft', {
      identifier: '9182',
      text: 'follow up'
    });
    assert(res6.status === 200, 'HTTP 200 returned');
    assert(res6.body.reply.toLowerCase().includes('touching base') || res6.body.reply.toLowerCase().includes('checking in'), 'Generates conversational follow up');
    assert(res6.body.reply.includes('Dallas'), 'Remembers Dallas from past customer context');

    console.log(`\n========================================`);
    console.log(`Mobile Assistant Test Results: ${passed}/${total} Passed`);
    console.log(`========================================\n`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
