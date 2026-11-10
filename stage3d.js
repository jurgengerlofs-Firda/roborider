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

  /* ---------- gear library ---------- */
  let anims = [];                 /* per-frame functions (t seconds) registered while building; cleared on sync */
  let seed = 0;                   /* per-item number from its id: varies shirts, hair and timing */
  const beat = t => (t * BPM) / 60;
  /* a prism from a side profile [[z,y],…], extruded across the width (x) */
  function prism(profile, W) {
    const s = new THREE.Shape();
    profile.forEach((p, i) => (i ? s.lineTo(-p[0], p[1]) : s.moveTo(-p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-W / 2, 0, 0);
    return geo;
  }
  /* A band member. Faces the audience (+z). Returns the joints so each instrument can pose and animate them.
     Arms: R = the player's right (-x), L = the player's left (+x). Negative rotation.x swings forward. */
  function person(g, x, z, k = 1, seated = false) {
    const p = grp(g, x, 0, z); p.scale.setScalar(k);
    const shirt = M["shirt" + (seed % SHIRTS.length)], hair = M["hair" + ((seed >> 3) % HAIR.length)];
    const hip = seated ? 0.58 : 0.88;
    if (seated) {
      [-1, 1].forEach(s => {
        add(p, box(0.14, 0.13, 0.46), M.trouser, s * 0.1, 0.57, 0.2);
        add(p, cyl(0.06, 0.05, 0.52, 6), M.trouser, s * 0.1, 0.29, 0.42);
        add(p, box(0.1, 0.06, 0.24), M.shoe, s * 0.1, 0.03, 0.47);
      });
    } else {
      [-1, 1].forEach(s => {
        add(p, cyl(0.078, 0.06, 0.86, 6), M.trouser, s * 0.1, 0.45, 0);
        add(p, box(0.1, 0.06, 0.25), M.shoe, s * 0.1, 0.03, 0.05);
      });
    }
    const body = grp(p, 0, hip, 0);
    add(body, cyl(0.2, 0.155, 0.56, 8), shirt, 0, 0.3, 0);
    add(body, cyl(0.05, 0.055, 0.1, 6), M.cream, 0, 0.62, 0);
    const head = grp(body, 0, 0.66, 0);
    add(head, sph(0.125), M.cream, 0, 0.11, 0);
    const h = add(head, sph(0.132), hair, 0, 0.165, -0.04); h.scale.set(1, 0.7, 1);
    const arm = s => {
      const sh = grp(body, s * 0.245, 0.53, 0);
      add(sh, cyl(0.052, 0.045, 0.3, 6), shirt, 0, -0.15, 0);
      const elb = grp(sh, 0, -0.3, 0);
      add(elb, cyl(0.042, 0.036, 0.27, 6), M.cream, 0, -0.135, 0);
      add(elb, sph(0.05), M.cream, 0, -0.29, 0);
      sh.rotation.z = s * 0.1;
      return { sh, elb };
    };
    const R = arm(-1), L = arm(1), ph = (seed % 100) / 100;
    /* everyone breathes and moves with the beat a little */
    anims.push(t => {
      const b = beat(t);
      body.rotation.z = Math.sin((b / 2 + ph) * TAU) * 0.035;
      body.position.y = hip + Math.abs(Math.sin(b * Math.PI)) * 0.012;
      head.rotation.x = 0.1 * Math.pow((Math.sin(b * TAU) + 1) / 2, 2);
      head.rotation.y = Math.sin(t * 0.4 + ph * 6) * 0.22;
    });
    return { root: p, body, head, R, L, ph };
  }
  function tripod(g, x, z, hubY = 0.28, spread = 0.3, m = M.steel) {
    for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3 + 0.5; rod(g, m, [x, hubY, z], [x + Math.cos(a) * spread, 0.01, z + Math.sin(a) * spread], 0.011); }
    add(g, cyl(0.024, 0.024, 0.06, 8), M.dark, x, hubY, z);
  }
  function micHead(g, x, y, z, tilt) {
    const m = grp(g, x, y, z); m.rotation.x = tilt;
    add(m, cyl(0.021, 0.017, 0.14, 8), M.dark, 0, 0, 0);
    add(m, sph(0.033), M.metal, 0, 0.095, 0);
    add(m, cyl(0.026, 0.026, 0.012, 8), M.chrome, 0, 0.066, 0);
    return m;
  }
  function micStand(g, x, z, h = 1.5, boom = true) {
    if (boom) {
      tripod(g, x, z);
      add(g, cyl(0.014, 0.014, 0.75, 6), M.steel, x, 0.62, z);
      add(g, cyl(0.02, 0.02, 0.07, 8), M.dark, x, 1.0, z);
      add(g, cyl(0.01, 0.01, h - 1.0, 6), M.metal, x, 1.0 + (h - 1.0) / 2, z);
      add(g, box(0.05, 0.05, 0.05), M.dark, x, h, z);
      rod(g, M.metal, [x, h - 0.06, z + 0.22], [x, h + 0.12, z - 0.42], 0.009);
      add(g, cyl(0.022, 0.022, 0.1, 8), M.dark, x, h - 0.05, z + 0.2, -1.28, 0, 0);
      micHead(g, x, h + 0.12, z - 0.45, -1.9);
    } else {
      add(g, cyl(0.15, 0.16, 0.03, 16), M.dark, x, 0.015, z);
      add(g, cyl(0.014, 0.014, 0.9, 6), M.steel, x, 0.47, z);
      add(g, cyl(0.02, 0.02, 0.07, 8), M.dark, x, 0.94, z);
      add(g, cyl(0.01, 0.01, h - 0.94, 6), M.metal, x, 0.94 + (h - 0.94) / 2, z);
      micHead(g, x, h + 0.04, z - 0.03, -1.05);
    }
  }
  /* electric guitar / bass, built upright (neck along +y, strings facing +z) */
  let bodyShape = null;
  function guitarModel(parent, bass) {
    if (!bodyShape) {
      bodyShape = new THREE.Shape();
      const P = [[0, -0.2], [0.12, -0.19], [0.17, -0.09], [0.135, 0.0], [0.15, 0.09], [0.12, 0.19], [0.06, 0.16], [0.035, 0.09],
        [-0.035, 0.09], [-0.05, 0.19], [-0.115, 0.22], [-0.15, 0.1], [-0.13, 0.0], [-0.17, -0.09], [-0.12, -0.19]].map(p => new THREE.Vector2(p[0], p[1]));
      bodyShape.moveTo(P[0].x, P[0].y); bodyShape.splineThru(P.slice(1).concat([P[0]]));
    }
    const s = grp(parent), L = bass ? 0.74 : 0.56;
    const bg = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.045, bevelEnabled: false, curveSegments: 5 }); bg.translate(0, 0, -0.0225);
    add(s, bg, bass ? M.bassbody : M.sunburst);
    add(s, box(0.11, 0.2, 0.004), M.white, 0.005, -0.03, 0.025);
    add(s, box(0.075, 0.024, 0.014), M.ebony, 0, 0.03, 0.03);
    add(s, box(0.075, 0.024, 0.014), M.ebony, 0, -0.05, 0.03);
    add(s, box(0.085, 0.03, 0.016), M.chrome, 0, -0.12, 0.03);
    add(s, cyl(0.013, 0.013, 0.014, 8), M.chrome, 0.085, -0.13, 0.03, Math.PI / 2, 0, 0);
    add(s, cyl(0.013, 0.013, 0.014, 8), M.chrome, 0.11, -0.085, 0.03, Math.PI / 2, 0, 0);
    add(s, box(0.048, L, 0.024), M.maple, 0, 0.09 + L / 2, 0.004);
    add(s, box(0.044, L, 0.006), bass ? M.ebony : M.wood, 0, 0.09 + L / 2, 0.019);
    for (let i = 1; i < 9; i++) add(s, box(0.044, 0.003, 0.002), M.chrome, 0, 0.09 + L * (1 - Math.pow(0.86, i) * 0.98), 0.0225).castShadow = false;
    add(s, box(bass ? 0.026 : 0.034, L + 0.21, 0.0015), M.chrome, 0, -0.12 + (L + 0.21) / 2, 0.0245).castShadow = false;
    const hy = 0.09 + L;
    add(s, box(0.07, 0.15, 0.018), M.maple, 0.008, hy + 0.07, -0.002, 0, 0, -0.08);
    for (let i = 0; i < (bass ? 4 : 6); i++) add(s, cyl(0.008, 0.008, 0.02, 6), M.chrome, -0.035, hy + 0.02 + i * (bass ? 0.034 : 0.022), 0, 0, 0, Math.PI / 2).castShadow = false;
    return s;
  }
  function guitarist(g, W, D, bass) {
    const k = clamp(Math.min(W, D) / 0.72, 0.5, 1.25), pr = person(g, 0, 0, k);
    const gt = guitarModel(pr.body, bass); gt.position.set(-0.07, 0.2, 0.2); gt.rotation.set(0.12, 0, -1.02);
    /* strap */
    rod(pr.body, M.ebony, [-0.2, 0.12, 0.17], [0.16, 0.58, 0.02], 0.014).castShadow = false;
    pr.L.sh.rotation.set(-0.55, 0, 0.5); pr.L.elb.rotation.set(-1.35, 0, -0.2);
    pr.R.sh.rotation.set(-0.3, 0, -0.25); pr.R.elb.rotation.set(-1.3, 0, 0.5);
    const rate = bass ? 2 : 4;
    anims.push(t => {
      const b = beat(t);
      pr.R.elb.rotation.x = -1.3 + Math.sin(b * rate * Math.PI + pr.ph) * (bass ? 0.07 : 0.13);
      pr.L.elb.rotation.z = -0.2 + Math.sin(b * Math.PI * 0.5 + pr.ph * 4) * 0.08;
      gt.rotation.z = -1.02 + Math.sin((b / 2 + pr.ph) * TAU) * 0.03;
    });
  }
  function drumShell(g, r, h, m, x, y, z, rx = 0) {
    const d = grp(g, x, y, z); d.rotation.x = rx;
    add(d, cyl(r, r, h, 16), m);
    add(d, cyl(r * 0.965, r * 0.965, h + 0.012, 16), M.white);
    add(d, cyl(r * 1.035, r * 1.035, 0.022, 16), M.chrome, 0, h / 2 - 0.004, 0);
    add(d, cyl(r * 1.035, r * 1.035, 0.022, 16), M.chrome, 0, -h / 2 + 0.004, 0);
    return d;
  }
  function cymbal(g, r, x, y, z, rx, rz) {
    const c = grp(g, x, y, z); c.rotation.set(rx, 0, rz);
    add(c, cyl(0.02, r, 0.03, 16), M.brass);
    add(c, cyl(0.012, 0.03, 0.02, 8), M.brass, 0, 0.022, 0);
    return c;
  }
  const BUILD = {
    drums(g, W, D) {
      const kx = W / 2, kz = D / 1.5, k = clamp(Math.min(kx, kz), 0.45, 1.3);
      const s = grp(g); s.scale.setScalar(k);
      const P = (x, z) => [(x * kx) / k, (z * kz) / k];
      let [x, z] = P(0, 0.22);
      drumShell(s, 0.29, 0.42, M.clay, x, 0.3, z, Math.PI / 2);                   /* kick */
      add(s, cyl(0.1, 0.1, 0.004, 14), M.dark, x, 0.3, z + 0.218, Math.PI / 2, 0, 0);
      rod(s, M.chrome, [x - 0.22, 0.3, z + 0.12], [x - 0.36, 0.0, z + 0.26], 0.009);
      rod(s, M.chrome, [x + 0.22, 0.3, z + 0.12], [x + 0.36, 0.0, z + 0.26], 0.009);
      add(s, box(0.09, 0.02, 0.26), M.chrome, x, 0.02, z - 0.33, 0.25, 0, 0);     /* kick pedal */
      rod(s, M.chrome, [x, 0.02, z - 0.22], [x, 0.3, z - 0.22], 0.008);
      drumShell(s, 0.14, 0.19, M.clay, x - 0.17, 0.76, z - 0.02, 0.38);           /* rack toms */
      drumShell(s, 0.155, 0.21, M.clay, x + 0.18, 0.76, z - 0.02, 0.38);
      rod(s, M.chrome, [x - 0.1, 0.56, z], [x - 0.15, 0.68, z - 0.02], 0.01);
      rod(s, M.chrome, [x + 0.1, 0.56, z], [x + 0.15, 0.68, z - 0.02], 0.01);
      [x, z] = P(-0.42, -0.12);                                                    /* snare */
      drumShell(s, 0.18, 0.14, M.chrome, x, 0.64, z, 0.08);
      tripod(s, x, z, 0.3, 0.22, M.chrome); add(s, cyl(0.012, 0.012, 0.3, 6), M.chrome, x, 0.43, z);
      [x, z] = P(0.48, -0.16);                                                     /* floor tom */
      drumShell(s, 0.21, 0.38, M.clay, x, 0.46, z);
      for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; rod(s, M.chrome, [x + Math.cos(a) * 0.22, 0.5, z + Math.sin(a) * 0.22], [x + Math.cos(a) * 0.26, 0, z + Math.sin(a) * 0.26], 0.008); }
      [x, z] = P(-0.74, 0.02);                                                     /* hi-hat */
      tripod(s, x, z, 0.3, 0.24, M.chrome); add(s, cyl(0.011, 0.011, 0.72, 6), M.chrome, x, 0.62, z);
      cymbal(s, 0.17, x, 0.86, z, Math.PI, 0);
      const hat = cymbal(s, 0.17, x, 0.9, z, 0, 0);
      [x, z] = P(-0.52, 0.36);                                                     /* crash */
      tripod(s, x, z, 0.32, 0.27, M.chrome); add(s, cyl(0.011, 0.011, 1.05, 6), M.chrome, x, 0.82, z);
      const crash = cymbal(s, 0.23, x, 1.36, z, 0.18, 0.1);
      [x, z] = P(0.64, 0.3);                                                       /* ride */
      tripod(s, x, z, 0.32, 0.27, M.chrome); add(s, cyl(0.011, 0.011, 0.9, 6), M.chrome, x, 0.74, z);
      const ride = cymbal(s, 0.27, x, 1.2, z, 0.22, -0.12);
      [x, z] = P(0, -0.5);                                                         /* throne + drummer */
      add(s, cyl(0.17, 0.16, 0.08, 12), M.ebony, x, 0.52, z);
      add(s, cyl(0.02, 0.02, 0.26, 6), M.chrome, x, 0.36, z); tripod(s, x, z, 0.24, 0.24, M.chrome);
      const pr = person(s, x, z, 1, true);
      [pr.R, pr.L].forEach(a => { rod(a.elb, M.maple, [0, -0.3, -0.04], [0, -0.3, 0.36], 0.008).castShadow = false; });
      pr.R.sh.rotation.set(-0.75, 0, -0.25); pr.L.sh.rotation.set(-0.75, 0, 0.3);
      anims.push(t => {
        const b = beat(t), hit = o => Math.pow(Math.max(0, Math.sin((b * 2 + o) * Math.PI)), 6);
        const hr = hit(0), hl = hit(1);
        pr.R.elb.rotation.x = -1.45 + hr * 0.5; pr.L.elb.rotation.x = -1.45 + hl * 0.5;
        hat.position.y = 0.9 - hr * 0.012;
        crash.rotation.x = 0.18 + Math.sin(t * 7.3) * 0.03; ride.rotation.z = -0.12 + Math.sin(t * 6.1 + 1) * 0.025 + hl * 0.02;
      });
    },
    keys(g, W, D) {
      const k = clamp(Math.min(W / 1.4, D / 0.8), 0.5, 1.25), kw = clamp(W * 0.86, 0.5, 2.2), z = D * 0.16;
      const kb = grp(g, 0, 0.9 * k, z); kb.scale.set(1, k, k);
      add(kb, box(kw, 0.08, 0.34), M.dark);
      add(kb, box(kw * 0.95, 0.014, 0.15), M.white, 0, 0.042, 0.08);
      add(kb, box(kw * 0.95, 0.006, 0.13), M.ebony, 0, 0.042, -0.08);
      /* black keys: one instanced mesh, real 2-3 grouping */
      const n = Math.max(14, Math.round((kw * 0.95) / 0.0235)), kwid = (kw * 0.95) / n, idx = [];
      for (let i = 0; i < n - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) idx.push(i);
      const im = new THREE.InstancedMesh(box(kwid * 0.58, 0.014, 0.09), M.ebony, idx.length), mx = new THREE.Matrix4();
      idx.forEach((i, j) => { mx.makeTranslation(-kw * 0.475 + (i + 1) * kwid, 0.056, 0.05); im.setMatrixAt(j, mx); });
      kb.add(im);
      for (let i = 0; i < 6; i++) add(kb, cyl(0.012, 0.012, 0.016, 8), M.chrome, -kw * 0.36 + i * 0.05, 0.05, -0.1).castShadow = false;
      add(kb, box(0.12, 0.004, 0.05), M.screen, kw * 0.12, 0.043, -0.1).castShadow = false;
      add(kb, box(0.012, 0.004, 0.012), M.ledred, kw * 0.4, 0.043, -0.1).castShadow = false;
      /* X-stand */
      const top = 0.86 * k, hw = clamp(kw * 0.3, 0.2, 0.5);
      [-0.12, 0.12].forEach(o => { rod(g, M.steel, [-hw, 0.02, z + o], [hw, top, z + o], 0.014); rod(g, M.steel, [hw, 0.02, z + o], [-hw, top, z + o], 0.014); });
      [-hw, hw].forEach(x => { rod(g, M.steel, [x, 0.02, z - 0.17], [x, 0.02, z + 0.17], 0.016); rod(g, M.steel, [x, top, z - 0.15], [x, top, z + 0.15], 0.014); });
      const pr = person(g, 0, z - 0.45 * k, k);
      pr.body.rotation.x = 0.08;
      pr.R.sh.rotation.set(-0.7, 0, -0.12); pr.L.sh.rotation.set(-0.7, 0, 0.12);
      anims.push(t => {
        const b = beat(t);
        pr.R.elb.rotation.x = -0.95 + Math.pow(Math.max(0, Math.sin(b * TAU + pr.ph)), 3) * 0.14;
        pr.L.elb.rotation.x = -0.95 + Math.pow(Math.max(0, Math.sin(b * TAU + Math.PI + pr.ph)), 3) * 0.14;
        pr.R.sh.rotation.z = -0.12 + Math.sin(b * 0.5 + pr.ph * 5) * 0.12; pr.L.sh.rotation.z = 0.12 + Math.sin(b * 0.37 + 2) * 0.12;
      });
    },
    guitar(g, W, D) { guitarist(g, W, D, false); },
    bass(g, W, D) { guitarist(g, W, D, true); },
    vocal(g, W, D) {
      const k = clamp(Math.min(W, D) / 0.72, 0.5, 1.25);
      const pr = person(g, 0, -D * 0.12, k);
      const s = grp(g); s.scale.setScalar(k); micStand(s, 0, (-D * 0.12) / k + 0.34, 1.47, false);
      pr.R.sh.rotation.set(-1.0, 0, 0.25); pr.R.elb.rotation.set(-1.25, 0, 0);
      anims.push(t => {
        const b = beat(t);
        pr.L.sh.rotation.x = Math.sin(b * Math.PI + pr.ph) * 0.14; pr.L.elb.rotation.x = -0.25 + Math.sin(b * Math.PI + 1) * 0.1;
        pr.body.rotation.x = Math.sin((b / 4 + pr.ph) * TAU) * 0.03;
      });
    },
    perc(g, W, D) {
      const k = clamp(Math.min(W, D) / 0.75, 0.5, 1.25), zc = D * 0.16;
      const s = grp(g, 0, 0, zc); s.scale.setScalar(k);
      [[-0.19, 0.16, 0.11, M.clay], [0.2, 0.18, 0.12, M.wood]].forEach(c => {
        add(s, cyl(c[1], c[2], 0.72, 12), c[3], c[0], 0.56, 0);
        add(s, cyl(c[1] * 0.97, c[1] * 0.97, 0.014, 12), M.white, c[0], 0.925, 0);
        add(s, cyl(c[1] * 1.05, c[1] * 1.05, 0.02, 12), M.chrome, c[0], 0.9, 0);
        for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; rod(s, M.chrome, [c[0] + Math.cos(a) * c[2], 0.24, Math.sin(a) * c[2]], [c[0] + Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], 0.008); }
      });
      const pr = person(g, 0, zc - 0.42 * k, k);
      pr.R.sh.rotation.set(-0.6, 0, -0.15); pr.L.sh.rotation.set(-0.6, 0, 0.15);
      anims.push(t => {
        const b = beat(t), hit = o => Math.pow(Math.max(0, Math.sin((b * 2 + o) * Math.PI + pr.ph)), 4);
        pr.R.elb.rotation.x = -1.3 + hit(0) * 0.4; pr.L.elb.rotation.x = -1.3 + hit(1) * 0.4;
      });
    },
    riser(g, W, D, it) {
      const h = riserHeight(it);
      if (h <= 0.22) { add(g, box(W, h - 0.03, D), M.ebony, 0, (h - 0.03) / 2, 0); }
      else {
        const nx = Math.max(2, Math.round(W / 1.1) + 1), nz = Math.max(2, Math.round(D / 1.1) + 1);
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
          add(g, box(0.05, h - 0.1, 0.05), M.steel, -W / 2 + 0.05 + ((W - 0.1) * i) / (nx - 1), (h - 0.1) / 2, -D / 2 + 0.05 + ((D - 0.1) * j) / (nz - 1));
        if (h > 0.5) [-1, 1].forEach(s => rod(g, M.steel, [-W / 2 + 0.05, 0.06, s * (D / 2 - 0.05)], [W / 2 - 0.05, h - 0.14, s * (D / 2 - 0.05)], 0.012));
      }
      add(g, box(W, 0.07, D), M.steel, 0, h - 0.065, 0);
      add(g, box(W - 0.03, 0.03, D - 0.03), M.deck, 0, h - 0.014, 0);
    },
    monitor(g, W, D) {
      const H = clamp(Math.min(W, D) * 0.62, 0.22, 0.5);
      add(g, prism([[D / 2, 0], [-D / 2, 0], [-D / 2, H * 0.3], [D * 0.14, H], [D / 2, H]], W), M.dark);
      const len = Math.hypot(D * 0.64, H * 0.7), a = Math.atan2(H * 0.7, D * 0.64);
      const f = grp(g, 0, H * 0.65 + 0.006, -D * 0.18); f.rotation.x = -a;
      add(f, box(W * 0.88, 0.012, len * 0.86), M.cloth);
      add(f, cyl(Math.min(W, len) * 0.26, Math.min(W, len) * 0.26, 0.016, 16), M.mid, -W * 0.14, 0.004, 0).castShadow = false;
      add(f, box(W * 0.2, 0.016, len * 0.3), M.mid, W * 0.27, 0.004, 0).castShadow = false;
      add(f, box(0.012, 0.016, 0.012), M.led, W * 0.4, 0.004, len * 0.38).castShadow = false;
      [-1, 1].forEach(s => add(g, box(0.01, H * 0.2, D * 0.3), M.mid, s * (W / 2 + 0.004), H * 0.45, D * 0.2).castShadow = false);
    },
    sidefill(g, W, D) {
      const w = clamp(W * 0.8, 0.3, 0.9), d = clamp(D * 0.75, 0.25, 0.7);
      tripod(g, 0, 0, 0.5, 0.45); add(g, cyl(0.02, 0.02, 0.95, 6), M.steel, 0, 0.72, 0);
      const sp = grp(g, 0, 1.55, 0); sp.rotation.x = 0.12;
      add(sp, box(w, 0.72, d), M.dark);
      add(sp, box(w * 0.88, 0.62, 0.012), M.cloth, 0, 0, d / 2 + 0.006);
      add(sp, cyl(w * 0.3, w * 0.3, 0.014, 16), M.mid, 0, -0.12, d / 2 + 0.014, Math.PI / 2, 0, 0).castShadow = false;
      add(sp, box(w * 0.5, 0.12, 0.014), M.mid, 0, 0.22, d / 2 + 0.014).castShadow = false;
    },
    amp(g, W, D) {
      const H = clamp(Math.min(W, D) * 1.1, 0.4, 0.85), z = D / 2;
      add(g, box(W, H, D), M.ebony, 0, H / 2 + 0.03, 0);
      add(g, box(W * 0.9, H * 0.66, 0.014), M.cloth, 0, H * 0.4 + 0.03, z + 0.007);
      add(g, cyl(Math.min(W, H) * 0.26, Math.min(W, H) * 0.26, 0.008, 16), M.mid, 0, H * 0.4 + 0.03, z + 0.016, Math.PI / 2, 0, 0).castShadow = false;
      add(g, box(W * 0.9, H * 0.13, 0.016), M.brass, 0, H * 0.87 + 0.03, z + 0.008);
      const nk = clamp(Math.round(W / 0.14), 3, 7);
      for (let i = 0; i < nk; i++) add(g, cyl(0.016, 0.019, 0.022, 8), M.ebony, -W * 0.36 + (W * 0.6 * i) / (nk - 1), H * 0.87 + 0.03, z + 0.026, Math.PI / 2, 0, 0).castShadow = false;
      add(g, box(0.012, 0.012, 0.01), M.ledred, W * 0.38, H * 0.87 + 0.03, z + 0.02).castShadow = false;
      rod(g, M.ebony, [-W * 0.16, H + 0.03, 0], [-W * 0.16, H + 0.07, 0], 0.01); rod(g, M.ebony, [W * 0.16, H + 0.03, 0], [W * 0.16, H + 0.07, 0], 0.01);
      rod(g, M.ebony, [-W * 0.16, H + 0.07, 0], [W * 0.16, H + 0.07, 0], 0.012);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(p => add(g, cyl(0.025, 0.025, 0.03, 8), M.dark, p[0] * (W / 2 - 0.05), 0.015, p[1] * (D / 2 - 0.05)));
    },
    di(g, W, D) {
      const w = W * 0.8, d = D * 0.8;
      add(g, box(w, 0.09, d), M.clay, 0, 0.045, 0);
      add(g, box(w * 0.7, 0.012, d * 0.3), M.ebony, 0, 0.096, d * 0.15);
      [-1, 1].forEach(s => add(g, cyl(0.014, 0.014, 0.02, 8), M.chrome, s * w * 0.22, 0.05, d / 2 + 0.008, Math.PI / 2, 0, 0).castShadow = false);
      add(g, box(0.012, 0.006, 0.012), M.led, w * 0.3, 0.096, -d * 0.25).castShadow = false;
      rod(g, M.ebony, [w * 0.22, 0.03, d / 2], [w * 0.5, 0.012, d / 2 + 0.25], 0.008).castShadow = false;
    },
    power(g, W, D) {
      const w = W * 0.85, d = D * 0.85;
      add(g, box(w, 0.1, d), M.ebony, 0, 0.05, 0);
      const n = clamp(Math.round(w / 0.16), 2, 5);
      for (let i = 0; i < n; i++) add(g, box(Math.min(0.11, (w / n) * 0.7), 0.02, Math.min(0.11, d * 0.5)), M.yellow, -w / 2 + (w * (i + 0.5)) / n, 0.105, 0).castShadow = false;
      rod(g, M.ebony, [-w / 2, 0.04, 0], [-w / 2 - 0.3, 0.012, -d * 0.4], 0.012).castShadow = false;
    },
    mic(g, W, D) { micStand(g, 0, D * 0.15, 1.35, true); },
    sub(g, W, D) {
      const H = clamp(Math.min(W, D) * 0.95, 0.4, 0.8), r = Math.min(W, H) * 0.36;
      add(g, box(W, H, D), M.ebony, 0, H / 2 + 0.04, 0);
      add(g, box(W * 0.92, H * 0.9, 0.012), M.cloth, 0, H / 2 + 0.04, D / 2 + 0.006);
      add(g, cyl(r, r, 0.012, 20), M.mid, 0, H / 2 + 0.04, D / 2 + 0.014, Math.PI / 2, 0, 0).castShadow = false;
      add(g, cyl(r * 0.35, r * 0.35, 0.016, 12), M.dark, 0, H / 2 + 0.04, D / 2 + 0.018, Math.PI / 2, 0, 0).castShadow = false;
      [-1, 1].forEach(s => add(g, box(0.012, H * 0.16, D * 0.3), M.steel, s * (W / 2 + 0.005), H * 0.62, 0).castShadow = false);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(p => add(g, cyl(0.04, 0.04, 0.03, 8), M.dark, p[0] * (W / 2 - 0.07), 0.04, p[1] * (D / 2 - 0.07), 0, 0, Math.PI / 2));
    },
    stool(g, W, D) {
      const r = clamp(Math.min(W, D) * 0.42, 0.14, 0.24);
      add(g, cyl(r, r * 0.95, 0.07, 14), M.ebony, 0, 0.62, 0);
      for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4 + 0.78; rod(g, M.chrome, [Math.cos(a) * r * 0.6, 0.6, Math.sin(a) * r * 0.6], [Math.cos(a) * r * 0.95, 0, Math.sin(a) * r * 0.95], 0.012); }
      const ring = add(g, new THREE.TorusGeometry(r * 0.82, 0.009, 6, 16), M.chrome, 0, 0.24, 0, Math.PI / 2, 0, 0); ring.castShadow = false;
    },
    mstand(g, W, D) {
      tripod(g, 0, 0, 0.3, 0.26); add(g, cyl(0.012, 0.012, 0.85, 6), M.steel, 0, 0.7, 0);
      const d = grp(g, 0, 1.22, -0.03); d.rotation.x = 0.42;
      add(d, box(0.5, 0.34, 0.012), M.ebony);
      add(d, box(0.5, 0.02, 0.05), M.ebony, 0, -0.165, 0.025);
      add(d, box(0.42, 0.29, 0.003), M.sheet, 0, 0.005, 0.009).castShadow = false;
    },
    laptop(g, W, D) {
      const w = clamp(W * 0.9, 0.5, 1.4), d = clamp(D * 0.9, 0.35, 0.8), hw = w / 2 - 0.05;
      add(g, box(w, 0.03, d), M.ebony, 0, 0.83, 0);
      [-1, 1].forEach(s => {                                      /* folding X-frame table */
        rod(g, M.steel, [s * hw, 0.02, -d / 2 + 0.04], [s * hw, 0.81, d / 2 - 0.04], 0.012);
        rod(g, M.steel, [s * hw, 0.02, d / 2 - 0.04], [s * hw, 0.81, -d / 2 + 0.04], 0.012);
      });
      rod(g, M.steel, [-hw, 0.02, -d / 2 + 0.04], [hw, 0.02, -d / 2 + 0.04], 0.012); rod(g, M.steel, [-hw, 0.02, d / 2 - 0.04], [hw, 0.02, d / 2 - 0.04], 0.012);
      const lx = w > 0.85 ? -w * 0.18 : 0;
      add(g, box(0.34, 0.014, 0.23), M.metal, lx, 0.852, 0.03);
      add(g, box(0.3, 0.003, 0.11), M.ebony, lx, 0.86, 0.0).castShadow = false;       /* keyboard */
      add(g, box(0.1, 0.003, 0.06), M.steel, lx, 0.86, 0.1).castShadow = false;       /* trackpad */
      const lid = grp(g, lx, 0.859, -0.085); lid.rotation.x = -0.32;
      add(lid, box(0.34, 0.225, 0.008), M.metal, 0, 0.1125, 0);
      add(lid, box(0.315, 0.195, 0.002), M.screen, 0, 0.115, 0.0055).castShadow = false;
      if (w > 0.85) {                                             /* audio interface next to it */
        add(g, box(0.26, 0.05, 0.17), M.clay, w * 0.24, 0.87, 0.02);
        for (let i = 0; i < 4; i++) add(g, cyl(0.012, 0.012, 0.012, 8), M.chrome, w * 0.24 - 0.09 + i * 0.06, 0.9, 0.05).castShadow = false;
        add(g, box(0.01, 0.004, 0.01), M.led, w * 0.24 + 0.1, 0.897, -0.04).castShadow = false;
      }
    },
    text(g, W, D, it) {
      const lbl = String(it.label || "").trim(); if (!lbl) return;
      const t = textTexture(lbl, { size: 56, color: "#f4f1e9", spacing: 3 });
      let h = D * 0.8, w = h * t.userData.aspect;
      if (w > W * 1.6) { w = W * 1.6; h = w / t.userData.aspect; }
      const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      me.rotation.x = -Math.PI / 2; me.position.y = 0.012; me.userData.ownMat = true; g.add(me);
    },
    fallback(g, W, D) { add(g, box(W, 0.4, D), M.mid, 0, 0.2, 0); }
  };
  function riserHeight(it) {
    let h = +it.hgt;
    if (!(h > 0)) {
      const n = String(it.label || "").replace(/,/g, ".").match(/\d+(?:\.\d+)?/g);
      h = n && n.length >= 3 ? parseFloat(n[2]) : 0.4;
    }
    return clamp(isFinite(h) && h > 0 ? h : 0.4, 0.1, 1.5);
  }

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
