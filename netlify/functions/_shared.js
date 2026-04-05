const API_CONFIG = {
  baseUrl: 'https://geoapi.heartrails.com/api/json',
  timeoutMs: 10000,
};

const PREFECTURE_KANA_MAP = {
  '北海道': 'ほっかいどう',
  '青森県': 'あおもりけん',
  '岩手県': 'いわてけん',
  '宮城県': 'みやぎけん',
  '秋田県': 'あきたけん',
  '山形県': 'やまがたけん',
  '福島県': 'ふくしまけん',
  '茨城県': 'いばらきけん',
  '栃木県': 'とちぎけん',
  '群馬県': 'ぐんまけん',
  '埼玉県': 'さいたまけん',
  '千葉県': 'ちばけん',
  '東京都': 'とうきょうと',
  '神奈川県': 'かながわけん',
  '新潟県': 'にいがたけん',
  '富山県': 'とやまけん',
  '石川県': 'いしかわけん',
  '福井県': 'ふくいけん',
  '山梨県': 'やまなしけん',
  '長野県': 'ながのけん',
  '岐阜県': 'ぎふけん',
  '静岡県': 'しずおかけん',
  '愛知県': 'あいちけん',
  '三重県': 'みえけん',
  '滋賀県': 'しがけん',
  '京都府': 'きょうとふ',
  '大阪府': 'おおさかふ',
  '兵庫県': 'ひょうごけん',
  '奈良県': 'ならけん',
  '和歌山県': 'わかやまけん',
  '鳥取県': 'とっとりけん',
  '島根県': 'しまねけん',
  '岡山県': 'おかやまけん',
  '広島県': 'ひろしまけん',
  '山口県': 'やまぐちけん',
  '徳島県': 'とくしまけん',
  '香川県': 'かがわけん',
  '愛媛県': 'えひめけん',
  '高知県': 'こうちけん',
  '福岡県': 'ふくおかけん',
  '佐賀県': 'さがけん',
  '長崎県': 'ながさきけん',
  '熊本県': 'くまもとけん',
  '大分県': 'おおいたけん',
  '宮崎県': 'みやざきけん',
  '鹿児島県': 'かごしまけん',
  '沖縄県': 'おきなわけん',
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
  return convertFullWidthNumbers(normalizeText(input)).replace(/[^0-9]/g, '');
}

function formatPostalCode(postalCode) {
  if (!/^\d{7}$/.test(postalCode)) {
    return postalCode;
  }

  return `${postalCode.slice(0, 3)}-${postalCode.slice(3)}`;
}

function buildAddressText(prefecture, city, town) {
  return [prefecture, city, town]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('');
}

function buildAddressKana(prefectureKana, cityKana, townKana) {
  return [prefectureKana, cityKana, townKana]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('');
}

function createJsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

async function fetchUpstream(params) {
  const url = new URL(API_CONFIG.baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('network');
    }

    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error('invalid-response');
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('network');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractLocations(response) {
  const locations = response?.response?.location;

  if (!Array.isArray(locations)) {
    throw new Error('invalid-response');
  }

  return locations;
}

function formatLocation(item) {
  const zipCode = String(item?.postal || '');
  const prefecture = String(item?.prefecture || '').trim();
  const city = String(item?.city || '').trim();
  const town = String(item?.town || '').trim();
  const prefectureKana = PREFECTURE_KANA_MAP[prefecture] || '';
  const cityKana = String(item?.['city-kana'] || '').trim();
  const townKana = String(item?.['town-kana'] || '').trim();
  const address = buildAddressText(prefecture, city, town);
  const addressKana = buildAddressKana(prefectureKana, cityKana, townKana);

  return {
    zipCode,
    formattedZipCode: formatPostalCode(zipCode),
    prefecture,
    city,
    town,
    prefectureKana,
    cityKana,
    townKana,
    address,
    addressKana,
  };
}

function deduplicateResults(results) {
  const seen = new Set();

  return results.filter((item) => {
    const key = `${item.formattedZipCode}|${item.address}`;

    if (!item.zipCode || !item.address || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

module.exports = {
  API_CONFIG,
  createJsonResponse,
  deduplicateResults,
  extractLocations,
  fetchUpstream,
  formatLocation,
  normalizePostalCode,
  normalizeText,
};
