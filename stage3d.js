/* RoboRider — 3D stage view for the stage plot editor and the live rider preview.
   Loaded on demand by rider-builder.html (dynamic import) the first time someone opens a 3D view.
   It renders the SAME data as the 2D plot (S.plot.items: x/y/w/h in % of a 16:10 stage, rot in degrees,
   optional hgt in metres for risers), so the 2D plot, the rider preview and the PDF always match.

   create(api) options (all on the api object):
     host, items(), getSel(), setSel(id), snap(v), align(raw,half,others,axis), commit(), editLabel(it),
     audienceText(), ariaLabel()
     readOnly   – no selecting / dragging (rider preview)
     pageScroll – let vertical touch drags and the mouse wheel scroll the page instead of the camera */
import * as THREE from "./vendor/three.module.min.js";
import { buildGear } from "./stage3d-gear.js?v=3";

const SW = 10, SD = 6.25;            /* stage width / depth in metres (16:10, like the 2D canvas) */
const FOV = 32, BPM = 96, TAU = Math.PI * 2;
const COL = {
  stage: 0x3b332d, floor: 0x0f0e0c, dark: 0x25221f, mid: 0x3f3934, cloth: 0x5c544b,
  metal: 0x9a968f, clay: 0x9a7257, cream: 0xe9e2d3, brass: 0xc9a45c, white: 0xf4f1e9, yellow: 0xe3b53c,
  wood: 0x7a5a44, sel: 0xf0b48c
};
const SHIRTS = [0x9a7257, 0x3f4a57, 0x5f6b4e, 0x7a4a4a, 0x34302c, 0xb9a27c, 0x4d5d6b];
const HAIR = [0x2a2420, 0x4a3628, 0x6b5a45, 0x1b1a17];
const SHOW = [0xffb46b, 0x7fb2ff, 0xffd9a8, 0x7fb2ff, 0xffb46b];

