// Capture clean reference frames from a running site, one view per page load.
// Usage: node capture_frames.js <url-with-{n}> <first>-<last> <outdir> [hideSelectors] [WxH]
//   e.g. node capture_frames.js "http://localhost:8123/?hq&station={n}" 1-11 refs "header,.card,.rail,#labels" 1280x720
// Headless Chromium uses SwiftShader (software WebGL) and runs at a few fps, so each view gets a long settle time.
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
(async () => {
  const [url, range, outdir, hide = 'header,.card,.rail,#labels', size = '1280x720'] = process.argv.slice(2);
  if (!url || !range || !outdir) { console.error('usage: capture_frames.js <url-with-{n}> <a>-<b> <outdir> [hide] [WxH]'); process.exit(1); }
  const [a, b] = range.split('-').map(Number), [w, h] = size.split('x').map(Number);
  require('fs').mkdirSync(outdir, { recursive: true });
  const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (let n = a; n <= b; n++) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url.replace('{n}', n));
    await page.waitForTimeout(30000);
    if (hide) await page.addStyleTag({ content: `${hide}{display:none!important}` });
    await page.waitForTimeout(3000);
    const file = path.join(outdir, `${String(n).padStart(2, '0')}.png`);
    await page.screenshot({ path: file, timeout: 180000 });
    console.log('saved', file);
    await page.close();
  }
  await browser.close();
})();
