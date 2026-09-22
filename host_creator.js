/* =========================================================
 * host_creator.js (v112: Modal UI Implementation)
 * =======================================================*/

// ★ 安全装置
window.App = window.App || {};

window.App.Creator = {
    editingIndex: null,
    editingTitle: "",
    currentLetterSteps: [],
    nextSortRank: 1, // For interactive sorting

    init: function () {
        this.editingIndex = null;
        this.editingTitle = "";
        window.App.Data.createdQuestions = [];
        window.App.State.editingSetId = null;
        this.currentLetterSteps = [];

        const showIdEl = document.getElementById('creator-show-id');
        if (showIdEl) showIdEl.textContent = window.App.State.currentShowId || '---';

        const btnSave = document.getElementById('save-to-cloud-btn');
        if (btnSave) btnSave.textContent = APP_TEXT.Creator.BtnSave;

        if (window.resetGlobalSettings) window.resetGlobalSettings();

        this.setupTypeSelect();

        // Reset type selector to blank on every init
        const sel = document.getElementById('creator-q-type');
        const subArea = document.getElementById('creator-q-subtype-area');
        const subSel = document.getElementById('creator-q-subtype');
        if (sel) {
            sel.value = "";
            sel.disabled = false;
            subSel.disabled = false;
            subArea.classList.add('hidden');
            document.getElementById('creator-type-locked-msg').classList.add('hidden');
            document.getElementById('creator-form-container').innerHTML = '';
        }

        this.resetForm();
        this.renderList();
        window.App.Ui.showView(window.App.Ui.views.creator);
    },

    initWithType: function (type) {
        this.init();
        const sel = document.getElementById('creator-q-type');
        if (sel && type) {
            sel.value = type;
            this.renderForm(type);
        }
    },

    setupTypeSelect: function () {
        const sel = document.getElementById('creator-q-type');
        const subArea = document.getElementById('creator-q-subtype-area');
        const subSel = document.getElementById('creator-q-subtype');
        if (!sel || sel.options.length > 0) return;

        const mainTypes = [
            { v: 'free', t: APP_TEXT.Creator.TypeFree },
            { v: 'choice', t: APP_TEXT.Creator.TypeChoice },
            { v: 'sort', t: APP_TEXT.Creator.TypeSort },
            { v: 'multi_group', t: APP_TEXT.Creator.TypeMulti },
            { v: 'assoc_group', t: APP_TEXT.Creator.TypeAssoc },
            { v: 'num_group', t: '⑥ 数字予想' }
        ];

        const placeholder = document.createElement('option');
        placeholder.value = "";
        placeholder.textContent = "----問題形式を選んでください----";
        placeholder.disabled = false;
        placeholder.selected = true;
        sel.appendChild(placeholder);

        mainTypes.forEach(o => {
            const el = document.createElement('option');
            el.value = o.v;
            el.textContent = o.t;
            sel.appendChild(el);
        });

        // Use global shared logic to build subItems
        const getSubItems = (mainVal) => {
            if (mainVal === 'free') return [
                { v: 'free_written', t: APP_TEXT.Creator.TypeFreeWritten },
                { v: 'free_oral', t: APP_TEXT.Creator.TypeFreeOral },
                { v: 'letter_select', t: APP_TEXT.Creator.TypeLetterSelect }
            ];
            if (mainVal === 'multi_group') return [
                { v: 'multi_written', t: APP_TEXT.Creator.TypeMultiWritten },
                { v: 'multi_oral', t: APP_TEXT.Creator.TypeMultiOral },
                { v: 'ranking_written', t: APP_TEXT.Creator.TypeRankingWritten },
                { v: 'ranking_oral', t: APP_TEXT.Creator.TypeRankingOral }
            ];
            if (mainVal === 'choice') return [
                { v: 'choice_single', t: "2-1) 単一解答" },
                { v: 'choice_multi', t: "2-2) ダウト問題" }
            ];
            if (mainVal === 'assoc_group') return [
                { v: 'assoc_written', t: APP_TEXT.Creator.TypeAssocWritten },
                { v: 'assoc_oral', t: APP_TEXT.Creator.TypeAssocOral }
            ];
            if (mainVal === 'num_group') return [
                { v: 'blackjack', t: '6-1) ブラックジャック' }
            ];
            return [];
        };

        const updateSubTypes = (mainVal) => {
            subSel.innerHTML = '';
            let subItems = getSubItems(mainVal);

            subItems.forEach(o => {
                const el = document.createElement('option');
                el.value = o.v;
                el.textContent = o.t;
                subSel.appendChild(el);
            });
        };

        sel.onchange = (e) => {
            const val = e.target.value;
            if (!val) {
                subArea.classList.add('hidden');
                document.getElementById('creator-form-container').innerHTML = '';
                return;
            }
            if (val === 'free' || val === 'multi_group' || val === 'choice' || val === 'assoc_group' || val === 'num_group') {
                updateSubTypes(val);
                subArea.classList.remove('hidden');
                this.renderForm(subSel.value);
            } else {
                subArea.classList.add('hidden');
                this.renderForm(val);
            }
        };

        subSel.onchange = (e) => {
            this.renderForm(e.target.value);
        };
    },

    loadSet: function (key, item) {
        window.App.State.editingSetId = key;
        this.editingTitle = item.title || "";
        window.App.Data.createdQuestions = item.questions || [];

        const btnSave = document.getElementById('save-to-cloud-btn');
        if (btnSave) btnSave.textContent = APP_TEXT.Creator.BtnUpdate;

        this.setupTypeSelect();

        const sel = document.getElementById('creator-q-type');
        const subArea = document.getElementById('creator-q-subtype-area');
        const subSel = document.getElementById('creator-q-subtype');

        if (window.App.Data.createdQuestions.length > 0) {
            const firstQ = window.App.Data.createdQuestions[0];
            const type = firstQ.type;

            const updateSubTypesShared = (mainVal) => {
                subSel.innerHTML = '';
                let subItems = [];
                if (mainVal === 'free') {
                    subItems = [
                        { v: 'free_written', t: APP_TEXT.Creator.TypeFreeWritten },
                        { v: 'free_oral', t: APP_TEXT.Creator.TypeFreeOral },
                        { v: 'letter_select', t: APP_TEXT.Creator.TypeLetterSelect }
                    ];
                } else if (mainVal === 'multi_group') {
                    subItems = [
                        { v: 'multi_written', t: APP_TEXT.Creator.TypeMultiWritten },
                        { v: 'multi_oral', t: APP_TEXT.Creator.TypeMultiOral },
                        { v: 'ranking_written', t: APP_TEXT.Creator.TypeRankingWritten },
                        { v: 'ranking_oral', t: APP_TEXT.Creator.TypeRankingOral }
                    ];
                } else if (mainVal === 'choice') {
                    subItems = [
                        { v: 'choice_single', t: "2-1) 単一解答" },
                        { v: 'choice_multi', t: "2-2) ダウト問題" }
                    ];
                } else if (mainVal === 'assoc_group') {
                    subItems = [
                        { v: 'assoc_written', t: APP_TEXT.Creator.TypeAssocWritten },
                        { v: 'assoc_oral', t: APP_TEXT.Creator.TypeAssocOral }
                    ];
                }
                subItems.forEach(o => {
                    const el = document.createElement('option');
                    el.value = o.v;
                    el.textContent = o.t;
                    subSel.appendChild(el);
                });
            };

            if (type.startsWith('free') || type === 'letter_select') {
                sel.value = 'free';
                updateSubTypesShared('free');
                subArea.classList.remove('hidden');
                subSel.value = type;
            } else if (type.startsWith('multi') || type.startsWith('ranking')) {
                sel.value = 'multi_group';
                updateSubTypesShared('multi_group');
                subArea.classList.remove('hidden');
                subSel.value = type;
            } else if (type.startsWith('assoc')) {
                sel.value = 'assoc_group';
                updateSubTypesShared('assoc_group');
                subArea.classList.remove('hidden');
                subSel.value = type;
            } else if (type.startsWith('choice')) {
                sel.value = 'choice';
                updateSubTypesShared('choice');
                subArea.classList.remove('hidden');
                const isMulti = firstQ.multi || firstQ.mode === 'multi';
                subSel.value = isMulti ? 'choice_multi' : 'choice_single';
            } else if (type === 'blackjack') {
                sel.value = 'num_group';
                subSel.innerHTML = '';
                const bjOpt = document.createElement('option');
                bjOpt.value = 'blackjack'; bjOpt.textContent = '6-1) ブラックジャック';
                subSel.appendChild(bjOpt);
                subArea.classList.remove('hidden');
                subSel.value = 'blackjack';
            } else {
                sel.value = type;
                subArea.classList.add('hidden');
            }

            sel.disabled = true;
            subSel.disabled = true;
            document.getElementById('creator-type-locked-msg').classList.remove('hidden');

            if (document.getElementById('creator-set-layout')) document.getElementById('creator-set-layout').value = firstQ.layout || 'standard';
            if (window.updateAlignUI) window.updateAlignUI(firstQ.align || 'center');

            if (window.applyDesignToUI && firstQ.design) {
                window.applyDesignToUI(firstQ.design, firstQ.layout, firstQ.align);
            }
        } else {
            sel.disabled = false;
            subSel.disabled = false;
            subArea.classList.add('hidden');
            document.getElementById('creator-type-locked-msg').classList.add('hidden');
        }

        this.resetForm();
        this.renderList();
        window.App.Ui.showView(window.App.Ui.views.creator);
    },

    resetForm: function () {
        this.editingIndex = null;
        this.currentLetterSteps = [];

        document.getElementById('creator-form-title').textContent = APP_TEXT.Creator.HeadingNewQ;
        document.getElementById('add-question-btn').classList.remove('hidden');
        document.getElementById('question-text').value = '';
        document.getElementById('creator-commentary').value = '';

        const sel = document.getElementById('creator-q-type');
        const subSel = document.getElementById('creator-q-subtype');
        const type = (sel && (['free', 'multi_group', 'choice', 'assoc_group', 'num_group'].includes(sel.value))) ? subSel.value : (sel ? sel.value : 'choice');
        this.renderForm(type);
    },

    renderForm: function (type, data = null) {
        const container = document.getElementById('creator-form-container');
        const optionsExtra = document.getElementById('creator-options-extra');
        const optSubArea = document.getElementById('creator-opt-subtype-area');
        const optSubSel = document.getElementById('creator-opt-subtype');
        if (!container) return;
        container.innerHTML = '';
        // Reset to flex column so choice rows can use flex:1
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        // Clear add-button slot
        const addChoiceAreaReset = document.getElementById('creator-add-choice-area');
        if (addChoiceAreaReset) addChoiceAreaReset.innerHTML = '';
        if (optionsExtra) optionsExtra.innerHTML = '';
        if (optSubArea) optSubArea.classList.add('hidden');

        // Handle Choice Subtypes
        if (type === 'choice_single') {
            this.choiceSubtype = 'single';
            type = 'choice';
        } else if (type === 'choice_multi') {
            this.choiceSubtype = 'multi';
            type = 'choice';
        }

        // Setup sub-type dropdown in options for applicable types
        const setupOptSubtype = (items, currentVal) => {
            if (!optSubArea || !optSubSel) return;
            optSubSel.innerHTML = '';
            items.forEach(o => {
                const el = document.createElement('option');
                el.value = o.v; el.textContent = o.t;
                optSubSel.appendChild(el);
            });
            if (currentVal) optSubSel.value = currentVal;
            optSubArea.classList.remove('hidden');
            optSubSel.onchange = (e) => {
                this.renderForm(e.target.value);
            };
        };

        if (type === 'choice') {
            const subtype = this.choiceSubtype || 'single';
            const isDobon = (this.choiceSubtype === 'multi');
            const msg = isDobon ? "不正解をタップして選択" : "正解をタップして選択";

            // Sub-type in options
            setupOptSubtype([
                { v: 'choice_single', t: '単一解答' },
                { v: 'choice_multi', t: 'ダウト問題' }
            ], isDobon ? 'choice_multi' : 'choice_single');

            // Hint label inside the frame
            container.innerHTML = `
                <div style="text-align:center; color:rgba(255,255,255,0.25); font-size:0.7rem; margin-bottom:4px;">${msg}</div>
            `;

            // Choices list — flex column, each row gets flex:1 to auto-fill the container
            const choicesDiv = document.createElement('div');
            choicesDiv.id = 'creator-choices-list';
            choicesDiv.style.cssText = 'display:flex; flex-direction:column; gap:1%; flex:1; min-height:0; width:100%;';
            container.appendChild(choicesDiv);

            if (data) {
                if (data.multi) this.choiceSubtype = 'multi';
                else this.choiceSubtype = 'single';
                data.c.forEach((txt, i) => this.addChoiceInput(choicesDiv, i, txt, data.correct.includes(i)));
            }
            else for (let i = 0; i < 4; i++) this.addChoiceInput(choicesDiv, i);

            // Add choice button → placed in the #creator-add-choice-area slot inside the 16:9 frame
            const addChoiceArea = document.getElementById('creator-add-choice-area');
            if (addChoiceArea) {
                addChoiceArea.innerHTML = '';
                const addBtn = document.createElement('button');
                addBtn.textContent = '＋ 選択肢を追加';
                addBtn.style.cssText = 'background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.35); border-radius:6px; color:#00e5ff; padding:3px 14px; cursor:pointer; font-size:0.7rem;';
                addBtn.onclick = () => this.addChoiceInput(choicesDiv);
                addChoiceArea.appendChild(addBtn);
            }

            // Shuffle option in options panel
            if (optionsExtra) {
                optionsExtra.innerHTML += `
                    <div style="margin-bottom:12px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#94a3b8; font-size:0.9rem;">
                            <input type="checkbox" id="choice-shuffle-chk" ${data?.shuffle !== false ? 'checked' : ''}>
                            <span>選択肢をシャッフルする</span>
                        </label>
                    </div>
                `;
            }
        }

        // --- 文字選択式 ---
        else if (type === 'letter_select') {
            if (data && data.steps) {
                this.currentLetterSteps = JSON.parse(JSON.stringify(data.steps));
            } else if (this.currentLetterSteps.length === 0) {
                this.currentLetterSteps = [];
            }

            container.innerHTML = `
                <div style="text-align:center; color:#64748b; font-size:0.8rem; margin-bottom:10px;">1文字ずつ正解とダミーを設定</div>
                <div id="letter-step-container" class="letter-step-list"></div>
            `;
            this.renderLetterStepList();

            // Sub-type
            setupOptSubtype([
                { v: 'free_written', t: '記述式（自由入力・自動判定）' },
                { v: 'free_oral', t: '口頭解答（口頭・司会判定）' },
                { v: 'letter_select', t: '文字パネル（自由入力・自動判定）' }
            ], 'letter_select');
        }

        else if (type === 'sort') {
            container.innerHTML = `
                <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:6px;">
                    <button id="btn-reset-sort-ranks" style="background:rgba(255,255,255,0.08); border:1px solid #555; border-radius:6px; color:#aaa; padding:3px 10px; font-size:0.75rem; cursor:pointer;">順序リセット</button>
                </div>
            `;
            const sortDiv = document.createElement('div');
            sortDiv.style.cssText = 'display:flex; flex-direction:column; gap:min(8px,1.5vw); width:100%;';
            container.appendChild(sortDiv);

            document.getElementById('btn-reset-sort-ranks').onclick = () => this.resetSortRanks(sortDiv);

            if (data) {
                const orderStr = data.correct || "";
                let maxR = 0;
                data.c.forEach((txt, i) => {
                    const label = String.fromCharCode(65 + i);
                    const r = orderStr.indexOf(label);
                    const rank = (r >= 0) ? r + 1 : "";
                    if (rank > maxR) maxR = rank;
                    this.addSortInput(sortDiv, i, txt, rank || "");
                });
                this.nextSortRank = maxR + 1;
            } else {
                this.nextSortRank = 1;
                for (let i = 0; i < 4; i++) this.addSortInput(sortDiv, i);
            }

            const addBtnWrap = document.createElement('div');
            addBtnWrap.style.cssText = 'text-align:center; margin-top:10px;';
            const addBtn = document.createElement('button');
            addBtn.textContent = '＋ 項目を追加';
            addBtn.style.cssText = 'background:rgba(0,229,255,0.1); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:8px 20px; cursor:pointer; font-size:0.9rem;';
            addBtn.onclick = () => this.addSortInput(sortDiv);
            addBtnWrap.appendChild(addBtn);
            container.appendChild(addBtnWrap);

            // Shuffle option in options panel
            if (optionsExtra) {
                optionsExtra.innerHTML += `
                    <div style="margin-bottom:12px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#94a3b8; font-size:0.9rem;">
                            <input type="checkbox" id="sort-shuffle-chk" ${data?.shuffle !== false ? 'checked' : ''}>
                            <span>選択肢をシャッフルする</span>
                        </label>
                    </div>
                `;
            }
        }
        else if (type.startsWith('free')) {
            container.innerHTML = `
                <div style="padding:10px;">
                    <div style="text-align:center; color:#64748b; font-size:0.8rem; margin-bottom:10px;">正解キーワードを入力</div>
                    <input type="text" id="creator-text-answer" placeholder="キーワード（複数ある場合はカンマ区切り）" style="
                        width:100%; padding:12px; background:#0d1b2a; border:1px dashed rgba(255,255,255,0.25);
                        border-radius:8px; color:#fff; font-size:1rem; text-align:center; outline:none; box-sizing:border-box;
                    ">
                </div>
            `;
            const input = container.querySelector('#creator-text-answer');
            if (data && data.correct) {
                input.value = Array.isArray(data.correct) ? data.correct.join(', ') : data.correct;
            }

            // Sub-type
            setupOptSubtype([
                { v: 'free_written', t: '記述式（自由入力・自動判定）' },
                { v: 'free_oral', t: '口頭解答（口頭・司会判定）' },
                { v: 'letter_select', t: '文字パネル（自由入力・自動判定）' }
            ], type);
        }
        else if (type.startsWith('assoc')) {
            container.innerHTML = `
                <div style="padding:10px;">
                    <div style="text-align:center; color:#64748b; font-size:0.8rem; margin-bottom:10px;">正解キーワード</div>
                    <input type="text" id="creator-assoc-answer" placeholder="キーワード（複数ある場合はカンマ区切り）" style="
                        width:100%; padding:12px; background:#0d1b2a; border:1px dashed rgba(255,255,255,0.25);
                        border-radius:8px; color:#fff; font-size:1rem; text-align:center; outline:none; box-sizing:border-box; margin-bottom:14px;
                    ">
                    <div style="text-align:center; color:#64748b; font-size:0.8rem; margin-bottom:8px;">ヒントを入力（順番に開示）</div>
                </div>
            `;

            const assocAnsInput = container.querySelector('#creator-assoc-answer');
            if (data && data.correct) {
                assocAnsInput.value = Array.isArray(data.correct) ? data.correct.join(', ') : data.correct;
            }

            const assocDiv = document.createElement('div');
            assocDiv.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:0 10px;';
            container.appendChild(assocDiv);

            if (data && data.c) {
                data.c.forEach((txt, i) => this.addAssocInput(assocDiv, i, txt));
            } else {
                for (let i = 0; i < 5; i++) this.addAssocInput(assocDiv, i, '');
            }

            const addBtnWrap = document.createElement('div');
            addBtnWrap.style.cssText = 'text-align:center; margin-top:10px;';
            const addBtn = document.createElement('button');
            addBtn.textContent = '＋ ヒントを追加';
            addBtn.style.cssText = 'background:rgba(0,229,255,0.1); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:8px 20px; cursor:pointer; font-size:0.9rem;';
            addBtn.onclick = () => this.addAssocInput(assocDiv, undefined, '');
            addBtnWrap.appendChild(addBtn);
            container.appendChild(addBtnWrap);

            // Sub-type
            setupOptSubtype([
                { v: 'assoc_written', t: '連想記述式（自由入力・司会判定）' },
                { v: 'assoc_oral', t: '連想口頭式（口頭・司会判定）' }
            ], type);
        }
        else if (type.startsWith('multi') || type.startsWith('ranking')) {
            const isRanking = type.startsWith('ranking');
            const descText = isRanking ? '1位から順番に入力' : '全ての正解を入力';

            container.innerHTML = `
                <div style="text-align:center; color:#64748b; font-size:0.8rem; margin-bottom:10px; padding-top:6px;">${descText}</div>
            `;
            const multiDiv = document.createElement('div');
            multiDiv.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:0 10px;';
            container.appendChild(multiDiv);

            if (data) data.c.forEach((txt, i) => this.addMultiInput(multiDiv, i, txt, isRanking));
            else for (let i = 0; i < 5; i++) this.addMultiInput(multiDiv, i, '', isRanking);

            const addBtnWrap = document.createElement('div');
            addBtnWrap.style.cssText = 'text-align:center; margin-top:10px;';
            const addBtnText = isRanking ? '＋ ランキングを追加' : '＋ 正解を追加';
            const addBtn = document.createElement('button');
            addBtn.textContent = addBtnText;
            addBtn.style.cssText = 'background:rgba(0,229,255,0.1); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:8px 20px; cursor:pointer; font-size:0.9rem;';
            addBtn.onclick = () => this.addMultiInput(multiDiv, undefined, '', isRanking);
            addBtnWrap.appendChild(addBtn);
            container.appendChild(addBtnWrap);

            // Sub-type
            setupOptSubtype([
                { v: 'multi_written', t: '記述式（自由入力・司会判定）' },
                { v: 'multi_oral', t: '口頭解答（口頭・司会判定）' },
                { v: 'ranking_written', t: 'ランキング記述式（自由入力・司会判定）' },
                { v: 'ranking_oral', t: 'ランキング口頭式（口頭・司会判定）' }
            ], type);
        }
        else if (type === 'blackjack') {
            const targetVal = data ? data.target : 21;
            container.innerHTML = `
                <div style="padding:10px;">
                    <div style="text-align:center; color:#64748b; font-size:0.8rem; margin-bottom:10px;">目標数字を設定してカードを追加</div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:14px;">
                        <span style="color:#94a3b8;">ターゲット:</span>
                        <input type="number" id="bj-target" value="${targetVal}" min="1" max="999" style="
                            width:80px; padding:8px; background:#0d1b2a; border:1px solid #475569;
                            border-radius:8px; color:#ffd700; font-size:1.2rem; font-weight:bold; text-align:center;
                        ">
                    </div>
                </div>
            `;
            const bjDiv = document.createElement('div');
            bjDiv.id = 'bj-cards-list';
            bjDiv.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 10px;';
            container.appendChild(bjDiv);

            if (data && data.c) {
                data.c.forEach((txt, i) => this.addBjCardInput(bjDiv, i, txt, data.values[i]));
            } else {
                for (let i = 0; i < 4; i++) this.addBjCardInput(bjDiv, i, '', '');
            }

            const addBtnWrap = document.createElement('div');
            addBtnWrap.style.cssText = 'text-align:center; margin-top:10px;';
            const addBtn = document.createElement('button');
            addBtn.textContent = '＋ カードを追加';
            addBtn.style.cssText = 'background:rgba(0,229,255,0.1); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:8px 20px; cursor:pointer; font-size:0.9rem;';
            addBtn.onclick = () => this.addBjCardInput(bjDiv, undefined, '', '');
            addBtnWrap.appendChild(addBtn);
            container.appendChild(addBtnWrap);
        }
    },

    // --- Choice Input: viewer .choice-item style (full-width horizontal row) ---
    addChoiceInput: function (parent, index, text = "", checked = false) {
        const limit = (this.choiceSubtype === 'multi') ? 36 : 20;
        if (parent.children.length >= limit) { alert(`選択肢の上限は${limit}個までです`); return; }

        const idx = (index !== undefined) ? index : parent.children.length;
        const labels = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];
        const label = labels[idx] || String(idx + 1);

        const row = document.createElement('div');
        row.className = 'choice-row';
        // Mirrors viewer .choice-item: semi-transparent background, slight bottom border
        row.style.cssText = `
            display:flex; align-items:center;
            background:linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%);
            border-bottom:1px solid rgba(255,255,255,0.1);
            border-radius:6px;
            cursor:pointer; transition:background 0.2s;
            flex:1; min-height:0; overflow:hidden;
            ${checked ? 'background:linear-gradient(90deg,rgba(0,229,255,0.12) 0%,transparent 100%);' : ''}
        `;
        row.onmouseenter = () => {
            if (!chk.checked) row.style.background = 'linear-gradient(90deg,rgba(255,255,255,0.08) 0%,transparent 100%)';
        };
        row.onmouseleave = () => {
            row.style.background = chk.checked
                ? 'linear-gradient(90deg,rgba(0,229,255,0.12) 0%,transparent 100%)'
                : 'linear-gradient(90deg,rgba(255,255,255,0.04) 0%,transparent 100%)';
        };

        // Label badge — mirrors viewer .choice-prefix
        const labelSpan = document.createElement('span');
        labelSpan.className = 'choice-label-text';
        labelSpan.style.cssText = `
            color:#00e5ff; font-weight:900;
            font-family:'Arial Black',sans-serif;
            margin-right:min(16px,3vw);
            font-size:min(1.1rem,3vw);
            min-width:min(22px,4vw);
            text-shadow:0 0 8px rgba(0,229,255,0.4);
        `;
        labelSpan.textContent = label;

        // Editable text field
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'choice-text-input';
        inp.placeholder = `選択肢 ${label}`;
        inp.value = text;
        inp.style.cssText = `
            flex:1; background:transparent; border:none;
            color:#ddd; font-size:min(1rem,2.8vw);
            outline:none; padding:2px 0;
        `;
        inp.onfocus = () => inp.style.color = '#fff';
        inp.onblur  = () => inp.style.color = '#ddd';

        // Correct-answer toggle
        const inputType = (this.choiceSubtype === 'single') ? 'radio' : 'checkbox';
        const chk = document.createElement('input');
        chk.type  = inputType;
        chk.name  = 'creator-choice-correct-group';
        chk.className = 'choice-correct-chk';
        chk.checked = checked;
        chk.title = '正解に設定';
        chk.style.cssText = 'transform:scale(1.3); cursor:pointer; margin-left:8px; flex-shrink:0;';

        chk.onchange = () => {
            row.style.background = chk.checked
                ? 'linear-gradient(90deg,rgba(0,229,255,0.12) 0%,transparent 100%)'
                : 'linear-gradient(90deg,rgba(255,255,255,0.04) 0%,transparent 100%)';
        };

        // Click row body to toggle correct
        row.onclick = (e) => {
            if (e.target === inp || e.target === delBtn || e.target === chk) return;
            chk.checked = (inputType === 'radio') ? true : !chk.checked;
            chk.dispatchEvent(new Event('change'));
        };

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.style.cssText = 'background:none; border:none; color:rgba(255,255,255,0.25); font-size:0.9rem; cursor:pointer; padding:2px 4px; margin-left:4px; flex-shrink:0;';
        delBtn.title = '削除';
        delBtn.onclick = (e) => { e.stopPropagation(); row.remove(); this.updateLabels(parent); this.updateChoiceSizes(parent); };

        row.appendChild(labelSpan);
        row.appendChild(inp);
        row.appendChild(chk);
        row.appendChild(delBtn);

        parent.appendChild(row);
        this.updateLabels(parent);
        this.updateChoiceSizes(parent);
    },

    addSortInput: function (parent, index, text = "", rank = "") {
        if (parent.children.length >= 20) { alert("並べ替え問題の上限は20個までです"); return; }
        const row = document.createElement('div');
        row.className = 'sort-row';
        // Same viewer-style horizontal row
        row.style.cssText = `
            display:flex; align-items:center;
            background:linear-gradient(90deg,rgba(255,255,255,0.04) 0%,transparent 100%);
            border-bottom:1px solid rgba(255,255,255,0.1);
            border-radius:6px;
            padding:min(8px,1.8vw) min(10px,2vw);
        `;

        row.innerHTML = `
            <span class="sort-label" style="color:#00e5ff;font-weight:900;font-family:'Arial Black',sans-serif;margin-right:min(16px,3vw);font-size:min(1.1rem,3vw);min-width:min(22px,4vw);text-shadow:0 0 8px rgba(0,229,255,0.4);">${String.fromCharCode(65 + index)}</span>
            <input type="text" class="sort-text-input" placeholder="項目を入力" value="${text}" style="flex:1;background:transparent;border:none;color:#ddd;font-size:min(1rem,2.8vw);outline:none;padding:2px 0;">
            <div class="sort-rank-box" style="width:min(36px,5vw);height:min(36px,5vw);border:2px solid #444;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:900;font-size:min(1rem,2.5vw);color:#00e5ff;background:rgba(0,0,0,0.3);margin-left:8px;flex-shrink:0;">
                ${rank || ''}
            </div>
            <input type="hidden" class="sort-order-input" value="${rank || ''}">
            <button class="btn-remove-sort" style="background:none;border:none;color:rgba(255,255,255,0.25);font-size:0.9rem;cursor:pointer;padding:2px 4px;margin-left:4px;flex-shrink:0;">×</button>
        `;

        // Bind events
        const rankBox = row.querySelector('.sort-rank-box');
        const hidden = row.querySelector('.sort-order-input');
        rankBox.onclick = () => {
            if (hidden.value) return;
            hidden.value = this.nextSortRank;
            rankBox.textContent = this.nextSortRank;
            rankBox.style.borderColor = 'var(--color-primary)';
            this.nextSortRank++;
        };

        row.querySelector('.btn-remove-sort').onclick = () => {
            row.remove();
            this.updateSortLabels(parent);
            this.resetSortRanks(parent);
        };
        parent.appendChild(row);
        this.updateSortLabels(parent);
    },

    updateSortLabels: function (parent) {
        parent.querySelectorAll('.sort-row').forEach((row, i) => {
            const label = row.querySelector('.sort-label');
            if (label) label.textContent = String.fromCharCode(65 + i);
            // Also update radio value if single
            const radio = row.querySelector('input[type="radio"]');
            if (radio) radio.value = i;
        });
    },

    resetSortRanks: function (parent) {
        this.nextSortRank = 1;
        parent.querySelectorAll('.sort-row').forEach(row => {
            row.querySelector('.sort-order-input').value = "";
            const box = row.querySelector('.sort-rank-box');
            box.textContent = "";
            box.style.borderColor = "#444";
        });
    },

    addMultiInput: function (parent, index, text = "", isRanking = false) {
        const idx = (index !== undefined) ? index : parent.children.length;
        const row = document.createElement('div');
        row.className = 'flex-center gap-5';
        const labelText = isRanking ? `${idx + 1}位` : `${idx + 1}`;
        const placeholder = isRanking ? `${idx + 1}位の答え` : 'Answer';
        row.innerHTML = `
            <span class="bold cyan text-lg" style="min-width:35px; text-align:center;">${labelText}</span>
            <input type="text" class="multi-text-input flex-1" placeholder="${placeholder}" value="${text}">
            <button class="btn-mini btn-dark w-30">×</button>
        `;
        row.querySelector('button').onclick = () => row.remove();
        parent.appendChild(row);
    },

    addAssocInput: function (parent, index, text = "") {
        const idx = (index !== undefined) ? index : parent.children.length;
        const row = document.createElement('div');
        row.className = 'flex-center gap-5';
        row.innerHTML = `
            <span class="bold cyan text-lg" style="min-width:45px; text-align:center;">ヒント${idx + 1}</span>
            <input type="text" class="assoc-text-input flex-1" placeholder="ヒント内容" value="${text}">
            <button class="btn-mini btn-dark w-30">×</button>
        `;
        row.querySelector('button').onclick = () => {
            row.remove();
            // Re-index remaining association inputs
            Array.from(parent.children).forEach((r, i) => {
                r.querySelector('span').textContent = `ヒント${i + 1}`;
            });
        };
        parent.appendChild(row);
    },

    addBjCardInput: function (parent, index, text = "", value = "") {
        const idx = (index !== undefined) ? index : parent.children.length;
        const row = document.createElement('div');
        row.className = 'flex-center gap-5';
        row.innerHTML = `
            <span class="bold cyan text-lg" style="min-width:45px; text-align:center;">Card${idx + 1}</span>
            <input type="text" class="bj-card-text flex-1" placeholder="カード名（例: 7）" value="${text}">
            <input type="number" class="bj-card-value" placeholder="数値" value="${value}" style="width:80px;">
            <button class="btn-mini btn-dark w-30">×</button>
        `;
        row.querySelector('button').onclick = () => {
            row.remove();
            Array.from(parent.children).forEach((r, i) => {
                r.querySelector('span').textContent = `Card${i + 1}`;
            });
        };
        parent.appendChild(row);
    },

    createAddBtn: function (parent, text, onClick) {
        const btn = document.createElement('button');
        btn.className = 'btn-info btn-mini mt-10';
        btn.textContent = text;
        btn.onclick = onClick;
        parent.appendChild(btn);
    },

    updateLabels: function (parent) {
        const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
        parent.querySelectorAll('.choice-label-text').forEach((el, i) => el.textContent = labels[i] || String(i + 1));
        // Update placeholder text too
        parent.querySelectorAll('.choice-text-input').forEach((inp, i) => {
            const label = labels[i] || String(i + 1);
            inp.placeholder = `選択肢${label}`;
        });
        this.updateChoiceSizes(parent);
    },

    // Dynamically scale row padding & font so N choices always fit inside the 16:9 frame
    updateChoiceSizes: function (parent) {
        if (!parent) return;
        const rows = parent.querySelectorAll('.choice-row');
        const n = rows.length;
        if (n === 0) return;

        // The 16:9 frame's pixel height at current viewport
        const frame = document.getElementById('creator-monitor-preview');
        const frameH = frame ? frame.offsetHeight : 400;

        // Reserve ~32% for question box + label + add-btn + gaps
        const choicesAreaH = frameH * 0.60;
        const rowH = Math.max(20, (choicesAreaH / n) - 2); // 2px gap

        // Vertical padding: at most 12% of rowH each side
        const vPad = Math.min(8, rowH * 0.12);
        // Font size: roughly 40% of rowH, clamped
        const fs = Math.max(9, Math.min(16, rowH * 0.40));

        rows.forEach(row => {
            row.style.padding = `${vPad}px 10px`;
            // Scale label and input fonts
            const label = row.querySelector('.choice-label-text');
            const inp   = row.querySelector('.choice-text-input');
            if (label) label.style.fontSize = `${Math.max(10, fs)}px`;
            if (inp)   inp.style.fontSize   = `${Math.max(9, fs - 1)}px`;
        });
    },


    getData: function () {
        const qText = document.getElementById('question-text').value.trim();
        if (!qText) { alert(APP_TEXT.Creator.AlertNoQ); return null; }
        const sel = document.getElementById('creator-q-type');
        const subSel = document.getElementById('creator-q-subtype');

        let rawType = (sel && (['free', 'multi_group', 'choice', 'assoc_group', 'num_group'].includes(sel.value))) ? subSel.value : (sel ? sel.value : 'choice');
        let normalizedType = rawType;
        let choiceMode = 'single';

        if (rawType === 'choice_single') {
            normalizedType = 'choice';
            choiceMode = 'single';
        } else if (rawType === 'choice_multi') {
            normalizedType = 'choice';
            choiceMode = 'multi';
        }

        let newQ = {
            q: qText,
            type: normalizedType,
            commentary: document.getElementById('creator-commentary').value
        };

        if (normalizedType === 'choice') {
            const rows = document.querySelectorAll('.choice-row');
            const opts = [], corr = [];
            rows.forEach((row, i) => {
                const val = row.querySelector('.choice-text-input').value.trim();
                if (val) {
                    opts.push(val);
                    if (row.querySelector('.choice-correct-chk').checked) corr.push(opts.length - 1);
                }
            });
            if (opts.length < 2 || corr.length === 0) { alert(APP_TEXT.Creator.AlertLessChoice); return null; }
            newQ.c = opts; newQ.correct = corr; newQ.correctIndex = corr[0];

            // Use explicit mode from dropdown
            newQ.mode = choiceMode;
            newQ.multi = (newQ.mode === 'multi');

            // Save shuffle setting
            const shuffleChk = document.getElementById('choice-shuffle-chk');
            newQ.shuffle = shuffleChk ? shuffleChk.checked : true;

        }
        else if (normalizedType === 'letter_select') {
            if (this.currentLetterSteps.length === 0) {
                alert("少なくとも1文字のステップを作成してください");
                return null;
            }
            newQ.steps = this.currentLetterSteps;
            newQ.correct = this.currentLetterSteps.map(s => s.correct).join('');

        } else if (normalizedType === 'sort') {
            const opts = [];
            const items = [];
            let allRanked = true;

            document.querySelectorAll('.sort-row').forEach((row, i) => {
                const txt = row.querySelector('.sort-text-input').value.trim();
                if (txt) {
                    opts.push(txt);
                    const label = String.fromCharCode(65 + i);
                    const rankVal = row.querySelector('.sort-order-input').value;
                    const rank = parseInt(rankVal);
                    if (!rankVal) allRanked = false;
                    items.push({ label, rank });
                }
            });

            if (opts.length < 2) return null;
            newQ.c = opts;

            if (!allRanked) {
                alert("すべての項目の並び順（番号）を指定してください。");
                return null;
            }
            items.sort((a, b) => a.rank - b.rank);
            newQ.correct = items.map(o => o.label).join('');

            const sortShuffleChk = document.getElementById('sort-shuffle-chk');
            const doShuffle = sortShuffleChk ? sortShuffleChk.checked : true;
            newQ.initialOrder = doShuffle ? 'random' : 'fixed';
            newQ.shuffle = doShuffle;
        } else if (normalizedType.startsWith('free')) {
            const ans = document.getElementById('creator-text-answer').value.trim();
            if (normalizedType === 'free_written' && !ans) { alert(APP_TEXT.Creator.AlertNoTextAns); return null; }
            newQ.correct = ans ? ans.split(',').map(s => s.trim()).filter(s => s) : [];
        } else if (normalizedType.startsWith('assoc')) {
            const ans = document.getElementById('creator-assoc-answer').value.trim();
            if (normalizedType === 'assoc_written' && !ans) { alert(APP_TEXT.Creator.AlertNoTextAns); return null; }
            newQ.correct = ans ? ans.split(',').map(s => s.trim()).filter(s => s) : [];

            const opts = [];
            document.querySelectorAll('.assoc-text-input').forEach(inp => { if (inp.value.trim()) opts.push(inp.value.trim()); });
            if (opts.length < 1) return null; // require at least 1 hint maybe? or 5? Let's say at least 1 for flexibility.
            newQ.c = opts;
        } else if (normalizedType.startsWith('multi') || normalizedType.startsWith('ranking')) {
            const opts = [];
            document.querySelectorAll('.multi-text-input').forEach(inp => { if (inp.value.trim()) opts.push(inp.value.trim()); });
            if (opts.length < 1) return null;
            newQ.c = opts; newQ.correct = opts;
        } else if (normalizedType === 'blackjack') {
            const target = parseInt(document.getElementById('bj-target')?.value) || 21;
            const cardTexts = [], cardValues = [];
            document.querySelectorAll('#bj-cards-list .bj-card-text').forEach((inp, i) => {
                const valInp = document.querySelectorAll('#bj-cards-list .bj-card-value')[i];
                const txt = inp.value.trim();
                const val = parseInt(valInp?.value) || 0;
                if (txt) { cardTexts.push(txt); cardValues.push(val); }
            });
            if (cardTexts.length < 2) { alert('カードを2枚以上追加してください'); return null; }
            newQ.target = target;
            newQ.c = cardTexts;
            newQ.values = cardValues;
        }
        return newQ;
    },

    add: function () {
        const q = this.getData();
        if (q) {
            // ★ 新規追加時のみデフォルト値を設定
            q.points = 1;
            q.loss = 0;
            q.timeLimit = 0;
            q.layout = 'standard';
            q.align = 'center';

            window.App.Data.createdQuestions.push(q);
            this.resetForm();
            this.renderList();
            window.App.Ui.showToast(APP_TEXT.Creator.MsgAddedToast);
            document.getElementById('creator-q-type').disabled = true;
            document.getElementById('creator-q-subtype').disabled = true;
            document.getElementById('creator-type-locked-msg').classList.remove('hidden');
        }
    },

    update: function () {
        if (this.editingIndex === null) return;
        const q = this.getData();
        if (q) {
            window.App.Data.createdQuestions[this.editingIndex] = { ...window.App.Data.createdQuestions[this.editingIndex], ...q };
            this.resetForm();
            this.renderList();
            window.App.Ui.showToast(APP_TEXT.Creator.MsgUpdatedToast);
        }
    },

    edit: function (index) {
        // Save current edits if leaving another editing question
        if (this.editingIndex !== null && this.editingIndex !== index) {
            const currentQ = this.getData();
            if (currentQ) {
                window.App.Data.createdQuestions[this.editingIndex] = { ...window.App.Data.createdQuestions[this.editingIndex], ...currentQ };
            }
        }

        this.editingIndex = index;
        const q = window.App.Data.createdQuestions[index];
        document.getElementById('creator-form-title').textContent = APP_TEXT.Creator.HeadingEditQ;
        document.getElementById('add-question-btn').classList.add('hidden');
        document.getElementById('question-text').value = q.q;
        document.getElementById('creator-commentary').value = q.commentary || '';
        this.renderForm(q.type, q);
        document.getElementById('creator-list-modal')?.classList.add('hidden');
        document.getElementById('creator-view').scrollIntoView({ behavior: "smooth" });
    },

    delete: function (index) {
        if (confirm(APP_TEXT.Dashboard.DeleteConfirm)) {
            window.App.Data.createdQuestions.splice(index, 1);
            if (this.editingIndex === index) this.resetForm();
            this.renderList();
            if (window.App.Data.createdQuestions.length === 0) {
                document.getElementById('creator-q-type').disabled = false;
                document.getElementById('creator-type-locked-msg').classList.add('hidden');
                this.renderForm(document.getElementById('creator-q-type').value);
            }
        }
    },

    move: function (index, dir) {
        if ((dir === -1 && index > 0) || (dir === 1 && index < window.App.Data.createdQuestions.length - 1)) {
            const arr = window.App.Data.createdQuestions;
            [arr[index], arr[index + dir]] = [arr[index + dir], arr[index]];
            this.renderList();
        }
    },

    renderList: function () {
        const list = document.getElementById('q-list');
        list.innerHTML = '';
        window.App.Data.createdQuestions.forEach((q, i) => {
            const div = document.createElement('div');
            div.className = 'q-list-item flex-between';
            const displayQ = q.q.length > 15 ? q.q.substring(0, 15) + "..." : q.q;
            const shuffleIcon = (q.type === 'choice' || q.type === 'sort') && q.shuffle !== false ? ' 🔀' : '';
            div.innerHTML = `
                <div class="text-sm bold">Q${i + 1}. ${displayQ}${shuffleIcon}</div>
                <div class="flex gap-5">
                    <button class="btn-mini btn-dark" onclick="window.App.Creator.move(${i}, -1)">↑</button>
                    <button class="btn-mini btn-dark" onclick="window.App.Creator.move(${i}, 1)">↓</button>
                    <button class="btn-mini btn-info" onclick="window.App.Creator.edit(${i})">Edit</button>
                    <button class="btn-mini btn-danger" onclick="window.App.Creator.delete(${i})">×</button>
                </div>
            `;
            list.appendChild(div);
        });

        // Update badge
        const badge = document.getElementById('creator-cart-badge');
        if (badge) {
            const count = window.App.Data.createdQuestions.length;
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    },

    save: function () {
        if (this.editingIndex !== null) {
            const currentQ = this.getData();
            if (currentQ) {
                window.App.Data.createdQuestions[this.editingIndex] = { ...window.App.Data.createdQuestions[this.editingIndex], ...currentQ };
            }
        }

        console.log("Save initiated. Questions:", window.App.Data.createdQuestions.length);
        if (window.App.Data.createdQuestions.length === 0) {
            alert('問題がありません。追加してください。');
            return;
        }

        const title = prompt("セット名を入力してください:", this.editingTitle || "");
        if (!title) return;

        let showId = window.App.State.currentShowId;
        if (!showId) showId = sessionStorage.getItem('qs_show_id');

        if (!showId) {
            alert("エラー: 番組IDの取得に失敗しました。一度ダッシュボードに戻ってから再度お試しください。");
            return;
        }
        // Sanitize showId: remove dots and other problematic characters
        showId = showId.trim().toUpperCase().replace(/[\.\$#\[\]\/]/g, "");

        const layoutEl = document.getElementById('creator-set-layout');
        const alignEl = document.getElementById('creator-set-align');
        const layout = layoutEl ? layoutEl.value : 'standard';
        const align = alignEl ? alignEl.value : 'center';
        const designData = window.collectDesignSettings ? window.collectDesignSettings() : { design: {} };
        const design = designData.design || {};

        // Apply defaults to questions
        window.App.Data.createdQuestions.forEach(q => {
            if (!q.layout) q.layout = layout;
            if (!q.align) q.align = align;
            if (!q.design) q.design = design;
            q.specialMode = q.specialMode || 'none';
        });

        const data = {
            title: title,
            questions: window.App.Data.createdQuestions,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        const setId = window.App.State.editingSetId;
        const baseRef = window.db.ref("saved_sets").child(showId);
        const ref = setId ? baseRef.child(setId) : baseRef.push();

        if (!setId) {
            // Check if any question is Dobon/Multi/Blackjack -> Default to 'turn'
            const hasDobon = window.App.Data.createdQuestions.some(q => q.mode === 'dobon' || q.mode === 'multi');
            const hasBlackjack = window.App.Data.createdQuestions.some(q => q.type === 'blackjack');
            const hasOneOnOne = window.App.Data.createdQuestions.some(q => ['free_oral', 'free_written', 'letter_select'].includes(q.type));

            let defaultMode = 'normal';
            if (hasDobon || hasBlackjack) {
                defaultMode = 'turn';
            } else if (hasOneOnOne) {
                defaultMode = 'buzz';
            }

            data.config = { mode: defaultMode, gameType: 'score', theme: 'light' };
            data.createdAt = firebase.database.ServerValue.TIMESTAMP;
        }

        console.log("Saving to path:", ref.toString());

        const op = setId ? ref.update(data) : ref.set(data);

        op.then(() => {
            console.log("Save successful");
            window.App.Ui.showToast("保存しました");
            window.App.State.editingSetId = null;
            this.editingTitle = "";
            window.App.Data.createdQuestions = [];
            const sel = document.getElementById('creator-q-type');
            if (sel) {
                sel.value = "";
                sel.disabled = false;
            }
            const subSel = document.getElementById('creator-q-subtype');
            if (subSel) subSel.disabled = false;
            document.getElementById('creator-q-subtype-area')?.classList.add('hidden');
            document.getElementById('creator-type-locked-msg')?.classList.add('hidden');
            document.getElementById('creator-form-container').innerHTML = '';
            this.resetForm();
            this.renderList();
        }).catch(err => {
            console.error("Save error:", err);
            let msg = "保存エラーが発生しました。\n\n";
            if (err.code === "PERMISSION_DENIED") {
                msg += "原因: データベースのアクセス権限がありません。\nFirebaseコンソールの『ルール』が30日間のテストモード期限切れなどで制限されていないか確認してください。";
            } else {
                msg += "原因: " + err.message;
            }
            alert(msg);
        });
    }
};

window.initCreatorMode = () => window.App.Creator.init();
window.loadSetForEditing = (k, i) => window.App.Creator.loadSet(k, i);
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('add-question-btn')?.addEventListener('click', () => window.App.Creator.add());
    document.getElementById('update-question-btn')?.addEventListener('click', () => window.App.Creator.update());
    // Setup modal toggles
    document.getElementById('creator-cart-btn')?.addEventListener('click', () => {
        if (window.App.Creator.editingIndex !== null) {
            const currentQ = window.App.Creator.getData();
            if (currentQ) {
                window.App.Data.createdQuestions[window.App.Creator.editingIndex] = { ...window.App.Data.createdQuestions[window.App.Creator.editingIndex], ...currentQ };
                window.App.Creator.renderList();
            }
            window.App.Creator.resetForm();
        }
        document.getElementById('creator-list-modal').classList.remove('hidden');
    });
    document.getElementById('creator-list-close-btn')?.addEventListener('click', () => {
        document.getElementById('creator-list-modal').classList.add('hidden');
    });
    document.getElementById('creator-list-close-icon')?.addEventListener('click', () => {
        document.getElementById('creator-list-modal').classList.add('hidden');
    });

    document.getElementById('cancel-update-btn')?.addEventListener('click', () => window.App.Creator.resetForm());
    document.getElementById('save-to-cloud-btn')?.addEventListener('click', () => window.App.Creator.save());
});
