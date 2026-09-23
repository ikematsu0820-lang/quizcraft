
/* =========================================================
 * host_config.js (v143: Rename Buzz Options)
 * =======================================================*/

App.Config = {
    // Shared by the compact rules bar (Creator) inline pickers below.
    deriveTypeInfo: function (questions) {
        let typeDisplay = "不明";
        let isOral = false;
        let qType = 'choice';
        const isDobon = questions.some(q => q.mode === 'dobon' || (q.type === 'choice' && q.mode === 'multi'));
        const isBlackjack = questions.some(q => q.type === 'blackjack');

        if (questions.length > 0) {
            const type = questions[0].type;
            const mode = questions[0].mode;

            if (type === 'choice') {
                if (mode === 'dobon' || mode === 'multi') typeDisplay = "2-2) ダウト問題";
                else typeDisplay = "2-1) 単一解答";
            }
            else if (type === 'letter_select') typeDisplay = APP_TEXT.Creator.TypeLetterSelect;
            else if (type === 'sort') typeDisplay = APP_TEXT.Creator.TypeSort;
            else if (type === 'free_oral') { typeDisplay = APP_TEXT.Creator.TypeFreeOral; isOral = true; }
            else if (type === 'free_written') { typeDisplay = APP_TEXT.Creator.TypeFreeWritten; qType = type; }
            else if (type === 'multi_written') { typeDisplay = APP_TEXT.Creator.TypeMultiWritten; qType = type; }
            else if (type === 'multi_oral') { typeDisplay = APP_TEXT.Creator.TypeMultiOral; isOral = true; qType = type; }
            else if (type === 'ranking_written') { typeDisplay = APP_TEXT.Creator.TypeRankingWritten; qType = type; }
            else if (type === 'ranking_oral') { typeDisplay = APP_TEXT.Creator.TypeRankingOral; isOral = true; qType = type; }
            else if (type === 'multi') { typeDisplay = APP_TEXT.Creator.TypeMulti; qType = type; }
            else if (type === 'assoc_written') { typeDisplay = APP_TEXT.Creator.TypeAssocWritten; qType = type; }
            else if (type === 'assoc_oral') { typeDisplay = APP_TEXT.Creator.TypeAssocOral; isOral = true; qType = type; }
            else if (type === 'blackjack') { typeDisplay = "6-1) ブラックジャック"; qType = type; }
            else typeDisplay = "不明";
        }

        return { typeDisplay, isOral, qType, isDobon, isBlackjack };
    },

    // Full set of defaults for a fresh config object, so every field has a
    // sane value even if the user never opens a given rules button.
    DEFAULT_CONFIG: {
        mode: 'normal', gameType: 'score', answerAttempts: 'single',
        buzzWrongAction: 'next', buzzPenalty: 'none', buzzPenaltyTime: 3, buzzRestCount: 1, buzzTime: 0,
        normalLimit: 'unlimited', manualFlip: false, passCount: 10,
        slotMin: 1, slotMax: 10, turnOrder: 'fixed', turnRotateMode: 'per_q',
        soloStyle: 'manual', soloTimeType: 'per_q', soloTimeVal: 0, soloRecovery: 0,
        scoreType: 'uniform', uniformPts: 1, rankPts: [10, 5, 3], rankOtherPts: 1, firstComeCount: 1, firstComePts: 10,
        timeLimitEnabled: 'off', timeLimitSeconds: 30
    },

    // Question-type-driven auto-restriction (same rules the old card list
    // used to enforce), applied directly to the persistent config object.
    applyModeRestrictions: function (conf, questions) {
        const { qType, isDobon, isBlackjack } = this.deriveTypeInfo(questions);
        let mode = conf.mode || 'normal';
        if (isBlackjack) {
            mode = 'turn';
        } else if (isDobon) {
            if (mode !== 'turn' && mode !== 'solo') mode = 'turn';
        } else if (qType.startsWith('multi') || qType.startsWith('ranking')) {
            if (!conf.mode || conf.mode === 'normal') mode = 'turn';
        } else if (mode === 'normal') {
            const hasOneOnOne = questions.some(q => ['free_oral', 'free_written', 'letter_select', 'multi_oral', 'ranking_oral', 'assoc_oral'].includes(q.type));
            if (hasOneOnOne) mode = 'buzz';
        }
        conf.mode = mode;
    },

    // --- Compact inline rule controls (render into a container the caller
    // provides; no modal/backdrop — see renderInlineModeChooser etc. below) ---

    // Per-mode settings fields (same content the old bottom-sheet showed),
    // now rendered inline under the mode radio list.
    _modeDetailFieldsHtml: function (mode, conf, qType, isDobon) {
        if (mode === 'normal') {
            return `
                <label class="config-label" style="margin:0; font-size:0.8em;">解答権</label>
                <div style="display:flex; gap:6px; margin:6px 0 6px;">
                    <button type="button" class="mode-segmented-btn ans-attempt-btn ${(conf.answerAttempts || 'single') === 'single' ? 'active' : ''}" data-val="single" style="flex:1; padding:6px 4px; font-size:0.8em;">
                        <span class="label">1回のみ</span>
                    </button>
                    <button type="button" class="mode-segmented-btn ans-attempt-btn ${conf.answerAttempts === 'multiple' ? 'active' : ''}" data-val="multiple" style="flex:1; padding:6px 4px; font-size:0.8em;">
                        <span class="label">複数解答可</span>
                    </button>
                </div>
                <p style="color:#888; font-size:0.72em; margin:0; line-height:1.3;" id="ans-attempt-desc">
                    ${(conf.answerAttempts || 'single') === 'single' ? '正解表示ボタンを押した時に全員に結果が一斉に届きます' : '採点の都度結果が届き、不正解でも再解答できます'}
                </p>
            `;
        } else if (mode === 'buzz') {
            const buzzAction = conf.buzzWrongAction || 'next';
            const buzzPenalty = conf.buzzPenalty || 'none';
            return `
                <label class="config-label" style="font-size:0.8em; color:#aaa;">誤答時：問題の処理</label>
                <select id="config-buzz-wrong-action" class="btn-block config-select" style="margin-bottom:2px; padding:4px;">
                    <option value="next" ${buzzAction === 'next' ? 'selected' : ''}>問題継続</option>
                    <option value="end" ${buzzAction === 'end' ? 'selected' : ''}>次の問題</option>
                </select>
                <p style="color:#666; font-size:0.68em; margin:0 0 8px; line-height:1.3;" id="buzz-action-desc">${buzzAction === 'next' ? '他のプレイヤーが引き続き解答できます' : '誤答時にその問題を終了します'}</p>
                <label class="config-label" style="font-size:0.8em; color:#aaa;">誤答者の処理</label>
                <select id="config-buzz-penalty" class="btn-block config-select" style="margin-bottom:2px; padding:4px;">
                    <option value="none" ${buzzPenalty === 'none' ? 'selected' : ''}>解答継続</option>
                    <option value="otetski" ${buzzPenalty === 'otetski' ? 'selected' : ''}>その問題の解答権なし</option>
                </select>
                <p style="color:#666; font-size:0.68em; margin:0; line-height:1.3;" id="buzz-penalty-desc">${buzzPenalty === 'none' ? '誤答しても再度早押しできます' : '誤答したプレイヤーはその問題で解答できません'}</p>
            `;
        } else if (mode === 'turn') {
            const showRotateMode = isDobon || (qType && (qType.startsWith('multi') || qType.startsWith('ranking')));
            if (!showRotateMode) return '<p style="color:#666; font-size:0.8em;">追加の設定はありません</p>';
            const currentRotate = conf.turnRotateMode || 'per_q';
            return `
                <label class="config-label" style="font-size:0.8em;">解答者の回し方</label>
                <select id="config-turn-rotate-mode" class="btn-block config-select" style="margin-top:4px; padding:4px;">
                    <option value="per_q" ${currentRotate === 'per_q' ? 'selected' : ''}>問題ごとに変える（毎問、次の人が最初）</option>
                    <option value="until_end" ${currentRotate === 'until_end' ? 'selected' : ''}>ダウトが出るまで回す（全員解答まで繰り返し）</option>
                </select>
            `;
        } else if (mode === 'solo') {
            return `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div>
                        <label class="config-label">${APP_TEXT.Config.LabelSoloTimeValue}</label>
                        <div class="flex-center">
                            <input type="number" id="config-solo-time-val" class="btn-block" value="${conf.soloTimeVal || 5}" min="0" placeholder="0=なし">
                            <span class="unit-text">秒</span>
                        </div>
                    </div>
                    <div>
                        <label class="config-label">${APP_TEXT.Config.LabelSoloRecovery}</label>
                        <select id="config-solo-recovery" class="btn-block config-select">
                            <option value="none" ${conf.soloRecovery === 0 ? 'selected' : ''}>なし</option>
                            <option value="1" ${conf.soloRecovery === 1 ? 'selected' : ''}>+1s</option>
                            <option value="3" ${conf.soloRecovery === 3 ? 'selected' : ''}>+3s</option>
                            <option value="5" ${conf.soloRecovery === 5 ? 'selected' : ''}>+5s</option>
                        </select>
                    </div>
                </div>
            `;
        }
        return '';
    },

    // Wires the interactive bits of _modeDetailFieldsHtml and writes
    // straight into `conf` (no intermediate hidden DOM round-trip).
    _wireModeDetailFields: function (area, mode, conf) {
        area.querySelectorAll('.ans-attempt-btn').forEach(btn => {
            btn.onclick = () => {
                area.querySelectorAll('.ans-attempt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                conf.answerAttempts = btn.dataset.val;
                const desc = area.querySelector('#ans-attempt-desc');
                if (desc) desc.textContent = btn.dataset.val === 'single'
                    ? '正解表示ボタンを押した時に全員に結果が一斉に届きます'
                    : '採点の都度結果が届き、不正解でも再解答できます';
            };
        });
        const buzzActionSel = area.querySelector('#config-buzz-wrong-action');
        if (buzzActionSel) {
            buzzActionSel.onchange = () => {
                conf.buzzWrongAction = buzzActionSel.value;
                const desc = area.querySelector('#buzz-action-desc');
                if (desc) desc.textContent = buzzActionSel.value === 'next' ? '他のプレイヤーが引き続き解答できます' : '誤答時にその問題を終了します';
            };
        }
        const buzzPenaltySel = area.querySelector('#config-buzz-penalty');
        if (buzzPenaltySel) {
            buzzPenaltySel.onchange = () => {
                conf.buzzPenalty = buzzPenaltySel.value;
                const desc = area.querySelector('#buzz-penalty-desc');
                if (desc) desc.textContent = buzzPenaltySel.value === 'none' ? '誤答しても再度早押しできます' : '誤答したプレイヤーはその問題で解答できません';
            };
        }
        const turnRotateSel = area.querySelector('#config-turn-rotate-mode');
        if (turnRotateSel) turnRotateSel.onchange = () => { conf.turnRotateMode = turnRotateSel.value; };
        const soloTimeInput = area.querySelector('#config-solo-time-val');
        if (soloTimeInput) soloTimeInput.oninput = () => { conf.soloTimeVal = parseInt(soloTimeInput.value) || 0; };
        const soloRecoverySel = area.querySelector('#config-solo-recovery');
        if (soloRecoverySel) soloRecoverySel.onchange = () => { conf.soloRecovery = soloRecoverySel.value === 'none' ? 0 : parseInt(soloRecoverySel.value) || 0; };
    },

    // 解答権 — pick mode + edit that mode's fields, in one compact modal.
    // All three renderInlineXxx functions below render directly into a
    // given container (no modal/backdrop) and apply every change to `conf`
    // immediately — the container lives inside the fixed-height
    // #creator-inline-edit-area, so there's no confirm step and no popup.

    // 解答権 — pick mode (via the #creator-mode-select pulldown, alongside
    // 解答形式's pulldown) + edit that mode's fields below.
    renderInlineModeChooser: function (container, conf, questions, onChange) {
        const { qType, isOral, isDobon, isBlackjack } = this.deriveTypeInfo(questions);
        // ソロ対戦 is no longer a creator-configured 解答権 — it's now chosen
        // by the host at load time (プログラム/セットの読込 screen), as a
        // per-session override on top of whatever mode the set was created
        // with. See host_studio.js loadProgramList()/setupPeriod().
        const modes = [
            { value: 'normal', label: '一斉解答', disabled: isBlackjack || isOral || isDobon || (qType && (qType.startsWith('multi') || qType.startsWith('ranking'))) },
            { value: 'buzz', label: '早押し', disabled: isBlackjack || isDobon },
            { value: 'turn', label: '順番解答', disabled: false }
        ];
        let current = conf.mode || 'normal';
        if (modes.find(m => m.value === current)?.disabled) current = modes.find(m => !m.disabled).value;
        conf.mode = current;

        const sel = document.getElementById('creator-mode-select');

        const renderDetail = () => {
            container.innerHTML = `<div id="mode-chooser-detail"></div>`;
            const detailArea = container.querySelector('#mode-chooser-detail');
            detailArea.innerHTML = this._modeDetailFieldsHtml(current, conf, qType, isDobon);
            this._wireModeDetailFields(detailArea, current, conf);
        };

        if (sel) {
            sel.innerHTML = modes.map(m => `<option value="${m.value}" ${m.disabled ? 'disabled' : ''} ${m.value === current ? 'selected' : ''}>${m.label}</option>`).join('');
            sel.value = current;
            sel.onchange = () => {
                current = sel.value;
                conf.mode = current;
                renderDetail();
                if (onChange) onChange();
            };
        }
        renderDetail();
    },

    // 正解ボーナス — pick gameType (score/panel/slot) + its detail fields.
    renderInlineGameTypeChooser: function (container, conf, onChange) {
        const types = [
            { value: 'score', label: '得点制', disabled: false },
            { value: 'panel', label: 'パネル', disabled: false },
            { value: 'slot', label: '変動得点制', disabled: false }
        ];
        let current = conf.gameType || 'score';

        const scoreDetailHtml = () => {
            const scoreType = conf.scoreType || 'uniform';
            const optionRows = [
                { value: 'uniform', label: '全員一律' },
                { value: 'ranked', label: '順位ボーナス' },
                { value: 'first_come', label: '先着のみ' }
            ];
            return `
                <label class="config-label" style="margin:0 0 4px; font-size:0.78em; display:block;">得点ルール</label>
                <select id="score-type-select" style="
                    width:100%; padding:6px 8px; background:#1e293b; border:1px solid #475569;
                    border-radius:8px; color:#fff; font-size:0.85rem;
                ">
                    ${optionRows.map(o => `<option value="${o.value}" ${scoreType === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
                <div id="score-type-sheet-detail" style="background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); margin-top:8px; min-height:40px;"></div>
            `;
        };
        const slotDetailHtml = () => `
            <div style="display:flex; gap:10px; align-items:center;">
                <div style="flex:1;">
                    <label style="font-size:0.7em; color:#888; display:block; margin-bottom:2px;">最小値</label>
                    <input type="number" id="conf-slot-min" value="${conf.slotMin || 1}" min="0" style="width:100%; padding:6px; background:#111; border:1px solid #444; color:#fff; border-radius:6px; font-size:0.9em; text-align:center;">
                </div>
                <div style="color:#555; margin-top:14px;">〜</div>
                <div style="flex:1;">
                    <label style="font-size:0.7em; color:#888; display:block; margin-bottom:2px;">最大値</label>
                    <input type="number" id="conf-slot-max" value="${conf.slotMax || 10}" min="1" style="width:100%; padding:6px; background:#111; border:1px solid #444; color:#fff; border-radius:6px; font-size:0.9em; text-align:center;">
                </div>
            </div>
        `;

        const renderDetail = () => {
            const area = container.querySelector('#gametype-chooser-detail');
            if (current === 'score') {
                area.innerHTML = scoreDetailHtml();
                area.querySelector('#score-type-select').onchange = (e) => {
                    conf.scoreType = e.target.value;
                    renderDetail();
                    if (onChange) onChange();
                };
                this.renderScoreDetailInSheet(conf.scoreType || 'uniform', conf);
                // Commit score-detail field edits to conf as the user types,
                // since there's no explicit confirm step anymore.
                area.querySelectorAll('#score-type-sheet-detail input').forEach(inp => {
                    inp.addEventListener('input', () => this._collectScoreDetailFromSheet(conf));
                });
            } else if (current === 'slot') {
                area.innerHTML = slotDetailHtml();
                area.querySelector('#conf-slot-min').oninput = (e) => { conf.slotMin = parseInt(e.target.value) || 1; };
                area.querySelector('#conf-slot-max').oninput = (e) => { conf.slotMax = parseInt(e.target.value) || 10; };
            } else {
                area.innerHTML = '<p style="color:#666; font-size:0.8em;">追加の設定はありません</p>';
            }
        };

        const render = () => {
            container.innerHTML = `
                <select id="gametype-chooser-select" style="
                    width:100%; padding:6px 8px; background:#1e293b; border:1px solid #475569;
                    border-radius:8px; color:#fff; font-size:0.85rem; margin-bottom:10px;
                ">
                    ${types.map(t => `<option value="${t.value}" ${t.value === current ? 'selected' : ''}>${t.label}</option>`).join('')}
                </select>
                <div id="gametype-chooser-detail"></div>
            `;
            container.querySelector('#gametype-chooser-select').onchange = (e) => {
                current = e.target.value;
                conf.gameType = current;
                render();
                if (onChange) onChange();
            };
            renderDetail();
        };
        conf.gameType = current;
        render();
    },

    // 制限時間 — on/off + seconds.
    renderInlineTimeLimitChooser: function (container, conf, onChange) {
        let enabled = (conf.timeLimitEnabled || 'off') === 'on';
        let seconds = conf.timeLimitSeconds || 30;

        const render = () => {
            container.innerHTML = `
                <div style="display:flex; gap:8px; margin-bottom:12px;">
                    <button type="button" id="tl-off-btn" style="flex:1; padding:10px; border-radius:10px; font-weight:bold; cursor:pointer;
                        border:2px solid ${!enabled ? '#00e5ff' : '#333'}; background:${!enabled ? 'rgba(0,229,255,0.08)' : '#1a1a1a'}; color:${!enabled ? '#00e5ff' : '#ccc'};">OFF（無制限）</button>
                    <button type="button" id="tl-on-btn" style="flex:1; padding:10px; border-radius:10px; font-weight:bold; cursor:pointer;
                        border:2px solid ${enabled ? '#f39c12' : '#333'}; background:${enabled ? 'rgba(243,156,18,0.1)' : '#1a1a1a'}; color:${enabled ? '#f39c12' : '#ccc'};">ON（時間制限あり）</button>
                </div>
                <div id="tl-seconds-area" style="${enabled ? '' : 'display:none;'}">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                        <input type="number" id="tl-seconds-input" value="${seconds}" min="5" max="600" step="5" style="
                            flex:1; text-align:center; font-size:1.4em; font-weight:800;
                            background:rgba(243,156,18,0.1); border:2px solid #f39c12; border-radius:12px; color:#f39c12; padding:6px;">
                        <span style="color:#aaa;">秒</span>
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${[10, 15, 20, 30, 45, 60].map(s => `
                            <button type="button" class="tl-preset-btn" data-sec="${s}" style="
                                flex:1; min-width:46px; padding:6px 4px; border-radius:8px; font-size:0.8em; font-weight:bold; cursor:pointer;
                                background:${seconds === s ? 'rgba(243,156,18,0.2)' : '#222'};
                                border:1px solid ${seconds === s ? '#f39c12' : '#444'};
                                color:${seconds === s ? '#f39c12' : '#aaa'};">${s}秒</button>
                        `).join('')}
                    </div>
                </div>
            `;
            container.querySelector('#tl-off-btn').onclick = () => {
                enabled = false; conf.timeLimitEnabled = 'off'; render();
                if (onChange) onChange();
            };
            container.querySelector('#tl-on-btn').onclick = () => {
                enabled = true; conf.timeLimitEnabled = 'on'; render();
                if (onChange) onChange();
            };
            const input = container.querySelector('#tl-seconds-input');
            if (input) input.oninput = () => {
                seconds = Math.max(5, Math.min(600, parseInt(input.value) || 30));
                conf.timeLimitSeconds = seconds;
                if (onChange) onChange();
            };
            container.querySelectorAll('.tl-preset-btn').forEach(btn => {
                btn.onclick = () => {
                    seconds = parseInt(btn.dataset.sec);
                    conf.timeLimitSeconds = seconds;
                    render();
                    if (onChange) onChange();
                };
            });
        };
        conf.timeLimitEnabled = enabled ? 'on' : 'off';
        conf.timeLimitSeconds = seconds;
        render();
    },


    renderScoreDetailInSheet: function (scoreType, conf) {
        const detailArea = document.getElementById('score-type-sheet-detail');
        if (!detailArea) return;
        let html = '';
        if (scoreType === 'uniform') {
            const uniformPts = conf.uniformPts !== undefined ? conf.uniformPts : 1;
            html = `<div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#aaa; font-size:0.9em;">正解者に一律</span>
                <input type="number" id="conf-score-uniform" style="width:70px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px; font-size:1em;" value="${uniformPts}" min="0">
                <span style="color:#aaa; font-size:0.9em;">点</span>
            </div>`;
        } else if (scoreType === 'ranked') {
            const ranks = conf.rankPts || [10, 5, 3];
            const otherPts = conf.rankOtherPts !== undefined ? conf.rankOtherPts : 1;
            html = `<div id="ranked-inputs">`;
            ranks.forEach((pts, i) => {
                html += `<div class="ranked-row" style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <span style="color:#aaa; font-size:0.85em; width:32px; text-align:right;">${i + 1}位</span>
                    <input type="number" class="rank-pt-input" data-index="${i}" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${pts}" min="0">
                    <span style="color:#aaa; font-size:0.85em;">点</span>
                    <button class="remove-rank-btn" data-index="${i}" style="background:#5c0000; border:1px solid #ff4444; color:#ff4444; border-radius:6px; padding:4px 10px; font-size:0.8em; cursor:pointer;">✕</button>
                </div>`;
            });
            html += `</div>
            <button id="add-rank-btn" style="margin-bottom:14px; padding:7px 14px; background:rgba(255,255,255,0.06); border:1px solid #444; color:#aaa; border-radius:6px; font-size:0.85em; cursor:pointer;">＋ 順位を追加</button>
            <div style="display:flex; align-items:center; gap:10px; border-top:1px dashed #333; padding-top:12px;">
                <span style="color:#888; font-size:0.85em;">上記以降は一律</span>
                <input type="number" id="conf-score-rank-other" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${otherPts}" min="0">
                <span style="color:#888; font-size:0.85em;">点</span>
            </div>`;
        } else if (scoreType === 'first_come') {
            const fcCount = conf.firstComeCount || 1;
            const fcPts = conf.firstComePts !== undefined ? conf.firstComePts : 10;
            html = `<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span style="color:#aaa; font-size:0.9em;">先着</span>
                <input type="number" id="conf-score-fc-count" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${fcCount}" min="1">
                <span style="color:#aaa; font-size:0.9em;">名に</span>
                <input type="number" id="conf-score-fc-pts" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${fcPts}" min="0">
                <span style="color:#aaa; font-size:0.9em;">点</span>
            </div>`;
        }
        detailArea.innerHTML = html;

        if (scoreType === 'ranked') {
            const self = this;
            const addBtn = document.getElementById('add-rank-btn');
            if (addBtn) {
                addBtn.onclick = () => {
                    const inputs = document.querySelectorAll('#score-type-sheet-detail .rank-pt-input');
                    const newRanks = Array.from(inputs).map(inp => parseInt(inp.value) || 0);
                    newRanks.push(1);
                    conf.rankPts = newRanks;
                    const otherInp = document.getElementById('conf-score-rank-other');
                    if (otherInp) conf.rankOtherPts = parseInt(otherInp.value) || 0;
                    self.renderScoreDetailInSheet('ranked', conf);
                };
            }
            document.querySelectorAll('#score-type-sheet-detail .remove-rank-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const inputs = document.querySelectorAll('#score-type-sheet-detail .rank-pt-input');
                    const newRanks = Array.from(inputs).map(inp => parseInt(inp.value) || 0);
                    newRanks.splice(idx, 1);
                    conf.rankPts = newRanks;
                    const otherInp = document.getElementById('conf-score-rank-other');
                    if (otherInp) conf.rankOtherPts = parseInt(otherInp.value) || 0;
                    self.renderScoreDetailInSheet('ranked', conf);
                };
            });
        }
    },

    _collectScoreDetailFromSheet: function (conf) {
        // Called on Done, reads current sheet values into conf
        const scoreType = conf.scoreType || 'uniform';
        if (scoreType === 'uniform') {
            const el = document.getElementById('conf-score-uniform');
            if (el) conf.uniformPts = parseInt(el.value) || 0;
        } else if (scoreType === 'ranked') {
            const inputs = document.querySelectorAll('#score-type-sheet-detail .rank-pt-input');
            if (inputs.length > 0) {
                conf.rankPts = Array.from(inputs).map(inp => parseInt(inp.value) || 0);
            }
            const otherInp = document.getElementById('conf-score-rank-other');
            if (otherInp) conf.rankOtherPts = parseInt(otherInp.value) || 0;
        } else if (scoreType === 'first_come') {
            const fcCount = document.getElementById('conf-score-fc-count');
            const fcPts = document.getElementById('conf-score-fc-pts');
            if (fcCount) conf.firstComeCount = parseInt(fcCount.value) || 1;
            if (fcPts) conf.firstComePts = parseInt(fcPts.value) || 0;
        }
    },
};
