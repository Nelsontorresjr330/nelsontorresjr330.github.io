// CloudFront Function (cloudfront-js-2.0), viewer request, for the site's default behavior.
// __CANONICAL_HOST__ and __REDIRECTS__ are filled in at synth time (lib/site-stack.ts).
//
// 1. Any other host (www., the *.cloudfront.net name) gets a 301 to the canonical host.
// 2. Moved pages get a 301 to their new path, so links already shared keep working.
// 3. Static sub-sites (Storybook) serve their own index.html.
// 4. Everything else without a file extension is a React route: serve /index.html.
var CANONICAL_HOST = '__CANONICAL_HOST__';
var REDIRECTS = __REDIRECTS__;
var STATIC_SUBSITES = ['/storybook/'];

function redirect(location) {
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: location }, 'cache-control': { value: 'max-age=3600' } },
  };
}

function queryString(qs) {
  var parts = [];
  for (var key in qs) {
    var item = qs[key];
    var values = item.multiValue ? item.multiValue.map(function (v) { return v.value; }) : [item.value];
    for (var i = 0; i < values.length; i++) {
      parts.push(values[i] === '' ? key : key + '=' + values[i]);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var host = request.headers.host ? request.headers.host.value : '';

  if (host !== CANONICAL_HOST) {
    return redirect('https://' + CANONICAL_HOST + uri + queryString(request.querystring));
  }

  var trimmed = uri.length > 1 && uri.charAt(uri.length - 1) === '/' ? uri.slice(0, -1) : uri;
  if (Object.prototype.hasOwnProperty.call(REDIRECTS, trimmed)) {
    return redirect(REDIRECTS[trimmed] + queryString(request.querystring));
  }

  for (var i = 0; i < STATIC_SUBSITES.length; i++) {
    var sub = STATIC_SUBSITES[i];
    if (uri === sub.slice(0, -1)) return redirect(sub);
    if (uri.indexOf(sub) === 0) {
      if (uri.charAt(uri.length - 1) === '/') request.uri = uri + 'index.html';
      return request;
    }
  }

  var last = uri.split('/').pop();
  if (last.indexOf('.') === -1) request.uri = '/index.html';
  return request;
}
