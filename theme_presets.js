/* =========================================================
 * theme_presets.js — デザインテーマ
 *
 * テーマ = 「番組の見た目一式」（背景・問題枠・選択肢・正解表示の色、
 * フォント、アクセント色）。テーマを選ぶとセット共通のデザイン
 * （App.Data.currentDesign）にまとめて書き込まれ、その後で個別の色を
 * 触れば、その部分だけテーマから上書きされる。
 *
 * 軽さのための約束:
 * ・フォントは使うテーマが選ばれた時だけ読み込む（ensureFont）
 * ・テーマ自体は色とフォント名だけ — 画像は持たない
 * =======================================================*/

window.App = window.App || {};

App.Themes = {
    // フォント — key は design.fontFamily に保存される値。
    // google: Google Fonts の family 指定（未指定ならOS標準フォントで読み込み不要）
    //   バラエティ番組で見かける系統だけを10種類（使う時だけ読み込む）
    FONTS: {
        '':        { name: '標準',           css: '' },
        'gothic':  { name: '太ゴシック',       css: "'M PLUS 1p', 'Hiragino Kaku Gothic ProN', sans-serif", google: 'M+PLUS+1p:wght@800;900' },
        'heavy':   { name: '極太',             css: "'Dela Gothic One', 'M PLUS 1p', sans-serif", google: 'Dela+Gothic+One' },
        'rounded': { name: '丸ゴシック',       css: "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', sans-serif", google: 'M+PLUS+Rounded+1c:wght@700;800' },
        'pop':     { name: 'ポップ',           css: "'RocknRoll One', 'M PLUS Rounded 1c', sans-serif", google: 'RocknRoll+One' },
        'cute':    { name: 'まるもじ',         css: "'Hachi Maru Pop', 'M PLUS Rounded 1c', sans-serif", google: 'Hachi+Maru+Pop' },
        'hand':    { name: '手書き',           css: "'Yusei Magic', 'M PLUS Rounded 1c', sans-serif", google: 'Yusei+Magic' },
        'brush':   { name: '筆文字',           css: "'Yuji Boku', 'Shippori Mincho', serif", google: 'Yuji+Boku' },
        'deco':    { name: '飾り文字',         css: "'Rampart One', 'Dela Gothic One', sans-serif", google: 'Rampart+One' },
        'mincho':  { name: '特番明朝',         css: "'Shippori Mincho', 'Hiragino Mincho ProN', serif", google: 'Shippori+Mincho:wght@700;800' },
        'pixel':   { name: 'ドット',           css: "'DotGothic16', monospace", google: 'DotGothic16' },
    },

    // 文字の飾り — 選ぶだけでテロップっぽくなる「型」。細かい所（縁・影・色・付ける場所）は詳細で上書き
    //   stroke: 縁の太さ（none / thin / thick）  shadow: 影（none / drop / offset / glow / solid）
    //   fill  : 文字の色を上書き（金文字など。空なら部品ごとの文字色のまま）
    TEXT_FX: {
        none:  { name: 'なし',   stroke: 'none',  strokeColor: '#000000', shadow: 'none',   shadowColor: '#000000', fill: '' },
        telop: { name: 'テロップ', stroke: 'thick', strokeColor: '#000000', shadow: 'drop',   shadowColor: 'rgba(0,0,0,0.7)', fill: '' },
        gold:  { name: '金文字', stroke: 'thin',  strokeColor: '#3a2500', shadow: 'solid',  shadowColor: '#7a5600', fill: '#ffd84a' },
        neon:  { name: 'ネオン', stroke: 'none',  strokeColor: '#000000', shadow: 'glow',   shadowColor: '', fill: '' },
        pop:   { name: 'ポップ', stroke: 'thick', strokeColor: '#ffffff', shadow: 'offset', shadowColor: '#e91e63', fill: '' },
        solid: { name: '立体',   stroke: 'thin',  strokeColor: '#000000', shadow: 'solid',  shadowColor: '#000000', fill: '' },
    },
    STROKE_W: { none: '0', thin: '0.08em', thick: '0.17em' },
    // 影の作り方（c は影の色）
    shadowCss: function (kind, c) {
        if (kind === 'drop') return `0 0.06em 0.14em ${c}`;
        if (kind === 'offset') return `0.09em 0.09em 0 ${c}`;
        if (kind === 'glow') return `0 0 0.06em #ffffff, 0 0 0.25em ${c}, 0 0 0.6em ${c}`;
        if (kind === 'solid') return `0.025em 0.025em 0 ${c}, 0.05em 0.05em 0 ${c}, 0.075em 0.075em 0 ${c}, 0.1em 0.1em 0 ${c}, 0.12em 0.14em 0.12em rgba(0,0,0,0.5)`;
        return 'none';
    },
    // 今のデザインの飾り（型＋詳細の上書き）。前から作ってあるセットは「なし」のまま（見た目が勝手に変わらないように）
    textFx: function (design) {
        const d = design || {};
        const id = d.textFx || 'none';
        const base = this.TEXT_FX[id] || this.TEXT_FX.none;
        const pick = (k) => (d['tfx_' + k] !== undefined && d['tfx_' + k] !== '') ? d['tfx_' + k] : base[k];
        const accent = d.accentColor || '#00e5ff';
        const r = { id, stroke: pick('stroke'), strokeColor: pick('strokeColor'), shadow: pick('shadow'), shadowColor: pick('shadowColor') || accent, fill: pick('fill') };
        r.on = r.stroke !== 'none' || r.shadow !== 'none' || !!r.fill;
        return r;
    },
    // 見本（設定画面のボタン）に使う、飾りのインライン style
    fxInline: function (fx) {
        const st = fx.stroke === 'none' ? '' : `-webkit-text-stroke:${this.STROKE_W[fx.stroke]} ${fx.strokeColor}; paint-order:stroke fill;`;
        return `${st} text-shadow:${this.shadowCss(fx.shadow, fx.shadowColor)};${fx.fill ? ` color:${fx.fill};` : ''}`;
    },
    // 書体の見本だけ先に読む（名前の文字だけの小さな読み込み）
    _previewFonts: {},
    previewFont: function (key) {
        const f = this.FONTS[key || ''];
        if (!f || !f.google || this._loadedFonts[key] || this._previewFonts[key]) return;
        this._previewFonts[key] = true;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${f.google}&text=${encodeURIComponent(f.name + '第1問')}&display=swap`;
        document.head.appendChild(link);
    },
    // パネル（パネル指名・パネルクイズ）の色 — 古いデザインに無ければテーマの色
    PANEL_KEYS: ['pbBg', 'pbText', 'pbBorder', 'pbOk', 'pbOkText', 'pbDone', 'pbDoneText', 'pbGloss'],
    panelColor: function (design, key) {
        const d = design || {};
        if (d[key] !== undefined && d[key] !== '') return d[key];
        const t = this.get(d.themeId);
        return (t && t.colors[key]) || '';
    },

    // 一覧の順番がそのまま選択画面の並び。classic は従来の既定デザイン。
    list: [
        {
            // 白地に黒い線だけ — ここから色・形を足していけば、ほかのテーマも作れる
            id: 'plain', name: 'シンプル', desc: '白地に黒線。ここから自由に',
            fx: 'none', font: '', accent: '#111111', timer: 'bar_top', bridge: { style: 'plain', bg: '#ffffff', text: '#111111' },
            skin: { c: '', pal: '', q: '', fx: '' },
            colors: {
                mainBgColor: '#ffffff',
                qTextColor: '#111111', qBgColor: '#ffffff', qBorderColor: '#111111',
                cTextColor: '#111111', cBgColor: '#ffffff', cBorderColor: '#111111', cPrefixColor: '#111111',
                revealTextColor: '#ffffff', revealBorderColor: '#111111', revealBgColor: '#111111',
                pbBg: '#ffffff', pbText: '#111111', pbBorder: '#111111', pbOk: '#111111', pbOkText: '#ffffff', pbDone: '#e5e5e5', pbDoneText: '#9ca3af', pbGloss: 'none',
            },
        },
        {
            id: 'classic', name: 'スタジオ', desc: '黒地にシアンの線とテロップ文字',
            fx: 'telop', font: '', accent: '#00e5ff', timer: 'bar_top', bridge: { style: 'band', bg: '#0a0a0a', text: '#ffffff' },
            skin: { c: 'panel', pal: '', q: 'telop', fx: 'studio' },
            colors: {
                mainBgColor: '#0a0a0a',
                qTextColor: '#ffffff', qBgColor: 'rgba(255, 255, 255, 0.05)', qBorderColor: '#00bfff',
                cTextColor: '#a0a0a0', cBgColor: 'transparent', cBorderColor: '#333333',
                revealTextColor: '', revealBorderColor: '', revealBgColor: '',
                pbBg: '#0f1720', pbText: '#ffffff', pbBorder: '#00bfff', pbOk: '#00e5ff', pbOkText: '#001018', pbDone: '#141414', pbDoneText: '#4b5563', pbGloss: '',
            },
        },
        {
            id: 'golden', name: 'ゴールデン', desc: '夜の特番っぽい紺×金',
            fx: 'gold', font: 'mincho', accent: '#ffd700', timer: 'clock', bridge: { style: 'spotlight', bg: '#0b1a3a', text: '#ffd700' },
            skin: { c: 'capsule', pal: '', q: 'telop', fx: 'studio' },
            colors: {
                mainBgColor: '#0b1a3a',
                qTextColor: '#ffffff', qBgColor: 'rgba(11, 26, 58, 0.85)', qBorderColor: '#d4af37',
                cTextColor: '#f5e6b8', cBgColor: 'rgba(212, 175, 55, 0.12)', cBorderColor: '#aa771c',
                revealTextColor: '#0b1a3a', revealBorderColor: '#ffd700', revealBgColor: '#ffd700',
                pbBg: '#13285a', pbText: '#f5e6b8', pbBorder: '#d4af37', pbOk: '#ffd700', pbOkText: '#0b1a3a', pbDone: '#0d1733', pbDoneText: '#4b5a80', pbGloss: '',
            },
        },
        {
            id: 'neon', name: 'ネオン', desc: 'クラブ・夜パーティ向け',
            fx: 'neon', font: 'gothic', accent: '#ff00aa', timer: 'ring', bridge: { style: 'shutter', bg: '#07000f', text: '#ffffff' },
            skin: { c: 'panel', pal: 'four', q: 'telop', fx: 'studio' },
            colors: {
                mainBgColor: '#07000f',
                qTextColor: '#ffffff', qBgColor: 'rgba(255, 0, 170, 0.10)', qBorderColor: '#ff00aa',
                cTextColor: '#7df9ff', cBgColor: 'rgba(0, 255, 255, 0.06)', cBorderColor: '#00ffff',
                revealTextColor: '#07000f', revealBorderColor: '#00ffff', revealBgColor: '#00ffff',
                pbBg: '#14002a', pbText: '#7df9ff', pbBorder: '#ff00aa', pbOk: '#00ffff', pbOkText: '#07000f', pbDone: '#0c0016', pbDoneText: '#5a3a6a', pbGloss: '',
            },
        },
        {
            id: 'pop', name: 'ポップ', desc: '明るいバラエティ',
            fx: 'pop', font: 'pop', accent: '#ff5722', timer: 'number', bridge: { style: 'count', bg: '#ffd23f', text: '#2b2b2b' },
            skin: { c: 'button', pal: 'four', q: 'board', fx: '' },
            colors: {
                mainBgColor: '#ffd23f',
                qTextColor: '#2b2b2b', qBgColor: '#ffffff', qBorderColor: '#ff5722',
                cTextColor: '#2b2b2b', cBgColor: '#fff4cc', cBorderColor: '#ff9800',
                revealTextColor: '#ffffff', revealBorderColor: '#e91e63', revealBgColor: '#e91e63',
                pbBg: '#2196f3', pbText: '#ffffff', pbBorder: '#ffffff', pbOk: '#e91e63', pbOkText: '#ffffff', pbDone: '#f3e3a0', pbDoneText: '#b08a2e', pbGloss: '',
            },
        },
        {
            id: 'retro', name: 'レトロゲーム', desc: 'ドット文字のゲーム画面',
            fx: 'solid', font: 'pixel', accent: '#76ff03', timer: 'number', bridge: { style: 'typewriter', bg: '#101010', text: '#76ff03' },
            skin: { c: '', pal: '', q: '', fx: '' },
            colors: {
                mainBgColor: '#101010',
                qTextColor: '#76ff03', qBgColor: '#000000', qBorderColor: '#76ff03',
                cTextColor: '#ffffff', cBgColor: '#000000', cBorderColor: '#ffffff',
                revealTextColor: '#000000', revealBorderColor: '#ffeb3b', revealBgColor: '#ffeb3b',
                pbBg: '#000000', pbText: '#76ff03', pbBorder: '#76ff03', pbOk: '#ffeb3b', pbOkText: '#000000', pbDone: '#101010', pbDoneText: '#2e5e10', pbGloss: 'none',
            },
        },
        {
            id: 'clean', name: 'クリーン', desc: '白基調で見やすく',
            fx: 'none', font: 'gothic', accent: '#2563eb', timer: 'ring', bridge: { style: 'count', bg: '#f4f6fa', text: '#111827' },
            skin: { c: 'card', pal: 'four', q: 'board', fx: '' },
            colors: {
                mainBgColor: '#f4f6fa',
                qTextColor: '#111827', qBgColor: '#ffffff', qBorderColor: '#2563eb',
                cTextColor: '#1f2937', cBgColor: '#ffffff', cBorderColor: '#cbd5e1',
                revealTextColor: '#ffffff', revealBorderColor: '#2563eb', revealBgColor: '#2563eb',
                pbBg: '#ffffff', pbText: '#1f2937', pbBorder: '#cbd5e1', pbOk: '#2563eb', pbOkText: '#ffffff', pbDone: '#eef1f6', pbDoneText: '#94a3b8', pbGloss: 'none',
            },
        },
        {
            // おもちゃ箱 — 空色の地に、赤い箱の縁・4色のボタン・まるもじ＋ブロックのような立体文字
            id: 'toybox', name: 'おもちゃ箱', desc: '空色×原色のにぎやかな箱',
            fx: 'solid', fxOver: { tfx_shadowColor: '#1e3a8a' }, font: 'cute', accent: '#ef4444', timer: 'number', frame: '#ef4444',
            bridge: { style: 'count', bg: '#7dd3fc', text: '#1e3a8a' },
            skin: { c: 'button', pal: 'four', q: 'board', fx: '', frame: true },
            colors: {
                mainBgColor: '#7dd3fc',
                qTextColor: '#1e3a8a', qBgColor: '#ffffff', qBorderColor: '#ef4444',
                cTextColor: '#ffffff', cBgColor: '#2563eb', cBorderColor: '#ffffff',
                revealTextColor: '#1e3a8a', revealBorderColor: '#facc15', revealBgColor: '#facc15',
                pbBg: '#ef4444', pbText: '#ffffff', pbBorder: '#ffffff', pbOk: '#facc15', pbOkText: '#1e3a8a', pbDone: '#bae6fd', pbDoneText: '#60a5fa', pbGloss: '',
            },
        },
        {
            // 学校 — 黒板の緑に木の枠、チョークの白と黄色、手書きの文字
            id: 'school', name: '学校', desc: '黒板とチョークの教室',
            fx: 'none', fxOver: { tfx_shadow: 'drop', tfx_shadowColor: 'rgba(255,255,255,0.35)' }, font: 'hand', accent: '#fde047', timer: 'clock', frame: '#8b5a2b',
            bridge: { style: 'typewriter', bg: '#1f3b2d', text: '#f5f5f0' },
            skin: { c: '', pal: '', q: '', fx: '', frame: true },
            colors: {
                mainBgColor: '#1f3b2d',
                qTextColor: '#f5f5f0', qBgColor: 'transparent', qBorderColor: 'rgba(245, 245, 240, 0.35)',
                cTextColor: '#f5f5f0', cBgColor: 'transparent', cBorderColor: 'rgba(245, 245, 240, 0.6)',
                revealTextColor: '#1f3b2d', revealBorderColor: '#fde047', revealBgColor: '#fde047',
                pbBg: '#2a4a38', pbText: '#f5f5f0', pbBorder: '#f5f5f0', pbOk: '#fde047', pbOkText: '#1f3b2d', pbDone: '#18301f', pbDoneText: '#4d6b58', pbGloss: 'none',
            },
        },
    ],

    get: function (id) {
        return this.list.find(t => t.id === id) || null;
    },

    // テーマをデザインに書き込む。サウンド・背景画像・レイアウト・文字サイズ
    // など、テーマの外側の設定には触れない。
    apply: function (design, id) {
        const t = this.get(id);
        if (!design || !t) return design;
        design.cPrefixColor = '';
        Object.assign(design, t.colors);
        design.fontFamily = t.font;
        design.accentColor = t.accent;
        // 文字の飾りもテーマの型に戻す（詳細の上書きは消す）
        design.textFx = t.fx || 'none';
        Object.keys(design).forEach(k => { if (k.indexOf('tfx_') === 0) delete design[k]; });
        Object.assign(design, t.fxOver || {}); // テーマごとの飾りの細部（学校のチョークのにじみなど）
        if (t.timer) design.timerStyle = t.timer; // タイマーの見た目もテーマに合わせる
        // 画面の型は1つ（バラエティ枠も標準の設定の組み合わせ）
        delete design.layoutTemplate;
        design.frameColor = t.frame || '';
        // 選択肢ボタンの形・問題文の見せ方・背景の照明（choice_skin.js）
        if (t.skin) {
            design.cSkin = t.skin.c;
            design.cPalette = t.skin.pal;
            design.qSkin = t.skin.q;
            design.bgFx = t.skin.fx;
            design.stageFrame = !!t.skin.frame;
            if (t.skin.arrange === 'row') { design.gridRows = '1'; design.gridCols = '4'; }
        }
        if (t.bridge) { // ブリッジ（第○問）も黒×白に限らず、テーマに合わせる
            design.bridgeStyle = t.bridge.style;
            design.bridgeBgColor = t.bridge.bg;
            design.bridgeTextColor = t.bridge.text;
        }
        design.themeId = t.id;
        this.ensureFont(t.font);
        return design;
    },

    // 今のデザインがテーマから変えられているか（「カスタム」表示用）
    isModified: function (design) {
        const t = design && this.get(design.themeId);
        if (!t) return false;
        if ((design.fontFamily || '') !== t.font) return true;
        if ((design.textFx || 'none') !== (t.fx || 'none') || Object.keys(design).some(k => k.indexOf('tfx_') === 0 && (design[k] || '') !== ((t.fxOver || {})[k] || ''))) return true;
        if (t.skin && ((design.cSkin || '') !== t.skin.c || (design.cPalette || '') !== t.skin.pal || (design.qSkin || '') !== t.skin.q)) return true;
        return Object.keys(t.colors).some(k => (design[k] || '') !== (t.colors[k] || ''));
    },

    fontCss: function (key) {
        const f = this.FONTS[key || ''];
        return (f && f.css) || '';
    },

    // 使う時だけ Google Fonts を読み込む（同じフォントは1回だけ）
    _loadedFonts: { gothic: true }, // M PLUS 1p は index.html で読み込み済み
    ensureFont: function (key) {
        const f = this.FONTS[key || ''];
        if (!f || !f.google || this._loadedFonts[key]) return;
        this._loadedFonts[key] = true;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
        document.head.appendChild(link);
    },

    // モニター／プレビュー／回答端末の画面にフォントとアクセント色を反映する。
    // --color-primary を差し替えるので、既存の「枠の色が未設定ならアクセント色」
    // の部分も自動でテーマ色になる。
    applyToElement: function (el, design) {
        if (!el) return;
        const d = design || {};
        this.ensureFont(d.fontFamily);
        // 画面内には部品ごとに font-family を直書きしている所が多いので、
        // 変数 + クラスで中身ごとまとめて差し替える（style_common.css .theme-font）
        const css = this.fontCss(d.fontFamily);
        if (css) {
            el.style.setProperty('--theme-font', css);
            el.classList.add('theme-font');
        } else {
            el.style.removeProperty('--theme-font');
            el.classList.remove('theme-font');
        }
        // 文字の飾り（style_common.css .tfx-*）— 付ける場所ごとにクラスを分ける
        const fx = this.textFx(d);
        ['tfx-q', 'tfx-c', 'tfx-b', 'tfx-fill'].forEach(c => el.classList.remove(c));
        if (fx.on) {
            el.style.setProperty('--tfx-stroke', fx.stroke === 'none' ? '0 transparent' : `${this.STROKE_W[fx.stroke] || '0'} ${fx.strokeColor}`);
            el.style.setProperty('--tfx-shadow', this.shadowCss(fx.shadow, fx.shadowColor));
            if (fx.fill) { el.style.setProperty('--tfx-fill', fx.fill); el.classList.add('tfx-fill'); }
            if (d.tfxQ !== 'off') el.classList.add('tfx-q');
            if (d.tfxC !== 'off') el.classList.add('tfx-c');
            if (d.tfxB !== 'off') el.classList.add('tfx-b');
        }
        if (d.accentColor) {
            el.style.setProperty('--color-primary', d.accentColor);
            el.style.setProperty('--theme-accent', d.accentColor);
        } else {
            el.style.removeProperty('--color-primary');
            el.style.removeProperty('--theme-accent');
        }
    },

    // 背景画像を軽くする — 最大 1920×1080 に縮小して JPEG にする。
    // 元の画像をそのまま data URL で保存すると数MBになり、ルームを開く時に
    // モニター・全端末へ配信されて重くなるため。
    compressImage: function (file, maxW = 1920, maxH = 1080, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = (ev) => {
                const src = ev.target.result;
                // GIF（アニメーション）は縮小すると止まるのでそのまま
                if (/^data:image\/gif/.test(src)) { resolve(src); return; }
                const img = new Image();
                img.onerror = () => resolve(src);
                img.onload = () => {
                    const scale = Math.min(1, maxW / img.width, maxH / img.height);
                    const w = Math.round(img.width * scale);
                    const h = Math.round(img.height * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    const out = canvas.toDataURL('image/jpeg', quality);
                    // 小さい画像は元の方が軽いこともある
                    resolve(out.length < src.length ? out : src);
                };
                img.src = src;
            };
            reader.readAsDataURL(file);
        });
    },
};
