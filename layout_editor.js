/* =========================================================
 * layout_editor.js — 作成画面のプレビューで、画面の型とレイアウトを直接いじる
 *
 * ・画面の型が「バラエティ枠」の時は、作成画面のプレビュー自体を枠の
 *   見た目にする（お題の帯・写真・名前・大きなボタン）。帯の文字は
 *   プレビューの上で直接書き換えられ、写真の場所を押すと写真を選べる。
 * ・問題の枠と回答（選択肢）の枠の境目をドラッグして、大きさの割合を
 *   変えられる（design.splitRatio … 問題側が画面の何％か。未設定＝自動）。
 *   ダブルクリックで自動に戻す。モニター（viewer.js）も同じ割合で描く。
 * ・プレビューの上部に「標準／バラエティ枠」の切り替えを出す（見た目の
 *   パネルを開かなくても、画面の型が分かって変えられるように）。
 * =======================================================*/

window.App = window.App || {};

App.LayoutEditor = {
    MIN: 15,
    MAX: 80,

    design: function () { return window.App.Data.currentDesign || {}; },
    C: function () { return window.App.Creator; },

    isFrameEditing: function () {
        const C = this.C();
        const t = (C && C.currentType) || '';
        return this.design().layoutTemplate === 'frame' && t === 'choice_single' && !(C && C._previewRevealOn);
    },

    // 問題文の位置（上下＝縦に分ける／左右＝横に分ける）
    orientation: function () {
        const d = this.design();
        if (this.isFrameEditing()) return 'column';
        const pos = window.App.Design ? window.App.Design.normalizeLayout(d.layout) : 'top';
        if (pos === 'center') return null; // 選択肢の無い一問一答の中央寄せ
        return (pos === 'left' || pos === 'right') ? 'row' : 'column';
    },

    // 枠のボタンの高さ（ステージの高さに対する％）— 割合が未設定なら22
    frameButtonsPct: function (d) {
        const r = Number(d.splitRatio);
        return r ? Math.max(12, Math.min(45, (100 - r) * 0.9)) : 22;
    },

    // ---------------------------------------------------------
    // 作成画面のプレビューに反映（applyDesignToPreview の後に呼ばれる）
    // ---------------------------------------------------------
    applyToCreator: function () {
        const preview = document.getElementById('creator-monitor-preview');
        const flex = document.getElementById('creator-monitor-flexwrap');
        const qArea = document.getElementById('creator-monitor-q-area');
        const form = document.getElementById('creator-form-container');
        if (!preview || !flex || !qArea || !form) return;
        const d = this.design();
        const M = window.App.CreatorMobile;
        const mobileForm = M && M.isMobile() && M.screen === 'edit';

        // バラエティ枠
        const frame = this.isFrameEditing() && !mobileForm;
        preview.classList.toggle('cvf', frame);
        let title = document.getElementById('cvf-title');
        let photo = document.getElementById('cvf-photo');
        if (frame) {
            if (!title) {
                title = document.createElement('input');
                title.id = 'cvf-title';
                title.type = 'text';
                title.oninput = () => { this.design().frameTitle = title.value; App.CreatorDraft && App.CreatorDraft.saveSoon(); };
                flex.insertBefore(title, flex.firstChild);
            }
            title.placeholder = (this.C().editingTitle || '').trim() || 'お題（上の帯の文字）';
            if (document.activeElement !== title) title.value = d.frameTitle || '';
            if (!photo) {
                photo = document.createElement('div');
                photo.id = 'cvf-photo';
                photo.onclick = () => document.querySelector('#creator-outside-opts .qimg-input')?.click();
                flex.insertBefore(photo, qArea);
            }
            const img = window.App.QuestionImage && window.App.QuestionImage.current;
            photo.innerHTML = img ? `<img src="${img}" alt="">` : '<span>写真を付ける</span>';
            photo.classList.toggle('has-img', !!img);
            preview.style.setProperty('--cvf-frame', d.frameColor || '#c9c94a');
            preview.style.setProperty('--cvf-stage', (d.qBgColor && !String(d.qBgColor).startsWith('rgba') && d.qBgColor !== 'transparent') ? d.qBgColor : '#f2efdc');
            preview.style.setProperty('--cvf-bg', d.mainBgColor || '#f4eef2');
            const list = document.getElementById('creator-choices-list');
            if (list) {
                const n = list.querySelectorAll('.choice-row').length || 2;
                list.style.setProperty('grid-template-columns', `repeat(${Math.min(n, 4)}, 1fr)`, 'important');
            }
            form.style.flex = `0 0 ${this.frameButtonsPct(d)}%`;
            qArea.style.flex = '';
            // 文字色・大きさはデザインの設定が直接書き込まれているので、枠の見た目用に上書き
            const qt = document.getElementById('question-text');
            if (qt) {
                qt.style.setProperty('color', d.qTextColor && d.qTextColor !== '#ffffff' && d.qTextColor !== '#fff' ? d.qTextColor : '#222', 'important');
                qt.style.setProperty('font-size', 'clamp(0.8rem, 1.8vw, 1.2rem)', 'important');
                qt.style.setProperty('text-align', 'center', 'important');
            }
            form.querySelectorAll('.choice-text-input').forEach(inp => {
                inp.style.setProperty('color', '#fff', 'important');
                inp.style.setProperty('font-size', 'clamp(0.85rem, 2.2vw, 1.5rem)', 'important');
                inp.style.setProperty('text-align', 'center', 'important');
            });
        } else {
            title?.remove();
            photo?.remove();
            form.style.flex = '';
            // 問題の枠と回答の枠の割合
            const ori = this.orientation();
            const r = Number(d.splitRatio);
            if (r && ori && !mobileForm) {
                qArea.style.flex = `0 0 ${r}%`;
                qArea.style.maxHeight = ori === 'column' ? `${r}%` : '';
                qArea.style.minHeight = '0';
                qArea.style.overflow = 'hidden';
                form.style.flex = '1 1 0';
                form.style.minHeight = '0';
            } else {
                qArea.style.flex = '';
                qArea.style.maxHeight = '';
                qArea.style.overflow = '';
                form.style.minHeight = '';
            }
        }
        this.renderDivider();
        this.renderTemplateSwitch();
    },

    // ---------------------------------------------------------
    // 境目のつまみ（ドラッグで割合を変える）
    // ---------------------------------------------------------
    renderDivider: function () {
        const preview = document.getElementById('creator-monitor-preview');
        const flex = document.getElementById('creator-monitor-flexwrap');
        const qArea = document.getElementById('creator-monitor-q-area');
        const form = document.getElementById('creator-form-container');
        if (!preview || !flex || !qArea || !form) return;
        let bar = document.getElementById('layout-divider');
        const M = window.App.CreatorMobile;
        const ori = this.orientation();
        const C = this.C();
        const hide = !ori || (M && M.isMobile() && M.screen === 'edit') || (C && C.previewSlide !== 'question') || (C && C._previewRevealOn);
        if (hide) { bar?.remove(); return; }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'layout-divider';
            bar.title = 'ドラッグで問題と回答の大きさを変える（ダブルクリックで自動）';
            bar.innerHTML = '<span class="ld-grip"></span><span class="ld-tip"></span>';
            preview.appendChild(bar);
            this.wireDivider(bar);
        }
        bar.classList.toggle('ld-row', ori === 'row');
        // つまみの位置 — 問題側の枠と回答側の枠のあいだ
        const pr = preview.getBoundingClientRect();
        const a = (this.isFrameEditing() ? form : qArea).getBoundingClientRect();
        if (ori === 'row') {
            const qr = qArea.getBoundingClientRect(), fr = form.getBoundingClientRect();
            const x = qr.right <= fr.left + 2 ? (qr.right + fr.left) / 2 : (fr.right + qr.left) / 2;
            bar.style.left = `${x - pr.left}px`;
            bar.style.top = '';
        } else if (this.isFrameEditing()) {
            bar.style.top = `${a.top - pr.top - 3}px`;
            bar.style.left = '';
        } else {
            const qr = qArea.getBoundingClientRect(), fr = form.getBoundingClientRect();
            const y = qr.bottom <= fr.top + 2 ? (qr.bottom + fr.top) / 2 : (fr.bottom + qr.top) / 2;
            bar.style.top = `${y - pr.top}px`;
            bar.style.left = '';
        }
        const r = Number(this.design().splitRatio);
        bar.querySelector('.ld-tip').textContent = r ? `問題 ${Math.round(r)}％` : '自動';
    },

    wireDivider: function (bar) {
        let dragging = false;
        const flex = () => document.getElementById('creator-monitor-flexwrap');
        const onMove = (e) => {
            if (!dragging) return;
            const box = flex().getBoundingClientRect();
            const ori = this.orientation();
            const d = this.design();
            const pos = window.App.Design ? window.App.Design.normalizeLayout(d.layout) : 'top';
            let pct;
            if (ori === 'row') {
                pct = (e.clientX - box.left) / box.width * 100;
                if (pos === 'right') pct = 100 - pct;
            } else {
                pct = (e.clientY - box.top) / box.height * 100;
                if (pos === 'bottom' && !this.isFrameEditing()) pct = 100 - pct;
            }
            d.splitRatio = Math.round(Math.max(this.MIN, Math.min(this.MAX, pct)));
            this.C().applyDesignToPreview();
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            bar.classList.remove('ld-active');
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            App.CreatorDraft && App.CreatorDraft.saveSoon();
            // 見た目のパネルが開いていれば、数字も合わせる
            const C = this.C();
            if (C.activeInlinePanel === 'design') C.renderActivePanelContent('design');
        };
        bar.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            dragging = true;
            bar.classList.add('ld-active');
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
        bar.addEventListener('dblclick', () => {
            delete this.design().splitRatio;
            this.C().applyDesignToPreview();
        });
    },

    // プレビュー上部の「標準／バラエティ枠」切り替え（選択式の時だけ）
    renderTemplateSwitch: function () {
        const bar = document.getElementById('creator-bezel-topbar');
        if (!bar) return;
        let sw = document.getElementById('cvf-switch');
        const C = this.C();
        const show = C && C.currentType === 'choice_single';
        if (!show) { sw?.remove(); return; }
        if (!sw) {
            sw = document.createElement('div');
            sw.id = 'cvf-switch';
            sw.innerHTML = '<button type="button" data-tpl="">標準</button><button type="button" data-tpl="frame">バラエティ枠</button>';
            bar.insertBefore(sw, bar.firstChild);
            sw.querySelectorAll('button').forEach(b => {
                b.onclick = () => {
                    const d = this.design();
                    d.layoutTemplate = b.dataset.tpl;
                    if (d.layoutTemplate === 'frame' && !d.frameColor) d.frameColor = '#c9c94a';
                    this.C().applyDesignToPreview();
                    if (this.C().activeInlinePanel === 'design') this.C().renderActivePanelContent('design');
                    App.CreatorDraft && App.CreatorDraft.saveSoon();
                };
            });
        }
        const cur = this.design().layoutTemplate === 'frame' ? 'frame' : '';
        sw.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tpl === cur));
    },

    // ---------------------------------------------------------
    // モニター（viewer.js）にも同じ割合を反映
    // ---------------------------------------------------------
    applyToViewer: function (contentBox, q) {
        if (!contentBox || !q) return;
        const d = q.design || {};
        const r = Number(d.splitRatio);
        if (!r) return;
        const qa = contentBox.querySelector(':scope > .q-area') || contentBox.querySelector('.q-area');
        const ca = contentBox.querySelector(':scope > .c-area') || contentBox.querySelector('.c-area');
        if (!qa || !ca) return;
        const pos = window.App.Design ? window.App.Design.normalizeLayout(q.layout || d.layout) : 'top';
        if (pos === 'center') return;
        const row = pos === 'left' || pos === 'right';
        // 問題の枠（q-area の外側に包みがある場合はそちら）
        const qBox = qa.parentElement && qa.parentElement !== contentBox ? qa.parentElement : qa;
        qBox.style.flex = `0 0 ${r}%`;
        qBox.style[row ? 'maxWidth' : 'maxHeight'] = `${r}%`;
        qBox.style.minHeight = '0';
        qBox.style.boxSizing = 'border-box';
        qBox.style.overflow = 'hidden';
        if (!row) { qa.style.height = '100%'; qa.style.boxSizing = 'border-box'; }
        ca.style.flex = '1 1 0';
        ca.style.minHeight = '0';
    },
};

(function hookLayoutEditor() {
    const C = window.App.Creator;
    if (!C) return;
    const after = (name, fn) => {
        const orig = C[name];
        if (typeof orig !== 'function') return;
        C[name] = function () {
            const r = orig.apply(this, arguments);
            try { fn.apply(this, arguments); } catch (e) { console.warn('layout_editor hook', name, e); }
            return r;
        };
    };
    after('applyDesignToPreview', function () { App.LayoutEditor.applyToCreator(); });
    after('renderForm', function () { setTimeout(() => App.LayoutEditor.applyToCreator(), 0); });
    after('setPreviewSlide', function () { App.LayoutEditor.applyToCreator(); });
    // 写真を付けた・外した時もプレビューの写真を入れ替える
    const QI = window.App.QuestionImage;
    if (QI && typeof QI.renderControl === 'function') {
        const orig = QI.renderControl.bind(QI);
        QI.renderControl = function () { const r = orig(); try { App.LayoutEditor.applyToCreator(); } catch (e) { /* noop */ } return r; };
    }
    window.addEventListener('resize', () => { try { App.LayoutEditor.renderDivider(); } catch (e) { /* noop */ } });
})();
