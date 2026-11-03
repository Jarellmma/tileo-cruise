// Quality tiers: auto-detected from the GPU / device, overridable (?q=low|med|high or the in-game Settings selector)
export const TIERS = {
  low:  { id: 'low', name: 'Low',  pr: 1.0,  prMin: 0.6,  shadow: 0,    bloom: false, msaa: 0, far: 1150, water: false, mirror: false, pools: false, beams: true, tex: 256, env: false, chars: [9, 32, 8], ao: 0, people: 4, texRes: 512 },
  med:  { id: 'med', name: 'Med',  pr: 1.35, prMin: 0.75, shadow: 1024, bloom: true,  msaa: 2, far: 1700, water: false, mirror: false, pools: true,  beams: true, tex: 512, chars: [18, 55, 12], ao: 8, people: 12, texRes: 1024 },
  high: { id: 'high', name: 'High', pr: 2.0,  prMin: 1.0,  shadow: 2048, bloom: true,  msaa: 4, far: 2600, water: true,  mirror: true,  pools: true,  beams: true, tex: 1024, chars: [30, 85, 20], ao: 12, people: 24, texRes: 1024 },
};
export const isTouch = typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
export function gpuInfo() {
  try { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info'); return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { return 'unknown'; }
}
export function detectTier(gpu = gpuInfo()) {
  const s = gpu.toLowerCase(), mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (/swiftshader|llvmpipe|software|basic render/.test(s)) return 'low';
  if (!isTouch) return /intel/.test(s) && !/arc|iris xe/.test(s) ? 'med' : 'high';
  if (/apple/.test(s)) return (Math.min(screen.width, screen.height) >= 390 && cores >= 6) ? 'med' : 'low';
  if (mem <= 3 || cores <= 4) return 'low';
  const adreno = s.match(/adreno[^0-9]*(\d{3})/); if (adreno && +adreno[1] >= 650 && mem >= 6) return 'med';
  if (/mali-g(7[1-9]|[89]\d|\d{3})|immortalis/.test(s) && mem >= 6) return 'med';
  return 'med';
}
const KEY = 'tileoKingdom.quality';
export const Q = { mode: 'auto', tier: TIERS.med, key: 'med', auto: 'med', gpu: '' };
export function initQuality() {
  Q.gpu = gpuInfo(); Q.auto = detectTier(Q.gpu);
  const url = new URLSearchParams(location.search).get('q'); let m = url || localStorage.getItem(KEY) || 'auto';
  if (!['auto', 'low', 'med', 'high'].includes(m)) m = 'auto'; setMode(m, false); return Q;
}
export function setMode(m, persist = true) { Q.mode = m; Q.key = m === 'auto' ? Q.auto : m; Q.tier = TIERS[Q.key]; if (persist) try { localStorage.setItem(KEY, m); } catch (e) {} return Q; }
