(function(root){
  function parse(file){
    if(file?.format!=='sa2story'||file.version!==1||!Array.isArray(file.chapters)||!file.chapters.length||file.chapters.length>100)throw Error('Choose a valid Story Console file (.sa2story).');
    const chapters=file.chapters.map((c,i)=>({id:String(c.id||'chapter-'+i).slice(0,100),name:String(c.name||'Chapter '+(i+1)).slice(0,120),script:String(c.script||'').slice(0,200000)}));
    if(new Set(chapters.map(c=>c.id)).size!==chapters.length)throw Error('Chapter IDs must be unique.');
    return {chapters,actions:Array.isArray(file.actions)?file.actions.slice(0,250):[],shops:Array.isArray(file.shops)?file.shops.slice(0,100):[]};
  }
  function create(c){return {format:'sa2story',version:1,chapters:c.scriptChapters,actions:c.conditionalActions||[],shops:(c.shops?.list||[]).map(s=>({...s,active:false}))};}
  function append(c,file,id){
    const imported=parse(file),keywords=new Set((c.conditionalActions||[]).map(a=>a.keyword.toLowerCase()));
    const renamed=new Map(),shopRefs=new Map(),existingShops=new Set((c.shops?.list||[]).map(s=>s.id));
    imported.actions=imported.actions.map(a=>{let base=String(a.keyword||'Command').trim().slice(0,56),keyword=base,n=2;while(keywords.has(keyword.toLowerCase()))keyword=base+' '+n++;keywords.add(keyword.toLowerCase());renamed.set(String(a.keyword).trim().toLowerCase(),keyword);return {...a,id:id(),keyword};});
    imported.shops=imported.shops.map(shop=>{if(shop.id==='builtin-everything')return shop;const next=existingShops.has(shop.id)?{...shop,id:id()}:shop;shopRefs.set(String(shop.id).toLowerCase(),next.id);shopRefs.set(String(shop.name).toLowerCase(),next.id);return next;});
    imported.chapters=imported.chapters.map(ch=>({...ch,id:id(),script:ch.script.replace(/::Keyword:([^]*?)::/gi,(all,body)=>{const [key,...rest]=body.split('/');return '::Keyword:'+(renamed.get(key.trim().toLowerCase())||key)+(rest.length?'/'+rest.join('/'):'')+'::';}).replace(/::Shop:([^]*?)::/gi,(all,key)=>'::Shop:'+(shopRefs.get(key.trim().toLowerCase())||key)+'::')}));
    if((c.scriptChapters||[]).length+imported.chapters.length>100)throw Error('A Story Console supports up to 100 tabs.');
    if((c.conditionalActions||[]).length+imported.actions.length>250)throw Error('A campaign supports up to 250 story commands.');
    return {...imported,chapters:[...(c.scriptChapters||[]),...imported.chapters],actions:[...(c.conditionalActions||[]),...imported.actions],chapterId:imported.chapters[0].id};
  }
  const api={parse,create,append};if(typeof module==='object')module.exports=api;if(root)root.SAStoryFiles=api;
})(typeof window==='object'?window:null);
