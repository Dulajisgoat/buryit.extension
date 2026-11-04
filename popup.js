// popup.js — toolbar popup logic. Queries the active tab, talks to its
// content script, and renders hostname/toggle/count state.

(function () {
  "use strict";

  var hostnameEl;
  var toggleEl;
  var countEl;
  var resetButtonEl;
  var statusEl;

  var currentTabId = null;

  function showDisabledState(msg) {
    hostnameEl.textContent = "—";
    toggleEl.checked = false;
    toggleEl.disabled = true;
    resetButtonEl.disabled = true;
    statusEl.textContent = msg;
    statusEl.classList.add("buryit-status-error");
  }

  function formatCount(stored, matching) {
    if (stored !== matching) {
      return stored + " buried · " + matching + " hidden now";
    }
    return stored + " element(s) buried";
  }

  function sendToTab(payload, callback) {
    if (currentTabId === null) {
      if (callback) callback(null);
      return;
    }
    chrome.tabs.sendMessage(currentTabId, payload, function (response) {
      if (chrome.runtime.lastError) {
        console.warn("BuryIt popup: message failed:", chrome.runtime.lastError.message);
        if (callback) callback(null);
        return;
      }
      if (callback) callback(response);
    });
  }

  function refresh() {
    sendToTab({ type: "get-state" }, function (stateResponse) {
      if (!stateResponse || !stateResponse.ok) {
        showDisabledState("BuryIt isn't active on this page");
        return;
      }

      hostnameEl.textContent = stateResponse.hostname;
      toggleEl.disabled = false;
      toggleEl.checked = !!stateResponse.enabled;
      resetButtonEl.disabled = false;
      statusEl.textContent = "";
      statusEl.classList.remove("buryit-status-error");

      var storedCount = stateResponse.count;
      countEl.textContent = formatCount(storedCount, storedCount);

      sendToTab({ type: "count-matching" }, function (countResponse) {
        if (countResponse && countResponse.ok) {
          countEl.textContent = formatCount(storedCount, countResponse.count);
        }
      });
    });
  }

  function init() {
    hostnameEl = document.getElementById("hostname");
    toggleEl = document.getElementById("enabledToggle");
    countEl = document.getElementById("count");
    resetButtonEl = document.getElementById("resetButton");
    statusEl = document.getElementById("status");

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError || !tabs || !tabs[0]) {
        showDisabledState("Couldn't find the active tab");
        return;
      }

      var tab = tabs[0];
      var url = tab.url || "";

      if (
        url.indexOf("chrome://") === 0 ||
        url.indexOf("chrome-extension://") === 0 ||
        url.indexOf("edge://") === 0
      ) {
        showDisabledState("BuryIt doesn't run on this page");
        return;
      }

      currentTabId = tab.id;
      refresh();
    });

    toggleEl.addEventListener("change", function () {
      sendToTab({ type: "set-enabled", value: toggleEl.checked }, function (response) {
        if (response && response.ok) {
          refresh();
        }
      });
    });

    resetButtonEl.addEventListener("click", function () {
      sendToTab({ type: "reset" }, function (response) {
        if (response && response.ok) {
          refresh();
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
