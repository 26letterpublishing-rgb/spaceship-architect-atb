const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Combat View remembers the choice before closing; console switching does not opt out',async()=>{
 const calls=[],unit={id:'nova',characterName:'Nova',location:{}},ship={id:'s',ship:{minerals:{},sicInventory:[]}},nodes=new Map();let view;
 const element=()=>({dataset:{},classList:{toggle(){}},listeners:{},value:'',setAttribute(){},append(){},showModal(){this.open=true;},addEventListener(k,fn){this.listeners[k]=fn;},remove(){},close(){calls.push('close');this.open=false;this.listeners.close?.();},querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s);}});
 const doc={head:{append(){}},body:{append(){}},querySelector:()=>null,createElement:tag=>tag==='dialog'?(view=element()):element(),defaultView:{addEventListener(){}}};
 const context={window:{SACombatBridge:{state:()=>({units:[unit],starships:[ship],spaceObjects:[]}),soundEnabled:()=>false},SAStationAccess:{access:()=>({ship,item:{},definition:{planetaryCleanser:true}})},SAShipNavigationUI:{remember:u=>calls.push('remember:'+u.id),mountSelector:(_a,_b,_c,close)=>context.switchConsole=close},addEventListener(){}},document:doc,location:{href:'http://localhost/index.html',origin:'http://localhost'},URL,setInterval:()=>1,clearInterval(){},setTimeout,crypto};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../cleanser-ui.js'),'utf8'),context);await context.window.SACleanserConsole.open(unit,'cleanser');nodes.get('[data-close]').onclick();assert.deepEqual(calls,['remember:nova','close']);assert.equal(context.window.SACleanserConsole.isOpen(),false);
 calls.length=0;await context.window.SACleanserConsole.open(unit,'cleanser');context.switchConsole();assert.deepEqual(calls,['close']);
});
test('dice flood uses the existing pool, caps its workload and leaves ordinary rolls untouched',()=>{
 const source=fs.readFileSync(require.resolve('../dice-roller.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export class PhysicalDiceRoller','class PhysicalDiceRoller');
 const c={THREE:{Vector3:class{}},ResizeObserver:class{}};vm.createContext(c);vm.runInContext(source+'\nthis.Roller=PhysicalDiceRoller;',c);const roller=new c.Roller({});roller.rollDice=o=>o;
 const flood=roller.rollPool({sides:Array(20000).fill(12),values:[7,8],presentation:'avalanche',damage:true,fusion:false});assert.equal(flood.dice.length,192);assert.equal(flood.avalanche,true);assert.equal(flood.fusion,false);assert.equal(flood.dice[0].sides,12);assert.equal(flood.dice[0].replayValue,7);assert.equal(flood.dice[0].color,0xa40d20);
 const normal=roller.rollPool({sides:[4,6,12],values:[1,2,3]});assert.equal(normal.avalanche,false);assert.equal(normal.dice.length,3);assert.equal(normal.fusion,true);assert.equal(normal.dice[2].replayValue,3);
});
