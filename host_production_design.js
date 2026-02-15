/* =========================================================
 * host_production_design.js (v2: Modal Setup Added)
 * =======================================================*/

App.ProductionDesign = {
    currentTarget: null,
    activeQuickEdit: null, // Track which area is being edited
    currentDevice: 'player',

    defaults: {
        // Program Title (プログラム名)
        programTitleBgColor: "#000000",
        programTitleTextColor: "#ffd700",
        programTitleFont: "sans-serif",
        programTitleSize: "120px",
        programTitleAnimation: "fade",

        // Set Title (セット名)
        setTitleBgColor: "#1a1a1a",
        setTitleTextColor: "#ffffff",
        setTitleFont: "sans-serif",
        setTitleSize: "60px",
        setTitleAnimation: "slide",

        // Rule Explanation (ルール説明)
        rulesBgColor: "#0a0a0a",
        rulesTextColor: "#ffffff",
        rulesFont: "sans-serif",
        rulesSize: "24px",
        rulesAnimation: "fade",

        // Question Number (問題番号)
        qNumberBgColor: "#000000",
        qNumberTextColor: "#ffffff",
        qNumberFont: "sans-serif",
        qNumberSize: "80px",
        qNumberAnimation: "slide",
        qNumberPosition: "center",

        // Time Up (タイムアップ)
        timeUpBgColor: "#ff0000",
        timeUpTextColor: "#ffffff",
        timeUpFont: "sans-serif",
        timeUpSize: "70px",
        timeUpAnimation: "pop",

        // All Answers (全員の解答)
        answersBgColor: "#0a0a0a",
        answersTextColor: "#ffffff",
        answersFont: "sans-serif",
        answersAnimation: "cascade",

        // Correct Answer (正解発表)
        correctBgColor: "#0a0a0a",
        correctTextColor: "#00ff00",
        correctFont: "sans-serif",
        correctSize: "50px",
        correctAnimation: "pop",

        // Ranking (順位発表)
        rankingBgColor: "#000000",
        rankingTextColor: "#ffffff",
        rankingAccentColor: "#ffd700",
        rankingFont: "sans-serif",
        rankingAnimation: "cascade",

        // Final Ranking (最終発表)
        finalBgColor: "#000000",
        finalTextColor: "#ffd700",
        finalAccentColor: "#ffffff",
        finalFont: "sans-serif",
        finalSize: "40px",
        finalAnimation: "cascade"
    },

    init: function () {
        App.Ui.showView(App.Ui.views.productionDesign);
        this.currentTarget = null;
        this.bindEvents();
        this.loadTargetList();
        this.setDefaultUI();
        this.renderPreview();
        window.addEventListener('resize', () => this.renderPreview());
    },

    bindEvents: function () {
        document.getElementById('prod-design-target-load-btn').onclick = () => this.loadTarget();
        document.getElementById('prod-design-save-btn').onclick = () => this.save();
        document.getElementById('prod-design-reset-btn').onclick = () => {
            if (confirm("初期値に戻しますか？")) {
                this.setDefaultUI();
                this.renderPreview();
            }
        };

        // Preview updates
        document.querySelectorAll('#production-design-view input, #production-design-view select').forEach(el => {
            if (el.type !== 'file' && el.id !== 'prod-design-target-select') {
                el.oninput = () => this.renderPreview();
                el.onchange = () => this.renderPreview();
            }
        });

        // Quick Modal Close Logic
        const quickModal = document.getElementById('modal-design-quick');
        if (quickModal) {
            quickModal.querySelectorAll('.modal-close-btn').forEach(btn => {
                const originalOnClick = btn.onclick;
                btn.onclick = (e) => {
                    if (originalOnClick) originalOnClick(e);
                    // Also close logic for Production
                    if (App.Ui.currentView === 'productionDesign') {
                        quickModal.classList.add('hidden');
                        document.querySelectorAll('.preview-row-block').forEach(el => el.classList.remove('is-editing'));
                        this.activeQuickEdit = null;
                    }
                };
            });
        }

        // Preview type segmented control
        document.querySelectorAll('.prod-preview-type-selector .segmented-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.prod-preview-type-selector .segmented-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderPreview();
            };
        });

        // Preview device segmented control
        document.querySelectorAll('.prod-preview-device-selector .segmented-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.prod-preview-device-selector .segmented-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentDevice = btn.dataset.device || 'monitor';
                this.renderPreview();
            };
        });

        // Setup modals
        this.setupModal('btn-open-prod-title', 'modal-prod-title');
        this.setupModal('btn-open-prod-qnum', 'modal-prod-qnum');
        this.setupModal('btn-open-prod-ranking', 'modal-prod-ranking');

        // Toolbar Collapse Toggle
        const toggleBtn = document.getElementById('btn-toggle-prod-design-toolbar');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                const view = document.getElementById('production-design-view');
                const isCollapsed = view.classList.contains('design-toolbar-collapsed');
                if (isCollapsed) {
                    view.classList.remove('design-toolbar-collapsed');
                    view.classList.add('design-toolbar-expanded');
                    toggleBtn.textContent = '▲ ロードメニューを閉じる';
                } else {
                    view.classList.add('design-toolbar-collapsed');
                    view.classList.remove('design-toolbar-expanded');
                    toggleBtn.textContent = '📂 ロード解除 / 切り替え';
                }
            };
        }
        // Initial state
        document.getElementById('production-design-view').classList.add('design-toolbar-collapsed');
    },

    setupModal: function (btnId, modalId) {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (!btn || !modal) return;
        btn.onclick = () => modal.classList.remove('hidden');
        modal.querySelectorAll('.modal-close-btn').forEach(b => b.onclick = () => modal.classList.add('hidden'));
        modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
    },

    loadTargetList: function () {
        const select = document.getElementById('prod-design-target-select');
        select.innerHTML = '<option>Loading...</option>';

        Promise.all([
            window.db.ref(`saved_sets/${App.State.currentShowId}`).once('value'),
            window.db.ref(`saved_programs/${App.State.currentShowId}`).once('value')
        ]).then(([setSnap, progSnap]) => {
            select.innerHTML = '<option value="">-- 編集対象を選択 --</option>';
            const sets = setSnap.val() || {};
            const progs = progSnap.val() || {};

            const optGroupSet = document.createElement('optgroup');
            optGroupSet.label = "Questions Sets";
            Object.keys(sets).forEach(k => {
                const opt = document.createElement('option');
                opt.value = JSON.stringify({ type: 'set', key: k });
                opt.textContent = sets[k].title;
                optGroupSet.appendChild(opt);
            });
            select.appendChild(optGroupSet);

            const optGroupProg = document.createElement('optgroup');
            optGroupProg.label = "Programs";
            Object.keys(progs).forEach(k => {
                const opt = document.createElement('option');
                opt.value = JSON.stringify({ type: 'prog', key: k });
                opt.textContent = progs[k].title;
                optGroupProg.appendChild(opt);
            });
            select.appendChild(optGroupProg);
        });
    },

    loadTarget: function () {
        const val = document.getElementById('prod-design-target-select').value;
        if (!val) return alert("対象を選択してください");

        const targetInfo = JSON.parse(val);
        const path = targetInfo.type === 'set'
            ? `saved_sets/${App.State.currentShowId}/${targetInfo.key}`
            : `saved_programs/${App.State.currentShowId}/${targetInfo.key}`;

        window.db.ref(path).once('value', snap => {
            const data = snap.val();
            if (!data) return alert("データが見つかりません");

            this.currentTarget = { ...targetInfo, data: data };

            let prodDesign = {};
            if (targetInfo.type === 'set' && data.questions && data.questions.length > 0) {
                prodDesign = data.questions[0].prodDesign || {};
            } else if (targetInfo.type === 'prog' && data.playlist && data.playlist.length > 0) {
                const q = data.playlist[0].questions?.[0];
                if (q) prodDesign = q.prodDesign || {};
            }

            this.applyToUI(prodDesign);
            App.Ui.showToast(`Loaded: ${data.title}`);
            this.renderPreview();
        });
    },

    collectSettings: function () {
        return {
            titleBgColor: document.getElementById('prod-title-bg-color').value,
            titleTextColor: document.getElementById('prod-title-text-color').value,
            titleFont: document.getElementById('prod-title-font').value,
            titleSize: document.getElementById('prod-title-size').value,
            titleAnimation: document.getElementById('prod-title-animation').value,

            qNumberBgColor: document.getElementById('prod-qnum-bg-color').value,
            qNumberTextColor: document.getElementById('prod-qnum-text-color').value,
            qNumberFont: document.getElementById('prod-qnum-font').value,
            qNumberSize: document.getElementById('prod-qnum-size').value,
            qNumberAnimation: document.getElementById('prod-qnum-animation').value,
            qNumberPosition: document.getElementById('prod-qnum-position').value,

            rankingBgColor: document.getElementById('prod-ranking-bg-color').value,
            rankingTextColor: document.getElementById('prod-ranking-text-color').value,
            rankingAccentColor: document.getElementById('prod-ranking-accent-color').value,
            rankingFont: document.getElementById('prod-ranking-font').value,
            rankingAnimation: document.getElementById('prod-ranking-animation').value
        };
    },

    applyToUI: function (prodDesign) {
        if (!prodDesign) prodDesign = this.defaults;

        const setVal = (id, val, defaultKey) => {
            const el = document.getElementById(id);
            if (el) el.value = val || this.defaults[defaultKey];
        };

        setVal('prod-title-bg-color', prodDesign.titleBgColor, 'titleBgColor');
        setVal('prod-title-text-color', prodDesign.titleTextColor, 'titleTextColor');
        setVal('prod-title-font', prodDesign.titleFont, 'titleFont');
        setVal('prod-title-size', prodDesign.titleSize, 'titleSize');
        setVal('prod-title-animation', prodDesign.titleAnimation, 'titleAnimation');

        setVal('prod-qnum-bg-color', prodDesign.qNumberBgColor, 'qNumberBgColor');
        setVal('prod-qnum-text-color', prodDesign.qNumberTextColor, 'qNumberTextColor');
        setVal('prod-qnum-font', prodDesign.qNumberFont, 'qNumberFont');
        setVal('prod-qnum-size', prodDesign.qNumberSize, 'qNumberSize');
        setVal('prod-qnum-animation', prodDesign.qNumberAnimation, 'qNumberAnimation');
        setVal('prod-qnum-position', prodDesign.qNumberPosition, 'qNumberPosition');

        setVal('prod-ranking-bg-color', prodDesign.rankingBgColor, 'rankingBgColor');
        setVal('prod-ranking-text-color', prodDesign.rankingTextColor, 'rankingTextColor');
        setVal('prod-ranking-accent-color', prodDesign.rankingAccentColor, 'rankingAccentColor');
        setVal('prod-ranking-font', prodDesign.rankingFont, 'rankingFont');
        setVal('prod-ranking-animation', prodDesign.rankingAnimation, 'rankingAnimation');
    },

    setDefaultUI: function () {
        this.applyToUI(this.defaults);
    },

    renderPreview: function () {
        const preview = document.getElementById('prod-design-preview-content');
        const playerContainer = document.getElementById('preview-player-container-prod');
        const monitorContainer = document.getElementById('preview-monitor-container-prod');
        if (!preview || !playerContainer || !monitorContainer) return;

        monitorContainer.classList.toggle('hidden', this.currentDevice !== 'monitor');
        playerContainer.classList.toggle('hidden', this.currentDevice !== 'player');

        if (this.currentDevice === 'monitor') {
            const frame = monitorContainer; // .design-preview-frame
            const frameWidth = frame.clientWidth;
            const scale = frameWidth / 1280;
            preview.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }

        const s = this.collectSettings();
        const activeBtn = document.querySelector('.prod-preview-type-selector .segmented-btn.active');
        const previewType = activeBtn ? activeBtn.dataset.type : 'title';

        let html = '';

        const fontSize = (val) => {
            if (typeof val !== 'string') return val;
            return val.includes('vh') ? (parseFloat(val) * 7.2) + 'px' : val;
        };

        if (previewType === 'title') {
            html = `
                <div class="preview-row-block ${this.activeQuickEdit === 'title' ? 'is-editing' : ''}" onclick="App.ProductionDesign.openQuickEdit('title', event)" style="width:100%; height:100%; background:${s.titleBgColor}; display:flex; align-items:center; justify-content:center; font-family:${s.titleFont}; cursor:pointer;">
                    <div style="color:${s.titleTextColor}; font-size:${fontSize(s.titleSize)}; font-weight:900; text-align:center; animation: ${s.titleAnimation}In 1s ease-out;">
                        クイズ番組タイトル
                    </div>
                </div>
            `;
        } else if (previewType === 'qnumber') {
            const positionStyles = {
                'center': 'align-items:center; justify-content:center;',
                'top': 'align-items:flex-start; justify-content:center; padding-top:50px;',
                'bottom': 'align-items:flex-end; justify-content:center; padding-bottom:50px;'
            };
            html = `
                <div class="preview-row-block ${this.activeQuickEdit === 'qnumber' ? 'is-editing' : ''}" onclick="App.ProductionDesign.openQuickEdit('qnumber', event)" style="width:100%; height:100%; background:${s.qNumberBgColor}; display:flex; ${positionStyles[s.qNumberPosition]} font-family:${s.qNumberFont}; cursor:pointer;">
                    <div style="color:${s.qNumberTextColor}; font-size:${fontSize(s.qNumberSize)}; font-weight:900; animation: ${s.qNumberAnimation}In 0.8s ease-out;">
                        第1問
                    </div>
                </div>
            `;
        } else if (previewType === 'ranking') {
            html = `
                <div class="preview-row-block ${this.activeQuickEdit === 'ranking' ? 'is-editing' : ''}" onclick="App.ProductionDesign.openQuickEdit('ranking', event)" style="width:100%; height:100%; background:${s.rankingBgColor}; padding:60px 100px; font-family:${s.rankingFont}; overflow:hidden; box-sizing:border-box; cursor:pointer;">
                    <div style="color:${s.rankingAccentColor}; font-size:40px; font-weight:900; text-align:center; margin-bottom:40px; letter-spacing:4px;">RANKING</div>
                    <div style="display:flex; flex-direction:column; gap:20px;">
                        ${[1, 2, 3].map(rank => `
                            <div style="background:rgba(255,255,255,0.05); padding:20px 30px; border-radius:15px; display:flex; align-items:center; animation: ${s.rankingAnimation}In ${rank * 0.2}s ease-out; border:1px solid rgba(255,255,255,0.1);">
                                <div style="color:${s.rankingAccentColor}; font-size:32px; font-weight:900; margin-right:30px; width:40px;">${rank}</div>
                                <div style="color:${s.rankingTextColor}; font-size:28px; flex:1; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">プレイヤー${rank}</div>
                                <div style="color:${s.rankingAccentColor}; font-size:28px; font-weight:900;">${100 - rank * 10} pt</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        preview.innerHTML = html;

        // Player Preview Update
        const playerMockBody = document.getElementById('prod-player-mock-body');
        if (playerMockBody) {
            if (previewType === 'title') playerMockBody.textContent = "番組開始をお待ちください";
            else if (previewType === 'qnumber') playerMockBody.textContent = "まもなく出題されます...";
            else if (previewType === 'ranking') playerMockBody.textContent = "ランキング集計中...";
        }
    },

    save: function () {
        if (!this.currentTarget) return alert("編集対象がロードされていません。");

        const s = this.collectSettings();
        const t = this.currentTarget;
        let promise;

        if (t.type === 'set') {
            const questions = t.data.questions.map(q => {
                q.prodDesign = s;
                return q;
            });
            promise = window.db.ref(`saved_sets/${App.State.currentShowId}/${t.key}/questions`).set(questions);
        } else {
            const playlist = t.data.playlist.map(period => {
                if (period.questions) {
                    period.questions = period.questions.map(q => {
                        q.prodDesign = s;
                        return q;
                    });
                }
                return period;
            });
            promise = window.db.ref(`saved_programs/${App.State.currentShowId}/${t.key}/playlist`).set(playlist);
        }

        promise.then(() => {
            App.Ui.showToast("演出デザインを保存しました！");
        });
    },

    openQuickEdit: function (type, event) {
        this.activeQuickEdit = type;
        const modal = document.getElementById('modal-design-quick');
        const content = modal.querySelector('.quick-inspector-content');
        const body = document.getElementById('quick-modal-body');
        const title = document.getElementById('quick-modal-title');
        if (!modal || !body || !content) return;

        // Positioning logic (Right side)
        if (event && window.innerWidth > 768) {
            const x = event.clientX;
            const y = event.clientY;
            const panelWidth = 280;
            const panelHeight = 180;
            const offset = 20;
            let left = x + offset;
            let top = y - (panelHeight / 2);
            if (left + panelWidth > window.innerWidth - 10) left = x - panelWidth - offset;
            if (top < 10) top = 10;
            if (top + panelHeight > window.innerHeight) top = window.innerHeight - panelHeight - 10;
            content.style.position = 'absolute';
            content.style.left = left + 'px';
            content.style.top = top + 'px';
            content.style.transform = 'none';
        } else {
            content.style.position = '';
            content.style.left = '';
            content.style.top = '';
            content.style.transform = '';
        }

        // Reset highlight
        document.querySelectorAll('.preview-row-block').forEach(el => el.classList.remove('is-editing'));
        if (event && event.currentTarget) event.currentTarget.classList.add('is-editing');

        title.textContent = (type === 'title') ? "タイトル画面" : (type === 'qnumber' ? "問題番号表示" : "ランキング表示");

        // Map UI IDs
        const map = {
            'title': { text: 'prod-title-text-color', bg: 'prod-title-bg-color', size: 'prod-title-size' },
            'qnumber': { text: 'prod-qnum-text-color', bg: 'prod-qnum-bg-color', size: 'prod-qnum-size' },
            'ranking': { text: 'prod-ranking-text-color', bg: 'prod-ranking-bg-color', accent: 'prod-ranking-accent-color' }
        };
        const IDs = map[type];

        let itemsHtml = `
            <div class="inspector-row">
                <div class="inspector-icon-box" title="カラー設定">🎨</div>
                <div class="inspector-controls">
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">文字</span>
                        <div class="color-swatch-wrapper">
                            <input type="color" id="quick-text-color" class="color-picker-hidden" value="${document.getElementById(IDs.text).value}">
                            <div class="color-swatch" id="swatch-text-color" style="background:${document.getElementById(IDs.text).value}"></div>
                        </div>
                    </div>
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">背景</span>
                        <div class="color-swatch-wrapper">
                            <input type="color" id="quick-bg-color" class="color-picker-hidden" value="${document.getElementById(IDs.bg).value}">
                            <div class="color-swatch" id="swatch-bg-color" style="background:${document.getElementById(IDs.bg).value}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (IDs.size) {
            itemsHtml += `
            <div class="inspector-row">
                <div class="inspector-icon-box" title="フォントサイズ">T</div>
                <div class="inspector-controls">
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">大きさ</span>
                        <div class="stepper-input">
                            <button class="stepper-btn" id="stepper-down">▼</button>
                            <input type="text" id="quick-font-size" class="inspector-input-mini" value="${document.getElementById(IDs.size).value}">
                            <button class="stepper-btn" id="stepper-up">▲</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        if (type === 'ranking') {
            itemsHtml += `
            <div class="inspector-row">
                <div class="inspector-icon-box" title="アクセント設定">✨</div>
                <div class="inspector-controls">
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">アクセント</span>
                        <div class="color-swatch-wrapper">
                            <input type="color" id="quick-accent-color" class="color-picker-hidden" value="${document.getElementById(IDs.accent).value}">
                            <div class="color-swatch" id="swatch-accent-color" style="background:${document.getElementById(IDs.accent).value}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }

        body.innerHTML = itemsHtml;

        // Add "Detail" button to link back to the full modals
        const detailBtn = document.createElement('button');
        detailBtn.className = 'btn-block btn-dark mt-10';
        detailBtn.style.fontSize = '0.75em';
        detailBtn.textContent = '⚙️ フォント・演出の詳細設定';
        detailBtn.onclick = () => {
            modal.classList.add('hidden');
            const modalMap = { 'title': 'modal-prod-title', 'qnumber': 'modal-prod-qnum', 'ranking': 'modal-prod-ranking' };
            const targetModal = document.getElementById(modalMap[type]);
            if (targetModal) targetModal.classList.remove('hidden');
        };
        body.appendChild(detailBtn);

        modal.classList.remove('hidden');

        const sync = (id, targetId, swatchId) => {
            const el = document.getElementById(id);
            const targetEl = document.getElementById(targetId);
            const swatch = document.getElementById(swatchId);
            if (el && targetEl) {
                el.oninput = () => {
                    targetEl.value = el.value;
                    if (swatch) swatch.style.background = el.value;
                    this.renderPreview();
                };
            }
        };

        const bindStepper = (inpId, targetId) => {
            const inp = document.getElementById(inpId);
            const target = document.getElementById(targetId);
            const up = document.getElementById('stepper-up');
            const down = document.getElementById('stepper-down');
            if (!inp || !target) return;
            const update = (val) => { inp.value = val; target.value = val; this.renderPreview(); };
            inp.oninput = () => update(inp.value);
            if (up) up.onclick = () => {
                let v = parseInt(inp.value) || 0;
                let unit = inp.value.replace(/[0-9]/g, '') || 'px';
                update((v + 2) + unit);
            };
            if (down) down.onclick = () => {
                let v = parseInt(inp.value) || 0;
                let unit = inp.value.replace(/[0-9]/g, '') || 'px';
                update(Math.max(0, v - 2) + unit);
            };
        };

        sync('quick-text-color', IDs.text, 'swatch-text-color');
        sync('quick-bg-color', IDs.bg, 'swatch-bg-color');
        if (type === 'ranking') sync('quick-accent-color', IDs.accent, 'swatch-accent-color');
        if (IDs.size) bindStepper('quick-font-size', IDs.size);
    }
};

window.enterProductionDesignMode = () => App.ProductionDesign.init();
