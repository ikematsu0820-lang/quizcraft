/* =========================================================
 * item_image.js — 選択肢・並べ替え・多答・連想・パネルの小枠の画像
 *
 *   作成画面: 各行の中に画像のボタン（無ければ「画像」、あれば縮小画像）。
 *             画像は行の要素に持たせ（row._img）、保存する時に文字のある行の順に集める
 *             → q.cImg（q.c と同じ並び）。パネルは panel_board.js が panels[].img に入れる
 *   見せ方:   見た目の「選択肢」の「画像の見せ方（画像と文字／画像だけ）」「画像の大きさ」
 *             （design.cImgMode / cImgSize）。モニターは viewer.js の描画の後に足す
 * 文字は必須のまま（正解発表・結果で使う）。「画像だけ」はモニターで文字を隠すだけ。
 * =======================================================*/

window.App = window.App || {};

App.ItemImage = {
    // 形式ごとの行と入力欄
    ROWS: {
        choice: ['.choice-row', '.choice-text-input'],
        sort: ['.sort-row', '.sort-text-input'],
        multi: ['.multi-row', '.multi-text-input'],
        assoc: ['.assoc-row', '.assoc-text-input'],
    },

    kind: function (type) {
        const t = type || '';
        if (t === 'sort') return 'sort';
        if (t.startsWith('multi') || t.startsWith('ranking')) return 'multi';
        if (t.startsWith('assoc')) return 'assoc';
        if (t.startsWith('choice')) return 'choice';
        return null;
    },

    // 今の作成画面で行に画像を入れられるか（まるばつ・パネル指名は別）
    supports: function () {
        const C = window.App.Creator;
        const k = this.kind(C && C.currentType);
        if (!k) return false;
        if (k === 'choice' && C.oxMode) return false;
        const PB = window.App.PanelBoard;
        if (k === 'multi' && PB && PB.active) return false;
        return true;
    },

    rows: function () {
        const C = window.App.Creator;
        const k = this.kind(C && C.currentType);
        return k ? [...document.querySelectorAll(`#creator-form-container ${this.ROWS[k][0]}`)] : [];
    },

    // 共通のファイル選択（行ごとに作らない）
    _input: null,
    pick: function (onDone) {
        if (!this._input) {
            this._input = document.createElement('input');
            this._input.type = 'file';
            this._input.accept = 'image/*';
            this._input.style.display = 'none';
            document.body.appendChild(this._input);
        }
        const input = this._input;
        input.value = '';
        input.onchange = (ev) => {
            const f = ev.target.files[0];
            if (!f) return;
            // 小枠に出すだけなので、問題文の画像より小さく縮めて軽くする
            if (window.App.Themes && window.App.Themes.compressImage) window.App.Themes.compressImage(f, 600, 600, 0.8).then(onDone);
            else { const r = new FileReader(); r.onload = (x) => onDone(x.target.result); r.readAsDataURL(f); }
        };
        input.click();
    },

    // 行に画像のボタンを付ける（before … このボタンの前に置く。無ければ行の最後）
    decorateRow: function (row, before, frame) {
        if (!row) return;
        let btn = row.querySelector('.cimg-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cimg-btn';
            btn.onclick = (e) => {
                e.stopPropagation();
                this.pick((url) => { row._img = url; this.decorateRow(row); this.changed(); });
            };
            const host = before ? before.parentNode : (frame || row);
            host.insertBefore(btn, before || null);
        }
        const has = !!row._img;
        btn.classList.toggle('has', has);
        btn.title = has ? '画像を変える' : '画像を入れる';
        btn.innerHTML = has
            ? `<img src="${row._img}" alt=""><span class="cimg-x" title="画像を外す">×</span>`
            : (window.App.Icons ? window.App.Icons.svg('image', 16) : '画像');
        const x = btn.querySelector('.cimg-x');
        if (x) x.onclick = (e) => { e.stopPropagation(); row._img = null; this.decorateRow(row); this.changed(); };
    },

    // 選択肢などの行の、正解のチェックや × の前に置く
    decorateAll: function () {
        // 使えない時（まるばつ等）は行の画像ボタンを外す（パネルの行のボタンは panel_board.js が持つので触らない）
        if (!this.supports()) { document.querySelectorAll('#creator-form-container :is(.choice-row, .sort-row, .multi-row, .assoc-row) .cimg-btn').forEach(b => b.remove()); return; }
        this.rows().forEach(row => {
            if (row.querySelector('.cimg-btn')) { this.decorateRow(row); return; }
            const frame = row.querySelector('.choice-frame, .row-frame') || row;
            const before = frame.querySelector(':scope > .choice-correct-chk, :scope > .sort-order-input, :scope > [class^="btn-remove"]');
            this.decorateRow(row, before, frame);
        });
    },

    changed: function () {
        const C = window.App.Creator;
        if (window.App.CreatorMobile && window.App.CreatorMobile.renderSheetStage) window.App.CreatorMobile.renderSheetStage();
        if (window.App.CreatorDraft) window.App.CreatorDraft.saveSoon();
        if (C && C._previewRevealOn && C.renderPreviewReveal) C.renderPreviewReveal();
    },

    // 文字のある行の順に画像を集める（q.c と同じ並び）。1枚も無ければ null
    collect: function (keepEmpty) {
        const C = window.App.Creator;
        const k = this.kind(C && C.currentType);
        if (!k || !this.supports()) return null;
        const sel = this.ROWS[k][1];
        const out = [];
        this.rows().forEach(row => {
            const txt = (row.querySelector(sel)?.value || '').trim();
            if (txt || keepEmpty) out.push(row._img || null);
        });
        return out.some(Boolean) ? out : null;
    },

    // 保存済みの問題を開いた時: q.cImg を行に戻す（行は q.c の順に作られている）
    restore: function (data) {
        const imgs = data && Array.isArray(data.cImg) ? data.cImg : [];
        this.rows().forEach((row, i) => { row._img = imgs[i] || null; });
    },
};

