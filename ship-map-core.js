(function initializeShipMapCore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAShipMap = api;
}(typeof window !== "undefined" ? window : null, function createShipMapCore() {
  const ASSET_VERSION = "20260911-pilot-web-assets-1";
  const GRID_SIZE = 20;
  const HULL_COST = 1000;
  const SIDES = Object.freeze([
    { name: "top", offset: -GRID_SIZE, valid: (square) => square >= GRID_SIZE },
    { name: "right", offset: 1, valid: (square) => square % GRID_SIZE < GRID_SIZE - 1 },
    { name: "bottom", offset: GRID_SIZE, valid: (square) => square < GRID_SIZE * 59 },
    { name: "left", offset: -1, valid: (square) => square % GRID_SIZE > 0 },
  ]);
  const image = (filename) => `${filename}?v=${ASSET_VERSION}`;
  const catalog = {
    "lock-on-1": { name:"Lock-On System 1", width:1, height:1, label:"LO 1", color:"#9d7138", image:image("lock-on-1-floor-plan.png"), lockOn:true, tier:1, energyCost:1, price:560, security:1, crafting:"Paradon, 6 hrs", threshold:3, cardNumber:"A-37", output:0, stations:[] },
    "cockpit-1": { name: "Cockpit 1", width: 1, height: 1, label: "CP 1", color: "#346f91", image: image("cockpit-1-floor-plan.png"), shipControl: true, bridge: true, edge: true, energyCost: 1, price: 750, security: 4, crafting: "Transpherion, 4 hrs", threshold: 20, cardNumber: "A-1", output: 0, stations: [{x:0,y:0,mesh:0}] },
    "rapid-laser-1": { name: "Rapid Laser 1", width: 1, height: 1, label: "RL 1", color: "#88dfff", image: image("rapid-laser-1-sprite.png"), sprite: "rapid-laser-1-sprite.png", exterior: true, weapon: true, tier: 1, energyCost: 1, price: 450, security: 1, crafting: "Crystilium, 4 hrs", threshold: 4, cardNumber: "A-100", output: 0, stations: [] },
    "exhaust-thruster-1": { name: "Exhaust Thruster 1", width: 1, height: 1, label: "ET 1", color: "#568da4", image: image("exhaust-thruster-1-graphic.png"), exterior: true, thruster: true, impulseBonus: 1, exhaust: -2, energyCost: 2, price: 200, security: 2, crafting: "Dianium, 2 hrs", threshold: 10, cardNumber: "A-23", output: 0, stations: [] },
    "en-engine-1": { width: 1, height: 1, label: "EN 1", color: "#2d873b", image: image("en-engine-1-floor-plan.png"), output: 5, stations: [{ x: 0, y: 0, mesh: 1 }] },
    "en-engine-2": { width: 2, height: 2, label: "EN 2", color: "#2d873b", image: image("en-engine-2-floor-plan.png"), output: 13, stations: [{ x: 0, y: 0, mesh: 1 }, { x: 1, y: 1, mesh: 7 }] },
    "en-engine-3": { width: 3, height: 3, label: "EN 3", color: "#2d873b", image: image("en-engine-3-floor-plan.png"), output: 29, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 1, y: 2, mesh: 7 }] },
    "en-engine-4": { width: 4, height: 4, label: "EN 4", color: "#2d873b", image: image("en-engine-4-floor-plan.png"), output: 50, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 3, y: 1, mesh: 5 }, { x: 1, y: 3, mesh: 7 }] },
    "en-engine-5": { width: 5, height: 5, label: "EN 5", color: "#2d873b", image: image("en-engine-5-floor-plan.png"), output: 77, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 4, y: 2, mesh: 5 }, { x: 2, y: 4, mesh: 7 }] },
    "en-engine-6": { width: 6, height: 6, label: "EN 6", color: "#2d873b", image: image("en-engine-6-floor-plan.png"), output: 110, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 5, y: 2, mesh: 5 }, { x: 3, y: 5, mesh: 7 }, { x: 0, y: 3, mesh: 3 }] },
    "life-support": { name: "Life Support", utility: "life-support", width: 2, height: 2, label: "LIFE", color: "#16788a", image: image("life-support-floor-plan.png"), energyCost: 2, price: 1500, threshold:18, output: 0, stations: [{x:0,y:0,mesh:0}] },
    "nutritional-supplement": { name: "Nut Supplement", utility: "nutrition", width: 1, height: 1, label: "NUT.", color: "#197a6f", image: image("nutritional-supplement-floor-plan.png"), energyCost: 3, price: 850, threshold:10, output: 0, stations: [{x:0,y:0,mesh:0}] },
    "decent-hover": { name:"Decent (Hover)", landing:"hover", multiMount:4, exterior:true, width:1, height:1, label:"HOVER", color:"#8acdbc", image:image("sic-art-decent-hover.webp"), sprite:"sic-art-decent-hover.webp", price:5375, energyCost:5, security:4, threshold:12, crafting:"Endernium, 2 days", cardNumber:"A-28", hullLimit:450, output:0, stations:[] },
    "decent-aerofoil": { name:"Decent (Aerofoil)", landing:"aerofoil", hullSystem:true, width:0, height:0, label:"WINGS", color:"#c4b777", image:image("sic-art-decent-aerofoil.webp"), price:675, energyCost:2, security:4, threshold:25, crafting:"Crystilium, 5 hrs", cardNumber:"A-27", hullLimit:200, output:0, stations:[] },
  };

  catalog['planetary-cleanser']={name:'Planetary Cleanser',skill:'Weapon Systems',planetaryCleanser:true,utility:'planetary-cleanser',width:3,height:9,mixed:true,exteriorRows:6,interiorWidth:3,interiorRows:3,fixedStations:true,label:'CLEANSER',color:'#cb83f5',image:image('planetary-cleanser-room.webp'),sprite:'planetary-cleanser-barrel.webp',cardArt:'sic-art-planetary-cleanser.webp',price:500000,energyCost:50,security:5,threshold:23,crafting:'Aethion, 3 weeks',cardNumber:'B-110',unstableOnImpairment:true,output:0,stations:[{x:0,y:8,mesh:4},{x:2,y:8,mesh:4}]};
  catalog['probe-launcher']={name:'Probe Launcher',probeLauncher:true,utility:'probe-launcher',width:2,height:2,edge:true,fixedStations:true,label:'PROBES',color:'#5b9aab',image:image('probe-launcher.svg'),price:4700,energyCost:2,security:3,threshold:20,crafting:'Necronium, 1 day',cardNumber:'A-71',capacity:4,output:0,stations:[{x:1,y:1,mesh:4}]};
  for(const [type,name,price,energyCost,security,crafting,cardNumber]of [['shield-breacher','Shield Breacher',900,0,3,'Paradon, 5 hrs','B-40'],['hacking-bug','Hacking Bug',275,1,3,'Ragnaron, 3 hrs','B-51'],['warp-bubble-inhibitor','Warp Bubble Inhibitor',1750,0,null,'Mirium, 1 day','B-120']])catalog[type]={name,price,energyCost,security,crafting,cardNumber,probeAttachment:true,addon:'probe-module',hullSystem:true,width:0,height:0,label:name,color:'#a28bd6',image:image(type+'.svg'),threshold:null,output:0,stations:[]};
  for(let tier=1;tier<=5;tier++)catalog[`probe-${tier}`]={name:`Probe ${tier}`,probe:true,addon:'probe',hullSystem:true,width:0,height:0,label:`PROBE ${tier}`,color:'#75cad7',image:image(`probe-${tier}.svg`),price:[100,250,450,700,1000][tier-1],energyCost:0,security:tier,threshold:5+tier*5,masking:8+tier*2,moveSpeed:2+tier*2,probeDice:Array([3,3,4,3,4][tier-1]).fill([8,10,10,12,12][tier-1]),tier,crafting:['Transpherion, 2 hrs','Ragnaron, 3 hrs','Crystilium, 4 hrs','Paradon, 4 hrs','Argol, 6 hrs'][tier-1],cardNumber:tier<4?'A-'+(71+tier):'B-'+(48+tier),destroyedOnImpairment:true,output:0,stations:[]};
  catalog['surv-camera']={name:'Surv. Camera',utility:'surveillance',surveillance:true,fixedStations:true,localOnly:true,width:1,height:1,label:'CAM',color:'#41958d',image:image('surv-camera-floorplan.webp'),price:300,energyCost:1,security:4,threshold:10,crafting:'Dianium, 2 hrs',cardNumber:'A-87',destroyedOnImpairment:true,output:0,stations:[{x:0,y:0,mesh:7}]};
  for(let tier=1;tier<=5;tier++){
    const n=tier-1;
    catalog[`repair-drone-${tier}`]={name:`Repair Drone ${tier}`,utility:'repair-drone',repairDrone:true,tier,repairDie:4+n*2,masking:12+n*2,width:1,height:1,edge:true,label:`DRONE ${tier}`,color:['#66999a','#568bc3','#679b63','#9670b0','#b5a04e'][n],image:image('repair-drone-1-floorplan.webp'),cardArt:image(`repair-drone-${tier}-sprite.webp`),droneSprite:`repair-drone-${tier}-sprite.webp`,price:750+n*300,energyCost:[2,3,3,3,4][n],security:[2,3,4,4,5][n],threshold:14+n*3,crafting:['Argol, 6 hrs','Mirium, 16 hrs','Drakkonite, 16 hrs','Phazon, 16 hrs','Necronium, 1 day'][n],cardNumber:'B-'+(53+tier),destroyedOnImpairment:true,output:0,stations:[]};
  }
  catalog['backup-generator']={name:'Backup Generator',engine:true,clearance:1,impairmentImmune:true,width:1,height:1,label:'BACKUP',color:'#688f6f',image:image('backup-generator.webp'),price:525,energyCost:0,security:5,threshold:55,crafting:'Crystilium, 4 hrs',cardNumber:'B-71',output:3,stations:[]};
  for(let tier=1;tier<=4;tier++){
    const n=tier-1,type=`antenna-${tier}`;
    catalog[type]={name:`Antenna ${tier}`,antenna:true,tier,bonusDie:6+n*2,impairedDie:tier<3?4:6,rangeBonus:tier,width:1,height:2,exterior:true,label:`ANT ${tier}`,color:['#698aac','#6a92cb','#9574b3','#b8a365'][n],image:image(type+'.webp'),sprite:type+'.webp',price:1200*2**n,energyCost:[2,2,3,4][n],security:tier<3?2:3,threshold:[9,9,11,13][n],crafting:['Argol, 6 hrs','Drakkonite, 10 hrs','Necronium, 1 day','Carmot, 3 days'][n],cardNumber:'B-'+(26+tier),output:0,stations:[]};
  }
  for(const [type,name,card,width,height,price,en,security,threshold,crafting,extra] of [
    ['gym','Gym',66,3,3,75,0,null,13,'Xpidinium, 1.5 hrs',{crewRoom:true,localOnly:true,roomStation:true}],
    ['science-lab','Science Lab',65,3,3,1000,2,4,13,'Ragnaron, 3 hrs',{crewRoom:true,localOnly:true,mineralCapacity:5000}],
    ['holographic-projector','Holographic Projector',79,0,0,400,0,3,null,'Ragnaron, 3 hrs',{addon:'bridge',bridgeAddon:true,hullSystem:true}],
    ['vulnerability-fortification','Vulnerability Fortification',116,0,0,500,0,null,null,'Not Available',{addon:'any',hullSystem:true}],
    ['power-core-damper','Power Core Damper',76,0,0,1800,1,null,null,'Argol, 6 hrs',{addon:'engine',hullSystem:true}],
    ['scramble-box','Scramble Box',119,1,1,3000,5,2,13,'Phazon, 16 hrs',{}],
  ])catalog[type]={name,cardNumber:'B-'+card,width,height,price,energyCost:en,security,threshold,crafting,...extra,utility:extra.crewRoom?type:undefined,label:name,color:'#668e91',output:0,image:image(type+'.svg'),stations:type==='science-lab'?[{x:1,y:1,mesh:4}]:[]};
  const lockDice = [[2,4],[3,4],[2,6],[3,6],[2,8],[3,8],[2,10],[3,10],[2,12],[4,12]];
  for(const [type,name,width,height,price,energyCost,security,threshold,crafting,card,color,seats] of [
    ['vr-training-room','VR Training Room',3,3,7500,2,3,13,'Endernium, 2 days',83,'#8467a5',2],
    ['medbay','Medbay',3,3,1000,1,4,13,'Argol, 6 hrs',84,'#4f957f',1],
    ['library','Library',2,2,150,1,5,13,'Transpherion, 2 hrs',85,'#57758a',2],
    ['meeting-room','Meeting Room',3,3,100,0,5,15,'Transpherion, 2 hrs',86,'#ab8b54',4],
    ['ship-ai','Ship AI',0,0,5000,1,5,null,'Drakkonite, 10 hrs',89,'#8ecec0',0],
  ])catalog[type]={name,width,height,price,energyCost,security,threshold,crafting,cardNumber:'A-'+card,color,output:0,utility:type,crewRoom:true,localOnly:type!=='ship-ai',shipAi:type==='ship-ai',bridgeAddon:type==='ship-ai',hullSystem:type==='ship-ai',label:name,image:image('sic-art-'+type+'.webp'),stations:Array.from({length:seats},(_,n)=>({x:n%2===0?0:width-1,y:n<2?0:height-1,mesh:n%2===0?0:2}))};

  catalog['vr-training-room'].image=image('vr-training-room-3x3.webp');
  catalog['meeting-room'].roomStation=true;
  catalog['meeting-room'].stations=[0,2,3,5,6,8].map(mesh=>({x:1,y:1,mesh}));
  const impairedLockDice = [[2,2],[3,2],[2,4],[3,4],[2,6],[3,6],[2,8],[3,8],[2,10],[2,12]];
  const lockSizes = [[1,1],[1,1],[1,1],[1,1],[2,1],[2,1],[2,1],[2,2],[2,2],[2,2]];
  const lockCraft = ['Paradon, 6 hrs','Argol, 10 hrs','Mirium, 16 hrs','Drakkonite, 2 days','Phazon, 3 days','Necronium, 3 days','Endernium, 1 week','Dark Phazon, 1 week','Infinium, 10 days','Aethion, 3 weeks'];
  for(let tier=1;tier<=10;tier++){
    const n=tier-1,type=`lock-on-${tier}`;
    catalog[type]={...catalog['lock-on-1'],name:`Lock-On System ${tier}`,label:`LO ${tier}`,tier,width:lockSizes[n][0],height:lockSizes[n][1],price:[560,1600,3300,4500,8000,22000,24000,68000,108000,236000][n],energyCost:[1,1,1,2,2,2,3,3,3,4][n],security:Math.ceil(tier/2),threshold:tier*3,crafting:lockCraft[n],cardNumber:tier<=8?`A-${36+tier}`:`B-${22+tier}`,lockDice:Array(lockDice[n][0]).fill(lockDice[n][1]),impairedLockDice:Array(impairedLockDice[n][0]).fill(impairedLockDice[n][1]),breakDifficulty:12+tier,extraTargetAu:[4,4,3,3,2,2,1,1,0,0][n],maxTargets:tier>=9?6:2,unlimitedTargets:tier>=9,image:image(`${type}-floor-plan.png`)};
  }
  for(let tier=1;tier<=5;tier++){
    const n=tier-1,type=`rapid-laser-${tier}`;
    catalog[type]={...catalog['rapid-laser-1'],name:`Rapid Laser ${tier}`,label:`RL ${tier}`,tier,width:1,height:tier>=3?2:1,price:[450,850,2200,4100,5300][n],energyCost:tier,security:[1,1,2,3,4][n],threshold:2+tier*2,crafting:['Crystilium, 4 hrs','Crystilium, 4 hrs','Drakkonite, 10 hrs','Xpidinium, 1 day','Ragnaron, 1 day'][n],cardNumber:tier<=3?`A-${99+tier}`:`B-${78+tier}`,damageDie:[4,6,8,10,12][n],fireAu:5,image:image(`${type}-sprite.png`),sprite:`${type}-sprite.png`};
  }

  Object.assign(catalog, {
    "au-engine-1": { ...catalog["en-engine-1"], label: "AU 1", color: "#886b28", output: 0, auOutput: 3, price: 1200, security: 3, crafting: "Drakkonite, 16 hrs", threshold: 8, cardNumber: "A-19", image: image("au-engine-1-floor-plan.png") },
    "au-engine-2": { ...catalog["en-engine-2"], label: "AU 2", color: "#886b28", output: 0, auOutput: 7, price: 2800, security: 3, crafting: "Phazon, 16 hrs", threshold: 11, cardNumber: "A-20", image: image("au-engine-2-floor-plan.png") },
    "au-engine-3": { ...catalog["en-engine-3"], label: "AU 3", color: "#886b28", output: 0, auOutput: 15, price: 6000, security: 4, crafting: "Endernium, 2 days", threshold: 16, cardNumber: "A-21", image: image("au-engine-3-floor-plan.png") },
    "au-engine-4": { ...catalog["en-engine-4"], label: "AU 4", color: "#886b28", output: 0, auOutput: 25, price: 10000, security: 4, crafting: "Dark Phazon, 3 days", threshold: 20, cardNumber: "A-22", image: image("au-engine-4-floor-plan.png") },
    "au-engine-5": { ...catalog["en-engine-5"], label: "AU 5", color: "#886b28", output: 0, auOutput: 40, price: 16000, security: 5, crafting: "Carmot, 1 week", threshold: 27, cardNumber: "B-11", image: image("au-engine-5-floor-plan.png") },
    "au-engine-6": { ...catalog["en-engine-6"], label: "AU 6", color: "#886b28", output: 0, auOutput: 60, price: 24000, security: 5, crafting: "Infinium, 1 week", threshold: 33, cardNumber: "B-12", image: image("au-engine-6-floor-plan.png") },
  });

  const hybridFamilies = [
    { prefix: "en-au", name: "Power Hybrid", label: "PH", color: "#296e88", bonus: "en", en: [3, 9, 19, 33, 51, 73], au: [1, 2, 5, 10, 17, 26], prices: [1450, 3950, 8650, 15550, 24650, 35950], thresholds: [9, 14, 20, 26, 34, 42], firstCraft: "Argol, 6 hrs", cards: ["A-11", "A-12", "A-13", "A-14", "B-7", "B-8"] },
    { prefix: "au-en", name: "Action Hybrid", label: "AH", color: "#8b5378", bonus: "au", en: [1, 4, 9, 16, 25, 36], au: [2, 5, 12, 20, 30, 47], prices: [1150, 3400, 7950, 13600, 20750, 31400], thresholds: [8, 12, 17, 22, 29, 36], firstCraft: "Mirium, 8 hrs", cards: ["A-15", "A-16", "A-17", "A-18", "B-9", "B-10"] },
  ];
  for (let tier = 1; tier <= 6; tier += 1) {
    Object.assign(catalog[`en-engine-${tier}`], { name: `Power Engine ${tier}`, stationBonus: "en", engine: true, clearance:tier, threshold:[10,17,25,33,43,53][tier-1], price:[1750,4550,10150,17500,26950,38500][tier-1], cardNumber:tier<=4?`A-${6+tier}`:`B-${tier}` });
    Object.assign(catalog[`au-engine-${tier}`], { name: `Action Engine ${tier}`, stationBonus: "au", engine: true, clearance:tier });
    for (const family of hybridFamilies) {
      const type = `${family.prefix}-engine-${tier}`;
      catalog[type] = { ...catalog[`au-engine-${tier}`], name: `${family.name} Engine ${tier}`, label: `${family.label} ${tier}`, color: family.color,
        output: family.en[tier - 1], auOutput: family.au[tier - 1], stationBonus: family.bonus,
        price: family.prices[tier - 1], threshold: family.thresholds[tier - 1], cardNumber: family.cards[tier - 1],
        crafting: tier === 1 ? family.firstCraft : catalog[`au-engine-${tier}`].crafting,
        impairedAuOnly: true, image: image(`${type}-floor-plan.png`) };
    }
  }

  const exhaustSizes = [[1, 1], [2, 1], [3, 2], [3, 2], [4, 2]];
  const exhaustCraft = ["Dianium, 2 hrs", "Xpidinium, 3 hrs", "Crystilium, 4 hrs", "Argol, 4 hrs", "Drakkonite, 6 hrs"];
  const exhaustColors = ["#8ce8ff", "#bf83ff", "#679dff", "#52edcb", "#ff6679"];
  for (let tier = 1; tier <= 5; tier++) {
    const type = `exhaust-thruster-${tier}`;
    catalog[type] = { ...catalog["exhaust-thruster-1"], name: `Exhaust Thruster ${tier}`, label: `ET ${tier}`,
      width: exhaustSizes[tier - 1][0], height: exhaustSizes[tier - 1][1], impulseBonus: tier, exhaust: -1 - tier,
      energyCost: tier * 2, price: tier * 200, security: Math.ceil(tier / 2) + 1, threshold: 8 + tier * 2,
      crafting: exhaustCraft[tier - 1], cardNumber: tier < 5 ? `A-${22 + tier}` : "B-13",
      image: image(`${type}-graphic.png`), sprite: `${type}-sprite.png`, color: exhaustColors[tier - 1], auBoost: tier, auCost: 4 };
    catalog[type].emitters = [ [[50,90,50]], [[27.5,86,32],[72.5,86,32]], [[22,88,36],[78,88,36]],
      [[25,84,32],[75,84,32]], [[27,90,32],[73,90,32]] ][tier - 1];
    const ionicType = `ionic-pulse-thruster-${tier}`;
    catalog[ionicType] = { ...catalog[type], name: `Ionic Pulse Thruster ${tier}`, label: `IP ${tier}`, ionic: true,
      exhaust: 0, energyCost: tier * 5, price: tier * 350, security: [2, 2, 3, 3, 4][tier - 1], threshold: 7 + tier,
      crafting: ["Paradon, 4 hrs", "Argol, 4 hrs", "Mirium, 5 hrs", "Drakkonite, 6 hrs", "Mirium, 8 hrs"][tier - 1],
      cardNumber: `B-${13 + tier}`, image: image(`${ionicType}-graphic.png`), sprite: `${ionicType}-graphic.png`, auCost: 2,
      emitters: tier === 1 ? [[50,80,42]] : [[26,80,32],[74,80,32]] };
  }

  const bridgeRows = [
    ["cockpit-2", "Cockpit 2", 1, 2, 1100, 1, 4, "Crystilium, 5 hrs", 25, "A-2", 7],
    ["bridge-1", "Bridge 1", 2, 3, 1000, 2, 4, "Paradon, 8 hrs", 30, "A-3", 6],
    ["bridge-2", "Bridge 2", 2, 4, 2250, 2, 5, "Mirium, 10 hrs", 35, "A-4", 6],
    ["bridge-3", "Bridge 3", 3, 5, 4000, 3, 5, "Drakkonite, 16 hrs", 40, "A-5", 5],
    ["bridge-4", "Bridge 4", 3, 6, 6500, 3, 5, "Phazon, 1 day", 45, "A-6", 5],
    ["bridge-5", "Bridge 5", 4, 7, 10000, 4, 6, "Necronium, 2 days", 50, "B-1", 4],
    ["bridge-6", "Bridge 6", 4, 8, 16000, 4, 6, "Endernium, 2 days", 55, "B-2", 4],
    ["bridge-7", "Bridge 7", 5, 10, 24250, 5, 7, "Dark Phazon, 3 days", 60, "B-3", 3],
    ["bridge-8", "Bridge 8", 5, 12, 40000, 5, 8, "Carmot, 2 hrs", 65, "B-4", 2],
  ];
  catalog['cockpit-1'].rebootSeconds = 8 * 12;
  function perimeterStations(width, height, count) {
    if(width===1&&height===1&&count===2)return [{x:0,y:0,mesh:0},{x:0,y:0,mesh:2}];
    const points = [{ x: 0, y: 0, mesh: 0 }, { x: width - 1, y: height - 1, mesh: 8 },
      { x: width - 1, y: 0, mesh: 2 }, { x: 0, y: height - 1, mesh: 6 }];
    for (let x = 1; x < width - 1; x++) points.push({ x, y: 0, mesh: 0 }, { x, y: height - 1, mesh: 8 });
    for (let y = 1; y < height - 1; y++) points.push({ x: 0, y, mesh: 0 }, { x: width - 1, y, mesh: 8 });
    return points.slice(0, count);
  }
  for (const [type, name, size, seats, price, energyCost, security, crafting, threshold, cardNumber, rebootRounds] of bridgeRows) {
    catalog[type] = { ...catalog["cockpit-1"], name, width: size, height: size, price, energyCost, security, crafting, threshold, cardNumber,
      rebootSeconds: rebootRounds * 12, label: `${type.startsWith("cockpit") ? "CP" : "BR"} ${type.split("-")[1]}`,
      image: image(`${type}-floor-plan.png`), stations: perimeterStations(size, size, seats) };
  }
  catalog["shield-1"] = { name: "Shield 1", width: 1, height: 1, label: "SH 1", color: "#277b62", image: image("shield-1-floor-plan.png"),
    shield: true, energyCost: 5, price: 1000, security: 1, crafting: "Paradon, 6 hrs", threshold: 2, cardNumber: "A-51", output: 0,
    shieldHp: 10, shieldReduction: 1, shieldRegeneration: 1, restabilizeSeconds: 120, restabilizeAu: 20, stations: [{ x: 0, y: 0, mesh: 0 }] };
  const shieldRows = [
    [2, 2, 2, 2400, 1, 'Argol, 10 hrs', 1, 2, 20, 'A-52'],
    [3, 2, 2, 3900, 2, 'Mirium, 16 hrs', 2, 2, 30, 'A-53'],
    [4, 3, 3, 6000, 2, 'Drakkonite, 2 days', 2, 3, 30, 'A-54'],
    [5, 3, 3, 9500, 3, 'Phazon, 3 days', 3, 3, 40, 'A-55'],
    [6, 4, 3, 14250, 3, 'Necronium, 3 days', 3, 4, 40, 'A-56'],
    [7, 4, 4, 21000, 4, 'Endernium, 1 week', 4, 4, 50, 'A-57'],
    [8, 4, 4, 32500, 4, 'Dark Phazon, 1 week', 4, 5, 60, 'A-58'],
    [9, 5, 4, 50000, 5, 'Carmot, 10 days', 5, 5, 70, 'B-36'],
    [10, 5, 5, 80500, 5, 'Infinium, 10 days', 6, 6, 80, 'B-37'],
  ];
  for (const [tier,size,seats,price,security,crafting,shieldReduction,shieldRegeneration,restabilizeAu,cardNumber] of shieldRows) {
    catalog[`shield-${tier}`] = { ...catalog['shield-1'], name:`Shield ${tier}`,width:size,height:size,label:`SH ${tier}`,
      image:image(`shield-${tier}-floor-plan.png`),energyCost:tier*5,price,security,crafting,threshold:tier*2,cardNumber,
      shieldHp:tier*10,shieldReduction,shieldRegeneration,restabilizeAu,stations:perimeterStations(size,size,seats) };
  }

  const sensorRows = [
    [1,150,1,1,1,1,'Ragnaron, 3 hrs',6,2,4,8,4,2,'A-31'],
    [2,675,1,2,1,1,'Crystilium, 4 hrs',9,2,6,10,6,4,'A-32'],
    [3,1600,2,2,1,1,'Mirium, 8 hrs',12,3,6,12,8,4,'A-33'],
    [4,3500,2,3,1,1,'Phazon, 16 hrs',15,2,8,14,10,6,'A-34'],
    [5,6300,3,3,2,1,'Drakkonite, 2 days',18,3,8,16,12,6,'A-35'],
    [6,15750,3,4,2,1,'Necronium, 3 days',21,3,10,18,15,8,'A-36'],
    [7,30800,4,4,2,1,'Dark Phazon, 1 week',24,4,10,20,16,8,'B-24'],
    [8,63000,4,5,2,2,'Infinium, 10 days',27,3,12,22,18,10,'B-25'],
    [9,127000,5,5,2,2,'Aethion, 3 weeks',30,4,12,24,20,10,'B-26'],
  ];
  for (const [tier,price,energyCost,security,width,height,crafting,threshold,diceCount,die,range,impairedRange,impairedDie,cardNumber] of sensorRows) {
    catalog[`sensors-${tier}`] = { name:`Sensors ${tier}`, sensor:true, tier, price, energyCost, security, width, height,
      crafting, threshold, diceCount, die, range, impairedRange, impairedDie, cardNumber, output:0, stations:[],
      label:`SN ${tier}`, color:'#267f89', image:image(`sensors-${tier}-floor-plan.png`) };
  }

  for(let tier=1;tier<=10;tier++){
    const n=tier-1,type=`darkveil-${tier}`;
    catalog[type]={name:`Darkveil ${tier}`,label:`DV ${tier}`,tier,darkveil:8+2*tier,width:1,height:1,color:'#79599a',image:image('darkveil-floor-plan.png'),cardArt:'darkveil-card.png',output:0,stations:[],energyCost:tier,security:Math.ceil(tier/2),threshold:5+2*tier,price:[25,225,2400,8200,13200,20000,30000,41500,57000,76850][n],crafting:['Ragnaron, 5 hrs','Paradon, 8 hrs','Mirium, 16 hrs','Drakkonite, 16 hrs','Phazon, 2 days','Necronium, 2 days','Endernium, 2 days','Dark Phazon, 3 days','Carmot, 3 days','Infinium, 10 days'][n],cardNumber:tier<=8?`A-${74+tier}`:`B-${50+tier}`};
  }
  for(const family of ['beam-laser','ripple-cannon','ion-pulse-cannon'])for(let tier=1;tier<=(family==='ion-pulse-cannon'?5:8);tier++){
    const n=tier-1,beam=family==='beam-laser',ripple=family==='ripple-cannon',ext=beam?(tier<=2?1:tier===8?3:2):ripple?(tier<=2?1:tier===8?3:2):tier<=2?2:tier===5?4:3;
    catalog[`${family}-${tier}`]={name:`${beam?'Beam Laser':ripple?'Ripple Cannon':'Ion Pulse Cannon'} ${tier}`,label:`${beam?'BL':ripple?'RC':'IP'} ${tier}`,weapon:true,weaponFamily:family,tier,width:1,height:ext+2,mixed:true,exteriorRows:ext,color:beam?'#dcaf56':ripple?'#64b58d':'#a28fdd',image:image(`${family}-floor-plan.png`),sprite:`${family}-sprite.png`,cardArt:`${family}-card.png`,stations:beam||ripple?[{x:0,y:ext+1,mesh:7}]:[],output:0,energyCost:beam?tier:ripple?tier+1:[4,7,10,11,12][n],security:beam?[1,2,2,3,3,4,4,5][n]:ripple?[1,2,2,3,3,4,4,5][n]:tier,threshold:beam?6+3*tier:ripple?3+3*tier:3+5*tier,price:beam?[875,1750,2400,3500,5500,6500,7150,9750][n]:ripple?[1000,2500,4000,6000,8000,10500,12000,13500][n]:[1300,2800,5400,6600,10400][n],crafting:beam?['Argol, 5 hrs','Mirium, 8 hrs','Drakkonite, 16 hrs','Phazon, 16 hrs','Necronium, 2 days','Endernium, 2 days','Dark Phazon, 2 days','Carmot, 3 days'][n]:ripple?['Ragnaron, 5 hrs','Paradon, 8 hrs','Mirium, 16 hrs','Drakkonite, 16 hrs','Phazon, 2 days','Necronium, 2 days','Endernium, 2 days','Dark Phazon, 3 days'][n]:['Drakkonite, 10 hrs','Phazon, 16 hrs','Necronium, 1 day','Endernium, 2 days','Dark Phazon, 3 days'][n],cardNumber:beam?(tier<=6?`A-${93+tier}`:`B-${73+tier}`):ripple?(tier<=6?`A-${102+tier}`:`B-${77+tier}`):(tier<=3?`A-${108+tier}`:`B-${82+tier}`),damageDie:beam?[6,6,8,8,10,10,12,12][n]:8,damageCount:beam?(tier%2?1:2):tier,damageBonus:beam?[0,0,0,1,1,2,2,3][n]:0,boostAu:beam||ripple?3:0,fireAu:beam||ripple?0:tier+3,requiresLock:beam,rangeStep:ripple?Math.ceil(tier/2):0,shieldPiercing:!beam&&!ripple};
  }
  for (let tier=1;tier<=8;tier++) {
    const n=tier-1,art=`cpu-security-tiers.svg#tier-${tier}`;
    catalog[`cpu-security-${tier}`]={name:`CPU Security System ${tier}`,label:`CPU ${tier}`,tier,firewall:tier,
      width:tier<5?1:2,height:tier===8?2:1,color:'#478b6d',image:image(art),cardArt:art,output:0,stations:[],
      energyCost:[1,2,3,4,5,6,8,10][n],security:null,threshold:9+tier*3,price:[100,800,3600,11200,27500,57600,107800,192000][n],
      crafting:['Argol, 5 hrs','Mirium, 8 hrs','Drakkonite, 16 hrs','Phazon, 16 hrs','Necronium, 2 days','Endernium, 2 days','Dark Phazon, 2 days','Carmot, 3 days'][n],
      cardNumber:tier<=6?`A-${44+tier}`:`B-${27+tier}`};
  }
  for (let tier=1;tier<=5;tier++) {
    const n=tier-1,art=`hacking-module-tiers.svg#tier-${tier}`;
    catalog[`hacking-module-${tier}`]={name:`Hacking Module ${tier}`,label:`HACK ${tier}`,tier,hacking:true,hackingMinimum:Math.max(0,tier-1),hackingReduction:tier-1,
      width:1,height:tier<4?1:2,color:'#967eae',image:image(art),cardArt:art,output:0,stations:[],
      energyCost:[1,1,2,2,3][n],security:tier,threshold:6+tier*2,price:[500,2900,8100,16000,25000][n],
      crafting:['Crystilium, 4 hrs','Argol, 10 hrs','Endernium, 2 days','Endernium, 2 days','Dark Phazon, 3 days'][n],
      cardNumber:tier<=3?`A-${67+tier}`:`B-${45+tier}`};
  }
  function resourceArt(kind, tier = 0) {
    const id=kind==='warp'?'warp-drive-'+(tier===0?'zero':tier===6?'x':tier):kind==='fuel'?'warp-fuel-'+['f','d','c','b','a','s'][tier]:kind==='rail'?'ballistic-rail-cannon':'self-destruct';
    return image('sic-art-'+id+'.webp');
  }
  const fuelCatalog = Object.freeze(Object.fromEntries(['F','D','C','B','A','S'].map((grade,n)=>[grade,Object.freeze({
    name:`Grade ${grade} Fuel Cell`, fuel:true, grade, tier:n, price:[50,100,300,800,2400,5000][n],
    parsecs:[1/3,1,4,12,48,180][n], cardNumber:n<3?`A-${64+n}`:`B-${41+n}`,
    crafting:['Xpidinium, 1 hour','Paradon, 2 hours','Drakkonite, 3 hours','Phazon, 5 hours','Necronium, 8 hours','Endernium, 12 hours'][n],
    image:resourceArt('fuel',n), stations:[], width:0, height:0, energyCost:0,
  })])));
  for(let tier=0;tier<=6;tier++) {
    const suffix=tier===0?'zero':tier===6?'x':String(tier),size=[[1,1],[1,2],[2,2],[2,3],[3,3],[3,4],[4,4]][tier];
    catalog[`warp-drive-${suffix}`]={name:`Warp Drive ${tier===0?'Zero':tier===6?'X':tier}`,label:`WD ${tier===6?'X':tier}`,tier,warp:true,utility:'warp',
      width:size[0],height:size[1],stations:perimeterStations(...size,[1,1,1,1,2,3,3][tier]),color:['#70d6e8','#e0c55f','#85c58b','#e993ae','#98b5fa','#efa16a','#dedee5'][tier],
      price:[500,1750,6000,20000,75000,250000,1000000][tier],energyCost:tier+1,security:tier+1,threshold:12+tier*2,output:0,
      crafting:['Crystilium, 12 hrs','Mirium, 1 day','Drakkonite, 2 days','Carmot, 1 week','Phazon, 2 weeks','Endernium, 1 month','Dark Phazon, 2 months'][tier],
      cardNumber:tier<4?`A-${60+tier}`:`B-${37+tier}`,image:resourceArt('warp',tier),
      warpSecondsPerParsec:[2592000,604800,86400,36000,10800,3600,600][tier],warpRounds:[7,6,5,4,4,4,3][tier],
      warpThrusters:[1,2,2,2,2,3,4][tier],warpFuelGrades:[['F','D','C'],['F','D','C','B'],['F','D','C','B','A'],['F','D','C','B','A','S'],['D','C','B','A','S'],['C','B','A','S'],['B','A','S']][tier],
    };
  }
  catalog['ew-ftl-drive']={name:'EW-FTL Drive',label:'EW-FTL',tier:5.5,warp:true,instantWarp:true,utility:'warp',width:4,height:4,stations:[{x:0,y:0,mesh:4}],color:'#9778c9',price:850000,energyCost:12,security:5,threshold:16,output:0,crafting:'Aethion, 3 weeks',cardNumber:'B-48',image:image('sic-art-ew-ftl-drive.webp'),warpSecondsPerParsec:0,warpRounds:10,warpThrusters:0,warpFuelGrades:['S']};
  catalog['cloaking-device']={name:'Cloaking Device',label:'CLOAK',cloaking:true,skill:'Sensor Systems',utility:'cloaking',width:2,height:2,stations:[{x:0,y:0,mesh:4}],color:'#7563a1',price:185000,energyCost:5,security:4,threshold:20,output:0,crafting:'Infinium, 10 days',cardNumber:'B-61',image:image('sic-art-cloaking-device.webp')};
  for(const type of ['probe-launcher','science-lab','gym','scramble-box','holographic-projector','vulnerability-fortification','power-core-damper','shield-breacher','hacking-bug','warp-bubble-inhibitor',...Array.from({length:5},(_,i)=>'probe-'+(i+1))])catalog[type].image=image('sic-art-'+type+'.webp');
  for(let tier=1;tier<=5;tier++){
    const ext=tier<3?2:3,width=tier<4?1:2;
    const legacyLauncherArt='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 260"><rect x="12" y="12" width="156" height="236" rx="12" fill="#253c43" stroke="#a5bbc2" stroke-width="6"/>${Array.from({length:tier+1},(_,i)=>{const x=48+(i%2)*84,y=45+Math.floor(i/2)*70;return `<circle cx="${x}" cy="${y}" r="26" fill="#081014" stroke="#b89558" stroke-width="5"/><path d="M${x-8} ${y+13}V${y-5}L${x} ${y-18}L${x+8} ${y-5}V${y+13}" fill="#e8edf0"/><path d="M${x-5} ${y+15}v9h10v-9" fill="#ef7950"/>`;}).join('')}<path d="M23 231h134" stroke="#5be7c0" stroke-width="5"/></svg>`);
    const art='sic-art-missile-launcher-'+tier+'.webp';
    catalog[`missile-launcher-${tier}`]={name:`Missile Launcher ${tier}`,label:`ML ${tier}`,tier,weapon:true,weaponFamily:'missile-launcher',missileLauncher:true,requiresLock:true,capacity:[3,5,8,15,25][tier-1],width,height:ext+2,mixed:true,exteriorRows:ext,interiorWidth:1,interiorRows:2,stations:[{x:0,y:ext+1,mesh:7}],output:0,energyCost:1,security:tier,threshold:8+5*tier,price:[3100,4350,5550,6800,8000][tier-1],crafting:['Mirium, 16 hrs','Drakkonite, 10 hrs','Phazon, 16 hrs','Necronium, 1 day','Endernium, 2 days'][tier-1],cardNumber:tier<=3?`A-${111+tier}`:`B-${84+tier}`,color:'#cd9e61',image:image('weapon-room-floor-plan.png'),sprite:art,cardArt:art,damageDie:8,damageCount:2,fireAu:0,destroyedOnImpairment:true};
  }
  catalog['ballistic-rail-cannon']={name:'Ballistic Rail Cannon',label:'RAIL',weapon:true,weaponFamily:'ballistic-rail-cannon',manualOnly:true,noShieldDamage:true,
    tier:1,damageCount:6,damageDie:6,damageBonus:0,energyCost:0,fireAu:0,price:1200,security:2,threshold:18,crafting:'Argol, 6 hrs',cardNumber:'A-119',
    width:1,height:4,mixed:true,exteriorRows:3,interiorRows:1,stations:[],output:0,color:'#bac8d0',image:image('lock-on-1-floor-plan.png'),sprite:resourceArt('rail'),cardArt:resourceArt('rail'),ammoMineral:'Iron',ammoPerShot:1};
  catalog['self-destruct']={name:'Self Destruct',label:'DESTRUCT',utility:'self-destruct',bridgeAddon:true,hullSystem:true,width:0,height:0,stations:[],output:0,
    energyCost:0,price:850,security:5,threshold:null,crafting:'Paradon, 5 hrs',cardNumber:'A-88',color:'#d55d65',image:resourceArt('self-destruct')};

  function resourceCounts(source, names) {
    const values=source&&typeof source==='object'&&!Array.isArray(source)?source:{};
    return Object.fromEntries((names||['Iron',...Object.keys(values).filter(key=>key!=='Iron'&&key.trim()&&!['__proto__','constructor','prototype'].includes(key))]).map(key=>[key,Number.isSafeInteger(values[key])&&values[key]>=0?values[key]:0]));
  }
  for(const [type,name,price,energyCost,security,threshold,card,crafting] of [
    ['manipulation-arm','Manipulation Arm',850,1,3,18,90,'Paradon, 5 hrs'],
    ['tractor-beam','Tractor Beam',5300,2,4,18,91,'Drakkonite, 10 hrs'],
    ['docking-bay','Docking Bay',2000,0,3,18,92,'Endernium, 2 days'],
    ['escape-pods','Escape Pods',300,0,3,10,93,'Ragnaron, 3 hrs'],
    ['ripple-reflector','Ripple Reflector',35000,4,2,20,122,'Phazon, 2 days'],
  ]){
    const mixed=type==='tractor-beam'||type==='manipulation-arm',pod=type==='escape-pods';
    catalog[type]={name,label:name,price,energyCost,security,threshold,crafting,cardNumber:'A-'+card,output:0,
      width:mixed||pod?1:2,height:mixed?5:pod?1:2,mixed,exteriorRows:mixed?3:undefined,interiorRows:mixed?2:undefined,
      edge:type==='ripple-reflector',utility:type,fieldUtility:true,localOnly:pod,color:mixed?'#7cc3aa':pod?'#edb86e':'#a98dc6',
      image:image('sic-art-'+type+'.webp'),sprite:'sic-art-'+type+'.webp',cardArt:'sic-art-'+type+'.webp',stations:pod?[{x:0,y:0,mesh:0},{x:0,y:0,mesh:2},{x:0,y:0,mesh:8}]:[{x:0,y:mixed?4:0,mesh:mixed?7:0}]};
  }
  function bridgeAddonPlacement(ship, cell) {
    return (ship.placements||[]).some(p=>{
      const item=(ship.sicInventory||[]).find(i=>i.id===p.sicId);
      return item&&definition(item.type).bridge&&placementSquares(ship,item,p).includes(cell);
    });
  }
  function definition(type) {
    return catalog[type] || { width: 1, height: 1, label: type || "SIC", color: "#197a6f", image: "", output: 0, stations: [] };
  }

  for(const entry of Object.values(catalog)){
    if(entry.mixed&&entry.weapon&&!entry.manualOnly&&!entry.missileLauncher){entry.image=image(entry.weaponFamily==='ion-pulse-cannon'?'lock-on-1-floor-plan.png':'weapon-room-floor-plan.png');entry.sprite=`${entry.weaponFamily}-tiers.svg#tier-${entry.tier}`;entry.cardArt=entry.sprite;}
    if(entry.darkveil){entry.cardArt=`darkveil-tiers.svg#tier-${entry.tier}`;entry.image=image('darkveil-tiers.svg')+`#tier-${entry.tier}`;}
  }

  for(const entry of Object.values(catalog)){
    const console=entry.shipControl||entry.shield||entry.sensor||entry.weapon||entry.lockOn||entry.utility||entry.hacking;
    if(console&&!entry.exterior&&!entry.bridgeAddon&&entry.width>0&&!entry.stations.length){entry.stations=[{x:0,y:entry.mixed?entry.exteriorRows:0,mesh:4}];entry.fixedStations=true;}
  }

  function componentDefinition(item) {
    const entry = definition(item?.type);
    let { width, height } = entry, stations = entry.stations;
    if(item?.type==='docking-bay'){width=Math.max(2,Math.min(60,Math.floor(Number(item.bayWidth)||2)));height=Math.max(2,Math.min(60,Math.floor(Number(item.bayHeight)||2)));}
    if(entry.mixed){
      let exteriorCells=Array.from({length:entry.exteriorRows},(_,y)=>({x:0,y}));
      const turns=((Math.round(Number(item?.rotation||0)/90)%4)+4)%4;
      for(let i=0;i<turns;i++){const rotate=s=>({...s,x:height-1-s.y,y:s.x,mesh:s.mesh===undefined?undefined:s.mesh%3*3+2-Math.floor(s.mesh/3)});exteriorCells=exteriorCells.map(rotate);stations=stations.map(rotate);[width,height]=[height,width];}
      return {...entry,width,height,stations,exteriorCells};
    }
    if(entry.fixedStations){
      const turns=((Math.round(Number(item?.rotation||0)/90)%4)+4)%4;
      for(let n=0;n<turns;n++){stations=stations.map(s=>({...s,x:height-1-s.y,y:s.x,mesh:s.mesh%3*3+2-Math.floor(s.mesh/3)}));[width,height]=[height,width];}
      return {...entry,width,height,stations};
    }
    // New purchases use corners; old saves retain their station coordinates and occupants.
    if (item?.stationLayout === "corners-v1" && stations.length && !entry.fixedStations && item.type!=='meeting-room') {
      stations = perimeterStations(width, height, stations.length);
    }
    if (Number(item?.rotation) % 180 === 90) {
      stations = stations.map(s => ({ x: height - 1 - s.y, y: s.x, mesh: s.mesh % 3 * 3 + 2 - Math.floor(s.mesh / 3) }));
      [width, height] = [height, width];
    }
    return { ...entry, width, height, stations };
  }

  function gridColumns(record = {}) {
    const ship = record.ship || record;
    return Math.max(20, Math.min(60, Math.round(Number(ship.zoneColumns) || 20)));
  }
  function gridRows(record = {}) {
    const ship = record.ship || record, columns = gridColumns(ship);
    return Math.min(60, Math.max(20, Math.round(Number(ship.zoneRows) || 20), Math.floor(Math.max(0, ...(ship.gridCells || [])) / columns) + 1));
  }
  function gridSides(ship) {
    const columns = gridColumns(ship), rows = gridRows(ship);
    return [
      {name:'top', offset:-columns, valid:n=>n>=columns},
      {name:'right', offset:1, valid:n=>n%columns<columns-1},
      {name:'bottom', offset:columns, valid:n=>n<columns*(rows-1)},
      {name:'left', offset:-1, valid:n=>n%columns>0},
    ];
  }
  function rectangleCells(ship, origin, width, height) {
    const columns = gridColumns(ship), rows = gridRows(ship);
    if (!Number.isInteger(origin) || origin < 0 || origin % columns + width > columns || Math.floor(origin / columns) + height > rows) return [];
    return Array.from({length:width*height}, (_,i)=>origin + Math.floor(i/width)*columns + i%width);
  }
  function outerSpace(ship) {
    const columns=gridColumns(ship),rows=gridRows(ship),hull=new Set([...(ship.gridCells||[]),...triangleCells(ship)]),sides=gridSides(ship),outside=new Set(),queue=[];
    for(let n=0;n<rows*columns;n++) if((n<columns||n>=(rows-1)*columns||n%columns===0||n%columns===columns-1)&&!hull.has(n)){outside.add(n);queue.push(n);}
    for(let i=0;i<queue.length;i++)for(const side of sides){const n=queue[i]+side.offset;if(side.valid(queue[i])&&!hull.has(n)&&!outside.has(n)){outside.add(n);queue.push(n);}}
    return outside;
  }
  function segmentDefinition(item, segment) {
    const entry=definition(item.type);
    let width=segment==='exterior'?(entry.width||1):(entry.interiorWidth||1),height=segment==='exterior'?entry.exteriorRows:(entry.interiorRows||2);
    let stations=segment==='interior'?(entry.stations||[]).map(s=>({...s,y:s.y-entry.exteriorRows})):[];
    const rotation=Number(segment==='exterior'?item.exteriorRotation:item.rotation)||0;
    for(let i=0;i<((rotation/90)%4+4)%4;i++){stations=stations.map(s=>({...s,x:height-1-s.y,y:s.x,mesh:s.mesh%3*3+2-Math.floor(s.mesh/3)}));[width,height]=[height,width];}
    return {...entry,width,height,stations,exterior:segment==='exterior',segment,rotation,exteriorCells:[]};
  }
  function placementParts(item, placement) {
    if(definition(item?.type).addon)return [];
    const data=definition(item?.type);
    if(data.hullSystem)return [];
    if(data.multiMount)return (Array.isArray(placement.mountCells)?placement.mountCells:[]).map(cell=>({cell,entry:componentDefinition(item)}));
    if(definition(item?.type).mixed && Number.isInteger(placement.exteriorCell))return [
      {cell:placement.cell,entry:segmentDefinition(item,'interior')},
      {cell:placement.exteriorCell,entry:segmentDefinition(item,'exterior')},
    ];
    return [{cell:placement.cell,entry:componentDefinition(item)}];
  }
  function placementSquares(ship, item, placement) {
    return placementParts(item,placement).flatMap(part=>rectangleCells(ship,part.cell,part.entry.width,part.entry.height));
  }
  function exteriorPlacement(ship, type, origin, ignoreId = "") {
    const item=(ship.sicInventory||[]).find(i=>i.id===ignoreId),entry=item?componentDefinition(item):definition(type);
    const cells=rectangleCells(ship,origin,entry.width,entry.height),outside=outerSpace(ship),hull=new Set(ship.gridCells||[]),sides=gridSides(ship),occupied=buildLayout(ship).footprint;
    return cells.length===entry.width*entry.height && cells.every(n=>outside.has(n)&&(!occupied.has(n)||occupied.get(n).sicId===ignoreId)) &&
      cells.some(n=>sides.some(side=>side.valid(n)&&hull.has(n+side.offset)));
  }
  function mixedPlacement(ship,item,origin,exteriorCell) {
    const entry=componentDefinition(item);
    if(!entry.mixed)return false;
    const parts=placementParts(item,{cell:origin,exteriorCell}),hull=new Set(ship.gridCells||[]),outside=outerSpace(ship),occupied=buildLayout(ship).footprint;
    const interior=[],exterior=[];
    for(const part of parts){
      const cells=rectangleCells(ship,part.cell,part.entry.width,part.entry.height);
      if(cells.length!==part.entry.width*part.entry.height)return false;
      for(let i=0;i<cells.length;i++){
        const n=cells[i],ext=part.entry.exterior||part.entry.exteriorCells?.some(c=>c.x===i%part.entry.width&&c.y===Math.floor(i/part.entry.width));
        if(ext?!outside.has(n):!hull.has(n))return false;
        if(occupied.has(n)&&occupied.get(n).sicId!==item.id)return false;
        (ext?exterior:interior).push(n);
      }
    }
    const inside=new Set(interior),sides=gridSides(ship);
    return exterior.some(n=>sides.some(side=>side.valid(n)&&inside.has(n+side.offset)));
  }
  function multiMountPlacement(ship,item,cells,complete=true) {
    const count=definition(item?.type).multiMount;
    return Boolean(count&&Array.isArray(cells)&&cells.length>0&&cells.length<=(count)
      &&(!complete||cells.length===count)&&new Set(cells).size===cells.length
      &&cells.every(n=>Number.isInteger(n)&&exteriorPlacement(ship,item.type,n,item.id)));
  }
  function hullSymmetry(record) {
    const ship=record.ship||record,hull=new Set(ship.gridCells||[]),columns=gridColumns(ship);
    if(!hull.size)return {horizontal:false,vertical:false,symmetric:false};
    const xs=[...hull].map(n=>n%columns),ys=[...hull].map(n=>Math.floor(n/columns));
    const xSum=Math.min(...xs)+Math.max(...xs),ySum=Math.min(...ys)+Math.max(...ys);
    const vertical=[...hull].every(n=>hull.has(Math.floor(n/columns)*columns+xSum-n%columns));
    const horizontal=[...hull].every(n=>hull.has((ySum-Math.floor(n/columns))*columns+n%columns));
    return {horizontal,vertical,symmetric:horizontal||vertical};
  }
  function installedItems(record) {
    const ship=record.ship||record,ids=new Set((ship.placements||[]).map(p=>p.sicId));
    return (ship.sicInventory||[]).filter(i=>ids.has(i.id));
  }
  function operational(item) {return !item.disabled&&!['offline','powered-down','destroyed'].includes(item.status);}
  function oxygenEnabled(record) {
    const ship=record?.ship||record||{}, systems=installedItems(ship).filter(i=>i.type==='life-support');
    return ship.oxygenEnabled!==false&&(systems.some(i=>operational(i)&&!i.impaired&&i.status!=='impaired'&&!(i.impairmentPoints>0)));
  }
  function gravityEnabled(record) {
    const ship=record?.ship||record||{},systems=installedItems(ship).filter(i=>i.type==='life-support');
    return ship.gravityEnabled!==false&&(!systems.length||systems.some(i=>operational(i)&&!i.impaired&&i.status!=='impaired'));
  }
  function updateMovementGravity(action,scale) {
    if(action?.kind!=='move'||action.gravityScale===scale)return;
    const previous=action.gravityScale??1,ratio=previous/scale,route=action.routeSegment||[];
    const oldMove=Math.max(0,action.total-(action.doorDelay||0)),step=route.length?oldMove/route.length:oldMove;
    let elapsed=Math.max(0,action.total-action.remaining),adjusted=0;
    // Preserve progress through each door and walking segment when the speed changes.
    for(const point of route.length?route:[{}]){
      const door=point.doorKey? .6:0;
      const wait=Math.min(elapsed,door);adjusted+=wait;elapsed-=wait;
      const walked=Math.min(elapsed,step);adjusted+=walked*ratio;elapsed-=walked;
    }
    action.total=(action.doorDelay||0)+oldMove*ratio;
    action.remaining=Math.max(0,action.total-adjusted);
    action.moveSpeed=Math.max(.1,(Number(action.moveSpeed)||1)/ratio);
    action.gravityScale=scale;
  }
  function capabilities(record) {
    const ship=record.ship||record,items=installedItems(ship),speed=propulsion(ship).moveSpeed,result=[];
    const add=(key,title,detail,available=true)=>result.push({key,title,detail,available});
    const life=items.filter(i=>i.type==='life-support');
    if(items.some(i=>definition(i.type).surveillance))add('surveillance','Ship-wide surveillance','Automatic intruder alerts, door closure and a staffed camera station.',items.some(i=>definition(i.type).surveillance&&operational(i)&&!i.impaired&&!i.impairmentPoints&&i.status!=='impaired'));
    for(const [type,title,detail]of [['tractor-beam','Tractor manipulation','Range 2 units; target hull at most half this ship. Active shields block capture.'],['manipulation-arm','External robotic arm','Manipulates objects in the same space hex.'],['docking-bay','Internal docking','Up to four ships; combined Hull at most half the carrier Hull. Decompression or shield doorway.'],['escape-pods','Emergency evacuation','Three occupants per pod; atmospheric entry, parachutes and a distress beacon.'],['ripple-reflector','Ripple reflection','Returns Ripple attacks at doubled-distance damage reduction.']])if(items.some(i=>i.type===type))add(type,title,detail,items.some(i=>i.type===type&&operational(i)));
    if(life.length){
      add('oxygen','Breathable atmosphere',ship.oxygenEnabled===false?'Oxygen recycling off: check the oxygen countdown.':'Life Support atmospheric recycling system',oxygenEnabled(ship)&&life.some(operational));
      add('gravity','Artificial gravity',gravityEnabled(ship)?'Gravity on': 'Gravity off: movement halved; characters float.',gravityEnabled(ship));
    }
    if(items.some(i=>i.type==='nutritional-supplement'))add('nutrition','On-board food dispenser','Nut Supplement flavor mixer',items.some(i=>i.type==='nutritional-supplement'&&operational(i)));
    for(const kind of ['hover','aerofoil']){
      const item=items.find(i=>definition(i.type).landing===kind);if(!item)continue;
      const def=definition(item.type),placement=(ship.placements||[]).find(p=>p.sicId===item.id);
      const valid=(ship.gridCells||[]).length<=def.hullLimit&&(kind==='hover'?multiMountPlacement(ship,item,placement?.mountCells):hullSymmetry(ship).symmetric);
      add(kind,kind==='hover'?'Vertical planetary landing':'Runway landing',`${speed*(kind==='hover'?10:40)} MPH maximum in atmosphere. ${kind==='hover'?'Four external hover generators.':'Long, flat runway; minimum Move 5 (200 MPH) to land.'}${item.impaired||item.status==='impaired'?' Impaired: atmospheric entry causes 8D10 Heat hull damage (manual roll).':''}`,operational(item)&&valid&&(kind==='hover'||speed>=5));
    }
    if(items.some(i=>definition(i.type).shipAi))add('ai','On-board ship AI','Ship AI system installed',items.some(i=>definition(i.type).shipAi&&operational(i)));
    for(const [type,title,detail]of [['vr-training-room','Virtual training and recreation','Daily crew skill training and custom simulations.'],['medbay','On-board medical treatment','Automatic recovery: 1 HP every 3 seconds; 60-second preparation at 0 HP, five-minute revival deadline.'],['library','Galactic research library','Local database and shared crew research.'],['meeting-room','Crew briefing room','Private planning and shared briefing records.']])if(items.some(i=>i.type===type))add(type,title,detail,items.some(i=>i.type===type&&operational(i)));
    return result;
  }
  function capabilityMarkup(record) {
    const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const entries=capabilities(record);
    return `<h3>Ship Capabilities</h3>${entries.length?`<ul>${entries.map(c=>`<li data-capability="${c.key}" class="${c.available?'available':'unavailable'}"><strong>${escape(c.title)}</strong><span>${escape(c.detail)}</span>${c.available?'':'<b>Unavailable</b>'}</li>`).join('')}</ul>`:'<p>No installed landing or living-support systems.</p>'}`;
  }
  function remapSquare(square, from, to) {
    const x=Number(square)%gridColumns(from)+(Number(to.originX)||0)-(Number(from.originX)||0);
    const y=Math.floor(Number(square)/gridColumns(from))+(Number(to.originY)||0)-(Number(from.originY)||0);
    return y*gridColumns(to)+x;
  }
  function resizeZone(ship, columns, rows, dx=0, dy=0) {
    const next={...ship,zoneColumns:columns,zoneRows:rows,originX:(Number(ship.originX)||0)+dx,originY:(Number(ship.originY)||0)+dy};
    const map=n=>remapSquare(n,ship,next);
    next.gridCells=(ship.gridCells||[]).map(map);next.triangleCells=triangleCells(ship).map(map);
    next.placements=(ship.placements||[]).map(p=>({...p,cell:map(p.cell),...(Number.isInteger(p.exteriorCell)?{exteriorCell:map(p.exteriorCell)}:{}),...(Array.isArray(p.mountCells)?{mountCells:p.mountCells.map(map)}:{})}));
    next.doorStates=Object.fromEntries(Object.entries(ship.doorStates||{}).map(([key,value])=>[key.split(':').map(n=>map(Number(n))).sort((a,b)=>a-b).join(':'),value]));
    return next;
  }
  function walkingMilliseconds(from, to, speed, columns=20) {
    const point=p=>({x:p.square%columns*3+p.mesh%3,y:Math.floor(p.square/columns)*3+Math.floor(p.mesh/3)});
    const a=point(from),b=point(to);
    return Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)*3000/Math.max(.1,Number(speed)||.1));
  }
  function playWalkingAnimation(animation,duration,hasGravity,onWalking,control) {
    return new Promise(resolve=>{
      let remaining=duration,last=performance.now(),rate=hasGravity()?1:.5,timer,interval,done=false;
      animation.playbackRate=rate;onWalking(rate===1);
      const finish=()=>{if(done)return;done=true;clearTimeout(timer);clearInterval(interval);onWalking(false);resolve();};
      const tick=()=>{
        const now=performance.now();remaining-=Math.max(0,now-last)*rate;last=now;
        control?.onProgress?.(Math.max(0,Math.min(1,1-remaining/duration)));
        if(control?.cancelled){animation.cancel();finish();return;}
        if(remaining<=0){finish();return;}
        const next=hasGravity()?1:.5;
        if(next!==rate){rate=next;animation.updatePlaybackRate(rate);onWalking(rate===1);}
        // Off-screen iframe painting must not keep a completed game move pending.
        clearTimeout(timer);timer=setTimeout(finish,remaining/rate+30);
      };
      tick();if(!done)interval=setInterval(tick,200);
      animation.finished.then(finish,finish);
    });
  }

  function propulsion(record) {
    const ship = record.ship || record, count = new Set(ship.gridCells || []).size;
    const limits = [4,5,6,7,8,9,10,11,12,13,14,16,18,20,23,26,30,34,40,50,70,90,100,120,150,200,250,300,350,400];
    const index = limits.findIndex(limit => count <= limit);
    const hsm = count < 4 ? 0 : index < 0 ? -10 - Math.floor((count - 401) / 50) : 20 - index;
    const inventory = new Map((ship.sicInventory || []).map(item => [item.id, item]));
    const thrusters = (ship.placements || []).map(p => ({ item: inventory.get(p.sicId), p })).filter(({item,p}) => item && definition(item.type).thruster && !item.disabled && !["destroyed","offline","powered-down"].includes(item.status) && exteriorPlacement(ship,item.type,p.cell,item.id)).slice(0,4);
    const impulses = thrusters.map(({item}) => Math.trunc(hsm / 2) + definition(item.type).impulseBonus);
    const rawSpeed = impulses.reduce((a,b) => a+b,0), moveSpeed = Math.max(0,rawSpeed);
    return { hsm, impulses, rawSpeed, moveSpeed, exhaust: thrusters.reduce((n,{item}) => n + definition(item.type).exhaust,0), evadeCount: thrusters.filter(({item}) => !item.impaired && item.status !== "impaired").length, evadeDie: moveSpeed < 4 ? 4 : moveSpeed < 8 ? 6 : moveSpeed < 12 ? 8 : moveSpeed < 16 ? 10 : 12 };
  }

  function exteriorError(ship = {}) {
    ship ||= {};
    if (['gridCells','sicInventory','placements'].some(key => ship[key] !== undefined && !Array.isArray(ship[key]))) return "Invalid starship construction data.";
    if ((ship.sicInventory || []).some(item => !item || typeof item !== 'object') || (ship.placements || []).some(item => !item || typeof item !== 'object')) return "Invalid starship component data.";
    const triangleIssue=triangleError(ship);if(triangleIssue)return triangleIssue;
    const inventory = ship.sicInventory || [];
    const installed = new Set((ship.placements || []).map(p => p.sicId));
    if(installed.size!==(ship.placements||[]).length)return 'Each SIC may be installed only once; Hover stores its four mounts together.';
    if (inventory.filter(item => installed.has(item.id) && definition(item.type).bridge).length > 1) return "A ship may have only one Bridge or Cockpit.";
    if (inventory.filter(item => installed.has(item.id) && definition(item.type).sensor).length > 1) return "A ship may have only one installed Sensor system.";
    if (inventory.filter(item => installed.has(item.id) && definition(item.type).darkveil).length > 1) return "A ship may have only one installed Darkveil.";
    if (inventory.filter(item => installed.has(item.id) && definition(item.type).shipAi).length > 1) return "A ship may have only one Ship AI per bridge.";
    if (inventory.filter(item => installed.has(item.id) && definition(item.type).thruster).length > 4) return "A ship may have at most four installed thrusters.";
    const engines=(ship.placements||[]).map(p=>({p,item:inventory.find(i=>i.id===p.sicId)})).filter(e=>e.item&&definition(e.item.type).engine);
    for(let a=0;a<engines.length;a++)for(let b=a+1;b<engines.length;b++){
      const left=engines[a],right=engines[b];
      if(left.item.type!=='backup-generator'&&right.item.type!=='backup-generator'&&!attachments(ship,left.item.id,'power-core-damper').length&&!attachments(ship,right.item.id,'power-core-damper').length)continue;
      const ld=componentDefinition(left.item),rd=componentDefinition(right.item),columns=gridColumns(ship),gap=Math.max(engineClearance(ship,left.item),engineClearance(ship,right.item));
      const lc=rectangleCells(ship,left.p.cell,ld.width,ld.height),rc=rectangleCells(ship,right.p.cell,rd.width,rd.height);
      if(lc.some(x=>rc.some(y=>Math.abs(Math.floor(x/columns)-Math.floor(y/columns))+Math.abs(x%columns-y%columns)<=gap)))return `Engines require ${gap} clear grid square${gap===1?'':'s'} between them.`;
    }
    for (const p of ship.placements || []) {
      const item = inventory.find(item => item.id === p.sicId);
      const data=definition(item?.type);
      if(data.probeLauncher&&(ship.sicInventory||[]).filter(i=>definition(i.type).probe&&i.attachTo===item.id&&!i.storage&&!i.pendingDisposition&&i.status!=='destroyed'&&(ship.placements||[]).some(p=>p.sicId===i.id)).length>4)return 'A Probe Launcher holds at most four probes.';
      if(data.addon){const host=addonHost(ship,item);if(!host||host.placement.cell!==p.cell)return `${data.name} must be attached to an installed ${data.addon==='any'?'SIC with a damage threshold':data.addon}.`;if(item.type==='power-core-damper'&&attachments(ship,item.attachTo,item.type).length>1)return 'Only one Power Core Damper per Engine.';continue;}
      if(data.bridgeAddon){
        if(!bridgeAddonPlacement(ship,p.cell))return `${data.name} must be installed on a Bridge or Cockpit.`;
        continue;
      }
      if(item?.type==='scramble-box'&&(ship.placements||[]).some(other=>other.sicId!==p.sicId&&inventory.find(i=>i.id===other.sicId)?.type==='scramble-box'&&Math.abs(other.cell%gridColumns(ship)-p.cell%gridColumns(ship))+Math.abs(Math.floor(other.cell/gridColumns(ship))-Math.floor(p.cell/gridColumns(ship)))===1))return 'Scramble Boxes cannot be adjacent to one another.';
      if(data.landing){
        if(inventory.filter(i=>installed.has(i.id)&&i.type===item.type).length>1)return `Only one ${data.name} may be installed.`;
        if((ship.gridCells||[]).length>data.hullLimit)return `${data.name} supports at most ${data.hullLimit} hull squares.`;
        if(data.hullSystem&&!hullSymmetry(ship).symmetric)return 'Decent (Aerofoil) requires a horizontally or vertically symmetrical hull.';
        if(data.multiMount&&!multiMountPlacement(ship,item,p.mountCells))return 'Decent (Hover) requires four separate exterior mounts, each attached to the hull.';
        if(data.hullSystem||data.multiMount)continue;
      }
      if(item&&definition(item.type).mixed&&!mixedPlacement(ship,item,p.cell,p.exteriorCell))return `${definition(item.type).name} needs its control room inside the hull and its barrel outside an outer wall.`;
      if (item && definition(item.type).edge && !componentAtEdge(ship, p.cell, item)) return `${definition(item.type).name} must be inside the ship, against an outer hull wall.`;
      if (item && definition(item.type).exterior && !exteriorPlacement(ship, item.type, p.cell, item.id)) return "Exterior SICs must attach to an outer hull wall, outside the ship and clear of other SICs.";
    }
    return "";
  }

  function edgePlacement(ship, cell) {
    const SIDES=gridSides(ship);
    const hull = new Set(ship.gridCells || []);
    if (!Number.isInteger(cell) || !hull.has(cell)) return false;
    const queue = SIDES.filter(s => !s.valid(cell) || !hull.has(cell+s.offset));
    if (queue.some(s=>!s.valid(cell))) return true;
    const frontier = queue.map(s=>cell+s.offset), seen = new Set(frontier);
    for (let i=0;i<frontier.length;i++) for (const side of SIDES) {
      const current=frontier[i], next=current+side.offset;
      if (!side.valid(current)) return true;
      if (!hull.has(next) && !seen.has(next)) {seen.add(next);frontier.push(next);}
    }
    return false;
  }

  function componentAtEdge(ship, origin, item) {
    const {width,height}=componentDefinition(item),cells=rectangleCells(ship,origin,width,height),hull=new Set(ship.gridCells||[]);
    return cells.length===width*height && cells.every(n=>hull.has(n)) && cells.some(n=>edgePlacement(ship,n));
  }

  function sensorStats(record) {
    const ship = record.ship || record, ids = new Set((ship.placements || []).map(p => p.sicId));
    const item = (ship.sicInventory || []).find(i => ids.has(i.id) && definition(i.type).sensor && !i.disabled && !['disabled','offline','powered-down','destroyed'].includes(i.status));
    if (!item) return {range:0,diceCount:0,die:0,dice:[]};
    const def = definition(item.type), impaired = item.impaired || item.status === 'impaired' || item.impairmentPoints>0;
    const antennas=(ship.sicInventory||[]).filter(i=>ids.has(i.id)&&definition(i.type).antenna&&!i.disabled&&!['disabled','offline','powered-down','destroyed'].includes(i.status));
    const dice=[...Array(def.diceCount).fill(impaired?def.impairedDie:def.die),...antennas.map(i=>{const d=definition(i.type);return i.impaired||i.status==='impaired'||i.impairmentPoints>0?d.impairedDie:d.bonusDie;})];
    return {range:(impaired?def.impairedRange:def.range)+antennas.reduce((sum,i)=>sum+definition(i.type).rangeBonus,0),diceCount:dice.length,die:dice[0],dice};
  }
  function firewallStats(record) {
    const ship=record.ship||record,ids=new Set((ship.placements||[]).map(p=>p.sicId));
    return Math.max(0,...(ship.sicInventory||[]).filter(i=>ids.has(i.id)&&!i.disabled&&!['offline','powered-down','destroyed'].includes(i.status)).map(i=>Math.max(0,(definition(i.type).firewall||0)-Math.max(0,Number(i.impairmentPoints)||(i.impaired||i.status==='impaired'?1:0)))));
  }

  function cloaked(record) {
    const ship=record.ship||record, id=ship.cloakState?.sicId;
    return Boolean(ship.cloakState?.active&&installedItems(ship).some(i=>i.id===id&&definition(i.type).cloaking&&operational(i)&&!i.impaired&&!i.impairmentPoints&&i.status!=='impaired'));
  }
  function scaleRank(record) { const n=(record.ship||record).gridCells?.length||record.size||0;return n<=26?1:n<=50?2:n<=100?3:n<=200?4:5; }
  function shipHeading(record){const d=record.navigation?.direction;if(d&&Number.isFinite(d.q)&&Number.isFinite(d.r)&&(d.q||d.r))return Math.atan2(1.5*d.r,Math.sqrt(3)*(d.q+d.r/2))*180/Math.PI+90;return Number(record.mapHeading??record.ship?.mapHeading)||0;}
  function shipColor(record) {const color=record.mapColor||record.ship?.mapColor;if(/^#[0-9a-f]{6}$/i.test(color||''))return color;const palette=['#65cbea','#ffa66b','#b29cff','#7ce0a0','#f38cbd','#f4db79'];let hash=0;for(const c of String(record.id||record.title||''))hash=(hash*31+c.charCodeAt(0))>>>0;return palette[hash%palette.length];}
  function masking(record) {
    if((record.ship||record).cleanserState?.phase==='charging')return 0;
    const ship = record.ship || record, installed = new Set((ship.placements || []).map(p => p.sicId));
    const darkveils=(ship.sicInventory || []).filter(item => installed.has(item.id) && definition(item.type).darkveil && !item.disabled && !["destroyed", "offline", "powered-down"].includes(item.status));
    const darkveil = darkveils.length?Math.max(...darkveils.map(item=>Number(definition(item.type).darkveil)-5*Math.max(Number(item.impairmentPoints)||0,item.impaired||item.status==='impaired'?1:0))):0;
    const stats = propulsion(record);
    return stats.hsm + stats.exhaust + darkveil + (cloaked(record)?25:0);
  }

  function floorplanStyle(type, column = 0, row = 0, cell=null) {
    const entry = cell||definition(type);
    if (!entry.image) return "";
    const x = entry.width === 1 ? 50 : (Number(column) / (entry.width - 1)) * 100;
    const y = entry.height === 1 ? 50 : (Number(row) / (entry.height - 1)) * 100;
    return `background-image:url('${entry.image}');background-size:${entry.width * 100}% ${entry.height * 100}%;background-position:${x}% ${y}%;background-repeat:no-repeat`;
  }

  function exteriorFacing(layout, square) {
    const SIDES=layout.sides;
    // The mount faces the neighboring hull; the exhaust points the opposite way.
    const sic = layout.footprint.get(square);
    const cells = sic ? [...layout.footprint].filter(([, other]) => other.sicId === sic.sicId&&other.exterior).map(([cell]) => cell) : [square];
    const side = SIDES.map(side => ({ ...side, contacts: cells.filter(cell => side.valid(cell) && layout.hull.has(cell + side.offset)).length }))
      .sort((a, b) => b.contacts - a.contacts).find(side => side.contacts);
    return { top: 0, right: 90, bottom: 180, left: 270 }[side?.name] ?? 0;
  }

  // Opaque sprite bounds measured from source artwork, not collision footprints.
  const exteriorArtBounds = {
  "exhaust-thruster-1": [
    1,
    0.20096,
    0.05024,
    0.79984,
    0.95534
  ],
  "exhaust-thruster-2": [
    2,
    0.02029,
    0.05524,
    0.98027,
    0.93912
  ],
  "exhaust-thruster-3": [
    1.5,
    0.01172,
    0.0127,
    0.98828,
    0.95605
  ],
  "exhaust-thruster-4": [
    1.5,
    0.05794,
    0.05176,
    0.94271,
    0.91406
  ],
  "exhaust-thruster-5": [
    2,
    0.06652,
    0.0124,
    0.93348,
    0.97069
  ],
  "ionic-pulse-thruster-1": [
    1,
    0.08134,
    0.05821,
    0.91946,
    0.93301
  ],
  "ionic-pulse-thruster-2": [
    2,
    0.00846,
    0.12401,
    0.99154,
    0.82864
  ],
  "ionic-pulse-thruster-3": [
    1.5,
    0.01693,
    0.0918,
    0.98372,
    0.8291
  ],
  "ionic-pulse-thruster-4": [
    1.5,
    0.01237,
    0.13086,
    0.98763,
    0.86035
  ],
  "ionic-pulse-thruster-5": [
    2,
    0.00789,
    0.08568,
    0.99267,
    0.8726
  ],
  "rapid-laser-1": [
    1,
    0.26954,
    0.07576,
    0.73046,
    0.90112
  ],
  "rapid-laser-2": [
    1,
    0.19458,
    0.05024,
    0.80463,
    0.94577
  ],
  "rapid-laser-3": [
    0.5,
    0.15558,
    0.03157,
    0.84442,
    0.9549
  ],
  "rapid-laser-4": [
    0.5,
    0.08568,
    0.04735,
    0.91545,
    0.90755
  ],
  "rapid-laser-5": [
    0.5,
    0.05524,
    0.0451,
    0.94589,
    0.90304
  ],
  "beam-laser-1": [
    0.75,
    0.29688,
    0.09375,
    0.70833,
    0.90234
  ],
  "beam-laser-2": [
    0.75,
    0.26042,
    0.10352,
    0.74479,
    0.90234
  ],
  "beam-laser-3": [
    0.75,
    0.27604,
    0.05664,
    0.72656,
    0.92188
  ],
  "beam-laser-4": [
    0.75,
    0.21615,
    0.05469,
    0.79167,
    0.91406
  ],
  "beam-laser-5": [
    0.75,
    0.21094,
    0.03516,
    0.79167,
    0.88477
  ],
  "beam-laser-6": [
    0.75,
    0.1224,
    0.01758,
    0.88021,
    0.88867
  ],
  "beam-laser-7": [
    0.75,
    0.21354,
    0.02148,
    0.78906,
    0.90625
  ],
  "beam-laser-8": [
    0.75,
    0.10417,
    0.04492,
    0.90104,
    0.87695
  ],
  "ripple-cannon-1": [
    0.75,
    0.2474,
    0.20508,
    0.81771,
    0.85352
  ],
  "ripple-cannon-2": [
    0.75,
    0.21094,
    0.16602,
    0.79167,
    0.86328
  ],
  "ripple-cannon-3": [
    0.75,
    0.24219,
    0.08594,
    0.7526,
    0.90234
  ],
  "ripple-cannon-4": [
    0.75,
    0.15625,
    0.16602,
    0.79948,
    0.89258
  ],
  "ripple-cannon-5": [
    0.75,
    0.21094,
    0.04297,
    0.85156,
    0.89258
  ],
  "ripple-cannon-6": [
    0.75,
    0.19271,
    0.05859,
    0.8125,
    0.88867
  ],
  "ripple-cannon-7": [
    0.75,
    0.08854,
    0.08594,
    0.90625,
    0.87891
  ],
  "ripple-cannon-8": [
    0.75,
    0.07552,
    0.08594,
    0.88021,
    0.87891
  ],
  "ion-pulse-cannon-1": [
    0.6,
    0.07366,
    0.07873,
    0.7988,
    0.86878
  ],
  "ion-pulse-cannon-2": [
    0.6,
    0.04834,
    0.08011,
    1.00138,
    0.91575
  ],
  "ion-pulse-cannon-3": [
    0.6,
    0,
    0.0511,
    0.99908,
    0.93785
  ],
  "ion-pulse-cannon-4": [
    0.6,
    0,
    0.05387,
    1.00138,
    0.9268
  ],
  "ion-pulse-cannon-5": [
    0.6,
    0,
    0.02762,
    0.93692,
    0.96685
  ]
};
  for(let tier=1;tier<=4;tier++)exteriorArtBounds['antenna-'+tier]=[.5,0,0,1,1];
  function exteriorShift(sic, angle, facing, lowResolution=false) {
    const data=definition(sic.type),[aspect,x0,y0,x1,y1]=exteriorArtBounds[sic.type]||[1,0,0,1,1];
    const sideways=angle%180!==0,w=sideways?sic.height:sic.width,h=sideways?sic.width:sic.height;
    let box;
    if(data.thruster)box=lowResolution?[.08*w,0,.92*w,.7*h]:[(.08+.84*x0)*w,(-.02+.76*y0)*h,(.08+.84*x1)*w,(-.02+.76*y1)*h];
    else { const iw=Math.min(w,h*aspect),ih=iw/aspect;box=[(w-iw)/2+iw*x0,(h-ih)/2+ih*y0,(w-iw)/2+iw*x1,(h-ih)/2+ih*y1]; }
    const radians=(angle+(data.weapon?180:0))*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
    const corners=[[box[0],box[1]],[box[2],box[1]],[box[0],box[3]],[box[2],box[3]]].map(([x,y])=>[sic.width/2+(x-w/2)*c-(y-h/2)*s,sic.height/2+(x-w/2)*s+(y-h/2)*c]);
    const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),overlap=.025;
    const dx=facing===90?sic.width-Math.max(...xs)+overlap:facing===270?-Math.min(...xs)-overlap:0;
    const dy=facing===180?sic.height-Math.max(...ys)+overlap:facing===0?-Math.min(...ys)-overlap:0;
    return [100*dx/sic.width,100*dy/sic.height];
  }
  function impairmentMarkup(cell) {
    if(!cell)return '';
    const points=Math.min(4,Math.max(Number(cell.item.impairmentPoints)||0,cell.item.impaired||cell.item.status==='impaired'?1:0));
    if(!points&&cell.item.status!=='destroyed')return '';
    const destroyed=points>=4||cell.item.status==='destroyed';
    return `<span class="sa-sic-impairment ${destroyed?'is-destroyed':''}" data-impairments="${points}" style="--impairment-period:${[0,2.8,1.8,1][Math.min(points,3)]||1}s" role="img" aria-label="${destroyed?'Destroyed SIC':points+' SIC impairment'+(points===1?'':'s')}"></span>`;
  }
  function roomOxygen(record,square){const ship=record.ship||record,value=ship.atmosphereState?.cells?.[square];return Number.isFinite(value)?Math.max(0,Math.min(100,value)):100;}
  const atmosphereLabels=new WeakMap();
  function atmosphereMarkup(layout,square){
    const cell=layout.footprint.get(square),oxygen=roomOxygen(layout.ship,square),pct=Math.ceil(oxygen-1e-7),fog=Math.min(.8,(100-oxygen)/100*.8);
    if(!atmosphereLabels.has(layout)){const labels=new Set(),seen=new Set();atmosphereLabels.set(layout,labels);for(const start of layout.hull){if(layout.footprint.has(start)||seen.has(start))continue;const queue=[start];seen.add(start);for(let n=0;n<queue.length;n++)for(const side of layout.sides){const next=queue[n]+side.offset;if(side.valid(queue[n])&&layout.hull.has(next)&&!layout.footprint.has(next)&&!seen.has(next)){seen.add(next);queue.push(next);}}const row=Math.max(...queue.map(k=>Math.floor(k/layout.columns))),bottom=queue.filter(k=>Math.floor(k/layout.columns)===row).sort((a,b)=>a-b);labels.add(bottom[Math.floor((bottom.length-1)/2)]);}}

    return `<span class="sa-room-fog" style="opacity:${fog}" aria-hidden="true"></span>${(cell?cell.offset===0:atmosphereLabels.get(layout).has(square))?`<small class="sa-room-oxygen ${pct<=10?'is-critical':''}" style="left:${(cell?.width||1)*50}%;top:calc(${(cell?.height||1)*100}% - var(--oxygen-lift,2px))" data-room-height="${cell?.height||1}">O₂ ${pct}%</small>`:''}`;
  }
  function dockedMarkup(layout,cell){
    if(cell?.type!=='docking-bay'||cell.offset!==0)return '';
    const ships=layout.ship.fieldState?.systems?.[cell.sicId]?.dockedShips||[];
    return `<span class="sa-bay-ships" style="width:${cell.width*100}%;height:${cell.height*100}%">${ships.slice(0,4).map((ship,i)=>`<img src="sic-art-starship-rank-${Math.max(1,Math.min(5,Number(ship.rank)||1))}.webp" alt="Docked starship" style="left:${25+i%2*50}%;top:${25+Math.floor(i/2)*50}%;filter:drop-shadow(0 0 3px ${shipColor(ship)})">`).join('')}</span>`;
  }
  function surfaceMarkup(layout, square) {
    const triangle=triangleMarkup(layout.ship,square);if(triangle)return triangle;
    const SIDES=layout.sides,columns=layout.columns;
    if (layout.hull.has(square)) {
      const edges = SIDES.filter(side => !side.valid(square) || !layout.hull.has(square + side.offset)).map(side => `edge-${side.name}`).join(" ");
      const cell=layout.footprint.get(square),def=cell&&definition(cell.type);
      const canopy=def?.bridge?`<span class="sa-bridge-window" style="background-image:url('${def.image}');background-size:${cell.width*100}% ${cell.height*100}%;background-position:${cell.width>1?cell.column/(cell.width-1)*100:0}% ${cell.height>1?cell.row/(cell.height-1)*100:0}%"></span>`:'';
      const offline=cell&&(cell.item.disabled||['offline','powered-down','destroyed'].includes(cell.item.status));
      const status=offline?`<span class="sa-offline-shade"></span>${cell.offset===0?`<span class="sa-reboot-status">${cell.item.bootRemaining>0?`Restart ${Math.ceil(cell.item.bootRemaining)}s`:'OFFLINE'}</span>`:''}`:'';
      const rotated=Number(cell?.item.rotation||0)%180!==0;
      const room=def?.mixed&&cell.offset===0?`<span class="sa-mixed-room-art" style="width:${cell.width*100}%;height:${cell.height*100}%" aria-hidden="true"><img src="${def.image}" alt="" draggable="false" style="width:${rotated?cell.height/cell.width*100:100}%;height:${rotated?cell.width/cell.height*100:100}%;transform:translate(-50%,-50%) rotate(${Number(cell.item.rotation||0)}deg)"></span>`:'';
      return `${room}${atmosphereMarkup(layout,square)}${dockedMarkup(layout,cell)}${status}${impairmentMarkup(cell)}${cell?.blocked?'<span class="sa-blocked-floor" aria-hidden="true"></span>':''}<span class="sa-hull-plate ${edges}${layout.aerofoil?' sa-aerofoil-plate':''}" style="--plate-x:${square % columns % 2 * 100}%;--plate-y:${Math.floor(square / columns) % 2 * 100}%" aria-hidden="true">${canopy}</span>`;
    }
    let sic = layout.footprint.get(square);
    if (!sic?.exterior) return "";
    const mount=impairmentMarkup(sic);
    if(definition(sic.type).mixed&&!sic.segment){const entry=componentDefinition(sic.item),xs=entry.exteriorCells.map(c=>c.x),ys=entry.exteriorCells.map(c=>c.y),minX=Math.min(...xs),minY=Math.min(...ys);if(sic.column!==minX||sic.row!==minY)return mount+'<span class="sa-exterior-tile" aria-hidden="true"></span>';sic={...sic,width:Math.max(...xs)-minX+1,height:Math.max(...ys)-minY+1,offset:0};}
    if (sic.offset) return mount+'<span class="sa-exterior-tile" aria-hidden="true"></span>';
    const data = definition(sic.type), angle = sic.segment==="exterior"?(Number(sic.rotation)+180)%360:data.weapon&&Number.isFinite(sic.item.weaponFacing)?(sic.item.weaponFacing+180)%360:data.thruster&&layout.thrusterDirection!==null?layout.thrusterDirection:exteriorFacing(layout, square), sideways = angle % 180 !== 0;
    const active = !sic.item.disabled && !["destroyed", "offline", "powered-down"].includes(sic.item.status);
    const facing=exteriorFacing(layout,square),shift=exteriorShift(sic,angle,facing),low=exteriorShift(sic,angle,facing,true);
    const shiftStyle=`--art-shift-x:${shift[0]}%;--art-shift-y:${shift[1]}%;--shape-shift-x:${low[0]}%;--shape-shift-y:${low[1]}%;`;
    if(data.multiMount)return mount+`<span class="sa-hover-pod ${active?'online':''}" aria-hidden="true"><img src="${data.sprite}" alt="" draggable="false"><i></i></span>`;
    if (data.weapon||data.fieldUtility) return mount+`<span class="sa-exterior-weapon" style="${shiftStyle}position:absolute;left:0;top:0;width:${sic.width*100}%;height:${sic.height*100}%;opacity:${active ? 1 : .35}" aria-hidden="true"><span style="position:absolute;left:50%;top:50%;width:${sideways?sic.height/sic.width*100:100}%;height:${sideways?sic.width/sic.height*100:100}%;transform:translate(-50%,-50%) rotate(${angle+180}deg)"><img src="${data.sprite}" style="width:100%;height:100%;object-fit:contain" alt="" draggable="false"><i class="sa-weapon-silhouette" style="--weapon-color:${data.color};--weapon-mask:url('${data.sprite}')"></i></span></span>`;
    const jetClass = data.ionic ? "sa-ion-pulse" : "sa-thruster-flame";
    // Emission points are measured in the sprite frame, then transformed with the complete assembly.
    const jets = (data.emitters || []).map(([x,y,width], index) => `<i class="${jetClass}" style="left:${8 + .84 * (x - width / 2)}%;top:${-2 + .76 * y}%;width:${.84 * width}%;animation-delay:${index * -.8}s"></i>`).join("");
    return mount+`<span class="sa-exterior-thruster ${active ? "is-firing" : ""}" style="${shiftStyle}width:${sic.width * 100}%;height:${sic.height * 100}%;--thruster-angle:${angle}deg;--assembly-width:${sideways ? sic.height / sic.width * 100 : 100}%;--assembly-height:${sideways ? sic.width / sic.height * 100 : 100}%;--exhaust-color:${data.color}" aria-hidden="true"><span class="sa-thruster-assembly"><i class="sa-thruster-body"></i><img src="${data.sprite}" alt="" draggable="false">${jets}</span></span>`;
  }

  const VIEW_LABELS = Object.freeze({ labels: "Labels", highResolution: "High Res", combatMesh: "Combat Mesh", walls: "Walls", stations: "Stations", hull: "Hull" });
  function viewDisabled(view, key) { return Boolean(view.hull && ["combatMesh", "walls", "stations"].includes(key)); }
  function viewControls(view, attribute) {
    return Object.entries(VIEW_LABELS).map(([key, label]) => `<label><input type="checkbox" ${attribute}="${key}" ${view[key] && !viewDisabled(view, key) ? "checked" : ""} ${viewDisabled(view, key) ? "disabled" : ""}> <span>${label}</span></label>`).join("");
  }

  function doorKey(first, second) {
    return [Number(first), Number(second)].sort((a, b) => a - b).join(":");
  }

  function blocksMovement(type, width, height, column, row) {
    if (!definition(type).engine || width < 3 || height < 3) return false;
    const centerColumns = width % 2 ? [Math.floor(width / 2)] : [width / 2 - 1, width / 2];
    const centerRows = height % 2 ? [Math.floor(height / 2)] : [height / 2 - 1, height / 2];
    return centerColumns.includes(column) && centerRows.includes(row);
  }

  function buildLayout(ship = {}) {
    const GRID_SIZE=gridColumns(ship),SIDES=gridSides(ship);
    const hull = new Set(Array.isArray(ship.gridCells) ? ship.gridCells.map(Number) : []);
    const inventory = new Map((ship.sicInventory || []).map((item) => [item.id, item]));
    const footprint = new Map();
    for (const placement of ship.placements || []) {
      const item = inventory.get(placement.sicId);
      const type = item?.type || "";
      for(const part of placementParts(item,placement)) {
      const entry = part.entry;
      const origin = Number(part.cell);
      const originRow = Math.floor(origin / GRID_SIZE);
      const originColumn = origin % GRID_SIZE;
      for (let row = 0; row < entry.height; row += 1) for (let column = 0; column < entry.width; column += 1) {
        const square = (originRow + row) * GRID_SIZE + originColumn + column;
        const label=entry.name||type.replace(/^en-engine/,'Power Engine').replace(/^au-engine/,'Action Engine').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
        const exterior=Boolean(entry.exterior)||Boolean(entry.exteriorCells?.some(c=>c.x===column&&c.y===row));
        footprint.set(square, { segment:entry.segment, rotation:entry.rotation, placement, item, sicId: placement.sicId, type, exterior, width: entry.width, height: entry.height, label, color: entry.color, image: entry.segment==="interior"?"":entry.image, stations: entry.stations || [], offset: row * entry.width + column, row, column, blocked: exterior || blocksMovement(type, entry.width, entry.height, column, row) });
      }
      // Interior room coordinates stay independent from the exterior barrel footprint.
      if(entry.mixed&&!entry.segment){
        const inside=[...footprint.values()].filter(c=>c.sicId===item.id&&!c.exterior),minX=Math.min(...inside.map(c=>c.column)),minY=Math.min(...inside.map(c=>c.row)),width=Math.max(...inside.map(c=>c.column))-minX+1,height=Math.max(...inside.map(c=>c.row))-minY+1;
        for(const cell of inside){cell.image='';cell.width=width;cell.height=height;cell.column-=minX;cell.row-=minY;cell.offset=cell.row*width+cell.column;cell.stations=entry.stations.map(s=>({...s,x:s.x-minX,y:s.y-minY}));}
      }
    }

    }
    const bestConnections = new Map();
    for (const [square, current] of footprint) {
      for (const side of SIDES.filter((entry) => entry.name === "right" || entry.name === "bottom")) {
        if (!side.valid(square)) continue;
        const adjacent = square + side.offset;
        const other = footprint.get(adjacent);
        if (!other || current.exterior || other.exterior || other.sicId === current.sicId) continue;
        const currentCross = side.name === "right" ? current.row : current.column;
        const otherCross = side.name === "right" ? other.row : other.column;
        const currentSize = side.name === "right" ? current.height : current.width;
        const otherSize = side.name === "right" ? other.height : other.width;
        const stationPenalty = room => room.stations.some(s => s.x === room.column && s.y === room.row) ? 10 : 0;
        const score = Math.abs(currentCross - (currentSize - 1) / 2) + Math.abs(otherCross - (otherSize - 1) / 2) + stationPenalty(current) + stationPenalty(other);
        const pair = [current.sicId, other.sicId].sort().join(":");
        const key = doorKey(square, adjacent);
        const previous = bestConnections.get(pair);
        if (!previous || score < previous.score || (score === previous.score && key < previous.key)) bestConnections.set(pair, { key, score });
      }
    }
    const connectionDoors = new Set([...bestConnections.values()].map((entry) => entry.key));
    const hallwayDoors = new Map();
    for (const [square, room] of footprint) {
      if (room.exterior) continue;
      for (const side of SIDES) {
        const adjacent = square + side.offset;
        if (!side.valid(square) || !hull.has(adjacent) || footprint.has(adjacent)) continue;
        const horizontal = side.name === "top" || side.name === "bottom";
        const cross = horizontal ? room.column : room.row, size = horizontal ? room.width : room.height;
        const station = room.stations.some(s => s.x === room.column && s.y === room.row);
        const score = Math.abs(cross - (size - 1) / 2) + (station ? 10 : 0);
        const group = `${room.sicId}:${side.name}`, previous = hallwayDoors.get(group);
        if (!previous || score < previous.score) hallwayDoors.set(group, { square, score });
      }
    }

    function boundary(square, sideName) {
      if (!hull.has(Number(square))) return { kind: "none", side: sideName, key: "" };
      const side = SIDES.find((entry) => entry.name === sideName);
      if (!side) return { kind: "none", side: sideName, key: "" };
      const adjacent = Number(square) + side.offset;
      if (!side.valid(Number(square)) || !hull.has(adjacent)) return { kind: "wall", side: sideName, key: "" };
      const current = footprint.get(Number(square));
      const other = footprint.get(adjacent);
      if (!current || current.sicId === other?.sicId) return { kind: "none", side: sideName, key: "" };
      if (other) {
        if (Number(square) > adjacent) return { kind: "none", side: sideName, key: "" };
        const key = doorKey(square, adjacent);
        return { kind: connectionDoors.has(key) ? "door" : "wall", side: sideName, key };
      }
      const centered = hallwayDoors.get(`${current.sicId}:${sideName}`)?.square === Number(square);
      return { kind: centered ? "door" : "wall", side: sideName, key: centered ? doorKey(square, adjacent) : "" };
    }

    function edge(first, second) {
      const difference = Number(second) - Number(first);
      if (Math.abs(difference) === 1 && Math.floor(Number(first) / GRID_SIZE) === Math.floor(Number(second) / GRID_SIZE)) {
        const left = Math.min(Number(first), Number(second));
        const fromLeft = boundary(left, "right");
        return fromLeft.kind === "none" ? boundary(left + 1, "left") : fromLeft;
      }
      if (Math.abs(difference) === GRID_SIZE) {
        const top = Math.min(Number(first), Number(second));
        const fromTop = boundary(top, "bottom");
        return fromTop.kind === "none" ? boundary(top + GRID_SIZE, "top") : fromTop;
      }
      return { kind: "none", side: "", key: "" };
    }

    return Object.freeze({ ship, hull, footprint, connectionDoors, boundary, edge, columns:GRID_SIZE, rows:gridRows(ship), sides:SIDES, aerofoil:installedItems(ship).some(i=>definition(i.type).landing==='aerofoil')&&hullSymmetry(ship).symmetric, thrusterDirection:[0,90,180,270].includes(ship.thrusterDirection)?ship.thrusterDirection:null });
  }

  function meshStepAllowed(layout,from,to){
    if(!layout.hull.has(from.square)||!layout.hull.has(to.square)||layout.footprint.get(to.square)?.blocked)return false;
    const x=p=>(p.square%layout.columns)*3+p.mesh%3,y=p=>Math.floor(p.square/layout.columns)*3+Math.floor(p.mesh/3);
    if(Math.abs(x(from)-x(to))+Math.abs(y(from)-y(to))!==1)return false;
    if(from.square===to.square)return true;
    const edge=layout.edge(from.square,to.square);if(edge.kind==='wall')return false;
    if(edge.kind==='door')return x(from)===x(to)?from.mesh%3===1:Math.floor(from.mesh/3)===1;
    return true;
  }
  function meshRoute(layout,start,destination){
    const key=p=>p.square*9+p.mesh,decode=n=>({square:Math.floor(n/9),mesh:n%9});
    const first=key(start),last=key(destination),parents=new Map([[first,null]]),queue=[first];
    for(let i=0;i<queue.length&&!parents.has(last);i++){
      const from=decode(queue[i]),x=from.square%layout.columns*3+from.mesh%3,y=Math.floor(from.square/layout.columns)*3+Math.floor(from.mesh/3);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=layout.columns*3||ny>=layout.rows*3)continue;
        const to={square:Math.floor(ny/3)*layout.columns+Math.floor(nx/3),mesh:ny%3*3+nx%3},id=key(to);
        if(!parents.has(id)&&meshStepAllowed(layout,from,to)){parents.set(id,queue[i]);queue.push(id);}
      }
    }
    if(!parents.has(last))return null;
    const route=[];for(let id=last;id!==first;id=parents.get(id))route.unshift(decode(id));return route;
  }
  function boundaryMarkup(layout, square, options = {}) {
    const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    return SIDES.map(({ name }) => {
      const boundary = layout.boundary(square, name);
      if (boundary.kind === "none") return "";
      const axis = name === "top" || name === "bottom" ? "horizontal" : "vertical";
      const wall = (segment = "full") => `<i aria-hidden="true" class="sa-map-wall ${name} ${axis} ${segment}"></i>`;
      if (boundary.kind === "wall") return wall();
      const open = Boolean(options.isOpen?.(boundary.key));
      const attributes = Object.entries(options.doorAttributes?.(boundary.key) || {})
        .filter(([key]) => /^data-[a-z-]+$/.test(key))
        .map(([key, value]) => `${key}="${escape(value)}"`).join(" ");
      return `${wall("start")}${wall("end")}<button type="button" class="sa-map-door ${name} ${axis}${open ? " is-open" : ""}" ${attributes} aria-pressed="${open}" aria-label="${open ? "Close" : "Open"} door"><i class="sa-door-leaf"></i><i class="sa-door-leaf"></i></button>`;
    }).join("");
  }


  function triangleCells(record={}) {const s=record.ship||record;return [...new Set((Array.isArray(s.triangleCells)?s.triangleCells:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<gridColumns(s)*gridRows(s)))];}
  function triangleOrientation(record,cell) {
    const s=record.ship||record,c=gridColumns(s),r=gridRows(s),h=new Set(s.gridCells||[]),solid=new Set([...h,...triangleCells(s)]);
    if(!Number.isInteger(cell)||cell<0||cell>=c*r||h.has(cell))return null;
    const x=cell%c,y=Math.floor(cell/c),at=(dx,dy)=>x+dx<0||x+dx>=c||y+dy<0||y+dy>=r?-1:cell+dy*c+dx;
    for(const [corner,dx,dy] of [['nw',-1,-1],['ne',1,-1],['se',1,1],['sw',-1,1]])
      if(h.has(at(dx,0))&&h.has(at(0,dy))&&!solid.has(at(-dx,0))&&!solid.has(at(0,-dy))&&!solid.has(at(-dx,-dy)))return corner;
    return null;
  }
  function triangleError(record) {
    const s=record.ship||record;
    if(s.triangleCells!==undefined&&!Array.isArray(s.triangleCells))return 'Invalid triangular hull data.';
    for(const n of s.triangleCells||[]){
      if(!triangleOrientation(s,n))return 'A triangle needs normal hull on both straight sides and open space beyond its diagonal wall.';
      for(const p of s.placements||[]){const i=(s.sicInventory||[]).find(i=>i.id===p.sicId);if(i&&placementSquares(s,i,p).includes(n))return 'Triangular hull cannot contain SICs or exterior equipment.';}
    }return '';
  }
  function hullHp(record){const s=record.ship||record;return new Set(s.gridCells||[]).size+triangleCells(s).length;}
  function triangleMarkup(ship={},cell,preview=false){
    if(!preview&&!triangleCells(ship).includes(cell))return '';
    const corner=triangleOrientation(ship,cell);if(!corner)return '';
    const points={nw:'0,0 100,0 0,100',ne:'0,0 100,0 100,100',se:'100,0 100,100 0,100',sw:'0,0 100,100 0,100'};
    return `<svg class="sa-hull-triangle${preview?' is-preview':''}" viewBox="0 0 100 100" data-triangle="${corner}" aria-label="Triangular hull: 300 credits, 1 Hull HP"><polygon points="${points[corner]}"/><image class="sa-triangle-art" href="sic-art-triangle-hull.webp" x="0" y="0" width="100" height="100" transform="rotate(${({nw:0,ne:90,se:180,sw:270})[corner]} 50 50)"/></svg>`;
  }
  function addonHost(ship,item){const s=ship.ship||ship,host=(s.sicInventory||[]).find(i=>i.id===item.attachTo),p=(s.placements||[]).find(p=>p.sicId===host?.id),d=definition(host?.type),a=definition(item.type).addon;
    return host&&p&&!host.pendingDisposition&&!host.storage&&((!d.addon&&(a==='any'&&Number(d.threshold)>0||a==='engine'&&d.engine||a==='bridge'&&d.bridge||a==='probe'&&d.probeLauncher))||(a==='probe-module'&&d.probe&&addonHost(s,host)))?{item:host,placement:p}:null;}
  function attachments(ship,id,type){return installedItems(ship).filter(i=>i.attachTo===id&&(!type||i.type===type)&&operational(i));}
  function effectiveThreshold(ship,item){return Number(definition(item.type).threshold)||0 ? Number(definition(item.type).threshold)+attachments(ship,item.id,'vulnerability-fortification').length : null;}
  function engineClearance(ship,item){return Math.max(0,(definition(item.type).clearance||0)-(attachments(ship,item.id,'power-core-damper').length?1:0));}
  function sicPrice(item){return item.type==='vulnerability-fortification'?Math.max(500,Number(item.purchasePrice)||500):definition(item.type).price||0;}
  function scramblePenalty(ship,sicId){const s=ship.ship||ship,item=(s.sicInventory||[]).find(i=>i.id===sicId),p=(s.placements||[]).find(p=>p.sicId===sicId);if(!item||!p)return 0;const cells=placementSquares(s,item,p),c=gridColumns(s);
    return installedItems(s).some(i=>i.type==='scramble-box'&&operational(i)&&!i.impaired&&!i.impairmentPoints&&i.status!=='impaired'&&(s.placements||[]).some(p=>p.sicId===i.id&&cells.some(n=>Math.abs(n%c-p.cell%c)+Math.abs(Math.floor(n/c)-Math.floor(p.cell/c))===1)))?1:0;}
  function equipmentBonus(ship,location,skill){
    if(!ship||!location||!Number.isInteger(location.square))return {bonus:0,label:''};
    const s=ship.ship||ship;if(!(s.gridCells||[]).includes(location.square)||(ship.id&&location.starshipId&&ship.id!==location.starshipId))return {bonus:0,label:''};const items=installedItems(s).filter(i=>operational(i)&&!i.impaired&&!i.impairmentPoints&&i.status!=='impaired');
    if(['Navigate','Navigation'].includes(skill)&&items.some(i=>i.type==='holographic-projector'&&addonHost(s,i)))return {bonus:2,label:'Holographic Projector'};
    const room=buildLayout(s).footprint.get(location.square),lab=items.find(i=>i.id===room?.sicId&&i.type==='science-lab');
    if(lab&&['Research','Science/Physics','Astronomy'].includes(skill))return {bonus:4,label:'Science Lab'};
    return {bonus:0,label:''};
  }

  const viewKey='sa-map-view-preferences', viewKeys=['labels','highResolution','hull','combatMesh','walls','stations'];
  function loadViewPreferences(fallback={}) {
    let saved={};try{saved=JSON.parse(localStorage.getItem(viewKey)||'{}');}catch{}
    return Object.fromEntries(viewKeys.map(k=>[k,typeof saved[k]==='boolean'?saved[k]:typeof fallback[k]==='boolean'?fallback[k]:['labels','walls','stations'].includes(k)]));
  }
  function saveViewPreferences(value) {
    try{const next=JSON.stringify(loadViewPreferences());const prefs={...JSON.parse(next),...Object.fromEntries(viewKeys.filter(k=>typeof value[k]==='boolean').map(k=>[k,value[k]]))};
      if(JSON.stringify(prefs)===next)return;localStorage.setItem(viewKey,JSON.stringify(prefs));window.dispatchEvent(new Event('sa-map-view-changed'));
    }catch{}
  }
  function onViewPreferences(callback) {
    const apply=()=>callback(loadViewPreferences());window.addEventListener('sa-map-view-changed',apply);
    window.addEventListener('storage',e=>{if(e.key===viewKey)apply();});
  }
  return Object.freeze({ triangleCells, triangleOrientation, triangleError, triangleMarkup, hullHp, addonHost, attachments, effectiveThreshold, engineClearance, sicPrice, scramblePenalty, equipmentBonus, loadViewPreferences, saveViewPreferences, onViewPreferences, ASSET_VERSION, GRID_SIZE, HULL_COST, SIDES, fuelCatalog, resourceCounts, bridgeAddonPlacement, gridColumns, gridRows, gridSides, rectangleCells, outerSpace, segmentDefinition, placementParts, placementSquares, remapSquare, resizeZone, walkingMilliseconds, playWalkingAnimation, multiMountPlacement, hullSymmetry, installedItems, operational, oxygenEnabled, gravityEnabled, updateMovementGravity, capabilities, capabilityMarkup, catalog: Object.freeze(catalog), definition, componentDefinition, floorplanStyle, doorKey, blocksMovement, buildLayout, meshStepAllowed, meshRoute, boundaryMarkup, image, exteriorPlacement, mixedPlacement, exteriorError, edgePlacement, componentAtEdge, propulsion, masking, cloaked, scaleRank, shipColor, shipHeading, sensorStats, firewallStats, exteriorFacing, surfaceMarkup, roomOxygen, viewDisabled, viewControls });
}));
