/* =========================================================
 * rule_engine.js — ルールの相性・得点・順位を1か所にまとめる
 *
 * 「どの組み合わせで、どの設定が使えるか」を判定する表と、
 * 得点・解答時間・順位の計算をここに集める。作成画面（host_config.js）、
 * 司会者画面（host_studio.js）、番組の設定（host_prog_config.js）は
 * 全部ここを見て判断する — 同じ条件を何か所にも書かないため。
 *
 * 新しいルール部品を足す時は FEATURES に1行足すだけで、
 * 使えない組み合わせでは画面に出なくなる。
 * =======================================================*/

window.App = window.App || {};

App.RuleEngine = {
    // 自動で正誤を判定できる形式（解答時間の順位などは、これが前提）
    AUTO_JUDGE_TYPES: ['choice', 'sort', 'letter_select'],

    // ---------------------------------------------------------
    // 状況（問題形式 × 解答権）
    // ---------------------------------------------------------
    context: function (conf, questions) {
        const qs = questions || [];
        const first = qs[0] || {};
        const firstType = first.type || '';
        const info = (window.App.Config && window.App.Config.deriveTypeInfo) ? window.App.Config.deriveTypeInfo(qs) : {};
        const qType = info.qType || firstType;
        const isDobon = !!info.isDobon;
        const isBlackjack = !!info.isBlackjack;
        const isOral = !!info.isOral;
        const isMulti = !!(qType && (qType.startsWith('multi') || qType.startsWith('ranking')));
        const isAssoc = !!(firstType.startsWith('assoc') || qType.startsWith('assoc'));
        const autoJudge = this.AUTO_JUDGE_TYPES.includes(firstType) && !isDobon;
        return {
            mode: (conf && conf.mode) || 'normal',
            firstType, qType, isDobon, isBlackjack, isOral, isMulti, isAssoc, autoJudge,
            isPlainChoice: firstType === 'choice' && !isDobon,
        };
    },

    // ---------------------------------------------------------
    // 解答権 — どれが選べるか（作成画面のプルダウンと自動補正の両方で使う）
    //   disabled: 出すがグレー（形式上、選べない理由がある）
    //   hidden  : 出さない（その形式ではそもそも意味がない）
    // ---------------------------------------------------------
    modes: function (ctx) {
        const canNominate = !ctx.isBlackjack && !ctx.isDobon &&
            (ctx.firstType.startsWith('free') || ctx.firstType.startsWith('assoc') || ['choice', 'sort', 'letter_select'].includes(ctx.firstType));
        return [
            { value: 'normal', label: '全員が同時に手元で解答',
              disabled: ctx.isBlackjack || ctx.isOral || ctx.isDobon || ctx.isMulti,
              reason: ctx.isOral ? '口頭で答える形式では使えません' : 'この形式では使えません' },
            { value: 'buzz', label: '早く押した人から解答',
              disabled: ctx.isBlackjack || ctx.isDobon, reason: 'この形式では使えません' },
            { value: 'nominate', label: '指名された人のみ解答', disabled: false, hidden: !canNominate },
            // 選択式は「特定の人や順番で解答」を使わない（ダウトは順番で使う）
            { value: 'turn', label: '特定の人や順番で解答', disabled: false, hidden: ctx.isPlainChoice },
        ];
    },

    modeAllowed: function (ctx, mode) {
        const m = this.modes(ctx).find(x => x.value === mode);
        return !!(m && !m.disabled && !m.hidden);
    },

    firstAllowedMode: function (ctx) {
        const m = this.modes(ctx).find(x => !x.disabled && !x.hidden);
        return m ? m.value : 'buzz';
    },

    // ---------------------------------------------------------
    // ルール部品ごとの「使える条件」
    //   ok(ctx, conf) が false の時は画面に出さず、設定済みなら既定に戻す
    //   why … 出さない理由（詳細設定の下に1行で出す）
    // ---------------------------------------------------------
    FEATURES: {
        // 配点：正解スピードに応じて傾斜（全員同時 × 自動判定だけ）
        scoreRanked: {
            ok: (ctx) => ctx.mode === 'normal' && ctx.autoJudge,
            why: '「正解スピードで傾斜」は、全員が同時に答える選択式・並べ替え・文字パネルで使えます',
        },
        // 配点：ヒント数に応じて傾斜（連想クイズだけ）
        scoreHint: {
            ok: (ctx) => ctx.isAssoc,
            why: '「ヒント数で傾斜」は連想クイズで使えます',
        },
        // 勝利条件：同点のときは解答時間の合計で決める
        tieBreakTime: {
            ok: (ctx) => ctx.mode === 'normal' && ctx.autoJudge,
            why: '「同点は解答時間で決める」は、全員が同時に答える選択式・並べ替え・文字パネルで使えます',
        },
        // 解答回数（1回のみ／複数解答可）— 全員同時の時だけ意味がある
        answerAttempts: {
            ok: (ctx) => ctx.mode === 'normal',
            why: '',
        },
        // 誤答時処理 — 早押しの時だけ
        buzzWrong: {
            ok: (ctx) => ctx.mode === 'buzz',
            why: '早押し（早く押した人から解答）の時に設定できます',
        },
    },

    can: function (feature, ctx, conf) {
        const f = this.FEATURES[feature];
        if (!f) return { ok: true, why: '' };
        return { ok: !!f.ok(ctx, conf || {}), why: f.why || '' };
    },

    // 使えなくなった設定を既定に戻す。戻したものの説明を返す（画面で知らせる）。
    normalize: function (conf, questions) {
        if (!conf) return [];
        const ctx = this.context(conf, questions);
        const changed = [];
        if (conf.scoreType === 'ranked' && !this.can('scoreRanked', ctx).ok) {
            conf.scoreType = 'uniform';
            changed.push('今の解答権に合わない配点「正解スピードで傾斜」を「一律」に戻しました');
        }
        if (conf.scoreType === 'hint' && !this.can('scoreHint', ctx).ok) {
            conf.scoreType = 'uniform';
        }
        if (conf.scoreType === 'first_come') conf.scoreType = 'uniform'; // 廃止済み
        if (conf.tieBreak === 'time' && !this.can('tieBreakTime', ctx).ok) {
            conf.tieBreak = 'none';
            changed.push('今の解答権に合わない「同点は解答時間で決める」をオフにしました');
        }
        return changed;
    },

    // ---------------------------------------------------------
    // 解答時間（全員同時の自動判定）
    // 押した瞬間の時刻（端末の時計をサーバー時刻に補正したもの）と、
    // 解答を受け付け始めた時刻（サーバー時刻）の差。押下時刻は自己申告
    // なので、サーバーへの到着時刻より MAX_CORRECTION_MS 以上は前に
    // できないよう丸める（早押しと同じ考え方 — host_studio.js checkBuzz）。
    // ---------------------------------------------------------
    MAX_CORRECTION_MS: 300,

    answerElapsedMs: function (p, openAt) {
        if (!p || !openAt) return null;
        const arrived = Number(p.answerTime) || 0;
        if (!arrived) return null;
        const pressed = Number(p.answerPressAt);
        let at = arrived;
        if (pressed) at = Math.min(arrived, Math.max(pressed, arrived - this.MAX_CORRECTION_MS));
        return Math.max(0, at - Number(openAt));
    },

    // ---------------------------------------------------------
    // 得点（全員同時の自動判定で、正解者に何点入れるか）
    //   rank … 正解者の中での速さの順位（0始まり）。不明なら null
    // ---------------------------------------------------------
    pointsForCorrect: function (conf, q, rank) {
        const c = conf || {};
        const base = (q && q.points) || 1;
        if (c.scoreType === 'ranked') {
            const table = Array.isArray(c.rankPts) && c.rankPts.length ? c.rankPts : [10, 5, 3];
            const other = c.rankOtherPts !== undefined ? Number(c.rankOtherPts) : 1;
            if (rank === null || rank === undefined) return other;
            return rank < table.length ? (Number(table[rank]) || 0) : other;
        }
        if (c.scoreType === 'uniform' && c.uniformPts !== undefined && c.uniformPts !== null && c.uniformPts !== '') {
            return Number(c.uniformPts);
        }
        return base;
    },

    // ---------------------------------------------------------
    // 順位 — 得点の高い順。同点なら設定に応じて解答時間の合計が短い順
    //   field … 'periodScore'（このセット）か 'totalScore'（番組全体）
    // ---------------------------------------------------------
    comparator: function (conf, field) {
        const f = field || 'periodScore';
        const timeField = f === 'totalScore' ? 'totalCorrectTime' : 'periodCorrectTime';
        const useTime = (conf && conf.tieBreak) === 'time';
        return (a, b) => {
            const d = (Number(b[f]) || 0) - (Number(a[f]) || 0);
            if (d !== 0) return d;
            if (useTime) {
                const ta = a[timeField] !== undefined && a[timeField] !== null ? Number(a[timeField]) : Infinity;
                const tb = b[timeField] !== undefined && b[timeField] !== null ? Number(b[timeField]) : Infinity;
                if (ta !== tb) return ta - tb;
            }
            return 0;
        };
    },

    sortPlayers: function (players, conf, field) {
        return players.slice().sort(this.comparator(conf, field));
    },

    // ---------------------------------------------------------
    // 番組の足切り — 並べた順に「残る人」と「落ちる人」に分ける
    //   mode: 'survive'（上位N人が残る）/ 'dropout'（下位N人が脱落）
    //         'survive_pct'（上位N%が残る）/ 'below'（N点未満が脱落）
    // ---------------------------------------------------------
    eliminate: function (sorted, mode, count, field) {
        const n = Math.max(0, Number(count) || 0);
        const f = field || 'periodScore';
        if (mode === 'dropout') {
            const k = Math.min(n, sorted.length);
            return { survivors: sorted.slice(0, sorted.length - k), droppedOut: sorted.slice(sorted.length - k) };
        }
        if (mode === 'survive') {
            return { survivors: sorted.slice(0, n), droppedOut: sorted.slice(n) };
        }
        if (mode === 'survive_pct') {
            const keep = Math.ceil(sorted.length * Math.min(100, n) / 100);
            return { survivors: sorted.slice(0, keep), droppedOut: sorted.slice(keep) };
        }
        if (mode === 'below') {
            return {
                survivors: sorted.filter(p => (Number(p[f]) || 0) >= n),
                droppedOut: sorted.filter(p => (Number(p[f]) || 0) < n),
            };
        }
        return { survivors: sorted, droppedOut: [] };
    },

    ELIMINATION_MODES: [
        { value: 'none', label: '足切りなし', unit: '' },
        { value: 'survive', label: '上位◯人が残る', unit: '人' },
        { value: 'dropout', label: '下位◯人が脱落', unit: '人' },
        { value: 'survive_pct', label: '上位◯%が残る', unit: '%' },
        { value: 'below', label: '◯点未満が脱落', unit: '点' },
    ],
};

if (typeof module !== 'undefined') module.exports = App.RuleEngine;
