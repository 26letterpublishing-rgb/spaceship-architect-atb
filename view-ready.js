(function(){
  const params=new URLSearchParams(location.search);
  const pending=Boolean(params.get('campaign')||params.has('shipRoll')||params.has('embeddedRecord'));
  if(pending)document.documentElement.classList.add('view-starting');
  let ready=false;
  window.SAViewReady=()=>{
    if(ready)return;
    ready=true;document.documentElement.classList.remove('view-starting');
    document.documentElement.dataset.viewReady='true';
    if(parent!==window)parent.postMessage({type:'sa-view-ready'},location.origin);
  };
}());
