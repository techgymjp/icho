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
const LEAVES = 380;                 // 1本あたりの葉の房
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
scene.fog = new THREE.Fog(0xcfd8e0, 120, 3200);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 6000);
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
  a.globalCompositeOperation = 'multiply'; a.fillStyle = '#9a8268'; a.fillRect(0, 0, W, H);
  a.globalCompositeOperation = 'source-over';
  for (let i = 0; i < W; i++) { a.fillStyle = `rgba(${Math.random() < 0.3 ? '110,120,80' : '60,50,40'},${rand(0.05, 0.15)})`; a.fillRect(Math.random() * W, Math.random() * H, rand(4, 30), rand(4, 30)); }
  const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
  const r = rc.getContext('2d'); r.fillStyle = '#e0e0e0'; r.fillRect(0, 0, W, H); r.globalAlpha = 0.4; r.drawImage(hc, 0, 0);
  const wrap = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 5); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: wrap(ac, true), normal: wrap(normalFromHeight(hc, 4)), rough: wrap(rc) };
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
const sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 32, 16), new THREE.ShaderMaterial({
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
    p[i * 3] = Math.cos(th) * r * 4200; p[i * 3 + 1] = v * 4200; p[i * 3 + 2] = Math.sin(th) * r * 4200;
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
const SIDE_Z = -5 - 12 * 9 + 4.5, SIDE_ROW = 7, SIDE_N = 9, SIDE_HW = 5, SIDE_LEN = 6 + 8 * 9 + 8;
const R246 = { south: 10, walkS: 16, median0: 29.5, median1: 32.5, walkN: 46, north: 52 };
const CAFE_Z0 = -4, CAFE_Z1 = -30;   // 並木西側・入口すぐのカフェ
// 円周道路：内側は軟式グラウンドなどの広場（半径約110m）。絵画館はその北側
const RING_R0 = 112, RING_R1 = 126;
const RING_Z = AVE_END - 5 - RING_R1 - 5, GALLERY_Z = RING_Z - RING_R1 - 80;
// 柵の切れ目（横断できる場所）
const GAP_Z = []; for (let j = 0; j < 32; j += 5) GAP_Z.push(-9.5 - j * SPACING);
GAP_Z.push(SIDE_Z); // 横道への出入口
const inGap = (z) => GAP_Z.some((g) => Math.abs(z - g) < 1.3);
// 柵のライン：車道沿いのガードフェンス、歩道両側の杭とロープ
const GUARD_X = ROAD_HW + 0.35;
const FENCE_X = [-(WALK_OUT + 0.25), -(WALK_IN - 0.25), -GUARD_X, GUARD_X, WALK_IN - 0.25, WALK_OUT + 0.25];
// 円形の障害物（ボラード・池など）：{x, z, r, h}
const OBST = [];
// ブロック内で追加した物を東西反転する（南西の角はカフェ・石垣・伊藤忠ビルの側）
function mirrorX(fn) {
  const n0 = scene.children.length, o0 = OBST.length;
  fn();
  for (let i = n0; i < scene.children.length; i++) { const o = scene.children[i]; o.position.x *= -1; o.rotation.y *= -1; }
  for (let i = o0; i < OBST.length; i++) OBST[i].x *= -1;
}
function groundY(x, z) {
  const ax = Math.abs(x);
  if (z > R246.south) return (z < R246.walkS && ax > ROAD_HW) || (z > R246.walkN && z < R246.north + 30) ? 0.12 : 0;
  if (x < -EDGE + 0.1 && x > -EDGE - SIDE_LEN && Math.abs(z - SIDE_Z) < SIDE_ROW + 2) return 0.12; // 横道（西側）
  { const rd = Math.hypot(x, z - RING_Z); if (rd > RING_R1 && rd < RING_R1 + 5) return 0.12; } // 円周道路の外側の歩道
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
const ROAD_LEN = AVE_START + 5 - (RING_Z + RING_R1 - 6);
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
  for (let i = 0; i < 500; i++) {
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
  // 西側はカフェの前と横道の入口で途切れる
  const opens = s > 0 ? [] : [[CAFE_Z0, CAFE_Z1], [w0, w1]];
  let top = AVE_START;
  for (const [a, b] of [...opens, [AVE_END, AVE_END]]) {
    if (top - a > 0.5) addBox(0.12, 1.3, top - a, s * (EDGE + 0.2), 0.65, (top + a) / 2, board);
    top = b;
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
function windowTexture(lit) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = lit ? '#000' : '#9aa3ad'; g.fillRect(0, 0, 128, 256);
  for (let y = 4; y < 256; y += 8) for (let x = 3; x < 128; x += 7) {
    if (lit) { if (Math.random() < 0.35) { g.fillStyle = Math.random() < 0.7 ? '#ffd9a0' : '#e8f0ff'; g.fillRect(x, y, 5, 5); } }
    else { g.fillStyle = Math.random() < 0.5 ? '#5f6d7d' : '#71808f'; g.fillRect(x, y, 5, 5); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const nightMats = [];
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
const skylineWin = new THREE.MeshLambertMaterial({ map: windowTexture(false), emissiveMap: windowTexture(true), emissive: 0xffffff, emissiveIntensity: 0 });
// 青山通り沿いのビル：通りの向こう側に、間口の狭い8〜12階建てのオフィスビルが並ぶ
{
  const tones = [0xe9e7e2, 0xd8d6d0, 0xf2f1ee, 0x9fa4aa, 0x5d636b, 0xc9c4ba, 0x3d434b, 0xe0ddd5];
  let x = -260;
  while (x < 260) {
    const w = rand(11, 24), h = rand(26, 50), d = rand(16, 26);
    const tone = tones[(Math.random() * tones.length) | 0];
    const mat = new THREE.MeshLambertMaterial({ color: tone, map: skylineWin.map, emissiveMap: skylineWin.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0 });
    mat.userData.night = true;
    const b = addBox(w, h, d, x + w / 2, h / 2, R246.north + 2 + d / 2 + rand(0, 3), mat);
    b.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = v * (i % 2 ? h / 32 : w / 16); });
    nightMats.push(mat);
    if (Math.random() < 0.4) addBox(w * 0.3, rand(3, 7), d * 0.4, x + w / 2 + rand(-2, 2), h + 2, b.position.z, lambert(0x8d9196)); // 塔屋
    if (Math.random() < 0.6) addBox(w * 0.8, 1.2, 0.3, x + w / 2, rand(4, 7), R246.north + 1.8, lambert([0x2f6db5, 0xb52f2f, 0xf2f2f2, 0x2f8f5a][(Math.random() * 4) | 0])); // 看板
    x += w + rand(0, 1.5);
  }
}
// 青山通りの北側（並木と同じ側）：東の青山一丁目方面はビルが続き、ガラス張りの高層ビルが見える
{
  const tones = [0xeceae5, 0xd5d3cd, 0x46505c, 0x9aa1a8, 0xf1f0ec];
  for (const [x0, x1] of [[190, 420], [-420, -170]]) {
    let x = x0;
    while (x < x1) {
      const w = rand(14, 30), h = rand(28, 60), d = rand(18, 30);
      const mat = new THREE.MeshLambertMaterial({ color: tones[(Math.random() * tones.length) | 0], map: skylineWin.map, emissiveMap: skylineWin.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0 });
      nightMats.push(mat);
      const b = addBox(w, h, d, x + w / 2, h / 2, R246.south - 3 - d / 2, mat);
      b.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = v * (i % 2 ? h / 32 : w / 16); });
      x += w + rand(0, 3);
    }
  }
  // ガラス張りの高層ビル（青山一丁目方面）
  const glassT = new THREE.MeshPhongMaterial({ color: 0x7fa6c8, shininess: 120, specular: 0xbfd8ff });
  addBox(34, 110, 30, 300, 55, -14, glassT);   // 青山一丁目のツインタワー
  addBox(26, 96, 26, 338, 48, -18, glassT);
  addBox(30, 100, 26, 150, 50, R246.north + 30, glassT);  // 青山通り南側のガラスの高層ビル
  addBox(40, 48, 28, 150, 24, -8, lambert(0xe6e4df));
}
// 南西の入口：大きな石を積んだ石垣と、その上の大きな常緑樹。石垣の上に「明治神宮外苑」の看板。カーブする石畳の歩道と区の案内板
const buildCorner = (main) => {
  const rock = new THREE.MeshStandardMaterial({ color: 0x8e8f8a, roughness: 0.95, map: noiseTexture('#8f908b', 0.35, 128, 2500) });
  const X0 = EDGE + 1.5, X1 = EDGE + 30, Z = R246.south - 1.6;
  // 石垣（大小の切り石を積む）
  for (let x = X0; x < X1;) {
    const w = rand(1.2, 2.4);
    for (let y = 0; y < 1.9;) { const h = Math.min(rand(0.5, 0.9), 1.95 - y); addBox(w - 0.06, h - 0.05, 1.2, x + w / 2, y + h / 2, Z + rand(-0.04, 0.04), rock); y += h; }
    x += w;
  }
  addBox(1.2, 1.9, 9, X0 - 0.6, 0.95, Z - 4.5, rock); // 並木側へ折れる石垣
  OBST.push({ x: (X0 + X1) / 2, z: Z, hw: (X1 - X0) / 2, hd: 0.7, h: 1.9 });
  // 石垣の上の大きな常緑樹（クスノキ）と植え込み
  const green = lambert(0x2f4f2a), green2 = lambert(0x3b5e30);
  for (let i = 0; i < 9; i++) { const r = rand(3, 6); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), i % 2 ? green : green2); b.position.set(X0 + 6 + rand(0, 12), 6 + rand(0, 6), Z - 6 + rand(-3, 3)); b.castShadow = true; scene.add(b); }
  addBox(0.8, 6, 0.8, X0 + 12, 3, Z - 6, lambert(0x4a3a2c));
  for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.4, 0.7), 8, 6), lambert(i % 3 ? 0x6e2a24 : 0x3f5a2a)); b.scale.y = 0.6; b.position.set(EDGE - rand(0.5, 3.5), 0.3, R246.south - rand(1, 6)); scene.add(b); }
  // 石畳の歩道（並木の東側歩道へカーブしてつながる）
  const tileTex = noiseTexture('#a7a59f', 0.2, 128, 3000); tileTex.repeat.set(6, 3);
  addPlane(16, 7, WALK_IN + 2.5, R246.south - 1, 0.13, lambert(0xffffff, { map: tileTex }));
  if (!main) return;
  // 港区の案内板（青）
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#1d4f9a'; g.fillRect(0, 0, 256, 512); g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif';
  ['↑ 国立競技場', '↗ 秩父宮ラグビー場', '', 'ⓘ 港区案内地図', '北青山 1-7', '', '青山通り'].forEach((t, i) => g.fillText(t, 20, 60 + i * 60));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.2), [lambert(0x2a2a2a), lambert(0x2a2a2a), lambert(0x2a2a2a), lambert(0x2a2a2a), lambert(0xffffff, { map: tex }), lambert(0xffffff, { map: tex })]);
  sign.position.set(WALK_OUT + 2.4, 1.4, R246.south + 1.5); sign.castShadow = true; scene.add(sign);
  OBST.push({ x: WALK_OUT + 2.4, z: R246.south + 1.5, r: 0.7, h: 2.6 });
  // 石垣の上の看板
  const c2 = document.createElement('canvas'); c2.width = 1024; c2.height = 160; const g2 = c2.getContext('2d');
  g2.fillStyle = '#f4f4f2'; g2.fillRect(0, 0, 1024, 160); g2.fillStyle = '#1f3f8f'; g2.textAlign = 'center';
  g2.font = 'bold 84px serif'; g2.fillText('明 治 神 宮 外 苑', 512, 92); g2.font = 'bold 34px sans-serif'; g2.fillText('MEIJI JINGU OUTER GARDEN', 512, 142);
  const t2 = new THREE.CanvasTexture(c2); t2.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), lambert(0xffffff, { map: t2 }));
  board.position.set(X0 + 6, 2.9, Z + 0.62); board.rotation.y = Math.PI; scene.add(board);
  addBox(10.2, 1.7, 0.1, X0 + 6, 2.9, Z + 0.55, lambert(0x2a2a2a));
};
mirrorX(() => buildCorner(true));  // 南西の角（看板つき）
buildCorner(false);                // 南東の角
// 並木の西側の横道まわり（+x側で作って東西反転）：
// 並木との角の北側にシェイクシャック、南側に神宮テニスクラブ（クラブハウスと白い膜屋根のドーム）、西端は南北の道路と車止め
mirrorX(() => {
  const EX = EDGE + SIDE_LEN, roadX = EX + 9;
  const asp = noiseTexture('#4b4b50', 0.18, 256, 6000); asp.repeat.set(2, 40);
  addPlane(12, 300, roadX, -100, 0.003, lambert(0xffffff, { map: asp }));
  for (let i = 0; i < 7; i++) addPlane(9, 0.5, roadX, SIDE_Z - 6 + i * 2, 0.013, lineMat);   // 横断歩道
  for (let i = 0; i < 6; i++) addBox(0.08, 0.9, 0.08, EX - 1, 0.57, SIDE_Z - 4 + i * 1.6, lambert(0x333333)); // 車止めゲート
  addBox(0.06, 0.06, 8, EX - 1, 1.0, SIDE_Z, lambert(0x333333), false);
  addBox(10, 2, 0.2, EX + 2, 1, SIDE_Z - 2, lambert(0xe0b020)); // 工事の仮囲い
  // シェイクシャック：グレーの切妻屋根の平屋。ガラス張りの店先、木目の看板、テラス席と植え込み
  const W = 16, D = 12, X = EDGE + 4 + W / 2, Z = SIDE_Z - SIDE_ROW - 3 - D / 2;
  const gray = lambert(0x5f6366), dark = lambert(0x2a2c2e), woodM = lambert(0x6b4a33), glass = new THREE.MeshPhongMaterial({ color: 0x2f3a40, shininess: 100 });
  addBox(W, 4.2, D, X, 2.1 + 0.12, Z, glass);
  addBox(W + 0.4, 0.4, D + 0.4, X, 4.5, Z, dark);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, D * 0.62, W + 1, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 6), gray);
  roof.scale.set(1, 0.55, 1); roof.position.set(X, 5.6, Z); roof.castShadow = true; scene.add(roof);
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#4a3322'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff6d8'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.fillText('SHAKE SHACK', 256, 72);
  const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), new THREE.MeshLambertMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.25 }));
  sign.position.set(X, 3.6, Z + D / 2 + 0.25); scene.add(sign);
  addBox(9, 1.6, 0.3, X, 3.6, Z + D / 2 + 0.1, woodM);
  for (let i = 0; i < 4; i++) { const tx = X - 6 + i * 4, tz = Z + D / 2 + 1.8; addBox(0.9, 0.05, 0.9, tx, 0.98, tz, dark); addBox(0.06, 0.74, 0.06, tx, 0.62, tz, dark); }
  OBST.push({ x: X, z: Z, hw: W / 2, hd: D / 2, h: 4.4 });
  // 神宮テニスクラブ：横道の南側。クラブハウス（れんが色と緑の壁、ガラスの温室風の棟）と、白い膜屋根の屋内コート
  const brick = lambert(0xc98f78), green = lambert(0x6f8a6a), glassG = new THREE.MeshPhongMaterial({ color: 0xd6e6ea, shininess: 80, transparent: true, opacity: 0.8 });
  const CZ = SIDE_Z + SIDE_ROW + 3 + 5;
  addBox(16, 7, 10, EDGE + 32, 3.5, CZ, brick);
  addBox(12, 4, 10, EDGE + 20, 2, CZ, glassG);
  addBox(30, 0.6, 11, EDGE + 27, 7.3, CZ, lambert(0x9aa5a8));
  const tc = document.createElement('canvas'); tc.width = 512; tc.height = 64; const tg = tc.getContext('2d');
  tg.fillStyle = '#6b5a45'; tg.fillRect(0, 0, 512, 64); tg.fillStyle = '#f2ead8'; tg.font = 'bold 40px serif'; tg.textAlign = 'center'; tg.fillText('JINGU TENNIS CLUB', 256, 46);
  const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
  const tsn = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.75), lambert(0xffffff, { map: tt })); tsn.rotation.y = Math.PI; tsn.position.set(EDGE + 35, 1.6, CZ - 5.1); scene.add(tsn);
  addBox(14, 1.4, 0.4, EDGE + 32, 0.7, CZ - 5.6, green);
  OBST.push({ x: EDGE + 27, z: CZ, hw: 15, hd: 5, h: 7 });
  const domeM = lambert(0xf3f3f0, { side: THREE.DoubleSide });
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 56, 32, 1, true, 0, Math.PI), domeM);
  dome.rotation.z = Math.PI / 2; dome.scale.set(0.55, 1, 1); dome.position.set(EDGE + 66, 4, CZ + 22); dome.castShadow = true; scene.add(dome);
  addBox(56, 4, 44, EDGE + 66, 2, CZ + 22, glassG);
  for (let i = 0; i < 8; i++) addBox(0.4, 16, 0.4, EDGE + 40 + i * 7.4, 8, CZ, lambert(0x5d7a63)); // 緑の鉄骨
}); 
// 都道414号の標識（並木の車道の入口）
{
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1f5fbf'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); } g.closePath(); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 48px sans-serif'; g.textAlign = 'center'; g.fillText('414', 64, 82); g.font = '14px sans-serif'; g.fillText('都道', 64, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshLambertMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
  m.position.set(-(ROAD_HW + 0.6), 2.8, 4); scene.add(m);
  addBox(0.07, 3.2, 0.07, -(ROAD_HW + 0.6), 1.6, 4.05, lambert(0x9a9da0));
}
// 伊藤忠ビル（並木の入口・西側の角に建つ白い高層オフィスビル）
{
  const X = -76, Z = -1, W = 44, D = 20, H = 92;
  const white = lambert(0x8e8d8f), band = lambert(0x3f4a55);
  addBox(W, H, D, X, H / 2, Z, white);
  for (let y = 8; y < H - 4; y += 4.4) {
    addBox(W * 0.86, 1.5, 0.2, X - 2, y, Z + D / 2 + 0.1, band);    // 青山通り側の水平の窓帯
    addBox(0.2, 1.5, D * 0.8, X + W / 2 + 0.1, y, Z, band);           // 並木側
  }
  addBox(14, H + 8, D, X - W / 2 - 7, (H + 8) / 2, Z, lambert(0x7d7c80)); // 階段室側の高い棟
  const gl = new THREE.MeshPhongMaterial({ color: 0x6f9cc4, shininess: 120, specular: 0xbfd8ff });
  addBox(26, 120, 22, X - W / 2 - 34, 60, Z - 8, gl);   // 隣のガラスの超高層
  for (const dx of [-4, 4]) addBox(0.6, 30, 0.6, X - W / 2 - 34 + dx, 135, Z - 8, lambert(0xbfc3c8)); // 尖塔
  addBox(W * 0.5, 5, 0.3, X - 4, H - 3, Z + D / 2 + 0.2, lambert(0xffffff)); // 屋上のサイン
  addBox(W + 6, 6, D + 4, X, 3, Z, lambert(0x9c9b9d)); // 低層部
}
// 円周道路と内側の広場（生け垣・石のボラード・針葉樹）
{
  const ring = new THREE.Mesh(new THREE.RingGeometry(RING_R0, RING_R1, 128), lambert(0xffffff, { map: asphaltTex }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.004, RING_Z); ring.receiveShadow = true; scene.add(ring);
  const walk = new THREE.Mesh(new THREE.RingGeometry(RING_R1, RING_R1 + 5, 128), lambert(0xa9a49a));
  walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.12, RING_Z); walk.receiveShadow = true; scene.add(walk);
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(RING_R0, 96), lambert(0x7f9a4a));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.01, RING_Z); lawn.receiveShadow = true; scene.add(lawn);
  // 中央線
  const cl = new THREE.Mesh(new THREE.RingGeometry((RING_R0 + RING_R1) / 2 - 0.08, (RING_R0 + RING_R1) / 2 + 0.08, 128), lineMat);
  cl.rotation.x = -Math.PI / 2; cl.position.set(0, 0.012, RING_Z); scene.add(cl);
  // 生け垣（広場の縁）
  const hedge = new THREE.Mesh(new THREE.TorusGeometry(RING_R0 - 2, 0.7, 6, 160), lambert(0x355a2c));
  hedge.rotation.x = Math.PI / 2; hedge.scale.z = 1.3; hedge.position.set(0, 0.6, RING_Z); hedge.castShadow = true; scene.add(hedge);
  // 石のボラード（外側の歩道の縁）
  const n = 260, bol = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.25, 0.7, 10).translate(0, 0.35, 0), lambert(0xc8c3b8), n);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; bol.setMatrixAt(i, _tmpM.makeTranslation(Math.cos(a) * (RING_R1 + 0.5), 0.12, RING_Z + Math.sin(a) * (RING_R1 + 0.5))); }
  scene.add(bol);
  // 広場の周りの針葉樹
  const conM = lambert(0x2c4a2e), con = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0), conM, 90);
  for (let i = 0; i < 90; i++) {
    const a = rand(0, Math.PI * 2), r = rand(RING_R0 - 14, RING_R0 - 4), h = rand(10, 20);
    if (Math.abs(Math.sin(a) + 1) < 0.08 || Math.abs(Math.sin(a) - 1) < 0.08) { con.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); continue; } // 並木と絵画館の正面は空ける
    con.setMatrixAt(i, _tmpM.compose(new THREE.Vector3(Math.cos(a) * r, 0, RING_Z + Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(h * 0.2, h, h * 0.2)));
  }
  con.castShadow = true; scene.add(con);
  // 並木の突き当たりの交差点：横断歩道
  for (let i = 0; i < 9; i++) addPlane(0.5, 4.5, -7 + i * 1.75, AVE_END + 1, 0.013, lineMat);
}
// 聖徳記念絵画館：淡い桃色がかった花崗岩の左右対称の建物（幅約112m）。
// 中央棟に3つの大アーチの玄関、その上に3連アーチ窓の塔、頂部に白い半球ドーム。
// 石積みの基壇（テラス）の上に建ち、正面には石垣で縁取られた池がある
const POND = { z: 0, hw: 36, hd: 11 };
const fountain = (() => {
  const stone = lambert(0xc8b6a0), stoneDark = lambert(0xae9c86), wall = lambert(0x9d8f7c), dark = lambert(0x231f1c), domeM = lambert(0xe9e7e2);
  const Z = GALLERY_Z, F = Z + 17, T = 3.2;    // T: 基壇の高さ
  // アーチ形の開口（黒い面）
  const archGeo = (w, h) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.closePath(); return new THREE.ShapeGeometry(sh, 12); };
  const arch = (w, h, x, y, z, ry = 0) => { const m = new THREE.Mesh(archGeo(w, h), dark); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); };
  // 基壇（テラス）と石垣、正面の大階段
  addBox(124, T, 58, 0, T / 2, Z + 4, wall);
  addBox(124, 0.4, 58, 0, T + 0.2, Z + 4, stoneDark);
  for (let i = 0; i < 9; i++) addBox(16, T / 9, 1.0, 0, (T / 9) * (i + 0.5), F + 16 + (8 - i) * 1.0 - 1.5, stoneDark);
  // 翼棟（低く長い。縦の付柱と細い窓、屋根の縁は緑青色）
  for (const sd of [-1, 1]) {
    addBox(36, 12, 30, sd * 34, T + 6, Z, stone);
    addBox(36.6, 0.6, 30.6, sd * 34, T + 12.3, Z, lambert(0x7c9a8a));
    for (let i = 0; i < 7; i++) { const x = sd * (19 + i * 5); addBox(1.4, 11, 0.5, x, T + 5.8, F - 2 + 0.25, stoneDark); addBox(0.8, 4.5, 0.1, x + sd * 2.5, T + 6, F - 1.95 + 0.05, dark); }
    // 翼端の塔屋（丸窓）
    addBox(12, 15, 32, sd * 56, T + 7.5, Z, stone);
    addBox(12.6, 0.8, 32.6, sd * 56, T + 15.4, Z, stoneDark);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 8, 24), stoneDark); ring.position.set(sd * 56, T + 9, F + 0.1); scene.add(ring);
    const ow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), dark); ow.position.set(sd * 56, T + 9, F + 0.05); scene.add(ow);
  }
  // 中央棟：3つの大アーチの玄関
  addBox(30, 19, 34, 0, T + 9.5, Z + 1, stone);
  addBox(22, 17, 4, 0, T + 8.5, F + 2.6, stone);                       // 玄関の張り出し
  for (let i = -1; i <= 1; i++) { arch(4.6, 11.5, i * 6.4, T, F + 4.62); addBox(1.4, 11.5, 0.6, i * 6.4 + 3.2 * (i === 1 ? 1 : -1) * 0 + (i * 6.4 > 0 ? 3.2 : -3.2), T + 5.75, F + 4.85, stoneDark); }
  addBox(23, 1.2, 5, 0, T + 17.6, F + 2.6, stoneDark);                // 帯
  addBox(31, 1.0, 35, 0, T + 19.5, Z + 1, stoneDark);
  // 3連アーチ窓のある塔
  addBox(19, 8.5, 19, 0, T + 24.2, Z + 1, stone);
  addBox(19.6, 0.8, 19.6, 0, T + 28.8, Z + 1, stoneDark);
  for (let i = -1; i <= 1; i++) { arch(2.6, 4.6, i * 4.2, T + 21.2, Z + 10.56); arch(2.6, 4.6, i * 4.2, T + 21.2, Z - 8.56, Math.PI); }
  for (const sd of [-1, 1]) for (let i = -1; i <= 1; i++) arch(2.6, 4.6, sd * 9.56, T + 21.2, Z + 1 + i * 4.2, sd * Math.PI / 2);
  // 白い半球ドーム
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.6, 1.6, 32), stoneDark); drum.position.set(0, T + 30, Z + 1); scene.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeM);
  dome.scale.y = 0.62; dome.position.set(0, T + 30.8, Z + 1); dome.castShadow = true; scene.add(dome);
  // 正面の池（石垣で縁取られた長方形）
  POND.z = F + 32;
  const rimM = lambert(0xa4957f);
  for (const [w, d, x, z] of [[POND.hw * 2 + 2, 1, 0, POND.z - POND.hd - 0.5], [POND.hw * 2 + 2, 1, 0, POND.z + POND.hd + 0.5], [1, POND.hd * 2, -POND.hw - 0.5, POND.z], [1, POND.hd * 2, POND.hw + 0.5, POND.z]]) addBox(w, 0.9, d, x, 0.45, z, rimM);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(POND.hw * 2, POND.hd * 2), new THREE.MeshPhongMaterial({ color: 0x6f7d52, shininess: 150, specular: 0xffffff, transparent: true, opacity: 0.93 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.3, POND.z); water.receiveShadow = true; scene.add(water);
  OBST.push({ x: 0, z: POND.z, hw: POND.hw + 1, hd: POND.hd + 1, h: 0.9 });
  OBST.push({ x: 0, z: Z + 4, hw: 62, hd: 29, h: T }); // 基壇（ジャンプで上がれる）
  // 刈り込まれた丸い植え込み
  for (const x of [-24, -16, 16, 24]) { const b = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8), lambert(0x3f7d34)); b.scale.y = 0.6; b.position.set(x, T + 1, F + 12); scene.add(b); }
  // 噴水
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 0.8, 16), stoneDark); base.position.set(0, 0.4, POND.z); scene.add(base);
  const N = 700, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8f4ff, size: 0.28, map: GLOW_TEX, transparent: true, opacity: 0.8, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  const reset = (i) => { const a = rand(0, 6.28), sp = rand(0, 0.9); pos.set([Math.cos(a) * 0.2, 0.8, POND.z + Math.sin(a) * 0.2], i * 3); vel.set([Math.cos(a) * sp, rand(8.5, 10.5), Math.sin(a) * sp], i * 3); life[i] = 0; };
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
// 円周道路の内側：軟式グラウンド（4面の土のダイヤモンドとバックネット）
{
  const dirt = lambert(0xb08a5c), net = new THREE.MeshLambertMaterial({ color: 0x333333, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  for (const [cx, cz, rot] of [[-45, RING_Z + 40, 0.6], [45, RING_Z + 40, -0.6], [-45, RING_Z - 35, Math.PI - 0.6], [45, RING_Z - 35, Math.PI + 0.6]]) {
    const g = new THREE.Group();
    const inf = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), dirt); inf.rotation.set(-Math.PI / 2, 0, Math.PI / 4); inf.position.set(0, 0.02, -10); g.add(inf);
    const arc = new THREE.Mesh(new THREE.CircleGeometry(30, 32, Math.PI * 1.25, Math.PI * 0.5), dirt); arc.rotation.x = -Math.PI / 2; arc.position.set(0, 0.015, 8); g.add(arc);
    const bn = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), net); bn.position.set(0, 3, 12); g.add(bn);
    g.position.set(cx, 0, cz); g.rotation.y = rot; scene.add(g);
  }
}
// 並木の西側・入口すぐのロイヤルガーデンカフェ：白い2階建て、2階のバルコニーに木の格子、大きな窓。前庭は植栽とテラス席
mirrorX(() => {
  const beige = lambert(0xf0eee8), wood = lambert(0x5a3f2a), glass = new THREE.MeshPhongMaterial({ color: 0x40505a, shininess: 90 }), white = lambert(0xf1ede4), dark = lambert(0x2b2b2b), canvasM = lambert(0xece4d2, { side: THREE.DoubleSide });
  const X0 = EDGE + 6, X1 = EDGE + 20, L = CAFE_Z0 - CAFE_Z1, ZM = (CAFE_Z0 + CAFE_Z1) / 2;
  addBox(X1 - X0, 3.6, L, (X0 + X1) / 2, 1.8, ZM, glass);                  // 1階（ガラス張り）
  addBox(X1 - X0 + 1.5, 0.4, L + 1, (X0 + X1) / 2 - 0.7, 3.8, ZM, white);  // 庇
  addBox(X1 - X0 - 1, 3.2, L - 4, (X0 + X1) / 2 + 0.5, 5.6, ZM, beige);    // 2階
  addBox(X1 - X0 + 0.6, 0.5, L - 3, (X0 + X1) / 2 + 0.5, 7.45, ZM, white); // 屋根
  for (let z = CAFE_Z1 + 2; z < CAFE_Z0 - 1; z += 3.2) { addBox(0.2, 3.6, 0.25, X0 - 0.05, 1.8, z, wood); addBox(0.15, 1.6, 2.2, X0 + 0.45, 5.5, z + 1.6, glass); }
  // 2階バルコニーの木の格子
  for (let z = CAFE_Z1 + 1; z < CAFE_Z0 - 0.5; z += 0.45) addBox(0.06, 0.9, 0.08, X0 - 0.3, 4.55, z, wood);
  addBox(0.12, 0.1, L, X0 - 0.3, 5.0, ZM, wood);
  // 庇の看板
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 64; const sg = sc.getContext('2d');
  sg.fillStyle = '#f4f2ec'; sg.fillRect(0, 0, 512, 64); sg.fillStyle = '#6b5a45'; sg.font = 'italic bold 40px serif'; sg.textAlign = 'center'; sg.fillText('Royal Garden Cafe', 256, 46);
  const stx = new THREE.CanvasTexture(sc); stx.colorSpace = THREE.SRGBColorSpace;
  const sgn = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), lambert(0xffffff, { map: stx })); sgn.rotation.y = -Math.PI / 2; sgn.position.set(X0 - 0.76, 3.8, CAFE_Z0 - 8); scene.add(sgn);
  // 前庭のヤシと低木
  for (const z of [CAFE_Z0 - 4, CAFE_Z0 - 20, CAFE_Z0 - 36]) { addBox(0.25, 3, 0.25, EDGE + 4.2, 1.5, z, wood); const pf = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 5), lambert(0x4f7a3a)); pf.scale.y = 0.45; pf.position.set(EDGE + 4.2, 3.1, z); scene.add(pf); }
  // 前庭のテラス席（パラソル・テーブル・椅子）と植え込み
  for (let i = 0; i < 9; i++) {
    const x = EDGE + 2.6 + (i % 2) * 1.5, z = CAFE_Z0 - 3 - i * 5.2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), dark); pole.position.set(x, 1.3, z); scene.add(pole);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 8, 1, true), canvasM); um.position.set(x, 2.5, z); um.castShadow = true; scene.add(um);
    addBox(0.04, 0.72, 0.04, x, 0.36, z, dark, false);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), white); top.position.set(x, 0.74, z); top.castShadow = true; scene.add(top);
    for (const a of [Math.PI / 2, -Math.PI / 2]) { const cz = z + Math.sin(a) * 0.75; addBox(0.42, 0.04, 0.42, x, 0.46, cz, dark); addBox(0.42, 0.45, 0.04, x, 0.7, cz + Math.sin(a) * 0.2, dark); }
    OBST.push({ x, z, r: 1.1, h: 0.8 });
  }
  for (let z = CAFE_Z1 + 1; z < CAFE_Z0; z += 2.5) { const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.5, 0.9), 8, 6), lambert(0x3f6b34)); b.scale.y = 0.7; b.position.set(EDGE + 5, 0.4, z); scene.add(b); }
  const lawnP = new THREE.Mesh(new THREE.PlaneGeometry(X0 - EDGE, L), lambert(0x8d7e63)); lawnP.rotation.x = -Math.PI / 2; lawnP.position.set((EDGE + X0) / 2, 0.02, ZM); scene.add(lawnP);
});
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
// 落ち葉の絨毯：見頃を過ぎた並木は歩道も車道の端も黄色で敷き詰められる。
// 木が葉を落としきっていくにつれ、絨毯はまだらに薄れて路面の地肌が見えてくる
let pileMat = null;
const CARPET_U = { uCover: { value: 1 }, uMask: { value: null } };
{
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#d9a91f'; g.fillRect(0, 0, S, S);
  const cols = ['#f0c93a', '#e2b52a', '#f6da66', '#cf9a1a', '#e8bf30', '#b98a1c'];
  for (let i = 0; i < 9000; i++) {
    g.save(); g.translate(Math.random() * S, Math.random() * S); g.rotate(Math.random() * 6.28);
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 5 + Math.random() * 6, -2.4, -0.7); g.closePath(); g.fill(); g.restore();
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // まだらに消えていくためのマスク（ぼかしたノイズ）
  const M = 256, mc = document.createElement('canvas'); mc.width = mc.height = M;
  const mg = mc.getContext('2d'); mg.fillStyle = '#808080'; mg.fillRect(0, 0, M, M);
  for (let i = 0; i < 260; i++) { const r = rand(8, 40), x = Math.random() * M, y = Math.random() * M, v = (Math.random() * 255) | 0;
    for (const [ox, oy] of [[0, 0], [M, 0], [-M, 0], [0, M], [0, -M]]) { const gr = mg.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.7)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); mg.fillStyle = gr; mg.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } }
  const mask = new THREE.CanvasTexture(mc); mask.wrapS = mask.wrapT = THREE.RepeatWrapping;
  CARPET_U.uMask.value = mask;
  const mat = new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CARPET_U);
    sh.fragmentShader = 'uniform float uCover; uniform sampler2D uMask;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      float mk = texture2D(uMask, vMapUv * 0.09).r * 0.75 + texture2D(uMask, vMapUv * 0.37).r * 0.25;
      if (mk > uCover * 1.25 - 0.12) discard;
      #include <map_fragment>`);
  };
  const strip = (w, len, x, z, y, rep) => {
    const t = tex.clone(); t.repeat.set(w / 3, len / 3); t.needsUpdate = true;
    const m = mat.clone(); m.map = t; m.onBeforeCompile = mat.onBeforeCompile;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, len), m); pl.rotation.x = -Math.PI / 2; pl.position.set(x, y, z); pl.receiveShadow = true; scene.add(pl);
  };
  for (const sd of [-1, 1]) {
    strip(WALK_OUT - WALK_IN, AVE_LEN, sd * (WALK_IN + WALK_OUT) / 2, AVE_MID, 0.125);  // 歩道
    strip(WALK_IN - ROAD_HW - 0.4, AVE_LEN, sd * (ROAD_HW + WALK_IN + 0.4) / 2, AVE_MID, 0.126); // 車道側植樹帯
    strip(EDGE - WALK_OUT - 0.3, AVE_LEN, sd * (WALK_OUT + 0.3 + EDGE) / 2, AVE_MID, 0.126);     // 外側植樹帯
    strip(3.2, AVE_LEN, sd * (ROAD_HW - 1.6), AVE_MID, 0.006);                                   // 車道の端（駐車帯）
  }
  strip(SIDE_LEN, (SIDE_ROW + 2) * 2, -EDGE - SIDE_LEN / 2, SIDE_Z, 0.125);                        // 横道
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
  pileMat = mat;
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

