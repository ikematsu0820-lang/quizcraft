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
    // sub … 答え方（口頭/手書き）を決める形式の時の問題の種類
    // conf … ルールに上書きする値（それ以外は既定のまま）
    PRESETS: {
        free: [
            { id: 'buzz_oral', label: '早押し', sub: '押した人が口で答える', type: 'free_oral', conf: { mode: 'buzz' } },
            { id: 'buzz_written', label: '早押し（手書き）', sub: '書いてから押す・正解が出たら終わり', type: 'free_written',
              conf: { mode: 'buzz', wbTiming: 'write_first', wbJudge: 'one', wbAfterCorrect: 'end' } },
            { id: 'buzz_through', label: '勝ち抜け早押し', sub: '書いて押す・正解した人は抜けて続く・早い順に高い点', type: 'free_written',
              conf: { mode: 'buzz', wbTiming: 'write_first', wbJudge: 'queue', wbAfterCorrect: 'continue', wbWinCount: 0, scoreType: 'ranked', rankPts: [10, 5, 3], rankOtherPts: 1 } },
            { id: 'all_written', label: '全員で手書き', sub: '全員が一斉に書いて、司会者が判定', type: 'free_written', conf: { mode: 'normal' } },
            { id: 'turn', label: '順番に答える', sub: '決めた順に1人ずつ口で答える', type: 'free_oral', conf: { mode: 'turn' } },
            { id: 'nominate', label: '指名して答える', sub: '司会者が選んだ人が口で答える', type: 'free_oral', conf: { mode: 'nominate' } },
        ],
        assoc_group: [
            { id: 'buzz_oral', label: '早押し', sub: 'ヒントを開けていき、分かった人が押す', type: 'assoc_oral', conf: { mode: 'buzz' } },
            { id: 'all_written', label: '全員で手書き', sub: '全員が一斉に書いて、司会者が判定', type: 'assoc_written', conf: { mode: 'normal' } },
            { id: 'turn', label: '順番に答える', sub: '決めた順に1人ずつ口で答える', type: 'assoc_oral', conf: { mode: 'turn' } },
        ],
        choice: [
            { id: 'all', label: '全員で一斉に', sub: '全員が手元のボタンで答える', conf: { mode: 'normal', scoreType: 'uniform' } },
            { id: 'all_speed', label: '速さで競う', sub: '全員で答えて、早く正解した人ほど高い点', conf: { mode: 'normal', scoreType: 'ranked', rankPts: [10, 5, 3], rankOtherPts: 1 } },
            { id: 'buzz', label: '早押し', sub: '押した人だけがボタンで答える', conf: { mode: 'buzz', scoreType: 'uniform' } },
            { id: 'turn', label: '順番に答える', sub: '決めた順に1人ずつボタンで答える', conf: { mode: 'turn', scoreType: 'uniform' } },
        ],
        sort: [
            { id: 'all', label: '全員で一斉に', sub: '全員が手元で並べ替える', conf: { mode: 'normal', scoreType: 'uniform' } },
            { id: 'all_speed', label: '速さで競う', sub: '全員で並べて、早く正解した人ほど高い点', conf: { mode: 'normal', scoreType: 'ranked', rankPts: [10, 5, 3], rankOtherPts: 1 } },
            { id: 'buzz', label: '早押し', sub: '押した人だけが並べ替える', conf: { mode: 'buzz', scoreType: 'uniform' } },
            { id: 'turn', label: '順番に答える', sub: '決めた順に1人ずつ並べ替える', conf: { mode: 'turn', scoreType: 'uniform' } },
        ],
        multi_group: [
            { id: 'turn', label: '順番に1つずつ', sub: '1人ずつ答えを1つ言い、次の人へ回す', type: 'multi_oral', conf: { mode: 'turn' } },
            { id: 'buzz', label: '早押しで1つずつ', sub: '押した人が答えを1つ言う', type: 'multi_oral', conf: { mode: 'buzz' } },
            { id: 'nominate', label: '指名して1つずつ', sub: '司会者が選んだ人が答えを1つ言う', type: 'multi_oral', conf: { mode: 'nominate' } },
        ],
    },

    // 遊び方を選ぶ画面（形式選択の画面の上に重ねる）
    open: function (cardType, startFn) {
        const list = this.PRESETS[cardType];
        if (!list) { startFn(null); return; }
        const view = document.getElementById('select-type-view');
        if (!view) { startFn(null); return; }
        this.close();
        const names = { free: '一問一答', assoc_group: '連想クイズ', choice: '選択式', sort: '並べ替え', multi_group: '多答クイズ' };
        const ov = document.createElement('div');
        ov.id = 'ps-overlay';
        ov.innerHTML = `
            <div class="ps-panel" role="dialog" aria-label="遊び方を選ぶ">
                <div class="ps-head">
                    <button type="button" class="ps-back">形式選択に戻る</button>
                    <div class="ps-title"><span class="ps-format">${names[cardType] || ''}</span>遊び方を選んでください</div>
                </div>
                <div class="ps-cards">
                    ${list.map(p => `<button type="button" class="ps-card" data-ps="${p.id}"><span class="ps-label">${p.label}</span><span class="ps-sub">${p.sub}</span></button>`).join('')}
                </div>
                <p class="ps-note">あとで「セット設定」のルールから細かく変えられます。</p>
            </div>`;
        view.appendChild(ov);
        ov.querySelector('.ps-back').onclick = () => this.close();
        ov.onclick = (e) => { if (e.target === ov) this.close(); };
        ov.querySelectorAll('[data-ps]').forEach(b => {
            b.onclick = () => {
                const preset = list.find(p => p.id === b.dataset.ps);
                this.close();
                startFn(preset);
            };
        });
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
        const who = { normal: '全員で一斉に', buzz: '早押し', turn: '順番に', nominate: '指名して', solo: '1人で' }[ctx.mode] || '';
        const by = { oral: '口頭', written: '手書き', button: 'ボタン' }[ctx.answerBy] || '';
        let s = `${who}・${by}`;
        if (ctx.writtenBuzz && ctx.wbContinue) s = '勝ち抜け早押し・手書き';
        if (ctx.isPanel) s = `パネル・${who}`;
        if (conf.scoreType === 'ranked' && RE.can('scoreRanked', ctx).ok) s += '・速い順に傾斜';
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
