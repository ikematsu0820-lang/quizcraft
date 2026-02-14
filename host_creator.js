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

        const btnSave = document.getElementById('save-to-cloud-btn');
        if (btnSave) btnSave.textContent = APP_TEXT.Creator.BtnSave;

        if (window.resetGlobalSettings) window.resetGlobalSettings();

        this.setupTypeSelect();
        this.resetForm();
        this.renderList();
        window.App.Ui.showView(window.App.Ui.views.creator);

        const sel = document.getElementById('creator-q-type');
        const subArea = document.getElementById('creator-q-subtype-area');
        const subSel = document.getElementById('creator-q-subtype');
        if (sel) {
            sel.disabled = false;
            subSel.disabled = false;
            subArea.classList.add('hidden');
            document.getElementById('creator-type-locked-msg').classList.add('hidden');
            this.renderForm(sel.value === 'free' ? subSel.value : sel.value);
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
            { v: 'multi_group', t: APP_TEXT.Creator.TypeMulti }
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

        const updateSubTypes = (mainVal) => {
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
                    { v: 'multi_oral', t: APP_TEXT.Creator.TypeMultiOral }
                ];
            } else if (mainVal === 'choice') {
                subItems = [
                    { v: 'choice_single', t: "2-1) 単一回答" },
                    { v: 'choice_multi', t: "2-2) ドボン問題" }
                ];
            }

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
            if (val === 'free' || val === 'multi_group' || val === 'choice') {
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

            if (type.startsWith('free') || type === 'letter_select') {
                sel.value = 'free';
                const updateSubTypes = (mainVal) => {
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
                            { v: 'multi_oral', t: APP_TEXT.Creator.TypeMultiOral }
                        ];
                    } else if (mainVal === 'choice') {
                        subItems = [
                            { v: 'choice_single', t: "2-1) 単一回答" },
                            { v: 'choice_multi', t: "2-2) ドボン問題" }
                        ];
                    }
                    subItems.forEach(o => {
                        const el = document.createElement('option');
                        el.value = o.v;
                        el.textContent = o.t;
                        subSel.appendChild(el);
                    });
                };
                updateSubTypes('free');
                subArea.classList.remove('hidden');
                subSel.value = type;
            } else if (type.startsWith('multi')) {
                sel.value = 'multi_group';
                const updateSubTypes = (mainVal) => {
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
                            { v: 'multi_oral', t: APP_TEXT.Creator.TypeMultiOral }
                        ];
                    } else if (mainVal === 'choice') {
                        subItems = [
                            { v: 'choice_single', t: "2-1) 単一回答" },
                            { v: 'choice_multi', t: "2-2) ドボン問題" }
                        ];
                    }
                    subItems.forEach(o => {
                        const el = document.createElement('option');
                        el.value = o.v;
                        el.textContent = o.t;
                        subSel.appendChild(el);
                    });
                };
                updateSubTypes('multi_group');
                subArea.classList.remove('hidden');
                subSel.value = type;
            } else if (type === 'choice') {
                sel.value = 'choice';
                const updateSubTypes = (mainVal) => {
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
                            { v: 'multi_oral', t: APP_TEXT.Creator.TypeMultiOral }
                        ];
                    } else if (mainVal === 'choice') {
                        subItems = [
                            { v: 'choice_single', t: "2-1) 単一回答" },
                            { v: 'choice_multi', t: "2-2) ドボン問題" }
                        ];
                    }
                    subItems.forEach(o => {
                        const el = document.createElement('option');
                        el.value = o.v;
                        el.textContent = o.t;
                        subSel.appendChild(el);
                    });
                };
                updateSubTypes('choice');
                subArea.classList.remove('hidden');
                const isMulti = firstQ.multi || firstQ.mode === 'multi';
                subSel.value = isMulti ? 'choice_multi' : 'choice_single';
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
        document.getElementById('update-question-area').classList.add('hidden');
        document.getElementById('question-text').value = '';
        document.getElementById('creator-commentary').value = '';

        const sel = document.getElementById('creator-q-type');
        const subSel = document.getElementById('creator-q-subtype');
        const type = (sel && (['free', 'multi_group', 'choice'].includes(sel.value))) ? subSel.value : (sel ? sel.value : 'choice');
        this.renderForm(type);
    },

    renderForm: function (type, data = null) {
        const container = document.getElementById('creator-form-container');
        if (!container) return;
        container.innerHTML = '';

        // Handle Choice Subtypes
        if (type === 'choice_single') {
            this.choiceSubtype = 'single';
            type = 'choice';
        } else if (type === 'choice_multi') {
            this.choiceSubtype = 'multi';
            type = 'choice';
        }

        if (type === 'choice') {
            const subtype = this.choiceSubtype || 'single';

            const isDobon = (this.choiceSubtype === 'multi');
            const msg = isDobon ? "不正解を選択してください。" : "正解を選択してください。";

            container.innerHTML = `
                <div class="flex-between mb-5">
                    <p class="text-sm text-gray mb-0">${msg}</p>
                </div>
            `;

            const choicesDiv = document.createElement('div');
            choicesDiv.id = 'creator-choices-list';
            choicesDiv.className = 'grid-gap-5';
            container.appendChild(choicesDiv);


            // Bind Radio Change
            container.querySelectorAll('input[name="choice-subtype"]').forEach(r => {
                r.onchange = (e) => {
                    this.choiceSubtype = e.target.value;
                    // Re-render inputs to update click behavior and visuals
                    // To preserve text, we might want to read current values first?
                    // For simplicity, we just update the *behavior* of existing inputs if possible,
                    // or re-render using current data.
                    // Let's grab current data and re-render.
                    const currentData = [];
                    choicesDiv.querySelectorAll('.choice-row').forEach(row => {
                        currentData.push({
                            text: row.querySelector('.choice-text-input').value,
                            checked: row.querySelector('.choice-correct-chk').checked
                        });
                    });

                    choicesDiv.innerHTML = '';
                    currentData.forEach((d, i) => {
                        // If switching to Single, clear checks except maybe first? 
                        // Or just let addChoiceInput handle it (it respects checked param).
                        // If user switches Multi->Single, valid to have multiple checked initially?
                        // No, validation will catch it. Or we can force clear.
                        // Let's enforce single check if Single mode.
                        let isChecked = d.checked;
                        if (this.choiceSubtype === 'single' && isChecked) {
                            // Only allow one? Loop logic difficult here.
                            // Simplest: Uncheck all if switching to Single? Or keep inputs.
                        }
                        this.addChoiceInput(choicesDiv, i, d.text, d.checked);
                    });
                    // Ensure at least 4 inputs if empty (though logic above handles existing)
                    if (currentData.length === 0) for (let i = 0; i < 4; i++) this.addChoiceInput(choicesDiv, i);

                    // Update shuffle box visibility? No, shuffle applies to both.
                };
            });

            if (data) {
                // If editing, determine subtype from data
                if (data.multi) this.choiceSubtype = 'multi';
                else this.choiceSubtype = 'single';

                // Update radio
                const r = container.querySelector(`input[name="choice-subtype"][value="${this.choiceSubtype}"]`);
                if (r) r.checked = true;

                data.c.forEach((txt, i) => this.addChoiceInput(choicesDiv, i, txt, data.correct.includes(i)));
            }
            else for (let i = 0; i < 4; i++) this.addChoiceInput(choicesDiv, i);

            this.createAddBtn(container, APP_TEXT.Creator.BtnAddChoice, () => this.addChoiceInput(choicesDiv));

            // Shuffle option
            const shuffleDiv = document.createElement('div');
            shuffleDiv.className = 'config-group mt-10';
            shuffleDiv.innerHTML = `
                <label class="config-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="choice-shuffle-chk" ${data?.shuffle !== false ? 'checked' : ''}>
                    <span>選択肢をシャッフルする</span>
                </label>
                <p class="text-sm text-gray" style="margin:5px 0 0 0;">※チェックを外すと、選択肢が常に同じ順序で表示されます</p>
            `;
            container.appendChild(shuffleDiv);
        }

        // --- 文字選択式 ---
        else if (type === 'letter_select') {
            if (data && data.steps) {
                this.currentLetterSteps = JSON.parse(JSON.stringify(data.steps));
            } else if (this.currentLetterSteps.length === 0) {
                this.currentLetterSteps = [];
            }

            container.innerHTML = `
                <div class="mb-10">
                    <label class="config-label">解答ステップ作成</label>
                    <p class="text-sm text-gray mb-5">1文字ずつ正解とダミーを設定してください。</p>
                    <div id="letter-step-container" class="letter-step-list">
                        </div>
                </div>
            `;
            this.renderLetterStepList();
        }

        else if (type === 'sort') {
            container.innerHTML = `
                <div class="flex-between mb-5">
                    <p class="text-sm text-gray mb-0">${APP_TEXT.Creator.DescSort}</p>
                    <button id="btn-reset-sort-ranks" class="btn-mini btn-dark">順序をリセット</button>
                </div>
            `;
            const sortDiv = document.createElement('div');
            sortDiv.className = 'flex-col gap-5';
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

            this.createAddBtn(container, APP_TEXT.Creator.BtnAddSort, () => this.addSortInput(sortDiv));

            // Shuffle option for Sort
            const shuffleDiv = document.createElement('div');
            shuffleDiv.className = 'config-group mt-10';
            shuffleDiv.innerHTML = `
                <label class="config-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="sort-shuffle-chk" ${data?.shuffle !== false ? 'checked' : ''}>
                    <span>選択肢をシャッフルする</span>
                </label>
                <p class="text-sm text-gray" style="margin:5px 0 0 0;">※チェックを外すと、初期表示が固定されます（作成順）</p>
            `;
            container.appendChild(shuffleDiv);
        }
        else if (type.startsWith('free')) {
            const row = document.createElement('div');
            row.className = 'creator-row';
            row.innerHTML = `
                <label class="config-label">正解キーワード</label>
                <input type="text" id="creator-text-answer" class="btn-block flex-1" placeholder="キーワード（複数ある場合はカンマ区切り）" style="margin-bottom:0;">
            `;
            const input = row.querySelector('input');
            if (data && data.correct) {
                input.value = Array.isArray(data.correct) ? data.correct.join(', ') : data.correct;
            }
            container.appendChild(row);
        }
        else if (type.startsWith('multi')) {
            container.innerHTML = `<p class="text-sm text-gray mb-5">${APP_TEXT.Creator.DescMulti}</p>`;
            const multiDiv = document.createElement('div');
            multiDiv.className = 'grid-gap-5';
            container.appendChild(multiDiv);

            if (data) data.c.forEach((txt, i) => this.addMultiInput(multiDiv, i, txt));
            else for (let i = 0; i < 5; i++) this.addMultiInput(multiDiv, i);

            this.createAddBtn(container, APP_TEXT.Creator.BtnAddMulti, () => this.addMultiInput(multiDiv));
        }
    },

    // ★ ステップ一覧描画
    renderLetterStepList: function () {
        const list = document.getElementById('letter-step-container');
        if (!list) return;
        list.innerHTML = '';

        this.currentLetterSteps.forEach((step, i) => {
            const btn = document.createElement('div');
            btn.className = 'letter-step-item';
            btn.innerHTML = `
                <span class="step-badge">${i + 1}</span>
                ${step.correct || '?'}
            `;
            btn.onclick = () => this.openLetterModal(i);
            list.appendChild(btn);
        });

        const addBtn = document.createElement('div');
        addBtn.className = 'letter-step-add-btn';
        addBtn.textContent = '+';
        addBtn.onclick = () => this.openLetterModal(this.currentLetterSteps.length);
        list.appendChild(addBtn);
    },

    // ★ 編集モーダル (画像のUIを再現)
    openLetterModal: function (index) {
        const isNew = (index >= this.currentLetterSteps.length);
        // ダミー文字は画像に合わせて3つに固定
        const data = isNew ? { correct: '', dummies: ['', '', ''] } : this.currentLetterSteps[index];
        const dummies = data.dummies || ['', '', ''];
        while (dummies.length < 3) dummies.push('');

        const modalHtml = `
            <div id="letter-modal" class="letter-modal-overlay">
                <div class="letter-modal-window">
                    <div class="letter-modal-header">
                        <span>解答選択肢 ${index + 1}/${isNew ? index + 1 : this.currentLetterSteps.length}</span>
                        <button class="letter-modal-close" onclick="document.getElementById('letter-modal').remove()">×</button>
                    </div>
                    <div class="letter-modal-body">
                        <div class="tag-label tag-correct">正解</div>
                        <div style="margin-bottom:10px;">
                            <input type="text" id="modal-input-correct" class="char-input-box" value="${data.correct}" maxlength="1" placeholder="あ" onfocus="this.select()">
                        </div>

                        <div class="tag-label tag-wrong">不正解</div>
                        <div class="dummy-grid">
                            <input type="text" class="char-input-box modal-input-dummy" value="${dummies[0]}" maxlength="1" placeholder="い" onfocus="this.select()">
                            <input type="text" class="char-input-box modal-input-dummy" value="${dummies[1]}" maxlength="1" placeholder="う" onfocus="this.select()">
                            <input type="text" class="char-input-box modal-input-dummy" value="${dummies[2]}" maxlength="1" placeholder="え" onfocus="this.select()">
                        </div>
                    </div>
                    <div class="letter-modal-footer">
                        ${!isNew ? '<button id="modal-btn-delete" class="btn-delete-modal">削除</button>' : ''}
                        <button id="modal-btn-save" class="btn-save-modal">保存</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 最初の入力欄にフォーカス
        setTimeout(() => {
            const firstInput = document.getElementById('modal-input-correct');
            if (firstInput) firstInput.focus();
        }, 100);

        // ボタンイベント
        document.getElementById('modal-btn-save').onclick = () => {
            const correct = document.getElementById('modal-input-correct').value.trim();
            const dummyInputs = document.querySelectorAll('.modal-input-dummy');
            const newDummies = [];
            dummyInputs.forEach(inp => { if (inp.value.trim()) newDummies.push(inp.value.trim()); });

            if (!correct) return alert("正解文字は必須です");

            const stepData = { correct: correct, dummies: newDummies };

            if (isNew) this.currentLetterSteps.push(stepData);
            else this.currentLetterSteps[index] = stepData;

            this.renderLetterStepList();
            document.getElementById('letter-modal').remove();
        };

        if (!isNew) {
            document.getElementById('modal-btn-delete').onclick = () => {
                if (confirm("このステップを削除しますか？")) {
                    this.currentLetterSteps.splice(index, 1);
                    this.renderLetterStepList();
                    document.getElementById('letter-modal').remove();
                }
            };
        }
    },

    // --- 以下、既存ロジック ---
    addChoiceInput: function (parent, index, text = "", checked = false) {
        if (parent.children.length >= 20) { alert(APP_TEXT.Creator.AlertMaxChoice); return; }
        const row = document.createElement('div');
        row.className = 'choice-row flex-center gap-5 p-5';

        // Use radio or checkbox input based on subtype
        // Note: For Single, we need 'name' to be shared across rows to enforce single selection.
        // But dynamically added rows make 'name' handling tricky if grouping isn't handled.
        // If we use standard Radio buttons, they handle mutual exclusion automatically if 'name' matches.

        const inputType = (this.choiceSubtype === 'single') ? 'radio' : 'checkbox';
        const chk = document.createElement('input');
        chk.type = inputType;
        chk.name = 'creator-choice-correct-group'; // Shared name for radios
        chk.className = 'choice-correct-chk';
        chk.checked = checked;

        // Visually, we might want to keep the labelBtn style but update it?
        // Or just use the native input + label?
        // The user asked for "Radio buttons".
        // Let's use visible inputs + Label A/B/C.

        // Remove labelBtn toggle logic, rely on browser input behavior?
        // But we want A/B/C styling.

        const labelText = String.fromCharCode(65 + index);

        // Use a wrapper label for clickability
        const wrapper = document.createElement('label');
        wrapper.className = 'choice-label-wrapper flex-center';
        wrapper.style.cursor = 'pointer';
        wrapper.style.gap = '5px';

        // Style the input slightly bigger
        chk.style.transform = 'scale(1.2)';
        chk.style.cursor = 'pointer';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'choice-label-text bold cyan text-lg w-20 text-center';
        labelSpan.textContent = labelText;

        wrapper.appendChild(chk);
        wrapper.appendChild(labelSpan);

        // If Single mode, ensure only one is checked? 
        // Browser handles it via 'name'.

        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'choice-text-input flex-1';
        inp.placeholder = 'Choice';
        inp.value = text;
        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.className = 'btn-mini btn-dark w-30';
        delBtn.onclick = () => { row.remove(); this.updateLabels(parent); };

        row.appendChild(wrapper);
        row.appendChild(inp);
        row.appendChild(delBtn);

        parent.appendChild(row);
        this.updateLabels(parent);
    },

    addSortInput: function (parent, index, text = "", rank = "") {
        const row = document.createElement('div');
        row.className = 'sort-row';

        const controlHtml = `
            <div class="sort-rank-box" style="width:40px; height:40px; border:2px solid #444; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:900; font-size:1.2em; color:var(--color-primary); background:rgba(0,0,0,0.3);">
                ${rank || ''}
            </div>
            <input type="hidden" class="sort-order-input" value="${rank || ''}">
        `;

        row.innerHTML = `
        <span class="sort-label bold cyan text-lg w-20 text-center">${String.fromCharCode(65 + index)}</span>
        <input type="text" class="sort-text-input flex-1" placeholder="項目を入力" value="${text}">
        ${controlHtml}
        <button class="btn-mini btn-dark btn-remove-sort" style="width:25px; padding:2px;">×</button>
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

    addMultiInput: function (parent, index, text = "") {
        const row = document.createElement('div');
        row.className = 'flex-center gap-5';
        row.innerHTML = `
            <input type="text" class="multi-text-input flex-1" placeholder="Answer" value="${text}">
            <button class="btn-mini btn-dark w-30">×</button>
        `;
        row.querySelector('button').onclick = () => row.remove();
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
        parent.querySelectorAll('.choice-label-text').forEach((el, i) => el.textContent = String.fromCharCode(65 + i));
    },


    getData: function () {
        const qText = document.getElementById('question-text').value.trim();
        if (!qText) { alert(APP_TEXT.Creator.AlertNoQ); return null; }
        const sel = document.getElementById('creator-q-type');
        const subSel = document.getElementById('creator-q-subtype');

        let rawType = (sel && (['free', 'multi_group', 'choice'].includes(sel.value))) ? subSel.value : (sel ? sel.value : 'choice');
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
        } else if (normalizedType.startsWith('multi')) {
            const opts = [];
            document.querySelectorAll('.multi-text-input').forEach(inp => { if (inp.value.trim()) opts.push(inp.value.trim()); });
            if (opts.length < 1) return null;
            newQ.c = opts; newQ.correct = opts;
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
        this.editingIndex = index;
        const q = window.App.Data.createdQuestions[index];
        document.getElementById('creator-form-title').textContent = APP_TEXT.Creator.HeadingEditQ;
        document.getElementById('add-question-btn').classList.add('hidden');
        document.getElementById('update-question-area').classList.remove('hidden');
        document.getElementById('question-text').value = q.q;
        document.getElementById('creator-commentary').value = q.commentary || '';
        this.renderForm(q.type, q);
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
    },

    save: function () {
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
            data.config = { mode: 'normal', gameType: 'score', theme: 'light' };
            data.createdAt = firebase.database.ServerValue.TIMESTAMP;
        }

        console.log("Saving to path:", ref.toString());

        const op = setId ? ref.update(data) : ref.set(data);

        op.then(() => {
            console.log("Save successful");
            window.App.Ui.showToast("保存しました");
            if (window.App.Dashboard && window.App.Dashboard.enter) {
                window.App.Dashboard.enter();
            } else {
                window.location.reload(); // Fallback
            }
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
    document.getElementById('cancel-update-btn')?.addEventListener('click', () => window.App.Creator.resetForm());
    document.getElementById('save-to-cloud-btn')?.addEventListener('click', () => window.App.Creator.save());
});
