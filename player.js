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

        if (['answering', 'question', 'answer', 'reveal_q', 'reveal_correct'].includes(st.step)) {
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
    else if (step === 'question' || step === 'reveal_q') main.classList.add('anim-slide-up');

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
        if (badge) { badge.textContent = "ENTRY"; badge.style.background = "#00bfff"; badge.style.color = "#000"; }
        document.getElementById('player-dead-overlay').classList.add('hidden');
    } else {
        if (badge) { badge.textContent = "LOSE"; badge.style.background = "#555"; badge.style.color = "#aaa"; }
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
    buzzArea.classList.add('hidden'); // ★追加: 毎回隠して、必要な時だけ出す

    // クイズエリア（問題文・選択肢）は、待機中以外は基本表示する方針に変更
    if (['question', 'answering', 'answer', 'reveal_q', 'reveal_correct'].includes(st.step)) {
        quizArea.classList.remove('hidden');
        if (currentQuestion && currentQuestion.type.startsWith('multi')) {
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
        // 出題中 (Simplified Flow: Allow answering immediately)
        quizArea.classList.remove('hidden');

        const isMultipleAttempts = (roomConfig.mode === 'normal' && roomConfig.answerAttempts === 'multiple');

        // ★ Turn Mode: Only currentAnswerer can answer
        if (st.isTurnMode && st.currentAnswerer && st.currentAnswerer !== myPlayerId) {
            buzzArea.classList.add('hidden');
            toggleInputEnabled(false);
            const changeArea = document.getElementById('change-btn-area');
            if (changeArea) changeArea.innerHTML = '';
            waitMsg.classList.remove('hidden');
            waitMsg.style.background = 'rgba(155, 89, 182, 0.15)';
            waitMsg.style.color = '#9b59b6';
            waitMsg.style.border = '1px solid rgba(155, 89, 182, 0.3)';
            waitMsg.style.padding = '20px';
            const answererName = st.currentAnswererName || '他のプレイヤー';
            waitMsg.innerHTML = `<div style="font-size:2em; margin-bottom:8px;">🔒</div><p style="font-weight:bold; font-size:1.1em; margin:0;">${answererName} の番です</p><p style="font-size:0.85em; color:#888; margin-top:6px;">あなたの番が来るまでお待ちください</p>`;
        } else if (p.lastResult === 'win') {
            toggleInputEnabled(false);
            const changeArea = document.getElementById('change-btn-area');
            if (changeArea) changeArea.innerHTML = '';

            waitMsg.classList.remove('hidden');
            waitMsg.style.background = "rgba(46, 204, 113, 0.2)";
            waitMsg.style.color = "#2ecc71";
            waitMsg.style.border = "1px solid #2ecc71";
            waitMsg.style.padding = "20px";
            waitMsg.innerHTML = `<div class="status-badge" style="background:#2ecc71;">CORRECT</div><p style="margin-top:10px; font-weight:bold; font-size:1.5em;">正解です！</p>`;
        } else if (p.lastResult === 'lose') {
            if (isMultipleAttempts) {
                // Multiple attempts: show "wrong" briefly, player will be allowed to retry
                toggleInputEnabled(false);
                const changeArea = document.getElementById('change-btn-area');
                if (changeArea) changeArea.innerHTML = '';

                waitMsg.classList.remove('hidden');
                waitMsg.style.background = "rgba(231, 76, 60, 0.2)";
                waitMsg.style.color = "#e74c3c";
                waitMsg.style.border = "1px solid #e74c3c";
                waitMsg.style.padding = "20px";
                waitMsg.innerHTML = `<div class="status-badge" style="background:#e74c3c;">WRONG</div><p style="margin-top:10px; font-weight:bold; font-size:1.2em;">不正解...</p><p style="margin-top:5px; font-size:0.9em; color:#aaa;">もう一度解答できます</p>`;
            } else {
                toggleInputEnabled(false);
                const changeArea = document.getElementById('change-btn-area');
                if (changeArea) changeArea.innerHTML = '';

                waitMsg.classList.remove('hidden');
                waitMsg.style.background = "rgba(231, 76, 60, 0.2)";
                waitMsg.style.color = "#e74c3c";
                waitMsg.style.border = "1px solid #e74c3c";
                waitMsg.style.padding = "20px";
                waitMsg.innerHTML = `<div class="status-badge" style="background:#e74c3c;">WRONG</div><p style="margin-top:10px; font-weight:bold; font-size:1.5em;">不正解...</p>`;
            }
        } else {
            handleNormalResponseUI(p, quizArea, waitMsg);
            toggleInputEnabled(true);
        }
    }
    else if (st.step === 'answering') {
        quizArea.classList.remove('hidden');
        if (roomConfig.mode === 'buzz') {
            // 早押しモード: 勝者以外は解答画面操作不可
            if (p.lastResult === 'lose') {
                showLoserMessage(lobby, buzzArea);
                toggleInputEnabled(false);
            }
            else if (p.lastResult === 'win') {
                // ★追加: 正解者への即時フィードバック
                buzzArea.classList.add('hidden');
                toggleInputEnabled(false);
                const changeArea = document.getElementById('change-btn-area');
                if (changeArea) changeArea.innerHTML = '';

                waitMsg.classList.remove('hidden');
                waitMsg.style.background = "rgba(46, 204, 113, 0.2)";
                waitMsg.style.color = "#2ecc71";
                waitMsg.style.border = "1px solid #2ecc71";
                waitMsg.style.padding = "20px";
                waitMsg.innerHTML = `<div class="status-badge" style="background:#2ecc71;">CORRECT</div><p style="margin-top:10px; font-weight:bold; font-size:1.5em;">正解です！</p>`;
            }
            else if (st.isBuzzActive) {
                // 早押しボタン受付中
                buzzArea.classList.remove('hidden');
                toggleInputEnabled(false); // クイズ解答エリアはまだ無効
                const btn = document.getElementById('player-buzz-btn');

                if (p.buzzRest && p.buzzRest > 0) {
                    // おてつき: 休み中
                    btn.disabled = true;
                    btn.textContent = `${p.buzzRest}問休み`;
                    btn.style.background = "#333";
                } else if (p.buzzBannedUntil && p.buzzBannedUntil > Date.now()) {
                    // おてつき: 一定時間解答無効
                    btn.disabled = true;
                    const remaining = Math.ceil((p.buzzBannedUntil - Date.now()) / 1000);
                    btn.textContent = `解答無効 ${remaining}s`;
                    btn.style.background = "#333";
                    // Auto re-enable after ban expires
                    setTimeout(() => {
                        if (p.buzzBannedUntil && p.buzzBannedUntil <= Date.now()) {
                            btn.disabled = false;
                            btn.textContent = "PUSH!";
                            btn.style.background = "radial-gradient(circle at 30% 30%, #ff6b6b, #c0392b)";
                        }
                    }, (p.buzzBannedUntil - Date.now()) + 100);
                } else if (p.buzzTime) {
                    btn.disabled = true;
                    btn.textContent = "解答権確認中...";
                    btn.style.background = "#555";
                } else {
                    btn.disabled = false;
                    btn.textContent = "PUSH!";
                    btn.style.background = "radial-gradient(circle at 30% 30%, #ff6b6b, #c0392b)";
                }
            }
            else if (st.currentAnswerer === myPlayerId) {
                // 自分が早押し勝者 -> 解答権獲得
                buzzArea.classList.add('hidden');
                toggleInputEnabled(true);
                handleNormalResponseUI(p, quizArea, waitMsg);
                // Auto-focus input for winner
                setTimeout(() => {
                    const inp = document.querySelector('#player-input-container input');
                    if (inp) inp.focus();
                }, 100);
            }
            else if (st.currentAnswerer) {
                // 誰か他の人が解答権獲得中 -> 自分は操作不可
                buzzArea.classList.add('hidden');
                toggleInputEnabled(false);
                waitMsg.classList.remove('hidden');
                const winnerName = st.currentAnswererName || "他のプレイヤー";
                waitMsg.innerHTML = `🔒 <b>LOCKED</b><br>${winnerName} が解答中です...`;

                // ★追加: 誤答などでリセットされるまでロックされ続ける仕様
            }
            else {
                // 誰も解答権がない状態 (例: 誤答後リセット待ち、または開始前)
                // 基本的には isBuzzActive が true になるはずだが、念のためロック
                buzzArea.classList.add('hidden');
                toggleInputEnabled(false);
                waitMsg.classList.remove('hidden');
                waitMsg.innerHTML = "待機中...";
            }
        } else {
            // 通常一斉解答 (Normal Mode)
            const isMultipleAttempts = (roomConfig.mode === 'normal' && roomConfig.answerAttempts === 'multiple');

            if (p.lastResult === 'win') {
                toggleInputEnabled(false);
                const changeArea = document.getElementById('change-btn-area');
                if (changeArea) changeArea.innerHTML = '';

                waitMsg.classList.remove('hidden');
                waitMsg.style.background = "rgba(46, 204, 113, 0.2)";
                waitMsg.style.color = "#2ecc71";
                waitMsg.style.border = "1px solid #2ecc71";
                waitMsg.style.padding = "20px";
                waitMsg.innerHTML = `<div class="status-badge" style="background:#2ecc71;">CORRECT</div><p style="margin-top:10px; font-weight:bold; font-size:1.5em;">正解です！</p>`;
            } else if (p.lastResult === 'lose') {
                if (isMultipleAttempts) {
                    toggleInputEnabled(false);
                    const changeArea = document.getElementById('change-btn-area');
                    if (changeArea) changeArea.innerHTML = '';

                    waitMsg.classList.remove('hidden');
                    waitMsg.style.background = "rgba(231, 76, 60, 0.2)";
                    waitMsg.style.color = "#e74c3c";
                    waitMsg.style.border = "1px solid #e74c3c";
                    waitMsg.style.padding = "20px";
                    waitMsg.innerHTML = `<div class="status-badge" style="background:#e74c3c;">WRONG</div><p style="margin-top:10px; font-weight:bold; font-size:1.2em;">不正解...</p><p style="margin-top:5px; font-size:0.9em; color:#aaa;">もう一度解答できます</p>`;
                } else {
                    toggleInputEnabled(false);
                    const changeArea = document.getElementById('change-btn-area');
                    if (changeArea) changeArea.innerHTML = '';

                    waitMsg.classList.remove('hidden');
                    waitMsg.style.background = "rgba(231, 76, 60, 0.2)";
                    waitMsg.style.color = "#e74c3c";
                    waitMsg.style.border = "1px solid #e74c3c";
                    waitMsg.style.padding = "20px";
                    waitMsg.innerHTML = `<div class="status-badge" style="background:#e74c3c;">WRONG</div><p style="margin-top:10px; font-weight:bold; font-size:1.5em;">不正解...</p>`;
                }
            } else {
                handleNormalResponseUI(p, quizArea, waitMsg);
                toggleInputEnabled(true);
            }
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

        if (p.lastResult === 'win') {
            waitMsg.style.background = "rgba(46, 204, 113, 0.2)";
            waitMsg.style.color = "#2ecc71";
            waitMsg.style.border = "1px solid #2ecc71";
            waitMsg.style.padding = "20px";
            waitMsg.innerHTML = `<div class="status-badge" style="background:#2ecc71;">CORRECT</div><p style="margin-top:10px; font-weight:bold; font-size:1.5em;">正解です！</p>`;
        } else if (p.lastResult === 'lose') {
            waitMsg.style.background = "rgba(231, 76, 60, 0.2)";
            waitMsg.style.color = "#e74c3c";
            waitMsg.style.border = "1px solid #e74c3c";
            waitMsg.style.padding = "20px";
            waitMsg.innerHTML = `<div class="status-badge" style="background:#e74c3c;">WRONG</div><p style="margin-top:10px; font-weight:bold; font-size:1.5em;">不正解...</p>`;
        } else {
            waitMsg.innerHTML = `<div class="status-badge" style="background:#9b59b6;">REVEAL</div><p style="margin-top:10px;">全員の解答を表示しています</p>`;
        }
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
    lobby.innerHTML = `<div style="text-align:center; color:#e94560; font-weight:bold; font-size:1.5em; margin-top:30px;">❌ 不正解</div><p style="text-align:center; color:#aaa;">この問題の解答権はありません</p>`;
    buzzArea.classList.add('hidden');
    // クイズエリアは隠さない（見学できるように）
}

function handleNormalResponseUI(p, quizArea, waitMsg) {
    // 既に解答済みなら待機表示
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
            // 解答済み＆修正不可
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

        // 多答の場合、解答ボタンを出す
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

    let myAnsText = p.lastAnswer || "(未解答)";
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
        // Removed flash effect
    } else if (p.lastResult === 'lose') {
        judgeHtml = `
            <div class="result-symbol result-wrong-symbol"></div>
            <div class="result-badge badge-wrong">WRONG</div>
        `;
        // Removed flash effect
    }

    ansBox.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:20px;">
            ${judgeHtml}
        </div>
        <div style="background:#fff; color:#000; padding:20px; border-radius:12px; font-weight:900; text-align:center; margin-top:20px; box-shadow:0 0 20px rgba(255, 255, 255, 0.3);">
            <div style="font-size:0.8em; letter-spacing:1px; margin-bottom:8px; opacity:0.6; color:#000;">
                ${(currentQuestion.mode === 'dobon' || currentQuestion.mode === 'multi' || currentQuestion.multi || roomConfig.mode === 'dobon') ? "NG ANSWER (選んではいけません)" : "CORRECT ANSWER"}
            </div>
            <div style="font-size:1.8em; line-height:1.4;">${correctText}</div>
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

    const gameView = document.getElementById('player-game-view');
    if (q.type && q.type.startsWith('multi')) {
        gameView.classList.add('multi-layout-active');
        inputCont.classList.add('multi-mode-container');
    } else {
        gameView.classList.remove('multi-layout-active');
        inputCont.classList.remove('multi-mode-container');
    }
    // Also remove any sortable specific classes if added later

    if (q.type === 'choice') {
        let choices = q.c.map((text, i) => ({ text: text, originalIndex: i }));
        if (roomConfig.shuffleChoices === 'on') {
            for (let i = choices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [choices[i], choices[j]] = [choices[j], choices[i]];
            }
        }
        const isMulti = q.multi || false;
        const selected = new Set();
        const btns = [];

        choices.forEach((item, i) => {
            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.style.border = '4px solid transparent'; // Prepare for highlight
            btn.style.transition = 'all 0.1s';

            // Add visual indicator (Radio or Check)
            const icon = isMulti ? (selected.has(item.originalIndex) ? '☑ ' : '☐ ') : (selected.has(item.originalIndex) ? '◉ ' : '○ ');
            // Actually, icon update needs to happen on click.
            // Let's just use text for now or simple visual highlight.
            // Keeping text clean is better. We depend on Border.

            btn.innerHTML = `<span style="font-weight:900; margin-right:10px; opacity:0.8; font-family:monospace;">${String.fromCharCode(65 + item.originalIndex)}</span> ${item.text}`;
            btn.dataset.ans = item.originalIndex;

            if (i === 0) btn.classList.add('btn-blue');
            else if (i === 1) btn.classList.add('btn-red');
            else if (i === 2) btn.classList.add('btn-green');
            else btn.classList.add('btn-yellow');

            // If single mode, maybe dim unselected ones?
            // Let's use opacity logic similar to Sort-Multi.
            btn.style.opacity = '0.8';

            btn.onclick = () => {
                const val = item.originalIndex;
                if (isMulti) {
                    if (selected.has(val)) {
                        selected.delete(val);
                        btn.style.opacity = '0.8';
                        btn.style.borderColor = 'transparent';
                        btn.style.transform = 'scale(1)';
                    } else {
                        selected.add(val);
                        btn.style.opacity = '1';
                        btn.style.borderColor = '#fff';
                        btn.style.transform = 'scale(1.02)';
                    }
                } else {
                    // Single mode
                    selected.clear();
                    selected.add(val);
                    btns.forEach(b => {
                        b.style.opacity = '0.6';
                        b.style.borderColor = 'transparent';
                        b.style.transform = 'scale(1)';
                    });
                    btn.style.opacity = '1';
                    btn.style.borderColor = '#fff';
                    btn.style.transform = 'scale(1.02)';
                }
            };
            btns.push(btn);
            inputCont.appendChild(btn);
        });

        const submitBtn = document.createElement('button');
        submitBtn.className = 'btn-primary btn-block';
        submitBtn.textContent = '決定';
        submitBtn.style.marginTop = '15px';
        submitBtn.onclick = () => {
            if (selected.size === 0) return;
            const ansArray = Array.from(selected).sort((a, b) => a - b);
            if (isMulti) submitAnswer(roomId, playerId, ansArray);
            else submitAnswer(roomId, playerId, ansArray[0]);
        };
        inputCont.appendChild(submitBtn);
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

        // Common Shuffle Logic
        let zipped = items.map((txt, i) => ({ txt, label: String.fromCharCode(65 + i) }));
        if (q.shuffle !== false) {
            for (let i = zipped.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
            }
        }

        inputCont.innerHTML = '';

        if (n <= 5) {
            // --- Click Order Mode (<= 5 items) ---
            const helpText = document.createElement('div');
            helpText.className = 'player-sort-help';
            helpText.innerHTML = '👆 正しい順序で項目をタップしてください';
            inputCont.appendChild(helpText);

            // Container for sequence display
            const seqContainer = document.createElement('div');
            seqContainer.className = 'sort-seq-container';
            seqContainer.style.display = 'flex';
            seqContainer.style.gap = '10px';
            seqContainer.style.marginBottom = '20px';
            seqContainer.style.justifyContent = 'center';
            inputCont.appendChild(seqContainer);

            // Create slots for the sequence
            const slots = [];
            for (let i = 0; i < n; i++) {
                const slot = document.createElement('div');
                slot.className = 'sort-seq-slot';
                slot.textContent = (i + 1);
                slot.style.width = '40px';
                slot.style.height = '40px';
                slot.style.border = '2px solid #555';
                slot.style.borderRadius = '8px';
                slot.style.display = 'flex';
                slot.style.alignItems = 'center';
                slot.style.justifyContent = 'center';
                slot.style.fontSize = '1.2em';
                slot.style.fontWeight = 'bold';
                slot.style.background = '#222';
                slot.style.color = '#777';
                slots.push(slot);
                seqContainer.appendChild(slot);
            }

            // Buttons Container
            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'grid';
            btnContainer.style.gap = '10px';
            inputCont.appendChild(btnContainer);

            let currentSelection = []; // Array of labels

            const updateSlots = () => {
                slots.forEach((slot, i) => {
                    if (i < currentSelection.length) {
                        slot.textContent = currentSelection[i];
                        slot.style.borderColor = '#00bfff';
                        slot.style.color = '#fff';
                        slot.style.background = '#00bfff33';
                    } else {
                        slot.textContent = (i + 1);
                        slot.style.borderColor = '#555';
                        slot.style.color = '#777';
                        slot.style.background = '#222';
                    }
                });

                // Check completion
                if (currentSelection.length === n) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('btn-disabled');
                    submitBtn.classList.add('btn-primary');
                } else {
                    submitBtn.disabled = true;
                    submitBtn.classList.add('btn-disabled');
                    submitBtn.classList.remove('btn-primary');
                }
            };

            zipped.forEach((itemData) => {
                const btn = document.createElement('button');
                btn.className = 'btn-choice-block'; // Re-use choice button style or similar
                btn.style.display = 'flex';
                btn.style.justifyContent = 'space-between';
                btn.style.alignItems = 'center';
                btn.style.border = '1px solid #666';
                btn.style.background = '#4a4a4a';
                btn.style.color = '#fff';
                btn.style.borderRadius = '8px';
                btn.style.width = '100%';
                btn.style.marginBottom = '0';
                btn.style.fontSize = '1.1em';
                btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';

                btn.innerHTML = `<span>${itemData.txt}</span>`;

                btn.onclick = () => {
                    if (currentSelection.includes(itemData.label)) return; // Already selected

                    currentSelection.push(itemData.label);
                    // Visual disable
                    btn.style.opacity = '0.3';
                    btn.style.pointerEvents = 'none';
                    updateSlots();

                    // Auto-submit if last item? No, user requested "last triggers confirm" implies explicit or auto?
                    // "押した順で最後に確定" -> "Pressed order, confirm at end" usually means explicit submit or auto-submit on completion.
                    // Let's safe side: explicit submit button which becomes active.
                };
                btnContainer.appendChild(btn);

                // Attach reference to clear later
                itemData.btnEl = btn;
            });

            // Reset Button
            const resetBtn = document.createElement('button');
            resetBtn.textContent = '順序をリセット';
            resetBtn.className = 'btn-dark btn-block';
            resetBtn.style.marginTop = '15px';
            resetBtn.onclick = () => {
                currentSelection = [];
                updateSlots();
                zipped.forEach(d => {
                    d.btnEl.style.opacity = '1';
                    d.btnEl.style.pointerEvents = 'auto';
                });
            };
            inputCont.appendChild(resetBtn);

            const submitBtn = document.createElement('button');
            submitBtn.className = 'btn-block btn-disabled';
            submitBtn.textContent = '決定';
            submitBtn.disabled = true;
            submitBtn.style.marginTop = '10px';
            submitBtn.onclick = () => {
                if (currentSelection.length !== n) return;
                submitAnswer(roomId, playerId, currentSelection.join(''));
            };
            inputCont.appendChild(submitBtn);

        } else {
            // --- Drag & Drop Mode (>= 6 items) ---
            const helpText = document.createElement('div');
            helpText.className = 'player-sort-help';
            helpText.innerHTML = '👆 項目をドラッグして正しい順序に入れ替えてください';
            inputCont.appendChild(helpText);

            const sortList = document.createElement('div');
            sortList.id = 'player-sortable-list';
            sortList.className = 'sortable-list';

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
            submitBtn.textContent = '順序を確定して送信';
            submitBtn.style.marginTop = '20px';
            submitBtn.onclick = () => {
                const sortedItems = sortList.querySelectorAll('.sortable-item');
                let answer = "";
                sortedItems.forEach(el => answer += el.dataset.label);
                if (answer.length !== n) { alert("エラーが発生しました。"); return; }
                submitAnswer(roomId, playerId, answer);
            };
            inputCont.appendChild(submitBtn);
        }
    }

    else if (q.type.startsWith('multi')) {
        inputCont.classList.add('multi-mode-container');
        // ★ For multi-written, place Input & Submit at the TOP (below Question)
        if (q.type === 'multi_written') {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '10px';
            wrapper.style.marginBottom = '20px'; // Space before grid

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = '解答を入力...';
            inp.className = 'modern-input';
            inp.style.margin = '0'; // Flex handles gap
            inp.style.flex = '1';

            const sub = document.createElement('button');
            sub.className = 'btn-primary';
            sub.textContent = '送信';
            sub.style.width = '100px';

            const sendAction = () => {
                if (inp.value.trim() === "") return;
                submitAnswer(roomId, playerId, inp.value.trim());
                inp.value = ""; // Clear for next answer
                inp.focus(); // Keep focus for rapid entry
            };

            sub.onclick = sendAction;
            // Allow Enter key
            inp.onkeydown = (e) => {
                if (e.key === 'Enter') sendAction();
            }

            wrapper.appendChild(inp);
            wrapper.appendChild(sub);
            inputCont.appendChild(wrapper);
        } else {
            // multi_oral
            document.getElementById('player-oral-done-area').classList.remove('hidden');
            document.getElementById('player-oral-done-btn').onclick = () => { submitAnswer(roomId, playerId, "[Done]"); };
        }

        // Then Render Grid (Below Input)
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
    }
    else if (q.type === 'free_oral') {
        document.getElementById('player-oral-done-area').classList.remove('hidden');
        document.getElementById('player-oral-done-btn').onclick = () => { submitAnswer(roomId, playerId, "[Oral]"); };
    }
    else {
        // デフォルト: 記述式
        const inp = document.createElement('input');
        inp.type = 'text'; inp.placeholder = '解答を入力...'; inp.className = 'modern-input'; inp.style.marginBottom = '15px';
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
    if (!q || !q.type.startsWith('multi')) return;
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
    if (!['answering', 'question', 'reveal_q'].includes(localStatus.step)) {
        console.warn("Answer rejected: Not in answering phase (" + localStatus.step + ")");
        // Optional: show toast "受付時間外です"
        return;
    }
    isReanswering = false;
    window.db.ref(`rooms/${roomId}/players/${playerId}`).update({
        lastAnswer: answer,
        answerTime: firebase.database.ServerValue.TIMESTAMP
    });
}
