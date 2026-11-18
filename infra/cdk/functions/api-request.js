// CloudFront Function (cloudfront-js-2.0), viewer request, for /api/<demo>/* behaviors.
// Each research demo's API is served from the site's own origin, so the browser needs no
// CORS: /api/laplacian-glm/run -> <laplacian API>/run.
var PREFIX = /^\/api\/[a-z0-9-]+/;

function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(PREFIX, '') || '/';
  return request;
}