// ---------------------------------------------------------------------------
// 遠景：神宮外苑の周辺施設と東京の街並み
// （北＝絵画館の方向が -z、西が -x。並木の西に野球場やテニスクラブ、東に軟式球場、
//   北西に国立競技場、その先にドコモ代々木ビルと新宿の超高層ビル群、背後に赤坂・六本木）
// ---------------------------------------------------------------------------
{
  const bld = [];  // [x, z, w, d, h]
  // 外苑（公園・施設）の範囲には建てない
  const inPark = (x, z) => (x > -760 && x < 300 && z > -720 && z < 0) || (x > 270 && x < 560 && z > -650 && z < -20); // 外苑と赤坂御用地
  // 周辺の市街地（中低層）
  for (let i = 0; i < (LOW ? 260 : 520); i++) {
    const a = rand(0, 6.28), r = rand(330, 1700);
    const x = Math.cos(a) * r, z = -250 + Math.sin(a) * r;
    if (inPark(x, z) || (z > 0 && z < 70 && Math.abs(x) < 300)) continue;
    const h = r > 900 ? rand(20, 90) : rand(14, 55);
    bld.push([x, z, rand(18, 45), rand(18, 45), h]);
  }
  // 新宿の超高層ビル群（北西 約3km）
  for (let i = 0; i < 22; i++) bld.push([rand(-2700, -1900), rand(-2900, -2200), rand(40, 70), rand(40, 70), rand(140, 240)]);
  bld.push([-2250, -2600, 50, 35, 243], [-2190, -2600, 50, 35, 243]); // ツインタワー
  // 赤坂・六本木方面の超高層ビル（南東）
  bld.push([950, 1400, 55, 55, 248], [300, 1750, 60, 50, 238], [1300, 600, 45, 45, 180], [700, 1000, 40, 40, 160], [1600, 1100, 50, 40, 200], [-200, 1600, 45, 45, 150]);
  // 青山・千駄ヶ谷方面（中高層）
  for (let i = 0; i < 30; i++) bld.push([rand(-900, 600), rand(90, 700), rand(25, 50), rand(25, 50), rand(30, 110)]);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), skylineWin, bld.length);
  const col = new THREE.Color();
  bld.forEach(([x, z, w, d, h], i) => {
    im.setMatrixAt(i, _tmpM.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(-0.3, 0.3)), new THREE.Vector3(w, h, d)));
    im.setColorAt(i, col.setHSL(rand(0.55, 0.62), rand(0.03, 0.12), rand(0.55, 0.8)));
  });
  im.receiveShadow = true; scene.add(im);
}
// NTT ドコモ代々木ビル（時計塔のある尖塔の超高層、北西 約1.5km）
{
  const m = lambert(0x8f969d), dark = lambert(0x4b5258);
  const X = -1150, Z = -1350;
  addBox(46, 120, 40, X, 60, Z, skylineWin);
  for (let i = 0; i < 4; i++) addBox(40 - i * 7, 16, 34 - i * 6, X, 128 + i * 16, Z, i % 2 ? dark : m);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 4), m); spire.position.set(X, 222, Z); scene.add(spire);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(5, 24), new THREE.MeshBasicMaterial({ color: 0xe8e2d0 })); clock.position.set(X, 150, Z + 18.6); scene.add(clock);
}
// 国立競技場（北西 約600m）：木の軒が重なる低い楕円のスタジアム
{
  const wood = lambert(0x9a6f45), white = lambert(0xe7e7e2), green = lambert(0x4f6b3a);
  const X = -620, Z = -560;
  for (let i = 0; i < 4; i++) {
    const r = 135 - i * 4;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 3, 9, 64, 1, true), i === 3 ? white : wood);
    ring.scale.set(1, 1, 0.82); ring.position.set(X, 4.5 + i * 10.5, Z); ring.castShadow = true; scene.add(ring);
    const eave = new THREE.Mesh(new THREE.CylinderGeometry(r + 6, r + 6, 1, 64, 1, true), green);
    eave.scale.set(1, 1, 0.82); eave.position.set(X, 9.5 + i * 10.5, Z); scene.add(eave);
  }
}
// 明治神宮野球場（並木の西）：楕円のスタンドと照明塔
{
  const conc = lambert(0xb9b4aa), dark = lambert(0x5c5f62);
  const X = -260, Z = -330;
  // 外壁：赤れんがのアーチが連なる
  const ac = document.createElement('canvas'); ac.width = 512; ac.height = 64; const ag = ac.getContext('2d');
  ag.fillStyle = '#b8654f'; ag.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 8; i++) { ag.fillStyle = '#3a2a24'; ag.beginPath(); ag.moveTo(i * 64 + 12, 64); ag.lineTo(i * 64 + 12, 34); ag.arc(i * 64 + 32, 34, 20, Math.PI, 0); ag.lineTo(i * 64 + 52, 64); ag.fill(); }
  ag.fillStyle = '#c97a62'; ag.fillRect(0, 0, 512, 8);
  const at = new THREE.CanvasTexture(ac); at.colorSpace = THREE.SRGBColorSpace; at.wrapS = THREE.RepeatWrapping; at.repeat.set(10, 1);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(101, 101, 8, 64, 1, true), lambert(0xffffff, { map: at })); wall.position.set(X, 4, Z); scene.add(wall);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(95, 100, 22, 48, 1, true), conc); st.position.set(X, 11, Z); st.castShadow = true; scene.add(st);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(96, 96, 1.5, 48, 1, true), dark); roof.position.set(X, 22.5, Z); scene.add(roof);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.3, x = X + Math.cos(a) * 104, z = Z + Math.sin(a) * 104;
    addBox(1.8, 52, 1.8, x, 26, z, lambert(0xf2f2f2));
    addBox(12, 7, 1.4, x, 55, z, lambert(0xe6e6e6));
  }
  addBox(30, 18, 14, X + 70, 9, Z + 70, conc); // バックスクリーン側の建物
}
// 秩父宮ラグビー場（並木の西・青山通り寄り）
{
  const conc = lambert(0xbab5ac), dark = lambert(0x55595d);
  const X = -205, Z = -70;
  for (const [w, d, x, z] of [[130, 18, 0, -50], [130, 18, 0, 50], [18, 90, -70, 0], [18, 90, 70, 0]]) addBox(w, 14, d, X + x, 7, Z + z, conc);
  addBox(132, 2, 22, X, 15, Z - 50, dark);
  for (const [x, z] of [[-70, -50], [70, -50], [-70, 50], [70, 50]]) { addBox(1.4, 40, 1.4, X + x, 20, Z + z, dark); addBox(8, 4, 1, X + x, 41, Z + z, lambert(0xdedede)); }
}
// 神宮テニスクラブの屋外コート（並木の西）：砂入り人工芝の茶色いコートが並び、緑のフェンスと照明柱
{
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#a7865f'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,70,45' : '200,170,130'},0.25)`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  g.strokeStyle = '#f4f1ea'; g.lineWidth = 2;
  g.strokeRect(14, 20, 100, 216); g.strokeRect(26, 20, 76, 216); g.beginPath(); g.moveTo(26, 78); g.lineTo(102, 78); g.moveTo(26, 178); g.lineTo(102, 178); g.moveTo(64, 78); g.lineTo(64, 178); g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const courtM = lambert(0xffffff, { map: tex }), netM = new THREE.MeshLambertMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const fenceM = new THREE.MeshLambertMaterial({ color: 0x3f8a6a, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const X0 = -(EDGE + 14), Z0 = SIDE_Z - SIDE_ROW - 22;   // 横道の北側から
  const cols = 4, rows = 5, cw = 18, ch = 36;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = X0 - cw / 2 - k * cw, z = Z0 - ch / 2 - r * ch;
    addPlane(cw, ch, x, z, 0.015, courtM);
    addBox(11, 0.95, 0.05, x, 0.48, z, netM, false);
  }
  const W = cols * cw, Ht = rows * ch, cx = X0 - W / 2, cz = Z0 - Ht / 2;
  for (const [w, d, x, z] of [[W, 0.1, cx, Z0], [W, 0.1, cx, Z0 - Ht], [0.1, Ht, X0, cz], [0.1, Ht, X0 - W, cz]]) addBox(w, 4, d, x, 2, z, fenceM, false);
  for (let r = 1; r < rows; r++) addBox(W, 3, 0.1, cx, 1.5, Z0 - r * ch, fenceM, false);
  for (let r = 0; r <= rows; r++) for (let k = 0; k <= cols; k += 2) { addBox(0.25, 9, 0.25, X0 - k * cw, 4.5, Z0 - r * ch, lambert(0x9a9da0)); addBox(1.2, 0.3, 0.6, X0 - k * cw, 9, Z0 - r * ch, lambert(0xe8e8e8)); }
}
// 並木の東側の緑道：常緑樹（クスノキ・シイ・マツなど）の木立と小径。その外側に道路
{
  const greens = [0x2f4a2a, 0x3a5a2f, 0x274226, 0x46612f, 0x5a4a2a, 0x7a4a26];
  const n = LOW ? 160 : 320;
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lambert(0xffffff), n);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.3, 1, 6).translate(0, 0.5, 0), lambert(0x4a3a2c), n);
  for (let i = 0; i < n; i++) {
    const x = EDGE + 3 + Math.random() * 27, z = rand(AVE_END + 4, 6);
    if (Math.abs(x - (EDGE + 16)) < 1.6) { im.setMatrixAt(i, ZERO_M); trunk.setMatrixAt(i, ZERO_M); continue; }   // 小径
    const r = rand(2.5, 5), h = rand(4, 9);
    im.setMatrixAt(i, _tmpM.compose(new THREE.Vector3(x, h, z), new THREE.Quaternion(), new THREE.Vector3(r, r * rand(0.7, 1.0), r)));
    trunk.setMatrixAt(i, _tmpM.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
    im.setColorAt(i, new THREE.Color(greens[Math.random() < 0.85 ? (Math.random() * 4) | 0 : 4 + ((Math.random() * 2) | 0)]));
  }
  im.castShadow = trunk.castShadow = true; im.receiveShadow = true;
  scene.add(im, trunk);
  addPlane(2.4, AVE_START - AVE_END, EDGE + 16, AVE_MID, 0.02, lambert(0xb8a888)); // 緑道の小径
  const asp = noiseTexture('#4b4b50', 0.18, 256, 6000); asp.repeat.set(2, 40);
  addPlane(8, AVE_START - AVE_END + 6, EDGE + 36, AVE_MID, 0.004, lambert(0xffffff, { map: asp })); // 外側の道路
}
// 並木の東側：北青山一丁目の街区（中低層のオフィス・マンション）と、土の校庭のある学校。さらに東は赤坂御用地の森
const EAST_X1 = 270;
const inSchool = (x, z) => (x > 140 && x < 235 && z < -120 && z > -215) || (x > EDGE + 38 && x < 160 && z < -35 && z > -135); // 学校と北青山一丁目アパート
{
  const tones = [0xd9d6cf, 0xbfbcb6, 0x9ea3a8, 0xe8e5de, 0x7d8288, 0xcfc6b8];
  let n = 0;
  for (let z = 0; z > AVE_END + 10; z -= rand(22, 34)) {
    for (let x = EDGE + 42; x < EAST_X1 - 20; x += rand(24, 40)) {
      if (inSchool(x, z)) continue;
      if (z < AVE_END + 60 && x < EDGE + 60) continue; // 並木の北端付近は木立
      const w = rand(14, 26), d = rand(12, 22), h = rand(10, 42);
      const mat = new THREE.MeshLambertMaterial({ color: tones[(Math.random() * tones.length) | 0], map: skylineWin.map, emissiveMap: skylineWin.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0 });
      nightMats.push(mat);
      const b = addBox(w, h, d, x + w / 2, h / 2, z - d / 2, mat);
      b.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = v * (i % 2 ? h / 32 : w / 16); });
      n++;
    }
  }
  // 北青山一丁目アパート：白い10〜12階建ての集合住宅。バルコニーの水平の帯、れんがの植え込みと石畳の歩道
  const bc = document.createElement('canvas'); bc.width = 128; bc.height = 128; const bg = bc.getContext('2d');
  bg.fillStyle = '#eceae4'; bg.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) { bg.fillStyle = '#8f8c88'; bg.fillRect(0, y + 8, 128, 18); bg.fillStyle = '#d9d6cf'; for (let x = 4; x < 128; x += 32) bg.fillRect(x, y + 10, 3, 16); }
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace; bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
  const brickM = lambert(0x8a4a3a), paveM = lambert(0x9a6a5a);
  for (const [cx, cz, w, d, h] of [[EDGE + 72, -52, 52, 16, 34], [EDGE + 125, -52, 40, 16, 31], [EDGE + 60, -98, 18, 54, 28], [EDGE + 108, -112, 50, 16, 37]]) {
    const m = new THREE.MeshLambertMaterial({ map: bt.clone(), emissiveMap: skylineWin.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0 });
    m.map.repeat.set(Math.max(w, d) / 8, h / 3.2); m.map.needsUpdate = true; nightMats.push(m);
    addBox(w, h, d, cx, h / 2, cz, m);
    addBox(w * 0.9, 1.2, d * 0.9, cx, h + 0.6, cz, lambert(0xd0cdc6));                 // 屋上
    addBox(w + 3, 0.9, 0.5, cx, 0.45, cz + d / 2 + 2, brickM);                         // れんがの植え込み
  }
  addPlane(110, 8, EDGE + 95, -33, 0.03, paveM);                                       // 石畳の歩道
  for (let x = EDGE + 42; x < EDGE + 150; x += 2.5) addBox(0.18, 0.7, 0.18, x, 0.35, -29.5, lambert(0x6a6d70)); // ボラード
  // 学校（校舎と土の校庭）
  const dirt = lambert(0xc2a37a);
  addPlane(70, 70, 195, -170, 0.02, dirt);
  addBox(16, 14, 80, 152, 7, -167, lambert(0xe9e6df));
  addBox(0.1, 4, 70, 231, 2, -170, new THREE.MeshLambertMaterial({ color: 0x3f8a6a, transparent: true, opacity: 0.45, side: THREE.DoubleSide }), false);
}

