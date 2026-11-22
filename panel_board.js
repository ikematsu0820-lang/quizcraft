/* =========================================================
 * panel_board.js — 多答クイズの「パネル指名モード」
 *
 * プレッシャースタディ（Qさま）やファイブボンバー（ネプリーグ）のように、
 * 1問の中に番号の付いたパネルが複数並び、解答者が「4番、○○」と
 * パネルを指名して答える形式。
 *   ・解答者は口頭で「◯番、答え」と言う（または自分の端末で番号を押す）
 *   ・出題者がそのパネルを押して〇／✕を判定
 *   ・〇なら、そのパネルだけ裏返って答えが出る
 *   ・全部のパネルが開いたら（または出題者が終えたら）残りの答えを見せる
 * 解答権は1人ずつ（早押し・順番・指名）。得点はパネルごとの点
 * （空欄ならルールの「正解」の設定）、減点はルールの「誤答」の設定。
 *
 * 作成画面・出題者画面・モニター・回答者画面をこのファイルにまとめ、
 * 既存のファイルには小さな呼び出しだけを足している。
 * =======================================================*/

window.App = window.App || {};

App.PanelBoard = {
    // パネルの色（テーマ・見た目の設定）→ CSS変数。設定もテーマも無ければ CSS の既定（紺×金）
    vars: function (d) {
        const T = window.App.Themes;
        if (!T || !T.panelColor) return '';
        const c = (k) => T.panelColor(d, k);
        const out = [];
        const put = (name, v) => { if (v) out.push(`${name}:${v}`); };
        put('--pb-bg', c('pbBg')); put('--pb-text', c('pbText')); put('--pb-border', c('pbBorder'));
        put('--pb-ok', c('pbOk')); put('--pb-ok-text', c('pbOkText'));
        put('--pb-done', c('pbDone')); put('--pb-done-text', c('pbDoneText'));
        if (c('pbGloss') === 'none') out.push('--pb-gloss-img:none');
        // 上のお題の帯は、問題文の枠と同じ色に
        if (c('pbBg')) { put('--pb-head-bg', d.qBgColor); put('--pb-head-text', d.qTextColor); }
        return out.join('; ') + (out.length ? ';' : '');
    },
    active: false, // 作成画面で編集中の問題がパネル指名モードか
    panelQ: false, // パネルごとに問題を出す（表＝ジャンル、選ぶと問題、正解で答えに裏返る）
    board: false,  // パネルクイズ（ジャンル×点数の盤面。形式選択の「パネルクイズ」— 1セット1盤面）

    esc: function (v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // 問題がパネル指名モードか（前に選択式で作ったものも同じに扱う）
    is: function (q) {
        return !!(q && q.panel && Array.isArray(q.panels) && (String(q.type || '').startsWith('multi') || q.type === 'choice'));
    },

    // 選択式で作ったパネル指名の問題を、多答（口頭）のパネル指名に置き換える
    migrate: function (q) {
        if (!q || q.type !== 'choice' || !q.panel) return q;
        q.type = 'multi_oral';
        q.c = (q.panels || []).map(p => p.answer);
        q.correct = q.c.slice();
        ['correctIndex', 'multiCorrect', 'ox', 'multi', 'mode', 'shuffle'].forEach(k => { delete q[k]; });
        return q;
    },

    // 見た目の「パネルの配置」（行数×列数）。未設定なら 0
    gridCols: function (d) {
        const r = parseInt(d && d.gridRows) || 0, c = parseInt(d && d.gridCols) || 0;
        return (r > 0 && c > 0) ? c : 0;
    },

    // パネルクイズの盤面: ジャンル（パネルの label）ごとに列、列の中は点の小さい順。
    // cells[行][列] = パネルの番号（無い所は null）。モニター・出題者画面・回答者画面・プレビューで共通
    boardLayout: function (panels) {
        const cats = [];
        const byCat = {};
        (panels || []).forEach((p, i) => {
            const c = String((p && p.label) || '');
            if (!(c in byCat)) { byCat[c] = []; cats.push(c); }
            byCat[c].push(i);
        });
        const num = (i) => { const v = Number(panels[i].pts); return isNaN(v) || panels[i].pts === '' || panels[i].pts === null ? Infinity : v; };
        cats.forEach(c => byCat[c].sort((a, b) => num(a) - num(b) || a - b));
        const rows = Math.max(1, ...cats.map(c => byCat[c].length));
        const cells = Array.from({ length: rows }, (_, r) => cats.map(c => byCat[c][r] ?? null));
        return { cats, cols: Math.max(cats.length, 1), rows, cells };
    },
    // ジャンルの帯の色（左から順に）
    CAT_COLORS: ['#e5484d', '#f76b15', '#30a46c', '#8e4ec6', '#0090ff', '#d6409f', '#12a594', '#ffb224'],
    isBoard: function (q) { return !!(q && q.panelStyle === 'board'); },

    // 形式選択の「パネルクイズ」から始めた時
    startBoardSet: function (C) {
        this.active = true;
        this.panelQ = true;
        this.board = true;
        // 最初は 4ジャンル × 10〜40点
        const boardGenres = Array.from({ length: 4 }, () => ({ name: '', items: [10, 20, 30, 40].map(pts => ({ pts, pq: '', answer: '' })) }));
        C.renderForm('multi_oral', { type: 'multi_oral', panel: true, panelQ: true, panelStyle: 'board', panels: [], boardGenres });
    },

    // モニター・回答者画面のパネルの列の数
    cols: function (n) {
        if (n <= 3) return n;
        if (n <= 4) return 2;
        if (n <= 6) return 3;
        if (n <= 8) return 4;
        if (n <= 15) return 5;
        if (n <= 24) return 6;
        return 8;
    },

    // ---------------------------------------------------------
    // 作成画面
    // ---------------------------------------------------------
    afterRenderForm: function (C, type, data) {
        // 多答・ランキング — 形式の名前は 'multi' のまとまりで来ることもあるので画面で見る
        const rk = document.getElementById('multi-ranking-mode-chk');
        const isRanking = !!rk && rk.checked;
        const isMultiFamily = /^(multi|ranking)/.test(type || '') && !!rk;
        if (!isMultiFamily) { this.active = false; return; }
        if (isRanking) this.active = false;
        else if (data && typeof data.panel === 'boolean') this.active = data.panel;
        else if (data && data.panel) this.active = true;
        if (data && data.panelStyle === 'board') { this.board = true; this.active = true; this.panelQ = true; }
        // パネルクイズは形式そのものなので、多答の「通常／ランキング／パネル指名」は出さない
        if (this.board) {
            rk.closest('label')?.classList.add('ctl-hidden');
            document.getElementById('multi-add-btn')?.remove();
            this.renderBoardEditor(C, data);
            return;
        }
        this.renderModeSwitch(C, rk, isRanking);
        if (!this.active) return;
        // 正解の追加は使わない（パネルの追加に置き換え）
        document.getElementById('multi-add-btn')?.remove();
        this.renderEditor(C, data);
    },

    // 多答の形式「通常／ランキング／パネル」— どれか1つなので、2つのチェックではなく1つの切り替えで選ぶ
    renderModeSwitch: function (C, rk, isRanking) {
        const outside = document.getElementById('creator-outside-opts');
        const rkLabel = rk.closest('label');
        if (!outside || !rkLabel) return;
        rkLabel.classList.add('ctl-hidden'); // 状態はこのチェックが持ったまま、見せるのは切り替えだけ
        const cur = isRanking ? 'ranking' : this.active ? 'panel' : 'normal';
        const seg = document.createElement('div');
        seg.className = 'seg-ctl';
        seg.id = 'multi-mode-seg';
        seg.setAttribute('role', 'radiogroup');
        seg.innerHTML = [['normal', '通常'], ['ranking', 'ランキング'], ['panel', 'パネル指名']].map(([v, t]) =>
            `<button type="button" role="radio" aria-checked="${v === cur}" data-mode="${v}" class="${v === cur ? 'on' : ''}">${t}</button>`).join('');
        outside.insertBefore(seg, rkLabel);
        const setRanking = (on) => {
            const r = document.getElementById('multi-ranking-mode-chk');
            if (!r || r.checked === on) return;
            r.checked = on;
            r.dispatchEvent(new Event('change'));
        };
        seg.querySelectorAll('button').forEach(b => {
            b.onclick = () => {
                const to = b.dataset.mode;
                if (to === cur) return;
                if (cur === 'panel') this.setPanel(C, false);
                if (cur === 'ranking') setRanking(false);
                if (to === 'ranking') setRanking(true);
                if (to === 'panel') this.setPanel(C, true);
            };
        });
    },

    // パネル指名モードのオン／オフ（今の答えは引き継ぐ）
    setPanel: function (C, on) {
        const cur = C._readFormDataForPreview();
        this.active = on;
        if (on) {
            // 今の答えをそのままパネルの答えに（パネル指名は口頭で答える）
            const panels = (cur.panels && cur.panels.length) ? cur.panels
                : (cur.c || []).filter(Boolean).map(a => ({ label: '', answer: a, pts: '' }));
            C.renderForm('multi_oral', { ...cur, type: 'multi_oral', panel: true, panels });
        } else {
            const answers = (cur.panels || []).map(p => p.answer).filter(Boolean);
            const sub = document.getElementById('creator-opt-subtype')?.value;
            C.renderForm(/^multi_/.test(sub || '') ? sub : 'multi_oral', { ...cur, panel: false, c: answers, correct: answers });
        }
    },

    renderEditor: function (C, data) {
        const container = document.getElementById('creator-form-container');
        if (!container) return;
        this.panelQ = !!(data && data.panelQ);
        const panels = (data && Array.isArray(data.panels) && data.panels.length) ? data.panels
            : (data && Array.isArray(data.c) && data.c.filter(Boolean).length) ? data.c.filter(Boolean).map(a => ({ label: '', answer: a, pts: '' }))
            : Array.from({ length: 2 }, () => ({ label: '', answer: '', pts: '' })); // 最初は2つ（足すのは「＋」で）
        container.innerHTML = '';
        container.style.overflowY = 'auto';
        const list = document.createElement('div');
        list.id = 'pb-list';
        // 問題付きは1枚の欄が多いので1列に
        list.className = this.panelQ ? 'pb-qmode' : '';
        list.style.cssText = `display:grid; grid-template-columns:${this.panelQ ? '1fr' : '1fr 1fr'}; gap:4px 8px; width:100%; align-content:start;`;
        container.appendChild(list);
        panels.forEach(p => this.addRow(list, p));
        // パネルをタップしたら、見た目の設定は「パネル」を対象にする
        list.addEventListener('click', () => { if (window.App.Design) window.App.Design.selectObject('choices'); });

        const outside = document.getElementById('creator-outside-opts');
        const mk = (html) => { const d = document.createElement('span'); d.innerHTML = html; return d.firstElementChild; };
        const wrongSel = mk(`<label class="pb-wrong-wrap" style="display:flex; align-items:center; gap:4px; color:#fff; font-size:0.8rem; white-space:nowrap;">誤答したパネル
            <select id="pb-wrong" style="height:26px; min-height:0; margin:0; padding:0 6px; width:auto;">
                <option value="keep">そのまま残す（他の人が答えられる）</option>
                <option value="close">閉じて答えを見せる</option>
            </select></label>`);
        wrongSel.querySelector('select').value = (data && data.panelWrong === 'close') ? 'close' : 'keep';
        const paste = mk(`<button type="button" id="pb-paste-btn" style="margin-left:auto; background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:5px 12px; cursor:pointer; font-size:0.8rem;">まとめて貼り付け</button>`);
        const add = mk(`<button type="button" id="pb-add-btn" style="margin-left:4px; background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:5px 12px; cursor:pointer; font-size:0.8rem;">＋ パネルを追加</button>`);
        // パネルごとに問題を出す（表＝ジャンル → 選ぶと問題 → 正解で答えに裏返る）
        const qmodeChk = mk(`<label class="pb-qmode-wrap" style="display:flex; align-items:center; gap:6px; cursor:pointer; color:#cbd5e1; font-size:0.8rem; white-space:nowrap;"><input type="checkbox" id="pb-qmode-chk" ${this.panelQ ? 'checked' : ''} style="accent-color:#00e5ff; cursor:pointer;"><span>パネルごとに問題を出す</span></label>`);
        qmodeChk.querySelector('input').onchange = (e) => {
            const cur = C._readFormDataForPreview();
            C.renderForm('multi_oral', { ...cur, type: 'multi_oral', panel: true, panelQ: e.target.checked });
        };
        const hint = mk(`<span class="pb-hint" style="color:#64748b; font-size:0.75rem; white-space:nowrap;">${this.panelQ
            ? '※パネルを選ぶと問題が出て、正解すると答えに裏返ります。答えは口頭・点が空欄ならルールの配点'
            : '※答えは口頭。表（問題）が空欄なら番号だけ出す・点が空欄ならルールの配点'}</span>`);
        // パネルの配置（行数×列数）— 見た目の「パネルの配置」と同じ設定
        const layoutBtn = window.App.Design && window.App.Design.gridLayoutButton ? window.App.Design.gridLayoutButton('パネル') : null;
        if (outside) { [qmodeChk, hint, wrongSel, layoutBtn, paste, add].filter(Boolean).forEach(el => outside.appendChild(el)); outside.classList.remove('hidden'); }
        paste.onclick = () => this.openPaste(list);
        add.onclick = () => this.addRow(list, { label: '', answer: '', pts: '' });
    },

    // ---------------------------------------------------------
    // パネルクイズの作成画面 — ジャンルごとに 点・問題・答え を並べて書く
    // ---------------------------------------------------------
    renderBoardEditor: function (C, data) {
        const container = document.getElementById('creator-form-container');
        if (!container) return;
        const genres = this.padGenres((data && Array.isArray(data.boardGenres)) ? data.boardGenres : this.genresFrom((data && data.panels) || []));
        container.innerHTML = '';
        container.style.overflowY = 'auto';
        const board = document.createElement('div');
        board.id = 'pbq-board';
        container.appendChild(board);
        genres.forEach(g => this.addGenre(board, g));
        board.addEventListener('click', () => { if (window.App.Design) window.App.Design.selectObject('choices'); });

        const outside = document.getElementById('creator-outside-opts');
        const mk = (html) => { const d = document.createElement('span'); d.innerHTML = html; return d.firstElementChild; };
        const hint = mk(`<span class="pb-hint" style="color:#64748b; font-size:0.75rem; white-space:nowrap;">※ジャンルが列、点の小さい順に並びます。パネルを選ぶと問題が出て、正解すると答えに裏返り、そのパネルの点が入ります</span>`);
        const wrongSel = mk(`<label class="pb-wrong-wrap" style="display:flex; align-items:center; gap:4px; color:#fff; font-size:0.8rem; white-space:nowrap;">誤答したパネル
            <select id="pb-wrong" style="height:26px; min-height:0; margin:0; padding:0 6px; width:auto;">
                <option value="keep">そのまま残す（他の人が答えられる）</option>
                <option value="close">閉じて答えを見せる</option>
            </select></label>`);
        wrongSel.querySelector('select').value = (data && data.panelWrong === 'close') ? 'close' : 'keep';
        const btn = (id, text) => mk(`<button type="button" id="${id}" style="margin-left:4px; background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4); border-radius:8px; color:#00e5ff; padding:5px 12px; cursor:pointer; font-size:0.8rem;">${text}</button>`);
        const addG = btn('pbq-add-genre', '＋ ジャンルを追加');
        const paste = btn('pb-paste-btn', 'まとめて貼り付け');
        if (outside) { [hint, wrongSel, addG, paste].forEach(el => outside.appendChild(el)); outside.classList.remove('hidden'); }
        addG.onclick = () => this.addGenre(board, { name: '', items: [10, 20, 30, 40].map(pts => ({ pts, pq: '', answer: '' })) });
        paste.onclick = () => this.openBoardPaste(board);
    },

    // 保存すると空欄の行・ジャンルは抜けるので、開き直した時は最初の形（4ジャンル × 4問）まで空欄の枠を足して戻す
    //   （あとで書き足す時に、いちいち「＋ 問題を追加」しなくていいように。空欄のままなら保存の時にまた抜ける）
    padGenres: function (genres) {
        const DEF = [10, 20, 30, 40];
        const out = (genres || []).map(g => {
            const items = (g.items || []).slice();
            const used = new Set(items.map(it => Number(it.pts)));
            let next = DEF.find(p => !used.has(p));
            while (items.length < DEF.length) {
                const pts = next !== undefined ? next : (Math.max(0, ...items.map(it => Number(it.pts) || 0)) + 10);
                items.push({ pts, pq: '', answer: '' });
                used.add(pts);
                next = DEF.find(p => !used.has(p));
            }
            items.sort((x, y) => (Number(x.pts) || 0) - (Number(y.pts) || 0));
            return Object.assign({}, g, { items });
        });
        while (out.length < 4) out.push({ name: '', items: DEF.map(pts => ({ pts, pq: '', answer: '' })) });
        return out;
    },

    // 保存済みのパネルを、ジャンルごとのまとまりに戻す（並びは書いた順）
    genresFrom: function (panels) {
        const out = [];
        const at = {};
        panels.forEach(p => {
            const name = String(p.label || '');
            if (!(name in at)) { at[name] = out.length; out.push({ name, items: [] }); }
            out[at[name]].items.push({ pts: p.pts, pq: p.pq || '', answer: p.answer || '', img: p.img || null });
        });
        // 何も無ければ 4ジャンル × 10〜40点 から
        return out.length ? out : Array.from({ length: 4 }, () => ({ name: '', items: [10, 20, 30, 40].map(pts => ({ pts, pq: '', answer: '' })) }));
    },

    addGenre: function (board, g) {
        const e = (v) => this.esc(v);
        const sec = document.createElement('div');
        sec.className = 'pbq-genre';
        sec.innerHTML = `
            <div class="pbq-ghead">
                <span class="pbq-chip"></span>
                <input type="text" class="pbq-gname" value="${e(g.name)}">
                <button type="button" class="pbq-gdel" title="このジャンルを消す">×</button>
            </div>
            <div class="pbq-items"></div>
            <button type="button" class="pbq-add">＋ 問題を追加</button>`;
        const items = sec.querySelector('.pbq-items');
        (g.items || []).forEach(it => this.addBoardItem(items, it));
        sec.querySelector('.pbq-add').onclick = () => {
            const last = [...items.querySelectorAll('.pbq-pts')].map(x => Number(x.value)).filter(n => !isNaN(n) && n > 0).pop();
            this.addBoardItem(items, { pts: last ? last + 10 : 10, pq: '', answer: '' });
        };
        sec.querySelector('.pbq-gdel').onclick = async () => {
            if (board.querySelectorAll('.pbq-genre').length <= 1) { window.App.Ui.showToast('ジャンルは1つ以上必要です'); return; }
            const filled = [...sec.querySelectorAll('input')].some(x => x.value.trim() && !x.classList.contains('pbq-pts'));
            if (filled && !(await window.App.Dialog.confirm('このジャンルと、その問題を消しますか？', { ok: '消す', danger: true }))) return;
            sec.remove();
            this.renumberGenres(board);
        };
        board.appendChild(sec);
        this.renumberGenres(board);
        return sec;
    },
    renumberGenres: function (board) {
        board.querySelectorAll('.pbq-genre').forEach((sec, i) => {
            sec.querySelector('.pbq-chip').style.background = this.CAT_COLORS[i % this.CAT_COLORS.length];
            sec.querySelector('.pbq-gname').placeholder = `ジャンル${i + 1}（例: ${['文学', '社会', '科学', '芸能', 'ノンジャンル'][i % 5]}）`;
        });
    },
    addBoardItem: function (items, it) {
        const e = (v) => this.esc(v);
        const row = document.createElement('div');
        row.className = 'pbq-item';
        row.innerHTML = `
            <input type="number" class="pbq-pts" placeholder="点" value="${e(it.pts)}">
            <input type="text" class="pbq-q" placeholder="問題文" value="${e(it.pq)}">
            <input type="text" class="pbq-a" placeholder="答え" value="${e(it.answer)}">
            <button type="button" class="pbq-del" title="削除">×</button>`;
        row.querySelector('.pbq-del').onclick = () => row.remove();
        row._img = it.img || null;
        if (window.App.ItemImage) window.App.ItemImage.decorateRow(row, row.querySelector('.pbq-del'));
        items.appendChild(row);
        return row;
    },
    // 盤面の入力 → パネルの並び（label = ジャンル名）。keepEmpty はプレビュー用に空欄も残す
    readBoard: function (keepEmpty) {
        const out = [];
        document.querySelectorAll('#pbq-board .pbq-genre').forEach((sec, gi) => {
            const name = (sec.querySelector('.pbq-gname')?.value || '').trim() || `ジャンル${gi + 1}`;
            sec.querySelectorAll('.pbq-item').forEach(row => {
                const raw = (row.querySelector('.pbq-pts')?.value || '').trim();
                const pq = (row.querySelector('.pbq-q')?.value || '').trim();
                const answer = (row.querySelector('.pbq-a')?.value || '').trim();
                if (!pq && !answer && !keepEmpty) return;
                const item = { label: name, pts: raw === '' ? '' : Number(raw), pq, answer };
                if (row._img) item.img = row._img;
                out.push(item);
            });
        });
        return out;
    },
    // 表計算ソフトから（1行1問: ジャンル[タブ]点[タブ]問題文[タブ]答え）
    openBoardPaste: function (board) {
        document.getElementById('pb-paste-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'pb-paste-modal';
        overlay.className = 'design-modal-overlay';
        overlay.innerHTML = `
            <div class="design-modal-content" style="max-width:460px; padding:20px !important;">
                <h3 class="modal-title" style="font-size:1rem; margin-bottom:8px;">盤面をまとめて貼り付け</h3>
                <p style="color:#94a3b8; font-size:0.75rem; margin:0 0 8px;">1行に1問。ジャンル[タブ]点[タブ]問題文[タブ]答え。カンマ区切りでもOK。同じジャンルは同じ列にまとまります</p>
                <textarea id="pb-paste-text" placeholder="文学	10	『こころ』の作者は？	夏目漱石\n科学	10	水の化学式は？	H2O" style="width:100%; height:180px !important; min-height:180px !important; padding:8px; box-sizing:border-box; font-family:monospace; font-size:0.8rem; background:#0d1b2a; color:#fff; border:1px solid #475569; border-radius:8px; resize:vertical;"></textarea>
                <label style="display:flex; align-items:center; gap:6px; color:#cbd5e1; font-size:0.78rem; margin:8px 0;"><input type="checkbox" id="pb-paste-replace" checked> 今の盤面を置き換える（外すと足す）</label>
                <div style="display:flex; gap:8px;">
                    <button type="button" id="pb-paste-cancel" style="flex:1; padding:9px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">閉じる</button>
                    <button type="button" id="pb-paste-ok" style="flex:2; padding:9px; border-radius:8px; background:linear-gradient(135deg,#00c6ff,#0072ff); border:none; color:#fff; font-weight:bold; cursor:pointer;">追加する</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('#pb-paste-cancel').onclick = close;
        overlay.querySelector('#pb-paste-ok').onclick = () => {
            const rows = overlay.querySelector('#pb-paste-text').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
                const [name, pts, pq, answer] = l.split(/\t|,|，/).map(x => x.trim());
                return { name: name || '', pts: pts !== undefined && pts !== '' && !isNaN(Number(pts)) ? Number(pts) : '', pq: pq || '', answer: answer || '' };
            }).filter(r => r.pq || r.answer);
            if (!rows.length) { window.App.Dialog.alert('「ジャンル[タブ]点[タブ]問題文[タブ]答え」の行が見つかりませんでした'); return; }
            if (overlay.querySelector('#pb-paste-replace').checked) board.innerHTML = '';
            const secOf = (name) => [...board.querySelectorAll('.pbq-genre')].find(sec => sec.querySelector('.pbq-gname').value.trim() === name);
            rows.forEach(r => {
                const sec = secOf(r.name) || this.addGenre(board, { name: r.name, items: [] });
                this.addBoardItem(sec.querySelector('.pbq-items'), r);
            });
            window.App.Ui.showToast(`${rows.length}問を盤面に入れました`);
            close();
        };
    },

    addRow: function (list, p) {
        const e = (v) => this.esc(v);
        const row = document.createElement('div');
        row.className = 'pb-row';
        row.style.cssText = 'display:flex; align-items:center; gap:4px; min-width:0;';
        const inp = 'height:24px !important; min-height:0; margin:0; padding:0 6px !important; background:rgba(255,255,255,0.06) !important; border:1px solid #334155 !important; border-radius:4px; color:#fff; font-size:0.78rem;';
        row.innerHTML = `
            <span class="pb-no" style="flex:0 0 1.8em; color:#fbbf24; font-weight:900; font-size:0.75rem; text-align:right;"></span>
            ${this.panelQ ? `
            <span class="pb-tag pb-tag-front">表</span>
            <input type="text" class="pb-label" placeholder="表：ジャンルなど（例: 果物）" value="${e(p.label)}" style="flex:1; min-width:0; ${inp}">
            <span class="pb-tag pb-tag-q">問</span>
            <input type="text" class="pb-pq" placeholder="問題文" value="${e(p.pq)}" style="flex:2.4; min-width:0; ${inp}">
            <span class="pb-tag pb-tag-ans">裏</span>
            <input type="text" class="pb-answer" placeholder="裏：答え（正解で出る）" value="${e(p.answer)}" style="flex:1; min-width:0; ${inp} color:#86efac !important;">` : `
            <span class="pb-tag pb-tag-front">表</span>
            <input type="text" class="pb-label" placeholder="表：問題（任意）" value="${e(p.label)}" style="flex:1; min-width:0; ${inp}">
            <span class="pb-tag pb-tag-back">裏</span>
            <input type="text" class="pb-answer" placeholder="裏：答え" value="${e(p.answer)}" style="flex:1; min-width:0; ${inp} color:#86efac !important;">`}
            <input type="number" class="pb-pts" placeholder="点" value="${e(p.pts)}" style="flex:0 0 46px; width:46px; ${inp} text-align:right !important; color:#fbbf24 !important;">
            <button type="button" class="pb-del" title="削除" style="flex:0 0 auto; background:none; border:none; color:rgba(255,255,255,0.35); cursor:pointer; padding:0 4px;">×</button>`;
        // 問題付きをオフにしても、書いた問題は行に持っておく（オンに戻した時に消えないように）
        row.dataset.pq = p.pq || '';
        // パネルの画像（問題付きなら問題と一緒に、そうでなければ開いた時に出す）— item_image.js
        row._img = p.img || null;
        if (window.App.ItemImage) window.App.ItemImage.decorateRow(row, row.querySelector('.pb-del'));
        row.querySelector('.pb-del').onclick = () => { row.remove(); this.renumber(list); };
        list.appendChild(row);
        this.renumber(list);
        return row;
    },
    renumber: function (list) {
        list.querySelectorAll('.pb-row .pb-no').forEach((el, i) => { el.textContent = i + 1; });
    },
    // 入力済みのパネル（文字も答えも空の行は飛ばす）。keepEmpty はプレビュー用に空欄も残す
    readPanels: function (keepEmpty) {
        if (this.board) return this.readBoard(keepEmpty);
        const out = [];
        document.querySelectorAll('#pb-list .pb-row').forEach(row => {
            const label = (row.querySelector('.pb-label')?.value || '').trim();
            const answer = (row.querySelector('.pb-answer')?.value || '').trim();
            const raw = (row.querySelector('.pb-pts')?.value || '').trim();
            const pqEl = row.querySelector('.pb-pq');
            const pq = (pqEl ? pqEl.value : row.dataset.pq || '').trim();
            if (!label && !answer && !(this.panelQ && pq) && !keepEmpty) return;
            const p = { label, answer, pts: raw === '' ? '' : Number(raw) };
            if (pq) p.pq = pq;
            if (row._img) p.img = row._img;
            out.push(p);
        });
        return out;
    },
    // 表計算ソフトから（1行1枚: 表の問題[タブ]答え[タブ]点）
    openPaste: function (list) {
        document.getElementById('pb-paste-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'pb-paste-modal';
        overlay.className = 'design-modal-overlay';
        overlay.innerHTML = `
            <div class="design-modal-content" style="max-width:440px; padding:20px !important;">
                <h3 class="modal-title" style="font-size:1rem; margin-bottom:8px;">パネルをまとめて貼り付け</h3>
                <p style="color:#94a3b8; font-size:0.75rem; margin:0 0 8px;">${this.panelQ
                    ? '1行に1枚。表[タブ]問題文[タブ]答え（[タブ]点）。カンマ区切りでもOK'
                    : '1行に1枚。表の問題[タブ]答え（[タブ]点）。答えだけの行（1列）なら、パネルは番号だけになります。カンマ区切りでもOK'}</p>
                <textarea id="pb-paste-text" placeholder="${this.panelQ ? '果物	りんごの生産量日本一の都道府県は？	青森県\n野菜	ねぎの生産量日本一の都道府県は？	埼玉県	2' : '青森	青森市\n岩手	盛岡市	2'}" style="width:100%; height:180px !important; min-height:180px !important; padding:8px; box-sizing:border-box; font-family:monospace; font-size:0.8rem; background:#0d1b2a; color:#fff; border:1px solid #475569; border-radius:8px; resize:vertical;"></textarea>
                <label style="display:flex; align-items:center; gap:6px; color:#cbd5e1; font-size:0.78rem; margin:8px 0;"><input type="checkbox" id="pb-paste-replace" checked> 今のパネルを置き換える（外すと末尾に追加）</label>
                <div style="display:flex; gap:8px;">
                    <button type="button" id="pb-paste-cancel" style="flex:1; padding:9px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">閉じる</button>
                    <button type="button" id="pb-paste-ok" style="flex:2; padding:9px; border-radius:8px; background:linear-gradient(135deg,#00c6ff,#0072ff); border:none; color:#fff; font-weight:bold; cursor:pointer;">追加する</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('#pb-paste-cancel').onclick = close;
        overlay.querySelector('#pb-paste-ok').onclick = () => {
            const num = (v) => v !== undefined && v !== '' && !isNaN(Number(v)) ? Number(v) : '';
            const rows = overlay.querySelector('#pb-paste-text').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
                const parts = l.split(/\t|,|，/).map(x => x.trim());
                if (this.panelQ) return { label: parts[0] || '', pq: parts[1] || '', answer: parts[2] || '', pts: num(parts[3]) };
                if (parts.length < 2) return { label: '', answer: parts[0], pts: '' };
                const pts = parts[2] !== undefined && parts[2] !== '' && !isNaN(Number(parts[2])) ? Number(parts[2]) : '';
                return { label: parts[0], answer: parts[1], pts };
            }).filter(r => r && (r.label || r.answer || r.pq));
            if (!rows.length) { window.App.Dialog.alert(this.panelQ ? '「表[タブ]問題文[タブ]答え」の行が見つかりませんでした' : '「表の問題[タブ]答え」の行が見つかりませんでした'); return; }
            if (overlay.querySelector('#pb-paste-replace').checked) list.innerHTML = '';
            else list.querySelectorAll('.pb-row').forEach(r => { if (!r.querySelector('.pb-label').value.trim() && !r.querySelector('.pb-answer').value.trim()) r.remove(); });
            rows.forEach(r => this.addRow(list, r));
            window.App.Ui.showToast(`${rows.length}枚のパネルを追加しました`);
            close();
        };
    },

    // 保存する問題データに入れる
    fillData: function (q, keepEmpty) {
        if (!q || !/^multi/.test(q.type || '')) return q;
        if (!this.active || !(document.getElementById('pb-list') || document.getElementById('pbq-board'))) { if (q.panel) { q.panel = null; q.panels = null; } return q; }
        const panels = this.readPanels(keepEmpty);
        q.panel = true;
        q.panels = panels;
        q.panelQ = this.panelQ || null;
        q.panelStyle = this.board ? 'board' : null;
        // 盤面の上に出す題（問題文の欄）。空ならパネルクイズ
        if (this.board && !String(q.q || '').trim()) q.q = 'パネルクイズ';
        q.panelWrong = document.getElementById('pb-wrong')?.value === 'close' ? 'close' : 'keep';
        // 多答として読む所（一覧・未完成の判定など）のために答えも c/correct に
        q.c = panels.map(p => p.answer);
        q.correct = q.c.slice();
        return q;
    },

    // ---------------------------------------------------------
    // 出題者画面（App.Studio に足す）
    // ---------------------------------------------------------
    studio: {
        _pb: null,

        pbAnswerer: function () {
            const mode = (App.Data.currentConfig || {}).mode;
            if (mode === 'buzz') return this.buzzWinner || null;
            if (mode === 'nominate') return this._nominatedId || null;
            if (mode === 'turn' || mode === 'solo') return (this.turnOrder || [])[this.turnIndex] || null;
            return null;
        },

        startPanelBoard: function (q) {
            const mode = (App.Data.currentConfig || {}).mode;
            this._pb = {
                panels: (q.panels || []).map(p => ({ label: String(p.label || ''), answer: String(p.answer || ''), pts: p.pts, pq: String(p.pq || '') })),
                panelQ: !!q.panelQ,
                board: q.panelStyle === 'board',
                status: {},
                sel: null,
                seq: 0,
                last: null,
                finished: false,
                revealAll: false,
                wrongMode: q.panelWrong === 'close' ? 'close' : 'keep',
                theme: q.q || '',
                design: q.design || {},
            };
            if (mode === 'turn') this.turnIndex = this._nextEligibleTurnIndex(this.turnIndex || 0, true);
            if (mode === 'buzz') { this.buzzWinner = null; this.clearBuzzWindow(); }
            this.pbPush();
            this.renderPanelConsole();
            const ans = this.pbAnswerer();
            if (ans) this.startAnswerTimer(ans);
            this.startTimeLimit(App.State.currentRoomId);
        },

        pbPush: function () {
            const pb = this._pb;
            if (!pb) return;
            if (pb.finished) pb.sel = null;
            const roomId = App.State.currentRoomId;
            const mode = (App.Data.currentConfig || {}).mode;
            const ans = pb.finished ? null : this.pbAnswerer();
            const players = App.Data.players || {};
            window.db.ref(`rooms/${roomId}/status`).update({
                step: 'panelboard',
                qIndex: App.State.currentQIndex,
                currentAnswerer: ans,
                currentAnswererName: ans ? ((players[ans] && players[ans].name) || '---') : null,
                isBuzzActive: mode === 'buzz' && !ans && !pb.finished,
                isTurnMode: mode !== 'buzz',
                isNominateMode: mode === 'nominate' ? true : null,
                pb: {
                    theme: pb.theme,
                    board: pb.board || null,
                    // 答えは開いたパネルの分だけ送る（回答者の端末から見えないように）
                    panels: pb.panels.map((p, i) => {
                        const s = pb.status[i] || {};
                        const open = s.r === 'ok' || s.r === 'closed' || pb.revealAll;
                        return { label: p.label, pts: p.pts ?? null, r: s.r || null, by: s.by || null, answer: open ? p.answer : null };
                    }),
                    sel: pb.sel,
                    // 問題付き: 選んだパネルの問題だけ送る（答えは送らない）
                    selQ: pb.panelQ && pb.sel !== null && pb.panels[pb.sel] ? (pb.panels[pb.sel].pq || null) : null,
                    seq: pb.seq,
                    last: pb.last,
                    finished: pb.finished,
                    revealAll: pb.revealAll,
                },
            });
            this.pbMainButton();
        },

        // 誰かが早押しした・指名した時に描き直す
        pbRefresh: function () {
            if (!this._pb) return;
            this.pbPush();
            this.renderPanelConsole();
        },

        // 出題者がパネルを押す（解答者が「◯番」と言ったパネル）
        pbSelect: function (idx) {
            const pb = this._pb;
            if (!pb || pb.finished) return;
            const s = pb.status[idx];
            if (s && (s.r === 'ok' || s.r === 'closed')) return;
            pb.sel = pb.sel === idx ? null : idx;
            this.pbPush();
            this.renderPanelConsole();
        },

        // 解答者が自分の端末で番号を押した（players/{id}/pbPick）
        processPanelPick: function (players) {
            const pb = this._pb;
            if (!pb || pb.finished) return;
            const cur = this.pbAnswerer();
            const pick = cur && players && players[cur] && players[cur].pbPick;
            if (!pick) return;
            window.db.ref(`rooms/${App.State.currentRoomId}/players/${cur}/pbPick`).remove();
            const idx = parseInt(pick.idx);
            if (isNaN(idx) || idx < 0 || idx >= pb.panels.length) return;
            const s = pb.status[idx];
            if (s && (s.r === 'ok' || s.r === 'closed')) return;
            pb.sel = idx;
            this.pbPush();
            this.renderPanelConsole();
        },

        // 〇／✕（timeout … 持ち時間切れ。パネル未選択でも誤答として進める）
        pbJudge: function (ok, timeout) {
            const pb = this._pb;
            if (!pb || pb.finished) return;
            const pid = this.pbAnswerer();
            if (!pid) { App.Ui.showToast('解答者がいません'); return; }
            const idx = pb.sel;
            if (idx === null && !timeout) { App.Ui.showToast('解答者が言ったパネルを押してから判定してください'); return; }
            const roomId = App.State.currentRoomId;
            const conf = App.Data.currentConfig || {};
            const q = App.Data.studioQuestions[App.State.currentQIndex] || {};
            const player = (App.Data.players || {})[pid] || {};
            const name = player.name || '---';
            const panel = idx !== null ? pb.panels[idx] : null;
            this.clearAnswerTimer();
            let delta;
            if (ok) {
                const fixed = panel && panel.pts !== '' && panel.pts !== null && panel.pts !== undefined && !isNaN(Number(panel.pts));
                delta = fixed ? Number(panel.pts) : window.App.RuleEngine.correctPoints(conf, q, { streak: (player.streak || 0) + 1 });
                pb.status[idx] = { r: 'ok', by: name };
                this.recordWinner(pid, name);
            } else {
                delta = -this._wrongLoss(q);
                if (idx !== null && pb.wrongMode === 'close') pb.status[idx] = { r: 'closed', by: name };
            }
            pb.seq += 1;
            pb.last = { idx, ok: !!ok, name, timeout: !!timeout, pts: delta };
            // 問題付きで誤答してもパネルが残る時は、同じ問題のまま次の人が答える
            if (ok || !pb.panelQ || pb.wrongMode === 'close') pb.sel = null;
            // 得点（パネルの問題は1問の中で何度も答えるので lastResult は付けない）
            window.db.ref(`rooms/${roomId}/players/${pid}`).once('value', snap => {
                const p = snap.val();
                if (!p) return;
                const upd = { periodScore: (p.periodScore || 0) + delta, totalScore: (p.totalScore || 0) + delta, ...this._resultFields(p, !!ok) };
                if (!ok && conf.gameType === 'survival') {
                    const misses = (p.survivalMisses || 0) + 1;
                    upd.survivalMisses = misses;
                    if (misses >= (conf.survivalLives || 1)) { upd.isAlive = false; App.Ui.showToast(`${name} さんが脱落しました`); }
                }
                snap.ref.update(upd);
            });
            App.Ui.showToast(ok ? `〇 ${name}：${idx + 1}番「${panel.answer}」` : (timeout ? `${name} さんは時間切れ` : `✕ ${name}：${idx + 1}番`));
            // 全部開いたら終わり
            const remain = pb.panels.filter((_, i) => !pb.status[i] || pb.status[i].r !== 'ok' && pb.status[i].r !== 'closed').length;
            if (!remain) pb.finished = true;
            this.pbNextAnswerer(pid, ok);
            this.pbPush();
            this.renderPanelConsole();
            if (!pb.finished) { const nxt = this.pbAnswerer(); if (nxt) this.startAnswerTimer(nxt); }
        },

        // 次の解答者（順番は次の人へ・早押しは押し直し・指名は指名し直し）
        pbNextAnswerer: function (pid) {
            const mode = (App.Data.currentConfig || {}).mode;
            const roomId = App.State.currentRoomId;
            if (mode === 'turn') {
                const n = this._nextEligibleTurnIndex(this.turnIndex, false);
                if (n !== null) this.turnIndex = n;
                this.turnAdvancedThisQ = true;
            } else if (mode === 'buzz') {
                this.buzzWinner = null;
                this.clearBuzzWindow();
                window.db.ref(`rooms/${roomId}/players`).once('value', all => {
                    all.forEach(c => { if (c.val() && c.val().buzzTime) c.ref.update({ buzzTime: null, buzzPressAt: null }); });
                });
            } else if (mode === 'nominate') {
                this._nominatedId = null;
            }
        },

        // 解答者がパスする（点の増減なし・次の人へ）
        pbPass: function () {
            const pb = this._pb;
            if (!pb || pb.finished) return;
            const pid = this.pbAnswerer();
            this.clearAnswerTimer();
            if (!pb.panelQ) pb.sel = null; // 問題付きは同じ問題のまま次の人へ
            this.pbNextAnswerer(pid);
            this.pbPush();
            this.renderPanelConsole();
            const nxt = this.pbAnswerer();
            if (nxt) this.startAnswerTimer(nxt);
        },

        pbMainButton: function () {
            const pb = this._pb;
            const btnMain = document.getElementById('btn-phase-main');
            if (!pb || !btnMain || this.currentStepId !== 2) return;
            btnMain.classList.remove('action-ready');
            btnMain.classList.add('action-next');
            if (pb.revealAll) {
                btnMain.textContent = '次の問題へ';
                btnMain.onclick = () => { this._pb = null; this.renderPanelConsole(); this.clearTimeLimit(); this.goNext(); };
            } else if (pb.finished) {
                btnMain.textContent = '残りの答えを見せる';
                btnMain.onclick = () => { pb.revealAll = true; this.clearAnswerTimer(); this.pbPush(); this.renderPanelConsole(); };
            } else {
                btnMain.textContent = 'このボードを終える';
                btnMain.onclick = async () => {
                    if (!(await window.App.Dialog.confirm('このボードを終えて、残りのパネルの答えを見せますか？', { ok: '終える' }))) return;
                    pb.finished = true; pb.revealAll = true; pb.sel = null;
                    this.clearAnswerTimer();
                    this.pbPush(); this.renderPanelConsole();
                };
            }
            this.syncMainButton();
        },

        renderPanelConsole: function () {
            const view = document.getElementById('host-control-view');
            let box = document.getElementById('panel-console');
            const pb = this._pb;
            if (view) view.classList.toggle('numgame-active', !!pb || !!this._ng);
            if (!pb) { if (box) box.remove(); return; }
            if (!box) {
                box = document.createElement('div');
                box.id = 'panel-console';
                box.style.cssText = 'width:100%; max-width:600px; margin:0 0 12px;';
                const main = document.querySelector('#host-control-view .simple-studio-main');
                const card = document.querySelector('#host-control-view .console-card-wrapper');
                if (main) main.insertBefore(box, card || null);
            }
            const esc = (v) => this._esc(v);
            const mode = (App.Data.currentConfig || {}).mode;
            const pid = this.pbAnswerer();
            const players = App.Data.players || {};
            const ansName = pid ? ((players[pid] && players[pid].name) || '---') : null;
            const who = pb.finished ? 'ボード終了' : ansName ? `解答者：<b style="color:#fbbf24;">${esc(ansName)}</b>`
                : mode === 'buzz' ? '早押し受付中（押した人が答えます）' : mode === 'nominate' ? '参加者リストから解答者を指名してください' : '解答者待ち';
            // モニターと同じ並びにする（配置が未設定なら自動）
            let cols = App.PanelBoard.gridCols(pb.design) || Math.min(5, App.PanelBoard.cols(pb.panels.length));
            const btn = (p, i) => {
                const s = pb.status[i] || {};
                const done = s.r === 'ok' || s.r === 'closed';
                const sel = pb.sel === i;
                const bg = s.r === 'ok' ? 'rgba(34,197,94,0.25)' : s.r === 'closed' ? '#111' : sel ? 'rgba(251,191,36,0.25)' : '#1f2937';
                const bd = s.r === 'ok' ? '#22c55e' : sel ? '#fbbf24' : '#475569';
                // パネルクイズは表に点を大きく（ジャンルは上の帯）
                const face = pb.board
                    ? `<div style="font-size:18px; color:#fbbf24; font-weight:900;">${esc(p.pts ?? '')}</div>`
                    : `<div style="font-size:11px; color:#fbbf24; font-weight:900;">${i + 1}</div>
                    <div style="font-size:13px; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(p.label) || '&nbsp;'}</div>`;
                return `<button type="button" data-pb-idx="${i}" ${done || pb.finished ? 'disabled' : ''} style="padding:6px 4px; border-radius:8px; text-align:center; cursor:${done || pb.finished ? 'default' : 'pointer'};
                    background:${bg}; border:2px solid ${bd}; color:#e2e8f0; min-width:0;">
                    ${face}
                    <div style="font-size:11px; color:${s.r === 'ok' ? '#86efac' : '#64748b'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(p.answer)}</div>
                    ${s.by ? `<div style="font-size:10px; color:#94a3b8;">${s.r === 'ok' ? '〇' : '✕'} ${esc(s.by)}</div>` : ''}
                </button>`;
            };
            let grid;
            if (pb.board) {
                const L = App.PanelBoard.boardLayout(pb.panels);
                cols = L.cols;
                grid = L.cats.map((c, ci) => `<div style="text-align:center; font-size:12px; font-weight:900; color:#fff; padding:5px 2px; border-radius:6px; background:${App.PanelBoard.CAT_COLORS[ci % App.PanelBoard.CAT_COLORS.length]}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(c)}</div>`).join('')
                    + L.cells.map(row => row.map(i => i === null ? '<div></div>' : btn(pb.panels[i], i)).join('')).join('');
            } else {
                grid = pb.panels.map((p, i) => btn(p, i)).join('');
            }
            const selPanel = pb.sel !== null ? pb.panels[pb.sel] : null;
            const canJudge = !pb.finished && pid && selPanel;
            box.innerHTML = `
                <div style="color:#94a3b8; font-size:12px; margin-bottom:6px; border-bottom:1px solid #333; padding-bottom:5px; display:flex; justify-content:space-between; gap:8px;">
                    <span>${pb.panelQ ? 'パネルを押すと問題がモニターに出ます。読み上げて〇✕（グレーの小さな文字が答え）' : 'パネル指名 ／ 解答者が言ったパネルを押して〇✕（グレーの小さな文字が答え）'}</span>
                    <span style="color:#e2e8f0; white-space:nowrap;">${who}</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:5px; margin-bottom:8px;">${grid}</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <div style="flex:1; min-width:0; color:#e2e8f0; font-size:14px; padding:8px 10px; background:#1a1a1a; border-radius:8px;">
                        ${selPanel ? `<b style="color:#fbbf24;">${pb.board ? `${esc(selPanel.label)} ${esc(selPanel.pts ?? '')}点` : `${pb.sel + 1}番`}</b> ${pb.board ? '' : esc(selPanel.label)}${pb.panelQ && selPanel.pq ? `<div style="font-size:16px; font-weight:bold; margin:4px 0;">${esc(selPanel.pq)}</div>` : ' → '}答え <b style="color:#86efac;">${esc(selPanel.answer)}</b>` : '<span style="color:#64748b;">パネル未選択</span>'}
                    </div>
                    <button type="button" id="pb-ok" ${canJudge ? '' : 'disabled'} style="flex:0 0 64px; height:48px; border-radius:10px; font-size:24px; font-weight:900; border:none; cursor:pointer; background:${canJudge ? '#16a34a' : '#333'}; color:#fff;">〇</button>
                    <button type="button" id="pb-ng" ${canJudge ? '' : 'disabled'} style="flex:0 0 64px; height:48px; border-radius:10px; font-size:24px; font-weight:900; border:none; cursor:pointer; background:${canJudge ? '#dc2626' : '#333'}; color:#fff;">✕</button>
                    <button type="button" id="pb-pass" ${!pb.finished && pid ? '' : 'disabled'} style="flex:0 0 auto; height:48px; padding:0 12px; border-radius:10px; border:1px solid #475569; background:#1f2937; color:#cbd5e1; cursor:pointer;">パス</button>
                </div>`;
            box.querySelectorAll('[data-pb-idx]').forEach(b => { b.onclick = () => this.pbSelect(parseInt(b.dataset.pbIdx)); });
            box.querySelector('#pb-ok').onclick = () => this.pbJudge(true);
            box.querySelector('#pb-ng').onclick = () => this.pbJudge(false);
            box.querySelector('#pb-pass').onclick = () => this.pbPass();
        },
    },

    // ---------------------------------------------------------
    // モニター（App.Viewer に足す）
    // ---------------------------------------------------------
    viewer: {
        _pbSeqShown: 0,
        // q を渡すと（作成画面のプレビュー）、その問題で描く
        renderPanelBoard: function (container, mainText, st, previewQ) {
            const pb = st.pb || {};
            const q = previewQ || this.questions[st.qIndex] || {};
            const d = q.design || {};
            this.applyDefaultDesign(container, { mainBgColor: d.mainBgColor || '#0a0a0a', bgImage: d.bgImage });
            if (window.App.ChoiceSkin && d.bgFx === 'studio' && !d.bgImage) container.style.backgroundImage = window.App.ChoiceSkin.studioBg(d.mainBgColor);
            const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const panels = pb.panels || [];
            const cols = App.PanelBoard.gridCols(d) || App.PanelBoard.cols(panels.length);
            const rows = Math.max(parseInt(d.gridRows) || 0, Math.ceil(panels.length / cols)) || 1;
            const accent = d.accentColor || d.qBorderColor || '#00e5ff';
            const fresh = pb.seq && pb.seq !== this._pbSeqShown;
            this._pbSeqShown = pb.seq || 0;
            const last = pb.last || {};
            // 見た目の「パネル」の文字サイズ（小・中・大）と文字色を、まだ開いていないパネルの表に
            const sizeRate = { '4vh': 0.8, '6vh': 1, '9vh': 1.3 }[d.cFontSize] || 1;
            const fontPx = Math.max(2.4, Math.min(6, 40 / rows)) * sizeRate;
            mainText.style.flexDirection = 'column';
            mainText.style.justifyContent = 'flex-start';
            mainText.style.alignItems = 'stretch';
            if (pb.board || App.PanelBoard.isBoard(q)) {
                this.renderPanelQuizBoard(mainText, pb, st, q, { accent, fresh, last, sizeRate, esc });
                return;
            }
            mainText.innerHTML = `
                <div class="pbv" style="--pb-accent:${accent}; --pb-text:${d.cTextColor || '#fff'}; ${App.PanelBoard.vars(d)}">
                    <div class="pbv-theme">${esc(pb.theme || q.q || '')}</div>
                    <div class="pbv-grid" style="grid-template-columns:repeat(${cols}, 1fr); grid-template-rows:repeat(${rows}, 1fr); font-size:${fontPx}cqh;">
                        ${panels.map((p, i) => {
                            const cls = p.r === 'ok' ? 'ok' : p.r === 'closed' ? 'closed' : (p.answer ? 'revealed' : '');
                            const isSel = pb.sel === i && !p.r;
                            const anim = fresh && last.idx === i ? (last.ok ? ' pbv-flip' : ' pbv-shake') : '';
                            return `<div class="pbv-panel ${cls}${isSel ? ' sel' : ''}${anim}">
                                ${p.label || (p.answer !== null && p.answer !== undefined) ? `<span class="pbv-no">${i + 1}</span>` : ''}
                                ${p.answer !== null && p.answer !== undefined
                                    ? `${(q.panels && q.panels[i] && q.panels[i].img) ? `<img class="pbv-img" src="${q.panels[i].img}" alt="">` : ''}<span class="pbv-ans">${esc(p.answer)}</span><span class="pbv-sub">${[p.label, p.by && p.r === 'ok' ? p.by : ''].filter(Boolean).map(esc).join('・')}</span>`
                                    : (p.label ? `<span class="pbv-label">${esc(p.label)}</span>` : `<span class="pbv-big">${i + 1}</span>`)}
                                ${fresh && last.idx === i && !last.ok ? '<span class="pbv-x">✕</span>' : ''}
                            </div>`;
                        }).join('')}
                    </div>
                    ${pb.selQ && pb.sel !== null && pb.sel !== undefined && panels[pb.sel] ? `
                    <div class="pbv-qcard">
                        <div class="pbv-qhead"><span class="pbv-qno">${pb.sel + 1}</span>${esc(panels[pb.sel].label || '')}</div>
                        ${q.panels && q.panels[pb.sel] && q.panels[pb.sel].img ? `<img class="pbv-qimg" src="${q.panels[pb.sel].img}" alt="">` : ''}
                        <div class="pbv-qtext">${esc(pb.selQ)}</div>
                    </div>` : ''}
                    <div class="pbv-foot">${pb.finished ? (pb.revealAll ? '答え' : 'ボード終了') : st.currentAnswererName ? `解答者 <b>${esc(st.currentAnswererName)}</b>` : st.isBuzzActive ? '早押し受付中' : ''}</div>
                </div>`;
        },

        // パネルクイズ: 上にジャンルの色の帯、パネルの表は点。開いたパネルは暗くして答えを薄く
        renderPanelQuizBoard: function (mainText, pb, st, q, o) {
            const PB = App.PanelBoard;
            const panels = pb.panels || [];
            const L = PB.boardLayout(panels);
            const esc = o.esc;
            const fontPx = Math.max(2.4, Math.min(7, 44 / (L.rows + 0.6))) * o.sizeRate;
            const cell = (i) => {
                if (i === null) return '<div></div>';
                const p = panels[i];
                const opened = p.answer !== null && p.answer !== undefined;
                const isSel = pb.sel === i && !p.r;
                const flip = o.fresh && o.last.idx === i ? (o.last.ok ? ' pbv-flip bq-just' : ' pbv-shake') : '';
                const x = o.fresh && o.last.idx === i && !o.last.ok ? '<span class="pbv-x">✕</span>' : '';
                if (opened) {
                    // 長い答えは小さく（パネルの横幅に収まるように）
                    const len = String(p.answer).length;
                    const ansSize = len <= 3 ? 0.8 : len <= 5 ? 0.6 : len <= 8 ? 0.45 : 0.36;
                    return `<div class="pbv-panel bq-done${p.r === 'ok' ? ' bq-ok' : ''}${flip}"><span class="bq-ans" style="font-size:${ansSize}em;">${esc(p.answer)}</span>${p.by && p.r === 'ok' ? `<span class="bq-by">${esc(p.by)}</span>` : ''}${x}</div>`;
                }
                return `<div class="pbv-panel bq-face${isSel ? ' sel' : ''}${flip}"><span class="bq-pts">${esc(p.pts ?? '')}</span>${x}</div>`;
            };
            const sel = pb.selQ && pb.sel !== null && pb.sel !== undefined ? panels[pb.sel] : null;
            mainText.innerHTML = `
                <div class="pbv" style="--pb-accent:${o.accent}; --pb-text:${(q.design || {}).cTextColor || '#ffd23f'}; ${App.PanelBoard.vars(q.design || {})}">
                    <div class="pbv-theme">${esc(pb.theme || q.q || '')}</div>
                    <div class="pbv-grid bq-grid" style="grid-template-columns:repeat(${L.cols}, 1fr); grid-template-rows:auto repeat(${L.rows}, 1fr); font-size:${fontPx}cqh;">
                        ${L.cats.map((c, ci) => `<div class="bq-cat" style="background:${PB.CAT_COLORS[ci % PB.CAT_COLORS.length]};">${esc(c)}</div>`).join('')}
                        ${L.cells.map(row => row.map(cell).join('')).join('')}
                    </div>
                    ${sel ? `
                    <div class="pbv-qcard">
                        <div class="pbv-qhead">${esc(sel.label || '')}<span class="pbv-qno">${esc(sel.pts ?? '')}</span></div>
                        ${q.panels && q.panels[pb.sel] && q.panels[pb.sel].img ? `<img class="pbv-qimg" src="${q.panels[pb.sel].img}" alt="">` : ''}
                        <div class="pbv-qtext">${esc(pb.selQ)}</div>
                    </div>` : ''}
                    <div class="pbv-foot">${pb.finished ? (pb.revealAll ? '答え' : 'ボード終了') : st.currentAnswererName ? `解答者 <b>${esc(st.currentAnswererName)}</b>` : st.isBuzzActive ? '早押し受付中' : ''}</div>
                </div>`;
        },
    },
};

