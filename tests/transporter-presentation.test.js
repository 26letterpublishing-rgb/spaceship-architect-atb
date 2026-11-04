const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Transporter stylesheet is deliverable through the real public asset policy',()=>{
 const root=path.resolve(__dirname,'..'),resolver=require('../public-assets');
 for(const debugTools of [true,false])assert.equal(resolver.resolvePublicAsset(root,'/transporter-console.css',{debugTools}),path.join(root,'transporter-console.css'));
 assert.ok(fs.statSync(path.join(root,'transporter-console.css')).size>0);
});
test('every layout selector is scoped to Transporter without changing global Leave or Hold policy',()=>{
 const css=fs.readFileSync(require.resolve('../transporter-console.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 const selectors=[...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@'));
 assert.ok(selectors.length>0);for(const group of selectors)for(const selector of group.split(','))assert.match(selector.trim(),/^dialog\.transporter-console(?:\s|>|$)/);
 assert.equal(css.includes('[data-leave]'),false);assert.equal(css.includes('[data-hold]'),false);
});
