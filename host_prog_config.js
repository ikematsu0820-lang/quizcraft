/* =========================================================
 * host_prog_config.js (V3: Ultra-Robust Rendering)
 * =======================================================*/

window.App = window.App || {};
window.App.ProgConfig = {
    localItemsCache: {},

    init: function () {
        console.log("ProgConfig: Init starting...");
        window.App.Ui.showView(window.App.Ui.views.progConfig);

        // Hide fixed add button permanently
        const fixedBtn = document.getElementById('prog-add-set-btn');
        if (fixedBtn) fixedBtn.style.display = 'none';

        // Hide the set select dropdown as per request (replaced by modal)
        const setSelect = document.getElementById('prog-set-select');
        if (setSelect) setSelect.parentElement.style.display = 'none'; // Hide parent to catch the box styling

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
        // Even if hidden, we populate cache
        const showId = window.App.State.currentShowId;
        window.db.ref(`saved_sets/${showId}`).once('value', snap => {
            if (select) select.innerHTML = '<option value="">-- 追加するセットを選択 --</option>';
            const data = snap.val();
            this.localItemsCache = {};

            if (data) {
                Object.keys(data).forEach(k => {
                    const item = { ...data[k], key: k };
                    this.localItemsCache[k] = item;
                    if (select) {
                        const opt = document.createElement('option');
                        opt.value = k;
                        opt.textContent = `${item.title} (${item.questions?.length || 0}Q)`;
                        select.appendChild(opt);
                    }
                });
            }
            this.renderPlaylist();
        });
    },

    setupEventListeners: function () {
        // Reset and bind to avoid duplicates
        const map = {
            'prog-add-set-btn': () => this.openAddMenu(), // Reverted to menu
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

        // Drag and Drop delegation
        const list = document.getElementById('prog-playlist-preview');
        if (list) {
            list.addEventListener('dragstart', this.handleDragStart.bind(this));
            list.addEventListener('dragover', this.handleDragOver.bind(this));
            list.addEventListener('drop', this.handleDrop.bind(this));
            list.addEventListener('dragenter', this.handleDragEnter.bind(this));
            list.addEventListener('dragleave', this.handleDragLeave.bind(this));
        }
    },

    // --- Drag and Drop Handlers ---
    handleDragStart: function (e) {
        const card = e.target.closest('.timeline-card');
        if (!card || typeof card.dataset.index === 'undefined') return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.index);
        card.classList.add('dragging');
    },

    handleDragOver: function (e) {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    },

    handleDragEnter: function (e) {
        const card = e.target.closest('.timeline-card');
        if (card) card.classList.add('drag-over');
    },

    handleDragLeave: function (e) {
        const card = e.target.closest('.timeline-card');
        if (card) card.classList.remove('drag-over');
    },

    handleDrop: function (e) {
        if (e.stopPropagation) e.stopPropagation();

        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const targetCard = e.target.closest('.timeline-card');

        if (targetCard && typeof targetCard.dataset.index !== 'undefined') {
            const targetIndex = parseInt(targetCard.dataset.index);
            if (sourceIndex !== targetIndex) {
                this.move(sourceIndex, targetIndex - sourceIndex); // move uses relative offset? No, move uses direction.
                // Wait, move(index, direction) swaps with adjacent. We need generic move.
                this.reorderPlaylist(sourceIndex, targetIndex);
            }
            targetCard.classList.remove('drag-over');
        }
        return false;
    },

    reorderPlaylist: function (fromIndex, toIndex) {
        const list = window.App.Data.periodPlaylist;
        if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;

        const item = list.splice(fromIndex, 1)[0];
        list.splice(toIndex, 0, item);
        this.renderPlaylist();
    },

    // --- Container / Playlist Logic ---

    openAddMenu: function () {
        // Bottom sheet for choosing Single or Container
        if (document.getElementById('prog-add-menu-modal')) {
            document.getElementById('prog-add-menu-modal').remove();
        }

        const modalHtml = `
            <div id="prog-add-menu-modal" style="position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999; display:flex; flex-direction:column; justify-content:flex-end;">
                <div class="modal-bg" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6);" onclick="document.getElementById('prog-add-menu-modal').remove()"></div>
                <div class="modal-content" style="position:relative; background:#1a1a1a; padding:20px; border-radius:16px 16px 0 0; box-shadow:0 -5px 20px rgba(0,0,0,0.5); animation:slideUp 0.3s ease-out;">
                    <h3 style="margin:0 0 15px 0; font-size:1.1em; color:#fff; text-align:center;">構成要素を追加</h3>
                    
                    <button class="btn-block btn-primary" onclick="window.App.ProgConfig.openSetSelector(); document.getElementById('prog-add-menu-modal').remove()" style="margin-bottom:10px; padding:15px; font-weight:bold; font-size:1.1em; text-align:left;">
                        <span style="font-size:1.4em; margin-right:10px;">📋</span> シングル（セットを選択）
                        <div style="font-size:0.7em; opacity:0.7; font-weight:normal; margin-left:36px;">保存済みセット一覧から選んで追加します</div>
                    </button>

                    <button class="btn-block btn-info" onclick="window.App.ProgConfig.addContainer(); document.getElementById('prog-add-menu-modal').remove()" style="margin-bottom:20px; padding:15px; font-weight:bold; font-size:1.1em; text-align:left;">
                        <span style="font-size:1.4em; margin-right:10px;">📦</span> マルチ（コンテナ）
                        <div style="font-size:0.7em; opacity:0.7; font-weight:normal; margin-left:36px;">複数のセットをまとめる枠を追加します</div>
                    </button>

                    <button onclick="document.getElementById('prog-add-menu-modal').remove()" class="btn-dark btn-block" style="padding:12px;">キャンセル</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    addContainer: function () {
        const newContainer = {
            type: 'container',
            title: '選択コンテナ (Selection Period)',
            items: [],
            progSettings: { showRankingAfter: false, eliminationMode: 'none', eliminationCount: 0 }
        };
        window.App.Data.periodPlaylist.push(newContainer);
        this.renderPlaylist();
        window.App.Ui.showToast("コンテナを追加しました");
    },

    addSetToPlaylist: function (containerIndex = null) {
        // Reuse the existing select for simplicity
        const select = document.getElementById('prog-set-select');
        const key = select.value;
        if (!key) {
            alert("セットを選択してください");
            return;
        }

        this.addSetToPlaylistByKey(key, containerIndex);
    },

    addSetToPlaylistByKey: function (key, containerIndex = null) {
        if (!this.localItemsCache[key]) return;

        const setItem = this.localItemsCache[key];
        const newEntry = {
            type: 'single', // Explicit type
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

        if (containerIndex !== null) {
            // Add to container
            if (window.App.Data.periodPlaylist[containerIndex] && window.App.Data.periodPlaylist[containerIndex].type === 'container') {
                window.App.Data.periodPlaylist[containerIndex].items.push(newEntry);
                window.App.Ui.showToast(`コンテナに「${newEntry.title}」を追加しました`);
            }
        } else {
            // Add to root
            window.App.Data.periodPlaylist.push(newEntry);
            window.App.Ui.showToast(`「${newEntry.title}」を追加しました`);
        }

        this.renderPlaylist();
    },

    openSetSelector: function (containerIndex = null) {
        if (document.getElementById('prog-set-selector-modal')) document.getElementById('prog-set-selector-modal').remove();

        const sets = Object.values(this.localItemsCache || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const cIdxArg = (containerIndex === null) ? 'null' : containerIndex;

        let listHtml = '';
        sets.forEach(set => {
            const dateStr = set.createdAt ? new Date(set.createdAt).toLocaleDateString() : '';
            const mode = set.config ? set.config.mode : 'normal';
            listHtml += `
                <div onclick="window.App.ProgConfig.addSetToPlaylistByKey('${set.key}', ${cIdxArg}); document.getElementById('prog-set-selector-modal').remove()" style="padding:15px; border-bottom:1px solid #333; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; color:#fff; font-size:1em; margin-bottom:4px;">${set.title}</div>
                        <div style="font-size:0.8em; color:#aaa;">${dateStr} / ${set.questions ? set.questions.length : 0}問 (${mode})</div>
                    </div>
                    <div style="color:#00e5ff; font-weight:bold; border:1px solid #00e5ff; padding:5px 12px; border-radius:20px; font-size:0.8em;">追加</div>
                </div>
            `;
        });

        const modalHtml = `
            <div id="prog-set-selector-modal" style="position:fixed; top:0; left:0; right:0; bottom:0; z-index:10005; display:flex; flex-direction:column; justify-content:flex-end;">
                 <div class="modal-bg" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8);" onclick="document.getElementById('prog-set-selector-modal').remove()"></div>
                 <div class="modal-content" style="position:relative; background:#1a1a1a; padding:20px 20px 40px 20px; border-radius:16px 16px 0 0; box-shadow:0 -5px 20px rgba(0,0,0,0.5); height:70%; display:flex; flex-direction:column; animation:slideUp 0.3s ease-out;">
                    <div style="flex-shrink:0; display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
                        <h3 style="margin:0; color:#fff; font-size:1.2em;">セットを選択</h3>
                        <button onclick="document.getElementById('prog-set-selector-modal').remove()" style="background:none; border:none; color:#aaa; font-size:2em; line-height:1;">×</button>
                    </div>
                    <div style="overflow-y:auto; flex:1;">
                        ${listHtml}
                    </div>
                 </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    renderPlaylist: function () {
        const preview = document.getElementById('prog-playlist-preview');
        if (!preview) return;

        const playlist = window.App.Data.periodPlaylist || [];
        console.log("ProgConfig: Rendering playlist, count:", playlist.length);

        if (playlist.length === 0) {
            preview.innerHTML = `
                <div style="text-align:center; padding:80px 20px; color:#666; cursor:pointer;" onclick="window.App.ProgConfig.openAddMenu()">
                    <div style="font-size:40px; margin-bottom:15px; opacity:0.3;">📋</div>
                    <p>リストが空です。<br>タップして追加してください。</p>
                </div>`;
            return;
        }

        let html = '';
        // Removed top button


        playlist.forEach((item, i) => {
            if (item.type === 'container') {
                // Render Container
                const childCount = item.items ? item.items.length : 0;

                let childrenHtml = '';
                if (item.items) {
                    item.items.forEach((child, ci) => {
                        const childMode = child.config?.mode || 'normal';
                        const childQ = child.questions?.length || 0;
                        childrenHtml += `
                            <div class="timeline-card prog-card-compact" style="margin-left:20px; border-left:4px solid #444; margin-bottom:5px; cursor:default;" onclick="event.stopPropagation()">
                                <div class="prog-card-row">
                                    <div class="prog-card-info" style="background:#222;" onclick="event.stopPropagation(); window.App.ProgConfig.openSettings(${i}, ${ci})">
                                        <div class="prog-card-title" style="font-size:0.9em;">${child.title}</div>
                                        <div class="prog-card-meta" style="font-size:0.7em;">${childQ}Q / ${childMode}</div>
                                    </div>
                                    <div class="prog-card-settings" style="width:40px;">
                                        <button class="btn-mini btn-info" onclick="event.stopPropagation(); window.App.ProgConfig.moveInContainer(${i}, ${ci}, -1)" style="padding:2px 5px; width:100%;">▲</button>
                                        <button class="btn-mini btn-info" onclick="event.stopPropagation(); window.App.ProgConfig.moveInContainer(${i}, ${ci}, 1)" style="padding:2px 5px; width:100%;">▼</button>
                                        <button class="btn-mini btn-danger" onclick="event.stopPropagation(); window.App.ProgConfig.removeInContainer(${i}, ${ci})" style="padding:2px 5px; width:100%;">✕</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }

                html += `
                <div class="timeline-card prog-card-compact" draggable="true" data-index="${i}" style="border:1px solid #444; background:#111; padding:10px; cursor:pointer;" onclick="window.App.ProgConfig.openSetSelector(${i})">
                    <div class="flex-between mb-5">
                        <div style="display:flex; align-items:center;">
                            <div class="drag-handle" style="cursor:grab; margin-right:8px; color:#555; font-size:1.2em;">☰</div>
                            <div style="font-weight:bold; color:#aaa;">📦 選択コンテナ (タップしてセット追加)</div>
                        </div>
                        <div class="prog-card-settings" style="display:flex; gap:5px;" onclick="event.stopPropagation()">
                             <button class="btn-mini btn-info" onclick="window.App.ProgConfig.move(${i}, -1)">▲</button>
                             <button class="btn-mini btn-info" onclick="window.App.ProgConfig.move(${i}, 1)">▼</button>
                             <button class="btn-mini btn-danger" onclick="window.App.ProgConfig.remove(${i})">✕</button>
                        </div>
                    </div>
                     
                    <div style="margin-bottom:10px;">
                       ${childrenHtml}
                    </div>
                </div>
                `;

            } else {
                // Render Single Set (Existing Logic)
                const qCount = item.questions?.length || 0;
                const mode = item.config?.mode || 'normal';

                let updateBadge = "";
                if (item.sourceKey && this.localItemsCache[item.sourceKey]) {
                    const latest = this.localItemsCache[item.sourceKey];
                    const hasCountDiff = latest.questions?.length !== item.questions?.length;
                    const latestConfStr = JSON.stringify(latest.config || {});
                    const itemConfStr = JSON.stringify(item.config || {});
                    const hasConfigDiff = latestConfStr !== itemConfStr;

                    if (hasCountDiff || hasConfigDiff) {
                        updateBadge = `<button class="btn-mini btn-warning anim-pulse" onclick="event.stopPropagation(); window.App.ProgConfig.syncWithSource(${i})" style="margin-left:10px; font-size:0.65em; padding:3px 8px; border:1px solid #ffaa00; background:rgba(255,170,0,0.1); border-radius:12px; cursor:pointer;">⚠️ Update Info</button>`;
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
                    <div class="timeline-card prog-card-compact" draggable="true" data-index="${i}">
                        <div class="prog-card-row">
                            <div class="drag-handle" style="display:flex; align-items:center; padding-right:10px; color:#555; cursor:grab; font-size:1.2em;">☰</div>
                            <div class="prog-card-info" onclick="window.App.ProgConfig.openSettings(${i})">
                                <div class="prog-card-title"><span class="badge-set" style="font-size:0.7em; padding:1px 6px; margin-right:5px;">SET</span>${item.title || 'Untitled'} ${updateBadge}</div>
                                <div class="prog-card-meta">${dateStr}${dateStr ? ' / ' : ''}${qCount}Q / ${modeLabel}</div>
                                 <div style="font-size:0.75em; color:#888; margin-top:4px;">
                                    <i class="fas fa-cog"></i> 設定を変更するにはタップ
                                </div>
                            </div>
                            <div class="prog-card-settings" style="display:flex; flex-direction:column; justify-content:center; align-items:center; width:60px; padding:0 5px;">
                                <button class="btn-mini btn-info" onclick="window.App.ProgConfig.move(${i}, -1)" style="padding:4px 8px; margin-bottom:4px; width:100%;">▲</button>
                                <button class="btn-mini btn-info" onclick="window.App.ProgConfig.move(${i}, 1)" style="padding:4px 8px; margin-bottom:4px; width:100%;">▼</button>
                                <button class="btn-mini btn-danger" onclick="window.App.ProgConfig.remove(${i})" style="padding:4px 8px; width:100%;">✕</button>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        preview.innerHTML = html;

        // Ensure background is tappable for adding
        preview.style.minHeight = "60vh";
        preview.onclick = (e) => {
            if (e.target === preview) {
                window.App.ProgConfig.openAddMenu();
            }
        };
    },

    openSettings: function (index, childIndex = null) {
        let item = window.App.Data.periodPlaylist[index];

        let title = item.title;
        let settings = item.progSettings;

        // If settings specifically for a child inside a container
        if (childIndex !== null && item.type === 'container' && item.items[childIndex]) {
            item = item.items[childIndex];
            title = item.title;
            settings = item.progSettings;
        }

        if (!settings) settings = { showRankingAfter: false, eliminationMode: 'none', eliminationCount: 0 };

        // Helper to update
        const updateFnStr = (childIndex !== null)
            ? `window.App.ProgConfig.updateToggleInContainer(${index}, ${childIndex}, `
            : `window.App.ProgConfig.updateToggle(${index}, `;


        // Remove existing modal if any
        if (document.getElementById('prog-settings-modal')) {
            document.getElementById('prog-settings-modal').remove();
        }

        const modalHtml = `
            <div id="prog-settings-modal" style="position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <div class="modal-bg" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6);" onclick="document.getElementById('prog-settings-modal').remove()"></div>
                <div class="modal-content" style="position:relative; width:90%; max-width:500px; background:#1a1a1a; padding:20px; border-radius:16px; box-shadow:0 5px 25px rgba(0,0,0,0.5); animation:popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
                        <h3 style="margin:0; font-size:1.1em; color:#fff;">${title || 'Untitled'}</h3>
                        <button onclick="document.getElementById('prog-settings-modal').remove()" style="background:none; border:none; color:#aaa; font-size:1.5em; cursor:pointer;">×</button>
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-size:0.85em; color:#aaa; margin-bottom:8px;">脱落・通過設定</label>
                        <select onchange="${updateFnStr} 'eliminationMode', this.value)" style="width:100%; padding:10px; background:#000; border:1px solid #444; color:#fff; border-radius:6px; font-size:1em;">
                            <option value="none" ${settings.eliminationMode === 'none' ? 'selected' : ''}>なし (全員生存)</option>
                            <option value="dropout" ${settings.eliminationMode === 'dropout' ? 'selected' : ''}>下位脱落 (指定順位以下)</option>
                            <option value="survive" ${settings.eliminationMode === 'survive' ? 'selected' : ''}>上位通過 (指定順位以上)</option>
                        </select>
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:10px; background:#000; border-radius:6px; border:1px solid #444;">
                            <input type="checkbox" onchange="${updateFnStr} 'showRankingAfter', this.checked)" ${settings.showRankingAfter ? 'checked' : ''} style="width:18px; height:18px;">
                            <span style="color:#fff; font-size:0.95em;">終了後に順位発表を行う</span>
                        </label>
                    </div>

                    <button onclick="document.getElementById('prog-settings-modal').remove()" class="btn-primary btn-block" style="padding:12px; font-weight:bold;">完了</button>
                </div>
            </div>
                        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    updateToggleInContainer: function (parentIdx, childIdx, key, val) {
        if (!window.App.Data.periodPlaylist[parentIdx]) return;
        const parent = window.App.Data.periodPlaylist[parentIdx];
        if (parent.type === 'container' && parent.items[childIdx]) {
            if (!parent.items[childIdx].progSettings) parent.items[childIdx].progSettings = {};
            parent.items[childIdx].progSettings[key] = val;
            // No full render needed for settings, maybe? But safer to render.
            // this.renderPlaylist(); 
        }
    },

    // --- Top Level Move Helpers ---
    move: function (index, dir) {
        const arr = window.App.Data.periodPlaylist;
        const target = index + dir;
        if (target < 0 || target >= arr.length) return;
        [arr[index], arr[target]] = [arr[target], arr[index]];
        this.renderPlaylist();
    },

    remove: function (index) {
        if (!confirm("この項目を削除しますか？")) return;
        window.App.Data.periodPlaylist.splice(index, 1);
        this.renderPlaylist();
    },

    // --- Container Move Helpers ---
    moveInContainer: function (parentIdx, childIdx, dir) {
        const parent = window.App.Data.periodPlaylist[parentIdx];
        if (!parent || parent.type !== 'container') return;
        const arr = parent.items;
        const target = childIdx + dir;
        if (target < 0 || target >= arr.length) return;
        [arr[childIdx], arr[target]] = [arr[target], arr[childIdx]];
        this.renderPlaylist();
    },

    removeInContainer: function (parentIdx, childIdx) {
        const parent = window.App.Data.periodPlaylist[parentIdx];
        if (!parent || parent.type !== 'container') return;
        parent.items.splice(childIdx, 1);
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
        return window.db.ref(`saved_programs / ${showId}`).push(data).then(() => {
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
        window.db.ref(`saved_programs / ${window.App.State.currentShowId}`).once('value', snap => {
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
