// Complete browser recovery copies live in IndexedDB, outside localStorage's small quota.
(() => {
  let opening;
  const database=()=>opening ||= new Promise((resolve,reject)=>{const request=indexedDB.open('sa-campaign-recovery-v03',1);request.onupgradeneeded=()=>request.result.createObjectStore('campaigns',{keyPath:'code'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  async function put(backup){const db=await database();return new Promise((resolve,reject)=>{const transaction=db.transaction('campaigns','readwrite');transaction.objectStore('campaigns').put({code:backup.campaign.code,savedAt:Date.now(),backup});transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});}
  async function get(code){const db=await database();return new Promise((resolve,reject)=>{const request=db.transaction('campaigns').objectStore('campaigns').get(code);request.onsuccess=()=>resolve(request.result?.backup||null);request.onerror=()=>reject(request.error);});}
  const revisions=new Map(),pending=new Map();
  function update(state,token){if(state.interfaceVersion!=='0.3'||state.role!=='gm'||!state.roomOpen)return;if(revisions.get(state.code)===state.revision||pending.has(state.code))return;pending.set(state.code,setTimeout(async()=>{try{const response=await fetch(`/api/campaign/backup?code=${state.code}&token=${encodeURIComponent(token)}`);if(!response.ok)throw Error('Background recovery save unavailable');const backup=await response.json();await put(backup);revisions.set(state.code,backup.campaign.revision);document.dispatchEvent(new CustomEvent('sa-recovery-saved',{detail:{code:state.code}}));}catch(error){document.dispatchEvent(new CustomEvent('sa-recovery-error',{detail:{message:error.message}}));}finally{pending.delete(state.code);}},1500));}
  window.SACampaignRecovery={put,get,update};
})();
