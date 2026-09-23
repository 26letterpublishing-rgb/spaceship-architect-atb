const test=require('node:test'),assert=require('node:assert/strict'),health=require('../health-display');
test('scan links escape names and IDs and keep same-name objects distinct',()=>{
 const refs=[{id:'one',label:'Twin'},{id:'two',label:'Twin'},{id:'unsafe"<>',label:'<img src=x onerror=alert(1)>'}];
 const html=health.logMarkup({text:'HP 5/10. Objects within sensor range: '+refs.map(r=>r.label).join(', ')+'.',objectRefs:refs});
 assert.doesNotMatch(html,/HP 5|<img/);assert.match(html,/data-log-space-object="one"/);assert.match(html,/data-log-space-object="two"/);assert.match(html,/unsafe&amp;|unsafe&quot;&lt;&gt;/);assert.match(html,/&lt;img/);
});
test('ordinary and legacy reports remain escaped without fabricating object links',()=>{
 assert.equal(health.logMarkup({text:'<Old report> HP 2/8'}),'&lt;Old report&gt;');
 assert.equal(health.logMarkup({text:'Different text',objectRefs:[{id:'x',label:'Fake'}]}),'Different text');
});
