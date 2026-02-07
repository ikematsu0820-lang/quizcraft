/* =========================================================
 * player.js (v140: Mobile-First UI with Visible Question)
 * =======================================================*/

let myRoomId = null;
let myPlayerId = null;
let myName = "NoName";
let roomConfig = { mode: 'normal', normalLimit: 'one' };
let currentQuestion = null;

let isReanswering = false;

let localStatus = { step: 'standby' };
let localPlayerData = { isAlive: true, lastResult: null };

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('join-room-btn');
    if (btn) btn.onclick = joinRoom;

    // Auto-fill room code from URL ?room=CODE
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        const input = document.getElementById('room-code-input');
        if (input) {
            input.value = roomParam.trim().toUpperCase();
            // Optional: If name is also there or saved in session, we could auto-join
        }
    }

    const buzzBtn = document.getElementById('player-buzz-btn');
    if (buzzBtn) {
        buzzBtn.addEventListener('click', () => {
            if (!myRoomId || !myPlayerId) return;
            buzzBtn.disabled = true;
            buzzBtn.textContent = "送信中...";
            window.db.ref(`rooms/${myRoomId}/players/${myPlayerId}`).update({
                buzzTime: firebase.database.ServerValue.TIMESTAMP
            });
        });
    }
});

function showPlayerView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
}

function joinRoom() {
    const codeInput = document.getElementById('room-code-input');
    const nameInput = document.getElementById('player-name-input');

    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();

    if (!code || !name) {
        alert("部屋コードとニックネームを入力してください");
        return;
    }

    const btn = document.getElementById('join-room-btn');
    btn.disabled = true;
    btn.textContent = "接続中...";

    window.db.ref(`rooms/${code}`).once('value', snap => {
        if (!snap.exists()) {
            alert("その部屋コードは見つかりませんでした");
            btn.disabled = false;
            btn.textContent = "参加する";
            return;
        }

        const val = snap.val();
        const currentPlayers = val.players || {};
        const count = Object.keys(currentPlayers).length;

        if (count >= 8) {
            alert("申し訳ありません、この部屋は満員です (定員8名)");
            btn.disabled = false;
            btn.textContent = "参加する";
            return;
        }

        myRoomId = code;
        myName = name;

        const playersRef = window.db.ref(`rooms/${code}/players`);
        const newPlayerRef = playersRef.push();
        myPlayerId = newPlayerRef.key;

        newPlayerRef.set({
            name: name,
            isAlive: true,
            periodScore: 0,
            periodTime: 0,
            lastResult: null,
            buzzTime: null
        }).then(() => {
            showPlayerView('player-game-view');
            document.getElementById('player-name-disp').textContent = name;
            startPlayerListener(code, myPlayerId);
        }).catch(e => {
            alert("エラーが発生しました: " + e.message);
            btn.disabled = false;
            btn.textContent = "参加する";
        });
    });
}

function startPlayerListener(roomId, playerId) {
    const statusRef = window.db.ref(`rooms/${roomId}/status`);
    const myRef = window.db.ref(`rooms/${roomId}/players/${playerId}`);
    const configRef = window.db.ref(`rooms/${roomId}/config`);

    myRef.on('value', snap => {
        const val = snap.val();
        if (!val) return;
        localPlayerData = val;
        updateUI();
    });

    configRef.on('value', snap => {
        roomConfig = snap.val() || { mode: 'normal' };
    });

    statusRef.on('value', snap => {
        const st = snap.val();
        if (!st) return;

        // --- Production: Detect step change for animation ---
        if (localStatus.step !== st.step) {
            triggerStepAnimation(st.step);
        }

        // --- Production: Global Buzz Detection ---
        if (st.currentAnswerer && st.currentAnswerer !== localStatus.currentAnswerer) {
            showGlobalBuzzNotification(st.currentAnswerer);
        }

        localStatus = st;

        if (st.step === 'answering' || st.step === 'question' || st.step === 'answer') {
            window.db.ref(`rooms/${roomId}/questions/${st.qIndex}`).once('value', qSnap => {
                const q = qSnap.val();
                if (q) {
                    currentQuestion = q;
                    renderPlayerQuestion(q, roomId, playerId);
                    updateUI();
                }
            });
        }
        updateUI();
    });
}

