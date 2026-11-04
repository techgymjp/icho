// 外苑いちょう並木　最後の一葉
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
// 実寸（m）：車道16m、その両側に植樹帯3.6m・歩道4.5m・植樹帯（外側）
const ROAD_HW = 8;                  // 車道の半幅（16m）
const INNER_ROW = 9.8;              // 車道側の植樹帯（8〜11.6m）の並木
const WALK_IN = 11.6, WALK_OUT = 16.1; // 歩道（幅4.5m）
const OUTER_ROW = 17.9;             // 外側の植樹帯（16.1〜19.7m）の並木
const EDGE = 19.7;
const ROW_X = [-OUTER_ROW, -INNER_ROW, INNER_ROW, OUTER_ROW]; // 4列のイチョウ
const PER_ROW = 32;                 // 4列 × 32本 = 128本
const TREE_TOTAL = 146;
const SPACING = 9;                  // 9m間隔
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
// 高さマップから法線マップを作る
function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const og = out.getContext('2d'), img = og.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), o = (y * w + x) * 4;
    d[o] = (-dx / l * 0.5 + 0.5) * 255; d[o + 1] = (dy / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  return out;
}
// イチョウの葉：1K（1024×768）のAlbedo+Opacity と Normal
function leafTextures() {
  const S = LOW ? 4 : 8;
  const make = (heightMode) => {
    const c = document.createElement('canvas'); c.width = 128 * S; c.height = 96 * S;
    const g = c.getContext('2d');
    if (heightMode) { g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); }
    g.scale(S, S); g.translate(64, 86);
    g.strokeStyle = heightMode ? '#a0a0a0' : '#efe2b0'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 8); g.lineTo(0, -10); g.stroke();
    const R = 72, a0 = -Math.PI * 0.82, a1 = -Math.PI * 0.18;
    g.beginPath(); g.moveTo(0, -8);
    for (let i = 0; i <= 120; i++) {
      const a = lerp(a0, a1, i / 120);
      let r = R * (1 + 0.025 * Math.sin(a * 46));
      r -= 26 * Math.max(0, 1 - Math.abs(a + Math.PI / 2) / 0.1); // 中央の切れ込み
      g.lineTo(Math.cos(a) * r, -8 + Math.sin(a) * r);
    }
    g.closePath();
    if (heightMode) { g.fillStyle = '#7a7a7a'; g.fill(); }
    else {
      const grd = g.createRadialGradient(0, -8, 4, 0, -8, R);
      grd.addColorStop(0, '#f4ead0'); grd.addColorStop(0.7, '#ffffff'); grd.addColorStop(1, '#f7f0dc');
      g.fillStyle = grd; g.fill();
    }
    g.strokeStyle = heightMode ? 'rgba(200,200,200,0.9)' : 'rgba(120,90,0,0.16)'; g.lineWidth = heightMode ? 0.9 : 0.6;
    for (let i = 0; i < 26; i++) {
      const a = lerp(a0 + 0.04, a1 - 0.04, i / 25);
      g.beginPath(); g.moveTo(0, -8); g.lineTo(Math.cos(a) * R * 0.93, -8 + Math.sin(a) * R * 0.93); g.stroke();
    }
    return c;
  };
  const map = new THREE.CanvasTexture(make(false));
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const normal = new THREE.CanvasTexture(normalFromHeight(make(true), 3));
  return { map, normal };
}
// 幹：Albedo / Normal / Roughness（縦方向にリピート）
function barkTextures() {
  const W = LOW ? 256 : 1024, H = LOW ? 512 : 2048;
  const hc = document.createElement('canvas'); hc.width = W; hc.height = H;
  const g = hc.getContext('2d');
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, W, H);
  // 縦に走る深い割れ目
  for (let i = 0; i < W / 3; i++) {
    let x = Math.random() * W;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,20,20' : '230,230,230'},${rand(0.25, 0.6)})`;
    g.lineWidth = rand(1, W / 90);
    g.beginPath(); g.moveTo(x, -20);
    for (let y = 0; y < H + 40; y += H / 40) { x += rand(-W / 60, W / 60); g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < W * 3; i++) { g.fillStyle = `rgba(0,0,0,${rand(0.05, 0.2)})`; g.fillRect(Math.random() * W, Math.random() * H, rand(2, W / 60), rand(1, 4)); }
  const ac = document.createElement('canvas'); ac.width = W; ac.height = H;
  const a = ac.getContext('2d');
  a.drawImage(hc, 0, 0);
  a.globalCompositeOperation = 'multiply'; a.fillStyle = '#6b5641'; a.fillRect(0, 0, W, H);
  a.globalCompositeOperation = 'source-over';
  for (let i = 0; i < W; i++) { a.fillStyle = `rgba(${Math.random() < 0.3 ? '110,120,80' : '60,50,40'},${rand(0.05, 0.15)})`; a.fillRect(Math.random() * W, Math.random() * H, rand(4, 30), rand(4, 30)); }
  const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
  const r = rc.getContext('2d'); r.fillStyle = '#e0e0e0'; r.fillRect(0, 0, W, H); r.globalAlpha = 0.4; r.drawImage(hc, 0, 0);
  const wrap = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 5); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: wrap(ac, true), normal: wrap(normalFromHeight(hc, 4)), rough: wrap(rc) };
}
// 遠景の樹冠（円錐）用：葉が密集した模様
function canopyTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#c99716'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    g.save(); g.translate(Math.random() * S, Math.random() * S); g.rotate(Math.random() * 6.28);
    const l = rand(0.45, 0.85); g.fillStyle = `rgba(${255 * l | 0},${215 * l | 0},${60 * l | 0},.9)`;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, rand(3, 7), -2.4, -0.7); g.closePath(); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace;
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
const LEAF_TEXS = leafTextures();
const LEAF_TEX = LEAF_TEXS.map;
const _tmpM = new THREE.Matrix4();
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
const AVE_START = 10, AVE_END = -292;  // 青山通りから円周道路まで約300m
// 横道（2列・18本）
const SIDE_Z = -5 - 15 * 9 - 4.5, SIDE_ROW = 7, SIDE_N = 9, SIDE_HW = 5, SIDE_LEN = 6 + 8 * 9 + 8;
const R246 = { south: 10, walkS: 16, median0: 29.5, median1: 32.5, walkN: 46, north: 52 };
const RING_Z = AVE_END - 50, GALLERY_Z = RING_Z - 100, POND_Z = RING_Z - 56;
// 柵の切れ目（横断できる場所）
const GAP_Z = []; for (let j = 0; j < 32; j += 5) GAP_Z.push(-9.5 - j * SPACING);
GAP_Z.push(-5 - 15 * 9 - 4.5); // 横道への出入口
const inGap = (z) => GAP_Z.some((g) => Math.abs(z - g) < 1.3);
// 柵のライン：車道沿いのガードフェンス、歩道両側の杭とロープ
const GUARD_X = ROAD_HW + 0.35;
const FENCE_X = [-(WALK_OUT + 0.25), -(WALK_IN - 0.25), -GUARD_X, GUARD_X, WALK_IN - 0.25, WALK_OUT + 0.25];
// 円形の障害物（ボラード・池など）：{x, z, r, h}
const OBST = [];
function groundY(x, z) {
  const ax = Math.abs(x);
  if (z > R246.south) return (z < R246.walkS && ax > ROAD_HW) || (z > R246.walkN && z < R246.north + 30) ? 0.12 : 0;
  if (x < -EDGE + 0.1 && x > -EDGE - SIDE_LEN && Math.abs(z - SIDE_Z) < SIDE_ROW + 2) return 0.12; // 横道
  return (ax > ROAD_HW && ax < EDGE && z < AVE_START && z > AVE_END) ? 0.12 : 0;
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
addPlane(2400, 2400, 0, -150, -0.06, lambert(0xffffff, { map: grassTex, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8 }));

const asphaltTex = noiseTexture('#4b4b50', 0.18, 256, 8000);
asphaltTex.repeat.set(4, 100);
const ROAD_LEN = AVE_START + 5 - (RING_Z + 36);
addPlane(ROAD_HW * 2, ROAD_LEN, 0, AVE_START + 5 - ROAD_LEN / 2, 0.0, lambert(0xffffff, { map: asphaltTex }));
// 白線：中央線・車線境界（破線）・外側線
const lineMat = lambert(0xe8e8e0);
addPlane(0.15, AVE_START - AVE_END + 10, 0, (AVE_START + AVE_END) / 2, 0.012, lineMat);
for (const sx of [-6.1, 6.1]) addPlane(0.15, AVE_START - AVE_END + 10, sx, (AVE_START + AVE_END) / 2, 0.012, lineMat);
{
  const n = Math.floor((AVE_START - AVE_END) / 10) * 2;
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.15, 5).rotateX(-Math.PI / 2), lineMat, n);
  for (let i = 0; i < n; i++) dash.setMatrixAt(i, _tmpM.makeTranslation(i % 2 ? 3.1 : -3.1, 0.012, AVE_START - 4 - Math.floor(i / 2) * 10));
  dash.receiveShadow = true; scene.add(dash);
}
// 歩道：暗い灰色の舗装に落ち葉
function pavementTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#55575b'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 14000; i++) { const v = Math.random(); g.fillStyle = `rgba(${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},${Math.random() * 0.09})`; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  const cols = ['#e9c23c', '#dcae22', '#f2d462', '#c99a1c'];
  for (let i = 0; i < 2600; i++) {
    g.save(); g.translate(Math.random() * S, Math.random() * S); g.rotate(Math.random() * 6.28);
    g.fillStyle = cols[i % 4]; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 4 + Math.random() * 4, -2.4, -0.7); g.closePath(); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function soilTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#4d5a2c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { const r = Math.random(); g.fillStyle = r < .4 ? 'rgba(70,52,30,.5)' : r < .7 ? 'rgba(110,140,60,.5)' : 'rgba(230,190,50,.6)'; g.fillRect(Math.random() * S, Math.random() * S, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const pave = pavementTexture(); pave.repeat.set(1.5, 100);
