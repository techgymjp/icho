// 外苑いちょう並木　最後の一葉
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const ROW_X = [-15, -7, 7, 15];      // 4列のイチョウ
const PER_ROW = 37;                 // 4列 × 37本 ≒ 146本（端数は間引き）
const TREE_TOTAL = 146;
const SPACING = 8.4;
const LEAVES = 300;                 // 1本あたりの葉の房
const FALL_MAX = 4000;
const GROUND_MAX = 60000;
const PEOPLE_MAX = 220;
const DAY_SEC = 60;                 // 1分 = 1日
const START_HOUR = 9;

// ---------------------------------------------------------------------------
// レンダラー / シーン
// ---------------------------------------------------------------------------
const LOW = new URLSearchParams(location.search).get('q') === 'low' || matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: !LOW });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfd8e0, 60, 520);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);
camera.rotation.order = 'YXZ';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// テクスチャ
// ---------------------------------------------------------------------------
function leafTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 96;
  const g = c.getContext('2d');
  g.translate(64, 86);
  g.strokeStyle = '#efe2b0'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 8); g.lineTo(0, -10); g.stroke();
  const R = 72, a0 = -Math.PI * 0.82, a1 = -Math.PI * 0.18;
  g.beginPath(); g.moveTo(0, -8);
  for (let i = 0; i <= 80; i++) {
    const a = lerp(a0, a1, i / 80);
    let r = R * (1 + 0.025 * Math.sin(a * 46));
    r -= 26 * Math.max(0, 1 - Math.abs(a + Math.PI / 2) / 0.1); // 中央の切れ込み
    g.lineTo(Math.cos(a) * r, -8 + Math.sin(a) * r);
  }
  g.closePath();
  const grd = g.createRadialGradient(0, -8, 4, 0, -8, R);
  grd.addColorStop(0, '#f4ead0'); grd.addColorStop(1, '#ffffff');
  g.fillStyle = grd; g.fill();
  g.strokeStyle = 'rgba(120,90,0,0.18)'; g.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const a = lerp(a0 + 0.05, a1 - 0.05, i / 17);
    g.beginPath(); g.moveTo(0, -8); g.lineTo(Math.cos(a) * R * 0.92, -8 + Math.sin(a) * R * 0.92); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function noiseTexture(base, vary, size = 256, specks = 6000, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < specks; i++) {
    const v = (Math.random() - 0.5) * vary;
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)})`;
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(rep, rep);
  return t;
}
function tileTexture() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#b9ae98'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  g.strokeStyle = 'rgba(80,70,50,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke(); g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, s); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const LEAF_TEX = leafTexture();
const GLOW_TEX = glowTexture();

// ---------------------------------------------------------------------------
// 空・光
// ---------------------------------------------------------------------------
const skyUniforms = {
  uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.9, 0.7) }, uSunVis: { value: 1 },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunVis; varying vec3 vDir;
    void main(){ float h = max(vDir.y, 0.0); vec3 c = mix(uHor, uTop, pow(h, 0.55));
      float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
      c += uSunCol * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.35) * uSunVis;
      if (vDir.y < 0.0) c = uHor * 0.9;
      gl_FragColor = vec4(c, 1.0); }`,
}));
sky.renderOrder = -1;
scene.add(sky);

// 星
const stars = (() => {
  const n = 1200, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random(), v = rand(0.05, 1);
    const th = u * Math.PI * 2, r = Math.sqrt(1 - v * v);
    p[i * 3] = Math.cos(th) * r * 900; p[i * 3 + 1] = v * 900; p[i * 3 + 2] = Math.sin(th) * r * 900;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const s = new THREE.Points(g, m); scene.add(s); return s;
})();

const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a50, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// ---------------------------------------------------------------------------
// 地面・道路・建物
// ---------------------------------------------------------------------------
const AVE_START = 10, AVE_END = -312;
function groundY(x, z) {
  const ax = Math.abs(x);
  return (ax > 6 && ax < 18 && z < AVE_START && z > AVE_END) ? 0.12 : 0;
}

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
function addPlane(w, d, x, z, y, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
}
function addBox(w, h, d, x, y, z, mat, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
}

const grassTex = noiseTexture('#6d7a45', 0.25, 256, 9000, 120);
addPlane(2400, 2400, 0, -150, -0.02, lambert(0xffffff, { map: grassTex }));

const asphaltTex = noiseTexture('#4b4b50', 0.18, 256, 8000);
asphaltTex.repeat.set(3, 90);
addPlane(12, 340, 0, -155, 0.0, lambert(0xffffff, { map: asphaltTex }));
// 白線
const lineMat = lambert(0xe8e8e0);
for (const sx of [-5.6, 5.6]) addPlane(0.15, 322, sx, -151, 0.012, lineMat);
// 歩道（2面）
const tile = tileTexture();
tile.repeat.set(3, 80);
const walkMat = lambert(0xffffff, { map: tile });
for (const s of [-1, 1]) {
  addBox(12, 0.12, AVE_START - AVE_END, s * 12, 0.06, (AVE_START + AVE_END) / 2, walkMat, false);
  addBox(0.25, 0.16, AVE_START - AVE_END, s * 6.1, 0.08, (AVE_START + AVE_END) / 2, lambert(0xcfcac0), false);
  // 生け垣
  addBox(0.9, 0.9, AVE_START - AVE_END, s * 18.5, 0.45, (AVE_START + AVE_END) / 2, lambert(0x3e5a2a));
}
// 青山通り
const aoyamaTex = noiseTexture('#46464b', 0.18, 256, 8000); aoyamaTex.repeat.set(60, 6);
addPlane(600, 30, 0, 30, 0.005, lambert(0xffffff, { map: aoyamaTex }));
for (let i = -7; i <= 7; i++) addPlane(1.0, 5, i * 1.7, 17.5, 0.012, lineMat); // 横断歩道
for (let i = -30; i <= 30; i++) addPlane(4, 0.18, i * 10, 30, 0.012, lineMat);
// 青山側のビル
{
  const mats = [0x8d929a, 0xa7a49c, 0x6f7680, 0xbfb8aa, 0x9aa2a8].map((c) => lambert(c));
  for (let i = 0; i < 26; i++) {
    const w = rand(14, 30), h = rand(15, 70), d = rand(14, 24);
    const x = -200 + i * 16 + rand(-3, 3);
    addBox(w, h, d, x, h / 2, 60 + d / 2 + rand(0, 10), mats[i % mats.length]);
  }
}
// 円周道路と芝生広場
{
  const ring = new THREE.Mesh(new THREE.RingGeometry(26, 38, 64), lambert(0xffffff, { map: asphaltTex }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.004, -355); ring.receiveShadow = true; scene.add(ring);
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(26, 64), lambert(0x7fa04a));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.01, -355); lawn.receiveShadow = true; scene.add(lawn);
}
// 聖徳記念絵画館（ドームのある石造りの建物）
{
  const stone = lambert(0xcdbf9f), stoneDark = lambert(0xb3a585);
  const Z = -430;
  addBox(112, 14, 24, 0, 7, Z, stone);
  addBox(116, 1.2, 26, 0, 14.6, Z, stoneDark);
  addBox(116, 1.4, 26, 0, 0.7, Z, stoneDark);
  addBox(34, 22, 30, 0, 11, Z + 2, stone);
  addBox(36, 1.2, 32, 0, 22.4, Z + 2, stoneDark);
  for (let i = 0; i < 4; i++) { const s = 22 - i * 4.2; addBox(s, 2.6, s, 0, 24.3 + i * 2.6, Z + 2, i % 2 ? stoneDark : stone); }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone);
  dome.position.set(0, 34.4, Z + 2); dome.castShadow = true; scene.add(dome);
  for (let i = -5; i <= 5; i++) addBox(1.6, 11, 1.6, i * 2.8, 6.5, Z + 17.2, stoneDark); // 列柱
  addBox(18, 1.2, 8, 0, 0.6, Z + 19, stoneDark);
  for (let i = -1; i <= 1; i += 2) for (let k = 0; k < 9; k++) addBox(1.3, 9, 1.3, i * (24 + k * 3.5), 5.5, Z + 12.4, stoneDark);
}
// 背景の木々（並木の外側）
{
  const n = 520;
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geo, lambert(0xffffff), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * rand(24, 110), z = rand(-400, 5);
    const s = rand(3, 7);
    m.compose(new THREE.Vector3(x, s * 1.1, z), q, new THREE.Vector3(s, s * rand(1.1, 1.6), s));
    mesh.setMatrixAt(i, m);
    const r = Math.random();
    c.setHSL(r < 0.35 ? rand(0.1, 0.13) : rand(0.2, 0.3), rand(0.4, 0.7), rand(0.25, 0.42));
    mesh.setColorAt(i, c);
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
}

