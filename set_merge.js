/* =========================================================
 * set_merge.js — 同じ形式の別のセットから、問題を取り込む
 *
 *   作成画面の「別のセットから問題を取り込む」→ 同じ形式の保存済みセットを選ぶ
 *   → 取り込む問題を選ぶ（同じ問題文がある物は知らせて、最初は外しておく）
 *   → 今のセットの最後に足す。
 *   ルールと見た目は取り込み先のまま（保存する時にセットの見た目を全問にそろえる）。
 *   口頭／手書きは取り込み先に合わせる。
 *   パネルクイズ（1セット1盤面）と数字予想は、1セットで1つの遊びなので取り込まない。
 * =======================================================*/

window.App = window.App || {};

App.SetMerge = {
    NAMES: { free: '一問一答', choice: '選択式', dobon: 'ダウト', sort: '並べ替え', multi: '多答', panel: 'パネル指名', assoc: '連想' },

    // 問題の「形式」— これが同じセットどうしだけ取り込める
    family: function (q) {
        if (!q) return null;
        const t = q.type || '';
        if (t === 'blackjack' || t === 'numgame') return 'numgame';
        if (q.panelStyle === 'board') return 'board';
        if (t === 'choice') return (q.mode === 'dobon' || q.mode === 'multi') ? 'dobon' : 'choice';
        if (t === 'sort') return 'sort';
        if (/^free/.test(t) || t === 'letter_select') return 'free';
        if (/^(multi|ranking)/.test(t)) return q.panel ? 'panel' : 'multi';
        if (/^assoc/.test(t)) return 'assoc';
        return null;
    },

    // 一覧の軽い情報（saved_sets_meta.typeCat）での大まかな分類
    CAT_OF: { free: 'free', choice: 'choice', dobon: 'choice', sort: 'sort', multi: 'multi', panel: 'multi', assoc: 'assoc' },

    currentFamily: function () {
        const real = (window.App.Data && window.App.Data.createdQuestions) || [];
        const real0 = real.find(q => q && q.type);
        if (real0) return this.family(real0);
        const C = window.App.Creator;
        const qs = C && C.effectiveQuestionsForRestrictions ? C.effectiveQuestionsForRestrictions() : [];
        return this.family(qs[0]);
    },

    esc: function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

    // 重ねる画面（形式選択の遊び方と同じ見た目）
    overlay: function (title, inner) {
        this.close();
        const ov = document.createElement('div');
        ov.id = 'sm-overlay';
        ov.innerHTML = `
            <div class="ps-panel sm-panel" role="dialog" aria-label="${this.esc(title)}">
                <div class="ps-head">
                    <button type="button" class="ps-back sm-close">閉じる</button>
                    <div class="ps-title">${title}</div>
                </div>
                <div class="sm-body">${inner}</div>
            </div>`;
        document.body.appendChild(ov);
        ov.querySelector('.sm-close').onclick = () => this.close();
        ov.onclick = (e) => { if (e.target === ov) this.close(); };
        return ov;
    },
    close: function () { document.getElementById('sm-overlay')?.remove(); },

    // 1. 同じ形式のセットを選ぶ
    open: function () {
        const fam = this.currentFamily();
        const name = this.NAMES[fam];
        if (!fam || !name) {
            window.App.Ui.showToast(fam === 'board' || fam === 'numgame' ? 'パネルクイズと数字予想は、1セットで1つの遊びなので取り込めません' : '先に形式を選んでください');
            return;
        }
        const showId = window.App.State.currentShowId;
        if (!showId || !window.db) { window.App.Ui.showToast('保存済みのセットを読めません（番組IDが未設定です）'); return; }
        const ov = this.overlay(`<span class="ps-format">${name}</span>別のセットから問題を取り込む`, '<p class="ps-note">読み込み中…</p>');
        const editing = window.App.State.editingSetId;
        window.db.ref(`saved_sets_meta/${showId}`).once('value').then(snap => {
            const meta = snap.val() || {};
            const list = Object.entries(meta)
                .filter(([k, m]) => k !== editing && m && (m.typeCat === this.CAT_OF[fam] || m.typeCat === 'unknown' || !m.typeCat))
                .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
            const body = ov.querySelector('.sm-body');
            if (!list.length) {
                body.innerHTML = `<p class="sm-empty">取り込める${name}のセットがありません。<br>同じ形式で保存したセットが、ここに並びます。</p>`;
                return;
            }
            body.innerHTML = `
                <p class="ps-note sm-lead">同じ形式（${name}）のセットだけが並びます。ルールと見た目は、今のセットのままです。</p>
                <div class="sm-sets">${list.map(([k, m]) => `
                    <button type="button" class="ps-card sm-set" data-key="${this.esc(k)}">
                        <span class="ps-label">${this.esc(m.title || '名前なし')}</span>
                        <span class="ps-sub">${m.qCount || 0}問</span>
                    </button>`).join('')}</div>`;
            body.querySelectorAll('[data-key]').forEach(b => { b.onclick = () => this.pickSet(b.dataset.key, fam); });
        }).catch(err => {
            ov.querySelector('.sm-body').innerHTML = `<p class="sm-empty">読み込めませんでした（${this.esc(err.message || err.code || '')}）</p>`;
        });
    },

    // 2. そのセットの問題を選ぶ
    pickSet: function (key, fam) {
        const showId = window.App.State.currentShowId;
        const ov = document.getElementById('sm-overlay');
        if (!ov) return;
        const body = ov.querySelector('.sm-body');
        body.innerHTML = '<p class="ps-note">問題を読み込み中…</p>';
        window.db.ref(`saved_sets/${showId}/${key}`).once('value').then(snap => {
            const item = snap.val();
            if (!item) { body.innerHTML = '<p class="sm-empty">セットが見つかりません</p>'; return; }
            const raw = Array.isArray(item.questions) ? item.questions : Object.values(item.questions || {});
            const qs = window.App.SetImages ? window.App.SetImages.unpack(raw, item.images) : raw;
            if (this.family(qs[0]) !== fam) {
                body.innerHTML = `<p class="sm-empty">このセットは形式が違うので取り込めません（${this.esc(this.NAMES[this.family(qs[0])] || 'ほかの形式')}）。</p><button type="button" class="ps-back sm-backlist">セットの一覧に戻る</button>`;
                body.querySelector('.sm-backlist').onclick = () => this.open();
                return;
            }
            const norm = (t) => String(t || '').replace(/\s+/g, '').toLowerCase();
            const have = new Set(((window.App.Data && window.App.Data.createdQuestions) || []).map(q => norm(q.q)));
            this._pending = qs;
            const rows = qs.map((q, i) => {
                const dup = !!norm(q.q) && have.has(norm(q.q));
                const ans = Array.isArray(q.c) && q.type === 'choice' && q.correct !== undefined ? (Array.isArray(q.correct) ? q.correct : [q.correct]).map(x => q.c[x]).filter(Boolean).join('／')
                    : (q.correct !== undefined && typeof q.correct !== 'object' ? q.correct : (Array.isArray(q.c) ? `${q.c.length}項目` : ''));
                return `<label class="sm-q${dup ? ' sm-dup' : ''}">
                    <input type="checkbox" data-i="${i}" ${dup ? '' : 'checked'}>
                    <span class="sm-q-text"><b>Q${i + 1}</b> ${this.esc(q.q || '（問題文なし）')}${ans ? `<small>${this.esc(ans)}</small>` : ''}${dup ? '<em>同じ問題文が、もう今のセットにあります</em>' : ''}</span>
                </label>`;
            }).join('');
            body.innerHTML = `
                <div class="sm-qhead">
                    <b>${this.esc(item.title || '名前なし')}</b>
                    <button type="button" class="sm-all">すべて選ぶ</button>
                    <button type="button" class="sm-none">すべて外す</button>
                </div>
                <div class="sm-qs">${rows}</div>
                <div class="sm-foot">
                    <button type="button" class="ps-back sm-backlist">セットを選び直す</button>
                    <button type="button" class="sm-go"></button>
                </div>`;
            const go = body.querySelector('.sm-go');
            const boxes = [...body.querySelectorAll('input[data-i]')];
            const sync = () => {
                const n = boxes.filter(b => b.checked).length;
                go.textContent = n ? `${n}問を取り込む` : '取り込む問題を選んでください';
                go.disabled = !n;
            };
            boxes.forEach(b => { b.onchange = sync; });
            body.querySelector('.sm-all').onclick = () => { boxes.forEach(b => { b.checked = true; }); sync(); };
            body.querySelector('.sm-none').onclick = () => { boxes.forEach(b => { b.checked = false; }); sync(); };
            body.querySelector('.sm-backlist').onclick = () => this.open();
            go.onclick = () => this.importQuestions(boxes.filter(b => b.checked).map(b => qs[+b.dataset.i]));
            sync();
        }).catch(err => {
            body.innerHTML = `<p class="sm-empty">読み込めませんでした（${this.esc(err.message || err.code || '')}）</p>`;
        });
    },

    // 3. 今のセットの最後に足す
    importQuestions: function (picked) {
        if (!picked || !picked.length) return;
        const C = window.App.Creator;
        const D = window.App.Data;
        D.createdQuestions = D.createdQuestions || [];
        // 口頭／手書きは取り込み先に合わせる（今のセットの問題か、編集中の形式から）
        const ref = D.createdQuestions.find(q => q && /_(oral|written)$/.test(q.type || '')) || { type: (C && C.currentType) || '' };
        const suffix = (/_(oral|written)$/.exec(ref.type || '') || [])[1];
        picked.forEach(src => {
            const q = JSON.parse(JSON.stringify(src));
            // 見た目はセットで1つ — 保存の時に今のセットの見た目を入れ直す
            delete q.design; delete q.layout; delete q.align; delete q.cAlign;
            if (suffix && /_(oral|written)$/.test(q.type || '')) q.type = q.type.replace(/_(oral|written)$/, '_' + suffix);
            D.createdQuestions.push(q);
        });
        this.close();
        if (C && C.renderList) C.renderList();
        if (window.App.CreatorMobile && window.App.CreatorMobile.renderList) window.App.CreatorMobile.renderList();
        if (window.App.CreatorDesktop && window.App.CreatorDesktop.renderList) window.App.CreatorDesktop.renderList();
        if (window.App.CreatorDraft && window.App.CreatorDraft.saveSoon) window.App.CreatorDraft.saveSoon();
        window.App.Ui.showToast(`${picked.length}問を取り込みました（セットを保存すると確定します）`);
    },
};

