const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('each planner AU boost is one compact row with independent checkbox and cost',()=>{const css=fs.readFileSync(require.resolve('../ship-navigation-ui.css'),'utf8');assert.match(css,/footer \[data-boosts\] label\{flex-wrap:nowrap;gap:4px;padding:4px 0;font-size:13px;white-space:nowrap\}/);assert.match(css,/footer \[name=boost\]\{width:16px;height:16px;flex:none;margin:0\}/);});
test('ship confirmation reuses the form submit beside the map with unchanged eligibility',()=>{const js=fs.readFileSync(require.resolve('../ship-navigation-ui'),'utf8');assert.match(js,/confirmMap.append\(submit\)/);assert.match(js,/submit.disabled=!available\|\|!access\|\|!locked\|\|!destination\|\|speed<=0/);assert.match(js,/if\(submit.disabled\)return/);});

test('destination confirmation clamps inside map and avoids covering an onscreen endpoint',()=>{
 const vm=require('node:vm'),s=fs.readFileSync(require.resolve('../ship-navigation-ui'),'utf8'),c={};vm.runInNewContext(s.slice(s.indexOf('  function confirmPosition('),s.indexOf('  const esc='))+';this.place=confirmPosition;',c);
 for(const point of [{x:200,y:150},{x:0,y:0},{x:400,y:0},{x:0,y:300},{x:400,y:300},{x:-200,y:100},{x:700,y:900}]){const p=c.place(point,400,300);assert.ok(p.x>=0&&p.y>=0&&p.x+64<=400&&p.y+64<=300);if(point.x>70&&point.x<330&&point.y>70&&point.y<230)assert.ok(point.x<p.x||point.x>p.x+64||point.y<p.y||point.y>p.y+64);}
});

test('full pilot layout reuses controls and places Delay body outside map flow',()=>{
 const js=fs.readFileSync(require.resolve('../ship-navigation-ui.js'),'utf8'),commands=fs.readFileSync(require.resolve('../ship-command-ui.js'),'utf8'),css=fs.readFileSync(require.resolve('../ship-navigation-ui.css'),'utf8');
 assert.match(js,/if\(!compact\)form.querySelector\('\.pilot-command'\).before\(vectorPanel\)/);
 assert.ok(js.includes("${compact?waveform:''}"));assert.ok(js.includes('const waveform='),'Carrier artwork source retained');
 assert.ok(js.includes("bottom.append(camera,form.querySelector('.conditional-order-controls'),fields)"));
 assert.match(commands,/conditionalBody.append\(\.\.\.Array.from\(conditional.children\)/);
 assert.match(css,/\.pilot-conditional-body\{position:absolute;top:100%/);
 assert.match(css,/\.pilot-chart.command-page>\.pilot-top-controls\{display:flex!important\}/);
});

function submission(compact,reject=false){
 const vm=require('node:vm'),source=fs.readFileSync(require.resolve('../ship-navigation-ui.js'),'utf8');
 const c={compact,form:{querySelectorAll:()=>[]},redraw(){},submit:{disabled:false},pilotId:'pilot',pilotSicId:'bridge',destination:{q:1,r:0},routeMode:'direct',waypoints:[],submitting:false,locked:true,planning:true,q:{value:1},r:{value:0},error:{textContent:''},remembered:0,rememberDismissal(){c.remembered++},window:{SAShipCommandUI:{conditionalPayload:()=>null}},dialog:{isConnected:true,closed:0,close(){this.closed++;this.isConnected=false;}},bridge:{state:()=>({units:[{id:'pilot'}]}),confirmGmPlayerAction:()=>true,action:async()=>{if(reject)throw Error('Destination is blocked.');}}};
 vm.runInNewContext(source.slice(source.indexOf('    form.onsubmit='),source.indexOf('    const rememberDismissal=')),c);return c;
}
test('only successful Combat planner submission closes, preserving actual Console lifetime',async()=>{for(const compact of [true,false]){const c=submission(compact);await c.form.onsubmit({preventDefault(){}});assert.equal(c.dialog.closed,compact?1:0);assert.equal(c.remembered,compact?1:0);assert.equal(c.submitting,false);}});
test('rejected planner keeps destination and actionable error without closing',async()=>{const c=submission(true,true);await c.form.onsubmit({preventDefault(){}});assert.equal(c.dialog.closed,0);assert.equal(c.error.textContent,'Destination is blocked.');assert.equal(c.destination.q,1);assert.equal(c.locked,true);assert.equal(c.submitting,false);});


test('repeat submit during the same pending request cannot issue a second order',async()=>{
 const c=submission(true);let finish,count=0;c.bridge.action=()=>{count++;return new Promise(resolve=>finish=resolve);};
 const first=c.form.onsubmit({preventDefault(){}});await c.form.onsubmit({preventDefault(){}});assert.equal(count,1);finish();await first;assert.equal(c.dialog.closed,1);
});

test('desktop Bridge and Cockpit Hold center in the existing flex action column',()=>{const css=fs.readFileSync(require.resolve('../ship-navigation-ui.css'),'utf8');assert.match(css,/@media\(min-width:901px\)\{\.ship-navigation-dialog:not\(\.navigation-planner\) footer>\[data-hold\]\{align-self:center\}\}/);});
