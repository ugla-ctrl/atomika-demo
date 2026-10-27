const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'..','film-player.js'),'utf8');
const code=html.slice(html.indexOf('/* Wheel gestures work'),html.indexOf('/* Keep film framing'));
function context(){
 const wheel={},pointer={};const state={clock:1000,stop:4,anim:null,tr:null,PHOTO_MODE:true,STOPS:Array.from({length:11},()=>({orbit:true})),yaw:0,pitch:0,window:{innerHeight:800,addEventListener:(k,f)=>wheel[k]=f},canvas:{addEventListener:(k,f)=>pointer[k]=f,setPointerCapture(){},classList:{add(){},remove(){}}},performance:{now:()=>state.clock},go:i=>{state.stop=Math.max(0,Math.min(10,i));state.moves++;},moves:0};vm.createContext(state);vm.runInContext(code,state);state.wheel=wheel.wheel;state.pointer=pointer;return state;
}
function event(d,extra={}){return {deltaY:d,deltaX:0,deltaMode:0,target:{closest:()=>null},preventDefault(){this.prevented=true},...extra};}
let n=0;function check(name,f){f(context());n++;console.log('PASS '+name)}
check('desktop wheel goes forward then backward',s=>{s.wheel(event(100));assert.equal(s.stop,5);s.clock+=1100;s.wheel(event(-100));assert.equal(s.stop,4)});
check('wheel navigation also works over the card',s=>{const panel={scrollHeight:200,clientHeight:200};s.wheel(event(-100,{target:{closest:q=>q==='.card,.rail'?panel:null}}));assert.equal(s.stop,3)});
check('a new opposite gesture does not inherit accumulated distance',s=>{s.wheel(event(60));s.clock+=10;s.wheel(event(-60));assert.equal(s.moves,0);s.clock+=10;s.wheel(event(-30));assert.equal(s.stop,3)});
check('zoom and horizontal gestures do not move station',s=>{s.wheel(event(200,{ctrlKey:true}));s.wheel(event(30,{deltaX:100}));assert.equal(s.moves,0)});
check('scrolling inside overflowing card stays native',s=>{const panel={scrollHeight:400,clientHeight:200,scrollTop:50};const e=event(100,{target:{closest:q=>q==='.card,.rail'?panel:null}});s.wheel(e);assert.equal(s.moves,0);assert(!e.prevented)});
check('select menus keep their native wheel behavior',s=>{const e=event(100,{target:{closest:q=>q==='input,select,textarea,[contenteditable]'?{}:null}});s.wheel(e);assert.equal(s.moves,0);assert(!e.prevented)});
check('line-mode wheels use normalized distance',s=>{s.wheel(event(-5,{deltaMode:1}));assert.equal(s.stop,3)});
check('momentum cannot skip a second station',s=>{s.wheel(event(100));s.clock+=50;s.wheel(event(100));assert.equal(s.moves,1)});
check('swipe up goes forward and swipe down goes back',s=>{const p=s.pointer;p.pointerdown({clientX:100,clientY:300,pointerType:'touch',pointerId:1});p.pointerup({type:'pointerup',clientX:105,clientY:180});assert.equal(s.stop,5);p.pointerdown({clientX:100,clientY:100,pointerType:'touch',pointerId:2});p.pointerup({type:'pointerup',clientX:105,clientY:220});assert.equal(s.stop,4)});
check('a tap or sideways drag does not navigate',s=>{const p=s.pointer;for(const [x,y]of [[102,104],[250,120]]){p.pointerdown({clientX:100,clientY:100,pointerType:'touch',pointerId:1});p.pointerup({type:'pointerup',clientX:x,clientY:y})}assert.equal(s.moves,0)});
check('cancelled touches cannot advance a station',s=>{const p=s.pointer;p.pointerdown({clientX:100,clientY:300,pointerType:'touch',pointerId:1});p.pointercancel({type:'pointercancel',clientX:100,clientY:100});assert.equal(s.moves,0)});
console.log(n+' navigation checks passed');
