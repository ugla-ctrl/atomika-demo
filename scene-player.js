(function(){
'use strict';
if (!window.THREE) { document.body.insertAdjacentHTML('beforeend','<div class="fallback">The 3D view could not load. Check your connection and reload.</div>'); return; }
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('c');
/* Rendering: linear HDR scene, ACES filmic tone map, bloom, and a film finish (grain, vignette, slight lens fringing) in a final pass. Without the post scripts it falls back to the renderer's own tone mapping. */
const POST = !!(THREE.EffectComposer && THREE.RenderPass && THREE.ShaderPass && THREE.UnrealBloomPass);
const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || Math.min(window.innerWidth, window.innerHeight) < 600;
const EXPOSURE = 1.15, EXPOSURE_BELOW = 0.62; let exposure = EXPOSURE, lastF = 0;
let renderer;
try { renderer = new THREE.WebGLRenderer({canvas, antialias:!POST, logarithmicDepthBuffer:true, powerPreference:'high-performance'}); }
catch(e){ document.body.insertAdjacentHTML('beforeend','<div class="fallback">This device could not start the 3D view.</div>'); return; }
let pixelRatio = Math.min(window.devicePixelRatio||1, mobile ? 1.5 : 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if (!POST){ renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = EXPOSURE; renderer.outputEncoding = THREE.sRGBEncoding; }
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04060b');
scene.fog = new THREE.FogExp2('#0d1320', 0.0000125);
const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 700000);

scene.add(new THREE.HemisphereLight('#8090b4', '#1c1b18', 0.55));
const moon = new THREE.DirectionalLight('#d8e0ff', 0.6); moon.position.set(-0.6, 1, 0.35); scene.add(moon); scene.add(moon.target);
const MOON_DIR = moon.position.clone().normalize();
moon.castShadow = true; moon.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03;

/* ---------- helpers ---------- */
const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:0.92, metalness:0}, o||{}));
const D = (c, o) => M(c, Object.assign({side:THREE.DoubleSide}, o||{}));
const G = (c, o) => new THREE.MeshBasicMaterial(Object.assign({color:c}, o||{}));
const HIDE = new THREE.MeshBasicMaterial({visible:false});
const animators = [];
/* Photo-scanned PBR surfaces (CC0, Poly Haven), tinted so each one averages out to the color it replaces in the original palette.
   TEXAVG is each color map's mean in linear RGB; TSCALE is feet per tile. */
const texLoader = new THREE.TextureLoader(), texCache = {};
const TEXAVG = {aerial:[0.206,0.117,0.055], asphalt:[0.104,0.102,0.091], cap:[0.191,0.159,0.107], concrete:[0.267,0.235,0.163], corrugated:[0.099,0.098,0.083], floor:[0.093,0.094,0.089], ground:[0.302,0.174,0.078], painted:[0.296,0.277,0.219], panel:[0.038,0.042,0.046], plate:[0.034,0.033,0.029], silo:[0.108,0.082,0.061]};
const TSCALE = {aerial:1400, asphalt:14, cap:12, concrete:9, corrugated:5, floor:9, ground:12, painted:7, panel:4, plate:3.5, silo:16};
function texSet(name){ if (texCache[name]) return texCache[name];
  const ld = (suf, srgb) => { const t = texLoader.load('tex/'+name+'_'+suf+'.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
  return (texCache[name] = {map:ld('diff', true), normalMap:ld('nor'), roughnessMap:ld('rough')}); }
function tint(kind, hex, chroma){ const t = new THREE.Color(hex).convertSRGBToLinear(), a = TEXAVG[kind], ch = chroma === undefined ? 0.7 : chroma;
  const k = (0.2126*t.r + 0.7152*t.g + 0.0722*t.b) / (0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2]);
  return new THREE.Color(k*(1-ch) + ch*t.r/a[0], k*(1-ch) + ch*t.g/a[1], k*(1-ch) + ch*t.b/a[2]); }
function TX(kind, hex, o){ o = Object.assign({}, o); const ch = o.chroma; delete o.chroma; const m = new THREE.MeshStandardMaterial(Object.assign({roughness:1, metalness:0}, texSet(kind), o)); m.color = tint(kind, hex, ch);
  m.userData.tex = TSCALE[kind]; m.userData.lin = true; return m; }
/* Real-world texture scale: planar projection on the dominant axis; open cylinder walls unwrap around the circumference (rot turns the pattern 90 degrees). */
function worldUV(geo, s, rot){ if (!geo || geo.userData.uvS === s) return; geo.userData.uvS = s;
  const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv; if (!P || !N || !UV) return;
  const pr = geo.parameters || {}, cyl = geo.type === 'CylinderGeometry';
  for (let i=0;i<P.count;i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i)); let u, v;
    if (cyl && ny < 0.9){ u = UV.getX(i)*pr.thetaLength*Math.max(pr.radiusTop, pr.radiusBottom)/s; v = UV.getY(i)*pr.height/s; if (rot){ const q = u; u = v; v = q; } }
    else if (ny >= nx && ny >= nz){ u = x/s; v = z/s; } else if (nx >= nz){ u = z/s; v = y/s; } else { u = x/s; v = y/s; }
    UV.setXY(i, u, v); }
  UV.needsUpdate = true; }
