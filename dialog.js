/* =========================================================
 * dialog.js — 画面の中に出す確認・お知らせ・入力（ブラウザ標準のポップアップの代わり）
 *
 *   await App.Dialog.confirm('消しますか？', { ok: '消す', danger: true })  → true / false
 *   App.Dialog.alert('保存しました')                                       → Promise（待たなくてよい）
 *   await App.Dialog.prompt('セット名', '初期値', { placeholder })          → 文字 / null（やめた）
 *   await App.Dialog.number('得点', 10, { min, max })                       → 数 / null
 *
 * 見た目は放送卓風（黒×アンバー）。スマホでは下から出る。
 * =======================================================*/
window.App = window.App || {};

App.Dialog = {
    _css: false,
    style: function () {
        if (this._css) return;
        this._css = true;
        const s = document.createElement('style');
        s.textContent = `
.qd-ov { position:fixed; inset:0; z-index:2147483000; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box; animation:qdFade .12s ease-out; }
.qd-box { width:100%; max-width:380px; background:#16161a; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05); padding:20px 18px 16px; box-sizing:border-box; color:#e5e5e8; font-family:inherit; animation:qdUp .16s ease-out; }
.qd-title { font-size:1rem; font-weight:800; margin:0 0 8px; color:#fff; }
.qd-msg { font-size:0.9rem; line-height:1.6; color:#c9c9cf; white-space:pre-wrap; word-break:break-word; max-height:50vh; overflow:auto; }
.qd-input { width:100%; box-sizing:border-box; margin:12px 0 0; height:46px; padding:0 12px; border:none; border-radius:8px; background:#09090b; box-shadow:inset 0 1px 4px rgba(0,0,0,0.85); color:#fff; font-size:16px; font-family:inherit; outline:none; }
.qd-ov .qd-input, .qd-ov .qd-input:focus { border:none !important; outline:none !important; background:#09090b !important; color:#fff !important; height:46px !important; min-height:0 !important; }
.qd-ov .qd-input:focus { box-shadow:inset 0 1px 4px rgba(0,0,0,0.85), 0 0 0 2px rgba(245,158,11,0.6) !important; }
.qd-btns { display:flex; gap:8px; margin-top:16px; }
.qd-btn { flex:1; min-height:46px; border:none; border-radius:10px; font-size:0.95rem; font-weight:800; cursor:pointer; font-family:inherit; }
.qd-cancel { background:#26262d; color:#e5e5e8; }
.qd-ok { background:linear-gradient(180deg,#fbbf24,#f59e0b); color:#1b1300; }
.qd-ok.qd-danger { background:#b91c1c; color:#fff; }
@keyframes qdFade { from { opacity:0; } }
@keyframes qdUp { from { transform:translateY(10px); opacity:0; } }
@media (max-width:600px) {
  .qd-ov { align-items:flex-end; padding:0; }
  .qd-box { max-width:none; border-radius:16px 16px 0 0; padding:22px 16px calc(16px + env(safe-area-inset-bottom)); }
}`;
        document.head.appendChild(s);
    },

    // 共通: 箱を出して、押されたボタンの値で閉じる
    _open: function ({ title, message, input, okLabel, cancelLabel, danger }) {
        this.style();
        return new Promise(resolve => {
            const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const ov = document.createElement('div');
            ov.className = 'qd-ov';
            ov.innerHTML = `
                <div class="qd-box" role="dialog" aria-modal="true">
                    ${title ? `<p class="qd-title">${esc(title)}</p>` : ''}
                    ${message ? `<div class="qd-msg">${esc(message)}</div>` : ''}
                    ${input ? `<input class="qd-input" type="${input.type || 'text'}" ${input.type === 'number' ? 'inputmode="decimal"' : ''} placeholder="${esc(input.placeholder || '')}" value="${esc(input.value ?? '')}">` : ''}
                    <div class="qd-btns">
                        ${cancelLabel ? `<button type="button" class="qd-btn qd-cancel">${esc(cancelLabel)}</button>` : ''}
                        <button type="button" class="qd-btn qd-ok${danger ? ' qd-danger' : ''}">${esc(okLabel || 'OK')}</button>
                    </div>
                </div>`;
            const inp = ov.querySelector('.qd-input');
            const done = (v) => {
                document.removeEventListener('keydown', onKey, true);
                ov.remove();
                resolve(v);
            };
            const okVal = () => (inp ? inp.value : true);
            const cancelVal = inp ? null : false;
            const onKey = (e) => {
                if (e.key === 'Escape') { e.preventDefault(); done(cancelLabel ? cancelVal : okVal()); }
                else if (e.key === 'Enter' && !e.isComposing && (inp ? document.activeElement === inp : true)) { e.preventDefault(); done(okVal()); }
            };
            document.addEventListener('keydown', onKey, true);
            ov.querySelector('.qd-ok').onclick = () => done(okVal());
            const c = ov.querySelector('.qd-cancel');
            if (c) c.onclick = () => done(cancelVal);
            ov.onclick = (e) => { if (e.target === ov && cancelLabel) done(cancelVal); };
            document.body.appendChild(ov);
            setTimeout(() => { if (inp) { inp.focus(); inp.select(); } else ov.querySelector('.qd-ok').focus(); }, 30);
        });
    },

    alert: function (message, opts = {}) {
        return this._open({ title: opts.title, message, okLabel: opts.ok || 'OK' });
    },
    confirm: function (message, opts = {}) {
        return this._open({ title: opts.title, message, okLabel: opts.ok || 'OK', cancelLabel: opts.cancel || 'やめる', danger: !!opts.danger });
    },
    prompt: function (message, value = '', opts = {}) {
        return this._open({ title: opts.title, message, input: { value, placeholder: opts.placeholder }, okLabel: opts.ok || '決定', cancelLabel: opts.cancel || 'やめる' });
    },
    number: function (message, value = '', opts = {}) {
        return this._open({ title: opts.title, message, input: { type: 'number', value, placeholder: opts.placeholder }, okLabel: opts.ok || '決定', cancelLabel: opts.cancel || 'やめる' })
            .then(v => {
                if (v === null || String(v).trim() === '') return null;
                let n = parseFloat(v);
                if (isNaN(n)) return null;
                if (opts.min !== undefined) n = Math.max(opts.min, n);
                if (opts.max !== undefined) n = Math.min(opts.max, n);
                return n;
            });
    },
};
