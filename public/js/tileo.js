(function(){
/* ---- 00_core.js ---- */
'use strict';
/* ================= core: utils, storage, renderer, post, shared helpers ================= */
const T = THREE;
const G = { state: 'loading', time: 0, dt: 0, frame: 0 };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
function wrapAngle(a) { return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
function dampAngle(a, b, k, dt) { return a + wrapAngle(b - a) * (1 - Math.exp(-k * dt)); }
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rng = mulberry(20261101);
const rand = (a = 0, b = 1) => a + (b - a) * rng();
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(rng() * arr.length)];
const mrand = (a = 0, b = 1) => a + (b - a) * Math.random();
const mpick = arr => arr[Math.floor(Math.random() * arr.length)];
const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const _v1 = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3(), _m1 = new T.Matrix4(), _q1 = new T.Quaternion(), _e1 = new T.Euler();
const $ = id => document.getElementById(id);
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
function fmtTime(min) { min = ((Math.floor(min) % 1440) + 1440) % 1440; const h = Math.floor(min / 60), m = min % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const Store = {
  get(k, d) { try { const v = localStorage.getItem('tileo.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tileo.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('tileo.' + k); } catch (e) { } }
};

const QUALITY = {
  battery: { label: 'Battery', pr: 1, shadows: false, shadowSize: 1024, bloom: false, npc: 26, rings: 110, segs: 160, msaa: 0, octaves: 2, detail: 0 },
  high: { label: 'High', pr: 1.5, shadows: true, shadowSize: 2048, bloom: true, npc: 42, rings: 150, segs: 200, msaa: 2, octaves: 3, detail: 1 },
  ultra: { label: 'Ultra', pr: 2, shadows: true, shadowSize: 4096, bloom: true, npc: 60, rings: 190, segs: 256, msaa: 4, octaves: 3, detail: 2 },
};
const MAX_NPC = 60;

/* ---------------- renderer + post ---------------- */
function initRenderer() {
  const canvas = $('game');
  const r = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
  r.outputEncoding = T.sRGBEncoding;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true;
  r.shadowMap.type = T.PCFSoftShadowMap;
  r.setClearColor(0x071426, 1);
  G.renderer = r;
  G.maxAniso = r.capabilities.getMaxAnisotropy();
  const gl2 = r.capabilities.isWebGL2;
  G.floatRT = !!(gl2 && r.extensions.get('EXT_color_buffer_float'));
  G.hdrOK = !!(gl2 && (G.floatRT || r.extensions.get('EXT_color_buffer_half_float')));
  G.gl2 = gl2;
  G.camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.25, 14000);
  G.scene = new T.Scene();
}

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1 }, vignette: { value: 0.28 }, grade: { value: new T.Vector3(1, 1, 1) }, sat: { value: 1.06 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float exposure; uniform float vignette; uniform vec3 grade; uniform float sat; varying vec2 vUv;
    vec3 RRTAndODTFit(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
    vec3 aces(vec3 c){
      const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));
      const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));
      c*=exposure/0.6; c=I*c; c=RRTAndODTFit(c); c=O*c; return clamp(c,0.0,1.0);
    }
    vec3 toSRGB(vec3 c){ return mix(pow(c,vec3(0.41666))*1.055-vec3(0.055), c*12.92, vec3(lessThanEqual(c,vec3(0.0031308)))); }
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb*grade;
      c=aces(c);
      float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(l),c,sat);
      vec2 d=vUv-0.5; c*=1.0-vignette*smoothstep(0.25,0.85,dot(d,d)*2.2);
      gl_FragColor=vec4(toSRGB(c),1.0);
    }`
};

function setupPost() {
  const r = G.renderer, q = G.quality;
  if (G.post) { G.post.composer.renderTarget1.dispose(); G.post.composer.renderTarget2.dispose(); G.post = null; }
  const want = q.bloom && G.hdrOK && typeof T.EffectComposer === 'function' && typeof T.UnrealBloomPass === 'function';
  const prevTM = r.toneMapping;
  if (!want) {
    r.toneMapping = T.ACESFilmicToneMapping;
  } else {
    r.toneMapping = T.NoToneMapping;
    const w = Math.max(2, Math.floor(innerWidth * r.getPixelRatio())), h = Math.max(2, Math.floor(innerHeight * r.getPixelRatio()));
    const opts = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.HalfFloatType };
    let rt;
    if (G.gl2 && q.msaa > 0 && T.WebGLMultisampleRenderTarget && G.floatRT) { rt = new T.WebGLMultisampleRenderTarget(w, h, opts); rt.samples = q.msaa; }
    else rt = new T.WebGLRenderTarget(w, h, opts);
    const composer = new T.EffectComposer(r, rt);
    const rp = new T.RenderPass(G.scene, G.camera);
    composer.addPass(rp);
    const bloom = new T.UnrealBloomPass(new T.Vector2(Math.floor(w / 2), Math.floor(h / 2)), 0.55, 0.55, 1.4);
    composer.addPass(bloom);
    const fin = new T.ShaderPass(FinalShader);
    fin.renderToScreen = true;
    composer.addPass(fin);
    G.post = { composer, rp, bloom, fin };
  }
  if (prevTM !== r.toneMapping) G.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
}

function applyQuality(name) {
  G.qualityName = name;
  G.quality = QUALITY[name];
  const r = G.renderer;
  const pr = Math.min(window.devicePixelRatio || 1, G.quality.pr * (G.prScale || 1));
  r.setPixelRatio(pr);
  r.setSize(innerWidth, innerHeight, false);
  r.shadowMap.enabled = G.quality.shadows;
  if (G.sun) {
    G.sun.castShadow = G.quality.shadows;
    if (G.sun.shadow.map) { G.sun.shadow.map.dispose(); G.sun.shadow.map = null; }
    G.sun.shadow.mapSize.set(G.quality.shadowSize, G.quality.shadowSize);
  }
  G.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
  setupPost();
  if (G.ocean) G.ocean.material.defines.OCTAVES = G.quality.octaves, G.ocean.material.needsUpdate = true;
  if (G.crowd) G.crowd.setActive(G.quality.npc);
}

function onResize() {
  const r = G.renderer; if (!r) return;
  const w = innerWidth, h = innerHeight;
  r.setSize(w, h, false);
  G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
  if (G.studioCam) { G.studioCam.aspect = w / h; G.studioCam.updateProjectionMatrix(); }
  if (G.post) {
    const pr = r.getPixelRatio();
    G.post.composer.setPixelRatio(1);
    G.post.composer.setSize(Math.floor(w * pr), Math.floor(h * pr));
    G.post.bloom.setSize(Math.floor(w * pr / 2), Math.floor(h * pr / 2));
  }
  if (G.onResizeExtra) G.onResizeExtra();
}

function renderFrame(scene, camera) {
  const r = G.renderer;
  if (G.post) {
    G.post.rp.scene = scene; G.post.rp.camera = camera;
    const n = G.night || 0;
    G.post.bloom.threshold = lerp(2.2, 1.05, n);
    G.post.bloom.strength = lerp(0.3, 0.62, n) * (G.bloomBoost || 1);
    G.post.fin.uniforms.exposure.value = G.exposure || 1;
    G.post.composer.render();
  } else {
    r.toneMappingExposure = G.exposure || 1;
    r.render(scene, camera);
  }
}

/* ---------------- canvas textures ---------------- */
function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new T.CanvasTexture(c);
  t.encoding = o.linear ? T.LinearEncoding : T.sRGBEncoding;
  t.anisotropy = Math.min(o.aniso || 8, G.maxAniso || 1);
  if (o.repeat !== false) { t.wrapS = T.RepeatWrapping; t.wrapT = T.RepeatWrapping; }
  if (o.nomip) { t.generateMipmaps = false; t.minFilter = T.LinearFilter; }
  return t;
}
function noiseFill(g, w, h, base, amt, n, size = 1) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const a = rand(-amt, amt); g.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`; g.fillRect(rand(0, w), rand(0, h), size, size); }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const TILE_COLORS = ['#2fd3c6', '#ff6a55', '#5aa9ff', '#ffc95c'];
function drawEmblem(g, x, y, s, gap) {
  const c = (s - gap) / 2;
  for (let i = 0; i < 4; i++) { g.fillStyle = TILE_COLORS[i]; rr(g, x + (i % 2) * (c + gap), y + Math.floor(i / 2) * (c + gap), c, c, c * 0.18); g.fill(); }
}

const TEX = {};
function buildTextures() {
  // teak deck planks: 4m x 4m per tile, boards along z (v)
  TEX.teak = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#7a4f2e'; g.fillRect(0, 0, w, h);
    const pw = 38; // ~0.15m
    for (let x = 0; x < w; x += pw) {
      let y = -rand(0, 400);
      while (y < h) {
        const len = rand(260, 520);
        const tone = rand(-18, 18), l = 52 + tone * 0.3;
        g.fillStyle = `hsl(${rand(24, 30)},${rand(40, 52)}%,${rand(30, 40)}%)`;
        g.fillRect(x + 1, y + 1, pw - 3, len - 2);
        g.globalAlpha = 0.18; g.strokeStyle = '#3c2412'; g.lineWidth = 1;
        for (let k = 0; k < 5; k++) { g.beginPath(); const gx = x + rand(4, pw - 4); g.moveTo(gx, y); g.bezierCurveTo(gx + rand(-4, 4), y + len * 0.3, gx + rand(-4, 4), y + len * 0.6, gx + rand(-3, 3), y + len); g.stroke(); }
        g.globalAlpha = 1;
        y += len;
      }
      g.fillStyle = '#2a1a10'; g.fillRect(x + pw - 2, 0, 2, h);
    }
  });
  TEX.teak.repeat.set(0.25, 0.25);
  TEX.terrazzo = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#e9eef2'; g.fillRect(0, 0, w, h);
    const cols = ['#b9c6d2', '#2fd3c6', '#ff6a55', '#8fa3b6', '#d6dee6', '#5aa9ff'];
    for (let i = 0; i < 1600; i++) { g.fillStyle = pick(cols); g.globalAlpha = rand(0.35, 0.9); const s = rand(1.5, 5); g.beginPath(); g.ellipse(rand(0, w), rand(0, h), s, s * rand(0.5, 1), rand(0, 3), 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  });
  TEX.terrazzo.repeat.set(0.25, 0.25);
  TEX.nonskid = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#c9d6df', 0.08, 9000, 2);
  });
  TEX.nonskid.repeat.set(0.25, 0.25);
  TEX.splash = canvasTex(1024, 1024, (g, w, h) => {
    noiseFill(g, w, h, '#b9d9e2', 0.05, 6000, 2);
    g.lineWidth = 22; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = ['#5cc9dd', '#2a9fc4', '#ffc95c', '#ff8a73'][i % 4]; g.globalAlpha = 0.55;
      g.beginPath(); const y0 = i * 120 + 40;
      for (let x = -20; x <= w + 20; x += 20) { const y = y0 + Math.sin(x / 90 + i) * 28; x === -20 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  TEX.splash.repeat.set(1 / 16, 1 / 16);
  // pool mosaic: 1m tile
  TEX.mosaic = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#cfe8ee'; g.fillRect(0, 0, w, h);
    const n = 16, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const r = rng(); g.fillStyle = r < 0.55 ? '#1f8fb5' : r < 0.8 ? '#27a7c9' : r < 0.93 ? '#5cc9dd' : '#e9f7fa';
      g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
  });
  TEX.mosaicDark = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#0d1a26'; g.fillRect(0, 0, w, h);
    const n = 16, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const r = rng(); g.fillStyle = r < 0.5 ? '#173a5e' : r < 0.8 ? '#1d4a72' : r < 0.95 ? '#2a6890' : '#ffc95c';
      g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
  });
  // hull: u spans 32 m along z, v spans y -9..20
  const HW = 2048, HH = 1024, mPerU = 32, yTop = 20, yBot = -9;
  const yToPx = y => (1 - (y - yBot) / (yTop - yBot)) * HH, zToPx = z => z / mPerU * HW;
  const winRows = [9.4, 12.2, 15.0, 17.8];
  const lit = [];
  TEX.hull = canvasTex(HW, HH, g => {
    g.fillStyle = '#f3f6f9'; g.fillRect(0, 0, HW, HH);
    g.fillStyle = '#10264a'; g.fillRect(0, yToPx(6.2), HW, HH);
    g.fillStyle = '#ff6a55'; g.fillRect(0, yToPx(6.9), HW, yToPx(6.2) - yToPx(6.9));
    g.fillStyle = '#2fd3c6'; g.fillRect(0, yToPx(7.3), HW, yToPx(7.05) - yToPx(7.3));
    for (const wy of winRows) {
      for (let k = 0; k < 20; k++) {
        const z = k * 1.6 + 0.2, x = zToPx(z), y = yToPx(wy + 0.9), ww = zToPx(1.2), hh = yToPx(wy) - yToPx(wy + 0.9);
        const gr = g.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, '#36506b'); gr.addColorStop(0.45, '#1b2c40'); gr.addColorStop(1, '#0f1b29');
        g.fillStyle = gr; rr(g, x, y, ww, hh, 10); g.fill();
        g.strokeStyle = 'rgba(160,180,200,.5)'; g.lineWidth = 2; rr(g, x, y, ww, hh, 10); g.stroke();
        if (rng() < 0.5) lit.push([x, y, ww, hh]);
      }
    }
    g.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 8; i++) g.fillRect(0, yToPx(19.2 - i * 0.04), HW, 1);
  }, { aniso: 16 });
  TEX.hullEmis = canvasTex(HW, HH, g => {
    g.fillStyle = '#000'; g.fillRect(0, 0, HW, HH);
    for (const [x, y, w, h] of lit) { g.fillStyle = rng() < 0.7 ? '#ffcf8f' : '#ffe7c2'; rr(g, x + 2, y + 2, w - 4, h - 4, 8); g.fill(); }
  });
  for (const t of [TEX.hull, TEX.hullEmis]) t.repeat.set(1 / mPerU, 1);
  // superstructure window ribbon: u = meters/6, v 0..1
  TEX.ribbon = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b4762'); gr.addColorStop(0.5, '#142438'); gr.addColorStop(1, '#0b1522');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9d6e2'; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 6, h);
    g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
  });
  TEX.ribbonEmis = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 128) { if (rng() < 0.75) { g.fillStyle = rng() < 0.5 ? '#ffd9a0' : '#ffe9cc'; g.fillRect(x + 8, 8, 112, h - 16); } }
  });
  TEX.court = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#1b6fa0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff6a55'; g.fillRect(w * 0.33, 0, w * 0.34, h * 0.36);
    g.strokeStyle = '#f4f8fb'; g.lineWidth = 9;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeRect(w * 0.33, 14, w * 0.34, h * 0.36 - 14);
    g.beginPath(); g.arc(w / 2, h * 0.36, w * 0.17, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(w / 2, 14 + h * 0.05, w * 0.43, 0.05, Math.PI - 0.05); g.stroke();
    g.beginPath(); g.moveTo(14, h - 14); g.lineTo(w - 14, h - 14); g.stroke();
    g.beginPath(); g.arc(w / 2, h - 14, w * 0.17, Math.PI, TAU); g.stroke();
    drawEmblem(g, w / 2 - 70, h * 0.62, 140, 10);
  }, { repeat: false });
  TEX.leaf = canvasTex(256, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2f6b2c'; g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 0); g.stroke();
    for (let y = h - 20; y > 10; y -= 14) {
      const t = 1 - y / h, len = Math.sin(Math.min(1, t * 1.15) * Math.PI) * (w * 0.48) + 6;
      for (const s of [-1, 1]) {
        const gr = g.createLinearGradient(w / 2, y, w / 2 + s * len, y - 40);
        gr.addColorStop(0, '#3c8a33'); gr.addColorStop(1, '#78c043');
        g.strokeStyle = gr; g.lineWidth = 9; g.lineCap = 'round';
        g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + s * len * 0.5, y - 10, w / 2 + s * len, y - 46); g.stroke();
      }
    }
  }, { repeat: false });
  TEX.soft = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: false });
  TEX.stream = canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = 'rgba(200,240,255,0.25)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${rand(0.2, 0.75)})`; g.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(30, 160)); }
  });
  TEX.net = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(40,52,68,.75)'; g.lineWidth = 2;
    for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  });
  TEX.grass = canvasTex(512, 512, (g, w, h) => { noiseFill(g, w, h, '#4f8a3a', 0.12, 14000, 2); });
  TEX.grass.repeat.set(0.3, 0.3);
  TEX.pavers = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#9a8f85'; g.fillRect(0, 0, w, h);
    const s = 64;
    for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? -s / 2 : 0; x < w; x += s) {
      g.fillStyle = `hsl(${rand(24, 34)},${rand(10, 18)}%,${rand(62, 74)}%)`; g.fillRect(x + 2, y + 2, s - 4, s - 4);
    }
  });
  TEX.pavers.repeat.set(0.35, 0.35);
  TEX.aloha = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = rand(0, w), y = rand(0, h), r = rand(12, 22);
      g.fillStyle = 'rgba(255,255,255,1)';
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; g.fillStyle = '#f6e7c8'; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, r * 0.3, a, 0, TAU); g.fill(); }
      g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(x, y, r * 0.25, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,90,60,.55)'; g.beginPath(); g.ellipse(x + r, y + r * 0.6, r * 0.7, r * 0.25, 0.6, 0, TAU); g.fill();
    }
  });
  TEX.stripes = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a3446'; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 13); });
  TEX.moon = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createRadialGradient(118, 118, 10, 128, 128, 118); gr.addColorStop(0, '#fffdf3'); gr.addColorStop(1, '#d9dce6');
    g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 110, 0, TAU); g.fill();
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(120,128,150,${rand(0.08, 0.22)})`; g.beginPath(); g.arc(rand(50, 206), rand(50, 206), rand(4, 22), 0, TAU); g.fill(); }
  }, { repeat: false });
  // hull name decal
  TEX.decal = canvasTex(2048, 512, (g, w, h) => {
    g.fillStyle = '#f3f6f9'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#10264a';
    g.font = `900 250px ${getComputedStyle(document.documentElement).getPropertyValue('--f-display')}`;
    g.textBaseline = 'middle';
    drawEmblem(g, 120, 120, 240, 16);
    g.fillText('TILEO', 420, 258);
    g.font = `500 54px ${getComputedStyle(document.documentElement).getPropertyValue('--f-mono')}`;
    g.fillStyle = '#ff6a55'; g.fillText('CRUISE LINES', 1520, 205);
    g.fillStyle = '#10264a'; g.fillText('INFINITY', 1520, 290);
    g.strokeStyle = '#2fd3c6'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); for (let x = 140; x < 1960; x += 10) { const y = 440 + Math.sin(x / 120) * 14; x === 140 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
  }, { repeat: false, aniso: 16 });
  TEX.funnel = canvasTex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    drawEmblem(g, 212, 120, 600, 40);
    g.fillStyle = '#f3f6f9'; g.font = `900 150px ${getComputedStyle(document.documentElement).getPropertyValue('--f-display')}`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TILEO', 512, 860);
  }, { repeat: false, aniso: 16 });
  TEX.helipad = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 26; g.beginPath(); g.arc(256, 256, 220, 0, TAU); g.stroke();
    g.strokeStyle = '#f3f6f9'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 185, 0, TAU); g.stroke();
    g.fillStyle = '#f3f6f9'; g.fillRect(170, 140, 42, 232); g.fillRect(300, 140, 42, 232); g.fillRect(170, 236, 172, 40);
  }, { repeat: false });
  // shop sign atlas: 4 rows
  TEX.signs = canvasTex(1024, 1024, (g, w, h) => {
    const rows = [['INFINITY CAFÉ', '#ffc95c', '#0b1b33'], ['GELATO NOWHERE', '#ff8fab', '#0b1b33'], ['OCEAN PIZZERIA', '#ff6a55', '#fff'], ['TILE & TIDE', '#2fd3c6', '#0b1b33'],
      ['SEASIDE GRILL', '#10264a', '#ffc95c'], ['SWEET TILES', '#f6e7c8', '#ff6a55'], ['JUICE LAGOON', '#7bd389', '#0b1b33'], ['TACO WAVE', '#ff8a3d', '#fff']];
    rows.forEach(([t, bg, fg], i) => {
      g.fillStyle = bg; g.fillRect(0, i * 128, w, 128);
      g.fillStyle = fg; g.font = `700 64px ${getComputedStyle(document.documentElement).getPropertyValue('--f-display')}`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, i * 128 + 68);
    });
  }, { repeat: false });
  TEX.banner = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#0b1b33'; g.fillRect(0, 0, w, h);
    drawEmblem(g, 40, 48, 160, 12);
    g.fillStyle = '#f3f6f9'; g.font = `900 110px ${getComputedStyle(document.documentElement).getPropertyValue('--f-display')}`;
    g.textBaseline = 'middle'; g.fillText('TILEO', 240, 134);
    g.fillStyle = '#ff6a55'; g.font = `500 40px ${getComputedStyle(document.documentElement).getPropertyValue('--f-mono')}`; g.fillText('DJ · LIVE', 700, 134);
  }, { repeat: false });
  TEX.flag = canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#10264a'; g.fillRect(0, 0, w, h); drawEmblem(g, 88, 40, 80, 8); }, { repeat: false });
  TEX.ball = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#e8702a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2b1a10'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (const x of [w / 4, w * 3 / 4]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
}

/* ---------------- materials ---------------- */
const MAT = {};
function std(o) { return new T.MeshStandardMaterial(o); }
function buildMaterials() {
  MAT.white = std({ color: 0xe8edf1, roughness: 0.48, metalness: 0.05 });
  MAT.whiteSoft = std({ color: 0xe9eef3, roughness: 0.6, metalness: 0.0 });
  MAT.hull = std({ map: TEX.hull, color: 0xffffff, roughness: 0.32, metalness: 0.06, emissiveMap: TEX.hullEmis, emissive: 0xffffff, emissiveIntensity: 0 });
  MAT.decal = std({ map: TEX.decal, roughness: 0.32, metalness: 0.06, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.navy = std({ color: 0x10264a, roughness: 0.4, metalness: 0.1 });
  MAT.coral = std({ color: 0xff6a55, roughness: 0.45 });
  MAT.lagoon = std({ color: 0x2fd3c6, roughness: 0.45 });
  MAT.gold = std({ color: 0xffc95c, roughness: 0.35, metalness: 0.3 });
  MAT.darkGlass = std({ color: 0x0d1a26, roughness: 0.06, metalness: 0.7 });
  MAT.ribbon = std({ map: TEX.ribbon, emissiveMap: TEX.ribbonEmis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.08, metalness: 0.55 });
  MAT.glass = std({ color: 0xbfe6f2, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
  MAT.domeGlass = std({ color: 0xcdeef7, roughness: 0.03, metalness: 0.35, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide, envMapIntensity: 1.6 });
  MAT.steel = std({ color: 0xc8d1da, roughness: 0.25, metalness: 0.85 });
  MAT.chrome = std({ color: 0xffffff, roughness: 0.05, metalness: 1.0 });
  MAT.darkMetal = std({ color: 0x2a3340, roughness: 0.5, metalness: 0.6 });
  MAT.teak = std({ map: TEX.teak, roughness: 0.72, metalness: 0 });
  MAT.terrazzo = std({ map: TEX.terrazzo, roughness: 0.22, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.nonskid = std({ map: TEX.nonskid, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.bowDeck = std({ map: TEX.nonskid, color: 0x9fb3c2, roughness: 0.85 });
  MAT.splash = std({ map: TEX.splash, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.mosaic = std({ map: TEX.mosaic, roughness: 0.25 });
  MAT.mosaicDark = std({ map: TEX.mosaicDark, roughness: 0.25 });
  MAT.court = std({ map: TEX.court, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  MAT.helipad = std({ map: TEX.helipad, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false });
  MAT.grass = std({ map: TEX.grass, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.pavers = std({ map: TEX.pavers, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  MAT.fabric = std({ color: 0xf7f4ee, roughness: 0.9, side: T.DoubleSide });
  MAT.fabricCoral = std({ color: 0xff7b66, roughness: 0.9, side: T.DoubleSide });
  MAT.cushion = std({ color: 0xffffff, roughness: 0.85 });
  MAT.frame = std({ color: 0xf2f5f8, roughness: 0.3, metalness: 0.4 });
  MAT.leaf = std({ map: TEX.leaf, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.75 });
  MAT.trunk = std({ color: 0x8a6a4a, roughness: 0.95, vertexColors: true });
  MAT.foliage = std({ color: 0xffffff, roughness: 0.85, vertexColors: true });
  MAT.soil = std({ color: 0x4a3626, roughness: 1 });
  MAT.planter = std({ color: 0xeef2f5, roughness: 0.55 });
  MAT.rubber = std({ color: 0x1f2630, roughness: 0.9 });
  MAT.orange = std({ color: 0xff7a1a, roughness: 0.45 });
  MAT.net = std({ map: TEX.net, transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.8 });
  MAT.slideCoral = std({ color: 0xff6a55, roughness: 0.28, metalness: 0.05, side: T.DoubleSide });
  MAT.slideLime = std({ color: 0xc8f04a, roughness: 0.28, metalness: 0.05, side: T.DoubleSide });
  MAT.slideTube = std({ color: 0x29c3e6, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.62, side: T.DoubleSide, depthWrite: false });
  MAT.slideFilm = new T.MeshBasicMaterial({ map: TEX.stream, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide });
  MAT.signs = std({ map: TEX.signs, emissiveMap: TEX.signs, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.5 });
  MAT.banner = std({ map: TEX.banner, emissiveMap: TEX.banner, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5 });
  MAT.funnelLogo = std({ map: TEX.funnel, transparent: true, roughness: 0.4, emissiveMap: TEX.funnel, emissive: 0xffffff, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  MAT.shopGlass = std({ color: 0x1b2a3a, roughness: 0.08, metalness: 0.5, emissive: 0xffd6a0, emissiveIntensity: 0.25 });
  MAT.lamp = new T.MeshBasicMaterial({ color: 0xfff1d6 });
  MAT.litDoor = new T.MeshBasicMaterial({ color: 0xffc58a, transparent: true, opacity: 0, depthWrite: false });
  MAT.flag = std({ map: TEX.flag, side: T.DoubleSide, roughness: 0.8 });
  MAT.ball = std({ map: TEX.ball, roughness: 0.6 });
  MAT.rope = std({ color: 0x3a3f46, roughness: 0.5, metalness: 0.7 });
  MAT.bottle = std({ vertexColors: true, roughness: 0.15, metalness: 0.2 });
  MAT.speaker = std({ color: 0x14181f, roughness: 0.7, metalness: 0.2 });
  MAT.redBrick = std({ color: 0xc8553d, roughness: 0.6 });
  for (const k of ['teak', 'terrazzo', 'nonskid', 'splash', 'grass', 'pavers']) MAT[k].envMapIntensity = 0.6;
  for (const k of ['slideCoral', 'slideLime', 'coral', 'lagoon', 'orange', 'fabricCoral', 'gold']) MAT[k].envMapIntensity = 0.55;
  for (const k in MAT) { const m = MAT[k]; if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); }
}

/* ---------------- geometry helpers ---------------- */
function nonIndexed(geo) { return geo.index ? geo.toNonIndexed() : geo; }
function mergeGeos(list) {
  const geos = list.map(nonIndexed);
  const hasColor = geos.some(g => g.attributes.color);
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = hasColor ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of geos) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
    if (col) { if (g.attributes.color) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3); else col.fill(1, o * 3, (o + c) * 3); }
    o += c;
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  out.setAttribute('uv', new T.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new T.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
function lin(c) { return new T.Color(c).convertSRGBToLinear(); }
function tint(geo, hex) {
  const c = lin(hex); const n = geo.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new T.BufferAttribute(a, 3)); return geo;
}
class Bin {
  constructor() { this.map = new Map(); }
  add(key, geo, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    const g = geo.clone();
    _m1.compose(_v1.set(x, y, z), _q1.setFromEuler(_e1.set(rx, ry, rz, 'YXZ')), _v2.set(sx, sy, sz));
    g.applyMatrix4(_m1);
    this.push(key, g);
    return g;
  }
  addM(key, geo, matrix) { const g = geo.clone(); g.applyMatrix4(matrix); this.push(key, g); }
  push(key, g) { if (!this.map.has(key)) this.map.set(key, []); this.map.get(key).push(g); }
  build(parent, flags = {}) {
    const out = {};
    for (const [key, list] of this.map) {
      const mesh = new T.Mesh(mergeGeos(list), MAT[key]);
      const f = flags[key] || {};
      mesh.castShadow = f.cast !== undefined ? f.cast : !MAT[key].transparent;
      mesh.receiveShadow = f.receive !== undefined ? f.receive : true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (f.order !== undefined) mesh.renderOrder = f.order;
      parent.add(mesh); out[key] = mesh;
      list.forEach(g => g.dispose());
    }
    this.map.clear();
    return out;
  }
}
const GEO = {};
function box(w, h, d) { return new T.BoxGeometry(w, h, d); }
function cyl(rt, rb, h, seg = 16, open = false) { return new T.CylinderGeometry(rt, rb, h, seg, 1, open); }
function beamGeo(a, b, r, seg = 8) {
  const len = a.distanceTo(b); const g = new T.CylinderGeometry(r, r, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  const dir = new T.Vector3().subVectors(b, a).normalize();
  g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir)));
  g.translate(a.x, a.y, a.z);
  return g;
}
// Shape from [x,z] points (world). Shape space: (x, -z)
function shapeFrom(pts, holes = []) {
  const s = new T.Shape(pts.map(p => new T.Vector2(p[0], -p[1])));
  for (const h of holes) s.holes.push(new T.Path(h.map(p => new T.Vector2(p[0], -p[1]))));
  return s;
}
// flat floor geometry at y (faces up, uv in meters)
function floorGeo(pts, holes, y) {
  const g = new T.ShapeGeometry(shapeFrom(pts, holes), 24);
  g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  return g;
}
function extrudeY(pts, holes, y0, y1, curveSeg = 32) {
  const g = new T.ExtrudeGeometry(shapeFrom(pts, holes), { depth: y1 - y0, bevelEnabled: false, curveSegments: curveSeg });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}
function rectPts(x0, z0, x1, z1) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }
function roundRectPts(cx, cz, hw, hd, r, n = 6) {
  const pts = [];
  const corners = [[cx + hw - r, cz - hd + r, -Math.PI / 2], [cx + hw - r, cz + hd - r, 0], [cx - hw + r, cz + hd - r, Math.PI / 2], [cx - hw + r, cz - hd + r, Math.PI]];
  for (const [x, z, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
  return pts;
}
function ellipsePts(cx, cz, rx, rz, n = 48) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); } return pts; }
function offsetPoly(pts, d) {
  // offset closed polygon outward by d (CCW/CW agnostic via signed area)
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return [p[0] + tz * d * s, p[1] - tx * d * s];
  });
}
// vertical ribbon along polyline (open or closed), facing outward from polygon if normalSign
function ribbonGeo(pts, y0, y1, closed, uScale = 1, flip = false) {
  const n = pts.length, P = [], N = [], U = [], I = [];
  let acc = 0;
  const cnt = closed ? n + 1 : n;
  for (let i = 0; i < cnt; i++) {
    const p = pts[i % n];
    if (i > 0) { const q = pts[(i - 1) % n]; acc += Math.hypot(p[0] - q[0], p[1] - q[1]); }
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    let nx = tz, nz = -tx; if (flip) { nx = -nx; nz = -nz; }
    P.push(p[0], y0, p[1], p[0], y1, p[1]); N.push(nx, 0, nz, nx, 0, nz); U.push(acc * uScale, 0, acc * uScale, 1);
  }
  for (let i = 0; i < cnt - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (flip) I.push(a, c, b, b, c, d); else I.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I);
  return g;
}
// sweep a 2D profile (array of [s,t] in local side/up plane) along a curve with up-stable frames
function sweepGeo(curve, profile, segs, closedProfile = false) {
  const P = [], N = [], U = [], I = [];
  const frames = upFrames(curve, segs);
  const m = profile.length;
  const L = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const { p, side, up } = frames[i];
    for (let j = 0; j < m; j++) {
      const [s, t] = profile[j];
      P.push(p.x + side.x * s + up.x * t, p.y + side.y * s + up.y * t, p.z + side.z * s + up.z * t);
      const len = Math.hypot(s, t) || 1;
      N.push((side.x * s + up.x * t) / len, (side.y * s + up.y * t) / len, (side.z * s + up.z * t) / len);
      U.push(j / (m - 1), i / segs * L / 4);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < m - 1; j++) {
    const a = i * m + j, b = a + 1, c = a + m, d = c + 1; I.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I);
  return g;
}
function upFrames(curve, segs) {
  const out = []; let prevSide = new T.Vector3(1, 0, 0);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; const p = curve.getPointAt(t); const tan = curve.getTangentAt(t).normalize();
    let side = new T.Vector3().crossVectors(tan, _v1.set(0, 1, 0));
    if (side.lengthSq() < 1e-4) side.copy(prevSide); side.normalize();
    if (side.dot(prevSide) < 0 && i > 0 && Math.abs(tan.y) > 0.9) side.negate();
    prevSide.copy(side);
    const up = new T.Vector3().crossVectors(side, tan).normalize();
    out.push({ p, tan, side, up });
  }
  return out;
}
function arcProfile(r, a0, a1, n) { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }

/* ---- 10_env.js ---- */
/* ================= environment: sky, sun/moon, stars, ocean, lighting ================= */
const Env = {
  sunDir: new T.Vector3(0, 1, 0), moonDir: new T.Vector3(0, -1, 0), lightDir: new T.Vector3(0, 1, 0),
  horizon: new T.Color(), zenith: new T.Color(), sunColor: new T.Color(), sinEl: 1, night: 0, golden: 0,
  lastEnvEl: 99, lastEnvT: -99, travel: 0,
};
const SKY_KEYS = [
  [-0.35, '#081428', '#030812'], [-0.1, '#2a2f5c', '#0a1430'], [0.0, '#f08a5d', '#30508a'],
  [0.1, '#ffc08e', '#4a84c4'], [0.3, '#d2e6f4', '#3d84d0'], [1, '#d8ebf7', '#3478c8']
];
const SUN_KEYS = [[-0.05, '#ff6a3a'], [0.03, '#ff8a4c'], [0.14, '#ffc890'], [0.4, '#fff3e2'], [1, '#fffaf0']];
function keyColor(keys, x, idx, out) {
  if (x <= keys[0][0]) return out.set(keys[0][idx]).convertSRGBToLinear();
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const t = (x - a[0]) / (b[0] - a[0]); return out.set(a[idx]).lerp(_c1.set(b[idx]), t).convertSRGBToLinear(); }
  return out.set(keys[keys.length - 1][idx]).convertSRGBToLinear();
}
const _c1 = new T.Color(), _c2 = new T.Color();

function sunDirection(min, out) {
  const H = (min / 60 - 13) / 24 * TAU;
  const s = clamp(0.107 + 0.82 * Math.cos(H), -1, 1), el = Math.asin(s), c = Math.cos(el);
  return out.set(-Math.cos(H) * c, s, -Math.sin(H) * c).normalize();
}
function moonDirection(min, out) {
  const H = (min / 60 - 1) / 24 * TAU;
  const s = clamp(0.12 + 0.7 * Math.cos(H), -1, 1), el = Math.asin(s), c = Math.cos(el);
  return out.set(Math.cos(H) * c * 0.8 + 0.3, s, Math.sin(H) * c).normalize();
}

function initEnvironment() {
  const scene = G.scene;
  // sky
  const sky = new T.Sky(); sky.scale.setScalar(9000); sky.frustumCulled = false; scene.add(sky); Env.sky = sky;
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;
  // night tint dome (additive)
  const tintMat = new T.ShaderMaterial({
    uniforms: { uNight: { value: 0 }, uHor: { value: lin('#122a55') }, uZen: { value: lin('#040a1e') } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uNight; uniform vec3 uHor; uniform vec3 uZen; varying vec3 vDir;
      void main(){ float h=max(vDir.y,0.0); vec3 c=mix(uHor,uZen,pow(h,0.45)); gl_FragColor=vec4(c*uNight,1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      }`,
    side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false
  });
  const tint = new T.Mesh(new T.SphereGeometry(4300, 32, 16), tintMat); tint.frustumCulled = false; tint.renderOrder = -9; scene.add(tint); Env.tint = tint;
  const hzMat = new T.ShaderMaterial({
    uniforms: { uHor: { value: Env.horizon } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uHor; varying vec3 vDir;
      void main(){ float a=1.0-smoothstep(-0.004,0.07,vDir.y); gl_FragColor=vec4(uHor,a);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      }`,
    side: T.BackSide, transparent: true, depthWrite: false, fog: false
  });
  const hz = new T.Mesh(new T.SphereGeometry(4200, 48, 24), hzMat); hz.frustumCulled = false; hz.renderOrder = -6; scene.add(hz); Env.hz = hz;
  // stars + milky way
  const N = 3600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), tw = new Float32Array(N);
  const band = new T.Vector3(0.3, 0.2, 1).normalize();
  for (let i = 0; i < N; i++) {
    let v;
    if (i < 2200) { do { v = new T.Vector3(rand(-1, 1), rand(-0.05, 1), rand(-1, 1)); } while (v.lengthSq() > 1 || v.lengthSq() < 0.05); }
    else { const a = rand(0, TAU); const perp = new T.Vector3(1, 0, -0.3).normalize(); const b2 = new T.Vector3().crossVectors(band, perp);
      v = perp.clone().multiplyScalar(Math.cos(a)).add(b2.multiplyScalar(Math.sin(a))).add(band.clone().multiplyScalar(rand(-0.12, 0.12) * rand(0, 1))); if (v.y < -0.05) v.y = -v.y; }
    v.normalize().multiplyScalar(4000);
    pos.set([v.x, v.y, v.z], i * 3);
    const t = rng(); const c = t < 0.15 ? [1, 0.85, 0.7] : t < 0.35 ? [0.75, 0.85, 1] : [1, 1, 1];
    const b = i < 2200 ? rand(0.5, 1) : rand(0.25, 0.55);
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    size[i] = i < 2200 ? (rng() < 0.06 ? rand(2.6, 3.6) : rand(1.1, 2.2)) : rand(0.9, 1.6);
    tw[i] = rng();
  }
  const sg = new T.BufferGeometry();
  sg.setAttribute('position', new T.BufferAttribute(pos, 3)); sg.setAttribute('color', new T.BufferAttribute(col, 3));
  sg.setAttribute('size', new T.BufferAttribute(size, 1)); sg.setAttribute('tw', new T.BufferAttribute(tw, 1));
  const starMat = new T.ShaderMaterial({
    uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: `attribute float size; attribute float tw; attribute vec3 color; varying vec3 vC; varying float vT; uniform float uTime; uniform float uPR;
      void main(){ vC=color; vT=0.65+0.35*sin(uTime*(0.8+tw*2.5)+tw*60.0); gl_PointSize=size*uPR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uNight; varying vec3 vC; varying float vT;
      void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(vC*vT*1.8*uNight*a,1.0); }`,
    blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false
  });
  const stars = new T.Points(sg, starMat); stars.frustumCulled = false; stars.renderOrder = -8; scene.add(stars); Env.stars = stars;
  // moon
  const moon = new T.Sprite(new T.SpriteMaterial({ map: TEX.moon, color: 0xffffff, transparent: true, depthWrite: false, fog: false }));
  moon.scale.setScalar(130); moon.renderOrder = -7; scene.add(moon); Env.moon = moon;
  const glow = new T.Sprite(new T.SpriteMaterial({ map: TEX.soft, color: 0x9db8ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.3, fog: false }));
  glow.scale.setScalar(700); glow.renderOrder = -7; scene.add(glow); Env.moonGlow = glow;

  // lights
  const sun = new T.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 520;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.045; sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun); scene.add(sun.target); G.sun = sun;
  const hemi = new T.HemisphereLight(0xcfe6ff, 0x1d3247, 0.8); scene.add(hemi); G.hemi = hemi;
  G.points = [];
  for (let i = 0; i < 4; i++) { const p = new T.PointLight(0xffffff, 0, 34, 2); scene.add(p); G.points.push(p); }
  scene.fog = new T.FogExp2(0xcfe3f2, 0.00018);

  // env map scene
  Env.pmrem = new T.PMREMGenerator(G.renderer);
  Env.envScene = new T.Scene();
  Env.envU = { uHor: { value: Env.horizon }, uZen: { value: Env.zenith }, uSun: { value: Env.sunDir }, uSunC: { value: Env.sunColor }, uSunUp: { value: 1 }, uNight: { value: 0 }, uMoon: { value: Env.moonDir } };
  const envSky = new T.Mesh(new T.SphereGeometry(100, 48, 24), new T.ShaderMaterial({
    uniforms: Env.envU, side: T.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uHor; uniform vec3 uZen; uniform vec3 uSun; uniform vec3 uSunC; uniform float uSunUp; uniform float uNight; uniform vec3 uMoon; varying vec3 vDir;
      void main(){ vec3 d=normalize(vDir); float h=d.y;
        vec3 sky=mix(uHor,uZen,pow(max(h,0.0),0.5));
        vec3 sea=mix(uHor*0.35,vec3(0.004,0.02,0.04),smoothstep(0.0,-0.4,h));
        vec3 c=h>0.0?sky:sea;
        float s=max(dot(d,uSun),0.0); c+=uSunC*(pow(s,48.0)*5.0+pow(s,6.0)*0.35)*uSunUp*smoothstep(-0.1,0.05,h);
        float m=max(dot(d,uMoon),0.0); c+=vec3(0.5,0.6,0.85)*pow(m,64.0)*1.5*uNight;
        c+=vec3(0.02,0.012,0.006)*uNight*smoothstep(0.1,-0.3,h);
        gl_FragColor=vec4(min(c,vec3(12.0)),1.0);
        #include <encodings_fragment>
      }`
  }));
  Env.envScene.add(envSky);

  buildOcean();
}

/* ---------------- ocean ---------------- */
function buildOcean() {
  const q = G.quality, rings = q.rings, segs = q.segs, rMax = 7200;
  const P = [0, 0, 0], I = [];
  for (let i = 1; i <= rings; i++) {
    const r = rMax * Math.pow(i / rings, 2.5);
    for (let j = 0; j < segs; j++) { const a = j / segs * TAU; P.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  }
  for (let j = 0; j < segs; j++) I.push(0, 1 + (j + 1) % segs, 1 + j);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + (j + 1) % segs, c = a + segs, d = b + segs;
    I.push(a, b, c, b, d, c);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(I);
  const mat = new T.ShaderMaterial({
    defines: { OCTAVES: q.octaves },
    uniforms: {
      uTime: { value: 0 }, uTravel: { value: 0 }, uSunDir: { value: Env.sunDir }, uMoonDir: { value: Env.moonDir }, uSunColor: { value: new T.Color() },
      uHorizon: { value: new T.Color() }, uZenith: { value: new T.Color() }, uNight: { value: 0 }, uFog: { value: 0.00034 },
      uDeep: { value: lin('#06304f') }, uShallow: { value: lin('#1b9fb8') }, uSunI: { value: 1 },
      uWake: { value: 1 }, uIsle: { value: new T.Vector4(0, 0, 0, 0) }, uLagoon: { value: lin('#2fc9c2') }
    },
    vertexShader: `
      uniform float uTime; uniform float uTravel; uniform vec4 uIsle; varying vec3 vWorld; varying vec3 vN; varying float vH;
      vec3 gerstner(vec2 xz, vec4 w, inout vec3 tg, inout vec3 bn){
        float k=6.28318/w.w; float c=sqrt(9.8/k); vec2 d=normalize(w.xy); float f=k*(dot(d,xz)-c*uTime); float a=w.z/k;
        float s=sin(f), co=cos(f);
        tg+=vec3(-d.x*d.x*(w.z*s), d.x*(w.z*co), -d.x*d.y*(w.z*s));
        bn+=vec3(-d.x*d.y*(w.z*s), d.y*(w.z*co), -d.y*d.y*(w.z*s));
        return vec3(d.x*(a*co), a*s, d.y*(a*co));
      }
      void main(){
        vec3 p=(modelMatrix*vec4(position,1.0)).xyz; vec2 xz=p.xz+vec2(0.0,-uTravel);
        vec3 tg=vec3(1.0,0.0,0.0), bn=vec3(0.0,0.0,1.0), d=vec3(0.0);
        d+=gerstner(xz,vec4(1.0,0.35,0.11,140.0),tg,bn);
        d+=gerstner(xz,vec4(0.7,-0.6,0.09,72.0),tg,bn);
        d+=gerstner(xz,vec4(-0.3,1.0,0.07,41.0),tg,bn);
        d+=gerstner(xz,vec4(0.9,0.9,0.05,23.0),tg,bn);
        float dist=length(p.xz-cameraPosition.xz);
        float att=1.0-smoothstep(1400.0,5200.0,dist);
        // calmer right against the hull
        float hz=abs(p.x)-24.0; att*=mix(0.35,1.0,smoothstep(0.0,30.0,hz));
        if(uIsle.w>0.0){ float di=length(p.xz-uIsle.xy); att*=mix(0.12,1.0,smoothstep(uIsle.z*0.85,uIsle.z*1.6,di)); }
        p+=d*att; vH=d.y*att;
        vN=normalize(mix(vec3(0.0,1.0,0.0),cross(bn,tg),att));
        vWorld=p;
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `
      uniform float uWake; uniform vec4 uIsle; uniform vec3 uLagoon;
      uniform float uTime; uniform float uTravel; uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uSunColor; uniform vec3 uHorizon; uniform vec3 uZenith;
      uniform float uNight; uniform float uFog; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uSunI;
      varying vec3 vWorld; varying vec3 vN; varying float vH;
      float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(hash12(i),hash12(i+vec2(1.0,0.0)),u.x),mix(hash12(i+vec2(0.0,1.0)),hash12(i+vec2(1.0,1.0)),u.x),u.y); }
      float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<OCTAVES;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return s; }
      float hullH(float z){ float zz=z-6.0; if(zz<-182.0||z>172.0) return -1.0; if(zz<-125.0){ float t=(zz+182.0)/57.0; return 24.0*(1.0-pow(1.0-t,2.3)); } if(zz>164.0){ float t=(zz-164.0)/8.0; return 24.0-1.5*t*t; } return 24.0; }
      void main(){
        vec3 V=normalize(cameraPosition-vWorld); float dist=length(cameraPosition-vWorld);
        vec2 q=vWorld.xz+vec2(0.0,-uTravel);
        float k=1.0-smoothstep(150.0,1400.0,dist);
        vec3 N=vN;
        if(k>0.0){
          float e=0.3; vec2 m=q*0.16+uTime*vec2(0.03,0.06);
          float h0=fbm(m), hx=fbm(m+vec2(e*0.16,0.0)), hz=fbm(m+vec2(0.0,e*0.16));
          vec2 m2=q*0.55-uTime*vec2(0.05,0.02);
          float g0=vnoise(m2), gx=vnoise(m2+vec2(0.08,0.0)), gz=vnoise(m2+vec2(0.0,0.08));
          vec3 nd=vec3(-(hx-h0)/e*2.2-(gx-g0)*1.6,1.0,-(hz-h0)/e*2.2-(gz-g0)*1.6);
          N=normalize(N+(normalize(nd)-vec3(0.0,1.0,0.0))*k*0.9);
        }
        float ndv=max(dot(N,V),0.0);
        float F=0.02+0.98*pow(1.0-ndv,5.0);
        vec3 R=reflect(-V,N); R.y=abs(R.y);
        vec3 skyc=mix(uHorizon,uZenith,pow(R.y,0.5));
        float sunUp=smoothstep(-0.05,0.1,uSunDir.y);
        float spec=pow(max(dot(R,uSunDir),0.0),700.0)*60.0+pow(max(dot(R,uSunDir),0.0),80.0)*1.2;
        float mspec=pow(max(dot(R,uMoonDir),0.0),500.0)*3.0+pow(max(dot(R,uMoonDir),0.0),90.0)*0.05;
        vec3 body=uDeep*(0.25+0.75*sunUp)+uShallow*smoothstep(0.1,0.9,vH+0.3)*0.35*sunUp*max(dot(normalize(-uSunDir+V),N),0.0);
        body+=uDeep*0.15*uNight;
        if(uIsle.w>0.0){ float di=length(vWorld.xz-uIsle.xy); float sh=smoothstep(uIsle.z*1.45,uIsle.z*0.95,di); body=mix(body,uLagoon*(0.3+0.7*sunUp)+uLagoon*0.12*uNight,sh*0.85); }
        vec3 col=mix(body,skyc,F)+uSunColor*spec*sunUp*uSunI+vec3(0.75,0.82,1.0)*mspec*uNight;
        // wake + hull foam
        float ax=abs(vWorld.x), z=vWorld.z, H=hullH(z), mk=0.0;
        if(H>0.0){ float d=ax-H; float bow=1.0-smoothstep(-172.0,-110.0,z); float w=2.5+bow*8.0+smoothstep(-100.0,172.0,z)*4.5;
          mk=max(mk,(1.0-smoothstep(0.0,w*mix(0.35,1.0,uWake),d))*step(-0.5,d)*(0.45+bow*0.6)*mix(0.45,1.0,uWake)); }
        if(z>150.0){ float s=z-166.0; float w=15.0+max(s,0.0)*0.1; mk=max(mk,(1.0-smoothstep(w*0.45,w,ax))*exp(-max(s,0.0)/420.0)*smoothstep(150.0,172.0,z)*uWake); }
        if(z>160.0){ float s=z-160.0; float arm=s*0.3536+22.0; float dk=abs(ax-arm); float w=2.5+s*0.018; mk=max(mk,(1.0-smoothstep(0.0,w,dk))*exp(-s/1100.0)*0.8*uWake); }
        float fn=fbm(q*0.22+vec2(0.0,uTime*0.08))*0.65+vnoise(q*1.3)*0.35;
        float foam=mk*smoothstep(0.62-mk*0.45,0.78-mk*0.3,fn);
        foam+=smoothstep(0.55,0.95,vH)*smoothstep(0.55,0.8,fn)*0.35*k;
        vec3 foamC=mix(vec3(0.86,0.92,0.96)*(0.35+0.75*sunUp)+uSunColor*0.08,vec3(0.08,0.11,0.17),uNight*0.85);
        col=mix(col,foamC,clamp(foam,0.0,1.0));
        // ship light spill at night
        if(H>-2.0||z<190.0){ float d=max(ax-max(H,0.0),0.0); float spill=exp(-d/7.0)*step(-150.0,z)*step(z,175.0)*uNight; col+=vec3(1.0,0.72,0.42)*spill*0.045*smoothstep(0.35,0.85,fn)*(0.5+0.5*sin(z*0.9)); }
        float fog=1.0-exp(-pow(dist*uFog,1.35));
        col=mix(col,uHorizon,clamp(fog,0.0,1.0));
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
    fog: false
  });
  const ocean = new T.Mesh(g, mat); ocean.frustumCulled = false; ocean.renderOrder = -5;
  G.scene.add(ocean); G.ocean = ocean;
}

function makePoolMat(o = {}) {
  return new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uNight: { value: 0 }, uSunDir: { value: Env.sunDir }, uSunColor: { value: Env.sunColor }, uSky: { value: Env.horizon },
      uDeep: { value: lin(o.deep || '#0e6f9a') }, uShallow: { value: lin(o.shallow || '#3fd6e6') }, uGlow: { value: o.glow !== undefined ? o.glow : 1.4 },
      uChop: { value: o.chop || 1 }, uAlpha: { value: o.alpha || 0.84 }
    },
    vertexShader: 'varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `
      uniform float uTime; uniform float uNight; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uGlow; uniform float uChop; uniform float uAlpha;
      varying vec3 vWorld;
      void main(){
        vec3 V=normalize(cameraPosition-vWorld); vec2 q=vWorld.xz*1.6; float t=uTime*uChop;
        vec2 g=vec2(cos(q.x*1.3+t*1.7)*0.5+cos((q.x+q.y)*0.9-t*1.3)*0.35+cos(q.x*2.7-q.y*1.1+t*2.1)*0.2,
                    sin(q.y*1.2-t*1.5)*0.5+cos((q.x-q.y)*1.1+t*1.1)*0.35+sin(q.y*2.9+q.x*0.7-t*2.3)*0.2);
        vec3 N=normalize(vec3(g.x*0.1*uChop,1.0,g.y*0.1*uChop));
        float F=0.03+0.97*pow(1.0-max(dot(N,V),0.0),5.0);
        float c=pow(abs(sin(q.x*2.1+sin(q.y*1.7+t))*sin(q.y*2.3+sin(q.x*1.9-t*1.2))),0.6);
        float day=1.0-uNight;
        vec3 body=mix(uDeep,uShallow,0.45+0.35*c)*(0.25+0.85*day*max(uSunDir.y+0.25,0.0));
        body+=uShallow*uGlow*uNight*(0.55+0.45*c);
        vec3 R=reflect(-V,N);
        float spec=pow(max(dot(R,uSunDir),0.0),260.0)*4.0*day;
        vec3 col=mix(body,uSky*(0.45+0.3*day),F*0.7)+uSunColor*spec;
        gl_FragColor=vec4(col,mix(uAlpha,0.97,F));
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
    transparent: true, depthWrite: false, fog: false
  });
}

function updateEnvironment(dt, minutes, focus) {
  sunDirection(minutes, Env.sunDir); moonDirection(minutes, Env.moonDir);
  const s = Env.sunDir.y; Env.sinEl = s;
  const night = smooth(0.04, -0.16, s); Env.night = night; G.night = night;
  Env.golden = smooth(0.32, 0.06, s) * smooth(-0.1, 0.02, s);
  keyColor(SKY_KEYS, s, 1, Env.horizon); keyColor(SKY_KEYS, s, 2, Env.zenith); keyColor(SUN_KEYS, s, 1, Env.sunColor);
  const su = Env.sky.material.uniforms;
  su.sunPosition.value.copy(Env.sunDir).multiplyScalar(4000);
  su.turbidity.value = lerp(4.2, 9, Env.golden); su.rayleigh.value = lerp(1.1, 2.6, Env.golden) + night * 0.5;
  Env.tint.material.uniforms.uNight.value = night;
  Env.stars.material.uniforms.uNight.value = smooth(0.35, 0.95, night);
  Env.stars.material.uniforms.uTime.value = G.time;
  Env.stars.material.uniforms.uPR.value = G.renderer.getPixelRatio();
  const md = Env.moonDir;
  Env.moon.position.copy(md).multiplyScalar(3900); Env.moonGlow.position.copy(Env.moon.position);
  Env.moon.material.opacity = smooth(-0.02, 0.1, md.y) * (0.35 + 0.65 * night);
  Env.moonGlow.material.opacity = 0.28 * night * smooth(-0.02, 0.1, md.y);
  // light: sun by day, moon by night
  const sunI = smooth(-0.04, 0.12, s), moonI = night * smooth(0.0, 0.2, md.y);
  const useMoon = s < -0.03;
  Env.lightDir.copy(useMoon ? md : Env.sunDir);
  G.sun.color.copy(useMoon ? _c2.set('#9db8ff').convertSRGBToLinear() : Env.sunColor);
  G.sun.intensity = useMoon ? moonI * 0.4 : sunI * 2.9;
  G.hemi.color.copy(Env.zenith).lerp(_c1.set('#bcd9ff').convertSRGBToLinear(), 0.5 * (1 - night));
  G.hemi.groundColor.set('#13283f').lerp(_c1.set('#060c18'), night).convertSRGBToLinear();
  G.hemi.intensity = lerp(0.5, 0.22, night) + Env.golden * 0.08;
  G.exposure = lerp(0.62, 0.92, night) + Env.golden * 0.04;
  G.scene.fog.color.copy(Env.horizon);
  G.scene.fog.density = lerp(0.00016, 0.00028, night);
  // shadow frustum follows the focus point
  const ext = G.shadowExtent || 40;
  const sc = G.sun.shadow.camera;
  if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
  const step = ext * 2 / (G.quality ? G.quality.shadowSize : 2048);
  const fx = Math.round(focus.x / step) * step, fy = Math.round(focus.y / step) * step, fz = Math.round(focus.z / step) * step;
  G.sun.target.position.set(fx, fy, fz);
  G.sun.position.set(fx, fy, fz).addScaledVector(Env.lightDir, 260);
  G.sun.target.updateMatrixWorld();
  // ocean
  const ou = G.ocean.material.uniforms;
  ou.uTime.value = G.time; ou.uTravel.value = Env.travel; ou.uSunColor.value.copy(Env.sunColor);
  ou.uWake.value = G.shipSpeed === undefined ? 1 : G.shipSpeed;
  G.ocean.position.set(Math.round(G.camera.position.x / 8) * 8, 0, Math.round(G.camera.position.z / 8) * 8);
  ou.uHorizon.value.copy(Env.horizon); ou.uZenith.value.copy(Env.zenith); ou.uNight.value = night; ou.uSunI.value = sunI;
  // env map refresh
  if ((Math.abs(s - Env.lastEnvEl) > 0.025 && G.time - Env.lastEnvT > 1.5) || Env.lastEnvT < 0) refreshEnvMap();
  // shared emissive values
  if (MAT.hull) {
    MAT.hull.emissiveIntensity = night * 0.75;
    MAT.ribbon.emissiveIntensity = night * 0.9;
    MAT.litDoor.opacity = night * 0.8;
    MAT.funnelLogo.emissiveIntensity = night * 1.6;
    MAT.signs.emissiveIntensity = 0.2 + night * 0.9;
    MAT.banner.emissiveIntensity = 0.15 + night * 0.9;
    MAT.shopGlass.emissiveIntensity = 0.25 + night * 0.9;
    MAT.lamp.color.setScalar(lerp(0.75, 2.4, night)).multiply(_c1.set('#fff1d6').convertSRGBToLinear());
  }
}

function refreshEnvMap() {
  Env.lastEnvEl = Env.sunDir.y; Env.lastEnvT = G.time;
  Env.envU.uSunUp.value = smooth(-0.05, 0.1, Env.sunDir.y); Env.envU.uNight.value = Env.night;
  const rt = Env.pmrem.fromScene(Env.envScene, 0, 0.5, 1000);
  if (Env.envRT) Env.envRT.dispose();
  Env.envRT = rt;
  G.scene.environment = rt.texture;
}

/* ---- 20_ship.js ---- */
/* ================= ship: hull, superstructure, balconies, top deck ================= */
const DK = { top: 52, garden: 26, bow: 20, sun: 55.6, tower: 70 };
function deckHalf(z) {
  if (z < -152 || z > 152) return 0;
  if (z < -108) { const t = (-108 - z) / 44; return 31 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 1 / 2.4); }
  if (z > 146) { const t = Math.min(1, (z - 146) / 6); return 25 + 6 * Math.sqrt(Math.max(0, 1 - t * t)); }
  return 31;
}
function wallHalf(z) {
  if (z < -150 || z > 150) return 0;
  if (z < -108) { const t = (-108 - z) / 42; return 29 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 1 / 2.4); }
  if (z > 146) { const t = Math.min(1, (z - 146) / 4); return 25 + 4 * Math.sqrt(Math.max(0, 1 - t * t)); }
  return 29;
}
function hullHalf(z, y = 20) {
  const zz = z - (20 - y) * 0.3;
  if (zz < -182 || z > 172) return 0;
  if (zz < -125) { const t = (zz + 182) / 57; return 24 * (1 - Math.pow(1 - t, 2.3)); }
  if (zz > 164) { const t = (zz - 164) / 8; return 24 - 1.5 * t * t; }
  return 24;
}
function outlineZs(z0, z1) { const zs = []; for (let z = z0; z < z1 - 1e-6;) { zs.push(z); z += (z < -104 || z > 143) ? 1 : 4; } zs.push(z1); return zs; }
function outline(fn, z0, z1) {
  const zs = outlineZs(z0, z1);
  const pts = [];
  for (const z of zs) pts.push([fn(z), z]);
  for (let i = zs.length - 1; i >= 0; i--) pts.push([-fn(zs[i]), zs[i]]);
  return pts.filter((p, i, a) => { const q = a[(i + 1) % a.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01; });
}
// open path from starboard z=zA around the bow to port z=zA
function bowPath(fn, zA, z0, off = 0) {
  const pts = [];
  for (let z = zA; z >= z0; z -= 0.75) pts.push([fn(z) + off, z]);
  pts.push([0, z0 - off]);
  for (let z = z0; z <= zA + 1e-6; z += 0.75) pts.push([-(fn(z) + off), z]);
  return pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.05);
}
const CANYON = { x: 12, z0: -40, z1: 62 };
const CASINO = { x0: -16, x1: 16, z0: 68, z1: 98, y: 20, top: 25.6 };
const SUITE = { x0: 18.6, x1: 29, z0: 83.7, z1: 93.9, y: 38, top: 40.66, bays: [85.4, 88.8, 92.2] };
const CARVE = [{ k: [0, 1], x0: CASINO.x0, z0: CASINO.z0, x1: CASINO.x1, z1: CASINO.z1 }, { k: [6, 7], x0: SUITE.x0, z0: SUITE.z0, x1: SUITE.x1, z1: SUITE.z1 }];

function instanced(geo, mat, mats, o = {}) {
  const m = new T.InstancedMesh(geo, mat, Math.max(1, mats.length));
  mats.forEach((M, i) => m.setMatrixAt(i, M)); m.count = mats.length;
  m.castShadow = !!o.cast; m.receiveShadow = o.receive !== false; m.frustumCulled = false;
  if (o.colors) { mats.forEach((_, i) => m.setColorAt(i, o.colors[i].clone().convertSRGBToLinear())); m.instanceColor.needsUpdate = true; }
  return m;
}
function mtx(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ')), new T.Vector3(sx, sy, sz)); }

function buildShip() {
  const ship = new T.Group(); ship.name = 'ship'; G.scene.add(ship); G.ship = ship;
  buildHull(ship);
  buildSuperstructure(ship);
  buildTopDeck(ship);
  buildDome(ship);
  buildPoolDeck(ship);
  buildCanyon(ship);
  buildAft(ship);
  buildWaterpark(ship);
  buildBow(ship);
  buildVenues(ship);
  finishFurniture(ship);
  if (G.bucket) G.bucket.userData.water.material = G.poolMats[0];
  buildNeon(ship);
  buildHash();
  buildNavGrid('d15', -36, -152, 38, 152, 1.5);
  buildNavGrid('garden', -12, -40, 12, 62, 1.25, 0.45);
  buildNavGrid('bow', -25, -183, 25, -136, 1.25, 0.5);
  buildNavGrid('casino', CASINO.x0, CASINO.z0, CASINO.x1, CASINO.z1, 1.0, 0.4);
}

/* ---------------- hull ---------------- */
function buildHull(ship) {
  const zs = [];
  for (let z = -186; z < -120; z += 0.8) zs.push(z);
  for (let z = -120; z < 160; z += 4) zs.push(z);
  for (let z = 160; z <= 172.001; z += 0.8) zs.push(Math.min(z, 172));
  // half profile: from deck edge (y=20) down the side, bilge, flat bottom to keel
  const prof = []; // [y, kind, param]
  for (let i = 0; i <= 26; i++) prof.push(['side', 20 - 25 * i / 26]);
  for (let i = 1; i <= 8; i++) prof.push(['bilge', i / 8]);
  for (let i = 1; i <= 6; i++) prof.push(['bottom', i / 6]);
  const M = prof.length;
  const sectionPt = (z, p) => {
    const [kind, v] = p;
    if (kind === 'side') { const y = v; const B = hullHalf(z, y); return [B * (1 + Math.max(0, y - 6) * 0.0025), y]; }
    if (kind === 'bilge') { const a = v * Math.PI / 2; const B = hullHalf(z, -7); const r = Math.min(4, B); return [Math.max(0, B - r) + Math.cos(a) * r, -5 - Math.sin(a) * 4]; }
    const B = hullHalf(z, -9); const r = Math.min(4, B); return [Math.max(0, B - r) * (1 - v), -9];
  };
  const P = [], U = [], I = [];
  const cols = M * 2 - 1;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    const half = prof.map(p => sectionPt(z, p));
    const ring = [];
    for (let j = 0; j < M; j++) ring.push([half[j][0], half[j][1]]);
    for (let j = M - 2; j >= 0; j--) ring.push([-half[j][0], half[j][1]]);
    for (const [x, y] of ring) { P.push(x, y, z); U.push(z, (y + 9) / 29); }
  }
  for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    I.push(a, b, c, b, d, c);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.computeVertexNormals();
  // fix normals near the stern transom so the side stays crisp
  const hull = new T.Mesh(g, MAT.hull); hull.castShadow = true; hull.receiveShadow = true; ship.add(hull);
  // transom
  const last = zs.length - 1, tP = [0, 5, 172], tI = [];
  for (let j = 0; j < cols; j++) { tP.push(P[(last * cols + j) * 3], P[(last * cols + j) * 3 + 1], 172.02); }
  for (let j = 1; j < cols; j++) tI.push(0, j, j + 1);
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(tP, 3)); tg.setIndex(tI); tg.computeVertexNormals();
  const tuv = []; for (let k = 0; k < tP.length / 3; k++) tuv.push(tP[k * 3] * 0.1, (tP[k * 3 + 1] + 9) / 29); tg.setAttribute('uv', new T.Float32BufferAttribute(tuv, 2));
  const tr = new T.Mesh(tg, MAT.hull); tr.receiveShadow = true; ship.add(tr);
  // hull top cap (forecastle + aft mooring deck)
  const capPts = outline(z => hullHalf(z, 20), -182, 172);
  const cap = new T.Mesh(floorGeo(capPts, [], 20), MAT.bowDeck); cap.receiveShadow = true; ship.add(cap);
  // name decals
  for (const s of [1, -1]) {
    const d = new T.Mesh(new T.PlaneGeometry(46, 11.5), MAT.decal);
    d.position.set(s * 24.08, 13.4, -98); d.rotation.y = s * Math.PI / 2; d.receiveShadow = true; ship.add(d);
  }
  // lifeboats + davits
  const boatHull = new T.SphereGeometry(1, 28, 12, 0, TAU, Math.PI / 2, Math.PI / 2); boatHull.scale(1.9, 1.5, 5.4);
  const canopy = new T.SphereGeometry(1, 28, 12, 0, TAU, 0, Math.PI / 2); canopy.scale(1.75, 1.35, 5.0);
  const davit = box(0.35, 3.6, 0.35);
  const mh = [], mc = [], md = [];
  for (const s of [1, -1]) for (let z = -92; z <= 104; z += 9.8) {
    const x = s * 26.6;
    mh.push(mtx(x, 17.0, z)); mc.push(mtx(x, 17.0, z));
    md.push(mtx(s * 25.0, 18.0, z - 3.4, 0, 1, 1, 1, 0, s * 0.35)); md.push(mtx(s * 25.0, 18.0, z + 3.4, 0, 1, 1, 1, 0, s * 0.35));
  }
  ship.add(instanced(boatHull, MAT.white, mh, { cast: true }));
  ship.add(instanced(canopy, MAT.orange, mc, { cast: true }));
  ship.add(instanced(davit, MAT.darkMetal, md));
  // waterline anti-fouling band below the hull (dark) handled by texture; bow thruster circles
  const thr = new T.Mesh(new T.CircleGeometry(1.4, 24), MAT.darkMetal);
  for (const s of [1, -1]) { const t2 = thr.clone(); t2.position.set(s * (hullHalf(-160, 2) + 0.05), 2.2, -160); t2.rotation.y = s * Math.PI / 2; ship.add(t2); }
}

/* ---------------- superstructure ---------------- */
function buildSuperstructure(ship) {
  const B = new Bin();
  const wall = outline(wallHalf, -150, 150);
  const deck = outline(deckHalf, -152, 152);
  const canyonHole = rectPts(-CANYON.x, CANYON.z0, CANYON.x, CANYON.z1);
  B.push('white', extrudeY(wall, [], 20, 26, 40));
  B.push('white', extrudeY(wall, [canyonHole], 26, 49.9, 40));
  B.push('white', extrudeY(wall, [offsetPoly(wall, -0.6)], 49.9, 51.65, 40));
  B.push('white', extrudeY(rectPts(-12.6, -40.6, 12.6, 62.6), [canyonHole], 49.9, 51.65, 8));
  // deck slabs (balcony floors), with canyon gap above garden level
  for (let k = 0; k <= 10; k++) {
    const y = 20 + 3 * k;
    const holes = k >= 3 ? [rectPts(-10, -39.98, 10, 61.98)] : [];
    for (const c of CARVE) if (c.k.includes(k)) holes.push(rectPts(c.x0, c.z0, c.x1, c.z1));
    B.push('white', extrudeY(deck, holes, y - 0.32, y, 40));
  }
  B.push('white', extrudeY(deck, [offsetPoly(deck, -2.4), canyonHole], 51.6, 51.97, 40));
  // window ribbons around the bow face, per level
  for (let k = 0; k <= 9; k++) {
    const y = 20 + 3 * k;
    const path = bowPath(wallHalf, -105, -150, 0.04);
    const g = ribbonGeo(path, y + 0.35, y + 2.65, false, 1 / 6, true);
    B.push(k === 8 ? 'darkGlass' : 'ribbon', g);
    // vertical mullion fins
    if (k < 9) for (let i = 0; i < path.length; i += 6) { const p = path[i]; B.add('white', box(0.18, 3, 0.18), p[0], y + 1.5, p[1]); }
  }
  // canyon end walls glazing
  for (let k = 3; k <= 9; k++) {
    const y = 20 + 3 * k;
    B.push('ribbon', ribbonGeo([[-12, -39.96], [12, -39.96]], y + 0.35, y + 2.65, false, 1 / 6, true));
    B.push('ribbon', ribbonGeo([[12, 61.96], [-12, 61.96]], y + 0.35, y + 2.65, false, 1 / 6, true));
  }
  // bridge wings
  for (const s of [1, -1]) {
    B.add('white', box(6, 3.2, 8), s * 32, 45.6, -104);
    B.add('darkGlass', box(6.05, 1.6, 8.05), s * 32, 46.0, -104);
  }
  // radar masts on the bridge roof sides
  for (const s of [1, -1]) {
    const x = s * 22, z = -97;
    B.add('white', cyl(0.5, 0.7, 12, 16), x, 58, z);
    B.add('white', box(4, 0.3, 0.6), x, 63.2, z);
    B.add('white', new T.SphereGeometry(1.2, 24, 16), x, 65, z);
    B.add('darkMetal', box(5, 0.25, 0.25), x, 61.5, z, 0.6);
  }
  // aft terraces stepping down to the mooring deck
  for (const [y0, y1, zb] of [[20, 29, 165], [29, 38, 160], [38, 44, 155.5]]) {
    const zs = []; for (let z = 149; z <= zb; z += 1) zs.push(z);
    const poly = zs.map(z => [hullHalf(z) - 1.2, z]).concat(zs.slice().reverse().map(z => [-(hullHalf(z) - 1.2), z]));
    B.push('white', extrudeY(poly, [], y0, y1 - 0.02, 8));
    B.push('teak', floorGeo(poly, [], y1));
    const hw = hullHalf(zb) - 1.2;
    for (let yy = y0; yy < y1 - 1; yy += 3) B.push('ribbon', ribbonGeo([[-hw, zb + 0.03], [hw, zb + 0.03]], yy + 0.4, yy + 2.6, false, 1 / 6, true));
    addRail(B, [[-hw, zb - 0.2], [hw, zb - 0.2]], y1, { collide: false });
  }
  for (const s of [1, -1]) for (const z of [158, 166]) { B.add('darkMetal', cyl(0.6, 0.6, 1.2, 20), s * 17, 20.6, z, 0, 1, 1, 1, 0, Math.PI / 2); B.add('darkMetal', cyl(0.25, 0.28, 0.6, 12), s * 20.5, 20.3, z + 2); }
  B.build(ship, { ribbon: { cast: false }, darkGlass: { cast: false } });
  buildBalconies(ship);
}

function buildBalconies(ship) {
  const list = []; // matrices for balcony local frame
  const add = (x, y, z, ry) => list.push(mtx(x, y, z, ry));
  for (let k = 0; k <= 9; k++) {
    const y = 20 + 3 * k;
    for (let z = -105; z <= 143; z += 3.4) { if (!(y === SUITE.y && SUITE.bays.some(b => Math.abs(b - z) < 0.2))) add(30, y, z, Math.PI / 2); add(-30, y, z, -Math.PI / 2); }
    for (let x = -22.1; x <= 22.2; x += 3.4) add(x, y, 151, 0);
    if (k >= 3) for (let z = -38.2; z <= 60.3; z += 3.4) { add(11, y, z, -Math.PI / 2); add(-11, y, z, Math.PI / 2); }
  }
  const glass = box(3.3, 1.0, 0.03); glass.translate(0, 0.55, 0.96);
  const rail = box(3.34, 0.05, 0.08); rail.translate(0, 1.08, 0.96);
  const divider = box(0.1, 2.68, 2.0); divider.translate(-1.7, 1.34, 0);
  const door = box(3.1, 2.35, 0.05); door.translate(0, 1.2, -0.98);
  const lit = new T.PlaneGeometry(2.95, 2.2); lit.translate(0, 1.2, -0.95);
  ship.add(instanced(glass, MAT.glass, list));
  ship.add(instanced(rail, MAT.steel, list));
  ship.add(instanced(divider, MAT.white, list));
  ship.add(instanced(door, MAT.darkGlass, list));
  const litList = list.filter(() => rng() < 0.42);
  const litMesh = instanced(lit, MAT.litDoor, litList); litMesh.renderOrder = 2; ship.add(litMesh);
  if (G.quality.detail >= 2) {
    const fur = mergeGeos([
      (() => { const g = box(0.48, 0.06, 0.48); g.translate(-0.75, 0.45, 0.2); return g; })(),
      (() => { const g = box(0.48, 0.5, 0.05); g.translate(-0.75, 0.72, -0.05); return g; })(),
      (() => { const g = box(0.48, 0.06, 0.48); g.translate(0.75, 0.45, 0.2); return g; })(),
      (() => { const g = box(0.48, 0.5, 0.05); g.translate(0.75, 0.72, -0.05); return g; })(),
      (() => { const g = cyl(0.28, 0.28, 0.04, 16); g.translate(0, 0.55, 0.35); return g; })(),
      (() => { const g = cyl(0.03, 0.03, 0.55, 6); g.translate(0, 0.27, 0.35); return g; })(),
    ]);
    ship.add(instanced(fur, MAT.frame, list.filter((_, i) => i % 2 === 0)));
  }
}

/* ---------------- rails ---------------- */
function addRail(B, pts, y, o = {}) {
  const h = o.h || 1.1;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.05) continue;
    const ry = Math.atan2(-dz, dx);
    const n = Math.max(1, Math.ceil(len / 2.2));
    for (let p = 0; p < n; p++) {
      const t0 = p / n, t1 = (p + 1) / n, cx = a[0] + dx * (t0 + t1) / 2, cz = a[1] + dz * (t0 + t1) / 2;
      if (o.solid) B.add(o.solid, box(len / n + 0.02, h, 0.12), cx, y + h / 2, cz, ry);
      else B.add('glass', box(len / n - 0.07, h - 0.16, 0.03), cx, y + 0.06 + (h - 0.16) / 2, cz, ry);
      if (!o.solid) B.add('steel', cyl(0.028, 0.028, h, 6), a[0] + dx * t0, y + h / 2, a[1] + dz * t0);
    }
    if (!o.solid) B.push('steel', beamGeo(V3(a[0], y + h, a[1]), V3(b[0], y + h, b[1]), 0.045, 8));
    if (o.collide !== false) addWall(a[0], a[1], b[0], b[1], y - 0.2, y + h + 0.3, 0.1);
  }
  if (!o.solid && pts.length) { const l = pts[pts.length - 1]; B.add('steel', cyl(0.028, 0.028, h, 6), l[0], y + h / 2, l[1]); }
}
function splitRuns(pts, closed, gapFn) {
  const runs = []; let cur = [];
  const n = pts.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    if (gapFn((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) { if (cur.length > 1) runs.push(cur); cur = []; continue; }
    if (!cur.length) cur.push(a); cur.push(b);
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

/* ---------------- top deck base ---------------- */
const TOP = {};
function buildTopDeck(ship) {
  const B = new Bin();
  const deck = outline(deckHalf, -152, 152);
  TOP.deck = deck;
  TOP.mainPool = roundRectPts(0, -71, 9, 7, 2.2, 6);
  TOP.tubs = [ellipsePts(-14.5, -58, 2.3, 2.3, 28), ellipsePts(14.5, -58, 2.3, 2.3, 28)];
  TOP.domePool = ellipsePts(0, -131, 8.5, 6, 48);
  TOP.splash = roundRectPts(6, 136, 8, 4.5, 1.6, 5);
  const canyon = rectPts(-CANYON.x, CANYON.z0, CANYON.x, CANYON.z1);
  const holes = [canyon, TOP.mainPool, ...TOP.tubs, TOP.domePool, TOP.splash];
  B.push('teak', floorGeo(deck, holes, DK.top));
  addFloor(deck, DK.top, 'd15', { holes, name: 'deck15' });
  // perimeter rail with gaps for the overwater whirlpools
  const per = offsetPoly(deck, -0.28);
  const runs = splitRuns(per, true, (x, z) => Math.abs(x) > 27 && z > -74.6 && z < -69.4);
  for (const r of runs) addRail(B, r, DK.top);
  // canyon rail, gaps where the bridge lands
  const cr = [[12.15, -40.15], [12.15, 62.15], [-12.15, 62.15], [-12.15, -40.15]];
  const cruns = splitRuns(cr.flatMap((p, i) => { const q = cr[(i + 1) % 4]; const out = []; const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2); for (let k = 0; k < n; k++) out.push([lerp(p[0], q[0], k / n), lerp(p[1], q[1], k / n)]); return out; }), true, (x, z) => Math.abs(Math.abs(x) - 12.15) < 0.3 && z > 7.8 && z < 12.2);
  for (const r of cruns) addRail(B, r, DK.top);
  B.build(ship, { teak: { cast: false } });
}

/* ---------------- neon accent strips ---------------- */
function neonMat() {
  return new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uParty: { value: 0 } },
    vertexShader: 'attribute float aU; varying float vU; varying vec2 vUv; void main(){ vU=uv.x; vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uOn; uniform float uParty; varying float vU; varying vec2 vUv;
      vec3 pal(float t){ t=fract(t); vec3 a=vec3(0.18,0.83,0.78), b=vec3(1.0,0.42,0.33), c=vec3(0.35,0.66,1.0), d=vec3(1.0,0.79,0.36);
        float s=t*4.0; if(s<1.0) return mix(a,b,s); if(s<2.0) return mix(b,c,s-1.0); if(s<3.0) return mix(c,d,s-2.0); return mix(d,a,s-3.0); }
      void main(){ vec3 n=pow(pal(vU*0.012-uTime*(0.05+uParty*0.25)),vec3(2.2)); float pulse=1.0+uParty*0.6*sin(vU*0.4-uTime*6.0);
        vec3 day=vec3(0.86,0.9,0.93); vec3 c=mix(day*0.9,n*3.2*pulse,uOn);
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`, fog: false
  });
}
function buildNeon(ship) {
  const mat = neonMat(); G.neonMat = mat;
  const deck = outline(deckHalf, -152, 152);
  const path = offsetPoly(deck, 0.03);
  const geos = [ribbonGeo(path, 51.7, 51.9, true, 1, false), ribbonGeo(offsetPoly(deck, 0.03), 19.72, 19.9, true, 1, false)];
  geos.push(ribbonGeo([[11.98, 62], [11.98, -40]], 50.6, 50.75, false, 1, false));
  geos.push(ribbonGeo([[-11.98, -40], [-11.98, 62]], 50.6, 50.75, false, 1, false));
  const m = new T.Mesh(mergeGeos(geos), mat); ship.add(m);
}

/* ---- 21_areas.js ---- */
/* ================= ship areas: dome, pool deck, canyon, aft, waterpark, bow ================= */
const FURN = { loungers: [], stools: [], waters: [], hotWaters: [], benches: [] };
const CUSHION_COLS = ['#ff6a55', '#2fd3c6', '#f4f6f8', '#10264a', '#ffc95c', '#5aa9ff'];

function inwardRibbon(pts, y0, y1) {
  let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
  const a = pts[0], b = pts[1]; let tx = b[0] - a[0], tz = b[1] - a[1];
  const nx = tz, nz = -tx; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  const inward = (cx - mx) * nx + (cz - mz) * nz > 0;
  return ribbonGeo(pts, y0, y1, true, 1, !inward);
}
function poolBasin(B, pts, topY, depth, o = {}) {
  const mat = o.mat || 'mosaic', level = o.level || 'd15';
  const wall = inwardRibbon(pts, topY - depth, topY);
  const uv = wall.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * depth);
  B.push(mat, wall);
  B.push(mat, floorGeo(pts, [], topY - depth));
  if (o.coping !== false) B.push('white', extrudeY(offsetPoly(pts, 0.42), [pts], topY - 0.04, topY + 0.07, 12));
  const surf = topY - (o.fill !== undefined ? o.fill : 0.25);
  (o.hot ? FURN.hotWaters : FURN.waters).push(floorGeo(pts, [], surf));
  addFloor(pts, topY - depth, level, { name: 'poolfloor' });
  return addWater(pts, surf, topY - depth, { hot: o.hot, id: o.id, name: o.name });
}
function loungerGeos() {
  if (GEO.loungerFrame) return;
  // chaise lounge, local frame: foot toward +z, backrest raised toward -z (hinged at z = -0.21)
  const BACK = 0.62, bc = Math.cos(BACK), bs = Math.sin(BACK), HZ = -0.21;
  const f = [];
  for (const s of [-1, 1]) { const g = box(0.04, 0.04, 1.9); g.translate(s * 0.31, 0.3, 0); f.push(g); }
  for (const [x, z] of [[-0.29, 0.85], [0.29, 0.85], [-0.29, -0.85], [0.29, -0.85]]) { const g = cyl(0.025, 0.025, 0.3, 6); g.translate(x, 0.15, z); f.push(g); }
  for (const z of [0.94, -0.94]) { const g = box(0.6, 0.03, 0.04); g.translate(0, 0.3, z); f.push(g); }
  for (const s of [-1, 1]) {
    f.push(beamGeo(V3(s * 0.31, 0.33, HZ), V3(s * 0.31, 0.33 + 0.74 * bs, HZ - 0.74 * bc), 0.018, 6));            // backrest rail
    f.push(beamGeo(V3(s * 0.31, 0.3, HZ - 0.55), V3(s * 0.31, 0.33 + 0.45 * bs, HZ - 0.45 * bc), 0.014, 6));       // prop strut
  }
  { const g = box(0.64, 0.03, 0.03); g.translate(0, 0.33 + 0.74 * bs, HZ - 0.74 * bc); f.push(g); }
  GEO.loungerFrame = mergeGeos(f);
  const c = [];
  { const g = new T.BoxGeometry(0.6, 0.09, 1.17, 1, 1, 4); g.translate(0, 0.37, HZ + 1.17 / 2); c.push(g); }
  { const g = new T.BoxGeometry(0.6, 0.08, 0.76, 1, 1, 3); g.translate(0, 0, -0.38); g.rotateX(BACK); g.translate(0, 0.39, HZ); c.push(g); }
  GEO.loungerCushion = mergeGeos(c);
  const s = [];
  { const g = cyl(0.03, 0.03, 0.72, 8); g.translate(0, 0.36, 0); s.push(g); }
  { const g = cyl(0.2, 0.22, 0.03, 16); g.translate(0, 0.015, 0); s.push(g); }
  GEO.stoolPole = mergeGeos(s);
  GEO.stoolSeat = (() => { const g = cyl(0.21, 0.19, 0.09, 20); g.translate(0, 0.76, 0); return g; })();
}
function addLoungerRow(x, z0, z1, side, level = 'd15', y = DK.top) {
  const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  let n = 0;
  for (let z = z0; z <= z1 + 1e-6; z += 1.05) { FURN.loungers.push({ x, y, z, ry }); World.spots.loungers.push({ x, y, z, ry, level, taken: null }); n++; }
  addBoxCollider(x, (z0 + z1) / 2, 0.98, (z1 - z0) / 2 + 0.4, y, y + 0.55);
}
function addStool(x, y, z, ry, bar, level) { FURN.stools.push({ x, y, z, ry }); World.spots.stools.push({ x, y, z, ry, bar, taken: null, level: level || (y > 50 ? 'd15' : undefined), tag: World.tag }); }
function finishFurniture(ship) {
  loungerGeos();
  const lm = FURN.loungers.map(l => mtx(l.x, l.y, l.z, l.ry));
  ship.add(instanced(GEO.loungerFrame, MAT.frame, lm, { cast: true }));
  const cols = FURN.loungers.map((l, i) => new T.Color(CUSHION_COLS[(Math.floor(l.z * 0.95 + 100) + Math.round(l.x)) % 4 === 0 ? 4 : (Math.abs(Math.round(l.x)) % 3 === 0 ? 2 : (l.x > 0 ? 1 : 0))]));
  ship.add(instanced(GEO.loungerCushion, MAT.cushion, lm, { cast: true, colors: cols }));
  const sm = FURN.stools.map(s => mtx(s.x, s.y, s.z, s.ry));
  ship.add(instanced(GEO.stoolPole, MAT.steel, sm));
  ship.add(instanced(GEO.stoolSeat, MAT.cushion, sm, { colors: FURN.stools.map((_, i) => new T.Color(i % 2 ? '#ff6a55' : '#10264a')) }));
  const pm = makePoolMat(); G.poolMats = [pm];
  if (FURN.waters.length) { const m = new T.Mesh(mergeGeos(FURN.waters), pm); m.renderOrder = 3; ship.add(m); }
  const hm = makePoolMat({ deep: '#1b8fb0', shallow: '#8ff0f2', glow: 1.8, chop: 2.4, alpha: 0.78 }); G.poolMats.push(hm);
  if (FURN.hotWaters.length) { const m = new T.Mesh(mergeGeos(FURN.hotWaters), hm); m.renderOrder = 3; ship.add(m); }
}
function addHotspot(id, x, y, z, r, label, kind, data = {}) { const h = { id, pos: V3(x, y, z), r, label, kind, data, tag: World.tag }; World.hotspots.push(h); return h; }
function addRailSpots(pts, y, level, every = 6, inset = 0.65, outwardSign = 1) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.01) continue;
    const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
    for (let s = (every - acc % every); s < len; s += every) {
      const x = a[0] + tx * s, z = a[1] + tz * s;
      let nx = tz * outwardSign, nz = -tx * outwardSign;
      World.spots.rails.push({ x: x - nx * inset, y, z: z - nz * inset, ry: Math.atan2(nx, nz), level, taken: null });
    }
    acc += len;
  }
}

/* ---------------- palms + trees ---------------- */
function palmInto(B, x, y, z, h, rot, sc = 1) {
  const lean = rand(0.4, 1.4) * sc;
  const curve = new T.QuadraticBezierCurve3(V3(0, 0, 0), V3(lean * 0.15, h * 0.55, 0), V3(lean, h, 0.1));
  const P = [], C = [], I = [], U = [], N = [];
  const rings = 22, seg = 10;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, p = curve.getPoint(t), r = lerp(0.24, 0.13, t) * sc * (i % 2 ? 1.08 : 0.94);
    const tone = i % 2 ? 0.82 : 1.0;
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * TAU; P.push(p.x + Math.cos(a) * r, p.y, p.z + Math.sin(a) * r); N.push(Math.cos(a), 0.15, Math.sin(a)); U.push(j / seg, t);
      C.push(0.34 * tone, 0.2 * tone, 0.1 * tone);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); tg.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); tg.setAttribute('color', new T.Float32BufferAttribute(C, 3)); tg.setIndex(I);
  B.add('trunk', tg, x, y, z, rot);
  const top = curve.getPoint(1);
  const nF = 11;
  for (let f = 0; f < nF; f++) {
    const a = f / nF * TAU + rand(-0.2, 0.2), L = rand(2.4, 3.3) * sc, droop = rand(1.2, 2.0) * sc, up = rand(0.3, 0.8) * sc;
    const FP = [], FU = [], FI = [];
    const steps = 14, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i <= steps; i++) {
      const s = i / steps; const along = s * L; const yy = up * s * 2 - droop * s * s;
      const cx = top.x + ca * along, cz = top.z + sa * along, cy = top.y + yy;
      const w = 0.55 * sc * Math.sin(Math.min(1, s * 1.1 + 0.05) * Math.PI) + 0.05; const twist = s * 0.5;
      const px = -sa * w, pz = ca * w;
      FP.push(cx - px, cy - twist * 0.3, cz - pz, cx + px, cy + twist * 0.3, cz + pz); FU.push(0, s, 1, s);
    }
    for (let i = 0; i < steps; i++) { const q = i * 2; FI.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(FP, 3)); fg.setAttribute('uv', new T.Float32BufferAttribute(FU, 2)); fg.setIndex(FI); fg.computeVertexNormals();
    const nn = fg.attributes.normal; for (let i = 0; i < nn.count; i++) { nn.setY(i, Math.abs(nn.getY(i)) + 0.6); } fg.attributes.normal.needsUpdate = true;
    B.add('leaf', fg, x, y, z, rot);
  }
  // coconuts
  for (let k = 0; k < 3; k++) B.add('trunk', tint(new T.SphereGeometry(0.13 * sc, 10, 8), '#5a3d22'), x, y, z, rot);
}
function planterPalm(B, x, z, y = DK.top, h = 6, r = 1.0) {
  B.add('planter', cyl(r, r * 0.85, 0.9, 28), x, y + 0.45, z);
  B.add('soil', cyl(r * 0.92, r * 0.92, 0.04, 24), x, y + 0.86, z);
  palmInto(B, x, y + 0.85, z, h, rand(0, TAU));
  addCircle(x, z, r, y, y + 1.2);
}
function treeInto(B, x, y, z, h = 5.5) {
  const tr = cyl(0.12, 0.2, h * 0.6, 10); tint(tr, '#6e5640');
  B.add('trunk', tr, x, y + h * 0.3, z);
  const greens = ['#3f7d34', '#4f9440', '#2f6a2c', '#5aa04a'];
  for (let i = 0; i < 6; i++) {
    const g = new T.SphereGeometry(rand(1.0, 1.6), 16, 12);
    const p = g.attributes.position; const col = [];
    const base = lin(pick(greens));
    for (let k = 0; k < p.count; k++) {
      const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k); const n = 1 + 0.18 * Math.sin(vx * 3.1 + vy * 2.3) * Math.cos(vz * 2.7 + vx);
      p.setXYZ(k, vx * n, vy * n * 0.8, vz * n); const sh = 0.75 + 0.35 * (vy > 0 ? 1 : 0.6); col.push(base.r * sh, base.g * sh, base.b * sh);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const a = i / 6 * TAU, rr = i === 0 ? 0 : rand(0.8, 1.4);
    B.add('foliage', g, x + Math.cos(a) * rr, y + h * 0.72 + rand(-0.3, 0.9) + (i === 0 ? 0.8 : 0), z + Math.sin(a) * rr);
  }
  addCircle(x, z, 0.35, y, y + 3);
}

/* ---------------- dome ---------------- */
const DOME = { c: V3(0, DK.top, -123), r: V3(26, 23, 27) };
function domePoint(th, ph, s = 1) { const c = Math.cos(ph); return V3(DOME.c.x + DOME.r.x * c * Math.cos(th) * s, DOME.c.y + DOME.r.y * Math.sin(ph) * s, DOME.c.z + DOME.r.z * c * Math.sin(th) * s); }
const inDoor = p => p.z > -101 && Math.abs(p.x) < 4.6 && p.y < 58.2;
function buildDome(ship) {
  const B = new Bin();
  // glass shell
  const su = 120, sv = 30, P = [], N = [], U = [], I = [];
  for (let j = 0; j <= sv; j++) for (let i = 0; i <= su; i++) {
    const th = i / su * TAU, ph = j / sv * Math.PI / 2; const p = domePoint(th, ph);
    P.push(p.x, p.y, p.z); const n = V3((p.x - DOME.c.x) / (DOME.r.x ** 2), (p.y - DOME.c.y) / (DOME.r.y ** 2), (p.z - DOME.c.z) / (DOME.r.z ** 2)).normalize(); N.push(n.x, n.y, n.z); U.push(i / su, j / sv);
  }
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
    const a = j * (su + 1) + i, b = a + 1, c = a + su + 1, d = c + 1;
    const m = domePoint((i + 0.5) / su * TAU, (j + 0.5) / sv * Math.PI / 2);
    if (inDoor(m)) continue;
    I.push(a, c, b, b, c, d);
  }
  const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); gg.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); gg.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); gg.setIndex(I);
  const glass = new T.Mesh(gg, MAT.domeGlass); glass.renderOrder = 5; ship.add(glass);
  // diamond lattice with LED shader
  const lat = [];
  const tubeRun = pts => { if (pts.length < 2) return; lat.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts), Math.max(2, pts.length * 2), 0.14, 6, false)); };
  const K = 30;
  for (let k = 0; k < K; k++) for (const dir of [1, -1]) {
    let run = [];
    for (let s = 0; s <= 40; s++) {
      const ph = s / 40 * 1.36, th = k / K * TAU + dir * ph * 1.55;
      const p = domePoint(th, ph, 1.004);
      if (inDoor(p) || (p.z > -102 && Math.abs(p.x) < 5.4 && p.y < 59)) { tubeRun(run); run = []; continue; }
      run.push(p);
    }
    tubeRun(run);
  }
  for (const [ph, r] of [[0.015, 0.26], [0.42, 0.16], [0.86, 0.16], [1.36, 0.22]]) {
    let run = [];
    for (let s = 0; s <= 160; s++) { const p = domePoint(s / 160 * TAU + Math.PI / 2 + 0.02, ph, 1.006); if (inDoor(p) || (p.z > -102 && Math.abs(p.x) < 5.4 && p.y < 59)) { if (run.length > 1) lat.push(new T.TubeGeometry(new T.CatmullRomCurve3(run), run.length * 2, r, 8, false)); run = []; continue; } run.push(p); }
    if (run.length > 1) lat.push(new T.TubeGeometry(new T.CatmullRomCurve3(run), run.length * 2, r, 8, false));
  }
  // door arch
  const arch = [V3(-4.8, 52, -96.7), V3(-4.8, 54.2, -96.7)];
  for (let s = 0; s <= 20; s++) { const a = Math.PI - s / 20 * Math.PI; arch.push(V3(Math.cos(a) * 4.8, 55.6 + Math.sin(a) * 2.2, -96.7)); }
  arch.push(V3(4.8, 54.2, -96.7), V3(4.8, 52, -96.7));
  lat.push(new T.TubeGeometry(new T.CatmullRomCurve3(arch), 80, 0.24, 8, false));
  const latMat = new T.MeshStandardMaterial({ color: lin('#e8eef3'), roughness: 0.32, metalness: 0.65, emissive: 0x000000 });
  G.domeU = { uTime: { value: 0 }, uLed: { value: 0 }, uParty: { value: 0 } };
  latMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, G.domeU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform float uTime; uniform float uLed; uniform float uParty;
      vec3 tpal(float t){ t=fract(t); vec3 a=vec3(0.18,0.83,0.78), b=vec3(1.0,0.42,0.33), c=vec3(0.35,0.66,1.0), d=vec3(1.0,0.79,0.36);
        float s=t*4.0; if(s<1.0) return mix(a,b,s); if(s<2.0) return mix(b,c,s-1.0); if(s<3.0) return mix(c,d,s-2.0); return mix(d,a,s-3.0); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float ang=atan(vWP.x,vWP.z+123.0);
      float band=0.5+0.5*sin(vWP.y*0.5-uTime*(1.1+uParty*3.5)+ang*3.0);
      float sparkle=step(0.985,fract(sin(dot(floor(vWP*1.4),vec3(12.9,78.2,37.7)))*43758.5+uTime*0.5*uParty));
      totalEmissiveRadiance+=pow(tpal(vWP.y*0.025+uTime*0.04+ang*0.159),vec3(2.2))*(0.35+1.1*band+sparkle*2.0)*uLed;`);
  };
  const lattice = new T.Mesh(mergeGeos(lat), latMat); lattice.castShadow = true; lattice.receiveShadow = true; ship.add(lattice);
  // collider ring with doorway gap
  const ring = []; for (let s = 0; s <= 72; s++) { const p = domePoint(s / 72 * TAU, 0, 0.995); ring.push([p.x, p.z]); }
  for (let i = 0; i < ring.length - 1; i++) { const a = ring[i], b = ring[i + 1]; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (mz > -101 && Math.abs(mx) < 4.6) continue; addWall(a[0], a[1], b[0], b[1], 51.5, 60, 0.2); }
  // floor
  B.push('terrazzo', floorGeo(ellipsePts(0, -123, 25.7, 26.7, 120), [TOP.domePool], DK.top + 0.02));
  poolBasin(B, TOP.domePool, DK.top, 1.6, { id: 'domepool', name: 'Skydome pool' });
  // waterfall feature
  const wf = []; for (let s = 0; s <= 40; s++) { const a = lerp(Math.PI * 1.14, Math.PI * 1.86, s / 40); wf.push([Math.cos(a) * 9.6, -133.5 + Math.sin(a) * 9.6]); }
  B.push('mosaicDark', ribbonGeo(wf, 52, 61.5, false, 0.25, false));
  B.push('mosaicDark', ribbonGeo(wf, 52, 61.5, false, 0.25, true).translate(0, 0, -0.6));
  B.push('white', extrudeY(offsetPoly(wf.concat(wf.slice().reverse().map(p => [p[0] * 1.06, -133.5 + (p[1] + 133.5) * 1.06])), 0), [], 61.5, 61.9, 4));
  addWallPath(wf, false, 51.5, 62, 0.35);
  const ww = []; for (let s = 0; s <= 40; s++) { const a = lerp(Math.PI * 1.16, Math.PI * 1.84, s / 40); ww.push([Math.cos(a) * 9.3, -133.5 + Math.sin(a) * 9.3]); }
  const wfg = ribbonGeo(ww, 51.8, 61.4, false, 0.12, false);
  const wmat = new T.MeshBasicMaterial({ map: TEX.stream.clone(), transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide, color: 0xd8f6ff });
  wmat.map.needsUpdate = true; wmat.map.repeat.set(1, 1.2); G.waterfallMat = wmat;
  const wfm = new T.Mesh(wfg, wmat); wfm.renderOrder = 4; ship.add(wfm);
  // DJ booth on a round riser facing aft
  B.add('white', cyl(3.4, 3.5, 0.45, 48), 0, 52.22, -118.2);
  B.add('speaker', box(4.6, 1.05, 1.1), 0, 52.97, -116.4);
  B.add('steel', box(4.7, 0.06, 1.2), 0, 53.52, -116.4);
  for (const s of [-1, 1]) { B.add('darkMetal', cyl(0.24, 0.24, 0.05, 24), s * 1.1, 53.58, -116.5); B.add('speaker', box(1.2, 2.6, 1.0), s * 4.6, 53.3, -117.5); }
  const truss = []; for (let s = 0; s <= 30; s++) { const a = s / 30 * Math.PI; truss.push(V3(Math.cos(a) * 5.6, 52.4 + Math.sin(a) * 6.4, -119.6)); }
  B.push('steel', new T.TubeGeometry(new T.CatmullRomCurve3(truss), 60, 0.16, 8, false));
  addCircle(0, -118.2, 3.3, 51.5, 56);
  addHotspot('dj_dome', 0, 52, -114.6, 2.2, 'Request a song', 'dj');
  // LED dance floor (instanced, updated by events)
  const tiles = []; const tcols = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 10; j++) { tiles.push(mtx(-5.5 + i, DK.top + 0.045, -111.5 + j)); tcols.push(new T.Color('#10264a')); }
  const led = instanced(box(0.94, 0.07, 0.94), new T.MeshBasicMaterial({ color: 0xffffff }), tiles, { colors: tcols });
  ship.add(led); G.ledFloor = { mesh: led, nx: 12, nz: 10 };
  addFloor(rectPts(-6, -112, 6, -102), DK.top + 0.08, 'd15', { name: 'ledfloor' });
  World.spots.dance.push({ zone: 'dome', poly: rectPts(-6, -112, 6, -102) });
  addHotspot('dance_dome', 0, 52, -107, 5.2, 'Dance on the LED floor', 'dance', { zone: 'dome' });
  // bars on both sides
  for (const s of [-1, 1]) {
    const bx = s * 16.5, bz = -114;
    B.add('mosaic', box(1.3, 1.08, 8), bx, 52.54, bz);
    B.add('teak', box(1.7, 0.07, 8.4), bx, 53.11, bz);
    B.add('white', box(0.6, 2.4, 7), bx + s * 2.2, 53.2, bz);
    for (let k = 0; k < 12; k++) B.add('bottle', tint(cyl(0.06, 0.07, 0.34, 8), pick(['#2fd3c6', '#ff6a55', '#ffc95c', '#9be37a', '#f2f5f8', '#5aa9ff'])), bx + s * 1.95, 53.6 + (k % 2) * 0.55, bz - 3 + Math.floor(k / 2) * 1.2);
    addBoxCollider(bx, bz, 0.7, 4.1, 51.5, 53.2);
    for (let k = 0; k < 5; k++) addStool(bx - s * 1.15, DK.top, bz - 3.2 + k * 1.6, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? 'domeS' : 'domeP');
    addHotspot(s > 0 ? 'bar_domeS' : 'bar_domeP', bx - s * 1.6, 52, bz, 3.6, 'Order at the Dome Bar', 'bar', { bar: 'Dome Bar' });
  }
  // lounge sofas and palms
  for (const [x, z, ry] of [[-19, -132, 0.9], [19, -132, -0.9], [-10, -144, 0.3], [10, -144, -0.3], [-22, -122, 1.5], [22, -122, -1.5]]) {
    B.add('cushion', box(3.4, 0.45, 1.1), x, 52.25, z, ry); B.add('navy', box(3.4, 0.7, 0.3), x, 52.6, z - 0.45 * Math.cos(ry), ry);
    addBoxCollider(x, z, 1.75, 0.7, 51.8, 53, ry);
  }
  for (const [x, z] of [[-13.5, -126], [13.5, -126], [-12.5, -138], [12.5, -138], [-21, -106], [21, -106]]) planterPalm(B, x, z, DK.top, 4.8, 0.8);
  B.build(ship, { mosaicDark: { cast: false } });
  World.zones.dome = { name: 'Skydome', deck: 'Deck 15 · Forward', spawn: [0, DK.top, -99.2, Math.PI], level: 'd15' };
  G.points[0].position.set(-6, 60, -110); G.points[1].position.set(6, 60, -110);
}

/* ---------------- pool deck ---------------- */
function buildPoolDeck(ship) {
  const B = new Bin();
  poolBasin(B, TOP.mainPool, DK.top, 1.7, { id: 'main', name: 'Infinity Pool' });
  for (const s of [-1, 1]) {
    B.add('steel', new T.TorusGeometry(0.35, 0.03, 6, 16, Math.PI), s * 9.15, 52.3, -71, s > 0 ? -Math.PI / 2 : Math.PI / 2, 1, 1, 1, 0, 0);
  }
  TOP.tubs.forEach((t, i) => {
    poolBasin(B, t, DK.top + 0.45, 1.25, { hot: true, id: 'tub', name: 'Whirlpool', coping: false, fill: 0.2 });
    const cx = i ? 14.5 : -14.5;
    B.add('white', new T.TorusGeometry(2.42, 0.2, 10, 48), cx, 52.42, -58, 0, 1, 1, 1, Math.PI / 2);
    B.add('white', cyl(2.62, 2.62, 0.45, 48, true), cx, 52.22, -58);
  });
  // overwater whirlpools
  for (const s of [-1, 1]) {
    const cx = s * 34, cz = -72;
    const pts = ellipsePts(cx, cz, 2.3, 2.3, 32);
    const w = poolBasin(B, pts, DK.top, 1.05, { hot: true, id: 'overwater', name: 'Overwater Whirlpool', coping: false, fill: 0.15, mat: 'glass' });
    B.add('steel', new T.TorusGeometry(2.4, 0.12, 8, 48), cx, 52.05, cz, 0, 1, 1, 1, Math.PI / 2);
    B.add('steel', new T.TorusGeometry(2.4, 0.08, 8, 48), cx, 50.95, cz, 0, 1, 1, 1, Math.PI / 2);
    for (let k = 0; k < 3; k++) B.push('white', beamGeo(V3(s * 30.8, 50.2 + k * 0.05, cz - 1.5 + k * 1.5), V3(cx + s * 1.6, 50.9, cz - 1.2 + k * 1.2), 0.14, 8));
    B.add('teak', box(1.1, 0.12, 5), s * 31.35, 51.94, cz);
    addFloor(rectPts(Math.min(s * 30.8, s * 31.9), cz - 2.5, Math.max(s * 30.8, s * 31.9), cz + 2.5), DK.top, 'd15', { name: 'overwaterdeck' });
    const arc = []; const a0 = (s > 0 ? Math.PI : 0) + 0.65; for (let k = 0; k <= 26; k++) { const a = a0 + k / 26 * (TAU - 1.3); arc.push([cx + Math.cos(a) * 2.5, cz + Math.sin(a) * 2.5]); }
    addWallPath(arc, false, 50.5, 53.4, 0.15);
    addRail(B, [[s * 30.7, cz - 2.55], [s * 32.0, cz - 2.55]], DK.top);
    addRail(B, [[s * 30.7, cz + 2.55], [s * 32.0, cz + 2.55]], DK.top);
    addHotspot('overwater' + s, cx - s * 1.2, 52, cz, 2.4, 'Soak in the overwater whirlpool', 'tub');
  }
  // Coral Bar
  const bx = -20, bz = -84;
  B.push('mosaic', extrudeY(ellipsePts(bx, bz, 3.4, 3.4, 56), [ellipsePts(bx, bz, 2.7, 2.7, 56)], 52, 53.06, 56));
  B.push('teak', extrudeY(ellipsePts(bx, bz, 3.65, 3.65, 64), [ellipsePts(bx, bz, 2.6, 2.6, 64)], 53.06, 53.14, 64));
  B.add('white', cyl(1.2, 1.3, 2.4, 32), bx, 53.2, bz);
  for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; B.add('bottle', tint(cyl(0.06, 0.07, 0.36, 8), pick(['#2fd3c6', '#ff6a55', '#ffc95c', '#9be37a', '#f2f5f8'])), bx + Math.cos(a) * 1.3, 54.6 + (k % 2) * 0.5, bz + Math.sin(a) * 1.3); }
  B.add('white', new T.TorusGeometry(1.32, 0.05, 6, 40), bx, 54.4, bz, 0, 1, 1, 1, Math.PI / 2);
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.3; B.add('white', cyl(0.07, 0.07, 4.4, 8), bx + Math.cos(a) * 3.05, 54.2, bz + Math.sin(a) * 3.05); }
  const cone = new T.ConeGeometry(5.4, 2.3, 48, 3, true); const cp = cone.attributes.position;
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y < -1.1) { const a = Math.atan2(cp.getZ(i), cp.getX(i)); cp.setY(i, y + 0.18 * Math.abs(Math.sin(a * 12))); } }
  cone.computeVertexNormals();
  B.add('fabricCoral', cone, bx, 57.5, bz);
  B.add('fabric', new T.ConeGeometry(1.2, 0.7, 24), bx, 58.8, bz);
  for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addStool(bx + Math.cos(a) * 4.1, DK.top, bz + Math.sin(a) * 4.1, Math.atan2(-Math.cos(a), -Math.sin(a)), 'coral'); }
  addCircle(bx, bz, 3.5, 51.5, 54);
  addHotspot('bar_coral', bx, 52, bz, 5.4, 'Order at Coral Bar', 'bar', { bar: 'Coral Bar' });
  World.bartenders = [{ x: bx, z: bz + 2.0, ry: 0 }, { x: 16.5 + 1.4, z: -114, ry: -Math.PI / 2 }, { x: -16.5 - 1.4, z: -114, ry: Math.PI / 2 }];
  // pool DJ booth with foam cannons
  const dx = 19.5, dz = -90;
  B.add('white', box(7.2, 0.35, 3.4), dx, 52.18, dz);
  B.add('speaker', box(4.2, 1.05, 1.0), dx, 52.88, dz + 0.9);
  B.add('steel', box(4.3, 0.06, 1.1), dx, 53.42, dz + 0.9);
  for (const s of [-1, 1]) { B.add('speaker', box(1.2, 2.4, 1.0), dx + s * 3.0, 53.55, dz); B.add('steel', cyl(0.12, 0.12, 5.4, 10), dx + s * 3.4, 55.0, dz - 1.4); }
  B.add('steel', box(7.2, 0.25, 0.25), dx, 57.6, dz - 1.4);
  B.add('banner', new T.PlaneGeometry(5.6, 1.4), dx, 56.6, dz - 1.32);
  for (const s of [-1, 1]) B.add('darkMetal', cyl(0.28, 0.36, 1.6, 16), dx + s * 3.4, 57.2, dz - 0.6, 0, 1, 1, 1, -0.9);
  addBoxCollider(dx, dz, 3.7, 1.8, 51.5, 54.5);
  World.foamCannons = [V3(dx - 3.4, 57.6, dz + 0.2), V3(dx + 3.4, 57.6, dz + 0.2)];
  addHotspot('dj_pool', dx, 52, dz + 2.6, 2.0, 'Request a song', 'dj');
  World.spots.dance.push({ zone: 'pool', poly: rectPts(8, -88, 21, -80) });
  World.spots.dance.push({ zone: 'pool', poly: rectPts(-13, -91, 7, -80) });
  addHotspot('dance_pool', 14, 52, -84, 5, 'Dance by the DJ', 'dance', { zone: 'pool' });
  // loungers
  for (const s of [-1, 1]) { addLoungerRow(s * 26, -78, -46.5, s); addLoungerRow(s * 22.4, -78, -46.5, s); }
  // shade sails
  for (const s of [-1, 1]) {
    const C = [[s * 27.9, -77, 56.4], [s * 20.7, -73, 55.0], [s * 20.7, -55, 56.8], [s * 27.9, -51, 55.2]];
    const n = 18, SP = [], SI = [], SU = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const u = i / n, v = j / n;
      const x = lerp(lerp(C[0][0], C[1][0], u), lerp(C[3][0], C[2][0], u), v), z = lerp(lerp(C[0][1], C[1][1], u), lerp(C[3][1], C[2][1], u), v);
      const y = lerp(lerp(C[0][2], C[1][2], u), lerp(C[3][2], C[2][2], u), v) - Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.35;
      SP.push(x, y, z); SU.push(u, v);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + 1, c = a + n + 1, d = c + 1; SI.push(a, b, c, b, d, c); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(SP, 3)); sg.setAttribute('uv', new T.Float32BufferAttribute(SU, 2)); sg.setIndex(SI); sg.computeVertexNormals();
    B.push(s > 0 ? 'fabric' : 'fabricCoral', sg);
    for (const c of C) { B.add('steel', cyl(0.1, 0.12, c[2] - 52 + 0.4, 10), c[0] + s * 0.2, (52 + c[2] + 0.4) / 2, c[1]); addCircle(c[0] + s * 0.2, c[1], 0.16, 51.5, 56); }
  }
  for (const [x, z] of [[-11.6, -81.5], [11.6, -81.5], [-11.6, -61], [11.6, -61]]) planterPalm(B, x, z, DK.top, rand(5.8, 7));
  // elevators fore + aft
  for (const [x, z] of [[-25, -36], [25, -36], [-24, 57], [24, 57]]) elevatorLobby(B, x, z);
  // rail spots
  const per = offsetPoly(TOP.deck, -0.28);
  addRailSpots(per.filter(p => p[0] > 0 && p[1] > -96 && p[1] < 146), DK.top, 'd15', 7, 0.6, 1);
  addRailSpots(per.filter(p => p[0] < 0 && p[1] > -96 && p[1] < 146), DK.top, 'd15', 7, 0.6, 1);
  B.build(ship, { glass: { cast: false } });
  World.zones.pool = { name: 'Pool Deck', deck: 'Deck 15 · Midship', spawn: [0, DK.top, -88, 0], level: 'd15' };
  G.points[2].position.set(0, 58, -72);
}
function elevatorLobby(B, x, z) {
  B.add('white', box(3.4, 0.3, 3.4), x, 55.35, z);
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) B.add('steel', box(0.16, 3.2, 0.16), x + dx, 53.6, z + dz);
  for (const [dx, dz, ry] of [[0, -1.62, 0], [0, 1.62, 0], [-1.62, 0, Math.PI / 2], [1.62, 0, Math.PI / 2]]) B.add('glass', box(3.1, 3.0, 0.04), x + dx, 53.55, z + dz, ry);
  B.add('darkGlass', box(1.4, 2.4, 0.06), x - Math.sign(x) * 1.66, 53.25, z, Math.PI / 2);
  B.add('gold', box(0.08, 0.2, 0.12), x - Math.sign(x) * 1.7, 53.4, z + 1.0, Math.PI / 2);
  addBoxCollider(x, z, 1.7, 1.7, 51.5, 55.5);
  addHotspot('elev_' + x + '_' + z, x - Math.sign(x) * 2.6, DK.top, z, 2.2, 'Take the elevator', 'elevator');
  World.elevators.push({ level: 'd15', x: x - Math.sign(x) * 2.6, y: DK.top, z });
}

/* ---------------- canyon: bridge, zipline, garden ---------------- */
function buildCanyon(ship) {
  const B = new Bin();
  // pedestrian bridge
  B.add('white', box(24.3, 0.4, 4), 0, 51.8, 10);
  B.push('teak', floorGeo(rectPts(-12.2, 8, 12.2, 12), [], DK.top + 0.005));
  addFloor(rectPts(-12.3, 8, 12.3, 12), DK.top, 'd15', { name: 'bridge' });
  addRail(B, [[-12.2, 8.1], [12.2, 8.1]], DK.top); addRail(B, [[-12.2, 11.9], [12.2, 11.9]], DK.top);
  // zipline towers + cable
  const A = V3(-17, 61, 50), Bp = V3(21, 56.6, -26);
  const tower = (x, z, top) => {
    for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) B.add('coral', box(0.3, top - 52, 0.3), x + dx, (52 + top) / 2, z + dz);
    B.add('teak', box(4.2, 0.3, 4.2), x, top - 0.15, z);
    for (let k = 0; k < Math.floor((top - 52) / 1.3); k++) B.add('white', box(1.2, 0.12, 0.7), x + 2.6, 52.6 + k * 1.3, z - 1.6 + (k % 4) * 1.05);
    B.add('steel', box(0.2, top - 52 + 1, 0.2), x + 3.2, (52 + top) / 2, z);
    addBoxCollider(x, z, 2.05, 2.05, 51.5, top);
    addRail(B, [[x - 2, z - 2], [x + 2, z - 2], [x + 2, z + 2], [x - 2, z + 2]], top, { collide: false });
  };
  tower(A.x, A.z, 58.9); tower(Bp.x, Bp.z, 54.5);
  const cab = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60; const p = V3().lerpVectors(A, Bp, t); p.y -= Math.sin(t * Math.PI) * 1.2; cab.push(p); }
  const zipCurve = new T.CatmullRomCurve3(cab);
  B.push('rope', new T.TubeGeometry(zipCurve, 120, 0.035, 6, false));
  World.zip = { curve: zipCurve, start: V3(A.x, 58.9, A.z), end: V3(Bp.x, 54.5, Bp.z), exit: V3(Bp.x - 3.2, DK.top, Bp.z + 3.5) };
  addHotspot('zip', A.x + 2.6, DK.top, A.z - 3.0, 2.6, 'Ride the Canyon Zip', 'zip');
  // garden floor
  const gy = DK.garden;
  addFloor(rectPts(-12, -40, 12, 62), gy, 'garden', { name: 'garden' });
  B.push('grass', floorGeo(rectPts(-12, -40, 12, 62), [], gy + 0.01));
  const pav = [rectPts(-2.6, -40, 2.6, 62), rectPts(-12, -40, -8.4, 62), rectPts(8.4, -40, 12, 62), rectPts(-12, 2, 12, 18), rectPts(-12, -22, 12, -18), rectPts(-12, 38, 12, 46)];
  for (const p of pav) B.push('pavers', floorGeo(p, [], gy + 0.02));
  addWallPath([[-11.9, -39.9], [11.9, -39.9], [11.9, 61.9], [-11.9, 61.9]], true, gy - 0.5, gy + 3.5, 0.1);
  // trees, shrubs, flowers
  for (const s of [-1, 1]) for (const z of [-34, -27, -11, -4, 24, 31, 51, 57]) treeInto(B, s * 5.5 + rand(-0.4, 0.4), gy, z + rand(-0.6, 0.6), rand(5, 6.5));
  const fl = [];
  for (let i = 0; i < 260; i++) {
    const s = rng() < 0.5 ? -1 : 1; const x = s * rand(3, 8), z = rand(-38, 60);
    if ((z > 1 && z < 19) || (z > -23 && z < -17) || (z > 37 && z < 47)) continue;
    const g = new T.IcosahedronGeometry(rand(0.08, 0.16), 0);
    tint(g, pick(['#ff6a55', '#ffc95c', '#ff8fab', '#f4f6f8', '#b18cff', '#ff9f43']));
    g.translate(x, gy + rand(0.15, 0.4), z); fl.push(g);
  }
  for (let i = 0; i < 70; i++) {
    const s = rng() < 0.5 ? -1 : 1; const x = s * rand(3, 8), z = rand(-38, 60);
    if ((z > 1 && z < 19) || (z > -23 && z < -17) || (z > 37 && z < 47)) continue;
    const g = new T.SphereGeometry(rand(0.4, 0.75), 12, 8); tint(g, pick(['#3f7d34', '#2f6a2c', '#5aa04a'])); g.scale(1, 0.75, 1); g.translate(x, gy + 0.3, z); fl.push(g);
  }
  B.push('foliage', mergeGeos(fl));
  // benches
  for (const s of [-1, 1]) for (const z of [-30, -9, 27, 52]) {
    const ry = s > 0 ? -Math.PI / 2 : Math.PI / 2, x = s * 3.3;
    for (let k = 0; k < 4; k++) B.add('teak', box(1.8, 0.05, 0.1), x + s * (k * 0.11 - 0.15), gy + 0.45, z, ry + Math.PI / 2);
    B.add('teak', box(1.8, 0.4, 0.05), x + s * 0.3, gy + 0.72, z, ry + Math.PI / 2);
    for (const d of [-0.8, 0.8]) B.add('darkMetal', box(0.4, 0.45, 0.06), x + s * 0.05, gy + 0.22, z + d);
    World.spots.benches.push({ x: x + s * 0.0, y: gy, z, ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, level: 'garden', taken: null });
    addBoxCollider(x + s * 0.1, z, 0.35, 0.95, gy, gy + 0.6);
  }
  // lamps
  for (let z = -36; z <= 58; z += 11.75) for (const s of [-1, 1]) {
    const x = s * 2.95, zz = z + (s > 0 ? 5.8 : 0); if (zz > 60) continue;
    B.add('darkMetal', cyl(0.05, 0.08, 3.6, 10), x, gy + 1.8, zz);
    B.add('lamp', new T.SphereGeometry(0.22, 16, 12), x, gy + 3.75, zz);
    addCircle(x, zz, 0.12, gy, gy + 3);
  }
  // infinity sculpture
  B.add('white', cyl(1.7, 1.9, 1.1, 48), 0, gy + 0.55, 10);
  B.add('pavers', new T.RingGeometry(1.9, 6, 64).rotateX(-Math.PI / 2), 0, gy + 0.025, 10);
  const lem = []; for (let i = 0; i <= 240; i++) { const t = i / 240 * TAU; const d = 1 + Math.sin(t) ** 2; lem.push(V3(3.4 * Math.cos(t) / d, 3.4 * Math.sin(t) * Math.cos(t) / d, 0)); }
  const sculpt = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(lem, true), 240, 0.42, 24, true), MAT.chrome);
  sculpt.position.set(0, gy + 3.6, 10); sculpt.castShadow = true; ship.add(sculpt); G.sculpture = sculpt;
  addCircle(0, 10, 1.95, gy, gy + 5);
  // storefronts
  const shops = [
    { side: -1, z: -26, row: 0, id: 'cafe', label: 'Order at Infinity Café', item: 'coffee' },
    { side: -1, z: 26, row: 1, id: 'gelato', label: 'Order at Gelato Nowhere', item: 'gelato' },
    { side: 1, z: -26, row: 2, id: 'pizza', label: 'Order at Ocean Pizzeria', item: 'pizza' },
    { side: 1, z: 26, row: 3, id: 'boutique', label: 'Browse Tile & Tide', item: 'browse' },
    { side: -1, z: 48, row: 6, id: 'juice', label: 'Order at Juice Lagoon' }, { side: 1, z: 48, row: 7, id: 'taco', label: 'Order at Taco Wave' },
    { side: -1, z: -6, row: 4, id: 'grill', label: 'Order at Seaside Grill' }, { side: 1, z: -6, row: 5, id: 'bakery', label: 'Order at Sweet Tiles' }
  ];
  for (const sh of shops) {
    const x = sh.side * 11.96, ry = sh.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    B.add('shopGlass', new T.PlaneGeometry(7.4, 2.6), x, gy + 1.35, sh.z, ry);
    B.add('white', box(0.3, 3.0, 0.25), x - sh.side * 0.1, gy + 1.5, sh.z - 3.8);
    B.add('white', box(0.3, 3.0, 0.25), x - sh.side * 0.1, gy + 1.5, sh.z + 3.8);
    const aw = new T.PlaneGeometry(7.8, 1.5, 1, 1); aw.rotateX(-1.0);
    B.add(sh.row % 2 ? 'fabricCoral' : 'lagoon', aw, x - sh.side * 0.7, gy + 2.95, sh.z, ry);
    if (sh.row >= 0) {
      const sg = new T.PlaneGeometry(6.4, 0.8); const uv = sg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, (7 - sh.row + uv.getY(i)) / 8);
      B.add('signs', sg, x - sh.side * 0.02, gy + 4.1, sh.z, ry);
      if (sh.id === 'boutique') addHotspot('shop_' + sh.id, x - sh.side * 2.2, gy, sh.z, 2.4, sh.label, 'shop', { item: sh.item, shop: sh.id });
      else addHotspot('shop_' + sh.id, x - sh.side * 2.2, gy, sh.z, 2.4, sh.label, 'menu', { venue: sh.id });
      if (sh.id === 'cafe' || sh.id === 'pizza' || sh.id === 'taco' || sh.id === 'grill') for (const dz of [-2.4, 2.4]) {
        const tx = x - sh.side * 4.6, tz = sh.z + dz;
        B.add('white', cyl(0.4, 0.4, 0.04, 20), tx, gy + 0.74, tz); B.add('darkMetal', cyl(0.04, 0.04, 0.72, 8), tx, gy + 0.36, tz);
        addCircle(tx, tz, 0.45, gy, gy + 0.8);
      }
    }
  }
  // garden elevators + silent disco booth
  for (const [z, ry] of [[-39.85, 0], [61.85, Math.PI]]) {
    B.add('darkGlass', box(2.4, 2.8, 0.1), 0, gy + 1.4, z, ry);
    B.add('steel', box(2.9, 0.2, 0.2), 0, gy + 2.9, z + (ry ? -0.08 : 0.08));
    addHotspot('elev_garden' + z, 0, gy, z + (ry ? -2 : 2), 2.2, 'Take the elevator', 'elevator');
    World.elevators.push({ level: 'garden', x: 0, y: gy, z: z + (ry ? -2.2 : 2.2) });
  }
  B.add('speaker', box(2.4, 1.05, 1), 0, gy + 0.53, 44.6);
  B.add('steel', box(2.5, 0.05, 1.1), 0, gy + 1.08, 44.6);
  addBoxCollider(0, 44.6, 1.3, 0.6, gy, gy + 1.2);
  World.spots.dance.push({ zone: 'garden', poly: rectPts(-7, 30, 7, 42) });
  addHotspot('dance_garden', 0, gy, 40, 4.5, 'Join the silent disco', 'dance', { zone: 'garden' });
  B.build(ship, { grass: { cast: false }, pavers: { cast: false } });
  World.zones.garden = { name: 'Garden Promenade', deck: 'Deck 8 · Open air', spawn: [0, gy, -37, 0], level: 'garden' };
  World.zones.canyon = { name: 'Canyon Walk', deck: 'Deck 15 · Midship', spawn: [17, DK.top, -12, 0], level: 'd15' };
  G.points[3].position.set(0, gy + 6, 10);
}

/* ---------------- aft: funnel, sports court, sun deck ---------------- */
function buildAft(ship) {
  const B = new Bin();
  // funnel: superellipse loft
  const se = (a, b, n, t) => { const c = Math.cos(t), s = Math.sin(t); return [Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * a, Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * b]; };
  const loft = (y0, y1, rings, mat) => {
    const P = [], I = [], U = []; const seg = 72;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, y = lerp(y0, y1, t), u = (y - 52) / 39;
      const a = lerp(4.6, 3.5, u), b = lerp(10.4, 8.2, u), cz = 80 + u * 3.2;
      for (let j = 0; j <= seg; j++) { const [x, z] = se(a, b, 3, j / seg * TAU); P.push(x, y, cz + z); U.push(j / seg, t); }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1; I.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    B.push(mat, g);
  };
  loft(52, 87.5, 18, 'white'); loft(87.5, 91, 3, 'navy');
  B.push('darkMetal', floorGeo(ellipsePts(0, 83.2, 3.4, 8.0, 48), [], 90.8));
  for (const s of [-1, 1]) {
    const u = (78 - 52) / 39, a = lerp(4.6, 3.5, u);
    const p = new T.PlaneGeometry(10, 10); B.add('funnelLogo', p, s * (a + 0.12), 78, 80 + u * 3.2, s * Math.PI / 2);
  }
  const fb = []; for (let k = 0; k < 36; k++) { const [x, z] = se(4.75, 10.55, 3, k / 36 * TAU); fb.push([x, 80 + z]); }
  addWallPath(fb, true, 51.5, 62, 0.1);
  // sports court
  const court = floorGeo(rectPts(-29, 64, -6.5, 92), [], DK.top + 0.03);
  { const p = court.attributes.position, uv = court.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 29) / 22.5, 1 - (p.getZ(i) - 64) / 28); }
  B.push('court', court);
  const fence = [[-6.5, 76], [-6.5, 64], [-29, 64], [-29, 92], [-6.5, 92], [-6.5, 80]];
  for (let i = 0; i < fence.length - 1; i++) {
    const a = fence[i], b = fence[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    const n = Math.ceil(len / 2.8);
    for (let k = 0; k <= n; k++) B.add('darkMetal', cyl(0.05, 0.05, 3.4, 8), lerp(a[0], b[0], k / n), 53.7, lerp(a[1], b[1], k / n));
    const ng = new T.PlaneGeometry(len, 3.2); const uv = ng.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len / 0.9, uv.getY(k) * 3.2 / 0.9);
    B.add('net', ng, (a[0] + b[0]) / 2, 53.65, (a[1] + b[1]) / 2, ry);
    B.push('darkMetal', beamGeo(V3(a[0], 55.35, a[1]), V3(b[0], 55.35, b[1]), 0.05, 6));
    addWall(a[0], a[1], b[0], b[1], 51.5, 55.5, 0.08);
  }
  const hx = -17.75;
  B.add('darkMetal', cyl(0.12, 0.14, 4.0, 12), hx, 54, 64.4);
  B.add('darkMetal', box(0.12, 0.12, 1.1), hx, 55.7, 64.95);
  B.add('white', box(1.8, 1.05, 0.05), hx, 55.6, 65.45);
  B.add('coral', box(0.6, 0.05, 0.06), hx, 55.35, 65.48); B.add('coral', box(0.6, 0.05, 0.06), hx, 55.8, 65.48);
  B.add('coral', box(0.05, 0.45, 0.06), hx - 0.3, 55.58, 65.48); B.add('coral', box(0.05, 0.45, 0.06), hx + 0.3, 55.58, 65.48);
  B.add('orange', new T.TorusGeometry(0.23, 0.018, 8, 32), hx, 55.05, 65.72, 0, 1, 1, 1, Math.PI / 2);
  B.add('net', cyl(0.23, 0.14, 0.42, 16, true), hx, 54.84, 65.72);
  addCircle(hx, 64.4, 0.2, 51.5, 56);
  World.hoop = { rim: V3(hx, 55.05, 65.72), spot: V3(hx, DK.top, 70.3), board: 65.45 };
  addHotspot('hoops', hx, DK.top, 70.3, 2.2, 'Shoot hoops', 'hoops');
  for (let k = 0; k < 3; k++) B.add('ball', new T.SphereGeometry(0.12, 16, 12), -27.6 + k * 0.28, 52.12, 90.6);
  // sun deck platform + stairs
  const sx0 = 8, sx1 = 29, sz0 = 66, sz1 = 92, sy = DK.sun;
  B.push('white', extrudeY(rectPts(sx0, sz0, sx1, sz1), [], 52, sy - 0.02, 4));
  B.push('teak', floorGeo(rectPts(sx0, sz0, sx1, sz1), [], sy));
  addFloor(rectPts(sx0, sz0, sx1, sz1), sy, 'd15', { name: 'sundeck' });
  addWallPath([[sx0, sz1], [sx0, sz0], [sx1, sz0], [sx1, sz1], [15, sz1]], false, 51.5, sy - 0.3, 0.05);
  addWall(9, sz1, sx0, sz1, 51.5, sy - 0.3, 0.05);
  const tr = [[15.1, sz1 - 0.15], [sx1 - 0.15, sz1 - 0.15], [sx1 - 0.15, sz0 + 0.15], [sx0 + 0.15, sz0 + 0.15], [sx0 + 0.15, sz1 - 0.15], [8.9, sz1 - 0.15]];
  addRail(B, tr, sy);
  const steps = 12, run = 6.5 / steps;
  for (let k = 0; k < steps; k++) { const y = sy - (k + 1) * (sy - 52) / steps; B.add('teak', box(5.8, 0.12, run + 0.02), 12, y + 0.06, sz1 + run * (k + 0.5)); B.add('white', box(5.8, sy - y, 0.05), 12, (y + sy) / 2 - (sy - y) / 2 + (sy - y) / 2, sz1 + run * (k + 1)); }
  addFloor(rectPts(9.1, sz1, 14.9, sz1 + 6.5), 52, 'd15', { ramp: { z0: sz1, z1: sz1 + 6.5, y0: sy, y1: 52 }, name: 'stairs' });
  for (const x of [9.0, 15.0]) { addRail(B, [[x, sz1], [x, sz1 + 6.5]], 52, { collide: false }); addWall(x, sz1, x, sz1 + 6.5, 51.5, sy + 1.2, 0.1); }
  addLoungerRow(24.6, 68, 90, 1, 'd15', sy); addLoungerRow(20.8, 68, 90, 1, 'd15', sy);
  B.add('mosaic', box(1.2, 1.08, 5), 11.8, sy + 0.54, 74); B.add('teak', box(1.5, 0.07, 5.3), 11.8, sy + 1.1, 74);
  B.add('white', cyl(0.1, 0.1, 3.2, 10), 9.2, sy + 1.6, 71.3); B.add('white', cyl(0.1, 0.1, 3.2, 10), 9.2, sy + 1.6, 76.7);
  B.add('fabric', box(3.2, 0.08, 6.2), 10.6, sy + 3.2, 74);
  for (let k = 0; k < 4; k++) addStool(13.1, sy, 72.2 + k * 1.2, -Math.PI / 2, 'horizon');
  addBoxCollider(11.8, 74, 0.65, 2.6, sy, sy + 1.2);
  addHotspot('bar_horizon', 13.6, sy, 74, 3.2, 'Order at Horizon Bar', 'bar', { bar: 'Horizon Bar' });
  World.bartenders.push({ x: 10.4, z: 74, ry: Math.PI / 2, y: sy });
  B.build(ship, { net: { cast: false } });
  World.zones.sundeck = { name: 'Sun Deck', deck: 'Deck 17 · Aft', spawn: [12, sy, 88, Math.PI], level: 'd15' };
  World.zones.court = { name: 'Sports Court', deck: 'Deck 15 · Aft', spawn: [-12, DK.top, 84, Math.PI], level: 'd15' };
}

/* ---------------- waterpark ---------------- */
const SLIDE_DEFS = [
  { id: 'riptide', name: 'Riptide', blurb: 'Open spiral, 1¾ turns', mat: 'slideCoral', type: 'open', color: '#ff6a55' },
  { id: 'abyss', name: 'Blue Abyss', blurb: 'Enclosed tube that swings out over the ocean', mat: 'slideTube', type: 'tube', color: '#29c3e6' },
  { id: 'freefall', name: 'Free Fall', blurb: 'Near-vertical drop into a runout lane', mat: 'slideLime', type: 'open', color: '#c8f04a' },
];
function slidePoints(id) {
  if (id === 'riptide') {
    const pts = [V3(-2.4, 70.75, 112), V3(0.6, 70.3, 112.3)];
    const turns = 1.75, n = 36;
    for (let i = 0; i <= n; i++) { const a = i / n * turns * TAU; pts.push(V3(-6 + 9 * Math.cos(a), lerp(69.6, 55.6, i / n), 112 + 9 * Math.sin(a))); }
    pts.push(V3(2, 54.7, 103.6), V3(8.2, 54.0, 108.5), V3(10.8, 53.4, 117), V3(9.8, 52.8, 126), V3(8, 52.32, 133.2));
    return pts;
  }
  if (id === 'abyss') return [V3(-6, 70.75, 108.3), V3(-5.6, 70.1, 105.6), V3(-2, 69.1, 102), V3(5, 67.7, 99.6), V3(14, 66.1, 99.6), V3(24, 64.4, 102.6), V3(33, 62.5, 108), V3(37.6, 60.5, 116), V3(37, 58.6, 125), V3(32, 56.9, 132.6), V3(24, 55.2, 137), V3(16.6, 53.8, 138.6), V3(12.6, 52.8, 137.7), V3(10.4, 52.35, 136.6)];
  return [V3(-9.6, 70.75, 110.5), V3(-12, 70.4, 110.3), V3(-15, 69.5, 110), V3(-18, 66.6, 109.8), V3(-20.5, 62.1, 110.3), V3(-22.5, 57.6, 112.5), V3(-23.5, 54.4, 116.5), V3(-23.6, 52.95, 121), V3(-23.5, 52.6, 126), V3(-23.5, 52.55, 133), V3(-23.5, 52.52, 141)];
}
function buildWaterpark(ship) {
  const B = new Bin();
  // splash surface overlay
  const zs = []; for (let z = 96; z <= 152; z += 2) zs.push(z);
  const wp = zs.map(z => [deckHalf(z) - 0.05, z]).concat(zs.slice().reverse().map(z => [-(deckHalf(z) - 0.05), z]));
  B.push('splash', floorGeo(wp, [TOP.splash], DK.top + 0.02));
  poolBasin(B, TOP.splash, DK.top, 1.35, { id: 'splash', name: 'Splashdown pool' });
  // runout lane
  const lane = rectPts(-25.6, 118, -21.4, 146);
  B.push('lagoon', extrudeY(lane, [rectPts(-25.2, 118.4, -21.8, 145.6)], 52, 52.6, 4));
  B.push('mosaic', floorGeo(rectPts(-25.2, 118.4, -21.8, 145.6), [], 52.1));
  FURN.waters.push(floorGeo(rectPts(-25.2, 118.4, -21.8, 145.6), [], 52.42));
  addWallPath(lane, true, 51.5, 52.7, 0.1);
  // tower
  const tx = -6, tz = 112, ty = DK.tower;
  for (const [dx, dz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) B.add('white', cyl(0.32, 0.36, ty - 52 + 5, 16), tx + dx, (52 + ty + 5) / 2, tz + dz);
  for (let y = 54; y < ty; y += 3) { const m = (y / 3) % 2 ? 'coral' : 'lagoon'; for (const [dx, dz, ry] of [[0, -3.6, 0], [0, 3.6, 0], [-3.6, 0, Math.PI / 2], [3.6, 0, Math.PI / 2]]) B.add(m, box(7.2, 0.28, 0.28), tx + dx, y, tz + dz, ry); }
  for (let k = 0; k < 6; k++) { const y0 = 52 + k * 3, a = k % 4; const pts = [[3.9, -3.9], [3.9, 3.9], [-3.9, 3.9], [-3.9, -3.9]]; const p = pts[a], q = pts[(a + 1) % 4];
    B.push('white', beamGeo(V3(tx + p[0], y0 + 0.2, tz + p[1]), V3(tx + q[0], y0 + 3.1, tz + q[1]), 0.5, 4)); }
  B.add('white', box(8.6, 0.4, 8.6), tx, ty - 0.2, tz);
  B.push('teak', floorGeo(rectPts(tx - 4.3, tz - 4.3, tx + 4.3, tz + 4.3), [], ty + 0.005));
  addFloor(rectPts(tx - 4.3, tz - 4.3, tx + 4.3, tz + 4.3), ty, 'tower', { name: 'tower' });
  const roof = new T.ConeGeometry(6.4, 3.4, 4, 1, true); roof.rotateY(Math.PI / 4);
  B.add('fabricCoral', roof, tx, ty + 6.2, tz);
  addRail(B, [[tx + 4.2, tz + 1.3], [tx + 4.2, tz + 4.2], [tx - 4.2, tz + 4.2], [tx - 4.2, tz - 0.3]], ty);
  addRail(B, [[tx - 4.2, tz - 2.7], [tx - 4.2, tz - 4.2], [tx - 1.3, tz - 4.2]], ty);
  addRail(B, [[tx + 1.3, tz - 4.2], [tx + 4.2, tz - 4.2], [tx + 4.2, tz - 1.3]], ty);
  addWall(tx + 4.5, tz - 1.4, tx + 4.5, tz + 1.4, ty - 0.5, ty + 2, 0.1);
  addWall(tx - 1.4, tz - 4.5, tx + 1.4, tz - 4.5, ty - 0.5, ty + 2, 0.1);
  addWall(tx - 4.5, tz - 2.8, tx - 4.5, tz - 0.2, ty - 0.5, ty + 2, 0.1);
  addBoxCollider(tx, tz, 4.0, 4.0, 51.5, ty - 1);
  addHotspot('tower_up', tx, DK.top, tz + 4.9, 2.4, 'Climb the slide tower', 'towerUp');
  addHotspot('tower_down', tx + 0.6, ty, tz + 3.1, 1.4, 'Take the stairs down', 'towerDown');
  // slides
  const supports = [];
  SLIDE_DEFS.forEach((def, idx) => {
    const curve = new T.CatmullRomCurve3(slidePoints(def.id), false, 'centripetal', 0.5);
    const L = curve.getLength(); const segs = Math.ceil(L * 2.2);
    if (def.type === 'tube') {
      B.push(def.mat, sweepGeo(curve, arcProfile(1.05, 0, TAU, 28), segs));
      for (let d = 2; d < L - 1; d += 2.6) {
        const t = d / L, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        const tg = new T.TorusGeometry(1.1, 0.07, 6, 28); tg.lookAt(tan); tg.translate(p.x, p.y, p.z); B.push('white', tg);
      }
    } else {
      B.push(def.mat, sweepGeo(curve, arcProfile(0.95, Math.PI * 1.06, Math.PI * 1.94, 18), segs));
      for (const ae of [Math.PI * 1.06, Math.PI * 1.94]) {
        const cx = Math.cos(ae) * 0.95, cy = Math.sin(ae) * 0.95;
        const prof = []; for (let k = 0; k <= 8; k++) { const a = k / 8 * TAU; prof.push([cx + Math.cos(a) * 0.07, cy + Math.sin(a) * 0.07]); }
        B.push('white', sweepGeo(curve, prof, segs));
      }
    }
    B.push('slideFilm', sweepGeo(curve, arcProfile(def.type === 'tube' ? 0.98 : 0.89, Math.PI * 1.36, Math.PI * 1.64, 6), segs));
    for (let d = 5; d < L - 3; d += (def.id === 'riptide' ? 5 : 8)) {
      const p = curve.getPointAt(d / L); if (p.y - 52 < 1.6) continue;
      if (def.id === 'riptide') { const r = Math.hypot(p.x + 6, p.z - 112); if (r > 7 && r < 11) { const ux = (p.x + 6) / r, uz = (p.z - 112) / r; supports.push(beamGeo(V3(-6 + ux * 3.7, p.y - 0.95, 112 + uz * 3.7), V3(p.x - ux * 0.5, p.y - 0.95, p.z - uz * 0.5), 0.13, 8)); continue; } }
      const half = deckHalf(p.z) - 0.6;
      if (Math.abs(p.x) < half) { supports.push(beamGeo(V3(p.x, 52, p.z), V3(p.x, p.y - 0.95, p.z), 0.2, 10)); addCircle(p.x, p.z, 0.28, 51.5, p.y - 1); }
      else { const ex = Math.sign(p.x) * (half - 0.3); supports.push(beamGeo(V3(ex, 52.1, p.z), V3(p.x, p.y - 0.95, p.z), 0.2, 10)); addCircle(ex, p.z, 0.3, 51.5, 54); }
    }
    const start = curve.getPointAt(0), dir = curve.getTangentAt(0);
    World.slides.push({ ...def, curve, L, start });
    addHotspot('slide_' + def.id, start.x - dir.x * 1.4, ty, start.z - dir.z * 1.4, 1.5, 'Ride ' + def.name, 'slide', { slide: idx });
  });
  B.push('white', mergeGeos(supports));
  // kids splash structure with tipping bucket
  const kx = 17, kz = 114;
  for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) { B.add(Math.abs(dx + dz) < 1 ? 'coral' : 'lagoon', cyl(0.22, 0.22, 8.2, 12), kx + dx, 56.1, kz + dz); addCircle(kx + dx, kz + dz, 0.3, 51.5, 60); }
  B.add('gold', box(5, 0.3, 5), kx, 54.4, kz);
  B.add('white', box(5.2, 0.3, 0.3), kx, 60.1, kz - 2.2); B.add('white', box(5.2, 0.3, 0.3), kx, 60.1, kz + 2.2);
  B.add('white', box(0.3, 0.3, 4.6), kx - 2.2, 60.1, kz); B.add('white', box(0.3, 0.3, 4.6), kx + 2.2, 60.1, kz);
  for (let k = 0; k < 5; k++) B.add('coral', box(1.2, 0.1, 0.6), kx + 3.0, 52.4 + k * 0.4, kz - 1.8 + k * 0.6);
  const bucket = new T.Group(); bucket.position.set(kx, 61.4, kz);
  const bk = new T.Mesh(cyl(1.35, 1.0, 1.6, 32, true), MAT.gold); bk.material = MAT.gold; bk.castShadow = true; bucket.add(bk);
  const bkB = new T.Mesh(new T.CircleGeometry(1.0, 32).rotateX(Math.PI / 2), MAT.gold); bkB.position.y = -0.8; bucket.add(bkB);
  const bkW = new T.Mesh(new T.CircleGeometry(1.25, 32).rotateX(-Math.PI / 2), G.poolMats ? G.poolMats[0] : MAT.lagoon); bkW.position.y = 0.55; bucket.add(bkW); bucket.userData.water = bkW;
  ship.add(bucket); G.bucket = bucket;
  World.bucketPos = V3(kx, 61.4, kz);
  B.build(ship, { slideTube: { cast: false }, slideFilm: { cast: false, receive: false }, splash: { cast: false } });
  World.zones.waterpark = { name: 'Splash Summit', deck: 'Deck 15 · Stern', spawn: [0, DK.top, 100, 0], level: 'd15' };
  World.spots.dance.push({ zone: 'waterpark', poly: rectPts(-6, 126, 18, 146) });
}

/* ---------------- bow lookout ---------------- */
function buildBow(ship) {
  const B = new Bin(); const y = DK.bow;
  const poly = [[0, -181.6]];
  for (let z = -181; z <= -137; z += 1) poly.push([hullHalf(z) - 0.4, z]);
  for (let z = -137; z >= -150; z -= 0.5) poly.push([Math.max(0, wallHalf(z) + 0.15), z]);
  const half = poly.slice(1);
  const full = poly.concat(half.slice().reverse().map(p => [-p[0], p[1]]).filter(p => Math.abs(p[0]) > 0.01));
  addFloor(full, y, 'bow', { name: 'bow' });
  // bulwarks
  const bw = []; for (let z = -137; z >= -181.5; z -= 1) bw.push([hullHalf(z) - 0.12, z]);
  const bwP = bw.map(p => [-p[0], p[1]]).reverse();
  const bulw = bw.concat([[0, -181.9]]).concat(bwP.slice(1));
  B.push('white', ribbonGeo(bulw, y, y + 1.3, false, 1, false));
  B.push('white', ribbonGeo(bulw, y, y + 1.3, false, 1, true));
  for (let i = 0; i < bulw.length - 1; i++) B.push('steel', beamGeo(V3(bulw[i][0], y + 1.33, bulw[i][1]), V3(bulw[i + 1][0], y + 1.33, bulw[i + 1][1]), 0.09, 6));
  addWallPath(bulw, false, y - 0.5, y + 1.5, 0.15);
  const face = []; for (let z = -137; z >= -150; z -= 0.5) face.push([wallHalf(z), z]); const faceAll = face.concat(face.slice().reverse().map(p => [-p[0], p[1]]));
  addWallPath(faceAll, false, y - 0.5, y + 6, 0.1);
  addRailSpots(bulw.filter(p => p[1] > -179), y, 'bow', 4, 0.6, 1);
  // helipad, winches, bollards
  B.add('helipad', new T.PlaneGeometry(13, 13).rotateX(-Math.PI / 2), 0, y + 0.03, -163);
  for (const s of [-1, 1]) {
    B.add('darkMetal', cyl(0.7, 0.7, 1.6, 24), s * 4.6, y + 0.9, -171.5, 0, 1, 1, 1, 0, Math.PI / 2);
    B.add('navy', box(2.2, 0.6, 1.8), s * 4.6, y + 0.3, -171.5);
    B.add('darkMetal', cyl(0.35, 0.35, 0.3, 16), s * 2.2, y + 0.15, -176);
    for (const z of [-155, -145]) for (const d of [-0.45, 0.45]) B.add('darkMetal', cyl(0.22, 0.25, 0.7, 16), s * 17.5, y + 0.35, z + d);
    addCircle(s * 4.6, -171.5, 1.2, y, y + 1.6);
    for (const z of [-155, -145]) addCircle(s * 17.5, z, 0.75, y, y + 0.8);
  }
  // jack staff + flag
  B.add('steel', cyl(0.05, 0.07, 6, 10), 0, y + 3, -180.4);
  const fg = new T.PlaneGeometry(2.4, 1.5, 16, 8); fg.translate(1.2, 0, 0);
  const flag = new T.Mesh(fg, MAT.flag); flag.position.set(0, y + 5.2, -180.4); flag.castShadow = true; ship.add(flag); G.flag = flag;
  flag.userData.base = Float32Array.from(fg.attributes.position.array);
  // elevator door on the front face
  B.add('darkGlass', box(2.4, 2.8, 0.2), 0, y + 1.4, -150.05);
  B.add('steel', box(3.0, 0.2, 0.3), 0, y + 2.95, -150.1);
  addHotspot('elev_bow', 0, y, -152.4, 2.0, 'Take the elevator', 'elevator');
  World.elevators.push({ level: 'bow', x: 0, y, z: -152.6 });
  addHotspot('bowpose', 0, y, -178.2, 2.2, 'Strike a pose at the bow', 'bowpose');
  B.build(ship);
  World.zones.bow = { name: 'Bow Lookout', deck: 'Deck 6 · Forward', spawn: [0, y, -153, Math.PI], level: 'bow' };
}

/* ---- 22_world.js ---- */
/* ================= world: physics floors, water, colliders, nav grid ================= */
const World = {
  floors: [], waters: [], walls: [], circles: [], hotspots: [], zones: {},
  spots: { loungers: [], stools: [], rails: [], benches: [], dance: [], pools: [] },
  slides: [], zip: null, grids: {}, solids: [], labels: [], elevators: [], dyn: [], tag: null,
};
function bbOf(poly, pad = 0) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of poly) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a - pad, b - pad, c + pad, d + pad]; }
function pip(x, z, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (((a[1] > z) !== (b[1] > z)) && (x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0])) ins = !ins;
  }
  return ins;
}
function addFloor(poly, y, level, o = {}) { const f = { poly, holes: o.holes || [], y, level, ramp: o.ramp || null, hfn: o.hfn || null, bb: bbOf(poly), name: o.name || '', tag: World.tag }; World.floors.push(f); return f; }
function floorY(f, x, z) { if (f.hfn) return f.hfn(x, z); if (!f.ramp) return f.y; const r = f.ramp; const t = clamp((z - r.z0) / (r.z1 - r.z0), 0, 1); return lerp(r.y0, r.y1, t); }
function removeTagged(tag) {
  World.floors = World.floors.filter(f => f.tag !== tag); World.waters = World.waters.filter(w => w.tag !== tag);
  World.walls = World.walls.filter(w => w.tag !== tag); World.circles = World.circles.filter(c => c.tag !== tag);
  World.hotspots = World.hotspots.filter(h => h.tag !== tag);
  for (const k of Object.keys(World.spots)) World.spots[k] = World.spots[k].filter(s => s.tag !== tag);
  World.elevators = World.elevators.filter(e => e.tag !== tag);
  buildHash();
}
function insideFloor(f, x, z) {
  const b = f.bb; if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) return false;
  if (!pip(x, z, f.poly)) return false;
  for (const h of f.holes) if (pip(x, z, h)) return false;
  return true;
}
function groundAt(x, z, footY, step = 0.6, level = null) {
  let best = -1e9; World._lf = null;
  for (const f of World.floors) {
    if (level && f.level !== level) continue;
    if (!insideFloor(f, x, z)) continue;
    const y = floorY(f, x, z);
    if (y <= footY + step && y > best) { best = y; World._lf = f; }
  }
  return best;
}
function topFloor(x, z, level) { return groundAt(x, z, 1e6, 0, level); }
function addWater(poly, top, bottom, o = {}) { const w = { poly, top, bottom, bb: bbOf(poly), hot: !!o.hot, id: o.id || 'pool', name: o.name || 'Pool', shallow: !!o.shallow, level: o.level || 'd15', sea: !!o.sea, tag: World.tag }; World.waters.push(w); return w; }
function waterAt(x, z, y) {
  for (const w of World.waters) {
    const b = w.bb; if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
    if (y !== undefined && (y > w.top + 1.2 || y < w.bottom - 0.5)) continue;
    if (pip(x, z, w.poly)) return w;
  }
  return null;
}
function addWall(x1, z1, x2, z2, y0, y1, r = 0.12) { World.walls.push({ x1, z1, x2, z2, y0, y1, r, s: 0, tag: World.tag }); }
function addWallPath(pts, closed, y0, y1, r = 0.12) {
  const n = pts.length; for (let i = 0; i < (closed ? n : n - 1); i++) { const a = pts[i], b = pts[(i + 1) % n]; addWall(a[0], a[1], b[0], b[1], y0, y1, r); }
}
function addCircle(x, z, r, y0, y1) { World.circles.push({ x, z, r, y0, y1, s: 0, tag: World.tag }); }
function addBoxCollider(cx, cz, hw, hd, y0, y1, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
  addWallPath(P, true, y0, y1, 0.05);
}
const HASH = { cell: 8, map: new Map(), stamp: 1 };
function hashKey(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
function buildHash() {
  HASH.map.clear();
  const put = (o, x0, z0, x1, z1) => {
    for (let ix = Math.floor(x0 / HASH.cell); ix <= Math.floor(x1 / HASH.cell); ix++)
      for (let iz = Math.floor(z0 / HASH.cell); iz <= Math.floor(z1 / HASH.cell); iz++) {
        const k = hashKey(ix, iz); let a = HASH.map.get(k); if (!a) HASH.map.set(k, a = []); a.push(o);
      }
  };
  for (const w of World.walls) put(w, Math.min(w.x1, w.x2) - w.r - 1, Math.min(w.z1, w.z2) - w.r - 1, Math.max(w.x1, w.x2) + w.r + 1, Math.max(w.z1, w.z2) + w.r + 1);
  for (const c of World.circles) put(c, c.x - c.r - 1, c.z - c.r - 1, c.x + c.r + 1, c.z + c.r + 1);
}
function nearColliders(x, z) { const a = HASH.map.get(hashKey(Math.floor(x / HASH.cell), Math.floor(z / HASH.cell))); return a || []; }
function segDist(px, pz, w) {
  const dx = w.x2 - w.x1, dz = w.z2 - w.z1; const l2 = dx * dx + dz * dz || 1e-6;
  const t = clamp(((px - w.x1) * dx + (pz - w.z1) * dz) / l2, 0, 1);
  const cx = w.x1 + dx * t, cz = w.z1 + dz * t; return [px - cx, pz - cz];
}
function collide(pos, radius, y0, y1) {
  let hit = false;
  for (let it = 0; it < 3; it++) {
    const list = World.dyn.length ? nearColliders(pos.x, pos.z).concat(World.dyn) : nearColliders(pos.x, pos.z);
    for (const o of list) {
      if (y1 < o.y0 || y0 > o.y1) continue;
      let dx, dz, minD;
      if (o.x1 !== undefined) { [dx, dz] = segDist(pos.x, pos.z, o); minD = radius + o.r; }
      else { dx = pos.x - o.x; dz = pos.z - o.z; minD = radius + o.r; }
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 1e-4; const push = minD - d;
        pos.x += dx / d * push; pos.z += dz / d * push; hit = true;
      }
    }
  }
  return hit;
}
function clearance(x, z, y0, y1, maxD = 2) {
  let best = maxD;
  for (const o of nearColliders(x, z)) {
    if (y1 < o.y0 || y0 > o.y1) continue;
    let d;
    if (o.x1 !== undefined) { const [dx, dz] = segDist(x, z, o); d = Math.hypot(dx, dz) - o.r; }
    else d = Math.hypot(x - o.x, z - o.z) - o.r;
    if (d < best) best = d;
  }
  return best;
}

/* ---------------- nav grid + A* ---------------- */
function buildNavGrid(level, x0, z0, x1, z1, cell = 1.5, clear = 0.55) {
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const ys = new Float32Array(nx * nz).fill(NaN);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
    const y = topFloor(x, z, level); if (y < -1e8) continue;
    if (waterAt(x, z)) continue;
    if (clearance(x, z, y + 0.2, y + 1.7) < clear) continue;
    ys[i + j * nx] = y;
  }
  const g = { level, x0, z0, nx, nz, cell, ys, valid: [] };
  for (let k = 0; k < ys.length; k++) if (!isNaN(ys[k])) g.valid.push(k);
  World.grids[level] = g;
  return g;
}
function gridIdx(g, x, z) { const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell); if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) return -1; return i + j * g.nx; }
function gridPos(g, k) { const i = k % g.nx, j = Math.floor(k / g.nx); return [g.x0 + (i + 0.5) * g.cell, g.ys[k], g.z0 + (j + 0.5) * g.cell]; }
function nearestValid(g, x, z, maxR = 8) {
  const k0 = gridIdx(g, x, z); if (k0 >= 0 && !isNaN(g.ys[k0])) return k0;
  const i0 = Math.floor((x - g.x0) / g.cell), j0 = Math.floor((z - g.z0) / g.cell);
  let best = -1, bd = 1e9;
  const R = Math.ceil(maxR / g.cell);
  for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) {
    const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) continue;
    const k = i + j * g.nx; if (isNaN(g.ys[k])) continue;
    const d = di * di + dj * dj; if (d < bd) { bd = d; best = k; }
  }
  return best;
}
class Heap {
  constructor() { this.a = []; this.f = []; }
  push(k, f) { const a = this.a, F = this.f; a.push(k); F.push(f); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (F[p] <= F[i]) break;[a[p], a[i]] = [a[i], a[p]];[F[p], F[i]] = [F[i], F[p]]; i = p; } }
  pop() {
    const a = this.a, F = this.f; const top = a[0]; const lk = a.pop(), lf = F.pop();
    if (a.length) { a[0] = lk; F[0] = lf; let i = 0; for (; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && F[l] < F[m]) m = l; if (r < a.length && F[r] < F[m]) m = r; if (m === i) break;[a[m], a[i]] = [a[i], a[m]];[F[m], F[i]] = [F[i], F[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}
const DIRS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
function findPath(g, sx, sz, tx, tz) {
  const s = nearestValid(g, sx, sz), t = nearestValid(g, tx, tz);
  if (s < 0 || t < 0) return null;
  if (s === t) return [gridPos(g, t)];
  const N = g.nx * g.nz;
  if (!g.gs || g.gs.length !== N) { g.gs = new Float32Array(N); g.came = new Int32Array(N); g.seen = new Uint32Array(N); g.closed = new Uint32Array(N); g.run = 0; }
  const run = ++g.run;
  const ti = t % g.nx, tj = Math.floor(t / g.nx);
  const h = k => { const i = k % g.nx, j = Math.floor(k / g.nx); const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
  const open = new Heap(); g.gs[s] = 0; g.seen[s] = run; g.came[s] = -1; open.push(s, h(s));
  let found = false, iter = 0;
  while (open.size && iter++ < 30000) {
    const k = open.pop(); if (g.closed[k] === run) continue; g.closed[k] = run;
    if (k === t) { found = true; break; }
    const i = k % g.nx, j = Math.floor(k / g.nx), yk = g.ys[k];
    for (const [di, dj, c] of DIRS8) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue;
      const n = ni + nj * g.nx; const yn = g.ys[n]; if (isNaN(yn) || Math.abs(yn - yk) > 0.7) continue;
      if (di && dj && (isNaN(g.ys[i + di + j * g.nx]) || isNaN(g.ys[i + (j + dj) * g.nx]))) continue;
      const ng = g.gs[k] + c;
      if (g.seen[n] !== run || ng < g.gs[n]) { g.seen[n] = run; g.gs[n] = ng; g.came[n] = k; open.push(n, ng + h(n)); }
    }
  }
  if (!found) return null;
  const raw = []; for (let k = t; k !== -1; k = g.came[k]) raw.push(k); raw.reverse();
  // string pulling
  const out = []; let a = 0;
  while (a < raw.length - 1) {
    let b = raw.length - 1;
    while (b > a + 1 && !gridLOS(g, raw[a], raw[b])) b--;
    out.push(gridPos(g, raw[b])); a = b;
  }
  return out;
}
function gridLOS(g, ka, kb) {
  const [ax, ay, az] = gridPos(g, ka), [bx, , bz] = gridPos(g, kb);
  const L = Math.hypot(bx - ax, bz - az); const n = Math.ceil(L / (g.cell * 0.5));
  let py = ay;
  for (let s = 1; s < n; s++) {
    const t = s / n; const k = gridIdx(g, lerp(ax, bx, t), lerp(az, bz, t));
    if (k < 0 || isNaN(g.ys[k]) || Math.abs(g.ys[k] - py) > 0.7) return false; py = g.ys[k];
  }
  return true;
}
function randomCellIn(g, poly) {
  for (let tries = 0; tries < 60; tries++) { const k = g.valid[Math.floor(Math.random() * g.valid.length)]; const [x, , z] = gridPos(g, k); if (!poly || pip(x, z, poly)) return k; }
  const bb = bbOf(poly); return nearestValid(g, (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, 20);
}

/* ---- 23_venues.js ---- */
/* ================= venues: casino, suite, surf simulator, mini golf, dome screen, snack cart ================= */
function vm(hex, o) { const m = new T.MeshStandardMaterial(o || {}); m.color.copy(lin(hex)); return m; }
function bm(hex, mult = 1, o) { const m = new T.MeshBasicMaterial(o || {}); m.color.copy(lin(hex)).multiplyScalar(mult); return m; }
function ceilGeo(pts, y) { const g = new T.ShapeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])))); g.rotateX(Math.PI / 2); g.translate(0, y, 0); return g; }
const FONT = k => getComputedStyle(document.documentElement).getPropertyValue(k === 'mono' ? '--f-mono' : k === 'body' ? '--f-body' : '--f-display');

/* ---------- slot symbols (shared by the 3D cabinets and the slot panel) ---------- */
const SLOT_SYMS = ['tile', 'seven', 'star', 'wave', 'sun', 'anchor'];
function drawSymbol(g, kind, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'tile') drawEmblem(g, -s * 0.42, -s * 0.42, s * 0.84, s * 0.07);
  else if (kind === 'seven') { g.fillStyle = '#ff6a55'; g.font = `900 ${s * 0.95}px ${FONT()}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7', 0, s * 0.04); g.strokeStyle = '#ffc95c'; g.lineWidth = s * 0.04; g.strokeText('7', 0, s * 0.04); }
  else if (kind === 'star') { g.fillStyle = '#ffc95c'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.2 : s * 0.44; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }
  else if (kind === 'wave') { g.strokeStyle = '#2fd3c6'; g.lineWidth = s * 0.11; for (const o of [-0.16, 0.12]) { g.beginPath(); for (let i = 0; i <= 20; i++) { const x = (i / 20 - 0.5) * s * 0.84; g.lineTo(x, o * s + Math.sin(i / 20 * TAU * 1.5) * s * 0.09); } g.stroke(); } }
  else if (kind === 'sun') { g.fillStyle = '#ff9f43'; g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill(); g.strokeStyle = '#ffc95c'; g.lineWidth = s * 0.06; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3); g.lineTo(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42); g.stroke(); } }
  else if (kind === 'anchor') { g.strokeStyle = '#5aa9ff'; g.lineWidth = s * 0.08; g.beginPath(); g.arc(0, -s * 0.3, s * 0.08, 0, TAU); g.moveTo(0, -s * 0.22); g.lineTo(0, s * 0.36); g.moveTo(-s * 0.18, -s * 0.1); g.lineTo(s * 0.18, -s * 0.1); g.stroke(); g.beginPath(); g.arc(0, s * 0.08, s * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
  g.restore();
}
const RL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RL_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function buildVenueTextures() {
  TEX.carpet = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#121a3a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#22306a'; g.lineWidth = 6;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(k * w, 0); g.lineTo(k * w + w, h); g.stroke(); g.beginPath(); g.moveTo(k * w + w, 0); g.lineTo(k * w, h); g.stroke(); }
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.lineTo(0, h / 2); g.closePath(); g.stroke();
    g.globalAlpha = 0.85; drawEmblem(g, w / 2 - 34, h / 2 - 34, 68, 6); for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) drawEmblem(g, x - 26, y - 26, 52, 5);
    g.globalAlpha = 1;
  });
  TEX.carpet.repeat.set(1 / 2.6, 1 / 2.6);
  TEX.slotScreen = canvasTex(512, 384, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1450'); gr.addColorStop(1, '#0b1b33'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffc95c'; g.font = `900 44px ${FONT()}`; g.textAlign = 'center'; g.fillText('TILEO SLOTS', w / 2, 58);
    const syms = ['seven', 'tile', 'star'];
    for (let i = 0; i < 3; i++) { const x = 40 + i * 148; g.fillStyle = '#f7fafc'; rr(g, x, 90, 136, 190, 14); g.fill(); drawSymbol(g, syms[i], x + 68, 185, 104); }
    g.fillStyle = '#2fd3c6'; g.font = `500 22px ${FONT('mono')}`; g.fillText('PLAY CHIPS ONLY', w / 2, 330);
  }, { repeat: false });
  TEX.rlWheel = canvasTex(512, 512, (g, w, h) => {
    const c = w / 2; g.fillStyle = '#3a2416'; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
    for (let i = 0; i < 37; i++) {
      const a0 = i / 37 * TAU - Math.PI / 2, a1 = (i + 1) / 37 * TAU - Math.PI / 2, n = RL_ORDER[i];
      g.fillStyle = n === 0 ? '#0f8a4a' : RL_RED.has(n) ? '#c8283a' : '#141418';
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, c * 0.94, a0, a1); g.closePath(); g.fill();
      g.save(); g.translate(c, c); g.rotate((a0 + a1) / 2 + Math.PI / 2); g.fillStyle = '#fff'; g.font = `700 20px ${FONT('body')}`; g.textAlign = 'center'; g.fillText(String(n), 0, -c * 0.82); g.restore();
    }
    g.fillStyle = '#5a3420'; g.beginPath(); g.arc(c, c, c * 0.62, 0, TAU); g.fill();
    g.strokeStyle = '#d9a441'; g.lineWidth = 8; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * c * 0.55, c + Math.sin(a) * c * 0.55); g.stroke(); }
    g.fillStyle = '#d9a441'; g.beginPath(); g.arc(c, c, c * 0.12, 0, TAU); g.fill();
  }, { repeat: false });
  TEX.rlLayout = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#0f6b5c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2f7fb'; g.lineWidth = 3; g.font = `700 26px ${FONT('body')}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const x0 = 120, cw = 66, ch = 100, y0 = 60;
    g.fillStyle = '#0f8a4a'; g.fillRect(x0 - 80, y0, 80, ch * 3); g.strokeRect(x0 - 80, y0, 80, ch * 3); g.fillStyle = '#fff'; g.fillText('0', x0 - 40, y0 + ch * 1.5);
    for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) { const n = c * 3 + (3 - r); const x = x0 + c * cw, y = y0 + r * ch; g.fillStyle = RL_RED.has(n) ? '#c8283a' : '#141418'; g.beginPath(); g.ellipse(x + cw / 2, y + ch / 2, 24, 24, 0, 0, TAU); g.fill(); g.strokeRect(x, y, cw, ch); g.fillStyle = '#fff'; g.fillText(String(n), x + cw / 2, y + ch / 2); }
    const labels = ['1–18', 'EVEN', 'RED', 'BLACK', 'ODD', '19–36'];
    labels.forEach((t, i) => { const x = x0 + i * cw * 2, y = y0 + ch * 3 + 12; g.strokeRect(x, y, cw * 2, 80); g.fillStyle = t === 'RED' ? '#c8283a' : t === 'BLACK' ? '#141418' : '#fff'; if (t === 'RED' || t === 'BLACK') { g.fillRect(x + 30, y + 22, cw * 2 - 60, 36); } else g.fillText(t, x + cw, y + 40); });
  }, { repeat: false });
  TEX.bjFelt = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#0f6b5c'; g.fillRect(0, 0, w, h);
    const c = w / 2; g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 6;
    g.beginPath(); g.arc(c, c, c * 0.72, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    for (let i = 0; i < 5; i++) { const a = Math.PI * (0.62 + i * 0.19); const x = c + Math.cos(a) * c * 0.84, y = c + Math.sin(a) * c * 0.84; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.strokeRect(-34, -48, 68, 96); g.restore(); }
    g.save(); g.translate(c, c); g.fillStyle = '#ffc95c'; g.font = `700 40px ${FONT('body')}`; g.textAlign = 'center';
    const txt = 'BLACKJACK PAYS 3 TO 2'; for (let i = 0; i < txt.length; i++) { const a = Math.PI * (0.78 + i / (txt.length - 1) * 0.44); g.save(); g.rotate(a); g.translate(c * 0.56, 0); g.rotate(-Math.PI / 2); g.fillText(txt[i], 0, 0); g.restore(); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `500 28px ${FONT('mono')}`; g.save(); g.translate(c * 0.62, c); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('DEALER STANDS ON 17', 0, 0); g.restore();
  }, { repeat: false });
  TEX.bjFelt.repeat.set(1 / 3.3, 1 / 3.3); TEX.bjFelt.offset.set(0.5, 0.5);
  TEX.casinoSign = canvasTex(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 120px ${FONT()}`; g.shadowColor = '#ff6a55'; g.shadowBlur = 30; g.fillStyle = '#ffd2c6'; g.fillText('TILEO', w * 0.36, h / 2 + 6);
    g.shadowColor = '#2fd3c6'; g.fillStyle = '#c9fff9'; g.font = `700 76px ${FONT()}`; g.fillText('CASINO', w * 0.77, h / 2 + 10);
  }, { repeat: false });
  TEX.wallpaper = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.05)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 12, h); g.fillStyle = 'rgba(0,0,0,.03)'; for (let i = 0; i < 2000; i++) g.fillRect(rand(0, w), rand(0, h), 1, 1); });
  TEX.wallpaper.repeat.set(1 / 1.2, 1 / 2.6);
  TEX.plush = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#ffffff', 0.06, 9000, 2)); TEX.plush.repeat.set(0.5, 0.5);
  TEX.bigTile = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9d3dc'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2); }); TEX.bigTile.repeat.set(1 / 0.8, 1 / 0.8);
  TEX.rug = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#f6efe1'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, TAU); g.fill();
    for (let r = 5; r > 0; r--) { g.strokeStyle = TILE_COLORS[r % 4]; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, r * 44, 0, TAU); g.stroke(); }
    drawEmblem(g, w / 2 - 40, h / 2 - 40, 80, 8);
  }, { repeat: false });
  TEX.art = canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#f2ece0'; g.fillRect(0, 0, w, h); const sun = g.createRadialGradient(w * 0.7, h * 0.45, 10, w * 0.7, h * 0.45, 90); sun.addColorStop(0, '#ffc95c'); sun.addColorStop(1, 'rgba(255,201,92,0)'); g.fillStyle = sun; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = TILE_COLORS[i]; g.globalAlpha = 0.8; g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.55 + i * 0.1) + Math.sin(x / 50 + i) * 12); g.lineTo(w, h); g.lineTo(0, h); g.fill(); }
    g.globalAlpha = 1;
  }, { repeat: false });
  TEX.surfFoam = canvasTex(256, 512, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${rand(0.15, 0.7)})`; const x = rand(0, w), y = rand(0, h), l = rand(20, 90); g.beginPath(); g.ellipse(x, y, rand(1.5, 5), l, 0, 0, TAU); g.fill(); } });
  TEX.surfFoam.repeat.set(2, 1.5);
  TEX.surfSign = canvasTex(1024, 192, (g, w, h) => { g.fillStyle = '#10264a'; g.fillRect(0, 0, w, h); drawEmblem(g, 30, 36, 120, 10); g.fillStyle = '#fff'; g.font = `900 92px ${FONT()}`; g.textBaseline = 'middle'; g.fillText('WAVE RIDER', 180, h / 2 + 4); g.fillStyle = '#2fd3c6'; g.font = `500 34px ${FONT('mono')}`; g.fillText('SURF SIM', 820, h / 2 + 2); }, { repeat: false });
  TEX.golfGreen = canvasTex(512, 512, (g, w, h) => { noiseFill(g, w, h, '#3f9a48', 0.07, 14000, 2); g.fillStyle = 'rgba(255,255,255,.05)'; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 32); });
  TEX.golfGreen.repeat.set(1 / 4, 1 / 4);
  TEX.golfSign = canvasTex(768, 384, (g, w, h) => { g.fillStyle = '#10264a'; rr(g, 0, 0, w, h, 30); g.fill(); drawEmblem(g, 40, 40, 110, 9); g.fillStyle = '#fff'; g.font = `900 72px ${FONT()}`; g.fillText('TILEO', 180, 120); g.fillStyle = '#7bd389'; g.fillText('LINKS', 180, 200); g.fillStyle = '#cfe0ef'; g.font = `500 34px ${FONT('mono')}`; g.fillText('MINI GOLF · 4 HOLES · PAR 11', 40, 320); }, { repeat: false });
  TEX.cartSign = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#ff6a55'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `900 58px ${FONT()}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GRILL & CHILL', w / 2, h / 2 + 4); }, { repeat: false });
  // dynamic screen (dome + suite TV)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 576;
  const st = new T.CanvasTexture(cv); st.encoding = T.sRGBEncoding; st.anisotropy = Math.min(8, G.maxAniso || 1);
  TEX.screen = st; G.screen = { cv, g: cv.getContext('2d'), tex: st, key: '' };
}

function buildVenueMaterials() {
  MAT.carpet = vm('#ffffff', { map: TEX.carpet, roughness: 0.95, envMapIntensity: 0.12 });
  MAT.casinoWall = vm('#1a2342', { roughness: 0.55, metalness: 0.2, envMapIntensity: 0.25 });
  MAT.casinoCeil = vm('#0c1226', { roughness: 0.85, envMapIntensity: 0.08 });
  MAT.brass = vm('#d9a441', { roughness: 0.28, metalness: 0.9, envMapIntensity: 0.6 });
  MAT.felt = vm('#0f6b5c', { roughness: 1, envMapIntensity: 0.05 });
  MAT.feltBJ = vm('#ffffff', { map: TEX.bjFelt, roughness: 1, envMapIntensity: 0.05 });
  MAT.feltRL = vm('#ffffff', { map: TEX.rlLayout, roughness: 1, envMapIntensity: 0.05 });
  MAT.rlWheel = vm('#ffffff', { map: TEX.rlWheel, roughness: 0.3, metalness: 0.2, envMapIntensity: 0.5 });
  MAT.wood = vm('#5a3420', { roughness: 0.45, envMapIntensity: 0.35 });
  MAT.leather = vm('#7a1f2b', { roughness: 0.5, envMapIntensity: 0.3 });
  MAT.slotBody = vm('#ffffff', { roughness: 0.35, metalness: 0.5, envMapIntensity: 0.6 });
  MAT.slotScreen = bm('#ffffff', 1.3, { map: TEX.slotScreen });
  MAT.neonA = bm('#2fd3c6', 3); MAT.neonC = bm('#ff6a55', 3); MAT.neonG = bm('#ffc95c', 2.4);
  MAT.casinoSign = bm('#ffffff', 2.4, { map: TEX.casinoSign, transparent: true, depthWrite: false });
  MAT.crystal = bm('#fff4dc', 2.2);
  MAT.wallpaper = vm('#e9e1d3', { map: TEX.wallpaper, roughness: 0.85, envMapIntensity: 0.25 });
  MAT.suiteFloor = vm('#d8cbb6', { map: TEX.plush, roughness: 0.95, envMapIntensity: 0.15 });
  MAT.bedding = vm('#f4f1e8', { roughness: 0.95, envMapIntensity: 0.2 });
  MAT.accent = vm('#10264a', { roughness: 0.85, envMapIntensity: 0.2 });
  MAT.linen = vm('#fbfaf6', { roughness: 0.95, envMapIntensity: 0.25 });
  MAT.headboard = vm('#2b3b5c', { roughness: 0.9, envMapIntensity: 0.15 });
  MAT.lampShade = vm('#fff3dc', { roughness: 0.8, emissive: lin('#ffd9a0'), emissiveIntensity: 0.4, side: T.DoubleSide });
  MAT.art = vm('#ffffff', { map: TEX.art, roughness: 0.7 });
  MAT.rug = vm('#ffffff', { map: TEX.rug, roughness: 1, transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.screen = bm('#ffffff', 1.15, { map: TEX.screen });
  MAT.surfBase = vm('#1aa6c8', { roughness: 0.06, metalness: 0.1, envMapIntensity: 1.3 });
  MAT.surfFoam = new T.MeshBasicMaterial({ map: TEX.surfFoam, transparent: true, depthWrite: false, opacity: 0.85 });
  MAT.pad = vm('#ff6a55', { roughness: 0.55 });
  MAT.surfSign = bm('#ffffff', 1.1, { map: TEX.surfSign, side: T.DoubleSide });
  MAT.golfGreen = vm('#ffffff', { map: TEX.golfGreen, roughness: 0.95, envMapIntensity: 0.15 });
  MAT.golfSign = bm('#ffffff', 1.0, { map: TEX.golfSign, side: T.DoubleSide });
  MAT.cupHole = vm('#0b0d10', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  MAT.cartSign = bm('#ffffff', 1.0, { map: TEX.cartSign, side: T.DoubleSide });
  MAT.stripesCanopy = vm('#ffffff', { map: TEX.stripes, roughness: 0.85, side: T.DoubleSide });
  MAT.aqua = bm('#57e0e6', 1.4, { transparent: true, opacity: 0.75 });
  MAT.mirror = vm('#c9d3dc', { roughness: 0.02, metalness: 1.0, envMapIntensity: 1.2 });
  MAT.glow = new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
}

function buildVenues(ship) {
  buildVenueTextures(); buildVenueMaterials();
  buildCasino(ship); buildSuite(ship); buildSurf(ship); buildGolf(ship); buildDomeScreen(ship); buildSnackCart(ship);
}

/* ---------------- casino (Deck 6, aft, indoors) ---------------- */
function buildCasino(ship) {
  const g = new T.Group(); g.name = 'casino'; ship.add(g); G.casinoGroup = g; g.visible = false;
  const C = CASINO, y = C.y, B = new Bin(), W = C.x1 - C.x0, D = C.z1 - C.z0, cz = (C.z0 + C.z1) / 2, H = C.top - y;
  const room = rectPts(C.x0, C.z0, C.x1, C.z1);
  B.push('carpet', floorGeo(room, [], y + 0.03));
  B.push('casinoCeil', ceilGeo(room, C.top));
  for (const [x, z, w, d] of [[0, C.z0 - 0.1, W + 0.4, 0.2], [0, C.z1 + 0.1, W + 0.4, 0.2], [C.x0 - 0.1, cz, 0.2, D], [C.x1 + 0.1, cz, 0.2, D]]) {
    B.add('casinoWall', box(w, H, d), x, y + H / 2, z);
    const inX = x === 0 ? 0 : (x < 0 ? 0.14 : -0.14), inZ = x === 0 ? (z < cz ? 0.14 : -0.14) : 0;
    const ww = w > 1 ? w - 0.4 : 0.06, dd = d > 1 ? d : 0.06;
    B.add('wood', box(ww, 1.1, dd), x + inX, y + 0.55, z + inZ);
    B.add('brass', box(ww, 0.05, dd), x + inX * 1.2, y + 1.12, z + inZ * 1.2);
    B.add('brass', box(ww, 0.05, dd), x + inX * 1.2, y + H - 0.55, z + inZ * 1.2);
    B.add('neonA', box(w > 1 ? w - 0.5 : 0.04, 0.05, d > 1 ? d - 0.5 : 0.04), x + inX * 1.4, y + H - 0.12, z + inZ * 1.4);
  }
  // ceiling coffers + neon rings over the tables
  for (let x = C.x0 + 4; x < C.x1; x += 4) B.add('brass', box(0.12, 0.12, D), x, C.top - 0.06, cz);
  for (let z = C.z0 + 4; z < C.z1; z += 4) B.add('brass', box(W, 0.12, 0.12), 0, C.top - 0.06, z);
  for (const [x, z, m] of [[5, 76.5, 'neonC'], [5, 86.5, 'neonC'], [-5, 81.5, 'neonA']]) B.add(m, new T.TorusGeometry(2.1, 0.05, 8, 64), x, C.top - 0.15, z, 0, 1, 1, 1, Math.PI / 2);
  // chandeliers
  const cr = [];
  for (const z of [74, 82, 90]) {
    B.add('brass', new T.TorusGeometry(0.9, 0.04, 8, 48), 0, C.top - 0.9, z, 0, 1, 1, 1, Math.PI / 2);
    B.add('brass', cyl(0.02, 0.02, 0.8, 6), 0, C.top - 0.45, z);
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, r = 0.25 + (i % 3) * 0.3; const gg = new T.IcosahedronGeometry(0.07, 0); gg.translate(Math.cos(a) * r, C.top - 1.0 - (i % 4) * 0.12, z + Math.sin(a) * r); cr.push(gg); }
  }
  B.push('crystal', mergeGeos(cr));
  // sign + elevators
  B.add('casinoSign', new T.PlaneGeometry(7.2, 1.8), 0, y + 4.35, C.z0 + 0.08);
  for (const x of [-1.7, 1.7]) { B.add('darkGlass', box(1.5, 2.6, 0.06), x, y + 1.3, C.z1 - 0.04); B.add('brass', box(1.7, 0.1, 0.08), x, y + 2.68, C.z1 - 0.05); }
  World.elevators.push({ level: 'casino', x: 0, y, z: 95.6 });
  addHotspot('elev_casino', 0, y, 96.0, 2.0, 'Take the elevator', 'elevator');
  // slot banks along both side walls
  const cab = mergeGeos([(() => { const b = box(0.95, 1.05, 0.75); b.translate(0, 0.52, 0); return b; })(), (() => { const b = box(0.9, 0.95, 0.5); b.translate(0, 1.5, -0.12); return b; })(), (() => { const b = cyl(0.45, 0.45, 0.5, 20, false); b.rotateX(Math.PI / 2); b.scale(1, 0.55, 1); b.translate(0, 1.98, -0.12); return b; })(), (() => { const b = box(0.95, 0.06, 0.32); b.rotateX(-0.25); b.translate(0, 1.08, 0.3); return b; })()]);
  const scr = new T.PlaneGeometry(0.72, 0.54); scr.rotateX(-0.08); scr.translate(0, 1.52, 0.135);
  const topper = new T.PlaneGeometry(0.78, 0.2); topper.translate(0, 2.08, 0.135);
  const mats = [], cols = [], tops = [];
  let si = 0;
  for (const side of [-1, 1]) for (let z = 71.4; z <= 93.5; z += 2.2) {
    const x = side * 14.95, ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    mats.push(mtx(x, y, z, ry)); cols.push(new T.Color(si % 3 === 0 ? '#ff6a55' : si % 3 === 1 ? '#10264a' : '#2fd3c6'));
    const sx = side * 13.6;
    addStool(sx, y, z, side < 0 ? -Math.PI / 2 : Math.PI / 2, 'slots', 'casino');
    addHotspot('slot_' + si, sx, y, z, 0.95, 'Play the slots', 'slots');
    si++;
  }
  g.add(instanced(cab, MAT.slotBody, mats, { cast: true, colors: cols }));
  g.add(instanced(scr, MAT.slotScreen, mats));
  g.add(instanced(topper, MAT.neonG, mats));
  for (const s of [-1, 1]) addWall(s * 14.5, 70.2, s * 14.5, 94.7, y - 0.5, y + 2.3, 0.06);
  // blackjack tables (curved side faces -x, dealer at +x)
  for (const tz of [76.5, 86.5]) {
    const tx = 5;
    const half = []; for (let i = 0; i <= 32; i++) { const a = Math.PI / 2 + i / 32 * Math.PI; half.push([Math.cos(a) * 1.62, Math.sin(a) * 1.62]); }
    const felt = floorGeo(half, [], 0); B.add('feltBJ', felt, tx, y + 0.86, tz);
    B.add('leather', new T.TorusGeometry(1.64, 0.075, 8, 40, Math.PI), tx, y + 0.86, tz, Math.PI / 2, 1, 1, 1, -Math.PI / 2);
    B.add('wood', new T.CylinderGeometry(1.62, 1.62, 0.12, 40, 1, false, Math.PI, Math.PI), tx, y + 0.78, tz);
    B.add('wood', box(0.3, 0.14, 3.24), tx + 0.12, y + 0.86, tz);
    B.add('darkMetal', cyl(0.25, 0.4, 0.75, 16), tx - 0.3, y + 0.37, tz);
    for (let k = 0; k < 6; k++) B.add(['coral', 'navy', 'gold', 'lagoon', 'white', 'coral'][k], cyl(0.035, 0.035, 0.12, 12), tx + 0.05, y + 0.97, tz - 0.4 + k * 0.16);
    B.add('navy', box(0.25, 0.14, 0.18), tx + 0.05, y + 0.99, tz + 0.75);
    for (let k = 0; k < 5; k++) { const ph = (k - 2) * 0.48; const sx = tx - 2.15 * Math.cos(ph), sz = tz + 2.15 * Math.sin(ph); addStool(sx, y, sz, Math.atan2(tx - sx, tz - sz), 'bj', 'casino'); }
    addCircle(tx - 0.35, tz, 1.4, y - 0.5, y + 1.1);
    addHotspot('bj_' + tz, tx - 2.4, y, tz, 2.6, 'Play blackjack', 'blackjack');
    World.bartenders.push({ x: tx + 0.75, z: tz, ry: -Math.PI / 2, y, kind: 'dealer' });
  }
  // roulette
  { const tx = -5, tz = 81.5;
    B.add('wood', box(1.9, 0.78, 3.9), tx, y + 0.39, tz);
    const lay = new T.PlaneGeometry(3.0, 1.55); const uv = lay.attributes.uv; lay.rotateX(-Math.PI / 2); lay.rotateY(Math.PI / 2);
    B.add('feltRL', lay, tx, y + 0.795, tz - 0.4);
    B.add('leather', box(2.0, 0.08, 0.12), tx, y + 0.82, tz - 1.95); B.add('leather', box(0.12, 0.08, 4.0), tx - 0.98, y + 0.82, tz); B.add('leather', box(0.12, 0.08, 4.0), tx + 0.98, y + 0.82, tz);
    B.add('wood', cyl(0.72, 0.62, 0.22, 48), tx, y + 0.89, tz + 1.35);
    const wheel = new T.Group(); wheel.position.set(tx, y + 0.98, tz + 1.35);
    const disc = new T.Mesh(new T.CircleGeometry(0.62, 64), MAT.rlWheel); disc.rotation.x = -Math.PI / 2; wheel.add(disc);
    const hub = new T.Mesh(new T.ConeGeometry(0.1, 0.16, 16), MAT.brass); hub.position.y = 0.08; wheel.add(hub);
    const ball = new T.Mesh(new T.SphereGeometry(0.025, 12, 8), MAT.white); ball.position.set(0.5, 0.03, 0); g.add(wheel); wheel.add(ball);
    G.rlWheel = { wheel, ball, spin: 0.3, ballA: 0, ballR: 0.5 };
    for (const [sx, sz] of [[tx - 1.35, tz - 1.3], [tx - 1.35, tz - 0.1], [tx + 1.35, tz - 1.3], [tx + 1.35, tz - 0.1]]) addStool(sx, y, sz, sx < tx ? Math.PI / 2 : -Math.PI / 2, 'rl', 'casino');
    addBoxCollider(tx, tz, 1.0, 2.0, y - 0.5, y + 1.1);
    addHotspot('roulette', tx, y, tz - 2.6, 2.4, 'Play roulette', 'roulette');
    World.bartenders.push({ x: tx, z: tz + 2.45, ry: Math.PI, y, kind: 'dealer' });
  }
  // Lucky Tile Bar along the fore wall
  B.add('mosaic', box(12, 1.06, 0.8), 0, y + 0.53, 70.7); B.add('brass', box(12.3, 0.07, 1.0), 0, y + 1.1, 70.7);
  B.add('mirror', box(11, 1.6, 0.04), 0, y + 2.1, 68.14);
  for (let k = 0; k < 22; k++) B.add('bottle', tint(cyl(0.06, 0.07, 0.34, 8), pick(['#2fd3c6', '#ff6a55', '#ffc95c', '#9be37a', '#f2f5f8', '#5aa9ff', '#b18cff'])), -5.2 + (k % 11) * 1.04, y + 1.55 + Math.floor(k / 11) * 0.62, 68.32);
  for (const yy of [1.33, 1.95]) B.add('brass', box(11, 0.04, 0.3), 0, y + yy, 68.3);
  for (let k = 0; k < 8; k++) addStool(-5.25 + k * 1.5, y, 72.0, Math.PI, 'casinobar', 'casino');
  addBoxCollider(0, 70.7, 6.15, 0.5, y - 0.5, y + 1.2);
  addHotspot('bar_casino', 0, y, 72.6, 3.2, 'Order at the Lucky Tile Bar', 'menu', { venue: 'casinobar' });
  World.bartenders.push({ x: 0, z: 69.6, ry: 0, y });
  // columns
  for (const [x, z] of [[-9.6, 72.5], [9.6, 72.5], [-9.6, 91], [9.6, 91]]) { B.add('casinoWall', cyl(0.42, 0.42, H, 24), x, y + H / 2, z); B.add('brass', cyl(0.46, 0.46, 0.12, 24), x, y + 0.06, z); B.add('brass', cyl(0.46, 0.46, 0.12, 24), x, y + H - 0.06, z); B.add('neonC', cyl(0.44, 0.44, 0.04, 24), x, y + 2.2, z); addCircle(x, z, 0.5, y - 0.5, y + H); }
  addWallPath(room, true, y - 0.5, y + H + 0.5, 0.12);
  addFloor(room, y + 0.03, 'casino', { name: 'casino' });
  B.build(g, { casinoSign: { cast: false }, neonA: { cast: false }, neonC: { cast: false }, crystal: { cast: false }, carpet: { cast: false }, casinoCeil: { cast: false } });
  World.zones.casino = { name: 'Tileo Casino', deck: 'Deck 6 · Aft', spawn: [0, y, 95.2, Math.PI], level: 'casino' };
}

/* ---------------- your suite (Deck 12, starboard aft, balcony) ---------------- */
function buildSuite(ship) {
  const S = SUITE, y = S.y, g = new T.Group(); g.name = 'suite'; ship.add(g); G.suiteGroup = g;
  const B = new Bin(), cx = (S.x0 + S.x1) / 2, cz = (S.z0 + S.z1) / 2, W = S.z1 - S.z0, D = S.x1 - S.x0, H = S.top - y;
  const room = rectPts(S.x0, S.z0, S.x1, S.z1);
  const fl = new T.Mesh(floorGeo(room, [], y + 0.015), MAT.suiteFloor); fl.receiveShadow = true; g.add(fl); G.suiteFloorMesh = fl;
  const ceil = new T.Group(); g.add(ceil); G.suiteCeil = ceil;
  { const cm = new T.Mesh(ceilGeo(room, S.top), MAT.white); cm.receiveShadow = true; cm.castShadow = true; ceil.add(cm); }
  B.add('wallpaper', box(0.15, H, W + 0.3), S.x0 - 0.075, y + H / 2, cz);
  B.add('wallpaper', box(D + 0.15, H, 0.15), cx, y + H / 2, S.z0 - 0.075);
  B.add('wallpaper', box(D + 0.15, H, 0.15), cx, y + H / 2, S.z1 + 0.075);
  B.add('white', box(0.04, 0.12, W), S.x0 + 0.02, y + 0.06, cz); B.add('white', box(D, 0.12, 0.04), cx, y + 0.06, S.z0 + 0.02); B.add('white', box(D, 0.12, 0.04), cx, y + 0.06, S.z1 - 0.02);
  for (const z of [cz - 2.6, cz + 2.6]) for (const x of [S.x0 + 2.4, S.x0 + 6.4]) { const l = new T.Mesh(new T.CircleGeometry(0.16, 20).rotateX(Math.PI / 2), MAT.lamp); l.position.set(x, S.top - 0.01, z); ceil.add(l); }
  // glass facade with an open sliding door
  for (const z of [S.z0 + 0.05, cz - 3.0, cz - 1.25, cz + 1.25, cz + 3.0, S.z1 - 0.05]) B.add('frame', box(0.1, H, 0.1), S.x1, y + H / 2, z);
  B.add('frame', box(0.12, 0.12, W), S.x1, S.top - 0.06, cz); B.add('frame', box(0.12, 0.06, W), S.x1, y + 0.03, cz);
  for (const [z0, z1] of [[S.z0, cz - 3.0], [cz - 3.0, cz - 1.25], [cz + 1.25, cz + 3.0], [cz + 3.0, S.z1]]) B.add('glass', box(0.03, H - 0.15, z1 - z0 - 0.1), S.x1, y + H / 2, (z0 + z1) / 2);
  B.add('glass', box(0.03, H - 0.15, 1.65), S.x1 - 0.08, y + H / 2, cz - 2.2);
  // balcony
  addRail(B, [[30.88, S.z0], [30.88, S.z1]], y);
  for (const z of [S.z0, S.z1]) { B.add('white', box(2.0, 2.68, 0.1), 30.0, y + 1.34, z); addWall(29, z, 31, z, y - 0.5, y + 2.7, 0.08); }
  loungerGeos();
  for (const z of [cz - 2.6, cz + 2.6]) { B.add('frame', GEO.loungerFrame, 30.0, y, z, Math.PI, 1, 1, 1); B.add('accent', GEO.loungerCushion, 30.0, y, z, Math.PI); }
  B.add('frame', cyl(0.3, 0.3, 0.04, 20), 30.2, y + 0.5, cz); B.add('steel', cyl(0.03, 0.03, 0.5, 8), 30.2, y + 0.25, cz);
  // bed against the back wall
  const bx = S.x0 + 1.3;
  B.add('wood', box(2.3, 0.32, 2.2), bx, y + 0.2, cz); B.add('linen', box(2.18, 0.28, 2.06), bx, y + 0.5, cz);
  B.add('bedding', box(1.55, 0.13, 2.12), bx + 0.36, y + 0.68, cz); B.add('accent', box(0.45, 0.14, 2.14), bx + 0.85, y + 0.69, cz);
  for (const dz of [-0.5, 0.5]) { const p = new T.SphereGeometry(0.3, 18, 12); p.scale(0.7, 0.32, 1.3); B.add('linen', p, S.x0 + 0.48, y + 0.75, cz + dz); }
  B.add('headboard', box(0.14, 1.4, 2.5), S.x0 + 0.08, y + 0.95, cz);
  for (const s of [-1, 1]) {
    const nz = cz + s * 1.55; B.add('wood', box(0.5, 0.55, 0.5), S.x0 + 0.32, y + 0.28, nz);
    B.add('brass', cyl(0.07, 0.1, 0.3, 12), S.x0 + 0.32, y + 0.7, nz); B.add('lampShade', cyl(0.13, 0.19, 0.24, 20, true), S.x0 + 0.32, y + 0.95, nz);
    addBoxCollider(S.x0 + 0.32, nz, 0.27, 0.27, y - 0.5, y + 0.8);
  }
  B.add('art', new T.PlaneGeometry(1.8, 1.35), S.x0 + 0.02, y + 2.05, cz, Math.PI / 2);
  addBoxCollider(bx, cz, 1.18, 1.13, y - 0.5, y + 0.9);
  // wardrobe + bathroom door on the forward wall, desk + TV on the aft wall
  B.add('wood', box(1.7, 2.35, 0.62), S.x0 + 3.6, y + 1.18, S.z0 + 0.33); B.add('brass', box(0.03, 0.4, 0.03), S.x0 + 3.55, y + 1.2, S.z0 + 0.66); B.add('brass', box(0.03, 0.4, 0.03), S.x0 + 3.65, y + 1.2, S.z0 + 0.66);
  addBoxCollider(S.x0 + 3.6, S.z0 + 0.33, 0.87, 0.33, y - 0.5, y + 2.4);
  B.add('white', box(0.95, 2.15, 0.05), S.x0 + 5.9, y + 1.08, S.z0 + 0.03); B.add('brass', box(0.12, 0.03, 0.04), S.x0 + 5.6, y + 1.05, S.z0 + 0.07);
  B.add('wood', box(1.7, 0.05, 0.55), S.x0 + 4.3, y + 0.76, S.z1 - 0.3); for (const dx of [-0.8, 0.8]) B.add('wood', box(0.05, 0.74, 0.5), S.x0 + 4.3 + dx, y + 0.37, S.z1 - 0.3);
  addBoxCollider(S.x0 + 4.3, S.z1 - 0.3, 0.86, 0.3, y - 0.5, y + 0.8);
  B.add('darkMetal', box(1.62, 0.94, 0.05), S.x0 + 4.3, y + 1.72, S.z1 - 0.04);
  B.add('screen', new T.PlaneGeometry(1.52, 0.855), S.x0 + 4.3, y + 1.72, S.z1 - 0.07, Math.PI);
  // corridor door
  B.add('wood', box(0.06, 2.15, 0.98), S.x0 + 0.03, y + 1.08, S.z0 + 1.25); B.add('brass', box(0.04, 0.03, 0.14), S.x0 + 0.08, y + 1.05, S.z0 + 0.9);
  addHotspot('suite_exit', S.x0 + 0.9, y, S.z0 + 1.25, 1.1, 'Leave your suite', 'suiteExit');
  addHotspot('suite_tv', S.x0 + 4.3, y, S.z1 - 1.2, 1.0, 'Play music in your suite', 'music');
  addHotspot('suite_phone', S.x0 + 0.95, y, cz - 1.55, 0.9, 'Order room service', 'menu', { venue: 'room' });
  // colliders for walls with the facade opening
  addWall(S.x0, S.z0, S.x0, S.z1, y - 0.5, y + 3, 0.1); addWall(S.x0, S.z0, S.x1, S.z0, y - 0.5, y + 3, 0.1); addWall(S.x0, S.z1, S.x1, S.z1, y - 0.5, y + 3, 0.1);
  addWall(S.x1, S.z0, S.x1, cz - 1.25, y - 0.5, y + 3, 0.08); addWall(S.x1, cz + 1.25, S.x1, S.z1, y - 0.5, y + 3, 0.08);
  addFloor(room, y, 'suite', { name: 'suite' }); addFloor(rectPts(S.x1, S.z0, 30.9, S.z1), y, 'suite', { name: 'suiteBalcony' });
  B.build(g, { glass: { cast: false }, lamp: { cast: false }, screen: { cast: false } });
  const deco = new T.Group(); g.add(deco); G.suiteDecor = deco;
  World.zones.suite = { name: 'Your Suite', deck: 'Deck 12 · Balcony', spawn: [S.x0 + 1.1, y, S.z0 + 1.3, Math.PI / 2], level: 'suite' };
}

/* ---------------- Wave Rider surf simulator (Deck 15, starboard canyon) ---------------- */
const SURF = { x0: 17.4, x1: 27.6, zb: -15, zt: -1, yb: 52.25, yt: 54.85 };
function surfY(t) { t = clamp(t, 0, 1); return SURF.yb + (SURF.yt - SURF.yb) * t * t * (1.4 - 0.4 * t); }
function buildSurf(ship) {
  const B = new Bin(), S = SURF, cx = (S.x0 + S.x1) / 2, L = S.zt - S.zb, Wd = S.x1 - S.x0;
  const sheet = (off, nx, nz) => {
    const P = [], U = [], I = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const t = j / nz, x = S.x0 + Wd * i / nx; P.push(x, surfY(t) + off, S.zb + L * t); U.push(i / nx * Wd / 4, t * L / 4); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; I.push(a, c, b, b, c, d); }
    const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); gg.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); gg.setIndex(I); gg.computeVertexNormals(); return gg;
  };
  B.push('surfBase', sheet(0, 10, 40));
  const foam = new T.Mesh(sheet(0.035, 10, 40), MAT.surfFoam); foam.renderOrder = 3; ship.add(foam); G.surfFoam = foam;
  // solid body under the wave + padded side walls
  const prof = [[S.zb, 52]]; for (let j = 0; j <= 30; j++) { const t = j / 30; prof.push([S.zb + L * t, surfY(t)]); } prof.push([S.zt, 52]);
  const body = new T.ExtrudeGeometry(new T.Shape(prof.map(p => new T.Vector2(p[0], p[1]))), { depth: Wd, bevelEnabled: false, curveSegments: 4 });
  body.rotateY(-Math.PI / 2); body.translate(S.x0 + Wd, 0, 0); B.push('white', body);
  const wprof = [[S.zb - 0.4, 52]]; for (let j = 0; j <= 30; j++) { const t = j / 30; wprof.push([S.zb + L * t, surfY(t) + 0.9]); } wprof.push([S.zt + 4, S.yt + 0.9], [S.zt + 4, 52]);
  for (const x of [S.x0 - 0.4, S.x1]) { const wg = new T.ExtrudeGeometry(new T.Shape(wprof.map(p => new T.Vector2(p[0], p[1]))), { depth: 0.4, bevelEnabled: false, curveSegments: 4 }); wg.rotateY(-Math.PI / 2); wg.translate(x + 0.4, 0, 0); B.push('pad', wg); }
  B.add('pad', box(Wd + 0.8, 1.3, 0.45), cx, 52.65, S.zb - 0.2);
  for (let i = 0; i < 6; i++) B.add('darkMetal', box(1.1, 0.12, 0.06), S.x0 + 0.9 + i * 1.7, 52.55, S.zb + 0.04);
  B.add('white', box(Wd, S.yt - 52, 4), cx, (S.yt + 52) / 2 - 0.01, S.zt + 2);
  for (let i = 0; i < 12; i++) B.add('darkMetal', box(Wd - 0.4, 0.03, 0.06), cx, S.yt + 0.005, S.zt + 0.25 + i * 0.12);
  B.add('teak', floorGeo(rectPts(S.x0, S.zt + 1.7, S.x1, S.zt + 4), [], S.yt + 0.006));
  addRail(B, [[S.x0 - 0.2, S.zt + 4.05], [S.x1 + 0.2, S.zt + 4.05]], S.yt, { collide: false });
  // sign on a truss over the platform
  for (const x of [S.x0 - 0.25, S.x1 + 0.25]) B.add('steel', cyl(0.12, 0.12, 4.6, 12), x, S.yt + 2.3, S.zt + 3.2);
  B.add('steel', box(Wd + 0.8, 0.22, 0.22), cx, S.yt + 4.5, S.zt + 3.2);
  B.add('surfSign', new T.PlaneGeometry(7.4, 1.38), cx, S.yt + 3.6, S.zt + 3.12);
  addBoxCollider(cx, (S.zb - 0.5 + S.zt + 4.2) / 2, Wd / 2 + 0.45, (S.zt + 4.7 - S.zb) / 2, 51.5, 56.5);
  addHotspot('surf', S.x0 - 1.4, DK.top, (S.zb + S.zt) / 2, 2.2, 'Ride the Wave Rider', 'surf');
  addRailSpots([[S.x0 - 1.0, S.zb + 1], [S.x0 - 1.0, S.zt - 1]], DK.top, 'd15', 3, -0.35, 1);
  B.build(ship, { surfBase: { cast: false } });
  const board = new T.Group();
  const bg = new T.SphereGeometry(1, 24, 10); bg.scale(0.3, 0.045, 1.0); const bmesh = new T.Mesh(bg, MAT.coral); bmesh.castShadow = true; board.add(bmesh);
  const stripe = new T.Mesh(box(0.06, 0.092, 1.7), MAT.white); board.add(stripe);
  board.visible = false; G.scene.add(board); G.surfBoard = board;
  World.zones.surf = { name: 'Wave Rider', deck: 'Deck 15 · Canyon Walk', spawn: [S.x0 - 1.6, DK.top, (S.zb + S.zt) / 2, -Math.PI / 2], level: 'd15' };
}

/* ---------------- Tileo Links mini golf (Deck 15, port canyon) ---------------- */
const GOLF = { y: DK.top + 0.1, holes: [] };
function buildGolf(ship) {
  const B = new Bin(), gy = GOLF.y;
  const H = [
    { name: 'Straight Shot', par: 2, poly: rectPts(-27.5, -30, -24.5, -17), tee: [-26, -18.3], cup: [-26, -28.6], blocks: [[-26, -24, 0.55, 0.28]] },
    { name: 'Dogleg', par: 3, poly: [[-22.5, -17], [-19.5, -17], [-19.5, -26], [-15, -26], [-15, -30], [-22.5, -30]], tee: [-21, -18.3], cup: [-16.2, -28.1], blocks: [] },
    { name: 'Tile Mill', par: 3, poly: rectPts(-27.5, 18, -23.5, 34), tee: [-25.5, 32.7], cup: [-25.5, 19.6], blocks: [[-26.95, 26, 0.55, 0.15], [-24.05, 26, 0.55, 0.15]], mill: { x: -25.5, z: 26, r: 0.74, w: 1.9 } },
    { name: 'Lagoon', par: 3, poly: rectPts(-21.5, 18, -15, 34), tee: [-18.2, 32.7], cup: [-17.2, 19.9], blocks: [], pond: { x: -18.2, z: 26.2, rx: 2.1, rz: 1.5 } },
  ];
  for (const h of H) {
    const holes = []; if (h.pond) holes.push(ellipsePts(h.pond.x, h.pond.z, h.pond.rx, h.pond.rz, 40));
    B.push('golfGreen', floorGeo(h.poly, holes, gy));
    B.push('white', extrudeY(h.poly, [], DK.top, gy - 0.004, 8));
    h.segs = [];
    const n = h.poly.length;
    for (let i = 0; i < n; i++) {
      const a = h.poly[i], b = h.poly[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      B.add('teak', box(len + 0.14, 0.2, 0.14), (a[0] + b[0]) / 2, gy + 0.1, (a[1] + b[1]) / 2, ry);
      B.add('coral', box(len + 0.16, 0.03, 0.16), (a[0] + b[0]) / 2, gy + 0.215, (a[1] + b[1]) / 2, ry);
      h.segs.push([a[0], a[1], b[0], b[1]]);
    }
    for (const [x, z, hw, hd] of h.blocks) {
      B.add('lagoon', box(hw * 2, 0.3, hd * 2), x, gy + 0.15, z); B.add('white', box(hw * 2 + 0.04, 0.03, hd * 2 + 0.04), x, gy + 0.31, z);
      const P = [[x - hw, z - hd], [x + hw, z - hd], [x + hw, z + hd], [x - hw, z + hd]]; for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; h.segs.push([a[0], a[1], b[0], b[1]]); }
    }
    if (h.pond) {
      const w = addWater(ellipsePts(h.pond.x, h.pond.z, h.pond.rx, h.pond.rz, 32), gy - 0.06, gy - 0.4, { id: 'golfpond', name: 'Pond', shallow: true });
      FURN.waters.push(floorGeo(ellipsePts(h.pond.x, h.pond.z, h.pond.rx, h.pond.rz, 40), [], gy - 0.05));
      B.push('mosaicDark', floorGeo(ellipsePts(h.pond.x, h.pond.z, h.pond.rx, h.pond.rz, 40), [], gy - 0.35));
      B.push('mosaicDark', inwardRibbon(ellipsePts(h.pond.x, h.pond.z, h.pond.rx, h.pond.rz, 40), gy - 0.35, gy));
      for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; B.add('white', new T.DodecahedronGeometry(0.11, 0), h.pond.x + Math.cos(a) * (h.pond.rx + 0.05), gy + 0.02, h.pond.z + Math.sin(a) * (h.pond.rz + 0.05), a, 1, 0.5, 1); }
      w.golf = true;
    }
    if (h.mill) {
      B.add('white', cyl(0.13, 0.15, 1.1, 16), h.mill.x, gy + 0.55, h.mill.z); B.add('coral', new T.ConeGeometry(0.32, 0.4, 4), h.mill.x, gy + 1.3, h.mill.z, Math.PI / 4);
      const mill = new T.Group(); mill.position.set(h.mill.x, gy + 0.14, h.mill.z);
      for (let k = 0; k < 4; k++) { const bl = new T.Mesh(box(h.mill.r, 0.16, 0.1), k % 2 ? MAT.coral : MAT.lagoon); bl.position.x = h.mill.r / 2 + 0.12; const piv = new T.Object3D(); piv.rotation.y = k * Math.PI / 2; piv.add(bl); bl.castShadow = true; mill.add(piv); }
      ship.add(mill); h.mill.obj = mill; h.mill.a = 0;
    }
    B.add('cupHole', new T.CircleGeometry(0.075, 24).rotateX(-Math.PI / 2), h.cup[0], gy + 0.003, h.cup[1]);
    B.add('steel', cyl(0.01, 0.01, 1.3, 6), h.cup[0], gy + 0.65, h.cup[1]);
    const fg = new T.PlaneGeometry(0.42, 0.28); fg.translate(0.21, 0, 0); B.add('flag', fg, h.cup[0], gy + 1.15, h.cup[1]);
    B.add('navy', box(0.7, 0.012, 0.7), h.tee[0], gy + 0.006, h.tee[1]);
    const bb = bbOf(h.poly); addBoxCollider((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, (bb[2] - bb[0]) / 2 + 0.08, (bb[3] - bb[1]) / 2 + 0.08, 51.5, 52.4);
    GOLF.holes.push(h);
  }
  // sign
  B.add('steel', cyl(0.06, 0.06, 2.2, 10), -22.0, 53.1, -15.2); B.add('golfSign', new T.PlaneGeometry(1.9, 0.95), -22.0, 54.3, -15.2, Math.PI);
  addHotspot('golf', -22, DK.top, -14.4, 2.4, 'Play Tileo Links mini golf', 'golf');
  World.spots.golf = [];
  for (const h of H) World.spots.golf.push({ x: h.tee[0] + 0.5, y: DK.top, z: h.tee[1] + (h.tee[1] < 0 ? 1.6 : -1.6), ry: h.tee[1] < 0 ? Math.PI : 0, level: 'd15', taken: null });
  B.build(ship, { golfGreen: { cast: false } });
  const ball = new T.Mesh(new T.SphereGeometry(0.05, 18, 12), vm('#f7f7f2', { roughness: 0.35 })); ball.castShadow = true; ball.visible = false; G.scene.add(ball); GOLF.ball = ball;
  const arrow = new T.Mesh(new T.PlaneGeometry(0.06, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })); arrow.visible = false; G.scene.add(arrow); GOLF.arrow = arrow;
  World.zones.golf = { name: 'Tileo Links', deck: 'Deck 15 · Canyon Walk', spawn: [-22, DK.top, -13.6, Math.PI], level: 'd15' };
}

/* ---------------- dome LED screen + trivia podium ---------------- */
function buildDomeScreen(ship) {
  const B = new Bin();
  B.add('darkMetal', box(5.0, 2.85, 0.12), 0, 56.7, -119.82);
  B.add('screen', new T.PlaneGeometry(4.8, 2.7), 0, 56.7, -119.75);
  for (const x of [-2.2, 2.2]) B.add('steel', cyl(0.02, 0.02, 1.2, 6), x, 58.6, -119.75);
  B.add('navy', box(0.8, 1.15, 0.55), -5.4, 52.575, -115.1); B.add('coral', box(0.84, 0.06, 0.6), -5.4, 53.17, -115.1);
  B.add('screen', new T.PlaneGeometry(0.62, 0.35).rotateX(-0.5), -5.4, 53.25, -114.86);
  addBoxCollider(-5.4, -115.1, 0.42, 0.3, 51.5, 53.3);
  addHotspot('trivia', -5.4, DK.top, -114.0, 1.6, 'Play Tileo trivia', 'trivia');
  World.bartenders.push({ x: -5.4, z: -115.85, ry: 0, y: DK.top, kind: 'host' });
  B.build(ship, { screen: { cast: false } });
}

/* ---------------- Grill & Chill snack cart (pool deck) ---------------- */
function buildSnackCart(ship) {
  const B = new Bin(), x = -16, z = -46.5, y = DK.top;
  B.add('white', box(2.0, 0.95, 0.9), x, y + 0.6, z); B.add('coral', box(2.02, 0.16, 0.92), x, y + 0.85, z); B.add('steel', box(2.1, 0.05, 1.0), x, y + 1.1, z);
  for (const dx of [-0.75, 0.75]) B.add('rubber', cyl(0.2, 0.2, 0.08, 16), x + dx, y + 0.2, z + 0.47, 0, 1, 1, 1, Math.PI / 2);
  B.add('steel', cyl(0.025, 0.025, 2.2, 8), x, y + 2.1, z);
  const canopy = new T.ConeGeometry(1.5, 0.55, 16, 1, true); B.add('stripesCanopy', canopy, x, y + 3.05, z);
  B.add('cartSign', new T.PlaneGeometry(1.8, 0.45), x, y + 1.4, z + 0.46);
  B.add('darkMetal', box(0.8, 0.08, 0.5), x - 0.4, y + 1.16, z); B.add('bottle', tint(cyl(0.05, 0.05, 0.2, 8), '#ffc95c'), x + 0.6, y + 1.23, z - 0.2);
  addBoxCollider(x, z, 1.05, 0.5, 51.5, 53.3);
  addHotspot('cart', x, y, z + 1.4, 2.0, 'Order at Grill & Chill', 'menu', { venue: 'cart' });
  World.bartenders.push({ x, z: z - 0.95, ry: 0, y });
  B.build(ship);
}

/* ---- 24_ports.js ---- */
/* ================= ports of call: optional day trips to fictional islands; the ship anchors offshore ================= */
const ISLE = { x: 440, z: -20 };
const PORTS = [
  { id: 'mosaic', name: 'Mosaic Key', tag: 'Beach day', blurb: 'White sand, turquoise shallows, a palm grove and the Tile Shack beach bar.', R: 150, maxH: 11, seed: 11, sand: '#e2d2ad', grass: '#78ad4c', rock: '#a39684', palms: 80, trees: 8 },
  { id: 'solana', name: 'Port Solana', tag: 'Harbor town', blurb: 'Pastel houses on the quay, a market plaza with a fountain, and a striped lighthouse.', R: 165, maxH: 34, seed: 23, sand: '#d2bf98', grass: '#7f9e4c', rock: '#a59480', palms: 28, trees: 40, town: true },
  { id: 'verde', name: 'Isla Verde', tag: 'Jungle and waterfall', blurb: 'A black-sand cove, rainforest hills, a lookout and a waterfall pool you can swim in.', R: 160, maxH: 74, seed: 37, sand: '#4b4541', grass: '#3d7a2c', rock: '#5c544d', palms: 36, trees: 140, volcano: true, waterfall: true },
];
const PORT_OPEN = 7 * 60, PORT_LAST = 17 * 60, ALL_ABOARD = 18 * 60;
function hash2(i, j, s) { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise2(x, z, s) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm2(x, z, s) { let a = 0.5, t = 0; for (let k = 0; k < 4; k++) { t += a * vnoise2(x, z, s + k * 17); x *= 2.03; z *= 2.03; a *= 0.5; } return t / 0.9375; }

function makeTerrain(P) {
  const r1 = mulberry(P.seed), ph = [r1() * TAU, r1() * TAU, r1() * TAU];
  const mods = [];
  const shoreR = th => { const d = Math.abs(wrapAngle(th - Math.PI)); const R = P.R * (1 + 0.1 * Math.sin(3 * th + ph[0]) + 0.06 * Math.sin(5 * th + ph[1]) + 0.035 * Math.sin(9 * th + ph[2])); return lerp(P.R, R, smooth(0.12, 0.45, d)); };
  const base = (wx, wz) => {
    const lx = wx - ISLE.x, lz = wz - ISLE.z, r = Math.hypot(lx, lz), th = Math.atan2(lz, lx), t = r / shoreR(th);
    if (t >= 1) return -7.5 * smooth(1, 1.45, t);
    const beach = 1.6 * smooth(1, 0.86, t);
    let hill = P.maxH * Math.pow(smooth(0.88, 0.0, t), P.volcano ? 1.5 : 1.15);
    if (P.volcano) hill -= P.maxH * 0.3 * smooth(0.13, 0.0, t);
    hill *= 0.72 + 0.56 * fbm2(lx * 0.016, lz * 0.016, P.seed);
    let h = beach + hill + (fbm2(lx * 0.08, lz * 0.08, P.seed + 5) - 0.5) * 1.2 * smooth(0.9, 0.7, t);
    if (P.town) { const d = Math.abs(wrapAngle(th - Math.PI)); const k = smooth(0.62, 0.38, d) * smooth(0.93, 0.86, t) * smooth(0.42, 0.55, t); h = lerp(h, 2.2, Math.max(k, smooth(0.62, 0.38, d) * smooth(0.86, 0.93, t) * (t < 0.985 ? 1 : 0))); }
    return h;
  };
  const h = (wx, wz) => {
    let v = base(wx, wz);
    for (const m of mods) { const d = Math.hypot(wx - m.x, wz - m.z); if (d < m.r + m.blend) { const k = smooth(m.r + m.blend, m.r, d); v = lerp(v, m.kind === 'bowl' ? m.h - 1.7 * smooth(m.r, m.r * 0.4, d) : m.h, k); } }
    return v;
  };
  h.base = base; h.mods = mods; h.shoreR = shoreR;
  h.at = (th, t) => { const r = shoreR(th) * t; return [ISLE.x + Math.cos(th) * r, ISLE.z + Math.sin(th) * r]; };
  return h;
}

let portTexDone = false;
function portTextures() {
  if (portTexDone) return; portTexDone = true;
  TEX.dirt = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#e6e6e6', 0.16, 16000, 2)); TEX.dirt.repeat.set(1 / 5, 1 / 5);
  TEX.facade = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const x = 24 + c * 78, y = 30 + r * 118; g.fillStyle = '#2b3b55'; g.fillRect(x, y, 52, 74); g.fillStyle = '#e9e1d3'; g.fillRect(x - 6, y + 74, 64, 8); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 25, y, 2, 74); }
    g.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 1600; i++) g.fillRect(rand(0, w), rand(0, h), 2, 2);
  }, { repeat: false });
  TEX.shack = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#2fd3c6'; g.fillRect(0, 0, w, h); g.fillStyle = '#0b1b33'; g.font = `900 64px ${FONT()}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TILE SHACK', w / 2, h / 2 + 4); }, { repeat: false });
  MAT.terrain = new T.MeshStandardMaterial({ vertexColors: true, map: TEX.dirt, roughness: 0.96, envMapIntensity: 0.3 });
  MAT.facade = new T.MeshStandardMaterial({ vertexColors: true, map: TEX.facade, roughness: 0.85, envMapIntensity: 0.3 });
  MAT.roof = vm('#c4623a', { roughness: 0.8 });
  MAT.thatch = vm('#cfa862', { roughness: 1, side: T.DoubleSide });
  MAT.shack = bm('#ffffff', 1.0, { map: TEX.shack, side: T.DoubleSide });
  MAT.rock = vm('#8d8478', { roughness: 0.95, flatShading: true });
  MAT.plank = vm('#9a7a55', { roughness: 0.9 });
  MAT.beacon = bm('#fff1c8', 3);
  MAT.beam = new T.MeshBasicMaterial({ color: lin('#fff3cf'), transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  MAT.shore = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: 'attribute float aT; varying float vT; varying vec2 vW; void main(){ vT=aT; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uTime; uniform float uNight; varying float vT; varying vec2 vW;
      void main(){ float wave=sin(vT*14.0-uTime*1.6+sin(vW.x*0.08)*2.0+sin(vW.y*0.07)*2.0);
        float a=(1.0-smoothstep(0.05,1.0,vT))*smoothstep(0.0,0.08,vT)*(0.35+0.5*smoothstep(0.2,0.9,wave));
        vec3 c=mix(vec3(0.95,0.98,1.0),vec3(0.25,0.3,0.38),uNight*0.8); gl_FragColor=vec4(c,a*0.85);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
    transparent: true, depthWrite: false
  });
}

/* ---------------- build one port (geometry + colliders, all tagged 'port') ---------------- */
function buildPort(P) {
  portTextures();
  World.tag = 'port';
  const g = new T.Group(); g.name = 'port_' + P.id; G.scene.add(g);
  const H = makeTerrain(P), B = new Bin();
  const rp = mulberry(P.seed * 7 + 1), rr = (a, b) => a + (b - a) * rp();
  const deckY = 1.7, pierX0 = ISLE.x - P.R + 7, pierX1 = ISLE.x - P.R - 52, pz = ISLE.z;
  // feature sites (flatten / bowls) before meshing
  const feat = {};
  if (P.waterfall) {
    const th = Math.PI + 0.75; let best = null;
    for (let t = 0.75; t > 0.3; t -= 0.01) { const [x, z] = H.at(th, t); const hh = H.base(x, z); if (hh > 16) { best = [x, z, hh]; break; } }
    if (best) { feat.pool = { x: best[0], z: best[1], top: best[2] }; H.mods.push({ x: best[0], z: best[1], r: 7, blend: 5, h: best[2], kind: 'bowl' }); }
    const tl = Math.PI - 0.55; let bl = null;
    for (let t = 0.7; t > 0.2; t -= 0.01) { const [x, z] = H.at(tl, t); const hh = H.base(x, z); if (hh > 34) { bl = [x, z, hh]; break; } }
    if (bl) { feat.look = { x: bl[0], z: bl[1], y: bl[2] }; H.mods.push({ x: bl[0], z: bl[1], r: 5, blend: 6, h: bl[2], kind: 'flat' }); }
  }
  if (P.town) { const [x, z] = H.at(Math.PI, 0.7); feat.plaza = { x, z }; H.mods.push({ x, z, r: 16, blend: 6, h: 2.2, kind: 'flat' }); }
  { const bx = pierX0 + 8, bz = pz + 22, by = Math.max(0.8, H.base(bx, bz)); feat.bar = { x: bx, y: by, z: bz }; H.mods.push({ x: bx, z: bz, r: 6, blend: 4, h: by, kind: 'flat' }); }
  const avoid = (x, z) => (Math.abs(z - pz) < 5 && x < pierX0 + 12) || (feat.bar && Math.hypot(x - feat.bar.x, z - feat.bar.z) < 8) || (feat.plaza && Math.hypot(x - feat.plaza.x, z - feat.plaza.z) < 20) || (feat.pool && Math.hypot(x - feat.pool.x, z - feat.pool.z) < 12) || (feat.look && Math.hypot(x - feat.look.x, z - feat.look.z) < 8);
  // pier landing: keep the beach smooth where the pier meets it
  H.mods.push({ x: pierX0 + 2, z: pz, r: 4, blend: 6, h: H.base(pierX0 + 2, pz), kind: 'flat' });
  // terrain mesh
  const S = P.R * 1.5, N = G.quality.detail >= 1 ? 200 : 140, step = 2 * S / N;
  const pos = new Float32Array((N + 1) * (N + 1) * 3), col = new Float32Array((N + 1) * (N + 1) * 3), uv = new Float32Array((N + 1) * (N + 1) * 2), idx = [];
  const cS = lin(P.sand), cG = lin(P.grass), cR = lin(P.rock), cW = lin('#7fb8a8'), cP = lin('#c9b79c'), tmp = new T.Color();
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = ISLE.x - S + i * step, z = ISLE.z - S + j * step, y = H(x, z), k = j * (N + 1) + i;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x; uv[k * 2 + 1] = z;
    const sl = Math.hypot(H(x + 1, z) - y, H(x, z + 1) - y);
    const n = fbm2(x * 0.05, z * 0.05, P.seed + 9);
    if (y < 0) tmp.copy(cS).lerp(cW, smooth(-0.2, -5, y));
    else if (y < 2.3 + n * 1.2 && sl < 0.6) tmp.copy(cS).multiplyScalar(y < 0.5 ? 0.82 : 1);
    else { tmp.copy(cG).multiplyScalar(0.8 + n * 0.45); if (sl > 0.75) tmp.lerp(cR, smooth(0.75, 1.3, sl)); }
    if (P.town && feat.plaza && Math.hypot(x - feat.plaza.x, z - feat.plaza.z) < 17) tmp.copy(cP);
    col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('color', new T.BufferAttribute(col, 3)); tg.setAttribute('uv', new T.BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  const terrain = new T.Mesh(tg, MAT.terrain); terrain.receiveShadow = true; terrain.castShadow = true; g.add(terrain);
  addFloor(rectPts(ISLE.x - S, ISLE.z - S, ISLE.x + S, ISLE.z + S), 0, 'port', { hfn: H, name: 'port' });
  // shore foam ring
  { const M = 256, Pp = [], A = [], I = [];
    for (let i = 0; i <= M; i++) { const th = i / M * TAU; let lo = P.R * 0.5, hi = P.R * 1.7; for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; H(ISLE.x + Math.cos(th) * mid, ISLE.z + Math.sin(th) * mid) > 0 ? lo = mid : hi = mid; } const r = (lo + hi) / 2;
      for (const [rr2, a] of [[r - 2, 0], [r + 9, 1]]) { Pp.push(ISLE.x + Math.cos(th) * rr2, 0.06, ISLE.z + Math.sin(th) * rr2); A.push(a); } }
    for (let i = 0; i < M; i++) { const a = i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(Pp, 3)); sg.setAttribute('aT', new T.Float32BufferAttribute(A, 1)); sg.setIndex(I);
    const sm = new T.Mesh(sg, MAT.shore); sm.renderOrder = 2; sm.frustumCulled = false; g.add(sm); }
  // waterfall pool before the sea so it wins in waterAt
  if (feat.pool) {
    const p = feat.pool, poly = ellipsePts(p.x, p.z, 6.4, 6.4, 40);
    addWater(poly, p.top - 0.15, p.top - 1.8, { id: 'falls', name: 'Waterfall pool', level: 'port' });
    const wm = new T.Mesh(floorGeo(poly, [], p.top - 0.15), G.poolMats[0]); wm.renderOrder = 3; g.add(wm);
    const dir = Math.atan2(p.z - ISLE.z, p.x - ISLE.x); const bx = p.x + Math.cos(dir) * 7.5, bz = p.z + Math.sin(dir) * 7.5;
    for (let i = 0; i < 26; i++) { const a = dir + Math.PI / 2 + (i % 13 - 6) * 0.16, k = Math.floor(i / 13); B.add('rock', new T.DodecahedronGeometry(rr(1.8, 3.2), 0), bx + Math.cos(a) * 2 * (i % 13 - 6) * 0.25, p.top + 1 + k * 4 + rr(0, 4), bz + Math.sin(a) * (i % 13 - 6) * 0.5, rr(0, 3), 1, rr(0.8, 1.4), 1); }
    for (let k = 0; k < 4; k++) B.add('rock', new T.DodecahedronGeometry(3.4, 1), bx + Math.cos(dir) * 2, p.top + 3 + k * 3.6, bz + Math.sin(dir) * 2, k, 1.4, 1, 1.2);
    const fall = new T.PlaneGeometry(3.2, 13, 1, 8); fall.translate(0, 6.5, 0);
    const fm = new T.Mesh(fall, G.waterfallMat); fm.position.set(bx - Math.cos(dir) * 1.0, p.top - 0.2, bz - Math.sin(dir) * 1.0); fm.rotation.y = Math.atan2(-Math.cos(dir), -Math.sin(dir)); fm.renderOrder = 4; g.add(fm);
    addCircle(bx, bz, 3.2, p.top - 3, p.top + 14);
    addHotspot('falls', p.x - Math.cos(dir) * 7.8, p.top, p.z - Math.sin(dir) * 7.8, 3, 'Swim under the waterfall', 'viewpoint', { face: dir, stamp: 'waterfall', say: 'Waterfall pool' });
  }
  addWater(ellipsePts(ISLE.x, ISLE.z, P.R * 1.32, P.R * 1.32, 72), 0, -9, { id: 'sea', name: 'Lagoon', level: 'port', sea: true });
  // pier + tender
  for (let x = pierX1; x < pierX0; x += 0.42) B.add('plank', box(0.38, 0.08, 4), x + 0.2, deckY - 0.04, pz);
  for (let x = pierX1 + 1; x < pierX0; x += 4) for (const s of [-1, 1]) B.add('plank', cyl(0.14, 0.14, 9, 8), x, deckY - 4.5, pz + s * 1.85);
  addRail(B, [[pierX0 - 4, pz + 2.05], [pierX1, pz + 2.05]], deckY, { solid: 'plank', h: 0.9 });
  addRail(B, [[pierX0 - 4, pz - 2.05], [pierX1 + 6, pz - 2.05]], deckY, { solid: 'plank', h: 0.9 });
  const hStart = H(pierX0, pz);
  addFloor(rectPts(pierX1, pz - 2, pierX0, pz + 2), deckY, 'port', { name: 'pier', hfn: (x) => lerp(hStart, deckY, smooth(pierX0, pierX0 - 7, x)) });
  { const tb = new T.Group(); tb.position.set(pierX1 + 4.5, 0, pz - 4.4);
    const hull = new T.Mesh(mergeGeos([(() => { const b = box(11, 1.4, 3.2); b.translate(0, 0.3, 0); return b; })(), (() => { const c = new T.ConeGeometry(1.6, 3, 4); c.rotateZ(-Math.PI / 2); c.rotateX(Math.PI / 4); c.scale(1, 0.62, 1.4); c.translate(-7, 0.3, 0); return c; })()]), MAT.white); hull.castShadow = true; tb.add(hull);
    const band = new T.Mesh(box(11.05, 0.25, 3.25), MAT.navy); band.position.y = -0.2; tb.add(band);
    const cab = new T.Mesh(box(6, 1.5, 2.6), MAT.white); cab.position.set(1, 1.7, 0); cab.castShadow = true; tb.add(cab);
    const win = new T.Mesh(box(6.05, 0.5, 2.65), MAT.darkGlass); win.position.set(1, 1.9, 0); tb.add(win);
    const roof = new T.Mesh(box(6.4, 0.12, 3.0), MAT.coral); roof.position.set(1, 2.5, 0); tb.add(roof);
    g.add(tb); G.tender = tb; }
  addHotspot('tender', pierX1 + 2.5, deckY, pz, 2.6, 'Take the tender back to the ship', 'tender');
  // beach bar
  { const bx = feat.bar.x, bz = feat.bar.z, by = feat.bar.y;
    for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) B.add('plank', cyl(0.12, 0.14, 3.2, 8), bx + dx, by + 1.6, bz + dz);
    B.add('thatch', new T.ConeGeometry(4.6, 2.2, 6, 1, true), bx, by + 4.2, bz, 0.3);
    B.add('plank', box(4.2, 1.05, 0.7), bx, by + 0.52, bz - 1.4); B.add('teak', box(4.4, 0.07, 0.9), bx, by + 1.08, bz - 1.4);
    B.add('shack', new T.PlaneGeometry(3.2, 0.8), bx, by + 2.9, bz - 2.75, Math.PI);
    for (let k = 0; k < 10; k++) B.add('bottle', tint(cyl(0.06, 0.07, 0.3, 8), pick(['#2fd3c6', '#ff6a55', '#ffc95c', '#9be37a'])), bx - 1.8 + k * 0.4, by + 1.27, bz - 1.2);
    for (let k = 0; k < 5; k++) addStool(bx - 1.8 + k * 0.9, by, bz - 2.55, Math.PI, 'shack', 'port');
    addBoxCollider(bx, bz - 1.4, 2.2, 0.45, by - 0.5, by + 1.2); for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) addCircle(bx + dx, bz + dz, 0.2, by - 1, by + 3);
    addHotspot('shack', bx, by, bz - 3.2, 3, 'Order at the Tile Shack', 'menu', { venue: 'shack' });
  }
  // loungers + umbrellas along the beach either side of the pier
  const lmats = [], cmats = [], ccols = [];
  for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
    const th = Math.PI + side * (0.1 + k * 0.035);
    const [x, z] = H.at(th, 0.925), y = H(x, z); if (y < 0.3 || y > 3 || avoid(x, z)) continue;
    const ry = Math.atan2(Math.cos(th), Math.sin(th));
    for (const off of [-0.7, 0.7]) { const ox = x + Math.cos(th + Math.PI / 2) * off, oz = z + Math.sin(th + Math.PI / 2) * off; lmats.push(mtx(ox, y, oz, ry)); cmats.push(mtx(ox, y, oz, ry)); ccols.push(new T.Color(k % 2 ? '#ff6a55' : '#2fd3c6')); World.spots.loungers.push({ x: ox, y, z: oz, ry, level: 'port', taken: null, tag: 'port' }); }
    if (k % 2 === 0) { const ux = x - Math.cos(th) * 1.4, uz = z - Math.sin(th) * 1.4; B.add('steel', cyl(0.03, 0.03, 2.4, 8), ux, y + 1.2, uz); B.add('stripesCanopy', new T.ConeGeometry(1.5, 0.5, 12, 1, true), ux, y + 2.5, uz); }
  }
  loungerGeos();
  g.add(instanced(GEO.loungerFrame, MAT.frame, lmats, { cast: true })); g.add(instanced(GEO.loungerCushion, MAT.cushion, cmats, { cast: true, colors: ccols }));
  // town (Port Solana)
  if (P.town) {
    const pal = ['#f6b5a8', '#f7d98b', '#b9e3c6', '#a9d3f0', '#f3c6e0', '#fde7c2', '#c9b8f0'];
    const fc = [];
    for (let i = 0; i < 18; i++) {
      const th = Math.PI + (i - 8.5) * 0.052; if (Math.abs(i - 8.5) < 1.2) continue;
      const [x, z] = H.at(th, 0.805), w = rr(6, 8.5), d = 7, hgt = rr(6.5, 11.5), ry = Math.atan2(Math.cos(th), Math.sin(th));
      const bx = box(w, hgt, d); tint(bx, pal[i % pal.length]); B.add('facade', bx, x, 2.2 + hgt / 2, z, ry);
      const roof = new T.ConeGeometry(Math.max(w, d) * 0.74, 3, 4); roof.rotateY(Math.PI / 4); roof.scale(w / Math.max(w, d), 1, d / Math.max(w, d)); B.add('roof', roof, x, 2.2 + hgt + 1.5, z, ry);
      addBoxCollider(x, z, w / 2, d / 2, 0, 2.2 + hgt, ry);
    }
    const pzc = feat.plaza;
    B.add('white', cyl(3.2, 3.4, 0.7, 40), pzc.x, 2.55, pzc.z); B.add('white', cyl(0.5, 0.7, 2.4, 20), pzc.x, 3.4, pzc.z); B.add('white', cyl(1.2, 1.0, 0.25, 24), pzc.x, 4.5, pzc.z);
    const fw = new T.Mesh(new T.CircleGeometry(3.0, 40).rotateX(-Math.PI / 2), G.poolMats[0]); fw.position.set(pzc.x, 2.85, pzc.z); fw.renderOrder = 3; g.add(fw);
    addCircle(pzc.x, pzc.z, 3.4, 0, 4);
    for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k - 1) * 0.9; const sx = pzc.x + Math.cos(a) * 10, sz = pzc.z + Math.sin(a) * 10, ry = Math.atan2(pzc.x - sx, pzc.z - sz);
      B.add('plank', box(3, 1, 1.4), sx, 2.7, sz, ry); B.add('stripesCanopy', box(3.4, 0.08, 2.2), sx, 4.6, sz, ry);
      for (const dx of [-1.5, 1.5]) B.add('plank', cyl(0.06, 0.06, 2.4, 6), sx + Math.cos(ry) * dx, 3.4, sz - Math.sin(ry) * dx);
      for (let f = 0; f < 9; f++) B.add('bottle', tint(new T.SphereGeometry(0.13, 10, 8), pick(['#ff6a55', '#ffc95c', '#7bd389', '#ff8a3d', '#c8102e'])), sx + Math.cos(ry) * (-1.2 + f * 0.3), 3.3, sz - Math.sin(ry) * (-1.2 + f * 0.3));
      addBoxCollider(sx, sz, 1.6, 0.8, 0, 4, ry);
      addHotspot('market' + k, sx + Math.sin(ry) * 1.7, 2.2, sz + Math.cos(ry) * 1.7, 2.2, k === 1 ? 'Browse the craft stall' : 'Shop the market stall', k === 1 ? 'shop' : 'menu', k === 1 ? { item: 'souvenir' } : { venue: 'market' }); }
    // bell tower
    { const [x, z] = H.at(Math.PI + 0.35, 0.66); const y0 = H(x, z); B.add('white', box(4.5, 18, 4.5), x, y0 + 9, z); B.add('roof', new T.ConeGeometry(3.6, 4, 4).rotateY(Math.PI / 4), x, y0 + 20, z); B.add('white', new T.CircleGeometry(1.1, 24), x - 2.27, y0 + 14, z, -Math.PI / 2); addBoxCollider(x, z, 2.3, 2.3, y0 - 1, y0 + 18); }
    // breakwater + lighthouse
    { const th = Math.PI - 0.32; const [sx, sz] = H.at(th, 0.97); const dir = [Math.cos(th), Math.sin(th)], L = 46;
      for (let i = 0; i < 36; i++) { const t = i / 35 * L; B.add('rock', new T.DodecahedronGeometry(rr(1.2, 2.0), 0), sx + dir[0] * t + rr(-1.5, 1.5), rr(-0.5, 0.8), sz + dir[1] * t + rr(-1.5, 1.5), rr(0, 3), 1, rr(0.6, 1), 1); }
      const lx = sx + dir[0] * L, lz = sz + dir[1] * L;
      const strip = []; for (let s = 0; s < 6; s++) strip.push([s % 2 ? 'white' : 'coral', s]);
      for (const [m, s] of strip) B.add(m, cyl(2.0 - (s + 1) * 0.12, 2.0 - s * 0.12, 2.6, 24), lx, 1.5 + s * 2.6 + 1.3, lz);
      B.add('darkMetal', cyl(1.5, 1.5, 0.25, 24), lx, 17.3, lz); B.add('glass', cyl(0.9, 0.9, 1.6, 20, true), lx, 18.2, lz); B.add('beacon', new T.SphereGeometry(0.45, 16, 12), lx, 18.2, lz); B.add('coral', new T.ConeGeometry(1.1, 1.0, 20), lx, 19.5, lz);
      B.add('plank', box(3, 0.3, L), sx + dir[0] * L / 2, 1.85, sz + dir[1] * L / 2, Math.atan2(dir[0], dir[1]));
      const bw = []; for (let i = 0; i <= 1; i++) bw.push(i);
      const hw = 1.5, cxw = sx + dir[0] * L / 2, czw = sz + dir[1] * L / 2;
      const cs = Math.cos(Math.atan2(dir[0], dir[1])), sn = Math.sin(Math.atan2(dir[0], dir[1]));
      const corner = (u, v) => [cxw + u * cs + v * sn, czw - u * sn + v * cs];
      const [rx0, rz0] = corner(0, -L / 2 - 7), ry0 = Math.max(0.3, H(rx0, rz0));
      addFloor([corner(-hw, -L / 2 - 7), corner(hw, -L / 2 - 7), corner(hw, L / 2), corner(-hw, L / 2)], 2.0, 'port', { name: 'breakwater', hfn: (x, z) => { const v = (x - cxw) * sn + (z - czw) * cs; return lerp(ry0, 2.0, smooth(-L / 2 - 7, -L / 2, v)); } });
      { const [mx, mz] = corner(0, -L / 2 - 3.5), len = Math.hypot(7, 2.0 - ry0); B.add('plank', box(3, 0.3, len), mx, (ry0 + 2.0) / 2 - 0.15, mz, Math.atan2(dir[0], dir[1]), 1, 1, 1, -Math.atan2(2.0 - ry0, 7)); }
      addCircle(lx, lz, 2.1, 0, 20);
      const beam = new T.Group(); beam.position.set(lx, 18.2, lz); for (const s of [0, Math.PI]) { const c = new T.Mesh(new T.ConeGeometry(4, 60, 20, 1, true), MAT.beam); c.geometry.translate(0, -30, 0); c.rotation.z = Math.PI / 2; const piv = new T.Object3D(); piv.rotation.y = s; piv.add(c); beam.add(piv); }
      g.add(beam); G.beam = beam;
      addHotspot('lighthouse', lx - dir[0] * 3.4, 2.0, lz - dir[1] * 3.4, 2.4, 'Take in the harbor view', 'viewpoint', { face: th, stamp: null, say: 'Lighthouse point' }); }
  }
  // lookout (Isla Verde)
  if (feat.look) { const L = feat.look;
    B.add('plank', cyl(5.2, 5.2, 0.3, 32), L.x, L.y + 0.15, L.z);
    const ring = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU * 0.86 + Math.atan2(ISLE.z - L.z, ISLE.x - L.x) + 0.45; ring.push([L.x + Math.cos(a) * 5, L.z + Math.sin(a) * 5]); }
    addRail(B, ring, L.y + 0.3, { solid: 'plank', h: 1.0 });
    addFloor(ellipsePts(L.x, L.z, 5.2, 5.2, 32), L.y + 0.3, 'port', { name: 'lookout' });
    addHotspot('lookout', L.x, L.y + 0.3, L.z, 3.5, 'Take in the view from the lookout', 'viewpoint', { face: Math.atan2(L.x - ISLE.x, L.z - ISLE.z), stamp: 'lookout', say: 'Rainforest lookout' }); }
  // vegetation + rocks (avoid the pier corridor, bar and plaza)
  let n = 0, guard = 0;
  while (n < P.palms && guard++ < 4000) {
    const th = rr(0, TAU), t = rr(0.55, 0.9), [x, z] = H.at(th, t), y = H(x, z);
    if (y < 1.0 || y > 14 || avoid(x, z) || (P.town && Math.abs(wrapAngle(th - Math.PI)) < 0.5 && t > 0.62)) continue;
    palmInto(B, x, y - 0.1, z, rr(6, 9), rr(0, TAU), rr(0.9, 1.25)); addCircle(x, z, 0.3, y - 1, y + 3); n++;
  }
  n = 0; guard = 0;
  const greens = ['#2f6a2c', '#3f7d34', '#2c5f2a', '#4f9440', '#356e30'];
  const fol = [], trk = [];
  while (n < P.trees && guard++ < 6000) {
    const th = rr(0, TAU), t = rr(0.05, 0.8), [x, z] = H.at(th, t), y = H(x, z);
    if (y < 2.5 || avoid(x, z) || (P.town && Math.abs(wrapAngle(th - Math.PI)) < 0.55)) continue;
    const ht = rr(6, 13), c = lin(greens[n % greens.length]);
    const tr = cyl(0.18, 0.32, ht * 0.6, 7); tint(tr, '#5b4632'); tr.translate(x, y + ht * 0.3, z); trk.push(tr);
    for (let k = 0; k < 4; k++) { const sg = new T.SphereGeometry(rr(1.8, 3.2), 9, 7); sg.scale(1, 0.75, 1); const cc = c.clone().multiplyScalar(rr(0.8, 1.15)); const ca = []; for (let q = 0; q < sg.attributes.position.count; q++) ca.push(cc.r, cc.g, cc.b); sg.setAttribute('color', new T.Float32BufferAttribute(ca, 3)); sg.translate(x + rr(-1.6, 1.6), y + ht * 0.65 + rr(0, 2.5), z + rr(-1.6, 1.6)); fol.push(sg); }
    addCircle(x, z, 0.45, y - 1, y + 4); n++;
  }
  if (fol.length) B.push('foliage', mergeGeos(fol)); if (trk.length) B.push('trunk', mergeGeos(trk));
  for (let i = 0; i < 40; i++) { const th = rr(0, TAU), [x, z] = H.at(th, rr(0.97, 1.05)); if (avoid(x, z)) continue; const y = H(x, z); B.add('rock', new T.DodecahedronGeometry(rr(0.6, 1.8), 0), x, y + 0.2, z, rr(0, 3), 1, rr(0.5, 0.9), 1); }
  B.build(g, { thatch: { cast: true }, beam: { cast: false } });
  // rail spots facing the sea along the pier
  for (let x = pierX1 + 3; x < pierX0 - 6; x += 6) { World.spots.rails.push({ x, y: deckY, z: pz + 1.4, ry: 0, level: 'port', taken: null, tag: 'port' }); World.spots.rails.push({ x, y: deckY, z: pz - 1.4, ry: Math.PI, level: 'port', taken: null, tag: 'port' }); }
  World.tag = null;
  buildHash();
  buildNavGrid('port', ISLE.x - S, ISLE.z - S, ISLE.x + S, ISLE.z + S, 2.5, 0.55);
  World.zones.port = { name: P.name, deck: P.tag, spawn: [pierX0 - 3, deckY, pz, Math.PI / 2], level: 'port' };
  return { group: g, H, feat };
}

/* ---------------- going ashore / back aboard ---------------- */
function portOpen() { return Clock.min >= PORT_OPEN && Clock.min < PORT_LAST; }
function goAshore(id, force) {
  const P = PORTS.find(p => p.id === id); if (!P) return;
  if (!force && !portOpen() && !(G.port && G.port.id === id)) { toast('Ports are open 07:00 to 17:00', 'Use the program to skip ahead to the morning.'); return; }
  closeSheet();
  const f = $('fade'); f.classList.add('on');
  setTimeout(() => {
    if (Player.activity) endActivity();
    leaveSuiteState();
    if (G.port && G.port.id !== id) teardownPort();
    if (!G.port) {
      const built = buildPort(P);
      G.port = { id, P, ...built };
      G.ocean.material.uniforms.uIsle.value.set(ISLE.x, ISLE.z, P.R, 1);
      G.shipSpeed = 0; G.allAboard = 0;
      const pool = NPCS.filter(n => n.state !== 'ride' && n.state !== 'climb').slice(0, 16);
      for (const n of pool) { n.release(); n.event = null; n.level = 'port'; n.water = null; n.ch.hidden = false; n.spawnInitial(); }
      G.portStaff = new Char(BARTENDER_APP(mulberry(5)), { seed: 9 }); buildCharMesh(G.portStaff); G.portStaff.setAnim('bartend');
      const b = G.port.feat.bar; G.portStaff.rig.root.position.set(b.x, b.y, b.z - 0.6); G.portStaff.rig.root.rotation.y = Math.PI; G.scene.add(G.portStaff.rig.root);
    }
    const s = World.zones.port.spawn; placePlayer(s[0], s[1], s[2], s[3]);
    setTimeout(() => f.classList.remove('on'), 160);
    toast('Welcome to ' + P.name, 'All aboard by 18:00. The tender is at the end of the pier.');
    sfx('horn');
    stamp('ashore');
    const pr = G.profile; pr.ports = pr.ports || []; if (!pr.ports.includes(id)) { pr.ports.push(id); saveProfile(); }
    if (PORTS.every(p => pr.ports.includes(p.id))) stamp('islands');
  }, 420);
}
function teardownPort() {
  if (!G.port) return;
  removeTagged('port');
  delete World.grids.port;
  G.port.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  G.scene.remove(G.port.group);
  if (G.portStaff) { G.scene.remove(G.portStaff.rig.root); G.portStaff = null; }
  G.beam = null; G.tender = null;
  for (const n of NPCS) if (n.level === 'port') { n.release(); n.level = 'd15'; n.water = null; n.spawnInitial(); }
  G.ocean.material.uniforms.uIsle.value.set(0, 0, 0, 0);
  G.port = null; G.shipSpeed = 1;
}
function returnToShip(msg) {
  if (!G.port) return;
  closeSheet();
  const f = $('fade'); f.classList.add('on');
  setTimeout(() => {
    if (Player.activity) endActivity();
    teardownPort();
    const s = World.zones.pool.spawn; placePlayer(s[0], s[1], s[2], s[3]);
    setTimeout(() => f.classList.remove('on'), 160);
    toast(msg || 'Back aboard the Tileo Infinity', 'The ship is under way again.');
    sfx('horn');
  }, 420);
}
function updatePort(dt) {
  if (!G.port) return;
  if (G.tender) { G.tender.position.y = Math.sin(G.time * 0.9) * 0.12; G.tender.rotation.z = Math.sin(G.time * 0.7) * 0.02; }
  if (G.beam) { G.beam.rotation.y += dt * 0.8; G.beam.visible = Env.night > 0.3; }
  MAT.shore.uniforms.uTime.value = G.time; MAT.shore.uniforms.uNight.value = Env.night;
  if (G.portStaff) G.portStaff.update(dt, G.time);
  const m = Clock.min;
  if (G.allAboard === 0 && m >= ALL_ABOARD - 1 && m < ALL_ABOARD + 60) { G.allAboard = 1; sfx('horn'); toast('All aboard!', 'The last tender leaves in 20 minutes.'); }
  if ((m >= ALL_ABOARD + 20 || m < PORT_OPEN - 60) && G.state === 'play' && !Player.activity) returnToShip('You made the last tender');
}

/* ---- 30_character.js ---- */
/* ================= characters: appearance, rig, geometry, poses, crowd renderer ================= */
const SKIN = ['#f7dcc9', '#efc4a6', '#dca47e', '#c48a5e', '#a06a45', '#7d4c2e', '#5c3823', '#3e2518'];
const HAIR_COLORS = ['#17120f', '#3a2416', '#6b4127', '#a5582a', '#d8ae66', '#efe0b6', '#b8bcc6', '#e9579a', '#2fc4c0', '#6c4cff'];
const OUTFIT = ['#ff6a55', '#ffb547', '#2fd3c6', '#1b6fd8', '#10264a', '#f4f1e8', '#e84c8b', '#7bd389', '#8a5cf6', '#ffd23f', '#ff8fab', '#33343f'];
const SHOE_COLORS = ['#f4f6f8', '#10264a', '#ff6a55', '#2fd3c6', '#33343f', '#d8b48a'];
const ACC_COLORS = ['#ff6a9e', '#ffc95c', '#2fd3c6', '#f4f6f8', '#10264a', '#ff6a55'];
const HAIR_STYLES = ['Buzz', 'Crop', 'Bob', 'Bun', 'Long', 'Curls', 'Afro', 'Ponytail', 'Bald'];
const TOPS = ['Tee', 'Tank', 'Aloha', 'Stripes', 'Sundress', 'Polo'];
const BOTTOMS = ['Shorts', 'Trunks', 'Pants', 'Skirt'];
const ACCS = ['None', 'Sunglasses', 'Sun hat', 'Captain cap', 'Flower lei', 'Headphones'];
const BODIES = ['Slim', 'Regular', 'Broad', 'Curvy'];
const BODY_P = [
  { sh: 0.93, waist: 0.9, hip: 0.95, chest: 0.92, arm: 0.9, leg: 0.93 },
  { sh: 1, waist: 1, hip: 1, chest: 1, arm: 1, leg: 1 },
  { sh: 1.12, waist: 1.1, hip: 1.04, chest: 1.12, arm: 1.12, leg: 1.08 },
  { sh: 0.97, waist: 0.95, hip: 1.15, chest: 1.05, arm: 0.95, leg: 1.06 },
];
function randomAppearance(r = Math.random) {
  const p = a => a[Math.floor(r() * a.length)];
  const i = n => Math.floor(r() * n);
  const top = r() < 0.15 ? 4 : p([0, 0, 1, 2, 3, 5]);
  return {
    body: i(4), height: 0.95 + r() * 0.1, skin: i(SKIN.length), hair: r() < 0.06 ? 8 : i(8), hairColor: r() < 0.12 ? 7 + i(3) : i(7),
    top, topColor: i(OUTFIT.length), bottom: top === 4 ? 3 : p([0, 0, 1, 2, 3]), bottomColor: i(OUTFIT.length), shoes: i(SHOE_COLORS.length),
    acc: r() < 0.45 ? 0 : 1 + i(5), accColor: i(ACC_COLORS.length)
  };
}
const CAPTAIN_APP = { body: 1, height: 1.02, skin: 3, hair: 0, hairColor: 6, top: 5, topColor: 5, bottom: 2, bottomColor: 5, shoes: 0, acc: 3, accColor: 3, captain: true };
const BARTENDER_APP = r => ({ ...randomAppearance(r), top: 5, topColor: 4, bottom: 2, bottomColor: 4, acc: 0 });

/* ---------- geometry ---------- */
function latheGeo(profile, seg) { return new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), seg); }
const CHGEO = {};
function charGeos(hi) {
  const key = hi ? 'hi' : 'lo'; if (CHGEO[key]) return CHGEO[key];
  const s = hi ? 1 : 0.55, seg = n => Math.max(6, Math.round(n * s));
  const M = (list) => mergeGeos(list);
  const sph = (r, a, b) => new T.SphereGeometry(r, seg(a), seg(b));
  const g = {};
  // pelvis (bottoms waistband + seat): same flattened oval as the torso, rising under the shirt hem so the two read as one figure
  // narrower than the shirt above the hem (all body types) and shallow at the crotch so the shorts' legs carry the shape
  g.pelvis = latheGeo([[0.0, -0.04], [0.1, -0.036], [0.15, -0.025], [0.168, -0.005], [0.162, 0.015], [0.14, 0.035], [0.122, 0.08], [0.112, 0.16]], seg(28)); g.pelvis.scale(1, 1, 0.6);
  // torso (top): the hem hangs a few cm below the waist and flares slightly over the bottoms
  g.chest = latheGeo([[0.17, -0.08], [0.155, -0.03], [0.146, 0.06], [0.166, 0.19], [0.18, 0.28], [0.183, 0.33], [0.142, 0.385], [0.065, 0.425], [0.0, 0.43]], seg(28)); g.chest.scale(1, 1, 0.66);
  g.neck = (() => { const c = cyl(0.046, 0.053, 0.14, seg(14)); c.translate(0, 0.05, 0); return c; })();
  g.head = (() => {
    const h = sph(0.118, 30, 24); h.scale(0.92, 1.07, 0.98); h.translate(0, 0.12, 0);
    const earL = sph(0.026, 10, 8); earL.scale(0.5, 1, 0.8); earL.translate(0.108, 0.12, -0.005);
    const earR = earL.clone(); earR.translate(-0.216, 0, 0);
    const nose = sph(0.02, 10, 8); nose.scale(0.8, 1, 1.1); nose.translate(0, 0.105, 0.115);
    return M([h, earL, earR, nose]);
  })();
  g.face = (() => {
    const L = [];
    for (const sx of [-1, 1]) {
      const e = sph(0.0155, 12, 10); e.scale(1, 1.25, 0.6); e.translate(sx * 0.04, 0.135, 0.104); L.push(e);
      const b = box(0.036, 0.008, 0.01); b.rotateZ(sx * -0.12); b.translate(sx * 0.041, 0.167, 0.108); L.push(b);
    }
    const m = new T.TorusGeometry(0.026, 0.0055, 6, seg(14), Math.PI); m.rotateZ(Math.PI); m.translate(0, 0.085, 0.112); L.push(m);
    return M(L);
  })();
  g.upperArm = (() => { const c = cyl(0.056, 0.047, 0.28, seg(16)); c.translate(0, -0.14, 0); return M([c, sph(0.058, 16, 12)]); })();
  g.forearm = (() => { const c = cyl(0.046, 0.037, 0.25, seg(16)); c.translate(0, -0.125, 0); return M([c, sph(0.047, 14, 10)]); })();
  g.hand = (() => { const h = sph(0.042, 14, 10); h.scale(0.75, 1.2, 0.48); h.translate(0, -0.045, 0.005); const t = sph(0.016, 8, 6); t.scale(1, 1.6, 1); t.translate(0.02, -0.03, 0.02); return M([h, t]); })();
  g.thigh = (() => { const c = cyl(0.096, 0.067, 0.42, seg(18)); c.translate(0, -0.21, 0); return M([c, sph(0.086, 16, 12)]); })();
  g.shin = (() => { const c = cyl(0.066, 0.046, 0.41, seg(16)); c.translate(0, -0.205, 0); return M([c, sph(0.066, 14, 10)]); })();
  g.foot = (() => { const f = sph(1, 16, 10); f.scale(0.055, 0.04, 0.122); f.translate(0, -0.035, 0.04); return f; })();
  g.sleeve = (() => { const c = cyl(0.066, 0.06, 0.14, seg(16)); c.translate(0, -0.055, 0); return M([c, (() => { const s2 = sph(0.063, 16, 10); return s2; })()]); })();
  // leg of the bottoms (hip-joint space): the top tucks up inside the hips, the cut follows the thigh down to the hem
  const legWear = len => { const tr = 0.096 - 0.029 * Math.min(1, len / 0.42) + 0.011; return latheGeo([[tr, -len], [0.1, -0.045], [0.097, 0.0], [0.076, 0.05]], seg(20)); };
  g.trunksLeg = legWear(0.15); g.shortsLeg = legWear(0.22); g.pantsLeg = legWear(0.425);
  g.pantsShin = (() => { const c = cyl(0.074, 0.056, 0.41, seg(16)); c.translate(0, -0.205, 0); return c; })();
  // fabric over the hip and knee joints so legs can swing without skin showing through the seams
  g.hipCap = sph(0.088, 18, 12);
  g.kneeCap = sph(0.073, 14, 10);
  g.skirt = (() => { const c = cyl(0.165, 0.28, 0.4, seg(28), true); c.translate(0, -0.15, 0); c.scale(1, 1, 0.84); return c; })();
  // hair (in head space; head center y=0.12)
  const cap = (r, t0, t1, p0 = 0, pl = TAU) => { const c = new T.SphereGeometry(r, seg(30), seg(16), p0, pl, t0, t1 - t0); c.scale(0.94, 1.06, 1.0); c.translate(0, 0.122, -0.004); return c; };
  const back = (r, t0, t1, gap) => cap(r, t0, t1, Math.PI / 2 + gap, TAU - gap * 2);
  g.hair = [];
  g.hair[0] = cap(0.125, 0, Math.PI * 0.4);
  g.hair[1] = M([cap(0.128, 0, Math.PI * 0.42), (() => { const f = sph(0.06, 14, 10); f.scale(1.4, 0.55, 0.8); f.translate(0.02, 0.215, 0.07); return f; })()]);
  g.hair[2] = M([cap(0.132, 0, Math.PI * 0.42), back(0.136, Math.PI * 0.4, Math.PI * 0.72, 0.95)]);
  g.hair[3] = M([cap(0.128, 0, Math.PI * 0.45), back(0.13, Math.PI * 0.42, Math.PI * 0.6, 1.05), (() => { const b2 = sph(0.062, 16, 12); b2.translate(0, 0.27, -0.07); return b2; })()]);
  g.hair[4] = M([cap(0.132, 0, Math.PI * 0.43), back(0.137, Math.PI * 0.41, Math.PI * 0.85, 1.15), (() => { const c = new T.CylinderGeometry(0.128, 0.15, 0.34, seg(20), 1, true, Math.PI / 2 + 0.35, Math.PI - 0.7); c.translate(0, -0.04, -0.012); return c; })()]);
  g.hair[5] = (() => { const L = [cap(0.126, 0, Math.PI * 0.47)]; const rr = mulberry(7); for (let i = 0; i < 52; i++) { const th = rr() * Math.PI * 0.55, ph = rr() * TAU; if (Math.abs(wrapAngle(ph - Math.PI / 2)) < 0.9 && th > Math.PI * 0.33) continue; const b2 = sph(0.036, 8, 6); const r0 = 0.132; b2.translate(-r0 * Math.cos(ph) * Math.sin(th) * 0.94, 0.122 + r0 * Math.cos(th) * 1.06, r0 * Math.sin(ph) * Math.sin(th)); L.push(b2); } return M(L); })();
  g.hair[6] = M([(() => { const c = new T.SphereGeometry(0.19, seg(30), seg(18), 0, TAU, 0, Math.PI * 0.56); c.translate(0, 0.17, -0.03); return c; })(), (() => { const c = new T.SphereGeometry(0.19, seg(30), seg(14), Math.PI / 2 + 1.15, TAU - 2.3, Math.PI * 0.55, Math.PI * 0.27); c.translate(0, 0.17, -0.03); return c; })()]);
  g.hair[7] = M([cap(0.128, 0, Math.PI * 0.45), back(0.13, Math.PI * 0.42, Math.PI * 0.62, 1.05), (() => { const b2 = sph(0.035, 10, 8); b2.translate(0, 0.17, -0.13); return b2; })(), (() => { const c = cyl(0.045, 0.018, 0.32, seg(12)); c.translate(0, -0.16, 0); c.rotateX(0.35); c.translate(0, 0.17, -0.15); return c; })()]);
  g.hair[8] = null;
  // accessories (head space unless noted)
  g.shades = (() => { const L = []; for (const sx of [-1, 1]) { const l = cyl(0.03, 0.03, 0.012, seg(16)); l.rotateX(Math.PI / 2); l.scale(1.1, 0.85, 1); l.translate(sx * 0.042, 0.137, 0.117); L.push(l); const a = box(0.006, 0.006, 0.11); a.translate(sx * 0.098, 0.14, 0.06); L.push(a); } const b2 = box(0.03, 0.006, 0.006); b2.translate(0, 0.142, 0.118); L.push(b2); return M(L); })();
  g.sunhat = M([(() => { const c = cyl(0.122, 0.135, 0.11, seg(24)); c.translate(0, 0.22, -0.005); return c; })(), (() => { const c = cyl(0.28, 0.28, 0.012, seg(32)); c.translate(0, 0.175, -0.005); return c; })()]);
  g.capTop = (() => { const c = cyl(0.152, 0.13, 0.09, seg(24)); c.scale(1, 1, 1.05); c.translate(0, 0.235, -0.01); return c; })();
  g.capBand = (() => { const c = cyl(0.132, 0.13, 0.04, seg(24)); c.translate(0, 0.19, -0.005); return c; })();
  g.capVisor = (() => { const c = new T.CylinderGeometry(0.13, 0.13, 0.01, seg(20), 1, false, -Math.PI / 2, Math.PI); c.scale(1, 1, 0.6); c.rotateX(-0.25); c.translate(0, 0.18, 0.08); return c; })();
  g.capBadge = (() => { const c = sph(0.018, 8, 6); c.scale(1, 1, 0.5); c.translate(0, 0.23, 0.14); return c; })();
  g.lei = (() => { const L = []; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; const b2 = sph(0.032, 8, 6); b2.translate(Math.cos(a) * 0.15, 0.39 - 0.03 * Math.max(0, Math.sin(a)), Math.sin(a) * 0.12); L.push(b2); } return M(L); })();
  g.phones = M([(() => { const t2 = new T.TorusGeometry(0.135, 0.012, 6, seg(20), Math.PI); t2.translate(0, 0.13, -0.01); return t2; })(), ...[-1, 1].map(sx => { const c = cyl(0.04, 0.04, 0.035, seg(16)); c.rotateZ(Math.PI / 2); c.translate(sx * 0.118, 0.13, -0.01); return c; })]);
  // held items (wrist space, hand points down -y, palm faces +z)
  g.cup = M([(() => { const c = cyl(0.042, 0.032, 0.12, seg(16)); c.translate(0, 0, 0); return c; })()]); g.cup.translate(0, -0.07, 0.045);
  g.straw = (() => { const c = cyl(0.004, 0.004, 0.12, 6); c.rotateZ(0.3); c.translate(0.012, -0.0, 0.045); return c; })();
  g.cone = M([(() => { const c = new T.ConeGeometry(0.032, 0.12, seg(14)); c.rotateX(Math.PI); c.translate(0, -0.06, 0.045); return c; })()]);
  g.scoop = (() => { const s2 = sph(0.038, 12, 10); s2.translate(0, 0.01, 0.045); return s2; })();
  g.slice = (() => { const sh = new T.Shape([new T.Vector2(0, 0), new T.Vector2(0.06, 0.16), new T.Vector2(-0.06, 0.16)]); const e = new T.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); e.translate(0, -0.12, 0.04); return e; })();
  CHGEO[key] = g; return g;
}

/* ---------- rig ---------- */
class Rig {
  constructor(app) {
    const bp = BODY_P[app.body] || BODY_P[1];
    this.bp = bp;
    const G0 = n => { const o = new T.Object3D(); o.name = n; return o; };
    this.root = G0('root'); this.body = G0('body'); this.root.add(this.body);
    this.hips = G0('hips'); this.body.add(this.hips); this.hipH = 0.9 * (0.96 + 0.04 * bp.leg);
    this.hips.position.y = this.hipH;
    this.spine = G0('spine'); this.spine.position.y = 0.1; this.hips.add(this.spine);
    this.chest = G0('chest'); this.spine.add(this.chest);
    this.neck = G0('neck'); this.neck.position.y = 0.41; this.chest.add(this.neck);
    this.head = G0('head'); this.head.position.y = 0.09; this.head.scale.setScalar(1.12); this.neck.add(this.head);
    const sx = 0.2 * bp.sh;
    this.shL = G0('shL'); this.shL.position.set(sx, 0.35, 0); this.chest.add(this.shL);
    this.shR = G0('shR'); this.shR.position.set(-sx, 0.35, 0); this.chest.add(this.shR);
    this.elL = G0('elL'); this.elL.position.y = -0.28; this.shL.add(this.elL);
    this.elR = G0('elR'); this.elR.position.y = -0.28; this.shR.add(this.elR);
    this.wrL = G0('wrL'); this.wrL.position.y = -0.25; this.elL.add(this.wrL);
    this.wrR = G0('wrR'); this.wrR.position.y = -0.25; this.elR.add(this.wrR);
    const hx = 0.09 * bp.hip;
    this.hpL = G0('hpL'); this.hpL.position.set(hx, -0.03, 0); this.hips.add(this.hpL);
    this.hpR = G0('hpR'); this.hpR.position.set(-hx, -0.03, 0); this.hips.add(this.hpR);
    this.knL = G0('knL'); this.knL.position.y = -0.42; this.hpL.add(this.knL);
    this.knR = G0('knR'); this.knR.position.y = -0.42; this.hpR.add(this.knR);
    this.anL = G0('anL'); this.anL.position.y = -0.41; this.knL.add(this.anL);
    this.anR = G0('anR'); this.anR.position.y = -0.41; this.knR.add(this.anR);
    this.root.scale.setScalar(app.height || 1);
  }
}
// part table: key, geometry getter, bone, color role, visibility, scale
function partList(app) {
  const g = n => n, bp = BODY_P[app.body] || BODY_P[1];
  const top = TOPS[app.top], bottom = BOTTOMS[app.bottom], dress = top === 'Sundress';
  const sleeves = top === 'Tee' || top === 'Aloha' || top === 'Stripes' || top === 'Polo';
  const chestKey = top === 'Aloha' ? 'chestAloha' : top === 'Stripes' ? 'chestStripe' : 'chest';
  const topC = OUTFIT[app.topColor], botC = dress ? OUTFIT[app.topColor] : OUTFIT[app.bottomColor];
  const skin = SKIN[app.skin], hairC = HAIR_COLORS[app.hairColor], shoe = SHOE_COLORS[app.shoes], accC = ACC_COLORS[app.accColor];
  const legLen = { Shorts: 1.0, Trunks: 0.7, Pants: 1.9, Skirt: 0 }[dress ? 'Skirt' : bottom];
  const P = [];
  const add = (k, geo, bone, color, sc) => P.push({ k, geo, bone, color, sc });
  add('pelvis', 'pelvis', 'hips', botC, [bp.hip, 1, bp.hip]);
  add(chestKey, 'chest', 'chest', topC, [bp.chest * bp.waist, 1, bp.chest]);
  add('neck', 'neck', 'neck', skin);
  add('head', 'head', 'head', skin);
  add('face', 'face', 'head', '#2a1c16');
  for (const s of ['L', 'R']) {
    add('upperArm' + s, 'upperArm', 'sh' + s, skin, [bp.arm, 1, bp.arm]);
    if (sleeves) add('sleeve' + s, 'sleeve', 'sh' + s, topC, [bp.arm, 1, bp.arm]);
    add('forearm' + s, 'forearm', 'el' + s, skin, [bp.arm * 0.97, 1, bp.arm * 0.97]);
    add('hand' + s, 'hand', 'wr' + s, skin);
    add('thigh' + s, 'thigh', 'hp' + s, skin, [bp.leg, 1, bp.leg]);
    if (legLen > 0) { add('hipCap' + s, 'hipCap', 'hp' + s, botC, [bp.leg, bp.leg, bp.leg]); const lw = legLen > 1.5 ? 'pantsUp' : legLen < 0.9 ? 'trunks' : 'shorts'; add(lw + s, { shorts: 'shortsLeg', trunks: 'trunksLeg', pantsUp: 'pantsLeg' }[lw], 'hp' + s, botC, [bp.leg, 1, bp.leg]); }
    add('shin' + s, 'shin', 'kn' + s, skin, [bp.leg * 0.98, 1, bp.leg * 0.98]);
    if (legLen > 1.5) { add('kneeCap' + s, 'kneeCap', 'kn' + s, botC, [bp.leg, bp.leg, bp.leg]); add('pants' + s, 'pantsShin', 'kn' + s, botC, [bp.leg, 1, bp.leg]); }
    add('foot' + s, 'foot', 'an' + s, shoe);
  }
  if (dress || bottom === 'Skirt') add('skirt', 'skirt', 'hips', botC, [bp.hip, 1, bp.hip]);
  if (app.hair < 8) add('hair' + app.hair, 'hair' + app.hair, 'head', hairC);
  const acc = ACCS[app.acc];
  if (acc === 'Sunglasses') add('shades', 'shades', 'head', '#15181d');
  if (acc === 'Sun hat') add('sunhat', 'sunhat', 'head', ['#e8d29a', '#f4f1e8', '#ff8fab', '#2fd3c6', '#10264a', '#ffc95c'][app.accColor]);
  if (acc === 'Captain cap') { add('capTop', 'capTop', 'head', '#f4f6f8'); add('capBand', 'capBand', 'head', '#10264a'); add('capVisor', 'capVisor', 'head', '#14161b'); add('capBadge', 'capBadge', 'head', '#ffc95c'); }
  if (acc === 'Flower lei') add('lei', 'lei', 'chest', accC);
  if (acc === 'Headphones') add('phones', 'phones', 'head', accC);
  return P;
}
const HELD = { cup: ['cup', 'straw'], cone: ['cone', 'scoop'], slice: ['slice'] };

/* ---------- poses ---------- */
const PK = ['hipX', 'hipY', 'hipRx', 'hipRy', 'hipRz', 'spRx', 'spRy', 'spRz', 'hdRx', 'hdRy', 'hdRz', 'shLx', 'shLy', 'shLz', 'elL', 'shRx', 'shRy', 'shRz', 'elR', 'hpLx', 'hpLz', 'knL', 'anL', 'hpRx', 'hpRz', 'knR', 'anR', 'rootRx', 'rootRz', 'rootY', 'rootZ'];
function zeroPose() { const p = {}; for (const k of PK) p[k] = 0; return p; }
const _tp = zeroPose();
function poseTarget(c, t) {
  const p = _tp; for (const k of PK) p[k] = 0;
  const a = c.anim, ph = c.phase, beat = c.beat;
  p.shLz = 0.09; p.shRz = 0.09; p.elL = 0.15; p.elR = 0.15; p.anL = 0; p.anR = 0;
  const breath = Math.sin(t * 1.7 + c.seed) * 0.012;
  switch (a) {
    case 'idle': default: {
      p.hipY = breath * 0.5; p.spRx = 0.02 + breath; p.hdRy = Math.sin(t * 0.37 + c.seed) * 0.3 * c.look; p.hdRx = Math.sin(t * 0.23 + c.seed * 2) * 0.06;
      if (c.idleStyle === 1) { p.shLz = 0.55; p.shRz = 0.55; p.elL = 1.7; p.elR = 1.7; p.shLy = -0.5; p.shRy = -0.5; }
      else if (c.idleStyle === 2) { p.hipRz = 0.05; p.hpLz = 0.06; p.knR = 0.18; p.hipX = 0.03; }
      break;
    }
    case 'walk': {
      const v = c.speed, run = smooth(2.6, 5.2, v), A = lerp(0.42, 0.78, run) * clamp(v / 1.1, 0, 1);
      const s = Math.sin(ph), co = Math.cos(ph);
      p.hpLx = s * A; p.hpRx = -s * A;
      p.knL = 0.08 + A * (1.15 + run * 0.9) * Math.max(0, Math.cos(ph - 0.4)) ** 1.4;
      p.knR = 0.08 + A * (1.15 + run * 0.9) * Math.max(0, Math.cos(ph + Math.PI - 0.4)) ** 1.4;
      p.anL = -p.hpLx * 0.3; p.anR = -p.hpRx * 0.3;
      p.shLx = -s * A * 0.95; p.shRx = s * A * 0.95; p.elL = 0.25 + run * 1.15 + Math.max(0, -s) * 0.2; p.elR = 0.25 + run * 1.15 + Math.max(0, s) * 0.2;
      p.shLz = 0.12; p.shRz = 0.12;
      p.hipY = -Math.abs(s) * 0.035 * (1 + run) + 0.01; p.hipRy = -s * 0.1; p.spRy = s * 0.14; p.spRx = 0.04 + run * 0.16; p.hipRz = co * 0.03;
      break;
    }
    case 'air': {
      p.hpLx = 0.55; p.hpRx = 0.2; p.knL = 0.9; p.knR = 0.45; p.shLx = 0.4; p.shRx = 0.25; p.shLz = 0.7; p.shRz = 0.7; p.elL = 0.5; p.elR = 0.5; p.spRx = 0.05; break;
    }
    case 'swim': {
      p.rootRx = 1.38; p.hdRx = -0.55;
      p.shLx = ph; p.shRx = ph + Math.PI; p.shLz = 0.25; p.shRz = 0.25; p.elL = 0.3 + 0.3 * Math.max(0, Math.sin(ph)); p.elR = 0.3 + 0.3 * Math.max(0, Math.sin(ph + Math.PI));
      p.hpLx = Math.sin(ph * 2.2) * 0.3; p.hpRx = -Math.sin(ph * 2.2) * 0.3; p.knL = 0.2; p.knR = 0.2; p.spRy = Math.sin(ph) * 0.15; p.anL = -0.6; p.anR = -0.6;
      break;
    }
    case 'tread': {
      p.shLz = 1.15 + Math.sin(t * 3.1) * 0.25; p.shRz = 1.15 + Math.sin(t * 3.1 + 1) * 0.25; p.shLx = 0.35; p.shRx = 0.35; p.elL = 0.5; p.elR = 0.5;
      p.hpLx = Math.sin(t * 2.4) * 0.45 + 0.3; p.hpRx = -Math.sin(t * 2.4) * 0.45 + 0.3; p.knL = 0.7 + Math.cos(t * 2.4) * 0.3; p.knR = 0.7 - Math.cos(t * 2.4) * 0.3;
      p.hdRx = -0.1; break;
    }
    case 'soak': {
      p.hipY = -0.42; p.hpLx = 1.25; p.hpRx = 1.25; p.knL = 1.0; p.knR = 1.0; p.spRx = -0.25; p.shLz = 1.25; p.shRz = 1.25; p.elL = 0.3; p.elR = 0.3; p.hdRx = -0.15; p.shLx = -0.2; p.shRx = -0.2;
      break;
    }
    case 'lie': {
      p.rootRx = -1.5; p.rootY = 0.12; p.spRx = 0.6; p.hdRx = 0.12;
      p.shLx = 2.55; p.shRx = 2.55; p.shLz = 0.5; p.shRz = 0.5; p.elL = 2.25; p.elR = 2.25;
      p.hpRx = 0.42 * c.var; p.knR = 0.9 * c.var; p.knL = 0.05; p.anL = 0.4; p.anR = 0.4;
      break;
    }
    case 'sit': {
      const seat = c.seat || 0.8; p.hipY = seat - c.rig.hipH + 0.07;
      p.hpLx = 1.45; p.hpRx = 1.45; p.knL = 1.5 - (seat > 0.6 ? 0.25 : 0); p.knR = 1.45; p.hpLz = 0.05; p.hpRz = 0.05;
      p.shLx = 0.45; p.shRx = 0.45; p.elL = 0.7; p.elR = 0.7; p.spRx = 0.08; p.hdRy = Math.sin(t * 0.3 + c.seed) * 0.25;
      break;
    }
    case 'dance': danceTarget(c, p, t, beat); break;
    case 'wave': {
      p.shRz = 2.55; p.shRx = 0.25; p.elR = 0.55 + Math.sin(t * 10) * 0.45; p.hdRz = 0.08; p.spRz = -0.05; p.hipY = breath;
      break;
    }
    case 'cheer': {
      const b = Math.abs(Math.sin(t * 5)); p.shLx = 2.85; p.shRx = 2.85; p.shLz = 0.45; p.shRz = 0.45; p.elL = 0.2; p.elR = 0.2; p.hipY = -0.04 * b; p.knL = 0.15 * b; p.knR = 0.15 * b; p.hdRx = -0.2;
      break;
    }
    case 'pose': {
      p.shLz = 1.5; p.shRz = 1.5; p.shLx = 0.12; p.shRx = 0.12; p.elL = 0.05; p.elR = 0.05; p.hdRx = -0.22; p.spRx = -0.08; p.hpLx = 0.12; p.knL = 0.1;
      break;
    }
    case 'yoga': {
      p.hpLx = 0.25; p.hpLz = 1.05; p.knL = 2.3; p.anL = 0.4; p.shLx = 3.05; p.shRx = 3.05; p.shLz = -0.12; p.shRz = -0.12; p.elL = 0.15; p.elR = 0.15; p.hipX = -0.03;
      break;
    }
    case 'slide': {
      p.rootRx = -1.32; p.spRx = 0.35; p.hdRx = 0.25; p.shLx = 2.9; p.shRx = 2.9; p.shLz = 0.35; p.shRz = 0.35; p.elL = 0.2; p.elR = 0.2; p.knL = 0.08; p.knR = 0.08;
      break;
    }
    case 'zip': {
      p.shLx = 3.05; p.shRx = 3.05; p.shLz = 0.14; p.shRz = 0.14; p.elL = 0.12; p.elR = 0.12; p.hpLx = 0.4 + Math.sin(t * 2) * 0.1; p.hpRx = 0.3 - Math.sin(t * 2) * 0.1; p.knL = 0.45; p.knR = 0.35; p.hdRx = -0.15;
      break;
    }
    case 'surf': {
      const ln = c.lean || 0;
      p.hipY = -0.2; p.hpLx = 0.6; p.hpRx = 0.6; p.knL = 1.0; p.knR = 1.0; p.hpLz = 0.22; p.hpRz = 0.22; p.anL = -0.3; p.anR = -0.3;
      p.spRx = 0.3; p.shLz = 1.25 + ln * 0.4; p.shRz = 1.25 - ln * 0.4; p.elL = 0.35; p.elR = 0.35; p.rootRz = -ln * 0.3; p.hipRy = 0.35; p.hdRy = -0.3; p.hdRx = -0.1;
      break;
    }
    case 'tumble': {
      p.rootRx = 1.0 + Math.sin(t * 9) * 0.7; p.rootRz = Math.sin(t * 7) * 0.5; p.shLx = 2.4 + Math.sin(t * 13) * 0.6; p.shRx = 2.2 + Math.cos(t * 11) * 0.6; p.shLz = 0.8; p.shRz = 0.8;
      p.hpLx = 0.9 + Math.sin(t * 10) * 0.5; p.hpRx = 0.4 + Math.cos(t * 9) * 0.5; p.knL = 1.2; p.knR = 0.7; break;
    }
    case 'putt': {
      const sw = c.swing || 0;
      p.spRx = 0.55; p.hdRx = 0.4; p.hipY = -0.05; p.knL = 0.28; p.knR = 0.28; p.hpLx = 0.22; p.hpRx = 0.22; p.hpLz = 0.12; p.hpRz = 0.12;
      p.shLx = 0.55 + sw * 0.5; p.shRx = 0.55 + sw * 0.5; p.shLz = -0.05; p.shRz = -0.05; p.elL = 0.15; p.elR = 0.15; p.shLy = 0.35; p.shRy = 0.35;
      break;
    }
    case 'slot': case 'cards': {
      const seat = c.seat || 0.8; p.hipY = seat - c.rig.hipH + 0.07;
      p.hpLx = 1.45; p.hpRx = 1.45; p.knL = 1.3; p.knR = 1.3; p.spRx = 0.12;
      if (a === 'slot') { const tap = Math.max(0, Math.sin(t * 2.2 + c.seed)) ** 6; p.shLx = 0.55; p.elL = 1.5; p.shRx = 0.9 + tap * 0.35; p.elR = 1.0 - tap * 0.4; p.hdRx = -0.05; }
      else { p.shLx = 0.75; p.shRx = 0.75; p.elL = 1.25; p.elR = 1.25; p.shLz = 0.2; p.shRz = 0.2; p.hdRx = 0.2; }
      break;
    }
    case 'drink': {
      const cyc = (t + c.seed) % 4.5, up = cyc < 1.1 ? Math.sin(cyc / 1.1 * Math.PI) : 0;
      p.shRx = 0.25 + up * 0.55; p.elR = 1.35 + up * 1.05; p.shRz = 0.15; p.hdRx = -up * 0.2; p.hipY = breath; p.hdRy = Math.sin(t * 0.3 + c.seed) * 0.3;
      break;
    }
    case 'shootAim': { p.shLx = 1.9; p.shRx = 2.0; p.elL = 1.6; p.elR = 1.75; p.shLz = 0.3; p.shRz = 0.15; p.knL = 0.35; p.knR = 0.35; p.hpLx = 0.2; p.hpRx = 0.2; p.hipY = -0.06; p.hdRx = -0.2; break; }
    case 'shoot': { p.shLx = 2.75; p.shRx = 2.9; p.elL = 0.25; p.elR = 0.1; p.shLz = 0.25; p.hdRx = -0.25; p.anL = 0.4; p.anR = 0.4; break; }
    case 'gaze': {
      p.spRx = 0.26; p.shLx = 0.95; p.shRx = 0.95; p.elL = 1.0; p.elR = 1.0; p.shLz = 0.25; p.shRz = 0.25; p.hdRx = -0.15 + Math.sin(t * 0.2 + c.seed) * 0.08; p.hdRy = Math.sin(t * 0.27 + c.seed) * 0.35;
      p.hpRx = -0.05; p.knR = 0.15; p.hipY = -0.02;
      break;
    }
    case 'talk': {
      p.shLx = 0.4 + Math.sin(t * 2.3 + c.seed) * 0.2; p.elL = 1.1 + Math.sin(t * 3.1) * 0.3; p.shRx = 0.3 + Math.sin(t * 1.7) * 0.2; p.elR = 0.9; p.hdRy = Math.sin(t * 0.9) * 0.15; p.hdRx = Math.sin(t * 3.7) * 0.04;
      break;
    }
    case 'bartend': {
      p.shLx = 0.7; p.shRx = 0.5 + Math.sin(t * 6 + c.seed) * 0.4; p.elL = 1.4; p.elR = 1.6 + Math.sin(t * 6) * 0.3; p.spRx = 0.1; p.hdRx = 0.1; p.hdRy = Math.sin(t * 0.5) * 0.3;
      break;
    }
  }
  return p;
}
function danceTarget(c, p, t, b) {
  const st = c.danceStyle % 6, s1 = Math.sin(Math.PI * b), half = Math.sin(Math.PI * b * 0.5), even = Math.floor(b) % 2 === 0;
  const bounce = Math.abs(s1);
  p.hipY = -0.05 * bounce; p.knL = 0.18 + 0.22 * bounce; p.knR = 0.18 + 0.22 * bounce; p.hpLx = 0.1 + 0.1 * bounce; p.hpRx = 0.1 + 0.1 * bounce; p.hdRx = 0.06 * s1;
  if (st === 0) { p.shLx = even ? 2.6 : 1.2; p.shRx = even ? 1.2 : 2.6; p.shLz = 0.4; p.shRz = 0.4; p.elL = even ? 0.3 : 1.3; p.elR = even ? 1.3 : 0.3; p.spRy = half * 0.15; }
  else if (st === 1) { p.hipX = half * 0.12; p.hipRz = half * 0.1; p.spRz = -half * 0.16; p.shLz = 2.35 + s1 * 0.3; p.shRz = 2.35 - s1 * 0.3; p.elL = 0.35; p.elR = 0.35; p.hpLz = Math.max(0, half) * 0.25; p.hpRz = Math.max(0, -half) * 0.25; }
  else if (st === 2) { const up = Math.floor(b / 2) % 2 === 0; p.shRz = up ? 2.3 : -0.25; p.shRx = up ? 0.6 : 0.7; p.elR = 0.05; p.shLz = 0.75; p.elL = 1.75; p.shLy = -0.6; p.hipRz = half * 0.1; p.hdRz = up ? 0.15 : -0.1; p.hdRy = up ? -0.3 : 0.2; }
  else if (st === 3) { p.spRy = s1 * 0.55; p.hipRy = -s1 * 0.35; p.knL = 0.45; p.knR = 0.45; p.hipY = -0.08; p.shLz = 0.75; p.shRz = 0.75; p.shLx = 0.6; p.shRx = 0.6; p.elL = 1.7; p.elR = 1.7; }
  else if (st === 4) { p.shLx = 2.85; p.shRx = 2.85; p.shLz = 0.35 + bounce * 0.25; p.shRz = 0.35 + bounce * 0.25; p.elL = 0.25; p.elR = 0.25; p.hdRx = -0.2; p.spRz = half * 0.12; }
  else { const r = mulberry(Math.floor(b) * 31 + c.seed * 97 | 0); p.shLz = r() * 1.8; p.shRz = r() * 1.8; p.shLx = r() * 1.6; p.shRx = r() * 1.6; p.elL = 1.57 * (r() < 0.5 ? 1 : 0); p.elR = 1.57 * (r() < 0.5 ? 1 : 0); p.hdRy = (r() - 0.5) * 0.8; p.spRy = (r() - 0.5) * 0.4; }
}
class Char {
  constructor(app, o = {}) {
    this.app = app; this.rig = new Rig(app);
    this.p = zeroPose(); this.anim = 'idle'; this.phase = 0; this.speed = 0; this.beat = 0;
    this.seed = o.seed !== undefined ? o.seed : Math.random() * 100; this.look = 1; this.idleStyle = 0; this.danceStyle = 0; this.var = 1; this.seat = 0.8;
    this.rate = 10; this.held = null;
  }
  setAnim(a) {
    if (a === this.anim) return;
    if (this.anim === 'swim') { this.p.shLx = wrapAngle(this.p.shLx); this.p.shRx = wrapAngle(this.p.shRx); }
    this.anim = a;
  }
  update(dt, t) {
    if (this.anim === 'walk') this.phase += dt * TAU * (0.85 + this.speed * 0.34);
    else if (this.anim === 'swim') this.phase += dt * 3.2;
    const tgt = poseTarget(this, t);
    if (this.useT > 0) {
      this.useT = Math.max(0, this.useT - dt / 1.15); const up = Math.sin((1 - this.useT) * Math.PI);
      tgt.shRx = 0.45 + up * 0.75; tgt.elR = 1.35 + up * 1.15; tgt.shRz = 0.12; tgt.shRy = -0.15 * up; tgt.hdRx = -up * 0.22;
    } else if (this.held && this.held !== 'putter' && !this.noSip && (this.anim === 'idle' || this.anim === 'sit' || this.anim === 'talk' || this.anim === 'walk')) {
      const cyc = (t + this.seed) % 5, up = cyc < 1.1 ? Math.sin(cyc / 1.1 * Math.PI) : 0;
      tgt.shRx = (this.anim === 'walk' ? 0.35 : 0.3) + up * 0.5; tgt.elR = 1.3 + up * 1.1; tgt.shRz = 0.15; if (this.anim !== 'walk') tgt.hdRx = -up * 0.18;
    }
    const k = this.anim === 'swim' ? 18 : this.anim === 'dance' && this.danceStyle === 5 ? 22 : this.rate;
    const p = this.p; for (const key of PK) p[key] = damp(p[key], tgt[key], k, dt);
    this.apply();
  }
  apply() {
    const r = this.rig, p = this.p;
    r.body.rotation.set(p.rootRx, 0, p.rootRz); r.body.position.set(0, p.rootY, p.rootZ);
    r.hips.position.set(p.hipX, r.hipH + p.hipY, 0); r.hips.rotation.set(p.hipRx, p.hipRy, p.hipRz);
    r.spine.rotation.set(p.spRx, p.spRy, p.spRz);
    r.head.rotation.set(p.hdRx, p.hdRy, p.hdRz);
    r.shL.rotation.set(-p.shLx, p.shLy, p.shLz); r.elL.rotation.x = -p.elL;
    r.shR.rotation.set(-p.shRx, -p.shRy, -p.shRz); r.elR.rotation.x = -p.elR;
    r.hpL.rotation.set(-p.hpLx, 0, p.hpLz); r.knL.rotation.x = p.knL; r.anL.rotation.x = p.anL;
    r.hpR.rotation.set(-p.hpRx, 0, -p.hpRz); r.knR.rotation.x = p.knR; r.anR.rotation.x = p.anR;
  }
}

/* ---------- mesh mode (player, creator, captain) ---------- */
const CHMAT = new Map();
function charMat(hex, variant) {
  const key = hex + '|' + (variant || '');
  if (CHMAT.has(key)) return CHMAT.get(key);
  const o = { color: lin(hex), roughness: variant === 'skin' ? 0.62 : variant === 'hair' ? 0.55 : 0.75, metalness: 0 };
  if (variant === 'chestAloha') o.map = TEX.aloha; if (variant === 'chestStripe') o.map = TEX.stripes;
  if (variant === 'glossy') { o.roughness = 0.15; o.metalness = 0.4; }
  const m = new T.MeshStandardMaterial(o); CHMAT.set(key, m); return m;
}
function buildCharMesh(c) {
  const geos = charGeos(true), r = c.rig;
  if (c.meshes) for (const m of c.meshes) m.parent && m.parent.remove(m);
  c.meshes = [];
  for (const pt of partList(c.app)) {
    const geo = geos[pt.geo] || (pt.geo.startsWith('hair') ? geos.hair[+pt.geo.slice(4)] : null); if (!geo) continue;
    const variant = pt.k.startsWith('chestA') ? 'chestAloha' : pt.k.startsWith('chestS') ? 'chestStripe' : pt.color === SKIN[c.app.skin] ? 'skin' : pt.k.startsWith('hair') ? 'hair' : pt.k === 'shades' ? 'glossy' : '';
    const m = new T.Mesh(geo, charMat(pt.color, variant));
    if (pt.sc) m.scale.set(pt.sc[0], pt.sc[1], pt.sc[2]);
    m.castShadow = true; m.receiveShadow = true;
    r[pt.bone].add(m); c.meshes.push(m);
  }
  setHeld(c, c.held);
  return c;
}
function setHeld(c, item, color) {
  if (item && !HELD[item]) return setHeldItem(c, item, color);
  c.held = item;
  if (c.heldMeshes) for (const m of c.heldMeshes) m.parent && m.parent.remove(m);
  c.heldMeshes = [];
  if (!item || !c.meshes) return;
  const geos = charGeos(true);
  const cols = { cup: [color || '#ff8a5c', '#f4f6f8'], cone: ['#d9a35a', color || '#ff8fab'], slice: ['#f2c14e'] }[item];
  HELD[item].forEach((k, i) => { const m = new T.Mesh(geos[k], charMat(cols[i])); m.castShadow = true; c.rig.wrR.add(m); c.heldMeshes.push(m); });
}

/* ---------- crowd (instanced) ---------- */
class Crowd {
  constructor(max) {
    this.max = max; this.chars = []; this.meshes = {}; this.group = new T.Group(); this.active = max;
    const geos = charGeos(false);
    const keys = new Set(['pelvis', 'chest', 'chestAloha', 'chestStripe', 'neck', 'head', 'face', 'skirt', 'shades', 'sunhat', 'capTop', 'capBand', 'capVisor', 'capBadge', 'lei', 'phones', 'cup', 'straw']);
    for (const s of ['L', 'R']) for (const k of ['upperArm', 'sleeve', 'forearm', 'hand', 'thigh', 'hipCap', 'shorts', 'trunks', 'pantsUp', 'shin', 'kneeCap', 'pants', 'foot']) keys.add(k + s);
    for (let i = 0; i < 8; i++) keys.add('hair' + i);
    const geoOf = k => {
      if (k.startsWith('hair')) return geos.hair[+k.slice(4)];
      if (k.startsWith('chest')) return geos.chest;
      const base = k.replace(/[LR]$/, '');
      return { shorts: geos.shortsLeg, trunks: geos.trunksLeg, pantsUp: geos.pantsLeg, pants: geos.pantsShin }[base] || geos[base];
    };
    const zero = new T.Matrix4().makeScale(0, 0, 0);
    for (const k of keys) {
      const variant = k === 'chestAloha' ? 'chestAloha' : k === 'chestStripe' ? 'chestStripe' : '';
      const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: k.startsWith('hair') ? 0.55 : k === 'shades' ? 0.15 : 0.7, map: variant === 'chestAloha' ? TEX.aloha : variant === 'chestStripe' ? TEX.stripes : null });
      const m = new T.InstancedMesh(geoOf(k), mat, max);
      for (let i = 0; i < max; i++) m.setMatrixAt(i, zero);
      m.setColorAt(0, new T.Color(1, 1, 1)); m.instanceColor.needsUpdate = true;
      m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.count = max;
      this.meshes[k] = m; this.group.add(m);
    }
    this._S = new T.Matrix4(); this._M = new T.Matrix4();
    G.scene.add(this.group);
  }
  assign(i, c) {
    this.chars[i] = c; c.slot = i;
    const zero = new T.Matrix4().makeScale(0, 0, 0);
    for (const k in this.meshes) this.meshes[k].setMatrixAt(i, zero);
    c.slots = [];
    const parts = partList(c.app).concat([{ k: 'cup', bone: 'wrR', color: '#ff8a5c', held: true }, { k: 'straw', bone: 'wrR', color: '#f4f6f8', held: true }]);
    for (const pt of parts) {
      const mesh = this.meshes[pt.k]; if (!mesh) continue;
      mesh.setColorAt(i, lin(pt.color)); mesh.instanceColor.needsUpdate = true;
      const S = pt.sc ? new T.Matrix4().makeScale(pt.sc[0], pt.sc[1], pt.sc[2]) : null;
      c.slots.push({ mesh, bone: c.rig[pt.bone], S, held: !!pt.held });
    }
    for (const k in this.meshes) this.meshes[k].instanceMatrix.needsUpdate = true;
  }
  setActive(n) { this.active = Math.min(n, this.max); for (const k in this.meshes) this.meshes[k].count = this.active; }
  sync() {
    const zero = this._S;
    for (let i = 0; i < this.active; i++) {
      const c = this.chars[i]; if (!c) continue;
      const hidden = c.hidden;
      c.rig.root.updateMatrixWorld(true);
      for (const s of c.slots) {
        if (hidden || (s.held && c.held !== 'cup')) { zero.makeScale(0, 0, 0); s.mesh.setMatrixAt(i, zero); continue; }
        if (s.S) { this._M.multiplyMatrices(s.bone.matrixWorld, s.S); s.mesh.setMatrixAt(i, this._M); }
        else s.mesh.setMatrixAt(i, s.bone.matrixWorld);
      }
    }
    for (const k in this.meshes) this.meshes[k].instanceMatrix.needsUpdate = true;
  }
}

/* ---- 32_items.js ---- */
/* ================= held items: food, drinks, putter (wrist space: hand points -y, palm faces +z) ================= */
const ITEMGEO = {};
function itemParts(model) {
  const key = model;
  if (!ITEMGEO[key]) {
    const P = [];
    const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
    const sph = (r, a = 14, b = 10) => new T.SphereGeometry(r, a, b);
    switch (model) {
      case 'burger':
        P.push([at(cyl(0.056, 0.05, 0.026, 18), 0, -0.135, 0.06), '#d99a4e']);
        P.push([at(cyl(0.058, 0.058, 0.022, 18), 0, -0.114, 0.06), '#5a3018']);
        P.push([at(box(0.1, 0.006, 0.1), 0, -0.1, 0.06, 0, 0.6), '#ffc22e']);
        P.push([at(cyl(0.064, 0.064, 0.007, 18), 0, -0.094, 0.06), '#5fb24a']);
        P.push([at((() => { const g = sph(0.057, 18, 10); g.scale(1, 0.62, 1); return g; })(), 0, -0.078, 0.06), '#e0a356']);
        break;
      case 'hotdog':
        P.push([at((() => { const g = sph(1, 16, 10); g.scale(0.034, 0.028, 0.092); return g; })(), 0, -0.1, 0.06), '#e2a861']);
        P.push([at((() => { const g = sph(1, 14, 8); g.scale(0.02, 0.02, 0.108); return g; })(), 0, -0.084, 0.06), '#b0442d']);
        P.push([at(box(0.008, 0.004, 0.15), 0, -0.064, 0.06, 0, 0, 0), '#ffd23f']);
        break;
      case 'fries':
        P.push([at(box(0.075, 0.085, 0.045), 0, -0.11, 0.06), '#e8322b']);
        for (let i = 0; i < 7; i++) P.push([at(box(0.009, 0.075, 0.009), -0.027 + i * 0.009, -0.06 + (i % 3) * 0.008, 0.06 + ((i % 2) - 0.5) * 0.014, 0, 0, (i - 3) * 0.08), '#f6c344']);
        break;
      case 'cupcake':
        P.push([at(cyl(0.04, 0.03, 0.045, 16), 0, -0.13, 0.06), '#ff6a55']);
        P.push([at((() => { const g = sph(0.046, 16, 10); g.scale(1, 0.75, 1); return g; })(), 0, -0.097, 0.06), '#ffd1dc', true]);
        P.push([at(sph(0.013, 10, 8), 0, -0.064, 0.06), '#c8102e']);
        break;
      case 'taco':
        P.push([at((() => { const g = new T.CylinderGeometry(0.065, 0.065, 0.045, 18, 1, true, 0, Math.PI); g.rotateZ(Math.PI / 2); return g; })(), 0, -0.1, 0.06), '#f3c14f']);
        P.push([at((() => { const g = sph(1, 12, 8); g.scale(0.018, 0.03, 0.05); return g; })(), 0, -0.07, 0.06), '#5fb24a']);
        P.push([at((() => { const g = sph(1, 10, 8); g.scale(0.014, 0.016, 0.04); return g; })(), 0.01, -0.064, 0.05), '#d9472b']);
        break;
      case 'coconut':
        P.push([at(sph(0.072, 18, 14), 0, -0.13, 0.065), '#6b4a2b']);
        P.push([at(cyl(0.005, 0.005, 0.15, 6), 0.02, -0.04, 0.07, 0, 0, -0.25), '#f4f6f8', true]);
        P.push([at(new T.ConeGeometry(0.055, 0.03, 12), -0.02, -0.035, 0.06), '#ff6a55']);
        break;
      case 'bottle':
        P.push([at(cyl(0.027, 0.027, 0.16, 14), 0, -0.12, 0.06), '#8fe3f0', true]);
        P.push([at(cyl(0.012, 0.018, 0.035, 12), 0, -0.024, 0.06), '#8fe3f0', true]);
        P.push([at(cyl(0.013, 0.013, 0.014, 12), 0, -0.002, 0.06), '#2fd3c6']);
        break;
      case 'fruitcup':
        P.push([at(cyl(0.045, 0.034, 0.075, 16), 0, -0.12, 0.06), '#e8f3f5']);
        for (let i = 0; i < 6; i++) P.push([at(box(0.022, 0.022, 0.022), -0.022 + (i % 3) * 0.022, -0.078 + Math.floor(i / 3) * 0.012, 0.05 + (i % 2) * 0.02, i, i * 0.7, 0), ['#ff6a55', '#ffc95c', '#7bd389', '#ff8fab', '#ffb547', '#b18cff'][i]]);
        break;
      case 'cookie':
        P.push([at(cyl(0.048, 0.048, 0.013, 18), 0, -0.1, 0.06, Math.PI / 2), '#c98b4a']);
        for (let i = 0; i < 5; i++) P.push([at(sph(0.008, 8, 6), -0.025 + i * 0.012, -0.1 + ((i % 2) - 0.5) * 0.03, 0.068), '#3a2416']);
        break;
      case 'putter':
        P.push([at(cyl(0.008, 0.008, 0.86, 8), 0, -0.47, 0.03), '#c8d1da']);
        P.push([at(box(0.03, 0.03, 0.11), 0, -0.9, 0.06), '#2a3340']);
        P.push([at(cyl(0.013, 0.013, 0.18, 8), 0, -0.1, 0.03), '#10264a']);
        break;
      default:
        P.push([at(cyl(0.042, 0.032, 0.12, 16), 0, -0.07, 0.045), '#ff8a5c', true]);
    }
    ITEMGEO[key] = P;
  }
  return ITEMGEO[key];
}
function setHeldItem(c, model, color) {
  c.held = model; c.heldScale = 1;
  if (c.heldMeshes) for (const m of c.heldMeshes) m.parent && m.parent.remove(m);
  c.heldMeshes = [];
  if (!model || !c.meshes) return;
  const holder = new T.Group(); c.rig.wrR.add(holder); c.heldMeshes.push(holder);
  for (const [g, col, tintable] of itemParts(model)) { const m = new T.Mesh(g, charMat(tintable && color ? color : col)); m.castShadow = true; holder.add(m); }
}
function setHeldScale(c, s) { c.heldScale = s; if (c.heldMeshes) for (const m of c.heldMeshes) { m.scale.setScalar(Math.max(0.05, s)); } }

/* ---- 40_player.js ---- */
/* ================= player controller, input, camera ================= */
const Input = { mx: 0, my: 0, run: false, jump: false, keys: new Set(), camDX: 0, camDY: 0, zoom: 0, act: false, joyId: null, joyOrigin: null, camIds: new Map(), pinch: null };
const Player = {
  char: null, pos: V3(0, DK.top, -88), velY: 0, yaw: 0, onGround: true, mode: 'walk', water: null, level: 'd15',
  lastSafe: V3(0, DK.top, -88), safeT: 0, emote: null, emoteT: 0, activity: null, radius: 0.32, airT: 0, visited: new Set(), swimT: 0
};
const Cam = { yaw: 0.0, pitch: 0.32, dist: 6.2, minDist: 2.2, maxDist: 16, pos: V3(), look: V3(), target: V3(), custom: null, shake: 0 };

function initInput() {
  const cv = $('game');
  const isLeft = x => x < innerWidth * 0.42;
  cv.addEventListener('pointerdown', e => {
    if (G.state !== 'play' && G.state !== 'photo' && G.state !== 'creator') return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { }
    if (G.pointerHook && G.pointerHook('down', e)) return;
    if (G.state === 'creator') { Input.camIds.set(e.pointerId, { x: e.clientX, y: e.clientY }); return; }
    if (e.pointerType !== 'mouse' && isLeft(e.clientX) && Input.joyId === null && G.state === 'play') {
      Input.joyId = e.pointerId; Input.joyOrigin = { x: e.clientX, y: e.clientY };
      const j = $('joy'); j.style.display = 'block'; j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.firstElementChild.style.transform = '';
      $('joyHint').hidden = true;
    } else {
      Input.camIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Input.camIds.size === 2) { const [a, b] = [...Input.camIds.values()]; Input.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    }
  });
  cv.addEventListener('pointermove', e => {
    if (G.pointerHook && G.pointerHook('move', e)) return;
    if (e.pointerId === Input.joyId) {
      const dx = e.clientX - Input.joyOrigin.x, dy = e.clientY - Input.joyOrigin.y, L = Math.hypot(dx, dy), R = 52;
      const k = L > R ? R / L : 1;
      Input.mx = dx * k / R; Input.my = -dy * k / R;
      $('joy').firstElementChild.style.transform = `translate(${dx * k}px,${dy * k}px)`;
      return;
    }
    const p = Input.camIds.get(e.pointerId); if (!p) return;
    if (Input.camIds.size === 2 && Input.pinch) {
      p.x = e.clientX; p.y = e.clientY; const [a, b] = [...Input.camIds.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      Input.zoom += (Input.pinch - d) * 0.03; Input.pinch = d; return;
    }
    Input.camDX += e.clientX - p.x; Input.camDY += e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => {
    if (G.pointerHook) G.pointerHook('up', e);
    if (e.pointerId === Input.joyId) { Input.joyId = null; Input.mx = 0; Input.my = 0; $('joy').style.display = 'none'; }
    Input.camIds.delete(e.pointerId); if (Input.camIds.size < 2) Input.pinch = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); Input.zoom += e.deltaY * 0.01; }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    Input.keys.add(e.code);
    if (G.state === 'play') {
      if (e.code === 'Space') { Input.jump = true; e.preventDefault(); onJumpPressed(); }
      if (e.code === 'KeyE' || e.code === 'Enter') { onActionPressed(); e.preventDefault(); }
      if (e.code === 'KeyQ') toggleEmotes();
      if (e.code === 'KeyF') consume();
      if (e.code === 'KeyT' && Net.room) { e.preventDefault(); openSheet('people'); }
      if (e.code === 'KeyM') openSheet('map');
      if (e.code === 'KeyP') openSheet('program');
      if (e.code === 'KeyC') enterPhoto();
      if (e.code === 'Escape') { closeSheet(); closePanel(); if (Player.activity && Player.activity.exitable !== false) endActivity(); }
      if (/^Digit[1-5]$/.test(e.code)) doEmote(['wave', 'dance', 'cheer', 'pose', 'sit'][+e.code.slice(5) - 1]);
    } else if (G.state === 'photo' && e.code === 'Escape') exitPhoto();
    else if (e.code === 'Escape') closeSheet();
  });
  window.addEventListener('keyup', e => Input.keys.delete(e.code));
  window.addEventListener('blur', () => { Input.keys.clear(); Input.mx = 0; Input.my = 0; });
}
function readKeys() {
  const k = Input.keys; let x = 0, y = 0;
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1; if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1; if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  const L = Math.hypot(x, y); if (L > 0) { x /= L; y /= L; }
  return { x: Input.joyId !== null ? Input.mx : x, y: Input.joyId !== null ? Input.my : y, run: k.has('ShiftLeft') || k.has('ShiftRight') || (Input.joyId !== null && Math.hypot(Input.mx, Input.my) > 0.88) };
}

function initPlayer(app) {
  const c = new Char(app, { seed: 1 }); c.look = 0.3;
  buildCharMesh(c);
  if (Player.char) G.scene.remove(Player.char.rig.root);
  Player.char = c; G.scene.add(c.rig.root);
}
function placePlayer(x, y, z, yaw) {
  Player.pos.set(x, y, z); Player.velY = 0; Player.yaw = yaw; Player.mode = 'walk'; Player.water = null; Player.onGround = true;
  Player.lastSafe.set(x, y, z);
  Cam.yaw = yaw + Math.PI; Cam.pitch = 0.3; Cam.pos.set(x - Math.sin(yaw) * 6, y + 3, z - Math.cos(yaw) * 6); Cam.look.set(x, y + 1.4, z);
}

function updatePlayer(dt) {
  const P = Player, c = P.char; if (!c) return;
  const inp = readKeys();
  const moving = Math.hypot(inp.x, inp.y) > 0.08;
  if (P.activity) {
    if (moving && P.activity.exitOnMove) endActivity();
    else { P.activity.update(dt, inp); syncPlayerRig(dt); return; }
  }
  if (moving && P.emote && P.emote !== 'wave' && P.emote !== 'cheer') P.emote = null;
  // movement intent relative to camera
  const fx = -Math.sin(Cam.yaw), fz = -Math.cos(Cam.yaw), rx = Math.cos(Cam.yaw), rz = -Math.sin(Cam.yaw);
  let mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
  const mag = Math.min(1, Math.hypot(inp.x, inp.y));
  const swimming = P.mode === 'swim';
  const speed = (swimming ? 1.7 : (inp.run ? 5.4 : 2.5)) * speedFactor();
  let vx = 0, vz = 0;
  if (moving) { const L = Math.hypot(mx, mz) || 1; vx = mx / L * speed * Math.max(mag, 0.35); vz = mz / L * speed * Math.max(mag, 0.35); P.yaw = dampAngle(P.yaw, Math.atan2(vx, vz), 12, dt); }
  const nx = P.pos.x + vx * dt, nz = P.pos.z + vz * dt;
  if (swimming) {
    const w = P.water;
    const inside = pip(nx, nz, w.poly);
    const gy = groundAt(nx, nz, w.top + 0.8, 0.1);
    if (w.sea && gy > w.top - 0.85) { P.pos.set(nx, gy, nz); P.mode = 'walk'; P.water = null; P.velY = 0; sfx('splash', 0.25); }
    else if (inside) { P.pos.x = nx; P.pos.z = nz; }
    else if (!w.sea && gy > -1e8 && gy <= w.top + 0.8 && gy > w.bottom + 0.3) { P.pos.set(nx, gy, nz); P.mode = 'walk'; P.water = null; P.velY = 0; sfx('splash', 0.25); }
    collide(P.pos, P.radius, P.pos.y - 1, P.pos.y + 1);
    if (P.water) P.pos.y = damp(P.pos.y, w.hot || w.shallow ? w.bottom : w.top - 1.42, 8, dt);
    P.swimT += dt;
    if (P.swimT > 1.2 && !w.hot) stamp('swim');
    if (w.id === 'overwater' && P.swimT > 1) stamp('overwater');
  } else {
    P.pos.x = nx; P.pos.z = nz;
    collide(P.pos, P.radius, P.pos.y + 0.3, P.pos.y + 1.6);
    // vertical
    const g = groundAt(P.pos.x, P.pos.z, P.pos.y, 0.6);
    P.velY -= 15 * dt; let ny = P.pos.y + P.velY * dt;
    if (g > -1e8 && ny <= g) { ny = g; P.velY = 0; P.onGround = true; P.airT = 0; }
    else if (g > -1e8 && P.onGround && P.velY <= 0 && P.pos.y - g < 0.75) { ny = g; P.velY = 0; }
    else { P.onGround = false; P.airT += dt; }
    P.pos.y = ny;
    if (World._lf) P.level = World._lf.level;
    // water entry
    const w = waterAt(P.pos.x, P.pos.z);
    if (w && P.pos.y < w.top - (w.hot || w.shallow ? 0.2 : 0.55)) {
      if (!w.hot && !w.shallow && P.airT > 0.25) { sfx('splash', 1); fxSplash(P.pos.x, w.top, P.pos.z, 1); }
      else sfx('splash', 0.35);
      P.mode = 'swim'; P.water = w; P.velY = 0; P.swimT = 0;
    }
    if (P.onGround && !w) { P.safeT += dt; if (P.safeT > 0.6 && clearance(P.pos.x, P.pos.z, P.pos.y + 0.2, P.pos.y + 1.6, 1.4) > 1.0) { P.lastSafe.copy(P.pos); P.safeT = 0; } }
    if (P.pos.y < 1.5 && P.level !== 'port') overboard();
    if (P.level === 'port' && P.pos.y < -12) overboard();
  }
  // animation state
  const hs = Math.hypot(vx, vz);
  c.speed = hs;
  if (P.mode === 'swim') c.setAnim(P.water.hot || P.water.shallow ? 'soak' : hs > 0.3 ? 'swim' : 'tread');
  else if (!P.onGround && P.airT > 0.12) c.setAnim('air');
  else if (hs > 0.2) c.setAnim('walk');
  else if (P.emote) c.setAnim(P.emote === 'sit' ? 'sit' : P.emote);
  else c.setAnim('idle');
  if (P.emote === 'sit') c.seat = 0.12;
  if (P.emoteT > 0) { P.emoteT -= dt; if (P.emoteT <= 0 && (P.emote === 'wave' || P.emote === 'cheer')) P.emote = null; }
  syncPlayerRig(dt);
}
function syncPlayerRig(dt) {
  const P = Player, c = P.char, r = c.rig.root;
  c.beat = Audio.beat();
  c.update(dt, G.time);
  let ox = 0, oz = 0, oy = 0;
  if (c.anim === 'swim') { ox = -Math.sin(P.yaw) * 0.85; oz = -Math.cos(P.yaw) * 0.85; oy = P.water ? (P.water.top - 0.15) - P.pos.y : 0; }
  r.position.set(P.pos.x + ox, P.pos.y + oy, P.pos.z + oz);
  r.rotation.set(0, P.yaw, 0);
  if (P.override) P.override(r);
}
function overboard() {
  const P = Player;
  fxSplash(P.pos.x, 0.5, P.pos.z, 2); sfx('splash', 1.2);
  toast('Passenger overboard!', 'The crew fished you out and dried you off.');
  P.pos.copy(P.lastSafe); P.velY = 0; P.mode = 'walk'; P.water = null;
}
function onJumpPressed() {
  const P = Player;
  if (P.activity) { if (P.activity.onJump) P.activity.onJump(); return; }
  if (P.mode === 'swim') return;
  if (P.onGround) { P.velY = 5.4; P.onGround = false; P.emote = null; }
}

/* ---------------- camera ---------------- */
function inRoomBox(x, y, z) {
  if (x > CASINO.x0 + 0.25 && x < CASINO.x1 - 0.25 && z > CASINO.z0 + 0.25 && z < CASINO.z1 - 0.25 && y > CASINO.y && y < CASINO.top - 0.2) return true;
  if (x > SUITE.x0 + 0.2 && x < 30.8 && z > SUITE.z0 + 0.2 && z < SUITE.z1 - 0.2 && y > SUITE.y && y < SUITE.top - 0.15) return true;
  return false;
}
function solidAt(x, y, z) {
  if (Player.level === 'casino' || Player.level === 'suite') { if (inRoomBox(x, y, z)) return false; if (Player.level === 'casino' || x < 29.2) return true; }
  if (y > -9 && y < 20) { const h = hullHalf(z, y); if (h > 0 && Math.abs(x) < h - 0.3 && !(y > 19.4)) return true; }
  if (y >= 20 && y < 51.7) {
    const w = wallHalf(z); if (w > 0 && Math.abs(x) < w - 0.3) {
      const inCanyon = Math.abs(x) < 11.7 && z > -39.7 && z < 61.7 && y > 26.05;
      if (!inCanyon) return true;
    }
    if (y < 44 && z > 149 && Math.abs(x) < hullHalf(z) - 1.4) { const zb = y < 29 ? 165 : y < 38 ? 160 : 155.5; if (z < zb) return true; }
  }
  if (y > 52 && y < 91 && Math.abs(x) < 4.4) { const u = (y - 52) / 39; const b = lerp(10.2, 8.0, u), cz = 80 + u * 3.2; if (Math.abs(z - cz) < b) { const se = Math.pow(Math.abs(x) / lerp(4.5, 3.4, u), 3) + Math.pow(Math.abs(z - cz) / b, 3); if (se < 1) return true; } }
  return false;
}
function updateCamera(dt) {
  const P = Player;
  if (G.camOverride) { Cam.pos.copy(G.camOverride.pos); Cam.look.copy(G.camOverride.look); finishCam(G.camOverride.fov || 55); return; }
  const sens = IS_TOUCH ? 0.0065 : 0.0048;
  Cam.yaw -= Input.camDX * sens; Cam.pitch = clamp(Cam.pitch + Input.camDY * sens * 0.8, -0.35, 1.25);
  Input.camDX = 0; Input.camDY = 0;
  Cam.dist = clamp(Cam.dist + Input.zoom, Cam.minDist, Cam.maxDist); Input.zoom = 0;
  if (P.activity && P.activity.camera) {
    const o = P.activity.camera(dt);
    if (o) { Cam.pos.lerp(o.pos, 1 - Math.exp(-(o.k || 6) * dt)); Cam.look.lerp(o.look, 1 - Math.exp(-(o.k || 6) * dt)); finishCam(o.fov, o.clipY !== undefined ? Cam.pos.y - o.clipY : 0); return; }
  }
  const tgt = Cam.target.set(P.pos.x, P.pos.y + 1.45, P.pos.z);
  if (P.mode === 'swim' && P.water) tgt.y = Math.max(tgt.y, P.water.top + 0.55);
  const pitch = P.mode === 'swim' ? Math.max(Cam.pitch, 0.38) : Cam.pitch;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const dir = _v1.set(Math.sin(Cam.yaw) * cp, sp, Math.cos(Cam.yaw) * cp);
  let d = Cam.dist;
  for (let s = 0.6; s <= Cam.dist; s += 0.35) {
    const x = tgt.x + dir.x * s, y = tgt.y + dir.y * s, z = tgt.z + dir.z * s;
    if (solidAt(x, y, z)) { d = Math.max(0.8, s - 0.45); break; }
  }
  const want = _v2.copy(tgt).addScaledVector(dir, d);
  const fl = groundAt(want.x, want.z, want.y + 0.2, 0);
  if (fl > -1e8 && want.y < fl + 0.35) want.y = fl + 0.35;
  const k = 1 - Math.exp(-14 * dt);
  Cam.pos.lerp(want, d < Cam.dist - 0.5 ? 1 - Math.exp(-28 * dt) : k);
  Cam.look.lerp(tgt, 1 - Math.exp(-18 * dt));
  finishCam(55);
}
function finishCam(fov, nearAt) {
  const cam = G.camera;
  cam.position.copy(Cam.pos);
  if (Cam.shake > 0) { Cam.shake = Math.max(0, Cam.shake - G.dt * 2); cam.position.x += (Math.random() - 0.5) * Cam.shake * 0.2; cam.position.y += (Math.random() - 0.5) * Cam.shake * 0.2; }
  cam.lookAt(Cam.look);
  const f = fov || 55; if (Math.abs(cam.fov - f) > 0.05) { cam.fov = damp(cam.fov, f, 4, G.dt); cam.updateProjectionMatrix(); }
  const nr = Math.max(0.25, nearAt || 0); if (Math.abs(cam.near - nr) > 0.01) { cam.near = nr; cam.updateProjectionMatrix(); }
}

/* ---------------- area naming ---------------- */
const AREAS = [
  ['bow', 'Deck 6 · Bow Lookout'], ['garden', 'Deck 8 · Garden Promenade'], ['dome', 'Deck 15 · Skydome'], ['pool', 'Deck 15 · Pool Deck'],
  ['canyon', 'Deck 15 · Canyon Walk'], ['aft', 'Deck 15 · Sports Court'], ['sun', 'Deck 17 · Sun Deck'], ['waterpark', 'Deck 15 · Splash Summit'], ['tower', 'Deck 19 · Slide Tower'],
  ['casino', 'Deck 6 · Tileo Casino'], ['suite', 'Deck 12 · Your Suite'], ['port', 'Ashore']
];
function areaId(p) {
  if (G.port && Player.level === 'port') return 'port';
  if (Player.level === 'casino') return 'casino';
  if (Player.level === 'suite') return 'suite';
  if (p.y < 23 && p.z < -130) return 'bow';
  if (p.y < 32) return 'garden';
  if (p.y > 66) return 'tower';
  if (p.y > 55 && p.x > 7 && p.z > 64 && p.z < 99) return 'sun';
  const dx = p.x / 26, dz = (p.z + 123) / 27; if (dx * dx + dz * dz < 1) return 'dome';
  if (p.z < -42) return 'pool';
  if (p.z < 62) return 'canyon';
  if (p.z < 96) return 'aft';
  return 'waterpark';
}
function areaLabel(id) {
  if (id === 'port' && G.port) return G.port.P.name + ' · ' + G.port.P.tag;
  if (id === 'suite' && Suite.owner !== 'me') return 'Deck 12 · Visiting a suite';
  if (id === 'canyon' && Player.pos.x > 14 && Player.pos.z > -18 && Player.pos.z < 5) return 'Deck 15 · Wave Rider';
  if (id === 'canyon' && Player.pos.x < -13 && (Player.pos.z < -12 || Player.pos.z > 15)) return 'Deck 15 · Tileo Links';
  const a = AREAS.find(a => a[0] === id); return a ? a[1] : '';
}

/* ---- 50_npc.js ---- */
/* ================= NPC passengers ================= */
const NPC_NAMES = ['Maya', 'Leo', 'Priya', 'Sam', 'Noor', 'Jonah', 'Ines', 'Theo', 'Aiko', 'Mateo', 'Zara', 'Felix', 'Rosa', 'Kai', 'Lena', 'Omar', 'Hana', 'Diego', 'Ava', 'Ravi', 'Chloe', 'Tariq', 'Mila', 'Ezra', 'Sofia', 'Jun', 'Nia', 'Luca', 'Elif', 'Remy', 'Yara', 'Owen', 'Dani', 'Ivo', 'Tess', 'Beau', 'Lila', 'Arlo', 'Freya', 'Nico'];
const NPC_LINES = [
  'The Riptide slide is wild. Go twice.', 'Glow Party starts at 21:30 in the Skydome.', 'I have not left this lounger since breakfast.',
  'Where are we going? Nowhere. Perfect.', 'Try the Nowhere Colada at Coral Bar.', 'The Canyon Zip is faster than it looks.',
  'Fireworks at midnight, off the stern.', 'I lost a flip-flop in the foam party.', 'A day at sea is my favorite kind of day.',
  'The Captain says we are making 22 knots.', 'Have you seen the infinity sculpture in the Garden?', 'The overwater whirlpool is unreal at sunset.',
  'Blue Abyss swings right out over the ocean!', 'Sunrise yoga at the bow. Worth the alarm.', 'The LED floor in the dome syncs to the beat.',
  'Gelato Nowhere has a tile-blue flavor. Tastes like vanilla.', 'Free throws on the sports court, loser buys gelato.', 'The waterfall in the dome is my nap spot.'
];
const NPCS = [];
const Staff = [];
function initNPCs() {
  G.crowd = new Crowd(MAX_NPC);
  const r = mulberry(4242);
  // staff: bartenders + DJs
  const staffSpots = World.bartenders.map(b => ({ ...b, y: b.y || DK.top, kind: 'bartend' }));
  staffSpots.push({ x: 19.5, y: 52.35, z: -89.9, ry: Math.PI, kind: 'dj' }, { x: 0, y: 52.45, z: -117.6, ry: 0, kind: 'dj' });
  let slot = 0;
  for (const s of staffSpots) {
    const app = BARTENDER_APP(r); if (s.kind === 'dj') { app.acc = 5; app.accColor = 2; app.top = 0; app.topColor = 4; }
    const c = new Char(app, { seed: r() * 100 }); c.setAnim('bartend');
    c.rig.root.position.set(s.x, s.y, s.z); c.rig.root.rotation.y = s.ry;
    G.crowd.assign(slot++, c); Staff.push({ c, spot: s });
  }
  G.staffCount = slot;
  for (let i = slot; i < MAX_NPC; i++) {
    const n = new NPC(i, r);
    G.crowd.assign(i, n.ch); NPCS.push(n);
  }
  // captain (detailed mesh, appears during the Welcome party)
  const cap = new Char(CAPTAIN_APP, { seed: 3 }); buildCharMesh(cap); cap.rig.root.visible = false; G.scene.add(cap.rig.root); G.captain = cap;
  // initial placement
  for (const n of NPCS) n.spawnInitial();
}
class NPC {
  constructor(i, r) {
    this.i = i; this.app = randomAppearance(r); this.ch = new Char(this.app, { seed: r() * 100 });
    this.ch.idleStyle = Math.floor(r() * 3); this.ch.danceStyle = Math.floor(r() * 6); this.ch.var = r() < 0.5 ? 1 : 0;
    this.name = NPC_NAMES[i % NPC_NAMES.length];
    this.level = r() < 0.2 ? 'garden' : r() < 0.08 ? 'bow' : 'd15';
    this.pos = V3(); this.yaw = r() * TAU; this.state = 'idle'; this.timer = 0; this.path = null; this.pi = 0; this.spot = null; this.task = null;
    this.speed = 1.05 + r() * 0.45; this.water = null; this.event = null; this.talkT = 0;
  }
  get grid() { return World.grids[this.level]; }
  spawnInitial() {
    const g = this.grid; const k = g.valid[Math.floor(Math.random() * g.valid.length)]; const [x, y, z] = gridPos(g, k);
    this.pos.set(x, y, z); this.choose(true);
  }
  visibleToPlayer() {
    const d = this.pos.distanceTo(G.camera.position); if (d > 70) return false;
    _v1.copy(this.pos).sub(G.camera.position).normalize(); G.camera.getWorldDirection(_v2);
    return _v1.dot(_v2) > 0.35 || d < 18;
  }
  release() { if (this.spot) { this.spot.taken = null; this.spot = null; } this.ch.held = null; }
  goTo(x, z, then, allowTeleport = true) {
    const g = this.grid; const path = findPath(g, this.pos.x, this.pos.z, x, z);
    if (!path) { this.task = null; this.timer = 1 + Math.random() * 3; this.state = 'idle'; return false; }
    if (allowTeleport && !this.visibleToPlayer()) {
      const last = path[path.length - 1];
      const tooFar = path.length > 4 && Math.hypot(last[0] - this.pos.x, last[2] - this.pos.z) > 45;
      if (tooFar) { const pp = V3(last[0], last[1], last[2]); this.pos.copy(pp); const tv = this.visibleAt(pp); if (!tv) { this.path = null; this.state = 'arrive'; this.then = then; return true; } }
    }
    this.path = path; this.pi = 0; this.state = 'walk'; this.then = then; return true;
  }
  visibleAt(p) { const d = p.distanceTo(G.camera.position); if (d > 70) return false; _v1.copy(p).sub(G.camera.position).normalize(); G.camera.getWorldDirection(_v2); return _v1.dot(_v2) > 0.35 || d < 18; }
  teleportLevel(level, x, y, z) { this.level = level; this.pos.set(x, y, z); }
  choose(initial = false) {
    this.release(); this.ch.setAnim('idle'); this.water = null; this.ch.hidden = false;
    const night = Env.night > 0.5, min = Clock.min;
    // event participation
    const ev = this.event;
    if (ev && isLive(ev) && this.level !== 'port') return this.joinEvent(ev, initial);
    this.event = null;
    if (this.level === 'port') {
      const r = Math.random(), day = Env.night < 0.5;
      if (day && r < 0.3) return this.useSpot(World.spots.loungers.filter(s => s.level === 'port'), 'lie', 0, 30, 90, initial);
      if (r < 0.45) return this.useSpot(World.spots.stools.filter(s => s.level === 'port'), 'sit', 0.81, 20, 60, initial, true);
      if (day && r < 0.62) return this.goSwim(initial);
      if (r < 0.72) return this.useSpot(World.spots.rails.filter(s => s.level === 'port'), 'gaze', 0, 20, 50, initial);
      return this.wander(initial);
    }
    if (this.level === 'casino') {
      const r = Math.random();
      if (!initial && r < 0.12) return this.goLevel('d15');
      if (r < 0.5) return this.useSpot(World.spots.stools.filter(s => s.bar === 'slots'), 'slot', 0.81, 40, 120, initial);
      if (r < 0.72) return this.useSpot(World.spots.stools.filter(s => s.bar === 'bj' || s.bar === 'rl'), 'cards', 0.81, 40, 120, initial);
      if (r < 0.88) return this.useSpot(World.spots.stools.filter(s => s.bar === 'casinobar'), 'sit', 0.81, 30, 90, initial, true);
      return this.wander(initial);
    }
    if (this.level !== 'd15' && !initial && Math.random() < 0.12) return this.goLevel('d15');
    if (this.level === 'garden') {
      const r = Math.random();
      if (r < 0.32) return this.useSpot(World.spots.benches.filter(s => s.level === 'garden'), 'sit', 0.47, 25, 70, initial);
      if (r < 0.5) { const sh = mpick(World.hotspots.filter(h => h.kind === 'shop')); return this.walkThen(sh.pos.x, sh.pos.z, () => this.doFor('talk', 10, 25, sh.pos), initial); }
      return this.wander(initial);
    }
    if (this.level === 'bow') {
      if (Math.random() < 0.7) return this.useSpot(World.spots.rails.filter(s => s.level === 'bow'), 'gaze', 0, 30, 90, initial);
      return this.wander(initial);
    }
    if (!initial && Math.random() < 0.12) { const q = Math.random(); return this.goLevel(q < 0.55 ? 'garden' : q < 0.75 || Env.night < 0.4 ? 'bow' : 'casino'); }
    if (!initial && World.spots.golf && Math.random() < 0.05) return this.useSpot(World.spots.golf, 'putt', 0, 15, 40, initial);
    const r = Math.random(), day = !night && min > 8 * 60;
    if (day && r < 0.28) return this.useSpot(World.spots.loungers, 'lie', 0, 40, 140, initial);
    if (r < 0.42) return this.useSpot(World.spots.rails.filter(s => s.level === 'd15'), 'gaze', 0, 20, 60, initial);
    if (day && r < 0.54) return this.goSwim(initial);
    if (r < 0.66) return this.useSpot(World.spots.stools, 'sit', 0.81, 30, 90, initial, true);
    if (night && r < 0.86) return this.goDance(mpick(World.spots.dance.filter(d => d.zone === 'dome')), initial);
    if (day && r < 0.7 && min > 9 * 60 && min < 19 * 60) return this.goSlide(initial);
    if (r < 0.74) return this.walkThen(-17.75 + mrand(-5, 5), mrand(72, 88), () => this.doFor(Math.random() < 0.5 ? 'shootAim' : 'cheer', 8, 20), initial);
    return this.wander(initial);
  }
  goLevel(level) {
    const el = World.elevators.filter(e => e.level === this.level).sort((a, b) => Math.hypot(a.x - this.pos.x, a.z - this.pos.z) - Math.hypot(b.x - this.pos.x, b.z - this.pos.z))[0];
    const dest = mpick(World.elevators.filter(e => e.level === level));
    if (!el || !dest) return this.wander(false);
    const hop = () => { this.level = level; this.pos.set(dest.x + mrand(-1, 1), dest.y, dest.z + mrand(-1, 1)); this.state = 'idle'; this.timer = 0.5; };
    if (!this.visibleToPlayer()) { hop(); return; }
    this.goTo(el.x, el.z, hop);
  }
  wander(initial) {
    const g = this.grid; let k = g.valid[Math.floor(Math.random() * g.valid.length)];
    for (let tries = 0; tries < 24 && !initial; tries++) { const kk = g.valid[Math.floor(Math.random() * g.valid.length)]; const [xx, , zz] = gridPos(g, kk); if (Math.hypot(xx - this.pos.x, zz - this.pos.z) < 45) { k = kk; break; } }
    const [x, , z] = gridPos(g, k);
    return this.walkThen(x, z, () => this.doFor(Math.random() < 0.3 ? 'talk' : 'idle', 4, 14), initial);
  }
  walkThen(x, z, then, initial) {
    if (initial) { const g = this.grid; const k = nearestValid(g, x, z, 10); if (k >= 0) { const [a, b, c] = gridPos(g, k); this.pos.set(a, b, c); } then(); return; }
    if (!this.goTo(x, z, then)) return;
  }
  doFor(anim, a, b, face) {
    this.state = 'act'; this.ch.setAnim(anim); this.timer = mrand(a, b);
    if (face) this.yaw = Math.atan2(face.x - this.pos.x, face.z - this.pos.z);
  }
  useSpot(list, anim, seat, a, b, initial, cup) {
    const free = list.filter(s => !s.taken && (!s.level || s.level === this.level));
    if (!free.length) return this.wander(initial);
    let spot = mpick(free);
    if (!initial) { let best = null, bd = 1e9; for (let k = 0; k < 6; k++) { const s = mpick(free); const d = Math.hypot(s.x - this.pos.x, s.z - this.pos.z); if (d < bd) { bd = d; best = s; } } spot = best; }
    spot.taken = this; this.spot = spot;
    const settle = () => {
      this.state = 'act'; this.timer = mrand(a, b); this.ch.setAnim(anim); this.ch.seat = seat;
      this.yaw = spot.ry;
      if (anim === 'lie') { const c = Math.cos(spot.ry), s = Math.sin(spot.ry); this.pos.set(spot.x + s * 0.85, spot.y + 0.4, spot.z + c * 0.85); }
      else this.pos.set(spot.x, spot.y, spot.z);
      if (cup) this.ch.held = 'cup';
    };
    const ax = spot.x - Math.sin(spot.ry) * (anim === 'gaze' ? 0 : 1.2), az = spot.z - Math.cos(spot.ry) * (anim === 'gaze' ? 0 : 1.2);
    if (initial) { settle(); return; }
    if (!this.goTo(ax, az, settle)) { spot.taken = null; this.spot = null; }
  }
  goSwim(initial) {
    const pools = World.waters.filter(w => w.level === this.level && !w.hot && !w.golf && w.id !== 'overwater');
    if (!pools.length) return this.wander(initial);
    const w = mpick(pools);
    const bb = w.bb; let cx = (bb[0] + bb[2]) / 2, cz = (bb[1] + bb[3]) / 2;
    let start = null;
    if (w.sea) { start = seaPoint(null); if (!start) return this.wander(initial); const th = Math.atan2(start[1] - ISLE.z, start[0] - ISLE.x); [cx, cz] = G.port.H.at(th, 0.95); }
    const enter = () => {
      this.state = 'swim'; this.water = w; this.timer = mrand(25, 70); this.swimTarget = null;
      if (start) { this.pos.set(start[0], w.top - 1.42, start[1]); return; }
      for (let k = 0; k < 20; k++) { const x = mrand(bb[0], bb[2]), z = mrand(bb[1], bb[3]); if (pip(x, z, w.poly)) { this.pos.set(x, w.top - 1.42, z); break; } }
    };
    if (initial) { enter(); return; }
    if (w.sea) this.goTo(cx, cz, enter); else this.goTo(cx + (bb[2] - bb[0]) * 0.6, cz, enter);
  }
  goDance(area, initial) {
    if (!area) return this.wander(initial);
    const g = this.grid; const k = randomCellIn(g, area.poly); if (k < 0) return this.wander(initial);
    const [x, , z] = gridPos(g, k);
    const start = () => { this.state = 'act'; this.timer = mrand(40, 120); this.ch.setAnim('dance'); this.ch.danceStyle = Math.floor(Math.random() * 6); this.yaw = mrand(0, TAU); this.faceDance = area; };
    this.walkThen(x, z, start, initial);
  }
  goSlide(initial) {
    const tower = World.hotspots.find(h => h.id === 'tower_up');
    const go = () => {
      const idx = Math.floor(Math.random() * 3); const s = World.slides[idx];
      this.state = 'climb'; this.timer = 9; this.ch.hidden = true; this.slide = { s, d: 0, v: 3.5 };
    };
    if (initial) return this.wander(true);
    this.goTo(tower.pos.x, tower.pos.z, go);
  }
  joinEvent(ev, initial) {
    const zone = World.zones[ev.zone]; const level = zone.level;
    if (level !== this.level) {
      if (this.visibleToPlayer() && !initial) { const el = World.elevators.filter(e => e.level === this.level).sort((a, b) => Math.hypot(a.x - this.pos.x, a.z - this.pos.z) - Math.hypot(b.x - this.pos.x, b.z - this.pos.z))[0]; if (el) { this.goTo(el.x, el.z, () => { this.level = level; const sp = zone.spawn; this.pos.set(sp[0] + mrand(-2, 2), sp[1], sp[2] + mrand(-2, 2)); this.choose(); }); return; } }
      this.level = level; const sp = zone.spawn; this.pos.set(sp[0], sp[1], sp[2]);
    }
    const area = eventArea(ev);
    const g = this.grid; const k = randomCellIn(g, area); if (k < 0) return this.wander(initial);
    const [x, , z] = gridPos(g, k);
    const anim = ev.fx === 'yoga' ? 'yoga' : ev.fx === 'toast' ? 'idle' : ev.fx === 'trivia' ? (Math.random() < 0.6 ? 'talk' : 'cheer') : ev.fx === 'captain' ? (Math.random() < 0.5 ? 'talk' : 'dance') : 'dance';
    const go = () => {
      this.state = 'act'; this.timer = mrand(30, 90); this.ch.setAnim(anim); this.ch.danceStyle = Math.floor(Math.random() * 6);
      if (ev.fx === 'toast') this.ch.held = 'cup';
      const c = eventFocus(ev); this.yaw = Math.atan2(c.x - this.pos.x, c.z - this.pos.z) + mrand(-0.4, 0.4);
    };
    if (initial || !this.visibleToPlayer()) { const gp = gridPos(g, k); this.pos.set(gp[0], gp[1], gp[2]); go(); return; }
    this.goTo(x, z, go, false);
  }
  update(dt) {
    const c = this.ch;
    this.talkT = Math.max(0, this.talkT - dt);
    switch (this.state) {
      case 'walk': {
        const tgt = this.path[this.pi];
        const dx = tgt[0] - this.pos.x, dz = tgt[2] - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.25) { this.pi++; if (this.pi >= this.path.length) { this.path = null; this.state = 'arrive'; } break; }
        const sp = this.speed * (this.event ? 1.25 : 1);
        const step = Math.min(d, sp * dt);
        this.pos.x += dx / d * step; this.pos.z += dz / d * step;
        const gy = groundAt(this.pos.x, this.pos.z, this.pos.y + 0.7, 0.7, this.level); if (gy > -1e8) this.pos.y = damp(this.pos.y, gy, 20, dt);
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt);
        c.speed = sp; c.setAnim('walk');
        break;
      }
      case 'arrive': { const t = this.then; this.then = null; if (t) t(); else this.choose(); break; }
      case 'act': {
        this.timer -= dt;
        if (this.talkT > 0) { c.setAnim('talk'); this.yaw = dampAngle(this.yaw, Math.atan2(Player.pos.x - this.pos.x, Player.pos.z - this.pos.z), 6, dt); }
        else if (c.anim === 'talk' && this.prevAnim) { c.setAnim(this.prevAnim); this.prevAnim = null; }
        if (this.timer <= 0) this.choose();
        if (c.anim === 'shootAim' && Math.random() < dt * 0.6) c.setAnim('shoot'); else if (c.anim === 'shoot' && Math.random() < dt * 1.5) c.setAnim('shootAim');
        break;
      }
      case 'swim': {
        const w = this.water; this.timer -= dt;
        if (!this.swimTarget || Math.hypot(this.swimTarget[0] - this.pos.x, this.swimTarget[1] - this.pos.z) < 0.6) {
          if (w.sea) { const sp = seaPoint(this.pos); if (sp) this.swimTarget = sp; }
          else for (let k = 0; k < 20; k++) { const x = mrand(w.bb[0], w.bb[2]), z = mrand(w.bb[1], w.bb[3]); if (pip(x, z, w.poly) && pip(x, z, offsetPolyCache(w))) { this.swimTarget = [x, z]; break; } }
          this.restT = Math.random() < 0.4 ? mrand(2, 6) : 0;
        }
        if (this.restT > 0) { this.restT -= dt; c.setAnim('tread'); }
        else if (this.swimTarget) {
          const dx = this.swimTarget[0] - this.pos.x, dz = this.swimTarget[1] - this.pos.z, d = Math.hypot(dx, dz) || 1e-3;
          const st = Math.min(d, 1.2 * dt); this.pos.x += dx / d * st; this.pos.z += dz / d * st; this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 5, dt); c.setAnim('swim');
        } else c.setAnim('tread');
        this.pos.y = w.top - 1.42;
        if (this.timer <= 0) {
          const g = this.grid; const k = nearestValid(g, this.pos.x, this.pos.z, w.sea ? 40 : 12);
          if (k >= 0) { const [x, y, z] = gridPos(g, k); this.pos.set(x, y, z); }
          this.water = null; this.choose();
        }
        break;
      }
      case 'climb': {
        this.timer -= dt; if (this.timer > 0) break;
        this.state = 'ride'; this.ch.hidden = false; c.setAnim('slide');
        break;
      }
      case 'ride': {
        const r = this.slide, s = r.s; const t = Math.min(1, r.d / s.L);
        const p = s.curve.getPointAt(t), tan = s.curve.getTangentAt(t);
        r.v = clamp(r.v + (-tan.y * 9.8 * 0.9 - 0.05 * r.v) * dt, 3.5, 16); r.d += r.v * dt;
        const fr = upFrameAt(s.curve, t);
        this.pos.copy(p).addScaledVector(fr.up, -0.85).addScaledVector(tan, 0.85); this.yaw = Math.atan2(tan.x, tan.z);
        this.ridePitch = Math.asin(clamp(tan.y, -1, 1));
        if (t >= 1) {
          const w = waterAt(p.x, p.z);
          if (w) { this.state = 'swim'; this.water = w; this.timer = mrand(4, 10); this.swimTarget = null; this.pos.set(p.x, w.top - 1.42, p.z); fxSplash(p.x, w.top, p.z, 0.8); }
          else { const g = this.grid; const k = nearestValid(g, p.x + 2, p.z, 8); if (k >= 0) { const [x, y, z] = gridPos(g, k); this.pos.set(x, y, z); } this.choose(); }
          this.ridePitch = 0;
        }
        break;
      }
      default: { this.timer -= dt; if (this.timer <= 0) this.choose(); }
    }
    // pose + transform
    const far = this.pos.distanceToSquared(G.camera.position) > 140 * 140;
    c.beat = Audio.beat() + this.i * 0.0;
    if (!far || G.frame % 6 === this.i % 6) c.update(far ? dt * 6 : dt, G.time);
    const root = c.rig.root;
    let ox = 0, oz = 0, oy = 0;
    if (c.anim === 'swim' && this.water) { ox = -Math.sin(this.yaw) * 0.85; oz = -Math.cos(this.yaw) * 0.85; oy = (this.water.top - 0.15) - this.pos.y; }
    root.position.set(this.pos.x + ox, this.pos.y + oy, this.pos.z + oz);
    root.rotation.set(0, this.yaw, 0);
    if (this.state === 'ride') { c.rig.body.rotation.x = -1.45 - (this.ridePitch || 0); }
  }
  sayHi() {
    if (this.state === 'walk' || this.state === 'ride' || this.state === 'climb' || this.state === 'swim') { }
    this.talkT = 4.5; if (this.ch.anim !== 'talk') this.prevAnim = this.ch.anim;
    if (this.state === 'act' && (this.ch.anim === 'lie' || this.ch.anim === 'sit')) { this.talkT = 0; this.prevAnim = null; }
    return mpick(NPC_LINES);
  }
}
function seaPoint(near) {
  if (!G.port) return null; const H = G.port.H;
  for (let k = 0; k < 40; k++) {
    let x, z;
    if (near) { x = near.x + mrand(-9, 9); z = near.z + mrand(-9, 9); }
    else { [x, z] = H.at(Math.PI + mrand(-0.55, 0.55), mrand(1.0, 1.1)); }
    const h = H(x, z); if (h < -1.7 && h > -6.5) return [x, z];
  }
  return null;
}
const _offCache = new Map();
function offsetPolyCache(w) { if (!_offCache.has(w)) _offCache.set(w, offsetPoly(w.poly, -0.9)); return _offCache.get(w); }
function upFrameAt(curve, t) {
  const tan = curve.getTangentAt(t).normalize();
  let side = _v3.crossVectors(tan, _v1.set(0, 1, 0)); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
  return { tan, side, up: new T.Vector3().crossVectors(side, tan).normalize() };
}
function updateNPCs(dt) {
  for (let i = 0; i < NPCS.length; i++) {
    const n = NPCS[i]; if (n.i >= G.crowd.active) { n.ch.hidden = true; continue; }
    n.update(dt);
  }
  for (const s of Staff) { s.c.beat = Audio.beat(); s.c.update(dt, G.time); }
  if (G.captain.rig.root.visible) { G.captain.update(dt, G.time); }
  G.crowd.sync();
}
function nearestNPC(p, maxD) {
  let best = null, bd = maxD;
  for (const n of NPCS) { if (n.i >= G.crowd.active || n.ch.hidden || n.state === 'ride' || n.state === 'swim') continue; const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z); if (d < bd && Math.abs(n.pos.y - p.y) < 1.5) { bd = d; best = n; } }
  return best;
}

/* ---- 60_activities.js ---- */
/* ================= activities: hotspots, rides, minigames, emotes ================= */
const DRINKS = [
  { name: 'Tileo Sunset', desc: 'Passion fruit, orange and a grenadine sunset', color: '#ff7a4d', price: 'on the house' },
  { name: 'Nowhere Colada', desc: 'Pineapple and coconut, blended cold', color: '#f6edd2', price: 'on the house' },
  { name: 'Lagoon Fizz', desc: 'Blue curaçao syrup, lime and soda (alcohol-free)', color: '#2fd3c6', price: 'on the house' },
  { name: "Captain's Punch", desc: 'Mango, guava and a splash of ginger', color: '#ffc95c', price: 'on the house' },
];
function startActivity(a) {
  if (Player.activity && Player.activity.exit) Player.activity.exit();
  Player.activity = a; Player.emote = null; hideEmotes();
  if (a.enter) a.enter();
  renderModeBar(a.bar || null);
}
function endActivity() {
  const a = Player.activity; if (!a) return;
  Player.activity = null; Player.override = null;
  if (a.exit) a.exit();
  renderModeBar(null);
  $('meter').hidden = true; $('bigRead').hidden = true; $('beatRing').hidden = true; $('judge').hidden = true;
}

/* ---------- hotspot scan ---------- */
let curHot = null;
function scanHotspots() {
  if (Player.activity || G.state !== 'play') { setAction(null); return; }
  const p = Player.pos; let best = null, bd = 1e9;
  for (const h of World.hotspots) {
    if (Math.abs(h.pos.y - p.y) > 1.6) continue;
    const d = Math.hypot(h.pos.x - p.x, h.pos.z - p.z); if (d < h.r && d < bd) { bd = d; best = h; }
  }
  if (!best && Player.mode === 'walk') {
    const lounger = nearestSpot(World.spots.loungers, 1.6);
    if (lounger) best = { id: 'lounger', kind: 'lounge', label: 'Lounge here', spot: lounger };
    else {
      const stool = nearestSpot(World.spots.stools, 0.9) || nearestSpot(World.spots.benches, 1.2);
      if (stool) best = { id: 'stool', kind: 'sit', label: 'Have a seat', spot: stool };
    }
  }
  if (!best && typeof nearestRemote === 'function') { const R = nearestRemote(p, 2.6); if (R) best = { id: 'rp' + R.peer, kind: 'remote', label: 'Say hi to ' + R.name, remote: R }; }
  if (!best) { const n = nearestNPC(p, 2.3); if (n) best = { id: 'npc' + n.i, kind: 'npc', label: 'Say hi to ' + n.name, npc: n }; }
  curHot = best; setAction(best);
}
function nearestSpot(list, r) { const p = Player.pos; let best = null, bd = r; for (const s of list) { if (s.taken && s.taken !== Player) continue; if (Math.abs(s.y - p.y) > 1) continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } } return best; }
function onActionPressed() {
  if (Player.activity) { if (Player.activity.onAction) Player.activity.onAction(); return; }
  const h = curHot; if (!h) return;
  sfx('tick');
  switch (h.kind) {
    case 'lounge': return actLounge(h.spot);
    case 'sit': return actSit(h.spot);
    case 'bar': return openMenu('bar', h.data.bar);
    case 'menu': return openMenu(h.data.venue);
    case 'shop': return actShop(h.data.item);
    case 'slots': return openSlots();
    case 'blackjack': return openBlackjack();
    case 'roulette': return openRoulette();
    case 'surf': return actSurf();
    case 'golf': return actGolf();
    case 'trivia': return startTrivia();
    case 'tender': return returnToShip();
    case 'viewpoint': return actViewpoint(h);
    case 'suiteExit': return openSheet('map', { elevator: true });
    case 'music': return openMusic(Player.level === 'suite' ? 'suite' : 'dj');
    case 'remote': { Player.yaw = Math.atan2(h.remote.pos.x - Player.pos.x, h.remote.pos.z - Player.pos.z); doEmote('wave'); netSay('Hi ' + h.remote.name + '!'); return; }
    case 'slide': return actSlide(h.data.slide);
    case 'zip': return actZip();
    case 'towerUp': return fadeTeleport(-6, DK.tower, 111, Math.PI, () => toast('Top of the slide tower', 'Deck 19 · Pick a slide'));
    case 'towerDown': return fadeTeleport(-6, DK.top, 117.6, 0);
    case 'elevator': return openSheet('map', { elevator: true });
    case 'hoops': return actHoops();
    case 'dance': return actDance(h.data.zone);
    case 'dj': return openMusic('dj');
    case 'tub': return fadeTeleport(h.pos.x + Math.sign(h.pos.x) * 1.2, DK.top - 0.1, h.pos.z, 0);
    case 'bowpose': return actBowPose();
    case 'captain': { G.captain.setAnim('wave'); setTimeout(() => G.captain.setAnim('talk'), 2600); showBubble({ ch: G.captain, name: 'Captain', pos: G.captain.rig.root.position }, 'Welcome aboard the Tileo Infinity. We sail for Nowhere, and we never arrive late.'); stamp('captain'); doEmote('wave'); return; }
    case 'npc': { const line = h.npc.sayHi(); showBubble(h.npc, line); Player.yaw = Math.atan2(h.npc.pos.x - Player.pos.x, h.npc.pos.z - Player.pos.z); doEmote('wave'); return; }
  }
}

/* ---------- lounge / sit ---------- */
function actLounge(spot) {
  spot.taken = Player; const c = Player.char;
  startActivity({
    exitOnMove: true, bar: [{ label: 'Get up', fn: endActivity }, { label: 'Rest until the next event', fn: skipToNextEvent, alt: true }],
    enter() { c.setAnim('lie'); c.var = 1; Player.yaw = spot.ry; const s = Math.sin(spot.ry), co = Math.cos(spot.ry); Player.pos.set(spot.x + s * 0.85, spot.y + 0.4, spot.z + co * 0.85); this.t = 0; },
    update(dt) { this.t += dt; if (this.t > 2) stamp('lounge'); },
    exit() { spot.taken = null; c.setAnim('idle'); Player.pos.set(spot.x + Math.sin(spot.ry) * 1.75, spot.y, spot.z + Math.cos(spot.ry) * 1.75); }
  });
}
function actSit(spot) {
  spot.taken = Player; const c = Player.char; const seat = spot.y > 30 && spot.bar ? 0.81 : 0.47;
  startActivity({
    exitOnMove: true, bar: [{ label: 'Stand up', fn: endActivity }],
    enter() { c.setAnim('sit'); c.seat = spot.bar ? 0.81 : 0.47; Player.yaw = spot.ry; Player.pos.set(spot.x, spot.y, spot.z); },
    update() { },
    exit() { spot.taken = null; c.setAnim('idle'); Player.pos.x -= Math.sin(spot.ry) * 0.8; Player.pos.z -= Math.cos(spot.ry) * 0.8; }
  });
}

/* ---------- bars + shops ---------- */
function openBar(barName) {
  openSheet('bar', { bar: barName });
}
function serveDrink(d, barName) {
  closeSheet(); Player.char.held = 'cup'; setHeld(Player.char, 'cup', d.color);
  toast(d.name + ' served', barName + ' · ' + d.desc); stamp('bar'); sfx('pour');
}
function actShop(item) {
  if (item === 'browse') { toast('Tile & Tide', 'Mosaic coasters, tile-print towels and a very good straw hat.'); sfx('tick'); return; }
  if (item === 'souvenir') { toast('You picked up a hand-painted tile', 'A souvenir from Port Solana, packed in your suite.'); sfx('chip'); stamp('treat'); return; }
  const map = { coffee: ['cup', '#6b3e26', 'Flat white from Infinity Café'], gelato: ['cone', mpick(['#ff8fab', '#7bd389', '#f6edd2', '#5aa9ff']), 'Two scoops from Gelato Nowhere'], pizza: ['slice', null, 'Margherita slice from Ocean Pizzeria'] }[item];
  setHeld(Player.char, map[0], map[1]); toast(map[2], 'Enjoy it on a garden bench'); stamp('treat'); sfx('pour');
}
function requestSong() {
  const titles = ['Wake of the Moon', 'Destination: Nowhere', 'Tiles in the Sun', 'Twenty-Two Knots', 'Deck 15 Forever', 'Coconut Telemetry'];
  Audio.nextStyleBump = true; toast('Request queued', 'Next up: ' + mpick(titles)); sfx('tick');
}

/* ---------- slides ---------- */
function actSlide(idx) {
  const s = World.slides[idx]; const c = Player.char;
  let d = 0, v = 3.5, done = false, endT = 0;
  startActivity({
    exitable: false, bar: null,
    enter() { c.setAnim('slide'); $('bigRead').hidden = false; $('bigLbl').textContent = 'KM/H · ' + s.name.toUpperCase(); sfx('whooshStart'); Audio.whoosh(0.2); this.prevCam = Cam.dist; },
    update(dt) {
      if (done) { endT += dt; if (endT > 0.2) { endActivity(); } return; }
      const t = Math.min(1, d / s.L);
      const p = s.curve.getPointAt(t), tan = s.curve.getTangentAt(t);
      const fr = upFrameAt(s.curve, t);
      v = clamp(v + (-tan.y * 9.8 * 0.92 - 0.035 * v - 0.0035 * v * v) * dt, 3.6, 17.5); d += v * dt;
      Player.pos.copy(p).addScaledVector(fr.up, s.type === 'tube' ? -0.95 : -0.82).addScaledVector(tan, 0.85);
      Player.yaw = Math.atan2(tan.x, tan.z);
      const pitch = Math.asin(clamp(tan.y, -1, 1));
      const t2 = Math.min(1, (d + 2) / s.L); const tan2 = s.curve.getTangentAt(t2);
      const turn = wrapAngle(Math.atan2(tan2.x, tan2.z) - Player.yaw);
      Player.override = r => { c.rig.body.rotation.x = -1.42 - pitch; c.rig.body.rotation.z = clamp(-turn * 1.8, -0.6, 0.6); };
      $('bigVal').textContent = Math.round(v * 3.6);
      Audio.whoosh(clamp(v / 16, 0.15, 1));
      this.cam = { p, tan, up: fr.up };
      if (t >= 1) {
        done = true; Audio.whoosh(0); $('bigRead').hidden = true; Player.override = null;
        const end = s.curve.getPointAt(1);
        const w = waterAt(end.x, end.z);
        fxSplash(end.x, w ? w.top : DK.top + 0.4, end.z, 1.4); sfx('splash', 1.2);
        stamp('slide'); const rode = new Set(G.profile.slides || []); rode.add(s.id); G.profile.slides = [...rode]; saveProfile(); if (rode.size >= 3) stamp('allslides');
        if (w) { Player.pos.set(end.x, w.top - 1.42, end.z); Player.mode = 'swim'; Player.water = w; Player.swimT = 0; }
        else { Player.pos.set(-19.6, DK.top, 143); Player.mode = 'walk'; toast(s.name + ' complete', 'Top speed ' + Math.round(v * 3.6) + ' km/h'); }
        Cam.yaw = Player.yaw + Math.PI; Cam.pitch = 0.25;
      }
    },
    camera() {
      if (!this.cam) return null;
      const { p, tan, up } = this.cam;
      const back = s.type === 'tube' ? 2.6 : 4.6, upd = s.type === 'tube' ? 0.35 : 1.9;
      return { pos: _v1.copy(p).addScaledVector(tan, -back).addScaledVector(up, upd).clone(), look: _v2.copy(p).addScaledVector(tan, 6).addScaledVector(up, -0.4).clone(), k: 10, fov: 62 + clamp(v * 1.2, 0, 16) };
    },
    exit() { Audio.whoosh(0); Player.override = null; c.setAnim('idle'); }
  });
}

/* ---------- zipline ---------- */
function actZip() {
  const z = World.zip, c = Player.char; let d = 0, v = 2.5; const L = z.curve.getLength(); let done = false;
  fadeTeleport(z.start.x, z.start.y, z.start.z, 0, () => {
    startActivity({
      exitable: false,
      enter() { c.setAnim('zip'); Audio.whoosh(0.25); },
      update(dt) {
        if (done) return;
        const t = Math.min(1, d / L), p = z.curve.getPointAt(t), tan = z.curve.getTangentAt(t);
        v = clamp(v + (-tan.y * 9.8 * 1.4 - 0.02 * v) * dt + dt * 1.6, 2.5, 15); d += v * dt;
        Player.pos.set(p.x, p.y - 2.0, p.z); Player.yaw = Math.atan2(tan.x, tan.z);
        Audio.whoosh(clamp(v / 14, 0.15, 0.9)); this.cam = { p, tan };
        if (t >= 1) {
          done = true; Audio.whoosh(0); stamp('zip'); toast('Canyon Zip complete', 'Top speed ' + Math.round(v * 3.6) + ' km/h over the garden');
          endActivity(); placePlayer(z.exit.x, z.exit.y, z.exit.z, Math.PI * 0.75);
        }
      },
      camera() { if (!this.cam) return null; const { p, tan } = this.cam; const side = _v3.set(tan.z, 0, -tan.x).normalize(); return { pos: _v1.copy(p).addScaledVector(tan, -5).addScaledVector(side, 3).add(_v2.set(0, 0.6, 0)).clone(), look: p.clone().add(_v2.set(0, -1.2, 0)), k: 8, fov: 64 }; },
      exit() { Audio.whoosh(0); c.setAnim('idle'); }
    });
  });
}

/* ---------- hoops minigame ---------- */
let ballMesh = null;
function actHoops() {
  const H = World.hoop, c = Player.char;
  if (!ballMesh) { ballMesh = new T.Mesh(new T.SphereGeometry(0.12, 20, 14), MAT.ball); ballMesh.castShadow = true; G.scene.add(ballMesh); }
  let shots = 0, made = 0, phase = 'aim', meterT = 0, ball = null, wait = 0;
  const meter = $('meter'), needle = $('mneedle');
  startActivity({
    exitable: true, bar: [{ label: 'Leave court', fn: endActivity }],
    enter() {
      Player.pos.copy(H.spot); Player.yaw = Math.PI; c.setAnim('shootAim'); meter.hidden = false;
      $('mzone').style.left = '44%'; $('mzone').style.width = '28%'; $('msweet').style.left = '54%'; $('msweet').style.width = '10%';
      $('bigRead').hidden = false; $('bigLbl').textContent = 'FREE THROWS'; $('bigVal').textContent = '0 / 5';
      setAction({ kind: 'shoot', label: 'Shoot', id: 'shoot' });
      ballMesh.visible = true;
    },
    onAction() { if (phase !== 'aim') return; this.shoot(); },
    onJump() { if (phase === 'aim') this.shoot(); },
    shoot() {
      const m = (Math.sin(meterT * 2.6) + 1) / 2;
      const err = m - 0.59;
      phase = 'fly'; shots++; c.setAnim('shoot'); sfx('swoosh', 0.4);
      const S = V3(Player.pos.x, Player.pos.y + 2.15, Player.pos.z - 0.25);
      let E, result;
      if (Math.abs(err) < 0.05) { E = H.rim.clone(); E.y += 0.02; result = 'swish'; }
      else if (Math.abs(err) < 0.14) { E = H.rim.clone().add(V3(0, 0.05, err * 0.9)); result = Math.abs(err) < 0.1 ? 'rimIn' : 'rimOut'; }
      else { E = err < 0 ? H.rim.clone().add(V3(0.05, -0.2, 0.55)) : V3(H.rim.x + 0.2, H.rim.y + 0.45, H.board + 0.12); result = err < 0 ? 'short' : 'long'; }
      const Tf = 1.0; const g = -9.8;
      const vel = V3((E.x - S.x) / Tf, (E.y - S.y - 0.5 * g * Tf * Tf) / Tf, (E.z - S.z) / Tf);
      ball = { p: S, v: vel, t: 0, Tf, result, stage: 0, bounces: 0 };
    },
    update(dt) {
      meterT += dt;
      const m = (Math.sin(meterT * 2.6) + 1) / 2; needle.style.left = (m * 100) + '%';
      if (phase === 'aim') { ballMesh.position.set(Player.pos.x + 0.05, Player.pos.y + 1.55, Player.pos.z - 0.35); return; }
      if (phase === 'fly' && ball) {
        ball.t += dt;
        ball.v.y += -9.8 * dt; ball.p.addScaledVector(ball.v, dt); ballMesh.position.copy(ball.p); ballMesh.rotation.x -= dt * 8;
        if (ball.stage === 0 && ball.t >= ball.Tf) {
          ball.stage = 1;
          if (ball.result === 'swish' || ball.result === 'rimIn') { if (ball.result === 'rimIn') sfx('clank'); ball.v.set(0, -2.2, 0); ball.p.copy(H.rim); made++; sfx('swish'); this.flash('BUCKET!'); }
          else if (ball.result === 'rimOut') { sfx('clank'); ball.v.set(mrand(-1.5, 1.5), 2.2, 2.6); this.flash('RIMMED OUT'); }
          else if (ball.result === 'long') { sfx('clank'); ball.v.set(mrand(-1, 1), -1, 3.2); this.flash('OFF THE BOARD'); }
          else { ball.v.set(mrand(-1, 1), 1.5, 2.2); sfx('clank'); this.flash('SHORT'); }
          $('bigVal').textContent = made + ' / 5';
        }
        if (ball.p.y < DK.top + 0.12) { ball.p.y = DK.top + 0.12; ball.v.y = Math.abs(ball.v.y) * 0.55; ball.v.x *= 0.7; ball.v.z *= 0.7; ball.bounces++; if (ball.bounces > 3) { phase = 'wait'; wait = 0.4; } }
      }
      if (phase === 'wait') {
        wait -= dt; if (wait <= 0) {
          if (shots >= 5) {
            const msg = made >= 3 ? 'Hoop Star!' : 'Nice try'; toast(msg, made + ' of 5 free throws'); if (made >= 3) stamp('hoops');
            shots = 0; made = 0; $('bigVal').textContent = '0 / 5';
          }
          phase = 'aim'; c.setAnim('shootAim');
        }
      }
    },
    flash(t) { const j = $('judge'); j.textContent = t; j.hidden = false; j.style.color = t === 'BUCKET!' ? 'var(--brass)' : 'var(--foam)'; clearTimeout(this.ft); this.ft = setTimeout(() => j.hidden = true, 900); },
    camera() { return { pos: V3(H.spot.x + 1.4, H.spot.y + 2.6, H.spot.z + 4.2), look: V3(H.rim.x, H.rim.y - 0.3, H.rim.z + 0.5), k: 5, fov: 55 }; },
    exit() { meter.hidden = true; $('bigRead').hidden = true; ballMesh.visible = false; c.setAnim('idle'); }
  });
}

/* ---------- dance + rhythm ---------- */
function actDance(zone) {
  const c = Player.char; let combo = 0, best = 0, lastJudgeBeat = -1, style = Math.floor(Math.random() * 5);
  const ring = $('beatRing'), judge = $('judge');
  startActivity({
    exitOnMove: true, bar: [{ label: 'Stop dancing', fn: endActivity }],
    enter() { c.setAnim('dance'); c.danceStyle = style; ring.hidden = false; setAction({ kind: 'groove', label: 'Tap on the beat', id: 'groove' }); this.t = 0; },
    onAction() { this.judge(); }, onJump() { this.judge(); },
    judge() {
      const b = Audio.beat(); const nearest = Math.round(b); const off = Math.abs(b - nearest) * 60 / Audio.bpm;
      if (nearest === lastJudgeBeat) return; lastJudgeBeat = nearest;
      let txt, col;
      if (off < 0.09) { combo++; txt = 'PERFECT'; col = 'var(--brass)'; }
      else if (off < 0.17) { combo++; txt = 'GOOD'; col = 'var(--lagoon)'; }
      else { combo = 0; txt = 'MISS'; col = 'var(--mist)'; }
      best = Math.max(best, combo);
      if (combo > 0 && combo % 6 === 0) { style = (style + 1) % 6; c.danceStyle = style; }
      judge.textContent = combo > 1 ? `${txt} ×${combo}` : txt; judge.style.color = col; judge.hidden = false;
      clearTimeout(this.jt); this.jt = setTimeout(() => judge.hidden = true, 600);
      if (combo >= 12) stamp('dance');
      sfx(txt === 'MISS' ? 'tick' : 'clap', 0.5);
    },
    update(dt) {
      const b = Audio.beat(), f = b - Math.floor(b);
      const s = 1 + (1 - f) * 0.35; ring.style.transform = `scale(${s})`; ring.style.opacity = (0.35 + (1 - f) * 0.6).toFixed(2);
    },
    exit() { ring.hidden = true; judge.hidden = true; c.setAnim('idle'); }
  });
}

/* ---------- bow pose ---------- */
function actBowPose() {
  const c = Player.char;
  startActivity({
    exitOnMove: true, bar: [{ label: 'Done', fn: endActivity }, { label: 'Take a photo', fn: () => { endActivity(); enterPhoto('pose'); }, alt: true }],
    enter() { Player.pos.set(0, DK.bow, -178.4); Player.yaw = Math.PI; c.setAnim('pose'); this.t = 0; },
    update(dt) { this.t += dt; if (this.t > 1.5) stamp('bow'); },
    camera() { const a = this.t * 0.15; return { pos: V3(Math.sin(a) * 6, DK.bow + 2.2, -184 + Math.cos(a) * 0.5), look: V3(0, DK.bow + 1.4, -178), k: 3, fov: 50 }; },
    exit() { c.setAnim('idle'); }
  });
}

/* ---------- viewpoints (ports) ---------- */
function actViewpoint(h) {
  const c = Player.char, face = h.data.face || 0;
  startActivity({
    exitOnMove: true, bar: [{ label: 'Done', fn: endActivity }, { label: 'Take a photo', fn: () => { endActivity(); enterPhoto('pose'); }, alt: true }],
    enter() { Player.pos.copy(h.pos); const g = groundAt(h.pos.x, h.pos.z, h.pos.y + 2, 2); if (g > -1e8) Player.pos.y = g; Player.yaw = face; c.setAnim('pose'); this.t = 0; toast(h.data.say || 'What a view'); },
    update(dt) { this.t += dt; if (this.t > 1.5 && h.data.stamp) { stamp('ashore'); } },
    camera() { const a = this.t * 0.12 + face + Math.PI; return { pos: V3(Player.pos.x + Math.sin(a) * 6, Player.pos.y + 2.4, Player.pos.z + Math.cos(a) * 6), look: V3(Player.pos.x, Player.pos.y + 1.4, Player.pos.z), k: 3, fov: 52 }; },
    exit() { c.setAnim('idle'); }
  });
}

/* ---------- emotes ---------- */
function doEmote(name) {
  hideEmotes();
  if (Player.activity) return;
  if (name === 'dance') { actDance(null); return; }
  Player.emote = name; Player.emoteT = name === 'wave' || name === 'cheer' ? 2.4 : 0;
  if (name === 'sit') Player.char.seat = 0.1;
}

/* ---------- teleport ---------- */
function fadeTeleport(x, y, z, yaw, after) {
  const f = $('fade'); f.classList.add('on');
  setTimeout(() => {
    if (Player.activity) endActivity();
    placePlayer(x, y, z, yaw);
    if (after) after();
    setTimeout(() => f.classList.remove('on'), 120);
  }, 380);
}
function travelTo(zoneId) {
  if (zoneId === 'suite') { if (G.port) { toast('Head back to the ship first', 'The tender is at the end of the pier.'); return; } enterSuite('me'); return; }
  const z = World.zones[zoneId]; if (!z) return;
  if (G.port && z.level !== 'port') { returnToShip(); return; }
  closeSheet(); closePanel(); const [x, y, zz, yaw] = z.spawn;
  fadeTeleport(x, y, zz, yaw, () => { if (zoneId !== 'suite') leaveSuiteState(); toast(z.name, z.deck); });
}

/* ---------- photo mode ---------- */
const POSES = ['pose', 'wave', 'cheer', 'dance', 'idle'];
function enterPhoto(firstPose) {
  if (G.state !== 'play') return;
  if (Player.activity && Player.activity.exitable === false) return;
  closeSheet(); G.state = 'photo'; $('hud').hidden = true; $('photoUI').hidden = false;
  G.photoPose = firstPose ? POSES.indexOf(firstPose) : 0; Player.char.setAnim(POSES[G.photoPose]);
  Cam.dist = clamp(Cam.dist, 3.5, 7); Cam.yaw = Player.yaw + 0.35; Cam.pitch = 0.18;
}
function exitPhoto() { G.state = 'play'; $('hud').hidden = false; $('photoUI').hidden = true; Player.emote = null; }
function cyclePhotoPose() { G.photoPose = (G.photoPose + 1) % POSES.length; Player.char.setAnim(POSES[G.photoPose]); if (POSES[G.photoPose] === 'dance') Player.char.danceStyle = Math.floor(Math.random() * 6); }
function takePhoto() {
  renderFrame(G.scene, G.camera);
  const src = G.renderer.domElement;
  const w = Math.min(1280, src.width), h = Math.round(src.height * w / src.width);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.drawImage(src, 0, 0, w, h);
  const pad = Math.round(w * 0.03), fs = Math.max(14, Math.round(w * 0.022));
  const grd = g.createLinearGradient(0, h * 0.7, 0, h); grd.addColorStop(0, 'rgba(7,20,38,0)'); grd.addColorStop(1, 'rgba(7,20,38,.65)'); g.fillStyle = grd; g.fillRect(0, h * 0.7, w, h * 0.3);
  drawEmblem(g, pad, h - pad - fs * 2.2, fs * 2.2, fs * 0.18);
  g.fillStyle = '#f2f7fb'; g.font = `900 ${fs * 1.2}px ${getComputedStyle(document.documentElement).getPropertyValue('--f-display')}`; g.textBaseline = 'alphabetic';
  g.fillText('TILEO INFINITY', pad + fs * 2.8, h - pad - fs * 1.05);
  g.font = `500 ${fs * 0.75}px ${getComputedStyle(document.documentElement).getPropertyValue('--f-mono')}`; g.fillStyle = '#cfe0ef';
  g.fillText(`${G.profile.name.toUpperCase()} · ${areaLabel(areaId(Player.pos)).toUpperCase()} · DAY ${Clock.day} ${fmtTime(Clock.min)}`, pad + fs * 2.8, h - pad);
  const url = cv.toDataURL('image/jpeg', 0.86);
  G.photos.unshift(url); if (G.photos.length > 12) G.photos.length = 12;
  const keep = G.photos.slice(0, 6); for (let i = keep.length; i > 0; i--) { if (Store.set('photos', keep.slice(0, i))) break; }
  const fl = document.createElement('div'); fl.className = 'flash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 600);
  sfx('shutter'); stamp('photo'); toast('Photo saved to your album', 'Open Settings → Photo album');
}

/* ---- 61_food.js ---- */
/* ================= food + drink: menus, held items you actually eat, fullness + hydration ================= */
const FOOD = {
  burger: { name: 'Tileo Burger', desc: 'Grilled patty, cheddar, lettuce, brioche', model: 'burger', fill: 45, hyd: 0, uses: 5, icon: '#c9762e' },
  hotdog: { name: 'Deck Dog', desc: 'Grilled frank with mustard', model: 'hotdog', fill: 30, hyd: 0, uses: 4, icon: '#b0442d' },
  fries: { name: 'Sea Salt Fries', desc: 'Crispy and salted, in a paper boat', model: 'fries', fill: 22, hyd: -4, uses: 5, icon: '#f6c344' },
  pizza: { name: 'Margherita Slice', desc: 'Tomato, mozzarella, basil', model: 'slice', fill: 32, hyd: 0, uses: 4, icon: '#f2c14e' },
  pizza_pep: { name: 'Pepperoni Slice', desc: 'Crisp pepperoni, extra cheese', model: 'slice', fill: 36, hyd: -2, uses: 4, icon: '#d9472b' },
  gelato_tile: { name: 'Tile Blue Gelato', desc: 'Bright blue. Tastes like vanilla.', model: 'cone', color: '#5aa9ff', fill: 14, hyd: 4, uses: 4, icon: '#5aa9ff' },
  gelato_berry: { name: 'Berry Gelato', desc: 'Strawberry and raspberry', model: 'cone', color: '#ff8fab', fill: 14, hyd: 4, uses: 4, icon: '#ff8fab' },
  gelato_mint: { name: 'Mint Chip Gelato', desc: 'Cool mint with chocolate chips', model: 'cone', color: '#9be3c4', fill: 14, hyd: 4, uses: 4, icon: '#9be3c4' },
  gelato_vanilla: { name: 'Vanilla Gelato', desc: 'Classic and creamy', model: 'cone', color: '#f6edd2', fill: 14, hyd: 4, uses: 4, icon: '#f6edd2' },
  cupcake: { name: 'Coral Cupcake', desc: 'Vanilla sponge, pink frosting, a cherry', model: 'cupcake', color: '#ffb3c1', fill: 16, hyd: 0, uses: 3, icon: '#ffb3c1' },
  cookie: { name: 'Choc Chip Cookie', desc: 'Warm from the oven', model: 'cookie', fill: 12, hyd: 0, uses: 3, icon: '#c98b4a' },
  taco: { name: 'Fish Taco', desc: 'Grilled fish, slaw, lime crema', model: 'taco', fill: 26, hyd: 0, uses: 3, icon: '#f3c14f' },
  tacoveg: { name: 'Veggie Taco', desc: 'Black beans, corn, salsa', model: 'taco', fill: 22, hyd: 0, uses: 3, icon: '#7bd389' },
  fruitcup: { name: 'Tropical Fruit Cup', desc: 'Mango, pineapple, berries, melon', model: 'fruitcup', fill: 12, hyd: 12, uses: 4, icon: '#ffb547' },
  coffee: { name: 'Flat White', desc: 'Double shot, steamed milk', model: 'cup', color: '#6b3e26', fill: 3, hyd: 12, uses: 4, icon: '#6b3e26' },
  icedlatte: { name: 'Iced Latte', desc: 'Espresso over ice and milk', model: 'cup', color: '#c9a27a', fill: 3, hyd: 18, uses: 5, icon: '#c9a27a' },
  smoothie_mango: { name: 'Mango Smoothie', desc: 'Mango, banana, coconut milk', model: 'cup', color: '#ffb547', fill: 10, hyd: 26, uses: 5, icon: '#ffb547' },
  smoothie_berry: { name: 'Berry Blast Smoothie', desc: 'Mixed berries and yogurt', model: 'cup', color: '#c2306b', fill: 10, hyd: 26, uses: 5, icon: '#c2306b' },
  lemonade: { name: 'Fresh Lemonade', desc: 'Squeezed to order, lots of ice', model: 'cup', color: '#f5e27a', fill: 0, hyd: 30, uses: 5, icon: '#f5e27a' },
  water: { name: 'Bottled Water', desc: 'Ice cold', model: 'bottle', color: '#bfe9f2', fill: 0, hyd: 40, uses: 4, icon: '#bfe9f2' },
  coconut: { name: 'Fresh Coconut', desc: 'Chilled coconut water with a straw', model: 'coconut', fill: 4, hyd: 34, uses: 5, icon: '#6b4a2b' },
  sunset: { name: 'Tileo Sunset', desc: 'Passion fruit, orange, a grenadine sunset (alcohol-free)', model: 'cup', color: '#ff7a4d', fill: 2, hyd: 24, uses: 5, icon: '#ff7a4d' },
  colada: { name: 'Nowhere Colada', desc: 'Pineapple and coconut, blended (alcohol-free)', model: 'cup', color: '#f6edd2', fill: 6, hyd: 22, uses: 5, icon: '#f6edd2' },
  fizz: { name: 'Lagoon Fizz', desc: 'Blue citrus soda and lime (alcohol-free)', model: 'cup', color: '#2fd3c6', fill: 0, hyd: 26, uses: 5, icon: '#2fd3c6' },
  punch: { name: "Captain's Punch", desc: 'Mango, guava, a splash of ginger (alcohol-free)', model: 'cup', color: '#ffc95c', fill: 3, hyd: 24, uses: 5, icon: '#ffc95c' },
};
const DRINK_IDS = ['sunset', 'colada', 'fizz', 'punch', 'water'];
const MENUS = {
  cafe: { title: 'Infinity Café', sub: 'Garden Promenade · Deck 8', items: ['coffee', 'icedlatte', 'cookie', 'cupcake', 'water'], stamp: 'treat' },
  gelato: { title: 'Gelato Nowhere', sub: 'Garden Promenade · Deck 8', items: ['gelato_tile', 'gelato_berry', 'gelato_mint', 'gelato_vanilla'], stamp: 'treat' },
  pizza: { title: 'Ocean Pizzeria', sub: 'Garden Promenade · Deck 8', items: ['pizza', 'pizza_pep', 'lemonade', 'water'], stamp: 'treat' },
  grill: { title: 'Seaside Grill', sub: 'Garden Promenade · Deck 8', items: ['burger', 'hotdog', 'fries', 'lemonade'], stamp: 'treat' },
  bakery: { title: 'Sweet Tiles Bakery', sub: 'Garden Promenade · Deck 8', items: ['cupcake', 'cookie', 'coffee', 'icedlatte'], stamp: 'treat' },
  juice: { title: 'Juice Lagoon', sub: 'Garden Promenade · Deck 8', items: ['smoothie_mango', 'smoothie_berry', 'fruitcup', 'coconut', 'water'], stamp: 'treat' },
  taco: { title: 'Taco Wave', sub: 'Garden Promenade · Deck 8', items: ['taco', 'tacoveg', 'lemonade', 'water'], stamp: 'treat' },
  cart: { title: 'Grill & Chill', sub: 'Pool Deck snack cart', items: ['hotdog', 'burger', 'fries', 'lemonade', 'water'] },
  bar: { title: 'Bar', sub: 'Drinks are included in every Tileo fare', items: DRINK_IDS, stamp: 'bar' },
  casinobar: { title: 'Lucky Tile Bar', sub: 'Tileo Casino · Deck 6', items: ['sunset', 'colada', 'fizz', 'punch', 'water', 'fries'], stamp: 'bar' },
  room: { title: 'Room service', sub: 'Delivered to your suite in a minute', items: ['burger', 'pizza', 'fruitcup', 'cupcake', 'coffee', 'water'], delivery: true },
  shack: { title: 'Tile Shack', sub: 'Beach bar', items: ['coconut', 'taco', 'fruitcup', 'lemonade', 'water'], stamp: 'bar' },
  market: { title: 'Market stall', sub: 'Port Solana', items: ['fruitcup', 'coconut', 'smoothie_mango', 'water'] },
};
const Food = { held: null, uses: 0, lastWarn: { full: 100, hyd: 100 } };

function foodState() { const p = G.profile; if (!p.food) p.food = { full: 70, hyd: 70 }; return p.food; }
function openMenu(venue, titleOverride) {
  const M = MENUS[venue]; if (!M) return;
  const title = titleOverride || M.title;
  const rows = M.items.map(id => { const f = FOOD[id]; const tags = (f.fill > 0 ? `+${f.fill} food ` : '') + (f.hyd > 0 ? `+${f.hyd} drink` : ''); return `<button class="drink" data-id="${id}"><span class="glass" style="background:linear-gradient(180deg, rgba(255,255,255,.25), ${f.icon})"></span><span><b>${esc(f.name)}</b><small>${esc(f.desc)}</small></span><em>${tags.trim()}</em></button>`; }).join('');
  sfx('tick');
  sheet(title, M.sub, rows + `<p class="kbd">Included in your fare. Tap the eat button (or press F) to eat or drink what you're holding.</p>`, body => body.querySelectorAll('[data-id]').forEach(b => b.onclick = () => orderFood(b.dataset.id, venue, title)));
}
function orderFood(id, venue, title) {
  const M = MENUS[venue], f = FOOD[id];
  closeSheet(); sfx('pour');
  if (M.delivery) {
    toast('Room service is on its way', f.name + ' · about a minute');
    setTimeout(() => { if (Player.level !== 'suite') { toast('Room service left your order', 'It is waiting in your suite.'); G.pendingRoomService = id; return; } giveFood(id); toast('Knock knock', 'Your ' + f.name + ' has arrived.'); sfx('chime'); }, 5000);
    return;
  }
  giveFood(id);
  toast(f.name + ' served', title);
  if (M.stamp) stamp(M.stamp);
}
function giveFood(id) {
  const f = FOOD[id]; if (!f) return;
  Food.held = id; Food.uses = f.uses;
  setHeld(Player.char, f.model, f.color); setHeldScale(Player.char, 1);
  Player.char.noSip = true;
  updateEatBtn();
}
function dropFood() { Food.held = null; Food.uses = 0; setHeld(Player.char, null); Player.char.noSip = false; updateEatBtn(); }
function consume() {
  const id = Food.held; if (!id || Food.uses <= 0) return;
  const f = FOOD[id], c = Player.char; if (c.useT > 0) return;
  c.useT = 1; Food.uses--;
  const st = foodState(), k = 1 / f.uses;
  st.full = clamp(st.full + f.fill * k, 0, 100); st.hyd = clamp(st.hyd + f.hyd * k, 0, 100);
  sfx(f.model === 'cup' || f.model === 'bottle' || f.model === 'coconut' ? 'slurp' : 'bite');
  setTimeout(() => {
    if (Food.held !== id) return;
    setHeldScale(Player.char, 0.35 + 0.65 * Food.uses / f.uses);
    if (Food.uses <= 0) {
      toast('Finished: ' + f.name, `Food ${Math.round(st.full)}% · Drink ${Math.round(st.hyd)}%`);
      const pr = G.profile; pr.tried = pr.tried || []; if (!pr.tried.includes(id)) { pr.tried.push(id); if (pr.tried.length >= 5) stamp('foodie'); }
      dropFood(); saveProfile();
    } else updateEatBtn();
  }, 650);
  updateMeters(true);
}
function updateEatBtn() {
  const b = $('eatBtn'); if (!b) return;
  const id = Food.held, show = !!id && Food.uses > 0 && G.state === 'play';
  b.hidden = !show; if (!show) return;
  const f = FOOD[id], drink = f.model === 'cup' || f.model === 'bottle' || f.model === 'coconut';
  b.innerHTML = SVG(drink ? IC.glass : IC.fork) + `<span class="badge">${Food.uses}</span>`;
  b.setAttribute('aria-label', (drink ? 'Sip ' : 'Eat ') + f.name); b.title = (drink ? 'Sip ' : 'Eat ') + f.name + ' (F)';
}
let meterT = 0;
function updateFoodMeters(dt) {
  if (!G.profile || G.state !== 'play') return;
  const st = foodState(), gm = dt * Clock.rate;
  const busy = Player.mode === 'swim' || (Player.activity && Player.activity.active) ? 1.6 : 1;
  const heat = G.port ? 1.2 : 1;
  st.full = Math.max(0, st.full - 0.15 * gm * busy);
  st.hyd = Math.max(0, st.hyd - 0.22 * gm * busy * heat);
  for (const [k, label, hint] of [['full', 'Getting hungry', 'Grill, café and taco stands are on the Garden Promenade, Deck 8.'], ['hyd', 'Getting thirsty', 'Every bar pours free drinks and water.']]) {
    if (st[k] < 25 && Food.lastWarn[k] >= 25) toast(label, hint);
    if (st[k] < 5 && Food.lastWarn[k] >= 5) toast(k === 'full' ? 'Running on empty' : 'Very thirsty', 'You are slowing down. Grab something to ' + (k === 'full' ? 'eat.' : 'drink.'));
    Food.lastWarn[k] = st[k];
  }
  meterT -= dt; if (meterT <= 0) { meterT = 0.5; updateMeters(); }
}
function updateMeters(force) {
  if (!G.profile) return;
  const st = foodState();
  const a = $('mFull'), b = $('mHyd'); if (!a) return;
  a.style.width = st.full + '%'; b.style.width = st.hyd + '%';
  a.classList.toggle('low', st.full < 25); b.classList.toggle('low', st.hyd < 25);
}
function speedFactor() { const st = G.profile && G.profile.food; if (!st) return 1; return (st.full < 5 || st.hyd < 5) ? 0.85 : 1; }

/* ---- 62_minigames.js ---- */
/* ================= minigames: Wave Rider surf simulator, Tileo Links mini golf ================= */
function flashJudge(t, col) { const j = $('judge'); j.textContent = t; j.style.color = col || 'var(--foam)'; j.hidden = false; clearTimeout(flashJudge.t); flashJudge.t = setTimeout(() => j.hidden = true, 900); }

/* ---------------- Wave Rider ---------------- */
function actSurf() {
  const S = SURF, c = Player.char, board = G.surfBoard, cx = (S.x0 + S.x1) / 2;
  let s = 0.55, u = 0, vs = 0, vu = 0, tilt = 0, vt = 0, score = 0, time = 45, lives = 3, state = 'ride', wipeT = 0, spin = 0, carveCD = 0, lastSide = 0, trickCD = 0;
  const meter = $('meter'), needle = $('mneedle');
  if (Food.held) dropFood();
  startActivity({
    exitable: true, active: true, bar: [{ label: 'Stop riding', fn: endActivity }],
    enter() {
      c.setAnim('surf'); board.visible = true; meter.hidden = false;
      $('mzone').style.left = '25%'; $('mzone').style.width = '50%'; $('msweet').style.left = '42%'; $('msweet').style.width = '16%';
      $('bigRead').hidden = false; setAction({ kind: 'trick', label: 'Trick!', id: 'trick' });
      toast('Wave Rider', 'Steer left and right to stay balanced. Lean forward to carve down the wave. Tap Trick near the top.');
    },
    onAction() { this.trick(); }, onJump() { this.trick(); },
    trick() {
      if (state !== 'ride' || trickCD > 0) return;
      if (s > 0.6 && Math.abs(tilt) < 0.55) { spin = 1; score += 250; flashJudge('360! +250', 'var(--brass)'); sfx('swish'); trickCD = 1.3; }
      else this.wipe();
    },
    wipe() {
      if (state !== 'ride') return;
      state = 'wipe'; wipeT = 1.7; lives--; c.setAnim('tumble'); board.visible = false;
      fxSplash(Player.pos.x, Player.pos.y, Player.pos.z, 1.3); sfx('splash', 1); flashJudge('WIPEOUT', 'var(--coral)');
    },
    update(dt, inp) {
      time -= dt; carveCD -= dt; trickCD -= dt;
      if (state === 'ride') {
        vs += (-inp.y * 1.7 + (0.55 - s) * 0.9 + Math.sin(G.time * 0.7) * 0.12) * dt; vs *= Math.exp(-1.8 * dt); s = clamp(s + vs * dt, 0.06, 0.94);
        vu += inp.x * 4.6 * dt; vu *= Math.exp(-1.4 * dt); u += vu * dt; if (Math.abs(u) > 1) { u = Math.sign(u); vu *= -0.5; }
        const wob = (Math.sin(G.time * 1.9) + Math.sin(G.time * 3.3 + 1.7) * 0.6 + Math.sin(G.time * 5.1 + 0.4) * 0.3) * (0.6 + (1 - s) * 0.55);
        vt += (wob * 1.15 - inp.x * 2.4 - tilt * 0.7) * dt; vt *= Math.exp(-2 * dt); tilt += vt * dt;
        if (Math.abs(tilt) > 1) this.wipe();
        score += dt * (10 + (1 - s) * 16);
        const side = Math.sign(u); if (side && side !== lastSide && Math.abs(vu) > 1.15 && carveCD <= 0) { score += 40; flashJudge('CARVE +40', 'var(--lagoon)'); carveCD = 0.8; }
        if (side) lastSide = side;
        c.lean = clamp(tilt, -1, 1);
        if (time <= 0) return this.finish();
      } else {
        wipeT -= dt;
        if (wipeT <= 0) { if (lives <= 0 || time <= 0) return this.finish(); state = 'ride'; s = 0.8; u = 0; vs = vu = tilt = vt = 0; c.setAnim('surf'); board.visible = true; }
      }
      spin = Math.max(0, spin - dt / 0.8);
      const x = cx + u * (S.x1 - S.x0) * 0.4, z = S.zb + (S.zt - S.zb) * s, y = surfY(s);
      const dy = (S.yt - S.yb) * (2.8 * s - 1.2 * s * s), slope = Math.atan2(dy, S.zt - S.zb);
      if (state === 'ride') { Player.pos.set(x, y + 0.1, z); Player.yaw = Math.PI + (1 - spin) * TAU * (spin > 0 ? 1 : 0); }
      else { Player.pos.z = Math.min(S.zt - 0.5, Player.pos.z + dt * 6); Player.pos.y = surfY((Player.pos.z - S.zb) / (S.zt - S.zb)) + 0.3; }
      board.rotation.order = 'YXZ'; board.position.set(x, y + 0.06, z); board.rotation.set(-slope, vu * 0.12, tilt * 0.3);
      needle.style.left = (50 + clamp(tilt, -1, 1) * 50) + '%';
      $('bigVal').textContent = Math.round(score); $('bigLbl').textContent = `WAVE RIDER · ${Math.max(0, Math.ceil(time))}S · ${'●'.repeat(Math.max(0, lives))}${'○'.repeat(3 - Math.max(0, lives))}`;
      this.cam = { x, y, z };
    },
    finish() {
      const sc = Math.round(score), pr = G.profile; const best = pr.surfBest || 0;
      if (sc > best) pr.surfBest = sc;
      toast(sc > best ? 'New best ride: ' + sc : 'Ride over: ' + sc + ' points', sc >= 1000 ? 'Wave Rider stamp earned' : 'Score 1,000 to earn the Wave Rider stamp');
      if (sc >= 1000) stamp('surf');
      saveProfile(); endActivity();
    },
    camera() { if (!this.cam) return null; const { x, y, z } = this.cam; return { pos: V3(x * 0.5 + cx * 0.5 - 1.5, y + 2.4, z + 5.6), look: V3(x, y + 0.5, z - 2.5), k: 6, fov: 60 }; },
    exit() { board.visible = false; meter.hidden = true; $('bigRead').hidden = true; c.setAnim('idle'); c.lean = 0; Player.pos.set(S.x0 - 1.6, DK.top, (S.zb + S.zt) / 2); Player.yaw = -Math.PI / 2; }
  });
}

/* ---------------- Tileo Links ---------------- */
function segClosest(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1); return [ax + dx * t, az + dz * t]; }
function actGolf() {
  const c = Player.char, gy = GOLF.y, ballM = GOLF.ball, arrow = GOLF.arrow, meter = $('meter'), needle = $('mneedle');
  const R = 0.05, card = [];
  let hi = 0, strokes = 0, phase = 'aim', mt = 0, power = 0, aim = 0, b = null, last = null, waitT = 0;
  if (Food.held) dropFood();
  const hole = () => GOLF.holes[hi];
  const startHole = i => {
    hi = i; const h = hole(); b = { x: h.tee[0], z: h.tee[1], vx: 0, vz: 0 }; last = { x: b.x, z: b.z }; strokes = 0; phase = 'aim';
    aim = Math.atan2(h.cup[0] - h.tee[0], h.cup[1] - h.tee[1]); if (h.name === 'Dogleg') aim = Math.PI;
    info(); toast(`Hole ${i + 1}: ${h.name}`, `Par ${h.par}`);
  };
  const info = () => { const h = hole(); $('bigVal').textContent = `HOLE ${hi + 1}`; $('bigLbl').textContent = `${h.name.toUpperCase()} · PAR ${h.par} · STROKE ${strokes + (phase === 'roll' ? 0 : 1)}`; };
  const millSegs = h => { if (!h.mill) return []; const out = []; for (let k = 0; k < 4; k++) { const a = h.mill.a + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); out.push([h.mill.x + ca * 0.12, h.mill.z - sa * 0.12, h.mill.x + ca * (h.mill.r + 0.12), h.mill.z - sa * (h.mill.r + 0.12)]); } return out; };
  startActivity({
    exitable: true, active: true, bar: [{ label: 'Leave course', fn: endActivity }],
    enter() {
      setHeld(c, 'putter'); c.noSip = true; c.setAnim('putt'); ballM.visible = true; arrow.visible = true;
      $('bigRead').hidden = false; meter.hidden = true;
      $('mzone').style.left = '0%'; $('mzone').style.width = '100%'; $('msweet').style.left = '60%'; $('msweet').style.width = '0%';
      startHole(0);
    },
    onAction() {
      if (phase === 'aim') { phase = 'power'; mt = 0; meter.hidden = false; setAction({ kind: 'groove', label: 'Hit', id: 'golfhit' }); }
      else if (phase === 'power') this.shoot();
    },
    onJump() { this.onAction(); },
    shoot() {
      const sp = 0.6 + power * 5.0; b.vx = Math.sin(aim) * sp; b.vz = Math.cos(aim) * sp; last = { x: b.x, z: b.z };
      strokes++; phase = 'roll'; meter.hidden = true; c.swing = 0.9; sfx('tock'); setAction(null); info();
    },
    update(dt, inp) {
      const h = hole();
      if (phase === 'aim' || phase === 'power') {
        aim += inp.x * 1.4 * dt - Input.camDX * 0.006; Input.camDX = 0; Input.camDY = 0;
        if (phase === 'aim') setAction({ kind: 'shoot', label: 'Swing', id: 'golfswing' });
      }
      if (phase === 'power') { mt += dt; power = (1 - Math.cos(mt * 2.3)) / 2; needle.style.left = (power * 100) + '%'; c.swing = -power; }
      else c.swing = damp(c.swing || 0, 0, 4, dt);
      if (phase === 'roll') {
        const sub = 8, hdt = dt / sub;
        for (let k = 0; k < sub && phase === 'roll'; k++) {
          b.x += b.vx * hdt; b.z += b.vz * hdt;
          const segs = h.segs.concat(millSegs(h));
          for (let si = 0; si < segs.length; si++) {
            const sg = segs[si], [qx, qz] = segClosest(b.x, b.z, sg[0], sg[1], sg[2], sg[3]);
            let dx = b.x - qx, dz = b.z - qz, d = Math.hypot(dx, dz); const lim = R + (si >= h.segs.length ? 0.05 : 0.07);
            if (d < lim) {
              if (d < 1e-5) { dx = 0; dz = 1; d = 1; }
              const nx = dx / d, nz = dz / d; let bvx = 0, bvz = 0;
              if (si >= h.segs.length) { const w = 1.5, rx = qx - h.mill.x, rz = qz - h.mill.z; bvx = w * rz; bvz = -w * rx; }
              const rvx = b.vx - bvx, rvz = b.vz - bvz, vn = rvx * nx + rvz * nz;
              if (vn < 0) { b.vx -= 1.72 * vn * nx; b.vz -= 1.72 * vn * nz; if (Math.abs(vn) > 0.4) sfx('tick', 0.5); }
              b.x = qx + nx * lim; b.z = qz + nz * lim;
            }
          }
          let sp = Math.hypot(b.vx, b.vz); const ns = Math.max(0, sp - (0.5 + 0.32 * sp) * hdt);
          if (sp > 0) { b.vx *= ns / sp; b.vz *= ns / sp; } sp = ns;
          const dc = Math.hypot(b.x - h.cup[0], b.z - h.cup[1]);
          if (dc < 0.085 && sp < 1.5) { phase = 'sunk'; waitT = 1.8; b.vx = b.vz = 0; sfx('cup'); this.sunk(); break; }
          else if (dc < 0.1 && sp >= 1.5) { const ax = (b.x - h.cup[0]) / dc, az = (b.z - h.cup[1]) / dc; b.vx += ax * 0.6; b.vz += az * 0.6; }
          if (h.pond && ((b.x - h.pond.x) / h.pond.rx) ** 2 + ((b.z - h.pond.z) / h.pond.rz) ** 2 < 1) { fxSplash(b.x, gy, b.z, 0.5); sfx('splash', 0.6); strokes++; toast('Splash!', 'One-stroke penalty. Back to your last spot.'); b.x = last.x; b.z = last.z; b.vx = b.vz = 0; phase = 'aim'; info(); break; }
          if (!pip(b.x, b.z, h.poly)) { b.x = last.x; b.z = last.z; b.vx = b.vz = 0; phase = 'aim'; break; }
          if (sp < 0.03) { b.vx = b.vz = 0; phase = 'aim'; info(); aim = Math.atan2(h.cup[0] - b.x, h.cup[1] - b.z); if (strokes >= 8) { toast('Picked up', 'Eight strokes is the max on a hole.'); phase = 'sunk'; waitT = 1.2; this.sunk(true); } }
        }
      }
      if (phase === 'sunk') { waitT -= dt; if (waitT <= 0) { if (hi < GOLF.holes.length - 1) startHole(hi + 1); else return this.finish(); } }
      ballM.position.set(b.x, gy + R, b.z); if (phase === 'roll') ballM.rotation.x += Math.hypot(b.vx, b.vz) * dt / R;
      if (phase === 'sunk') ballM.position.y = gy - 0.04;
      arrow.visible = phase === 'aim' || phase === 'power'; arrow.position.set(b.x, gy + 0.012, b.z); arrow.rotation.y = aim + Math.PI; arrow.scale.set(1, 1, 0.5 + (phase === 'power' ? power : 0.25) * 1.6);
      if (phase !== 'roll') { const dx = Math.sin(aim), dz = Math.cos(aim); Player.pos.set(b.x - dx * 0.12 - dz * 0.42, DK.top + 0.1, b.z - dz * 0.12 + dx * 0.42); Player.yaw = aim + Math.PI / 2; }
    },
    sunk(pickup) {
      const h = hole(); card.push(strokes);
      const d = strokes - h.par, names = { '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Double bogey' };
      if (!pickup) flashJudge(strokes === 1 ? 'HOLE IN ONE!' : (names[d] || (d > 0 ? '+' + d : d)).toUpperCase(), strokes <= h.par ? 'var(--brass)' : 'var(--foam)');
    },
    finish() {
      const total = card.reduce((a, b) => a + b, 0), par = GOLF.holes.reduce((a, h) => a + h.par, 0), pr = G.profile;
      if (!pr.golfBest || total < pr.golfBest) pr.golfBest = total;
      toast(`Round complete: ${total} strokes`, `Par ${par} · ${card.map((s, i) => 'H' + (i + 1) + ' ' + s).join(' · ')}`);
      if (total <= par) stamp('golf');
      saveProfile(); endActivity();
    },
    camera() {
      if (!b) return null; const dx = Math.sin(aim), dz = Math.cos(aim);
      if (phase === 'roll') return { pos: V3(b.x - dx * 3.4, gy + 2.6, b.z - dz * 3.4), look: V3(b.x, gy, b.z), k: 3, fov: 55 };
      return { pos: V3(b.x - dx * 3.0, gy + 1.9, b.z - dz * 3.0), look: V3(b.x + dx * 2.2, gy, b.z + dz * 2.2), k: 6, fov: 55 };
    },
    exit() { ballM.visible = false; arrow.visible = false; meter.hidden = true; $('bigRead').hidden = true; setHeld(c, null); c.noSip = false; c.setAnim('idle'); Player.pos.set(-22, DK.top, -13.6); Player.yaw = Math.PI; }
  });
}

/* ---------------- per-frame venue animation ---------------- */
function updateVenues(dt) {
  for (const h of GOLF.holes) if (h.mill) { h.mill.a += dt * 1.5; h.mill.obj.rotation.y = h.mill.a; }
  if (G.surfFoam) { MAT.surfFoam.map.offset.y = (MAT.surfFoam.map.offset.y - dt * 1.4) % 1; }
  if (G.rlWheel) { const R = G.rlWheel; R.wheel.rotation.y += dt * R.spin; R.spin = damp(R.spin, 0.35, 0.35, dt); R.ballA -= dt * R.spin * 1.8; R.ball.position.set(Math.cos(R.ballA) * R.ballR, 0.03, Math.sin(R.ballA) * R.ballR); }
  const inCasino = Player.level === 'casino';
  if (G.casinoGroup.visible !== inCasino) G.casinoGroup.visible = inCasino;
  const sd = G.camera.position.distanceTo(_v1.set(24, 39, 88.8));
  G.suiteGroup.visible = sd < 160;
}

/* ---- 63_casino.js ---- */
/* ================= Tileo Casino: slots, blackjack, roulette (free play chips, no cash value) ================= */
const Casino = { shoe: [], symImgs: null, onClose: null, bet: { slots: 25, bj: 50, rl: 25 }, rlHist: [] };
function chipsNow() { const p = G.profile; if (p.chips == null) p.chips = 1000; return p.chips; }
function setChips(n) { G.profile.chips = Math.max(0, Math.round(n)); saveProfile(); document.querySelectorAll('.chipcount').forEach(e => e.textContent = G.profile.chips.toLocaleString('en-US')); }
function topUpChips() { const p = G.profile; if (chipsNow() < 50 && p.chipDay !== Clock.day) { p.chipDay = Clock.day; setChips(500); toast('The cashier topped you up', '500 play chips. Chips have no cash value.'); } }
const chipBar = () => `<div class="chiprow"><span class="chipdot"></span><b class="chipcount">${chipsNow().toLocaleString('en-US')}</b><small>play chips · no cash value</small></div>`;

function openPanel(title, sub, html, onMount, onClose) {
  closePanel();
  const host = $('panelHost');
  host.innerHTML = `<div class="scrim" id="pScrim"></div><section class="gp" role="dialog" aria-label="${esc(title)}"><div class="sh-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="sh-x" id="pX" aria-label="Close">${SVG(IC.close)}</button></div><div class="gp-body" id="pBody">${html}</div></section>`;
  $('pScrim').onclick = closePanel; $('pX').onclick = closePanel;
  Casino.onClose = onClose || null;
  if (onMount) onMount($('pBody'));
}
function closePanel() { const host = $('panelHost'); if (!host || !host.innerHTML) return; host.innerHTML = ''; const f = Casino.onClose; Casino.onClose = null; if (f) f(); }
function seatAt(bar, anim) {
  const P = Player.pos; let s = null, bd = 7;
  for (const t of World.spots.stools) { if (t.bar !== bar || (t.taken && t.taken !== Player)) continue; const d = Math.hypot(t.x - P.x, t.z - P.z); if (d < bd) { bd = d; s = t; } }
  if (Food.held) dropFood();
  startActivity({
    exitable: true, bar: null,
    enter() { if (s) { s.taken = Player; Player.yaw = s.ry; Player.pos.set(s.x, s.y, s.z); Player.char.seat = 0.81; Player.char.setAnim(anim); } else Player.char.setAnim('idle'); },
    update() { },
    exit() { if (s) { s.taken = null; Player.pos.x -= Math.sin(s.ry) * 0.8; Player.pos.z -= Math.cos(s.ry) * 0.8; } Player.char.setAnim('idle'); closePanel(); }
  });
}
function casinoWin() { stamp('casino'); sfx('win'); }

/* ---------------- slots ---------------- */
const SLOT_WEIGHTS = { tile: 2, seven: 1, star: 3, wave: 4, sun: 4, anchor: 4 };
function slotImgs() {
  if (Casino.symImgs) return Casino.symImgs;
  Casino.symImgs = {};
  for (const k of SLOT_SYMS) { const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'); g.fillStyle = '#f7fafc'; g.fillRect(0, 0, 120, 120); drawSymbol(g, k, 60, 62, 96); Casino.symImgs[k] = c.toDataURL(); }
  return Casino.symImgs;
}
function slotPick() { const tot = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0); let r = Math.random() * tot; for (const k in SLOT_WEIGHTS) { r -= SLOT_WEIGHTS[k]; if (r < 0) return k; } return 'wave'; }
function openSlots() {
  topUpChips(); seatAt('slots', 'slot');
  const im = slotImgs(), cur = ['seven', 'tile', 'star'];
  const reel = i => `<div class="reel"><div class="strip" id="strip${i}"><img alt="" src="${im[cur[i]]}"></div></div>`;
  const pay = `<div class="paytable"><span><img src="${im.seven}" alt="Seven">×3 pays 50×</span><span><img src="${im.tile}" alt="Tile">×3 pays 25×</span><span>Any three pays 10×</span><span>Two sevens pay 3×</span><span>Any pair returns your bet</span></div>`;
  openPanel('Tileo Slots', 'Three reels. Line up the symbols.', chipBar() + `<div class="reels">${[0, 1, 2].map(reel).join('')}<div class="payline"></div></div>
    <div class="row"><label>Bet</label><div class="seg" id="slBet">${[10, 25, 50].map(v => `<button data-v="${v}" aria-pressed="${Casino.bet.slots === v}">${v}</button>`).join('')}</div></div>
    <button class="btn btn-primary btn-wide" id="slSpin">Spin</button><p class="gp-msg" id="slMsg">Good luck.</p>${pay}`, body => {
    body.querySelectorAll('#slBet button').forEach(b => b.onclick = () => { Casino.bet.slots = +b.dataset.v; body.querySelectorAll('#slBet button').forEach(x => x.setAttribute('aria-pressed', x === b)); sfx('tick'); });
    let spinning = false;
    $('slSpin').onclick = () => {
      if (spinning) return; const bet = Casino.bet.slots;
      if (chipsNow() < bet) { $('slMsg').textContent = 'Not enough chips for that bet.'; topUpChips(); return; }
      setChips(chipsNow() - bet); spinning = true; $('slSpin').disabled = true; sfx('reel');
      const res = [slotPick(), slotPick(), slotPick()], cellH = 84;
      res.forEach((r, i) => {
        const st = $('strip' + i); const cells = [cur[i]]; for (let k = 0; k < 16 + i * 4; k++) cells.push(SLOT_SYMS[Math.floor(Math.random() * 6)]); cells.push(r);
        st.style.transition = 'none'; st.style.transform = 'translateY(0)'; st.innerHTML = cells.map(c => `<img alt="" src="${im[c]}">`).join('');
        void st.offsetHeight; const dur = 1.0 + i * 0.4;
        st.style.transition = `transform ${dur}s cubic-bezier(.12,.62,.2,1)`; st.style.transform = `translateY(${-(cells.length - 1) * cellH}px)`;
        setTimeout(() => sfx('tock', 0.5), dur * 1000);
      });
      setTimeout(() => {
        res.forEach((r, i) => cur[i] = r);
        const [a, b, c] = res, cnt = {}; res.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
        let mult = 0, msg = 'No luck this time.';
        if (a === b && b === c) { mult = a === 'seven' ? 50 : a === 'tile' ? 25 : 10; msg = a === 'seven' ? 'JACKPOT! Triple sevens.' : 'Three of a kind!'; }
        else if (cnt.seven === 2) { mult = 3; msg = 'Two sevens!'; }
        else if (Object.values(cnt).includes(2)) { mult = 1; msg = 'A pair. Your bet comes back.'; }
        const win = bet * mult; if (win) setChips(chipsNow() + win);
        $('slMsg').textContent = win > bet ? `${msg} You win ${win.toLocaleString('en-US')} chips.` : msg;
        if (win > bet) { casinoWin(); if (G.rlWheel) { } } else sfx(mult ? 'tick' : 'clank', 0.4);
        spinning = false; const sb = $('slSpin'); if (sb) sb.disabled = false;
      }, 1950);
    };
  }, endActivity);
}

/* ---------------- blackjack ---------------- */
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function newShoe() { const s = []; for (let d = 0; d < 6; d++) for (const su of SUITS) for (const r of RANKS) s.push([r, su]); for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } Casino.shoe = s; }
function drawCard() { if (Casino.shoe.length < 52) newShoe(); return Casino.shoe.pop(); }
function handVal(h) { let t = 0, a = 0; for (const [r] of h) { if (r === 'A') { t += 11; a++; } else t += ['J', 'Q', 'K'].includes(r) ? 10 : +r; } while (t > 21 && a) { t -= 10; a--; } return t; }
const cardHTML = (c, hide) => hide ? `<div class="card back" aria-label="Face-down card"></div>` : `<div class="card ${c[1] === '♥' || c[1] === '♦' ? 'red' : ''}" aria-label="${c[0]} of ${{ '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' }[c[1]]}"><b>${c[0]}</b><span>${c[1]}</span></div>`;
function openBlackjack() {
  topUpChips(); seatAt('bj', 'cards');
  let st = { phase: 'bet', p: [], d: [], bet: 0 };
  const render = () => {
    const B = $('pBody'); if (!B) return;
    const showD = st.phase === 'done' || st.phase === 'dealer';
    $('bjD').innerHTML = st.d.map((c, i) => cardHTML(c, i === 1 && !showD)).join('');
    $('bjP').innerHTML = st.p.map(c => cardHTML(c)).join('');
    $('bjDv').textContent = st.d.length ? (showD ? handVal(st.d) : '?') : '';
    $('bjPv').textContent = st.p.length ? handVal(st.p) : '';
    $('bjBtns').innerHTML = st.phase === 'play'
      ? `<button class="btn btn-primary" id="bjHit">Hit</button><button class="btn btn-glass" id="bjStand">Stand</button>${st.p.length === 2 && chipsNow() >= st.bet ? '<button class="btn btn-glass" id="bjDbl">Double</button>' : ''}`
      : `<button class="btn btn-primary btn-wide" id="bjDeal">${st.phase === 'done' ? 'Deal again' : 'Deal'}</button>`;
    const on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
    on('bjDeal', deal); on('bjHit', hit); on('bjStand', stand); on('bjDbl', dbl);
  };
  const msg = t => { const e = $('bjMsg'); if (e) e.textContent = t; };
  const settle = (res) => {
    st.phase = 'done'; let pay = 0, t;
    if (res === 'bj') { pay = st.bet * 2.5; t = 'Blackjack! Paid 3 to 2.'; }
    else if (res === 'win') { pay = st.bet * 2; t = 'You win!'; }
    else if (res === 'push') { pay = st.bet; t = 'Push. Your bet comes back.'; }
    else t = res === 'bust' ? 'Bust. Dealer wins.' : 'Dealer wins.';
    if (pay) setChips(chipsNow() + pay);
    msg(t + (pay > st.bet ? ` +${(pay - st.bet).toLocaleString('en-US')} chips` : ''));
    if (pay > st.bet) casinoWin(); else if (!pay) sfx('clank', 0.4);
    render();
  };
  function deal() {
    const bet = Casino.bet.bj; if (chipsNow() < bet) { msg('Not enough chips for that bet.'); topUpChips(); return; }
    setChips(chipsNow() - bet); st = { phase: 'play', p: [drawCard()], d: [drawCard()], bet }; st.p.push(drawCard()); st.d.push(drawCard()); sfx('card');
    const pb = handVal(st.p) === 21, db = handVal(st.d) === 21;
    if (pb || db) { st.phase = 'dealer'; return settle(pb && db ? 'push' : pb ? 'bj' : 'lose'); }
    msg('Hit or stand?'); render();
  }
  function hit() { st.p.push(drawCard()); sfx('card'); if (handVal(st.p) > 21) return settle('bust'); if (handVal(st.p) === 21) return stand(); render(); }
  function dbl() { if (chipsNow() < st.bet) return; setChips(chipsNow() - st.bet); st.bet *= 2; st.p.push(drawCard()); sfx('card'); if (handVal(st.p) > 21) return settle('bust'); stand(); }
  function stand() {
    st.phase = 'dealer'; render();
    const step = () => {
      if (!$('pBody')) return;
      if (handVal(st.d) < 17) { st.d.push(drawCard()); sfx('card'); render(); setTimeout(step, 520); return; }
      const p = handVal(st.p), d = handVal(st.d);
      settle(d > 21 || p > d ? 'win' : p === d ? 'push' : 'lose');
    };
    setTimeout(step, 450);
  }
  openPanel('Blackjack', 'Six decks. Dealer stands on 17. Blackjack pays 3 to 2.', chipBar() + `
    <div class="felt"><div class="hand"><span class="lbl">Dealer <b id="bjDv"></b></span><div class="cards" id="bjD"></div></div>
    <div class="hand"><span class="lbl">You <b id="bjPv"></b></span><div class="cards" id="bjP"></div></div></div>
    <p class="gp-msg" id="bjMsg">Place your bet and deal.</p>
    <div class="row"><label>Bet</label><div class="seg" id="bjBet">${[25, 50, 100].map(v => `<button data-v="${v}" aria-pressed="${Casino.bet.bj === v}">${v}</button>`).join('')}</div></div>
    <div class="btnrow" id="bjBtns"></div>`, body => {
    body.querySelectorAll('#bjBet button').forEach(b => b.onclick = () => { Casino.bet.bj = +b.dataset.v; body.querySelectorAll('#bjBet button').forEach(x => x.setAttribute('aria-pressed', x === b)); sfx('tick'); });
    render();
  }, endActivity);
}

/* ---------------- roulette ---------------- */
function rlColor(n) { return n === 0 ? 'green' : RL_RED.has(n) ? 'red' : 'black'; }
function openRoulette() {
  topUpChips(); seatAt('rl', 'cards');
  const bets = {}; let chipV = Casino.bet.rl, spinning = false, rot = 0;
  const wheelURL = TEX.rlWheel.image.toDataURL();
  const outside = [['low', '1–18'], ['even', 'Even'], ['red', 'Red'], ['black', 'Black'], ['odd', 'Odd'], ['high', '19–36'], ['d1', '1st 12'], ['d2', '2nd 12'], ['d3', '3rd 12']];
  let grid = `<button class="rn green" data-b="n0" style="grid-row:1/4">0</button>`;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) { const n = c * 3 + (3 - r); grid += `<button class="rn ${rlColor(n)}" data-b="n${n}" style="grid-row:${r + 1};grid-column:${c + 2}">${n}</button>`; }
  const total = () => Object.values(bets).reduce((a, b) => a + b, 0);
  const paint = () => { document.querySelectorAll('#pBody [data-b]').forEach(el => { const v = bets[el.dataset.b]; el.dataset.amt = v ? v : ''; el.classList.toggle('bet', !!v); }); const t = $('rlTot'); if (t) t.textContent = total() ? `Total bet ${total().toLocaleString('en-US')}` : 'Tap the board to place chips'; };
  openPanel('Roulette', 'Single zero. Straight up pays 35 to 1.', chipBar() + `
    <div class="rlwrap"><div class="rlwheel" id="rlWheel"><img src="${wheelURL}" alt="Roulette wheel"></div><div class="rlptr"></div><div class="rlres" id="rlRes"></div></div>
    <div class="rlgrid">${grid}</div>
    <div class="rlout">${outside.map(([k, t]) => `<button class="ro ${k === 'red' ? 'red' : k === 'black' ? 'black' : ''}" data-b="${k}">${t}</button>`).join('')}</div>
    <div class="row"><label>Chip</label><div class="seg" id="rlChip">${[10, 25, 50, 100].map(v => `<button data-v="${v}" aria-pressed="${chipV === v}">${v}</button>`).join('')}</div></div>
    <p class="gp-msg" id="rlMsg"></p><p class="kbd" id="rlTot" style="text-align:center">Tap the board to place chips</p>
    <div class="btnrow"><button class="btn btn-glass" id="rlClr">Clear</button><button class="btn btn-primary btn-wide" id="rlSpin">Spin</button></div>
    <p class="kbd" id="rlHist">${Casino.rlHist.length ? 'Last: ' + Casino.rlHist.join(' · ') : ''}</p>`, body => {
    body.querySelectorAll('#rlChip button').forEach(b => b.onclick = () => { chipV = Casino.bet.rl = +b.dataset.v; body.querySelectorAll('#rlChip button').forEach(x => x.setAttribute('aria-pressed', x === b)); sfx('tick'); });
    body.querySelectorAll('[data-b]').forEach(el => el.onclick = () => { if (spinning) return; if (total() + chipV > chipsNow()) { $('rlTot').textContent = 'Not enough chips for another bet.'; return; } bets[el.dataset.b] = (bets[el.dataset.b] || 0) + chipV; sfx('chip'); paint(); });
    $('rlClr').onclick = () => { if (spinning) return; for (const k in bets) delete bets[k]; paint(); };
    $('rlSpin').onclick = () => {
      const t = total(); if (spinning) return; if (!t) { $('rlMsg').textContent = 'Place a bet first.'; return; }
      $('rlMsg').textContent = 'No more bets…';
      setChips(chipsNow() - t); spinning = true; $('rlSpin').disabled = true; $('rlRes').textContent = ''; sfx('reel');
      const n = Math.floor(Math.random() * 37), i = RL_ORDER.indexOf(n), target = -((i + 0.5) / 37) * 360;
      rot = rot - (rot % 360) + 360 * 6 + ((target % 360) + 360) % 360;
      const w = $('rlWheel'); w.style.transition = 'transform 4.2s cubic-bezier(.12,.6,.15,1)'; w.style.transform = `rotate(${rot}deg)`;
      if (G.rlWheel) G.rlWheel.spin = 7;
      setTimeout(() => {
        if (!$('pBody')) return;
        const col = rlColor(n); let pay = 0;
        for (const [k, v] of Object.entries(bets)) {
          let win = false, m = 0;
          if (k[0] === 'n') { win = +k.slice(1) === n; m = 36; }
          else if (k[0] === 'd') { const d = +k[1]; win = n >= (d - 1) * 12 + 1 && n <= d * 12; m = 3; }
          else { m = 2; win = n !== 0 && ((k === 'red' && col === 'red') || (k === 'black' && col === 'black') || (k === 'odd' && n % 2 === 1) || (k === 'even' && n % 2 === 0) || (k === 'low' && n <= 18) || (k === 'high' && n >= 19)); }
          if (win) pay += v * m;
        }
        if (pay) setChips(chipsNow() + pay);
        $('rlRes').innerHTML = `<b class="${col}">${n}</b>`;
        $('rlMsg').textContent = pay > t ? `${n} ${col}. You win ${(pay - t).toLocaleString('en-US')} chips!` : pay ? `${n} ${col}. You get ${pay.toLocaleString('en-US')} back.` : `${n} ${col}. No win this spin.`;
        if (pay > t) casinoWin(); else sfx('clank', 0.4);
        Casino.rlHist.unshift(n); Casino.rlHist.length = Math.min(Casino.rlHist.length, 8); $('rlHist').textContent = 'Last: ' + Casino.rlHist.join(' · ');
        for (const k in bets) delete bets[k]; paint(); spinning = false; $('rlSpin').disabled = false;
      }, 4300);
    };
    paint();
  }, endActivity);
}

/* ---- 64_trivia.js ---- */
/* ================= trivia night + the dome / suite screen ================= */
const TRIVIA_Q = [
  ['What is the largest ocean on Earth?', 'Pacific', 'Atlantic', 'Indian', 'Arctic'],
  ['What is the front of a ship called?', 'Bow', 'Stern', 'Keel', 'Hull'],
  ['What is the back of a ship called?', 'Stern', 'Bow', 'Mast', 'Bridge'],
  ['Facing forward on a ship, which side is port?', 'Left', 'Right', 'Front', 'Back'],
  ['Facing forward on a ship, which side is starboard?', 'Right', 'Left', 'Front', 'Back'],
  ['A speed of one nautical mile per hour is called a…', 'Knot', 'League', 'Fathom', 'Cable'],
  ['A nautical mile is based on one minute of…', 'Latitude', 'Longitude', 'Time', 'Altitude'],
  ['Where does the captain usually navigate the ship from?', 'The bridge', 'The galley', 'The hold', 'The bilge'],
  ['What is a ship\'s kitchen called?', 'Galley', 'Pantry', 'Mess', 'Brig'],
  ['What is the ship\'s steering wheel called?', 'Helm', 'Rudder', 'Tiller pin', 'Capstan'],
  ['What is the largest animal that has ever lived?', 'Blue whale', 'Whale shark', 'African elephant', 'Giant squid'],
  ['How many arms does an octopus have?', '8', '6', '10', '12'],
  ['How many hearts does an octopus have?', '3', '1', '2', '4'],
  ['What is a baby whale called?', 'Calf', 'Pup', 'Kit', 'Fry'],
  ['A group of fish swimming together is called a…', 'School', 'Pod', 'Herd', 'Flock'],
  ['Coral reefs are built by tiny animals called…', 'Polyps', 'Plankton', 'Krill', 'Barnacles'],
  ['The Great Barrier Reef lies off the coast of which country?', 'Australia', 'Brazil', 'Mexico', 'Indonesia'],
  ['Which ocean is the Bermuda Triangle in?', 'Atlantic', 'Pacific', 'Indian', 'Southern'],
  ['The Panama Canal links the Atlantic Ocean to the…', 'Pacific Ocean', 'Indian Ocean', 'Arctic Ocean', 'Mediterranean Sea'],
  ['Which ocean lies between Africa and Australia?', 'Indian', 'Atlantic', 'Pacific', 'Southern'],
  ['What is the largest island in the world?', 'Greenland', 'Madagascar', 'Borneo', 'Iceland'],
  ['What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
  ['What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'],
  ['Which country is shaped like a boot?', 'Italy', 'Spain', 'Greece', 'Portugal'],
  ['In which city is the Eiffel Tower?', 'Paris', 'Lyon', 'Brussels', 'Geneva'],
  ['The Statue of Liberty was a gift from which country?', 'France', 'Spain', 'Italy', 'United Kingdom'],
  ['Mount Everest is in which mountain range?', 'Himalayas', 'Andes', 'Alps', 'Rockies'],
  ['What is the largest hot desert in the world?', 'Sahara', 'Gobi', 'Kalahari', 'Mojave'],
  ['How many continents are there?', '7', '5', '6', '8'],
  ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury'],
  ['What is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Neptune', 'Earth'],
  ['Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Mars', 'Earth'],
  ['Which planet has the most famous rings?', 'Saturn', 'Uranus', 'Mars', 'Mercury'],
  ['What is the closest star to Earth?', 'The Sun', 'Polaris', 'Sirius', 'Alpha Centauri A'],
  ['What gas do plants take in for photosynthesis?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'],
  ['What is the most common gas in Earth\'s atmosphere?', 'Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'],
  ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Go', 'Gd'],
  ['Which metal is liquid at room temperature?', 'Mercury', 'Lead', 'Tin', 'Zinc'],
  ['At sea level, water boils at what temperature in Celsius?', '100', '90', '110', '212'],
  ['Water freezes at what temperature in Fahrenheit?', '32', '0', '10', '-10'],
  ['What is the hardest natural substance?', 'Diamond', 'Quartz', 'Granite', 'Steel'],
  ['How many bones are in the adult human body?', '206', '186', '226', '256'],
  ['What is the largest organ of the human body?', 'Skin', 'Liver', 'Lungs', 'Brain'],
  ['Which vitamin does your skin make in sunlight?', 'Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B12'],
  ['What is the tallest animal on land?', 'Giraffe', 'Elephant', 'Ostrich', 'Moose'],
  ['Which flightless bird is famous for swimming in Antarctica?', 'Penguin', 'Ostrich', 'Kiwi', 'Emu'],
  ['How many sides does a hexagon have?', '6', '5', '7', '8'],
  ['How many degrees are in a right angle?', '90', '45', '180', '360'],
  ['What colour do you get by mixing blue and yellow?', 'Green', 'Purple', 'Orange', 'Brown'],
  ['How many strings does a standard guitar have?', '6', '4', '5', '7'],
  ['How many keys does a standard piano have?', '88', '76', '64', '92'],
  ['Which dance comes from Brazil?', 'Samba', 'Tango', 'Flamenco', 'Polka'],
  ['How many players does a soccer team have on the field?', '11', '9', '10', '12'],
  ['In which sport would you see a slam dunk?', 'Basketball', 'Volleyball', 'Tennis', 'Rugby'],
  ['What is the main ingredient in guacamole?', 'Avocado', 'Lime', 'Tomato', 'Pea'],
  ['Sushi comes originally from which country?', 'Japan', 'China', 'Thailand', 'Korea'],
  ['Which nut is used to make marzipan?', 'Almond', 'Walnut', 'Peanut', 'Cashew'],
  ['Which fruit is the star of a piña colada?', 'Pineapple', 'Mango', 'Banana', 'Papaya'],
  ['Which language has the most native speakers?', 'Mandarin Chinese', 'English', 'Spanish', 'Hindi'],
  ['A strong tropical storm in the Atlantic is called a…', 'Hurricane', 'Monsoon', 'Blizzard', 'Sirocco'],
];
const TEAMS = ['The Anchors', 'Deck Fifteen', 'Captain Calamari', 'Wave Makers', 'The Tile Setters', 'Port Side Story'];
const Trivia = { active: false };
function startTrivia() {
  if (Player.activity && Player.activity.exitable === false) return;
  if (Food.held) { }
  const pool = TRIVIA_Q.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const qs = pool.slice(0, 8).map(([q, a, ...w]) => { const opts = [a, ...w]; for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; } return { q, opts, a: opts.indexOf(a) }; });
  const tn = TEAMS.slice().sort(() => Math.random() - 0.5).slice(0, 4).map(n => ({ n, p: mrand(0.42, 0.78), s: 0 }));
  Object.assign(Trivia, { active: true, qs, idx: 0, score: 0, correct: 0, time: 15, phase: 'q', pick: -1, teams: tn, wait: 0 });
  openPanel('Tileo Trivia', 'Eight questions · 15 seconds each', `<div id="tvBody"></div>`, () => renderTrivia(), () => { Trivia.active = false; G.screen.key = ''; });
  sfx('chime');
}
function renderTrivia() {
  const el = $('tvBody'); if (!el) return;
  const T0 = Trivia;
  if (T0.phase === 'done') {
    const peers = typeof netTriviaScores === 'function' ? netTriviaScores() : [];
    const rows = [{ n: (G.profile.name || 'You') + ' (you)', s: T0.score, me: true }, ...T0.teams.map(t => ({ n: t.n, s: t.s })), ...peers].sort((a, b) => b.s - a.s);
    el.innerHTML = `<div class="tv-final"><b>${T0.correct} of 8 correct</b><span>${T0.score.toLocaleString('en-US')} points</span></div>
      <ol class="board">${rows.map((r, i) => `<li class="${r.me ? 'me' : ''}"><span>${i + 1}</span><span>${esc(r.n)}</span><b>${r.s.toLocaleString('en-US')}</b></li>`).join('')}</ol>
      <div class="btnrow"><button class="btn btn-primary btn-wide" id="tvAgain">Play another round</button></div>`;
    $('tvAgain').onclick = () => { closePanel(); startTrivia(); };
    return;
  }
  const q = T0.qs[T0.idx];
  el.innerHTML = `<div class="tv-top"><span>Question ${T0.idx + 1} of 8</span><b>${T0.score.toLocaleString('en-US')} pts</b></div>
    <div class="tv-timer"><b id="tvBar" style="width:${T0.time / 15 * 100}%"></b></div>
    <h3 class="tv-q">${esc(q.q)}</h3>
    <div class="tv-opts">${q.opts.map((o, i) => `<button class="tv-o ${T0.phase === 'reveal' ? (i === q.a ? 'ok' : i === T0.pick ? 'no' : '') : ''}" data-i="${i}" ${T0.phase !== 'q' ? 'disabled' : ''}><span>${'ABCD'[i]}</span>${esc(o)}</button>`).join('')}</div>
    <p class="gp-msg" id="tvMsg">${T0.phase === 'reveal' ? (T0.pick === q.a ? 'Correct!' : T0.pick < 0 ? 'Time is up.' : 'Not quite.') + ' The answer is ' + esc(q.opts[q.a]) + '.' : 'Pick an answer.'}</p>`;
  el.querySelectorAll('.tv-o').forEach(b => b.onclick = () => answerTrivia(+b.dataset.i));
}
function answerTrivia(i) {
  const T0 = Trivia; if (!T0.active || T0.phase !== 'q') return;
  const q = T0.qs[T0.idx]; T0.pick = i; T0.phase = 'reveal'; T0.wait = 2.2;
  if (i === q.a) { T0.correct++; T0.score += 100 + Math.round(T0.time * 10); sfx('win'); } else sfx('clank', 0.5);
  for (const t of T0.teams) if (Math.random() < t.p) t.s += 100 + Math.round(mrand(20, 140));
  renderTrivia(); G.screen.key = '';
}
function updateTrivia(dt) {
  const T0 = Trivia; if (!T0.active) return;
  if (T0.phase === 'q') { T0.time -= dt; const b = $('tvBar'); if (b) b.style.width = Math.max(0, T0.time / 15 * 100) + '%'; if (T0.time <= 0) { T0.time = 0; answerTrivia(-1); } }
  else if (T0.phase === 'reveal') { T0.wait -= dt; if (T0.wait <= 0) { T0.idx++; if (T0.idx >= 8) { T0.phase = 'done'; const pr = G.profile; if (T0.score > (pr.triviaBest || 0)) pr.triviaBest = T0.score; if (T0.correct >= 6) stamp('trivia'); saveProfile(); } else { T0.phase = 'q'; T0.time = 15; T0.pick = -1; } renderTrivia(); G.screen.key = ''; } }
}

/* ---------------- screen drawing (dome LED wall + suite TV) ---------------- */
const ART = {};
function artImg(song) { if (!ART[song.id]) { const im = new Image(); im.onload = () => { G.screen.key = ''; }; im.src = song.art; ART[song.id] = im; } return ART[song.id]; }
let screenT = 0;
function updateScreen(dt) {
  screenT -= dt; if (screenT > 0) return; screenT = 0.3;
  const S = G.screen, g = S.g, w = 1024, h = 576;
  const song = Radio.cur, T0 = Trivia;
  let key;
  if (T0.active && T0.phase !== 'done') key = 'tv' + T0.idx + T0.phase + Math.ceil(T0.time);
  else if (song && Radio.playing) key = 'np' + song.id + Math.floor((Radio.el.currentTime || 0) / 2) + (ART[song.id] && ART[song.id].complete ? 1 : 0);
  else key = 'idle' + fmtTime(Clock.min).slice(0, 4);
  if (key === S.key) return; S.key = key;
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#0b1b33'); bg.addColorStop(1, '#1b0f3a'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.textBaseline = 'alphabetic';
  if (key.startsWith('tv')) {
    const q = T0.qs[T0.idx];
    g.fillStyle = '#2fd3c6'; g.font = `500 28px ${FONT('mono')}`; g.fillText(`TILEO TRIVIA · QUESTION ${T0.idx + 1} OF 8`, 48, 64);
    g.fillStyle = '#ffc95c'; g.fillRect(48, 84, (w - 96) * Math.max(0, T0.time / 15), 8);
    g.fillStyle = '#f2f7fb'; g.font = `700 46px ${FONT('body')}`; wrapText(g, q.q, 48, 160, w - 96, 56);
    q.opts.forEach((o, i) => { const x = 48 + (i % 2) * 476, y = 320 + Math.floor(i / 2) * 116; const rev = T0.phase === 'reveal'; g.fillStyle = rev && i === q.a ? '#2fd3c6' : 'rgba(255,255,255,.1)'; rr(g, x, y, 452, 96, 18); g.fill(); g.fillStyle = rev && i === q.a ? '#032b2a' : '#f2f7fb'; g.font = `700 34px ${FONT('body')}`; g.fillText('ABCD'[i] + '  ' + o, x + 24, y + 60); });
  } else if (key.startsWith('np')) {
    const im = artImg(song); if (im.complete && im.naturalWidth) g.drawImage(im, 56, 88, 400, 400); else { drawEmblem(g, 120, 152, 272, 20); }
    g.fillStyle = '#2fd3c6'; g.font = `500 28px ${FONT('mono')}`; g.fillText('NOW PLAYING · TILEO RADIO', 500, 150);
    g.fillStyle = '#f2f7fb'; g.font = `900 48px ${FONT()}`; wrapText(g, song.title, 500, 230, 480, 58);
    g.fillStyle = '#9fb4cc'; g.font = `600 32px ${FONT('body')}`; g.fillText(song.artist, 500, 400);
    const pr = clamp((Radio.el.currentTime || 0) / (Radio.el.duration || song.dur), 0, 1); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(500, 440, 460, 8); g.fillStyle = '#ff6a55'; g.fillRect(500, 440, 460 * pr, 8);
  } else {
    drawEmblem(g, 412, 120, 200, 16); g.fillStyle = '#f2f7fb'; g.font = `900 72px ${FONT()}`; g.textAlign = 'center'; g.fillText('TILEO', w / 2, 420);
    const e = nextEvent(); g.fillStyle = '#9fb4cc'; g.font = `500 30px ${FONT('mono')}`; if (e) g.fillText(`NEXT · ${e.name.toUpperCase()} · ${fmtTime(e.start)}`, w / 2, 480); g.textAlign = 'left';
  }
  S.tex.needsUpdate = true;
}
function wrapText(g, text, x, y, maxW, lh) { const words = String(text).split(' '); let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); line = wd; y += lh; } else line = t; } g.fillText(line, x, y); }

/* ---- 65_suite.js ---- */
/* ================= your suite: visit, decorate, room service, music ================= */
const WALLS = ['#e9e1d3', '#cfe3ee', '#f3d6cf', '#d9ead3', '#2b3b5c', '#f6efe1'];
const FLOORS = [['Plush carpet', '#d8cbb6', 'plush'], ['Teak', '#ffffff', 'teak'], ['Terrazzo', '#ffffff', 'terrazzo'], ['White tile', '#ffffff', 'bigTile']];
const BEDS = ['#f4f1e8', '#2fd3c6', '#ff6a55', '#10264a', '#ffc95c', '#b18cff'];
const ACCENTS = ['#10264a', '#ff6a55', '#2fd3c6', '#ffc95c', '#7a1f2b', '#5a8f4e'];
const DECOR = [
  { id: 'sofa', name: 'Sofa', r: 0.9 }, { id: 'armchair', name: 'Armchair', r: 0.5 }, { id: 'coffee', name: 'Coffee table', r: 0.5 }, { id: 'rug', name: 'Round rug', r: 0 },
  { id: 'palm', name: 'Potted palm', r: 0.4 }, { id: 'monstera', name: 'Monstera', r: 0.35 }, { id: 'lamp', name: 'Floor lamp', r: 0.25 }, { id: 'lava', name: 'Lava lamp', r: 0.2 },
  { id: 'shelf', name: 'Bookshelf', r: 0.5 }, { id: 'aquarium', name: 'Aquarium', r: 0.55 }, { id: 'beanbag', name: 'Beanbag', r: 0.45 }, { id: 'jukebox', name: 'Jukebox', r: 0.45 },
  { id: 'surfboard', name: 'Surfboard', r: 0.3 }, { id: 'disco', name: 'Disco ball', r: 0 }, { id: 'neon', name: 'Tile neon', r: 0.25 }, { id: 'telescope', name: 'Telescope', r: 0.4 },
];
const Suite = { owner: 'me', layout: null, dyn: [], meshes: [], music: false };
function defaultLayout() { return { w: 0, f: 0, b: 0, a: 0, items: [['sofa', 6.2, 5.1, 2], ['coffee', 7.3, 5.1, 0], ['rug', 7.1, 5.1, 0], ['palm', 9.6, 0.8, 0]] }; }
function myLayout() { const p = G.profile; if (!p.suite) p.suite = defaultLayout(); return p.suite; }
function encodeLayout(L) { return `${L.w}${L.f}${L.b}${L.a}|` + L.items.map(([id, x, z, r]) => `${DECOR.findIndex(d => d.id === id)}.${Math.round(x * 10)}.${Math.round(z * 10)}.${r}`).join(';'); }
function decodeLayout(s) {
  if (typeof s !== 'string' || s.length > 900) return null;
  const [h, it] = s.split('|'); if (!h || h.length !== 4) return null;
  const L = { w: clamp(+h[0] || 0, 0, 5), f: clamp(+h[1] || 0, 0, 3), b: clamp(+h[2] || 0, 0, 5), a: clamp(+h[3] || 0, 0, 5), items: [] };
  for (const part of (it || '').split(';')) { const [i, x, z, r] = part.split('.').map(Number); if (!DECOR[i] || !isFinite(x) || !isFinite(z)) continue; L.items.push([DECOR[i].id, clamp(x / 10, 0.3, 12.2), clamp(z / 10, 0.3, 9.9), clamp(r | 0, 0, 7)]); if (L.items.length >= 24) break; }
  return L;
}
function suiteLocal(x, z) { return [x - SUITE.x0, z - SUITE.z0]; }
function suiteWorld(lx, lz) { return [SUITE.x0 + lx, SUITE.z0 + lz]; }

/* ---------- decor geometry ---------- */
function decorGroup(id) {
  const g = new T.Group(), add = (geo, m, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => { const mesh = new T.Mesh(geo, MAT[m] || m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  switch (id) {
    case 'sofa': add(box(1.9, 0.42, 0.85), 'accent', 0, 0.21, 0); add(box(1.9, 0.55, 0.2), 'accent', 0, 0.62, -0.33); for (const s of [-1, 1]) add(box(0.2, 0.58, 0.85), 'accent', s * 0.95, 0.29, 0); for (const s of [-1, 1]) add(box(0.84, 0.12, 0.66), 'linen', s * 0.43, 0.48, 0.05); add(box(0.4, 0.3, 0.12), 'bedding', -0.55, 0.62, -0.18, 0, 0.2); break;
    case 'armchair': add(box(0.8, 0.4, 0.8), 'accent', 0, 0.2, 0); add(box(0.8, 0.55, 0.18), 'accent', 0, 0.62, -0.31); for (const s of [-1, 1]) add(box(0.14, 0.55, 0.8), 'accent', s * 0.4, 0.28, 0); add(box(0.62, 0.1, 0.6), 'linen', 0, 0.45, 0.05); break;
    case 'coffee': add(cyl(0.5, 0.5, 0.05, 32), 'wood', 0, 0.42, 0); add(cyl(0.06, 0.12, 0.4, 12), 'brass', 0, 0.2, 0); add(cyl(0.12, 0.08, 0.1, 12), 'lagoon', 0.18, 0.5, 0.08); break;
    case 'rug': { const m = add(new T.CircleGeometry(1.25, 48).rotateX(-Math.PI / 2), 'rug', 0, 0.012, 0); m.castShadow = false; break; }
    case 'palm': { add(cyl(0.3, 0.24, 0.5, 20), 'planter', 0, 0.25, 0); const B = new Bin(); palmInto(B, 0, 0.48, 0, 1.6, 0.4, 0.4); B.build(g); break; }
    case 'monstera': add(cyl(0.22, 0.18, 0.42, 18), 'navy', 0, 0.21, 0); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, s = new T.SphereGeometry(0.26, 12, 8); s.scale(1, 0.18, 0.7); add(s, MAT.monstera || (MAT.monstera = vm('#2f7a3a', { roughness: 0.7 })), Math.cos(a) * 0.3, 0.55 + (i % 3) * 0.22, Math.sin(a) * 0.3, -a, 0, 0.5); } break;
    case 'lamp': add(cyl(0.18, 0.2, 0.04, 20), 'brass', 0, 0.02, 0); add(cyl(0.02, 0.02, 1.5, 8), 'brass', 0, 0.78, 0); add(cyl(0.2, 0.28, 0.32, 20, true), 'lampShade', 0, 1.6, 0); break;
    case 'lava': add(new T.ConeGeometry(0.12, 0.2, 16), 'steel', 0, 0.1, 0, 0, Math.PI); { const s = new T.SphereGeometry(0.1, 16, 12); s.scale(1, 2.2, 1); add(s, MAT.lavaGlow || (MAT.lavaGlow = bm('#ff6a55', 1.8)), 0, 0.42, 0); } add(new T.ConeGeometry(0.06, 0.1, 16), 'steel', 0, 0.68, 0); break;
    case 'shelf': add(box(1.2, 1.8, 0.35), 'wood', 0, 0.9, 0); for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) { const bh = 0.24 + ((k * 7 + r) % 3) * 0.04; add(box(0.1, bh, 0.24), ['coral', 'navy', 'lagoon', 'gold', 'white'][(k + r) % 5], -0.48 + k * 0.135, 0.12 + r * 0.42 + bh / 2, 0.02); } break;
    case 'aquarium': add(box(1.1, 0.7, 0.5), 'wood', 0, 0.35, 0); add(box(1.1, 0.6, 0.5), 'glass', 0, 1.0, 0); add(box(1.04, 0.5, 0.44), 'aqua', 0, 0.97, 0); for (let i = 0; i < 6; i++) { const f = new T.ConeGeometry(0.03, 0.09, 8); f.rotateZ(Math.PI / 2); const m = add(f, ['coral', 'gold', 'lagoon'][i % 3], -0.35 + i * 0.14, 0.85 + (i % 3) * 0.1, -0.1 + (i % 2) * 0.2); m.userData.fish = i; } break;
    case 'beanbag': { const s = new T.SphereGeometry(0.48, 20, 14); s.scale(1, 0.62, 1); add(s, 'accent', 0, 0.28, 0); break; }
    case 'jukebox': add(box(0.8, 1.2, 0.5), 'wood', 0, 0.6, 0); { const t = cyl(0.4, 0.4, 0.5, 24, false); t.rotateX(Math.PI / 2); t.scale(1, 0.6, 1); add(t, 'wood', 0, 1.2, 0); } add(new T.TorusGeometry(0.33, 0.03, 8, 32, Math.PI), 'neonC', 0, 1.1, 0.26); add(box(0.5, 0.3, 0.02), 'screen', 0, 0.85, 0.26); add(box(0.6, 0.06, 0.02), 'neonA', 0, 0.45, 0.26); break;
    case 'surfboard': { const s = new T.SphereGeometry(1, 20, 10); s.scale(0.27, 1.05, 0.04); add(s, 'coral', 0, 1.0, 0, 0, -0.18); add(box(0.04, 1.8, 0.09), 'white', 0, 1.0, 0.0, 0, -0.18); break; }
    case 'disco': add(cyl(0.006, 0.006, 0.5, 6), 'steel', 0, 2.38, 0); { const s = new T.IcosahedronGeometry(0.24, 2); const m = add(s, MAT.disco || (MAT.disco = vm('#e6edf2', { roughness: 0.05, metalness: 1, flatShading: true, envMapIntensity: 1.6 })), 0, 1.96, 0); m.userData.spin = true; } break;
    case 'neon': add(box(0.36, 0.06, 0.2), 'darkMetal', 0, 0.03, 0); add(cyl(0.015, 0.015, 0.9, 6), 'steel', 0, 0.48, 0); MAT.neonB = MAT.neonB || bm('#5aa9ff', 3); for (const [m, x, y] of [['neonA', -0.11, 1.07], ['neonC', 0.11, 1.07], ['neonB', -0.11, 0.85], ['neonG', 0.11, 0.85]]) add(box(0.19, 0.19, 0.03), m, x, y, 0); break;
    case 'telescope': for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; add(cyl(0.015, 0.015, 1.1, 6), 'steel', Math.cos(a) * 0.22, 0.52, Math.sin(a) * 0.22, 0, Math.sin(a) * 0.4, -Math.cos(a) * 0.4); } add(cyl(0.06, 0.08, 0.9, 16), 'navy', 0, 1.15, 0.1, 0, 1.0); add(cyl(0.085, 0.085, 0.06, 16), 'brass', 0, 1.3, 0.43, 0, 1.0); break;
  }
  return g;
}
function applySuiteLook(L) {
  MAT.wallpaper.color.copy(lin(WALLS[L.w] || WALLS[0]));
  const F = FLOORS[L.f] || FLOORS[0]; MAT.suiteFloor.map = TEX[F[2]]; MAT.suiteFloor.color.copy(lin(F[1])); MAT.suiteFloor.needsUpdate = true;
  MAT.bedding.color.copy(lin(BEDS[L.b] || BEDS[0])); MAT.accent.color.copy(lin(ACCENTS[L.a] || ACCENTS[0]));
}
function renderDecor(L) {
  const host = G.suiteDecor; while (host.children.length) host.remove(host.children[0]);
  Suite.meshes = []; Suite.dyn = [];
  L.items.forEach((it, i) => {
    const [id, lx, lz, r] = it, g = decorGroup(id), [x, z] = suiteWorld(lx, lz);
    g.position.set(x, SUITE.y + 0.015, z); g.rotation.y = r * Math.PI / 4; g.userData.idx = i; host.add(g); Suite.meshes.push(g);
    const d = DECOR.find(d => d.id === id); if (d && d.r > 0) Suite.dyn.push({ x, z, r: d.r * 0.85, y0: SUITE.y - 0.5, y1: SUITE.y + 2.5 });
  });
  if (Player.level === 'suite') World.dyn = Suite.dyn;
  World.hotspots = World.hotspots.filter(h => !h.jukebox);
  L.items.forEach(([id, lx, lz]) => { if (id === 'jukebox') { const [x, z] = suiteWorld(lx, lz); World.hotspots.push({ id: 'juke' + x, pos: V3(x, SUITE.y, z), r: 1.3, label: 'Play the jukebox', kind: 'music', data: {}, jukebox: true }); } });
}
function showSuite(L) { Suite.layout = L; applySuiteLook(L); renderDecor(L); }

/* ---------- entering / leaving ---------- */
function enterSuite(owner, layoutStr) {
  closeSheet();
  let L = myLayout(); Suite.owner = 'me';
  if (owner && owner !== 'me') { const d = decodeLayout(layoutStr); if (!d) { toast('That suite is not open right now'); return; } L = d; Suite.owner = owner; }
  const s = World.zones.suite.spawn;
  fadeTeleport(s[0], s[1], s[2], s[3], () => {
    showSuite(L); World.dyn = Suite.dyn;
    if (G.pendingRoomService && Suite.owner === 'me') { const id = G.pendingRoomService; G.pendingRoomService = null; setTimeout(() => { giveFood(id); toast('Your room service was waiting', FOOD[id].name); }, 600); }
    toast(Suite.owner === 'me' ? 'Your suite · Deck 12' : 'Visiting a suite', Suite.owner === 'me' ? 'Tap Decorate to make it yours. The balcony door is open.' : 'Say hi from the balcony.');
  });
}
function leaveSuiteState() {
  World.dyn = [];
  if (Suite.owner !== 'me') { Suite.owner = 'me'; showSuite(myLayout()); }
  Suite.music = false;
}
function suiteBarUpdate() {
  const bar = $('suiteBar'); if (!bar) return;
  const show = G.state === 'play' && Player.level === 'suite' && !Player.activity && Suite.owner === 'me';
  if (bar.hidden === !show) return; bar.hidden = !show;
}

/* ---------- decorate mode ---------- */
const Decor = { sel: -1, place: null, drag: false, pan: null, cam: { x: 24.7, z: 88.8 }, ray: null };
function floorHit(e) {
  if (!Decor.ray) Decor.ray = new T.Raycaster();
  const ndc = new T.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  Decor.ray.setFromCamera(ndc, G.camera);
  const p = new T.Vector3(); return Decor.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -(SUITE.y + 0.02)), p) ? p : null;
}
function pickDecor(e) {
  const ndc = new T.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  Decor.ray.setFromCamera(ndc, G.camera);
  const hits = Decor.ray.intersectObjects(Suite.meshes, true);
  for (const h of hits) { let o = h.object; while (o && o.userData.idx === undefined) o = o.parent; if (o) return o.userData.idx; }
  return -1;
}
const clampLocal = (lx, lz) => [clamp(lx, 0.35, 30.55 - SUITE.x0), clamp(lz, 0.35, SUITE.z1 - SUITE.z0 - 0.35)];
function startDecorate() {
  if (Player.level !== 'suite' || Suite.owner !== 'me') return;
  if (Food.held) dropFood();
  const L = myLayout(); Decor.sel = -1; Decor.place = null; Decor.cam = { x: 24.0, z: 88.8 };
  G.suiteCeil.visible = false;
  G.pointerHook = (type, e) => {
    if (type === 'down') {
      const p = floorHit(e); if (!p) return true;
      const idx = pickDecor(e);
      if (idx >= 0) { Decor.sel = idx; Decor.drag = true; Decor.place = null; renderDecorTray(); sfx('tick'); }
      else if (Decor.place) {
        if (L.items.length >= 24) { toast('Your suite is full', 'Remove something to add more (24 items max).'); return true; }
        const [lx, lz] = clampLocal(...suiteLocal(p.x, p.z)); L.items.push([Decor.place, lx, lz, 0]); Decor.sel = L.items.length - 1; Decor.place = null; Decor.drag = true;
        showSuite(L); renderDecorTray(); sfx('chip'); if (L.items.length >= 5) stamp('suite');
      } else { Decor.sel = -1; Decor.pan = { x: e.clientX, y: e.clientY, cx: Decor.cam.x, cz: Decor.cam.z, p }; renderDecorTray(); }
      return true;
    }
    if (type === 'move') {
      if (Decor.drag && Decor.sel >= 0) { const p = floorHit(e); if (p) { const [lx, lz] = clampLocal(...suiteLocal(p.x, p.z)); const it = L.items[Decor.sel]; it[1] = lx; it[2] = lz; const m = Suite.meshes[Decor.sel]; if (m) m.position.set(SUITE.x0 + lx, m.position.y, SUITE.z0 + lz); } }
      else if (Decor.pan) { const p = floorHit(e); if (p) { Decor.cam.x = clamp(Decor.cam.x - (p.x - Decor.pan.p.x) * 0.9, 20, 29.5); Decor.cam.z = clamp(Decor.cam.z - (p.z - Decor.pan.p.z) * 0.9, 85, 92.6); } }
      return true;
    }
    if (type === 'up') { if (Decor.drag) { Decor.drag = false; showSuite(L); saveLayout(); } Decor.pan = null; return true; }
    return false;
  };
  startActivity({
    exitable: true, active: false, bar: null,
    enter() { $('decorTray').hidden = false; $('hudBR').style.visibility = 'hidden'; renderDecorTray(); Player.char.setAnim('idle'); },
    update() { },
    camera() {
      const portrait = innerWidth < innerHeight, docked = innerWidth >= 820;
      G.camera.up.set(portrait ? 1 : 0, 0, portrait ? 0 : -1);
      const ox = docked ? 190 : 0, oy = docked ? 0 : Math.min(innerHeight * 0.4, 400) * 0.5;
      if (!G.camera.view || G.camera.view.offsetX !== ox || G.camera.view.offsetY !== oy) G.camera.setViewOffset(innerWidth, innerHeight, ox, oy, innerWidth, innerHeight);
      const W = innerWidth, H = innerHeight, frac = docked ? 1 : 1 - Math.min(H * 0.4, 400) / H, aw = docked ? Math.max(200, W - 380) : W;
      const vs = Math.max((portrait ? 11.6 : 11.2) / Math.max(0.45, frac), (portrait ? 11.2 : 11.6) / (aw / H)), FOV = 40, h = vs / 2 / Math.tan(FOV * Math.PI / 360);
      return { pos: V3(Decor.cam.x, SUITE.y + h, Decor.cam.z), look: V3(Decor.cam.x + 0.001, SUITE.y, Decor.cam.z), k: 10, fov: FOV, clipY: SUITE.top - 0.02 };
    },
    exit() { G.pointerHook = null; G.camera.up.set(0, 1, 0); G.camera.clearViewOffset(); G.suiteCeil.visible = true; $('decorTray').hidden = true; $('hudBR').style.visibility = ''; saveLayout(); Cam.pos.copy(Player.pos).add(V3(-3, 2, 0)); }
  });
}
let decorTab = 'items';
function renderDecorTray() {
  const tr = $('decorTray'); if (!tr) return; const L = myLayout();
  const sw = (key, list) => `<div class="swatches">${list.map((c, i) => `<button class="sw" data-k="${key}" data-v="${i}" style="background:${Array.isArray(c) ? (c[2] === 'teak' ? '#8a5a34' : c[2] === 'terrazzo' ? '#dfe5ea' : c[2] === 'bigTile' ? '#f4f6f8' : c[1]) : c}" aria-pressed="${L[key] === i}" aria-label="${Array.isArray(c) ? c[0] : 'Color ' + (i + 1)}"></button>`).join('')}</div>`;
  const sel = Decor.sel >= 0 ? L.items[Decor.sel] : null;
  tr.innerHTML = `<div class="tabs"><button class="tab" aria-selected="${decorTab === 'items'}" data-t="items">Furniture</button><button class="tab" aria-selected="${decorTab === 'colors'}" data-t="colors">Colors</button><span class="dt-count">${L.items.length}/24</span></div>
    <div class="dt-body">${decorTab === 'items' ? `<div class="chips">${DECOR.map(d => `<button class="chip" data-add="${d.id}" aria-pressed="${Decor.place === d.id}">${d.name}</button>`).join('')}</div>` :
      `<div class="opt-group"><h4>Walls</h4>${sw('w', WALLS)}</div><div class="opt-group"><h4>Floor</h4>${sw('f', FLOORS)}</div><div class="opt-group"><h4>Bedding</h4>${sw('b', BEDS)}</div><div class="opt-group"><h4>Sofa and cushions</h4>${sw('a', ACCENTS)}</div>`}</div>
    <div class="dt-foot"><span class="dt-hint">${Decor.place ? 'Tap the floor to place the ' + DECOR.find(d => d.id === Decor.place).name.toLowerCase() + '.' : sel ? DECOR.find(d => d.id === sel[0]).name + ' selected. Drag to move.' : 'Pick something to add, or drag furniture to move it.'}</span>
    ${sel ? '<button class="btn btn-glass" id="dtRot">Rotate</button><button class="btn btn-glass" id="dtDel">Remove</button>' : ''}<button class="btn btn-primary" id="dtDone">Done</button></div>`;
  tr.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { decorTab = b.dataset.t; renderDecorTray(); });
  tr.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { Decor.place = Decor.place === b.dataset.add ? null : b.dataset.add; Decor.sel = -1; renderDecorTray(); sfx('tick'); });
  tr.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { L[b.dataset.k] = +b.dataset.v; showSuite(L); saveLayout(); renderDecorTray(); sfx('tick'); });
  const on = (id, f) => { const e = $(id); if (e) e.onclick = f; };
  on('dtRot', () => { const it = L.items[Decor.sel]; it[3] = (it[3] + 1) % 8; showSuite(L); saveLayout(); sfx('tick'); });
  on('dtDel', () => { L.items.splice(Decor.sel, 1); Decor.sel = -1; showSuite(L); saveLayout(); renderDecorTray(); sfx('tick'); });
  on('dtDone', () => { sfx('tick'); endActivity(); });
}
function saveLayout() { saveProfile(); if (typeof netCabinChanged === 'function') netCabinChanged(); }
function updateSuite(dt) {
  suiteBarUpdate();
  if (!G.suiteDecor || !G.suiteGroup.visible) return;
  for (const g of Suite.meshes) g.traverse(o => { if (o.userData.spin) o.rotation.y += dt * 0.8; if (o.userData.fish !== undefined) { o.position.x = -0.35 + ((G.time * 0.12 + o.userData.fish * 0.17) % 1) * 0.7; } });
}

/* ---------- music sheet (DJ requests, jukebox, suite TV) ---------- */
function openMusic(where) {
  const rows = SONGS.map((s, i) => `<button class="drink" data-i="${i}"><img class="glass" src="${s.art}" alt=""><span><b>${esc(s.title)}</b><small>${esc(s.artist)} · ${Math.floor(s.dur / 60)}:${String(Math.round(s.dur % 60)).padStart(2, '0')}</small></span><em>${Radio.cur === s && Radio.playing ? 'Playing' : 'Play'}</em></button>`).join('');
  sheet(where === 'dj' ? 'Request a song' : 'Tileo Radio', where === 'dj' ? 'The DJ will spin it next' : where === 'suite' ? 'Plays through your suite speakers' : 'Your songs, aboard the ship', (Radio.failed ? '<p class="kbd">The song files could not load here, so the ship is playing its built-in mixes.</p>' : '') + rows + `<p class="kbd">Songs by djtileo. Ship radio can be switched off in Settings.</p>`, body => body.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
    radioPlay(+b.dataset.i); if (where === 'suite') Suite.music = true; closeSheet(); toast('Now playing', SONGS[+b.dataset.i].title);
  }));
}

/* ---- 70_events.js ---- */
/* ================= clock, daily program, party effects, passport stamps ================= */
const Clock = { min: 16 * 60 + 30, day: 1, rate: 1 };
const EVENTS = [
  { id: 'yoga', name: 'Sunrise Yoga', start: 6 * 60 + 40, end: 7 * 60 + 50, zone: 'bow', where: 'Bow Lookout · Deck 6', desc: 'Stretch on the helipad while the sun climbs out of the wake.', music: 'chill', fx: 'yoga' },
  { id: 'races', name: 'Slide Races', start: 9 * 60, end: 10 * 60 + 30, zone: 'waterpark', where: 'Splash Summit · Deck 15', desc: 'Riptide, Blue Abyss and Free Fall, timed and loud.', music: 'tropical', fx: 'races' },
  { id: 'bellyflop', name: 'Belly Flop Contest', start: 11 * 60, end: 12 * 60 + 30, zone: 'pool', where: 'Infinity Pool · Deck 15', desc: 'Big splashes, generous judges.', music: 'tropical', fx: 'bellyflop' },
  { id: 'poolparty', name: 'Pool Party', start: 13 * 60, end: 15 * 60, zone: 'pool', where: 'Pool Deck · Deck 15', desc: 'DJ set by the Infinity Pool, spinning Tileo Radio.', music: 'radio', fx: 'party' },
  { id: 'foam', name: 'Foam Party', start: 15 * 60 + 15, end: 16 * 60 + 40, zone: 'pool', where: 'Pool Deck · Deck 15', desc: 'Foam cannons fire on the beat by the DJ booth.', music: 'radio', fx: 'foam' },
  { id: 'sailaway', name: 'Sail-Away Party', start: 17 * 60, end: 18 * 60 + 30, zone: 'pool', where: 'Pool Deck · Deck 15', desc: 'Ship horn, confetti and the first toast of the voyage.', music: 'radio', fx: 'confetti' },
  { id: 'sunset', name: 'Sunset Toast', start: 18 * 60 + 40, end: 19 * 60 + 40, zone: 'sundeck', where: 'Sun Deck · Deck 17', desc: 'Raise a glass as the sun drops ahead of the bow.', music: 'chill', fx: 'toast' },
  { id: 'trivia', name: 'Trivia Night', start: 19 * 60 + 45, end: 20 * 60 + 45, zone: 'dome', where: 'Skydome · Deck 15', desc: 'Eight questions on the big screen. Teams welcome.', music: 'chill', fx: 'trivia' },
  { id: 'captain', name: "Captain's Welcome", start: 20 * 60 + 50, end: 21 * 60 + 30, zone: 'dome', where: 'Skydome · Deck 15', desc: 'Meet the Captain under the lit dome.', music: 'chill', fx: 'captain' },
  { id: 'glow', name: 'Glow Party', start: 21 * 60 + 30, end: 23 * 60 + 56, zone: 'dome', where: 'Skydome · Deck 15', desc: 'Lasers, the LED floor and every tile of the dome lit up.', music: 'radio', fx: 'glow' },
  { id: 'fireworks', name: 'Midnight Fireworks', start: 23 * 60 + 57, end: 1440 + 30, zone: 'waterpark', where: 'Stern · Splash Summit', desc: 'Fireworks over the wake. Best seen from the stern rail.', music: 'radio', fx: 'fireworks' },
  { id: 'silent', name: 'Silent Disco', start: 40, end: 2 * 60 + 40, zone: 'garden', where: 'Garden Promenade · Deck 8', desc: 'Headphones on. The garden dances in silence.', music: 'silent', fx: 'silent' },
];
const STAMPS = [
  { id: 'aboard', name: 'Welcome Aboard', hint: 'Board the Tileo Infinity', icon: 'ship' },
  { id: 'swim', name: 'Making Waves', hint: 'Swim in any pool', icon: 'wave' },
  { id: 'slide', name: 'Splash Summit', hint: 'Ride any waterslide', icon: 'slide' },
  { id: 'allslides', name: 'Slide Collector', hint: 'Ride all three slides', icon: 'star' },
  { id: 'zip', name: 'Canyon Zip', hint: 'Ride the zipline across the canyon', icon: 'zip' },
  { id: 'lounge', name: 'Sun Seeker', hint: 'Relax on a lounger', icon: 'sun' },
  { id: 'bar', name: 'Bar Hopper', hint: 'Order a drink at any bar', icon: 'glass' },
  { id: 'treat', name: 'Sweet Tooth', hint: 'Grab gelato, coffee or pizza in the Garden', icon: 'cone' },
  { id: 'dance', name: 'Party Animal', hint: 'Hit a 12-beat dance combo', icon: 'music' },
  { id: 'hoops', name: 'Hoop Star', hint: 'Sink 3 of 5 free throws', icon: 'ball' },
  { id: 'overwater', name: 'Overwater Soak', hint: 'Sit in a whirlpool hanging over the ocean', icon: 'tub' },
  { id: 'bow', name: 'Bow Lookout', hint: 'Strike a pose at the very front of the ship', icon: 'flag' },
  { id: 'photo', name: 'Shutterbug', hint: 'Take a photo', icon: 'camera' },
  { id: 'captain', name: "Captain's Handshake", hint: "Meet the Captain at the Welcome party", icon: 'cap' },
  { id: 'fireworks', name: 'Night Owl', hint: 'Watch the Midnight Fireworks', icon: 'firework' },
  { id: 'explorer', name: 'Explorer', hint: 'Visit all seven areas of the ship', icon: 'compass' },
  { id: 'foodie', name: 'Foodie', hint: 'Finish five different foods or drinks', icon: 'fork' },
  { id: 'suite', name: 'Home at Sea', hint: 'Decorate your suite with five pieces', icon: 'bed' },
  { id: 'casino', name: 'Lucky Tile', hint: 'Win a round at any casino game', icon: 'dice' },
  { id: 'surf', name: 'Wave Rider', hint: 'Score 1,000 on the surf simulator', icon: 'wave' },
  { id: 'golf', name: 'Tileo Links', hint: 'Finish mini golf at or under par', icon: 'flag' },
  { id: 'trivia', name: 'Quiz Captain', hint: 'Get six of eight trivia questions right', icon: 'star' },
  { id: 'ashore', name: 'Shore Leave', hint: 'Go ashore at a port of call', icon: 'anchor' },
  { id: 'islands', name: 'Island Hopper', hint: 'Visit all three ports', icon: 'compass' },
  { id: 'shipmates', name: 'Shipmates', hint: 'Chat with another passenger online', icon: 'chat' },
];
function isLive(ev, m = Clock.min) { if (ev.end <= 1440) return m >= ev.start && m < ev.end; return m >= ev.start || m < ev.end - 1440; }
function liveEvent() { return EVENTS.find(e => isLive(e)); }
function nextEvent() {
  let best = null, bd = 1e9;
  for (const e of EVENTS) { let d = e.start - Clock.min; if (d <= 0) d += 1440; if (d < bd) { bd = d; best = e; } }
  return best;
}
function minutesUntil(e) { let d = e.start - Clock.min; if (d < 0) d += 1440; return d; }
function skipToNextEvent() {
  const e = nextEvent(); if (!e) return;
  const f = $('fade'); f.classList.add('on');
  setTimeout(() => { setClock(e.start - 0.5); setTimeout(() => f.classList.remove('on'), 150); toast('Time flies at sea', 'It is ' + fmtTime(e.start) + ' · ' + e.name); }, 380);
}
function setClock(m) {
  if (m < Clock.min - 1) Clock.day++;
  Clock.min = ((m % 1440) + 1440) % 1440;
}
const EVENT_AREAS = {
  pool: [rectPts(8, -88, 22, -79), rectPts(-13, -91, 7, -80)], dome: [rectPts(-6, -112, 6, -102)], garden: [rectPts(-7, 28, 7, 42)],
  bow: [ellipsePts(0, -163, 6.5, 6.5, 24)], sundeck: [rectPts(9, 67, 19, 91)], waterpark: [rectPts(-6, 98, 28, 106), rectPts(-14, 124, 20, 147)]
};
function eventArea(ev) { const a = EVENT_AREAS[ev.zone]; return a[Math.floor(Math.random() * a.length)]; }
function eventFocus(ev) {
  return ({ pool: V3(19.5, 52, -90), dome: V3(0, 52, -118), garden: V3(0, 26, 44.6), bow: V3(0, 20, -180), sundeck: V3(15, 55.6, 120), waterpark: V3(0, 52, 260) })[ev.zone];
}
let liveIds = new Set();
function updateEvents(dt) {
  const before = Clock.min;
  Clock.min += dt * Clock.rate;
  if (Clock.min >= 1440) { Clock.min -= 1440; Clock.day++; }
  const now = new Set(EVENTS.filter(e => isLive(e)).map(e => e.id));
  for (const id of now) if (!liveIds.has(id)) onEventStart(EVENTS.find(e => e.id === id));
  for (const id of liveIds) if (!now.has(id)) onEventEnd(EVENTS.find(e => e.id === id));
  liveIds = now;
  updateFX(dt); updatePort(dt); updateFoodMeters(dt); updateTrivia(dt); updateScreen(dt); updateVenues(dt); updateSuite(dt);
  // presence-based stamps
  const ev = liveEvent();
  if (ev && G.state === 'play') {
    if (ev.id === 'fireworks' && Player.pos.y > 40) { G.fwWatch = (G.fwWatch || 0) + dt; if (G.fwWatch > 8) stamp('fireworks'); }
  }
}
function onEventStart(ev) {
  if (G.state === 'play' || G.state === 'photo') { toast('Starting now: ' + ev.name, ev.where); sfx('chime'); }
  for (const n of NPCS) { if (Math.random() < 0.42 && n.state !== 'ride' && n.state !== 'climb' && n.level !== 'port') { n.event = ev; if (!n.visibleToPlayer() || n.state === 'act' || n.state === 'idle') n.choose(); } }
  if (ev.fx === 'confetti') { sfx('horn'); confettiBurst(V3(0, 64, -72), 260); confettiBurst(V3(19, 62, -84), 160); Cam.shake = 0.6; }
  if (ev.fx === 'fireworks') { sfx('horn'); }
  if (ev.fx === 'captain') { const c = G.captain; c.rig.root.visible = true; c.rig.root.position.set(2.4, 52.08, -112.6); c.rig.root.rotation.y = 0.2; c.setAnim('wave'); addCaptainHotspot(true); }
}
function onEventEnd(ev) {
  for (const n of NPCS) if (n.event === ev) { n.event = null; if (n.state === 'act') n.timer = Math.min(n.timer, mrand(2, 15)); }
  if (ev.fx === 'captain') { G.captain.rig.root.visible = false; addCaptainHotspot(false); }
  if (ev.fx === 'foam') FX.foamFade = true;
}
function addCaptainHotspot(on) {
  World.hotspots = World.hotspots.filter(h => h.id !== 'captain');
  if (on) World.hotspots.push({ id: 'captain', pos: V3(2.4, 52, -111.2), r: 2.4, label: 'Meet the Captain', kind: 'captain', data: {} });
}

/* ---------------- FX ---------------- */
const FX = { conf: null, foam: null, fw: null, splash: null, lasers: null, foamFade: false, bucketT: 20 };
function initFX() {
  // confetti
  { const n = 600, g = new T.PlaneGeometry(0.14, 0.09); const m = new T.InstancedMesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide }), n);
    m.frustumCulled = false; const zero = new T.Matrix4().makeScale(0, 0, 0); const cols = ['#ff6a55', '#2fd3c6', '#5aa9ff', '#ffc95c', '#f4f6f8', '#ff8fab'];
    for (let i = 0; i < n; i++) { m.setMatrixAt(i, zero); m.setColorAt(i, lin(cols[i % cols.length])); }
    m.instanceColor.needsUpdate = true; G.scene.add(m); FX.conf = { m, n, p: [], i: 0 }; }
  // foam
  { const n = 520, g = new T.SphereGeometry(1, 12, 9); const m = new T.InstancedMesh(g, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, emissive: lin('#cfe9f5'), emissiveIntensity: 0.12 }), n);
    m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; const zero = new T.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < n; i++) m.setMatrixAt(i, zero);
    G.scene.add(m); FX.foam = { m, n, p: [], i: 0, emitT: 0 }; }
  // fireworks + splash points
  const pointsSys = (n, size, additive) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('size', new T.BufferAttribute(sz, 1));
    const mat = new T.ShaderMaterial({
      uniforms: { uScale: { value: innerHeight * 0.5 }, uMap: { value: TEX.soft } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale/max(-mv.z,1.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(vC*t.a,${additive ? 't.a' : 't.a*0.9'}); }`,
      transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, fog: false
    });
    const pts = new T.Points(g, mat); pts.frustumCulled = false; G.scene.add(pts);
    return { pts, n, pos, col, sz, life: new Float32Array(n), max: new Float32Array(n), vel: new Float32Array(n * 3), base: new Float32Array(n * 3), drag: new Float32Array(n), grav: new Float32Array(n), i: 0 };
  };
  FX.fw = pointsSys(5200, 1.6, true); FX.fw.rockets = []; FX.fw.t = 0;
  FX.splash = pointsSys(1200, 0.5, false);
  // dome lasers
  const lg = new T.Group(); G.scene.add(lg); FX.lasers = lg; lg.visible = false;
  const lm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const beam = new T.Mesh(new T.CylinderGeometry(0.025, 0.09, 38, 6, 1, true), lm.clone());
    beam.geometry.translate(0, 19, 0); const piv = new T.Object3D(); piv.position.set(-4.5 + i, 58.3, -119.4); piv.add(beam); lg.add(piv);
    piv.userData.hue = i / 10;
  }
}
function confettiBurst(pos, n) {
  const C = FX.conf;
  for (let k = 0; k < n; k++) {
    const i = C.i = (C.i + 1) % C.n;
    C.p[i] = { x: pos.x + mrand(-6, 6), y: pos.y + mrand(-2, 3), z: pos.z + mrand(-6, 6), vx: mrand(-2, 2), vy: mrand(2, 7), vz: mrand(-2, 2), rx: mrand(0, 6), ry: mrand(0, 6), s: mrand(4, 9), life: mrand(6, 10) };
  }
}
function fxSplash(x, y, z, size = 1) {
  const S = FX.splash; const n = Math.round(60 * size);
  for (let k = 0; k < n; k++) {
    const i = S.i = (S.i + 1) % S.n;
    S.pos[i * 3] = x + mrand(-0.4, 0.4) * size; S.pos[i * 3 + 1] = y + 0.1; S.pos[i * 3 + 2] = z + mrand(-0.4, 0.4) * size;
    const a = mrand(0, TAU), sp = mrand(0.5, 3) * size;
    S.vel[i * 3] = Math.cos(a) * sp; S.vel[i * 3 + 1] = mrand(2.5, 6) * Math.sqrt(size); S.vel[i * 3 + 2] = Math.sin(a) * sp;
    S.life[i] = S.max[i] = mrand(0.6, 1.3); S.sz[i] = mrand(0.18, 0.4) * Math.sqrt(size); S.grav[i] = 9.8; S.drag[i] = 0.3;
    S.col[i * 3] = 0.9; S.col[i * 3 + 1] = 0.97; S.col[i * 3 + 2] = 1.0;
  }
}
const FW_COLS = [[1, 0.42, 0.33], [0.18, 0.83, 0.78], [0.35, 0.66, 1], [1, 0.79, 0.36], [1, 0.56, 0.67], [0.85, 0.9, 1]];
function launchFirework() {
  const F = FX.fw;
  F.rockets.push({ p: V3(mrand(-40, 40), 30, mrand(200, 320)), v: V3(mrand(-3, 3), mrand(46, 58), mrand(-6, 2)), t: mrand(1.6, 2.2), col: mpick(FW_COLS), col2: mpick(FW_COLS), kind: Math.floor(Math.random() * 3) });
}
function fwEmit(x, y, z, vx, vy, vz, life, size, col, grav = 6, drag = 0.9) {
  const F = FX.fw; const i = F.i = (F.i + 1) % F.n;
  F.pos[i * 3] = x; F.pos[i * 3 + 1] = y; F.pos[i * 3 + 2] = z; F.vel[i * 3] = vx; F.vel[i * 3 + 1] = vy; F.vel[i * 3 + 2] = vz;
  F.life[i] = F.max[i] = life; F.sz[i] = size; F.grav[i] = grav; F.drag[i] = drag;
  F.base[i * 3] = col[0] * 3; F.base[i * 3 + 1] = col[1] * 3; F.base[i * 3 + 2] = col[2] * 3;
}
function updatePoints(S, dt, fade) {
  for (let i = 0; i < S.n; i++) {
    if (S.life[i] <= 0) { if (S.sz[i] !== 0) { S.sz[i] = 0; } continue; }
    S.life[i] -= dt;
    const d = Math.exp(-S.drag[i] * dt);
    S.vel[i * 3] *= d; S.vel[i * 3 + 1] = S.vel[i * 3 + 1] * d - S.grav[i] * dt; S.vel[i * 3 + 2] *= d;
    S.pos[i * 3] += S.vel[i * 3] * dt; S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt; S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
    if (fade) { const k = clamp(S.life[i] / S.max[i], 0, 1); const tw = 0.75 + 0.25 * Math.sin(G.time * 40 + i); S.col[i * 3] = S.base[i * 3] * k * tw; S.col[i * 3 + 1] = S.base[i * 3 + 1] * k * tw; S.col[i * 3 + 2] = S.base[i * 3 + 2] * k * tw; }
    if (S.life[i] <= 0) S.sz[i] = 0;
  }
  S.pts.geometry.attributes.position.needsUpdate = true; S.pts.geometry.attributes.color.needsUpdate = true; S.pts.geometry.attributes.size.needsUpdate = true;
  S.pts.material.uniforms.uScale.value = innerHeight * G.renderer.getPixelRatio() * 0.6;
}
const _cm = new T.Matrix4(), _cq = new T.Quaternion(), _ce = new T.Euler(), _cs = new T.Vector3(), _cp = new T.Vector3();
function updateFX(dt) {
  const t = G.time, ev = liveEvent(), night = Env.night;
  const party = ev && (ev.fx === 'glow' || ev.fx === 'foam' || ev.fx === 'party' || ev.fx === 'confetti' || ev.fx === 'fireworks') ? 1 : 0;
  G.party = damp(G.party || 0, party, 1.5, dt);
  // neon + dome
  if (G.neonMat) { G.neonMat.uniforms.uTime.value = t; G.neonMat.uniforms.uOn.value = smooth(0.2, 0.8, night); G.neonMat.uniforms.uParty.value = G.party * night; }
  const glow = ev && ev.fx === 'glow' ? 1 : 0;
  G.domeU.uTime.value = t; G.domeU.uLed.value = smooth(0.15, 0.7, night) * (0.9 + glow * 0.9); G.domeU.uParty.value = glow;
  G.bloomBoost = 1 + glow * 0.35;
  // LED floor
  const L = G.ledFloor; const b = Audio.beat(); const col = _c1;
  const lvl = 0.12 + night * 0.9 + glow * 0.6;
  for (let i = 0; i < L.nx; i++) for (let j = 0; j < L.nz; j++) {
    const k = i * L.nz + j; const x = i - 5.5, z = j - 4.5, r = Math.hypot(x, z);
    let h, v;
    const mode = Math.floor(b / 16) % 3;
    if (mode === 0) { h = (r * 0.08 - b * 0.12) % 1; v = 0.5 + 0.5 * Math.sin(r * 1.2 - b * Math.PI); }
    else if (mode === 1) { h = ((i + j) * 0.04 + b * 0.05) % 1; v = ((i + Math.floor(b)) % 4 === 0 || (j + Math.floor(b * 2)) % 5 === 0) ? 1 : 0.15; }
    else { h = (Math.atan2(z, x) / TAU + b * 0.06 + 1) % 1; v = Math.pow(0.5 + 0.5 * Math.sin(b * Math.PI * 2 - r), 2); }
    col.setHSL((h + 1) % 1, 0.85, 0.12 + v * 0.42).convertSRGBToLinear().multiplyScalar(lvl * 2.2);
    L.mesh.setColorAt(k, col);
  }
  L.mesh.instanceColor.needsUpdate = true;
  // lights
  const P = G.points;
  P[0].intensity = P[1].intensity = night * (0.9 + glow * 1.8);
  P[0].color.setHSL((t * 0.07) % 1, 0.8, 0.55).convertSRGBToLinear(); P[1].color.setHSL((t * 0.07 + 0.5) % 1, 0.8, 0.55).convertSRGBToLinear();
  P[0].position.set(-6 + Math.sin(t * 0.8) * 4, 60, -110); P[1].position.set(6 - Math.sin(t * 0.8) * 4, 60, -110);
  P[2].intensity = night * 0.9; P[2].color.set('#ffd2a1').convertSRGBToLinear(); P[2].position.set(0, 58, -72);
  P[3].intensity = night * 1.1; P[3].color.set('#ffcf96').convertSRGBToLinear(); P[3].position.set(0, 32, 10);
  G.indoor = 0;
  if (Player.level === 'casino' && G.state !== 'boarding') {
    G.indoor = 1;
    const cp = [[0, 25.0, 75], [0, 25.0, 90], [-8, 25.0, 82.5], [8, 25.0, 82.5]], cc = ['#ffc58a', '#ffc58a', '#ff7a8a', '#7ae0ff'];
    P.forEach((l, i) => { l.position.set(...cp[i]); l.color.set(cc[i]).convertSRGBToLinear(); l.intensity = i < 2 ? 2.6 : 1.8; l.distance = 34; });
  } else if (Player.level === 'suite' && G.state !== 'boarding') {
    G.indoor = 0.6;
    P[0].position.set(21.5, 40.2, 88.8); P[0].color.set('#ffd9a8').convertSRGBToLinear(); P[0].intensity = 1.1 + night * 0.6;
    P[1].position.set(25.5, 40.2, 88.8); P[1].color.set('#ffe6c4').convertSRGBToLinear(); P[1].intensity = 0.6 + night * 0.5;
    P[2].intensity = 0; P[3].intensity = 0;
  } else if (G.port) {
    const b = G.port.feat.bar; P.forEach(l => l.intensity = 0);
    if (b) { P[0].position.set(b.x, b.y + 3.2, b.z); P[0].color.set('#ffcf96').convertSRGBToLinear(); P[0].intensity = night * 2.2; }
    if (G.port.feat.plaza) { const p = G.port.feat.plaza; P[1].position.set(p.x, 7, p.z); P[1].color.set('#ffd9a8').convertSRGBToLinear(); P[1].intensity = night * 2.0; }
  }
  // lasers
  FX.lasers.visible = glow > 0 && night > 0.3;
  if (FX.lasers.visible) FX.lasers.children.forEach((p, i) => {
    const a = Math.sin(t * 1.3 + i * 0.7) * 0.9, bb = -0.9 + Math.sin(t * 0.9 + i) * 0.35;
    p.rotation.set(bb, 0, a); p.children[0].material.color.setHSL((p.userData.hue + t * 0.1) % 1, 1, 0.55);
    p.children[0].material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(b * Math.PI));
  });
  // confetti
  const C = FX.conf; const zero = _cm.makeScale(0, 0, 0);
  for (let i = 0; i < C.n; i++) {
    const p = C.p[i]; if (!p) continue;
    if (p.life <= 0) { C.m.setMatrixAt(i, zero); C.p[i] = null; continue; }
    p.life -= dt; p.vy = Math.max(p.vy - 9.8 * dt, -1.6); p.vx *= 0.98; p.vz *= 0.98;
    p.x += (p.vx + Math.sin(t * 3 + i) * 0.6) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(t * 2.6 + i) * 0.6) * dt;
    const gy = 52.02; if (p.y < gy && Math.abs(p.x) < 31 && p.z > -92 && p.z < 150) { p.y = gy; p.vy = 0; p.vx = 0; p.vz = 0; p.landed = true; }
    if (!p.landed) { p.rx += dt * p.s; p.ry += dt * p.s * 0.7; }
    _cp.set(p.x, p.y, p.z); _cq.setFromEuler(_ce.set(p.landed ? -Math.PI / 2 : p.rx, p.ry, 0)); _cs.setScalar(p.life < 1 ? p.life : 1);
    C.m.setMatrixAt(i, _cm.compose(_cp, _cq, _cs));
  }
  C.m.instanceMatrix.needsUpdate = true;
  // foam
  const F = FX.foam; const foamOn = ev && ev.fx === 'foam';
  if (foamOn) { FX.foamFade = false; F.emitT -= dt; if (F.emitT <= 0) { F.emitT = 0.06; for (const cn of World.foamCannons) { const i = F.i = (F.i + 1) % F.n; F.p[i] = { x: cn.x, y: cn.y, z: cn.z, vx: mrand(-5, 2), vy: mrand(2, 5), vz: mrand(4, 10), s: 0.2, ts: mrand(0.45, 1.05), air: true, life: mrand(90, 180) }; } } }
  for (let i = 0; i < F.n; i++) {
    const p = F.p[i]; if (!p) continue;
    if (FX.foamFade) p.life = Math.min(p.life, mrand(2, 12));
    p.life -= dt;
    if (p.life <= 0) { p.s = damp(p.s, 0, 2, dt); if (p.s < 0.02) { F.m.setMatrixAt(i, zero); F.p[i] = null; continue; } }
    else p.s = damp(p.s, p.ts, 1.2, dt);
    if (p.air) { p.vy -= 7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 52.2 + p.s * 0.4) { p.y = 52.2 + p.s * 0.35; p.air = false; } }
    const sz = p.air ? Math.min(p.s, 0.3) : p.s;
    _cp.set(p.x, p.y + Math.sin(t * 2 + i) * 0.03, p.z); _cs.set(sz, sz * 0.75, sz);
    F.m.setMatrixAt(i, _cm.compose(_cp, _cq.identity(), _cs));
  }
  F.m.instanceMatrix.needsUpdate = true;
  // fireworks
  const W = FX.fw;
  if (ev && ev.fx === 'fireworks') { W.t -= dt; if (W.t <= 0) { W.t = mrand(0.35, 1.2); launchFirework(); if (Math.random() < 0.25) launchFirework(); } }
  for (let k = W.rockets.length - 1; k >= 0; k--) {
    const r = W.rockets[k]; r.t -= dt; r.v.y -= 9.8 * dt; r.p.addScaledVector(r.v, dt);
    fwEmit(r.p.x, r.p.y, r.p.z, mrand(-0.5, 0.5), mrand(-1, 0), mrand(-0.5, 0.5), 0.6, 0.9, [1, 0.8, 0.5], 2, 2);
    if (r.t <= 0) {
      W.rockets.splice(k, 1);
      const n = r.kind === 2 ? 260 : 190, sp = r.kind === 1 ? 26 : 20;
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - u * u); let m = r.kind === 1 ? 1 : (0.75 + Math.random() * 0.25);
        const c = r.kind === 2 && i % 2 ? r.col2 : r.col;
        fwEmit(r.p.x, r.p.y, r.p.z, s * Math.cos(a) * sp * m, u * sp * m, s * Math.sin(a) * sp * m, mrand(1.6, 2.6), mrand(1.2, 2.0), c, 5, 1.1);
      }
      const dist = r.p.distanceTo(G.camera.position); setTimeout(() => sfx('boom', clamp(260 / dist, 0.2, 1)), dist / 343 * 1000);
    }
  }
  updatePoints(W, dt, true); updatePoints(FX.splash, dt, false);
  // waterfall, slide film, sculpture, flag, bucket
  if (G.waterfallMat) G.waterfallMat.map.offset.y = (G.waterfallMat.map.offset.y + dt * 0.9) % 1;
  MAT.slideFilm.map.offset.y = (MAT.slideFilm.map.offset.y - dt * 1.6) % 1;
  if (G.sculpture) G.sculpture.rotation.y = t * 0.18;
  if (G.flag) { const pa = G.flag.geometry.attributes.position, base = G.flag.userData.base; for (let i = 0; i < pa.count; i++) { const x = base[i * 3]; pa.setZ(i, Math.sin(x * 2.4 - t * 7) * 0.18 * (x / 2.4) + Math.sin(x * 4 + t * 5) * 0.04 * x / 2.4); } pa.needsUpdate = true; G.flag.geometry.computeVertexNormals(); }
  FX.bucketT -= dt;
  if (G.bucket) {
    const bk = G.bucket;
    if (FX.bucketT < 0) { const k = -FX.bucketT; bk.rotation.z = k < 1 ? smooth(0, 1, k) * 2.1 : k < 2.5 ? 2.1 : 2.1 * (1 - smooth(2.5, 4, k)); if (k > 0.8 && k < 2.2 && Math.random() < 0.7) fxSplash(bk.position.x + mrand(-1.5, 1.5) + 1.2, 52.3, bk.position.z + mrand(-1.2, 1.2), 0.6); if (k > 4) FX.bucketT = mrand(25, 40); if (Math.abs(k - 0.9) < dt) sfx('splash', 0.6); }
    bk.userData.water.visible = FX.bucketT > 0;
  }
  // belly flops + slide races ambience
  if (ev && ev.fx === 'bellyflop' && Math.random() < dt * 0.35) { const x = mrand(-7, 7), z = mrand(-76, -66); fxSplash(x, 51.75, z, 1.6); sfx('splash', 0.5); }
  for (const m of G.poolMats) { m.uniforms.uTime.value = t; m.uniforms.uNight.value = night; }
}

/* ---------------- passport ---------------- */
function stamp(id) {
  const pr = G.profile; if (!pr || pr.stamps.includes(id)) return;
  pr.stamps.push(id); saveProfile();
  const s = STAMPS.find(s => s.id === id);
  toast('Passport stamp: ' + s.name, s.hint, true); sfx('stamp');
  updateBadge();
  if (pr.stamps.length === STAMPS.length) setTimeout(() => toast('Every stamp collected', 'You have done it all on the Tileo Infinity.', true), 1500);
}
function trackVisit() {
  const id = areaId(Player.pos); const k = id === 'sun' ? 'aft' : id === 'tower' ? 'waterpark' : id;
  const pr = G.profile; if (!pr) return;
  if (!pr.visited.includes(k)) { pr.visited.push(k); saveProfile(); if (['bow', 'garden', 'dome', 'pool', 'canyon', 'aft', 'waterpark'].every(a => pr.visited.includes(a))) stamp('explorer'); }
}

/* ---- 80_audio.js ---- */
/* ================= audio: procedural party music, ambience, sound effects ================= */
const Audio = {
  ctx: null, started: false, bpm: 112, t0: 0, step: 0, nextT: 0, style: 'tropical', want: 'tropical', musicVol: 0.7, sfxVol: 0.9,
  beat() { if (this.style === 'radio' && Radio.el && Radio.cur) return (Radio.el.currentTime - Radio.cur.phase) * Radio.cur.bpm / 60; if (this.ctx && this.started) return (this.ctx.currentTime - this.t0) * this.bpm / 60; return G.time * this.bpm / 60; },
  whoosh(v) { if (!this.ctx || !this.wh) return; this.wh.gain.setTargetAtTime(v * 0.35 * this.sfxVol, this.ctx.currentTime, 0.08); this.whF.frequency.setTargetAtTime(500 + v * 1400, this.ctx.currentTime, 0.1); }
};
const STYLES = { tropical: 112, house: 124, chill: 94, silent: 124 };
const SONGS = [
  { id: 'vacay', title: 'On My Vacay Lucky', artist: 'djtileo', src: 'music/vacay.mp3', art: 'music/vacay.jpg', bpm: 134.29, phase: 0.43, dur: 202.3 },
  { id: 'lastnite', title: "Last Nite We Don't Remember (Instrumental)", artist: 'djtileo', src: 'music/lastnite.mp3', art: 'music/lastnite.jpg', bpm: 140.0, phase: 0.383, dur: 85.0 },
  { id: 'paradise', title: 'Paradise and Freedom', artist: 'djtileo', src: 'music/paradise.mp3', art: 'music/paradise.jpg', bpm: 128.08, phase: 0.21, dur: 217.6 },
];
const Radio = { el: null, src: null, gain: null, idx: 0, cur: null, playing: false, failed: false, enabled: true, shown: '' };
function radioUsable() { return !!(Radio.el && !Radio.failed && Radio.enabled); }
function radioInit() {
  if (Radio.el || !Audio.ctx) return;
  try {
    const el = document.createElement('audio'); el.preload = 'auto'; el.setAttribute('playsinline', '');
    try { if (new URL(SONGS[0].src, location.href).origin !== location.origin) el.crossOrigin = 'anonymous'; } catch (e) { }
    Radio.el = el;
    el.addEventListener('ended', () => radioPlay((Radio.idx + 1) % SONGS.length));
    el.addEventListener('error', () => { Radio.failed = true; Radio.playing = false; });
    el.addEventListener('playing', () => { Radio.playing = true; G.screen && (G.screen.key = ''); });
    el.addEventListener('pause', () => { Radio.playing = false; });
    const rg = Audio.ctx.createGain(); rg.gain.value = 0; rg.connect(Audio.musicFilter); Radio.gain = rg;
    Radio.src = Audio.ctx.createMediaElementSource(el); Radio.src.connect(rg);
    if (Radio.enabled) radioPlay(0); else { Radio.idx = 0; Radio.cur = SONGS[0]; el.src = SONGS[0].src; }
  } catch (e) { Radio.failed = true; }
}
function radioPlay(i) {
  if (!Radio.el || Radio.failed) return;
  Radio.idx = i; Radio.cur = SONGS[i];
  Radio.el.src = SONGS[i].src;
  if (Radio.enabled) { const p = Radio.el.play(); if (p && p.catch) p.catch(() => { }); }
  if (G.screen) G.screen.key = '';
}
function radioEnable(on) { Radio.enabled = on; if (!Radio.el) return; if (on) { const p = Radio.el.play(); if (p && p.catch) p.catch(() => { }); } else Radio.el.pause(); }
const CHORDS = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]];
const ROOTS = [45, 41, 48, 43];
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function audioInit() {
  if (Audio.ctx) { if (Audio.ctx.state === 'suspended') Audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let ctx; try { ctx = new AC(); } catch (e) { return; }
  Audio.ctx = ctx;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); Audio.master = master;
  const mg = ctx.createGain(); mg.gain.value = 0; const mf = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 8000; mf.Q.value = 0.4;
  mf.connect(mg); mg.connect(master); Audio.musicGain = mg; Audio.musicFilter = mf;
  const sq = ctx.createGain(); sq.gain.value = 1; sq.connect(mf); Audio.musicIn = sq; Audio.seqGain = sq;
  const sg = ctx.createGain(); sg.gain.value = 1; sg.connect(master); Audio.sfx = sg;
  // noise buffers
  const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; Audio.noise = nb;
  const bb = ctx.createBuffer(1, len, ctx.sampleRate), bd = bb.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; bd[i] = last * 3.5; }
  // ocean + wind
  const ocean = ctx.createBufferSource(); ocean.buffer = bb; ocean.loop = true;
  const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 520;
  const og = ctx.createGain(); og.gain.value = 0.0; ocean.connect(of).connect(og).connect(master); ocean.start(); Audio.ocean = og;
  const wind = ctx.createBufferSource(); wind.buffer = nb; wind.loop = true;
  const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 700; wf.Q.value = 0.5;
  const wg = ctx.createGain(); wg.gain.value = 0; wind.connect(wf).connect(wg).connect(master); wind.start(); Audio.wind = wg; Audio.windF = wf;
  const wh = ctx.createBufferSource(); wh.buffer = nb; wh.loop = true; const whF = ctx.createBiquadFilter(); whF.type = 'bandpass'; whF.frequency.value = 800; whF.Q.value = 0.6;
  const whG = ctx.createGain(); whG.gain.value = 0; wh.connect(whF).connect(whG).connect(Audio.sfx); wh.start(); Audio.wh = whG; Audio.whF = whF;
  Audio.started = true; Audio.t0 = ctx.currentTime + 0.1; Audio.nextT = Audio.t0; Audio.step = 0;
  setInterval(audioTick, 25);
  radioInit();
  document.addEventListener('visibilitychange', () => { if (!Audio.ctx) return; if (document.hidden) { Audio.ctx.suspend(); if (Radio.el) Radio.el.pause(); } else { Audio.ctx.resume(); if (Radio.el && Radio.enabled && !Radio.failed) { const p = Radio.el.play(); if (p && p.catch) p.catch(() => { }); } } });
}
function audioTick() {
  const A = Audio, ctx = A.ctx; if (!ctx || ctx.state !== 'running') return;
  if (A.nextT < ctx.currentTime - 0.3) { const b = A.beat(); A.step = Math.ceil(b * 4); A.nextT = A.t0 + A.step * 60 / A.bpm / 4; }
  while (A.nextT < ctx.currentTime + 0.12) {
    if (A.step % 16 === 0 && A.want !== A.style && A.want !== 'radio' && A.style !== 'radio' && STYLES[A.want]) { const nb = STYLES[A.want]; A.t0 = A.nextT - A.step * 60 / nb / 4; A.bpm = nb; A.style = A.want; }
    if (A.style !== 'radio' && A.musicGain.gain.value > 0.003) playStep(A.step, A.nextT);
    A.step++; A.nextT = A.t0 + A.step * 60 / A.bpm / 4;
  }
}
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function osc(type, f, t, dur, dest) { const o = Audio.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; }
function gainNode(dest, v = 1) { const g = Audio.ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
function noiseHit(t, type, f, q, dur, v, dest) {
  const ctx = Audio.ctx, s = ctx.createBufferSource(); s.buffer = Audio.noise;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.002, v, dur); s.connect(fl).connect(g).connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function kick(t, v) { const ctx = Audio.ctx, g = gainNode(Audio.musicIn, 0); env(g, t, 0.003, 0.95 * v, 0.36); const o = osc('sine', 150, t, 0.4, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); }
function bass(t, m, dur, v) { const ctx = Audio.ctx; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + dur); f.Q.value = 3; const g = gainNode(Audio.musicIn, 0); f.connect(g); env(g, t, 0.006, 0.32 * v, dur); osc('sawtooth', mtof(m), t, dur, f); osc('sine', mtof(m - 12), t, dur, g); }
function steel(t, m, v) { const ctx = Audio.ctx, f = mtof(m); const g = gainNode(Audio.musicIn, 0); env(g, t, 0.004, 0.16 * v, 0.7); const car = osc('sine', f, t, 0.8, g); const mod = ctx.createOscillator(); mod.frequency.value = f * 2.76; const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.4); mod.connect(mg).connect(car.frequency); mod.start(t); mod.stop(t + 0.85); osc('sine', f * 2, t, 0.3, gainNode(g, 0.3)); }
function stab(t, notes, dur, v, type = 'sawtooth', cut = 2200) { const ctx = Audio.ctx; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; const g = gainNode(Audio.musicIn, 0); f.connect(g); env(g, t, 0.005, 0.07 * v, dur); for (const n of notes) { osc(type, mtof(n), t, dur, f).detune.value = (Math.random() - 0.5) * 14; } }
function pad(t, notes, dur, v) { const ctx = Audio.ctx; const g = gainNode(Audio.musicIn, 0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.connect(g); for (const n of notes) { osc('triangle', mtof(n), t, dur, f); osc('sine', mtof(n + 12), t, dur, gainNode(f, 0.4)).detune.value = 6; } }
function pluck(t, m, v) { const g = gainNode(Audio.musicIn, 0); env(g, t, 0.003, 0.11 * v, 0.35); osc('triangle', mtof(m), t, 0.4, g); }
const MEL = { last: 4 };
function playStep(step, t) {
  const s = step % 16, bar = Math.floor(step / 16), ch = bar % 4, chord = CHORDS[ch], root = ROOTS[ch], A = Audio, dest = A.musicIn;
  const st = A.style;
  if (st === 'tropical') {
    if (s % 4 === 0) kick(t, 0.8);
    if (s === 4 || s === 12) noiseHit(t, 'bandpass', 1500, 0.8, 0.16, 0.32, dest);
    if (s % 4 === 2) noiseHit(t, 'highpass', 8000, 0.7, 0.05, 0.13, dest);
    noiseHit(t, 'highpass', 9000, 0.5, 0.025, 0.035, dest);
    if (s === 0 || s === 3 || s === 8 || s === 11) bass(t, root + (s === 11 ? 12 : 0), 0.28, 1);
    if (s % 4 === 2) stab(t, chord.map(n => n + 12), 0.1, 0.9, 'triangle', 3000);
    if ([0, 2, 3, 6, 8, 10, 11, 14].includes(s) && Math.random() < 0.62) { MEL.last = clamp(MEL.last + Math.round((Math.random() - 0.5) * 4), 0, PENTA.length - 1); steel(t, PENTA[MEL.last] + 12, 1); }
  } else if (st === 'house' || st === 'silent') {
    if (s % 4 === 0) kick(t, 1);
    if (s === 4 || s === 12) { noiseHit(t, 'bandpass', 1700, 0.9, 0.18, 0.38, dest); noiseHit(t + 0.012, 'bandpass', 1300, 0.9, 0.12, 0.2, dest); }
    if (s % 2 === 1) noiseHit(t, 'highpass', 9000, 0.7, 0.03, 0.07, dest);
    if (s % 4 === 2) { noiseHit(t, 'highpass', 7000, 0.6, 0.2, 0.14, dest); bass(t, root + 12, 0.16, 1.1); }
    if (s === 3 || s === 6 || s === 11 || (s === 14 && bar % 2)) stab(t, chord, 0.12, 1.3);
    if (bar % 8 >= 4 && s % 2 === 0 && Math.random() < 0.5) pluck(t, chord[(s / 2) % 3] + 24, 0.8);
  } else {
    if (s === 0 || s === 10) kick(t, 0.5);
    if (s === 4 || s === 12) noiseHit(t, 'bandpass', 2400, 2, 0.05, 0.13, dest);
    if (s === 0) { pad(t, chord, 60 / A.bpm * 4, 1); bass(t, root, 0.9, 0.8); }
    if (s % 3 === 0) pluck(t, chord[(s / 3) % 3] + 12, 0.9);
  }
}
/* ---------- sound effects ---------- */
function sfx(name, v = 1) {
  const A = Audio, ctx = A.ctx; if (!ctx || ctx.state !== 'running' || A.sfxVol <= 0) return;
  const t = ctx.currentTime + 0.005, out = gainNode(A.sfx, A.sfxVol);
  switch (name) {
    case 'tick': { const g = gainNode(out, 0); env(g, t, 0.002, 0.15, 0.05); osc('sine', 1400, t, 0.08, g); break; }
    case 'stamp': { noiseHit(t, 'lowpass', 400, 1, 0.12, 0.5, out); [880, 1320, 1760].forEach((f, i) => { const g = gainNode(out, 0); env(g, t + 0.06 + i * 0.09, 0.005, 0.18, 0.5); osc('sine', f, t + 0.06 + i * 0.09, 0.6, g); }); break; }
    case 'chime': { [72, 76, 79].forEach((m, i) => { const g = gainNode(out, 0); env(g, t + i * 0.12, 0.005, 0.14, 0.9); osc('sine', mtof(m), t + i * 0.12, 1, g); osc('sine', mtof(m + 12), t + i * 0.12, 0.5, gainNode(g, 0.3)); }); break; }
    case 'splash': { noiseHit(t, 'lowpass', 1400, 0.7, 0.55 * Math.max(0.5, v), 0.5 * v, out); noiseHit(t + 0.05, 'bandpass', 3000, 0.8, 0.3, 0.2 * v, out); break; }
    case 'horn': { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = gainNode(out, 0); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42, t + 0.15); g.gain.setValueAtTime(0.42, t + 2.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0); for (const fr of [87.3, 110, 130.8]) osc('sawtooth', fr, t, 3.1, f); break; }
    case 'boom': { noiseHit(t, 'lowpass', 260, 0.7, 1.4, 0.8 * v, out); const g = gainNode(out, 0); env(g, t, 0.005, 0.6 * v, 0.6); const o = osc('sine', 80, t, 0.7, g); o.frequency.exponentialRampToValueAtTime(35, t + 0.5); for (let i = 0; i < 10; i++) noiseHit(t + 0.4 + Math.random() * 1.2, 'highpass', 4000, 1, 0.03, 0.08 * v, out); break; }
    case 'swish': noiseHit(t, 'highpass', 2500, 0.8, 0.28, 0.25, out); break;
    case 'swoosh': { const s = ctx.createBufferSource(); s.buffer = A.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35); const g = gainNode(out, 0); env(g, t, 0.05, 0.25 * v, 0.35); s.connect(f).connect(g); s.start(t); s.stop(t + 0.5); break; }
    case 'whooshStart': { const s = ctx.createBufferSource(); s.buffer = A.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1600, t + 0.8); const g = gainNode(out, 0); env(g, t, 0.3, 0.3, 0.6); s.connect(f).connect(g); s.start(t); s.stop(t + 1); break; }
    case 'clank': { [520, 830, 1370, 2210].forEach((f, i) => { const g = gainNode(out, 0); env(g, t, 0.002, 0.09 / (i + 1), 0.45); osc('sine', f, t, 0.5, g); }); break; }
    case 'clap': noiseHit(t, 'bandpass', 1600, 0.9, 0.1, 0.3 * v, out); break;
    case 'pour': { for (let i = 0; i < 8; i++) noiseHit(t + i * 0.06, 'bandpass', 900 + Math.random() * 500, 3, 0.08, 0.08, out); const g = gainNode(out, 0); env(g, t + 0.55, 0.003, 0.12, 0.3); osc('sine', 2300, t + 0.55, 0.35, g); break; }
    case 'shutter': { noiseHit(t, 'highpass', 3000, 1, 0.04, 0.4, out); noiseHit(t + 0.07, 'highpass', 2000, 1, 0.05, 0.3, out); break; }
    case 'bite': { noiseHit(t, 'bandpass', 2600, 1.5, 0.06, 0.32, out); noiseHit(t + 0.08, 'bandpass', 1800, 1.5, 0.05, 0.2, out); break; }
    case 'slurp': { const s = ctx.createBufferSource(); s.buffer = A.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(1600, t + 0.35); const g = gainNode(out, 0); env(g, t, 0.04, 0.3, 0.35); s.connect(f).connect(g); s.start(t); s.stop(t + 0.5); break; }
    case 'win': { [72, 76, 79, 84].forEach((m, i) => { const g = gainNode(out, 0); env(g, t + i * 0.08, 0.004, 0.14, 0.4); osc('triangle', mtof(m), t + i * 0.08, 0.45, g); }); break; }
    case 'reel': { for (let i = 0; i < 14; i++) noiseHit(t + i * 0.09, 'bandpass', 2400, 4, 0.03, 0.09, out); break; }
    case 'tock': { const g = gainNode(out, 0); env(g, t, 0.002, 0.3 * v, 0.08); osc('sine', 900, t, 0.1, g); noiseHit(t, 'bandpass', 1200, 3, 0.03, 0.15 * v, out); break; }
    case 'chip': { [3200, 4100].forEach((f, i) => { const g = gainNode(out, 0); env(g, t + i * 0.03, 0.001, 0.08, 0.08); osc('sine', f, t + i * 0.03, 0.1, g); }); break; }
    case 'card': noiseHit(t, 'highpass', 3500, 0.8, 0.07, 0.22, out); break;
    case 'cup': { [660, 990].forEach((f, i) => { const g = gainNode(out, 0); env(g, t + i * 0.05, 0.002, 0.18, 0.3); osc('sine', f, t + i * 0.05, 0.35, g); }); break; }
  }
}
/* ---------- per-frame music placement ---------- */
function musicSources() {
  const m = Clock.min, out = [], R = st => st === 'radio' || st === 'silent' ? (radioUsable() ? 'radio' : st === 'silent' ? 'house' : 'house') : st;
  const ev = liveEvent();
  if (ev && ev.music && !G.port) { const f = eventFocus(ev); out.push({ pos: f, style: R(ev.music), r: ev.music === 'silent' ? 10 : ev.zone === 'dome' ? 60 : 75, vol: 1, level: World.zones[ev.zone].level }); }
  if (m >= 10 * 60 && m < 19 * 60 + 30) out.push({ pos: V3(19.5, 52, -90), style: R('radio'), r: 60, vol: 0.55, level: 'd15' });
  if (m >= 19 * 60 + 30 || m < 3 * 60) out.push({ pos: V3(0, 52, -118), style: R('radio'), r: 50, vol: 0.6, level: 'd15' });
  out.push({ pos: V3(0, 21.5, 83), style: 'chill', r: 40, vol: 0.42, level: 'casino' });
  if (Suite.music) out.push({ pos: V3(22.9, 39, 93.2), style: R('radio'), r: 16, vol: 0.8, level: 'suite' });
  if (G.port && G.port.feat.bar) { const b = G.port.feat.bar; out.push({ pos: V3(b.x, b.y, b.z), style: G.port.id === 'solana' ? 'tropical' : G.port.id === 'verde' ? 'chill' : R('radio'), r: 55, vol: 0.6, level: 'port' }); }
  if (G.port && G.port.feat.plaza) { const p = G.port.feat.plaza; out.push({ pos: V3(p.x, 2.5, p.z), style: 'tropical', r: 45, vol: 0.55, level: 'port' }); }
  return out;
}
function updateAudio(dt) {
  const A = Audio, ctx = A.ctx; if (!ctx) return;
  const lp = G.state === 'play' || G.state === 'photo' ? Player.pos : G.camera.position;
  let best = null, bl = 0;
  for (const s of musicSources()) {
    const d = lp.distanceTo(s.pos); let L = s.vol * Math.pow(clamp(1 - d / s.r, 0, 1), 1.3);
    if (G.state === 'play' && Player.level !== s.level) L *= 0.3;
    if (L > bl) { bl = L; best = s; }
  }
  if (best && bl > 0.02) A.want = best.style;
  if (G.state === 'boarding' || G.state === 'creator') A.want = radioUsable() ? 'radio' : 'tropical';
  const now = ctx.currentTime;
  if (A.want === 'radio' && A.style !== 'radio') A.style = 'radio';
  else if (A.want !== 'radio' && A.style === 'radio') { A.style = STYLES[A.want] ? A.want : 'house'; A.bpm = STYLES[A.style]; A.t0 = now + 0.05; A.step = 0; A.nextT = A.t0; }
  if (A.style === 'radio' && Radio.cur) A.bpm = Radio.cur.bpm;
  if (Radio.gain) { Radio.gain.gain.setTargetAtTime(A.style === 'radio' ? 1 : 0, now, 0.25); A.seqGain.gain.setTargetAtTime(A.style === 'radio' ? 0 : 1, now, 0.25); }
  const np = $('nowPlaying'), showNP = A.style === 'radio' && Radio.playing && Radio.cur && (bl > 0.12 || G.state === 'creator') && G.state === 'play';
  if (np) { if (np.hidden === showNP) np.hidden = !showNP; if (showNP && Radio.shown !== Radio.cur.id) { Radio.shown = Radio.cur.id; np.innerHTML = `<img src="${Radio.cur.art}" alt=""><span><b>${esc(Radio.cur.title)}</b><small>${esc(Radio.cur.artist)} · Tileo Radio</small></span>`; } }
  const amb = G.state === 'boarding' ? 0.35 : G.state === 'creator' ? 0.25 : 0;
  A.musicGain.gain.setTargetAtTime(A.musicVol * Math.max(bl * 0.9, amb), now, 0.3);
  A.musicFilter.frequency.setTargetAtTime(G.state === 'creator' ? 1800 : lerp(500, 15000, Math.sqrt(bl)), now, 0.3);
  const high = clamp((lp.y - 18) / 40, 0, 1);
  A.ocean.gain.setTargetAtTime(A.sfxVol * (0.12 + 0.06 * Math.sin(G.time * 0.5)) * (1 - high * 0.5) * (G.state === 'creator' ? 0.2 : 1), now, 0.5);
  A.wind.gain.setTargetAtTime(A.sfxVol * (0.015 + high * 0.04) * (G.state === 'creator' ? 0 : 1), now, 0.5);
}

/* ---- 85_net.js ---- */
/* ================= shared multiplayer: everyone playing right now ================= */
/* Three transports with one shape: the claude.ai room capability (inside Claude); the TILEO multiplayer server
   over a WebSocket when the website sets window.TILEO_RELAY_URL; otherwise peer-to-peer WebRTC (Trystero). */
const Net = { kind: '', room: null, connected: false, me: null, remotes: new Map(), sendT: 0, last: '', say: null, sayT: 0, cabin: '', cabinDirty: true, triv: null };
const NET_ANIMS = new Set(['idle', 'walk', 'air', 'swim', 'tread', 'soak', 'lie', 'sit', 'dance', 'wave', 'cheer', 'pose', 'yoga', 'slide', 'zip', 'drink', 'shootAim', 'shoot', 'gaze', 'talk', 'surf', 'tumble', 'putt', 'slot', 'cards']);
const NET_HELD = new Set(['cup', 'cone', 'slice', 'burger', 'hotdog', 'fries', 'cupcake', 'taco', 'coconut', 'bottle', 'fruitcup', 'cookie', 'putter']);
const cleanText = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, n);
const num = (v, a, b, d = 0) => (typeof v === 'number' && isFinite(v)) ? clamp(v, a, b) : d;

async function initNet() {
  let room = null;
  if (window.claude && typeof window.claude.use === 'function') { try { room = await window.claude.use('room'); } catch (e) { room = null; } if (room) Net.kind = 'room'; }
  if (!room && window.TILEO_RELAY_URL) { room = makeWSRoom(window.TILEO_RELAY_URL); if (room) Net.kind = 'ws'; }
  if (!room) { room = makeP2PRoom(); if (room) Net.kind = 'p2p'; }
  if (!room) return;
  Net.room = room;
  try {
    room.onPeers(ch => netPeers(ch), () => { Net.connected = false; updatePeopleBtn(); });
    room.onConnection(c => { Net.connected = !!c; updatePeopleBtn(); }, () => { Net.connected = false; updatePeopleBtn(); });
  } catch (e) { Net.room = null; }
}
function netPeers(ch) {
  for (const p of ch.peers) if (p.isMe && p.sameTab) Net.me = p.peer;
  for (const p of ch.left) dropRemote(p.peer);
  for (const p of ch.peers) { if (p.sameTab || p.kind !== 'viewer') continue; readRemote(p); }
  updatePeopleBtn();
}
/* ---------- peer-to-peer transport (standalone hosting) ---------- */
const SHIP_RE = /^[a-z0-9]{4,12}$/;
function shipFromHash() { const m = /(?:^|[#&])ship=([a-z0-9]{4,12})/i.exec(location.hash || ''); return m ? m[1].toLowerCase() : ''; }
function makeP2PRoom() {
  const lib = window.TileoP2P;
  if (!lib || typeof lib.joinRoom !== 'function' || !window.RTCPeerConnection || !(window.crypto && crypto.subtle)) return null;
  const cfg = { appId: 'tileo-cruise-lines-v2', relayConfig: { warnOnRelayFailure: false } };
  if (Array.isArray(window.TILEO_RELAYS) && window.TILEO_RELAYS.length) cfg.relayConfig.urls = window.TILEO_RELAYS;
  const peers = new Map(), DECK_MAX = 14;
  let room = null, act = null, mine = null, peersCb = null, connCb = null, code = '', deck = 1, hopT = null;
  const meEntry = () => ({ peer: lib.selfId, isMe: true, sameTab: true, kind: 'viewer', presence: mine || {} });
  const emit = left => {
    if (!peersCb) return;
    const list = [meEntry()];
    for (const [id, v] of peers) if (v.pres) list.push({ peer: id, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: v.pres });
    try { peersCb({ peers: list, left: left || [] }); } catch (e) { console.error(e); }
  };
  const leaveAll = () => {
    if (hopT) { clearTimeout(hopT); hopT = null; }
    if (room) { try { room.leave(); } catch (e) { } room = null; act = null; }
    const left = [...peers.keys()].map(peer => ({ peer })); peers.clear(); if (left.length) emit(left);
  };
  const join = (shipCode, deckNo) => {
    leaveAll(); code = shipCode || ''; deck = deckNo || 1;
    try { room = lib.joinRoom(cfg, code ? 'ship-' + code : 'deck-' + deck); } catch (e) { console.error(e); room = null; if (connCb) connCb(false); return; }
    act = room.makeAction('pres');
    act.onMessage = (data, ctx) => {
      if (!data || typeof data !== 'object' || Array.isArray(data) || !ctx || typeof ctx.peerId !== 'string') return;
      if (JSON.stringify(data).length > 4096) return;
      peers.set(ctx.peerId, { pres: data, t: Date.now() }); emit();
    };
    room.onPeerJoin = id => { if (!peers.has(id)) peers.set(id, { pres: null, t: Date.now() }); if (mine && act) act.send(mine, { target: id }).catch(() => { }); };
    room.onPeerLeave = id => { if (peers.delete(id)) emit([{ peer: id }]); };
    if (connCb) connCb(true);
    // the public deck holds a small crowd; when it is full, move on to the next deck
    if (!code) hopT = setTimeout(() => { hopT = null; if (!code && peers.size >= DECK_MAX && deck < 8) join('', deck + 1); }, 9000);
  };
  setInterval(() => {
    const now = Date.now(), gone = [];
    for (const [id, v] of peers) if (v.pres && now - v.t > 30000) { peers.delete(id); gone.push({ peer: id }); }
    if (gone.length) emit(gone);
    if (mine && act && peers.size) act.send(mine).catch(() => { });
  }, 5000);
  window.addEventListener('hashchange', () => { const c = shipFromHash(); if (c !== code) join(c, 1); });
  window.addEventListener('pagehide', () => { try { room && room.leave(); } catch (e) { } });
  join(shipFromHash(), 1);
  return {
    kind: 'p2p',
    get code() { return code; }, get deck() { return deck; },
    presence(p) { mine = p; return act && peers.size ? act.send(p).catch(() => { }) : Promise.resolve(); },
    onPeers(cb) { peersCb = cb; emit(); },
    onConnection(cb) { connCb = cb; cb(!!room); },
    switchShip(c) {
      const next = c && SHIP_RE.test(c) ? c : '';
      try { history.replaceState(null, '', location.pathname + location.search + (next ? '#ship=' + next : '')); } catch (e) { }
      join(next, 1);
    }
  };
}
/* ---------- multiplayer server transport (WebSocket relay) ---------- */
function makeWSRoom(url) {
  if (!window.WebSocket || typeof url !== 'string' || !/^wss?:\/\//.test(url)) return null;
  const httpBase = url.replace(/^ws/, 'http').replace(/\/ws\/?$/, '');
  const peers = new Map();
  let ws = null, mine = null, peersCb = null, connCb = null, code = shipFromHash(), deck = 0, myId = 'me', open = false, tries = 0, timer = null;
  const meEntry = () => ({ peer: myId, isMe: true, sameTab: true, kind: 'viewer', presence: mine || {} });
  const emit = left => {
    if (!peersCb) return;
    const list = [meEntry()];
    for (const [id, d] of peers) list.push({ peer: id, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: d });
    try { peersCb({ peers: list, left: left || [] }); } catch (e) { console.error(e); }
  };
  const clearPeers = () => { const left = [...peers.keys()].map(peer => ({ peer })); peers.clear(); if (left.length) emit(left); };
  const setConn = v => { open = v; if (connCb) connCb(v); };
  const sendRaw = o => { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (e) { } } };
  const setHash = c => { try { history.replaceState(null, '', location.pathname + location.search + (c ? '#ship=' + c : '')); } catch (e) { } };
  const okObj = d => d && typeof d === 'object' && !Array.isArray(d);
  const handle = m => {
    if (!okObj(m)) return;
    if (m.t === 'welcome') {
      myId = typeof m.id === 'string' ? m.id : 'me'; deck = m.deck | 0;
      if (!m.ship && code) { code = ''; setHash(''); }
      clearPeers();
      for (const p of Array.isArray(m.peers) ? m.peers : []) if (p && typeof p.id === 'string' && okObj(p.d)) peers.set(p.id, p.d);
      setConn(true); if (mine) sendRaw({ t: 'p', d: mine }); emit();
    } else if (m.t === 'p' && typeof m.id === 'string' && okObj(m.d)) { peers.set(m.id, m.d); emit(); }
    else if (m.t === 'leave' && typeof m.id === 'string') { if (peers.delete(m.id)) emit([{ peer: m.id }]); }
    else if (m.t === 'full') toast('That private ship is full', 'You are on a public deck instead.');
  };
  const retry = () => { clearTimeout(timer); const d = Math.min(15000, 1000 * Math.pow(1.6, tries++)); timer = setTimeout(connect, d); };
  function connect() {
    clearTimeout(timer); timer = null;
    let sock; try { sock = new WebSocket(url); } catch (e) { retry(); return; }
    ws = sock;
    sock.onopen = () => { tries = 0; sendRaw({ t: 'join', ship: code }); };
    sock.onmessage = ev => { if (typeof ev.data !== 'string' || ev.data.length > 70000) return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
    sock.onclose = () => { if (ws !== sock) return; ws = null; if (open) setConn(false); clearPeers(); retry(); };
    sock.onerror = () => { };
  }
  // a free server sleeps when nobody plays; a light check-in while connected keeps it awake for the people aboard
  setInterval(() => { if (open && !document.hidden) fetch(httpBase + '/health', { cache: 'no-store', mode: 'cors' }).catch(() => { }); }, 240000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !ws) connect(); });
  window.addEventListener('hashchange', () => { const c = shipFromHash(); if (c !== code) { code = c; clearPeers(); sendRaw({ t: 'join', ship: code }); } });
  window.addEventListener('pagehide', () => { try { ws && ws.close(); } catch (e) { } });
  connect();
  return {
    kind: 'ws',
    get code() { return code; }, get deck() { return deck || 1; },
    presence(p) { mine = p; sendRaw({ t: 'p', d: p }); return Promise.resolve(); },
    onPeers(cb) { peersCb = cb; emit(); },
    onConnection(cb) { connCb = cb; cb(open); },
    switchShip(c) { code = c && SHIP_RE.test(c) ? c : ''; setHash(code); clearPeers(); sendRaw({ t: 'join', ship: code }); }
  };
}
function newShipCode() { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const r = new Uint32Array(6); crypto.getRandomValues(r); for (const v of r) s += a[v % a.length]; return s; }
function inviteLink(code) { return location.origin + location.pathname + location.search + '#ship=' + code; }
async function copyInvite(code) {
  const url = inviteLink(code);
  try { await navigator.clipboard.writeText(url); toast('Invite link copied', 'Send it to friends to sail together'); }
  catch (e) { const i = $('inviteUrl'); if (i) { i.hidden = false; i.value = url; i.select(); } toast('Copy the link below', 'Your browser blocked automatic copying'); }
}
function readRemote(p) {
  const pr = p.presence || {}; if (pr.v !== 2) return;
  let R = Net.remotes.get(p.peer);
  if (!R) { R = { peer: p.peer, pos: V3(), tpos: V3(), yaw: 0, tyaw: 0, ch: null, appKey: '', seen: 0, sayT: 0, tag: null, guest: !!p.guest, mine: !!p.isMe }; Net.remotes.set(p.peer, R); }
  R.name = cleanText(pr.n, 18) || 'Passenger';
  R.loc = typeof pr.l === 'string' && /^(ship|port:[a-z]{2,10}|suite:[A-Za-z0-9_-]{1,64})$/.test(pr.l) ? pr.l : 'ship';
  const a = Array.isArray(pr.a) ? pr.a : [];
  R.app = { body: num(a[0], 0, 3) | 0, height: num(a[1], 95, 105, 100) / 100, skin: num(a[2], 0, SKIN.length - 1) | 0, hair: num(a[3], 0, 8) | 0, hairColor: num(a[4], 0, HAIR_COLORS.length - 1) | 0, top: num(a[5], 0, TOPS.length - 1) | 0, topColor: num(a[6], 0, OUTFIT.length - 1) | 0, bottom: num(a[7], 0, BOTTOMS.length - 1) | 0, bottomColor: num(a[8], 0, OUTFIT.length - 1) | 0, shoes: num(a[9], 0, SHOE_COLORS.length - 1) | 0, acc: num(a[10], 0, ACCS.length - 1) | 0, accColor: num(a[11], 0, ACC_COLORS.length - 1) | 0 };
  const P = Array.isArray(pr.p) ? pr.p : [0, DK.top, -88];
  R.tpos.set(num(P[0], -400, 800), num(P[1], -12, 120, DK.top), num(P[2], -400, 400));
  R.tyaw = num(pr.r, -10, 10);
  R.anim = NET_ANIMS.has(pr.m) ? pr.m : 'idle';
  R.speed = num(pr.s, 0, 20); R.dance = num(pr.d, 0, 5) | 0; R.seat = num(pr.st, 0, 1.2, 0.8);
  R.held = NET_HELD.has(pr.h) ? pr.h : null; R.heldCol = typeof pr.hc === 'string' && /^#[0-9a-f]{6}$/i.test(pr.hc) ? pr.hc : null;
  if (pr.say && typeof pr.say === 'object') {
    const t = num(pr.say.t, 0, 1e15), x = cleanText(pr.say.x, 80);
    if (!R.seen) R.sayT = t; // whatever they said before we met is old news
    else if (t > R.sayT && x && (!publicChatOnly() || QUICK_SAYS.includes(x))) { R.sayT = t; R.pendingSay = x; }
  }
  R.cabin = typeof pr.c === 'string' ? pr.c.slice(0, 900) : '';
  R.triv = pr.tv && typeof pr.tv === 'object' ? { s: num(pr.tv.s, 0, 99999) | 0, t: num(pr.tv.t, 0, 1e15) } : null;
  if (!R.seen) { R.pos.copy(R.tpos); R.yaw = R.tyaw; }
  R.seen = performance.now();
}
function dropRemote(peer) {
  const R = Net.remotes.get(peer); if (!R) return;
  if (R.ch) G.scene.remove(R.ch.rig.root); if (R.tag) R.tag.remove();
  Net.remotes.delete(peer);
}
function myLoc() {
  if (G.port) return 'port:' + G.port.id;
  if (Player.level === 'suite') return 'suite:' + (Suite.owner === 'me' ? (Net.me || 'me') : Suite.owner);
  return 'ship';
}
function netCabinChanged() { Net.cabinDirty = true; }
const QUICK_SAYS = ['Hi!', 'Follow me!', 'Meet at the pool', 'Dance party in the dome!', 'Race you down the slides', 'Nice outfit!', 'Want to visit my suite?', 'See you ashore!', 'Good game!', 'Bye!'];
// On the open public deck (strangers on the internet) chat is limited to friendly preset phrases; private ships allow free text.
function publicChatOnly() { return (Net.kind === 'p2p' || Net.kind === 'ws') && Net.room && !Net.room.code; }
function netSay(text) {
  const x = cleanText(text, 80); if (!x) return;
  if (publicChatOnly() && !QUICK_SAYS.includes(x)) { toast('Free chat is for private ships', 'Start a private ship from this sheet to chat freely with friends.'); return; }
  const now = Date.now(); if (now - Net.sayT < 1500) { toast('Slow down a little', 'One message every couple of seconds.'); return; }
  Net.sayT = now; Net.say = { t: now, x };
  showBubble({ ch: Player.char, name: G.profile.name || 'You', pos: Player.pos }, x);
  if ([...Net.remotes.values()].some(R => R.loc === myLoc())) stamp('shipmates');
}
function netTriviaScores() {
  const out = [], now = Date.now();
  for (const R of Net.remotes.values()) if (R.triv && now - R.triv.t < 30 * 60 * 1000) out.push({ n: R.name + (R.guest ? ' (guest)' : ''), s: R.triv.s });
  return out;
}
function netSend(dt) {
  if (!Net.room || !Net.connected || !G.profile || (G.state !== 'play' && G.state !== 'photo')) return;
  Net.sendT -= dt; if (Net.sendT > 0) return; Net.sendT = 0.1;
  const c = Player.char, r = c.rig.root, A = G.profile.app;
  if (Net.cabinDirty) { Net.cabin = encodeLayout(myLayout()); Net.cabinDirty = false; }
  const pres = {
    v: 2, n: cleanText(G.profile.name, 18), l: myLoc(),
    a: [A.body, Math.round((A.height || 1) * 100), A.skin, A.hair, A.hairColor, A.top, A.topColor, A.bottom, A.bottomColor, A.shoes, A.acc, A.accColor],
    p: [+r.position.x.toFixed(2), +r.position.y.toFixed(2), +r.position.z.toFixed(2)], r: +wrapAngle(r.rotation.y).toFixed(2),
    m: NET_ANIMS.has(c.anim) ? c.anim : 'idle', s: +(c.speed || 0).toFixed(1), d: c.danceStyle | 0, st: +(c.seat || 0.8).toFixed(2),
    h: NET_HELD.has(c.held) ? c.held : null, hc: Food.held && FOOD[Food.held] && FOOD[Food.held].color ? FOOD[Food.held].color : null,
    say: Net.say, c: Net.cabin, tv: Trivia.active || G.profile.triviaBest ? { s: Trivia.active ? Trivia.score : (G.profile.triviaBest || 0), t: Date.now() } : null
  };
  const js = JSON.stringify(pres); if (js === Net.last) return; Net.last = js;
  Net.room.presence(pres).catch(() => { });
}
function updateRemotes(dt) {
  if (!Net.room) return;
  const loc = myLoc(), cam = G.camera.position;
  const vis = [];
  for (const R of Net.remotes.values()) { R.here = R.loc === loc && R.tpos.distanceTo(cam) < 160; if (R.here) vis.push(R); else if (R.ch) { R.ch.rig.root.visible = false; if (R.tag) R.tag.style.display = 'none'; } }
  vis.sort((a, b) => a.tpos.distanceToSquared(cam) - b.tpos.distanceToSquared(cam));
  vis.forEach((R, i) => {
    if (i >= 20) { if (R.ch) R.ch.rig.root.visible = false; if (R.tag) R.tag.style.display = 'none'; return; }
    const key = JSON.stringify(R.app);
    if (!R.ch || R.appKey !== key) { if (R.ch) G.scene.remove(R.ch.rig.root); R.ch = new Char(R.app, { seed: Math.random() * 100 }); R.ch.look = 0.4; buildCharMesh(R.ch); G.scene.add(R.ch.rig.root); R.appKey = key; R.pos.copy(R.tpos); R.yaw = R.tyaw; R.heldKey = ''; }
    const c = R.ch; c.rig.root.visible = true;
    if (R.pos.distanceToSquared(R.tpos) > 64) R.pos.copy(R.tpos); else R.pos.lerp(R.tpos, 1 - Math.exp(-10 * dt));
    R.yaw = dampAngle(R.yaw, R.tyaw, 10, dt);
    c.setAnim(R.anim); c.speed = R.speed; c.danceStyle = R.dance; c.seat = R.seat; c.beat = Audio.beat();
    const hk = (R.held || '') + (R.heldCol || ''); if (hk !== R.heldKey) { R.heldKey = hk; setHeld(c, R.held, R.heldCol); c.noSip = !!R.held; }
    c.update(dt, G.time);
    c.rig.root.position.copy(R.pos); c.rig.root.rotation.set(0, R.yaw, 0);
    if (!R.tag) { R.tag = document.createElement('div'); R.tag.className = 'ntag'; $('nameTags').appendChild(R.tag); }
    if (R.tag.dataset.n !== R.name) { R.tag.dataset.n = R.name; R.tag.textContent = R.name + (R.guest ? ' · guest' : ''); }
    const p = _v1.copy(R.pos); p.y += 2.12; p.project(G.camera);
    if (p.z > 1 || G.state !== 'play') R.tag.style.display = 'none';
    else { R.tag.style.display = ''; R.tag.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; R.tag.style.top = ((1 - p.y) / 2 * innerHeight) + 'px'; }
    if (R.pendingSay) { showBubble({ ch: c, name: R.name, pos: R.pos }, R.pendingSay); R.pendingSay = null; sfx('tick', 0.4); }
  });
}
function nearestRemote(p, maxD) {
  let best = null, bd = maxD;
  for (const R of Net.remotes.values()) { if (!R.here || !R.ch) continue; const d = Math.hypot(R.pos.x - p.x, R.pos.z - p.z); if (d < bd && Math.abs(R.pos.y - p.y) < 1.6) { bd = d; best = R; } }
  return best;
}
function updatePeopleBtn() {
  const b = $('btnPeople'); if (!b) return;
  const n = Net.remotes.size;
  b.hidden = !Net.room;
  const badge = $('peopleBadge'); badge.textContent = n; badge.hidden = !n;
  b.classList.toggle('off', !Net.connected);
}
function locLabel(l) { if (!l || l === 'ship') return 'Aboard the ship'; if (l.startsWith('port:')) { const P = PORTS.find(p => p.id === l.slice(5)); return P ? 'Ashore at ' + P.name : 'Ashore'; } return 'In their suite'; }
function peopleSheet() {
  const me = `<div class="person me"><span class="pdot"></span><div><b>${esc(G.profile.name || 'You')} <small>you</small></b><small>${esc(locLabel(myLoc()))}</small></div></div>`;
  const others = [...Net.remotes.values()].sort((a, b) => a.name.localeCompare(b.name)).map(R => {
    let btn = '';
    if (R.loc === 'ship' && myLoc() !== 'ship' || (R.loc === 'ship' && R.tpos.distanceTo(Player.pos) > 12)) btn = `<button class="btn btn-glass" data-go="${esc(R.peer)}">Go to</button>`;
    if (R.loc.startsWith('port:') && myLoc() !== R.loc) btn = `<button class="btn btn-glass" data-go="${esc(R.peer)}">Join ashore</button>`;
    if (R.loc.startsWith('suite:') && R.cabin && myLoc() !== R.loc) btn = `<button class="btn btn-glass" data-go="${esc(R.peer)}">Visit suite</button>`;
    return `<div class="person"><span class="pdot ${R.loc === myLoc() ? 'here' : ''}"></span><div><b>${esc(R.name)}${R.guest ? ' <small>guest</small>' : ''}</b><small>${esc(locLabel(R.loc))}</small></div>${btn}</div>`;
  }).join('');
  const p2p = Net.kind === 'p2p' || Net.kind === 'ws', code = p2p ? Net.room.code : '', pub = publicChatOnly();
  const quick = pub ? QUICK_SAYS : QUICK_SAYS.slice(0, 6);
  const shipRow = !p2p ? '' : code
    ? `<div class="shipbar"><div><b>Private ship · ${esc(code.toUpperCase())}</b><small>Only people with your invite link sail here</small></div><button class="btn btn-primary" id="shipCopy">Copy invite link</button><button class="btn btn-glass" id="shipPublic">Public deck</button></div>`
    : `<div class="shipbar"><div><b>Public deck ${Net.room.deck}</b><small>Anyone playing right now can appear here</small></div><button class="btn btn-primary" id="shipNew">Start a private ship</button></div>`;
  const emptyMsg = p2p ? (code ? 'No one else is aboard yet. Copy your invite link and send it to friends.' : 'No one else is on this deck right now. Start a private ship and invite friends, or check back later.') : 'No one else is aboard yet. Share this game with friends from the Share menu and they will appear here.';
  const privacy = Net.kind === 'ws' ? 'Your name, look and position are shared with the other players on this deck through the TILEO server. Nothing is saved.' : p2p ? 'Your name, look and position are shared with the other players on this deck, peer to peer. Like any peer-to-peer game, connected players can see your network address.' : 'Your name, look and position are shared with everyone viewing this page right now. Messages appear as speech bubbles.';
  sheet('Passengers online', Net.connected ? `${Net.remotes.size + 1} aboard right now` : Net.kind === 'ws' ? 'Connecting to the ship… the server can take up to a minute to wake up' : 'Connecting…', shipRow + me + (others || `<p class="empty">${emptyMsg}</p>`) + `
    ${pub ? '' : '<div class="chatbox"><input id="chatIn" maxlength="80" placeholder="Say something to people nearby" enterkeyhint="send"><button class="btn btn-primary" id="chatSend">Say</button></div>'}
    <div class="chips">${quick.map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <input id="inviteUrl" class="invite-url" readonly hidden aria-label="Invite link">
    <p class="kbd">${privacy}</p>`, body => {
    const send = () => { const v = $('chatIn').value; if (!v.trim()) return; netSay(v); $('chatIn').value = ''; closeSheet(); };
    if ($('chatIn')) { $('chatSend').onclick = send; $('chatIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); send(); } e.stopPropagation(); }; }
    if ($('shipNew')) $('shipNew').onclick = () => { const c = newShipCode(); Net.room.switchShip(c); sfx('chime'); copyInvite(c); peopleSheet(); };
    if ($('shipCopy')) $('shipCopy').onclick = () => copyInvite(code);
    if ($('shipPublic')) $('shipPublic').onclick = () => { Net.room.switchShip(''); sfx('tick'); peopleSheet(); };
    body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { netSay(b.dataset.q); closeSheet(); });
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => goToPeer(b.dataset.go));
  });
}
function goToPeer(peer) {
  const R = Net.remotes.get(peer); if (!R) return;
  closeSheet();
  if (R.loc.startsWith('port:')) { goAshore(R.loc.slice(5), true); return; }
  if (R.loc.startsWith('suite:')) {
    if (G.port) { toast('Head back to the ship first', 'Take the tender from the end of the pier.'); return; }
    const owner = R.loc.slice(6); if (owner === Net.me) { enterSuite('me'); return; }
    const O = Net.remotes.get(owner); enterSuite(owner, O ? O.cabin : R.cabin); return;
  }
  if (G.port) { returnToShip(); return; }
  const p = R.tpos, lvl = p.y < 23 && p.z > 60 ? 'casino' : p.y < 30 && p.y > 24 ? 'garden' : p.y < 23 ? 'bow' : 'd15';
  const g = World.grids[lvl] || World.grids.d15; const k = nearestValid(g, p.x + 1.2, p.z + 1.2, 10);
  if (k < 0) { toast('Could not reach ' + R.name); return; }
  const [x, y, z] = gridPos(g, k);
  fadeTeleport(x, y, z, Math.atan2(p.x - x, p.z - z), () => { leaveSuiteState(); toast('You found ' + R.name); });
}

/* ---- 90_ui.js ---- */
/* ================= UI: boarding, creator, HUD, sheets, main loop ================= */
const SVG = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  program: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h3M7.5 17.5h6"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="11" r="3.5"/><path d="M9 17h6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  jump: '<path d="M12 19V6M6 11l6-6 6 6"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2M9 9.5h.01M15 9.5h.01"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  ship: '<path d="M3 16h18l-3 4H6z"/><path d="M6 16V10h12v6M9 10V6h6v4"/>',
  wave: '<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><circle cx="12" cy="7" r="2.5"/>',
  slide: '<path d="M4 4h4v4M6 8c0 6 4 8 14 10"/><path d="M4 20h16"/>',
  star: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>',
  zip: '<path d="M3 5l18 6"/><path d="M11 8v5M9 13h4M10 13l-1 6M12 13l1 6"/>',
  glass: '<path d="M7 4h10l-1 8a4 4 0 0 1-8 0z"/><path d="M12 16v4M9 20h6M15 4l3-2"/>',
  cone: '<circle cx="12" cy="8" r="4"/><path d="m8.5 10 3.5 11 3.5-11"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.6 3.6 3.6 9.2 0 12.8M18.4 5.6c-3.6 3.6-3.6 9.2 0 12.8"/>',
  tub: '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M7 8c0-1 1-1 1-2M11 8c0-1 1-1 1-2M15 8c0-1 1-1 1-2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  cap: '<path d="M4 13c0-4 3.5-7 8-7s8 3 8 7z"/><path d="M3 13h18M12 6v2"/>',
  firework: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  bed: '<path d="M3 18v-6h18v6M3 14h18M6 12V9h5v3"/>',
  seat: '<path d="M7 4v8h10M7 12v8M17 12v8"/>',
  door: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M12 3v18M9 12h.01M15 12h.01"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  fork: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 3v18M17 3c-2 2-2 6 0 8v10"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M5 14a7 7 0 0 0 14 0"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  sofa: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11h18v6H3zM5 17v2M19 17v2"/>',
};
const KIND_ICON = { lounge: 'bed', sit: 'seat', bar: 'glass', shop: 'cone', slide: 'slide', zip: 'zip', towerUp: 'jump', towerDown: 'arrow', elevator: 'door', hoops: 'ball', dance: 'music', dj: 'music', tub: 'tub', bowpose: 'flag', npc: 'chat', captain: 'cap', shoot: 'ball', groove: 'music' };

/* ---------- profile ---------- */
function saveProfile() { if (!G.profile) return; G.profile.clock = { min: Clock.min, day: Clock.day }; Store.set('profile', G.profile); }
function newProfile(name) {
  return { name, app: randomAppearance(), stamps: [], visited: [], slides: [], created: Date.now(), cabin: String(10000 + Math.floor(Math.random() * 7000 + 1000)).slice(0, 5) };
}

/* ---------- toasts, action, mode bar ---------- */
function toast(title, sub, isStamp) {
  const host = $('toasts'); if (!host) return;
  const el = document.createElement('div'); el.className = 'toast' + (isStamp ? ' stamp' : '');
  el.innerHTML = (isStamp ? `<span class="st">${SVG(IC.star)}</span>` : '') + `<div><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  host.prepend(el); while (host.children.length > 3) host.lastChild.remove();
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 420); }, isStamp ? 4200 : 3200);
}
let lastActKey = '';
function setAction(h) {
  const b = $('actBtn');
  const key = h ? h.id + '|' + h.label : '';
  if (key === lastActKey) return; lastActKey = key;
  if (!h) { b.hidden = true; return; }
  b.hidden = false; $('actLabel').textContent = h.label; $('actIcon').innerHTML = SVG(IC[KIND_ICON[h.kind] || 'arrow'], 2.2);
  b.classList.toggle('alt', h.kind === 'groove' || h.kind === 'shoot');
}
function renderModeBar(items) {
  const bar = $('modeBar'); bar.innerHTML = '';
  if (!items) { bar.hidden = true; $('hudBR').style.visibility = ''; return; }
  bar.hidden = false;
  for (const it of items) { const b = document.createElement('button'); b.className = 'btn ' + (it.alt ? 'btn-glass' : 'btn-primary'); b.textContent = it.label; b.onclick = () => { sfx('tick'); it.fn(); }; bar.appendChild(b); }
}
function toggleEmotes() {
  const tr = $('emoteTray'); if (!tr.hidden) { tr.hidden = true; return; }
  tr.innerHTML = ''; tr.hidden = false;
  for (const [id, label] of [['wave', 'Wave'], ['dance', 'Dance'], ['cheer', 'Cheer'], ['pose', 'Strike a pose'], ['sit', 'Sit down'], ['photo', 'Photo mode']]) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => { sfx('tick'); if (id === 'photo') { hideEmotes(); enterPhoto(); } else doEmote(id); }; tr.appendChild(b);
  }
  if (Food.held) { const b = document.createElement('button'); b.textContent = 'Put food away'; b.onclick = () => { sfx('tick'); hideEmotes(); dropFood(); }; tr.appendChild(b); }
}
function hideEmotes() { $('emoteTray').hidden = true; }
const bubbles = [];
function showBubble(npc, text) {
  const el = document.createElement('div'); el.className = 'bubble'; el.innerHTML = `<small>${esc(npc.name)}</small>${esc(text)}`;
  $('bubbles').appendChild(el); bubbles.push({ el, npc, t: 4.8 });
}
function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); continue; }
    const p = _v1.copy(b.npc.ch ? b.npc.ch.rig.root.position : b.npc.pos); p.y += 2.6;
    p.project(G.camera);
    if (p.z > 1) { b.el.style.display = 'none'; continue; }
    b.el.style.display = ''; const hw = (b.el.offsetWidth || 160) / 2 + 8;
    b.el.style.left = clamp((p.x + 1) / 2 * innerWidth, hw, Math.max(hw, innerWidth - hw)) + 'px'; b.el.style.top = Math.max((b.el.offsetHeight || 40) + 8, (1 - p.y) / 2 * innerHeight) + 'px';
    b.el.style.opacity = Math.min(1, b.t * 2);
  }
}
function updateBadge() { $('stampBadge').textContent = G.profile ? G.profile.stamps.length : 0; }

/* ---------- sheets ---------- */
let sheetOpen = null;
function closeSheet() { $('sheetHost').innerHTML = ''; sheetOpen = null; }
function sheet(title, sub, bodyHTML, onMount) {
  const host = $('sheetHost');
  host.innerHTML = `<div class="scrim" id="scrim"></div><section class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="sh-x" id="shX" aria-label="Close">${SVG(IC.close)}</button></div><div class="sh-body" id="shBody">${bodyHTML}</div></section>`;
  $('scrim').onclick = closeSheet; $('shX').onclick = closeSheet;
  if (onMount) onMount($('shBody'));
}
function openSheet(name, o = {}) {
  hideEmotes(); sfx('tick'); sheetOpen = name;
  if (name === 'program') return programSheet();
  if (name === 'map') return mapSheet(o);
  if (name === 'passport') return passportSheet();
  if (name === 'settings') return settingsSheet();
  if (name === 'bar') return barSheet(o.bar);
  if (name === 'album') return albumSheet();
  if (name === 'people') return peopleSheet();
  if (name === 'ports') return portsSheet();
  if (name === 'music') return openMusic('radio');
}
function programSheet() {
  const order = EVENTS.slice().sort((a, b) => ((a.start - 360 + 1440) % 1440) - ((b.start - 360 + 1440) % 1440));
  const rows = order.map(e => {
    const live = isLive(e); const until = minutesUntil(e);
    const status = live ? '<span class="tag">Live now</span>' : until < 180 ? `<span class="tag" style="color:var(--mist)">In ${until < 60 ? Math.ceil(until) + ' min' : Math.floor(until / 60) + ' h ' + Math.round(until % 60) + ' min'}</span>` : '';
    return `<div class="ev ${live ? 'now' : ''}"><time>${fmtTime(e.start)}<small>to ${fmtTime(e.end)}</small></time><div><h3>${esc(e.name)}</h3><p>${status}${esc(e.where)}</p><p>${esc(e.desc)}</p></div><button data-ev="${e.id}">${live ? 'Go' : 'Skip to it'}</button></div>`;
  }).join('');
  const shore = `<div class="ev shore"><time>${fmtTime(PORT_OPEN)}<small>to ${fmtTime(ALL_ABOARD)}</small></time><div><h3>Shore days</h3><p>${G.port ? '<span class="tag">Ashore now</span>' : portOpen() ? '<span class="tag">Tenders running</span>' : ''}Mosaic Key · Port Solana · Isla Verde</p><p>Optional day trips. The ship anchors offshore and tenders run until 17:00. All aboard at 18:00.</p></div><button id="pgPorts">${G.port ? 'Ports' : 'See ports'}</button></div>`;
  sheet('Tileo Daily', `Day ${Clock.day} ${G.port ? 'in port' : 'at sea'} · Destination: Nowhere · Now ${fmtTime(Clock.min)}`, `<div class="dayhdr"><span>Program</span><span>${G.port ? 'At anchor' : '22.4 kn · heading 268°'}</span></div>${shore}${rows}`, body => {
    $('pgPorts').onclick = () => openSheet('ports');
    body.querySelectorAll('button[data-ev]').forEach(b => b.onclick = () => {
      const e = EVENTS.find(x => x.id === b.dataset.ev);
      if (isLive(e)) travelTo(e.zone);
      else { closeSheet(); setClock(e.start - 0.5); travelTo(e.zone); }
    });
  });
}
function planSVG() {
  const zs = []; for (let z = -152; z <= 152; z += 2) zs.push(z);
  const top = zs.map(z => `${z},${-deckHalf(z)}`), bot = zs.slice().reverse().map(z => `${z},${deckHalf(z)}`);
  const hz = []; for (let z = -182; z <= 172; z += 2) hz.push(z);
  const hull = hz.map(z => `${z},${-hullHalf(z)}`).concat(hz.slice().reverse().map(z => `${z},${hullHalf(z)}`));
  const P = Player.pos;
  return `<svg class="plan" viewBox="-190 -42 370 84" role="img" aria-label="Ship plan, bow on the left">
    <polygon points="${hull.join(' ')}" fill="#10264a" stroke="#2b4a7a" stroke-width="0.6"/>
    <polygon points="${top.concat(bot).join(' ')}" fill="#7a4f2e" stroke="#e8edf1" stroke-width="0.8"/>
    <ellipse cx="-123" cy="0" rx="27" ry="26" fill="rgba(205,238,247,.35)" stroke="#e8edf1" stroke-width="0.8"/>
    <rect x="-40" y="-12" width="102" height="24" fill="#3f7d34" stroke="#e8edf1" stroke-width="0.6"/>
    <rect x="-78" y="-9" width="14" height="18" rx="2" fill="#2fd3c6"/>
    <rect x="64" y="6.5" width="28" height="22.5" fill="#1b6fa0"/>
    <rect x="66" y="-29" width="26" height="21" fill="#a86c3c" stroke="#e8edf1" stroke-width="0.5"/>
    <ellipse cx="81" cy="0" rx="10" ry="4.6" fill="#f2f5f8"/>
    <rect x="96" y="-31" width="56" height="62" fill="rgba(90,169,255,.35)"/>
    <rect x="-15" y="-27.5" width="16" height="10.2" rx="1.5" fill="#1aa6c8"/><rect x="-30" y="15" width="60" height="14" rx="1.5" fill="none" stroke="#7bd389" stroke-width="0.8" stroke-dasharray="2 1.4"/>
    <rect x="108" y="2.5" width="8" height="7" fill="#ff6a55"/>
    <circle cx="-163" cy="0" r="6" fill="none" stroke="#ffd23f" stroke-width="0.8"/>
    <g font-family="DM Mono, monospace" font-size="5.4" fill="#f2f7fb" text-anchor="middle">
      <text x="-123" y="2">SKYDOME</text><text x="-66" y="-14">POOL DECK</text><text x="11" y="2">GARDEN · DECK 8</text>
      <text x="78" y="22">COURT</text><text x="-7" y="-14">SURF</text><text x="7" y="27">MINI GOLF</text><text x="79" y="-16">SUN DECK</text><text x="124" y="-16">SPLASH SUMMIT</text><text x="-166" y="-9">BOW · DECK 6</text>
    </g>
    <circle cx="${P.z.toFixed(1)}" cy="${(-P.x).toFixed(1)}" r="3.4" fill="#ff6a55" stroke="#fff" stroke-width="1.2"/>
  </svg>`;
}
function portsSheet() {
  const cards = PORTS.map(P => {
    const here = G.port && G.port.id === P.id, been = (G.profile.ports || []).includes(P.id);
    return `<div class="port"><div><b>${esc(P.name)}</b><small>${esc(P.tag)}${been ? ' · visited' : ''}</small><p>${esc(P.blurb)}</p></div><button class="btn ${here ? 'btn-glass' : 'btn-primary'}" data-p="${P.id}" ${here ? 'disabled' : ''}>${here ? 'You are here' : 'Go ashore'}</button></div>`;
  }).join('');
  const open = portOpen() || G.port;
  sheet('Ports of call', G.port ? 'At anchor off ' + G.port.P.name + ' · All aboard at 18:00' : open ? 'Tenders run until 17:00 · All aboard at 18:00' : 'Tenders run from 07:00 to 17:00', cards + (G.port ? `<button class="btn btn-glass btn-wide" id="ptBack">Take the tender back to the ship</button>` : open ? '' : `<button class="btn btn-glass btn-wide" id="ptSkip">Rest until the tenders start (07:00)</button>`) + `<p class="kbd">Every port is a fictional island made for the Tileo Infinity.</p>`, body => {
    body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { sfx('tick'); goAshore(b.dataset.p); });
    const back = $('ptBack'); if (back) back.onclick = () => returnToShip();
    const sk = $('ptSkip'); if (sk) sk.onclick = () => { closeSheet(); const f = $('fade'); f.classList.add('on'); setTimeout(() => { setClock(PORT_OPEN); setTimeout(() => f.classList.remove('on'), 150); toast('Good morning', 'Tenders are running. Open Ports of call to go ashore.'); }, 380); };
  });
}
function mapSheet(o) {
  if (G.port) return portsSheet();
  const here = areaId(Player.pos);
  const zones = [['dome', 'Skydome', 'Deck 15 · Forward'], ['pool', 'Pool Deck', 'Deck 15 · Midship'], ['canyon', 'Canyon Walk', 'Deck 15 · Zipline'], ['garden', 'Garden Promenade', 'Deck 8 · Shops'],
  ['court', 'Sports Court', 'Deck 15 · Aft'], ['sundeck', 'Sun Deck', 'Deck 17 · Aft'], ['waterpark', 'Splash Summit', 'Deck 15 · Stern'], ['bow', 'Bow Lookout', 'Deck 6 · Forward'],
  ['surf', 'Wave Rider', 'Deck 15 · Surf simulator'], ['golf', 'Tileo Links', 'Deck 15 · Mini golf'], ['casino', 'Tileo Casino', 'Deck 6 · Aft'], ['suite', 'Your Suite', 'Deck 12 · Balcony']];
  const map = { aft: 'court', sun: 'sundeck', tower: 'waterpark' };
  const btns = zones.map(([id, n, d]) => `<button class="zone-b ${(map[here] || here) === id ? 'here' : ''}" data-z="${id}"><b>${n}</b><small>${d}</small></button>`).join('');
  sheet(o.elevator ? 'Elevator' : 'Ship map', o.elevator ? 'Choose a deck. You are on ' + areaLabel(here) : 'You are on ' + areaLabel(here) + '. Tap a deck to go there.', planSVG() + `<div class="zones">${btns}</div><button class="menu-item" id="mpPorts">Ports of call<small>${portOpen() ? 'Tenders running now · go ashore for the day' : 'Tenders run 07:00 to 17:00'}</small></button>`, body => {
    body.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { sfx('tick'); travelTo(b.dataset.z); });
    $('mpPorts').onclick = () => openSheet('ports');
  });
}
function passportSheet() {
  const got = new Set(G.profile.stamps), n = got.size;
  const cards = STAMPS.map(s => `<div class="stampc ${got.has(s.id) ? 'got' : ''}"><div class="ring">${SVG(IC[s.icon])}</div><b>${esc(s.name)}</b><small>${esc(s.hint)}</small></div>`).join('');
  sheet('Cruise passport', `${G.profile.name} · Cabin ${G.profile.cabin} · ${n} of ${STAMPS.length} stamps`, `<div class="prog"><b style="width:${n / STAMPS.length * 100}%"></b></div><div class="stamps">${cards}</div>`);
}
function barSheet(bar) {
  const items = DRINKS.map((d, i) => `<button class="drink" data-i="${i}"><span class="glass" style="background:linear-gradient(180deg, rgba(255,255,255,.25), ${d.color})"></span><span><b>${esc(d.name)}</b><small>${esc(d.desc)}</small></span><em>${d.price}</em></button>`).join('');
  sheet(bar, 'Drinks are included in every Tileo fare', items, body => body.querySelectorAll('[data-i]').forEach(b => b.onclick = () => serveDrink(DRINKS[+b.dataset.i], bar)));
}
function albumSheet() {
  const imgs = G.photos.length ? `<div class="photos">${G.photos.map(u => `<img src="${u}" alt="Photo from the Tileo Infinity">`).join('')}</div><p class="kbd">Press and hold a photo (or right-click it) to save it. The six newest stay in your album on this device.</p>` : `<div class="empty">No photos yet. Tap the camera button at the top to take one.</div>`;
  sheet('Photo album', `${G.photos.length} photo${G.photos.length === 1 ? '' : 's'}`, imgs);
}
function settingsSheet() {
  const q = G.qualityName, S = G.settings;
  const seg = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
  sheet('Settings', G.profile.name + ' · Cabin ' + G.profile.cabin, `
    <div class="row"><label>Graphics<small>Ultra adds sharper shadows and more passengers</small></label>${seg('sQ', [['battery', 'Battery'], ['high', 'High'], ['ultra', 'Ultra']], q)}</div>
    <div class="row"><label for="sMusic">Music</label><input type="range" id="sMusic" min="0" max="1" step="0.05" value="${S.music}"></div>
    <div class="row"><label>Ship radio<small>Your songs at the party venues</small></label>${seg('sRadio', [[1, 'On'], [0, 'Off']], S.radio === false ? 0 : 1)}</div>
    <div class="row"><label for="sSfx">Sound effects</label><input type="range" id="sSfx" min="0" max="1" step="0.05" value="${S.sfx}"></div>
    <div class="row"><label>Clock speed<small>Game minutes per real second</small></label>${seg('sClock', [[0.5, '½×'], [1, '1×'], [2, '2×']], Clock.rate)}</div>
    <button class="menu-item" id="sAlbum">Photo album<small>${G.photos.length} saved</small></button>
    <button class="menu-item" id="sRadioList">Tileo Radio<small>${SONGS.length} songs by djtileo</small></button>
    <button class="menu-item" id="sOutfit">Change outfit<small>Back to the dressing room</small></button>
    <button class="menu-item" id="sOut">Sign out<small>Return to the boarding pass</small></button>
    <p class="kbd">${IS_TOUCH ? 'Drag the left side to walk, drag the right side to look, pinch to zoom.' : 'WASD to walk · Shift to run · Space to jump · E to interact · F to eat or drink · Q for emotes · T to chat · M map · P program · C camera · drag to look · scroll to zoom'}</p>
    <p class="kbd">TILEO Cruise Lines and the Tileo Infinity are fictional. Your passenger profile is stored only in this browser.</p>`, body => {
    body.querySelectorAll('#sQ button').forEach(b => b.onclick = () => { S.quality = b.dataset.v; Store.set('settings', S); applyQuality(b.dataset.v); settingsSheet(); });
    body.querySelectorAll('#sClock button').forEach(b => b.onclick = () => { Clock.rate = +b.dataset.v; S.clock = Clock.rate; Store.set('settings', S); settingsSheet(); });
    $('sMusic').oninput = e => { S.music = +e.target.value; Audio.musicVol = S.music; Store.set('settings', S); };
    body.querySelectorAll('#sRadio button').forEach(b => b.onclick = () => { S.radio = b.dataset.v === '1'; Store.set('settings', S); radioEnable(S.radio); settingsSheet(); });
    $('sSfx').oninput = e => { S.sfx = +e.target.value; Audio.sfxVol = S.sfx; Store.set('settings', S); };
    $('sAlbum').onclick = () => openSheet('album'); $('sRadioList').onclick = () => openSheet('music');
    $('sOutfit').onclick = () => { closeSheet(); enterCreator(true); };
    $('sOut').onclick = () => { closeSheet(); saveProfile(); if (G.port) teardownPort(); leaveSuiteState(); showBoarding(); };
  });
}

/* ---------- boarding ---------- */
function showBoarding() {
  G.state = 'boarding'; $('hud').hidden = true; $('creator').hidden = true; $('boarding').hidden = false; $('photoUI').hidden = true;
  if (Player.activity) endActivity();
  closePanel();
  if (Player.char) Player.char.rig.root.visible = false;
  G.shadowExtent = 230;
  const pr = Store.get('profile', null);
  if (pr && pr.name) {
    $('passNew').hidden = true; $('passBack').hidden = false;
    $('backName').textContent = pr.name; $('bCabin').textContent = pr.cabin; $('bDeck').textContent = pr.cabin.slice(0, 2); $('bStamps').textContent = pr.stamps.length + ' / ' + STAMPS.length;
  } else {
    $('passNew').hidden = false; $('passBack').hidden = true;
    const cab = String(Math.floor(Math.random() * 7000) + 10000).slice(0, 5); $('pCabin').textContent = cab; $('pDeck').textContent = cab.slice(0, 2); G.pendingCabin = cab;
  }
}
function wireBoarding() {
  $('passForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('passName').value.trim();
    if (!name) { $('passName').focus(); $('passName').placeholder = 'Add your name to check in'; return; }
    audioInit(); sfx('tick');
    const pr = newProfile(name); pr.cabin = G.pendingCabin || pr.cabin; G.profile = pr; saveProfile();
    enterCreator(false);
  });
  $('continueBtn').onclick = () => {
    audioInit(); sfx('tick');
    G.profile = Object.assign(newProfile('Passenger'), Store.get('profile', {}));
    if (G.profile.clock) { Clock.min = G.profile.clock.min; Clock.day = G.profile.clock.day; }
    startPlay(false);
  };
  $('newPassBtn').onclick = () => { $('passNew').hidden = false; $('passBack').hidden = true; $('passName').value = ''; $('passName').focus(); const cab = String(Math.floor(Math.random() * 7000) + 10000).slice(0, 5); $('pCabin').textContent = cab; $('pDeck').textContent = cab.slice(0, 2); G.pendingCabin = cab; };
}

/* ---------- creator ---------- */
function buildStudio() {
  const s = new T.Scene(); G.studio = s;
  const bg = new T.Mesh(new T.SphereGeometry(40, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 a=vec3(0.006,0.03,0.07), b=vec3(0.02,0.16,0.2), c=vec3(0.18,0.06,0.05);
      vec3 col=mix(b,a,smoothstep(-0.1,0.6,h)); col+=c*smoothstep(0.2,-0.4,h)*0.6; gl_FragColor=vec4(col,1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`
  })); s.add(bg);
  const plat = new T.Mesh(cyl(1.25, 1.32, 0.16, 64), MAT.mosaicDark); plat.position.y = -0.08; plat.receiveShadow = true; s.add(plat);
  const ring = new T.Mesh(new T.TorusGeometry(1.3, 0.025, 8, 96), new T.MeshBasicMaterial({ color: lin('#2fd3c6') })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.0; s.add(ring);
  const floor = new T.Mesh(new T.CircleGeometry(12, 48), new T.MeshStandardMaterial({ color: lin('#0b1b33'), roughness: 0.6, metalness: 0.1, envMapIntensity: 0.12 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.16; floor.receiveShadow = true; s.add(floor);
  s.add(new T.HemisphereLight(lin('#cfe6ff'), lin('#1d2a3a'), 0.55));
  const key = new T.DirectionalLight(lin('#ffe2c4'), 2.2); key.position.set(2.5, 4, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera; sc.left = -2; sc.right = 2; sc.top = 3; sc.bottom = -1; sc.near = 0.5; sc.far = 12; key.shadow.bias = -0.0005; s.add(key);
  const rim = new T.DirectionalLight(lin('#7fd7ff'), 1.6); rim.position.set(-3, 2.5, -3); s.add(rim);
  const fill = new T.PointLight(lin('#ff8a6b'), 0.9, 8, 2); fill.position.set(-2, 0.6, 2); s.add(fill);
  G.studioCam = new T.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
  G.studioCam.position.set(0, 1.15, 5.6); G.studioCam.lookAt(0, 0.92, 0);
  G.creatorYaw = 0.35;
}
const CR_TABS = ['Body', 'Skin', 'Hair', 'Outfit', 'Extras'];
let crTab = 'Body';
function enterCreator(fromGame) {
  G.state = 'creator'; G.creatorFromGame = fromGame;
  $('boarding').hidden = true; $('hud').hidden = true; $('creator').hidden = false;
  if (!G.studio) buildStudio();
  G.studio.environment = Env.envRT ? Env.envRT.texture : null;
  if (G.crChar) G.studio.remove(G.crChar.rig.root);
  G.crChar = new Char(G.profile.app, { seed: 2 }); G.crChar.look = 0.4; buildCharMesh(G.crChar); G.studio.add(G.crChar.rig.root);
  $('boardBtn').textContent = fromGame ? 'Back to the ship' : 'Board the ship';
  renderCreator(); layoutCreator();
}
function layoutCreator() {
  const cam = G.studioCam; if (!cam) return;
  const w = innerWidth, h = innerHeight, side = (w >= 820 && w >= h) || (h <= 520 && w > h);
  const pw = side ? (w >= 820 ? 400 : Math.min(380, w * 0.52)) : 0;
  cam.aspect = w / h;
  if (side) { cam.setViewOffset(w, h, pw / 2, 0, w, h); cam.position.set(0, 1.12, 5.6); }
  else {
    const ph = Math.min(h * 0.54, 470), f = Math.max(0.3, 1 - ph / h);
    const vis = 2.05 / 0.95 / f, dist = vis / 2 / Math.tan(cam.fov * Math.PI / 360) / Math.min(1, w / h * 1.6);
    cam.setViewOffset(w, h, 0, h * (0.5 - f / 2) - 6, w, h); cam.position.set(0, 1.0, Math.min(14, Math.max(5.6, dist)));
  }
  cam.lookAt(0, 0.92, 0);
  cam.updateProjectionMatrix();
}
function renderCreator() {
  const app = G.profile.app;
  $('crTabs').innerHTML = CR_TABS.map(t => `<button class="tab" role="tab" aria-selected="${t === crTab}" data-t="${t}">${t}</button>`).join('');
  $('crTabs').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { crTab = b.dataset.t; sfx('tick'); renderCreator(); });
  const chips = (key, list, disabled) => `<div class="chips">${list.map((n, i) => `<button class="chip" data-k="${key}" data-v="${i}" aria-pressed="${app[key] === i}" ${disabled ? 'disabled style="opacity:.4"' : ''}>${n}</button>`).join('')}</div>`;
  const sw = (key, cols) => `<div class="swatches">${cols.map((c, i) => `<button class="sw" data-k="${key}" data-v="${i}" style="background:${c}" aria-pressed="${app[key] === i}" aria-label="Color ${i + 1}"></button>`).join('')}</div>`;
  let html = '';
  if (crTab === 'Body') html = `<div class="name-row"><input id="crName" maxlength="18" value="${esc(G.profile.name)}" aria-label="Passenger name"></div>
    <div class="opt-group"><h4>Build</h4>${chips('body', BODIES)}</div>
    <div class="opt-group"><h4>Height</h4><div class="chips">${[['0.95', 'Shorter'], ['1', 'Average'], ['1.05', 'Taller']].map(([v, l]) => `<button class="chip" data-k="height" data-v="${v}" aria-pressed="${Math.abs(app.height - +v) < 0.026}">${l}</button>`).join('')}</div></div>`;
  if (crTab === 'Skin') html = `<div class="opt-group"><h4>Skin tone</h4>${sw('skin', SKIN)}</div>`;
  if (crTab === 'Hair') html = `<div class="opt-group"><h4>Style</h4>${chips('hair', HAIR_STYLES)}</div><div class="opt-group"><h4>Color</h4>${sw('hairColor', HAIR_COLORS)}</div>`;
  if (crTab === 'Outfit') html = `<div class="opt-group"><h4>Top</h4>${chips('top', TOPS)}</div><div class="opt-group"><h4>Top color</h4>${sw('topColor', OUTFIT)}</div>
    <div class="opt-group"><h4>Bottoms</h4>${chips('bottom', BOTTOMS, app.top === 4)}</div><div class="opt-group"><h4>Bottoms color</h4>${sw('bottomColor', OUTFIT)}</div><div class="opt-group"><h4>Shoes</h4>${sw('shoes', SHOE_COLORS)}</div>`;
  if (crTab === 'Extras') html = `<div class="opt-group"><h4>Accessory</h4>${chips('acc', ACCS)}</div><div class="opt-group"><h4>Accessory color</h4>${sw('accColor', ACC_COLORS)}</div>`;
  $('crBody').innerHTML = html;
  $('crBody').querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k; app[k] = k === 'height' ? +b.dataset.v : +b.dataset.v;
    if (k === 'top' && app.top === 4) app.bottom = 3;
    sfx('tick'); refreshCreatorChar(); renderCreator();
  });
  const nm = $('crName'); if (nm) nm.oninput = () => { G.profile.name = nm.value.trim() || G.profile.name; };
}
function refreshCreatorChar() {
  const old = G.crChar; const c = new Char(G.profile.app, { seed: 2 }); c.p = old.p; c.anim = 'idle'; buildCharMesh(c);
  G.studio.remove(old.rig.root); G.studio.add(c.rig.root); G.crChar = c;
  c.setAnim('wave'); setTimeout(() => { if (G.crChar === c) c.setAnim('idle'); }, 1300);
}
function wireCreator() {
  $('randBtn').onclick = () => { const keepH = G.profile.app; G.profile.app = randomAppearance(); sfx('tick'); refreshCreatorChar(); renderCreator(); };
  $('boardBtn').onclick = () => { sfx('tick'); saveProfile(); startPlay(!G.creatorFromGame); };
}

/* ---------- start play ---------- */
function startPlay(fresh) {
  $('boarding').hidden = true; $('creator').hidden = true; $('hud').hidden = false;
  const f = $('fade'); f.classList.add('on');
  setTimeout(() => {
    initPlayer(G.profile.app); Player.char.rig.root.visible = true; Food.held = null; updateEatBtn();
    showSuite(myLayout()); Net.cabinDirty = true;
    const snap = G.restore; G.restore = null;
    if (snap && snap.pos) placePlayer(snap.pos[0], snap.pos[1], snap.pos[2], snap.yaw || 0);
    else if (G.creatorFromGame && G.lastPos) placePlayer(G.lastPos.x, G.lastPos.y, G.lastPos.z, Player.yaw);
    else { const s = World.zones.pool.spawn; placePlayer(s[0], s[1], s[2], s[3]); }
    G.creatorFromGame = false;
    G.state = 'play'; G.shadowExtent = 42;
    updateBadge(); updateMeters();
    setTimeout(() => f.classList.remove('on'), 200);
    if (fresh) { setTimeout(() => { sfx('horn'); stamp('aboard'); }, 700); }
    const hint = $('joyHint'); hint.textContent = IS_TOUCH ? 'Drag on the left to walk · drag on the right to look' : 'WASD to walk · Shift to run · E to interact · drag to look'; hint.hidden = false;
    setTimeout(() => hint.hidden = true, 12000);
  }, 420);
}

/* ---------- HUD per frame ---------- */
let hudT = 0;
function updateHUD(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.25;
  $('clockTime').textContent = fmtTime(Clock.min);
  $('clockDay').textContent = `Day ${Clock.day} · ${Env.night > 0.5 ? 'Night at sea' : Env.golden > 0.4 ? 'Golden hour' : 'At sea'}`;
  const icon = Env.night > 0.5 ? 'moon' : 'sun';
  if ($('clockIcon').dataset.i !== icon) { $('clockIcon').innerHTML = IC[icon]; $('clockIcon').dataset.i = icon; }
  const area = areaId(Player.pos); $('locLabel').textContent = areaLabel(area);
  const ev = liveEvent(); const lb = $('liveBanner');
  if (ev) { lb.hidden = false; $('liveText').innerHTML = `<b>Live · ${esc(ev.name)}</b> · ${esc(ev.where)}`; lb.dataset.zone = ev.zone; }
  else lb.hidden = true;
  trackVisit();
  G.saveT = (G.saveT || 0) + 0.25; if (G.saveT > 20) { G.saveT = 0; saveProfile(); }
}
function wireHUD() {
  $('btnProgram').innerHTML = SVG(IC.program); $('btnMap').innerHTML = SVG(IC.map) + $('btnMap').innerHTML; $('btnPassport').innerHTML = SVG(IC.passport) + $('btnPassport').innerHTML;
  $('btnPeople').innerHTML = SVG(IC.people) + $('btnPeople').innerHTML; $('btnMenu').innerHTML = SVG(IC.gear);
  $('mFullI').innerHTML = SVG(IC.fork); $('mHydI').innerHTML = SVG(IC.drop);
  $('btnPeople').onclick = () => openSheet('people');
  $('eatBtn').addEventListener('pointerdown', e => { e.preventDefault(); consume(); });
  $('sbDecor').onclick = () => { sfx('tick'); startDecorate(); }; $('sbRoom').onclick = () => openMenu('room'); $('sbMusic').onclick = () => openMusic('suite'); $('jumpBtn').innerHTML = SVG(IC.jump, 2.4); $('emoteBtn').innerHTML = SVG(IC.smile);
  $('btnProgram').onclick = () => openSheet('program'); $('btnMap').onclick = () => openSheet('map'); $('btnPassport').onclick = () => openSheet('passport');
  $('btnMenu').onclick = () => openSheet('settings');
  $('jumpBtn').addEventListener('pointerdown', e => { e.preventDefault(); onJumpPressed(); });
  $('actBtn').addEventListener('pointerdown', e => { e.preventDefault(); onActionPressed(); });
  $('emoteBtn').onclick = () => { sfx('tick'); toggleEmotes(); };
  $('liveGo').onclick = () => { const z = $('liveBanner').dataset.zone; if (z) travelTo(z); };
  $('shutter').onclick = takePhoto; $('photoDone').onclick = exitPhoto; $('photoPose').onclick = () => { sfx('tick'); cyclePhotoPose(); };
}

/* ---------- loop ---------- */
let lastNow = 0, perfAcc = 0, perfN = 0, perfT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (now - (lastNow || now)) / 1000)); lastNow = now;
  if (G.testHold) return;
  stepFrame(dt);
}
function stepFrame(dt, noRender) {
  G.dt = dt; G.time += dt; G.frame++;
  if (G.state === 'loading') return;
  G.shipSpeed = G.port ? 0 : damp(G.shipSpeed === undefined ? 1 : G.shipSpeed, 1, 0.4, dt);
  Env.travel += dt * 11.5 * G.shipSpeed;
  try {
    if (G.state === 'boarding') {
      const a = G.time * 0.035 + 2.2, R = 430;
      G.camera.position.set(Math.sin(a) * R, 95 + Math.sin(G.time * 0.05) * 12, Math.cos(a) * R + 20);
      G.camera.lookAt(0, 34, 10); if (G.camera.near !== 1.5) { G.camera.near = 1.5; G.camera.updateProjectionMatrix(); }
      if (G.camera.fov !== 42) { G.camera.fov = 42; G.camera.updateProjectionMatrix(); }
      updateEnvironment(dt, Clock.min, V3(0, 40, 0)); updateFX(dt);
      G.crowd.sync();
      if (!noRender) renderFrame(G.scene, G.camera);
    } else if (G.state === 'creator') {
      G.creatorYaw -= Input.camDX * 0.012; Input.camDX = 0; Input.camDY = 0;
      G.creatorYaw += dt * 0.12;
      const c = G.crChar; c.rig.root.rotation.y = G.creatorYaw; c.update(dt, G.time);
      if (!noRender) renderFrame(G.studio, G.studioCam);
    } else {
      updateEvents(dt);
      if (G.state === 'play') { updatePlayer(dt); if (G.frame % 5 === 0) scanHotspots(); }
      else { Player.char.update(dt, G.time); syncPlayerRig(0); }
      updateNPCs(dt); updateRemotes(dt); netSend(dt);
      updateCamera(dt);
      updateEnvironment(dt, Clock.min, Player.pos);
      updateHUD(dt); updateBubbles(dt);
      G.lastPos = Player.pos.clone();
      if (!noRender) renderFrame(G.scene, G.camera);
    }
    updateAudio(dt);
  } catch (err) { console.error(err); }
  // adaptive resolution
  perfAcc += dt; perfN++; perfT += dt;
  if (perfT > 3) {
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0; perfT = 0;
    if (avg > 0.042 && (G.prScale || 1) > 0.6 && G.state !== 'loading') { G.prScale = (G.prScale || 1) - 0.15; G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, G.quality.pr * G.prScale)); onResize(); }
  }
}

/* ---------- boot ---------- */
function setLoad(p, msg) { $('loadBar').style.width = Math.round(p * 100) + '%'; $('loadMsg').textContent = msg; }
const tick = () => new Promise(r => setTimeout(r, 16));
async function boot(restore) {
  if (typeof THREE === 'undefined' || !T.Sky) {
    $('loadErr').hidden = false; $('loadErr').textContent = 'The 3D engine could not load. Check your connection and reload the page.'; return;
  }
  try {
    G.settings = Object.assign({ quality: IS_TOUCH ? 'high' : 'ultra', music: 0.7, sfx: 0.9, clock: 1 }, Store.get('settings', {}));
    Audio.musicVol = G.settings.music; Audio.sfxVol = G.settings.sfx; Clock.rate = G.settings.clock || 1; Radio.enabled = G.settings.radio !== false;
    Clock.min = 17 * 60 + 45;
    G.photos = Store.get('photos', []) || [];
    setLoad(0.05, 'Starting the engines');
    initRenderer(); G.quality = QUALITY[G.settings.quality] || QUALITY.high; G.qualityName = G.settings.quality;
    await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]);
    setLoad(0.15, 'Painting the hull'); await tick();
    buildTextures(); buildMaterials();
    setLoad(0.3, 'Filling the ocean'); await tick();
    initEnvironment();
    setLoad(0.45, 'Building twenty decks'); await tick();
    buildShip();
    setLoad(0.75, 'Welcoming passengers'); await tick();
    initNPCs(); initFX(); initInput(); wireHUD(); wireBoarding(); wireCreator();
    initNet();
    applyQuality(G.qualityName);
    setLoad(0.92, 'Chilling the drinks'); await tick();
    G.shadowExtent = 230;
    updateEnvironment(0.016, Clock.min, V3(0, 40, 0)); refreshEnvMap();
    renderFrame(G.scene, G.camera);
    window.addEventListener('resize', () => { onResize(); layoutCreator(); });
    onResize();
    setLoad(1, 'All aboard');
    $('loading').style.transition = 'opacity .6s'; $('loading').style.opacity = '0'; setTimeout(() => $('loading').hidden = true, 650);
    if (restore && restore.state === 'play' && Store.get('profile', null)) {
      G.profile = Object.assign(newProfile('Passenger'), Store.get('profile', {}));
      if (restore.clock) { Clock.min = restore.clock; Clock.day = restore.day || 1; }
      G.restore = restore; G.state = 'boarding'; startPlay(false);
    } else showBoarding();
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ state: G.state === 'photo' ? 'play' : G.state, clock: Clock.min, day: Clock.day, pos: Player.pos.toArray(), yaw: Player.yaw }));
  } catch (err) {
    console.error(err);
    $('loadErr').hidden = false; $('loadErr').textContent = 'Something went wrong while building the ship: ' + err.message;
  }
}
window.TILEO_DEBUG = { G, World, Env, Player, Clock, NPCS, Audio, Cam, T, Input, setClock, travelTo, applyQuality, actSlide, actZip, actHoops, actDance, enterPhoto, takePhoto, openSheet, startPlay, stamp, onActionPressed, scanHotspots,
  goAshore, returnToShip, enterSuite, startDecorate, openSlots, openBlackjack, openRoulette, startTrivia, answerTrivia, actSurf, actGolf, consume, giveFood, openMenu, Net, Radio, Suite, Food, Trivia, GOLF, PORTS, closePanel, endActivity, netSay, readRemote, myLayout, showSuite,
  sim(n, dt = 1 / 30) { for (let i = 0; i < n; i++) stepFrame(dt, true); return Player.pos.toArray().map(v => +v.toFixed(2)); },
  render() { stepFrame(1 / 60); } };
requestAnimationFrame(loop);
const _hot = window.claude && window.claude.hot;
if (_hot && _hot.ready) _hot.ready(boot); else boot(_hot && _hot.data ? _hot.data : {});

})();
