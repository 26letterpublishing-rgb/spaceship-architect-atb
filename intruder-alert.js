// Embedded views publish their local detection state to one banner owner.
// A quiet child must not hide an alert that another current view reports.
(()=>{
 let owner=document;
 try{while(owner.defaultView.frameElement&&!owner.defaultView.frameElement.hasAttribute('data-explore-perspective'))owner=owner.defaultView.parent.document;}catch{}
 const key='__saIntruderAlert';
 let shared=owner.defaultView[key];
 if(!shared){
  shared={sources:new Map(),banner:null};owner.defaultView[key]=shared;
  shared.refresh=()=>{
   const ships=new Map();
   for(const [source,read] of shared.sources){
    try{if(source.closed||source!==owner.defaultView&&!source.frameElement?.isConnected){shared.sources.delete(source);continue;}
     for(const ship of read()?.intruderShips||[])ships.set(ship.id,ship);
    }catch{shared.sources.delete(source);}
   }
   if(!ships.size){if(shared.banner?.matches(':popover-open'))shared.banner.hidePopover();return;}
   if(!shared.banner?.isConnected){
    const banner=owner.createElement('div');shared.banner=banner;banner.id='sa-intruder-alert';banner.setAttribute('role','alert');banner.setAttribute('popover','manual');banner.textContent='Intruders detected!';
    banner.style.cssText='position:fixed;inset:82px auto auto 50%;transform:translateX(-50%);margin:0;background:#9d172b;color:white;border:2px solid #ff8497;padding:9px 25px;font:bold 20px Arial;pointer-events:none;box-shadow:0 0 18px #e6264666';owner.body.append(banner);
   }
   const title=[...ships.values()].map(s=>s.title).join(', ');if(shared.banner.title!==title)shared.banner.title=title;
   if(!shared.banner.matches(':popover-open'))shared.banner.showPopover();
  };
  shared.timer=owner.defaultView.setInterval(shared.refresh,350);
 }
 const read=()=>{const combat=window.SACombatBridge?.state?.();return combat?.intruderShips?combat:window.SAInteriorIntruderState?.();};
 shared.sources.set(window,read);
 window.addEventListener('pageshow',()=>shared.sources.set(window,read));
 window.addEventListener('pagehide',()=>{shared.sources.delete(window);shared.refresh();});
})();
