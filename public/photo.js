// TILEO KINGDOM v5: Photo mode (usable anywhere) + an on-device gallery.
// Rear camera: first-person from your avatar's eyes. Selfie: the front camera frames your avatar and the scene behind it, with the arm out.
// Filters: none / warm / B&W / neon. Watermark: DJ Tileo, resort logo, or off. The HUD hides while you shoot. Shutter flash + sound.
// Save uses canvas.toBlob + navigator.share (files) with a download fallback. The gallery lives in IndexedDB (cap 24) with a localStorage fallback.
import * as THREE from 'three';
import { LOGOS } from './core.js?v=1793692130';
import { rigBones } from './characters.js?v=1793692130';

export const FILTERS = {
  none: { n: 'None', css: '' },
  warm: { n: 'Warm', css: 'sepia(0.28) saturate(1.3) brightness(1.04)' },
  bw: { n: 'B&W', css: 'grayscale(1) contrast(1.15)' },
  neon: { n: 'Neon', css: 'saturate(1.8) contrast(1.15) hue-rotate(-12deg)' } };
const MARKS = ['dj', 'resort', 'off'], MARKN = { dj: 'DJ Tileo', resort: 'Resort logo', off: 'No logo' };
const CAP = 24, LS_KEY = 'tileoKingdom.photos', LS_CAP = 6;
const logoImg = {}; for (const k of ['dj', 'resort']) { const i = new Image(); i.src = LOGOS[k].src; logoImg[k] = i; }

// ---------------- storage ----------------
const store = {
  db: null, ready: null, mode: 'idb',
  open() { return this.ready || (this.ready = new Promise(res => { try { const r = indexedDB.open('tileoKingdom.photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('shots', { keyPath: 'id', autoIncrement: true }); r.onsuccess = () => { this.db = r.result; res(true); }; r.onerror = () => { this.mode = 'ls'; res(false); }; } catch (e) { this.mode = 'ls'; res(false); } })); },
  tx(m) { return this.db.transaction('shots', m).objectStore('shots'); },
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async all() { await this.open(); if (this.mode === 'ls') { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]').map(x => ({ ...x, blob: dataToBlob(x.data) })).reverse(); } catch (e) { return []; } }
    const a = await this.req(this.tx('readonly').getAll()); return a.sort((x, y) => y.id - x.id); },
  async add(rec) { await this.open(); if (this.mode === 'ls') return this.addLS(rec);
    try { await this.req(this.tx('readwrite').add(rec)); const a = await this.all(); for (const old of a.slice(CAP)) await this.req(this.tx('readwrite').delete(old.id)); return Math.min(a.length, CAP); }
    catch (e) { this.mode = 'ls'; return this.addLS(rec); } },
  async addLS(rec) { const small = await shrink(rec.blob, 900, 0.72); let a = []; try { a = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { }
    a.push({ id: Date.now(), t: rec.t, place: rec.place, filter: rec.filter, data: small }); while (a.length > LS_CAP) a.shift();
    for (;;) { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); break; } catch (e) { if (a.length <= 1) break; a.shift(); } } return a.length; },
  async del(id) { await this.open(); if (this.mode === 'ls') { let a = []; try { a = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { } localStorage.setItem(LS_KEY, JSON.stringify(a.filter(x => x.id !== id))); return; }
    await this.req(this.tx('readwrite').delete(id)); } };
function dataToBlob(d) { const [h, b] = d.split(','); const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: h.slice(5, h.indexOf(';')) }); }
function shrink(blob, max, q) { return new Promise(res => { const img = new Image(), url = URL.createObjectURL(blob); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q)); }; img.onerror = () => res(''); img.src = url; }); }

// manual filters for browsers without ctx.filter (Safari)
function pixelFilter(ctx, w, h, f) { const d = ctx.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) { let r = p[i], g = p[i + 1], b = p[i + 2]; const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (f === 'bw') { const v = (l - 128) * 1.15 + 128; r = g = b = v; }
    else if (f === 'warm') { r = l + (r - l) * 1.3; g = l + (g - l) * 1.3; b = l + (b - l) * 1.3; r = r * 1.07 + 10; g = g * 1.01 + 4; b = b * 0.86; }
    else if (f === 'neon') { r = l + (r - l) * 1.8; g = l + (g - l) * 1.8; b = l + (b - l) * 1.8; r = (r - 128) * 1.15 + 128 + 6; g = (g - 128) * 1.15 + 128 - 4; b = (b - 128) * 1.15 + 128 + 12; }
    p[i] = r; p[i + 1] = g; p[i + 2] = b; } ctx.putImageData(d, 0, 0); }