// 街灯
const LAMP_POS = [];
for (let z = 2; z > AVE_END; z -= 20) for (const s of [-1, 1]) LAMP_POS.push(new THREE.Vector3(s * 6.5, 0.12, z));
const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
{
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 5, 6).translate(0, 2.5, 0), lambert(0x2f3236), LAMP_POS.length);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 10, 8), lampHeadMat, LAMP_POS.length);
  const m = new THREE.Matrix4();
  LAMP_POS.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z); pole.setMatrixAt(i, m);
    m.makeTranslation(p.x, p.y + 5.1, p.z); head.setMatrixAt(i, m);
  });
  pole.castShadow = true;
  scene.add(pole, head);
}
const lampGlow = (() => {
  const p = new Float32Array(LAMP_POS.length * 3);
  LAMP_POS.forEach((v, i) => { p[i * 3] = v.x; p[i * 3 + 1] = v.y + 5.1; p[i * 3 + 2] = v.z; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd9a0, size: 3.2, map: GLOW_TEX, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pts); return pts;
})();

// ---------------------------------------------------------------------------
// イチョウ並木
// ---------------------------------------------------------------------------
const trees = [];
{
  const slots = [];
  for (let r = 0; r < ROW_X.length; r++) for (let j = 0; j < PER_ROW; j++) slots.push([r, j]);
  // 146本になるよう、外側の列の末尾を間引く
  while (slots.length > TREE_TOTAL) {
    const k = slots.findLastIndex(([r, j]) => (r === 0 || r === 3) && j === PER_ROW - 1);
    slots.splice(k >= 0 ? k : slots.length - 1, 1);
  }
  for (const [r, j] of slots) {
    const z = -4 - j * SPACING + rand(-0.3, 0.3);
    // 青山通り側から絵画館に向かって背が低くなるよう植えられている（遠近法の演出）
    const h = lerp(19, 13, j / (PER_ROW - 1)) + rand(-0.8, 0.8);
    const y0 = 2.4 + rand(-0.2, 0.3);
    const H = h - y0;
    trees.push({
      x: ROW_X[r] + rand(-0.15, 0.15), z, h, y0, H, R: H * rand(0.31, 0.36),
      start: trees.length * LEAVES, list: [], growList: null, growT: 0,
      rateMul: rand(0.7, 1.35), acc: 0, cooldown: 0, ratio: 1, dead: false,
    });
  }
}

// 葉の房（樹上）
const leafMat = new THREE.MeshLambertMaterial({ map: LEAF_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
const leafGeo = new THREE.PlaneGeometry(1, 0.75);
const N_TREE_LEAVES = trees.length * LEAVES;
const treeLeaves = new THREE.InstancedMesh(leafGeo, leafMat, N_TREE_LEAVES);
treeLeaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
treeLeaves.frustumCulled = false;
const lPos = new Float32Array(N_TREE_LEAVES * 3);
const lQuat = new Float32Array(N_TREE_LEAVES * 4);
const lScale = new Float32Array(N_TREE_LEAVES);
const attached = new Uint8Array(N_TREE_LEAVES);
const lColor = new Float32Array(N_TREE_LEAVES * 3);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function leafMatrix(i, k = 1) {
  _v.set(lPos[i * 3], lPos[i * 3 + 1], lPos[i * 3 + 2]);
  _q.set(lQuat[i * 4], lQuat[i * 4 + 1], lQuat[i * 4 + 2], lQuat[i * 4 + 3]);
  const s = lScale[i] * k; _s.set(s, s, s);
  return _m.compose(_v, _q, _s);
}
function ginkgoColor(c, ground = false) {
  const r = Math.random();
  if (ground) c.setHSL(rand(0.1, 0.135), rand(0.75, 0.95), rand(0.42, 0.56));
  else if (r < 0.05) c.setHSL(rand(0.15, 0.18), rand(0.6, 0.8), rand(0.42, 0.5));   // 少し青みの残る葉
  else c.setHSL(rand(0.115, 0.14), rand(0.85, 1.0), rand(0.48, 0.6));
  return c;
}

trees.forEach((t) => {
  for (let k = 0; k < LEAVES; k++) {
    const i = t.start + k;
    const s = 1 - Math.sqrt(Math.random());     // 下ほど密
    const y = t.y0 + s * t.H * 0.97;
    const rr = t.R * (1 - s) * rand(0.78, 1.06) + 0.25;
    const a = Math.random() * Math.PI * 2;
    lPos[i * 3] = t.x + Math.cos(a) * rr; lPos[i * 3 + 1] = y; lPos[i * 3 + 2] = t.z + Math.sin(a) * rr;
    _q.setFromEuler(_e.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)));
    lQuat.set([_q.x, _q.y, _q.z, _q.w], i * 4);
    lScale[i] = rand(0.75, 1.15);
    ginkgoColor(_c); lColor.set([_c.r, _c.g, _c.b], i * 3);
    treeLeaves.setColorAt(i, _c);
  }
});
scene.add(treeLeaves);

// 幹・枝・樹冠の芯
const barkMat = lambert(0x4a3a2c);
const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.42, 1, 8).translate(0, 0.5, 0), barkMat, trees.length);
const BR_PER = 14;
const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.09, 1, 5).translate(0, 0.5, 0), barkMat, trees.length * BR_PER);
const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 14).translate(0, 0.5, 0), lambert(0xd6a019), trees.length);
cones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
trunks.castShadow = branches.castShadow = cones.castShadow = true;
cones.receiveShadow = true;
trees.forEach((t, ti) => {
  _m.compose(_v.set(t.x, 0, t.z), _q.identity(), _s.set(1, t.h, 1)); trunks.setMatrixAt(ti, _m);
  for (let b = 0; b < BR_PER; b++) {
    const s = (b + Math.random()) / BR_PER;
    const y = t.y0 + s * t.H * 0.85;
    const len = t.R * (1 - s) * 0.95 + 0.4;
    const a = Math.random() * Math.PI * 2, up = rand(0.35, 0.8);
    const dir = _v.set(Math.cos(a) * Math.cos(up), Math.sin(up), Math.sin(a) * Math.cos(up)).normalize();
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    _m.compose(new THREE.Vector3(t.x, y, t.z), _q, _s.set(1, len, 1));
    branches.setMatrixAt(ti * BR_PER + b, _m);
  }
});
scene.add(trunks, branches, cones);
function updateCone(ti) {
  const t = trees[ti];
  const r = t.ratio;
  if (r < 0.06) { cones.setMatrixAt(ti, ZERO); }
  else {
    const f = 0.25 + 0.75 * r;
    _m.compose(_v.set(t.x, t.y0 + 0.2, t.z), _q.identity(), _s.set(t.R * 0.86 * f, t.H * (0.55 + 0.4 * f), t.R * 0.86 * f));
    cones.setMatrixAt(ti, _m);
  }
  cones.instanceMatrix.needsUpdate = true;
}

