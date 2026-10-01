const { randomInt, randomUUID } = require('node:crypto');
const maps = require('./ship-map-core');

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function shuffled(values) {
  const result = [...values];
  for (let i=result.length-1;i>0;i--) {
    const j=randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
function integer(value, min, max, name) {
  if (!Number.isInteger(value)||value<min||value>max) throw Error(`Choose ${name} from ${min} to ${max}.`);
  return value;
}
function createSecret(security, firewall) {
  integer(security,1,18,'Security');integer(firewall,0,8,'Firewall');
  const letters=shuffled(alphabet);
  return {id:randomUUID(),version:1,password:letters.slice(0,security),decoys:letters.slice(security,security+firewall)};
}
function challenge(secret, reduction=0) {
  integer(reduction,0,4,'module reduction');
  const length=Math.max(1,secret.password.length-Math.max(0,reduction-secret.decoys.length));
  // Remove a stable set of letters, not positions. A counter-hack changes order only.
  const retained=new Set([...secret.password].sort().slice(0,length));
  const answer=secret.password.filter(letter=>retained.has(letter));
  const candidates=[...answer,...secret.decoys.slice(Math.min(reduction,secret.decoys.length))].sort();
  return {answer,candidates,length,version:secret.version};
}
function evaluate(answer, candidates, guess) {
  if(!Array.isArray(guess)||guess.length!==answer.length)throw Error(`Fill all ${answer.length} code positions.`);
  if(guess.some(letter=>typeof letter!=='string'||!candidates.includes(letter)))throw Error('Use only the available letters.');
  const exact=guess.filter((letter,index)=>letter===answer[index]).length;
  const remaining=[...answer];let present=0;
  for(const letter of guess){const index=remaining.indexOf(letter);if(index>=0){present++;remaining.splice(index,1);}}
  return {exact,misplaced:present-exact,success:exact===answer.length};
}
function swap(secret, first, second) {
  integer(first,0,secret.password.length-1,'first position');integer(second,0,secret.password.length-1,'second position');
  if(first===second)throw Error('Choose two different positions.');
  [secret.password[first],secret.password[second]]=[secret.password[second],secret.password[first]];
  secret.version++;
}
function counterSuccess(roll, skill) {
  integer(roll,1,6,'D6 result');
  if(!Number.isFinite(skill)||skill<0)throw Error('Invalid Hacking skill.');
  return roll<skill;
}
function moduleStats(item, skill) {
  const def=maps.definition(item?.type);
  if(!def.hacking)throw Error('Choose a Hacking Module.');
  const points=Math.max(0,Number(item.impairmentPoints)||(item.impaired||item.status==='impaired'?1:0));
  const online=!item.disabled&&!['offline','powered-down','destroyed'].includes(item.status)&&!(def.tier===1&&points>0);
  return {tier:def.tier,minimum:def.hackingMinimum,reduction:Math.max(0,def.hackingReduction-points),qualified:Number.isFinite(skill)&&skill>=def.hackingMinimum,online};
}
function firewallStats(item) {
  const def=maps.definition(item?.type);
  if(!def.firewall)return 0;
  if(item.disabled||['offline','powered-down','destroyed'].includes(item.status))return 0;
  return Math.max(0,def.firewall-(Number(item.impairmentPoints)||(item.impaired||item.status==='impaired'?1:0)));
}

module.exports={createSecret,challenge,evaluate,swap,counterSuccess,moduleStats,firewallStats};
