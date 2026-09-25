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

// 背景画像・サウンドの重複排除 — デザインはセット共通なのに
// Creator.save() が全問題に同じ design をコピーするため、画像や音声
// （data: URI）が問題数分複製されて巨大になっていた。画像（1枚100KB超）
// で「クイズ王は俺だ」75問が約9MBになり開始・配信が止まり、シンキング
// BGM（約7MB）を選ぶと数百MBになって保存自体が失敗していた。
// 保存時/ルーム送信時はこれらを images 配列に1回だけ持ち、各問題には
// '@img:N' の参照だけを残す。読む側は unpack() で元に戻す。
// （フィールド名は画像だけだった頃のまま images — 保存済みデータ互換）
window.App.SetImages = {
    PREFIX: '@img:',
    KEYS: ['bgImage', 'bgmThinking', 'seQNum', 'seButton', 'seCorrect', 'seWrong'],

    pack: function (questions) {
        const images = [];
        const indexOf = {};
        const list = Array.isArray(questions) ? questions : Object.values(questions || {});
        const packed = list.map(q => {
            if (!q || !q.design) return q;
            let design = null;
            this.KEYS.forEach(k => {
                const v = q.design[k];
                if (typeof v !== 'string' || !v.startsWith('data:')) return;
                if (indexOf[v] === undefined) {
                    indexOf[v] = images.length;
                    images.push(v);
                }
                design = design || { ...q.design };
                design[k] = this.PREFIX + indexOf[v];
            });
            return design ? { ...q, design } : q;
        });
        return { questions: packed, images: images };
    },

    // '@img:N' なら N を返す（参照でなければ -1）
    refIndex: function (v) {
        if (typeof v !== 'string' || !v.startsWith(this.PREFIX)) return -1;
        return parseInt(v.slice(this.PREFIX.length), 10);
    },

    unpack: function (questions, images) {
        const list = Array.isArray(questions) ? questions : Object.values(questions || {});
        if (!images) return list;
        const imgs = Array.isArray(images) ? images : Object.values(images);
        return list.map(q => {
            if (!q || !q.design) return q;
            let design = null;
            this.KEYS.forEach(k => {
                const idx = this.refIndex(q.design[k]);
                if (idx < 0) return;
                design = design || { ...q.design };
                design[k] = imgs[idx] || '';
            });
            return design ? { ...q, design } : q;
        });
    }
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
            dashboard: document.getElementById('host-main-menu-view') || document.getElementById('host-dashboard-view'),
            creator: document.getElementById('creator-view'),
            selectType: document.getElementById('select-type-view'),
            progConfig: document.getElementById('prog-config-view'),
            hostControl: document.getElementById('host-control-view'),
            ranking: document.getElementById('ranking-view'),
            respondent: document.getElementById('respondent-view'),
            playerGame: document.getElementById('player-game-view'),
            viewerLogin: document.getElementById('viewer-login-view'),
            viewerMain: document.getElementById('viewer-main-view'),
            savedItems: document.getElementById('saved-items-view'),
            soundLibrary: document.getElementById('sound-library-view')
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
    const testHost = urlParams.get('testHost');
    const testProg = urlParams.get('testProg');

    if (vcode) {
        this.Ui.showView(this.Ui.views.viewerMain);
        if (window.App.Viewer && window.App.Viewer.connect) {
            window.App.Viewer.connect(vcode);
        }
        return;
    }

    if (testHost) {
        const tp = parseInt(urlParams.get('tp') || '2');
        this.Ui.showView(this.Ui.views.hostControl);
        window.App.State.reuseRoomId = testHost;
        // Ensure currentShowId is set for cross-browser compatibility (sessionStorage not always inherited in new tabs)
        if (!window.App.State.currentShowId) {
            window.App.State.currentShowId = urlParams.get('sid') || 'TEST';
        }
        this._showTestNavBar(testHost, tp);
        const ref = window.db.ref(`saved_sets/${testHost}`);
        const handler = ref.on('value', snap => {
            if (snap.exists()) {
                ref.off('value', handler);
                if (window.App.Studio && window.App.Studio.quickStart) {
                    window.App.Studio.quickStart(snap.val());
                }
            }
        });
        return;
    }

    if (testProg) {
        const tp = parseInt(urlParams.get('tp') || '2');
        this.Ui.showView(this.Ui.views.hostControl);
        window.App.State.reuseRoomId = testProg;
        // Ensure currentShowId is set for cross-browser compatibility
        if (!window.App.State.currentShowId) {
            window.App.State.currentShowId = urlParams.get('sid') || 'TEST';
        }
        this._showTestNavBar(testProg, tp);
        const ref = window.db.ref(`saved_programs/${testProg}`);
        const handler = ref.on('value', snap => {
            if (snap.exists()) {
                ref.off('value', handler);
                if (window.App.Studio && window.App.Studio.quickStartProg) {
                    window.App.Studio.quickStartProg(snap.val());
                }
            }
        });
        return;
    }

    // ★ IDがあれば即メインメニューへ
    if (window.App.State.currentShowId) {
        console.log("Session restored:", window.App.State.currentShowId);
        window.App.Dashboard.enter();
    } else {
        this.Ui.showView(this.Ui.views.hostLogin);
    }
};

