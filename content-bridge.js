// content-bridge.js
// Injects a detection marker on buryit.pages.dev and relays
// postMessage calls from the page to the service worker.

(function () {
  'use strict';

  // Synchronous marker the page can check without postMessage round-trips.
  try {
    document.documentElement.setAttribute(
      'data-buryit-extension',
      chrome.runtime.getManifest().version
    );
  } catch (err) {
    return; // chrome.runtime not available — do nothing
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.source !== 'buryit-site') return;
    if (typeof data.requestId !== 'string') return;

    if (data.action === 'ping') {
      window.postMessage({
        source: 'buryit-extension',
        requestId: data.requestId,
        response: { ok: true, version: chrome.runtime.getManifest().version }
      }, '*');
      return;
    }

    if (data.action === 'openPopup') {
      chrome.runtime.sendMessage({ action: 'openPopup' }, function (response) {
        if (chrome.runtime.lastError) {
          window.postMessage({
            source: 'buryit-extension',
            requestId: data.requestId,
            response: { ok: false, error: chrome.runtime.lastError.message }
          }, '*');
          return;
        }
        window.postMessage({
          source: 'buryit-extension',
          requestId: data.requestId,
          response: response || { ok: false, error: 'no-response' }
        }, '*');
      });
      return;
    }

    window.postMessage({
      source: 'buryit-extension',
      requestId: data.requestId,
      response: { ok: false, error: 'unknown-action' }
    }, '*');
  });
})();