// てっぺんの目印
const apexGeo = new THREE.BufferGeometry();
const apexPos = new Float32Array(trees.length * 3), apexCol = new Float32Array(trees.length * 3);
trees.forEach((t, i) => { apexPos[i * 3] = t.x; apexPos[i * 3 + 1] = t.h + 0.7; apexPos[i * 3 + 2] = t.z; });
apexGeo.setAttribute('position', new THREE.BufferAttribute(apexPos, 3));
apexGeo.setAttribute('color', new THREE.BufferAttribute(apexCol, 3));
const apexMat = new THREE.PointsMaterial({ size: 2.4, map: GLOW_TEX, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
scene.add(new THREE.Points(apexGeo, apexMat));

// ---------------------------------------------------------------------------
// 舞い落ちる葉
// ---------------------------------------------------------------------------
const fallMesh = new THREE.InstancedMesh(leafGeo, leafMat, FALL_MAX);
fallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
fallMesh.frustumCulled = false;
const fPos = new Float32Array(FALL_MAX * 3), fRot = new Float32Array(FALL_MAX * 3), fSpin = new Float32Array(FALL_MAX * 3);
const fSpeed = new Float32Array(FALL_MAX), fPhase = new Float32Array(FALL_MAX), fScale = new Float32Array(FALL_MAX);
const fActive = new Uint8Array(FALL_MAX), fGold = new Uint8Array(FALL_MAX), fCaught = new Float32Array(FALL_MAX);
const fFree = []; for (let i = FALL_MAX - 1; i >= 0; i--) { fFree.push(i); fallMesh.setMatrixAt(i, ZERO); fallMesh.setColorAt(i, _c.set(1, 1, 1)); }
scene.add(fallMesh);
let fallColorDirty = false;

function spawnFalling(x, y, z, gold = false) {
  if (!fFree.length) return false;
  const i = fFree.pop();
  fActive[i] = 1; fGold[i] = gold ? 1 : 0; fCaught[i] = 0;
  fPos[i * 3] = x; fPos[i * 3 + 1] = y; fPos[i * 3 + 2] = z;
  for (let k = 0; k < 3; k++) { fRot[i * 3 + k] = rand(0, 6.28); fSpin[i * 3 + k] = rand(-4, 4); }
  fSpeed[i] = rand(0.8, 1.5); fPhase[i] = rand(0, 100);
  fScale[i] = gold ? 0.36 : rand(0.2, 0.28);
  if (gold) _c.setRGB(1.6, 1.25, 0.35); else ginkgoColor(_c);
  fallMesh.setColorAt(i, _c); fallColorDirty = true;
  return true;
}
function freeFalling(i) { fActive[i] = 0; fallMesh.setMatrixAt(i, ZERO); fFree.push(i); }

// 金の葉のきらめき
const SPARK_N = 64;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(SPARK_N * 3).fill(-999);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xfff1a0, size: 0.9, map: GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
sparks.frustumCulled = false; scene.add(sparks);

// 復活エフェクト
const BURST_N = 600;
const burstGeo = new THREE.BufferGeometry();
const burstPos = new Float32Array(BURST_N * 3).fill(-999), burstVel = new Float32Array(BURST_N * 3), burstLife = new Float32Array(BURST_N);
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
const burst = new THREE.Points(burstGeo, new THREE.PointsMaterial({ color: 0xffd84a, size: 0.7, map: GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
burst.frustumCulled = false; scene.add(burst);
let burstIdx = 0;
function doBurst(t) {
  for (let k = 0; k < 150; k++) {
    const i = burstIdx++ % BURST_N;
    const s = Math.random(), a = rand(0, 6.28);
    const y = t.y0 + s * t.H, r = t.R * (1 - s);
    burstPos.set([t.x + Math.cos(a) * r, y, t.z + Math.sin(a) * r], i * 3);
    burstVel.set([Math.cos(a) * rand(0.5, 2), rand(0.5, 2.5), Math.sin(a) * rand(0.5, 2)], i * 3);
    burstLife[i] = rand(1, 2);
  }
}

// ---------------------------------------------------------------------------
// 地面の落ち葉（黄金の絨毯）
// ---------------------------------------------------------------------------
const groundMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ map: LEAF_TEX, alphaTest: 0.5, side: THREE.DoubleSide }), GROUND_MAX);
groundMesh.receiveShadow = true;
groundMesh.frustumCulled = false;
for (let i = 0; i < GROUND_MAX; i++) { groundMesh.setMatrixAt(i, ZERO); groundMesh.setColorAt(i, _c.set(1, 1, 1)); }
scene.add(groundMesh);
let groundIdx = 0;
function addGroundLeaf(x, z, scale = rand(0.2, 0.3), fullUpload = false) {
  const i = groundIdx; groundIdx = (groundIdx + 1) % GROUND_MAX;
  const y = groundY(x, z) + 0.012 + Math.random() * 0.02;
  _q.setFromEuler(_e.set(-Math.PI / 2 + rand(-0.25, 0.25), rand(-0.25, 0.25), rand(0, 6.28)));
  _m.compose(_v.set(x, y, z), _q, _s.set(scale, scale, scale));
  groundMesh.setMatrixAt(i, _m);
  groundMesh.setColorAt(i, ginkgoColor(_c, true));
  if (!fullUpload) {
    groundMesh.instanceMatrix.addUpdateRange(i * 16, 16);
    groundMesh.instanceColor.addUpdateRange(i * 3, 3);
    groundMesh.instanceMatrix.needsUpdate = true;
    groundMesh.instanceColor.needsUpdate = true;
  }
}
function scatterInitialGround() {
  for (let k = 0; k < 20000; k++) {
    const t = trees[(Math.random() * trees.length) | 0];
    const a = rand(0, 6.28), r = Math.abs(rand(0, 1) + rand(0, 1) - 1) * 7;
    let x = t.x + Math.cos(a) * r; const z = t.z + Math.sin(a) * r;
    if (Math.abs(x) < 4.5 && Math.random() < 0.7) x = Math.sign(x || 1) * rand(4.5, 6); // 車道の落ち葉は端に寄る
    addGroundLeaf(clamp(x, -18, 18), z, undefined, true);
  }
  groundMesh.instanceMatrix.needsUpdate = true;
  groundMesh.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// 歩く人々
// ---------------------------------------------------------------------------
const bodyMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.85, 4, 8).translate(0, 0.66, 0), lambert(0xffffff), PEOPLE_MAX);
const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.5, 0), lambert(0xe6c4a4), PEOPLE_MAX);
bodyMesh.castShadow = headMesh.castShadow = true;
bodyMesh.frustumCulled = headMesh.frustumCulled = false;
bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
headMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const COATS = [0x2b2b33, 0x7a2e2e, 0x3d4a6b, 0xc9b79a, 0x5b4636, 0x8c8c8c, 0x1f3d34, 0xd9d2c5, 0x9b5a2a, 0x6b3b5e];
const people = [];
for (let i = 0; i < PEOPLE_MAX; i++) {
  people.push({ active: false, x: 0, z: 0, dir: 1, speed: 1, phase: 0, stop: 0, leaving: false, h: 1 });
  bodyMesh.setMatrixAt(i, ZERO); headMesh.setMatrixAt(i, ZERO);
  bodyMesh.setColorAt(i, _c.setHex(COATS[i % COATS.length]));
}
scene.add(bodyMesh, headMesh);
const LANES = [[8.3, 13.7], [-13.7, -8.3], [15.8, 17.6], [-17.6, -15.8]];
function spawnPerson(p, nearPlayer) {
  const lane = LANES[Math.random() < 0.8 ? (Math.random() < 0.5 ? 0 : 1) : (Math.random() < 0.5 ? 2 : 3)];
  p.x = rand(lane[0], lane[1]);
  p.dir = Math.random() < 0.5 ? 1 : -1;
  // 遠くの見えにくい場所に出現させる
  let z = 0;
  for (let k = 0; k < 6; k++) { z = rand(AVE_END + 2, AVE_START - 2); if (Math.abs(z - player.pos.z) > 45 || nearPlayer) break; }
  if (Math.abs(z - player.pos.z) <= 45 && !nearPlayer) z = Math.random() < 0.5 ? AVE_START - 1 : AVE_END + 1;
  p.z = z;
  p.speed = rand(0.9, 1.5); p.phase = rand(0, 10); p.stop = 0; p.leaving = false; p.h = rand(0.88, 1.08);
  p.active = true;
}
function hourFactor(h) {
  if (h < 4.5) return 0.03;
  if (h < 7) return lerp(0.03, 0.3, (h - 4.5) / 2.5);
  if (h < 10) return lerp(0.3, 1, (h - 7) / 3);
  if (h < 16) return 1;
  if (h < 19) return lerp(1, 0.75, (h - 16) / 3);
  if (h < 22) return lerp(0.75, 0.3, (h - 19) / 3);
  return lerp(0.3, 0.03, (h - 22) / 2);
}
let peopleTarget = 0;
function updatePeople(dt, totalRatio, hour) {
  peopleTarget = Math.round(PEOPLE_MAX * Math.pow(totalRatio, 0.9) * hourFactor(hour));
  let active = 0;
  for (const p of people) if (p.active && !p.leaving) active++;
  if (active < peopleTarget) {
    const n = Math.min(3, peopleTarget - active);
    for (let k = 0, c = 0; k < people.length && c < n; k++) if (!people[k].active) { spawnPerson(people[k], false); c++; }
  } else if (active > peopleTarget + 2) {
    for (let k = 0, c = 0; k < people.length && c < active - peopleTarget; k++) if (people[k].active && !people[k].leaving) { people[k].leaving = true; c++; }
  }
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    if (!p.active) continue;
    if (p.stop > 0) p.stop -= dt;
    else {
      p.z += p.dir * p.speed * dt * -1;
      p.phase += dt * p.speed * 5;
      if (Math.random() < dt * 0.02) p.stop = rand(2, 6); // 立ち止まって写真を撮る
    }
    const far = Math.abs(p.z - player.pos.z) > 40 || Math.abs(p.x - player.pos.x) > 40;
    if (p.z > AVE_START - 0.5 || p.z < AVE_END + 0.5) {
      if (p.leaving || Math.random() < 0.5) { p.active = false; }
      else p.dir *= -1, p.z = clamp(p.z, AVE_END + 0.6, AVE_START - 0.6);
    }
    if (p.leaving && far) p.active = false;
    if (!p.active) { bodyMesh.setMatrixAt(i, ZERO); headMesh.setMatrixAt(i, ZERO); continue; }
    const bob = p.stop > 0 ? 0 : Math.abs(Math.sin(p.phase)) * 0.05;
    const yaw = p.stop > 0 ? (p.x > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    _q.setFromAxisAngle(_v.set(0, 1, 0), yaw);
    _m.compose(_v.set(p.x, groundY(p.x, p.z) + bob, p.z), _q, _s.set(p.h, p.h, p.h));
    bodyMesh.setMatrixAt(i, _m); headMesh.setMatrixAt(i, _m);
  }
  bodyMesh.instanceMatrix.needsUpdate = true; headMesh.instanceMatrix.needsUpdate = true;
  bodyMesh.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// プレイヤー
// ---------------------------------------------------------------------------
const GRAV = 14;
const JUMP_MIN = 0.8, JUMP_MAX = 20.5;   // ためジャンプの高さ（MAXで木のてっぺんに届く）
const CHARGE_SEC = 1.1;
const player = { pos: new THREE.Vector3(0, 0, 6), vy: 0, yaw: 0, pitch: 0.05, charge: 0, onGround: true, climbing: null, riding: null };
const keys = {};
let jumpHeld = false;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') { jumpHeld = true; e.preventDefault(); }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Space') jumpHeld = false; });