const soil = soilTexture(); soil.repeat.set(2, 120);
const walkMat = lambert(0xffffff, { map: pave });
const soilMat = lambert(0xffffff, { map: soil });
const curbMat = lambert(0xbdb8ad);
const AVE_LEN = AVE_START - AVE_END, AVE_MID = (AVE_START + AVE_END) / 2;
for (const s of [-1, 1]) {
  addBox(WALK_IN - ROAD_HW, 0.12, AVE_LEN, s * (ROAD_HW + WALK_IN) / 2, 0.06, AVE_MID, soilMat, false);      // 車道側植樹帯
  addBox(WALK_OUT - WALK_IN, 0.12, AVE_LEN, s * (WALK_IN + WALK_OUT) / 2, 0.06, AVE_MID, walkMat, false);    // 歩道
  addBox(EDGE - WALK_OUT, 0.12, AVE_LEN, s * (WALK_OUT + EDGE) / 2, 0.06, AVE_MID, soilMat, false);          // 外側植樹帯
  addBox(0.25, 0.18, AVE_LEN, s * (ROAD_HW + 0.12), 0.09, AVE_MID, curbMat, false);                          // 車道の縁石
  for (const fx of [WALK_IN, WALK_OUT]) addBox(0.18, 0.15, AVE_LEN, s * fx, 0.1, AVE_MID, curbMat, false);   // 歩道の縁石
  // 外周の板塀（西側は横道の入口で途切れる）
  const board = lambert(0x6e5a44), w0 = SIDE_Z + SIDE_ROW + 2, w1 = SIDE_Z - SIDE_ROW - 2;
  if (s > 0) addBox(0.12, 1.3, AVE_LEN, s * (EDGE + 0.2), 0.65, AVE_MID, board);
  else {
    addBox(0.12, 1.3, AVE_START - w0, -EDGE - 0.2, 0.65, (AVE_START + w0) / 2, board);
    addBox(0.12, 1.3, w1 - AVE_END, -EDGE - 0.2, 0.65, (w1 + AVE_END) / 2, board);
  }
}
// 木の杭とロープの柵（歩道の両側）
{
  const posts = [];
  const ROPE_X = FENCE_X.filter((x) => Math.abs(x) !== GUARD_X);
  for (const fx of ROPE_X) for (let z = AVE_START - 1; z > AVE_END + 1; z -= 1.8) if (!inGap(z)) posts.push([fx, z]);
  const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 7).translate(0, 0.4, 0), lambert(0x4a3524), posts.length);
  posts.forEach(([x, z], i) => pm.setMatrixAt(i, _tmpM.makeTranslation(x, 0.12, z)));
  pm.castShadow = true; scene.add(pm);
  const ropeMat = lambert(0x8a7a62);
  for (const fx of ROPE_X) {
    const cuts = [AVE_START - 1, ...GAP_Z.flatMap((g) => [g + 1.3, g - 1.3]), AVE_END + 1].sort((p, q) => q - p);
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const len = cuts[k] - cuts[k + 1];
      if (len > 0.5) addBox(0.03, 0.03, len, fx, 0.82, (cuts[k] + cuts[k + 1]) / 2, ropeMat, false);
    }
  }
}
// 車道と植樹帯を区切る、茶色のシックな低いガードフェンス
{
  const brown = lambert(0x3b2a1e);
  const posts = [];
  for (const sd of [-1, 1]) for (let z = AVE_START - 1; z > AVE_END + 1; z -= 2) if (!inGap(z)) posts.push([sd * GUARD_X, z]);
  const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.75, 0.08).translate(0, 0.375, 0), brown, posts.length);
  posts.forEach(([x, z], i) => pm.setMatrixAt(i, _tmpM.makeTranslation(x, 0.12, z)));
  pm.castShadow = true; scene.add(pm);
  for (const sd of [-1, 1]) {
    const cuts = [AVE_START - 1, ...GAP_Z.flatMap((g) => [g + 1.3, g - 1.3]), AVE_END + 1].sort((p, q) => q - p);
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const len = cuts[k] - cuts[k + 1];
      if (len < 0.5) continue;
      for (const y of [0.45, 0.82]) addBox(0.06, 0.06, len, sd * GUARD_X, y, (cuts[k] + cuts[k + 1]) / 2, brown, false);
    }
  }
}
// 横道（2列のイチョウ）
{
  const sp = pavementTexture(); sp.repeat.set(SIDE_LEN / 6, 3);
  addBox(SIDE_LEN, 0.12, (SIDE_ROW + 2) * 2, -EDGE - SIDE_LEN / 2, 0.06, SIDE_Z, lambert(0xffffff, { map: sp }), false);
  for (const sz of [-1, 1]) {
    addBox(SIDE_LEN, 0.13, 2.2, -EDGE - SIDE_LEN / 2, 0.065, SIDE_Z + sz * SIDE_ROW, soilMat, false);
    addBox(SIDE_LEN, 1.3, 0.12, -EDGE - SIDE_LEN / 2, 0.65, SIDE_Z + sz * (SIDE_ROW + 2.1), lambert(0x6e5a44));
  }
}
// 植樹帯の下草（ギボウシなど）
{
  const n = 1400;
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), lambert(0xffffff), n);
  for (let i = 0; i < n; i++) {
    const s = Math.random() < 0.5 ? -1 : 1;
    const inner = Math.random() < 0.5;
    const x = s * (inner ? rand(ROAD_HW + 0.5, WALK_IN - 0.5) : rand(WALK_OUT + 0.5, EDGE - 0.4));
    const z = rand(AVE_END + 1, AVE_START - 1);
    const r = rand(0.25, 0.55);
    _tmpM.compose(new THREE.Vector3(x, 0.12, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.55, r));
    mesh.setMatrixAt(i, _tmpM);
    mesh.setColorAt(i, new THREE.Color().setHSL(rand(0.2, 0.28), rand(0.45, 0.6), rand(0.22, 0.32)));
  }
  mesh.receiveShadow = true; scene.add(mesh);
}
// ベンチ（外側植樹帯）
{
  const iron = lambert(0x2a2a2a), wood = lambert(0x7a5634);
  for (const s of [-1, 1]) for (let z = -18.5; z > AVE_END; z -= 27) {
    if (inGap(z)) continue;
    const x = s * (WALK_OUT + 1.0);
    OBST.push({ x, z, r: 0.85, h: 0.95 });
    addBox(0.5, 0.06, 1.6, x, 0.55, z, wood);
    addBox(0.06, 0.45, 1.6, x + s * 0.25, 0.85, z, wood);
    for (const dz of [-0.7, 0.7]) addBox(0.5, 0.45, 0.06, x, 0.34, z + dz, iron);
  }
}
// 青山通り（国道246号）：片側3車線＋中央分離帯、両側に歩道
{
  const aoyamaTex = noiseTexture('#46464b', 0.18, 256, 8000); aoyamaTex.repeat.set(80, 6);
  addPlane(700, R246.walkN - R246.walkS, 0, (R246.walkS + R246.walkN) / 2, 0.005, lambert(0xffffff, { map: aoyamaTex }));
  // 並木の車道が青山通りへつながる部分
  addPlane(ROAD_HW * 2, R246.walkS - R246.south, 0, (R246.south + R246.walkS) / 2, 0.004, lambert(0xffffff, { map: aoyamaTex }));
  const sw = lambert(0xa9a49a);
  for (const sd of [-1, 1]) addBox(350 - ROAD_HW, 0.12, R246.walkS - R246.south, sd * (ROAD_HW + (350 - ROAD_HW) / 2), 0.06, (R246.south + R246.walkS) / 2, sw, false);
  addBox(700, 0.12, R246.north - R246.walkN, 0, 0.06, (R246.walkN + R246.north) / 2, sw, false);
  // 中央分離帯（植え込み）
  addBox(700, 0.25, R246.median1 - R246.median0, 0, 0.125, (R246.median0 + R246.median1) / 2, curbMat, false);
  addBox(700, 0.6, 1.4, 0, 0.5, (R246.median0 + R246.median1) / 2, lambert(0x3e5a2a));
  // 車線（破線）
  const n = 140;
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(5, 0.15).rotateX(-Math.PI / 2), lineMat, n * 4);
  let k = 0;
  for (const z of [R246.walkS + 4.5, R246.walkS + 8, R246.median1 + 4.5 - 1, R246.median1 + 8 - 1])
    for (let i = 0; i < n; i++) dash.setMatrixAt(k++, _tmpM.makeTranslation(-350 + i * 10, 0.012, z));
  scene.add(dash);
  for (const z of [R246.walkS + 0.8, R246.walkN - 0.8]) addPlane(700, 0.15, 0, z, 0.012, lineMat);
  // 横断歩道：青山通りを渡る（並木の西側歩道の延長）と、並木入口を横切る
  for (let i = 0; i < 13; i++) addPlane(5, 0.5, -WALK_IN - 2.2, R246.walkS + 1.5 + i * 1.0 * 2.3 * (i < 6 ? 1 : 1), 0.013, lineMat);
  for (let i = 0; i < 9; i++) addPlane(0.5, 4.5, -7 + i * 1.75, (R246.south + R246.walkS) / 2, 0.013, lineMat);
  // 停止線
  addPlane(0.4, 10.5, -WALK_IN - 2.2 - 4, R246.walkS + 5.6, 0.013, lineMat);
  addPlane(0.4, 10.5, -WALK_IN - 2.2 + 4, R246.median1 + 6.5, 0.013, lineMat);
}
// 信号機
const signals = [];
{
  const poleM = lambert(0x9a9da0), boxM = lambert(0x2a2c2e);
  const mk = (x, z, rotY) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.5, 8), poleM); pole.position.y = 2.75; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.5), poleM); arm.position.set(0, 5.3, 1.75); g.add(arm);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 1.4), boxM); box.position.set(0, 5.3, 3.2); g.add(box);
    const lights = ['#1fbf6b', '#f0b400', '#e8321e'].map((c, i) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      m.position.set(0.21, 5.3, 2.75 + i * 0.45); m.rotation.y = Math.PI / 2; g.add(m); m.userData.on = new THREE.Color(c); return m;
    });
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), boxM); ped.position.set(0, 3.0, 0); g.add(ped);
    const pedL = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0x222222 })); pedL.position.set(0.16, 3.0, 0); pedL.rotation.y = Math.PI / 2; g.add(pedL);
    g.position.set(x, 0.12, z); g.rotation.y = rotY; g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g); signals.push({ g, lights, pedL });
  };
  mk(-WALK_IN - 5.5, R246.walkS - 0.8, Math.PI / 2 * 0 + Math.PI);
  mk(-WALK_IN + 1.1, R246.walkN + 0.8, 0);
}
// 信号サイクル（青山通りの車：青→黄→赤。赤の間に横断歩道を渡れる）
const SIG_PERIOD = 30;
function signalState(t) { const u = t % SIG_PERIOD; return u < 19 ? 'green' : u < 22 ? 'yellow' : 'red'; }
function updateSignals(t) {
  const st = signalState(t);
  for (const s of signals) {
    s.lights.forEach((m, i) => m.material.color.copy(((st === 'green' && i === 0) || (st === 'yellow' && i === 1) || (st === 'red' && i === 2)) ? m.userData.on : new THREE.Color(0x222222)));
    s.pedL.material.color.set(st === 'red' && (t % SIG_PERIOD) < SIG_PERIOD - 1.5 ? 0x2fd07a : 0xd8321e);
  }
  return st;
}
// 青山通り沿いのビル
{
  const mats = [0x8d929a, 0xa7a49c, 0x6f7680, 0xbfb8aa, 0x9aa2a8, 0x7c8a96].map((c) => lambert(c));
  const glass = lambert(0x5d7088);
  for (let i = 0; i < 30; i++) {
    const w = rand(16, 32), h = rand(18, 80), d = rand(16, 26);
    const x = -230 + i * 16 + rand(-3, 3);
    const b = addBox(w, h, d, x, h / 2, R246.north + 3 + d / 2 + rand(0, 6), mats[i % mats.length]);
    if (i % 3 === 0) addBox(w * 0.9, h * 0.92, 0.2, x, h * 0.48, b.position.z - d / 2 - 0.1, glass, false);
  }
  // 並木の入口の両脇（青山通りの南側）
  for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) {
    const w = rand(18, 30), h = rand(14, 45), d = rand(20, 30);
    addBox(w, h, d, sd * (EDGE + 14 + i * 26 + w / 2), h / 2, R246.south - d / 2 - 2, mats[(i + 2) % mats.length]);
  }
}
// 円周道路と芝生広場
{
  const ring = new THREE.Mesh(new THREE.RingGeometry(26, 38, 64), lambert(0xffffff, { map: asphaltTex }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.004, RING_Z); ring.receiveShadow = true; scene.add(ring);
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(26, 64), lambert(0x7fa04a));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.01, RING_Z); lawn.receiveShadow = true; scene.add(lawn);
}
// 聖徳記念絵画館：幅約112mの左右対称の花崗岩の建物。中央に高さ約32mのドーム
{
  const stone = lambert(0xd4c7a8), stoneDark = lambert(0xb9ab8b), copper = lambert(0x7d9488), dark = lambert(0x3a352d);
  const Z = GALLERY_Z;       // 正面の中心
  const F = Z + 17;          // 正面の壁面
  // 基壇
  addBox(118, 1.6, 38, 0, 0.8, Z, stoneDark);
  // 左右の翼棟
  for (const sd of [-1, 1]) {
    addBox(40, 13, 30, sd * 36, 1.6 + 6.5, Z, stone);
    addBox(41, 1.0, 31, sd * 36, 14.6, Z, stoneDark);        // コーニス
    addBox(40, 1.6, 30, sd * 36, 15.9, Z, stone);            // パラペット
    for (let i = 0; i < 9; i++) addBox(1.1, 11.5, 0.6, sd * (18 + i * 4.4), 8.2, F - 2 + 0.3, stoneDark); // 付柱
    // 翼端の塔屋
    addBox(10, 16.5, 32, sd * 54, 1.6 + 8.25, Z, stone);
    addBox(10.6, 1.0, 32.6, sd * 54, 18.3, Z, stoneDark);
  }
  // 中央棟
  addBox(32, 19, 34, 0, 1.6 + 9.5, Z, stone);
  addBox(33, 1.2, 35, 0, 21.2, Z, stoneDark);
  // 玄関ポーチ：列柱と大階段
  addBox(20, 13.5, 6, 0, 1.6 + 6.75, F + 2.6, stone);
  addBox(21, 1.2, 7, 0, 15.6, F + 2.6, stoneDark);
  for (let i = 0; i < 6; i++) { const x = -7.5 + i * 3; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 11, 14), stone); c.position.set(x, 1.6 + 5.5, F + 5.8); c.castShadow = true; scene.add(c); }
  addBox(6, 8, 0.4, 0, 1.6 + 4, F + 5.4, dark);                 // 入口
  for (let i = 0; i < 6; i++) addBox(24 - i * 0.6, 0.27, 1.2, 0, 1.6 - 0.27 * i - 0.14, F + 6.8 + i * 1.2, stoneDark); // 大階段
  // ドーム：四角い多段の基部 → 銅板葺きの段付きドーム → 頂部
  for (let i = 0; i < 3; i++) { const w = 22 - i * 3.4; addBox(w, 2.2, w, 0, 22.9 + i * 2.2, Z, i % 2 ? stoneDark : stone); }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 3, 24), stone); drum.position.set(0, 30.1, Z); drum.castShadow = true; scene.add(drum);
  for (let i = 0; i < 5; i++) {
    const r0 = 7.1 - i * 1.35, r1 = 7.1 - (i + 1) * 1.35;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(r1, 0.4), r0, 1.3, 24), copper);
    t.position.set(0, 32.25 + i * 1.3, Z); t.castShadow = true; scene.add(t);
  }
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.4, 12), copper); lantern.position.set(0, 39.4, Z); scene.add(lantern);
}
// 絵画館前の円形の池と噴水
const fountain = (() => {
  const rim = new THREE.Mesh(new THREE.TorusGeometry(12, 0.45, 8, 64).rotateX(Math.PI / 2), lambert(0xb9ab8b));
  rim.position.set(0, 0.35, POND_Z); rim.castShadow = true; rim.receiveShadow = true; scene.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshPhongMaterial({ color: 0x4f7690, shininess: 160, specular: 0xffffff, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.3, POND_Z); water.receiveShadow = true; scene.add(water);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 0.8, 16), lambert(0xb9ab8b)); base.position.set(0, 0.4, POND_Z); scene.add(base);
  OBST.push({ x: 0, z: POND_Z, r: 12.4, h: 0.8 });
  // 噴水の水しぶき（パーティクル）
  const N = 700, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8f4ff, size: 0.28, map: GLOW_TEX, transparent: true, opacity: 0.8, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  const reset = (i) => { const a = rand(0, 6.28), sp = rand(0, 0.9); pos.set([Math.cos(a) * 0.2, 0.8, POND_Z + Math.sin(a) * 0.2], i * 3); vel.set([Math.cos(a) * sp, rand(8.5, 10.5), Math.sin(a) * sp], i * 3); life[i] = 0; };
  for (let i = 0; i < N; i++) { reset(i); life[i] = -Math.random() * 2.2; }
  return (dt) => {
    for (let i = 0; i < N; i++) {
      life[i] += dt; if (life[i] < 0) continue;
      const o = i * 3; vel[o + 1] -= 9.8 * dt;
      pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
      if (pos[o + 1] < 0.3) reset(i);
    }
    g.attributes.position.needsUpdate = true;
  };
})();
// 円周道路の内側：軟式グラウンド（土のダイヤモンドと芝生）
{
  const dirt = lambert(0xb08a5c);
  const inf = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), dirt); inf.rotation.set(-Math.PI / 2, 0, Math.PI / 4); inf.position.set(0, 0.02, RING_Z + 4); inf.receiveShadow = true; scene.add(inf);
  const arc = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 1.25, Math.PI * 0.5), dirt); arc.rotation.x = -Math.PI / 2; arc.position.set(0, 0.015, RING_Z + 12); scene.add(arc);
  for (const [x, z] of [[0, RING_Z + 15.3], [5.6, RING_Z + 9.6], [0, RING_Z + 4], [-5.6, RING_Z + 9.6]]) addBox(0.4, 0.05, 0.4, x, 0.05, z, lambert(0xffffff), false);
}
// 並木入口：オープンカフェのテラス席（青山通り側の歩道）
{
  const white = lambert(0xf2efe8), dark = lambert(0x2b2b2b), canvasM = lambert(0xe9e1cf, { side: THREE.DoubleSide }), glass = new THREE.MeshPhongMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.55, shininess: 100 });
  // ガラス張りのカフェ棟（並木東側の入口脇）
  addBox(18, 4.2, 12, EDGE + 11, 2.1, 1, glass);
  addBox(18.6, 0.5, 12.6, EDGE + 11, 4.45, 1, white);
  addBox(0.3, 4.2, 12, EDGE + 2.15, 2.1, 1, white);
  addBox(18, 0.3, 0.3, EDGE + 11, 4.0, 7.1, white);
  for (let i = 0; i < 5; i++) {
    const x = EDGE + 3 + i * 3.6, z = 12.6 + (i % 2) * 1.4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), dark); pole.position.set(x, 0.12 + 1.3, z); scene.add(pole);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 8, 1, true), canvasM); um.position.set(x, 0.12 + 2.5, z); um.castShadow = true; scene.add(um);
    addBox(0.04, 0.72, 0.04, x, 0.48, z, dark, false);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), white); top.position.set(x, 0.86, z); top.castShadow = true; scene.add(top);
    for (const a of [0, Math.PI]) {
      const cx = x + Math.cos(a) * 0.75, cz = z + Math.sin(a) * 0.75;
      addBox(0.42, 0.04, 0.42, cx, 0.58, cz, dark);
      addBox(0.04, 0.45, 0.42, cx + Math.cos(a) * 0.2, 0.82, cz, dark);
    }
    OBST.push({ x, z, r: 1.1, h: 0.9 });
  }
}
// 石造りの案内板（並木入口）
{
  const stone = lambert(0x9d978b);
  const sign = (x, z, rotY, title, lines) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320;
    const g = c.getContext('2d');
    g.fillStyle = '#2f3a2e'; g.fillRect(0, 0, 512, 320);
    g.strokeStyle = '#d8cfae'; g.lineWidth = 6; g.strokeRect(10, 10, 492, 300);
    g.fillStyle = '#f1e8c8'; g.font = 'bold 40px serif'; g.textAlign = 'center'; g.fillText(title, 256, 66);
    g.font = '24px sans-serif'; lines.forEach((l, i) => g.fillText(l, 256, 120 + i * 38));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 0.35), stone); base.position.y = 0.8; base.castShadow = true; grp.add(base);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), lambert(0xffffff, { map: tex })); face.position.set(0, 0.95, 0.18); grp.add(face);
    grp.position.set(x, 0.12, z); grp.rotation.y = rotY; scene.add(grp);
    OBST.push({ x, z, r: 1.0, h: 1.6 });
  };
  sign(-(WALK_OUT + 1.8), 4, Math.PI / 2, '明治神宮外苑 いちょう並木', ['青山通り → 聖徳記念絵画館 約300m', '4列128本＋横道18本 計146本', '9m間隔・遠近法を用いた植栽']);
  sign(WALK_OUT + 1.8, 4, -Math.PI / 2, 'いちょう並木の由来', ['明治41年 育成開始', '大正12年 並木完成', '樹高は絵画館に向かって低くなる']);
}
// 青山通りとの境界の石柱（ボラード）
{
  const stone = lambert(0xb7b1a5);
  const pts = [];
  for (const sd of [-1, 1]) for (let x = WALK_IN + 0.6; x < WALK_OUT - 0.3; x += 1.4) pts.push([sd * x, AVE_START - 0.6]);
  for (const sd of [-1, 1]) for (let x = WALK_IN + 0.6; x < WALK_OUT - 0.3; x += 1.4) pts.push([sd * x, AVE_END + 0.8]);
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.24, 0.8, 10).translate(0, 0.4, 0), stone, pts.length);
  pts.forEach(([x, z], i) => { im.setMatrixAt(i, _tmpM.makeTranslation(x, 0.12, z)); OBST.push({ x, z, r: 0.32, h: 0.9 }); });
  im.castShadow = true; scene.add(im);
}
// 地面に溜まった落ち葉（デカール：柵の足もと・ベンチの下・縁石沿い）
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const cols = ['#e9c23c', '#dcae22', '#f2d462', '#c99a1c', '#b8861a'];
  for (let i = 0; i < 900; i++) {
    const a = rand(0, 6.28), r = Math.pow(Math.random(), 0.7) * 118;
    g.save(); g.translate(128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.55); g.rotate(rand(0, 6.28));
    g.globalAlpha = 1 - r / 140; g.fillStyle = cols[i % 5];
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, rand(5, 9), -2.4, -0.7); g.closePath(); g.fill(); g.restore();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const spots = [];
  for (const fx of FENCE_X) for (let z = AVE_START - 3; z > AVE_END; z -= rand(3, 7)) spots.push([fx + rand(-0.3, 0.3), z, rand(1.4, 2.6), rand(0, 6.28)]);
  for (const sd of [-1, 1]) for (let z = AVE_START - 3; z > AVE_END; z -= rand(5, 10)) spots.push([sd * (ROAD_HW - 0.4), z, rand(1.5, 3), 0]);
  for (const sd of [-1, 1]) for (let z = -18.5; z > AVE_END; z -= 27) spots.push([sd * (WALK_OUT + 1.0), z, 2.4, 0]);
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, spots.length);
  spots.forEach(([x, z, sc, r], i) => im.setMatrixAt(i, _tmpM.compose(new THREE.Vector3(x, groundY(x, z) + 0.02, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(sc * 1.6, 1, sc))));
  im.receiveShadow = true; im.renderOrder = 1; scene.add(im);
}
// 光の筋（ライトシャフト）：低い日差しが並木の間に差し込む
const shaftMat = (() => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, 'rgba(255,240,200,0)'); grd.addColorStop(0.3, 'rgba(255,236,190,0.6)'); grd.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 256);
  const g2 = g.createLinearGradient(0, 0, 32, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = g2; g.fillRect(0, 0, 32, 256);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
})();
const shafts = Array.from({ length: LOW ? 6 : 14 }, () => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.8, 2.2), 26), shaftMat);
  m.userData.off = new THREE.Vector3(rand(-25, 25), 0, rand(-40, 20)); scene.add(m); return m;
});
let sunShaft = 0;
function updateShafts() {
  const p = player.pos;
  for (const m of shafts) {
    const o = m.userData.off;
    m.position.set(p.x + o.x, 9, p.z + o.z);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _sunDir);
    m.rotateY(Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z));
  }
}

