// メモリ上の Firebase（画面確認用）— on/once('value')・update・set・remove・push・transaction
(function () {
  const TS = { '.sv': 'timestamp' };
  const root = { v: {} };
  // 本物と同じく undefined を拒む
  const findUndef = (v, p) => {
    if (v === undefined) return p;
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) { const r = findUndef(v[k], p + '/' + k); if (r) return r; } }
    return null;
  };
  const listeners = []; // {path, cb}
  const split = (p) => String(p || '').split('/').filter(Boolean);
  const getAt = (path) => split(path).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), root.v);
  const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const resolveTs = (v) => {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      const o = Array.isArray(v) ? [] : {};
      Object.keys(v).forEach(k => { o[k] = resolveTs(v[k]); });
      return o;
    }
    return v;
  };
  const prune = (o) => {
    if (!o || typeof o !== 'object') return o;
    Object.keys(o).forEach(k => { if (o[k] === null || o[k] === undefined) delete o[k]; else if (typeof o[k] === 'object') { prune(o[k]); if (Object.keys(o[k]).length === 0) delete o[k]; } });
    return o;
  };
  const setAt = (path, val) => {
    const ks = split(path);
    if (!ks.length) { root.v = prune(resolveTs(val)) || {}; return; }
    let o = root.v;
    for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    const last = ks[ks.length - 1];
    if (val === null || val === undefined) delete o[last];
    else o[last] = (val && typeof val === 'object') ? prune(resolveTs(clone(val))) : val;
  };
  const snap = (path, val) => ({
    key: split(path).pop() || null,
    val: () => clone(val),
    exists: () => val !== undefined && val !== null,
    numChildren: () => (val && typeof val === 'object' ? Object.keys(val).length : 0),
    child: (k) => snap(path + '/' + k, val && typeof val === 'object' ? val[k] : undefined),
    forEach: (cb) => { if (val && typeof val === 'object') Object.keys(val).some(k => cb(snap(path + '/' + k, val[k])) === true); },
    ref: ref(path),
  });
  let pending = null;
  const notify = () => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      listeners.slice().forEach(l => { const v = getAt(l.path); const s = JSON.stringify(v ?? null); if (s !== l.last) { l.last = s; try { l.cb(snap(l.path, v)); } catch (e) { console.error(e); } } });
    }, 0);
  };
  let pushN = 0;
  function ref(path) {
    path = split(path).join('/');
    const r = {
      key: split(path).pop() || null,
      path,
      child: (p) => ref(path + '/' + p),
      on: (ev, cb) => { const l = { path, cb, last: undefined }; listeners.push(l); setTimeout(() => { const v = getAt(path); l.last = JSON.stringify(v ?? null); cb(snap(path, v)); }, 0); return cb; },
      off: (ev, cb) => { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].path === path && (!cb || listeners[i].cb === cb)) listeners.splice(i, 1); },
      once: (ev, cb) => { const s = snap(path, getAt(path)); return new Promise(res => setTimeout(() => { if (cb) cb(s); res(s); }, 0)); },
      set: (v) => { const bad = findUndef(v, path); if (bad) return Promise.reject(new Error('set failed: value argument contains undefined in property ' + bad)); setAt(path, v); notify(); return Promise.resolve(); },
      update: (obj) => { const bad = Object.keys(obj || {}).map(k => obj[k] === undefined ? null : findUndef(obj[k], path + '/' + k)).find(Boolean); if (bad) return Promise.reject(new Error('update failed: undefined in ' + bad)); Object.keys(obj || {}).forEach(k => setAt(path + '/' + k, obj[k])); notify(); return Promise.resolve(); },
      remove: () => { setAt(path, null); notify(); return Promise.resolve(); },
      push: (v) => { const k = 'k' + Date.now().toString(36) + (pushN++); const cr = ref(path + '/' + k); if (v !== undefined) cr.set(v); const p = Promise.resolve(cr); cr.then = p.then.bind(p); return cr; },
      transaction: (fn) => { const nv = fn(clone(getAt(path))); if (nv !== undefined) { setAt(path, nv); notify(); } return Promise.resolve({ committed: true, snapshot: snap(path, getAt(path)) }); },
      onDisconnect: () => ({ remove: () => Promise.resolve(), update: () => Promise.resolve(), set: () => Promise.resolve(), cancel: () => Promise.resolve() }),
      orderByChild: () => r, limitToLast: () => r, limitToFirst: () => r, equalTo: () => r,
    };
    return r;
  }
  const db = { ref, _root: root, _get: getAt };
  window.firebase = { apps: [1], initializeApp: () => {}, database: Object.assign(() => db, { ServerValue: { TIMESTAMP: TS } }) };
  window.__fakeDb = db;
})();
