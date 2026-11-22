/* =========================================================
 * choice_skin.js — 選択式の「見せ方」を組み合わせで作る
 *
 * バラエティ枠のような番組らしい画面を、標準の画面型のままでも
 * 組み立てられるように、見た目を部品ごとの設定に分けている。
 *   cSkin     … 選択肢ボタンの形（シンプル／放送パネル／カラーボタン／カプセル／カード）
 *   cPalette  … ボタンの色（'' テーマ色1色／'four' 赤・青・緑・黄の色分け）
 *   qSkin     … 問題文の見せ方（'' 枠／'telop' テロップ帯／'board' ボード）
 *   qNumBadge … テロップ・ボードに問題番号を出すか（未設定は出す）
 *   stageFrame… 画面の外枠と上の帯（frameColor・frameTitle を使う）
 *   bgFx      … 背景の照明（'studio' スタジオ照明。背景画像がある時は使わない）
 * テーマ（theme_presets.js）はこれらの組み合わせを持っていて、選ぶと
 * まとめて書き込まれる。見た目の CSS は choice_skin.css。
 * =======================================================*/

window.App = window.App || {};

App.ChoiceSkin = {
    SKINS: [
        { id: '', name: 'シンプル' },
        { id: 'panel', name: '放送パネル' },
        { id: 'button', name: 'カラーボタン' },
        { id: 'capsule', name: 'カプセル' },
        { id: 'card', name: 'カード' },
    ],
    Q_SKINS: [
        { id: '', name: '枠' },
        { id: 'telop', name: 'テロップ帯' },
        { id: 'board', name: 'ボード' },
        { id: 'caption', name: '写真＋字幕' },
    ],
    FOUR: ['#e53935', '#1e63d6', '#14a04a', '#f2a900', '#8e24aa', '#00897b'],
    CLASSES: ['cskin', 'cskin-panel', 'cskin-button', 'cskin-capsule', 'cskin-card', 'cpal-four',
        'qskin-telop', 'qskin-board', 'qskin-caption', 'cs-framed', 'cs-answer', 'cs-narrow'],

    esc: function (v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // 選択肢の形の設定が効く問題か（選択式の4択など。まるばつ・ドボンは今の見た目）
    appliesToChoices: function (q) {
        if (!q || q.type !== 'choice' || q.ox) return false;
        if (q.mode === 'dobon' || q.mode === 'multi' || q.multi) return false;
        return !!((q.design || {}).cSkin) && Array.isArray(q.c);
    },

    accent: function (d) {
        return (d && (d.accentColor || d.qBorderColor)) || '#00e5ff';
    },

    btnColor: function (d, i) {
        if (d && d.cPalette === 'four') return this.FOUR[i % this.FOUR.length];
        return (d && d.cPrefixColor) || this.accent(d);
    },

    // 色の文字列が「ほぼ透明」か（rgba の透明度が低い・transparent）
    isFaint: function (c) {
        if (!c || c === 'transparent') return true;
        const m = String(c).match(/rgba?\(([^)]+)\)/);
        if (!m) return false;
        const parts = m[1].split(',').map(s => s.trim());
        return parts.length === 4 && parseFloat(parts[3]) < 0.5;
    },

    // テロップ・ボードの地の色 — 半透明の設定なら見やすい濃い色に
    qSolidBg: function (d) {
        const c = d && d.qBgColor;
        if (d && d.qSkin === 'board') return this.isFaint(c) ? '#ffffff' : c;
        if (d && d.qSkin === 'caption') return this.isFaint(c) ? '#f2efdc' : c;
        return this.isFaint(c) ? '#0d1626' : c;
    },

    qNumLabel: function (st, fallbackIdx) {
        if (st && st.qNumLabel) return st.qNumLabel;
        const i = st && st.qIndex !== undefined ? st.qIndex : (fallbackIdx || 0);
        return `Q${i + 1}`;
    },

    // 前の「バラエティ枠」（画面の型 frame）を、同じ見た目の設定の組み合わせに置き換える
    migrate: function (d) {
        if (!d || d.layoutTemplate !== 'frame') return d;
        delete d.layoutTemplate;
        d.stageFrame = true;
        d.cSkin = d.cSkin || 'button';
        d.cPalette = 'four';
        d.qSkin = 'caption';
        d.gridRows = '1';
        d.gridCols = '4';
        if (!d.frameColor) d.frameColor = '#c9c94a';
        return d;
    },

    clear: function (el) {
        if (!el) return;
        this.CLASSES.forEach(c => el.classList.remove(c));
        el.removeAttribute('data-frame-title');
    },

    // 箱（モニターの #viewer-main-text や作成画面のプレビュー）に共通の印と色を付ける
    // 明るい色か（#rgb / #rrggbb のみ判定。分からない時は null）
    isLight: function (c) {
        let h = String(c || '').trim();
        if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + h.slice(1).split('').map(x => x + x).join('');
        if (!/^#[0-9a-f]{6}$/i.test(h)) return null;
        const n = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255);
        return (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) > 0.55;
    },

    // 地の色に対して読める文字色（設定の色が読めない時だけ差し替える）
    readable: function (bg, text, dark = '#1f1f24', light = '#ffffff') {
        const bgLight = this.isLight(bg);
        if (bgLight === null) return text || light;
        const tLight = this.isLight(text);
        if (tLight !== null && tLight !== bgLight) return text;
        return bgLight ? dark : light;
    },

    applyVars: function (el, d) {
        el.style.setProperty('--cs-accent', this.accent(d));
        el.style.setProperty('--cs-text', d.cTextColor || '#ffffff');
        el.style.setProperty('--cs-frame', d.frameColor || this.accent(d));
        const card = this.isFaint(d.cBgColor) ? '#ffffff' : d.cBgColor;
        el.style.setProperty('--cs-card', card);
        el.style.setProperty('--cs-cardtext', this.readable(card, d.cTextColor));
        const qbg = this.qSolidBg(d);
        el.style.setProperty('--qs-bg', qbg);
        el.style.setProperty('--qs-text', this.readable(qbg, d.qTextColor));
        el.style.setProperty('--qs-captext', this.readable('#ffffff', d.qTextColor));
        el.style.setProperty('--qs-line', d.qBorderColor && d.qBorderColor !== 'transparent' ? d.qBorderColor : this.accent(d));
    },

    // スタジオ照明の背景（背景画像が無い時だけ）
    studioBg: function (bg) {
        const b = bg || '#0a0a0a';
        return `radial-gradient(ellipse 70% 55% at 50% 38%, color-mix(in srgb, ${b} 72%, #ffffff) 0%, transparent 70%),` +
            `radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, color-mix(in srgb, ${b} 35%, #000000) 100%),` +
            `repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 6cqw)`;
    },

    // ---------------------------------------------------------
    // モニター（viewer.js の標準の画面）— 描いた後に呼ぶ
    // ---------------------------------------------------------
    applyToViewer: function (container, contentBox, q, st) {
        this.clear(contentBox);
        if (!contentBox || !q) return;
        const d = q.design || {};
        st = st || {};
        this.applyVars(contentBox, d);
        if (d.bgFx === 'studio' && !d.bgImage && container) container.style.backgroundImage = this.studioBg(d.mainBgColor);

        // 画面の外枠と上の帯
        if (d.stageFrame) {
            contentBox.classList.add('cs-framed');
            const title = d.frameTitle || st.programTitle || (window.App.Viewer && window.App.Viewer.config && window.App.Viewer.config.periodTitle) || '';
            contentBox.setAttribute('data-frame-title', title);
        }

        // 問題文の見せ方
        const qa = contentBox.querySelector('.q-area');
        if (qa && d.qSkin) {
            contentBox.classList.add('qskin-' + d.qSkin);
            // 問題文の文字だけを包む（写真＋字幕では写真の下の帯にする）
            if (!qa.querySelector(':scope > .qs-text')) {
                const textNodes = [...qa.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains('q-photo') && !n.classList.contains('qs-num')));
                if (textNodes.length) {
                    const wrap = document.createElement('span');
                    wrap.className = 'qs-text';
                    qa.insertBefore(wrap, textNodes[0]);
                    textNodes.forEach(n => wrap.appendChild(n));
                }
            }
            if (d.qNumBadge !== false && !qa.querySelector('.qs-num')) {
                const tag = document.createElement('span');
                tag.className = 'qs-num';
                tag.textContent = d.qSkin === 'board' ? this.boardLabel(st) : this.qNumLabel(st);
                qa.insertBefore(tag, qa.firstChild);
            }
            // 枠の色などを直接書いている所はテロップ・ボードの見た目に任せる
            ['borderColor', 'backgroundColor', 'boxShadow'].forEach(k => { qa.style[k] = ''; });
            if (d.qTextColor !== 'transparent') qa.style.color = 'var(--qs-text)';
        }

        if (!this.appliesToChoices(q)) return;
        contentBox.classList.add('cskin', 'cskin-' + d.cSkin);
        if (d.cPalette === 'four') contentBox.classList.add('cpal-four');
        // 横に3つ以上並べる時は、記号を角の小さな丸にして名前の幅を広く取る
        if ((parseInt(d.gridCols) || 0) >= 3 && (parseInt(d.gridRows) || 0) > 0) contentBox.classList.add('cs-narrow');
        const items = contentBox.querySelectorAll('.c-area > .choice-item');
        items.forEach((el, i) => {
            el.classList.add('cs-item');
            el.dataset.i = i;
            // 色・枠を直接書いている所は外して、形の CSS に任せる
            ['background', 'backgroundColor', 'border', 'borderColor', 'color', 'transform', 'boxShadow'].forEach(k => { el.style[k] = ''; });
            el.style.setProperty('--cs-btn', this.btnColor(d, i));
            const pre = el.querySelector('.choice-prefix');
            if (pre) { pre.classList.add('cs-badge'); pre.style.color = ''; }
            const label = pre ? pre.nextElementSibling : null;
            if (label) label.classList.add('cs-label');
        });
        this.updateLive(st, (window.App.Viewer && window.App.Viewer._players) || {}, q, contentBox);
        const isAnswer = st.step === 'reveal_correct' || st.step === 'answer';
        if (isAnswer) this.reveal(contentBox, q, st);
    },

    boardLabel: function (st) {
        if (st && st.qNumLabel) return st.qNumLabel;
        return `第${((st && st.qIndex) || 0) + 1}問`;
    },

    // 1人が答える形式で、押した選択肢を光らせる
    updateLive: function (st, players, q, root) {
        if (!q || !this.appliesToChoices(q)) return;
        root = root || document.getElementById('viewer-main-text');
        if (!root || !root.classList.contains('cskin') || root.classList.contains('cs-answer')) return;
        const VF = window.App.VarietyFrame;
        const focus = VF ? VF.focusAnswer(st, players) : null;
        root.querySelectorAll('.cs-item').forEach(el => el.classList.toggle('cs-lit', focus !== null && parseInt(el.dataset.i) === focus));
    },

    // 正解発表: 正解を光らせ、ほかは暗く。1人が答えていればそのボタンに〇／×、
    // 全員同時なら各ボタンを選んだ人数
    reveal: function (root, q, st) {
        const VF = window.App.VarietyFrame;
        const players = (window.App.Viewer && window.App.Viewer._players) || {};
        root.classList.add('cs-answer');
        const corr = VF ? VF.correctSet(q) : new Set([parseInt(q.correctIndex !== undefined ? q.correctIndex : q.correct)]);
        const focus = VF ? VF.focusAnswer(st, players) : null;
        let counts = (VF && focus === null) ? VF.counts(q, players) : null;
        if (counts && !counts.some(n => n > 0)) counts = null;
        root.querySelectorAll('.cs-item').forEach(el => {
            const i = parseInt(el.dataset.i);
            el.classList.remove('cs-lit');
            el.classList.toggle('cs-correct', corr.has(i));
            el.classList.toggle('cs-dim', !corr.has(i) && focus !== i);
            el.querySelector('.cs-stamp')?.remove();
            el.querySelector('.cs-count')?.remove();
            if (focus === i) {
                const s = document.createElement('span');
                s.className = 'cs-stamp ' + (corr.has(i) ? 'cs-stamp-ok' : 'cs-stamp-ng');
                el.appendChild(s);
            }
            if (counts) {
                const c = document.createElement('span');
                c.className = 'cs-count';
                c.textContent = `${counts[i]}人`;
                el.appendChild(c);
            }
        });
    },

    // ---------------------------------------------------------
    // 作成画面のプレビュー（applyDesignToPreview の後に呼ばれる）
    // ---------------------------------------------------------
    applyToCreator: function () {
        const preview = document.getElementById('creator-monitor-preview');
        if (!preview) return;
        const C = window.App.Creator;
        const d = window.App.Data.currentDesign || {};
        const t = (C && C.currentType) || '';
        this.migrate(d);
        this.clear(preview);
        this.renderCreatorPhoto(d);
        const frameEditing = window.App.LayoutEditor && window.App.LayoutEditor.isFrameEditing();
        if (frameEditing || (C && C._previewRevealOn)) return;
        this.applyVars(preview, d);
        if (d.bgFx === 'studio' && !d.bgImage) preview.style.backgroundImage = this.studioBg(d.mainBgColor);
        if (d.stageFrame) {
            preview.classList.add('cs-framed');
            preview.setAttribute('data-frame-title', d.frameTitle || (C && C.editingTitle) || 'お題');
        }
        if (d.qSkin) {
            preview.classList.add('qskin-' + d.qSkin);
            // 問題文の色は入力欄に直接書かれているので、地の色で読める色に差し替える
            const qt = document.getElementById('question-text');
            if (qt && d.qTextColor !== 'transparent') qt.style.setProperty('color', this.readable(d.qSkin === 'caption' ? '#ffffff' : this.qSolidBg(d), d.qTextColor), 'important');
            const qa = document.getElementById('creator-monitor-q-area');
            if (qa) {
                let tag = qa.querySelector(':scope > .qs-num');
                if (d.qNumBadge === false) tag?.remove();
                else {
                    if (!tag) { tag = document.createElement('span'); tag.className = 'qs-num'; qa.insertBefore(tag, qa.firstChild); }
                    const idx = (C && C.editingIndex !== null && C.editingIndex !== undefined && C.editingIndex >= 0)
                        ? C.editingIndex : ((window.App.Data.createdQuestions || []).length);
                    tag.textContent = d.qSkin === 'board' ? `第${idx + 1}問` : `Q${idx + 1}`;
                }
            }
        } else {
            document.querySelector('#creator-monitor-q-area > .qs-num')?.remove();
        }
        const isChoice = t.startsWith('choice') && !(C && C.oxMode) && t !== 'choice_dobon';
        if (!isChoice || !d.cSkin) return;
        preview.classList.add('cskin', 'cskin-' + d.cSkin);
        if (d.cPalette === 'four') preview.classList.add('cpal-four');
        document.querySelectorAll('#creator-form-container .choice-row').forEach((row, i) => {
            row.style.setProperty('--cs-btn', this.btnColor(d, i));
            const inp = row.querySelector('.choice-text-input');
            const card = this.isFaint(d.cBgColor) ? '#ffffff' : d.cBgColor;
            if (inp) inp.style.setProperty('color', d.cSkin === 'card' ? this.readable(card, d.cTextColor) : '#ffffff', 'important');
            const lab = row.querySelector('.choice-label-text');
            if (lab) { lab.style.color = ''; lab.style.textShadow = ''; }
        });
    },

    // 作成画面: 写真＋字幕の時は、問題の枠の中に写真の場所を出す（押すと写真を選べる）
    // 作成画面の写真は問題文の枠の中の画像（App.QuestionImage の #qimg-inline）に一本化した
    renderCreatorPhoto: function () {
        document.getElementById('cs-photo')?.remove();
    },

    // デザインのパネル（テーマのタブ）に出す設定
    panelHtml: function (design) {
        const btn = (key, v, label) => {
            const on = (design[key] || '') === v;
            return `<button type="button" data-cs-key="${key}" data-cs-val="${v}" style="flex:1; min-width:0; padding:7px 2px; border-radius:7px; cursor:pointer; font-size:0.68rem; font-weight:bold; white-space:nowrap;
                background:${on ? 'rgba(245, 158, 11,0.12)' : '#1b1b20'}; border:1px solid ${on ? '#f59e0b' : '#3a3a42'}; color:${on ? '#f59e0b' : '#e5e5e8'};">${label}</button>`;
        };
        const chk = (key, label, def) => {
            const on = design[key] === undefined ? def : !!design[key];
            return `<label style="display:flex; align-items:center; gap:6px; color:#c9c9cf; font-size:0.72rem; cursor:pointer;">
                <input type="checkbox" data-cs-chk="${key}" ${on ? 'checked' : ''} style="width:auto; height:auto; min-height:0; margin:0; accent-color:#f59e0b;">${label}</label>`;
        };
        const rows = parseInt(design.gridRows) || 0, cols = parseInt(design.gridCols) || 0;
        const arr = (rows === 2 && cols === 2) ? 'g22' : (rows === 1 && cols >= 3) ? 'row' : '';
        const arrBtn = (v, label) => `<button type="button" data-cs-arrange="${v}" style="flex:1; padding:7px 2px; border-radius:7px; cursor:pointer; font-size:0.68rem; font-weight:bold;
            background:${arr === v ? 'rgba(245, 158, 11,0.12)' : '#1b1b20'}; border:1px solid ${arr === v ? '#f59e0b' : '#3a3a42'}; color:${arr === v ? '#f59e0b' : '#e5e5e8'};">${label}</button>`;
        const head = (t) => `<div style="margin:12px 0 6px; color:#8b8b95; font-size:0.7rem; font-weight:bold;">${t}</div>`;
        return `
            ${head('選択肢ボタンの形')}
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px;">${this.SKINS.map(s => btn('cSkin', s.id, s.name)).join('')}</div>
            <div style="display:flex; gap:5px; margin-top:6px;">${btn('cPalette', '', 'テーマ色')}${btn('cPalette', 'four', '4色に色分け')}</div>
            <div style="display:flex; gap:5px; margin-top:6px;">${arrBtn('', '縦1列')}${arrBtn('g22', '2×2')}${arrBtn('row', '横1列')}</div>
            ${head('問題文の見せ方')}
            <div style="display:flex; gap:5px;">${this.Q_SKINS.map(s => btn('qSkin', s.id, s.name)).join('')}</div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                ${chk('qNumBadge', 'テロップ・ボードに問題番号を出す', true)}
                ${chk('stageFrame', '画面の外枠と上の帯を付ける', false)}
                ${chk('bgFx', 'スタジオ照明の背景', false)}
            </div>
            ${design.stageFrame ? `
                <div style="display:flex; gap:6px; margin-top:8px;">
                    <input type="text" data-key="frameTitle" value="${this.esc(design.frameTitle || '')}" placeholder="上の帯の文字（空欄ならセット名）" style="
                        flex:1; min-width:0; height:32px; padding:0 8px; background:#1b1b20; border:1px solid #3a3a42; border-radius:6px; color:#fff; box-sizing:border-box;">
                    <button type="button" data-color-swatch-key="frameColor" data-color-swatch-label="枠の色" style="flex:0 0 auto; padding:0 10px; border-radius:6px; background:#1b1b20; border:1px solid #3a3a42; color:#e5e5e8; font-size:0.7rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                        <span style="width:14px; height:14px; border-radius:3px; background:${design.frameColor || this.accent(design)}; border:1px solid #fff3;"></span>枠の色</button>
                </div>` : ''}
            <p style="color:#555; font-size:0.62rem; margin:6px 0 0;">ボタンの形は選択式だけに効きます</p>`;
    },

    wirePanel: function (body, design, onChange, renderBody) {
        body.querySelectorAll('button[data-cs-key]').forEach(b => {
            b.onclick = () => { design[b.dataset.csKey] = b.dataset.csVal; if (onChange) onChange(); renderBody(); };
        });
        body.querySelectorAll('input[data-cs-chk]').forEach(c => {
            c.onchange = () => {
                const k = c.dataset.csChk;
                design[k] = k === 'bgFx' ? (c.checked ? 'studio' : '') : c.checked;
                if (onChange) onChange();
                if (k === 'stageFrame') renderBody();
            };
        });
        body.querySelectorAll('button[data-cs-arrange]').forEach(b => {
            b.onclick = () => {
                const v = b.dataset.csArrange;
                if (v === 'g22') { design.gridRows = '2'; design.gridCols = '2'; }
                else if (v === 'row') { design.gridRows = '1'; design.gridCols = '4'; }
                else { design.gridRows = ''; design.gridCols = ''; }
                if (onChange) onChange();
                renderBody();
            };
        });
    },

    // テーマ選択のカードの小さな見本（ボタンの形が分かるように）
    miniHtml: function (t) {
        const c = t.colors, sk = t.skin || {};
        const accent = t.accent;
        const col = (i) => sk.pal === 'four' ? this.FOUR[i] : accent;
        const q = sk.q === 'caption'
            ? `<div style="width:86%; border-radius:3px; overflow:hidden; background:${this.isFaint(c.qBgColor) ? '#f2efdc' : c.qBgColor};"><div style="height:9px;"></div><div style="background:#fff; color:#222; font-size:0.5rem; font-weight:bold; text-align:center;">お題</div></div>`
            : sk.q === 'telop'
            ? `<div style="width:100%; padding:2px 0; text-align:center; background:${this.isFaint(c.qBgColor) ? '#0d1626' : c.qBgColor}; border-top:1.5px solid ${accent}; border-bottom:1.5px solid ${accent}; color:${c.qTextColor}; font-size:0.56rem; font-weight:bold;">第1問</div>`
            : sk.q === 'board'
                ? `<div style="width:86%; border-radius:3px; overflow:hidden; background:${this.isFaint(c.qBgColor) ? '#fff' : c.qBgColor};"><div style="height:3px; background:${accent};"></div><div style="padding:1px 0; text-align:center; color:${c.qTextColor}; font-size:0.56rem; font-weight:bold;">第1問</div></div>`
                : `<div style="width:86%; padding:2px 0; text-align:center; border:1.5px solid ${c.qBorderColor}; background:${c.qBgColor}; color:${c.qTextColor}; font-size:0.56rem; font-weight:bold; border-radius:3px;">第1問</div>`;
        const one = (i) => {
            if (sk.c === 'button') return `<div style="flex:1; height:9px; border-radius:2px; background:linear-gradient(${col(i)}, color-mix(in srgb, ${col(i)} 65%, #000)); box-shadow:0 1.5px 0 #0006;"></div>`;
            if (sk.c === 'panel') return `<div style="flex:1; height:9px; border-radius:1px; background:linear-gradient(#2b3445, #0b0b0d); border:1px solid ${col(i)}; border-left:4px solid ${col(i)};"></div>`;
            if (sk.c === 'capsule') return `<div style="flex:1; height:9px; clip-path:polygon(12% 0, 88% 0, 100% 50%, 88% 100%, 12% 100%, 0 50%); background:${col(i)}; padding:1px;"><div style="height:100%; clip-path:inherit; background:#0b1430;"></div></div>`;
            if (sk.c === 'card') return `<div style="flex:1; height:9px; border-radius:2px; background:${this.isFaint(c.cBgColor) ? '#fff' : c.cBgColor}; border-left:4px solid ${col(i)}; box-shadow:0 1px 2px #0004;"></div>`;
            return `<div style="flex:1; height:9px; border:1px solid ${c.cBorderColor}; background:${c.cBgColor}; border-radius:2px;"></div>`;
        };
        return `${q}<div style="display:flex; gap:3px; width:86%;">${one(0)}${one(1)}</div><div style="display:flex; gap:3px; width:86%;">${one(2)}${one(3)}</div>`;
    },
};

(function hookChoiceSkin() {
    const C = window.App.Creator;
    if (!C) return;
    const after = (name, fn) => {
        const orig = C[name];
        if (typeof orig !== 'function') return;
        C[name] = function () {
            const r = orig.apply(this, arguments);
            try { fn.apply(this, arguments); } catch (e) { console.warn('choice_skin hook', name, e); }
            return r;
        };
    };
    after('applyDesignToPreview', function () { App.ChoiceSkin.applyToCreator(); });
    after('renderForm', function () { setTimeout(() => App.ChoiceSkin.applyToCreator(), 0); });
    after('setPreviewSlide', function () { App.ChoiceSkin.applyToCreator(); });
    const QI = window.App.QuestionImage;
    if (QI && typeof QI.renderControl === 'function') {
        const orig = QI.renderControl.bind(QI);
        QI.renderControl = function () { const r = orig(); try { App.ChoiceSkin.applyToCreator(); } catch (e) { /* noop */ } return r; };
    }
})();