function add(geo, mat, x, y, z, parent){ const m = new THREE.Mesh(geo, mat); m.position.set(x||0, y||0, z||0); (parent||scene).add(m); return m; }
function box(w,h,d,mat,x,y,z,ry){ const m = add(new THREE.BoxGeometry(w,h,d), mat, x,y,z); if (ry) m.rotation.y = ry; return m; }
const smooth = (a,b,x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
function rectPath(x0,z0,x1,z1){ const p = new THREE.Path(); p.moveTo(x0,-z0); p.lineTo(x1,-z0); p.lineTo(x1,-z1); p.lineTo(x0,-z1); p.lineTo(x0,-z0); return p; }
/* Shapes are drawn in (x, -z) and laid flat with rotateX(-PI/2). */

/* ---------- terrain ---------- */
const CX = 16100, CZ = 74800; /* Roswell, relative to the site, in feet (south is +z) */
function H(x,z){
  const r = Math.hypot(x,z);
  const k = smooth(3000, 60000, r);
  const city = 1 - 0.85*smooth(26000, 0, Math.hypot(x-CX, z-CZ));
  let h = (Math.sin(x*0.00011) + Math.cos(z*0.00009) + 0.6*Math.sin((x-z)*0.00027) + 0.4*Math.cos((x+2*z)*0.0006)) * 520 * k * city;
  if (x < -45000) h += smooth(45000, 140000, -x) * 5200 * (0.55 + 0.45*Math.sin(z*0.00004 + 1.3));
  /* arroyos and low rises at the scale you see from the approach */
  h += (Math.sin(x*0.0013 + z*0.0007)*Math.cos(z*0.0011 - x*0.0004)*70 + Math.sin(x*0.0041 + 1.7)*Math.sin(z*0.0035 - 0.6)*22) * k * city;
  return h - 0.4;
}
/* Launch complex frame: C = LCC center. s runs from C toward the silo, lz runs across (LiDAR section: LCC, stair shaft, 40 ft tunnel, silo) */
const C = new THREE.Vector3(-45,0,-95);
const UX = 0.428, UZ = 0.904;
const W = (s, lz, y) => new THREE.Vector3(C.x + s*UX - lz*UZ, y, C.z + s*UZ + lz*UX);
const LG = new THREE.Group(); LG.position.set(C.x,0,C.z); LG.rotation.y = -Math.atan2(UZ, UX); scene.add(LG);
function wb(s0,s1,y0,y1,z0,z1,mat){ const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(s1-s0),Math.abs(y1-y0),Math.abs(z1-z0)), mat); m.position.set((s0+s1)/2,(y0+y1)/2,(z0+z1)/2); LG.add(m); return m; }
function polyPath(pts){ const p = new THREE.Path(); pts.forEach((q,i) => { const w = W(q[0],q[1],0); if (i) p.lineTo(w.x,-w.z); else p.moveTo(w.x,-w.z); }); const w0 = W(pts[0][0],pts[0][1],0); p.lineTo(w0.x,-w0.z); return p; }
const groundShape = new THREE.Shape(); groundShape.absarc(0,0,1600,0,Math.PI*2,false);
const capHole = new THREE.Path(); capHole.absarc(0,0,35,0,Math.PI*2,true); groundShape.holes.push(capHole);
groundShape.holes.push(polyPath([[21.5,-34.5],[21.5,-20],[27.5,-20],[27.5,-34.5]]));
const gGeo = new THREE.ShapeGeometry(groundShape, 48); gGeo.rotateX(-Math.PI/2);
/* One desert material for the whole landscape: close-up gravel and scrub soil near the camera, aerial-scale washes and rises farther out */
const terrainMat = TX('ground', '#3b3a37', {chroma:0.45, shadowSide:THREE.DoubleSide});
{ const aerial = texSet('aerial').map, gl = TEXAVG.ground, al = TEXAVG.aerial;
  terrainMat.onBeforeCompile = sh => { sh.uniforms.aerialMap = {value:aerial};
    sh.fragmentShader = 'uniform sampler2D aerialMap;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
        float camD = length(vViewPosition);
        float wNear = 1.0 - smoothstep(140.0, 1500.0, camD);
        vec3 cN = mapTexelToLinear(texture2D(map, vUv)).rgb;
        vec3 cM = mapTexelToLinear(texture2D(aerialMap, vUv*${(12/1400).toFixed(5)})).rgb;
        vec3 cF = mapTexelToLinear(texture2D(aerialMap, vUv*${(12/21000).toFixed(6)})).rgb;
        vec3 macro = mix(cM, cF, smoothstep(2500.0, 40000.0, camD)) * vec3(${(gl[0]/al[0]).toFixed(3)}, ${(gl[1]/al[1]).toFixed(3)}, ${(gl[2]/al[2]).toFixed(3)});
        vec3 nearC = cN * mix(1.0, dot(cM, vec3(0.333)) / ${((al[0]+al[1]+al[2])/3).toFixed(3)}, 0.55);
        diffuseColor.rgb *= mix(macro, nearC, wNear);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 mapN = texture2D(normalMap, vUv).xyz * 2.0 - 1.0; mapN.xy *= normalScale * wNear;
        normal = perturbNormal2Arb(-vViewPosition, normal, mapN, faceDirection);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * mix(1.0, texture2D(roughnessMap, vUv).g, wNear);'); }; }
{ const d = add(gGeo, terrainMat); d.userData.ground = true; d.userData.cast = true; } /* the site disc blocks moonlight from the rooms below */
/* landscape: log-spaced rings, dense near the site and sparse toward the horizon */
{ const NR = 130, NA = 288, r0 = 1500, r1 = 240000, pos = [], uv = [], idx = [];
  for (let i=0;i<=NR;i++){ const r = r0*Math.pow(r1/r0, i/NR); for (let j=0;j<=NA;j++){ const a = j/NA*Math.PI*2, x = r*Math.cos(a), z = r*Math.sin(a); pos.push(x, H(x,z), z); uv.push(x/12, z/12); } }
  for (let i=0;i<NR;i++) for (let j=0;j<NA;j++){ const a = i*(NA+1)+j, b = a+NA+1; idx.push(a, a+1, b, b, a+1, b+1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.uvS = 12; add(g, terrainMat).userData.ground = true; }

/* ---------- night sky: Milky Way, airglow, the Roswell light dome and a few thousand colored stars, painted into an equirectangular map ---------- */
function makeSky(Wd){
  const Hd = Wd/2, cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const ctx = cv.getContext('2d');
  const hash = (x,y,z) => { const s = Math.sin(x*127.1 + y*311.7 + z*74.7)*43758.5453; return s - Math.floor(s); };
  const vnoise = (x,y,z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x-ix, fy = y-iy, fz = z-iz; const u = fx*fx*(3-2*fx), v = fy*fy*(3-2*fy), w = fz*fz*(3-2*fz);
    const l = (a,b,t) => a + (b-a)*t; const h = (a,b,c) => hash(ix+a, iy+b, iz+c);
    return l(l(l(h(0,0,0),h(1,0,0),u), l(h(0,1,0),h(1,1,0),u), v), l(l(h(0,0,1),h(1,0,1),u), l(h(0,1,1),h(1,1,1),u), v), w); };
  const fbm = (x,y,z) => { let s = 0, a = 0.5, f = 1; for (let o=0;o<5;o++){ s += a*vnoise(x*f, y*f, z*f); f *= 2.03; a *= 0.5; } return s; };
  const pole = new THREE.Vector3(0.42, 0.5, -0.76).normalize(), gc = new THREE.Vector3(-0.55, 0.32, -0.77).normalize();
  const city = Math.atan2(CZ, CX), moonD = MOON_DIR;
  const w = 512, h = 256, gcv = document.createElement('canvas'); gcv.width = w; gcv.height = h; const gctx = gcv.getContext('2d'), img = gctx.createImageData(w, h);
  const enc = c => 255*(c <= 0.0031308 ? c*12.92 : 1.055*Math.pow(c, 1/2.4) - 0.055);
  for (let py=0; py<h; py++){ const lat = (0.5 - (py+0.5)/h)*Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let px=0; px<w; px++){ const lon = ((px+0.5)/w - 0.5)*Math.PI*2, dx = cl*Math.cos(lon), dy = sl, dz = cl*Math.sin(lon);
      const up = Math.max(0, sl);
      /* sky base: near-black zenith to a faint blue-green airglow band at the horizon */
      let r = 0.0009 + 0.010*Math.exp(-up/0.10), g = 0.0013 + 0.013*Math.exp(-up/0.10), b = 0.0035 + 0.020*Math.exp(-up/0.16);
      /* Milky Way with dust lanes, brightest toward the galactic center */
      const gb = Math.asin(dx*pole.x + dy*pole.y + dz*pole.z), cen = Math.max(0, dx*gc.x + dy*gc.y + dz*gc.z);
      const n = fbm(dx*3.2+7, dy*3.2, dz*3.2), n2 = fbm(dx*9+3, dy*9, dz*9+1);
      let mw = Math.exp(-Math.pow(gb/(0.16 + 0.10*cen), 2)) * (0.35 + 0.9*n) * (0.45 + 1.4*Math.pow(cen, 3));
      mw *= 1 - 0.75*Math.exp(-Math.pow((gb - 0.02*Math.sin(lon*3))/0.035, 2))*smooth(0.35, 0.65, n2);
      mw *= smooth(-0.02, 0.35, sl) * 0.020;
      r += mw*1.05; g += mw*0.98; b += mw*0.92;
      /* sodium-orange light dome over Roswell, cooler glow across the rest of the horizon */
      let da = Math.abs(((lon - city + Math.PI*3) % (Math.PI*2)) - Math.PI); const dome = Math.exp(-Math.pow(da/0.42, 2)) * Math.exp(-up/0.07) * (sl > -0.02 ? 1 : 0.4);
      r += dome*0.060; g += dome*0.032; b += dome*0.014;
      /* moon halo */
      const md = Math.max(0, dx*moonD.x + dy*moonD.y + dz*moonD.z); const halo = Math.pow(md, 60)*0.05 + Math.pow(md, 8)*0.006; r += halo*0.9; g += halo*0.95; b += halo;
      /* below the horizon: dark haze */
      if (sl < 0){ const k = smooth(0, -0.08, sl); r = r*(1-k) + 0.0018*k; g = g*(1-k) + 0.0021*k; b = b*(1-k) + 0.0032*k; }
      const o = (py*w + px)*4; img.data[o] = enc(r); img.data[o+1] = enc(g); img.data[o+2] = enc(b); img.data[o+3] = 255; } }
  gctx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(gcv, 0, 0, Wd, Hd);
  /* stars, denser along the band, dimmed near the horizon */
  const pal = ['#9db4ff','#aabfff','#cad7ff','#f8f7ff','#fff4ea','#ffe7c2','#ffd2a1','#ffc27a'], sc = Wd/4096;
  for (let i=0, n=0; n < 9000*sc*sc + 2500 && i < 60000; i++){ const z = Math.random()*2 - 1, t = Math.random()*Math.PI*2, cr = Math.sqrt(1 - z*z); const d = [cr*Math.cos(t), z, cr*Math.sin(t)];
    if (z < 0.01) continue; const band = Math.exp(-Math.pow(Math.asin(d[0]*pole.x + d[1]*pole.y + d[2]*pole.z)/0.2, 2));
    if (Math.random() > 0.35 + 0.65*band) continue; n++;
    const lat = Math.asin(z), lon = Math.atan2(d[2], d[0]), x = (lon/(Math.PI*2) + 0.5)*Wd, y = (0.5 - lat/Math.PI)*Hd;
    const m = Math.pow(Math.random(), 7), a = (0.2 + 0.62*Math.min(1, m*4 + Math.random()*0.5)) * smooth(0.0, 0.18, z), rad = (0.32 + 1.05*m)*Math.max(1, sc*1.15);
    ctx.fillStyle = pal[(Math.random()*pal.length)|0]; ctx.globalAlpha = a;
    ctx.save(); ctx.translate(x, y); ctx.scale(1/Math.max(0.15, Math.cos(lat)), 1); ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI*2); ctx.fill();
    if (m > 0.55){ const gr = ctx.createRadialGradient(0,0,0,0,0,rad*5); gr.addColorStop(0,'rgba(255,255,255,0.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.globalAlpha = a*0.6; ctx.fillRect(-rad*5,-rad*5,rad*10,rad*10); }
    ctx.restore(); }
  ctx.globalAlpha = 1;
  /* the moon itself, small and very bright */
  { const lat = Math.asin(moonD.y), lon = Math.atan2(moonD.z, moonD.x), x = (lon/(Math.PI*2) + 0.5)*Wd, y = (0.5 - lat/Math.PI)*Hd, rr = Wd/1300;
    ctx.save(); ctx.translate(x, y); ctx.scale(1/Math.cos(lat), 1); const gr = ctx.createRadialGradient(0,0,rr*0.6,0,0,rr*9); gr.addColorStop(0,'rgba(220,228,255,0.55)'); gr.addColorStop(1,'rgba(220,228,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(-rr*9,-rr*9,rr*18,rr*18); ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(150,150,160,0.35)'; ctx.beginPath(); ctx.arc(rr*0.25,-rr*0.2,rr*0.35,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-rr*0.3,rr*0.3,rr*0.22,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  const tx = new THREE.CanvasTexture(cv); tx.mapping = THREE.EquirectangularReflectionMapping; tx.encoding = THREE.sRGBEncoding; return tx;
}
const skyTex = makeSky(mobile ? 2048 : 4096);
scene.background = skyTex;
/* a sparse layer of the brightest stars as crisp points on top of the painted sky */
{ const n = 240, pos = new Float32Array(n*3), col = new Float32Array(n*3), pal = ['#aabfff','#cad7ff','#ffffff','#fff4ea','#ffd2a1'].map(c => new THREE.Color(c));
  for (let i=0;i<n;i++){ const u = Math.random()*Math.PI*2, v = 0.06 + Math.random()*0.9; const R = 450000;
    pos[i*3] = R*Math.cos(u)*Math.cos(v*Math.PI/2); pos[i*3+1] = R*Math.sin(v*Math.PI/2)+6000; pos[i*3+2] = R*Math.sin(u)*Math.cos(v*Math.PI/2);
    const c = pal[(Math.random()*pal.length)|0], b = 0.25 + Math.pow(Math.random(), 2)*0.5; /* stays under the bloom threshold so stars stay pin-sharp */ col[i*3] = c.r*b; col[i*3+1] = c.g*b; col[i*3+2] = c.b*b; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3)); g.setAttribute('color', new THREE.BufferAttribute(col,3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({size:1.3, sizeAttenuation:false, vertexColors:true, fog:false, transparent:true, opacity:.9, depthWrite:false})); scene.add(p); }

/* Roswell city lights and highway */
{ const pts = [], cols = []; const pal = ['#ffb46b','#ffd9a3','#fff2db','#ffc98a','#9fe6ff'].map(c => new THREE.Color(c));
  for (let gx=-42; gx<=42; gx++) for (let gz=-42; gz<=42; gz++){
    const x = gx*330, z = gz*330, d = Math.hypot(x, z/1.25);
    if (d > 13500) continue;
    const pr = Math.exp(-Math.pow(d/7000,2))*0.9 + 0.08;
    if (Math.random() > pr) continue;
    const n = 1 + (Math.random()*2|0);
    for (let k=0;k<n;k++){ const px = CX + x + (Math.random()-.5)*140, pz = CZ + z + (Math.random()-.5)*140;
      pts.push(px, H(px,pz)+25, pz); const c = pal[Math.random()<0.06 ? 4 : (Math.random()*4|0)]; cols.push(c.r,c.g,c.b); }
  }
  for (let i=0;i<120;i++){ const t = i/120; const px = CX - 1500 + t*(-9000 - (CX-1500)), pz = CZ - 13000 + t*(-30000 - (CZ-13000));
    if (Math.random()<0.55){ pts.push(px, H(px,pz)+20, pz); cols.push(1,0.75,0.45); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
  const pm = new THREE.PointsMaterial({size:2.4, sizeAttenuation:false, vertexColors:true, transparent:true, opacity:.95, depthWrite:false}); pm.color.setScalar(3.2); pm.userData.lin = true;
  scene.add(new THREE.Points(g, pm)); }

/* Twistflower Rd */
box(590, 0.3, 16, TX('asphalt','#2a2a29'), 305, 0.12, -78);
{ const L = 22000, a = Math.atan2(0.37, 0.93); const m = box(L, 0.3, 18, TX('asphalt','#2a2a29'), 600 + 0.93*L/2, 0.12, -78 - 0.37*L/2); m.rotation.y = a; }

const FEST = [[0,607,190],[-607,607,120],[607,607,60],[-431,176,125],[431,176,125],[-431,1043,125],[431,1043,125],[0,1221,125]];
const clearOf = (x, z, pad) => !(Math.hypot(x,z) < 70 - (pad||0) || FEST.some(f => Math.hypot(x-f[0], z-f[1]) < f[2]) || (x>-85 && x<15 && z>-150 && z<-55) || (z>-92 && z<-64 && x>-20));
/* merge several geometries into one non-indexed buffer, with optional per-part vertex colors */
function mergeParts(parts){ const pos = [], nor = [], col = [];
  parts.forEach(({g, c}) => { g = g.index ? g.toNonIndexed() : g; const P = g.attributes.position.array, Nn = g.attributes.normal.array; for (let i=0;i<P.length;i++){ pos.push(P[i]); nor.push(Nn[i]); }
    for (let i=0;i<P.length/3;i++){ const k = c ? c(P[i*3], P[i*3+1], P[i*3+2]) : 1; col.push(k, k, k); } });
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col,3)); return out; }
/* creosote and mesquite scrub: clusters of noisy lobes, darker at the base, soft spherical normals so they read as foliage rather than facets */
{ const parts = [];
  for (let k=0;k<6;k++){ const g = new THREE.IcosahedronGeometry(0.42 + Math.random()*0.25, 1), P = g.attributes.position, Nn = g.attributes.normal;
    const ox = (Math.random()-.5)*0.9, oy = 0.25 + Math.random()*0.45, oz = (Math.random()-.5)*0.9;
    for (let i=0;i<P.count;i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.hypot(x,y,z), j = 0.75 + 0.5*Math.abs(Math.sin(x*11.3 + y*7.1 + z*5.7 + k));
      P.setXYZ(i, ox + x*j, oy + y*j*0.8, oz + z*j); Nn.setXYZ(i, x/r, y/r, z/r); }
    parts.push({g, c:(x,y,z) => 0.45 + 0.55*Math.min(1, (oy + y)/0.9)}); }
  const geo = mergeParts(parts), N = mobile ? 700 : 1100;
  const sm = new THREE.MeshStandardMaterial({color:'#ffffff', roughness:1, vertexColors:true}); sm.userData.lin = true; const inst = new THREE.InstancedMesh(geo, sm, N); const o = new THREE.Object3D(); let n = 0;
  while (n < N){ const a = Math.random()*Math.PI*2, r = 40 + Math.pow(Math.random(), 0.8)*1560; const x = -20 + Math.cos(a)*r, z = -40 + Math.sin(a)*r;
    if (!clearOf(x, z)) continue;
    const s = 1.6 + Math.pow(Math.random(), 1.5)*4.2; o.position.set(x, -0.15, z); o.scale.set(s, s*(0.6+Math.random()*0.45), s); o.rotation.y = Math.random()*6; o.updateMatrix(); inst.setMatrixAt(n++, o.matrix);
    inst.setColorAt && inst.setColorAt(n-1, new THREE.Color().setHSL(0.2 + Math.random()*0.1, 0.14 + Math.random()*0.16, 0.15 + Math.random()*0.11).convertSRGBToLinear()); }
  inst.userData.cast = true; scene.add(inst); }
/* grama grass tufts: a fan of thin blades, straw colored */
{ const pos = [], col = [], blades = 9;
  for (let i=0;i<blades;i++){ const a = i/blades*Math.PI*2 + Math.random()*0.5, lean = 0.25 + Math.random()*0.45, hgt = 0.7 + Math.random()*0.8, w = 0.035;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa*w, pz = ca*w, tx = ca*lean, tz = sa*lean;
    pos.push(-px,0,-pz, px,0,pz, tx,hgt,tz); col.push(0.55,0.5,0.4, 0.55,0.5,0.4, 1.15,1.05,0.8); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
  const N = mobile ? 2500 : 5000, inst = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({color:'#9b8a62', roughness:1, side:THREE.DoubleSide, vertexColors:true}), N), o = new THREE.Object3D(); let n = 0;
  while (n < N){ const a = Math.random()*Math.PI*2, r = 12 + Math.pow(Math.random(), 1.6)*700, x = -20 + Math.cos(a)*r, z = -40 + Math.sin(a)*r;
    if (!clearOf(x, z, 25)) continue; const s = 0.7 + Math.random()*1.1; o.position.set(x, 0, z); o.rotation.y = Math.random()*6; o.scale.set(s, s*(0.7+Math.random()*0.6), s); o.updateMatrix(); inst.setMatrixAt(n++, o.matrix); }
  scene.add(inst); }
/* caliche rocks */
{ const g = new THREE.DodecahedronGeometry(1, 1), P = g.attributes.position; for (let i=0;i<P.count;i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i), j = 0.8 + 0.35*Math.sin(x*5.1 + y*3.7 + z*4.3); P.setXYZ(i, x*j, y*j*0.6, z*j); } g.computeVertexNormals();
  const N = mobile ? 500 : 900, inst = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({color:'#8a8274', roughness:0.95}), N), o = new THREE.Object3D(); let n = 0;
  while (n < N){ const a = Math.random()*Math.PI*2, r = 15 + Math.pow(Math.random(), 1.4)*900, x = -20 + Math.cos(a)*r, z = -40 + Math.sin(a)*r;
    if (!clearOf(x, z, 25)) continue; const s = 0.15 + Math.pow(Math.random(), 3)*1.4; o.position.set(x, s*0.1, z); o.rotation.set(Math.random(), Math.random()*6, Math.random()); o.scale.setScalar(s); o.updateMatrix(); inst.setMatrixAt(n++, o.matrix); }
  inst.userData.cast = true; scene.add(inst); }

/* fences: galvanized chain link on steel posts with a top rail */
{ const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0,0,64,64); c.strokeStyle = '#fff'; c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(0,32); c.lineTo(32,0); c.lineTo(64,32); c.lineTo(32,64); c.closePath(); c.moveTo(-32,32); c.lineTo(0,0); c.moveTo(64,0); c.lineTo(96,32); c.stroke();
  const alpha = new THREE.CanvasTexture(cv); alpha.wrapS = alpha.wrapT = THREE.RepeatWrapping; alpha.anisotropy = maxAniso;
  const mesh = new THREE.MeshStandardMaterial({color:'#9c9d9a', metalness:0.75, roughness:0.45, alphaMap:alpha, transparent:true, opacity:0.75, depthWrite:false, side:THREE.DoubleSide});
  const steel = new THREE.MeshStandardMaterial({color:'#8d8e8b', metalness:0.8, roughness:0.4});
  const postG = new THREE.CylinderGeometry(0.12, 0.12, 1, 8), posts = [];
  const sq = (cx,cz,hw,hd,h,step) => { const c4 = [[cx-hw,cz-hd],[cx+hw,cz-hd],[cx+hw,cz+hd],[cx-hw,cz+hd],[cx-hw,cz-hd]];
    for (let i=0;i<4;i++){ const [x0,z0] = c4[i], [x1,z1] = c4[i+1], L = Math.hypot(x1-x0, z1-z0), ang = -Math.atan2(z1-z0, x1-x0);
      const pg = new THREE.PlaneGeometry(L, h-0.3); const uv = pg.attributes.uv; for (let k=0;k<uv.count;k++) uv.setXY(k, uv.getX(k)*L/0.4, uv.getY(k)*(h-0.3)/0.4);
      const m = add(pg, mesh, (x0+x1)/2, (h-0.3)/2 + 0.15, (z0+z1)/2); m.rotation.y = ang;
      const rail = add(new THREE.CylinderGeometry(0.07, 0.07, L, 6), steel, (x0+x1)/2, h, (z0+z1)/2); rail.rotation.set(0, ang, Math.PI/2);
      const n = Math.ceil(L/step); for (let k=0;k<n;k++){ const t = k/n; posts.push([x0+(x1-x0)*t, z0+(z1-z0)*t, h]); } } };
  sq(-20,-40,240,240,7,10); sq(-30,-90,40,42,6,10);
  const inst = new THREE.InstancedMesh(postG, steel, posts.length), o = new THREE.Object3D();
  posts.forEach(([x,z,h], i) => { o.position.set(x, h/2 + 0.2, z); o.scale.set(1, h + 0.4, 1); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); });
  inst.userData.cast = true; scene.add(inst); }

/* ---------- surface features ---------- */
/* silo cap with door opening */
{ const s = new THREE.Shape(); s.absarc(0,0,35,0,Math.PI*2,false); s.holes.push(rectPath(-16.5,-11,16.5,11));
  const g = new THREE.ExtrudeGeometry(s, {depth:3.5, bevelEnabled:false, curveSegments:48}); g.rotateX(-Math.PI/2); g.translate(0,-2,0); add(g, TX('cap','#6c6c69')); }
{ const rail = M('#4a4a48', {metalness:0.7, roughness:0.55}); box(34,0.5,1.2, rail, 0,1.75,-11.6); box(34,0.5,1.2, rail, 0,1.75,11.6); }
/* propped-open door leaves */
[-1,1].forEach(side => { const piv = new THREE.Group(); piv.position.set(side*16.5, 1.5, 0); scene.add(piv);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(16.5,2.5,22), TX('panel','#8c8c89', {metalness:0.35, roughness:0.85})); leaf.position.set(-side*8.25, 1.25, 0); piv.add(leaf);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(14,0.15,1), G('#FF7E1D')); strip.position.set(-side*8.25, 2.55, 0); piv.add(strip);
  piv.rotation.z = -side*1.86; });
/* west pad, north vent, hatch, antenna silo */
box(30,0.9,34, TX('cap','#5d5c59'), -50,0.45,0); box(0.4,0.1,34, M('#2c2c2b'), -50,0.95,0); box(30,0.1,0.4, M('#2c2c2b'), -50,0.95,0);
box(9,1,7, TX('cap','#5d5c59'), 6,0.5,-50); box(2,0.1,3, M('#151515'), 4,1.02,-50); box(2,0.1,3, M('#151515'), 8,1.02,-50);
add(new THREE.CylinderGeometry(2.8,2.8,1.2,24), TX('panel','#7a7a77', {metalness:0.4, roughness:0.8}), -45,0.6,-95);
add(new THREE.CylinderGeometry(4,4,0.8,28), TX('cap','#6a6a67'), -63,0.4,-130);
/* entry bulkhead, from the site photo: open white portal with a recessed door, pink wedge sloping back to grade over the stairs */
{ const s = new THREE.Shape(); s.moveTo(20.5,0); s.lineTo(30,0); s.lineTo(30,9.8); s.lineTo(27.5,9.8); s.lineTo(20.5,0);
  const g = new THREE.ExtrudeGeometry(s, {depth:6, bevelEnabled:false}); g.rotateY(Math.PI/2); g.translate(21.5,0,0); const m = new THREE.Mesh(g, TX('cap','#c99aa0', {chroma:0.85})); LG.add(m); }
const white = TX('painted','#e6e2da');
wb(21.5,27.5,0,9.8,-30.12,-30.02,white);
wb(21.5,27.5,9.0,9.8,-34,-30,white); wb(21.5,22.1,0,9.8,-34,-30,white); wb(26.9,27.5,0,9.8,-34,-30,white);
wb(21.5,27.5,-0.1,0.25,-34.6,-30,TX('concrete','#77756f'));
wb(23,26,0.3,7.3,-30.25,-30.1,TX('panel','#4d6a64', {metalness:0.4, roughness:0.7, chroma:0.9}));
wb(23.5,25.5,8.2,8.5,-30.3,-30.2,G('#01CFFE'));

/* ---------- surface stairs: one straight flight down to the top of the stair shaft ---------- */
const conc = TX('concrete','#bdb9ae', {side:THREE.DoubleSide}), stepM = TX('plate','#8a6f55', {metalness:0.45, roughness:0.8});
wb(21.5,27.5,-0.3,0,-30,-24.5,TX('concrete','#77756f'));
{ const geo = new THREE.BoxGeometry(4.4,0.75,1.16);
  for (let i=0;i<16;i++){ const lz = -25 + (i+0.5)*1.125, top = -(i+1)*0.75; const m = new THREE.Mesh(geo, stepM); m.position.set(24.5, top-0.375, lz); LG.add(m); } }
{ const L = Math.hypot(12, 18.6); const m = new THREE.Mesh(new THREE.BoxGeometry(4.6, 8.5, L), [conc,conc,conc,conc,HIDE,HIDE]);
  m.position.set(24.5, (4.2 + -7.8)/2, (-25.4 + -6.8)/2); m.rotation.x = Math.atan2(12, 18.6); LG.add(m); }

/* ---------- stair shaft between the LCC and the tunnel: blast doors at the top, switchbacks to both LCC levels and the tunnel ---------- */
{ const w = conc;
  wb(22.3,22.7,-32,-5,-7,-2,w); wb(22.3,22.7,-32,-5,2,7,w); wb(22.3,22.7,-32,-31,-2,2,w); wb(22.3,22.7,-24,-21.5,-2,2,w); wb(22.3,22.7,-14,-5,-2,2,w);
  wb(38.3,38.7,-32,-5,-7,-4,w); wb(38.3,38.7,-32,-5,4,7,w); wb(38.3,38.7,-32,-31,-4,4,w); wb(38.3,38.7,-23,-5,-4,4,w);
  wb(22.5,23,-32,-5,-7.2,-6.8,w); wb(26,38.5,-32,-5,-7.2,-6.8,w); wb(23,26,-32,-12,-7.2,-6.8,w);
  wb(22.5,38.5,-32,-5,6.8,7.2,w);
  wb(22.5,38.5,-5.4,-5,-7,7,w); wb(22.5,38.5,-32,-31,-7,7,TX('floor','#6e6a62')); }
wb(22.5,26,-12.5,-12,-7,-3,TX('floor','#7a766d'));
{ const geo = new THREE.BoxGeometry(0.88,0.75,4); for (let i=0;i<12;i++){ const m = new THREE.Mesh(geo, stepM); m.position.set(26+(i+0.5)*10/12, -12-(i+1)*0.75-0.375, -5); LG.add(m); } }
wb(36,38.5,-21.5,-21,-7,7,TX('floor','#7a766d'));
wb(22.5,36,-21.5,-21,-2,2,TX('floor','#7a766d'));
{ const geo = new THREE.BoxGeometry(0.97,0.77,4); for (let i=0;i<13;i++){ const m = new THREE.Mesh(geo, stepM); m.position.set(36-(i+0.5)*12/13, -21-(i+1)*10/13-0.385, 5); LG.add(m); } }
wb(22.5,36,-17.6,-17.45,2.05,2.2,M('#9a9a97', {metalness:0.8, roughness:0.35})); wb(26,36,-17.6,-17.45,-2.2,-2.05,M('#9a9a97', {metalness:0.8, roughness:0.35}));
/* blast door frames: at the shaft top, and at each LCC level */
wb(23,26,-5.4,-4.9,-7.6,-6.6,M('#6b6b69', {metalness:0.6, roughness:0.6})); wb(22.6,23,-12,-5,-7.6,-6.6,M('#6b6b69', {metalness:0.6, roughness:0.6})); wb(26,26.4,-12,-5,-7.6,-6.6,M('#6b6b69', {metalness:0.6, roughness:0.6}));
wb(26.5,29.8,-12,-5.6,-6.75,-6.25,TX('panel','#8a8a87', {metalness:0.5, roughness:0.7})); wb(26.8,29.5,-8.2,-7.8,-6.25,-6.2,G('#FF7E1D'));
[-21,-31].forEach(y0 => { wb(19.5,22.7,y0-0.1,y0,-2,2,TX('floor','#77756f')); const m = new THREE.Mesh(new THREE.BoxGeometry(3.2,7,4), [HIDE,HIDE,conc,conc,conc,conc]); m.position.set(21.1,y0+3.5,0); LG.add(m); });
const bulb = (p, c) => { const b = add(new THREE.SphereGeometry(0.22, 12, 8), G(c), p.x, p.y + 0.6, p.z); const cage = add(new THREE.CylinderGeometry(0.3,0.3,0.55,8,1,true), M('#2a2a2a', {metalness:0.6, wireframe:true}), p.x, p.y + 0.6, p.z); return b; };
{ const l = new THREE.PointLight('#e8f4ff', 0.9, 22, 1.5); l.position.copy(W(26,-3,-8)); scene.add(l); bulb(l.position, '#f2f8ff'); }
{ const l = new THREE.PointLight('#e8f4ff', 0.8, 24, 1.5); l.position.copy(W(30,0,-25)); scene.add(l); bulb(l.position, '#f2f8ff'); }
{ const l = new THREE.PointLight('#fff1d6', 0.5, 28, 1.5); l.position.copy(W(24.5,-16,-3)); scene.add(l); bulb(l.position, '#fff1d6'); }

/* ---------- launch control center: 40 ft across, two levels of about 10 ft, open rooms around a central column ---------- */
const TUN = Math.atan2(UX, UZ); /* toward the shaft and silo */
const lccWall = TX('painted','#d9d5cc', {side:THREE.DoubleSide});
function wallBand(r, y0, y1, gapAt, gapW, mat){
  const g = gapW ? new THREE.CylinderGeometry(r,r,y1-y0,48,1,true, gapAt+gapW, Math.PI*2-2*gapW) : new THREE.CylinderGeometry(r,r,y1-y0,48,1,true);
  return add(g, mat, C.x, (y0+y1)/2, C.z); }
wallBand(20,-14,-11,0,0,lccWall); wallBand(20,-21,-14,TUN,0.12,lccWall);
/* Level -2: immersive projection, the walls become moving pictures of deep space */
const projCanvas = document.createElement('canvas'); projCanvas.width = 1024; projCanvas.height = 256; const pctx = projCanvas.getContext('2d');
const projA = new THREE.CanvasTexture(projCanvas), projB = new THREE.CanvasTexture(projCanvas);
[projA, projB].forEach(tx => { tx.wrapS = THREE.RepeatWrapping; });
projA.repeat.set(3, 2/9); projA.offset.set(0, 7/9); projB.repeat.set(3*(Math.PI*2-0.24)/(Math.PI*2), 7/9);
wallBand(20,-24,-22,0,0,new THREE.MeshBasicMaterial({map:projA, side:THREE.DoubleSide}));
wallBand(20,-31,-24,TUN,0.12,new THREE.MeshBasicMaterial({map:projB, side:THREE.DoubleSide}));
const starsP = Array.from({length:420}, () => ({x:Math.random()*1024, y:Math.random()*256, r:Math.random()*1.4+0.3, v:4+Math.random()*10, ph:Math.random()*6}));
function drawSpace(s){
  const g = pctx.createLinearGradient(0,0,0,256); g.addColorStop(0,'#01020a'); g.addColorStop(1,'#0a1030'); pctx.fillStyle = g; pctx.fillRect(0,0,1024,256);
  const blob = (x,y,r,c) => { for (const dx of [-1024,0,1024]){ const rg = pctx.createRadialGradient(x+dx,y,0,x+dx,y,r); rg.addColorStop(0,c); rg.addColorStop(1,'rgba(0,0,0,0)'); pctx.fillStyle = rg; pctx.fillRect(x+dx-r,y-r,2*r,2*r); } };
  pctx.globalCompositeOperation = 'lighter';
  blob((s*6)%1024, 110+20*Math.sin(s*0.2), 170, 'rgba(1,207,254,0.22)');
  blob((420+s*4)%1024, 150+25*Math.cos(s*0.15), 210, 'rgba(5,122,217,0.30)');
  blob((760+s*9)%1024, 90, 140, 'rgba(255,140,1,0.18)');
  pctx.globalCompositeOperation = 'source-over';
  starsP.forEach(p => { const x = (p.x + s*p.v) % 1024; pctx.globalAlpha = 0.5 + 0.5*Math.sin(s*2 + p.ph); pctx.fillStyle = '#ffffff'; pctx.fillRect(x, p.y, p.r, p.r); }); pctx.globalAlpha = 1;
  const px = (200 + s*12) % 1024;
  for (const dx of [-1024,0,1024]){ const cx = px+dx; if (cx < -120 || cx > 1144) continue;
    const pg = pctx.createRadialGradient(cx-25,110,8,cx,128,78); pg.addColorStop(0,'#bfe9ff'); pg.addColorStop(0.45,'#2f7fd0'); pg.addColorStop(1,'#061430');
    pctx.fillStyle = pg; pctx.beginPath(); pctx.arc(cx,128,74,0,Math.PI*2); pctx.fill();
    pctx.fillStyle = 'rgba(0,0,8,0.55)'; pctx.beginPath(); pctx.arc(cx+30,128,74,-Math.PI/2,Math.PI/2); pctx.fill();
    pctx.fillStyle = '#d9d6cf'; pctx.beginPath(); pctx.arc(cx+130,80+10*Math.sin(s*0.5),14,0,Math.PI*2); pctx.fill(); }
  const k = (s*0.37)%1; if (k < 0.25){ const sx = (s*97)%1024, sy = 40+((s*53)%120); pctx.strokeStyle = 'rgba(255,238,169,'+(1-k*4)+')'; pctx.lineWidth = 2; pctx.beginPath(); pctx.moveTo(sx,sy); pctx.lineTo(sx-60,sy+18); pctx.stroke(); }
  projA.needsUpdate = true; projB.needsUpdate = true;
}
let lastDraw = 0; animators.push(s => { if (s - lastDraw > 1/30){ drawSpace(s); lastDraw = s; } });
drawSpace(0);
{ const g = new THREE.SphereGeometry(20,32,8,0,Math.PI*2,0,Math.PI/2); const m = add(g, TX('painted','#cfcac0', {side:THREE.DoubleSide}), C.x,-11,C.z); m.scale.y = 0.18; }
{ const g = new THREE.CylinderGeometry(19.8,19.8,1,48); add(g, [TX('painted','#8c8a7e'),TX('floor','#8c8a7e', {roughness:0.85}),M('#0a0c14')], C.x,-21.5,C.z); }
{ const g = new THREE.CircleGeometry(19.8,48); g.rotateX(-Math.PI/2); add(g, TX('floor','#121522', {side:THREE.DoubleSide, roughness:0.6}), C.x,-31,C.z); }
/* central column with its flared capital at each ceiling (both visible in the site photos) */
add(new THREE.CylinderGeometry(1.7,1.7,20,32), TX('painted','#e3dfd6'), C.x,-21,C.z);
add(new THREE.CylinderGeometry(6,1.7,3.5,48,1,true), TX('painted','#e3dfd6', {side:THREE.DoubleSide}), C.x,-12.75,C.z);
add(new THREE.CylinderGeometry(5,1.7,3,48,1,true), TX('painted','#e3dfd6', {side:THREE.DoubleSide}), C.x,-23.5,C.z);
const ringAt = (r, tube, y, color) => { const m = add(new THREE.TorusGeometry(r,tube,4,72), G(color), C.x,y,C.z); m.rotation.x = Math.PI/2; return m; };
ringAt(6, 0.14, -11.1, '#FF8C01'); ringAt(19.5, 0.13, -12.2, '#FF8C01'); 
/* Level -1, restaged as 1962: a ring of control panels, the launch console, and a crew of five at work */
const near = (a,c,w) => Math.abs(((a-c+Math.PI*3)%(Math.PI*2))-Math.PI) < w;
const blinkers = [];
/* 1962 CRT faces: phosphor traces and scanlines behind glass */
function crt(bg, fg){ const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d');
  const g = c.createRadialGradient(128,64,10,128,64,150); g.addColorStop(0, bg); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(0,0,256,128);
  c.strokeStyle = fg; c.lineWidth = 2; c.globalAlpha = 0.9; c.beginPath(); for (let x=8;x<248;x+=2){ const y = 64 + 26*Math.sin(x*0.07)*Math.cos(x*0.013) + (Math.random()-.5)*4; x === 8 ? c.moveTo(x,y) : c.lineTo(x,y); } c.stroke();
  c.globalAlpha = 0.35; c.lineWidth = 1; for (let x=16;x<256;x+=32){ c.beginPath(); c.moveTo(x,6); c.lineTo(x,122); c.stroke(); } for (let y=16;y<128;y+=28){ c.beginPath(); c.moveTo(6,y); c.lineTo(250,y); c.stroke(); }
  c.globalAlpha = 0.25; c.fillStyle = '#000'; for (let y=0;y<128;y+=3) c.fillRect(0,y,256,1); c.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; const m = new THREE.MeshBasicMaterial({map:t}); m.color.setScalar(1.8); m.userData.lin = true; return m; }
const crtA = crt('#1d7a4f', '#8dffb9'), crtB = crt('#13435a', '#8fe3ff');
const panelA = TX('panel','#7f8a84', {metalness:0.45, roughness:0.6, chroma:0.9}), panelB = TX('panel','#6f7a75', {metalness:0.45, roughness:0.6, chroma:0.9});
{ const pal = ['#FF0000','#FFEEA9','#01CFFE','#FF7E1D','#7CFF8A','#FFEEA9'];
  for (let i=0;i<14;i++){ const a = TUN + 0.55 + i*(Math.PI*2-1.1)/13; const g = new THREE.Group(); g.position.set(C.x+18.2*Math.sin(a), -17.75, C.z+18.2*Math.cos(a)); g.rotation.y = a + Math.PI; scene.add(g);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(3.8,6.5,1.6), i%3 ? panelA : panelB));
    const sc = new THREE.Mesh(new THREE.BoxGeometry(2.4,1.3,0.08), i%4===0 ? crtA : crtB); sc.position.set(0,1.9,0.82); g.add(sc);
    for (let k=0;k<12;k++){ const li = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.22,0.08), G(pal[(i*3+k)%pal.length])); li.position.set(-1.35+(k%6)*0.54, 0.6-Math.floor(k/6)*0.45, 0.82); g.add(li); blinkers.push(li); }
    for (let k=0;k<4;k++){ const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.08,20), M('#e8e4d8', {roughness:0.35})); d.rotation.x = Math.PI/2; d.position.set(-1.2+k*0.8,-0.6,0.82); g.add(d); }
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.25,1.4), TX('panel','#5d6763', {metalness:0.5, roughness:0.55})); desk.position.set(0,-0.6,1.4); g.add(desk); } }
{ const a = TUN + Math.PI; const g = new THREE.Group(); g.position.set(C.x+11*Math.sin(a), -21, C.z+11*Math.cos(a)); g.rotation.y = a; scene.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(9,2.8,3), panelA); body.position.y = 1.4; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(9,1.6,0.6), panelB); top.position.set(0,3.4,-1.1); top.rotation.x = -0.35; g.add(top);
  for (let k=0;k<14;k++){ const li = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.25,0.08), G(['#FF0000','#01CFFE','#FFEEA9','#FF7E1D'][k%4])); li.position.set(-3.9+k*0.6, 3.5, -0.75); li.rotation.x = -0.35; g.add(li); blinkers.push(li); }
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.2,0.7), G('#FF0000')); key.position.set(0,2.9,0.6); g.add(key); }
animators.push(s => { const tick = Math.floor(s*4); if (tick !== animators._t){ animators._t = tick; for (let i=0;i<8;i++){ const b = blinkers[(Math.random()*blinkers.length)|0]; b.visible = !b.visible; } } });
/* people: photographs of real crew and visitors (OpenArt Nano Banana Pro, shot on chroma green and keyed into people/*.webp),
   standing upright and turning to face the camera, with a soft contact shadow on the floor */
