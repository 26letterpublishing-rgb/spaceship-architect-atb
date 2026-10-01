const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {promisify}=require('node:util');const gzip=promisify(zlib.gzip),gunzip=promisify(zlib.gunzip);
const directory=path.join(process.env.SA_LOCAL_DATA_DIR?path.resolve(process.env.SA_LOCAL_DATA_DIR):path.join(__dirname,'data'),'checkpoints');
const queues=new Map();
function codeOf(code){if(!/^[A-Z0-9]{4}$/.test(code))throw Error('Invalid campaign code');return code;}
async function ready(store){if(store.pool)await store.pool.query('CREATE TABLE IF NOT EXISTS sa_encounter_checkpoints (id TEXT PRIMARY KEY, code VARCHAR(4) NOT NULL, created_at TIMESTAMPTZ NOT NULL, reason TEXT NOT NULL, payload JSONB NOT NULL)');else await fs.mkdir(directory,{recursive:true});}
async function list(store,code){codeOf(code);await ready(store);if(store.pool)return (await store.pool.query('SELECT id, created_at AS at, reason FROM sa_encounter_checkpoints WHERE code=$1 ORDER BY created_at DESC LIMIT 20',[code])).rows;
 const names=(await fs.readdir(directory)).filter(n=>n.startsWith(code+'-')&&n.endsWith('.json.gz')).sort().reverse().slice(0,20);
 return Promise.all(names.map(async name=>{const entry=JSON.parse((await gunzip(await fs.readFile(path.join(directory,name)))).toString());return {id:entry.id,at:entry.at,reason:entry.reason};}));}
async function get(store,code,id){codeOf(code);if(!new RegExp('^'+code+'-[0-9]+-[a-f0-9-]+$').test(id))throw Error('Invalid checkpoint');await ready(store);
 if(store.pool)return (await store.pool.query('SELECT payload FROM sa_encounter_checkpoints WHERE code=$1 AND id=$2',[code,id])).rows[0]?.payload;
 return JSON.parse((await gunzip(await fs.readFile(path.join(directory,id+'.json.gz')))).toString()).campaign;
}
async function save(store,campaign,reason){const snapshot=structuredClone(campaign),code=codeOf(campaign.code),id=code+'-'+Date.now()+'-'+crypto.randomUUID(),at=new Date().toISOString();
 const pending=(queues.get(code)||Promise.resolve()).catch(()=>{}).then(async()=>{await ready(store);
  if(store.pool){await store.pool.query('INSERT INTO sa_encounter_checkpoints(id,code,created_at,reason,payload) VALUES($1,$2,$3,$4,$5::jsonb)',[id,code,at,reason,JSON.stringify(snapshot)]);await store.pool.query('DELETE FROM sa_encounter_checkpoints WHERE code=$1 AND id NOT IN (SELECT id FROM sa_encounter_checkpoints WHERE code=$1 ORDER BY created_at DESC LIMIT 20)',[code]);}
  else {const target=path.join(directory,id+'.json.gz');await fs.writeFile(target+'.tmp',await gzip(JSON.stringify({id,at,reason,campaign:snapshot})));await fs.rename(target+'.tmp',target);const old=(await fs.readdir(directory)).filter(n=>n.startsWith(code+'-')&&n.endsWith('.json.gz')).sort().reverse().slice(20);for(const name of old)await fs.unlink(path.join(directory,name));}
  return {id,at,reason};
 });queues.set(code,pending);try{return await pending;}finally{if(queues.get(code)===pending)queues.delete(code);}}
module.exports={save,list,get};
