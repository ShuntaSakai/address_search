const {
  createJsonResponse,
  deduplicateResults,
  extractLocations,
  fetchUpstream,
  formatLocation,
  normalizeText,
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return createJsonResponse(405, { error: 'method-not-allowed' });
  }

  const address = normalizeText(event.queryStringParameters?.address);

  if (!address) {
    return createJsonResponse(400, { error: 'validation' });
  }

  try {
    const upstreamData = await fetchUpstream({
      method: 'suggest',
      matching: 'like',
      keyword: address,
    });

    const results = deduplicateResults(
      extractLocations(upstreamData).map(formatLocation)
    );

    if (!results.length) {
      return createJsonResponse(404, { error: 'not-found', results: [] });
    }

    return createJsonResponse(200, { results });
  } catch (error) {
    const statusCode = error.message === 'invalid-response' ? 502 : 502;
    return createJsonResponse(statusCode, { error: error.message || 'network' });
  }
};
