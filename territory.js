/* =========================================================
 * territory.js — 陣取りパネル（ゲーム）
 *
 * 盤面のマスごとに「表（モニターに見せる字）」と「答え」を用意する（マス＝問題。
 * 作る画面では、マスの問題文が表、正解が答え）。盤面ごとで1つの問題として遊ぶ。
 *   1. モニターと解答者のスマホに盤面全体を出す（お題 config.tpPrompt があれば上に）
 *   2. 解答権: 早押し（押した人）／順番（決めた順に1人ずつ）／指名（司会者が選ぶ）
 *   3. 答える人が「13番、まぐろ」と言う（スマホの盤面からマスを選んでもよい）
 *   4. 司会者が盤面で13番を押す → 答えを見て〇✕
 *      〇: そのマスを取り、縦・横・ななめで挟んだ相手のマスを自分の色にひっくり返す
 *      ✕: 早押しは他の人が押せる（ルールの誤答が「終了」ならそのマスの回は終わり）、順番は次の人へ
 *   5. マスが全部埋まるか、司会者が「結果発表へ」を押したら終わり。得点＝マスの枚数
 *
 *   セットの設定: config.gameType = 'territory'、tpRows・tpCols（盤面の大きさ）、tpPrompt（お題）
 *   部屋の状態:   rooms/{id}/status/tp = { rows, cols, cells[], qcells[], labels[], colors{pid:n}, phase, picking, cur,
 *                 show, last{idx,flips[],by,wrong}, seq, round, mode, prompt }
 *                 phase: open（解答権を決める）| pick（マスを選ぶ）| judge（〇✕）| result（結果）| done
 *   解答者の端末から選ぶ時: rooms/{id}/players/{pid}/tpPick = 番号
 * 答えは司会者の端末にだけ持ち、部屋の状態には書かない。
 * 司会者の画面（App.Studio）の流れからは「第1問 開始」で盤面の進行に入り、あとはこのファイルの盤面で進める。
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

    // 盤面の絵（司会者・モニター・解答者で共通）
    //   opts.pickable … 空いているマスを押せる / opts.names … 取った人の名前 / opts.answers … 司会者に答え
    boardHtml: function (tp, players, opts = {}) {
        const { rows, cols } = tp;
        const cells = tp.cells || [];
        const labels = tp.labels || [];
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
            if (last.idx === i && opts.fresh && !last.wrong) cls.push('just');
            if (last.idx === i && last.wrong && tp.phase === 'result') cls.push('miss');
            if (flips.has(i) && opts.fresh) cls.push('flip');
            const lb = labels[i] ? `<span class="tp-lb">${this.esc(labels[i])}</span>` : '';
            const ans = opts.answers && opts.answers[i] && !owner ? `<span class="tp-ans">${this.esc(opts.answers[i])}</span>` : '';
            html += `<div class="${cls.join(' ')}" data-tp="${i}" style="${owner ? `--c:${this.colorOf(tp, owner)};` : ''}">
                <span class="tp-no">${i + 1}</span>${lb}${ans}${owner && opts.names ? `<span class="tp-who">${name(owner)}</span>` : ''}</div>`;
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
    mode: function () {
        const m = (App.Data.currentConfig || {}).mode;
        return m === 'turn' || m === 'nominate' ? m : 'buzz';
    },
    ansText: function (q) {
        const c = q && q.correct;
        return Array.isArray(c) ? c.filter(Boolean).join('・') : String(c ?? '');
    },

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
        const labels = Array(n).fill(''), answers = Array(n).fill('');
        qs.forEach(q => { if (q.tpCell !== null && q.tpCell !== undefined) { labels[q.tpCell] = String(q.q || ''); answers[q.tpCell] = this.ansText(q); } });
        this.answers = answers;
        this.tp = {
            rows, cols, cells: Array(n).fill(''), qcells: Array.from({ length: n }, (_, i) => used.has(i)), labels,
            colors: {}, phase: '', picking: '', cur: -1, show: false, last: null, seq: 0, round: 0, order: [], pi: 0,
            mode: this.mode(), prompt: String(conf.tpPrompt || ''),
        };
        this.started = false;
        this.push();
    },
    // まだ取られていない、問題のあるマス
    remaining: function () {
        const t = this.tp;
        if (!t) return [];
        return t.qcells.map((h, i) => (h && !t.cells[i] ? i : -1)).filter(i => i >= 0);
    },
    // 順番の人（参加した順に回る）
    nextPicker: function () {
        const t = this.tp;
        const ids = Object.keys(App.Data.players || {}).filter(pid => (App.Data.players[pid] || {}).isAlive !== false);
        // 司会者が決めた順番（順番の遊び方の最初に決める）があれば、その順
        const S = this.S();
        if (S && Array.isArray(S.turnOrder) && S.turnOrder.length && !t.order.length) t.order = S.turnOrder.slice();
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
            rows: t.rows, cols: t.cols, cells: t.cells.map(v => v || ''), qcells: t.qcells || null, labels: t.labels.map(v => v || ''),
            cur: t.cur ?? -1, colors: t.colors, picking: t.picking || '', phase: t.phase || '', mode: t.mode, prompt: t.prompt || '',
            show: !!t.show, last: t.last || null, seq: t.seq || 0, round: t.round || 0,
        });
    },
    statusUpdate: function (obj) {
        if (this.room()) window.db.ref(`rooms/${this.room()}/status`).update(obj);
    },
    nameOf: function (pid) { return ((App.Data.players || {})[pid] || {}).name || ''; },

    // 「第1問 開始」— 盤面を出して、最初の回へ
    startGame: function () {
        const t = this.tp;
        if (!t) return;
        if (!this.remaining().length) { App.Ui.showToast('マスに問題がありません'); return; }
        this.started = true;
        t.show = true;
        const S = this.S();
        const qi = (App.Data.studioQuestions || []).findIndex(q => q.tpCell === this.remaining()[0]);
        App.State.currentQIndex = Math.max(0, qi);
        this.statusUpdate({ step: 'answering', qIndex: App.State.currentQIndex, isBuzzActive: false, currentAnswerer: null, currentAnswererName: null });
        if (S) S.currentStepId = 2;
        this.openRound();
        this.openHost();
    },
    // 新しい回 — 解答権を決めるところから
    openRound: function () {
        const t = this.tp;
        const S = this.S();
        if (!t) return;
        if (!this.remaining().length) { this.finish(); return; }
        if (this._pickRef) { this._pickRef.off(); this._pickRef = null; }
        if (S && S.resetPlayerStatus) S.resetPlayerStatus();
        if (S) { S.buzzWinner = null; S.currentStepId = 2; }
        t.round = (t.round || 0) + 1;
        t.picking = ''; t.cur = -1; t.last = null; t.show = true;
        if (t.mode === 'turn') { this.push(); this.askPlayer(this.nextPicker()); return; }
        t.phase = 'open';
        this.push();
        this.statusUpdate({ step: 'answering', isBuzzActive: t.mode === 'buzz', currentAnswerer: null, currentAnswererName: null, tpRound: t.round });
        this.renderHost(false);
    },
    // この人が答える — マスを選ぶ（本人のスマホからも選べる）
    askPlayer: function (pid) {
        const t = this.tp;
        if (!t || !pid) { App.Ui.showToast('参加者がいません'); return; }
        if (t.colors[pid] === undefined) t.colors[pid] = Object.keys(t.colors).length;
        t.phase = 'pick'; t.picking = pid; t.cur = -1;
        this.push();
        this.statusUpdate({ isBuzzActive: false, currentAnswerer: pid, currentAnswererName: this.nameOf(pid), tpRound: t.round });
        window.db.ref(`rooms/${this.room()}/players/${pid}/tpPick`).remove();
        if (this._pickRef) this._pickRef.off();
        this._pickRef = window.db.ref(`rooms/${this.room()}/players/${pid}/tpPick`);
        this._pickRef.on('value', snap => {
            const v = snap.val();
            if (v === null || v === undefined || !this.tp || this.tp.picking !== pid || this.tp.phase !== 'pick') return;
            this.choose(parseInt(v));
        });
        this.renderHost(false);
    },
    // マスが決まった → 答えを見て〇✕
    choose: function (idx) {
        const t = this.tp;
        if (!t || !t.picking || isNaN(idx) || t.cells[idx] || !t.qcells[idx]) return;
        t.cur = idx; t.phase = 'judge';
        this.push();
        this.renderHost(false);
    },
    judge: function (ok) {
        const t = this.tp;
        if (!t || t.phase !== 'judge' || t.cur < 0) return;
        const pid = t.picking, idx = t.cur;
        const S = this.S();
        if (window.App.Studio && S.sendJudgeCue) S.sendJudgeCue(ok, this.nameOf(pid));
        if (this._pickRef) { this._pickRef.off(); this._pickRef = null; }
        window.db.ref(`rooms/${this.room()}/players/${pid}/tpPick`).remove();
        if (ok) {
            const flips = this.flipsFor(t, idx, pid);
            t.cells[idx] = pid;
            flips.forEach(i => { t.cells[i] = pid; });
            t.last = { idx, flips, by: pid };
            t.seq = (t.seq || 0) + 1;
            t.phase = 'result'; t.cur = -1;
            this.push();
            this.syncScores();
            window.db.ref(`rooms/${this.room()}/players/${pid}`).update({ lastResult: 'win' });
            this.statusUpdate({ isBuzzActive: false });
            const name = this.nameOf(pid);
            App.Ui.showToast(flips.length ? `${name} さんが ${idx + 1}番を取り、${flips.length}枚ひっくり返しました` : `${name} さんが ${idx + 1}番を取りました`);
            this.renderHost(true);
            return;
        }
        // 不正解
        t.last = { idx, flips: [], by: pid, wrong: true };
        t.cur = -1;
        window.db.ref(`rooms/${this.room()}/players/${pid}`).update({ lastResult: 'lose', buzzTime: null, buzzPressAt: null });
        if (S) S.buzzWinner = null;
        const conf = App.Data.currentConfig || {};
        if (t.mode === 'buzz' && conf.buzzWrongAction !== 'end') {
            // ほかの人がまだ押せる（間違えた人はこの回は押せない）
            const players = App.Data.players || {};
            const left = Object.keys(players).filter(id => id !== pid && (players[id] || {}).isAlive !== false && (players[id] || {}).lastResult !== 'lose');
            if (left.length) {
                t.phase = 'open'; t.picking = '';
                this.push();
                this.statusUpdate({ isBuzzActive: true, currentAnswerer: null, currentAnswererName: null });
                this.renderHost(false);
                return;
            }
        }
        if (t.mode === 'nominate') {
            t.phase = 'open'; t.picking = '';
            this.push();
            this.statusUpdate({ currentAnswerer: null, currentAnswererName: null });
            this.renderHost(false);
            return;
        }
        t.phase = 'result';
        this.push();
        this.statusUpdate({ isBuzzActive: false });
        this.renderHost(false);
    },
    // 終わり — 結果発表へ（司会者の画面の流れに戻す）
    finish: function () {
        const t = this.tp;
        if (!t) return;
        t.phase = 'done'; t.show = false;
        this.push();
        this.closeHost();
        const S = this.S();
        App.State.currentQIndex = Math.max(0, (App.Data.studioQuestions || []).length - 1);
        if (S && this._origNext) this._origNext.call(S);
    },
    // 早押しで解答権が決まった（司会者の画面の早押しの判定のあと）
    onBuzzWinner: function (pid) {
        const t = this.tp;
        if (!t || t.phase !== 'open' || t.mode !== 'buzz' || !pid) return;
        this.askPlayer(pid);
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

    // 司会者の画面いっぱいの盤面（進行もここで）
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
        const who = t.picking ? `<b style="color:${this.colorOf(t, t.picking)}">${this.esc(this.nameOf(t.picking))}</b> さん` : '';
        let title = '陣取りの盤面', hint = '', acts = '';
        const act = (k, label, cls = '') => `<button type="button" class="tp-act ${cls}" data-act="${k}">${label}</button>`;
        if (t.phase === 'open' && t.mode === 'buzz') {
            title = '早押し受付中';
            hint = '押した人が「◯番、答え」と言います';
        } else if (t.phase === 'open' && t.mode === 'nominate') {
            title = '答える人を指名';
            const ids = Object.keys(players).filter(id => (players[id] || {}).isAlive !== false && (players[id] || {}).lastResult !== 'lose');
            acts = ids.map(id => act('nom:' + id, this.esc((players[id] || {}).name || ''), 'tp-nom')).join('');
        } else if (t.phase === 'pick') {
            title = `${who}が答えます`;
            hint = '言ったマスを押す（本人のスマホからも選べます）';
        } else if (t.phase === 'judge') {
            title = `${who}　${t.cur + 1}番「${this.esc(t.labels[t.cur] || '')}」`;
            hint = `答え：<b class="tp-answer">${this.esc((this.answers || [])[t.cur] || '')}</b>`;
            acts = act('ok', '〇 正解', 'tp-ok') + act('ng', '✕ 不正解', 'tp-ng') + act('repick', 'マスを選び直す');
        } else if (t.phase === 'result') {
            const lb = t.last && t.last.by ? `<b style="color:${this.colorOf(t, t.last.by)}">${this.esc(this.nameOf(t.last.by))}</b> さん` : '';
            title = t.last && t.last.wrong ? `${lb}　${t.last.idx + 1}番は不正解` : t.last ? `${lb}が ${t.last.idx + 1}番を取りました${(t.last.flips || []).length ? `（${t.last.flips.length}枚ひっくり返し）` : ''}` : '';
            hint = `残り ${this.remaining().length}マス`;
            acts = this.remaining().length ? act('next', '次へ', 'tp-main') : act('finish', '結果発表へ', 'tp-main');
        }
        ov.innerHTML = `
            <div class="tp-head">
                <div class="tp-title">${title}</div>
                <button type="button" class="tp-close">閉じる</button>
            </div>
            ${t.prompt ? `<div class="tp-prompt">${this.esc(t.prompt)}</div>` : ''}
            <div class="tp-board">${this.boardHtml(t, players, { pickable: t.phase === 'pick', fresh, names: true, answers: this.answers })}</div>
            <div class="tp-foot">
                <span class="tp-hint">${hint}</span>
                <div class="tp-acts">${acts}</div>
            </div>
            <div class="tp-sub">
                ${t.phase === 'open' && t.mode === 'buzz' ? act('rebuzz', '押し直し') : ''}
                ${t.phase === 'pick' || t.phase === 'judge' ? act('skip', 'この回を飛ばす') : ''}
                <button type="button" class="tp-mon">${t.show ? 'モニターの盤面をしまう' : 'モニターに盤面を出す'}</button>
                ${act('finish', '結果発表へ')}
            </div>`;
        ov.querySelector('.tp-close').onclick = () => this.closeHost();
        ov.querySelector('.tp-mon').onclick = () => { this.setShow(!t.show); this.renderHost(false); };
        ov.querySelectorAll('[data-act]').forEach(b => {
            b.onclick = () => {
                const k = b.dataset.act;
                if (k === 'ok') this.judge(true);
                else if (k === 'ng') this.judge(false);
                else if (k === 'repick') { t.phase = 'pick'; t.cur = -1; this.push(); this.renderHost(false); }
                else if (k === 'next' || k === 'skip' || k === 'rebuzz') this.openRound();
                else if (k === 'finish') this.finish();
                else if (k.startsWith('nom:')) this.askPlayer(k.slice(4));
            };
        });
        if (t.phase === 'pick') ov.querySelectorAll('.tp-cell.can').forEach(c => { c.onclick = () => this.choose(parseInt(c.dataset.tp)); });
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
        const on = () => T.isOn(App.Data.currentConfig);
        // セットを読み込んだら盤面を新しく
        const origSetup = S.setupPeriod;
        if (typeof origSetup === 'function') S.setupPeriod = function () { const r = origSetup.apply(this, arguments); try { T.initBoard(); T.ensureHostButton(); } catch (e) { console.warn('territory', e); } return r; };
        // 早押しで解答権が決まったら、その人がマスを選ぶ
        const origDecide = S.decideBuzz;
        if (typeof origDecide === 'function') S.decideBuzz = function () { const r = origDecide.apply(this, arguments); try { if (on() && T.tp && this.buzzWinner) T.onBuzzWinner(this.buzzWinner); } catch (e) { console.warn('territory', e); } return r; };
        // 「第1問 開始」で盤面の進行に入る
        const origSetStep = S.setStep;
        S.setStep = function (stepId) {
            if (on() && T.tp && stepId >= 1 && stepId <= 5 && T.tp.phase !== 'done') {
                if (!T.started) T.startGame(); else T.openHost();
                return;
            }
            return origSetStep.apply(this, arguments);
        };
        // 次へ — 盤面の次の回（盤面が終わったら、司会者の画面の流れで結果へ）
        T._origNext = S.goNext;
        S.goNext = function () {
            if (!on() || !T.tp || T.tp.phase === 'done') return T._origNext.apply(this, arguments);
            T.openRound(); T.openHost();
        };
    },

    // ---------------------------------------------------------
    // モニター・解答者 — 盤面を出す間だけ画面の上に重ねる
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
        const me = typeof myPlayerId !== 'undefined' ? myPlayerId : null;
        // 解答者の早押しの間は、下の押し面をあけておく
        ov.className = (this._role === 'viewer' ? 'tp-mon' : 'tp-pl') + (this._role === 'player' && tp.phase === 'open' && tp.mode === 'buzz' ? ' tp-pad' : '');
        const players = this._remote.players || {};
        const mine = this._role === 'player' && tp.phase === 'pick' && tp.picking && tp.picking === me;
        const fresh = tp.seq !== this._lastSeq;
        this._lastSeq = tp.seq;
        const nm = (pid) => `<b style="color:${this.colorOf(tp, pid)}">${this.esc((players[pid] || {}).name || '')}</b>`;
        let msg = '陣取りの盤面';
        if (tp.phase === 'open') msg = tp.mode === 'buzz' ? '早押し — 押したら「◯番、答え」' : '司会者が答える人を指名します';
        else if (tp.phase === 'pick') msg = mine ? 'あなたの番 — マスを選んで、答えを言う' : `${nm(tp.picking)} さん、何番？`;
        else if (tp.phase === 'judge') msg = `${nm(tp.picking)} さん　${tp.cur + 1}番「${this.esc((tp.labels || [])[tp.cur] || '')}」`;
        else if (tp.phase === 'result' && tp.last) msg = tp.last.wrong ? `${nm(tp.last.by)} さん　${tp.last.idx + 1}番は不正解` : `${nm(tp.last.by)} さんが ${tp.last.idx + 1}番を取りました${(tp.last.flips || []).length ? `（${tp.last.flips.length}枚ひっくり返し）` : ''}`;
        ov.innerHTML = `${tp.prompt ? `<div class="tp-prompt">${this.esc(tp.prompt)}</div>` : ''}<div class="tp-msg">${msg}</div><div class="tp-board">${this.boardHtml(tp, players, { pickable: mine, fresh, names: this._role === 'viewer' })}</div>`;
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
    if (el && el._key === key && document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-tp-prompt]')) return;
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
        <label class="tpg-prompt"><span>お題（任意）</span><input type="text" data-tp-prompt value="${this.esc(conf.tpPrompt || '')}" placeholder="例: 魚へんの漢字の読み"></label>
        <p class="tpg-note">マスを押して、問題文の欄に<b>表の字</b>（モニターに見せる。例: 鮪）、正解の欄に<b>答え</b>（例: まぐろ）を書きます。出題では盤面全体を出し、「13番、まぐろ」と言って正解したマスを取ります。表の字が無いマスは使いません。</p>`;
    el.querySelectorAll('.tpg-cell').forEach(b => {
        b.onclick = () => this.openCell(parseInt(b.dataset.c));
    });
    const pin = el.querySelector('[data-tp-prompt]');
    if (pin) pin.oninput = () => { conf.tpPrompt = pin.value; };
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


// 出題中の画面のすみに出す小さな盤面 — 「いま何番のマスの問題か」と陣地のようす
//   モニター（viewer.js）と作成画面のプレビュー（creator_mobile.js）で使う
App.Territory.miniBadge = function (stage, conf, cell, tp) {
    if (!stage) return;
    const old = stage.querySelector(':scope > .tp-qbadge');
    const idx = parseInt(cell);
    if (!this.isOn(conf) || isNaN(idx) || idx < 0) { old?.remove(); return; }
    const sz = this.size(conf);
    const rows = (tp && tp.rows) || sz.rows, cols = (tp && tp.cols) || sz.cols;
    const cells = (tp && tp.cells) || [];
    let html = `<div class="tp-qb-label"><b>${idx + 1}</b>番のマス</div><div class="tp-qb-grid" style="grid-template-columns:repeat(${cols}, 1fr); grid-template-rows:repeat(${rows}, 1fr); aspect-ratio:${cols} / ${rows};">`;
    for (let i = 0; i < rows * cols; i++) {
        const owner = cells[i];
        html += `<i class="${i === idx ? 'now' : ''}${owner ? ' own' : ''}" style="${owner ? `--c:${this.colorOf(tp, owner)};` : ''}"></i>`;
    }
    html += '</div>';
    const el = old || document.createElement('div');
    el.className = 'tp-qbadge';
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    if (!old) stage.appendChild(el);
};
// 作成画面で、いま書いている問題のマス
App.Territory.editingCell = function () {
    const C = window.App.Creator;
    const { n, used } = this.assignCells();
    const qs = window.App.Data.createdQuestions || [];
    if (C && C.editingIndex !== null && C.editingIndex !== undefined) return (qs[C.editingIndex] || {}).tpCell;
    if (this._pendingCell !== null && this._pendingCell !== undefined) return this._pendingCell;
    let c = 0; while (c < n && used.has(c)) c++;
    return c < n ? c : null;
};

// 作成画面のプレビュー — 盤面全体（お題・表の字）。正解の場面では答えも出す
App.Territory.previewBoard = function (stage, step) {
    if (!stage) return;
    stage.querySelectorAll(':scope > .tp-pv').forEach(e => e.remove());
    const conf = (window.App.Data && window.App.Data.currentConfig) || {};
    if (!this.isOn(conf) || step === 'bridge') return;
    const { n, rows, cols } = this.assignCells();
    const qs = window.App.Data.createdQuestions || [];
    const labels = Array(n).fill(''), answers = Array(n).fill(''), qcells = Array(n).fill(false);
    qs.forEach(q => { if (q.tpCell !== null && q.tpCell !== undefined) { labels[q.tpCell] = String(q.q || ''); answers[q.tpCell] = this.ansText(q); qcells[q.tpCell] = true; } });
    // 書いている途中の問題も盤面に
    const cur = this.editingCell();
    const qt = (document.getElementById('question-text')?.value || '').trim();
    if (cur !== null && cur !== undefined && cur >= 0 && qt) { labels[cur] = qt; qcells[cur] = true; answers[cur] = (document.getElementById('creator-text-answer')?.value || '').trim(); }
    const tp = { rows, cols, cells: Array(n).fill(''), qcells, labels, colors: {}, cur: cur ?? -1, phase: 'pick' };
    const el = document.createElement('div');
    el.className = 'tp-pv';
    el.innerHTML = `${conf.tpPrompt ? `<div class="tp-prompt">${this.esc(conf.tpPrompt)}</div>` : ''}<div class="tp-msg">${step === 'answer' ? '盤面と答え（司会者の画面と同じ）' : '「13番、まぐろ」のように番号と答えを言って、正解したマスを取る'}</div><div class="tp-board">${this.boardHtml(tp, {}, { answers: step === 'answer' ? answers : null })}</div>`;
    stage.appendChild(el);
};
