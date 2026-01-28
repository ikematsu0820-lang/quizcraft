/* =========================================================
 * host_production_design.js (v2: Modal Setup Added)
 * =======================================================*/

App.ProductionDesign = {
    currentTarget: null,

    defaults: {
        // Program Title (プログラム名)
        programTitleBgColor: "#000000",
        programTitleTextColor: "#ffffff",
        programTitleFont: "sans-serif",
        programTitleSize: "10vh",
        programTitleAnimation: "fade",

        // Set Title (セット名)
        setTitleBgColor: "#1a1a1a",
        setTitleTextColor: "#00e5ff",
        setTitleFont: "sans-serif",
        setTitleSize: "7vh",
        setTitleAnimation: "slide",

        // Rule Explanation (ルール説明)
        rulesBgColor: "#0a0a0a",
        rulesTextColor: "#ffffff",
        rulesFont: "sans-serif",
        rulesSize: "3vh",
        rulesAnimation: "fade",

        // Question Number (問題番号)
        qNumberBgColor: "rgba(0, 0, 0, 0.8)",
        qNumberTextColor: "#00e5ff",
        qNumberFont: "sans-serif",
        qNumberSize: "10vh",
        qNumberAnimation: "slide",
        qNumberPosition: "center",

        // Time Up (タイムアップ)
        timeUpBgColor: "#ff0000",
        timeUpTextColor: "#ffffff",
        timeUpFont: "sans-serif",
        timeUpSize: "8vh",
        timeUpAnimation: "pop",

        // All Answers (全員の回答)
        answersBgColor: "#0a0a0a",
        answersTextColor: "#ffffff",
        answersFont: "sans-serif",
        answersAnimation: "cascade",

        // Correct Answer (正解発表)
        correctBgColor: "#0a0a0a",
        correctTextColor: "#00ff00",
        correctFont: "sans-serif",
        correctSize: "6vh",
        correctAnimation: "pop",

        // Ranking (順位発表)
        rankingBgColor: "#0a0a0a",
        rankingTextColor: "#ffffff",
        rankingAccentColor: "#ffd700",
        rankingFont: "sans-serif",
        rankingAnimation: "cascade",

        // Final Ranking (最終発表)
        finalBgColor: "#000000",
        finalTextColor: "#ffd700",
        finalAccentColor: "#ffffff",
        finalFont: "sans-serif",
        finalSize: "5vh",
        finalAnimation: "cascade"
    },

    init: function () {
        App.Ui.showView(App.Ui.views.productionDesign);
        this.currentTarget = null;
        this.bindEvents();
        this.loadTargetList();
        this.setDefaultUI();
        this.renderPreview();
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

        // Preview type radio buttons
        document.querySelectorAll('input[name="prod-preview-type"]').forEach(radio => {
            radio.onchange = () => this.renderPreview();
        });

        // Setup modals
        this.setupModal('btn-open-prod-title', 'modal-prod-title');
        this.setupModal('btn-open-prod-qnum', 'modal-prod-qnum');
        this.setupModal('btn-open-prod-ranking', 'modal-prod-ranking');
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
        if (!preview) return;

        const s = this.collectSettings();
        const previewType = document.querySelector('input[name="prod-preview-type"]:checked')?.value || 'title';

        let html = '';

        if (previewType === 'title') {
            html = `
                <div style="width:100%; height:100%; background:${s.titleBgColor}; display:flex; align-items:center; justify-content:center; font-family:${s.titleFont};">
                    <div style="color:${s.titleTextColor}; font-size:${s.titleSize}; font-weight:900; text-align:center; animation: ${s.titleAnimation}In 1s ease-out;">
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
                <div style="width:100%; height:100%; background:${s.qNumberBgColor}; display:flex; ${positionStyles[s.qNumberPosition]} font-family:${s.qNumberFont};">
                    <div style="color:${s.qNumberTextColor}; font-size:${s.qNumberSize}; font-weight:900; animation: ${s.qNumberAnimation}In 0.8s ease-out;">
                        第1問
                    </div>
                </div>
            `;
        } else if (previewType === 'ranking') {
            html = `
                <div style="width:100%; height:100%; background:${s.rankingBgColor}; padding:40px; font-family:${s.rankingFont}; overflow:hidden;">
                    <div style="color:${s.rankingAccentColor}; font-size:4vh; font-weight:900; text-align:center; margin-bottom:30px;">RANKING</div>
                    <div style="display:flex; flex-direction:column; gap:15px;">
                        ${[1, 2, 3].map(rank => `
                            <div style="background:rgba(255,255,255,0.05); padding:15px 20px; border-radius:10px; display:flex; align-items:center; animation: ${s.rankingAnimation}In ${rank * 0.2}s ease-out;">
                                <div style="color:${s.rankingAccentColor}; font-size:3vh; font-weight:900; margin-right:20px;">${rank}</div>
                                <div style="color:${s.rankingTextColor}; font-size:2.5vh; flex:1;">プレイヤー${rank}</div>
                                <div style="color:${s.rankingAccentColor}; font-size:2.5vh; font-weight:700;">${100 - rank * 10}pt</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        preview.innerHTML = html;
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
    }
};

window.enterProductionDesignMode = () => App.ProductionDesign.init();
