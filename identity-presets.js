// Authored identity suggestions. Measurements and personal details are examples, not racial rules.
(function(root){
  const presets={};
  function race(id,home,rows){presets[id]=rows.map(([characterName,sex,age,height,weight,hair,eyes,description,homePlanet=home])=>({characterName,sex,age:String(age),height,weight:weight+' lb',hair,eyes,description,homePlanet}));}
  race('android','Earth',[
    ['Ada Venn / AV-17','Female',8,'5′7″',175,'Brown synthetic hair','Hazel','Slim frame and precise posture.'],
    ['Elias Ward / EW-04','Male',21,'5′11″',205,'Short black synthetic hair','Gray','Broad shoulders and deliberate movements.','Cornillia 4'],
    ['Ren / RN-62','Androgynous',3,'5′5″',150,'Cropped silver synthetic hair','Brown','Compact build and an unusually still resting posture.']]);
  race('angiluros','Angiluros homeworld (name unrecorded)',[
    ['Ra’shara','Female',27,'5′8″',155,'Tawny fur with dark rosettes','Amber','White muzzle, athletic build, braided cheek fur, and a hand-carved wooden necklace.'],
    ['Korr Ashmane','Male',39,'6′1″',205,'Charcoal fur; pale-gray mane','Green','Broad chest, one notched ear, and a necklace of polished teeth.'],
    ['Tavi Reedclaw','Female',23,'5′5″',135,'Rust-colored fur with cream markings','Gold','Lean limbs, woven tribal garments, and small wooden ornaments.']]);
  race('antropic','Antropica',[
    ['Miri Fenwick','Female',24,'3′1″',42,'Gold and cream','Amber','Compact build; a small dark marking above the left eye.'],
    ['Tob Renn','Male',35,'4′0″',68,'Gray with a white underside','Brown','Sturdy build and a nicked ear, fin, or feather tip.','Darmania'],
    ['Pella Voss','Female',29,'2′10″',35,'Reddish brown with pale facial markings','Green','Light build and quick, expressive head movements.','Tal-son']]);
  race('bruggle','Tarinian Volkmire',[
    ['Borruk Fen','Male',32,'7′4″',410,'None','Copper','Olive-green skin with dark mottling, thick arms, and a broad muscular torso.'],
    ['Hessa Gronn','Female',41,'8′1″',515,'None','Gold','Ochre skin with brown bands, wide shoulders, powerful legs, and a forearm scar.'],
    ['Tulp Varr','Male',25,'6′5″',305,'None','Bronze','Orange skin with black spots, compact muscular build, and a wide expressive mouth.']]);
  race('butchers-of-hellmouth','Mars',[
    ['Varr the Quiet','Male',34,'6′3″',230,'None','None — eyeless','Blistered ash-colored skin, crooked teeth, and a deep crease across the scalp.'],
    ['Ketha Cinder','Female',47,'6′0″',210,'None','None — eyeless','Rough reddish-gray skin, several missing teeth, and old scars along the jaw.'],
    ['Orruk','Male',26,'6′7″',285,'None','None — eyeless','Dark ridged skin, heavy shoulders, and uneven teeth protruding beyond the lower lip.']]);
  race('draco-prime','Unrecorded Draco colony',[
    ['Sareth Vey','Female',76,'5′10″',165,'None','Yellow','Natural form: jade-green scales, slender features, and a controlled expression.'],
    ['Kael Vossir','Male',112,'6′1″',195,'None','Yellow','Natural form: dark-green scales, broad jaw, upright posture, and a faint scar beneath one eye.'],
    ['Neris Thaal','Female',54,'5′8″',150,'None','Yellow','Natural form: pale-green scales, fine facial ridges, and long precise fingers.']]);
  race('epoc','Rythune',[
    ['Avelis Serune','Female',31,'5′11″',155,'Black, swept backward','Violet','Elongated skull, ivory brow protrusions, and flowing blue ceremonial garments.'],
    ['Theren Ovael','Male',46,'6′2″',180,'Silver-gray','Brown','Long skull, pronounced temple and elbow ridges, and layered cream robes.'],
    ['Ilyra Vaen','Female',24,'5′9″',140,'Dark brown','Gray','Fine bone protrusions around the crown and wrists; embroidered green gown.']]);
  race('everliving-brethren','Kalmavia-44',[
    ['Deren Voss','Male',63,'5′10″',165,'Sparse black','Glazed blood red','Gray skin; a reattached left hand has a slightly different skin tone.'],
    ['Maela Korr','Female',38,'5′7″',140,'Cropped brown','Glazed blood red','Ash-gray skin, neat seams around one shoulder, and a sunken right cheek.'],
    ['Oren Pell','Male',91,'6′0″',180,'Thin white','Glazed blood red','Mottled gray skin, long fingers, and mismatched patches of repaired tissue.']]);
  race('flavilin','Unnamed moon of Argol HD 19356 IV',[
    ['Brindle Kett','Male',48,'5′2″',145,'Sparse thick black bristles','Raised amber eyes','Folded brown skin, heavy brass goggles, and grease-stained fingers.'],
    ['Nessa Vorn','Female',83,'5′5″',160,'Widely spaced black bristles','Raised dark-brown eyes','Deep brown skin folds, round protective goggles, and a patched work coat.'],
    ['Pelk Ardin','Male',119,'5′0″',135,'Sparse black bristles','Raised hazel eyes','Weathered brown skin, oversized goggles with mismatched lenses, and a stooped posture.']]);
  race('garmoc','Darlasia',[
    ['Vorrak Drenn','Male',36,'6′4″',255,'Shaved scalp','Pure blue','Black skin, thick shoulder horns, and short forward-curving head horns.'],
    ['Sava Korr','Female',29,'6′0″',215,'Close-cropped black','Pure blue','Black skin, swept-back head horns, and a chipped right shoulder horn.'],
    ['Tharn Vek','Male',52,'6′6″',280,'None visible','Pure blue','Black skin, broad protective bone structure, and asymmetrical weathered horns.']]);
  race('grey','Unrecorded homeworld',[
    ['Esh','Female',42,'4′1″',65,'None','Large black','Light-gray skin, narrow shoulders, oversized rounded head, and a pale-gray fitted suit.'],
    ['Nul','Male',68,'3′9″',55,'None','Large black','Dark-gray skin, long fingers, slightly angular skull, and dull-blue fitted clothing.'],
    ['Veya','Female',31,'4′3″',70,'None','Large black','Silver-gray skin, fine facial slits, slender neck, and muted green clothing.']]);
  race('horus','Djoser-1',[
    ['Kheper Amun','Male',58,'6′8″',215,'Bronze-brown feathers','Gold','Eagle-like head, dark hooked beak, and gold-trimmed ceremonial garments.'],
    ['Seshara','Female',37,'6′5″',185,'White head feathers; dark body plumage','Amber','Charcoal beak and a broad golden collar.'],
    ['Akhet Ren','Male',81,'6′10″',225,'Black-and-gray feathers','Copper','Worn dark beak, tall dignified posture, and layered Egyptian-style gold ornaments.']]);
  race('human','Earth',[
    ['Mara Solis','Female',29,'5′6″',140,'Short dark-brown curls','Brown','Tan skin, compact build, and a small scar through the left eyebrow.'],
    ['Elias Okoro','Male',43,'5′11″',185,'Tightly curled black','Hazel','Dark-brown skin, broad shoulders, and a neatly trimmed beard.'],
    ['Ren Calder','Androgynous',25,'5′8″',150,'Straight black, cropped on one side','Gray','Medium-brown skin, lean frame, freckles across the nose. Nonbinary.']]);
  race('kabuto','Cornillia 4',[
    ['Klik','Androgynous',4,'1′0″',9,'None','Dark compound eyes','Asexual. Glossy black shell with copper highlights and a chipped edge; no clothing.','Del-84'],
    ['Tikka','Androgynous',11,'1′1″',11,'None','Black compound eyes','Asexual. Deep-brown shell with a green sheen, long antennae, and polished wing covers; no clothing.'],
    ['Brik','Androgynous',19,'0′11″',8,'None','Dark compound eyes','Asexual. Scratched charcoal shell, uneven antenna tips, and a squat body; no clothing.']]);
  race('krax-gny-vtek','Unnamed colony near T-228 Kantanna',[
    ['Vesh G’ny Raal','Male',44,'6′8″',145,'None','Glowing pupil-less violet','Chalk-white skin, long limbs, and a wide lipless mouth filled with pointed teeth.'],
    ['Nakka V’Tek','Female',32,'6′5″',130,'None','Glowing pupil-less cyan','Slate-gray skin, prominent joints, and uneven rows of narrow teeth.'],
    ['Korr G’ny Thesh','Male',67,'7′0″',160,'None','Glowing pupil-less amber','Near-black skin, extremely thin torso, elongated fingers, and a broad tooth-filled mouth.']]);
  race('nordic-flaxen','Flaxen',[
    ['Astrid Vael','Female',28,'6′4″',185,'Long platinum blonde','Oversized blue','Light-tan skin, strong posture, and sharply defined facial features.'],
    ['Leif Soren','Male',41,'6′7″',225,'Swept-back golden blonde','Oversized pale pink','Light-tan skin, athletic build, and immaculate grooming.'],
    ['Freya Norr','Female',35,'6′5″',195,'Short ash blonde','Oversized blue','Light-tan skin, broad shoulders, and an easy practiced smile.']]);
  race('pattanilia','Unnamed Pattanilia homeworld',[
    ['Iri Venn','Female',26,'5′7″',105,'None','Holographic violet and cyan','Pale-blue skin, very slender limbs, and delicate hands. Raised in Virtuocity.'],
    ['Sael Orin','Male',39,'5′10″',120,'None','Rainbow holographic sheen','Silver-blue skin, narrow chest, and a careful economical gait. Raised in Virtuocity.'],
    ['Nemi','Androgynous',22,'5′5″',95,'None','Holographic green and gold','Light-blue skin, frail frame, and a still resting expression. Nonbinary; raised in Virtuocity.']]);
  race('skeder','Unnamed Argamma colony',[
    ['Krek’ta','Male',17,'3′8″',75,'None','Amber, side-set','Pale-green exoskeleton, reverse-jointed legs, inward-curving claws, and small three-fingered hands.'],
    ['Vesh’ra','Female',28,'4′1″',95,'None','Copper, side-set','Light jade exoskeleton, angular head ridges, and a scar across one reverse-jointed leg.'],
    ['Tik’orr','Male',33,'3′6″',70,'None','Dark gold, side-set','Washed-green exoskeleton, compact torso, small arms, and worn claws beneath powerful reverse-jointed legs.']]);
  race('slyn-tanni','Mizutaria',[
    ['Narela Vey','Female',27,'5′9″',145,'None','Teal','Azure skin, swept-back head fins, and broad translucent swimming wings with silver edges.'],
    ['Oshen Tal','Male',38,'6′1″',175,'None','Gold','Deep-blue skin, striped wing-like fins, and a slender muscular torso.'],
    ['Seli Maren','Female',23,'5′6″',130,'None','Violet','Pale-blue skin, flowing turquoise-spotted fins, and a narrow scalp crest.']]);
  race('spiddix','Cornillia 4',[
    ['Professor Vekk','Male',72,'5′8″',230,'None','Brown biological eyes','Brain in a clear head dome; brass-and-steel humanoid body with two arms and two legs.'],
    ['Sira Pell','Female',46,'5′4″',205,'None','Gray biological eyes','Brain behind a protected upper-torso window; compact ivory body with two arms and two legs.'],
    ['Orrix Nine','Male',96,'6′0″',270,'None','Hazel biological eyes','Brain in a reinforced dome; dark industrial body with two arms, two heavy legs, and a hunched frame.']]);
  race('tamalori','Malo',[
    ['Lethari Vale','Female',24,'6′4″',150,'Tawny fur; dark neck fur','Brown','Pale deer-like muzzle, long legs, and large ears.'],
    ['Oren Thist','Male',37,'6′8″',175,'Dark-brown fur; cream throat','Amber','Deer-like head, lean frame, and an upright poised stance.'],
    ['Vaela Norr','Female',49,'6′6″',160,'Silver-gray fur','Hazel','Deer-like head, dark nose, fine white facial markings, and slender limbs.']]);
  race('vinolio-paxton','Unnamed free Vinolio settlement',[
    ['Damar Voss','Male',34,'6′2″',220,'Close-cropped black','Brown','Dark-brown skin, muscular build, red cape, and a Garmoc-symbol tattoo marking departure from home.'],
    ['Nera Pax','Female',28,'5′11″',185,'Long black braids','Amber','Deep-brown skin, powerful shoulders, blue cape, and a forearm tattoo commemorating a rescue.'],
    ['Solen Marr','Male',46,'6′4″',240,'Short salt-and-pepper','Gray','Dark skin, heavy build, charcoal cape, and Garmoc symbols recording family milestones.']]);
  race('xithx','Unrecorded collective settlement',[
    ['Xil’ka','Female',26,'5′10″',120,'None','Amber compound eyes','Green exoskeleton, mantis-like limbs, and orange armor markings. Exiled after failing a mission.'],
    ['Thrix','Male',19,'5′5″',95,'None','Gold compound eyes','Pale-green exoskeleton, fine antennae, and neon-pink armor markings. Fled after questioning his queen.'],
    ['Keth’za','Female',38,'6′0″',135,'None','Bronze compound eyes','Dark-green exoskeleton, repaired antenna, and orange-and-pink markings. Deserted rather than execute a collective member.']]);
  race('yetuak-zune','Goltron Armanna',[
    ['Vaelis Thuun','Female',84,'6′1″',145,'Straight black','Pale gray','Deep-blue skin, long pointed ears, and a dark hood with geometric silver stitching.'],
    ['Norrvek','Male',167,'6′4″',165,'Silver','Icy blue','Near-black skin with violet undertones, pointed ears, slender frame, and layered ritual robes.'],
    ['Ilyth Saren','Androgynous',112,'6′2″',150,'White','Silver gray','Purple skin and pointed ears; a dark embroidered hood conceals the face. Intersex and nonbinary.']]);
  race('yuhorn-symitron','Gauson',[
    ['Goruun','Male',44,'7′2″',440,'Crystalline crown','Pale blue','Broad shoulders, square face, and a weathered ridge above the right eye.'],
    ['Vesha','Female',61,'6′11″',400,'Short frost spines','Silver blue','Robust build, rounded facial contours, and branching patterns across both forearms.'],
    ['Tholl','Male',29,'7′0″',420,'Jagged ice crest','Deep blue','Thick limbs, heavy brow, and contrasting bands across the torso.']]);
  const yuhorn={
    ice:[[440,'Crystalline crown','Pale blue','Cloudy ice'],[400,'Short frost spines','Silver blue','Clear blue-white ice'],[420,'Jagged ice crest','Deep blue','Densely frosted ice']],
    lava:[[680,'None','Amber','Black crust with orange fissures'],[620,'None','Orange','Dark volcanic crust with red-gold seams'],[650,'None','Gold','Charcoal plates with ember-red gaps']],
    rock:[[850,'None','Gray mineral-like','Dark stone with pale mineral veins'],[760,'None','Smoky white','Brown-gray stone with quartz seams'],[810,'None','Dark crystalline','Banded slate']],
    wood:[[340,'Twig-like crown','Amber','Dark bark'],[300,'Branch-like ridges','Green','Pale bark'],[320,'Moss-like growth','Brown','Reddish bark']]
  };
  function get(raceId,type,index){
    if(!presets[raceId])return null;
    const i=((index%3)+3)%3,p={...presets[raceId][i]};
    if(raceId==='android'){
      p.age+=' years since activation';
      if(type?.includes('robot')){p.hair='None';p.eyes=['Amber optics','Pale-blue optics','Green optics'][i];p.description+=` ${['Ivory','Graphite','Brushed-metal'][i]} casing and an entirely mechanical face.`;}
      else if(type==='imperfect-android')p.description+=' Fine seams and unusual eye reflections reveal the artificial construction.';
      else p.description+=' Indistinguishable from a human in appearance.';
    }
    if(raceId==='antropic'){
      const coloring=p.hair;
      const forms={fangs:['Short fur','Predatory muzzle, visible canine teeth, and pointed ears.'],feather:['Feathers','Beak, wings, and a contrasting crest.'],fins:['None','Smooth amphibious skin, fins, and webbing.'],fluffy:['Dense soft fur','Rounded muzzle, large ears, and a fluffy tail.']};
      const [hair,description]=forms[type]||forms.fluffy;p.hair=hair==='None'?hair:`${coloring} ${hair.toLowerCase()}`;p.description=`${coloring} coloring. ${description} ${p.description.replace('ear, fin, or feather tip',type==='feather'?'feather tip':type==='fins'?'fin':'ear')}`;
    }
    if(raceId==='yuhorn-symitron'){const [weight,hair,eyes,body]=(yuhorn[type]||yuhorn.ice)[i];Object.assign(p,{weight:weight+' lb',hair,eyes,description:body+' body. '+p.description});}
    return p;
  }
  const api={presets,get};if(typeof module==='object'&&module.exports)module.exports=api;root.SAIdentityPresets=api;
})(globalThis);