// 背景の木々（並木の外側）
{
  const n = LOW ? 600 : 1100;
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geo, lambert(0xffffff), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    // 外苑の森：施設を避けて公園内に配置
    const blocked = (x, z) => (Math.abs(x) < EDGE + 4 && z > AVE_END - 4) || (x < -EDGE && x > -EDGE - SIDE_LEN - 40 && z > SIDE_Z - 30)
      || (x > -(EDGE + 14 + 4 * 18 + 4) && x < -28 && z > SIDE_Z - SIDE_ROW - 22 - 5 * 36 - 4 && z < SIDE_Z - SIDE_ROW - 18) || (x < -EDGE && x > -125 && z > -62) || (x > EDGE && x < EAST_X1 && z > AVE_END && z < 10)
      || Math.hypot(x + 260, z + 330) < 115 || (x > -310 && x < -150 && z > -135 && z < -5)
      || Math.hypot((x + 620) / 1.0, (z + 560) / 0.82) < 150 || Math.hypot(x, z - RING_Z) < RING_R1 + 8 || (Math.abs(x) < 64 && z < GALLERY_Z + 40 && z > GALLERY_Z - 25)
      || (Math.abs(x) < 16 && z < AVE_END && z > GALLERY_Z);
    let x = 0, z = 0;
    for (let k = 0; k < 30; k++) {
      x = side < 0 ? -(Math.random() < 0.5 ? rand(EDGE + 5, 40) : rand(EDGE + 5, 720)) : (Math.random() < 0.6 ? rand(EAST_X1, 420) : rand(EDGE + 5, 280));
      z = rand(-700, -12);
      if (!blocked(x, z)) break;
    }
    const s = rand(3, 8);
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
    tint: TINTS[(Math.random() * TINTS.length) | 0], lod: -1, stage: -2, list: [],
    // 散るスピードは木ごとにばらばらで、時間とともにゆらぐ
    rateMul: rand(0.45, 1.7), rateFreq: rand(0.04, 0.22), ratePhase: rand(0, 6.28), acc: 0, cooldown: 0, ratio: 1, dead: false,
  });
}
// 4列の並木：各32本 × 4 = 128本
// 枝：幹から斜め上へ伸び、先端が円錐のシルエットに揃う（葉はこの枝に付く）
const BR_PER = 34;
function makeBranches(t) {
  const V = VARIANTS[t.variant];
  t.br = [];
  for (let b = 0; b < BR_PER; b++) {
    const s = (b + Math.random()) / BR_PER;
    const y = t.y0 - 0.6 + s * t.H * 0.9;
    const a = b * 2.39996 + rand(-0.3, 0.3), up = rand(V.branchUp[0], V.branchUp[1]); // 黄金角で枝を回す
    const sr = Math.max(0, (y - t.y0) / t.H);
    const len = Math.max(0.6, t.R * (1 - sr) / (Math.cos(up) + t.R * Math.sin(up) / t.H)) * rand(0.88, 1.02);
    t.br.push({ x: t.x, y, z: t.z, dx: Math.cos(a) * Math.cos(up), dy: Math.sin(up), dz: Math.sin(a) * Math.cos(up), len, a });
  }
}
// 枝の上の一点（葉を付ける場所）
const _bp = new THREE.Vector3();
function pointOnBranch(t, out, base = _bp) {
  // 長い枝ほど葉が多い。葉は枝から短い小枝の先に付く（枝から離れすぎない）
  let b;
  for (let k = 0; k < 4; k++) { b = t.br[(Math.random() * t.br.length) | 0]; if (Math.random() < b.len / (t.R * 0.9)) break; }
  const tb = Math.pow(rand(0.3, 1), 0.7);
  const d = b.len * tb;
  base.set(b.x + b.dx * d, b.y + b.dy * d, b.z + b.dz * d);
  const tw = rand(0.12, 0.2 + 0.3 * tb), ta = rand(0, 6.28);
  out.set(base.x + Math.cos(ta) * tw, base.y + rand(0.02, 0.25), base.z + Math.sin(ta) * tw);
  return b;
}
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

