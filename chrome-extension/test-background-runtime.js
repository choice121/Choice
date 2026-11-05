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
  const requestedUrls = [];
  const chrome = {
    runtime: {
      onMessage: {
        addListener(listener) { messageListener = listener; },
      },
      getManifest() { return { version: 'test' }; },
    },
    storage: {},
    action: {},
  };

  vm.runInNewContext(source, {
    AbortController,
    AbortSignal,
    chrome,
    fetch: async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => ({ ok: true, report_id: 'diagnostic-test-id' }),
      };
    },
    navigator: { userAgent: 'Chrome', onLine: true },
    self: { addEventListener() {} },
    setTimeout,
    clearTimeout,
  });

  assert.equal(typeof messageListener, 'function', `${file} registers its listener without window`);
  const diagnostic = await sendMessage(messageListener, {
    type: 'SEND_DIAGNOSTIC',
    diagnostic: { status: 'failed' },
  });
  assert.equal(diagnostic.ok, true);
  assert.equal(diagnostic.report_id, 'diagnostic-test-id');
  assert.match(requestedUrls[0], /\/functions\/v1\/extension-diagnostics$/);

  const imported = await sendMessage(messageListener, {
    type: 'UPLOAD_PAYLOAD',
    payload: { address: '10 Main St' },
    settings: { offlineQueue: false },
  });
  assert.equal(imported.ok, true);
  assert.match(requestedUrls[1], /\/functions\/v1\/receive-pipeline-import$/);
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
