---
name: motion
description: Use when adding or changing any animation, transition, hover or press state, or anything that opens, closes, appears, slides or fades on the RoboRider site or rider builder (modal, toast, banner, accordion, palette, panel, new section), and when asked to make something feel smoother, livelier, more polished or less abrupt.
---

# RoboRider motion

RoboRider moves quietly: motion explains what just happened and is otherwise absent. Every animation uses
the shared tokens, lives in the shared stylesheet when more than one page needs it, and still works with
"reduce motion" on.

Design background: `docs/superpowers/specs/2026-11-11-site-polish-motion-design.md`.

## Tokens

They live in `roborider.css` (site root, linked from every page). If that file does not exist yet, create
it with exactly these and link it, rather than writing values into a page.

| Token | Value | Use for |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | anything entering or responding |
| `--ease-in-out` | `cubic-bezier(0.77,0,0.175,1)` | something changing place on screen |
| `--dur-press` | `160ms` | press feedback |
| `--dur-ui` | `220ms` | modals, accordions, small panels opening |
| `--dur-exit` | `150ms` | closing and leaving |
| `--dur-enter` | `300ms` | toasts and banners sliding in |

A duration or curve written as a number in a page is a bug. If no token fits, the answer is almost always
"use the nearest token"; add a token only with the owner's agreement, and add it to this table.

## Wiring

- `<link rel="stylesheet" href="roborider.css">` goes in `<head>` before the page's own `<style>`, on every
  page that has the element you are animating.
- When a shared rule replaces a numeric one in a page (`transition:color .15s`), delete the page's rule in
  the same change; do not leave both and rely on order.
- `roborider.css` is listed in `SHELL` in `sw.js`.

## Decide first: should it move at all?

| How often a user meets it | Verdict |
|---|---|
| Constantly (typing, live preview, dragging, selecting, keyboard actions) | No motion |
| Many times a session (buttons, toggles, hover) | Press or colour change only |
| Occasionally (modals, toasts, accordions, panels) | Standard recipe below |
| Rarely (first run, export done, Pro activated) | One short moment of delight, once |

Then name the purpose in one word: feedback, where-it-came-from, state change, or softening a jump. No
word, no motion.

**Never animate:**

- the form while typing, or the live rider preview (`renderPreview()` redraws all of it per keystroke)
- dragging, selecting or moving items on the stage plot, 2D or 3D
- text swapping on a language change
- new scroll effects on the homepage; the existing `.reveal` is the whole budget
- anything in the PDF or print output

## Recipes

Only `transform` and `opacity`. Closing is faster than opening. Things leave the way they came.

```css
/* press: every button */
.btn{transition:transform var(--dur-press) var(--ease-out)}
.btn:active{transform:scale(.97)}

/* modal: builder modals toggle .open on .modal-bg between display:none and flex */
.modal-bg{opacity:0;transition:opacity var(--dur-exit) var(--ease-out),display var(--dur-exit) allow-discrete}
.modal-bg.open{opacity:1;transition-duration:var(--dur-ui)}
.modal-bg .modal{transform:scale(.97);transition:transform var(--dur-exit) var(--ease-out)}
.modal-bg.open .modal{transform:none;transition-duration:var(--dur-ui)}
@starting-style{.modal-bg.open{opacity:0}.modal-bg.open .modal{transform:scale(.97)}}

/* toast or banner: in from its edge, out the same way */
.toast{transform:translateY(100%);opacity:0;transition:transform var(--dur-exit) var(--ease-out),opacity var(--dur-exit) var(--ease-out)}
.toast.show{transform:none;opacity:1;transition-duration:var(--dur-enter)}
```

- **Stage plot editor (`#plotModal`): fade only, no scale.** It is full screen on phones and the 3D stage
  measures itself on open.
- Never start from `scale(0)`; `.95` to `.98` is the range.
- Hover is a colour change only, in `--dur-press`, inside `@media (hover:hover) and (pointer:fine)`. No
  lifts, shadows or scaling on hover.
- Accordions: height and opacity in `--dur-ui`.
- Delight (export done, Pro activated): at most 400ms, plays once, never blocks the next click.

## Reduce motion

One shared block in `roborider.css`. Movement and scale go; a fade of at most `--dur-exit` stays; nothing
loops; nothing is left invisible.

```css
@media (prefers-reduced-motion:reduce){
  :root .btn:active,:root .modal-bg .modal,:root .toast{transform:none}
  :root .hero-mark,:root .hero-mark .eye{animation:none}
}
```

Add each new moving selector to that block in the same change, starting with `:root`: the page's own
`<style>` loads after `roborider.css`, so without it the page's rule wins and the motion stays on. Setting durations to `.01ms` is not the
policy: it removes the fade as well.

## Check

```bash
python3 -m http.server 8765 &
node .claude/skills/site-check/site-check.js http://localhost:8765 <out-dir>
```

The `less-motion` lines must be `OK`. Then look at the change yourself with motion on: the script measures
loops, long runs and hidden content, not whether it feels right. Bump the cache version in `sw.js`.

## Common mistakes

| Mistake | Fix |
|---|---|
| Typed `.2s ease` into a page | Use the tokens |
| Rule added to one page's `<style>` while other pages have the same element | Put it in `roborider.css` |
| Enter animation as `@keyframes` | Use a transition, so a quick open-close retargets instead of restarting |
| Animated `height`, `top`, `width` on something large | `transform` and `opacity`; accordions are the one exception |
| Forgot the reduce-motion block | Add the selector there in the same change |
| Animated something on the never-animate list because it "would look nice" | Leave it instant |
