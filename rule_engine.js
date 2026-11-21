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
        // パネル指名モード（panel_board.js）— 口頭で「◯番、答え」と言い、出題者が判定する
        const isPanel = qs.some(q => q && q.panel && (q.type === 'choice' || String(q.type || '').startsWith('multi')));
        const autoJudge = this.AUTO_JUDGE_TYPES.includes(firstType) && !isDobon && !isPanel;
        // 答え方 — 口頭（出題者が判定）／手書き（出題者が判定）／ボタン（自動で判定）
        const answerBy = (isOral || isPanel) ? 'oral' : (autoJudge || isDobon || isBlackjack) ? 'button' : 'written';
        return {
            mode: (conf && conf.mode) || 'normal',
            gameType: (conf && conf.gameType) || 'score',
            firstType, qType, isDobon, isBlackjack, isOral, isMulti, isAssoc, autoJudge, answerBy, isPanel,
            isPlainChoice: firstType === 'choice' && !isDobon,
            // 1人ずつ答える（早押し・順番・指名）
            oneByOne: ['buzz', 'turn', 'nominate', 'solo'].includes((conf && conf.mode) || 'normal'),
        };
    },

    // ---------------------------------------------------------
    // 解答権 — どれが選べるか（作成画面のプルダウンと自動補正の両方で使う）
    //   disabled: 出すがグレー（形式上、選べない理由がある）
    //   hidden  : 出さない（その形式ではそもそも意味がない）
    // ---------------------------------------------------------
    modes: function (ctx) {
        const canNominate = !ctx.isBlackjack && !ctx.isDobon && (ctx.isPanel ||
            ctx.firstType.startsWith('free') || ctx.firstType.startsWith('assoc') || ['choice', 'sort', 'letter_select'].includes(ctx.firstType));
        return [
            { value: 'normal', label: '全員が同時に手元で解答',
              disabled: ctx.isBlackjack || ctx.isOral || ctx.isDobon || ctx.isMulti || ctx.isPanel,
              reason: ctx.isOral ? '口頭で答える形式では使えません' : 'この形式では使えません' },
            { value: 'buzz', label: '早く押した人から解答',
              disabled: ctx.isBlackjack || ctx.isDobon, reason: 'この形式では使えません' },
            { value: 'nominate', label: '指名された人のみ解答', disabled: false, hidden: !canNominate },
            // 選択式は「特定の人や順番で解答」を使わない（ダウトは順番で使う）
            { value: 'turn', label: '特定の人や順番で解答', disabled: false, hidden: ctx.isPlainChoice && !ctx.isPanel },
        ];
    },

    // 答え方の3つ — 問題形式で決まる（口頭と手書きは同じ系統の形式なら切り替えられる）
    ANSWER_BY: [
        { value: 'oral', label: '口頭', judge: '出題者が判定' },
        { value: 'written', label: '手書き', judge: '出題者が判定' },
        { value: 'button', label: 'ボタン', judge: '自動で判定' },
    ],

    // 解答権の3つのまとまり（特定の人＝順番か指名）
    MODE_GROUPS: [
        { value: 'all', label: '全員', sub: '手元で同時に', modes: ['normal'] },
        { value: 'cond', label: '条件を満たした人', sub: '早押し', modes: ['buzz'] },
        { value: 'specific', label: '特定の人', sub: '順番・指名', modes: ['turn', 'nominate'] },
    ],
    groupOfMode: function (mode) {
        const g = this.MODE_GROUPS.find(x => x.modes.includes(mode));
        return g ? g.value : 'all';
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
        // 勝利条件「最後まで残った人」：正解者のうち遅い人も脱落
        survivalSlowDrop: {
            ok: (ctx) => ctx.mode === 'normal' && ctx.autoJudge,
            why: '「遅い人も脱落」は、全員が同時に答える選択式・並べ替え・文字パネルで使えます',
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
        // 順番：誤答したら次の人へ回す（多答・ダウトは形式の決まりで回る）
        turnWrong: {
            ok: (ctx) => ctx.mode === 'turn' && !ctx.isMulti && !ctx.isDobon && !ctx.isBlackjack && !ctx.isPanel,
            why: '',
        },
        // 配点：先着◯人だけ得点
        scoreFirst: {
            ok: (ctx) => !ctx.isBlackjack,
            why: '',
        },
        // 勝ち方：タイムレース（正解数→解答時間の合計）— 解答時間が測れる時だけ
        timeRace: {
            ok: (ctx) => ctx.mode === 'normal' && ctx.autoJudge,
            why: '「タイムレース」は、全員が同時にボタンで答える形式（選択式・並べ替え・文字パネル）で使えます',
        },
        // 解答者の持ち時間（押してから／順番が来てから◯秒）
        answerSec: {
            ok: (ctx) => ['buzz', 'turn', 'nominate'].includes(ctx.mode) && !ctx.isBlackjack,
            why: '1人ずつ答える解答権（早押し・特定の人）の時に設定できます',
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
        if (conf.gameType === 'timerace') {
            if (!this.can('timeRace', ctx).ok) {
                conf.gameType = 'score';
                changed.push('今の解答権・答え方では「タイムレース」が使えないので「得点が高い人が勝ち」に戻しました');
            } else {
                // 正解数で競い、同じなら速い人が上 — 配点は1問1点に固定
                conf.scoreType = 'uniform';
                conf.uniformPts = 1;
                conf.tieBreak = 'time';
            }
        }
        if (['panel', 'variable'].includes(conf.gameType)) conf.gameType = 'score';
        if (Number(conf.answerSec) > 0 && !this.can('answerSec', ctx).ok) conf.answerSec = 0;
        if (conf.turnWrongAction && !this.can('turnWrong', ctx).ok) delete conf.turnWrongAction;
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
        if (c.scoreType === 'first') {
            // 先着◯人だけ得点（それより後の正解者は0点）
            const n = Math.max(1, parseInt(c.firstN) || 1);
            const pts = c.firstPts !== undefined && c.firstPts !== '' ? Number(c.firstPts) : base;
            return (rank === null || rank === undefined || rank < n) ? pts : 0;
        }
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

    // 正解した時の点（どの解答権でも同じ計算）
    //   info.rank   … この問題で何番目の正解者か（0始まり）
    //   info.streak … この正解を含めた連続正解数
    //   info.hint   … 連想クイズで正解した時のヒントの数（1始まり）
    correctPoints: function (conf, q, info = {}) {
        const c = conf || {};
        let pts;
        if (c.scoreType === 'hint' && info.hint) {
            const table = Array.isArray(c.hintPts) ? c.hintPts : [];
            pts = Number(table[info.hint - 1] !== undefined ? table[info.hint - 1] : table[table.length - 1]) || 0;
        } else {
            pts = this.pointsForCorrect(c, q, info.rank === undefined ? null : info.rank);
        }
        // 連続正解ボーナス（2問連続から）
        const bonus = Number(c.streakBonus) || 0;
        if (bonus > 0 && (info.streak || 0) >= 2) pts += bonus;
        return pts;
    },

    // 間違えた時に引く点（どの解答権でも同じ。未設定の保存済みセットは問題ごとの減点）
    wrongLoss: function (conf, q) {
        const c = conf || {};
        const d = c.mode === 'buzz' && (c.wrongDeduct === undefined || c.wrongDeduct === null || c.wrongDeduct === '') ? c.buzzDeduct : c.wrongDeduct;
        if (d === undefined || d === null || d === '') return (q && q.loss) || 0;
        return Number(d) || 0;
    },

    // ---------------------------------------------------------
    // 遊び方の説明（ルールの画面の一番上と、矛盾がないかの確認用）
    // ---------------------------------------------------------
    // 一問一答の「読み上げ」— 問題文をモニター・回答者の端末に出さない（先読みの駆け引き用）
    readAloud: function (conf, ctx) {
        // セットは1つの形式なので、最初の問題の形式で見る（無ければ渡された形式）
        return !!(conf && conf.readAloud) && /^free/.test((ctx && (ctx.firstType || ctx.qType)) || '');
    },

    describe: function (conf, questions) {
        const c = conf || {};
        const ctx = this.context(c, questions);
        const parts = [];
        const by = { oral: '口頭で答え、出題者が〇×を判定', written: '手書きで答え、出題者が〇×を判定', button: 'ボタンで答え、自動で判定' }[ctx.answerBy];
        const who = { normal: '全員が手元で同時に', buzz: '早押しで押した人が', turn: '順番に1人ずつ', nominate: '出題者に指名された人が', solo: '1人で' }[ctx.mode] || '';
        parts.push(`${who}${by}。`);
        if (this.readAloud(c, ctx)) parts.push('問題文は画面に出さず司会者が読み上げ、モニターには得点だけ。');
        // 正解
        const st = c.scoreType || 'uniform';
        let gain;
        if (ctx.isPanel) gain = '解答者は「◯番、答え」とパネルを指名し、正解したらそのパネルの点';
        else if (c.gameType === 'timerace') gain = '正解した数を数える';
        else if (st === 'ranked') gain = '正解すると速い順に傾斜した点';
        else if (st === 'hint') gain = '正解すると少ないヒントほど高い点';
        else if (st === 'first') gain = `先着${parseInt(c.firstN) || 1}人だけ得点`;
        else gain = c.uniformPts !== undefined && c.uniformPts !== '' ? `正解すると${Number(c.uniformPts)}点` : '正解すると問題ごとの配点';
        if (Number(c.streakBonus) > 0) gain += `（連続正解で+${Number(c.streakBonus)}点）`;
        parts.push(gain + '。');
        // 誤答
        const wrong = [];
        if (ctx.mode === 'buzz') wrong.push(c.buzzWrongAction === 'end' ? '誤答したら問題は終わり' : '誤答したら他の人が押せる');
        if (ctx.mode === 'turn' && this.can('turnWrong', ctx).ok) wrong.push(c.turnWrongAction === 'next' ? '誤答したら次の人に解答権が移る' : '誤答したらその問題は終わり');
        const loss = this.wrongLoss(c, {});
        if (loss > 0) wrong.push(`${loss}点減点`);
        if (wrong.length) parts.push(wrong.join('・') + '。');
        // 勝ち方
        const gt = c.gameType || 'score';
        if (gt === 'survival') {
            let t = `${c.survivalLives || 1}回ミスしたら脱落し、最後まで残った人が勝ち`;
            if (Number(c.survivalEndCount) > 0) t += `（残り${Number(c.survivalEndCount)}人になったら終了）`;
            parts.push(t + '。');
        } else if (gt === 'winthrough') {
            const target = Number(c.winTarget) || 5;
            const quota = Number(c.winQuota) || 0;
            parts.push(`${target}${c.winBy === 'correct' ? '問正解' : '点'}で勝ち抜け${quota ? `、${quota}人勝ち抜けたら終了` : ''}。`);
        } else if (gt === 'timerace') {
            parts.push('正解数が多い人が勝ち、同じなら解答時間の合計が短い人が上。');
        } else {
            parts.push(`得点が高い人が勝ち${c.tieBreak === 'time' ? '（同点は解答時間が短い人が上）' : ''}。`);
        }
        // 時間
        const t = [];
        if (c.timeLimitEnabled === 'on') t.push(c.timerKind === 'pool' ? `持ち時間はセット全体で${c.timeLimitSeconds || 60}秒` : `1問${c.timeLimitSeconds || 30}秒`);
        if (Number(c.answerSec) > 0 && this.can('answerSec', ctx).ok) t.push(`解答者は${Number(c.answerSec)}秒以内に答える（過ぎたら誤答）`);
        if (t.length) parts.push(t.join('・') + '。');
        return parts.join('');
    },

    // ---------------------------------------------------------
    // 順位 — 得点の高い順。同点なら設定に応じて解答時間の合計が短い順
    //   field … 'periodScore'（このセット）か 'totalScore'（番組全体）
    // ---------------------------------------------------------
    comparator: function (conf, field) {
        const f = field || 'periodScore';
        const timeField = f === 'totalScore' ? 'totalCorrectTime' : 'periodCorrectTime';
        const useTime = (conf && conf.tieBreak) === 'time';
        const winThrough = (conf && conf.gameType) === 'winthrough';
        return (a, b) => {
            // 勝ち抜けは、勝ち抜けた人が先（勝ち抜けた順）、その後に得点順
            if (winThrough) {
                const ca = a.cleared ? (Number(a.clearedRank) || 999) : Infinity;
                const cb = b.cleared ? (Number(b.clearedRank) || 999) : Infinity;
                if (ca !== cb) return ca - cb;
            }
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