const cutouts = [], shadowMat = new THREE.MeshBasicMaterial({color:'#000000', transparent:true, opacity:0.4, depthWrite:false}); shadowMat.userData.lin = true;
function cutout(file, x, y, z, h){ const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({roughness:1, metalness:0, alphaTest:0.5, side:THREE.DoubleSide, emissive:new THREE.Color(1,1,1), emissiveIntensity:0.22}); mat.userData.lin = true;
  const m = new THREE.Mesh(g, mat); m.scale.set(h*0.36, h, 1); m.position.set(x, y, z); scene.add(m);
  texLoader.load('people/' + file + '.webp', t => { t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso; mat.map = t; mat.emissiveMap = t; mat.needsUpdate = true; m.scale.x = h*t.image.width/t.image.height; });
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), shadowMat); sh.rotation.x = -Math.PI/2; sh.position.set(x, y + 0.03, z); sh.scale.y = 0.55; scene.add(sh);
  cutouts.push(m); return m; }
/* Level -1, 1962 crew at the consoles; Level -2, visitors taking in the projections */
[['crew-1', 12.5, TUN+1.9, 6.0], ['crew-2', 14.5, TUN+4.1, 5.8], ['crew-3', 9.5, TUN+3.1, 5.5], ['crew-4', 8.3, TUN+Math.PI-0.25, 5.9], ['crew-5', 8.3, TUN+Math.PI+0.25, 5.8]]
  .forEach(([f, r, a, h]) => cutout(f, C.x + r*Math.sin(a), -21, C.z + r*Math.cos(a), h));
