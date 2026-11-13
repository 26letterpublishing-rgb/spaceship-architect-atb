const test=require('node:test'),assert=require('node:assert/strict'),display=require('../roll-display');
test('screenshot-equivalent saved report shows only the nonzero skill bonus',()=>{
 const c={score:13.8,lines:['Raw dice: D12=6, D12=4, D12=2','Adjusted dice: 6, 4, 2','Preserved fusions: None','Unfused dice: 6, 4, 2','Independent Garmoc D20s: None','Sorted candidate values: 6, 4, 2','Selected top two: 6 + 4 = 10','Skill source: Computer Skill','Skill bonus: 3.8','Exertion: 0','Equipment subtotal: 0','Intoxication modifier: 0','Flat-modifier subtotal: 0','Unused-dice candidates: 2; applied bonus 0','Final score: 10 + 3.8 + 0 + 0 = 13.8']};
 const before=JSON.stringify(c);assert.equal(display.campaign(c),'Computer Skill +3.8');assert.equal(JSON.stringify(c),before);
});
test('actual exceptional contributions and named penalties remain, zero and manual internals do not',()=>{
 assert.equal(display.campaign({lines:['Skill bonus: 0','Epoc ones penalty: -2','Unused-dice candidates: 4; applied bonus 0.4','Final-score exception: Garmoc +7']}),'Epoc -2 · Other Class +0.4 · Garmoc +7');
 assert.equal(display.campaign({mode:'manual',lines:['Entered total; individual dice and applied modifiers unavailable.']}),'');
 assert.equal(display.campaign(null),'');
});
test('ship history shows named nonzero modifiers and delay speed without dice or hidden defenses',()=>{
 const c={summary:['Sensors 3: D8+D8; Sensor Systems +2.5; retry +0. Dice 4,5; result 12.5.','ATB: SIC Quality +2; Ingenuity +0; 12.5/s. Input 8s.'],gmSummary:'GM: hidden target Defense 90',gmLines:['secret']};
 const before=JSON.stringify(c);assert.equal(display.ship(c),'Sensor Systems +2.5\nSIC Quality +2 · Delay speed 12.5/s');assert.equal(display.ship(c,{gm:true}),display.ship(c));assert.equal(JSON.stringify(c),before);
});
test('independent, unavailable, automatic-hit and zero-only records do not fabricate modifiers',()=>{
 for(const summary of [['Missile D10; dice 1,2; total 3.'],['Locked hit: no attack dice or roll modifiers applied.'],['Named sources unavailable (older order); recorded bonus unknown; threshold unknown.'],['Skill +0; Exertion +0']])assert.equal(display.ship({summary}),'');
});
test('older inbox reports are compacted without modifying saved notes or unrelated messages',()=>{
 const note={kind:'prompt-result',message:'Owner - Intellect: 13.8 - Success. Dice: 6,4,2.\nCharacter-client calculation report (not independently verified):\nRaw dice: 6,4,2\nSkill bonus: 3.8\nExertion: 0\nFinal score: internal'};
 const before=JSON.stringify(note);assert.equal(display.message(note),'Owner - Intellect: 13.8 - Success\nSkill +3.8');assert.equal(JSON.stringify(note),before);
 assert.equal(display.message({...note,kind:'personal'}),note.message);
});
test('irrelevant zero race annotations are omitted while useful modifiers and timing remain',()=>{assert.equal(display.campaign({lines:['Garmoc +0D0','Epoc ones penalty: 0','Skill source: Awareness','Skill bonus: 2']}),'Awareness +2');assert.equal(display.ship({summary:['Garmoc +0D0; Unused Race +0D0; Piloting +2; ATB speed 12/s.']}),'Piloting +2 \u00b7 Delay speed 12/s');assert.equal(display.ship({summary:['Garmoc +0D0; Piloting +2.','ATB: speed 12/s.'],gmSummary:'Secret Defense 99'}),'Piloting +2\nDelay speed 12/s');});

test('GM detail dice show only recorded rolls and never invent manual dice',()=>{const r={calculation:{lines:['Raw dice: D12=6, D12=4, D12=2','Adjusted dice: 99','Secret: 123']},diceResults:[88]};const before=JSON.stringify(r);assert.deepEqual(display.campaignDice(r),{types:'DICE: D12  |  D12  |  D12',values:'VALUES: 6  |  4  |  2'});assert.equal(JSON.stringify(r),before);assert.equal(display.campaignDice({mode:'manual',diceResults:[]}),null);assert.equal(display.campaignDice({calculation:{lines:['Raw dice: <img>']}}),null);assert.deepEqual(display.campaignDice({diceResults:[2,3]}),{types:'DICE: Types unavailable',values:'VALUES: 2  |  3'});});
