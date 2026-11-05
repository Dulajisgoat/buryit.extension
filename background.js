// background.js
// Service worker: opens the extension UI when buryit.pages.dev asks.

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.action !== 'openPopup') return;

  // Only accept from our content script on the allowed origins.
  var url = sender.url || '';
  var ok = /^https:\/\/buryit\.pages\.dev\//.test(url) ||
           /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
  if (!ok) {
    sendResponse({ ok: false, error: 'unauthorized' });
    return;
  }

  // Best UX: native toolbar popup. May fail without a user gesture
  // because the click happened in the page, not the extension.
  if (chrome.action && typeof chrome.action.openPopup === 'function') {
    chrome.action.openPopup()
      .then(function () {
        sendResponse({ ok: true, method: 'openPopup' });
      })
      .catch(function () {
        openPopupWindow(sendResponse);
      });
    return true; // async response
  }

  // Older Chrome: no openPopup() — go straight to the window.
  openPopupWindow(sendResponse);
  return true;
});

function openPopupWindow(sendResponse) {
  try {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 400,
      height: 600,
      focused: true
    }, function (win) {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, method: 'window', windowId: win && win.id });
    });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
}