window.App.bindEvents = function () {
    const U = this.Ui;
    const V = this.Ui.views;

    // ログイン処理
    const handleHostLogin = () => {
        const input = document.getElementById('show-id-input').value.trim().toUpperCase();
        if (!input) { alert("番組IDを入力してください"); return; }

        window.App.State.currentShowId = input;
        sessionStorage.setItem('qs_show_id', input);
        window.App.Dashboard.enter();
    };

    document.getElementById('host-login-submit-btn')?.addEventListener('click', handleHostLogin);
    document.getElementById('show-id-input')?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleHostLogin();
    });

    // クイズに参加する処理 (Top Login View)
    const handleJoinQuiz = () => {
        const roomIdInput = document.getElementById('room-id-input');
        const code = roomIdInput ? roomIdInput.value.trim().toUpperCase() : '';
        if (!code) {
            alert("ルームIDを入力してください");
            return;
        }

        const roomCodeInput = document.getElementById('room-code-input');
        if (roomCodeInput) {
            roomCodeInput.value = code;
        }

        U.showView(V.respondent);

        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            if (nameInput.value.trim()) {
                document.getElementById('join-room-btn')?.focus();
            } else {
                nameInput.focus();
            }
        }
    };

    document.getElementById('join-quiz-btn')?.addEventListener('click', handleJoinQuiz);
    document.getElementById('room-id-input')?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleJoinQuiz();
    });

    // メインメニューの「問題を作る」 -> 問題形式選択画面へ
    document.getElementById('menu-btn-create')?.addEventListener('click', () => {
        const idEl = document.getElementById('select-type-show-id');
        if (idEl) idEl.textContent = window.App.State.currentShowId || '---';
        U.showView(V.selectType || V.creator);
    });

    // 問題形式選択画面 → 過去に作成した問題（保存済みセット）を編集
    document.getElementById('select-type-edit-past-btn')?.addEventListener('click', () => {
        window.App.Dashboard.openSavedItems();
    });

    // 問題形式選択画面のカード選択
    document.querySelectorAll('#select-type-view .type-select-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.classList.contains('disabled')) {
                window.App.Ui.showToast("この問題形式は準備中です");
                return;
            }
            const type = card.getAttribute('data-type');
            if (window.App.Creator && window.App.Creator.initWithType) {
                window.App.Creator.initWithType(type);
            } else if (window.App.Creator && window.App.Creator.init) {
                window.App.Creator.init();
            } else {
                U.showView(V.creator);
            }
        });
    });

    document.getElementById('menu-btn-host')?.addEventListener('click', () => {
        if (window.App.Studio && window.App.Studio.open) {
            window.App.Studio.open();
        } else {
            U.showView(V.hostControl);
        }
    });

    // ログアウト / 戻るボタン
    document.querySelectorAll('.header-back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // host-close-studio-btn-simple has its own listener (host_studio.js)
            // that confirms before ending an in-progress quiz — don't also
            // navigate away here unconditionally.
            if (btn.id === 'host-close-studio-btn-simple') return;
            // 「リストに追加」「リストを保存する」の押し忘れで、問題作成
            // 画面から離れると中身が消えてしまう事故が多かった — 保存
            // されていない問題（リストに追加済みだが未保存 / 追加すら
            // していない書きかけ）がある間は、離れる前に必ず確認する。
            const creatorView = document.getElementById('creator-view');
            if (creatorView && !creatorView.classList.contains('hidden')
                && window.App.Creator && window.App.Creator.hasUnsavedWork && window.App.Creator.hasUnsavedWork()) {
                if (!confirm('保存されていない問題があります。このまま離れると内容が失われますが、よろしいですか？\n（「リストに追加」「リストを保存する」を押すと保存されます）')) {
                    return;
                }
            }
            if (btn.classList.contains('btn-logout')) {
                sessionStorage.removeItem('qs_show_id');
                window.App.State.currentShowId = null;
                const inputEl = document.getElementById('show-id-input');
                if (inputEl) inputEl.value = '';
                U.showView(V.hostLogin);
            } else if (btn.classList.contains('back-to-select-type')) {
                U.showView(V.selectType);
            } else if (btn.classList.contains('back-to-menu')) {
                if (!window.App.State.currentShowId) {
                    U.showView(V.hostLogin);
                } else {
                    window.App.Dashboard.enter();
                }
            } else if (btn.classList.contains('back-to-main')) {
                if (!window.App.State.currentShowId) {
                    U.showView(V.hostLogin);
                } else {
                    window.App.Dashboard.enter();
                }
            } else {
                if (!window.App.State.currentShowId) {
                    U.showView(V.hostLogin);
                } else {
                    window.App.Dashboard.enter();
                }
            }
        });
    });

    // 各機能への遷移
    document.getElementById('dash-create-btn')?.addEventListener('click', () => {
        if (window.App.Creator && window.App.Creator.init) window.App.Creator.init();
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
};

window.App._showTestNavBar = function (testId, playerCount) {
    playerCount = Math.max(1, Math.min(8, playerCount || 2));
    // Estimate nav height: 3 rows of ~28px buttons + padding
    const NAV_H = 100;
    const baseUrl = window.location.origin + window.location.pathname;

    // Hide ROOM ID header (not needed in test mode), but keep ダッシュボード accessible via nav bar
    const studioHeader = document.querySelector('.simple-studio-header');
    if (studioHeader) studioHeader.style.display = 'none';

    // Hide unified toggle while test nav is active (test nav replaces it)
    const unifiedToggle = document.getElementById('unified-toggle-container');
    if (unifiedToggle) unifiedToggle.style.display = 'none';

    // --- Global fixed nav bar at BOTTOM (persists across all view switches) ---
    const nav = document.createElement('div');
    nav.id = 'global-test-nav';
    nav.style.cssText = `position:fixed;bottom:0;left:0;width:100%;min-height:${NAV_H}px;z-index:99999;display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:6px 10px;background:#1a0800;border-top:2px solid #ff6600;box-sizing:border-box;`;
    nav.innerHTML = `<span style="color:#ff6600;font-size:10px;font-weight:900;letter-spacing:1px;flex-shrink:0;margin-right:6px;">🧪 TEST</span>`;
    document.body.appendChild(nav);

    // --- Full-screen iframe overlay (leaves bottom nav bar visible) ---
    const iframeOverlay = document.createElement('div');
    iframeOverlay.id = 'test-iframe-overlay';
    iframeOverlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:calc(100vh - ${NAV_H}px);z-index:99998;display:none;background:#000;`;
    document.body.appendChild(iframeOverlay);

    // Push host control content up to clear bottom nav bar
    const hostView = document.getElementById('host-control-view');
    if (hostView) hostView.style.paddingBottom = NAV_H + 'px';

    // Create all iframes (lazy: src set only when first activated)
    const makeIframe = () => {
        const f = document.createElement('iframe');
        f.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
        iframeOverlay.appendChild(f);
        return f;
    };
    const viewerIframe = makeIframe();
    const playerIframes = Array.from({ length: playerCount }, () => makeIframe());

    let viewerLoaded = false;
    const playerLoaded = Array(playerCount).fill(false);

    // --- Tab switching (iframe show/hide only — no showView calls) ---
    const switchTo = (tabId) => {
        nav.querySelectorAll('.test-tab').forEach(b => {
            b.style.background = b.dataset.tab === tabId ? '#ff6600' : 'rgba(255,255,255,0.13)';
        });

        // Hide iframe overlay for host tab
        if (tabId === 'host') {
            iframeOverlay.style.display = 'none';
            return;
        }

        // Show iframe overlay
        iframeOverlay.style.display = 'block';
        viewerIframe.style.display = 'none';
        playerIframes.forEach(f => f.style.display = 'none');

        if (tabId === 'viewer') {
            if (!viewerLoaded) { viewerIframe.src = `${baseUrl}?vcode=${testId}`; viewerLoaded = true; }
            viewerIframe.style.display = 'block';
        } else if (tabId.startsWith('player-')) {
            const idx = parseInt(tabId.split('-')[1]) - 1;
            if (!playerLoaded[idx]) {
                playerIframes[idx].src = `${baseUrl}?room=${testId}&autoName=${encodeURIComponent('テスト' + (idx + 1))}`;
                playerLoaded[idx] = true;
            }
            if (playerIframes[idx]) playerIframes[idx].style.display = 'block';
        }
    };

    const addTab = (tabId, label, active) => {
        const btn = document.createElement('button');
        btn.className = 'test-tab';
        btn.dataset.tab = tabId;
        btn.textContent = label;
        btn.style.cssText = `padding:4px 12px;border-radius:14px;font-size:11px;font-weight:700;cursor:pointer;border:none;color:#fff;white-space:nowrap;flex-shrink:0;background:${active ? '#ff6600' : 'rgba(255,255,255,0.13)'};`;
        btn.onclick = () => switchTo(tabId);
        nav.appendChild(btn);
    };

    addTab('viewer', '📺 モニター', false);
    addTab('host', '🎤 出題者', true);
    for (let i = 1; i <= playerCount; i++) {
        addTab(`player-${i}`, `👤 テスト${i}`, false);
    }

    // ダッシュボードボタン（右端に配置）
    const dashBtn = document.createElement('button');
    dashBtn.textContent = 'ダッシュボード';
    dashBtn.style.cssText = 'margin-left:auto;padding:4px 12px;border-radius:14px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #555;color:#ccc;background:rgba(255,255,255,0.08);white-space:nowrap;flex-shrink:0;';
    dashBtn.onclick = () => {
        if (confirm('ダッシュボードに戻りますか？テストセッションが終了します。')) {
            document.getElementById('global-test-nav')?.remove();
            document.getElementById('test-iframe-overlay')?.remove();
            // Restore host-control-view padding
            const hv = document.getElementById('host-control-view');
            if (hv) hv.style.paddingBottom = '';
            // Restore unified toggle if present
            const tog = document.getElementById('unified-toggle-container');
            if (tog) tog.style.display = 'flex';
            if (window.App.Dashboard) window.App.Dashboard.enter();
        }
    };
    nav.appendChild(dashBtn);
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

        // saved_sets_meta only, not saved_sets — this fires on every visit
        // to the dashboard, and only needs a yes/no "has at least one set"
        // for the step indicator below, not the full embedded question/
        // design/audio payload of every saved set.
        Promise.all([
            window.db.ref(`saved_sets_meta/${showId}`).once('value'),
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

    // 保存済みセットには問題ごとにデザイン（サウンドライブラリから選んだ
    // 音声データ込み）がまるごと入っている — 一覧に出すタイトルだけの
    // ためにこれを全件フルで取ってくると、セット数・問題数が増えるほど
    // 重くなる。saved_sets_meta にタイトル/問題数/モード/形式だけの軽い
    // サマリーを保存しておき（App.Dashboard.buildSetMeta 参照）、一覧は
    // まずそちらから即座に描画する。フルデータは裏で並行して取得し、
    // 揃い次第もう一度描画し直して itemCache（編集/複製/テストで必要）
    // を満たす。saved_sets_meta が無い古いセットは、フルデータが届いた
    // 時点で backfill され、次回以降は同じく速くなる。
    loadItems: function () {
        const listEl = document.getElementById('dash-set-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        this.itemCache = {}; // Initialize cache
        this._fullSetDataLoaded = false;
        let showId = window.App.State.currentShowId;
        if (showId) showId = showId.trim();

        if (!showId) return;

        const getTs = (d) => {
            if (typeof d.createdAt === 'number') return d.createdAt;
            // timestampオブジェクトや未定義の場合は現在時刻(または大きな値)として扱うことでトップに表示
            return Date.now() + 10000;
        };

        // Fast path — renders almost immediately even for large shows.
        Promise.all([
            window.db.ref(`saved_sets_meta/${showId}`).once('value'),
            window.db.ref(`saved_programs/${showId}`).once('value')
        ]).then(([metaSnap, progSnap]) => {
            const meta = metaSnap.val() || {};
            const progs = progSnap.val() || {};
            this.setsData = Object.keys(meta).map(k => ({ ...meta[k], key: k })).sort((a, b) => getTs(b) - getTs(a));
            this.progsData = Object.keys(progs).map(k => ({ ...progs[k], key: k })).sort((a, b) => getTs(b) - getTs(a));
            this._ensureFilterUi(listEl);
            this.runFilter();
        });

        // Slow path — full data, needed for 編集/複製/テスト (which read
        // .questions) and to backfill legacy sets missing a meta entry.
        Promise.all([
            window.db.ref(`saved_sets/${showId}`).once('value'),
            window.db.ref(`saved_programs/${showId}`).once('value')
        ]).then(([setSnap, progSnap]) => {
            const sets = setSnap.val() || {};
            const progs = progSnap.val() || {};

            Object.keys(sets).forEach(k => { sets[k].size = this.dataSize(sets[k]); });
            const sortedSets = Object.keys(sets).map(k => ({ ...sets[k], key: k }))
                .sort((a, b) => getTs(b) - getTs(a));
            const sortedProgs = Object.keys(progs).map(k => ({ ...progs[k], key: k }))
                .sort((a, b) => getTs(b) - getTs(a));

            this.setsData = sortedSets;
            this.progsData = sortedProgs;
            this._fullSetDataLoaded = true;

            this._ensureFilterUi(listEl);
            this.runFilter();

            this._backfillMissingSetMeta(showId, sets);
        });
    },

    // 上部のカテゴリ（モード/形式の絞り込み）は廃止 — 常に全件表示
    _ensureFilterUi: function () {
        this.filterState = { mode: 'all', type: 'all' };
        document.getElementById('dash-filter-container')?.remove();
    },

    // Lightweight summary written alongside every full-set save/copy so
    // loadItems()'s fast path has everything runFilter()/the list row
    // needs, without embedding .questions (and its per-question design
    // audio) at all.
    buildSetMeta: function (setData) {
        const questions = Array.isArray(setData.questions) ? setData.questions
            : (setData.questions ? Object.values(setData.questions) : []);
        const getQCategory = (qs) => {
            if (!qs || qs.length === 0) return 'unknown';
            const t = qs[0].type;
            if (['free_oral', 'free_written', 'letter_select'].includes(t)) return 'free';
            if (t === 'choice') return 'choice';
            if (t === 'sort') return 'sort';
            if (['multi', 'multi_written', 'multi_oral', 'ranking_written', 'ranking_oral'].includes(t)) return 'multi';
            if (t.startsWith('assoc')) return 'assoc';
            return 'unknown';
        };
        const meta = {
            title: setData.title || 'Untitled Set',
            qCount: questions.length,
            config: { mode: (setData.config && setData.config.mode) || 'normal' },
            typeCat: getQCategory(questions),
            size: this.dataSize(setData),
        };
        if (typeof setData.createdAt === 'number') meta.createdAt = setData.createdAt;
        return meta;
    },

    // セットのデータ容量（バイト）— 一覧で重いセットに気づけるように表示する。
    dataSize: function (data) {
        try { return new Blob([JSON.stringify(data)]).size; } catch (e) { return 0; }
    },

    formatSize: function (bytes) {
        if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
        return Math.max(1, Math.round(bytes / 1024)) + 'KB';
    },

    // Legacy sets saved before saved_sets_meta existed have no entry there
    // — write one now (once, only for the ones missing it) so the next
    // visit to this list is fast for them too.
    _backfillMissingSetMeta: function (showId, sets) {
        if (!window.db) return;
        window.db.ref(`saved_sets_meta/${showId}`).once('value').then(snap => {
            const existing = snap.val() || {};
            const updates = {};
            Object.keys(sets).forEach(k => {
                if (!existing[k]) {
                    updates[k] = this.buildSetMeta(sets[k]);
                } else if (existing[k].size !== sets[k].size) {
                    // 容量表示を追加する前の meta / 容量が変わったセットの size を更新
                    updates[`${k}/size`] = sets[k].size;
                }
            });
            if (Object.keys(updates).length > 0) {
                window.db.ref(`saved_sets_meta/${showId}`).update(updates);
            }
        });
    },

    runFilter: function () {
        const mode = this.filterState.mode;
        const type = this.filterState.type;
        const listEl = document.getElementById('dash-set-list');
        listEl.innerHTML = '';
        this.itemCache = {}; // Reset cache

        // Helper to categorize question type — prefers the precomputed
        // meta.typeCat (present on the fast, meta-only path, which has no
        // .questions to derive this from) and falls back to deriving it
        // once the full item (with .questions) is available.
        const getQCategory = (item) => {
            if (item.typeCat) return item.typeCat;
            if (!item.questions || item.questions.length === 0) return 'unknown';
            const t = item.questions[0].type;
            if (['free_oral', 'free_written', 'letter_select'].includes(t)) return 'free';
            if (t === 'choice') return 'choice';
            if (t === 'sort') return 'sort';
            if (['multi', 'multi_written', 'multi_oral', 'ranking_written', 'ranking_oral'].includes(t)) return 'multi';
            if (t.startsWith('assoc')) return 'assoc';
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
            const qCount = (d.qCount !== undefined) ? d.qCount
                : Array.isArray(d.questions) ? d.questions.length : (d.questions ? Object.keys(d.questions).length : 0);

            // 1MBを超えると開始・配信が目に見えて遅くなるので色で知らせる
            const sizeColor = !d.size ? '#888' : d.size >= 1024 * 1024 ? '#ff6b6b' : d.size >= 300 * 1024 ? '#ffb74d' : '#888';
            const sizeStr = d.size ? `<span style="margin-left:6px; color:${sizeColor}; font-size:0.85em;">${this.formatSize(d.size)}</span>` : '';

            const div = document.createElement('div');
            div.className = 'dash-list-item item-type-set';
            div.setAttribute('onclick', `window.App.Dashboard.openItemMenu('${k}', 'set')`);
            div.style.cursor = 'pointer';

            div.innerHTML = `
                <div class="item-main">
                    <div class="item-title"><span class="badge-set">SET</span> ${d.title || "Untitled"}</div>
                    <div class="item-meta">${dateStr} / ${qCount}Q${sizeStr}</div>
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
            const showId = window.App.State.currentShowId;
            window.db.ref(`${path}/${showId}/${key}/title`).set(newTitle).then(() => {
                if (type === 'set') window.db.ref(`saved_sets_meta/${showId}/${key}/title`).set(newTitle);
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
                const showId = window.App.State.currentShowId;
                window.db.ref(`${path}/${showId}/${key}/title`).set(newTitle).then(() => {
                    if (type === 'set') window.db.ref(`saved_sets_meta/${showId}/${key}/title`).set(newTitle);
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

        // The list can render from the lightweight saved_sets_meta summary
        // before the full saved_sets fetch (with .questions) resolves —
        // start/edit/copy/test all need the full data, so block just this
        // brief window rather than let them silently act on an incomplete
        // item (delete doesn't need .questions, but keeping this uniform
        // is simpler and the full fetch is normally only a beat behind).
        if (isSet && !Array.isArray(data.questions)) {
            window.App.Ui.showToast('読み込み中です。少し待ってからもう一度お試しください');
            return;
        }

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

        // Test
        const testAction = `window.App.Dashboard.testItem('${key}', '${type}')`;

        const html = `
            <div id="item-menu-modal" class="design-modal-overlay" onclick="if(event.target===this)this.remove()">
                <div class="design-modal-content" style="max-width:340px; padding:24px !important;">
                    <div class="item-menu-header" style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:18px;">
                        <div class="item-menu-title" onclick="window.App.Dashboard.startInlineRename(this, '${key}', '${type}')" style="cursor:pointer; min-width:0; display:flex; align-items:center; gap:8px; font-size:1.1em; font-weight:800; color:#fff;">
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${title}</span>
                            <i class="fas fa-pen" style="font-size:0.65em; opacity:0.6; flex-shrink:0;"></i>
                        </div>
                        <button onclick="document.getElementById('item-menu-modal').remove()" style="
                            flex-shrink:0; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.1);
                            border:none; color:#fff; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;
                        ">×</button>
                    </div>
                    <div class="item-menu-body" style="display:flex; flex-direction:column; gap:8px;">
                        <button class="item-menu-btn" onclick="${startAction}; document.getElementById('item-menu-modal').remove()">
                            <i class="fas fa-play" style="color:#00e5ff;"></i><span>スタート</span>
                        </button>
                        <button class="item-menu-btn" onclick="${testAction}; document.getElementById('item-menu-modal').remove()">
                            <i class="fas fa-flask" style="color:#f39c12;"></i><span>テスト</span>
                        </button>
                        <button class="item-menu-btn" onclick="${editAction}">
                            <i class="fas fa-pen-fancy" style="color:#64b5f6;"></i><span>編集</span>
                        </button>
                        <button class="item-menu-btn" onclick="${copyAction}; document.getElementById('item-menu-modal').remove()">
                            <i class="far fa-file-alt" style="color:#81c784;"></i><span>複製</span>
                        </button>

                        <div style="height:1px; background:rgba(255,255,255,0.08); margin:4px 0;"></div>

                        <button class="item-menu-btn item-menu-btn-danger" onclick="${delAction}; document.getElementById('item-menu-modal').remove()">
                            <i class="fas fa-trash-alt"></i><span>削除</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    // Quick Start: セットを直接スタジオに送る
    quick: function (key) {
        const showId = window.App.State.currentShowId;
        if (!showId) { window.App.Ui.showToast('エラー: IDが未設定です。ページを再読み込みしてください。'); return; }
        window.App.Ui.showToast('スタート準備中...');
        window.db.ref(`saved_sets/${showId}/${key}`).once('value', snap => {
            const data = snap.val();
            if (!data) { window.App.Ui.showToast('エラー: セットデータが見つかりません'); return; }
            if (!window.App.Studio || !window.App.Studio.quickStart) { window.App.Ui.showToast('エラー: Studio未初期化'); return; }
            window.App.Studio.quickStart(data);
        }).catch(err => {
            window.App.Ui.showToast('Firebase読み込みエラー: ' + (err.message || err.code));
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
                window.db.ref(`saved_sets_meta/${showId}/${newKey}`).set(this.buildSetMeta(newData));
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

    testItem: function (key, type) {
        const data = this.itemCache && this.itemCache[key];
        if (!data) return;

        const countStr = prompt("テストプレイのプレイヤー数を入力してください (1〜8)", "2");
        if (countStr === null) return;
        let count = parseInt(countStr);
        if (isNaN(count) || count < 1) count = 1;
        if (count > 8) count = 8;

        const isSet = (type === 'set');
        const testId = `TEST-${Math.floor(Math.random() * 9000) + 1000}`;
        const baseUrl = window.location.origin + window.location.pathname;
        const sid = encodeURIComponent(window.App.State.currentShowId || '');
        const hostUrl = `${baseUrl}?${isSet ? 'testHost' : 'testProg'}=${testId}&tp=${count}&sid=${sid}`;
        window.open(hostUrl, '_blank');

        const dbPath = isSet ? `saved_sets/${testId}` : `saved_programs/${testId}`;
        window.db.ref(dbPath).set(data).catch(err => {
            alert("テスト準備エラー: " + err.message);
        });
    },

    del: function (path, key) {
        if (!confirm("本当に削除しますか？")) return;
        const showId = window.App.State.currentShowId;
        window.db.ref(`${path}/${showId}/${key}`).remove().then(() => {
            // Keep saved_sets_meta from accumulating orphaned entries for
            // sets that no longer exist.
            if (path === 'saved_sets') window.db.ref(`saved_sets_meta/${showId}/${key}`).remove();
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

        const modal = document.querySelector('#item-menu-modal .design-modal-content');
        if (!modal) return;

        const titleEl = modal.querySelector('.item-menu-title');
        const bodyEl = modal.querySelector('.item-menu-body');

        if (!titleEl || !bodyEl) return;

        // Feedback toast
        if (window.App.Ui && window.App.Ui.showToast) {
            window.App.Ui.showToast("編集メニューに切り替えます");
        }

        // Update Title with Back Button
        titleEl.innerHTML = `
            <button onclick="window.App.Dashboard.openItemMenu('${key}', 'set')" style="background:none; border:none; color:#00e5ff; font-size:1.2em; cursor:pointer; padding:0; display:flex; align-items:center; opacity:0.8; transition:0.2s; flex-shrink:0;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'"><i class="fas fa-chevron-left"></i></button>
            <span>編集メニュー</span>
        `;
        titleEl.onclick = null;
        titleEl.style.cursor = 'default';

        // Update Body with Edit Options
        bodyEl.innerHTML = `
            <button class="item-menu-btn" onclick="window.App.Dashboard.transitionToCreator('${key}'); document.getElementById('item-menu-modal').remove()">
                <i class="fas fa-edit" style="color:#64b5f6;"></i><span>問題作成</span>
            </button>
        `;
    },

    transitionToCreator: function (key) {
        const data = this.itemCache ? this.itemCache[key] : null;
        if (window.App.Creator && window.App.Creator.loadSet) {
            window.App.Creator.loadSet(key, data);
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
window.startRoom = () => window.App.Studio.startRoom();
window.quickStartSet = (d) => window.App.Studio.quickStart(d);
window.enterDashboard = () => window.App.Dashboard.enter();

document.addEventListener('DOMContentLoaded', () => {
    window.App.init();
});
