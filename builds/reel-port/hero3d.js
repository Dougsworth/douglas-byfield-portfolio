// Reel Port hero: an inflatable lawn screen rippling in the sea breeze,
// a volumetric projector beam with dust caught in it, and moonlight on the sea.
import * as THREE from '/builds/vendor/three.module.min.js';

const canvas = document.getElementById('beam');
const hero = document.querySelector('.hero');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
catch (e) { canvas.remove(); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
const U = { uTime: { value: 0 } };

// sky dome, so the additive beam and dust have something real to add onto
scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    varying vec3 vD;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      float y = vD.y;
      vec3 top = vec3(.0016,.0019,.0042), mid = vec3(.0045,.005,.012), hz = vec3(.012,.011,.016);
      vec3 c = mix(hz, mid, smoothstep(0.0, .12, y));
      c = mix(c, top, smoothstep(.12, .6, y));
      vec2 g = floor(vec2(atan(vD.z, vD.x)*900.0, y*900.0));
      c += vec3(.18) * step(.9988, h2(g)) * smoothstep(.04, .25, y);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`
})));

/* ---------- the film on the screen ---------- */
const filmCanvas = document.createElement('canvas');
filmCanvas.width = 1024; filmCanvas.height = 576;
const fg = filmCanvas.getContext('2d');
const filmTex = new THREE.CanvasTexture(filmCanvas);
filmTex.colorSpace = THREE.SRGBColorSpace;
const films = (window.__RP_FILMS || [{ title: 'Reel Port', by: 'Folly Point', mins: 0 }]);
let filmIdx = 0;
function drawCard(i) {
  const f = films[i % films.length];
  const W = filmCanvas.width, H = filmCanvas.height;
  const g = fg.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2a2118'); g.addColorStop(1, '#120e0b');
  fg.fillStyle = g; fg.fillRect(0, 0, W, H);
  // a soft key light so the card looks lit, not flat
  const r = fg.createRadialGradient(W * .7, H * .35, 20, W * .7, H * .35, W * .7);
  r.addColorStop(0, 'rgba(232,163,61,.28)'); r.addColorStop(1, 'rgba(232,163,61,0)');
  fg.fillStyle = r; fg.fillRect(0, 0, W, H);
  fg.fillStyle = '#968c7c';
  fg.font = '500 22px "IBM Plex Mono", monospace';
  fg.fillText('NOW SHOWING  ·  ' + String((i % films.length) + 1).padStart(2, '0') + ' / ' + String(films.length).padStart(2, '0'), 64, 86);
  fg.fillStyle = '#efe6d4';
  let size = 150;
  const title = f.title.toUpperCase();
  do { fg.font = `900 ${size}px "Big Shoulders Display", Impact, sans-serif`; size -= 6; } while (fg.measureText(title).width > W - 128 && size > 50);
  // wrap long titles onto two lines
  const words = title.split(' ');
  let lines = [title];
  if (fg.measureText(title).width > W - 128 || title.length > 14) {
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean);
    size = 140;
    do { fg.font = `900 ${size}px "Big Shoulders Display", Impact, sans-serif`; size -= 6; } while (Math.max(...lines.map(l => fg.measureText(l).width)) > W - 128 && size > 50);
  }
  const lh = size * 0.92;
  const startY = H * .56 - (lines.length - 1) * lh / 2;
  lines.forEach((l, k) => fg.fillText(l, 60, startY + k * lh + size * .3));
  fg.fillStyle = '#e8a33d';
  fg.font = 'italic 34px "Newsreader", Georgia, serif';
  fg.fillText(f.by + (f.mins ? '  ·  ' + f.mins + ' min' : ''), 64, H - 70);
  filmTex.needsUpdate = true;
}
drawCard(0);
if (document.fonts) document.fonts.ready.then(() => drawCard(filmIdx));

/* ---------- screen geometry ---------- */
const SW = 6.4, SH = 3.6;
const screenGroup = new THREE.Group();
scene.add(screenGroup);

const screenGeo = new THREE.PlaneGeometry(SW, SH, 64, 36);
const screenMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uMap: { value: filmTex }, uCut: { value: 0 } },
  vertexShader: `
    uniform float uTime; varying vec2 vUv; varying float vShade;
    void main(){
      vUv = uv;
      vec3 p = position;
      // pinned at the frame, free in the middle
      float pin = sin(uv.x*3.14159) * sin(uv.y*3.14159);
      float w = sin(uv.x*5.0 + uTime*1.6) * .5 + sin(uv.y*4.0 - uTime*1.1 + uv.x*2.0) * .35 + sin((uv.x+uv.y)*9.0 + uTime*2.7) * .12;
      p.z += w * .13 * pin;
      vShade = w * pin;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `
    uniform float uTime, uCut; uniform sampler2D uMap; varying vec2 vUv; varying float vShade;
    float h(float n){ return fract(sin(n)*43758.5453); }
    float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      float f = floor(uTime*24.0);                       // film runs at 24 frames a second
      vec2 weave = vec2(h(f)*.002 - .001, h(f+7.0)*.003 - .0015);
      vec2 uv = vUv + weave;
      vec3 c = texture2D(uMap, uv).rgb;
      float flick = .9 + .1*h(f*1.3);
      // scratches: thin vertical lines that hop around between frames
      float s1 = smoothstep(.0015, .0, abs(uv.x - h(floor(uTime*3.0))*1.0)) * step(.55, h(floor(uTime*3.0)+2.0));
      float s2 = smoothstep(.001, .0, abs(uv.x - h(f*.37+3.0))) * step(.92, h(f+11.0));
      // dust specks
      float dust = step(.9993, h2(floor(uv*vec2(420.0,240.0)) + f));
      c += vec3(.55) * (s1*.5 + s2*.7) + vec3(.8)*dust;
      // the bulb: brighter middle, falling off to the corners
      float vig = smoothstep(1.05, .25, length((vUv - .5)*vec2(1.25,1.0)));
      c *= flick * (.35 + .75*vig);
      c *= 1.0 + vShade*.35;                              // folds catch the light
      c = mix(c, vec3(0.0), uCut);                        // dip to black between films
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`
});
const screen = new THREE.Mesh(screenGeo, screenMat);
screenGroup.add(screen);

