const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('impaired EW-FTL opens the normal host with a valid skill key and submits its unchanged D8 result',()=>{
  const source=fs.readFileSync(require.resolve('../transit-console-ui.js'),'utf8'),host=fs.readFileSync(require.resolve('../character.js'),'utf8'),created=[],messages=[],commands=[],listeners=new Map(),controls=new Map();
  const node=tag=>({tag,value:'12',contentWindow:{postMessage:body=>messages.push(body)},setAttribute(){},append(){},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},remove(){},addEventListener:(type,fn)=>listeners.set(type,fn)});
  const win={confirm:()=>true,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const context={current:()=>({access:{definition:{instantWarp:true},item:{impairmentPoints:2}}}),unit:{characterName:'Test PC'},get:s=>{if(!controls.has(s))controls.set(s,node('control'));return controls.get(s);},doc:{defaultView:win,body:{append(){}},createElement:tag=>{const result=node(tag);created.push(result);return result;}},view:node('dialog'),command:(kind,body)=>commands.push({kind,...body}),crypto:{randomUUID:()=> 'fault-roll'},location:{origin:'http://localhost',href:'http://localhost/index.html'},URL,setTimeout:()=>1,clearTimeout(){}};
  vm.runInNewContext(source.slice(source.indexOf("    get('[data-start]')?.addEventListener"),source.indexOf("    get('[data-cancel]')?.addEventListener")),context);
  listeners.get('click')();const frame=created.find(n=>n.tag==='iframe');assert.equal(frame.src,'http://localhost/character.html?shipRoll=1');assert.equal(commands.length,0);
  const receive=listeners.get('message');receive({origin:'http://localhost',source:frame.contentWindow,data:{type:'sa-ship-skill-ready'}});assert.equal(messages.length,1);const prompt=messages[0];
  const start=host.indexOf('function resolveSkill('),resolver={};vm.runInNewContext(host.slice(start,host.indexOf('\nfunction ',start+10))+';this.resolve=resolveSkill;',resolver);
  const record={skills:Object.fromEntries(require('../skill-catalog').names.map(name=>[name,{tenths:0}])),customSkills:[]};assert.ok(resolver.resolve(record,'base:'+prompt.skill));
  assert.deepEqual([...prompt.sides],[8]);assert.equal(prompt.bonus,0);assert.equal(prompt.exertionAvailable,0);assert.equal(prompt.difficulty,3);assert.match(prompt.title,/EW-FTL integrity/);
  receive({origin:'http://localhost',source:frame.contentWindow,data:{type:'sa-ship-skill-result',rollId:prompt.rollId,diceResults:[2]}});assert.equal(commands.length,1);assert.equal(commands[0].kind,'warpStart');assert.equal(commands[0].distanceLY,12);assert.deepEqual([...commands[0].diceResults],[2]);
});