// 足もとで乗れる面（地面・イチョウの樹冠・車の屋根）
function supportAt(x, z, maxY) {
  let y = groundY(x, z), car = null;
  for (const t of trees) {
    const dx = x - t.x, dz = z - t.z;
    if (Math.abs(dx) > t.R + 0.5 || Math.abs(dz) > t.R + 0.5 || t.ratio < 0.08) continue;
    const d = Math.hypot(dx, dz);
    if (d > t.R + 0.3) continue;
    const ys = Math.min(t.h - 0.2, t.y0 + t.H * (1 - Math.max(0, d - 0.3) / t.R));
    if (ys <= maxY && ys > y) { y = ys; car = null; }
  }
  for (const c of cars) {
    if (!c.active) continue;
    const dx = x - c.x, dz = (z - c.z) * -c.dir; // 後ろ向きが +
    if (Math.abs(dx) > c.spec.W / 2 || Math.abs(dz) > c.spec.L / 2) continue;
    const top = Math.abs(dz - c.spec.cabOff) < c.spec.cabL / 2 ? c.spec.roof : c.spec.bodyTop;
    if (top <= maxY && top > y) { y = top; car = c; }
  }
  return { y, car };
}

function updatePlayer(dt) {
  const p = player.pos;
  let fx = 0, fz = 0;
  if (keys.KeyW || keys.ArrowUp) fz += 1;
  if (keys.KeyS || keys.ArrowDown) fz -= 1;
  if (keys.KeyA || keys.ArrowLeft) fx -= 1;
  if (keys.KeyD || keys.ArrowRight) fx += 1;
  fx += touch.mx; fz += touch.my;
  const len = Math.hypot(fx, fz);
  if (len > 1) { fx /= len; fz /= len; }
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const prevY = p.y;

  // 車に乗っていれば一緒に運ばれる
  if (player.riding && player.riding.active) p.z += player.riding.v * player.riding.dir * dt;

  // ためジャンプ
  const canJump = player.onGround || player.climbing;
  if (jumpHeld && canJump) player.charge = Math.min(1, player.charge + dt / CHARGE_SEC);
  if (!jumpHeld && player.charge > 0) {
    if (canJump) {
      const h = lerp(JUMP_MIN, JUMP_MAX, player.charge);
      player.vy = Math.sqrt(2 * GRAV * h);
      if (player.climbing) { // 幹を蹴って後ろへ
        p.x -= Math.sin(-player.yaw) * 0.3; p.z -= -Math.cos(player.yaw) * 0.3;
      }
      player.climbing = null; player.riding = null; player.onGround = false;
      sfx.jump(player.charge);
    }
    player.charge = 0;
  }

  // 木登り：幹に向かって前進すると登る
  if (!player.climbing && fz > 0.3) {
    for (const t of trees) {
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      if (d < 1.0 && p.y < t.h - 0.6) {
        const facing = (dx * -sy + dz * -cy) / Math.max(d, 1e-3);
        if (facing > 0.2) { player.climbing = t; player.riding = null; break; }
      }
    }
  }

  if (player.climbing) {
    const t = player.climbing;
    if (Math.abs(fx) > 0.7 && fz < 0.3) { player.climbing = null; } // 横に動くと手を離す
    else {
      if (fz > 0.3) p.y += 4 * dt;
      else if (fz < -0.3) p.y -= 4 * dt;
      p.y = Math.min(p.y, t.h - 0.4);
      player.vy = 0;
      let dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz) || 1;
      p.x = t.x + dx / d * 0.75; p.z = t.z + dz / d * 0.75;
      const gy = groundY(p.x, p.z);
      if (p.y <= gy) { p.y = gy; if (fz < -0.3) player.climbing = null; }
      player.onGround = false;
    }
  }

  if (!player.climbing) {
    const speed = (keys.ShiftLeft || keys.ShiftRight) ? 8 : 4.5;
    p.x += (fx * cy - fz * sy) * speed * dt;
    p.z += (-fx * sy - fz * cy) * speed * dt;
    player.vy = Math.max(player.vy - GRAV * dt, -26);
    p.y += player.vy * dt;
  }
  if (p.y > 40) { p.y = 40; player.vy = 0; }

  // 範囲
  if (p.z > AVE_END - 2) p.x = clamp(p.x, -17.7, 17.7);
  else p.x = clamp(p.x, -45, 45);
  p.z = clamp(p.z, -412, 14);
  // 幹との当たり（樹冠より下）
  if (p.y < 2.5 && !player.climbing) for (const t of trees) {
    const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz);
    if (d < 0.7 && d > 1e-4) { p.x = t.x + dx / d * 0.7; p.z = t.z + dz / d * 0.7; }
  }

  // 着地判定
  if (!player.climbing) {
    const sup = supportAt(p.x, p.z, Math.max(prevY, p.y) + 0.45);
    if (player.vy <= 0 && p.y <= sup.y) {
      if (!player.onGround && player.vy < -12) sfx.land();
      p.y = sup.y; player.vy = 0; player.onGround = true; player.riding = sup.car;
    } else if (p.y > sup.y + 0.05) { player.onGround = false; player.riding = null; }
  }

  const bob = player.onGround && len > 0 ? Math.sin(performance.now() / 120) * 0.04 : 0;
  camera.position.set(p.x, p.y + 1.6 + bob - player.charge * 0.35, p.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

// ---------------------------------------------------------------------------
// 車道を走る車（外車が多い）
// ---------------------------------------------------------------------------
const CAR_SPECS = {
  sedan: { L: 4.9, W: 1.86, bodyBot: 0.3, bodyTop: 1.0, roof: 1.47, cabL: 2.6, cabOff: 0.25, cabW: 1.6 },
  coupe: { L: 4.5, W: 1.95, bodyBot: 0.22, bodyTop: 0.82, roof: 1.25, cabL: 1.9, cabOff: 0.35, cabW: 1.55 },
  suv:   { L: 4.9, W: 1.98, bodyBot: 0.38, bodyTop: 1.3, roof: 1.9, cabL: 3.0, cabOff: 0.35, cabW: 1.75 },
  wagon: { L: 4.95, W: 1.86, bodyBot: 0.3, bodyTop: 1.0, roof: 1.5, cabL: 3.2, cabOff: 0.65, cabW: 1.62 },
};
const CAR_TYPES = ['sedan', 'sedan', 'coupe', 'suv', 'suv', 'wagon'];
const CAR_COLORS = [0xc3c7cc, 0x121316, 0x121316, 0xf1f1ee, 0x1d2f5a, 0x8f1717, 0x26392f, 0x5a5f66, 0x6b6e73];
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
const tireMat = lambert(0x161616), rimMat = lambert(0xb9bcc0), chromeMat = lambert(0xd6d8da);
const headMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
const tailMat = new THREE.MeshBasicMaterial({ color: 0x661010 });
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16).rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 10).rotateZ(Math.PI / 2);
function makeCar(type, color) {
  const s = CAR_SPECS[type], g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0x666666 });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  // 車体（前が -z）
  box(s.W, s.bodyTop - s.bodyBot, s.L, 0, (s.bodyTop + s.bodyBot) / 2, 0, paint);
  // ボンネットのなだらかな段差
  box(s.W * 0.96, 0.06, s.L * 0.3, 0, s.bodyTop + 0.02, -s.L * 0.3, paint);
  // キャビン（ガラス + 屋根）
  const cabH = s.roof - s.bodyTop;
  box(s.cabW, cabH * 0.8, s.cabL, 0, s.bodyTop + cabH * 0.4, s.cabOff, glassMat);
  box(s.cabW * 0.98, cabH * 0.22, s.cabL * 0.86, 0, s.roof - cabH * 0.11, s.cabOff + 0.05, paint);
  // ピラー
  for (const sx of [-1, 1]) box(0.06, cabH * 0.8, 0.12, sx * s.cabW / 2, s.bodyTop + cabH * 0.4, s.cabOff, paint);
  // ライト・グリル
  for (const sx of [-1, 1]) {
    box(0.42, 0.12, 0.05, sx * (s.W / 2 - 0.3), s.bodyTop - 0.15, -s.L / 2 - 0.01, headMat);
    box(0.4, 0.12, 0.05, sx * (s.W / 2 - 0.3), s.bodyTop - 0.12, s.L / 2 + 0.01, tailMat);
  }
  box(s.W * 0.36, 0.2, 0.05, 0, s.bodyTop - 0.28, -s.L / 2 - 0.01, chromeMat);
  // タイヤ
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, tireMat); w.position.set(sx * (s.W / 2 - 0.08), 0.36, sz * s.L * 0.32); w.castShadow = true; g.add(w);
    const r = new THREE.Mesh(rimGeo, rimMat); r.position.copy(w.position); g.add(r);
  }
  g.visible = false;
  scene.add(g);
  return g;
}
const LANES_CAR = [{ x: -2.8, dir: -1 }, { x: 2.8, dir: 1 }]; // 左側通行：絵画館方面(-z)は左車線
const CAR_Z_NEAR = 14, CAR_Z_FAR = -324;
const cars = [];
for (let i = 0; i < 16; i++) {
  const type = CAR_TYPES[i % CAR_TYPES.length];
  cars.push({ active: false, type, spec: CAR_SPECS[type], mesh: makeCar(type, CAR_COLORS[(i * 5) % CAR_COLORS.length]), x: 0, z: 0, dir: 1, v: 10, vMax: 10, honk: 0 });
}
function carFactor(h) { return clamp(hourFactor(h) * 1.1, 0.2, 1); }
function updateCars(dt, hour, allowHit) {
  const target = Math.round(5 * carFactor(hour));
  for (const lane of LANES_CAR) {
    const inLane = cars.filter((c) => c.active && c.x === lane.x);
    const spawnZ = lane.dir < 0 ? CAR_Z_NEAR : CAR_Z_FAR;
    const clear = inLane.every((c) => Math.abs(c.z - spawnZ) > 28);
    if (inLane.length < target && clear && Math.random() < dt * 0.8) {
      const c = cars.find((k) => !k.active);
      if (c) {
        c.active = true; c.x = lane.x; c.dir = lane.dir; c.z = spawnZ;
        c.vMax = c.type === 'coupe' ? rand(11, 14) : rand(8.5, 12); c.v = c.vMax; c.honk = 0;
        c.mesh.visible = true; c.mesh.rotation.y = lane.dir < 0 ? 0 : Math.PI;
      }
    }
  }
  const p = player.pos;
  for (const c of cars) {
    if (!c.active) continue;
    // 前の車との車間
    let v = c.vMax;
    for (const o of cars) {
      if (o === c || !o.active || o.x !== c.x) continue;
      const gap = (c.z - o.z) * -c.dir;
      if (gap > 0 && gap < 14) v = Math.min(v, o.v * (gap / 14));
    }
    c.v = lerp(c.v, v, Math.min(1, dt * 2));
    c.z += c.v * c.dir * dt;
    if ((c.dir < 0 && c.z < CAR_Z_FAR) || (c.dir > 0 && c.z > CAR_Z_NEAR)) {
      c.active = false; c.mesh.visible = false; if (player.riding === c) player.riding = null; continue;
    }
    c.mesh.position.set(c.x, 0, c.z);
    // 歩行者に気づいてクラクション
    c.honk -= dt;
    const ahead = (p.z - c.z) * c.dir;
    if (allowHit && c.honk <= 0 && Math.abs(p.x - c.x) < 1.8 && ahead > 3 && ahead < 22 && p.y < c.spec.roof) { sfx.horn(); c.honk = 4; }
  }
}
// 車との衝突（屋根の上に乗っているなら安全）
function carHitsPlayer() {
  const p = player.pos;
  for (const c of cars) {
    if (!c.active || player.riding === c) continue;
    const dx = Math.abs(p.x - c.x), dz = Math.abs(p.z - c.z);
    if (dx < c.spec.W / 2 + 0.25 && dz < c.spec.L / 2 + 0.25 && p.y < c.spec.bodyTop - 0.25 && p.y + 1.7 > 0.2) return true;
    if (dx < c.spec.W / 2 + 0.25 && Math.abs((p.z - c.z) * -c.dir - c.spec.cabOff) < c.spec.cabL / 2 && p.y < c.spec.roof - 0.4 && p.y >= c.spec.bodyTop - 0.25 && !player.onGround) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 視点操作（ポインターロック / ドラッグ / タッチ）
const canvas = renderer.domElement;
let locked = false, dragMode = false, dragging = false, dragMoved = 0, lastX = 0, lastY = 0;
const look = (dx, dy, k = 0.0022) => {
  player.yaw -= dx * k;
  player.pitch = clamp(player.pitch - dy * k, -1.45, 1.45);
};
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && state === 'play' && !dragMode && !isTouch) pauseGame();
});
document.addEventListener('pointerlockerror', () => { dragMode = true; });
document.addEventListener('mousemove', (e) => {
  if (state !== 'play') return;
  if (locked) look(e.movementX, e.movementY);
  else if (dragging) { look(e.clientX - lastX, e.clientY - lastY, 0.004); dragMoved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; }
});
canvas.addEventListener('mousedown', (e) => {
  if (state !== 'play' || isTouch) return;
  if (locked) { tryCatch(); return; }
  dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY;
});
addEventListener('mouseup', () => {
  if (dragging && dragMoved < 6 && state === 'play') tryCatch();
  dragging = false;
});