export function create(api) {
  const host = api.host;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const el = renderer.domElement;
  el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:" + (api.pageScroll ? "pan-y" : "none");
  el.setAttribute("role", "img");
  if (!api.readOnly) el.tabIndex = -1;
  host.appendChild(el);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14120f);
  scene.fog = new THREE.Fog(0x14120f, 34, 90);
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 10, 0.1, 120);

  /* ---------- materials + textures (shared, never disposed per rebuild) ---------- */
  const M = {};
  const mat = (name, color, rough = 0.85, metal = 0) =>
    (M[name] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true }));
  mat("dark", COL.dark); mat("mid", COL.mid); mat("cloth", COL.cloth, 1); mat("metal", COL.metal, 0.4, 0.7);
  mat("steel", 0x55524d, 0.5, 0.6); mat("clay", COL.clay, 0.7); mat("cream", COL.cream, 0.9);
  mat("brass", COL.brass, 0.32, 0.8); mat("white", COL.white, 0.6); mat("wood", COL.wood, 0.7);
  mat("maple", 0xc9a777, 0.6); mat("ebony", 0x1d1917, 0.6); mat("stage", COL.stage, 0.92);
  mat("deck", 0x4b4239, 0.9); mat("trouser", 0x2a2826, 0.95); mat("shoe", 0x171614, 0.8);
  mat("sunburst", 0xa5532e, 0.35); mat("bassbody", 0x3a2a22, 0.35); mat("chrome", 0xd8d6d0, 0.2, 0.9);
  SHIRTS.forEach((c, i) => mat("shirt" + i, c, 0.95));
  HAIR.forEach((c, i) => mat("hair" + i, c, 1));
  M.yellow = new THREE.MeshStandardMaterial({ color: COL.yellow, roughness: 0.6, emissive: COL.yellow, emissiveIntensity: 0.35, flatShading: true });
  M.led = new THREE.MeshStandardMaterial({ color: 0x7dff9a, emissive: 0x39d86a, emissiveIntensity: 2 });
  M.ledred = new THREE.MeshStandardMaterial({ color: 0xff8a70, emissive: 0xff4a2a, emissiveIntensity: 2 });
  M.hit = new THREE.MeshBasicMaterial({ visible: false });
  M.sel = new THREE.LineBasicMaterial({ color: COL.sel, depthTest: false, transparent: true });
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  /* laptop screen: a little arrangement view, so it reads as a playback rig */
  const dawTex = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = "#16181c"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#23262c"; g.fillRect(0, 0, w, 14); g.fillRect(0, 14, 40, h);
    const cols = ["#e0a35f", "#6fa8dc", "#9bd08a", "#d98bb0", "#c9b35a", "#7fc8c2"];
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let r = 0; r < 6; r++) {
      const y = 20 + r * 22; let x = 44;
      g.fillStyle = "#2c3038"; g.fillRect(4, y + 3, 30, 12);
      while (x < w - 12) { const cw = 18 + rnd() * 50; if (rnd() > 0.25) { g.fillStyle = cols[r]; g.globalAlpha = 0.9; g.fillRect(x, y, Math.min(cw, w - x - 6), 17); g.globalAlpha = 1; } x += cw + 3; }
    }
    g.fillStyle = "#ffffff"; g.fillRect(132, 14, 1.5, h);
  });
  M.screen = new THREE.MeshStandardMaterial({ map: dawTex, emissiveMap: dawTex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.3 });
  const sheetTex = canvasTex(128, 96, (g, w, h) => {
    g.fillStyle = "#f6f2e8"; g.fillRect(0, 0, w, h); g.fillStyle = "#c9c2b2"; g.fillRect(w / 2 - 0.5, 0, 1, h);
    g.strokeStyle = "#3a3632"; g.lineWidth = 0.7;
    for (let p = 0; p < 2; p++) for (let s = 0; s < 4; s++) for (let l = 0; l < 5; l++) {
      const y = 10 + s * 22 + l * 2.6, x0 = 6 + p * 64; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 52, y); g.stroke();
    }
    g.fillStyle = "#1b1a17";
    for (let i = 0; i < 46; i++) { const p = i % 2, s = (i >> 1) % 4; g.beginPath(); g.ellipse(10 + p * 64 + ((i * 37) % 46), 11 + s * 22 + ((i * 13) % 9), 1.7, 1.2, 0, 0, TAU); g.fill(); }
  });
  M.sheet = new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.9 });

  /* ---------- lights: work light (always) + show rig (live mode) ---------- */
  const hemi = new THREE.HemisphereLight(0xfff1dd, 0x3a322c, 1.35); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2c0, 2.4);
  key.position.set(-5, 11, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7, near: 1, far: 30 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9c8ff, 0.7);
  rim.position.set(6, 7, -8);
  scene.add(rim);

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = r => new THREE.IcosahedronGeometry(r, 1);
  function add(g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
    me.castShadow = true; me.receiveShadow = true;
    g.add(me); return me;
  }
  function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* a thin rod between two points */
  function rod(g, m, a, b, r = 0.012) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va);
    const me = add(g, cyl(r, r, d.length(), 6), m);
    me.position.copy(va).addScaledVector(d, 0.5);
    me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return me;
  }

  /* ---------- static set: floor, stage, grid, backdrop, audience caption ---------- */
  const setGroup = new THREE.Group(); scene.add(setGroup);
  let audienceMesh = null;
  (function buildSet() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: COL.floor, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5; floor.receiveShadow = true; setGroup.add(floor);
    const slab = new THREE.Mesh(box(SW + 0.5, 0.5, SD + 0.5), M.stage);
    slab.position.y = -0.25; slab.receiveShadow = true; slab.castShadow = true; setGroup.add(slab);
    const lip = new THREE.Mesh(box(SW + 0.52, 0.06, 0.05), M.clay);
    lip.position.set(0, -0.03, SD / 2 + 0.25); setGroup.add(lip);
    /* grid: one line every 4% — the same grid the 2D editor shows */
    const pts = [];
    for (let i = 0; i <= 25; i++) {
      const x = -SW / 2 + (SW * i) / 25, z = -SD / 2 + (SD * i) / 25;
      pts.push(x, 0.004, -SD / 2, x, 0.004, SD / 2, -SW / 2, 0.004, z, SW / 2, 0.004, z);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    setGroup.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 })));
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(p => new THREE.Vector3(p[0] * SW / 2, 0.006, p[1] * SD / 2))),
      new THREE.LineBasicMaterial({ color: COL.clay, transparent: true, opacity: 0.8 }));
    setGroup.add(edge);
    /* backdrop: only visible from the front, so orbiting behind the stage never blocks the view */
    const back = new THREE.Mesh(new THREE.PlaneGeometry(SW + 8, 6.5), new THREE.MeshStandardMaterial({ color: 0x1c1916, roughness: 1 }));
    back.position.set(0, 2.75, -SD / 2 - 0.9); back.receiveShadow = true; setGroup.add(back);
  })();

  /* show rig: a truss with five cans and hazy beams — only in live mode, hidden when looking straight down */
  const showGroup = new THREE.Group(); showGroup.visible = false; scene.add(showGroup);
  const fixtures = [];
  (function buildShow() {
    const y = 4.6, z = -SD / 2 + 0.25, L = SW + 1.2;
    [[0.14, 0.14], [-0.14, 0.14], [0.14, -0.14], [-0.14, -0.14]].forEach(o => rod(showGroup, M.steel, [-L / 2, y + o[0], z + o[1]], [L / 2, y + o[0], z + o[1]], 0.022).castShadow = false);
    for (let i = 0; i < 16; i++) {
      const x0 = -L / 2 + (L * i) / 16, x1 = x0 + L / 16, up = i % 2 ? 0.14 : -0.14;
      rod(showGroup, M.steel, [x0, y + up, z + 0.14], [x1, y - up, z + 0.14], 0.012).castShadow = false;
      rod(showGroup, M.steel, [x0, y - 0.14, z + (i % 2 ? 0.14 : -0.14)], [x1, y - 0.14, z + (i % 2 ? -0.14 : 0.14)], 0.012).castShadow = false;
    }
    [-1, 1].forEach(s => { const m = add(showGroup, box(0.16, y + 0.7, 0.16), M.steel, s * (L / 2), (y + 0.7) / 2 - 0.5, z); m.castShadow = false; });
    SHOW.forEach((c, i) => {
      const x = -4 + i * 2, f = grp(showGroup, x, y - 0.32, z + 0.05);
      const home = new THREE.Vector3(x * 0.72, 0.6, 0.9 + (i % 2) * 0.9);
      const can = grp(f);
      const b = add(can, cyl(0.13, 0.11, 0.3, 12), M.dark, 0, 0, 0.12, Math.PI / 2, 0, 0); b.castShadow = false;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: c, fog: false }));
      lens.position.z = 0.275; can.add(lens);
      const len = 6.6, cg = new THREE.ConeGeometry(1.25, len, 24, 1, true);
      cg.rotateX(-Math.PI / 2); cg.translate(0, 0, len / 2 + 0.2);
      const pos = cg.attributes.position, cols = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) { const v = pos.getZ(k) < 1 ? 1 : 0.06; cols[k * 3] = cols[k * 3 + 1] = cols[k * 3 + 2] = v; }
      cg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
      const beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: c, vertexColors: true, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.renderOrder = 5; can.add(beam);
      const spot = new THREE.SpotLight(c, 70, 16, 0.3, 0.7, 1.4);
      f.add(spot); scene.add(spot.target);
      fixtures.push({ f: can, spot, beam, home, i });
    });
  })();
  function aimFixtures(t, moving) {
    fixtures.forEach(o => {
      const tx = o.home.x + (moving ? Math.sin(t * 0.35 + o.i * 1.3) * 0.9 : 0), tz = o.home.z + (moving ? Math.cos(t * 0.27 + o.i) * 0.5 : 0);
      o.spot.target.position.set(tx, o.home.y, tz);
      o.f.lookAt(tx, o.home.y, tz);
      const pulse = moving ? 0.82 + 0.18 * Math.sin(t * (BPM / 60) * Math.PI + o.i * 0.9) : 1;
      o.spot.intensity = 70 * pulse; o.beam.material.opacity = 0.16 * pulse * showFade;
    });
  }

  function textTexture(text, opt) {
    const o = Object.assign({ size: 44, color: "#e9e2d3", bg: null, pad: 18, weight: 500, spacing: 2 }, opt);
    const c = document.createElement("canvas"), g = c.getContext("2d");
    const font = `${o.weight} ${o.size}px Jost, Inter, -apple-system, "Segoe UI", sans-serif`;
    g.font = font;
    try { g.letterSpacing = o.spacing + "px"; } catch (e) {}
    const w = Math.ceil(g.measureText(text).width) + o.pad * 2, h = Math.ceil(o.size * 1.5);
    c.width = w; c.height = h;
    g.font = font;
    try { g.letterSpacing = o.spacing + "px"; } catch (e) {}
    if (o.bg) {
      g.fillStyle = o.bg; const r = h / 2;
      g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
    }
    g.fillStyle = o.color; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + o.size * 0.04);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.userData = { aspect: w / h };
    return t;
  }
  function setAudience() {
    if (audienceMesh) { setGroup.remove(audienceMesh); audienceMesh.geometry.dispose(); audienceMesh.material.map.dispose(); audienceMesh.material.dispose(); }
    const t = textTexture(String(api.audienceText() || "").toUpperCase(), { size: 40, color: "#8f8a80", spacing: 7 });
    const h = 0.34;
    audienceMesh = new THREE.Mesh(new THREE.PlaneGeometry(h * t.userData.aspect, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false }));
    audienceMesh.rotation.x = -Math.PI / 2;
    audienceMesh.position.set(0, -0.49, SD / 2 + 0.85);
    setGroup.add(audienceMesh);
  }

  /* ---------- gear library (stage3d-gear.js) ---------- */
  let anims = [];                 /* per-frame functions (t seconds) registered while building; cleared on sync */
  let seed = 0;                   /* per-item number from its id: varies shirts, hair and timing */
  const beat = t => (t * BPM) / 60;
  function riserHeight(it) {
    let h = +it.hgt;
    if (!(h > 0)) {
      const n = String(it.label || "").replace(/,/g, ".").match(/\d+(?:\.\d+)?/g);
      h = n && n.length >= 3 ? parseFloat(n[2]) : 0.4;
    }
    return clamp(isFinite(h) && h > 0 ? h : 0.4, 0.1, 1.5);
  }
  const BUILD = buildGear({ THREE, M, mat, add, grp, rod, box, cyl, sph, clamp, textTexture, anim: f => anims.push(f), seed: () => seed, beat, riserHeight, SHIRTS, HAIR });

  /* ---------- items ---------- */
  const itemsGroup = new THREE.Group(); scene.add(itemsGroup);
  let nodes = new Map();          /* id -> THREE.Group */
  const wx = x => ((x - 50) / 100) * SW, wz = y => ((y - 50) / 100) * SD;
  const ww = w => Math.max(0.05, ((w || 10) / 100) * SW), wd = h => Math.max(0.05, ((h || 10) / 100) * SD);

  /* things standing on a riser are lifted onto it */
  function baseY(it, items) {
    if (it.type === "riser") return 0;
    let y = 0;
    for (const r of items) {
      if (r.type !== "riser" || r.id === it.id) continue;
      const a = ((r.rot || 0) * Math.PI) / 180, dx = wx(it.x) - wx(r.x), dz = wz(it.y) - wz(r.y);
      const lx = dx * Math.cos(a) + dz * Math.sin(a), lz = -dx * Math.sin(a) + dz * Math.cos(a);
      if (Math.abs(lx) <= ww(r.w) / 2 && Math.abs(lz) <= wd(r.h) / 2) y = Math.max(y, riserHeight(r));
    }
    return y;
  }
  function disposeNode(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.isSprite || o.userData.ownMat) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
  function buildNode(it, selected) {
    const g = new THREE.Group(); g.userData.id = it.id;
    const W = ww(it.w), D = wd(it.h);
    seed = 0; for (const ch of String(it.id || "")) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    (BUILD[it.type] || BUILD.fallback)(g, W, D, it);
    const bb = new THREE.Box3().setFromObject(g);
    const top = isFinite(bb.max.y) ? Math.max(bb.max.y, 0.05) : 0.05;
    const hit = new THREE.Mesh(box(W, Math.max(top, 0.3), D), M.hit);
    hit.position.y = Math.max(top, 0.3) / 2; g.add(hit);
    const lbl = String(it.label || "").trim();
    if (lbl && it.type !== "text") {
      const t = textTexture(lbl.toUpperCase(), selected ? { bg: "rgba(154,114,87,.96)", color: "#ffffff" } : { bg: "rgba(20,18,15,.82)" });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false }));
      const h = 0.25; sp.scale.set(h * t.userData.aspect, h, 1);
      sp.position.y = top + 0.3; sp.renderOrder = 10; g.add(sp);
    }
    if (selected) {
      const hw = W / 2 + 0.07, hd = D / 2 + 0.07;
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
        [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(p => new THREE.Vector3(p[0], 0.03, p[1]))), M.sel);
      ring.renderOrder = 9; ring.raycast = () => {}; g.add(ring);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hd * 2),
        new THREE.MeshBasicMaterial({ color: COL.sel, transparent: true, opacity: 0.13, depthWrite: false }));
      fill.rotation.x = -Math.PI / 2; fill.position.y = 0.02; fill.userData.ownMat = true; fill.raycast = () => {}; g.add(fill);
    }
    return g;
  }
  function place(it, items) {
    const g = nodes.get(it.id); if (!g) return;
    g.position.set(wx(it.x), baseY(it, items), wz(it.y));
    g.rotation.y = (-(it.rot || 0) * Math.PI) / 180;
  }
  function sync() {
    const items = api.items() || [], sel = api.readOnly ? null : api.getSel();
    nodes.forEach(g => { itemsGroup.remove(g); disposeNode(g); });
    nodes = new Map(); anims = [];
    items.forEach(it => { const g = buildNode(it, it.id === sel); nodes.set(it.id, g); itemsGroup.add(g); });
    items.forEach(it => place(it, items));
    el.setAttribute("aria-label", api.ariaLabel ? api.ariaLabel() : "3D stage");
    invalidate();
  }

  /* ---------- camera + render loop ---------- */
  const view = { theta: 0, phi: 0.001, r: 12, target: new THREE.Vector3() };
  let tween = null, raf = 0, dirty = false, active = false, onscreen = true;
  let live = false, motion = false, auto = false, autoT0 = 0, showFade = 0;
  const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  function fitRadius() {
    const t = Math.tan((FOV * Math.PI) / 360);
    return Math.max(SD / 2 / t, SW / 2 / (t * camera.aspect)) * 1.05;
  }
  const topView = () => ({ theta: 0, phi: 0.001, r: fitRadius(), tx: 0, ty: 0, tz: 0 });
  const homeView = () => ({ theta: -0.5, phi: 1.02, r: fitRadius() * (camera.aspect > 1 ? 1.3 : 1.1), tx: 0, ty: live ? 0.9 : 0.35, tz: 0.1 });
  function applyView() {
    const s = Math.sin(view.phi);
    camera.position.set(view.target.x + view.r * s * Math.sin(view.theta), view.target.y + view.r * Math.cos(view.phi), view.target.z + view.r * s * Math.cos(view.theta));
    camera.lookAt(view.target);
  }
  function setView(v) { view.theta = v.theta; view.phi = v.phi; view.r = v.r; view.target.set(v.tx, v.ty, v.tz); }
  function currentView() { return { theta: view.theta, phi: view.phi, r: view.r, tx: view.target.x, ty: view.target.y, tz: view.target.z }; }
  function flyTo(to, ms) {
    return new Promise(res => {
      if (tween && tween.done) tween.done();
      if (!ms || reduced()) { setView(to); invalidate(); res(); return; }
      const from = currentView();
      /* take the short way round */
      from.theta = ((from.theta - to.theta + Math.PI) % TAU + TAU) % TAU - Math.PI + to.theta;
      tween = { from, to, t0: performance.now(), ms, done: res };
      invalidate();
    });
  }
  function frame(now) {
    raf = 0;
    const t = now / 1000;
    if (tween) {
      const p = clamp((now - tween.t0) / tween.ms, 0, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, f = tween.from, to = tween.to, v = {};
      for (const k in to) v[k] = f[k] + (to[k] - f[k]) * e;
      setView(v);
      if (p >= 1) { const d = tween.done; tween = null; d(); } else dirty = true;
    }
    if (motion) {
      for (const f of anims) f(t);
      if (auto && !tween && !mode) view.theta = -0.5 + Math.sin((t - autoT0) * 0.14) * 0.6;
    }
    /* the show rig sits above the stage: fade it out when you look straight down at the plot */
    showFade = live ? clamp((view.phi - 0.3) / 0.4, 0, 1) : 0;
    showGroup.visible = showFade > 0.02;
    if (live) aimFixtures(t, motion);
    applyView();
    renderer.render(scene, camera);
    if (dirty || (motion && active && onscreen)) { dirty = false; raf = requestAnimationFrame(frame); }
  }
  function invalidate() { if (!active) return; if (!raf) raf = requestAnimationFrame(frame); else dirty = true; }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    invalidate();
  }
  const ro = new ResizeObserver(resize); ro.observe(host);
  let io = null;
  try { io = new IntersectionObserver(es => { onscreen = es[es.length - 1].isIntersecting; if (onscreen) invalidate(); }); io.observe(host); } catch (e) {}
  function setLive(on) {
    live = !!on; motion = live && !reduced();
    hemi.intensity = live ? 0.8 : 1.35; key.intensity = live ? 1.5 : 2.4; rim.intensity = live ? 0.45 : 0.7;
    fixtures.forEach(o => (o.spot.visible = live));
    if (!motion) { /* settle into the rest pose */ if (active) sync(); } else invalidate();
  }
  setLive(false);

  /* ---------- pointer: select + drag gear, orbit / pan / zoom the camera ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitPt = new THREE.Vector3();
  const pts = new Map();
  let mode = null, drag = null, last = null, moved = 0, pinch = null;
  function setRay(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pick(e) {
    setRay(e);
    const hits = ray.intersectObjects(itemsGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.id) o = o.parent; if (o) return o.userData.id; }
    return null;
  }
  function groundAt(e, y) { setRay(e); plane.constant = -y; return ray.ray.intersectPlane(plane, hitPt) ? hitPt.clone() : null; }
  function pan(dx, dy) {
    const s = view.r * 0.0017, c = Math.cos(view.theta), sn = Math.sin(view.theta);
    view.target.x -= c * dx * s + sn * dy * s;
    view.target.z -= -sn * dx * s + c * dy * s;
    view.target.x = clamp(view.target.x, -SW, SW); view.target.z = clamp(view.target.z, -SD * 1.5, SD * 1.5);
  }
  function zoomBy(f) { view.r = clamp(view.r * f, 2.5, 40); invalidate(); }
  el.addEventListener("pointerdown", e => {
    if (tween) return;
    auto = false;
    if (!api.readOnly) el.focus({ preventScroll: true });
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      if (mode === "drag" && drag && drag.changed) api.commit();
      const a = [...pts.values()];
      pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2 };
      mode = "pinch"; drag = null; return;
    }
    if (pts.size > 2) return;
    moved = 0; last = { x: e.clientX, y: e.clientY };
    const id = api.readOnly ? null : pick(e);
    if (id && e.button === 0 && !e.shiftKey) {
      if (api.getSel() !== id) api.setSel(id);
      const items = api.items(), it = items.find(x => x.id === id);
      const y = baseY(it, items), p = groundAt(e, y);
      drag = { it, y, ox: p ? p.x - wx(it.x) : 0, oz: p ? p.z - wz(it.y) : 0, others: items.filter(o => o.id !== id) };
      mode = "drag"; el.style.cursor = "grabbing";
    } else {
      mode = e.button === 2 || e.button === 1 || e.shiftKey ? "pan" : "orbit";
      drag = { hitNothing: !id };
    }
  });
  el.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) { if (!api.readOnly && !tween) el.style.cursor = pick(e) ? "grab" : ""; return; }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === "pinch" && pts.size >= 2) {
      const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      view.r = clamp(view.r * (pinch.d / d), 2.5, 40);
      pan(mx - pinch.mx, my - pinch.my);
      pinch = { d, mx, my }; invalidate(); return;
    }
    if (!last) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY }; moved += Math.abs(dx) + Math.abs(dy);
    if (mode === "drag" && drag && drag.it) {
      if (moved < 4) return;
      const p = groundAt(e, drag.y); if (!p) return;
      const it = drag.it, rx = ((p.x - drag.ox) / SW) * 100 + 50, ry = ((p.z - drag.oz) / SD) * 100 + 50;
      const ax = api.align(rx, (it.w || 0) / 2, drag.others, "x"), ay = api.align(ry, (it.h || 0) / 2, drag.others, "y");
      it.x = clamp(ax ? ax.pos : api.snap(rx), 0, 100); it.y = clamp(ay ? ay.pos : api.snap(ry), 0, 100);
      const items = api.items(); items.forEach(o => place(o, items));
      drag.changed = true; invalidate();
    } else if (mode === "orbit") {
      view.theta -= dx * 0.006; view.phi = clamp(view.phi - dy * 0.006, 0.02, 1.5); invalidate();
    } else if (mode === "pan") { pan(dx, dy); invalidate(); }
  });
  function end(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (mode === "pinch") { if (pts.size < 2) { mode = null; last = null; pts.clear(); } return; }
    if (mode === "drag" && drag && drag.changed) api.commit();
    else if (mode === "orbit" && moved < 5 && drag && drag.hitNothing && !api.readOnly && api.getSel()) api.setSel(null);
    mode = null; drag = null; last = null; el.style.cursor = "";
  }
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", e => {
    if (api.pageScroll && !e.ctrlKey) return;      /* in the rider preview the wheel scrolls the page */
    e.preventDefault(); auto = false; if (!tween) zoomBy(Math.exp(clamp(e.deltaY, -120, 120) * 0.0012));
  }, { passive: false });
  el.addEventListener("contextmenu", e => e.preventDefault());
  el.addEventListener("dblclick", e => { if (api.readOnly) return; const id = pick(e); if (id) { const it = api.items().find(x => x.id === id); if (it) api.editLabel(it); } });

  /* ---------- public ---------- */
  return {
    sync, setLive,
    isLive: () => live,
    /* 2D → 3D: start exactly on the top-down plot, then sweep down into the stage.
       opts.orbit: let the camera drift slowly around the front of the stage until someone touches it. */
    async enter(animate, opts) {
      active = true; resize(); setAudience(); sync();
      if (animate) { setView(topView()); applyView(); renderer.render(scene, camera); await flyTo(homeView(), 1100); }
      else { setView(homeView()); invalidate(); }
      auto = !!(opts && opts.orbit); autoT0 = performance.now() / 1000;
    },
    /* 3D → 2D: rise back to the top-down plot; the caller then swaps in the 2D editor */
    async leave(animate) { auto = false; if (animate) await flyTo(topView(), 800); active = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } tween = null; },
    isActive: () => active,
    zoomBy(d) { if (!tween) zoomBy(d > 0 ? 0.8 : 1.25); },
    resetView() { flyTo(homeView(), 600); },
    topDown() { flyTo(topView(), 600); },
    dispose() { ro.disconnect(); if (io) io.disconnect(); nodes.forEach(disposeNode); renderer.dispose(); el.remove(); }
  };
}
