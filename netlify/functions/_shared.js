const API_CONFIG = {
  baseUrl: 'https://geoapi.heartrails.com/api/json',
  timeoutMs: 10000,
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
  const address = buildAddressText(item?.prefecture, item?.city, item?.town);

  return {
    zipCode,
    formattedZipCode: formatPostalCode(zipCode),
    address,
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
