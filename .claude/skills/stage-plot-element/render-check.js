/* Render check for stage plot elements.
   Usage (from the repo root, with a static server running on :8765):
     python3 -m http.server 8765 &
     node .claude/skills/stage-plot-element/render-check.js <out-dir> [type[:variant[:pose]] ...]
   With no elements given it renders every preset, one screenshot per palette category.
   Prints "no errors" or the page errors; look at the PNGs before calling the work done. */
const { chromium } = require('playwright');

(async () => {
  const out = process.argv[2] || '.';
  const wanted = process.argv.slice(3).map(a => a.split(':'));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route(/supabase|goatcounter|zgo|fonts\.g/, r => r.abort());
  /* rr_pro unlocks the 3D view locally; rr_plotlive=0 starts in plain work light so models are easy to judge */
  await page.addInitScript(() => { try { localStorage.setItem('rr_pro', 'test'); localStorage.setItem('rr_plotlive', '0'); } catch (e) {} });
  await page.goto('http://localhost:8765/rider-builder.html');
  await page.waitForTimeout(600);
  await page.evaluate(() => { loadExample(true); openPlotModal(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => setPlotView('3d', true));
  await page.waitForTimeout(1500);
  const box = await page.locator('#stage3d canvas').boundingBox();

  async function shoot(name, list) {
    await page.evaluate(list => {
      S.plot.items = [];
      const cols = Math.min(list.length, 5);
      list.forEach((a, i) => {
        addPlotItem(a[0], a[1] || '');
        const it = S.plot.items[S.plot.items.length - 1];
        if (a[2]) it.pose = a[2];
        it.x = 14 + (i % cols) * (72 / Math.max(1, cols - 1));
        it.y = list.length > 5 ? (i < 5 ? 26 : 72) : 50;
      });
      selPlot = null; renderPlotEditor(); stage3d.resetView();
    }, list);
    await page.waitForTimeout(1100);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.55);
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(40); }
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/3d-${name}.png`, clip: box });
  }

  if (wanted.length) await shoot('check', wanted.slice(0, 10));
  else {
    const cats = await page.evaluate(() => PLOT_CATS.map(c => [c, PLOT_PRESETS.filter(p => p.cat === c && p.type !== 'riser' && p.type !== 'text').map(p => [p.type, p.v || ''])]));
    for (const [c, list] of cats) await shoot(c, list.slice(0, 10));
  }

  /* Live mode: every animation runs for a while, so a broken anim() shows up as a page error */
  await page.evaluate(() => togglePlotLive());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/3d-live.png`, clip: box });
  await page.evaluate(() => setPlotView('2d', true));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/2d.png` });
  console.log(errs.join('\n') || 'no errors');
  await browser.close();
})();
