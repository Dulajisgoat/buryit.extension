(function () {
  'use strict';

  // DOM refs
  const stateIntro = document.getElementById('stateIntro');
  const stateQuiz = document.getElementById('stateQuiz');
  const stateVerdict = document.getElementById('stateVerdict');

  const modeToggleInput = document.getElementById('modeToggleInput');
  const modeLabelUsd = document.getElementById('modeLabelUsd');
  const modeLabelHours = document.getElementById('modeLabelHours');
  const priceLabel = document.getElementById('priceLabel');
  const wageDetails = document.getElementById('wageDetails');

  const itemNameInput = document.getElementById('itemNameInput');
  const priceInput = document.getElementById('priceInput');
  const wageInput = document.getElementById('wageInput');
  const itemNameError = document.getElementById('itemNameError');
  const priceError = document.getElementById('priceError');
  const analyzeBtn = document.getElementById('analyzeBtn');

  const quizHeaderLine = document.getElementById('quizHeaderLine');
  const progressRow = document.getElementById('progressRow');
  const progressText = document.getElementById('progressText');
  const questionText = document.getElementById('questionText');
  const yesBtn = document.getElementById('yesBtn');
  const noBtn = document.getElementById('noBtn');

  const verdictIconApproved = document.getElementById('verdictIconApproved');
  const verdictIconDenied = document.getElementById('verdictIconDenied');
  const verdictTitle = document.getElementById('verdictTitle');
  const verdictBody = document.getElementById('verdictBody');
  const breakdownItem = document.getElementById('breakdownItem');
  const breakdownPriceLabel = document.getElementById('breakdownPriceLabel');
  const breakdownPrice = document.getElementById('breakdownPrice');
  const breakdownScore = document.getElementById('breakdownScore');
  const breakdownHoursRow = document.getElementById('breakdownHoursRow');
  const breakdownHours = document.getElementById('breakdownHours');
  const copyResultBtn = document.getElementById('copyResultBtn');
  const resetBtn = document.getElementById('resetBtn');

  const QUESTIONS = [
    { text: 'Will you use this at least 3 times in the next month?', yes: 1, no: -1 },
    { text: 'Can you buy this twice right now without stressing about money?', yes: 1, no: -1 },
    { text: 'Do you already own something that does a similar job?', yes: -1, no: 1 },
    { text: 'Did you see this advertised somewhere in the last 48 hours?', yes: -1, no: 1 }
  ];

  let calcMode = 'usd';
  let currentItemName = '';
  let currentPrice = 0;
  let currentWage = null;
  let currentQ = 0;
  let score = 0;
  let transitionLock = false;
  let lastLifeCostHours = null;

  function formatMoney(n) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function formatHours(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function parsePrice(raw) { const trimmed = (raw ?? '').trim(); return trimmed === '' ? NaN : Number(trimmed); }
  function collapseWhitespace(str) { return str.replace(/\s+/g, ' ').trim(); }

  // Mode Toggle
  function applyModeUI() {
    const isHours = calcMode === 'hours';
    modeLabelUsd.classList.toggle('is-active', !isHours);
    modeLabelHours.classList.toggle('is-active', isHours);
    priceLabel.textContent = isHours ? 'How many hours does this cost?' : 'Price (USD)';
    priceInput.placeholder = isHours ? 'e.g. 3.5' : '0.00';
    wageDetails.hidden = isHours;
  }

  modeToggleInput.addEventListener('change', () => {
    calcMode = modeToggleInput.checked ? 'hours' : 'usd';
    clearErrors();
    applyModeUI();
    priceInput.value = '';
    checkFieldsLive();
  });

  // Validation
  function clearErrors() { itemNameError.textContent = ''; priceError.textContent = ''; }

  function validateForm() {
    clearErrors();
    const name = collapseWhitespace(itemNameInput.value);
    const price = parsePrice(priceInput.value);
    let valid = true;

    if (name.length === 0) { itemNameError.textContent = 'Enter what you’re analyzing.'; valid = false; }
    if (!Number.isFinite(price) || price < 0) {
      priceError.textContent = calcMode === 'hours' ? 'Enter a valid number of hours.' : 'Enter a valid price.';
      valid = false;
    }
    return valid;
  }

  function checkFieldsLive() {
    const name = collapseWhitespace(itemNameInput.value);
    const price = parsePrice(priceInput.value);
    analyzeBtn.disabled = !(name.length > 0 && Number.isFinite(price) && price >= 0);
  }

  itemNameInput.addEventListener('input', checkFieldsLive);
  priceInput.addEventListener('input', checkFieldsLive);

  function switchState(hideEl, showEl) {
    hideEl.classList.remove('is-active');
    showEl.classList.add('is-active');
  }

  // Start Quiz
  analyzeBtn.addEventListener('click', () => {
    if (!validateForm()) return;

    currentItemName = collapseWhitespace(itemNameInput.value);
    currentPrice = parsePrice(priceInput.value);
    currentWage = (calcMode !== 'hours' && Number.isFinite(parsePrice(wageInput.value))) ? parsePrice(wageInput.value) : null;

    currentQ = 0;
    score = 0;

    quizHeaderLine.textContent = calcMode === 'hours'
      ? 'Analyzing: ' + currentItemName + ' (' + formatHours(currentPrice) + ' hrs)'
      : 'Analyzing: ' + currentItemName + ' ($' + formatMoney(currentPrice) + ')';

    switchState(stateIntro, stateQuiz);
    renderQuestion();
  });

  function renderQuestion() {
    Array.from(progressRow.children).forEach((seg, i) => {
      seg.classList.toggle('filled', i < currentQ);
    });
    progressText.textContent = 'Question ' + (currentQ + 1) + ' of ' + QUESTIONS.length;
    questionText.textContent = QUESTIONS[currentQ].text;
  }

  function handleAnswer(isYes) {
    if (transitionLock) return;
    transitionLock = true;

    const q = QUESTIONS[currentQ];
    score += isYes ? q.yes : q.no;

    questionText.classList.add('is-leaving');

    setTimeout(() => {
      currentQ++;
      if (currentQ < QUESTIONS.length) {
        renderQuestion();
        questionText.classList.remove('is-leaving');
        transitionLock = false;
      } else {
        Array.from(progressRow.children).forEach(seg => seg.classList.add('filled'));
        switchState(stateQuiz, stateVerdict);
        renderVerdict();
        transitionLock = false;
      }
    }, 160);
  }

  yesBtn.addEventListener('click', () => handleAnswer(true));
  noBtn.addEventListener('click', () => handleAnswer(false));

  // Verdict
  function renderVerdict() {
    const approved = score > 0;
    const isHours = calcMode === 'hours';

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

    let lifeCostHours = null;
    if (isHours) {
      lifeCostHours = currentPrice;
    } else if (currentWage && currentWage > 0) {
      lifeCostHours = currentPrice / currentWage;
    }

    if (lifeCostHours !== null) {
      breakdownHours.textContent = 'That’s ' + lifeCostHours.toFixed(1) + ' hours of your life.';
      breakdownHoursRow.hidden = false;
    } else {
      breakdownHoursRow.hidden = true;
    }
    lastLifeCostHours = lifeCostHours;
  }

  // Copy Result
  copyResultBtn.addEventListener('click', async () => {
    const approved = score > 0;
    const isHours = calcMode === 'hours';
    const lines = [
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
      copyResultBtn.textContent = 'Copied!';
      setTimeout(() => copyResultBtn.textContent = 'Copy result', 2000);
    } catch (err) {
      console.warn('Clipboard failed');
    }
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    itemNameInput.value = '';
    priceInput.value = '';
    wageInput.value = '';
    clearErrors();
    calcMode = 'usd';
    modeToggleInput.checked = false;
    applyModeUI();
    checkFieldsLive();
    switchState(stateVerdict, stateIntro);
    itemNameInput.focus();
  });

})();
