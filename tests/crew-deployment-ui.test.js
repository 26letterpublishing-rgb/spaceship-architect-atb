const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','crew-deployment.js'),'utf8');
function harness(){
 const ship={id:'one'},cell={column:0,row:0,stations:[{x:0,y:0,mesh:4}]},layout={hull:new Set([0,1,2]),footprint:new Map([[0,cell],[2,{blocked:true,stations:[]}]])},units=[{location:{starshipId:'one',square:0,mesh:4}}];
 const c=vm.createContext({window:{},layouts:new Map([['one',layout]]),units});vm.runInContext(source,c);
 vm.runInContext(source.slice(source.indexOf('  function valid('),source.indexOf('  function assign(')),c);return{c,ship,units};
}
test('deployment rejects unplaced or fractional positions instead of treating null as hull square zero',()=>{const{c,ship}=harness();for(const location of [{square:null},{square:undefined},{square:.5},{square:1,mesh:1.2},{square:2,mesh:4},{square:1,mesh:9}])assert.equal(c.valid(ship,location,1),false);assert.equal(c.valid(undefined,{square:1},1),false);});
test('deployment station picker respects the one-person station limit and allows keeping your own seat',()=>{const{c,ship}=harness();assert.equal(c.valid(ship,{square:0,mesh:4},1),false);assert.equal(c.valid(ship,{square:0,mesh:4},0),true);assert.equal(c.valid(ship,{square:0,mesh:5},1),true);});
test('deployment allows two characters off-station and rejects a third',()=>{const{c,ship,units}=harness();units[0].location={starshipId:'one',square:1,mesh:4};assert.equal(c.valid(ship,{square:1,mesh:4},1),true);units.push({location:{starshipId:'one',square:1,mesh:4}});assert.equal(c.valid(ship,{square:1,mesh:4},2),false);});
