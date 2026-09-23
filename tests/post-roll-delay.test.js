const test=require('node:test'),assert=require('node:assert/strict'),delays=require('../delay-rules');
test('post-roll timing subtracts success margin once and scales critical results',()=>{
 assert.equal(delays.afterRoll(20,16,10).seconds,14);
 assert.equal(delays.afterRoll(20,20,10).seconds,5);
 assert.equal(delays.afterRoll(20,5,10).seconds,40);
 assert.equal(delays.afterRoll(20,9,10).seconds,20);
 assert.equal(delays.afterRoll(20,10,10).seconds,20);
 assert.equal(delays.afterRoll(20,100,10).seconds,1);
 assert.equal(delays.afterRoll(20,16,null).seconds,20);
 assert.equal(delays.afterRoll(20,6,0).seconds,14);
 assert.equal(delays.afterRoll(20,6,0).outcome,'Success');
 assert.equal(delays.afterRoll(20,5.9,11).outcome,'Failure');
});
test('the shared factor formula and drone timing remain unchanged',()=>{
 assert.equal(delays.calculate(delays.repairDroneSettings(1)).rate,8);
 assert.equal(100/delays.calculate(delays.repairDroneSettings(1)).rate,12.5);
 assert.equal(delays.calculate({base:8,factors:{Execution:1}}).rate,10);
});
