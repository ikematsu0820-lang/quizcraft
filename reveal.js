/* =========================================================
 * reveal.js — 正解の発表（判定の合図 → 正解の出し方 → 結果・得点）
 *
 * 設定はルールの「発表」タブにまとめる（セット全体の値＝ currentConfig）:
 *   判定の合図   judgeCue     sound（音だけ）| big（〇✕を大きく）| big_name（〇✕と答えた人の名前）
 *                revealTiming host（司会者のボタンで）| auto（正解が出たらすぐ正解を出す）
 *   正解の出し方 revealStyle  band | full | inline | letters（答えが文字の形式）
 *                revealSort   all | one（並べ替え: 一度に／1つずつ並べる）
 *                revealPause  now | tame（ためてから出す）
 *                rvWinners / rvCount / rvDist / rvRate / rvNote   一緒に出すもの（'on' / 'off'）
 *   結果・得点   rvGain（正解者の名前に＋点）・1問ごとの結果発表・解答者の端末の得点
 * 問題ごとの上書き（問題を書く画面の「この問題の正解表示」）:
 *   q.revealStyle（count＝数字のカウント も選べる）・q.imgReveal（blur | zoom）・q.publicRate・q.commentary
 * 以前の見た目の設定（design.revealStyle / revealWinners）も読む。
 * =======================================================*/
window.App = window.App || {};

