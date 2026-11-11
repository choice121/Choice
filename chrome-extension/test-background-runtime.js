const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function sendMessage(listener, message) {
  return new Promise((resolve, reject) => {
    const keepAlive = listener(message, {}, resolve);
    assert.equal(keepAlive, true);
    setTimeout(() => reject(new Error(`${message.type} message did not complete`)), 1000);
  });
}

async function testBackground(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  let messageListener;
  const requests = [];
  const storageData = { cp_extension_admin_refresh_token: 'initial-refresh-token' };
  const chrome = {
    runtime: {
      onMessage: {
        addListener(listener) { messageListener = listener; },
      },
      getManifest() { return { version: 'test' }; },
    },
    storage: {
      local: {
        async get(key) {
          return typeof key === 'string' ? { [key]: storageData[key] } : {};
        },
        async set(values) {
          Object.assign(storageData, values);
        },
        async remove(key) {
          delete storageData[key];
        },
      },
    },
    action: {},
  };

  vm.runInNewContext(source, {
    AbortController,
    AbortSignal,
    URL,
    chrome,
    fetch: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (String(url).endsWith('/config.js')) {
        return {
          ok: true,
          text: async () => "var CONFIG = { SUPABASE_URL: 'https://tlfmwetmhthpyrytrcfo.supabase.co', SUPABASE_ANON_KEY: 'test-anon-key' };",
        };
      }
      if (String(url).includes('/auth/v1/token?grant_type=')) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'test-access-token',
            refresh_token: 'rotated-refresh-token',
            expires_in: 3600,
          }),
        };
      }
      return {
        ok: true,
        json: async () => String(url).endsWith('/extension-diagnostics')
          ? { ok: true, report_id: 'diagnostic-test-id' }
          : { ok: true, folders: [] },
      };
    },
    navigator: { userAgent: 'Chrome', onLine: true },
    self: { addEventListener() {} },
    setTimeout,
    clearTimeout,
  });

  assert.equal(typeof messageListener, 'function', `${file} registers its listener without window`);
  const login = await sendMessage(messageListener, {
    type: 'ADMIN_SIGN_IN',
    email: 'admin@example.com',
    password: 'not-a-real-password',
  });
  assert.equal(login.ok, true);

  const diagnostic = await sendMessage(messageListener, {
    type: 'SEND_DIAGNOSTIC',
    diagnostic: { status: 'failed' },
  });
  assert.equal(diagnostic.ok, true);
  assert.equal(diagnostic.report_id, 'diagnostic-test-id');
  const diagnosticRequest = requests.find((request) => request.url.endsWith('/extension-diagnostics'));
  assert.ok(diagnosticRequest);
  assert.equal(diagnosticRequest.options.headers.Authorization, 'Bearer test-access-token');
  assert.equal(diagnosticRequest.options.headers.apikey, 'test-anon-key');

  const imported = await sendMessage(messageListener, {
    type: 'UPLOAD_PAYLOAD',
    payload: { address: '10 Main St' },
    settings: { offlineQueue: false },
  });
  assert.equal(imported.ok, true);
  const importRequest = requests.find((request) => request.url.endsWith('/receive-pipeline-import'));
  assert.ok(importRequest);
  assert.equal(importRequest.options.headers.Authorization, 'Bearer test-access-token');
  assert.equal(Object.keys(importRequest.options.headers).some((name) => /secret/i.test(name)), false);
  assert.equal(new URL(importRequest.url).searchParams.has('secret'), false);
}

Promise.all([
  testBackground('chrome-extension/background.js'),
  testBackground('.pages-orion/background.js'),
]).then(() => {
  console.log('Chrome and Orion background workers passed startup, import, and diagnostics tests');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
