/* Remakes the pictures of the example rider that the homepage and the guides show.
   node shots.js <base-url> <out-dir>     (out-dir is normally img/ in the site root)
   Writes rider-sample.png (cover page), guide-stageplot.png (stage plot page, 2D as in the PDF),
   guide-inputlist.png (input list page) and guide-hospitality.png (top of the hospitality page). Pro is switched on locally so there is no watermark. */
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const OUT = process.argv[3] || 'img';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('rr_pro', 'test'); } catch (e) {} });
  await page.route(/goatcounter|gc\.zgo\.org|lemonsqueezy|supabase/, r => r.abort());
  await page.goto(BASE + '/rider-builder.html?demo=1');
  await page.waitForTimeout(2500);
  await page.evaluate(() => { if (typeof setPrevPlot === 'function') setPrevPlot('2d'); });
  await page.waitForTimeout(800);
  /* hide the on-screen 2D/3D switch: it is not part of the PDF */
  await page.addStyleTag({ content: '.plot-live-bar{display:none!important}' });
  const pageWith = async heading => {
    const n = await page.evaluate(h => [...document.querySelectorAll('#preview .page')].findIndex(p => [...p.querySelectorAll('h2')].some(x => new RegExp(h, 'i').test(x.textContent))), heading);
    if (n < 0) throw new Error('no page with heading ' + heading);
    return page.locator('#preview .page').nth(n);
  };
  const cover = page.locator('#preview .page.doc-cover');
  const box = await cover.boundingBox();
  const low = await page.evaluate(() => { const c = document.querySelector('#preview .page.doc-cover'), t = c.getBoundingClientRect().top; return Math.max(...[...c.querySelectorAll('.cover-head *')].map(e => e.getBoundingClientRect().bottom)) - t; });
  await page.screenshot({ path: OUT + '/rider-sample.png', clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, low + 60) } });
  await (await pageWith('stage plot')).screenshot({ path: OUT + '/guide-stageplot.png' });
  await (await pageWith('input list')).screenshot({ path: OUT + '/guide-inputlist.png' });
  /* the hospitality page is long: show its top part only */
  const hosp = await pageWith('hospitality');
  await hosp.evaluate(e => { e.style.maxHeight = '620px'; e.style.overflow = 'hidden'; });
  await hosp.screenshot({ path: OUT + '/guide-hospitality.png' });
  await browser.close();
  console.log('wrote rider-sample.png, guide-stageplot.png, guide-inputlist.png, guide-hospitality.png to ' + OUT);
})();