// inflatable frame: a fat tube around the screen
const r = 0.28;
const path = new THREE.CurvePath();
const hw = SW / 2 + r * .6, hh = SH / 2 + r * .6, k = 0.35;
const pts = [
  [-hw + k, -hh], [hw - k, -hh], [hw, -hh + k], [hw, hh - k], [hw - k, hh], [-hw + k, hh], [-hw, hh - k], [-hw, -hh + k]
].map(([x, y]) => new THREE.Vector3(x, y, -0.05));
for (let i = 0; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i], pts[(i + 1) % pts.length]));
const tube = new THREE.Mesh(
  new THREE.TubeGeometry(path, 200, r, 18, true),
  new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: .55, metalness: 0 })
);
screenGroup.add(tube);
// legs and guy ropes
const legMat = new THREE.MeshStandardMaterial({ color: 0x1c1915, roughness: .7 });
[-1, 1].forEach(side => {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(r * .8, r * 1.1, 1.6, 14), legMat);
  leg.position.set(side * (hw - .3), -hh - .8, -0.05);
  screenGroup.add(leg);
});
const ropeMat = new THREE.LineBasicMaterial({ color: 0x3a342d, transparent: true, opacity: .7 });
[-1, 1].forEach(side => {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side * hw, hh, -.05), new THREE.Vector3(side * (hw + 2.4), -hh - 1.6, -2.2)]);
  screenGroup.add(new THREE.Line(g, ropeMat));
});
screenGroup.position.y = SH / 2 + 1.6;

// lights: the screen spills onto everything in front of it
scene.add(new THREE.HemisphereLight(0x2a3050, 0x0e0c0a, .5));
const spill = new THREE.PointLight(0xffc88a, 6, 14, 1.6);
spill.position.set(0, 2.6, 1.6);
screenGroup.add(spill);

