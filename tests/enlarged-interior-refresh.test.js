const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../starship.js'),'utf8');
function fixture(columns=20,rows=20){
  const styles=new Map(),box={width:1200,height:600};
  const grid={
    classList:{contains:()=>false},
    style:{setProperty:(key,value)=>styles.set(key,value)},
    querySelectorAll:()=>Array.from({length:columns*rows},()=>({remove(){}})),append(){}
  };
  const context={GRID_SIZE:columns,draft:{zoneColumns:columns,zoneRows:rows},shipGrids:[grid],
    document:{createDocumentFragment:()=>({})},
    window:{SAShipMap:{gridColumns:ship=>ship.zoneColumns,gridRows:ship=>ship.zoneRows}},
    enlargedShipInterior:{grid,viewport:{getBoundingClientRect:()=>box}}
  };
  vm.runInNewContext(source.slice(source.indexOf('function resizeEnlargedShipInterior('),source.indexOf('async function enlargeShipInterior(')),context);
  vm.runInNewContext(source.slice(source.indexOf('function buildConstructionZone('),source.indexOf('\nbuildConstructionZone();')),context);
  return {context,styles,box};
}
test('enlarged interior keeps square tiles and framing through repeated construction renders',()=>{
  const {context,styles}=fixture(30,40);
  for(let update=0;update<3;update++){
    context.buildConstructionZone();
    assert.equal(styles.get('width'),'900px');
    assert.equal(styles.get('height'),'1200px');
    assert.equal(styles.get('left'),'150px');
    assert.equal(styles.get('top'),'-300px');
    assert.equal(styles.get('--cell-size'),'30px');
  }
});
test('enlarged interior refreshes label cell size after resize and stops after closing',()=>{
  const {context,styles,box}=fixture();
  context.resizeEnlargedShipInterior();
  Object.assign(box,{width:900,height:400});context.resizeEnlargedShipInterior();
  assert.equal(styles.get('width'),'400px');
  assert.equal(styles.get('height'),'400px');
  assert.equal(styles.get('left'),'250px');
  assert.equal(styles.get('--cell-size'),'20px');
  const previous=[...styles];context.enlargedShipInterior=null;
  assert.doesNotThrow(()=>context.resizeEnlargedShipInterior());
  assert.deepEqual([...styles],previous);
  context.buildConstructionZone();
  assert.equal(styles.get('width'),'100%');
  assert.equal(styles.get('height'),'100%');
});
