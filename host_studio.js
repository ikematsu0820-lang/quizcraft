/* =========================================================
 * host_studio.js (v144: Fix Buzz Reset Logic)
 * =======================================================*/

App.Studio = {
    timer: null,
    buzzWinner: null,
    isQuick: false,
    currentStepId: 0,
    panelState: Array(25).fill(0),
    selectedPanelColor: 1,
    selectedPlayerId: null,

    onMainAction: function () {
        // This is a fallback/dispatcher. Typically btnMain.onclick is overwritten by setStep.
        // If it's called here, it usually means the button was clicked before a program was loaded.
        if (App.Data.studioQuestions.length === 0) {
            alert("⚠️ 最初にプログラム（セット）をロードしてください。");
        }
    },

    soloState: { lives: 3, timeBank: 60, challengerIndex: 0 },

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

        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        App.State.currentRoomId = code;

        // ★ モニター画面を別タブで自動起動
        const viewerUrl = window.location.origin + window.location.pathname + `?vcode=${code}`;
        window.open(viewerUrl, '_blank');

        window.db.ref(`rooms/${code}`).set({
            questions: [],
            status: { step: 'standby', qIndex: 0, panels: this.panelState },
            config: { mode: 'normal' },
            players: {}
        }).then(() => {
            const box = document.getElementById('big-room-id-box');
            if (box) {
                box.classList.add('new-room');
                setTimeout(() => box.classList.remove('new-room'), 600);
            }
            App.Ui.showView(App.Ui.views.hostControl);
            this.enterHostMode();

            // If Quick Start (playlist already populated), start immediately
            if (isQuick && App.Data.periodPlaylist && App.Data.periodPlaylist.length > 0) {
                console.log("Quick Start: Auto-loading set...");
                this.setupPeriod(0);
            } else {
                this.loadProgramList();
            }
        });
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

            if (this.currentStepId === 2 || this.currentStepId === 3 || this.currentStepId === 4 || this.currentStepId === 5) {
                this.renderRealtimeAnswers(players);
                this.renderUnifiedConsole(players);
            } else {
                this.renderUnifiedConsole(players); // Still might want to see who joined
            }

            if (App.Data.currentConfig?.mode === 'buzz' && this.currentStepId === 2) {
                this.checkBuzz(players);

                // Auto Judge for Buzz Mode (Choice/Sort/Letter)
                if (this.buzzWinner && players[this.buzzWinner]) {
                    const winner = players[this.buzzWinner];
                    const q = App.Data.studioQuestions[App.State.currentQIndex];
                    // Only auto-judge if they have answered AND not yet judged
                    if (winner.lastAnswer !== null && winner.lastAnswer !== undefined && !winner.lastResult) {
                        if (q && ['choice', 'sort', 'letter_select'].includes(q.type)) {
                            // Introduce a small delay to ensure UI updates? Or immediate?
                            // Immediate is fine for UX, but maybe add 500ms for dramatic effect?
                            // Let's do immediate for responsiveness.
                            this.judgeBuzzAuto(winner, q);
                        }
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
                    App.Ui.showToast("回答者を選択してください");
                }
            };
        }
        if (mobBtnWrong) {
            mobBtnWrong.onclick = () => {
                if (this.selectedPlayerId) {
                    this.updatePlayerScore(this.selectedPlayerId, false);
                } else {
                    App.Ui.showToast("回答者を選択してください");
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
        if (qNumEl) {
            const idx = (App.State.currentQIndex !== undefined) ? App.State.currentQIndex + 1 : '-';
            qNumEl.textContent = `Q ${idx}`;
        }

        // Update Status Indicators
        // Map steps to indicators: 
        // 0=Start/Title, 1=QNum -> QNum Indicator
        // 2=RevealQ/Answering, 3=Closed -> Question Indicator
        // 4=RevealP, 5=RevealC, 6=Judge, 7=Result -> Answer Indicator
        const map = {
            'status-ind-qnum': [0, 1], // Title / Q Num
            'status-ind-question': [2, 3], // Answering, Lockdown
            'status-ind-answer': [4, 5, 6, 7] // Reveal Phases
        };

        for (const [id, steps] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) {
                if (steps.includes(stepId)) {
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

        this.localProgramsCache = {}; // キャッシュ初期化

        window.db.ref(`saved_programs/${showId}`).once('value', snap => {
            const data = snap.val();
            select.innerHTML = '';

            const def = document.createElement('option');
            def.value = "";
            def.textContent = "-- 読み込むプログラムを選択 --";
            select.appendChild(def);

            if (data) {
                // 新しい順にソート
                const sorted = Object.keys(data).map(k => ({ ...data[k], key: k }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                sorted.forEach(prog => {
                    this.localProgramsCache[prog.key] = prog;
                    const opt = document.createElement('option');
                    opt.value = prog.key;
                    opt.textContent = `${prog.title} (${prog.playlist?.length || 0}セット)`;
                    select.appendChild(opt);
                });
                select.disabled = false;
            } else {
                const opt = document.createElement('option');
                opt.textContent = "(保存されたプログラムがありません)";
                select.appendChild(opt);
            }
        });

        select.onchange = () => {
            btn.disabled = (select.value === "");
        };

        btn.onclick = () => {
            // alert("現在、スタジオ機能の開始ボタンは再設計中です。");
            App.Ui.showToast("開始ボタンは現在再設計中です（実装待ち）");
        };
        /*
        const key = select.value;
        if (!key || !this.localProgramsCache[key]) return;

        const prog = this.localProgramsCache[key];
        App.Data.periodPlaylist = prog.playlist || [];

        if (App.Data.periodPlaylist.length === 0) {
            alert("⚠️ このプログラムにはセットが登録されていません。");
            return;
        }

        document.getElementById('studio-loader-ui').classList.add('hidden');
        document.getElementById('studio-program-info').textContent = "番組読込完了: " + prog.title;

        this.renderTimeline();

        const btnMain = document.getElementById('btn-phase-main');
        btnMain.textContent = "番組を開始 (START PROGRAM)";
        btnMain.classList.remove('hidden');
        btnMain.className = 'btn-block btn-large-action action-ready';

        btnMain.onclick = null;
        btnMain.onclick = () => {
            try {
                this.setupPeriod(0);
            } catch (e) {
                alert("開始エラー: " + e.message);
            }
        };
        this.syncMainButton();
        */
        // };
    },

    renderTimeline: function () {
        const area = document.getElementById('studio-period-timeline');
        area.innerHTML = '';
        App.Data.periodPlaylist.forEach((item, i) => {
            const btn = document.createElement('button');
            const isActive = (i === App.State.currentPeriodIndex);
            btn.className = `btn-block ${isActive ? 'btn-info' : 'btn-dark'}`;
            btn.textContent = `${i + 1}セット目: ${item.title} [${this.translateMode(item.config.mode)}]`;
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

        App.State.currentPeriodIndex = index;
        if (!item.progSettings) item.progSettings = { showRankingAfter: false, eliminationMode: 'none' };

        // Follow design studio's slide order by default, only shuffle if explicit config says so
        const shuffle = (item.config && item.config.shuffleQuestions === true);
        let qs = item.questions || [];
        if (!Array.isArray(qs)) qs = Object.values(qs);
        App.Data.studioQuestions = shuffle ? this.shuffleQuestions(qs) : qs;
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
        this.setStep(0);
    },

    setStep: function (stepId) {
        this.currentStepId = stepId;
        this.updateStudioStatus(stepId); // Sync Status Indicators
        this.updateNextPreview(); // Update preview when step changes

        const btnMain = document.getElementById('btn-phase-main');
        const subControls = document.getElementById('studio-sub-controls');

        btnMain.className = 'btn-block btn-large-action';
        if (subControls) subControls.classList.add('hidden');
        btnMain.classList.remove('hidden');

        // Sync Console Button
        const mobBtnMain = document.getElementById('console-btn-phase-main');
        if (mobBtnMain) {
            mobBtnMain.className = btnMain.className;
        }

        const isStandby = (stepId === 0 || stepId === 1);
        this.toggleUIForStandby(isStandby);

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

        const stepsJA = ['待機', '出題', '回答受付', '締め切り', '回答表示', '正解発表', '判定', '結果'];
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
            case 0: // 待機 / タイトル
                const currentSet = App.Data.periodPlaylist[App.State.currentPeriodIndex];
                const pTitle = currentSet.title;
                const firstQ = App.Data.studioQuestions[0] || {};

                // Update Simple UI Status
                const stepDisplay = document.getElementById('studio-step-display');
                if (stepDisplay) stepDisplay.textContent = "WAITING / " + pTitle;

                // If it's the very beginning of the set, check if Title should be shown
                if (App.State.currentQIndex === 0) {
                    if (firstQ.isTitleHidden) {
                        this.setStep(2); // Skip Title & QNum, go to Question
                        return;
                    }
                    if (firstQ.prodDesign) {
                        this.renderProductionMonitor('title', firstQ);
                        btnMain.textContent = `クイズ開始 (第1問へ)`;
                    } else {
                        this.renderMonitorMessage("", pTitle);
                        btnMain.textContent = `第${App.State.currentQIndex + 1}問 開始`;
                    }
                } else {
                    this.renderMonitorMessage("", pTitle);
                    btnMain.textContent = `第${App.State.currentQIndex + 1}問 開始`;
                }

                // btnMain.onclick = () => this.setStep(1); // Old: Go to Q Number Step
                btnMain.onclick = () => this.setStep(2); // New: Go directly to Question (Step 2) for Q1
                btnMain.classList.add('action-ready'); // Add class to trigger blue color
                syncBadge.textContent = "WAITING";
                syncBadge.style.background = "#333";

                document.getElementById('studio-execution-grid').classList.remove('hidden');
                this.updateMonitorScaling();
                this.updateNextPreview();
                this.resetPlayerStatus();
                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'standby',
                    qIndex: App.State.currentQIndex,
                    programTitle: pTitle
                });
                break;

            case 1: // 出題準備 (Question Number Slide)
                if (q.isQNumHidden) {
                    this.setStep(2);
                    return;
                }

                // Update Simple UI Status
                if (document.getElementById('studio-step-display')) {
                    document.getElementById('studio-step-display').textContent = "PREPARING Q." + (App.State.currentQIndex + 1);
                }

                btnMain.textContent = "問題を表示する (REVEAL)";
                btnMain.classList.add('action-ready');
                btnMain.onclick = () => this.setStep(2);
                syncBadge.textContent = "PREPARING";
                syncBadge.style.background = "rgba(255, 215, 0, 0.2)";

                if (q.prodDesign) {
                    this.renderProductionMonitor('qnumber', q);
                } else {
                    this.renderMonitorMessage("", `第${App.State.currentQIndex + 1}問`);
                }

                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'reveal_q_num',
                    qIndex: App.State.currentQIndex,
                    qNumLabel: `第${App.State.currentQIndex + 1}問`
                });
                break;

            case 2: // 出題中 (Question Display)
                // Update Simple UI Status
                if (document.getElementById('studio-step-display')) {
                    document.getElementById('studio-step-display').textContent = "Q." + (App.State.currentQIndex + 1) + " (THINKING)";
                }

                const currentQ = App.Data.studioQuestions[App.State.currentQIndex];
                if (!currentQ.prodDesign) {
                    this.renderQuestionMonitor(currentQ); // Fallback standard
                } else {
                    this.renderProductionMonitor('question', currentQ);
                }

                const isBuzz = (App.Data.currentConfig.mode === 'buzz');

                if (isBuzz) {
                    // Buzz Mode: Start IMMEDIATELY
                    btnMain.textContent = "正解を表示 (ANSWER)";
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

                } else {
                    // Normal Mode (Unified Flow: Question -> Answer)
                    // For multi-answer questions, the host can reveal answers individually during this phase (Step 2)
                    // so we don't need a separate "Reveal Answers" (Step 4) phase.
                    btnMain.textContent = "正解を表示 (ANSWER)";
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
                }

                this.updateNextPreview(); // Ensure next is previewed (Answer slide)
                break;

            case 4: // 回答オープン (Multi-Answer Reveal Step)
                if (document.getElementById('studio-step-display')) {
                    document.getElementById('studio-step-display').textContent = "Q." + (App.State.currentQIndex + 1) + " (REVEAL)";
                }

                btnMain.textContent = "正解を表示 (ANSWER)";
                btnMain.classList.remove('action-ready');
                btnMain.classList.add('action-next');
                btnMain.onclick = () => this.setStep(5);

                syncBadge.textContent = "REVEAL";
                syncBadge.style.background = "#9b59b6"; // Purple

                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'reveal_player',
                    qIndex: App.State.currentQIndex
                });
                break;

            case 5: // 正解表示 (Answer)
                // Update Simple UI Status
                if (document.getElementById('studio-step-display')) {
                    document.getElementById('studio-step-display').textContent = "Q." + (App.State.currentQIndex + 1) + " (ANSWER)";
                }

                // q is already defined at the top of setStep

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

                btnMain.textContent = "次の問題へ (NEXT Q)";
                btnMain.classList.remove('action-next');
                btnMain.classList.add('action-ready'); // Ready for next
                btnMain.onclick = () => this.goNext();

                syncBadge.textContent = "ANSWER";
                syncBadge.style.background = "#2ecc71";

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
            if (!questions[nextIdx].isHidden) {
                console.log("Found next Q at:", nextIdx);
                App.State.currentQIndex = nextIdx;
                this.resetPlayerStatus();

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
                this.setStep(nextStep);
                return;
            }
            nextIdx++;
        }

        console.log("No more questions. Finishing set.");
        this.handleSetCompletion();
    },

    handleSetCompletion: function () {
        console.log("Set complete.");

        const currentSet = App.Data.periodPlaylist[App.State.currentPeriodIndex];
        const progSettings = currentSet.progSettings || {};

        // 1. Check Ranking
        if (progSettings.showRankingAfter) {
            this.setStep(8);
            return;
        }

        // 2. Check Loop or Next Set
        let nextPeriodIdx = App.State.currentPeriodIndex + 1;
        if (nextPeriodIdx < App.Data.periodPlaylist.length) {
            App.Ui.showToast("次のセットに進みます");
            this.setupPeriod(nextPeriodIdx);
        } else {
            // End of program
            if (progSettings.loopProgram) {
                this.setupPeriod(0);
            } else {
                this.showFinalRankingOption();
            }
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
        if (confirm("全プログラム終了です。最終結果を表示しますか？")) {
            window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ step: 'final_ranking' });
            document.getElementById('studio-execution-grid').classList.add('hidden');
            document.getElementById('studio-standby-panel').classList.remove('hidden');
            document.getElementById('btn-phase-main').classList.add('hidden');
            document.getElementById('studio-program-info').innerHTML = "<h2 style='color:#ffd700'>全プログラム終了 (COMPLETED)</h2><p>モニターに結果を表示中...</p>";
            this.syncMainButton();
        }
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
        if (document.getElementById('console-multi-controls')) {
            document.getElementById('console-multi-controls').innerHTML = '';
            document.getElementById('console-multi-controls').classList.add('hidden');
        }

        window.db.ref(`rooms/${roomId}/players`).once('value', snap => {
            snap.forEach(p => {
                p.ref.update({
                    lastAnswer: null,
                    lastResult: null,
                    buzzTime: null,
                    answerTime: null
                });
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
            text = `[TITLE] ${(q.prodDesign && q.prodDesign.titleText) || App.Data.currentConfig.periodTitle}`;
        } else if (type === 'qnumber') {
            text = `[Q#] ${(q.prodDesign && q.prodDesign.qNumberText) || `Q${App.State.currentQIndex + 1}`}`;
        }

        qEl.innerHTML = `<div style="padding:20px; font-size:1.5em; text-align:center; color:#ccc;">${text}</div>`;
        document.getElementById('studio-choices-container').innerHTML = '';

        // Remove styling
        const panel = document.getElementById('studio-question-panel');
        if (panel) {
            panel.style.background = 'transparent';
            panel.removeAttribute('style');
        }
        try {
            // Simplified for Host View: Just text summary
            const qEl = document.getElementById('studio-q-text');
            if (!qEl) return;

            let text = "";
            if (type === 'title') {
                text = `[TITLE] ${(q.prodDesign && q.prodDesign.titleText) || App.Data.currentConfig.periodTitle}`;
            } else if (type === 'qnumber') {
                text = `[Q#] ${(q.prodDesign && q.prodDesign.qNumberText) || `Q${App.State.currentQIndex + 1}`}`;
            }

            qEl.innerHTML = `<div style="padding:20px; font-size:1.5em; text-align:center; color:#ccc;">${text}</div>`;
            document.getElementById('studio-choices-container').innerHTML = '';

            // Remove styling
            const panel = document.getElementById('studio-question-panel');
            if (panel) {
                panel.style.background = 'transparent';
                panel.removeAttribute('style');
            }
        } catch (e) { console.error("Render Production Monitor Error:", e); }
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
            ansDiv.style.borderLeft = '4px solid ' + ((q.mode === 'dobon') ? '#ff5555' : '#2ecc71');

            const ansLabel = document.createElement('div');
            ansLabel.className = 'label';
            ansLabel.style.fontSize = '0.8em';
            ansLabel.style.color = '#888';
            ansLabel.textContent = (q.mode === 'dobon') ? "TRAP ANSWERS (不正解)" : "CORRECT ANSWER";

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
        if (!q || !q.type.startsWith('multi')) return;

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
        if (!q || !q.type.startsWith('multi') || !q.c) {
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

            // Show number AND text
            btn.innerHTML = `<span style="font-size:0.8em; opacity:0.7; display:block; margin-bottom:2px;">${i + 1}</span>${choice}`;

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
        const candidates = Object.entries(players).filter(([_, p]) => p.buzzTime && !p.lastResult).sort((a, b) => a[1].buzzTime - b[1].buzzTime);
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
                snap.ref.update({ lastResult: 'lose', buzzTime: null });

                // ★修正: リセット設定なら、全員のbuzzTimeを消して再開
                if (action === 'reset') {
                    // 全員の buzzTime を null に更新
                    window.db.ref(`rooms/${roomId}/players`).once('value', pSnap => {
                        pSnap.forEach(pp => {
                            pp.ref.update({ buzzTime: null, lastResult: null }); // lastResultも消して復活させる
                        });
                        this.buzzWinner = null;
                        document.getElementById('studio-sub-info').classList.add('hidden');
                        window.db.ref(`rooms/${roomId}/status`).update({ currentAnswerer: null, isBuzzActive: true });
                        App.Ui.showToast("誤答によりリセットしました");
                    });
                } else if (action === 'end') {
                    this.buzzWinner = null;
                    document.getElementById('studio-sub-info').classList.add('hidden');
                    this.setStep(4);
                } else {
                    // next (デフォルト: 間違えた人はそのまま、他が押せるように)
                    this.buzzWinner = null;
                    document.getElementById('studio-sub-info').classList.add('hidden');
                    window.db.ref(`rooms/${roomId}/status`).update({ currentAnswerer: null, isBuzzActive: true });
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

                // Skip if no answer or already judged
                if (p.lastAnswer === null || p.lastAnswer === undefined || p.lastResult) return;

                if (q.type === 'choice') {
                    if (q.mode === 'dobon') {
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

    judgeBuzzAuto: function (player, q) {
        if (!player || !q) return;
        let isCor = false;

        if (q.type === 'choice') {
            if (Array.isArray(q.correct)) {
                if (q.correct.some(c => c == player.lastAnswer)) isCor = true;
            } else {
                if (player.lastAnswer == q.correct) isCor = true;
            }
        } else if (q.type === 'sort') {
            let correctStr = Array.isArray(q.correct) ? q.correct.map(idx => String.fromCharCode(65 + idx)).join('') : q.correct;
            if (player.lastAnswer === correctStr) isCor = true;
        } else if (q.type === 'letter_select') {
            let correctStr = q.steps ? q.steps.map(s => s.correct).join('') : q.correct;
            if (player.lastAnswer === correctStr) isCor = true;
        }

        // Apply judgement
        this.judgeBuzz(isCor);
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
            card.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:5px; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="player-ans-name" style="flex:1;">${p.name}</span>
                        ${checkHtml}
                    </div>
                    <div class="player-ans-value ${!isAnswered ? 'waiting' : ''}" style="margin-top:2px;">${ansText}</div>
                    <div class="judge-btns-mini ${isAnswered ? '' : 'hidden'}" style="display:flex; gap:5px; margin-top:8px;">
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
        // New Card Elements
        const cardQ = document.getElementById('console-card-question');
        const cardCorrect = document.getElementById('console-card-correct');
        const cardPName = document.getElementById('console-card-player-name');
        const cardPAns = document.getElementById('console-card-player-answer-content');
        const cardBtns = document.getElementById('console-card-judge-area');

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

            if (q.type.startsWith('multi')) {
                // Multi-answer: manual reveal buttons with improved UI

                // Adjust Parent Layout for Multi-Answer
                cardCorrect.parentNode.style.flexDirection = 'column';
                cardCorrect.parentNode.style.alignItems = 'stretch';

                const correctList = Array.isArray(q.correct) ? q.correct : [q.correct];

                // Wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'multi-ans-wrapper';

                // Scroll Container
                const container = document.createElement('div');
                container.className = 'multi-ans-container';

                correctList.forEach((ans, idx) => {
                    const item = document.createElement('div');
                    const isRevealed = !!(this.revealedMultiIndices && this.revealedMultiIndices[idx]);

                    item.className = 'multi-ans-item' + (isRevealed ? ' revealed' : '');

                    // Internal Structure: Index | Text | Check
                    item.innerHTML = `
                        <div class="multi-ans-idx">${idx + 1}</div>
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

        // If no one selected yet, select the fastest or first
        if (!this.selectedPlayerId && sortedPlayers.length > 0) {
            this.selectedPlayerId = sortedPlayers[0].id;
        }

        horizontalList.innerHTML = '';
        sortedPlayers.forEach(p => {
            const chip = document.createElement('div');
            chip.className = `console-player-chip ${this.selectedPlayerId === p.id ? 'active' : ''}`;
            chip.textContent = p.name;
            chip.onclick = () => {
                this.selectedPlayerId = p.id;
                this.renderUnifiedConsole(players);
            };
            horizontalList.appendChild(chip);
        });

        // Update Big Display (Card)
        if (cardPAns) cardPAns.innerHTML = '';
        if (cardBtns) cardBtns.innerHTML = '';

        if (this.selectedPlayerId && players[this.selectedPlayerId]) {
            const p = players[this.selectedPlayerId];
            if (cardPName) cardPName.textContent = p.name;

            let ansText = p.lastAnswer;
            if (ansText === null || ansText === undefined) {
                if (p.buzzTime) ansText = "BUZZED!";
                else if (q && q.type.includes('oral')) ansText = "(口頭回答待ち)";
                else ansText = "WAITING...";
            }

            if (p.lastAnswer !== null && q && q.type === 'choice') {
                if (Array.isArray(p.lastAnswer)) {
                    ansText = p.lastAnswer.map(i => `${String.fromCharCode(65 + parseInt(i))}. ${q.c[i] || ''}`).join('<br>');
                } else {
                    const idx = parseInt(p.lastAnswer);
                    ansText = isNaN(idx) ? p.lastAnswer : `${String.fromCharCode(65 + idx)}. ${q.c[idx] || ''}`;
                }
            } else if (p.lastAnswer && q && q.type === 'sort') {
                // Sort logic display if needed
            }

            if (cardPAns) cardPAns.innerHTML = ansText;

            // Judge Buttons Logic
            const isAutoJudged = (q && ['choice', 'sort', 'letter_select'].includes(q.type));

            // Check if already judged (has result)
            if (p.lastResult) {
                // Determine status text for judged questions
                const statusDiv = document.createElement('div');
                statusDiv.style.width = '100%';
                statusDiv.style.textAlign = 'center';

                if (p.lastResult === 'win') {
                    statusDiv.className = 'btn-success';
                    statusDiv.style.padding = '15px';
                    statusDiv.style.borderRadius = '0';
                    statusDiv.innerHTML = '判定済: 正解 (CORRECT)';
                    statusDiv.style.opacity = '0.7';
                } else if (p.lastResult === 'lose') {
                    statusDiv.className = 'btn-danger';
                    statusDiv.style.padding = '15px';
                    statusDiv.style.borderRadius = '0';
                    statusDiv.innerHTML = '判定済: 不正解 (WRONG)';
                    statusDiv.style.opacity = '0.7';
                }
                if (cardBtns) cardBtns.appendChild(statusDiv);

            } else if (!isAutoJudged) {
                // Show manual buttons only if NOT auto-judged AND NOT yet judged
                const btnO = document.createElement('button');
                btnO.className = 'btn-success';
                btnO.style.flex = '1';
                btnO.style.margin = '0';
                btnO.style.borderRadius = '0';
                btnO.style.padding = '15px';
                btnO.style.fontSize = '1.2em';
                btnO.textContent = "正解 (O)";
                btnO.onclick = (e) => {
                    e.stopPropagation(); // Stop propagation just in case
                    console.log("Btn O Clicked for", this.selectedPlayerId);
                    App.Studio.updatePlayerScore(this.selectedPlayerId, true);
                };

                const btnX = document.createElement('button');
                btnX.className = 'btn-danger';
                btnX.style.flex = '1';
                btnX.style.margin = '0';
                btnX.style.borderRadius = '0';
                btnX.style.padding = '15px';
                btnX.style.fontSize = '1.2em';
                btnX.textContent = "不正解 (X)";
                btnX.onclick = (e) => {
                    e.stopPropagation();
                    console.log("Btn X Clicked for", this.selectedPlayerId);
                    App.Studio.updatePlayerScore(this.selectedPlayerId, false);
                };

                if (p.lastAnswer !== null && p.lastAnswer !== undefined) {
                    if (cardBtns) {
                        cardBtns.innerHTML = ''; // Clear just to be safe
                        cardBtns.appendChild(btnO);
                        cardBtns.appendChild(btnX);
                    }
                } else {
                    // まだ回答していない場合
                    const statusDiv = document.createElement('div');
                    statusDiv.style.width = '100%';
                    statusDiv.style.padding = '15px';
                    statusDiv.style.textAlign = 'center';
                    statusDiv.style.color = '#888';
                    statusDiv.textContent = "回答待ち (WAITING)";
                    if (cardBtns) {
                        cardBtns.innerHTML = '';
                        cardBtns.appendChild(statusDiv);
                    }
                }
            } else {
                // Auto-judged but waiting?
                const statusDiv = document.createElement('div');
                statusDiv.style.width = '100%';
                statusDiv.style.padding = '10px';
                statusDiv.style.textAlign = 'center';
                statusDiv.style.color = '#888';

                if (p.lastAnswer) {
                    statusDiv.textContent = "自動判定中...";
                } else {
                    statusDiv.textContent = "回答待ち (WAITING)";
                }
                if (cardBtns) cardBtns.appendChild(statusDiv);
            }
        } else {
            if (cardPName) cardPName.textContent = "---";
            if (cardPAns) cardPAns.textContent = "SELECT PLAYER";
        }
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
        window.db.ref(`rooms/${roomId}/players/${playerId}`).once('value', snap => {
            const p = snap.val();
            if (!p) return;
            const pts = isCorrect ? (q.points || 1) : -(q.loss || 0);
            const result = isCorrect ? 'win' : 'lose';
            snap.ref.update({
                periodScore: (p.periodScore || 0) + pts,
                totalScore: (p.totalScore || 0) + pts,
                lastResult: result
            });
            App.Ui.showToast(`${p.name} さんを ${isCorrect ? '正解' : '不正解'} に判定しました`);

            // ★ Multi-Answer Auto-Reveal Logic
            if (isCorrect && q.type && q.type.startsWith('multi')) {
                let matchedIndex = -1;
                // Try to find match in correct answers or choices
                if (q.c) {
                    // 1. Check if p.lastAnswer is an index (0, 1, 2...)
                    const ansIdx = parseInt(p.lastAnswer);
                    if (!isNaN(ansIdx) && q.c[ansIdx]) {
                        matchedIndex = ansIdx;
                    }
                    // 2. Check if p.lastAnswer matches label (e.g. "Chiyoda-ku")
                    else {
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
                        // Re-render controls to reflect change on host
                        this.renderMultiAnswerControls(q);
                    }
                }
            }

            // BUZZ MODE LOGIC
            if (App.Data.currentConfig.mode === 'buzz') {
                if (isCorrect) {
                    // Winner! Disable buzz.
                    window.db.ref(`rooms/${roomId}/status`).update({ isBuzzActive: false });
                    this.buzzWinner = null;
                    App.Ui.showToast("正解！早押し終了");
                } else {
                    // Wrong! Resume.
                    this.buzzWinner = null;
                    window.db.ref(`rooms/${roomId}/status`).update({
                        currentAnswerer: null,
                        currentAnswererName: null,
                        isBuzzActive: true
                    });

                    // Clear buzzTime for others (Fresh Start)
                    window.db.ref(`rooms/${roomId}/players`).once('value', allSnap => {
                        allSnap.forEach(child => {
                            // Don't clear lost status (already handled by update above?)
                            child.ref.update({ buzzTime: null });
                        });
                    });
                    App.Ui.showToast("不正解。早押し再開！");
                }
            }
        });
    },

    translateMode: function (mode) {
        const map = { 'normal': '一斉回答', 'buzz': '早押し', 'time_attack': 'タイムアタック', 'solo': 'ソロ' };
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

        // Merge saved config with defaults
        const defaultConfig = { mode: 'normal', gameType: 'score', theme: 'dark' };
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
};

window.startRoom = () => App.Studio.startRoom();
window.quickStartSet = (d) => App.Studio.quickStart(d);
window.quickStartProg = (d) => App.Studio.quickStartProg(d);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-judge-correct')?.addEventListener('click', () => App.Studio.judgeBuzz(true));
    document.getElementById('btn-judge-wrong')?.addEventListener('click', () => App.Studio.judgeBuzz(false));
    document.getElementById('btn-toggle-ans')?.addEventListener('click', () => App.Studio.toggleAns());
    document.getElementById('btn-force-next')?.addEventListener('click', () => App.Studio.goNext());
    document.getElementById('host-close-studio-btn')?.addEventListener('click', () => App.Dashboard.enter());
    document.getElementById('btn-phase-main')?.addEventListener('click', () => {
        if (App.Studio.onMainAction) App.Studio.onMainAction();
    });
});


document.getElementById('panel-selection-close')?.addEventListener('click', () => App.Studio.closePanelSelection());
