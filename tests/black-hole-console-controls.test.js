const test=require('node:test'),assert=require('node:assert/strict');
const {intensityPresentation}=require('../black-hole-gun-console');
const gun=require('../ship-black-hole-gun');
test('Console slider uses requested 1–50 range and existing authoritative AU cost',()=>{
 for(let n=1;n<=50;n++){const cost=gun.cost(n);assert.deepEqual(intensityPresentation(n,cost),{intensity:n,valid:true,cost,insufficient:false});assert.equal(intensityPresentation(n,cost-1).insufficient,true);}
 for(const n of [0,51,100,1.5,NaN,Infinity])assert.equal(intensityPresentation(n,5000).valid,false);
 // The presentation limit does not redefine the existing engine cost/rules.
 assert.equal(gun.cost(100),5050);
});
test('AU presentation changes immediately across available-power boundary',()=>{
 assert.equal(intensityPresentation('13',100).insufficient,false);
 assert.equal(intensityPresentation('14',100).insufficient,true);
 assert.equal(intensityPresentation('14',105).insufficient,false);
 assert.equal(intensityPresentation('1',0).insufficient,true);
});
