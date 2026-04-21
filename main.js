/*
  郵便番号・住所検索ツール
  - 入力整形
  - 候補取得
  - API 呼び出し
  - 画面表示
  - コピー
  を分けて扱う構成にしています。
*/

(() => {
  const API_CONFIG = {
    endpoints: {
      postalSearch: '/api/postal-search',
      addressSearch: '/api/address-search',
    },
    timeoutMs: 10000,
    debounceMs: 320,
    postalMinChars: 3,
    addressMinChars: 2,
  };

  const SEARCH_MODES = {
    postal: {
      label: '郵便番号',
      placeholder: '郵便番号を入力',
      inputMode: 'numeric',
      autocomplete: 'off',
      buttonLabel: 'この内容で表示',
      idleHint: '郵便番号は 3 桁以上で候補を表示します。',
      emptyMessage: '郵便番号を入力してください',
    },
    address: {
      label: '住所',
      placeholder: '住所を入力',
      inputMode: 'text',
      autocomplete: 'street-address',
      buttonLabel: 'この内容で表示',
      idleHint: '住所を 2 文字以上入力すると候補を表示します。',
      emptyMessage: '住所を入力してください',
    },
  };

  const state = {
    mode: 'postal',
    feedbackTimerId: null,
    debounceTimerId: null,
    suggestions: [],
    activeSuggestionIndex: -1,
    lastSuggestionRequestId: 0,
    activeSuggestionController: null,
    isSubmitting: false,
  };

  const elements = {
    form: document.getElementById('search-form'),
    input: document.getElementById('search-input'),
    inputLabel: document.getElementById('input-label'),
    helperText: document.getElementById('helper-text'),
    modeInputs: document.querySelectorAll('input[name="searchMode"]'),
    searchButton: document.getElementById('search-button'),
    clearButton: document.getElementById('clear-button'),
    resultSection: document.getElementById('result-section'),
    errorMessage: document.getElementById('error-message'),
    copyFeedback: document.getElementById('copy-feedback'),
    suggestionStatus: document.getElementById('suggestion-status'),
    suggestionsPanel: document.getElementById('suggestions-panel'),
  };

  function normalizeText(input) {
    return String(input || '')
      .replace(/\u3000/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function convertFullWidthNumbers(value) {
    return String(value || '').replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    );
  }

  function normalizePostalCode(input) {
    const trimmed = normalizeText(input);
    const halfWidth = convertFullWidthNumbers(trimmed);
    return halfWidth.replace(/[^0-9]/g, '');
  }

  function validatePostalCode(postalCode) {
    if (!postalCode) {
      return '郵便番号を入力してください';
    }

    if (postalCode.length < API_CONFIG.postalMinChars) {
      return '郵便番号は3桁以上で入力してください';
    }

    return '';
  }

  function validateAddress(address) {
    if (!address) {
      return '住所を入力してください';
    }

    return '';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function debounce(callback, delay) {
    return (...args) => {
      if (state.debounceTimerId) {
        window.clearTimeout(state.debounceTimerId);
      }

      state.debounceTimerId = window.setTimeout(() => {
        state.debounceTimerId = null;
        callback(...args);
      }, delay);
    };
  }

  async function requestJson(url, params = {}, options = {}) {
    const requestUrl = new URL(url, window.location.origin);
    const controller = new AbortController();
    const signal = controller.signal;
    let removeAbortListener = null;
    const timeoutId = window.setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        const abortHandler = () => controller.abort();
        options.signal.addEventListener('abort', abortHandler, { once: true });
        removeAbortListener = () => {
          options.signal.removeEventListener('abort', abortHandler);
        };
      }
    }

    Object.entries(params).forEach(([key, value]) => {
      requestUrl.searchParams.set(key, value);
    });

    try {
      const response = await fetch(requestUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal,
      });

      let data;

      try {
        data = await response.json();
      } catch (error) {
        throw new Error('invalid-response');
      }

      if (!response.ok) {
        const errorCode = typeof data?.error === 'string' ? data.error : 'network';
        throw new Error(errorCode);
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (removeAbortListener) {
        removeAbortListener();
      }
    }
  }

  async function fetchAddressByPostalCode(postalCode, options = {}) {
    const response = await requestJson(
      API_CONFIG.endpoints.postalSearch,
      { postalCode },
      options
    );

    if (!Array.isArray(response?.results)) {
      throw new Error('invalid-response');
    }

    return response.results;
  }

  async function fetchPostalCodesByAddress(address, options = {}) {
    const response = await requestJson(
      API_CONFIG.endpoints.addressSearch,
      { address },
      options
    );

    if (!Array.isArray(response?.results)) {
      throw new Error('invalid-response');
    }

    return response.results;
  }

  function renderSelectedResult(item) {
    const html = `
      <div class="result-panel">
        <h2 class="result-title">選択した候補</h2>
        <div class="result-grid">
          <div class="result-row">
            <span class="result-label">郵便番号</span>
            <span class="result-value">${escapeHtml(item.formattedZipCode)}</span>
          </div>
          <div class="result-row">
            <span class="result-label">住所</span>
            <span class="result-value">${escapeHtml(item.address)}</span>
            ${item.addressKana ? `<span class="result-kana">${escapeHtml(item.addressKana)}</span>` : ''}
          </div>
        </div>
        <div class="copy-row">
          <button type="button" class="copy-button" data-copy-value="${escapeHtml(item.zipCode)}">郵便番号をコピー</button>
          <button type="button" class="copy-button" data-copy-value="${escapeHtml(item.address)}">住所をコピー</button>
          <button type="button" class="copy-button" data-copy-value="${escapeHtml(`${item.zipCode} ${item.address}`)}">両方をコピー</button>
        </div>
      </div>
    `;

    elements.resultSection.innerHTML = html;
  }

  function renderAddressResults(list) {
    const itemsHtml = list
      .map(
        (item) => `
          <article class="result-item">
            <div class="result-item-head">
              <span class="result-value">${escapeHtml(item.formattedZipCode)}</span>
              <span>${escapeHtml(item.address)}</span>
              ${item.addressKana ? `<span class="result-kana">${escapeHtml(item.addressKana)}</span>` : ''}
            </div>
            <div class="copy-row">
              <button type="button" class="copy-button" data-copy-value="${escapeHtml(item.zipCode)}">郵便番号をコピー</button>
              <button type="button" class="copy-button" data-copy-value="${escapeHtml(item.address)}">住所をコピー</button>
              <button type="button" class="copy-button" data-copy-value="${escapeHtml(`${item.zipCode} ${item.address}`)}">両方をコピー</button>
            </div>
          </article>
        `
      )
      .join('');

    elements.resultSection.innerHTML = `
      <div class="result-panel">
        <h2 class="result-title">検索結果</h2>
        <div class="result-list">${itemsHtml}</div>
      </div>
    `;
  }

  function renderStatus(message, type = 'info') {
    elements.resultSection.innerHTML = `
      <div class="status-box ${type}">${escapeHtml(message)}</div>
    `;
  }

  function renderError(message) {
    elements.errorMessage.textContent = message;
  }

  function clearError() {
    elements.errorMessage.textContent = '';
  }

  function clearCopyFeedback() {
    elements.copyFeedback.textContent = '';

    if (state.feedbackTimerId) {
      window.clearTimeout(state.feedbackTimerId);
      state.feedbackTimerId = null;
    }
  }

  function showCopyFeedback(message) {
    clearCopyFeedback();
    elements.copyFeedback.textContent = message;

    state.feedbackTimerId = window.setTimeout(() => {
      elements.copyFeedback.textContent = '';
      state.feedbackTimerId = null;
    }, 2200);
  }

  function clearResult() {
    elements.resultSection.innerHTML = '';
  }

  function setSuggestionStatus(message = '') {
    elements.suggestionStatus.textContent = message;
  }

  function clearSuggestionRequest() {
    if (state.activeSuggestionController) {
      state.activeSuggestionController.abort();
      state.activeSuggestionController = null;
    }
  }

  function resetSuggestionState() {
    state.suggestions = [];
    state.activeSuggestionIndex = -1;
    elements.input.setAttribute('aria-activedescendant', '');
    elements.input.setAttribute('aria-expanded', 'false');
  }

  function clearSuggestions(options = {}) {
    resetSuggestionState();
    elements.suggestionsPanel.innerHTML = '';
    elements.suggestionsPanel.hidden = true;

    if (!options.keepStatus) {
      setSuggestionStatus('');
    }
  }

  function renderSuggestions(list, emptyMessage = '候補が見つかりませんでした') {
    state.suggestions = list;
    state.activeSuggestionIndex = list.length ? 0 : -1;
    elements.input.setAttribute('aria-expanded', list.length ? 'true' : 'false');
    elements.input.setAttribute(
      'aria-activedescendant',
      list.length ? `suggestion-item-0` : ''
    );

    if (!list.length) {
      elements.suggestionsPanel.hidden = false;
      elements.suggestionsPanel.innerHTML = `
        <div class="suggestion-empty">${escapeHtml(emptyMessage)}</div>
      `;
      return;
    }

    const itemsHtml = list
      .map((item, index) => {
        const kanaHtml = item.addressKana
          ? `<span class="suggestion-kana">${escapeHtml(item.addressKana)}</span>`
          : '';

        return `
          <button
            type="button"
            class="suggestion-item${index === state.activeSuggestionIndex ? ' is-active' : ''}"
            id="suggestion-item-${index}"
            role="option"
            aria-selected="${index === state.activeSuggestionIndex ? 'true' : 'false'}"
            data-suggestion-index="${index}"
          >
            <span class="suggestion-postal">${escapeHtml(item.formattedZipCode)}</span>
            <span class="suggestion-address">${escapeHtml(item.address)}</span>
            ${kanaHtml}
          </button>
        `;
      })
      .join('');

    elements.suggestionsPanel.hidden = false;
    elements.suggestionsPanel.innerHTML = `
      <div class="suggestions-list" role="listbox">${itemsHtml}</div>
    `;
  }

  function updateSuggestionSelection() {
    const buttons = elements.suggestionsPanel.querySelectorAll('[data-suggestion-index]');

    buttons.forEach((button, index) => {
      const isActive = index === state.activeSuggestionIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const activeId =
      state.activeSuggestionIndex >= 0
        ? `suggestion-item-${state.activeSuggestionIndex}`
        : '';

    elements.input.setAttribute('aria-activedescendant', activeId);

    if (state.activeSuggestionIndex >= 0) {
      const activeButton = elements.suggestionsPanel.querySelector(`#${activeId}`);

      if (activeButton) {
        activeButton.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function moveSuggestionSelection(direction) {
    if (!state.suggestions.length) {
      return;
    }

    if (state.activeSuggestionIndex < 0) {
      state.activeSuggestionIndex = 0;
    } else {
      state.activeSuggestionIndex =
        (state.activeSuggestionIndex + direction + state.suggestions.length) %
        state.suggestions.length;
    }

    updateSuggestionSelection();
  }

  function getErrorMessage(error) {
    const map = {
      validation: '入力内容を確認してください',
      'not-found': '見つかりませんでした',
      'invalid-response': 'データを取得できませんでした',
      network: '通信に失敗しました',
      'method-not-allowed': 'データを取得できませんでした',
      'query-too-short': 'もう少し詳しく入力してください',
    };

    return map[error.message] || '通信に失敗しました';
  }

  function isNetlifyRuntimeAvailable() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = text;
    tempTextarea.setAttribute('readonly', 'true');
    tempTextarea.style.position = 'fixed';
    tempTextarea.style.opacity = '0';
    document.body.appendChild(tempTextarea);
    tempTextarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(tempTextarea);

    if (!copied) {
      throw new Error('copy-failed');
    }
  }

  function setSubmittingState(isSubmitting) {
    state.isSubmitting = isSubmitting;
    elements.searchButton.disabled = isSubmitting;
    elements.searchButton.textContent = isSubmitting
      ? '表示中...'
      : SEARCH_MODES[state.mode].buttonLabel;
  }

  function updateModeUi(mode) {
    const modeConfig = SEARCH_MODES[mode];

    elements.inputLabel.textContent = modeConfig.label;
    elements.input.placeholder = modeConfig.placeholder;
    elements.input.inputMode = modeConfig.inputMode;
    elements.input.autocomplete = modeConfig.autocomplete;
    elements.searchButton.textContent = modeConfig.buttonLabel;
    elements.helperText.textContent = modeConfig.idleHint;
  }

  function getCurrentMode() {
    const selected = Array.from(elements.modeInputs).find((input) => input.checked);
    return selected?.value || 'postal';
  }

  function deduplicateResults(list) {
    const seen = new Set();

    return list.filter((item) => {
      const key = `${item.formattedZipCode}|${item.address}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function getNormalizedInputValue() {
    if (state.mode === 'postal') {
      return normalizePostalCode(elements.input.value);
    }

    return normalizeText(elements.input.value);
  }

  function syncInputValueWithMode() {
    const normalizedValue = getNormalizedInputValue();

    if (state.mode === 'postal') {
      elements.input.value = normalizedValue;
    } else {
      elements.input.value = normalizeText(elements.input.value);
    }
  }

  async function fetchSuggestionsByPostalCode(postalCode, signal, requestId) {
    if (!postalCode) {
      clearSuggestions();
      setSuggestionStatus('');
      return;
    }

    if (postalCode.length < API_CONFIG.postalMinChars) {
      clearSuggestions({ keepStatus: true });
      setSuggestionStatus('郵便番号は 3 桁以上で候補を表示します。');
      return;
    }

    setSuggestionStatus('候補を探しています...');

    try {
      const results = await fetchAddressByPostalCode(postalCode, { signal });
      const usableResults = deduplicateResults(
        results.filter((item) => item.zipCode && item.address)
      );

      if (requestId !== state.lastSuggestionRequestId) {
        return;
      }

      renderSuggestions(usableResults);
      setSuggestionStatus(
        usableResults.length
          ? `${usableResults.length} 件の候補があります。`
          : '候補が見つかりませんでした'
      );
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }

      clearSuggestions({ keepStatus: true });

      if (error.message === 'not-found') {
        if (requestId !== state.lastSuggestionRequestId) {
          return;
        }

        renderSuggestions([], '候補が見つかりませんでした');
        setSuggestionStatus('候補が見つかりませんでした');
        return;
      }

      if (error.message === 'query-too-short') {
        setSuggestionStatus('郵便番号は 3 桁以上で候補を表示します。');
        return;
      }

      if (requestId !== state.lastSuggestionRequestId) {
        return;
      }

      setSuggestionStatus(getErrorMessage(error));
    }
  }

  async function fetchSuggestionsByAddress(address, signal, requestId) {
    if (!address) {
      clearSuggestions();
      setSuggestionStatus('');
      return;
    }

    if (address.length < API_CONFIG.addressMinChars) {
      clearSuggestions({ keepStatus: true });
      setSuggestionStatus('住所は 2 文字以上で候補を表示します。');
      return;
    }

    setSuggestionStatus('候補を探しています...');

    try {
      const results = await fetchPostalCodesByAddress(address, { signal });
      const usableResults = deduplicateResults(
        results.filter((item) => item.zipCode && item.address)
      );

      if (requestId !== state.lastSuggestionRequestId) {
        return;
      }

      renderSuggestions(usableResults);
      setSuggestionStatus(
        usableResults.length
          ? `${usableResults.length} 件の候補があります。`
          : '候補が見つかりませんでした'
      );
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }

      clearSuggestions({ keepStatus: true });

      if (error.message === 'not-found') {
        if (requestId !== state.lastSuggestionRequestId) {
          return;
        }

        renderSuggestions([], '候補が見つかりませんでした');
        setSuggestionStatus('候補が見つかりませんでした');
        return;
      }

      if (error.message === 'query-too-short') {
        setSuggestionStatus('住所は 2 文字以上で候補を表示します。');
        return;
      }

      if (requestId !== state.lastSuggestionRequestId) {
        return;
      }

      setSuggestionStatus(getErrorMessage(error));
    }
  }

  async function performSuggestionFetch() {
    if (!isNetlifyRuntimeAvailable()) {
      clearSuggestions();
      setSuggestionStatus('');
      return;
    }

    const normalizedValue = getNormalizedInputValue();
    const requestId = state.lastSuggestionRequestId + 1;

    state.lastSuggestionRequestId = requestId;
    clearSuggestionRequest();

    const controller = new AbortController();
    state.activeSuggestionController = controller;

    try {
      if (state.mode === 'postal') {
        await fetchSuggestionsByPostalCode(normalizedValue, controller.signal, requestId);
      } else {
        await fetchSuggestionsByAddress(normalizedValue, controller.signal, requestId);
      }
    } finally {
      if (state.lastSuggestionRequestId === requestId) {
        state.activeSuggestionController = null;
      }
    }
  }

  const debouncedSuggestionFetch = debounce(() => {
    performSuggestionFetch();
  }, API_CONFIG.debounceMs);

  async function handlePostalSearch() {
    const normalizedPostalCode = normalizePostalCode(elements.input.value);
    const validationMessage = validatePostalCode(normalizedPostalCode);

    if (validationMessage) {
      renderError(validationMessage);
      clearResult();
      return;
    }

    clearError();
    renderStatus('検索しています...');
    setSubmittingState(true);

    try {
      const results = await fetchAddressByPostalCode(normalizedPostalCode);
      const usableResults = deduplicateResults(
        results.filter((item) => item.zipCode && item.address)
      );

      if (!usableResults.length) {
        renderStatus('見つかりませんでした');
        return;
      }

      if (usableResults.length === 1) {
        renderSelectedResult(usableResults[0]);
        return;
      }

      renderAddressResults(usableResults);
    } catch (error) {
      renderStatus(getErrorMessage(error), 'error');
    } finally {
      setSubmittingState(false);
    }
  }

  async function handleAddressSearch() {
    const normalizedAddress = normalizeText(elements.input.value);
    const validationMessage = validateAddress(normalizedAddress);

    if (validationMessage) {
      renderError(validationMessage);
      clearResult();
      return;
    }

    clearError();
    renderStatus('検索しています...');
    setSubmittingState(true);

    try {
      const results = await fetchPostalCodesByAddress(normalizedAddress);
      const usableResults = deduplicateResults(
        results.filter((item) => item.zipCode && item.address)
      );

      if (!usableResults.length) {
        renderStatus('見つかりませんでした');
        return;
      }

      renderAddressResults(usableResults);
    } catch (error) {
      renderStatus(getErrorMessage(error), 'error');
    } finally {
      setSubmittingState(false);
    }
  }

  function selectSuggestion(item) {
    if (!item) {
      return;
    }

    clearError();
    clearSuggestions({ keepStatus: true });
    setSuggestionStatus('候補を選択しました。');

    if (state.mode === 'postal') {
      elements.input.value = item.zipCode;
    } else {
      elements.input.value = item.address;
    }

    renderSelectedResult(item);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearCopyFeedback();
    syncInputValueWithMode();

    if (!isNetlifyRuntimeAvailable()) {
      clearError();
      renderStatus(
        'この構成では Netlify 上の公開URL、または netlify dev で利用してください',
        'error'
      );
      return;
    }

    state.mode = getCurrentMode();

    if (state.suggestions.length) {
      const index = state.activeSuggestionIndex >= 0 ? state.activeSuggestionIndex : 0;
      selectSuggestion(state.suggestions[index]);
      return;
    }

    if (state.mode === 'postal') {
      await handlePostalSearch();
      return;
    }

    await handleAddressSearch();
  }

  function handleModeChange(event) {
    state.mode = event.target.value;
    updateModeUi(state.mode);
    elements.input.value = '';
    clearError();
    clearResult();
    clearCopyFeedback();
    clearSuggestionRequest();
    clearSuggestions();
    setSuggestionStatus('');
    elements.input.focus();
  }

  function handleClear() {
    if (state.debounceTimerId) {
      window.clearTimeout(state.debounceTimerId);
      state.debounceTimerId = null;
    }

    clearSuggestionRequest();
    elements.input.value = '';
    clearError();
    clearResult();
    clearCopyFeedback();
    clearSuggestions();
    setSuggestionStatus('');
    elements.input.focus();
  }

  async function handleResultClick(event) {
    const button = event.target.closest('[data-copy-value]');

    if (!button) {
      return;
    }

    try {
      await copyText(button.dataset.copyValue || '');
      showCopyFeedback('コピーしました');
    } catch (error) {
      showCopyFeedback('コピーに失敗しました');
    }
  }

  function handleInputChange() {
    clearError();
    clearCopyFeedback();
    syncInputValueWithMode();
    clearSuggestionRequest();

    if (!elements.input.value) {
      clearSuggestions();
      setSuggestionStatus('');
      return;
    }

    debouncedSuggestionFetch();
  }

  function handleInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      if (!state.suggestions.length) {
        return;
      }

      event.preventDefault();
      moveSuggestionSelection(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!state.suggestions.length) {
        return;
      }

      event.preventDefault();
      moveSuggestionSelection(-1);
      return;
    }

    if (event.key === 'Enter') {
      if (!state.suggestions.length) {
        return;
      }

      event.preventDefault();
      const index = state.activeSuggestionIndex >= 0 ? state.activeSuggestionIndex : 0;
      selectSuggestion(state.suggestions[index]);
      return;
    }

    if (event.key === 'Escape') {
      clearSuggestions({ keepStatus: true });
      setSuggestionStatus('候補を閉じました。');
    }
  }

  function handleSuggestionPointerDown(event) {
    const button = event.target.closest('[data-suggestion-index]');

    if (button) {
      event.preventDefault();
    }
  }

  function handleSuggestionClick(event) {
    const button = event.target.closest('[data-suggestion-index]');

    if (!button) {
      return;
    }

    const index = Number(button.dataset.suggestionIndex);
    const item = state.suggestions[index];

    selectSuggestion(item);
  }

  function handleDocumentClick(event) {
    if (
      elements.input.contains(event.target) ||
      elements.suggestionsPanel.contains(event.target)
    ) {
      return;
    }

    if (state.suggestions.length) {
      clearSuggestions({ keepStatus: true });
      setSuggestionStatus('');
    }
  }

  function bindEvents() {
    elements.form.addEventListener('submit', handleSubmit);
    elements.clearButton.addEventListener('click', handleClear);
    elements.resultSection.addEventListener('click', handleResultClick);
    elements.input.addEventListener('input', handleInputChange);
    elements.input.addEventListener('keydown', handleInputKeyDown);
    elements.suggestionsPanel.addEventListener('pointerdown', handleSuggestionPointerDown);
    elements.suggestionsPanel.addEventListener('click', handleSuggestionClick);
    document.addEventListener('click', handleDocumentClick);

    elements.modeInputs.forEach((input) => {
      input.addEventListener('change', handleModeChange);
    });
  }

  function init() {
    updateModeUi(state.mode);
    bindEvents();

    if (!isNetlifyRuntimeAvailable()) {
      renderStatus('Netlify Functions 構成です。検索は公開URLまたは netlify dev で利用してください。');
      return;
    }

    setSuggestionStatus(SEARCH_MODES[state.mode].idleHint);
  }

  init();
})();