// ---------------------------------------------------------------------------
// イチョウの樹木テンプレート：樹形3種 × 葉の量5段階（100% / 75% / 50% / 30% / 10%）
// 葉は短枝に房になって付くイチョウらしく、数枚の扇形の葉をまとめた房を枝に沿ってたくさん付ける。
// 各木は今の葉の量に合ったテンプレートを、高さ・太さ・向きを変えて表示する（インスタンシング）
// ---------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function ginkgoColor(c, ground = false, tint = 'vivid') {
  const r = Math.random();
  if (ground) c.setHSL(rand(0.1, 0.135), rand(0.75, 0.95), rand(0.42, 0.56));
  else if (tint === 'green' && r < 0.45) c.setHSL(rand(0.15, 0.2), rand(0.55, 0.75), rand(0.38, 0.5));
  else if (tint === 'brown' && r < 0.4) c.setHSL(rand(0.07, 0.1), rand(0.55, 0.75), rand(0.32, 0.44));
  else if (r < 0.05) c.setHSL(rand(0.15, 0.18), rand(0.6, 0.8), rand(0.42, 0.5));   // 少し青みの残る葉
  else c.setHSL(rand(0.115, 0.14), rand(0.85, 1.0), rand(0.48, 0.6));
  return c;
}
// 葉の房のテクスチャ：短枝から5〜7枚の扇形の葉が放射状に出る
function clusterTexture() {
  const S = LOW ? 256 : 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), leaf = LEAF_TEX.image;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42 + rand(-0.12, 0.12);
    const len = S * rand(0.3, 0.42);
    g.save(); g.translate(S / 2, S * 0.92); g.rotate(a + Math.PI / 2);
    g.strokeStyle = '#d8c79a'; g.lineWidth = S / 160; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len * 0.55); g.stroke();
    g.translate(0, -len * 0.5);
    const w = len * rand(0.8, 1.0); g.drawImage(leaf, -w / 2, -w * 0.75, w, w * 0.75);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const leafMat = new THREE.MeshLambertMaterial({ map: clusterTexture(), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true });
