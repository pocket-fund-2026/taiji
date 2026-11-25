// Taiji opening: three.js draws the scene, GSAP directs one timeline. Beats (seconds):
// 0.0 petals drift up, camera dollies in | 0.15 two gold rings spin in on arcs and interlock | 1.1 sparkle burst + shockwave
// 1.0 mandap pillars rise, 1.3 dome pops, 1.5 garland beads pop one by one | 1.9 wordmark letters rise, line draws, tagline | 3.9 exit.
// Tap anywhere to skip. Posts 'ready', 'done' or 'fail' to the app.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';

const post = m => { try { window.ReactNativeWebView.postMessage(m); } catch (e) { /* not in a webview */ } };
const GOLD = 0xD9AE5B;
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { post('fail'); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
const key = new THREE.DirectionalLight(0xfff0d6, 1.4); key.position.set(2, 3, 4); scene.add(key);
const glint = new THREE.PointLight(0xffd98a, 0, 9); scene.add(glint);
const S = { zoom: 1.4, petals: 0, burst: 0, wave: 0, glow: 0, wind: 1 };
let baseDist = 10;
function resize() {
  const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  baseDist = Math.max(8, (3.5 / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
}
resize(); window.addEventListener('resize', resize);

// Emblem group: rings, mandap, garland. Sits above centre so the wordmark has its own space below.
const E = new THREE.Group(); E.position.y = 0.85; scene.add(E);
scene.environmentIntensity = 1.9;
const goldMat = new THREE.MeshStandardMaterial({ color: 0xF0C46E, metalness: 0.95, roughness: 0.2, emissive: 0x4A3208, emissiveIntensity: 1 });
const duskGold = new THREE.MeshStandardMaterial({ color: 0xD9AE5B, metalness: 0.8, roughness: 0.42, emissive: 0x3A2706, emissiveIntensity: 1, side: THREE.DoubleSide });
const ringGeo = new THREE.TorusGeometry(0.55, 0.075, 28, 110);
const ringA = new THREE.Mesh(ringGeo, goldMat), ringB = new THREE.Mesh(ringGeo, goldMat);
ringA.position.set(-4.5, 2.2, 3); ringB.position.set(4.5, -2.2, 3); ringA.scale.setScalar(0.6); ringB.scale.setScalar(0.6); E.add(ringA, ringB);

const pillars = [[-1.35, 0.4], [1.35, 0.4], [-1.35, -0.45], [1.35, -0.45]].map(([x, z]) => {
  const g = new THREE.CylinderGeometry(0.035, 0.045, 2, 16); g.translate(0, 1, 0);
  const m = new THREE.Mesh(g, duskGold); m.position.set(x, -0.9, z); m.scale.y = 0.001; E.add(m); return m;
});
const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), duskGold);
dome.scale.set(0.001, 0.001, 0.001); dome.position.y = 1.1; dome.scale.y = 0.001; E.add(dome);
const finial = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 20), goldMat); finial.position.y = 1.62; finial.scale.setScalar(0.001); E.add(finial);

const beadGeo = new THREE.SphereGeometry(0.06, 16, 16); const beadCols = [0xC97B8F, 0xF3E8D1, GOLD];
const beads = []; for (let i = 0; i < 13; i++) {
  const u = (i / 12) * 2 - 1; const b = new THREE.Mesh(beadGeo, new THREE.MeshStandardMaterial({ color: beadCols[i % 3], metalness: 0.2, roughness: 0.5 }));
  b.position.set(u * 1.35, 1.08 - 0.3 * (1 - u * u), 0.42); b.scale.setScalar(0.001); E.add(b); beads.push(b);
}

// Soft glow behind the rings.
const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gx = gc.getContext('2d');
const gr = gx.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,140,0.9)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
glow.position.z = -0.4; glow.scale.setScalar(3); E.add(glow);

// Shockwave ring.
const wave = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 80), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); E.add(wave);

// Sparkle burst.
const NS = 150, sDir = [], sPos = new Float32Array(NS * 3);
for (let i = 0; i < NS; i++) { const a = Math.random() * Math.PI * 2, el = (Math.random() - 0.5) * 1.2, sp = 0.8 + Math.random() * 1.6; sDir.push([Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp * 0.5]); }
const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffe3a3, size: 0.07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.frustumCulled = false; E.add(sparks);

// Petals drifting upward, always moving.
const NP = 150, petalMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }), NP);
const pCols = [0xE2B25A, 0xC97B8F, 0xF3E8D1, 0xD9AE5B].map(c => new THREE.Color(c)); const P = [];
for (let i = 0; i < NP; i++) { P.push({ x: (Math.random() - 0.5) * 7, y: (Math.random() - 0.5) * 9, z: -2 + Math.random() * 5.5, v: 0.25 + Math.random() * 0.55, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.6, s: 0.6 + Math.random() * 0.9 }); petalMesh.setColorAt(i, pCols[i % 4]); }
petalMesh.frustumCulled = false; scene.add(petalMesh);
const dummy = new THREE.Object3D();

