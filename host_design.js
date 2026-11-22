/* =========================================================
 * host_design.js (v90: WYSIWYG Preview Calibration)
 * =======================================================*/

App.Design = {
    _activeDesignTab: 'theme',

    // オブジェクト選択 — プレビュー内の要素（問題文/選択肢/全体背景、正解
    // 表示中はその正解ボックス）をタップすると、テキスト/オブジェクト
    // タブの中身がそのオブジェクトに関係する項目だけに絞り込まれる。
    // 選択操作自体（クリック配線・ハイライト）は host_creator.js 側
    // （プレビューの実体を持つ）で行い、ここでは選択状態と、状態に応じた
    // 絞り込みロジック・妥当性チェックだけを持つ。
    _selectedObject: 'question', // 'question' | 'choices' | 'background' | 'reveal'

    _hasChoicesObject: function () {
        const t = (window.App.Creator && window.App.Creator.currentType) || '';
        return t.startsWith('choice') || t === 'sort' || t.startsWith('multi') || t.startsWith('ranking') || t.startsWith('assoc');
    },

    // 正解表示の色（revealTextColor/revealBorderColor/revealBgColor）が
    // 実際に効くタイプだけ — 選択式/ダウト（金色ハイライト）・多答/連想
    // （緑ハイライト）は状態ごとの決め打ち配色が"正解表示"の演出そのもの
    // なので対象外、数字予想（ブラックジャック）は固定の正解がなく色を
    // 塗る対象がない。一問一答/文字パネル/並べ替えだけ、シンプルな
    // 枠＋背景＋文字色のボックスとして表示される。
    _revealColorApplies: function () {
        const t = (window.App.Creator && window.App.Creator.currentType) || '';
        return t.startsWith('free') || t.startsWith('assoc') || t === 'letter_select' || t === 'sort';
    },

    // 選択中のオブジェクトが今の状況（問題タイプ・正解表示のON/OFF）で
    // 実在しなければ、素直に「問題文」へフォールバックする。
    _normalizedSelection: function () {
        let sel = this._selectedObject || 'question';
        if (sel === 'choices' && !this._hasChoicesObject()) sel = 'question';
        if (sel === 'reveal' && !(window.App.Creator && window.App.Creator._previewRevealOn)) sel = 'question';
        // 一問一答で「タイトルを追加」がオンの時だけタイトルを選べる
        const c = window.App.Creator;
        if (sel === 'qtitle' && !(c && c.titleEnabled && (c.currentType || '').startsWith('free'))) sel = 'question';
        return sel;
    },

    // 文字サイズの小/中/大 — 問題文・選択肢・正解・一問一答のタイトルで
    // 共通（以前は部品ごとに「中」の大きさが違っていた）
    FONT_SIZES: [
        { v: '4vh', t: '小' },
        { v: '6vh', t: '中' },
        { v: '9vh', t: '大' },
        { v: '13vh', t: '特大' },
        { v: '18vh', t: '最大' },
    ],

    // 以前の部品ごとの値を、同じ呼び名（小/中/大）の共通の大きさに読み替え、
    // 未設定のものは全部「中」にする（「自動」を選んだもの = '' はそのまま）
    normalizeFontSizes: function (design) {
        if (!design) return design;
        const Q = { '3.5vh': '4vh', '5vh': '6vh', '8vh': '9vh' };
        const C = { '2.5vh': '4vh', '3.5vh': '6vh', '5vh': '9vh' };
        const T = { '3vh': '4vh', '4.5vh': '4vh', '6.5vh': '9vh' };
        design.qFontSize = Q[design.qFontSize] || design.qFontSize || '6vh';
        design.cFontSize = C[design.cFontSize] || design.cFontSize || '6vh';
        design.qTitleFontSize = T[design.qTitleFontSize] || design.qTitleFontSize || '6vh';
        const MID = { revealFontSize: '6vh', bridgeFontSize: '10vw', titleFontSize: '5vw', resultNameSize: '9vh' };
        Object.keys(MID).forEach(k => { if (design[k] === undefined || design[k] === null) design[k] = MID[k]; });
        return design;
    },

    // デザインの「タイマー」タブの見本 — 10秒を繰り返し数える
    _timerDemoId: null,
    // タイマーの見本 — 演出タブを開いている間、作成画面のプレビュー（問題の画面）の
    // 上で実際の位置・大きさに動かして見せる。タブを閉じたら消す。
    _previewTimerLayer: function (create) {
        const preview = document.getElementById('creator-monitor-preview');
        let layer = document.getElementById('creator-timer-layer');
        if (!create) { layer?.remove(); return null; }
        if (!preview) return null;
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'creator-timer-layer';
            layer.className = 'tv-host';
            layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:50;';
            preview.appendChild(layer);
        }
        return layer;
    },
    _startTimerDemo: function (box, design) {
        if (this._timerDemoId) { clearInterval(this._timerDemoId); this._timerDemoId = null; }
        if (!box || !window.App.TimerView) { this._previewTimerLayer(false); return; }
        const C = window.App.Creator;
        const total = 10000;
        const t0 = Date.now();
        const tick = () => {
            // 演出タブが見えなくなったら止める（スマホは閉じても部品が隠れた所に残るので isConnected だけでは止まらない）
            if (!box.isConnected || !box.offsetParent) { clearInterval(this._timerDemoId); this._timerDemoId = null; this._previewTimerLayer(false); return; }
            const elapsed = (Date.now() - t0) % (total + 1500);
            const remain = Math.max(0, total - elapsed);
            // タイマーが出るのは問題の画面だけ
            const onQuestion = !C || !C.previewSlide || C.previewSlide === 'question';
            const layer = this._previewTimerLayer(onQuestion);
            if (layer) {
                if (window.App.Themes) window.App.Themes.applyToElement(layer, design);
                window.App.TimerView.render(layer, design, remain, total);
            }
        };
        tick();
        this._timerDemoId = setInterval(tick, 100);
    },

    selectObject: function (obj) {
        this._selectedObject = obj;
        if (window.App.Creator) {
            // Highlight regardless of which inline panel is currently
            // showing (the preview itself is always visible above it) —
            // only the panel content re-render is gated to デザイン, since
            // that's the only thing this selection actually filters.
            window.App.Creator.highlightSelectedObject();
            const M = window.App.CreatorMobile;
            if (window.App.Creator.activeInlinePanel === 'design' || (M && M._sheet === 'design')) {
                window.App.Creator.renderActivePanelContent('design');
            }
        }
    },

    defaults: {
        mainBgColor: "#0a0a0a",
        qTextColor: "#ffffff",
        qBgColor: "rgba(255, 255, 255, 0.05)",
        qBorderColor: "#00bfff",
        qFontSize: "6vh", // 中 — 小/中/大は FONT_SIZES（全部品共通）
        // 問題文の「枠」自体の大きさ（文字サイズとは別）— 空文字なら
        // これまで通り中身に合わせた自動の高さ（＝小）。中/大はそこから
        // 明示的に高さを大きくする。see BOX_SIZE_OPTS.
        qBoxSize: "",
        cTextColor: "#a0a0a0",
        cBgColor: "transparent",
        cBorderColor: "#333333",
        // 文字サイズは全部「中」が既定
        cFontSize: "6vh",
        qTitleFontSize: "6vh",
        revealFontSize: "6vh",
        bridgeFontSize: "10vw",
        titleFontSize: "5vw",
        resultNameSize: "9vh",
        align: "center",
        cAlign: "left",
        layout: "top",
        bgmThinking: "",
        seQNum: "",
        seResult: "",
        seButton: "",
        seCorrect: "",
        seWrong: "",
        // 正解表示（reveal）専用の配色 — 未設定なら問題文側の色にフォール
        // バックする（viewer.js / renderPreviewReveal 両方）ので、既存の
        // デザインは何も変わらないまま、正解表示オブジェクトを選んで
        // 触った時だけ独自に上書きできる。
        revealTextColor: "",
        revealBorderColor: "",
        revealBgColor: "",
        revealLayout: "center"
    },

    // サウンドのデフォルト — one fixed default for the 4 サウンド fields,
    // shared app-wide (Firebase, not per-browser/per-account), so every new
    // question/set on any device starts with the same sounds. Now
    // read-only from the Creator's side (no more "save these 4 as the
    // default" button — サウンドライブラリ replaced the old per-question
    // upload flow this was designed around); still preloaded as early as
    // possible so App.Creator.init()/loadSet() can read it synchronously.
    _soundKeys: ['bgmThinking', 'seQNum', 'seResult', 'seButton', 'seCorrect', 'seWrong'],
    _cachedAppDefaultSounds: null,

    preloadAppDefaultSounds: function () {
        if (!window.db) return;
        window.db.ref('app_defaults/sounds').once('value')
            .then(snap => { this._cachedAppDefaultSounds = snap.val() || {}; })
            .catch(() => { this._cachedAppDefaultSounds = this._cachedAppDefaultSounds || {}; });
    },

    // this.defaults, with the app-wide サウンドのデフォルト overlaid on
    // top (from the preload cache — synchronous, may be empty if the
    // preload hasn't resolved yet) — the base a brand-new question's/set's
    // design should start from.
    defaultsWithSavedSounds: function () {
        const base = { ...this.defaults };
        const saved = this._cachedAppDefaultSounds;
        if (saved) this._soundKeys.forEach(k => { if (saved[k]) base[k] = saved[k]; });
        return base;
    },

    // カラーパレット — 6 curated 5×4 palettes shown as an accordion in the
    // color-picker popup, so choosing a color is "pick a tile" instead of
    // hunting around a full color wheel every time.
    _colorPalettes: [
        { name: '1. ビビッド / 定番色', colors: ['#FF0000', '#FF3333', '#FF5722', '#FF7043', '#FF9800', '#FFC107', '#FFEB3B', '#CDDC39', '#8BC34A', '#4CAF50', '#009688', '#00BCD4', '#03A9F4', '#2196F3', '#3F51B5', '#673AB7', '#9C27B0', '#E91E63', '#FF4081', '#F44336'] },
        { name: '2. パステル / ライト', colors: ['#FFCDD2', '#F8BBD0', '#FCE4EC', '#FF80AB', '#FF4081', '#FFE0B2', '#FFF9C4', '#FFFDE7', '#FFF59D', '#FFE082', '#DCEDC8', '#C8E6C9', '#B2DFDB', '#A7FFEB', '#B9F6CA', '#B3E5FC', '#BBDEFB', '#C5CAE9', '#D1C4E9', '#E1BEE7'] },
        { name: '3. ダーク / ディープ', colors: ['#4A0000', '#5C0606', '#7A0C0C', '#4E342E', '#3E2723', '#4D3800', '#5D4037', '#33691E', '#1B5E20', '#004D40', '#00363A', '#01579B', '#0D47A1', '#1A237E', '#0A192F', '#311B92', '#4A148C', '#880E4F', '#212121', '#121212'] },
        { name: '4. ネオン / サイバー', colors: ['#FF0055', '#FF1493', '#FF007F', '#FF00AA', '#F000FF', '#FF3F00', '#FF6600', '#FF9900', '#FFCC00', '#FFFF00', '#CCFF00', '#76FF03', '#00FF66', '#00FF99', '#00FFCC', '#00FFFF', '#00CCFF', '#0099FF', '#7DF9FF', '#B000FF'] },
        { name: '5. モノトーン / グレースケール', colors: ['#FFFFFF', '#F5F5F5', '#EEEEEE', '#E0E0E0', '#D6D6D6', '#CCCCCC', '#BDBDBD', '#AAAAAA', '#9E9E9E', '#8D8D8D', '#757575', '#616161', '#545454', '#424242', '#303030', '#2C2C2C', '#212121', '#1A1A1A', '#0F0F0F', '#000000'] },
        { name: '6. リッチ / メタリック＆アース', colors: ['#D4AF37', '#FFD700', '#E5C158', '#C5A059', '#AA771C', '#CD7F32', '#B87333', '#C38B5F', '#A0522D', '#8B4513', '#E5E4E2', '#D9D9D9', '#B0C4DE', '#778899', '#4F6D7A', '#1B365D', '#0B2545', '#134E5E', '#1A4329', '#58111A'] },
    ],

    // 問題文の位置 — normalizes legacy values ('standard'/'split') saved by
    // older sets to the current 4-direction vocabulary.
    normalizeLayout: function (v) {
        if (v === 'standard') return 'top';
        if (v === 'split') return 'right';
        // 'center' は一問一答だけの選択肢（選択肢エリアが無いので画面中央に
        // 問題文を置ける）— 他の形式では描画側で top 扱いにする。
        if (['top', 'bottom', 'left', 'right', 'center'].includes(v)) return v;
        return 'top';
    },

    // Compact デザイン panel for the Creator's inline action-bar system
    // (mirrors App.Config's renderInlineXxx pattern: render into a given
    // container, mutate `design` directly on every change, no confirm
    // step). Only the core per-question visual fields — title/qnumber
    // reveal-card styling (prodDesign) is intentionally left out, per the
    // request to drop that entirely.
    // Native <input type=color> only accepts strict #rrggbb — fall back to
    // a neutral swatch color for values like "transparent"/rgba(...)/"" so
    // opening the picker doesn't silently coerce those to black.
    _toHexOrDefault: function (value, fallback = '#000000') {
        return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback;
    },

    renderInlineChooser: function (container, design, onChange) {
        if (!container) return;
        design.layout = this.normalizeLayout(design.layout);
        this.normalizeFontSizes(design);

        // Compact color swatches, 3-5 per row (no hex text field taking up
        // room — the current value is still available as a hover tooltip).
        // Tapping opens the palette picker popup (_openColorPickerModal)
        // instead of the native OS color wheel — there's no format
        // constraint here (unlike <input type=color>) so the swatch can
        // just show the raw value (hex/rgba/'transparent') directly.
        // `extraHtml` renders below the caption — used by the オブジェクト
        // tab to merge each field's 透明 toggle / 全体背景's image button
        // directly into its own swatch instead of a separate section.
        const colorSwatch = (label, key, extraHtml = '') => `
            <div class="ds-swatch" style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1 1 38px; min-width:0;">
                <button type="button" data-color-swatch-key="${key}" data-color-swatch-label="${label}" title="${design[key] ?? ''}" style="
                    width:100%; height:32px; box-sizing:border-box; padding:0; border:1px solid #3a3a42; border-radius:6px; cursor:pointer;
                    background:${design[key] || 'transparent'};
                "></button>
                <span style="font-size:0.58rem; color:#8b8b95; white-space:nowrap;">${label}</span>
                ${extraHtml}
            </div>
        `;
        const colorRow = (items) => `
            <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
                ${items.map(([label, key, extra]) => colorSwatch(label, key, extra || '')).join('')}
            </div>
        `;

        // Compact 3-per-row variants (control on top, small caption below —
        // matches colorSwatch's look) used to fit 文字色/サイズ/配置 in one
        // row for 問題文 and 選択肢 each.
        // Fixed 32px height (box-sizing:border-box) on all 3 of these so
        // the color swatch/size field/align select line up exactly, even
        // though a <select> and an <input> render their content slightly
        // differently by default.
        const CONTROL_HEIGHT = '32px';
        const miniText = (label, key) => `
            <div style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; min-width:0;">
                <input type="text" data-key="${key}" value="${design[key] ?? ''}" style="
                    width:100%; height:${CONTROL_HEIGHT}; min-height:${CONTROL_HEIGHT}; margin:0; padding:0 4px; background:#1b1b20; border:1px solid #3a3a42;
                    border-radius:6px; color:#fff; font-size:0.72rem; text-align:center; box-sizing:border-box;
                ">
                <span style="font-size:0.58rem; color:#8b8b95; white-space:nowrap;">${label}</span>
            </div>
        `;
        const miniSelect = (label, key, options) => `
            <div style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; min-width:0;">
                <select data-key="${key}" style="
                    width:100%; height:${CONTROL_HEIGHT}; min-height:${CONTROL_HEIGHT}; margin:0; padding:0 2px; background:#1b1b20; border:1px solid #3a3a42;
                    border-radius:6px; color:#fff; font-size:0.66rem; box-sizing:border-box;
                ">
                    ${options.map(o => `<option value="${o.v}" ${(design[key] ?? '') === o.v ? 'selected' : ''}>${o.t}</option>`).join('')}
                </select>
                <span style="font-size:0.58rem; color:#8b8b95; white-space:nowrap;">${label}</span>
            </div>
        `;
        const ALIGN_OPTS = [{ v: 'left', t: '左寄せ' }, { v: 'center', t: '中央' }, { v: 'right', t: '右寄せ' }];
        // 問題文の文字サイズ — px の自由入力だと大きさを毎回手探りする
        // ことになるので、Wordのフォントサイズのように選ぶだけのプリ
        // セットにする。文字サイズと「枠の大きさ」（BOX_SIZE_OPTS）は
        // 別の設定 — 混同しないよう、ここに行数の話は含めない。
        // 文字の小/中/大は、問題文・選択肢・正解・タイトルで共通の大きさ
        // （App.Design.FONT_SIZES）— 形式や部品によって意味が変わらないように
        const Q_SIZE_OPTS = this.FONT_SIZES;
        // 問題文の上下位置（枠を「中/大」にした時に効く）
        const V_ALIGN_OPTS = [{ v: '', t: '上' }, { v: 'middle', t: '中央' }, { v: 'bottom', t: '下' }];
        // 一問一答のタイトル（問題文の上）の文字サイズ
        const Q_TITLE_SIZE_OPTS = this.FONT_SIZES;
        // 正解表示の文字サイズ — 自動＝正解の長さで決める（従来どおり）
        const REVEAL_SIZE_OPTS = [{ v: '', t: '自動' }].concat(this.FONT_SIZES);
        // 選択肢の文字サイズも同じ理由でプリセット化。
        const C_SIZE_OPTS = this.FONT_SIZES;
        // 問題文の「枠」自体の大きさ（文字サイズとは別） — 小＝これまで
        // 通りの自動の高さ（前回の枠の大きさ）、中＝その約2倍、大＝約3倍。
        const BOX_SIZE_OPTS = [
            { v: '', t: '小' },
            { v: '40vh', t: '中' },
            { v: '60vh', t: '大' },
        ];

        const gridSummary = () => {
            const r = parseInt(design.gridRows) || 0;
            const c = parseInt(design.gridCols) || 0;
            return (r > 0 && c > 0) ? `${r}行 × ${c}列` : '自動';
        };

        // A plain (non-interactive) label sized to sit in the same row as
        // colorSwatch/miniText/miniSelect — the row itself centers it
        // vertically against their (control + caption) height.
        const rowLabel = (text) => `
            <div class="ds-rowlabel" style="flex:0 0 34px; display:flex; align-items:center; justify-content:center;">
                <span style="font-size:0.66rem; color:#8b8b95; font-weight:bold; white-space:nowrap;">${text}</span>
            </div>
        `;

        // 連想クイズの項目は「選択肢」ではなく「ヒント」なので文言だけ
        // 差し替える — グリッド設定自体は選択式/並べ替え/多答/連想の
        // どのタイプにも共通で効く（#creator-choices-list を使う全タイプ、
        // applyDesignToPreview 側）。
        const isAssoc = ((window.App.Creator && window.App.Creator.currentType) || '').startsWith('assoc');
        const isPanel = !!(window.App.PanelBoard && window.App.PanelBoard.active && (document.getElementById('pb-list') || document.getElementById('pbq-board')));
        const choicesLabel = isPanel ? 'パネル' : isAssoc ? 'ヒント' : '選択肢';

        // プレビューでタップした対象に応じて、テキスト/オブジェクトタブの
        // 中身をその対象に関係する項目だけへ絞り込む。何が選ばれているか
        // 文字でも分かるよう、両タブの先頭に小さな見出しを出す。
        // 一問一答でタイトルがある時、問題文の設定からタイトルの設定へ移るボタン
        const qTitleJump = () => {
            const c = window.App.Creator;
            if (!(c && c.titleEnabled && (c.currentType || '').startsWith('free'))) return '';
            return `<button type="button" data-select-object="qtitle" style="
                width:100%; margin:0 0 8px; padding:5px 8px; background:rgba(255,215,0,0.08); border:1px dashed rgba(255,215,0,0.5);
                border-radius:6px; color:#ffd700; font-size:0.7rem; cursor:pointer;">タイトルの文字・枠・背景を変える</button>`;
        };
        const OBJECT_TITLES = { question: '問題文', qtitle: 'タイトル', choices: choicesLabel, background: '全体背景', reveal: '正解表示' };
        // 何を編集するかの切り替え（プレビューを押して選ぶのと同じ。スマホの下から出るパネルでも選べるように）
        const selectionHeader = (sel) => {
            const c = window.App.Creator;
            const objs = [['question', OBJECT_TITLES.question]];
            if (c && c.titleEnabled && (c.currentType || '').startsWith('free')) objs.push(['qtitle', OBJECT_TITLES.qtitle]);
            if (this._hasChoicesObject()) objs.push(['choices', OBJECT_TITLES.choices]);
            objs.push(['background', OBJECT_TITLES.background]);
            if (sel === 'reveal') objs.push(['reveal', OBJECT_TITLES.reveal]);
            return `<div class="ds-target" role="radiogroup">${objs.map(([k, t]) => `<button type="button" role="radio" aria-checked="${k === sel}" class="ds-obj${k === sel ? ' on' : ''}" data-select-object="${k}">${t}</button>`).join('')}</div>`;
        };

        const bodyHtml = {
            text: () => {
                const sel = this._normalizedSelection();
                if (sel === 'qtitle') {
                    return `
                        ${selectionHeader(sel)}
                        <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                            ${colorSwatch('文字色', 'qTitleColor')}
                            ${miniSelect('サイズ', 'qTitleFontSize', Q_TITLE_SIZE_OPTS)}
                            ${miniSelect('左右', 'qTitleAlign', ALIGN_OPTS)}
                        </div>
                        <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※タイトルの文言はプレビューのタイトル欄に直接入力します</p>
                    `;
                }
                if (sel === 'choices') {
                    return `
                        ${selectionHeader(sel)}
                        <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                            ${rowLabel(choicesLabel)}
                            ${colorSwatch('文字色', 'cTextColor')}
                            ${miniSelect('サイズ', 'cFontSize', C_SIZE_OPTS)}
                            ${isPanel ? '' : miniSelect('左右', 'cAlign', ALIGN_OPTS)}
                        </div>
                        ${(((window.App.Creator && window.App.Creator.currentType) || '').startsWith('choice') && !(window.App.Creator && window.App.Creator.oxMode)) ? `
                        <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                            ${rowLabel('記号')}
                            ${colorSwatch('文字色', 'cPrefixColor')}
                            ${miniSelect('種類', 'cPrefixType', [{ v: '', t: 'A B C' }, { v: 'lower', t: 'a b c' }, { v: 'number', t: '1 2 3' }])}
                        </div>` : ''}
                    `;
                }
                if (sel === 'reveal') {
                    if (!this._revealColorApplies()) {
                        return `
                            ${selectionHeader(sel)}
                            <p style="color:#666; font-size:0.78rem; text-align:center; padding:20px 0;">この問題形式の正解表示は、色が決まった専用の演出のため変更できません</p>
                        `;
                    }
                    return `
                        ${selectionHeader(sel)}
                        <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                            ${rowLabel('正解表示')}
                            ${colorSwatch('文字色', 'revealTextColor')}
                            ${miniSelect('サイズ', 'revealFontSize', REVEAL_SIZE_OPTS)}
                            ${miniSelect('左右', 'revealAlign', ALIGN_OPTS)}
                        </div>
                        <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※未設定の間は問題文の文字色がそのまま使われます</p>
                    `;
                }
                if (sel === 'background') {
                    return `
                        ${selectionHeader(sel)}
                        <p style="color:#666; font-size:0.78rem; text-align:center; padding:20px 0;">全体背景に文字設定はありません</p>
                    `;
                }
                return `
                    ${selectionHeader('question')}
                    ${qTitleJump()}
                    <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                        ${colorSwatch('文字色', 'qTextColor')}
                        ${miniSelect('サイズ', 'qFontSize', Q_SIZE_OPTS)}
                        ${miniSelect('左右', 'align', ALIGN_OPTS)}
                        ${miniSelect('上下', 'qVAlign', V_ALIGN_OPTS)}
                        ${miniSelect('向き', 'qWritingMode', [{ v: '', t: '横書き' }, { v: 'vertical', t: '縦書き' }])}
                    </div>
                `;
            },
            object: () => {
                const sel = this._normalizedSelection();
                if (sel === 'qtitle') {
                    return `
                        ${selectionHeader(sel)}
                        <div style="display:flex; gap:6px;">
                            ${colorSwatch('タイトル枠', 'qTitleBorderColor')}
                            ${colorSwatch('タイトル背景', 'qTitleBgColor')}
                        </div>
                        <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※未設定の間は枠・背景なし（文字だけ）で表示されます</p>
                    `;
                }

                if (sel === 'choices') {
                    return `
                        ${selectionHeader(sel)}
                        ${isPanel ? '' : colorRow([
                            [`${choicesLabel}枠`, 'cBorderColor'],
                            [`${choicesLabel}背景`, 'cBgColor'],
                        ])}
                        <div style="display:flex; gap:6px; margin-top:8px;">
                            <button type="button" id="design-grid-config-btn" style="
                                flex:1; min-width:0; padding:6px 6px; background:#1b1b20; border:1px solid #3a3a42;
                                border-radius:8px; color:#fff; font-size:0.72rem; cursor:pointer;
                                display:flex; flex-direction:row; align-items:center; justify-content:center; gap:5px;
                            ">
                                <span>${choicesLabel}の配置</span>
                                <span id="design-grid-summary" style="color:#f59e0b; font-weight:bold;">${gridSummary()}</span>
                            </button>
                        </div>
                        ${isPanel ? '' : `<div style="display:flex; gap:6px; margin-top:8px;">
                            ${miniSelect(`${choicesLabel}の高さ`, 'cHeight', [{ v: '', t: '標準' }, { v: 'fill', t: '目いっぱい' }])}
                        </div>`}
                        ${window.App.ItemImage && window.App.ItemImage.supports() ? `
                        <div style="display:flex; gap:6px; margin-top:8px;">
                            ${miniSelect('画像の見せ方', 'cImgMode', [{ v: '', t: '画像と文字' }, { v: 'only', t: '画像だけ' }])}
                            ${miniSelect('画像の大きさ', 'cImgSize', [{ v: 'small', t: '小' }, { v: '', t: '中' }, { v: 'large', t: '大' }])}
                        </div>
                        <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※画像は問題を書く画面で、${choicesLabel}の行の画像ボタンから入れます（文字は正解発表で使うので必要です）</p>
                        <label class="ds-flag"><input type="checkbox" data-design-flag="playerImages" ${design.playerImages === 'off' ? '' : 'checked'}><span>回答者のスマホにも画像を出す</span></label>
                        <p style="color:#555; font-size:0.62rem; margin:2px 0 0;">※外すと回答者のスマホは画像を読み込まず、文字だけになります（画像が多い時に軽くなります。モニターには出ます）</p>` : ''}
                    `;
                }

                if (sel === 'background') {
                    // 画像アップロードはこのスウォッチ自身のカラーポップ
                    // オーバー内（_openColorPickerModal）に統合済み —
                    // ここでは色スウォッチを出すだけでよい。
                    // 背景色と背景画像を同じ行に並べる
                    const bgImg = design.bgImage || '';
                    const hasBgImg = bgImg.startsWith('data:') || bgImg.startsWith('http');
                    return `
                        ${selectionHeader(sel)}
                        <div style="display:flex; gap:6px;">
                            ${colorSwatch('背景色', 'mainBgColor')}
                            <div style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1 1 38px; min-width:0;">
                                <div style="display:flex; width:100%; gap:4px;">
                                    <button type="button" data-bgimg-pick title="背景に画像を使う" style="
                                        flex:1; min-width:0; height:32px; box-sizing:border-box; padding:0; border-radius:6px; cursor:pointer;
                                        border:1px ${hasBgImg ? 'solid #f59e0b' : 'dashed #3a3a42'};
                                        background:${hasBgImg ? `center/cover no-repeat url(${bgImg})` : '#1b1b20'};
                                        color:#8b8b95; font-size:0.66rem;
                                    ">${hasBgImg ? '' : `<span style="display:inline-flex; align-items:center; gap:4px;">${window.App.Icons.svg('image', 14)}画像を選ぶ</span>`}</button>
                                    ${hasBgImg ? `<button type="button" data-bgimg-clear title="画像を外す" style="
                                        flex:0 0 auto; width:28px; height:32px; padding:0; border:1px dashed #ff8888; border-radius:6px;
                                        background:none; color:#ff8888; cursor:pointer;">×</button>` : ''}
                                </div>
                                <span style="font-size:0.58rem; color:#8b8b95; white-space:nowrap;">背景画像</span>
                                <input type="file" accept="image/*" data-bgimg-input style="display:none;">
                            </div>
                        </div>
                        ${(() => {
                            // この問題だけの背景（問題ごと — セット全体の背景より優先。ブリッジ・正解の画面も同じ）
                            const QI = window.App.QuestionImage;
                            if (!QI) return '';
                            const qb = QI.bg || '';
                            return `
                        <div class="ds-qbg">
                            <span class="ds-qbg-label">この問題だけの背景</span>
                            <button type="button" data-qbg-pick class="ds-qbg-pick${qb ? ' has' : ''}" style="${qb ? `background:center/cover no-repeat url(${qb});` : ''}">${qb ? '' : `${window.App.Icons.svg('image', 14)}<span>画像を選ぶ</span>`}</button>
                            ${qb ? '<button type="button" data-qbg-clear class="ds-qbg-clear" title="外す">×</button>' : ''}
                        </div>
                        <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※選ぶと、今書いている問題だけ背景が変わります（ほかの問題はセット全体の背景のまま）</p>`;
                        })()}
                    `;
                }

                if (sel === 'reveal') {
                    if (!this._revealColorApplies()) {
                        return `
                            ${selectionHeader(sel)}
                            <p style="color:#666; font-size:0.78rem; text-align:center; padding:20px 0;">この問題形式の正解表示は、色が決まった専用の演出のため変更できません</p>
                        `;
                    }
                    // 正解の位置は中央に大きく出す正解表示だけ（並べ替えは
                    // 順番のリストを画面いっぱいに出す専用の演出）
                    const isSortType = ((window.App.Creator && window.App.Creator.currentType) || '') === 'sort';
                    const REVEAL_LAYOUT_OPTS = [{ v: 'center', t: '中央' }, { v: 'top', t: '上側' }, { v: 'bottom', t: '下側' }, { v: 'left', t: '左側' }, { v: 'right', t: '右側' }];
                    return `
                        ${selectionHeader(sel)}
                        <div style="display:flex; gap:6px; margin-bottom:8px;">
                            ${colorSwatch('正解枠', 'revealBorderColor')}
                            ${colorSwatch('正解背景', 'revealBgColor')}
                            ${isSortType ? '' : miniSelect('正解の位置', 'revealLayout', REVEAL_LAYOUT_OPTS)}
                        </div>
                        <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※未設定の間は問題枠・問題背景の色がそのまま使われます</p>
                    `;
                }

                return `
                    ${selectionHeader('question')}
                    ${qTitleJump()}
                    <div style="display:flex; gap:6px;">
                        ${colorSwatch('問題枠', 'qBorderColor')}
                        ${colorSwatch('問題背景', 'qBgColor')}
                        ${miniSelect('枠の大きさ', 'qBoxSize', BOX_SIZE_OPTS)}
                        ${miniSelect('問題文の位置', 'layout', [{ v: 'top', t: '上側' }, { v: 'left', t: '左側' }, { v: 'right', t: '右側' }, { v: 'bottom', t: '下側' }]
                            .concat(((window.App.Creator && window.App.Creator.currentType) || '').startsWith('free') ? [{ v: 'center', t: '中央' }] : []))}
                    </div>
                    ${window.App.QuestionImage && window.App.QuestionImage.supports() ? `
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        ${miniSelect('画像の置き方', 'qImgLayout', [{ v: '', t: '文字の上' }, { v: 'side', t: '文字の横' }, { v: 'big', t: '大きく' }])}
                        ${miniSelect('画像の大きさ', 'qImgSize', [{ v: 'small', t: '小' }, { v: '', t: '中' }, { v: 'large', t: '大' }])}
                    </div>
                    <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※画像そのものは、問題を書く画面で問題文の欄に入れます（問題ごと）</p>
                        <label class="ds-flag"><input type="checkbox" data-design-flag="playerImages" ${design.playerImages === 'off' ? '' : 'checked'}><span>回答者のスマホにも画像を出す</span></label>` : ''}
                `;
            },
            sound: () => {
                // Compact tile, matching colorSwatch's look — tap to open
                // the full editor (URL/file/play/clear) in a popup instead
                // of a full card taking its own vertical space inline.
                const soundTile = (label, key, icon) => {
                    const val = design[key] || '';
                    const hasFile = val.startsWith('data:');
                    const isSet = !!val;
                    return `
                        <button type="button" data-sound-tile="${key}" data-sound-label="${label}" style="
                            flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:2px;
                            padding:7px 2px; background:#1b1b20; border:1px solid ${isSet ? '#f59e0b' : '#3a3a42'};
                            border-radius:8px; color:#fff; cursor:pointer;
                        ">
                            <span style="display:flex; line-height:1;">${icon}</span>
                            <span style="font-size:0.56rem; color:#8b8b95; white-space:nowrap;">${label}</span>
                            <span style="font-size:0.52rem; color:${isSet ? '#f59e0b' : '#555'};">${isSet ? (hasFile ? 'あり' : 'URL') : '未設定'}</span>
                        </button>
                    `;
                };
                return `
                    <div style="display:flex; gap:6px; margin-bottom:8px;">
                        ${soundTile('出題中BGM', 'bgmThinking', window.App.Icons.svg('music'))}
                        ${soundTile('ボタンSE', 'seButton', window.App.Icons.svg('button'))}
                        ${soundTile('正解音', 'seCorrect', window.App.Icons.svg('correct'))}
                        ${soundTile('不正解音', 'seWrong', window.App.Icons.svg('wrong'))}
                    </div>
                `;
            },
            animation: () => `<p style="color:#666; font-size:0.8rem; text-align:center; padding:30px 0;">モーションは準備中です</p>`,
        };

        // プレビューで「ブリッジ」「結果」を選んでいる間は、同じ4タブの
        // 中身をその画面用の設定に差し替える（色・背景・音はセット共通の
        // design、ブリッジの文言だけは問題ごと — App.Creator.qNumText）。
        const slide = (window.App.Creator && window.App.Creator.previewSlide) || 'question';
        const slideHeader = (title) => `
            <div class="ds-target"><span class="ds-target-tag">編集中</span><span>${title}</span></div>
        `;
        const slideSoundTile = (label, key, icon) => {
            const isSet = !!(design[key] || '');
            return `
                <button type="button" data-sound-tile="${key}" data-sound-label="${label}" style="
                    flex:0 0 auto; min-width:90px; display:flex; flex-direction:column; align-items:center; gap:2px;
                    padding:7px 10px; background:#1b1b20; border:1px solid ${isSet ? '#f59e0b' : '#3a3a42'};
                    border-radius:8px; color:#fff; cursor:pointer;
                ">
                    <span style="display:flex; line-height:1;">${icon}</span>
                    <span style="font-size:0.56rem; color:#8b8b95; white-space:nowrap;">${label}</span>
                    <span style="font-size:0.52rem; color:${isSet ? '#f59e0b' : '#555'};">${isSet ? 'あり' : '未設定'}</span>
                </button>
            `;
        };
        const bgImageCheck = (key, checked) => `
            <label style="display:flex; align-items:center; gap:6px; margin-top:8px; color:#c9c9cf; font-size:0.72rem; cursor:pointer;">
                <input type="checkbox" data-check-key="${key}" ${checked ? 'checked' : ''} style="accent-color:#f59e0b; cursor:pointer;">全体背景の画像を使う
            </label>
        `;
        const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const BRIDGE_SIZE_OPTS = [
            { v: '', t: '自動' },
            { v: '7vw', t: '小' },
            { v: '10vw', t: '中' },
            { v: '14vw', t: '大' },
        ];
        const RESULT_SIZE_OPTS = [
            { v: '', t: '自動' },
            { v: '6vh', t: '小' },
            { v: '9vh', t: '中' },
            { v: '12vh', t: '大' },
        ];
        const bridgeBody = {
            text: () => `
                ${slideHeader('ブリッジスライド')}
                <input type="text" data-qnum-text value="${esc(window.App.Creator && window.App.Creator.qNumText)}" placeholder="空欄なら「第○問」（この問題だけの文言）" style="
                    width:100%; height:${CONTROL_HEIGHT}; min-height:${CONTROL_HEIGHT}; padding:0 8px; margin:0 0 8px; background:#1b1b20; border:1px solid #3a3a42;
                    border-radius:6px; color:#fff; box-sizing:border-box;
                ">
                <div style="display:flex; gap:6px; align-items:center;">
                    ${colorSwatch('文字色', 'bridgeTextColor')}
                    ${miniSelect('サイズ', 'bridgeFontSize', BRIDGE_SIZE_OPTS)}
                </div>
            `,
            object: () => `
                ${slideHeader('ブリッジスライド')}
                <div style="display:flex; gap:6px;">
                    ${colorSwatch('背景色', 'bridgeBgColor')}
                </div>
                ${bgImageCheck('bridgeUseBgImage', !!design.bridgeUseBgImage)}
            `,
            sound: () => `
                ${slideHeader('ブリッジスライド')}
                <div style="display:flex; gap:6px;">${slideSoundTile('問題番号音', 'seQNum', window.App.Icons.svg('hash'))}</div>
                <p style="color:#555; font-size:0.62rem; margin:6px 0 0;">※「第○問」がモニターに出た瞬間に、モニター画面で鳴ります</p>
            `,
            animation: bodyHtml.animation,
            // 演出 — ブリッジの見せ方の型
            timer: () => {
                const BV = window.App.BridgeView;
                if (!BV) return '';
                const cur = design.bridgeStyle || 'plain';
                return `
                    ${slideHeader('ブリッジスライド')}
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
                        ${BV.STYLES.map(st => `
                            <button type="button" data-bridge-style="${st.id}" style="padding:10px 4px; border-radius:8px; cursor:pointer; font-size:0.72rem; font-weight:bold;
                                background:${cur === st.id ? 'rgba(245, 158, 11,0.12)' : '#1b1b20'}; border:1px solid ${cur === st.id ? '#f59e0b' : '#3a3a42'}; color:${cur === st.id ? '#f59e0b' : '#e5e5e8'};">${st.name}</button>
                        `).join('')}
                    </div>
                    <p style="color:#555; font-size:0.62rem; margin:8px 0 0;">※押すとプレビューで動きを確認できます。帯や光の色はテーマのアクセント色です</p>`;
            },
        };
        const resultBody = {
            text: () => `
                ${slideHeader('結果表示')}
                <div style="display:flex; gap:6px; align-items:center;">
                    ${colorSwatch('見出しの色', 'resultLabelColor')}
                    ${colorSwatch('正解者の色', 'resultNameColor')}
                    ${miniSelect('正解者のサイズ', 'resultNameSize', RESULT_SIZE_OPTS)}
                </div>
                <p style="color:#555; font-size:0.62rem; margin:6px 0 0;">※早押し・順番などで出る「正解者」の画面の文字です</p>
            `,
            object: () => `
                ${slideHeader('結果表示')}
                <div style="display:flex; gap:6px;">
                    ${colorSwatch('背景色', 'resultBgColor')}
                </div>
                ${bgImageCheck('resultUseBgImage', design.resultUseBgImage !== false)}
                <p style="color:#555; font-size:0.62rem; margin:6px 0 0;">※背景色が未設定の間は全体背景の色が使われます</p>
            `,
            sound: () => `
                ${slideHeader('結果表示')}
                <div style="display:flex; gap:6px;">${slideSoundTile('結果発表音', 'seResult', window.App.Icons.svg('trophy'))}</div>
                <p style="color:#555; font-size:0.62rem; margin:6px 0 0;">※結果発表の画面に切り替わった瞬間に、モニター画面で鳴ります</p>
            `,
            animation: bodyHtml.animation,
        };
        const TITLE_SIZE_OPTS = [
            { v: '', t: '自動' },
            { v: '3.5vw', t: '小' },
            { v: '5vw', t: '中' },
            { v: '7vw', t: '大' },
        ];
        const titleBody = {
            text: () => `
                ${slideHeader('タイトル画面')}
                <input type="text" data-key="titleText" value="${esc(design.titleText)}" placeholder="空欄ならセット名（${esc((window.App.Creator && window.App.Creator.editingTitle) || '未設定')}）" style="
                    width:100%; height:${CONTROL_HEIGHT}; min-height:${CONTROL_HEIGHT}; padding:0 8px; margin:0 0 8px; background:#1b1b20; border:1px solid #3a3a42;
                    border-radius:6px; color:#fff; box-sizing:border-box;
                ">
                <div style="display:flex; gap:6px; align-items:center;">
                    ${colorSwatch('文字色', 'titleColor')}
                    ${miniSelect('サイズ', 'titleFontSize', TITLE_SIZE_OPTS)}
                    ${miniSelect('左右', 'titleAlign', [{ v: '', t: '中央' }, { v: 'left', t: '左寄せ' }, { v: 'right', t: '右寄せ' }])}
                    ${miniSelect('上下', 'titleVAlign', [{ v: 'top', t: '上' }, { v: '', t: '中央' }, { v: 'bottom', t: '下' }])}
                </div>
            `,
            object: () => `
                ${slideHeader('タイトル画面')}
                <div style="display:flex; gap:6px;">
                    ${colorSwatch('背景色', 'titleBgColor')}
                </div>
                ${bgImageCheck('titleUseBgImage', !!design.titleUseBgImage)}
            `,
            sound: () => `
                ${slideHeader('タイトル画面')}
                <p style="color:#666; font-size:0.78rem; text-align:center; padding:20px 0;">タイトル画面のサウンドは準備中です</p>
            `,
            animation: bodyHtml.animation,
        };
        const activeBody = slide === 'bridge' ? bridgeBody : slide === 'result' ? resultBody : slide === 'title' ? titleBody : bodyHtml;

        // テーマ — 番組の見た目一式（色・フォント・アクセント）を1タップで
        // 切り替える。テーマはセット共通のデザインに書き込まれ、ほかのタブで
        // 個別の色を変えれば、その部分だけテーマから上書きされる。
        const Themes = window.App.Themes;
        const themeBody = () => {
            if (!Themes) return '';
            const modified = Themes.isModified(design);
            const card = (t) => {
                const on = design.themeId === t.id;
                const c = t.colors;
                const font = Themes.fontCss(t.font) || 'inherit';
                Themes.ensureFont(t.font);
                return `
                    <button type="button" data-theme-id="${t.id}" style="
                        display:flex; flex-direction:column; gap:4px; padding:6px; min-width:0;
                        background:#1b1b20; border:2px solid ${on ? '#f59e0b' : '#2c2c33'}; border-radius:8px; cursor:pointer; text-align:left;">
                        <div style="width:100%; aspect-ratio:16/9; box-sizing:border-box; border-radius:4px; background:${c.mainBgColor}; font-family:${font};
                            display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:4px; overflow:hidden;">
                            ${window.App.ChoiceSkin ? window.App.ChoiceSkin.miniHtml(t) : ''}
                        </div>
                        <span style="font-size:0.68rem; font-weight:bold; color:${on ? '#f59e0b' : '#e5e5e8'};">${t.name}${on && modified ? '<span style="color:#8b8b95; font-weight:normal;">（カスタム）</span>' : ''}</span>
                        <span style="font-size:0.56rem; color:#8b8b95; line-height:1.3;">${t.desc}</span>
                    </button>
                `;
            };
            // 段の見出し
            const head = (t) => `<div style="margin:14px 0 6px; color:#8b8b95; font-size:0.7rem; font-weight:bold;">${t}</div>`;
            const chipBase = 'min-width:0; padding:8px 4px; border-radius:6px; cursor:pointer; text-align:center; box-sizing:border-box;';
            const chip = (on) => `${chipBase} background:${on ? '#26262d' : '#1b1b20'}; border:1px solid ${on ? '#f59e0b' : '#2c2c33'}; color:#e5e5e8;`;
            // 書体 — 名前をその書体で見せる
            const curFont = design.fontFamily || '';
            const fontChips = Object.entries(Themes.FONTS).map(([k, f]) => {
                Themes.previewFont(k);
                return `<button type="button" data-font-key="${k}" style="${chip(curFont === k)} font-family:${Themes.fontCss(k) || 'inherit'}; font-size:0.95rem; line-height:1.2;">${f.name}</button>`;
            }).join('');
            // 文字の飾り — 「第1問」を飾った見本で
            const curFx = design.textFx || 'none';
            const sampleBg = design.mainBgColor && design.mainBgColor !== 'transparent' ? design.mainBgColor : '#0a0a0a';
            const fxChips = Object.entries(Themes.TEXT_FX).map(([k, f]) => {
                const fx = Object.assign({}, f, { shadowColor: f.shadowColor || design.accentColor || '#00e5ff' });
                return `<button type="button" data-tfx="${k}" style="${chip(curFx === k)} padding:6px 4px;">
                    <span style="display:block; padding:6px 0; border-radius:4px; background:${sampleBg}; color:${design.qTextColor || '#ffffff'}; font-family:${Themes.fontCss(curFont) || 'inherit'}; font-weight:900; font-size:1.15rem; ${Themes.fxInline(fx)}">第1問</span>
                    <span style="display:block; margin-top:4px; font-size:0.62rem; color:${curFx === k ? '#f59e0b' : '#8b8b95'};">${f.name}</span>
                </button>`;
            }).join('');
            const flag = (k, label) => `<label style="display:flex; align-items:center; gap:6px; color:#e5e5e8; font-size:0.72rem; cursor:pointer;">
                <input type="checkbox" data-design-flag="${k}" ${design[k] !== 'off' ? 'checked' : ''} style="width:auto; margin:0; accent-color:#f59e0b;">${label}</label>`;
            const FX_STROKE = [{ v: '', t: '型のまま' }, { v: 'none', t: 'なし' }, { v: 'thin', t: '細い' }, { v: 'thick', t: '太い' }];
            const FX_SHADOW = [{ v: '', t: '型のまま' }, { v: 'none', t: 'なし' }, { v: 'drop', t: 'ふんわり' }, { v: 'offset', t: 'ずらし' }, { v: 'glow', t: '光る' }, { v: 'solid', t: '立体' }];
            const detailsOpen = this._lookDetailsOpen ? 'open' : '';
            // 細部の色は、空（型のまま）でも今の型の色を見本に出す
            const eff = Themes.textFx(design);
            const fxSwatch = (label, key, v) => colorSwatch(label, key).replace('background:transparent;', `background:${v || 'transparent'};`);
            return `
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(96px, 1fr)); gap:6px;">
                    ${Themes.list.map(card).join('')}
                </div>
                ${head('書体')}
                <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px;">${fontChips}</div>
                ${head('文字の飾り')}
                <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px;">${fxChips}</div>
                ${head('色')}
                <div style="display:flex; gap:6px; align-items:center;">
                    ${colorSwatch('アクセント', 'accentColor')}${colorSwatch('全体の背景', 'mainBgColor')}
                </div>
                <details id="design-look-details" ${detailsOpen} style="margin-top:16px; border-top:1px solid #26262d; padding-top:10px;">
                    <summary style="cursor:pointer; color:#e5e5e8; font-size:0.8rem; font-weight:bold; padding:6px 0;">細かく変える</summary>
                    ${head('文字の飾りの細部')}
                    <div style="display:flex; gap:6px; align-items:flex-start;">
                        ${miniSelect('縁の太さ', 'tfx_stroke', FX_STROKE)}${fxSwatch('縁の色', 'tfx_strokeColor', eff.strokeColor)}
                    </div>
                    <div style="display:flex; gap:6px; align-items:flex-start; margin-top:8px;">
                        ${miniSelect('影', 'tfx_shadow', FX_SHADOW)}${fxSwatch('影の色', 'tfx_shadowColor', eff.shadowColor)}${fxSwatch('文字の色', 'tfx_fill', eff.fill)}
                    </div>
                    <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:10px;">
                        ${flag('tfxQ', '問題文')}${flag('tfxC', '選択肢・パネル')}${flag('tfxB', '第◯問')}
                    </div>
                    <p style="color:#555; font-size:0.62rem; margin:6px 0 0;">色を空にすると、型の色に戻ります</p>
                    ${isPanel ? `${head('パネルの色')}
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${colorSwatch('パネル', 'pbBg')}${colorSwatch('数字', 'pbText')}${colorSwatch('枠', 'pbBorder')}
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
                        ${colorSwatch('正解した時', 'pbOk')}${colorSwatch('その文字', 'pbOkText')}${colorSwatch('取られた後', 'pbDone')}
                    </div>` : ''}
                    ${window.App.ChoiceSkin ? window.App.ChoiceSkin.panelHtml(design) : ''}
                    ${(() => {
                        // 問題の枠と回答の枠の割合（プレビューの境目をドラッグしても変えられる）
                        const r = Number(design.splitRatio) || 0;
                        return `
                            <div style="margin:14px 0 6px; color:#8b8b95; font-size:0.7rem; font-weight:bold; display:flex; justify-content:space-between;">
                                <span>問題の枠と回答の枠の大きさ</span>
                                <span id="split-ratio-val" style="color:#e5e5e8;">${r ? `問題 ${r}％` : '自動'}</span>
                            </div>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <input type="range" id="split-ratio-range" min="15" max="80" step="1" value="${r || 40}" style="flex:1; height:auto !important; min-height:0 !important; margin:0; accent-color:#f59e0b;">
                                <button type="button" id="split-ratio-auto" style="flex:0 0 auto; padding:5px 10px; border-radius:6px; background:${r ? '#1b1b20' : 'rgba(245, 158, 11,0.12)'}; border:1px solid ${r ? '#3a3a42' : '#f59e0b'}; color:${r ? '#e5e5e8' : '#f59e0b'}; font-size:0.7rem; cursor:pointer;">自動</button>
                            </div>
                            <p style="color:#555; font-size:0.62rem; margin:6px 0 0;">プレビューの点線をドラッグしても変えられます</p>`;
                    })()}
                    <p style="color:#555; font-size:0.62rem; margin:10px 0 0;">部品ごとの文字・色・形は「文字の細部」「部品の細部」で変えられます</p>
                </details>
            `;
        };
        activeBody.theme = themeBody;

        // タイマーの見た目 — 動き（何秒・1問ごとか全体か）はルールの「制限時間」
        const TV = window.App.TimerView;
        const timerBody = () => {
            if (!TV) return '';
            // 時間の制限が「なし」の時はタイマーが出ないので、見た目の設定もしない
            if ((window.App.Data.currentConfig || {}).timeLimitEnabled !== 'on') {
                return `
                    <div style="padding:14px 12px; border-radius:10px; background:#17171b; border:1px solid #2a2a30; color:#c9c9cf; font-size:0.78rem; line-height:1.6;">
                        <div style="color:#e5e5e8; font-weight:bold; margin-bottom:4px;">タイマー</div>
                        時間の制限が「なし」なので、タイマーは出ません。
                        <button type="button" data-goto-rules-time style="display:block; width:100%; margin-top:10px; padding:10px; border-radius:8px; background:#1b1b20; border:1px solid #3a3a42; color:#fff; font-weight:bold; cursor:pointer;">ルールの「時間」で制限時間を決める</button>
                    </div>
                    ${liveSection()}
                `;
            }
            const cur = design.timerStyle || 'bar_top';
            if (design.timerWarnSec === undefined || design.timerWarnSec === '') design.timerWarnSec = '5';
            const warnSec = design.timerWarnSec !== undefined && design.timerWarnSec !== '' ? Number(design.timerWarnSec) : 5;
            const chk = (key, label, def) => {
                const on = design[key] === undefined ? def : !!design[key];
                return `<label style="display:flex; align-items:center; gap:6px; color:#c9c9cf; font-size:0.72rem; cursor:pointer;">
                    <input type="checkbox" data-timer-chk="${key}" ${on ? 'checked' : ''} style="width:auto; height:auto; min-height:0; margin:0; accent-color:#f59e0b;">${label}</label>`;
            };
            return `
                <div id="design-timer-demo" style="margin-bottom:10px; padding:8px 10px; border-radius:8px; background:rgba(245, 158, 11,0.08); border:1px solid rgba(245, 158, 11,0.3); color:#7dd3fc; font-size:0.7rem; line-height:1.5;">
                    プレビューの問題の画面で、本番と同じ位置・大きさでタイマーが動きます。秒数はルールの「時間」で決めます。
                </div>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:10px;">
                    ${TV.STYLES.map(st => `
                        <button type="button" data-timer-style="${st.id}" style="padding:8px 4px; border-radius:8px; cursor:pointer; font-size:0.72rem; font-weight:bold;
                            background:${cur === st.id ? 'rgba(245, 158, 11,0.12)' : '#1b1b20'}; border:1px solid ${cur === st.id ? '#f59e0b' : '#3a3a42'}; color:${cur === st.id ? '#f59e0b' : '#e5e5e8'};">${st.name}</button>
                    `).join('')}
                </div>
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                    ${rowLabel('残り')}
                    ${miniSelect('残りわずかの演出を始める時間', 'timerWarnSec', [3, 5, 10, 15].map(n => ({ v: String(n), t: `残り${n}秒から` })))}
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${chk('timerWarnBlink', '残りわずかで点滅する', true)}
                    ${chk('timerWarnEdge', '残りわずかで画面のふちを赤く光らせる', false)}
                    ${chk('timerTickSound', '残りわずかで秒読み音を鳴らす（モニター）', false)}
                </div>
                <p style="color:#555; font-size:0.62rem; margin:8px 0 0;">※秒数や「1問ごと／セット全体」はルールの「制限時間」で決めます</p>
                ${liveSection()}
            `;
        };
        // 全員同時の時、回答中・正解発表後にモニターへ何を出すか
        // （1人ずつ判定する形式は、判定した瞬間に出るので設定不要）
        const liveSection = () => {
            const RE = window.App.RuleEngine;
            const ctx = (window.App.Config && window.App.Config._ruleContext) ? window.App.Config._ruleContext(window.App.Data.currentConfig || {}) : { mode: 'normal', autoJudge: true };
            const head = `<div style="margin:14px 0 6px; padding-top:10px; border-top:1px solid #2a2a30; color:#e5e5e8; font-size:0.75rem; font-weight:bold;">回答の見せ方（モニター）</div>`;
            if (ctx.mode !== 'normal') {
                return head + `<p style="color:#6b6b74; font-size:0.66rem; margin:0;">全員が同時に答える時に設定できます。早押し・順番などは、〇×を判定した瞬間にモニターへ出ます。</p>`;
            }
            if (!design.liveAnswerView) design.liveAnswerView = 'none';
            if (!design.speedReveal) design.speedReveal = 'none';
            const speedOk = RE ? RE.can('tieBreakTime', ctx).ok : true; // 解答時間が測れる形式
            return head + `
                <div style="display:flex; gap:6px; margin-bottom:6px;">
                    ${miniSelect('答えている間', 'liveAnswerView', [
                        { v: 'none', t: '何も出さない' },
                        { v: 'count', t: '回答した人数だけ' },
                        { v: 'names', t: '答えた順に名前と秒数' },
                    ])}
                </div>
                ${speedOk ? `<div style="display:flex; gap:6px;">
                    ${miniSelect('正解発表のあと', 'speedReveal', [
                        { v: 'none', t: '何も出さない' },
                        { v: 'top', t: '正解者の早い順TOP10' },
                        { v: 'countup', t: '下の順位から1人ずつ発表' },
                    ])}
                </div>` : `<p style="color:#6b6b74; font-size:0.66rem; margin:4px 0 0;">「正解者の早い順」は、選択式・並べ替え・文字パネルで使えます。</p>`}
                <p style="color:#555; font-size:0.62rem; margin:6px 0 0;">※答えている間は正誤を伏せて表示します（まだ答えていない人に答えがばれないように）</p>`;
        };
        if (!activeBody.timer) activeBody.timer = timerBody;

        // スマホのセット設定では「見た目」と「音・演出」を別の行から開く（_tabsMode）
        const allTabs = [
            { key: 'theme', label: 'テーマ', g: 'look' },
            { key: 'text', label: '文字の細部', g: 'look' },
            { key: 'object', label: '部品の細部', g: 'look' },
            { key: 'sound', label: 'サウンド', g: 'fx' },
            { key: 'timer', label: '演出', g: 'fx' },
        ];
        const tabs = allTabs.filter(t => !this._tabsMode || t.g === this._tabsMode);
        if (!tabs.some(t => t.key === this._activeDesignTab)) this._activeDesignTab = tabs[0].key;
        if (!activeBody[this._activeDesignTab]) this._activeDesignTab = 'text';

        const wireBody = (body) => {
            body.querySelector('#design-grid-config-btn')?.addEventListener('click', () => this._openGridModal(design, onChange));
            body.querySelectorAll('input[type="text"][data-key], input[type="number"][data-key]').forEach(inp => {
                inp.oninput = () => {
                    design[inp.dataset.key] = inp.value;
                    if (onChange) onChange();
                };
            });
            body.querySelectorAll('button[data-color-swatch-key]').forEach(btn => {
                btn.onclick = () => this._openColorPickerModal(design, btn.dataset.colorSwatchKey, btn.dataset.colorSwatchLabel, btn, () => {
                    if (onChange) onChange();
                    renderBody();
                });
            });
            body.querySelectorAll('select[data-key]').forEach(sel => {
                sel.onchange = () => {
                    design[sel.dataset.key] = sel.value;
                    if (onChange) onChange();
                    if ((sel.dataset.key === 'layout' || /^(qImg|cImg|cHeight)/.test(sel.dataset.key)) && window.App.Creator) window.App.Creator.applyDesignToPreview();
                };
            });

            // ブリッジの演出
            body.querySelectorAll('button[data-bridge-style]').forEach(btn => {
                btn.onclick = () => { design.bridgeStyle = btn.dataset.bridgeStyle; if (onChange) onChange(); renderBody(); };
            });

            // タイマーの見た目
            body.querySelectorAll('button[data-timer-style]').forEach(btn => {
                btn.onclick = () => { design.timerStyle = btn.dataset.timerStyle; if (onChange) onChange(); renderBody(); };
            });
            body.querySelectorAll('input[data-timer-chk]').forEach(chk => {
                chk.onchange = () => { design[chk.dataset.timerChk] = chk.checked; if (onChange) onChange(); };
            });
            this._startTimerDemo(body.querySelector('#design-timer-demo'), design);
            body.querySelector('[data-goto-rules-time]')?.addEventListener('click', () => {
                const C = window.App.Creator, M = window.App.CreatorMobile;
                if (!C) return;
                C.rulesSubTab = 'time';
                if (M && M.isMobile()) M.openSheet('rules', 'time');
                else C.toggleInlinePanel('rules');
            });

            // 問題の枠と回答の枠の割合
            const splitRange = body.querySelector('#split-ratio-range');
            if (splitRange) splitRange.oninput = () => {
                design.splitRatio = parseInt(splitRange.value);
                const v = body.querySelector('#split-ratio-val'); if (v) v.textContent = `問題 ${design.splitRatio}％`;
                if (onChange) onChange();
            };
            body.querySelector('#split-ratio-auto')?.addEventListener('click', () => { delete design.splitRatio; if (onChange) onChange(); renderBody(); });

            // 画面の型
            body.querySelectorAll('button[data-layout-template]').forEach(btn => {
                btn.onclick = () => {
                    design.layoutTemplate = btn.dataset.layoutTemplate;
                    if (design.layoutTemplate === 'frame' && !design.frameColor) design.frameColor = '#c9c94a';
                    if (onChange) onChange();
                    renderBody();
                };
            });

            // 選択肢ボタンの形・問題文の見せ方（choice_skin.js）
            if (window.App.ChoiceSkin) window.App.ChoiceSkin.wirePanel(body, design, onChange, renderBody);

            // 書体・文字の飾り（テーマの下の段）
            body.querySelectorAll('button[data-font-key]').forEach(btn => {
                btn.onclick = () => {
                    design.fontFamily = btn.dataset.fontKey;
                    window.App.Themes.ensureFont(design.fontFamily);
                    if (onChange) onChange();
                    renderBody();
                };
            });
            body.querySelectorAll('button[data-tfx]').forEach(btn => {
                btn.onclick = () => {
                    design.textFx = btn.dataset.tfx;
                    Object.keys(design).forEach(k => { if (k.indexOf('tfx_') === 0) delete design[k]; }); // 型を変えたら細部の上書きは消す
                    if (onChange) onChange();
                    renderBody();
                };
            });
            const lookDetails = body.querySelector('#design-look-details');
            if (lookDetails) lookDetails.ontoggle = () => { this._lookDetailsOpen = lookDetails.open; };

            // テーマカード
            body.querySelectorAll('button[data-theme-id]').forEach(btn => {
                btn.onclick = () => {
                    window.App.Themes.apply(design, btn.dataset.themeId);
                    if (onChange) onChange();
                    renderBody();
                };
            });

            // 全体背景の画像（背景色の横の「背景画像」）
            // そのまま保存すると数MBになり、本番でモニター・全端末に配信されて
            // 重くなるので、フルHD以下のJPEGに縮小してから入れる。
            const bgPick = body.querySelector('button[data-bgimg-pick]');
            const bgInput = body.querySelector('input[data-bgimg-input]');
            if (bgPick && bgInput) {
                bgPick.onclick = () => bgInput.click();
                bgInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const done = (dataUrl) => {
                        design.bgImage = dataUrl;
                        if (onChange) onChange();
                        renderBody();
                    };
                    if (window.App.Themes && window.App.Themes.compressImage) {
                        window.App.Themes.compressImage(file).then(done).catch(() => {});
                    } else {
                        const reader = new FileReader();
                        reader.onload = (ev) => done(ev.target.result);
                        reader.readAsDataURL(file);
                    }
                };
            }
            // オン／オフの設定（オフの時だけ 'off' を持つ）— 回答者のスマホにも画像を出す など
            body.querySelectorAll('input[data-design-flag]').forEach(chk => {
                chk.onchange = () => { design[chk.dataset.designFlag] = chk.checked ? '' : 'off'; if (onChange) onChange(); renderBody(); };
            });
            // この問題だけの背景
            body.querySelector('button[data-qbg-pick]')?.addEventListener('click', () => {
                const QI = window.App.QuestionImage;
                if (!QI || !window.App.ItemImage) return;
                window.App.ItemImage.pick((url) => { QI.bg = url; QI.bgChanged(); renderBody(); }, 1600, 900);
            });
            body.querySelector('button[data-qbg-clear]')?.addEventListener('click', () => {
                const QI = window.App.QuestionImage;
                if (!QI) return;
                QI.bg = null; QI.bgChanged(); renderBody();
            });
            body.querySelector('button[data-bgimg-clear]')?.addEventListener('click', () => {
                design.bgImage = '';
                if (onChange) onChange();
                renderBody();
            });

            // 問題文の設定 → タイトルの設定へ
            body.querySelectorAll('button[data-select-object]').forEach(btn => {
                btn.onclick = () => this.selectObject(btn.dataset.selectObject);
            });

            // ブリッジ/結果の画面: 背景画像を使うかのチェック、ブリッジの文言
            body.querySelectorAll('input[type="checkbox"][data-check-key]').forEach(chk => {
                chk.onchange = () => {
                    design[chk.dataset.checkKey] = chk.checked;
                    if (onChange) onChange();
                };
            });
            const qNumInp = body.querySelector('input[data-qnum-text]');
            if (qNumInp) qNumInp.oninput = () => {
                if (window.App.Creator) {
                    window.App.Creator.qNumText = qNumInp.value;
                    window.App.Creator.updateBridgePreview();
                }
            };

            // サウンド tab: tapping a compact tile opens the full editor
            // (URL/file/play/clear) in a popup instead of an inline card.
            body.querySelectorAll('button[data-sound-tile]').forEach(btn => {
                btn.onclick = () => this._openSoundModal(design, btn.dataset.soundTile, btn.dataset.soundLabel, () => {
                    if (onChange) onChange();
                    renderBody();
                });
            });
        };

        const renderBody = () => {
            const body = container.querySelector('#design-subtab-body');
            body.innerHTML = activeBody[this._activeDesignTab]();
            wireBody(body);
        };

        container.innerHTML = `
            <div style="display:flex; gap:0; margin:-4px -4px 14px; border-radius:8px; overflow:hidden; border:1px solid #333;">
                ${tabs.map(t => `
                    <button type="button" class="design-subtab-btn" data-tab="${t.key}" style="
                        flex:1; height:32px; box-sizing:border-box; padding:0 2px; font-size:0.72rem; font-weight:bold; border:none; cursor:pointer;
                        display:flex; align-items:center; justify-content:center;
                        background:${this._activeDesignTab === t.key ? '#26262d' : '#1f1f24'}; color:${this._activeDesignTab === t.key ? '#e5e5e8' : '#8b8b95'};
                    ">${t.label}</button>
                `).join('')}
            </div>
            <div id="design-subtab-body"></div>
        `;
        container.querySelectorAll('.design-subtab-btn').forEach(btn => {
            btn.onclick = () => {
                this._activeDesignTab = btn.dataset.tab;
                container.querySelectorAll('.design-subtab-btn').forEach(b => {
                    b.style.background = (b.dataset.tab === this._activeDesignTab) ? '#26262d' : '#1f1f24';
                    b.style.color = (b.dataset.tab === this._activeDesignTab) ? '#e5e5e8' : '#8b8b95';
                });
                renderBody();
            };
        });
        renderBody();
    },

    // サウンド tile tap target — the full editor (URL / file upload / play
    // / clear) for one sound field, in a popup so the main サウンド tab
    // can stay a single compact row of tiles.
    // カラーパレットピッカー — a tile-grid accordion (6 curated palettes)
    // instead of the native OS color wheel every time, plus a HEX field
    // and a collapsed 詳細カスタム section for the native picker when a
    // tile isn't exactly right. Applies live (each tile/HEX/native pick
    // calls onChange immediately) — 閉じる just dismisses the popup.
    // Compact anchored dropdown (not a full-screen modal) — positioned
    // right by the swatch that opened it, like Office's fill-color
    // dropdown, so the live preview above stays visible and updates as
    // colors are picked, instead of being covered by the picker.
    _openColorPickerModal: function (design, key, label, anchorEl, onChange) {
        const existing = document.getElementById('design-color-popover');
        if (existing) existing.remove();

        const isHex = v => /^#[0-9a-fA-F]{6}$/.test(v || '');
        const sameColor = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

        const pop = document.createElement('div');
        pop.id = 'design-color-popover';
        pop.style.cssText = `
            position:fixed; width:236px; max-height:70vh; overflow-y:auto; z-index:10001;
            background:rgba(20,20,24,0.98); border:1px solid rgba(255,255,255,0.12); border-radius:10px;
            box-shadow:0 12px 30px rgba(0,0,0,0.6); padding:10px;
        `;
        pop.innerHTML = `
            <div style="font-size:0.72rem; color:#ccc; font-weight:bold; margin-bottom:6px;">${label}</div>
            <select id="color-popover-palette-select" style="
                width:100%; padding:5px 6px; margin-bottom:6px; background:#1a1a1a; border:1px solid #333;
                border-radius:6px; color:#ccc; font-size:0.68rem; font-weight:bold; box-sizing:border-box; cursor:pointer;
            ">
                ${this._colorPalettes.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}
                <option value="transparent">透明</option>
            </select>
            <div id="color-popover-grid" style="display:grid; grid-template-columns: repeat(5, 1fr); gap:4px; padding:2px 0 4px;"></div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                <label style="font-size:0.62rem; color:#8b8b95; flex:0 0 auto;">HEX</label>
                <input type="text" id="color-popover-hex" value="${isHex(design[key]) ? design[key] : ''}" placeholder="#RRGGBB" style="
                    flex:1; min-width:0; padding:4px 6px; background:#0c0c0f; border:1px solid #3a3a42;
                    border-radius:5px; color:#fff; font-size:0.72rem;
                ">
                <input type="color" id="color-popover-native" title="詳細カスタム" value="${this._toHexOrDefault(design[key])}" style="
                    flex:0 0 24px; width:24px; height:24px; padding:0; border:1px solid #3a3a42; border-radius:5px; background:none; cursor:pointer;
                ">
            </div>
            ${key === 'mainBgColor' ? '<div id="color-popover-bgimg"></div>' : ''}
        `;
        document.body.appendChild(pop);

        // Positioned once the real content (palette grid) is in, below —
        // computed after renderAccordion() further down, not here, since
        // the height needed depends on that content.
        const positionPopover = () => {
            const r = anchorEl.getBoundingClientRect();
            const popH = pop.offsetHeight;
            const spaceBelow = window.innerHeight - r.bottom;
            const top = (spaceBelow >= popH + 8 || spaceBelow >= r.top)
                ? Math.min(r.bottom + 6, window.innerHeight - popH - 6)
                : Math.max(6, r.top - popH - 6);
            const left = Math.min(Math.max(6, r.left), window.innerWidth - 236 - 6);
            pop.style.top = `${Math.max(6, top)}px`;
            pop.style.left = `${left}px`;
        };

        const hexInp = pop.querySelector('#color-popover-hex');
        const nativeInp = pop.querySelector('#color-popover-native');
        const paletteSelect = pop.querySelector('#color-popover-palette-select');
        const grid = pop.querySelector('#color-popover-grid');

        // Renders the tile grid for whichever palette is currently selected
        // in the pulldown. This does NOT touch `design[key]` or the select's
        // value itself — it's purely "show me palette N's tiles", called both
        // when the user switches palettes (just browsing) and after a color
        // is applied (to refresh the selected-tile highlight).
        const renderGrid = () => {
            grid.style.display = 'grid';
            const p = this._colorPalettes[this._openPaletteIdx];
            grid.innerHTML = p.colors.map(c => `
                <button type="button" class="color-palette-tile" data-color="${c}" title="${c}" style="
                    aspect-ratio:1; background:${c}; border-radius:3px; cursor:pointer;
                    border:${sameColor(c, design[key]) ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.15)'};
                    box-shadow:${sameColor(c, design[key]) ? '0 0 5px rgba(245, 158, 11,0.7)' : 'none'};
                "></button>
            `).join('');
            grid.querySelectorAll('.color-palette-tile').forEach(tbtn => {
                tbtn.onclick = () => applyColor(tbtn.dataset.color);
            });
        };

        const hideGrid = () => {
            grid.style.display = 'none';
            grid.innerHTML = '';
        };

        // Sets the pulldown + grid to match `design[key]`'s current value —
        // called only when the popover first opens, not on every render, so
        // that browsing palettes from the dropdown afterward isn't fought by
        // this re-derivation snapping the select back to 透明.
        const syncFromDesign = () => {
            if (design[key] === 'transparent') {
                paletteSelect.value = 'transparent';
                hideGrid();
            } else {
                paletteSelect.value = String(this._openPaletteIdx);
                renderGrid();
            }
        };

        const applyColor = (hex) => {
            design[key] = hex;
            hexInp.value = hex;
            nativeInp.value = this._toHexOrDefault(hex);
            renderGrid();
            positionPopover();
            if (onChange) onChange();
        };

        const applyTransparent = () => {
            design[key] = 'transparent';
            hexInp.value = '';
            hideGrid();
            positionPopover();
            if (onChange) onChange();
        };

        paletteSelect.onchange = () => {
            if (paletteSelect.value === 'transparent') {
                applyTransparent();
            } else {
                this._openPaletteIdx = parseInt(paletteSelect.value, 10);
                renderGrid();
                positionPopover();
            }
        };

        // 全体背景 only — merges the image-upload option into this same
        // popover instead of a separate icon hanging below the swatch.
        const renderBgImgSection = () => {
            if (key !== 'mainBgColor') return;
            const bgImgEl = pop.querySelector('#color-popover-bgimg');
            const bgImg = design.bgImage || '';
            const hasBgImg = bgImg.startsWith('data:') || bgImg.startsWith('http');
            bgImgEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px; margin-top:8px; padding-top:8px; border-top:1px dashed #333;">
                    <button type="button" id="color-popover-bgimg-file-btn" title="全体背景に画像を使う" style="
                        flex:1; min-width:0; padding:5px 6px; font-size:0.68rem; background:none;
                        border:1px dashed ${hasBgImg ? '#00ff88' : '#3a3a42'}; border-radius:5px;
                        color:${hasBgImg ? '#00ff88' : '#8b8b95'}; cursor:pointer;
                    ">画像を使う${hasBgImg ? '（設定済み）' : ''}</button>
                    ${hasBgImg ? `<button type="button" id="color-popover-bgimg-clear-btn" title="画像をクリア" style="
                        flex:0 0 auto; padding:5px 8px; font-size:0.62rem; background:none; border:1px dashed #ff8888;
                        border-radius:5px; color:#ff8888; cursor:pointer;
                    ">×</button>` : ''}
                    <input type="file" accept="image/*" id="color-popover-bgimg-file-input" style="display:none;">
                </div>
            `;
            bgImgEl.querySelector('#color-popover-bgimg-file-btn').onclick = () => {
                bgImgEl.querySelector('#color-popover-bgimg-file-input').click();
            };
            bgImgEl.querySelector('#color-popover-bgimg-file-input').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    design.bgImage = ev.target.result;
                    renderBgImgSection();
                    positionPopover();
                    if (onChange) onChange();
                };
                reader.readAsDataURL(file);
            });
            bgImgEl.querySelector('#color-popover-bgimg-clear-btn')?.addEventListener('click', () => {
                design.bgImage = '';
                renderBgImgSection();
                positionPopover();
                if (onChange) onChange();
            });
        };

        this._openPaletteIdx = 0; // when not 透明, always start on 1. ビビッド's grid
        syncFromDesign();
        renderBgImgSection();
        positionPopover();

        hexInp.addEventListener('change', () => {
            if (isHex(hexInp.value)) applyColor(hexInp.value);
            else hexInp.value = isHex(design[key]) ? design[key] : '';
        });
        nativeInp.addEventListener('input', () => applyColor(nativeInp.value));

        // クリックアウトで閉じる — a floating dropdown like this (not a
        // confirm-style modal) is expected to dismiss that way.
        const onOutsideClick = (e) => {
            if (pop.contains(e.target) || e.target === anchorEl) return;
            pop.remove();
            document.removeEventListener('mousedown', onOutsideClick, true);
        };
        setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);
    },

    // サウンドタイルをタップすると、直接アップロードするのではなく
    // 「サウンド編集」（ホストメニュー）に登録済みの音源から選ぶだけの
    // ピッカーになる — 音源の追加/削除は host_sound_library.js 側で行う。
    _openSoundModal: function (design, key, label, onChange) {
        const existing = document.getElementById('design-sound-modal');
        if (existing) existing.remove();

        const items = (window.App.SoundLibrary && window.App.SoundLibrary._cache[key]) || [];
        const currentVal = design[key] || '';

        const overlay = document.createElement('div');
        overlay.id = 'design-sound-modal';
        overlay.className = 'design-modal-overlay';
        overlay.innerHTML = `
            <div class="design-modal-content" style="max-width:320px; padding:22px !important;">
                <h3 class="modal-title" style="font-size:1.05em; margin-bottom:10px;">${label}</h3>
                <div id="sound-picker-list" style="display:flex; flex-direction:column; gap:6px; max-height:260px; overflow-y:auto; margin-bottom:12px;">
                    <button type="button" data-pick="" style="
                        display:flex; align-items:center; padding:9px 10px; text-align:left;
                        background:${!currentVal ? 'rgba(245, 158, 11,0.14)' : '#1b1b20'}; border:1px solid ${!currentVal ? '#f59e0b' : '#3a3a42'};
                        border-radius:8px; color:#fff; cursor:pointer; font-size:0.85rem;
                    ">未設定にする</button>
                    ${items.map(it => `
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button type="button" data-pick="${it.id}" style="
                                flex:1; min-width:0; display:flex; align-items:center; padding:9px 10px; text-align:left;
                                background:${currentVal === it.data ? 'rgba(245, 158, 11,0.14)' : '#1b1b20'}; border:1px solid ${currentVal === it.data ? '#f59e0b' : '#3a3a42'};
                                border-radius:8px; color:#fff; cursor:pointer; font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
                            ">${it.name}</button>
                            <button type="button" data-preview="${it.id}" title="再生して確認" style="flex:0 0 auto; display:flex; align-items:center; padding:8px 10px; background:#d97706; border:none; border-radius:6px; color:#fff; cursor:pointer;">${window.App.Icons.svg('play', 14)}</button>
                        </div>
                    `).join('')}
                    ${items.length === 0 ? '<p style="color:#666; font-size:0.78rem; text-align:center; margin:8px 0;">まだ音源が登録されていません</p>' : ''}
                </div>
                <label style="display:block; position:relative; overflow:hidden; box-sizing:border-box; width:100%; margin:0 0 8px; padding:9px; border-radius:8px; background:rgba(245, 158, 11,0.08); border:1px dashed rgba(245, 158, 11,0.4); color:#f59e0b; cursor:pointer; font-size:0.85rem; text-align:center;">＋ ファイルから追加（MP3など）
                    <input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg" id="sound-modal-file-input" style="position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%;">
                </label>
                <p style="color:#666; font-size:0.66rem; margin:0 0 12px; line-height:1.4;">※追加した音源はサウンド編集の一覧にも入り、他のセットでも使えます</p>
                <button type="button" id="sound-modal-close-btn" style="width:100%; padding:10px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">閉じる</button>
            </div>
        `;
        document.body.appendChild(overlay);

        const list = overlay.querySelector('#sound-picker-list');
        const close = () => overlay.remove();

        list.querySelectorAll('[data-preview]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const item = items.find(it => it.id === btn.dataset.preview);
                // Shared single <audio> (App.SoundLibrary.toggle) — tapping
                // the same ▶ again pauses instead of restarting, and
                // switching to a different sound always stops the last one
                // first, so nothing plays on top of anything else.
                if (item && window.App.SoundLibrary) window.App.SoundLibrary.toggle(item.data, btn);
            };
        });
        list.querySelectorAll('[data-pick]').forEach(btn => {
            btn.onclick = () => {
                const item = items.find(it => it.id === btn.dataset.pick);
                design[key] = item ? item.data : '';
                close();
                if (onChange) onChange();
            };
        });
        overlay.querySelector('#sound-modal-close-btn').onclick = close;

        // ここから直接ファイルを追加 — サウンドライブラリ（同じカテゴリ）に登録して、
        // そのままこの項目に設定する
        const fileInput = overlay.querySelector('#sound-modal-file-input');
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const data = ev.target.result;
                const name = (file.name || '無題').replace(/\.[^.]+$/, '');
                design[key] = data;
                close();
                if (onChange) onChange();
                if (window.db) {
                    window.db.ref(`sound_library/${key}`).push().set({ name, data })
                        .then(() => window.App.Ui && window.App.Ui.showToast('音源を追加して設定しました'))
                        .catch(() => window.App.Ui && window.App.Ui.showToast('サウンド編集への登録に失敗しました（この問題には設定済み）'));
                }
            };
            reader.onerror = () => window.App.Ui && window.App.Ui.showToast('ファイルを読み込めませんでした');
            reader.readAsDataURL(file);
        };
    },

    // 入力欄の下に置く「○○の配置」ボタン（パネル指名・数字予想）—
    // 見た目の「配置」と同じ設定（行数×列数）を開く
    gridLayoutButton: function (itemWord) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'background:#1b1b20; border:1px solid #3a3a42; border-radius:8px; color:#fff; padding:5px 12px; cursor:pointer; font-size:0.8rem; white-space:nowrap;';
        const label = () => {
            const d = window.App.Data.currentDesign || {};
            const r = parseInt(d.gridRows) || 0, c = parseInt(d.gridCols) || 0;
            btn.innerHTML = `${itemWord}の配置 <b style="color:#f59e0b;">${(r > 0 && c > 0) ? `${r}行×${c}列` : '自動'}</b>`;
        };
        label();
        btn.onclick = () => this._openGridModal(window.App.Data.currentDesign, () => {
            label();
            if (window.App.CreatorDraft) window.App.CreatorDraft.saveSoon();
        });
        return btn;
    },

    // 選択肢の配置 popup — rows × cols must cover every choice already
    // added, or the grid would silently drop some off-screen; block
    // confirming until it does instead of letting that happen quietly.
    _openGridModal: function (design, onChange) {
        const existing = document.getElementById('design-grid-modal');
        if (existing) existing.remove();

        // .row-input covers 並べ替え/多答/連想 rows too (only .choice-row's
        // input is .choice-text-input) — without it this count silently
        // read 0 for those types, so "not enough cells" validation below
        // never actually caught anything for them.
        // パネル指名モードはパネルの数で数える
        const panelRows = document.querySelectorAll('#pb-list .pb-row');
        const isPanel = panelRows.length > 0;
        const isNumGame = !!document.getElementById('ng-items-list');
        const choiceCount = isPanel ? panelRows.length
            : document.querySelectorAll('#creator-form-container .choice-text-input, #creator-form-container .row-input').length;
        const isAssoc = ((window.App.Creator && window.App.Creator.currentType) || '').startsWith('assoc');
        const itemWord = isPanel ? 'パネル' : isNumGame ? '項目' : isAssoc ? 'ヒント' : '選択肢';
        const gridLabel = `${itemWord}の配置`;

        const overlay = document.createElement('div');
        overlay.id = 'design-grid-modal';
        overlay.className = 'design-modal-overlay';
        overlay.innerHTML = `
            <div class="design-modal-content" style="max-width:300px; padding:22px !important;">
                <h3 class="modal-title" style="font-size:1.05em; margin-bottom:6px;">${gridLabel}</h3>
                <p style="color:#888; font-size:0.75rem; text-align:center; margin:0 0 16px;">
                    左上から順に敷き詰められ、余ったマスは空欄になります${choiceCount ? `（現在 ${choiceCount} 個）` : ''}
                </p>
                <div style="display:flex; gap:12px; margin-bottom:6px;">
                    <div style="flex:1;">
                        <label style="color:#8b8b95; font-size:0.75rem; display:block; margin-bottom:4px; text-align:center;">行数</label>
                        <div class="gm-step">
                            <button type="button" class="gm-btn" data-gm="grid-modal-rows" data-d="-1" aria-label="1つ減らす">−</button>
                            <input type="number" id="grid-modal-rows" min="1" max="10" value="${design.gridRows || ''}" placeholder="自動" readonly>
                            <button type="button" class="gm-btn" data-gm="grid-modal-rows" data-d="1" aria-label="1つ増やす">＋</button>
                        </div>
                    </div>
                    <div style="flex:1;">
                        <label style="color:#8b8b95; font-size:0.75rem; display:block; margin-bottom:4px; text-align:center;">列数</label>
                        <div class="gm-step">
                            <button type="button" class="gm-btn" data-gm="grid-modal-cols" data-d="-1" aria-label="1つ減らす">−</button>
                            <input type="number" id="grid-modal-cols" min="1" max="10" value="${design.gridCols || ''}" placeholder="自動" readonly>
                            <button type="button" class="gm-btn" data-gm="grid-modal-cols" data-d="1" aria-label="1つ増やす">＋</button>
                        </div>
                    </div>
                </div>
                <div id="grid-modal-error" style="color:#ff5555; font-size:0.75rem; text-align:center; min-height:1.2em; margin-bottom:6px;"></div>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button type="button" id="grid-modal-cancel" style="flex:1; padding:10px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">キャンセル</button>
                    <button type="button" id="grid-modal-clear" style="flex:1; padding:10px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">自動に戻す</button>
                    <button type="button" id="grid-modal-ok" style="flex:1; padding:10px; border-radius:8px; background:#f59e0b; border:none; color:#000; font-weight:bold; cursor:pointer;">決定</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        // −／＋で行数・列数を変える（キーボードを出さない）。「自動」の時は、今の数が入る形から始める
        const rowsEl = overlay.querySelector('#grid-modal-rows');
        const colsEl = overlay.querySelector('#grid-modal-cols');
        const hint = overlay.querySelector('#grid-modal-error');
        const showHint = () => {
            const r = parseInt(rowsEl.value) || 0, c = parseInt(colsEl.value) || 0;
            hint.style.color = r && c && choiceCount && r * c < choiceCount ? '#ff5555' : '#8b8b95';
            hint.textContent = r && c ? `${r}行 × ${c}列 ＝ ${r * c}マス${choiceCount && r * c < choiceCount ? `（${itemWord}${choiceCount}個に足りません）` : ''}` : '自動で並べます';
        };
        overlay.querySelectorAll('.gm-btn').forEach(btn => {
            btn.onclick = () => {
                if (!rowsEl.value || !colsEl.value) {
                    const c0 = Math.max(1, Math.min(choiceCount || 2, 2));
                    colsEl.value = c0;
                    rowsEl.value = Math.max(1, Math.ceil((choiceCount || 2) / c0));
                }
                const el = overlay.querySelector('#' + btn.dataset.gm);
                el.value = Math.max(1, Math.min(10, (parseInt(el.value) || 1) + parseInt(btn.dataset.d)));
                showHint();
            };
        });
        showHint();
        overlay.querySelector('#grid-modal-cancel').onclick = close;
        overlay.querySelector('#grid-modal-clear').onclick = () => {
            design.gridRows = '';
            design.gridCols = '';
            close();
            if (window.App.Creator) window.App.Creator.applyDesignToPreview();
            const summary = document.getElementById('design-grid-summary');
            if (summary) summary.textContent = '自動';
            if (onChange) onChange();
        };
        overlay.querySelector('#grid-modal-ok').onclick = () => {
            const rowsInp = overlay.querySelector('#grid-modal-rows');
            const colsInp = overlay.querySelector('#grid-modal-cols');
            const rows = parseInt(rowsInp.value) || 0;
            const cols = parseInt(colsInp.value) || 0;
            const errEl = overlay.querySelector('#grid-modal-error');

            if ((rowsInp.value && !colsInp.value) || (!rowsInp.value && colsInp.value)) {
                errEl.textContent = '行数・列数は両方入力してください';
                return;
            }
            if (rows > 0 && cols > 0 && choiceCount > 0 && rows * cols < choiceCount) {
                errEl.textContent = `行列が足りません（${itemWord}は${choiceCount}個あります）`;
                return;
            }

            design.gridRows = rowsInp.value ? rows : '';
            design.gridCols = colsInp.value ? cols : '';
            close();
            if (window.App.Creator) window.App.Creator.applyDesignToPreview();
            const summary = document.getElementById('design-grid-summary');
            if (summary) summary.textContent = (rows > 0 && cols > 0) ? `${rows}行 × ${cols}列` : '自動';
            if (onChange) onChange();
        };
    },

};

// Kick off the app-wide サウンドのデフォルト fetch as soon as this script
// loads (firebase.js runs first, so window.db is already available) —
// by the time a user opens the Creator, the cache is almost always ready.
App.Design.preloadAppDefaultSounds();
