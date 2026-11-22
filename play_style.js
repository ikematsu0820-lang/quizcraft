/* =========================================================
 * play_style.js — 形式を選んだ次に「遊び方」を選ぶ（プリセット）
 *
 *   形式選択のカード → 遊び方のカード（その形式で成り立つものだけ）→ 入力画面
 *   遊び方は、ルール一式（答え方・解答権・早押し×手書きの進め方・配点）に名前を
 *   付けたもの。選んだ後もルールのタブで細かく変えられる。
 *   ゲーム（パネルクイズ・ダウト・数字予想）は遊び方が決まっているので、この一手は無い。
 *
 *   入力画面の上には今の遊び方を短く出し（App.PlayStyle.updateChip）、押すとルールを開く。
 * =======================================================*/

window.App = window.App || {};

App.PlayStyle = {
    // 遊び方は「軸」ごとに選ぶ（1列に混ぜない）
    //   だれが答える → どう答える（一問一答・連想）→ 正解が出たら（早押し×手書き）／点の付け方（選択式・並べ替えの全員）
    FORMATS: {
        free: { name: '一問一答', who: ['buzz', 'all', 'turn', 'nominate'], how: true, base: 'free' },
        assoc_group: { name: '連想クイズ', who: ['buzz', 'all', 'turn', 'nominate'], how: true, base: 'assoc' },
        choice: { name: '選択式', who: ['all', 'nominate', 'buzz', 'turn'], score: true, q: { type: 'choice' } },
        sort: { name: '並べ替え', who: ['all', 'nominate', 'buzz', 'turn'], score: true, q: { type: 'sort' } },
        multi_group: { name: '多答クイズ', who: ['turn', 'buzz', 'nominate'], how: true, base: 'multi' },
    },
    // 呼び名は rule_engine.js（WHO・HOW）と同じ — ルール画面・セット設定の一覧とそろえる
    get WHO() {
        const R = window.App.RuleEngine.WHO;
        return {
            buzz: Object.assign({ mode: 'buzz' }, R.buzz),
            all: Object.assign({ mode: 'normal' }, R.normal),
            turn: Object.assign({ mode: 'turn' }, R.turn),
            nominate: Object.assign({ mode: 'nominate' }, R.nominate),
        };
    },
    get HOW() {
        const R = window.App.RuleEngine.HOW;
        return { oral: R.oral, written: R.written };
    },
    AFTER: {
        end: { label: '終わり', sub: '一番早い正解で次の問題へ' },
        continue: { label: '抜けて続ける', sub: '正解した人は抜け、早い順に高い点' },
    },
    SCORE: {
        same: { label: '同じ点', sub: '正解者全員に同じ点' },
        speed: { label: '早い人ほど高い点', sub: '早く正解した順に傾ける' },
    },
    // 後から PRESETS[形式] を見て「遊び方を選ぶ一手があるか」を判定している所のため
    get PRESETS() { return this.FORMATS; },

    // だれが答えるか、のそれぞれが選べるか — ルールの相性の表（rule_engine.js）をそのまま使う
    whoState: function (fmt, sel) {
        const f = this.FORMATS[fmt];
        const RE = window.App.RuleEngine;
        // 並びはルール画面と同じ（早押し・全員で・順番に・指名して）、選べない物は後ろ
        const ORDER = ['buzz', 'all', 'turn', 'nominate'];
        const list = f.who.map(k => {
            const how = f.fixedHow || (f.how && k === 'all' ? 'written' : sel.how) || 'oral';
            const q = f.q || { type: `${f.base}_${how}` };
            if (!RE) return { k, ok: true, why: '' };
            const m = RE.modes(RE.context({ mode: this.WHO[k].mode }, [q])).find(x => x.value === this.WHO[k].mode);
            return { k, ok: !!(m && !m.disabled && !m.hidden), why: (m && m.reason) || '' };
        });
        return list.sort((a, b) => (b.ok - a.ok) || (ORDER.indexOf(a.k) - ORDER.indexOf(b.k)));
    },

    // 今の選び方から、ルールの値を作る
    build: function (fmt, sel) {
        const f = this.FORMATS[fmt];
        const who = this.WHO[sel.who];
        const conf = { mode: who.mode, scoreType: 'uniform' };
        let how = f.fixedHow || sel.how || 'oral';
        if (f.how && sel.who === 'all') how = 'written'; // 全員が同時に口で答えると聞き取れない
        const type = f.base ? `${f.base}_${how}` : undefined;
        if (f.base === 'free' && sel.who === 'buzz' && how === 'written') {
            if (sel.after === 'continue') Object.assign(conf, { wbTiming: 'write_first', wbJudge: 'queue', wbAfterCorrect: 'continue', wbWinCount: 0, scoreType: 'ranked', rankPts: [10, 5, 3], rankOtherPts: 1 });
            else Object.assign(conf, { wbTiming: 'write_first', wbJudge: 'one', wbAfterCorrect: 'end' });
        }
        if (f.score && sel.who === 'all' && sel.score === 'speed') Object.assign(conf, { scoreType: 'ranked', rankPts: [10, 5, 3], rankOtherPts: 1 });
        const parts = [who.label];
        if (f.how || f.fixedHow) parts.push(how === 'written' ? '手書き' : '口頭');
        if (conf.wbAfterCorrect) parts.push(conf.wbAfterCorrect === 'continue' ? '正解した人は抜けて続ける' : '正解が出たら終わり');
        if (f.score && sel.who === 'all') parts.push(sel.score === 'speed' ? '早い人ほど高い点' : '同じ点');
        return { id: [sel.who, how, sel.after, sel.score].filter(Boolean).join('_'), type, conf, label: parts.join('・') };
    },

    // 遊び方を選ぶ画面（形式選択の画面の上に重ねる）— 軸ごとの段を上から順に
    open: function (cardType, startFn) {
        const f = this.FORMATS[cardType];
        if (!f) { startFn(null); return; }
        const view = document.getElementById('select-type-view');
        if (!view) { startFn(null); return; }
        this.close();
        const sel = { who: f.who[0], how: 'oral', after: 'end', score: 'same' };
        { const first = this.whoState(cardType, sel).find(w => w.ok); if (first) sel.who = first.k; }
        const ov = document.createElement('div');
        ov.id = 'ps-overlay';
        view.appendChild(ov);
        const opts = (key, list, cur, disabled) => `<div class="ps-opts" data-n="${list.length}">${list.map(([v, o]) => `
            <button type="button" class="ps-opt${cur === v ? ' on' : ''}" data-k="${key}" data-v="${v}" ${disabled && disabled(v) ? 'disabled' : ''}>
                <span class="ps-opt-label">${o.label}</span><span class="ps-opt-sub">${o.sub}</span>
            </button>`).join('')}</div>`;
        const render = () => {
            const howLocked = f.how && sel.who === 'all';
            if (howLocked) sel.how = 'written';
            const showAfter = f.base === 'free' && sel.who === 'buzz' && sel.how === 'written';
            const showScore = f.score && sel.who === 'all';
            const ws = this.whoState(cardType, sel);
            const built = this.build(cardType, sel);
            ov.innerHTML = `
                <div class="ps-panel" role="dialog" aria-label="遊び方を選ぶ">
                    <div class="ps-head">
                        <button type="button" class="ps-back">形式選択に戻る</button>
                        <div class="ps-title"><span class="ps-format">${f.name}</span>遊び方を選んでください</div>
                    </div>
                    <div class="ps-step"><div class="ps-step-k"><b>1</b>だれが答える</div>
                        ${opts('who', ws.filter(w => w.ok).map(w => [w.k, this.WHO[w.k]]), sel.who)}</div>
                    ${f.how && !howLocked ? `<div class="ps-step"><div class="ps-step-k"><b>2</b>どう答える</div>
                        ${opts('how', Object.entries(this.HOW), sel.how)}</div>` : ''}
                    ${f.fixedHow ? `<p class="ps-step-note">${f.howNote}</p>` : ''}
                    ${showAfter ? `<div class="ps-step"><div class="ps-step-k"><b>3</b>正解が出たら</div>
                        ${opts('after', Object.entries(this.AFTER), sel.after)}</div>` : ''}
                    ${showScore ? `<div class="ps-step"><div class="ps-step-k"><b>2</b>点の付け方</div>
                        ${opts('score', Object.entries(this.SCORE), sel.score)}</div>` : ''}
                    <div class="ps-foot">
                        <div class="ps-sum"><span>この遊び方</span><b>${built.label}</b></div>
                        <button type="button" class="ps-go">この遊び方で作る</button>
                        <p class="ps-note">あとで「セット設定」のルールから細かく変えられます。</p>
                    </div>
                </div>`;
            ov.querySelector('.ps-back').onclick = () => this.close();
            ov.querySelectorAll('.ps-opt').forEach(b => {
                b.onclick = () => { if (b.disabled) return; sel[b.dataset.k] = b.dataset.v; render(); };
            });
            ov.querySelector('.ps-go').onclick = () => {
                const preset = this.build(cardType, sel);
                this.close();
                startFn(preset);
            };
        };
        ov.onclick = (e) => { if (e.target === ov) this.close(); };
        render();
    },

    close: function () {
        document.getElementById('ps-overlay')?.remove();
    },

    // 新しいセットを、選んだ遊び方で始める
    start: function (cardType, preset) {
        const C = window.App.Creator;
        if (!C) return;
        C.initWithType(cardType);
        if (!preset) return;
        // 答え方（口頭/手書き）— 入力画面の形式を切り替える（ルールのタイルと同じ道）
        if (preset.type) {
            const sel = document.getElementById('creator-opt-subtype');
            if (sel && sel.value !== preset.type && [...sel.options].some(o => o.value === preset.type)) {
                sel.value = preset.type;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        const conf = window.App.Data.currentConfig || (window.App.Data.currentConfig = {});
        Object.assign(conf, JSON.parse(JSON.stringify(preset.conf || {})));
        if (conf.gameType === 'timerace') conf.gameType = 'score';
        // 「全員で手書き」を選んだのに、初回の自動の早押し提案で上書きされないように
        conf._oneOnOneSuggestedFor = preset.type || C.currentType;
        conf._playStyle = preset.id;
        if (C.renderRulesSection) C.renderRulesSection();
        this.updateChip();
    },

    // 入力画面の上の「遊び方：◯◯」
    shortLabel: function () {
        const conf = (window.App.Data && window.App.Data.currentConfig) || {};
        const RE = window.App.RuleEngine;
        const C = window.App.Creator;
        if (!RE || !C) return '';
        const qs = C.effectiveQuestionsForRestrictions ? C.effectiveQuestionsForRestrictions() : (window.App.Data.createdQuestions || []);
        const ctx = RE.context(conf, qs);
        if (ctx.isDobon) return 'ダウト（順番に回す）';
        if (ctx.isBlackjack) return '数字予想（順番に回す）';
        const who = ctx.mode === 'solo' ? '1人で' : ((RE.WHO[ctx.mode] || {}).label || '');
        const by = (RE.HOW[ctx.answerBy] || {}).label || '';
        let s = `${who}・${by}`;
        if (ctx.writtenBuzz && ctx.wbContinue) s = '早押し・手書き・抜けて続ける';
        if (ctx.isPanel) s = `パネル・${who}`;
        if (conf.scoreType === 'ranked' && RE.can('scoreRanked', ctx).ok) s += '・早い人ほど高い点';
        if (conf.gameType === 'timerace' && RE.can('timeRace', ctx).ok) s += '・タイムレース';
        return s;
    },

    updateChip: function () {
        const chip = document.getElementById('creator-playstyle-chip');
        if (!chip) return;
        const t = this.shortLabel();
        chip.classList.toggle('hidden', !t);
        chip.innerHTML = `<span class="ps-chip-k">遊び方</span><span class="ps-chip-v">${t}</span><span class="ps-chip-go">変える</span>`;
        chip.onclick = () => {
            const M = window.App.CreatorMobile;
            if (M && M.isMobile && M.isMobile() && M.openSheet) { M.openSheet('rules', 'format'); return; }
            document.getElementById('creator-rule-settings-btn')?.click();
        };
    },
};

// ルールが描き直されるたびに、入力画面の上の表示もそろえる
(function hookPlayStyleChip() {
    const C = window.App.Creator;
    if (!C || typeof C.renderRulesSection !== 'function') return;
    const orig = C.renderRulesSection;
    C.renderRulesSection = function () {
        const r = orig.apply(this, arguments);
        try { App.PlayStyle.updateChip(); } catch (e) { console.warn('play_style chip', e); }
        return r;
    };
})();
