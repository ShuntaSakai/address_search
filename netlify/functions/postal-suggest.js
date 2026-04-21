const { createJsonResponse, normalizePostalCode } = require('./_shared');
const postalSuggestData = require('../data/postal-suggest-data.json');

const MIN_PREFIX_LENGTH = 4;
const MAX_RESULTS = 8;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return createJsonResponse(405, { error: 'method-not-allowed' });
  }

  const postalPrefix = normalizePostalCode(event.queryStringParameters?.postalCode);

  if (
    !postalPrefix ||
    postalPrefix.length < MIN_PREFIX_LENGTH ||
    postalPrefix.length > 7
  ) {
    return createJsonResponse(400, { error: 'validation' });
  }

  const bucket = postalSuggestData[postalPrefix.slice(0, 4)] || [];
  const results = bucket
    .filter((item) => item[0].startsWith(postalPrefix))
    .map(([zipCode, formattedZipCode, address, addressKana]) => ({
      zipCode,
      formattedZipCode,
      address,
      addressKana,
    }))
    .slice(0, MAX_RESULTS);

  if (!results.length) {
    return createJsonResponse(404, { error: 'not-found', results: [] });
  }

  return createJsonResponse(200, { results });
};
