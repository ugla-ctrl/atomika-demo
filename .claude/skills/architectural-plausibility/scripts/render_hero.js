// Render the photoreal stair (hero.html) from a spec. Serves the repo root so /tex/ textures resolve.
// Usage: node render_hero.js <spec.json> <out.png> [WxH] [repoRoot]
const http = require('http'), fs = require('fs'), path = require('path');
let playwright; try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
(async () => {
  const [specPath, out, size = '2304x1296', root = process.cwd(), extra = ''] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number);
  const html = fs.readFileSync(path.join(__dirname, 'hero.html')), spec = fs.readFileSync(specPath);
  const types = {'.jpg':'image/jpeg', '.png':'image/png', '.json':'application/json'};
  const srv = http.createServer((q, s) => { const u = q.url.split('?')[0];
    if (u === '/spec.json') { s.setHeader('content-type', 'application/json'); return s.end(spec); }
    if (u === '/' || u === '/hero.html') { s.setHeader('content-type', 'text/html'); return s.end(html); }
    const f = path.join(root, u); if (fs.existsSync(f) && fs.statSync(f).isFile()) { s.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); return s.end(fs.readFileSync(f)); }
    s.statusCode = 404; s.end(); });
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${port}/?spec=/spec.json&tex=/tex&w=${w}&h=${h}${extra}`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  await p.screenshot({ path: out }); console.log('saved', out, errs.length ? 'errors: ' + errs.join(' | ') : '');
  await b.close(); srv.close();
})();
