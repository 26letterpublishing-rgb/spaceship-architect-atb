const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function browser({ existing = false, rejected = false } = {}) {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.nodes = {}; this.handlers = {}; this.value = ''; this.textContent = ''; }
    append(...nodes) { this.children.push(...nodes); }
    querySelector(selector) { return this.nodes[selector] ||= new Element(selector); }
    addEventListener(event, handler) { this.handlers[event] = handler; }
    showModal() { this.querySelector('input').value = 'Tester'; this.returnValue = 'ok'; queueMicrotask(() => this.handlers.close()); }
    remove() {}
    focus() {}
  }
  const welcome = new Element('welcome'), requests = [];
  const storage = { 'sa-room-player-AAAA': 'old-room-token', ...(existing ? { 'sa-room-player-BBBB': 'target-token' } : {}) };
  Object.defineProperties(storage, {
    getItem: { value: key => storage[key] ?? null },
    setItem: { value: (key, value) => { storage[key] = value; } }
  });
  const location = { pathname: '/index.html', search: '', href: '' };
  const document = { getElementById: id => id === 'welcomePanel' ? welcome : null, querySelector: () => null, createElement: tag => new Element(tag), body: new Element('body') };
  const window = { localStorage: storage, SABrowserStorage: {local:storage,ready:Promise.resolve(),flush:async()=>{}}, addEventListener() {} };
  const fetch = async (url, options) => {
    requests.push({ url, body: options?.body && JSON.parse(options.body) });
    if(rejected&&url.endsWith('/join'))return {ok:false,json:async()=>({error:'Room unavailable'})};
    // Another room is genuinely still open: it must not prevent joining BBBB.
    if (url.includes('code=AAAA')) return { ok: true, json: async () => ({ roomOpen: true }) };
    return { ok: true, json: async () => url.endsWith('/join') ? { token: 'new-target-token' } : { roomOpen: true, interfaceVersion: '0.3' } };
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../room-v03.js'), 'utf8'), { window, document, localStorage: storage, location, fetch, URLSearchParams, queueMicrotask });
  await window.SABrowserStorage.ready;
  const host = welcome.children[0];
  return { window, storage, location, requests, host, async join() { host.querySelector('[name=code]').value = ' bbbb '; await host.querySelector('form').handlers.submit({ preventDefault() {} }); } };
}

test('joining a new room ignores another open campaign and preserves its saved link', async () => {
  const b = await browser(); await b.join();
  assert.equal(b.location.href, 'room.html?campaign=BBBB');
  assert.equal(b.storage['sa-room-player-BBBB'], 'new-target-token');
  assert.equal(b.storage['sa-room-player-AAAA'], 'old-room-token');
  assert.deepEqual(b.requests.map(r => r.url), ['/api/campaign/v03/join']);
  assert.equal(b.requests[0].body.code, 'BBBB');
});

test('returning to an existing room keeps its character session without checking other rooms', async () => {
  const b = await browser({ existing: true }); await b.join();
  assert.equal(b.location.href, 'room.html?campaign=BBBB');
  assert.equal(b.storage['sa-room-player-BBBB'], 'target-token');
  assert.equal(b.requests.length, 1);
  assert.match(b.requests[0].url, /code=BBBB&token=target-token/);
});

test('portable imports are not blocked by a different saved campaign session', async () => {
  const b = await browser({ existing: true });
  await b.window.SARoomV03.importIntoRoom('bbbb', 'character', { identity: { characterName: 'Traveler' } });
  assert.equal(b.location.href, 'room.html?campaign=BBBB');
  assert.ok(b.requests.every(r => !r.url.includes('AAAA')));
  assert.equal(b.requests.at(-1).body.code, 'BBBB');
  assert.equal(b.requests.at(-1).body.token, 'target-token');
});
const characterSource=fs.readFileSync(require.resolve('../character.js'),'utf8');
function finalizationBrowser({linked=false}={}){
  const calls={passwords:0,creates:0,opened:[]};let resolvePassword;
  const password=new Promise(resolve=>{resolvePassword=resolve;});
  const context={PAGE_PARAMS:new URLSearchParams('roomCreate=ROOM'),character:{phase:'finalized'},localStorage:{getItem:()=> 'player-token'},notice:()=>{},campaignRequest:async()=>({roomOpen:true,...(linked?{ownCharacterId:'new-character'}:{})}),window:{SARoomV03:{roomKey:()=> 'room-key',input:()=>{calls.passwords++;return password;},api:async()=>{calls.creates++;return {campaign:{ownCharacterId:'new-character'}};},openCharacter:async(state,token)=>{calls.opened.push({state,token});}}}};
  vm.createContext(context);vm.runInContext(characterSource.slice(characterSource.indexOf('let roomCreationPending='),characterSource.indexOf('async function initializeCharacterApp()'))+';this.finish=finishRoomCreation;',context);
  return {calls,finish:context.finish,resolvePassword};
}
test('room finalization ignores repeated clicks while choosing one password and enters the campaign directly',async()=>{
  const b=finalizationBrowser();const first=b.finish();await Promise.resolve();await b.finish();
  assert.equal(b.calls.passwords,1);b.resolvePassword('test-only');await first;
  assert.equal(b.calls.creates,1);assert.equal(b.calls.opened.length,1);assert.equal(b.calls.opened[0].token,'player-token');
});
test('retrying a completed room finalization resumes the linked character without another password or approval',async()=>{
  const b=finalizationBrowser({linked:true});await b.finish();
  assert.equal(b.calls.passwords,0);assert.equal(b.calls.creates,0);assert.equal(b.calls.opened[0].state.ownCharacterId,'new-character');
});

test('entry waits for button feedback, blocks duplicate submits and confirms only accepted rooms',async()=>{
 const b=await browser();const events=[];let release;
 b.window.SAHomeFeedback={activate:()=>new Promise(resolve=>{events.push('press');release=resolve;}),accepted:async()=>events.push('accepted'),release:()=>events.push('release')};
 const first=b.join();await b.join();assert.deepEqual(events,['press']);assert.equal(b.requests.length,0);
 release();await first;assert.equal(b.requests.filter(r=>r.url.endsWith('/join')).length,1);assert.deepEqual(events,['press','accepted','release']);assert.equal(b.location.href,'room.html?campaign=BBBB');
});


test('rejected entry does not play acceptance and releases the menu for retry',async()=>{
 const b=await browser({rejected:true}),events=[];
 b.window.SAHomeFeedback={activate:async()=>events.push('press'),accepted:async()=>events.push('accepted'),release:()=>events.push('release')};
 await b.join();await b.join();assert.deepEqual(events,['press','release','press','release']);assert.equal(b.location.href,'');assert.equal(b.host.querySelector('[role=status]').textContent,'Room unavailable');
});
