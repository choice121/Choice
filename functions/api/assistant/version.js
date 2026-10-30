export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    ok: true,
    version: 'v2.6.0',
    buildTimestamp: new Date().toISOString(),
    environment: 'production',
    engine: 'Choice Properties AI Inquiry Assistant (Cloudflare Pages Worker)',
    rules: {
      applicationFee: '$50',
      depositInText: 'Stripped (1x monthly rent in DB)',
      voucherFriendly: true,
      autoSyncShortcuts: true
    },
    supabaseConnected: true
  }, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store'
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization'
    }
  });
}
