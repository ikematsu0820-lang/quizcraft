/* =========================================================
 * viewer.js (v200: Professional 8-Phase Support)
 * =======================================================*/

window.App = window.App || {};
window.App.Viewer = {
    roomId: null,
    config: {},
    questions: [],

    init: function () {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('id');

        if (code) {
            document.getElementById('viewer-login-view').classList.add('hidden');
            this.connect(code);
        } else {
            const btn = document.getElementById('viewer-connect-btn');
            if (btn) {
                btn.onclick = () => {
                    const input = document.getElementById('viewer-room-code');
                    if (input && input.value.trim()) this.connect(input.value.trim());
                };
            }
        }

        const dashBtn = document.querySelector('#viewer-login-view .back-to-main');
        if (dashBtn) {
            dashBtn.addEventListener('click', () => {
                if (window.enterDashboard) window.enterDashboard();
            });
        }
    },

    connect: function (code) {
        this.roomId = code.toUpperCase();
        const btn = document.getElementById('viewer-connect-btn');
        if (btn) { btn.disabled = true; btn.textContent = "Connecting..."; }

        window.db.ref(`rooms/${this.roomId}`).once('value', snap => {
            if (snap.exists()) {
                document.getElementById('viewer-login-view').classList.add('hidden');
                if (!window.App.isUnifiedMode) {
                    document.getElementById('viewer-main-view').classList.remove('hidden');
                }
                this.startListener();
            } else {
                alert("Room not found");
                if (btn) { btn.disabled = false; btn.textContent = "接続する"; }
            }
        });
    },

    startListener: function () {
        const refs = {
            config: window.db.ref(`rooms/${this.roomId}/config`),
            status: window.db.ref(`rooms/${this.roomId}/status`),
            questions: window.db.ref(`rooms/${this.roomId}/questions`),
            players: window.db.ref(`rooms/${this.roomId}/players`)
        };

        refs.config.on('value', snap => {
            this.config = snap.val() || {};
        });

        refs.questions.on('value', snap => {
            this.questions = snap.val() || [];
        });

        refs.status.on('value', snap => {
            const st = snap.val();
            if (!st) return;
            this.render(st);
        });

        refs.players.on('value', () => {
            if (this.config.gameType === 'race') this.updateViewerRace();
        });
    },

    render: function (st) {
        const mainText = document.getElementById('viewer-main-text');
        const statusDiv = document.getElementById('viewer-status');
        const viewContainer = document.getElementById('viewer-main-view');

        ['viewer-panel-grid', 'viewer-bomb-grid', 'viewer-multi-grid', 'viewer-race-area', 'viewer-timer-bar-area'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        document.getElementById('viewer-sub-text').innerHTML = '';

        if (this.config.gameType === 'race') {
            document.getElementById('viewer-race-area').classList.remove('hidden');
            this.updateViewerRace();
        }

        // --- 1. STANDBY ---
        if (st.step === 'standby') {
            statusDiv.textContent = "WAITING";

            const firstQ = this.questions[0] || {};
            if (firstQ.isTitleHidden) {
                mainText.innerHTML = '';
            } else if (firstQ.prodDesign && (firstQ.prodDesign.titleText || firstQ.prodDesign.titleBgColor || firstQ.isTitleHidden === false)) {
                this.renderProduction(viewContainer, mainText, 'title', firstQ, st);
            } else {
                this.applyDefaultDesign(viewContainer, null);
                const title = st.programTitle || this.config.periodTitle || "Quiz Studio";

                mainText.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%;">
                        <div style="font-size:5vw; font-weight:900; color:#ffd700; text-shadow:0 0 30px rgba(255,215,0,0.5); margin-bottom:20px; text-align:center; padding:0 20px;">
                            ${title}
                        </div>
                        <div style="font-size:2vw; color:#fff; font-family:monospace; letter-spacing:5px;">ROOM ID: ${this.roomId}</div>
                        <div style="margin-top:50px; font-size:1.5vw; color:#00bfff; animation:pulse 2s infinite;">READY TO START...</div>
                    </div>
                    <style>@keyframes pulse { 0%{opacity:0.6;} 50%{opacity:1;} 100%{opacity:0.6;} }</style>
                `;
            }
        }
        // --- 1.5. REVEAL Q NUM ---
        else if (st.step === 'reveal_q_num') {
            statusDiv.textContent = "NEXT Q";
            const q = this.questions[st.qIndex] || {};

            if (q.isQNumHidden) {
                mainText.innerHTML = '';
            } else if (q.prodDesign) {
                this.renderProduction(viewContainer, mainText, 'qnumber', q, st);
            } else {
                this.applyDefaultDesign(viewContainer, null);
                mainText.innerHTML = `
                    <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                        <div style="font-size:12vw; color:#fff; font-weight:900; text-shadow:0 0 30px rgba(0,0,0,0.5);">
                            ${st.qNumLabel || `第 ${st.qIndex + 1} 問`}
                        </div>
                    </div>
                `;
            }
        }
        // --- 2. REVEAL Q (Phase 1) ---
        else if (st.step === 'reveal_q') {
            statusDiv.textContent = "QUIZ";
            const q = this.questions[st.qIndex] || {};
            this.applyDefaultDesign(viewContainer, q.design);
            if (q.type === 'blackjack' && st.bjCards) {
                this.renderBlackjackQuestion(mainText, q, st);
            } else if (q.isHidden) {
                mainText.innerHTML = '';
            } else {
                this.renderQuestionLayout(viewContainer, mainText, q, st, st.revealedMulti);
            }
        }
        // --- 3. ANSWERING (Phase 2) ---
        else if (st.step === 'answering') {
            statusDiv.textContent = "THINKING";
            const q = this.questions[st.qIndex] || {};
            this.applyDefaultDesign(viewContainer, q.design);
            if (q.isHidden) {
                mainText.innerHTML = '';
            } else {
                this.renderQuestionLayout(viewContainer, mainText, q, st, st.revealedMulti);
            }

        }
        // --- 4. CLOSED (Phase 3) ---
        else if (st.step === 'closed') {
            statusDiv.textContent = "LOCKED";
            const q = this.questions[st.qIndex] || {};
            this.renderQuestionLayout(viewContainer, mainText, q, st, st.revealedMulti);
            const msg = document.createElement('div');
            msg.style = "position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:12vh; font-weight:900; color:#ff3d00; text-shadow:0 0 40px rgba(0,0,0,0.9); animation:popInCenter 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index:500;";
            msg.textContent = "TIME UP!";
            mainText.appendChild(msg);
        }
        // --- 5. REVEAL PLAYER ANSWERS (Phase 4: FLIP) ---
        else if (st.step === 'reveal_player' || st.step === 'result') {
            statusDiv.textContent = "RESPONSES";
            const q = this.questions[st.qIndex] || {};
            this.applyDefaultDesign(viewContainer, q.design);

            if (q.isResHidden || q.isHidden) {
                mainText.innerHTML = '';
                return;
            }

            // Check if Question Changed
            if (this._lastQIndex !== st.qIndex) {
                this._lastQIndex = st.qIndex;
                this.revealedMultiIndexes = new Set();
            }

            // Handle Multi-Answer Progressive Reveal
            if (q.type && (q.type.startsWith('multi') || q.type.startsWith('ranking'))) {
                // Combine persistent state (st.revealedMulti) with session state (revealedMultiIndexes)
                // st.revealedMulti is the source of truth from Host Control
                const combinedRevealed = { ...(st.revealedMulti || {}) };

                // Fallback for legacy singluar updates if any
                if (st.revealMultiIndex !== undefined && st.revealMultiIndex !== null) {
                    this.revealedMultiIndexes = this.revealedMultiIndexes || new Set();
                    this.revealedMultiIndexes.add(st.revealMultiIndex);
                }
                if (this.revealedMultiIndexes) {
                    this.revealedMultiIndexes.forEach(i => combinedRevealed[i] = true);
                }

                this.renderQuestionLayout(viewContainer, mainText, q, st, combinedRevealed);

            } else {
                // Normal Player Reveal
                this.renderQuestionLayout(viewContainer, mainText, q, st);
                this.renderAllPlayerAnswers(mainText, st.displayMode || 'flip', q);
            }
        }
        // --- 6. REVEAL CORRECT (Phase 5) ---
        else if (st.step === 'reveal_correct' || st.step === 'answer') {
            statusDiv.textContent = "ANSWER";
            const q = this.questions[st.qIndex] || {};
            this.applyDefaultDesign(viewContainer, q.design);

            if (q.type === 'blackjack' && st.bjPickedCard) {
                this.renderBlackjackReveal(mainText, st);
                return;
            }

            if (q.isAnsHidden) {
                mainText.innerHTML = '';
                return;
            }

            // Sort answer reveal: replace entire content with ordered list (no choice grid behind it)
            if (q.type === 'sort') {
                mainText.style.flexDirection = '';
                mainText.style.justifyContent = '';
                mainText.style.alignItems = '';
                this.renderSortReveal(mainText, q, st);
                return;
            }

            this.renderQuestionLayout(viewContainer, mainText, q, st, st.revealedMulti);

            // Suppress popup for ANY multi type that has a grid layout (q.c)
            if (q.type && (q.type.startsWith('multi') || q.type.startsWith('ranking')) && Array.isArray(q.c) && q.c.length > 0) return;

            // Dobon answer reveal: color-code choice grid (trap=red, safe=green) like multi-answer
            const isDobon = (q.mode === 'dobon' || q.mode === 'multi' || q.multi);
            if (isDobon && Array.isArray(q.c) && q.c.length > 0) {
                const trapSet = new Set(Array.isArray(q.correct) ? q.correct.map(Number) : (q.correct !== undefined ? [Number(q.correct)] : []));
                mainText.querySelectorAll('.choice-item').forEach((el, i) => {
                    const isTrap = trapSet.has(i);
                    el.style.background = isTrap ? '#ff5555' : '#2ecc71';
                    el.style.border = '3px solid #fff';
                    el.style.color = '#fff';
                    el.style.transform = isTrap ? 'scale(1.0)' : 'scale(1.05)';
                    el.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                    const prefix = el.querySelector('.choice-prefix');
                    if (prefix) { prefix.style.display = ''; prefix.style.color = '#fff'; }
                });
                return;
            }

            // Normal choice: TV-show style reveal — light up correct, dim others
            if (q.type === 'choice' && Array.isArray(q.c) && q.c.length > 0) {
                const correctIdx = parseInt(q.correctIndex !== undefined ? q.correctIndex : q.correct);
                mainText.querySelectorAll('.choice-item').forEach((el, i) => {
                    el.style.transition = 'all 0.35s ease';
                    if (i === correctIdx) {
                        el.style.background = 'linear-gradient(135deg, #ffd700 0%, #ffec3d 100%)';
                        el.style.color = '#1a1000';
                        el.style.border = '3px solid #fff';
                        el.style.boxShadow = '0 0 24px rgba(255,215,0,0.95), 0 0 60px rgba(255,215,0,0.55), 0 0 100px rgba(255,200,0,0.25)';
                        el.style.transform = 'scale(1.04)';
                        el.style.zIndex = '10';
                        el.style.fontWeight = '900';
                        el.style.opacity = '1';
                        el.style.filter = '';
                        const prefix = el.querySelector('.choice-prefix');
                        if (prefix) { prefix.style.color = '#1a1000'; prefix.style.display = ''; }
                    } else {
                        el.style.opacity = '0.32';
                        el.style.background = 'rgba(20,20,20,0.85)';
                        el.style.filter = 'grayscale(70%) brightness(0.5)';
                        el.style.border = '1px solid rgba(255,255,255,0.08)';
                        el.style.boxShadow = 'none';
                        el.style.transform = 'scale(1)';
                    }
                });
                const commentary = st.commentary || q.commentary || '';
                if (commentary) {
                    const cd = document.createElement('div');
                    cd.style.cssText = 'position:absolute;bottom:2.5vh;left:50%;transform:translateX(-50%);font-size:2.2vh;color:#aaa;text-align:center;max-width:85%;font-family:sans-serif;pointer-events:none;';
                    cd.textContent = commentary;
                    mainText.appendChild(cd);
                }
                return;
            }

            const accent = q.design?.qBorderColor || '#00bfff';
            const answerBox = document.createElement('div');
            Object.assign(answerBox.style, {
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: '300', background: 'rgba(0,0,0,0.95)', border: `6px solid ${accent}`,
                borderRadius: '20px', padding: '40px 60px', color: '#fff',
                boxShadow: '0 0 80px rgba(0,0,0,0.9)', textAlign: 'center', minWidth: '60vw',
                animation: 'popInCenter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            });

            const ansStr = st.correct || this.getAnswerString(q);
            const fontSize = ansStr.length > 20 ? '4vh' : ansStr.length > 10 ? '6vh' : '8vh';

            const labelText = "CORRECT ANSWER";
            const labelColor = accent;

            answerBox.innerHTML = `
                <div style="font-size:3vh; color:${labelColor}; font-weight:800; margin-bottom:15px; letter-spacing:2px;">${labelText}</div>
                <div style="font-size:${fontSize}; font-weight:900; line-height:1.2; word-break:break-all; max-width:80vw;">${ansStr}</div>
                <div style="font-size:2.5vh; color:#aaa; font-weight:normal; margin-top:20px; border-top:1px solid #333; padding-top:20px;">${st.commentary || q.commentary || ""}</div>
            `;
            mainText.appendChild(answerBox);
        }
        // --- 7. JUDGING (Phase 6) ---
        else if (st.step === 'judging') {
            statusDiv.textContent = "RESULTS";
            const q = this.questions[st.qIndex] || {};
            this.renderQuestionLayout(viewContainer, mainText, q, st);
        }
        // --- 8. RANKING (Intermediate / Final) ---
        else if (st.step === 'intermediate_ranking' || st.step === 'final_ranking') {
            const isFinal = st.step === 'final_ranking';
            statusDiv.textContent = isFinal ? "FINALE" : "STANDINGS";
            this.applyDefaultDesign(viewContainer, null);
            this.renderRanking(mainText, isFinal);
        }
        // --- 9. ELIMINATION ---
        else if (st.step === 'elimination') {
            statusDiv.textContent = "SURVIVAL";
            this.applyDefaultDesign(viewContainer, null);
            this.renderElimination(mainText, st.eliminationData);
        }
        // --- 10. OTHERS ---
        else if (st.step === 'panel') {
            statusDiv.textContent = "PANEL";
            this.applyDefaultDesign(viewContainer, null);
            mainText.innerHTML = '';
            this.renderPanelGrid(st.panels);
        }
        else if (st.step === 'bomb') {
            statusDiv.textContent = "BOMB";
            this.applyDefaultDesign(viewContainer, null);
            mainText.innerHTML = '';
            this.renderBombGrid(st.cards);
        }
        // --- BLACKJACK FINAL RESULT ---
        else if (st.step === 'bj_result') {
            statusDiv.textContent = "RESULT";
            this.applyDefaultDesign(viewContainer, null);
            const isPerfect = (st.bjWinnerTotal === (st.bjTarget || 21));
            mainText.innerHTML = `
                <div style="text-align:center;padding:4vh 2vw;font-family:sans-serif;">
                    <div style="font-size:2.5vh;color:#888;letter-spacing:0.2em;margin-bottom:1.5vh;">🃏 NUMBER GAME — RESULT</div>
                    <div style="font-size:2.2vh;color:#888;margin-bottom:1vh;">WINNER</div>
                    <div style="font-size:9vh;font-weight:900;color:#2ecc71;text-shadow:0 0 50px #2ecc71aa;line-height:1.1;animation:popInCenter 0.6s cubic-bezier(0.175,0.885,0.32,1.275);">${st.bjWinner || '---'}</div>
                    <div style="margin-top:2.5vh;display:inline-flex;align-items:center;gap:2vw;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.1);border-radius:16px;padding:1.5vh 3vw;">
                        <div style="text-align:center;">
                            <div style="font-size:1.4vh;color:#666;letter-spacing:0.1em;">SCORE</div>
                            <div style="font-size:5vh;font-weight:900;color:${isPerfect ? '#ffd700' : '#fff'};text-shadow:${isPerfect ? '0 0 30px #ffd700aa' : 'none'};">${st.bjWinnerTotal || 0}</div>
                        </div>
                        <div style="color:#444;font-size:3vh;">/</div>
                        <div style="text-align:center;">
                            <div style="font-size:1.4vh;color:#666;letter-spacing:0.1em;">TARGET</div>
                            <div style="font-size:5vh;font-weight:900;color:#ffd700;">${st.bjTarget || 21}</div>
                        </div>
                    </div>
                    ${isPerfect ? '<div style="font-size:2.5vh;color:#ffd700;font-weight:900;margin-top:2vh;letter-spacing:0.15em;text-shadow:0 0 20px #ffd700aa;">🎯 PERFECT SCORE!</div>' : ''}
                </div>
            `;
        }
        // --- SELECTING SET (Container / Multi) ---
        else if (st.step === 'selecting_set') {
            statusDiv.textContent = "SELECT";
            this.applyDefaultDesign(viewContainer, null);

            const cTitle = st.containerTitle || '選択コンテナ';
            // containerOptions (新) または containerSets (旧) に対応
            const opts = st.containerOptions || st.containerSets || [];

            let optsHtml = '';
            opts.forEach((label, i) => {
                optsHtml += `
                    <div style="
                        background: rgba(255,255,255,0.04);
                        border: 2px solid rgba(255,170,0,0.4);
                        border-radius: 16px;
                        padding: 3vh 5vw;
                        display: flex;
                        align-items: center;
                        gap: 3vw;
                        animation: fadeSlideIn ${0.4 + i * 0.15}s ease-out backwards;
                        min-width: 280px;
                    ">
                        <div style="font-size:5vh; font-weight:900; color:#ffaa00; width:1.5em; text-align:center; flex-shrink:0;">${i + 1}</div>
                        <div style="font-size:3.5vh; font-weight:700; color:#fff;">${label}</div>
                    </div>
                `;
            });

            mainText.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%; gap:3vh;">
                    <div style="font-size:2.5vw; color:#ffaa00; font-weight:900; text-shadow:0 0 20px rgba(255,170,0,0.4); margin-bottom:1vh;">
                        📦 ${cTitle}
                    </div>
                    <div style="font-size:1.8vw; color:#aaa; margin-bottom:2vh; animation:pulse 2s infinite;">
                        司会者がコースを選択しています...
                    </div>
                    <div style="display:flex; flex-direction:column; gap:2vh; align-items:stretch; width:70%; max-width:900px;">
                        ${optsHtml}
                    </div>
                </div>
                <style>
                    @keyframes fadeSlideIn { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
                    @keyframes pulse { 0%{opacity:0.6;} 50%{opacity:1;} 100%{opacity:0.6;} }
                </style>
            `;
        }

        this.updateTimeLimitDisplay(st);
    },

    viewerTimeLimitTimerId: null,

    updateTimeLimitDisplay: function (st) {
        const timerArea = document.getElementById('viewer-timer-bar-area');
        const timerBar = document.getElementById('viewer-timer-bar');
        if (!timerArea || !timerBar) return;

        if (this.viewerTimeLimitTimerId) {
            clearInterval(this.viewerTimeLimitTimerId);
            this.viewerTimeLimitTimerId = null;
        }

        if (!st.timeLimit || !['question', 'answering', 'reveal_q'].includes(st.step)) {
            timerArea.classList.add('hidden');
            timerBar.style.width = '100%';
            timerBar.style.transition = 'none';
            return;
        }

        timerArea.classList.remove('hidden');
        timerBar.style.transition = 'none';

        const duration = st.timeLimit;
        const startTimeStamp = st.timeLimitStart || Date.now();
        const endTime = startTimeStamp + (duration * 1000);

        const tick = () => {
            const now = Date.now();
            const remain = Math.max(0, endTime - now);
            const percent = Math.min(100, Math.max(0, (remain / (duration * 1000)) * 100));

            timerBar.style.width = percent + '%';

            if (percent <= 20) {
                timerBar.style.backgroundColor = '#ff4b2b';
            } else {
                timerBar.style.backgroundColor = '#ffd700';
            }

            if (remain <= 0 && this.viewerTimeLimitTimerId) {
                clearInterval(this.viewerTimeLimitTimerId);
                this.viewerTimeLimitTimerId = null;
            }
        };

        tick();
        this.viewerTimeLimitTimerId = setInterval(tick, 200);
    },

    renderProduction: function (container, contentBox, type, q, st) {
        const s = q.prodDesign || {};

        let html = '';
        if (type === 'title') {
            const title = st.programTitle || this.config.periodTitle || "Quiz Studio";
            const displayTitle = (s.titleText || title).replace(/\\n/g, '<br>');

            container.style.backgroundColor = s.titleBgColor || '#000';
            container.style.backgroundImage = 'none';

            html = `
                <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-family:${s.titleFont || 'sans-serif'};">
                    <div style="color:${s.titleTextColor || '#fff'}; font-size:${s.titleSize || '8vw'}; font-weight:900; text-align:center; padding: 0 50px; line-height:1.2;">
                        ${displayTitle}
                    </div>
                </div>
            `;
        } else if (type === 'qnumber') {
            const displayQNum = (s.qNumberText || `第${st.qIndex + 1}問`).replace(/\\n/g, '<br>');
            const pos = {
                'center': 'align-items:center; justify-content:center;',
                'top': 'align-items:flex-start; justify-content:center; padding-top:50px;',
                'bottom': 'align-items:flex-end; justify-content:center; padding-bottom:50px;'
            };

            container.style.backgroundColor = s.qNumberBgColor || '#000';
            container.style.backgroundImage = 'none';

            html = `
                <div style="width:100%; height:100%; display:flex; ${pos[s.qNumberPosition || 'center']}; font-family:${s.qNumberFont || 'sans-serif'};">
                    <div style="color:${s.qNumberTextColor || '#fff'}; font-size:${s.qNumberSize || '15vw'}; font-weight:900; text-align:center; line-height:1.2;">
                        ${displayQNum}
                    </div>
                </div>
            `;
        }

        contentBox.innerHTML = html;
    },

    renderBlackjackQuestion: function (container, q, st) {
        const cards = st.bjCards || q.c || [];
        const values = q.values || [];
        const usedCards = st.bjUsedCards || [];
        const target = st.bjTarget || q.target || 21;
        const currentTotal = st.bjCurrentTotal || 0;
        const answererName = st.currentAnswererName || '';
        const pickedHistory = st.bjPickedHistory || [];

        const diff = target - currentTotal;
        let scoreColor = '#2ecc71', scoreGlow = 'none';
        if (currentTotal === target) { scoreColor = '#ffd700'; scoreGlow = '0 0 30px #ffd700aa'; }
        else if (currentTotal > target) { scoreColor = '#e74c3c'; scoreGlow = '0 0 30px #e74c3caa'; }
        else if (diff <= 3) { scoreColor = '#f39c12'; scoreGlow = '0 0 20px #f39c12aa'; }

        const cols = cards.length <= 6 ? 3 : cards.length <= 12 ? 4 : 5;

        let cardsHtml = cards.map((name, idx) => {
            const isUsed = usedCards.includes(idx);
            const val = values[idx] !== undefined ? values[idx] : '';
            return `
                <div style="
                    border-radius:14px;
                    border:2px solid ${isUsed ? '#252525' : '#ffd700'};
                    background:${isUsed ? 'rgba(255,255,255,0.02)' : 'linear-gradient(145deg,#2a2000,#1a1500)'};
                    color:${isUsed ? '#2a2a2a' : '#ffd700'};
                    opacity:${isUsed ? '0.3' : '1'};
                    padding:1.8vh 1vw;
                    text-align:center;
                    box-shadow:${isUsed ? 'none' : '0 4px 16px rgba(255,215,0,0.12),inset 0 1px 0 rgba(255,255,255,0.05)'};
                    transition:all 0.3s;
                    position:relative;
                ">
                    <div style="font-size:2.8vh; font-weight:900;">${name}</div>
                    ${val !== '' ? `<div style="font-size:1.6vh; margin-top:0.4vh; font-weight:700; color:${isUsed ? '#2a2a2a' : '#ffcc00'};">${val}pt</div>` : ''}
                    ${isUsed ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2.5vh;color:#333;">✓</div>' : ''}
                </div>`;
        }).join('');

        let historyHtml = pickedHistory.map(h => `
            <div style="display:flex;align-items:center;gap:1vw;background:rgba(255,215,0,0.05);border:1px solid rgba(255,215,0,0.15);border-radius:10px;padding:1vh 1.2vw;font-size:1.7vh;">
                <span style="color:#777;min-width:7vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h.playerName}</span>
                <span style="color:#ffd700;font-weight:900;font-size:2vh;">${h.name}</span>
                <span style="color:#f39c12;font-weight:700;margin-left:auto;">+${h.value}</span>
            </div>`).join('');

        container.innerHTML = `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;box-sizing:border-box;padding:2vh 2vw;gap:1.5vh;font-family:sans-serif;">

                <!-- Question -->
                <div style="text-align:center;color:#fff;font-size:3vh;font-weight:900;padding:1.2vh 2vw;border:2px solid rgba(0,191,255,0.25);border-radius:12px;background:rgba(0,191,255,0.04);letter-spacing:0.04em;">${q.q || ''}</div>

                <!-- Score bar -->
                <div style="display:flex;gap:1.5vw;justify-content:center;">
                    <div style="flex:1;text-align:center;padding:1.2vh 1vw;background:rgba(255,215,0,0.05);border:2px solid rgba(255,215,0,0.25);border-radius:14px;">
                        <div style="font-size:1.3vh;color:#666;letter-spacing:0.12em;font-weight:700;margin-bottom:0.3vh;">TARGET</div>
                        <div style="font-size:5.5vh;font-weight:900;color:#ffd700;text-shadow:0 0 20px #ffd700aa;line-height:1;">${target}</div>
                    </div>
                    <div style="flex:1;text-align:center;padding:1.2vh 1vw;background:rgba(${currentTotal > target ? '231,76,60' : '46,204,113'},0.05);border:2px solid rgba(${currentTotal > target ? '231,76,60' : '46,204,113'},0.25);border-radius:14px;${answererName ? '' : 'opacity:0.35;'}">
                        <div style="font-size:1.3vh;color:#666;letter-spacing:0.12em;font-weight:700;margin-bottom:0.3vh;">${answererName ? answererName : 'CURRENT'}</div>
                        <div style="font-size:5.5vh;font-weight:900;color:${scoreColor};text-shadow:${scoreGlow};line-height:1;">${currentTotal}</div>
                        ${currentTotal > target ? '<div style="font-size:1.2vh;color:#e74c3c;font-weight:700;">BUST</div>' : ''}
                    </div>
                    ${answererName ? `<div style="flex:1;text-align:center;padding:1.2vh 1vw;background:rgba(155,89,182,0.05);border:2px solid rgba(155,89,182,0.25);border-radius:14px;">
                        <div style="font-size:1.3vh;color:#666;letter-spacing:0.12em;font-weight:700;margin-bottom:0.3vh;">REMAINING</div>
                        <div style="font-size:5.5vh;font-weight:900;color:#9b59b6;line-height:1;">${Math.max(0, diff)}</div>
                    </div>` : ''}
                </div>

                <!-- Panels + History -->
                <div style="flex:1;display:flex;gap:2vw;overflow:hidden;min-height:0;">
                    <!-- Available panels -->
                    <div style="flex:2;overflow:auto;">
                        <div style="font-size:1.3vh;color:#555;letter-spacing:0.12em;font-weight:700;margin-bottom:1vh;">AVAILABLE PANELS</div>
                        <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:1.2vh;">${cardsHtml}</div>
                    </div>
                    ${pickedHistory.length > 0 ? `
                    <!-- Picked history -->
                    <div style="flex:1;overflow:auto;min-width:0;">
                        <div style="font-size:1.3vh;color:#555;letter-spacing:0.12em;font-weight:700;margin-bottom:1vh;">PICKED HISTORY</div>
                        <div style="display:flex;flex-direction:column;gap:0.7vh;">${historyHtml}</div>
                    </div>` : ''}
                </div>
            </div>
        `;
    },

    renderBlackjackReveal: function (container, st) {
        const target = st.bjTarget || 21;
        const newTotal = st.bjNewTotal || 0;
        const isBusted = newTotal > target;
        const isPerfect = newTotal === target;
        const isStand = st.bjIsStand;

        let totalColor = '#2ecc71', totalGlow = '0 0 30px #2ecc71aa';
        if (isPerfect) { totalColor = '#ffd700'; totalGlow = '0 0 60px #ffd700aa'; }
        else if (isBusted) { totalColor = '#e74c3c'; totalGlow = '0 0 60px #e74c3caa'; }
        else if (target - newTotal <= 3) { totalColor = '#f39c12'; totalGlow = '0 0 40px #f39c12aa'; }

        if (isStand) {
            container.innerHTML = `
                <div style="text-align:center;padding:5vh 2vw;font-family:sans-serif;">
                    <div style="font-size:2.5vh;color:#888;margin-bottom:2vh;">${st.bjPickedPlayerName || ''}</div>
                    <div style="font-size:9vh;font-weight:900;color:#9b59b6;text-shadow:0 0 40px #9b59b6aa;animation:popInCenter 0.5s cubic-bezier(0.175,0.885,0.32,1.275);letter-spacing:0.05em;">STAND</div>
                    <div style="font-size:2.2vh;color:#777;margin-top:2vh;">カードを引かずに勝負に出ました</div>
                    <div style="font-size:3.5vh;color:${totalColor};font-weight:900;margin-top:2.5vh;text-shadow:${totalGlow};">合計 ${newTotal} / 目標 ${target}</div>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div style="text-align:center;padding:3vh 2vw;font-family:sans-serif;">
                <div style="font-size:2.2vh;color:#888;margin-bottom:1.5vh;">${st.bjPickedPlayerName || ''} が引いたパネル</div>
                <!-- Card -->
                <div style="display:inline-block;background:linear-gradient(145deg,#2a2000,#1a1200);border:3px solid #ffd700;border-radius:24px;padding:2.5vh 5vw;box-shadow:0 0 60px rgba(255,215,0,0.25),inset 0 1px 0 rgba(255,255,255,0.08);animation:popInCenter 0.5s cubic-bezier(0.175,0.885,0.32,1.275);margin-bottom:2.5vh;">
                    <div style="font-size:9vh;font-weight:900;color:#ffd700;text-shadow:0 0 40px #ffd700aa;line-height:1.1;">${st.bjPickedCard || '?'}</div>
                    <div style="font-size:3.2vh;color:#ffcc00;font-weight:700;margin-top:0.8vh;">+${st.bjPickedValue || 0}pt</div>
                </div>
                <!-- New total -->
                <div style="display:flex;justify-content:center;align-items:center;gap:3vw;">
                    <div style="text-align:center;">
                        <div style="font-size:1.5vh;color:#555;letter-spacing:0.12em;margin-bottom:0.5vh;">NEW TOTAL</div>
                        <div style="font-size:8vh;font-weight:900;color:${totalColor};text-shadow:${totalGlow};line-height:1;">${newTotal}</div>
                        ${isBusted ? '<div style="font-size:2vh;color:#e74c3c;font-weight:900;letter-spacing:0.15em;margin-top:0.5vh;">💥 BUST</div>' : isPerfect ? '<div style="font-size:2vh;color:#ffd700;font-weight:900;letter-spacing:0.15em;margin-top:0.5vh;">🎯 PERFECT!</div>' : ''}
                    </div>
                    <div style="color:#444;font-size:4vh;">/</div>
                    <div style="text-align:center;">
                        <div style="font-size:1.5vh;color:#555;letter-spacing:0.12em;margin-bottom:0.5vh;">TARGET</div>
                        <div style="font-size:8vh;font-weight:900;color:#ffd700;line-height:1;">${target}</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderAllPlayerAnswers: function (container, mode, q) {
        window.db.ref(`rooms/${this.roomId}/players`).once('value', snap => {
            const players = snap.val() || {};
            const playerList = Object.values(players);

            if (mode === 'distribution' && q.type === 'choice') {
                this.renderDistribution(container, playerList, q);
            } else {
                this.renderFlipGrid(container, playerList, q);
            }
        });
    },

    renderFlipGrid: function (container, players, q) {
        const grid = document.createElement('div');
        grid.className = 'viewer-flip-container';

        players.forEach((p, i) => {
            const card = document.createElement('div');
            card.className = 'viewer-flip-card';

            let ans = p.lastAnswer;
            if (q.type === 'choice' && ans !== null && ans !== undefined) {
                const idx = parseInt(ans);
                ans = isNaN(idx) ? ans : String.fromCharCode(65 + idx);
            } else if (q.type === 'sort' && ans !== null && ans !== undefined) {
                // For sort, show letters nicely e.g. "A B C D"
                ans = ans.split('').join(' ');
            } else if (ans === null || ans === undefined || ans === "") {
                ans = "---";
            }

            card.innerHTML = `
                <div class="flip-name">${p.name}</div>
                <div class="flip-front"></div>
                <div class="flip-back">${ans}</div>
            `;
            grid.appendChild(card);

            // Staggered Flip animation
            setTimeout(() => card.classList.add('flipped'), 1000 + (i * 100));
        });
        container.appendChild(grid);
    },

    renderDistribution: function (container, players, q) {
        const counts = Array(q.c ? q.c.length : 4).fill(0);
        players.forEach(p => {
            if (p.lastAnswer !== null && p.lastAnswer !== undefined) {
                const idx = parseInt(p.lastAnswer);
                if (idx >= 0 && idx < counts.length) counts[idx]++;
            }
        });

        const distContainer = document.createElement('div');
        distContainer.className = 'viewer-dist-container';

        const max = Math.max(...counts, 1);

        counts.forEach((count, i) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'dist-bar-wrapper';

            const bar = document.createElement('div');
            bar.className = 'dist-bar';
            bar.setAttribute('data-count', count);

            const label = document.createElement('div');
            label.className = 'dist-label';
            label.textContent = String.fromCharCode(65 + i);

            wrapper.appendChild(bar);
            wrapper.appendChild(label);
            distContainer.appendChild(wrapper);

            setTimeout(() => {
                bar.style.height = (count / max * 100) + '%';
            }, 100);
        });
        container.appendChild(distContainer);
    },

    renderRanking: function (container, isFinal) {
        window.db.ref(`rooms/${this.roomId}/players`).once('value', snap => {
            const players = snap.val() || {};
            const arr = Object.values(players).map(p => ({
                name: p.name,
                score: p.periodScore || 0,
                isAlive: p.isAlive !== false
            })).sort((a, b) => b.score - a.score);

            let html = `
                <div style="text-align:center; width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <h1 style="font-size:6vh; color:#ffd700; text-shadow:0 0 20px #ffd700; margin-bottom:4vh;">${isFinal ? 'FINAL RESULTS' : 'CURRENT RANKING'}</h1>
                    <div style="width:70%; max-width:1000px; background:rgba(0,0,0,0.5); padding:20px; border-radius:10px;">
            `;

            arr.filter(p => p.isAlive).slice(0, 10).forEach((p, i) => {
                let rankColor = "#fff";
                let size = "3vh";
                let medal = "";

                if (i === 0) { rankColor = "#ffd700"; size = "5vh"; medal = "👑"; }
                else if (i === 1) { rankColor = "#c0c0c0"; size = "4vh"; medal = "🥈"; }
                else if (i === 2) { rankColor = "#cd7f32"; size = "4vh"; medal = "🥉"; }

                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #444; font-size:${size}; color:${rankColor}; animation:slideIn ${0.5 + i * 0.15}s ease-out; opacity:0; animation-fill-mode:forwards;">
                        <div style="font-weight:bold; width:10%;">${i + 1}</div>
                        <div style="flex:1; text-align:left; padding-left:20px;">${medal} ${p.name}</div>
                        <div style="font-weight:900;">${p.score} <span style="font-size:0.6em;">pts</span></div>
                    </div>
                `;
            });

            html += `
                    </div>
                    ${isFinal ? '<div style="margin-top:30px; font-size:2vh; color:#aaa;">CONGRATULATIONS!</div>' : ''}
                </div>
                <style>@keyframes slideIn { from { opacity:0; transform:translateX(-50px); } to { opacity:1; transform:translateX(0); } }</style>
            `;
            container.innerHTML = html;
        });
    },

    renderElimination: function (container, data) {
        if (!data) return;
        const { droppedOut = [], survivors = [], mode = 'none', count = 0 } = data;

        let title = mode === 'dropout' ? "ELIMINATION" : "SURVIVORS";
        let subTitle = mode === 'dropout' ? `成績下位 ${count} 名が脱落` : `成績上位 ${count} 名が通過`;

        let html = `
            <div style="text-align:center; width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <h1 style="font-size:8vh; color:#ff3d00; text-shadow:0 0 30px rgba(255,0,0,0.5); margin-bottom:1vh; animation:popIn 0.5s;">${title}</h1>
                <p style="font-size:3vh; color:#aaa; margin-bottom:5vh;">${subTitle}</p>
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; width:80%;">
        `;

        const all = [...survivors, ...droppedOut];
        all.forEach((p, i) => {
            const isOut = droppedOut.some(d => d.name === p.name);
            const color = isOut ? "#ff5555" : "#00ffcc";
            const statusText = isOut ? "DROPPED OUT" : "PASS";

            html += `
                <div style="background:rgba(20,20,20,0.8); border:2px solid ${color}; padding:20px; border-radius:15px; animation:popIn ${0.5 + i * 0.1}s backwards;">
                    <div style="font-size:1.5vh; color:${color}; margin-bottom:5px; font-weight:800;">${statusText}</div>
                    <div style="font-size:3vh; font-weight:bold; color:#fff;">${p.name}</div>
                    <div style="font-size:2vh; color:#888;">${p.score} pts</div>
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;
    },

    renderQuestionLayout: function (container, contentBox, q, st = {}, revealedMulti = {}) {
        const d = q.design || {};
        const layout = q.layout || 'standard';
        const align = q.align || 'center';
        // revealedMulti passed as argument overrides st.revealedMulti if any
        // const revealedMulti = st.revealedMulti || {}; // Remove this line if using argument

        // Background
        container.style.backgroundColor = d.mainBgColor || '#0a0a0a';
        if (d.bgImage) {
            container.style.backgroundImage = `url(${d.bgImage})`;
            container.style.backgroundSize = "cover";
            container.style.backgroundPosition = "center";
        } else {
            container.style.backgroundImage = (d.mainBgColor === '#0a0a0a') ? "radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)" : "none";
        }

        let html = '';

        // Common Styles for Text
        const textColor = d.qTextColor || '#fff';
        const borderColor = d.qBorderColor || 'var(--color-primary)';

        // Free Input
        if (q.type === 'free_oral' || q.type === 'free_written') {
            contentBox.style.flexDirection = 'column';
            contentBox.style.justifyContent = 'center';
            contentBox.style.alignItems = 'center';

            // Reusing q-area for consistent look
            html += `<div class="q-area" style="color:${textColor}; border-color:${borderColor}; background-color:${d.qBgColor || ''}; text-align:${align}; font-size:6vh; width:80%;">
                ${q.q}
            </div>`;

        } else {
            // Standard / Split (Includes Multi-Answer now)
            if (layout === 'standard') {
                contentBox.style.flexDirection = 'column';
                contentBox.style.justifyContent = 'center';
                contentBox.style.alignItems = 'center';

                html += `<div class="q-area" style="color:${textColor}; border-color:${borderColor}; background-color:${d.qBgColor || ''}; text-align:${align};">
                    ${q.q}
                </div>`;

                if (q.c) {
                    const rows = parseInt(d.gridRows) || 0;
                    const cols = parseInt(d.gridCols) || 0;
                    let gridStyle = '';
                    if (rows > 0 && cols > 0) {
                        gridStyle = `display:grid; grid-template-columns: repeat(${cols}, 1fr); gap:2vh;`;
                    }

                    html += `<div class="c-area" style="${gridStyle}">`;
                    q.c.forEach((c, i) => {
                        const isRevealed = revealedMulti[i];
                        const isAssoc = (q.type && q.type.startsWith('assoc'));
                        const isMultiType = (q.type && (q.type.startsWith('multi') || q.type.startsWith('ranking') || isAssoc));
                        const isAnswerPhase = (st.step === 'reveal_correct' || st.step === 'answer');
                        const isMissed = isMultiType && !isAssoc && isAnswerPhase && !isRevealed;

                        let bgStyle = isRevealed ? 'background:#2ecc71;' : (d.cBgColor ? `background:${d.cBgColor};` : '');
                        if (isMissed) bgStyle = 'background:#ff5555;';

                        let bStyle = isRevealed ? 'border:3px solid #fff;' : (d.cBorderColor ? `border:1px solid ${d.cBorderColor};` : '');
                        if (isMissed) bStyle = 'border:3px solid #fff;';

                        let colorStyle = isRevealed ? 'color:#fff;' : `color:${d.cTextColor || '#ddd'};`;
                        if (isMissed) colorStyle = 'color:#fff;';

                        let transformStyle = isRevealed ? 'transform: scale(1.05); z-index:10;' : '';
                        if (isMissed) transformStyle = 'transform: scale(1.0); z-index:5; opacity:1;';

                        const isHidden = isMultiType && !isRevealed && !isMissed;

                        const prefixLabel = q.type.startsWith('ranking') ? `${i + 1}位` : String.fromCharCode(65 + i);

                        html += `<div class="choice-item" style="${colorStyle} ${bgStyle} ${bStyle} ${transformStyle} transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                            <span class="choice-prefix" style="color:${isRevealed || isMissed ? '#fff' : borderColor}; ${isMultiType && !q.type.startsWith('ranking') && !isAssoc ? 'display:none;' : ''}">${prefixLabel}</span> 
                            <span style="${isHidden ? 'visibility:hidden;' : ''}">${c}</span>
                        </div>`;
                    });
                    html += `</div>`;
                }
            } else {
                // Split
                const isSplit = true; // reusing existing logic
                // For split, we use special container class or inline layout
                // Since css has .layout-split-list, let's use it wrapper?
                // But container is 'viewer-main-text' (passed as mainText). We append to it?
                // No, contentBox IS mainText.

                // We need to apply 'layout-split-list' to the container for CSS to take effect?
                // Or wrap it.
                // CSS .layout-split-list targets THE CONTAINER of .q-area and .c-area.
                // Let's create a wrapper.

                html += `<div class="viewer-layout-container layout-split-list" style="width:100%; height:85%; display:flex; flex-direction:row-reverse; justify-content:center; align-items:center;">
                    <div class="q-area" style="color:${textColor}; border-color:${borderColor}; background-color:${d.qBgColor || ''}; text-align:${align}; width:25vw; height:80vh; margin:0 0 0 5vw;">
                        ${q.q}
                    </div>
                    <div class="c-area" style="width:50vw; box-sizing:border-box; ${(parseInt(d.gridRows) > 0 && parseInt(d.gridCols) > 0)
                        ? `display:grid; grid-template-columns:repeat(${parseInt(d.gridCols)}, 1fr); gap:2vh;`
                        : ''
                    }">`;

                if (q.c) {
                    q.c.forEach((c, i) => {

                        const isRevealed = revealedMulti[i];
                        const isAssoc = (q.type && q.type.startsWith('assoc'));
                        const isMultiType = (q.type && (q.type.startsWith('multi') || q.type.startsWith('ranking') || isAssoc));
                        const isAnswerPhase = (st.step === 'reveal_correct' || st.step === 'answer');
                        const isMissed = isMultiType && !isAssoc && isAnswerPhase && !isRevealed;

                        let bgStyle = isRevealed ? 'background:#2ecc71;' : (d.cBgColor ? `background:${d.cBgColor};` : '');
                        if (isMissed) bgStyle = 'background:#ff5555;';

                        let bStyle = isRevealed ? 'border:3px solid #fff;' : (d.cBorderColor ? `border:1px solid ${d.cBorderColor};` : '');
                        if (isMissed) bStyle = 'border:3px solid #fff;';

                        let colorStyle = isRevealed ? 'color:#fff;' : `color:${d.cTextColor || '#ddd'};`;
                        if (isMissed) colorStyle = 'color:#fff;';

                        let transformStyle = isRevealed ? 'transform: scale(1.05); z-index:10;' : '';
                        if (isMissed) transformStyle = 'transform: scale(1.0); z-index:5; opacity:1;';

                        const isHidden = isMultiType && !isRevealed && !isMissed;

                        const prefixLabel = q.type.startsWith('ranking') ? `${i + 1}位` : String.fromCharCode(65 + i);

                        html += `<div class="choice-item" style="${colorStyle} ${bgStyle} ${bStyle} ${transformStyle} transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                            <span class="choice-prefix" style="color:${isRevealed || isMissed ? '#fff' : borderColor}; ${isMultiType && !q.type.startsWith('ranking') && !isAssoc ? 'display:none;' : ''}">${prefixLabel}</span> 
                            <span style="${isHidden ? 'visibility:hidden;' : ''}">${c}</span>
                        </div>`;
                    });
                }
                html += `</div></div>`;
            }
        }
        contentBox.innerHTML = html;
    },

    getAnswerString: function (q) {
        if (!q) return "";
        if (q.type === 'choice' && q.c) {
            if (Array.isArray(q.correct)) return q.correct.map(idx => q.c[idx]).join(' / ');
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

    renderSortReveal: function (contentBox, q, st) {
        const d = q.design || {};
        const textColor = d.qTextColor || '#fff';
        const borderColor = d.qBorderColor || '#00bfff';
        const qBgColor = d.qBgColor || 'rgba(0,0,0,0.5)';

        // Parse correct order (array of original indices, e.g. [3,0,2,1])
        let correctOrder = [];
        if (Array.isArray(q.correct)) {
            correctOrder = q.correct.map(Number);
        } else if (typeof q.correct === 'string') {
            correctOrder = q.correct.split('').map(c => c.charCodeAt(0) - 65);
        }

        // Badge colors per letter (A=blue, B=red, C=green, D=yellow, E=purple, F=pink, G=teal, H=orange)
        const badgeColors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#e91e63', '#1abc9c', '#e67e22', '#16a085', '#c0392b'];

        const rows = correctOrder.map((origIdx, rank) => {
            const label = String.fromCharCode(65 + origIdx);
            const text = (q.c && q.c[origIdx] !== undefined) ? q.c[origIdx] : label;
            const color = badgeColors[origIdx % badgeColors.length];
            const delay = rank * 0.07;
            return `<div style="display:flex;align-items:center;gap:1.5vw;background:rgba(5,15,50,0.8);border-radius:10px;padding:1vh 1.5vw;border:1px solid rgba(255,255,255,0.12);animation:slideInLeft ${0.2 + delay}s ease-out both;">
                <div style="width:5vh;height:5vh;min-width:5vh;border-radius:50%;background:${color};border:3px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;font-size:2.4vh;font-weight:900;color:#fff;flex-shrink:0;box-shadow:0 2px 10px ${color}88;">${label}</div>
                <div style="font-size:2.8vh;font-weight:700;color:#fff;line-height:1.3;">${text}</div>
            </div>`;
        }).join('');

        const commentary = st.commentary || q.commentary || '';

        contentBox.innerHTML = `
            <style>@keyframes slideInLeft { from { opacity:0; transform:translateX(-40px); } to { opacity:1; transform:translateX(0); } }</style>
            <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;padding:2vh 3vw;box-sizing:border-box;overflow:hidden;">
                <div style="font-size:3vh;font-weight:700;color:${textColor};text-align:center;padding:1.2vh 2.5vw;background:${qBgColor};border-radius:10px;border-left:5px solid ${borderColor};width:90%;max-width:90vw;margin-bottom:1.5vh;line-height:1.4;">${q.q}</div>
                <div style="font-size:2.2vh;color:#ffd700;font-weight:900;letter-spacing:0.25em;margin-bottom:1.2vh;text-shadow:0 0 15px #ffd70066;">正　解</div>
                <div style="width:90%;max-width:90vw;flex:1;display:flex;flex-direction:column;gap:0.7vh;background:rgba(0,0,0,0.35);border:3px solid ${borderColor};border-radius:14px;padding:1.2vh 1.2vw;box-shadow:0 0 30px ${borderColor}44;overflow:hidden;">
                    ${rows}
                </div>
                ${commentary ? `<div style="font-size:2vh;color:#aaa;margin-top:1vh;text-align:center;max-width:90vw;">${commentary}</div>` : ''}
            </div>
        `;
    },

    applyDefaultDesign: function (container, design) {
        const d = design || { mainBgColor: '#0a0a0a' };
        container.style.backgroundColor = d.mainBgColor || '#0a0a0a';
        if (d.bgImage) {
            container.style.backgroundImage = `url(${d.bgImage})`;
            container.style.backgroundSize = "cover";
            container.style.backgroundPosition = "center";
        } else {
            container.style.backgroundImage = (d.mainBgColor === '#0a0a0a') ? "radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)" : "none";
        }
    },

    renderPanelGrid: function (panels) {
        const grid = document.getElementById('viewer-panel-grid');
        if (!grid) return;
        grid.classList.remove('hidden');
        grid.innerHTML = '';
        if (!panels) return;
        panels.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'panel-cell';
            if (p === 1) div.classList.add('panel-red');
            else if (p === 2) div.classList.add('panel-green');
            else if (p === 3) div.classList.add('panel-white');
            else if (p === 4) div.classList.add('panel-blue');
            div.textContent = i + 1;
            grid.appendChild(div);
        });
    },

    renderBombGrid: function (cards) {
        const grid = document.getElementById('viewer-bomb-grid');
        if (!grid) return;
        grid.classList.remove('hidden');
        grid.innerHTML = '';
        if (!cards) return;
        cards.forEach((c, i) => {
            const div = document.createElement('div');
            div.className = 'card-item';
            if (c.open) {
                div.classList.add('flipped');
                div.innerHTML = c.type === 1 ? '<span class="card-content card-out">★</span>' : '<span class="card-content card-safe">SAFE</span>';
            } else {
                div.innerHTML = `<span class="card-number">${i + 1}</span>`;
            }
            grid.appendChild(div);
        });
    },

    updateViewerRace: function () {
        const container = document.getElementById('viewer-race-area');
        if (!container) return;
        window.db.ref(`rooms/${this.roomId}/players`).once('value', snap => {
            const players = snap.val() || {};
            container.innerHTML = '';
            const activePlayers = [];
            Object.keys(players).forEach(key => {
                if (players[key].isAlive) activePlayers.push({ name: players[key].name, score: players[key].periodScore || 0 });
            });
            activePlayers.sort((a, b) => b.score - a.score);
            const goal = this.config.passCount || 10;
            activePlayers.forEach(p => {
                const row = document.createElement('div');
                row.className = 'race-lane';
                const percent = Math.min(100, (p.score / goal) * 100);
                row.innerHTML = `
                    <div class="race-name" style="width:15vw; font-size:3vh; font-weight:bold;">${p.name}</div>
                    <div style="flex:1; height:2vh; background:rgba(255,255,255,0.1); border-radius:1vh; margin:0 2vw; position:relative;">
                        <div class="race-bar" style="width:${percent}%; position:absolute; top:0; left:0; height:100%;"></div>
                    </div>
                    <div class="race-score" style="font-size:3vh;">${p.score}</div>
                `;
                container.appendChild(row);
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => window.App.Viewer.init());
