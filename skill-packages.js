// Creation-only auto-spender. Skill names are the existing persistent skill IDs.
(function(root){
  const definitions = [
    ['Survivalist',['Survival/Tracking','Resist Distress','Awareness'],['Anatomy/First Aid','Athletics/Endurance','Identify Taste/Smell','Tame Animal'],['Caretaking/Nurture','Cooking','Climb','Swim','Self-Control']],
    ['Computer Nerd',['Computer Systems','Hacking','Technology'],['Research','Mathematics'],['Common Knowledge','Writing','Science/Physics']],
    ['Social Butterfly',['Negotiation/Persuade','Intuition/Empathy','Acting/Lie'],['Psychology','Fashion/Etiquette','Showmanship'],['Art/Music','Intimidate/Taunt','Caretaking/Nurture','Common Knowledge','Cooking']],
    ['Navigator',['Navigate','Pilot/Helm','Awareness'],['Astronomy','Drive/Small Vehicle','Mathematics'],['Survival/Tracking','Science/Physics','Initiative']],
    ['Athlete',['Athletics/Endurance','Climb','Lift/Push/Pull'],['Jump','Swim','Catch/Throw','Break Free/Escape'],['Dodge/Block','Wrestle/Disarm','Resist Distress','Self-Control']],
    ['Street Smart',['Stealth/Hide','Awareness','Common Knowledge'],['Lock-picking','Pickpocket','Acting/Lie','Intuition/Empathy'],['Disguise/Mimic','Gambling','Negotiation/Persuade','Intimidate/Taunt']],
    ['Combatant',['Projectile','Melee','Dodge/Block'],['Initiative','Wrestle/Disarm','Resist Distress'],['Demolitions','Weapon Mechanics','Awareness','Catch/Throw','Self-Control']],
    ['Leader',['Leadership','Negotiation/Persuade','Law/Politics'],['Intimidate/Taunt','Fashion/Etiquette','Common Knowledge'],['History/Lore','Psychology','Writing','Self-Control']],
    ['Mechanic',['Engineering','Vehicle Mechanics','Weapon Mechanics'],['Technology','Architecture','Drive/Small Vehicle'],['Mathematics','Science/Physics','Computer Systems']],
    ['Scientist',['Science/Physics','Research','Mathematics'],['Anatomy/First Aid','Technology','Identify Taste/Smell'],['Astronomy','Computer Systems','Writing']],
    ['Scholar',['History/Lore','Research','Forgotten Languages'],['Religion','Writing','Architecture'],['Law/Politics','Art/Music','Common Knowledge']],
    ['Starship Specialist',['Computer Systems','Engineering','Hacking','Pilot/Helm','Sensor Systems','Weapon Systems'],[],[]],
  ].map(([name,core,related,peripheral])=>({id:name.toLowerCase().replaceAll(' ','-'),name,tiers:[core,related,peripheral]}));
  const cost = level => level * (level + 1) / 2;
  function purchase(level, points, maximum){
    const price = level + 1;
    return Number.isInteger(level) && level >= 0 && level < maximum && points >= price
      ? {level:level+1,cost:price,remaining:points-price} : null;
  }
  function allocate(ids, budget, maximum){
    if(ids.length!==2 || ids.some(id=>!definitions.some(p=>p.id===id))) throw new Error('Choose two skill packages.');
    if(!Number.isInteger(budget)||budget<0||!Number.isInteger(maximum)||maximum<1) throw new Error('Invalid creation budget or limit.');
    const levels={},purchases=[],allocations=[];
    ids.forEach((id,slot)=>{
      const pkg=definitions.find(p=>p.id===id),base={...levels};
      const allotted=slot===0?Math.ceil(budget/2):Math.floor(budget/2);
      let remaining=allotted;
      const buy = name => {
        const result=purchase(levels[name]||0,remaining,maximum);
        if(!result)return false;
        levels[name]=result.level;remaining=result.remaining;purchases.push({name,cost:result.cost,slot});return true;
      };
      const balanced=names=>[...names].sort((a,b)=>(levels[a]||0)-(levels[b]||0)||a.localeCompare(b));
      // Each package adds its own passes to the cumulative ratings, including overlap.
      for(const [tier,steps] of [[0,1],[1,1],[0,2],[2,1],[0,3],[1,2]]){
        let available;
        while((available=balanced(pkg.tiers[tier]).find(name=>(levels[name]||0)<Math.min(maximum,(base[name]||0)+steps)&&purchase(levels[name]||0,remaining,maximum))))buy(available);
      }
      while(remaining>0){
        const next=pkg.tiers.flatMap(balanced).find(name=>purchase(levels[name]||0,remaining,maximum));
        if(!next)break;buy(next);
      }
      allocations.push({id,allotted,spent:allotted-remaining,remaining});
    });
    // Pool leftovers before trying the selected packages again, then important skills.
    let remaining=allocations.reduce((sum,p)=>sum+p.remaining,0);
    const selected=[...new Set(ids.flatMap(id=>definitions.find(p=>p.id===id).tiers.flat()))];
    const fallback=[...new Set(['Dodge/Block','Awareness','Initiative','Anatomy/First Aid','Athletics/Endurance','Self-Control','Resist Distress',...definitions.flatMap(p=>p.tiers.flat())])];
    while(remaining){
      const name=[...selected,...fallback].find(n=>purchase(levels[n]||0,remaining,maximum));
      if(!name)break;
      const result=purchase(levels[name]||0,remaining,maximum);
      levels[name]=result.level;remaining=result.remaining;purchases.push({name,cost:result.cost,slot:2});
    }
    return {levels,purchases,allocations,budget,spent:purchases.reduce((sum,p)=>sum+p.cost,0),remaining};
  }
  const api={definitions,cost,purchase,allocate};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SASkillPackages=api;
})(globalThis);
