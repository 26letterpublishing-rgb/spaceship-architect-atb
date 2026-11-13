const test=require('node:test'),assert=require('node:assert/strict'),{revealFeedback}=require('../black-hole-gun-console');
function panel(){return {scrollTop:20,clientTop:1,clientHeight:100,getBoundingClientRect:()=>({top:10})};}
test('feedback scroll changes only panel offset by the missing visible distance',()=>{const p=panel();revealFeedback(p,{textContent:'Orb launched.',getBoundingClientRect:()=>({top:115,bottom:135})});assert.equal(p.scrollTop,44);});
test('visible or empty feedback preserves manual panel scrolling',()=>{const p=panel();revealFeedback(p,{textContent:'Ready',getBoundingClientRect:()=>({top:30,bottom:50})});assert.equal(p.scrollTop,20);revealFeedback(p,{textContent:''});assert.equal(p.scrollTop,20);});
test('new feedback above a manually scrolled panel is revealed without resetting to top',()=>{const p=panel();p.scrollTop=50;revealFeedback(p,{textContent:'Error',getBoundingClientRect:()=>({top:4,bottom:24})});assert.equal(p.scrollTop,43);});
