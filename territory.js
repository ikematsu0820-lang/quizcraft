/* =========================================================
 * territory.js — 陣取りパネル（ゲーム）
 *
 * 問題は一問一答（早押し・順番）。正解した人が空いているパネルを1枚取り、
 * 縦・横・ななめで自分の色に挟んだ相手のパネルは自分の色にひっくり返る。
 * パネルの枚数がそのまま得点（最後に多い人が勝ち）。
 *
 *   セットの設定: config.gameType = 'territory'、tpRows・tpCols（盤面の大きさ）
 *   部屋の状態:   rooms/{id}/status/tp = { rows, cols, cells[], colors{pid:n}, picking, show, last{idx,flips[],by}, seq }
 *   回答者の端末から選ぶ時: rooms/{id}/players/{pid}/tpPick = 番号
 *
 * 司会者（App.Studio）の流れには、正解の判定のあとに「パネルを選ぶ」を差し込むだけ。
 * モニター・回答者の画面には、盤面を出す間だけ上に重ねて出す。
 * =======================================================*/
window.App = window.App || {};

App.Territory = {
    COLORS: ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'],
    DIRS: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],

    isOn: function (conf) { return !!(conf && conf.gameType === 'territory'); },
    size: function (conf) {
        const c = conf || {};
        const clamp = (v) => Math.max(2, Math.min(8, parseInt(v) || 5));
        return { rows: clamp(c.tpRows), cols: clamp(c.tpCols) };
    },
    esc: function (v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },

    // 置いたら、どれがひっくり返るか（挟んだ相手のパネル）
    flipsFor: function (tp, idx, owner) {
        const { rows, cols } = tp;
        const cells = tp.cells || [];
        const r0 = Math.floor(idx / cols), c0 = idx % cols;
        const out = [];
        this.DIRS.forEach(([dr, dc]) => {
            const line = [];
            let r = r0 + dr, c = c0 + dc;
            while (r >= 0 && r < rows && c >= 0 && c < cols) {
                const v = cells[r * cols + c];
                if (!v) return;                 // 空きで途切れたら挟めない
                if (v === owner) { out.push(...line); return; }
                line.push(r * cols + c);
                r += dr; c += dc;
            }
        });
        return out;
    },
    counts: function (tp) {
        const n = {};
        (tp.cells || []).forEach(v => { if (v) n[v] = (n[v] || 0) + 1; });
        return n;
    },
    colorOf: function (tp, pid) {
        const i = (tp.colors || {})[pid];
        return i === undefined ? '#555' : this.COLORS[i % this.COLORS.length];
    },

    // 盤面の絵（司会者・モニター・回答者で共通）
    boardHtml: function (tp, players, opts = {}) {
        const { rows, cols } = tp;
        const cells = tp.cells || [];
        const last = tp.last || {};
        const flips = new Set(last.flips || []);
        const name = (pid) => this.esc(((players || {})[pid] || {}).name || '');
        let html = `<div class="tp-grid" style="grid-template-columns:repeat(${cols}, 1fr); grid-template-rows:repeat(${rows}, 1fr); --ar:${cols} / ${rows};">`;
        for (let i = 0; i < rows * cols; i++) {
            const owner = cells[i];
            const cls = ['tp-cell'];
            if (owner) cls.push('own');
            const hasQ = !tp.qcells || tp.qcells[i];
            if (!hasQ) cls.push('none');
            if (opts.pickable && !owner && hasQ) cls.push('can');
            if (tp.cur === i) cls.push('cur');
            if (last.idx === i && opts.fresh) cls.push('just');
            if (flips.has(i) && opts.fresh) cls.push('flip');
            html += `<div class="${cls.join(' ')}" data-tp="${i}" style="${owner ? `--c:${this.colorOf(tp, owner)};` : ''}">
                <span class="tp-no">${i + 1}</span>${owner && opts.names ? `<span class="tp-who">${name(owner)}</span>` : ''}</div>`;
        }
        html += '</div>';
        // 色ごとの枚数（多い順）
        const cnt = this.counts(tp);
        const ids = Object.keys(tp.colors || {}).sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0));
        html += `<div class="tp-legend">${ids.map(pid => `<span class="tp-leg"><i style="background:${this.colorOf(tp, pid)}"></i>${name(pid)} <b>${cnt[pid] || 0}</b></span>`).join('')}</div>`;
        return html;
    },

    // ---------------------------------------------------------
    // 司会者
    // ---------------------------------------------------------
    S: function () { return window.App.Studio; },
    room: function () { return App.State.currentRoomId; },
    tp: null,

    initBoard: function () {
        const conf = App.Data.currentConfig;
        if (!this.isOn(conf) || !this.room()) { this.tp = null; return; }
        const { rows, cols } = this.size(conf);
        const n = rows * cols;
        // マスと問題を結ぶ（q.tpCell）。決まっていない問題は空いているマスへ
        const qs = App.Data.studioQuestions || [];
        const used = new Set();
        qs.forEach(q => { const c = parseInt(q.tpCell); if (!isNaN(c) && c >= 0 && c < n && !used.has(c)) used.add(c); else q.tpCell = null; });
        qs.forEach(q => { if (q.tpCell === null || q.tpCell === undefined) { let c = 0; while (c < n && used.has(c)) c++; if (c < n) { q.tpCell = c; used.add(c); } } });
        const qcells = Array.from({ length: n }, (_, i) => used.has(i));
        this.tp = { rows, cols, cells: Array(n).fill(''), qcells, colors: {}, picking: '', cur: -1, show: false, last: null, seq: 0, order: [], pi: 0 };
        this._chosen = false;
        this.push();
    },
    // まだ取られていない、問題のあるマス
    remaining: function () {
        const t = this.tp;
        if (!t) return [];
        return t.qcells.map((h, i) => (h && !t.cells[i] ? i : -1)).filter(i => i >= 0);
    },
    // マスを開く人（参加した順に回る）
    nextPicker: function () {
        const t = this.tp;
        const ids = Object.keys(App.Data.players || {}).filter(pid => (App.Data.players[pid] || {}).isAlive !== false);
        ids.forEach(pid => { if (!t.order.includes(pid)) t.order.push(pid); });
        const live = t.order.filter(pid => ids.includes(pid));
        if (!live.length) return '';
        const pid = live[t.pi % live.length];
        t.pi = (t.pi + 1) % live.length;
        return pid;
    },
    push: function () {
        if (!this.tp || !this.room()) return;
        const t = this.tp;
        window.db.ref(`rooms/${this.room()}/status/tp`).set({
            rows: t.rows, cols: t.cols, cells: t.cells.map(v => v || ''), qcells: t.qcells || null, cur: t.cur ?? -1, colors: t.colors, picking: t.picking || '',
            show: !!t.show, last: t.last || null, seq: t.seq || 0,
        });
    },

    // 順番の人がマスを開く（開いたマスの問題を、全員で早押し）
    startCellPick: function () {
        const t = this.tp;
        if (!t) return;
        const pid = this.nextPicker();
        if (!pid) { App.Ui.showToast('参加者がいません'); return; }
        if (t.colors[pid] === undefined) t.colors[pid] = Object.keys(t.colors).length;
        t.picking = pid; t.cur = -1; t.show = true; t.last = null;
        this.push();
        window.db.ref(`rooms/${this.room()}/players/${pid}/tpPick`).remove();
        if (this._pickRef) this._pickRef.off();
        this._pickRef = window.db.ref(`rooms/${this.room()}/players/${pid}/tpPick`);
        this._pickRef.on('value', snap => {
            const v = snap.val();
            if (v === null || v === undefined || this.tp.picking !== pid) return;
            this.place(parseInt(v));
        });
        this.openHost();
    },
    // マスを開いた → そのマスの問題へ
    place: function (idx) {
        const t = this.tp;
        if (!t || !t.picking || isNaN(idx) || t.cells[idx] || !t.qcells[idx]) return;
        const pid = t.picking;
        t.picking = ''; t.cur = idx; t.show = false;
        if (this._pickRef) { this._pickRef.off(); this._pickRef = null; }
        window.db.ref(`rooms/${this.room()}/players/${pid}/tpPick`).remove();
        this.push();
        this.closeHost();
        const qi = (App.Data.studioQuestions || []).findIndex(q => q.tpCell === idx);
        if (qi < 0) return;
        App.State.currentQIndex = qi;
        this._chosen = true;
        const name = ((App.Data.players || {})[pid] || {}).name || '';
        App.Ui.showToast(`${name} さんが ${idx + 1}番を開きました`);
        this.S().setStep(1);
    },
    // 正解した人が、開いたマスを取る（挟んだマスはひっくり返る）
    onCorrect: function (pid) {
        const t = this.tp;
        if (!t || !pid || t.cur < 0 || t.cells[t.cur]) return;
        if (t.colors[pid] === undefined) t.colors[pid] = Object.keys(t.colors).length;
        const idx = t.cur;
        const flips = this.flipsFor(t, idx, pid);
        t.cells[idx] = pid;
        flips.forEach(i => { t.cells[i] = pid; });
        t.last = { idx, flips, by: pid };
        t.cur = -1; t.show = true;
        t.seq = (t.seq || 0) + 1;
        this.push();
        this.syncScores();
        const name = ((App.Data.players || {})[pid] || {}).name || '';
        App.Ui.showToast(flips.length ? `${name} さんが ${idx + 1}番を取り、${flips.length}枚ひっくり返しました` : `${name} さんが ${idx + 1}番を取りました`);
        this.openHost();
        this.renderHost(true);
    },
    skipPick: function () {
        if (!this.tp) return;
        this.tp.picking = ''; this.tp.show = false;
        if (this._pickRef) { this._pickRef.off(); this._pickRef = null; }
        this.push();
        this.closeHost();
    },
    // 得点 = 持っているパネルの枚数
    syncScores: function () {
        const cnt = this.counts(this.tp);
        const players = App.Data.players || {};
        const updates = {};
        Object.keys(players).forEach(pid => {
            const p = players[pid] || {};
            const now = cnt[pid] || 0;
            const before = Number(p.periodScore) || 0;
            updates[`${pid}/periodScore`] = now;
            updates[`${pid}/totalScore`] = (Number(p.totalScore) || 0) + (now - before);
        });
        if (Object.keys(updates).length) window.db.ref(`rooms/${this.room()}/players`).update(updates);
    },
    setShow: function (on) {
        if (!this.tp) return;
        this.tp.show = !!on;
        this.push();
    },

    // 司会者の画面に重ねる盤面（選ぶ時・見る時）
    openHost: function () { this._hostOpen = true; this.renderHost(false); },
    closeHost: function () {
        this._hostOpen = false;
        document.getElementById('tp-host')?.remove();
        document.body.classList.remove('tp-open');
    },
    renderHost: function (fresh) {
        if (!this._hostOpen || !this.tp) return;
        let ov = document.getElementById('tp-host');
        if (!ov) { ov = document.createElement('div'); ov.id = 'tp-host'; document.body.appendChild(ov); }
        document.body.classList.add('tp-open');
        const t = this.tp;
        const players = App.Data.players || {};
        const picking = t.picking;
        const pname = picking ? this.esc((players[picking] || {}).name || '') : '';
        ov.innerHTML = `
            <div class="tp-head">
                <div class="tp-title">${picking ? `<b style="color:${this.colorOf(t, picking)}">${pname}</b> さんが開くマスを選びます` : '陣取りの盤面'}</div>
                <button type="button" class="tp-close">閉じる</button>
            </div>
            <div class="tp-board">${this.boardHtml(t, players, { pickable: !!picking, fresh, names: true })}</div>
            <div class="tp-foot">
                <span>${picking ? '開くマスを押す（本人のスマホからも選べます）。開いたマスの問題を全員で早押し' : `残り ${this.remaining().length}マス`}</span>
                <button type="button" class="tp-mon">${t.show ? 'モニターの盤面をしまう' : 'モニターに盤面を出す'}</button>
            </div>`;
        ov.querySelector('.tp-close').onclick = () => this.closeHost();
        ov.querySelector('.tp-mon').onclick = () => { this.setShow(!t.show); this.renderHost(false); };
        if (picking) ov.querySelectorAll('.tp-cell.can').forEach(c => { c.onclick = () => this.place(parseInt(c.dataset.tp)); });
    },
    // 司会者画面の「盤面」ボタン（陣取りの時だけ）
    ensureHostButton: function () {
        const on = this.isOn(App.Data.currentConfig) && !!this.tp && !document.getElementById('host-control-view')?.classList.contains('hidden');
        let btn = document.getElementById('tp-host-btn');
        if (!on) { btn?.remove(); return; }
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'tp-host-btn';
            btn.textContent = '盤面';
            btn.onclick = () => this.openHost();
            document.body.appendChild(btn);
        }
    },

    hookStudio: function () {
        const S = this.S();
        if (!S || S._tpHooked) return;
        S._tpHooked = true;
        const T = this;
        const wrap = (name, before, after) => {
            const orig = S[name];
            if (typeof orig !== 'function') return;
            S[name] = function () {
                const ctx = before ? before.apply(this, arguments) : null;
                const r = orig.apply(this, arguments);
                try { if (after) after.call(this, ctx, arguments); } catch (e) { console.warn('territory', e); }
                return r;
            };
        };
        const on = () => T.isOn(App.Data.currentConfig);
        // セットを読み込んだら盤面を新しく
        wrap('setupPeriod', null, function () { T.initBoard(); T.ensureHostButton(); });
        // 早押し（など）の正解 → 開いたマスを取る
        wrap('judgeBuzz', function (ok) { return ok ? this.buzzWinner : null; }, function (winner) { if (winner && on()) T.onCorrect(winner); });
        wrap('updatePlayerScore', function (pid, ok) { return ok ? pid : null; }, function (pid) { if (pid && on()) T.onCorrect(pid); });
        // 問題を出す前に、順番の人がマスを開く
        const origSetStep = S.setStep;
        S.setStep = function (stepId) {
            if (stepId === 1 && on() && T.tp && !T._chosen) {
                if (!T.remaining().length) { this.handleSetCompletion && this.handleSetCompletion(); return; }
                this.currentStepId = 1;
                T.startCellPick();
                return;
            }
            return origSetStep.apply(this, arguments);
        };
        // 次へ — 次のマスを開く（問題の並び順ではなく、盤面の残りで進める）
        const origNext = S.goNext;
        S.goNext = function () {
            if (!on() || !T.tp) return origNext.apply(this, arguments);
            T.closeHost();
            if (T.tp.show) { T.tp.show = false; T.tp.last = null; T.push(); }
            T._chosen = false;
            const endMsg = this.checkSetEnd && this.checkSetEnd();
            if (endMsg || !T.remaining().length) {
                App.State.currentQIndex = (App.Data.studioQuestions || []).length - 1;
                return origNext.apply(this, arguments);
            }
            this.resetPlayerStatus();
            this.revealedMultiIndices = {};
            window.db.ref(`rooms/${App.State.currentRoomId}/status/revealedMulti`).remove();
            this.currentStepId = null;
            this.setStep(1);
        };
    },

    // ---------------------------------------------------------
    // モニター・回答者 — 盤面を出す間だけ画面の上に重ねる
    // ---------------------------------------------------------
    _watchRoom: null,
    watch: function () {
        const viewerOn = !document.getElementById('viewer-main-view')?.classList.contains('hidden');
        const playerOn = !document.getElementById('player-game-view')?.classList.contains('hidden');
        const room = viewerOn ? (window.App.Viewer && window.App.Viewer.roomId) : playerOn ? (typeof myRoomId !== 'undefined' ? myRoomId : null) : null;
        if (room !== this._watchRoom) {
            if (this._watchRefs) this._watchRefs.forEach(r => r.off());
            this._watchRefs = null;
            this._watchRoom = room;
            this._remote = {};
            if (room && window.db) {
                const tpRef = window.db.ref(`rooms/${room}/status/tp`);
                const plRef = window.db.ref(`rooms/${room}/players`);
                tpRef.on('value', s => { this._remote.tp = s.val(); this.renderRemote(); });
                plRef.on('value', s => { this._remote.players = s.val() || {}; this.renderRemote(); });
                this._watchRefs = [tpRef, plRef];
            }
        }
        this._role = viewerOn ? 'viewer' : playerOn ? 'player' : null;
        this.renderRemote();
    },
    renderRemote: function () {
        const tp = this._remote && this._remote.tp;
        let ov = document.getElementById('tp-remote');
        const show = !!(this._role && tp && tp.show && tp.cells);
        if (!show) { ov?.remove(); this._lastSeq = null; return; }
        // モニターの画面は一番上の層にあるので、その中に重ねる
        const parent = this._role === 'viewer' ? (document.getElementById('viewer-main-view') || document.body) : document.body;
        if (!ov) { ov = document.createElement('div'); ov.id = 'tp-remote'; }
        if (ov.parentNode !== parent) parent.appendChild(ov);
        ov.className = this._role === 'viewer' ? 'tp-mon' : 'tp-pl';
        const players = this._remote.players || {};
        const me = typeof myPlayerId !== 'undefined' ? myPlayerId : null;
        const mine = this._role === 'player' && tp.picking && tp.picking === me;
        const fresh = tp.seq !== this._lastSeq;
        this._lastSeq = tp.seq;
        const pname = tp.picking ? this.esc((players[tp.picking] || {}).name || '') : '';
        const lastBy = tp.last && tp.last.by ? this.esc((players[tp.last.by] || {}).name || '') : '';
        const msg = tp.picking
            ? (mine ? 'あなたが開くマスを選んでください' : `<b style="color:${this.colorOf(tp, tp.picking)}">${pname}</b> さんが開くマスを選んでいます`)
            : (tp.last ? `<b style="color:${this.colorOf(tp, tp.last.by)}">${lastBy}</b> さんが ${tp.last.idx + 1}番を取りました${(tp.last.flips || []).length ? `（${tp.last.flips.length}枚ひっくり返し）` : ''}` : '陣取りの盤面');
        ov.innerHTML = `<div class="tp-msg">${msg}</div><div class="tp-board">${this.boardHtml(tp, players, { pickable: mine, fresh, names: this._role === 'viewer' })}</div>`;
        if (mine) ov.querySelectorAll('.tp-cell.can').forEach(c => {
            c.onclick = () => window.db.ref(`rooms/${this._watchRoom}/players/${me}/tpPick`).set(parseInt(c.dataset.tp));
        });
    },
};

