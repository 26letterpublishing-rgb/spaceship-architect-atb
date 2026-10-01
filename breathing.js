// Immunity is a racial rule, not an exemption from suction, drift or attacks.
function independent(value){const identity=value?.identity||value?.character?.identity||value||{};
 const race=String(identity.raceId||identity.race||'').toLowerCase();
 return Boolean(value?.shipAi||identity.raceType==='mechanical'||['android','epoc'].includes(race)||identity.noBreathing===true||value?.doesNotBreathe===true);
}
module.exports={independent};