// 背景の木々（並木の外側）
{
  const n = 520;
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geo, lambert(0xffffff), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    let z = rand(GALLERY_Z - 30, -14), x = side * rand(EDGE + 6, 110);
    if (z < AVE_END - 5) x = side * rand(62, 120);
    if (Math.abs(z - SIDE_Z) < 12 && side < 0 && Math.abs(x) < EDGE + SIDE_LEN + 4) x = -rand(EDGE + SIDE_LEN + 6, 120);
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

// 黒い鋳鉄調のクラシックな街灯（等間隔）
const LAMP_POS = [];
const LAMP_H = 4.6;
for (let z = -0.5; z > AVE_END; z -= 27) for (const s of [-1, 1]) LAMP_POS.push(new THREE.Vector3(s * (ROAD_HW + 0.9), 0.12, z));
const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
{
  const iron = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.45, metalness: 0.6 });
  const n = LAMP_POS.length;
  const parts = [
    [new THREE.CylinderGeometry(0.22, 0.3, 0.6, 10).translate(0, 0.3, 0), iron],                 // 台座
    [new THREE.CylinderGeometry(0.07, 0.1, LAMP_H - 0.4, 8).translate(0, 0.6 + (LAMP_H - 0.4) / 2 - 0.2, 0), iron], // 支柱
    [new THREE.TorusGeometry(0.12, 0.025, 6, 12).rotateX(Math.PI / 2).translate(0, LAMP_H - 0.6, 0), iron], // 装飾リング
    [new THREE.CylinderGeometry(0.16, 0.12, 0.08, 8).translate(0, LAMP_H - 0.25, 0), iron],      // 受け皿
    [new THREE.CylinderGeometry(0.2, 0.15, 0.55, 6).translate(0, LAMP_H + 0.05, 0), lampHeadMat], // ガラスの灯具（六角）
    [new THREE.ConeGeometry(0.3, 0.32, 6).translate(0, LAMP_H + 0.48, 0), iron],                  // 笠
    [new THREE.SphereGeometry(0.06, 6, 4).translate(0, LAMP_H + 0.66, 0), iron],                 // 頂部
  ];
  for (const [geo, mat] of parts) {
    const im = new THREE.InstancedMesh(geo, mat, n);
    LAMP_POS.forEach((p, i) => im.setMatrixAt(i, _tmpM.makeTranslation(p.x, p.y, p.z)));
    im.castShadow = mat !== lampHeadMat; scene.add(im);
  }
  LAMP_POS.forEach((p) => OBST.push({ x: p.x, z: p.z, r: 0.35, h: LAMP_H }));
}
// 夜は近くの街灯にだけ点光源を割り当てる（負荷対策）
const LAMP_LIGHTS = Array.from({ length: LOW ? 2 : 6 }, () => { const l = new THREE.PointLight(0xffc98a, 0, 22, 1.6); scene.add(l); return l; });
function updateLampLights(lightUp) {
  const p = player.pos;
  const near = LAMP_POS.map((v) => [v, (v.x - p.x) ** 2 + (v.z - p.z) ** 2]).sort((a, b) => a[1] - b[1]);
  LAMP_LIGHTS.forEach((l, i) => { const v = near[i][0]; l.position.set(v.x, v.y + LAMP_H + 0.05, v.z); l.intensity = lightUp * 18; });
}
const lampGlow = (() => {
  const p = new Float32Array(LAMP_POS.length * 3);
  LAMP_POS.forEach((v, i) => { p[i * 3] = v.x; p[i * 3 + 1] = v.y + LAMP_H + 0.05; p[i * 3 + 2] = v.z; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd9a0, size: 3.2, map: GLOW_TEX, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pts); return pts;
})();

// ---------------------------------------------------------------------------
// イチョウ並木
// ---------------------------------------------------------------------------
const trees = [];
// 樹形バリエーション（3種）：細身の尖塔型 / 標準の円錐 / 段のある少し幅広の円錐
const VARIANTS = [
  { rr: 0.235, tiers: 0, branchUp: [0.95, 1.25], shell: [0.82, 1.04] },
  { rr: 0.27, tiers: 0, branchUp: [0.8, 1.15], shell: [0.78, 1.06] },
  { rr: 0.3, tiers: 4, branchUp: [0.7, 1.05], shell: [0.72, 1.08] },
];
// 色づきの個体差：まだ緑が残る木 / 鮮やかな黄色 / 茶色く枯れ始め
const TINTS = ['green', 'vivid', 'vivid', 'vivid', 'vivid', 'brown'];
const TREE_H_MAX = 24;
function addTree(x, z, h) {
  const y0 = 3.4 + rand(-0.3, 0.4);
  const H = h - y0;
  const variant = (Math.random() * 3) | 0;
  trees.push({
    x, z, h, y0, H, R: H * VARIANTS[variant].rr * rand(0.95, 1.05), variant,
    tint: TINTS[(Math.random() * TINTS.length) | 0], lod: -1, detailSlot: -1,
    start: trees.length * LEAVES, list: [], growList: null, growT: 0,
    rateMul: rand(0.7, 1.35), acc: 0, cooldown: 0, ratio: 1, dead: false,
  });
}
// 4列の並木：各32本 × 4 = 128本
for (let r = 0; r < ROW_X.length; r++) for (let j = 0; j < PER_ROW; j++) {
  // 青山通り側から絵画館に向かって背が低くなるよう植えられている（遠近法の演出）
  // 高さのスケールを手前 1.00 → 奥 0.70 へ滑らかに縮小（約24m → 約17m）
  const scale = lerp(1.0, 0.7, j / (PER_ROW - 1)) * rand(0.97, 1.03);
  addTree(ROW_X[r] + rand(-0.15, 0.15), -5 - j * SPACING + rand(-0.2, 0.2), TREE_H_MAX * scale);
}
// 横道の2列：各9本 × 2 = 18本（合計146本）
for (const sz of [-1, 1]) for (let k = 0; k < SIDE_N; k++) {
  addTree(-EDGE - 6 - k * SPACING + rand(-0.2, 0.2), SIDE_Z + sz * SIDE_ROW + rand(-0.15, 0.15), rand(18, 20.5));
}

// 風の頂点アニメーション（木全体の大きくゆっくりした揺れ＋葉の細かな揺れ）と
// 逆光で葉が金色に透ける表現（簡易サブサーフェス・スキャッタリング）
const WIND_U = { uTime: { value: 0 }, uWind: { value: 0 }, uSunDirV: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.85, 0.4) }, uSunVis: { value: 1 } };
function applyWind(mat, leafJitter, sssOnly = false) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WIND_U);
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelMatrix * mvPosition;
      ${sssOnly ? '' : `
      float hgt = max(mvPosition.y - 2.5, 0.0);
      float ph = dot(mvPosition.xz, vec2(0.11, 0.07));
      float sway = (sin(uTime * 0.9 + ph) + 0.5 * sin(uTime * 2.1 + ph * 1.7)) * (0.012 + 0.035 * uWind) * hgt * hgt * 0.06;
      mvPosition.x += sway * 0.8; mvPosition.z += sway * 0.5;`}
      ${leafJitter ? `mvPosition.xyz += vec3(sin(uTime * 7.0 + mvPosition.y * 2.3 + mvPosition.x * 1.7), 0.5 * sin(uTime * 5.0 + mvPosition.z * 3.1), cos(uTime * 6.0 + mvPosition.z * 2.1)) * (0.02 + 0.06 * uWind);` : ''}
      mvPosition = viewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
    if (mat.map && mat.alphaTest > 0) {
      sh.fragmentShader = 'uniform vec3 uSunDirV; uniform vec3 uSunCol; uniform float uSunVis;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float sss = pow(max(dot(normalize(-vViewPosition), uSunDirV), 0.0), 5.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSunCol * sss * 0.9 * uSunVis;`);
    }
  };
}

