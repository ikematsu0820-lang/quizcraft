/* =========================================================
 * rule_panel.js — 作成画面の「ルール」パネル
 *
 * クイズのルールを5つの軸に分けて、どの組み合わせでも矛盾しないように
 * 組み立てる（使える・使えないの判定は rule_engine.js の表）。
 *   答え方   … 口頭／手書き（出題者が判定）・ボタン（自動で判定）と、
 *              解答権（全員／条件を満たした人＝早押し／特定の人＝順番・指名）
 *   正解     … 正解した人への得点の入れ方（一律・速さで傾斜・ヒント数・先着）
 *   誤答     … 間違えた時の問題の扱いと、間違えた人へのペナルティ
 *   勝ち方   … 得点制／サバイバル／勝ち抜け／タイムレース
 *   時間     … 制限時間と、解答者の持ち時間
 * 各タブは「基本」の設定だけを出し、細かい設定は「詳細設定」に入れる。
 * 一番上に、今の設定を文章にした「遊び方」を出す。
 * =======================================================*/

window.App = window.App || {};

App.RulePanel = {
    SEL: 'width:100%; margin:0; padding:6px 8px; background:#1e293b; border:1px solid #475569; border-radius:8px; color:#fff; font-size:0.85rem;',

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
    // 灰色のタイルの「選べない理由」— スマホでは title が見えないので、タイルの下に1行で出す
    whyNote: function (items) {
        const off = (items || []).filter(it => it.disabled && it.why);
        if (!off.length) return '';
        const uniq = [...new Set(off.map(it => it.why))];
        return `<p class="rp-why">${uniq.length === 1 && off.length > 1
            ? `${off.map(it => it.label).join('・')}：${uniq[0]}`
            : off.map(it => `${it.label}：${it.why}`).join('<br>')}</p>`;
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
        box.innerHTML = `<span class="rp-sum-label">遊び方</span>${this.RE().describe(this._conf, this._questions)}`;
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

        // 解答権
        const modes = RE.modes(ctx);
        const allowed = (m) => { const x = modes.find(y => y.value === m); return !!(x && !x.disabled && !x.hidden); };
        const group = RE.groupOfMode(conf.mode);
        const whyOf = (m) => { const x = modes.find(y => y.value === m); return (x && x.reason) || 'この形式では使えません'; };
        const groupTiles = RE.MODE_GROUPS.map(g => ({
            value: g.value, label: g.label, sub: g.sub,
            disabled: !g.modes.some(allowed),
            why: whyOf(g.modes[0]),
        }));
        // 順番・指名は、選べない時も消さずに灰色で出す（理由は下に1行）
        const specificTiles = [
            { value: 'turn', label: '順番', sub: '決めた順に1人ずつ', disabled: !allowed('turn'), why: whyOf('turn') },
            { value: 'nominate', label: '指名', sub: '出題者が選んだ人', disabled: !allowed('nominate'), why: whyOf('nominate') },
        ];

        const modeNote = {
            normal: '全員が手元の端末で同時に答えます。',
            buzz: '一番早く押した人が答えます。誤答の時の扱いは「誤答」のタブで決めます。',
            turn: '決めた順番で1人ずつ答えます。順番は出題の前に司会者が決めます。',
            nominate: '司会者が参加者リストから指名した人が答えます。',
        }[conf.mode] || '';

        box.innerHTML = `
            ${this.head('答え方')}
            ${this.tiles('answerBy', answerTiles, by)}
            ${this.head('解答権（だれが答えるか）')}
            ${this.tiles('group', groupTiles, group)}
            ${this.whyNote(groupTiles)}
            ${group === 'specific' ? this.tiles('specific', specificTiles, conf.mode) + this.whyNote(specificTiles) : ''}
            <p class="rule-basic-note">${modeNote}</p>
            <div id="rp-mode-detail"></div>
            ${ctx.writtenBuzz ? this.writtenBuzzHtml(conf) : ''}
            ${/^free/.test((window.App.Creator && window.App.Creator.currentType) || ctx.firstType || '') ? `
            ${this.head('問題文の出し方')}
            <label class="rp-check"><input type="checkbox" id="rp-read-aloud" ${conf.readAloud ? 'checked' : ''}><span>問題文を画面に出さない（司会者が読み上げる）</span></label>
            ${this.note('モニターには得点だけが出て、回答者の端末にも問題文は送りません。読み上げの途中で押す、先読みの駆け引きを楽しむ時に。正解はいつもどおり発表します。')}` : ''}`;

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
        box.querySelectorAll('[data-rp="group"]').forEach(b => {
            b.onclick = () => {
                const g = RE.MODE_GROUPS.find(x => x.value === b.dataset.val);
                if (!g || g.modes.includes(conf.mode)) return;
                const m = g.modes.find(allowed);
                if (m) setMode(m);
            };
        });
        box.querySelectorAll('[data-rp="specific"]').forEach(b => {
            b.onclick = () => { if (b.dataset.val !== conf.mode) setMode(b.dataset.val); };
        });
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
                { v: 'end', t: '問題を終える' },
                { v: 'continue', t: '抜けて続ける' },
            ], cont ? 'continue' : 'end'))}
            ${cont ? this.row('問題を終えるのは', this.select('rp-wb-count', [
                { v: 0, t: '全員が答え終わるまで' },
                ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => ({ v: k, t: `${k}人正解したら` })),
            ], n)) : ''}
            ${this.note(cont ? '' : '正解が出たら、その問題は終わって正解発表に進みます。')}
            ${cont ? this.note('正解した人はその問題から抜けて、残りの人で続けます。正解した順に点を傾けるには、「正解」のタブで「速さで傾斜」を選びます（1番目・2番目…の点を決められます）。司会者はいつでも問題を打ち切れます。') : ''}`;
    },

    wireWrittenBuzz: function (box, conf) {
        const on = (id, fn) => { const el = box.querySelector('#' + id); if (el) el.onchange = () => fn(el.value); };
        on('rp-wb-timing', v => { conf.wbTiming = v; this.changed(); });
        on('rp-wb-judge', v => { conf.wbJudge = v; this.changed(); });
        on('rp-wb-after', v => { conf.wbAfterCorrect = v; this.changed(); });
        on('rp-wb-count', v => { conf.wbWinCount = parseInt(v) || 0; this.changed(); });
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
        const types = [{ value: 'uniform', label: '一律', sub: '正解者全員に同じ点' }]
            .concat([{ value: 'first', label: '先着', sub: '早く正解した◯人だけ' }])
            .concat(canHint.ok ? [{ value: 'hint', label: 'ヒント数で傾斜', sub: '少ないヒントほど高い点' }] : []);
        // 速い順の傾斜は「時間」タブの「速さで競う」で決める（ここではそのまま残す）
        const isRanked = conf.scoreType === 'ranked' && canRanked.ok;
        const st = isRanked ? 'ranked' : (types.some(t => t.value === conf.scoreType) ? conf.scoreType : 'uniform');
        conf.scoreType = st;
        const numSel = (id, list, val, unit) => this.select(id, list.map(n => ({ v: n, t: `${n}${unit}` })), val);

        let basic = '';
        if (st === 'uniform') {
            const v = conf.uniformPts !== undefined && conf.uniformPts !== '' ? conf.uniformPts : '';
            basic = this.row('正解したら', `<div style="display:flex; align-items:center; gap:6px;"><input type="number" id="rp-uniform" value="${v}" placeholder="問題ごと" min="0" style="${this.SEL} width:90px; text-align:center;"><span style="color:#94a3b8; font-size:0.8rem;">点（空欄なら問題ごとの配点）</span></div>`);
        } else if (st === 'first') {
            const n = parseInt(conf.firstN) || 1;
            const pts = conf.firstPts !== undefined && conf.firstPts !== '' ? conf.firstPts : 1;
            basic = this.row('先着', `<div style="display:flex; gap:6px;">${numSel('rp-first-n', [1, 2, 3, 5, 10], n, '人まで')}<input type="number" id="rp-first-pts" value="${pts}" min="0" style="${this.SEL} width:80px; text-align:center;"><span style="color:#94a3b8; font-size:0.8rem; align-self:center;">点</span></div>`)
                + this.note(ctx.mode === 'normal' ? '全員同時の時は、ボタンを押した速さで先着を決めます（出題者が判定する形式では、〇を付けた順）。' : '1人ずつ答える解答権では、その問題で〇になった順で数えます。');
        } else if (st === 'ranked') {
            basic = this.note('今は、速い順に傾斜した点にしています。点の決め方は「時間」のタブの「速さで競う」で変えられます（上のどれかを選ぶと傾斜をやめます）。');
        } else {
            basic = '<div id="score-type-sheet-detail"></div>';
        }

        const streak = Number(conf.streakBonus) || 0;
        const adv = `
            ${this.row('連続正解ボーナス', numSel('rp-streak', [0, 1, 2, 3, 5], streak, '点').replace('>0点<', '>なし<'))}
            ${this.note('2問以上続けて正解した人に、毎問この点を足します（間違えると0から数え直し）。')}`;

        box.innerHTML = `
            ${this.head('正解した人への得点')}
            ${this.tiles('scoreType', types, st)}
            ${basic}
            ${this.Cfg().advancedBlock('correct', adv, [!canHint.ok ? canHint.why : ''])}`;
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
        if (fn) fn.onchange = () => { conf.firstN = parseInt(fn.value) || 1; this.soft(); };
        const fp = box.querySelector('#rp-first-pts');
        if (fp) fp.oninput = () => { conf.firstPts = Math.max(0, parseInt(fp.value) || 0); this.soft(); };
        const sk = box.querySelector('#rp-streak');
        if (sk) sk.onchange = () => { conf.streakBonus = parseInt(sk.value) || 0; this.soft(); };
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
            basic = this.row('誤答したら問題は', this.select('rp-turn-wrong', [
                { v: 'end', t: '終わる（正解発表へ）' },
                { v: 'next', t: '次の人に解答権が移る' },
            ], a));
        } else if (conf.mode === 'turn' && (ctx.isMulti || ctx.isDobon)) {
            basic = this.note(ctx.isDobon ? 'ダウトは、ダウト（誤答）が出た時点でその問題が終わります。' : '多答は、正解・誤答にかかわらず次の人に順番が回ります。');
        }

        // 減点（どの解答権でも共通）
        const loss = conf.wrongDeduct !== undefined && conf.wrongDeduct !== '' ? Number(conf.wrongDeduct)
            : (conf.mode === 'buzz' && Number(conf.buzzDeduct) > 0 ? Number(conf.buzzDeduct) : 0);
        const deduct = this.row('減点', this.select('rp-deduct', [0, 1, 2, 3, 5, 10].map(n => ({ v: n, t: n ? `−${n}点` : 'しない' })), loss));
        const survival = conf.gameType === 'survival'
            ? this.note(`勝ち方がサバイバルなので、誤答${conf.mode === 'normal' ? '・無回答' : ''}は「ミス1回」として数えます（${conf.survivalLives || 1}回で脱落）。`) : '';

        box.innerHTML = `
            ${this.head('間違えたとき')}
            ${basic}
            ${deduct}
            ${survival}`;
        if (conf.mode === 'buzz') this.Cfg()._wireModeDetailFields(box, 'buzz', conf, () => this.changed());
        // 詳細設定は基本の設定（減点など）の下に
        const adv = box.querySelector('details.rule-adv');
        if (adv) box.appendChild(adv);
        // 早押しの欄の中の古い「減点」は、共通の減点にまとめたので出さない
        box.querySelectorAll('#config-buzz-deduct-on').forEach(el => { const r = el.closest('div[style*="display:flex"]'); if (r) r.remove(); });
        const tw = box.querySelector('#rp-turn-wrong');
        if (tw) tw.onchange = () => { conf.turnWrongAction = tw.value; this.soft(); };
        const dd = box.querySelector('#rp-deduct');
        if (dd) dd.onchange = () => { conf.wrongDeduct = parseInt(dd.value) || 0; conf.buzzDeduct = conf.wrongDeduct; this.soft(); };
    },

    // ---------------------------------------------------------
    // 勝ち方
    // ---------------------------------------------------------
    renderWin: function (box) {
        if (!box) return;
        const conf = this._conf, RE = this.RE(), ctx = this.ctx();
        const canRace = RE.can('timeRace', ctx);
        const types = [
            { value: 'score', label: '得点制', sub: '得点が高い人が勝ち' },
            { value: 'survival', label: 'サバイバル', sub: 'ミスで脱落・残った人' },
            { value: 'winthrough', label: '勝ち抜け', sub: '規定に達したら抜ける' },
        ];
        // タイムレースは「時間」タブの「速さで競う」で決める
        const gt = (conf.gameType === 'timerace' && canRace.ok) ? 'timerace' : (types.some(t => t.value === conf.gameType) ? conf.gameType : 'score');
        conf.gameType = gt;
        const numSel = (id, list, val, fmt) => this.select(id, list.map(n => ({ v: n, t: fmt(n) })), val);
        let basic = '', adv = '', notes = [];

        if (gt === 'score') {
            basic = this.note('得点の入れ方は「正解」、減点は「誤答」のタブで決めます。' + (conf.tieBreak === 'time' && RE.can('tieBreakTime', ctx).ok ? '同点の時は解答時間の合計で決めます（「時間」のタブ）。' : ''));
        } else if (gt === 'survival') {
            basic = this.row('脱落するミス', numSel('rp-lives', [1, 2, 3, 4, 5], conf.survivalLives || 1, n => `${n}回で脱落`))
                + this.note('誤答・無回答がミスになります（1問につき1回まで）。脱落した人は以降の問題に答えられません。');
            const endN = Number(conf.survivalEndCount) || 0;
            adv = this.row('終了', numSel('rp-surv-end', [0, 1, 2, 3, 5], endN, n => n ? `残り${n}人になったら終了` : '最後の問題まで続ける'));
        } else if (gt === 'winthrough') {
            const by = conf.winBy === 'correct' ? 'correct' : 'score';
            basic = this.row('勝ち抜け', `<div style="display:flex; gap:6px;">
                    ${numSel('rp-win-target', [1, 2, 3, 5, 7, 10, 15, 20], Number(conf.winTarget) || 5, n => `${n}`)}
                    ${this.select('rp-win-by', [{ v: 'score', t: '点で勝ち抜け' }, { v: 'correct', t: '問正解で勝ち抜け' }], by)}
                </div>`)
                + this.note('勝ち抜けた人は、それ以降の問題には答えません（勝ち抜けた順が順位になります）。');
            adv = this.row('終了', numSel('rp-win-quota', [0, 1, 2, 3, 5, 10], Number(conf.winQuota) || 0, n => n ? `${n}人勝ち抜けたら終了` : '最後の問題まで続ける'));
        } else if (gt === 'timerace') {
            basic = this.note('今はタイムレース（正解数が多い人が勝ち、同じ数なら解答時間の合計が短い人が上）です。「時間」のタブの「速さで競う」で変えられます（上のどれかを選ぶとタイムレースをやめます）。');
        }

        box.innerHTML = `
            ${this.head('勝ち方')}
            ${this.tiles('gameType', types, gt)}
            ${basic}
            ${this.Cfg().advancedBlock('win_' + gt, adv, notes)}
            <div id="gametype-solo"></div>`;
        this.Cfg().wireAdvancedBlocks(box);
        this.Cfg()._renderSoloRules(box.querySelector('#gametype-solo'), conf, () => this.soft());
        box.querySelectorAll('[data-rp="gameType"]').forEach(b => {
            b.onclick = () => { if (conf.gameType !== b.dataset.val) { conf.gameType = b.dataset.val; this.changed(); } };
        });
        const bind = (id, fn) => { const el = box.querySelector('#' + id); if (el) el.onchange = () => { fn(el.value); this.soft(); }; };
        bind('rp-lives', v => { conf.survivalLives = parseInt(v) || 1; });
        bind('rp-surv-end', v => { conf.survivalEndCount = parseInt(v) || 0; });
        bind('rp-win-target', v => { conf.winTarget = parseInt(v) || 5; });
        bind('rp-win-by', v => { conf.winBy = v; });
        bind('rp-win-quota', v => { conf.winQuota = parseInt(v) || 0; });
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
        const wrap = document.createElement('div');
        wrap.className = 'rp-speed';
        const head = this.head('速さで競う');
        if (!can.ranked && !can.race && !can.tie && !can.slow) {
            wrap.innerHTML = head + this.note('速い順に点を傾ける・タイムレース・同点は解答時間で決める・遅い人も脱落 は、全員が同時にボタンで答える形式（選択式・並べ替え・文字パネル）と、早押し×手書きで「正解した人は抜けて続ける」時に使えます。');
            box.appendChild(wrap);
            return;
        }
        const race = conf.gameType === 'timerace' && can.race;
        const toggle = (id, label, on, sub) => `<label class="rp-check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}${sub ? `<small class="rp-check-sub">${sub}</small>` : ''}</span></label>`;
        let html = head;
        if (can.race) html += toggle('rp-sp-race', '勝ち方をタイムレースにする', race, '正解数が多い人が勝ち、同じ数なら解答時間の合計が短い人が上');
        if (!race) {
            if (can.ranked) {
                html += toggle('rp-sp-ranked', '正解の点を速い順に傾ける', conf.scoreType === 'ranked', ctx.wbContinue ? '正解した順に、1番目・2番目…の点を決めます' : '正解した人のうち、早く答えた人ほど高い点');
                if (conf.scoreType === 'ranked') html += '<div id="score-type-sheet-detail" class="rp-speed-detail"></div>';
            }
            if (can.tie && (conf.gameType || 'score') === 'score') html += toggle('rp-sp-tie', '同点は解答時間の合計で決める', conf.tieBreak === 'time', '同じ点の人は、解答時間の合計が短い人が上');
            if (can.slow && conf.gameType === 'survival') {
                html += this.row('遅い人も脱落', this.select('rp-sp-slow', [0, 1, 2, 3].map(n => ({ v: n, t: n ? `毎問、正解者のうち遅い${n}人` : 'しない' })), parseInt(conf.survivalSlowDrop) || 0));
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
        on('rp-sp-slow', v => { conf.survivalSlowDrop = parseInt(v) || 0; this.soft(); });
    },

    // ---------------------------------------------------------
    // 時間（制限時間は従来の部品＋解答者の持ち時間）
    // ---------------------------------------------------------
    renderTime: function (box) {
        if (!box) return;
        const conf = this._conf, RE = this.RE(), ctx = this.ctx();
        this.Cfg().renderInlineTimeLimitChooser(box, conf, () => this.changed());
        this.renderSpeed(box);
        const can = RE.can('answerSec', ctx);
        if (!can.ok) { if (Number(conf.answerSec)) conf.answerSec = 0; return; }
        const sec = Number(conf.answerSec) || 0;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            ${this.head('解答者の持ち時間')}
            ${this.row(conf.mode === 'buzz' ? '押してから' : '順番が来てから', this.select('rp-answer-sec', [0, 3, 5, 10, 15, 20, 30].map(n => ({ v: n, t: n ? `${n}秒以内に答える` : '制限なし' })), sec))}
            ${this.note('時間内に答えなかったら誤答として扱います（誤答のタブの設定どおりに進みます）。')}`;
        box.appendChild(wrap);
        const s = wrap.querySelector('#rp-answer-sec');
        s.onchange = () => { conf.answerSec = parseInt(s.value) || 0; this.soft(); };
    },
};