// タッチ
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const touch = { mx: 0, my: 0, stickId: null, lookId: null, lx: 0, ly: 0, moved: 0, sx: 0, sy: 0 };
const stick = $('stick'), knob = $('knob');
canvas.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.4 && touch.stickId === null) {
      touch.stickId = t.identifier;
      const r = stick.getBoundingClientRect(); touch.sx = r.left + r.width / 2; touch.sy = r.top + r.height / 2;
    } else if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; touch.moved = 0; }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.stickId) {
      let dx = (t.clientX - touch.sx) / 50, dy = (t.clientY - touch.sy) / 50;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      touch.mx = dx; touch.my = -dy;
      knob.style.transform = `translate(${dx * 35}px,${dy * 35}px)`;
    } else if (t.identifier === touch.lookId) {
      look(t.clientX - touch.lx, t.clientY - touch.ly, 0.005);
      touch.moved += Math.abs(t.clientX - touch.lx) + Math.abs(t.clientY - touch.ly);
      touch.lx = t.clientX; touch.ly = t.clientY;
    }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.stickId) { touch.stickId = null; touch.mx = touch.my = 0; knob.style.transform = ''; }
    else if (t.identifier === touch.lookId) { if (touch.moved < 10 && state === 'play') tryCatch(); touch.lookId = null; }
  }
});
const btnJump = $('btnJump');
btnJump.addEventListener('touchstart', (e) => { jumpHeld = true; e.preventDefault(); }, { passive: false });
btnJump.addEventListener('touchend', () => { jumpHeld = false; });

