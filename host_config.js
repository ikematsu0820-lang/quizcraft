
/* =========================================================
 * host_config.js (v143: Rename Buzz Options)
 * =======================================================*/

App.Config = {
    selectedSetKey: null,
    selectedSetData: null,

    init: function () {
        App.Ui.showView(App.Ui.views.config);

        const setSelect = document.getElementById('config-set-select');
        const container = document.getElementById('config-builder-ui');
        const actionArea = document.getElementById('config-action-area');

        if (setSelect) {
            setSelect.innerHTML = `<option value="">-- セットを選択 --</option>`;
            const newSelect = setSelect.cloneNode(true);
            setSelect.parentNode.replaceChild(newSelect, setSelect);
            newSelect.addEventListener('change', () => this.updateBuilderUI());
        }

        this.selectedSetKey = null;
        this.selectedSetData = null;
        this.loadSetList();
        this.setupEventListeners();
    },

    loadSetList: function () {
        const select = document.getElementById('config-set-select');
        if (!select) return;
        select.innerHTML = `<option value="">Loading...</option>`;
        if (!App.State.currentShowId) return;

        window.db.ref(`saved_sets/${App.State.currentShowId}`).once('value', snap => {
            const data = snap.val();
            select.innerHTML = `<option value="">-- 対象セットを選択 --</option>`;
            if (data) {
                const items = Object.keys(data).map(k => ({ ...data[k], key: k })).sort((a, b) => b.createdAt - a.createdAt);
                items.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.key;
                    opt.textContent = `${item.title} (${item.questions?.length || 0}Q)`;
                    select.appendChild(opt);
                });
            }
        });
    },

    setupEventListeners: function () {
        const btnSave = document.getElementById('config-save-set-rules-btn');
        if (btnSave) {
            btnSave.onclick = () => this.saveRulesToSet();
        }
    },

    updateBuilderUI: function () {
        const container = document.getElementById('config-builder-ui');
        const actionArea = document.getElementById('config-action-area');
        const select = document.getElementById('config-set-select');

        if (!select.value) {
            this.selectedSetKey = null;
            this.selectedSetData = null;
            container.innerHTML = '<p class="text-center text-gray p-20">セットを選択してください</p>';
            actionArea.classList.add('hidden');
            return;
        }

        this.selectedSetKey = select.value;
        window.db.ref(`saved_sets/${App.State.currentShowId}/${this.selectedSetKey}`).once('value', snap => {
            this.selectedSetData = snap.val();
            this.renderBuilderForm(this.selectedSetData.config || {}, this.selectedSetData.questions || []);
            actionArea.classList.remove('hidden');
        });
    },

    renderBuilderForm: function (conf, questions) {
        const container = document.getElementById('config-builder-ui');
        let typeDisplay = "不明";
        let isOral = false;
        let qType = 'choice';
        const isDobon = questions.some(q => q.mode === 'dobon' || (q.type === 'choice' && q.mode === 'multi'));

        if (questions.length > 0) {
            const type = questions[0].type;
            const mode = questions[0].mode;

            if (type === 'choice') {
                if (mode === 'dobon' || mode === 'multi') typeDisplay = "2-2) ドボン問題";
                else typeDisplay = "2-1) 単一解答";
            }
            else if (type === 'letter_select') typeDisplay = APP_TEXT.Creator.TypeLetterSelect;
            else if (type === 'sort') typeDisplay = APP_TEXT.Creator.TypeSort;
            else if (type === 'free_oral') { typeDisplay = APP_TEXT.Creator.TypeFreeOral; isOral = true; }
            else if (type === 'free_written') typeDisplay = APP_TEXT.Creator.TypeFreeWritten;
            else if (type === 'multi_written') typeDisplay = APP_TEXT.Creator.TypeMultiWritten;
            else if (type === 'multi_oral') { typeDisplay = APP_TEXT.Creator.TypeMultiOral; isOral = true; }
            else if (type === 'multi') typeDisplay = APP_TEXT.Creator.TypeMulti;
            else typeDisplay = "不明";
        }

        const normalOption = isOral
            ? `<option value="normal" disabled style="color:#555;">✖ 一斉解答 (口頭形式では選択不可)</option>`
            : `<option value="normal">一斉解答 (Normal)</option>`;

        const borderLeftColor = (typeDisplay.includes('選択式') || typeDisplay.includes('ドボン') || typeDisplay.includes('単一解答')) ? '#000000' : '#aaa';

        let html = `
            <div style="background:#252525; padding:12px; border-radius:6px; border:1px solid #444; border-left:4px solid ${borderLeftColor}; margin-bottom:20px; display:flex; align-items:center;">
                <div style="color:#aaa; font-size:0.9em; font-weight:bold; margin-right:10px;">収録形式:</div>
                <div style="color:#fff; font-weight:bold; font-size:1.1em;">${typeDisplay}</div>
                <div style="color:#666; font-size:0.8em; margin-left:auto; font-family:monospace;">全${questions.length}問</div>
            </div>
        `;


        html += `
            <div class="config-item-box">
                <div class="mb-15">
                <label class="config-label">1. ${APP_TEXT.Config.LabelMode}</label>
                <div class="mode-segmented-control">
                    <button type="button" class="mode-segmented-btn ${isOral || qType.startsWith('multi') || isDobon ? 'disabled' : ''}" data-mode="normal" ${(isOral || qType.startsWith('multi') || isDobon) ? 'disabled' : ''}>
                        <span class="icon">⚡</span>
                        <span class="label">一斉</span>
                    </button>
                    <button type="button" class="mode-segmented-btn ${isDobon ? 'disabled' : ''}" data-mode="buzz" ${isDobon ? 'disabled' : ''}>
                        <span class="icon">🚨</span>
                        <span class="label">早押し</span>
                    </button>
                    <!-- Disabled Turn/Solo as per request -->
                    <button type="button" class="mode-segmented-btn" data-mode="turn">
                        <span class="icon">🔄</span>
                        <span class="label">順番</span>
                    </button>
                    <button type="button" class="mode-segmented-btn" data-mode="solo">
                        <span class="icon">🏆</span>
                        <span class="label">ソロ</span>
                    </button>
                </div>
                <!-- Validation Message for Dobon -->
                ${isDobon ? '<p style="color:#e74c3c; font-size:0.85em; margin-top:5px; text-align:center;">※ドボン形式が含まれるため、一斉解答・早押しは選択できません</p>' : ''}
                
                <select id="config-mode-select" class="hidden">
                    <option value="normal">Normal</option>
                    <option value="buzz">Buzz</option>
                    <option value="turn">Turn</option>
                    <option value="solo">Solo</option>
                </select>
                ${qType.startsWith('multi') ? '<p style="font-size:0.8em; color:#ffd700; margin-top:5px;">※多答形式は一斉解答を利用できません</p>' : ''}
                ${isDobon ? '<p style="font-size:0.8em; color:#ff5555; margin-top:5px;">※ドボン問題は「順番解答」のみ利用可能です</p>' : ''}
                <div id="mode-detail-area"></div>
                </div>

                <hr style="border:0; border-top:1px dashed #444; margin:20px 0;">

                <div class="mb-15">
                    <label class="config-label">2. ゲームタイプ</label>
                    <select id="config-game-type" class="btn-block config-select">
                        <option value="score">得点制</option>
                        <option value="panel">パネル制</option>
                        <option value="slot">変動得点制</option>
                    </select>
                    <div id="gametype-detail-area"></div>
                </div>

                <hr style="border:0; border-top:1px dashed #444; margin:20px 0;">
                
                <h5 style="margin:15px 0 8px 0; font-size:11px; color:#666; font-weight:700; text-transform:uppercase;">問題別一括設定 (Bulk)</h5>
                
                <div class="rule-compact-row">
                    <!-- TIME Switch -->
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:11px; font-weight:700; color:#aaa;">TIME</span>
                        <label class="pro-switch">
                            <input type="checkbox" id="config-bulk-time-toggle" checked>
                            <span class="pro-slider"></span>
                        </label>
                    </div>
                    <div class="config-q-input-group pro-style">
                        <input type="number" id="config-bulk-time-input" value="10" min="1" placeholder="Sec" style="width:50px;">
                    </div>

                    <div style="width:1px; height:24px; background:rgba(255,255,255,0.1); margin:0 5px;"></div>

                    <!-- POINT -->
                    <div class="config-q-input-group pro-style score-section">
                        <label>POINT</label>
                        <input type="number" id="config-bulk-point-input" value="1" min="1" style="width:50px;">
                    </div>

                    <!-- LOSS -->
                    <div class="config-q-input-group pro-style score-section">
                        <label>LOSS</label>
                        <input type="number" id="config-bulk-loss-input" value="0" min="0" style="width:50px;">
                    </div>

                    <div style="flex:1"></div>
                    <button id="config-bulk-apply-btn" class="btn-mini btn-primary" style="height:28px; padding:0 12px; font-size:11px;">SET ALL</button>
                </div>

                <button id="btn-toggle-q-list" class="btn-block btn-dark" style="margin-bottom:10px;">▼ 個別で設定する (全${questions.length}問)</button>
                <div id="config-questions-list" class="hidden scroll-list" style="height:300px; border:1px solid #333; padding:5px; background:#1a1a1a;"></div>
            </div>`;

        container.innerHTML = html;

        const modeSel = document.getElementById('config-mode-select');
        const typeSel = document.getElementById('config-game-type');

        const updateDetails = () => {
            this.renderModeDetail(modeSel.value, conf, qType);
            this.renderGameTypeDetail(typeSel.value, conf);
            const isPanel = (typeSel.value === 'panel');
            this.toggleScoreSections(!isPanel);
        };

        modeSel.onchange = updateDetails;
        typeSel.onchange = updateDetails;

        document.getElementById('btn-toggle-q-list').onclick = () => {
            const list = document.getElementById('config-questions-list');
            list.classList.toggle('hidden');
        };

        this.setupBulkButtons();

        // Default Mode Logic with Checks
        let targetMode = conf.mode || 'normal';

        // Apply restrictions
        // 1. Dobon -> Turn only (or Solo)
        if (isDobon) {
            // Default to Turn if logic forces it, or keep existing if it is turn/solo
            if (targetMode !== 'turn' && targetMode !== 'solo') {
                targetMode = 'turn';
            }
        }
        // 2. Multi -> Default Turn
        else if (qType.startsWith('multi')) {
            if (!conf.mode || conf.mode === 'normal') {
                targetMode = 'turn';
            }
        }
        // 3. Oral -> Default Buzz (if normal/default)
        else if (isOral && targetMode === 'normal') {
            targetMode = 'buzz';
        }

        // Apply to select
        modeSel.value = targetMode;

        if (conf.gameType) typeSel.value = conf.gameType;

        // Initial detail render
        updateDetails();
        this.renderQList();
        this.toggleScoreSections(typeSel.value !== 'panel');

        // Setup mode button click handlers
        document.querySelectorAll('.mode-segmented-btn').forEach(card => {
            card.onclick = () => {
                if (card.classList.contains('disabled')) return;

                const selectedMode = card.dataset.mode;

                // Update visual state
                document.querySelectorAll('.mode-segmented-btn').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                // Update hidden select
                modeSel.value = selectedMode;

                // Trigger detail rendering
                updateDetails();
            };
        });

        // Set initial active button
        document.querySelectorAll('.mode-segmented-btn').forEach(card => {
            if (card.dataset.mode === targetMode) {
                card.classList.add('active');
            }
        });
    },

    toggleScoreSections: function (show) {
        document.querySelectorAll('.score-section').forEach(el => {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
        const bulkGrid = document.getElementById('config-bulk-grid');
        if (bulkGrid) {
            bulkGrid.style.gridTemplateColumns = show ? "1fr 1fr 1fr" : "1fr";
        }
    },

    setupBulkButtons: function () {
        const timeToggle = document.getElementById('config-bulk-time-toggle');
        const timeInput = document.getElementById('config-bulk-time-input');
        if (timeToggle && timeInput) {
            timeToggle.onchange = () => {
                timeInput.disabled = !timeToggle.checked;
            };
        }

        document.getElementById('config-bulk-apply-btn').onclick = () => {
            const useTime = timeToggle.checked;
            const timeVal = timeInput.value;
            const pointVal = document.getElementById('config-bulk-point-input').value;
            const lossVal = document.getElementById('config-bulk-loss-input').value;

            document.querySelectorAll('.q-time-toggle').forEach(t => {
                t.checked = useTime;
                t.dispatchEvent(new Event('change'));
            });
            document.querySelectorAll('.q-time-input').forEach(inp => {
                if (useTime) inp.value = timeVal;
            });
            document.querySelectorAll('.q-point-input').forEach(inp => inp.value = pointVal);
            document.querySelectorAll('.q-loss-input').forEach(inp => inp.value = lossVal);

            App.Ui.showToast("設定を全ての問題に適用しました");
        };
    },

    renderModeDetail: function (mode, conf = {}, qType = 'choice') {
        const area = document.getElementById('mode-detail-area');
        let html = '';

        if (mode === 'normal') {
            const isFreeWritten = (qType === 'free_written');
            if (isFreeWritten) {
                html += `
                <div class="mode-settings-box mode-box-normal">
                    <div style="margin-bottom:8px;">
                        <label class="config-label" style="margin:0;">解答権</label>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="mode-segmented-btn ans-attempt-btn ${(conf.answerAttempts || 'single') === 'single' ? 'active' : ''}" data-val="single" style="flex:1; padding:8px 4px;">
                            <span class="icon">1️⃣</span>
                            <span class="label">1回のみ</span>
                        </button>
                        <button type="button" class="mode-segmented-btn ans-attempt-btn ${conf.answerAttempts === 'multiple' ? 'active' : ''}" data-val="multiple" style="flex:1; padding:8px 4px;">
                            <span class="icon">🔄</span>
                            <span class="label">複数解答可</span>
                        </button>
                    </div>
                    <input type="hidden" id="config-answer-attempts" value="${conf.answerAttempts || 'single'}">
                    <p style="color:#888; font-size:0.75em; margin-top:6px; line-height:1.4;" id="ans-attempt-desc">
                        ${(conf.answerAttempts || 'single') === 'single' ? '正解表示ボタンを押した時に全員に結果が一斉に届きます' : '採点の都度結果が届き、不正解でも再解答できます'}
                    </p>
                </div>`;
            } else {
                html += `
                <div class="mode-settings-box mode-box-normal">
                    <p style="color:#aaa; font-size:0.9em; text-align:center;">
                        一斉解答モード
                    </p>
                </div>`;
            }
        } else if (mode === 'buzz') {
            const buzzAction = conf.buzzWrongAction || 'next';
            const buzzPenalty = conf.buzzPenalty || 'none';
            const buzzPenaltyTime = conf.buzzPenaltyTime || 3;
            const buzzRestCount = conf.buzzRestCount || 1;

            html += `
                <div class="mode-settings-box mode-box-buzz">
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px;">
                        <label class="config-label" style="margin:0; white-space:nowrap; min-width:auto;">誤答時の処理</label>
                        <select id="config-buzz-wrong-action" class="config-select" style="flex:1;">
                            <option value="next" ${buzzAction === 'next' ? 'selected' : ''}>問題継続</option>
                            <option value="end" ${buzzAction === 'end' ? 'selected' : ''}>問題終了</option>
                        </select>
                    </div>

                    <div id="buzz-penalty-area">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <label class="config-label" style="margin:0; white-space:nowrap; min-width:auto;">おてつき</label>
                            <select id="config-buzz-penalty" class="config-select" style="flex:1;">
                                ${buzzAction === 'next' ? `
                                    <option value="none" ${buzzPenalty === 'none' ? 'selected' : ''}>なし</option>
                                    <option value="reset_all" ${buzzPenalty === 'reset_all' ? 'selected' : ''}>全員解答受付前に戻す</option>
                                    <option value="time_ban" ${buzzPenalty === 'time_ban' ? 'selected' : ''}>一定時間解答を無効にする</option>
                                ` : `
                                    <option value="none" ${buzzPenalty === 'none' ? 'selected' : ''}>なし</option>
                                    <option value="rest" ${buzzPenalty === 'rest' ? 'selected' : ''}>休み</option>
                                `}
                            </select>
                        </div>
                        <div id="buzz-penalty-detail" style="margin-top:8px;">
                            ${buzzPenalty === 'time_ban' ? `
                                <div style="display:flex; align-items:center; gap:8px; margin-left:auto; max-width:180px;">
                                    <input type="number" id="config-buzz-penalty-time" class="config-select" style="width:60px; text-align:center;" value="${buzzPenaltyTime}" min="1" max="60">
                                    <span style="color:#aaa; font-size:0.85em;">秒</span>
                                </div>
                            ` : ''}
                            ${buzzPenalty === 'rest' ? `
                                <div style="display:flex; align-items:center; gap:8px; margin-left:auto; max-width:180px;">
                                    <input type="number" id="config-buzz-rest-count" class="config-select" style="width:60px; text-align:center;" value="${buzzRestCount}" min="1" max="10">
                                    <span style="color:#aaa; font-size:0.85em;">問休み</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>`;
        } else if (mode === 'turn') {
            html += `
                <div class="mode-settings-box mode-box-turn">
                    <div>
                        <label class="config-label">${APP_TEXT.Config.LabelTurnPass}</label>
                        <select id="config-turn-pass" class="btn-block config-select">
                            <option value="ok" ${conf.turnPass === 'ok' ? 'selected' : ''}>${APP_TEXT.Config.TurnPassOk}</option>
                            <option value="ng" ${conf.turnPass === 'ng' ? 'selected' : ''}>${APP_TEXT.Config.TurnPassNg}</option>
                        </select>
                    </div>
                </div>`;
        } else if (mode === 'solo') {
            html += `
                <div class="mode-settings-box mode-box-solo">
                    <div class="grid-2-col">
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
                </div>`;
        }
        area.innerHTML = html;

        // Setup answer attempt button handlers
        area.querySelectorAll('.ans-attempt-btn').forEach(btn => {
            btn.onclick = () => {
                area.querySelectorAll('.ans-attempt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const hidden = document.getElementById('config-answer-attempts');
                if (hidden) hidden.value = btn.dataset.val;
                const desc = document.getElementById('ans-attempt-desc');
                if (desc) {
                    desc.textContent = btn.dataset.val === 'single'
                        ? '正解表示ボタンを押した時に全員に結果が一斉に届きます'
                        : '採点の都度結果が届き、不正解でも再解答できます';
                }
            };
        });

        // Setup buzz penalty handlers
        const buzzActionSel = document.getElementById('config-buzz-wrong-action');
        const buzzPenaltySel = document.getElementById('config-buzz-penalty');
        const buzzPenaltyDetail = document.getElementById('buzz-penalty-detail');

        if (buzzActionSel && buzzPenaltySel) {
            buzzActionSel.onchange = () => {
                const action = buzzActionSel.value;
                if (action === 'next') {
                    buzzPenaltySel.innerHTML = `
                        <option value="none">なし</option>
                        <option value="reset_all">全員解答受付前に戻す</option>
                        <option value="time_ban">一定時間解答を無効にする</option>
                    `;
                } else {
                    buzzPenaltySel.innerHTML = `
                        <option value="none">なし</option>
                        <option value="rest">休み</option>
                    `;
                }
                if (buzzPenaltyDetail) buzzPenaltyDetail.innerHTML = '';
            };

            buzzPenaltySel.onchange = () => {
                if (!buzzPenaltyDetail) return;
                const penalty = buzzPenaltySel.value;
                if (penalty === 'time_ban') {
                    buzzPenaltyDetail.innerHTML = `
                        <div style="display:flex; align-items:center; gap:8px; margin-left:auto; max-width:180px;">
                            <input type="number" id="config-buzz-penalty-time" class="config-select" style="width:60px; text-align:center;" value="${conf.buzzPenaltyTime || 3}" min="1" max="60">
                            <span style="color:#aaa; font-size:0.85em;">秒</span>
                        </div>
                    `;
                } else if (penalty === 'rest') {
                    buzzPenaltyDetail.innerHTML = `
                        <div style="display:flex; align-items:center; gap:8px; margin-left:auto; max-width:180px;">
                            <input type="number" id="config-buzz-rest-count" class="config-select" style="width:60px; text-align:center;" value="${conf.buzzRestCount || 1}" min="1" max="10">
                            <span style="color:#aaa; font-size:0.85em;">問休み</span>
                        </div>
                    `;
                } else {
                    buzzPenaltyDetail.innerHTML = '';
                }
            };
        }
    },

    renderGameTypeDetail: function (gameType, conf = {}) {
        const area = document.getElementById('gametype-detail-area');
        let html = '';
        if (gameType === 'panel') {
            html += `<div class="mode-settings-box mode-box-normal" style="border-color:#ffd700; margin-top:5px;">
                <label style="color:#ffd700;">★ パネル制</label>
                <p class="unit-text">25枚のパネル操作盤を有効にします。</p>
            </div>`;
        } else if (gameType === 'slot') {
            html += `<div class="mode-settings-box mode-box-normal" style="border-color:#ff00ff; margin-top:5px;">
                <label style="color:#ff00ff;">★ 変動得点制</label>
                <p class="unit-text">正解時にスロットを回し、出た目が得点になります。</p>
                <div class="mt-5">
                    <label class="config-label">スロットの範囲</label>
                    <div class="grid-2-col gap-10">
                        <div>
                            <label class="text-sm">最小値</label>
                            <input type="number" id="conf-slot-min" value="${conf.slotMin || 1}" class="config-select">
                        </div>
                        <div>
                            <label class="text-sm">最大値</label>
                            <input type="number" id="conf-slot-max" value="${conf.slotMax || 10}" class="config-select">
                        </div>
                    </div>
                </div>
            </div>`;
        }
        area.innerHTML = html;
    },

    renderQList: function () {
        const list = document.getElementById('config-questions-list');
        list.innerHTML = '';
        list.style.height = 'auto';
        list.style.maxHeight = '450px';
        list.style.overflowY = 'auto';
        const questions = this.selectedSetData.questions || [];

        questions.forEach((q, i) => {
            const card = document.createElement('div');
            card.className = 'config-q-card';

            const isNoLimit = (q.timeLimit === 0 || q.timeLimit === undefined || q.timeLimit === "0");
            const timeVal = isNoLimit ? "なし" : q.timeLimit;
            const inputType = isNoLimit ? "text" : "number";

            card.innerHTML = `
                <div class="config-q-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:10px;">
                    <span class="config-q-index">Q${i + 1}</span>
                    <input type="text" class="q-text-input" data-index="${i}" value="${q.q}" style="flex:1; margin-left:10px; height:32px; font-size:13px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; padding:0 8px;">
                </div>
                <div class="config-q-settings-grid">
                    <!-- TIME Switch -->
                    <div style="display:flex; align-items:center; gap:8px; margin-right:15px;">
                        <span style="font-size:11px; font-weight:700; color:#555;">TIME</span>
                        <label class="pro-switch">
                            <input type="checkbox" class="q-time-toggle" data-index="${i}" ${!isNoLimit ? 'checked' : ''}>
                            <span class="pro-slider"></span>
                        </label>
                        <div class="config-q-input-group pro-style">
                             <input type="number" class="q-time-input" data-index="${i}" value="${isNoLimit ? 10 : q.timeLimit}" style="width:45px;" ${isNoLimit ? 'disabled' : ''}>
                        </div>
                    </div>

                    <div class="config-q-input-group pro-style score-section">
                        <label>Pt</label>
                        <input type="number" class="q-point-input" data-index="${i}" value="${q.points || 1}" style="width:45px;">
                    </div>
                    <div class="config-q-input-group pro-style score-section">
                        <label>Loss</label>
                        <input type="number" class="q-loss-input" data-index="${i}" value="${q.loss || 0}" style="width:45px;">
                    </div>
                </div>
            `;
            list.appendChild(card);

            // Bind individual toggle
            const qToggle = card.querySelector('.q-time-toggle');
            const qInput = card.querySelector('.q-time-input');
            qToggle.onchange = () => {
                qInput.disabled = !qToggle.checked;
            };
            list.appendChild(card);
        });

        const typeSel = document.getElementById('config-game-type');
        if (typeSel && typeSel.value === 'panel') {
            this.toggleScoreSections(false);
        }
    },

    saveRulesToSet: function () {
        if (!this.selectedSetKey) {
            App.Ui.showToast("セットが選択されていません");
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'design-modal-overlay anim-pop-in';
        overlay.style.zIndex = '20000';
        overlay.innerHTML = `
            <div class="design-modal-content" style="max-width:320px;">
                <h3 class="modal-title">保存方法を選択</h3>
                <div class="design-modal-body" style="gap:15px;">
                    <p style="color:#aaa; font-size:0.85em; text-align:center; margin-bottom:10px;">
                        現在のセット「${this.selectedSetData.title}」を<br>どう保存しますか？
                    </p>
                    <button id="save-opt-overwrite" class="btn-block btn-success">上書き保存</button>
                    <button id="save-opt-new" class="btn-block btn-primary">別名で保存</button>
                    <button id="save-opt-cancel" class="btn-block btn-dark">キャンセル</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#save-opt-overwrite').onclick = () => {
            overlay.remove();
            this.executeSave(this.selectedSetKey);
        };

        overlay.querySelector('#save-opt-new').onclick = () => {
            const currentTitle = this.selectedSetData.title || "New Set";
            const newTitle = prompt("新しいセット名を入力してください:", `${currentTitle} (コピー)`);
            if (newTitle) {
                overlay.remove();
                this.executeSave(null, newTitle);
            }
        };

        overlay.querySelector('#save-opt-cancel').onclick = () => overlay.remove();
    },

    executeSave: function (targetKey, newTitle = null) {
        const mode = document.getElementById('config-mode-select').value;
        const gameType = document.getElementById('config-game-type').value;
        const qs = JSON.parse(JSON.stringify(this.selectedSetData.questions));

        // UIから最新の値を収集
        document.querySelectorAll('.q-text-input').forEach(inp => {
            const idx = inp.dataset.index;
            if (qs[idx]) qs[idx].q = inp.value;
        });
        document.querySelectorAll('.q-point-input').forEach(inp => {
            const idx = inp.dataset.index;
            if (qs[idx]) qs[idx].points = parseInt(inp.value) || 0;
        });
        document.querySelectorAll('.q-loss-input').forEach(inp => {
            const idx = inp.dataset.index;
            if (qs[idx]) qs[idx].loss = parseInt(inp.value) || 0;
        });
        document.querySelectorAll('.q-time-toggle').forEach(chk => {
            const idx = chk.dataset.index;
            if (qs[idx]) {
                const inp = document.querySelector(`.q-time-input[data-index="${idx}"]`);
                if (inp) {
                    qs[idx].timeLimit = chk.checked ? (parseInt(inp.value) || 10) : 0;
                }
            }
        });

        const newConfig = {
            mode: mode,
            gameType: gameType,
            answerAttempts: document.getElementById('config-answer-attempts')?.value || 'single',
            buzzWrongAction: document.getElementById('config-buzz-wrong-action')?.value || 'next',
            buzzPenalty: document.getElementById('config-buzz-penalty')?.value || 'none',
            buzzPenaltyTime: parseInt(document.getElementById('config-buzz-penalty-time')?.value || "3") || 3,
            buzzRestCount: parseInt(document.getElementById('config-buzz-rest-count')?.value || "1") || 1,
            buzzTime: parseInt(document.getElementById('config-buzz-timer')?.value || "0") || 0,
            normalLimit: document.getElementById('config-normal-limit')?.value || 'unlimited',
            manualFlip: document.getElementById('config-manual-flip')?.value === 'true',
            passCount: parseInt(document.getElementById('conf-pass-count')?.value || "10") || 10,
            slotMin: parseInt(document.getElementById('conf-slot-min')?.value || "1") || 1,
            slotMax: parseInt(document.getElementById('conf-slot-max')?.value || "10") || 10,
            turnOrder: document.getElementById('config-turn-order')?.value || 'fixed',
            turnPass: document.getElementById('config-turn-pass')?.value || 'ok',
            soloStyle: document.getElementById('config-solo-style')?.value || 'manual',
            soloTimeType: document.getElementById('config-solo-time-type')?.value || 'per_q',
            soloTimeVal: parseInt(document.getElementById('config-solo-time-val')?.value || "0") || 0,
            soloRecovery: parseInt(document.getElementById('config-solo-recovery')?.value || "0") || 0
        };

        let showId = App.State.currentShowId;
        if (showId) showId = showId.trim();
        if (!showId) {
            App.Ui.showToast("エラー: ショーIDが見つかりません");
            return;
        }

        const path = `saved_sets/${showId}`;
        const isNew = !targetKey;
        const ref = isNew ? window.db.ref(path).push() : window.db.ref(`${path}/${targetKey}`);

        // ★ 最終的な保存データを構築
        const saveData = {
            config: newConfig,
            questions: Array.isArray(qs) ? qs : Object.values(qs),
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        if (isNew) {
            saveData.title = newTitle || "New Copy";
            saveData.createdAt = firebase.database.ServerValue.TIMESTAMP;

            // 初回保存時のデザイン初期化
            const firstQ = (this.selectedSetData.questions && this.selectedSetData.questions[0]) || {};
            saveData.questions.forEach(q => {
                if (!q.layout) q.layout = firstQ.layout || 'standard';
                if (!q.align) q.align = firstQ.align || 'center';
                if (!q.design) q.design = firstQ.design || {};
                q.specialMode = q.specialMode || 'none';
            });
        }

        (isNew ? ref.set(saveData) : ref.update(saveData)).then(() => {
            const successMsg = isNew ? "新しいセットとして保存しました！" : APP_TEXT.Config.MsgRulesSaved;
            App.Ui.showToast(successMsg);

            // ★ 保存完了後、ダッシュボードに戻る
            if (window.App.Dashboard && window.App.Dashboard.enter) {
                window.App.Dashboard.enter();
            }

            if (isNew) {
                this.selectedSetKey = ref.key;
            }
        }).catch(err => {
            console.error("Save error:", err);
            App.Ui.showToast("保存に失敗しました: " + err.message);
        });
    }
};

window.enterConfigMode = () => App.Config.init();