function triggerStepAnimation(step) {
    const main = document.getElementById('player-game-view');
    if (!main) return;

    // Quick flash or pop depending on step
    if (step === 'ready') main.classList.add('anim-pop-in');
    else if (step === 'question') main.classList.add('anim-slide-up');

    setTimeout(() => {
        main.classList.remove('anim-pop-in', 'anim-slide-up');
    }, 1000);
}

function showGlobalBuzzNotification(answererId) {
    // Fetch name from Firebase (simplified for now: just show "BUZZ!")
    const overlay = document.createElement('div');
    overlay.id = 'global-buzz-overlay';
    overlay.textContent = "BUZZ!!";
    document.body.appendChild(overlay);

    // Beat animation on status bar
    const bar = document.getElementById('player-status-bar');
    if (bar) {
        bar.classList.add('update');
        setTimeout(() => bar.classList.remove('update'), 300);
    }

    setTimeout(() => {
        overlay.style.transition = "opacity 0.3s, transform 0.3s";
        overlay.style.opacity = "0";
        overlay.style.transform = "translate(-50%, -50%) scale(1.5)";
        setTimeout(() => overlay.remove(), 300);
    }, 1200);
}

function updateUI() {
    const st = localStatus;
    const p = localPlayerData;

    const badge = document.getElementById('alive-badge');
    if (p.isAlive) {
        badge.textContent = "ENTRY"; badge.style.background = "#00bfff"; badge.style.color = "#000";
        document.getElementById('player-dead-overlay').classList.add('hidden');
    } else {
        badge.textContent = "LOSE"; badge.style.background = "#555"; badge.style.color = "#aaa";
        document.getElementById('player-dead-overlay').classList.remove('hidden');
    }

    if (p.periodScore !== undefined) {
        document.getElementById('score-display-area').classList.remove('hidden');
        document.getElementById('current-score-value').textContent = p.periodScore;
    }

    const lobby = document.getElementById('player-lobby-msg');
    const quizArea = document.getElementById('player-quiz-area');
    const waitMsg = document.getElementById('player-wait-msg');
    const resultOverlay = document.getElementById('player-result-overlay');
    const buzzArea = document.getElementById('player-buzz-area');
    const oralArea = document.getElementById('player-oral-done-area');
    const changeArea = document.getElementById('change-btn-area');
    const rankingOverlay = document.getElementById('player-ranking-overlay');

    // 基本リセット
    lobby.classList.add('hidden');
    waitMsg.classList.add('hidden');
    resultOverlay.classList.add('hidden');
    rankingOverlay.classList.add('hidden');

    // クイズエリア（問題文・選択肢）は、待機中以外は基本表示する方針に変更
    if (st.step === 'question' || st.step === 'answering' || st.step === 'answer') {
        quizArea.classList.remove('hidden');
        if (currentQuestion && currentQuestion.type === 'multi') {
            updateMultiAnswers();
        }
    } else {
        quizArea.classList.add('hidden');
        buzzArea.classList.add('hidden');
        oralArea.classList.add('hidden');
    }

    // --- 状態ごとのUI制御 ---
    if (st.step === 'standby') {
        lobby.classList.remove('hidden');
        const score = p.periodScore || 0;
        const tips = [
            "正解するほどポイントが貯まります！",
            "早押し問題はスピードが命！",
            "最後まで諦めずに挑戦しよう！",
            "アバター設定は準備中です。"
        ];
        const randomTip = tips[Math.floor(Date.now() / 5000) % tips.length];

        lobby.innerHTML = `
            <div class="lobby-icon" style="font-size:3em; margin-bottom:10px;">⏳</div>
            <h3 style="letter-spacing:4px; margin:0;">STANDBY</h3>
            <div class="standby-info">
                <div class="standby-score-label">Your Score</div>
                <div class="standby-score-value">${score} pt</div>
            </div>
            <p style="font-size:0.9em; color:var(--color-text-sub); margin-top:10px;">💡 Tip: ${randomTip}</p>
        `;
        isReanswering = false;
        if (changeArea) changeArea.innerHTML = '';
        quizArea.classList.add('hidden');
    }
    else if (st.step === 'reveal_q') {
        // 出題中（表示のみ、回答不可）
        quizArea.classList.remove('hidden');
        toggleInputEnabled(false);
    }
    else if (st.step === 'answering') {
        quizArea.classList.remove('hidden');
        if (roomConfig.mode === 'buzz') {
            // 早押しモード
            if (p.lastResult === 'lose') {
                showLoserMessage(lobby, buzzArea);
                toggleInputEnabled(false);
            }
            else if (st.isBuzzActive) {
                buzzArea.classList.remove('hidden');
                toggleInputEnabled(false);
                const btn = document.getElementById('player-buzz-btn');
                if (p.buzzTime) {
                    btn.disabled = true;
                    btn.textContent = "回答権確認中...";
                    btn.style.background = "#555";
                } else {
                    btn.disabled = false;
                    btn.textContent = "PUSH!";
                    btn.style.background = "radial-gradient(circle at 30% 30%, #ff6b6b, #c0392b)";
                }
            }
            else if (st.currentAnswerer === myPlayerId) {
                buzzArea.classList.add('hidden');
                toggleInputEnabled(true);
                handleNormalResponseUI(p, quizArea, waitMsg);
            }
            else {
                buzzArea.classList.add('hidden');
                toggleInputEnabled(false);
                waitMsg.classList.remove('hidden');
                waitMsg.innerHTML = "🔒 <b>LOCKED</b><br>他のプレイヤーが回答中です...";
            }
        } else {
            // 通常一斉回答
            handleNormalResponseUI(p, quizArea, waitMsg);
            toggleInputEnabled(true);
        }
    }
    else if (st.step === 'closed') {
        quizArea.classList.remove('hidden');
        toggleInputEnabled(false);
        waitMsg.classList.remove('hidden');
        waitMsg.style.background = "rgba(255, 75, 43, 0.1)";
        waitMsg.style.color = "#ff4b2b";
        waitMsg.style.border = "1px solid #ff4b2b";
        waitMsg.innerHTML = "<b>TIME UP!</b><br>解答を締め切りました";
    }
    else if (st.step === 'reveal_player') {
        quizArea.classList.remove('hidden');
        toggleInputEnabled(false);
        waitMsg.classList.remove('hidden');
        waitMsg.innerHTML = `<div class="status-badge" style="background:#9b59b6;">REVEAL</div><p style="margin-top:10px;">全員の回答を表示しています</p>`;
    }
    else if (st.step === 'reveal_correct') {
        if (currentQuestion) renderResultScreen(p, true);
    }
    else if (st.step === 'judging') {
        if (currentQuestion) renderResultScreen(p, false); // No commentary at judging if repetitive
    }
    else if (st.step === 'final_ranking') {
        showFinalResult(myRoomId, myPlayerId);
    }
}

