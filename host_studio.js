/* =========================================================
 * host_studio.js (v145: Pre-setup screen for turn/solo modes)
 * =======================================================*/

App.Studio = {
    timer: null,
    buzzWinner: null,
    isQuick: false,
    currentStepId: 0,
    inPreSetup: false,        // True while showing the pre-quiz player selection screen
    panelState: Array(25).fill(0),
    selectedPanelColor: 1,
    selectedPlayerId: null,
    turnOrder: [],    // Array of player IDs in set order for turn mode
    turnIndex: 0,     // Current turn index
    turnAdvancedThisQ: false, // Flag to prevent double-advancing turn in normal mode
    timeLimitTimer: null,     // Timer ID for time limit countdown
    timeLimitEndTime: null,   // End time for current time limit
    judgeQueue: [],           // [{id, name, answer}] — answer-submit order
    judgeCurrentRevealed: false, // Whether current player's answer is revealed

    onMainAction: function () {
        // This is a fallback/dispatcher. Typically btnMain.onclick is overwritten by setStep.
        // If it's called here, it usually means the button was clicked before a program was loaded.
        if (App.Data.studioQuestions.length === 0) {
            alert("⚠️ 最初にプログラム（セット）をロードしてください。");
        }
    },

    soloState: { lives: 3, timeBank: 60, challengerIndex: 0 },

    setupUnifiedToggle: function() {
        // テストナビが存在する間は unified-toggle を表示しない
        if (document.getElementById('global-test-nav')) return;

        let container = document.getElementById('unified-toggle-container');
        if (container) {
            // Reset to host state
            const activeStyle = 'background:linear-gradient(135deg, #00bfff 0%, #0077aa 100%); color:#fff; border-radius:20px; padding:10px 20px; font-weight:bold; border:none; box-shadow:0 0 15px rgba(0,191,255,0.4); cursor:pointer;';
            const inactiveStyle = 'background:transparent; color:#aaa; border-radius:20px; padding:10px 20px; font-weight:normal; border:none; cursor:pointer; transition:all 0.2s;';
            container.querySelectorAll('button').forEach(btn => btn.style.cssText = inactiveStyle);
            container.querySelector('[data-role="host"]').style.cssText = activeStyle;
            container.dataset.view = 'host';
            return;
        }

        container = document.createElement('div');
        container.id = 'unified-toggle-container';
        container.dataset.view = 'host';
        container.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; gap:6px; background:rgba(0,0,0,0.75); padding:8px 10px; border-radius:30px; backdrop-filter:blur(10px); box-shadow:0 8px 24px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); white-space:nowrap;';

        const activeStyle = 'background:linear-gradient(135deg, #00bfff 0%, #0077aa 100%); color:#fff; border-radius:20px; padding:10px 18px; font-weight:bold; border:none; box-shadow:0 0 15px rgba(0,191,255,0.4); cursor:pointer; font-size:0.95em;';
        const inactiveStyle = 'background:transparent; color:#aaa; border-radius:20px; padding:10px 18px; font-weight:normal; border:none; cursor:pointer; transition:all 0.2s; font-size:0.95em;';

        const btnHost   = document.createElement('button');
        const btnViewer = document.createElement('button');
        const btnPlayer = document.createElement('button');

        btnHost.dataset.role   = 'host';
        btnViewer.dataset.role = 'viewer';
        btnPlayer.dataset.role = 'player';

        btnHost.textContent   = "🎤 司会者";
        btnViewer.textContent = "📺 モニター";
        btnPlayer.textContent = "🙋 解答者";

        btnHost.style.cssText   = activeStyle;
        btnViewer.style.cssText = inactiveStyle;
        btnPlayer.style.cssText = inactiveStyle;

        const switchView = (target) => {
            if (container.dataset.view === target) return;
            container.dataset.view = target;
            container.querySelectorAll('button').forEach(btn => btn.style.cssText = inactiveStyle);

            if (target === 'host') {
                btnHost.style.cssText = activeStyle;
                App.Ui.showView(App.Ui.views.hostControl);
            } else if (target === 'viewer') {
                btnViewer.style.cssText = activeStyle;
                App.Ui.showView(App.Ui.views.viewerMain);
            } else {
                btnPlayer.style.cssText = activeStyle;
                // Show player game view if already in room, otherwise respondent entry
                const pgView = document.getElementById('player-game-view');
                if (pgView && !pgView.classList.contains('hidden')) {
                    App.Ui.showView(App.Ui.views.playerGame);
                } else {
                    App.Ui.showView(App.Ui.views.respondent);
                }
            }
        };

        btnHost.onclick   = () => switchView('host');
        btnViewer.onclick = () => switchView('viewer');
        btnPlayer.onclick = () => switchView('player');

        // Allow dragging toggle if it covers UI (touch drag)
        let isDragging = false;
        let startY, startX, initialBottom, initialLeft;

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            isDragging = false;
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            const rect = container.getBoundingClientRect();
            initialBottom = window.innerHeight - rect.bottom;
            initialLeft = rect.left;
            container.style.transform = 'none';
            container.style.left = initialLeft + 'px';
            container.style.transition = 'none';
        }, {passive:true});

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) return;
            const dy = startY - e.touches[0].clientY;
            const dx = e.touches[0].clientX - startX;
            if (Math.abs(dy) > 5 || Math.abs(dx) > 5) isDragging = true;

            if (isDragging) {
                let newBottom = initialBottom + dy;
                let newLeft   = initialLeft + dx;
                newBottom = Math.max(10, Math.min(newBottom, window.innerHeight - 70));
                newLeft   = Math.max(10, Math.min(newLeft, window.innerWidth - container.offsetWidth - 10));
                container.style.bottom = newBottom + 'px';
                container.style.left   = newLeft + 'px';
            }
        }, {passive:true});

        container.addEventListener('touchend', () => {
            container.style.transition = 'opacity 0.2s';
        });

        // Show/hide based on whether any of the three views is active
        const watchedIds = ['host-control-view', 'viewer-main-view', 'player-game-view', 'respondent-view'];
        const updateVisibility = () => {
            const anyVisible = watchedIds.some(id => !document.getElementById(id)?.classList.contains('hidden'));
            container.style.display = anyVisible ? 'flex' : 'none';
        };
        watchedIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) new MutationObserver(updateVisibility).observe(el, {attributes: true, attributeFilter: ['class']});
        });

        container.appendChild(btnHost);
        container.appendChild(btnViewer);
        container.appendChild(btnPlayer);
        document.body.appendChild(container);
    },

    startRoom: function (isQuick = false) {
        if (!App.State.currentShowId) {
            // alert("番組IDが設定されていません");
            App.Ui.showToast("番組IDエラー: ダッシュボードから入り直してください");
            return;
        }

        this.isQuick = isQuick;
        App.Data.studioQuestions = [];
        App.State.currentQIndex = 0;
        App.State.currentPeriodIndex = 0;
        this.panelState = Array(25).fill(0);

        let code;
        let keepPlayers = false;

        if (App.State.reuseRoomId) {
            code = App.State.reuseRoomId;
            keepPlayers = true;
            App.State.reuseRoomId = null; // Consume flag
            App.Ui.showToast(`既存のルーム(${code})で開始します (プレイヤー維持)`);
        } else {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        App.State.currentRoomId = code;

        // ★ モニター画面を別タブで自動起動 (新規時のみ、または常にConfirm?)
        // 常に開いておくと安全（閉じてしまった場合のため）
        const viewerUrl = window.location.origin + window.location.pathname + `?vcode=${code}`;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || window.innerWidth <= 800;

        if (isStandalone) {
            window.App.isUnifiedMode = true;
        } else {
            if (!keepPlayers) window.open(viewerUrl, '_blank');
        }

        const roomData = {
            questions: [],
            status: { step: 'standby', qIndex: 0, panels: this.panelState },
            config: { mode: 'normal' }
        };

        const onRoomReady = () => {
            const box = document.getElementById('big-room-id-box');
            if (box) {
                box.classList.add('new-room');
                setTimeout(() => box.classList.remove('new-room'), 600);
            }
            App.Ui.showView(App.Ui.views.hostControl);
            this.enterHostMode(this.isQuick);

            // ★ Unified Mode: ルーム作成完了後にビューアを接続し、トグルUIを表示
            if (window.App.isUnifiedMode && window.App.Viewer && window.App.Viewer.connect) {
                window.App.Viewer.connect(code);
                this.setupUnifiedToggle();
            }
        };

        if (keepPlayers) {
            // Update existing room, preserve players
            window.db.ref(`rooms/${code}`).update(roomData).then(onRoomReady);
        } else {
            // New room, reset players
            roomData.players = {};
            window.db.ref(`rooms/${code}`).set(roomData).then(onRoomReady);
        }
    },

    enterHostMode: function (isQuick) {
        App.Ui.showView(App.Ui.views.hostControl);

        const btnMain = document.getElementById('btn-phase-main');
        if (btnMain) {
            btnMain.classList.add('hidden');
        }

        const code = App.State.currentRoomId;

        const targets = ['studio-header-room-id', 'studio-big-room-id'];
        targets.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = code;
                el.onclick = () => {
                    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
                    const shareText = `Quiz Studioに参加してください！\n部屋コード: ${code}\nURL: ${shareUrl}`;

                    if (navigator.share) {
                        navigator.share({
                            title: 'Quiz Studio',
                            text: shareText,
                            url: shareUrl
                        }).catch(() => {
                            navigator.clipboard.writeText(code).then(() => App.Ui.showToast("📋 ID Copied!"));
                        });
                    } else {
                        navigator.clipboard.writeText(code).then(() => App.Ui.showToast("📋 ID Copied!"));
                    }
                };
            }
        });

        const btnAns = document.getElementById('btn-toggle-ans');
        if (btnAns) btnAns.style.display = 'none';

        this.toggleUIForStandby(true);

        window.db.ref(`rooms/${code}/players`).on('value', snap => {
            const players = snap.val() || {};
            App.Data.players = players; // Store globally for access in setStep
            const count = Object.keys(players).length;
            document.getElementById('studio-player-count-display').textContent = count;
            this.updatePlayerList(players);

            // ★ Turn/Solo Mode: Update UI on player join/leave in pre-setup or Step 0
            if (App.Data.currentConfig?.mode === 'turn' || App.Data.currentConfig?.mode === 'solo') {
                if (this.inPreSetup || this.currentStepId === 0) {
                    const btnMain = document.getElementById('btn-phase-main');
                    if (btnMain) this.renderTurnOrderSetup(btnMain);
                }
            }

            if (this.currentStepId === 2 || this.currentStepId === 3 || this.currentStepId === 4 || this.currentStepId === 5) {
                this.renderRealtimeAnswers(players);
                this.renderUnifiedConsole(players);
            } else {
                this.renderUnifiedConsole(players); // Still might want to see who joined
            }

            const isBuzz = (App.Data.currentConfig?.mode === 'buzz');
            const isTurn = (App.Data.currentConfig?.mode === 'turn');

            if (this.currentStepId === 2) {
                if (isBuzz) {
                    this.checkBuzz(players);

                    // Auto Judge for Buzz Mode (Choice/Sort/Letter)
                    if (this.buzzWinner && players[this.buzzWinner]) {
                        const winner = players[this.buzzWinner];
                        const q = App.Data.studioQuestions[App.State.currentQIndex];
                        // Only auto-judge if they have answered AND not yet judged
                        if (winner.lastAnswer !== null && winner.lastAnswer !== undefined && !winner.lastResult) {
                            if (q && ['choice', 'sort', 'letter_select'].includes(q.type)) {
                                this.judgeBuzzAuto(this.buzzWinner, winner, q);
                            }
                        }
                    }
                } else if (isTurn || (App.Data.currentConfig?.mode === 'solo')) {
                    // Auto Judge for Turn/Solo Mode (Iterate all to find pending answer)
                    const q = App.Data.studioQuestions[App.State.currentQIndex];
                    if (q && ['choice', 'sort', 'letter_select'].includes(q.type)) {
                        Object.entries(players).forEach(([pid, p]) => {
                            if (p.lastAnswer !== null && p.lastAnswer !== undefined && !p.lastResult) {
                                // Found a player with pending answer - pass ID and Player Object
                                this.judgeBuzzAuto(pid, p, q);
                            }
                        });
                    }
                }
            }
        });

        // --- Mobile/Unified Console Button Sync ---
        const mobBtnMain = document.getElementById('console-btn-phase-main');
        const mobBtnCorrect = document.getElementById('console-btn-judge-correct');
        const mobBtnWrong = document.getElementById('console-btn-judge-wrong');

        if (mobBtnMain) {
            mobBtnMain.onclick = () => {
                const pcBtn = document.getElementById('btn-phase-main');
                if (pcBtn) pcBtn.click();
            };
        }
        if (mobBtnCorrect) {
            mobBtnCorrect.onclick = () => {
                if (this.selectedPlayerId) {
                    this.updatePlayerScore(this.selectedPlayerId, true);
                } else {
                    App.Ui.showToast("解答者を選択してください");
                }
            };
        }
        if (mobBtnWrong) {
            mobBtnWrong.onclick = () => {
                if (this.selectedPlayerId) {
                    this.updatePlayerScore(this.selectedPlayerId, false);
                } else {
                    App.Ui.showToast("解答者を選択してください");
                }
            };
        }

        if (isQuick && App.Data.periodPlaylist.length > 0) {
            this.renderTimeline();
            setTimeout(() => this.setupPeriod(0), 500);
        } else {
            document.getElementById('studio-execution-grid').classList.add('hidden');
            document.getElementById('studio-standby-panel').classList.remove('hidden');
            document.getElementById('studio-loader-ui').classList.remove('hidden');
            this.loadProgramList();
        }

        // --- Scaling Logic ---
        window.addEventListener('resize', () => {
            if (App.Ui.currentViewId === 'host-control-view') this.updateMonitorScaling();
        });
        setTimeout(() => this.updateMonitorScaling(), 100);
    },



    toggleUIForStandby: function (isStandby) {
        const hideIds = ['studio-q-num-display'];
        hideIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.parentNode) {
                el.parentNode.style.visibility = isStandby ? 'hidden' : 'visible';
            }
        });
        const footerTools = document.querySelector('.footer-tools');
        if (footerTools) footerTools.style.display = isStandby ? 'none' : 'flex';
    },

    updateStudioStatus: function (stepId) {
        // Update Q Number Display (Use 'Q1', 'Q2' etc.)
        const qNumEl = document.getElementById('studio-q-number-large');
        const qIdx = App.State.currentQIndex;
        if (qNumEl) {
            const displayIdx = (qIdx !== undefined) ? qIdx + 1 : '-';
            qNumEl.textContent = `Q ${displayIdx}`;
        }

        const q = App.Data.studioQuestions[qIdx] || {};

        // Update Status Indicators
        // Map steps to indicators: 
        // 0=Start/Title, 1=QNum -> QNum Indicator
        // 2=RevealQ/Answering, 3=Closed -> Question Indicator
        // 4=RevealP, 5=RevealC, 6=Judge -> Answer Indicator
        // 7=Result -> Result Indicator
        const map = {
            'status-ind-qnum': { steps: [0, 1], hide: q.isQNumHidden || (stepId === 0 && q.isTitleHidden) },
            'status-ind-question': { steps: [2, 3], hide: q.isHidden },
            'status-ind-answer': { steps: [4, 5, 6], hide: q.isAnsHidden },
            'status-ind-result': { steps: [7], hide: q.isResHidden || q.isHidden }
        };

        for (const [id, cfg] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) {
                // If the phase is hidden in design, hide the indicator entirely
                el.style.display = cfg.hide ? 'none' : 'flex';

                if (cfg.steps.includes(stepId)) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }
        }
    },

    syncMainButton: function () {
        const pcBtn = document.getElementById('btn-phase-main');
        const mobBtn = document.getElementById('console-btn-phase-main');
        if (pcBtn && mobBtn) {
            mobBtn.textContent = pcBtn.textContent;

            // Sync onclick handler safely
            mobBtn.onclick = (e) => {
                e.preventDefault();
                if (pcBtn.onclick) {
                    pcBtn.onclick(e);
                } else {
                    pcBtn.click();
                }
            };

            // Sync visibility
            if (pcBtn.classList.contains('hidden')) mobBtn.classList.add('hidden');
            else mobBtn.classList.remove('hidden');

            // Sync feedback classes & update styles for Giant Button
            const syncClasses = ['action-stop', 'action-ready', 'action-next', 'anim-beat'];
            syncClasses.forEach(cls => {
                if (pcBtn.classList.contains(cls)) mobBtn.classList.add(cls);
                else mobBtn.classList.remove(cls);
            });

            // Apply Dynamic Gradient based on class
            if (pcBtn.classList.contains('action-next')) {
                mobBtn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)'; // Green for Next
                mobBtn.style.boxShadow = '0 4px 15px rgba(46, 204, 113, 0.4)';
            } else if (pcBtn.classList.contains('action-stop')) {
                mobBtn.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'; // Red for Stop
                mobBtn.style.boxShadow = '0 4px 15px rgba(231, 76, 60, 0.4)';
            } else if (pcBtn.classList.contains('action-ready')) {
                mobBtn.style.background = 'linear-gradient(135deg, #00bfff 0%, #0077aa 100%)'; // Blue for Ready/Start
                mobBtn.style.boxShadow = '0 4px 15px rgba(0, 191, 255, 0.4)';
            } else {
                mobBtn.style.background = '#444'; // Default Grey
                mobBtn.style.boxShadow = 'none';
            }

            // Sync disabled state
            mobBtn.disabled = pcBtn.disabled;
            if (mobBtn.disabled) {
                mobBtn.style.background = '#333';
                mobBtn.style.color = '#777';
                mobBtn.style.boxShadow = 'none';
            } else {
                mobBtn.style.color = '#fff';
            }
        }
    },

    loadProgramList: function () {
        const select = document.getElementById('studio-program-select');
        const btn = document.getElementById('studio-load-program-btn');
        let showId = App.State.currentShowId;
        if (showId) showId = showId.trim();

        if (!select || !btn) return;
        if (!showId) { select.innerHTML = '<option>エラー: ID未設定</option>'; return; }

        select.innerHTML = '<option>読込中...</option>';
        btn.disabled = true;

        this.localProgramsCache = {};
        this.localSetsCache = {};

        const progPromise = window.db.ref(`saved_programs/${showId}`).once('value');
        const setsPromise = window.db.ref(`saved_sets/${showId}`).once('value');

        Promise.all([progPromise, setsPromise]).then(([progSnap, setsSnap]) => {
            const progData = progSnap.val();
            const setsData = setsSnap.val();

            select.innerHTML = '';
            const def = document.createElement('option');
            def.value = "";
            def.textContent = "-- セット / プログラムを選択 --";
            select.appendChild(def);

            // 個別セット
            if (setsData) {
                const setGroup = document.createElement('optgroup');
                setGroup.label = "── 個別セット ──";
                select.appendChild(setGroup);

                const sortedSets = Object.keys(setsData).map(k => ({ ...setsData[k], key: k }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                sortedSets.forEach(set => {
                    this.localSetsCache[set.key] = set;
                    const opt = document.createElement('option');
                    opt.value = `set:${set.key}`;
                    opt.textContent = `${set.title} (${set.questions?.length || 0}Q)`;
                    setGroup.appendChild(opt);
                });
            }

            // プログラム
            if (progData) {
                const progGroup = document.createElement('optgroup');
                progGroup.label = "── プログラム ──";
                select.appendChild(progGroup);

                const sortedProgs = Object.keys(progData).map(k => ({ ...progData[k], key: k }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                sortedProgs.forEach(prog => {
                    this.localProgramsCache[prog.key] = prog;
                    const opt = document.createElement('option');
                    opt.value = `prog:${prog.key}`;
                    opt.textContent = `${prog.title} (${prog.playlist?.length || 0}セット)`;
                    progGroup.appendChild(opt);
                });
            }

            if (!setsData && !progData) {
                const opt = document.createElement('option');
                opt.textContent = "(保存されたセット/プログラムがありません)";
                select.appendChild(opt);
            }

            select.disabled = false;
        });

        select.onchange = () => {
            btn.disabled = (select.value === "");
        };

        btn.onclick = () => {
            const val = select.value;
            if (!val) return;

            const showId = App.State.currentShowId;

            // Always fetch fresh from Firebase so eye-toggle / design changes are reflected
            // even if the studio cache was loaded before the user saved in セットデザイン
            const applyAndFinalize = () => {
                document.getElementById('studio-loader-ui').classList.add('hidden');
                this.renderTimeline();
                const btnMain = document.getElementById('btn-phase-main');
                btnMain.textContent = "番組を開始";
                btnMain.classList.remove('hidden');
                btnMain.className = 'btn-block btn-large-action action-ready';
                btnMain.onclick = null;
                btnMain.onclick = () => {
                    try { this.setupPeriod(0); } catch (e) { alert("開始エラー: " + e.message); }
                };
                this.syncMainButton();
            };

            if (val.startsWith('set:')) {
                const key = val.slice(4);
                btn.disabled = true;
                btn.textContent = '読込中...';
                window.db.ref(`saved_sets/${showId}/${key}`).once('value').then(snap => {
                    btn.disabled = false;
                    btn.textContent = '読み込む';
                    const freshSet = snap.val();
                    if (!freshSet) { alert('セットデータが見つかりません'); return; }
                    freshSet.key = key;
                    this.localSetsCache[key] = freshSet;
                    App.Data.periodPlaylist = [freshSet];
                    applyAndFinalize();
                });
            } else if (val.startsWith('prog:')) {
                const key = val.slice(5);
                btn.disabled = true;
                btn.textContent = '読込中...';
                window.db.ref(`saved_programs/${showId}/${key}`).once('value').then(snap => {
                    btn.disabled = false;
                    btn.textContent = '読み込む';
                    const freshProg = snap.val();
                    if (!freshProg) { alert('プログラムデータが見つかりません'); return; }
                    this.localProgramsCache[key] = freshProg;
                    App.Data.periodPlaylist = freshProg.playlist || [];
                    if (App.Data.periodPlaylist.length === 0) {
                        alert("⚠️ このプログラムにはセットが登録されていません。");
                        return;
                    }
                    applyAndFinalize();
                });
            }
        };
    },

    renderTimeline: function () {
        const area = document.getElementById('studio-period-timeline');
        area.innerHTML = '';
        App.Data.periodPlaylist.forEach((item, i) => {
            const btn = document.createElement('button');
            const isActive = (i === App.State.currentPeriodIndex);
            btn.className = `btn-block ${isActive ? 'btn-info' : 'btn-dark'}`;
            if (item.type === 'container') {
                const optCount = (item.options || item.items || []).length;
                btn.textContent = `${i + 1}: 📦 ${item.title} (${optCount}択)`;
            } else {
                btn.textContent = `${i + 1}セット目: ${item.title} [${this.translateMode(item.config?.mode || 'normal')}]`;
            }
            btn.style.textAlign = 'left';
            btn.onclick = () => this.setupPeriod(i);
            area.appendChild(btn);
        });
    },

    setupPeriod: function (index) {
        console.log("Setup Period:", index);
        if (!App.Data.periodPlaylist || App.Data.periodPlaylist.length === 0) {
            alert("再生するプレイリストがありません。一度プログラムをセット（読込）してください。");
            return;
        }

        const item = App.Data.periodPlaylist[index];
        if (!item) {
            alert(`エラー: セット番号[${index}]のデータが見つかりません。`);
            return;
        }

        // --- Container (Multi) handling ---
        if (item.type === 'container') {
            App.State.currentPeriodIndex = index;
            this.showContainerSelection(index);
            return;
        }

        App.State.currentPeriodIndex = index;
        if (!item.progSettings) item.progSettings = { showRankingAfter: false, eliminationMode: 'none' };

        // Always run shuffleQuestions to apply per-question choice shuffling (q.shuffle flag).
        // The global config.shuffleQuestions only controls question ORDER randomization.
        let qs = item.questions || [];
        if (!Array.isArray(qs)) qs = Object.values(qs);
        // Apply per-question choice shuffling (based on each q.shuffle flag)
        qs = this.shuffleQuestions(qs);
        // If global question order shuffle is enabled, randomize the question order too
        if (item.config && item.config.shuffleQuestions === true) {
            qs = this.shuffleArray([...qs]);
        }
        App.Data.studioQuestions = qs;
        App.Data.currentConfig = item.config || { mode: 'normal' };
        App.Data.currentConfig.periodTitle = item.title || "Untitled";
        App.State.currentQIndex = 0;

        const roomId = App.State.currentRoomId;
        if (!roomId) {
            alert("エラー: 部屋IDが取得できません。再起動してください。");
            return;
        }

        // Firebase Sync
        window.db.ref(`rooms/${roomId}/config`).set(App.Data.currentConfig);
        window.db.ref(`rooms/${roomId}/questions`).set(App.Data.studioQuestions);

        // UI Prep
        document.getElementById('studio-standby-panel').classList.add('hidden');
        document.getElementById('studio-execution-grid').classList.remove('hidden');

        // Optional Panel logic
        const panelCtrl = document.getElementById('studio-panel-control');
        if (panelCtrl) {
            if (item.config && item.config.gameType === 'panel') {
                panelCtrl.classList.remove('hidden');
                this.renderPanelControl();
            } else {
                panelCtrl.classList.add('hidden');
            }
        }

        this.renderTimeline();

        if (item.config && item.config.mode === 'solo') {
            document.getElementById('studio-solo-info')?.classList.remove('hidden');
            this.soloState.lives = item.config.soloLife || 3;
            const lifeDisp = document.getElementById('studio-life-display');
            if (lifeDisp) lifeDisp.textContent = this.soloState.lives;
        } else {
            document.getElementById('studio-solo-info')?.classList.add('hidden');
        }

        this.revealedMultiIndices = {};
        this.isTurnOrderConfirmed = false;
        this.turnSetupDismissed = false;
        this.inPreSetup = false;
        this.bjUsedCards = []; // Reset blackjack used cards for new set
        this.bjPickedHistory = []; // Reset blackjack picked history for new set
        this.clearTimeLimit();

        // Reset bjTotal and bjCardHistory for all players if this is a blackjack set
        const hasBlackjack = (App.Data.studioQuestions || []).some(q => q.type === 'blackjack');
        if (hasBlackjack && roomId) {
            window.db.ref(`rooms/${roomId}/players`).once('value', snap => {
                const players = snap.val() || {};
                const updates = {};
                Object.keys(players).forEach(pid => {
                    updates[`${pid}/bjTotal`] = 0;
                    updates[`${pid}/bjCardHistory`] = [];
                });
                if (Object.keys(updates).length) window.db.ref(`rooms/${roomId}/players`).update(updates);
            });
        }

        // Turn/Solo: show player selection screen BEFORE the title/quiz starts
        if (App.Data.currentConfig.mode === 'turn' || App.Data.currentConfig.mode === 'solo') {
            this.showPreQuizSetup();
        } else {
            this.setStep(0);
        }
    },

    setStep: function (stepId) {
        this.currentStepId = stepId;
        this.clearTimeLimit(); // Always clear any running time limit timer on step change
        document.getElementById('turn-order-setup')?.remove(); // Cleanup turn setup UI
        this.updateStudioStatus(stepId); // Sync Status Indicators
        this.updateNextPreview(); // Update preview when step changes

        const btnMain = document.getElementById('btn-phase-main');
        const subControls = document.getElementById('studio-sub-controls');

        // Reset main button state (crucial if switching from Turn Mode where it might be disabled)
        if (btnMain) {
            btnMain.className = 'btn-block btn-large-action';
            btnMain.classList.remove('hidden');
            btnMain.disabled = false;
            btnMain.style.opacity = '1';
            btnMain.style.pointerEvents = 'auto';
            btnMain.style.cursor = 'pointer';
            btnMain.style.filter = 'none';
        }

        if (subControls) subControls.classList.add('hidden');

        // Hide title banner on any step change (it's only shown in Step 0)
        const existingBanner = document.getElementById('studio-title-banner');
        if (existingBanner && stepId !== 0) existingBanner.classList.add('hidden');

        // Sync Console Button
        const mobBtnMain = document.getElementById('console-btn-phase-main');
        if (mobBtnMain) {
            mobBtnMain.className = btnMain.className;
        }

        const isStandby = (stepId === 0 || stepId === 1);
        this.toggleUIForStandby(isStandby);

        // Hide console card during title display (Step 0) for a clean look
        const consoleCard = document.querySelector('.console-card-wrapper');
        if (consoleCard) consoleCard.style.display = (stepId === 0) ? 'none' : '';

        // Hide Q number header + status indicators during Step 0
        const statusWrapper = document.getElementById('studio-status-wrapper');
        if (statusWrapper) statusWrapper.style.display = (stepId === 0) ? 'none' : '';

        // Hide sub-controls label row during Step 0
        const subStepRow = document.getElementById('studio-sub-controls');
        if (subStepRow) subStepRow.classList.toggle('hidden', stepId === 0);

        const ansArea = document.getElementById('studio-player-answers');
        const statsArea = document.getElementById('studio-answer-stats');
        if (ansArea) ansArea.classList.toggle('hidden', stepId < 2 || stepId > 6);
        if (statsArea) statsArea.classList.toggle('hidden', stepId !== 2);

        // --- Production: Visual feedback on phase change ---
        const mainArea = document.querySelector('.studio-main-area');
        if (mainArea) {
            mainArea.classList.add('phase-change');
            setTimeout(() => mainArea.classList.remove('phase-change'), 400);
        }
        if (btnMain) {
            btnMain.classList.add('anim-beat');
            setTimeout(() => btnMain.classList.remove('anim-beat'), 300);
        }

        const stepsJA = ['待機', '出題', '解答受付', '締め切り', '解答表示', '正解発表', '判定', '結果'];
        const stepEl = document.getElementById('studio-step-display');
        if (stepEl) stepEl.textContent = stepsJA[stepId] || "UNKNOWN";

        const qCount = App.Data.studioQuestions ? App.Data.studioQuestions.length : 0;
        document.getElementById('studio-q-num-display').textContent = `${(App.State.currentQIndex || 0) + 1}/${qCount}`;

        const modeEl = document.getElementById('studio-mode-display');
        if (modeEl && App.Data.currentConfig) modeEl.textContent = this.translateMode(App.Data.currentConfig.mode);

        const q = App.Data.studioQuestions[App.State.currentQIndex];
        if (!q && stepId !== 0) {
            console.error("setStep: Question not found for index", App.State.currentQIndex);
            // Allow Step 0 (Standby) to proceed even if Q is logic is tricky
            // If truly no Q, we might just return, but Step 0 normally handles 'title' display
            return;
        }

        const roomId = App.State.currentRoomId;
        const syncBadge = document.getElementById('studio-player-sync-status');

        switch (stepId) {
            case 0: // タイトル表示
                const currentSet = App.Data.periodPlaylist[App.State.currentPeriodIndex];
                const pTitle = currentSet.title;
                const firstQ = App.Data.studioQuestions[0] || {};

                // Update Simple UI Status
                const stepDisplay = document.getElementById('studio-step-display');
                if (stepDisplay) stepDisplay.textContent = "WAITING / " + pTitle;

                // Show Title Banner above Main Button
                let titleBanner = document.getElementById('studio-title-banner');
                if (!titleBanner) {
                    titleBanner = document.createElement('div');
                    titleBanner.id = 'studio-title-banner';
                    titleBanner.style.cssText = 'background:#ff9800; color:#000; font-weight:900; font-size:1.1em; padding:12px 20px; border-radius:8px; text-align:center; margin-bottom:10px; border:2px solid #f57c00;';
                    btnMain.parentNode.insertBefore(titleBanner, btnMain);
                }
                titleBanner.textContent = `タイトル表示中`;
                titleBanner.classList.remove('hidden');

                // If it's Q1 with title, check if Title should be shown
                if (App.State.currentQIndex === 0) {
                    if (firstQ.isTitleHidden) {
                        titleBanner.classList.add('hidden');
                        this.setStep(1); // Skip Title, go to Q Number
                        return;
                    }
                    if (firstQ.prodDesign) {
                        this.renderProductionMonitor('title', firstQ);
                    } else {
                        this.renderMonitorMessage("", pTitle);
                    }
                } else {
                    this.renderMonitorMessage("", pTitle);
                }

                btnMain.textContent = `第${App.State.currentQIndex + 1}問 開始`;
                btnMain.onclick = () => {
                    // Hide title banner when moving to Q Number step
                    const banner = document.getElementById('studio-title-banner');
                    if (banner) banner.classList.add('hidden');
                    this.setStep(1); // Go to Q Number Step (not Step 2!)
                };
                btnMain.classList.add('action-ready');
                syncBadge.textContent = "WAITING";
                syncBadge.style.background = "#333";

                document.getElementById('studio-execution-grid').classList.remove('hidden');
                this.updateMonitorScaling();
                this.updateNextPreview();
                this.resetPlayerStatus();
                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'standby',
                    qIndex: App.State.currentQIndex,
                    programTitle: pTitle,
                    turnIndex: (App.Data.currentConfig.mode === 'turn' || App.Data.currentConfig.mode === 'solo') ? this.turnIndex : null
                });

                // ★ Turn/Solo Mode: Show order/challenger setup UI on Q1
                if ((App.Data.currentConfig.mode === 'turn' || App.Data.currentConfig.mode === 'solo') && App.State.currentQIndex === 0) {
                    this.renderTurnOrderSetup(btnMain);
                }
                break;

            case 1: // 出題準備 (Question Number Slide)
                if (q.isQNumHidden) {
                    this.setStep(2);
                    return;
                }

                // Update Simple UI Status
                if (document.getElementById('studio-step-display')) {
                    document.getElementById('studio-step-display').textContent = "Q." + (App.State.currentQIndex + 1) + " 準備中";
                }

                btnMain.textContent = "問題を表示する";
                btnMain.classList.add('action-ready');
                btnMain.onclick = () => this.setStep(2);
                syncBadge.textContent = "準備中";
                syncBadge.style.background = "rgba(255, 215, 0, 0.2)";

                if (q.prodDesign) {
                    this.renderProductionMonitor('qnumber', q);
                } else {
                    this.renderMonitorMessage("", `第${App.State.currentQIndex + 1}問`);
                }

                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'reveal_q_num',
                    qIndex: App.State.currentQIndex,
                    qNumLabel: `第${App.State.currentQIndex + 1}問`,
                    turnIndex: (App.Data.currentConfig.mode === 'turn' || App.Data.currentConfig.mode === 'solo') ? this.turnIndex : null
                });
                break;

            case 2: // 出題中 (Question Display)
                // Update Simple UI Status
                if (document.getElementById('studio-step-display')) {
                    document.getElementById('studio-step-display').textContent = "Q." + (App.State.currentQIndex + 1) + " 解答中";
                }

                const currentQ = App.Data.studioQuestions[App.State.currentQIndex];
                if (!currentQ.prodDesign) {
                    this.renderQuestionMonitor(currentQ); // Fallback standard
                } else {
                    this.renderProductionMonitor('question', currentQ);
                }

                const isBuzz = (App.Data.currentConfig.mode === 'buzz');
                const isTurn = (App.Data.currentConfig.mode === 'turn');
                const isSolo = (App.Data.currentConfig.mode === 'solo');

                if (isBuzz) {
                    // Buzz Mode: Start IMMEDIATELY
                    btnMain.textContent = "正解を表示";
                    btnMain.classList.remove('action-ready');
                    btnMain.classList.add('action-next');
                    btnMain.onclick = () => this.setStep(5); // Go to Answer

                    syncBadge.textContent = "BUZZ OPEN";
                    syncBadge.style.background = "#e74c3c";

                    // Use 'answering' step so Player.js shows the buzz button logic
                    window.db.ref(`rooms/${roomId}/status`).update({
                        step: 'answering',
                        qIndex: App.State.currentQIndex,
                        qText: currentQ.q,
                        isBuzzActive: true // Active immediately
                    });

                    // Start time limit for buzz mode too
                    this.startTimeLimit(roomId);

                } else if (isTurn || isSolo) {
                    // Turn/Solo Mode: Only the current turn player can answer
                    // Ensure turnIndex is valid
                    if (this.turnIndex >= this.turnOrder.length) this.turnIndex = 0;

                    const turnPlayerId = this.turnOrder[this.turnIndex];
                    const turnPlayerName = (App.Data.players && App.Data.players[turnPlayerId])
                        ? App.Data.players[turnPlayerId].name : '---';

                    btnMain.textContent = "正解を表示";
                    btnMain.classList.remove('action-ready');
                    btnMain.classList.add('action-next');
                    btnMain.onclick = () => this.setStep(5);

                    if (isSolo) {
                        syncBadge.textContent = `チャレンジャー: ${turnPlayerName}`;
                        syncBadge.style.background = "#9b59b6"; // Solid purple
                    } else {
                        syncBadge.textContent = `解答者: ${turnPlayerName}`;
                        syncBadge.style.background = "rgba(155, 89, 182, 0.3)";
                    }

                    // Show turn info on sub-info area
                    const info = document.getElementById('studio-sub-info');
                    if (info) {
                        info.classList.remove('hidden');
                        if (isSolo) {
                            info.innerHTML = `<span style="color:#9b59b6; font-weight:bold;"><i class="fas fa-crown"></i> ソロチャレンジ中: ${turnPlayerName}</span>`;
                        } else {
                            info.innerHTML = `<span style="color:#9b59b6; font-weight:bold;">順番: ${turnPlayerName}（${this.turnIndex + 1}/${this.turnOrder.length}）</span>`;
                        }
                    }

                    const bjUpdate = {};
                    if (currentQ.type === 'blackjack') {
                        const curTotal = (App.Data.players && App.Data.players[turnPlayerId] && App.Data.players[turnPlayerId].bjTotal) || 0;
                        bjUpdate.bjCards = currentQ.c || [];
                        bjUpdate.bjTarget = currentQ.target || 21;
                        bjUpdate.bjUsedCards = this.bjUsedCards || [];
                        bjUpdate.bjCurrentTotal = curTotal;
                        bjUpdate.bjPickedHistory = this.bjPickedHistory || [];
                    }
                    window.db.ref(`rooms/${roomId}/status`).update({
                        step: 'reveal_q',
                        qIndex: App.State.currentQIndex,
                        qText: currentQ.q,
                        currentAnswerer: turnPlayerId,
                        currentAnswererName: turnPlayerName,
                        turnIndex: this.turnIndex, // Sync turn status
                        isTurnMode: true,
                        ...bjUpdate
                    });

                    // Start time limit for turn/solo mode
                    this.startTimeLimit(roomId);

                } else {
                    // Normal Mode (Unified Flow: Question -> Answer -> Result)
                    btnMain.textContent = "正解を表示";
                    btnMain.onclick = () => this.setStep(5);

                    btnMain.classList.remove('action-ready');
                    btnMain.classList.add('action-next');
                    syncBadge.textContent = "ACTIVE";
                    syncBadge.style.background = "#e74c3c";

                    window.db.ref(`rooms/${roomId}/status`).update({
                        step: 'reveal_q',
                        qIndex: App.State.currentQIndex,
                        qText: currentQ.q
                    });

                    // Start time limit for normal mode
                    this.startTimeLimit(roomId);
                }

                this.updateNextPreview(); // Ensure next is previewed (Answer slide)
                break;

            case 4: // 解答オープン (Result / Responses)
                if (q.isResHidden) {
                    this.goNext();
                    return;
                }

                if (document.getElementById('studio-step-display')) {
                    document.getElementById('studio-step-display').textContent = "Q." + (App.State.currentQIndex + 1) + " 結果発表";
                }

                btnMain.textContent = "次の問題へ";
                btnMain.classList.remove('action-ready');
                btnMain.classList.add('action-next');
                btnMain.onclick = () => this.goNext();

                syncBadge.textContent = "REVEAL";
                syncBadge.style.background = "#9b59b6"; // Purple

                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'reveal_player',
                    qIndex: App.State.currentQIndex
                });
                break;

            case 5: // 正解表示 (Answer)
                if (q.isAnsHidden) {
                    if (App.Data.currentConfig.mode !== 'buzz' && ['choice', 'sort', 'letter_select'].includes(q.type)) {
                        this.judgeSimultaneous();
                    }
                    if (App.Data.currentConfig.mode === 'normal' && q.type === 'free_written' &&
                        (App.Data.currentConfig.answerAttempts || 'single') === 'single') {
                        this.flushPendingResults();
                    }
                    this.setStep(4);
                    return;
                }

                // Update Simple UI Status
                if (document.getElementById('studio-step-display')) {
                    document.getElementById('studio-step-display').textContent = "Q." + (App.State.currentQIndex + 1) + " 正解表示";
                }

                // Show Answer on Monitor
                if (q.prodDesign) {
                    this.renderProductionMonitor('answer', q);
                } else {
                    // Standard text based
                    const corrDisp = document.getElementById('studio-correct-display');
                    if (corrDisp) corrDisp.classList.remove('hidden');
                    document.getElementById('studio-correct-text').textContent = this.getAnswerString(q);
                    document.getElementById('studio-commentary-text').textContent = q.commentary || "";
                }

                btnMain.textContent = "結果発表へ";
                btnMain.classList.remove('action-next');
                btnMain.classList.add('action-ready'); // Ready for next
                btnMain.onclick = () => this.setStep(4);

                syncBadge.textContent = "ANSWER";
                syncBadge.style.background = "#2ecc71";

                // Blackjack: process picked card (or stand) and update bjTotal
                if (q.type === 'blackjack') {
                    const turnPlayerId = this.turnOrder[this.turnIndex];
                    const player = App.Data.players && App.Data.players[turnPlayerId];
                    const rawAnswer = player ? player.lastAnswer : null;
                    const isStand = (rawAnswer === 'stand');
                    const cardIdx = isStand ? NaN : (player ? parseInt(rawAnswer) : NaN);
                    let pickedCardName = '---', pickedCardValue = 0, newTotal = player ? (player.bjTotal || 0) : 0;

                    if (!isStand && !isNaN(cardIdx) && cardIdx >= 0 && cardIdx < (q.c || []).length) {
                        pickedCardName = q.c[cardIdx];
                        pickedCardValue = (q.values || [])[cardIdx] || 0;
                        newTotal = (player.bjTotal || 0) + pickedCardValue;
                        if (!this.bjUsedCards) this.bjUsedCards = [];
                        if (!this.bjUsedCards.includes(cardIdx)) this.bjUsedCards.push(cardIdx);
                        const prevHistory = Array.isArray(player.bjCardHistory) ? player.bjCardHistory : [];
                        window.db.ref(`rooms/${roomId}/players/${turnPlayerId}`).update({
                            bjTotal: newTotal,
                            bjCardHistory: [...prevHistory, { name: pickedCardName, value: pickedCardValue }]
                        });
                    }

                    const turnPlayerName = player ? (player.name || '---') : '---';
                    if (!this.bjPickedHistory) this.bjPickedHistory = [];
                    if (!isStand) {
                        this.bjPickedHistory.push({ name: pickedCardName, value: pickedCardValue, playerName: turnPlayerName });
                    }

                    window.db.ref(`rooms/${roomId}/status`).update({
                        step: 'reveal_correct',
                        qIndex: App.State.currentQIndex,
                        correct: isStand ? `${turnPlayerName}: スタンド` : `${pickedCardName} (+${pickedCardValue})`,
                        commentary: q.commentary || "",
                        bjPickedCard: isStand ? null : pickedCardName,
                        bjPickedValue: pickedCardValue,
                        bjPickedPlayerName: turnPlayerName,
                        bjNewTotal: newTotal,
                        bjTarget: q.target || 21,
                        bjUsedCards: this.bjUsedCards || [],
                        bjPickedHistory: this.bjPickedHistory,
                        bjIsStand: isStand || false
                    });

                    // Show on monitor
                    const corrDisp = document.getElementById('studio-correct-display');
                    if (corrDisp) corrDisp.classList.remove('hidden');
                    document.getElementById('studio-correct-text').textContent = isStand
                        ? `${turnPlayerName}: スタンド`
                        : `${turnPlayerName}: ${pickedCardName} (+${pickedCardValue}) → 合計 ${newTotal}`;
                    document.getElementById('studio-commentary-text').textContent = `目標: ${q.target || 21}`;
                    break;
                }

                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'reveal_correct',
                    qIndex: App.State.currentQIndex,
                    correct: this.getAnswerString(q),
                    commentary: q.commentary || ""
                });

                // Automatic Judging for Choice / Sort / Letter Select (Skip for Buzz or Written)
                if (App.Data.currentConfig.mode !== 'buzz' && ['choice', 'sort', 'letter_select'].includes(q.type)) {
                    this.judgeSimultaneous();
                }

                // ★ Flush pending results for single-attempt free_written
                if (App.Data.currentConfig.mode === 'normal' && q.type === 'free_written' &&
                    (App.Data.currentConfig.answerAttempts || 'single') === 'single') {
                    this.flushPendingResults();
                }
                break;

            // Case 6, 7 removed as they are integrated into Case 5's next action

        }
        this.updateNextPreview();
        this.renderMultiAnswerControls(q);

        // Update Console with current Q and Players
        this.renderUnifiedConsole(App.Data.players || {});

        // Sync button text to console
        this.syncMainButton();
    },

    goNext: function () {
        let nextIdx = App.State.currentQIndex + 1;
        const questions = App.Data.studioQuestions;

        console.log("goNext called. Current:", App.State.currentQIndex, "Total:", questions.length);

        while (nextIdx < questions.length) {
            if (true) {
                console.log("Found next Q at:", nextIdx);
                App.State.currentQIndex = nextIdx;
                this.resetPlayerStatus();

                // ★ Turn Mode: advance turnIndex
                if (App.Data.currentConfig.mode === 'turn' && this.turnOrder.length > 0) {
                    if (!this.turnAdvancedThisQ) {
                        this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
                    }
                    this.turnAdvancedThisQ = false; // Reset for next Q
                }

                // Reset Multi-Answer State
                this.revealedMultiIndices = {};
                // Clear from Firebase immediately to prevent ghost reveals
                const roomId = App.State.currentRoomId;
                if (roomId) {
                    window.db.ref(`rooms/${roomId}/status/revealedMulti`).remove();
                }

                // For Q2+, step 1 is normally Q Number.
                // Q1 checked Title in Step 0.
                const nextStep = (App.State.currentQIndex === 0) ? 0 : 1;
                this.currentStepId = null; // Force re-render

                // Turn/Solo: show player selection screen before each question
                const mode = App.Data.currentConfig?.mode;
                if (mode === 'turn' || mode === 'solo') {
                    this.isTurnOrderConfirmed = false;
                    this.turnSetupDismissed = false;
                    if (mode === 'solo') {
                        this.turnOrder = [];
                    }
                    this.showPreQuizSetup(nextStep);
                } else {
                    this.setStep(nextStep);
                }
                return;
            }
            nextIdx++;
        }

        console.log("No more questions. Finishing set.");
        this.handleSetCompletion();
    },

    handleSetCompletion: function () {
        console.log("Set complete.");

        // Blackjack: announce winner based on bjTotal closest to target
        const isBlackjackSet = (App.Data.studioQuestions || []).some(q => q.type === 'blackjack');
        if (isBlackjackSet) {
            const target = (App.Data.studioQuestions.find(q => q.type === 'blackjack') || {}).target || 21;
            const players = App.Data.players || {};
            let winner = null, bestDiff = Infinity;
            Object.entries(players).forEach(([pid, p]) => {
                const total = p.bjTotal || 0;
                if (total > target) return; // busted
                const diff = target - total;
                if (diff < bestDiff) { bestDiff = diff; winner = { pid, name: p.name, total }; }
            });
            const roomId = App.State.currentRoomId;
            if (roomId) {
                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'bj_result',
                    bjWinner: winner ? winner.name : '(バスト)',
                    bjWinnerTotal: winner ? winner.total : 0,
                    bjTarget: target
                });
            }
        }

        // --- Check if we're inside a container ---
        if (this._activeContainerIndex !== undefined && this._activeContainerIndex !== null) {
            const containerIdx = this._activeContainerIndex;
            const container = App.Data.periodPlaylist[containerIdx];

            if (container && container.type === 'container') {
                // コンテナ内で1つ遊んだら、コンテナ終了とする（他の選択肢はスキップ）
                this._activeContainerChildIndex = null;
                this._activeContainerIndex = null;

                const nextPeriodIdx = containerIdx + 1;
                if (nextPeriodIdx < App.Data.periodPlaylist.length) {
                    App.Ui.showToast("選択コンテナのクイズが終了しました。次に進みます。");
                    this.setupPeriod(nextPeriodIdx);
                    return;
                } else {
                    this.showFinalRankingOption();
                    return;
                }
            }
        }

        const currentSet = App.Data.periodPlaylist[App.State.currentPeriodIndex];
        const progSettings = currentSet ? (currentSet.progSettings || {}) : {};

        // Check if there's a next set
        let nextPeriodIdx = App.State.currentPeriodIndex + 1;
        const hasNextSet = nextPeriodIdx < App.Data.periodPlaylist.length;

        // If ranking is requested after this set AND it's the last set (or explicit ranking pause)
        if (progSettings.showRankingAfter && !hasNextSet) {
            this.showFinalRankingOption();
            return;
        }

        // Advance to next set
        if (hasNextSet) {
            const nextTitle = App.Data.periodPlaylist[nextPeriodIdx].title || "次のセット";
            App.Ui.showToast(`セット完了！→ ${nextTitle}`);
            this.setupPeriod(nextPeriodIdx);
        } else {
            // End of program (no more sets)
            if (progSettings.loopProgram) {
                this.setupPeriod(0);
            } else {
                this.showFinalRankingOption();
            }
        }
    },

    // --- Container Selection UI ---
    // 旧フォーマット(items)を新フォーマット(options)に透過的に変換するヘルパー
    _getContainerOptions: function (container) {
        if (container.options && container.options.length > 0) return container.options;
        // 旧フォーマット backward compat
        if (container.items && container.items.length > 0) {
            return container.items.map((s, i) => ({ label: `${i + 1}番`, set: s }));
        }
        return [];
    },

    showContainerSelection: function (containerIndex) {
        const container = App.Data.periodPlaylist[containerIndex];
        const options = this._getContainerOptions(container);

        if (!container || container.type !== 'container' || options.length === 0) {
            App.Ui.showToast("コンテナに選択肢がありません。次に進みます。");
            const nextIdx = containerIndex + 1;
            if (nextIdx < App.Data.periodPlaylist.length) {
                this.setupPeriod(nextIdx);
            } else {
                this.showFinalRankingOption();
            }
            return;
        }

        this._activeContainerIndex = containerIndex;

        // ビューアー画面に選択状態を送信
        const roomId = App.State.currentRoomId;
        window.db.ref(`rooms/${roomId}/status`).update({
            step: 'selecting_set',
            containerTitle: container.title || '選択コンテナ',
            containerOptions: options.map(opt => opt.label)
        });

        // ホストUI: スタンバイパネルに選択UIを表示（ローダーUIは隠す）
        document.getElementById('studio-execution-grid').classList.add('hidden');
        document.getElementById('studio-loader-ui')?.classList.add('hidden');
        document.getElementById('studio-standby-panel').classList.remove('hidden');

        const btnMain = document.getElementById('btn-phase-main');
        if (btnMain) btnMain.classList.add('hidden');

        const standby = document.getElementById('studio-standby-panel');
        let selArea = document.getElementById('studio-container-selection');
        if (!selArea) {
            selArea = document.createElement('div');
            selArea.id = 'studio-container-selection';
            standby.appendChild(selArea);
        }

        let html = `
            <div style="text-align:center; padding:20px 0 10px;">
                <div style="font-size:1.3em; font-weight:900; color:#ffaa00; margin-bottom:6px;">📦 ${container.title || '選択コンテナ'}</div>
                <div style="font-size:0.85em; color:#aaa; margin-bottom:16px;">選択肢を選んでセットを開始してください</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; padding:0 10px;">
        `;

        options.forEach((opt, ci) => {
            const set = opt.set || {};
            const qCount = set.questions ? set.questions.length : 0;
            const mode = set.config?.mode || 'normal';
            const modeLabel = this.translateMode ? this.translateMode(mode) : mode;

            html += `
                <div onclick="window.App.Studio.startContainerChild(${containerIndex}, ${ci})" style="
                    background: #1a1a1a;
                    border: 2px solid #444;
                    border-radius: 12px;
                    padding: 14px 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                " onmouseover="this.style.borderColor='#ffaa00'; this.style.background='rgba(255,170,0,0.05)'"
                   onmouseout="this.style.borderColor='#444'; this.style.background='#1a1a1a'">
                    <div style="font-size:1.8em; font-weight:900; color:#ffaa00; width:36px; text-align:center; flex-shrink:0;">${ci + 1}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:bold; color:#fff; font-size:1em; margin-bottom:2px;">${opt.label || `${ci + 1}番`}</div>
                        <div style="font-size:0.75em; color:#666;">${set.title || 'Untitled'} / ${qCount}Q / ${modeLabel}</div>
                    </div>
                    <div style="color:#ffaa00; font-size:0.8em; font-weight:bold; border:1px solid #ffaa00; padding:5px 14px; border-radius:20px; flex-shrink:0;">
                        SELECT
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        selArea.innerHTML = html;
        selArea.classList.remove('hidden');

        this.syncMainButton();
    },

    startContainerChild: function (containerIndex, childIndex) {
        const container = App.Data.periodPlaylist[containerIndex];
        const options = this._getContainerOptions(container);

        if (!container || !options[childIndex]) {
            alert("エラー: 選択されたセットが見つかりません。");
            return;
        }

        this._activeContainerIndex = containerIndex;
        this._activeContainerChildIndex = childIndex;

        const child = options[childIndex].set;

        // Hide the selection area
        const selArea = document.getElementById('studio-container-selection');
        if (selArea) selArea.classList.add('hidden');

        // Load the child as if it were a top-level single set
        // We temporarily inject it into the flow
        App.State.currentPeriodIndex = containerIndex; // Keep container as the period index
        if (!child.progSettings) child.progSettings = { showRankingAfter: false, eliminationMode: 'none' };

        let qs = child.questions || [];
        if (!Array.isArray(qs)) qs = Object.values(qs);
        qs = this.shuffleQuestions(qs);
        if (child.config && child.config.shuffleQuestions === true) {
            qs = this.shuffleArray([...qs]);
        }
        App.Data.studioQuestions = qs;
        App.Data.currentConfig = child.config || { mode: 'normal' };
        App.Data.currentConfig.periodTitle = child.title || "Untitled";
        App.State.currentQIndex = 0;

        const roomId = App.State.currentRoomId;
        if (!roomId) {
            alert("エラー: 部屋IDが取得できません。");
            return;
        }

        // Firebase Sync
        window.db.ref(`rooms/${roomId}/config`).set(App.Data.currentConfig);
        window.db.ref(`rooms/${roomId}/questions`).set(App.Data.studioQuestions);

        // UI Prep
        document.getElementById('studio-standby-panel').classList.add('hidden');
        document.getElementById('studio-execution-grid').classList.remove('hidden');

        const panelCtrl = document.getElementById('studio-panel-control');
        if (panelCtrl) {
            if (child.config && child.config.gameType === 'panel') {
                panelCtrl.classList.remove('hidden');
                this.renderPanelControl();
            } else {
                panelCtrl.classList.add('hidden');
            }
        }

        this.renderTimeline();

        if (child.config && child.config.mode === 'solo') {
            document.getElementById('studio-solo-info')?.classList.remove('hidden');
            this.soloState.lives = child.config.soloLife || 3;
            const lifeDisp = document.getElementById('studio-life-display');
            if (lifeDisp) lifeDisp.textContent = this.soloState.lives;
        } else {
            document.getElementById('studio-solo-info')?.classList.add('hidden');
        }

        this.revealedMultiIndices = {};
        this.isTurnOrderConfirmed = false;
        this.turnSetupDismissed = false;
        this.inPreSetup = false;
        this.clearTimeLimit();

        if (App.Data.currentConfig.mode === 'turn' || App.Data.currentConfig.mode === 'solo') {
            this.showPreQuizSetup();
        } else {
            this.setStep(0);
        }
    },

    performElimination: function (settings) {
        const { eliminationMode, eliminationCount } = settings;
        const roomId = App.State.currentRoomId;

        window.db.ref(`rooms/${roomId}/players`).once('value', snap => {
            const players = [];
            snap.forEach(pSnap => {
                const p = pSnap.val();
                if (p.isAlive !== false) players.push({ key: pSnap.key, ...p });
            });

            players.sort((a, b) => b.periodScore - a.score); // periodScore or totalScore depends on rule, usually periodScore for per-set elimination

            let droppedOut = [];
            let survivors = [];

            if (eliminationMode === 'dropout') {
                droppedOut = players.slice(-eliminationCount);
                survivors = players.slice(0, players.length - eliminationCount);
            } else if (eliminationMode === 'survive') {
                survivors = players.slice(0, eliminationCount);
                droppedOut = players.slice(eliminationCount);
            }

            // Update Firebase
            droppedOut.forEach(p => {
                window.db.ref(`rooms/${roomId}/players/${p.key}`).update({ isAlive: false });
            });

            window.db.ref(`rooms/${roomId}/status`).update({
                step: 'elimination',
                eliminationData: {
                    droppedOut: droppedOut.map(p => ({ name: p.name, score: p.periodScore || 0 })),
                    survivors: survivors.map(p => ({ name: p.name, score: p.periodScore || 0 })),
                    mode: eliminationMode,
                    count: eliminationCount
                }
            });
        });
    },

    showFinalRankingOption: function () {
        // Send final ranking to viewer
        window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ step: 'final_ranking' });

        // Wait a moment for the ranking to be seen, then ask
        setTimeout(() => {
            const currentCode = App.State.currentRoomId;
            const reuse = confirm(`全プログラムが終了しました。\n\n現在の部屋コード [${currentCode}] を維持したまま、\n次のクイズ（別のセットやプログラム）を行いますか？\n\n[OK] 維持してクイズ選択画面へ\n[キャンセル] 終了してダッシュボードへ`);

            if (reuse) {
                // Reuse Room: Store ID and go to selection
                App.State.reuseRoomId = currentCode;
                App.Ui.showToast(`部屋 [${currentCode}] を維持します。次のクイズを選択してください。`);

                // Navigate to Saved Items (Quiz Selection)
                // Ensure App.Dashboard is available. It usually is.
                if (App.Dashboard && App.Dashboard.openSavedItems) {
                    App.Dashboard.openSavedItems();
                } else {
                    console.error("Dashboard entry point not found");
                    App.Ui.showView('view-dashboard'); // Fallback
                }
            } else {
                // Finish completely
                App.Ui.showToast("全プログラム終了！ダッシュボードに戻ります");
                App.Dashboard.enter();
            }
        }, 1200);
    },

    showNextSetWait: function (nextIdx) {
        document.getElementById('studio-execution-grid').classList.add('hidden');
        document.getElementById('studio-standby-panel').classList.remove('hidden');
        const btn = document.getElementById('btn-phase-main');
        btn.textContent = `次のセットを開始 (${App.Data.periodPlaylist[nextIdx].title})`;
        btn.classList.remove('hidden');
        btn.className = 'btn-block btn-large-action action-ready';
        btn.onclick = () => this.setupPeriod(nextIdx);
        this.syncMainButton();
    },

    resetPlayerStatus: function () {
        const roomId = App.State.currentRoomId;
        this.revealedMultiIndices = {}; // Reset multi-answer reveal state
        this.turnAdvancedThisQ = false; // Reset turn flag for current question

        // Reset local state to prevent "stuck" buzzer winners from previous questions
        this.buzzWinner = null;
        this.selectedPlayerId = null;

        // Reset judge queue
        this.judgeQueue = [];
        this.judgeCurrentRevealed = false;
        this.renderJudgeQueue();

        if (document.getElementById('console-multi-controls')) {
            document.getElementById('console-multi-controls').innerHTML = '';
            document.getElementById('console-multi-controls').classList.add('hidden');
        }

        // Reset global status for new question
        window.db.ref(`rooms/${roomId}/status`).update({
            currentAnswerer: null,
            currentAnswererName: null,
            isBuzzActive: false, // Will be re-enabled by setStep if needed
            takenChoices: null   // Reset taken choices for next question
        });

        window.db.ref(`rooms/${roomId}/players`).once('value', snap => {
            snap.forEach(p => {
                const pVal = p.val();
                const updates = {
                    lastAnswer: null,
                    lastResult: null,
                    pendingResult: null,
                    pendingScore: null,
                    buzzTime: null,
                    answerTime: null,
                    buzzBannedUntil: null
                };
                // Decrement buzzRest if player is serving rest penalty
                if (pVal && pVal.buzzRest && pVal.buzzRest > 0) {
                    updates.buzzRest = pVal.buzzRest - 1;
                }
                p.ref.update(updates);
            });
        });
    },

    renderMonitorMessage: function (label, text) {
        try {
            // Implementation remains same, but we reuse renderProductionMonitor logic internally if needed
            const qEl = document.getElementById('studio-q-text');
            if (qEl) {
                qEl.innerHTML = `
                    <div style="display:flex; justify-content:center; align-items:center; height:100%; width:100%;">
                        <div style="font-size:2.5em; color:#ffd700; font-weight:bold; text-shadow:0 0 10px rgba(0,0,0,0.5); text-align:center; padding:0 30px;">
                            ${text}
                        </div>
                    </div>
                `;
            }
            const badge = document.getElementById('studio-q-type-badge');
            if (badge) badge.textContent = label || "";
            if (document.getElementById('studio-choices-container')) document.getElementById('studio-choices-container').innerHTML = '';
            if (document.getElementById('studio-correct-display')) document.getElementById('studio-correct-display').classList.add('hidden');
            if (document.getElementById('studio-question-panel')) {
                document.getElementById('studio-question-panel').style.backgroundImage = 'none';
                document.getElementById('studio-question-panel').style.backgroundColor = '#000';
            }
            this.updateMonitorScaling();
        } catch (e) { console.error("Render Monitor Error:", e); }
    },

    renderProductionMonitor: function (type, q) {
        // Simplified for Host View: Just text summary
        const qEl = document.getElementById('studio-q-text');
        if (!qEl) return;

        let text = "";
        if (type === 'title') {
            // Show only the title text as defined in design, or fallback to period title
            text = (q.prodDesign && q.prodDesign.titleText) || App.Data.currentConfig.periodTitle;
        } else if (type === 'qnumber') {
            // Show only the Q# text as defined in design, or fallback to simple Q index
            text = (q.prodDesign && q.prodDesign.qNumberText) || `Q${App.State.currentQIndex + 1}`;
        }

        qEl.innerHTML = `<div style="padding:20px; font-size:1.5em; text-align:center; color:#fff; font-weight:bold;">${text}</div>`;
        if (document.getElementById('studio-choices-container')) document.getElementById('studio-choices-container').innerHTML = '';

        // Remove styling
        const panel = document.getElementById('studio-question-panel');
        if (panel) {
            panel.style.background = 'transparent';
            panel.removeAttribute('style');
        }
    },

    renderQuestionMonitor: function (q) {
        if (!q) return;

        try {
            const qEl = document.getElementById('studio-q-text');
            const cContainer = document.getElementById('studio-choices-container');
            const panel = document.getElementById('studio-question-panel');

            if (!qEl || !cContainer || !panel) return;

            // Reset Styles
            panel.removeAttribute('style');
            panel.style.padding = '0';
            panel.style.background = 'transparent';

            // Question Text
            qEl.style.fontSize = '1.4em';
            qEl.style.fontWeight = 'bold';
            qEl.style.marginBottom = '15px';
            qEl.style.color = '#fff';
            qEl.style.textAlign = 'left';
            qEl.style.writingMode = 'horizontal-tb';
            qEl.style.width = '100%';
            qEl.style.height = 'auto';
            qEl.style.border = 'none';
            qEl.textContent = `Q. ${q.q}`;

            // Clear previous choices
            cContainer.innerHTML = '';
            cContainer.style.display = 'block';
            cContainer.style.width = '100%';

            // Choices Container
            const container = document.createElement('div');
            container.style.color = '#ccc';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.background = 'transparent';

            if (q.c && q.c.length > 0) {
                // Determine layout
                const isGrid = (q.c.length > 4);
                if (isGrid) {
                    container.style.display = 'grid';
                    container.style.gridTemplateColumns = '1fr 1fr';
                    container.style.gap = '8px';
                }

                q.c.forEach((choice, i) => {
                    const chDiv = document.createElement('div');
                    chDiv.style.padding = '8px 12px';
                    chDiv.style.background = '#333';
                    chDiv.style.marginBottom = isGrid ? '0' : '5px';
                    chDiv.style.borderRadius = '4px';
                    chDiv.style.fontSize = '0.9em';
                    chDiv.textContent = `${i + 1}. ${choice}`;
                    container.appendChild(chDiv);
                });
            } else {
                if (q.type === 'sort') {
                    container.textContent = "(並べ替え問題)";
                }
            }
            cContainer.appendChild(container);

            // Correct Answer Display (Simple) - Hidden by default, shown later
            const ansDiv = document.createElement('div');
            ansDiv.id = 'studio-correct-display';
            ansDiv.className = 'hidden';
            ansDiv.style.marginTop = '20px';
            ansDiv.style.padding = '10px';
            ansDiv.style.background = '#222';
            ansDiv.style.borderLeft = '4px solid ' + ((q.mode === 'dobon' || q.mode === 'multi' || q.multi) ? '#ff5555' : '#2ecc71');

            const ansLabel = document.createElement('div');
            ansLabel.className = 'label';
            ansLabel.style.fontSize = '0.8em';
            ansLabel.style.color = '#888';
            ansLabel.textContent = (q.mode === 'dobon' || q.mode === 'multi' || q.multi) ? "トラップ (不正解)" : "正解";

            const ansText = document.createElement('div');
            ansText.id = 'studio-correct-text';
            ansText.style.fontSize = '1.2em';
            ansText.style.fontWeight = 'bold';
            ansText.style.color = '#fff';
            ansText.textContent = this.getAnswerString ? this.getAnswerString(q) : "??";

            ansDiv.appendChild(ansLabel);
            ansDiv.appendChild(ansText);

            // Append Correct Answer Display to cContainer or main container?
            // Usually hidden initially.
            // Let's attach it to cContainer for now so it exists in DOM if needed?
            // Wait, previous code attached it to `container` or `cContainer`.
            // Let's attach to cContainer.
            cContainer.appendChild(ansDiv);

            this.updateMonitorScaling();
        } catch (e) {
            console.error("Render Question Monitor Error:", e);
        }
    },
    toggleMultiAnswer: function (index) {
        const roomId = App.State.currentRoomId;
        const q = App.Data.studioQuestions[App.State.currentQIndex];
        if (!q || !(q.type.startsWith('multi') || q.type.startsWith('ranking') || q.type.startsWith('assoc'))) return;

        this.revealedMultiIndices = this.revealedMultiIndices || {};
        this.revealedMultiIndices[index] = !this.revealedMultiIndices[index];

        // Update Firebase
        window.db.ref(`rooms/${roomId}/status`).update({
            revealedMulti: this.revealedMultiIndices
        });

        // Re-render simplified host view (if any)
        this.renderQuestionMonitor(q);
        // Re-render controls
        this.renderMultiAnswerControls(q);
    },

    renderMultiAnswerControls: function (q) {
        let container = document.getElementById('console-multi-controls');
        if (!container) return;

        container.innerHTML = '';
        if (!q || !(q.type.startsWith('multi') || q.type.startsWith('ranking') || q.type.startsWith('assoc')) || !q.c) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        this.revealedMultiIndices = this.revealedMultiIndices || {};

        q.c.forEach((choice, i) => {
            const btn = document.createElement('button');
            const isRevealed = !!this.revealedMultiIndices[i];

            btn.className = isRevealed ? 'btn btn-success' : 'btn btn-dark';
            btn.style.minWidth = '40px';
            btn.style.height = 'auto'; // Auto height for text
            btn.style.minHeight = '40px';
            btn.style.fontWeight = 'bold';
            btn.style.fontSize = '0.9em';
            btn.style.padding = '5px 10px';
            btn.style.whiteSpace = 'normal'; // Allow wrapping

            let indexLabel = `${i + 1}`;
            if (q.type.startsWith('ranking')) indexLabel = `${i + 1}位`;
            else if (q.type.startsWith('assoc')) indexLabel = `ヒント${i + 1}`;

            // Show number AND text
            btn.innerHTML = `<span style="font-size:0.8em; opacity:0.7; display:block; margin-bottom:2px;">${indexLabel}</span>${choice}`;

            btn.title = choice;
            btn.style.flex = "1 0 120px"; // Flexible width with min-basis

            btn.onclick = () => this.toggleMultiAnswer(i);
            container.appendChild(btn);
        });
    },

    renderPanelControl: function () {
        const grid = document.getElementById('studio-panel-grid');
        if (!grid) return;

        grid.innerHTML = '';
        this.panelState.forEach((color, i) => {
            const btn = document.createElement('button');
            btn.className = 'panel-editor-cell';
            btn.textContent = i + 1;
            btn.dataset.index = i;
            if (color === 1) btn.classList.add('bg-red');
            else if (color === 2) btn.classList.add('bg-green');
            else if (color === 3) btn.classList.add('bg-white');
            else if (color === 4) btn.classList.add('bg-blue');

            btn.onclick = () => {
                this.panelState[i] = this.selectedPanelColor;
                this.renderPanelControl();
                window.db.ref(`rooms/${App.State.currentRoomId}/status/panels`).set(this.panelState);
                window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ step: 'panel' });
            };
            grid.appendChild(btn);
        });
    },

    setPanelColor: function (colorCode) {
        this.selectedPanelColor = colorCode;
        const names = ["クリア(黒)", "Red", "Green", "White", "Blue"];
        const disp = document.getElementById('panel-selected-color');
        if (disp) disp.textContent = names[colorCode];
        document.querySelectorAll('.p-btn').forEach(b => b.style.border = '1px solid #555');
    },

    checkBuzz: function (players) {
        if (this.currentStepId !== 2 || this.buzzWinner) return;
        const candidates = Object.entries(players).filter(([_, p]) =>
            p.buzzTime && !p.lastResult &&
            !(p.buzzRest && p.buzzRest > 0) &&
            !(p.buzzBannedUntil && p.buzzBannedUntil > Date.now())
        ).sort((a, b) => a[1].buzzTime - b[1].buzzTime);
        if (candidates.length > 0) {
            this.buzzWinner = candidates[0][0];
            const name = candidates[0][1].name;
            const info = document.getElementById('studio-sub-info');
            info.classList.remove('hidden');
            info.innerHTML = `<span style="color:orange; font-weight:bold;">早押し: ${name}</span>`;
            info.classList.add('anim-pop-in');
            setTimeout(() => info.classList.remove('anim-pop-in'), 400);
            window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ currentAnswerer: this.buzzWinner, currentAnswererName: name, isBuzzActive: false });
        }
    },

    judgeBuzz: function (isCorrect) {
        if (App.Data.currentConfig.mode === 'solo') { this.judgeSolo(isCorrect); return; }
        if (!this.buzzWinner) return;

        const roomId = App.State.currentRoomId;
        const pts = App.Data.studioQuestions[App.State.currentQIndex].points || 1;
        const action = App.Data.currentConfig.buzzWrongAction || 'reset'; // ★設定確認

        window.db.ref(`rooms/${roomId}/players/${this.buzzWinner}`).once('value', snap => {
            const p = snap.val();
            if (isCorrect) {
                // 正解時
                const winnerId = this.buzzWinner;
                snap.ref.update({ periodScore: (p.periodScore || 0) + pts, lastResult: 'win' });
                document.getElementById('studio-sub-info').classList.add('hidden');

                // パネルモードの場合はパネル選択へ
                if (App.Data.currentConfig.gameType === 'panel') {
                    this.showPanelSelection(winnerId);
                } else {
                    this.setStep(4);
                }
                this.buzzWinner = null;
            } else {
                // 不正解時
                const loss = App.Data.studioQuestions[App.State.currentQIndex].loss || 0;
                snap.ref.update({
                    lastResult: 'lose',
                    buzzTime: null,
                    periodScore: (p.periodScore || 0) - loss,
                    totalScore: (p.totalScore || 0) - loss
                });

                if (action === 'end') {
                    // その問題終了: 全員の解答権を無しにして正解発表へ
                    this.buzzWinner = null;
                    document.getElementById('studio-sub-info').classList.add('hidden');
                    window.db.ref(`rooms/${roomId}/status`).update({
                        currentAnswerer: null,
                        isBuzzActive: false
                    });
                    App.Ui.showToast("誤答 → この問題を終了します");
                    this.setStep(4); // Go to reveal
                } else {
                    // 問題継続 (next): 誤答者はそのまま除外、他のプレイヤーは引き続きBuzz可能
                    this.buzzWinner = null;
                    document.getElementById('studio-sub-info').classList.add('hidden');
                    window.db.ref(`rooms/${roomId}/status`).update({ currentAnswerer: null, isBuzzActive: true });
                    App.Ui.showToast("誤答 → 他のプレイヤーに解答権が移ります");
                }
            }
        });
    },

    judgeSolo: function (isCorrect) {
        if (isCorrect) { this.setStep(5); } else {
            this.soloState.lives--;
            document.getElementById('studio-life-display').textContent = this.soloState.lives;
            if (this.soloState.lives <= 0) alert("ゲームオーバー");
        }
    },

    judgeSimultaneous: function () {
        const q = App.Data.studioQuestions[App.State.currentQIndex];
        window.db.ref(`rooms/${App.State.currentRoomId}/players`).once('value', snap => {
            snap.forEach(pSnap => {
                const p = pSnap.val();
                let isCor = false;

                // Skip if already judged
                if (p.lastResult) return;
                // Unanswered → treat as incorrect (fall through with isCor = false)
                if (p.lastAnswer === null || p.lastAnswer === undefined) {
                    const loss = q.loss || 0;
                    pSnap.ref.update({
                        periodScore: (p.periodScore || 0) - loss,
                        totalScore: (p.totalScore || 0) - loss,
                        lastResult: 'lose'
                    });
                    return;
                }

                if (q.type === 'choice') {
                    // Check both Q-specific mode and Global Config mode
                    if (q.mode === 'dobon' || q.mode === 'multi' || q.multi || App.Data.currentConfig.mode === 'dobon') {
                        const ansIdx = parseInt(p.lastAnswer);
                        // Dobon: q.correct stores traps. If match -> Lose. Else -> Win.
                        if (Array.isArray(q.correct) && q.correct.includes(ansIdx)) {
                            isCor = false;
                        } else {
                            isCor = true;
                        }
                    } else {
                        // Normal Choice: Compare loosely (string vs number)
                        if (Array.isArray(q.correct)) {
                            // If correct answers are multiple (e.g. any of these), or exact match required?
                            // Usually "choice" implies single selection unless multi-select UI.
                            // Assuming single selection vs single correct index.
                            // If q.correct is array [0, 2] -> if p.lastAnswer is in array -> True (OR logic)
                            // or exact match (AND logic)? Usually OR for standard quiz unless specified.
                            // Let's assume loosely equal to one of them.
                            if (q.correct.some(c => c == p.lastAnswer)) isCor = true;
                        } else {
                            if (p.lastAnswer == q.correct) isCor = true;
                        }
                    }
                } else if (q.type === 'letter_select') {
                    let correctStr = q.steps ? q.steps.map(s => s.correct).join('') : q.correct;
                    if (p.lastAnswer === correctStr) isCor = true;
                } else if (q.type === 'sort') {
                    // Normalize both to strings for comparison
                    let correctStr = Array.isArray(q.correct) ? q.correct.map(idx => String.fromCharCode(65 + idx)).join('') : q.correct;
                    if (p.lastAnswer === correctStr) isCor = true;
                } else {
                    // Simple equality
                    if (p.lastAnswer == q.correct) isCor = true;
                }

                if (isCor) {
                    const pts = q.points || 1;
                    pSnap.ref.update({
                        periodScore: (p.periodScore || 0) + pts,
                        totalScore: (p.totalScore || 0) + pts,
                        lastResult: 'win'
                    });
                } else {
                    const loss = q.loss || 0;
                    pSnap.ref.update({
                        periodScore: (p.periodScore || 0) - loss,
                        totalScore: (p.totalScore || 0) - loss,
                        lastResult: 'lose'
                    });
                }
            });
        });
    },

    judgeBuzzAuto: function (playerId, player, q) {
        if (!player || !q) return;
        let isCor = false;
        const ans = player.lastAnswer;
        const roomId = App.State.currentRoomId;

        // Special Dobon Logic
        const isDobon = (q.type === 'choice' && (q.mode === 'dobon' || q.mode === 'multi' || q.multi));

        if (isDobon) {
            const ansIdx = parseInt(ans);
            if (Array.isArray(q.correct) && q.correct.includes(ansIdx)) {
                isCor = false; // Hit the trap
            } else {
                isCor = true; // Safe
            }

            // Add to taken choices (fire and forget update for speed + consistency via queue order)
            if (roomId) {
                const statusRef = window.db.ref(`rooms/${roomId}/status/takenChoices`);
                statusRef.transaction((current) => {
                    const list = current || [];
                    if (!list.includes(ansIdx)) list.push(ansIdx);
                    return list;
                });
            }
        } else if (q.type === 'choice') {
            if (Array.isArray(q.correct)) {
                if (q.correct.some(c => c == ans)) isCor = true;
            } else {
                if (ans == q.correct) isCor = true;
            }
        } else if (q.type === 'sort') {
            let correctStr = Array.isArray(q.correct) ? q.correct.map(idx => String.fromCharCode(65 + idx)).join('') : q.correct;
            if (ans === correctStr) isCor = true;
        } else if (q.type === 'letter_select') {
            let correctStr = q.steps ? q.steps.map(s => s.correct).join('') : q.correct;
            if (ans === correctStr) isCor = true;
        } else {
            // Default
            if (ans == q.correct) isCor = true;
        }

        // Apply judgement
        if (App.Data.currentConfig.mode === 'buzz') {
            this.buzzWinner = playerId;
            this.judgeBuzz(isCor);
        } else {
            // Force update for Turn/Solo mode
            this.updatePlayerScore(playerId, isCor);
        }
    },

    getAnswerString: function (q) {
        if (!q) return "";
        if (q.type === 'choice' && q.c) {
            if (Array.isArray(q.correct)) return q.correct.map(i => q.c[i]).join(' / ');
            const idx = q.correctIndex !== undefined ? q.correctIndex : q.correct;
            return q.c[idx];
        }
        if (q.type === 'letter_select') return q.steps ? q.steps.map(s => s.correct).join('') : q.correct;
        if (q.type === 'sort') {
            if (Array.isArray(q.correct)) return q.correct.map(idx => q.c[idx]).join(' → ');
            if (typeof q.correct === 'string') return q.correct.split('').map(char => q.c[char.charCodeAt(0) - 65]).join(' → ');
        }
        return Array.isArray(q.correct) ? q.correct.join(' / ') : q.correct;
    },

    toggleAns: function () { document.getElementById('studio-correct-display').classList.toggle('hidden'); },

    renderRealtimeAnswers: function (players) {
        const area = document.getElementById('studio-player-answers');
        if (!area) return;
        area.innerHTML = '';

        const q = App.Data.studioQuestions[App.State.currentQIndex];
        const playerIds = Object.keys(players);
        let answeredCount = 0;

        playerIds.forEach(id => {
            const p = players[id];
            const card = document.createElement('div');
            card.className = 'player-ans-card';

            let ansText = "WAITING...";
            let isAnswered = false;

            if (p.lastAnswer !== null && p.lastAnswer !== undefined) {
                isAnswered = true;
                answeredCount++;
                card.classList.add('has-answered');

                // If in "reveal" phase, show the answer. Otherwise hide it from host if desired?
                // Actually user said "司会者側でリアルタイムで把握できた方がいい"
                // Usually host wants to see if they've answered, but maybe not the content until flip to keep it exciting?
                // But for now let's keep showing the content as it was, but more prominent.
                if (q && q.type === 'choice') {
                    if (Array.isArray(p.lastAnswer)) {
                        ansText = p.lastAnswer.map(i => String.fromCharCode(65 + parseInt(i))).join(', ');
                    } else {
                        const idx = parseInt(p.lastAnswer);
                        ansText = isNaN(idx) ? p.lastAnswer : String.fromCharCode(65 + idx);
                    }
                } else {
                    ansText = p.lastAnswer;
                }
            }

            const checkHtml = isAnswered ? '<span class="answered-badge">✅</span>' : '<span class="waiting-dot">●</span>';

            // Pending result indicator (single-attempt mode)
            let pendingBadge = '';
            let showJudgeBtns = isAnswered;
            if (p.buzzRest && p.buzzRest > 0) {
                pendingBadge = `<span style="color:#ff9800; font-weight:bold; font-size:0.8em; margin-left:5px;">🚫 ${p.buzzRest}問休み</span>`;
                showJudgeBtns = false;
            } else if (p.pendingResult === 'win') {
                pendingBadge = '<span style="color:#2ecc71; font-weight:bold; font-size:0.8em; margin-left:5px;">〇 済</span>';
                showJudgeBtns = false;
            } else if (p.pendingResult === 'lose') {
                pendingBadge = '<span style="color:#e74c3c; font-weight:bold; font-size:0.8em; margin-left:5px;">✖ 済</span>';
                showJudgeBtns = false;
            }
            // Also hide buttons if already judged (lastResult set)
            if (p.lastResult) showJudgeBtns = false;

            card.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:5px; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="player-ans-name" style="flex:1;">${p.name}${pendingBadge}</span>
                        ${checkHtml}
                    </div>
                    <div class="player-ans-value ${!isAnswered ? 'waiting' : ''}" style="margin-top:2px;">${ansText}</div>
                    <div class="judge-btns-mini ${showJudgeBtns ? '' : 'hidden'}" style="display:flex; gap:5px; margin-top:8px;">
                        <button class="btn-mini btn-success" style="flex:1; padding:4px 0;" onclick="App.Studio.updatePlayerScore('${id}', true)">〇</button>
                        <button class="btn-mini btn-danger" style="flex:1; padding:4px 0;" onclick="App.Studio.updatePlayerScore('${id}', false)">✖</button>
                    </div>
                </div>
            `;
            area.appendChild(card);
        });

        const total = playerIds.length;
        this.updateStatsBar(answeredCount, total);
    },

    renderUnifiedConsole: function (players) {
        const horizontalList = document.getElementById('console-player-horizontal-list');
        const cardQ = document.getElementById('console-card-question');
        const cardCorrect = document.getElementById('console-card-correct');

        if (!horizontalList) return;

        // Current Question Info
        const q = App.Data.studioQuestions[App.State.currentQIndex];
        if (q && cardQ) {
            // Truncate if too long?
            cardQ.textContent = q.q || "(No Text)";
        }
        if (q && cardCorrect) {
            cardCorrect.innerHTML = ""; // Clear previous content

            // Reset layout for normal questions
            cardCorrect.parentNode.style.flexDirection = 'row';
            cardCorrect.parentNode.style.alignItems = 'center';

            if (q.type.startsWith('multi') || q.type.startsWith('ranking') || q.type.startsWith('assoc')) {
                // Multi-answer / Assoc: manual reveal buttons with improved UI

                // Adjust Parent Layout for Multi-Answer
                cardCorrect.parentNode.style.flexDirection = 'column';
                cardCorrect.parentNode.style.alignItems = 'stretch';

                // For assoc, the hints are in q.c. For multi/ranking, correct answers are in q.correct (often same as q.c)
                const isAssoc = q.type.startsWith('assoc');
                const correctList = isAssoc ? q.c : (Array.isArray(q.correct) ? q.correct : [q.correct]);

                // Wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'multi-ans-wrapper';

                // Scroll Container
                const container = document.createElement('div');
                container.className = 'multi-ans-container';

                if (isAssoc) {
                    const ansHeader = document.createElement('div');
                    ansHeader.style.padding = '8px 12px';
                    ansHeader.style.background = 'rgba(255, 255, 255, 0.1)';
                    ansHeader.style.marginBottom = '5px';
                    ansHeader.style.borderRadius = '5px';
                    ansHeader.style.fontWeight = 'bold';
                    ansHeader.innerHTML = `<span style="color:#aaa; font-size:0.8em;">正解キーワード</span><br/>${q.correct}`;
                    container.appendChild(ansHeader);
                }

                correctList.forEach((ans, idx) => {
                    const item = document.createElement('div');
                    const isRevealed = !!(this.revealedMultiIndices && this.revealedMultiIndices[idx]);

                    item.className = 'multi-ans-item' + (isRevealed ? ' revealed' : '');

                    const isRanking = q.type.startsWith('ranking');
                    const idxLabel = isRanking ? `${idx + 1}位` : (isAssoc ? `ヒント${idx + 1}` : `${idx + 1}`);

                    // Internal Structure: Index | Text | Check
                    item.innerHTML = `
                        <div class="multi-ans-idx">${idxLabel}</div>
                        <div class="multi-ans-text" title="${ans}">${ans}</div>
                        <div class="multi-ans-check">✓</div>
                    `;

                    item.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleMultiAnswer(idx);

                        // Local Toggle
                        const newStatus = !!(this.revealedMultiIndices && this.revealedMultiIndices[idx]);
                        if (newStatus) {
                            item.classList.add('revealed');
                        } else {
                            item.classList.remove('revealed');
                        }
                    };
                    container.appendChild(item);
                });

                wrapper.appendChild(container);
                cardCorrect.appendChild(wrapper);

            } else {
                // Single Answer (Normal)
                cardCorrect.textContent = this.getAnswerString(q) || "---";
            }
        }

        // Sort players by answerTime/buzzTime
        const playerIds = Object.keys(players);
        const sortedPlayers = playerIds
            .map(id => ({ id, ...players[id] }))
            // .filter(p => p.lastAnswer !== null || p.buzzTime) // REMOVED: Show all players for manual judging
            .sort((a, b) => {
                const timeA = a.answerTime || a.buzzTime || Infinity;
                const timeB = b.answerTime || b.buzzTime || Infinity;
                return timeA - timeB;
            });

        horizontalList.innerHTML = '';
        sortedPlayers.forEach(p => {
            const chip = document.createElement('div');
            chip.className = 'console-player-chip';
            chip.textContent = p.name;
            horizontalList.appendChild(chip);
        });

        // Update judge queue: add new answerers who haven't been judged yet
        const q = App.Data.studioQuestions[App.State.currentQIndex];
        const needsManualJudge = q && (
            q.type === 'free_written' ||
            q.type === 'assoc_written' ||
            q.type === 'multi_written' ||
            q.type === 'ranking_written' ||
            q.type === 'free_oral' ||
            q.type === 'multi_oral'
        );
        if (needsManualJudge) {
            const inQueue = new Set(this.judgeQueue.map(e => e.id));
            sortedPlayers.forEach(p => {
                if (
                    (p.lastAnswer !== null && p.lastAnswer !== undefined) &&
                    !p.lastResult &&
                    !inQueue.has(p.id)
                ) {
                    this.judgeQueue.push({ id: p.id, name: p.name, answer: p.lastAnswer });
                    inQueue.add(p.id);
                }
            });
            this.renderJudgeQueue();
        }
    },

    renderJudgeQueue: function () {
        const area = document.getElementById('judge-queue-area');
        if (!area) return;

        const q = this.judgeQueue;
        if (q.length === 0) {
            area.classList.add('hidden');
            area.innerHTML = '';
            return;
        }

        area.classList.remove('hidden');

        const current = q[0];
        const next    = q[1] || null;

        area.innerHTML = `
            <div class="jq-label">判定キュー</div>
            <div class="jq-row">
                <div class="jq-panel jq-current" id="jq-current-panel">
                    <div class="jq-tag">判定中</div>
                    <div class="jq-name">${this._esc(current.name)}</div>
                </div>
                ${next ? `
                <div class="jq-panel jq-next">
                    <div class="jq-tag jq-tag-next">NEXT</div>
                    <div class="jq-name jq-name-next">${this._esc(next.name)}</div>
                </div>` : '<div class="jq-panel jq-next jq-empty"></div>'}
                <div class="jq-panel jq-answer" id="jq-answer-panel">
                    <div class="jq-tag">解答</div>
                    <div class="jq-answer-text" id="jq-answer-text">
                        ${this.judgeCurrentRevealed ? this._esc(String(current.answer)) : '<span class="jq-hidden">タップで開示</span>'}
                    </div>
                </div>
                <div class="jq-panel jq-buttons">
                    <div class="jq-tag">判定</div>
                    <div class="jq-btn-row">
                        <button class="jq-btn jq-btn-o ${this.judgeCurrentRevealed ? '' : 'jq-btn-disabled'}" id="jq-btn-o">〇</button>
                        <button class="jq-btn jq-btn-x ${this.judgeCurrentRevealed ? '' : 'jq-btn-disabled'}" id="jq-btn-x">✕</button>
                    </div>
                </div>
            </div>
        `;

        // Tap current panel → reveal answer
        const currentPanel = document.getElementById('jq-current-panel');
        const answerPanel  = document.getElementById('jq-answer-panel');
        const revealToggle = () => {
            if (this.judgeCurrentRevealed) return;
            this.judgeCurrentRevealed = true;
            this.renderJudgeQueue();
        };
        if (currentPanel) currentPanel.addEventListener('click', revealToggle);
        if (answerPanel)  answerPanel.addEventListener('click',  revealToggle);

        // Judge buttons
        const btnO = document.getElementById('jq-btn-o');
        const btnX = document.getElementById('jq-btn-x');
        if (btnO && !btnO.classList.contains('jq-btn-disabled')) {
            btnO.addEventListener('click', (e) => {
                e.stopPropagation();
                this.advanceJudgeQueue(current.id, true);
            });
        }
        if (btnX && !btnX.classList.contains('jq-btn-disabled')) {
            btnX.addEventListener('click', (e) => {
                e.stopPropagation();
                this.advanceJudgeQueue(current.id, false);
            });
        }
    },

    advanceJudgeQueue: function (playerId, isCorrect) {
        this.updatePlayerScore(playerId, isCorrect);
        // Remove from head of queue after a short delay for visual feedback
        setTimeout(() => {
            this.judgeQueue = this.judgeQueue.filter(e => e.id !== playerId);
            this.judgeCurrentRevealed = false;
            this.renderJudgeQueue();
        }, 300);
    },

    _esc: function (str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    updateStatsBar: function (answeredCount, total) {
        const countEl = document.getElementById('studio-answered-count');
        const progressEl = document.getElementById('studio-answer-progress');
        if (countEl) countEl.textContent = `${answeredCount} / ${total}`;
        if (progressEl) {
            const percent = total > 0 ? (answeredCount / total) * 100 : 0;
            progressEl.style.width = `${percent}%`;
        }
    },

    updatePlayerScore: function (playerId, isCorrect) {
        const roomId = App.State.currentRoomId;
        const q = App.Data.studioQuestions[App.State.currentQIndex];
        if (!q) return;

        const config = App.Data.currentConfig || {};
        const isNormalFreeWritten = (config.mode === 'normal' && q.type === 'free_written');
        const answerAttempts = config.answerAttempts || 'single';

        window.db.ref(`rooms/${roomId}/players/${playerId}`).once('value', snap => {
            const p = snap.val();
            if (!p) return;
            const pts = isCorrect ? (q.points || 1) : -(q.loss || 0);
            const result = isCorrect ? 'win' : 'lose';

            if (isNormalFreeWritten && answerAttempts === 'single') {
                // ★ Single attempt mode: store as pending, don't reveal to player yet
                snap.ref.update({
                    pendingScore: pts,
                    pendingResult: result
                });
                App.Ui.showToast(`${p.name} → ${isCorrect ? '〇' : '✖'} (正解表示時に反映)`);

            } else if (isNormalFreeWritten && answerAttempts === 'multiple') {
                // ★ Multiple attempts mode: apply immediately
                snap.ref.update({
                    periodScore: (p.periodScore || 0) + pts,
                    totalScore: (p.totalScore || 0) + pts,
                    lastResult: result
                });
                App.Ui.showToast(`${p.name} さんを ${isCorrect ? '正解' : '不正解'} に判定しました`);

                // If wrong, reset after a short delay so player can try again
                if (!isCorrect) {
                    setTimeout(() => {
                        snap.ref.update({
                            lastAnswer: null,
                            lastResult: null
                        });
                    }, 2000);
                }

            } else {
                // Default behavior for all other modes
                snap.ref.update({
                    periodScore: (p.periodScore || 0) + pts,
                    totalScore: (p.totalScore || 0) + pts,
                    lastResult: result
                });
                App.Ui.showToast(`${p.name} さんを ${isCorrect ? '正解' : '不正解'} に判定しました`);
            }

            // ★ Multi-Answer Auto-Reveal Logic
            if (isCorrect && q.type && (q.type.startsWith('multi') || q.type.startsWith('ranking'))) {
                let matchedIndex = -1;
                if (q.c) {
                    const ansIdx = parseInt(p.lastAnswer);
                    if (!isNaN(ansIdx) && q.c[ansIdx]) {
                        matchedIndex = ansIdx;
                    } else {
                        matchedIndex = q.c.findIndex(c => c === p.lastAnswer);
                    }
                }

                if (matchedIndex !== -1) {
                    this.revealedMultiIndices = this.revealedMultiIndices || {};
                    if (!this.revealedMultiIndices[matchedIndex]) {
                        this.revealedMultiIndices[matchedIndex] = true;
                        window.db.ref(`rooms/${roomId}/status`).update({
                            revealedMulti: this.revealedMultiIndices
                        });
                        this.renderMultiAnswerControls(q);
                    }
                }
            }

            // BUZZ MODE LOGIC
            if (App.Data.currentConfig.mode === 'buzz') {
                const buzzAction = App.Data.currentConfig.buzzWrongAction || 'next';
                const buzzPenalty = App.Data.currentConfig.buzzPenalty || 'none';

                if (isCorrect) {
                    window.db.ref(`rooms/${roomId}/status`).update({ isBuzzActive: false });
                    this.buzzWinner = null;
                    App.Ui.showToast("正解！早押し終了");
                } else if (buzzAction === 'end') {
                    // 問題終了: end the question
                    window.db.ref(`rooms/${roomId}/status`).update({ isBuzzActive: false });
                    this.buzzWinner = null;

                    // おてつき: 休み
                    if (buzzPenalty === 'rest') {
                        const restCount = App.Data.currentConfig.buzzRestCount || 1;
                        snap.ref.update({ buzzRest: restCount });
                        App.Ui.showToast(`不正解。問題終了（${restCount}問休み）`);
                    } else {
                        App.Ui.showToast("不正解。問題終了");
                    }
                } else {
                    // 問題継続
                    this.buzzWinner = null;

                    if (buzzPenalty === 'reset_all') {
                        // 全員解答受付前に戻す
                        window.db.ref(`rooms/${roomId}/status`).update({
                            currentAnswerer: null,
                            currentAnswererName: null,
                            isBuzzActive: true
                        });
                        window.db.ref(`rooms/${roomId}/players`).once('value', allSnap => {
                            allSnap.forEach(child => {
                                child.ref.update({ buzzTime: null, lastResult: null });
                            });
                        });
                        App.Ui.showToast("不正解。全員の解答権をリセット！");

                    } else if (buzzPenalty === 'time_ban') {
                        // 一定時間解答無効
                        const banTime = App.Data.currentConfig.buzzPenaltyTime || 3;
                        snap.ref.update({ buzzBannedUntil: Date.now() + (banTime * 1000) });

                        window.db.ref(`rooms/${roomId}/status`).update({
                            currentAnswerer: null,
                            currentAnswererName: null,
                            isBuzzActive: true
                        });
                        // Clear buzzTime for others
                        window.db.ref(`rooms/${roomId}/players`).once('value', allSnap => {
                            allSnap.forEach(child => {
                                child.ref.update({ buzzTime: null });
                            });
                        });
                        App.Ui.showToast(`不正解。${banTime}秒間解答無効！早押し再開`);

                    } else if (buzzPenalty === 'otetski') {
                        // おてつき: 次の問題まで解答権なし
                        snap.ref.update({ otetskiQ: App.State.currentQIndex });
                        window.db.ref(`rooms/${roomId}/status`).update({
                            currentAnswerer: null,
                            currentAnswererName: null,
                            isBuzzActive: true
                        });
                        window.db.ref(`rooms/${roomId}/players`).once('value', allSnap => {
                            allSnap.forEach(child => {
                                if (child.key !== playerId) child.ref.update({ buzzTime: null });
                            });
                        });
                        App.Ui.showToast(`不正解。おてつき！（次の問題まで解答権なし）`);

                    } else {
                        // なし: 通常通り再開
                        window.db.ref(`rooms/${roomId}/status`).update({
                            currentAnswerer: null,
                            currentAnswererName: null,
                            isBuzzActive: true
                        });
                        window.db.ref(`rooms/${roomId}/players`).once('value', allSnap => {
                            allSnap.forEach(child => {
                                child.ref.update({ buzzTime: null });
                            });
                        });
                        App.Ui.showToast("不正解。早押し再開！");
                    }
                }
            }

            // TURN MODE LOGIC
            // TURN MODE LOGIC
            if (config.mode === 'turn') {
                // Consistent Dobon definition with judgeBuzzAuto
                const isDobon = (q.mode === 'dobon' || q.mode === 'multi' || (q.type === 'choice' && q.multi));
                const isMulti = (q.mode === 'multi' || (q.type && (q.type.startsWith('multi') || q.type.startsWith('ranking'))));

                // Advance turn if:
                // 1. It is Multi mode (always advance, correct or wrong, to keep the flow? Or maybe just correct?)
                //    Usually Multi-Turn means everyone answers.
                // 2. It is Dobon mode AND Correct (Safe) - (If Wrong/Bomb, we stop/wait)

                // ★ User Request: "End quiz (question) when someone gets it wrong in Sequence Dobon"
                if (isDobon && !isCorrect) {
                    App.Ui.showToast("不正解... ダウト！(終了)");

                    // Stop the current answerer
                    window.db.ref(`rooms/${roomId}/status`).update({
                        currentAnswerer: null,
                        currentAnswererName: null
                    });

                    // Move to Answer Reveal/Result immediately
                    this.setStep(5);
                    return;
                }

                const shouldAdvanceInQuestion = (isMulti || (isDobon && isCorrect));

                if (shouldAdvanceInQuestion) {
                    // Dobon/Multi: move to next player within the same question
                    this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
                    const nextPlayerId = this.turnOrder[this.turnIndex];
                    const nextPlayerName = (App.Data.players && App.Data.players[nextPlayerId])
                        ? App.Data.players[nextPlayerId].name : '---';

                    window.db.ref(`rooms/${roomId}/status`).update({
                        currentAnswerer: nextPlayerId,
                        currentAnswererName: nextPlayerName
                    });

                    const msg = isCorrect ? "正解！" : "不正解...";
                    App.Ui.showToast(`${msg} 次は ${nextPlayerName} さんの番です`);

                    // Update sub-info UI
                    const info = document.getElementById('studio-sub-info');
                    if (info) {
                        info.innerHTML = `<span style="color:#9b59b6; font-weight:bold;">順番: ${nextPlayerName}（${this.turnIndex + 1}/${this.turnOrder.length}）</span>`;
                    }

                    // Reset current player's lastResult/lastAnswer so the UI/Console card clears for the next turn
                    // This allows the player to answer again if the turn loops back to them
                    setTimeout(() => {
                        snap.ref.update({ lastAnswer: null, lastResult: null });
                    }, 1500);

                } else if (!this.turnAdvancedThisQ && !isDobon && !shouldAdvanceInQuestion) {
                    // Normal question (Single Turn): mark as finished for this person
                    // (The turn will pass to the next person for the NEXT question)
                    this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
                    this.turnAdvancedThisQ = true;
                    // Note: We don't advance currentAnswerer here automatically for the *current* Q, 
                    // because the Q is done. The next Q will pick up the new turnIndex.
                }
            }
        });
    },

    // ★ Flush pending results (for single-attempt mode)
    // Called when host clicks "正解表示" for free_written + normal + single attempt
    flushPendingResults: function () {
        const roomId = App.State.currentRoomId;
        const q = App.Data.studioQuestions[App.State.currentQIndex];
        window.db.ref(`rooms/${roomId}/players`).once('value', snap => {
            snap.forEach(pSnap => {
                const p = pSnap.val();
                if (p.lastResult) return; // already judged
                if (p.pendingResult) {
                    const pts = p.pendingScore || 0;
                    pSnap.ref.update({
                        periodScore: (p.periodScore || 0) + pts,
                        totalScore: (p.totalScore || 0) + pts,
                        lastResult: p.pendingResult,
                        pendingResult: null,
                        pendingScore: null
                    });
                } else {
                    // No answer submitted → incorrect
                    const loss = (q && q.loss) || 0;
                    pSnap.ref.update({
                        periodScore: (p.periodScore || 0) - loss,
                        totalScore: (p.totalScore || 0) - loss,
                        lastResult: 'lose',
                        pendingResult: null,
                        pendingScore: null
                    });
                }
            });
        });
    },

    translateMode: function (mode) {
        const map = { 'normal': '一斉解答', 'buzz': '早押し', 'time_attack': 'タイムアタック', 'solo': 'ソロ' };
        return map[mode] || mode.toUpperCase();
    },

    quickStart: function (setData) {
        console.log("Quick starting set:", setData.title);
        const unextDesign = { mainBgColor: "#0a0a0a", qTextColor: "#fff", qBgColor: "rgba(255,255,255,0.05)", qBorderColor: "#00bfff" };
        let rawQ = setData.questions || [];
        if (!Array.isArray(rawQ)) rawQ = Object.values(rawQ);
        const questions = rawQ.map(q => {
            // Create a clean copy to avoid reference issues
            const newQ = Object.assign({}, q);
            if (!newQ.design) newQ.design = Object.assign({}, unextDesign);
            return newQ;
        });

        // Determine smart default mode based on question types
        let smartMode = 'normal';
        if (!setData.config || !setData.config.mode) {
            // No explicit config — default to buzz for free/multi types
            const hasFreeOrMulti = questions.some(q =>
                q.type === 'free_oral' || q.type === 'free_written' ||
                q.type === 'multi_oral' || q.type === 'multi_written' ||
                q.type === 'ranking_oral' || q.type === 'ranking_written'
            );
            if (hasFreeOrMulti) smartMode = 'buzz';
        }

        // Merge saved config with defaults
        const defaultConfig = { mode: smartMode, gameType: 'score', theme: 'dark' };
        const setConfig = Object.assign({}, defaultConfig, setData.config || {});

        const defaultProg = { showRankingAfter: false, eliminationMode: 'none', eliminationCount: 0 };
        const setProg = Object.assign({}, defaultProg, setData.progSettings || {});

        App.Data.periodPlaylist = [{
            title: setData.title || "クイックプレイ",
            questions: questions,
            config: setConfig,
            progSettings: setProg
        }];
        this.startRoom(true);
    },

    quickStartProg: function (progData) {
        let list = progData.playlist || [];
        if (!Array.isArray(list)) list = Object.values(list);
        App.Data.periodPlaylist = list;
        if (App.Data.periodPlaylist.length === 0) {
            alert("このプログラムにはセットが含まれていません。");
            return;
        }
        this.startRoom(true);
    },

    // Update player list display
    updatePlayerList: function (players) {
        const listEl = document.getElementById('studio-player-list-display');
        if (!listEl) return;

        const playerArray = Object.keys(players).map(key => ({ id: key, ...players[key] }));

        if (playerArray.length === 0) {
            listEl.innerHTML = '<span style="color:#666; font-size:0.8em;">待機中...</span>';
        } else {
            listEl.innerHTML = '';
            playerArray.forEach(p => {
                const chip = document.createElement('span');
                chip.className = 'player-chip';
                chip.textContent = p.name || 'Guest';
                chip.style.cursor = 'pointer';
                if (this.selectedPlayerId === p.id) {
                    chip.style.borderColor = '#00bfff';
                    chip.style.background = 'rgba(0, 191, 255, 0.2)';
                }
                chip.onclick = () => {
                    this.selectedPlayerId = p.id;
                    this.updatePlayerList(players); // Re-render to show selection
                    this.renderUnifiedConsole(players);
                };
                listEl.appendChild(chip);
            });
        }
    },

    // Simplified Text Display for Next Preview
    updateNextPreview: function () {
        const nextContent = document.getElementById('studio-next-monitor-content');
        if (!nextContent) return;

        // Simplified Text Logic
        nextContent.innerHTML = '';
        nextContent.style.padding = '10px';
        nextContent.style.color = '#888';
        nextContent.style.fontSize = '1.2em';
        nextContent.style.textAlign = 'center';
        nextContent.style.display = 'flex';
        nextContent.style.flexDirection = 'column';
        nextContent.style.justifyContent = 'center';
        nextContent.style.height = '100%';

        const step = this.currentStepId;
        const currentQ = App.Data.studioQuestions[App.State.currentQIndex];
        const nextQ = App.Data.studioQuestions[App.State.currentQIndex + 1];

        let targetQ = (step >= 5 || step < 0) ? nextQ : currentQ;
        let label = (targetQ === nextQ) ? "NEXT Q" : "CURRENT PREVIEW";

        if (!targetQ) {
            nextContent.textContent = "待機中 (End of List)";
            return;
        }

        const qText = targetQ.q || "";
        const ans = this.getAnswerString ? this.getAnswerString(targetQ) : "??";

        nextContent.innerHTML = `
            <div style="font-size:0.7em; margin-bottom:10px; opacity:0.7; border-bottom:1px solid #444; padding-bottom:5px;">${label}</div>
            <div style="font-weight:bold; color:#fff; font-size:1.0em; margin-bottom:10px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">
                Q. ${qText}
            </div>
            <div style="font-size:0.8em; margin-top:5px; color:#aaa;">
                正解: <span style="color:#2ecc71;">${ans}</span>
            </div>
        `;
    },

    // Shuffle choices for questions
    shuffleQuestions: function (questions) {
        return questions.map(q => {
            if (q.shuffle === false) return q;
            const qCopy = JSON.parse(JSON.stringify(q));
            if (qCopy.type === 'choice' && qCopy.c && qCopy.c.length > 0) {
                const indices = qCopy.c.map((_, i) => i);
                const shuffled = this.shuffleArray([...indices]);
                qCopy.c = shuffled.map(i => q.c[i]);
                if (Array.isArray(qCopy.correct)) {
                    qCopy.correct = qCopy.correct.map(oldIdx => shuffled.indexOf(oldIdx));
                } else {
                    qCopy.correct = shuffled.indexOf(qCopy.correct);
                }
                qCopy.correctIndex = Array.isArray(qCopy.correct) ? qCopy.correct[0] : qCopy.correct;
            }
            else if (qCopy.type === 'sort' && qCopy.c && qCopy.c.length > 0) {
                const indices = qCopy.c.map((_, i) => i);
                const shuffled = this.shuffleArray([...indices]);
                qCopy.c = shuffled.map(i => q.c[i]);
                qCopy.correct = qCopy.c.map((_, i) => i);
            }
            return qCopy;
        });
    },

    shuffleArray: function (array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    // ★ Time Limit: Start countdown timer for the current question
    startTimeLimit: function (roomId) {
        this.clearTimeLimit(); // Clear any existing timer

        const config = App.Data.currentConfig;
        if (!config || config.timeLimitEnabled !== 'on') return;

        const seconds = parseInt(config.timeLimitSeconds) || 30;
        if (seconds <= 0) return;

        const now = Date.now();
        this.timeLimitEndTime = now + (seconds * 1000);

        // Send time limit info to Firebase (for viewer/player countdown)
        window.db.ref(`rooms/${roomId}/status`).update({
            timeLimit: seconds,
            timeLimitStart: now
        });

        // Set local timer to auto-close
        this.timeLimitTimer = setTimeout(() => {
            console.log("Time limit expired, auto-closing question.");
            App.Ui.showToast(`制限時間（${seconds}秒）終了！`);

            // Send 'closed' status to lock all players
            window.db.ref(`rooms/${roomId}/status`).update({
                step: 'closed',
                timeLimit: null,
                timeLimitStart: null
            });

            // After a brief pause, auto-advance to answer reveal
            setTimeout(() => {
                if (this.currentStepId === 2) {
                    this.setStep(5); // Go to answer reveal
                }
            }, 2000);
        }, seconds * 1000);
    },

    // ★ Time Limit: Clear the countdown timer
    clearTimeLimit: function () {
        if (this.timeLimitTimer) {
            clearTimeout(this.timeLimitTimer);
            this.timeLimitTimer = null;
        }
        this.timeLimitEndTime = null;
    },

    showPanelSelection: function (winnerId) {
        const modal = document.getElementById('panel-selection-modal');
        if (!modal) return;

        // Get winner info
        window.db.ref(`rooms/${App.State.currentRoomId}/players/${winnerId}`).once('value', snap => {
            const winner = snap.val();
            if (!winner) return;

            document.getElementById('panel-winner-name').textContent = winner.name || 'プレイヤー';

            // Get all players and assign colors
            window.db.ref(`rooms/${App.State.currentRoomId}/players`).once('value', playersSnap => {
                const players = playersSnap.val() || {};
                const playerIds = Object.keys(players);

                // Render color selector
                const colorSelector = document.getElementById('panel-color-selector');
                colorSelector.innerHTML = '';

                playerIds.forEach((pid, index) => {
                    const player = players[pid];
                    const colorIndex = (index % 6) + 1;
                    const btn = document.createElement('button');
                    btn.className = `panel-color-btn player-${colorIndex}`;
                    btn.dataset.playerId = pid;
                    btn.dataset.colorIndex = colorIndex;
                    btn.title = player.name || `プレイヤー${index + 1}`;
                    btn.textContent = (player.name || `P${index + 1}`).substring(0, 2);

                    if (pid === winnerId) {
                        btn.classList.add('selected');
                        this.selectedPanelPlayer = pid;
                        this.selectedPanelColor = colorIndex;
                    }

                    btn.onclick = () => {
                        colorSelector.querySelectorAll('.panel-color-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        this.selectedPanelPlayer = pid;
                        this.selectedPanelColor = colorIndex;
                    };

                    colorSelector.appendChild(btn);
                });

                // Render panel grid
                this.renderPanelSelectionGrid();

                modal.classList.remove('hidden');
            });
        });
    },

    // Render panel selection grid
    renderPanelSelectionGrid: function () {
        const grid = document.getElementById('panel-selection-grid');
        if (!grid) return;

        grid.innerHTML = '';
        this.panelState.forEach((ownerId, index) => {
            const cell = document.createElement('button');
            cell.className = 'panel-cell';
            cell.textContent = index + 1;
            cell.dataset.index = index;

            if (ownerId > 0) {
                cell.classList.add('occupied', `player-${ownerId}`);
            }

            cell.onclick = () => {
                if (!this.selectedPanelColor) {
                    alert('色を選択してください');
                    return;
                }

                this.panelState[index] = this.selectedPanelColor;
                this.renderPanelSelectionGrid();

                // Update Firebase
                window.db.ref(`rooms/${App.State.currentRoomId}/status/panels`).set(this.panelState);
                window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ step: 'panel' });
            };

            grid.appendChild(cell);
        });
    },

    // Close panel selection
    closePanelSelection: function () {
        const modal = document.getElementById('panel-selection-modal');
        if (modal) modal.classList.add('hidden');
        this.setStep(4);
    },

    updateMonitorScaling: function () {
        // Disabled: User requested simple text display instead of scaled frame.
        // This function is kept empty to prevent errors if called.
    },

    // ★ Turn/Solo: Show player selection screen BEFORE quiz starts
    showPreQuizSetup: function (nextStep) {
        if (nextStep === undefined) nextStep = 0;
        this.inPreSetup = true;

        // Show execution grid, hide standby panel
        document.getElementById('studio-standby-panel')?.classList.add('hidden');
        document.getElementById('studio-execution-grid')?.classList.remove('hidden');

        const mode = App.Data.currentConfig?.mode;

        // Solo info bar
        if (mode === 'solo') {
            document.getElementById('studio-solo-info')?.classList.remove('hidden');
        }

        // Step display
        const stepDisplay = document.getElementById('studio-step-display');
        if (stepDisplay) stepDisplay.textContent = '参加者を設定中';

        const qLabel = `第${(App.State.currentQIndex || 0) + 1}問 開始`;

        // Set up main button (disabled until order confirmed)
        const btnMain = document.getElementById('btn-phase-main');
        if (btnMain) {
            btnMain.classList.remove('hidden');
            btnMain.textContent = qLabel;
            btnMain.disabled = true;
            btnMain.style.opacity = '0.4';
            btnMain.style.pointerEvents = 'none';
            btnMain.classList.remove('action-next', 'action-ready');
            // After confirmation this onclick will be triggered
            btnMain.onclick = () => {
                this.inPreSetup = false;
                this.setStep(nextStep);
            };
        }

        // Firebase: standby state
        const roomId = App.State.currentRoomId;
        if (roomId) {
            const pTitle = App.Data.currentConfig?.periodTitle || '';
            window.db.ref(`rooms/${roomId}/status`).update({
                step: 'standby',
                qIndex: 0,
                programTitle: pTitle,
                turnIndex: null,
                isTurnMode: true
            });
        }

        // Render player selection UI (disables btnMain until user confirms)
        this.renderTurnOrderSetup(btnMain);

        this.renderTimeline();
        this.updateMonitorScaling();
        this.updateNextPreview();
        this.resetPlayerStatus();
    },

    // ★ Turn Mode: Render order setup UI
    renderTurnOrderSetup: function (btnMain) {
        if (this.turnSetupDismissed) return; // Don't show if already dismissed

        const mode = App.Data.currentConfig ? App.Data.currentConfig.mode : 'turn';
        const isSolo = (mode === 'solo');

        const players = App.Data.players || {};
        const playerIds = Object.keys(players);

        // Remove existing turn setup UI if present
        let existingSetup = document.getElementById('turn-order-setup');
        if (existingSetup) existingSetup.remove();

        // Create container
        const container = document.createElement('div');
        container.id = 'turn-order-setup';
        container.style.cssText = 'width:100%; max-width:500px; margin:20px auto; background:rgba(155,89,182,0.1); border:1px solid rgba(155,89,182,0.3); border-radius:12px; padding:15px; box-sizing:border-box;';

        // Title
        const title = document.createElement('div');
        title.style.cssText = 'color:#9b59b6; font-weight:bold; font-size:1.1em; margin-bottom:12px; text-align:center; letter-spacing:1px;';
        title.innerHTML = isSolo ? '<i class="fas fa-user-check"></i> チャレンジャーを設定' : '<i class="fas fa-sort-numeric-down"></i> 解答順番を設定';
        container.appendChild(title);

        // State check: Confirmed?
        const isAlreadyConfirmed = !!this.isTurnOrderConfirmed;

        // Force Get Button Element if passed argument is stale/null
        if (!btnMain) btnMain = document.getElementById('btn-phase-main');

        // Button State Logic - IMMEDIATE APPLICATION
        if (btnMain) {
            if (!isAlreadyConfirmed) {
                // Initially DISABLE the main start button until confirmed
                btnMain.disabled = true;
                btnMain.style.opacity = '0.4';
                btnMain.style.pointerEvents = 'none';
                btnMain.classList.remove('action-ready');
                btnMain.classList.remove('action-next');
            } else {
                // Ensure enabled if confirmed - BLUE (action-next)
                btnMain.textContent = `第${(App.State.currentQIndex || 0) + 1}問 開始`;
                btnMain.disabled = false;
                btnMain.style.opacity = '1';
                btnMain.style.pointerEvents = 'auto';
                btnMain.style.cursor = 'pointer';
                btnMain.classList.remove('action-ready');
                btnMain.classList.add('action-next');
                btnMain.style.filter = 'none';
            }
            this.syncMainButton();
        }

        // Restore standard button text (e.g., "第1問 開始")
        btnMain.textContent = `第${App.State.currentQIndex + 1}問 開始`;

        // If no players
        if (playerIds.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'color:#aaa; text-align:center; padding:20px; font-size:0.9em; background:rgba(0,0,0,0.3); border-radius:8px;';
            emptyMsg.innerHTML = '現在、参加者がいません。<br>参加者が入室するとリストが表示されます。';
            container.appendChild(emptyMsg);

            // Insert before participant section
            const participantSection = document.querySelector('.simple-player-section');
            if (participantSection) {
                participantSection.parentNode.insertBefore(container, participantSection);
            } else {
                btnMain.parentNode.insertBefore(container, btnMain.nextSibling);
            }
            return;
        }

        // Initialize turnOrder with current players if empty or stale
        // Only add new players; keep existing order for those still present
        if (!isSolo) {
            const validOrder = this.turnOrder.filter(id => playerIds.includes(id));
            const newPlayers = playerIds.filter(id => !validOrder.includes(id));
            this.turnOrder = [...validOrder, ...newPlayers];
        } else {
            // Solo Mode: Single selection
            if (!isAlreadyConfirmed) {
                this.turnOrder = []; // Wait for user to select 1 player
            }
        }

        // Ensure local variable reflects persistent state
        let isConfirmed = isAlreadyConfirmed;

        // Create the sortable list
        const listEl = document.createElement('div');
        listEl.id = 'turn-order-list';
        listEl.style.cssText = 'display:flex; flex-direction:column; gap:6px; max-height:300px; overflow-y:auto; padding-right:5px;';

        const renderList = () => {
            listEl.innerHTML = '';

            // Source list depends on mode
            const listSource = isSolo ? playerIds : this.turnOrder;

            listSource.forEach((pid, idx) => {
                const pName = players[pid] ? players[pid].name : '(退出済み)';
                const row = document.createElement('div');

                // Styling
                if (isSolo) {
                    const isSelected = (this.turnOrder[0] === pid);
                    const bg = isSelected ? 'rgba(155,89,182,0.3)' : 'rgba(255,255,255,0.05)';
                    const border = isSelected ? '1px solid #9b59b6' : '1px solid rgba(255,255,255,0.1)';
                    row.style.cssText = `display:flex; align-items:center; gap:10px; background:${bg}; border:${border}; border-radius:8px; padding:10px 12px; transition:all 0.2s; cursor:pointer;`;

                    // In solo mode, clicking a player makes them the challenger and enables the Start button
                    row.onclick = () => {
                        this.turnOrder = [pid];
                        this.isTurnOrderConfirmed = true; // State persistence
                        isConfirmed = true;

                        // UI Updates: Enable Start Button immediately
                        const exactBtn = document.getElementById('btn-phase-main');
                        if (exactBtn) {
                            exactBtn.disabled = false;
                            exactBtn.style.opacity = '1';
                            exactBtn.style.pointerEvents = 'auto';
                            exactBtn.style.cursor = 'pointer';
                            exactBtn.style.filter = 'none';
                            exactBtn.style.background = '';
                            exactBtn.classList.add('anim-pop-in');
                            exactBtn.classList.remove('action-ready');
                            exactBtn.classList.add('action-next');
                        }
                        if (btnMain && btnMain !== exactBtn) {
                            btnMain.disabled = false;
                            btnMain.classList.remove('action-ready');
                            btnMain.classList.add('action-next');
                        }
                        this.syncMainButton();

                        // Sync to Firebase
                        this.turnIndex = 0;
                        this.turnAdvancedThisQ = false;
                        const roomId = App.State.currentRoomId;
                        const turnOrderNames = [players[pid] ? players[pid].name : '---'];
                        window.db.ref(`rooms/${roomId}/status`).update({
                            turnOrder: this.turnOrder,
                            turnOrderNames: turnOrderNames,
                            turnIndex: 0,
                            isTurnMode: true
                        });

                        renderList();
                    };
                } else {
                    row.style.cssText = 'display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 12px; transition:all 0.2s;';
                }

                if (!players[pid]) row.style.opacity = '0.5';

                // Badge
                const numBadge = document.createElement('div');
                if (isSolo) {
                    const isSelected = (this.turnOrder[0] === pid);
                    numBadge.style.cssText = `width:24px; height:24px; border-radius:50%; border:2px solid ${isSelected ? '#9b59b6' : '#666'}; background:${isSelected ? '#9b59b6' : 'transparent'}; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s;`;
                    if (isSelected) numBadge.innerHTML = '<i class="fas fa-check" style="font-size:0.7em; color:#fff;"></i>';
                } else {
                    numBadge.style.cssText = 'width:28px; height:28px; border-radius:50%; background:#9b59b6; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.9em; flex-shrink:0; box-shadow:0 2px 4px rgba(0,0,0,0.3);';
                    numBadge.textContent = idx + 1;
                }

                // Name
                const nameEl = document.createElement('div');
                nameEl.style.cssText = 'flex:1; color:#fff; font-size:0.95em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
                nameEl.textContent = pName;

                row.appendChild(numBadge);
                row.appendChild(nameEl);

                // Turn Mode Buttons (Not used in Solo)
                if (!isSolo) {
                    const btnContainer = document.createElement('div');
                    btnContainer.style.display = 'flex';
                    btnContainer.style.gap = '4px';

                    // Up button
                    const btnUp = document.createElement('button');
                    btnUp.style.cssText = 'width:32px; height:32px; border:none; border-radius:6px; background:rgba(255,255,255,0.1); color:#fff; cursor:pointer; font-size:0.8em; display:flex; align-items:center; justify-content:center; transition:background 0.2s;';
                    btnUp.textContent = '▲';
                    btnUp.disabled = (idx === 0) || isConfirmed;
                    if (btnUp.disabled) {
                        btnUp.style.opacity = '0.2';
                        btnUp.style.cursor = 'default';
                    } else {
                        btnUp.onclick = (e) => {
                            e.stopPropagation();
                            if (idx > 0 && !isConfirmed) {
                                [this.turnOrder[idx], this.turnOrder[idx - 1]] = [this.turnOrder[idx - 1], this.turnOrder[idx]];
                                renderList();
                            }
                        };
                    }

                    // Down button
                    const btnDown = document.createElement('button');
                    btnDown.style.cssText = 'width:32px; height:32px; border:none; border-radius:6px; background:rgba(255,255,255,0.1); color:#fff; cursor:pointer; font-size:0.8em; display:flex; align-items:center; justify-content:center; transition:background 0.2s;';
                    btnDown.textContent = '▼';
                    btnDown.disabled = (idx === this.turnOrder.length - 1) || isConfirmed;
                    if (btnDown.disabled) {
                        btnDown.style.opacity = '0.2';
                        btnDown.style.cursor = 'default';
                    } else {
                        btnDown.onclick = (e) => {
                            e.stopPropagation();
                            if (idx < this.turnOrder.length - 1 && !isConfirmed) {
                                [this.turnOrder[idx], this.turnOrder[idx + 1]] = [this.turnOrder[idx + 1], this.turnOrder[idx]];
                                renderList();
                            }
                        };
                    }

                    btnContainer.appendChild(btnUp);
                    btnContainer.appendChild(btnDown);
                    row.appendChild(btnContainer);
                }

                listEl.appendChild(row);
            });
        };

        renderList();
        container.appendChild(listEl);

        // Turn Mode Only: Function Buttons Container (Shuffle + Confirm)
        if (!isSolo) {
            const funcBtnContainer = document.createElement('div');
            funcBtnContainer.style.cssText = 'display:flex; gap:10px; margin-top:15px; margin-bottom:5px;';

            // Shuffle button
            const shuffleBtn = document.createElement('button');
            shuffleBtn.style.cssText = 'flex:1; padding:10px; border:1px solid rgba(155,89,182,0.4); border-radius:8px; background:rgba(155,89,182,0.15); color:#9b59b6; cursor:pointer; font-size:0.9em; font-weight:bold; transition:all 0.2s;';
            shuffleBtn.innerHTML = '<i class="fas fa-random"></i> ランダム';
            shuffleBtn.disabled = isConfirmed;
            if (isConfirmed) {
                shuffleBtn.style.opacity = '0.3';
                shuffleBtn.style.cursor = 'default';
            } else {
                shuffleBtn.onmouseover = () => shuffleBtn.style.background = 'rgba(155,89,182,0.25)';
                shuffleBtn.onmouseout = () => shuffleBtn.style.background = 'rgba(155,89,182,0.15)';
            }
            shuffleBtn.onclick = () => {
                if (isConfirmed) return;
                // Fisher-Yates
                for (let i = this.turnOrder.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.turnOrder[i], this.turnOrder[j]] = [this.turnOrder[j], this.turnOrder[i]];
                }
                renderList();
            };
            funcBtnContainer.appendChild(shuffleBtn);

            // Confirm Button
            const confirmBtn = document.createElement('button');
            confirmBtn.style.cssText = 'flex:2; padding:12px; border:none; border-radius:8px; background:linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); color:#fff; cursor:pointer; font-size:1.0em; font-weight:bold; box-shadow:0 4px 12px rgba(155,89,182,0.4); transition:all 0.2s;';

            if (isConfirmed) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> 確定済み';
                confirmBtn.style.background = '#444';
                confirmBtn.style.boxShadow = 'none';
                confirmBtn.style.color = '#aaa';
                confirmBtn.style.cursor = 'default';
            } else {
                confirmBtn.innerHTML = '順番を確定する';
                confirmBtn.onmouseover = () => confirmBtn.style.filter = 'brightness(1.1)';
                confirmBtn.onmouseout = () => confirmBtn.style.filter = 'brightness(1.0)';
            }

            confirmBtn.onclick = () => {
                isConfirmed = true;
                this.isTurnOrderConfirmed = true; // State persistence

                // UI Updates: Lock inputs
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> 確定済み';
                confirmBtn.style.background = '#444';
                confirmBtn.style.boxShadow = 'none';
                confirmBtn.style.color = '#aaa';
                confirmBtn.style.cursor = 'default';

                shuffleBtn.disabled = true;
                shuffleBtn.style.opacity = '0.3';
                shuffleBtn.style.cursor = 'default';

                // Re-render list to disable up/down buttons
                renderList();
                container.style.opacity = '0.8';

                // --- FORCE DOM UPDATE FOR MAIN BUTTON ---
                const exactBtn = document.getElementById('btn-phase-main');
                if (exactBtn) {
                    exactBtn.disabled = false;
                    exactBtn.style.opacity = '1';
                    exactBtn.style.pointerEvents = 'auto';
                    exactBtn.style.cursor = 'pointer';
                    exactBtn.style.filter = 'none';
                    exactBtn.style.background = ''; // Clear inline that might override class
                    exactBtn.classList.add('anim-pop-in');

                    // Use .action-next for BLUE color (as requested)
                    exactBtn.classList.remove('action-ready');
                    exactBtn.classList.add('action-next');

                    if (btnMain && btnMain !== exactBtn) {
                        btnMain.disabled = false;
                        btnMain.classList.remove('action-ready');
                        btnMain.classList.add('action-next');
                    }
                }
                this.syncMainButton();

                // Sync to Firebase
                this.turnIndex = 0;
                this.turnAdvancedThisQ = false;
                const roomId = App.State.currentRoomId;
                const turnOrderNames = this.turnOrder.map(id => {
                    const p = players[id];
                    return p ? p.name : '---';
                });
                window.db.ref(`rooms/${roomId}/status`).update({
                    turnOrder: this.turnOrder,
                    turnOrderNames: turnOrderNames,
                    turnIndex: 0,
                    isTurnMode: true
                });
                App.Ui.showToast("解答順番を確定しました");
            };
            funcBtnContainer.appendChild(confirmBtn);
            container.appendChild(funcBtnContainer);
        }

        // Override main button to just clean up
        // Check if already wrapped to avoid double-wrapping on re-renders
        if (!btnMain.onclick || !btnMain.onclick.isTurnSetupWrapper) {
            const originalOnClick = btnMain.onclick;

            const newHandler = (e) => {
                // If NOT confirmed, block everything
                if (!this.isTurnOrderConfirmed) {
                    if (e) {
                        e.preventDefault();
                        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                        else e.stopPropagation();
                    }
                    return;
                }

                // If CONFIRMED, proceed but clean up first
                console.log("Main Button Clicked: Dismissing Setup");

                // Track dismissal so it doesn't reappear on player update
                this.turnSetupDismissed = true;

                // Remove setup UI
                const setupEl = document.getElementById('turn-order-setup');
                if (setupEl) setupEl.remove();

                // Restore original handler so the NEXT click proceeds as normal
                btnMain.onclick = originalOnClick;

                // IMPORTANT: Do NOT stop propagation here. 
                // Let the event bubble to the standard listener (App.Studio.onMainAction).
                // If originalOnClick exists, call it manually just in case
                if (originalOnClick) originalOnClick(e);
            };
            newHandler.isTurnSetupWrapper = true;
            btnMain.onclick = newHandler;
        }

        // Insert above participant section
        const participantSection = document.querySelector('.simple-player-section');
        if (participantSection) {
            participantSection.parentNode.insertBefore(container, participantSection);
        } else {
            btnMain.parentNode.insertBefore(container, btnMain.nextSibling);
        }
    },
};

window.startRoom = () => App.Studio.startRoom();
window.quickStartSet = (d) => App.Studio.quickStart(d);
window.quickStartProg = (d) => App.Studio.quickStartProg(d);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-judge-correct')?.addEventListener('click', () => App.Studio.judgeBuzz(true));
    document.getElementById('btn-judge-wrong')?.addEventListener('click', () => App.Studio.judgeBuzz(false));
    document.getElementById('btn-toggle-ans')?.addEventListener('click', () => App.Studio.toggleAns());
    document.getElementById('btn-force-next')?.addEventListener('click', () => App.Studio.goNext());
    document.getElementById('host-close-studio-btn-simple')?.addEventListener('click', () => App.Dashboard.enter());
    document.getElementById('btn-phase-main')?.addEventListener('click', () => {
        if (App.Studio.onMainAction) App.Studio.onMainAction();
    });
});


document.getElementById('panel-selection-close')?.addEventListener('click', () => App.Studio.closePanelSelection());
