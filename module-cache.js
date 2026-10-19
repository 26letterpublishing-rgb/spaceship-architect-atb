(() => {
 'use strict';
 // Source packages are local library data, never part of a live campaign snapshot.
 let database;
 function db(){return database||=new Promise((resolve,reject)=>{const r=indexedDB.open('sa-adventure-modules',1);r.onupgradeneeded=()=>r.result.createObjectStore('packages',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('The local Module library is unavailable.'));});}
 async function request(mode,operation){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('packages',mode),r=operation(tx.objectStore('packages'));tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(Error('Unable to store this Module locally. Check available browser storage.'));tx.onabort=tx.onerror;});}
 async function put(file){if(file?.version!==2||file.format!=='spaceship-architect-adventure')return;await request('readwrite',s=>s.put(file));}
 const get=id=>request('readonly',s=>s.get(id));
 async function unpack(entry){const binary=atob(entry.data),data=Uint8Array.from(binary,c=>c.charCodeAt(0)),stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')),reader=stream.getReader(),chunks=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>16*1024*1024){await reader.cancel();throw Error('The packaged file exceeds 16 MB.');}chunks.push(value);}const bytes=await new Blob(chunks).arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(digest!==entry.digest||length!==entry.bytes)throw Error('This packaged file is damaged. Reattach the original Module.');return JSON.parse(new TextDecoder().decode(bytes));}
 window.SAModuleCache={put,get,unpack};
})();