// ★追加: 入力エリア（選択肢など）の有効/無効切り替え
function toggleInputEnabled(enabled) {
    const cont = document.getElementById('player-input-container');
    if (!cont) return;

    if (enabled) {
        cont.style.opacity = "1";
        cont.style.pointerEvents = "auto";
    } else {
        cont.style.opacity = "0.4"; // 薄くする
        cont.style.pointerEvents = "none"; // クリック禁止
    }
}

function showLoserMessage(lobby, buzzArea) {
    lobby.classList.remove('hidden');
    lobby.innerHTML = `<div style="text-align:center; color:#e94560; font-weight:bold; font-size:1.5em; margin-top:30px;">❌ 不正解</div><p style="text-align:center; color:#aaa;">この問題の回答権はありません</p>`;
    buzzArea.classList.add('hidden');
    // クイズエリアは隠さない（見学できるように）
}

function handleNormalResponseUI(p, quizArea, waitMsg) {
    // 既に回答済みなら待機表示
    if (p.lastAnswer != null) {
        if (roomConfig.normalLimit === 'unlimited') {
            if (isReanswering) {
                unlockChoices();
                const area = document.getElementById('change-btn-area');
                if (area) area.innerHTML = '';
            } else {
                lockChoices(p.lastAnswer);
                renderChangeButton();
            }
        } else {
            // 回答済み＆修正不可
            const isMulti = currentQuestion && currentQuestion.type === 'multi';
            if (!isMulti) quizArea.classList.add('hidden');

            waitMsg.classList.remove('hidden');
            waitMsg.style.background = "rgba(0, 184, 148, 0.2)";
            waitMsg.style.color = "#00b894";
            waitMsg.style.border = "1px solid #00b894";
            waitMsg.style.padding = "15px";
            waitMsg.innerHTML = "<b>ANSWERED</b><br>発表を待っています...";

            if (isMulti) {
                const oralArea = document.getElementById('player-oral-done-area');
                if (oralArea) oralArea.classList.add('hidden');
                waitMsg.style.marginTop = "10px";
            }
        }
    } else {
        unlockChoices();
        const area = document.getElementById('change-btn-area');
        if (area) area.innerHTML = '';

        // 多答の場合、回答ボタンを出す
        const oralArea = document.getElementById('player-oral-done-area');
        if (currentQuestion && currentQuestion.type === 'multi') {
            if (oralArea) oralArea.classList.remove('hidden');
        }
    }
}

