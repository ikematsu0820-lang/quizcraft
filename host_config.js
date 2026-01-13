/* =========================================================
 * host_config.js (v143: Rename Buzz Options)
 * =======================================================*/

App.Config = {
    selectedSetQuestions: [],
    editingTitle: "", 

    init: function() {
        App.Ui.showView(App.Ui.views.config);
        
        const setSelect = document.getElementById('config-set-select');
        const container = document.getElementById('config-builder-ui');
        
        if(setSelect) {
            setSelect.innerHTML = `<option value="">${APP_TEXT.Config.SelectDefault}</option>`;
            const newSelect = setSelect.cloneNode(true);
            setSelect.parentNode.replaceChild(newSelect, setSelect);
            newSelect.addEventListener('change', () => this.updateBuilderUI());
        }
        
        if(container) container.innerHTML = '<p class="text-center text-gray p-20">セットを選択してください</p>';
        document.getElementById('config-program-title').value = '';
        document.getElementById('config-final-ranking-chk').checked = true;

        this.loadSetList();
        this.renderPreview();
        this.setupModal();
    },

    loadSetList: function() {
        const select = document.getElementById('config-set-select');
        if(!select) return;
        select.innerHTML = `<option value="">Loading...</option>`;
        if(!App.State.currentShowId) return;

        window.db.ref(`saved_sets/${App.State.currentShowId}`).once('value', snap => {
            const data = snap.val();
            select.innerHTML = `<option value="">${APP_TEXT.Config.SelectDefault}</option>`;
            if(data) {
                const items = Object.keys(data).map(k => ({...data[k], key: k})).sort((a,b)=>b.createdAt-a.createdAt);
                items.forEach(item => {
                    const opt = document.createElement('option');
                    const val = { t: item.title, q: item.questions, c: item.config };
                    opt.value = JSON.stringify(val);
                    opt.textContent = `${item.title} (${new Date(item.createdAt).toLocaleDateString()})`;
                    select.appendChild(opt);
                });
            }
        });
    },

    updateBuilderUI: function() {
        const container = document.getElementById('config-builder-ui');
        const select = document.getElementById('config-set-select');
        
        if(!select.value) {
            this.selectedSetQuestions = [];
            this.editingTitle = "";
            container.innerHTML = '<p class="text-center text-gray p-20">セットを選択してください</p>';
            return;
        } 

        const data = JSON.parse(select.value);
        this.selectedSetQuestions = data.q || [];
        this.editingTitle = data.t || "";
        const conf = data.c || {};
        
        this.renderBuilderForm(conf, this.selectedSetQuestions);
    },

    renderBuilderForm: function(conf, questions) {
        const container = document.getElementById('config-builder-ui');
        let typeDisplay = "不明";
        let isOral = false;
        let qType = 'choice'; 

        if(questions.length > 0) {
            qType = questions[0].type;
            if(qType === 'choice') typeDisplay = APP_TEXT.Creator.TypeChoice;
            else if(qType === 'letter_select') typeDisplay = "文字選択 (Letter)";
            else if(qType === 'sort') typeDisplay = APP_TEXT.Creator.TypeSort;
            else if(qType === 'free_oral') { typeDisplay = APP_TEXT.Creator.TypeFreeOral; isOral = true; }
            else if(qType === 'free_written') typeDisplay = APP_TEXT.Creator.TypeFreeWritten;
            else if(qType === 'multi') typeDisplay = APP_TEXT.Creator.TypeMulti;
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

        html += `<div class="config-section-title">${APP_TEXT.Config.LabelRule}</div>`;
        
        html += `
            <div class="config-item-box">
                <div class="mb-15">
                    <label class="config-label">1. 回答モード (Answer Mode)</label>
                    <select id="config-mode-select" class="btn-block config-select mb-10 highlight-select">
                        ${normalOption}
                        <option value="buzz">早押し (Buzz)</option>
                        <option value="turn">順番回答 (Turn)</option>
                        <option value="solo">ソロ挑戦 (Solo)</option>
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
                    </select>
                    <div id="gametype-detail-area"></div>
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

        html += `<button id="config-add-playlist-btn" class="btn-success btn-block btn-large mt-20">${APP_TEXT.Config.BtnAddList}</button>`;

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
        
        document.getElementById('config-add-playlist-btn').onclick = () => this.addPeriod();
        
        document.getElementById('btn-toggle-q-list').onclick = () => {
            const list = document.getElementById('config-questions-list');
            list.classList.toggle('hidden');
        };

        this.setupBulkButtons();
        
        if(conf.mode) {
            if (isOral && conf.mode === 'normal') modeSel.value = 'buzz';
            else modeSel.value = conf.mode;
        } else {
            modeSel.value = isOral ? 'buzz' : 'normal';
        }
        
        if (conf.gameType) typeSel.value = conf.gameType;

        updateDetails();
        this.renderQList();
        this.toggleScoreSections(typeSel.value !== 'panel');
    },

    toggleScoreSections: function(show) {
        document.querySelectorAll('.score-section').forEach(el => {
            if(show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
        const bulkGrid = document.getElementById('config-bulk-grid');
        if(bulkGrid) {
            bulkGrid.style.gridTemplateColumns = show ? "1fr 1fr 1fr" : "1fr";
        }
    },

    setupBulkButtons: function() {
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

    renderModeDetail: function(mode, conf = {}, qType = 'choice') {
        const area = document.getElementById('mode-detail-area');
        let html = '';

        if(mode === 'normal') {
            const canRetry = ['choice', 'sort', 'letter_select', 'multi'].includes(qType);
            let limitSelect = '';
            if (canRetry) {
                limitSelect = `
                    <select id="config-normal-limit" class="btn-block config-select">
                        <option value="unlimited" ${conf.normalLimit==='unlimited'?'selected':''}>${APP_TEXT.Config.NormalLimitUnlimited}</option>
                        <option value="one" ${conf.normalLimit==='one'?'selected':''}>${APP_TEXT.Config.NormalLimitOne}</option>
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
                    <div class="mt-5">
                        <label class="config-label">${APP_TEXT.Config.LabelNormalLimit}</label>
                        ${limitSelect}
                    </div>
                    <div class="mt-10">
                        <label class="config-label">${APP_TEXT.Config.LabelShuffleQ}</label>
                        <select id="config-shuffle-q" class="btn-block config-select">
                            <option value="off">${APP_TEXT.Config.ShuffleQOff}</option>
                            <option value="on">${APP_TEXT.Config.ShuffleQOn}</option>
                        </select>
                    </div>
                </div>`;
        } else if(mode === 'buzz') {
            // ★修正: 選択肢の文言をわかりやすく変更
            html += `
                <div class="mode-settings-box mode-box-buzz">
                    <div class="grid-2-col">
                        <div>
                            <label class="config-label">誤答時の処理</label>
                            <select id="config-buzz-wrong-action" class="btn-block config-select">
                                <option value="next" ${conf.buzzWrongAction==='next'?'selected':''}>誤答者以外で早押し再開</option>
                                <option value="reset" ${conf.buzzWrongAction==='reset'?'selected':''}>全員リセット (全員復活)</option>
                                <option value="end" ${conf.buzzWrongAction==='end'?'selected':''}>その問題終了 (打ち切り)</option>
                            </select>
                        </div>
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelBuzzTime}</label>
                            <select id="config-buzz-timer" class="btn-block config-select">
                                <option value="0">${APP_TEXT.Config.BuzzTimeNone}</option>
                                <option value="5" ${conf.buzzTime===5?'selected':''}>${APP_TEXT.Config.BuzzTime5}</option>
                                <option value="10" ${conf.buzzTime===10?'selected':''}>${APP_TEXT.Config.BuzzTime10}</option>
                            </select>
                        </div>
                    </div>
                    <div class="mt-10">
                        <label class="config-label">${APP_TEXT.Config.LabelShuffleQ}</label>
                        <select id="config-buzz-shuffle" class="btn-block config-select">
                            <option value="off">${APP_TEXT.Config.ShuffleQOff}</option>
                            <option value="on">${APP_TEXT.Config.ShuffleQOn}</option>
                        </select>
                    </div>
                </div>`;
        } else if(mode === 'turn') {
            html += `
                <div class="mode-settings-box mode-box-turn">
                    <div class="grid-2-col">
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelTurnOrder}</label>
                            <select id="config-turn-order" class="btn-block config-select">
                                <option value="fixed">${APP_TEXT.Config.TurnOrderFixed}</option>
                                <option value="random">${APP_TEXT.Config.TurnOrderRandom}</option>
                                <option value="rank">${APP_TEXT.Config.TurnOrderRank}</option>
                            </select>
                        </div>
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelTurnPass}</label>
                            <select id="config-turn-pass" class="btn-block config-select">
                                <option value="ok">${APP_TEXT.Config.TurnPassOk}</option>
                                <option value="ng">${APP_TEXT.Config.TurnPassNg}</option>
                            </select>
                        </div>
                    </div>
                    <div class="mt-10">
                        <label class="config-label">${APP_TEXT.Config.LabelShuffleQ}</label>
                        <select id="config-turn-shuffle" class="btn-block config-select">
                            <option value="off">${APP_TEXT.Config.ShuffleQOff}</option>
                            <option value="on">${APP_TEXT.Config.ShuffleQOn}</option>
                        </select>
                    </div>
                </div>`;
        } else if(mode === 'solo') {
            html += `
                <div class="mode-settings-box mode-box-solo">
                    <div class="grid-2-col">
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelSoloStyle}</label>
                            <select id="config-solo-style" class="btn-block config-select">
                                <option value="manual">${APP_TEXT.Config.SoloStyleManual}</option>
                                <option value="correct">${APP_TEXT.Config.SoloStyleCorrect}</option>
                                <option value="auto">${APP_TEXT.Config.SoloStyleAuto}</option>
                            </select>
                        </div>
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelSoloTimeType}</label>
                            <select id="config-solo-time-type" class="btn-block config-select">
                                <option value="per_q">${APP_TEXT.Config.SoloTimePerQ}</option>
                                <option value="total">${APP_TEXT.Config.SoloTimeTotal}</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid-2-col mt-10">
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelSoloTimeValue}</label>
                            <div class="flex-center">
                                <input type="number" id="config-solo-time-val" class="btn-block" value="5" min="0" placeholder="0=なし" 
                                    onfocus="this.type='number'; this.value='';" 
                                    onblur="if(this.value==''||this.value=='0'){this.type='text';this.value='なし';}">
                                <span class="unit-text">秒</span>
                            </div>
                        </div>
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelSoloRecovery}</label>
                            <select id="config-solo-recovery" class="btn-block config-select">
                                <option value="none">${APP_TEXT.Config.SoloRecoveryNone}</option>
                                <option value="1">+1s</option>
                                <option value="3">+3s</option>
                                <option value="5">+5s</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid-2-col mt-10">
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelSoloLife}</label>
                            <select id="config-solo-life" class="btn-block config-select">
                                <option value="3">3 Lives</option>
                                <option value="0">${APP_TEXT.Config.SoloLifeSudden}</option>
                                <option value="2">2 Lives</option>
                                <option value="5">5 Lives</option>
                            </select>
                        </div>
                        <div>
                            <label class="config-label">${APP_TEXT.Config.LabelSoloRetire}</label>
                            <select id="config-solo-retire" class="btn-block config-select">
                                <option value="off">${APP_TEXT.Config.SoloRetireOff}</option>
                                <option value="on">${APP_TEXT.Config.SoloRetireOn}</option>
                            </select>
                        </div>
                    </div>
                </div>`;
        }
        area.innerHTML = html;
    },

    renderGameTypeDetail: function(gameType, conf = {}) {
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
                    <input type="number" id="conf-pass-count" value="${conf.passCount||10}" class="config-select">
                </div>
            </div>`;
        }
        area.innerHTML = html;
    },

    renderQList: function() {
        const list = document.getElementById('config-questions-list');
        list.innerHTML = '';
        this.selectedSetQuestions.forEach((q, i) => {
            const row = document.createElement('div');
            row.className = 'flex-center border-b p-5';
            row.style.borderBottom = '1px solid #333';
            row.style.padding = '8px 0';
            
            const isNoLimit = (q.timeLimit === 0 || q.timeLimit === undefined || q.timeLimit === "0");
            const timeVal = isNoLimit ? "なし" : q.timeLimit;
            const inputType = isNoLimit ? "text" : "number";

            row.innerHTML = `
                <div style="flex:1; margin-right:10px;">
                    <div style="font-size:0.7em; color:#888;">Q${i+1}</div>
                    <input type="text" class="q-text-input config-select" data-index="${i}" value="${q.q}" style="width:100%; padding:5px; border:1px solid #444;">
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <span style="font-size:0.6em; color:#aaa;">Time</span>
                        <input type="${inputType}" class="q-time-input" data-index="${i}" value="${timeVal}" style="width:50px; text-align:center; padding:5px; font-size:0.8em;" onfocus="this.type='number'; this.value='';" onblur="if(this.value==''||this.value=='0'){this.type='text';this.value='なし';}">
                    </div>
                    <div class="score-section" style="display:flex; flex-direction:column; align-items:center;">
                        <span style="font-size:0.6em; color:#0055ff;">Pt</span>
                        <input type="number" class="q-point-input" data-index="${i}" value="${q.points||1}" style="width:40px; text-align:center; color:#0055ff; font-weight:bold; padding:5px;">
                    </div>
                    <div class="score-section" style="display:flex; flex-direction:column; align-items:center;">
                        <span style="font-size:0.6em; color:#d00;">Loss</span>
                        <input type="number" class="q-loss-input" data-index="${i}" value="${q.loss||0}" style="width:40px; text-align:center; color:#d00; font-weight:bold; padding:5px;">
                    </div>
                </div>
            `;
            list.appendChild(row);
        });
        
        const typeSel = document.getElementById('config-game-type');
        if(typeSel && typeSel.value === 'panel') {
            this.toggleScoreSections(false);
        }
    },

    addPeriod: function() {
        const select = document.getElementById('config-set-select');
        let title = this.editingTitle || "Custom Set";
        if (select.value) {
             const raw = select.options[select.selectedIndex].text;
             title = raw.replace(/\s\([0-9/]+\)$/, '');
        }

        const mode = document.getElementById('config-mode-select').value;
        const gameType = document.getElementById('config-game-type').value;
        const qs = JSON.parse(JSON.stringify(this.selectedSetQuestions));
        
        document.querySelectorAll('.q-text-input').forEach(inp => qs[inp.dataset.index].q = inp.value);
        document.querySelectorAll('.q-point-input').forEach(inp => qs[inp.dataset.index].points = parseInt(inp.value));
        document.querySelectorAll('.q-loss-input').forEach(inp => qs[inp.dataset.index].loss = parseInt(inp.value));
        document.querySelectorAll('.q-time-input').forEach(inp => {
            const val = inp.value;
            qs[inp.dataset.index].timeLimit = (val === "なし" || val === "" || val === "0") ? 0 : (parseInt(val) || 0);
        });

        let shuffle = 'off';
        if(mode === 'normal') shuffle = document.getElementById('config-shuffle-q')?.value;
        else if(mode === 'buzz') shuffle = document.getElementById('config-buzz-shuffle')?.value;
        else if(mode === 'turn') shuffle = document.getElementById('config-turn-shuffle')?.value;
        
        if(shuffle === 'on') {
            for (let i = qs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [qs[i], qs[j]] = [qs[j], qs[i]];
            }
        }

        const newConfig = {
            mode: mode,
            gameType: gameType,
            buzzWrongAction: document.getElementById('config-buzz-wrong-action')?.value || 'next',
            buzzTime: parseInt(document.getElementById('config-buzz-timer')?.value) || 0,
            normalLimit: document.getElementById('config-normal-limit')?.value || 'unlimited',
            passCount: document.getElementById('conf-pass-count')?.value || 10
        };

        if (mode === 'solo') {
            newConfig.soloStyle = document.getElementById('config-solo-style')?.value;
            newConfig.soloTimeType = document.getElementById('config-solo-time-type')?.value;
            const sVal = document.getElementById('config-solo-time-val').value;
            newConfig.soloTimeVal = (sVal === 'なし' || sVal === '0') ? 0 : (parseInt(sVal) || 5);
            newConfig.soloLife = parseInt(document.getElementById('config-solo-life')?.value) || 3;
            newConfig.soloRetire = document.getElementById('config-solo-retire')?.value;
            newConfig.soloRecovery = parseInt(document.getElementById('config-solo-recovery')?.value) || 0;
        }

        App.Data.periodPlaylist.push({
            title: title,
            questions: qs,
            config: newConfig
        });
        
        this.selectedSetQuestions = [];
        this.editingTitle = "";
        document.getElementById('config-builder-ui').innerHTML = '<p class="text-center text-gray p-20">セットが追加されました</p>';
        select.value = "";
        
        this.renderPreview();
    },

    editPeriod: function(index) {
        if (!confirm("このピリオドを再編集しますか？\n（リストから削除され、エディタに戻ります）")) return;
        
        const item = App.Data.periodPlaylist[index];
        App.Data.periodPlaylist.splice(index, 1);
        
        this.selectedSetQuestions = item.questions;
        this.editingTitle = item.title;
        this.renderBuilderForm(item.config, item.questions);
        
        const select = document.getElementById('config-set-select');
        select.innerHTML = `<option value="">⚠️ 編集中: ${item.title}</option>`;
        select.value = ""; 

        this.renderPreview();
        document.querySelector('.panel-section.section-cyan').scrollIntoView({behavior: "smooth"});
        App.Ui.showToast("再編集モード: 設定を変更して再度追加してください");
    },

    renderPreview: function() {
        const list = document.getElementById('config-playlist-preview');
        list.innerHTML = '';
        if(App.Data.periodPlaylist.length === 0) {
            list.innerHTML = `<p class="empty-msg">${APP_TEXT.Config.AlertEmptyList}</p>`;
            return;
        }
        App.Data.periodPlaylist.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'timeline-card';
            div.innerHTML = `
                <div class="flex-1">
                    <div class="bold">${i+1}. ${item.title}</div>
                    <div class="text-sm text-gray">[${item.config.mode.toUpperCase()}] / [${item.config.gameType.toUpperCase()}] ${item.questions.length}Q</div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-mini btn-info" onclick="App.Config.editPeriod(${i})">Edit</button>
                    <button class="delete-btn btn-mini" onclick="App.Config.remove(${i})">Del</button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    remove: function(i) {
        if(!confirm("削除しますか？")) return;
        App.Data.periodPlaylist.splice(i, 1);
        this.renderPreview();
    },

    saveProgram: function() {
        const title = document.getElementById('config-program-title').value.trim();
        if(!title) return alert(APP_TEXT.Config.AlertNoTitle);
        
        const data = {
            title: title,
            playlist: App.Data.periodPlaylist,
            finalRanking: document.getElementById('config-final-ranking-chk').checked,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        window.db.ref(`saved_programs/${App.State.currentShowId}`).push(data).then(() => {
            App.Ui.showToast(APP_TEXT.Config.MsgSaved);
            App.Data.periodPlaylist = [];
            this.renderPreview();
        });
    },

    setupModal: function() {
        document.getElementById('config-open-load-modal-btn').onclick = () => {
            const sel = document.getElementById('config-prog-select');
            sel.innerHTML = '<option>Loading...</option>';
            document.getElementById('config-load-modal').classList.remove('hidden');
            window.db.ref(`saved_programs/${App.State.currentShowId}`).once('value', snap => {
                sel.innerHTML = '<option value="">-- Select --</option>';
                const data = snap.val();
                if(data) {
                    Object.values(data).forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = JSON.stringify(d);
                        opt.textContent = d.title;
                        sel.appendChild(opt);
                    });
                }
            });
        };
        document.getElementById('config-load-prog-exec-btn').onclick = () => {
            const val = document.getElementById('config-prog-select').value;
            if(!val) return;
            this.loadExternal(JSON.parse(val));
            document.getElementById('config-load-modal').classList.add('hidden');
        };
        document.getElementById('config-modal-close-btn').onclick = () => {
            document.getElementById('config-load-modal').classList.add('hidden');
        };
    },
    
    loadExternal: function(progData) {
        if(!confirm("Load this program?")) return;
        App.Data.periodPlaylist = JSON.parse(JSON.stringify(progData.playlist));
        App.Ui.showView(App.Ui.views.config);
        document.getElementById('config-program-title').value = progData.title;
        this.renderPreview();
        this.loadSetList();
    }
};

window.enterConfigMode = () => App.Config.init();
window.loadProgramToConfigOnDash = (d) => App.Config.loadExternal(d);
document.getElementById('config-save-program-btn')?.addEventListener('click', () => App.Config.saveProgram());
document.getElementById('config-go-studio-btn')?.addEventListener('click', () => { App.Config.saveProgram(); window.startRoom(); });
