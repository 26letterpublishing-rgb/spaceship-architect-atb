const test=require('node:test');
const {run}=require('../scripts/playtest-repair-drone-typography.cjs');
test('Repair Drone typography preserves geometry, contents, interactions and other consoles',{timeout:120000},async t=>{t.diagnostic(await run());});
