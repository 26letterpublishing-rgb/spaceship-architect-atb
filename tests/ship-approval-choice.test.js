const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../room-v03.js'),'utf8');
const start=source.indexOf('  function confirmRoomAction'),end=source.indexOf('  function file(',start);
function setup(){const all=[];const document={body:{append(){}},createElement(tag){const node={tag,children:[],attrs:{},events:{},setAttribute(key,value){this.attrs[key]=value;},append(...items){this.children.push(...items);},addEventListener(key,callback){this.events[key]=callback;},showModal(){this.open=true;},remove(){this.removed=true;},focus(){this.focused=true;},get firstElementChild(){return this.children[0];},get lastElementChild(){return this.children.at(-1);}};all.push(node);return node;}};const c=vm.createContext({document});vm.runInContext(source.slice(start,end),c);return{c,all};}
test('ship approval offers explicit paid and free choices, preserving the difference from cancel',async()=>{
 for(const [choice,expected]of [['paid',true],['free',false],['cancel',null],['',null]]){const {c,all}=setup();const result=c.shipApprovalChoice({data:{title:'Explorer',constructionCost:125000}},{shipCredits:100000});const dialog=all.find(n=>n.tag==='dialog'),buttons=all.filter(n=>n.tag==='button');assert.deepEqual(buttons.map(n=>n.textContent),['Purchase with Group Credits','Approve Free','Cancel']);assert.equal(buttons[2].focused,true);assert.match(all.filter(n=>n.tag==='p')[1].textContent,/-25,000/);dialog.returnValue=choice;dialog.events.close();assert.equal(await result,expected);assert.equal(dialog.removed,true);}
});


test('room consequential actions default to Cancel and require their explicit button',async()=>{
 for(const [choice,expected]of [['confirm',true],['cancel',false],['',false]]){const {c,all}=setup();const result=c.confirmRoomAction('Close Room','Saved campaign data remains.','Close Room for Everyone');const dialog=all.find(n=>n.tag==='dialog'),buttons=all.filter(n=>n.tag==='button');assert.equal(buttons[0].textContent,'Cancel');assert.equal(buttons[0].focused,true);assert.equal(buttons[1].textContent,'Close Room for Everyone');dialog.returnValue=choice;dialog.events.close();assert.equal(await result,expected);}
});
