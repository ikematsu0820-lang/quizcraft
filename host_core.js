/* =========================================================
 * host_core.js (v83: Force Session Persistence)
 * =======================================================*/

window.App = window.App || {};

// ★ 修正: セッションからIDを強力に復元 (空白をトリム)
const savedShowId = (sessionStorage.getItem('qs_show_id') || "").trim();

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

    showView: function (targetId) {
        if (Object.keys(this.views).length === 0) this.cacheViews();
        Object.values(this.views).forEach(el => { if (el) el.classList.add('hidden'); });
        const target = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
        if (target) {
            target.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    },

    cacheViews: function () {
        this.views = {
            main: document.getElementById('main-view'),
            hostLogin: document.getElementById('host-login-view'),
            dashboard: document.getElementById('host-dashboard-view'),
            design: document.getElementById('design-view'),
            productionDesign: document.getElementById('production-design-view'),
            creator: document.getElementById('creator-view'),
            config: document.getElementById('config-view'),
            progConfig: document.getElementById('prog-config-view'),
            hostControl: document.getElementById('host-control-view'),
            ranking: document.getElementById('ranking-view'),
            respondent: document.getElementById('respondent-view'),
            playerGame: document.getElementById('player-game-view'),
            viewerLogin: document.getElementById('viewer-login-view'),
            viewerMain: document.getElementById('viewer-main-view'),
            savedItems: document.getElementById('saved-items-view')
        };
    },

    applyTexts: function () {
        if (typeof APP_TEXT === 'undefined') return;
        document.querySelectorAll('[data-text]').forEach(el => {
            const keys = el.getAttribute('data-text').split('.');
            let val = APP_TEXT;
            keys.forEach(k => { if (val) val = val[k]; });
            if (val) el.textContent = val;
        });
    },

    showToast: function (msg) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'toast-msg';
        div.textContent = msg;
        container.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
};

window.App.init = function () {
    this.Ui.cacheViews();
    this.Ui.applyTexts();
    this.bindEvents();

    const urlParams = new URLSearchParams(window.location.search);
    const vcode = urlParams.get('vcode');

    if (vcode) {
        this.Ui.showView(this.Ui.views.viewerMain);
        if (window.App.Viewer && window.App.Viewer.connect) {
            window.App.Viewer.connect(vcode);
        }
        return;
    }

    // ★ IDがあれば即ダッシュボードへ（復帰）
    if (window.App.State.currentShowId) {
        console.log("Session restored:", window.App.State.currentShowId);
        window.App.Dashboard.enter();
    } else {
        this.Ui.showView(this.Ui.views.main);
    }
};

window.App.bindEvents = function () {
    const U = this.Ui;
    const V = this.Ui.views;

    document.getElementById('main-host-btn')?.addEventListener('click', () => U.showView(V.hostLogin));
    document.getElementById('main-player-btn')?.addEventListener('click', () => U.showView(V.respondent));

    // ログイン処理
    document.getElementById('host-login-submit-btn')?.addEventListener('click', () => {
        const input = document.getElementById('show-id-input').value.trim().toUpperCase();
        if (!input) { alert("IDを入力してください"); return; }

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
        if (window.App.Creator && window.App.Creator.init) window.App.Creator.init();
    });
    document.getElementById('dash-config-btn')?.addEventListener('click', () => {
        window.App.Data.periodPlaylist = [];
        if (window.App.Config && window.App.Config.init) window.App.Config.init();
    });
    document.getElementById('dash-question-design-btn')?.addEventListener('click', () => {
        if (window.App.Design && window.App.Design.init) window.App.Design.init();
    });
    document.getElementById('dash-production-design-btn')?.addEventListener('click', () => {
        if (window.App.ProductionDesign && window.App.ProductionDesign.init) window.App.ProductionDesign.init();
    });
    document.getElementById('dash-prog-config-btn')?.addEventListener('click', () => {
        if (window.App.ProgConfig && window.App.ProgConfig.init) window.App.ProgConfig.init();
    });
    document.getElementById('dash-sound-btn')?.addEventListener('click', () => {
        window.App.Ui.showToast("サウンド設定は準備中です");
    });
    // ★ スタジオ起動 (一時的に無効化)
    document.getElementById('dash-studio-btn')?.addEventListener('click', () => {
        // if (window.App.Studio && window.App.Studio.startRoom) window.App.Studio.startRoom();
        window.App.Ui.showToast("スタジオ機能は現在改装中です（実装待ち）");
    });
    document.getElementById('dash-viewer-btn')?.addEventListener('click', () => U.showView(V.viewerLogin));

    // FAB Save Bindings
    document.getElementById('fab-creator-save')?.addEventListener('click', () => {
        if (window.App.Creator?.save) window.App.Creator.save();
    });
    document.getElementById('fab-config-save')?.addEventListener('click', () => {
        if (window.App.Config?.saveRulesToSet) window.App.Config.saveRulesToSet();
    });
    document.getElementById('fab-design-save')?.addEventListener('click', () => {
        if (window.App.Design?.save) window.App.Design.save();
    });
    document.getElementById('fab-prod-save')?.addEventListener('click', () => {
        if (window.App.ProductionDesign?.save) window.App.ProductionDesign.save();
    });
    document.getElementById('fab-prog-save')?.addEventListener('click', () => {
        if (window.App.ProgConfig?.saveProgram) window.App.ProgConfig.saveProgram();
    });
};

