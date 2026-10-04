(function(){let dismissed='',landing=null,signature='';window.SALandingApproval={update(state,mode,action){
  if(mode!=='gm'||!window.SAInterfaceNotices){landing?.remove();return;}
  const landed=state.starships?.filter(s=>s.ship?.descentState?.awaitingGm)||[];
  const next=landed.map(s=>s.id+':'+s.ship.descentState.receipt).join('|');
  if(!landed.length||state.encounterEndedAt||next===dismissed){if(landing)window.SAInterfaceNotices.host().remove(landing);return;}
  if(!landing){landing=document.createElement('aside');landing.id='landingApproval';landing.className='interface-notice landing-approval';landing.setAttribute('role','status');}
  if(signature!==next||!landing.childElementCount){
    signature=next;landing.replaceChildren();const text=document.createElement('span');text.textContent=landed.map(s=>s.title+' landed on '+s.ship.descentState.planetName).join('; ')+'.';
    const approve=document.createElement('button');approve.type='button';approve.className='notice-action';approve.textContent='Approve ending combat';approve.onclick=e=>{e.preventDefault();e.stopPropagation();if(confirm('End this encounter after landing?'))void action({action:'exitEncounter'},'danger');};
    landing.append(text,approve,window.SAInterfaceNotices.closeButton(landing,()=>dismissed=signature,'Dismiss landing alert'));
  }
  landing.hidden=false;window.SAInterfaceNotices.host().mount(landing,'landing-approval');window.SAInterfaceNotices.host().schedule();
}};window.addEventListener('pagehide',()=>{landing?.remove();window.SAInterfaceNotices?.host().refresh();});}());
