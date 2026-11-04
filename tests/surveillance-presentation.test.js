const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../surveillance-console.js'),'utf8'),context={};
vm.runInNewContext(source.slice(source.indexOf(' const esc='),source.indexOf(' function open(')),context);
test('occupied-room presentation escapes identity and renders only rooms in the authorized response',()=>{
 const info={columns:20,rooms:[{name:'Bridge <script>',cells:[42,43]},{name:'Empty room',cells:[62]}],crew:[{name:'Crew <img onerror=alert(1)>',square:42,mesh:4}],doors:{'42:43':'closed'}};
 const html=context.monitors(info);assert.match(html,/Bridge &lt;script&gt;/);assert.match(html,/Crew &lt;img onerror=alert\(1\)&gt;/);assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img onerror'),false);assert.equal(html.includes('Empty room'),false);assert.match(html,/door-closed/);
 info.crew=[];assert.equal(context.monitors(info),'<p class="surveillance-empty">No occupied rooms.</p>');
});
test('camera presentation consumes sanitized authoritative camera data without unrelated crew or private sheets',()=>{
 const maps=require('../ship-map-core'),camera=require('../ship-surveillance');
 const ship={id:'home',title:'Home',controlType:'pc',crewCharacterIds:['pc'],ship:{gridCells:maps.rectangleCells({},42,5,5),placements:[{sicId:'cam',cell:42},{sicId:'en',cell:86}],sicInventory:[{id:'cam',type:'surv-camera'},{id:'en',type:'en-engine-1'}],doorStates:{}}};
 const unit={id:'pilot',characterId:'pc',characterName:'Visible operator',team:'pc',currentHp:20,privateNote:'PRIVATE SHEET',location:{starshipId:'home',square:42,mesh:7,stationed:true,sicId:'cam'}};
 const room={starships:[ship],units:[unit,{id:'secret',characterName:'UNSEEN CREW',location:{starshipId:'away',square:42}}]};
 const info=camera.inspect(room,unit,'cam'),html=context.monitors(info);assert.match(html,/Visible operator/);assert.equal(html.includes('UNSEEN CREW'),false);assert.equal(html.includes('PRIVATE SHEET'),false);assert.equal(JSON.stringify(info).includes('PRIVATE SHEET'),false);
 ship.ship.sicInventory[0].disabled=true;assert.throws(()=>camera.inspect(room,unit,'cam'));
});