// 問題を書く画面 — 盤面のマス目を押して、そのマスの問題を書く（マス＝問題）
App.Territory.assignCells = function () {
    const conf = (window.App.Data && window.App.Data.currentConfig) || {};
    const { rows, cols } = this.size(conf);
    const n = rows * cols;
    const qs = window.App.Data.createdQuestions || [];
    const used = new Set();
    qs.forEach(q => { const c = parseInt(q.tpCell); if (!isNaN(c) && c >= 0 && c < n && !used.has(c)) used.add(c); else q.tpCell = null; });
    qs.forEach(q => { if (q.tpCell === null || q.tpCell === undefined) { let c = 0; while (c < n && used.has(c)) c++; if (c < n) { q.tpCell = c; used.add(c); } } });
    return { n, rows, cols, used };
};
App.Territory.creatorGuide = function () {
    const view = document.getElementById('creator-view');
    const wrap = document.getElementById('creator-editor-wrap');
    let el = document.getElementById('tp-guide');
    const conf = (window.App.Data && window.App.Data.currentConfig) || {};
    const on = view && !view.classList.contains('hidden') && this.isOn(conf) && wrap;
    if (!on) { el?.remove(); return; }
    const C = window.App.Creator;
    const { n, rows, cols, used } = this.assignCells();
    const qs = window.App.Data.createdQuestions || [];
    const editing = C && C.editingIndex !== null && C.editingIndex !== undefined ? (qs[C.editingIndex] || {}).tpCell : (this._pendingCell ?? (() => { let c = 0; while (c < n && used.has(c)) c++; return c < n ? c : -1; })());
    const key = JSON.stringify([rows, cols, qs.map(q => [q.tpCell, (q.q || '').slice(0, 12)]), editing]);
    if (!el) { el = document.createElement('div'); el.id = 'tp-guide'; }
    if (el.parentNode !== wrap.parentNode || el.nextSibling !== wrap) wrap.parentNode.insertBefore(el, wrap);
    if (el._key === key) return;
    el._key = key;
    const byCell = {};
    qs.forEach((q, i) => { if (q.tpCell !== null && q.tpCell !== undefined) byCell[q.tpCell] = i; });
    let cells = '';
    for (let c = 0; c < n; c++) {
        const qi = byCell[c];
        const q = qi !== undefined ? qs[qi] : null;
        cells += `<button type="button" class="tpg-cell${q ? ' has' : ''}${editing === c ? ' on' : ''}" data-c="${c}"><b>${c + 1}</b><span>${q ? this.esc((q.q || '').slice(0, 14)) : '＋'}</span></button>`;
    }
    el.innerHTML = `<div class="tpg-head"><b>陣取りの盤面（${rows}×${cols}）</b><span>${Object.keys(byCell).length} / ${n}マスに問題</span></div>
        <div class="tpg-grid" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));">${cells}</div>
        <p class="tpg-note">マスを押すと、そのマスの問題を書けます。出題では順番にマスを開き、開いたマスの問題を全員で早押し。正解した人がそのマスを取ります。問題が無いマスは出題で使いません。</p>`;
    el.querySelectorAll('.tpg-cell').forEach(b => {
        b.onclick = () => this.openCell(parseInt(b.dataset.c));
    });
};
// マスを押した: 問題があれば直す、無ければそのマスの新しい問題
App.Territory.openCell = function (c) {
    const C = window.App.Creator;
    const M = window.App.CreatorMobile, D = window.App.CreatorDesktop;
    const qs = window.App.Data.createdQuestions || [];
    const qi = qs.findIndex(q => q.tpCell === c);
    if (qi >= 0) {
        this._pendingCell = null;
        if (M && M.isMobile && M.isMobile()) M.showEdit(qi); else if (D && D.openQuestion) D.openQuestion(qi); else C.edit(qi);
    } else {
        this._pendingCell = c;
        if (M && M.isMobile && M.isMobile()) M.showEdit(null); else if (D && D.newQuestion) D.newQuestion(); else C.resetForm();
        this._pendingCell = c; // 新しい問題を開く処理で消えないように
    }
    const el = document.getElementById('tp-guide'); if (el) el._key = null;
    this.creatorGuide();
    setTimeout(() => document.getElementById('question-text')?.focus(), 50);
};
// 問題を追加した時、書いていたマスに結ぶ
App.Territory.hookCreator = function () {
    const C = window.App.Creator;
    if (!C || C._tpHooked) return;
    C._tpHooked = true;
    const T = this;
    const origAdd = C.add;
    C.add = function () {
        const qs = window.App.Data.createdQuestions || [];
        const before = qs.length;
        const cell = T._pendingCell;
        const r = origAdd.apply(this, arguments);
        const now = window.App.Data.createdQuestions || [];
        if (T.isOn(window.App.Data.currentConfig) && now.length > before) {
            const last = now[now.length - 1];
            if (cell !== null && cell !== undefined && !now.some(q => q !== last && q.tpCell === cell)) last.tpCell = cell;
            T._pendingCell = null;
        }
        return r;
    };
};

document.addEventListener('DOMContentLoaded', () => {
    App.Territory.hookStudio();
    App.Territory.hookCreator();
    setInterval(() => { try { App.Territory.watch(); App.Territory.ensureHostButton(); App.Territory.creatorGuide(); } catch (e) { /* noop */ } }, 700);
});
