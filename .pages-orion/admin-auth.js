(function () {
  'use strict';

  const api = globalThis.chrome || globalThis.browser;
  const loginPanel = document.getElementById('admin-auth-login');
  const connectedPanel = document.getElementById('admin-auth-connected');
  const emailInput = document.getElementById('admin-auth-email');
  const passwordInput = document.getElementById('admin-auth-password');
  const loginButton = document.getElementById('admin-auth-login-button');
  const logoutButton = document.getElementById('admin-auth-logout-button');
  const status = document.getElementById('admin-auth-status');

  function setConnected(connected) {
    loginPanel.hidden = connected;
    connectedPanel.hidden = !connected;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = kind || '';
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (api === globalThis.browser && api !== globalThis.chrome) {
        api.runtime.sendMessage(message).then(resolve, reject);
        return;
      }
      let settled = false;
      const finish = (error, response) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(response);
      };
      try {
        const result = api.runtime.sendMessage(message, (response) => {
          const error = api.runtime.lastError;
          finish(error ? new Error(error.message) : null, response);
        });
        if (result && typeof result.then === 'function') {
          result.then((response) => finish(null, response), (error) => finish(error));
        }
      } catch (error) {
        finish(error);
      }
    });
  }

  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    setStatus('Connecting to Choice…');
    try {
      const result = await sendMessage({
        type: 'ADMIN_SIGN_IN',
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });
      if (!result?.ok) throw new Error(result?.error || 'Choice sign-in failed');
      passwordInput.value = '';
      setConnected(true);
      setStatus('Connected to the Choice pipeline.', 'success');
    } catch (error) {
      setStatus(String(error.message || error).slice(0, 180), 'error');
    } finally {
      loginButton.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    try {
      const result = await sendMessage({ type: 'ADMIN_SIGN_OUT' });
      if (!result?.ok) throw new Error(result?.error || 'Could not disconnect account');
      setConnected(false);
      setStatus('Disconnected from Choice.');
    } catch (error) {
      setStatus(String(error.message || error).slice(0, 180), 'error');
    }
  });

  sendMessage({ type: 'ADMIN_AUTH_STATUS' })
    .then((result) => {
      if (result?.ok) setConnected(Boolean(result.connected));
      else setStatus(result?.error || 'Could not read sign-in status', 'error');
    })
    .catch((error) => setStatus(String(error.message || error), 'error'));
})();
