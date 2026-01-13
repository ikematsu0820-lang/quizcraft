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

    startRoom: function(isQuick = false) {
        this.isQuick = isQuick;
        App.Data.studioQuestions = [];
        App.State.currentQIndex = 0;
        App.State.currentPeriodIndex = 0;
        this.panelState = Array(25).fill(0);
        
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        App.State.currentRoomId = code;
        
        window.db.ref(`rooms/${code}`).set({
            questions: [],
            status: { step: 'standby', qIndex: 0, panels: this.panelState },
            config: { mode: 'normal' },
            players: {}
        }).then(() => {
            this.enterHostMode(isQuick);
        });
    },

    enterHostMode: function(isQuick) {
        App.Ui.showView(App.Ui.views.hostControl);
        const code = App.State.currentRoomId;
        
        const targets = ['studio-header-room-id', 'studio-big-room-id'];
        targets.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.textContent = code;
                el.onclick = () => {
                    navigator.clipboard.writeText(code).then(() => App.Ui.showToast("📋 Copy!"));
                };
            }
        });

        const btnAns = document.getElementById('btn-toggle-ans');
        if(btnAns) btnAns.style.display = 'none';

        this.toggleUIForStandby(true);

        window.db.ref(`rooms/${code}/players`).on('value', snap => {
            const players = snap.val() || {};
            const count = Object.keys(players).length;
            document.getElementById('studio-player-count-display').textContent = count;
            if(App.Data.currentConfig?.mode === 'buzz' && this.currentStepId === 3) {
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

    toggleUIForStandby: function(isStandby) {
        const hideIds = ['studio-mode-display', 'studio-q-num-display', 'studio-step-display'];
        hideIds.forEach(id => {
            const el = document.getElementById(id);
            if(el && el.parentNode) {
                el.parentNode.style.visibility = isStandby ? 'hidden' : 'visible';
            }
        });
        const footerTools = document.querySelector('.footer-tools');
        if(footerTools) footerTools.style.display = isStandby ? 'none' : 'flex';
    },

    loadProgramList: function() {
        const select = document.getElementById('studio-program-select');
        const btn = document.getElementById('studio-load-program-btn');
        const showId = App.State.currentShowId;

        if (!select || !btn) return;
        if (!showId) { select.innerHTML = '<option>エラー: ID未設定</option>'; return; }

        select.innerHTML = '<option>読込中...</option>';
        btn.disabled = true;

        window.db.ref(`saved_programs/${showId}`).once('value', snap => {
            const data = snap.val();
            select.innerHTML = '';
            const def = document.createElement('option');
            def.value = "";
            def.textContent = "-- 読み込むプログラムを選択 --";
            select.appendChild(def);

            if (data) {
                Object.keys(data).forEach(key => {
                    const prog = data[key];
                    const opt = document.createElement('option');
                    opt.value = JSON.stringify(prog);
                    opt.textContent = prog.title;
                    select.appendChild(opt);
                });
                select.disabled = false;
            } else {
                const opt = document.createElement('option');
                opt.textContent = "(保存されたプログラムがありません)";
                select.appendChild(opt);
            }
        });

        select.onchange = () => { btn.disabled = (select.value === ""); };

        btn.onclick = () => {
            const val = select.value;
            if (!val) return;
            try {
                const prog = JSON.parse(val);
                App.Data.periodPlaylist = prog.playlist || [];
                
                if (App.Data.periodPlaylist.length === 0) {
                    alert("⚠️ このプログラムにはセットが登録されていません。\n「ルール設定」でセットを追加して保存し直してください。");
                    return;
                }

                document.getElementById('studio-loader-ui').classList.add('hidden');
                document.getElementById('studio-program-info').textContent = "読込完了: " + prog.title;
                
                this.renderTimeline();

                const btnMain = document.getElementById('btn-phase-main');
                btnMain.textContent = "番組を開始 (START PROGRAM)";
                btnMain.classList.remove('hidden');
                btnMain.className = 'btn-block btn-large-action action-ready';
                
                btnMain.onclick = null; 
                btnMain.onclick = () => {
                    try {
                        this.setupPeriod(0);
                    } catch(e) { 
                        alert("開始エラー: " + e.message); 
                    }
                };

            } catch(e) { alert("読込失敗: データが壊れている可能性があります"); }
        };
    },

    renderTimeline: function() {
        const area = document.getElementById('studio-period-timeline');
        area.innerHTML = '';
        App.Data.periodPlaylist.forEach((item, i) => {
            const btn = document.createElement('button');
            const isActive = (i === App.State.currentPeriodIndex);
            btn.className = `btn-block ${isActive ? 'btn-info' : 'btn-dark'}`;
            btn.textContent = `${i+1}. ${item.title} [${this.translateMode(item.config.mode)}]`;
            btn.style.textAlign = 'left';
            btn.onclick = () => this.setupPeriod(i);
            area.appendChild(btn);
        });
    },

    setupPeriod: function(index) {
        if (!App.Data.periodPlaylist || App.Data.periodPlaylist.length === 0) {
            alert("再生するプレイリストがありません。");
            return;
        }
        
        const item = App.Data.periodPlaylist[index];
        if(!item) {
            alert(`エラー: セット番号[${index}]のデータが見つかりません。`);
            return;
        }

        App.State.currentPeriodIndex = index;
        App.Data.studioQuestions = item.questions || [];
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

        this.setStep(0);
    },

    setStep: function(stepId) {
        this.currentStepId = stepId;
        const btnMain = document.getElementById('btn-phase-main');
        const subControls = document.getElementById('studio-sub-controls');
        
        btnMain.className = 'btn-block btn-large-action';
        subControls.classList.add('hidden');
        btnMain.classList.remove('hidden');

        const isStandby = (stepId === 0 || stepId === 1);
        this.toggleUIForStandby(isStandby);

        const stepsJA = ['待機中', '準備中', '出題中', '回答中', '回答締切', '正解表示', '次へ'];
        document.getElementById('studio-step-display').textContent = stepsJA[stepId];
        document.getElementById('studio-q-num-display').textContent = `${App.State.currentQIndex + 1}/${App.Data.studioQuestions.length}`;
        document.getElementById('studio-mode-display').textContent = this.translateMode(App.Data.currentConfig.mode);

        const q = App.Data.studioQuestions[App.State.currentQIndex];
        const roomId = App.State.currentRoomId;

        switch(stepId) {
            case 0: // STANDBY
                btnMain.textContent = `Q.${App.State.currentQIndex + 1} ゲーム開始`;
                btnMain.onclick = () => this.setStep(1);
                
                const pTitle = App.Data.periodPlaylist[App.State.currentPeriodIndex].title;
                this.renderMonitorMessage("PROGRAM", pTitle);
                
                this.resetPlayerStatus();

                window.db.ref(`rooms/${roomId}/status`).update({ 
                    step: 'standby', 
                    qIndex: App.State.currentQIndex,
                    programTitle: pTitle
                });
                break;
                
            case 1: // READY -> Step 3
                btnMain.textContent = "ゲーム開始 (START)";
                btnMain.classList.add('action-ready');
                btnMain.onclick = () => this.setStep(3);
                
                this.renderMonitorMessage("QUESTION", `Q. ${App.State.currentQIndex + 1}`);
                window.db.ref(`rooms/${roomId}/status`).update({ step: 'ready' });
                break;
            
            case 3: // ANSWERING
                btnMain.textContent = "回答締め切り (CLOSE)";
                btnMain.classList.add('action-stop');
                if(App.Data.currentConfig.mode === 'buzz' || App.Data.currentConfig.mode === 'solo') {
                    subControls.classList.remove('hidden');
                    btnMain.classList.add('hidden'); 
                } else {
                    btnMain.onclick = () => { this.judgeSimultaneous(); this.setStep(4); };
                }
                
                this.renderQuestionMonitor(q);
                
                let updateData = { 
                    step: 'answering', 
                    startTime: firebase.database.ServerValue.TIMESTAMP,
                    isBuzzActive: (App.Data.currentConfig.mode === 'buzz')
                };
                const qLimit = q.timeLimit || 0;
                if (qLimit > 0) updateData.timeLimit = qLimit;
                else if (App.Data.currentConfig.mode === 'solo' && App.Data.currentConfig.soloTimeVal) {
                    updateData.timeLimit = App.Data.currentConfig.soloTimeVal;
                }
                
                window.db.ref(`rooms/${roomId}/status`).update(updateData);
                break;
                
            case 4: // RESULT (CLOSED)
                btnMain.textContent = "正解を発表 (SHOW ANSWER)";
                btnMain.onclick = () => this.setStep(5);
                window.db.ref(`rooms/${roomId}/status`).update({ step: 'result', isBuzzActive: false });
                break;
                
            case 5: // ANSWER (REVEAL)
                btnMain.textContent = "次の問題へ (NEXT) >>";
                btnMain.classList.add('action-next');
                btnMain.onclick = () => this.setStep(6);
                document.getElementById('studio-correct-display').classList.remove('hidden');
                window.db.ref(`rooms/${roomId}/status`).update({ step: 'answer' });
                break;
                
            case 6: // NEXT
                this.goNext();
                break;
        }
    },

    goNext: function() {
        if (App.State.currentQIndex < App.Data.studioQuestions.length - 1) {
            App.State.currentQIndex++;
            this.setStep(0);
        } else {
            const nextIdx = App.State.currentPeriodIndex + 1;
            if (nextIdx < App.Data.periodPlaylist.length) {
                if(confirm("このセットは終了です。次のセットへ進みますか？")) {
                    this.setupPeriod(nextIdx);
                } else {
                    document.getElementById('studio-question-panel').classList.add('hidden');
                    document.getElementById('studio-standby-panel').classList.remove('hidden');
                    const btn = document.getElementById('btn-phase-main');
                    btn.textContent = `次のセットを開始 (${App.Data.periodPlaylist[nextIdx].title})`;
                    btn.classList.remove('hidden');
                    btn.className = 'btn-block btn-large-action action-ready';
                    btn.onclick = () => this.setupPeriod(nextIdx);
                }
            } else {
                if(confirm("全プログラム終了です。最終結果を表示しますか？")) {
                    window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ step: 'final_ranking' });
                    document.getElementById('studio-question-panel').classList.add('hidden');
                    document.getElementById('studio-standby-panel').classList.remove('hidden');
                    document.getElementById('btn-phase-main').classList.add('hidden');
                    document.getElementById('studio-program-info').innerHTML = "<h2 style='color:#ffd700'>全プログラム終了 (COMPLETED)</h2><p>モニターに結果を表示中...</p>";
                }
            }
        }
    },

    resetPlayerStatus: function() {
        const roomId = App.State.currentRoomId;
        window.db.ref(`rooms/${roomId}/players`).once('value', snap => {
            snap.forEach(p => {
                p.ref.update({ lastAnswer: null, lastResult: null, buzzTime: null });
            });
        });
    },

    renderMonitorMessage: function(label, text) {
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

    renderQuestionMonitor: function(q) {
        if(!q) return;
        document.getElementById('studio-q-text').textContent = q.q;
        
        let typeText = q.type.toUpperCase();
        if(q.type === 'letter_select') typeText = "LETTER PANEL";
        document.getElementById('studio-q-type-badge').textContent = typeText;
        
        const cContainer = document.getElementById('studio-choices-container');
        cContainer.innerHTML = '';

        if(q.type === 'choice' && q.c) {
            q.c.forEach((c, i) => {
                const div = document.createElement('div');
                div.className = 'monitor-choice-item';
                div.textContent = `${String.fromCharCode(65+i)}. ${c}`;
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
                div.textContent = `${i+1}. ${c}`;
                cContainer.appendChild(div);
            });
        }

        let correctText = "";
        if (q.type === 'choice') {
            if(Array.isArray(q.correct)) {
                correctText = (q.c) ? q.correct.map(i=>q.c[i]).join(' / ') : q.correct.join(' / ');
            } else {
                correctText = (q.c) ? q.c[q.correct] : q.correct;
            }
        } else if (q.type === 'letter_select') {
            correctText = q.steps ? q.steps.map(s => s.correct).join('') : q.correct;
        } else {
            correctText = q.correct;
        }
        
        document.getElementById('studio-correct-text').textContent = correctText;
        document.getElementById('studio-correct-display').classList.remove('hidden');
    },

    renderPanelControl: function() {
        const grid = document.getElementById('studio-panel-grid');
        if(!grid) return;
        
        grid.innerHTML = '';
        this.panelState.forEach((color, i) => {
            const btn = document.createElement('button');
            btn.className = 'panel-editor-cell';
            btn.textContent = i + 1;
            btn.dataset.index = i;
            if(color === 1) btn.classList.add('bg-red');
            else if(color === 2) btn.classList.add('bg-green');
            else if(color === 3) btn.classList.add('bg-white');
            else if(color === 4) btn.classList.add('bg-blue');
            
            btn.onclick = () => {
                this.panelState[i] = this.selectedPanelColor;
                this.renderPanelControl();
                window.db.ref(`rooms/${App.State.currentRoomId}/status/panels`).set(this.panelState);
                window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ step: 'panel' });
            };
            grid.appendChild(btn);
        });
    },

    setPanelColor: function(colorCode) {
        this.selectedPanelColor = colorCode;
        const names = ["クリア(黒)", "Red", "Green", "White", "Blue"];
        const disp = document.getElementById('panel-selected-color');
        if(disp) disp.textContent = names[colorCode];
        document.querySelectorAll('.p-btn').forEach(b => b.style.border = '1px solid #555');
    },

    checkBuzz: function(players) {
        if(this.currentStepId !== 3 || this.buzzWinner) return;
        const candidates = Object.entries(players).filter(([_, p]) => p.buzzTime && !p.lastResult).sort((a, b) => a[1].buzzTime - b[1].buzzTime);
        if(candidates.length > 0) {
            this.buzzWinner = candidates[0][0];
            const name = candidates[0][1].name;
            const info = document.getElementById('studio-sub-info');
            info.classList.remove('hidden');
            info.innerHTML = `<span style="color:orange; font-weight:bold;">早押し: ${name}</span>`;
            window.db.ref(`rooms/${App.State.currentRoomId}/status`).update({ currentAnswerer: this.buzzWinner, isBuzzActive: false });
        }
    },
    
    judgeBuzz: function(isCorrect) {
        if (App.Data.currentConfig.mode === 'solo') { this.judgeSolo(isCorrect); return; }
        if(!this.buzzWinner) return;
        
        const roomId = App.State.currentRoomId;
        const pts = App.Data.studioQuestions[App.State.currentQIndex].points || 1;
        const action = App.Data.currentConfig.buzzWrongAction || 'reset'; // ★設定確認

        window.db.ref(`rooms/${roomId}/players/${this.buzzWinner}`).once('value', snap => {
            const p = snap.val();
            if(isCorrect) {
                // 正解時
                snap.ref.update({ periodScore: (p.periodScore||0) + pts, lastResult: 'win' });
                this.buzzWinner = null;
                document.getElementById('studio-sub-info').classList.add('hidden');
                this.setStep(4);
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

    judgeSolo: function(isCorrect) {
        if (isCorrect) { this.setStep(5); } else {
            this.soloState.lives--;
            document.getElementById('studio-life-display').textContent = this.soloState.lives;
            if (this.soloState.lives <= 0) alert("ゲームオーバー");
        }
    },

    judgeSimultaneous: function() {
        const q = App.Data.studioQuestions[App.State.currentQIndex];
        window.db.ref(`rooms/${App.State.currentRoomId}/players`).once('value', snap => {
            snap.forEach(pSnap => {
                const p = pSnap.val();
                let isCor = false;
                
                if(q.type === 'choice') {
                    if (p.lastAnswer == q.correct) isCor = true;
                } else if (q.type === 'letter_select') {
                    let correctStr = "";
                    if (q.steps) correctStr = q.steps.map(s => s.correct).join('');
                    else correctStr = q.correct;
                    if (p.lastAnswer === correctStr) isCor = true;
                } else {
                    if (p.lastAnswer == q.correct) isCor = true;
                }

                if(isCor) pSnap.ref.update({ periodScore: (p.periodScore||0) + 1, lastResult: 'win' });
                else pSnap.ref.update({ lastResult: 'lose' });
            });
        });
    },

    toggleAns: function() { document.getElementById('studio-correct-display').classList.toggle('hidden'); },
    
    translateMode: function(mode) {
        const map = { 'normal': '一斉回答', 'buzz': '早押し', 'time_attack': 'タイムアタック', 'solo': 'ソロ' };
        return map[mode] || mode.toUpperCase();
    },

    quickStart: function(setData) {
        const unextDesign = { mainBgColor: "#0a0a0a", qTextColor: "#fff", qBgColor: "rgba(255,255,255,0.05)", qBorderColor: "#00bfff" };
        const questions = (setData.questions||[]).map(q => { if(!q.design) q.design = unextDesign; return q; });
        App.Data.periodPlaylist = [{
            title: setData.title || "クイックプレイ",
            questions: questions,
            config: { mode: 'normal', gameType: 'score', theme: 'dark' }
        }];
        this.startRoom(true); 
    }
};

window.startRoom = () => App.Studio.startRoom();
window.quickStartSet = (d) => App.Studio.quickStart(d);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-judge-correct')?.addEventListener('click', () => App.Studio.judgeBuzz(true));
    document.getElementById('btn-judge-wrong')?.addEventListener('click', () => App.Studio.judgeBuzz(false));
    document.getElementById('btn-toggle-ans')?.addEventListener('click', () => App.Studio.toggleAns());
    document.getElementById('btn-force-next')?.addEventListener('click', () => App.Studio.goNext());
    document.getElementById('host-close-studio-btn')?.addEventListener('click', () => App.Dashboard.enter());
});
