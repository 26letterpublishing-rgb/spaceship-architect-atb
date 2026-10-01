const test=require('node:test'),assert=require('node:assert/strict');
const puzzle=require('../hacking-puzzle'),maps=require('../ship-map-core');
const {createPracticeService}=require('../hacking-practice');
const secret=()=>({id:'published-example',version:1,password:[...'VXA'],decoys:[...'BZ']});

test('hacking feedback exactly reproduces every published example without slot hints',()=>{
  const board=puzzle.challenge(secret());
  for(const [guess,exact,misplaced] of [['ABZ',0,1],['AXV',1,2],['XAV',0,3],['VXA',3,0]]){
    assert.deepEqual(puzzle.evaluate(board.answer,board.candidates,[...guess]),{exact,misplaced,success:exact===3});
  }
});
test('all five modules reduce false choices first and code letters second',()=>{
  for(const [reduction,length,candidates] of [[0,3,5],[1,3,4],[2,3,3],[3,2,2],[4,1,1]]){
    const board=puzzle.challenge(secret(),reduction);assert.equal(board.length,length);assert.equal(board.candidates.length,candidates);
    assert.equal(new Set(board.candidates).size,candidates);assert.ok(board.answer.every(letter=>board.candidates.includes(letter)));
  }
  assert.equal(puzzle.challenge({password:['A'],decoys:[],version:1},4).length,1,'approved minimum is one letter');
});
test('counter-hack swaps order only and uses strictly less than the fractional Hacking skill',()=>{
  const value=secret(),before=puzzle.challenge(value,3);puzzle.swap(value,0,2);const after=puzzle.challenge(value,3);
  assert.deepEqual(value.password,[...'AXV']);assert.equal(value.version,2);assert.deepEqual(after.candidates,before.candidates);assert.notDeepEqual(after.answer,before.answer);
  assert.equal(puzzle.counterSuccess(3,3),false);assert.equal(puzzle.counterSuccess(2,3),true);assert.equal(puzzle.counterSuccess(3,3.1),true);
  assert.equal(puzzle.counterSuccess(6,6),false);assert.equal(puzzle.counterSuccess(6,6.1),true);
  for(const roll of [0,7,NaN,1.5])assert.throws(()=>puzzle.counterSuccess(roll,3));
  assert.throws(()=>puzzle.swap(value,0,0));assert.throws(()=>puzzle.swap(value,-1,0));
});
test('random secrets contain distinct letters, stable candidates, and no out-of-alphabet symbols',()=>{
  for(let i=0;i<150;i++){
    const security=1+i%18,firewall=i%9,value=puzzle.createSecret(security,firewall),all=[...value.password,...value.decoys];
    assert.equal(new Set(all).size,security+firewall);assert.ok(all.every(c=>/^[A-Z]$/.test(c)));
    assert.deepEqual(puzzle.challenge(value),puzzle.challenge(value));
    assert.equal(puzzle.evaluate(value.password,all,value.password).success,true);
  }
});
test('all CPU Security cards retain source metadata, N/A security and impairment',()=>{
  const costs=[1,2,3,4,5,6,8,10],prices=[100,800,3600,11200,27500,57600,107800,192000];
  for(let tier=1;tier<=8;tier++){
    const type=`cpu-security-${tier}`,d=maps.definition(type);
    assert.equal(d.firewall,tier);assert.equal(d.security,null);assert.equal(d.stations.length,1);assert.equal(d.width,tier<5?1:2);assert.equal(d.height,tier===8?2:1);
    assert.equal(d.energyCost,costs[tier-1]);assert.equal(d.price,prices[tier-1]);assert.equal(d.threshold,9+tier*3);
    assert.equal(puzzle.firewallStats({type}),tier);assert.equal(puzzle.firewallStats({type,impairmentPoints:2}),Math.max(0,tier-2));
    assert.equal(puzzle.firewallStats({type,disabled:true}),0);assert.equal(puzzle.firewallStats({type,status:'destroyed'}),0);
    assert.match(d.cardArt,new RegExp(`tier-${tier}$`));
  }
});
test('all Hacking Modules retain source qualification, reduction, size, power, price and impairment',()=>{
  for(let tier=1;tier<=5;tier++){
    const type=`hacking-module-${tier}`,d=maps.definition(type),item={type};
    assert.equal(d.security,tier);assert.equal(d.price,[500,2900,8100,16000,25000][tier-1]);assert.equal(d.energyCost,[1,1,2,2,3][tier-1]);
    assert.equal(d.height,tier<4?1:2);assert.equal(d.width,1);assert.equal(d.stations.length,1);assert.equal(d.threshold,6+tier*2);
    assert.equal(puzzle.moduleStats(item,tier-1).qualified,true);assert.equal(puzzle.moduleStats(item,tier-1-.01).qualified,false);
    assert.equal(puzzle.moduleStats(item,tier-1).reduction,tier-1);assert.equal(puzzle.moduleStats({...item,impaired:true},4).online,tier!==1);
    assert.equal(puzzle.moduleStats({...item,impairmentPoints:2},4).reduction,Math.max(0,tier-3));assert.equal(puzzle.moduleStats({...item,status:'powered-down'},4).online,false);
  }
});
test('invalid guesses cannot alter state or reveal slot-specific feedback',()=>{
  const value=secret(),board=puzzle.challenge(value),before=JSON.stringify(value);
  for(const guess of [['A','B'],['A','B','V','X'],['Q','V','X'],['a','B','V'],null,{},'VXA'])assert.throws(()=>puzzle.evaluate(board.answer,board.candidates,guess));
  assert.equal(JSON.stringify(value),before);
});
test('feedback holds for every distinct three-letter code and guess in a five-letter alphabet',()=>{
  const permutations=[];for(const a of 'ABCDE')for(const b of 'ABCDE')for(const c of 'ABCDE')if(new Set([a,b,c]).size===3)permutations.push([a,b,c]);
  for(const answer of permutations)for(const guess of permutations){
    const result=puzzle.evaluate(answer,[...'ABCDE'],guess),shared=new Set(guess.filter(c=>answer.includes(c))).size;
    assert.equal(result.exact+result.misplaced,shared);assert.ok(result.exact<=3&&result.misplaced<=3);assert.equal(result.success,answer.join('')===guess.join(''));
  }
});
test('private practice retains a single accepted guess across retries without exposing secrets',()=>{
  const service=createPracticeService(),created=service.create({security:3,firewall:2,tier:1});
  const {token,board}=created,guess=board.candidates.slice(0,3),body={requestId:'reliable-guess-0001',guess};
  const first=service.submit(token,body),again=service.submit(token,body);
  assert.equal(first.history.length,1);assert.equal(again.history.length,1);assert.equal(again.duplicate,true);
  assert.deepEqual(service.get(token).history,first.history);assert.throws(()=>service.submit(token,{...body,guess:guess.toReversed()}),/cannot be changed/);
  const serialized=JSON.stringify(first);for(const name of ['password','decoys','answer','secret','owner','receipts'])assert.ok(!serialized.includes(`"${name}"`));
  assert.throws(()=>service.get('other-client-token'),/session ended/);assert.throws(()=>service.submit(token,{requestId:'bad-guess',guess:['?','?','?']}));assert.equal(service.get(token).history.length,1);
});
test('practice sessions expire, can be replaced, and have bounded capacity without campaign state',()=>{
  let time=0;const service=createPracticeService(()=>time),args={security:3,firewall:2,tier:1},a=service.create(args,'a');
  const b=service.create({...args,previousToken:a.token},'a');assert.throws(()=>service.get(a.token),/session ended/);assert.equal(service.get(b.token).history.length,0);
  time+=4*60*60*1000+1;assert.throws(()=>service.get(b.token),/session ended/);
  for(let i=0;i<8;i++)service.create(args,'a');assert.throws(()=>service.create(args,'a'),/Too many/);
  const own=service.create(args,'b');service.close(own.token);assert.throws(()=>service.get(own.token));
});

test('repeated guesses count each secret letter at most once',()=>{assert.deepEqual(puzzle.evaluate(['A','B','C'],['A','B','C'],['A','A','A']),{exact:1,misplaced:0,success:false});assert.deepEqual(puzzle.evaluate(['B','A','C'],['A','B','C'],['A','A','B']),{exact:1,misplaced:1,success:false});});