function frame(time, dtms) {
  const dt = Math.min(dtms, 50) / 1000;
  camera.position.set(Math.sin(time * 0.35) * 0.18, 0.1, baseDist * S.zoom); camera.lookAt(0, 0.1, 0);
  E.rotation.y = Math.sin(time * 0.8) * 0.2; ringA.rotation.z += dt * 0.35; ringB.rotation.z -= dt * 0.3;
  glow.material.opacity = S.glow * (0.75 + 0.25 * Math.sin(time * 3)); glint.intensity = S.glow * 3.2; glint.position.set(Math.sin(time * 1.6) * 2.2, 0.6, 2.2);
  wave.scale.setScalar(0.3 + S.wave * 3.2); wave.material.opacity = (1 - S.wave) * 0.7 * (S.wave > 0 ? 1 : 0);
  const b = S.burst; sparks.material.opacity = b > 0 && b < 1 ? (1 - b * b) : 0; sparks.visible = sparks.material.opacity > 0.01;
  if (sparks.visible) { const a = sGeo.attributes.position.array; for (let i = 0; i < NS; i++) { const e = 1 - Math.pow(1 - b, 3); a[i * 3] = sDir[i][0] * e * 1.8; a[i * 3 + 1] = sDir[i][1] * e * 1.8 - b * b * 0.5; a[i * 3 + 2] = sDir[i][2] * e * 1.8; } sGeo.attributes.position.needsUpdate = true; }
  for (let i = 0; i < NP; i++) {
    const p = P[i]; p.y += p.v * dt * S.wind; if (p.y > 4.8) p.y = -4.8; const sway = Math.sin(time * 0.9 + p.ph) * 0.35;
    dummy.position.set(p.x + sway, p.y, p.z); dummy.rotation.set(time * p.sp + p.ph, time * p.sp * 0.7, p.ph); dummy.scale.setScalar(p.s * S.petals); dummy.updateMatrix(); petalMesh.setMatrixAt(i, dummy.matrix);
  }
  petalMesh.instanceMatrix.needsUpdate = true;
  renderer.render(scene, camera);
}
gsap.ticker.add(frame);

// ---- The timeline ----
const tl = gsap.timeline({ paused: true, onComplete: finish });
const spans = gsap.utils.toArray('#word span');
gsap.set(spans, { y: 34, opacity: 0, filter: 'blur(10px)' }); gsap.set('#line', { scaleX: 0 }); gsap.set('#tag', { opacity: 0, y: 10 });
tl.to(S, { petals: 1, duration: 1.1, ease: 'power2.out' }, 0)
  .to(S, { zoom: 1, duration: 2.6, ease: 'power2.out' }, 0)
  .to(ringA.position, { x: -0.3, y: 0, z: 0, duration: 1.05, ease: 'power3.out' }, 0.15).to(ringA.scale, { x: 1, y: 1, z: 1, duration: 1.05, ease: 'power3.out' }, 0.15)
  .to(ringA.rotation, { x: Math.PI * 2, y: 0.5, duration: 1.2, ease: 'back.out(1.3)' }, 0.15)
  .to(ringB.position, { x: 0.3, y: 0, z: 0, duration: 1.05, ease: 'power3.out' }, 0.28).to(ringB.scale, { x: 1, y: 1, z: 1, duration: 1.05, ease: 'power3.out' }, 0.28)
  .to(ringB.rotation, { x: -Math.PI * 2, y: -0.5, duration: 1.2, ease: 'back.out(1.3)' }, 0.28)
  .to(S, { glow: 1, duration: 0.5, ease: 'power2.out' }, 1.1).to(S, { burst: 1, duration: 1.1, ease: 'none' }, 1.12).to(S, { wave: 1, duration: 0.9, ease: 'power2.out' }, 1.12)
  .to(pillars.map(p => p.scale), { y: 1, duration: 0.75, ease: 'back.out(1.5)', stagger: 0.09 }, 1.0)
  .to(dome.scale, { x: 1, z: 1, duration: 0.7, ease: 'back.out(1.6)' }, 1.3).to(dome.scale, { y: 0.45, duration: 0.7, ease: 'back.out(1.6)' }, 1.3)
  .to(finial.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(3)' }, 1.7)
  .to(beads.map(b => b.scale), { x: 1, y: 1, z: 1, duration: 0.42, ease: 'back.out(2.8)', stagger: 0.035 }, 1.5)
  .to(spans, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.85, ease: 'power3.out', stagger: 0.07 }, 1.95)
  .fromTo('#word', { letterSpacing: '0.26em' }, { letterSpacing: '0.08em', duration: 1.5, ease: 'power3.out' }, 1.95)
  .to('#line', { scaleX: 1, duration: 0.6, ease: 'power3.out' }, 2.55).to('#tag', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 2.7)
  .to(S, { glow: 0.55, duration: 0.8 }, 3.0)
  .to('#root', { opacity: 0, scale: 1.05, duration: 0.45, ease: 'power2.in' }, 3.95);
let ended = false;
function finish() { if (ended) return; ended = true; gsap.ticker.remove(frame); post('done'); }
document.addEventListener('click', () => { if (!ended) tl.timeScale(5); });
requestAnimationFrame(() => { post('ready'); tl.play(); });