App.Reveal = {
    STYLES: [
        { v: 'band', t: '帯', sub: '問題文を残す' },
        { v: 'full', t: '全画面', sub: '答えを大きく' },
        { v: 'inline', t: '問題文の下', sub: '問題文に添える' },
        { v: 'letters', t: '1文字ずつ', sub: '文字を順に表示' },
    ],
    DEF: { revealStyle: 'band', revealPause: 'now', revealSort: 'all', rvWinners: 'on', rvCount: 'off', rvDist: 'off', rvRate: 'on', rvNote: 'on', rvGain: 'off', judgeCue: 'sound', revealTiming: 'host' },
    TAME_MS: 1800,

    // ---------------------------------------------------------
    // 共通
    // ---------------------------------------------------------
    esc: function (v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    kindOf: function (type) {
        const t = String(type || '');
        if (/^(free|assoc|letter_select)/.test(t)) return 'text';
        if (/^choice/.test(t) || t === 'dobon') return 'choice';
        if (t === 'sort') return 'sort';
        if (/^(multi|ranking)/.test(t)) return 'multi';
        return 'other';
    },
    // 今作っているセットで、答えが文字の形式か
    applies: function () {
        const C = window.App.Creator;
        return this.kindOf(C && C.currentType) === 'text';
    },
    // 値を決める: 問題 → セット（ルール） → 以前の見た目の設定 → 最初の値
    get: function (key, conf, d, q) {
        if (q && q[key] !== undefined && q[key] !== null && q[key] !== '') return q[key];
        if (conf && conf[key] !== undefined && conf[key] !== null && conf[key] !== '') return conf[key];
        if (key === 'revealStyle' && d && d.revealStyle) return d.revealStyle;
        if (key === 'rvWinners' && d && d.revealWinners === 'off') return 'off';
        return this.DEF[key];
    },
    on: function (key, conf, d, q) { return this.get(key, conf, d, q) !== 'off'; },
    hasJudge: function (conf) { return ['buzz', 'turn', 'nominate'].includes((conf || {}).mode); },

    faint: function (c) { return !c || c === 'transparent' || (/rgba\([^)]*,\s*0(\.\d+)?\)$/.test(c) && parseFloat(c.split(',').pop()) < 0.35); },
    // 地の色に乗る文字の色（明るい地なら黒、暗い地なら白）
    textOn: function (bg) {
        const m = String(bg || '').match(/^#([0-9a-f]{6})$/i);
        if (!m) return '#ffffff';
        const n = parseInt(m[1], 16);
        const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
        return l > 0.6 ? '#111111' : '#ffffff';
    },
    colors: function (d) {
        const accent = d.accentColor || (!this.faint(d.qBorderColor) ? d.qBorderColor : '') || '#f59e0b';
        const bg = !this.faint(d.revealBgColor) ? d.revealBgColor : accent;
        const fg = d.revealTextColor || this.textOn(bg);
        const line = !this.faint(d.revealBorderColor) ? d.revealBorderColor : bg;
        const qfg = d.qTextColor || this.textOn(d.mainBgColor);
        return { accent, bg, fg, line, qfg };
    },
    setVars: function (el, c) {
        el.style.setProperty('--rv-bg', c.bg);
        el.style.setProperty('--rv-fg', c.fg);
        el.style.setProperty('--rv-line', c.line);
        el.style.setProperty('--rv-accent', c.accent);
        el.style.setProperty('--rv-qfg', c.qfg);
    },
    viewerConf: function () { return (window.App.Viewer && window.App.Viewer.config) || {}; },
    players: function () { return (window.App.Viewer && window.App.Viewer._players) || {}; },

    // ---------------------------------------------------------
    // 正解した人・人数・選んだ人数（モニター）
    // ---------------------------------------------------------
    isRight: function (p, q) {
        if (!p) return false;
        if (p.lastResult === 'win' || p.pendingResult === 'win') return true;
        if (this.kindOf(q.type) === 'choice' && p.lastAnswer !== undefined && p.lastAnswer !== null && p.lastAnswer !== '') {
            const corr = (Array.isArray(q.correct) ? q.correct : [q.correctIndex !== undefined ? q.correctIndex : q.correct]).map(Number);
            if (Array.isArray(p.lastAnswer)) return JSON.stringify(p.lastAnswer.map(Number).sort()) === JSON.stringify(corr.slice().sort());
            return corr.includes(Number(p.lastAnswer));
        }
        return false;
    },
    tally: function (q, st) {
        const list = Object.values(this.players()).filter(p => p && p.name);
        const judged = this.hasJudge(this.viewerConf());
        const winners = (st.revealWinners && st.revealWinners.length) ? st.revealWinners
            : judged ? [] : list.filter(p => this.isRight(p, q)).map(p => p.name);
        const right = judged ? winners.length : list.filter(p => this.isRight(p, q)).length;
        const dist = {};
        list.forEach(p => {
            const a = p.lastAnswer;
            (Array.isArray(a) ? a : [a]).forEach(v => { const i = parseInt(v); if (!isNaN(i)) dist[i] = (dist[i] || 0) + 1; });
        });
        return { total: list.length, right, winners, dist };
    },

    // 一緒に出すもの（正解者・人数・世間の正解率・解説）
    extrasHtml: function (q, st, d, conf) {
        const parts = [];
        const t = this.tally(q, st);
        if (this.on('rvWinners', conf, d, q) && t.winners.length) {
            const gains = {};
            if (this.on('rvGain', conf, d, q)) (st.revealGains || []).forEach(x => { if (x && x.n) gains[x.n] = x.g; });
            parts.push(`<div class="rv-who">正解者${t.winners.map(n => `<span class="rv-name">${this.esc(n)}${gains[n] ? `<b class="rv-gain">+${gains[n]}</b>` : ''}</span>`).join('')}</div>`);
        }
        const stats = [];
        if (this.on('rvCount', conf, d, q) && t.total) stats.push(`<span class="rv-stat">正解 <b class="rv-count">${t.right}</b>人 / ${t.total}人</span>`);
        const rate = q.publicRate;
        if (this.on('rvRate', conf, d, q) && rate !== undefined && rate !== null && rate !== '') stats.push(`<span class="rv-stat">世間の正解率 <b>${this.esc(rate)}</b>%</span>`);
        if (stats.length) parts.push(`<div class="rv-stats">${stats.join('')}</div>`);
        const note = st.commentary || q.commentary || '';
        if (this.on('rvNote', conf, d, q) && note) parts.push(`<div class="rv-note">${this.esc(note)}</div>`);
        return parts.join('');
    },

    // ---------------------------------------------------------
    // ため（正解は……）— true の間は呼び出し側は正解を描かない
    // ---------------------------------------------------------
    holding: function (mainText, q, st, d, conf) {
        conf = conf || this.viewerConf();
        if (this.get('revealPause', conf, d, q) !== 'tame') return false;
        const key = `${st.qIndex}`;
        if (this._tamed === key) return false;
        mainText.querySelectorAll('.rv-tame').forEach(e => e.remove());
        const el = document.createElement('div');
        el.className = 'rv-tame';
        this.setVars(el, this.colors(d || {}));
        el.innerHTML = '<span>正解は</span><i></i><i></i><i></i>';
        mainText.appendChild(el);
        if (!this._tameTimer) {
            this._tameTimer = setTimeout(() => {
                this._tameTimer = null;
                this._tamed = key;
                const V = window.App.Viewer;
                const cur = V && V._st;
                if (cur && String(cur.qIndex) === key && ['reveal_correct', 'answer'].includes(cur.step)) V.render(cur);
            }, this.TAME_MS);
        }
        return true;
    },
    // 正解の画面から離れたら、次の発表でまたためる・動きを付ける
    resetFor: function (st) {
        if (!st || ['reveal_correct', 'answer'].includes(st.step)) return;
        this._tamed = undefined;
        this._shown = null;
        this._live = null;
    },
    // 同じ発表を描き直す時（得点の更新など）は動きを付けない
    stillKey: function (st) {
        const key = `${st.qIndex}`;
        const still = this._shown === key;
        this._shown = key;
        return still;
    },

    // ---------------------------------------------------------
    // 答えが文字の形式（一問一答・連想・文字パネル）
    // ---------------------------------------------------------
    numParts: function (s) {
        const m = String(s || '').trim().match(/^([^\d\-]*)(-?[\d,]*\.?\d+)(.*)$/);
        if (!m) return null;
        const n = parseFloat(m[2].replace(/,/g, ''));
        if (isNaN(n)) return null;
        return { pre: m[1], n, post: m[3], comma: /,/.test(m[2]) || Math.abs(n) >= 10000, dec: (m[2].split('.')[1] || '').length };
    },
    fmtNum: function (v, p) {
        const s = v.toFixed(p.dec);
        if (!p.comma) return s;
        const [a, b] = s.split('.');
        return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : '');
    },
    countUp: function (el, p) {
        const t0 = performance.now(), dur = 1600;
        const step = (now) => {
            if (!el.isConnected) return;
            const k = Math.min(1, (now - t0) / dur);
            el.textContent = this.fmtNum(p.n * (1 - Math.pow(1 - k, 3)), p);
            if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    render: function (mainText, q, st, d, conf) {
        d = d || {};
        conf = conf || this.viewerConf();
        let style = this.get('revealStyle', conf, d, q);
        const still = this.stillKey(st);
        const raw = String(st.correct || '');
        const ans = this.esc(raw);
        const len = raw.length;
        const size = d.revealFontSize || null;
        const extras = this.extrasHtml(q, st, d, conf);
        const num = style === 'count' ? this.numParts(raw) : null;
        if (style === 'count' && !num) style = 'full';
        mainText.querySelectorAll('.rv-box, .rv-tame').forEach(e => e.remove());
        const box = document.createElement('div');
        const big = style === 'full' || style === 'letters' || style === 'count';
        box.className = `rv-box rv-${big ? 'full' : style}${still ? ' rv-still' : ''}`;
        this.setVars(box, this.colors(d));
        if (big) {
            box.style.background = d.mainBgColor || '#0a0a0a';
            let core;
            if (style === 'letters') {
                const chars = [...raw];
                const fs = size || (chars.length > 12 ? '7cqh' : chars.length > 7 ? '10cqh' : '14cqh');
                let n = 0;
                core = `<div class="rv-letters" style="font-size:${fs};">${chars.map(ch => ch.trim() ? `<span class="rv-ch" style="animation-delay:${(0.2 + (n++) * 0.32).toFixed(2)}s">${this.esc(ch)}</span>` : '<span class="rv-sp"></span>').join('')}</div>`;
            } else if (style === 'count') {
                core = `<div class="rv-ans rv-num" style="font-size:${size || '16cqh'};">${this.esc(num.pre)}<span class="rv-digits">${this.fmtNum(still ? num.n : 0, num)}</span>${this.esc(num.post)}</div>`;
            } else {
                const fs = size || (len > 20 ? '8cqh' : len > 10 ? '12cqh' : '18cqh');
                core = `<div class="rv-ans" style="font-size:${fs};">${ans}</div>`;
            }
            box.innerHTML = `<div class="rv-label">正解</div>${core}${extras}`;
            mainText.appendChild(box);
            if (style === 'count' && !still) this.countUp(box.querySelector('.rv-digits'), num);
        } else if (style === 'inline') {
            const fs = size || (len > 20 ? '5cqh' : '7cqh');
            box.innerHTML = `<span class="rv-mark">正解</span><span class="rv-ans" style="font-size:${fs};">${ans}</span>${extras}`;
            const qa = mainText.querySelector('.q-area');
            if (qa && qa.parentNode) qa.parentNode.insertBefore(box, qa.nextSibling); else mainText.appendChild(box);
        } else {
            const fs = size || (len > 20 ? '5.5cqh' : len > 10 ? '7.5cqh' : '9cqh');
            box.innerHTML = `<div class="rv-row"><span class="rv-mark">正解</span><span class="rv-ans" style="font-size:${fs};">${ans}</span></div>${extras ? `<div class="rv-sub">${extras}</div>` : ''}`;
            mainText.appendChild(box);
        }
        this._live = { q, st };
    },

    // ---------------------------------------------------------
    // 選択式・並べ替え: 選んだ人数を選択肢に・下に正解した人数などの帯
    // ---------------------------------------------------------
    choiceExtras: function (mainText, q, st, d, conf) {
        d = d || {};
        conf = conf || this.viewerConf();
        const still = this.stillKey(st);
        mainText.querySelectorAll('.rv-dist, .rv-strip').forEach(e => e.remove());
        if (this.kindOf(q.type) === 'choice' && this.on('rvDist', conf, d, q)) {
            const t = this.tally(q, st);
            mainText.querySelectorAll('.choice-item').forEach((el, i) => {
                if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
                const b = document.createElement('span');
                b.className = 'rv-dist' + (still ? ' rv-still' : '');
                b.dataset.i = i;
                b.textContent = `${t.dist[i] || 0}人`;
                el.appendChild(b);
            });
        }
        const extras = this.extrasHtml(q, st, d, conf);
        if (extras) {
            const strip = document.createElement('div');
            strip.className = 'rv-strip' + (still ? ' rv-still' : '');
            this.setVars(strip, this.colors(d));
            strip.innerHTML = extras;
            const col = this.kindOf(q.type) === 'sort' ? mainText.querySelector(':scope > div') : null;
            if (col) { strip.classList.add('rv-flow'); col.appendChild(strip); } else mainText.appendChild(strip);
        }
        this._live = { q, st };
    },

    // 解答者の答え・判定が届いたら、人数だけ差し替える
    updateLive: function () {
        const L = this._live;
        const V = window.App.Viewer;
        if (!L || !V || !V._st || !['reveal_correct', 'answer'].includes(V._st.step) || String(V._st.qIndex) !== String(L.st.qIndex)) return;
        const t = this.tally(L.q, L.st);
        document.querySelectorAll('#viewer-main-text .rv-count').forEach(el => { el.textContent = t.right; });
        document.querySelectorAll('#viewer-main-text .rv-dist').forEach(el => { el.textContent = `${t.dist[el.dataset.i] || 0}人`; });
    },

    // 並べ替え: 1つずつ並べる時の間隔（秒）
    sortDelay: function (q, conf) {
        return this.get('revealSort', conf || this.viewerConf(), (q && q.design) || {}, q) === 'one' ? 0.9 : 0.07;
    },

    // ---------------------------------------------------------
    // 画像の答え合わせ — 出題中はぼかす／拡大、正解でくっきり全体に
    // ---------------------------------------------------------
    afterLayout: function (mainText, q, st) {
        const mode = q && q.imgReveal;
        if (!mode || !st || !mainText) return;
        const asking = ['reveal_q', 'answering', 'question', 'closed', 'judging'].includes(st.step);
        const answer = ['reveal_correct', 'answer'].includes(st.step);
        if (!asking && !answer) return;
        const cls = mode === 'zoom' ? 'rv-img-zoom' : 'rv-img-blur';
        mainText.querySelectorAll('img.q-photo').forEach(img => {
            let wrap = img.parentElement;
            if (!wrap.classList.contains('rv-imgwrap')) {
                wrap = document.createElement('span');
                wrap.className = 'rv-imgwrap';
                img.parentNode.insertBefore(wrap, img);
                wrap.appendChild(img);
            }
            if (asking) { img.classList.add(cls); this._imgShown = null; return; }
            if (this._imgShown === st.qIndex) return; // 発表済み — くっきりのまま
            this._imgShown = st.qIndex;
            img.classList.add(cls);
            void img.offsetWidth;
            setTimeout(() => img.classList.remove(cls), 60);
        });
    },

    // ---------------------------------------------------------
    // 判定の合図 — 〇✕を大きく（司会者が判定した瞬間）
    // ---------------------------------------------------------
    judgeFlash: function (stage, st) {
        const cue = st && st.judgeCue;
        const mode = this.get('judgeCue', this.viewerConf(), {}, null);
        if (!cue || !stage || mode === 'sound' || cue.at === this._cueAt) return;
        this._cueAt = cue.at;
        const off = (window.App.Viewer && window.App.Viewer._serverOffset) || 0;
        if (Date.now() + off - cue.at > 15000) return; // 開き直した時に古い判定を出さない
        stage.querySelectorAll('.rv-judge').forEach(e => e.remove());
        const el = document.createElement('div');
        el.className = `rv-judge ${cue.ok ? 'ok' : 'ng'}`;
        el.innerHTML = `<div class="rv-judge-mark"></div>${mode === 'big_name' && cue.name ? `<div class="rv-judge-name">${this.esc(cue.name)}</div>` : ''}`;
        stage.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    },

    // ---------------------------------------------------------
    // ルールの「発表」タブ
    // ---------------------------------------------------------
    flagRow: function (key, label, conf, sub) {
        const on = this.get(key, conf, window.App.Data.currentDesign || {}, null) !== 'off';
        return `<label class="rv-flag"><input type="checkbox" data-rv-flag="${key}" ${on ? 'checked' : ''}><span>${label}${sub ? `<small>${sub}</small>` : ''}</span></label>`;
    },
    // デザイン › 正解表示 — 判定演出と正解表示（値はセットのルールと同じ所 currentConfig に持つ）
    renderDesign: function (box, conf, onSoft) {
        if (!box || !conf) return;
        const R = window.App.RulePanel;
        const C = window.App.Creator;
        const kind = this.kindOf(C && C.currentType);
        const d = window.App.Data.currentDesign || {};
        const judge = this.hasJudge(conf);
        const g = (k) => this.get(k, conf, d, null);
        const tiles = (key, items) => R.tiles('rv-' + key, items.map(o => ({ value: o.v, label: o.t, sub: o.sub })), g(key));
        const sec = (title, sub, inner) => `<section class="rv-sec"><div class="rv-sec-head"><b>${title}</b><span>${sub}</span></div>${inner}</section>`;
        let a = '';
        if (judge) {
            a += tiles('judgeCue', [{ v: 'sound', t: '効果音のみ' }, { v: 'big', t: '〇✕を大きく' }, { v: 'big_name', t: '〇✕＋名前' }]);
            a += R.head('正解後');
            a += tiles('revealTiming', [{ v: 'host', t: '司会者の操作で', sub: '正解者の発表をはさむ' }, { v: 'auto', t: '即正解表示', sub: '発表をはさまない' }]);
        }
        let b = '';
        if (kind === 'text') b += R.head('表示方法') + tiles('revealStyle', this.STYLES);
        else if (kind === 'choice') b += R.note('選択式は、正解の選択肢が光ってほかが暗くなります。');
        else if (kind === 'sort') b += R.head('並べ方') + tiles('revealSort', [{ v: 'all', t: '一括表示' }, { v: 'one', t: '1つずつ表示' }]);
        else if (kind === 'multi') b += R.note('多答・ランキングは、司会者の画面で答えを1つずつ開きます。「残りを開く」「下から開く」でまとめて開くこともできます。');
        else b += R.note('この形式は、盤面やゲームの画面のまま正解を見せます。');
        if (['text', 'choice', 'sort'].includes(kind)) {
            b += R.head('表示タイミング') + tiles('revealPause', [{ v: 'now', t: '即表示' }, { v: 'tame', t: 'ため演出', sub: '「正解は…」をはさむ' }]);
            b += R.head('併せて表示');
            b += this.flagRow('rvWinners', '正解者名', conf);
            b += this.flagRow('rvGain', '正解者名に獲得点', conf, '例: 山田 +10');
            b += this.flagRow('rvCount', '正解者数', conf);
            if (kind === 'choice') b += this.flagRow('rvDist', '選択人数', conf, '選択肢ごと');
            b += this.flagRow('rvRate', '世間の正解率', conf, '問題に入力した時');
            b += this.flagRow('rvNote', '解説', conf, '問題に入力した時');
        }
        box.innerHTML = (judge ? sec('判定演出', '〇✕を判定した瞬間', a) : '') + sec('正解表示', 'モニターに正解を出す時', b);
        box.querySelectorAll('.rp-tile[data-rp^="rv-"]').forEach(btn => {
            btn.onclick = () => { conf[btn.dataset.rp.slice(3)] = btn.dataset.val; this.renderDesign(box, conf, onSoft); if (onSoft) onSoft(); };
        });
        box.querySelectorAll('input[data-rv-flag]').forEach(chk => {
            chk.onchange = () => { conf[chk.dataset.rvFlag] = chk.checked ? 'on' : 'off'; if (onSoft) onSoft(); };
        });
    },

    // セットの設定の一覧に出す行（判定の合図・正解の出し方・結果と得点）
    summaryRows: function (conf) {
        const C = window.App.Creator;
        const kind = this.kindOf(C && C.currentType);
        const d = window.App.Data.currentDesign || {};
        const g = (k) => this.get(k, conf, d, null);
        const rows = [];
        if (this.hasJudge(conf)) {
            const cue = { sound: '効果音のみ', big: '〇✕を大きく', big_name: '〇✕＋名前' }[g('judgeCue')] || '効果音のみ';
            rows.push({ key: 'judge', label: '判定演出', value: cue + (g('revealTiming') === 'auto' ? '・即正解表示' : '') });
        }
        let how = kind === 'text' ? (this.STYLES.find(o => o.v === g('revealStyle')) || this.STYLES[0]).t
            : kind === 'choice' ? '正解が光る' : kind === 'sort' ? (g('revealSort') === 'one' ? '1つずつ表示' : '一括表示')
            : kind === 'multi' ? '1つずつ開く' : '盤面のまま';
        if (['text', 'choice', 'sort'].includes(kind)) {
            if (g('revealPause') === 'tame') how += '・ため演出';
            const w = [];
            if (g('rvWinners') !== 'off') w.push('正解者');
            if (g('rvCount') !== 'off') w.push('人数');
            if (kind === 'choice' && g('rvDist') !== 'off') w.push('選んだ人数');
            if (w.length) how += '・' + w.join('と');
        }
        rows.push({ key: 'reveal', label: '正解表示', value: how });
        return rows;
    },
    // 以前の版（見た目の設定）の要約
    summary: function (d) {
        const s = this.STYLES.find(o => o.v === ((d && d.revealStyle) || 'band')) || this.STYLES[0];
        return s.t + ((d && d.revealWinners === 'off') ? '' : '・正解者の名前');
    },

    // ---------------------------------------------------------
    // 問題を書く画面: 「この問題の正解表示」
    // ---------------------------------------------------------
    Q_KEYS: ['revealStyle', 'imgReveal', 'publicRate', 'commentary'],
    pickQ: function (q) {
        const o = {};
        if (q && q.themeId) o.themeId = q.themeId; // この問題だけのテーマ
        this.Q_KEYS.forEach(k => { if (q && q[k] !== undefined && q[k] !== null && q[k] !== '') o[k] = q[k]; });
        return o;
    },
    // 保存する値（空は null で消す）
    qFields: function (s) {
        const o = {};
        this.Q_KEYS.forEach(k => { const v = s && s[k]; o[k] = (v === undefined || v === null || v === '') ? null : v; });
        return o;
    },
    mountQuestionBox: function () {
        const C = window.App.Creator;
        const Th = window.App.Themes;
        if (!C) return;
        document.querySelectorAll('.rv-qbox').forEach(e => e.remove());
        const kind = this.kindOf(C.currentType);
        const M = window.App.CreatorMobile;
        // スマホは正解の欄の下（#creator-outside-opts）、PCは「この問題」のタブ
        const host = (M && M.isMobile && M.isMobile()) ? (document.getElementById('creator-outside-opts') || document.getElementById('creator-form-container')) : document.getElementById('creator-options-extra');
        if (!host) return;
        C.qReveal = C.qReveal || {};
        const s = C.qReveal;
        const conf = window.App.Data.currentConfig || {};
        const d = window.App.Data.currentDesign || {};
        const opts = (list, cur) => list.map(o => `<option value="${o.v}" ${String(cur || '') === o.v ? 'selected' : ''}>${o.t}</option>`).join('');
        const boxes = [];
        // この問題のデザイン — テーマ（どの形式でも）・正解の表示方法（答えが文字の形式）
        const setStyle = (this.STYLES.find(o => o.v === this.get('revealStyle', conf, d, null)) || this.STYLES[0]).t;
        const lookSet = () => !!(s.themeId || s.revealStyle);
        const lookSum = () => [s.themeId && Th && Th.get(s.themeId) ? Th.get(s.themeId).name : '', s.revealStyle ? ((this.STYLES.find(o => o.v === s.revealStyle) || {}).t || '数字のカウント') : ''].filter(Boolean).join('・') || 'セットと同じ';
        const look = document.createElement('details');
        look.className = 'rv-qbox rv-lookbox';
        look.open = lookSet() || !!this._lookOpen;
        look.innerHTML = `<summary><span>この問題のデザイン</span><small>${this.esc(lookSum())}</small></summary>
            <div class="rv-qgrid">
                ${Th && Th.list ? `<label><span>テーマ</span><select data-rvq="themeId">${opts([{ v: '', t: 'セットと同じ' }, ...Th.list.map(t => ({ v: t.id, t: t.name }))], s.themeId)}</select><small>決勝の問題だけ金色に、など。背景画像・ロゴ・音はセットのまま</small></label>` : ''}
                ${kind === 'text' ? `<label><span>正解の表示方法</span><select data-rvq="revealStyle">${opts([{ v: '', t: `セットと同じ（${setStyle}）` }, ...this.STYLES.map(o => ({ v: o.v, t: o.t })), { v: 'count', t: '数字のカウント（答えが数字の時）' }], s.revealStyle)}</select></label>` : ''}
            </div>`;
        look.addEventListener('toggle', () => { this._lookOpen = look.open; });
        boxes.push([look, lookSum]);
        // 解説・正解率 — 正解表示の時に添える（答えが文字・選択式・並べ替え）
        if (['text', 'choice', 'sort'].includes(kind)) {
            const noteSum = () => [s.commentary ? '解説あり' : '', (s.publicRate ?? '') !== '' ? `正解率${s.publicRate}%` : ''].filter(Boolean).join('・') || 'なし';
            const note = document.createElement('details');
            note.className = 'rv-qbox rv-notebox';
            note.open = !!(s.commentary || (s.publicRate ?? '') !== '') || !!this._noteOpen;
            note.innerHTML = `<summary><span>解説・正解率</span><small>${this.esc(noteSum())}</small></summary>
                <div class="rv-qgrid">
                    <label><span>解説</span><textarea rows="2" data-rvq="commentary" placeholder="正解のあとに添えるひとこと">${this.esc(s.commentary || '')}</textarea></label>
                    <label><span>世間の正解率</span><span class="rv-qnum"><input type="number" min="0" max="100" step="1" inputmode="numeric" data-rvq="publicRate" value="${s.publicRate ?? ''}" placeholder="なし"> %</span></label>
                </div>`;
            note.addEventListener('toggle', () => { this._noteOpen = note.open; });
            boxes.push([note, noteSum]);
        }
        boxes.forEach(([el]) => host.appendChild(el));
        // あとから足される設定（シャッフルなど）より下に置く
        setTimeout(() => { boxes.forEach(([el]) => { if (el.isConnected) host.appendChild(el); }); }, 0);
        boxes.forEach(([el, sum]) => {
            el.querySelectorAll('[data-rvq]').forEach(inp => {
                const k = inp.dataset.rvq;
                const read = () => {
                    let v = inp.value;
                    if (k === 'publicRate' && v !== '') v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
                    if (v === '' || v === null) delete s[k]; else s[k] = v;
                    const sm = el.querySelector('summary small');
                    if (sm) sm.textContent = sum();
                    if (k === 'themeId') { const Mo = window.App.CreatorMobile; if (Mo && Mo.renderSheetStage) try { Mo.renderSheetStage(); } catch (e) { /* 次の描き直しで */ } }
                };
                inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', read);
            });
        });
    },

    // 問題の画面を描く関数に、あとから付け足す（作成画面・モニター）
    hook: function () {
        const C = window.App.Creator;
        if (C && C.renderForm && !C.renderForm._rv) {
            const orig = C.renderForm;
            C.renderForm = function () { const r = orig.apply(this, arguments); try { App.Reveal.mountQuestionBox(); } catch (e) { console.warn(e); } return r; };
            C.renderForm._rv = true;
        }
        const V = window.App.Viewer;
        if (V && V.renderQuestionLayout && !V.renderQuestionLayout._rv) {
            const orig = V.renderQuestionLayout;
            V.renderQuestionLayout = function (vc, mainText, q, st) { const r = orig.apply(this, arguments); try { App.Reveal.afterLayout(mainText, q, st || this._st); } catch (e) { console.warn(e); } return r; };
            V.renderQuestionLayout._rv = true;
        }
    },
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.Reveal.hook()); else setTimeout(() => App.Reveal.hook(), 0);
