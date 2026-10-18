(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function recipients(host,people){const checked=new Set([...host.querySelectorAll('input:checked')].map(n=>n.value));host.innerHTML=people.map(p=>'<label style="--recipient-color:'+(/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#40bddd')+'"><input type="checkbox" value="'+esc(p.id)+'" '+(checked.has(p.id)?'checked':'')+'>'+esc(p.name)+'</label>').join('');}
 function card(note,{label,name,unread,actions='',gm=false}){return '<article class="gm-inbox-card '+(unread?'unread':'read')+'" '+(gm?'data-gm-note':'data-note-id')+'="'+esc(note.id)+'"><div><span>'+esc(label)+'</span><strong>'+esc(name||note.senderName||note.characterName||'Campaign')+'</strong><small>'+esc(new Date(note.createdAt).toLocaleString())+'</small></div><p>'+esc(note.message)+'</p>'+actions+'</article>';}
 window.SAInboxUI={recipients,card};
})();