// 出題者画面・モニターに足す
if (window.App.Studio) Object.assign(window.App.Studio, App.PanelBoard.studio);
if (window.App.Viewer) Object.assign(window.App.Viewer, App.PanelBoard.viewer);

// 作成画面のフック
(function hookCreatorForPanels() {
    const C = window.App.Creator;
    if (!C) return;
    const PB = App.PanelBoard;
    const wrap = (name, fn) => {
        const orig = C[name];
        if (typeof orig !== 'function') return;
        C[name] = function () {
            const r = orig.apply(this, arguments);
            try { const v = fn.call(this, r, arguments); if (v !== undefined) return v; } catch (e) { console.warn('panel_board hook', name, e); }
            return r;
        };
    };
    wrap('renderForm', function (_, args) { PB.afterRenderForm(this, args[0], args[1]); });
    wrap('getData', function (q) { return PB.fillData(q, false); });
    wrap('_readFormDataForPreview', function (q) { return PB.fillData(q, true); });
    wrap('init', function () { PB.active = false; PB.board = false; });
    // 前に選択式で作ったパネル指名の問題は、開く前に多答へ置き換える
    const origEdit = C.edit;
    if (typeof origEdit === 'function') {
        C.edit = function (index) {
            try { PB.migrate((window.App.Data.createdQuestions || [])[index]); } catch (e) { /* noop */ }
            return origEdit.apply(this, arguments);
        };
    }
    wrap('initWithType', function () { PB.active = false; PB.board = false; });
    // パネルクイズは1セット1盤面 — 盤面がもう有る時に「追加」はしない（直す時は一覧から開く）
    // 盤面のタイトル（問題文の欄）は空でもよい — 空なら「パネルクイズ」を入れてから保存する
    const fillTitle = () => {
        const t = document.getElementById('question-text');
        if (PB.board && t && !t.value.trim()) t.value = 'パネルクイズ';
    };
    const origAdd = C.add;
    if (typeof origAdd === 'function') {
        C.add = function () {
            const qs = window.App.Data.createdQuestions || [];
            if (PB.board && this.editingIndex === null && qs.some(q => PB.isBoard(q))) {
                window.App.Ui.showToast('パネルクイズは1セットに1つの盤面です。盤面を直す時は一覧から開いてください');
                return;
            }
            fillTitle();
            return origAdd.apply(this, arguments);
        };
    }
    const origUpdate = C.update;
    if (typeof origUpdate === 'function') {
        C.update = function () { fillTitle(); return origUpdate.apply(this, arguments); };
    }
})();

