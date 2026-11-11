const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
const entries=require('../console-layout-catalog').entries(require('../console-viewer').catalog);
const affected=entries.filter(e=>e.route==='lock');
(async()=>{assert.equal(affected.length,10);const h=await harness(),b=await chromium().launch({channel:'chrome',headless:true}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-lock-headers-'));console.log(out);
try{const p=await b.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
for(const width of [1920,1366,1280])for(const e of affected){
 await p.setViewportSize({width,height:width===1920?1080:width===1366?768:720});await p.goto(h.base+'/'+e.url);
 const d=p.locator('dialog.lock-console.weapon-named-header[open]');await d.waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
 const r=await d.evaluate(d=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};return{h:rect(d.querySelector('header')),t:rect(d.querySelector('header h2')),s:rect(d.querySelector('header select')),m:rect(d.querySelector('header [data-sound]')),identity:rect(d.querySelector('header>div:first-child')),title:d.querySelector('header h2').textContent,expected:d.querySelector('.lock-controls>h3').textContent,font:parseFloat(getComputedStyle(d.querySelector('header h2')).fontSize),meter:getComputedStyle(d.querySelector('header [data-command]')).display,defense:d.querySelector('.console-defense').textContent,ship:d.querySelector('.weapon-header-ship').textContent};});
 assert.equal(r.title,r.expected);assert(r.font>=24);assert.equal(r.meter,'none');assert(r.defense&&r.ship);
 for(const k of ['t','s','m','identity']){const x=r[k];assert(x.y>=r.h.y-1&&x.y+x.h<=r.h.y+r.h.h+1,e.id+' '+width+' '+k+' bounds '+JSON.stringify(r));}
 assert(r.s.x+r.s.w<=r.m.x,e.id+' selector/mute');assert(Math.abs(r.s.y+r.s.h/2-r.m.y-r.m.h/2)<2,e.id+' mute row');assert(r.t.x+r.t.w<=r.s.x+1,e.id+' title overlap');
 const mute=d.locator('header [data-sound]'),old=await mute.getAttribute('aria-pressed');await mute.focus();await p.keyboard.press('Space');await p.waitForTimeout(200);assert.notEqual(await mute.getAttribute('aria-pressed'),old);
 await d.locator('header select').focus();await p.keyboard.press('ArrowDown');await p.keyboard.press('Tab');
 if(['lock-on-1','lock-on-10'].includes(e.id))await p.screenshot({path:path.join(out,e.id+'-'+width+'.png')});
 await d.locator('.dialog-circle-close').click();await d.waitFor({state:'detached'});checks.push({id:e.id,width,r});
}
for(const e of entries.filter(e=>/^rapid-laser-/.test(e.id))){await p.goto(h.base+'/'+e.url);await p.locator('dialog.weapon-console[open]').waitFor();assert.equal(await p.locator('.weapon-named-header').count(),0);await p.locator('header [data-command]').waitFor({state:'visible'});}
// Read-only header state projections: no actual firing or live campaign.
await p.goto(h.base+'/'+affected.find(e=>e.id==='lock-on-1').url);const d=p.locator('dialog.lock-console.weapon-named-header[open]');await d.waitFor();
await p.evaluate(()=>{window.headerState=SACombatBridge.state();SACombatBridge.state=()=>headerState;headerState.practice=false;});
for(const [mode,want]of [['ready','YOUR TURN'],['pending','ACQUIRING TARGET'],['roll','ROLL REQUIRED'],['hold','HOLDING / 99%'],['paused','STANDBY']]){
 await p.evaluate(mode=>{const s=headerState,u=s.units[0];s.activeId=u.id;s.hardPaused=false;u.consoleHold=false;u.delayedAction=null;u.delayTimer=null;u.timedAction=null;if(mode==='pending'||mode==='roll')u.delayedAction={kind:'weapon',awaitingRoll:mode==='roll'};if(mode==='hold')u.consoleHold=true;if(mode==='paused'){s.activeId=null;s.hardPaused=true;}},mode);
 await p.waitForTimeout(400);assert((await d.locator('[data-turn]').innerText()).includes(want),mode);
}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));console.log('PASS 30 header layouts, five Rapid exclusions, keyboard mute/selector/close and five status projections');
}finally{await b.close();await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1});