// 作成画面のフック
(function hookCreatorForItemImages() {
    const C = window.App.Creator;
    if (!C) return;
    const II = App.ItemImage;
    const after = (name, fn) => {
        const orig = C[name];
        if (typeof orig !== 'function') return;
        C[name] = function () {
            const r = orig.apply(this, arguments);
            try { const v = fn.call(this, r, arguments); if (v !== undefined) return v; } catch (e) { console.warn('item_image hook', name, e); }
            return r;
        };
    };
    after('renderForm', function (_, args) { II.restore(args[1]); II.decorateAll(); });
    ['addChoiceInput', 'addSortInput', 'addMultiInput', 'addAssocInput'].forEach(n => after(n, function () { II.decorateAll(); }));
    after('getData', function (q) {
        if (!q || II.kind(q.type) !== II.kind(C.currentType)) return q;
        q.cImg = II.collect(false);
        return q;
    });
    after('_readFormDataForPreview', function (q) {
        if (!q || II.kind(q.type) !== II.kind(C.currentType)) return q;
        q.cImg = II.collect(false);
        return q;
    });
})();

// ---------------------------------------------------------
// モニター（viewer.js の描画の後）— 選択肢などの小枠に画像を足す
// ---------------------------------------------------------
App.ItemImage.injectViewer = function (contentBox, q) {
    if (!contentBox || !q || !Array.isArray(q.cImg) || !q.cImg.some(Boolean)) return;
    const area = contentBox.querySelector('.c-area');
    if (!area) return;
    const d = q.design || {};
    const items = [...area.querySelectorAll(':scope > .choice-item')];
    if (!items.length) return;
    const isMultiQ = /^(multi|ranking)/.test(q.type || '');
    area.classList.add('c-has-img');
    area.classList.toggle('c-img-row', isMultiQ); // 多答は横長の帯なので、画像は文字の左に
    area.classList.toggle('c-img-only', d.cImgMode === 'only');
    area.classList.remove('c-img-small', 'c-img-large');
    if (d.cImgSize === 'small' || d.cImgSize === 'large') area.classList.add('c-img-' + d.cImgSize);
    // 配置が自動で縦に1列の時は、画像が並べやすいように横に並べる（4つまでは1行、それ以上は3〜4列）
    const rows = parseInt(d.gridRows) || 0, cols = parseInt(d.gridCols) || 0;
    if (!isMultiQ && !(rows > 0 && cols > 0) && area.style.display !== 'grid') {
        const n = items.length;
        area.style.display = 'grid';
        area.style.gridTemplateColumns = `repeat(${n <= 4 ? n : n <= 6 ? 3 : 4}, 1fr)`;
        area.style.gridAutoRows = 'minmax(0, 1fr)';
        area.style.flex = '1 1 auto';
        area.style.minHeight = '0';
    }
    items.forEach((el, i) => {
        const src = q.cImg[i];
        if (!src || el.querySelector('.c-img')) return;
        const pre = el.querySelector('.choice-prefix');
        const text = [...el.children].filter(c => c !== pre).pop();
        const img = document.createElement('img');
        img.className = 'c-img';
        img.src = src;
        img.alt = '';
        // まだ開いていない答え（多答・連想）は画像も隠す
        if (text && text.style.visibility === 'hidden') img.style.visibility = 'hidden';
        el.insertBefore(img, text || null);
        el.classList.add('has-c-img');
    });
};
