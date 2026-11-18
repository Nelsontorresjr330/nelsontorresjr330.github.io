import { mkdirSync, writeFileSync } from 'node:fs';
import { redirectStubHtml } from './redirect-stub.js';

const domain = process.argv[2];
if (!domain) {
  console.error('usage: node scripts/make-redirect-stub.mjs <domain>');
  process.exit(1);
}
const html = redirectStubHtml(domain);
mkdirSync('docs', { recursive: true });
for (const f of ['index.html', '404.html']) writeFileSync(`docs/${f}`, html);
console.log(`docs/index.html and docs/404.html now forward to https://${domain}`);
