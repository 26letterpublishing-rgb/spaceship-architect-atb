'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../console-layout-editor'),store=require('../console-layout-store'),catalog=require('../alma-snapshots/catalog.json'),legacy=require('../console-layout-snapshots.json'),viewer=require('../console-viewer');
test('all 133 current SIC Console variants have real independent measured snapshots',()=>{
 assert.equal(catalog.entries.length,viewer.catalog.length);assert.equal(catalog.entries.length,133);assert.equal(catalog.consoleTypes.length,58);
 assert.deepEqual(catalog.entries.map(e=>e.id),viewer.catalog.map(e=>e.id));
 for(const e of catalog.entries){const b=require('../'+e.snapshot);assert.equal(b.consoleId,e.consoleType);assert.equal(b.baselineId,catalog.baselines[e.id].baselineId);assert(b.boxes.length>=2);assert.match(b.background,/^data:image\/(png|jpeg);base64,/);api.validate(api.fresh(b),b);for(const s of b.boxes){assert(s.label);assert.match(s.image,/^data:image\/(png|jpeg);base64,/);}assert.equal(e.url.includes('stage=1'),true);}
 assert.equal(catalog.baselines['warp-drive-1'].baselineId,legacy.baselineId);assert.deepEqual(catalog.baselines['warp-drive-1'].boxes.map(({image,...b})=>b),legacy.boxes.map(({image,...b})=>b));
 assert.notDeepEqual(catalog.baselines['bridge-2'].boxes,catalog.baselines.transporter.boxes);
 for(const entry of catalog.entries.filter(e=>e.consoleType==='warp'))assert.deepEqual(catalog.baselines[entry.id].boxes.map(b=>b.id).sort(),legacy.boxes.map(b=>b.id).sort(),'Warp section notes retain stable identity across tiers');
 assert(catalog.baselines['bridge-2'].boxes.some(b=>b.id==='actions'),'Bridge command footer is editable');
});
test('workspace reads legacy Warp exactly without writing or discarding existing data',()=>{
 const old=api.fresh(legacy);old.typeNotes={bridge:'  Shared Bridge notes\n',transporter:'Keep me'};old.sections[0].x+=8;old.sections.find(s=>s.id==='scene').notes='New Warp request';old.sections[2].removed=true;const raw=JSON.stringify(old),data=new Map([[store.legacyKey,raw]]);const storage={getItem:k=>data.get(k)||null,setItem:()=>{throw Error('Must not migrate destructively')}};
 const w=store.load(storage,catalog,api);assert.equal(data.get(store.legacyKey),raw);assert.equal(w.legacySource,raw);assert.deepEqual(store.proposal(w,'warp-drive-1',catalog,api),old);assert.equal(w.typeNotes.bridge,old.typeNotes.bridge);
 assert.throws(()=>store.load({getItem:()=>'{bad'},catalog,api));
});
test('Bridge variants share section/type notes while retaining independent geometry and all other Consoles',()=>{
 let w=store.fresh(),p=store.proposal(w,'bridge-3',catalog,api);p.typeNotes.bridge='All bridges';p.sections.find(s=>s.id==='map').notes='Center this map';p.sections[0].h-=8;w=store.put(w,'bridge-3',p,catalog,api);
 const other=store.proposal(w,'bridge-1',catalog,api);assert.equal(other.typeNotes.bridge,'All bridges');assert.equal(other.sections.find(s=>s.id==='map').notes,'Center this map');assert.notEqual(other.sections[0].h,p.sections[0].h);
 const transport=store.proposal(w,'transporter',catalog,api);transport.typeNotes.transporter='Different request';w=store.put(w,'transporter',transport,catalog,api);assert.equal(store.proposal(w,'bridge-3',catalog,api).sections.find(s=>s.id==='map').notes,'Center this map');assert.equal(w.typeNotes.transporter,'Different request');
 const round=store.validate(JSON.parse(JSON.stringify(store.exportWorkspace(w,catalog,api))),catalog,api);assert.deepEqual(round.layouts,w.layouts);assert.equal(store.notes(round,catalog).consoleTypeNotes.length,2);
});
test('workspace completion merges all Console types without losing newer text or geometry',()=>{
 let w=store.fresh();for(const id of ['warp-drive-1','bridge-3','transporter']){const p=store.proposal(w,id,catalog,api);p.sections[0].notes='Original '+id;p.typeNotes[p.consoleId]='Type '+id;w=store.put(w,id,p,catalog,api);}
 w.typeNotes.transporter='Newer text';const before=JSON.stringify(w),u=(scope,consoleType,originalNote,extra={})=>({scope,consoleType,originalNote,updatedNote:'UPDATED QA',completedAt:'2026-11-04T00:00:00Z',...extra});
 const patch={schema:'sa-alma-completions/v1',updates:[u('section','bridge','Original bridge-3',{sectionId:'header',baselineId:catalog.baselines['bridge-3'].baselineId}),u('type','warp','Type warp-drive-1'),u('type','transporter','Type transporter')]};
 const result=store.merge(w,patch,catalog,api);assert.equal(result.applied.length,2);assert.equal(result.conflicts.length,1);assert.equal(result.state.typeNotes.transporter,'Newer text');assert.equal(result.state.sectionNotes.bridge.header,'UPDATED QA');assert.equal(result.state.layouts['bridge-3'].sections[0].notes,'UPDATED QA');assert.equal(JSON.stringify(w),before);
 for(const id of Object.keys(w.layouts))assert.deepEqual(result.state.layouts[id].sections.map(({notes,...s})=>s),w.layouts[id].sections.map(({notes,...s})=>s));
 const again=store.merge(result.state,patch,catalog,api);assert.equal(again.alreadyApplied.length,2);assert.equal(again.applied.length,0);assert.deepEqual(again.state,result.state);
 assert.throws(()=>store.merge(w,{...patch,updates:[patch.updates[0],patch.updates[0]]},catalog,api));
});