// ---------------------------------------------------------------------------
// 葉をつかむ
// ---------------------------------------------------------------------------
const _fw = new THREE.Vector3(), _d = new THREE.Vector3();
function findCatchable() {
  camera.getWorldDirection(_fw);
  let best = -1, bestScore = 1;
  for (let i = 0; i < FALL_MAX; i++) {
    if (!fActive[i] || fCaught[i] > 0) continue;
    _d.set(fPos[i * 3] - camera.position.x, fPos[i * 3 + 1] - camera.position.y, fPos[i * 3 + 2] - camera.position.z);
    const dist = _d.length();
    if (dist > 6.5 || dist < 0.05) continue;
    const ang = Math.acos(clamp(_d.dot(_fw) / dist, -1, 1));
    const thr = 0.07 + 0.32 / Math.max(dist, 0.6);
    const s = ang / thr;
    if (s < bestScore) { bestScore = s; best = i; }
  }
  return best;
}
let caught = 0, golds = 0, restored = 0, combo = 0, lastCatch = -10;
function tryCatch() {
  const i = findCatchable();
  if (i < 0) return;
  fCaught[i] = 0.001;
  const now = elapsed;
  combo = now - lastCatch < 2.5 ? combo + 1 : 1; lastCatch = now;
  if (fGold[i]) { caught += 10; golds++; toast('金の葉をつかんだ！ 願いが叶うかも'); sfx.gold(); }
  else { caught++; sfx.catch(combo); if (combo >= 3) toast(`連続 ${combo}枚！`, 900); }
}

// ---------------------------------------------------------------------------
// トースト / HUD
// ---------------------------------------------------------------------------
let toastTimer = 0;
function toast(msg, ms = 1800) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
const mm = $('minimap'), mctx = mm.getContext('2d');
function drawMinimap() {
  const W = mm.width, H = mm.height;
  mctx.clearRect(0, 0, W, H);
  const mx = (x) => (x + 20) / 40 * W;
  const mz = (z) => H - 10 - (z - 8) / (AVE_END - 8 - 6) * -(H - 20) * -1 * -1;
  const zz = (z) => 10 + (z - AVE_END + 4) / (AVE_START - AVE_END + 4) * (H - 20);
  mctx.fillStyle = 'rgba(80,80,90,.6)'; mctx.fillRect(mx(-6), 6, mx(6) - mx(-6), H - 12);
  for (const t of trees) {
    const r = t.ratio;
    mctx.fillStyle = r <= 0 ? 'rgba(90,70,50,.9)' : `hsl(${lerp(0, 48, Math.min(1, r * 1.6))},${r < 0.3 ? 95 : 90}%,${r < 0.3 ? 55 : 55}%)`;
    mctx.beginPath(); mctx.arc(mx(t.x), zz(t.z), r <= 0 ? 1.5 : 2.4, 0, 6.29); mctx.fill();
  }
  // プレイヤー
  const px = mx(clamp(player.pos.x, -20, 20)), pz = zz(clamp(player.pos.z, AVE_END - 4, AVE_START));
  mctx.save(); mctx.translate(px, pz); mctx.rotate(-player.yaw);
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4, 4); mctx.lineTo(-4, 4); mctx.closePath(); mctx.fill();
  mctx.restore();
  void mz;
}
function dayLabel(t) {
  const totalH = START_HOUR + t / DAY_SEC * 24;
  const day = Math.floor(totalH / 24) + 1, h = totalH % 24;
  const hh = Math.floor(h), mm2 = Math.floor((h - hh) * 60);
  return { day, hour: h, text: `${day}日目 ${hh}:${String(mm2).padStart(2, '0')}` };
}

// ---------------------------------------------------------------------------
// 昼夜サイクル（1分 = 1日）
// ---------------------------------------------------------------------------
const C = (r, g, b) => new THREE.Color(r, g, b);
const SKY = {
  dayTop: C(0.22, 0.46, 0.82), dayHor: C(0.80, 0.87, 0.93),
  duskTop: C(0.25, 0.28, 0.5), duskHor: C(0.98, 0.58, 0.32),
  nightTop: C(0.01, 0.015, 0.05), nightHor: C(0.05, 0.06, 0.12),
};
const _top = new THREE.Color(), _hor = new THREE.Color(), _sunDir = new THREE.Vector3();
let nightF = 0;
function updateSky(hour) {
  const a = (hour - 6) / 12 * Math.PI; // 6時に日の出、18時に日没
  _sunDir.set(-Math.cos(a) * 0.8, Math.sin(a) * 0.7, -0.45).normalize();
  const sy = _sunDir.y;
  const dayF = smooth(-0.1, 0.18, sy);
  const duskF = clamp(1 - Math.abs(sy - 0.02) / 0.22, 0, 1);
  nightF = 1 - dayF;
  _top.copy(SKY.nightTop).lerp(SKY.dayTop, dayF).lerp(SKY.duskTop, duskF * 0.5);
  _hor.copy(SKY.nightHor).lerp(SKY.dayHor, dayF).lerp(SKY.duskHor, duskF * 0.75);
  skyUniforms.uTop.value.copy(_top); skyUniforms.uHor.value.copy(_hor);
  skyUniforms.uSunDir.value.copy(_sunDir);
  skyUniforms.uSunVis.value = smooth(-0.05, 0.03, sy);
  skyUniforms.uSunCol.value.setRGB(1, lerp(0.9, 0.55, duskF), lerp(0.7, 0.3, duskF));
  scene.fog.color.copy(_hor);
  scene.fog.near = lerp(30, 60, dayF); scene.fog.far = lerp(260, 520, dayF);
  stars.material.opacity = smooth(0.3, 1, nightF);

  // 太陽 or 月
  const usingSun = sy > -0.04;
  const L = usingSun ? _sunDir : _v.copy(_sunDir).multiplyScalar(-1);
  sun.position.copy(player.pos).addScaledVector(L, 150);
  sun.target.position.copy(player.pos);
  if (usingSun) {
    sun.intensity = 2.6 * smooth(-0.04, 0.2, sy);
    sun.color.setRGB(1, lerp(0.94, 0.62, duskF), lerp(0.84, 0.4, duskF));
  } else {
    sun.intensity = 0.35 * smooth(-0.04, -0.2, sy);
    sun.color.setRGB(0.6, 0.7, 1.0);
  }
  hemi.intensity = lerp(0.28, 1.0, dayF);
  hemi.color.setRGB(lerp(0.35, 0.81, dayF), lerp(0.42, 0.89, dayF), lerp(0.7, 1.0, dayF));
  // 夜はライトアップ
  const lightUp = smooth(0.35, 0.8, nightF);
  leafMat.emissive.setRGB(0.16 * lightUp, 0.09 * lightUp, 0.0);
  cones.material.emissive.setRGB(0.07 * lightUp, 0.04 * lightUp, 0.0);
  headMat.color.setRGB(lerp(0.75, 1.6, lightUp), lerp(0.75, 1.5, lightUp), lerp(0.75, 1.2, lightUp));
  tailMat.color.setRGB(lerp(0.4, 1.4, lightUp), 0.05, 0.05);
  lampHeadMat.color.setRGB(lerp(0.35, 1.0, lightUp), lerp(0.35, 0.86, lightUp), lerp(0.35, 0.6, lightUp));
  lampGlow.material.opacity = lightUp * 0.9;
  return { dayF, lightUp };
}

// ---------------------------------------------------------------------------
// サウンド（WebAudio）
// ---------------------------------------------------------------------------
const sfx = (() => {
  let ctx = null, windGain = null, windFilter = null;
  function init() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 500;
    windGain = ctx.createGain(); windGain.gain.value = 0.15;
    src.connect(windFilter).connect(windGain).connect(ctx.destination); src.start();
  }
  function tone(freq, t0, dur, vol = 0.12, type = 'sine') {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + t0);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.05);
  }
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
  return {
    init,
    resume() { ctx && ctx.state === 'suspended' && ctx.resume(); },
    wind(level) { if (windGain) { windGain.gain.setTargetAtTime(0.08 + level * 0.3, ctx.currentTime, 0.5); windFilter.frequency.setTargetAtTime(350 + level * 900, ctx.currentTime, 0.5); } },
    catch(c) { tone(PENTA[Math.min(c - 1, PENTA.length - 1)], 0, 0.6, 0.1); },
    gold() { [0, 2, 4, 5, 7].forEach((n, k) => tone(PENTA[n], k * 0.07, 0.9, 0.09, 'triangle')); },
    restore() { [0, 2, 4, 7].forEach((n, k) => tone(PENTA[n] / 2, k * 0.09, 1.4, 0.1, 'triangle')); },
    fall() { tone(220, 0, 1.2, 0.06, 'sine'); tone(174.6, 0.15, 1.5, 0.05); },
    jump(c) { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(240 + c * 200, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(480 + c * 700, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.07, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.35); },
    land() { tone(90, 0, 0.25, 0.12, 'triangle'); },
    horn() { tone(415, 0, 0.5, 0.05, 'square'); tone(523, 0, 0.5, 0.04, 'square'); },
    crash() { tone(110, 0, 0.6, 0.2, 'sawtooth'); tone(70, 0.05, 0.8, 0.2, 'square'); },
  };
})();