[['visitor-1', 4.2, 9, 5.5], ['visitor-2', 2.2, 7, 5.9], ['visitor-3', 5.6, 11.5, 5.5], ['visitor-4', 3.3, 13, 6.0]]
  .forEach(([f, a, r, h]) => cutout(f, C.x + r*Math.sin(a), -31, C.z + r*Math.cos(a), h));
animators.push(() => cutouts.forEach(m => { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); }));
{ const l = new THREE.PointLight('#e8f0ff', 1.05, 42, 1.4); l.position.set(C.x,-13,C.z); scene.add(l); }
/* fluorescent fixtures around the Level -1 ceiling */
for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 + 0.31, r = 13.5, f = add(new THREE.BoxGeometry(0.5, 0.18, 4.2), G('#f4f8ff'), C.x + r*Math.sin(a), -11.7 + 0.18*Math.pow(r/20, 2)*3.6, C.z + r*Math.cos(a)); f.rotation.y = a + Math.PI/2;
  const hous = add(new THREE.BoxGeometry(0.9, 0.22, 4.6), M('#cfcfcb', {metalness:0.3, roughness:0.5}), f.position.x, f.position.y + 0.16, f.position.z); hous.rotation.y = f.rotation.y; }
{ const l = new THREE.PointLight('#3f6fd8', 0.7, 40, 1.4); l.position.set(C.x,-25,C.z); scene.add(l); }

/* ---------- tunnel: about 40 ft from the stair shaft to the silo, with a blast-door vestibule near the silo ---------- */
const TA = W(38.5,0,-27), TB = W(79.1,0,-27);
const tdir = TB.clone().sub(TA).normalize(), tlen = TA.distanceTo(TB);
{ const g = new THREE.CylinderGeometry(4,4,tlen+1,40,1,true); const m = add(g, TX('corrugated','#3e4448', {side:THREE.DoubleSide, metalness:0.55, roughness:0.75}), (TA.x+TB.x)/2, -27, (TA.z+TB.z)/2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), tdir); m.userData.uvRot = true;
  const rg = new THREE.TorusGeometry(3.95,0.16,8,40), rm = M('#5c6267', {metalness:0.7, roughness:0.5});
  for (let i=1;i<14;i++){ const p = TA.clone().addScaledVector(tdir, tlen*i/14); const r = add(rg, rm, p.x, p.y, p.z); r.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), tdir); }
  [0.05,0.62,0.93].forEach(f => { const p = TA.clone().addScaledVector(tdir, tlen*f); const r = add(new THREE.TorusGeometry(3.8,0.6,10,40), TX('panel','#757573', {metalness:0.5, roughness:0.7}), p.x,p.y,p.z); r.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), tdir);
    add(new THREE.BoxGeometry(0.6,0.3,0.6), G('#FF7E1D'), p.x, -23.3, p.z); });
  const fl = add(new THREE.BoxGeometry(3.4,0.2,tlen), TX('plate','#55595c', {metalness:0.6, roughness:0.6}), (TA.x+TB.x)/2, -30.4, (TA.z+TB.z)/2); fl.rotation.y = Math.atan2(tdir.x, tdir.z);
  [0.3,0.75].forEach(f => { const p = TA.clone().addScaledVector(tdir, tlen*f); const l = new THREE.PointLight('#7fe3ff', 0.9, 26, 1.5); l.position.set(p.x,-24,p.z); scene.add(l);
    const fx = add(new THREE.BoxGeometry(0.45, 0.2, 2.4), G('#bff3ff'), p.x, -23.25, p.z); fx.rotation.y = Math.atan2(tdir.x, tdir.z); }); }
const vest = TX('concrete','#4a4f53', {side:THREE.DoubleSide});
{ const m = new THREE.Mesh(new THREE.BoxGeometry(9,9,9), [HIDE,HIDE,vest,vest,vest,vest]); m.position.set(68.5,-26.5,0); LG.add(m); }
{ const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0,0,64,64); c.fillStyle = '#fff';
  for (let i=0;i<64;i+=16){ c.fillRect(i, 0, 4, 64); } c.fillRect(0, 0, 64, 3); c.fillRect(0, 32, 64, 3);
  const a = new THREE.CanvasTexture(cv); a.wrapS = a.wrapT = THREE.RepeatWrapping; a.anisotropy = maxAniso; a.repeat.set(13, 14);
  const grate = new THREE.MeshStandardMaterial({color:'#5f6367', metalness:0.7, roughness:0.55, alphaMap:a, alphaTest:0.5, side:THREE.DoubleSide});
  wb(79.6,86,-31.1,-31,-3.5,3.5,grate); wb(79.6,86,-31.4,-31.1,-3.5,-3.2,M('#5f6367', {metalness:0.7, roughness:0.5})); wb(79.6,86,-31.4,-31.1,3.2,3.5,M('#5f6367', {metalness:0.7, roughness:0.5})); }

