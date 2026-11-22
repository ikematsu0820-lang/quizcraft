/* =========================================================
 * host_console.js — 出題者（司会者）画面の、本番中に使う部品
 *
 *   ・時計     … 問題の時計・答える人の時計・持ち時間を上に大きく。止める／再開／+10秒
 *   ・判定     … 判定が要る時だけ、画面の下（親指の位置）に大きな〇✕
 *   ・1つ戻る  … 進行と判定を1つずつ取り消す（得点・解答・状態をその時点に戻す）
 *   ・得点     … 参加者リストで ±1・数字で直す
 *   ・進み具合 … 「第1問／全10問・解答受付中」と、進行ボタンを押すと何が起きるか
 *   ・順位     … スマホは上に上位3人、PCは参加者リストを常に左に
 * host_studio.js（App.Studio）の関数を包んで足しているので、元の進行はそのまま。
 * =======================================================*/

window.App = window.App || {};

App.HostConsole = {
    S: function () { return window.App.Studio; },
    room: function () { return window.App.State && window.App.State.currentRoomId; },
    esc: function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

    // ---------------------------------------------------------
    // 部品を置く
    // ---------------------------------------------------------
    mount: function () {
        const view = document.getElementById('host-control-view');
        if (!view || document.getElementById('hc-clock')) return;
        // 時計（進み具合の下）
        const controls = view.querySelector('.simple-studio-controls');
        if (controls) {
            const clock = document.createElement('div');
            clock.id = 'hc-clock';
            clock.className = 'hc-clock hidden';
            clock.innerHTML = `
                <div class="hc-clock-main"><span class="hc-clock-k">問題</span><b class="hc-clock-v">--</b><span class="hc-clock-bar"><i></i></span></div>
                <div class="hc-clock-ans hidden"><span class="hc-clock-k"></span><b class="hc-clock-v"></b></div>
                <div class="hc-clock-btns">
                    <button type="button" class="hc-btn" data-hc="pause">止める</button>
                    <button type="button" class="hc-btn" data-hc="plus">+10秒</button>
                </div>`;
            controls.appendChild(clock);
            clock.querySelector('[data-hc="pause"]').onclick = () => this.togglePause();
            clock.querySelector('[data-hc="plus"]').onclick = () => { if (this.S().extendTimer(10)) window.App.Ui.showToast('問題の時計を +10秒'); };
            // 上位3人（スマホ）
            const top = document.createElement('div');
            top.id = 'hc-top3';
            top.className = 'hc-top3 hidden';
            controls.appendChild(top);
        }
        // 判定・1つ戻る・次に起きること（進行ボタンの上）
        const bar = view.querySelector('.studio-bottom-bar');
        const main = document.getElementById('console-btn-phase-main');
        if (bar && main) {
            const judge = document.createElement('div');
            judge.id = 'hc-judge';
            judge.className = 'hc-judge hidden';
            judge.innerHTML = `
                <div class="hc-judge-who"></div>
                <div class="hc-judge-btns">
                    <button type="button" class="hc-judge-ok" aria-label="正解">〇<small>正解</small></button>
                    <button type="button" class="hc-judge-ng" aria-label="不正解">✕<small>不正解</small></button>
                </div>`;
            bar.insertBefore(judge, main);
            judge.querySelector('.hc-judge-ok').onclick = () => this.clickDesk('1');
            judge.querySelector('.hc-judge-ng').onclick = () => this.clickDesk('0');

            const row = document.createElement('div');
            row.id = 'hc-row';
            row.className = 'hc-row';
            row.innerHTML = `<button type="button" id="hc-back" class="hc-back" disabled>1つ戻る</button>`;
            bar.insertBefore(row, main);
            // 「押すと何が起きるか」は進行ボタンのすぐ上に、矢印付きで（1つ戻るの説明と間違えないように）
            const next = document.createElement('div');
            next.id = 'hc-next';
            next.className = 'hc-next';
            bar.insertBefore(next, main);
            row.querySelector('#hc-back').onclick = () => this.back();
            // 進行ボタンの文字が変わったら「押すと何が起きるか」も変える
            if (window.MutationObserver) new MutationObserver(() => this.updateNext()).observe(main, { childList: true, characterData: true, subtree: true });
        }
        // PC: モニターの縮小表示（別の端末と同じモニター画面を埋め込む）
        const mainArea = view.querySelector('.simple-studio-main');
        if (mainArea && !document.getElementById('hc-monitor')) {
            const mon = document.createElement('div');
            mon.id = 'hc-monitor';
            mon.className = 'hc-monitor';
            mon.innerHTML = `<div class="hc-monitor-head"><span>モニター</span><button type="button" class="hc-btn" data-hc="mon">表示する</button></div><div class="hc-monitor-frame"></div>`;
            mainArea.insertBefore(mon, mainArea.firstChild);
            mon.querySelector('[data-hc="mon"]').onclick = () => this.toggleMonitor();
        }
        if (!this._tick) this._tick = setInterval(() => this.tick(), 200);
    },

    // ---------------------------------------------------------
    // 時計
    // ---------------------------------------------------------
    fmt: function (ms) {
        const s = Math.max(0, ms) / 1000;
        if (s >= 60) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
        return s < 10 ? s.toFixed(1) : String(Math.ceil(s));
    },
    tick: function () {
        const S = this.S();
        const box = document.getElementById('hc-clock');
        if (!S || !box) return;
        const view = document.getElementById('host-control-view');
        if (!view || view.classList.contains('hidden')) return;
        const t = S._timer;
        const a = S._answerLocal;
        const has = !!(t || a);
        box.classList.toggle('hidden', !has);
        if (!has) return;
        const mainEl = box.querySelector('.hc-clock-main');
        mainEl.classList.toggle('hidden', !t);
        if (t) {
            const rem = S._timerRemaining();
            mainEl.querySelector('.hc-clock-k').textContent = t.kind === 'pool' ? 'セット全体' : '問題';
            mainEl.querySelector('.hc-clock-v').textContent = this.fmt(rem);
            mainEl.querySelector('.hc-clock-bar i').style.width = `${Math.max(0, Math.min(100, (rem / (t.totalMs || 1)) * 100))}%`;
            mainEl.classList.toggle('warn', rem <= 5000);
            mainEl.classList.toggle('paused', !t.running);
            box.querySelector('[data-hc="pause"]').textContent = t.running ? '止める' : '再開';
        }
        box.querySelector('.hc-clock-btns').classList.toggle('hidden', !t);
        const ansEl = box.querySelector('.hc-clock-ans');
        ansEl.classList.toggle('hidden', !a);
        if (a) {
            const p = (window.App.Data.players || {})[a.pid] || {};
            const left = a.ms === Infinity ? null : a.ms - (Date.now() - a.start);
            ansEl.querySelector('.hc-clock-k').textContent = `${p.name || '---'} さん${a.personal ? 'の持ち時間' : ''}`;
            ansEl.querySelector('.hc-clock-v').textContent = left === null ? '' : this.fmt(left);
            ansEl.classList.toggle('warn', left !== null && left <= 3000);
        }
    },
    togglePause: function () {
        const S = this.S();
        const t = S._timer;
        if (!t) return;
        if (t.running) { S.pauseTimer(); this._manualPause = true; }
        else { S.resumeTimer(); this._manualPause = false; }
    },

    // ---------------------------------------------------------
    // 判定（下に大きく）— 解答ボードの〇✕と同じ動き
    // ---------------------------------------------------------
    clickDesk: function (v) {
        const b = document.querySelector(`#console-judge-panel [data-desk-judge="${v}"]`);
        if (b) b.click();
    },
    syncJudge: function () {
        const bar = document.getElementById('hc-judge');
        if (!bar) return;
        const ok = document.querySelector('#console-judge-panel [data-desk-judge="1"]');
        const can = !!(ok && ok.style.opacity !== '0.3' && ok.style.cursor === 'pointer');
        const S = this.S();
        const step = S && S.currentStepId;
        const show = can && [2, 3].includes(step);
        bar.classList.toggle('hidden', !show);
        document.getElementById('host-control-view')?.classList.toggle('hc-judging', show);
        if (!show) return;
        const nameEl = document.querySelector('#console-answer-board > div:first-child');
        const who = nameEl && nameEl.children.length === 0 ? nameEl.textContent : '';
        const img = document.querySelector('#console-answer-board img');
        let txt = !img ? (document.querySelector('#console-answer-board > div:last-child')?.innerText || '').trim() : '';
        if (/口頭の解答を聞いて/.test(txt)) txt = '口頭の答えを聞いて判定';
        bar.querySelector('.hc-judge-who').innerHTML = `<b>${this.esc(who || '解答')}</b>${img ? '<span>手書きの答えは上の解答ボード</span>' : txt && txt !== who ? `<span>${this.esc(txt.slice(0, 40))}</span>` : ''}`;
    },

    // ---------------------------------------------------------
    // 1つ戻る — 進行（setStep / goNext）と判定の前に、その時の状態を控える
    // ---------------------------------------------------------
    history: [],
    _depth: 0,
    _status: null,
    watchStatus: function () {
        const room = this.room();
        if (!room || this._watchRoom === room || !window.db) return;
        if (this._watchRoom) window.db.ref(`rooms/${this._watchRoom}/status`).off('value', this._statusCb);
        this._watchRoom = room;
        this.history = [];
        this._statusCb = (snap) => { this._status = snap.val(); };
        window.db.ref(`rooms/${room}/status`).on('value', this._statusCb);
    },
    STUDIO_KEYS: ['buzzWinner', 'turnIndex', 'turnAdvancedThisQ', '_qWinners', '_wbWinners', 'revealedMultiIndices', '_nominatedId', '_turnTried', '_pclock', '_correctShown', '_answersOpened', '_poolRemaining', 'soloState', '_deskSelected'],
    snapshot: function (label) {
        const S = this.S();
        if (!S || !this.room()) return;
        this.watchStatus();
        const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
        const studio = {};
        this.STUDIO_KEYS.forEach(k => { studio[k] = clone(S[k]); });
        this.history.push({
            label, at: Date.now(),
            qIndex: window.App.State.currentQIndex,
            step: S.currentStepId,
            players: clone(window.App.Data.players || {}),
            status: clone(this._status || {}),
            studio,
            timerRemain: S._timer ? S._timerRemaining() : null,
        });
        if (this.history.length > 30) this.history.shift();
        this.updateBack();
    },
    wrap: function (name, label) {
        const S = this.S();
        const orig = S && S[name];
        if (typeof orig !== 'function' || orig._hcWrapped) return;
        const self = this;
        const isJudge = name !== 'setStep' && name !== 'goNext';
        const w = function () {
            // 判定のすぐ後に自動で進む進行（正解→結果発表など）は、判定と1つにまとめる
            const autoAfterJudge = !isJudge && self._lastJudgeAt && Date.now() - self._lastJudgeAt < 2500;
            // 控えるのに失敗しても、進行・判定は止めない
            if (self._depth === 0 && !self._restoring && !autoAfterJudge) {
                try { self.snapshot(typeof label === 'function' ? label.apply(this, arguments) : label); } catch (e) { console.warn('host_console snapshot', e); }
            }
            if (isJudge && self._depth === 0) self._lastJudgeAt = Date.now();
            self._depth++;
            try { return orig.apply(this, arguments); } finally { self._depth--; }
        };
        w._hcWrapped = true;
        S[name] = w;
    },
    back: function () {
        this._lastJudgeAt = 0;
        const S = this.S();
        const room = this.room();
        const h = this.history.pop();
        this.updateBack();
        if (!h || !S || !room) return;
        this._restoring = true;
        try {
            const sameQ = h.qIndex === window.App.State.currentQIndex;
            window.App.State.currentQIndex = h.qIndex;
            this.STUDIO_KEYS.forEach(k => { S[k] = h.studio[k] === undefined ? (k === 'buzzWinner' || k === '_nominatedId' ? null : S[k]) : h.studio[k]; });
            if (!sameQ || h.step !== S.currentStepId) {
                S.clearAnswerTimer();
                S.setStep(h.step);
            } else {
                S.clearAnswerTimer();
            }
            // 進行を入り直した後で、得点・解答・状態を控えた時点に戻す
            setTimeout(() => {
                const now = window.App.Data.players || {};
                const updates = {};
                Object.keys(now).forEach(pid => { if (h.players[pid]) updates[pid] = h.players[pid]; });
                Object.keys(updates).forEach(pid => window.db.ref(`rooms/${room}/players/${pid}`).set(updates[pid]));
                const st = Object.assign({}, h.status);
                delete st.timer; delete st.answerTimer;
                window.db.ref(`rooms/${room}/status`).update(st);
                if (S._timer && h.timerRemain !== null) {
                    S._timer.remainMs = h.timerRemain;
                    S._timer.startLocal = Date.now();
                    S._writeTimer(); S._armTimer();
                }
                // 早押しの解答者・順番の人の時計を、控えた時点の人で始め直す
                const who = h.status && h.status.currentAnswerer;
                if (who && [2, 3].includes(S.currentStepId)) {
                    S.startAnswerTimer(who);
                    // 早押しで誰かが答えている間は、問題の時計を止めたまま（ルール「押したら止める」）
                    if ((window.App.Data.currentConfig || {}).mode === 'buzz' && S._timerConf().pauseOnBuzz) S.pauseTimer();
                }
                if (S._deskPlayers && S.renderAnswerDesk) S.renderAnswerDesk(S._deskPlayers);
                this._restoring = false;
                window.App.Ui.showToast(`1つ戻しました（${h.label}の前）`);
            }, 60);
        } catch (e) {
            this._restoring = false;
            console.warn('host_console back', e);
        }
    },
    updateBack: function () {
        const b = document.getElementById('hc-back');
        if (!b) return;
        const h = this.history[this.history.length - 1];
        b.disabled = !h;
        b.title = h ? `「${h.label}」の前に戻す` : '';
        b.textContent = h ? `1つ戻る（${h.label}）` : '1つ戻る';
    },

    // ---------------------------------------------------------
    // 進み具合 —「第1問／全10問・解答受付中」と、進行ボタンで何が起きるか
    // ---------------------------------------------------------
    PHASE: { 0: '始まる前', 1: '番号を表示中', 2: '解答受付中', 3: '締め切り', 4: '結果を表示中', 5: '正解を表示中', 6: '判定中', 7: '結果' },
    updateProgress: function (stepId) {
        const el = document.getElementById('studio-q-number-large');
        const qs = window.App.Data.studioQuestions || [];
        if (!el || !qs.length) return;
        const i = (window.App.State.currentQIndex || 0) + 1;
        el.innerHTML = `<b>第${i}問</b><span class="hc-of">／全${qs.length}問</span><span class="hc-phase">${this.PHASE[stepId] || ''}</span>`;
    },
    NEXT: [
        [/開始/, 'モニターに問題の番号を出します'],
        [/問題を表示/, '問題をモニターと回答者に出し、解答を受け付けます'],
        [/正解を表示/, 'モニターに正解を出します（解答の受付は締め切り）'],
        [/結果発表/, 'この問題の結果（正解した人）をモニターに出します'],
        [/解答オープン/, '全員の解答をモニターに並べます'],
        [/次の問題/, '次の問題へ進みます'],
        [/次のセット/, '次のセットへ進みます'],
        [/最終結果/, '最終結果を出します'],
    ],
    updateNext: function () {
        const main = document.getElementById('console-btn-phase-main');
        const el = document.getElementById('hc-next');
        if (!main || !el) return;
        const t = (main.textContent || '').trim();
        const hit = this.NEXT.find(([re]) => re.test(t));
        el.textContent = hit ? `▼ 「${t}」を押すと、${hit[1]}` : '';
    },

    // ---------------------------------------------------------
    // 得点を直す（参加者リスト）・上位3人（スマホ）
    // ---------------------------------------------------------
    addScoreControls: function (players) {
        const grid = document.getElementById('console-participants-grid');
        if (!grid || !Array.isArray(players)) return;
        [...grid.children].forEach((card, i) => {
            const p = players[i];
            if (!p || card.querySelector('.hc-score')) return;
            const box = document.createElement('div');
            box.className = 'hc-score';
            box.innerHTML = `<button type="button" data-d="-1">−1</button><button type="button" data-d="set">直す</button><button type="button" data-d="1">＋1</button>`;
            box.onclick = async (e) => {
                e.stopPropagation();
                const b = e.target.closest('button');
                if (!b) return;
                const cur = Number(((window.App.Data.players || {})[p.id] || {}).periodScore) || 0;
                let next;
                if (b.dataset.d === 'set') {
                    const v = await window.App.Dialog.number(`${p.name || '---'} さんの得点`, String(cur), { ok: '直す' });
                    if (v === null) return;
                    next = v;
                } else next = cur + Number(b.dataset.d);
                this.snapshot(`${p.name || '---'} さんの得点`);
                const diff = next - cur;
                const tot = Number(((window.App.Data.players || {})[p.id] || {}).totalScore) || 0;
                window.db.ref(`rooms/${this.room()}/players/${p.id}`).update({ periodScore: next, totalScore: tot + diff });
            };
            card.appendChild(box);
        });
    },
    updateTop3: function (players) {
        const el = document.getElementById('hc-top3');
        if (!el) return;
        const list = Object.values(players || {}).filter(p => p && p.name).sort((a, b) => (Number(b.periodScore) || 0) - (Number(a.periodScore) || 0));
        const S = this.S();
        const show = list.length > 0 && S && S.currentStepId > 0;
        el.classList.toggle('hidden', !show);
        if (!show) return;
        el.innerHTML = list.slice(0, 3).map((p, i) => `<span><i>${i + 1}</i>${this.esc(p.name)}<b>${Number(p.periodScore) || 0}</b></span>`).join('') + (list.length > 3 ? `<em>ほか${list.length - 3}人</em>` : '');
    },

    // ---------------------------------------------------------
    // PC: モニターの縮小表示（別の端末のモニターと同じ画面）
    // ---------------------------------------------------------
    toggleMonitor: function () {
        const box = document.getElementById('hc-monitor');
        const frame = box && box.querySelector('.hc-monitor-frame');
        const btn = box && box.querySelector('[data-hc="mon"]');
        if (!frame) return;
        if (frame.firstChild) { frame.innerHTML = ''; box.classList.remove('on'); btn.textContent = '表示する'; return; }
        const room = this.room();
        if (!room) return;
        const url = `${location.pathname}?vcode=${encodeURIComponent(room)}`;
        frame.innerHTML = `<iframe src="${url}" title="モニター" loading="lazy"></iframe>`;
        box.classList.add('on');
        btn.textContent = '隠す';
    },
};

