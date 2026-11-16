/* =========================================================
 * panel_board.js — 多答クイズの「パネル指名モード」
 *
 * プレッシャースタディ（Qさま）やファイブボンバー（ネプリーグ）のように、
 * 1問の中に番号の付いたパネルが複数並び、解答者が「4番、○○」と
 * パネルを指名して答える形式。
 *   ・解答者は口頭で「◯番、答え」と言う（または自分の端末で番号を押す）
 *   ・出題者がそのパネルを押して〇／✕を判定
 *   ・〇なら、そのパネルだけ裏返って答えが出る
 *   ・全部のパネルが開いたら（または出題者が終えたら）残りの答えを見せる
 * 解答権は1人ずつ（早押し・順番・指名）。得点はパネルごとの点
 * （空欄ならルールの「正解」の設定）、減点はルールの「誤答」の設定。
 *
 * 作成画面・出題者画面・モニター・回答者画面をこのファイルにまとめ、
 * 既存のファイルには小さな呼び出しだけを足している。
 * =======================================================*/

window.App = window.App || {};

App.PanelBoard = {
    active: false, // 作成画面で編集中の問題がパネル指名モードか

    esc: function (v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // 問題がパネル指名モードか（前に選択式で作ったものも同じに扱う）
    is: function (q) {
        return !!(q && q.panel && Array.isArray(q.panels) && (String(q.type || '').startsWith('multi') || q.type === 'choice'));
    },

    // 選択式で作ったパネル指名の問題を、多答（口頭）のパネル指名に置き換える
    migrate: function (q) {
        if (!q || q.type !== 'choice' || !q.panel) return q;
        q.type = 'multi_oral';
        q.c = (q.panels || []).map(p => p.answer);
        q.correct = q.c.slice();
        ['correctIndex', 'multiCorrect', 'ox', 'multi', 'mode', 'shuffle'].forEach(k => { delete q[k]; });
        return q;
    },

    // モニター・回答者画面のパネルの列の数
    cols: function (n) {
        if (n <= 3) return n;
        if (n <= 4) return 2;
        if (n <= 6) return 3;
        if (n <= 8) return 4;
        if (n <= 15) return 5;
        if (n <= 24) return 6;
        return 8;
    },

    // ---------------------------------------------------------
    // 作成画面
    // ---------------------------------------------------------
    afterRenderForm: function (C, type, data) {
        // 多答（ランキングモードではない時）— 形式の名前は 'multi' のまとまりで来ることもあるので画面で見る
        const rk = document.getElementById('multi-ranking-mode-chk');
        const isMulti = /^multi/.test(type || '') && !!rk && !rk.checked;
        if (!isMulti) { this.active = false; return; }
        if (data && typeof data.panel === 'boolean') this.active = data.panel;
        else if (data && data.panel) this.active = true;
        const outside = document.getElementById('creator-outside-opts');
        // 「パネル指名モード」のチェック（ランキングモードの隣）
        if (outside && !document.getElementById('multi-panel-chk')) {
            const lbl = document.createElement('label');
            lbl.style.cssText = 'display:flex; align-items:center; gap:6px; cursor:pointer; color:#cbd5e1; font-size:0.8rem; white-space:nowrap;';
            lbl.innerHTML = `<input type="checkbox" id="multi-panel-chk" ${this.active ? 'checked' : ''} style="accent-color:#00e5ff; cursor:pointer;"><span>パネル指名モード</span>`;
            const rkLabel = rk && rk.closest('label');
            if (rkLabel && rkLabel.nextSibling) outside.insertBefore(lbl, rkLabel.nextSibling); else outside.appendChild(lbl);
            outside.classList.remove('hidden');
            lbl.querySelector('input').onchange = (e) => {
                const cur = C._readFormDataForPreview();
                const on = e.target.checked;
                this.active = on;
                if (on) {
                    // 今の答えをそのままパネルの答えに（パネル指名は口頭で答える）
                    const panels = (cur.panels && cur.panels.length) ? cur.panels
                        : (cur.c || []).filter(Boolean).map(a => ({ label: '', answer: a, pts: '' }));
                    C.renderForm('multi_oral', { ...cur, type: 'multi_oral', panel: true, panels });
                } else {
                    const answers = (cur.panels || []).map(p => p.answer).filter(Boolean);
                    const sub = document.getElementById('creator-opt-subtype')?.value;
                    C.renderForm(/^multi_/.test(sub || '') ? sub : 'multi_oral', { ...cur, panel: false, c: answers, correct: answers });
                }
            };
        }
        if (!this.active) return;
        // ランキング・正解の追加は使わない（パネルの追加に置き換え）
        document.getElementById('multi-ranking-mode-chk')?.closest('label')?.remove();
        document.getElementById('multi-add-btn')?.remove();
        this.renderEditor(C, data);
    },

    renderEditor: function (C, data) {
        const container = document.getElementById('creator-form-container');
        if (!container) return;
        const panels = (data && Array.isArray(data.panels) && data.panels.length) ? data.panels
            : (data && Array.isArray(data.c) && data.c.filter(Boolean).length) ? data.c.filter(Boolean).map(a => ({ label: '', answer: a, pts: '' }))
            : Array.from({ length: 6 }, () => ({ label: '', answer: '', pts: '' }));
        container.innerHTML = '';
        container.style.overflowY = 'auto';
        const list = document.createElement('div');
        list.id = 'pb-list';
        list.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; width:100%; align-content:start;';
        container.appendChild(list);
        panels.forEach(p => this.addRow(list, p));

        const outside = document.getElementById('creator-outside-opts');
        const mk = (html) => { const d = document.createElement('span'); d.innerHTML = html; return d.firstElementChild; };
        const wrongSel = mk(`<label class="pb-wrong-wrap" style="display:flex; align-items:center; gap:4px; color:#fff; font-size:0.8rem; white-space:nowrap;">誤答したパネル
            <select id="pb-wrong" style="height:26px; min-height:0; margin:0; padding:0 6px; width:auto;">
                <option value="keep">そのまま残す（他の人が答えられる）</option>
                <option value="close">閉じて答えを見せる</option>
            </select></label>`);
        wrongSel.querySelector('select').value = (data && data.panelWrong === 'close') ? 'close' : 'keep';
        const paste = mk(`<button type="button" id="pb-paste-btn" style="margin-left:auto; background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:5px 12px; cursor:pointer; font-size:0.8rem;">まとめて貼り付け</button>`);
        const add = mk(`<button type="button" id="pb-add-btn" style="margin-left:4px; background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:5px 12px; cursor:pointer; font-size:0.8rem;">＋ パネルを追加</button>`);
        const hint = mk(`<span class="pb-hint" style="color:#64748b; font-size:0.75rem; white-space:nowrap;">※答えは口頭。表（問題）が空欄なら番号だけ出す・点が空欄ならルールの配点</span>`);
        if (outside) { [hint, wrongSel, paste, add].forEach(el => outside.appendChild(el)); outside.classList.remove('hidden'); }
        paste.onclick = () => this.openPaste(list);
        add.onclick = () => this.addRow(list, { label: '', answer: '', pts: '' });
    },

    addRow: function (list, p) {
        const e = (v) => this.esc(v);
        const row = document.createElement('div');
        row.className = 'pb-row';
        row.style.cssText = 'display:flex; align-items:center; gap:4px; min-width:0;';
        const inp = 'height:24px !important; min-height:0; margin:0; padding:0 6px !important; background:rgba(255,255,255,0.06) !important; border:1px solid #334155 !important; border-radius:4px; color:#fff; font-size:0.78rem;';
        row.innerHTML = `
            <span class="pb-no" style="flex:0 0 1.8em; color:#fbbf24; font-weight:900; font-size:0.75rem; text-align:right;"></span>
            <span class="pb-tag pb-tag-front">表</span>
            <input type="text" class="pb-label" placeholder="表：問題（任意）" value="${e(p.label)}" style="flex:1; min-width:0; ${inp}">
            <span class="pb-tag pb-tag-back">裏</span>
            <input type="text" class="pb-answer" placeholder="裏：答え" value="${e(p.answer)}" style="flex:1; min-width:0; ${inp} color:#86efac !important;">
            <input type="number" class="pb-pts" placeholder="点" value="${e(p.pts)}" style="flex:0 0 46px; width:46px; ${inp} text-align:right !important; color:#fbbf24 !important;">
            <button type="button" class="pb-del" title="削除" style="flex:0 0 auto; background:none; border:none; color:rgba(255,255,255,0.35); cursor:pointer; padding:0 4px;">×</button>`;
        row.querySelector('.pb-del').onclick = () => { row.remove(); this.renumber(list); };
        list.appendChild(row);
        this.renumber(list);
        return row;
    },
    renumber: function (list) {
        list.querySelectorAll('.pb-row .pb-no').forEach((el, i) => { el.textContent = i + 1; });
    },
    // 入力済みのパネル（文字も答えも空の行は飛ばす）。keepEmpty はプレビュー用に空欄も残す
    readPanels: function (keepEmpty) {
        const out = [];
        document.querySelectorAll('#pb-list .pb-row').forEach(row => {
            const label = (row.querySelector('.pb-label')?.value || '').trim();
            const answer = (row.querySelector('.pb-answer')?.value || '').trim();
            const raw = (row.querySelector('.pb-pts')?.value || '').trim();
            if (!label && !answer && !keepEmpty) return;
            out.push({ label, answer, pts: raw === '' ? '' : Number(raw) });
        });
        return out;
    },
    // 表計算ソフトから（1行1枚: 表の問題[タブ]答え[タブ]点）
    openPaste: function (list) {
        document.getElementById('pb-paste-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'pb-paste-modal';
        overlay.className = 'design-modal-overlay';
        overlay.innerHTML = `
            <div class="design-modal-content" style="max-width:440px; padding:20px !important;">
                <h3 class="modal-title" style="font-size:1rem; margin-bottom:8px;">パネルをまとめて貼り付け</h3>
                <p style="color:#94a3b8; font-size:0.75rem; margin:0 0 8px;">1行に1枚。表の問題[タブ]答え（[タブ]点）。答えだけの行（1列）なら、パネルは番号だけになります。カンマ区切りでもOK</p>
                <textarea id="pb-paste-text" placeholder="青森	青森市
岩手	盛岡市	2" style="width:100%; height:180px !important; min-height:180px !important; padding:8px; box-sizing:border-box; font-family:monospace; font-size:0.8rem; background:#0d1b2a; color:#fff; border:1px solid #475569; border-radius:8px; resize:vertical;"></textarea>
                <label style="display:flex; align-items:center; gap:6px; color:#cbd5e1; font-size:0.78rem; margin:8px 0;"><input type="checkbox" id="pb-paste-replace" checked> 今のパネルを置き換える（外すと末尾に追加）</label>
                <div style="display:flex; gap:8px;">
                    <button type="button" id="pb-paste-cancel" style="flex:1; padding:9px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">閉じる</button>
                    <button type="button" id="pb-paste-ok" style="flex:2; padding:9px; border-radius:8px; background:linear-gradient(135deg,#00c6ff,#0072ff); border:none; color:#fff; font-weight:bold; cursor:pointer;">追加する</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('#pb-paste-cancel').onclick = close;
        overlay.querySelector('#pb-paste-ok').onclick = () => {
            const rows = overlay.querySelector('#pb-paste-text').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
                const parts = l.split(/\t|,|，/).map(x => x.trim());
                if (parts.length < 2) return { label: '', answer: parts[0], pts: '' };
                const pts = parts[2] !== undefined && parts[2] !== '' && !isNaN(Number(parts[2])) ? Number(parts[2]) : '';
                return { label: parts[0], answer: parts[1], pts };
            }).filter(r => r && (r.label || r.answer));
            if (!rows.length) { alert('「表の問題[タブ]答え」の行が見つかりませんでした'); return; }
            if (overlay.querySelector('#pb-paste-replace').checked) list.innerHTML = '';
            else list.querySelectorAll('.pb-row').forEach(r => { if (!r.querySelector('.pb-label').value.trim() && !r.querySelector('.pb-answer').value.trim()) r.remove(); });
            rows.forEach(r => this.addRow(list, r));
            window.App.Ui.showToast(`${rows.length}枚のパネルを追加しました`);
            close();
        };
    },

    // 保存する問題データに入れる
    fillData: function (q, keepEmpty) {
        if (!q || !/^multi/.test(q.type || '')) return q;
        if (!this.active || !document.getElementById('pb-list')) { if (q.panel) { q.panel = null; q.panels = null; } return q; }
        const panels = this.readPanels(keepEmpty);
        q.panel = true;
        q.panels = panels;
        q.panelWrong = document.getElementById('pb-wrong')?.value === 'close' ? 'close' : 'keep';
        // 多答として読む所（一覧・未完成の判定など）のために答えも c/correct に
        q.c = panels.map(p => p.answer);
        q.correct = q.c.slice();
        return q;
    },

    // ---------------------------------------------------------
    // 出題者画面（App.Studio に足す）
    // ---------------------------------------------------------
    studio: {
        _pb: null,

        pbAnswerer: function () {
            const mode = (App.Data.currentConfig || {}).mode;
            if (mode === 'buzz') return this.buzzWinner || null;
            if (mode === 'nominate') return this._nominatedId || null;
            if (mode === 'turn' || mode === 'solo') return (this.turnOrder || [])[this.turnIndex] || null;
            return null;
        },

        startPanelBoard: function (q) {
            const mode = (App.Data.currentConfig || {}).mode;
            this._pb = {
                panels: (q.panels || []).map(p => ({ label: String(p.label || ''), answer: String(p.answer || ''), pts: p.pts })),
                status: {},
                sel: null,
                seq: 0,
                last: null,
                finished: false,
                revealAll: false,
                wrongMode: q.panelWrong === 'close' ? 'close' : 'keep',
                theme: q.q || '',
            };
            if (mode === 'turn') this.turnIndex = this._nextEligibleTurnIndex(this.turnIndex || 0, true);
            if (mode === 'buzz') { this.buzzWinner = null; this.clearBuzzWindow(); }
            this.pbPush();
            this.renderPanelConsole();
            const ans = this.pbAnswerer();
            if (ans) this.startAnswerTimer(ans);
            this.startTimeLimit(App.State.currentRoomId);
        },

        pbPush: function () {
            const pb = this._pb;
            if (!pb) return;
            if (pb.finished) pb.sel = null;
            const roomId = App.State.currentRoomId;
            const mode = (App.Data.currentConfig || {}).mode;
            const ans = pb.finished ? null : this.pbAnswerer();
            const players = App.Data.players || {};
            window.db.ref(`rooms/${roomId}/status`).update({
                step: 'panelboard',
                qIndex: App.State.currentQIndex,
                currentAnswerer: ans,
                currentAnswererName: ans ? ((players[ans] && players[ans].name) || '---') : null,
                isBuzzActive: mode === 'buzz' && !ans && !pb.finished,
                isTurnMode: mode !== 'buzz',
                isNominateMode: mode === 'nominate' ? true : null,
                pb: {
                    theme: pb.theme,
                    // 答えは開いたパネルの分だけ送る（回答者の端末から見えないように）
                    panels: pb.panels.map((p, i) => {
                        const s = pb.status[i] || {};
                        const open = s.r === 'ok' || s.r === 'closed' || pb.revealAll;
                        return { label: p.label, r: s.r || null, by: s.by || null, answer: open ? p.answer : null };
                    }),
                    sel: pb.sel,
                    seq: pb.seq,
                    last: pb.last,
                    finished: pb.finished,
                    revealAll: pb.revealAll,
                },
            });
            this.pbMainButton();
        },

        // 誰かが早押しした・指名した時に描き直す
        pbRefresh: function () {
            if (!this._pb) return;
            this.pbPush();
            this.renderPanelConsole();
        },

        // 出題者がパネルを押す（解答者が「◯番」と言ったパネル）
        pbSelect: function (idx) {
            const pb = this._pb;
            if (!pb || pb.finished) return;
            const s = pb.status[idx];
            if (s && (s.r === 'ok' || s.r === 'closed')) return;
            pb.sel = pb.sel === idx ? null : idx;
            this.pbPush();
            this.renderPanelConsole();
        },

        // 解答者が自分の端末で番号を押した（players/{id}/pbPick）
        processPanelPick: function (players) {
            const pb = this._pb;
            if (!pb || pb.finished) return;
            const cur = this.pbAnswerer();
            const pick = cur && players && players[cur] && players[cur].pbPick;
            if (!pick) return;
            window.db.ref(`rooms/${App.State.currentRoomId}/players/${cur}/pbPick`).remove();
            const idx = parseInt(pick.idx);
            if (isNaN(idx) || idx < 0 || idx >= pb.panels.length) return;
            const s = pb.status[idx];
            if (s && (s.r === 'ok' || s.r === 'closed')) return;
            pb.sel = idx;
            this.pbPush();
            this.renderPanelConsole();
        },

        // 〇／✕（timeout … 持ち時間切れ。パネル未選択でも誤答として進める）
        pbJudge: function (ok, timeout) {
            const pb = this._pb;
            if (!pb || pb.finished) return;
            const pid = this.pbAnswerer();
            if (!pid) { App.Ui.showToast('解答者がいません'); return; }
            const idx = pb.sel;
            if (idx === null && !timeout) { App.Ui.showToast('解答者が言ったパネルを押してから判定してください'); return; }
            const roomId = App.State.currentRoomId;
            const conf = App.Data.currentConfig || {};
            const q = App.Data.studioQuestions[App.State.currentQIndex] || {};
            const player = (App.Data.players || {})[pid] || {};
            const name = player.name || '---';
            const panel = idx !== null ? pb.panels[idx] : null;
            this.clearAnswerTimer();
            let delta;
            if (ok) {
                const fixed = panel && panel.pts !== '' && panel.pts !== null && panel.pts !== undefined && !isNaN(Number(panel.pts));
                delta = fixed ? Number(panel.pts) : window.App.RuleEngine.correctPoints(conf, q, { streak: (player.streak || 0) + 1 });
                pb.status[idx] = { r: 'ok', by: name };
                this.recordWinner(pid, name);
            } else {
                delta = -this._wrongLoss(q);
                if (idx !== null && pb.wrongMode === 'close') pb.status[idx] = { r: 'closed', by: name };
            }
            pb.seq += 1;
            pb.last = { idx, ok: !!ok, name, timeout: !!timeout, pts: delta };
            pb.sel = null;
            // 得点（パネルの問題は1問の中で何度も答えるので lastResult は付けない）
            window.db.ref(`rooms/${roomId}/players/${pid}`).once('value', snap => {
                const p = snap.val();
                if (!p) return;
                const upd = { periodScore: (p.periodScore || 0) + delta, totalScore: (p.totalScore || 0) + delta, ...this._resultFields(p, !!ok) };
                if (!ok && conf.gameType === 'survival') {
                    const misses = (p.survivalMisses || 0) + 1;
                    upd.survivalMisses = misses;
                    if (misses >= (conf.survivalLives || 1)) { upd.isAlive = false; App.Ui.showToast(`${name} さんが脱落しました`); }
                }
                snap.ref.update(upd);
            });
            App.Ui.showToast(ok ? `〇 ${name}：${idx + 1}番「${panel.answer}」` : (timeout ? `${name} さんは時間切れ` : `✕ ${name}：${idx + 1}番`));
            // 全部開いたら終わり
            const remain = pb.panels.filter((_, i) => !pb.status[i] || pb.status[i].r !== 'ok' && pb.status[i].r !== 'closed').length;
            if (!remain) pb.finished = true;
            this.pbNextAnswerer(pid, ok);
            this.pbPush();
            this.renderPanelConsole();
            if (!pb.finished) { const nxt = this.pbAnswerer(); if (nxt) this.startAnswerTimer(nxt); }
        },

        // 次の解答者（順番は次の人へ・早押しは押し直し・指名は指名し直し）
        pbNextAnswerer: function (pid) {
            const mode = (App.Data.currentConfig || {}).mode;
            const roomId = App.State.currentRoomId;
            if (mode === 'turn') {
                const n = this._nextEligibleTurnIndex(this.turnIndex, false);
                if (n !== null) this.turnIndex = n;
                this.turnAdvancedThisQ = true;
            } else if (mode === 'buzz') {
                this.buzzWinner = null;
                this.clearBuzzWindow();
                window.db.ref(`rooms/${roomId}/players`).once('value', all => {
                    all.forEach(c => { if (c.val() && c.val().buzzTime) c.ref.update({ buzzTime: null, buzzPressAt: null }); });
                });
            } else if (mode === 'nominate') {
                this._nominatedId = null;
            }
        },

        // 解答者がパスする（点の増減なし・次の人へ）
        pbPass: function () {
            const pb = this._pb;
            if (!pb || pb.finished) return;
            const pid = this.pbAnswerer();
            this.clearAnswerTimer();
            pb.sel = null;
            this.pbNextAnswerer(pid);
            this.pbPush();
            this.renderPanelConsole();
            const nxt = this.pbAnswerer();
            if (nxt) this.startAnswerTimer(nxt);
        },

        pbMainButton: function () {
            const pb = this._pb;
            const btnMain = document.getElementById('btn-phase-main');
            if (!pb || !btnMain || this.currentStepId !== 2) return;
            btnMain.classList.remove('action-ready');
            btnMain.classList.add('action-next');
            if (pb.revealAll) {
                btnMain.textContent = '次の問題へ';
                btnMain.onclick = () => { this._pb = null; this.renderPanelConsole(); this.clearTimeLimit(); this.goNext(); };
            } else if (pb.finished) {
                btnMain.textContent = '残りの答えを見せる';
                btnMain.onclick = () => { pb.revealAll = true; this.clearAnswerTimer(); this.pbPush(); this.renderPanelConsole(); };
            } else {
                btnMain.textContent = 'このボードを終える';
                btnMain.onclick = () => {
                    if (!confirm('このボードを終えて、残りのパネルの答えを見せますか？')) return;
                    pb.finished = true; pb.revealAll = true; pb.sel = null;
                    this.clearAnswerTimer();
                    this.pbPush(); this.renderPanelConsole();
                };
            }
            this.syncMainButton();
        },

        renderPanelConsole: function () {
            const view = document.getElementById('host-control-view');
            let box = document.getElementById('panel-console');
            const pb = this._pb;
            if (view) view.classList.toggle('numgame-active', !!pb || !!this._ng);
            if (!pb) { if (box) box.remove(); return; }
            if (!box) {
                box = document.createElement('div');
                box.id = 'panel-console';
                box.style.cssText = 'width:100%; max-width:600px; margin:0 0 12px;';
                const main = document.querySelector('#host-control-view .simple-studio-main');
                const card = document.querySelector('#host-control-view .console-card-wrapper');
                if (main) main.insertBefore(box, card || null);
            }
            const esc = (v) => this._esc(v);
            const mode = (App.Data.currentConfig || {}).mode;
            const pid = this.pbAnswerer();
            const players = App.Data.players || {};
            const ansName = pid ? ((players[pid] && players[pid].name) || '---') : null;
            const who = pb.finished ? 'ボード終了' : ansName ? `解答者：<b style="color:#fbbf24;">${esc(ansName)}</b>`
                : mode === 'buzz' ? '早押し受付中（押した人が答えます）' : mode === 'nominate' ? '参加者リストから解答者を指名してください' : '解答者待ち';
            const cols = Math.min(5, App.PanelBoard.cols(pb.panels.length));
            const grid = pb.panels.map((p, i) => {
                const s = pb.status[i] || {};
                const done = s.r === 'ok' || s.r === 'closed';
                const sel = pb.sel === i;
                const bg = s.r === 'ok' ? 'rgba(34,197,94,0.25)' : s.r === 'closed' ? '#111' : sel ? 'rgba(251,191,36,0.25)' : '#1f2937';
                const bd = s.r === 'ok' ? '#22c55e' : sel ? '#fbbf24' : '#475569';
                return `<button type="button" data-pb-idx="${i}" ${done || pb.finished ? 'disabled' : ''} style="padding:6px 4px; border-radius:8px; text-align:center; cursor:${done || pb.finished ? 'default' : 'pointer'};
                    background:${bg}; border:2px solid ${bd}; color:#e2e8f0; min-width:0;">
                    <div style="font-size:11px; color:#fbbf24; font-weight:900;">${i + 1}</div>
                    <div style="font-size:13px; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(p.label) || '&nbsp;'}</div>
                    <div style="font-size:11px; color:${s.r === 'ok' ? '#86efac' : '#64748b'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(p.answer)}</div>
                    ${s.by ? `<div style="font-size:10px; color:#94a3b8;">${s.r === 'ok' ? '〇' : '✕'} ${esc(s.by)}</div>` : ''}
                </button>`;
            }).join('');
            const selPanel = pb.sel !== null ? pb.panels[pb.sel] : null;
            const canJudge = !pb.finished && pid && selPanel;
            box.innerHTML = `
                <div style="color:#94a3b8; font-size:12px; margin-bottom:6px; border-bottom:1px solid #333; padding-bottom:5px; display:flex; justify-content:space-between; gap:8px;">
                    <span>パネル指名 ／ 解答者が言ったパネルを押して〇✕（グレーの小さな文字が答え）</span>
                    <span style="color:#e2e8f0; white-space:nowrap;">${who}</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:5px; margin-bottom:8px;">${grid}</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <div style="flex:1; min-width:0; color:#e2e8f0; font-size:14px; padding:8px 10px; background:#1a1a1a; border-radius:8px;">
                        ${selPanel ? `<b style="color:#fbbf24;">${pb.sel + 1}番</b> ${esc(selPanel.label)} → 答え <b style="color:#86efac;">${esc(selPanel.answer)}</b>` : '<span style="color:#64748b;">パネル未選択</span>'}
                    </div>
                    <button type="button" id="pb-ok" ${canJudge ? '' : 'disabled'} style="flex:0 0 64px; height:48px; border-radius:10px; font-size:24px; font-weight:900; border:none; cursor:pointer; background:${canJudge ? '#16a34a' : '#333'}; color:#fff;">〇</button>
                    <button type="button" id="pb-ng" ${canJudge ? '' : 'disabled'} style="flex:0 0 64px; height:48px; border-radius:10px; font-size:24px; font-weight:900; border:none; cursor:pointer; background:${canJudge ? '#dc2626' : '#333'}; color:#fff;">✕</button>
                    <button type="button" id="pb-pass" ${!pb.finished && pid ? '' : 'disabled'} style="flex:0 0 auto; height:48px; padding:0 12px; border-radius:10px; border:1px solid #475569; background:#1f2937; color:#cbd5e1; cursor:pointer;">パス</button>
                </div>`;
            box.querySelectorAll('[data-pb-idx]').forEach(b => { b.onclick = () => this.pbSelect(parseInt(b.dataset.pbIdx)); });
            box.querySelector('#pb-ok').onclick = () => this.pbJudge(true);
            box.querySelector('#pb-ng').onclick = () => this.pbJudge(false);
            box.querySelector('#pb-pass').onclick = () => this.pbPass();
        },
    },

    // ---------------------------------------------------------
    // モニター（App.Viewer に足す）
    // ---------------------------------------------------------
    viewer: {
        _pbSeqShown: 0,
        // q を渡すと（作成画面のプレビュー）、その問題で描く
        renderPanelBoard: function (container, mainText, st, previewQ) {
            const pb = st.pb || {};
            const q = previewQ || this.questions[st.qIndex] || {};
            const d = q.design || {};
            this.applyDefaultDesign(container, { mainBgColor: d.mainBgColor || '#0a0a0a', bgImage: d.bgImage });
            if (window.App.ChoiceSkin && d.bgFx === 'studio' && !d.bgImage) container.style.backgroundImage = window.App.ChoiceSkin.studioBg(d.mainBgColor);
            const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const panels = pb.panels || [];
            const cols = App.PanelBoard.cols(panels.length);
            const rows = Math.ceil(panels.length / cols) || 1;
            const accent = d.accentColor || d.qBorderColor || '#00e5ff';
            const fresh = pb.seq && pb.seq !== this._pbSeqShown;
            this._pbSeqShown = pb.seq || 0;
            const last = pb.last || {};
            const fontPx = Math.max(2.4, Math.min(6, 40 / rows));
            mainText.style.flexDirection = 'column';
            mainText.style.justifyContent = 'flex-start';
            mainText.style.alignItems = 'stretch';
            mainText.innerHTML = `
                <div class="pbv" style="--pb-accent:${accent};">
                    <div class="pbv-theme">${esc(pb.theme || q.q || '')}</div>
                    <div class="pbv-grid" style="grid-template-columns:repeat(${cols}, 1fr); grid-template-rows:repeat(${rows}, 1fr); font-size:${fontPx}cqh;">
                        ${panels.map((p, i) => {
                            const cls = p.r === 'ok' ? 'ok' : p.r === 'closed' ? 'closed' : (p.answer ? 'revealed' : '');
                            const isSel = pb.sel === i && !p.r;
                            const anim = fresh && last.idx === i ? (last.ok ? ' pbv-flip' : ' pbv-shake') : '';
                            return `<div class="pbv-panel ${cls}${isSel ? ' sel' : ''}${anim}">
                                ${p.label || (p.answer !== null && p.answer !== undefined) ? `<span class="pbv-no">${i + 1}</span>` : ''}
                                ${p.answer !== null && p.answer !== undefined
                                    ? `<span class="pbv-ans">${esc(p.answer)}</span><span class="pbv-sub">${[p.label, p.by && p.r === 'ok' ? p.by : ''].filter(Boolean).map(esc).join('・')}</span>`
                                    : (p.label ? `<span class="pbv-label">${esc(p.label)}</span>` : `<span class="pbv-big">${i + 1}</span>`)}
                                ${fresh && last.idx === i && !last.ok ? '<span class="pbv-x">✕</span>' : ''}
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="pbv-foot">${pb.finished ? (pb.revealAll ? '答え' : 'ボード終了') : st.currentAnswererName ? `解答者 <b>${esc(st.currentAnswererName)}</b>` : st.isBuzzActive ? '早押し受付中' : ''}</div>
                </div>`;
        },
    },
};

// 出題者画面・モニターに足す
if (window.App.Studio) Object.assign(window.App.Studio, App.PanelBoard.studio);
if (window.App.Viewer) Object.assign(window.App.Viewer, App.PanelBoard.viewer);

// 作成画面のフック
(function hookCreatorForPanels() {
    const C = window.App.Creator;
    if (!C) return;
    const PB = App.PanelBoard;
    const wrap = (name, fn) => {
        const orig = C[name];
        if (typeof orig !== 'function') return;
        C[name] = function () {
            const r = orig.apply(this, arguments);
            try { const v = fn.call(this, r, arguments); if (v !== undefined) return v; } catch (e) { console.warn('panel_board hook', name, e); }
            return r;
        };
    };
    wrap('renderForm', function (_, args) { PB.afterRenderForm(this, args[0], args[1]); });
    wrap('getData', function (q) { return PB.fillData(q, false); });
    wrap('_readFormDataForPreview', function (q) { return PB.fillData(q, true); });
    wrap('init', function () { PB.active = false; });
    // 前に選択式で作ったパネル指名の問題は、開く前に多答へ置き換える
    const origEdit = C.edit;
    if (typeof origEdit === 'function') {
        C.edit = function (index) {
            try { PB.migrate((window.App.Data.createdQuestions || [])[index]); } catch (e) { /* noop */ }
            return origEdit.apply(this, arguments);
        };
    }
    wrap('initWithType', function () { PB.active = false; });
})();

// ---------------------------------------------------------
// 回答者画面（player.js の updateUI から呼ぶ）
// ---------------------------------------------------------
function renderPlayerPanelBoard(st, p) {
    const pb = st.pb || {};
    let box = document.getElementById('player-panelboard');
    if (!box) {
        box = document.createElement('div');
        box.id = 'player-panelboard';
        const gv = document.getElementById('player-game-view');
        const bar = document.getElementById('player-status-bar');
        gv.insertBefore(box, bar ? bar.nextSibling : gv.firstChild);
    }
    box.classList.remove('hidden');
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const panels = pb.panels || [];
    const mine = st.currentAnswerer === myPlayerId && !pb.finished;
    const out = p.isAlive === false || p.cleared;
    let status;
    if (pb.finished) status = '<div class="pbp-status">このボードは終了しました</div>';
    else if (mine) status = `<div class="pbp-status mine">あなたの番です！ 「◯番、答え」と言ってください${pb.sel !== null && pb.sel !== undefined ? `<small>${pb.sel + 1}番を選択中</small>` : '<small>番号を押して伝えることもできます</small>'}</div>`;
    else if (st.isBuzzActive && !out) status = '<div class="pbp-status"><button type="button" class="pbp-buzz">PUSH!</button></div>';
    else status = `<div class="pbp-status">${st.currentAnswererName ? `${esc(st.currentAnswererName)} さんが解答中` : '解答者を待っています'}</div>`;
    box.innerHTML = `
        <div class="pbp-theme">${esc(pb.theme || '')}</div>
        ${status}
        <div class="pbp-grid" style="grid-template-columns:repeat(${Math.min(6, App.PanelBoard.cols(panels.length))}, 1fr);">${panels.map((pp, i) => {
            const done = pp.r === 'ok' || pp.r === 'closed';
            const sel = pb.sel === i && !done;
            return `<button type="button" class="pbp-panel ${pp.r || ''} ${sel ? 'sel' : ''}" data-i="${i}" ${!mine || done ? 'disabled' : ''}>
                <span class="pbp-no">${i + 1}</span>
                <span class="pbp-label">${pp.answer !== null && pp.answer !== undefined ? esc(pp.answer) : (pp.label ? esc(pp.label) : '？')}</span>
            </button>`;
        }).join('')}</div>`;
    box.querySelectorAll('.pbp-panel:not([disabled])').forEach(b => {
        b.onclick = () => {
            window.db.ref(`rooms/${myRoomId}/players/${myPlayerId}/pbPick`).set({ idx: parseInt(b.dataset.i), t: firebase.database.ServerValue.TIMESTAMP });
            box.querySelectorAll('.pbp-panel').forEach(x => x.classList.toggle('sel', x === b));
        };
    });
    const bz = box.querySelector('.pbp-buzz');
    if (bz) bz.onclick = () => { const real = document.getElementById('player-buzz-btn'); if (real) { real.disabled = false; real.click(); } bz.disabled = true; bz.textContent = '判定中…'; };
}