function renderChangeButton() {
    const inputCont = document.getElementById('player-input-container');
    let changeBtnArea = document.getElementById('change-btn-area');
    if (!changeBtnArea) {
        changeBtnArea = document.createElement('div');
        changeBtnArea.id = 'change-btn-area';
        inputCont.parentNode.insertBefore(changeBtnArea, inputCont.nextSibling);
    }
    if (!document.getElementById('btn-change-ans')) {
        changeBtnArea.innerHTML = `
            <button id="btn-change-ans" class="btn-change-answer">
                答えを変更する
            </button>
        `;
        document.getElementById('btn-change-ans').onclick = openConfirmModal;
    }
}

function renderResultScreen(p) {
    const ansBox = document.getElementById('player-input-container');
    let correctText = "";
    if (currentQuestion.type === 'choice') {
        if (Array.isArray(currentQuestion.correct)) {
            correctText = currentQuestion.correct.map(i => `[${String.fromCharCode(65 + i)}] ${currentQuestion.c[i]}`).join(' / ');
        } else {
            const idx = currentQuestion.correctIndex !== undefined ? currentQuestion.correctIndex : currentQuestion.correct;
            correctText = `[${String.fromCharCode(65 + idx)}] ${currentQuestion.c[idx]}`;
        }
    } else if (currentQuestion.type === 'letter_select' && currentQuestion.steps) {
        correctText = currentQuestion.steps.map(s => s.correct).join('');
    } else if (currentQuestion.type === 'sort') {
        const correctStr = Array.isArray(currentQuestion.correct) ? currentQuestion.correct.map(idx => String.fromCharCode(65 + idx)).join('') : currentQuestion.correct;
        correctText = correctStr.split('').map(char => currentQuestion.c[char.charCodeAt(0) - 65]).join(' → ');
    } else {
        correctText = currentQuestion.correct;
    }

    let myAnsText = p.lastAnswer || "(未回答)";
    if (p.lastAnswer !== null) {
        if (currentQuestion.type === 'choice') {
            const idx = parseInt(p.lastAnswer);
            if (!isNaN(idx) && currentQuestion.c && currentQuestion.c[idx]) {
                myAnsText = `[${String.fromCharCode(65 + idx)}] ${currentQuestion.c[idx]}`;
            }
        } else if (currentQuestion.type === 'sort') {
            myAnsText = p.lastAnswer.split('').map(char => currentQuestion.c[char.charCodeAt(0) - 65]).join(' → ');
        }
    }

    let judgeHtml = '';
    if (p.lastResult === 'win') {
        judgeHtml = `
            <div class="result-symbol result-correct-symbol"></div>
            <div class="result-badge badge-correct">CORRECT</div>
        `;
        document.body.classList.add('flash-correct');
        setTimeout(() => document.body.classList.remove('flash-correct'), 600);
    } else if (p.lastResult === 'lose') {
        judgeHtml = `
            <div class="result-symbol result-wrong-symbol"></div>
            <div class="result-badge badge-wrong">WRONG</div>
        `;
        document.body.classList.add('flash-wrong');
        setTimeout(() => document.body.classList.remove('flash-wrong'), 600);
    }

    ansBox.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:20px;">
            ${judgeHtml}
        </div>
        <div style="background:var(--color-primary); color:#000; padding:12px; border-radius:12px; font-weight:900; text-align:center; margin-top:10px; box-shadow:0 10px 25px rgba(0, 229, 255, 0.2);">
            <div style="font-size:0.7em; letter-spacing:1px; margin-bottom:4px; opacity:0.8;">CORRECT ANSWER</div>
            <div style="font-size:1.6em;">${correctText}</div>
        </div>
        <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:12px; border-radius:12px; font-weight:bold; text-align:center; margin-top:12px;">
            <div style="font-size:0.7em; color:var(--color-text-sub); margin-bottom:4px; letter-spacing:1px;">YOUR ANSWER</div>
            <div style="font-size:1.2em; ${p.lastResult === 'lose' ? 'text-decoration:line-through; color:var(--color-text-sub);' : ''}">${myAnsText}</div>
        </div>
    `;
    document.getElementById('question-text-disp').textContent = currentQuestion.q;
    document.getElementById('player-quiz-area').classList.remove('hidden');
}

function showFinalResult(roomId, myId) {
    const overlay = document.getElementById('player-ranking-overlay');
    overlay.classList.remove('hidden');

    window.db.ref(`rooms/${roomId}/players`).once('value', snap => {
        const players = snap.val() || {};
        const arr = Object.keys(players).map(k => ({
            id: k,
            name: players[k].name,
            score: players[k].periodScore || 0
        })).sort((a, b) => b.score - a.score);

        const myRankIdx = arr.findIndex(p => p.id === myId);
        const myData = arr[myRankIdx];

        if (myData) {
            document.getElementById('player-my-rank').textContent = `${myRankIdx + 1}位`;
            document.getElementById('player-my-score').textContent = `${myData.score}点`;
        }

        const list = document.getElementById('player-leaderboard');
        list.innerHTML = '';
        arr.slice(0, 5).forEach((p, i) => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.padding = '8px';
            div.style.borderBottom = '1px solid #444';
            div.style.color = (p.id === myId) ? '#00bfff' : '#fff';
            div.style.fontWeight = (p.id === myId) ? 'bold' : 'normal';

            div.innerHTML = `<span>${i + 1}. ${p.name}</span><span>${p.score}pt</span>`;
            list.appendChild(div);
        });
    });
}

function lockChoices(selectedIndex) {
    const btns = document.querySelectorAll('.answer-btn');
    btns.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.ans == selectedIndex) {
            btn.classList.add('btn-selected');
            btn.classList.remove('btn-dimmed');
        } else {
            btn.classList.add('btn-dimmed');
            btn.classList.remove('btn-selected');
        }
    });
}

function unlockChoices() {
    const btns = document.querySelectorAll('.answer-btn');
    btns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('btn-selected', 'btn-dimmed');
    });
}

function openConfirmModal() {
    const old = document.getElementById('confirm-modal-overlay');
    if (old) old.remove();

    const html = `
        <div id="confirm-modal-overlay" class="confirm-modal-overlay">
            <div class="confirm-modal">
                <h3>答えを変更しますか？</h3>
                <div class="confirm-btns">
                    <button id="btn-yes" class="btn-confirm-yes">はい</button>
                    <button id="btn-no" class="btn-confirm-no">いいえ</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('btn-yes').onclick = () => {
        isReanswering = true;
        updateUI();
        document.getElementById('confirm-modal-overlay').remove();
    };
    document.getElementById('btn-no').onclick = () => {
        document.getElementById('confirm-modal-overlay').remove();
    };
}