/* ---------- silo shaft ---------- */
const SG = Math.atan2(-0.428,-0.904);
const siloWall = TX('silo','#4b4b49', {side:THREE.DoubleSide, chroma:0.5});
function shaftBand(y0,y1,gap){ const g = gap ? new THREE.CylinderGeometry(26,26,y1-y0,48,1,true, SG+0.17, Math.PI*2-0.34) : new THREE.CylinderGeometry(26,26,y1-y0,48,1,true);
  return add(g, siloWall, 0,(y0+y1)/2,0); }
shaftBand(-23,-2,false); shaftBand(-31,-23,true); shaftBand(-176,-31,false);
{ const g = new THREE.CircleGeometry(26,48); g.rotateX(-Math.PI/2); add(g, TX('floor','#262626', {side:THREE.DoubleSide, roughness:0.7}), 0,-176,0); }
const siloRing = TX('concrete','#595957', {side:THREE.DoubleSide});
for (let i=0;i<8;i++){ const g = new THREE.RingGeometry(23.6,26,64); g.rotateX(-Math.PI/2); add(g, siloRing, 0,-44-i*16.5,0); }
add(new THREE.CylinderGeometry(4,5,2,16), G('#34D9FD'), 0,-175,0);
add(new THREE.SphereGeometry(7,16,10), new THREE.MeshBasicMaterial({color:'#34D9FD', transparent:true, opacity:.35, blending:THREE.AdditiveBlending, depthWrite:false}), 0,-172,0);
const shaftLight = new THREE.PointLight('#5fdcff', 2.4, 270, 1.3); shaftLight.position.set(0,-150,0); scene.add(shaftLight);
const warmLight = new THREE.PointLight('#ff9a3a', 1.1, 130, 1.5); warmLight.position.set(0,-60,0); scene.add(warmLight);
for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 + 0.2; [-60, -110, -150].forEach((y, k) => add(new THREE.SphereGeometry(0.35, 10, 8), G(k === 0 ? '#ffb46b' : '#9fe9ff'), 25.4*Math.sin(a), y, 25.4*Math.cos(a))); }

/* ---------- lasers ---------- */
/* Beams through haze: brightest along the axis (facing ratio), fading with altitude. Additive, HDR so the bloom pass picks them up. */
function beamMat(c, gain, pw){ return new THREE.ShaderMaterial({ uniforms:{color:{value:new THREE.Color(c).convertSRGBToLinear().multiplyScalar(gain)}, pw:{value:pw}},
  vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV; varying float vH;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vH = uv.y; gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
  fragmentShader:`uniform vec3 color; uniform float pw; varying vec3 vN; varying vec3 vV; varying float vH;
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
  float f = pow(abs(dot(normalize(vN), normalize(vV))), pw); float fade = 1.0 - smoothstep(0.3, 1.0, vH);
  gl_FragColor = vec4(color * f * fade, 1.0); }`,
  transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false }); }
const beams = [];
['#34D9FD','#057AD9','#FFEEA9','#FF8C01','#34D9FD','#FFEEA9'].forEach((c,i) => {
  const grp = new THREE.Group(); grp.position.set(0,-174,0); scene.add(grp); const Hh = 64000;
  const core = new THREE.CylinderGeometry(60,0.35,Hh,8,1,true); core.translate(0,Hh/2,0);
  const halo = new THREE.CylinderGeometry(280,2.4,Hh,8,1,true); halo.translate(0,Hh/2,0);
  grp.add(new THREE.Mesh(core, beamMat(c, 3.2, 5.0)));
  grp.add(new THREE.Mesh(halo, beamMat(c, 0.16, 1.6)));
  beams.push({grp, ph:i*1.7, ax:0.026+0.008*(i%3), az:0.022+0.007*(i%2), sp:0.16+0.05*i});
});

/* gooseneck vents beside the entry (seen in the LiDAR photo) and the LCC's central column */
[W(30,-26,0),W(18.5,-22,0)].map(v => [v.x,v.z]).forEach(([x,z]) => { add(new THREE.CylinderGeometry(0.5,0.5,4,8), M('#9a9a97'), x,2,z); const t = add(new THREE.TorusGeometry(1.4,0.5,6,12,Math.PI), M('#9a9a97'), x+1.4,4,z); add(new THREE.CylinderGeometry(0.5,0.5,2.5,8), M('#9a9a97'), x+2.8,2.75,z); });

/* ---------- festival build (positions follow the published festival map; sizes approximate) ---------- */
const flatRing = (r, w, color, x, z, op) => { const g = new THREE.RingGeometry(r-w/2, r+w/2, 72); g.rotateX(-Math.PI/2); return add(g, new THREE.MeshBasicMaterial({color, transparent:true, opacity:op||0.85, depthWrite:false}), x, 0.35, z); };
const pathMat = TX('cap','#46454a', {chroma:0.4});
function path(x0,z0,x1,z1){ const L = Math.hypot(x1-x0,z1-z0); const m = box(L,0.25,7, pathMat, (x0+x1)/2,0.15,(z0+z1)/2); m.rotation.y = -Math.atan2(z1-z0, x1-x0); }
const BC = [0,607];
[[-607,607],[607,607],[-431,176],[431,176],[-431,1043],[431,1043],[0,1221],[0,40]].forEach(([x,z]) => path(BC[0],BC[1],x,z));
path(431,176,640,-60);
/* Base Camp: ring of food and vendor stalls around a gathering circle */
flatRing(170, 3, '#0077D8', BC[0], BC[1]);
for (let i=0;i<24;i++){ const a = i/24*Math.PI*2; const m = box(14,9,14, M('#d9d9d6'), BC[0]+150*Math.sin(a), 4.5, BC[1]+150*Math.cos(a)); m.rotation.y = a; }
{ const g = new THREE.CircleGeometry(42,40); g.rotateX(-Math.PI/2); add(g, new THREE.MeshBasicMaterial({color:'#0a3f7a'}), BC[0],0.3,BC[1]); }
flatRing(42, 2.5, '#ffffff', BC[0], BC[1], 0.7);
add(new THREE.ConeGeometry(3,6,6), G('#FF8C01'), BC[0],3,BC[1]);
{ const l = new THREE.PointLight('#ff9a3a', 1.2, 160, 1.6); l.position.set(BC[0],12,BC[1]); scene.add(l); }
/* Twistflower Stage: arch and two crescent trusses, facing Base Camp */
{ const sx = -607, sz = 607; const g = new THREE.Group(); g.position.set(sx,0,sz); scene.add(g);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(34,2,6,28,Math.PI), M('#cfcfcc')); arch.rotation.y = Math.PI/2; arch.position.y = 6; g.add(arch);
  for (let i=1;i<12;i++){ const a = i/12*Math.PI; const s = new THREE.Mesh(new THREE.SphereGeometry(1.4,8,6), G('#34D9FD')); s.position.set(0, 6+34*Math.sin(a), 34*Math.cos(a)); g.add(s); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(34,6,60), M('#5e5e5b')); deck.position.set(-4,3,0); g.add(deck);
  const booth = new THREE.Mesh(new THREE.BoxGeometry(6,4,12), M('#8a8a87')); booth.position.set(6,8,0); g.add(booth);
  [[0.45,1.25],[-1.25,-0.45]].forEach(([a0,a1]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(80,80,5,24,1,true, Math.PI/2+a0, a1-a0), D('#bdbdba')); b.position.y = 16; g.add(b);
    for (let k=0;k<=4;k++){ const a = Math.PI/2 + a0 + (a1-a0)*k/4; const p = new THREE.Mesh(new THREE.BoxGeometry(1.6,14,1.6), M('#9a9a97')); p.position.set(80*Math.sin(a), 7, 80*Math.cos(a)); g.add(p); } });
  const l = new THREE.PointLight('#5fdcff', 1.4, 220, 1.6); l.position.set(30,30,0); g.add(l); }
/* Stardome: 70-foot geodesic dome */
{ const geo = new THREE.SphereGeometry(35,14,7,0,Math.PI*2,0,Math.PI/2); const dome = add(geo, M('#e6e6e3', {emissive:'#16264a', emissiveIntensity:0.9}), 607,0,607);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({color:'#7fdcff', transparent:true, opacity:0.55})); edges.position.copy(dome.position); scene.add(edges);
  box(2,13,12, M('#151515'), 573.5,6.5,607); }
/* camps: tents, RVs and shift pods around a center, 200 people each */
const tentG = new THREE.ConeGeometry(7,8,4), rvG = new THREE.BoxGeometry(9,10,32), podG = new THREE.SphereGeometry(4,8,5,0,Math.PI*2,0,Math.PI/2);
const tentM = M('#c4542c'), rvM = M('#d2d2cf'), podM = M('#e8e8e5', {emissive:'#2a3346', emissiveIntensity:0.6});
function camp(cx, cz){
  flatRing(118, 2.5, '#0077D8', cx, cz);
  for (let i=0;i<12;i++){ const a = i/12*Math.PI*2 + 0.13; const x = cx+96*Math.sin(a), z = cz+96*Math.cos(a);
    if (i%2){ const m = add(rvG, rvM, x,5,z); m.rotation.y = a + Math.PI/2; } else { const m = add(tentG, tentM, x,4,z); m.rotation.y = a + Math.PI/4; } }
  for (let i=0;i<16;i++){ const a = i/16*Math.PI*2; add(podG, podM, cx+60*Math.sin(a), 0, cz+60*Math.cos(a)); }
  flatRing(14, 2, '#ffffff', cx, cz, 0.6);
  box(12,8,12, M('#d9d9d6'), cx,4,cz-30); box(12,8,12, M('#d9d9d6'), cx,4,cz+30);
}
[[-431,176],[431,176],[-431,1043],[431,1043],[0,1221]].forEach(([x,z]) => camp(x,z));
/* entrance arch on Twistflower Rd */
{ const g = new THREE.CylinderGeometry(36,36,16,18,1,true, -0.4, 2.0); add(g, D('#cfcfcc'), 640,8,-40); }

/* ---------- finish: color management, texture scale, shadows, reflections, dust ---------- */
/* Colors above are authored as sRGB hex; the renderer works in linear light. Convert every material and light once.
   Small unlit accents (indicator lamps, strips, fixtures) are pushed above 1.0 so the bloom pass treats them as light sources. */
{ const seen = new Set();
  scene.traverse(o => {
    if (o.isLight){ o.color.convertSRGBToLinear(); if (o.groundColor) o.groundColor.convertSRGBToLinear(); return; }
    if ((o.isPoints || o.isMesh) && o.geometry && o.geometry.attributes.color && !o.geometry.userData.linDone && !o.isInstancedMesh){
      const c = o.geometry.attributes.color, t = new THREE.Color(); for (let i=0;i<c.count;i++){ t.setRGB(c.getX(i), c.getY(i), c.getZ(i)).convertSRGBToLinear(); c.setXYZ(i, t.r, t.g, t.b); } o.geometry.userData.linDone = true; }
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (seen.has(m) || m.userData.lin || m.isShaderMaterial) return; seen.add(m);
      if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear();
      if (m.isMeshBasicMaterial && !m.transparent && !m.map && m.visible){ const hsl = {}; m.color.getHSL(hsl); m.color.multiplyScalar(hsl.s > 0.75 ? 1.3 : 2.0); } /* saturated brand accents keep their hue */
      if (m.isMeshBasicMaterial && m.map) m.color.multiplyScalar(1.5); }); });
  scene.fog.color.convertSRGBToLinear();
  [projA, projB].forEach(t => { t.encoding = THREE.sRGBEncoding; }); }
/* texture scale, and which objects cast and receive moonlight shadows */
scene.updateMatrixWorld(true);
{ const v = new THREE.Vector3();
  scene.traverse(o => { if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material], tm = mats.find(m => m && m.userData && m.userData.tex);
    if (tm && !o.userData.ground) worldUV(o.geometry, tm.userData.tex, o.userData.uvRot);
    const lit = mats.some(m => m && m.isMeshStandardMaterial); if (!lit) return;
    o.getWorldPosition(v); o.receiveShadow = true;
    o.castShadow = o.userData.ground || o.isInstancedMesh ? !!o.userData.cast : v.y > -40; }); }
/* image-based reflections: the night sky outside, a warm fluorescent room underground */
const pmrem = new THREE.PMREMGenerator(renderer);
const envOut = pmrem.fromEquirectangular(skyTex).texture;
const envIn = (() => { const s = new THREE.Scene(), bm = c => new THREE.MeshBasicMaterial({color:c, side:THREE.BackSide});
  s.add(new THREE.Mesh(new THREE.BoxGeometry(10,10,10), bm(new THREE.Color(0.035,0.032,0.028))));
  const panel = (c, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color:c, side:THREE.DoubleSide})); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  panel(new THREE.Color(2.4,2.4,2.2), 0, 4.8, 0, 7, 1.2); panel(new THREE.Color(0.25,0.75,1.0), 4.8, 0.5, 0, 2.5, 3); panel(new THREE.Color(1.2,0.55,0.18), -4.8, -0.5, 1, 2, 2.5); panel(new THREE.Color(0.10,0.10,0.09), 0, -4.8, 0, 9, 9);
  return pmrem.fromScene(s, 0.035).texture; })();
