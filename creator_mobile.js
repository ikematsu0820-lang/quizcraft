/* =========================================================
 * creator_mobile.js — スマホ版の問題作成
 *
 * 画面幅が狭い時（1023px以下）だけ、問題作成を次の流れに切り替える。
 *   ① 問題一覧 … 問題カードの一覧（並べ替え・追加・削除）。
 *                 セット全体の設定（見た目・ルール）はここから開く
 *   ② 問題編集 … 1問の入力に集中。下に「見る」「次の問題へ」を固定
 *   ③ モニターで確認 … 本番と同じ描画（viewer.js）で16:9を全画面表示
 *
 * PC幅の時は何もしない（従来の作成画面のまま）。データは従来どおり
 * App.Data.createdQuestions / currentDesign / currentConfig をそのまま
 * 使い、追加・更新・保存も App.Creator の関数を呼ぶだけ。
 * =======================================================*/

window.App = window.App || {};

App.CreatorMobile = {
    MEDIA: '(max-width: 1023px)',
    screen: 'list',     // 'list' | 'edit'
    _sheet: null,       // 開いている下からのパネル（'design' | 'rules' | 'bulk'）
    _moved: null,       // パネルに移したDOM（閉じる時に元の場所へ戻す）
    _previewStep: 'question',

    TYPE_LABELS: {
        free: '一問一答', assoc_group: '連想クイズ', choice: '選択式', sort: '並べ替え',
        multi_group: '多答クイズ', dobon: 'ダウト', num_group: '数字予想',
    },

    isMobile: function () {
        return !!(window.matchMedia && window.matchMedia(this.MEDIA).matches);
    },

    view: function () { return document.getElementById('creator-view'); },
    C: function () { return window.App.Creator; },

    esc: function (v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // ---------------------------------------------------------
    // 画面の土台（最初に1回だけ作る）
    // ---------------------------------------------------------
    ensureDom: function () {
        const view = this.view();
        if (!view || document.getElementById('cm-list-screen')) return;
        const wrap = document.getElementById('creator-editor-wrap');

        // ① 問題一覧
        const list = document.createElement('div');
        list.id = 'cm-list-screen';
        list.innerHTML = `
            <div class="cm-list-meta"><span id="cm-type-chip" class="cm-chip"></span><span id="cm-count"></span></div>
            <div id="cm-warn" class="cm-warn hidden"></div>
            <div id="cm-qcards"></div>
            <div class="cm-add-row">
                <button type="button" id="cm-add-btn" class="cm-add-card">＋ 問題を追加</button>
                <button type="button" id="cm-bulk-btn" class="cm-ghost-btn">まとめて貼り付け</button>
            </div>
            <div id="cm-list-bar" class="cm-bottom-bar">
                <button type="button" data-cm-sheet="design" class="cm-bar-btn">🎨<span>見た目</span></button>
                <button type="button" data-cm-sheet="rules" class="cm-bar-btn">⚙️<span>ルール</span></button>
                <button type="button" id="cm-preview-list-btn" class="cm-bar-btn">📺<span>見る</span></button>
                <button type="button" id="cm-save-btn" class="cm-bar-btn cm-primary">保存して完了</button>
            </div>
        `;
        view.insertBefore(list, wrap);

        // ② 問題編集の見出し（← 一覧 / 何問目 / 詳細）
        const head = document.createElement('div');
        head.id = 'cm-edit-head';
        head.innerHTML = `
            <button type="button" id="cm-back-btn" class="cm-ghost-btn">← 一覧</button>
            <span id="cm-edit-title"></span>
            <button type="button" id="cm-detail-btn" class="cm-ghost-btn">詳細設定</button>
        `;
        view.insertBefore(head, wrap);

        const editBar = document.createElement('div');
        editBar.id = 'cm-edit-bar';
        editBar.className = 'cm-bottom-bar';
        editBar.innerHTML = `
            <button type="button" id="cm-preview-btn" class="cm-bar-btn">📺<span>見る</span></button>
            <button type="button" id="cm-next-btn" class="cm-bar-btn cm-primary">次の問題へ</button>
        `;
        view.appendChild(editBar);

        // 下から出るパネル
        const sheet = document.createElement('div');
        sheet.id = 'cm-sheet';
        sheet.className = 'hidden';
        sheet.innerHTML = `
            <div class="cm-sheet-backdrop" data-cm-close></div>
            <div class="cm-sheet-panel" role="dialog" aria-modal="true">
                <div class="cm-sheet-head">
                    <span id="cm-sheet-title"></span>
                    <button type="button" class="cm-ghost-btn" data-cm-close>閉じる</button>
                </div>
                <div id="cm-sheet-stage-wrap" class="hidden"><div id="cm-sheet-stage" class="cm-stage"></div></div>
                <div id="cm-sheet-body"></div>
            </div>
        `;
        document.body.appendChild(sheet);

        // ③ モニターで確認（全画面）
        const pv = document.createElement('div');
        pv.id = 'cm-preview';
        pv.className = 'hidden';
        pv.innerHTML = `
            <div id="cm-preview-frame"><div id="cm-preview-stage" class="cm-stage"></div></div>
            <div class="cm-preview-bar">
                <button type="button" class="cm-pill" data-cm-step="question">問題</button>
                <button type="button" class="cm-pill" data-cm-step="answer">正解</button>
                <button type="button" class="cm-pill" id="cm-preview-close">閉じる</button>
            </div>
        `;
        document.body.appendChild(pv);

        this.wire();
    },

    wire: function () {
        const C = () => this.C();
        document.getElementById('cm-add-btn').onclick = () => this.showEdit(null);
        document.getElementById('cm-bulk-btn').onclick = () => this.openSheet('bulk');
        document.getElementById('cm-save-btn').onclick = () => C().save();
        document.getElementById('cm-back-btn').onclick = () => this.backToList();
        document.getElementById('cm-next-btn').onclick = () => this.next();
        document.getElementById('cm-detail-btn').onclick = () => this.toggleDetail();
        document.getElementById('cm-preview-btn').onclick = () => this.openPreview();
        document.getElementById('cm-preview-list-btn').onclick = () => this.openPreview();
        document.getElementById('cm-preview-close').onclick = () => this.closePreview();
        document.querySelectorAll('[data-cm-sheet]').forEach(b => { b.onclick = () => this.openSheet(b.dataset.cmSheet); });
        document.querySelectorAll('#cm-sheet [data-cm-close]').forEach(b => { b.onclick = () => this.closeSheet(); });
        document.querySelectorAll('#cm-preview [data-cm-step]').forEach(b => {
            b.onclick = () => { this._previewStep = b.dataset.cmStep; this.renderPreview(); };
        });
        window.addEventListener('resize', () => this.fitPreview());
        if (window.matchMedia) {
            const mq = window.matchMedia(this.MEDIA);
            const onChange = () => this.apply();
            if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
        }
    },

    // ---------------------------------------------------------
    // 表示の切り替え
    // ---------------------------------------------------------
    apply: function () {
        const view = this.view();
        if (!view) return;
        this.ensureDom();
        const on = this.isMobile();
        view.classList.toggle('cm-on', on);
        view.classList.toggle('cm-list', on && this.screen === 'list');
        view.classList.toggle('cm-edit', on && this.screen === 'edit');
        document.body.classList.toggle('cm-creator-active', on && !view.classList.contains('hidden'));
        if (!on) { this.closeSheet(); this.closePreview(); }
        if (on && this.screen === 'list') this.renderList();
        if (on && this.screen === 'edit') this.renderEditHead();
    },

    // 作成画面を開いた時（新規・保存済みセットの読み込み）
    onOpen: function (opts = {}) {
        this.ensureDom();
        const qs = window.App.Data.createdQuestions || [];
        // 新しいセットはすぐ1問目を書き始められるように編集画面から
        this.screen = (opts.fresh && qs.length === 0) ? 'edit' : 'list';
        const view = this.view();
        if (view) view.classList.remove('cm-detail-open');
        this.apply();
    },

    showList: function () {
        this.screen = 'list';
        this.view()?.classList.remove('cm-detail-open');
        this.apply();
        window.scrollTo(0, 0);
    },

    showEdit: function (index) {
        const C = this.C();
        if (index === null || index === undefined) {
            if (C.previewSlide !== 'question') C.setPreviewSlide('question');
            C.resetForm();
        } else {
            C.edit(index);
        }
        this.screen = 'edit';
        this.view()?.classList.remove('cm-detail-open');
        this.apply();
        window.scrollTo(0, 0);
        if (index === null || index === undefined) this.focusQuestion();
    },

    focusQuestion: function () {
        setTimeout(() => document.getElementById('question-text')?.focus(), 50);
    },

    renderEditHead: function () {
        const C = this.C();
        const el = document.getElementById('cm-edit-title');
        const qs = window.App.Data.createdQuestions || [];
        const nextBtn = document.getElementById('cm-next-btn');
        if (C.editingIndex === null) {
            if (el) el.textContent = `新しい問題（Q${qs.length + 1}）`;
            if (nextBtn) nextBtn.textContent = '追加して次の問題へ';
        } else {
            if (el) el.textContent = `Q${C.editingIndex + 1} を編集`;
            if (nextBtn) nextBtn.textContent = (C.editingIndex + 1 < qs.length) ? '保存して次の問題へ' : '保存して新しい問題へ';
        }
    },

    // 「次の問題へ」— 新規なら追加、編集中なら更新して、続けて次を書く
    next: function () {
        const C = this.C();
        const qs = window.App.Data.createdQuestions;
        if (C.editingIndex === null) {
            const before = qs.length;
            C.add();
            if (qs.length === before) return; // 入力不足（アラート済み）
        } else {
            const i = C.editingIndex;
            C.update();
            if (C.editingIndex !== null) return; // 入力不足
            if (i + 1 < qs.length) C.edit(i + 1);
        }
        this.renderEditHead();
        window.scrollTo(0, 0);
        this.focusQuestion();
    },

    // 「← 一覧」— 書きかけがあれば追加／更新してから戻る
    backToList: function () {
        const C = this.C();
        const qs = window.App.Data.createdQuestions;
        const text = (document.getElementById('question-text')?.value || '').trim();
        if (C.editingIndex === null) {
            if (text) {
                const before = qs.length;
                C.add();
                if (qs.length === before) return;
            }
        } else {
            C.update();
            if (C.editingIndex !== null) return;
        }
        this.showList();
    },

    // この問題だけの細かい設定（従来の「その他」パネル）
    toggleDetail: function () {
        const view = this.view();
        const C = this.C();
        const open = !view.classList.contains('cm-detail-open');
        view.classList.toggle('cm-detail-open', open);
        if (open) {
            C.editSubTab = 'home';
            C.toggleInlinePanel('edit');
        }
        document.getElementById('cm-detail-btn').textContent = open ? '詳細を閉じる' : '詳細設定';
    },

    // ---------------------------------------------------------
    // ① 問題一覧
    // ---------------------------------------------------------
    renderList: function () {
        const box = document.getElementById('cm-qcards');
        if (!box) return;
        const qs = window.App.Data.createdQuestions || [];
        const sel = document.getElementById('creator-q-type');
        const chip = document.getElementById('cm-type-chip');
        if (chip) chip.textContent = this.TYPE_LABELS[sel && sel.value] || '問題';
        const count = document.getElementById('cm-count');
        if (count) count.textContent = `${qs.length}問`;

        const check = window.App.QuizCheck;
        const bad = check ? check.incompleteIn(qs).length : 0;
        const warn = document.getElementById('cm-warn');
        if (warn) {
            warn.classList.toggle('hidden', !bad);
            warn.textContent = bad ? `未完成の問題が${bad}問あります。保存はできますが、完成させるまで出題できません` : '';
        }

        if (!qs.length) {
            box.innerHTML = `
                <div class="cm-empty">
                    <div class="cm-empty-title">最初の問題を作りましょう</div>
                    <div class="cm-empty-sub">「＋ 問題を追加」から1問ずつ、または「まとめて貼り付け」で一気に入れられます。</div>
                </div>`;
            return;
        }

        box.innerHTML = qs.map((q, i) => {
            const missing = check ? check.missing(q) : [];
            const sub = Array.isArray(q.c) && q.c.length ? q.c.slice(0, 4).join(' / ')
                : (Array.isArray(q.correct) ? q.correct.join(' / ') : (q.correct || ''));
            return `
                <div class="cm-qcard${missing.length ? ' cm-bad' : ''}" data-idx="${i}">
                    <span class="cm-qnum">Q${i + 1}</span>
                    <div class="cm-qbody">
                        <div class="cm-qtext">${this.esc(q.q || '（問題文なし）')}</div>
                        <div class="cm-qsub">${missing.length ? `未完成：${this.esc(missing.join('・'))}` : this.esc(sub)}</div>
                    </div>
                    <button type="button" class="cm-qdel" data-idx="${i}" aria-label="Q${i + 1}を削除">×</button>
                    <span class="cm-handle" aria-label="ドラッグで並べ替え">⋮⋮</span>
                </div>`;
        }).join('');

        box.querySelectorAll('.cm-qcard').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('.cm-qdel') || e.target.closest('.cm-handle')) return;
                this.showEdit(parseInt(card.dataset.idx, 10));
            };
        });
        box.querySelectorAll('.cm-qdel').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.C().delete(parseInt(btn.dataset.idx, 10));
                this.renderList();
            };
        });

        // ドラッグで並べ替え（SortableJS は index.html で読み込み済み）
        if (window.Sortable && !box._cmSortable) {
            box._cmSortable = window.Sortable.create(box, {
                handle: '.cm-handle', animation: 150,
                onEnd: (evt) => {
                    if (evt.oldIndex === evt.newIndex) return;
                    const arr = window.App.Data.createdQuestions;
                    const [moved] = arr.splice(evt.oldIndex, 1);
                    arr.splice(evt.newIndex, 0, moved);
                    this.renderList();
                    if (window.App.CreatorDraft) window.App.CreatorDraft.saveSoon();
                },
            });
        }
    },

    // ---------------------------------------------------------
    // 下から出るパネル（見た目・ルール・まとめて貼り付け）
    // 従来のパネルのDOMをそのまま借りてきて、閉じたら元の場所に戻す。
    // ---------------------------------------------------------
    openSheet: function (kind) {
        const C = this.C();
        this.closeSheet();
        const ids = { design: 'creator-inline-design', rules: 'creator-inline-rules', bulk: 'creator-bulk-panel' };
        const titles = { design: '見た目（セット全体）', rules: 'ルール（セット全体）', bulk: 'まとめて貼り付け' };
        const node = document.getElementById(ids[kind]);
        if (!node) return;
        this._moved = { node, parent: node.parentNode, next: node.nextSibling, wasHidden: node.classList.contains('hidden') };
        const body = document.getElementById('cm-sheet-body');
        body.innerHTML = '';
        body.appendChild(node);
        node.classList.remove('hidden');
        document.getElementById('cm-sheet-title').textContent = titles[kind];
        this._sheet = kind;

        if (kind === 'design') {
            if (C.previewSlide !== 'question') C.setPreviewSlide('question');
            // スマホではまずテーマを選ぶところから（細かい色はその後で）
            if (window.App.Design) window.App.Design._activeDesignTab = 'theme';
            C.renderActivePanelContent('design');
        } else if (kind === 'rules') {
            C.renderActivePanelContent('rules');
        } else if (kind === 'bulk') {
            C.renderBulkPanel();
        }
        document.getElementById('cm-sheet-stage-wrap').classList.toggle('hidden', kind !== 'design');
        document.getElementById('cm-sheet').classList.remove('hidden');
        document.body.classList.add('cm-noscroll');
        if (kind === 'design') this.renderSheetStage();
    },

    closeSheet: function () {
        const m = this._moved;
        if (m && m.parent) {
            m.parent.insertBefore(m.node, m.next);
            if (m.wasHidden) m.node.classList.add('hidden');
        }
        this._moved = null;
        const kind = this._sheet;
        this._sheet = null;
        document.getElementById('cm-sheet')?.classList.add('hidden');
        document.body.classList.remove('cm-noscroll');
        if (kind === 'bulk' || kind === 'rules') this.renderList();
    },

    // 見た目パネルの上に、本番と同じ描画の小さなプレビュー
    renderSheetStage: function () {
        if (this._sheet !== 'design') return;
        const stage = document.getElementById('cm-sheet-stage');
        if (stage) this.renderStage(stage, this.previewQuestion(), 'question');
    },

    // ---------------------------------------------------------
    // ③ モニターで確認（本番の viewer.js で描画）
    // ---------------------------------------------------------
    openPreview: function () {
        this._previewStep = 'question';
        document.getElementById('cm-preview').classList.remove('hidden');
        document.body.classList.add('cm-noscroll');
        this.renderPreview();
    },

    closePreview: function () {
        document.getElementById('cm-preview')?.classList.add('hidden');
        if (!this._sheet) document.body.classList.remove('cm-noscroll');
    },

    renderPreview: function () {
        const stage = document.getElementById('cm-preview-stage');
        if (!stage) return;
        this.renderStage(stage, this.previewQuestion(), this._previewStep);
        document.querySelectorAll('#cm-preview [data-cm-step]').forEach(b => {
            b.classList.toggle('cm-on-pill', b.dataset.cmStep === this._previewStep);
        });
        this.fitPreview();
    },

    // 縦持ちでも16:9が大きく見えるよう、縦長の画面では90度回して表示する
    fitPreview: function () {
        const frame = document.getElementById('cm-preview-frame');
        if (!frame || document.getElementById('cm-preview').classList.contains('hidden')) return;
        const W = window.innerWidth, H = window.innerHeight - 64; // 下のボタン分
        const portrait = H > W;
        const availW = portrait ? H : W, availH = portrait ? W : H;
        const w = Math.min(availW, availH * 16 / 9);
        const h = w * 9 / 16;
        frame.style.width = `${w}px`;
        frame.style.height = `${h}px`;
        frame.style.transform = portrait ? 'translate(-50%, -50%) rotate(90deg)' : 'translate(-50%, -50%)';
    },

    // プレビューに出す問題 — 編集中ならその入力内容、一覧なら先頭の問題
    previewQuestion: function () {
        const C = this.C();
        const qs = window.App.Data.createdQuestions || [];
        let q = null;
        if (this.screen === 'edit' && C._readFormDataForPreview) {
            try { q = C._readFormDataForPreview(); } catch (e) { q = null; }
            if (q && !q.q) q.q = '（ここに問題文が入ります）';
        }
        if (!q) {
            if (qs.length) {
                q = JSON.parse(JSON.stringify(window.App.SetImages ? window.App.SetImages.pack([qs[0]]).questions[0] : qs[0]));
            } else {
                q = { type: 'choice', q: '日本一高い山は？', c: ['富士山', '北岳', '奥穂高岳', '間ノ岳'], correct: [0], correctIndex: 0 };
            }
        }
        const cd = window.App.Data.currentDesign || {};
        const { layout, align, cAlign, ...design } = cd;
        return { ...q, layout: layout || 'standard', align: align || 'center', cAlign: cAlign || 'left', design };
    },

    renderStage: function (stage, q, step) {
        const V = window.App.Viewer;
        stage.innerHTML = '<div class="cm-stage-main"></div>';
        const main = stage.firstChild;
        const st = { step: step === 'answer' ? 'answer' : 'reveal_q', qIndex: 0, revealedMulti: {} };
        try {
            if (!V) throw new Error('viewer not loaded');
            if (st.step === 'answer' && q.type === 'sort' && V.renderSortReveal) {
                V.applyDefaultDesign(stage, q.design);
                V.renderSortReveal(main, q, st);
            } else {
                V.renderQuestionLayout(stage, main, q, st, {});
            }
        } catch (e) {
            console.warn('preview render failed', e);
            main.innerHTML = '<div style="color:#aaa; font-size:4cqh; text-align:center;">この形式はまだプレビューできません</div>';
        }
        if (window.App.Themes) window.App.Themes.applyToElement(stage, q.design);
        this.toContainerUnits(stage);
    },

    // 描画コードは vh/vw で書かれているので、このステージ基準（cqh/cqw）に
    // 書き換える — viewer.js watchStageUnits と同じ考え方
    toContainerUnits: function (root) {
        const UNIT = /(\d*\.?\d+)v([hw])\b/g;
        const convert = (el) => {
            const css = el.getAttribute && el.getAttribute('style');
            if (!css || !/\dv[hw]/.test(css)) return;
            const out = css.split(/(url\([^)]*\))/).map((part, i) =>
                (i % 2 === 1) ? part : part.replace(UNIT, '$1cq$2')).join('');
            if (out !== css) el.setAttribute('style', out);
        };
        convert(root);
        root.querySelectorAll('[style]').forEach(convert);
    },
};