// ---------------------------------------------------------------------------
// ゲーム進行
// ---------------------------------------------------------------------------
let state = 'title', elapsed = 0, endTimer = 0;
const wind = { x: 0.4, z: -0.2, gust: 0, nextGust: 18 };
let lastPhase = '', lightupToasted = -1, lastAlive = trees.length, lastLeafToasted = false;

function resetGame() {
  elapsed = 0; caught = 0; golds = 0; restored = 0; combo = 0; endTimer = 0; lastLeafToasted = false;
  player.pos.set(0, 0.12, 6); player.pos.x = 9; player.vy = 0; player.yaw = 0; player.pitch = 0.08; player.charge = 0; player.climbing = null; player.riding = null; player.onGround = true;
  cars.forEach((c) => { c.active = false; c.mesh.visible = false; });
  for (let i = 0; i < FALL_MAX; i++) if (fActive[i]) freeFalling(i);
  for (let i = 0; i < GROUND_MAX; i++) groundMesh.setMatrixAt(i, ZERO);
  groundIdx = 0;
  scatterInitialGround();
  trees.forEach((t, ti) => {
    t.list.length = 0; t.growList = null; t.cooldown = 0; t.acc = 0; t.dead = false;
    const keep = Math.floor(LEAVES * rand(0.6, 1.0)); // 散り具合はまちまち
    for (let k = 0; k < LEAVES; k++) {
      const i = t.start + k;
      if (k < keep) { attached[i] = 1; t.list.push(i); treeLeaves.setMatrixAt(i, leafMatrix(i)); }
      else { attached[i] = 0; treeLeaves.setMatrixAt(i, ZERO); }
    }
    t.ratio = t.list.length / LEAVES;
    updateCone(ti);
  });
  treeLeaves.instanceMatrix.needsUpdate = true;
  people.forEach((p, i) => { p.active = false; bodyMesh.setMatrixAt(i, ZERO); headMesh.setMatrixAt(i, ZERO); });
  // 開始時点の人出
  const init = Math.round(PEOPLE_MAX * 0.85 * hourFactor(START_HOUR));
  for (let k = 0; k < init; k++) spawnPerson(people[k], true);
  lastAlive = trees.length;
}

function removeLeaf(t, ti, nearPlayer) {
  const n = t.list.length;
  if (!n) return;
  const k = (Math.random() * n) | 0;
  const i = t.list[k]; t.list[k] = t.list[n - 1]; t.list.pop();
  attached[i] = 0;
  treeLeaves.setMatrixAt(i, ZERO);
  treeLeaves.instanceMatrix.addUpdateRange(i * 16, 16);
  treeLeaves.instanceMatrix.needsUpdate = true;
  const x = lPos[i * 3], y = lPos[i * 3 + 1], z = lPos[i * 3 + 2];
  const gold = Math.random() < 1 / 150;
  if (!((nearPlayer || Math.random() < 0.3 || gold) && spawnFalling(x, y, z, gold))) addGroundLeaf(x + rand(-1.5, 1.5), z + rand(-1.5, 1.5));
  t.ratio = t.list.length / LEAVES;
  if (t.list.length === 0 && !t.dead) { t.dead = true; }
  if (k % 4 === 0 || t.list.length < 20) updateCone(ti);
}

function restoreTree(t, ti) {
  t.growList = [];
  for (let k = 0; k < LEAVES; k++) {
    const i = t.start + k;
    if (!attached[i]) { attached[i] = 1; t.list.push(i); t.growList.push(i); }
  }
  t.growT = 0; t.ratio = 1; t.dead = false; t.cooldown = 1.5;
  updateCone(ti);
  restored++;
  doBurst(t);
  sfx.restore();
  toast('てっぺんに触れた！ 紅葉がよみがえる');
}

function updateTrees(dt) {
  const rate = 2.6 * (1 + elapsed / 100) * (1 + wind.gust * 1.6); // 時間とともに散るのが早くなる
  const px = player.pos.x, pz = player.pos.z;
  const body = _v.set(px, player.pos.y + 0.9, pz);
  let total = 0, alive = 0;
  for (let ti = 0; ti < trees.length; ti++) {
    const t = trees[ti];
    if (t.cooldown > 0) t.cooldown -= dt;
    // てっぺんに触れたら紅葉が戻る
    const dx = body.x - t.x, dy = body.y - t.h, dz = body.z - t.z;
    if (dx * dx + dy * dy + dz * dz < 2.6 * 2.6 && t.cooldown <= 0 && t.list.length < LEAVES * 0.97) restoreTree(t, ti);

    if (t.list.length) {
      t.acc += rate * t.rateMul * dt;
      const near = Math.abs(t.z - pz) < 70;
      while (t.acc >= 1 && t.list.length) { t.acc -= 1; removeLeaf(t, ti, near); }
    }
    if (t.growList) {
      t.growT += dt;
      const e = t.growT >= 1 ? 1 : 1 - Math.pow(1 - t.growT, 3);
      for (const i of t.growList) treeLeaves.setMatrixAt(i, attached[i] ? leafMatrix(i, e) : ZERO);
      treeLeaves.instanceMatrix.addUpdateRange(t.start * 16, LEAVES * 16);
      treeLeaves.instanceMatrix.needsUpdate = true;
      if (t.growT >= 1) t.growList = null;
    }
    total += t.list.length;
    if (t.list.length) alive++;
    // てっぺんの目印の色
    const r = t.ratio, blink = r < 0.3 ? 0.6 + 0.4 * Math.sin(elapsed * 8 + ti) : 1;
    if (r <= 0) apexCol.set([0.15, 0.1, 0.08], ti * 3);
    else if (r < 0.3) apexCol.set([1 * blink, 0.25 * blink, 0.1 * blink], ti * 3);
    else apexCol.set([1 * 0.75, 0.85 * 0.75, 0.45 * 0.75], ti * 3);
  }
  apexGeo.attributes.color.needsUpdate = true;
  if (alive < lastAlive && alive > 0 && alive % 10 === 0) toast(`葉のある木は残り${alive}本`);
  lastAlive = alive;
  return { total, alive };
}

function updateFalling(dt) {
  const t = elapsed;
  let sp = 0;
  for (let i = 0; i < FALL_MAX; i++) {
    if (!fActive[i]) continue;
    const o = i * 3;
    if (fCaught[i] > 0) {
      // つかんだ葉は手元に吸い寄せられて消える
      fCaught[i] += dt;
      const k = Math.min(1, dt * 10);
      fPos[o] += (camera.position.x - fPos[o]) * k; fPos[o + 1] += (camera.position.y - 0.4 - fPos[o + 1]) * k; fPos[o + 2] += (camera.position.z - fPos[o + 2]) * k;
      if (fCaught[i] > 0.35) { freeFalling(i); continue; }
    } else {
      const ph = fPhase[i] + t * 1.7;
      const flutter = Math.sin(ph) * 0.9;
      fPos[o] += (wind.x * (1 + wind.gust * 3) + Math.cos(ph * 0.7) * 0.6) * dt;
      fPos[o + 2] += (wind.z * (1 + wind.gust * 3) + flutter * 0.6) * dt;
      fPos[o + 1] -= (fSpeed[i] * (0.75 + 0.45 * Math.abs(Math.sin(ph))) - wind.gust * 0.4) * dt;
      for (let k = 0; k < 3; k++) fRot[o + k] += fSpin[o + k] * dt;
      const gy = groundY(fPos[o], fPos[o + 2]);
      if (fPos[o + 1] <= gy + 0.03) {
        if (!fGold[i]) addGroundLeaf(fPos[o], fPos[o + 2], fScale[i]);
        freeFalling(i); continue;
      }
    }
    const s = fScale[i] * (fCaught[i] > 0 ? 1 - fCaught[i] * 2 : 1);
    _q.setFromEuler(_e.set(fRot[o], fRot[o + 1], fRot[o + 2]));
    _m.compose(_v.set(fPos[o], fPos[o + 1], fPos[o + 2]), _q, _s.set(s, s, s));
    fallMesh.setMatrixAt(i, _m);
    if (fGold[i] && sp < SPARK_N) {
      sparkPos[sp * 3] = fPos[o] + rand(-0.15, 0.15); sparkPos[sp * 3 + 1] = fPos[o + 1] + rand(-0.15, 0.15); sparkPos[sp * 3 + 2] = fPos[o + 2] + rand(-0.15, 0.15); sp++;
    }
  }
  for (let k = sp; k < SPARK_N; k++) sparkPos[k * 3 + 1] = -999;
  sparkGeo.attributes.position.needsUpdate = true;
  fallMesh.instanceMatrix.needsUpdate = true;
  if (fallColorDirty) { fallMesh.instanceColor.needsUpdate = true; fallColorDirty = false; }
}

