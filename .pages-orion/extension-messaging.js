// Promise/callback compatibility for Safari-based and Chromium extensions.
(function (root) {
  'use strict';

  var chromeApi = typeof chrome !== 'undefined' && chrome.runtime ? chrome : null;
  var browserApi = typeof browser !== 'undefined' && browser.runtime ? browser : null;
  var api = chromeApi || browserApi;
  var promiseApi = !chromeApi && !!browserApi;

  function timeoutError() {
    return new Error('Extension background did not respond in time');
  }

  function sendMessage(message, timeoutMs) {
    if (!api || !api.runtime || typeof api.runtime.sendMessage !== 'function') {
      return Promise.reject(new Error('Extension background is unavailable'));
    }

    var limit = Number(timeoutMs) > 0 ? Number(timeoutMs) : 30000;

    if (promiseApi) {
      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          reject(timeoutError());
        }, limit);

        try {
          Promise.resolve(api.runtime.sendMessage(message)).then(
            function (response) {
              clearTimeout(timer);
              resolve(response);
            },
            function (error) {
              clearTimeout(timer);
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          );
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      });
    }

    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        finish(false, timeoutError());
      }, limit);

      function finish(ok, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (ok) resolve(value);
        else reject(value instanceof Error ? value : new Error(String(value)));
      }

      try {
        var returned = api.runtime.sendMessage(message, function (response) {
          var runtimeError = api.runtime.lastError;
          if (runtimeError) finish(false, new Error(runtimeError.message || 'Extension message failed'));
          else finish(true, response);
        });

        // Some implementations expose the Chromium namespace but still return
        // promises. Accept either completion style without settling twice.
        if (returned && typeof returned.then === 'function') {
          returned.then(function (response) {
            finish(true, response);
          }, function (error) {
            finish(false, error);
          });
        }
      } catch (error) {
        finish(false, error);
      }
    });
  }

  function sendMessageWithFallback(message, fallback, timeoutMs) {
    if (typeof fallback !== 'function') {
      return Promise.reject(new Error('Extension message fallback is unavailable'));
    }

    return sendMessage(message, timeoutMs).then(
      function (response) {
        return response === undefined || response === null
          ? fallback(new Error('Extension background returned no response'))
          : response;
      },
      function (error) {
        return fallback(error);
      }
    );
  }

  root.CP_ExtensionMessaging = {
    available: !!api,
    sendMessage: sendMessage,
    sendMessageWithFallback: sendMessageWithFallback,
  };
})(window);