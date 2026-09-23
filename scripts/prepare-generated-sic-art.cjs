const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..');
(async()=>{let bytes=0;for(const asset of require(process.argv[2]?path.resolve(process.argv[2]):'./generated-sic-art.json')){
  const target=path.join(root,'sic-art-'+asset.id+'.webp');
  await sharp(asset.source).resize({width:asset.id.startsWith('starship-rank-')?(asset.id.endsWith('-5')?256:128):asset.id==='meeting-room-console'?1400:720,height:asset.id.startsWith('starship-rank-')?(asset.id.endsWith('-5')?256:128):asset.id==='meeting-room-console'?900:960,fit:'inside',withoutEnlargement:true}).webp({quality:84,alphaQuality:100,effort:6}).toFile(target);
  const info=await sharp(target).metadata();bytes+=fs.statSync(target).size;console.log(asset.id,info.width,info.height,'alpha='+info.hasAlpha);
}console.log('Total web artwork bytes:',bytes);})().catch(e=>{console.error(e);process.exitCode=1});
