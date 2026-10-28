(function(){
'use strict';
/* Film playback does not initialize WebGL, scene textures or the optional 3D tour. */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('c');
canvas.setAttribute('aria-label','ATOMIKA film tour. Swipe or scroll up and down, or use Next and Back to travel.');
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const V = (x,y,z) => ({x,y,z});
const W = (x,z,y) => ({x,y,z});
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
  {name:'Launch Control', eyebrow:'LCC · Level −1 · 1962', title:'Launch Control, 1962', desc:'The upper chamber returns to its alert posture. Crew members work the main console as if the order could come at any moment.'},
  {name:'Deep Space', eyebrow:'LCC · Level −2 · Immersive', title:'Deep Space', desc:'Below the crew, the walls dissolve into moving pictures of the cosmos. A different kind of transmission.'},
  {name:'Tunnel', eyebrow:'Below grade', title:'The Tunnel', desc:'Forty feet of corrugated steel from the base of the stair shaft to the silo, sealed by blast doors.'},
  {name:'The Silo', eyebrow:'Silo', title:'The Silo', desc:'One hundred seventy-four feet down and fifty-two across. Look down.'},
  {name:'The Doors', eyebrow:'Surface', title:'Through the Doors', desc:'Up and out, through doors of about seventy-five tons each. The silo is calling.'}
];
const STOPK = K.map((k,i) => k.s !== undefined ? i : -1).filter(i => i >= 0);
const LABELS = [];
let stop=0,u=0,anim=null,yaw=0,pitch=0,modeOrbit=false;
/* Preserve the route's altitude readout without constructing a 3D scene. */
function altitude(u){
  u=Math.max(0,Math.min(K.length-1,u));const i=Math.min(K.length-2,Math.floor(u)),f=u-i;
  const a=K[Math.max(0,i-1)].p.y,b=K[i].p.y,c=K[i+1].p.y,d=K[Math.min(K.length-1,i+2)].p.y;
  if(i===0)return Math.exp(Math.log(b)+(Math.log(c)-Math.log(b))*f*f*(3-2*f));
  return .5*(2*b+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);
}
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
  stop = i; renderCard(); wake();
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

const PHOTO_MODE = !/[?&]3d\b/.test(location.search);
const PHOTOS = {0:'01-roswell-paced', 1:'02-approach', 2:'03-festival-grounds', 3:'04-the-site', 4:'05-entry-wide', 5:'06-stair-shaft', 6:'07-single-console', 7:'08-deep-space', 8:'09-tunnel', 9:'10-the-silo', 10:'11-through-the-doors'};
const CLIPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];  /* station indexes i that have transitions/<i+1>-<i+2>.mp4 */
const SOFT_START = {3:1, 5:1};  /* clips that no longer start on the current photo: dissolve into them instead of cutting */
const plates = {}, clips = {}, loops = {}, pad2 = n => String(n).padStart(2, '0');
if (PHOTO_MODE){
  Object.keys(PHOTOS).forEach(k => { const img = (+k === 0 && document.getElementById('aerial-firstpaint')) || new Image(); img.alt = ''; img.decoding = 'async'; const pl = {img, ready:!!(img.complete && img.naturalWidth), t0:0, src:'stations/' + PHOTOS[k] + '.jpg'};
    if (+k === 0){ img.style.inset = '0'; img.style.width = '100%'; img.style.height = '100%'; }
    img.onload = () => { pl.ready = true; }; $('photos').appendChild(img); plates[k] = pl; });
  CLIPS.forEach(i => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none';
    v.dataset.src = (i === 0 ? 'transitions/01-02-matched-arrival' : i === 1 ? 'transitions/02-03-joined' : i === 2 ? 'transitions/03-04-road-only' : i === 3 ? 'transitions/04-05-entry-wide' : i === 4 ? 'transitions/05-06-doorway-hd' : i === 5 ? 'transitions/06-07-single-console' : i === 6 ? 'transitions/07-08-stair-walk' : i === 7 ? 'transitions/08-09-native-frames' : 'transitions/' + pad2(i+1) + '-' + pad2(i+2)) + (v.canPlayType('video/mp4; codecs="avc1.640028"') ? '.mp4' : '.webm'); const c = {v, ready:false};
    v.addEventListener('loadeddata', () => { c.ready = true; }); $('photos').appendChild(v); clips[i] = c; });
  /* a living loop per station: the last seconds of the film that arrives there, played back and forth, so nothing ever freezes */
  Object.keys(PHOTOS).forEach(k => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none';
    /* Station 1 approaches the road once, then repeats only its forward-moving traffic body. */
    v.dataset.src = (+k === 0 ? 'loops/01-city-paced' : +k === 1 ? 'loops/02-lasers' : +k === 2 ? 'loops/03-joined-standby' : +k === 3 ? 'loops/04-road-only' : +k === 4 ? 'loops/05-entry-wide' : +k === 5 ? 'loops/06-guide' : +k === 6 ? 'loops/07-single-console' : +k === 8 ? 'loops/09-native-frames' : +k === 10 ? 'loops/11-crowd-reshoot' : 'loops/' + pad2(+k + 1)) + (v.canPlayType('video/mp4; codecs="avc1.640028"') ? '.mp4' : '.webm');
    const l = {v, ready:false, introPace:+k === 7, restart:+k === 0 ? 10.8 : +k === 1 ? 2 : +k === 2 ? 7.4 : +k === 3 ? 0.5 : +k === 4 ? 31/30 : +k === 5 ? 0.6 : +k === 6 ? 0 : +k === 8 ? 0 : +k === 10 ? 8 : undefined, roadStart:+k === 0 ? 10.8 : undefined};
    v.addEventListener('loadeddata', () => { l.ready = true; }); $('photos').appendChild(v); loops[k] = l;   /* A decoded first frame is enough; keep the outgoing layer underneath if buffering resumes. */
    /* the dwell file is the shot once, then a body that connects end to start: at the end, continue from the body's keyframe */
    const repeat = e => {
      if (reduce || e.currentTarget !== l.v) return;
      l.cycles = (l.cycles || 0) + 1;
      const active = l.v, spare = l.spare;
      if (spare && l.primed && spare.readyState >= 2 && !spare.seeking && !spare.error){
        /* Decode the next traffic, laser, crowd or entry-loop frame on a second video before exchanging players. */
        spare.style.opacity = active.style.opacity; spare.style.zIndex = active.style.zIndex;
        active.style.opacity = '0'; l.v = spare; l.spare = active; l.primed = false; l.playing = false;
        playLoop(l); primeEntryLoop(l);
      } else { active.currentTime = l.restart || 0; active.play().catch(() => {}); }
    };
    v.addEventListener('ended', repeat);
    if ((+k === 0 || +k === 1 || +k === 2 || +k === 3 || +k === 4 || +k === 5 || +k === 6 || +k === 8 || +k === 10) && !reduce){
      const spare = document.createElement('video'); spare.muted = true; spare.playsInline = true;
      spare.setAttribute('playsinline', ''); spare.preload = 'none'; spare.dataset.src = v.dataset.src;
      spare.addEventListener('loadedmetadata', () => primeEntryLoop(l)); spare.addEventListener('ended', repeat);
      $('photos').appendChild(spare); l.spare = spare;
    }
    fetch(+k === 0 ? 'loops/01-city-paced.json' : +k === 1 ? 'loops/02-lasers.json' : +k === 2 ? 'loops/03-joined-standby.json' : +k === 3 ? 'loops/04-road-only.json' : +k === 4 ? 'loops/05-entry-wide.json' : +k === 5 ? 'loops/06-guide.json' : +k === 6 ? 'loops/07-single-console.json' : +k === 8 ? 'loops/09-native-frames.json' : +k === 10 ? 'loops/11-crowd-reshoot.json' : 'loops/' + pad2(+k + 1) + '.json').then(r => r.json()).then(j => { l.restart = j.restart; l.roadStart = j.roadStart; primeEntryLoop(l); }).catch(() => {}); });
}
function primeEntryLoop(l){
  if (!l.spare || l.primed || l.restart === undefined || l.spare.readyState < 1) return;
  l.spare.pause(); l.spare.currentTime = l.restart; l.primed = true;
}
function warmLoop(k, withSpare=false){ const l=loops[k]; if(!l)return;
  if(!l.v.getAttribute('src')){ l.v.src=l.v.dataset.src;l.v.preload='auto';l.v.load(); }
  if(withSpare && l.spare && !l.spare.getAttribute('src')){ l.spare.src=l.spare.dataset.src;l.spare.preload='auto';l.spare.load(); }
}
function releaseVideo(v){
  if(!v || !v.getAttribute('src'))return;
  v.pause();v.style.opacity='0';v.removeAttribute('src');v.preload='none';v.load();
}
function retainNearbyMedia(){
  /* Retain the current film, its decoded repeat and only the next station's main player.
     Release previous decoders and buffers once the visible handoff has completed. */
  for(const k in loops){if(+k===stop || +k===stop+1)continue;
    const l=loops[k];releaseVideo(l.v);releaseVideo(l.spare);l.ready=false;l.primed=false;l.playing=false;l.armed=false;l.shownAt=undefined;
  }
  for(const k in clips){if(+k!==stop){releaseVideo(clips[k].v);clips[k].ready=false;}}
}
/* fetch the clip that leaves the current station, so Next can play it without waiting */
/* Warm the actual deep-linked station only after the URL has been parsed. */ /* Prioritize nearby media rather than downloading every film at once. */
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
  const c = to > from && !SKIP_FILM[to - 1] ? clips[to - 1] : null, now = performance.now(); if (!reduce) warmLoop(to,true);
  const festivalFlight = from === 1 && to === 2;
  const sharedTail = to > from && (to === 6 || to === 7) ? 1 : 0;
  tr = {from, to, cleanAerial, festivalFlight, sharedTail, walkRate:to > from && to === 7 ? 0.65 : 1, arrivalRate:to === 7 ? 0.75 : 1, clipStart:festivalFlight ? 0.6 : 0, aerialWaitAt:now, t0:now, clip:null, fadeIn: true, fadeMs: from === 6 && to === 7 ? 60 : festivalFlight ? 300 : cleanAerial ? 600 : (to !== from + 1 || SOFT_START[to - 1]) ? 1400 : 900};
  if (cleanAerial && !reduce && loops[0].v.currentTime < (loops[0].roadStart || 10.8)){
    warmLoop(0); warmClip(0); tr.pendingRoad = true; tr.roadDeadline = now + Math.max(5000,((loops[0].roadStart || 10.8)-loops[0].v.currentTime)*1000+2000); tr.dur = tr.roadDeadline-now+9000;
    return tr.dur;
  }
  /* The departure reference is the room's last frame. Finish its current gesture
     before continuing into the stair walk, rather than dissolving two poses. */
  if (from === 6 && to === 7 && !reduce && videoReady(loops[6])){
    warmClip(6); tr.pendingRoom = true; tr.roomCycle = loops[6].cycles || 0;
    tr.roomDeadline = now + Math.max(2000, (loops[6].v.duration - loops[6].v.currentTime)*1000 + 1500);
    tr.dur = tr.roomDeadline-now+15000; return tr.dur;
  }
  const filmWait = festivalFlight || sharedTail ? 12000 : 3000;
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
  if (c){ tr.clip = c; c.v.currentTime = tr.clipStart || 0; c.v.playbackRate = tr.walkRate; c.v.style.transform = ''; c.v.play().catch(() => { if (tr && tr.clip === c) startTransition(null, performance.now()); }); tr.dur = Math.max(1500, (c.v.duration || 4)*1000/(tr.walkRate || 1) + 4000); }
  else { tr.clip = null; tr.dur = reduce ? 350 : (tr.cleanAerial ? 1200 : 4200); }
  if (anim){ anim.t0 = now; anim.dur = tr.dur; } }
