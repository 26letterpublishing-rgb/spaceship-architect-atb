(function() {
  const descriptions = {
    team:['Team Execution','Prepare a shared roll for a stationed teammate. For 12 combat seconds after input completes, the selected action combines participants\' dice before fusion, uses the highest associated skill, and adds +1 per participant. Your own later roll cannot consume your preparation.'],
    calculation:['Preemptive Calculation','Prepare +2 for the next selected action roll by anyone aboard your ship. Bonuses stack. Expires after your Mathematics skill (rounded down) times 12 combat seconds, measured after input completes. Requires Mathematics 1 or higher.'],
    hail:['Hail Ship','Call a detected ship. Its crew may accept or decline between turns. The call stays open until either side ends it. Choose a disclosed location within 5 Units of your ship; a hidden caller does not reveal its true coordinates.'],
    evade:['Evasive Maneuvers','Roll Evade dice + Pilot/Helm + Hull Size Modifier. Use the higher of this result and Masking as Defense against every attack for 20 combat seconds. Attacks do not consume the effect. Overlapping maneuvers use the highest active Defense; each expires independently.'],
    ram:['Ram','Requires both ships in the same hex. Roll Evade dice + Pilot/Helm against enemy Defense. A hit deals simultaneous collision damage to both ships, including hull overflow. This can destroy your own ship.'],
    skim:['Skim','Requires both ships in the same hex. Roll Evade dice + Pilot/Helm against enemy Defense. Each shield takes the other ship\'s current shield HP in damage; bursting shields cause additional damage.'],
    area:['Scan Area','Roll Sensor dice + Sensor Systems. Each Unit inside sensor range adds +1 against the target\'s Masking. Successful scans identify contacts without revealing exact HP.'],
    hex:['Scan Hex','Focus on one hex within sensor range. Targets there have Masking -10; each hex away adds 2 to their difficulty. Uses Sensor dice + Sensor Systems.'],
    analysis:['Systems Analysis','Roll Sensor dice + Sensor Systems against a detected ship\'s Defense. Success produces a snapshot of exact Hull, Shields and active SICs after another 12 combat seconds. Failure gives +1 to the next attempt.'],
    share:['Share Data','Transmit available sensor intelligence to selected ships within sensor range. Shares contact and analysis information, never Lock-On.'],
    life:['Life Scan','Select a hex within sensor range. Counts non-Android characters aboard all other ships in that hex, excluding your own ship. No GM entry is needed.'],
    lifeArea:['Life Scan','Select a hex within sensor range. Counts non-Android characters aboard other ships in that hex; excludes your own ship.']
  };
  let active = null;
  function open(key, owner = document) {
    const copy = descriptions[key];
    if (!copy) return;
    if (active) {active.close();active.remove();}
    const dialog = owner.createElement('dialog'); active = dialog;
    dialog.className = 'ship-action-help';
    dialog.style.cssText = 'max-width:440px;width:calc(100vw - 48px);padding:22px;background:#08191f;color:#e9f7fb;border:1px solid #57c8db;border-radius:6px;font:15px/1.5 Arial,sans-serif';
    const heading=owner.createElement('h2');heading.textContent=copy[0];heading.style.cssText='font-size:20px;margin:0 0 12px';
    const text=owner.createElement('p');text.textContent=copy[1];
    const close=owner.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>dialog.close();
    dialog.append(heading,text,close);owner.body.append(dialog);
    dialog.addEventListener('close',()=>{dialog.remove();if(active===dialog)active=null;});dialog.showModal();
  }
  function attach(button,key) {
    const copy=descriptions[key];if(!copy||button.nextElementSibling?.dataset.actionHelp===key)return;
    button.title=copy[1];
    const help=button.ownerDocument.createElement('button');help.type='button';help.dataset.actionHelp=key;
    help.className='ship-action-help-button';help.textContent='?';help.title=copy[1];help.setAttribute('aria-label',`About ${copy[0]}`);
    help.style.cssText='cursor:help;min-width:28px;width:28px;min-height:28px;padding:2px;border:1px solid #5b9dac;border-radius:50%;background:#0b2730;color:#b5f3ff;justify-self:end';
    help.onclick=event=>{event.preventDefault();event.stopPropagation();open(key,help.ownerDocument);};button.after(help);
  }
  window.addEventListener('pagehide',()=>{active?.close();active?.remove();});
  window.SAActionHelp={open,attach,descriptions};
}());
