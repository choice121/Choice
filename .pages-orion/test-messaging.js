#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const helperSource = fs.readFileSync(path.join(__dirname, 'extension-messaging.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const liveContent = fs.readFileSync(path.join(__dirname, 'live-content.js'), 'utf8');

function loadHelper(globals) {
  const window = {};
  vm.runInNewContext(helperSource, { ...globals, window, Promise, Error, setTimeout, clearTimeout });
  return window.CP_ExtensionMessaging;
}

async function main() {
  const browserPromise = loadHelper({
    browser: {
      runtime: {
        sendMessage: (message) => Promise.resolve({ ok: true, type: message.type }),
      },
    },
  });
  assert.equal(browserPromise.available, true);
  assert.deepEqual(
    await browserPromise.sendMessage({ type: 'UPLOAD_PAYLOAD' }),
    { ok: true, type: 'UPLOAD_PAYLOAD' }
  );
  let fallbackCalls = 0;
  const noBackgroundResponse = loadHelper({
    browser: {
      runtime: {
        sendMessage: () => undefined,
      },
    },
  });
  assert.deepEqual(
    await noBackgroundResponse.sendMessageWithFallback(
      { type: 'UPLOAD_PAYLOAD' },
      () => {
        fallbackCalls += 1;
        return Promise.resolve({ ok: true, viaFallback: true });
      }
    ),
    { ok: true, viaFallback: true }
  );
  assert.equal(fallbackCalls, 1);

  const rejectedBackground = loadHelper({
    browser: {
      runtime: {
        sendMessage: () => Promise.reject(new Error('Background unavailable')),
      },
    },
  });
  assert.deepEqual(
    await rejectedBackground.sendMessageWithFallback(
      { type: 'UPLOAD_PAYLOAD' },
      () => Promise.resolve({ ok: true, viaFallback: true })
    ),
    { ok: true, viaFallback: true }
  );

  const chromeCallback = loadHelper({
    chrome: {
      runtime: {
        sendMessage: (message, callback) => {
          setTimeout(() => callback({ ok: true, type: message.type }), 0);
        },
      },
    },
  });
  assert.deepEqual(
    await chromeCallback.sendMessage({ type: 'UPLOAD_PAYLOAD' }),
    { ok: true, type: 'UPLOAD_PAYLOAD' }
  );

  const chromePromise = loadHelper({
    chrome: {
      runtime: {
        sendMessage: (message, _callback) => Promise.resolve({ ok: true, type: message.type }),
      },
    },
  });
  assert.deepEqual(
    await chromePromise.sendMessage({ type: 'UPLOAD_PAYLOAD' }),
    { ok: true, type: 'UPLOAD_PAYLOAD' }
  );

  const runtimeWithError = {
    lastError: null,
    sendMessage: (_message, callback) => {
      runtimeWithError.lastError = { message: 'No receiving extension background' };
      callback(undefined);
      runtimeWithError.lastError = null;
    },
  };
  const chromeError = loadHelper({ chrome: { runtime: runtimeWithError } });
  await assert.rejects(
    chromeError.sendMessage({ type: 'UPLOAD_PAYLOAD' }),
    /No receiving extension background/
  );

  const contentScripts = manifest.content_scripts.flatMap((entry) => entry.js || []);
  assert.ok(contentScripts.indexOf('extension-messaging.js') < contentScripts.indexOf('live-content.js'));
  assert.match(liveContent, /CP_ExtensionMessaging\.sendMessageWithFallback/);
  assert.match(liveContent, /'x-import-secret': SECRET/);

  console.log('Orion extension messaging tests passed (promise API, callback API, promise-returning Chrome API, errors, manifest wiring).');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});