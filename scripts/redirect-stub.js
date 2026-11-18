// Builds the pages that replace nelsontorresjr330.github.io at cutover. GitHub Pages can't
// send a real 301, so every path (index.html and the 404 page GitHub serves for unknown
// paths) forwards the browser to the same path on the new domain, and tells search engines
// the new URL is canonical.
//
//   node scripts/make-redirect-stub.mjs nelsontorres.dev   # writes docs/index.html and docs/404.html

export function redirectTarget(domain, { pathname, search, hash }) {
  return `https://${domain}${pathname || '/'}${search || ''}${hash || ''}`;
}

export function redirectStubHtml(domain) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error(`Not a domain: ${domain}`);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nelson Torres has moved</title>
  <link rel="canonical" href="https://${domain}/">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=https://${domain}/">
  <script>
    (function (l) {
      l.replace(${redirectTarget.toString().replace(/\s+/g, ' ')}.call(null, ${JSON.stringify(domain)}, l));
    })(window.location);
  </script>
  <style>body{font:16px system-ui,sans-serif;margin:4rem auto;max-width:32rem;padding:0 1rem;color:#0f172a}</style>
</head>
<body>
  <p>This site has moved to <a href="https://${domain}/">${domain}</a>.</p>
</body>
</html>
`;
}
