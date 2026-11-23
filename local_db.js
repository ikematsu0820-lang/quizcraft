/* =========================================================
 * local_db.js — 端末の中だけのデータベース（お試し用）
 *
 * お試し（trial.js）は、本番と同じ司会者・モニター・解答者の部品を
 * 同じページの iframe に並べ、通信の代わりにこのデータベースでつなぐ。
 *   親のページ: const store = LocalDb.createStore()（データと購読の置き場）
 *   各 iframe : window.db = LocalDb.client(parent.__trialStore)（firebase.js で ?local=1 の時）
 * Firebase の ref の使う所だけ（on/off/once/set/update/remove/push/transaction）。
 * 値の複製は受け取る側の画面で作る（配列などが別の画面の物にならないように）。
 * 本物と同じく undefined は受け付けない。
 * =======================================================*/
window.LocalDb = {
    createStore: function () {
        return { root: {}, listeners: [], pending: null, pushN: 0 };
    },

    client: function (store) {
        // off() はこの画面の購読だけを外す（本物の Firebase と同じく、画面ごとに別）
        const me = {};
        const split = (p) => String(p || '').split('/').filter(Boolean);
        const getAt = (path) => split(path).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), store.root);
        const clone = (v) => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v)));
        const findUndef = (v, p) => {
            if (v === undefined) return p;
            if (v && typeof v === 'object') { for (const k of Object.keys(v)) { const r = findUndef(v[k], p + '/' + k); if (r) return r; } }
            return null;
        };
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
            Object.keys(o).forEach(k => {
                if (o[k] === null || o[k] === undefined) delete o[k];
                else if (typeof o[k] === 'object') { prune(o[k]); if (Object.keys(o[k]).length === 0) delete o[k]; }
            });
            return o;
        };
        const setAt = (path, val) => {
            const ks = split(path);
            const v = (val && typeof val === 'object') ? prune(resolveTs(JSON.parse(JSON.stringify(val)))) : resolveTs(val);
            if (!ks.length) { store.root = v || {}; return; }
            let o = store.root;
            for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
            const last = ks[ks.length - 1];
            if (v === null || v === undefined) delete o[last]; else o[last] = v;
        };
        const notify = () => {
            if (store.pending) return;
            store.pending = setTimeout(() => {
                store.pending = null;
                store.listeners.slice().forEach(l => {
                    const s = JSON.stringify(getAt(l.path) ?? null);
                    if (s === l.last) return;
                    l.last = s;
                    try { l.fire(s); } catch (e) { try { console.error('local_db', e); } catch (e2) { /* 閉じた画面の購読は無視 */ } }
                });
            }, 0);
        };
        const snap = (path, json) => {
            const val = json === undefined ? null : JSON.parse(json);
            const mk = (p, v) => ({
                key: split(p).pop() || null,
                val: () => clone(v),
                exists: () => v !== undefined && v !== null,
                numChildren: () => (v && typeof v === 'object' ? Object.keys(v).length : 0),
                child: (k) => mk(p + '/' + k, v && typeof v === 'object' ? v[k] : undefined),
                forEach: (cb) => { if (v && typeof v === 'object') Object.keys(v).some(k => cb(mk(p + '/' + k, v[k])) === true); },
                ref: ref(p),
            });
            return mk(path, val);
        };
        const later = (fn) => setTimeout(fn, 0);
        function ref(path) {
            path = split(path).join('/');
            const r = {
                key: split(path).pop() || null,
                path,
                child: (p) => ref(path + '/' + p),
                on: (ev, cb) => {
                    const l = { path, cb, owner: me, last: undefined, fire: (json) => cb(snap(path, json)) };
                    store.listeners.push(l);
                    later(() => { l.last = JSON.stringify(getAt(path) ?? null); try { cb(snap(path, l.last)); } catch (e) { console.error(e); } });
                    return cb;
                },
                off: (ev, cb) => {
                    for (let i = store.listeners.length - 1; i >= 0; i--) {
                        const l = store.listeners[i];
                        if (l.owner === me && l.path === path && (!cb || l.cb === cb)) store.listeners.splice(i, 1);
                    }
                },
                once: (ev, cb) => {
                    const json = JSON.stringify(getAt(path) ?? null);
                    return new Promise(res => later(() => { const s = snap(path, json); if (cb) cb(s); res(s); }));
                },
                set: (v) => {
                    const bad = findUndef(v, path);
                    if (bad) return Promise.reject(new Error('set failed: value argument contains undefined in property ' + bad));
                    setAt(path, v); notify(); return Promise.resolve();
                },
                update: (obj) => {
                    const bad = Object.keys(obj || {}).map(k => obj[k] === undefined ? null : findUndef(obj[k], path + '/' + k)).find(Boolean);
                    if (bad) return Promise.reject(new Error('update failed: undefined in ' + bad));
                    Object.keys(obj || {}).forEach(k => setAt(path + '/' + k, obj[k]));
                    notify(); return Promise.resolve();
                },
                remove: () => { setAt(path, null); notify(); return Promise.resolve(); },
                push: (v) => {
                    const k = 'k' + Date.now().toString(36) + (store.pushN++);
                    const cr = ref(path + '/' + k);
                    if (v !== undefined) cr.set(v);
                    const p = Promise.resolve(cr);
                    cr.then = p.then.bind(p);
                    return cr;
                },
                transaction: (fn) => {
                    const nv = fn(clone(getAt(path)));
                    if (nv !== undefined) { setAt(path, nv); notify(); }
                    return Promise.resolve({ committed: true, snapshot: snap(path, JSON.stringify(getAt(path) ?? null)) });
                },
                onDisconnect: () => ({ remove: () => Promise.resolve(), update: () => Promise.resolve(), set: () => Promise.resolve(), cancel: () => Promise.resolve() }),
                orderByChild: () => r, limitToLast: () => r, limitToFirst: () => r, equalTo: () => r,
            };
            return r;
        }
        return { ref, _store: store };
    },
};