applyWind(leafMat, true);
const fallLeafMat = new THREE.MeshLambertMaterial({ map: LEAF_TEX, normalMap: LEAF_TEXS.normal, alphaTest: 0.5, side: THREE.DoubleSide });
applyWind(fallLeafMat, false, true);
const leafGeo = new THREE.PlaneGeometry(1, 0.75);

const BARK = barkTextures();
const barkMat = new THREE.MeshStandardMaterial({ map: BARK.map, normalMap: BARK.normal, roughnessMap: BARK.rough, roughness: 1, metalness: 0 });
applyWind(barkMat, false);

const STAGE_FRAC = [1, 0.75, 0.5, 0.3, 0.1];
const RESTORE_AT = 0.75;
// ルール：いちょう祭りの7日間（7分）、最後の一葉を散らせずに守り切ればクリア。
// すべての木が葉を落としきったら冬（ゲームオーバー）。同じ木をよみがえらせられるのは2日に1回まで
const GOAL_DAYS = 7, REVIVE_DAYS = 2;   // よみがえらせた日から2日たつまで、同じ木はよみがえらない
const RATE_BASE = (window.__ichoTune && window.__ichoTune.base) || 1.5, RATE_T = (window.__ichoTune && window.__ichoTune.T) || 150;   // 散る速さ（何もしないと約3.5日で最後の一葉が散る）と、時間とともに速くなる度合い   // 葉がこれより減ると「枯れかけ」：てっぺんの玉が点灯し、触れるとよみがえる
function stageOf(r) { return r > 0.86 ? 0 : r > 0.62 ? 1 : r > 0.4 ? 2 : r > 0.2 ? 3 : r > 0.015 ? 4 : -1; }
const TPL_H = 20, TPL_Y0 = 3.4;
const N_CLUSTERS = LOW ? 2800 : 7000;
const TPL = VARIANTS.map((V, vi) => {
  const tp = { x: 0, z: 0, y0: TPL_Y0, H: TPL_H, h: TPL_Y0 + TPL_H, R: TPL_H * V.rr, variant: vi };
  makeBranches(tp);
  // 二次枝（小枝）：主枝の途中から外・上向きに出る
  const sec = [];
  for (const b of tp.br) {
    const n = 4 + ((b.len / tp.R) * 6 | 0);
    for (let k = 0; k < n; k++) {
      const tb = rand(0.25, 0.97), d = b.len * tb;
      const dir = new THREE.Vector3(b.dx + rand(-0.7, 0.7), b.dy + rand(-0.1, 0.6), b.dz + rand(-0.7, 0.7)).normalize();
      sec.push({ x: b.x + b.dx * d, y: b.y + b.dy * d, z: b.z + b.dz * d, dx: dir.x, dy: dir.y, dz: dir.z, len: rand(0.6, 1.6) * (0.4 + 1.1 * (1 - tb)) + 0.4, a: b.a });
    }
  }
  // 葉の房：二次枝・主枝の先に沿って付ける
  const pos = new Float32Array(N_CLUSTERS * 3), quat = new Float32Array(N_CLUSTERS * 4), size = new Float32Array(N_CLUSTERS), col = new Float32Array(N_CLUSTERS * 3);
  for (let i = 0; i < N_CLUSTERS; i++) {
    const useSec = Math.random() < 0.8;
    const b = useSec ? sec[(Math.random() * sec.length) | 0] : tp.br[(Math.random() * tp.br.length) | 0];
    const tt = useSec ? rand(0.15, 1) : Math.pow(rand(0.35, 1), 0.6);
    const d = b.len * tt, r = rand(0.05, 0.3);
    const ta = rand(0, 6.28);
    pos.set([b.x + b.dx * d + Math.cos(ta) * r, b.y + b.dy * d + rand(-0.1, 0.25), b.z + b.dz * d + Math.sin(ta) * r], i * 3);
    _e.set(rand(-1.0, 0.6), b.a + Math.PI / 2 + rand(-1.3, 1.3), rand(-0.6, 0.6), 'YXZ');
    _q.setFromEuler(_e); quat.set([_q.x, _q.y, _q.z, _q.w], i * 4);
    size[i] = rand(0.9, 1.4);
    ginkgoColor(_c); col.set([_c.r, _c.g, _c.b], i * 3);
  }
  // 房の並びをシャッフル：先頭からの枚数で各段階の葉の量を表す
  for (let i = N_CLUSTERS - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    for (const [arr, k] of [[pos, 3], [quat, 4], [col, 3]]) for (let c = 0; c < k; c++) { const t = arr[i * k + c]; arr[i * k + c] = arr[j * k + c]; arr[j * k + c] = t; }
    const ts = size[i]; size[i] = size[j]; size[j] = ts;
  }
  // 房の板ポリゴンを1つのジオメトリにまとめる
  const quadGeo = (n, step, mul) => {
    const m = Math.ceil(n / step);
    const P = new Float32Array(m * 12), N = new Float32Array(m * 12), U = new Float32Array(m * 8), C = new Float32Array(m * 12), I = new Uint32Array(m * 6);
    const corner = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]], uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const qv = new THREE.Quaternion(), cv = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let k = 0, i = 0; i < n; i += step, k++) {
      qv.set(quat[i * 4], quat[i * 4 + 1], quat[i * 4 + 2], quat[i * 4 + 3]);
      const sz = size[i] * mul;
      nv.set(0, 0, 1).applyQuaternion(qv);
      for (let c = 0; c < 4; c++) {
        cv.set(corner[c][0] * sz, corner[c][1] * sz, 0).applyQuaternion(qv);
        P.set([pos[i * 3] + cv.x, pos[i * 3 + 1] + cv.y, pos[i * 3 + 2] + cv.z], (k * 4 + c) * 3);
        N.set([nv.x, nv.y, nv.z], (k * 4 + c) * 3);
        U.set(uvs[c], (k * 4 + c) * 2);
        C.set([col[i * 3], col[i * 3 + 1], col[i * 3 + 2]], (k * 4 + c) * 3);
      }
      I.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    return g;
  };
  const stages = STAGE_FRAC.map((f) => {
    const n = Math.round(N_CLUSTERS * f);
    return { n, near: quadGeo(n, 1, 1), far: quadGeo(n, 3, 1.55) };
  });
  // 骨格：幹＋主枝＋二次枝
  const parts = [new THREE.CylinderGeometry(0.1, 0.62, tp.h, 10).translate(0, tp.h / 2, 0)];
  const up = new THREE.Vector3(0, 1, 0);
  for (const b of tp.br) parts.push(new THREE.CylinderGeometry(0.03, 0.13, b.len, 5).translate(0, b.len / 2, 0).applyQuaternion(_q.setFromUnitVectors(up, _v.set(b.dx, b.dy, b.dz))).translate(b.x, b.y, b.z));
  for (const b of sec) parts.push(new THREE.CylinderGeometry(0.012, 0.035, b.len, 4).translate(0, b.len / 2, 0).applyQuaternion(_q.setFromUnitVectors(up, _v.set(b.dx, b.dy, b.dz))).translate(b.x, b.y, b.z));
  const skeleton = mergeGeometries(parts.map((g) => g.toNonIndexed ? g.toNonIndexed() : g));
  return { tp, pos, stages, skeleton };
});

