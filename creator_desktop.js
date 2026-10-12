/* =========================================================
 * creator_desktop.js — PC版の問題作成（3列レイアウト）
 *
 * 画面幅が広い時（1024px以上）だけ、問題作成を3列に並べる。
 *   左   … 問題一覧（クリックで編集・ドラッグで並べ替え・削除）
 *   中央 … 本番と同じ16:9のプレビューに直接入力（従来の作成画面）
 *   右   … 設定パネル（この問題／見た目／ルール）
 *
 * 従来の部品（プレビュー・設定パネル）のDOMをそのまま左右の列へ移すだけで、
 * 中身の描画や保存は App.Creator のまま。スマホ幅に戻ると元の場所へ戻す。
 * =======================================================*/

window.App = window.App || {};

App.CreatorDesktop = {
    MEDIA: '(min-width: 1024px)',
    _home: null, // 移す前の場所 { node: {parent, next} }

    isDesktop: function () {
        return !!(window.matchMedia && window.matchMedia(this.MEDIA).matches);
    },
    view: function () { return document.getElementById('creator-view'); },
    C: function () { return window.App.Creator; },
    esc: function (v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    ensureDom: function () {
        const view = this.view();
        if (!view || document.getElementById('cp-layout')) return;
        const layout = document.createElement('div');
        layout.id = 'cp-layout';
        layout.innerHTML = `
            <aside id="cp-left">
                <div class="cp-col-head">
                    <span>問題一覧</span>
                    <span id="cp-type-chip" class="cm-chip"></span>
                </div>
                <div id="cp-warn" class="cm-warn hidden"></div>
                <div id="cp-qlist"></div>
                <button type="button" id="cp-new-btn" class="cp-new-btn">＋ 新しい問題</button>
            </aside>
            <section id="cp-center">
                <div id="cp-center-head">
                    <span id="cp-edit-title"></span>
                </div>
                <div id="cp-center-slot"></div>
                <div class="cp-shortcuts">Ctrl / ⌘ + Enter：追加・更新　　Ctrl / ⌘ + S：保存</div>
            </section>
            <aside id="cp-right">
                <div class="cp-tabs" role="tablist">
                    <button type="button" class="cp-tab" data-cp-panel="edit">この問題</button>
                    <button type="button" class="cp-tab" data-cp-panel="design">見た目</button>
                    <button type="button" class="cp-tab" data-cp-panel="rules">ルール</button>
                </div>
                <div id="cp-scope" class="cp-scope"></div>
                <div id="cp-right-slot"></div>
            </aside>
        `;
        const header = view.querySelector('.view-header');
        const banner = document.getElementById('cm-draft-banner');
        const anchor = (banner && banner.parentNode === view) ? banner : header;
        view.insertBefore(layout, anchor ? anchor.nextSibling : view.firstChild);

        document.getElementById('cp-new-btn').onclick = () => this.newQuestion();
        layout.querySelectorAll('[data-cp-panel]').forEach(btn => {
            btn.onclick = () => this.C().toggleInlinePanel(btn.dataset.cpPanel);
        });

        if (window.matchMedia) {
            const mq = window.matchMedia(this.MEDIA);
            const onChange = () => this.apply();
            if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
        }
        document.addEventListener('keydown', (e) => this.onKey(e));
    },

    // 中央にプレビュー（#creator-editor-wrap）、右に設定パネル
    // （#creator-inline-edit-area）を移す／元に戻す
    move: function (toDesktop) {
        const editor = document.getElementById('creator-editor-wrap');
        const panel = document.getElementById('creator-inline-edit-area');
        if (!editor || !panel) return;
        if (!this._home) {
            this._home = {
                editor: { parent: editor.parentNode, next: editor.nextSibling },
                panel: { parent: panel.parentNode, next: panel.nextSibling },
            };
        }
        if (toDesktop) {
            const cs = document.getElementById('cp-center-slot');
            const rs = document.getElementById('cp-right-slot');
            if (editor.parentNode !== cs) cs.appendChild(editor);
            if (panel.parentNode !== rs) rs.appendChild(panel);
        } else {
            const h = this._home;
            if (editor.parentNode !== h.editor.parent) h.editor.parent.insertBefore(editor, h.editor.next);
            if (panel.parentNode !== h.panel.parent) h.panel.parent.insertBefore(panel, h.panel.next);
        }
    },

    apply: function () {
        const view = this.view();
        if (!view) return;
        this.ensureDom();
        const on = this.isDesktop();
        view.classList.toggle('cp-on', on);
        this.move(on);
        if (!on) return;
        const C = this.C();
        // 左の列が問題一覧なので、右の「問題リスト」パネルは使わない
        if (!C.activeInlinePanel || C.activeInlinePanel === 'list') C.toggleInlinePanel('edit');
        this.renderList();
        this.renderTabs();
        this.renderEditTitle();
    },

    onOpen: function () { this.apply(); },

    renderTabs: function () {
        const C = this.C();
        document.querySelectorAll('#cp-right [data-cp-panel]').forEach(b => {
            b.classList.toggle('cp-tab-on', b.dataset.cpPanel === C.activeInlinePanel);
        });
        const scope = document.getElementById('cp-scope');
        if (scope) {
            const k = C.activeInlinePanel;
            scope.textContent = (k === 'design' || k === 'rules')
                ? 'セット全体に効く設定です'
                : (C.editingIndex === null ? '新しい問題の設定' : `Q${C.editingIndex + 1} だけの設定`);
        }
    },

    renderEditTitle: function () {
        const C = this.C();
        const el = document.getElementById('cp-edit-title');
        if (!el) return;
        const qs = window.App.Data.createdQuestions || [];
        el.textContent = C.editingIndex === null ? `新しい問題（Q${qs.length + 1}）` : `Q${C.editingIndex + 1} を編集中`;
    },

    // ---------------------------------------------------------
    // 左：問題一覧
    // ---------------------------------------------------------
    renderList: function () {
        const box = document.getElementById('cp-qlist');
        if (!box || !this.isDesktop()) return;
        const C = this.C();
        const qs = window.App.Data.createdQuestions || [];
        const sel = document.getElementById('creator-q-type');
        const labels = (window.App.CreatorMobile && window.App.CreatorMobile.TYPE_LABELS) || {};
        const chip = document.getElementById('cp-type-chip');
        if (chip) chip.textContent = `${labels[sel && sel.value] || '問題'}・${qs.length}問`;

        const check = window.App.QuizCheck;
        const bad = check ? check.incompleteIn(qs).length : 0;
        const warn = document.getElementById('cp-warn');
        if (warn) {
            warn.classList.toggle('hidden', !bad);
            warn.textContent = bad ? `未完成の問題が${bad}問あります（このままでは出題できません）` : '';
        }

        if (!qs.length) {
            box.innerHTML = '<div class="cp-empty">まだ問題がありません。<br>中央のプレビューに入力して<br>「リストに追加」してください。</div>';
        } else {
            box.innerHTML = qs.map((q, i) => {
                const missing = check ? check.missing(q) : [];
                const on = C.editingIndex === i;
                return `
                    <div class="cp-qrow${on ? ' cp-on-row' : ''}${missing.length ? ' cm-bad' : ''}" data-idx="${i}" title="${this.esc(q.q)}">
                        <span class="cm-handle" aria-label="ドラッグで並べ替え">⋮⋮</span>
                        <span class="cp-qnum">Q${i + 1}</span>
                        <span class="cp-qtext">${this.esc(q.q || '（問題文なし）')}${missing.length ? `<small>未完成：${this.esc(missing.join('・'))}</small>` : ''}</span>
                        <button type="button" class="cm-qdel" data-idx="${i}" aria-label="Q${i + 1}を削除">×</button>
                    </div>`;
            }).join('');
            box.querySelectorAll('.cp-qrow').forEach(row => {
                row.onclick = (e) => {
                    if (e.target.closest('.cm-qdel') || e.target.closest('.cm-handle')) return;
                    this.openQuestion(parseInt(row.dataset.idx, 10));
                };
            });
            box.querySelectorAll('.cm-qdel').forEach(btn => {
                btn.onclick = (e) => { e.stopPropagation(); C.delete(parseInt(btn.dataset.idx, 10)); };
            });
        }

        if (window.Sortable && !box._cpSortable) {
            box._cpSortable = window.Sortable.create(box, {
                handle: '.cm-handle', animation: 150, draggable: '.cp-qrow',
                onEnd: (evt) => {
                    if (evt.oldIndex === evt.newIndex) return;
                    const arr = window.App.Data.createdQuestions;
                    const editing = C.editingIndex !== null ? arr[C.editingIndex] : null;
                    const [moved] = arr.splice(evt.oldIndex, 1);
                    arr.splice(evt.newIndex, 0, moved);
                    if (editing) C.editingIndex = arr.indexOf(editing);
                    C.renderList();
                },
            });
        }
        this.renderEditTitle();
        this.renderTabs();
    },

    // 書きかけの新しい問題があれば、移る前に追加するか確認する。
    // 戻り値 false なら移動を中止（入力不足でアラートが出た時）。
    settleDraft: function () {
        const C = this.C();
        const qs = window.App.Data.createdQuestions;
        if (C.editingIndex !== null) return true; // 既存の問題は C.edit() が自動で反映する
        const text = (document.getElementById('question-text')?.value || '').trim();
        if (!text) return true;
        if (!confirm('書きかけの問題があります。リストに追加してから移動しますか？\n（キャンセルすると書きかけの内容は消えます）')) return true;
        const before = qs.length;
        C.add();
        return qs.length > before;
    },

    openQuestion: function (index) {
        const C = this.C();
        if (C.editingIndex === index) return;
        if (!this.settleDraft()) return;
        C.edit(index);
        this.renderList();
    },

    newQuestion: function () {
        const C = this.C();
        if (C.editingIndex !== null) {
            C.update();
            if (C.editingIndex !== null) return; // 入力不足
        } else if (!this.settleDraft()) {
            return;
        }
        if (C.previewSlide !== 'question') C.setPreviewSlide('question');
        C.resetForm();
        this.renderList();
        setTimeout(() => document.getElementById('question-text')?.focus(), 30);
    },

    // ---------------------------------------------------------
    // キーボード操作
    // ---------------------------------------------------------
    onKey: function (e) {
        const view = this.view();
        if (!view || view.classList.contains('hidden') || !this.isDesktop()) return;
        if (!(e.ctrlKey || e.metaKey)) return;
        const C = this.C();
        if (e.key === 'Enter') {
            e.preventDefault();
            if (C.editingIndex !== null) C.update(); else C.add();
            setTimeout(() => document.getElementById('question-text')?.focus(), 30);
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            C.save();
        }
    },
};

/* App.Creator への差し込み */
(function hookCreatorDesktop() {
    const C = window.App.Creator;
    if (!C) return;
    const after = (name, fn) => {
        const orig = C[name];
        if (typeof orig !== 'function') return;
        C[name] = function () {
            const r = orig.apply(this, arguments);
            try { fn.apply(this, arguments); } catch (e) { console.warn('creator_desktop hook', name, e); }
            return r;
        };
    };
    after('initWithType', function () { App.CreatorDesktop.onOpen(); });
    after('loadSet', function () { App.CreatorDesktop.onOpen(); });
    after('renderList', function () { App.CreatorDesktop.renderList(); });
    after('edit', function () { App.CreatorDesktop.renderEditTitle(); App.CreatorDesktop.renderTabs(); });
    after('resetForm', function () { App.CreatorDesktop.renderEditTitle(); App.CreatorDesktop.renderTabs(); });
    after('toggleInlinePanel', function () { App.CreatorDesktop.renderTabs(); });
    // 入力欄を作り直した直後は文字サイズ（小/中/大）が未反映で小さいまま
    // だったので、作り直すたびにデザインを当て直す（PC・スマホ共通）
    after('renderForm', function () { setTimeout(() => { try { C.applyDesignToPreview(); } catch (e) { /* noop */ } }, 0); });
})();
