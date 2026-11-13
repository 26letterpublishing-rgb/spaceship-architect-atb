const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const root=path.resolve(__dirname,'..'),{resolvePublicAsset}=require('../public-assets'),catalog=require('../data/combat-music-mixes.json');
test('music preview and all stems are development-only while shared audio remains available',()=>{
 for(const file of ['music-preview.html','music-preview.js','music-preview.css','data/combat-music-mixes.json',...catalog.songs.flatMap(s=>s.stems.map(t=>'debug-music/'+s.id+'/'+t.file))]){
  assert.equal(resolvePublicAsset(root,'/'+encodeURI(file),{debugTools:true}),path.join(root,file));
  for(const alias of [file,file.toUpperCase()])assert.equal(resolvePublicAsset(root,'/'+encodeURI(alias),{debugTools:false}),null);
 }
 assert.ok(resolvePublicAsset(root,'/audio-mix.js',{debugTools:false}));
 for(const file of ['debug-music/../server.js','debug-music/contact/nested/a.mp3','debug-music/unknown/a.mp3'])assert.equal(resolvePublicAsset(root,'/'+file),null);
});
test('preview uses shared controls and does not preload audio or call game endpoints',()=>{
 const html=fs.readFileSync(path.join(root,'music-preview.html'),'utf8'),js=fs.readFileSync(path.join(root,'music-preview.js'),'utf8');
 for(const file of ['audio-mix.js','audio-controls.js','audio-controls.css','combat-music.js','space-map.css'])assert.ok(html.includes(file));
 assert.ok(!html.includes('id="shield"'));assert.ok(!html.includes('id="hull"'));assert.ok(js.includes('mixes:{one:song.mixes.one}'));assert.ok(!/autoplay|preload=|<audio/i.test(html));assert.ok(!/\/api\//.test(js));
 assert.ok(js.indexOf('SACombatMusic.create')>js.indexOf("$('play').onclick"));
 for(const file of ['console-viewer.html','console-layout-editor.html'])assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes('href="music-preview.html"'));
});