// 木ごとの配置（テンプレートを拡大縮小・回転）
trees.forEach((t) => {
  const tp = TPL[t.variant].tp;
  const sy = t.h / tp.h, sx = (t.R / t.H) / (tp.R / tp.H) * sy * rand(0.95, 1.05);
  t.y0 = TPL_Y0 * sy; t.H = t.h - t.y0; t.R = tp.R * sx;
  t.rot = rand(0, Math.PI * 2); t.sx = sx; t.sy = sy;
  t.mat = new THREE.Matrix4().compose(new THREE.Vector3(t.x, 0, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot), new THREE.Vector3(sx, sy, sx));
  t.tintColor = new THREE.Color().setRGB(...(t.tint === 'green' ? [0.82, 1.0, 0.6] : t.tint === 'brown' ? [0.88, 0.68, 0.48] : [1, 1, 1]));
});
// テンプレート上の葉の位置を、その木のワールド座標へ（散る葉の出どころ）
function treeLeafWorldPos(t, out) {
  const T = TPL[t.variant], st = Math.max(0, stageOf(t.ratio));
  const i = (Math.random() * T.stages[st].n) | 0;
  return out.set(T.pos[i * 3], T.pos[i * 3 + 1], T.pos[i * 3 + 2]).applyMatrix4(t.mat);
}
// インスタンス用メッシュ
const skelMeshes = TPL.map((T) => { const m = new THREE.InstancedMesh(T.skeleton, barkMat, trees.length); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; });
const leafMeshes = TPL.map((T) => T.stages.map((S) => ['near', 'far'].map((k) => {
  const m = new THREE.InstancedMesh(S[k], leafMat, trees.length);
  m.castShadow = !LOW; m.frustumCulled = false; m.count = 0;
  m.setColorAt(0, _c.set(1, 1, 1));
  scene.add(m); return m;
})));
TPL.forEach((T, vi) => { let n = 0; trees.forEach((t) => { if (t.variant === vi) skelMeshes[vi].setMatrixAt(n++, t.mat); }); skelMeshes[vi].count = n; });
// 葉の量の段階・距離が変わったら並べ直す
const LOD_FAR = 70;
let instDirty = true, instTimer = 0;
function updateLOD(dt) {
  instTimer -= dt;
  const cx = camera.position.x, cz = camera.position.z;
  if (instTimer <= 0) {
    instTimer = 0.25;
    for (const t of trees) { const lod = Math.hypot(t.x - cx, t.z - cz) > LOD_FAR ? 1 : 0; if (lod !== t.lod) { t.lod = lod; instDirty = true; } }
  }
  if (!instDirty) return;
  instDirty = false;
  for (const vs of leafMeshes) for (const ss of vs) for (const m of ss) m.count = 0;
  for (const t of trees) {
    const st = stageOf(t.ratio);
    t.stage = st;
    if (st < 0) continue;
    const m = leafMeshes[t.variant][st][t.lod > 0 ? 1 : 0];
    m.setMatrixAt(m.count, t.mat); m.setColorAt(m.count, t.tintColor); m.count++;
  }
  for (const vs of leafMeshes) for (const ss of vs) for (const m of ss) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
function markTree(t) { if (stageOf(t.ratio) !== t.stage) instDirty = true; }

// てっぺんの目印
const apexGeo = new THREE.BufferGeometry();
const apexPos = new Float32Array(trees.length * 3), apexCol = new Float32Array(trees.length * 3);
// 光る玉の場所：地上の幹の根元（45%）・てっぺん（40%）・幹の途中（15%）。よみがえるたびに置き直す
function placeOrb(t, i) {
  const r = Math.random();
  t.orbKind = r < 0.45 ? 'ground' : r < 0.85 ? 'top' : 'mid';
  const a = rand(0, Math.PI * 2);
  if (t.orbKind === 'top') t.orb = new THREE.Vector3(t.x, t.h + 0.7, t.z);
  else if (t.orbKind === 'ground') t.orb = new THREE.Vector3(t.x + Math.cos(a) * 1.0, groundY(t.x, t.z) + 1.1, t.z + Math.sin(a) * 1.0);
  else t.orb = new THREE.Vector3(t.x + Math.cos(a) * 0.95, t.y0 + t.H * rand(0.3, 0.55), t.z + Math.sin(a) * 0.95);
  apexPos.set([t.orb.x, t.orb.y, t.orb.z], i * 3);
  if (apexGeo.attributes.position) apexGeo.attributes.position.needsUpdate = true;
}
trees.forEach((t, i) => placeOrb(t, i));
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
let groundIdx = 0, groundCount = 0;
function addGroundLeaf(x, z, scale = rand(0.2, 0.3), fullUpload = false) {
  const i = groundIdx; groundIdx = (groundIdx + 1) % GROUND_MAX;
  groundCount = Math.min(GROUND_MAX, groundCount + 1);
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
// 絨毯が薄れるのに合わせて、古い落ち葉から片付いていく
function trimGroundLeaves(cover) {
  const limit = Math.floor(GROUND_MAX * (0.12 + 0.88 * cover));
  let n = 0;
  while (groundCount > limit && n < 300) {
    const i = (groundIdx - groundCount + GROUND_MAX) % GROUND_MAX;
    groundMesh.setMatrixAt(i, ZERO);
    groundMesh.instanceMatrix.addUpdateRange(i * 16, 16);
    groundCount--; n++;
  }
  if (n) groundMesh.instanceMatrix.needsUpdate = true;
}
function scatterInitialGround() {
  // 歩道は黄金の絨毯、植樹帯にも、車道は端に寄った落ち葉
  for (let k = 0; k < 40000; k++) {
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
// 帽子：つば付きの中折れ帽／ニット帽／ベレー帽の3種類を人ごとに
const HAT_GEOS = [
  mergeGeometries([new THREE.CylinderGeometry(0.25, 0.25, 0.025, 16).translate(0, 1.6, 0), new THREE.CylinderGeometry(0.12, 0.14, 0.14, 14).translate(0, 1.68, 0)]),
  new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.15, 1).translate(0, 1.53, 0),
  new THREE.SphereGeometry(0.17, 12, 6).scale(1, 0.35, 1).translate(0.03, 1.63, 0),
];
const HAT_COLORS = [0x2b2b2e, 0x6b4a33, 0xb33a2e, 0xd9cdb2, 0x2f4a6b, 0x7a7d80, 0xe6a83a, 0x3f5f3a];
const hatMeshes = HAT_GEOS.map((g) => { const m = new THREE.InstancedMesh(g, lambert(0xffffff), PEOPLE_MAX); m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m; });
for (let i = 0; i < PEOPLE_MAX; i++) {
  people[i].hat = i % 3;
  hatMeshes.forEach((m) => { m.setMatrixAt(i, ZERO); m.setColorAt(i, _c.setHex(HAT_COLORS[(i * 5 + 3) % HAT_COLORS.length])); });
}
scene.add(bodyMesh, headMesh, ...hatMeshes);
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
    // 目の前にプレイヤーがいたら立ち止まる
    const ahead = (player.pos.z - p.z) * -p.dir;
    const blocked = Math.abs(player.pos.x - p.x) < 0.9 && ahead > 0 && ahead < 1.6 && player.pos.y < 1.7;
    if (p.stop > 0) p.stop -= dt;
    else if (blocked) { /* 待つ */ }
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
    if (!p.active) { bodyMesh.setMatrixAt(i, ZERO); headMesh.setMatrixAt(i, ZERO); hatMeshes[p.hat].setMatrixAt(i, ZERO); continue; }
    const bob = p.stop > 0 ? 0 : Math.abs(Math.sin(p.phase)) * 0.05;
    const yaw = p.stop > 0 ? (p.x > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    _q.setFromAxisAngle(_v.set(0, 1, 0), yaw);
    _m.compose(_v.set(p.x, groundY(p.x, p.z) + bob, p.z), _q, _s.set(p.h, p.h, p.h));
    bodyMesh.setMatrixAt(i, _m); headMesh.setMatrixAt(i, _m); hatMeshes[p.hat].setMatrixAt(i, _m);
  }
  bodyMesh.instanceMatrix.needsUpdate = true; headMesh.instanceMatrix.needsUpdate = true;
  for (const m of hatMeshes) m.instanceMatrix.needsUpdate = true;
  bodyMesh.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// プレイヤー
// ---------------------------------------------------------------------------
const GRAV = 26, FALL_MUL = 1.35;   // 重力（落ちるときはさらに強く、キビキビ動く）
const JUMP_V0 = 8, JUMP_ACC = 30.5, JUMP_BOOST_T = 0.6;   // 押した瞬間の初速と、押し続けたときの上昇（最大 約23.5m）
const HOP_T = 0.5;   // 木のてっぺんから隣のてっぺんへ跳び移る時間
const player = { pos: new THREE.Vector3(0, 0, 6), vy: 0, yaw: 0, pitch: -0.28, face: 0, walk: 0, moving: 0, charge: 0, boost: 0, onGround: true, climbing: null, riding: null };
const keys = {};
let jumpHeld = false, jumpPressed = false;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') { if (!jumpHeld) jumpPressed = true; jumpHeld = true; e.preventDefault(); }
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
    const ys = d < 1.2 ? t.h - 0.2 : Math.min(t.h - 0.2, t.y0 + t.H * (1 - Math.max(0, d - 0.3) / t.R)); // てっぺんは小さな足場
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
  const prevY = p.y, prevX = p.x, prevZ = p.z;
  // 長押しでスピードアップ（歩く・木登りとも。約2秒で最大2.5倍）
  player.holdT = len > 0.3 ? (player.holdT || 0) + dt : 0;
  const boostMul = 1 + Math.min(1.5, player.holdT * 0.75);

  // 車に乗っていれば一緒に運ばれる
  if (player.riding && player.riding.active) {
    const c = player.riding, d = c.v * c.dir * dt;
    if (c.axis === 'z') p.z += d; else p.x += d;
  }

  // ジャンプ：Space を押した瞬間に跳び、押し続けている間は上昇が続く（最大で木のてっぺんまで）
  const canJump = player.onGround || player.climbing;
  // 木のてっぺんにいて、進みたい方向があれば、その方向の隣の木のてっぺんへ「ポン」と跳び移る
  const onTop = player.onGround && trees.find((t) => Math.hypot(t.x - p.x, t.z - p.z) < 2.2 && p.y > t.h - 2.5);
  if (jumpPressed && onTop && !player.hop) {
    let mx = 0, mz = 0;
    { let fx2 = 0, fz2 = 0;
      if (keys.KeyW || keys.ArrowUp) fz2 += 1; if (keys.KeyS || keys.ArrowDown) fz2 -= 1; if (keys.KeyA || keys.ArrowLeft) fx2 -= 1; if (keys.KeyD || keys.ArrowRight) fx2 += 1;
      fx2 += touch.mx; fz2 += touch.my;
      const sy2 = Math.sin(player.yaw), cy2 = Math.cos(player.yaw);
      mx = fx2 * cy2 - fz2 * sy2; mz = -fx2 * sy2 - fz2 * cy2; }
    const ml = Math.hypot(mx, mz);
    if (ml > 0.3) {
      let best = null, bs = 1e9;
      for (const t of trees) {
        if (t === onTop) continue;
        const dx = t.x - onTop.x, dz = t.z - onTop.z, d = Math.hypot(dx, dz);
        if (d > 15) continue;
        const cos = (dx * mx + dz * mz) / (d * ml);
        if (cos < 0.6) continue;
        const sc = d * (2 - cos);
        if (sc < bs) { bs = sc; best = t; }
      }
      if (best) {
        player.hop = { x0: p.x, y0: p.y, z0: p.z, x1: best.x, y1: best.h - 0.2, z1: best.z, t: 0, peak: 2.2 + Math.hypot(best.x - p.x, best.z - p.z) * 0.12 };
        player.face = Math.atan2(-(best.x - p.x), -(best.z - p.z));
        player.onGround = false; player.riding = null; player.lastTop = onTop;
        sfx.jump();
        jumpPressed = false;
      }
    }
  }
  if (player.hop) {
    const h = player.hop; h.t += dt / HOP_T;
    const k = Math.min(1, h.t);
    p.x = lerp(h.x0, h.x1, k); p.z = lerp(h.z0, h.z1, k);
    p.y = lerp(h.y0, h.y1, k) + 4 * h.peak * k * (1 - k);
    player.vy = 0; player.charge = 0;
    if (k >= 1) { player.hop = null; player.onGround = true; sfx.land(8); }
    player.moving = 1; player.walk += dt * 6;
    updateAvatar(dt); updateFollowCamera();
    return;
  }
  if (jumpPressed && canJump) {
    player.vy = JUMP_V0;
    player.boost = JUMP_BOOST_T;
    if (player.climbing) { p.x += Math.sin(player.face) * 0.4; p.z += Math.cos(player.face) * 0.4; } // 幹を蹴って後ろへ
    player.lastTop = trees.find((t) => Math.hypot(t.x - p.x, t.z - p.z) < 2 && p.y > t.h - 2.5) || null;
    player.climbing = null; player.riding = null; player.onGround = false;
    sfx.jump();
  }
  jumpPressed = false;
  if (player.boost > 0) {
    if (jumpHeld && player.vy > 0) { player.boost -= dt; player.vy += (GRAV + JUMP_ACC) * dt; }
    else player.boost = 0;
  }
  player.charge = player.boost > 0 ? 1 - player.boost / JUMP_BOOST_T : 0;

  // カメラの向きを基準にした移動方向。キャラクターは進む方向を向く
  const mvx = fx * cy - fz * sy, mvz = -fx * sy - fz * cy;
  if (len > 0.1 && !player.climbing) player.face = Math.atan2(-mvx, -mvz);
  // 木登り：幹に向かって進むと登る
  if (!player.climbing && len > 0.3) {
    for (const t of trees) {
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      if (d < 1.2 && p.y < t.h - 0.6) {
        const facing = (dx * mvx + dz * mvz) / Math.max(d, 1e-3) / Math.max(len, 1e-3);
        if (facing > 0.2) { player.climbing = t; player.riding = null; break; }
      }
    }
  }

  if (player.climbing) {
    const t = player.climbing;
    const toT = Math.atan2(-(t.x - p.x), -(t.z - p.z));
    player.face = toT;
    const along = len > 0.1 ? ((t.x - p.x) * mvx + (t.z - p.z) * mvz) / Math.max(Math.hypot(t.x - p.x, t.z - p.z), 1e-3) / len : 0;
    if (len > 0.5 && Math.abs(along) < 0.4) { player.climbing = null; } // 横に動くと手を離す
    else {
      if (along > 0.3) p.y += 4 * boostMul * dt;
      else if (along < -0.3) p.y -= 4 * boostMul * dt;
      // 0.5m 登る（降りる）ごとに「ざっ」
      player.climbStep = (player.climbStep || 0) + Math.abs(p.y - prevY);
      if (player.climbStep > 0.5) { player.climbStep = 0; sfx.climb(); }
      p.y = Math.min(p.y, t.h - 0.4);
      player.vy = 0;
      let dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz) || 1;
      p.x = t.x + dx / d * 0.85; p.z = t.z + dz / d * 0.85;
      const gy = groundY(p.x, p.z);
      if (p.y <= gy) { p.y = gy; if (along < -0.3) player.climbing = null; }
      player.onGround = false;
    }
  }

  if (!player.climbing) {
    // 空中では少し速く動けるので、てっぺんからとなりの木のてっぺんへ飛び移れる
    const speed = ((keys.ShiftLeft || keys.ShiftRight) ? 8 : 4.5) * boostMul * (player.onGround ? 1 : 1.3);
    // 着地アシスト：落ちてくるとき近くの木のてっぺんの上に来たら、そこへ吸い寄せて着地させる
    let target = null;
    if (!player.onGround && player.vy < 0) {
      let best = 5.5 * 5.5;
      for (const t of trees) {
        const dx = t.x - p.x, dz = t.z - p.z, d2 = dx * dx + dz * dz;
        if (d2 < best && p.y > t.h - 1.5 && t.ratio >= 0.08 && t !== player.lastTop) { best = d2; target = t; }
      }
    }
    if (target) { const k = Math.min(1, dt * 7); p.x += (target.x - p.x) * k; p.z += (target.z - p.z) * k; }
    else { p.x += mvx * speed * dt; p.z += mvz * speed * dt; }
    player.walk += len * speed * dt;
    player.vy = Math.max(player.vy - GRAV * (player.vy < 0 ? FALL_MUL : 1) * dt, -38);
    p.y += player.vy * dt;
  }
  if (p.y > 40) { p.y = 40; player.vy = 0; }

  // 範囲
  if (p.z > R246.south) { p.x = clamp(p.x, -120, 120); p.z = Math.min(p.z, R246.north - 0.5); if (p.z < R246.walkS && Math.abs(p.x) > EDGE - 0.3) p.x = Math.sign(p.x) * Math.max(Math.abs(p.x), 0) ; }
  else if (p.z > AVE_END - 2) {
    const inSide = Math.abs(p.z - SIDE_Z) < SIDE_ROW + 1.8 && p.x < -EDGE + 0.5;
    p.x = clamp(p.x, inSide ? -EDGE - SIDE_LEN - 12 : -EDGE + 0.3, EDGE - 0.3);
    if (p.x < -EDGE + 0.3 && p.x > -EDGE - SIDE_LEN) p.z = clamp(p.z, SIDE_Z - SIDE_ROW - 1.8, SIDE_Z + SIDE_ROW + 1.8);
    else if (Math.abs(p.z - SIDE_Z) >= SIDE_ROW + 1.8 && prevX < -EDGE + 0.3 && p.x > -EDGE - SIDE_LEN) p.x = -EDGE + 0.3;
  } else p.x = clamp(p.x, -150, 150);
  p.z = clamp(p.z, GALLERY_Z + 18, R246.north - 0.5);
  // 街灯・ベンチ・ボラード・池などの障害物（高さを越えていれば乗り越えられる）
  for (const o of OBST) {
    if (p.y >= o.h) continue;
    if (o.hw) { // 長方形
      const dx = p.x - o.x, dz = p.z - o.z, ox = o.hw + 0.3 - Math.abs(dx), oz = o.hd + 0.3 - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (o.h - p.y < 0.5 && player.vy <= 0) { p.y = o.h; player.vy = 0; player.onGround = true; continue; } // 段差は上る
        if (ox < oz) p.x = o.x + Math.sign(dx || 1) * (o.hw + 0.3); else p.z = o.z + Math.sign(dz || 1) * (o.hd + 0.3);
      }
      continue;
    }
    const dx = p.x - o.x, dz = p.z - o.z, rr = o.r + 0.3;
    if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
    const d = Math.hypot(dx, dz);
    if (d < rr && d > 1e-4) { p.x = o.x + dx / d * rr; p.z = o.z + dz / d * rr; }
  }
  // 歩行者とはぶつかる（すり抜けない）。頭より上なら飛び越えられる
  for (const q of people) {
    if (!q.active || p.y > 1.75 * q.h) continue;
    const dx = p.x - q.x, dz = p.z - q.z, rr = 0.6;
    if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
    if (Math.hypot(dx, dz) < rr) {
      // ぶつかる前にいた側へ押し戻す（正面からなら止まる）
      let nx = prevX - q.x, nz = prevZ - q.z; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      p.x = q.x + nx * rr; p.z = q.z + nz * rr;
    }
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
      if (!player.onGround && player.vy < -2) sfx.land(-player.vy);
      p.y = sup.y; player.vy = 0; player.onGround = true; player.riding = sup.car; player.lastTop = null;
    } else if (p.y > sup.y + 0.05) { player.onGround = false; player.riding = null; }
  }

  player.moving = len;
  updateAvatar(dt);
  updateFollowCamera();
}

