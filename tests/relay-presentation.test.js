const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Relay typography is scoped to its own renderer and existing font',()=>{
 const css=fs.readFileSync('utility-console.css','utf8'),source=fs.readFileSync('relay-console.js','utf8');
 assert.match(css,/body dialog\.relay-pulse-console \.utility-controls :is\(h3,p,\[data-reports\]\)\{font-family:Orbitron,sans-serif;font-size:15px;line-height:1\.5;overflow-wrap:anywhere\}/);
 assert.equal((source.match(/relay-pulse-console/g)||[]).length,1);assert(source.indexOf('relay-pulse-console')<source.indexOf('window.SALockSharingConsole'));
 assert.match(source,/filter\(r=>r\.relay\)\.slice\(0,5\)/);assert.match(source,/a\.offline\?'RECEIVER OFFLINE':a\.item\.impairmentPoints\?'DEGRADED SIGNAL'/);
});
