/* RoboRider — 3D stage view for the stage plot editor.
   Loaded on demand by rider-builder.html (dynamic import) the first time someone opens the 3D view.
   It renders the SAME data as the 2D plot (S.plot.items: x/y/w/h in % of a 16:10 stage, rot in degrees),
   so the 2D plot, the rider preview and the PDF always match what is built here. */
import * as THREE from "./vendor/three.module.min.js";

const SW = 10, SD = 6.25;            /* stage width / depth in metres (16:10, like the 2D canvas) */
const FOV = 32;
const COL = {
  stage: 0x3b332d, lip: 0x9a7257, floor: 0x0f0e0c, dark: 0x25221f, mid: 0x3f3934, cloth: 0x5c544b,
  metal: 0x9a968f, clay: 0x9a7257, cream: 0xe9e2d3, brass: 0xc9a45c, white: 0xf4f1e9, yellow: 0xe3b53c,
  wood: 0x7a5a44, sel: 0xf0b48c
};

export function create(api) {
  const host = api.host;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const el = renderer.domElement;
  el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none";
  el.setAttribute("role", "img");
  host.appendChild(el);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14120f);
  scene.fog = new THREE.Fog(0x14120f, 34, 90);
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 10, 0.1, 100);

  /* ---------- materials (shared, never disposed per rebuild) ---------- */
  const M = {};
  const mat = (name, color, rough = 0.85, metal = 0) =>
    (M[name] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true }));
  mat("dark", COL.dark); mat("mid", COL.mid); mat("cloth", COL.cloth, 1); mat("metal", COL.metal, 0.45, 0.6);
  mat("clay", COL.clay, 0.7); mat("cream", COL.cream, 0.9); mat("brass", COL.brass, 0.35, 0.75);
  mat("white", COL.white, 0.6); mat("wood", COL.wood, 0.75); mat("stage", COL.stage, 0.92);
  M.yellow = new THREE.MeshStandardMaterial({ color: COL.yellow, roughness: 0.6, emissive: COL.yellow, emissiveIntensity: 0.35, flatShading: true });
  M.screen = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.4, emissive: 0x6f8aa0, emissiveIntensity: 0.6 });
  M.hit = new THREE.MeshBasicMaterial({ visible: false });
  M.sel = new THREE.LineBasicMaterial({ color: COL.sel, depthTest: false, transparent: true });

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xfff1dd, 0x3a322c, 1.35));
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

  /* ---------- static set: floor, stage, grid, backdrop, audience caption ---------- */
  const setGroup = new THREE.Group(); scene.add(setGroup);
  let audienceMesh = null;
  (function buildSet() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: COL.floor, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5; floor.receiveShadow = true; setGroup.add(floor);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.5, 0.5, SD + 0.5), M.stage);
    slab.position.y = -0.25; slab.receiveShadow = true; slab.castShadow = true; setGroup.add(slab);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.52, 0.06, 0.05), M.clay);
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
    const back = new THREE.Mesh(new THREE.PlaneGeometry(SW + 6, 5), new THREE.MeshStandardMaterial({ color: 0x1c1916, roughness: 1 }));
    back.position.set(0, 2, -SD / 2 - 0.8); back.receiveShadow = true; setGroup.add(back);
  })();

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

  /* ---------- low-poly gear library ---------- */
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = r => new THREE.IcosahedronGeometry(r, 1);
  function add(g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
    me.castShadow = true; me.receiveShadow = true;
    g.add(me); return me;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* a prism from a side profile [[z,y],…], extruded across the width (x) */
  function prism(profile, W) {
    const s = new THREE.Shape();
    profile.forEach((p, i) => (i ? s.lineTo(-p[0], p[1]) : s.moveTo(-p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-W / 2, 0, 0);
    return geo;
  }
  function person(g, x, z, k = 1, seated = false) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(k); g.add(p);
    if (seated) {
      add(p, box(0.13, 0.12, 0.42), M.cream, -0.1, 0.56, 0.2);
      add(p, box(0.13, 0.12, 0.42), M.cream, 0.1, 0.56, 0.2);
      add(p, cyl(0.055, 0.05, 0.5, 6), M.cream, -0.1, 0.25, 0.4);
      add(p, cyl(0.055, 0.05, 0.5, 6), M.cream, 0.1, 0.25, 0.4);
      add(p, cyl(0.19, 0.15, 0.56, 8), M.cream, 0, 0.88, 0);
      add(p, sph(0.125), M.cream, 0, 1.33, 0);
    } else {
      add(p, cyl(0.07, 0.055, 0.82, 6), M.cream, -0.095, 0.41, 0);
      add(p, cyl(0.07, 0.055, 0.82, 6), M.cream, 0.095, 0.41, 0);
      add(p, cyl(0.2, 0.15, 0.6, 8), M.cream, 0, 1.11, 0);
      add(p, cyl(0.045, 0.04, 0.56, 6), M.cream, -0.25, 1.08, 0.02, 0, 0, -0.1);
      add(p, cyl(0.045, 0.04, 0.56, 6), M.cream, 0.25, 1.08, 0.02, 0, 0, 0.1);
      add(p, sph(0.125), M.cream, 0, 1.58, 0);
    }
    return p;
  }
  function micStand(g, x, z, h = 1.5, boom = true) {
    add(g, cyl(0.14, 0.15, 0.025, 12), M.dark, x, 0.012, z);
    add(g, cyl(0.012, 0.012, h, 6), M.metal, x, h / 2, z);
    if (boom) {
      add(g, cyl(0.01, 0.01, 0.55, 6), M.metal, x, h + 0.05, z - 0.12, 1.15, 0, 0);
      add(g, cyl(0.028, 0.022, 0.14, 8), M.dark, x, h + 0.16, z - 0.37, 1.15, 0, 0);
      add(g, sph(0.035), M.metal, x, h + 0.19, z - 0.44);
    } else {
      add(g, cyl(0.028, 0.022, 0.14, 8), M.dark, x, h + 0.05, z, 0.5, 0, 0);
      add(g, sph(0.035), M.metal, x, h + 0.12, z - 0.035);
    }
  }
  function stringed(g, k, neckLen, body) {
    const s = new THREE.Group(); s.scale.setScalar(k); s.position.set(0.04 * k, 1.0 * k, 0.2 * k); s.rotation.z = 0.5; g.add(s);
    add(s, cyl(0.17, 0.17, 0.06, 10), body, 0, 0, 0, Math.PI / 2, 0, 0);
    add(s, cyl(0.12, 0.12, 0.062, 10), body, 0, 0.16, 0, Math.PI / 2, 0, 0);
    add(s, box(0.045, neckLen, 0.03), M.dark, 0, 0.2 + neckLen / 2, 0);
    add(s, box(0.07, 0.12, 0.03), M.dark, 0, 0.26 + neckLen, 0);
  }
  const BUILD = {
    drums(g, W, D) {
      const kx = W / 2, kz = D / 1.5, k = clamp(Math.min(kx, kz), 0.45, 1.3);
      const s = new THREE.Group(); s.scale.setScalar(k); g.add(s);
      const P = (x, z) => [x * kx / k, z * kz / k];
      let [x, z] = P(0, 0.2);
      add(s, cyl(0.29, 0.29, 0.42, 14), M.clay, x, 0.29, z, Math.PI / 2, 0, 0);
      add(s, cyl(0.27, 0.27, 0.43, 14), M.white, x, 0.29, z, Math.PI / 2, 0, 0);
      add(s, cyl(0.14, 0.14, 0.2, 10), M.clay, x - 0.17, 0.75, z - 0.02, 0.35, 0, 0);
      add(s, cyl(0.15, 0.15, 0.22, 10), M.clay, x + 0.17, 0.75, z - 0.02, 0.35, 0, 0);
      [x, z] = P(-0.42, -0.12);
      add(s, cyl(0.18, 0.18, 0.15, 12), M.metal, x, 0.62, z);
      add(s, cyl(0.012, 0.012, 0.56, 6), M.metal, x, 0.28, z);
      [x, z] = P(0.46, -0.16);
      add(s, cyl(0.21, 0.21, 0.4, 12), M.clay, x, 0.42, z);
      [x, z] = P(-0.72, 0.02);                                   /* hi-hat */
      add(s, cyl(0.012, 0.012, 0.9, 6), M.metal, x, 0.45, z);
      add(s, cyl(0.17, 0.17, 0.012, 12), M.brass, x, 0.88, z);
      add(s, cyl(0.17, 0.17, 0.012, 12), M.brass, x, 0.92, z);
      [x, z] = P(-0.52, 0.34);                                   /* crash */
      add(s, cyl(0.012, 0.012, 1.3, 6), M.metal, x, 0.65, z);
      add(s, cyl(0.23, 0.23, 0.012, 12), M.brass, x, 1.31, z, 0.18, 0, 0.1);
      [x, z] = P(0.62, 0.28);                                    /* ride */
      add(s, cyl(0.012, 0.012, 1.15, 6), M.metal, x, 0.575, z);
      add(s, cyl(0.27, 0.27, 0.012, 12), M.brass, x, 1.16, z, 0.22, 0, -0.12);
      [x, z] = P(0, -0.48);                                      /* throne + drummer */
      add(s, cyl(0.17, 0.17, 0.07, 10), M.dark, x, 0.5, z);
      add(s, cyl(0.02, 0.09, 0.47, 6), M.metal, x, 0.235, z);
      person(s, x, z, 1, true);
    },
    keys(g, W, D) {
      const k = clamp(Math.min(W / 1.4, D / 0.8), 0.5, 1.25), kw = clamp(W * 0.86, 0.5, 2.2);
      const z = D * 0.16;
      add(g, box(kw, 0.09 * k, 0.34 * k), M.dark, 0, 0.92 * k, z);
      add(g, box(kw * 0.94, 0.012, 0.16 * k), M.white, 0, 0.972 * k, z + 0.07 * k);
      add(g, box(0.03, 1.25 * k, 0.03), M.metal, 0, 0.45 * k, z, 0, 0, 0.78);
      add(g, box(0.03, 1.25 * k, 0.03), M.metal, 0, 0.45 * k, z, 0, 0, -0.78);
      person(g, 0, z - 0.42 * k, k);
    },
    guitar(g, W, D) { const k = clamp(Math.min(W, D) / 0.72, 0.5, 1.25); person(g, 0, 0, k); stringed(g, k, 0.5, M.clay); },
    bass(g, W, D) { const k = clamp(Math.min(W, D) / 0.72, 0.5, 1.25); person(g, 0, 0, k); stringed(g, k, 0.66, M.wood); },
    vocal(g, W, D) {
      const k = clamp(Math.min(W, D) / 0.72, 0.5, 1.25);
      person(g, 0, -D * 0.12, k);
      const s = new THREE.Group(); s.scale.setScalar(k); g.add(s); micStand(s, 0, (D * 0.2) / k, 1.45, false);
    },
    perc(g, W, D) {
      const k = clamp(Math.min(W, D) / 0.75, 0.5, 1.25);
      person(g, 0, -D * 0.22, k);
      add(g, cyl(0.16 * k, 0.11 * k, 0.75 * k, 10), M.clay, -0.19 * k, 0.5 * k, D * 0.16);
      add(g, cyl(0.18 * k, 0.12 * k, 0.75 * k, 10), M.wood, 0.2 * k, 0.5 * k, D * 0.16);
      add(g, cyl(0.155 * k, 0.155 * k, 0.02, 10), M.white, -0.19 * k, 0.885 * k, D * 0.16);
      add(g, cyl(0.175 * k, 0.175 * k, 0.02, 10), M.white, 0.2 * k, 0.885 * k, D * 0.16);
    },
    riser(g, W, D, it) {
      const h = riserHeight(it);
      add(g, box(W, h, D), M.mid, 0, h / 2, 0);
      add(g, box(W + 0.03, 0.03, D + 0.03), M.cloth, 0, h - 0.005, 0);
    },
    monitor(g, W, D) {
      const H = clamp(Math.min(W, D) * 0.62, 0.22, 0.5);
      add(g, prism([[D / 2, 0], [-D / 2, 0], [-D / 2, H * 0.3], [D * 0.14, H], [D / 2, H]], W), M.dark);
      const len = Math.hypot(D * 0.64, H * 0.7), a = Math.atan2(H * 0.7, D * 0.64);
      add(g, box(W * 0.84, 0.012, len * 0.82), M.cloth, 0, H * 0.65 + 0.008, -D * 0.18, a, 0, 0);
    },
    sidefill(g, W, D) {
      const w = clamp(W * 0.8, 0.3, 0.9), d = clamp(D * 0.75, 0.25, 0.7);
      add(g, cyl(0.2, 0.22, 0.03, 10), M.dark, 0, 0.015, 0);
      add(g, cyl(0.02, 0.02, 1.2, 6), M.metal, 0, 0.6, 0);
      add(g, box(w, 0.72, d), M.dark, 0, 1.55, 0, 0.12, 0, 0);
      add(g, box(w * 0.86, 0.6, 0.012), M.cloth, 0, 1.55, d / 2 + 0.008, 0.12, 0, 0);
    },
    amp(g, W, D) {
      const H = clamp(Math.min(W, D) * 1.1, 0.4, 0.85);
      add(g, box(W, H, D), M.dark, 0, H / 2 + 0.03, 0);
      add(g, box(W * 0.9, H * 0.68, 0.014), M.cloth, 0, H * 0.4 + 0.03, D / 2 + 0.008);
      add(g, box(W * 0.9, H * 0.12, 0.014), M.clay, 0, H * 0.87 + 0.03, D / 2 + 0.008);
      add(g, box(W * 0.4, 0.03, 0.05), M.metal, 0, H + 0.045, 0);
    },
    di(g, W, D) { add(g, box(W * 0.8, 0.09, D * 0.8), M.clay, 0, 0.045, 0); add(g, box(W * 0.5, 0.012, D * 0.2), M.dark, 0, 0.096, D * 0.2); },
    power(g, W, D) { add(g, box(W * 0.85, 0.1, D * 0.85), M.dark, 0, 0.05, 0); add(g, box(W * 0.6, 0.02, D * 0.6), M.yellow, 0, 0.108, 0); },
    mic(g, W, D) { micStand(g, 0, D * 0.15, 1.35, true); },
    sub(g, W, D) {
      const H = clamp(Math.min(W, D) * 0.95, 0.4, 0.8);
      add(g, box(W, H, D), M.dark, 0, H / 2, 0);
      const r = Math.min(W, H) * 0.36;
      add(g, cyl(r, r, 0.015, 16), M.cloth, 0, H / 2, D / 2 + 0.008, Math.PI / 2, 0, 0);
      add(g, cyl(r * 0.35, r * 0.35, 0.02, 12), M.mid, 0, H / 2, D / 2 + 0.012, Math.PI / 2, 0, 0);
    },
    stool(g, W, D) {
      const r = clamp(Math.min(W, D) * 0.42, 0.14, 0.24);
      add(g, cyl(r, r, 0.07, 12), M.dark, 0, 0.6, 0);
      for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; add(g, cyl(0.016, 0.016, 0.6, 5), M.metal, Math.cos(a) * r * 0.7, 0.29, Math.sin(a) * r * 0.7, Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18); }
    },
    mstand(g, W, D) {
      add(g, cyl(0.18, 0.2, 0.02, 3), M.dark, 0, 0.01, 0);
      add(g, cyl(0.012, 0.012, 1.1, 6), M.metal, 0, 0.55, 0);
      add(g, box(0.48, 0.34, 0.015), M.dark, 0, 1.2, -0.03, 0.42, 0, 0);
      add(g, box(0.48, 0.02, 0.05), M.dark, 0, 1.055, 0.055, 0.42, 0, 0);
    },
    laptop(g, W, D) {
      const w = clamp(W * 0.9, 0.5, 1.4), d = clamp(D * 0.9, 0.35, 0.8);
      add(g, box(w, 0.035, d), M.dark, 0, 0.82, 0);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(p => add(g, cyl(0.016, 0.016, 0.8, 5), M.metal, p[0] * (w / 2 - 0.04), 0.4, p[1] * (d / 2 - 0.04)));
      add(g, box(0.34, 0.016, 0.23), M.metal, 0, 0.846, 0);
      add(g, box(0.34, 0.22, 0.012), M.metal, 0, 0.955, -0.135, -0.3, 0, 0);
      add(g, box(0.31, 0.19, 0.004), M.screen, 0, 0.955, -0.127, -0.3, 0, 0);
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
    const n = String(it.label || "").replace(/,/g, ".").match(/\d+(?:\.\d+)?/g);
    const h = n && n.length >= 3 ? parseFloat(n[2]) : 0.4;
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
      if (o.isSprite || o.userData.ownMat) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
  function buildNode(it, selected) {
    const g = new THREE.Group(); g.userData.id = it.id;
    const W = ww(it.w), D = wd(it.h);
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
    const items = api.items() || [], sel = api.getSel();
    nodes.forEach(g => { itemsGroup.remove(g); disposeNode(g); });
    nodes = new Map();
    items.forEach(it => { const g = buildNode(it, it.id === sel); nodes.set(it.id, g); itemsGroup.add(g); });
    items.forEach(it => place(it, items));
    el.setAttribute("aria-label", api.ariaLabel ? api.ariaLabel() : "3D stage");
    invalidate();
  }

  /* ---------- camera ---------- */
  const view = { theta: 0, phi: 0.001, r: 12, target: new THREE.Vector3() };
  let tween = null, raf = 0, dirty = false, active = false;
  function fitRadius() {
    const t = Math.tan((FOV * Math.PI) / 360);
    return Math.max(SD / 2 / t, SW / 2 / (t * camera.aspect)) * 1.05;
  }
  const topView = () => ({ theta: 0, phi: 0.001, r: fitRadius(), tx: 0, ty: 0, tz: 0 });
  const homeView = () => ({ theta: -0.5, phi: 1.02, r: fitRadius() * (camera.aspect > 1 ? 1.3 : 1.1), tx: 0, ty: 0.35, tz: 0.1 });
  function applyView() {
    const s = Math.sin(view.phi);
    camera.position.set(view.target.x + view.r * s * Math.sin(view.theta), view.target.y + view.r * Math.cos(view.phi), view.target.z + view.r * s * Math.cos(view.theta));
    camera.lookAt(view.target);
  }
  function setView(v) { view.theta = v.theta; view.phi = v.phi; view.r = v.r; view.target.set(v.tx, v.ty, v.tz); }
  function currentView() { return { theta: view.theta, phi: view.phi, r: view.r, tx: view.target.x, ty: view.target.y, tz: view.target.z }; }
  const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  function flyTo(to, ms) {
    return new Promise(res => {
      if (tween && tween.done) tween.done();
      if (!ms || reduced()) { setView(to); invalidate(); res(); return; }
      const from = currentView();
      /* take the short way round */
      from.theta = ((from.theta - to.theta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI + to.theta;
      tween = { from, to, t0: performance.now(), ms, done: res };
      invalidate();
    });
  }
  function frame(now) {
    raf = 0;
    if (tween) {
      let p = clamp((now - tween.t0) / tween.ms, 0, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, f = tween.from, t = tween.to, v = {};
      for (const k in t) v[k] = f[k] + (t[k] - f[k]) * e;
      setView(v);
      if (p >= 1) { const d = tween.done; tween = null; d(); } else dirty = true;
    }
    applyView();
    renderer.render(scene, camera);
    if (dirty) { dirty = false; raf = requestAnimationFrame(frame); }
  }
  function invalidate() { if (!active) return; if (!raf) raf = requestAnimationFrame(frame); else dirty = true; }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    invalidate();
  }
  const ro = new ResizeObserver(resize); ro.observe(host);

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
    el.focus({ preventScroll: true });
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      if (mode === "drag") api.commit();
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
    else if (mode === "orbit" && moved < 5 && drag && drag.hitNothing && api.getSel()) api.setSel(null);
    mode = null; drag = null; last = null; el.style.cursor = "";
  }
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", e => { e.preventDefault(); if (!tween) zoomBy(Math.exp(clamp(e.deltaY, -120, 120) * 0.0012)); }, { passive: false });
  el.addEventListener("contextmenu", e => e.preventDefault());
  el.addEventListener("dblclick", e => { if (api.readOnly) return; const id = pick(e); if (id) { const it = api.items().find(x => x.id === id); if (it) api.editLabel(it); } });

  /* ---------- public ---------- */
  return {
    sync,
    /* 2D → 3D: start exactly on the top-down plot, then sweep down into the stage */
    async enter(animate) {
      active = true; resize(); setAudience(); sync();
      if (animate) { setView(topView()); applyView(); renderer.render(scene, camera); await flyTo(homeView(), 1100); }
      else { setView(homeView()); invalidate(); }
    },
    /* 3D → 2D: rise back to the top-down plot; the caller then swaps in the 2D editor */
    async leave(animate) { if (animate) await flyTo(topView(), 800); active = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } tween = null; },
    zoomBy(d) { if (!tween) zoomBy(d > 0 ? 0.8 : 1.25); },
    resetView() { flyTo(homeView(), 600); },
    topDown() { flyTo(topView(), 600); },
    dispose() { ro.disconnect(); nodes.forEach(disposeNode); renderer.dispose(); el.remove(); }
  };
}
