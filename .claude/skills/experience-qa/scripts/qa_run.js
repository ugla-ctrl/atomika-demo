// Thorough automated QA pass for a web experience, across device profiles.
// Usage: node qa_run.js config.json
// Config (JSON):
// {
//   "url": "https://example.com/",            // base URL
//   "out": "qa-out",                           // output folder (screenshots, report.json, report.md)
//   "views": [{"name":"01","query":"station=1"}, ...],   // states to open by URL (optional; default: just the base URL)
//   "devices": ["desktop","laptop","iphone","iphone-landscape","android","ipad"],   // subset of PROFILES below
//   "settleMs": 8000,                          // wait per page after load (raise for heavy WebGL)
//   "hideForCleanShots": "",                   // optional selectors to hide for a second, UI-free screenshot
//   "clickThrough": {"selector":"#next","steps":3,"waitMs":5000},   // optional: press a control repeatedly and screenshot each step
//   "probes": ["document.querySelectorAll('#photos img[style*=\"opacity: 1\"]').length"],   // optional JS expressions to record per view
//   "budgets": {"totalMB": 25, "largestAssetMB": 5, "requests": 150}
// }
// Records per device and view: console errors and warnings, uncaught exceptions, failed requests (>=400 or network
// errors), bytes by resource type, the largest assets, load timing, horizontal overflow, interactive elements smaller
// than 44px, interactive elements that run off-screen or overlap each other, probe values, and screenshots.
const fs = require('fs'), path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const PROFILES = {
  desktop:            { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  laptop:             { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  iphone:             { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
                        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  'iphone-landscape': { viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
                        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  android:            { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
                        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36' },
  ipad:               { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
                        userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
};

const LAYOUT_PROBE = () => {
  const vw = innerWidth, vh = innerHeight, out = { overflowX: document.documentElement.scrollWidth > vw + 1, smallTargets: [], offscreen: [], overlaps: [] };
  const els = [...document.querySelectorAll('a,button,[role=button],input,select,textarea')].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; });
  const label = e => (e.id ? '#' + e.id : e.tagName.toLowerCase()) + (e.textContent.trim() ? ' "' + e.textContent.trim().slice(0, 24) + '"' : '');
  const rects = els.map(e => [e, e.getBoundingClientRect()]);
  rects.forEach(([e, r]) => {
    if (Math.min(r.width, r.height) < 44 && !e.closest('[data-qa-ignore]')) out.smallTargets.push(label(e) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) out.offscreen.push(label(e));
  });
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const [a, ra] = rects[i], [b, rb] = rects[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ix > 4 && iy > 4) out.overlaps.push(label(a) + ' ⟷ ' + label(b)); }
  out.smallTargets = out.smallTargets.slice(0, 20); out.overlaps = out.overlaps.slice(0, 20);
  return out;
};

(async () => {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const out = cfg.out || 'qa-out', views = cfg.views && cfg.views.length ? cfg.views : [{ name: 'home', query: '' }];
  const devices = cfg.devices || ['desktop', 'iphone'], settle = cfg.settleMs || 8000, budgets = cfg.budgets || {};
  fs.mkdirSync(out, { recursive: true });
  const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = { url: cfg.url, when: new Date().toISOString(), results: [] };
  for (const dev of devices) {
    const prof = PROFILES[dev]; if (!prof) { console.error('unknown device', dev); continue; }
    for (const v of views) {
      const ctx = await browser.newContext(prof), page = await ctx.newPage();
      const r = { device: dev, view: v.name, consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], bytes: {}, largest: [], requests: 0 };
      page.on('console', m => { if (m.type() === 'error') r.consoleErrors.push(m.text().slice(0, 300)); if (m.type() === 'warning') r.consoleWarnings.push(m.text().slice(0, 200)); });
      page.on('pageerror', e => r.pageErrors.push(String(e.message).slice(0, 300)));
      page.on('requestfailed', q => r.failedRequests.push(`${q.failure() && q.failure().errorText} ${q.url().slice(0, 160)}`));
      page.on('response', async resp => { r.requests++; const st = resp.status(); if (st >= 400) r.failedRequests.push(`${st} ${resp.url().slice(0, 160)}`);
        try { const len = +(resp.headers()['content-length'] || 0) || (await resp.body()).length; const t = resp.request().resourceType();
          r.bytes[t] = (r.bytes[t] || 0) + len; r.largest.push([len, resp.url().split('?')[0].slice(-80)]); } catch (e) {} });
      const t0 = Date.now(); const sep = cfg.url.includes('?') ? '&' : '?';
      await page.goto(cfg.url + (v.query ? sep + v.query : ''), { waitUntil: 'load', timeout: 120000 }).catch(e => r.pageErrors.push('goto: ' + e.message));
      r.loadMs = Date.now() - t0;
      await page.waitForTimeout(settle);
      r.layout = await page.evaluate(LAYOUT_PROBE).catch(e => ({ error: e.message }));
      r.probes = {}; for (const p of cfg.probes || []) r.probes[p] = await page.evaluate(p).catch(e => 'ERR ' + e.message);
      const shot = path.join(out, `${dev}-${v.name}.png`); await page.screenshot({ path: shot, timeout: 180000 }); r.screenshot = shot;
      if (cfg.hideForCleanShots) { await page.addStyleTag({ content: `${cfg.hideForCleanShots}{display:none!important}` }); const s2 = path.join(out, `${dev}-${v.name}-clean.png`); await page.screenshot({ path: s2, timeout: 180000 }); r.cleanShot = s2; }
      if (cfg.clickThrough && v === views[0]) { r.steps = [];
        for (let k = 1; k <= cfg.clickThrough.steps; k++) { await page.click(cfg.clickThrough.selector).catch(e => r.pageErrors.push('click: ' + e.message));
          await page.waitForTimeout(Math.round((cfg.clickThrough.waitMs || 4000) * 0.4)); const mid = path.join(out, `${dev}-step${k}-mid.png`); await page.screenshot({ path: mid, timeout: 180000 });
          await page.waitForTimeout(Math.round((cfg.clickThrough.waitMs || 4000) * 0.6)); const end = path.join(out, `${dev}-step${k}.png`); await page.screenshot({ path: end, timeout: 180000 });
          const pv = {}; for (const p of cfg.probes || []) pv[p] = await page.evaluate(p).catch(e => 'ERR ' + e.message); r.steps.push({ mid, end, probes: pv }); } }
      r.largest = r.largest.sort((a, b) => b[0] - a[0]).slice(0, 8).map(([n, u]) => `${(n / 1e6).toFixed(2)} MB ${u}`);
      r.totalMB = +(Object.values(r.bytes).reduce((a, b) => a + b, 0) / 1e6).toFixed(2);
      r.issues = [];
      if (r.pageErrors.length) r.issues.push(['high', `${r.pageErrors.length} uncaught error(s)`]);
      if (r.consoleErrors.length) r.issues.push(['high', `${r.consoleErrors.length} console error(s)`]);
      if (r.failedRequests.length) r.issues.push(['high', `${r.failedRequests.length} failed request(s)`]);
      if (r.layout && r.layout.overflowX) r.issues.push(['medium', 'horizontal page overflow']);
      if (r.layout && r.layout.offscreen && r.layout.offscreen.length) r.issues.push(['medium', `controls off-screen: ${r.layout.offscreen.join(', ')}`]);
      if (r.layout && r.layout.overlaps && r.layout.overlaps.length) r.issues.push(['medium', `overlapping controls: ${r.layout.overlaps.slice(0, 5).join('; ')}`]);
      if (prof.hasTouch && r.layout && r.layout.smallTargets && r.layout.smallTargets.length) r.issues.push(['low', `${r.layout.smallTargets.length} tap target(s) under 44px`]);
      if (budgets.totalMB && r.totalMB > budgets.totalMB) r.issues.push(['medium', `page weight ${r.totalMB} MB > budget ${budgets.totalMB} MB`]);
      if (budgets.requests && r.requests > budgets.requests) r.issues.push(['low', `${r.requests} requests > budget ${budgets.requests}`]);
      if (budgets.largestAssetMB && r.largest[0] && parseFloat(r.largest[0]) > budgets.largestAssetMB) r.issues.push(['low', `largest asset ${r.largest[0]}`]);
      report.results.push(r); console.log(`${dev} ${v.name}: ${r.issues.length ? r.issues.map(i => i[0] + ': ' + i[1]).join(' | ') : 'clean'} (${r.totalMB} MB, ${r.loadMs} ms)`);
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  const md = ['# QA report', '', `URL: ${report.url}  `, `Run: ${report.when}`, '', '| Device | View | Issues | MB | Load ms |', '|---|---|---|---|---|',
    ...report.results.map(r => `| ${r.device} | ${r.view} | ${r.issues.length ? r.issues.map(i => `**${i[0]}** ${i[1]}`).join('<br>') : 'none'} | ${r.totalMB} | ${r.loadMs} |`),
    '', '## Details', ...report.results.filter(r => r.issues.length).map(r => `### ${r.device} / ${r.view}\n` +
      [...r.pageErrors.map(e => `- page error: ${e}`), ...r.consoleErrors.map(e => `- console: ${e}`), ...r.failedRequests.map(e => `- request: ${e}`),
       ...(r.layout && r.layout.smallTargets || []).map(e => `- small target: ${e}`)].join('\n'))];
  fs.writeFileSync(path.join(out, 'report.md'), md.join('\n'));
  console.log('wrote', path.join(out, 'report.md'));
})();
