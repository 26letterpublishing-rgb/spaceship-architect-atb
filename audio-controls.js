(() => {
 'use strict';
 if(window.SAAudioControls)return;
 const mix=window.SAAudioMix;if(!mix)return;
 const controls='button,a[href],[role=button],[role=tab],[role=radio],input[type=button],input[type=submit],input[type=checkbox],input[type=radio],summary';
 function role(node){
  const visible=(node.textContent||'').trim(),label=(node.getAttribute('aria-label')||visible||node.value||node.title||'').trim();
  if(node.matches('input[type=checkbox],[role=checkbox],[data-help-page],[data-sg-prev],[data-sg-next]'))return 'none';
  // Closing X controls and the Quick Check opener are always silent.
  if(node.matches('.dialog-circle-close,.quick-prompt-toggle')||/^[\u00d7\u2715\u2716\u2717\u274cx]\uFE0F?$/i.test(visible)||(!visible&&/^close\b/i.test(label))||/^quick check$/i.test(label))return 'none';
  // Classify what the control looks like, before its HTML tag or action label.
  const tabs='[role=tab],[aria-selected],[data-tab],[data-gm-tab],[data-character-tab],[data-starship-tab],[data-sheet-section-tab],[data-drawer-tab]';
  if(node.matches(tabs)||node.closest('[role=tablist],nav[class*="tabs"],[class$="-tabs"],[class*="-tabs "],.shop-departments,#showcasePerspectives,#sa-app-help nav,.sg-nav,.campaign-location-nav'))return 'none';
  if(node.matches('[data-sic-card],[data-sic-preview],[data-card],.shop-card-preview,.sic-poker-card,[data-hex],[data-square],[data-map-cell],[data-map-square],[data-map-mesh],[data-arena-cell]')||node.closest('svg,canvas,.combat-map-grid,.ship-map-grid,.combat-mesh,[data-inline-square]'))return 'none';
  // Map camera adjustments stay silent, including dynamically opened GM/PC maps.
  const cameraLabel=(node.getAttribute('aria-label')||node.textContent||node.title||'').trim();
  if(node.matches('[data-zoom],[data-auto-zoom],[data-fit],[data-map-zoom],[data-map-fit],[data-prep-zoom],[data-prep-fit],[data-arena-zoom],[data-arena-fit],[data-preview-zoom],[data-interior-fit],[data-grid-zoom],[data-large-zoom],[data-combat-interior-zoom],.airlock-door-map [data-minus],.airlock-door-map [data-plus]')||/^(?:Zoom (?:in|out)(?: (?:Galaxy Map|surface map))?|Fit (?:Map|Ship|Contacts|Link Range))$/i.test(cameraLabel))return 'none';
  // These reviewed actions own an alarm, dice sound, purchase chime or combat effect.
  // Suppress activation feedback even if that effect is muted or the action later fails.
  if(node.matches('#gmPanicPause,#undoLastTiming,#completeTurn,#firstAidResolutionSubmit,#gmDamageForm button[type=submit],#gmNpcDamageForm button[type=submit],#gmNpcAttackForm button[type=submit],[data-gm-roll-form] button,#rollSkillCheck,#rollCombatDamage,#rerollSkillCheck,#freeRuleReroll,[data-attribute],[data-skill-action="increase"],[data-practice-row],[data-claim-reward],#playDramaCard[data-confirming="true"],[data-action="remove"],[data-action="removeQueuedEffect"]'))return 'none';
  if(node.matches('[data-apply-packages]')||/^show save character$/i.test(visible))return 'chunk';
  if(/^begin finalization$/i.test(visible))return 'robot';
  if(node.matches('.pc-sheet-handle'))return 'chunk'; // Preserve the drawer's existing open/close feedback.
  if(node.matches('#pauseSession'))return node.classList.contains('paused')?'play-tone':'pause-tone';
  if(node.matches('summary'))return node.parentElement?.open?'none':'whoosh';
  if(node.matches('.sic-category legend button,[data-ui-disclosure]'))return node.getAttribute('aria-expanded')==='true'?'none':'whoosh';
  const override=node.closest('[data-ui-sound]')?.dataset.uiSound;
  if(override==='none'||override==='manual')return override;
  if(node.matches('[data-mute],#pcHeaderSound,#gmSoundToggle,#gmMuteSound,#enableAlerts,#playerSoundToggle'))return 'none';
  // User-selected exceptions; Save/Load wins when a control also navigates.
  if(node.matches('#beginSession,#endSession,#gmAddUnit,#gmAddCampaignPc,.crew-log-header>button')||/\b(save|load)\b/i.test(visible+' '+label)||/^(?:begin session|end session|add npc|add pc|log entry)\b/i.test(label))return 'robot';
  if(node.matches('#gmMailButton,#pcHeaderMail,#appHelp,#gmSettingsHelp,.ship-action-help-button,[data-action-help]')||/\bhelp\b/i.test(label)||/\b(enlarge map|return to campaign)\b/i.test(visible+' '+label))return 'whoosh';
  if(override)return override;
  return 'chunk';
 }
 let lastClick=0,keyboardNode=null;
 function activate(event){
  if(event.isTrusted===false)return;
  const node=event.target?.closest?.(controls);if(!node||node.matches(':disabled,[aria-disabled=true]')||node.closest('[inert]'))return;
  if(event.type==='keydown'&&(event.repeat||!['Enter',' '].includes(event.key)||node.matches('button,a,input,summary')))return;
  if(event.type==='keydown')keyboardNode=node;
  if(event.type==='click'&&event.detail===0&&keyboardNode===node){keyboardNode=null;lastClick=Date.now();return;}
  if(event.type==='click')keyboardNode=null;
  if(event.type==='click')lastClick=Date.now();
  const sound=role(node);if(['chunk','robot','whoosh','pause-tone','play-tone'].includes(sound))mix.buttonSound(sound);
 }
 document.addEventListener('click',activate,true);
 document.addEventListener('keydown',activate,true);
 // Forms without a submit button can still be deliberately submitted with Enter.
 document.addEventListener('submit',event=>{if(event.isTrusted===false||Date.now()-lastClick<100||event.target.closest('[data-ui-sound=manual]')||(event.submitter&&['none','manual'].includes(role(event.submitter))))return;mix.buttonSound(event.submitter?role(event.submitter):'chunk');},true);
 // Range change fires on release/committed keyboard adjustment, never on drag input.
 document.addEventListener('change',event=>{
  const input=event.target,key=input?.dataset?.volume;
  if(event.isTrusted===false||!input?.matches?.('.audio-volume-controls input[type=range]')||!['master','game','interface'].includes(key))return;
  mix.setPreferences({[key]:Number(input.value)});mix.previewVolume(key);
 });
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.8 8.5H3.5v7h3.3L11 19V5Z"/><path class="sound-wave" d="M15 8.2a5.2 5.2 0 0 1 0 7.6M18 5.4a9.2 9.2 0 0 1 0 13.2"/><path class="mute-slash" d="m4 4 16 16"/></svg>';
 function sliders(host){
  const group=document.createElement('div');group.className='audio-volume-controls';group.setAttribute('data-ui-sound','none');
  group.innerHTML=[['master','Master Volume'],['game','Game Sounds'],['interface','Interface Sounds']].map(([key,label])=>`<label><span>${label}</span><input type="range" min="0" max="100" step="1" data-volume="${key}" aria-label="${label}"><output data-volume-value="${key}"></output></label>`).join('')+'<p>Saved on this browser. Mute keeps your volume balance.</p>';
  group.addEventListener('input',event=>{if(!event.target.dataset.volume)return;mix.setPreferences({[event.target.dataset.volume]:Number(event.target.value)});});host.append(group);
 }
 function render(){const p=mix.preferences();for(const input of document.querySelectorAll('[data-volume]')){input.value=p[input.dataset.volume];input.style.setProperty('--volume-fill',p[input.dataset.volume]+'%');input.setAttribute('aria-valuetext',p[input.dataset.volume]+'%');}
  for(const value of document.querySelectorAll('[data-volume-value]'))value.textContent=p[value.dataset.volumeValue]+'%';
  const mute=document.getElementById('homeMuteSound');if(mute){mute.classList.toggle('muted',mix.isMuted());mute.setAttribute('aria-pressed',String(mix.isMuted()));mute.title=mix.isMuted()?'Unmute sounds':'Mute sounds';mute.setAttribute('aria-label',mute.title);}
 }
 function setup(){
  const gm=document.querySelector('#settingsTab .settings-grid')||document.querySelector('.gm-shell .settings-grid')||document.querySelector('body:has(#gmSettingsToggle) .settings-grid');
  if(gm&&!gm.querySelector('.audio-settings-card')){const card=document.createElement('section');card.className='settings-card audio-settings-card';card.innerHTML='<h3>Sound</h3>';sliders(card);gm.insertBefore(card,gm.children[1]||null);}
  const pc=document.querySelector('.sound-settings-card');if(pc&&!pc.querySelector('.audio-volume-controls')){pc.querySelector('h2').textContent='Sound';pc.querySelector('p')?.remove();sliders(pc);}
  const welcome=document.getElementById('welcomePanel');if(welcome&&!document.getElementById('homeMuteSound')){const mute=document.createElement('button');mute.id='homeMuteSound';mute.className='sound-toggle home-mute';mute.type='button';mute.dataset.uiSound='none';mute.innerHTML=icon;mute.onclick=()=>mix.setMuted(!mix.isMuted());welcome.append(mute);}
  for(const node of document.querySelectorAll('#pcHeaderSound,#gmSoundToggle,#gmMuteSound,#enableAlerts,#playerSoundToggle,[data-mute]'))node.dataset.uiSound='none';
  render();
 }
 window.addEventListener('sa-audio-change',render);
 window.SAAudioControls={role,activate,render};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
