(function(root){
  'use strict';
  const signed=n=>`${n>0?'+':''}${Number(n.toFixed(4))}`;
  // Presentation only. Never use these filtered strings to resolve a roll.
  function campaign(calculation,skill='Skill'){
    if(!calculation)return '';
    const lines=Array.isArray(calculation.lines)?calculation.lines:[];
    const source=lines.find(line=>line.startsWith('Skill source: '));
    if(source)skill=source.slice(14);
    const parts=[];
    for(const line of lines){
      let m=line.match(/^(?:Override skill bonus|Skill bonus):\s*([+-]?[\d.]+)$/);
      if(m){if(Number(m[1]))parts.push(`${skill} ${signed(Number(m[1]))}`);continue;}
      m=line.match(/^(Exertion|Equipment (?!subtotal)[^:]+|Intoxication modifier|Ninja additional Exertion|Fluffy Strength|Fluffy Jump|Sked'er Jump|Android Initiative|Epoc ones penalty):\s*([+-]?[\d.]+)$/);
      if(m&&Number(m[2]))parts.push(`${m[1].replace('Intoxication modifier','Intoxication').replace('Epoc ones penalty','Epoc').replace('Ninja additional Exertion','Ninja')} ${signed(Number(m[2]))}`);
      m=line.match(/^Final-score exception: (Garmoc) ([+]\d+(?:\.\d+)?)$/);
      if(m&&Number(m[2]))parts.push(`${m[1]} ${m[2]}`);
      m=line.match(/^Unused-dice candidates:.*; applied bonus ([\d.]+)$/);
      if(m&&Number(m[1]))parts.push(`Other Class ${signed(Number(m[1]))}`);
    }
    return [...new Set(parts)].join(' · ');
  }
  function ship(calculation,{gm=false}={}){
    if(!calculation)return '';
    const sources=[],delay=[];
    for(const line of (calculation.summary||[])){
      const isDelay=/\bATB\b|\bdelay\b|\bspeed\b/i.test(line);
      for(let part of String(line).split(/;|\.\s+(?=[A-Z])/) ){
        part=part.trim().replace(/^ATB:?\s*/,'').replace(/\.$/,'');
        // Dice, totals, thresholds and resolver/debug prose are not modifiers.
        if(/\b(?:dice|D\d+|pool|score|total|threshold|difficulty|submitted|input|unavailable|result|base|resolution|damage)\b/i.test(part))continue;
        const rate=part.match(/^(?:final\s+)?(?:speed\s+)?([\d.]+)\/s$/i);
        if(isDelay&&rate){delay.push(`Delay speed ${rate[1]}/s`);continue;}
        for(const entry of part.split(/,\s*/)){
          const modifier=entry.match(/^([\w .’'()/-]+?)\s+([+-]\d+(?:\.\d+)?)(?:\s*\/\s*([+-]?\d+(?:\.\d+)?)%)?/);
          if(!modifier)continue;
          const flat=Number(modifier[2]),percent=Number(modifier[3]||0);
          if(!flat&&!percent)continue;
          (isDelay?delay:sources).push(`${modifier[1]} ${[flat?signed(flat):'',percent?signed(percent)+'%':''].filter(Boolean).join(' / ')}`);
        }
      }
    }
    // gmSummary holds private target identifiers/defenses, not bonus sources.
    // Do not pull hidden fields into a public presentation or repeat thresholds.
    return [[...new Set(sources)].join(' · '),[...new Set(delay)].join(' · ')].filter(Boolean).join('\n');
  }
  function message(note){
    const text=String(note?.message||'');
    if(note?.kind!=='prompt-result')return text;
    const marker='Character-client calculation report (not independently verified):';
    const at=text.indexOf(marker);
    const head=(at<0?text:text.slice(0,at)).replace(/\. Dice: [^\n]*\./,'');
    return at<0?head:[head.trim(),campaign({lines:text.slice(at+marker.length).trim().split('\n')})].filter(Boolean).join('\n');
  }
  const api={campaign,ship,message};if(typeof module==='object'&&module.exports)module.exports=api;else root.SARollDisplay=api;
})(typeof globalThis==='object'?globalThis:this);