// 三人称カメラ：プレイヤーの約8m後ろから見る
const CAM_DIST = 8;
const _camT = new THREE.Vector3();
function updateFollowCamera() {
  const p = player.pos;
  const elev = clamp(-player.pitch, -0.1, 1.25);
  _camT.set(p.x, p.y + 1.6, p.z);
  camera.position.set(
    _camT.x + Math.sin(player.yaw) * Math.cos(elev) * CAM_DIST,
    _camT.y + Math.sin(elev) * CAM_DIST,
    _camT.z + Math.cos(player.yaw) * Math.cos(elev) * CAM_DIST);
  const gy = groundY(camera.position.x, camera.position.z) + 0.4;
  if (camera.position.y < gy) camera.position.y = gy;
  camera.lookAt(_camT.x, _camT.y + 1.2, _camT.z);
}

// プレイヤーのキャラクター（コートにマフラーの散歩人）
const avatar = (() => {
  const g = new THREE.Group();
  const coat = lambert(0xc49a5a), scarf = lambert(0xb4232a), pants = lambert(0x2d3340), skin = lambert(0xf0cfae), hair = lambert(0x2a1d14), shoe = lambert(0x3a2a20);
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const legGeo = new THREE.CapsuleGeometry(0.1, 0.62, 4, 8).translate(0, -0.41, 0);
  const armGeo = new THREE.CapsuleGeometry(0.075, 0.5, 4, 8).translate(0, -0.32, 0);
  const legL = mk(legGeo, pants, -0.12, 0.9, 0), legR = mk(legGeo, pants, 0.12, 0.9, 0);
  for (const l of [legL, legR]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), shoe); sh.position.set(0, -0.84, -0.06); l.add(sh); }
  mk(new THREE.CapsuleGeometry(0.24, 0.55, 4, 10), coat, 0, 1.22, 0);         // 胴（コート）
  mk(new THREE.CylinderGeometry(0.3, 0.36, 0.35, 12), coat, 0, 0.88, 0);       // コートの裾
  mk(new THREE.TorusGeometry(0.15, 0.06, 6, 14).rotateX(Math.PI / 2), scarf, 0, 1.58, 0);
  const tail = mk(new THREE.BoxGeometry(0.12, 0.38, 0.04), scarf, 0.08, 1.38, -0.24);
  const armL = mk(armGeo, coat, -0.33, 1.5, 0), armR = mk(armGeo, coat, 0.33, 1.5, 0);
  mk(new THREE.SphereGeometry(0.16, 14, 10), skin, 0, 1.78, 0);
  const h = mk(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.8, 0.01);
  h.rotation.x = 0.15;
  g.visible = false;
  scene.add(g);
  return { g, legL, legR, armL, armR, tail };
})();
function updateAvatar(dt) {
  const A = avatar, p = player.pos;
  A.g.visible = true;
  A.g.position.set(p.x, p.y, p.z);
  // 向きはなめらかに
  let d = player.face - A.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  A.g.rotation.y += d * Math.min(1, dt * 12);
  const run = (keys.ShiftLeft || keys.ShiftRight) ? 1.4 : 1;
  const sw = player.onGround && player.moving > 0.1 ? Math.sin(player.walk * 2.4) * 0.6 * run : 0;
  if (player.climbing) {
    const c = Math.sin(p.y * 3) * 0.5;
    A.armL.rotation.x = -2.6 + c; A.armR.rotation.x = -2.6 - c; A.legL.rotation.x = -0.6 - c; A.legR.rotation.x = -0.6 + c;
  } else if (!player.onGround) {
    A.armL.rotation.x = A.armR.rotation.x = -2.4; A.legL.rotation.x = -0.4; A.legR.rotation.x = 0.3;
  } else {
    A.legL.rotation.x = sw; A.legR.rotation.x = -sw; A.armL.rotation.x = -sw * 0.8; A.armR.rotation.x = sw * 0.8;
  }
  A.armL.rotation.z = -0.12; A.armR.rotation.z = 0.12;
  // ためている間はしゃがむ
  A.g.scale.set(1, 1, 1);
  A.tail.rotation.x = -0.3 - Math.min(0.8, Math.abs(player.vy) * 0.05) - player.moving * 0.3;
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
  player.pitch = clamp(player.pitch - dy * k, -1.25, 0.1);
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
btnJump.addEventListener('touchstart', (e) => { if (!jumpHeld) jumpPressed = true; jumpHeld = true; e.preventDefault(); }, { passive: false });
btnJump.addEventListener('touchend', () => { jumpHeld = false; });

// ---------------------------------------------------------------------------
// 葉をつかむ
// ---------------------------------------------------------------------------
const _fw = new THREE.Vector3(), _d = new THREE.Vector3();
function findCatchable() {
  // 三人称視点：プレイヤーの手が届く範囲（約3.5m）でいちばん近い舞う葉
  const p = player.pos;
  let best = -1, bestD = 3.5 * 3.5;
  for (let i = 0; i < FALL_MAX; i++) {
    if (!fActive[i] || fCaught[i] > 0) continue;
    const dx = fPos[i * 3] - p.x, dy = fPos[i * 3 + 1] - (p.y + 1.4), dz = fPos[i * 3 + 2] - p.z;
    const d = dx * dx + dy * dy * 0.6 + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
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
  scene.fog.near = lerp(60, 120, dayF); scene.fog.far = lerp(1400, 3200, dayF);
  skylineWin.emissiveIntensity = smooth(0.2, 0.7, nightF) * 1.4;
  for (const m of nightMats) m.emissiveIntensity = skylineWin.emissiveIntensity;
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
  function noise(dur, freq, vol) {   // 短いノイズ（足音・葉のこすれ）
    if (!ctx) return;
    const t = ctx.currentTime, len = Math.max(1, (ctx.sampleRate * dur) | 0), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(ctx.destination); src.start(t);
  }
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
  return {
    init,
    get ctx() { return ctx; },
    resume() { ctx && ctx.state === 'suspended' && ctx.resume(); },
    wind(level) { if (windGain) { windGain.gain.setTargetAtTime(0.08 + level * 0.3, ctx.currentTime, 0.5); windFilter.frequency.setTargetAtTime(350 + level * 900, ctx.currentTime, 0.5); } },
    catch(c) { tone(PENTA[Math.min(c - 1, PENTA.length - 1)], 0, 0.6, 0.1); },
    gold() { [0, 2, 4, 5, 7].forEach((n, k) => tone(PENTA[n], k * 0.07, 0.9, 0.09, 'triangle')); },
    restore() { [0, 2, 4, 7].forEach((n, k) => tone(PENTA[n] / 2, k * 0.09, 1.4, 0.1, 'triangle')); },
    fall() { tone(220, 0, 1.2, 0.06, 'sine'); tone(174.6, 0.15, 1.5, 0.05); },
    // ジャンプ：「ぴょん」と上がる音
    jump() { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square';
      o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(990, t + 0.14);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      o.connect(f).connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.25); noise(0.04, 1800, 0.08); },
    // 着地：落ちた高さに応じた「とすっ」という音（地面・落ち葉の上）
    land(v) { if (!ctx) return; const k = Math.min(1, v / 18); tone(110 - k * 40, 0, 0.18 + k * 0.2, 0.08 + k * 0.12, 'sine'); noise(0.08 + k * 0.12, 600 + (1 - k) * 600, 0.06 + k * 0.1); },
    // 木登り：幹をつかむ「ざっ、ざっ」という音
    climb() { noise(0.07, rand(900, 1500), 0.07); tone(rand(150, 190), 0, 0.06, 0.025, 'triangle'); },
    horn() { tone(415, 0, 0.5, 0.05, 'square'); tone(523, 0, 0.5, 0.04, 'square'); },
    crash() { tone(110, 0, 0.6, 0.2, 'sawtooth'); tone(70, 0.05, 0.8, 0.2, 'square'); },
  };
})();

