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

        if (container) container.innerHTML = '<p class="text-center text-gray p-20">セットを選択してください</p>';
        if (actionArea) actionArea.classList.add('hidden');

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

        if (questions.length > 0) {
            qType = questions[0].type;
            if (qType === 'choice') typeDisplay = APP_TEXT.Creator.TypeChoice;
            else if (qType === 'letter_select') typeDisplay = "文字選択 (Letter)";
            else if (qType === 'sort') typeDisplay = APP_TEXT.Creator.TypeSort;
            else if (qType === 'free_oral') { typeDisplay = APP_TEXT.Creator.TypeFreeOral; isOral = true; }
            else if (qType === 'free_written') typeDisplay = APP_TEXT.Creator.TypeFreeWritten;
            else if (qType === 'multi') typeDisplay = APP_TEXT.Creator.TypeMulti;
        }

        const normalOption = isOral
            ? `<option value="normal" disabled style="color:#555;">✖ 一斉回答 (口頭形式では選択不可)</option>`
            : `<option value="normal">一斉回答 (Normal)</option>`;

        let html = `
            <div style="background:#252525; padding:12px; border-radius:6px; border:1px solid #444; border-left:4px solid #aaa; margin-bottom:20px; display:flex; align-items:center;">
                <div style="color:#aaa; font-size:0.9em; font-weight:bold; margin-right:10px;">収録形式:</div>
                <div style="color:#fff; font-weight:bold; font-size:1.1em;">${typeDisplay}</div>
                <div style="color:#666; font-size:0.8em; margin-left:auto; font-family:monospace;">全${questions.length}問</div>
            </div>
        `;

        html += `<div class="config-section-title">ルールの策定</div>`;

        html += `
            <div class="config-item-box">
                <div class="mb-15">
                    <label class="config-label">1. 回答モード (Answer Mode)</label>
                    <div class="mode-selector-grid">
                        <div class="mode-card ${isOral ? 'disabled opacity-30 cursor-not-allowed' : ''}" data-mode="normal">
                            <span class="mode-card-icon">⚡</span>
                            <div class="mode-card-title">一斉回答</div>
                            <div class="mode-card-desc">SIMULTANEOUS</div>
                        </div>
                        <div class="mode-card" data-mode="buzz">
                            <span class="mode-card-icon">🚨</span>
                            <div class="mode-card-title">早押し</div>
                            <div class="mode-card-desc">BUZZ-IN</div>
                        </div>
                        <div class="mode-card" data-mode="turn">
                            <span class="mode-card-icon">🔄</span>
                            <div class="mode-card-title">順番回答</div>
                            <div class="mode-card-desc">TURN-BASED</div>
                        </div>
                        <div class="mode-card" data-mode="solo">
                            <span class="mode-card-icon">🏆</span>
                            <div class="mode-card-title">ソロ挑戦</div>
                            <div class="mode-card-desc">SOLO CHALLENGE</div>
                        </div>
                    </div>
                    <select id="config-mode-select" class="hidden">
                        <option value="normal">Normal</option>
                        <option value="buzz">Buzz</option>
                        <option value="turn">Turn</option>
                        <option value="solo">Solo</option>
                    </select>
                    <div id="mode-detail-area"></div>
                </div>

                <hr style="border:0; border-top:1px dashed #444; margin:20px 0;">

                <div class="mb-15">
                    <label class="config-label">2. ゲームタイプ (Reward Type)</label>
                    <select id="config-game-type" class="btn-block config-select">
                        <option value="score">得点制 (Score)</option>
                        <option value="panel">陣取り (Panel 25)</option>
                        <option value="race">レース / すごろく (Race)</option>
                        <option value="slot">u5909u52d5u5f97u70b9 (Slot)</option>
                    </select>
                    <div id="gametype-detail-area"></div>
                </div>

                <hr style="border:0; border-top:1px dashed #444; margin:20px 0;">

                <div class="mb-15">
                    <label class="config-label">3. モニター表示形式 (Monitor Display)</label>
                    <select id="config-display-mode" class="btn-block config-select">
                        <option value="flip" ${conf.displayMode === 'flip' ? 'selected' : ''}>一斉フリップ (タイル表示)</option>
                        <option value="distribution" ${conf.displayMode === 'distribution' ? 'selected' : ''}>分布グラフ (統計表示)</option>
                        <option value="ranking" ${conf.displayMode === 'ranking' ? 'selected' : ''}>ランキング風 (上位集計)</option>
                        <option value="none" ${conf.displayMode === 'none' ? 'selected' : ''}>表示なし (正解のみ)</option>
                    </select>
                </div>

                <hr style="border:0; border-top:1px dashed #444; margin:20px 0;">
                
                <h5 style="margin:15px 0 5px 0;">問題別配点・失点・時間設定</h5>
                <div id="config-bulk-grid" style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:15px; background:#222; padding:10px; border-radius:6px; border:1px solid #444;">
                    <div>
                        <label class="config-label" style="font-size:0.8em; color:#aaa;">${APP_TEXT.Config.LabelHeaderTime}</label>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <input type="number" id="config-bulk-time-input" value="10" min="1" placeholder="Sec" style="width:100%; text-align:center;">
                            <button id="config-bulk-time-btn" class="btn-mini btn-dark">SET</button>
                        </div>
                        <button id="config-bulk-time-inf-btn" class="btn-mini btn-info" style="width:100%; font-size:0.8em;">なし (No Limit)</button>
                    </div>
                    <div class="score-section">
                        <label class="config-label" style="font-size:0.8em; color:#0055ff;">${APP_TEXT.Config.LabelHeaderPt}</label>
                        <div style="display:flex; gap:5px;">
                            <input type="number" id="config-bulk-point-input" value="1" min="1" style="width:100%; text-align:center; color:#0055ff; font-weight:bold;">
                            <button id="config-bulk-point-btn" class="btn-mini btn-primary">SET</button>
                        </div>
                    </div>
                    <div class="score-section">
                        <label class="config-label" style="font-size:0.8em; color:#d00;">${APP_TEXT.Config.LabelHeaderLoss}</label>
                        <div style="display:flex; gap:5px;">
                            <input type="number" id="config-bulk-loss-input" value="0" min="0" style="width:100%; text-align:center; color:#d00; font-weight:bold;">
                            <button id="config-bulk-loss-btn" class="btn-mini btn-danger">SET</button>
                        </div>
                    </div>
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

        if (conf.mode) {
            if (isOral && conf.mode === 'normal') modeSel.value = 'buzz';
            else modeSel.value = conf.mode;
        } else {
            modeSel.value = isOral ? 'buzz' : 'normal';
        }

        if (conf.gameType) typeSel.value = conf.gameType;

        updateDetails();
        this.renderQList();
        this.toggleScoreSections(typeSel.value !== 'panel');

        // Setup mode card click handlers
        document.querySelectorAll('.mode-card').forEach(card => {
            if (card.classList.contains('disabled')) return;

            card.onclick = () => {
                const selectedMode = card.dataset.mode;

                // Update visual state
                document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                // Update hidden select
                modeSel.value = selectedMode;

                // Trigger detail rendering
                updateDetails();
            };
        });

        // Set initial active card
        const initialMode = modeSel.value;
        document.querySelectorAll('.mode-card').forEach(card => {
            if (card.dataset.mode === initialMode) {
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
        document.getElementById('config-bulk-time-btn').onclick = () => {
            const val = document.getElementById('config-bulk-time-input').value;
            document.querySelectorAll('.q-time-input').forEach(inp => { inp.value = val; inp.type = "number"; });
        };
        document.getElementById('config-bulk-time-inf-btn').onclick = () => {
            document.querySelectorAll('.q-time-input').forEach(inp => { inp.type = "text"; inp.value = "なし"; });
            App.Ui.showToast("制限時間を「なし」に設定しました");
        };
        document.getElementById('config-bulk-point-btn').onclick = () => {
            const val = document.getElementById('config-bulk-point-input').value;
            document.querySelectorAll('.q-point-input').forEach(inp => inp.value = val);
        };
        document.getElementById('config-bulk-loss-btn').onclick = () => {
            const val = document.getElementById('config-bulk-loss-input').value;
            document.querySelectorAll('.q-loss-input').forEach(inp => inp.value = val);
        };
    },

    renderModeDetail: function (mode, conf = {}, qType = 'choice') {
        const area = document.getElementById('mode-detail-area');
        let html = '';

        if (mode === 'normal') {
            const canRetry = ['choice', 'sort', 'letter_select', 'multi'].includes(qType);
            let limitSelect = '';
            if (canRetry) {
                limitSelect = `
                    <select id="config-normal-limit" class="btn-block config-select">
                        <option value="unlimited" ${conf.normalLimit === 'unlimited' ? 'selected' : ''}>${APP_TEXT.Config.NormalLimitUnlimited}</option>
                        <option value="one" ${conf.normalLimit === 'one' ? 'selected' : ''}>${APP_TEXT.Config.NormalLimitOne}</option>
                    </select>`;
            } else {
                limitSelect = `
                    <select id="config-normal-limit" class="btn-block config-select" disabled style="opacity:0.7; cursor:not-allowed;">
                        <option value="one" selected>1回のみ (固定)</option>
                    </select>
                    <p style="font-size:0.8em; color:#ffd700; margin-top:5px;">※この形式は回答の修正ができません</p>
                `;
            }

            html += `
                <div class="mode-settings-box mode-box-normal">
                    <div class="grid-2-col">
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelNormalLimit}</label>
                            ${limitSelect}
                        </div>
                        <div>
                            <label class="config-label">回答のオープン方法</label>
                            <select id="config-manual-flip" class="btn-block config-select">
                                <option value="false" ${conf.manualFlip === false ? 'selected' : ''}>自動 (即正解発表へ)</option>
                                <option value="true" ${conf.manualFlip === true ? 'selected' : ''}>手動 (一斉オープンを挟む)</option>
                            </select>
                        </div>
                    </div>
                </div>`;
        } else if (mode === 'buzz') {
            // ★修正: 選択肢の文言をわかりやすく変更
            html += `
                <div class="mode-settings-box mode-box-buzz" style="text-align:center;">
                    <div style="margin-bottom:20px;">
                        <label class="config-label">早押しボタン プレビュー</label>
                        <div class="buzzer-preview-btn">PUSH!</div>
                        <p style="font-size:0.75em; color:#888;">※実際の回答者画面に表示されるボタンです</p>
                    </div>
                    <div class="grid-2-col">
                        <div>
                            <label class="config-label">誤答時の処理</label>
                            <select id="config-buzz-wrong-action" class="btn-block config-select">
                                <option value="next" ${conf.buzzWrongAction === 'next' ? 'selected' : ''}>誤答者以外で早押し再開</option>
                                <option value="reset" ${conf.buzzWrongAction === 'reset' ? 'selected' : ''}>全員リセット (全員復活)</option>
                                <option value="end" ${conf.buzzWrongAction === 'end' ? 'selected' : ''}>その問題終了 (打ち切り)</option>
                            </select>
                        </div>
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelBuzzTime}</label>
                            <select id="config-buzz-timer" class="btn-block config-select">
                                <option value="0">${APP_TEXT.Config.BuzzTimeNone}</option>
                                <option value="5" ${conf.buzzTime === 5 ? 'selected' : ''}>${APP_TEXT.Config.BuzzTime5}</option>
                                <option value="10" ${conf.buzzTime === 10 ? 'selected' : ''}>${APP_TEXT.Config.BuzzTime10}</option>
                            </select>
                        </div>
                    </div>
                </div>`;
        } else if (mode === 'turn') {
            html += `
                <div class="mode-settings-box mode-box-turn">
                    <div class="grid-2-col">
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelTurnOrder}</label>
                            <select id="config-turn-order" class="btn-block config-select">
                                <option value="fixed" ${conf.turnOrder === 'fixed' ? 'selected' : ''}>${APP_TEXT.Config.TurnOrderFixed}</option>
                                <option value="random" ${conf.turnOrder === 'random' ? 'selected' : ''}>${APP_TEXT.Config.TurnOrderRandom}</option>
                                <option value="rank" ${conf.turnOrder === 'rank' ? 'selected' : ''}>${APP_TEXT.Config.TurnOrderRank}</option>
                            </select>
                        </div>
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelTurnPass}</label>
                            <select id="config-turn-pass" class="btn-block config-select">
                                <option value="ok" ${conf.turnPass === 'ok' ? 'selected' : ''}>${APP_TEXT.Config.TurnPassOk}</option>
                                <option value="ng" ${conf.turnPass === 'ng' ? 'selected' : ''}>${APP_TEXT.Config.TurnPassNg}</option>
                            </select>
                        </div>
                    </div>
                </div>`;
        } else if (mode === 'solo') {
            html += `
                <div class="mode-settings-box mode-box-solo">
                    <div class="grid-2-col">
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelSoloStyle}</label>
                            <select id="config-solo-style" class="btn-block config-select">
                                <option value="manual" ${conf.soloStyle === 'manual' ? 'selected' : ''}>${APP_TEXT.Config.SoloStyleManual}</option>
                                <option value="correct" ${conf.soloStyle === 'correct' ? 'selected' : ''}>${APP_TEXT.Config.SoloStyleCorrect}</option>
                                <option value="auto" ${conf.soloStyle === 'auto' ? 'selected' : ''}>${APP_TEXT.Config.SoloStyleAuto}</option>
                            </select>
                        </div>
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelSoloTimeType}</label>
                            <select id="config-solo-time-type" class="btn-block config-select">
                                <option value="per_q" ${conf.soloTimeType === 'per_q' ? 'selected' : ''}>${APP_TEXT.Config.SoloTimePerQ}</option>
                                <option value="total" ${conf.soloTimeType === 'total' ? 'selected' : ''}>${APP_TEXT.Config.SoloTimeTotal}</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid-2-col mt-10">
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
    },

    renderGameTypeDetail: function (gameType, conf = {}) {
        const area = document.getElementById('gametype-detail-area');
        let html = '';
        if (gameType === 'panel') {
            html += `<div class="mode-settings-box mode-box-normal" style="border-color:#ffd700; margin-top:5px;">
                <label style="color:#ffd700;">★ 陣取りモード (Panel 25)</label>
                <p class="unit-text">25枚のパネル操作盤を有効にします。</p>
            </div>`;
        } else if (gameType === 'race') {
            html += `<div class="mode-settings-box mode-box-normal" style="border-color:#00ff00; margin-top:5px;">
                <label style="color:#00ff00;">★ レースモード (Race)</label>
                <div class="mt-5">
                    <label class="config-label">ゴールまでのポイント</label>
                    <input type="number" id="conf-pass-count" value="${conf.passCount || 10}" class="config-select">
                </div>
            </div>`;
        } else if (gameType === 'slot') {
            html += `<div class="mode-settings-box mode-box-normal" style="border-color:#ff00ff; margin-top:5px;">
                <label style="color:#ff00ff;">★ 変動得点モード (Slot)</label>
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
                <div class="config-q-header">
                    <span class="config-q-index">Q${i + 1}</span>
                    <input type="text" class="q-text-input config-select" data-index="${i}" value="${q.q}" style="flex:1; margin-left:10px; height:34px; font-size:0.9em;">
                </div>
                <div class="config-q-settings-grid">
                    <div class="config-q-input-group">
                        <label>制限時間</label>
                        <div style="display:flex; gap:5px;">
                            <input type="${inputType}" class="q-time-input" data-index="${i}" value="${timeVal}" style="width:60px;" onfocus="this.type='number'; this.value='';" onblur="if(this.value==''||this.value=='0'){this.type='text';this.value='なし';}">
                            <button type="button" class="btn-no-limit-mini" onclick="this.previousElementSibling.type='text'; this.previousElementSibling.value='なし';">なし</button>
                        </div>
                    </div>
                    <div class="config-q-input-group score-section">
                        <label style="color:var(--color-primary);">Pt</label>
                        <input type="number" class="q-point-input" data-index="${i}" value="${q.points || 1}" style="width:50px; color:var(--color-primary);">
                    </div>
                    <div class="config-q-input-group score-section">
                        <label style="color:var(--color-danger);">Loss</label>
                        <input type="number" class="q-loss-input" data-index="${i}" value="${q.loss || 0}" style="width:50px; color:var(--color-danger);">
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

        const typeSel = document.getElementById('config-game-type');
        if (typeSel && typeSel.value === 'panel') {
            this.toggleScoreSections(false);
        }
    },

    saveRulesToSet: function () {
        if (!this.selectedSetKey) return;

        const mode = document.getElementById('config-mode-select').value;
        const gameType = document.getElementById('config-game-type').value;
        const qs = JSON.parse(JSON.stringify(this.selectedSetData.questions));

        document.querySelectorAll('.q-text-input').forEach(inp => qs[inp.dataset.index].q = inp.value);
        document.querySelectorAll('.q-point-input').forEach(inp => qs[inp.dataset.index].points = parseInt(inp.value));
        document.querySelectorAll('.q-loss-input').forEach(inp => qs[inp.dataset.index].loss = parseInt(inp.value));
        document.querySelectorAll('.q-time-input').forEach(inp => {
            const val = inp.value;
            qs[inp.dataset.index].timeLimit = (val === "なし" || val === "" || val === "0") ? 0 : (parseInt(val) || 0);
        });

        const newConfig = {
            mode: mode,
            gameType: gameType,
            displayMode: document.getElementById('config-display-mode')?.value || 'flip',
            buzzWrongAction: document.getElementById('config-buzz-wrong-action')?.value || 'next',
            buzzTime: parseInt(document.getElementById('config-buzz-timer')?.value) || 0,
            normalLimit: document.getElementById('config-normal-limit')?.value || 'unlimited',
            manualFlip: document.getElementById('config-manual-flip')?.value === 'true',
            passCount: parseInt(document.getElementById('conf-pass-count')?.value) || 10,
            slotMin: parseInt(document.getElementById('conf-slot-min')?.value) || 1,
            slotMax: parseInt(document.getElementById('conf-slot-max')?.value) || 10,
            turnOrder: document.getElementById('config-turn-order')?.value,
            turnPass: document.getElementById('config-turn-pass')?.value,
            soloStyle: document.getElementById('config-solo-style')?.value,
            soloTimeType: document.getElementById('config-solo-time-type')?.value,
            soloTimeVal: parseInt(document.getElementById('config-solo-time-val')?.value) || 0,
            soloRecovery: parseInt(document.getElementById('config-solo-recovery')?.value) || 0
        };

        window.db.ref(`saved_sets/${App.State.currentShowId}/${this.selectedSetKey}`).update({
            config: newConfig,
            questions: qs
        }).then(() => {
            App.Ui.showToast(APP_TEXT.Config.MsgRulesSaved);
            this.loadSetList();
        });
    }
};

window.enterConfigMode = () => App.Config.init();