window.App.Dashboard = {
    enter: function () {
        window.App.Ui.showView(window.App.Ui.views.dashboard);
        const idEl = document.getElementById('dashboard-show-id');
        if (idEl) idEl.textContent = window.App.State.currentShowId;
        this.updateFlowProgress();
    },

    openSavedItems: function () {
        window.App.Ui.showView(window.App.Ui.views.savedItems);
        this.loadItems();
    },

    updateFlowProgress: function () {
        const showId = window.App.State.currentShowId;
        if (!showId) return;

        Promise.all([
            window.db.ref(`saved_sets/${showId}`).once('value'),
            window.db.ref(`saved_programs/${showId}`).once('value')
        ]).then(([setSnap, progSnap]) => {
            const hasSets = setSnap.exists();
            const hasProgs = progSnap.exists();

            document.querySelectorAll('.flow-step').forEach(s => s.classList.remove('active'));

            if (!hasSets) {
                document.getElementById('step-create')?.classList.add('active');
            } else if (!hasProgs) {
                document.getElementById('step-design')?.classList.add('active');
            } else {
                document.getElementById('step-launch')?.classList.add('active');
            }
        });
    },

    loadItems: function () {
        const listEl = document.getElementById('dash-set-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        this.itemCache = {}; // Initialize cache
        let showId = window.App.State.currentShowId;
        if (showId) showId = showId.trim();

        if (!showId) return;

        Promise.all([
            window.db.ref(`saved_sets/${showId}`).once('value'),
            window.db.ref(`saved_programs/${showId}`).once('value')
        ]).then(([setSnap, progSnap]) => {
            const sets = setSnap.val() || {};
            const progs = progSnap.val() || {};

            // ★ ソート処理の強化 (新規保存直後のアイテムを上位に)
            const getTs = (d) => {
                if (typeof d.createdAt === 'number') return d.createdAt;
                // timestampオブジェクトや未定義の場合は現在時刻(または大きな値)として扱うことでトップに表示
                return Date.now() + 10000;
            };

            const sortedSets = Object.keys(sets).map(k => ({ ...sets[k], key: k }))
                .sort((a, b) => getTs(b) - getTs(a));

            const sortedProgs = Object.keys(progs).map(k => ({ ...progs[k], key: k }))
                .sort((a, b) => getTs(b) - getTs(a));

            // Store data for filtering
            this.setsData = sortedSets;
            this.progsData = sortedProgs; // Programs usually shown in "All"

            // Initialize filter states
            if (!this.filterState) {
                this.filterState = { mode: 'all', type: 'all' };
            }

            // Inject Filter UI if not present
            if (!document.getElementById('dash-filter-container')) {
                const filterHtml = `
                    <div id="dash-filter-container" style="margin-bottom:15px;">
                        <!-- Row 1: Game Mode -->
                        <div id="dash-filter-mode" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:5px;">
                            <button class="filter-btn active" onclick="window.App.Dashboard.applyFilter('mode', 'all', this)">すべて</button>
                            <button class="filter-btn" onclick="window.App.Dashboard.applyFilter('mode', 'normal', this)">一斉</button>
                            <button class="filter-btn" onclick="window.App.Dashboard.applyFilter('mode', 'buzz', this)">早押し</button>
                            <button class="filter-btn" onclick="window.App.Dashboard.applyFilter('mode', 'turn', this)">順番</button>
                            <button class="filter-btn" onclick="window.App.Dashboard.applyFilter('mode', 'solo', this)">ソロ</button>
                        </div>
                        <!-- Row 2: Question Type -->
                        <div id="dash-filter-type" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:5px;">
                            <button class="filter-btn active" onclick="window.App.Dashboard.applyFilter('type', 'all', this)">すべて</button>
                            <button class="filter-btn" onclick="window.App.Dashboard.applyFilter('type', 'free', this)">一問一答</button>
                            <button class="filter-btn" onclick="window.App.Dashboard.applyFilter('type', 'choice', this)">選択式</button>
                            <button class="filter-btn" onclick="window.App.Dashboard.applyFilter('type', 'sort', this)">並び替え</button>
                            <button class="filter-btn" onclick="window.App.Dashboard.applyFilter('type', 'multi', this)">多答問題</button>
                        </div>
                    </div>
                    <style>
                        .filter-btn {
                            background: rgba(255,255,255,0.05);
                            border: 1px solid rgba(255,255,255,0.1);
                            color: #aaa;
                            padding: 5px 10px;
                            border-radius: 12px;
                            font-size: 0.8em;
                            cursor: pointer;
                            white-space: nowrap;
                            transition: all 0.2s;
                            flex-shrink: 0;
                        }
                        .filter-btn.active {
                            background: rgba(0, 229, 255, 0.15);
                            color: #00e5ff;
                            border-color: #00e5ff;
                            font-weight: bold;
                        }
                    </style>
                `;
                listEl.insertAdjacentHTML('beforebegin', filterHtml);
            }

            // Initial Render
            this.runFilter();
        });
    },

    applyFilter: function (category, value, btnEl) {
        // Update state
        if (!this.filterState) this.filterState = { mode: 'all', type: 'all' };
        this.filterState[category] = value;

        // Update UI
        const container = category === 'mode' ? 'dash-filter-mode' : 'dash-filter-type';
        const btns = document.querySelectorAll(`#${container} .filter-btn`);
        btns.forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');

        this.runFilter();
    },

    runFilter: function () {
        const mode = this.filterState.mode;
        const type = this.filterState.type;
        const listEl = document.getElementById('dash-set-list');
        listEl.innerHTML = '';
        this.itemCache = {}; // Reset cache

        // Helper to categorize question type
        const getQCategory = (item) => {
            if (!item.questions || item.questions.length === 0) return 'unknown';
            const t = item.questions[0].type;
            if (['free_oral', 'free_written', 'letter_select'].includes(t)) return 'free';
            if (t === 'choice') return 'choice';
            if (t === 'sort') return 'sort';
            if (['multi', 'multi_written', 'multi_oral'].includes(t)) return 'multi';
            return 'unknown';
        };

        // Render Sets
        let hasData = false;
        this.setsData.forEach(item => {
            const itemMode = (item.config && item.config.mode) ? item.config.mode : 'normal';
            const itemTypeCat = getQCategory(item);

            // Filter Logic
            if (mode !== 'all' && itemMode !== mode) return;
            if (type !== 'all' && itemTypeCat !== type) return;

            hasData = true;
            const k = item.key;
            const d = item;
            this.itemCache[k] = d;

            const dateStr = (typeof d.createdAt === 'number')
                ? new Date(d.createdAt).toLocaleDateString()
                : "New!";
            const qCount = Array.isArray(d.questions) ? d.questions.length : (d.questions ? Object.keys(d.questions).length : 0);

            const modeMap = { 'normal': '一斉', 'buzz': '早押し', 'turn': '順番', 'solo': 'ソロ' };
            const modeStr = modeMap[itemMode] || '一斉';

            const div = document.createElement('div');
            div.className = 'dash-list-item item-type-set';
            div.setAttribute('onclick', `window.App.Dashboard.openItemMenu('${k}', 'set')`);
            div.style.cursor = 'pointer';

            div.innerHTML = `
                <div class="item-main">
                    <div class="item-title"><span class="badge-set">SET</span> ${d.title || "Untitled"}</div>
                    <div class="item-meta">${dateStr} / ${qCount}Q <span style="margin-left:8px; color:#ccc; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.85em;">${modeStr}</span></div>
                </div>`;
            listEl.appendChild(div);
        });

        // Programs - Show only if filters are effectively "All" to avoid confusion, 
        // OR standard behavior: Programs don't have these properties so hide them if filter is active.
        if (mode === 'all' && type === 'all') {
            this.progsData.forEach(item => {
                hasData = true;
                const k = item.key;
                this.itemCache[k] = item;
                const div = document.createElement('div');
                div.className = 'dash-list-item item-type-prog';
                div.setAttribute('onclick', `window.App.Dashboard.openItemMenu('${k}', 'prog')`);
                div.style.cursor = 'pointer';

                div.innerHTML = `
                    <div class="item-main">
                        <div class="item-title"><span class="badge-prog">番組</span> ${item.title}</div>
                        <div class="item-meta">${new Date(item.createdAt || 0).toLocaleDateString()} / ${item.playlist ? item.playlist.length : 0} セット収録</div>
                    </div>`;
                listEl.appendChild(div);
            });
        }

        if (!hasData) {
            listEl.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">該当するデータがありません</p>';
        }
    },

    renameItem: function (key, type) {
        const path = (type === 'set') ? 'saved_sets' : 'saved_programs';
        const data = this.itemCache[key];
        const oldTitle = data.title || "";
        const newTitle = prompt("新しい名前を入力してください:", oldTitle);

        if (newTitle && newTitle !== oldTitle) {
            window.db.ref(`${path}/${window.App.State.currentShowId}/${key}/title`).set(newTitle).then(() => {
                window.App.Ui.showToast("名前を変更しました");
                this.loadItems();
                const modal = document.getElementById('item-menu-modal');
                if (modal) modal.remove();
            });
        }
    },

    startInlineRename: function (el, key, type) {
        const data = this.itemCache[key];
        const oldTitle = data ? (data.title || "") : "";

        // Prevent recursive input
        if (el.querySelector('input')) return;

        // Save original click handler to restore it later
        const originalOnclick = el.onclick;
        el.onclick = null; // Disable click while editing to prevent re-triggering

        el.innerHTML = `<input type="text" id="inline-title-input" value="${oldTitle}" style="width:100%; box-sizing:border-box; padding:6px; border-radius:4px; border:1px solid #00bfff; background:#222; color:#fff; font-size:1em; outline:none;">`;
        const input = document.getElementById('inline-title-input');

        // Prevent click bubble bubbling up to overlay close
        input.onclick = (e) => e.stopPropagation();

        input.focus();

        const save = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== oldTitle) {
                const path = (type === 'set') ? 'saved_sets' : 'saved_programs';
                window.db.ref(`${path}/${window.App.State.currentShowId}/${key}/title`).set(newTitle).then(() => {
                    window.App.Ui.showToast("名前を変更しました");
                    this.loadItems(); // Refresh background list

                    // Restore header with new title
                    el.innerHTML = `${newTitle} <i class="fas fa-pen" style="font-size:0.7em; margin-left:8px; opacity:0.7;"></i>`;
                    el.onclick = () => this.startInlineRename(el, key, type); // Restore handler with new context/closure if needed, or simply reuse the pattern
                });
            } else {
                // Revert
                el.innerHTML = `${oldTitle} <i class="fas fa-pen" style="font-size:0.7em; margin-left:8px; opacity:0.7;"></i>`;
                el.onclick = () => this.startInlineRename(el, key, type);
            }
        };

        input.onblur = save;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        };
    },

    openItemMenu: function (key, type) {
        // Close existing if open
        const existing = document.getElementById('item-menu-modal');
        if (existing) existing.remove();

        const data = this.itemCache[key];
        if (!data) return;

        const isSet = (type === 'set');
        const title = data.title || (isSet ? 'Untitled Set' : 'Untitled Program');

        // Actions
        // Start
        const startAction = isSet
            ? `window.App.Dashboard.quick('${key}')`
            : `window.App.Dashboard.quickProg('${key}')`;

        // Edit 
        const editAction = isSet
            ? `window.App.Dashboard.openEditMenuInSheet('${key}')`
            : `window.App.ProgConfig.loadProgramForDashboard(window.App.Dashboard.itemCache['${key}'])`;

        // Copy
        const copyAction = isSet
            ? `window.App.Dashboard.copySet('${key}')`
            : `window.App.Dashboard.copyProg('${key}')`;

        // Delete
        const delPath = isSet ? 'saved_sets' : 'saved_programs';
        const delAction = `window.App.Dashboard.del('${delPath}', '${key}')`;

        const html = `
            <div id="item-menu-modal" class="bottom-sheet-overlay" onclick="if(event.target===this)this.remove()">
                <div class="bottom-sheet-content">
                    <div class="bottom-sheet-header">
                        <div class="bottom-sheet-title" onclick="window.App.Dashboard.startInlineRename(this, '${key}', '${type}')" style="cursor: pointer;">
                            ${title} <i class="fas fa-pen" style="font-size:0.7em; margin-left:8px; opacity:0.7;"></i>
                        </div>
                        <button class="bottom-sheet-close" onclick="document.getElementById('item-menu-modal').remove()">×</button>
                    </div>
                    <div class="bottom-sheet-body" style="padding: 10px 0;">
                        <button class="sheet-btn" onclick="${startAction}; document.getElementById('item-menu-modal').remove()">
                            <i class="fas fa-play" style="color:#00e5ff; font-size: 0.9em;"></i> スタート
                        </button>
                        <button class="sheet-btn" onclick="${editAction}">
                            <i class="fas fa-pen-fancy" style="color: #64b5f6; font-size: 0.9em;"></i> 編集
                        </button>
                        <button class="sheet-btn" onclick="${copyAction}; document.getElementById('item-menu-modal').remove()">
                            <i class="far fa-file-alt" style="color: #81c784; font-size: 0.9em;"></i> 複製
                        </button>
                        
                        <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 10px 0;"></div>
                        
                        <button class="sheet-btn text-danger" onclick="${delAction}; document.getElementById('item-menu-modal').remove()">
                            <i class="fas fa-trash-alt" style="font-size: 0.9em;"></i> 削除
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Animation
        setTimeout(() => {
            const content = document.querySelector('#item-menu-modal .bottom-sheet-content');
            if (content) content.classList.add('show');
        }, 10);
    },

    // Quick Start: セットを直接スタジオに送る
    // Quick Start: セットを直接スタジオに送る
    quick: function (key) {
        // window.App.Ui.showToast("クイックスタート機能は現在再設計中です（実装待ち）");

        window.db.ref(`saved_sets/${window.App.State.currentShowId}/${key}`).once('value', snap => {
            const data = snap.val();
            if (data && confirm(`「${data.title}」をすぐに開始しますか？`)) {
                window.App.Studio.quickStart(data);
            }
        });

    },

    quickProg: function (key) {
        window.App.Ui.showToast("番組クイックスタート機能は現在再設計中です（実装待ち）");
    },


    // Quick Start: プログラムを直接スタジオに送る
    quickProg: function (key) {
        try {
            if (this.itemCache && this.itemCache[key]) {
                const data = this.itemCache[key];
                if (confirm(`番組構成「${data.title}」をすぐに開始しますか？`)) {
                    if (window.App.Studio && window.App.Studio.quickStartProg) {
                        window.App.Studio.quickStartProg(data);
                    } else {
                        alert("エラー: スタジオ機能が読み込まれていません。");
                    }
                }
                return;
            }
            window.db.ref(`saved_programs/${window.App.State.currentShowId}/${key}`).once('value', snap => {
                const data = snap.val();
                if (data && confirm(`番組構成「${data.title}」をすぐに開始しますか？`)) {
                    window.App.Studio.quickStartProg(data);
                }
            });
        } catch (e) {
            alert("起動エラー: " + e.message);
            console.error(e);
        }
    },

    copySet: function (key) {
        const showId = window.App.State.currentShowId;
        window.db.ref(`saved_sets/${showId}/${key}`).once('value', snap => {
            const data = snap.val();
            if (!data) return;

            const newData = JSON.parse(JSON.stringify(data));
            newData.title = `【コピー】${newData.title}`;
            newData.createdAt = Date.now();

            const newKey = window.db.ref(`saved_sets/${showId}`).push().key;
            window.db.ref(`saved_sets/${showId}/${newKey}`).set(newData).then(() => {
                window.App.Ui.showToast("セットをコピーしました");
                this.loadItems();
                this.updateFlowProgress();
            });
        });
    },

    copyProg: function (key) {
        const showId = window.App.State.currentShowId;
        window.db.ref(`saved_programs/${showId}/${key}`).once('value', snap => {
            const data = snap.val();
            if (!data) return;

            const newData = JSON.parse(JSON.stringify(data));
            newData.title = `【コピー】${newData.title}`;
            newData.createdAt = Date.now();

            const newKey = window.db.ref(`saved_programs/${showId}`).push().key;
            window.db.ref(`saved_programs/${showId}/${newKey}`).set(newData).then(() => {
                window.App.Ui.showToast("番組構成をコピーしました");
                this.loadItems();
            });
        });
    },

    del: function (path, key) {
        if (!confirm("本当に削除しますか？")) return;
        const showId = window.App.State.currentShowId;
        window.db.ref(`${path}/${showId}/${key}`).remove().then(() => {
            window.App.Ui.showToast("削除しました");
            this.loadItems();
        });
    },

    openEditMenuInSheet: function (key) {
        const data = (this.itemCache && this.itemCache[key]) ? this.itemCache[key] : null;
        if (!data) {
            console.error("Dashboard: itemCache data not found for", key);
            return;
        }

        const modal = document.querySelector('#item-menu-modal .bottom-sheet-content');
        if (!modal) return;

        const titleEl = modal.querySelector('.bottom-sheet-title');
        const bodyEl = modal.querySelector('.bottom-sheet-body');

        if (!titleEl || !bodyEl) return;

        // Feedback toast
        if (window.App.Ui && window.App.Ui.showToast) {
            window.App.Ui.showToast("編集メニューに切り替えます");
        }

        // Update Title with Back Button
        titleEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <button onclick="window.App.Dashboard.openItemMenu('${key}', 'set')" style="background:none; border:none; color:#00e5ff; font-size:1.2em; cursor:pointer; padding:0; display:flex; align-items:center; opacity:0.8; transition:0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'"><i class="fas fa-chevron-left"></i></button>
                <span>編集メニュー</span>
            </div>
        `;
        titleEl.onclick = null;
        titleEl.style.cursor = 'default';

        // Update Body with Edit Options
        bodyEl.innerHTML = `
            <div style="padding: 10px 0;">
                <button class="sheet-btn" onclick="window.App.Dashboard.transitionToCreator('${key}'); document.getElementById('item-menu-modal').remove()">
                    <i class="fas fa-edit" style="color: #64b5f6; font-size: 0.9em;"></i> 問題作成
                </button>
                <button class="sheet-btn" onclick="window.App.Dashboard.transitionToRules('${key}'); document.getElementById('item-menu-modal').remove()">
                    <i class="fas fa-cog" style="color: #ffd54f; font-size: 0.9em;"></i> ルール設定
                </button>
                <button class="sheet-btn" onclick="window.App.Dashboard.transitionToDesign('${key}'); document.getElementById('item-menu-modal').remove()">
                    <i class="fas fa-paint-brush" style="color: #81c784; font-size: 0.9em;"></i> 問題デザイン
                </button>
            </div>
        `;
    },

    transitionToCreator: function (key) {
        const data = this.itemCache ? this.itemCache[key] : null;
        if (window.App.Creator && window.App.Creator.loadSet) {
            window.App.Creator.loadSet(key, data);
        }
    },

    transitionToRules: function (key) {
        if (window.App.Config && window.App.Config.init) {
            window.App.Config.init();
            setTimeout(() => {
                const sel = document.getElementById('config-set-select');
                if (sel) {
                    sel.value = key;
                    sel.dispatchEvent(new Event('change'));
                }
            }, 500);
        }
    },

    transitionToDesign: function (key) {
        const data = this.itemCache ? this.itemCache[key] : null;
        if (window.App.Design && window.App.Design.init) {
            window.App.Design.init(key, data);
        }
    },

    openEditMenu: function (key) {
        this.openEditMenuInSheet(key);
    },

    _showEditModal: function () {
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
