/* =========================================================
 * bridge_view.js — ブリッジスライド（「第○問」）の演出
 *
 * 色はデザインの bridgeBgColor / bridgeTextColor、アクセント色は
 * テーマ（accentColor）。演出の型は design.bridgeStyle。
 * モニター（viewer.js）と作成画面のプレビュー（host_creator.js）が
 * 同じ描画を使う。入れ物は container-type:size（cqw/cqh で大きさを決める）。
 * =======================================================*/

window.App = window.App || {};

App.BridgeView = {
    STYLES: [
        { id: 'plain', name: 'シンプル' },
        { id: 'band', name: '帯がスライド' },
        { id: 'count', name: '数字がドン' },
        { id: 'shutter', name: 'シャッター' },
        { id: 'spotlight', name: 'スポットライト' },
        { id: 'typewriter', name: 'タイプ' },
    ],

    esc: function (v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    // 「第 3 問」→ { pre: '第', num: '3', post: '問' }（数字が無ければ全部 text）
    split: function (label) {
        const m = /^(\D*?)\s*(\d+)\s*(\D*)$/.exec(String(label || '').trim());
        return m ? { pre: m[1], num: m[2], post: m[3], text: label } : { text: label };
    },

    render: function (container, design, label, opts = {}) {
        if (!container) return;
        const d = design || {};
        const style = d.bridgeStyle || 'plain';
        const text = d.bridgeTextColor || '#ffffff';
        const accent = d.accentColor || '#00e5ff';
        const size = d.bridgeFontSize ? String(d.bridgeFontSize).replace('vw', 'cqw') : (String(label).length > 8 ? '7cqw' : '12cqw');
        const p = this.split(label);
        const e = (v) => this.esc(v);
        let inner;
        if (style === 'band') {
            inner = `<div class="bv-band" style="--bv-accent:${accent};"><div class="bv-band-strip"></div><div class="bv-text" style="color:${text}; font-size:${size};">${e(label)}</div></div>`;
        } else if (style === 'count' && p.num) {
            inner = `<div class="bv-count" style="--bv-accent:${accent}; color:${text};">
                <span class="bv-count-side" style="font-size:calc(${size} * 0.45);">${e(p.pre)}</span>
                <span class="bv-count-num" style="font-size:calc(${size} * 1.6); color:${accent};">${e(p.num)}</span>
                <span class="bv-count-side" style="font-size:calc(${size} * 0.45);">${e(p.post)}</span>
                <span class="bv-count-burst"></span></div>`;
        } else if (style === 'shutter') {
            inner = `<div class="bv-shutter" style="--bv-accent:${accent};"><div class="bv-text" style="color:${text}; font-size:${size};">${e(label)}</div><div class="bv-shutter-top"></div><div class="bv-shutter-bottom"></div></div>`;
        } else if (style === 'spotlight') {
            inner = `<div class="bv-spot"><div class="bv-text" style="color:${text}; font-size:${size};">${e(label)}</div><div class="bv-spot-mask"></div></div>`;
        } else if (style === 'typewriter') {
            const chars = Array.from(String(label));
            inner = `<div class="bv-type bv-text" style="color:${text}; font-size:${size};">${chars.map((c, i) => `<span style="animation-delay:${0.12 * i}s">${c === ' ' ? '&nbsp;' : e(c)}</span>`).join('')}<span class="bv-caret" style="background:${accent}; animation-delay:${0.12 * chars.length}s"></span></div>`;
        } else {
            inner = `<div class="bv-plain bv-text" style="color:${text}; font-size:${size};">${e(label)}</div>`;
        }
        container.innerHTML = `<div class="bv-root bv-${style}-root">${inner}</div>`;
    },
};