// ---------------------------------------------------------
// 回答者画面（player.js の updateUI から呼ぶ）
// ---------------------------------------------------------
function renderPlayerPanelBoard(st, p) {
    const pb = st.pb || {};
    let box = document.getElementById('player-panelboard');
    if (!box) {
        box = document.createElement('div');
        box.id = 'player-panelboard';
        const gv = document.getElementById('player-game-view');
        const bar = document.getElementById('player-status-bar');
        gv.insertBefore(box, bar ? bar.nextSibling : gv.firstChild);
    }
    box.classList.remove('hidden');
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const panels = pb.panels || [];
    const mine = st.currentAnswerer === myPlayerId && !pb.finished;
    const out = p.isAlive === false || p.cleared;
    let status;
    if (pb.finished) status = '<div class="pbp-status">このボードは終了しました</div>';
    else if (mine) status = `<div class="pbp-status mine">あなたの番です！ 「◯番、答え」と言ってください${pb.sel !== null && pb.sel !== undefined ? `<small>${pb.sel + 1}番を選択中</small>` : '<small>番号を押して伝えることもできます</small>'}</div>`;
    else if (st.isBuzzActive && !out) status = '<div class="pbp-status"><button type="button" class="pbp-buzz">PUSH!</button></div>';
    else status = `<div class="pbp-status">${st.currentAnswererName ? `${esc(st.currentAnswererName)} さんが解答中` : '解答者を待っています'}</div>`;
    const selP = pb.selQ && pb.sel !== null && pb.sel !== undefined ? panels[pb.sel] : null;
    const btn = (pp, i) => {
        const done = pp.r === 'ok' || pp.r === 'closed';
        const sel = pb.sel === i && !done;
        const face = pp.answer !== null && pp.answer !== undefined ? esc(pp.answer) : pb.board ? esc(pp.pts ?? '') : (pp.label ? esc(pp.label) : '？');
        return `<button type="button" class="pbp-panel ${pp.r || ''} ${sel ? 'sel' : ''}" data-i="${i}" ${!mine || done ? 'disabled' : ''}>
            ${pb.board ? '' : `<span class="pbp-no">${i + 1}</span>`}
            <span class="pbp-label">${face}</span>
        </button>`;
    };
    let gridHtml;
    if (pb.board) {
        // パネルクイズ: ジャンルの帯の下に、点の小さい順
        const L = App.PanelBoard.boardLayout(panels);
        gridHtml = `<div class="pbp-grid" style="grid-template-columns:repeat(${L.cols}, 1fr);">${L.cats.map((c, ci) => `<div class="pbp-cat" style="background:${App.PanelBoard.CAT_COLORS[ci % App.PanelBoard.CAT_COLORS.length]};">${esc(c)}</div>`).join('')}${L.cells.map(row => row.map(i => i === null ? '<div></div>' : btn(panels[i], i)).join('')).join('')}</div>`;
    } else {
        gridHtml = `<div class="pbp-grid" style="grid-template-columns:repeat(${Math.min(6, App.PanelBoard.cols(panels.length))}, 1fr);">${panels.map((pp, i) => btn(pp, i)).join('')}</div>`;
    }
    box.innerHTML = `
        <div class="pbp-theme">${esc(pb.theme || '')}</div>
        ${status}
        ${selP ? `<div class="pbp-q"><b>${pb.sel + 1}. ${esc(selP.label || '')}</b>${esc(pb.selQ)}</div>` : ''}
        ${gridHtml}`;
    box.querySelectorAll('.pbp-panel:not([disabled])').forEach(b => {
        b.onclick = () => {
            window.db.ref(`rooms/${myRoomId}/players/${myPlayerId}/pbPick`).set({ idx: parseInt(b.dataset.i), t: firebase.database.ServerValue.TIMESTAMP });
            box.querySelectorAll('.pbp-panel').forEach(x => x.classList.toggle('sel', x === b));
        };
    });
    const bz = box.querySelector('.pbp-buzz');
    if (bz) bz.onclick = () => { const real = document.getElementById('player-buzz-btn'); if (real) { real.disabled = false; real.click(); } bz.disabled = true; bz.textContent = '判定中…'; };
}