// App.Studio の関数を包む（読み込み順: host_studio.js の後）
(function hookHostConsole() {
    const S = window.App.Studio;
    const H = App.HostConsole;
    if (!S) return;
    const after = (name, fn) => {
        const orig = S[name];
        if (typeof orig !== 'function') return;
        S[name] = function () {
            const r = orig.apply(this, arguments);
            try { fn.apply(this, arguments); } catch (e) { console.warn('host_console', name, e); }
            return r;
        };
    };
    // 1つ戻る: 進行と判定の前に控える
    H.wrap('setStep', function (step) { return ({ 1: '番号表示', 2: '問題の表示', 3: '締め切り', 4: '結果発表', 5: '正解の表示' })[step] || '進行'; });
    H.wrap('goNext', '次の問題へ');
    H.wrap('judgeBuzz', function (ok) { return ok ? '〇の判定' : '✕の判定'; });
    H.wrap('judgeWrittenQueue', function (_, ok) { return ok ? '〇の判定' : '✕の判定'; });
    H.wrap('updatePlayerScore', function (_, ok) { return ok ? '〇の判定' : '✕の判定'; });
    H.wrap('toggleMultiAnswer', '答えを開く');
    if (S.pbJudge) H.wrap('pbJudge', function (ok) { return ok ? '〇の判定' : '✕の判定'; });
    // 新しいセットを読み込んだら控えは捨てる
    ['startRoom', 'quickStart', 'quickStartProg'].forEach(n => after(n, function () { H.history = []; H.updateBack(); }));
    after('updateStudioStatus', function (stepId) { H.mount(); H.updateProgress(stepId); H.updateNext(); H.syncJudge(); });
    after('renderAnswerDesk', function () { H.mount(); H.syncJudge(); });
    after('renderParticipantsPage', function (players) { H.addScoreControls(players); });
    after('updatePlayerList', function (players) { H.mount(); H.watchStatus(); H.updateTop3(players); });
    after('setupUnifiedToggle', function () { H.mount(); });
})();
