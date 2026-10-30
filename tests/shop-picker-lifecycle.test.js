const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../shop-ui.js'),'utf8');
function setup(){
 let observer,disposed=0,closed=0;
 const context={MutationObserver:class{constructor(fn){this.notify=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function shopSnapshot'),source.indexOf('export function renderShop')),context);
 const host={dataset:{destination:'A'},isConnected:true,hidden:false,firstElementChild:{},ownerDocument:{documentElement:{},location:{href:'http://localhost/character.html?campaign=ROOM&character=pc'}},_market:{dispose(){disposed++;}},_cardResize:{disconnect(){}}};
 const options={characterId:'pc',canBuy:true,credits:100,groupCredits:100,gear:[],ships:[{id:'A',auState:{current:2}}],shops:{offers:[{id:'sic:sensors-1',price:10}],stored:[]},buySic:()=>1};
 const session=context.shopSession(host,options);session.root=host.firstElementChild;session.snapshot=context.shopSnapshot(host,options);
 session.track({addEventListener(){},close(){closed++;}});
 return {context,host,options,session,notify:()=>observer.notify(),counts:()=>({disposed,closed})};
}
test('unchanged deep replacement retains picker and refreshes callback context',()=>{
 const s=setup(),replacement=JSON.parse(JSON.stringify(s.options));replacement.buySic=()=>2;
 assert.equal(s.context.shopSession(s.host,replacement).retained,true);assert.equal(s.session.options.buySic(),2);assert.equal(s.session.options.ships,replacement.ships);assert.deepEqual(s.counts(),{disposed:0,closed:0});
});
for(const [name,change]of Object.entries({permission:o=>o.canBuy=false,price:o=>o.shops.offers[0].price++,stock:o=>o.shops.stored.push({id:'new'}),power:o=>o.ships[0].auState.current++,credits:o=>o.credits++,operator:o=>o.characterId='other',shipRemoval:o=>o.ships=[]}))test(name+' invalidates picker and owned inspector',()=>{
 const s=setup();change(s.options);const next=s.context.shopSession(s.host,s.options);assert.notEqual(next,s.session);assert.deepEqual(s.counts(),{disposed:1,closed:1});assert.throws(()=>s.session.assertCurrent(),/Shop changed/);
});
for(const key of ['destination','shopTab','search'])test(key+' invalidates instead of reusing stale controls',()=>{const s=setup();s.host.dataset[key]='different';s.context.shopSession(s.host,s.options);assert.equal(s.counts().closed,1);});
for(const key of ['hidden','isConnected'])test(key+' teardown closes once and prevents stale callback',()=>{const s=setup();s.host[key]=key==='hidden';s.notify();s.notify();assert.deepEqual(s.counts(),{disposed:1,closed:1});assert.throws(()=>s.session.assertCurrent(),/Shop changed/);});
test('unserializable context cannot be retained',()=>{const s=setup();s.options.circular=s.options;s.context.shopSession(s.host,s.options);assert.equal(s.counts().closed,1);});
test('packet walking-clock calibration retains UI but refreshes live record',()=>{const s=setup();const next=structuredClone({...s.options,buySic:undefined});next.ships[0].walkClockOffset=-20;assert.equal(s.context.shopSession(s.host,next).retained,true);assert.equal(s.session.options.ships[0].walkClockOffset,-20);});
test('external DOM replacement cannot retain detached controls',()=>{const s=setup();s.host.firstElementChild={};s.context.shopSession(s.host,s.options);assert.equal(s.counts().closed,1);});

test('campaign URL change invalidates and blocks old callbacks',()=>{const s=setup();s.host.ownerDocument.location.href='http://localhost/character.html?campaign=OTHER&character=pc';assert.throws(()=>s.session.assertCurrent(),/Shop changed/);s.context.shopSession(s.host,s.options);assert.equal(s.counts().closed,1);});
