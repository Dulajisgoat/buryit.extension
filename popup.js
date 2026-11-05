// ============================================
// Buryit — popup.js
// ============================================
(function () {
  'use strict';

  // ───────────────────────────────────────────────
  // Theme (optional — popup.html may not have a toggle)
  // ───────────────────────────────────────────────
  (function initTheme() {
    try {
      var stored = localStorage.getItem('buryit.theme');
      var theme = (stored === 'light' || stored === 'dark')
        ? stored
        : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
      var meta = document.getElementById('themeColorMeta');
      if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff');
    } catch (err) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();

  // ───────────────────────────────────────────────
  // DOM refs
  // ───────────────────────────────────────────────
  var stateIntro   = document.getElementById('stateIntro');
  var stateQuiz    = document.getElementById('stateQuiz');
  var stateVerdict = document.getElementById('stateVerdict');

  var modeToggleInput = document.getElementById('modeToggleInput');
  var modeLabelUsd    = document.getElementById('modeLabelUsd');
  var modeLabelHours  = document.getElementById('modeLabelHours');
  var priceLabel      = document.getElementById('priceLabel');
  var wageDetails     = document.getElementById('wageDetails');

  var itemNameInput = document.getElementById('itemNameInput');
  var priceInput    = document.getElementById('priceInput');
  var wageInput     = document.getElementById('wageInput');
  var itemNameError = document.getElementById('itemNameError');
  var priceError    = document.getElementById('priceError');
  var analyzeBtn    = document.getElementById('analyzeBtn');

  var quizHeaderLine = document.getElementById('quizHeaderLine');
  var progressRow    = document.getElementById('progressRow');
  var progressText   = document.getElementById('progressText');
  var questionText   = document.getElementById('questionText');
  var yesBtn         = document.getElementById('yesBtn');
  var noBtn          = document.getElementById('noBtn');

  var verdictIconApproved = document.getElementById('verdictIconApproved');
  var verdictIconDenied   = document.getElementById('verdictIconDenied');
  var verdictTitle        = document.getElementById('verdictTitle');
  var verdictBody         = document.getElementById('verdictBody');
  var breakdownItem       = document.getElementById('breakdownItem');
  var breakdownPriceLabel = document.getElementById('breakdownPriceLabel');
  var breakdownPrice      = document.getElementById('breakdownPrice');
  var breakdownScore      = document.getElementById('breakdownScore');
  var breakdownHoursRow   = document.getElementById('breakdownHoursRow');
  var breakdownHours      = document.getElementById('breakdownHours');
  var copyResultBtn       = document.getElementById('copyResultBtn');
  var resetBtn            = document.getElementById('resetBtn');

  var statStrip     = document.getElementById('statStrip');
  var statStripText = document.getElementById('statStripText');
  var statClearBtn  = document.getElementById('statClearBtn');
  var viewHistoryBtn = document.getElementById('viewHistoryBtn');

  var historyOverlay   = document.getElementById('historyOverlay');
  var historyModal     = document.getElementById('historyModal');
  var historyModalBody = document.getElementById('historyModalBody');
  var historyCloseBtn  = document.getElementById('historyCloseBtn');

  var toastContainer = document.getElementById('toastContainer');

  var themeToggleBtn = document.getElementById('themeToggleBtn');
  var themeColorMeta = document.getElementById('themeColorMeta');

  // ───────────────────────────────────────────────
  // Theme toggle (only if the button exists)
  // ───────────────────────────────────────────────
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function updateThemeToggleLabel() {
    if (!themeToggleBtn) return;
    var theme = currentTheme();
    themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('buryit.theme', next); } catch (err) { /* noop */ }
      if (themeColorMeta) themeColorMeta.content = next === 'dark' ? '#0a0a0a' : '#ffffff';
      updateThemeToggleLabel();
    });
    updateThemeToggleLabel();
  }

  // ───────────────────────────────────────────────
  // Toasts
  // ───────────────────────────────────────────────
  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('is-visible');
      });
    });

    setTimeout(function () {
      toast.classList.remove('is-visible');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, 3000);
  }

  // ───────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────
  var QUESTIONS = [
    { text: 'Will you use this at least 3 times in the next month?', yes: 1, no: -1 },
    { text: 'Can you buy this twice right now without stressing about money?', yes: 1, no: -1 },
    { text: 'Do you already own something that does a similar job?', yes: -1, no: 1 },
    { text: 'Did you see this advertised somewhere in the last 48 hours?', yes: -1, no: 1 }
  ];

  var calcMode = 'usd';
  var currentItemName = '';
  var currentPrice = 0;
  var currentWage = null;
  var currentQ = 0;
  var score = 0;
  var answers = { q1: null, q2: null, q3: null, q4: null };
  var transitionLock = false;
  var lastLifeCostHours = null;

  // ───────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────
  function collapseWhitespace(str) {
    return String(str || '').replace(/\s+/g, ' ').trim();
  }
  function formatMoney(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatHours(n) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function parsePrice(raw) {
    var trimmed = (raw == null ? '' : String(raw)).trim();
    return trimmed === '' ? NaN : Number(trimmed);
  }
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ───────────────────────────────────────────────
  // Mode toggle (USD vs Hours)
  // ───────────────────────────────────────────────
  function applyModeUI() {
    var isHours = calcMode === 'hours';
    modeLabelUsd.classList.toggle('is-active', !isHours);
    modeLabelHours.classList.toggle('is-active', isHours);
    priceLabel.textContent = isHours ? 'How many hours does this cost?' : 'Price (USD)';
    priceInput.placeholder = isHours ? 'e.g. 3.5' : '0.00';
    wageDetails.hidden = isHours;
  }

  modeToggleInput.addEventListener('change', function () {
    calcMode = modeToggleInput.checked ? 'hours' : 'usd';
    clearErrors();
    applyModeUI();
    priceInput.value = '';
    checkFieldsLive();
  });

  function resetMode() {
    calcMode = 'usd';
    modeToggleInput.checked = false;
    applyModeUI();
  }

  applyModeUI();

  // ───────────────────────────────────────────────
  // Validation
  // ───────────────────────────────────────────────
  function clearErrors() {
    itemNameError.textContent = '';
    priceError.textContent = '';
  }

  function validateForm() {
    clearErrors();
    var name = collapseWhitespace(itemNameInput.value);
    var price = parsePrice(priceInput.value);
    var valid = true;

    if (name.length === 0) {
      itemNameError.textContent = 'Enter what you\u2019re analyzing.';
      valid = false;
    }
    if (!Number.isFinite(price) || price < 0) {
      priceError.textContent = calcMode === 'hours' ? 'Enter a valid number of hours.' : 'Enter a valid price.';
      valid = false;
    } else if (price > 1000000) {
      priceError.textContent = calcMode === 'hours' ? 'Hours must be 1,000,000 or less.' : 'Price must be 1,000,000 or less.';
      valid = false;
    }
    return valid;
  }

  function checkFieldsLive() {
    var name = collapseWhitespace(itemNameInput.value);
    var price = parsePrice(priceInput.value);
    var nameOk = name.length > 0;
    var priceOk = Number.isFinite(price) && price >= 0 && price <= 1000000;
    analyzeBtn.disabled = !(nameOk && priceOk);
  }

  itemNameInput.addEventListener('input', checkFieldsLive);
  priceInput.addEventListener('input', checkFieldsLive);

  function switchState(hideEl, showEl) {
    hideEl.classList.remove('is-active');
    showEl.classList.add('is-active');
  }

  function focusAfterTransition(el) {
    setTimeout(function () { el.focus(); }, 200);
  }

  // ───────────────────────────────────────────────
  // STATE A → B
  // ───────────────────────────────────────────────
  analyzeBtn.addEventListener('click', function () {
    if (!validateForm()) return;

    currentItemName = collapseWhitespace(itemNameInput.value);
    currentPrice = parsePrice(priceInput.value);

    if (calcMode === 'hours') {
      currentWage = null;
    } else {
      var wageParsed = parsePrice(wageInput.value);
      currentWage = (Number.isFinite(wageParsed) && wageParsed > 0) ? wageParsed : null;
    }

    currentQ = 0;
    score = 0;
    answers = { q1: null, q2: null, q3: null, q4: null };

    quizHeaderLine.textContent = calcMode === 'hours'
      ? 'Analyzing: ' + currentItemName + ' (' + formatHours(currentPrice) + ' hrs)'
      : 'Analyzing: ' + currentItemName + ' ($' + formatMoney(currentPrice) + ')';

    switchState(stateIntro, stateQuiz);
    renderQuestion();
    focusAfterTransition(yesBtn);
  });

  // ───────────────────────────────────────────────
  // STATE B — quiz
  // ───────────────────────────────────────────────
  function renderQuestion() {
    Array.prototype.forEach.call(progressRow.children, function (seg, i) {
      seg.classList.toggle('filled', i < currentQ);
    });
    progressText.textContent = 'Question ' + (currentQ + 1) + ' of ' + QUESTIONS.length;
    questionText.textContent = QUESTIONS[currentQ].text;
  }

  function handleAnswer(isYes) {
    if (transitionLock) return;
    transitionLock = true;

    var q = QUESTIONS[currentQ];
    score += isYes ? q.yes : q.no;
    answers['q' + (currentQ + 1)] = isYes;

    questionText.classList.add('is-leaving');

    setTimeout(function () {
      currentQ++;
      if (currentQ < QUESTIONS.length) {
        renderQuestion();
        questionText.classList.remove('is-leaving');
        transitionLock = false;
      } else {
        Array.prototype.forEach.call(progressRow.children, function (seg) {
          seg.classList.add('filled');
        });
        switchState(stateQuiz, stateVerdict);
        renderVerdict();
        focusAfterTransition(resetBtn);
        transitionLock = false;
      }
    }, 160);
  }

  yesBtn.addEventListener('click', function () { handleAnswer(true); });
  noBtn.addEventListener('click',  function () { handleAnswer(false); });

  document.addEventListener('keydown', function (e) {
    if (isHistoryModalOpen()) {
      if (e.key === 'Escape') closeHistoryModal();
      return;
    }
    if (!stateQuiz.classList.contains('is-active')) return;
    if (transitionLock) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'Enter' || e.key.toLowerCase() === 'y') {
      handleAnswer(true);
    } else if (e.key.toLowerCase() === 'n') {
      handleAnswer(false);
    }
  });

  // ───────────────────────────────────────────────
  // STATE C — verdict
  // ───────────────────────────────────────────────
  function renderVerdict() {
    var approved = score > 0;
    var verdictLabelLocal = approved ? 'Approved' : 'Denied';
    var isHours = calcMode === 'hours';

    verdictIconApproved.hidden = !approved;
    verdictIconDenied.hidden = approved;

    verdictTitle.textContent = approved ? 'APPROVED.' : 'DENIED.';
    verdictBody.textContent = approved
      ? 'This purchase is justified. Go ahead.'
      : 'This is an impulse buy. Walk away and save your money.';

    breakdownItem.textContent = currentItemName;
    breakdownPriceLabel.textContent = isHours ? 'Hours' : 'Price';
    breakdownPrice.textContent = isHours ? formatHours(currentPrice) + ' hrs' : '$' + formatMoney(currentPrice);
    breakdownScore.textContent = 'Score ' + score + ' of 4';

    var lifeCostHours = null;
    if (isHours) {
      lifeCostHours = currentPrice;
    } else if (currentWage && currentWage > 0) {
      lifeCostHours = currentPrice / currentWage;
    }

    if (lifeCostHours !== null) {
      breakdownHours.textContent = 'That\u2019s ' + lifeCostHours.toFixed(1) + ' hours of your life.';
      breakdownHoursRow.hidden = false;
    } else {
      breakdownHoursRow.hidden = true;
    }

    lastLifeCostHours = lifeCostHours;
    recordHistory(verdictLabelLocal);
  }

  // ───────────────────────────────────────────────
  // Copy result
  // ───────────────────────────────────────────────
  copyResultBtn.addEventListener('click', async function () {
    var approved = score > 0;
    var isHours = calcMode === 'hours';
    var lines = [
      'Buryit verdict: ' + (approved ? 'APPROVED' : 'DENIED'),
      'Item: ' + currentItemName,
      isHours ? 'Hours: ' + formatHours(currentPrice) : 'Price: $' + formatMoney(currentPrice),
      'Score: ' + score + ' of 4'
    ];
    if (!isHours && lastLifeCostHours !== null) {
      lines.push('Life cost: ' + lastLifeCostHours.toFixed(1) + ' hours');
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('Copied to clipboard');
    } catch (err) {
      console.warn('[Buryit] clipboard write failed', err);
      showToast('Failed to copy');
    }
  });

  // ───────────────────────────────────────────────
  // Reset
  // ───────────────────────────────────────────────
  resetBtn.addEventListener('click', function () {
    itemNameInput.value = '';
    priceInput.value = '';
    wageInput.value = '';
    clearErrors();
    resetMode();
    checkFieldsLive();
    switchState(stateVerdict, stateIntro);
    focusAfterTransition(itemNameInput);
  });

  // ───────────────────────────────────────────────
  // Local persistence
  // ───────────────────────────────────────────────
  var HISTORY_KEY = 'buryit.history';
  var DENIED_TOTAL_KEY = 'buryit.deniedTotal';
  var HISTORY_CAP = 50;

  function readHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function readDeniedTotal() {
    var raw = localStorage.getItem(DENIED_TOTAL_KEY);
    if (raw === null) return { usd: 0, hours: 0 };
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        var usd = Number.parseFloat(parsed.usd);
        var hours = Number.parseFloat(parsed.hours);
        return {
          usd: Number.isFinite(usd) ? usd : 0,
          hours: Number.isFinite(hours) ? hours : 0
        };
      }
      var n = Number(parsed);
      return { usd: Number.isFinite(n) ? n : 0, hours: 0 };
    } catch (err) {
      var n2 = Number.parseFloat(raw);
      return { usd: Number.isFinite(n2) ? n2 : 0, hours: 0 };
    }
  }

  function recordHistory(verdictLabel) {
    try {
      var history = readHistory();
      history.unshift({
        itemName: currentItemName,
        price: currentPrice,
        mode: calcMode,
        verdict: verdictLabel,
        score: score,
        at: new Date().toISOString()
      });
      var capped = history.slice(0, HISTORY_CAP);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));

      if (verdictLabel === 'Denied') {
        var totals = readDeniedTotal();
        if (calcMode === 'hours') {
          totals.hours += currentPrice;
        } else {
          totals.usd += currentPrice;
        }
        localStorage.setItem(DENIED_TOTAL_KEY, JSON.stringify(totals));
      }
    } catch (err) {
      console.warn('[Buryit] local persistence failed', err);
    }
    renderStatStrip();
  }

  function renderStatStrip() {
    var history = readHistory();
    var totals = readDeniedTotal();
    var deniedCount = history.filter(function (h) { return h.verdict === 'Denied'; }).length;

    if (deniedCount === 0) {
      statStrip.classList.remove('is-visible');
      return;
    }

    var parts = [];
    if (totals.usd > 0) parts.push('$' + formatMoney(totals.usd));
    if (totals.hours > 0) parts.push(formatHours(totals.hours) + ' hrs');
    if (parts.length === 0) parts.push('$' + formatMoney(0));

    statStripText.textContent = '';
    statStripText.appendChild(document.createTextNode('You\u2019ve talked yourself out of '));
    parts.forEach(function (part, i) {
      var strong = document.createElement('strong');
      strong.textContent = part;
      statStripText.appendChild(strong);
      if (i < parts.length - 1) {
        statStripText.appendChild(document.createTextNode(' and '));
      }
    });
    statStripText.appendChild(document.createTextNode(' across '));
    var strongCount = document.createElement('strong');
    strongCount.textContent = String(deniedCount);
    statStripText.appendChild(strongCount);
    statStripText.appendChild(document.createTextNode(deniedCount === 1 ? ' item.' : ' items.'));

    statStrip.classList.add('is-visible');
  }

  statClearBtn.addEventListener('click', function () {
    try {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(DENIED_TOTAL_KEY);
    } catch (err) {
      console.warn('[Buryit] clear failed', err);
    }
    renderStatStrip();
    showToast('History cleared');
  });

  // ───────────────────────────────────────────────
  // History modal
  // ───────────────────────────────────────────────
  var lastFocusedBeforeModal = null;

  function isHistoryModalOpen() {
    return !historyOverlay.hidden;
  }

  function renderHistoryModalBody() {
    var history = readHistory().slice(0, 10);
    historyModalBody.innerHTML = '';

    if (history.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'No checks yet.';
      historyModalBody.appendChild(empty);
      return;
    }

    history.forEach(function (entry) {
      var row = document.createElement('div');
      row.className = 'history-row';

      var info = document.createElement('div');
      info.className = 'history-info';

      var name = document.createElement('div');
      name.className = 'history-item-name';
      name.textContent = entry.itemName || 'Untitled';

      var priceLine = document.createElement('div');
      priceLine.className = 'history-item-price';
      var priceNum = Number(entry.price);
      priceLine.textContent = entry.mode === 'hours'
        ? formatHours(Number.isFinite(priceNum) ? priceNum : 0) + ' hrs'
        : '$' + formatMoney(Number.isFinite(priceNum) ? priceNum : 0);

      info.appendChild(name);
      info.appendChild(priceLine);

      var badge = document.createElement('span');
      var approved = entry.verdict === 'Approved';
      badge.className = 'history-badge ' + (approved ? 'approved' : 'denied');
      badge.textContent = approved ? 'Approved' : 'Denied';

      row.appendChild(info);
      row.appendChild(badge);
      historyModalBody.appendChild(row);
    });
  }

  function getFocusableInModal() {
    return Array.prototype.slice.call(
      historyModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var focusable = getFocusableInModal();
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openHistoryModal() {
    lastFocusedBeforeModal = document.activeElement;
    renderHistoryModalBody();
    historyOverlay.hidden = false;
    requestAnimationFrame(function () {
      historyOverlay.classList.add('is-open');
    });
    historyModal.addEventListener('keydown', trapFocus);
    setTimeout(function () { historyCloseBtn.focus(); }, 200);
  }

  function closeHistoryModal() {
    historyOverlay.classList.remove('is-open');
    historyModal.removeEventListener('keydown', trapFocus);
    setTimeout(function () {
      historyOverlay.hidden = true;
      if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
        lastFocusedBeforeModal.focus();
      }
    }, 180);
  }

  viewHistoryBtn.addEventListener('click', openHistoryModal);
  historyCloseBtn.addEventListener('click', closeHistoryModal);
  historyOverlay.addEventListener('click', function (e) {
    if (e.target === historyOverlay) closeHistoryModal();
  });

  // ───────────────────────────────────────────────
  // Price detection (opt-in, per-tab)
  // ───────────────────────────────────────────────
  (function initPriceDetection() {
    var ids = {
      trigger:  'buryitDetectTrigger',
      status:   'buryitDetectStatus',
      panel:    'buryitConsent',
      allowBtn: 'buryitConsentAllow',
      cancelBtn:'buryitConsentCancel',
      priceEl:  'priceInput'
    };

    var els = {};
    var missing = [];
    for (var key in ids) {
      els[key] = document.getElementById(ids[key]);
      if (!els[key]) missing.push(ids[key]);
    }

    if (missing.length) {
      console.error(
        '[Buryit] Price detection disabled \u2014 missing element(s): ' +
        missing.join(', ') + '. Check popup.html for these IDs.'
      );
      if (els.status) {
        els.status.textContent = 'Price detection unavailable. Enter price manually.';
        els.status.classList.add('is-error');
      }
      return;
    }

    var trigger   = els.trigger;
    var status    = els.status;
    var panel     = els.panel;
    var allowBtn  = els.allowBtn;
    var cancelBtn = els.cancelBtn;
    var priceEl   = els.priceEl;

    if (!chrome || !chrome.scripting) {
      trigger.disabled = true;
      trigger.title = 'Price detection requires the extension.';
      console.warn('[Buryit] chrome.scripting not available. Reload the extension in chrome://extensions.');
      return;
    }

    function setStatus(msg, isError) {
      status.textContent = msg || '';
      status.classList.toggle('is-error', !!isError);
    }

    function getActiveTab() {
      return new Promise(function (resolve) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          var tab = tabs && tabs[0];
          if (!tab || !tab.id) {
            resolve({ tab: null, reason: 'no-tab' });
            return;
          }
          var url = tab.url || '';
          if (url.indexOf('chrome-extension://') === 0) {
            resolve({ tab: null, reason: 'standalone-window' });
            return;
          }
          if (!/^https?:/i.test(url)) {
            resolve({ tab: null, reason: 'unsupported-scheme' });
            return;
          }
          resolve({ tab: tab, reason: null });
        });
      });
    }

    function reasonMessage(reason) {
      if (reason === 'standalone-window') {
        return 'Open Buryit from the toolbar icon on the product page to detect its price.';
      }
      if (reason === 'unsupported-scheme') {
        return 'This page can\u2019t be read. Try a normal product page.';
      }
      return 'No active tab found.';
    }

    trigger.addEventListener('click', async function () {
      setStatus('');
      var result = await getActiveTab();
      if (!result.tab) {
        setStatus(reasonMessage(result.reason), true);
        return;
      }
      panel.hidden = false;
      allowBtn.focus();
    });

    cancelBtn.addEventListener('click', function () {
      panel.hidden = true;
      setStatus('');
      trigger.focus();
    });

    allowBtn.addEventListener('click', async function () {
      panel.hidden = true;
      setStatus('Reading page\u2026');
      trigger.disabled = true;

      var result = await getActiveTab();
      if (!result.tab) {
        setStatus(reasonMessage(result.reason), true);
        trigger.disabled = false;
        return;
      }

      try {
        var injection = await chrome.scripting.executeScript({
          target: { tabId: result.tab.id },
          func: scrapePriceFromPage
        });

        var found = injection && injection[0] && injection[0].result;
        if (found && typeof found.price === 'number' && found.price > 0) {
          priceEl.value = String(found.price);
          priceEl.dispatchEvent(new Event('input', { bubbles: true }));
          priceEl.dispatchEvent(new Event('change', { bubbles: true }));
          setStatus('Found: ' + (found.currency ? found.currency + ' ' : '') + found.price.toFixed(2));
        } else {
          setStatus('Could not find a price on this page. Enter it manually.', true);
        }
      } catch (err) {
        console.error('[Buryit] executeScript failed:', err);
        setStatus('This page can\u2019t be read. Try opening Buryit from the toolbar icon.', true);
      } finally {
        trigger.disabled = false;
      }
    });

    // Runs inside the target tab. Must be self-contained — it is serialized.
    function scrapePriceFromPage() {
      function toNumber(raw) {
        if (raw == null) return null;
        if (typeof raw === 'number' && isFinite(raw)) {
          return raw >= 0 && raw < 1000000 ? raw : null;
        }
        var s = String(raw).trim();
        if (!s) return null;
        var cleaned = s.replace(/[^\d.,\-]/g, '');
        var lastDot = cleaned.lastIndexOf('.');
        var lastComma = cleaned.lastIndexOf(',');
        if (lastDot > -1 && lastComma > -1) {
          if (lastComma > lastDot) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          } else {
            cleaned = cleaned.replace(/,/g, '');
          }
        } else if (lastComma > -1) {
          var after = cleaned.slice(lastComma + 1);
          if (after.length === 3 && cleaned.length > 4) {
            cleaned = cleaned.replace(/,/g, '');
          } else {
            cleaned = cleaned.replace(',', '.');
          }
        }
        var n = parseFloat(cleaned);
        return isFinite(n) && n >= 0 && n < 1000000 ? n : null;
      }

      function detectCurrency(text) {
        if (!text) return null;
        if (/\$|USD/i.test(text)) return 'USD';
        if (/\u20AC|EUR/i.test(text)) return 'EUR';
        if (/\u00A3|GBP/i.test(text)) return 'GBP';
        return null;
      }

      var ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < ldScripts.length; i++) {
        try {
          var data = JSON.parse(ldScripts[i].textContent || '');
          var stack = [data];
          while (stack.length) {
            var node = stack.pop();
            if (!node || typeof node !== 'object') continue;
            if (Array.isArray(node)) { stack.push.apply(stack, node); continue; }
            var type = node['@type'];
            if (type === 'Product' || type === 'Offer' || type === 'AggregateOffer' ||
                (Array.isArray(type) && type.indexOf('Product') > -1)) {
              var direct = node.price != null ? node.price : null;
              if (direct == null && node.offers && !Array.isArray(node.offers)) {
                direct = node.offers.price;
              }
              var p = toNumber(direct);
              if (p !== null) {
                return {
                  price: p,
                  currency: node.priceCurrency ||
                            (node.offers && node.offers.priceCurrency) || null,
                  source: 'json-ld'
                };
              }
              if (node.offers) stack.push(node.offers);
            }
            for (var k in node) {
              if (k === '@context') continue;
              if (node[k] && typeof node[k] === 'object') stack.push(node[k]);
            }
          }
        } catch (e) { /* ignore malformed JSON-LD */ }
      }

      var meta = document.querySelector(
        'meta[property="product:price:amount"], meta[property="og:price:amount"], meta[itemprop="price"]'
      );
      if (meta) {
        var mp = toNumber(meta.getAttribute('content'));
        if (mp !== null) {
          var cur = document.querySelector(
            'meta[property="product:price:currency"], meta[property="og:price:currency"]'
          );
          return { price: mp, currency: (cur && cur.getAttribute('content')) || null, source: 'meta' };
        }
      }

      var md = document.querySelector('[itemprop="price"]');
      if (md) {
        var mdp = toNumber(md.getAttribute('content') || md.textContent);
        if (mdp !== null) {
          var curEl = document.querySelector('[itemprop="priceCurrency"]');
          return {
            price: mdp,
            currency: (curEl && (curEl.getAttribute('content') || curEl.textContent)) || null,
            source: 'microdata'
          };
        }
      }

      var selectors = [
        '[data-price]',
        '[data-product-price]',
        '[data-testid*="price" i]',
        '.product-price',
        '.price-current',
        '.price-now',
        '.current-price',
        '#price',
        '.price',
        '.a-price .a-offscreen'
      ];
      for (var s = 0; s < selectors.length; s++) {
        var els2 = document.querySelectorAll(selectors[s]);
        for (var j = 0; j < els2.length; j++) {
          var raw = els2[j].getAttribute('data-price') ||
                    els2[j].getAttribute('content') ||
                    els2[j].textContent;
          var hp = toNumber(raw);
          if (hp !== null && hp > 0) {
            return { price: hp, currency: detectCurrency(raw), source: 'heuristic' };
          }
        }
      }

      return { price: null, currency: null, source: null };
    }
  })();

  // ───────────────────────────────────────────────
  // Init
  // ───────────────────────────────────────────────
  renderStatStrip();
})();
