const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'..','film-player.js'),'utf8');
const existing=fs.readFileSync(require('path').join(__dirname,'player.cjs'),'utf8');
const setup=existing.split('const setup = `')[1].split('`;')[0];
const photo=source.slice(source.indexOf('const PHOTO_MODE ='),source.indexOf('/* ---------- loop ---------- */'));
const ctx=vm.createContext({assert});
vm.runInContext(setup+`let deny=false;const button={hidden:true,addEventListener(k,fn){this.click=fn}};document.getElementById=id=>id==='play-tour'?button:null;Media.prototype.play=function(){if(deny){const e=new Error('gesture required');e.name='NotAllowedError';return Promise.reject(e)}this.paused=false;this.readyState=2;if(this.listeners.loadeddata)this.listeners.loadeddata();return Promise.resolve()};`+photo,ctx);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 vm.runInContext(`warmLoop(0);assert.equal(loops[0].v.paused,false);assert.equal(loops[0].ready,true);updatePlates(0);assert.equal(loops[0].v.paused,false);`,ctx);await flush();
 console.log('PASS initial playback requests decoding without waiting for loadeddata');
 vm.runInContext(`loops[0].v.pause();deny=true;playLoop(loops[0]);`,ctx);await flush();
 vm.runInContext(`assert(playbackBlocked);assert.equal(button.hidden,false);assert.equal(loops[0].v.paused,true);`,ctx);
 console.log('PASS rejected mobile autoplay exposes explicit play control');
 vm.runInContext(`deny=false;button.click();assert.equal(playbackBlocked,false);assert.equal(loops[0].v.paused,false);assert.equal(loops[0].v.muted,true);`,ctx);await flush();
 console.log('PASS user gesture resumes muted animation');
 vm.runInContext(`reduce=true;loops[0].v.pause();showPlaybackButton();assert(!button.hidden);button.click();assert.equal(reduce,false);assert.equal(loops[0].v.paused,false);`,ctx);await flush();
 console.log('PASS reduced motion remains opt-in through explicit play action');
})().catch(e=>{console.error(e);process.exitCode=1});
