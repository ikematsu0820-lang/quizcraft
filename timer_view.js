/* =========================================================
 * timer_view.js — タイマーの見た目
 *
 * タイマーは「動き（ルール）」と「見た目（デザイン）」に分けている。
 *   動き … 作成画面のルール「制限時間」（host_studio.js が時計を進める）
 *          ルームの status.timer に { kind, totalMs, remainMs, running, startAt }
 *   見た目 … 作成画面のデザイン「タイマー」（design.timerStyle など）
 * ここは見た目だけ — モニター（viewer.js）・回答端末（player.js）・
 * デザイン画面の見本（host_design.js）が同じ描画を使う。
 * =======================================================*/

window.App = window.App || {};

App.TimerView = {
    STYLES: [
        { id: 'bar_top', name: '上のバー' },
        { id: 'bar_bottom', name: '下のバー' },
        { id: 'ring', name: '円' },
        { id: 'number', name: '数字' },
        { id: 'clock', name: '時計' },
        { id: 'fuse', name: '導火線' },
        { id: 'ball', name: '玉' },
    ],

    // 残り時間（ミリ秒）— status.timer とサーバー時刻から
    remainingMs: function (t, serverNow) {
        if (!t) return null;
        const remain = Number(t.remainMs) || 0;
        if (!t.running || !t.startAt) return Math.max(0, remain);
        return Math.max(0, remain - (serverNow - Number(t.startAt)));
    },

    settings: function (design) {
        const d = design || {};
        return {
            style: d.timerStyle || 'bar_top',
            warnSec: d.timerWarnSec !== undefined && d.timerWarnSec !== '' ? Number(d.timerWarnSec) : 5,
            blink: d.timerWarnBlink !== false,
            edge: !!d.timerWarnEdge,
            tick: !!d.timerTickSound,
            accent: d.accentColor || '#ffd700',
            warn: '#ff3b30',
        };
    },

    // container の中にタイマーを描く／更新する。毎フレーム呼んでよい
    // （構造は最初の1回だけ作り、以降は数値と色だけ変える）。
    render: function (container, design, remainMs, totalMs, opts = {}) {
        if (!container) return;
        const s = this.settings(design);
        let root = container.querySelector(':scope > .tv-root');
        if (!root || root.dataset.style !== s.style) {
            if (root) root.remove();
            root = document.createElement('div');
            root.className = `tv-root tv-${s.style}`;
            root.dataset.style = s.style;
            root.innerHTML = this.markup(s.style);
            container.appendChild(root);
        }
        const total = Math.max(1, Number(totalMs) || 1);
        const remain = Math.max(0, Number(remainMs) || 0);
        const frac = Math.min(1, remain / total);
        const secs = Math.ceil(remain / 1000);
        const warn = remain > 0 && remain <= s.warnSec * 1000;
        const expired = remain <= 0;
        const color = warn || expired ? s.warn : s.accent;
        root.style.setProperty('--tv-color', color);
        root.style.setProperty('--tv-frac', frac);
        root.classList.toggle('tv-warn', warn);
        root.classList.toggle('tv-blink', warn && s.blink);
        root.classList.toggle('tv-expired', expired);
        container.classList.toggle('tv-edge-warn', warn && s.edge);
        const num = root.querySelector('.tv-num');
        if (num) num.textContent = String(secs);

        if (s.style === 'ring') {
            const c = root.querySelector('.tv-ring-fg');
            if (c) c.style.strokeDashoffset = String(100 * (1 - frac));
        } else if (s.style === 'clock') {
            const hand = root.querySelector('.tv-clock-hand');
            if (hand) hand.style.transform = `rotate(${(1 - frac) * 360}deg)`;
            const face = root.querySelector('.tv-clock-face');
            if (face) face.style.background = `conic-gradient(from 0deg, transparent 0 ${(1 - frac) * 360}deg, color-mix(in srgb, ${color} 35%, transparent) ${(1 - frac) * 360}deg 360deg), rgba(0,0,0,0.55)`;
        } else if (s.style === 'fuse') {
            const spark = root.querySelector('.tv-fuse-spark');
            if (spark) spark.style.left = `${(1 - frac) * 100}%`;
        }

        // 秒読み音（モニターだけ — opts.sound が true の時）
        if (opts.sound && s.tick && warn && this._lastTick !== secs) {
            this._lastTick = secs;
            this.beep(secs <= 1 ? 1320 : 880);
        }
        if (opts.sound && expired && s.tick && this._lastTick !== 0) {
            this._lastTick = 0;
            this.beep(220, 0.6);
        }
        if (!warn && !expired) this._lastTick = null;
    },

    clear: function (container) {
        if (!container) return;
        container.querySelector(':scope > .tv-root')?.remove();
        container.classList.remove('tv-edge-warn');
        this._lastTick = null;
    },

    markup: function (style) {
        if (style === 'ring') {
            return `
                <svg class="tv-ring-svg" viewBox="0 0 36 36" aria-hidden="true">
                    <circle class="tv-ring-bg" cx="18" cy="18" r="15.9" pathLength="100"></circle>
                    <circle class="tv-ring-fg" cx="18" cy="18" r="15.9" pathLength="100"></circle>
                </svg>
                <div class="tv-num"></div>`;
        }
        if (style === 'number') return '<div class="tv-num"></div>';
        if (style === 'ball') return '<div class="tv-ball-orb"><span class="tv-num"></span></div>';
        if (style === 'clock') {
            const ticks = Array.from({ length: 12 }, (_, i) => `<span class="tv-clock-tick" style="transform:rotate(${i * 30}deg)"></span>`).join('');
            return `<div class="tv-clock-face">${ticks}<span class="tv-clock-hand"></span><span class="tv-clock-pin"></span></div><div class="tv-num"></div>`;
        }
        if (style === 'fuse') {
            return `
                <div class="tv-fuse-line"><div class="tv-fuse-burnt"></div><div class="tv-fuse-spark"></div></div>
                <div class="tv-fuse-bomb"><span class="tv-num"></span></div>`;
        }
        return '<div class="tv-bar"><div class="tv-bar-fill"></div></div>';
    },

    _audio: null,
    beep: function (freq = 880, dur = 0.12) {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            this._audio = this._audio || new Ctx();
            const ctx = this._audio;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'square';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.08, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
            o.connect(g).connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + dur);
        } catch (e) { /* noop */ }
    },
};
