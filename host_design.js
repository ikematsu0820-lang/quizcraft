/* =========================================================
 * host_design.js (v89: Mobile Center Scaling Fix)
 * =======================================================*/

App.Design = {
    currentTarget: null,
    activeQuickEdit: null, // Track which area is being edited ('q' or 'c')

    defaults: {
        mainBgColor: "#0a0a0a",
        qTextColor: "#ffffff",
        qBgColor: "rgba(255, 255, 255, 0.05)",
        qBorderColor: "#00bfff",
        cTextColor: "#a0a0a0",
        cBgColor: "transparent",
        cBorderColor: "#333333",
        align: "center",
        layout: "standard"
    },

    init: function () {
        App.Ui.showView(App.Ui.views.design);
        this.currentTarget = null;
        this.bindEvents();
        this.loadTargetList();
        this.setDefaultUI();

        // 初回描画（スマホ対策で少し遅らせて再実行）
        this.renderPreview();
        setTimeout(() => this.renderPreview(), 100);
        window.addEventListener('resize', () => this.renderPreview());
    },

    bindEvents: function () {
        document.getElementById('design-target-load-btn').onclick = () => this.loadTarget();

        document.querySelectorAll('#design-view input, #design-view select').forEach(el => {
            if (el.type !== 'file' && el.id !== 'design-target-select') {
                el.oninput = () => this.renderPreview();
                el.onchange = () => this.renderPreview();
            }
        });

        // 背景画像設定
        const imgBtn = document.getElementById('design-bg-image-btn');
        const imgInput = document.getElementById('design-bg-image-file');
        const clearBtn = document.getElementById('design-bg-clear-btn');

        if (imgBtn && imgInput) {
            imgBtn.onclick = () => imgInput.click();
            imgInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('design-bg-image-data').value = event.target.result;
                    document.getElementById('design-bg-image-status').textContent = "画像あり";
                    document.getElementById('design-bg-image-status').style.color = "#00ff00";
                    this.renderPreview();
                };
                reader.readAsDataURL(file);
            };
        }
        if (clearBtn) {
            clearBtn.onclick = () => {
                document.getElementById('design-bg-image-data').value = "";
                document.getElementById('design-bg-image-status').textContent = "未選択";
                document.getElementById('design-bg-image-status').style.color = "#aaa";
                imgInput.value = "";
                this.renderPreview();
            };
        }

        this.setupModal('btn-open-layout', 'modal-design-layout');
        this.setupModal('btn-open-text', 'modal-design-text');
        this.setupModal('btn-open-object', 'modal-design-object');
        this.setupModal('btn-open-bg', 'modal-design-bg');

        document.querySelectorAll('.btn-align').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.btn-align').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('creator-set-align').value = btn.dataset.align;
                this.renderPreview();
            };
        });

        document.getElementById('design-save-btn').onclick = () => this.save();
        document.getElementById('design-reset-btn').onclick = () => {
            if (confirm("初期値に戻しますか？")) {
                this.setDefaultUI();
                this.renderPreview();
            }
        };

        // Preview Toggles (Segmented Control)
        document.querySelectorAll('.segmented-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.segmented-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.type;
                document.getElementById('preview-monitor-container').classList.toggle('hidden', type !== 'monitor');
                document.getElementById('preview-player-container').classList.toggle('hidden', type !== 'player');
            };
        });

        // Toolbar Collapse Toggle
        const toggleBtn = document.getElementById('btn-toggle-design-toolbar');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                const view = document.getElementById('design-view');
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
        document.getElementById('design-view').classList.add('design-toolbar-collapsed');

        // Quick Modal Close Logic Extension
        const quickModal = document.getElementById('modal-design-quick');
        if (quickModal) {
            quickModal.querySelectorAll('.modal-close-btn').forEach(btn => {
                btn.onclick = () => {
                    quickModal.classList.add('hidden');
                    document.querySelectorAll('.preview-q-block, .preview-c-block').forEach(el => el.classList.remove('is-editing'));
                    this.activeQuickEdit = null;
                };
            });
        }
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
        const select = document.getElementById('design-target-select');
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
        const val = document.getElementById('design-target-select').value;
        if (!val) return alert("対象を選択してください");

        const targetInfo = JSON.parse(val);
        const path = targetInfo.type === 'set'
            ? `saved_sets/${App.State.currentShowId}/${targetInfo.key}`
            : `saved_programs/${App.State.currentShowId}/${targetInfo.key}`;

        window.db.ref(path).once('value', snap => {
            const data = snap.val();
            if (!data) return alert("データが見つかりません");

            this.currentTarget = { ...targetInfo, data: data };

            let design = {};
            let layout = 'standard';
            let align = 'center';

            if (targetInfo.type === 'set' && data.questions && data.questions.length > 0) {
                const q = data.questions[0];
                design = q.design || {};
                layout = q.layout || 'standard';
                align = q.align || 'center';
            } else if (targetInfo.type === 'prog' && data.playlist && data.playlist.length > 0) {
                const q = data.playlist[0].questions?.[0];
                if (q) {
                    design = q.design || {};
                    layout = q.layout || 'standard';
                    align = q.align || 'center';
                }
            }

            this.applyToUI(design, layout, align);
            App.Ui.showToast(`Loaded: ${data.title}`);
            this.renderPreview();
        });
    },

    collectSettings: function () {
        return {
            design: {
                mainBgColor: document.getElementById('design-main-bg-color').value,
                bgImage: document.getElementById('design-bg-image-data').value,
                qTextColor: document.getElementById('design-q-text').value,
                qBgColor: document.getElementById('design-q-bg').value,
                qBorderColor: document.getElementById('design-q-border').value,
                cTextColor: document.getElementById('design-c-text').value,
                cBgColor: document.getElementById('design-c-bg').value,
                cBorderColor: document.getElementById('design-c-border').value
            },
            layout: document.getElementById('creator-set-layout').value,
            align: document.getElementById('creator-set-align').value
        };
    },

    applyToUI: function (design, layout, align) {
        if (!design) design = this.defaults;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || this.defaults[id.replace('design-', '').replace('main-bg-color', 'mainBgColor').replace('q-text', 'qTextColor').replace('q-bg', 'qBgColor').replace('q-border', 'qBorderColor').replace('c-text', 'cTextColor').replace('c-bg', 'cBgColor').replace('c-border', 'cBorderColor')];
        };

        setVal('design-main-bg-color', design.mainBgColor);
        setVal('design-q-text', design.qTextColor);
        setVal('design-q-bg', design.qBgColor);
        setVal('design-q-border', design.qBorderColor);
        setVal('design-c-text', design.cTextColor);
        setVal('design-c-bg', design.cBgColor);
        setVal('design-c-border', design.cBorderColor);

        document.getElementById('design-bg-image-data').value = design.bgImage || "";
        const status = document.getElementById('design-bg-image-status');
        if (status) {
            status.textContent = design.bgImage ? "画像あり" : "未選択";
            status.style.color = design.bgImage ? "#00ff00" : "#aaa";
        }

        if (layout) document.getElementById('creator-set-layout').value = layout;
        if (align) {
            document.getElementById('creator-set-align').value = align;
            document.querySelectorAll('.btn-align').forEach(b => {
                b.classList.toggle('active', b.dataset.align === align);
            });
        }
    },

    setDefaultUI: function () {
        this.applyToUI(this.defaults, 'standard', 'center');
    },

    renderPreview: function () {
        const frame = document.querySelector('.design-preview-frame');
        const content = document.getElementById('design-monitor-preview-content');
        if (!frame || !content) return;

        // ★修正: 中央基準でスケーリング
        const frameWidth = frame.clientWidth;
        const scale = frameWidth / 1280;

        content.style.transform = `translate(-50%, -50%) scale(${scale})`;
        content.style.transformOrigin = "center center";

        const s = this.collectSettings();
        const d = s.design;

        let qText = "これはプレビュー用の問題文です。\\n改行位置の確認用テキストです。";
        let choices = ["選択肢A", "選択肢B", "選択肢C", "選択肢D"];
        let qType = 'choice';

        if (this.currentTarget && this.currentTarget.data) {
            let qData = null;
            if (this.currentTarget.type === 'set' && this.currentTarget.data.questions?.length > 0) {
                qData = this.currentTarget.data.questions[0];
            } else if (this.currentTarget.type === 'prog' && this.currentTarget.data.playlist?.[0]?.questions?.length > 0) {
                qData = this.currentTarget.data.playlist[0].questions[0];
            }
            if (qData) {
                qText = qData.q;
                if (qData.c) choices = qData.c;
                qType = qData.type;
            }
        } else if (App.Data.createdQuestions && App.Data.createdQuestions.length > 0) {
            const editingIndex = App.Creator.editingIndex;
            const qData = (editingIndex !== null) ? App.Data.createdQuestions[editingIndex] : App.Data.createdQuestions[0];
            if (qData) {
                qText = qData.q;
                if (qData.c) choices = qData.c;
                qType = qData.type;
            }
        }

        let bgStyle = `background-color: ${d.mainBgColor};`;
        if (d.bgImage) {
            bgStyle += `background-image: url('${d.bgImage}'); background-size: cover; background-position: center;`;
        } else {
            bgStyle += `background-image: radial-gradient(circle at center, #1a1a1a 0%, ${d.mainBgColor} 100%);`;
        }

        const qStyle = `
            color:${d.qTextColor}; 
            background:${d.qBgColor}; 
            border:6px solid ${d.qBorderColor}; 
            text-align:${s.align}; 
            padding:30px; 
            border-radius:15px; 
            font-size:48px; 
            font-weight:bold; 
            line-height:1.4;
            margin-bottom:20px; 
            display:flex; 
            align-items:center; 
            justify-content:${s.align === 'center' ? 'center' : (s.align === 'right' ? 'flex-end' : 'flex-start')}; 
            box-shadow:0 0 30px ${d.qBorderColor}40;
        `;

        const cStyle = `
            color:${d.cTextColor}; 
            background:${d.cBgColor}; 
            border-bottom:3px solid ${d.cBorderColor}; 
            padding:15px 20px; 
            font-size:32px;
            display:flex; 
            align-items:center;
        `;

        const labelStyle = `
            color:${d.cBorderColor}; 
            font-weight:900; 
            font-size:36px;
            margin-right:20px; 
            font-family: monospace;
        `;

        let layoutHtml = '';

        if (qType === 'free_written' || qType === 'free_oral') {
            layoutHtml = `
                <div style="padding:60px; box-sizing:border-box; display:flex; flex-direction:column; height:100%; justify-content:center; align-items:center;">
                    <div class="preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" onclick="App.Design.openQuickEdit('q', event)" style="${qStyle} width:80%; height:50%; font-size:60px;">${qText}</div>
                    <div style="color:#aaa; margin-top:40px; font-size:30px;">[ ${qType === 'free_oral' ? '口頭回答' : '記述式'} ]</div>
                </div>
            `;
        } else {
            if (s.layout === 'split_list' || s.layout === 'split_grid') {
                layoutHtml = `
                    <div style="display:flex; height:100%; gap:40px; padding:40px; box-sizing:border-box;">
                        <div class="preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" onclick="App.Design.openQuickEdit('q', event)" style="flex:1; ${qStyle}; margin:0; writing-mode: vertical-rl; text-orientation: upright; justify-content:center;">${qText}</div>
                        <div class="preview-c-block ${this.activeQuickEdit === 'c' ? 'is-editing' : ''}" onclick="App.Design.openQuickEdit('c', event)" style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:20px;">
                            ${choices.map((c, i) => `
                                <div style="${cStyle}">
                                    <span style="${labelStyle}">${String.fromCharCode(65 + i)}</span> ${c}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                layoutHtml = `
                    <div style="padding:50px; box-sizing:border-box; display:flex; flex-direction:column; height:100%; justify-content:center;">
                        <div class="preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" onclick="App.Design.openQuickEdit('q', event)" style="${qStyle} min-height:200px;">${qText}</div>
                        <div class="preview-c-block ${this.activeQuickEdit === 'c' ? 'is-editing' : ''}" onclick="App.Design.openQuickEdit('c', event)" style="margin-top:20px; display:flex; flex-direction:column; gap:15px;">
                             ${choices.map((c, i) => `
                                <div style="${cStyle}">
                                    <span style="${labelStyle}">${String.fromCharCode(65 + i)}</span> ${c}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        content.innerHTML = `
            <div style="width:100%; height:100%; ${bgStyle} font-family:sans-serif; overflow:hidden;">
                ${layoutHtml}
            </div>
        `;

        // Player Preview Rendering
        this.renderPlayerPreview(qText, choices, qType, d);
    },

    renderPlayerPreview: function (qText, choices, qType, design) {
        const playerContent = document.getElementById('design-player-preview-content');
        if (!playerContent) return;

        let ansHtml = '';
        if (qType === 'choice' || qType === 'sort') {
            ansHtml = choices.map((c, i) => `
                <div class="p-ans-item" style="background:${design.cBorderColor}22; border:1px solid ${design.cBorderColor}66;">
                    <span style="color:${design.cBorderColor}; margin-right:10px; font-weight:bold;">${i + 1}</span> ${c}
                </div>
            `).join('');
        } else if (qType === 'free_written' || qType === 'free_oral') {
            ansHtml = `<div style="text-align:center; color:#888; border:1px dashed #444; padding:20px; border-radius:10px;">自由回答入力エリア</div>`;
        }

        playerContent.innerHTML = `
            <div class="player-preview-mock">
                <div class="p-status-bar" style="border-color:${design.qBorderColor}44;"></div>
                <div class="p-q-text" style="background:${design.qBgColor}; border:1px solid ${design.qBorderColor}88; color:${design.qTextColor};">
                    ${qText.replace(/\\n/g, '<br>')}
                </div>
                <div class="p-answers">
                    ${ansHtml}
                </div>
            </div>
        `;
    },

    save: function () {
        if (!this.currentTarget) return alert("編集対象がロードされていません。");

        const s = this.collectSettings();
        const t = this.currentTarget;
        let promise;

        if (t.type === 'set') {
            const questions = t.data.questions.map(q => {
                q.design = s.design;
                q.layout = s.layout;
                q.align = s.align;
                return q;
            });
            promise = window.db.ref(`saved_sets/${App.State.currentShowId}/${t.key}/questions`).set(questions);
        } else {
            const playlist = t.data.playlist.map(period => {
                if (period.questions) {
                    period.questions = period.questions.map(q => {
                        q.design = s.design;
                        q.layout = s.layout;
                        q.align = s.align;
                        return q;
                    });
                }
                return period;
            });
            promise = window.db.ref(`saved_programs/${App.State.currentShowId}/${t.key}/playlist`).set(playlist);
        }

        const btn = document.getElementById('design-save-btn');
        promise.then(() => {
            App.Ui.showToast("デザインを保存しました！");
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = "✅ 保存完了";
                btn.style.background = "#00ff88";
                btn.style.color = "#000";
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = "";
                    btn.style.color = "";
                }, 2000);
            }
        });
    },

    openQuickEdit: function (type, event) {
        this.activeQuickEdit = type;
        const modal = document.getElementById('modal-design-quick');
        const content = modal.querySelector('.quick-inspector-content');
        const body = document.getElementById('quick-modal-body');
        const title = document.getElementById('quick-modal-title');
        if (!modal || !body || !content) return;

        // Positioning logic
        if (event && window.innerWidth > 768) {
            const x = event.clientX;
            const y = event.clientY;
            const panelWidth = 280; // Compact
            const panelHeight = 220; // Slimmer
            const offset = 20;

            let left = x + offset;
            let top = y - (panelHeight / 2);

            // Bounds check (Flip to left if no space on right)
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
        document.querySelectorAll('.preview-q-block, .preview-c-block').forEach(el => el.classList.remove('is-editing'));
        const target = (type === 'q') ? document.querySelector('.preview-q-block') : document.querySelector('.preview-c-block');
        if (target) target.classList.add('is-editing');

        title.textContent = (type === 'q') ? "問題エリア" : "選択肢エリア";

        const prefix = (type === 'q') ? 'q' : 'c';

        body.innerHTML = `
            <div class="inspector-row">
                <div class="inspector-icon-box" title="テキスト設定">T</div>
                <div class="inspector-controls">
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">文字</span>
                        <div class="color-swatch-wrapper">
                            <input type="color" id="quick-text-color" class="color-picker-hidden" value="${document.getElementById(`design-${prefix}-text`).value}">
                            <div class="color-swatch" id="swatch-text-color" style="background:${document.getElementById(`design-${prefix}-text`).value}"></div>
                        </div>
                    </div>
                    ${type === 'q' ? `
                    <div class="align-btn-group-toolbar">
                        <button type="button" class="btn-align-q ${document.getElementById('creator-set-align').value === 'left' ? 'active' : ''}" data-align="left">左</button>
                        <button type="button" class="btn-align-q ${document.getElementById('creator-set-align').value === 'center' ? 'active' : ''}" data-align="center">中</button>
                        <button type="button" class="btn-align-q ${document.getElementById('creator-set-align').value === 'right' ? 'active' : ''}" data-align="right">右</button>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="inspector-row">
                <div class="inspector-icon-box" title="ボックス設定">□</div>
                <div class="inspector-controls">
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">枠線</span>
                        <div class="color-swatch-wrapper">
                            <input type="color" id="quick-border-color" class="color-picker-hidden" value="${document.getElementById(`design-${prefix}-border`).value}">
                            <div class="color-swatch" id="swatch-border-color" style="background:${document.getElementById(`design-${prefix}-border`).value}"></div>
                        </div>
                    </div>
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">背景</span>
                        <div class="color-swatch-wrapper">
                            <input type="color" id="quick-bg-color" class="color-picker-hidden" value="${document.getElementById(`design-${prefix}-bg`).value}">
                            <div class="color-swatch" id="swatch-bg-color" style="background:${document.getElementById(`design-${prefix}-bg`).value}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');

        // Bind events
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

        sync('quick-text-color', `design-${prefix}-text`, 'swatch-text-color');
        sync('quick-border-color', `design-${prefix}-border`, 'swatch-border-color');
        sync('quick-bg-color', `design-${prefix}-bg`, 'swatch-bg-color');

        body.querySelectorAll('.btn-align-q').forEach(btn => {
            btn.onclick = () => {
                body.querySelectorAll('.btn-align-q').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const realAlign = document.getElementById('creator-set-align');
                if (realAlign) {
                    realAlign.value = btn.dataset.align;
                    document.querySelectorAll('.btn-align').forEach(b => {
                        b.classList.toggle('active', b.dataset.align === btn.dataset.align);
                    });
                    this.renderPreview();
                }
            };
        });
    }
};

window.enterDesignMode = () => App.Design.init();
window.applyDesignToUI = (d, l, a) => App.Design.applyToUI(d, l, a);
window.collectDesignSettings = () => App.Design.collectSettings();
window.resetGlobalSettings = () => App.Design.setDefaultUI();
window.loadDesignSettings = () => { };
