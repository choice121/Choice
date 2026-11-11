export async function onRequestPost(context) {
  try {
    const req = context.request;
    const body = await req.json().catch(() => ({}));
    const incomingText = body.text || body.message || body.rawText || '';
    if (!incomingText) {
      return new Response(JSON.stringify({ ok: false, error: 'text or message parameter is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }
      });
    }

    const phoneSuffixMatch = incomingText.match(/\((\d{4})\)/);
    const phone_last4 = phoneSuffixMatch ? phoneSuffixMatch[1] : (body.phone_last4 || '0000');
    const aliasMatch = incomingText.match(/(?:hi|hello|this is|,)\s+([A-Za-z]+)/i);
    const alias = aliasMatch ? aliasMatch[1] : (body.alias || 'Valued Renter');

    const lower = incomingText.toLowerCase();
    let draft = `Hi ${alias}! Thanks for reaching out to Choice Properties.`;
    
    if (lower.includes('voucher') || lower.includes('section 8') || lower.includes('housing choice')) {
      draft += ` Yes, we gladly accept housing choice vouchers and Section 8 subsidies! Our team will review your income stability and references. The application fee is $50 per adult. Submit your application today at Choice Properties!`;
    } else if (lower.includes('credit') || lower.includes('eviction') || lower.includes('bad credit') || lower.includes('low credit')) {
      draft += ` We evaluate all applications holistically based on income stability and rental references rather than strict automated credit score cutoffs. The application fee is $50. Submit your application today at Choice Properties!`;
    } else if (lower.includes('list my') || lower.includes('landlord') || lower.includes('i own')) {
      draft += ` We partner with property owners and investors across the region for professional leasing and management. We would love to discuss managing your property. Reach out to our leasing team to get started!`;
    } else {
      draft += ` We have beautiful homes available to fit your needs. The application fee is $50 per adult. Please submit your application today at Choice Properties!`;
    }

    const format = new URL(req.url).searchParams.get('format') || body.format || '';
    const acceptsText = (req.headers.get('accept') || '').includes('text/plain');

    if (format === 'text' || acceptsText) {
      return new Response(draft, {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'access-control-allow-origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      reply: draft,
      customer: {
        id: 'cf-worker-cust-' + phone_last4,
        alias,
        phone_last4,
        target_city: 'Target City',
        target_beds: 3,
        max_budget: 1800
      },
      detectedUpdates: { phone_last4, alias },
      modelUsed: 'cloudflare-worker-fallback'
    }, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization'
    }
  });
}
