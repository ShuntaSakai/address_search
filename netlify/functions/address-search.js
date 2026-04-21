const {
  createJsonResponse,
  deduplicateResults,
  extractLocations,
  fetchUpstream,
  formatLocation,
  isAddressQueryLongEnough,
  limitResults,
  normalizeText,
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return createJsonResponse(405, { error: 'method-not-allowed' });
  }

  const address = normalizeText(event.queryStringParameters?.address);

  if (!address) {
    return createJsonResponse(400, { error: 'validation', results: [] });
  }

  if (!isAddressQueryLongEnough(address)) {
    return createJsonResponse(200, { results: [], error: 'query-too-short' });
  }

  try {
    const upstreamData = await fetchUpstream({
      method: 'suggest',
      matching: 'like',
      keyword: address,
    });

    const results = limitResults(
      deduplicateResults(extractLocations(upstreamData).map(formatLocation))
    );

    if (!results.length) {
      return createJsonResponse(404, { error: 'not-found', results: [] });
    }

    return createJsonResponse(200, { results });
  } catch (error) {
    return createJsonResponse(502, { error: error.message || 'network', results: [] });
  }
};