// ---------------------------------------------------------------------------
// BGM：オルゴール風のメルヘンなワルツ（オリジナル曲・WebAudioで生成）
// ---------------------------------------------------------------------------
const bgm = (() => {
  const BPM = 92, EIGHTH = 60 / BPM / 2;          // 3/4拍子、1小節 = 8分音符6つ
  const _ = 0;
  // メロディ（MIDIノート番号、0は休符）。16小節
  const MEL = [
    76, _, 79, _, 84, _,   83, _, 81, _, 76, _,   77, _, 81, _, 84, _,   83, _, 79, _, 74, _,
    76, 79, 84, _, 88, _,  86, _, 83, _, 79, _,   81, _, 77, _, 74, 71,  72, _, _, _, _, _,
    79, _, 76, _, 72, _,   81, _, 84, _, 88, _,   77, _, 81, _, 77, _,   79, _, 83, _, 86, _,
    88, _, 86, _, 84, _,   83, _, 79, _, 76, _,   77, _, 74, _, 71, _,   72, _, _, 79, 84, _,
  ];
  // 和音（1小節ごと）：根音と和音の構成音
  const C = [48, 60, 64, 67], Am = [45, 57, 60, 64], F = [41, 57, 60, 65], G = [43, 55, 59, 62], Em = [40, 55, 59, 64], Dm = [38, 57, 62, 65];
  const CH = [C, Am, F, G, C, Em, F, C, C, Am, F, G, Am, Em, Dm, C];
  let ctx = null, out = null, on = true, timer = null, step = 0, nextT = 0, started = false;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function bell(m, t, vol, dur) {   // オルゴールの音：基音＋高い倍音、すぐに減衰
    for (const [mul, v, d] of [[1, 1, 1], [4, 0.18, 0.35], [2.01, 0.25, 0.6]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz(m) * mul;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * d);
      o.connect(g).connect(out); o.start(t); o.stop(t + dur * d + 0.05);
    }
  }
  function pad(m, t, vol, dur) {     // 伴奏：やわらかい三角波
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function schedule() {
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 6) % 16, pos = step % 6, ch = CH[bar];
      const m = MEL[step % MEL.length];
      if (m) bell(m, nextT, 0.16, 1.6);
      if (pos === 0) pad(ch[0], nextT, 0.09, EIGHTH * 2.2);                       // 1拍目：低音
      if (pos === 2 || pos === 4) for (const n of ch.slice(1)) pad(n, nextT, 0.03, EIGHTH * 1.6); // 2・3拍目：和音
      if (pos === 5 && bar % 4 === 3) bell(ch[3] + 24, nextT, 0.05, 1.2);          // ときどき高いきらめき
      nextT += EIGHTH; step++;
    }
  }
  function start() {
    if (started) return;
    sfx.init(); ctx = sfx.ctx; if (!ctx) return;
    started = true;
    out = ctx.createGain(); out.gain.value = on ? 0.55 : 0;
    // やわらかい残響（ディレイのフィードバック）
    const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
    dl.delayTime.value = EIGHTH * 3; fb.gain.value = 0.32; wet.gain.value = 0.35; lp.type = 'lowpass'; lp.frequency.value = 2400;
    out.connect(ctx.destination); out.connect(dl); dl.connect(lp).connect(fb).connect(dl); lp.connect(wet).connect(ctx.destination);
    nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 100);
  }
  function toggle() {
    on = !on;
    if (out) out.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.1);
    try { localStorage.setItem('icho-bgm', on ? '1' : '0'); } catch {}
    return on;
  }
  try { if (localStorage.getItem('icho-bgm') === '0') on = false; } catch {}
  return { start, toggle, get on() { return on; } };
})();
{
  // BGMの切り替え：Mキー、またはタイトル・一時停止・HUDのボタン
  const btns = [...document.querySelectorAll('.bgmBtn')];
  const sync = () => btns.forEach((btn) => { btn.textContent = bgm.on ? '♪ BGM オン（M）' : '♪ BGM オフ（M）'; btn.classList.toggle('off', !bgm.on); });
  const flip = () => { bgm.start(); bgm.toggle(); sync(); };
  sync();
  btns.forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); flip(); }));
  addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) flip(); });
}

// ---------------------------------------------------------------------------
// ゲーム進行
// ---------------------------------------------------------------------------
let state = 'title', elapsed = 0, endTimer = 0, lastDayToast = 0;
const wind = { x: 0.4, z: -0.2, gust: 0, nextGust: 18 };
let lastPhase = '', lightupToasted = -1, lastAlive = trees.length, lastLeafToasted = false;

function resetGame() {
  elapsed = 0; caught = 0; golds = 0; restored = 0; combo = 0; endTimer = 0; lastLeafToasted = false; goldSum = 0; lastDayToast = 0;
  player.pos.set(13.8, 0.12, 6); player.vy = 0; player.yaw = 0; player.pitch = -0.28; player.face = 0; player.charge = 0; player.climbing = null; player.riding = null; player.onGround = true; player.hop = null;
  cars.forEach((c) => { if (!c.parked) { c.active = false; c.mesh.visible = false; } });
  for (let i = 0; i < FALL_MAX; i++) if (fActive[i]) freeFalling(i);
  for (let i = 0; i < GROUND_MAX; i++) groundMesh.setMatrixAt(i, ZERO);
  groundIdx = 0; groundCount = 0;
  scatterInitialGround();
  trees.forEach((t, ti) => {
    t.list.length = 0; t.cooldown = 0; t.restoredDay = -99; t.acc = 0; t.dead = false;
    const keep = Math.floor(LEAVES * rand(0.9, 1.0)); // 見頃の状態からスタート
    for (let k = 0; k < keep; k++) t.list.push(k);
    t.ratio = t.list.length / LEAVES;
  });
  instDirty = true;
  people.forEach((p, i) => { p.active = false; bodyMesh.setMatrixAt(i, ZERO); headMesh.setMatrixAt(i, ZERO); hatMeshes[p.hat].setMatrixAt(i, ZERO); });
  // 開始時点の人出
  const init = Math.round(PEOPLE_MAX * 0.85 * hourFactor(START_HOUR));
  for (let k = 0; k < init; k++) spawnPerson(people[k], true);
  lastAlive = trees.length;
}

function removeLeaf(t, ti, nearPlayer) {
  const n = t.list.length;
  if (!n) return;
  treeLeafWorldPos(t, _v);  // 今の葉の量のテンプレートから、散る葉の出どころを選ぶ
  t.list.pop();
  const x = _v.x, y = _v.y, z = _v.z;
  const gold = Math.random() < 1 / 150;
  if (!((nearPlayer || Math.random() < 0.3 || gold) && spawnFalling(x, y, z, gold))) addGroundLeaf(x + rand(-1.5, 1.5), z + rand(-1.5, 1.5));
  t.ratio = t.list.length / LEAVES;
  if (t.list.length === 0 && !t.dead) { t.dead = true; }
  markTree(t);
}

function restoreTree(t, ti) {
  const kind = t.orbKind;
  placeOrb(t, ti);   // 次に枯れかけたときは別の場所で光る
  while (t.list.length < LEAVES) t.list.push(t.list.length);
  t.ratio = 1; t.dead = false; t.cooldown = 1.5; t.restoredDay = Math.floor(elapsed / DAY_SEC);
  markTree(t);
  restored++;
  doBurst(t);
  sfx.restore();
  toast('光る玉に触れた！ 紅葉がよみがえる');
}

const _body = new THREE.Vector3();
let lastUsedToast = -10, goldSum = 0;
function updateTrees(dt) {
  const rate = RATE_BASE * (1 + elapsed / RATE_T) * (1 + wind.gust * 1.6); // 時間とともに散るのが早くなる
  const today = Math.floor(elapsed / DAY_SEC);
  const px = player.pos.x, pz = player.pos.z;
  const body = _body.set(px, player.pos.y + 0.9, pz);   // _v は葉の位置計算で上書きされるので別の変数を使う
  let total = 0, alive = 0;
  for (let ti = 0; ti < trees.length; ti++) {
    const t = trees[ti];
    if (t.cooldown > 0) t.cooldown -= dt;
    // てっぺんに触れたら紅葉が戻る
    const dx = body.x - t.orb.x, dy = body.y - t.orb.y, dz = body.z - t.orb.z;
    if (dx * dx + dy * dy + dz * dz < (t.orbKind === 'top' ? 2.6 : 1.8) ** 2 && t.cooldown <= 0 && t.ratio < RESTORE_AT) {
      if (today - t.restoredDay < REVIVE_DAYS) { if (elapsed - lastUsedToast > 2.5) { lastUsedToast = elapsed; const n = REVIVE_DAYS - (today - t.restoredDay); toast(n === 1 ? 'この木はよみがえらせたばかり。また明日' : `この木はよみがえらせたばかり。あと${n}日`); } }
      else restoreTree(t, ti);
    }

    if (t.list.length) {
      // 木ごとにゆらぐ速さ＋ときどき一気に散る
      const wave = 0.5 + 0.5 * Math.sin(elapsed * t.rateFreq + t.ratePhase);
      t.acc += rate * (LEAVES / 300) * t.rateMul * (0.3 + 1.5 * wave * wave) * dt;
      if (Math.random() < dt * 0.025) t.acc += rand(6, 30) * RATE_BASE / 2.6;
      const near = Math.abs(t.z - pz) < 70;
      while (t.acc >= 1 && t.list.length) { t.acc -= 1; removeLeaf(t, ti, near); }
    }
    total += t.list.length;
    if (t.list.length) alive++;
    // てっぺんの目印の色
    // てっぺんの玉：枯れかけた木（触れるとよみがえる木）だけ点灯する。元気な木は消灯
    const r = t.ratio, pulse = 0.75 + 0.25 * Math.sin(elapsed * 3 + ti), blink = 0.55 + 0.45 * Math.sin(elapsed * 8 + ti);
    if (r >= RESTORE_AT) apexCol.set([0, 0, 0], ti * 3);
    else if (today - t.restoredDay < REVIVE_DAYS) apexCol.set([0.22, 0.22, 0.26], ti * 3);   // 灰色：よみがえらせてから2日たっていない
    else if (r < 0.3) apexCol.set([1 * blink, 0.22 * blink, 0.08 * blink], ti * 3);   // 赤く点滅：急いで
    else apexCol.set([1 * pulse, 0.82 * pulse, 0.35 * pulse], ti * 3);               // 金色に点灯：枯れはじめ
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
      fPos[o] += (player.pos.x - fPos[o]) * k; fPos[o + 1] += (player.pos.y + 1.4 - fPos[o + 1]) * k; fPos[o + 2] += (player.pos.z - fPos[o + 2]) * k;
      if (fCaught[i] > 0.35) { freeFalling(i); continue; }
    } else {
      const ph = fPhase[i] + t * 1.7;
      const flutter = Math.sin(ph) * 0.9;
      fPos[o] += (wind.x * (1 + wind.gust * 3) + Math.cos(ph * 0.7) * 0.6) * dt;
      fPos[o + 2] += (wind.z * (1 + wind.gust * 3) + flutter * 0.6) * dt;
      fPos[o + 1] -= Math.max(0.55, fSpeed[i] * (0.75 + 0.45 * Math.abs(Math.sin(ph))) - wind.gust * 0.3) * dt; // 散った葉は必ず重力で落ちる
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
  $('ratio').textContent = `${(ratio * 100).toFixed(0)}%`;
  $('alive').classList.toggle('danger', alive <= 10);
  $('left').textContent = `${Math.max(0, Math.ceil(GOAL_DAYS - elapsed / DAY_SEC))}日`;
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

function rankOfClear(n) {   // n：7日目の終わりに葉が残っていた木の本数
  if (n >= 60) return 'いちょう並木の守り神';
  if (n >= 30) return '黄金の並木の名人';
  if (n >= 10) return '外苑の庭師';
  return '並木の世話人';
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
  // スコア：①葉が残っていた木の本数（メイン）と ②残った葉の量（並木全体で満開の何%）
  const leftTrees = trees.filter((t) => t.list.length > 0).length;
  const leftLeaves = trees.reduce((a, t) => a + t.list.length, 0) / (trees.length * LEAVES) * 100;
  const leftPct = leftLeaves > 0 && leftLeaves < 1 ? leftLeaves.toFixed(1) : Math.round(leftLeaves);
  window.__ichoResult = { reason, leftTrees, leftPct: +leftPct, days: +days.toFixed(2) };
  const clear = reason === 'clear';
  $('overSub').textContent = clear ? 'いちょう祭りの7日間を守り切った！' : reason === 'car' ? '車道で車にぶつかってしまった' : '最後の一葉が散りました';
  $('overTitle').textContent = clear ? '並木は最後まで黄金色' : reason === 'car' ? '危ない！ 車にはねられた' : '並木に冬が来た';
  $('result').innerHTML = clear ? `
    <div>7日目の終わりに、葉が残っていた木</div>
    <div class="big">${leftTrees}本<small> ／146本</small></div>
    <div class="sub2">残った葉　<b>${leftPct}%</b>（並木全体で、満開のときの何%か）</div>
    <div>よみがえらせた木 <b>${restored}</b> 本 ／ つかんだ葉 <b>${caught}</b>（金の葉 ${golds}枚）</div>
    <div class="rank">称号：${rankOfClear(leftTrees)}</div>` : `
    <div>並木の秋を守った時間</div>
    <div class="big">${fullDays}日と${hours}時間</div>
    <div>葉が残っていた木 <b>${leftTrees}本</b> ／ 残った葉 <b>${leftPct}%</b></div>
    <div>よみがえらせた木 <b>${restored}</b> 本 ／ つかんだ葉 <b>${caught}</b></div>
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
  sfx.init(); sfx.resume(); bgm.start();
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
    const cover = smooth(0.06, 0.88, total / (trees.length * LEAVES));
    CARPET_U.uCover.value = cover;
    if (pileMat) pileMat.opacity = cover;
    trimGroundLeaves(cover);
    updateHUD(total, alive);
    const ratioNow = total / (trees.length * LEAVES);
    goldSum += ratioNow * dt;
    const day = Math.floor(elapsed / DAY_SEC);
    if (day > lastDayToast && day < GOAL_DAYS) { lastDayToast = day; toast(day === GOAL_DAYS - 1 ? 'いちょう祭り 最終日！' : `いちょう祭り ${day + 1}日目　あと${GOAL_DAYS - day}日`); }
    if (elapsed >= GOAL_DAYS * DAY_SEC) gameOver('clear');
    else if (total === 0) {
      if (!lastLeafToasted) { lastLeafToasted = true; toast('最後の一葉が散った……', 3000); sfx.fall(); }
      endTimer += dt;
      if (endTimer > 3.5) gameOver('winter');
    }
  } else if (state === 'title') {
    avatar.g.visible = false;
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
      if (Math.abs(t.z - camera.position.z) < 60) { treeLeafWorldPos(t, _v); spawnFalling(_v.x, _v.y, _v.z); }
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
window.__icho = { people, get apexCol() { return apexCol; }, scene, THREE, trees, player, cars, step(dt, n = 1) { for (let i = 0; i < n; i++) step(dt); }, get state() { return state; }, get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; } };