pmrem.dispose();
scene.environment = envOut;
/* dust motes drifting in the light underground */
const dust = (() => { const n = mobile ? 450 : 900, box = 36, pos = new Float32Array(n*3), base = new Float32Array(n*3), vel = new Float32Array(n*3);
  for (let i=0;i<n*3;i++){ base[i] = Math.random()*box; vel[i] = (Math.random()-0.5)*0.35; }
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'), g = c.createRadialGradient(16,16,0,16,16,16); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0,0,32,32);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({size:0.07, map:new THREE.CanvasTexture(cv), color:new THREE.Color(1.1,1.0,0.85), transparent:true, opacity:0.55, depthWrite:false, blending:THREE.AdditiveBlending}); mat.userData.lin = true;
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  return {pts, update(s, cam){ pts.visible = cam.y < -2; if (!pts.visible) return; const h = box/2;
    for (let i=0;i<n;i++) for (let k=0;k<3;k++){ const j = i*3+k, cp = k === 0 ? cam.x : (k === 1 ? cam.y : cam.z); let q = (base[j] + vel[j]*s + Math.sin(s*0.3 + j)*0.4 - cp) % box; if (q < 0) q += box; pos[j] = cp + q - h; }
    geo.attributes.position.needsUpdate = true; }}; })();

/* ---------- journey ---------- */
const V = (x,y,z) => new THREE.Vector3(x,y,z);
const K = [
  {p:V(22000,22000,118000), t:V(5000,0,15000), s:0},
  {p:V(1900,1500,3300), t:V(0,0,0), s:1},
  {p:V(640,560,1480), t:V(-40,0,620), s:2},
  {p:V(175,150,215), t:V(-15,0,-45), s:3},
  {p:W(36,-56,7), t:W(24.5,-30,4), s:4},
  {p:W(24.5,-36.5,5.5), t:W(24.5,-25,1)},
  {p:W(24.5,-27,5), t:W(24.5,-14,-6)},
  {p:W(24.5,-16,-1.5), t:W(24.5,-5,-11)},
  {p:W(24.8,-5.2,-6.5), t:W(34,-4,-16), s:5},
  {p:W(30,-5,-10), t:W(37,-5,-17)},
  {p:W(37,-2,-15.5), t:W(28,0,-16)},
  {p:W(26,0,-15.5), t:W(14,0,-16)},
  {p:W(17,4,-15.5), t:W(-10,-14,-17), s:6},
  {p:W(26,0,-15.5), t:W(37,3,-17)},
  {p:W(37,4.5,-15.5), t:W(27,5,-24)},
  {p:W(30,5,-20.5), t:W(22,5,-28)},
  {p:W(24.5,2,-25.5), t:W(14,0,-26.5)},
  {p:W(17,3,-25.5), t:W(-10,-14,-27), s:7},
  {p:W(25,0,-25.5), t:W(40,0,-26.5)},
  {p:W(40,0,-26.2), t:W(79,0,-27)},
  {p:W(46,0,-26.2), t:W(79,0,-27), s:8},
  {p:W(74,0,-26.2), t:W(90,0,-28)},
  {p:W(81,0.5,-25.2), t:V(0,-160,1), s:9},
  {p:V(-5,-34,-10), t:V(30,-30,40)},
  {p:V(-2,-45,-4), t:V(0,400,40)},
  {p:V(0,10,2), t:V(0,500,60)},
  {p:V(80,62,105), t:V(0,28,0), s:10}
];
const STOPS = [
  {name:'Roswell', eyebrow:'Roswell, New Mexico', title:'A Signal in the Desert', desc:'High desert, about 3,600 feet up. North of town, something is transmitting.'},
  {name:'Approach', eyebrow:'The Approach', title:'Twistflower', desc:'At the height of the Cold War, Twistflower stood at the leading edge of America’s defenses, on alert for an order that never came.'},
  {name:'Festival Grounds', eyebrow:'May 7–9, 2027', title:'Above and Below the Desert', desc:'The Twistflower Stage, the Stardome, Base Camp, and five camps for curious minds, all within sight of the silo.', orbit:true},
  {name:'The Site', eyebrow:'Surface', title:'The Site', desc:'From above, only a stairwell, a hatch, and two enormous doors give it away.', orbit:true},
  {name:'Entry', eyebrow:'Surface · Entry', title:'The Entry', desc:'The only way the crew came in. One long flight of stairs drops beneath the desert to a pair of blast doors.'},
  {name:'Stair Shaft', eyebrow:'Below grade', title:'The Stair Shaft', desc:'Past the blast doors, switchback stairs drop through a concrete shaft that serves every level, from the crew rooms to the tunnel.'},
  {name:'Launch Control', eyebrow:'LCC · Level −1 · 1962', title:'Launch Control, 1962', desc:'The upper chamber returns to its alert posture. A crew of five works the panels as if the order could come at any moment.'},
  {name:'Deep Space', eyebrow:'LCC · Level −2 · Immersive', title:'Deep Space', desc:'Below the crew, the walls dissolve into moving pictures of the cosmos. A different kind of transmission.'},
  {name:'Tunnel', eyebrow:'Below grade', title:'The Tunnel', desc:'Forty feet of corrugated steel from the base of the stair shaft to the silo, sealed by blast doors.'},
  {name:'The Silo', eyebrow:'Silo', title:'The Silo', desc:'One hundred seventy-four feet down and fifty-two across. Look down.'},
  {name:'The Doors', eyebrow:'Surface', title:'Through the Doors', desc:'Up and out, through doors of about seventy-five tons each. The silo is calling.'}
];
const STOPK = K.map((k,i) => k.s !== undefined ? i : -1).filter(i => i >= 0);
const LABELS = [
  {stops:[0,1], text:'ROSWELL', pos:V(CX, 900, CZ), cls:'city'},
  {stops:[0,1], text:'TWISTFLOWER', pos:V(0, 400, 0)},
  {stops:[3], text:'ENTRY', pos:W(24.5,-32,14), go:4},
  {stops:[3], text:'SILO DOORS', pos:V(0,26,0), go:9},
  {stops:[3], text:'ESCAPE HATCH', pos:V(-45,4,-95)},
  {stops:[3], text:'ANTENNA SILO', pos:V(-63,4,-130)},
  {stops:[3], text:'TWISTFLOWER RD', pos:V(230,3,-78)},
  {stops:[2], text:'THE SILO', pos:V(0,40,0), go:3},
  {stops:[2], text:'TWISTFLOWER STAGE', pos:V(-607,72,607), cls:'warm'},
  {stops:[2], text:'STARDOME', pos:V(607,80,607)},
  {stops:[2], text:'BASE CAMP', pos:V(0,40,607)},
  {stops:[2], text:'FISSION FIELD', pos:V(-431,30,176), cls:'small'},
  {stops:[2], text:'FISSION FIELD', pos:V(431,30,176), cls:'small'},
  {stops:[2], text:'STARDUST CAMP', pos:V(-431,30,1043), cls:'small'},
  {stops:[2], text:'STARDUST CAMP', pos:V(431,30,1043), cls:'small'},
  {stops:[2], text:'AREA 51 OUTPOST', pos:V(0,30,1221), cls:'small'},
  {stops:[2], text:'ENTRANCE', pos:V(640,40,-60), cls:'small'}
];

function cr(a,b,c,d,t,out){ const t2=t*t, t3=t2*t;
  out.set(0.5*((2*b.x)+(-a.x+c.x)*t+(2*a.x-5*b.x+4*c.x-d.x)*t2+(-a.x+3*b.x-3*c.x+d.x)*t3),
          0.5*((2*b.y)+(-a.y+c.y)*t+(2*a.y-5*b.y+4*c.y-d.y)*t2+(-a.y+3*b.y-3*c.y+d.y)*t3),
          0.5*((2*b.z)+(-a.z+c.z)*t+(2*a.z-5*b.z+4*c.z-d.z)*t2+(-a.z+3*b.z-3*c.z+d.z)*t3)); return out; }
const N = K.length;
function sample(u, key, out){ u = Math.max(0, Math.min(N-1, u)); let i = Math.floor(u); if (i >= N-1) i = N-2; const f = u - i;
  const a = K[Math.max(0,i-1)][key], b = K[i][key], c = K[i+1][key], d = K[Math.min(N-1,i+2)][key];
  if (i === 0 && key === 'p'){ /* long first leg: ease altitude in log space */
    const e = f*f*(3-2*f); const lb = Math.log(b.y), lc = Math.log(c.y);
    out.lerpVectors(b, c, 1 - Math.pow(1-f, 2.2)); out.y = Math.exp(lb + (lc-lb)*e); return out; }
  return cr(a,b,c,d,f,out); }

let stop = 0, u = 0, anim = null, yaw = 0, pitch = 0, modeOrbit = false;
const P = new THREE.Vector3(), T = new THREE.Vector3(), tmp = new THREE.Vector3();

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const rail = $('rail'), dots = $('dots'), labelsEl = $('labels');
STOPS.forEach((s,i) => {
  const b = document.createElement('button'); b.type='button'; b.innerHTML = '<span>'+s.name+'</span><span class="n">'+String(i+1).padStart(2,'0')+'</span>'; b.addEventListener('click', () => go(i)); rail.appendChild(b);
  const d = document.createElement('button'); d.type='button'; d.setAttribute('aria-label', 'Station '+(i+1)+': '+s.name); d.addEventListener('click', () => go(i)); dots.appendChild(d);
});
const tagEls = LABELS.map(L => { const el = document.createElement(L.go !== undefined ? 'button' : 'span'); el.className = 'tag' + (L.go !== undefined ? ' go' : '') + (L.cls ? ' '+L.cls : '');
  el.textContent = L.text; if (L.go !== undefined){ el.type='button'; el.addEventListener('click', () => go(L.go)); } el.hidden = true; labelsEl.appendChild(el); return el; });

