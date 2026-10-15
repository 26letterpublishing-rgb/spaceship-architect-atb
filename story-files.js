(function(root){
  function parse(file){
    if(file?.format!=='sa2story'||file.version!==1||!Array.isArray(file.chapters)||!file.chapters.length||file.chapters.length>100)throw Error('Choose a valid Story Console file (.sa2story).');
    const chapters=file.chapters.map((c,i)=>({id:String(c.id||'chapter-'+i).slice(0,100),name:String(c.name||'Chapter '+(i+1)).slice(0,120),script:String(c.script||'').slice(0,200000)}));
    if(new Set(chapters.map(c=>c.id)).size!==chapters.length)throw Error('Chapter IDs must be unique.');
    return {chapters,actions:Array.isArray(file.actions)?file.actions.slice(0,250):[],shops:Array.isArray(file.shops)?file.shops.slice(0,100):[]};
  }
  function create(c){return {format:'sa2story',version:1,chapters:c.scriptChapters,actions:c.conditionalActions||[],shops:(c.shops?.list||[]).map(s=>({...s,active:false}))};}
  const api={parse,create};if(typeof module==='object')module.exports=api;if(root)root.SAStoryFiles=api;
})(typeof window==='object'?window:null);
