const test=require('node:test'),assert=require('node:assert/strict'),{CampaignApi}=require('../campaign-api');
function fixture(){const records=new Map(),store={get:async c=>structuredClone(records.get(c)||null),create:async c=>(records.set(c.code,structuredClone(c)),true),save:async c=>records.set(c.code,structuredClone(c)),findByName:async()=>[]},api=new CampaignApi({store,storageMode:'test'});return {api,async call(path,body={},status=200){let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,s,data)=>{assert.equal(s,status,JSON.stringify(data));result=data;});return result;}};}
test('Drama effects validate ownership, preserve failed choices, sync offline PCs and persist deck removal',async()=>{
 const f=fixture(),room=await f.call('showcase/start'),c=await f.api.campaign(room.code),p=room.players[0],other=room.players[1],pc={code:room.code,token:p.token,characterId:p.id},gm={code:room.code,token:room.gmToken};
 const give=id=>{for(const hand of Object.values(c.dramaDeck.hands))hand.splice(0,hand.length,...hand.filter(x=>x!==id));c.dramaDeck.drawPile=c.dramaDeck.drawPile.filter(x=>x!==id);c.dramaDeck.discardPile=c.dramaDeck.discardPile.filter(x=>x!==id);c.dramaDeck.hands[p.id].push(id);for(const r of c.characters)r.character.resources.dramaCards=c.dramaDeck.hands[r.id].length;};
 const play=(id,choice={},status=200)=>f.call('drama/play',{...pc,cardId:id,choice},status);
 give('drama-047');const before=c.dramaDeck.hands[other.id].length;await play('drama-047');assert.equal(c.dramaDeck.hands[other.id].length,before+1);await play('drama-047',{},404);
 give('drama-032');const r=c.characters.find(x=>x.id===p.id);r.character.resources.reverence=9;await play('drama-032',{mode:'reverence'});assert.equal(r.character.resources.reverence,10);
 give('drama-043');r.character.skills.Arts={tenths:9};await play('drama-043',{skill:'Arts'},409);assert.ok(c.dramaDeck.hands[p.id].includes('drama-043'));await play('drama-043',{skill:'Arts',resolved:true});assert.equal(r.character.skills.Arts.tenths,29);
 give('drama-061');await f.call('award',{...gm,resource:'credits',amount:75,targetIds:[p.id,other.id]});const note=c.privateNotes.find(n=>n.characterId===p.id&&n.rewardStatus==='pending'&&n.rewardResource==='credits');const credits=r.character.resources.creditsBase;
 await play('drama-061',{awardNoteId:note.id});assert.equal(note.rewardAmount,150);await f.call('award/claim',{...pc,noteId:note.id});assert.equal(r.character.resources.creditsBase,credits+150);await f.call('award/claim',{...pc,noteId:note.id});assert.equal(r.character.resources.creditsBase,credits+150);
 const otherNote=c.privateNotes.find(n=>n.characterId===other.id&&n.rewardResource==='credits');assert.equal(otherNote.rewardAmount,75);
 give('drama-006');await f.call('award',{...gm,resource:'experience',amount:25,targetIds:[p.id]});const xpNote=c.privateNotes.find(n=>n.characterId===p.id&&n.rewardResource==='experience'&&n.rewardStatus==='pending');await play('drama-006',{awardNoteId:xpNote.id});assert.equal(xpNote.rewardAmount,50);
 give('drama-032');const handBefore=c.dramaDeck.hands[p.id].length;await play('drama-032',{mode:'approved-check'},409);await play('drama-032',{mode:'approved-check',resolved:true});assert.equal(c.dramaDeck.hands[p.id].length,handBefore+1);
 give('drama-070');await play('drama-070',{resolved:true});assert.equal(c.dramaDeck.hands[p.id].length,0);assert.ok(c.dramaDeck.discardPile.includes('drama-070'));assert.ok(!c.dramaDeck.removed.includes('drama-070'));
 give('drama-071');give('drama-002');await play('drama-071',{},409);await play('drama-071',{resolved:true});assert.equal(c.dramaDeck.hands[p.id].length,0);assert.deepEqual(c.dramaDeck.removed,['drama-071']);
 f.api.state(c,room.gmToken);assert.ok(!c.dramaDeck.drawPile.includes('drama-071'));assert.ok(!c.dramaDeck.discardPile.includes('drama-071'));
 await f.call('drama/reshuffle',gm);assert.ok(!c.dramaDeck.drawPile.includes('drama-071'));
});
test('Silent Scope consumes exactly one selected mineral per loaded round',()=>{
 const ammo=require('../personal-ammunition'),w={weaponId:'silent-scope-sniper-rifle',ammoRemaining:3},minerals={Iron:2,Magnesium:10};
 assert.equal(ammo.reload({},w,{minerals,mineral:'Iron'}),2);assert.equal(w.ammoRemaining,5);assert.equal(minerals.Iron,0);assert.equal(minerals.Magnesium,10);
 assert.equal(ammo.reload({},w,{minerals,mineral:'Magnesium'}),3);assert.equal(w.ammoRemaining,8);assert.equal(minerals.Magnesium,7);assert.throws(()=>ammo.reload({},w,{minerals}));
});
