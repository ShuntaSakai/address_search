/*
  郵便番号・住所検索ツール
  - 入力整形
  - バリデーション
  - API 呼び出し
  - API レスポンス整形
  - 画面表示
  を分けて扱う構成にしています。
*/

(() => {
  const API_CONFIG = {
    endpoints: {
      postalSearch: '/api/postal-search',
      addressSearch: '/api/address-search',
    },
    timeoutMs: 10000,
  };

  const SEARCH_MODES = {
    postal: {
      label: '郵便番号',
      placeholder: '郵便番号を入力',
      inputMode: 'numeric',
      autocomplete: 'off',
      buttonLabel: '検索',
    },
    address: {
      label: '住所',
      placeholder: '住所を入力',
      inputMode: 'text',
      autocomplete: 'street-address',
      buttonLabel: '検索',
    },
  };

  const state = {
    mode: 'postal',
    feedbackTimerId: null,
  };

  const elements = {
    form: document.getElementById('search-form'),
    input: document.getElementById('search-input'),
    inputLabel: document.getElementById('input-label'),
    modeInputs: document.querySelectorAll('input[name="searchMode"]'),
    searchButton: document.getElementById('search-button'),
    clearButton: document.getElementById('clear-button'),
    resultSection: document.getElementById('result-section'),
    errorMessage: document.getElementById('error-message'),
    copyFeedback: document.getElementById('copy-feedback'),
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

  function formatPostalCode(postalCode) {
    if (!/^\d{7}$/.test(postalCode)) {
      return postalCode;
    }

    return `${postalCode.slice(0, 3)}-${postalCode.slice(3)}`;
  }

  function validatePostalCode(postalCode) {
    if (!postalCode) {
      return '郵便番号を入力してください';
    }

    if (!/^\d{7}$/.test(postalCode)) {
      return '郵便番号は7桁で入力してください';
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

  async function requestJson(url, params = {}) {
    const requestUrl = new URL(url, window.location.origin);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

    Object.entries(params).forEach(([key, value]) => {
      requestUrl.searchParams.set(key, value);
    });

    try {
      const response = await fetch(requestUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
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
        throw new Error('network');
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function fetchAddressByPostalCode(postalCode) {
    const response = await requestJson(API_CONFIG.endpoints.postalSearch, {
      postalCode,
    });

    if (!Array.isArray(response?.results)) {
      throw new Error('invalid-response');
    }

    return response.results;
  }

  async function fetchPostalCodesByAddress(address) {
    const response = await requestJson(API_CONFIG.endpoints.addressSearch, {
      address,
    });

    if (!Array.isArray(response?.results)) {
      throw new Error('invalid-response');
    }

    return response.results;
  }

  function renderPostalResult(data) {
    const html = `
      <div class="result-panel">
        <h2 class="result-title">検索結果</h2>
        <div class="result-grid">
          <div class="result-row">
            <span class="result-label">郵便番号</span>
            <span class="result-value">${escapeHtml(data.formattedZipCode)}</span>
          </div>
          <div class="result-row">
            <span class="result-label">住所</span>
            <span class="result-value">${escapeHtml(data.address)}</span>
          </div>
        </div>
        <div class="copy-row">
          <button type="button" class="copy-button" data-copy-value="${escapeHtml(data.formattedZipCode)}">郵便番号をコピー</button>
          <button type="button" class="copy-button" data-copy-value="${escapeHtml(data.address)}">住所をコピー</button>
          <button type="button" class="copy-button" data-copy-value="${escapeHtml(`${data.formattedZipCode} ${data.address}`)}">両方をコピー</button>
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
            </div>
            <div class="copy-row">
              <button type="button" class="copy-button" data-copy-value="${escapeHtml(item.formattedZipCode)}">郵便番号をコピー</button>
              <button type="button" class="copy-button" data-copy-value="${escapeHtml(item.address)}">住所をコピー</button>
              <button type="button" class="copy-button" data-copy-value="${escapeHtml(`${item.formattedZipCode} ${item.address}`)}">両方をコピー</button>
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

  function getErrorMessage(error) {
    const map = {
      validation: '入力内容を確認してください',
      'not-found': '見つかりませんでした',
      'invalid-response': 'データを取得できませんでした',
      network: '通信に失敗しました',
      'method-not-allowed': 'データを取得できませんでした',
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

  function setLoadingState(isLoading) {
    elements.searchButton.disabled = isLoading;
    elements.searchButton.textContent = isLoading ? '検索中...' : SEARCH_MODES[state.mode].buttonLabel;
  }

  function updateModeUi(mode) {
    const modeConfig = SEARCH_MODES[mode];

    elements.inputLabel.textContent = modeConfig.label;
    elements.input.placeholder = modeConfig.placeholder;
    elements.input.inputMode = modeConfig.inputMode;
    elements.input.autocomplete = modeConfig.autocomplete;
    elements.searchButton.textContent = modeConfig.buttonLabel;
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

  async function handlePostalSearch() {
    const normalizedPostalCode = normalizePostalCode(elements.input.value);
    const validationMessage = validatePostalCode(normalizedPostalCode);

    if (validationMessage) {
      renderError(validationMessage);
      clearResult();
      return;
    }

    clearError();
    clearResult();
    renderStatus('検索しています...');
    setLoadingState(true);

    try {
      const results = await fetchAddressByPostalCode(normalizedPostalCode);
      const usableResults = deduplicateResults(
        results.filter((item) => item.zipCode && item.address)
      );

      if (!usableResults.length) {
        renderStatus('見つかりませんでした');
        return;
      }

      renderPostalResult(usableResults[0]);
    } catch (error) {
      renderStatus(getErrorMessage(error), 'error');
    } finally {
      setLoadingState(false);
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
    clearResult();
    renderStatus('検索しています...');
    setLoadingState(true);

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
      setLoadingState(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearCopyFeedback();

    if (!isNetlifyRuntimeAvailable()) {
      clearError();
      renderStatus('この構成では Netlify 上の公開URL、または netlify dev で利用してください', 'error');
      return;
    }

    state.mode = getCurrentMode();

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
    elements.input.focus();
  }

  function handleClear() {
    elements.input.value = '';
    clearError();
    clearResult();
    clearCopyFeedback();
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

  function bindEvents() {
    elements.form.addEventListener('submit', handleSubmit);
    elements.clearButton.addEventListener('click', handleClear);
    elements.resultSection.addEventListener('click', handleResultClick);

    elements.modeInputs.forEach((input) => {
      input.addEventListener('change', handleModeChange);
    });
  }

  function init() {
    updateModeUi(state.mode);
    bindEvents();

    if (!isNetlifyRuntimeAvailable()) {
      renderStatus('Netlify Functions 構成です。検索は公開URLまたは netlify dev で利用してください。');
    }
  }

  init();
})();
