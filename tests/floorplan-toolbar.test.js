const test=require('node:test'),assert=require('node:assert/strict'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
test('floorplan toolbar stays compact through movement, cancellation, enlarge/return and submission',{timeout:240000},async t=>{
 const r=await promisify(execFile)(process.execPath,[require.resolve('../scripts/playtest-floorplan-toolbar.cjs')],{timeout:230000});
 assert.equal(r.stderr,'');t.diagnostic(r.stdout.trim());
});
