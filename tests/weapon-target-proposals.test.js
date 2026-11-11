const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../console-layout-editor'),store=require('../console-layout-store'),catalog=require('../alma-snapshots/catalog.json');
test('38 weapon targeting proposals preserve exact notes, edited geometry, removals and unrelated notes on round trip',()=>{
 const entries=require('../console-layout-catalog').entries(require('../console-viewer').catalog).filter(e=>e.route==='weapon');assert.equal(entries.length,38);
 const w=store.fresh();for(const e of entries){const base=catalog.baselines[e.id],p=api.fresh(base);p.sections.find(s=>s.id==='header').x+=16;p.sections[1].removed=true;w.layouts[e.id]=p;w.typeNotes[base.consoleId]='New concurrent '+base.consoleId;w.sectionNotes[base.consoleId]={'weapon-controls':'Exact instruction\nKeep my targeting notes.'};}
 w.typeNotes.warp='Unrelated newer note';const round=store.validate(store.exportWorkspace(w,catalog,api),catalog,api);
 for(const e of entries)assert.deepEqual(store.proposal(round,e.id,catalog,api),store.proposal(w,e.id,catalog,api));assert.deepEqual(round.typeNotes,w.typeNotes);assert.deepEqual(round.sectionNotes,w.sectionNotes);
});