function renderPlayerQuestion(q, roomId, playerId) {
    const inputCont = document.getElementById('player-input-container');
    const qText = document.getElementById('question-text-disp');

    const changeArea = document.getElementById('change-btn-area');
    if (changeArea) changeArea.innerHTML = '';

    qText.textContent = q.q;
    qText.classList.add('new-q');
    setTimeout(() => qText.classList.remove('new-q'), 600);

    inputCont.innerHTML = '';

    if (q.type === 'choice') {
        let choices = q.c.map((text, i) => ({ text: text, originalIndex: i }));
        if (roomConfig.shuffleChoices === 'on') {
            for (let i = choices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [choices[i], choices[j]] = [choices[j], choices[i]];
            }
        }
        choices.forEach((item, i) => {
            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.innerHTML = `<span style="font-weight:900; margin-right:10px; opacity:0.8; font-family:monospace;">${String.fromCharCode(65 + item.originalIndex)}</span> ${item.text}`;
            btn.dataset.ans = item.originalIndex;

            if (i === 0) btn.classList.add('btn-blue');
            else if (i === 1) btn.classList.add('btn-red');
            else if (i === 2) btn.classList.add('btn-green');
            else btn.classList.add('btn-yellow');

            btn.onclick = () => submitAnswer(roomId, playerId, item.originalIndex);
            inputCont.appendChild(btn);
        });
    }
    else if (q.type === 'letter_select') {
        let pool = [];
        if (q.steps) {
            q.steps.forEach(step => {
                pool.push(step.correct);
                if (step.dummies) pool.push(...step.dummies);
            });
        } else {
            const correctChars = q.correct.split('');
            const dummyChars = (q.dummyChars || '').split('');
            pool = [...correctChars, ...dummyChars];
        }
        pool = pool.filter(c => c && c.trim() !== '');
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const displayBox = document.createElement('div');
        displayBox.className = 'letter-display-box';
        displayBox.textContent = "";
        inputCont.appendChild(displayBox);

        const grid = document.createElement('div');
        grid.className = 'letter-panel-grid';
        pool.forEach(char => {
            const btn = document.createElement('button');
            btn.textContent = char; btn.className = 'letter-panel-btn';
            btn.onclick = () => { if (displayBox.textContent.length < 20) displayBox.textContent += char; };
            grid.appendChild(btn);
        });
        inputCont.appendChild(grid);

        const controlRow = document.createElement('div');
        controlRow.className = 'player-control-row';
        const clearBtn = document.createElement('button');
        clearBtn.textContent = "Clear"; clearBtn.className = "btn-confirm-no btn-block";
        clearBtn.onclick = () => { displayBox.textContent = ""; };
        const submitBtn = document.createElement('button');
        submitBtn.textContent = "OK"; submitBtn.className = "btn-primary btn-block";
        submitBtn.onclick = () => {
            if (displayBox.textContent.length === 0) return;
            submitAnswer(roomId, playerId, displayBox.textContent);
        };
        controlRow.appendChild(clearBtn); controlRow.appendChild(submitBtn); inputCont.appendChild(controlRow);
    }
    else if (q.type === 'sort') {
        const items = q.c || [];
        const n = items.length;

        // Shuffle initial items but keep their original label (A, B, C...)
        let zipped = items.map((txt, i) => ({ txt, label: String.fromCharCode(65 + i) }));
        for (let i = zipped.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
        }

        const renderSortInput = () => {
            inputCont.innerHTML = '';

            const helpText = document.createElement('div');
            helpText.className = 'player-sort-help';
            helpText.innerHTML = '👆 項目をドラッグして正しい順序に入れ替えてください';
            inputCont.appendChild(helpText);

            const sortList = document.createElement('div');
            sortList.id = 'player-sortable-list';
            sortList.className = 'sortable-list';

            // Create zipped list
            zipped.forEach((itemData) => {
                const item = document.createElement('div');
                item.className = 'sortable-item';
                item.dataset.label = itemData.label;
                item.innerHTML = `
                    <div class="sortable-handle">☰</div>
                    <div class="sortable-content">${itemData.txt}</div>
                `;
                sortList.appendChild(item);
            });
            inputCont.appendChild(sortList);

            // Initialize Sortable
            if (window.Sortable) {
                new Sortable(sortList, {
                    animation: 150,
                    handle: '.sortable-handle',
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    dragClass: 'sortable-drag'
                });
            }

            const submitBtn = document.createElement('button');
            submitBtn.className = 'btn-primary btn-block';
            submitBtn.style.marginTop = '20px';
            submitBtn.textContent = '順序を確定して送信';

            submitBtn.onclick = () => {
                const sortedItems = sortList.querySelectorAll('.sortable-item');
                let answer = "";
                sortedItems.forEach(el => {
                    answer += el.dataset.label;
                });

                if (answer.length !== n) {
                    alert("エラーが発生しました。");
                    return;
                }

                submitAnswer(roomId, playerId, answer);
            };
            inputCont.appendChild(submitBtn);
        };

        renderSortInput();
    }
    else if (q.type === 'multi') {
        const grid = document.createElement('div');
        grid.className = 'player-multi-grid';
        q.c.forEach((choice, i) => {
            const item = document.createElement('div');
            item.className = 'player-multi-item';
            item.id = `player-multi-item-${i}`;

            const idx = document.createElement('div');
            idx.className = 'multi-index';
            idx.textContent = i + 1;

            const text = document.createElement('div');
            text.className = 'multi-text-hidden';
            text.textContent = '?????';

            item.appendChild(idx);
            item.appendChild(text);
            grid.appendChild(item);
        });
        inputCont.appendChild(grid);

        // 多答の場合、司会者の操作を待つ「Answered」ボタンも必要であれば出す
        document.getElementById('player-oral-done-area').classList.remove('hidden');
        document.getElementById('player-oral-done-btn').onclick = () => { submitAnswer(roomId, playerId, "[Done]"); };
    }
    else if (q.type === 'free_oral') {
        document.getElementById('player-oral-done-area').classList.remove('hidden');
        document.getElementById('player-oral-done-btn').onclick = () => { submitAnswer(roomId, playerId, "[Oral]"); };
    }
    else {
        // デフォルト: 記述式
        const inp = document.createElement('input');
        inp.type = 'text'; inp.placeholder = '回答を入力...'; inp.className = 'modern-input'; inp.style.marginBottom = '15px';
        const sub = document.createElement('button');
        sub.className = 'btn-primary btn-block'; sub.textContent = '送信';
        sub.onclick = () => {
            if (inp.value.trim() === "") return;
            submitAnswer(roomId, playerId, inp.value.trim());
        };
        inputCont.appendChild(inp); inputCont.appendChild(sub);
    }
}

function updateMultiAnswers() {
    const q = currentQuestion;
    if (!q || q.type !== 'multi') return;
    const revealed = localStatus.revealedMulti || {};

    q.c.forEach((choice, i) => {
        const item = document.getElementById(`player-multi-item-${i}`);
        if (!item) return;

        const isRevealed = revealed[i];
        const textEl = item.querySelector('div:last-child');

        if (isRevealed && !item.classList.contains('is-revealed')) {
            item.classList.add('is-revealed');
            textEl.className = 'multi-text-revealed';
            textEl.textContent = choice;
        } else if (!isRevealed) {
            item.classList.remove('is-revealed');
            textEl.className = 'multi-text-hidden';
            textEl.textContent = '?????';
        }
    });
}


function submitAnswer(roomId, playerId, answer) {
    if (localStatus.step !== 'answering') {
        console.warn("Answer rejected: Not in answering phase");
        return;
    }
    isReanswering = false;
    window.db.ref(`rooms/${roomId}/players/${playerId}`).update({
        lastAnswer: answer,
        answerTime: firebase.database.ServerValue.TIMESTAMP
    });
}
