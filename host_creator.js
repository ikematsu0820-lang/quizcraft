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
        this.activeInlinePanel = null;
        window.App.Data.createdQuestions = [];
        window.App.Data.currentConfig = window.App.Config
            ? JSON.parse(JSON.stringify(window.App.Config.DEFAULT_CONFIG))
            : {};
        window.App.Data.currentDesign = window.App.Design
            ? JSON.parse(JSON.stringify(window.App.Design.defaultsWithSavedSounds()))
            : {};
        window.App.State.editingSetId = null;
        this.currentLetterSteps = [];

        const showIdEl = document.getElementById('creator-show-id');
        if (showIdEl) showIdEl.textContent = window.App.State.currentShowId || '---';

        const btnSave = document.getElementById('save-to-cloud-btn');
        if (btnSave) btnSave.textContent = APP_TEXT.Creator.BtnSave;

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
            // Group types ('free', 'choice', 'multi_group', 'assoc_group',
            // 'num_group') aren't renderable on their own — they need a
            // resolved leaf subtype. renderForm(type) only handles this
            // correctly for 'choice' (via its internal choiceSubtype
            // default); every other group type would render blank and
            // leave #creator-opt-subtype unselected. Resolve to each
            // group's default subtype up front instead.
            const groupDefaults = {
                free: 'free_written',
                choice: 'choice_single',
                multi_group: 'multi_written',
                assoc_group: 'assoc_written',
                num_group: 'blackjack'
            };
            this.renderForm(groupDefaults[type] || type);
            // Open with デザイン (テキスト sub-tab) already active.
            if (window.App.Design) window.App.Design._activeDesignTab = 'text';
            this.toggleInlinePanel('design');
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
            { v: 'num_group', t: '数字予想' }
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
        window.App.Data.currentConfig = window.App.Config
            ? { ...JSON.parse(JSON.stringify(window.App.Config.DEFAULT_CONFIG)), ...(item.config || {}) }
            : (item.config || {});

        // Design is shared across the whole set (Creator.save() copies one
        // design object onto every question that doesn't already have its
        // own) — seed the editor from the first question's design/layout/align.
        const firstQForDesign = (item.questions || [])[0] || {};
        window.App.Data.currentDesign = window.App.Design
            ? { ...JSON.parse(JSON.stringify(window.App.Design.defaultsWithSavedSounds())), ...(firstQForDesign.design || {}) }
            : (firstQForDesign.design || {});
        window.App.Data.currentDesign.layout = firstQForDesign.layout || window.App.Data.currentDesign.layout || 'standard';
        window.App.Data.currentDesign.align = firstQForDesign.align || window.App.Data.currentDesign.align || 'center';
        window.App.Data.currentDesign.cAlign = firstQForDesign.cAlign || window.App.Data.currentDesign.cAlign || 'left';

        const btnSave = document.getElementById('save-to-cloud-btn');
        if (btnSave) btnSave.textContent = APP_TEXT.Creator.BtnUpdate;

        this.setupTypeSelect();

        // Resolve to the same leaf-type strings renderForm()/initWithType()
        // use, and render through renderForm() directly — this used to only
        // populate the legacy #creator-q-subtype select (dead since the
        // card-based picker/getData() switched to #creator-opt-subtype
        // earlier this session) and rely on resetForm() to figure the type
        // out from it, which left #creator-opt-subtype unpopulated and made
        // editing a saved set render the wrong (or a blank/default) form.
        const sel = document.getElementById('creator-q-type');
        let resolvedType = 'choice_single';

        if (window.App.Data.createdQuestions.length > 0) {
            const firstQ = window.App.Data.createdQuestions[0];
            const type = firstQ.type;

            if (type.startsWith('choice')) {
                sel.value = 'choice';
                resolvedType = (firstQ.multi || firstQ.mode === 'multi') ? 'choice_multi' : 'choice_single';
            } else if (type.startsWith('free') || type === 'letter_select') {
                sel.value = 'free';
                resolvedType = type;
            } else if (type.startsWith('multi') || type.startsWith('ranking')) {
                sel.value = 'multi_group';
                resolvedType = type;
            } else if (type.startsWith('assoc')) {
                sel.value = 'assoc_group';
                resolvedType = type;
            } else if (type === 'blackjack') {
                sel.value = 'num_group';
                resolvedType = 'blackjack';
            } else {
                sel.value = type; // e.g. 'sort' — no subtype of its own
                resolvedType = type;
            }

            sel.disabled = true;
            document.getElementById('creator-type-locked-msg').classList.remove('hidden');
        } else {
            sel.disabled = false;
            document.getElementById('creator-type-locked-msg').classList.add('hidden');
        }

        this.editingIndex = null;
        this.renderForm(resolvedType);
        this.renderList();
        window.App.Ui.showView(window.App.Ui.views.creator);
        this.activeInlinePanel = null;
        if (window.App.Design) window.App.Design._activeDesignTab = 'text';
        this.toggleInlinePanel('design');
    },

    resetForm: function () {
        this.editingIndex = null;
        this.currentLetterSteps = [];

        document.getElementById('creator-form-title').textContent = APP_TEXT.Creator.HeadingNewQ;
        document.getElementById('add-question-btn')?.classList.remove('hidden');
        const inlineAddBtn = document.getElementById('creator-inline-add-btn');
        if (inlineAddBtn) inlineAddBtn.textContent = APP_TEXT.Creator.BtnAdd;
        document.getElementById('question-text').value = '';

        const sel = document.getElementById('creator-q-type');
        // Same fix as getData(): #creator-q-subtype is a dead legacy element
        // the card-based picker never updates. Read the subtype that's
        // actually in effect (#creator-opt-subtype, still holding the value
        // from the question just added) so the next question keeps the same
        // style instead of falling through to a blank/default form.
        const subSel = document.getElementById('creator-opt-subtype') || document.getElementById('creator-q-subtype');
        const groupDefaults = { num_group: 'blackjack' };
        const type = (sel && (['free', 'multi_group', 'choice', 'assoc_group', 'num_group'].includes(sel.value)))
            ? (subSel.value || groupDefaults[sel.value] || sel.value)
            : (sel ? sel.value : 'choice');
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
        if (optionsExtra) optionsExtra.innerHTML = '';
        if (optSubArea) optSubArea.classList.add('hidden');
        // リストに追加/保存 live outside the PREVIEW bezel and stay visible
        // across all 4 tabs once question editing has started, not just
        // while 問題編集 is the active tab.
        document.getElementById('creator-inline-listactions')?.classList.remove('hidden');

        // Raw leaf type currently shown in the form (e.g. 'choice_multi',
        // 'free_oral'), captured before the choice_single/choice_multi
        // remap below. Used by 解答権's mode restrictions so picking 回答形式
        // restricts 解答権 immediately, even before the first question in
        // the set has been added (deriveTypeInfo() otherwise only looks at
        // already-added questions).
        this.currentType = type;

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

            // Add choice button + Shuffle option, same row, in options panel
            if (optionsExtra) {
                optionsExtra.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                        <button id="choice-add-btn" type="button" style="
                            flex:1; background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4);
                            border-radius:8px; color:#00e5ff; padding:8px 10px; cursor:pointer; font-size:0.85rem;
                        ">＋ 選択肢を追加</button>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; color:#94a3b8; font-size:0.8rem; white-space:nowrap; flex-shrink:0;">
                            <input type="checkbox" id="choice-shuffle-chk" ${data?.shuffle !== false ? 'checked' : ''}>
                            <span>シャッフル</span>
                        </label>
                    </div>
                `;
                optionsExtra.querySelector('#choice-add-btn').onclick = () => this.addChoiceInput(choicesDiv);
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
                { v: 'free_written', t: '手書きで答える' },
                { v: 'free_oral', t: '口頭で答える' },
                { v: 'letter_select', t: '文字パネル' }
            ], 'letter_select');
        }

        else if (type === 'sort') {
            container.innerHTML = `
                <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:6px;">
                    <button id="btn-reset-sort-ranks" style="background:rgba(255,255,255,0.08); border:1px solid #555; border-radius:6px; color:#aaa; padding:3px 10px; font-size:0.75rem; cursor:pointer;">順序リセット</button>
                </div>
            `;
            const sortDiv = document.createElement('div');
            sortDiv.id = 'creator-choices-list';
            sortDiv.style.cssText = 'display:flex; flex-direction:column; gap:1%; flex:1; min-height:0; width:100%;';
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

            // Add-item button + Shuffle option in options panel
            if (optionsExtra) {
                // Shuffle checkbox (set via innerHTML first — innerHTML += after an
                // appendChild would strip that element's JS-attached listeners)
                optionsExtra.innerHTML = `
                    <div style="margin-bottom:12px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#94a3b8; font-size:0.9rem;">
                            <input type="checkbox" id="sort-shuffle-chk" ${data?.shuffle !== false ? 'checked' : ''}>
                            <span>選択肢をシャッフルする</span>
                        </label>
                    </div>
                `;

                const addBtnDiv = document.createElement('div');
                addBtnDiv.style.cssText = 'margin-bottom:14px;';
                const addBtn = document.createElement('button');
                addBtn.textContent = '＋ 項目を追加';
                addBtn.style.cssText = 'background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:8px 20px; cursor:pointer; font-size:0.9rem; width:100%;';
                addBtn.onclick = () => this.addSortInput(sortDiv);
                addBtnDiv.appendChild(addBtn);
                optionsExtra.insertBefore(addBtnDiv, optionsExtra.firstChild);
            }
        }
        else if (type.startsWith('free')) {
            container.innerHTML = `
                <div style="padding:10px;">
                    <div style="text-align:center; color:#64748b; font-size:0.8rem; margin-bottom:10px;">正解を入力</div>
                    <input type="text" id="creator-text-answer" placeholder="正解（複数ある場合はカンマ区切り）" style="
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
                { v: 'free_written', t: '手書きで答える' },
                { v: 'free_oral', t: '口頭で答える' },
                { v: 'letter_select', t: '文字パネル' }
            ], type);
        }
        else if (type.startsWith('assoc')) {
            container.innerHTML = `
                <div style="text-align:center; color:rgba(255,255,255,0.25); font-size:0.7rem; margin-bottom:4px;">ヒントを入力（順番に開示）</div>
            `;

            const assocDiv = document.createElement('div');
            assocDiv.id = 'creator-choices-list';
            assocDiv.style.cssText = 'display:flex; flex-direction:column; gap:1%; flex:1; min-height:0; width:100%;';
            container.appendChild(assocDiv);

            if (data && data.c) {
                data.c.forEach((txt, i) => this.addAssocInput(assocDiv, i, txt));
            } else {
                for (let i = 0; i < 4; i++) this.addAssocInput(assocDiv, i, '');
            }

            // Add hint button + answer input in options panel
            if (optionsExtra) {
                // Answer input at top of options
                optionsExtra.innerHTML = `
                    <div style="margin-bottom:14px;">
                        <label style="color:#94a3b8; font-size:0.85rem; display:block; margin-bottom:6px;">正解キーワード</label>
                        <input type="text" id="creator-assoc-answer" placeholder="キーワード（複数ある場合はカンマ区切り）" style="
                            width:100%; padding:10px; background:#1e293b; border:1px solid #475569;
                            border-radius:8px; color:#fff; font-size:0.95rem; text-align:center; outline:none; box-sizing:border-box;
                        ">
                    </div>
                `;
                if (data && data.correct) {
                    optionsExtra.querySelector('#creator-assoc-answer').value =
                        Array.isArray(data.correct) ? data.correct.join(', ') : data.correct;
                }

                // Add-hint button
                const addBtnDiv = document.createElement('div');
                addBtnDiv.style.cssText = 'margin-bottom:14px;';
                const addBtn = document.createElement('button');
                addBtn.textContent = '＋ ヒントを追加';
                addBtn.style.cssText = 'background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:8px 20px; cursor:pointer; font-size:0.9rem; width:100%;';
                addBtn.onclick = () => this.addAssocInput(assocDiv, undefined, '');
                addBtnDiv.appendChild(addBtn);
                optionsExtra.appendChild(addBtnDiv);
            }

            // Sub-type
            setupOptSubtype([
                { v: 'assoc_written', t: '連想・手書きで答える' },
                { v: 'assoc_oral', t: '連想・口頭で答える' }
            ], type);
        }
        else if (type.startsWith('multi') || type.startsWith('ranking')) {
            const isRanking = type.startsWith('ranking');
            const descText = isRanking ? '1位から順番に入力' : '全ての正解を入力';

            container.innerHTML = `
                <div style="text-align:center; color:#64748b; font-size:0.8rem; margin-bottom:10px; padding-top:6px;">${descText}</div>
            `;
            const multiDiv = document.createElement('div');
            multiDiv.id = 'creator-choices-list';
            multiDiv.style.cssText = 'display:flex; flex-direction:column; gap:1%; flex:1; min-height:0; width:100%;';
            container.appendChild(multiDiv);

            if (data) data.c.forEach((txt, i) => this.addMultiInput(multiDiv, i, txt, isRanking));
            else for (let i = 0; i < 4; i++) this.addMultiInput(multiDiv, i, '', isRanking);

            // Add-item button in options panel
            if (optionsExtra) {
                const addBtnDiv = document.createElement('div');
                addBtnDiv.style.cssText = 'margin-bottom:14px;';
                const addBtnText = isRanking ? '＋ ランキングを追加' : '＋ 正解を追加';
                const addBtn = document.createElement('button');
                addBtn.textContent = addBtnText;
                addBtn.style.cssText = 'background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:8px 20px; cursor:pointer; font-size:0.9rem; width:100%;';
                addBtn.onclick = () => this.addMultiInput(multiDiv, undefined, '', isRanking);
                addBtnDiv.appendChild(addBtn);
                optionsExtra.appendChild(addBtnDiv);
            }

            // Sub-type
            setupOptSubtype([
                { v: 'multi_written', t: '手書きで答える' },
                { v: 'multi_oral', t: '口頭で答える' },
                { v: 'ranking_written', t: 'ランキング・手書きで答える' },
                { v: 'ranking_oral', t: 'ランキング・口頭で答える' }
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

        this.renderRulesSection();
        this.applyDesignToPreview();
    },

    // Rules (win condition / time limit / scoring etc.) used to live on a
    // separate, standalone "ルール設定" screen (App.Config) whose save
    // button was broken (dead #config-action-area ids), so it never
    // actually persisted anything. Rebuilt as toggle buttons that all share
    // one fixed-height panel right above the action bar — only one panel's
    // content is visible at a time, so the panel never grows or shrinks
    // between them. 正解ボーナス and 制限時間 share a single "ルール設定"
    // panel/button (both stacked, one scroll area).
    activeInlinePanel: null,

    // 問題編集's own sub-tab: 'home' (the normal per-question editor, shown
    // by default) or 'bulk' (paste multiple whole questions at once).
    editSubTab: 'home',

    // deriveTypeInfo()/applyModeRestrictions() (host_config.js) only look at
    // already-added questions[0], so before the first question in a set is
    // added, picking a 回答形式 had no effect on 解答権's mode restrictions.
    // Fall back to a synthetic entry built from the live form's current
    // type/subtype so restrictions apply immediately.
    effectiveQuestionsForRestrictions: function () {
        const real = window.App.Data.createdQuestions;
        if (real.length > 0 || !this.currentType) return real;
        const mode = this.currentType === 'choice_multi' ? 'multi' : undefined;
        const type = (this.currentType === 'choice_single' || this.currentType === 'choice_multi') ? 'choice' : this.currentType;
        return [{ type, mode }];
    },

    renderRulesSection: function () {
        const modeBtn = document.getElementById('creator-rule-mode-btn');
        const rulesBtn = document.getElementById('creator-rule-settings-btn');
        const designBtn = document.getElementById('creator-rule-design-btn');
        const editBtn = document.getElementById('creator-inline-edit-toggle');
        if (!modeBtn || !rulesBtn || !editBtn) return;
        if (!window.App.Config) return;

        const conf = window.App.Data.currentConfig;
        const questions = this.effectiveQuestionsForRestrictions();
        window.App.Config.applyModeRestrictions(conf, questions);

        modeBtn.textContent = '解答方式';
        rulesBtn.textContent = 'ルール設定';

        editBtn.onclick = () => this.toggleInlinePanel('edit');
        if (designBtn) designBtn.onclick = () => this.toggleInlinePanel('design');
        modeBtn.onclick = () => this.toggleInlinePanel('mode');
        rulesBtn.onclick = () => this.toggleInlinePanel('rules');

        // Keep an already-open 解答権 panel's radio list in sync as 回答形式
        // changes (it only reflects restrictions from the moment it opened
        // otherwise).
        if (this.activeInlinePanel === 'mode') this.renderActivePanelContent('mode');

        this.updateInlinePanelButtonStyles();
    },

    updateInlinePanelButtonStyles: function () {
        const buttons = {
            edit: document.getElementById('creator-inline-edit-toggle'),
            design: document.getElementById('creator-rule-design-btn'),
            mode: document.getElementById('creator-rule-mode-btn'),
            rules: document.getElementById('creator-rule-settings-btn')
        };
        Object.entries(buttons).forEach(([key, btn]) => {
            if (!btn) return;
            const isActive = this.activeInlinePanel === key;
            btn.style.background = isActive ? '#00a8cc' : '#0e6b8f';
        });
    },

    toggleInlinePanel: function (key) {
        const area = document.getElementById('creator-inline-edit-area');
        const panels = {
            edit: document.getElementById('creator-options-extra'),
            design: document.getElementById('creator-inline-design'),
            mode: document.getElementById('creator-inline-mode'),
            rules: document.getElementById('creator-inline-rules')
        };
        // 問題編集 only — not the rule pickers. リストに追加/保存 lives
        // outside this panel entirely now, so it isn't touched here.
        const qList = document.getElementById('creator-inline-qlist');
        const editSubtabs = document.getElementById('creator-edit-subtabs');
        const homePanel = document.getElementById('creator-edit-home-panel');
        const bulkPanel = document.getElementById('creator-bulk-panel');
        if (!area || !panels[key]) return;

        Object.values(panels).forEach(p => p.classList.add('hidden'));
        if (qList) qList.classList.add('hidden');
        if (editSubtabs) editSubtabs.classList.add('hidden');
        if (homePanel) homePanel.classList.add('hidden');
        if (bulkPanel) bulkPanel.classList.add('hidden');

        this.activeInlinePanel = key;
        area.classList.remove('hidden');
        panels[key].classList.remove('hidden');
        if (key === 'edit') {
            if (editSubtabs) editSubtabs.classList.remove('hidden');
            this.renderEditSubtabs();
            this.renderEditPanelBody();
        }

        this.renderActivePanelContent(key);

        this.updateInlinePanelButtonStyles();
    },

    // 問題編集's own ホーム/一括編集 sub-tab bar.
    renderEditSubtabs: function () {
        const homeBtn = document.getElementById('creator-edit-subtab-home-btn');
        const bulkBtn = document.getElementById('creator-edit-subtab-bulk-btn');
        if (!homeBtn || !bulkBtn) return;
        homeBtn.style.background = (this.editSubTab === 'home') ? '#00a8cc' : '#1e293b';
        bulkBtn.style.background = (this.editSubTab === 'bulk') ? '#00a8cc' : '#1e293b';
        homeBtn.onclick = () => { this.editSubTab = 'home'; this.renderEditSubtabs(); this.renderEditPanelBody(); };
        bulkBtn.onclick = () => { this.editSubTab = 'bulk'; this.renderEditSubtabs(); this.renderEditPanelBody(); };
    },

    // Shows either the normal per-question editor (home) or the bulk-paste
    // panel (bulk) — whichever 問題編集's own sub-tab is currently active.
    renderEditPanelBody: function () {
        const homePanel = document.getElementById('creator-edit-home-panel');
        const bulkPanel = document.getElementById('creator-bulk-panel');
        const qList = document.getElementById('creator-inline-qlist');
        if (this.editSubTab === 'bulk') {
            if (homePanel) homePanel.classList.add('hidden');
            if (bulkPanel) bulkPanel.classList.remove('hidden');
            this.renderBulkPanel();
        } else {
            if (bulkPanel) bulkPanel.classList.add('hidden');
            if (homePanel) homePanel.classList.remove('hidden');
            if (qList) { qList.classList.remove('hidden'); this.renderList(); }
        }
    },

    // Renders the given panel's content. Called on open (toggleInlinePanel)
    // and again from renderRulesSection() whenever the live 回答形式/question
    // list changes, so an already-open 解答権 panel's mode restrictions stay
    // in sync instead of only updating on next open.
    renderActivePanelContent: function (key) {
        if (!window.App.Config) return;
        const conf = window.App.Data.currentConfig;
        const questions = this.effectiveQuestionsForRestrictions();
        const onChange = () => this.renderRulesSection();
        if (key === 'mode') {
            window.App.Config.renderInlineModeChooser(document.getElementById('creator-inline-mode-body'), conf, questions, onChange);
        } else if (key === 'rules') {
            window.App.Config.renderInlineGameTypeChooser(document.getElementById('creator-inline-gametype'), conf, onChange);
            window.App.Config.renderInlineTimeLimitChooser(document.getElementById('creator-inline-timelimit'), conf, onChange);
        } else if (key === 'design' && window.App.Design && window.App.Design.renderInlineChooser) {
            window.App.Design.renderInlineChooser(document.getElementById('creator-inline-design'), window.App.Data.currentDesign, () => {
                this.applyDesignToPreview();
                onChange();
            });
        }
        // 'edit' panel content is already kept current by renderForm().
    },

    // Reflects the current デザイン colors onto the live 16:9 preview, so
    // changing a color shows up immediately instead of only after hosting.
    // Only touches colors — row backgrounds used for the correct-answer
    // highlight/hover states are left alone so this can't fight with that.
    applyDesignToPreview: function () {
        const d = window.App.Data.currentDesign || {};

        const screen = document.getElementById('creator-monitor-preview');
        if (screen && d.mainBgColor) {
            screen.style.backgroundColor = d.mainBgColor;
            if (d.bgImage) {
                screen.style.backgroundImage = `url(${d.bgImage})`;
                screen.style.backgroundSize = 'cover';
                screen.style.backgroundPosition = 'center';
            } else {
                screen.style.backgroundImage = (d.mainBgColor === '#0a0a0a')
                    ? 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)'
                    : 'none';
            }
        }

        // 問題文の位置 — mirrors viewer.js's 4-direction layout. The wrapper
        // always holds q-area then c-area in that DOM order; only its
        // flex-direction changes, so "top"/"bottom" just reverse the column
        // and "left"/"right" reverse the row.
        const flexWrap = document.getElementById('creator-monitor-flexwrap');
        const qArea = document.getElementById('creator-monitor-q-area');
        const formContainer = document.getElementById('creator-form-container');
        const layout = window.App.Design ? window.App.Design.normalizeLayout(d.layout) : (d.layout || 'top');
        const isRow = (layout === 'left' || layout === 'right');
        if (flexWrap) {
            flexWrap.style.flexDirection = { top: 'column', bottom: 'column-reverse', left: 'row', right: 'row-reverse' }[layout] || 'column';
        }
        if (qArea) {
            if (isRow) {
                qArea.style.width = '34%';
                qArea.style.alignSelf = 'stretch';
                qArea.style.display = 'flex';
                qArea.style.alignItems = 'center';
                qArea.style.margin = '0';
            } else {
                qArea.style.width = '90%';
                qArea.style.alignSelf = 'center';
                qArea.style.display = 'block';
                qArea.style.margin = layout === 'bottom' ? '1.2% 0 0' : '0 0 1.2%';
            }
        }
        if (formContainer) {
            if (isRow) {
                formContainer.style.width = '62%';
                formContainer.style.alignSelf = 'stretch';
            } else {
                formContainer.style.width = '85%';
                formContainer.style.alignSelf = 'center';
            }
        }

        if (qArea) {
            if (d.qBorderColor) qArea.style.borderColor = d.qBorderColor;
            if (d.qBgColor) qArea.style.backgroundColor = d.qBgColor;
            // The box's default cyan glow is a hardcoded box-shadow in
            // index.html (not tied to qBorderColor) — 問題枠 alone going
            // transparent left it lingering as a stray blue halo, so hide
            // it explicitly whenever the border itself is 透明.
            qArea.style.boxShadow = (d.qBorderColor === 'transparent') ? 'none' : '0 0 20px rgba(0,229,255,0.2)';
        }
        // input/select/textarea get a global "color:#fff !important" reset
        // (style_host.css), so a plain .style.color assignment loses to it —
        // use setProperty('color', v, 'important') to win the cascade.
        const qText = document.getElementById('question-text');
        if (qText) {
            if (d.qTextColor) qText.style.setProperty('color', d.qTextColor, 'important');
            qText.style.setProperty('text-align', d.align || 'center', 'important');
        }

        // A/B/C/D labels stay the app's fixed cyan accent — they're an editor
        // affordance, not part of the on-air 問題文/選択肢 design, so they
        // don't track any design color (previously wrongly tied to
        // qBorderColor, which looked like an unrelated color was "linked").

        // input/select/textarea get a global "color:#fff !important" reset
        // (style_host.css), so a plain .style.color assignment loses to it —
        // use setProperty('color', v, 'important') to win the cascade. Also
        // set it as a CSS var so the ::placeholder text (shown before the
        // user types anything) visibly reflects the color too — ::placeholder
        // can't be reached via .style, only via a stylesheet rule.
        document.querySelectorAll('#creator-form-container .choice-text-input, #creator-form-container .row-input').forEach(el => {
            if (d.cTextColor) {
                el.style.setProperty('color', d.cTextColor, 'important');
                el.style.setProperty('--creator-choice-text-color', d.cTextColor);
            }
            el.style.setProperty('text-align', d.cAlign || 'left', 'important');
        });

        // 選択背景/選択枠 — applied to each row (the editor's own
        // correct-answer highlight is layered on top for .choice-row, so it
        // stays visible while editing).
        document.querySelectorAll('#creator-form-container .choice-row').forEach(row => {
            const chk = row.querySelector('input[type="checkbox"], input[type="radio"]');
            row.style.background = this.rowBackground(chk && chk.checked);
            if (d.cBorderColor) row.style.borderBottomColor = d.cBorderColor;
        });
        document.querySelectorAll('#creator-form-container .sort-row, #creator-form-container .multi-row, #creator-form-container .assoc-row').forEach(row => {
            if (d.cBgColor) row.style.background = d.cBgColor;
            if (d.cBorderColor) row.style.borderBottomColor = d.cBorderColor;
        });

        // 選択肢/項目の配置（行数/列数）: mirrors viewer.js's .c-area grid,
        // which applies to any type with a .c list (choice/sort/multi/
        // ranking/assoc) — not just 選択式, despite this being named after
        // it. #creator-choices-list is reused as the wrapper id across all
        // of those types' renderForm branches (only one exists at a time),
        // so its presence alone is enough to gate this — no need to check
        // this.currentType too (previously restricted to 'choice', which
        // silently no-opped the same setting for sort/multi/assoc).
        const choicesList = document.getElementById('creator-choices-list');
        if (choicesList) {
            const rows = parseInt(d.gridRows) || 0;
            const cols = parseInt(d.gridCols) || 0;
            if (rows > 0 && cols > 0) {
                choicesList.style.display = 'grid';
                choicesList.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                choicesList.style.gridTemplateRows = '';
                choicesList.style.flexDirection = '';
            } else {
                choicesList.style.display = 'flex';
                choicesList.style.flexDirection = 'column';
                choicesList.style.gridTemplateColumns = '';
            }
        }
    },

    // Background for a .choice-row, reflecting 選択背景 (cBgColor) as the
    // base tint while keeping the correct-answer highlight visible on top
    // (an editor-only affordance — the real viewer has no "checked" state).
    rowBackground: function (checked) {
        const c = (window.App.Data.currentDesign || {}).cBgColor;
        if (checked) return c ? `linear-gradient(90deg, rgba(0,229,255,0.35) 0%, ${c} 100%)` : 'linear-gradient(90deg,rgba(0,229,255,0.12) 0%,transparent 100%)';
        return c || 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)';
    },
    rowHoverBackground: function (checked) {
        if (checked) return this.rowBackground(true);
        const c = (window.App.Data.currentDesign || {}).cBgColor;
        return c ? `linear-gradient(90deg, rgba(255,255,255,0.15) 0%, ${c} 100%)` : 'linear-gradient(90deg,rgba(255,255,255,0.08) 0%,transparent 100%)';
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
        const borderC = (window.App.Data.currentDesign || {}).cBorderColor;
        row.style.cssText = `
            display:flex; align-items:center;
            background:${this.rowBackground(checked)};
            border-bottom:1px solid ${borderC || 'rgba(255,255,255,0.1)'};
            border-radius:6px;
            cursor:pointer; transition:background 0.2s;
            flex:1; min-height:0; overflow:hidden;
        `;
        row.onmouseenter = () => {
            if (!chk.checked) row.style.background = this.rowHoverBackground(false);
        };
        row.onmouseleave = () => {
            row.style.background = this.rowBackground(chk.checked);
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
        const cTextC = (window.App.Data.currentDesign || {}).cTextColor;
        inp.style.cssText = `
            flex:1; background:transparent; border:none;
            color:${cTextC || '#ddd'}; font-size:min(1rem,2.8vw);
            outline:none; padding:2px 0;
        `;
        if (cTextC) inp.style.setProperty('--creator-choice-text-color', cTextC);
        inp.onfocus = () => inp.style.setProperty('color', '#fff', 'important');
        inp.onblur  = () => inp.style.setProperty('color', (window.App.Data.currentDesign && window.App.Data.currentDesign.cTextColor) || '#ddd', 'important');

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
        delBtn.onclick = (e) => { e.stopPropagation(); row.remove(); this.updateLabels(parent); this.updateRowSizes(parent); };

        row.appendChild(labelSpan);
        row.appendChild(inp);
        row.appendChild(chk);
        row.appendChild(delBtn);

        parent.appendChild(row);
        this.updateLabels(parent);
        this.updateRowSizes(parent);
        this.applyDesignToPreview();
    },

    addSortInput: function (parent, index, text = "", rank = "") {
        if (parent.children.length >= 20) { alert("並べ替え問題の上限は20個までです"); return; }
        const row = document.createElement('div');
        row.className = 'sort-row';
        row.style.cssText = `
            display:flex; align-items:center;
            background:linear-gradient(90deg,rgba(255,255,255,0.04) 0%,transparent 100%);
            border-bottom:1px solid rgba(255,255,255,0.1);
            border-radius:6px;
            cursor:pointer; transition:background 0.2s;
            flex:1; min-height:0; overflow:hidden;
        `;

        row.innerHTML = `
            <span class="sort-label row-label" style="color:#00e5ff;font-weight:900;font-family:'Arial Black',sans-serif;margin-right:min(16px,3vw);font-size:min(1.1rem,3vw);min-width:min(22px,4vw);text-shadow:0 0 8px rgba(0,229,255,0.4);">${String.fromCharCode(65 + index)}</span>
            <input type="text" class="sort-text-input row-input" placeholder="項目を入力" value="${text}" style="flex:1;background:transparent;border:none;color:#ddd;font-size:min(1rem,2.8vw);outline:none;padding:2px 0;">
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
            this.updateRowSizes(parent);
        };
        parent.appendChild(row);
        this.updateSortLabels(parent);
        this.updateRowSizes(parent);
        this.applyDesignToPreview();
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
        row.className = 'multi-row';
        row.style.cssText = `
            display:flex; align-items:center;
            background:linear-gradient(90deg,rgba(255,255,255,0.04) 0%,transparent 100%);
            border-bottom:1px solid rgba(255,255,255,0.1);
            border-radius:6px;
            cursor:pointer; transition:background 0.2s;
            flex:1; min-height:0; overflow:hidden;
        `;
        const labelText = isRanking ? `${idx + 1}位` : `${idx + 1}`;
        const placeholder = isRanking ? `${idx + 1}位の答え` : 'Answer';
        row.innerHTML = `
            <span class="multi-label row-label" style="color:#00e5ff;font-weight:900;font-family:'Arial Black',sans-serif;margin-right:min(16px,3vw);font-size:min(1.1rem,3vw);min-width:min(22px,4vw);text-shadow:0 0 8px rgba(0,229,255,0.4);">${labelText}</span>
            <input type="text" class="multi-text-input row-input" placeholder="${placeholder}" value="${text}" style="flex:1;background:transparent;border:none;color:#ddd;font-size:min(1rem,2.8vw);outline:none;padding:2px 0;">
            <button class="btn-remove-multi" style="background:none;border:none;color:rgba(255,255,255,0.25);font-size:0.9rem;cursor:pointer;padding:2px 4px;margin-left:4px;flex-shrink:0;">×</button>
        `;
        row.querySelector('.btn-remove-multi').onclick = () => {
            row.remove();
            // Re-index labels
            parent.querySelectorAll('.multi-row').forEach((r, i) => {
                const lbl = r.querySelector('.multi-label');
                if (lbl) lbl.textContent = isRanking ? `${i + 1}位` : `${i + 1}`;
            });
            this.updateRowSizes(parent);
        };
        parent.appendChild(row);
        this.updateRowSizes(parent);
        this.applyDesignToPreview();
    },

    addAssocInput: function (parent, index, text = "") {
        const idx = (index !== undefined) ? index : parent.children.length;
        const row = document.createElement('div');
        row.className = 'assoc-row';
        row.style.cssText = `
            display:flex; align-items:center;
            background:linear-gradient(90deg,rgba(255,255,255,0.04) 0%,transparent 100%);
            border-bottom:1px solid rgba(255,255,255,0.1);
            border-radius:6px;
            cursor:pointer; transition:background 0.2s;
            flex:1; min-height:0; overflow:hidden;
        `;
        row.innerHTML = `
            <span class="assoc-label row-label" style="color:#00e5ff;font-weight:900;font-family:'Arial Black',sans-serif;margin-right:min(16px,3vw);font-size:min(1.1rem,3vw);min-width:min(22px,4vw);text-shadow:0 0 8px rgba(0,229,255,0.4);">ヒント${idx + 1}</span>
            <input type="text" class="assoc-text-input row-input" placeholder="ヒント内容" value="${text}" style="flex:1;background:transparent;border:none;color:#ddd;font-size:min(1rem,2.8vw);outline:none;padding:2px 0;">
            <button class="btn-remove-assoc" style="background:none;border:none;color:rgba(255,255,255,0.25);font-size:0.9rem;cursor:pointer;padding:2px 4px;margin-left:4px;flex-shrink:0;">×</button>
        `;
        row.querySelector('.btn-remove-assoc').onclick = () => {
            row.remove();
            parent.querySelectorAll('.assoc-row').forEach((r, i) => {
                const lbl = r.querySelector('.assoc-label');
                if (lbl) lbl.textContent = `ヒント${i + 1}`;
            });
            this.updateRowSizes(parent);
        };
        parent.appendChild(row);
        this.updateRowSizes(parent);
        this.applyDesignToPreview();
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

    // 文字パネル (letter_select): each step is one character position of the
    // final answer — a 正解 letter plus optional ダミー (decoy) letters.
    // player.js pools every step's correct+dummy letters into one shuffled
    // panel, so a step needs at least a 正解 to be meaningful.
    renderLetterStepList: function () {
        const container = document.getElementById('letter-step-container');
        if (!container) return;
        container.innerHTML = '';

        this.currentLetterSteps.forEach((step, i) => {
            if (!step.dummies) step.dummies = [];
            const row = document.createElement('div');
            row.className = 'letter-step-row';
            row.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:8px; padding:8px; background:#1a1a1a; border-radius:8px; border:1px solid #333;';
            row.innerHTML = `
                <span style="color:#00e5ff; font-weight:900; font-size:0.85rem; min-width:18px; text-align:center;">${i + 1}</span>
                <input type="text" class="letter-step-correct" maxlength="2" value="${step.correct || ''}" placeholder="正解" style="
                    width:42px; padding:6px 2px; text-align:center; background:#0d1b2a; border:1px solid #475569;
                    border-radius:6px; color:#00ff88; font-weight:bold; font-size:0.9rem; flex-shrink:0;
                ">
                <div class="letter-step-dummies" style="display:flex; gap:4px; flex-wrap:wrap; flex:1; align-items:center;"></div>
                <button type="button" class="letter-step-del-btn" title="この文字を削除" style="
                    background:none; border:none; color:rgba(255,255,255,0.3); font-size:1rem; cursor:pointer; flex-shrink:0;
                ">×</button>
            `;

            const dummiesWrap = row.querySelector('.letter-step-dummies');
            step.dummies.forEach((d, di) => {
                const dInp = document.createElement('input');
                dInp.type = 'text';
                dInp.maxLength = 2;
                dInp.value = d;
                dInp.placeholder = 'ダミー';
                dInp.style.cssText = 'width:36px; padding:5px 2px; text-align:center; background:#0d1b2a; border:1px dashed #475569; border-radius:6px; color:#ff8888; font-size:0.8rem;';
                dInp.oninput = () => { step.dummies[di] = dInp.value; };
                dummiesWrap.appendChild(dInp);
            });
            const addDummyBtn = document.createElement('button');
            addDummyBtn.type = 'button';
            addDummyBtn.textContent = '+';
            addDummyBtn.title = 'ダミー文字を追加';
            addDummyBtn.style.cssText = 'width:26px; height:26px; background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:6px; color:#00e5ff; cursor:pointer; font-size:0.85rem; flex-shrink:0;';
            addDummyBtn.onclick = () => { step.dummies.push(''); this.renderLetterStepList(); };
            dummiesWrap.appendChild(addDummyBtn);

            row.querySelector('.letter-step-correct').oninput = (e) => { step.correct = e.target.value; };
            row.querySelector('.letter-step-del-btn').onclick = () => {
                this.currentLetterSteps.splice(i, 1);
                this.renderLetterStepList();
            };
            container.appendChild(row);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '＋ 文字を追加';
        addBtn.style.cssText = 'background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:8px 20px; cursor:pointer; font-size:0.9rem; width:100%; margin-top:2px;';
        addBtn.onclick = () => {
            this.currentLetterSteps.push({ correct: '', dummies: [] });
            this.renderLetterStepList();
        };
        container.appendChild(addBtn);
    },

    updateLabels: function (parent) {
        const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
        parent.querySelectorAll('.choice-label-text').forEach((el, i) => el.textContent = labels[i] || String(i + 1));
        // Update placeholder text too
        parent.querySelectorAll('.choice-text-input').forEach((inp, i) => {
            const label = labels[i] || String(i + 1);
            inp.placeholder = `選択肢${label}`;
        });
        this.updateRowSizes(parent);
    },

    // Dynamically scale row padding & font so N rows always fit inside the 16:9 frame
    // Works for .choice-row, .sort-row, .multi-row
    updateRowSizes: function (parent) {
        if (!parent) return;
        const rows = parent.querySelectorAll('.choice-row, .sort-row, .multi-row, .assoc-row');
        const n = rows.length;
        if (n === 0) return;

        // The 16:9 frame's pixel height at current viewport
        const frame = document.getElementById('creator-monitor-preview');
        const frameH = frame ? frame.offsetHeight : 400;

        // Reserve ~30% for question box + label + gaps
        const choicesAreaH = frameH * 0.65;
        const rowH = Math.max(20, (choicesAreaH / n) - 2);

        // Vertical padding: at most 12% of rowH each side
        const vPad = Math.min(8, rowH * 0.12);
        // Font size: roughly 40% of rowH, clamped
        const fs = Math.max(9, Math.min(16, rowH * 0.40));

        rows.forEach(row => {
            row.style.padding = `${vPad}px 10px`;
            // Scale label and input fonts — use generic selectors
            const label = row.querySelector('.choice-label-text, .row-label');
            const inp   = row.querySelector('.choice-text-input, .row-input');
            if (label) label.style.fontSize = `${Math.max(10, fs)}px`;
            if (inp)   inp.style.fontSize   = `${Math.max(9, fs - 1)}px`;
            // Scale rank boxes for sort
            const rankBox = row.querySelector('.sort-rank-box');
            if (rankBox) {
                const boxSize = Math.max(16, rowH * 0.6);
                rankBox.style.width = `${boxSize}px`;
                rankBox.style.height = `${boxSize}px`;
                rankBox.style.fontSize = `${Math.max(8, fs - 2)}px`;
            }
        });
    },


    getData: function () {
        const qText = document.getElementById('question-text').value.trim();
        if (!qText) { alert(APP_TEXT.Creator.AlertNoQ); return null; }
        const sel = document.getElementById('creator-q-type');
        // NOTE: #creator-q-subtype is a legacy element that the card-based type
        // picker (initWithType) never populates — it stays empty. The subtype
        // actually shown/edited by the user lives in the options panel's
        // #creator-opt-subtype, which renderForm keeps in sync via
        // setupOptSubtype(). Fall back to the legacy select only if that's
        // somehow unavailable.
        const subSel = document.getElementById('creator-opt-subtype') || document.getElementById('creator-q-subtype');
        // 'num_group' has exactly one leaf subtype ('blackjack') so renderForm
        // never shows/populates a subtype dropdown for it — resolve it directly.
        const groupDefaults = { num_group: 'blackjack' };

        let rawType = (sel && (['free', 'multi_group', 'choice', 'assoc_group', 'num_group'].includes(sel.value)))
            ? (subSel.value || groupDefaults[sel.value] || sel.value)
            : (sel ? sel.value : 'choice');
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
            type: normalizedType
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

    // 一括編集: paste multiple whole questions at once (問題編集's own
    // ホーム/一括編集 sub-tab). Each line is spreadsheet-paste friendly
    // (tab-separated columns) — the exact columns depend on the current
    // question type, described by `spec.hint`/`spec.placeholder` below.
    // `spec.parseLine(cols)` turns one line's columns into a question
    // object (or null to skip it as malformed).
    _bulkSpecs: {
        free_written: {
            hint: '問題文<span style="color:#00e5ff;">[タブ]</span>答え（複数正解はカンマ区切り）',
            placeholder: '日本の首都は？\t東京\n富士山の標高は？\t3776',
            parseLine: (cols) => {
                const [q, ans] = cols;
                if (!q || !ans) return null;
                return { q, correct: ans.split(',').map(s => s.trim()).filter(s => s) };
            },
        },
        choice: {
            hint: '問題文<span style="color:#00e5ff;">[タブ]</span>正解<span style="color:#00e5ff;">[タブ]</span>誤答1<span style="color:#00e5ff;">[タブ]</span>誤答2…',
            placeholder: '日本の首都は？\t東京\t大阪\t京都\t名古屋',
            parseLine: (cols, self) => {
                const [q, ...opts] = cols;
                if (!q || opts.length < 2 || !opts[0]) return null;
                const mode = self.choiceSubtype === 'multi' ? 'multi' : 'single';
                return { q, c: opts, correct: [0], correctIndex: 0, mode, multi: mode === 'multi', shuffle: true };
            },
        },
        sort: {
            hint: '問題文<span style="color:#00e5ff;">[タブ]</span>項目（正しい順序で）…',
            placeholder: '小さい順に並べて\t1\t3\t5\t7',
            parseLine: (cols) => {
                const [q, ...opts] = cols;
                if (!q || opts.length < 2) return null;
                const correct = opts.map((_, i) => String.fromCharCode(65 + i)).join('');
                return { q, c: opts, correct, initialOrder: 'random', shuffle: true };
            },
        },
        multi: {
            hint: '問題文<span style="color:#00e5ff;">[タブ]</span>答え1<span style="color:#00e5ff;">[タブ]</span>答え2…',
            placeholder: '都道府県を1つ以上挙げて\t東京都\t大阪府\t北海道',
            parseLine: (cols) => {
                const [q, ...opts] = cols;
                if (!q || opts.length < 1 || !opts[0]) return null;
                return { q, c: opts, correct: opts };
            },
        },
        assoc: {
            hint: '正解<span style="color:#00e5ff;">[タブ]</span>ヒント1<span style="color:#00e5ff;">[タブ]</span>ヒント2…',
            placeholder: 'すし\t酢飯\tネタ\t握る',
            parseLine: (cols) => {
                const [ans, ...hints] = cols;
                if (!ans || hints.length < 1 || !hints[0]) return null;
                return { q: ans, correct: [ans], c: hints };
            },
        },
    },

    // Maps this.currentType (the raw leaf type renderForm was given) to a
    // _bulkSpecs key + the exact `type` string new questions should get.
    _bulkTarget: function () {
        const t = this.currentType || '';
        if (t.startsWith('choice')) return { specKey: 'choice', type: 'choice' };
        if (t === 'sort') return { specKey: 'sort', type: 'sort' };
        if (t.startsWith('multi') || t.startsWith('ranking')) return { specKey: 'multi', type: t };
        if (t.startsWith('assoc')) return { specKey: 'assoc', type: t };
        if (t === 'free_written') return { specKey: 'free_written', type: 'free_written' };
        return null;
    },

    renderBulkPanel: function () {
        const panel = document.getElementById('creator-bulk-panel');
        if (!panel) return;
        const target = this._bulkTarget();
        if (!target) {
            panel.innerHTML = `<p style="color:#666; font-size:0.8rem; text-align:center; padding:30px 0;">この形式では一括編集はご利用いただけません</p>`;
            return;
        }
        const spec = this._bulkSpecs[target.specKey];
        panel.innerHTML = `
            <div style="color:#94a3b8; font-size:0.75rem; font-weight:bold; margin-bottom:4px;">📋 表形式で一括追加（1行1問／${spec.hint}）</div>
            <textarea id="creator-bulk-input" rows="4" placeholder="表計算ソフトからそのままコピペできます。例:
${spec.placeholder}" style="
                width:100%; padding:8px; background:#0d1b2a; border:1px dashed rgba(255,255,255,0.25);
                border-radius:8px; color:#fff; font-size:0.8rem; resize:vertical; box-sizing:border-box;
                font-family:monospace; outline:none;
            "></textarea>
            <button id="creator-bulk-add-btn" style="
                margin-top:6px; width:100%; padding:8px; font-size:0.85rem; font-weight:bold;
                background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4);
                border-radius:8px; color:#00e5ff; cursor:pointer;
            ">＋ 一括追加</button>
        `;
        panel.querySelector('#creator-bulk-add-btn').onclick = () => this.runBulkAdd();
    },

    runBulkAdd: function () {
        const target = this._bulkTarget();
        const textarea = document.getElementById('creator-bulk-input');
        if (!target || !textarea) return;
        const spec = this._bulkSpecs[target.specKey];

        const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) return;

        let added = 0, skipped = 0;
        lines.forEach(line => {
            const cols = line.split('\t').map(s => s.trim());
            const parsed = spec.parseLine(cols, this);
            if (!parsed) { skipped++; return; }
            window.App.Data.createdQuestions.push({
                ...parsed,
                type: target.type,
                points: 1,
                loss: 0,
                timeLimit: 0,
                layout: 'top',
                align: 'center',
            });
            added++;
        });

        if (added > 0) {
            textarea.value = '';
            this.renderList();
            document.getElementById('creator-q-type').disabled = true;
            document.getElementById('creator-q-subtype').disabled = true;
            document.getElementById('creator-type-locked-msg').classList.remove('hidden');
        }

        const msg = skipped > 0 ? `${added}件追加しました（${skipped}件は形式不正のためスキップ）` : `${added}件追加しました`;
        window.App.Ui.showToast(msg);
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
        document.getElementById('add-question-btn')?.classList.add('hidden');
        const inlineAddBtn = document.getElementById('creator-inline-add-btn');
        if (inlineAddBtn) inlineAddBtn.textContent = APP_TEXT.Creator.BtnUpdateQ;
        document.getElementById('question-text').value = q.q;
        this.renderForm(q.type, q);
        this.renderList(); // refresh row highlight to the one now being edited
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

    // Populates the clickable question list inside 問題編集 (creator-inline-qlist)
    // — click a row to edit that question, per user request. Only touches
    // the DOM when that list container actually exists/is visible.
    renderList: function () {
        const list = document.getElementById('creator-inline-qlist');
        if (!list) return;
        const questions = window.App.Data.createdQuestions;
        if (questions.length === 0) { list.innerHTML = ''; return; }

        const rows = questions.map((q, i) => {
            const displayQ = q.q.length > 20 ? q.q.substring(0, 20) + "..." : q.q;
            const shuffleIcon = (q.type === 'choice' || q.type === 'sort') && q.shuffle !== false ? ' 🔀' : '';
            const isEditing = this.editingIndex === i;
            return `
                <div class="creator-qlist-row" data-idx="${i}" style="
                    display:flex; align-items:center; gap:8px; padding:6px 8px; margin-bottom:4px;
                    border-radius:8px; cursor:pointer;
                    border:1px solid ${isEditing ? '#00e5ff' : '#333'};
                    background:${isEditing ? 'rgba(0,229,255,0.08)' : '#1a1a1a'};
                ">
                    <span style="flex:1; font-size:0.8rem; color:${isEditing ? '#00e5ff' : '#ddd'};">Q${i + 1}. ${displayQ}${shuffleIcon}</span>
                    <button class="creator-qlist-del" data-idx="${i}" title="削除" style="
                        background:none; border:none; color:rgba(255,255,255,0.35); font-size:0.9rem; cursor:pointer; padding:2px 6px; flex-shrink:0;
                    ">×</button>
                </div>
            `;
        }).join('');

        list.innerHTML = `
            <div style="color:#94a3b8; font-size:0.75rem; font-weight:bold; margin-bottom:6px;">📋 作成済みの問題（クリックで編集） (${questions.length})</div>
            ${rows}
        `;

        list.querySelectorAll('.creator-qlist-row').forEach(row => {
            row.onclick = (e) => {
                if (e.target.closest('.creator-qlist-del')) return;
                this.edit(parseInt(row.dataset.idx));
            };
        });
        list.querySelectorAll('.creator-qlist-del').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.delete(parseInt(btn.dataset.idx));
            };
        });
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

        // Design (colors/fonts/layout) is one shared setting for the whole
        // set, edited via the デザイン inline panel and kept in
        // App.Data.currentDesign — applied to every question here rather
        // than per-question (add() stamps a fixed 'standard'/'center'
        // default at add time, which used to make the old
        // `if (!q.layout)` check below always false and silently drop
        // whatever was chosen in the design UI).
        const currentDesign = window.App.Data.currentDesign || {};
        const layout = currentDesign.layout || 'standard';
        const align = currentDesign.align || 'center';
        const cAlign = currentDesign.cAlign || 'left';
        const { layout: _l, align: _a, cAlign: _c, ...design } = currentDesign;

        window.App.Data.createdQuestions.forEach(q => {
            q.layout = layout;
            q.align = align;
            q.cAlign = cAlign;
            q.design = design;
            q.specialMode = q.specialMode || 'none';
        });

        // Re-apply mode restrictions based on the questions just finalized
        // above (e.g. a blackjack question added last should still force
        // turn-only mode even if the rules buttons were touched earlier).
        if (window.App.Config) window.App.Config.applyModeRestrictions(window.App.Data.currentConfig, window.App.Data.createdQuestions);

        const data = {
            title: title,
            questions: window.App.Data.createdQuestions,
            config: window.App.Data.currentConfig,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        const setId = window.App.State.editingSetId;
        const baseRef = window.db.ref("saved_sets").child(showId);
        const ref = setId ? baseRef.child(setId) : baseRef.push();

        if (!setId) {
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
    // Shortcuts inside the 問題編集 inline panel, so add/save are reachable
    // without leaving that panel or opening the cart modal.
    document.getElementById('creator-inline-add-btn')?.addEventListener('click', () => {
        if (window.App.Creator.editingIndex !== null) window.App.Creator.update();
        else window.App.Creator.add();
    });
    document.getElementById('creator-inline-save-btn')?.addEventListener('click', () => window.App.Creator.save());

    document.getElementById('cancel-update-btn')?.addEventListener('click', () => window.App.Creator.resetForm());
    document.getElementById('save-to-cloud-btn')?.addEventListener('click', () => window.App.Creator.save());
});