/* ---------- lawn and sea ---------- */
const lawn = new THREE.Mesh(new THREE.PlaneGeometry(80, 40, 1, 1), new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime },
  transparent: true,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `
    varying vec3 vW;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      float pool = smoothstep(9.0, 0.0, length(vec2(vW.x*.7, vW.z - 3.0)));
      float grain = h2(floor(vW.xz*18.0))*.5 + .5;
      vec3 c = mix(vec3(.0025,.003,.0022), vec3(.06,.038,.018), pool*.6) * (.75 + .25*grain);
      float back = smoothstep(-6.0, -3.0, vW.z);          // lawn ends at the sea wall
      gl_FragColor = vec4(c, back);
      #include <colorspace_fragment>
    }`
}));
lawn.rotation.x = -Math.PI / 2; lawn.position.z = 14;
scene.add(lawn);

const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 200, 1, 1), new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uMoonX: { value: -14 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `
    uniform float uTime, uMoonX; varying vec3 vW;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec3 c = vec3(.0035,.0045,.009);
      // moon path: glints that blink on and off down a narrowing column
      float dist = -vW.z;
      float col = smoothstep(2.0 + dist*.06, 0.0, abs(vW.x - uMoonX));
      vec2 cell = floor(vec2(vW.x*3.0, vW.z*1.4 + uTime*.6));
      float glint = step(.86, h2(cell + floor(uTime*2.0)));
      c += vec3(.75,.78,.9) * col * glint * .55 * smoothstep(120.0, 10.0, dist);
      c += vec3(.02,.02,.035) * col;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`
}));
sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.15, -100);
scene.add(sea);

// moon
const moon = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshBasicMaterial({ color: 0xe9e3d2, fog: false }));
moon.position.set(-14 * 4, 22, -190);
// moon disc left out on purpose: the glints on the water carry it

/* ---------- projector + beam ---------- */
const projPos = new THREE.Vector3();
const beamGeo = new THREE.BufferGeometry();
const beamMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime },
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float along; varying float vA; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
    void main(){
      vA = along; vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - w.xyz);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `
    uniform float uTime; varying float vA; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
    float h(float n){ return fract(sin(n)*43758.5453); }
    void main(){
      float flick = .85 + .15*h(floor(uTime*24.0));
      float edge = 1.0 - abs(dot(normalize(vN), vV));       // brighter where we look through more air
      float side = smoothstep(0.0, .25, vUv.x) * smoothstep(1.0, .75, vUv.x);
      float a = mix(.55, .05, vA) * (.25 + .75*edge) * side * flick;
      gl_FragColor = vec4(vec3(1.0,.84,.6) * a * .32, 1.0);
    }`
});
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.frustumCulled = false;
scene.add(beam);

