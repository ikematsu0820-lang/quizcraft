/* =========================================================
 * host_prog_config.js (V3: Ultra-Robust Rendering)
 * =======================================================*/

window.App = window.App || {};
window.App.ProgConfig = {
    localItemsCache: {},

    init: function () {
        console.log("ProgConfig: Init starting...");
        window.App.Ui.showView(window.App.Ui.views.progConfig);

        // Ensure playlist array exists
        if (!window.App.Data.periodPlaylist) {
            window.App.Data.periodPlaylist = [];
        }

        this.loadAppliedSetList();
        this.renderPlaylist();
        this.setupEventListeners();
    },

    loadAppliedSetList: function () {
        const select = document.getElementById('prog-set-select');
        if (!select) return;
        select.innerHTML = '<option value="">読み込み中...</option>';

        const showId = window.App.State.currentShowId;
        window.db.ref(`saved_sets/${showId}`).once('value', snap => {
            select.innerHTML = '<option value="">-- 追加するセットを選択 --</option>';
            const data = snap.val();
            this.localItemsCache = {};

            if (data) {
                Object.keys(data).forEach(k => {
                    const item = { ...data[k], key: k };
                    this.localItemsCache[k] = item;
                    const opt = document.createElement('option');
                    opt.value = k;
                    opt.textContent = `${item.title} (${item.questions?.length || 0}Q)`;
                    select.appendChild(opt);
                });
            }
            this.renderPlaylist();
        });
    },

    setupEventListeners: function () {
        // Reset and bind to avoid duplicates
        const map = {
            'prog-add-set-btn': () => this.addSetToPlaylist(),
            'prog-save-program-btn': () => this.saveProgram(),
            'prog-go-studio-btn': () => this.goToStudio(),
            'prog-open-load-modal-btn': () => this.openLoadModal(),
            'prog-load-exec-btn': () => this.loadSelectedProgram(),
            'prog-load-close-btn': () => document.getElementById('prog-load-modal').classList.add('hidden')
        };

        Object.keys(map).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onclick = map[id];
        });
    },

    addSetToPlaylist: function () {
        const select = document.getElementById('prog-set-select');
        const key = select.value;
        if (!key || !this.localItemsCache[key]) return;

        const setItem = this.localItemsCache[key];
        const newEntry = {
            sourceKey: key,
            snapshotAt: Date.now(),
            title: setItem.title || "Untitled Stage",
            questions: JSON.parse(JSON.stringify(setItem.questions || [])),
            config: JSON.parse(JSON.stringify(setItem.config || { mode: 'normal', gameType: 'score' })),
            progSettings: {
                showRankingAfter: false,
                eliminationMode: 'none',
                eliminationCount: 0
            }
        };

        window.App.Data.periodPlaylist.push(newEntry);
        window.App.Ui.showToast(`「${newEntry.title}」を読み込みました (Snapshot)`);
        this.renderPlaylist();
    },

    renderPlaylist: function () {
        const preview = document.getElementById('prog-playlist-preview');
        if (!preview) return;

        const playlist = window.App.Data.periodPlaylist || [];
        console.log("ProgConfig: Rendering playlist, count:", playlist.length);

        if (playlist.length === 0) {
            preview.innerHTML = `
                <div style="text-align:center; padding:80px 20px; color:#666;">
                    <div style="font-size:40px; margin-bottom:15px; opacity:0.3;">📋</div>
                    <p>構成リストが空です。<br>セットを選択して「追加」してください。</p>
                </div>`;
            return;
        }

        let html = '';
        playlist.forEach((item, i) => {
            const qCount = item.questions?.length || 0;
            const mode = item.config?.mode || 'normal';
            const settings = item.progSettings || { showRankingAfter: false, eliminationMode: 'none', eliminationCount: 0 };

            let updateBadge = "";
            if (item.sourceKey && this.localItemsCache[item.sourceKey]) {
                const latest = this.localItemsCache[item.sourceKey];

                // ★ 判定強化: 問題数だけでなく、ルール(config)の変更も検知する
                const hasCountDiff = latest.questions?.length !== item.questions?.length;
                const latestConfStr = JSON.stringify(latest.config || {});
                const itemConfStr = JSON.stringify(item.config || {});
                const hasConfigDiff = latestConfStr !== itemConfStr;

                if (hasCountDiff || hasConfigDiff) {
                    updateBadge = `<button class="btn-mini btn-warning anim-pulse" onclick="window.App.ProgConfig.syncWithSource(${i})" style="margin-left:10px; font-size:0.65em; padding:3px 8px; border:1px solid #ffaa00; background:rgba(255,170,0,0.1); border-radius:12px; cursor:pointer;">⚠️ Update Info</button>`;
                }
            }

            let modeLabel = mode;
            if (window.App.Studio && window.App.Studio.translateMode) {
                modeLabel = window.App.Studio.translateMode(mode);
            }

            const dateStr = (typeof item.createdAt === 'number')
                ? new Date(item.createdAt).toLocaleDateString()
                : "";

            html += `
                <div class="timeline-card prog-card-compact">
                    <div class="prog-card-row">
                        <div class="prog-card-info">
                            <div class="prog-card-title"><span class="badge-set" style="font-size:0.7em; padding:1px 6px; margin-right:5px;">SET</span>${item.title || 'Untitled'} ${updateBadge}</div>
                            <div class="prog-card-meta">${dateStr}${dateStr ? ' / ' : ''}${qCount}Q / ${modeLabel}</div>
                        </div>
                        <div class="prog-card-settings">
                            <div class="prog-setting-row">
                                <label style="font-size:0.7em; color:#666;">脱落・通過設定</label>
                                <select onchange="window.App.ProgConfig.updateToggle(${i}, 'eliminationMode', this.value)" style="width:100%; padding:3px 4px; background:#1a1a1a; border:1px solid #333; color:#fff; font-size:0.75em; border-radius:4px;">
                                    <option value="none" ${settings.eliminationMode === 'none' ? 'selected' : ''}>なし (全員生存)</option>
                                    <option value="dropout" ${settings.eliminationMode === 'dropout' ? 'selected' : ''}>下位脱落</option>
                                    <option value="survive" ${settings.eliminationMode === 'survive' ? 'selected' : ''}>上位通過</option>
                                </select>
                            </div>
                            <div class="prog-setting-row" style="flex-direction:row; justify-content:space-between; align-items:center;">
                                <label style="font-size:0.7em; color:rgba(255,255,255,0.6);">🏁 終了後に順位発表</label>
                                <input type="checkbox" onchange="window.App.ProgConfig.updateToggle(${i}, 'showRankingAfter', this.checked)" ${settings.showRankingAfter ? 'checked' : ''} style="width:14px; height:14px;">
                            </div>
                            <div style="display:flex; gap:4px; justify-content:flex-end; margin-top:2px;">
                                <button class="btn-mini btn-info" onclick="window.App.ProgConfig.move(${i}, -1)" style="padding:2px 7px; font-size:0.65em;">▲</button>
                                <button class="btn-mini btn-info" onclick="window.App.ProgConfig.move(${i}, 1)" style="padding:2px 7px; font-size:0.65em;">▼</button>
                                <button class="btn-mini btn-danger" onclick="window.App.ProgConfig.remove(${i})" style="padding:2px 7px; font-size:0.65em;">✕</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        preview.innerHTML = html;
    },

    updateToggle: function (idx, key, val) {
        if (!window.App.Data.periodPlaylist[idx]) return;
        window.App.Data.periodPlaylist[idx].progSettings[key] = val;
        this.renderPlaylist();
    },

    remove: function (i) {
        window.App.Data.periodPlaylist.splice(i, 1);
        this.renderPlaylist();
    },

    move: function (i, dir) {
        const arr = window.App.Data.periodPlaylist;
        const target = i + dir;
        if (target < 0 || target >= arr.length) return;
        [arr[i], arr[target]] = [arr[target], arr[i]];
        this.renderPlaylist();
    },

    syncWithSource: function (i) {
        const item = window.App.Data.periodPlaylist[i];
        if (!item.sourceKey || !this.localItemsCache[item.sourceKey]) return;

        const latest = this.localItemsCache[item.sourceKey];
        if (confirm(`「${latest.title}」の最新設定（ルールや問題数）をこのプログラムに適用しますか？\n(このステージ内の脱落設定などは維持されます)`)) {
            item.title = latest.title;
            item.questions = JSON.parse(JSON.stringify(latest.questions || []));
            item.config = JSON.parse(JSON.stringify(latest.config || { mode: 'normal', gameType: 'score' }));
            item.snapshotAt = Date.now();
            window.App.Ui.showToast("設定を同期しました");
            this.renderPlaylist();
        }
    },

    goToStudio: function () {
        this.saveProgram(true).finally(() => {
            if (window.startRoom) window.startRoom(true);
        });
    },

    saveProgram: function (silent = false) {
        if (!window.App.Data.periodPlaylist?.length) { if (!silent) alert("リストが空です"); return Promise.reject(); }

        let title = "";
        if (!silent) {
            title = window.prompt("番組の名称（タイトル）を入力してください", "新しい番組");
            if (title === null) return Promise.reject(); // Cancel
            title = title.trim();
            if (!title) { alert("番組名を入力してください"); return Promise.reject(); }
        }

        const data = {
            title: title || "Untitled Program",
            playlist: window.App.Data.periodPlaylist,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        const showId = window.App.State.currentShowId;
        return window.db.ref(`saved_programs/${showId}`).push(data).then(() => {
            if (!silent) window.App.Ui.showToast("番組を保存しました");
            // ダッシュボードに戻る
            if (window.App.Dashboard && window.App.Dashboard.enter) {
                window.App.Dashboard.enter();
            }
        });
    },

    openLoadModal: function () {
        const modal = document.getElementById('prog-load-modal');
        const select = document.getElementById('prog-load-select');
        if (!modal || !select) return;
        modal.classList.remove('hidden');
        select.innerHTML = '<option value="">読み込み中...</option>';
        window.db.ref(`saved_programs/${window.App.State.currentShowId}`).once('value', snap => {
            select.innerHTML = '<option value="">-- プログラムを選択 --</option>';
            const data = snap.val();
            if (data) {
                Object.keys(data).forEach(k => {
                    const opt = document.createElement('option');
                    opt.value = k;
                    opt.dataset.json = JSON.stringify(data[k]);
                    opt.textContent = data[k].title;
                    select.appendChild(opt);
                });
            }
        });
    },

    loadSelectedProgram: function () {
        const select = document.getElementById('prog-load-select');
        const opt = select.options[select.selectedIndex];
        if (!opt || !opt.dataset.json) return;
        try {
            const data = JSON.parse(opt.dataset.json);
            this.loadProgramData(data);
            document.getElementById('prog-load-modal').classList.add('hidden');
        } catch (err) { console.error(err); }
    },

    loadProgramForDashboard: function (data) {
        this.init();
        this.loadProgramData(data);
    },

    loadProgramData: function (data) {
        window.App.Data.periodPlaylist = data.playlist || [];
        const titleInput = document.getElementById('prog-program-title');
        if (titleInput) titleInput.value = data.title || "";
        this.renderPlaylist();
    }
};