function renderCard(){
  const backdrop=document.getElementById('scene-backdrop');
  if (backdrop) backdrop.style.backgroundImage='url("stations/'+PHOTOS[stop]+'.jpg")';
  const s = STOPS[stop];
  $('eyebrow').textContent = 'Station ' + String(stop+1).padStart(2,'0') + ' / ' + STOPS.length + ' · ' + s.eyebrow;
  $('title').textContent = s.title; $('desc').textContent = s.desc;
  $('prev').disabled = stop === 0;
  $('next').textContent = stop === 0 ? 'Begin Descent' : (stop === STOPS.length-1 ? 'Start Over' : 'Next: ' + STOPS[stop+1].name);
  $('cta').hidden = stop !== STOPS.length-1;
  $('next').classList.toggle('ghost', stop === STOPS.length-1); $('next').classList.toggle('primary', stop !== STOPS.length-1);
  $('hint').textContent = (window.matchMedia('(pointer:coarse)').matches || window.innerWidth<900) ? 'SWIPE OR SCROLL UP / DOWN TO TRAVEL' : 'SCROLL UP OR DOWN · ARROW KEYS TO TRAVEL';
  if ($('station-picker')) $('station-picker').value = '';
  [...rail.children].forEach((b,i) => b.toggleAttribute('aria-current', false) || (i===stop && b.setAttribute('aria-current','step')));
  [...dots.children].forEach((d,i) => d.classList.toggle('done', i <= stop));
}
function go(i){
  i = Math.max(0, Math.min(STOPS.length-1, i)); if (i === stop && !anim) return;
  /* Finish the visible handoff before servicing the latest navigation request. */
  if (PHOTO_MODE && tr){ queuedStop = i; return; }
  const from = anim ? u : STOPK[stop], to = STOPK[i];
  const far = (stop === 0 || i === 0) && Math.abs(i - stop) >= 1;
  const dur = reduce ? 350 : (far ? 5200 : Math.min(7000, 1300 + 520*Math.abs(to - from)));
  modeOrbit = !!STOPS[stop].orbit;
  const pd = photoTransition(stop, i);
  anim = {from, to, t0:performance.now(), dur: pd || dur, y0:yaw, p0:pitch};
  stop = i; renderCard();
}
$('next').addEventListener('click', () => go(stop === STOPS.length-1 ? 0 : stop+1));
$('prev').addEventListener('click', () => go(stop-1));
window.addEventListener('keydown', e => {
  if (e.target && e.target.closest && e.target.closest('input,select,textarea,[contenteditable]')) return;
  if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') && (e.key === ' ' || e.key === 'Enter')) return;
  if (['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)){ e.preventDefault(); if (stop < STOPS.length-1) go(stop+1); }
  if (['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){ e.preventDefault(); go(stop-1); }
});
/* Wheel gestures work over the scene and controls in both directions. */
let wheelAcc = 0, wheelLock = 0, wheelAt = 0, wheelDir = 0;
window.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const target = e.target && e.target.closest ? e.target : null;
  if (target && target.closest('input,select,textarea,[contenteditable]')) return;
  const panel = target && target.closest('.card,.rail');
  if (panel && panel.scrollHeight > panel.clientHeight + 1){
    const inside = e.deltaY < 0 ? panel.scrollTop > 0 : panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1;
    if (inside) return;
  }
  e.preventDefault();
  const now = performance.now(), dir = Math.sign(e.deltaY);
  if (!dir) return;
  if (anim || (PHOTO_MODE && tr) || now < wheelLock){ wheelAcc = 0; wheelAt = now; return; }
  if (dir !== wheelDir || now - wheelAt > 220) wheelAcc = 0;
  wheelDir = dir; wheelAt = now;
  const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
  wheelAcc += Math.min(120,Math.abs(pixels)) * dir;
  if (Math.abs(wheelAcc) >= 80){
    wheelAcc = 0; wheelLock = now + 900;
    go(stop + dir);
  }
}, {passive:false});
let drag = null;
canvas.addEventListener('pointerdown', e => {
  drag = {x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,touch:e.pointerType==='touch'};
  canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', e => {
  if (!drag || anim) return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  const vertical=drag.touch && Math.abs(e.clientY-drag.y0)>Math.abs(e.clientX-drag.x0)*1.5;
  if (vertical) return;
  if (STOPS[stop].orbit){yaw-=dx*.006;pitch=Math.max(-.55,Math.min(.5,pitch+dy*.004));}
  else {yaw=Math.max(-1.1,Math.min(1.1,yaw+dx*.004));pitch=Math.max(-.7,Math.min(.7,pitch-dy*.0035));}
});
const endDrag = e => {
  if (drag && e.type!=='pointercancel' && drag.touch){
    const dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;
    if (Math.abs(dy)>=70 && Math.abs(dy)>Math.abs(dx)*1.5) go(stop+(dy<0?1:-1));
  }
  drag=null;canvas.classList.remove('dragging');
};
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
/* Keep film framing above the card as text wraps, fonts load or orientation changes. */
const stationPicker=$('station-picker');
if (stationPicker){
  STOPS.forEach((s,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=String(i+1).padStart(2,'0')+' — '+s.name;stationPicker.appendChild(option);});
  stationPicker.addEventListener('change',()=>{if(stationPicker.value!=='')go(+stationPicker.value);});
}
const syncCardHeight=()=>document.documentElement.style.setProperty('--card-height',Math.ceil(document.querySelector('.card').getBoundingClientRect().height)+'px');
if (window.ResizeObserver)new ResizeObserver(syncCardHeight).observe(document.querySelector('.card'));
window.addEventListener('resize',()=>{syncCardHeight();renderCard();});syncCardHeight();

/* ---------- photoreal navigation (concepts/README.md has how the plates were made) ----------
   Every station is a photograph with real people in it. Moving between stations plays a filmed transition clip when there is one
   (transitions/<from>-<to>.mp4, first frame = this station, last frame = the next), and otherwise a camera-push dissolve from photo
   to photo. Dragging pans the photo. The 3D scene still drives the path, depth readout and label positions, but is only drawn while
   photos are loading, or always with ?3d. */
const PHOTO_MODE = !/[?&]3d\b/.test(location.search);
const PHOTOS = {0:'01-roswell-paced', 1:'02-approach', 2:'03-festival-grounds', 3:'04-the-site', 4:'05-entry-clear', 5:'06-stair-shaft', 6:'07-launch-control-1962', 7:'08-deep-space', 8:'09-tunnel', 9:'10-the-silo', 10:'11-through-the-doors'};
const CLIPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];  /* station indexes i that have transitions/<i+1>-<i+2>.mp4 */
const SOFT_START = {3:1, 5:1};  /* clips that no longer start on the current photo: dissolve into them instead of cutting */
const plates = {}, clips = {}, loops = {}, pad2 = n => String(n).padStart(2, '0');
if (PHOTO_MODE){
  Object.keys(PHOTOS).forEach(k => { const img = (+k === 0 && document.getElementById('aerial-firstpaint')) || new Image(); img.alt = ''; img.decoding = 'async'; const pl = {img, ready:!!(img.complete && img.naturalWidth), t0:0, src:'stations/' + PHOTOS[k] + '.jpg'};
    if (+k === 0){ img.style.inset = '0'; img.style.width = '100%'; img.style.height = '100%'; }
    img.onload = () => { pl.ready = true; }; $('photos').appendChild(img); plates[k] = pl; });
  CLIPS.forEach(i => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none';
    v.dataset.src = (i === 0 ? 'transitions/01-02-matched-arrival' : i === 1 ? 'transitions/02-03-joined' : i === 2 ? 'transitions/03-04-road-only' : i === 3 ? 'transitions/04-05-entry-clear' : i === 4 ? 'transitions/05-06-entry-clear' : i === 7 ? 'transitions/08-09-native-frames' : 'transitions/' + pad2(i+1) + '-' + pad2(i+2)) + (v.canPlayType('video/mp4; codecs="avc1.640028"') ? '.mp4' : '.webm'); const c = {v, ready:false};
    v.addEventListener('loadeddata', () => { c.ready = true; }); $('photos').appendChild(v); clips[i] = c; });
  /* a living loop per station: the last seconds of the film that arrives there, played back and forth, so nothing ever freezes */
  Object.keys(PHOTOS).forEach(k => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none';
    /* Station 1 approaches the road once, then repeats only its forward-moving traffic body. */
    v.dataset.src = (+k === 0 ? 'loops/01-city-paced' : +k === 1 ? 'loops/02-lasers' : +k === 2 ? 'loops/03-joined-standby' : +k === 3 ? 'loops/04-road-only' : +k === 4 ? 'loops/05-entry-clear' : +k === 5 ? 'loops/06-guide' : +k === 8 ? 'loops/09-native-frames' : +k === 10 ? 'loops/11-crowd-reshoot' : 'loops/' + pad2(+k + 1)) + (v.canPlayType('video/mp4; codecs="avc1.640028"') ? '.mp4' : '.webm');
    const l = {v, ready:false, restart:+k === 0 ? 10.8 : +k === 1 ? 2 : +k === 2 ? 7.4 : +k === 3 ? 0.5 : +k === 4 ? 31/30 : +k === 5 ? 0.6 : +k === 8 ? 0 : +k === 10 ? 8 : undefined, roadStart:+k === 0 ? 10.8 : undefined};
    v.addEventListener('loadeddata', () => { l.ready = true; }); $('photos').appendChild(v); loops[k] = l;   /* A decoded first frame is enough; keep the outgoing layer underneath if buffering resumes. */
    /* the dwell file is the shot once, then a body that connects end to start: at the end, continue from the body's keyframe */
    const repeat = e => {
      if (reduce || e.currentTarget !== l.v) return;
      const active = l.v, spare = l.spare;
      if (spare && l.primed && spare.readyState >= 2 && !spare.seeking && !spare.error){
        /* Decode the next traffic, laser, crowd or entry-loop frame on a second video before exchanging players. */
        spare.style.opacity = active.style.opacity; spare.style.zIndex = active.style.zIndex;
        active.style.opacity = '0'; l.v = spare; l.spare = active; l.primed = false; l.playing = false;
        playLoop(l); primeEntryLoop(l);
      } else { active.currentTime = l.restart || 0; active.play().catch(() => {}); }
    };
    v.addEventListener('ended', repeat);
    if ((+k === 0 || +k === 1 || +k === 2 || +k === 3 || +k === 4 || +k === 5 || +k === 8 || +k === 10) && !reduce){
      const spare = document.createElement('video'); spare.muted = true; spare.playsInline = true;
      spare.setAttribute('playsinline', ''); spare.preload = 'none'; spare.dataset.src = v.dataset.src;
      spare.addEventListener('loadedmetadata', () => primeEntryLoop(l)); spare.addEventListener('ended', repeat);
      $('photos').appendChild(spare); l.spare = spare;
    }
    fetch(+k === 0 ? 'loops/01-city-paced.json' : +k === 1 ? 'loops/02-lasers.json' : +k === 2 ? 'loops/03-joined-standby.json' : +k === 3 ? 'loops/04-road-only.json' : +k === 4 ? 'loops/05-entry-clear.json' : +k === 5 ? 'loops/06-guide.json' : +k === 8 ? 'loops/09-native-frames.json' : +k === 10 ? 'loops/11-crowd-reshoot.json' : 'loops/' + pad2(+k + 1) + '.json').then(r => r.json()).then(j => { l.restart = j.restart; l.roadStart = j.roadStart; primeEntryLoop(l); }).catch(() => {}); });
}
function primeEntryLoop(l){
  if (!l.spare || l.primed || l.restart === undefined || l.spare.readyState < 1) return;
  l.spare.pause(); l.spare.currentTime = l.restart; l.primed = true;
}
function warmLoop(k){ const l = loops[k]; if (l && !l.v.src){
  l.v.src = l.v.dataset.src; l.v.preload = 'auto'; l.v.load();
  if (l.spare){ l.spare.src = l.spare.dataset.src; l.spare.preload = 'auto'; l.spare.load(); }
} }
/* fetch the clip that leaves the current station, so Next can play it without waiting */
if (PHOTO_MODE && !reduce) warmLoop(stop); /* Prioritize nearby media rather than downloading every film at once. */
function warmClip(i){ const c = clips[i]; if (c && !c.v.src){ c.v.src = c.v.dataset.src; c.v.preload = 'auto'; c.v.load(); } }
let tr = null, queuedStop = null, arrivedAt = 0, photoCover = false;
const videoReady = l => !!(l && l.ready && !l.v.error && l.v.readyState >= 2 && !l.v.seeking);
function playLoop(l){ if (!reduce && l.v.paused && !l.playing){ l.playing = true; l.v.play().catch(() => {}).finally(() => { l.playing = false; }); } }
/* called by go(): returns the transition length in ms in photo mode */
function photoTransition(from, to){ if (!PHOTO_MODE) return 0;
  { const pl = plates[to]; if (pl && !pl.img.src) pl.img.src = pl.src; }
  /* moving forward always arrives on film: the clip that ends at the destination. One step: it starts exactly where we are;
     a longer jump: dissolve into it from the current photo. Going back uses the slow photo dissolve. */
  /* Station 1 -> 2 continues along the road through the original approach and arrival. */
  const cleanAerial = from === 0 && to === 1;
  const SKIP_FILM = {9:1};
  const c = to > from && !SKIP_FILM[to - 1] ? clips[to - 1] : null, now = performance.now(); if (!reduce) warmLoop(to);
  const festivalFlight = from === 1 && to === 2;
  tr = {from, to, cleanAerial, festivalFlight, clipStart:festivalFlight ? 0.6 : 0, aerialWaitAt:now, t0:now, clip:null, fadeIn: true, fadeMs: festivalFlight ? 300 : cleanAerial ? 600 : (to !== from + 1 || SOFT_START[to - 1]) ? 1400 : 900};
  if (cleanAerial && !reduce && loops[0].v.currentTime < (loops[0].roadStart || 10.8)){
    warmLoop(0); warmClip(0); tr.pendingRoad = true; tr.roadDeadline = now + Math.max(5000,((loops[0].roadStart || 10.8)-loops[0].v.currentTime)*1000+2000); tr.dur = tr.roadDeadline-now+9000;
    return tr.dur;
  }
  const filmWait = from === 1 && to === 2 ? 12000 : 3000;
  if (c && !videoReady(c) && !reduce){ warmClip(to - 1); tr.pending = c; tr.waitUntil = now + filmWait; tr.dur = filmWait + 600; return filmWait + 9000; } /* hold briefly while the clip loads */
  startTransition(videoReady(c) && !reduce ? c : null, now);
  return tr.dur; }
/* Opening Station 6 directly still includes the entry story once, before its guide dwell. */
function startInitialStationEntry(){
  if (!PHOTO_MODE || reduce || stop !== 5) return;
  const pl = plates[4]; if (!pl.img.src) pl.img.src = pl.src;
  warmLoop(4); photoTransition(4, 5);
}
function startTransition(c, now){ tr.t0 = now; tr.pending = null;
  if (c){ tr.clip = c; c.v.currentTime = tr.clipStart || 0; c.v.playbackRate = 1; c.v.style.transform = ''; c.v.play().catch(() => { if (tr && tr.clip === c) startTransition(null, performance.now()); }); tr.dur = Math.max(1500, (c.v.duration || 4)*1000 + 4000); }
  else { tr.clip = null; tr.dur = reduce ? 350 : (tr.cleanAerial ? 1200 : 4200); }
  if (anim){ anim.t0 = now; anim.dur = tr.dur; } }
