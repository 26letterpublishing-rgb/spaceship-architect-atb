/* Durable overflow for browser saves. Native entries are removed only after an
   IndexedDB transaction commits; unrelated browser data is never evicted. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.SABrowserStorage = factory(root);
}(typeof window === 'undefined' ? null : window, function(root) {
  const native = root.localStorage, session = root.sessionStorage;
  const copies = new Map(), pending = new Map();
  const archiveKey = key => /^sa-(?:character-)?campaign-(?:cache|full-backup)-v1-/.test(key);
  let db, failure = null, chain = Promise.resolve();
  const open = () => new Promise((resolve, reject) => {
    const request = root.indexedDB.open('sa-browser-saves-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('entries');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  function transaction(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entries', 'readwrite');
      if (value === null) tx.objectStore('entries').delete(key);
      else tx.objectStore('entries').put(value, key);
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error || Error('Browser save failed.'));
    });
  }
  function report(error) {
    failure = error;
    root.dispatchEvent?.(new root.CustomEvent('sa-storage-error', {detail: {message:
      'This browser could not save locally. Keep this page open and export your work. ' + error.message}}));
  }
  const ready = open().then(async database => {
    db = database;
    await new Promise((resolve, reject) => {
      const tx = db.transaction('entries'), request = tx.objectStore('entries').openCursor();
      request.onsuccess = () => { const cursor = request.result; if (cursor) {
        if (!pending.has(cursor.key)) copies.set(cursor.key, cursor.value);
        cursor.continue();
      }};
      tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error);
    });
    // These are complete, redundant campaign snapshots, often several MB each.
    for (const key of Object.keys(native).filter(archiveKey)) {
      const value = native.getItem(key);
      if (value === null || pending.has(key)) continue;
      await transaction(key, value);
      copies.set(key, value);
      if (native.getItem(key) === value) native.removeItem(key);
    }
  }).catch(error => { failure = error; });
  function queue(key, value) {
    const previousNative = native.getItem(key);
    pending.set(key, value);
    chain = chain.then(async () => {
      await ready;
      if (!db) throw failure || Error('Browser database unavailable.');
      await transaction(key, value);
      if (pending.get(key) === value) {
        pending.delete(key);
        if (native.getItem(key) === previousNative) native.removeItem(key);
      }
      failure = null;
    }).catch(report);
  }
  const local = {
    getItem(key) {
      key = String(key);
      if (pending.has(key)) return pending.get(key);
      return native.getItem(key) ?? copies.get(key) ?? null;
    },
    setItem(key, value) {
      key = String(key); value = String(value);
      // Keep small settings and credentials synchronous whenever space permits.
      if (!archiveKey(key) && !copies.has(key) && !pending.has(key)) {
        try { native.setItem(key, value); return; } catch { /* Durable overflow below. */ }
      }
      copies.set(key, value); queue(key, value);
      // Credentials remain available to older embedded views while the DB commits.
      if (/^sa-(?:gm-token|character-token|room-player)-/.test(key)) {
        try { session.setItem(key, value); } catch { /* flush() still guarantees durability. */ }
      }
    },
    removeItem(key) {
      key = String(key); native.removeItem(key);
      if (/^sa-(?:gm-token|character-token|room-player)-/.test(key)) session.removeItem(key);
      if (copies.has(key) || pending.has(key)) { copies.delete(key); queue(key, null); }
    },
    key(index) { return [...new Set([...Object.keys(native), ...copies.keys()])][index] ?? null; },
    get length() { return new Set([...Object.keys(native), ...copies.keys()]).size; }
  };
  async function flush() { await ready; await chain; if (pending.size) throw failure || Error('Local save has not completed.'); }
  root.addEventListener?.('beforeunload', event => {
    if (pending.size) { event.preventDefault(); event.returnValue = ''; }
  });
  // Other tabs continue to read native changes immediately. Refresh archived values
  // on focus so a saved character selected in another tab is available here too.
  root.addEventListener?.('focus', async () => {
    await ready; if (!db || pending.size) return;
    const tx = db.transaction('entries'), request = tx.objectStore('entries').openCursor(), fresh = new Map();
    request.onsuccess = () => { const cursor = request.result; if (cursor) {fresh.set(cursor.key, cursor.value);cursor.continue();} };
    tx.oncomplete = () => { if (!pending.size) {copies.clear(); for (const [key,value] of fresh) copies.set(key,value);} };
  });
  return {local, ready, flush};
}));
