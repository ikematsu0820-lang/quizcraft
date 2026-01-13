/* =========================================================
 * host_creator.js (v112: Modal UI Implementation)
 * =======================================================*/

// ★ 安全装置
window.App = window.App || {};

window.App.Creator = {
    editingIndex: null,
    editingTitle: "",
    currentLetterSteps: [], 

    init: function() {
        this.editingIndex = null;
        this.editingTitle = "";
        window.App.Data.createdQuestions = [];
        window.App.State.editingSetId = null;
        this.currentLetterSteps = [];

        const btnSave = document.getElementById('save-to-cloud-btn');
        if(btnSave) btnSave.textContent = APP_TEXT.Creator.BtnSave;

        if(window.resetGlobalSettings) window.resetGlobalSettings();

        this.setupTypeSelect();
        this.resetForm();
        this.renderList();
        window.App.Ui.showView(window.App.Ui.views.creator);

        const typeSelect = document.getElementById('creator-q-type');
        if(typeSelect) {
            typeSelect.disabled = false;
            document.getElementById('creator-type-locked-msg').classList.add('hidden');
            this.renderForm(typeSelect.value);
        }
    },

    setupTypeSelect: function() {
        const sel = document.getElementById('creator-q-type');
        if(!sel || sel.options.length > 0) return;

        const opts = [
            { v: 'choice', t: APP_TEXT.Creator.TypeChoice },
            { v: 'letter_select', t: '文字選択 (Letter Panel)' },
            { v: 'sort', t: APP_TEXT.Creator.TypeSort },
            { v: 'free_oral', t: APP_TEXT.Creator.TypeFreeOral },
            { v: 'free_written', t: APP_TEXT.Creator.TypeFreeWritten },
            { v: 'multi', t: APP_TEXT.Creator.TypeMulti }
        ];
        opts.forEach(o => {
            const el = document.createElement('option');
            el.value = o.v;
            el.textContent = o.t;
            sel.appendChild(el);
        });
        
        sel.onchange = (e) => {
            if(window.App.Data.createdQuestions.length === 0) this.renderForm(e.target.value);
        };
    },

    loadSet: function(key, item) {
        window.App.State.editingSetId = key;
        this.editingTitle = item.title || "";
        window.App.Data.createdQuestions = item.questions || [];

        const btnSave = document.getElementById('save-to-cloud-btn');
        if(btnSave) btnSave.textContent = APP_TEXT.Creator.BtnUpdate;

        this.setupTypeSelect();

        const typeSelect = document.getElementById('creator-q-type');
        if(window.App.Data.createdQuestions.length > 0) {
            const firstQ = window.App.Data.createdQuestions[0];
            typeSelect.value = firstQ.type;
            typeSelect.disabled = true;
            document.getElementById('creator-type-locked-msg').classList.remove('hidden');

            if(document.getElementById('creator-set-layout')) document.getElementById('creator-set-layout').value = firstQ.layout || 'standard';
            if(window.updateAlignUI) window.updateAlignUI(firstQ.align || 'center');
            
            if(window.applyDesignToUI && firstQ.design) {
                window.applyDesignToUI(firstQ.design, firstQ.layout, firstQ.align);
            }
        } else {
            typeSelect.disabled = false;
            document.getElementById('creator-type-locked-msg').classList.add('hidden');
        }

        this.resetForm();
        this.renderList();
        window.App.Ui.showView(window.App.Ui.views.creator);
    },

    resetForm: function() {
        this.editingIndex = null;
        this.currentLetterSteps = []; 
        document.getElementById('creator-form-title').textContent = APP_TEXT.Creator.HeadingNewQ;
        document.getElementById('add-question-btn').classList.remove('hidden');
        document.getElementById('update-question-area').classList.add('hidden');
        document.getElementById('question-text').value = '';
        
        const typeSelect = document.getElementById('creator-q-type');
        const type = typeSelect ? typeSelect.value : 'choice'; 
        this.renderForm(type);
    },

    renderForm: function(type, data = null) {
        const container = document.getElementById('creator-form-container');
        if(!container) return; 
        container.innerHTML = ''; 

        if (type === 'choice') {
            const choicesDiv = document.createElement('div');
            choicesDiv.id = 'creator-choices-list';
            choicesDiv.className = 'grid-gap-5';
            container.appendChild(choicesDiv);

            if (data) data.c.forEach((txt, i) => this.addChoiceInput(choicesDiv, i, txt, data.correct.includes(i)));
            else for(let i=0; i<4; i++) this.addChoiceInput(choicesDiv, i);

            this.createAddBtn(container, APP_TEXT.Creator.BtnAddChoice, () => this.addChoiceInput(choicesDiv));
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
            const initVal = data ? data.initialOrder : 'random';
            container.innerHTML = `
                <p class="text-sm text-gray mb-5">${APP_TEXT.Creator.DescSort}</p>
                <label class="text-sm bold">${APP_TEXT.Creator.LabelSortInitial}</label>
                <select id="sort-initial-order" class="mb-10 config-select btn-block"><option value="random" ${initVal==='random'?'selected':''}>${APP_TEXT.Creator.SortInitialRandom}</option><option value="fixed" ${initVal==='fixed'?'selected':''}>${APP_TEXT.Creator.SortInitialFixed}</option></select>
            `;
            const sortDiv = document.createElement('div');
            sortDiv.className = 'flex-col gap-5';
            container.appendChild(sortDiv);

            if (data) data.c.forEach((txt, i) => this.addSortInput(sortDiv, i, txt));
            else for(let i=0; i<4; i++) this.addSortInput(sortDiv, i);

            this.createAddBtn(container, APP_TEXT.Creator.BtnAddSort, () => this.addSortInput(sortDiv));
        }
        else if (type.startsWith('free')) {
            container.innerHTML = `<p class="text-sm text-gray mb-5">${APP_TEXT.Creator.DescText}</p>`;
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'creator-text-answer';
            input.className = 'btn-block';
            input.placeholder = 'Answer Keyword';
            if (data && data.correct) input.value = Array.isArray(data.correct) ? data.correct.join(', ') : data.correct;
            container.appendChild(input);
        }
        else if (type === 'multi') {
            container.innerHTML = `<p class="text-sm text-gray mb-5">${APP_TEXT.Creator.DescMulti}</p>`;
            const multiDiv = document.createElement('div');
            multiDiv.className = 'grid-gap-5';
            container.appendChild(multiDiv);

            if (data) data.c.forEach((txt, i) => this.addMultiInput(multiDiv, i, txt));
            else for(let i=0; i<5; i++) this.addMultiInput(multiDiv, i);

            this.createAddBtn(container, APP_TEXT.Creator.BtnAddMulti, () => this.addMultiInput(multiDiv));
        }
    },

    // ★ ステップ一覧描画
    renderLetterStepList: function() {
        const list = document.getElementById('letter-step-container');
        if(!list) return;
        list.innerHTML = '';

        this.currentLetterSteps.forEach((step, i) => {
            const btn = document.createElement('div');
            btn.className = 'letter-step-item';
            btn.innerHTML = `
                <span class="step-badge">${i+1}</span>
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
    openLetterModal: function(index) {
        const isNew = (index >= this.currentLetterSteps.length);
        // ダミー文字は画像に合わせて3つに固定
        const data = isNew ? { correct: '', dummies: ['', '', ''] } : this.currentLetterSteps[index];
        const dummies = data.dummies || ['', '', ''];
        while(dummies.length < 3) dummies.push('');

        const modalHtml = `
            <div id="letter-modal" class="letter-modal-overlay">
                <div class="letter-modal-window">
                    <div class="letter-modal-header">
                        <span>解答選択肢 ${index + 1}/${isNew ? index+1 : this.currentLetterSteps.length}</span>
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
            if(firstInput) firstInput.focus();
        }, 100);

        // ボタンイベント
        document.getElementById('modal-btn-save').onclick = () => {
            const correct = document.getElementById('modal-input-correct').value.trim();
            const dummyInputs = document.querySelectorAll('.modal-input-dummy');
            const newDummies = [];
            dummyInputs.forEach(inp => { if(inp.value.trim()) newDummies.push(inp.value.trim()); });

            if(!correct) return alert("正解文字は必須です");

            const stepData = { correct: correct, dummies: newDummies };
            
            if(isNew) this.currentLetterSteps.push(stepData);
            else this.currentLetterSteps[index] = stepData;

            this.renderLetterStepList();
            document.getElementById('letter-modal').remove();
        };

        if(!isNew) {
            document.getElementById('modal-btn-delete').onclick = () => {
                if(confirm("このステップを削除しますか？")) {
                    this.currentLetterSteps.splice(index, 1);
                    this.renderLetterStepList();
                    document.getElementById('letter-modal').remove();
                }
            };
        }
    },

    // --- 以下、既存ロジック ---
    addChoiceInput: function(parent, index, text="", checked=false) {
        if (parent.children.length >= 20) { alert(APP_TEXT.Creator.AlertMaxChoice); return; }
        const row = document.createElement('div');
        row.className = 'choice-row flex-center gap-5 p-5';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'choice-correct-chk';
        chk.checked = checked;
        chk.style.display = 'none';
        const labelBtn = document.createElement('div');
        labelBtn.className = 'choice-label-btn';
        if(checked) labelBtn.classList.add('active');
        labelBtn.onclick = () => {
            chk.checked = !chk.checked;
            if(chk.checked) labelBtn.classList.add('active');
            else labelBtn.classList.remove('active');
        };
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'choice-text-input flex-1';
        inp.placeholder = 'Choice';
        inp.value = text;
        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.className = 'btn-mini btn-dark w-30';
        delBtn.onclick = () => { row.remove(); this.updateLabels(parent); };
        row.appendChild(chk); row.appendChild(labelBtn); row.appendChild(inp); row.appendChild(delBtn);
        parent.appendChild(row);
        this.updateLabels(parent);
    },

    addSortInput: function(parent, index, text="") {
        const row = document.createElement('div');
        row.className = 'sort-row flex-center gap-5';
        row.innerHTML = `
            <span class="sort-label bold cyan text-lg w-25 text-center">A</span>
            <input type="text" class="sort-text-input flex-1" placeholder="Item" value="${text}">
            <button class="btn-mini btn-dark w-30">×</button>
        `;
        row.querySelector('button').onclick = () => { row.remove(); this.updateSortLabels(parent); };
        parent.appendChild(row);
        this.updateSortLabels(parent);
    },

    addMultiInput: function(parent, index, text="") {
        const row = document.createElement('div');
        row.className = 'flex-center gap-5';
        row.innerHTML = `
            <span>✅</span><input type="text" class="multi-text-input flex-1" placeholder="Answer" value="${text}">
            <button class="btn-mini btn-dark w-30">×</button>
        `;
        row.querySelector('button').onclick = () => row.remove();
        parent.appendChild(row);
    },

    createAddBtn: function(parent, text, onClick) {
        const btn = document.createElement('button');
        btn.className = 'btn-info btn-mini mt-10';
        btn.textContent = text;
        btn.onclick = onClick;
        parent.appendChild(btn);
    },

    updateLabels: function(parent) {
        parent.querySelectorAll('.choice-label-btn').forEach((el, i) => el.textContent = String.fromCharCode(65 + i));
    },
    updateSortLabels: function(parent) {
        parent.querySelectorAll('.sort-label').forEach((el, i) => el.textContent = String.fromCharCode(65 + i));
    },

    getData: function() {
        const qText = document.getElementById('question-text').value.trim();
        if(!qText) { alert(APP_TEXT.Creator.AlertNoQ); return null; }
        const type = document.getElementById('creator-q-type').value;
        let newQ = { q: qText, type: type, points: 1, loss: 0 };

        if (type === 'choice') {
            const rows = document.querySelectorAll('.choice-row');
            const opts = [], corr = [];
            rows.forEach((row, i) => {
                const val = row.querySelector('.choice-text-input').value.trim();
                if(val) { 
                    opts.push(val); 
                    if(row.querySelector('.choice-correct-chk').checked) corr.push(opts.length-1); 
                }
            });
            if(opts.length < 2 || corr.length === 0) { alert(APP_TEXT.Creator.AlertLessChoice); return null; }
            newQ.c = opts; newQ.correct = corr; newQ.correctIndex = corr[0];
            newQ.multi = (corr.length > 1);
            
        } 
        // ★修正: 文字選択式のデータ保存 (Stepsを保存)
        else if (type === 'letter_select') {
            if (this.currentLetterSteps.length === 0) {
                alert("少なくとも1文字のステップを作成してください");
                return null;
            }
            newQ.steps = this.currentLetterSteps;
            newQ.correct = this.currentLetterSteps.map(s => s.correct).join('');
            
        } else if (type === 'sort') {
            const opts = [];
            document.querySelectorAll('.sort-text-input').forEach(inp => { if(inp.value.trim()) opts.push(inp.value.trim()); });
            if(opts.length < 2) return null;
            newQ.c = opts; newQ.correct = opts.map((_,i)=>i);
            newQ.initialOrder = document.getElementById('sort-initial-order').value;
        } else if (type.startsWith('free')) {
            const ans = document.getElementById('creator-text-answer').value.trim();
            if(type==='free_written' && !ans) { alert(APP_TEXT.Creator.AlertNoTextAns); return null; }
            newQ.correct = ans ? ans.split(',').map(s=>s.trim()).filter(s=>s) : [];
        } else if (type === 'multi') {
            const opts = [];
            document.querySelectorAll('.multi-text-input').forEach(inp => { if(inp.value.trim()) opts.push(inp.value.trim()); });
            if(opts.length < 1) return null;
            newQ.c = opts; newQ.correct = opts;
        }
        return newQ;
    },

    add: function() {
        const q = this.getData();
        if(q) {
            window.App.Data.createdQuestions.push(q);
            this.resetForm();
            this.renderList();
            window.App.Ui.showToast(APP_TEXT.Creator.MsgAddedToast);
            document.getElementById('creator-q-type').disabled = true;
            document.getElementById('creator-type-locked-msg').classList.remove('hidden');
        }
    },

    update: function() {
        if(this.editingIndex === null) return;
        const q = this.getData();
        if(q) {
            window.App.Data.createdQuestions[this.editingIndex] = { ...window.App.Data.createdQuestions[this.editingIndex], ...q };
            this.resetForm();
            this.renderList();
            window.App.Ui.showToast(APP_TEXT.Creator.MsgUpdatedToast);
        }
    },

    edit: function(index) {
        this.editingIndex = index;
        const q = window.App.Data.createdQuestions[index];
        document.getElementById('creator-form-title').textContent = APP_TEXT.Creator.HeadingEditQ;
        document.getElementById('add-question-btn').classList.add('hidden');
        document.getElementById('update-question-area').classList.remove('hidden');
        document.getElementById('question-text').value = q.q;
        this.renderForm(q.type, q);
        document.getElementById('creator-view').scrollIntoView({behavior:"smooth"});
    },

    delete: function(index) {
        if(confirm(APP_TEXT.Dashboard.DeleteConfirm)) {
            window.App.Data.createdQuestions.splice(index, 1);
            if(this.editingIndex === index) this.resetForm();
            this.renderList();
            if(window.App.Data.createdQuestions.length === 0) {
                document.getElementById('creator-q-type').disabled = false;
                document.getElementById('creator-type-locked-msg').classList.add('hidden');
                this.renderForm(document.getElementById('creator-q-type').value);
            }
        }
    },

    move: function(index, dir) {
        if ((dir === -1 && index > 0) || (dir === 1 && index < window.App.Data.createdQuestions.length - 1)) {
            const arr = window.App.Data.createdQuestions;
            [arr[index], arr[index + dir]] = [arr[index + dir], arr[index]];
            this.renderList();
        }
    },

    renderList: function() {
        const list = document.getElementById('q-list');
        list.innerHTML = '';
        window.App.Data.createdQuestions.forEach((q, i) => {
            const div = document.createElement('div');
            div.className = 'q-list-item flex-between';
            let icon = '🔳';
            if (q.type === 'letter_select') icon = '🔠';
            else if (q.type === 'sort') icon = '🔢';
            else if (q.type.startsWith('free')) icon = '✍️';
            else if (q.type === 'multi') icon = '📚';

            div.innerHTML = `
                <div class="text-sm bold">${icon} Q${i+1}. ${q.q}</div>
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

    save: function() {
        if(window.App.Data.createdQuestions.length === 0) { alert('No questions'); return; }
        const title = prompt("セット名を入力:", this.editingTitle);
        if(!title) return;

        const layout = document.getElementById('creator-set-layout').value;
        const align = document.getElementById('creator-set-align').value;
        const design = window.collectDesignSettings ? window.collectDesignSettings().design : {};

        window.App.Data.createdQuestions.forEach(q => {
            q.layout = layout; q.align = align; q.design = design; q.specialMode = 'none';
        });

        const data = {
            title: title,
            config: { eliminationRule: 'none', scoreUnit: 'point', theme: 'light' },
            questions: window.App.Data.createdQuestions,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        const path = `saved_sets/${window.App.State.currentShowId}`;
        const ref = window.App.State.editingSetId ? window.db.ref(`${path}/${window.App.State.editingSetId}`) : window.db.ref(path).push();
        
        (window.App.State.editingSetId ? ref.update(data) : ref.set(data)).then(() => {
            window.App.Ui.showToast(APP_TEXT.Creator.MsgSavedToast);
            window.App.Dashboard.enter();
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