function updatePlates(now){
  if (!PHOTO_MODE){ photoCover = false; return; }
  const pan = (x, y) => 'translate(' + (-Math.max(-1, Math.min(1, x))*3.5).toFixed(2) + '%,' + (Math.max(-1, Math.min(1, y))*3.5).toFixed(2) + '%)';
  if (tr && tr.pendingRoad){
    const road = loops[0];
    if ((videoReady(road) && road.v.currentTime >= (road.roadStart || 10.8)) || now > tr.roadDeadline){
      tr.pendingRoad = false;
      if (videoReady(clips[0])) startTransition(clips[0], now);
      else { tr.pending = clips[0]; tr.waitUntil = now + 3000; }
    } else {
      if (videoReady(road)){ road.v.style.opacity = '1'; road.v.style.zIndex = '2'; playLoop(road); }
      photoCover = true; canvas.style.opacity = '0'; return;
    }
  }
  if (tr && tr.pending){
    if (videoReady(tr.pending) || tr.pending.v.error || now > tr.waitUntil) startTransition(videoReady(tr.pending) ? tr.pending : null, now);
    else {
      /* Leave the current composition and its playing loop intact while buffering. */
      photoCover = true; canvas.style.opacity = '0'; return;
    } }
  let p = tr ? Math.min(1, (now - tr.t0)/tr.dur) : 1;
  if (tr && tr.clip){ const v = tr.clip.v, d = v.duration || 0, ct = v.currentTime;
    /* Film progress follows decoded playback, so stalls cannot finish the transition early. */
    if (d) p = Math.max(0, Math.min(1, ct/d));
    if (v.error){ startTransition(null, now); p = 0; }
    else if (v.ended || (d && ct >= d - 0.05)){
      v.pause();
      if (!tr.handoffAt) tr.handoffAt = now;
      /* Hold the last film frame until an arrival layer has decoded, with a bounded loop wait. */
      const ready = videoReady(loops[tr.to]) || (plates[tr.to] && plates[tr.to].ready);
      p = ready && (videoReady(loops[tr.to]) || now - tr.handoffAt >= 2000) ? 1 : 1 - 1e-6;
      tr.hold = p < 1;
    }
  }
  if (tr && tr.cleanAerial && !tr.clip && !videoReady(loops[tr.to]) && !loops[tr.to].v.error && now - tr.aerialWaitAt < 5000){ tr.t0 = now; p = 0; }
  if (tr && p >= 1){ if (tr.clip) tr.clip.v.pause();
    if (videoReady(loops[tr.to])) loops[tr.to].shownAt = now - 650;
    tr = null; arrivedAt = now; }
  if (!tr && !reduce){ warmClip(stop); warmLoop(stop); warmLoop(stop + 1); warmLoop(stop - 1); }
  /* photos load on demand: this station and its neighbors */
  [stop - 1, stop, stop + 1].forEach(i => { const pl = plates[i]; if (pl && !pl.img.src) pl.img.src = pl.src; });
  let cover = false;
  for (const k in plates){ const pl = plates[k], i = +k; let a = 0, sc = 1, tf = '';
    if (tr && !tr.clip){ const lv = !reduce && videoReady(loops[tr.from]) && videoReady(loops[tr.to]);   /* video to video when both stitches are here */
      if (i === tr.from){ a = 1; sc = reduce ? 1 : 1.04; }
      else if (i === tr.to){ a = (lv || (tr.cleanAerial && videoReady(loops[tr.to]))) ? 0 : smooth(0.15, 0.85, p); sc = reduce ? 1 : 1.04; }
    } else if (!tr && i === stop){ a = 1;
      /* Keep the photographic fallback still while the station footage loads. */
      sc = reduce ? 1 : 1.04; tf = reduce ? '' : pan(yaw/1.1, pitch/0.7);   /* no synthetic motion: the footage itself carries the life */
      pl.img.style.filter = ''; }
    if (!(!tr && i === stop)) pl.img.style.filter = '';
    if (a > 0 && !pl.ready) a = 0;
    if (a >= 0.999) cover = true;
    /* Match the clean flight's first frame without a crop or a synthetic camera effect. */
    if (i === 0){ sc = 1; tf = ''; }
    pl.img.style.zIndex = tr && !tr.clip && i === tr.to ? '4' : '1';
    pl.img.style.opacity = a.toFixed(3); if (a > 0) pl.img.style.transform = tf + ' scale(' + sc.toFixed(4) + ')'; }
  const clipActive = tr && tr.clip;
  const filmMs = clipActive ? Math.max(1000, (tr.clip.v.duration || 4)*1000) : 0;
  const intro = clipActive ? (tr.festivalFlight ? smooth(0, tr.fadeMs, Math.max(0, tr.clip.v.currentTime - tr.clipStart)*1000) : smooth(0, Math.min(0.4, tr.fadeMs/filmMs), p)) : 0;
  const endFade = clipActive ? smooth(1 - Math.min(0.4, (tr.cleanAerial ? 450 : 900)/filmMs), 1, p) : 0;
  if (clipActive){
    const pl = plates[tr.from];
    if (pl && pl.ready) pl.img.style.opacity = '1';
    if (!videoReady(loops[tr.to]) && plates[tr.to] && plates[tr.to].ready){
      plates[tr.to].img.style.zIndex = '4';
      plates[tr.to].img.style.opacity = endFade.toFixed(3);
    }
    /* Decode the arrival frame before compositing it over the film. */
    const l = loops[tr.to];
    if (l && !l.armed && p > 0.5){ l.armed = true; l.v.pause(); l.v.currentTime = 0; }
    /* Station 3 begins with the flight's final 27 frames. Keep those frames
       aligned if either decoder stalls, rather than playing two clocks apart. */
    if (tr.festivalFlight && l && l.armed && endFade > 0){
      const arrivalTime = Math.max(0, tr.clip.v.currentTime - (tr.clip.v.duration - 0.9));
      if (!l.v.seeking && Math.abs(l.v.currentTime - arrivalTime) > 0.1) l.v.currentTime = arrivalTime;
      if (tr.lastFlightTime !== tr.clip.v.currentTime) tr.lastFlightChangeAt = now;
      tr.arrivalStalled = now - tr.lastFlightChangeAt > 100;
      tr.lastFlightTime = tr.clip.v.currentTime;
    }
  }
  for (const k in clips){
    const on = !!(tr && tr.clip === clips[k]);
    clips[k].v.style.zIndex = '3';
    clips[k].v.style.opacity = on ? intro.toFixed(3) : '0';
  }
  for (const k in loops){ const l = loops[k], i = +k; let o = 0;
    /* Retain the last decoded frame during a seek rather than flashing the still photo. */
    const visibleFrame = l.ready && !l.v.error && Number(l.v.style.opacity) > 0;
    if (!reduce && (videoReady(l) || visibleFrame)){
      if (!tr && i === stop){
        if (l.shownAt === undefined) l.shownAt = now;
        o = smooth(0, 650, now - l.shownAt);
      }
      else if (tr && i === tr.from) o = 1;
      else if (tr && i === tr.to) o = tr.clip ? endFade : smooth(0.15, 0.85, p);
    }
    l.v.style.zIndex = tr && i === tr.from ? '2' : '5';
    if (tr && tr.festivalFlight && i === tr.to && tr.arrivalStalled){ l.v.pause(); }
    else if (o > 0 || (!tr && i === stop && videoReady(l))){ playLoop(l); }
    else { if (!l.v.paused) l.v.pause(); }
    if (o >= 0.999) cover = true;
    l.v.style.opacity = o.toFixed(3);
    if (tr && i === tr.to && o > 0) l.shownAt = now - 650;
    if (!tr && i !== stop){ l.armed = false; l.shownAt = undefined; }
  }
  photoCover = cover || PHOTO_MODE; canvas.style.opacity = photoCover ? '0' : '1';
  if (!tr && queuedStop !== null){ const next = queuedStop; queuedStop = null; go(next); } }   /* in photo mode the 3D is never shown: better a black frame than the CG */

/* ---------- loop ---------- */
const ease = t => t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
let composer = null, finalPass = null;
if (POST){
  const gl2 = renderer.capabilities.isWebGL2, half = gl2 || renderer.extensions.has('EXT_color_buffer_half_float');
  const opts = {type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat};
  const rt = gl2 && !mobile && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(1, 1, opts) : new THREE.WebGLRenderTarget(1, 1, opts);
  composer = new THREE.EffectComposer(renderer, rt);
  composer.addPass(new THREE.RenderPass(scene, camera));
  composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.85));
  finalPass = new THREE.ShaderPass({
    uniforms:{tDiffuse:{value:null}, time:{value:0}, exposure:{value:EXPOSURE}, res:{value:new THREE.Vector2(1,1)}},
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:`uniform sampler2D tDiffuse; uniform float time; uniform float exposure; uniform vec2 res; varying vec2 vUv;
      vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v + 0.0245786) - 0.000090537; vec3 b = v*(0.983729*v + 0.4329510) + 0.238081; return a/b; }
      vec3 aces(vec3 c){ const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
        const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
        return clamp(O * RRTAndODTFit(I * (c / 0.6)), 0.0, 1.0); }
      vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
      void main(){ vec2 d = vUv - 0.5; float r2 = dot(d, d); vec2 off = d*r2*0.010;
        vec3 c = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
        c = aces(c * exposure);
        c *= mix(1.0, 0.62, smoothstep(0.06, 0.5, r2));
        c = srgb(c);
        float g = hash(floor(vUv*res) + fract(time*0.137)*vec2(311.0, 173.0)) - 0.5;
        c += g * 0.04 * (1.0 - 0.7*c);
        gl_FragColor = vec4(c, 1.0); }`});
  composer.addPass(finalPass);
}
function resize(){ const w = window.innerWidth, h = window.innerHeight; renderer.setPixelRatio(pixelRatio); renderer.setSize(w,h,false); camera.aspect = w/h; camera.fov = w < 600 ? 66 : 55; camera.updateProjectionMatrix();
  if (composer){ composer.setPixelRatio(pixelRatio); composer.setSize(w, h); finalPass.uniforms.res.value.set(w*pixelRatio, h*pixelRatio); } }
window.addEventListener('resize', resize); resize();
/* keep the moon's shadow map wrapped tightly around what the camera is looking at */
const shadowC = new THREE.Vector3();
function fitShadow(){ const alt = Math.abs(camera.position.y); moon.castShadow = camera.position.y < 4000;
  if (!moon.castShadow) return; const ext = Math.min(1700, Math.max(70, alt*1.25 + 45));
  shadowC.copy(P).lerp(T, camera.position.y > 0 ? 0.6 : 0.2); shadowC.y = 0;
  const step = ext*2/moon.shadow.mapSize.x; shadowC.x = Math.round(shadowC.x/step)*step; shadowC.z = Math.round(shadowC.z/step)*step;
  const sc = moon.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 6000; sc.updateProjectionMatrix();
  moon.target.position.copy(shadowC); moon.position.copy(shadowC).addScaledVector(MOON_DIR, 3000); moon.target.updateMatrixWorld(); }
/* adaptive resolution: step the pixel ratio down on devices that cannot hold ~30 fps */
const adapt = !/[?&]hq\b/.test(location.search); let qT = 0, qN = 0, qLast = 0;
function adaptQuality(now){ if (!adapt) return; if (qLast){ qT += Math.min(100, now - qLast); qN++; }
  qLast = now; if (qT < 2500) return; const ms = qT/qN; qT = 0; qN = 0;
  if (ms > 36 && pixelRatio > 1){ pixelRatio = Math.max(1, pixelRatio - 0.25); resize(); } }
document.addEventListener('visibilitychange', () => { qLast = 0; qT = 0; qN = 0; });
const yAxis = new THREE.Vector3(0,1,0), right = new THREE.Vector3();
function frame(now){
  if (anim){ const k = Math.min(1, (now - anim.t0)/anim.dur), e = ease(k); u = anim.from + (anim.to - anim.from)*e;
    yaw = anim.y0*(1-e); pitch = anim.p0*(1-e); if (k >= 1){ anim = null; u = STOPK[stop]; yaw = 0; pitch = 0; } }
  sample(u,'p',P); sample(u,'t',T);
  const orbit = anim ? modeOrbit : !!STOPS[stop].orbit;
  if (orbit){ tmp.copy(P).sub(T); const sph = new THREE.Spherical().setFromVector3(tmp); sph.theta += yaw; sph.phi = Math.max(0.2, Math.min(1.45, sph.phi - pitch)); tmp.setFromSpherical(sph); P.copy(T).add(tmp); camera.position.copy(P); camera.lookAt(T); }
  else { tmp.copy(T).sub(P); tmp.applyAxisAngle(yAxis, -yaw); right.crossVectors(tmp, yAxis).normalize(); tmp.applyAxisAngle(right, pitch); camera.position.copy(P); camera.lookAt(tmp.add(P)); }
  const s = now/1000;
  animators.forEach(f => f(s));
  beams.forEach(b => { b.grp.rotation.x = b.ax*Math.sin(s*b.sp + b.ph); b.grp.rotation.z = b.az*Math.cos(s*b.sp*0.8 + b.ph*1.3); });
  shaftLight.intensity = 2.2 + 0.35*Math.sin(s*1.7);
  const y = camera.position.y; $('depth').textContent = y >= 0 ? 'ALT ' + Math.round(y).toLocaleString('en-US') + ' FT' : 'DEPTH ' + Math.round(-y) + ' FT';
  const w = window.innerWidth, h = window.innerHeight;
  LABELS.forEach((L,i) => { const el = tagEls[i]; const show = !anim && !photoCover && L.stops.includes(stop); /* 3D hotspots only when the 3D is what's on screen */
    if (!show){ el.hidden = true; return; } tmp.copy(L.pos).project(camera);
    if (tmp.z > 1 || tmp.z < -1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1){ el.hidden = true; return; }
    el.hidden = false; const hw = (el.offsetWidth || 0)/2 + 8, lx = Math.max(hw, Math.min(w - hw, (tmp.x*0.5+0.5)*w)); /* keep labels fully on screen */
    el.style.transform = 'translate(' + lx + 'px,' + ((-tmp.y*0.5+0.5)*h - 14) + 'px) translate(-50%,-100%)'; });
  fitShadow(); dust.update(s, camera.position);
  scene.environment = camera.position.y < -1.5 ? envIn : envOut;
  /* eye adaptation: settle to a lower exposure in the lit rooms below grade */
  { const dt = lastF ? Math.min(0.1, (now - lastF)/1000) : 1; lastF = now; const target = camera.position.y < -1.5 ? EXPOSURE_BELOW : EXPOSURE; exposure += (target - exposure)*Math.min(1, dt*2.5);
    if (composer) finalPass.uniforms.exposure.value = exposure; else renderer.toneMappingExposure = exposure; }
  updatePlates(now);
  if (!photoCover){ if (composer){ finalPass.uniforms.time.value = s; composer.render(); } else renderer.render(scene, camera); adaptQuality(now); }
  requestAnimationFrame(frame);
}
/* soundtrack: browsers only allow sound after a tap, so it starts on the first interaction and loops for the whole journey */
{ const bgm = document.getElementById('bgm'), sbtn = document.getElementById('sound');
  if (bgm && bgm.getAttribute('src')){
    sbtn.hidden = false; let wantSound = true, started = false;
    const setLabel = () => { const on = !bgm.paused; sbtn.textContent = on ? 'SOUND ON' : 'TAP FOR SOUND'; sbtn.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    const fadeTo = v => { const v0 = bgm.volume, t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now()-t0)/1800); bgm.volume = v0 + (v-v0)*k; if (k < 1) requestAnimationFrame(step); }; step(); };
    const start = e => { if ((e && e.target === sbtn) || started || !wantSound) return; started = true; bgm.volume = 0;
      bgm.play().then(() => { fadeTo(0.8); setLabel(); }).catch(() => { started = false; }); };
    start();
    /* iPhone Safari only counts touchend and click as a tap that may start audio, so listen for those too */
    ['pointerdown','pointerup','touchend','click','keydown'].forEach(ev => window.addEventListener(ev, start, {passive:true, capture:true}));
    sbtn.addEventListener('click', () => { if (bgm.paused){ wantSound = true; started = false; start(); } else { wantSound = false; bgm.pause(); } });
    bgm.addEventListener('play', setLabel); bgm.addEventListener('pause', setLabel); setLabel(); } }
/* deep link: ?station=N (1-based) opens straight at that station */
{ const m = /[?&]station=(\d+)/.exec(location.search); if (m){ stop = Math.max(0, Math.min(STOPS.length-1, (+m[1]) - 1)); u = STOPK[stop]; } }
renderCard();
startInitialStationEntry();
requestAnimationFrame(frame);
})();
