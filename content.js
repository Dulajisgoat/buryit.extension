// content.js — runs in the page. Tracks the last right-clicked element,
// generates stable selectors, applies/removes the buried marker, and
// keeps itself in sync with storage across reloads, SPA navigations,
// and DOM mutations.

(function () {
  "use strict";

  if (window.__buryItLoaded) return;
  window.__buryItLoaded = true;

  // Right-clicks inside iframes are unsupported in v1 — no all_frames in
  // the manifest, and this guard keeps the top frame as the sole listener.
  if (window.top !== window.self) return;

  var HIDDEN_MARKER = "data-buryit";
  var STORAGE_KEY = "buryit_" + location.hostname;
  var ENABLED_KEY = "buryit_enabled_" + location.hostname;

  var cachedList = [];
  var enabled = true;
  var lastTarget = null;
  var mutationDebounceTimer = null;

  function showToast(message) {
    var toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText =
      "position:fixed; bottom:16px; right:16px; background:#1a1a1a; color:#fff; padding:8px 12px; border-radius:6px; font:13px system-ui; z-index:2147483647; pointer-events:none";
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2000);
  }

  function generateSelector(el) {
    if (!el || el === document.body || el === document.documentElement) {
      return null;
    }

    var attrOrder = ["data-testid", "data-id", "aria-label", "href", "role"];
    for (var i = 0; i < attrOrder.length; i++) {
      var attr = attrOrder[i];
      var value = el.getAttribute(attr);
      if (!value) continue;
      var tag = el.tagName.toLowerCase();
      var candidate = tag + "[" + attr + '="' + CSS.escape(value) + '"]';
      try {
        var matches = document.querySelectorAll(candidate);
        if (matches.length === 1 && matches[0] === el) {
          return candidate;
        }
      } catch (e) {
        // malformed candidate for this attribute value, try the next one
      }
    }

    var segments = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.id) {
        segments.unshift("#" + CSS.escape(node.id));
        break;
      }
      var parent = node.parentElement;
      if (!parent) break;
      var sameTagSiblings = [];
      for (var j = 0; j < parent.children.length; j++) {
        if (parent.children[j].tagName === node.tagName) {
          sameTagSiblings.push(parent.children[j]);
        }
      }
      var position = sameTagSiblings.indexOf(node) + 1;
      segments.unshift(node.tagName.toLowerCase() + ":nth-of-type(" + position + ")");
      node = parent;
    }

    if (segments.length === 0) return null;

    var fullSelector = "body > " + segments.join(" > ");

    try {
      var finalMatches = document.querySelectorAll(fullSelector);
      if (
        finalMatches.length === 1 &&
        finalMatches[0] !== document.body &&
        finalMatches[0] !== document.documentElement
      ) {
        return fullSelector;
      }
    } catch (e) {
      // invalid selector, fall through to null
    }

    return null;
  }

  function applyBuriedSelectors() {
    for (var i = 0; i < cachedList.length; i++) {
      try {
        var matches = document.querySelectorAll(cachedList[i]);
        for (var j = 0; j < matches.length; j++) {
          matches[j].setAttribute(HIDDEN_MARKER, "");
        }
      } catch (e) {
        // skip an invalid stored selector rather than throwing
      }
    }
  }

  function applyBuriedSelectorsIfEnabled() {
    if (enabled) applyBuriedSelectors();
  }

  function unburyAll() {
    var hidden = document.querySelectorAll("[" + HIDDEN_MARKER + "]");
    for (var i = 0; i < hidden.length; i++) {
      hidden[i].removeAttribute(HIDDEN_MARKER);
    }
  }

  function loadFromStorage(callback) {
    chrome.storage.local.get([STORAGE_KEY, ENABLED_KEY], function (result) {
      if (chrome.runtime.lastError) {
        console.warn("BuryIt: storage read failed:", chrome.runtime.lastError.message);
        if (callback) callback();
        return;
      }
      cachedList = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
      enabled = result[ENABLED_KEY] === undefined ? true : !!result[ENABLED_KEY];
      if (callback) callback();
    });
  }

  function saveList(callback) {
    var data = {};
    data[STORAGE_KEY] = cachedList;
    chrome.storage.local.set(data, function () {
      if (chrome.runtime.lastError) {
        console.warn("BuryIt: storage write failed:", chrome.runtime.lastError.message);
      }
      if (callback) callback();
    });
  }

  function saveEnabled(value, callback) {
    var data = {};
    data[ENABLED_KEY] = value;
    chrome.storage.local.set(data, function () {
      if (chrome.runtime.lastError) {
        console.warn("BuryIt: storage write failed:", chrome.runtime.lastError.message);
      }
      if (callback) callback();
    });
  }

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== "local") return;

    if (changes[STORAGE_KEY]) {
      cachedList = Array.isArray(changes[STORAGE_KEY].newValue)
        ? changes[STORAGE_KEY].newValue
        : [];
      applyBuriedSelectorsIfEnabled();
    }

    if (changes[ENABLED_KEY]) {
      enabled = !!changes[ENABLED_KEY].newValue;
      if (enabled) {
        applyBuriedSelectors();
      } else {
        unburyAll();
      }
    }
  });

  document.addEventListener(
    "contextmenu",
    function (e) {
      lastTarget = e.target;
    },
    true
  );

  var observer = new MutationObserver(function () {
    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = setTimeout(function () {
      applyBuriedSelectorsIfEnabled();
    }, 150);
  });

  function startObserving() {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function onNavigate() {
    setTimeout(function () {
      applyBuriedSelectorsIfEnabled();
    }, 0);
  }

  var originalPushState = history.pushState;
  history.pushState = function () {
    var result = originalPushState.apply(this, arguments);
    onNavigate();
    return result;
  };

  var originalReplaceState = history.replaceState;
  history.replaceState = function () {
    var result = originalReplaceState.apply(this, arguments);
    onNavigate();
    return result;
  };

  window.addEventListener("popstate", onNavigate);

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || !message.type) return false;

    if (message.type === "bury-last-target") {
      if (!lastTarget) {
        showToast("BuryIt: no recent right-click target found");
        sendResponse({ ok: false, error: "no-target" });
        return false;
      }
      var selector = generateSelector(lastTarget);
      if (!selector) {
        showToast("BuryIt: couldn't build a selector for that element");
        sendResponse({ ok: false, error: "no-selector" });
        return false;
      }
      if (cachedList.indexOf(selector) === -1) {
        cachedList.push(selector);
        saveList();
      }
      applyBuriedSelectorsIfEnabled();
      lastTarget = null;
      sendResponse({ ok: true, selector: selector });
      return false;
    }

    if (message.type === "count-matching") {
      var seen = new Set();
      for (var i = 0; i < cachedList.length; i++) {
        try {
          var matches = document.querySelectorAll(cachedList[i]);
          for (var j = 0; j < matches.length; j++) {
            seen.add(matches[j]);
          }
        } catch (e) {
          // skip an invalid stored selector
        }
      }
      sendResponse({ ok: true, count: seen.size });
      return false;
    }

    if (message.type === "get-state") {
      sendResponse({
        ok: true,
        hostname: location.hostname,
        count: cachedList.length,
        enabled: enabled
      });
      return false;
    }

    if (message.type === "set-enabled") {
      enabled = !!message.value;
      saveEnabled(enabled, function () {
        if (enabled) {
          applyBuriedSelectors();
        } else {
          unburyAll();
        }
        sendResponse({ ok: true });
      });
      return true; // async response
    }

    if (message.type === "reset") {
      cachedList = [];
      saveList(function () {
        unburyAll();
        sendResponse({ ok: true });
      });
      return true; // async response
    }

    return false;
  });

  loadFromStorage(function () {
    applyBuriedSelectorsIfEnabled();
    startObserving();
  });
})();
