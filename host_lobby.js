/* =========================================================
 * host_lobby.js — 司会者の「待合室」（第1問を始める前の画面）
 *
 * 始まる前に要るのは「人を集める」ことだけなので、その間は
 *   部屋コード（大きく）・QR・招待リンク・入ってきた参加者・今回の遊び方・戻る
 * だけを出し、判定ボタン・解答ボード・問題／正解の枠・上の帯は隠す
 * （#host-control-view.hl-before — style_host.css）。
 * テストプレイ（部屋コードが TEST-…）でも同じ画面で、本物のスマホからも入れる。
 * =======================================================*/
window.App = window.App || {};

App.HostLobby = {
    _timer: null,

    S: function () { return window.App.Studio || {}; },
    isTest: function () { return /^TEST-/.test(String(App.State.currentRoomId || '')); },

    // 第1問を始める前か（タイトル表示中・順番決め中も「前」）
    isBefore: function () {
        const S = this.S();
        if (!App.State.currentRoomId) return false;
        if ((App.State.currentPeriodIndex || 0) !== 0 || (App.State.currentQIndex || 0) !== 0) return false;
        if (!App.Data.studioQuestions || !App.Data.studioQuestions.length) return false;
        return !!S.inPreSetup || S.currentStepId === 0 || S.currentStepId === null || S.currentStepId === undefined;
    },

    joinUrl: function () {
        return `${window.location.origin}${window.location.pathname}?room=${App.State.currentRoomId}`;
    },

    esc: function (v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },

    qrSvg: function (text) {
        if (typeof qrcode === 'undefined') return '';
        try {
            const qr = qrcode(0, 'M');
            qr.addData(text);
            qr.make();
            return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        } catch (e) { return ''; }
    },

    // 状態に合わせて出し入れ（setStep などのあとに呼ばれる）
    sync: function () {
        const view = document.getElementById('host-control-view');
        if (!view) return;
        const on = this.isBefore();
        view.classList.toggle('hl-before', on);
        if (!on) {
            document.getElementById('host-lobby')?.remove();
            if (this._timer) { clearInterval(this._timer); this._timer = null; }
            return;
        }
        this.render();
        if (!this._timer) this._timer = setInterval(() => { if (this.isBefore()) this.renderPlayers(); else this.sync(); }, 1000);
    },

    render: function () {
        const main = document.querySelector('#host-control-view .simple-studio-main');
        if (!main) return;
        let box = document.getElementById('host-lobby');
        const code = App.State.currentRoomId;
        if (box && box.dataset.code === code) { this.renderPlayers(); this.renderHint(); return; }
        if (!box) { box = document.createElement('div'); box.id = 'host-lobby'; main.prepend(box); }
        box.dataset.code = code;
        const conf = App.Data.currentConfig || {};
        const title = conf.periodTitle || '';
        const guide = conf.playerGuide || '';
        box.innerHTML = `
            <div class="hl-top">
                <button type="button" class="hl-back">${this.isTest() ? 'テストを終える' : '戻る'}</button>
                <div class="hl-title">${this.isTest() ? '<span class="hl-tag">テスト</span>' : ''}${this.esc(title)}</div>
            </div>
            <div class="hl-join">
                <div class="hl-code-wrap">
                    <div class="hl-k">部屋コード</div>
                    <button type="button" class="hl-code" title="押すとコピー">${this.esc(code)}</button>
                    <button type="button" class="hl-share">招待リンクを送る</button>
                </div>
                <div class="hl-qr">${this.qrSvg(this.joinUrl())}</div>
            </div>
            <div class="hl-sec">
                <div class="hl-k">参加者 <b class="hl-count">0</b>人</div>
                <div class="hl-players"></div>
            </div>
            ${guide ? `<div class="hl-sec"><div class="hl-k">今回の遊び方</div><p class="hl-guide">${this.esc(guide)}</p></div>` : ''}
            <label class="hl-sec hl-pmon"><span><b>解答者のスマホにモニターを映す</b><small>スマホの上にモニターと同じ画面、下に押す・選ぶなどの操作。会場のモニターが無い時や、見えにくい席がある時に</small></span><input type="checkbox" class="hl-pmon-chk"></label>
            <p class="hl-hint"></p>`;
        box.querySelector('.hl-back').onclick = () => this.back();
        box.querySelector('.hl-code').onclick = () => this.copy(code, '部屋コードをコピーしました');
        box.querySelector('.hl-share').onclick = () => this.share();
        const pm = box.querySelector('.hl-pmon-chk');
        if (pm) {
            window.db.ref(`rooms/${code}/status/playerMonitor`).once('value', s => { pm.checked = !!s.val(); });
            pm.onchange = () => window.db.ref(`rooms/${code}/status`).update({ playerMonitor: pm.checked ? true : null });
        }
        this.renderPlayers();
        this.renderHint();
    },

    renderPlayers: function () {
        const box = document.getElementById('host-lobby');
        if (!box) return;
        const ps = Object.values(App.Data.players || {});
        const names = ps.map(p => p.name || '---');
        const key = names.join('\u0001');
        if (box._names === key) return;
        box._names = key;
        box.querySelector('.hl-count').textContent = ps.length;
        box.querySelector('.hl-players').innerHTML = ps.length
            ? names.map(n => `<span class="hl-p">${this.esc(n)}</span>`).join('')
            : '<span class="hl-empty">まだ誰もいません。部屋コードかQRで入ってもらいます</span>';
        this.renderHint();
    },

    renderHint: function () {
        const el = document.querySelector('#host-lobby .hl-hint');
        if (!el) return;
        const mode = (App.Data.currentConfig || {}).mode;
        const n = Object.keys(App.Data.players || {}).length;
        el.textContent = (mode === 'turn' || mode === 'solo')
            ? (n ? (mode === 'solo' ? '下で挑戦する人を決めてから、「第1問 開始」を押します' : '下で答える順番を決めてから、「第1問 開始」を押します')
                : '参加者が入るのを待っています')
            : '全員そろったら、下の「第1問 開始」を押します';
    },

    copy: function (text, msg) {
        const done = () => App.Ui.showToast(msg);
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
        else done();
    },

    share: function () {
        const url = this.joinUrl();
        const text = `クイズに参加してください\n部屋コード: ${App.State.currentRoomId}`;
        if (navigator.share) navigator.share({ title: 'クイズに参加', text, url }).catch(() => {});
        else this.copy(url, '招待リンクをコピーしました');
    },

    back: function () {
        if (this.isTest()) {
            const sel = document.getElementById('test-view-select');
            if (sel) { sel.value = 'dashboard'; sel.dispatchEvent(new Event('change')); return; }
        }
        document.getElementById('host-close-studio-btn-simple')?.click();
    },

    // App.Studio の画面が切り替わる所のあとで sync する
    init: function () {
        const S = window.App.Studio;
        if (!S || S._lobbyHooked) return;
        S._lobbyHooked = true;
        ['setStep', 'showPreQuizSetup', 'setupPeriod', 'enterHostMode', 'goNext'].forEach(n => {
            const orig = S[n];
            if (typeof orig !== 'function') return;
            S[n] = function () {
                const r = orig.apply(this, arguments);
                try { App.HostLobby.sync(); } catch (e) { console.warn(e); }
                return r;
            };
        });
    },
};

document.addEventListener('DOMContentLoaded', () => App.HostLobby.init());
