/* =========================================================
 * rule_panel.js — 作成画面の「ルール」パネル
 *
 * クイズのルールを5つの軸に分けて、どの組み合わせでも矛盾しないように
 * 組み立てる（使える・使えないの判定は rule_engine.js の表）。
 *   答え方   … 口頭／手書き（出題者が判定）・ボタン（自動で判定）と、
 *              解答権（全員／条件を満たした人＝早押し／特定の人＝順番・指名）
 *   正解     … 正解時の得点の入れ方（一律・速さで傾斜・ヒント数・先着）
 *   誤答     … 間違えた時の問題の扱いと、間違えた人へのペナルティ
 *   勝ち方   … 得点制／サバイバル／勝ち抜け／タイムレース
 *   時間     … 制限時間と、解答者の持ち時間
 * 各タブは「基本」の設定だけを出し、細かい設定は「詳細設定」に入れる。
 * 一番上に、今の設定を文章にした「遊び方」を出す。
 * =======================================================*/

window.App = window.App || {};

App.RulePanel = {
    SEL: 'width:100%; margin:0; padding:6px 8px; background:#1b1b20; border:1px solid #3a3a42; border-radius:8px; color:#fff; font-size:0.85rem;',

    RE: function () { return window.App.RuleEngine; },
    Cfg: function () { return window.App.Config; },

    // ---------------------------------------------------------
    // 部品
    // ---------------------------------------------------------
    tiles: function (name, items, current) {
        return `<div class="rp-tiles" data-n="${items.length}">${items.map(it => `
            <button type="button" class="rp-tile ${current === it.value ? 'on' : ''}" data-rp="${name}" data-val="${it.value}" ${it.disabled ? 'disabled' : ''} title="${it.disabled ? (it.why || '') : ''}">
                <span class="rp-tile-label">${it.label}</span>
                ${it.sub ? `<span class="rp-tile-sub">${it.sub}</span>` : ''}
            </button>`).join('')}</div>`;
    },
    row: function (label, inner) {
        return `<div class="rp-row"><span class="rp-row-label">${label}</span><div class="rp-row-body">${inner}</div></div>`;
    },
    select: function (id, opts, val) {
        return `<select id="${id}" style="${this.SEL}">${opts.map(o => `<option value="${o.v}" ${String(val) === String(o.v) ? 'selected' : ''}>${o.t}</option>`).join('')}</select>`;
    },
    head: function (t) { return `<div class="rp-head">${t}</div>`; },
    // 数字は選ばせずに自由に入れる — unit は単位、zero は「0 の時の意味」（例: なし）
    num: function (id, val, unit, opt) {
        const o = opt || {};
        const v = (val === undefined || val === null || val === '') ? '' : val;
        return `<span class="rp-num"><span class="rp-num-box"><button type="button" class="rp-step" data-step="-1" aria-label="1つ減らす">−</button><input type="number" id="${id}" value="${v}" ${o.min !== undefined ? `min="${o.min}"` : 'min="0"'} ${o.max !== undefined ? `max="${o.max}"` : ''} step="${o.step || 1}" inputmode="${o.step && o.step < 1 ? 'decimal' : 'numeric'}" placeholder="${o.placeholder || ''}"><button type="button" class="rp-step" data-step="1" aria-label="1つ増やす">＋</button></span><span class="rp-num-unit">${unit || ''}</span>${o.zero ? `<span class="rp-num-hint">0＝${o.zero}</span>` : ''}</span>`;
    },
    // 入れた数字を読む（空や変な値は既定に）
    readNum: function (el, def, min, max) {
        let n = parseFloat(el.value);
        if (isNaN(n)) n = def;
        if (min !== undefined) n = Math.max(min, n);
        if (max !== undefined) n = Math.min(max, n);
        return n;
    },
    note: function (t) { return t ? `<p class="rule-adv-note">${t}</p>` : ''; },

    // ---------------------------------------------------------
    // 全体
    // ---------------------------------------------------------
    render: function (conf, questions, onChange) {
        const RE = this.RE();
        if (!RE || !conf) return;
        this._conf = conf;
        this._questions = questions;
        this._onChange = onChange;
        RE.normalize(conf, questions);
        this.renderSummary();
        this.renderFormat(document.getElementById('creator-inline-mode-body'));
        this.renderCorrect(document.getElementById('creator-inline-correct'));
        this.renderWrong(document.getElementById('creator-inline-wrong-body'));
        this.renderWin(document.getElementById('creator-inline-gametype'));
        this.renderTime(document.getElementById('creator-inline-timelimit'));
    },

    changed: function () {
        if (this._onChange) this._onChange();
        else this.render(this._conf, this._questions, null);
    },

    // 文字を打っている間は描き直さず、遊び方の文だけ更新する
    soft: function () { this.renderSummary(); },

    renderSummary: function () {
        const box = document.getElementById('creator-rules-summary');
        if (!box) return;
        box.innerHTML = `<span class="rp-sum-label">今のルール</span>${this.RE().describe(this._conf, this._questions)}`;
    },

    ctx: function () { return this.RE().context(this._conf, this._questions); },

    // ---------------------------------------------------------
    // 答え方（答え方の3つと、解答権の3つ）
    // ---------------------------------------------------------
    renderFormat: function (box) {
        if (!box) return;
        const conf = this._conf, RE = this.RE(), ctx = this.ctx();
        // 答え方 — 口頭と手書きは、同じ系統の形式（一問一答・多答・連想）なら切り替えられる
        const subSel = document.getElementById('creator-opt-subtype');
        const subOpts = subSel ? [...subSel.options].map(o => o.value) : [];
        const hasOral = subOpts.some(v => /_oral$/.test(v));
        const hasWritten = subOpts.some(v => /_written$/.test(v));
        const by = ctx.answerBy;
        const answerTiles = RE.ANSWER_BY.map(a => {
            let disabled = false, why = '';
            if (a.value === 'button') { disabled = by !== 'button'; why = '選択式・並べ替えなど、ボタンで選ぶ形式の時です'; }
            else if (by === 'button') { disabled = true; why = '一問一答・多答・連想の時に選べます'; }
            else if (a.value === 'oral') disabled = !hasOral && by !== 'oral';
            else if (a.value === 'written') disabled = !hasWritten && by !== 'written';
            return { value: a.value, label: a.label, sub: a.judge, disabled, why };
        });

        // 解答権 — 遊び方を選ぶ画面と同じ4つ（早押し／全員で／順番に／指名して）を1段で
        const modes = RE.modes(ctx);
        const allowed = (m) => { const x = modes.find(y => y.value === m); return !!(x && !x.disabled && !x.hidden); };
        const whyOf = (m) => { const x = modes.find(y => y.value === m); return (x && x.reason) || 'この形式では使えません'; };
        const modeTiles = RE.WHO_ORDER.map(m => ({ value: m, label: RE.WHO[m].label, sub: RE.WHO[m].sub, disabled: !allowed(m), why: whyOf(m) }));

        const modeNote = {
            normal: '全員が手元の端末で同時に答えます。',
            buzz: '一番早く押した人が答えます。誤答の時の扱いは「誤答」のタブで決めます。',
            turn: '順番は出題前に司会者が決めます。',
            nominate: '司会者が参加者リストから指名した人が答えます。',
        }[conf.mode] || '';

        // ゲーム（ダウト・数字予想）は進め方が決まっている — 選ぶものは出さず、進め方だけ
        if (ctx.isDobon || ctx.isBlackjack) {
            box.innerHTML = `
                ${this.head(ctx.isDobon ? 'ダウトの進め方' : '数字予想の進め方')}
                <p class="rule-basic-note">${ctx.isDobon
                    ? '決めた順番に1人ずつ、選択肢から1つ選びます。ダウト（外れ）を選んだら、その問題は終わりです。選んだ答えは自動で判定します。'
                    : '決めた順番に1人ずつカードを選び、合計を目標の数に近づけます。'}</p>
                <div id="rp-mode-detail"></div>`;
            const detail = box.querySelector('#rp-mode-detail');
            if (ctx.isDobon && conf.mode === 'turn') {
                detail.innerHTML = this.Cfg()._modeDetailFieldsHtml('turn', conf, ctx.qType, true).replace(/<p class="rule-basic-note">[^<]*<\/p>/, '');
                this.Cfg()._wireModeDetailFields(detail, 'turn', conf, () => this.changed());
            }
            return;
        }
        // パネル（パネル指名・パネルクイズ）は口頭で「◯番、答え」と言う形式 — 答え方は選ばない
        const answerHtml = ctx.isPanel
            ? `${this.head('解答形式')}<p class="rule-basic-note">パネルは、答える人が口で「◯番、答え」と言い、司会者が〇×を付けます。</p>`
            : this.answerByHtml(answerTiles, by, ctx);
        box.innerHTML = `
            ${this.head('解答権')}
            ${this.tiles('mode', modeTiles.filter(t => !t.disabled || t.value === conf.mode), conf.mode)}
            <p class="rule-basic-note">${modeNote}</p>
            ${answerHtml}
            <div id="rp-mode-detail"></div>
            ${ctx.writtenBuzz ? this.writtenBuzzHtml(conf) : ''}
            ${/^free/.test((window.App.Creator && window.App.Creator.currentType) || ctx.firstType || '') ? `
            ${this.head('問題文の表示')}
            <label class="rp-check"><input type="checkbox" id="rp-read-aloud" ${conf.readAloud ? 'checked' : ''}><span>問題文を画面に出さない（司会者が読み上げる）</span></label>
            ${this.note('モニターには得点だけが出て、解答者の端末にも問題文は送りません。読み上げの途中で押す、先読みの駆け引きを楽しむ時に。正解はいつもどおり発表します。')}` : ''}`;

        // 解答権ごとの詳細（全員：解答回数・1タップ確定／順番：回し方）
        const detail = box.querySelector('#rp-mode-detail');
        if (conf.mode === 'normal' || (conf.mode === 'turn' && ctx.isDobon)) {
            detail.innerHTML = this.Cfg()._modeDetailFieldsHtml(conf.mode, conf, ctx.qType, ctx.isDobon).replace(/<p class="rule-basic-note">[^<]*<\/p>/, '');
            this.Cfg()._wireModeDetailFields(detail, conf.mode, conf, () => this.changed());
        }

        if (ctx.writtenBuzz) this.wireWrittenBuzz(box, conf);
        const ra = box.querySelector('#rp-read-aloud');
        if (ra) ra.onchange = () => { conf.readAloud = ra.checked || null; this.changed(); };
        box.querySelectorAll('[data-rp="answerBy"]').forEach(b => {
            b.onclick = () => {
                const v = b.dataset.val;
                if (!subSel || v === 'button' || v === by) return;
                const opt = subOpts.find(o => o.endsWith('_' + v));
                if (!opt) return;
                subSel.value = opt;
                subSel.dispatchEvent(new Event('change', { bubbles: true }));
            };
        });
        const setMode = (m) => {
            conf.mode = m;
            const ms = document.getElementById('creator-mode-select');
            if (ms) ms.value = m;
            this.changed();
        };
        box.querySelectorAll('[data-rp="mode"]').forEach(b => {
            b.onclick = () => { if (b.dataset.val !== conf.mode && allowed(b.dataset.val)) setMode(b.dataset.val); };
        });
    },

    // 答え方 — 形式で決まる物は出さない。選べるのが1つだけなら、タイルではなく1行で伝える
    answerByHtml: function (tiles, by, ctx) {
        const open = tiles.filter(t => !t.disabled || t.value === by);
        if (open.length > 1) return `${this.head('解答形式')}${this.tiles('answerBy', open, by)}`;
        const cur = tiles.find(t => t.value === by) || open[0];
        const why = by === 'button'
            ? 'この形式は、手元で選んで自動で判定します。'
            : by === 'oral' ? 'この形式は、口頭で答えて司会者が判定します。' : 'この形式は、手書きで答えて司会者が判定します。';
        return `${this.head('解答形式')}<p class="rp-fixed"><b>${cur ? cur.label : ''}</b><span>${why}</span></p>`;
    },

    // ---------------------------------------------------------
    // 早押し × 手書き — 書くのと押す順番・判定の仕方・正解した後
    // ---------------------------------------------------------
    writtenBuzzHtml: function (conf) {
        const cont = conf.wbAfterCorrect === 'continue';
        const n = parseInt(conf.wbWinCount) || 0;
        return `
            ${this.head('早押し × 手書きの進め方')}
            ${this.row('書くのと押すのは', this.select('rp-wb-timing', [
                { v: 'write_first', t: '書いてから押す' },
                { v: 'push_first', t: '押してから書く' },
            ], conf.wbTiming === 'push_first' ? 'push_first' : 'write_first'))}
            ${this.note(conf.wbTiming === 'push_first'
                ? 'PUSH! で順番を取ってから書きます。誤答した人や押していない人は、その間も考えられます。'
                : '手書き欄に書いてから PUSH! を押すと、答えも一緒に届きます。分かった速さがそのまま順番になります。')}
            ${this.row('判定は', this.select('rp-wb-judge', [
                { v: 'one', t: '1人ずつ' },
                { v: 'queue', t: '押した順に並べる' },
            ], conf.wbJudge === 'queue' ? 'queue' : 'one'))}
            ${this.note(conf.wbJudge === 'queue'
                ? '判定している間も、他の人は押せます。手書きなので答えは聞こえません。押した人の答えが司会者の画面に押した順で並び、上から〇×を付けます。' + (conf.wbTiming === 'push_first' ? '「時間」のタブの解答者の持ち時間は、押してから書くまでの時間になります（過ぎたら誤答）。' : '')
                : '1人を判定している間は、他の人は押せません。')}
            ${this.row('正解した人が出たら', this.select('rp-wb-after', [
                { v: 'end', t: '問題終了' },
                { v: 'continue', t: '抜けて続ける' },
            ], cont ? 'continue' : 'end'))}
            ${cont ? this.row('問題を終えるのは', this.num('rp-wb-count', n, '人正解したら', { zero: '全員が答え終わるまで' })) : ''}
            ${this.note(cont ? '' : '正解が出たら、その問題は終わって正解発表に進みます。')}
            ${cont ? this.note('正解した人はその問題から抜けて、残りの人で続けます。正解した順に点を傾けるには、「正解」のタブで「速さで傾斜」を選びます（1番目・2番目…の点を決められます）。司会者はいつでも問題を打ち切れます。') : ''}`;
    },

    wireWrittenBuzz: function (box, conf) {
        const on = (id, fn) => { const el = box.querySelector('#' + id); if (el) el.onchange = () => fn(el.value); };
        on('rp-wb-timing', v => { conf.wbTiming = v; this.changed(); });
        on('rp-wb-judge', v => { conf.wbJudge = v; this.changed(); });
        on('rp-wb-after', v => { conf.wbAfterCorrect = v; this.changed(); });
        on('rp-wb-count', v => { conf.wbWinCount = Math.max(0, parseInt(v) || 0); this.changed(); });
    },

    // ---------------------------------------------------------
    // 正解（得点の入れ方）
    // ---------------------------------------------------------
    renderCorrect: function (box) {
        if (!box) return;
        const conf = this._conf, RE = this.RE(), ctx = this.ctx();
        if (conf.gameType === 'timerace') {
            box.innerHTML = this.note('勝ち方が「タイムレース」なので、正解は1問1点として数え、同じ数なら解答時間の合計で順位を決めます。');
            return;
        }
        const canRanked = RE.can('scoreRanked', ctx), canHint = RE.can('scoreHint', ctx);
        const types = [{ value: 'uniform', label: '同じ点', sub: '正解者は全員同じ点' }]
            .concat([{ value: 'first', label: '先着', sub: '先着◯人のみ' }])
            .concat(canHint.ok ? [{ value: 'hint', label: 'ヒント数で傾斜', sub: '少ないヒントほど高い点' }] : []);
        // 速い順の傾斜は「時間」タブの「スピード勝負」で決める（ここではそのまま残す）
        const isRanked = conf.scoreType === 'ranked' && canRanked.ok;
        const st = isRanked ? 'ranked' : (types.some(t => t.value === conf.scoreType) ? conf.scoreType : 'uniform');
        conf.scoreType = st;
        const numSel = (id, list, val, unit) => this.select(id, list.map(n => ({ v: n, t: `${n}${unit}` })), val);

        let basic = '';
        if (st === 'uniform') {
            const v = conf.uniformPts !== undefined && conf.uniformPts !== '' ? conf.uniformPts : '';
            basic = this.row('正解したら', `<div style="display:flex; align-items:center; gap:6px;"><input type="number" id="rp-uniform" value="${v}" placeholder="問題ごと" min="0" style="${this.SEL} width:90px; text-align:center;"><span style="color:#8b8b95; font-size:0.8rem;">点（空欄なら問題ごと）</span></div>`);
        } else if (st === 'first') {
            const n = parseInt(conf.firstN) || 1;
            const pts = conf.firstPts !== undefined && conf.firstPts !== '' ? conf.firstPts : 1;
            basic = this.row('先着', `<div style="display:flex; gap:10px; flex-wrap:wrap;">${this.num('rp-first-n', n, '人まで', { min: 1 })}${this.num('rp-first-pts', pts, '点')}</div>`)
                + this.note(ctx.mode === 'normal' ? '全員同時の時は、ボタンを押した速さで先着を決めます（司会者が判定する形式では、〇を付けた順）。' : '1人ずつ答える解答権では、その問題で〇になった順で数えます。');
        } else if (st === 'ranked') {
            basic = this.note('今は、速い順に傾斜した点にしています。点の決め方は「時間」のタブの「スピード勝負」で変えられます（上のどれかを選ぶと傾斜をやめます）。');
        } else {
            basic = '<div id="score-type-sheet-detail"></div>';
        }

        const streak = Number(conf.streakBonus) || 0;
        const adv = `
            ${this.row('連続正解ボーナス', this.num('rp-streak', streak, '点', { zero: 'なし' }))}
            ${this.note('2問以上続けて正解すると、毎問この点を足します（間違えたらリセット）。')}`;

        box.innerHTML = `
            ${this.head('正解時の得点')}
            ${this.tiles('scoreType', types, st)}
            ${basic}
            ${this.Cfg().advancedBlock('correct', adv)}`;
        this.Cfg().wireAdvancedBlocks(box);
        if (st === 'hint') {
            this.Cfg().renderScoreDetailInSheet(st, conf);
            box.querySelectorAll('#score-type-sheet-detail input').forEach(inp => {
                inp.addEventListener('input', () => { this.Cfg()._collectScoreDetailFromSheet(conf); this.soft(); });
            });
        }
        box.querySelectorAll('[data-rp="scoreType"]').forEach(b => {
            b.onclick = () => { conf.scoreType = b.dataset.val; this.changed(); };
        });
        const u = box.querySelector('#rp-uniform');
        if (u) u.oninput = () => { conf.uniformPts = u.value === '' ? '' : Math.max(0, parseInt(u.value) || 0); this.soft(); };
        const fn = box.querySelector('#rp-first-n');
        if (fn) fn.onchange = () => { conf.firstN = Math.max(1, parseInt(fn.value) || 1); this.soft(); };
        const fp = box.querySelector('#rp-first-pts');
        if (fp) fp.oninput = () => { conf.firstPts = Math.max(0, parseInt(fp.value) || 0); this.soft(); };
        const sk = box.querySelector('#rp-streak');
        if (sk) sk.onchange = () => { conf.streakBonus = parseFloat(sk.value) || 0; this.soft(); };
    },

    // ---------------------------------------------------------
    // 誤答
    // ---------------------------------------------------------
    renderWrong: function (box) {
        if (!box) return;
        const conf = this._conf, RE = this.RE(), ctx = this.ctx();
        let basic = '';
        if (conf.mode === 'buzz') {
            // 早押し — 問題の扱いと、誤答した人の解答権（詳細）
            basic = this.Cfg()._modeDetailFieldsHtml('buzz', conf, ctx.qType, ctx.isDobon);
        } else if (RE.can('turnWrong', ctx).ok) {
            const a = conf.turnWrongAction === 'next' ? 'next' : 'end';
            basic = this.row('誤答時の問題', this.select('rp-turn-wrong', [
                { v: 'end', t: '終了' },
                { v: 'next', t: '次の人へ' },
            ], a));
        } else if (conf.mode === 'turn' && (ctx.isMulti || ctx.isDobon)) {
            basic = this.note(ctx.isDobon ? 'ダウトは、ダウト（誤答）が出た時点でその問題が終わります。' : '多答は、正解でも誤答でも次の人へ回ります。');
        }

        // 減点（どの解答権でも共通）
        const loss = conf.wrongDeduct !== undefined && conf.wrongDeduct !== '' ? Number(conf.wrongDeduct)
            : (conf.mode === 'buzz' && Number(conf.buzzDeduct) > 0 ? Number(conf.buzzDeduct) : 0);
        const deduct = this.row('減点', this.num('rp-deduct', loss, '点', { zero: 'しない' }));
        const survival = conf.gameType === 'survival'
            ? this.note(`勝ち方がサバイバルなので、誤答${conf.mode === 'normal' ? '・無解答' : ''}は「ミス1回」として数えます（${conf.survivalLives || 1}回で脱落）。`) : '';

        box.innerHTML = `
            ${this.head('誤答時')}
            ${basic}
            ${deduct}
            ${survival}`;
        if (conf.mode === 'buzz') this.Cfg()._wireModeDetailFields(box, 'buzz', conf, () => this.changed());
        // 詳細設定は基本の設定（減点など）の下に
        const adv = box.querySelector('details.rule-adv');
        if (adv) box.appendChild(adv);
        // 早押しの欄の中の古い「減点」は、共通の減点にまとめたので出さない
        box.querySelectorAll('#config-buzz-deduct-row').forEach(r => r.remove());
        const tw = box.querySelector('#rp-turn-wrong');
        if (tw) tw.onchange = () => { conf.turnWrongAction = tw.value; this.soft(); };
        const dd = box.querySelector('#rp-deduct');
        if (dd) dd.onchange = () => { conf.wrongDeduct = Math.abs(parseFloat(dd.value) || 0); conf.buzzDeduct = conf.wrongDeduct; this.soft(); };
    },

    // ---------------------------------------------------------
    // 勝ち方
    // ---------------------------------------------------------
    renderWin: function (box) {
        if (!box) return;
        const conf = this._conf, RE = this.RE(), ctx = this.ctx();
        const canRace = RE.can('timeRace', ctx);
        const types = [
            { value: 'score', label: '得点制', sub: '最高得点で勝利' },
            { value: 'survival', label: 'サバイバル', sub: 'ミスで脱落・残れば勝利' },
            { value: 'winthrough', label: '勝ち抜け', sub: '規定の点・正解数で勝ち抜け' },
        ];
        // 陣取りパネルは、パネルの多い人が勝ち（勝ち方は変えない）— 盤面の大きさだけ
        if (conf.gameType === 'territory') {
            const T = window.App.Territory;
            const sz = T ? T.size(conf) : { rows: 5, cols: 5 };
            box.innerHTML = `
                ${this.head('勝ち方')}
                <p class="rp-fixed">陣取り：パネルが多い人が勝ち</p>
                ${this.row('盤面の縦', this.num('rp-tp-rows', sz.rows, '行', { min: 2, max: 8 }))}
                ${this.row('盤面の横', this.num('rp-tp-cols', sz.cols, '列', { min: 2, max: 8 }))}
                ${this.note('参加した順にマスを開き、そのマスの問題を全員で早押し。正解した人がそのマスを取り、縦・横・ななめで挟んだマスは自分の色にひっくり返ります。マスの枚数がそのまま得点です。')}`;
            const bindN = (id, key) => { const el = box.querySelector('#' + id); if (el) el.onchange = () => { conf[key] = Math.max(2, Math.min(8, parseInt(el.value) || 5)); this.soft(); }; };
            bindN('rp-tp-rows', 'tpRows'); bindN('rp-tp-cols', 'tpCols');
            return;
        }
        // タイムレースは「時間」タブの「スピード勝負」で決める
        const gt = (conf.gameType === 'timerace' && canRace.ok) ? 'timerace' : (types.some(t => t.value === conf.gameType) ? conf.gameType : 'score');
        conf.gameType = gt;
        const numSel = (id, list, val, fmt) => this.select(id, list.map(n => ({ v: n, t: fmt(n) })), val);
        let basic = '', adv = '', notes = [];

        if (gt === 'score') {
            basic = this.note('点は「配点」「誤答」のタブで決めます。' + (conf.tieBreak === 'time' && RE.can('tieBreakTime', ctx).ok ? '同点の時は解答時間の合計で決めます（「時間」のタブ）。' : ''));
        } else if (gt === 'survival') {
            basic = this.row('脱落するミス', this.num('rp-lives', conf.survivalLives || 1, '回で脱落', { min: 1 }))
                + this.note('誤答・無解答がミスになります（1問につき1回まで）。脱落した人は以降の問題に答えられません。');
            const endN = Number(conf.survivalEndCount) || 0;
            adv = this.row('終了', this.num('rp-surv-end', endN, '人残ったら終了', { zero: '最後の問題まで続ける' }));
        } else if (gt === 'winthrough') {
            const by = conf.winBy === 'correct' ? 'correct' : 'score';
            basic = this.row('勝ち抜け', `<div style="display:flex; gap:6px;">
                    ${this.num('rp-win-target', Number(conf.winTarget) || 5, '', { min: 1 })}
                    ${this.select('rp-win-by', [{ v: 'score', t: '点で勝ち抜け' }, { v: 'correct', t: '問正解で勝ち抜け' }], by)}
                </div>`)
                + this.note('勝ち抜けた人は、それ以降の問題には答えません（勝ち抜けた順が順位になります）。');
            adv = this.row('終了', this.num('rp-win-quota', Number(conf.winQuota) || 0, '人勝ち抜けたら終了', { zero: '最後の問題まで続ける' }));
        } else if (gt === 'timerace') {
            basic = this.note('今はタイムレース（正解数が多い人が勝ち、同じ数なら解答時間の合計が短い人が上）です。「時間」のタブの「スピード勝負」で変えられます（上のどれかを選ぶとタイムレースをやめます）。');
        }

        box.innerHTML = `
            ${this.head('勝ち方')}
            ${this.tiles('gameType', types, gt)}
            ${basic}
            ${this.Cfg().advancedBlock('win_' + gt, adv, notes)}
            ${this.head('結果発表')}
            ${this.row('1問ごとの結果発表', this.select('rp-result-each', [{ v: 'show', t: '出す' }, { v: 'skip', t: '出さない' }], conf.resultEachQ === 'skip' ? 'skip' : 'show'))}
            ${this.note('「出さない」にすると、正解を見せたらすぐ次の問題へ進みます。')}
            ${this.row('解答者の端末の得点', this.select('rp-score-view', [{ v: 'score', t: '得点だけ' }, { v: 'score_rank', t: '得点と順位' }, { v: 'none', t: '出さない' }], conf.playerScoreView || 'score'))}
            ${this.note('「出さない」にすると、得点と順位は結果発表まで分かりません。')}
            <div id="gametype-solo"></div>`;
        this.Cfg().wireAdvancedBlocks(box);
        this.Cfg()._renderSoloRules(box.querySelector('#gametype-solo'), conf, () => this.soft());
        box.querySelectorAll('[data-rp="gameType"]').forEach(b => {
            b.onclick = () => { if (conf.gameType !== b.dataset.val) { conf.gameType = b.dataset.val; this.changed(); } };
        });
        const bind = (id, fn) => { const el = box.querySelector('#' + id); if (el) el.onchange = () => { fn(el.value); this.soft(); }; };
        bind('rp-lives', v => { conf.survivalLives = Math.max(1, parseInt(v) || 1); });
        bind('rp-score-view', v => { conf.playerScoreView = v; });
        bind('rp-result-each', v => { conf.resultEachQ = v; });
        bind('rp-surv-end', v => { conf.survivalEndCount = Math.max(0, parseInt(v) || 0); });
        bind('rp-win-target', v => { conf.winTarget = Math.max(1, parseFloat(v) || 5); });
        bind('rp-win-by', v => { conf.winBy = v; });
        bind('rp-win-quota', v => { conf.winQuota = Math.max(0, parseInt(v) || 0); });
    },

    // ---------------------------------------------------------
    // 速さで競う — 速い順に傾斜・タイムレース・同点は時間・遅い人も脱落 を1か所に
    //   使えない部品は出さず、まとめて理由を1行で出す
    // ---------------------------------------------------------
    renderSpeed: function (box) {
        const conf = this._conf, RE = this.RE(), ctx = this.ctx();
        const can = {
            ranked: RE.can('scoreRanked', ctx).ok,
            race: RE.can('timeRace', ctx).ok,
            tie: RE.can('tieBreakTime', ctx).ok,
            slow: RE.can('survivalSlowDrop', ctx).ok,
        };
        // ゲームでは速さの部品は使わないので、まとまりごと出さない
        if (ctx.isDobon || ctx.isBlackjack || ctx.isPanel) return;
        const wrap = document.createElement('div');
        wrap.className = 'rp-speed';
        const head = this.head('スピード勝負');
        // 使えない時は、まとまりごと出さない（説明も出さない — 選べない物は抜く）
        if (!can.ranked && !can.race && !can.tie && !can.slow) return;
        const race = conf.gameType === 'timerace' && can.race;
        const toggle = (id, label, on, sub) => `<label class="rp-check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}${sub ? `<small class="rp-check-sub">${sub}</small>` : ''}</span></label>`;
        let html = head;
        if (can.race) html += toggle('rp-sp-race', 'タイムレース', race, '正解数が多い人が勝ち、同じ数なら解答時間の合計が短い人が上');
        if (!race) {
            if (can.ranked) {
                html += toggle('rp-sp-ranked', '早い順に高得点', conf.scoreType === 'ranked', ctx.wbContinue ? '正解した順に、1番目・2番目…の点を決めます' : '正解した人のうち、早く答えた人ほど高い点');
                if (conf.scoreType === 'ranked') html += '<div id="score-type-sheet-detail" class="rp-speed-detail"></div>';
            }
            if (can.tie && (conf.gameType || 'score') === 'score') html += toggle('rp-sp-tie', '同点時は解答時間で順位', conf.tieBreak === 'time', '同じ点の人は、解答時間の合計が短い人が上');
            if (can.slow && conf.gameType === 'survival') {
                html += this.row('遅い人も脱落', this.num('rp-sp-slow', parseInt(conf.survivalSlowDrop) || 0, '人（毎問、正解者のうち遅い順）', { zero: 'しない' }));
            }
        } else {
            html += this.note('タイムレースの間は、正解は1問1点として数えます。');
        }
        const off = [];
        if (!can.race) off.push('タイムレース');
        if (!can.tie) off.push('同点は解答時間で決める');
        if (!can.slow) off.push('遅い人も脱落');
        if (off.length && ctx.wbContinue) html += `<p class="rp-why">${off.join('・')}：全員が同時にボタンで答える形式で使えます</p>`;
        wrap.innerHTML = html;
        box.appendChild(wrap);
        if (conf.scoreType === 'ranked' && !race) {
            this.Cfg().renderScoreDetailInSheet('ranked', conf);
            wrap.querySelectorAll('#score-type-sheet-detail input').forEach(inp => {
                inp.addEventListener('input', () => { this.Cfg()._collectScoreDetailFromSheet(conf); this.soft(); });
            });
        }
        const on = (id, fn) => { const el = wrap.querySelector('#' + id); if (el) el.onchange = () => fn(el.type === 'checkbox' ? el.checked : el.value); };
        on('rp-sp-race', v => { conf.gameType = v ? 'timerace' : 'score'; this.changed(); });
        on('rp-sp-ranked', v => { conf.scoreType = v ? 'ranked' : 'uniform'; this.changed(); });
        on('rp-sp-tie', v => { conf.tieBreak = v ? 'time' : 'none'; this.soft(); });
        on('rp-sp-slow', v => { conf.survivalSlowDrop = Math.max(0, parseInt(v) || 0); this.soft(); });
    },

    // ---------------------------------------------------------
    // 時間 — 3つの質問: ① 制限時間 ② 解答時間 ③ 時間が来たら（＋詳細・速さで競う）
    // ---------------------------------------------------------
    renderTime: function (box) {
        if (!box) return;
        const conf = this._conf, RE = this.RE(), ctx = this.ctx();
        const oneByOne = ['buzz', 'turn', 'nominate'].includes(conf.mode) && !ctx.isBlackjack;
        const on = conf.timeLimitEnabled === 'on';
        let kind = conf.timerKind === 'pool' ? 'pool' : conf.timerKind === 'personal' ? 'personal' : 'per_q';
        if (kind === 'personal' && !oneByOne) kind = 'per_q';
        const clock = on ? kind : 'off';
        const tiles = [
            { value: 'off', label: 'なし', sub: '無制限' },
            { value: 'per_q', label: '1問ごと', sub: conf.mode === 'buzz' ? '1問ごとに制限' : '1問ごとに解答時間を設定' },
            { value: 'pool', label: 'セット全体', sub: 'セット全体の持ち時間' },
        ].concat(oneByOne ? [{ value: 'personal', label: '1人ずつ', sub: '個人の持ち時間（解答中のみ減る）' }] : []);
        const secs = parseFloat(conf.timeLimitSeconds) || (kind === 'per_q' ? 10 : 60);
        const canSec = RE.can('answerSec', ctx).ok;
        const ansSec = Number(conf.answerSec) || 0;
        const whoLabel = conf.mode === 'buzz' ? '押してから' : conf.mode === 'nominate' ? '指名されてから' : '番が来てから';

        // ③ 時間が来たら — 今の時計に合う物だけ
        let expire = '';
        if (on && kind === 'per_q') {
            const opts = [
                { v: 'close', t: '締め切って正解発表' },
                { v: 'skip', t: 'スルーして次へ' },
            ].concat(oneByOne ? [{ v: 'bomb', t: '番の人が脱落（爆弾）' }] : []);
            const cur = opts.some(o => o.v === conf.timerOnExpire) ? conf.timerOnExpire : 'close';
            expire += this.row('問題の時計が0', this.select('rp-t-expire', opts, cur));
            if (cur === 'bomb') expire += this.note(`時限爆弾: 時計は問題の間ずっと進み、次の人へ回っても、誰かが押しても止まりません。0になった時に答える番だった人が${conf.gameType === 'survival' ? 'ミス1回（サバイバルのライフが1つ減る）' : '脱落'}です。`);
            else if (cur === 'skip') expire += this.note('正解を出さずに次の問題へ進みます。');
            else if (conf.mode === 'buzz') expire += this.note('早押しでは「押せる時間」です。誰も押さずに0になったら、上の動きになります。');
        } else if (on && kind === 'pool') {
            expire += this.note('セット全体の時計が0になったら、残りの問題は出さずにセット終了です。');
        } else if (on && kind === 'personal') {
            expire += this.note('自分の持ち時間が0になった人は脱落です。持ち時間は答える番の間だけ減り、セットの間ずっと持ち越します。');
        }
        if (canSec && ansSec > 0 && ctx.isPanel) {
            expire += this.note('パネルは、答える人の時計が0になったら誤答です（パネルの決まり）。');
        } else if (canSec && ansSec > 0) {
            const ae = conf.answerSecOnExpire === 'pass' ? 'pass' : 'wrong';
            expire += this.row('答える人の時計が0', this.select('rp-t-ans-expire', [
                { v: 'wrong', t: '誤答にする' },
                { v: 'pass', t: conf.mode === 'buzz' ? '誤答にせず再開' : conf.mode === 'nominate' ? '誤答にせず指名し直す' : '誤答にせず次の人へ' },
            ], ae));
            if (ae === 'pass') expire += this.note(conf.mode === 'buzz' ? '時間切れの人は解答権を手放し、ほかの人がまた押せます（もう一度押すこともできます）。' : conf.mode === 'nominate' ? '時間切れでも減点せず、司会者が次の人を指名します。' : '時間切れでも減点せず、次の人へ順番を回します。');
        }

        // 詳細: 止める・増減
        let adv = '';
        if (on && (kind === 'per_q' || kind === 'pool') && conf.mode === 'buzz' && conf.timerOnExpire !== 'bomb') {
            adv += `<label class="rp-check"><input type="checkbox" id="rp-t-pause" ${conf.timerPauseOnBuzz !== false ? 'checked' : ''}><span>誰かが押したら問題の時計を止める（誤答なら残りから再開）</span></label>`;
        }
        if (on && (kind === 'pool' || kind === 'personal')) {
            adv += this.row('正解したら', this.num('rp-t-bonus', parseFloat(conf.timerBonusCorrect) || 0, '秒ふやす', { step: 0.5, zero: '増減なし' }));
            adv += this.row('誤答なら', this.num('rp-t-penalty', parseFloat(conf.timerPenaltyWrong) || 0, '秒へらす', { step: 0.5, zero: '増減なし' }));
        }

        box.innerHTML = `
            ${this.head('① 制限時間')}
            ${this.tiles('tclock', tiles, clock)}
            ${on ? this.row(kind === 'personal' ? '1人の持ち時間' : kind === 'pool' ? 'セット全体で' : '1問', this.num('rp-t-secs', secs, '秒', { min: 1 })) : ''}
            ${canSec ? `${this.head('② 解答時間')}${this.row(whoLabel, this.num('rp-answer-sec', ansSec, '秒以内に解答', { zero: 'なし' }))}` : ''}
            ${expire ? `${this.head('③ 時間が来たら')}${expire}` : ''}
            ${adv ? this.Cfg().advancedBlock('time', adv) : ''}`;
        this.Cfg().wireAdvancedBlocks(box);
        box.querySelectorAll('[data-rp="tclock"]').forEach(b => {
            b.onclick = () => {
                const v = b.dataset.val;
                if (v === 'off') conf.timeLimitEnabled = 'off';
                else {
                    const was = conf.timeLimitEnabled === 'on' ? (conf.timerKind || 'per_q') : 'off';
                    conf.timeLimitEnabled = 'on';
                    conf.timerKind = v;
                    if (was !== v) conf.timeLimitSeconds = v === 'per_q' ? 10 : 60;
                }
                this.changed();
            };
        });
        const q = (id) => box.querySelector('#' + id);
        if (q('rp-t-secs')) q('rp-t-secs').onchange = (e) => { conf.timeLimitSeconds = this.readNum(e.target, 10, 1, 3600); this.soft(); };
        if (q('rp-answer-sec')) q('rp-answer-sec').onchange = (e) => { conf.answerSec = this.readNum(e.target, 0, 0, 600); this.changed(); };
        if (q('rp-t-expire')) q('rp-t-expire').onchange = (e) => { conf.timerOnExpire = e.target.value; this.changed(); };
        if (q('rp-t-ans-expire')) q('rp-t-ans-expire').onchange = (e) => { conf.answerSecOnExpire = e.target.value; this.changed(); };
        if (q('rp-t-pause')) q('rp-t-pause').onchange = (e) => { conf.timerPauseOnBuzz = e.target.checked; this.soft(); };
        if (q('rp-t-bonus')) q('rp-t-bonus').onchange = (e) => { conf.timerBonusCorrect = this.readNum(e.target, 0, 0, 600); this.soft(); };
        if (q('rp-t-penalty')) q('rp-t-penalty').onchange = (e) => { conf.timerPenaltyWrong = this.readNum(e.target, 0, 0, 600); this.soft(); };
        this.renderSpeed(box);
    },

};

// 数字の − ＋（rule_panel.js num）— 入力欄の値を1つ（小数の時はその刻みで）動かし、change を送る
document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.rp-step');
    if (!b) return;
    const input = b.parentNode.querySelector('input[type="number"]');
    if (!input) return;
    const step = parseFloat(input.step) || 1;
    const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
    const max = input.max !== '' ? parseFloat(input.max) : Infinity;
    const cur = parseFloat(input.value) || 0;
    const next = Math.min(max, Math.max(min, Math.round((cur + step * Number(b.dataset.step)) * 100) / 100));
    if (next === cur) return;
    input.value = next;
    input.dispatchEvent(new Event('change', { bubbles: true }));
});
