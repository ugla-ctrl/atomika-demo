// Render a blockout spec to PNG with headless Chromium.
// Usage: node render_blockout.js <spec.json> <out.png> [1600x900]
// Serves blockout.html and the spec from a throwaway local server, so it works from anywhere.
const http = require('http'), fs = require('fs'), path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
(async () => {
  const [specPath, out, size = '1600x900'] = process.argv.slice(2);
  if (!specPath || !out) { console.error('usage: render_blockout.js <spec.json> <out.png> [WxH]'); process.exit(1); }
  const [w, h] = size.split('x').map(Number);
  const html = fs.readFileSync(path.join(__dirname, 'blockout.html')), spec = fs.readFileSync(specPath);
  const srv = http.createServer((q, s) => { if (q.url.startsWith('/spec.json')) { s.setHeader('content-type', 'application/json'); s.end(spec); } else { s.setHeader('content-type', 'text/html'); s.end(html); } });
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${port}/?spec=/spec.json&w=${w}&h=${h}`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await p.screenshot({ path: out }); console.log('saved', out, errs.length ? 'errors: ' + errs.join(' | ') : '');
  await b.close(); srv.close();
})();
