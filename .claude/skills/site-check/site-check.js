/* RoboRider site check: see SKILL.md next to this file.
   node site-check.js <base-url> <out-dir> */
const { chromium, devices } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const OUT = process.argv[3] || '.';
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const ONLY = process.env.SITE_CHECK_ONLY || ''; /* SITE_CHECK_ONLY=polish skips the long walk-through */
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
    for (let fy = 0.3; fy < 0.9; fy += 0.08) for (let fx = 0.2; fx < 0.85; fx += 0.08) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      await page.mouse.move(x, y);
      if ((await page.evaluate(() => document.querySelector('#stage3d canvas').style.cursor)) === 'grab') return { x, y };
    }
    return null;
  }

  for (const [fmt, ctxOpt, isTouch] of ONLY ? [] : formats) {
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

  /* ---------- less motion: with "reduce motion" on, nothing loops or runs long and nothing stays hidden ----------
     SITE_CHECK_MOTION=full runs the same round with motion allowed, to prove the check can fail. */
  const reduce = process.env.SITE_CHECK_MOTION !== 'full';
  for (const [fmt, ctxOpt] of ONLY ? [] : formats.slice(0, 2)) {
    const tag = fmt + '-less-motion';
    const { ctx, page } = await open({ ...ctxOpt, reducedMotion: reduce ? 'reduce' : 'no-preference' }, false, tag);
    const steps = [
      ['homepage', '/index.html', () => { window.scrollTo(0, document.documentElement.scrollHeight); const d = document.querySelector('.faq details'); if (d) d.open = true; }],
      ['builder with the stage plot editor open', '/rider-builder.html?demo=1', () => { if (typeof openPlotModal === 'function') openPlotModal(); }]
    ];
    for (const [where, url, act] of steps) {
      await page.goto(BASE + url); await page.waitForTimeout(1500);
      await page.evaluate(act); await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const name = a => (a.animationName || a.transitionProperty || 'animation') + ' on ' + ((a.effect && a.effect.target && (a.effect.target.id ? '#' + a.effect.target.id : '.' + String(a.effect.target.className.baseVal || a.effect.target.className).split(' ')[0])) || '?');
        const moving = document.getAnimations().filter(a => { const t = a.effect && a.effect.getComputedTiming(); return a.playState === 'running' && t && (t.iterations === Infinity || t.activeDuration > 250); }).map(name);
        const hidden = [...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity < 0.99).length;
        return { moving: [...new Set(moving)], hidden };
      });
      ok(tag, 'nothing loops or runs long: ' + where, !m.moving.length, m.moving.slice(0, 4).join(', '));
      ok(tag, 'nothing stays hidden: ' + where, !m.hidden, m.hidden ? m.hidden + ' hidden' : '');
      await page.screenshot({ path: `${OUT}/${tag}-${where.split(' ')[0]}.png` });
    }
    await ctx.close();
  }

  /* ---------- polish: shared stylesheet, homepage, builder and guide details ---------- */
  const sitePages = async () => {
    let p = ['/index.html', '/rider-builder.html', '/404.html', '/privacy.html', '/terms.html'];
    try {
      const c = await browser.newContext();
      const xml = await (await c.request.get(BASE + '/sitemap.xml')).text();
      p = p.concat([...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/^https?:\/\/[^/]+/, '')).filter(u => u && u !== '/'));
      await c.close();
    } catch (e) {}
    return [...new Set(p)];
  };
  const laptop = formats[0][1], iphone = formats[1][1];
  {
    const { ctx, page } = await open(laptop, false, 'polish');
    for (const pg of await sitePages()) {
      await page.goto(BASE + pg, { waitUntil: 'load' });
      const r = await page.evaluate(() => ({
        linked: !!document.querySelector('link[href="roborider.css"]') && getComputedStyle(document.documentElement).getPropertyValue('--dur-ui').trim() === '220ms',
        own: [...document.querySelectorAll('style')].some(s => /--ink\s*:/.test(s.textContent))
      }));
      ok('polish', 'shared stylesheet is linked: ' + pg, r.linked);
      ok('polish', 'page does not redefine shared colours: ' + pg, !r.own);
    }
    await page.goto(BASE + '/index.html'); await page.waitForTimeout(600);
    ok('polish', 'buttons have a press state', await page.evaluate(() => getComputedStyle(document.querySelector('.btn')).transitionProperty.includes('transform')));
    await ctx.close();
  }
  {
    /* homepage on a phone: the pitch fits on the first screen */
    const { ctx, page } = await open(iphone, false, 'polish');
    await page.goto(BASE + '/index.html'); await page.waitForTimeout(1200);
    const pillHidden = await page.evaluate(() => document.getElementById('rrInstallPill').hidden);
    ok('polish', 'phone: install tip waits for the first scroll', pillHidden);
    ok('polish', 'phone: navigation is one row', (await page.evaluate(() => document.querySelector('nav').getBoundingClientRect().height)) <= 80);
    for (const l of ['en', 'nl', 'de', 'fr', 'es']) {
      const r = await page.evaluate(l => { setLang(l); const bs = [document.querySelector('.hero h1'), ...document.querySelectorAll('.hero .cta a')].map(e => Math.round(e.getBoundingClientRect().bottom)); return { low: Math.max(...bs), ih: innerHeight, n: bs.length }; }, l);
      ok('polish', 'phone: headline and both buttons are above the fold: ' + l, r.n === 3 && r.low <= r.ih, 'lowest at ' + r.low + 'px on a ' + r.ih + 'px screen');
    }
    await page.evaluate(() => setLang('en'));
    await page.screenshot({ path: `${OUT}/polish-phone-home.png` });
    await page.mouse.wheel(0, 300); await page.waitForTimeout(700);
    ok('polish', 'phone: install tip shows after scrolling', await page.evaluate(() => !document.getElementById('rrInstallPill').hidden));
    await ctx.close();
  }
  for (const [name, fmtOpt] of [['laptop', laptop], ['phone', iphone]]) {
    /* homepage: the newest features are listed, in every language, without spilling out of their cards */
    const { ctx, page } = await open(fmtOpt, false, 'polish');
    await page.goto(BASE + '/index.html'); await page.waitForTimeout(800);
    for (const l of ['en', 'nl', 'de', 'fr', 'es']) {
      const r = await page.evaluate(l => {
        setLang(l);
        const txt = k => { const e = document.querySelector('[data-i="' + k + '"]'); return e ? e.textContent.trim().length : 0; };
        const spill = [...document.querySelectorAll('#features .card, .plan.feat')].filter(e => e.scrollWidth > e.clientWidth + 1).length;
        return { have: ['f7_h', 'f7_p', 'f8_h', 'f8_p', 'p2_5'].every(k => txt(k) > 3), spill };
      }, l);
      if (name === 'laptop') ok('polish', 'new features are on the homepage: ' + l, r.have);
      ok('polish', name + ': feature cards do not overflow: ' + l, !r.spill, r.spill ? r.spill + ' too wide' : '');
    }
    await page.evaluate(() => { setLang('de'); document.getElementById('features').scrollIntoView(); });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/polish-${name}-features.png` });
    await ctx.close();
  }
  {
    /* homepage: shows what the result looks like, in text you can read */
    const { ctx, page } = await open(laptop, false, 'polish');
    await page.goto(BASE + '/index.html'); await page.waitForTimeout(800);
    await page.evaluate(() => { const e = document.querySelector('.showcase'); if (e) e.scrollIntoView(); }); await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const i = document.querySelector('.showcase img');
      const sizes = [...document.querySelectorAll('.send-item p, #features .card p, .step p')].map(e => parseFloat(getComputedStyle(e).fontSize));
      return { img: !!i && i.naturalWidth > 0 && (i.alt || '').length >= 20 && i.hasAttribute('width') && i.hasAttribute('height') && i.loading === 'lazy', min: Math.min(...sizes) };
    });
    ok('polish', 'homepage shows a real rider page', r.img);
    ok('polish', 'homepage body text is at least 15px', r.min >= 15, 'smallest is ' + r.min + 'px');
    await page.screenshot({ path: `${OUT}/polish-laptop-showcase.png` });
    await ctx.close();
  }
  if (LOCAL) {
    const ctx = await browser.newContext(laptop), page = await ctx.newPage();
    await page.route(/goatcounter|gc\.zgo\.org|supabase|fonts\.g/, r => r.abort());
    await page.goto(BASE + '/index.html');
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(2500);
    await ctx.setOffline(true);
    let v = '';
    try { await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500); v = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dur-ui').trim()); } catch (e) { v = 'page did not load'; }
    ok('polish', 'homepage works offline with the shared stylesheet', v === '220ms', v);
    await ctx.close();
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
    (await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href))).forEach(h => { if (h.startsWith(BASE + '/') || h === BASE) links.add(h.split('#')[0]); });
  }
  const todo = [...links].filter(h => !pages.some(pg => BASE + pg === h));
  for (let i = 0; i < todo.length; i += 8)
    await Promise.all(todo.slice(i, i + 8).map(async h => { const st = await get(h); if (st !== 200) ok('health', 'internal link works: ' + h.replace(BASE, ''), false, 'status ' + st); }));
  ok('health', links.size + ' internal links checked', true);
  try { const sw = await (await ctx.request.get(BASE + '/sw.js?cb=' + Date.now())).text(); ok('health', 'deployed version: ' + ((sw.match(/roborider-v\d+/) || ['unknown'])[0]), true); } catch (e) { ok('health', 'sw.js is readable', false); }
  await browser.close();

  for (const r of results) console.log((r.pass ? 'OK   ' : 'FAIL ') + '| ' + r.fmt + ' | ' + r.what + (r.note ? ' | ' + r.note : ''));
  console.log('PROBLEMS: ' + results.filter(r => !r.pass).length);
})();
