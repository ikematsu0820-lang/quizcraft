/* =========================================================
 * trial.js — お試し（プレビューの「お試し」）
 *
 * 今書いている1問を、その場で遊んで操作感を確かめる。端末1台で完結し、
 * 部屋は作らず、何も保存せず、通信もしない。
 *   上: モニター（本番と同じ描画）
 *   中: 解答者の画面（自分が「あなた」として参加し、押す・選ぶ・書く）
 *   下: 司会者バー（進行ボタン・〇✕・確認）— 見えない所で動く司会者の画面を写す
 * 司会者・モニター・解答者は、本番と同じ画面（index.html）を iframe で開き、
 * 通信の代わりに端末の中だけのデータベース（local_db.js）でつなぐ（?local=1）。
 * 仮の参加者（Aさん・Bさん）が、少し遅れて押したり答えたりする（切り替えで外せる）。
 * セット全体の通しや、複数の端末での確認は「テストプレイ」で。
 * =======================================================*/
window.App = window.App || {};

App.Trial = {
    BOTS: [{ id: 'botA', name: 'Aさん（仮）' }, { id: 'botB', name: 'Bさん（仮）' }],
    bots: true,

    esc: function (v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },

    open: function () {
        const M = window.App.CreatorMobile;
        if (!M || !window.LocalDb) return;
        // 陣取りパネルは盤面ごとで1問 — セットの盤面全体で遊ぶ
        if (window.App.Territory && window.App.Territory.isOn(window.App.Data.currentConfig)) { this.openBoard(); return; }
        let q = M.previewQuestion();
        if (!q || !q.q || /^（ここに問題文/.test(q.q)) { window.App.Dialog.alert('問題文を入れてから試せます。'); return; }
        const QC = window.App.QuizCheck;
        if (QC) {
            const bad = QC.incompleteIn([q]);
            if (bad.length) { window.App.Dialog.alert(`この問題はまだ完成していません。\n${QC.describe(bad)}`, { title: 'お試し' }); return; }
        }
        q = JSON.parse(JSON.stringify(q)); // undefined を落とす
        const conf = JSON.parse(JSON.stringify(window.App.Data.currentConfig || {}));
        this.begin(conf, [q]);
    },
    // 盤面全体（陣取り）— 書いた問題と、書いている途中のマスも入れる
    openBoard: function () {
        const T = window.App.Territory, C = window.App.Creator, M = window.App.CreatorMobile;
        T.assignCells();
        const qs = JSON.parse(JSON.stringify(window.App.Data.createdQuestions || []));
        const cur = T.editingCell();
        const qt = (document.getElementById('question-text')?.value || '').trim();
        if (qt && cur !== null && cur !== undefined && cur >= 0) {
            const pq = JSON.parse(JSON.stringify(M.previewQuestion()));
            pq.tpCell = cur;
            const at = (C && C.editingIndex !== null && C.editingIndex !== undefined) ? C.editingIndex : qs.findIndex(x => x.tpCell === cur);
            if (at >= 0 && qs[at]) qs[at] = Object.assign({}, qs[at], pq); else qs.push(pq);
        }
        const usable = qs.filter(x => x && String(x.q || '').trim() && x.tpCell !== null && x.tpCell !== undefined);
        if (!usable.length) { window.App.Dialog.alert('盤面のマスに、表の字と答えを入れてから試せます。', { title: 'お試し' }); return; }
        const conf = JSON.parse(JSON.stringify(window.App.Data.currentConfig || {}));
        this.begin(conf, usable);
    },
    begin: function (conf, questions) {
        this.id = `TEST-T${Math.floor(Math.random() * 9000) + 1000}`;
        this.q = questions[0];
        this.conf = conf;
        this.board = !!(window.App.Territory && window.App.Territory.isOn(conf));
        this.store = window.LocalDb.createStore();
        window.__trialStore = this.store;
        this.db = window.LocalDb.client(this.store);
        this.db.ref(`saved_sets/${this.id}`).set({ title: 'お試し', config: conf, questions });
        this.render();
        this.start();
    },

    render: function () {
        document.getElementById('trial-ov')?.remove();
        const ov = document.createElement('div');
        ov.id = 'trial-ov';
        ov.innerHTML = `
            <div class="tr-head">
                <div class="tr-title"><b>お試し</b><span>${this.board ? 'この盤面をその場で遊べます' : 'この1問をその場で遊べます'}。保存はしません</span></div>
                <label class="tr-bots"><input type="checkbox" ${this.bots ? 'checked' : ''}><span>仮の参加者</span></label>
                <button type="button" class="tr-close">閉じる</button>
            </div>
            <div class="tr-body">
                <div class="tr-mon"><iframe title="モニター" class="tr-f-mon"></iframe></div>
                <div class="tr-pl"><div class="tr-label">あなた（解答者）</div><iframe title="解答者" class="tr-f-pl"></iframe></div>
            </div>
            <div class="tr-bar"><div class="tr-hint">準備しています</div><div class="tr-btns"></div></div>
            <iframe title="司会者" class="tr-f-host" tabindex="-1" aria-hidden="true"></iframe>`;
        document.body.appendChild(ov);
        document.body.classList.add('cm-noscroll');
        ov.querySelector('.tr-close').onclick = () => this.close();
        ov.querySelector('.tr-bots input').onchange = (e) => this.setBots(e.target.checked);
        this.ov = ov;
    },

    url: function (params) {
        return `${location.pathname}?local=1&${params}`;
    },

    start: function () {
        const ov = this.ov;
        ov.querySelector('.tr-f-host').src = this.url(`testHost=${this.id}&tp=0&sid=${encodeURIComponent((window.App.State && window.App.State.currentShowId) || 'TRIAL')}`);
        // 司会者が部屋を作ったら、モニターと解答者を開く
        const wait = () => {
            if (!this.ov) return;
            const st = this.store.root.rooms && this.store.root.rooms[this.id] && this.store.root.rooms[this.id].status;
            if (!st) { this._wait = setTimeout(wait, 150); return; }
            ov.querySelector('.tr-f-mon').src = this.url(`vcode=${this.id}`);
            ov.querySelector('.tr-f-pl').src = this.url(`room=${this.id}&autoName=${encodeURIComponent('あなた')}`);
            if (this.bots) this.addBots();
            this.watchBots();
        };
        wait();
        this._tick = setInterval(() => this.mirror(), 250);
    },

    close: function () {
        clearInterval(this._tick);
        clearTimeout(this._wait);
        (this._botTimers || []).forEach(t => clearTimeout(t));
        this._botTimers = [];
        if (this._stRef) this._stRef.off();
        this.ov?.remove();
        this.ov = null;
        if (this.store) { this.store.listeners.length = 0; this.store = null; }
        try { delete window.__trialStore; } catch (e) { window.__trialStore = null; }
        const M = window.App.CreatorMobile;
        if (!(M && M._sheet)) document.body.classList.remove('cm-noscroll');
    },

    // ---------------------------------------------------------
    // 司会者バー — 見えない所の司会者の画面から、今押せるものを写す
    // ---------------------------------------------------------
    mirror: function () {
        if (!this.ov) return;
        let hd;
        try { hd = this.ov.querySelector('.tr-f-host').contentDocument; } catch (e) { return; }
        if (!hd || !hd.body) return;
        const vis = (el) => el && !el.classList.contains('hidden') && el.offsetParent !== null;
        let mode = '', hint = '', btns = [];
        const dlg = hd.querySelector('.qd-ov');
        const judge = hd.getElementById('hc-judge');
        const main = hd.getElementById('console-btn-phase-main');
        const tph = hd.getElementById('tp-host');
        if (tph && !dlg) {
            // 陣取りの盤面 — 司会者の盤面の見出しと操作を写す（マスは解答者・仮の参加者が選ぶ）
            mode = 'tp';
            hint = [tph.querySelector('.tp-title')?.textContent, tph.querySelector('.tp-hint')?.textContent].filter(Boolean).join(' — ');
            btns = [...tph.querySelectorAll('.tp-acts [data-act]')].map((b, i) => ({ t: b.textContent.trim(), cls: b.classList.contains('tp-ok') ? 'okj' : b.classList.contains('tp-ng') ? 'ngj' : b.classList.contains('tp-main') ? 'ok' : 'sub', el: b, k: 't' + i }));
            const fin = tph.querySelector('.tp-sub [data-act="finish"]');
            if (fin && !btns.some(x => /結果発表/.test(x.t))) btns.push({ t: '結果発表へ', cls: 'sub', el: fin, k: 'fin' });
        } else if (dlg && /すべて終了/.test(dlg.textContent || '')) {
            // 1問で終わり — セットの終わりの案内の代わりに「もう一度」「問題に戻る」
            mode = 'end';
            hint = 'お試しが終わりました';
            btns = [
                { t: 'もう一度', cls: 'sub', run: () => { this.close(); this.open(); }, k: 'again' },
                { t: '問題に戻る', cls: 'ok', run: () => this.close(), k: 'back' },
            ];
        } else if (dlg) {
            mode = 'dlg';
            hint = [dlg.querySelector('.qd-title')?.textContent, dlg.querySelector('.qd-msg')?.textContent].filter(Boolean).join(' — ');
            btns = [...dlg.querySelectorAll('.qd-btn')].map((b, i) => ({ t: b.textContent.trim(), cls: b.classList.contains('qd-ok') ? 'ok' : 'sub', el: b, k: 'd' + i }));
        } else if (vis(judge)) {
            mode = 'judge';
            const who = (judge.querySelector('.hc-judge-who b')?.textContent || judge.querySelector('.hc-judge-who')?.textContent || '').trim();
            hint = `${who} さんの解答を判定`;
            btns = [
                { t: '〇 正解', cls: 'okj', el: judge.querySelector('.hc-judge-ok'), k: 'ok' },
                { t: '✕ 不正解', cls: 'ngj', el: judge.querySelector('.hc-judge-ng'), k: 'ng' },
            ];
        } else if (main && main.offsetParent !== null) {
            mode = 'main';
            hint = (hd.getElementById('hc-next')?.innerText || '').replace(/\s+/g, ' ').replace(/^▼\s*/, '').trim();
            // 順番の遊び方: 本番では司会者が順番を決めるが、お試しは参加した順で始める
            const pre = () => {
                const W = this.ov.querySelector('.tr-f-host').contentWindow;
                const S = W && W.App && W.App.Studio;
                const setup = hd.getElementById('turn-order-setup');
                if (S && setup && !S.isTurnOrderConfirmed) {
                    const ok = [...setup.querySelectorAll('button')].find(x => /順番を確定/.test(x.textContent) && !x.disabled);
                    if (ok) ok.click(); else { S.turnOrder = Object.keys(W.App.Data.players || {}); S.isTurnOrderConfirmed = true; }
                    return true; // 確定してから進行ボタンを押す
                }
                return false;
            };
            btns = [{ t: main.innerText.replace(/\s+/g, ' ').trim(), cls: 'ok', el: main, k: 'main', off: main.disabled && !hd.getElementById('turn-order-setup'), pre }];
        }
        const key = JSON.stringify([mode, hint, btns.map(b => [b.t, b.cls, b.off])]);
        this._btnEls = btns;
        if (key === this._barKey) return;
        this._barKey = key;
        const bar = this.ov.querySelector('.tr-bar');
        bar.querySelector('.tr-hint').textContent = hint || (mode ? '' : '準備しています');
        bar.querySelector('.tr-btns').innerHTML = btns.map((b, i) => `<button type="button" class="tr-b ${b.cls}" data-i="${i}" ${b.off ? 'disabled' : ''}>${this.esc(b.t)}</button>`).join('');
        bar.querySelectorAll('.tr-b').forEach(b => {
            b.onclick = () => { const t = (this._btnEls || [])[parseInt(b.dataset.i)]; if (t && t.run) { t.run(); return; } const waited = t && t.pre ? t.pre() : false; if (t && t.el) { if (waited) {
                    // 順番を確定した直後の1回目は「順番を決める画面」を閉じるだけなので、進まなければもう1回押す
                    const W = this.ov.querySelector('.tr-f-host').contentWindow;
                    setTimeout(() => { t.el.disabled = false; t.el.click(); setTimeout(() => { if (W && W.App && W.App.Studio && W.App.Studio.currentStepId === 0) t.el.click(); }, 400); }, 300);
                } else t.el.click(); } this._barKey = null; setTimeout(() => this.mirror(), 60); };
        });
    },

    // ---------------------------------------------------------
    // 仮の参加者 — 少し遅れて押す・答える（当たるのは半分くらい）
    // ---------------------------------------------------------
    setBots: function (on) {
        this.bots = on;
        if (!this.db) return;
        if (on) this.addBots();
        else this.BOTS.forEach(b => this.db.ref(`rooms/${this.id}/players/${b.id}`).remove());
    },
    addBots: function () {
        this.BOTS.forEach(b => this.db.ref(`rooms/${this.id}/players/${b.id}`).set({ name: b.name, isAlive: true, periodScore: 0, periodTime: 0, bot: true }));
    },
    watchBots: function () {
        this._botTimers = [];
        this._done = {};
        this._stRef = this.db.ref(`rooms/${this.id}/status`);
        this._stRef.on('value', s => this.onStatus(s.val() || {}));
    },
    onStatus: function (st) {
        if (!this.bots || !this.ov) return;
        const q = this.q, conf = this.conf;
        const asking = ['reveal_q', 'answering'].includes(st.step);
        if (!asking) return;
        const mode = conf.mode || 'normal';
        const tp = st.tp || null;
        // 陣取り: 自分の番になったら、空いているマスを選ぶ
        if (this.board && tp && tp.phase === 'pick') {
            const b = this.BOTS.find(x => x.id === tp.picking);
            const pk = `pick:${tp.picking}:${tp.round}`;
            if (b && !this._done[pk]) {
                this._done[pk] = true;
                this._botTimers.push(setTimeout(() => {
                    const free = (tp.qcells || []).map((h, i) => (h && !(tp.cells || [])[i] ? i : -1)).filter(i => i >= 0);
                    if (free.length) this.db.ref(`rooms/${this.id}/players/${b.id}/tpPick`).set(free[Math.floor(Math.random() * free.length)]);
                }, 1300));
            }
        }
        this.BOTS.forEach((b, i) => {
            const key = `${b.id}:${st.qIndex}:${st.tpRound || 0}`;
            if (this._done[key]) return;
            if (mode === 'buzz') {
                if (!st.isBuzzActive || st.currentAnswerer) return;
                this._done[key] = true;
                const wait = 2200 + Math.random() * 3500 + i * 600;
                this._botTimers.push(setTimeout(() => this.botBuzz(b), wait));
            } else if (mode === 'normal') {
                this._done[key] = true;
                const wait = 1500 + Math.random() * 4000 + i * 500;
                this._botTimers.push(setTimeout(() => this.botAnswer(b, q), wait));
            }
            // 順番・指名は司会者が判定するだけなので、仮の参加者は何もしない
        });
    },
    botBuzz: function (b) {
        if (!this.db || !this.bots) return;
        const st = (this.store.root.rooms || {})[this.id]?.status || {};
        const me = ((this.store.root.rooms || {})[this.id]?.players || {})[b.id];
        if (!me || !st.isBuzzActive || st.currentAnswerer || me.lastResult) return;
        const now = Date.now();
        this.db.ref(`rooms/${this.id}/players/${b.id}`).update({ buzzTime: now, buzzPressAt: now });
    },
    botAnswer: function (b, q) {
        if (!this.db || !this.bots) return;
        const st = (this.store.root.rooms || {})[this.id]?.status || {};
        if (!['reveal_q', 'answering'].includes(st.step)) return;
        const right = Math.random() < 0.5;
        const t = String(q.type || '');
        let ans = null;
        if (t === 'choice' && Array.isArray(q.c)) {
            const corr = (Array.isArray(q.correct) ? q.correct : [q.correct]).map(Number).filter(n => !isNaN(n));
            const n = q.c.length;
            if (q.multiCorrect) ans = right ? corr : [Math.floor(Math.random() * n)];
            else { const wrong = [...Array(n).keys()].filter(x => !corr.includes(x)); ans = right || !wrong.length ? corr[0] : wrong[Math.floor(Math.random() * wrong.length)]; }
        } else if (t === 'sort' && Array.isArray(q.correct)) {
            const order = q.correct.map(Number);
            const arr = right ? order : order.slice().sort(() => Math.random() - 0.5);
            ans = arr.map(i => String.fromCharCode(65 + i)).join('');
        } else if (/^(free|assoc)/.test(t)) {
            ans = right ? String(Array.isArray(q.correct) ? q.correct[0] : (q.correct || '')) : 'わからない';
        } else if (t === 'letter_select') {
            ans = right ? String(q.correct || '') : 'ー';
        }
        if (ans === null || ans === undefined) return;
        const now = Date.now();
        this.db.ref(`rooms/${this.id}/players/${b.id}`).update({ lastAnswer: ans, answerTime: now, answerPressAt: now });
    },
};
