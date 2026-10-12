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
    FONTS: {
        '':        { name: '標準',           css: '' },
        'gothic':  { name: 'ゴシック（太）',   css: "'M PLUS 1p', 'Hiragino Kaku Gothic ProN', sans-serif", google: 'M+PLUS+1p:wght@800;900' },
        'rounded': { name: '丸ゴシック',       css: "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', sans-serif", google: 'M+PLUS+Rounded+1c:wght@700;800' },
        'mincho':  { name: '明朝',             css: "'Shippori Mincho', 'Hiragino Mincho ProN', serif", google: 'Shippori+Mincho:wght@700;800' },
        'heavy':   { name: '極太',             css: "'Dela Gothic One', 'M PLUS 1p', sans-serif", google: 'Dela+Gothic+One' },
        'pixel':   { name: 'ドット',           css: "'DotGothic16', monospace", google: 'DotGothic16' },
    },

    // 一覧の順番がそのまま選択画面の並び。classic は従来の既定デザイン。
    list: [
        {
            id: 'classic', name: 'スタジオ', desc: 'いつもの黒×シアン',
            font: '', accent: '#00e5ff', timer: 'bar_top', bridge: { style: 'band', bg: '#0a0a0a', text: '#ffffff' },
            colors: {
                mainBgColor: '#0a0a0a',
                qTextColor: '#ffffff', qBgColor: 'rgba(255, 255, 255, 0.05)', qBorderColor: '#00bfff',
                cTextColor: '#a0a0a0', cBgColor: 'transparent', cBorderColor: '#333333',
                revealTextColor: '', revealBorderColor: '', revealBgColor: '',
            },
        },
        {
            id: 'golden', name: 'ゴールデン', desc: '夜の特番っぽい紺×金',
            font: 'mincho', accent: '#ffd700', timer: 'clock', bridge: { style: 'spotlight', bg: '#0b1a3a', text: '#ffd700' },
            colors: {
                mainBgColor: '#0b1a3a',
                qTextColor: '#ffffff', qBgColor: 'rgba(11, 26, 58, 0.85)', qBorderColor: '#d4af37',
                cTextColor: '#f5e6b8', cBgColor: 'rgba(212, 175, 55, 0.12)', cBorderColor: '#aa771c',
                revealTextColor: '#0b1a3a', revealBorderColor: '#ffd700', revealBgColor: '#ffd700',
            },
        },
        {
            id: 'neon', name: 'ネオン', desc: 'クラブ・夜パーティ向け',
            font: 'heavy', accent: '#ff00aa', timer: 'ring', bridge: { style: 'shutter', bg: '#07000f', text: '#ffffff' },
            colors: {
                mainBgColor: '#07000f',
                qTextColor: '#ffffff', qBgColor: 'rgba(255, 0, 170, 0.10)', qBorderColor: '#ff00aa',
                cTextColor: '#7df9ff', cBgColor: 'rgba(0, 255, 255, 0.06)', cBorderColor: '#00ffff',
                revealTextColor: '#07000f', revealBorderColor: '#00ffff', revealBgColor: '#00ffff',
            },
        },
        {
            id: 'pop', name: 'ポップ', desc: '明るいバラエティ',
            font: 'rounded', accent: '#ff5722', timer: 'number', bridge: { style: 'count', bg: '#ffd23f', text: '#2b2b2b' },
            colors: {
                mainBgColor: '#ffd23f',
                qTextColor: '#2b2b2b', qBgColor: '#ffffff', qBorderColor: '#ff5722',
                cTextColor: '#2b2b2b', cBgColor: '#fff4cc', cBorderColor: '#ff9800',
                revealTextColor: '#ffffff', revealBorderColor: '#e91e63', revealBgColor: '#e91e63',
            },
        },
        {
            id: 'retro', name: 'レトロゲーム', desc: 'ドット文字のゲーム画面',
            font: 'pixel', accent: '#76ff03', timer: 'number', bridge: { style: 'typewriter', bg: '#101010', text: '#76ff03' },
            colors: {
                mainBgColor: '#101010',
                qTextColor: '#76ff03', qBgColor: '#000000', qBorderColor: '#76ff03',
                cTextColor: '#ffffff', cBgColor: '#000000', cBorderColor: '#ffffff',
                revealTextColor: '#000000', revealBorderColor: '#ffeb3b', revealBgColor: '#ffeb3b',
            },
        },
        {
            id: 'japanese', name: '和', desc: '朱と生成りの落ち着いた画面',
            font: 'mincho', accent: '#c0392b', timer: 'bar_bottom', bridge: { style: 'band', bg: '#2a1a14', text: '#f3ead7' },
            colors: {
                mainBgColor: '#2a1a14',
                qTextColor: '#2a1a14', qBgColor: '#f3ead7', qBorderColor: '#c0392b',
                cTextColor: '#f3ead7', cBgColor: 'rgba(243, 234, 215, 0.08)', cBorderColor: '#8b4513',
                revealTextColor: '#f3ead7', revealBorderColor: '#c0392b', revealBgColor: '#c0392b',
            },
        },
        {
            id: 'clean', name: 'クリーン', desc: '白基調で見やすく',
            font: 'gothic', accent: '#2563eb', timer: 'ring', bridge: { style: 'count', bg: '#f4f6fa', text: '#111827' },
            colors: {
                mainBgColor: '#f4f6fa',
                qTextColor: '#111827', qBgColor: '#ffffff', qBorderColor: '#2563eb',
                cTextColor: '#1f2937', cBgColor: '#ffffff', cBorderColor: '#cbd5e1',
                revealTextColor: '#ffffff', revealBorderColor: '#2563eb', revealBgColor: '#2563eb',
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
        Object.assign(design, t.colors);
        design.fontFamily = t.font;
        design.accentColor = t.accent;
        if (t.timer) design.timerStyle = t.timer; // タイマーの見た目もテーマに合わせる
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
