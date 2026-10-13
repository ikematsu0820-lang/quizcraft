/* =========================================================
 * variety_frame.js — 「バラエティ枠」の画面型
 *
 * テレビのバラエティ番組のように、画面の枠を固定して、その中で
 *   ブリッジ（Q1）→ 写真と名前 → カウントダウン → 押したボタンが光る
 *   → 答えを大きく表示し、押したボタンに〇／×のスタンプ
 * と切り替える。デザインの design.layoutTemplate === 'frame' で有効
 * （選択式のみ。ほかの形式は通常の画面のまま）。
 *
 * 問題ごとの写真（q.image）もここで扱う — 作成画面での追加・
 * 保存時の画像まとめ（App.SetImages）・通常の画面での表示。
 * =======================================================*/

window.App = window.App || {};

App.VarietyFrame = {
    BUTTON_COLORS: ['#d62828', '#1e40c8', '#14935a', '#d99a00', '#8e2bd1', '#0e8f9a'],

    esc: function (v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    applies: function (q) {
        if (!q || q.type !== 'choice') return false;
        if (q.mode === 'dobon' || q.mode === 'multi' || q.multi) return false;
        return ((q.design || {}).layoutTemplate === 'frame') && Array.isArray(q.c) && q.c.length > 0;
    },

    correctSet: function (q) {
        if (q.multiCorrect && Array.isArray(q.correct)) return new Set(q.correct.map(Number));
        const c = q.correctIndex !== undefined ? q.correctIndex : (Array.isArray(q.correct) ? q.correct[0] : q.correct);
        const n = parseInt(c);
        return new Set(isNaN(n) ? [] : [n]);
    },

    // 画面に注目させる「押された答え」— 1人が答える形式（早押し・指名・
    // 順番・ソロ）なら、その人の答え。全員同時なら null（人数を出す）
    focusAnswer: function (st, players) {
        const id = st && st.currentAnswerer;
        if (!id || !players || !players[id]) return null;
        const a = players[id].lastAnswer;
        if (a === null || a === undefined || a === '') return null;
        const n = parseInt(Array.isArray(a) ? a[0] : a);
        return isNaN(n) ? null : n;
    },

    counts: function (q, players) {
        const out = new Array(q.c.length).fill(0);
        Object.values(players || {}).forEach(p => {
            if (!p || p.lastAnswer === null || p.lastAnswer === undefined) return;
            const n = parseInt(p.lastAnswer);
            if (!isNaN(n) && n >= 0 && n < out.length) out[n]++;
        });
        return out;
    },

    // phase: 'bridge' | 'question' | 'answer'
    render: function (container, contentBox, q, st, phase, opts = {}) {
        if (!contentBox) return;
        const d = q.design || {};
        const e = (v) => this.esc(v);
        const st0 = st || {};
        const players = opts.players || (window.App.Viewer && window.App.Viewer._players) || {};
        if (container) {
            container.style.backgroundColor = d.mainBgColor || '#f4eef2';
            container.style.backgroundImage = d.bgImage ? `url(${d.bgImage})` : 'none';
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
        }
        const title = d.frameTitle || st0.programTitle || opts.title || (window.App.Creator && window.App.Creator.editingTitle) || '';
        const qIndex = (st0.qIndex || 0);
        const label = opts.label || st0.qNumLabel || `Q${qIndex + 1}`;
        const corr = this.correctSet(q);
        const focus = this.focusAnswer(st0, players);
        const isAnswer = phase === 'answer';
        // 全員同時の時は、各ボタンを選んだ人数を出す（誰も答えていなければ出さない）
        let counts = isAnswer && focus === null ? this.counts(q, players) : null;
        if (counts && !counts.some(n => n > 0)) counts = null;
        const correctIdx = [...corr][0];
        const correctText = correctIdx !== undefined ? (q.c[correctIdx] || '') : '';
        const correctColor = this.BUTTON_COLORS[(correctIdx || 0) % this.BUTTON_COLORS.length];

        const buttons = q.c.map((text, i) => {
            const color = this.BUTTON_COLORS[i % this.BUTTON_COLORS.length];
            const lit = focus === i;
            let stamp = '';
            if (isAnswer) {
                if (focus !== null && focus === i) stamp = corr.has(i) ? 'ok' : 'ng';
                else if (focus === null && corr.has(i)) stamp = 'ok';
            }
            const count = counts ? `<span class="vf-count">${counts[i]}人</span>` : '';
            return `<div class="vf-btn${lit ? ' vf-lit' : ''}" data-i="${i}" style="--vf-btn:${color};">
                <span class="vf-btn-text">${e(text)}</span>${count}
                ${stamp ? `<span class="vf-stamp vf-stamp-${stamp}"></span>` : ''}
            </div>`;
        }).join('');

        const showImage = phase !== 'bridge' && q.image;
        contentBox.innerHTML = `
            <div class="vf vf-phase-${phase}" style="--vf-frame:${d.frameColor || '#c9c94a'}; --vf-stage:${d.qBgColor && d.qBgColor !== 'transparent' && !String(d.qBgColor).startsWith('rgba') ? d.qBgColor : '#f2efdc'}; --vf-text:${d.qTextColor || '#222'};">
                <div class="vf-title">${e(title)}</div>
                <div class="vf-stage">
                    ${showImage ? `<img class="vf-img" src="${q.image}" alt="">` : ''}
                    ${phase === 'bridge' ? `<div class="vf-qnum">${e(label)}</div>` : ''}
                    ${isAnswer && correctText ? `<div class="vf-reveal" style="color:${correctColor};">${e(correctText)}</div>` : ''}
                </div>
                <div class="vf-caption">${phase === 'bridge' ? '' : e(q.q || '')}</div>
                <div class="vf-buttons" style="grid-template-columns:repeat(${Math.min(q.c.length, 4)}, 1fr);">${buttons}</div>
            </div>`;
        contentBox.style.flexDirection = '';
        contentBox.style.justifyContent = '';
        contentBox.style.alignItems = '';
        if (container) container.classList.add('vf-on');
    },

    // 答えている間に、答えた人のボタンだけ光らせる（描き直さない）
    updateLive: function (st, players, q) {
        if (!q || !this.applies(q)) return;
        const root = document.querySelector('#viewer-content .vf');
        if (!root || root.classList.contains('vf-phase-answer') || root.classList.contains('vf-phase-bridge')) return;
        const focus = this.focusAnswer(st, players);
        root.querySelectorAll('.vf-btn').forEach(b => b.classList.toggle('vf-lit', focus !== null && parseInt(b.dataset.i) === focus));
    },

    // 通常の画面でも、問題に写真があれば問題文の上に出す
    injectImage: function (contentBox, q) {
        if (!contentBox || !q || !q.image || this.applies(q)) return;
        if (contentBox.querySelector('.q-photo')) return;
        const area = contentBox.querySelector('.q-area') || contentBox.firstElementChild;
        if (!area) return;
        const img = document.createElement('img');
        img.className = 'q-photo';
        img.src = q.image;
        img.alt = '';
        area.insertBefore(img, area.firstChild);
    },
};

/* ---------------------------------------------------------
 * 問題ごとの写真を、保存・配信の時に1か所へまとめる
 * （背景画像と同じく '@img:N' の参照にして、同じ画像は1回だけ送る）
 * ------------------------------------------------------- */
(function extendSetImages() {
    const SI = window.App.SetImages;
    if (!SI || SI._qImagePatched) return;
    SI._qImagePatched = true;
    const origPack = SI.pack.bind(SI);
    const origUnpack = SI.unpack.bind(SI);
    SI.pack = function (questions) {
        const r = origPack(questions);
        const indexOf = {};
        r.images.forEach((v, i) => { indexOf[v] = i; });
        r.questions = r.questions.map(q => {
            if (!q || typeof q.image !== 'string' || !q.image.startsWith('data:')) return q;
            if (indexOf[q.image] === undefined) { indexOf[q.image] = r.images.length; r.images.push(q.image); }
            return { ...q, image: SI.PREFIX + indexOf[q.image] };
        });
        return r;
    };
    SI.unpack = function (questions, images) {
        const list = origUnpack(questions, images);
        if (!images) return list;
        const imgs = Array.isArray(images) ? images : Object.values(images);
        return list.map(q => {
            const idx = q ? SI.refIndex(q.image) : -1;
            return idx >= 0 ? { ...q, image: imgs[idx] || '' } : q;
        });
    };
})();

/* ---------------------------------------------------------
 * 作成画面：問題ごとの写真と「次の問題も同じ選択肢」
 * ------------------------------------------------------- */
App.QuestionImage = {
    current: null, // 編集中の問題の写真（data URL）

    supports: function () {
        const t = (window.App.Creator && window.App.Creator.currentType) || '';
        return !!t && t !== 'numgame' && t !== 'blackjack';
    },

    renderControl: function () {
        const box = document.getElementById('creator-outside-opts');
        if (!box) return;
        box.querySelector('.qimg-ctl')?.remove();
        if (!this.supports()) return;
        const wrap = document.createElement('div');
        wrap.className = 'qimg-ctl';
        const has = !!this.current;
        wrap.innerHTML = `
            ${has ? `<img class="qimg-thumb" src="${this.current}" alt="">` : ''}
            <button type="button" class="qimg-pick">${has ? '写真を変える' : '写真を付ける'}</button>
            ${has ? '<button type="button" class="qimg-clear">外す</button>' : ''}
            <input type="file" accept="image/*" class="qimg-input" style="display:none !important;">`;
        box.appendChild(wrap);
        box.classList.remove('hidden');
        const input = wrap.querySelector('.qimg-input');
        wrap.querySelector('.qimg-pick').onclick = () => input.click();
        input.onchange = (ev) => {
            const f = ev.target.files[0];
            if (!f) return;
            const done = (url) => { this.current = url; this.renderControl(); window.App.CreatorMobile && window.App.CreatorMobile.renderSheetStage && window.App.CreatorMobile.renderSheetStage(); };
            if (window.App.Themes && window.App.Themes.compressImage) window.App.Themes.compressImage(f, 1000, 1000, 0.8).then(done);
            else { const r = new FileReader(); r.onload = (x) => done(x.target.result); r.readAsDataURL(f); }
        };
        const clr = wrap.querySelector('.qimg-clear');
        if (clr) clr.onclick = () => { this.current = null; this.renderControl(); };
    },
};

(function hookCreatorForImages() {
    const C = window.App.Creator;
    if (!C) return;
    const after = (name, fn) => {
        const orig = C[name];
        if (typeof orig !== 'function') return;
        C[name] = function () {
            const r = orig.apply(this, arguments);
            try { const v = fn.call(this, r, arguments); if (v !== undefined) return v; } catch (e) { console.warn('variety_frame hook', name, e); }
            return r;
        };
    };
    const QI = App.QuestionImage;
    after('getData', function (q) {
        if (q) q.image = QI.current || null; // null で、外した写真も消える
        return q;
    });
    after('_readFormDataForPreview', function (q) {
        if (q) q.image = QI.current || null;
        return q;
    });
    after('edit', function (_, args) {
        const q = (window.App.Data.createdQuestions || [])[args[0]];
        QI.current = (q && q.image) || null;
        QI.renderControl();
    });
    after('resetForm', function () { QI.current = null; QI.renderControl(); });
    after('init', function () { QI.current = null; });
    after('renderForm', function () { QI.renderControl(); });
})();
