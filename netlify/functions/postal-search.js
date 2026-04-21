const {
  createJsonResponse,
  deduplicateResults,
  extractLocations,
  fetchUpstream,
  formatLocation,
  isPostalQueryLongEnough,
  limitResults,
  normalizePostalCode,
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return createJsonResponse(405, { error: 'method-not-allowed' });
  }

  const postalCode = normalizePostalCode(event.queryStringParameters?.postalCode);

  if (!postalCode) {
    return createJsonResponse(400, { error: 'validation', results: [] });
  }

  if (!isPostalQueryLongEnough(postalCode)) {
    return createJsonResponse(200, { results: [], error: 'query-too-short' });
  }

  try {
    const upstreamData = await fetchUpstream({
      method: 'suggest',
      matching: 'like',
      keyword: postalCode,
    });

    const results = limitResults(
      deduplicateResults(extractLocations(upstreamData).map(formatLocation)).filter((item) =>
        item.zipCode.startsWith(postalCode)
      )
    );

    if (!results.length) {
      return createJsonResponse(404, { error: 'not-found', results: [] });
    }

    return createJsonResponse(200, { results });
  } catch (error) {
    return createJsonResponse(502, { error: error.message || 'network', results: [] });
  }
};
