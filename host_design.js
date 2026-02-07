/* =========================================================
 * host_design.js (v89: Mobile Center Scaling Fix)
 * =======================================================*/

App.Design = {
    currentTarget: null,
    activeQuickEdit: null, // Track which area is being edited ('q' or 'c')
    previewQIndex: 0, // Current question being previewed in the set

    defaults: {
        mainBgColor: "#0a0a0a",
        qTextColor: "#ffffff",
        qBgColor: "rgba(255, 255, 255, 0.05)",
        qBorderColor: "#00bfff",
        qFontSize: "48px",
        cTextColor: "#a0a0a0",
        cBgColor: "transparent",
        cBorderColor: "#333333",
        cFontSize: "32px",
        align: "center",
        layout: "standard"
    },

    init: function (targetKey = null, targetData = null) {
        App.Ui.showView(App.Ui.views.design);

        this.bindEvents();
        this.loadTargetList();

        if (targetKey && targetData) {
            this.currentTarget = { type: 'set', key: targetKey, data: targetData };
            this.previewQIndex = 0;
            const q = targetData.questions?.[0] || {};
            this.applyToUI(q.design || {}, q.layout || 'standard', q.align || 'center');
            App.Ui.showToast(`Auto-Loaded: ${targetData.title}`);
        } else {
            this.currentTarget = null;
            this.previewQIndex = 0;
            this.setDefaultUI();
        }

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

        const prevBtn = document.getElementById('design-pager-prev');
        const nextBtn = document.getElementById('design-pager-next');
        if (prevBtn) prevBtn.onclick = () => this.moveQ(-1);
        if (nextBtn) nextBtn.onclick = () => this.moveQ(1);

        document.getElementById('design-save-btn').onclick = () => this.save();

        const hideToggle = document.getElementById('design-pager-hide-toggle');
        if (hideToggle) {
            hideToggle.onclick = () => {
                const qs = this.getQuestionsFromTarget();
                if (!qs || qs.length === 0) return;
                const info = this.getStepInfo(this.previewQIndex, qs);
                if (info.type === 'title') {
                    qs[0].isTitleHidden = !qs[0].isTitleHidden;
                } else if (info.type === 'qnumber') {
                    qs[info.qIdx].isQNumHidden = !qs[info.qIdx].isQNumHidden;
                } else {
                    qs[info.qIdx].isHidden = !qs[info.qIdx].isHidden;
                }
                this.renderPreview();
            };
        }
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

    moveQ: function (delta) {
        const qs = this.getQuestionsFromTarget();
        if (!qs) return;
        const totalSteps = 1 + (qs.length * 2);
        const newIdx = this.previewQIndex + delta;
        this.jumpToStep(newIdx, totalSteps);
    },

    getStepInfo: function (idx, questions) {
        if (!questions || questions.length === 0) return { type: 'none' };
        if (idx === 0) return { type: 'title', qIdx: 0 };
        if (idx % 2 === 1) return { type: 'qnumber', qIdx: Math.floor((idx - 1) / 2) };
        return { type: 'question', qIdx: Math.floor((idx - 2) / 2) };
    },

    jumpToStep: function (idx, total) {
        if (idx >= 0 && idx < total) {
            const content = document.getElementById('design-monitor-preview-content');
            if (content) content.classList.add('animating');

            setTimeout(() => {
                this.previewQIndex = idx;
                this.renderPreview();
                if (content) content.classList.remove('animating');
            }, 100);
        }
    },

    getQuestionsFromTarget: function () {
        if (!this.currentTarget || !this.currentTarget.data) return null;
        if (this.currentTarget.type === 'set') return this.currentTarget.data.questions || [];
        if (this.currentTarget.type === 'prog') return this.currentTarget.data.playlist?.[0]?.questions || [];
        return null;
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
            let design = {}, layout = 'standard', align = 'center', prod = null;

            if (targetInfo.type === 'set' && data.questions && data.questions.length > 0) {
                const q = data.questions[0];
                design = q.design || {};
                layout = q.layout || 'standard';
                align = q.align || 'center';
                prod = q.prodDesign || null;
            } else if (targetInfo.type === 'prog' && data.playlist && data.playlist.length > 0) {
                const q = data.playlist[0].questions?.[0];
                if (q) {
                    design = q.design || {};
                    layout = q.layout || 'standard';
                    align = q.align || 'center';
                    prod = q.prodDesign || null;
                }
            }

            // Set first page as Title
            this.previewQIndex = 0;

            this.applyToUI(design, layout, align, prod);
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
                qFontSize: document.getElementById('design-q-size').value,
                cTextColor: document.getElementById('design-c-text').value,
                cBgColor: document.getElementById('design-c-bg').value,
                cBorderColor: document.getElementById('design-c-border').value,
                cFontSize: document.getElementById('design-c-size').value
            },
            layout: document.getElementById('creator-set-layout').value,
            align: document.getElementById('creator-set-align').value,
            prodDesign: this.collectProdSettings()
        };
    },

    collectProdSettings: function () {
        // Fallback IDs if they exist in the DOM (reusing production design IDs)
        const getVal = (id, def) => document.getElementById(id)?.value || def;
        return {
            titleBgColor: getVal('prod-title-bg-color', "#000000"),
            titleTextColor: getVal('prod-title-text-color', "#ffffff"),
            titleFont: getVal('prod-title-font', "sans-serif"),
            titleSize: getVal('prod-title-size', "80px"),
            titleAnimation: getVal('prod-title-animation', "fade"),
            titleText: getVal('design-title-text-value', ""),

            qNumberBgColor: getVal('prod-qnum-bg-color', "#000000"),
            qNumberTextColor: getVal('prod-qnum-text-color', "#ffffff"),
            qNumberFont: getVal('prod-qnum-font', "sans-serif"),
            qNumberSize: getVal('prod-qnum-size', "80px"),
            qNumberAnimation: getVal('prod-qnum-animation', "slide"),
            qNumberPosition: getVal('prod-qnum-position', "center"),
            qNumberText: getVal('design-qnum-text-value', "")
        };
    },

    applyProdToUI: function (p) {
        if (!p) return;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('prod-title-bg-color', p.titleBgColor);
        setVal('prod-title-text-color', p.titleTextColor);
        setVal('prod-title-font', p.titleFont);
        setVal('prod-title-size', p.titleSize);
        setVal('prod-title-animation', p.titleAnimation);
        setVal('design-title-text-value', p.titleText || "");

        setVal('prod-qnum-bg-color', p.qNumberBgColor);
        setVal('prod-qnum-text-color', p.qNumberTextColor);
        setVal('prod-qnum-font', p.qNumberFont);
        setVal('prod-qnum-size', p.qNumberSize);
        setVal('prod-qnum-animation', p.qNumberAnimation);
        setVal('prod-qnum-position', p.qNumberPosition);
        setVal('design-qnum-text-value', p.qNumberText || "");
    },

    applyToUI: function (design, layout, align, prod) {
        if (!design) design = this.defaults;
        if (prod) this.applyProdToUI(prod);

        const setVal = (id, val, defaultKey) => {
            const el = document.getElementById(id);
            if (el) el.value = val || this.defaults[defaultKey];
        };

        setVal('design-main-bg-color', design.mainBgColor, 'mainBgColor');
        setVal('design-q-text', design.qTextColor, 'qTextColor');
        setVal('design-q-bg', design.qBgColor, 'qBgColor');
        setVal('design-q-border', design.qBorderColor, 'qBorderColor');
        setVal('design-q-size', design.qFontSize, 'qFontSize');
        setVal('design-c-text', design.cTextColor, 'cTextColor');
        setVal('design-c-bg', design.cBgColor, 'cBgColor');
        setVal('design-c-border', design.cBorderColor, 'cBorderColor');
        setVal('design-c-size', design.cFontSize, 'cFontSize');

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
        const content = document.getElementById('design-monitor-preview-content');
        const frame = document.getElementById('preview-monitor-container');
        const playerFrame = document.getElementById('preview-player-container');
        const playerContent = document.getElementById('design-player-preview-content');

        if (!content || !frame || !playerFrame) return;

        // Scaling logic for both frames
        const scaleFrame = (targetFrame, targetContent, baseWidth) => {
            const fw = targetFrame.clientWidth;
            if (fw > 0) {
                const s = fw / baseWidth;
                targetContent.style.transform = `translate(-50%, -50%) scale(${s})`;
                targetContent.style.transformOrigin = "center center";
            }
        };
        scaleFrame(frame, content, 1280);
        scaleFrame(playerFrame, playerContent, 375); // Mock base width

        const s = this.collectSettings();
        const d = s.design;

        let qText = "これはプレビュー用の問題文です。\\n改行位置の確認用テキストです。";
        let choices = ["選択肢A", "選択肢B", "選択肢C", "選択肢D"];
        let qType = 'choice';

        if (this.currentTarget && this.currentTarget.data) {
            let qData = null;
            let questions = [];

            if (this.currentTarget.type === 'set') {
                questions = this.currentTarget.data.questions || [];
            } else if (this.currentTarget.type === 'prog') {
                questions = this.currentTarget.data.playlist?.[0]?.questions || [];
            }

            const totalSteps = 1 + (questions.length * 2);

            if (questions.length > 0) {
                if (this.previewQIndex >= totalSteps) this.previewQIndex = 0;
                const info = this.getStepInfo(this.previewQIndex, questions);
                const stepType = info.type;
                const qIdx = info.qIdx;
                qData = qIdx >= 0 ? questions[qIdx] : null;

                // Visibility status
                let isHidden = false;
                if (stepType === 'title') isHidden = !!questions[0].isTitleHidden;
                else if (stepType === 'qnumber') isHidden = !!questions[qIdx].isQNumHidden;
                else if (stepType === 'question') isHidden = !!questions[qIdx].isHidden;

                const hideBtn = document.getElementById('design-pager-hide-toggle');
                if (hideBtn) hideBtn.classList.toggle('is-hidden', isHidden);

                // Update Pager UI
                const pager = document.getElementById('design-pager-container');
                if (pager) pager.classList.toggle('hidden', questions.length === 0);

                const status = document.getElementById('design-pager-status');
                const prev = document.getElementById('design-pager-prev');
                const next = document.getElementById('design-pager-next');

                let statusText = "TITLE";
                if (stepType === 'qnumber') statusText = `第${qIdx + 1}問 (番号)`;
                if (stepType === 'question') statusText = `第${qIdx + 1}問 (内容)`;
                if (status) status.textContent = statusText;

                if (prev) prev.disabled = (this.previewQIndex === 0);
                if (next) next.disabled = (this.previewQIndex === totalSteps - 1);

                // Add "HIDDEN" overlay if active
                const addOverlay = (target) => {
                    const existing = target.querySelector('.preview-hidden-overlay');
                    if (isHidden) {
                        if (!existing) {
                            const ov = document.createElement('div');
                            ov.className = 'preview-hidden-overlay';
                            ov.innerHTML = '<div class="msg">非表示設定中</div>';
                            target.appendChild(ov);
                        }
                    } else if (existing) {
                        existing.remove();
                    }
                };

                // If it's Title or QNumber, use Production Design rendering
                if (stepType === 'title' || stepType === 'qnumber') {
                    this.renderProductionStep(stepType, qIdx, questions);
                    addOverlay(content);
                    return;
                }
                addOverlay(content);
            } else {
                const pager = document.getElementById('design-pager-container');
                if (pager) pager.classList.add('hidden');
            }
            if (qData) {
                qText = qData.q;
                if (qData.c) choices = qData.c;
                qType = qData.type;
            }

            // Status label for player mockup
            let statusLabel = "READY";
            if (this.previewQIndex > 0) {
                const qNum = Math.floor((this.previewQIndex + 1) / 2);
                statusLabel = `第${qNum}問`;
            } else {
                statusLabel = document.getElementById('design-title-text-value')?.value || this.currentTarget?.data?.title || 'Program Title';
            }

            this.statusLabelForPlayer = statusLabel; // Store for other calls
        }

        let bgStyle = `background-color: ${d.mainBgColor};`;
        if (d.bgImage) {
            bgStyle += `background-image: url('${d.bgImage}'); background-size: cover; background-position: center;`;
        } else {
            bgStyle += `background-image: radial-gradient(circle at center, #1a1a1a 0%, ${d.mainBgColor} 100%);`;
        }

        const fontSizeVal = (val, def) => {
            if (!val) return def;
            if (/^\d+$/.test(val.toString())) return val + 'px';
            return val;
        };

        const qStyle = `
            color:${d.qTextColor}; 
            background:${d.qBgColor}; 
            border:6px solid ${d.qBorderColor}; 
            text-align:${s.align}; 
            padding:30px; 
            border-radius:15px; 
            font-size:${fontSizeVal(d.qFontSize, '48px')}; 
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
            font-size:${fontSizeVal(d.cFontSize, '32px')};
            display:flex; 
            align-items:center;
            pointer-events: none; /* Let parent catch click */
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
                    <div class="preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" onclick="event.stopPropagation(); App.Design.openQuickEdit('q', event)" style="${qStyle} width:80%; height:50%; font-size:60px;">${qText}</div>
                    <div style="color:#aaa; margin-top:40px; font-size:30px;">[ ${qType === 'free_oral' ? '口頭回答' : '記述式'} ]</div>
                </div>
            `;
        } else {
            if (s.layout === 'split_list' || s.layout === 'split_grid') {
                layoutHtml = `
                    <div style="display:flex; height:100%; gap:40px; padding:40px; box-sizing:border-box;">
                        <div class="preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" onclick="event.stopPropagation(); App.Design.openQuickEdit('q', event)" style="flex:1; ${qStyle}; margin:0; writing-mode: vertical-rl; text-orientation: upright; justify-content:center;">${qText}</div>
                        <div class="preview-c-block ${this.activeQuickEdit === 'c' ? 'is-editing' : ''}" onclick="event.stopPropagation(); App.Design.openQuickEdit('c', event)" style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:20px;">
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
                        <div class="preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" onclick="event.stopPropagation(); App.Design.openQuickEdit('q', event)" style="${qStyle} min-height:200px;">${qText}</div>
                        <div class="preview-c-block ${this.activeQuickEdit === 'c' ? 'is-editing' : ''}" onclick="event.stopPropagation(); App.Design.openQuickEdit('c', event)" style="margin-top:20px; display:flex; flex-direction:column; gap:15px;">
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
            <div class="preview-bg-block ${this.activeQuickEdit === 'bg' ? 'is-editing' : ''}" 
                 onclick="App.Design.openQuickEdit('bg', event)"
                 style="width:100%; height:100%; ${bgStyle} font-family:sans-serif; overflow:hidden; cursor:pointer;">
                ${layoutHtml}
            </div>
        `;

        // Player Preview Rendering
        this.renderPlayerPreview(qText, choices, qType, d, this.statusLabelForPlayer);
    },

    renderPlayerPreview: function (qText, choices, qType, design, statusLabel = "") {
        const playerContent = document.getElementById('design-player-preview-content');
        if (!playerContent) return;

        let ansHtml = '';
        if (qType === 'choice' || qType === 'sort') {
            ansHtml = choices.map((c, i) => `
                <div class="p-ans-item" style="background:${design.cBorderColor}22; border:1px solid ${design.cBorderColor}66;">
                    <span style="color:${design.cBorderColor}; margin-right:10px; font-weight:900; font-family:monospace;">${String.fromCharCode(65 + i)}</span> ${c}
                </div>
            `).join('');
        } else if (qType === 'free_written' || qType === 'free_oral') {
            ansHtml = `<div style="text-align:center; color:#888; border:1px dashed #444; padding:20px; border-radius:10px;">自由回答入力エリア</div>`;
        }

        playerContent.innerHTML = `
            <div class="player-preview-mock" style="pointer-events:auto;">
                <div class="p-status-bar" style="border-color:${design.qBorderColor}44;">
                    ${statusLabel || 'READY'}
                </div>
                <div class="p-q-text preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" 
                     onclick="App.Design.openQuickEdit('q', event)"
                     style="background:${design.qBgColor}; border:1px solid ${design.qBorderColor}88; color:${design.qTextColor}; cursor:pointer;">
                    ${qText.replace(/\\n/g, '<br>')}
                </div>
                <div class="p-answers preview-c-block ${this.activeQuickEdit === 'c' ? 'is-editing' : ''}" 
                     onclick="App.Design.openQuickEdit('c', event)"
                     style="cursor:pointer; border-radius:10px;">
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
                q.prodDesign = s.prodDesign;
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
                        q.prodDesign = s.prodDesign;
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
        document.querySelectorAll('.preview-q-block, .preview-c-block, .preview-bg-block').forEach(el => el.classList.remove('is-editing'));

        let targetSelector = '.preview-q-block';
        if (type === 'c') targetSelector = '.preview-c-block';
        if (type === 'bg' || type === 'title' || type === 'qnumber') targetSelector = '.preview-bg-block';

        const target = document.querySelector(targetSelector);
        if (target) target.classList.add('is-editing');

        if (type === 'title' || type === 'qnumber') {
            const isTitle = (type === 'title');
            title.textContent = isTitle ? "タイトル画面設定" : "問題番号設定";
            const IDs = isTitle ?
                { bg: 'prod-title-bg-color', text: 'prod-title-text-color', size: 'prod-title-size' } :
                { bg: 'prod-qnum-bg-color', text: 'prod-qnum-text-color', size: 'prod-qnum-size' };

            body.innerHTML = `
                <div class="inspector-row">
                    <div class="inspector-icon-box" title="内容">✍️</div>
                    <div class="inspector-controls">
                        <input type="text" id="quick-content-override" class="inspector-input-mini" style="flex:1;" placeholder="${isTitle ? '表示タイトル...' : '例: 第1問'}" value="${document.getElementById(isTitle ? 'design-title-text-value' : 'design-qnum-text-value')?.value || ''}">
                    </div>
                </div>
                <div class="inspector-row">
                    <div class="inspector-icon-box" title="テキスト設定">T</div>
                    <div class="inspector-controls">
                        <div class="inspector-control-group">
                            <span class="inspector-label-mini">文字色</span>
                            <div class="color-swatch-wrapper">
                                <input type="color" id="quick-text-color" class="color-picker-hidden" value="${document.getElementById(IDs.text).value}">
                                <div class="color-swatch" id="swatch-text-color" style="background:${document.getElementById(IDs.text).value}"></div>
                            </div>
                        </div>
                        <div class="inspector-control-group">
                            <span class="inspector-label-mini">大きさ</span>
                            <input type="text" id="quick-font-size" class="inspector-input-mini" value="${document.getElementById(IDs.size).value}" style="width:60px;">
                        </div>
                    </div>
                </div>
                <div class="inspector-row">
                    <div class="inspector-icon-box" title="カラー設定">🎨</div>
                    <div class="inspector-controls">
                        <div class="inspector-control-group">
                            <span class="inspector-label-mini">背景色</span>
                            <div class="color-swatch-wrapper">
                                <input type="color" id="quick-bg-color" class="color-picker-hidden" value="${document.getElementById(IDs.bg).value}">
                                <div class="color-swatch" id="swatch-bg-color" style="background:${document.getElementById(IDs.bg).value}"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="inspector-row" style="height:auto; padding:10px 0;">
                    <button class="btn-dark btn-block btn-mini" onclick="document.getElementById('${isTitle ? 'modal-prod-title' : 'modal-prod-qnum'}').classList.remove('hidden'); document.getElementById('modal-design-quick').classList.add('hidden');">
                        ⚙️ 詳細設定を開く
                    </button>
                </div>
            `;
            const syncHelper = (id, targetId, swatchId) => {
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
            syncHelper('quick-text-color', IDs.text, 'swatch-text-color');
            syncHelper('quick-bg-color', IDs.bg, 'swatch-bg-color');

            const sizeInp = document.getElementById('quick-font-size');
            if (sizeInp) {
                sizeInp.oninput = () => {
                    document.getElementById(IDs.size).value = sizeInp.value;
                    this.renderPreview();
                };
            }

            const contentInp = document.getElementById('quick-content-override');
            if (contentInp) {
                contentInp.oninput = () => {
                    document.getElementById(isTitle ? 'design-title-text-value' : 'design-qnum-text-value').value = contentInp.value;
                    this.renderPreview();
                };
            }
            return;
        }

        if (type === 'bg') {
            title.textContent = "背景デザイン";
            body.innerHTML = `
                <div class="inspector-row">
                    <div class="inspector-icon-box" title="背景色">🎨</div>
                    <div class="inspector-controls">
                        <div class="inspector-control-group">
                            <span class="inspector-label-mini">背景色</span>
                            <div class="color-swatch-wrapper">
                                <input type="color" id="quick-bg-color" class="color-picker-hidden" value="${document.getElementById('design-main-bg-color').value}">
                                <div class="color-swatch" id="swatch-bg-color" style="background:${document.getElementById('design-main-bg-color').value}"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="inspector-row" style="height:auto; padding:10px 0;">
                    <button class="btn-dark btn-block btn-mini" onclick="document.getElementById('modal-design-bg').classList.remove('hidden'); document.getElementById('modal-design-quick').classList.add('hidden');">
                        🖼 背景画像の詳細設定を開く
                    </button>
                </div>
            `;

            const bgInp = document.getElementById('quick-bg-color');
            const bgSwatch = document.getElementById('swatch-bg-color');
            if (bgInp) {
                bgInp.oninput = (e) => {
                    const val = e.target.value;
                    bgSwatch.style.background = val;
                    document.getElementById('design-main-bg-color').value = val;
                    this.renderPreview();
                };
            }
            return;
        }

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
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">大きさ</span>
                        <input type="text" id="quick-font-size" class="inspector-input-mini" value="${document.getElementById(`design-${prefix}-size`).value}" style="width:60px;">
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

        const sizeInp = document.getElementById('quick-font-size');
        if (sizeInp) {
            sizeInp.oninput = () => {
                document.getElementById(`design-${prefix}-size`).value = sizeInp.value;
                this.renderPreview();
            };
        }

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
    },

    renderProductionStep: function (type, qIdx, questions) {
        const content = document.getElementById('design-monitor-preview-content');
        if (!content) return;

        const s = this.collectProdSettings();
        let html = '';
        const fontSize = (val) => {
            if (typeof val !== 'string') return val;
            return val.includes('vh') ? (parseFloat(val) * 7.2) + 'px' : val;
        };

        if (type === 'title') {
            const displayTitle = document.getElementById('design-title-text-value')?.value || this.currentTarget?.data?.title || 'Program Title';
            html = `
                <div class="preview-bg-block ${this.activeQuickEdit === 'title' ? 'is-editing' : ''}" 
                     onclick="App.Design.openQuickEdit('title', event)" 
                     style="width:100%; height:100%; background:${s.titleBgColor}; display:flex; align-items:center; justify-content:center; font-family:${s.titleFont}; cursor:pointer;">
                    <div style="color:${s.titleTextColor}; font-size:${fontSize(s.titleSize)}; font-weight:900; text-align:center; padding: 0 50px;">
                        ${displayTitle}
                    </div>
                </div>
            `;
        } else if (type === 'qnumber') {
            const displayQNum = document.getElementById('design-qnum-text-value')?.value || `第${qIdx + 1}問`;
            const pos = {
                'center': 'align-items:center; justify-content:center;',
                'top': 'align-items:flex-start; justify-content:center; padding-top:50px;',
                'bottom': 'align-items:flex-end; justify-content:center; padding-bottom:50px;'
            };
            html = `
                <div class="preview-bg-block ${this.activeQuickEdit === 'qnumber' ? 'is-editing' : ''}" 
                     onclick="App.Design.openQuickEdit('qnumber', event)" 
                     style="width:100%; height:100%; background:${s.qNumberBgColor}; display:flex; ${pos[s.qNumberPosition]} font-family:${s.qNumberFont}; cursor:pointer;">
                    <div style="color:${s.qNumberTextColor}; font-size:${fontSize(s.qNumberSize)}; font-weight:900;">
                        ${displayQNum}
                    </div>
                </div>
            `;
        }
        content.innerHTML = html;

        // Sync Player Preview
        let playerStatus = "READY";
        let playerQText = "まもなく開始されます...";
        if (type === 'title') {
            playerStatus = document.getElementById('design-title-text-value')?.value || this.currentTarget?.data?.title || 'Program Title';
            playerQText = "ENTRY OPEN";
        } else if (type === 'qnumber') {
            playerStatus = document.getElementById('design-qnum-text-value')?.value || `第${qIdx + 1}問`;
            playerQText = "READY?";
        }
        this.renderPlayerPreview(playerQText, [], "text", {}, playerStatus);
    }
};

window.enterDesignMode = () => App.Design.init();
window.applyDesignToUI = (d, l, a) => App.Design.applyToUI(d, l, a);
window.collectDesignSettings = () => App.Design.collectSettings();
window.resetGlobalSettings = () => App.Design.setDefaultUI();
window.loadDesignSettings = () => { };