// dust
const DUST = innerWidth < 760 ? 260 : 520;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST * 3);
const dustSeed = new Float32Array(DUST * 4).map(() => Math.random());
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
dustGeo.setAttribute('seed', new THREE.BufferAttribute(Float32Array.from({ length: DUST }, (_, i) => dustSeed[i * 4]), 1));
const dustMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uPix: { value: 2.2 * Math.min(devicePixelRatio, 2) } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float seed; uniform float uTime, uPix; varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = min(uPix * (6.0 / -mv.z) * (.6 + seed), uPix * 1.6);
      vA = .35 + .65*sin(uTime*(1.0 + seed*2.0) + seed*30.0)*.5 + .32;
    }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1.0,.9,.75), smoothstep(.5,.0,d)*vA*.8); }`
});
const dust = new THREE.Points(dustGeo, dustMat);
dust.frustumCulled = false;
scene.add(dust);

// beam corners: small at the lens, the screen's corners at the far end
const nearC = [], farC = [];
function buildBeam() {
  screenGroup.updateMatrixWorld(true);
  const lens = 0.09;
  farC.length = nearC.length = 0;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
    farC.push(new THREE.Vector3(sx * SW / 2, sy * SH / 2, 0.02).applyMatrix4(screenGroup.matrixWorld));
    nearC.push(projPos.clone().add(new THREE.Vector3(sx * lens * 1.6, sy * lens, 0)));
  });
  const P = [], A = [], UV = [], I = [];
  for (let f = 0; f < 4; f++) {
    const a = f, b = (f + 1) % 4, base = P.length / 3;
    [nearC[a], nearC[b], farC[b], farC[a]].forEach(v => P.push(v.x, v.y, v.z));
    A.push(0, 0, 1, 1);
    UV.push(0, 0, 1, 0, 1, 1, 0, 1);
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const pa = beamGeo.getAttribute('position');
  if (pa) { pa.array.set(P); pa.needsUpdate = true; }
  else {
    beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    beamGeo.setAttribute('along', new THREE.Float32BufferAttribute(A, 1));
    beamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    beamGeo.setIndex(I);
  }
  beamGeo.computeVertexNormals();
}

/* ---------- framing ---------- */
const look = new THREE.Vector3();
let base = new THREE.Vector3();
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight, a = w / h;
  renderer.setSize(w, h, false);
  camera.aspect = a;
  if (a > 1.1) {                       // desktop: screen sits to the right of the headline
    const d = Math.max(19.5, 10.8 / (Math.tan(THREE.MathUtils.degToRad(19)) * a));
    screenGroup.position.x = 6.3;
    base.set(0, 2.6, d);
    look.set(0.3, 2.9, 0);
    projPos.set(-8.5, 4.2, d * .5);
  } else {                             // phone: screen up top, headline underneath
    screenGroup.position.x = 0;
    const d = 4.4 / (Math.tan(THREE.MathUtils.degToRad(19)) * a);
    base.set(0, 2.2, d);
    look.set(0, -1.05 - (d - 20) * .12, 0);
    projPos.set(-6, 5.2, d * .55);
  }
  camera.position.copy(base);
  camera.lookAt(look);
  camera.updateProjectionMatrix();
  buildBeam();
}
resize();
addEventListener('resize', resize);

/* ---------- loop ---------- */
let mx = 0, my = 0, cx = 0, cy = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
let onScreen = true;
new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(hero);
const clock = new THREE.Clock();
let nextCut = 6, cutT = -1;
function frame() {
  requestAnimationFrame(frame);
  if (!onScreen || document.hidden) return;
  const t = clock.getElapsedTime();
  U.uTime.value = reduce ? 0 : t;

  // change films every few seconds with a quick dip to black
  if (!reduce && t > nextCut) { cutT = t; nextCut = t + 6; }
  if (cutT >= 0) {
    const p = (t - cutT) / .5;
    screenMat.uniforms.uCut.value = p < .5 ? p * 2 : Math.max(0, 2 - p * 2);
    if (p >= .5 && p < .55) { filmIdx++; drawCard(filmIdx); }
    if (p >= 1) cutT = -1;
  }

  // breeze sways the whole screen a touch
  if (!reduce) {
    screenGroup.rotation.y = Math.sin(t * .5) * .02 - .06;
    screenGroup.rotation.z = Math.sin(t * .8) * .004;
  }

  // dust drifting from the lens toward the screen
  for (let i = 0; i < DUST; i++) {
    const s = i * 4;
    let along = (dustSeed[s] + (reduce ? 0 : t * (0.006 + dustSeed[s + 1] * .01))) % 1;
    const u = dustSeed[s + 2], v = dustSeed[s + 3];
    const near = nearC[0].clone().lerp(nearC[1], u).lerp(nearC[3].clone().lerp(nearC[2], u), v);
    const far = farC[0].clone().lerp(farC[1], u).lerp(farC[3].clone().lerp(farC[2], u), v);
    const p = near.lerp(far, along);
    dustPos[i * 3] = p.x + Math.sin(t * .4 + s) * .05;
    dustPos[i * 3 + 1] = p.y + Math.cos(t * .3 + s) * .05;
    dustPos[i * 3 + 2] = p.z;
  }
  dustGeo.attributes.position.needsUpdate = true;
  // keep the beam pinned to the swaying screen
  buildBeam();

  cx += (mx - cx) * .04; cy += (my - cy) * .04;
  if (!reduce) {
    camera.position.set(base.x + cx * 1.2, base.y - cy * .5, base.z);
    camera.lookAt(look);
  }
  renderer.render(scene, camera);
}
frame();