// 入口: スマホの「セットの設定」と、PCの問題一覧の下
(function hookSetMergeEntrances() {
    const M = window.App.CreatorMobile;
    if (M && typeof M.renderSettingsSummary === 'function') {
        const orig = M.renderSettingsSummary;
        M.renderSettingsSummary = function (box) {
            const r = orig.apply(this, arguments);
            try {
                if (box && !box.querySelector('.sm-entry')) {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'cm-set-row sm-entry';
                    b.innerHTML = '<span class="cm-set-label">取り込む</span><span class="cm-set-value">別のセットから問題を取り込む</span>';
                    b.onclick = () => { M.closeSheet && M.closeSheet(); App.SetMerge.open(); };
                    box.appendChild(b);
                }
            } catch (e) { console.warn('set_merge entry', e); }
            return r;
        };
    }
    const addPc = () => {
        const nb = document.getElementById('cp-new-btn');
        if (!nb || document.getElementById('sm-pc-btn')) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'sm-pc-btn';
        b.className = 'sm-pc-btn';
        b.textContent = '別のセットから取り込む';
        b.onclick = () => App.SetMerge.open();
        nb.after(b);
    };
    addPc();
    if (document.getElementById('sm-pc-btn')) return;
    // PCの3列の画面は後から作られるので、作られたら付ける
    if (window.MutationObserver) {
        const mo = new MutationObserver(() => {
            if (document.getElementById('sm-pc-btn')) { mo.disconnect(); return; }
            if (document.getElementById('cp-new-btn')) { addPc(); mo.disconnect(); }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }
})();
