// Rendering pipeline.
// Classic look: ACES + sRGB, gradient sky, one sun shadow, bloom (the original v5 look, still used on Low).
// Next-Gen look (default on Med/High): physically based sky (Preetham scattering + clouds) by day and at sunset,
// image-based lighting from that same sky with a city skyline around it, soft PCF sun shadows, contact shadows
// (screen-space ambient occlusion from the main depth buffer, no extra scene render), bloom that leaves the sky out,
// a filmic grade (ACES, lifted shadows, warm highlights, vignette, grain, slight lens fringing), a sun glare that
// hides when the sun is behind buildings, SMAA when MSAA is off, and depth of field in photo mode.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { BokehShader } from 'three/addons/shaders/BokehShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Q } from './quality.js?v=1793745796';

const C = h => new THREE.Color(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// pre: Preetham sky (turbidity, rayleigh, mie, mieG, gain, clouds); ng: Next-Gen grade (exposure, warm, sat, vignette) and light balance
export const TOD = {
  day: { top: C(0x2f6fd0), mid: C(0x7fb2ea), hor: C(0xdfe9f2), ground: C(0xc9b89a), sun: V(-0.45, 0.78, 0.43), sunCol: C(0xfff1dc), sunI: 2.7, sunSize: 0.9995,
    hemiS: C(0xcfe4ff), hemiG: C(0x8a7458), hemiI: 0.75, fog: C(0xcadbe8), glow: C(0xffffff), glowA: 0, cloud: C(0xffffff), cloudA: 0.55, exp: 0.92, mount: C(0x9a8a90), stars: 0, envI: 1.0, bloom: [0.14, 0.35, 1.6],
    pre: { turb: 2.6, ray: 1.15, mie: 0.0045, mieG: 0.82, gain: 0.38, clouds: 0.18 }, ng: { exp: 0.82, warm: 0.035, sat: 1.07, vig: 0.22, sunI: 3.0, sunCol: C(0xfff3e2), hemiI: 0.42, envI: 0.9, fog: C(0xc3d0de), mount: C(0x9ea6b6), fogNear: 260, fogFar: 2300 } },
  sunset: { top: C(0x1c2a66), mid: C(0x9a4a7a), hor: C(0xff9a4a), ground: C(0x4a3030), sun: V(-0.9, 0.15, 0.4), sunCol: C(0xffa060), sunI: 2.2, sunSize: 0.9993,
    hemiS: C(0xb08ac0), hemiG: C(0x5a3a2a), hemiI: 0.5, fog: C(0x9a6070), glow: C(0xff7a40), glowA: 0.35, cloud: C(0xff9a7a), cloudA: 0.75, exp: 1.0, mount: C(0x4a2c48), stars: 0.15, envI: 0.5, bloom: [0.55, 0.45, 0.95],
    pre: { turb: 5.5, ray: 2.4, mie: 0.0062, mieG: 0.88, gain: 0.7, clouds: 0.38 }, ng: { exp: 1.12, warm: 0.11, sat: 1.18, vig: 0.28, sunI: 2.6, sunCol: C(0xffa266), hemiI: 0.36, envI: 0.75, fog: C(0xb0848a), mount: C(0x50374f), fogNear: 220, fogFar: 2000, sunDir: V(-0.9, 0.085, 0.42) } },
  night: { top: C(0x02030c), mid: C(0x0a0c26), hor: C(0x2a1a3a), ground: C(0x05040a), sun: V(0.35, 0.62, -0.7), sunCol: C(0x8aa0ff), sunI: 0.35, sunSize: 0.99985,
    hemiS: C(0x6070c0), hemiG: C(0x2a1a20), hemiI: 0.28, fog: C(0x120c22), glow: C(0xc0603a), glowA: 0.28, cloud: C(0x3a2a40), cloudA: 0.35, exp: 1.0, mount: C(0x0c0814), stars: 1, envI: 0.4, bloom: [0.8, 0.45, 0.86],
    ng: { exp: 1.08, warm: 0.05, sat: 1.12, vig: 0.3, sunI: 0.32, sunCol: C(0x8aa0ff), hemiI: 0.26, envI: 0.45, fog: C(0x16102a), mount: C(0x0c0814), fogNear: 200, fogFar: 1500, hor: C(0x3a2040), glow: C(0xd0703a), glowA: 0.4 } },
};

const skyVS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
const skyFS = `uniform vec3 top, mid, hor, ground, sunDir, sunCol, glow, cloud; uniform float sunSize, glowA, cloudA, time; varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=0.5; } return v; }
void main(){ vec3 d = normalize(vDir); float y = d.y; vec3 c;
  if (y > 0.0) { c = mix(hor, mid, smoothstep(0.0, 0.18, y)); c = mix(c, top, smoothstep(0.15, 0.75, y)); } else c = mix(hor, ground, smoothstep(0.0, 0.08, -y));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6) * (0.4 + 0.6 * smoothstep(-0.05, 0.1, sunDir.y));
  c += sunCol * smoothstep(sunSize, sunSize + 0.00025, s) * 6.0;
  c += glow * glowA * exp(-max(y, 0.0) * 9.0) * (y > -0.02 ? 1.0 : 0.0);
  if (y > 0.01) { vec2 uv = d.xz / (y + 0.12) * 1.6 + vec2(time * 0.004, 0.0); float cl = smoothstep(0.52, 0.85, fbm(uv)); c = mix(c, cloud * (0.75 + 0.35 * s), cl * cloudA * smoothstep(0.01, 0.2, y)); }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Preetham sky with a gain (to sit with the scene's light units) and a horizon haze tint below the horizon
function preethamMaterial() {
  const S = Sky.SkyShader;
  const fs = S.fragmentShader.replace('uniform float time;', 'uniform float time; uniform float skyGain; uniform vec3 groundCol;')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', `if ( direction.y < 0.0 ) texColor = mix( texColor, groundCol, smoothstep( 0.0, -0.06, direction.y ) );
			gl_FragColor = vec4( texColor * skyGain, 1.0 );`);
  const u = THREE.UniformsUtils.clone(S.uniforms); u.skyGain = { value: 1 }; u.groundCol = { value: new THREE.Color(0.05, 0.045, 0.04) };
  return new THREE.ShaderMaterial({ name: 'TileoSky', uniforms: u, vertexShader: S.vertexShader, fragmentShader: fs, side: THREE.BackSide, depthWrite: false, fog: false });
}
function setPreetham(u, P, dir, time = 0) {
  const p = P.pre; u.turbidity.value = p.turb; u.rayleigh.value = p.ray; u.mieCoefficient.value = p.mie; u.mieDirectionalG.value = p.mieG; u.skyGain.value = p.gain;
  u.sunPosition.value.copy(dir).multiplyScalar(450000); u.cloudCoverage.value = p.clouds; u.cloudDensity.value = 0.45; u.cloudElevation.value = 0.55; u.cloudScale.value = 0.00022; u.time.value = time;
}

// ---------------------------------------------------------------- Next-Gen passes
const FSV = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
// RenderPass that remembers which depth texture the scene was drawn into (the composer swaps buffers between frames)
class DepthRenderPass extends RenderPass {
  constructor(scene, camera, post) { super(scene, camera); this.post = post; }
  render(renderer, writeBuffer, readBuffer, dt, mask) { super.render(renderer, writeBuffer, readBuffer, dt, mask); this.post.depth = readBuffer.depthTexture; }
}
// Contact shadows: half-resolution AO from the main depth buffer, normals rebuilt from depth, world-space radius,
// depth-aware blur. Neon and other very bright pixels are left alone so signs keep glowing next to walls.
class CineAOPass extends Pass {
  constructor(post, w, h) {
    super(); this.post = post; this.needsSwap = true; this.params = { radius: 0.8, intensity: 1.45, bias: 0.02, power: 1.35, strength: 0.72, samples: 12 };
    this.aoMat = new THREE.ShaderMaterial({ defines: { SAMPLES: 12 },
      uniforms: { tDepth: { value: null }, invProj: { value: new THREE.Matrix4() }, projY: { value: 1 }, res: { value: new THREE.Vector2(1, 1) }, radius: { value: 0.8 }, intensity: { value: 1.45 }, bias: { value: 0.02 }, power: { value: 1.35 }, fade: { value: new THREE.Vector2(160, 70) } },
      vertexShader: FSV,
      fragmentShader: `uniform sampler2D tDepth; uniform mat4 invProj; uniform float projY; uniform vec2 res; uniform float radius; uniform float intensity; uniform float bias; uniform float power; uniform vec2 fade; varying vec2 vUv;
        vec3 vpos(vec2 uv){ float d=texture2D(tDepth,uv).x; vec4 v=invProj*vec4(uv*2.0-1.0,d*2.0-1.0,1.0); return v.xyz/v.w; }
        float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          float d=texture2D(tDepth,vUv).x;
          if(d>0.99999){ gl_FragColor=vec4(1.0); return; }
          vec3 P=vpos(vUv); vec3 N=normalize(cross(dFdx(P),dFdy(P)));
          float rs=min(radius*projY/(-P.z)*0.5,0.12);
          float ang=hash(vUv*res)*6.2831853, occ=0.0;
          for(int i=0;i<SAMPLES;i++){
            float t=(float(i)+0.5)/float(SAMPLES); float a=ang+float(i)*2.3999632;
            vec2 o=vec2(cos(a),sin(a))*sqrt(t)*rs*vec2(res.y/res.x,1.0);
            vec3 S=vpos(vUv+o); vec3 v=S-P; float vv=dot(v,v);
            float f=max(dot(v,N)-bias*(-P.z)*0.02,0.0)/(vv+0.0025*radius*radius);
            f*=1.0-smoothstep(radius*radius,4.0*radius*radius,vv);
            occ+=f;
          }
          float ao=pow(clamp(1.0-intensity*radius*occ/float(SAMPLES)*1.6,0.0,1.0),power);
          gl_FragColor=vec4(vec3(mix(1.0,ao,smoothstep(fade.x,fade.y,-P.z))),1.0);
        }` });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tAO: { value: null }, tDepth: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(1, 1) }, near: { value: 0.25 }, far: { value: 2000 } },
      vertexShader: FSV,
      fragmentShader: `#include <packing>
        uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 dir; uniform vec2 res; uniform float near; uniform float far; varying vec2 vUv;
        float lz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,near,far); }
        void main(){
          float z0=lz(vUv), s=0.0, w=0.0;
          for(int i=-4;i<=4;i++){ vec2 uv=vUv+dir*float(i)/res; float z=lz(uv); float wt=exp(-float(i*i)/8.0)*(1.0-smoothstep(0.02,0.08,abs(z-z0)/z0)); s+=texture2D(tAO,uv).r*wt; w+=wt; }
          gl_FragColor=vec4(vec3(s/max(w,1e-4)),1.0);
        }` });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tAO: { value: null }, strength: { value: 0.72 } },
      vertexShader: FSV,
      fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tAO; uniform float strength; varying vec2 vUv;
        void main(){ vec4 c=texture2D(tDiffuse,vUv); float l=dot(c.rgb,vec3(0.2126,0.7152,0.0722)); float k=strength*(1.0-smoothstep(1.4,4.0,l));
          gl_FragColor=vec4(c.rgb*mix(1.0,texture2D(tAO,vUv).r,k),c.a); }` });
    this.quad = new FullScreenQuad(this.aoMat); this.setSize(w, h);
  }
  setSize(w, h) {
    const hw = Math.max(2, Math.floor(w / 2)), hh = Math.max(2, Math.floor(h / 2));
    if (this.aoRT) { this.aoRT.dispose(); this.blurRT.dispose(); }
    this.aoRT = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false }); this.blurRT = this.aoRT.clone();
    this.aoMat.uniforms.res.value.set(hw, hh); this.blurMat.uniforms.res.value.set(hw, hh); this.compMat.uniforms.tAO.value = this.aoRT.texture;
  }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.post.camera, P = this.params, depth = this.post.depth;
    if (this.aoMat.defines.SAMPLES !== P.samples) { this.aoMat.defines.SAMPLES = P.samples; this.aoMat.needsUpdate = true; }
    const u = this.aoMat.uniforms; u.tDepth.value = depth; u.invProj.value.copy(cam.projectionMatrixInverse); u.projY.value = cam.projectionMatrix.elements[5];
    u.radius.value = P.radius; u.intensity.value = P.intensity; u.bias.value = P.bias; u.power.value = P.power;
    this.quad.material = this.aoMat; renderer.setRenderTarget(this.aoRT); this.quad.render(renderer);
    const b = this.blurMat.uniforms; b.near.value = cam.near; b.far.value = cam.far; b.tDepth.value = depth; this.quad.material = this.blurMat;
    b.tAO.value = this.aoRT.texture; b.dir.value.set(1, 0); renderer.setRenderTarget(this.blurRT); this.quad.render(renderer);
    b.tAO.value = this.blurRT.texture; b.dir.value.set(0, 1); renderer.setRenderTarget(this.aoRT); this.quad.render(renderer);
    const c = this.compMat.uniforms; c.tDiffuse.value = readBuffer.texture; c.strength.value = P.strength;
    this.quad.material = this.compMat; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.aoRT.dispose(); this.blurRT.dispose(); this.aoMat.dispose(); this.blurMat.dispose(); this.compMat.dispose(); this.quad.dispose(); }
}
// Final pass: ACES filmic (same curve and exposure as the renderer's), film grade, vignette, grain, lens fringing, sun glare.
const CineShader = {
  uniforms: {
    tDiffuse: { value: null }, exposure: { value: 1 }, vignette: { value: 0.24 }, sat: { value: 1.08 }, grain: { value: 0.012 }, time: { value: 0 }, ca: { value: 0.0006 },
    lift: { value: new THREE.Vector3(0.0, 0.004, 0.01) }, warm: { value: 0.04 }, contrast: { value: 0.18 },
    sunUV: { value: new THREE.Vector2(-9, -9) }, sunOn: { value: 0 }, sunColor: { value: new THREE.Color(1, 0.8, 0.6) }, tDepth: { value: null }, aspect: { value: 1 }
  },
  vertexShader: FSV,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure; uniform float vignette; uniform float sat; uniform float grain; uniform float time; uniform float ca; uniform vec3 lift; uniform float warm; uniform float contrast;
    uniform vec2 sunUV; uniform float sunOn; uniform vec3 sunColor; uniform sampler2D tDepth; uniform float aspect; varying vec2 vUv;
    vec3 tkRRT(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
    vec3 aces(vec3 c){
      const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));
      const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));
      c*=exposure/0.6; c=I*c; c=tkRRT(c); c=O*c; return clamp(c,0.0,1.0);
    }
    vec3 toSRGB(vec3 c){ return mix(pow(c,vec3(0.41666))*1.055-vec3(0.055), c*12.92, vec3(lessThanEqual(c,vec3(0.0031308)))); }
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    float sky(vec2 uv){ return step(0.99999, texture2D(tDepth, clamp(uv,0.001,0.999)).x); }
    void main(){
      vec2 d=vUv-0.5; float r2=dot(d,d);
      vec3 c=vec3(texture2D(tDiffuse,vUv-d*ca*r2*8.0).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv+d*ca*r2*8.0).b);
      if(sunOn>0.001){
        float vis=0.0; vec2 px=vec2(0.006/aspect,0.006);
        vis+=sky(sunUV); vis+=sky(sunUV+px*vec2(1.0,0.0)); vis+=sky(sunUV-px*vec2(1.0,0.0)); vis+=sky(sunUV+px*vec2(0.0,1.0)); vis+=sky(sunUV-px*vec2(0.0,1.0));
        vis*=sunOn/5.0;
        if(vis>0.0){
          vec2 s=(vUv-sunUV)*vec2(aspect,1.0); float r=length(s);
          vec3 g=sunColor*(exp(-r*7.0)*0.18+exp(-r*26.0)*0.9+exp(-r*110.0)*2.6);
          g+=sunColor*exp(-abs(s.y)*120.0)*exp(-abs(s.x)*2.6)*0.35;
          vec2 sv=sunUV-0.5;
          for(int k=0;k<4;k++){
            float f=k==0?-0.55:k==1?-0.25:k==2?0.4:1.25; float rad=k==0?0.07:k==1?0.035:k==2?0.05:0.11;
            vec3 tint=k==0?vec3(0.35,0.55,1.0):k==1?vec3(1.0,0.6,0.35):k==2?vec3(0.5,1.0,0.7):vec3(0.9,0.5,1.0);
            float gr=length((vUv-(0.5-sv*f))*vec2(aspect,1.0));
            g+=tint*sunColor*(smoothstep(rad,rad*0.55,gr)*0.05+smoothstep(rad*1.02,rad*0.9,gr)*smoothstep(rad*0.8,rad*0.92,gr)*0.04);
          }
          c+=g*vis;
        }
      }
      c=aces(c);
      float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(l),c,sat);
      c=c+lift*(1.0-c);
      c*=mix(vec3(1.0),vec3(1.0+warm,1.0+warm*0.4,1.0-warm*0.6),smoothstep(0.35,0.9,l));
      c=c*c*(3.0-2.0*c)*contrast+c*(1.0-contrast);
      c*=1.0-vignette*smoothstep(0.2,0.9,r2*2.4);
      c+=(h(vUv*vec2(1731.0,977.0)+time)-0.5)*grain;
      gl_FragColor=vec4(toSRGB(clamp(c,0.0,1.0)),1.0);
    }`
};
// bloom bright-pass: clamp very bright pixels (a glint stays a glint) and, by day, leave the sky out
const BRIGHT_FS = `uniform sampler2D tDiffuse; uniform vec3 defaultColor; uniform float defaultOpacity; uniform float luminosityThreshold; uniform float smoothWidth;
  uniform sampler2D tDepth; uniform float skyCut; uniform float maxV; varying vec2 vUv;
  void main(){
    vec4 texel=texture2D(tDiffuse,vUv); float v=dot(texel.xyz,vec3(0.299,0.587,0.114));
    vec3 c=texel.rgb*min(1.0,maxV/max(v,1e-4));
    if(skyCut>0.0){ float d=texture2D(tDepth,vUv).x; c*=1.0-skyCut*step(0.99999,d); }
    float a=smoothstep(luminosityThreshold,luminosityThreshold+smoothWidth,v);
    gl_FragColor=mix(vec4(defaultColor.rgb,defaultOpacity),vec4(c,1.0),a);
  }`;

export const LOOK = { ng: true, glare: 1 }; // set from the player's settings (main.js)
export const ngActive = () => !!(LOOK.ng && Q.tier.bloom);

export function createGfx(renderer, scene, camera) {
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.info.autoReset = false;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.castShadow = false; scene.add(sun); scene.add(sun.target);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -90; sc.right = sc.top = 90; sc.near = 1; sc.far = 900; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.12;
  const U = { top: { value: C(0) }, mid: { value: C(0) }, hor: { value: C(0) }, ground: { value: C(0) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: C(0xffffff) },
    glow: { value: C(0) }, cloud: { value: C(0xffffff) }, sunSize: { value: 0.9995 }, glowA: { value: 0 }, cloudA: { value: 0.5 }, time: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ uniforms: U, vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -1000; sky.frustumCulled = false; scene.add(sky);
  // physically based sky (Next-Gen, day and sunset)
  const pSky = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), preethamMaterial()); pSky.renderOrder = -1000; pSky.frustumCulled = false; pSky.visible = false; scene.add(pSky);
  // stars
  const sp = [], sc2 = []; for (let i = 0; i < 1600; i++) { const a = Math.random() * Math.PI * 2, b = Math.asin(0.04 + Math.random() * 0.96); sp.push(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)); const k = 0.5 + Math.random() * 0.8; sc2.push(k, k, k * (0.9 + Math.random() * 0.2)); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc2, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false })); stars.frustumCulled = false; stars.renderOrder = -999; scene.add(stars);
  // desert mountain rings (taller to the west, like the Spring Mountains); hazier at the foot
  const mountains = new THREE.Group(); scene.add(mountains);
  const mMat = []; for (let ring = 0; ring < 2; ring++) { const N = 260, pos = [], colr = [], idx = [], R = 1 - ring * 0.06;
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, west = Math.max(0, -Math.cos(a)); let hgt = 0.02 + 0.05 * west + (ring ? 0.012 : 0.02);
      for (let o = 1; o <= 6; o++) hgt += Math.abs(Math.sin(a * (3 + o * 4.7 + ring * 2) + o * 1.3 + ring)) * 0.022 / o * (1 + west);
      const x = Math.cos(a) * R, z = Math.sin(a) * R; pos.push(x, -0.02, z, x, hgt, z); const sh = ring ? 1.0 : 0.82; colr.push(sh * 1.06, sh * 1.06, sh * 1.08, sh * 0.86, sh * 0.86, sh * 0.88);
      if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); gg.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }); mMat.push(m); const me = new THREE.Mesh(gg, m); me.frustumCulled = false; me.renderOrder = -998 + ring; mountains.add(me); }
  // ---------------------------------------------------------------- environment maps (image-based lighting)
  const pmrem = new THREE.PMREMGenerator(renderer); const envCache = {};
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // Next-Gen outdoor env: the same physical sky, a sunlit desert floor and a ring of city blocks so glass and chrome reflect a skyline
  function cityRing(es, tod) {
    const R = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(11), night = tod === 'night';
    const cols = night ? [0x0e0c16, 0x141020, 0x0a0a12] : tod === 'sunset' ? [0x6a4a52, 0x8a6a62, 0x40303e, 0x9a7a60] : [0x9aa4b0, 0xcfc4b0, 0x6a7c92, 0xe0d8c8, 0x52627a];
    const lit = [0xffc860, 0xff5aa8, 0x5ad8ff, 0xfff0d0, 0xffa040];
    for (let i = 0; i < 90; i++) { const a = R() * Math.PI * 2, d = 26 + R() * 46, hh = 3 + Math.pow(R(), 1.6) * 26, w = 3 + R() * 6;
      const m = night ? new THREE.MeshBasicMaterial({ color: new THREE.Color(R() < 0.45 ? lit[i % 5] : cols[i % 3]).multiplyScalar(R() < 0.45 ? 2.4 : 1) }) : new THREE.MeshLambertMaterial({ color: cols[i % cols.length] });
      const bm = new THREE.Mesh(new THREE.BoxGeometry(w, hh, w), m); bm.position.set(Math.cos(a) * d, -1.5 + hh / 2, Math.sin(a) * d); bm.rotation.y = R() * 3; es.add(bm); } }
  function outdoorEnv(tod) {
    const ng = ngActive(), key = tod + (ng ? '+ng' : ''); if (envCache[key]) return envCache[key]; const P = TOD[tod]; const es = new THREE.Scene();
    if (ng && P.pre) {
      const dir = (P.ng.sunDir || P.sun).clone().normalize(), sm = preethamMaterial(); setPreetham(sm.uniforms, P, dir); sm.uniforms.cloudCoverage.value = 0;
      sm.uniforms.groundCol.value.copy(tod === 'day' ? C(0x7a6a58) : C(0x4a3434)).multiplyScalar(0.35);
      es.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sm));
      const L = new THREE.DirectionalLight(P.ng.sunCol, P.ng.sunI * 0.9); L.position.copy(dir); es.add(L); es.add(new THREE.HemisphereLight(P.ng.fog, 0x3a2e24, 0.9));
      const gnd = new THREE.Mesh(new THREE.CircleGeometry(90, 24).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: tod === 'day' ? 0x8a7a66 : 0x5a4038 })); gnd.position.y = -1.5; es.add(gnd);
      cityRing(es, tod);
    } else {
      const eu = THREE.UniformsUtils.clone(U); for (const k of ['top', 'mid', 'hor', 'ground', 'sunCol', 'glow', 'cloud']) eu[k].value.copy(P[k]); eu.sunDir.value.copy(P.sun); eu.sunSize.value = 0.9990; eu.glowA.value = P.glowA * 1.5; eu.cloudA.value = P.cloudA;
      if (ng && P.ng.hor) { eu.hor.value.copy(P.ng.hor); eu.glow.value.copy(P.ng.glow); eu.glowA.value = P.ng.glowA * 1.5; }
      const sm = new THREE.ShaderMaterial({ uniforms: eu, vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: skyFS.replace('#include <tonemapping_fragment>', '').replace('#include <colorspace_fragment>', ''), side: THREE.BackSide });
      es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sm));
      if (tod !== 'day') { const R = Math.random; const cols = [0xffc860, 0xff5aa8, 0x5ad8ff, 0xffffff, 0xffa040]; for (let i = 0; i < 70; i++) { const a = R() * Math.PI * 2, d = 30 + R() * 50, hh = 2 + R() * 14;
        const bm = new THREE.Mesh(new THREE.BoxGeometry(2 + R() * 4, hh, 2 + R() * 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i % 5]).multiplyScalar(tod === 'night' ? 3 : 1.6) })); bm.position.set(Math.cos(a) * d, -6 + hh / 2, Math.sin(a) * d); es.add(bm); } }
      if (ng && tod === 'night') cityRing(es, tod);
    }
    const t = pmrem.fromScene(es, 0, 0.1, 200).texture; es.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); return envCache[key] = t; }
  // ---------------------------------------------------------------- post-processing
  let composer = null, bloom = null, rp = null;
  const post = { camera, depth: null, ao: null, fin: null, smaa: null, dof: null, ng: false };
  function disposeComposer() { if (!composer) return; for (const p of composer.passes) p.dispose?.(); composer.dispose(); composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; }
  function buildComposer() {
    disposeComposer(); post.ao = post.fin = post.smaa = post.dof = null; post.depth = null;
    const T = Q.tier; if (!T.bloom && !T.msaa) { bloom = null; post.ng = false; return; }
    const size = renderer.getDrawingBufferSize(new THREE.Vector2()), ng = post.ng = ngActive();
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: T.msaa, depthTexture: ng ? new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType) : null });
    composer = new EffectComposer(renderer, rt); rp = ng ? new DepthRenderPass(scene, camera, post) : new RenderPass(scene, camera); composer.addPass(rp);
    if (ng && T.ao) { post.ao = new CineAOPass(post, size.x, size.y); post.ao.params.samples = T.ao; composer.addPass(post.ao); }
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.8, 0.5, 0.8); bloom.enabled = T.bloom; composer.addPass(bloom);
    if (ng) {
      const hu = bloom.highPassUniforms; hu.tDepth = { value: null }; hu.skyCut = { value: 0 }; hu.maxV = { value: 6 };
      bloom.materialHighPassFilter.fragmentShader = BRIGHT_FS; bloom.materialHighPassFilter.needsUpdate = true;
      const dof = post.dof = new ShaderPass(BokehShader, 'tColor'); dof.material.defines.DEPTH_PACKING = 0; dof.enabled = false; composer.addPass(dof);
      post.fin = new ShaderPass(CineShader); composer.addPass(post.fin);
      if (!T.msaa) { post.smaa = new SMAAPass(); composer.addPass(post.smaa); }
    } else composer.addPass(new OutputPass());
    composer.setPixelRatio(1); composer.setSize(size.x, size.y); st.bloomOn = T.bloom; }
  const st = { pr: 1, fpsAcc: 0, fpsN: 0, fpsT: 0, fps: 60, tod: 'night', area: null, bloomOn: false, shadowOk: false, photo: null, slowN: 0 };
  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(st.pr); renderer.setSize(innerWidth, innerHeight);
    if (composer) { const s = renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setPixelRatio(1); composer.setSize(s.x, s.y); } }
  function applyQuality() { const T = Q.tier; st.pr = Math.min(devicePixelRatio || 1, T.pr); renderer.setPixelRatio(st.pr); renderer.setSize(innerWidth, innerHeight);
    const ms = T.shadow || 512; if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    camera.far = T.far; camera.updateProjectionMatrix(); buildComposer(); if (st.area) applyArea(st.area, st.tod); }
  function applyArea(A, tod) { st.area = A; st.tod = tod; const P = TOD[tod], T = Q.tier, ng = post.ng, N = P.ng;
    const far = T.far * (A.farMul || 1); if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
    sun.shadow.radius = ng ? (T.shadow >= 2048 ? 3 : 2.2) : 1;
    if (A.outdoor) { for (const k of ['top', 'mid', 'hor', 'ground', 'sunCol', 'glow', 'cloud']) U[k].value.copy(P[k]); U.sunDir.value.copy(ng && N.sunDir ? N.sunDir : P.sun).normalize(); U.sunSize.value = P.sunSize; U.glowA.value = P.glowA; U.cloudA.value = P.cloudA;
      if (ng && N.hor) { U.hor.value.copy(N.hor); U.glow.value.copy(N.glow); U.glowA.value = N.glowA; }
      const phys = ng && !!P.pre; pSky.visible = phys; sky.visible = !phys; if (phys) setPreetham(pSky.material.uniforms, P, U.sunDir.value);
      if (phys) pSky.material.uniforms.groundCol.value.copy(ng ? N.fog : P.fog).multiplyScalar(0.55);
      stars.visible = P.stars > 0; stars.material.opacity = P.stars; mountains.visible = true; mMat.forEach((m, i) => m.color.copy(ng ? N.mount : P.mount).multiplyScalar(i ? 1 : 0.8));
      scene.background = null; scene.fog.color.copy(ng ? N.fog : P.fog); scene.fog.near = A.id === 'pool' ? 160 : (ng ? N.fogNear : 220); scene.fog.far = Math.min(T.far * 0.95, ng ? N.fogFar : (tod === 'night' ? 1500 : 1900));
      if (A.fog) { const f = A.fog[tod] || A.fog.day; scene.fog.near = f[0]; scene.fog.far = Math.min(T.far * (A.farMul || 1) * 0.97, f[1]); }
      sun.visible = true; sun.color.copy(ng ? N.sunCol : P.sunCol); sun.intensity = ng ? N.sunI : P.sunI; sun.castShadow = !!T.shadow && tod !== 'night'; hemi.color.copy(P.hemiS); hemi.groundColor.copy(P.hemiG);
      hemi.intensity = (ng ? N.hemiI : P.hemiI) * (A.hemi ?? 1) * (T.env === false ? 2.2 : 1);
      scene.environment = T.env === false ? null : outdoorEnv(tod); scene.environmentIntensity = (ng ? N.envI : P.envI) * (A.envI ?? 1); renderer.toneMappingExposure = P.exp * (A.exp ?? 1);
      st.exposure = (ng ? N.exp : P.exp) * (A.exp ?? 1);
    } else { sky.visible = pSky.visible = stars.visible = mountains.visible = false; scene.background = C(0x050403); scene.fog.color.set(0x050403); scene.fog.near = 60; scene.fog.far = 220;
      sun.visible = false; sun.castShadow = false; hemi.color.set(0xfff0dd); hemi.groundColor.set(0x3a2a20); hemi.intensity = (A.hemi ?? 0.8) * (T.env === false ? 1.4 : 1) * (ng ? 0.8 : 1);
      scene.environment = T.env === false ? null : roomEnv; scene.environmentIntensity = (A.envI ?? 0.6) * (ng ? 1.15 : 1); renderer.toneMappingExposure = A.exp ?? 1; st.exposure = A.exp ?? 1; }
    const bp = (A.bloom && A.bloom[tod]) || (A.outdoor ? P.bloom : [0.7, 0.5, 0.8]);
    if (bloom) { const s = bp[0] * (A.bloomI ?? 1); bloom.strength = s; bloom.radius = bp[1]; bloom.threshold = bp[2]; bloom.enabled = T.bloom && s > (Q.key === 'high' ? 0.05 : 0.2);
      if (ng) { const n = tod === 'night' || !A.outdoor ? 1 : tod === 'sunset' ? 0.55 : 0; bloom.strength = s * (A.outdoor ? 1.05 : 0.72) + 0.04; bloom.threshold = A.outdoor ? THREE.MathUtils.lerp(1.6, bp[2], n) : Math.max(bp[2], 1.0); // indoors: lit white fabric must not glow, only lamps and neon
        bloom.highPassUniforms.skyCut.value = A.outdoor && tod === 'day' ? 1 : 0; bloom.enabled = T.bloom; } }
    if (post.fin) { const u = post.fin.uniforms, G2 = A.outdoor ? N : { warm: 0.06, sat: 1.1, vig: 0.28 }; u.warm.value = G2.warm; u.sat.value = G2.sat; u.vignette.value = G2.vig; u.contrast.value = A.outdoor ? 0.18 : 0.22;
      u.lift.value.set(0, 0.004, tod === 'night' ? 0.016 : 0.008); }
    if (post.ao) { const p = post.ao.params; p.radius = A.outdoor ? 0.9 : 0.6; p.intensity = A.outdoor ? 1.45 : 1.3; p.strength = A.outdoor ? (tod === 'night' ? 0.55 : 0.72) : 0.62; }
  }
  const sunDir = new THREE.Vector3(), tmp = new THREE.Vector3(), _sp = new THREE.Vector3();
  function update(dt, focus, time) { U.time.value = time; const far = camera.far;
    sky.position.copy(camera.position); pSky.position.copy(camera.position); pSky.scale.setScalar(Math.min(1000, far * 0.5)); pSky.material.uniforms.time.value = time;
    stars.position.copy(camera.position); stars.scale.setScalar(far * 0.9); mountains.position.set(camera.position.x, 0, camera.position.z); mountains.scale.set(far * 0.86, far * 0.86, far * 0.86);
    sky.scale.setScalar(Math.min(1, far * 0.95 / 400));
    if (sun.visible) { sunDir.copy(U.sunDir.value).normalize(); const span = sun.shadow.camera.right - sun.shadow.camera.left, texel = span / (sun.shadow.mapSize.x || 1024); const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
      sun.target.position.set(fx, focus.y || 0, fz); sun.position.copy(sun.target.position).addScaledVector(sunDir, 400); sun.target.updateMatrixWorld(); }
    // Next-Gen: sun glare, grade time, photo-mode depth of field
    if (post.fin) { const u = post.fin.uniforms, A = st.area; u.exposure.value = st.exposure || 1; u.time.value = time % 100; u.aspect.value = innerWidth / innerHeight; u.tDepth.value = post.depth;
      let on = 0;
      if (A && A.outdoor && st.tod !== 'night' && sunDir.y > -0.02) { _sp.copy(sunDir).multiplyScalar(3000).add(camera.position).project(camera);
        if (_sp.z < 1 && Math.abs(_sp.x) < 1.3 && Math.abs(_sp.y) < 1.3) { u.sunUV.value.set(_sp.x * 0.5 + 0.5, _sp.y * 0.5 + 0.5); on = THREE.MathUtils.smoothstep(sunDir.y, -0.02, 0.06) * (st.tod === 'sunset' ? 1.25 : 0.5); }
        u.sunColor.value.copy(sun.color); }
      u.sunOn.value = on * LOOK.glare;
      if (bloom && bloom.highPassUniforms.tDepth) bloom.highPassUniforms.tDepth.value = post.depth;
      if (post.dof) { const ph = st.photo; post.dof.enabled = !!(ph && ph.on); if (ph && ph.on) { const U2 = post.dof.uniforms; U2.tDepth.value = post.depth; U2.focus.value = ph.focus; U2.aperture.value = 0.0026 / Math.max(2, ph.focus); U2.maxblur.value = 0.011; U2.nearClip.value = camera.near; U2.farClip.value = camera.far; U2.aspect.value = camera.aspect; } } }
    // auto dynamic resolution (Auto mode only); if frames stay slow at the lowest step, contact shadows go first
    st.fpsAcc += dt; st.fpsN++; if (st.fpsAcc > 1.5) { st.fps = st.fpsN / st.fpsAcc; st.fpsAcc = 0; st.fpsN = 0;
      if (Q.mode === 'auto') { const T = Q.tier, max = Math.min(devicePixelRatio || 1, T.pr); let pr = st.pr; if (st.fps < 28) pr = Math.max(T.prMin, pr - 0.15); else if (st.fps > 52) pr = Math.min(max, pr + 0.1);
        if (Math.abs(pr - st.pr) > 0.01) { st.pr = pr; resize(); }
        if (st.fps < 24 && pr <= T.prMin + 0.01 && post.ao && post.ao.enabled) { if (++st.slowN >= 3) { post.ao.enabled = false; st.onSlow && st.onSlow('ao'); } } else st.slowN = 0; } } }
  function render() { renderer.info.reset(); if (composer) composer.render(); else renderer.render(scene, camera); }
  function setLook(ng) { LOOK.ng = !!ng; for (const k in envCache) { envCache[k].dispose(); delete envCache[k]; } buildComposer(); if (st.area) applyArea(st.area, st.tod); }
  return { hemi, sun, sky, pSky, stars, mountains, get bloom() { return bloom; }, get composer() { return composer; }, post, U, st, resize, applyQuality, applyArea, update, render, setLook, sunDir: U.sunDir.value, TOD, get ng() { return post.ng; } };
}
