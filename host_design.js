/* =========================================================
 * host_design.js (v89: Mobile Center Scaling Fix)
 * =======================================================*/

App.Design = {
    currentTarget: null,
    activeQuickEdit: null, // Track which area is being edited ('q' or 'c')
    previewQIndex: 0, // Current question being previewed in the set
    _eventsBound: false,
    _resizeHandler: null,

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

        // Reset state
        this.currentTarget = null;
        this.previewQIndex = 0;
        this.setDefaultUI();

        // Reset dropdown to placeholder before loading
        const sel = document.getElementById('design-target-select');
        if (sel) sel.value = '';

        this.bindEvents();
        this.loadTargetList();

        if (targetKey && targetData) {
            this.currentTarget = { type: 'set', key: targetKey, data: targetData };
            this.previewQIndex = 0;
            const q = targetData.questions?.[0] || {};
            this.applyToUI(q.design || {}, q.layout || 'standard', q.align || 'center');
            App.Ui.showToast(`Auto-Loaded: ${targetData.title}`);
        }

        // resize リスナーの重複登録を防ぐ
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        this._resizeHandler = () => this.renderPreview();
        window.addEventListener('resize', this._resizeHandler);

        // 初回描画（スマホ対策で少し遅らせて再実行）
        this.renderPreview();
        setTimeout(() => this.renderPreview(), 100);
    },

    bindEvents: function () {
        if (this._eventsBound) return;
        this._eventsBound = true;

        document.getElementById('design-target-load-btn').onclick = () => this.loadTarget();

        // Auto-refresh list on dropdown click (since refresh btn is hidden)
        const targetSelect = document.getElementById('design-target-select');
        if (targetSelect) {
            targetSelect.addEventListener('focus', () => {
                // Only reload if empty or just has placeholder
                if (targetSelect.options.length <= 1) {
                    this.loadTargetList();
                }
            });
            // Auto-load on change
            targetSelect.addEventListener('change', () => {
                if (targetSelect.value) {
                    this.loadTarget();
                }
            });
        }

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
        this.setupModal('btn-open-grid-config', 'modal-design-grid');
        this.setupModal('btn-open-text', 'modal-design-text');
        this.setupModal('btn-open-object', 'modal-design-object');
        this.setupModal('btn-open-bg', 'modal-design-bg');

        // Grid Config Apply
        document.getElementById('btn-apply-grid-config').onclick = () => {
            const rows = parseInt(document.getElementById('design-grid-rows').value) || 1;
            const cols = parseInt(document.getElementById('design-grid-cols').value) || 1;

            // Validation
            const questions = this.getQuestionsFromTarget();
            if (questions && this.previewQIndex > 0) {
                const info = this.getStepInfo(this.previewQIndex, questions);
                if (info.type === 'question' && info.qIdx >= 0) {
                    const q = questions[info.qIdx];
                    const choices = q.c || [];
                    if (rows * cols < choices.length) {
                        alert(`マス目が足りません。\n選択肢: ${choices.length}個 / マス目: ${rows * cols}個`);
                        return;
                    }
                }
            }

            document.getElementById('modal-design-grid').classList.add('hidden');
            this.renderPreview();
        };

        const layoutInline = document.getElementById('creator-set-layout-inline');
        if (layoutInline) {
            layoutInline.onchange = () => {
                const val = layoutInline.value;
                const main = document.getElementById('creator-set-layout');
                if (main) main.value = val;
                this.renderPreview();
            };
        }

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
                // title: only first question (shown once per set)
                // qnumber / result: apply globally to ALL questions (set-level setting)
                if (info.type === 'title') {
                    qs[0].isTitleHidden = !qs[0].isTitleHidden;
                } else if (info.type === 'qnumber') {
                    const newVal = !qs[info.qIdx].isQNumHidden;
                    qs.forEach(q => { q.isQNumHidden = newVal; });
                } else if (info.type === 'question') {
                    const newVal = !qs[info.qIdx].isHidden;
                    qs.forEach(q => { q.isHidden = newVal; });
                } else if (info.type === 'answer') {
                    const newVal = !qs[info.qIdx].isAnsHidden;
                    qs.forEach(q => { q.isAnsHidden = newVal; });
                } else if (info.type === 'result') {
                    const newVal = !qs[info.qIdx].isResHidden;
                    qs.forEach(q => { q.isResHidden = newVal; });
                }
                this.renderPreview();
                this.save(); // Auto-save immediately so studio picks up the change
            };
        }
        const resetBtn = document.getElementById('design-reset-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm("初期値に戻しますか？")) {
                    this.setDefaultUI();
                    this.renderPreview();
                }
            };
        }

        // Monitor mode is now the only mode (player preview removed)
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
                btn.onclick = () => this.closeQuickEdit();
            });
        }
    },

    closeQuickEdit: function () {
        const quickModal = document.getElementById('modal-design-quick');
        if (quickModal) quickModal.classList.add('hidden');
        document.querySelectorAll('.preview-q-block, .preview-c-block, .preview-bg-block').forEach(el => el.classList.remove('is-editing'));
        this.activeQuickEdit = null;
        this.renderPreview();
    },

    switchDevice: function (type) {
        console.log("[Design] switchDevice triggered:", type);
        const playerBtn = document.getElementById('design-toggle-player');
        const monitorBtn = document.getElementById('design-toggle-monitor');
        const mContainer = document.getElementById('preview-monitor-container');
        const pContainer = document.getElementById('preview-player-container');
        const layoutBtn = document.getElementById('btn-open-layout-inline');

        if (playerBtn) playerBtn.classList.toggle('active', type === 'player');
        if (monitorBtn) monitorBtn.classList.toggle('active', type === 'monitor');
        if (mContainer) mContainer.classList.toggle('hidden', type !== 'monitor');
        if (pContainer) pContainer.classList.toggle('hidden', type !== 'player');

        // Only show layout button in monitor mode
        if (layoutBtn) layoutBtn.classList.toggle('hidden', type !== 'monitor');

        // Only show layout dropdown wrapper in monitor mode
        const dropdown = document.querySelector('.design-layout-selector-wrapper');
        if (dropdown) dropdown.style.display = (type === 'monitor') ? 'block' : 'none';

        this.renderPreview();
    },

    moveQ: function (delta) {
        const qs = this.getQuestionsFromTarget();
        if (!qs) return;
        const totalSteps = 1 + (qs.length * 4);
        const newIdx = this.previewQIndex + delta;
        this.jumpToStep(newIdx, totalSteps);
    },

    getStepInfo: function (idx, questions) {
        if (!questions || questions.length === 0) return { type: 'none' };
        if (idx === 0) return { type: 'title', qIdx: 0 };
        const offset = idx - 1;
        const qIdx = Math.floor(offset / 4);
        const step = offset % 4;
        if (step === 0) return { type: 'qnumber', qIdx };
        if (step === 1) return { type: 'question', qIdx };
        if (step === 2) return { type: 'answer', qIdx };
        if (step === 3) return { type: 'result', qIdx };
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
        if (!modal) return;
        if (btn) btn.onclick = () => modal.classList.remove('hidden');
        modal.querySelectorAll('.modal-close-btn').forEach(b => b.onclick = () => modal.classList.add('hidden'));
        modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
    },

    loadTargetList: function () {
        const select = document.getElementById('design-target-select');
        if (!select) return;

        // Keep "Loading..." state only while fetching
        const originalText = select.options[0] ? select.options[0].text : "-- 編集対象を選択 --";
        select.innerHTML = '<option value="">Searching...</option>';

        let showId = window.App.State.currentShowId || sessionStorage.getItem('qs_show_id') || "";
        showId = showId.trim().toUpperCase().replace(/[\.\$#\[\]\/]/g, "");

        if (!showId) {
            select.innerHTML = '<option value="">-- No ID (Login Required) --</option>';
            return;
        }

        Promise.all([
            window.db.ref(`saved_sets/${showId}`).once('value'),
            window.db.ref(`saved_programs/${showId}`).once('value')
        ]).then(([setSnap, progSnap]) => {
            select.innerHTML = '<option value="">-- 編集対象を選択 --</option>';
            const sets = setSnap.val() || {};
            const progs = progSnap.val() || {};

            const optGroupSet = document.createElement('optgroup');
            optGroupSet.label = "Questions Sets";
            let setKeys = Object.keys(sets);
            if (setKeys.length > 0) {
                setKeys.forEach(k => {
                    const opt = document.createElement('option');
                    opt.value = JSON.stringify({ type: 'set', key: k });
                    opt.textContent = sets[k].title || "Untitled Set";
                    optGroupSet.appendChild(opt);
                });
                select.appendChild(optGroupSet);
            }

            const optGroupProg = document.createElement('optgroup');
            optGroupProg.label = "Programs";
            let progKeys = Object.keys(progs);
            if (progKeys.length > 0) {
                progKeys.forEach(k => {
                    const opt = document.createElement('option');
                    opt.value = JSON.stringify({ type: 'prog', key: k });
                    opt.textContent = progs[k].title || "Untitled Program";
                    optGroupProg.appendChild(opt);
                });
                select.appendChild(optGroupProg);
            }

            if (setKeys.length === 0 && progKeys.length === 0) {
                console.warn("[Design] No sets or programs found for ID:", showId);
                const opt = document.createElement('option');
                opt.disabled = true;
                opt.textContent = "保存されたデータがありません";
                select.appendChild(opt);
            }

            // ブラウザによる前回値の復元を防ぐため、明示的にプレースホルダーに戻す
            select.value = '';
        }).catch(err => {
            console.error("[Design] Failed to load target list:", err);
            select.innerHTML = '<option value="">Error Loading</option>';
        });
    },

    loadTarget: function () {
        const val = document.getElementById('design-target-select').value;
        if (!val) return alert("対象を選択してください");

        let showId = window.App.State.currentShowId || sessionStorage.getItem('qs_show_id') || "";
        showId = showId.trim().toUpperCase().replace(/[\.\$#\[\]\/]/g, "");

        if (!showId) return alert("IDが見つかりません。再度ログインしてください。");

        const targetInfo = JSON.parse(val);
        const path = targetInfo.type === 'set'
            ? `saved_sets/${showId}/${targetInfo.key}`
            : `saved_programs/${showId}/${targetInfo.key}`;

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
        const getVal = (id) => {
            const chk = document.getElementById(id + '-transparent');
            if (chk && chk.checked) return 'transparent';
            return document.getElementById(id).value;
        };
        const getRaw = (id) => document.getElementById(id).value;

        return {
            design: {
                mainBgColor: getVal('design-main-bg-color'),
                bgImage: document.getElementById('design-bg-image-data').value,
                qTextColor: getVal('design-q-text'),
                qBgColor: getVal('design-q-bg'),
                qBorderColor: getVal('design-q-border'),
                qFontSize: getRaw('design-q-size'),
                cTextColor: getVal('design-c-text'),
                cBgColor: getVal('design-c-bg'),
                cBorderColor: getVal('design-c-border'),
                cFontSize: getRaw('design-c-size'),
                gridRows: getRaw('design-grid-rows'),
                gridCols: getRaw('design-grid-cols')
            },
            layout: document.getElementById('creator-set-layout-inline')?.value || document.getElementById('creator-set-layout').value,
            align: document.getElementById('creator-set-align').value,
            cAlign: document.getElementById('creator-set-c-align')?.value || 'left',
            prodDesign: this.collectProdSettings()
        };
    },

    collectProdSettings: function () {
        // Fallback IDs if they exist in the DOM (reusing production design IDs)
        const getVal = (id, def) => {
            const el = document.getElementById(id);
            const chk = document.getElementById(id + '-transparent');
            if (chk && chk.checked) return 'transparent';
            return el?.value || def;
        };
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

    applyToUI: function (design, layout, align, prod, cAlign) {
        if (!design) design = this.defaults;
        if (prod) this.applyProdToUI(prod);

        const setVal = (id, val, defaultKey) => {
            const el = document.getElementById(id);
            const chk = document.getElementById(id + '-transparent');
            const finalVal = val || this.defaults[defaultKey];

            // Check if value is logically transparent
            const isTrans = finalVal === 'transparent' || finalVal === 'none' || (typeof finalVal === 'string' && finalVal.replace(/\s/g, '') === 'rgba(0,0,0,0)');

            if (isTrans) {
                if (chk) chk.checked = true;
                // Keep el value as is or set to black (so picker shows something)
                if (el && el.type === 'color') el.value = "#000000";
            } else {
                if (chk) chk.checked = false;
                if (el) el.value = finalVal;
            }
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
        setVal('design-grid-rows', design.gridRows, 'gridRows');
        setVal('design-grid-cols', design.gridCols, 'gridCols');

        document.getElementById('design-bg-image-data').value = design.bgImage || "";
        const status = document.getElementById('design-bg-image-status');
        if (status) {
            status.textContent = design.bgImage ? "画像あり" : "未選択";
            status.style.color = design.bgImage ? "#00ff00" : "#aaa";
        }

        if (layout) {
            const el1 = document.getElementById('creator-set-layout');
            const el2 = document.getElementById('creator-set-layout-inline');
            if (el1) el1.value = layout;
            if (el2) el2.value = layout;
        }
        if (align) {
            document.getElementById('creator-set-align').value = align;
            document.querySelectorAll('.btn-align').forEach(b => {
                b.classList.toggle('active', b.dataset.align === align);
            });
        }
        if (cAlign) {
            const el = document.getElementById('creator-set-c-align');
            if (el) el.value = cAlign;
        }
    },

    setDefaultUI: function () {
        this.applyToUI(this.defaults, 'standard', 'center');
    },

    renderPreview: function () {
        this.currentStepIsHidden = false; // Reset
        const content = document.getElementById('design-monitor-preview-content');
        const frame = document.getElementById('preview-monitor-container');

        if (!content || !frame) return;

        // Scaling logic for monitor frame
        const scaleFrame = (targetFrame, targetContent, baseWidth) => {
            const measureEl = targetFrame.querySelector('.design-preview-frame') || targetFrame;
            const fw = measureEl.clientWidth;
            if (fw > 0) {
                const s = fw / baseWidth;
                targetContent.style.transform = `translate(-50%, -50%) scale(${s})`;
                targetContent.style.transformOrigin = "center center";
            }
        };
        scaleFrame(frame, content, 1280);

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

            const totalSteps = 1 + (questions.length * 4);

            if (questions.length > 0) {
                if (this.previewQIndex >= totalSteps) this.previewQIndex = 0;
                const info = this.getStepInfo(this.previewQIndex, questions);
                const stepType = info.type;
                const qIdx = info.qIdx;
                qData = qIdx >= 0 ? questions[qIdx] : null;

                let isHidden = false;
                if (stepType === 'title') isHidden = !!questions[0].isTitleHidden;
                else if (stepType === 'qnumber') isHidden = !!questions[qIdx].isQNumHidden;
                else if (stepType === 'question') isHidden = !!questions[qIdx].isHidden;
                else if (stepType === 'answer') isHidden = !!questions[qIdx].isAnsHidden;
                else if (stepType === 'result') isHidden = !!questions[qIdx].isResHidden;
                this.currentStepIsHidden = isHidden; // Store for final overlay application

                const hideBtn = document.getElementById('design-pager-hide-toggle');
                if (hideBtn) {
                    hideBtn.classList.toggle('is-hidden', isHidden);
                    // Only show visibility toggle for specific types: title, qnumber, result (Ranking)
                    const showToggle = ['title', 'qnumber', 'result'].includes(stepType);
                    hideBtn.style.display = showToggle ? 'flex' : 'none';
                }

                // Update Pager UI
                const pager = document.getElementById('design-pager-container');
                if (pager) pager.classList.toggle('hidden', questions.length === 0);

                const status = document.getElementById('design-pager-status');
                const prev = document.getElementById('design-pager-prev');
                const next = document.getElementById('design-pager-next');

                let statusText = "TITLE";
                if (stepType === 'qnumber') statusText = `第${qIdx + 1}問 (番号)`;
                if (stepType === 'question') statusText = `第${qIdx + 1}問 (内容)`;
                if (stepType === 'answer') statusText = `第${qIdx + 1}問 (正解)`;
                if (stepType === 'result') statusText = `第${qIdx + 1}問 (ランキング)`;

                if (isHidden) statusText += " (非表示)";
                if (status) status.textContent = statusText;

                if (prev) prev.disabled = (this.previewQIndex === 0);
                if (next) next.disabled = (this.previewQIndex === totalSteps - 1);

                if (stepType === 'title' || stepType === 'qnumber') {
                    this.renderProductionStep(stepType, qIdx, questions);
                    this.applyHiddenOverlay();
                    return;
                }
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

        const layout = s.layout || 'standard';

        let qStyle = '';
        const baseQStyle = `
            color:${d.qTextColor}; 
            font-weight:bold; 
            font-size:${fontSizeVal(d.qFontSize, layout.startsWith('split') ? '42px' : '48px')};
            display:flex; 
            align-items:center; 
            justify-content:${s.align === 'center' ? 'center' : (s.align === 'right' ? 'flex-end' : 'flex-start')}; 
            text-align:${s.align};
        `;

        // Simple Box Style (User Request)
        if (layout.startsWith('split')) {
            qStyle = `
                ${baseQStyle}
                writing-mode: vertical-rl; 
                text-orientation: upright;
                height: 85%;
                width: 20%;
                margin-left: 5%;
                border: 6px solid ${d.qBorderColor};
                background-color: ${d.qBgColor || 'rgba(0,0,0,0.5)'};
                padding: 30px;
                box-sizing: border-box;
            `;
        } else {
            qStyle = `
                ${baseQStyle}
                width: 90%; 
                margin-bottom: 40px; 
                padding: 30px;
                box-sizing: border-box;
                border: 6px solid ${d.qBorderColor};
                background-color: ${d.qBgColor || 'rgba(0,0,0,0.5)'};
            `;
        }

        const cAlign = s.cAlign || 'left';
        const cStyle = `
            color:${d.cTextColor}; 
            background: ${d.cBgColor || 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%)'};
            border: 1px solid ${d.cBorderColor || 'rgba(255, 255, 255, 0.1)'};
            padding: 15px 30px;
            border-radius: 12px;
            font-size:${fontSizeVal(d.cFontSize, '32px')};
            display:flex; 
            align-items:center;
            justify-content:${cAlign === 'center' ? 'center' : (cAlign === 'right' ? 'flex-end' : 'flex-start')};
            text-align:${cAlign};
            gap: 25px;
            pointer-events: none; /* Let parent catch click */
        `;

        const labelStyle = `
            color:${d.qBorderColor || '#00e5ff'}; 
            font-weight:900; 
            font-size:1.2em;
            font-family: 'Arial Black', sans-serif;
            text-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
        `;

        let layoutHtml = '';

        if (qType === 'free_written' || qType === 'free_oral') {
            layoutHtml = `
                <div style="padding:60px; box-sizing:border-box; display:flex; flex-direction:column; height:100%; justify-content:center; align-items:center;">
                    <div class="preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" onclick="event.stopPropagation(); App.Design.openQuickEdit('q', event)" style="${qStyle} width:80%; height:50%; font-size:60px;">${qText}</div>
                </div>
            `;
        } else {
            // General layout logic (Standard vs Split)
            const isSplit = layout.startsWith('split');
            const wrapperStyle = isSplit
                ? "display:flex; flex-direction:row-reverse; justify-content:center; align-items:center; height:100%; width:100%;"
                : "display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; width:100%;";

            const cWidth = isSplit ? "60%" : "85%";

            // Grid logic
            const rows = parseInt(d.gridRows) || 0;
            const cols = parseInt(d.gridCols) || 0;
            let cBlockStyle = '';

            if (rows > 0 && cols > 0) {
                cBlockStyle = `display:grid; grid-template-columns: repeat(${cols}, 1fr); gap:20px; width:${cWidth};`;
            } else {
                cBlockStyle = `display:flex; flex-direction:column; justify-content:center; gap:20px; width:${cWidth};`;
            }

            layoutHtml = `
                <div style="${wrapperStyle}">
                    <div class="preview-q-block ${this.activeQuickEdit === 'q' ? 'is-editing' : ''}" onclick="event.stopPropagation(); App.Design.openQuickEdit('q', event)" style="${qStyle}">${qText}</div>
                    <div class="preview-c-block ${this.activeQuickEdit === 'c' ? 'is-editing' : ''}" onclick="event.stopPropagation(); App.Design.openQuickEdit('c', event)" style="${cBlockStyle}">
                        ${choices.map((c, i) => {
                const isMulti = qType && (qType.startsWith('multi') || qType.startsWith('ranking'));
                const info = (this.currentTarget && this.currentTarget.data) ? this.getStepInfo(this.previewQIndex, this.getQuestionsFromTarget() || []) : null;
                const isAnswerPhase = info && info.type === 'answer';
                const answerQData = (isAnswerPhase && info.qIdx >= 0) ? (this.getQuestionsFromTarget() || [])[info.qIdx] : null;
                const isDobon = qType === 'choice' && answerQData && (answerQData.mode === 'dobon' || answerQData.mode === 'multi' || answerQData.multi);

                const isRevealed = isAnswerPhase && isMulti && (i % 3 === 0);
                const isMissed = isAnswerPhase && isMulti && !isRevealed;

                const dobonTrapSet = (isAnswerPhase && isDobon && answerQData.correct !== undefined)
                    ? new Set(Array.isArray(answerQData.correct) ? answerQData.correct.map(Number) : [Number(answerQData.correct)])
                    : null;
                const isDobonTrap = dobonTrapSet && dobonTrapSet.has(i);
                const isDobonSafe = isAnswerPhase && isDobon && dobonTrapSet && !dobonTrapSet.has(i);

                const isNormalChoice = qType === 'choice' && !isDobon && !isMulti;
                const normalChoiceCorrectIdx = (isAnswerPhase && isNormalChoice && answerQData)
                    ? parseInt(answerQData.correctIndex !== undefined ? answerQData.correctIndex : answerQData.correct)
                    : -1;

                let finalCStyle = cStyle;
                if (isRevealed) finalCStyle += `background:#2ecc71 !important; border:3px solid #fff !important; color:#fff !important; transform:scale(1.05);`;
                else if (isMissed) finalCStyle += `background:#ff5555 !important; border:3px solid #fff !important; color:#fff !important;`;
                else if (isDobonTrap) finalCStyle += `background:#ff5555 !important; border:3px solid #fff !important; color:#fff !important;`;
                else if (isDobonSafe) finalCStyle += `background:#2ecc71 !important; border:3px solid #fff !important; color:#fff !important; transform:scale(1.05);`;
                else if (isAnswerPhase && isNormalChoice && normalChoiceCorrectIdx >= 0) {
                    if (i === normalChoiceCorrectIdx) {
                        finalCStyle += `background:linear-gradient(135deg,#ffd700 0%,#ffec3d 100%) !important; color:#1a1000 !important; border:3px solid #fff !important; box-shadow:0 0 24px rgba(255,215,0,0.95),0 0 60px rgba(255,215,0,0.55) !important; transform:scale(1.04); font-weight:900 !important; opacity:1;`;
                    } else {
                        finalCStyle += `opacity:0.32; background:rgba(20,20,20,0.85) !important; filter:grayscale(70%) brightness(0.5); border:1px solid rgba(255,255,255,0.08) !important; box-shadow:none !important;`;
                    }
                }

                const isRanking = qType && qType.startsWith('ranking');
                const labelHtml = isMulti ? (isRanking ? `<span style="${labelStyle}">${i + 1}位</span> ` : '') : `<span style="${labelStyle}">${String.fromCharCode(65 + i)}</span> `;
                return `
                                <div style="${finalCStyle}">
                                    ${labelHtml}<span>${c}</span>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        // Toggle Grid Config Button visibility
        const btnGrid = document.getElementById('btn-open-grid-config');
        if (btnGrid) {
            const isGridType = ['choice', 'sort'].includes(qType) || (qType && (qType.startsWith('multi') || qType.startsWith('ranking')));
            if (isGridType) {
                btnGrid.classList.remove('hidden');
            } else {
                btnGrid.classList.add('hidden');
            }
        }

        let extraHtml = '';
        if (this.currentTarget && this.currentTarget.data && this.previewQIndex > 0) {
            let questions = this.getQuestionsFromTarget() || [];
            if (questions.length > 0) {
                const info = this.getStepInfo(this.previewQIndex, questions);
                const qIdx = info.qIdx;
                const qData = qIdx >= 0 ? questions[qIdx] : null;
                if (qData) {
                    if (info.type === 'answer') {
                        const isMulti = qType && (qType.startsWith('multi') || qType.startsWith('ranking'));
                        const isDobon = qType === 'choice' && qData && (qData.mode === 'dobon' || qData.mode === 'multi' || qData.multi);
                        const isNormalChoice = qType === 'choice' && !isDobon;
                        const isSort = qType === 'sort';
                        if (isMulti || isDobon || isNormalChoice) {
                            // Suppress popup: multi/dobon use grid coloring; normal choice uses glow/dim on panels
                            extraHtml = '';
                        } else if (isSort && qData.c) {
                            // Sort answer reveal: ordered list with letter badge circles
                            const accent = d.qBorderColor || '#00bfff';
                            const textColor = d.qTextColor || '#fff';
                            const qBgColor = d.qBgColor || 'rgba(0,0,0,0.5)';
                            const badgeColors = ['#3498db','#e74c3c','#2ecc71','#f39c12','#9b59b6','#e91e63','#1abc9c','#e67e22','#16a085','#c0392b'];
                            let correctOrder = [];
                            if (Array.isArray(qData.correct)) correctOrder = qData.correct.map(Number);
                            else if (typeof qData.correct === 'string') correctOrder = qData.correct.split('').map(c => c.charCodeAt(0) - 65);
                            const rows = correctOrder.map((origIdx) => {
                                const label = String.fromCharCode(65 + origIdx);
                                const text = qData.c[origIdx] !== undefined ? qData.c[origIdx] : label;
                                const color = badgeColors[origIdx % badgeColors.length];
                                return `<div style="display:flex;align-items:center;gap:1.5%;background:rgba(5,15,50,0.8);border-radius:8px;padding:0.6% 1.2%;border:1px solid rgba(255,255,255,0.12);">
                                    <div style="width:4vh;height:4vh;min-width:4vh;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;font-size:2vh;font-weight:900;color:#fff;flex-shrink:0;">${label}</div>
                                    <div style="font-size:2.4vh;font-weight:700;color:#fff;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${text}</div>
                                </div>`;
                            }).join('');
                            const commentary = qData.commentary || '';
                            const bgFill = d.mainBgColor && d.mainBgColor !== '#0a0a0a'
                                ? d.mainBgColor
                                : 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)';
                            extraHtml = `
                            <div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:300;background:${bgFill};display:flex;flex-direction:column;align-items:center;padding:2% 3%;box-sizing:border-box;overflow:hidden;font-family:sans-serif;">
                                <div style="font-size:2.8vh;font-weight:700;color:${textColor};text-align:center;padding:1% 2%;background:${qBgColor};border-radius:8px;border-left:5px solid ${accent};width:90%;margin-bottom:1.2%;line-height:1.4;">${qData.q}</div>
                                <div style="font-size:2vh;color:#ffd700;font-weight:900;letter-spacing:0.25em;margin-bottom:1%;">正　解</div>
                                <div style="width:90%;flex:1;display:flex;flex-direction:column;gap:0.5vh;background:rgba(0,0,0,0.35);border:3px solid ${accent};border-radius:12px;padding:1% 1%;box-shadow:0 0 20px ${accent}44;overflow:hidden;">
                                    ${rows}
                                </div>
                                ${commentary ? `<div style="font-size:1.8vh;color:#aaa;margin-top:0.8%;text-align:center;max-width:90%;">${commentary}</div>` : ''}
                            </div>`;
                        } else {
                            let ansStr = Array.isArray(qData.correct) ? qData.correct.join(' / ') : (qData.correct !== undefined ? qData.correct : "正解内容");
                            if (qType === 'choice' && qData.c) {
                                if (Array.isArray(qData.correct)) ansStr = qData.correct.map(idx => qData.c[idx]).join(' / ');
                                else ansStr = qData.c[qData.correct] || qData.c[qData.correctIndex] || ansStr;
                            }
                            const accent = d.qBorderColor || '#00bfff';
                            extraHtml = `
                        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); z-index:300; background:rgba(0,0,0,0.95); border:6px solid ${accent}; border-radius:20px; padding:40px 60px; color:#fff; box-shadow:0 0 80px rgba(0,0,0,0.9); text-align:center; min-width:60vw; font-family:sans-serif;">
                            <div style="font-size:3vh; color:${accent}; font-weight:800; margin-bottom:15px; letter-spacing:2px;">CORRECT ANSWER</div>
                            <div style="font-size:8vh; font-weight:900; line-height:1.2; word-break:break-all; max-width:80vw;">${ansStr}</div>
                            <div style="font-size:2.5vh; color:#aaa; font-weight:normal; margin-top:20px; border-top:1px solid #333; padding-top:20px;">${qData.commentary || ""}</div>
                            </div>
                            `;
                        }
                    } else if (info.type === 'result') {
                        extraHtml = `
                        <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:400; font-family:sans-serif;">
                            <h1 style="font-size:6vh; color:#ffd700; text-shadow:0 0 20px #ffd700; margin-bottom:4vh;">CURRENT RANKING</h1>
                            <div style="width:70%; max-width:1000px; background:rgba(0,0,0,0.5); padding:20px; border-radius:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #444; font-size:5vh; color:#ffd700;">
                                    <div style="font-weight:bold; width:10%;">1</div>
                                    <div style="flex:1; text-align:left; padding-left:20px;">👑 プレイヤーA</div>
                                    <div style="font-weight:900;">100 <span style="font-size:0.6em;">pts</span></div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #444; font-size:4vh; color:#c0c0c0;">
                                    <div style="font-weight:bold; width:10%;">2</div>
                                    <div style="flex:1; text-align:left; padding-left:20px;">🥈 プレイヤーB</div>
                                    <div style="font-weight:900;">80 <span style="font-size:0.6em;">pts</span></div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #444; font-size:4vh; color:#cd7f32;">
                                    <div style="font-weight:bold; width:10%;">3</div>
                                    <div style="flex:1; text-align:left; padding-left:20px;">🥉 プレイヤーC</div>
                                    <div style="font-weight:900;">50 <span style="font-size:0.6em;">pts</span></div>
                                </div>
                            </div>
                        </div>
                        `;
                    }
                }
            }
        }

        content.innerHTML = `
            <div class="preview-bg-block ${this.activeQuickEdit === 'bg' ? 'is-editing' : ''}" 
                 onclick="App.Design.openQuickEdit('bg', event)"
                 style="width:100%; height:100%; ${bgStyle} font-family:sans-serif; overflow:hidden; cursor:pointer; position:relative;">
                ${layoutHtml}
                ${extraHtml}
            </div>
        `;

        // Player Preview Rendering
        this.renderPlayerPreview(qText, choices, qType, d, this.statusLabelForPlayer);

        this.applyHiddenOverlay();
    },

    applyHiddenOverlay: function () {
        const isHidden = this.currentStepIsHidden;
        const addOverlay = (target) => {
            if (!target) return;
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

        const content = document.getElementById('design-monitor-preview-content');
        const playerContent = document.getElementById('design-player-preview-content');
        addOverlay(content);
        addOverlay(playerContent);
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
            ansHtml = `<div style="text-align:center; color:#888; border:1px dashed #444; padding:20px; border-radius:10px;">自由解答入力エリア</div>`;
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
        const content = modal.querySelector('.design-modal-content') || modal.querySelector('.quick-inspector-content');
        const title = modal.querySelector('.modal-title');
        const body = modal.querySelector('.design-modal-body');
        if (!modal || !body || !content || !title) return;

        // Reset highlight
        document.querySelectorAll('.preview-q-block, .preview-c-block, .preview-bg-block').forEach(el => el.classList.remove('is-editing'));

        let targetSelector = '.preview-q-block';
        if (type === 'c') targetSelector = '.preview-c-block';
        if (type === 'bg' || type === 'title' || type === 'qnumber') targetSelector = '.preview-bg-block';

        const target = document.querySelector(targetSelector);
        if (target) target.classList.add('is-editing');

        // Positioning logic
        if (event && window.innerWidth > 768) {
            event.stopPropagation();
            const x = event.clientX;
            const y = event.clientY;
            const panelWidth = 280;
            const panelHeight = 320;
            const offset = 20;

            let left = x + offset;
            let top = y - (panelHeight / 2);

            if (left + panelWidth > window.innerWidth - 10) left = x - panelWidth - offset;
            if (top < 10) top = 10;
            if (top + panelHeight > window.innerHeight) top = window.innerHeight - panelHeight - 10;

            content.style.position = 'absolute';
            content.style.left = left + 'px';
            content.style.top = top + 'px';
            content.style.bottom = 'auto';
            content.style.transform = 'none';
        } else {
            content.style.position = '';
            content.style.left = '';
            content.style.top = '';
            content.style.bottom = '0';
            content.style.transform = '';
        }

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

        const bindTransToggle = (toggleId, targetTransId, swatchId, colorInputId) => {
            const toggle = document.getElementById(toggleId);
            if (!toggle) return;
            const updateVisual = () => {
                const isChecked = toggle.checked;
                const targetTrans = document.getElementById(targetTransId);
                if (targetTrans) targetTrans.checked = isChecked;
                const swatch = document.getElementById(swatchId);
                if (isChecked) {
                    swatch.style.background = "transparent";
                    swatch.style.backgroundImage = "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)";
                    swatch.style.backgroundSize = "10px 10px";
                    swatch.style.backgroundPosition = "0 0, 0 5px, 5px -5px, -5px 0px";
                } else {
                    swatch.style.background = document.getElementById(colorInputId)?.value || '#000';
                    swatch.style.backgroundImage = "none";
                }
                this.renderPreview();
            };
            toggle.onchange = updateVisual;
            if (toggle.checked) updateVisual();

            const picker = document.getElementById(colorInputId);
            if (picker) {
                picker.addEventListener('input', () => {
                    toggle.checked = false;
                    const targetTrans = document.getElementById(targetTransId);
                    if (targetTrans) targetTrans.checked = false;
                    const swatch = document.getElementById(swatchId);
                    if (swatch) swatch.style.backgroundImage = "none";
                });
            }
        };

        const doneBtn = `<div class="inspector-row" style="height:auto; padding:15px 0 5px;">
            <button class="btn-block btn-dark btn-mini" onclick="document.getElementById('modal-design-quick').classList.add('hidden')">完了</button>
        </div>`;

        if (type === 'title' || type === 'qnumber') {
            const isTitle = (type === 'title');
            title.textContent = isTitle ? "タイトル画面" : "問題番号";
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
                    <div class="inspector-icon-box" title="テキスト">T</div>
                    <div class="inspector-controls">
                        <div class="inspector-control-group">
                            <span class="inspector-label-mini">色</span>
                            <div class="flex-center" style="gap:8px;">
                                <div class="color-swatch-wrapper">
                                    <input type="color" id="quick-text-color" class="color-picker-hidden" value="${document.getElementById(IDs.text).value}">
                                    <div class="color-swatch" id="swatch-text-color" style="background:${document.getElementById(IDs.text).value}"></div>
                                </div>
                                <label style="font-size:10px; cursor:pointer; color:#888; display:flex; align-items:center; gap:3px;">
                                    <input type="checkbox" id="quick-text-transparent-toggle" ${document.getElementById(IDs.text + '-transparent').checked ? 'checked' : ''}> 透明
                                </label>
                            </div>
                        </div>
                        <div class="inspector-control-group">
                            <span class="inspector-label-mini">サイズ</span>
                            <div class="stepper-input">
                                <button class="stepper-btn" id="stepper-down">▼</button>
                                <input type="text" id="quick-font-size" class="inspector-input-mini" value="${document.getElementById(IDs.size).value}">
                                <button class="stepper-btn" id="stepper-up">▲</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="inspector-row">
                    <div class="inspector-icon-box" title="背景">🎨</div>
                    <div class="inspector-controls">
                        <div class="inspector-control-group">
                            <span class="inspector-label-mini">背景色</span>
                            <div class="flex-center" style="gap:8px;">
                                <div class="color-swatch-wrapper">
                                    <input type="color" id="quick-bg-color" class="color-picker-hidden" value="${document.getElementById(IDs.bg).value}">
                                    <div class="color-swatch" id="swatch-bg-color" style="background:${document.getElementById(IDs.bg).value}"></div>
                                </div>
                                <label style="font-size:10px; cursor:pointer; color:#888; display:flex; align-items:center; gap:3px;">
                                    <input type="checkbox" id="quick-bg-transparent-toggle" ${document.getElementById(IDs.bg + '-transparent').checked ? 'checked' : ''}> 透明
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="inspector-row" style="height:auto; padding:10px 0 0;">
                    <button class="btn-dark btn-block btn-mini" onclick="document.getElementById('${isTitle ? 'modal-prod-title' : 'modal-prod-qnum'}').classList.remove('hidden'); document.getElementById('modal-design-quick').classList.add('hidden');">
                        ⚙️ 詳細設定を開く
                    </button>
                </div>
                ${doneBtn}
            `;

            syncHelper('quick-text-color', IDs.text, 'swatch-text-color');
            syncHelper('quick-bg-color', IDs.bg, 'swatch-bg-color');
            bindStepper('quick-font-size', IDs.size);
            bindTransToggle('quick-text-transparent-toggle', IDs.text + '-transparent', 'swatch-text-color', 'quick-text-color');
            bindTransToggle('quick-bg-transparent-toggle', IDs.bg + '-transparent', 'swatch-bg-color', 'quick-bg-color');

            const contentInp = document.getElementById('quick-content-override');
            if (contentInp) {
                contentInp.oninput = () => {
                    const targetEl = document.getElementById(isTitle ? 'design-title-text-value' : 'design-qnum-text-value');
                    if (targetEl) targetEl.value = contentInp.value;
                    this.renderPreview();
                };
            }
            modal.classList.remove('hidden');
            return;
        }

        if (type === 'bg') {
            title.textContent = "背景";
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
                <div class="inspector-row" style="height:auto; padding:10px 0 0;">
                    <button class="btn-dark btn-block btn-mini" onclick="document.getElementById('modal-design-bg').classList.remove('hidden'); document.getElementById('modal-design-quick').classList.add('hidden');">
                        🖼 背景画像の詳細設定
                    </button>
                </div>
                ${doneBtn}
            `;
            syncHelper('quick-bg-color', 'design-main-bg-color', 'swatch-bg-color');
            modal.classList.remove('hidden');
            return;
        }

        // Question or Choice Area
        title.textContent = (type === 'q') ? "問題エリア" : "選択肢エリア";
        const prefix = (type === 'q') ? 'q' : 'c';

        body.innerHTML = `
            <div class="inspector-row">
                <div class="inspector-icon-box" title="テキスト">T</div>
                <div class="inspector-controls">
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">文字色</span>
                        <div class="flex-center" style="gap:8px;">
                            <div class="color-swatch-wrapper">
                                <input type="color" id="quick-text-color" class="color-picker-hidden" value="${document.getElementById(`design-${prefix}-text`).value}">
                                <div class="color-swatch" id="swatch-text-color" style="background:${document.getElementById(`design-${prefix}-text-transparent`).checked ? 'transparent' : document.getElementById(`design-${prefix}-text`).value}"></div>
                            </div>
                            <label style="font-size:10px; cursor:pointer; color:#888; display:flex; align-items:center; gap:3px;">
                                <input type="checkbox" id="quick-text-transparent-toggle" ${document.getElementById(`design-${prefix}-text-transparent`).checked ? 'checked' : ''}> 透明
                            </label>
                        </div>
                    </div>
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">サイズ</span>
                        <div class="stepper-input">
                            <button class="stepper-btn" id="stepper-down">▼</button>
                            <input type="text" id="quick-font-size" class="inspector-input-mini" value="${document.getElementById(`design-${prefix}-size`).value}">
                            <button class="stepper-btn" id="stepper-up">▲</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="inspector-row">
                <div class="inspector-icon-box" title="レイアウト">📐</div>
                <div class="inspector-controls">
                    <div class="inspector-control-group" style="flex:1;">
                        <span class="inspector-label-mini">揃え</span>
                        <div class="align-btn-group-toolbar">
                            ${prefix === 'q' ? `
                                <button type="button" class="btn-align-q ${document.getElementById('creator-set-align').value === 'left' ? 'active' : ''}" data-align="left">左</button>
                                <button type="button" class="btn-align-q ${document.getElementById('creator-set-align').value === 'center' ? 'active' : ''}" data-align="center">中</button>
                                <button type="button" class="btn-align-q ${document.getElementById('creator-set-align').value === 'right' ? 'active' : ''}" data-align="right">右</button>
                            ` : `
                                <button type="button" class="btn-align-c ${document.getElementById('creator-set-c-align').value === 'left' ? 'active' : ''}" data-align="left">左</button>
                                <button type="button" class="btn-align-c ${document.getElementById('creator-set-c-align').value === 'center' ? 'active' : ''}" data-align="center">中</button>
                                <button type="button" class="btn-align-c ${document.getElementById('creator-set-c-align').value === 'right' ? 'active' : ''}" data-align="right">右</button>
                            `}
                        </div>
                    </div>
                </div>
            </div>

            <div class="inspector-row">
                <div class="inspector-icon-box" title="ブロック">□</div>
                <div class="inspector-controls">
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">枠線</span>
                        <div class="flex-center" style="gap:8px;">
                            <div class="color-swatch-wrapper">
                                <input type="color" id="quick-border-color" class="color-picker-hidden" value="${document.getElementById(`design-${prefix}-border`).value}">
                                <div class="color-swatch" id="swatch-border-color" style="background:${document.getElementById(`design-${prefix}-border-transparent`).checked ? 'transparent' : document.getElementById(`design-${prefix}-border`).value}"></div>
                            </div>
                            <label style="font-size:10px; cursor:pointer; color:#888; display:flex; align-items:center; gap:3px;">
                                <input type="checkbox" id="quick-border-transparent-toggle" ${document.getElementById(`design-${prefix}-border-transparent`).checked ? 'checked' : ''}> 透明
                            </label>
                        </div>
                    </div>
                    <div class="inspector-control-group">
                        <span class="inspector-label-mini">背景色</span>
                        <div class="flex-center" style="gap:8px;">
                            <div class="color-swatch-wrapper">
                                <input type="color" id="quick-bg-color" class="color-picker-hidden" value="${document.getElementById(`design-${prefix}-bg`).value}">
                                <div class="color-swatch" id="swatch-bg-color" style="background:${document.getElementById(`design-${prefix}-bg-transparent`).checked ? 'transparent' : document.getElementById(`design-${prefix}-bg`).value}"></div>
                            </div>
                            <label style="font-size:10px; cursor:pointer; color:#888; display:flex; align-items:center; gap:3px;">
                                <input type="checkbox" id="quick-bg-transparent-toggle" ${document.getElementById(`design-${prefix}-bg-transparent`).checked ? 'checked' : ''}> 透明
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            ${doneBtn}
        `;

        modal.classList.remove('hidden');

        // Bind events
        syncHelper('quick-text-color', `design-${prefix}-text`, 'swatch-text-color');
        syncHelper('quick-border-color', `design-${prefix}-border`, 'swatch-border-color');
        syncHelper('quick-bg-color', `design-${prefix}-bg`, 'swatch-bg-color');

        bindTransToggle('quick-text-transparent-toggle', `design-${prefix}-text-transparent`, 'swatch-text-color', 'quick-text-color');
        bindTransToggle('quick-border-transparent-toggle', `design-${prefix}-border-transparent`, 'swatch-border-color', 'quick-border-color');
        bindTransToggle('quick-bg-transparent-toggle', `design-${prefix}-bg-transparent`, 'swatch-bg-color', 'quick-bg-color');

        bindStepper('quick-font-size', `design-${prefix}-size`);

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

        body.querySelectorAll('.btn-align-c').forEach(btn => {
            btn.onclick = () => {
                body.querySelectorAll('.btn-align-c').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const realCAlign = document.getElementById('creator-set-c-align');
                if (realCAlign) {
                    realCAlign.value = btn.dataset.align;
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
                    <div style="color:${s.titleTextColor}; font-size:${fontSize(s.titleSize || '80px')}; font-weight:900; text-align:center; padding: 0 50px; line-height:1.2;">
                        ${displayTitle.replace(/\\n/g, '<br>')}
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
                    <div style="color:${s.qNumberTextColor}; font-size:${fontSize(s.qNumberSize || '80px')}; font-weight:900; line-height:1.2;">
                        ${displayQNum.replace(/\\n/g, '<br>')}
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
