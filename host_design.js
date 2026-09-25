/* =========================================================
 * host_design.js (v90: WYSIWYG Preview Calibration)
 * =======================================================*/

App.Design = {
    _activeDesignTab: 'text',

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
        return t.startsWith('free') || t === 'letter_select' || t === 'sort';
    },

    // 選択中のオブジェクトが今の状況（問題タイプ・正解表示のON/OFF）で
    // 実在しなければ、素直に「問題文」へフォールバックする。
    _normalizedSelection: function () {
        let sel = this._selectedObject || 'question';
        if (sel === 'choices' && !this._hasChoicesObject()) sel = 'question';
        if (sel === 'reveal' && !(window.App.Creator && window.App.Creator._previewRevealOn)) sel = 'question';
        return sel;
    },

    selectObject: function (obj) {
        this._selectedObject = obj;
        if (window.App.Creator) {
            // Highlight regardless of which inline panel is currently
            // showing (the preview itself is always visible above it) —
            // only the panel content re-render is gated to デザイン, since
            // that's the only thing this selection actually filters.
            window.App.Creator.highlightSelectedObject();
            if (window.App.Creator.activeInlinePanel === 'design') {
                window.App.Creator.renderActivePanelContent('design');
            }
        }
    },

    defaults: {
        mainBgColor: "#0a0a0a",
        qTextColor: "#ffffff",
        qBgColor: "rgba(255, 255, 255, 0.05)",
        qBorderColor: "#00bfff",
        qFontSize: "5vh", // 中（4行）— see Q_SIZE_OPTS in renderInlineChooser
        // 問題文の「枠」自体の大きさ（文字サイズとは別）— 空文字なら
        // これまで通り中身に合わせた自動の高さ（＝小）。中/大はそこから
        // 明示的に高さを大きくする。see BOX_SIZE_OPTS.
        qBoxSize: "",
        cTextColor: "#a0a0a0",
        cBgColor: "transparent",
        cBorderColor: "#333333",
        cFontSize: "3.5vh", // 中 — see C_SIZE_OPTS in renderInlineChooser
        align: "center",
        cAlign: "left",
        layout: "top",
        bgmThinking: "",
        seQNum: "",
        seButton: "",
        seCorrect: "",
        seWrong: "",
        // 正解表示（reveal）専用の配色 — 未設定なら問題文側の色にフォール
        // バックする（viewer.js / renderPreviewReveal 両方）ので、既存の
        // デザインは何も変わらないまま、正解表示オブジェクトを選んで
        // 触った時だけ独自に上書きできる。
        revealTextColor: "",
        revealBorderColor: "",
        revealBgColor: ""
    },

    // サウンドのデフォルト — one fixed default for the 4 サウンド fields,
    // shared app-wide (Firebase, not per-browser/per-account), so every new
    // question/set on any device starts with the same sounds. Now
    // read-only from the Creator's side (no more "save these 4 as the
    // default" button — サウンドライブラリ replaced the old per-question
    // upload flow this was designed around); still preloaded as early as
    // possible so App.Creator.init()/loadSet() can read it synchronously.
    _soundKeys: ['bgmThinking', 'seQNum', 'seButton', 'seCorrect', 'seWrong'],
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
            <div style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1 1 38px; min-width:0;">
                <button type="button" data-color-swatch-key="${key}" data-color-swatch-label="${label}" title="${design[key] ?? ''}" style="
                    width:100%; height:32px; box-sizing:border-box; padding:0; border:1px solid #475569; border-radius:6px; cursor:pointer;
                    background:${design[key] || 'transparent'};
                "></button>
                <span style="font-size:0.58rem; color:#94a3b8; white-space:nowrap;">${label}</span>
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
                    width:100%; height:${CONTROL_HEIGHT}; min-height:${CONTROL_HEIGHT}; margin:0; padding:0 4px; background:#1e293b; border:1px solid #475569;
                    border-radius:6px; color:#fff; font-size:0.72rem; text-align:center; box-sizing:border-box;
                ">
                <span style="font-size:0.58rem; color:#94a3b8; white-space:nowrap;">${label}</span>
            </div>
        `;
        const miniSelect = (label, key, options) => `
            <div style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; min-width:0;">
                <select data-key="${key}" style="
                    width:100%; height:${CONTROL_HEIGHT}; min-height:${CONTROL_HEIGHT}; margin:0; padding:0 2px; background:#1e293b; border:1px solid #475569;
                    border-radius:6px; color:#fff; font-size:0.66rem; box-sizing:border-box;
                ">
                    ${options.map(o => `<option value="${o.v}" ${design[key] === o.v ? 'selected' : ''}>${o.t}</option>`).join('')}
                </select>
                <span style="font-size:0.58rem; color:#94a3b8; white-space:nowrap;">${label}</span>
            </div>
        `;
        const ALIGN_OPTS = [{ v: 'left', t: '左寄せ' }, { v: 'center', t: '中央' }, { v: 'right', t: '右寄せ' }];
        // 問題文の文字サイズ — px の自由入力だと大きさを毎回手探りする
        // ことになるので、Wordのフォントサイズのように選ぶだけのプリ
        // セットにする。文字サイズと「枠の大きさ」（BOX_SIZE_OPTS）は
        // 別の設定 — 混同しないよう、ここに行数の話は含めない。
        const Q_SIZE_OPTS = [
            { v: '3.5vh', t: '小' },
            { v: '5vh', t: '中' },
            { v: '8vh', t: '大' },
        ];
        // 選択肢の文字サイズも同じ理由でプリセット化。
        const C_SIZE_OPTS = [
            { v: '2.5vh', t: '小' },
            { v: '3.5vh', t: '中' },
            { v: '5vh', t: '大' },
        ];
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
            <div style="flex:0 0 34px; display:flex; align-items:center; justify-content:center;">
                <span style="font-size:0.66rem; color:#94a3b8; font-weight:bold; white-space:nowrap;">${text}</span>
            </div>
        `;

        // 連想クイズの項目は「選択肢」ではなく「ヒント」なので文言だけ
        // 差し替える — グリッド設定自体は選択式/並べ替え/多答/連想の
        // どのタイプにも共通で効く（#creator-choices-list を使う全タイプ、
        // applyDesignToPreview 側）。
        const isAssoc = ((window.App.Creator && window.App.Creator.currentType) || '').startsWith('assoc');
        const choicesLabel = isAssoc ? 'ヒント' : '選択肢';

        // プレビューでタップした対象に応じて、テキスト/オブジェクトタブの
        // 中身をその対象に関係する項目だけへ絞り込む。何が選ばれているか
        // 文字でも分かるよう、両タブの先頭に小さな見出しを出す。
        const OBJECT_TITLES = { question: '問題文', choices: choicesLabel, background: '全体背景', reveal: '正解表示' };
        const selectionHeader = (sel) => `
            <div style="display:flex; align-items:center; gap:5px; margin-bottom:8px; color:#00e5ff; font-size:0.68rem; font-weight:bold;">
                <span>👆</span><span>${OBJECT_TITLES[sel]}を編集中</span>
            </div>
        `;

        const bodyHtml = {
            text: () => {
                const sel = this._normalizedSelection();
                if (sel === 'choices') {
                    return `
                        ${selectionHeader(sel)}
                        <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                            ${rowLabel(choicesLabel)}
                            ${colorSwatch('文字色', 'cTextColor')}
                            ${miniSelect('サイズ', 'cFontSize', C_SIZE_OPTS)}
                            ${miniSelect('配置', 'cAlign', ALIGN_OPTS)}
                        </div>
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
                    <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                        ${rowLabel('問題文')}
                        ${colorSwatch('文字色', 'qTextColor')}
                        ${miniSelect('サイズ', 'qFontSize', Q_SIZE_OPTS)}
                        ${miniSelect('配置', 'align', ALIGN_OPTS)}
                    </div>
                `;
            },
            object: () => {
                const sel = this._normalizedSelection();

                if (sel === 'choices') {
                    return `
                        ${selectionHeader(sel)}
                        ${colorRow([
                            [`${choicesLabel}枠`, 'cBorderColor'],
                            [`${choicesLabel}背景`, 'cBgColor'],
                        ])}
                        <div style="display:flex; gap:6px; margin-top:8px;">
                            <button type="button" id="design-grid-config-btn" style="
                                flex:1; min-width:0; padding:6px 6px; background:#1e293b; border:1px solid #475569;
                                border-radius:8px; color:#fff; font-size:0.72rem; cursor:pointer;
                                display:flex; flex-direction:row; align-items:center; justify-content:center; gap:5px;
                            ">
                                <span>${choicesLabel}の配置</span>
                                <span id="design-grid-summary" style="color:#00e5ff; font-weight:bold;">${gridSummary()}</span>
                            </button>
                        </div>
                    `;
                }

                if (sel === 'background') {
                    // 画像アップロードはこのスウォッチ自身のカラーポップ
                    // オーバー内（_openColorPickerModal）に統合済み —
                    // ここでは色スウォッチを出すだけでよい。
                    return `
                        ${selectionHeader(sel)}
                        ${colorRow([['全体背景', 'mainBgColor']])}
                        <p style="color:#555; font-size:0.62rem; margin:8px 0 0;">※背景に画像を使いたい場合は、上のスウォッチをタップして開く画面から設定できます</p>
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
                        ${colorRow([
                            ['正解枠', 'revealBorderColor'],
                            ['正解背景', 'revealBgColor'],
                        ])}
                        <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※未設定の間は問題枠・問題背景の色がそのまま使われます</p>
                    `;
                }

                return `
                    ${selectionHeader('question')}
                    ${colorRow([
                        ['問題枠', 'qBorderColor'],
                        ['問題背景', 'qBgColor'],
                    ])}
                    <div style="display:flex; gap:6px; margin-top:8px; align-items:center;">
                        ${rowLabel('枠の大きさ')}
                        ${miniSelect('大きさ', 'qBoxSize', BOX_SIZE_OPTS)}
                    </div>
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        <select data-key="layout" style="
                            flex:1; min-width:0; padding:6px 4px; background:#1e293b; border:1px solid #475569;
                            border-radius:8px; color:#fff; font-size:0.72rem; box-sizing:border-box;
                        ">
                            ${[{ v: 'top', t: '問題文: 上側' }, { v: 'left', t: '問題文: 左側' }, { v: 'right', t: '問題文: 右側' }, { v: 'bottom', t: '問題文: 下側' }]
                                .concat(((window.App.Creator && window.App.Creator.currentType) || '').startsWith('free') ? [{ v: 'center', t: '問題文: 中央' }] : [])
                                .map(o => `<option value="${o.v}" ${design.layout === o.v ? 'selected' : ''}>${o.t}</option>`).join('')}
                        </select>
                    </div>
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
                            padding:7px 2px; background:#1e293b; border:1px solid ${isSet ? '#00e5ff' : '#475569'};
                            border-radius:8px; color:#fff; cursor:pointer;
                        ">
                            <span style="font-size:1rem; line-height:1;">${icon}</span>
                            <span style="font-size:0.56rem; color:#94a3b8; white-space:nowrap;">${label}</span>
                            <span style="font-size:0.52rem; color:${isSet ? '#00e5ff' : '#555'};">${isSet ? (hasFile ? 'あり' : 'URL') : '未設定'}</span>
                        </button>
                    `;
                };
                return `
                    <div style="display:flex; gap:6px; margin-bottom:8px;">
                        ${soundTile('シンキングBGM', 'bgmThinking', '🎵')}
                        ${soundTile('問題番号音', 'seQNum', '🔢')}
                        ${soundTile('ボタンSE', 'seButton', '🔘')}
                        ${soundTile('正解音', 'seCorrect', '⭕')}
                        ${soundTile('不正解音', 'seWrong', '❌')}
                    </div>
                    <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※タップして音声を設定。BGMと問題番号音（第○問の表示時）はモニター画面、他は各プレイヤーの端末で再生されます</p>
                `;
            },
            animation: () => `<p style="color:#666; font-size:0.8rem; text-align:center; padding:30px 0;">モーションは準備中です</p>`,
        };

        const tabs = [
            { key: 'text', label: 'テキスト' },
            { key: 'object', label: 'オブジェクト' },
            { key: 'sound', label: 'サウンド' },
            { key: 'animation', label: 'モーション' },
        ];
        if (!bodyHtml[this._activeDesignTab]) this._activeDesignTab = 'text';

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
                    if (sel.dataset.key === 'layout' && window.App.Creator) window.App.Creator.applyDesignToPreview();
                };
            });

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
            body.innerHTML = bodyHtml[this._activeDesignTab]();
            wireBody(body);
        };

        container.innerHTML = `
            <div style="display:flex; gap:0; margin:-4px -4px 14px; border-radius:8px; overflow:hidden; border:1px solid #333;">
                ${tabs.map(t => `
                    <button type="button" class="design-subtab-btn" data-tab="${t.key}" style="
                        flex:1; height:32px; box-sizing:border-box; padding:0 2px; font-size:0.72rem; font-weight:bold; border:none; cursor:pointer;
                        display:flex; align-items:center; justify-content:center;
                        background:${this._activeDesignTab === t.key ? '#00a8cc' : '#1e293b'}; color:#fff;
                    ">${t.label}</button>
                `).join('')}
            </div>
            <div id="design-subtab-body"></div>
        `;
        container.querySelectorAll('.design-subtab-btn').forEach(btn => {
            btn.onclick = () => {
                this._activeDesignTab = btn.dataset.tab;
                container.querySelectorAll('.design-subtab-btn').forEach(b => {
                    b.style.background = (b.dataset.tab === this._activeDesignTab) ? '#00a8cc' : '#1e293b';
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
                <label style="font-size:0.62rem; color:#94a3b8; flex:0 0 auto;">HEX</label>
                <input type="text" id="color-popover-hex" value="${isHex(design[key]) ? design[key] : ''}" placeholder="#RRGGBB" style="
                    flex:1; min-width:0; padding:4px 6px; background:#0d1b2a; border:1px solid #475569;
                    border-radius:5px; color:#fff; font-size:0.72rem;
                ">
                <input type="color" id="color-popover-native" title="詳細カスタム" value="${this._toHexOrDefault(design[key])}" style="
                    flex:0 0 24px; width:24px; height:24px; padding:0; border:1px solid #475569; border-radius:5px; background:none; cursor:pointer;
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
                    border:${sameColor(c, design[key]) ? '2px solid #00e5ff' : '1px solid rgba(255,255,255,0.15)'};
                    box-shadow:${sameColor(c, design[key]) ? '0 0 5px rgba(0,229,255,0.7)' : 'none'};
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
                        border:1px dashed ${hasBgImg ? '#00ff88' : '#475569'}; border-radius:5px;
                        color:${hasBgImg ? '#00ff88' : '#94a3b8'}; cursor:pointer;
                    ">🖼️ 画像を使う${hasBgImg ? '（設定済み）' : ''}</button>
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
                        background:${!currentVal ? 'rgba(0,229,255,0.14)' : '#1e293b'}; border:1px solid ${!currentVal ? '#00e5ff' : '#475569'};
                        border-radius:8px; color:#fff; cursor:pointer; font-size:0.85rem;
                    ">未設定にする</button>
                    ${items.map(it => `
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button type="button" data-pick="${it.id}" style="
                                flex:1; min-width:0; display:flex; align-items:center; padding:9px 10px; text-align:left;
                                background:${currentVal === it.data ? 'rgba(0,229,255,0.14)' : '#1e293b'}; border:1px solid ${currentVal === it.data ? '#00e5ff' : '#475569'};
                                border-radius:8px; color:#fff; cursor:pointer; font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
                            ">${it.name}</button>
                            <button type="button" data-preview="${it.id}" title="再生して確認" style="flex:0 0 auto; padding:8px 10px; background:#00a8cc; border:none; border-radius:6px; color:#fff; cursor:pointer;">▶</button>
                        </div>
                    `).join('')}
                    ${items.length === 0 ? '<p style="color:#666; font-size:0.78rem; text-align:center; margin:8px 0;">まだ音源が登録されていません</p>' : ''}
                </div>
                <p style="color:#666; font-size:0.66rem; margin:0 0 12px; line-height:1.4;">※音源の追加・削除は、ホストメニューの「サウンド編集」から行えます</p>
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
        const choiceCount = document.querySelectorAll('#creator-form-container .choice-text-input, #creator-form-container .row-input').length;
        const isAssoc = ((window.App.Creator && window.App.Creator.currentType) || '').startsWith('assoc');
        const gridLabel = isAssoc ? 'ヒントの配置' : '選択肢の配置';
        const itemWord = isAssoc ? 'ヒント' : '選択肢';

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
                        <label style="color:#94a3b8; font-size:0.75rem; display:block; margin-bottom:4px; text-align:center;">行数</label>
                        <input type="number" id="grid-modal-rows" min="1" max="10" value="${design.gridRows || ''}" placeholder="自動" style="
                            width:100%; padding:8px; text-align:center; background:#1e293b; border:1px solid #475569;
                            border-radius:8px; color:#fff; font-size:1rem; box-sizing:border-box;
                        ">
                    </div>
                    <div style="flex:1;">
                        <label style="color:#94a3b8; font-size:0.75rem; display:block; margin-bottom:4px; text-align:center;">列数</label>
                        <input type="number" id="grid-modal-cols" min="1" max="10" value="${design.gridCols || ''}" placeholder="自動" style="
                            width:100%; padding:8px; text-align:center; background:#1e293b; border:1px solid #475569;
                            border-radius:8px; color:#fff; font-size:1rem; box-sizing:border-box;
                        ">
                    </div>
                </div>
                <div id="grid-modal-error" style="color:#ff5555; font-size:0.75rem; text-align:center; min-height:1.2em; margin-bottom:6px;"></div>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button type="button" id="grid-modal-cancel" style="flex:1; padding:10px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">キャンセル</button>
                    <button type="button" id="grid-modal-clear" style="flex:1; padding:10px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">自動に戻す</button>
                    <button type="button" id="grid-modal-ok" style="flex:1; padding:10px; border-radius:8px; background:#00e5ff; border:none; color:#000; font-weight:bold; cursor:pointer;">決定</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
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
