/* =========================================================
 * host_core.js (v83: Force Session Persistence)
 * =======================================================*/

window.App = window.App || {};

// ★ 修正: セッションからIDを強力に復元
const savedShowId = sessionStorage.getItem('qs_show_id');

window.App.State = {
    currentShowId: savedShowId || null,
    currentRoomId: null,
    isHost: false
};

window.App.Data = {
    createdQuestions: [],
    periodPlaylist: [],
    studioQuestions: [],
    currentConfig: {}
};

window.App.Ui = {
    views: {},
    
    showView: function(targetId) {
        if (Object.keys(this.views).length === 0) this.cacheViews();
        Object.values(this.views).forEach(el => { if(el) el.classList.add('hidden'); });
        const target = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
        if(target) {
            target.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    },

    cacheViews: function() {
        this.views = {
            main: document.getElementById('main-view'),
            hostLogin: document.getElementById('host-login-view'),
            dashboard: document.getElementById('host-dashboard-view'),
            design: document.getElementById('design-view'),
            creator: document.getElementById('creator-view'),
            config: document.getElementById('config-view'),
            hostControl: document.getElementById('host-control-view'),
            ranking: document.getElementById('ranking-view'),
            respondent: document.getElementById('respondent-view'),
            playerGame: document.getElementById('player-game-view'),
            viewerLogin: document.getElementById('viewer-login-view'),
            viewerMain: document.getElementById('viewer-main-view')
        };
    },

    applyTexts: function() {
        if(typeof APP_TEXT === 'undefined') return;
        document.querySelectorAll('[data-text]').forEach(el => {
            const keys = el.getAttribute('data-text').split('.');
            let val = APP_TEXT;
            keys.forEach(k => { if(val) val = val[k]; });
            if(val) el.textContent = val;
        });
    },

    showToast: function(msg) {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const div = document.createElement('div');
        div.className = 'toast-msg';
        div.textContent = msg;
        container.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
};

window.App.init = function() {
    this.Ui.cacheViews();
    this.Ui.applyTexts();
    this.bindEvents();
    
    // ★ IDがあれば即ダッシュボードへ（復帰）
    if (window.App.State.currentShowId) {
        console.log("Session restored:", window.App.State.currentShowId);
        window.App.Dashboard.enter();
    } else {
        this.Ui.showView(this.Ui.views.main);
    }
};

window.App.bindEvents = function() {
    const U = this.Ui;
    const V = this.Ui.views;

    document.getElementById('main-host-btn')?.addEventListener('click', () => U.showView(V.hostLogin));
    document.getElementById('main-player-btn')?.addEventListener('click', () => U.showView(V.respondent));

    // ログイン処理
    document.getElementById('host-login-submit-btn')?.addEventListener('click', () => {
        const input = document.getElementById('show-id-input').value.trim().toUpperCase();
        if(!input) { alert("IDを入力してください"); return; }
        
        // ★ IDを保存
        window.App.State.currentShowId = input;
        sessionStorage.setItem('qs_show_id', input);
        
        window.App.Dashboard.enter();
    });

    // 戻るボタン
    document.querySelectorAll('.header-back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('btn-logout')) {
                sessionStorage.removeItem('qs_show_id');
                window.App.State.currentShowId = null;
                U.showView(V.main);
            } else if (btn.classList.contains('back-to-main')) {
                U.showView(V.main);
            } else {
                window.App.Dashboard.enter();
            }
        });
    });

    // 各機能への遷移
    document.getElementById('dash-create-btn')?.addEventListener('click', () => {
        if(window.App.Creator && window.App.Creator.init) window.App.Creator.init();
    });
    document.getElementById('dash-config-btn')?.addEventListener('click', () => {
        window.App.Data.periodPlaylist = [];
        if(window.App.Config && window.App.Config.init) window.App.Config.init();
    });
    document.getElementById('dash-design-btn')?.addEventListener('click', () => {
        if(window.App.Design && window.App.Design.init) window.App.Design.init();
    });
    // ★ スタジオ起動
    document.getElementById('dash-studio-btn')?.addEventListener('click', () => {
        if(window.App.Studio && window.App.Studio.startRoom) window.App.Studio.startRoom();
    });
    document.getElementById('dash-viewer-btn')?.addEventListener('click', () => U.showView(V.viewerLogin));
};

