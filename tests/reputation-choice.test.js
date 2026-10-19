const test=require('node:test'),assert=require('node:assert/strict'),choice=require('../reputation-choice');
test('reselecting a Reputation dot replaces the one pending change relative to the original',()=>{
 const original=[5,4,6,0,10];
 assert.deepEqual(choice.preview(original,choice.choose(original,0,4)),[4,4,6,0,10]);
 assert.deepEqual(choice.preview(original,choice.choose(original,1,5)),[5,5,6,0,10]);
 assert.deepEqual(choice.preview(original,choice.choose(original,0,6)),[6,4,6,0,10]);
 assert.equal(choice.choose(original,0,0),undefined);assert.equal(choice.choose(original,0,10),undefined);
 assert.deepEqual(choice.preview(original,choice.choose(original,0,5)),original);
 assert.deepEqual(original,[5,4,6,0,10]);
});
test('neutral and either end can be selected only from an adjacent original value',()=>{
 const original=[4,6,1,9,5];
 for(const [row,dot]of [[0,5],[1,5],[2,0],[3,10]])assert.equal(choice.preview(original,choice.choose(original,row,dot))[row],dot);
 assert.equal(choice.choose(original,0,-1),undefined);assert.equal(choice.choose(original,3,11),undefined);
 const change={row:0,direction:-1};assert.deepEqual(choice.preview([0,3,4,5,6],change),[0,3,4,5,6]);
});