// 葉の房（樹上）
const leafMat = new THREE.MeshLambertMaterial({ map: LEAF_TEX, normalMap: LEAF_TEXS.normal, alphaTest: 0.5, side: THREE.DoubleSide });
applyWind(leafMat, true);
const fallLeafMat = new THREE.MeshLambertMaterial({ map: LEAF_TEX, normalMap: LEAF_TEXS.normal, alphaTest: 0.5, side: THREE.DoubleSide });
applyWind(fallLeafMat, false, true);
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
// LOD：0=至近(〜15m 個々の葉を追加) 1=中景(〜40m 葉の房) 2=遠景(〜100m 房を間引いて大きく) 3=最遠景(円錐の樹冠のみ)
const LOD_DIST = [15, 40, 100];
function leafShown(i, t) { return attached[i] && (t.lod <= 1 || (t.lod === 2 && (i & 1) === 0)); }
function writeLeaf(i, t, k = 1) {
  treeLeaves.setMatrixAt(i, leafShown(i, t) ? leafMatrix(i, k * (t.lod === 2 ? 1.4 : 1)) : ZERO);
}
function writeTreeLeaves(t) {
  for (let k = 0; k < LEAVES; k++) writeLeaf(t.start + k, t);
  treeLeaves.instanceMatrix.addUpdateRange(t.start * 16, LEAVES * 16);
  treeLeaves.instanceMatrix.needsUpdate = true;
}
function ginkgoColor(c, ground = false, tint = 'vivid') {
  const r = Math.random();
  if (ground) c.setHSL(rand(0.1, 0.135), rand(0.75, 0.95), rand(0.42, 0.56));
  else if (tint === 'green' && r < 0.45) c.setHSL(rand(0.15, 0.2), rand(0.55, 0.75), rand(0.38, 0.5));
  else if (tint === 'brown' && r < 0.4) c.setHSL(rand(0.07, 0.1), rand(0.55, 0.75), rand(0.32, 0.44));
  else if (r < 0.05) c.setHSL(rand(0.15, 0.18), rand(0.6, 0.8), rand(0.42, 0.5));   // 少し青みの残る葉
  else c.setHSL(rand(0.115, 0.14), rand(0.85, 1.0), rand(0.48, 0.6));
  return c;
}