function updateBurst(dt) {
  for (let i = 0; i < BURST_N; i++) {
    if (burstLife[i] <= 0) continue;
    burstLife[i] -= dt;
    const o = i * 3;
    if (burstLife[i] <= 0) { burstPos[o + 1] = -999; continue; }
    burstPos[o] += burstVel[o] * dt; burstPos[o + 1] += burstVel[o + 1] * dt; burstPos[o + 2] += burstVel[o + 2] * dt;
    burstVel[o + 1] -= 0.8 * dt;
  }
  burstGeo.attributes.position.needsUpdate = true;
}

function updateWind(dt) {
  wind.nextGust -= dt;
  if (wind.nextGust <= 0) {
    wind.nextGust = rand(14, 32);
    wind.gustT = rand(3, 5);
    const a = rand(0, 6.28); wind.gx = Math.cos(a); wind.gz = Math.sin(a);
    if (state === 'play') toast('木枯らしが吹いた！', 1500);
  }
  if (wind.gustT > 0) { wind.gustT -= dt; wind.gust = Math.min(1, wind.gust + dt * 1.5); }
  else wind.gust = Math.max(0, wind.gust - dt * 0.6);
  wind.x = 0.4 * Math.sin(elapsed * 0.05) + (wind.gx || 0) * wind.gust * 0.8;
  wind.z = -0.2 + 0.2 * Math.cos(elapsed * 0.07) + (wind.gz || 0) * wind.gust * 0.8;
  sfx.wind(wind.gust);
}

function phaseLabel(r) {
  if (r > 0.72) return '見頃';
  if (r > 0.45) return '散りさかり';
  if (r > 0.2) return '落葉すすむ';
  if (r > 0.02) return '冬支度';
  return '最後の一葉';
}

function updateHUD(total, alive) {
  const ratio = total / (trees.length * LEAVES);
  const d = dayLabel(elapsed);
  $('time').textContent = d.text;
  $('alive').textContent = alive;
  $('ratio').textContent = `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}%`;
  $('restored').textContent = restored;
  $('caught').textContent = caught;
  const ph = alive === 1 && total < 40 ? '最後の一葉' : phaseLabel(ratio);
  $('phase').textContent = ph;
  if (ph !== lastPhase && lastPhase && state === 'play') toast(ph === '最後の一葉' ? '最後の一葉を守れ！' : `並木は「${ph}」`);
  lastPhase = ph;
  $('gaugeFill').style.width = `${player.charge * 100}%`;
  $('gaugeFill').classList.toggle('max', player.charge >= 1);
  $('climb').classList.toggle('hidden', !player.climbing);
  $('crosshair').classList.toggle('ready', findCatchable() >= 0);
  drawMinimap();
}

function rankOf(days) {
  if (days < 1) return '通りすがりの散歩人';
  if (days < 2) return 'いちょう好き';
  if (days < 3) return '並木の世話人';
  if (days < 5) return '外苑の庭師';
  return 'いちょう並木の守り神';
}
let overReason = 'leaves';
function gameOver(reason = 'leaves') {
  overReason = reason;
  state = 'over';
  if (document.pointerLockElement) document.exitPointerLock();
  const days = elapsed / DAY_SEC;
  const fullDays = Math.floor(days), hours = Math.floor((days - fullDays) * 24);
  $('overSub').textContent = reason === 'car' ? '車道で車にぶつかってしまった' : '最後の一葉が散りました';
  $('overTitle').textContent = reason === 'car' ? '危ない！ 車にはねられた' : '並木に冬が来た';
  $('result').innerHTML = `
    <div>並木の秋を守った時間</div>
    <div class="big">${fullDays}日と${hours}時間</div>
    <div>よみがえらせた木 <b>${restored}</b> 本 ／ つかんだ葉 <b>${caught}</b>（金の葉 ${golds}枚）</div>
    <div class="rank">称号：${rankOf(days)}</div>`;
  $('over').classList.remove('hidden');
  $('hud').classList.add('hidden');
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  $('pause').classList.remove('hidden');
}
function startPlay() {
  sfx.init(); sfx.resume();
  ['title', 'pause', 'over'].forEach((id) => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  state = 'play';
  if (!isTouch && !dragMode && canvas.requestPointerLock) {
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { dragMode = true; }); } catch { dragMode = true; }
  }
}
$('startBtn').onclick = () => { resetGame(); startPlay(); setTimeout(() => ($('hint').style.opacity = 0), 9000); };
$('resumeBtn').onclick = () => startPlay();
$('retryBtn').onclick = () => { resetGame(); startPlay(); };

// ---------------------------------------------------------------------------
// メインループ
// ---------------------------------------------------------------------------
resetGame();
player.pos.set(9, 0.12, 6);
const clock = new THREE.Clock();
let titleT = 0;
function frame() {
  requestAnimationFrame(frame);
  step(Math.min(clock.getDelta(), 0.05));
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  renderer.render(scene, camera);
}
function step(dt) {
  if (state === 'play') {
    elapsed += dt;
    updateWind(dt);
    const hour0 = dayLabel(elapsed).hour;
    updateCars(dt, hour0, true);
    updatePlayer(dt);
    if (carHitsPlayer()) { sfx.crash(); gameOver('car'); return; }
    const { total, alive } = updateTrees(dt);
    updateFalling(dt);
    updateBurst(dt);
    const hour = dayLabel(elapsed).hour;
    const sky = updateSky(hour);
    if (sky.lightUp > 0.5 && lightupToasted !== Math.floor(elapsed / DAY_SEC)) { lightupToasted = Math.floor(elapsed / DAY_SEC); toast('夜のライトアップが始まった'); }
    updatePeople(dt, total / (trees.length * LEAVES), hour);
    updateHUD(total, alive);
    if (total === 0) {
      if (!lastLeafToasted) { lastLeafToasted = true; toast('最後の一葉が散った……', 3000); sfx.fall(); }
      endTimer += dt;
      if (endTimer > 3.5) gameOver();
    }
  } else if (state === 'title') {
    // タイトル画面：並木をゆっくり進むカメラ
    titleT += dt;
    updateWind(dt);
    elapsed += dt * 0.0; // 時間は止める
    camera.position.set(-9, 1.75 + Math.sin(titleT * 0.2) * 0.3, 8 - (titleT * 2.5) % 120);
    camera.rotation.set(0.14, -0.35 + Math.sin(titleT * 0.1) * 0.15, 0);
    player.pos.set(camera.position.x, 0, camera.position.z);
    // 演出として葉を降らせる
    for (let k = 0; k < 6; k++) {
      const t = trees[(Math.random() * trees.length) | 0];
      if (Math.abs(t.z - camera.position.z) < 60) { const i = t.start + ((Math.random() * LEAVES) | 0); spawnFalling(lPos[i * 3], lPos[i * 3 + 1], lPos[i * 3 + 2]); }
    }
    updateFalling(dt);
    updateSky(START_HOUR + 1.5);
    updatePeople(dt, 1, START_HOUR + 2);
    updateCars(dt, START_HOUR + 2, false);
  }
}
frame();

// デバッグ用（ブラウザのコンソールから）
window.__icho = { trees, player, cars, step(dt, n = 1) { for (let i = 0; i < n; i++) step(dt); }, get state() { return state; }, get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; } };