function updatePlates(now){
  if (!PHOTO_MODE){ photoCover = false; return; }
  const pan = (x, y) => 'translate(' + (-Math.max(-1, Math.min(1, x))*3.5).toFixed(2) + '%,' + (Math.max(-1, Math.min(1, y))*3.5).toFixed(2) + '%)';
  if (tr && tr.pendingRoom){
    const room = loops[6];
    if ((room.cycles || 0) !== tr.roomCycle || room.v.currentTime >= room.v.duration - 1/24 || now > tr.roomDeadline){
      tr.pendingRoom = false;
      if (videoReady(clips[6])) startTransition(clips[6], now);
      else { tr.pending = clips[6]; tr.waitUntil = now + 12000; }
    } else {
      room.v.style.opacity = '1'; room.v.style.zIndex = '2'; playLoop(room);
      photoCover = true; canvas.style.opacity = '0'; return;
    }
  }
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
    /* Give walking a calmer pace, matching the destination pace before the shared arrival
       footage so both players keep the same motion and timing. */
    if (tr.sharedTail && d) v.playbackRate = tr.walkRate + (tr.arrivalRate-tr.walkRate)*smooth(0, 2, ct - (d - tr.sharedTail - 2));
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
  if (!tr && !reduce){
    warmLoop(stop,true);
    /* Let the visible HD film decode before competing downloads start. */
    if(videoReady(loops[stop])){warmClip(stop);warmLoop(stop+1);}
    retainNearbyMedia();
  }
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
  const endFade = clipActive ? smooth(1 - Math.min(0.4, (tr.sharedTail ? tr.sharedTail*1000 : tr.cleanAerial ? 450 : 900)/filmMs), 1, p) : 0;
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
    /* Matched arrivals share their last frames with the destination's opening.
       Align both decoders so people do not ghost or restart at the handoff. */
    if ((tr.festivalFlight || tr.sharedTail) && l && l.armed && endFade > 0){
      const arrivalTime = Math.max(0, tr.clip.v.currentTime - (tr.clip.v.duration - (tr.sharedTail || 0.9)));
      if (!l.v.seeking && Math.abs(l.v.currentTime - arrivalTime) > (tr.sharedTail ? 1/24 : 0.1)) l.v.currentTime = arrivalTime;
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
    /* Deep Space opens gently, then reaches its usual pace before the repeat body. */
    if (l.introPace) l.v.playbackRate = 0.75 + 0.25*smooth(4, 7, l.v.currentTime);
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
    if (tr && (tr.festivalFlight || tr.sharedTail) && i === tr.to && tr.arrivalStalled){ l.v.pause(); }
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
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
let frameRequest=0,idleTimer=0,hiddenAt=null;
function wake(){
  if(document.hidden || frameRequest)return;
  clearTimeout(idleTimer);idleTimer=0;frameRequest=requestAnimationFrame(frame);
}
function frame(now){
  frameRequest=0;if(document.hidden)return;
  if(anim){const k=Math.min(1,(now-anim.t0)/anim.dur),e=ease(k);u=anim.from+(anim.to-anim.from)*e;
    yaw=anim.y0*(1-e);pitch=anim.p0*(1-e);if(k>=1){anim=null;u=STOPK[stop];yaw=0;pitch=0;}}
  const y=altitude(u);$('depth').textContent=y>=0?'ALT '+Math.round(y).toLocaleString('en-US')+' FT':'DEPTH '+Math.round(-y)+' FT';
  updatePlates(now);
  const settling=loops[stop] && (loops[stop].shownAt===undefined || now-loops[stop].shownAt<700);
  /* Native video keeps its encoded frame rate. Only idle UI work runs less often. */
  if(tr || anim || settling || drag)wake();else idleTimer=setTimeout(wake,100);
}
document.addEventListener('visibilitychange',()=>{
  const now=performance.now();
  if(document.hidden){hiddenAt=now;cancelAnimationFrame(frameRequest);frameRequest=0;clearTimeout(idleTimer);
    Object.values(clips).forEach(c=>c.v.pause());Object.values(loops).forEach(l=>{l.v.pause();if(l.spare)l.spare.pause();});
  }else{
    const dt=hiddenAt===null?0:now-hiddenAt;hiddenAt=null;
    if(anim)anim.t0+=dt;
    if(tr){tr.t0+=dt;tr.aerialWaitAt+=dt;if(tr.waitUntil)tr.waitUntil+=dt;if(tr.roadDeadline)tr.roadDeadline+=dt;if(tr.handoffAt)tr.handoffAt+=dt;
      if(tr.clip && !tr.clip.v.ended)tr.clip.v.play().catch(()=>{});}
    wake();
  }
});
/* Soundtrack: review links require an explicit sound-button press; ordinary visits start after interaction. */
{ const bgm = document.getElementById('bgm'), sbtn = document.getElementById('sound');
  if (bgm && bgm.getAttribute('src')){
    sbtn.hidden = false; let wantSound = !new URLSearchParams(location.search).has('review'), started = false;
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
if(!reduce)warmLoop(stop,true);
startInitialStationEntry();
wake();
})();