let ac = null; function shutterSound() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime, n = ac.sampleRate * 0.12, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) { const e = i < n * 0.25 ? 1 : Math.pow(1 - (i - n * 0.25) / (n * 0.75), 3); d[i] = (Math.random() * 2 - 1) * e * (i > n * 0.42 && i < n * 0.5 ? 0.3 : 1); }
  const s = ac.createBufferSource(); s.buffer = buf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800; const g = ac.createGain(); g.gain.value = 0.35; s.connect(f).connect(g).connect(ac.destination); s.start(t); } catch (e) { } }
export async function savePhoto(blob, name) { const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { await navigator.share({ files: [file], title: 'TILEO KINGDOM', text: 'Snapped at TILEO KINGDOM · Strip Life' }); return 'shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return 'downloaded'; }

export function initPhoto(C) {
  const $ = C.$, st = { on: false, mode: 'rear', filter: 'none', mark: 'dj', yaw: 0, pitch: 0, fov: 62, arm: 1.0, sy: 0, sp: 0.12, pending: false, last: null, count: 0, shots: 0, busy: false };
  const prefs = C.prefs; if (prefs.photo) Object.assign(st, { filter: prefs.photo.filter || 'none', mark: prefs.photo.mark || 'dj' });
  const canvasEl = () => C.renderer.domElement;
  const head = new THREE.Vector3(), tmp = new THREE.Vector3(), tgt = new THREE.Vector3();
  function headPos(out) { const b = rigBones(C.player); if (b && b.Head) { b.Head.getWorldPosition(out); out.y += 0.07; return out; } const p = C.player.position; return out.set(p.x, p.y + (C.state.limo && !C.state.limo.stand ? 1.15 : 1.62), p.z); }
  function open(mode) { if (!C.state.started) return; if (C.state.cine) return C.toast('📸 Hold on, the elevator is moving.'); if (C.state.ui === 'binoc') C.closeUI();
    C.closeUI(); st.on = true; if (mode) st.mode = mode; C.showUI('photo'); document.body.classList.add('photoMode'); C.player.updateMatrixWorld(true);
    const d = C.camera.getWorldDirection(tmp); st.yaw = Math.atan2(-d.x, -d.z); st.pitch = Math.max(-1.2, Math.min(1.2, -Math.asin(d.y))) * 0.5; st.fov = 62;
    st.sy = C.player.rotation.y - 0.35; st.sp = 0.1; st.arm = C.state.limo && !C.state.limo.stand ? 0.85 : 1.05; applyFilterPreview(); ui(); store.open().then(refreshThumb); }
  function close() { st.on = false; document.body.classList.remove('photoMode'); canvasEl().style.filter = ''; C.camera.fov = 62; C.camera.updateProjectionMatrix(); C.player.visible = true; }
  function setMode(m) { st.mode = m || (st.mode === 'rear' ? 'selfie' : 'rear'); if (st.mode === 'selfie') { st.sy = C.player.rotation.y - 0.35; st.sp = 0.1; } ui(); }
  function setFilter(f) { st.filter = FILTERS[f] ? f : 'none'; prefs.photo = { filter: st.filter, mark: st.mark }; C.savePrefs(); applyFilterPreview(); ui(); }
  function cycleMark() { st.mark = MARKS[(MARKS.indexOf(st.mark) + 1) % MARKS.length]; prefs.photo = { filter: st.filter, mark: st.mark }; C.savePrefs(); ui(); }
  function applyFilterPreview() { canvasEl().style.filter = st.on ? FILTERS[st.filter].css : ''; }
  function ui() { $('phRear').classList.toggle('on', st.mode === 'rear'); $('phSelfie').classList.toggle('on', st.mode === 'selfie');
    document.querySelectorAll('#phFilters button').forEach(b => b.classList.toggle('on', b.dataset.f === st.filter));
    $('phMark').innerHTML = st.mark === 'off' ? '🚫 No logo' : `<img src="${LOGOS[st.mark].src}" alt=""> ${MARKN[st.mark]}`;
    $('phPrev').src = st.mark === 'off' ? 'data:,' : LOGOS[st.mark].src; $('phPrev').style.display = st.mark === 'off' ? 'none' : '';
    $('phPlace').textContent = place(); }
  function place() { const s = C.state; if (s.limo) return 'Stretch limo · The Strip'; const A = s.area; if (A.id === 'strip') { const lm = nearestLm(); return lm ? lm + ' · Las Vegas Strip' : 'Las Vegas Strip'; } return A.label.split('·').slice(0, 2).join('·').trim(); }
  function nearestLm() { const A = C.areas.strip, p = C.player.position; let best = null, bd = 90; for (const l of A.landmarks) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < bd) { bd = d; best = l.name; } } return best; }
  // camera override
  function camera(dt) { if (!st.on) return false; const cam = C.camera; headPos(head);
    if (st.mode === 'rear') { C.player.visible = false; cam.position.copy(head); tgt.set(-Math.sin(st.yaw) * Math.cos(st.pitch), -Math.sin(st.pitch), -Math.cos(st.yaw) * Math.cos(st.pitch)).add(head); cam.lookAt(tgt); if (cam.fov !== st.fov) { cam.fov = st.fov; cam.updateProjectionMatrix(); } }
    else { C.player.visible = true; const r = st.arm; cam.position.set(head.x + Math.sin(st.sy) * Math.cos(st.sp) * r, head.y + Math.sin(st.sp) * r, head.z + Math.cos(st.sy) * Math.cos(st.sp) * r);
      if (C.state.area.floorY !== undefined || C.state.area.id === 'strip') cam.position.y = Math.max(cam.position.y, (C.state.area.floorY || 0) + 0.3);
      tgt.copy(head); tgt.y -= 0.12; cam.lookAt(tgt); if (cam.fov !== 70) { cam.fov = 70; cam.updateProjectionMatrix(); } }
    C.CHAR.camPos.copy(cam.position); return true; }
  // arm-out pose for selfies (runs after the animation mixer)
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qp = new THREE.Quaternion(), a = new THREE.Vector3(), c = new THREE.Vector3(), want = new THREE.Vector3(), cur = new THREE.Vector3(), aim = new THREE.Vector3();
  function aimBone(bone, child, target) { if (!bone || !child || !bone.parent) return; bone.updateWorldMatrix(true, true); bone.getWorldPosition(a); child.getWorldPosition(c);
    cur.subVectors(c, a).normalize(); want.subVectors(target, a).normalize(); q1.setFromUnitVectors(cur, want); bone.getWorldQuaternion(q2); bone.parent.getWorldQuaternion(qp);
    bone.quaternion.copy(qp.invert().multiply(q1.multiply(q2))); bone.updateWorldMatrix(false, true); }
  function pose() { if (!st.on || st.mode !== 'selfie') return; const b = rigBones(C.player); if (!b) return; const ua = b.upperarm_r || b.UpperArm_R || b['upperarm_r'], la = b.lowerarm_r, hd = b.hand_r; if (!ua || !la || !hd) return;
    C.player.updateMatrixWorld(true); const cam = C.camera; headPos(head);
    // the hand holds the "phone" just below and beside the lens so it stays mostly out of frame
    const fwd = tmp.subVectors(cam.position, head).normalize(), side = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    aim.copy(cam.position).addScaledVector(fwd, -0.12).addScaledVector(side, 0.22); aim.y -= 0.22;
    aimBone(ua, la, aim); aimBone(la, hd, aim); }
  function drag(dx, dy) { if (st.mode === 'rear') { const k = 0.005 * st.fov / 62; st.yaw -= dx * k; st.pitch = Math.max(-1.3, Math.min(1.3, st.pitch + dy * k)); }
    else { st.sy -= dx * 0.008; st.sp = Math.max(-0.5, Math.min(0.9, st.sp + dy * 0.005)); } }
  function zoom(d) { if (st.mode === 'rear') st.fov = Math.max(20, Math.min(80, st.fov * (d > 0 ? 1.1 : 0.9))); else st.arm = Math.max(0.6, Math.min(2.2, st.arm * (d > 0 ? 1.1 : 0.9))); }
  // shutter
  function shoot() { if (!st.on || st.pending || st.busy) return; st.pending = true; }
  function afterRender() { if (!st.pending) return; st.pending = false; st.busy = true; const src = canvasEl(); let w = src.width, h = src.height; const s = Math.min(1, 2400 / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
    const out = document.createElement('canvas'); out.width = w; out.height = h; const x = out.getContext('2d'); const css = FILTERS[st.filter].css;
    let usedCtx = false; if (css && typeof x.filter === 'string') { x.filter = css; usedCtx = x.filter === css; }
    x.drawImage(src, 0, 0, w, h); x.filter = 'none'; if (css && !usedCtx) pixelFilter(x, w, h, st.filter);
    // watermark
    const u = Math.max(w, h) / 1000; if (st.mark !== 'off') { const im = logoImg[st.mark]; if (im.complete && im.naturalWidth) { const lh = h * 0.15, lw = lh * im.naturalWidth / im.naturalHeight; x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 10 * u; x.globalAlpha = 0.92; x.drawImage(im, w - lw - 18 * u, h - lh - 16 * u, lw, lh); x.restore(); } }
    x.save(); x.font = `600 ${Math.round(15 * u)}px system-ui,sans-serif`; x.fillStyle = 'rgba(255,214,120,.95)'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 6 * u; x.textBaseline = 'bottom';
    x.fillText(`TILEO KINGDOM · ${place()}`, 18 * u, h - 16 * u); x.restore();
    flash(); shutterSound();
    out.toBlob(async blob => { st.busy = false; if (!blob) return C.toast('📸 Could not capture the photo on this device.'); st.last = blob; st.shots++;
      const rec = { t: Date.now(), place: place(), filter: st.filter, mode: st.mode, blob }; const n = await store.add(rec); st.count = n; refreshThumb(); C.toast(`📸 Saved to your Gallery (${n}/${store.mode === 'ls' ? LS_CAP : CAP})`); }, 'image/jpeg', 0.9); }
  function flash() { const f = $('photoFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  let thumbURL = null; async function refreshThumb() { const a = await store.all(); st.count = a.length; const im = $('phThumb'); if (thumbURL) URL.revokeObjectURL(thumbURL); thumbURL = null;
    if (a[0] && a[0].blob) { thumbURL = URL.createObjectURL(a[0].blob); im.src = thumbURL; im.style.display = ''; } else im.style.display = 'none'; $('phCount').textContent = a.length ? a.length : ''; }
  async function saveLast() { if (!st.last) return C.toast('📸 Take a photo first.'); const r = await savePhoto(st.last, fileName()); C.toast(r === 'shared' ? '📤 Shared!' : r === 'downloaded' ? '⬇️ Photo downloaded' : 'Cancelled'); }
  const fileName = (t = Date.now()) => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return `tileo-kingdom-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}.jpg`; };
  // gallery
  let urls = [], items = [], viewing = null;
  async function openGallery() { if (st.on) { close(); } C.closeUI(); C.showUI('gallery'); const grid = $('galGrid'); grid.innerHTML = '<p class="fine">Loading…</p>'; items = await store.all(); urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    $('galInfo').textContent = `${items.length}/${store.mode === 'ls' ? LS_CAP : CAP} photos · stored only on this device${store.mode === 'ls' ? ' (compact mode)' : ''}`;
    grid.innerHTML = items.length ? '' : '<p class="galEmpty">No photos yet. Tap 📸 to take your first shot.</p>';
    items.forEach((it, i) => { const u = URL.createObjectURL(it.blob); urls.push(u); const b = document.createElement('button'); b.innerHTML = `<img src="${u}" alt="">`; b.title = it.place || ''; b.onclick = () => view(i); grid.appendChild(b); }); }
  function view(i) { const it = items[i]; if (!it) return; viewing = it; C.closeUI(); C.showUI('photoView'); $('pvImg').src = urls[i]; $('pvMeta').textContent = `${it.place || 'TILEO KINGDOM'} · ${new Date(it.t).toLocaleString()} · ${FILTERS[it.filter] ? FILTERS[it.filter].n : ''}`; }
  async function pvSave() { if (!viewing) return; const r = await savePhoto(viewing.blob, fileName(viewing.t)); C.toast(r === 'shared' ? '📤 Shared!' : r === 'downloaded' ? '⬇️ Photo downloaded' : 'Cancelled'); }
  async function pvDel() { if (!viewing) return; await store.del(viewing.id); viewing = null; C.toast('🗑️ Photo deleted'); openGallery(); }
  // wiring
  $('phClose').onclick = () => C.closeUI(); $('phShutter').onclick = shoot; $('phRear').onclick = () => setMode('rear'); $('phSelfie').onclick = () => setMode('selfie'); $('phFlip').onclick = () => setMode();
  $('phMark').onclick = cycleMark; $('phGallery').onclick = openGallery; $('phSave').onclick = saveLast; $('phZin').onclick = () => zoom(-1); $('phZout').onclick = () => zoom(1);
  document.querySelectorAll('#phFilters button').forEach(b => b.onclick = () => setFilter(b.dataset.f));
  $('galNew').onclick = () => open(); $('pvSave').onclick = pvSave; $('pvDel').onclick = pvDel; $('pvBack').onclick = openGallery;
  $('photo').addEventListener('pointerdown', e => { if (e.target.closest('button')) e.stopPropagation(); });
  function key(e) { const k = e.code; if (k === 'Space' || k === 'Enter') { e.preventDefault(); shoot(); return true; } if (k === 'KeyF') { setMode(); return true; } if (k === 'KeyW') { cycleMark(); return true; }
    if (k === 'KeyG') { openGallery(); return true; } if (k === 'KeyC') { C.closeUI(); return true; } const n = { Digit1: 'none', Digit2: 'warm', Digit3: 'bw', Digit4: 'neon' }[k]; if (n) { setFilter(n); return true; } return false; }
  return { st, open, close, setMode, setFilter, cycleMark, camera, pose, drag, zoom, shoot, afterRender, openGallery, saveLast, key, store, view, galleryCount: async () => (await store.all()).length };
}
