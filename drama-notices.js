(() => {
 const key=(code,viewer)=>`sa-drama-ack:${code}:${viewer}`;
 function read(code,viewer){try{return new Set(JSON.parse(localStorage.getItem(key(code,viewer))||'[]'));}catch{return new Set();}}
 window.SADramaNotices={read,ack(code,viewer,id){if(!id)return;const ids=read(code,viewer);ids.add(id);try{localStorage.setItem(key(code,viewer),JSON.stringify([...ids].slice(-100)));}catch{}}};
})();
