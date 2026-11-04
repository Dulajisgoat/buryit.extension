// background.js — MV3 service worker. No DOM access.
// Registers the "Bury this element" context menu item and relays
// popup -> content messages via a {type:"relay", tabId, payload} envelope.

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.removeAll(function () {
    if (chrome.runtime.lastError) {
      console.warn("BuryIt: removeAll failed:", chrome.runtime.lastError.message);
    }
    chrome.contextMenus.create(
      {
        id: "buryit-bury-element",
        title: "Bury this element",
        contexts: ["all"]
      },
      function () {
        if (chrome.runtime.lastError) {
          console.warn("BuryIt: create failed:", chrome.runtime.lastError.message);
        }
      }
    );
  });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId !== "buryit-bury-element") return;
  if (!tab || typeof tab.id !== "number") return;

  chrome.tabs.sendMessage(tab.id, { type: "bury-last-target" }, function () {
    if (chrome.runtime.lastError) {
      // No injection fallback by design — just log a warning.
      console.warn(
        "BuryIt: no content script resident in tab, bury skipped:",
        chrome.runtime.lastError.message
      );
    }
  });
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.type !== "relay") return false;

  var tabId = message.tabId;
  if (typeof tabId !== "number") {
    sendResponse({ ok: false, error: "missing tabId" });
    return false;
  }

  chrome.tabs.sendMessage(tabId, message.payload, function (response) {
    if (chrome.runtime.lastError) {
      console.warn("BuryIt: relay failed:", chrome.runtime.lastError.message);
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    sendResponse(response);
  });

  return true; // keep the message channel open for the async sendResponse above
});
