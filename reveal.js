/* =========================================================
 * reveal.js — モニターの「正解の出し方」（一問一答・連想・文字パネルなど、答えが文字の形式）
 *
 *   見た目 › 正解の出し方（design.revealStyle）
 *     band   … 下に帯で（問題文は残る）— 最初の値
 *     full   … 全画面で大きく
 *     inline … 問題文のすぐ下に添える
 *   design.revealWinners === 'off' なら正解者の名前を出さない
 *   色・書体・文字の飾りはテーマから（正解の地＝正解の色、無ければアクセント色）
 *   選択式・並べ替え・多答などは、それぞれの形式の出し方（光る・並ぶ・開く）のまま。
 * =======================================================*/
window.App = window.App || {};

App.Reveal = {
    STYLES: [
        { v: 'band', t: '帯で', sub: '問題文は残す' },
        { v: 'full', t: '全画面で', sub: '答えを大きく' },
        { v: 'inline', t: '添える', sub: '問題文のすぐ下' },
    ],

    // 今作っているセットで、この設定を出すか（答えが文字の形式だけ）
    applies: function () {
        const C = window.App.Creator;
        const t = (C && C.currentType) || '';
        return /^(free|assoc|letter_select)/.test(t);
    },
    summary: function (d) {
        const s = this.STYLES.find(o => o.v === ((d && d.revealStyle) || 'band')) || this.STYLES[0];
        return s.t + ((d && d.revealWinners === 'off') ? '' : '・正解者の名前');
    },

    esc: function (v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    faint: function (c) { return !c || c === 'transparent' || /rgba\([^)]*,\s*0(\.\d+)?\)$/.test(c) && parseFloat(c.split(',').pop()) < 0.35; },
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
        // 問題文の色（全画面・添える時の答えの文字）
        const qfg = d.qTextColor || this.textOn(d.mainBgColor);
        return { accent, bg, fg, line, qfg };
    },

    render: function (mainText, q, st, d) {
        d = d || {};
        const style = d.revealStyle || 'band';
        const ans = this.esc(st.correct || '');
        const winners = d.revealWinners === 'off' ? [] : (st.revealWinners || []);
        const note = this.esc(st.commentary || q.commentary || '');
        const c = this.colors(d);
        const len = String(st.correct || '').length;
        const size = d.revealFontSize || null;
        const who = winners.length ? `<div class="rv-who">正解者　${winners.map(n => this.esc(n)).join('・')}</div>` : '';
        mainText.querySelectorAll('.rv-box').forEach(e => e.remove());
        const box = document.createElement('div');
        box.className = `rv-box rv-${style}`;
        box.style.setProperty('--rv-bg', c.bg);
        box.style.setProperty('--rv-fg', c.fg);
        box.style.setProperty('--rv-line', c.line);
        box.style.setProperty('--rv-accent', c.accent);
        box.style.setProperty('--rv-qfg', c.qfg);
        if (style === 'full') {
            const fs = size || (len > 20 ? '8cqh' : len > 10 ? '12cqh' : '18cqh');
            box.style.background = d.mainBgColor || '#0a0a0a';
            box.innerHTML = `<div class="rv-label">正解</div><div class="rv-ans" style="font-size:${fs};">${ans}</div>${who}${note ? `<div class="rv-note">${note}</div>` : ''}`;
            mainText.appendChild(box);
        } else if (style === 'inline') {
            const fs = size || (len > 20 ? '5cqh' : '7cqh');
            box.innerHTML = `<span class="rv-mark">正解</span><span class="rv-ans" style="font-size:${fs};">${ans}</span>${who}${note ? `<div class="rv-note">${note}</div>` : ''}`;
            const qa = mainText.querySelector('.q-area');
            if (qa && qa.parentNode) qa.parentNode.insertBefore(box, qa.nextSibling); else mainText.appendChild(box);
        } else {
            const fs = size || (len > 20 ? '5.5cqh' : len > 10 ? '7.5cqh' : '9cqh');
            box.innerHTML = `<div class="rv-row"><span class="rv-mark">正解</span><span class="rv-ans" style="font-size:${fs};">${ans}</span></div>${who || note ? `<div class="rv-sub">${who}${note ? `<div class="rv-note">${note}</div>` : ''}</div>` : ''}`;
            mainText.appendChild(box);
        }
    },
};