trees.forEach((t) => {
  for (let k = 0; k < LEAVES; k++) {
    const i = t.start + k;
    const V = VARIANTS[t.variant];
    let s = 1 - Math.sqrt(Math.random());     // 下ほど密
    if (V.tiers) s = Math.min(0.97, Math.floor(s * V.tiers) / V.tiers + Math.pow(Math.random(), 2) / V.tiers); // 段状
    const y = t.y0 + s * t.H * 0.97;
    const rr = t.R * (1 - s) * rand(V.shell[0], V.shell[1]) + 0.25;
    const a = Math.random() * Math.PI * 2;
    lPos[i * 3] = t.x + Math.cos(a) * rr; lPos[i * 3 + 1] = y; lPos[i * 3 + 2] = t.z + Math.sin(a) * rr;
    _q.setFromEuler(_e.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)));
    lQuat.set([_q.x, _q.y, _q.z, _q.w], i * 4);
    lScale[i] = rand(0.8, 1.2);
    ginkgoColor(_c, false, t.tint); lColor.set([_c.r, _c.g, _c.b], i * 3);
    treeLeaves.setColorAt(i, _c);
  }
});
scene.add(treeLeaves);

// 幹・枝・樹冠の芯
const BARK = barkTextures();
const barkMat = new THREE.MeshStandardMaterial({ map: BARK.map, normalMap: BARK.normal, roughnessMap: BARK.rough, roughness: 1, metalness: 0 });
applyWind(barkMat, false);
const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.62, 1, 10).translate(0, 0.5, 0), barkMat, trees.length);
const BR_PER = 26;
const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.11, 1, 5).translate(0, 0.5, 0), barkMat, trees.length * BR_PER);
const coneMat = lambert(0xffffff, { map: canopyTexture(), side: THREE.DoubleSide });
applyWind(coneMat, false);
const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, 0.5, 0), coneMat, trees.length);
trees.forEach((t, ti) => cones.setColorAt(ti, _c.setHSL(t.tint === 'green' ? 0.15 : t.tint === 'brown' ? 0.1 : 0.125, 0.55, t.tint === 'brown' ? 0.52 : 0.62)));
cones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
trunks.castShadow = branches.castShadow = cones.castShadow = true;
cones.receiveShadow = true;
trees.forEach((t, ti) => {
  _m.compose(_v.set(t.x, 0, t.z), _q.identity(), _s.set(1, t.h, 1)); trunks.setMatrixAt(ti, _m);
  for (let b = 0; b < BR_PER; b++) {
    const s = (b + Math.random()) / BR_PER;
    // 葉を落とすと、上向きに伸びる枝が細い円錐のシルエットをつくる
    const y = t.y0 - 0.6 + s * t.H * 0.88;
    const a = Math.random() * Math.PI * 2, up = rand(...VARIANTS[t.variant].branchUp);
    const sr = Math.max(0, (y - t.y0) / t.H);
    const len = Math.max(0.5, t.R * (1 - sr) / (Math.cos(up) + t.R * Math.sin(up) / t.H)) * rand(0.85, 1.0);
    const th = 0.6 + len / t.R;
    const dir = _v.set(Math.cos(a) * Math.cos(up), Math.sin(up), Math.sin(a) * Math.cos(up)).normalize();
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    _m.compose(new THREE.Vector3(t.x, y, t.z), _q, _s.set(th, len, th));
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

// LOD 0 用：至近の木にだけ、小さな個々の葉を追加で描く
const DETAIL_SLOTS = LOW ? 3 : 8, DETAIL_N = LOW ? 500 : 1100;
const detailMesh = new THREE.InstancedMesh(leafGeo, leafMat, DETAIL_SLOTS * DETAIL_N);
detailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
detailMesh.frustumCulled = false;
for (let i = 0; i < DETAIL_SLOTS * DETAIL_N; i++) { detailMesh.setMatrixAt(i, ZERO); detailMesh.setColorAt(i, _c.set(1, 1, 1)); }
scene.add(detailMesh);
const detailSlots = Array.from({ length: DETAIL_SLOTS }, () => ({ tree: null, ratio: -1, pos: new Float32Array(DETAIL_N * 3), quat: new Float32Array(DETAIL_N * 4), sc: new Float32Array(DETAIL_N) }));
function fillDetailSlot(si, t) {
  const sl = detailSlots[si], V = VARIANTS[t.variant];
  sl.tree = t; t.detailSlot = si;
  for (let k = 0; k < DETAIL_N; k++) {
    const sv = 1 - Math.sqrt(Math.random());
    const y = t.y0 + sv * t.H * 0.97, rr = t.R * (1 - sv) * rand(V.shell[0] + 0.05, V.shell[1]) + 0.2, a = rand(0, 6.28);
    sl.pos.set([t.x + Math.cos(a) * rr, y, t.z + Math.sin(a) * rr], k * 3);
    _q.setFromEuler(_e.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)));
    sl.quat.set([_q.x, _q.y, _q.z, _q.w], k * 4);
    sl.sc[k] = rand(0.24, 0.36);
    detailMesh.setColorAt(si * DETAIL_N + k, ginkgoColor(_c, false, t.tint));
  }
  detailMesh.instanceColor.needsUpdate = true;
  sl.ratio = -1;
}
function writeDetailSlot(si) {
  const sl = detailSlots[si], t = sl.tree;
  const shown = t ? Math.floor(DETAIL_N * t.ratio) : 0;
  for (let k = 0; k < DETAIL_N; k++) {
    if (k < shown) {
      _v.set(sl.pos[k * 3], sl.pos[k * 3 + 1], sl.pos[k * 3 + 2]);
      _q.set(sl.quat[k * 4], sl.quat[k * 4 + 1], sl.quat[k * 4 + 2], sl.quat[k * 4 + 3]);
      detailMesh.setMatrixAt(si * DETAIL_N + k, _m.compose(_v, _q, _s.setScalar(sl.sc[k])));
    } else detailMesh.setMatrixAt(si * DETAIL_N + k, ZERO);
  }
  detailMesh.instanceMatrix.addUpdateRange(si * DETAIL_N * 16, DETAIL_N * 16);
  detailMesh.instanceMatrix.needsUpdate = true;
  sl.ratio = t ? t.ratio : -1;
}
let lodTimer = 0;
function updateLOD(dt) {
  lodTimer -= dt;
  if (lodTimer > 0) return;
  lodTimer = 0.25;
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  const near = [];
  for (const t of trees) {
    const d = Math.max(0, Math.hypot(t.x - cx, t.z - cz, Math.max(0, cy - t.h)) - t.R * 0.6);
    t.camDist = d;
    const lod = d < LOD_DIST[0] ? 0 : d < LOD_DIST[1] ? 1 : d < LOD_DIST[2] ? 2 : 3;
    if (lod !== t.lod) {
      const was = t.lod; t.lod = lod;
      if (!((was === 0 || was === 1) && (lod === 0 || lod === 1))) writeTreeLeaves(t);
    }
    if (lod === 0) near.push(t);
  }
  near.sort((a, b) => a.camDist - b.camDist);
  const want = new Set(near.slice(0, DETAIL_SLOTS));
  detailSlots.forEach((sl, si) => { if (sl.tree && !want.has(sl.tree)) { sl.tree.detailSlot = -1; sl.tree = null; writeDetailSlot(si); } });
  for (const t of want) {
    if (t.detailSlot >= 0) continue;
    const si = detailSlots.findIndex((sl) => !sl.tree);
    if (si >= 0) { fillDetailSlot(si, t); writeDetailSlot(si); }
  }
  detailSlots.forEach((sl, si) => { if (sl.tree && Math.abs(sl.tree.ratio - sl.ratio) > 0.015) writeDetailSlot(si); });
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
const fallMesh = new THREE.InstancedMesh(leafGeo, fallLeafMat, FALL_MAX);
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
  // 歩道は黄金の絨毯、植樹帯にも、車道は端に寄った落ち葉
  for (let k = 0; k < 26000; k++) {
    const sd = Math.random() < 0.5 ? -1 : 1, r = Math.random();
    const x = sd * (r < 0.62 ? rand(WALK_IN, WALK_OUT) : r < 0.82 ? rand(ROAD_HW, WALK_IN) : r < 0.92 ? rand(WALK_OUT, EDGE) : rand(5.5, ROAD_HW));
    addGroundLeaf(x, rand(AVE_END, AVE_START), undefined, true);
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
const LANES = [[WALK_IN + 0.6, WALK_OUT - 0.6], [-WALK_OUT + 0.6, -WALK_IN - 0.6]];
function spawnPerson(p, nearPlayer) {
  const lane = LANES[Math.random() < 0.5 ? 0 : 1];
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
const JUMP_MIN = 0.8, JUMP_MAX = 23.5;   // ためジャンプの高さ（MAXで木のてっぺんに届く）
const CHARGE_SEC = 1.3;
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
    const [dx, dz] = carLocal(c, x, z);
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
  const prevY = p.y, prevX = p.x;

  // 車に乗っていれば一緒に運ばれる
  if (player.riding && player.riding.active) {
    const c = player.riding, d = c.v * c.dir * dt;
    if (c.axis === 'z') p.z += d; else p.x += d;
  }

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
      if (d < 1.2 && p.y < t.h - 0.6) {
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
      p.x = t.x + dx / d * 0.85; p.z = t.z + dz / d * 0.85;
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
  if (p.z > R246.south) { p.x = clamp(p.x, -120, 120); p.z = Math.min(p.z, R246.north - 0.5); if (p.z < R246.walkS && Math.abs(p.x) > EDGE - 0.3) p.x = Math.sign(p.x) * Math.max(Math.abs(p.x), 0) ; }
  else if (p.z > AVE_END - 2) {
    const inSide = Math.abs(p.z - SIDE_Z) < SIDE_ROW + 1.8 && p.x < -EDGE + 0.5;
    p.x = clamp(p.x, inSide ? -EDGE - SIDE_LEN + 0.5 : -EDGE + 0.3, EDGE - 0.3);
    if (p.x < -EDGE + 0.3) p.z = clamp(p.z, SIDE_Z - SIDE_ROW - 1.8, SIDE_Z + SIDE_ROW + 1.8);
    else if (Math.abs(p.z - SIDE_Z) >= SIDE_ROW + 1.8 && prevX < -EDGE + 0.3) p.x = -EDGE + 0.3;
  } else p.x = clamp(p.x, -45, 45);
  p.z = clamp(p.z, GALLERY_Z + 18, R246.north - 0.5);
  // 柵（低い位置では越えられない。切れ目からは出入りできる）
  if (p.y < 0.9 && p.z < AVE_START && p.z > AVE_END && !inGap(p.z)) {
    for (const X of FENCE_X) {
      if ((prevX - X) * (p.x - X) < 0 || Math.abs(p.x - X) < 0.2) { p.x = X + (prevX >= X ? 0.25 : -0.25); }
    }
  }
  // 街灯・ベンチ・ボラード・池などの障害物（高さを越えていれば乗り越えられる）
  for (const o of OBST) {
    if (p.y >= o.h) continue;
    const dx = p.x - o.x, dz = p.z - o.z, rr = o.r + 0.3;
    if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
    const d = Math.hypot(dx, dz);
    if (d < rr && d > 1e-4) { p.x = o.x + dx / d * rr; p.z = o.z + dz / d * rr; }
  }
  // 幹のカプセルコライダー（葉・枝には当たり判定なし）
  if (p.y < 2.5 && !player.climbing) for (const t of trees) {
    const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz);
    if (d < 0.85 && d > 1e-4) { p.x = t.x + dx / d * 0.85; p.z = t.z + dz / d * 0.85; }
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
const CAR_COLORS = [0xc3c7cc, 0x121316, 0x121316, 0xf1f1ee, 0xf1f1ee, 0x1d2f5a, 0x8f1717, 0x26392f, 0x5a5f66, 0x6b6e73];
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
const tireMat = lambert(0x161616), chromeMat = lambert(0xc9cbce);
const headMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
const tailMat = new THREE.MeshBasicMaterial({ color: 0x661010 });
const paintMats = CAR_COLORS.map((c) => new THREE.MeshPhongMaterial({ color: c, shininess: 90, specular: 0x666666 }));
// 車種ごとにマテリアル別のジオメトリを1つに結合しておく（描画を軽くする）
const CAR_GEOS = {};
for (const [type, s] of Object.entries(CAR_SPECS)) {
  const parts = { paint: [], glass: [], tire: [], chrome: [], head: [], tail: [] };
  const box = (k, w, h, d, x, y, z) => parts[k].push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  box('paint', s.W, s.bodyTop - s.bodyBot, s.L, 0, (s.bodyTop + s.bodyBot) / 2, 0);
  box('paint', s.W * 0.96, 0.06, s.L * 0.3, 0, s.bodyTop + 0.02, -s.L * 0.3);
  const cabH = s.roof - s.bodyTop;
  box('glass', s.cabW, cabH * 0.8, s.cabL, 0, s.bodyTop + cabH * 0.4, s.cabOff);
  box('paint', s.cabW * 0.98, cabH * 0.22, s.cabL * 0.86, 0, s.roof - cabH * 0.11, s.cabOff + 0.05);
  for (const sx of [-1, 1]) {
    box('paint', 0.06, cabH * 0.8, 0.12, sx * s.cabW / 2, s.bodyTop + cabH * 0.4, s.cabOff);
    box('head', 0.42, 0.12, 0.05, sx * (s.W / 2 - 0.3), s.bodyTop - 0.15, -s.L / 2 - 0.01);
    box('tail', 0.4, 0.12, 0.05, sx * (s.W / 2 - 0.3), s.bodyTop - 0.12, s.L / 2 + 0.01);
    box('chrome', 0.03, 0.05, s.L * 0.8, sx * (s.W / 2 + 0.01), s.bodyBot + 0.25, 0);
  }
  box('chrome', s.W * 0.36, 0.2, 0.05, 0, s.bodyTop - 0.28, -s.L / 2 - 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.tire.push(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14).rotateZ(Math.PI / 2).translate(sx * (s.W / 2 - 0.08), 0.36, sz * s.L * 0.32));
    parts.chrome.push(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 10).rotateZ(Math.PI / 2).translate(sx * (s.W / 2 - 0.08), 0.36, sz * s.L * 0.32));
  }
  CAR_GEOS[type] = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, mergeGeometries(v)]));
}
function makeCar(type, colorIdx) {
  const g = new THREE.Group(), G = CAR_GEOS[type];
  const mats = { paint: paintMats[colorIdx % paintMats.length], glass: glassMat, tire: tireMat, chrome: chromeMat, head: headMat, tail: tailMat };
  for (const k of Object.keys(G)) { const m = new THREE.Mesh(G[k], mats[k]); m.castShadow = k === 'paint' || k === 'glass'; g.add(m); }
  g.visible = false;
  scene.add(g);
  return g;
}
// 車の状態：axis 'z'（並木の車道）または 'x'（青山通り）、s=進行方向の位置、lat=横位置、dir=±1
function carWorld(c) { return c.axis === 'z' ? [c.lat, c.s] : [c.s, c.lat]; }
function carLocal(c, x, z) { // → [横, 後ろ向きの距離]（前方が負）
  const along = c.axis === 'z' ? z : x, lat = c.axis === 'z' ? x - c.lat : z - c.lat;
  return [lat, -(along - c.s) * c.dir];
}
function placeCar(c) {
  const [x, z] = carWorld(c);
  c.mesh.position.set(x, c.parked ? 0.0 : 0, z);
  // モデルは -z が前
  c.mesh.rotation.y = c.axis === 'z' ? (c.dir < 0 ? 0 : Math.PI) : (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
}
const cars = [];
let carSeq = 0;
function newCar(props) {
  const type = CAR_TYPES[carSeq % CAR_TYPES.length];
  const c = { active: false, parked: false, type, spec: CAR_SPECS[type], mesh: makeCar(type, (carSeq * 7) % CAR_COLORS.length), axis: 'z', s: 0, lat: 0, dir: 1, v: 0, vMax: 10, honk: 0, ...props };
  carSeq++; cars.push(c); return c;
}
// 並木の車道：片側1車線（左側通行）。路肩には縦列駐車の車
const AVE_LANES = [{ axis: 'z', lat: -1.6, dir: -1 }, { axis: 'z', lat: -4.6, dir: -1 }, { axis: 'z', lat: 1.6, dir: 1 }, { axis: 'z', lat: 4.6, dir: 1 }]; // 片側2車線
const AVE_Z_NEAR = R246.walkS - 2, AVE_Z_FAR = AVE_END - 12;
for (let i = 0; i < 16; i++) newCar({ pool: 'ave' });
// 青山通り：片側3車線
const R246_LANES = [];
for (let k = 0; k < 3; k++) {
  R246_LANES.push({ axis: 'x', lat: R246.walkS + 2.6 + k * 3.4, dir: 1 });
  R246_LANES.push({ axis: 'x', lat: R246.walkN - 2.6 - k * 3.4, dir: -1 });
}
const X246 = 240;
for (let i = 0; i < (LOW ? 16 : 26); i++) newCar({ pool: '246' });
// 駐車車両
{
  for (const sd of [-1, 1]) {
    let z = 2;
    while (z > AVE_END + 8) {
      z -= rand(6.5, 9);
      if (Math.random() < (LOW ? 0.35 : 0.6) && !GAP_Z.some((g) => Math.abs(g - z) < 4)) {
        const c = newCar({ pool: 'parked', parked: true, active: true, axis: 'z', lat: sd * (ROAD_HW - 1.05), s: z, dir: sd > 0 ? 1 : -1 });
        c.mesh.visible = true; placeCar(c);
      }
    }
  }
}
function carFactor(h) { return clamp(hourFactor(h) * 1.1, 0.2, 1); }
const STOP_PLUS = -WALK_IN - 2.2 - 4.5, STOP_MINUS = -WALK_IN - 2.2 + 4.5; // 青山通りの停止線
function spawnInLane(lane, pool, startS, minGap, vRange) {
  const inLane = cars.filter((c) => c.active && c.pool === pool && c.lat === lane.lat);
  if (!inLane.every((c) => Math.abs(c.s - startS) > minGap)) return;
  const c = cars.find((k) => !k.active && k.pool === pool);
  if (!c) return;
  Object.assign(c, { active: true, axis: lane.axis, lat: lane.lat, dir: lane.dir, s: startS, honk: 0 });
  c.vMax = c.type === 'coupe' ? rand(vRange[1] - 1, vRange[1] + 2) : rand(vRange[0], vRange[1]);
  c.v = c.vMax; c.mesh.visible = true; placeCar(c);
}
let signalNow = 'green';
function updateCars(dt, hour, allowHit) {
  const f = carFactor(hour);
  for (const lane of AVE_LANES) {
    const n = cars.filter((c) => c.active && c.pool === 'ave' && c.lat === lane.lat).length;
    if (n < Math.round(3 * f) && Math.random() < dt * 0.4) spawnInLane(lane, 'ave', lane.dir < 0 ? AVE_Z_NEAR : AVE_Z_FAR, 30, [8, 11]);
  }
  for (const lane of R246_LANES) {
    const n = cars.filter((c) => c.active && c.pool === '246' && c.lat === lane.lat).length;
    if (n < Math.round(4 * f) && Math.random() < dt * 0.7) spawnInLane(lane, '246', lane.dir > 0 ? -X246 : X246, 25, [11, 15]);
  }
  const p = player.pos;
  for (const c of cars) {
    if (!c.active || c.parked) continue;
    let v = c.vMax;
    for (const o of cars) {
      if (o === c || !o.active || o.parked || o.lat !== c.lat || o.axis !== c.axis) continue;
      const gap = (o.s - c.s) * c.dir;
      if (gap > 0 && gap < 16) v = Math.min(v, o.v * clamp((gap - 6) / 10, 0, 1));
    }
    // 青山通りの信号
    if (c.pool === '246' && signalNow !== 'green') {
      const stop = c.dir > 0 ? STOP_PLUS : STOP_MINUS;
      const dist = (stop - c.s) * c.dir - c.spec.L / 2;
      if (dist > -0.5 && (signalNow === 'red' || dist > 8)) v = Math.min(v, Math.max(0, dist) * 0.8);
    }
    c.v = lerp(c.v, v, Math.min(1, dt * 2.5));
    c.s += c.v * c.dir * dt;
    const out = c.pool === 'ave' ? ((c.dir < 0 && c.s < AVE_Z_FAR) || (c.dir > 0 && c.s > AVE_Z_NEAR)) : Math.abs(c.s) > X246;
    if (out) { c.active = false; c.mesh.visible = false; if (player.riding === c) player.riding = null; continue; }
    placeCar(c);
    // 前方の人に気づいてクラクション
    c.honk -= dt;
    const [lat, back] = carLocal(c, p.x, p.z);
    if (allowHit && c.honk <= 0 && Math.abs(lat) < 1.8 && -back > 3 && -back < 22 && p.y < c.spec.roof) { sfx.horn(); c.honk = 4; }
  }
}
// 車との当たり：走っている車にぶつかるとゲームオーバー（屋根の上に乗っているなら安全）。止まっている車は障害物
function carHitsPlayer() {
  const p = player.pos;
  for (const c of cars) {
    if (!c.active || player.riding === c) continue;
    const [lat, back] = carLocal(c, p.x, p.z);
    const hw = c.spec.W / 2 + 0.25, hl = c.spec.L / 2 + 0.25;
    if (Math.abs(lat) > hw || Math.abs(back) > hl) continue;
    const onCab = Math.abs(back - c.spec.cabOff) < c.spec.cabL / 2;
    const top = onCab ? c.spec.roof : c.spec.bodyTop;
    if (p.y >= top - 0.35) continue;
    if (c.parked || c.v < 0.3) {
      // 障害物として押し出す
      const [x, z] = carWorld(c);
      if (c.axis === 'z') { const ox = hw - Math.abs(lat), oz = hl - Math.abs(back); if (ox < oz) p.x = x + Math.sign(lat || 1) * hw; else p.z = z + Math.sign(p.z - z || 1) * hl; }
      else { const oz = hw - Math.abs(lat), ox = hl - Math.abs(back); if (oz < ox) p.z = z + Math.sign(lat || 1) * hw; else p.x = x + Math.sign(p.x - x || 1) * hl; }
      continue;
    }
    return true;
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
  const mx = (x) => (x + 21) / 42 * W;
  const zz = (z) => 10 + (z - AVE_END + 4) / (AVE_START - AVE_END + 4) * (H - 20);
  mctx.fillStyle = 'rgba(80,80,90,.6)'; mctx.fillRect(mx(-ROAD_HW), 6, mx(ROAD_HW) - mx(-ROAD_HW), H - 12);
  mctx.fillStyle = 'rgba(200,170,80,.35)'; for (const sd of [-1, 1]) mctx.fillRect(mx(sd > 0 ? WALK_IN : -WALK_OUT), 6, mx(WALK_OUT) - mx(WALK_IN), H - 12);
  for (const t of trees) {
    const r = t.ratio;
    mctx.fillStyle = r <= 0 ? 'rgba(90,70,50,.9)' : `hsl(${lerp(0, 48, Math.min(1, r * 1.6))},${r < 0.3 ? 95 : 90}%,${r < 0.3 ? 55 : 55}%)`;
    mctx.beginPath(); mctx.arc(mx(t.x), zz(t.z), r <= 0 ? 1.5 : 2.4, 0, 6.29); mctx.fill();
  }
  // プレイヤー
  const px = mx(clamp(player.pos.x, -21, 21)), pz = zz(clamp(player.pos.z, AVE_END - 4, AVE_START));
  mctx.save(); mctx.translate(px, pz); mctx.rotate(-player.yaw);
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4, 4); mctx.lineTo(-4, 4); mctx.closePath(); mctx.fill();
  mctx.restore();
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
  WIND_U.uSunVis.value = smooth(-0.02, 0.1, sy) * (1 - smooth(0.5, 0.9, sy) * 0.5);
  sunShaft = smooth(0.02, 0.12, sy) * (1 - smooth(0.25, 0.5, sy)) * 0.22 + smooth(0.1, 0.3, sy) * 0.05;
  WIND_U.uSunCol.value.setRGB(1, lerp(0.85, 0.6, duskF), lerp(0.45, 0.2, duskF));
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
  coneMat.emissive.setRGB(0.07 * lightUp, 0.04 * lightUp, 0.0);
  fallLeafMat.emissive.copy(leafMat.emissive);
  headMat.color.setRGB(lerp(0.75, 1.6, lightUp), lerp(0.75, 1.5, lightUp), lerp(0.75, 1.2, lightUp));
  tailMat.color.setRGB(lerp(0.4, 1.4, lightUp), 0.05, 0.05);
  lampHeadMat.color.setRGB(lerp(0.35, 1.0, lightUp), lerp(0.35, 0.86, lightUp), lerp(0.35, 0.6, lightUp));
  lampGlow.material.opacity = lightUp * 0.9;
  updateLampLights(lightUp);
  shaftMat.opacity = sunShaft;
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
  player.pos.set(13.8, 0.12, 6); player.vy = 0; player.yaw = 0; player.pitch = 0.08; player.charge = 0; player.climbing = null; player.riding = null; player.onGround = true;
  cars.forEach((c) => { if (!c.parked) { c.active = false; c.mesh.visible = false; } });
  for (let i = 0; i < FALL_MAX; i++) if (fActive[i]) freeFalling(i);
  for (let i = 0; i < GROUND_MAX; i++) groundMesh.setMatrixAt(i, ZERO);
  groundIdx = 0;
  scatterInitialGround();
  trees.forEach((t, ti) => {
    t.list.length = 0; t.growList = null; t.cooldown = 0; t.acc = 0; t.dead = false;
    const keep = Math.floor(LEAVES * rand(0.6, 1.0)); // 散り具合はまちまち
    for (let k = 0; k < LEAVES; k++) {
      const i = t.start + k;
      if (k < keep) { attached[i] = 1; t.list.push(i); } else attached[i] = 0;
      writeLeaf(i, t);
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
      for (const i of t.growList) writeLeaf(i, t, e);
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
player.pos.set(13.8, 0.12, 6);
const clock = new THREE.Clock();
let titleT = 0;
function frame() {
  requestAnimationFrame(frame);
  step(Math.min(clock.getDelta(), 0.05));
  updateLOD(0.05);
  updateShafts();
  camera.updateMatrixWorld();
  WIND_U.uSunDirV.value.copy(_sunDir).transformDirection(camera.matrixWorldInverse);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  renderer.render(scene, camera);
}
function step(dt) {
  WIND_U.uTime.value += dt;
  WIND_U.uWind.value = wind.gust;
  fountain(dt);
  if (state === 'play') {
    elapsed += dt;
    updateWind(dt);
    const hour0 = dayLabel(elapsed).hour;
    signalNow = updateSignals(elapsed);
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
    camera.position.set(0, 1.6 + Math.sin(titleT * 0.2) * 0.2, 14 - (titleT * 2.0) % 100);
    camera.rotation.set(0.04, 0, 0); // 正面奥に絵画館のドームが収まる
    player.pos.set(camera.position.x, 0, camera.position.z);
    // 演出として葉を降らせる
    for (let k = 0; k < 6; k++) {
      const t = trees[(Math.random() * trees.length) | 0];
      if (Math.abs(t.z - camera.position.z) < 60) { const i = t.start + ((Math.random() * LEAVES) | 0); spawnFalling(lPos[i * 3], lPos[i * 3 + 1], lPos[i * 3 + 2]); }
    }
    updateFalling(dt);
    updateSky(START_HOUR + 1.5);
    updatePeople(dt, 1, START_HOUR + 2);
    signalNow = updateSignals(titleT);
    updateCars(dt, START_HOUR + 2, false);
  }
}
frame();

// デバッグ用（ブラウザのコンソールから）
window.__icho = { scene, THREE, trees, player, cars, step(dt, n = 1) { for (let i = 0; i < n; i++) step(dt); }, get state() { return state; }, get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; } };
