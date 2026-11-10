---
name: site-check
description: Check how the RoboRider site looks and works on laptop and iPhone (upright and sideways) - screenshots of every step, page errors, sideways scrolling, touch gestures on the 3D stage, broken internal links and the deployed version. Use for the weekly site check, after a deploy, or when asked whether the site or a change "looks right" or "works on mobile".
---

# RoboRider site check

One script walks the site the way a visitor does and reports what is wrong.

```bash
# the live site (needs roborider.nl on the environment's allowed hosts: use the "roborider" environment)
node .claude/skills/site-check/site-check.js https://roborider.nl <out-dir>

# the working copy
python3 -m http.server 8765 &
node .claude/skills/site-check/site-check.js http://localhost:8765 <out-dir>
```

It writes screenshots to `<out-dir>` and prints one line per check (`OK` / `FAIL`), then `PROBLEMS: n`.

## What it covers

- **Formats:** laptop 1440x900, iPhone 14 upright, iPhone 14 sideways.
- **Pages and steps:** homepage top and 3D stage; rider preview with the live 3D stage; stage plot editor
  in 2D, the fly-in, 3D, an element selected, the settings panel and the palette; the free "watching in 3D"
  bar. Free and Pro both.
- **Touch (iPhone):** tap selects, one-finger drag moves gear, one finger looks around, pinch zooms, and a
  vertical swipe over the homepage stage still scrolls the page.
- **Health:** page errors, sideways scrolling, every page in `sitemap.xml` loads, internal links resolve,
  and the service worker version that is deployed.

## How to judge the result

1. Read the `FAIL` lines first.
2. Then open the screenshots yourself. The script cannot see ugly: look for text that is cut off, things on
   top of each other, a stage that is cropped or mostly hidden, empty dark areas, buttons off screen.
3. Compare the deployed `sw.js` version with `sw.js` on `main`. A lower number on the live site means the
   last deploy has not gone out.

## What to do with findings

- Fix real problems on a branch and open a pull request. Never push to `main` and never merge: the owner
  approves.
- Run the script again on the working copy and include before/after screenshots in the report.
- Report in Dutch, shortest first: what is broken, what you fixed (with the PR link), what needs a decision.
- If everything passes, say so in two lines. Do not invent improvements to have something to report.

## Limits

This is iPhone-sized Chrome, not Safari on a real phone. Layout and gestures are reliable; smoothness, heat
and Safari-only quirks are not covered. Pro is switched on locally with a test value, so real payments and
license checks are not exercised.