window.App.Dashboard = {
    enter: function() {
        window.App.Ui.showView(window.App.Ui.views.dashboard);
        const idEl = document.getElementById('dashboard-show-id');
        if(idEl) idEl.textContent = window.App.State.currentShowId;
        this.loadItems();
    },
    
    loadItems: function() {
        const listEl = document.getElementById('dash-set-list');
        if(!listEl) return;
        
        listEl.innerHTML = '<p style="text-align:center;">Loading...</p>';
        const showId = window.App.State.currentShowId;
        
        if(!showId) return;

        Promise.all([
            window.db.ref(`saved_sets/${showId}`).once('value'),
            window.db.ref(`saved_programs/${showId}`).once('value')
        ]).then(([setSnap, progSnap]) => {
            const sets = setSnap.val() || {};
            const progs = progSnap.val() || {};
            
            listEl.innerHTML = '';
            
            // セット一覧
            Object.keys(sets).forEach(k => {
                const d = sets[k];
                const div = document.createElement('div');
                div.className = 'dash-list-item item-type-set';
                div.innerHTML = `
                    <div style="flex:1;">
                        <div class="item-title"><span class="badge-set">SET</span> ${d.title}</div>
                        <div class="item-meta">${new Date(d.createdAt||0).toLocaleDateString()} / ${d.questions.length}Q</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-mini btn-info" onclick="window.App.Dashboard.quick('${k}')">▶ Quick</button>
                        <button class="btn-mini btn-dark" onclick="window.App.Creator.loadSet('${k}', ${JSON.stringify(d).replace(/"/g, '&quot;')})">Edit</button>
                        <button class="delete-btn btn-mini" onclick="window.App.Dashboard.del('saved_sets', '${k}')">Del</button>
                    </div>`;
                listEl.appendChild(div);
            });

            // プログラム一覧
            Object.keys(progs).forEach(k => {
                const d = progs[k];
                const div = document.createElement('div');
                div.className = 'dash-list-item item-type-prog';
                div.innerHTML = `
                    <div style="flex:1;">
                        <div class="item-title"><span class="badge-prog">PROG</span> ${d.title}</div>
                        <div class="item-meta">${new Date(d.createdAt||0).toLocaleDateString()} / ${d.playlist?d.playlist.length:0} Periods</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-mini btn-danger" onclick="window.App.Config.loadExternal(${JSON.stringify(d).replace(/"/g, '&quot;')})">Load</button>
                        <button class="delete-btn btn-mini" onclick="window.App.Dashboard.del('saved_programs', '${k}')">Del</button>
                    </div>`;
                listEl.appendChild(div);
            });
            
            if(listEl.innerHTML === '') listEl.innerHTML = '<p style="text-align:center;">データがありません</p>';
        });
    },
    
    // Quick Start: セットを直接スタジオに送る
    quick: function(key) {
        window.db.ref(`saved_sets/${window.App.State.currentShowId}/${key}`).once('value', snap => {
            const data = snap.val();
            if(data && confirm(`「${data.title}」をすぐに開始しますか？`)) {
                window.App.Studio.quickStart(data);
            }
        });
    },
    
    del: function(path, key) {
        if(confirm("削除しますか？")) {
            window.db.ref(`${path}/${window.App.State.currentShowId}/${key}`).remove()
            .then(() => this.loadItems());
        }
    }
};

// 互換性ブリッジ
window.initCreatorMode = () => window.App.Creator.init();
window.loadSetForEditing = (k, i) => window.App.Creator.loadSet(k, i);
window.enterConfigMode = () => window.App.Config.init();
window.loadProgramToConfigOnDash = (d) => window.App.Config.loadExternal(d);
window.startRoom = () => window.App.Studio.startRoom();
window.quickStartSet = (d) => window.App.Studio.quickStart(d);
window.enterDashboard = () => window.App.Dashboard.enter();

document.addEventListener('DOMContentLoaded', () => {
    window.App.init();
});
