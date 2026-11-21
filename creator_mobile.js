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
            <div class="cm-section-head">セットの設定<span>タップで変更</span></div>
            <div id="cm-settings"></div>
            <div class="cm-section-head">問題</div>
            <div id="cm-qcards"></div>
            <div class="cm-add-row">
                <button type="button" id="cm-add-btn" class="cm-add-card">＋ 問題を追加</button>
                <button type="button" id="cm-bulk-btn" class="cm-ghost-btn">メモのようにまとめて入力</button>
            </div>
            <div id="cm-list-bar" class="cm-bottom-bar">
                <button type="button" data-cm-sheet="design" class="cm-bar-btn">${window.App.Icons.svg('palette')}<span>見た目</span></button>
                <button type="button" data-cm-sheet="rules" class="cm-bar-btn">${window.App.Icons.svg('sliders')}<span>ルール</span></button>
                <button type="button" id="cm-preview-list-btn" class="cm-bar-btn">${window.App.Icons.svg('monitor')}<span>見る</span></button>
                <button type="button" id="cm-save-btn" class="cm-bar-btn cm-primary">保存して完了</button>
            </div>
        `;
        view.insertBefore(list, wrap);

        // ② 問題編集の見出し（← 一覧 / 何問目 / 詳細）
        const head = document.createElement('div');
        head.id = 'cm-edit-head';
        head.innerHTML = `
            <button type="button" id="cm-back-btn" class="cm-ghost-btn">一覧に戻る</button>
            <span id="cm-edit-title"></span>
        `;
        view.insertBefore(head, wrap);

        // 入力画面からも「まとめて入力」へ（新しいセットは一覧を通らずにここから始まるので）
        const bulkEdit = document.createElement('div');
        bulkEdit.id = 'cm-edit-bulk';
        bulkEdit.innerHTML = `<button type="button" id="cm-edit-bulk-btn" class="cm-ghost-btn">メモのようにまとめて入力</button>`;
        view.insertBefore(bulkEdit, wrap.nextSibling);

        const editBar = document.createElement('div');
        editBar.id = 'cm-edit-bar';
        editBar.className = 'cm-bottom-bar';
        editBar.innerHTML = `
            <button type="button" id="cm-preview-btn" class="cm-bar-btn">${window.App.Icons.svg('monitor')}<span>見る</span></button>
            <button type="button" id="cm-edit-settings-btn" class="cm-bar-btn">${window.App.Icons.svg('sliders')}<span>セット設定</span></button>
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
                <button type="button" class="cm-pill" data-cm-step="bridge">ブリッジ</button>
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
        document.getElementById('cm-edit-bulk-btn').onclick = () => this.openSheet('bulk');
        document.getElementById('cm-save-btn').onclick = () => C().save();
        document.getElementById('cm-back-btn').onclick = () => this.backToList();
        document.getElementById('cm-next-btn').onclick = () => this.next();
        document.getElementById('cm-preview-btn').onclick = () => this.openPreview();
        document.getElementById('cm-edit-settings-btn').onclick = () => this.openSheet('menu');
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
        const changed = view.classList.contains('cm-on') !== on;
        view.classList.toggle('cm-on', on);
        view.classList.toggle('cm-list', on && this.screen === 'list');
        view.classList.toggle('cm-edit', on && this.screen === 'edit');
        document.body.classList.toggle('cm-creator-active', on && !view.classList.contains('hidden'));
        if (!on) { this.closeSheet(); this.closePreview(); }
        if (on && this.screen === 'list') this.renderList();
        if (on && this.screen === 'edit') this.renderEditHead();
        // スマホ ⇔ PC で入力欄の見た目（見やすさ優先／本番どおり）を切り替える
        if (changed && !on) App.CreatorInput.arrangeListControls(false);
        if (changed && window.App.Creator && !view.classList.contains('hidden')) {
            try { window.App.Creator.applyDesignToPreview(); } catch (e) { /* noop */ }
        }
    },

    // パネルクイズのセット（1セット1盤面）か
    isBoardSet: function () {
        const PB = window.App.PanelBoard;
        if (!PB) return false;
        return PB.board || (window.App.Data.createdQuestions || []).some(q => PB.isBoard(q));
    },

    // 作成画面を開いた時（新規・保存済みセットの読み込み）
    onOpen: function (opts = {}) {
        this.ensureDom();
        const qs = window.App.Data.createdQuestions || [];
        // 新しいセットはすぐ1問目を書き始められるように編集画面から
        this.screen = (opts.fresh && qs.length === 0) ? 'edit' : 'list';
        // 形式選択からそのまま入力画面に来た時は、左上の戻るボタンで形式選択に戻れるように
        this._fromSelect = this.screen === 'edit';
        this.apply();
    },

    showList: function () {
        this.screen = 'list';
        this._fromSelect = false; // 一覧を見たら、入力画面の「戻る」は一覧へ
        this.apply();
        window.scrollTo(0, 0);
    },

    showEdit: function (index) {
        const C = this.C();
        if (index === null || index === undefined) {
            if (C.previewSlide !== 'question') C.setPreviewSlide('question');
            C.resetForm();
            // パネルクイズの盤面がまだ無いセットは、盤面の入力から
            if (this.isBoardSet() && window.App.PanelBoard) window.App.PanelBoard.startBoardSet(C);
        } else {
            C.edit(index);
        }
        this.screen = 'edit';
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
        // 左上のボタン — 押すと戻る先をそのまま書く（「戻る」は来た画面に戻る時だけ）
        const back = document.getElementById('cm-back-btn');
        if (back) back.textContent = !this._fromSelect ? '一覧に戻る' : qs.length ? '問題一覧へ' : '形式選択に戻る';
        const board = !!(window.App.PanelBoard && window.App.PanelBoard.board);
        document.getElementById('cm-edit-bulk')?.classList.toggle('hidden', C.editingIndex !== null || board);
        if (board) {
            if (el) el.textContent = 'パネルクイズの盤面';
            if (nextBtn) nextBtn.textContent = '盤面を保存';
            return;
        }
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
        // パネルクイズは盤面を保存して一覧へ（次の問題は無い）
        if (window.App.PanelBoard && window.App.PanelBoard.board) {
            const before = qs.length;
            if (C.editingIndex === null) { C.add(); if (qs.length === before) return; }
            else { C.update(); if (C.editingIndex !== null) return; }
            this.showList();
            return;
        }
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
        // まだ1問も無いまま形式選択から来た時は、形式選択に戻る（書きかけがあれば確認が出る）
        if (this._fromSelect && !qs.length) { document.getElementById('creator-back-btn')?.click(); return; }
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

    // ---------------------------------------------------------
    // ① 問題一覧
    // ---------------------------------------------------------
    renderList: function () {
        const box = document.getElementById('cm-qcards');
        if (!box) return;
        const qs = window.App.Data.createdQuestions || [];
        const sel = document.getElementById('creator-q-type');
        const chip = document.getElementById('cm-type-chip');
        const boardSet = this.isBoardSet();
        if (chip) chip.textContent = boardSet ? 'パネルクイズ' : (this.TYPE_LABELS[sel && sel.value] || '問題');
        // パネルクイズは1セット1盤面 — 盤面ができたら「追加」「まとめて入力」は出さない
        const hasBoard = boardSet && qs.length > 0;
        document.getElementById('cm-add-btn')?.classList.toggle('hidden', hasBoard);
        document.getElementById('cm-bulk-btn')?.classList.toggle('hidden', boardSet);
        const addBtn = document.getElementById('cm-add-btn');
        if (addBtn) addBtn.textContent = boardSet ? '＋ 盤面を作る' : '＋ 問題を追加';
        const count = document.getElementById('cm-count');
        if (count) count.textContent = `${qs.length}問`;

        this.renderSettingsSummary(document.getElementById('cm-settings'));

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
                    <div class="cm-empty-sub">「＋ 問題を追加」から1問ずつ、または「メモのようにまとめて入力」で一気に入れられます。</div>
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
    // セットの設定の要約 — 今の設定を1行ずつ出し、タップでその設定を開く
    // （スマホではタブの奥にあると見つけにくいので、入口を一覧に並べる）
    // ---------------------------------------------------------
    settingsRows: function () {
        const conf = window.App.Data.currentConfig || {};
        const d = window.App.Data.currentDesign || {};
        const MODE = { normal: '全員が同時に手元で答える', buzz: '早押しで答える', nominate: '指名された人が答える', turn: '順番に答える' };
        const SCORE = { uniform: '正解者全員に同じ点', ranked: '速い人ほど高得点', hint: 'ヒントが少ないほど高得点', first: `先着${parseInt(conf.firstN) || 1}人だけ得点` };
        const rows = [{ key: 'format', label: '答え方', value: MODE[conf.mode] || MODE.normal }];
        rows.push({ key: 'correct', label: '正解したとき', value: conf.gameType === 'timerace' ? '1問1点（タイムレース）' : (SCORE[conf.scoreType] || SCORE.uniform) });
        const RE = window.App.RuleEngine;
        const loss = RE ? RE.wrongLoss(conf, {}) : 0;
        let wrong = conf.mode === 'buzz' ? (conf.buzzWrongAction === 'end' ? '問題を終える' : '他の人が答えられる')
            : conf.mode === 'turn' ? (conf.turnWrongAction === 'next' ? '次の人に回す' : '問題を終える') : '減点のみ';
        if (loss > 0) wrong += `・−${loss}点`;
        rows.push({ key: 'wrong', label: '間違えたとき', value: wrong });
        const WIN = {
            score: '得点が高い人',
            survival: `サバイバル（${conf.survivalLives || 1}回ミスで脱落）`,
            winthrough: `勝ち抜け（${Number(conf.winTarget) || 5}${conf.winBy === 'correct' ? '問正解' : '点'}）`,
            timerace: 'タイムレース（正解数→合計時間）',
        };
        rows.push({ key: 'win', label: '勝ち方', value: WIN[conf.gameType] || WIN.score });
        const sec = parseInt(conf.timeLimitSeconds) || 30;
        let time = conf.timeLimitEnabled !== 'on' ? 'なし'
            : (conf.timerKind === 'pool' ? `セット全体で${sec}秒` : `1問${sec}秒`);
        if (Number(conf.answerSec) > 0) time += `・解答${Number(conf.answerSec)}秒`;
        rows.push({ key: 'time', label: '時間', value: time });
        const theme = window.App.Themes && window.App.Themes.get(d.themeId);
        // テーマを選んでいない時は、既定の見た目（スタジオ）
        const look = theme ? `${theme.name}${window.App.Themes.isModified(d) ? '（カスタム）' : ''}` : (d.themeId ? 'カスタム' : 'スタジオ（標準）');
        rows.push({ key: 'design', label: '見た目', value: look });
        return rows;
    },

    renderSettingsSummary: function (box) {
        if (!box) return;
        box.innerHTML = this.settingsRows().map(r => `
            <button type="button" class="cm-set-row" data-set-key="${r.key}">
                <span class="cm-set-label">${r.label}</span>
                <span class="cm-set-value">${this.esc(r.value)}</span>
            </button>`).join('');
        box.querySelectorAll('.cm-set-row').forEach(b => {
            b.onclick = () => {
                const k = b.dataset.setKey;
                if (k === 'design') this.openSheet('design');
                else this.openSheet('rules', k);
            };
        });
    },

    // ---------------------------------------------------------
    // 下から出るパネル（見た目・ルール・まとめて貼り付け）
    // 従来のパネルのDOMをそのまま借りてきて、閉じたら元の場所に戻す。
    // ---------------------------------------------------------
    openSheet: function (kind, sub) {
        const C = this.C();
        this.closeSheet();
        // 編集画面の「セット設定」— 設定の一覧から選ぶ
        if (kind === 'menu') {
            const body = document.getElementById('cm-sheet-body');
            body.innerHTML = '<div id="cm-sheet-menu"></div>';
            this.renderSettingsSummary(body.firstChild);
            document.getElementById('cm-sheet-title').textContent = 'セットの設定';
            document.getElementById('cm-sheet-stage-wrap').classList.add('hidden');
            document.querySelector('#cm-sheet .cm-sheet-panel')?.classList.remove('cm-fixed');
            document.getElementById('cm-sheet').classList.remove('hidden');
            document.body.classList.add('cm-noscroll');
            this._sheet = 'menu';
            return;
        }
        const ids = { design: 'creator-inline-design', rules: 'creator-inline-rules', bulk: 'creator-bulk-panel' };
        const titles = { design: '見た目（セット全体）', rules: 'ルール（セット全体）', bulk: 'メモのようにまとめて入力' };
        // タブを切り替えても題名がずれないよう、ルールは「ルール」のまま（どの設定かはタブで分かる）
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
            if (sub) C.rulesSubTab = sub; // 要約でタップした設定のタブを開く
            C.renderActivePanelContent('rules');
        } else if (kind === 'bulk') {
            this._bulkBefore = (window.App.Data.createdQuestions || []).length;
            C.renderBulkPanel();
        }
        document.getElementById('cm-sheet-stage-wrap').classList.toggle('hidden', kind !== 'design');
        // 高さを固定して、タブや選択を変えてもパネルが上下しないように（中身だけスクロール）
        document.querySelector('#cm-sheet .cm-sheet-panel')?.classList.add('cm-fixed');
        document.getElementById('cm-sheet').classList.remove('hidden');
        document.body.classList.add('cm-noscroll');
        if (kind === 'design') this.renderSheetStage();
        App.CreatorInput.watchSheet();
        App.CreatorInput.segmentSelects(document.getElementById('cm-sheet-body'));
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
        if (kind === 'bulk' || kind === 'rules' || kind === 'design') this.renderList();
        // まとめて入力で問題が増えたら、入った問題が見える一覧へ
        if (kind === 'bulk' && this.screen === 'edit' && (window.App.Data.createdQuestions || []).length > (this._bulkBefore || 0)) this.showList();
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
        // スマホは編集画面の時、PCはいつでも、入力中の内容を見せる
        if ((this.screen === 'edit' || !this.isMobile()) && C._readFormDataForPreview) {
            try { q = C._readFormDataForPreview(); } catch (e) { q = null; }
            if (q && !q.q) q.q = '（ここに問題文が入ります）';
            // まだ書いていない選択肢・項目も見本の文字で出す（色や大きさを変えた時に、どこが変わるか見えるように）
            const rows = document.querySelectorAll('#creator-choices-list > *').length;
            if (q && rows && !(Array.isArray(q.c) && q.c.some(Boolean))) q.c = Array(rows).fill('');
            if (q && Array.isArray(q.c) && q.c.length) {
                const t = q.type || '';
                const word = t.startsWith('assoc') ? 'ヒント' : t === 'sort' ? '項目' : t.startsWith('multi') ? '正解' : t.startsWith('ranking') ? '答え' : '選択肢';
                q.c = q.c.map((x, i) => x || (word === '選択肢' || word === '項目' ? `${word}${String.fromCharCode(65 + i)}` : `${word}${i + 1}`));
            }
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
        if (q.bgImage) design.bgImage = q.bgImage; // この問題だけの背景
        return { ...q, layout: layout || 'standard', align: align || 'center', cAlign: cAlign || 'left', design };
    },

    renderStage: function (stage, q, step) {
        const V = window.App.Viewer;
        stage.innerHTML = '<div class="cm-stage-main"></div>';
        const main = stage.firstChild;
        if (step === 'bridge') {
            const C = this.C();
            const n = (C.editingIndex !== null && C.editingIndex !== undefined) ? C.editingIndex + 1 : (window.App.Data.createdQuestions || []).length + 1;
            const d = q.design || {};
            if (window.App.VarietyFrame && window.App.VarietyFrame.applies(q)) {
                window.App.VarietyFrame.render(stage, main, q, { qIndex: n - 1 }, 'bridge', { label: (C.qNumText || '').trim() || `Q${n}` });
            } else if (window.App.BridgeView) {
                stage.style.backgroundColor = d.bridgeBgColor || '#0a0a0a';
                window.App.BridgeView.render(main, d, (C.qNumText || '').trim() || `第 ${n} 問`);
            }
            if (window.App.Themes) window.App.Themes.applyToElement(stage, d);
            this.toContainerUnits(stage);
            return;
        }
        const st = { step: step === 'answer' ? 'answer' : 'reveal_q', qIndex: 0, revealedMulti: {} };
        try {
            if (!V) throw new Error('viewer not loaded');
            const RE = window.App.RuleEngine;
            if (RE && RE.readAloud && RE.readAloud(window.App.Data.currentConfig || {}, { qType: q.type }) && V.renderScoreBoard) {
                // 一問一答の読み上げ: 本番と同じく問題文の代わりに得点の一覧（見本の参加者で）
                const sample = { s1: { name: '参加者A', periodScore: 3 }, s2: { name: '参加者B', periodScore: 1 }, s3: { name: '参加者C', periodScore: 2 }, s4: { name: '参加者D', periodScore: 0 } };
                V.renderScoreBoard(main, { qIndex: 0 }, sample, q.image || null);
                if (st.step === 'answer') {
                    const ans = (V.getAnswerString && V.getAnswerString(q)) || '';
                    main.insertAdjacentHTML('beforeend', `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); z-index:300; background:rgba(0,0,0,0.95); border:6px solid ${(q.design || {}).qBorderColor || '#00bfff'}; border-radius:20px; padding:4vh 6vw; color:#fff; text-align:center; min-width:60vw;"><div style="font-size:3vh; font-weight:800; margin-bottom:1.5vh;">正解</div><div style="font-size:8vh; font-weight:900;">${String(ans).replace(/</g, '&lt;')}</div></div>`);
                }
            } else if (window.App.PanelBoard && window.App.PanelBoard.is(q) && V.renderPanelBoard) {
                // パネル指名: 問題では表、正解では全部のパネルの裏（答え）を見せる
                const open = st.step === 'answer';
                // 問題付きは、問題を書いた最初のパネルを選んだ時の見え方
                const isBoard = window.App.PanelBoard.isBoard(q);
                const first = q.panelQ && !open && !isBoard ? q.panels.findIndex(p => p.pq) : -1;
                const pb = {
                    theme: q.q || '', seq: 0, sel: first >= 0 ? first : null, finished: open, revealAll: open,
                    selQ: first >= 0 ? q.panels[first].pq : null,
                    board: isBoard || null,
                    panels: q.panels.map(p => ({ label: p.label, pts: p.pts ?? null, r: null, answer: open ? p.answer : null })),
                };
                V.renderPanelBoard(stage, main, { step: 'panelboard', pb }, q);
            } else if (q.type === 'numgame' && V.renderNumGame) {
                // 数字予想: 問題では項目の盤面、正解では全部の項目の数を見せる
                const open = st.step === 'answer';
                const items = (q.items || []).map(it => it.name || '');
                const ng = {
                    rule: q.ngRule, target: q.target, unit: q.unit, theme: q.q || '', items, order: [], names: {}, totals: {},
                    values: open ? Object.fromEntries((q.items || []).map((it, i) => [i, it.value])) : {},
                    used: open ? items.map((_, i) => i) : [],
                };
                V.renderNumGame(stage, main, { step: 'numgame', ng }, q);
            } else if (st.step === 'answer' && q.type === 'sort' && V.renderSortReveal) {
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
 * 入力のしやすさ（PC・スマホ共通）
 *  ・Enter で次の入力欄へ（問題文 → 選択肢A → B → … → 次の問題）。
 *    最後の欄で Enter を押すと、追加（編集中なら更新）して次の問題を書き始める。
 *    日本語入力の変換中の Enter は対象外。PC は Shift+Enter で改行できる。
 *  ・スマホでは入力欄の文字を16px以上にする（iPhone は16px未満の入力欄を
 *    押すと自動でズームするため）
 * =======================================================*/
App.CreatorInput = {
    MIN_MOBILE_PX: 16,

    fields: function () {
        const wrap = document.getElementById('creator-editor-wrap');
        if (!wrap) return [];
        const list = [];
        const title = document.getElementById('question-title');
        if (title && !title.classList.contains('hidden') && title.offsetParent) list.push(title);
        const q = document.getElementById('question-text');
        if (q) list.push(q);
        const form = document.getElementById('creator-form-container');
        if (form) {
            form.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach(el => {
                if (el.offsetParent && !el.readOnly && !el.disabled) list.push(el);
            });
        }
        return list;
    },

    onKeyDown: function (e) {
        if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl+Enter は追加（creator_desktop.js）
        const view = document.getElementById('creator-view');
        if (!view || view.classList.contains('hidden')) return;
        const fields = this.fields();
        const i = fields.indexOf(e.target);
        if (i < 0) return;
        e.preventDefault();
        if (i < fields.length - 1) {
            const next = fields[i + 1];
            next.focus();
            try { const n = next.value.length; next.setSelectionRange(n, n); } catch (err) { /* noop */ }
            next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return;
        }
        // 最後の欄 — 追加して次の問題へ
        const M = window.App.CreatorMobile;
        if (M && M.isMobile() && M.screen === 'edit') { M.next(); return; }
        const C = window.App.Creator;
        const qs = window.App.Data.createdQuestions || [];
        if (C.editingIndex === null) {
            const before = qs.length;
            C.add();
            if (qs.length === before) return;
        } else {
            C.update();
            if (C.editingIndex !== null) return;
        }
        setTimeout(() => document.getElementById('question-text')?.focus(), 30);
    },

    // スマホ幅の時、入力欄の文字が16px未満なら16pxにする（ズーム防止）
    enforceMobileSize: function () {
        const M = window.App.CreatorMobile;
        if (!M || !M.isMobile()) return;
        const wrap = document.getElementById('creator-editor-wrap');
        if (!wrap) return;
        wrap.querySelectorAll('input[type="text"], input:not([type]), input[type="number"], textarea, select').forEach(el => {
            const px = parseFloat(getComputedStyle(el).fontSize) || 0;
            if (px < this.MIN_MOBILE_PX) el.style.setProperty('font-size', `${this.MIN_MOBILE_PX}px`, 'important');
        });
    },

    // スマホの入力画面は見やすさ優先 — 見た目（文字の大きさ・色・縦書き・
    // 配置・スキン）は入力欄に映さず、決まった読みやすい形で出す。
    // 本番の見え方は「見る」で確かめる。見た目の反映の後に毎回かける。
    plainEditor: function () {
        const M = window.App.CreatorMobile;
        if (!M || !M.isMobile()) return;
        const C = window.App.Creator;
        const set = (el, props) => { if (el) Object.entries(props).forEach(([k, v]) => el.style.setProperty(k, v, 'important')); };
        const preview = document.getElementById('creator-monitor-preview');
        if (preview) {
            set(preview, { 'background-image': 'none', 'background-color': '#111' });
            [...preview.classList].forEach(c => { if (/^(qskin-|cskin|cpal-|cs-framed$|cvf$)/.test(c)) preview.classList.remove(c); });
            preview.removeAttribute('data-frame-title');
        }
        document.querySelector('#creator-monitor-q-area > .qs-num')?.remove();
        set(document.getElementById('creator-monitor-flexwrap'), { 'flex-direction': 'column', 'justify-content': 'flex-start' });
        set(document.getElementById('creator-monitor-q-area'), {
            width: '100%', 'align-self': 'stretch', display: 'flex', 'flex-direction': 'column', 'align-items': 'stretch',
            'justify-content': 'flex-start', 'min-height': '0', 'border-color': '#f59e0b', 'background-color': '#1a1a1a', 'box-shadow': 'none',
        });
        set(document.getElementById('creator-form-container'), { position: 'static', width: '100%', 'align-self': 'stretch', flex: '1 1 auto' });
        const title = document.getElementById('question-title');
        set(title, { 'font-size': '16px', 'text-align': 'left' });
        const qText = document.getElementById('question-text');
        if (qText) {
            set(qText, { 'font-size': '18px', color: '#fff', 'text-align': 'left', 'writing-mode': 'horizontal-tb', width: '100%' });
            ['max-height', 'min-height', 'align-self'].forEach(k => qText.style.removeProperty(k));
            if (C && C.fitQuestionTextHeight) {
                // 縦書きの設定でも、入力中は横書きで高さを合わせる
                const d = window.App.Data.currentDesign || {};
                const wm = d.qWritingMode;
                d.qWritingMode = '';
                try { C.fitQuestionTextHeight(); } finally { d.qWritingMode = wm; }
            }
        }
        document.querySelectorAll('#creator-form-container .choice-text-input, #creator-form-container .row-input').forEach(el => {
            set(el, { 'font-size': '17px', color: '#fff', 'text-align': 'left', 'line-height': '1.3' });
        });
        const list = document.getElementById('creator-choices-list');
        if (list && !(C && C.oxMode)) set(list, { display: 'flex', 'flex-direction': 'column', 'grid-template-columns': 'none' });
        // 選択肢・項目の枠の色（見た目の設定）も入力中は既定の色に
        document.querySelectorAll('#creator-form-container .choice-frame, #creator-form-container .row-frame').forEach(f => {
            f.style.borderColor = 'rgba(255,255,255,0.1)';
            if (f.classList.contains('row-frame')) f.style.background = '';
        });
        this.sectionLabels();
        this.arrangeListControls(true);
        this.segmentSelects(document.getElementById('creator-outside-opts'));
    },

    // スマホでは、選ぶものが少ないプルダウン（2〜3個、または短い言葉の6個まで）を
    // 全部見えるボタンの並びにする。元の select は隠して値を持たせたまま、押したら change を送る。
    segmentSelects: function (root) {
        const M = window.App.CreatorMobile;
        if (!root || !M || !M.isMobile()) return;
        root.querySelectorAll('select').forEach(sel => {
            const opts = [...sel.options];
            const short = opts.every(o => o.text.trim().length <= 5);
            if (opts.length < 2 || !(opts.length <= 3 || (opts.length <= 6 && short))) return;
            const key = opts.map(o => o.value + '=' + o.text).join('|');
            let seg = sel.nextElementSibling;
            // 同じ選択肢で作ってあれば作り直さない（見張り役が自分の書き換えで回り続けないように）
            if (!seg || !seg.classList.contains('seg-from-select') || seg.dataset.key !== key) {
                if (seg && seg.classList.contains('seg-from-select')) seg.remove();
                seg = document.createElement('div');
                seg.className = 'seg-ctl seg-from-select' + (short ? ' seg-short' : '');
                seg.dataset.key = key;
                seg.setAttribute('role', 'radiogroup');
                seg.innerHTML = opts.map(o => `<button type="button" role="radio" data-v="${o.value.replace(/"/g, '&quot;')}">${o.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</button>`).join('');
                sel.after(seg);
                sel.classList.add('seg-src');
            }
            const sync = () => seg.querySelectorAll('button').forEach(b => {
                const on = b.dataset.v === sel.value;
                b.classList.toggle('on', on);
                b.setAttribute('aria-checked', on);
            });
            sync();
            seg.querySelectorAll('button').forEach(b => {
                b.onclick = () => {
                    if (sel.value === b.dataset.v) return;
                    sel.value = b.dataset.v;
                    sync();
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                };
            });
        });
    },

    // 下から出るパネル（ルール・見た目）は中身をよく描き直すので、描き直されたら切り替えを付け直す
    watchSheet: function () {
        const body = document.getElementById('cm-sheet-body');
        if (!body || this._sheetObserver || !window.MutationObserver) return;
        let queued = false;
        this._sheetObserver = new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; this.segmentSelects(body); });
        });
        this._sheetObserver.observe(body, { childList: true, subtree: true });
    },

    // スマホの入力画面はモニターの見た目どおりではないので、操作は意味の近い所に置く:
    // 「＋ ○○を追加」「まとめて貼り付け」は一覧の真下、多答の「通常／ランキング／パネル指名」は一覧の真上。
    // PC に戻ったら（on=false）元の場所（プレビュー直下の行）へ戻す。
    LIST_ADD_IDS: ['choice-add-btn', 'assoc-add-btn', 'multi-add-btn', 'pb-add-btn', 'pb-paste-btn', 'ng-add-btn', 'ng-paste-btn', 'btn-reset-sort-ranks'],
    arrangeListControls: function (on) {
        const flex = document.getElementById('creator-monitor-flexwrap');
        const form = document.getElementById('creator-form-container');
        const outside = document.getElementById('creator-outside-opts');
        if (!flex || !form || !outside) return;
        const M = window.App.CreatorMobile;
        if (on && !(M && M.isMobile())) return;
        const slot = (id, before) => {
            let el = document.getElementById(id);
            if (!el) { el = document.createElement('div'); el.id = id; el.className = 'cm-list-slot'; }
            if (el.parentNode !== flex || el.nextSibling !== before) flex.insertBefore(el, before);
            return el;
        };
        const above = slot('cm-above-list', document.getElementById('cm-sec-form') || form);
        const below = slot('cm-below-list', form.nextSibling);
        if (!on) {
            [...above.children, ...below.children].forEach(el => {
                if (el.dataset.cmFrom === 'extra') document.getElementById('creator-options-extra')?.prepend(el);
                else outside.appendChild(el);
            });
            return;
        }
        const seg = document.getElementById('multi-mode-seg');
        if (seg && seg.parentNode !== above) { above.innerHTML = ''; above.appendChild(seg); }
        if (!seg) above.innerHTML = '';
        const want = this.LIST_ADD_IDS.map(id => document.getElementById(id)).filter(Boolean);
        // 並べ替えの「＋ 項目を追加」は ID が無く、この問題の設定（#creator-options-extra）にある
        const extraAdd = below.querySelector('[data-cm-from="extra"]')
            || [...document.querySelectorAll('#creator-options-extra button')].find(b => b.textContent.trim().startsWith('＋'));
        if (extraAdd) { extraAdd.dataset.cmFrom = 'extra'; want.unshift(extraAdd); }
        [...below.children].forEach(el => { if (!want.includes(el)) el.remove(); });
        want.forEach(el => below.appendChild(el)); // 追加 → 貼り付け → その他 の順に並べ直す
    },

    // 何を書く欄かが分かるよう、問題文・答えの欄の上に小さな見出し（スマホだけ表示）
    sectionLabels: function () {
        const flex = document.getElementById('creator-monitor-flexwrap');
        const qArea = document.getElementById('creator-monitor-q-area');
        const form = document.getElementById('creator-form-container');
        if (!flex || !qArea || !form) return;
        const label = (id, before, text) => {
            let el = document.getElementById(id);
            if (!el) { el = document.createElement('div'); el.id = id; el.className = 'cm-sec'; }
            if (el.nextSibling !== before) flex.insertBefore(el, before);
            el.textContent = text;
            el.hidden = !text;
        };
        const C = window.App.Creator;
        const t = (C && C.currentType) || '';
        const PB = window.App.PanelBoard;
        const formText = (PB && PB.board && document.getElementById('pbq-board')) ? 'ジャンルと問題（ジャンルが列、点の小さい順に並びます）'
            : (PB && PB.active && document.getElementById('pb-list')) ? 'パネル'
            : t === 'numgame' ? '項目と数'
            : t.startsWith('ranking') ? '順位と答え'
            : t.startsWith('multi') ? '正解（すべて）'
            : t.startsWith('assoc') ? 'ヒント'
            : t === 'sort' ? '並べる項目（正しい順に右の四角をタップ）'
            : t.startsWith('choice') ? ((C && C.oxMode) ? '〇か×（正解をタップ）' : '選択肢')
            : '';
        label('cm-sec-q', qArea, (PB && PB.board) ? '盤面のタイトル（空欄なら「パネルクイズ」）' : '問題文');
        label('cm-sec-form', form, form.children.length ? formText : '');
    },

    init: function () {
        document.addEventListener('keydown', (e) => this.onKeyDown(e), true);
        // 押した瞬間（フォーカスが当たる前）にも大きさを確かめる — 後から
        // 足された選択肢の欄などがズームしないように
        document.addEventListener('touchstart', (e) => {
            const t = e.target;
            if (t && t.matches && t.matches('#creator-editor-wrap input, #creator-editor-wrap textarea, #creator-editor-wrap select')) this.enforceMobileSize();
        }, { passive: true, capture: true });
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
        window.App.Ui.showToast(d.noMedia ? '下書きを復元しました（背景画像・問題の画像・音は容量の都合で保存されていません）' : '下書きを復元しました');
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
    after('applyDesignToPreview', function () { App.CreatorMobile.renderSheetStage(); App.CreatorInput.enforceMobileSize(); });
    after('updateRowSizes', function () { App.CreatorInput.enforceMobileSize(); });
    // パネル指名などは描き直しの後にボタンを足すので、並べ替えも一拍おいてから
    after('renderForm', function () {
        setTimeout(() => {
            App.CreatorInput.enforceMobileSize();
            App.CreatorInput.arrangeListControls(true);
            // パネルクイズの盤面に切り替わった時など、見出しとボタンの文言を合わせ直す
            const M = App.CreatorMobile;
            if (M.isMobile() && M.screen === 'edit') M.renderEditHead();
        }, 0);
    });
    after('renderRulesSection', function () { App.CreatorDraft.saveSoon(); });
    // まとめて入力で追加できたら、パネルを閉じて一覧で見せる（増えていなければ直す所があるので開いたまま）
    after('runBulkAdd', function () {
        const M = App.CreatorMobile;
        if (M._sheet === 'bulk' && (window.App.Data.createdQuestions || []).length > (M._bulkBefore || 0)) M.closeSheet();
    });
    // 描き直すとボタンは元の場所に作り直されるので、前に一覧の上下へ移した古いものは先に片付ける
    const origRender = C.renderForm;
    if (typeof origRender === 'function') {
        C.renderForm = function () {
            ['cm-above-list', 'cm-below-list'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
            return origRender.apply(this, arguments);
        };
    }

})();

document.addEventListener('DOMContentLoaded', () => {
    App.CreatorDraft.start();
    App.CreatorInput.init();
    // ほかのファイル（スキン・枠・パネル）も見た目の反映に足しているので、
    // 全部読み込んだ後に一番外側から包み、最後にスマホの見やすい形に戻す
    const C = window.App.Creator;
    if (C && typeof C.applyDesignToPreview === 'function') {
        const orig = C.applyDesignToPreview;
        C.applyDesignToPreview = function () {
            const r = orig.apply(this, arguments);
            try { App.CreatorInput.plainEditor(); } catch (e) { console.warn('plainEditor', e); }
            return r;
        };
    }
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