/* =========================================================
 * 下書きの自動保存（PC・スマホ共通）
 * 作成中のセットを数秒ごとにこの端末へ保存しておき、画面の再読み込みや
 * アプリの切り替えで消えても、次に開いた時に復元できるようにする。
 * =======================================================*/
App.CreatorDraft = {
    INTERVAL_MS: 3000,
    _last: null,
    _timer: null,

    key: function () {
        const show = (window.App.State && window.App.State.currentShowId) || sessionStorage.getItem('qs_show_id') || 'local';
        return `qs_draft_${show}`;
    },

    read: function () {
        try {
            const raw = localStorage.getItem(this.key());
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    },

    clear: function () {
        try { localStorage.removeItem(this.key()); } catch (e) { /* noop */ }
        this._last = null;
    },

    creatorVisible: function () {
        const v = document.getElementById('creator-view');
        return !!(v && !v.classList.contains('hidden'));
    },

    saveNow: function () {
        if (!this.creatorVisible()) return;
        const C = window.App.Creator;
        const qs = window.App.Data.createdQuestions || [];
        if (!qs.length) return;
        let snap;
        try { snap = C.snapshot(); } catch (e) { return; }
        if (snap === this._last) return;
        const packed = window.App.SetImages ? window.App.SetImages.pack(qs) : { questions: qs, images: [] };
        const sel = document.getElementById('creator-q-type');
        const draft = {
            v: 1,
            savedAt: Date.now(),
            title: C.editingTitle || '',
            setId: window.App.State.editingSetId || null,
            groupType: sel ? sel.value : '',
            currentType: C.currentType || '',
            questions: packed.questions,
            images: packed.images,
            design: window.App.Data.currentDesign || {},
            config: window.App.Data.currentConfig || {},
        };
        try {
            localStorage.setItem(this.key(), JSON.stringify(draft));
        } catch (e) {
            // 容量オーバー（背景画像や音が大きい）— 画像・音を外して文字だけでも残す
            try {
                draft.images = [];
                draft.design = { ...draft.design, bgImage: '' };
                draft.noMedia = true;
                localStorage.setItem(this.key(), JSON.stringify(draft));
            } catch (e2) { return; }
        }
        this._last = snap;
    },

    saveSoon: function () {
        clearTimeout(this._soon);
        this._soon = setTimeout(() => this.saveNow(), 300);
    },

    start: function () {
        if (this._timer) return;
        this._timer = setInterval(() => this.saveNow(), this.INTERVAL_MS);
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
        window.addEventListener('pagehide', () => this.saveNow());
    },

    // 作成画面を開いた時、同じセットの下書きがあれば復元を勧める
    offer: function (setId) {
        const d = this.read();
        const bar = this.banner();
        if (!bar) return;
        bar.classList.add('hidden');
        if (!d || !Array.isArray(d.questions) || !d.questions.length) return;
        if ((d.setId || null) !== (setId || null)) return;
        const when = new Date(d.savedAt);
        const hhmm = `${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
        bar.querySelector('.cm-draft-text').textContent =
            `保存していない下書きがあります（${d.title ? `「${d.title}」` : ''}${d.questions.length}問・${hhmm}）`;
        bar.classList.remove('hidden');
        bar.querySelector('[data-draft="restore"]').onclick = () => { this.restore(d); bar.classList.add('hidden'); };
        bar.querySelector('[data-draft="discard"]').onclick = () => {
            if (!confirm('下書きを削除しますか？')) return;
            this.clear();
            bar.classList.add('hidden');
        };
    },

    banner: function () {
        let bar = document.getElementById('cm-draft-banner');
        if (bar) return bar;
        const view = document.getElementById('creator-view');
        if (!view) return null;
        bar = document.createElement('div');
        bar.id = 'cm-draft-banner';
        bar.className = 'hidden';
        bar.innerHTML = `
            <span class="cm-draft-text"></span>
            <span class="cm-draft-actions">
                <button type="button" class="cm-ghost-btn" data-draft="discard">削除</button>
                <button type="button" class="cm-ghost-btn cm-primary-outline" data-draft="restore">復元する</button>
            </span>`;
        const header = view.querySelector('.view-header');
        if (header && header.nextSibling) view.insertBefore(bar, header.nextSibling); else view.prepend(bar);
        return bar;
    },

    restore: function (d) {
        const C = window.App.Creator;
        const qs = window.App.SetImages ? window.App.SetImages.unpack(d.questions || [], d.images || []) : (d.questions || []);
        window.App.Data.createdQuestions = qs;
        window.App.Data.currentDesign = d.design || window.App.Data.currentDesign;
        window.App.Data.currentConfig = d.config || window.App.Data.currentConfig;
        C.editingTitle = d.title || '';
        window.App.State.editingSetId = d.setId || null;
        C.renderSetTitle();
        const sel = document.getElementById('creator-q-type');
        if (sel && d.groupType) {
            sel.value = d.groupType;
            sel.disabled = true;
            document.getElementById('creator-type-locked-msg')?.classList.remove('hidden');
        }
        C.editingIndex = null;
        C.renderForm(d.currentType || (qs[0] && qs[0].type) || 'choice_single');
        C.renderList();
        if (window.App.Themes && window.App.Data.currentDesign) window.App.Themes.ensureFont(window.App.Data.currentDesign.fontFamily);
        C.applyDesignToPreview();
        // 復元しただけでは「保存済み」ではない — 離れる時の確認は出す
        C._savedSnapshot = null;
        this._last = null;
        window.App.Ui.showToast(d.noMedia ? '下書きを復元しました（背景画像・音は容量の都合で保存されていません）' : '下書きを復元しました');
        if (App.CreatorMobile.isMobile()) App.CreatorMobile.showList();
    },
};

/* ---------------------------------------------------------
 * App.Creator への差し込み（元の関数を呼んだ後にスマホ版を更新）
 * ------------------------------------------------------- */
(function hookCreator() {
    const C = window.App.Creator;
    if (!C) return;
    const after = (name, fn) => {
        const orig = C[name];
        if (typeof orig !== 'function') return;
        C[name] = function () {
            const r = orig.apply(this, arguments);
            try { fn.apply(this, arguments); } catch (e) { console.warn('creator_mobile hook', name, e); }
            return r;
        };
    };
    after('init', function () { App.CreatorDraft.offer(null); });
    after('initWithType', function () { App.CreatorMobile.onOpen({ fresh: true }); });
    after('loadSet', function (key) { App.CreatorMobile.onOpen({ fresh: false }); App.CreatorDraft.offer(key); });
    after('renderList', function () {
        const M = App.CreatorMobile;
        if (M.isMobile() && M.screen === 'list') M.renderList();
        App.CreatorDraft.saveSoon();
    });
    after('applyDesignToPreview', function () { App.CreatorMobile.renderSheetStage(); });
    after('renderRulesSection', function () { App.CreatorDraft.saveSoon(); });
})();

document.addEventListener('DOMContentLoaded', () => {
    App.CreatorDraft.start();
    // 作成画面以外を開いた時は、スマホ版の下部バーを消す
    const ui = window.App.Ui;
    if (ui && typeof ui.showView === 'function' && !ui._cmHooked) {
        const orig = ui.showView;
        ui.showView = function () {
            const r = orig.apply(this, arguments);
            const v = document.getElementById('creator-view');
            document.body.classList.toggle('cm-creator-active', !!(v && !v.classList.contains('hidden') && App.CreatorMobile.isMobile()));
            if (v && v.classList.contains('hidden')) { App.CreatorMobile.closeSheet(); App.CreatorMobile.closePreview(); }
            return r;
        };
        ui._cmHooked = true;
    }
});
