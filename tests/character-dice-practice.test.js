const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
function load(start,end,globals){const c=vm.createContext(globals);vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),c);return c;}

test('practice dice enforce sequential purchases, 225 EXP, protected free dice and exact refunds',async()=>{
 const {ATTRIBUTE_COSTS,DICE_NAMES}=await import('../character-data.js');
 const c=load('function attributePracticeRemaining(','function attributePurchaseGuideMarkup(',{ATTRIBUTE_COSTS,DICE_NAMES});
 const rows=[0,0,-1,-1];assert.equal(c.attributePracticeRemaining(rows),225);
 assert.equal(c.changeAttributePractice(rows,0,3),false);assert.equal(c.changeAttributePractice(rows,0,0),false);
 for(let col=1;col<5;col++)assert.equal(c.changeAttributePractice(rows,0,col),true);
 assert.equal(c.attributePracticeRemaining(rows),0);assert.deepEqual(rows,[4,0,-1,-1]);
 assert.equal(c.changeAttributePractice(rows,2,0),false);assert.equal(c.changeAttributePractice(rows,0,5),false);
 assert.equal(c.changeAttributePractice(rows,0,4),true);assert.equal(c.attributePracticeRemaining(rows),120);
 for(const row of [2,3]){assert.equal(c.changeAttributePractice(rows,row,0),true);assert.equal(c.changeAttributePractice(rows,row,1),true);}
 assert.equal(c.attributePracticeRemaining(rows),30);
 for(const row of [2,3])for(const col of [1,0])assert.equal(c.changeAttributePractice(rows,row,col),true);
 for(const col of [3,2,1])assert.equal(c.changeAttributePractice(rows,0,col),true);
 assert.deepEqual(rows,[0,0,-1,-1]);assert.equal(c.attributePracticeRemaining(rows),225);
});

test('point values flash white to their normal text color for 500ms on changes, never on unchanged renders or switching characters',()=>{
 const calls=[],node={dataset:{},style:{removeProperty(){}},animate:(frames,options)=>{const call={frames,options,cancelled:false};calls.push(call);return{cancel(){call.cancelled=true;}};}};
 const c=load('const pointReadoutValues=','function renderExperience()',{getComputedStyle:()=>({color:'rgb(0, 200, 230)'})});
 c.updatePointReadout(node,225,'pc');assert.equal(calls.length,0);
 c.updatePointReadout(node,210,'pc');assert.equal(calls.length,1);assert.equal(calls[0].frames[0].color,'#fff');assert.equal(calls[0].frames[1].color,'rgb(0, 200, 230)');assert.equal(calls[0].options.duration,500);
 c.updatePointReadout(node,210,'pc');assert.equal(calls.length,1);
 c.updatePointReadout(node,225,'pc');assert.equal(calls.length,2);assert.equal(calls[0].cancelled,true);
 c.updatePointReadout(node,100,'other');assert.equal(calls.length,2);assert.equal(calls[1].cancelled,true);
 c.updatePointReadout(node,NaN,'other');assert.equal(node.dataset.pointReadout,undefined);
 c.updatePointReadout(node,35,'other');assert.equal(calls.length,2);
});

test('introductory rainbow Next Step and confirmation use the same close-and-focus action',()=>{
 const buttons=[{},{}];let removed=0,focused=0,saved=0;const classes=[];
 for(const button of buttons)button.addEventListener=(name,fn)=>button.click=fn;
 const shell={querySelectorAll:()=>buttons,remove:()=>removed++};
 const c=load('function showDraftIntroduction()','function requestRuleChoices(',{character:{phase:'draft',creation:{}},manualInputMode:()=>false,CAMPAIGN_READ_ONLY_VIEW:false,GM_SHIP_VIEW:false,document:{querySelector:()=>null,createElement:()=>shell,body:{append(){}}},queueSave:()=>saved++,dom:{phaseBadge:{classList:{add:n=>classes.push(n),remove:n=>classes.splice(classes.indexOf(n),1)},focus:()=>focused++}}});
 c.showDraftIntroduction();assert.match(shell.innerHTML,/<button[^>]+draft-guide-copy phase-badge draft/);assert.equal(buttons[0].click,buttons[1].click);buttons[0].click();assert.equal(removed,1);assert.equal(focused,1);assert.deepEqual(classes,[]);assert.equal(saved,1);
});
