'use strict';
// Only deterministic effects live here. Narrative rulings and dice stay at the table.
function apply(campaign, record, cardId, choice, {deck, draw}) {
  const hand=deck.hands[record.id], resources=record.character.resources;
  const drawFor=(person,count)=>{
    const target=deck.hands[person.id] ||= [];let drawn=0;
    while(drawn<count){const card=draw(deck);if(!card)break;target.push(card);drawn++;}
    person.character.resources.dramaCards=target.length;return drawn;
  };
  if(['drama-006','drama-061'].includes(cardId)){
    const resource=cardId==='drama-006'?'experience':'credits';
    const note=campaign.privateNotes.find(n=>n.id===choice.awardNoteId&&n.characterId===record.id&&n.kind==='award'&&n.rewardStatus==='pending'&&n.rewardResource===resource);
    const award=note&&campaign.awardHistory.find(a=>a.id===note.awardId&&a.claimRequired&&a.targetIds.includes(record.id)&&!a.claimedCharacterIds.includes(record.id)&&a.amount>0);
    if(!award)throw Error('Choose an unclaimed '+resource+' award. Claim it after playing this card.');
    award.dramaMultipliers ||= {};
    if(award.dramaMultipliers[record.id])throw Error('That award has already been doubled.');
    award.dramaMultipliers[record.id]=2;note.rewardAmount=award.amount*2;
    note.message='Drama Card: receive '+note.rewardAmount.toLocaleString()+' '+resource+' (doubled award).';
    return 'Your selected '+resource+' award is doubled. Receive it in your Inbox.';
  }
  if(cardId==='drama-032'){
    if(choice.mode==='reverence'){const before=Number(resources.reverence)||0;resources.reverence=Math.min(10,before+3);return 'Gained '+(resources.reverence-before)+' Reverence (maximum 10).';}
    if(choice.mode!=='approved-check'||choice.resolved!==true)throw Error('Choose +3 Reverence, or confirm the GM-approved alternate check has been completed.');
    return 'Drew '+drawFor(record,2)+' Drama Cards for the completed GM-approved check.';
  }
  if(cardId==='drama-043'){
    const skill=record.character.skills?.[choice.skill];
    if(!skill||!Number.isFinite(skill.tenths)||skill.tenths<0||skill.tenths>9||choice.resolved!==true)throw Error('Choose a skill rated 0.9 or lower and confirm its check has resolved.');
    skill.tenths+=20;return choice.skill+' permanently increased by +2.0.';
  }
  if(cardId==='drama-047'){
    let total=0;for(const person of campaign.characters)total+=drawFor(person,1);
    return total+' Drama Cards dealt to campaign PCs, including offline PCs.';
  }
  if(['drama-070','drama-071'].includes(cardId)){
    if(choice.resolved!==true)throw Error('Confirm that the GM has established the narrative effect before discarding your hand.');
    deck.discardPile.push(...hand.splice(0));resources.dramaCards=0;
    if(cardId==='drama-071'){deck.removed ||= [];deck.removed.push(cardId);return 'Hand discarded. Massive Plot Twist is permanently removed from this campaign’s deck.';}
    return 'Hand discarded after the GM-established rewind. Campaign state was not automatically rolled back.';
  }
  return '';
}
module.exports={apply};
