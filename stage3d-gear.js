/* RoboRider — the 3D gear library used by stage3d.js.
   Every builder gets (g, W, D, it): the item's group, its footprint in metres and the plot item itself.
   it.v    = variant of the type (e.g. guitar: electric | single | acoustic)
   it.pose = stand | high (bar stool) | low (chair), for band members
   Models are built at real size and scaled to the footprint, facing the audience (+z). */
export function buildGear(ctx) {
  const { THREE, M, mat, add, grp, rod, box, cyl, sph, clamp, textTexture, anim, seed, beat, riserHeight, SHIRTS, HAIR } = ctx;
  const PI = Math.PI, TAU = PI * 2, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  mat("varnish", 0x8a4b2a, 0.32); mat("spruce", 0xd9a760, 0.42); mat("gloss", 0x121110, 0.12, 0.1);
  mat("walnut", 0x5a3a28, 0.5); mat("vinyl", 0x0c0c0c, 0.28); mat("pad", 0x1c1b1a, 0.95);
  mat("ivory", 0xefe8d8, 0.5); mat("silver", 0xb8b6b0, 0.3, 0.8); mat("cream2", 0xe8dcc0, 0.4);
  mat("red", 0x8c2f2a, 0.35); mat("teal", 0x2f5f66, 0.4);

  /* ---- small helpers ---- */
  /* a rod with a different radius at each end (a → b) */
  function tube(g, m, a, b, ra, rb, seg = 8) {
    const va = V3(...a), vb = V3(...b), d = vb.clone().sub(va);
    const me = add(g, cyl(rb, ra, d.length(), seg), m);
    me.position.copy(va).addScaledVector(d, 0.5);
    me.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    return me;
  }
  /* point an object's +y along dir, with its +z as close to face as possible */
  function aim(o, dir, face) {
    const y = V3(...dir).normalize(), x = y.clone().cross(V3(...face)).normalize(), z = x.clone().cross(y);
    o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return o;
  }
  /* a group scaled so a model built at real size (nw × nd metres) fits the footprint */
  function fit(g, W, D, nw, nd, lo = 0.45, hi = 1.25) { const s = grp(g); s.scale.setScalar(clamp(Math.min(W / nw, D / nd), lo, hi)); return s; }
  const noShadow = m => { m.castShadow = false; return m; };
  const setArm = (a, sx, sz, ex, ez = 0) => { a.sh.rotation.set(sx, 0, sz); a.elb.rotation.set(ex, 0, ez); };
  function splineShape(half) {
    const pts = half.concat(half.slice(1, -1).reverse().map(p => [-p[0], p[1]])).map(p => new THREE.Vector2(p[0], p[1]));
    const s = new THREE.Shape(); s.moveTo(pts[0].x, pts[0].y); s.splineThru(pts.slice(1).concat([pts[0]])); return s;
  }
  function tripod(g, x, z, hubY = 0.28, spread = 0.3, m = M.steel) {
    for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3 + 0.5; rod(g, m, [x, hubY, z], [x + Math.cos(a) * spread, 0.01, z + Math.sin(a) * spread], 0.011); }
    add(g, cyl(0.024, 0.024, 0.06, 8), M.dark, x, hubY, z);
  }

  /* ---- seats ---- */
  function chair(g, x = 0, z = 0) {
    add(g, box(0.42, 0.04, 0.42), M.ebony, x, 0.45, z - 0.04);
    add(g, box(0.42, 0.36, 0.03), M.ebony, x, 0.78, z - 0.24, 0.08, 0, 0);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(p => rod(g, M.steel, [x + p[0] * 0.19, 0, z - 0.04 + p[1] * 0.19], [x + p[0] * 0.19, p[1] < 0 ? 0.62 : 0.44, z - 0.04 + p[1] * 0.19], 0.012));
  }
  function barStool(g, x = 0, z = 0, h = 0.75) {
    add(g, cyl(0.17, 0.16, 0.06, 14), M.ebony, x, h, z - 0.03);
    for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4 + 0.78; rod(g, M.chrome, [x + Math.cos(a) * 0.1, h - 0.03, z - 0.03 + Math.sin(a) * 0.1], [x + Math.cos(a) * 0.22, 0, z - 0.03 + Math.sin(a) * 0.22], 0.012); }
    noShadow(add(g, new THREE.TorusGeometry(0.19, 0.009, 6, 16), M.chrome, x, 0.3, z - 0.03, PI / 2, 0, 0));
  }
  function bench(g, x = 0, z = 0, w = 0.8) {
    add(g, box(w, 0.07, 0.34), M.ebony, x, 0.47, z);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(p => add(g, box(0.04, 0.44, 0.04), M.gloss, x + p[0] * (w / 2 - 0.04), 0.22, z + p[1] * 0.13));
  }

  /* ---- band member ---- */
  /* Faces the audience (+z). Arms: R = the player's right (-x), L = the player's left (+x).
     Negative rotation.x swings an arm forward. pose: stand | high | low | perch (seated, bring your own seat). */
  function person(g, x, z, pose = "stand", seat = true) {
    const p = grp(g, x, 0, z), sd = seed();
    const shirt = M["shirt" + (sd % SHIRTS.length)], hair = M["hair" + ((sd >> 3) % HAIR.length)];
    const hip = pose === "high" ? 0.8 : pose === "low" ? 0.5 : pose === "perch" ? 0.52 : 0.88;
    [-1, 1].forEach(s => {
      if (pose === "stand") {
        add(p, cyl(0.078, 0.06, 0.86, 6), M.trouser, s * 0.1, 0.45, 0);
        add(p, box(0.1, 0.06, 0.25), M.shoe, s * 0.1, 0.03, 0.05);
      } else {
        const knee = pose === "high" ? [s * 0.11, 0.62, 0.36] : [s * 0.11, hip + 0.01, 0.42];
        const foot = pose === "high" ? [s * 0.11, 0.33, 0.24] : [s * 0.11, 0.07, 0.46];
        tube(p, M.trouser, [s * 0.1, hip - 0.02, 0.02], knee, 0.075, 0.062, 6);
        tube(p, M.trouser, knee, foot, 0.06, 0.05, 6);
        add(p, box(0.1, 0.06, 0.24), M.shoe, foot[0], foot[1] - 0.04, foot[2] + 0.06);
      }
    });
    if (seat && pose === "low") chair(p); if (seat && pose === "high") barStool(p);
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
    const R = arm(-1), L = arm(1), ph = (sd % 100) / 100;
    /* everyone breathes and moves with the beat a little */
    anim(t => {
      const b = beat(t);
      body.rotation.z = Math.sin((b / 2 + ph) * TAU) * 0.035;
      body.position.y = hip + Math.abs(Math.sin(b * PI)) * 0.012;
      head.rotation.x = 0.1 * Math.pow((Math.sin(b * TAU) + 1) / 2, 2);
      head.rotation.y = Math.sin(t * 0.4 + ph * 6) * 0.22;
    });
    return { root: p, body, head, R, L, ph, hip };
  }
  const poseOf = (it, allowed, def = "stand") => (allowed.includes(it.pose) ? it.pose : def);

  /* ---- microphones ---- */
  function micHead(g, x, y, z, tilt, style = "dynamic") {
    const m = grp(g, x, y, z); m.rotation.x = tilt;
    if (style === "condenser") {                       /* large diaphragm, side address, in a shock mount */
      add(m, cyl(0.027, 0.027, 0.11, 10), M.silver, 0, 0.02, 0);
      add(m, cyl(0.03, 0.03, 0.07, 10), M.metal, 0, 0.11, 0);
      noShadow(add(m, new THREE.TorusGeometry(0.05, 0.006, 6, 14), M.dark, 0, 0.0, 0, PI / 2, 0, 0));
      noShadow(add(m, new THREE.TorusGeometry(0.05, 0.006, 6, 14), M.dark, 0, 0.05, 0, PI / 2, 0, 0));
    } else if (style === "vintage") {                  /* the classic ribbed chrome one */
      add(m, box(0.062, 0.085, 0.05), M.chrome, 0, 0.07, 0);
      add(m, cyl(0.031, 0.031, 0.05, 10), M.chrome, 0, 0.115, 0, PI / 2, 0, 0);
      for (let i = 0; i < 4; i++) noShadow(add(m, box(0.064, 0.006, 0.052), M.dark, 0, 0.045 + i * 0.018, 0));
      add(m, cyl(0.014, 0.014, 0.05, 6), M.chrome, 0, 0.005, 0);
    } else if (style === "pencil") {                   /* small diaphragm condenser (overheads, strings) */
      add(m, cyl(0.011, 0.011, 0.14, 8), M.silver, 0, 0.03, 0);
    } else {
      add(m, cyl(0.021, 0.017, 0.14, 8), style === "wireless" ? M.steel : M.dark, 0, 0, 0);
      add(m, sph(0.033), M.metal, 0, 0.095, 0);
      add(m, cyl(0.026, 0.026, 0.012, 8), M.chrome, 0, 0.066, 0);
      if (style === "wireless") { add(m, cyl(0.02, 0.02, 0.03, 8), M.clay, 0, -0.085, 0); }
    }
    return m;
  }
  function micStand(g, x, z, h = 1.5, kind = "boom", style = "dynamic") {
    if (kind === "straight") {
      add(g, cyl(0.15, 0.16, 0.03, 16), M.dark, x, 0.015, z);
      add(g, cyl(0.014, 0.014, 0.9, 6), M.steel, x, 0.47, z);
      add(g, cyl(0.02, 0.02, 0.07, 8), M.dark, x, 0.94, z);
      add(g, cyl(0.01, 0.01, h - 0.94, 6), M.metal, x, 0.94 + (h - 0.94) / 2, z);
      micHead(g, x, h + 0.04, z - 0.03, style === "vintage" ? -0.25 : -1.05, style);
    } else if (kind === "short") {                     /* kick drum / guitar cab height */
      tripod(g, x, z, 0.16, 0.22);
      add(g, cyl(0.013, 0.013, 0.2, 6), M.steel, x, 0.24, z);
      rod(g, M.metal, [x, 0.33, z + 0.12], [x, 0.4, z - 0.3], 0.009);
      micHead(g, x, 0.4, z - 0.33, -1.75, style);
    } else {
      tripod(g, x, z);
      add(g, cyl(0.014, 0.014, 0.75, 6), M.steel, x, 0.62, z);
      add(g, cyl(0.02, 0.02, 0.07, 8), M.dark, x, 1.0, z);
      add(g, cyl(0.01, 0.01, h - 1.0, 6), M.metal, x, 1.0 + (h - 1.0) / 2, z);
      add(g, box(0.05, 0.05, 0.05), M.dark, x, h, z);
      rod(g, M.metal, [x, h - 0.06, z + 0.22], [x, h + 0.12, z - 0.42], 0.009);
      add(g, cyl(0.022, 0.022, 0.1, 8), M.dark, x, h - 0.05, z + 0.2, -1.28, 0, 0);
      micHead(g, x, h + 0.12, z - 0.45, style === "condenser" ? PI : -1.9, style);
    }
  }

  /* ---- guitars ---- */
  const SHAPES = {};
  const shape = (k, f) => SHAPES[k] || (SHAPES[k] = f());
  /* built upright: neck along +y, strings facing +z */
  function guitarModel(parent, kind) {
    const s = grp(parent), bass = kind === "bass", ac = kind === "acoustic", L = bass ? 0.74 : ac ? 0.5 : 0.56;
    let depth = 0.045, top = 0.19;
    if (ac) {
      depth = 0.1; top = 0.2;
      const sh = shape("ac", () => splineShape([[0, -0.25], [0.13, -0.24], [0.2, -0.13], [0.16, -0.01], [0.12, 0.05], [0.14, 0.13], [0.1, 0.2], [0, 0.21]]));
      const bg = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 5 }); bg.translate(0, 0, -depth / 2);
      add(s, bg, [M.spruce, M.walnut]);
      noShadow(add(s, cyl(0.048, 0.048, 0.004, 14), M.ebony, 0, 0.05, depth / 2 + 0.001, PI / 2, 0, 0));
      add(s, box(0.11, 0.022, 0.012), M.ebony, 0, -0.11, depth / 2 + 0.006);
    } else {
      const sh = kind === "single"
        ? shape("single", () => splineShape([[0, -0.2], [0.12, -0.19], [0.17, -0.09], [0.135, 0.0], [0.15, 0.09], [0.13, 0.17], [0.06, 0.19], [0, 0.18]]))
        : shape("strat", () => {
          const P = [[0, -0.2], [0.12, -0.19], [0.17, -0.09], [0.135, 0.0], [0.15, 0.09], [0.12, 0.19], [0.06, 0.16], [0.035, 0.09],
            [-0.035, 0.09], [-0.05, 0.19], [-0.115, 0.22], [-0.15, 0.1], [-0.13, 0.0], [-0.17, -0.09], [-0.12, -0.19]].map(p => new THREE.Vector2(p[0], p[1]));
          const b = new THREE.Shape(); b.moveTo(P[0].x, P[0].y); b.splineThru(P.slice(1).concat([P[0]])); return b;
        });
      const bg = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 5 }); bg.translate(0, 0, -depth / 2);
      add(s, bg, bass ? M.bassbody : kind === "single" ? M.gloss : M.sunburst);
      add(s, box(0.11, 0.2, 0.004), kind === "single" ? M.cream2 : M.white, 0.005, -0.03, 0.025);
      add(s, box(0.075, 0.024, 0.014), kind === "single" ? M.chrome : M.ebony, 0, 0.03, 0.03);
      add(s, box(0.075, 0.024, 0.014), kind === "single" ? M.chrome : M.ebony, 0, -0.05, 0.03);
      add(s, box(0.085, 0.03, 0.016), M.chrome, 0, -0.12, 0.03);
      add(s, cyl(0.013, 0.013, 0.014, 8), M.chrome, 0.085, -0.13, 0.03, PI / 2, 0, 0);
      add(s, cyl(0.013, 0.013, 0.014, 8), M.chrome, 0.11, -0.085, 0.03, PI / 2, 0, 0);
    }
    const y0 = top - 0.1, zf = depth / 2;
    add(s, box(0.048, L, 0.024), ac ? M.walnut : M.maple, 0, y0 + L / 2, zf - 0.018);
    add(s, box(0.044, L, 0.006), bass || ac ? M.ebony : M.wood, 0, y0 + L / 2, zf - 0.003);
    for (let i = 1; i < 9; i++) noShadow(add(s, box(0.044, 0.003, 0.002), M.chrome, 0, y0 + L * (1 - Math.pow(0.86, i) * 0.98), zf + 0.0005));
    noShadow(add(s, box(bass ? 0.026 : 0.034, L + 0.21, 0.0015), M.chrome, 0, -0.12 + (L + 0.21) / 2, zf + 0.0025));
    const hy = y0 + L;
    add(s, box(0.07, 0.15, 0.018), ac ? M.walnut : M.maple, ac ? 0 : 0.008, hy + 0.07, zf - 0.024, 0, 0, ac ? 0 : -0.08);
    for (let i = 0; i < (bass ? 4 : 6); i++) {
      const side = ac ? (i % 2 ? 1 : -1) : -1, row = ac ? i >> 1 : i;
      noShadow(add(s, cyl(0.008, 0.008, 0.02, 6), M.chrome, side * 0.04, hy + 0.025 + row * (bass ? 0.034 : ac ? 0.042 : 0.022), zf - 0.024, 0, 0, PI / 2));
    }
    return s;
  }
  function guitarist(g, W, D, it, kind) {
    const s = fit(g, W, D, 0.72, 0.72), pr = person(s, 0, 0, poseOf(it, ["stand", "high", "low"])), bass = kind === "bass";
    const gt = guitarModel(pr.body, kind); gt.position.set(-0.07, 0.2, kind === "acoustic" ? 0.23 : 0.2); gt.rotation.set(0.12, 0, -1.02);
    noShadow(rod(pr.body, M.ebony, [-0.2, 0.12, 0.17], [0.16, 0.58, 0.02], 0.014));       /* strap */
    setArm(pr.L, -0.55, 0.5, -1.35, -0.2); setArm(pr.R, -0.3, -0.25, -1.3, 0.5);
    const rate = bass ? 2 : 4;
    anim(t => {
      const b = beat(t);
      pr.R.elb.rotation.x = -1.3 + Math.sin(b * rate * PI + pr.ph) * (bass ? 0.07 : 0.13);
      pr.L.elb.rotation.z = -0.2 + Math.sin(b * PI * 0.5 + pr.ph * 4) * 0.08;
      gt.rotation.z = -1.02 + Math.sin((b / 2 + pr.ph) * TAU) * 0.03;
    });
  }

  /* ---- violin family (violin, cello, upright bass): H = body length ---- */
  function vfam(parent, H, depth) {
    const s = grp(parent), sh = shape("vfam", () => splineShape([[0, -0.5], [0.2, -0.49], [0.33, -0.4], [0.36, -0.27], [0.3, -0.12], [0.22, -0.05], [0.2, 0.03], [0.24, 0.1], [0.29, 0.2], [0.28, 0.33], [0.18, 0.45], [0, 0.5]]));
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 5 }); bg.translate(0, 0, -0.5); bg.scale(H, H, depth);
    add(s, bg, M.varnish);
    const zf = depth / 2;
    add(s, box(0.06 * H, 0.72 * H, 0.05 * H), M.walnut, 0, 0.84 * H, zf - 0.02 * H);
    add(s, box(0.075 * H, 0.95 * H, 0.014 * H + 0.004), M.ebony, 0, 0.725 * H, zf + 0.025 * H);
    add(s, box(0.075 * H, 0.11 * H, 0.06 * H), M.walnut, 0, 1.2 * H, zf - 0.03 * H);
    add(s, cyl(0.045 * H, 0.045 * H, 0.09 * H, 10), M.walnut, 0, 1.27 * H, zf - 0.04 * H, 0, 0, PI / 2);
    for (let i = 0; i < 4; i++) noShadow(add(s, cyl(0.012 * H, 0.012 * H, 0.16 * H, 6), M.ebony, 0, 1.165 * H + (i >> 1) * 0.05 * H, zf - 0.03 * H, 0, 0, PI / 2));
    add(s, box(0.14 * H, 0.012, 0.07 * H), M.spruce, 0, -0.08 * H, zf + 0.035 * H);
    add(s, box(0.08 * H, 0.24 * H, 0.012 * H + 0.004), M.ebony, 0, -0.3 * H, zf + 0.02 * H);
    noShadow(add(s, box(0.05 * H, 1.42 * H, 0.002), M.chrome, 0, 0.41 * H, zf + 0.055 * H));
    return s;
  }
  function bow(elb, len = 0.7) {
    const b = grp(elb, 0, -0.29, 0);
    noShadow(rod(b, M.walnut, [0, 0, -len * 0.12], [0, 0, len * 0.88], 0.006));
    noShadow(rod(b, M.white, [0, -0.014, -len * 0.08], [0, -0.014, len * 0.86], 0.003));
    return b;
  }

  /* ---- keyboards ---- */
  /* a strip of piano keys: white bed + black keys as one instanced mesh (real 2-3 grouping) */
  function keyStrip(parent, kw, x = 0, y = 0, z = 0, depth = 0.15) {
    const k = grp(parent, x, y, z);
    add(k, box(kw, 0.014, depth), M.white, 0, 0, 0);
    const n = Math.max(14, Math.round(kw / 0.0235)), kwid = kw / n, idx = [];
    for (let i = 0; i < n - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) idx.push(i);
    const im = new THREE.InstancedMesh(box(kwid * 0.58, 0.014, depth * 0.6), M.ebony, idx.length), mx = new THREE.Matrix4();
    idx.forEach((i, j) => { mx.makeTranslation(-kw / 2 + (i + 1) * kwid, 0.014, -depth * 0.2); im.setMatrixAt(j, mx); });
    k.add(im); return k;
  }
  function slabKeyboard(parent, kw, y, z, tilt = 0, body = M.dark) {
    const kb = grp(parent, 0, y, z); kb.rotation.x = tilt;
    add(kb, box(kw, 0.08, 0.34), body);
    keyStrip(kb, kw * 0.95, 0, 0.042, 0.08);
    add(kb, box(kw * 0.95, 0.006, 0.13), M.ebony, 0, 0.042, -0.08);
    for (let i = 0; i < 6; i++) noShadow(add(kb, cyl(0.012, 0.012, 0.016, 8), M.chrome, -kw * 0.36 + i * 0.05, 0.05, -0.1));
    noShadow(add(kb, box(0.12, 0.004, 0.05), M.screen, kw * 0.12, 0.043, -0.1));
    noShadow(add(kb, box(0.012, 0.004, 0.012), M.ledred, kw * 0.4, 0.043, -0.1));
    return kb;
  }
  function xStand(g, hw, top, z) {
    [-0.12, 0.12].forEach(o => { rod(g, M.steel, [-hw, 0.02, z + o], [hw, top, z + o], 0.014); rod(g, M.steel, [hw, 0.02, z + o], [-hw, top, z + o], 0.014); });
    [-hw, hw].forEach(x => { rod(g, M.steel, [x, 0.02, z - 0.17], [x, 0.02, z + 0.17], 0.016); rod(g, M.steel, [x, top, z - 0.15], [x, top, z + 0.15], 0.014); });
  }
  function keysHands(pr, sx = -0.7, ex = -0.95) {
    setArm(pr.R, sx, -0.12, ex); setArm(pr.L, sx, 0.12, ex);
    anim(t => {
      const b = beat(t);
      pr.R.elb.rotation.x = ex + Math.pow(Math.max(0, Math.sin(b * TAU + pr.ph)), 3) * 0.14;
      pr.L.elb.rotation.x = ex + Math.pow(Math.max(0, Math.sin(b * TAU + PI + pr.ph)), 3) * 0.14;
      pr.R.sh.rotation.z = -0.12 + Math.sin(b * 0.5 + pr.ph * 5) * 0.12; pr.L.sh.rotation.z = 0.12 + Math.sin(b * 0.37 + 2) * 0.12;
    });
  }
  const KEYS = {
    stage(g, W, D, it) {
      const pose = poseOf(it, ["stand", "high", "low"]), kh = pose === "low" ? 0.72 : 0.92;
      const s = fit(g, W, D, 1.5, 0.95, 0.5), kw = clamp((W / s.scale.x) * 0.86, 0.9, 1.5);
      slabKeyboard(s, kw, kh, 0.16); xStand(s, clamp(kw * 0.3, 0.2, 0.5), kh - 0.045, 0.16);
      const pr = person(s, 0, -0.3, pose); pr.body.rotation.x = 0.08; keysHands(pr);
    },
    synth(g, W, D, it) {                                /* two-tier stand */
      const pose = poseOf(it, ["stand", "high"]), s = fit(g, W, D, 1.4, 1.0, 0.5);
      slabKeyboard(s, 1.25, 0.9, 0.14); slabKeyboard(s, 1.0, 1.16, 0.3, 0.22, M.teal);
      [-0.5, 0.5].forEach(x => { rod(s, M.steel, [x, 0.02, 0.2], [x, 0.86, 0.2], 0.018); rod(s, M.steel, [x, 0.86, 0.2], [x, 1.12, 0.38], 0.016); rod(s, M.steel, [x, 0.02, -0.05], [x, 0.02, 0.5], 0.018); rod(s, M.steel, [x, 0.86, 0.0], [x, 0.86, 0.3], 0.014); });
      rod(s, M.steel, [-0.5, 0.3, 0.2], [0.5, 0.3, 0.2], 0.014);
      const pr = person(s, 0, -0.32, pose); pr.body.rotation.x = 0.08; keysHands(pr, -0.85, -0.85);
    },
    organ(g, W, D) {                                    /* tonewheel organ: two manuals, drawbars, pedals */
      const s = fit(g, W, D, 1.3, 1.25, 0.5);
      add(s, box(1.22, 0.3, 0.62), M.walnut, 0, 0.83, 0.2);
      [-0.57, 0.57].forEach(x => add(s, box(0.08, 0.7, 0.6), M.walnut, x, 0.35, 0.2));
      add(s, box(1.14, 0.5, 0.03), M.walnut, 0, 0.42, 0.48);
      add(s, box(1.22, 0.035, 0.66), M.walnut, 0, 0.995, 0.2);
      keyStrip(s, 0.92, 0, 0.9, -0.2, 0.13); keyStrip(s, 0.92, 0, 0.965, -0.08, 0.13);
      add(s, box(1.06, 0.02, 0.3), M.ebony, 0, 0.885, -0.16);
      for (let i = 0; i < 18; i++) noShadow(add(s, box(0.014, 0.012, 0.05), i % 3 === 1 ? M.ebony : i % 3 ? M.white : M.walnut, -0.4 + i * 0.047, 1.0, 0.03 + ((i * 7) % 4) * 0.012));
      for (let i = 0; i < 12; i++) add(s, box(0.035, 0.03, 0.42), i % 3 === 1 ? M.ebony : M.maple, -0.3 + i * 0.055, 0.03, 0.0);
      bench(s, 0, -0.5, 0.9);
      const pr = person(s, 0, -0.5, "perch", false); pr.body.rotation.x = 0.06; keysHands(pr, -0.75, -0.9);
    },
    upright(g, W, D) {
      const s = fit(g, W, D, 1.6, 1.3, 0.5);
      add(s, box(1.5, 1.22, 0.36), M.gloss, 0, 0.61, 0.32);
      add(s, box(1.5, 0.1, 0.3), M.gloss, 0, 0.7, 0.02);
      keyStrip(s, 1.22, 0, 0.757, -0.04, 0.15);
      [-0.71, 0.71].forEach(x => { add(s, box(0.08, 0.66, 0.1), M.gloss, x, 0.33, -0.08); add(s, box(0.08, 0.06, 0.5), M.gloss, x, 0.03, 0.2); });
      add(s, box(1.5, 0.04, 0.42), M.gloss, 0, 1.24, 0.3);
      add(s, box(0.6, 0.3, 0.012), M.sheet, 0, 0.99, 0.13, -0.15, 0, 0);
      [-0.08, 0, 0.08].forEach(x => noShadow(add(s, box(0.04, 0.015, 0.09), M.brass, x, 0.06, 0.1)));
      bench(s, 0, -0.42, 0.85);
      const pr = person(s, 0, -0.42, "perch", false); pr.body.rotation.x = 0.05; keysHands(pr, -0.7, -1.0);
    },
    grand(g, W, D) {
      const s = fit(g, W, D, 1.6, 2.7, 0.45), w = 1.5, z0 = -0.62, L = 1.85, y = 0.68, h = 0.3;
      const outline = shape("grand", () => {
        const sh = new THREE.Shape(), c = (x, z) => new THREE.Vector2(x, -z);
        sh.moveTo(-w / 2, -z0); sh.lineTo(w / 2, -z0); sh.lineTo(w / 2, -(z0 + L * 0.72));
        sh.splineThru([c(w * 0.42, z0 + L * 0.9), c(w * 0.16, z0 + L), c(-w * 0.14, z0 + L * 0.9), c(-w * 0.26, z0 + L * 0.66), c(-w * 0.44, z0 + L * 0.42), c(-w / 2, z0 + L * 0.24)]);
        sh.lineTo(-w / 2, -z0); return sh;
      });
      const body = new THREE.ExtrudeGeometry(outline, { depth: h, bevelEnabled: false, curveSegments: 6 }); body.rotateX(-PI / 2); body.translate(0, y, 0);
      add(s, body, M.gloss);
      const inner = new THREE.ExtrudeGeometry(outline, { depth: 0.01, bevelEnabled: false, curveSegments: 6 }); inner.rotateX(-PI / 2); inner.scale(0.94, 1, 0.94); inner.translate(0, y + h - 0.02, 0.04);
      noShadow(add(s, inner, M.brass));
      /* lid, hinged on the long straight side and propped open */
      const lid = grp(s, w / 2, y + h + 0.01, 0); lid.rotation.z = 0.62;
      const lg = new THREE.ExtrudeGeometry(outline, { depth: 0.025, bevelEnabled: false, curveSegments: 6 }); lg.rotateX(-PI / 2); lg.translate(-w / 2, 0, 0);
      add(lid, lg, M.gloss);
      rod(s, M.gloss, [-w * 0.3, y + h, z0 + L * 0.45], [-w * 0.3 + 0.5, y + h + 0.5, z0 + L * 0.45], 0.012);
      /* keyboard end */
      add(s, box(w, 0.1, 0.24), M.gloss, 0, y + 0.02, z0 - 0.12);
      keyStrip(s, 1.22, 0, y + 0.078, z0 - 0.15, 0.15);
      add(s, box(w, 0.2, 0.04), M.gloss, 0, y + 0.2, z0 - 0.0);
      add(s, box(0.6, 0.26, 0.012), M.sheet, 0, y + h + 0.16, z0 + 0.1, -0.2, 0, 0);
      [[-w / 2 + 0.12, z0 + 0.05], [w / 2 - 0.12, z0 + 0.05], [w * 0.1, z0 + L - 0.3]].forEach(p => { tube(s, M.gloss, [p[0], 0.05, p[1]], [p[0], y, p[1]], 0.04, 0.065, 8); add(s, cyl(0.035, 0.035, 0.05, 8), M.brass, p[0], 0.035, p[1], 0, 0, PI / 2); });
      rod(s, M.gloss, [-0.07, 0.1, z0 + 0.1], [-0.07, y, z0 + 0.1], 0.02); rod(s, M.gloss, [0.07, 0.1, z0 + 0.1], [0.07, y, z0 + 0.1], 0.02);
      add(s, box(0.26, 0.05, 0.12), M.gloss, 0, 0.1, z0 + 0.08);
      [-0.07, 0, 0.07].forEach(x => noShadow(add(s, box(0.035, 0.012, 0.09), M.brass, x, 0.07, z0 - 0.0)));
      bench(s, 0, z0 - 0.52, 0.85);
      const pr = person(s, 0, z0 - 0.52, "perch", false); pr.body.rotation.x = 0.05; keysHands(pr, -0.7, -1.0);
    }
  };

  /* ---- drums ---- */
  function drumShell(g, r, h, m, x, y, z, rx = 0) {
    const d = grp(g, x, y, z); d.rotation.x = rx;
    add(d, cyl(r, r, h, 16), m);
    add(d, cyl(r * 0.965, r * 0.965, h + 0.012, 16), M.white);
    add(d, cyl(r * 1.035, r * 1.035, 0.022, 16), M.chrome, 0, h / 2 - 0.004, 0);
    add(d, cyl(r * 1.035, r * 1.035, 0.022, 16), M.chrome, 0, -h / 2 + 0.004, 0);
    return d;
  }
  function cymbal(g, r, x, y, z, rx = 0, rz = 0, onStand = 0) {
    if (onStand) { tripod(g, x, z, 0.32, 0.27, M.chrome); add(g, cyl(0.011, 0.011, y - 0.32, 6), M.chrome, x, 0.32 + (y - 0.32) / 2, z); }
    const c = grp(g, x, y, z); c.rotation.set(rx, 0, rz);
    add(c, cyl(0.02, r, 0.03, 16), M.brass);
    add(c, cyl(0.012, 0.03, 0.02, 8), M.brass, 0, 0.022, 0);
    return c;
  }
  function kick(s, x, z, r = 0.29, m = M.clay) {
    drumShell(s, r, 0.42, m, x, r + 0.01, z, PI / 2);
    noShadow(add(s, cyl(0.1, 0.1, 0.004, 14), M.dark, x, r + 0.01, z + 0.218, PI / 2, 0, 0));
    [-1, 1].forEach(d => rod(s, M.chrome, [x + d * 0.22, r, z + 0.12], [x + d * (r + 0.07), 0.0, z + 0.26], 0.009));
    add(s, box(0.09, 0.02, 0.26), M.chrome, x, 0.02, z - 0.33, 0.25, 0, 0);
    rod(s, M.chrome, [x, 0.02, z - 0.22], [x, r, z - 0.22], 0.008);
  }
  function floorTom(s, x, z, r = 0.21, m = M.clay) {
    drumShell(s, r, 0.38, m, x, 0.46, z);
    for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; rod(s, M.chrome, [x + Math.cos(a) * (r + 0.01), 0.5, z + Math.sin(a) * (r + 0.01)], [x + Math.cos(a) * (r + 0.05), 0, z + Math.sin(a) * (r + 0.05)], 0.008); }
  }
  function snare(s, x, z, y = 0.64) {
    drumShell(s, 0.18, 0.14, M.chrome, x, y, z, 0.08);
    tripod(s, x, z, 0.3, 0.22, M.chrome); add(s, cyl(0.012, 0.012, y - 0.34, 6), M.chrome, x, 0.3 + (y - 0.34) / 2, z);
  }
  function hihat(s, x, z, y = 0.88) {
    tripod(s, x, z, 0.3, 0.24, M.chrome); add(s, cyl(0.011, 0.011, y - 0.2, 6), M.chrome, x, 0.3 + (y - 0.2) / 2, z);
    cymbal(s, 0.17, x, y - 0.02, z, PI, 0); return cymbal(s, 0.17, x, y + 0.02, z);
  }
  function drummer(s, x, z, pose, cym) {
    if (pose !== "stand") { add(s, cyl(0.17, 0.16, 0.08, 12), M.ebony, x, 0.46, z); add(s, cyl(0.02, 0.02, 0.2, 6), M.chrome, x, 0.33, z); tripod(s, x, z, 0.24, 0.24, M.chrome); }
    const pr = person(s, x, z, pose === "stand" ? "stand" : "perch", false);
    [pr.R, pr.L].forEach(a => noShadow(rod(a.elb, M.maple, [0, -0.3, -0.04], [0, -0.3, 0.36], 0.008)));
    pr.R.sh.rotation.set(-0.75, 0, -0.25); pr.L.sh.rotation.set(-0.75, 0, 0.3);
    anim(t => {
      const b = beat(t), hit = o => Math.pow(Math.max(0, Math.sin((b * 2 + o) * PI)), 6), hr = hit(0), hl = hit(1);
      pr.R.elb.rotation.x = -1.45 + hr * 0.5; pr.L.elb.rotation.x = -1.45 + hl * 0.5;
      (cym || []).forEach((c, i) => { c.rotation.x = c.userData.rx + Math.sin(t * (6 + i * 1.3) + i) * 0.03 + (i % 2 ? hl : hr) * 0.02; });
    });
    return pr;
  }
  const keep = c => { c.userData.rx = c.rotation.x; return c; };
  const DRUMS = {
    standard(g, W, D, it, v) {
      const big = v === "big", jazz = v === "compact";
      const s = fit(g, W, D, big ? 2.9 : jazz ? 1.7 : 2.0, big ? 1.9 : 1.5, 0.45, 1.3), m = big ? M.red : jazz ? M.walnut : M.clay, cym = [];
      if (big) {
        kick(s, -0.36, 0.25, 0.29, m); kick(s, 0.36, 0.25, 0.29, m);
        [-0.5, -0.17, 0.17, 0.5].forEach((x, i) => { drumShell(s, 0.12 + i * 0.012, 0.19, m, x, 0.8, 0.2, 0.4); rod(s, M.chrome, [x, 0.6, 0.22], [x, 0.71, 0.2], 0.01); });
        floorTom(s, 0.86, -0.1, 0.2, m); floorTom(s, 1.02, 0.34, 0.23, m);
        snare(s, -0.2, -0.16); hihat(s, -0.86, 0.0);
        cym.push(keep(cymbal(s, 0.23, -0.82, 1.4, 0.5, 0.18, 0.1, 1)), keep(cymbal(s, 0.24, 0.0, 1.5, 0.62, 0.25, 0, 1)), keep(cymbal(s, 0.23, 0.72, 1.42, 0.6, 0.2, -0.1, 1)),
          keep(cymbal(s, 0.28, 1.2, 1.22, 0.0, 0.2, -0.15, 1)), keep(cymbal(s, 0.22, -1.2, 1.3, 0.3, PI + 0.2, 0.15, 1)), keep(cymbal(s, 0.13, -0.3, 1.2, 0.56, 0.25, 0.05, 1)));
        drummer(s, 0.0, -0.58, "perch", cym);
      } else {
        const kr = jazz ? 0.23 : 0.29;
        kick(s, 0, 0.22, kr, m);
        if (jazz) { drumShell(s, 0.15, 0.2, m, -0.02, 0.66, 0.2, 0.3); rod(s, M.chrome, [0, 0.46, 0.2], [0, 0.57, 0.2], 0.01); }
        else { drumShell(s, 0.14, 0.19, m, -0.17, 0.76, 0.2, 0.38); drumShell(s, 0.155, 0.21, m, 0.18, 0.76, 0.2, 0.38); [-0.1, 0.1].forEach(x => rod(s, M.chrome, [x, 0.56, 0.22], [x * 1.5, 0.68, 0.2], 0.01)); }
        snare(s, -0.42, -0.12); floorTom(s, jazz ? 0.42 : 0.48, -0.16, jazz ? 0.18 : 0.21, m); hihat(s, -0.74, 0.02);
        if (!jazz) cym.push(keep(cymbal(s, 0.23, -0.52, 1.36, 0.36, 0.18, 0.1, 1)));
        cym.push(keep(cymbal(s, 0.27, jazz ? 0.56 : 0.64, 1.2, 0.3, 0.22, -0.12, 1)));
        drummer(s, 0, -0.5, "perch", cym);
      }
    },
    standup(g, W, D) {                                   /* cocktail kit: played standing */
      const s = fit(g, W, D, 1.5, 1.3, 0.45), cym = [];
      drumShell(s, 0.2, 0.62, M.teal, 0, 0.6, 0.18);
      for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3 + 0.4; rod(s, M.chrome, [Math.cos(a) * 0.2, 0.4, 0.18 + Math.sin(a) * 0.2], [Math.cos(a) * 0.27, 0, 0.18 + Math.sin(a) * 0.27], 0.009); }
      add(s, box(0.09, 0.02, 0.26), M.chrome, 0, 0.02, -0.1, 0.25, 0, 0);
      drumShell(s, 0.16, 0.12, M.chrome, -0.36, 1.0, 0.08, 0.1); rod(s, M.chrome, [-0.2, 0.8, 0.14], [-0.34, 0.94, 0.08], 0.01);
      drumShell(s, 0.11, 0.14, M.teal, 0.3, 1.02, 0.14, 0.2); rod(s, M.chrome, [0.19, 0.8, 0.16], [0.28, 0.95, 0.14], 0.01);
      cym.push(keep(cymbal(s, 0.2, 0.52, 1.36, 0.42, 0.18, -0.1, 1))); hihat(s, -0.62, 0.3, 1.12);
      drummer(s, 0, -0.42, "stand", cym);
    },
    electronic(g, W, D) {
      const s = fit(g, W, D, 1.8, 1.4, 0.45);
      const pad = (x, y, z, r, rx = 0.35) => { const p = grp(s, x, y, z); p.rotation.x = rx; add(p, cyl(r, r, 0.05, 14), M.pad); noShadow(add(p, cyl(r * 0.86, r * 0.86, 0.052, 14), M.mid)); return p; };
      [-0.62, 0.62].forEach(x => { rod(s, M.steel, [x, 0, 0.2], [x, 1.05, 0.2], 0.02); rod(s, M.steel, [x, 0.02, -0.15], [x, 0.02, 0.5], 0.02); });
      rod(s, M.steel, [-0.62, 0.86, 0.2], [0.62, 0.86, 0.2], 0.02);
      pad(-0.3, 0.9, 0.12, 0.12); pad(0.0, 0.9, 0.12, 0.12); pad(0.34, 0.8, 0.02, 0.13);
      pad(-0.42, 0.68, -0.14, 0.15, 0.1); rod(s, M.steel, [-0.42, 0.64, -0.12], [-0.6, 0.62, 0.18], 0.012);
      const c1 = pad(-0.62, 1.2, 0.3, 0.17, 0.3), c2 = pad(0.62, 1.2, 0.3, 0.19, 0.3), hh = pad(-0.86, 0.95, 0.0, 0.14, 0.15);
      rod(s, M.steel, [-0.86, 0, 0], [-0.86, 0.92, 0], 0.012); tripod(s, -0.86, 0, 0.25, 0.2);
      add(s, box(0.24, 0.3, 0.06), M.pad, 0, 0.22, 0.24, -0.15, 0, 0); add(s, box(0.3, 0.03, 0.3), M.steel, 0, 0.015, 0.18);
      add(s, box(0.09, 0.02, 0.26), M.chrome, 0, 0.02, -0.1, 0.25, 0, 0);
      add(s, box(0.22, 0.12, 0.05), M.dark, -0.62, 1.0, 0.22, -0.4, 0, 0); noShadow(add(s, box(0.1, 0.05, 0.004), M.screen, -0.62, 1.01, 0.195, -0.4, 0, 0));
      drummer(s, 0, -0.5, "perch", [keep(c1), keep(c2), keep(hh)]);
    }
  };

  /* ---- horns: built from the mouthpiece (origin) ---- */
  function sax(parent, kind) {
    const s = grp(parent), L = { soprano: 0.5, alto: 0.4, tenor: 0.52, bari: 0.74 }[kind] || 0.4, f = kind === "bari" ? 1.35 : kind === "tenor" ? 1.15 : 1;
    tube(s, M.ebony, [0, 0, 0], [0, -0.02, 0.07], 0.008, 0.012);
    if (kind === "soprano") {                           /* straight, held out in front */
      tube(s, M.brass, [0, -0.02, 0.07], [0, -0.3, 0.42], 0.012, 0.028); tube(s, M.brass, [0, -0.3, 0.42], [0, -0.36, 0.5], 0.028, 0.05);
      for (let i = 0; i < 5; i++) noShadow(add(s, cyl(0.012, 0.012, 0.008, 8), M.gold || M.brass, 0, -0.07 - i * 0.045 + 0.02, 0.13 + i * 0.056 + 0.02, 0.9, 0, 0));
      return s;
    }
    const top = [0, -0.1, 0.15], bot = [0, -0.1 - L, 0.2], R = 0.055 * f;
    if (kind === "bari") { noShadow(add(s, new THREE.TorusGeometry(0.05, 0.014, 6, 12), M.brass, 0, -0.03, 0.12, 0, PI / 2, 0)); tube(s, M.brass, [0, -0.02, 0.07], [0, 0.0, 0.09], 0.012, 0.014); }
    else tube(s, M.brass, [0, -0.02, 0.07], top, 0.012, 0.016);
    tube(s, M.brass, top, bot, 0.018, 0.04 * f);
    const tg = new THREE.TorusGeometry(R, 0.042 * f, 6, 10, PI); tg.rotateZ(PI); tg.rotateY(PI / 2);
    add(s, tg, M.brass, 0, bot[1], bot[2] + R);
    tube(s, M.brass, [0, bot[1], bot[2] + 2 * R], [0, bot[1] + 0.2 * f, bot[2] + 2 * R + 0.05], 0.044 * f, 0.085 * f, 10);
    for (let i = 0; i < 6; i++) noShadow(add(s, cyl(0.014 * f, 0.014 * f, 0.008, 8), M.chrome, 0, top[1] - 0.05 - (i * (L - 0.08)) / 5, top[2] + 0.03 + i * 0.008 + 0.02 * f, PI / 2, 0, 0));
    return s;
  }
  function trumpet(parent) {
    const s = grp(parent);
    rod(s, M.brass, [0, 0, 0], [0, 0, 0.5], 0.008);
    rod(s, M.brass, [0, -0.07, 0.1], [0, -0.07, 0.36], 0.009);
    rod(s, M.brass, [0, 0, 0.1], [0, -0.07, 0.1], 0.009); rod(s, M.brass, [0, 0, 0.5], [0, -0.07, 0.5], 0.009);
    rod(s, M.brass, [0, -0.07, 0.5], [0, -0.07, 0.36], 0.009);
    [0.2, 0.245, 0.29].forEach(z => { add(s, cyl(0.014, 0.014, 0.13, 8), M.brass, 0, -0.03, z); noShadow(add(s, cyl(0.011, 0.011, 0.012, 8), M.white, 0, 0.045, z)); });
    tube(s, M.brass, [0, -0.035, 0.3], [0, -0.035, 0.5], 0.01, 0.022); tube(s, M.brass, [0, -0.035, 0.5], [0, -0.035, 0.6], 0.022, 0.068, 12);
    return s;
  }
  function trombone(parent) {
    const s = grp(parent), slide = grp(s);
    rod(s, M.brass, [0, 0, 0], [0, 0, 0.42], 0.007); rod(s, M.brass, [0, -0.09, 0], [0, -0.09, 0.42], 0.007);
    rod(slide, M.brass, [0, 0, 0.3], [0, 0, 0.78], 0.009); rod(slide, M.brass, [0, -0.09, 0.3], [0, -0.09, 0.78], 0.009);
    rod(slide, M.brass, [0, 0, 0.78], [0, -0.09, 0.78], 0.009); rod(slide, M.chrome, [0, 0, 0.36], [0, -0.09, 0.36], 0.006);
    rod(s, M.brass, [0, -0.09, 0], [0, -0.09, -0.32], 0.008); rod(s, M.brass, [0, -0.09, -0.32], [0.12, -0.02, -0.32], 0.01);
    tube(s, M.brass, [0.12, -0.02, -0.32], [0.12, -0.02, 0.22], 0.01, 0.022); tube(s, M.brass, [0.12, -0.02, 0.22], [0.12, -0.02, 0.44], 0.022, 0.11, 12);
    rod(s, M.brass, [0, -0.02, 0.02], [0.12, -0.02, 0.02], 0.006);
    return { group: s, slide };
  }
  function hornist(g, W, D, it) {
    const v = it.v || "alto", s = fit(g, W, D, 0.72, 0.8), pr = person(s, 0, 0, poseOf(it, ["stand", "high", "low"])), mouth = [0, 0.755, 0.125];
    if (v === "trumpet") {
      const h = trumpet(pr.body); h.position.set(...mouth); h.rotation.x = 0.06;
      setArm(pr.R, -1.0, 0.42, -1.7); setArm(pr.L, -1.05, -0.42, -1.75);
      anim(t => { const b = beat(t); h.rotation.x = 0.06 - Math.abs(Math.sin(b * PI / 2 + pr.ph)) * 0.12; pr.body.rotation.x = -Math.abs(Math.sin(b * PI / 2 + pr.ph)) * 0.04; });
    } else if (v === "trombone") {
      const h = trombone(pr.body); h.group.position.set(...mouth); h.group.rotation.x = 0.1;
      setArm(pr.L, -1.05, -0.42, -1.75); setArm(pr.R, -1.2, 0.2, -1.0);
      anim(t => { const k = (Math.sin(beat(t) * PI * 0.5 + pr.ph * 6) + 1) / 2; h.slide.position.z = -0.22 + k * 0.24; pr.R.elb.rotation.x = -1.5 + k * 0.9; });
    } else {
      const h = sax(pr.body, v); h.position.set(...mouth);
      if (v === "soprano") { setArm(pr.L, -0.75, -0.3, -1.6); setArm(pr.R, -0.6, 0.3, -1.3); }
      else { h.rotation.z = -0.22; setArm(pr.L, -0.55, -0.38, -1.75); setArm(pr.R, -0.2, 0.28, -1.45); }
      const rz = h.rotation.z;
      anim(t => { const b = beat(t); h.rotation.x = Math.sin(b * PI + pr.ph) * 0.05; h.rotation.z = rz + Math.sin((b / 2 + pr.ph) * TAU) * 0.04; pr.body.rotation.x = Math.sin(b * PI / 2 + pr.ph) * 0.05; });
    }
  }

  /* ---- bowed strings ---- */
  function stringPlayer(g, W, D, it) {
    const v = it.v || "violin";
    if (v === "cello") {
      const s = fit(g, W, D, 0.8, 1.1), pr = person(s, 0, -0.12, "low");
      const c = vfam(pr.root, 0.76, 0.12); c.position.set(0.02, 0.62, 0.34); aim(c, [0.06, 1, -0.28], [0, 0.28, 1]);
      rod(pr.root, M.chrome, [0.0, 0.26, 0.42], [0, 0, 0.5], 0.006);
      setArm(pr.L, -0.95, 0.2, -2.3, 0.2); setArm(pr.R, -0.75, -0.3, -0.75);
      const bw = bow(pr.R.elb, 0.72); bw.rotation.set(0, 1.35, 0);
      anim(t => { const k = Math.sin(beat(t) * PI + pr.ph); pr.R.sh.rotation.z = -0.3 + k * 0.22; pr.R.elb.rotation.z = k * 0.2; });
    } else {
      const s = fit(g, W, D, 0.72, 0.8), pr = person(s, 0, 0, poseOf(it, ["stand", "high", "low"]));
      const c = vfam(pr.body, v === "viola" ? 0.41 : 0.36, 0.04); c.position.set(0.16, 0.6, 0.24); aim(c, [0.45, 0.08, 0.89], [-0.2, 1, 0]);
      setArm(pr.L, -1.15, 0.35, -1.9, -0.3); setArm(pr.R, -1.15, 0.35, -1.5);
      const bw = bow(pr.R.elb, 0.68); bw.rotation.set(0.3, 1.9, 0);
      pr.head.rotation.z = -0.2;
      anim(t => { const k = Math.sin(beat(t) * PI + pr.ph); pr.R.sh.rotation.x = -1.15 + k * 0.16; pr.R.elb.rotation.x = -1.5 + k * 0.32; });
    }
  }
  function uprightBass(g, W, D, it) {
    const pose = poseOf(it, ["stand", "high"]), s = fit(g, W, D, 0.9, 1.0), pr = person(s, -0.1, -0.12, pose);
    const c = vfam(s, 1.12, 0.2); c.position.set(0.14, 0.82, 0.22); aim(c, [-0.06, 1, -0.14], [-0.25, 0.14, 1]);
    rod(s, M.chrome, [0.17, 0.27, 0.3], [0.19, 0, 0.34], 0.008);
    setArm(pr.L, -1.15, 0.45, -2.0, -0.3); setArm(pr.R, -0.7, 0.3, -1.0);
    anim(t => { const b = beat(t); pr.R.elb.rotation.x = -1.0 + Math.pow(Math.max(0, Math.sin(b * PI + pr.ph)), 3) * 0.3; pr.L.sh.rotation.x = -1.15 + Math.sin(b * 0.5 + pr.ph * 5) * 0.1; });
  }

  /* ---- DJ ---- */
  function dj(g, W, D, it) {
    const v = it.v || "cdj", s = fit(g, W, D, 2.2, 1.5, 0.45), w = 2.0, d = 0.72, z = 0.26, y = 0.95, spin = [];
    add(s, box(w, 0.04, d), M.ebony, 0, y, z);
    add(s, box(w, y, 0.02), M.pad, 0, y / 2, z + d / 2 - 0.01);
    [-1, 1].forEach(sd => add(s, box(0.02, y, d), M.pad, sd * (w / 2 - 0.01), y / 2, z));
    noShadow(add(s, box(w * 0.5, 0.012, 0.004), M.clay, 0, y - 0.12, z + d / 2 + 0.002));
    const t = y + 0.02;
    const mixer = x => {
      add(s, box(0.32, 0.1, 0.4), M.dark, x, t + 0.05, z);
      for (let i = 0; i < 12; i++) noShadow(add(s, cyl(0.011, 0.014, 0.02, 8), i % 4 === 0 ? M.clay : M.chrome, x - 0.11 + (i % 4) * 0.073, t + 0.11, z - 0.14 + Math.floor(i / 4) * 0.07));
      for (let i = 0; i < 4; i++) noShadow(add(s, box(0.012, 0.012, 0.08), M.silver, x - 0.11 + i * 0.073, t + 0.105, z + 0.11));
      [-0.02, 0.02].forEach(o => { noShadow(add(s, box(0.008, 0.004, 0.09), M.led, x + o, t + 0.102, z - 0.02)); noShadow(add(s, box(0.008, 0.005, 0.02), M.ledred, x + o, t + 0.103, z - 0.075)); });
    };
    if (v === "turntables") {
      [-0.6, 0.6].forEach(x => {
        add(s, box(0.45, 0.1, 0.36), M.silver, x, t + 0.05, z);
        const p = grp(s, x - 0.04, t + 0.11, z); add(p, cyl(0.155, 0.155, 0.02, 20), M.chrome); add(p, cyl(0.148, 0.148, 0.008, 20), M.vinyl, 0, 0.014, 0);
        add(p, cyl(0.05, 0.05, 0.002, 12), M.clay, 0, 0.019, 0); noShadow(add(p, box(0.012, 0.002, 0.06), M.white, 0.02, 0.0205, 0)); spin.push(p);
        rod(s, M.chrome, [x + 0.18, t + 0.14, z - 0.13], [x + 0.07, t + 0.125, z + 0.06], 0.006); add(s, cyl(0.02, 0.02, 0.05, 8), M.chrome, x + 0.18, t + 0.125, z - 0.13);
      });
      mixer(0);
    } else if (v === "controller") {
      add(s, box(0.8, 0.05, 0.4), M.dark, 0, t + 0.025, z + 0.08);
      [-0.24, 0.24].forEach(x => { const p = grp(s, x, t + 0.055, z + 0.1); add(p, cyl(0.1, 0.1, 0.014, 18), M.chrome); noShadow(add(p, box(0.012, 0.002, 0.07), M.clay, 0, 0.008, 0.03)); spin.push(p); });
      for (let i = 0; i < 8; i++) noShadow(add(s, cyl(0.01, 0.012, 0.016, 8), M.chrome, -0.06 + (i % 4) * 0.04, t + 0.057, z - 0.04 + (i >> 2) * 0.05));
      for (let i = 0; i < 16; i++) noShadow(add(s, box(0.03, 0.006, 0.03), i % 5 ? M.mid : M.clay, (i < 8 ? -0.36 : 0.12) + (i % 4) * 0.04 + ((i % 8) >> 2 ? 0 : 0), t + 0.053, z + 0.2 + ((i % 8) >> 2) * 0.04));
      /* laptop on a raised stand behind the controller */
      rod(s, M.steel, [-0.15, t, z - 0.2], [-0.15, t + 0.2, z - 0.24], 0.01); rod(s, M.steel, [0.15, t, z - 0.2], [0.15, t + 0.2, z - 0.24], 0.01);
      add(s, box(0.34, 0.014, 0.23), M.metal, 0, t + 0.21, z - 0.2, 0.2, 0, 0);
      const lid = grp(s, 0, t + 0.235, z - 0.31); lid.rotation.x = -0.15;
      add(lid, box(0.34, 0.225, 0.008), M.metal, 0, 0.1125, 0); noShadow(add(lid, box(0.315, 0.195, 0.002), M.screen, 0, 0.115, 0.0055));
    } else {
      [-0.58, 0.58].forEach(x => {
        add(s, box(0.34, 0.1, 0.42), M.dark, x, t + 0.05, z);
        const p = grp(s, x, t + 0.108, z + 0.07); add(p, cyl(0.11, 0.11, 0.016, 20), M.chrome); add(p, cyl(0.07, 0.07, 0.004, 16), M.pad, 0, 0.01, 0); noShadow(add(p, box(0.012, 0.002, 0.05), M.clay, 0, 0.013, 0.035)); spin.push(p);
        noShadow(add(s, box(0.2, 0.004, 0.11), M.screen, x, t + 0.103, z - 0.13));
        noShadow(add(s, cyl(0.02, 0.02, 0.012, 10), M.led, x - 0.12, t + 0.106, z + 0.16)); noShadow(add(s, cyl(0.02, 0.02, 0.012, 10), M.clay, x - 0.07, t + 0.106, z + 0.16));
      });
      mixer(0);
    }
    const pr = person(s, 0, z - d / 2 - 0.28, "stand");
    noShadow(add(pr.body, new THREE.TorusGeometry(0.09, 0.022, 6, 14, PI * 1.4), M.dark, 0, 0.64, 0.0, PI / 2, 0, PI * 0.8));
    setArm(pr.R, -0.7, -0.5, -0.8); setArm(pr.L, -0.75, 0.05, -0.7);
    anim(tm => {
      const b = beat(tm), bar = Math.floor(b / 8) % 2;
      spin.forEach((p, i) => (p.rotation.y = -tm * (v === "turntables" ? 3.5 : 1.2) + i));
      pr.body.position.y = pr.hip + Math.abs(Math.sin(b * PI)) * 0.03;
      pr.head.rotation.x = 0.2 * Math.pow((Math.sin(b * TAU) + 1) / 2, 2);
      /* every other 8 beats one hand goes up */
      const up = bar ? Math.min(1, (b % 8) / 0.6) * Math.min(1, (8 - (b % 8)) / 0.6) : 0;
      pr.L.sh.rotation.x = -0.75 - up * (1.9 + Math.abs(Math.sin(b * PI)) * 0.15); pr.L.elb.rotation.x = -0.7 + up * 0.5;
      pr.R.sh.rotation.z = -0.5 + Math.sin(b * 0.4) * 0.12;
    });
  }

  /* ---- percussion ---- */
  const PERC = {
    congas(g, W, D, it) {
      const pose = poseOf(it, ["stand", "high"]), s = fit(g, W, D, 0.75, 0.9), zc = 0.22, ty = pose === "high" ? 0.86 : 0.925;
      [[-0.19, 0.16, 0.11, M.clay], [0.2, 0.18, 0.12, M.wood]].forEach(c => {
        add(s, cyl(c[1], c[2], 0.72, 12), c[3], c[0], ty - 0.365, zc);
        add(s, cyl(c[1] * 0.97, c[1] * 0.97, 0.014, 12), M.white, c[0], ty, zc);
        add(s, cyl(c[1] * 1.05, c[1] * 1.05, 0.02, 12), M.chrome, c[0], ty - 0.025, zc);
        for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; rod(s, M.chrome, [c[0] + Math.cos(a) * c[2], ty - 0.68, zc + Math.sin(a) * c[2]], [c[0] + Math.cos(a) * 0.2, 0, zc + Math.sin(a) * 0.2], 0.008); }
      });
      PERC._hands(person(s, 0, zc - 0.42, pose), -0.6, -1.3);
    },
    cajon(g, W, D) {
      const s = fit(g, W, D, 0.6, 0.8);
      add(s, box(0.3, 0.48, 0.3), M.spruce, 0, 0.24, -0.05); add(s, box(0.3, 0.48, 0.012), M.walnut, 0, 0.24, 0.105);
      noShadow(add(s, cyl(0.055, 0.055, 0.006, 12), M.ebony, 0, 0.26, -0.203, PI / 2, 0, 0));
      const pr = person(s, 0, -0.05, "perch", false); pr.body.rotation.x = 0.25; PERC._hands(pr, -0.15, -0.5, 0.25);
    },
    djembe(g, W, D) {
      const s = fit(g, W, D, 0.65, 0.9), pr = person(s, 0, -0.12, "low"), d = grp(s, 0, 0.0, 0.3); d.rotation.x = 0.22;
      add(d, cyl(0.17, 0.07, 0.3, 12), M.walnut, 0, 0.5, 0); add(d, cyl(0.07, 0.12, 0.34, 12), M.walnut, 0, 0.18, 0);
      add(d, cyl(0.165, 0.165, 0.014, 12), M.white, 0, 0.655, 0); add(d, cyl(0.178, 0.178, 0.02, 12), M.clay, 0, 0.63, 0);
      PERC._hands(pr, -0.7, -0.9, 0.25);
    },
    _hands(pr, sx, ex, amp = 0.4) {
      setArm(pr.R, sx, -0.15, ex); setArm(pr.L, sx, 0.15, ex);
      anim(t => { const b = beat(t), hit = o => Math.pow(Math.max(0, Math.sin((b * 2 + o) * PI + pr.ph)), 4); pr.R.elb.rotation.x = ex + hit(0) * amp; pr.L.elb.rotation.x = ex + hit(1) * amp; });
    }
  };

  /* a prism from a side profile [[z,y],…], extruded across the width (x) */
  function prism(profile, W) {
    const s = new THREE.Shape();
    profile.forEach((p, i) => (i ? s.lineTo(-p[0], p[1]) : s.moveTo(-p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false });
    geo.rotateY(PI / 2); geo.translate(-W / 2, 0, 0);
    return geo;
  }
  function combo(g, W, D, y0 = 0.03, feet = true) {
    const H = clamp(Math.min(W, D) * 1.1, 0.4, 0.85), z = D / 2;
    add(g, box(W, H, D), M.ebony, 0, H / 2 + y0, 0);
    add(g, box(W * 0.9, H * 0.66, 0.014), M.cloth, 0, H * 0.4 + y0, z + 0.007);
    noShadow(add(g, cyl(Math.min(W, H) * 0.26, Math.min(W, H) * 0.26, 0.008, 16), M.mid, 0, H * 0.4 + y0, z + 0.016, PI / 2, 0, 0));
    knobStrip(g, W, H * 0.87 + y0, z, H * 0.13);
    handle(g, W, H + y0);
    if (feet) [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(p => add(g, cyl(0.025, 0.025, 0.03, 8), M.dark, p[0] * (W / 2 - 0.05), 0.015, p[1] * (D / 2 - 0.05)));
  }
  function knobStrip(g, W, y, z, h) {
    add(g, box(W * 0.9, h, 0.016), M.brass, 0, y, z + 0.008);
    const nk = clamp(Math.round(W / 0.14), 3, 7);
    for (let i = 0; i < nk; i++) noShadow(add(g, cyl(0.016, 0.019, 0.022, 8), M.ebony, -W * 0.36 + (W * 0.6 * i) / (nk - 1), y, z + 0.026, PI / 2, 0, 0));
    noShadow(add(g, box(0.012, 0.012, 0.01), M.ledred, W * 0.38, y, z + 0.02));
  }
  function handle(g, W, y) {
    rod(g, M.ebony, [-W * 0.16, y, 0], [-W * 0.16, y + 0.04, 0], 0.01); rod(g, M.ebony, [W * 0.16, y, 0], [W * 0.16, y + 0.04, 0], 0.01);
    rod(g, M.ebony, [-W * 0.16, y + 0.04, 0], [W * 0.16, y + 0.04, 0], 0.012);
  }

  const BUILD = {
    drums(g, W, D, it) { const v = it.v || "standard"; (DRUMS[v] || DRUMS.standard)(g, W, D, it, v); },
    keys(g, W, D, it) { (KEYS[it.v] || KEYS.stage)(g, W, D, it); },
    guitar(g, W, D, it) { guitarist(g, W, D, it, it.v === "acoustic" || it.v === "single" ? it.v : "electric"); },
    bass(g, W, D, it) { if (it.v === "upright") uprightBass(g, W, D, it); else guitarist(g, W, D, it, "bass"); },
    horn: hornist,
    strings: stringPlayer,
    dj,
    perc(g, W, D, it) { (PERC[it.v] && it.v !== "_hands" ? PERC[it.v] : PERC.congas)(g, W, D, it); },
    vocal(g, W, D, it) {
      const v = it.v || "stand", pose = poseOf(it, ["stand", "high", "low"]), s = fit(g, W, D, 0.72, 0.9), pz = v === "wireless" ? 0 : -0.14;
      const pr = person(s, 0, pz, pose), mh = pose === "stand" ? 1.47 : pose === "high" ? 1.39 : 1.09;
      if (v === "wireless") {
        const m = micHead(pr.R.elb, 0, -0.3, 0.02, 0.5, "wireless"); m.rotation.set(1.9, 0, 0);
        setArm(pr.R, -0.95, 0.5, -2.0);
        anim(t => { const b = beat(t); pr.L.sh.rotation.x = -0.6 + Math.sin(b * PI / 2 + pr.ph) * 0.5; pr.L.elb.rotation.x = -0.9 + Math.sin(b * PI / 2 + 1) * 0.3; pr.body.rotation.x = Math.sin((b / 4 + pr.ph) * TAU) * 0.05; });
      } else {
        micStand(s, 0, pz + 0.34, mh, "straight", v === "vintage" ? "vintage" : "dynamic");
        setArm(pr.R, -1.0, 0.25, -1.25);
        anim(t => { const b = beat(t); pr.L.sh.rotation.x = Math.sin(b * PI + pr.ph) * 0.14; pr.L.elb.rotation.x = -0.25 + Math.sin(b * PI + 1) * 0.1; pr.body.rotation.x = Math.sin((b / 4 + pr.ph) * TAU) * 0.03; });
      }
    },
    mic(g, W, D, it) {
      const v = it.v || "boom";
      if (v === "short") micStand(g, 0, D * 0.15, 0.4, "short");
      else if (v === "condenser") micStand(g, 0, D * 0.15, 1.4, "boom", "condenser");
      else if (v === "vintage") micStand(g, 0, 0, 1.45, "straight", "vintage");
      else if (v === "overhead") micStand(g, 0, D * 0.15, 1.95, "boom", "pencil");
      else micStand(g, 0, D * 0.15, 1.35, "boom");
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
      noShadow(add(f, cyl(Math.min(W, len) * 0.26, Math.min(W, len) * 0.26, 0.016, 16), M.mid, -W * 0.14, 0.004, 0));
      noShadow(add(f, box(W * 0.2, 0.016, len * 0.3), M.mid, W * 0.27, 0.004, 0));
      noShadow(add(f, box(0.012, 0.016, 0.012), M.led, W * 0.4, 0.004, len * 0.38));
      [-1, 1].forEach(s => noShadow(add(g, box(0.01, H * 0.2, D * 0.3), M.mid, s * (W / 2 + 0.004), H * 0.45, D * 0.2)));
    },
    sidefill(g, W, D) {
      const w = clamp(W * 0.8, 0.3, 0.9), d = clamp(D * 0.75, 0.25, 0.7);
      tripod(g, 0, 0, 0.5, 0.45); add(g, cyl(0.02, 0.02, 0.95, 6), M.steel, 0, 0.72, 0);
      const sp = grp(g, 0, 1.55, 0); sp.rotation.x = 0.12;
      add(sp, box(w, 0.72, d), M.dark);
      add(sp, box(w * 0.88, 0.62, 0.012), M.cloth, 0, 0, d / 2 + 0.006);
      noShadow(add(sp, cyl(w * 0.3, w * 0.3, 0.014, 16), M.mid, 0, -0.12, d / 2 + 0.014, PI / 2, 0, 0));
      noShadow(add(sp, box(w * 0.5, 0.12, 0.014), M.mid, 0, 0.22, d / 2 + 0.014));
    },
    amp(g, W, D, it) {
      const v = it.v || "combo";
      if (v === "stack") {                               /* head on a 4×12 */
        const w = clamp(W, 0.55, 0.8), d = clamp(D, 0.3, 0.4), H = 0.76, z = d / 2;
        add(g, box(w, H, d), M.ebony, 0, H / 2 + 0.04, 0);
        add(g, box(w * 0.92, H * 0.9, 0.014), M.cloth, 0, H / 2 + 0.04, z + 0.007);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(p => { noShadow(add(g, cyl(w * 0.2, w * 0.2, 0.008, 16), M.mid, p[0] * w * 0.22, H / 2 + 0.04 + p[1] * H * 0.22, z + 0.016, PI / 2, 0, 0)); add(g, cyl(0.035, 0.035, 0.03, 8), M.dark, p[0] * (w / 2 - 0.07), 0.035, p[1] * (d / 2 - 0.06), 0, 0, PI / 2); });
        add(g, box(w * 0.94, 0.26, d * 0.85), M.ebony, 0, H + 0.04 + 0.13, 0);
        knobStrip(g, w * 0.94, H + 0.04 + 0.1, d * 0.425, 0.1); handle(g, w, H + 0.3);
      } else if (v === "leslie") {                       /* rotary speaker cabinet */
        const w = clamp(W, 0.6, 0.75), d = clamp(D, 0.45, 0.55), H = 1.04;
        add(g, box(w, H, d), M.walnut, 0, H / 2 + 0.03, 0);
        [0.92, 0.2].forEach(y => { for (let i = 0; i < 4; i++) noShadow(add(g, box(w * 0.82, 0.02, 0.02), M.ebony, 0, y - i * 0.045, d / 2 + 0.004, 0.5, 0, 0)); });
        add(g, box(w * 0.9, 0.3, 0.01), M.ebony, 0, 0.56, d / 2 + 0.002);
        const horn = grp(g, 0, 0.9, 0); noShadow(add(horn, box(0.3, 0.05, 0.05), M.dark));
        anim(t => (horn.rotation.y = t * 5));
      } else combo(g, W, D);
    },
    di(g, W, D) {
      const w = W * 0.8, d = D * 0.8;
      add(g, box(w, 0.09, d), M.clay, 0, 0.045, 0);
      add(g, box(w * 0.7, 0.012, d * 0.3), M.ebony, 0, 0.096, d * 0.15);
      [-1, 1].forEach(s => noShadow(add(g, cyl(0.014, 0.014, 0.02, 8), M.chrome, s * w * 0.22, 0.05, d / 2 + 0.008, PI / 2, 0, 0)));
      noShadow(add(g, box(0.012, 0.006, 0.012), M.led, w * 0.3, 0.096, -d * 0.25));
      noShadow(rod(g, M.ebony, [w * 0.22, 0.03, d / 2], [w * 0.5, 0.012, d / 2 + 0.25], 0.008));
    },
    power(g, W, D) {
      const w = W * 0.85, d = D * 0.85;
      add(g, box(w, 0.1, d), M.ebony, 0, 0.05, 0);
      const n = clamp(Math.round(w / 0.16), 2, 5);
      for (let i = 0; i < n; i++) noShadow(add(g, box(Math.min(0.11, (w / n) * 0.7), 0.02, Math.min(0.11, d * 0.5)), M.yellow, -w / 2 + (w * (i + 0.5)) / n, 0.105, 0));
      noShadow(rod(g, M.ebony, [-w / 2, 0.04, 0], [-w / 2 - 0.3, 0.012, -d * 0.4], 0.012));
    },
    sub(g, W, D) {
      const H = clamp(Math.min(W, D) * 0.95, 0.4, 0.8), r = Math.min(W, H) * 0.36;
      add(g, box(W, H, D), M.ebony, 0, H / 2 + 0.04, 0);
      add(g, box(W * 0.92, H * 0.9, 0.012), M.cloth, 0, H / 2 + 0.04, D / 2 + 0.006);
      noShadow(add(g, cyl(r, r, 0.012, 20), M.mid, 0, H / 2 + 0.04, D / 2 + 0.014, PI / 2, 0, 0));
      noShadow(add(g, cyl(r * 0.35, r * 0.35, 0.016, 12), M.dark, 0, H / 2 + 0.04, D / 2 + 0.018, PI / 2, 0, 0));
      [-1, 1].forEach(s => noShadow(add(g, box(0.012, H * 0.16, D * 0.3), M.steel, s * (W / 2 + 0.005), H * 0.62, 0)));
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(p => add(g, cyl(0.04, 0.04, 0.03, 8), M.dark, p[0] * (W / 2 - 0.07), 0.04, p[1] * (D / 2 - 0.07), 0, 0, PI / 2));
    },
    stool(g, W, D, it) {
      const s = fit(g, W, D, 0.5, 0.5, 0.6, 1.3);
      if (it.v === "chair") chair(s, 0, 0.04); else if (it.v === "bench") bench(s, 0, 0, 0.8); else barStool(s, 0, 0.03);
    },
    mstand(g) {
      tripod(g, 0, 0, 0.3, 0.26); add(g, cyl(0.012, 0.012, 0.85, 6), M.steel, 0, 0.7, 0);
      const d = grp(g, 0, 1.22, -0.03); d.rotation.x = 0.42;
      add(d, box(0.5, 0.34, 0.012), M.ebony);
      add(d, box(0.5, 0.02, 0.05), M.ebony, 0, -0.165, 0.025);
      noShadow(add(d, box(0.42, 0.29, 0.003), M.sheet, 0, 0.005, 0.009));
    },
    laptop(g, W, D) {
      const w = clamp(W * 0.9, 0.5, 1.4), d = clamp(D * 0.9, 0.35, 0.8), hw = w / 2 - 0.05;
      add(g, box(w, 0.03, d), M.ebony, 0, 0.83, 0);
      [-1, 1].forEach(s => {                             /* folding X-frame table */
        rod(g, M.steel, [s * hw, 0.02, -d / 2 + 0.04], [s * hw, 0.81, d / 2 - 0.04], 0.012);
        rod(g, M.steel, [s * hw, 0.02, d / 2 - 0.04], [s * hw, 0.81, -d / 2 + 0.04], 0.012);
      });
      rod(g, M.steel, [-hw, 0.02, -d / 2 + 0.04], [hw, 0.02, -d / 2 + 0.04], 0.012); rod(g, M.steel, [-hw, 0.02, d / 2 - 0.04], [hw, 0.02, d / 2 - 0.04], 0.012);
      const lx = w > 0.85 ? -w * 0.18 : 0;
      add(g, box(0.34, 0.014, 0.23), M.metal, lx, 0.852, 0.03);
      noShadow(add(g, box(0.3, 0.003, 0.11), M.ebony, lx, 0.86, 0.0));
      noShadow(add(g, box(0.1, 0.003, 0.06), M.steel, lx, 0.86, 0.1));
      const lid = grp(g, lx, 0.859, -0.085); lid.rotation.x = -0.32;
      add(lid, box(0.34, 0.225, 0.008), M.metal, 0, 0.1125, 0);
      noShadow(add(lid, box(0.315, 0.195, 0.002), M.screen, 0, 0.115, 0.0055));
      if (w > 0.85) {                                    /* audio interface next to it */
        add(g, box(0.26, 0.05, 0.17), M.clay, w * 0.24, 0.87, 0.02);
        for (let i = 0; i < 4; i++) noShadow(add(g, cyl(0.012, 0.012, 0.012, 8), M.chrome, w * 0.24 - 0.09 + i * 0.06, 0.9, 0.05));
        noShadow(add(g, box(0.01, 0.004, 0.01), M.led, w * 0.24 + 0.1, 0.897, -0.04));
      }
    },
    text(g, W, D, it) {
      const lbl = String(it.label || "").trim(); if (!lbl) return;
      const t = textTexture(lbl, { size: 56, color: "#f4f1e9", spacing: 3 });
      let h = D * 0.8, w = h * t.userData.aspect;
      if (w > W * 1.6) { w = W * 1.6; h = w / t.userData.aspect; }
      const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      me.rotation.x = -PI / 2; me.position.y = 0.012; me.userData.ownMat = true; g.add(me);
    },
    fallback(g, W, D) { add(g, box(W, 0.4, D), M.mid, 0, 0.2, 0); }
  };
  return BUILD;
}
