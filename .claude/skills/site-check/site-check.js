/* RoboRider site check: see SKILL.md next to this file.
   node site-check.js <base-url> <out-dir> */
const { chromium, devices } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const OUT = process.argv[3] || '.';
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const results = [];
const ok = (fmt, what, pass, note) => results.push({ fmt, what, pass: !!pass, note: note || '' });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const formats = [
    ['laptop', { viewport: { width: 1440, height: 900 } }, false],
    ['iphone', devices['iPhone 14'], true],
    ['iphone-sideways', devices['iPhone 14 landscape'], true]
  ];

  async function open(ctxOpt, pro, tag) {
    const ctx = await browser.newContext(ctxOpt), page = await ctx.newPage();
    page.on('pageerror', e => ok(tag, 'page error: ' + e.message.slice(0, 140), false));
    page.on('dialog', d => d.accept());
    /* third parties are not what we are testing, and analytics must not count our own checks */
    await page.route(/goatcounter|gc\.zgo\.org|lemonsqueezy/, r => r.abort());
    if (LOCAL) await page.route(/supabase|fonts\.g/, r => r.abort());
    await page.addInitScript(pro => { try { if (pro) localStorage.setItem('rr_pro', 'test'); } catch (e) {} }, pro);
    const cdp = await ctx.newCDPSession(page);
    const touch = async frames => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: frames[0].map((q, i) => ({ x: q.x, y: q.y, id: i })) });
      for (const f of frames.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: f.map((q, i) => ({ x: q.x, y: q.y, id: i })) }); await page.waitForTimeout(25); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(400);
    };
    return { ctx, page, touch };
  }
  const line = (a, b, n = 8) => Array.from({ length: n + 1 }, (_, i) => [{ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }]);
  const hash = async (page, sel) => crypto.createHash('md5').update(await page.locator(sel).screenshot()).digest('hex');
  const overflow = async (page, tag, where) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(tag, 'no sideways scrolling: ' + where, o <= 1, o > 1 ? o + 'px too wide' : '');
  };
  async function findItem(page) {
    const box = await page.locator('#stage3d canvas').boundingBox();
    for (let fy = 0.2; fy < 0.95; fy += 0.05) for (let fx = 0.15; fx < 0.9; fx += 0.05) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      await page.mouse.move(x, y);
      if ((await page.evaluate(() => document.querySelector('#stage3d canvas').style.cursor)) === 'grab') return { x, y };
    }
    return null;
  }

  for (const [fmt, ctxOpt, isTouch] of formats) {
    /* ---------- homepage (free visitor) ---------- */
    let { ctx, page, touch } = await open(ctxOpt, false, fmt);
    await page.goto(BASE + '/index.html'); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${fmt}-1-home-top.png` });
    await overflow(page, fmt, 'homepage');
    await page.evaluate(() => { const e = document.getElementById('hero3d'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 80); });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/${fmt}-2-home-stage.png` });
    const stage = await page.evaluate(() => { const c = document.querySelector('#hero3d canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(r.top + r.height / 2, innerHeight - 60), h: r.height, ih: innerHeight }; });
    ok(fmt, 'homepage 3D stage is showing', !!stage);
    if (stage) ok(fmt, 'homepage stage fits on the screen', stage.h <= stage.ih, Math.round(stage.h) + 'px in a ' + stage.ih + 'px screen');
    if (stage && isTouch) {
      const y0 = await page.evaluate(() => scrollY);
      await touch(line({ x: stage.x, y: stage.y }, { x: stage.x, y: stage.y - 140 }, 10));
      ok(fmt, 'swiping up over the homepage stage scrolls the page', (await page.evaluate(() => scrollY)) > y0 + 50);
    }
    await ctx.close();

    for (const pro of [false, true]) {
      const tag = `${fmt}-${pro ? 'pro' : 'free'}`;
      ({ ctx, page, touch } = await open(ctxOpt, pro, tag));
      await page.goto(BASE + '/rider-builder.html?demo=1'); await page.waitForTimeout(1500);
      /* ---------- rider preview ---------- */
      await page.evaluate(() => { if (typeof isStepMode === 'function' && isStepMode()) { const t = [...document.querySelectorAll('.mobile-tabs button')].find(x => /preview|voorbeeld/i.test(x.textContent)); if (t) t.click(); } });
      await page.waitForTimeout(400);
      await page.evaluate(() => { const e = document.querySelector('.plot-live'); if (e) e.scrollIntoView({ block: 'center' }); });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${OUT}/${tag}-3-preview.png` });
      ok(tag, 'rider preview shows the live 3D stage', await page.evaluate(() => typeof prev3d !== 'undefined' && !!prev3d && prev3d.isActive()));
      await overflow(page, tag, 'preview');
      /* ---------- stage plot editor ---------- */
      await page.evaluate(() => openPlotModal()); await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${tag}-4-editor-2d.png` });
      await page.evaluate(() => { setPlotView('3d'); }); await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${tag}-5-editor-fly-in.png` });
      await page.waitForTimeout(2300);
      await page.screenshot({ path: `${OUT}/${tag}-6-editor-3d.png` });
      ok(tag, '3D view opens', (await page.evaluate(() => plotView)) === '3d' && !!(await page.locator('#stage3d canvas').count()));
      await overflow(page, tag, '3D editor');
      const before = await page.evaluate(() => JSON.stringify(S.plot.items.map(i => [i.x, i.y])));
      const at = await findItem(page);
      if (!pro) {
        const box = await page.locator('#stage3d canvas').boundingBox(), m = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        if (isTouch) await touch(line(m, { x: m.x + 60, y: m.y + 20 }));
        else { await page.mouse.move(m.x, m.y); await page.mouse.down(); await page.mouse.move(m.x + 60, m.y + 20, { steps: 6 }); await page.mouse.up(); }
        ok(tag, 'free plan cannot move gear in 3D', before === (await page.evaluate(() => JSON.stringify(S.plot.items.map(i => [i.x, i.y])))));
        const ub = await page.locator('#stage3dUnlock').boundingBox();
        ok(tag, 'unlock button is on screen', !!ub && ub.y + ub.height <= (await page.evaluate(() => innerHeight)) + 1);
      } else if (at) {
        if (isTouch) await touch([[at], [at]]); else await page.mouse.click(at.x, at.y);
        await page.waitForTimeout(400);
        ok(tag, 'tapping an element selects it', !!(await page.evaluate(() => selPlot)));
        await page.screenshot({ path: `${OUT}/${tag}-7-editor-selected.png` });
        const lay = await page.evaluate(() => { const t = document.getElementById('plotTools').getBoundingClientRect(), s = document.getElementById('stage3d').getBoundingClientRect(); return { on: t.height > 0 && t.bottom <= innerHeight + 1, over: t.top < s.bottom - 1 && t.bottom > s.top + 1, stage: Math.round(s.height) }; });
        ok(tag, 'tools are on screen and not on top of the stage', lay.on && !lay.over, 'stage is ' + lay.stage + 'px high');
        const at2 = (await findItem(page)) || at;
        if (isTouch) await touch(line(at2, { x: at2.x + 50, y: at2.y + 18 }));
        else { await page.mouse.move(at2.x, at2.y); await page.mouse.down(); await page.mouse.move(at2.x + 60, at2.y + 20, { steps: 6 }); await page.mouse.up(); }
        ok(tag, 'dragging an element moves it', before !== (await page.evaluate(() => JSON.stringify(S.plot.items.map(i => [i.x, i.y])))));
        await page.evaluate(() => { const t = document.getElementById('plotTools'); if (getComputedStyle(document.getElementById('ptMore')).display !== 'none' && !t.classList.contains('props-open')) togglePlotProps(); });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${tag}-8-editor-panel.png` });
        await page.evaluate(() => { if (getComputedStyle(document.getElementById('plotAddBtn')).display !== 'none') togglePalette(); });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${tag}-9-editor-palette.png` });
        if (isTouch) {
          await page.evaluate(() => { const m = document.getElementById('plotModal'); m.classList.remove('pal-open'); document.getElementById('plotTools').classList.remove('props-open'); selPlot = null; highlightSel(); if (plotLive) togglePlotLive(); });
          await page.waitForTimeout(600);
          const b = await page.locator('#stage3d canvas').boundingBox(), e0 = { x: b.x + 12, y: b.y + 12 }, c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          const h0 = await hash(page, '#stage3d canvas');
          await touch(line(e0, { x: e0.x + 90, y: e0.y + 30 }));
          const h1 = await hash(page, '#stage3d canvas');
          ok(tag, 'one finger looks around', h0 !== h1);
          await touch(Array.from({ length: 9 }, (_, i) => [{ x: c.x - 20 - i * 9, y: c.y }, { x: c.x + 20 + i * 9, y: c.y }]));
          ok(tag, 'pinch zooms', h1 !== (await hash(page, '#stage3d canvas')));
        }
      } else ok(tag, 'found an element to tap in 3D', false);
      await ctx.close();
    }
  }

  /* ---------- health: sitemap pages, internal links, deployed version ---------- */
  const ctx = await browser.newContext(), page = await ctx.newPage();
  const get = async u => { try { const r = await ctx.request.get(u, { maxRedirects: 5 }); return r.status(); } catch (e) { return 0; } };
  let pages = ['/index.html', '/rider-builder.html'];
  try {
    const xml = await (await ctx.request.get(BASE + '/sitemap.xml')).text();
    pages = [...new Set(pages.concat([...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/^https?:\/\/[^/]+/, '') || '/')))];
  } catch (e) { ok('health', 'sitemap.xml is readable', false); }
  const links = new Set();
  for (const pg of pages) {
    const st = await get(BASE + pg);
    ok('health', 'page loads: ' + pg, st === 200, 'status ' + st);
    if (st !== 200) continue;
    await page.route(/goatcounter|gc\.zgo\.org/, r => r.abort());
    await page.goto(BASE + pg, { waitUntil: 'domcontentloaded' });
    (await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href))).forEach(h => { if (h.startsWith(location.origin) || h.startsWith(BASE)) links.add(h.split('#')[0]); });
  }
  for (const h of links) { const st = await get(h); if (st !== 200) ok('health', 'internal link works: ' + h.replace(BASE, ''), false, 'status ' + st); }
  ok('health', links.size + ' internal links checked', true);
  try { const sw = await (await ctx.request.get(BASE + '/sw.js?cb=' + Date.now())).text(); ok('health', 'deployed version: ' + ((sw.match(/roborider-v\d+/) || ['unknown'])[0]), true); } catch (e) { ok('health', 'sw.js is readable', false); }
  await browser.close();

  for (const r of results) console.log((r.pass ? 'OK   ' : 'FAIL ') + '| ' + r.fmt + ' | ' + r.what + (r.note ? ' | ' + r.note : ''));
  console.log('PROBLEMS: ' + results.filter(r => !r.pass).length);
})();
