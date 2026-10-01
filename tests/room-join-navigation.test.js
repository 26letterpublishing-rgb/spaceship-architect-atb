const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function browser({ existing = false } = {}) {
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
  const window = { localStorage: storage, addEventListener() {} };
  const fetch = async (url, options) => {
    requests.push({ url, body: options?.body && JSON.parse(options.body) });
    // Another room is genuinely still open: it must not prevent joining BBBB.
    if (url.includes('code=AAAA')) return { ok: true, json: async () => ({ roomOpen: true }) };
    return { ok: true, json: async () => url.endsWith('/join') ? { token: 'new-target-token' } : { roomOpen: true, interfaceVersion: '0.3' } };
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../room-v03.js'), 'utf8'), { window, document, localStorage: storage, location, fetch, URLSearchParams, queueMicrotask });
  const host = welcome.children[0];
  return { window, storage, location, requests, host, async join() { host.querySelector('[name=code]').value = ' bbbb '; await host.querySelector('form').handlers.submit({ preventDefault() {} }); } };
}

test('joining a new room ignores another open campaign and preserves its saved link', async () => {
  const b = browser(); await b.join();
  assert.equal(b.location.href, 'room.html?campaign=BBBB');
  assert.equal(b.storage['sa-room-player-BBBB'], 'new-target-token');
  assert.equal(b.storage['sa-room-player-AAAA'], 'old-room-token');
  assert.deepEqual(b.requests.map(r => r.url), ['/api/campaign/v03/join']);
  assert.equal(b.requests[0].body.code, 'BBBB');
});

test('returning to an existing room keeps its character session without checking other rooms', async () => {
  const b = browser({ existing: true }); await b.join();
  assert.equal(b.location.href, 'room.html?campaign=BBBB');
  assert.equal(b.storage['sa-room-player-BBBB'], 'target-token');
  assert.equal(b.requests.length, 1);
  assert.match(b.requests[0].url, /code=BBBB&token=target-token/);
});

test('portable imports are not blocked by a different saved campaign session', async () => {
  const b = browser({ existing: true });
  await b.window.SARoomV03.importIntoRoom('bbbb', 'character', { identity: { characterName: 'Traveler' } });
  assert.equal(b.location.href, 'room.html?campaign=BBBB');
  assert.ok(b.requests.every(r => !r.url.includes('AAAA')));
  assert.equal(b.requests.at(-1).body.code, 'BBBB');
  assert.equal(b.requests.at(-1).body.token, 'target-token');
});
