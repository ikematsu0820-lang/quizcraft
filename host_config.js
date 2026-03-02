
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
            if (!this.selectedSetData.config) this.selectedSetData.config = {};
            this.renderBuilderForm(this.selectedSetData.config, this.selectedSetData.questions || []);
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
                if (mode === 'dobon' || mode === 'multi') typeDisplay = "2-2) ダウト問題";
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

        const borderLeftColor = (typeDisplay.includes('選択式') || typeDisplay.includes('ダウト') || typeDisplay.includes('単一解答')) ? '#000000' : '#aaa';

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
                <div id="mode-card-selector" style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">
                    <!-- Mode cards rendered by JS -->
                </div>
                <select id="config-mode-select" class="hidden">
                    <option value="normal">Normal</option>
                    <option value="buzz">Buzz</option>
                    <option value="turn">Turn</option>
                    <option value="solo">Solo</option>
                </select>
                ${qType.startsWith('multi') ? '<p style="font-size:0.8em; color:#ffd700; margin-top:8px;">※多答形式は一斉解答を利用できません</p>' : ''}
                </div>

                <hr style="border:0; border-top:1px dashed #444; margin:20px 0;">

                <div class="mb-15">
                    <label class="config-label">2. 正解ボーナス</label>
                    <input type="hidden" id="config-game-type" value="score">
                    <div id="gametype-selector" style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">
                        <!-- Game type cards rendered by JS -->
                    </div>
                </div>

                <hr style="border:0; border-top:1px dashed #444; margin:20px 0;">

                <div class="mb-15">
                    <label class="config-label">3. 制限時間</label>
                    <input type="hidden" id="config-time-limit-enabled" value="${conf.timeLimitEnabled || 'off'}">
                    <input type="hidden" id="config-time-limit-seconds" value="${conf.timeLimitSeconds || 30}">
                    <div id="time-limit-card-selector" style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">
                        <!-- Time limit cards rendered by JS -->
                    </div>
                </div>

            </div>`;



        // ── 詳細設定モーダル ──────────────────────────────────
        html += `
            <div style="margin-top:8px;">
                <button id="btn-open-detail-settings" class="btn-block btn-dark" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-size:1em; border:1px solid #444; border-radius:8px;">
                    <span>⚙</span> 詳細設定（時間・点数・個別設定）
                    <span style="margin-left:auto; font-size:0.8em; color:#888;">▶</span>
                </button>
            </div>`;

        // Remove the old bulk section (it's being moved to modal below)
        container.innerHTML = html;

        // ── Modal for detail settings ──────────────────────────
        let existingDetailModal = document.getElementById('config-detail-modal');
        if (!existingDetailModal) {
            const detailModal = document.createElement('div');
            detailModal.id = 'config-detail-modal';
            detailModal.className = 'design-modal-overlay hidden';
            detailModal.style.zIndex = '9000';
            detailModal.innerHTML = `
                <div class="design-modal-content" style="max-width:600px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; flex-shrink:0;">
                        <h3 class="modal-title" style="margin:0;">詳細設定</h3>
                        <button id="config-detail-modal-close" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#aaa; padding:0 8px;">×</button>
                    </div>
                    <div style="flex:1; overflow-y:auto; padding-right:5px;">
                        <h5 style="margin:0 0 8px 0; font-size:11px; color:#666; font-weight:700; text-transform:uppercase;">問題別一括設定 (Bulk)</h5>
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

                        <button id="btn-toggle-q-list" class="btn-block btn-dark" style="margin:12px 0 8px 0;">▼ 個別で設定する (全${questions.length}問)</button>
                        <div id="config-questions-list" class="hidden scroll-list" style="max-height:280px; overflow-y:auto; border:1px solid #333; padding:5px; background:#1a1a1a;"></div>
                    </div>
                    <div style="margin-top:12px; flex-shrink:0;">
                        <button id="config-detail-modal-done" class="btn-block btn-primary" style="padding:12px; font-weight:bold;">完了</button>
                    </div>
                </div>
            `;
            document.body.appendChild(detailModal);

            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) detailModal.classList.add('hidden');
            });
            document.getElementById('config-detail-modal-close').onclick = () => detailModal.classList.add('hidden');
            document.getElementById('config-detail-modal-done').onclick = () => detailModal.classList.add('hidden');
        } else {
            // Update question count text in existing modal
            const toggleBtn = existingDetailModal.querySelector('#btn-toggle-q-list');
            if (toggleBtn) toggleBtn.textContent = `▼ 個別で設定する (全${questions.length}問)`;
        }

        document.getElementById('btn-open-detail-settings').onclick = () => {
            document.getElementById('config-detail-modal').classList.remove('hidden');
            // Re-render Q list each time modal opens to keep it fresh
            this.renderQList();
            // Wire bulk buttons (they live in the modal DOM)
            this.setupBulkButtons();
            // Wire the individual-q toggle
            const toggleQBtn = document.getElementById('btn-toggle-q-list');
            if (toggleQBtn) {
                toggleQBtn.onclick = () => {
                    const list = document.getElementById('config-questions-list');
                    list.classList.toggle('hidden');
                };
            }
        };

        const modeSel = document.getElementById('config-mode-select');
        const typeHidden = document.getElementById('config-game-type');

        const updateDetails = () => {
            const isPanel = (typeHidden.value === 'panel');
            this.toggleScoreSections(!isPanel);
        };

        modeSel.onchange = updateDetails;
        // Mode card rendering (initial)
        this.renderModeCards(modeSel.value || 'normal', conf, qType, isOral, isDobon);
        // Game type card rendering (initial)
        this.renderGameTypeCards(typeHidden.value || 'score', conf);
        // Time limit card rendering (initial)
        this.renderTimeLimitCards(conf.timeLimitEnabled || 'off', conf.timeLimitSeconds || 30);

        // (btn-toggle-q-list and setupBulkButtons are now wired on modal open)

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
        // 3. One-on-One types (1-1, 1-2, 1-3) -> Default Buzz (if normal/default)
        else if (targetMode === 'normal') {
            const hasOneOnOne = questions.some(q => ['free_oral', 'free_written', 'letter_select', 'multi_oral'].includes(q.type));
            if (hasOneOnOne) {
                targetMode = 'buzz';
            }
        }

        // Apply to select
        modeSel.value = targetMode;

        if (conf.gameType) {
            typeHidden.value = conf.gameType;
            this.renderGameTypeCards(conf.gameType, conf);
        }

        // Render mode cards with correct initial selection
        this.renderModeCards(targetMode, conf, qType, isOral, isDobon);

        // Initial detail render
        updateDetails();
        this.toggleScoreSections(typeHidden.value !== 'panel');
    },

    // 制限時間カードをレンダリング
    renderTimeLimitCards: function (selected, seconds) {
        const container = document.getElementById('time-limit-card-selector');
        if (!container) return;

        const enabledHidden = document.getElementById('config-time-limit-enabled');
        const secondsHidden = document.getElementById('config-time-limit-seconds');

        const self = this;
        const renderCards = (sel, secs) => {
            container.innerHTML = '';

            const options = [
                { value: 'off', icon: '∞', label: '制限なし', desc: '時間無制限で解答できます', color: '#636e72' },
                { value: 'on', icon: '⏱', label: 'あり', desc: '全問共通の制限時間を設定', color: '#f39c12' }
            ];

            options.forEach(opt => {
                const isSelected = (sel === opt.value);
                const row = document.createElement('div');
                row.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 2px solid ${isSelected ? opt.color : '#333'};
                    background: ${isSelected ? `rgba(${self._hexToRgb(opt.color)}, 0.1)` : '#1a1a1a'};
                    cursor: pointer;
                    transition: all 0.2s;
                `;

                // Left: radio + icon + text
                const left = document.createElement('div');
                left.style.cssText = 'display:flex; align-items:center; gap:10px; flex:1;';
                left.innerHTML = `
                    <div style="
                        width:18px; height:18px; border-radius:50%;
                        border: 2px solid ${isSelected ? opt.color : '#555'};
                        background: ${isSelected ? opt.color : 'transparent'};
                        display:flex; align-items:center; justify-content:center;
                        flex-shrink:0;
                        box-shadow: ${isSelected ? `0 0 8px ${opt.color}88` : 'none'};
                    ">
                        ${isSelected ? '<div style="width:6px;height:6px;border-radius:50%;background:#000;"></div>' : ''}
                    </div>
                    <span style="font-size:1.3em;">${opt.icon}</span>
                    <div>
                        <div style="font-weight:bold; color:${isSelected ? opt.color : '#ccc'}; font-size:0.95em;">${opt.label}</div>
                        <div style="font-size:0.72em; color:#666;">${opt.desc}</div>
                    </div>
                `;
                left.onclick = () => {
                    if (enabledHidden) enabledHidden.value = opt.value;
                    renderCards(opt.value, secs);
                };
                row.appendChild(left);

                // Right: seconds input (only when 'on' is selected)
                if (opt.value === 'on' && isSelected) {
                    const inputWrap = document.createElement('div');
                    inputWrap.style.cssText = 'display:flex; align-items:center; gap:6px; flex-shrink:0;';
                    inputWrap.innerHTML = `
                        <input type="number" id="config-time-limit-seconds-input"
                            value="${secs}" min="5" max="300" step="5"
                            style="
                                width:64px; text-align:center; font-size:1.1em; font-weight:800;
                                background:rgba(243,156,18,0.1); border:1px solid #f39c12;
                                border-radius:8px; color:#f39c12; padding:6px 4px;
                            ">
                        <span style="color:#aaa; font-size:0.85em;">秒</span>
                    `;
                    inputWrap.querySelector('input').oninput = (e) => {
                        const v = parseInt(e.target.value) || 30;
                        if (secondsHidden) secondsHidden.value = v;
                        secs = v;
                    };
                    row.appendChild(inputWrap);
                }

                container.appendChild(row);
            });
        };

        renderCards(selected, seconds);
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

    // モード選択カードをレンダリング（ゲームタイプと同じスタイル）
    renderModeCards: function (selectedMode, conf, qType, isOral, isDobon) {
        const container = document.getElementById('mode-card-selector');
        if (!container) return;

        const modes = [
            {
                value: 'normal',
                icon: '⚡',
                label: '一斉解答',
                desc: '全員同時に解答',
                color: '#00e5ff',
                disabled: isOral || (qType && qType.startsWith('multi')) || isDobon,
                hasDetail: qType === 'free_written'
            },
            {
                value: 'buzz',
                icon: '🚨',
                label: '早押し',
                desc: '最初に押した人が解答',
                color: '#ff6b6b',
                disabled: isDobon,
                hasDetail: true
            },
            {
                value: 'turn',
                icon: '🔄',
                label: '順番解答',
                desc: 'プレイヤーが順番に解答',
                color: '#ffd700',
                disabled: false,
                hasDetail: true
            },
            {
                value: 'solo',
                icon: '🏆',
                label: 'ソロ対戦',
                desc: '個人タイムアタック',
                color: '#a855f7',
                disabled: false,
                hasDetail: true
            }
        ];

        const self = this;
        const modeSel = document.getElementById('config-mode-select');

        container.innerHTML = '';
        modes.forEach(m => {
            const isSelected = (selectedMode === m.value);
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-radius: 10px;
                border: 2px solid ${isSelected ? m.color : (m.disabled ? '#2a2a2a' : '#333')};
                background: ${isSelected ? `rgba(${self._hexToRgb(m.color)}, 0.1)` : (m.disabled ? '#161616' : '#1a1a1a')};
                cursor: ${m.disabled ? 'not-allowed' : 'pointer'};
                opacity: ${m.disabled ? '0.45' : '1'};
                transition: all 0.2s;
            `;

            // --- Left: radio indicator + icon + text ---
            const left = document.createElement('div');
            left.style.cssText = 'display:flex; align-items:center; gap:10px; flex:1;';
            left.innerHTML = `
                <div style="
                    width:18px; height:18px; border-radius:50%;
                    border: 2px solid ${isSelected ? m.color : '#555'};
                    background: ${isSelected ? m.color : 'transparent'};
                    display:flex; align-items:center; justify-content:center;
                    flex-shrink:0;
                    box-shadow: ${isSelected ? `0 0 8px ${m.color}88` : 'none'};
                ">
                    ${isSelected ? '<div style="width:6px;height:6px;border-radius:50%;background:#000;"></div>' : ''}
                </div>
                <span style="font-size:1.3em;">${m.icon}</span>
                <div>
                    <div style="font-weight:bold; color:${isSelected ? m.color : (m.disabled ? '#444' : '#ccc')}; font-size:0.95em;">${m.label}</div>
                    <div style="font-size:0.72em; color:${m.disabled ? '#333' : '#666'};">${m.desc}</div>
                </div>
            `;
            if (!m.disabled) {
                left.onclick = () => {
                    modeSel.value = m.value;
                    self.renderModeCards(m.value, conf, qType, isOral, isDobon);
                };
            }
            row.appendChild(left);

            // --- Right: 詳細設定ボタン ---
            if (m.hasDetail && !m.disabled) {
                const detailBtn = document.createElement('button');
                detailBtn.type = 'button';
                detailBtn.style.cssText = `
                    background: rgba(255,255,255,0.06);
                    border: 1px solid #444;
                    color: #aaa;
                    border-radius: 20px;
                    padding: 5px 12px;
                    font-size: 0.75em;
                    cursor: pointer;
                    white-space: nowrap;
                    flex-shrink: 0;
                `;
                detailBtn.innerHTML = '⚙ 詳細';
                detailBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Select this mode first
                    modeSel.value = m.value;
                    self.renderModeCards(m.value, conf, qType, isOral, isDobon);
                    // Open detail sheet
                    self.openModeDetailSheet(m.value, conf, qType);
                };
                row.appendChild(detailBtn);
            }

            container.appendChild(row);
        });
    },

    // モード詳細設定をモーダルで開く
    openModeDetailSheet: function (mode, conf, qType) {
        const existingSheet = document.getElementById('mode-detail-sheet');
        if (existingSheet) existingSheet.remove();

        let sheetContent = '';
        let modeLabel = '';

        if (mode === 'normal') {
            modeLabel = '⚡ 一斉解答 — 解答設定';
            sheetContent = `
                <div style="margin-bottom:8px;">
                    <label class="config-label" style="margin:0;">解答権</label>
                </div>
                <div style="display:flex; gap:6px; margin-bottom:12px;">
                    <button type="button" class="mode-segmented-btn ans-attempt-btn ${(conf.answerAttempts || 'single') === 'single' ? 'active' : ''}" data-val="single" style="flex:1; padding:10px 4px;">
                        <span class="icon">1️⃣</span>
                        <span class="label">1回のみ</span>
                    </button>
                    <button type="button" class="mode-segmented-btn ans-attempt-btn ${conf.answerAttempts === 'multiple' ? 'active' : ''}" data-val="multiple" style="flex:1; padding:10px 4px;">
                        <span class="icon">🔄</span>
                        <span class="label">複数解答可</span>
                    </button>
                </div>
                <input type="hidden" id="config-answer-attempts" value="${conf.answerAttempts || 'single'}">
                <p style="color:#888; font-size:0.8em; line-height:1.5;" id="ans-attempt-desc">
                    ${(conf.answerAttempts || 'single') === 'single' ? '正解表示ボタンを押した時に全員に結果が一斉に届きます' : '採点の都度結果が届き、不正解でも再解答できます'}
                </p>
            `;
        } else if (mode === 'buzz') {
            modeLabel = '🚨 早押し — 解答設定';
            const buzzAction = conf.buzzWrongAction || 'next';
            const buzzPenalty = conf.buzzPenalty || 'none';
            sheetContent = `
                <div style="margin-bottom:15px;">
                    <label class="config-label">誤答時の処理</label>
                    <select id="config-buzz-wrong-action" class="btn-block config-select">
                        <option value="next" ${buzzAction === 'next' ? 'selected' : ''}>問題継続（他のプレイヤーが解答可能）</option>
                        <option value="end" ${buzzAction === 'end' ? 'selected' : ''}>問題終了</option>
                    </select>
                </div>
                <div>
                    <label class="config-label">おてつき処理</label>
                    <select id="config-buzz-penalty" class="btn-block config-select">
                        <option value="none" ${buzzPenalty === 'none' ? 'selected' : ''}>なし</option>
                        <option value="otetski" ${buzzPenalty === 'otetski' ? 'selected' : ''}>あり（次の問題まで解答権なし）</option>
                    </select>
                </div>
                <div id="buzz-penalty-detail" style="margin-top:8px;"></div>
            `;
        } else if (mode === 'turn') {
            modeLabel = '🔄 順番解答 — 解答設定';
            sheetContent = `
                <div>
                    <label class="config-label">${APP_TEXT.Config.LabelTurnPass}</label>
                    <select id="config-turn-pass" class="btn-block config-select">
                        <option value="ok" ${conf.turnPass === 'ok' ? 'selected' : ''}>${APP_TEXT.Config.TurnPassOk}</option>
                        <option value="ng" ${conf.turnPass === 'ng' ? 'selected' : ''}>${APP_TEXT.Config.TurnPassNg}</option>
                    </select>
                </div>
            `;
        } else if (mode === 'solo') {
            modeLabel = '🏆 ソロ対戦 — 解答設定';
            sheetContent = `
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

        const sheet = document.createElement('div');
        sheet.id = 'mode-detail-sheet';
        sheet.className = 'design-modal-overlay';
        sheet.style.cssText = 'z-index:9500;';
        sheet.innerHTML = `
            <div class="design-modal-content" style="max-width:480px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                    <h3 style="margin:0; font-size:1em; color:#fff;">${modeLabel}</h3>
                    <button id="mode-detail-sheet-close" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#aaa; padding:0 8px;">×</button>
                </div>
                <div style="padding:4px 0 8px 0;">${sheetContent}</div>
                <div style="margin-top:16px;">
                    <button id="mode-detail-sheet-done" class="btn-block btn-primary" style="padding:12px; font-weight:bold;">完了</button>
                </div>
            </div>
        `;
        document.body.appendChild(sheet);

        sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
        document.getElementById('mode-detail-sheet-close').onclick = () => sheet.remove();
        document.getElementById('mode-detail-sheet-done').onclick = () => sheet.remove();

        // Wire ans-attempt buttons
        sheet.querySelectorAll('.ans-attempt-btn').forEach(btn => {
            btn.onclick = () => {
                sheet.querySelectorAll('.ans-attempt-btn').forEach(b => b.classList.remove('active'));
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

        // Wire buzz penalty
        const buzzPenaltySel = document.getElementById('config-buzz-penalty');
        if (buzzPenaltySel) {
            buzzPenaltySel.onchange = () => {
                const detail = document.getElementById('buzz-penalty-detail');
                if (detail) detail.innerHTML = '';
            };
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
                        <label class="config-label" style="margin:0; white-space:nowrap; min-width:80px;">誤答時の処理</label>
                        <select id="config-buzz-wrong-action" class="config-select" style="flex:1; height:38px;">
                            <option value="next" ${buzzAction === 'next' ? 'selected' : ''}>問題継続</option>
                            <option value="end" ${buzzAction === 'end' ? 'selected' : ''}>問題終了</option>
                        </select>
                    </div>

                    <div id="buzz-penalty-area">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <label class="config-label" style="margin:0; white-space:nowrap; min-width:80px;">おてつき</label>
                            <select id="config-buzz-penalty" class="config-select" style="flex:1; height:38px;">
                                <option value="none" ${buzzPenalty === 'none' ? 'selected' : ''}>なし</option>
                                <option value="otetski" ${buzzPenalty === 'otetski' ? 'selected' : ''}>あり（次の問題まで解答権なし）</option>
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
                // penalty options are now fixed, no need to change them
            };

            buzzPenaltySel.onchange = () => {
                if (buzzPenaltyDetail) buzzPenaltyDetail.innerHTML = '';
            };
        }
    },

    // ゲームタイプカード（選択肢 + 詳細設定ボタン）をレンダリング
    renderGameTypeCards: function (selectedType, conf) {
        const container = document.getElementById('gametype-selector');
        if (!container) return;

        const types = [
            {
                value: 'score',
                icon: '🏅',
                label: '得点制',
                desc: '正解で得点加算',
                color: '#00bfff',
                hasDetail: true
            },
            {
                value: 'panel',
                icon: '🟦',
                label: 'パネル制',
                desc: '25枚パネル',
                color: '#ffd700',
                hasDetail: false
            },
            {
                value: 'slot',
                icon: '🎰',
                label: '変動得点制',
                desc: 'スロットで得点',
                color: '#ff00ff',
                hasDetail: true
            }
        ];

        const self = this;

        container.innerHTML = '';
        types.forEach(t => {
            const isSelected = (selectedType === t.value);
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-radius: 10px;
                border: 2px solid ${isSelected ? t.color : '#333'};
                background: ${isSelected ? `rgba(${self._hexToRgb(t.color)}, 0.1)` : '#1a1a1a'};
                cursor: pointer;
                transition: all 0.2s;
            `;

            // --- Left: radio indicator + icon + text ---
            const left = document.createElement('div');
            left.style.cssText = 'display:flex; align-items:center; gap:10px; flex:1;';
            left.innerHTML = `
                <div style="
                    width:18px; height:18px; border-radius:50%;
                    border: 2px solid ${isSelected ? t.color : '#555'};
                    background: ${isSelected ? t.color : 'transparent'};
                    display:flex; align-items:center; justify-content:center;
                    flex-shrink:0;
                    box-shadow: ${isSelected ? `0 0 8px ${t.color}88` : 'none'};
                ">
                    ${isSelected ? '<div style="width:6px;height:6px;border-radius:50%;background:#000;"></div>' : ''}
                </div>
                <span style="font-size:1.3em;">${t.icon}</span>
                <div>
                    <div style="font-weight:bold; color:${isSelected ? t.color : '#ccc'}; font-size:0.95em;">${t.label}</div>
                    <div style="font-size:0.72em; color:#666;">${t.desc}</div>
                </div>
            `;
            left.onclick = () => {
                document.getElementById('config-game-type').value = t.value;
                self.renderGameTypeCards(t.value, conf);
                self.toggleScoreSections(t.value !== 'panel');
            };
            row.appendChild(left);

            // --- Right: 詳細設定ボタン (if has detail) ---
            if (t.hasDetail) {
                const detailBtn = document.createElement('button');
                detailBtn.type = 'button';
                detailBtn.style.cssText = `
                    background: rgba(255,255,255,0.06);
                    border: 1px solid #444;
                    color: #aaa;
                    border-radius: 20px;
                    padding: 5px 12px;
                    font-size: 0.75em;
                    cursor: pointer;
                    white-space: nowrap;
                    flex-shrink: 0;
                `;
                detailBtn.innerHTML = '⚙ 詳細';
                detailBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Select this type first
                    document.getElementById('config-game-type').value = t.value;
                    self.renderGameTypeCards(t.value, conf);
                    self.toggleScoreSections(t.value !== 'panel');
                    // Open bottom sheet
                    self.openGameTypeDetailSheet(t.value, conf);
                };
                row.appendChild(detailBtn);
            }

            container.appendChild(row);
        });
    },

    _hexToRgb: function (hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r},${g},${b}`;
    },

    // ボトムシートで詳細設定を開く
    openGameTypeDetailSheet: function (gameType, conf) {
        if (document.getElementById('gametype-detail-sheet')) {
            document.getElementById('gametype-detail-sheet').remove();
        }

        let sheetContent = '';

        if (gameType === 'score') {
            const scoreType = conf.scoreType || 'uniform';
            sheetContent = `
                <h3 style="margin:0 0 16px 0; font-size:1.1em; color:#00bfff; display:flex; align-items:center; gap:8px;">
                    🏅 得点制 — 正解ボーナス方式
                </h3>
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;" id="score-type-radio-group">
                    ${['uniform', 'ranked', 'first_come'].map((v, i) => {
                const labels = ['① 全員一律', '② 順位ボーナス', '③ 先着のみ'];
                const descs = ['正解した全員に同じ点数を加算', '正解順位に応じて異なる点数を加算', '指定した先着人数のみ得点'];
                const sel = (scoreType === v);
                return `<label style="
                            display:flex; align-items:center; gap:12px;
                            padding:12px 14px; border-radius:10px;
                            border:2px solid ${sel ? '#00bfff' : '#333'};
                            background: ${sel ? 'rgba(0,191,255,0.08)' : '#111'};
                            cursor:pointer;
                        ">
                            <input type="radio" name="score-type-radio" value="${v}" ${sel ? 'checked' : ''} style="display:none;">
                            <div style="
                                width:16px; height:16px; border-radius:50%;
                                border:2px solid ${sel ? '#00bfff' : '#555'};
                                background:${sel ? '#00bfff' : 'transparent'};
                                flex-shrink:0;
                            "></div>
                            <div>
                                <div style="font-weight:bold; color:${sel ? '#00bfff' : '#ccc'}; font-size:0.9em;">${labels[i]}</div>
                                <div style="font-size:0.72em; color:#666;">${descs[i]}</div>
                            </div>
                        </label>`;
            }).join('')}
                </div>
                <div id="score-type-sheet-detail" style="background:rgba(0,0,0,0.3); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); margin-bottom:16px; min-height:60px;"></div>
            `;
        } else if (gameType === 'slot') {
            sheetContent = `
                <h3 style="margin:0 0 16px 0; font-size:1.1em; color:#ff00ff; display:flex; align-items:center; gap:8px;">
                    🎰 変動得点制 — スロット設定
                </h3>
                <p style="color:#aaa; font-size:0.85em; margin-bottom:16px;">正解時にスロットを回し、出た目が得点になります。</p>
                <div style="display:flex; gap:15px; align-items:center;">
                    <div style="flex:1;">
                        <label style="font-size:0.75em; color:#888; display:block; margin-bottom:4px;">最小値</label>
                        <input type="number" id="conf-slot-min" value="${conf.slotMin || 1}" min="0"
                            style="width:100%; padding:10px; background:#111; border:1px solid #444; color:#fff; border-radius:6px; font-size:1em; text-align:center;">
                    </div>
                    <div style="color:#555; font-size:1.2em; margin-top:16px;">〜</div>
                    <div style="flex:1;">
                        <label style="font-size:0.75em; color:#888; display:block; margin-bottom:4px;">最大値</label>
                        <input type="number" id="conf-slot-max" value="${conf.slotMax || 10}" min="1"
                            style="width:100%; padding:10px; background:#111; border:1px solid #444; color:#fff; border-radius:6px; font-size:1em; text-align:center;">
                    </div>
                </div>
            `;
        }

        const sheet = document.createElement('div');
        sheet.id = 'gametype-detail-sheet';
        sheet.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; z-index:19999; display:flex; flex-direction:column; justify-content:flex-end;';
        sheet.innerHTML = `
            <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65);"
                onclick="document.getElementById('gametype-detail-sheet').remove()"></div>
            <div id="gametype-sheet-inner" style="
                position:relative;
                background:#1a1a1a;
                padding:20px 20px 30px 20px;
                border-radius:20px 20px 0 0;
                box-shadow:0 -5px 30px rgba(0,0,0,0.6);
                animation: slideUp 0.3s ease-out;
                max-height: 85vh;
                overflow-y: auto;
            ">
                <div style="width:36px; height:4px; background:#444; border-radius:2px; margin:0 auto 20px auto;"></div>
                ${sheetContent}
                <button id="gametype-sheet-done-btn" style="
                    width:100%; padding:14px; border:none; border-radius:10px;
                    background: linear-gradient(135deg, #00bfff, #0080ff);
                    color:#fff; font-size:1em; font-weight:bold; cursor:pointer;
                    box-shadow: 0 4px 12px rgba(0,191,255,0.3);
                ">✓ 確定</button>
            </div>
        `;
        document.body.appendChild(sheet);

        const self = this;

        // Setup score type radio interactions
        if (gameType === 'score') {
            const radios = sheet.querySelectorAll('input[name="score-type-radio"]');
            const radioLabels = sheet.querySelectorAll('#score-type-radio-group label');

            const renderDetail = (val) => {
                self.renderScoreDetailInSheet(val, conf);
            };

            // Style + interaction
            radios.forEach((radio, i) => {
                const parentLabel = radioLabels[i];
                parentLabel.onclick = () => {
                    radios.forEach(r => r.checked = false);
                    radio.checked = true;
                    // Update visual
                    radioLabels.forEach((lbl, li) => {
                        const isActive = (li === i);
                        lbl.style.borderColor = isActive ? '#00bfff' : '#333';
                        lbl.style.background = isActive ? 'rgba(0,191,255,0.08)' : '#111';
                        const dot = lbl.querySelector('div');
                        if (dot) {
                            dot.style.borderColor = isActive ? '#00bfff' : '#555';
                            dot.style.background = isActive ? '#00bfff' : 'transparent';
                        }
                        const textDiv = lbl.querySelectorAll('div > div')[0];
                        if (textDiv) textDiv.style.color = isActive ? '#00bfff' : '#ccc';
                    });
                    renderDetail(radio.value);
                };
            });

            // Initial render
            renderDetail(conf.scoreType || 'uniform');
        }

        // Done button
        sheet.querySelector('#gametype-sheet-done-btn').onclick = () => {
            // Save score type
            if (gameType === 'score') {
                const selectedRadio = sheet.querySelector('input[name="score-type-radio"]:checked');
                if (selectedRadio) conf.scoreType = selectedRadio.value;
                // Save detail values
                self._collectScoreDetailFromSheet(conf);
            } else if (gameType === 'slot') {
                const slotMin = sheet.querySelector('#conf-slot-min');
                const slotMax = sheet.querySelector('#conf-slot-max');
                if (slotMin) conf.slotMin = parseInt(slotMin.value) || 1;
                if (slotMax) conf.slotMax = parseInt(slotMax.value) || 10;
            }
            sheet.remove();
        };
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

    // ★ Legacy stub (kept for executeSave references that expect DOM elements before sheet-based input)
    renderScoreDetail: function (scoreType, conf) {
        // No-op: score detail is now handled in the bottom sheet
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

        // conf オブジェクトにはボトムシートで確定した値が保存されている
        const currentConf = this.selectedSetData?.config || {};

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
            // slot values: read from conf (set by bottom sheet), fallback to DOM if sheet still open
            slotMin: currentConf.slotMin !== undefined ? currentConf.slotMin : (parseInt(document.getElementById('conf-slot-min')?.value || "1") || 1),
            slotMax: currentConf.slotMax !== undefined ? currentConf.slotMax : (parseInt(document.getElementById('conf-slot-max')?.value || "10") || 10),
            turnOrder: document.getElementById('config-turn-order')?.value || 'fixed',
            turnPass: document.getElementById('config-turn-pass')?.value || 'ok',
            soloStyle: document.getElementById('config-solo-style')?.value || 'manual',
            soloTimeType: document.getElementById('config-solo-time-type')?.value || 'per_q',
            soloTimeVal: parseInt(document.getElementById('config-solo-time-val')?.value || "0") || 0,
            soloRecovery: parseInt(document.getElementById('config-solo-recovery')?.value || "0") || 0,
            // score values: read from conf (set by bottom sheet)
            scoreType: currentConf.scoreType || 'uniform',
            uniformPts: currentConf.uniformPts !== undefined ? currentConf.uniformPts : 1,
            rankPts: currentConf.rankPts || [10, 5, 3],
            rankOtherPts: currentConf.rankOtherPts !== undefined ? currentConf.rankOtherPts : 1,
            firstComeCount: currentConf.firstComeCount !== undefined ? currentConf.firstComeCount : 1,
            firstComePts: currentConf.firstComePts !== undefined ? currentConf.firstComePts : 10,
            // 制限時間
            timeLimitEnabled: document.getElementById('config-time-limit-enabled')?.value || 'off',
            timeLimitSeconds: parseInt(document.getElementById('config-time-limit-seconds-input')?.value ||
                document.getElementById('config-time-limit-seconds')?.value || '30') || 30
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
