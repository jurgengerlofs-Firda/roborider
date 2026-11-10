---
name: stage-plot-element
description: Add or change an element in the RoboRider stage plot editor - a new instrument, a variant of an existing one (another guitar, drum kit, mic, piano), a new sitting/standing pose, or a fix to how a 3D model looks or moves. Use when asked to add gear, instruments, band members or furniture to the stage plot, the 3D stage or the element palette.
---

# Adding a stage plot element

The stage plot has one data model and three views of it. An item in `S.plot.items` is
`{id, type, v?, pose?, label, x, y, w, h, rot, hgt?}` (x/y/w/h in % of a 16:10 stage). The 2D editor,
the rider preview/PDF and the 3D stage all draw that same item, so a new element is never "a 3D thing":
it is a preset in the builder plus a model in the gear library.

| File | Holds |
|---|---|
| `rider-builder.html` | `PLOT_TYPES`, `PLOT_CATS`, `PLOT_PRESETS`, `POSE_TYPES`, `PLOT_ICONS`, the i18n block "Stageplot: instrument library" |
| `stage3d-gear.js` | every 3D model: `BUILD` plus the `KEYS`, `DRUMS`, `PERC` tables and helpers |
| `stage3d.js` | scene, camera, lights, animation loop. Rarely needs touching for a new element |
| `sw.js` | cache version, bumped on every deploy |

Search for the names above rather than trusting line numbers.

## Decide first: variant or new type

Prefer a **variant** (`v`) of an existing type. A variant appears in the palette and in the Type dropdown
of the element panel, so users can swap it without re-placing anything. Add a **new type** only when
nothing existing fits (as happened for `dj`, `horn`, `strings`).

## Steps

1. **Preset** - add `{cat, type, v, w?, h?}` to `PLOT_PRESETS`. Footprint is real size on a 10 x 6.25 m
   stage: `w` = metres x 10, `h` = metres x 16. Leave them out to inherit the type's default.
2. **New type only** - add it to `PLOT_TYPES` (label, default w/h, 2D shape, colour) and `PLOT_ICONS`,
   and to `POSE_TYPES` if a person plays it standing or seated.
3. **Labels in all five languages** - add `pv_<type>_<v>` (or `pt_<type>` for a new type) to the
   en, nl, de, fr and es objects in the "Stageplot: instrument library" block. The label is used both in
   the palette and as the default label on the plot, so keep it short. Dutch copy: no em-dashes.
4. **3D model** in `stage3d-gear.js`:
   - Build at real size in metres inside `fit(g, W, D, nominalWidth, nominalDepth)`, facing the audience (+z).
   - Use the helpers: `add`, `grp`, `rod`, `tube`, `box`, `cyl`, `sph`, shared materials `M.*`
     (add a new one with `mat(name, color, roughness, metalness)`), `splineShape` + `shape()` for
     outlines, `keyStrip`, `drumShell`, `cymbal`, `micStand`, `micHead`, `vfam`, `guitarModel`.
   - A player comes from `person(group, x, z, pose)`. It returns `{body, head, R, L, ph, hip}`;
     pose arms with `setArm(arm, shoulderX, shoulderZ, elbowX)`. Negative x rotation swings forward;
     R is the player's right (-x). Attach a held instrument to `pr.body` so it follows the sway.
   - Respect `it.pose` with `poseOf(it, ["stand","high","low"])`; `person` adds the stool or chair itself.
     Use pose `"perch"` when the model supplies its own seat (bench, throne, cajon).
   - Motion: `anim(t => { ... })` with `beat(t)` so everyone stays on one tempo. Add `pr.ph` for a small
     per-person offset. Keep it subtle.
   - Wire it into `BUILD[type]` (dispatch on `it.v`), or into `KEYS` / `DRUMS` / `PERC`.
   - Never dispose or mutate shared `M.*` materials per item. A mesh with its own material or texture
     needs `userData.ownMat = true` so it is cleaned up on rebuild.
5. **Version bumps** - `CACHE` in `sw.js` (+1), and if `stage3d-gear.js` changed, the `?v=` on its
   import in `stage3d.js` and on both `import("./stage3d.js?v=N")` calls in `rider-builder.html`.

## Verify (required)

```bash
python3 -m http.server 8765 &
node .claude/skills/stage-plot-element/render-check.js <out-dir> horn:flute strings:harp:low
```

Arguments are `type[:variant[:pose]]`; with none it renders every preset per palette category. It
writes `3d-*.png`, `3d-live.png` and `2d.png` and prints `no errors` or the page errors. Open the PNGs:
check the model reads at a glance, hands reach the instrument, nothing floats or sinks into the floor,
and the 2D box and label look right. Then commit with a message ending in the new `SW vNN`.

## Common mistakes

- Model the wrong way round: the player faces +z, so a piano's keyboard is at -z and the audience sees its back.
- A new variant missing from `PLOT_PRESETS`: the model exists but nothing can add or select it.
- Labels added in English only: other languages silently fall back, which looks unfinished.
- Thin parts casting shadows: wrap small details in `noShadow(...)` to keep the shadow map clean and fast.
- 3D is a Pro feature. Do not add anything the free 2D plot depends on to the 3D files.
