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

    soloState: { lives: 3, timeBank: 60, challengerIndex: 0 },

    startRoom: function (isQuick = false) {
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
            this.enterHostMode(isQuick);
        });
    },

    enterHostMode: function (isQuick) {
        App.Ui.showView(App.Ui.views.hostControl);
        const code = App.State.currentRoomId;

        const targets = ['studio-header-room-id', 'studio-big-room-id'];
        targets.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = code;
                el.onclick = () => {
                    navigator.clipboard.writeText(code).then(() => App.Ui.showToast("📋 Copy!"));
                };
            }
        });

        const btnAns = document.getElementById('btn-toggle-ans');
        if (btnAns) btnAns.style.display = 'none';

        this.toggleUIForStandby(true);

        window.db.ref(`rooms/${code}/players`).on('value', snap => {
            const players = snap.val() || {};
            const count = Object.keys(players).length;
            document.getElementById('studio-player-count-display').textContent = count;
            this.updatePlayerList(players);

            if (this.currentStepId === 3 || this.currentStepId === 4 || this.currentStepId === 5) {
                this.renderRealtimeAnswers(players);
            }

            if (App.Data.currentConfig?.mode === 'buzz' && this.currentStepId === 3) {
                this.checkBuzz(players);
            }
        });

        if (isQuick && App.Data.periodPlaylist.length > 0) {
            this.renderTimeline();
            setTimeout(() => this.setupPeriod(0), 500);
        } else {
            document.getElementById('studio-question-panel').classList.add('hidden');
            document.getElementById('studio-standby-panel').classList.remove('hidden');
            document.getElementById('studio-loader-ui').classList.remove('hidden');
            document.getElementById('btn-phase-main').classList.add('hidden');
            this.loadProgramList();
        }
    },

    toggleUIForStandby: function (isStandby) {
        const hideIds = ['studio-mode-display', 'studio-q-num-display', 'studio-step-display'];
        hideIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.parentNode) {
                el.parentNode.style.visibility = isStandby ? 'hidden' : 'visible';
            }
        });
        const footerTools = document.querySelector('.footer-tools');
        if (footerTools) footerTools.style.display = isStandby ? 'none' : 'flex';
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
        };
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
        if (!App.Data.periodPlaylist || App.Data.periodPlaylist.length === 0) {
            alert("再生するプレイリストがありません。");
            return;
        }

        const item = App.Data.periodPlaylist[index];
        if (!item) {
            alert(`エラー: セット番号[${index}]のデータが見つかりません。`);
            return;
        }

        App.State.currentPeriodIndex = index;
        // Ensure settings exist defensively
        if (!item.progSettings) item.progSettings = { showRankingAfter: false, eliminationMode: 'none' };

        App.Data.studioQuestions = this.shuffleQuestions(item.questions || []);
        App.Data.currentConfig = item.config || { mode: 'normal' };
        App.Data.currentConfig.periodTitle = item.title;
        App.State.currentQIndex = 0;

        const roomId = App.State.currentRoomId;
        window.db.ref(`rooms/${roomId}/config`).set(App.Data.currentConfig);
        window.db.ref(`rooms/${roomId}/questions`).set(App.Data.studioQuestions);

        document.getElementById('studio-standby-panel').classList.add('hidden');
        document.getElementById('studio-question-panel').classList.remove('hidden');

        const panelCtrl = document.getElementById('studio-panel-control');
        if (panelCtrl) {
            if (item.config.gameType === 'panel') {
                panelCtrl.classList.remove('hidden');
                this.renderPanelControl();
            } else {
                panelCtrl.classList.add('hidden');
            }
        }

        this.renderTimeline();

        if (item.config.mode === 'solo') {
            document.getElementById('studio-solo-info').classList.remove('hidden');
            this.soloState.lives = item.config.soloLife || 3;
            document.getElementById('studio-life-display').textContent = this.soloState.lives;
        } else {
            document.getElementById('studio-solo-info').classList.add('hidden');
        }

        this.revealedMultiIndices = {}; // Reset local state
        this.setStep(0);
    },

    setStep: function (stepId) {
        this.currentStepId = stepId;
        this.updateNextPreview(); // Update preview when step changes
        const btnMain = document.getElementById('btn-phase-main');
        const subControls = document.getElementById('studio-sub-controls');

        btnMain.className = 'btn-block btn-large-action';
        subControls.classList.add('hidden');
        btnMain.classList.remove('hidden');

        const isStandby = (stepId === 0 || stepId === 1);
        this.toggleUIForStandby(isStandby);

        const ansArea = document.getElementById('studio-player-answers');
        if (ansArea) {
            ansArea.classList.toggle('hidden', stepId < 2 || stepId > 6);
        }

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
        document.getElementById('studio-step-display').textContent = stepsJA[stepId];
        document.getElementById('studio-q-num-display').textContent = `${App.State.currentQIndex + 1}/${App.Data.studioQuestions.length}`;
        document.getElementById('studio-mode-display').textContent = this.translateMode(App.Data.currentConfig.mode);

        const q = App.Data.studioQuestions[App.State.currentQIndex];
        const roomId = App.State.currentRoomId;
        const syncBadge = document.getElementById('studio-player-sync-status');

        switch (stepId) {
            case 0: // 待機
                btnMain.textContent = `Q.${App.State.currentQIndex + 1} 問題開始`;
                btnMain.onclick = () => this.setStep(2); // Skip Step 1 (READING)
                syncBadge.textContent = "WAITING";
                syncBadge.style.background = "#333";

                const pTitle = App.Data.periodPlaylist[App.State.currentPeriodIndex].title;
                this.renderMonitorMessage("STANDBY", pTitle);
                this.resetPlayerStatus();
                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'standby',
                    qIndex: App.State.currentQIndex,
                    programTitle: pTitle
                });
                break;

            case 1: // 出題 (Monitor shows Q)
                btnMain.textContent = "回答受付スタート (START)";
                btnMain.classList.add('action-ready');
                btnMain.onclick = () => this.setStep(2);
                syncBadge.textContent = "QUESTION REVEAL";
                syncBadge.style.background = "rgba(255, 215, 0, 0.2)";

                this.renderQuestionMonitor(q);
                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'reveal_q',
                    qText: q.q,
                    qType: q.type,
                    choices: q.c || null
                });
                break;

            case 2: // 回答受付 (Timer Start)
                btnMain.textContent = "回答締め切り (CLOSE / STOP)";
                btnMain.classList.add('action-stop');
                btnMain.onclick = () => { this.setStep(3); };
                syncBadge.textContent = "ANSWERING";
                syncBadge.style.background = "rgba(0, 229, 255, 0.2)";

                this.renderQuestionMonitor(q);

                let updateData = {
                    step: 'answering',
                    qText: q.q,
                    qType: q.type,
                    choices: q.c || null,
                    startTime: firebase.database.ServerValue.TIMESTAMP,
                    isBuzzActive: (App.Data.currentConfig.mode === 'buzz')
                };
                const qLimit = q.timeLimit || 0;
                if (qLimit > 0) updateData.timeLimit = qLimit;

                window.db.ref(`rooms/${roomId}/status`).update(updateData);
                break;

            case 3: // 締め切り (Locked)
                const useManualFlip = App.Data.currentConfig.manualFlip || false;

                if (useManualFlip) {
                    btnMain.textContent = "回答を一斉オープン (FLIP)";
                    btnMain.onclick = () => this.setStep(4);
                    syncBadge.textContent = "CLOSED";
                    syncBadge.style.background = "rgba(255, 75, 43, 0.2)";
                } else {
                    // Skip manual flip phase, go straight to answer reveal
                    btnMain.textContent = "正解を発表 (SHOW CORRECT)";
                    btnMain.onclick = () => this.setStep(5);
                    syncBadge.textContent = "WAITING NEXT";
                    syncBadge.style.background = "rgba(255, 75, 43, 0.2)";
                }

                window.db.ref(`rooms/${roomId}/status`).update({ step: 'closed', isBuzzActive: false });
                break;

            case 4: // 回答表示 (Flip)
                btnMain.textContent = "正解を発表 (SHOW CORRECT)";
                btnMain.onclick = () => this.setStep(5);
                syncBadge.textContent = "REVEAL ANSWERS";
                syncBadge.style.background = "rgba(155, 89, 182, 0.2)";

                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'reveal_player',
                    displayMode: App.Data.currentConfig.displayMode || q.displayMode || 'flip'
                });
                break;

            case 5: // 正解発表
                btnMain.textContent = "判定を実行 (JUDGE)";
                btnMain.onclick = () => { this.judgeSimultaneous(); this.setStep(6); };
                syncBadge.textContent = "CORRECT REVEAL";
                syncBadge.style.background = "rgba(46, 204, 113, 0.2)";

                document.getElementById('studio-correct-display').classList.remove('hidden');
                document.getElementById('studio-commentary-text').textContent = q.commentary || "";

                window.db.ref(`rooms/${roomId}/status`).update({
                    step: 'reveal_correct',
                    correct: this.getAnswerString(q),
                    commentary: q.commentary || ""
                });
                break;

            case 6: // 判定 (Result Display)
                btnMain.textContent = "ランキング更新 (RANKING)";
                btnMain.classList.add('action-next');
                btnMain.onclick = () => this.setStep(7);
                syncBadge.textContent = "RESULT";
                syncBadge.style.background = "rgba(241, 196, 15, 0.2)";

                window.db.ref(`rooms/${roomId}/status`).update({ step: 'judging' });
                break;

            case 7: // 次へ
                this.goNext();
                break;
        }
    },

    goNext: function () {
        if (App.State.currentQIndex < App.Data.studioQuestions.length - 1) {
            App.State.currentQIndex++;
            this.resetPlayerStatus();
            this.setStep(0); // 次の問題の待機からスタート
        } else {
            this.handleSetCompletion();
        }
    },

    handleSetCompletion: function () {
        const item = App.Data.periodPlaylist[App.State.currentPeriodIndex];
        const nextIdx = App.State.currentPeriodIndex + 1;
        const hasNext = nextIdx < App.Data.periodPlaylist.length;

        // 1. 順位表示のチェック
        if (item.progSettings?.showRankingAfter && this.currentStepId !== 8) {
            this.currentStepId = 8; // Internal transition state
            window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ step: 'intermediate_ranking' });

            const btnMain = document.getElementById('btn-phase-main');
            btnMain.className = 'btn-block btn-large-action action-ready';

            if (item.progSettings?.eliminationMode !== 'none') {
                btnMain.textContent = "脱落者の判定へ (JUDGE ELIMINATION)";
                btnMain.onclick = () => this.handleSetCompletion();
            } else if (hasNext) {
                btnMain.textContent = `次のセットを開始 (${App.Data.periodPlaylist[nextIdx].title})`;
                btnMain.onclick = () => this.setupPeriod(nextIdx);
            } else {
                this.showFinalRankingOption();
            }
            return;
        }

        // 2. 脱落判定のチェック
        if (item.progSettings?.eliminationMode !== 'none' && this.currentStepId !== 9) {
            this.currentStepId = 9;
            this.performElimination(item.progSettings);

            const btnMain = document.getElementById('btn-phase-main');
            btnMain.className = 'btn-block btn-large-action action-ready';

            if (hasNext) {
                btnMain.textContent = `次のセットを開始 (${App.Data.periodPlaylist[nextIdx].title})`;
                btnMain.onclick = () => this.setupPeriod(nextIdx);
            } else {
                this.showFinalRankingOption();
            }
            return;
        }

        // 基本の遷移（設定がない場合）
        if (hasNext) {
            if (confirm("このセットは終了です。次のセットへ進みますか？")) {
                this.setupPeriod(nextIdx);
            } else {
                this.showNextSetWait(nextIdx);
            }
        } else {
            this.showFinalRankingOption();
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
            document.getElementById('studio-question-panel').classList.add('hidden');
            document.getElementById('studio-standby-panel').classList.remove('hidden');
            document.getElementById('btn-phase-main').classList.add('hidden');
            document.getElementById('studio-program-info').innerHTML = "<h2 style='color:#ffd700'>全プログラム終了 (COMPLETED)</h2><p>モニターに結果を表示中...</p>";
        }
    },

    showNextSetWait: function (nextIdx) {
        document.getElementById('studio-question-panel').classList.add('hidden');
        document.getElementById('studio-standby-panel').classList.remove('hidden');
        const btn = document.getElementById('btn-phase-main');
        btn.textContent = `次のセットを開始 (${App.Data.periodPlaylist[nextIdx].title})`;
        btn.classList.remove('hidden');
        btn.className = 'btn-block btn-large-action action-ready';
        btn.onclick = () => this.setupPeriod(nextIdx);
    },

    resetPlayerStatus: function () {
        const roomId = App.State.currentRoomId;
        window.db.ref(`rooms/${roomId}/players`).once('value', snap => {
            snap.forEach(p => {
                p.ref.update({ lastAnswer: null, lastResult: null, buzzTime: null });
            });
        });
    },

    renderMonitorMessage: function (label, text) {
        document.getElementById('studio-q-text').innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; height:200px;">
                <div style="font-size:2.5em; color:#ffd700; font-weight:bold; text-shadow:0 0 10px rgba(0,0,0,0.5);">
                    ${text}
                </div>
            </div>
        `;
        document.getElementById('studio-q-type-badge').textContent = label;
        document.getElementById('studio-choices-container').innerHTML = '';
        document.getElementById('studio-correct-display').classList.add('hidden');
    },

    renderQuestionMonitor: function (q) {
        if (!q) return;
        document.getElementById('studio-q-text').textContent = q.q;

        let typeText = q.type.toUpperCase();
        if (q.type === 'letter_select') typeText = "LETTER PANEL";
        document.getElementById('studio-q-type-badge').textContent = typeText;

        const cContainer = document.getElementById('studio-choices-container');
        cContainer.innerHTML = '';

        if (q.type === 'choice' && q.c) {
            q.c.forEach((c, i) => {
                const div = document.createElement('div');
                div.className = 'monitor-choice-item';
                div.textContent = `${String.fromCharCode(65 + i)}. ${c}`;
                cContainer.appendChild(div);
            });
        }
        else if (q.type === 'letter_select') {
            const div = document.createElement('div');
            div.style.gridColumn = "span 2";
            div.style.textAlign = "center";
            div.style.fontSize = "1.5em";
            div.style.color = "#ffd700";
            div.style.fontWeight = "bold";
            div.style.padding = "20px";
            div.style.border = "2px dashed #555";
            div.style.borderRadius = "8px";

            if (q.steps) {
                const correctStr = q.steps.map(s => s.correct).join('');
                div.textContent = `正解: ${correctStr} (パネル形式)`;
            } else {
                div.textContent = `正解: ${q.correct} (パネル形式)`;
            }
            cContainer.appendChild(div);
        }
        else if (q.type === 'sort') {
            q.c.forEach((c, i) => {
                const div = document.createElement('div');
                div.className = 'monitor-choice-item';
                div.textContent = `${String.fromCharCode(65 + i)}. ${c}`;
                cContainer.appendChild(div);
            });
        }
        else if (q.type === 'multi') {
            q.c.forEach((c, i) => {
                const btn = document.createElement('button');
                btn.className = 'monitor-choice-item';
                btn.style.cursor = 'pointer';
                btn.style.width = '100%';
                btn.style.textAlign = 'left';
                btn.style.border = this.revealedMultiIndices[i] ? '2px solid #00ffcc' : '1px solid #444';
                btn.style.background = this.revealedMultiIndices[i] ? 'rgba(0,255,204,0.1)' : 'rgba(255,255,255,0.05)';
                btn.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>${i + 1}. ${c}</span>
                        <span>${this.revealedMultiIndices[i] ? '👁️ 表示中' : '🌑 未表示'}</span>
                    </div>
                `;
                btn.onclick = () => this.toggleMultiAnswer(i);
                cContainer.appendChild(btn);
            });
        }

        const correctText = this.getAnswerString(q);
        document.getElementById('studio-correct-text').textContent = correctText;
        document.getElementById('studio-correct-display').classList.remove('hidden');
    },

    toggleMultiAnswer: function (index) {
        const roomId = App.State.currentRoomId;
        const q = App.Data.studioQuestions[App.State.currentQIndex];
        if (!q || q.type !== 'multi') return;

        this.revealedMultiIndices[index] = !this.revealedMultiIndices[index];

        // Update Firebase
        window.db.ref(`rooms/${roomId}/status`).update({
            revealedMulti: this.revealedMultiIndices
        });

        // Re-render host view
        this.renderQuestionMonitor(q);
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
        if (this.currentStepId !== 3 || this.buzzWinner) return;
        const candidates = Object.entries(players).filter(([_, p]) => p.buzzTime && !p.lastResult).sort((a, b) => a[1].buzzTime - b[1].buzzTime);
        if (candidates.length > 0) {
            this.buzzWinner = candidates[0][0];
            const name = candidates[0][1].name;
            const info = document.getElementById('studio-sub-info');
            info.classList.remove('hidden');
            info.innerHTML = `<span style="color:orange; font-weight:bold;">早押し: ${name}</span>`;
            info.classList.add('anim-pop-in');
            setTimeout(() => info.classList.remove('anim-pop-in'), 400);
            window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ currentAnswerer: this.buzzWinner, isBuzzActive: false });
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

                if (q.type === 'choice') {
                    if (p.lastAnswer == q.correct) isCor = true;
                } else if (q.type === 'letter_select') {
                    let correctStr = q.steps ? q.steps.map(s => s.correct).join('') : q.correct;
                    if (p.lastAnswer === correctStr) isCor = true;
                } else if (q.type === 'sort') {
                    // Normalize both to strings for comparison
                    let correctStr = Array.isArray(q.correct) ? q.correct.map(idx => String.fromCharCode(65 + idx)).join('') : q.correct;
                    if (p.lastAnswer === correctStr) isCor = true;
                } else {
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

        Object.keys(players).forEach(id => {
            const p = players[id];
            const card = document.createElement('div');
            card.className = 'player-ans-card';

            let ansText = "WAITING...";
            let isAnswered = false;

            if (p.lastAnswer !== null && p.lastAnswer !== undefined) {
                isAnswered = true;
                card.classList.add('has-answered');

                if (q && q.type === 'choice') {
                    const idx = parseInt(p.lastAnswer);
                    ansText = isNaN(idx) ? p.lastAnswer : String.fromCharCode(65 + idx);
                } else {
                    ansText = p.lastAnswer;
                }
            }

            card.innerHTML = `
                <span class="player-ans-name">${p.name}</span>
                <span class="player-ans-value ${!isAnswered ? 'waiting' : ''}">${ansText}</span>
            `;
            area.appendChild(card);
        });
    },

    translateMode: function (mode) {
        const map = { 'normal': '一斉回答', 'buzz': '早押し', 'time_attack': 'タイムアタック', 'solo': 'ソロ' };
        return map[mode] || mode.toUpperCase();
    },

    quickStart: function (setData) {
        console.log("Quick starting set:", setData.title);
        const unextDesign = { mainBgColor: "#0a0a0a", qTextColor: "#fff", qBgColor: "rgba(255,255,255,0.05)", qBorderColor: "#00bfff" };
        const questions = (setData.questions || []).map(q => { if (!q.design) q.design = unextDesign; return q; });

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
        App.Data.periodPlaylist = progData.playlist || [];
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

        const playerNames = Object.values(players).map(p => p.name || 'Guest');

        if (playerNames.length === 0) {
            listEl.innerHTML = '<span style="color:#666; font-size:0.8em;">待機中...</span>';
        } else {
            listEl.innerHTML = playerNames.map(name =>
                `<span class="player-chip">${name}</span>`
            ).join('');
        }
    },

    // Update next screen preview
    updateNextPreview: function () {
        const previewPanel = document.getElementById('studio-next-preview-panel');
        const previewContent = document.getElementById('studio-next-preview-content');
        const stepLabel = document.getElementById('preview-step-label');

        if (!previewPanel || !previewContent) return;

        const currentQ = App.Data.studioQuestions[App.State.currentQIndex];
        if (!currentQ) {
            previewPanel.classList.add('hidden');
            return;
        }

        previewPanel.classList.remove('hidden');

        let nextStep = '';
        let nextContent = '';

        if (this.currentStepId === 0) {
            nextStep = 'QUESTION';
            nextContent = `<div class="preview-q-text">${currentQ.q}</div>`;
        } else if (this.currentStepId === 1) {
            nextStep = 'CHOICES';
            if (currentQ.type === 'choice' && currentQ.c) {
                nextContent = `
                    <div class="preview-q-text" style="font-size:0.8em; margin-bottom:8px;">${currentQ.q}</div>
                    <div class="preview-choices">
                        ${currentQ.c.map((c, i) =>
                    `<div class="preview-choice-item">${i + 1}. ${c}</div>`
                ).join('')}
                    </div>
                `;
            } else {
                nextContent = '<div class="preview-placeholder">回答待機</div>';
            }
        } else if (this.currentStepId === 2) {
            nextStep = 'WAITING';
            nextContent = '<div class="preview-placeholder">回答受付中...</div>';
        } else if (this.currentStepId === 3 || this.currentStepId === 4) {
            nextStep = 'ANSWER';
            nextContent = `
                <div style="text-align:center;">
                    <div style="font-size:0.7em; color:#888; margin-bottom:5px;">CORRECT</div>
                    <div class="preview-q-text" style="color:#0f0;">${currentQ.correct || '正解'}</div>
                </div>
            `;
        } else if (this.currentStepId === 5) {
            const nextQ = App.Data.studioQuestions[App.State.currentQIndex + 1];
            if (nextQ) {
                nextStep = 'NEXT Q';
                nextContent = `
                    <div class="preview-q-text">Q.${App.State.currentQIndex + 2}</div>
                    <div style="font-size:0.8em; color:#aaa;">${nextQ.q.substring(0, 50)}...</div>
                `;
            } else {
                nextStep = 'END';
                nextContent = '<div class="preview-placeholder">終了</div>';
            }
        }

        stepLabel.textContent = nextStep;
        previewContent.innerHTML = nextContent;
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
});


document.getElementById('panel-selection-close')?.addEventListener('click', () => App.Studio.closePanelSelection());
