
/* =========================================================
 * host_config.js (v143: Rename Buzz Options)
 * =======================================================*/

App.Config = {
    // Shared by the compact rules bar (Creator) inline pickers below.
    deriveTypeInfo: function (questions) {
        let typeDisplay = "不明";
        let isOral = false;
        let qType = 'choice';
        const isDobon = questions.some(q => q.mode === 'dobon' || (q.type === 'choice' && q.mode === 'multi'));
        // 数字予想（numgame）も順番に回すゲームなので同じ扱い（解答権は順番のみ）
        const isBlackjack = questions.some(q => q.type === 'blackjack' || q.type === 'numgame');
        // 口頭で答える問題が1問でもあれば、手元で一斉に解答する形式は不可
        const hasOral = questions.some(q => q && typeof q.type === 'string' && q.type.endsWith('_oral'));

        if (questions.length > 0) {
            const type = questions[0].type;
            const mode = questions[0].mode;

            if (type === 'choice') {
                if (mode === 'dobon' || mode === 'multi') typeDisplay = "2-2) ダウト問題";
                else typeDisplay = "2-1) 単一解答";
            }
            else if (type === 'letter_select') typeDisplay = APP_TEXT.Creator.TypeLetterSelect;
            else if (type === 'sort') typeDisplay = APP_TEXT.Creator.TypeSort;
            else if (type === 'free_oral') { typeDisplay = APP_TEXT.Creator.TypeFreeOral; isOral = true; }
            else if (type === 'free_written') { typeDisplay = APP_TEXT.Creator.TypeFreeWritten; qType = type; }
            else if (type === 'multi_written') { typeDisplay = APP_TEXT.Creator.TypeMultiWritten; qType = type; }
            else if (type === 'multi_oral') { typeDisplay = APP_TEXT.Creator.TypeMultiOral; isOral = true; qType = type; }
            else if (type === 'ranking_written') { typeDisplay = APP_TEXT.Creator.TypeRankingWritten; qType = type; }
            else if (type === 'ranking_oral') { typeDisplay = APP_TEXT.Creator.TypeRankingOral; isOral = true; qType = type; }
            else if (type === 'multi') { typeDisplay = APP_TEXT.Creator.TypeMulti; qType = type; }
            else if (type === 'assoc_written') { typeDisplay = APP_TEXT.Creator.TypeAssocWritten; qType = type; }
            else if (type === 'assoc_oral') { typeDisplay = APP_TEXT.Creator.TypeAssocOral; isOral = true; qType = type; }
            else if (type === 'blackjack') { typeDisplay = "6-1) ブラックジャック"; qType = type; }
            else typeDisplay = "不明";
        }

        return { typeDisplay, isOral: isOral || hasOral, qType, isDobon, isBlackjack };
    },

    // Full set of defaults for a fresh config object, so every field has a
    // sane value even if the user never opens a given rules button.
    DEFAULT_CONFIG: {
        mode: 'normal', gameType: 'score', answerAttempts: 'single',
        buzzWrongAction: 'next', buzzPenalty: 'none', buzzPenaltyTime: 3, buzzRestCount: 1, buzzTime: 0,
        normalLimit: 'unlimited', manualFlip: false, passCount: 10,
        slotMin: 1, slotMax: 10, survivalLives: 1, turnOrder: 'fixed', turnRotateMode: 'per_q',
        soloStyle: 'manual', soloTimeType: 'per_q', soloTimeVal: 0, soloRecovery: 0,
        scoreType: 'uniform', uniformPts: 1, rankPts: [10, 5, 3], rankOtherPts: 1, firstComeCount: 1, firstComePts: 10,
        timeLimitEnabled: 'off', timeLimitSeconds: 30
    },

    // Question-type-driven auto-restriction (same rules the old card list
    // used to enforce), applied directly to the persistent config object.
    applyModeRestrictions: function (conf, questions) {
        const { qType, isDobon, isBlackjack, isOral } = this.deriveTypeInfo(questions);
        let mode = conf.mode || 'normal';
        const firstType = ((questions || [])[0] || {}).type || '';
        // 選択式に「特定の人や順番で解答」は無い／指名は対応する形式だけ
        if (mode === 'turn' && firstType === 'choice' && !isDobon) mode = 'normal';
        if (mode === 'nominate' && (isBlackjack || isDobon || !(firstType.startsWith('free') || firstType.startsWith('assoc') || firstType === 'choice' || firstType === 'sort' || firstType === 'letter_select'))) mode = 'buzz';
        if (isOral && mode === 'normal') {
            // 口頭で答える — 手元で一斉に解答はできないので早押しにする
            mode = 'buzz';
        } else if (isBlackjack) {
            mode = 'turn';
        } else if (isDobon) {
            if (mode !== 'turn' && mode !== 'solo') mode = 'turn';
        } else if (qType.startsWith('multi') || qType.startsWith('ranking')) {
            if (!conf.mode || conf.mode === 'normal') mode = 'turn';
        } else if (mode === 'normal') {
            // 一斉解答 IS selectable for free_written/letter_select (unlike
            // the _oral variants, where the 解答権 pulldown disables it
            // outright) — this branch only exists to SUGGEST 早押し the
            // first time one of these types is seen while mode is still at
            // its untouched 'normal' default. Without the
            // _oneOnOneSuggestedFor guard, this function re-runs on every
            // renderRulesSection() call and kept re-forcing buzz right back
            // even after the user explicitly picked 一斉解答 from the
            // dropdown — conf.mode being 'normal' looked identical whether
            // it was "still the default" or "the user just chose this".
            const hasOneOnOne = questions.some(q => ['free_oral', 'free_written', 'letter_select', 'multi_oral', 'ranking_oral', 'assoc_oral'].includes(q.type));
            if (hasOneOnOne && conf._oneOnOneSuggestedFor !== qType) mode = 'buzz';
        }
        conf._oneOnOneSuggestedFor = qType;
        // 最後に相性の表で確認 — 選べない解答権のままにしない
        const RE = window.App.RuleEngine;
        if (RE && mode !== 'solo') {
            const ctx = RE.context({ ...conf, mode }, questions);
            if (!RE.modeAllowed(ctx, mode)) mode = RE.firstAllowedMode(ctx);
        }
        conf.mode = mode;
        // 解答権が変わって使えなくなった設定（配点・同点の扱いなど）を戻す
        if (RE) {
            const changed = RE.normalize(conf, questions);
            if (changed.length && window.App.Ui && window.App.Ui.showToast) {
                const key = changed.join('|');
                if (this._lastNormalizeMsg !== key) {
                    this._lastNormalizeMsg = key;
                    changed.forEach((m, i) => setTimeout(() => window.App.Ui.showToast(m), i * 600));
                }
            } else if (!changed.length) {
                this._lastNormalizeMsg = '';
            }
        }
    },

    // --- Compact inline rule controls (render into a container the caller
    // provides; no modal/backdrop — see renderInlineModeChooser etc. below) ---

    // Per-mode settings fields (same content the old bottom-sheet showed),
    // now rendered inline under the mode radio list.
    // ---------------------------------------------------------
    // 基本設定と詳細設定の分け方
    //   基本 … 変えると「遊び方の説明」が変わるもの（解答権、誤答したら
    //          問題をどうするか、勝利条件、配点の種類、制限時間）
    //   詳細 … 数値の微調整や、例外が起きた時の扱い。既定のままでも
    //          遊べるもの（解答回数、誤答者のペナルティ、点数表、同点の扱い）
    // 詳細は折りたたんでおき、開いたかどうかはブラウザに覚えておく。
    // ---------------------------------------------------------
    advancedBlock: function (key, innerHtml, notes, summary) {
        let open = false;
        try { open = localStorage.getItem(`qs_adv_open_${key}`) === '1'; } catch (e) { /* noop */ }
        const noteHtml = (notes || []).filter(Boolean).map(n => `<p class="rule-adv-note">${n}</p>`).join('');
        if (!innerHtml && !noteHtml) return '';
        return `
            <details class="rule-adv" data-adv-key="${key}" ${open ? 'open' : ''}>
                <summary>${summary || '詳細設定'}</summary>
                <div class="rule-adv-body">${innerHtml || ''}${noteHtml}</div>
            </details>`;
    },

    wireAdvancedBlocks: function (root) {
        (root || document).querySelectorAll('details.rule-adv').forEach(d => {
            d.ontoggle = () => {
                try { localStorage.setItem(`qs_adv_open_${d.dataset.advKey}`, d.open ? '1' : '0'); } catch (e) { /* noop */ }
            };
        });
    },

    // 早押しの誤答者へのペナルティ — 「問題に対する処理」で選べるものが変わる
    BUZZ_PENALTIES: {
        next: [
            { v: 'none', t: 'もう一度押せる' },
            { v: 'otetski', t: 'この問題はもう押せない' },
            { v: 'time_ban', t: '◯秒間押せない' },
            { v: 'rest', t: '◯問休み' },
            { v: 'reset_all', t: '全員もう一度押し直し' },
        ],
        end: [
            { v: 'none', t: '特になし' },
            { v: 'rest', t: '◯問休み' },
        ],
    },

    // Per-mode settings fields (same content the old bottom-sheet showed),
    // now rendered inline under the mode radio list.
    _modeDetailFieldsHtml: function (mode, conf, qType, isDobon) {
        const col = (inner, caption) => `
            <div style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:3px;">
                ${inner}
                ${caption ? `<span style="font-size:0.58rem; color:#94a3b8; white-space:nowrap;">${caption}</span>` : ''}
            </div>`;
        const rowHead = (t) => `<div style="flex:0 0 72px; color:#94a3b8; font-size:0.72rem; font-weight:bold; line-height:1.3; align-self:flex-start; padding-top:6px;">${t}</div>`;
        if (mode === 'normal') {
            const single = (conf.answerAttempts || 'single') === 'single';
            const adv = `
                <label class="config-label" style="margin:0; font-size:0.8em;">解答回数</label>
                <div style="display:flex; gap:6px; margin:6px 0 6px;">
                    <button type="button" class="mode-segmented-btn ans-attempt-btn ${single ? 'active' : ''}" data-val="single" style="flex:1; padding:6px 4px; font-size:0.8em;">
                        <span class="label">1回のみ</span>
                    </button>
                    <button type="button" class="mode-segmented-btn ans-attempt-btn ${!single ? 'active' : ''}" data-val="multiple" style="flex:1; padding:6px 4px; font-size:0.8em;">
                        <span class="label">複数解答可</span>
                    </button>
                </div>
                <p style="color:#888; font-size:0.72em; margin:0; line-height:1.3;" id="ans-attempt-desc">
                    ${single ? '正解表示ボタンを押した時に全員に結果が一斉に届きます' : '採点の都度結果が届き、不正解でも再解答できます'}
                </p>`;
            return `<p class="rule-basic-note">全員が手元の端末で同時に答えます。</p>${this.advancedBlock('normal', adv)}`;
        } else if (mode === 'buzz') {
            const buzzAction = conf.buzzWrongAction || 'next';
            const allowed = this.BUZZ_PENALTIES[buzzAction] || this.BUZZ_PENALTIES.next;
            let buzzPenalty = conf.buzzPenalty || 'none';
            if (!allowed.some(o => o.v === buzzPenalty)) { buzzPenalty = 'none'; conf.buzzPenalty = 'none'; }
            const deductNum = Number(conf.buzzDeduct) || 0;
            const deductOn = deductNum > 0;
            const banSec = conf.buzzPenaltyTime || 3;
            const restN = conf.buzzRestCount || 1;
            const adv = `
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
                    ${rowHead('誤答した人')}
                    ${col(`<select id="config-buzz-penalty" class="btn-block config-select" style="margin:0; padding:4px;">
                        ${allowed.map(o => `<option value="${o.v}" ${buzzPenalty === o.v ? 'selected' : ''}>${o.t}</option>`).join('')}
                    </select>`, '解答権')}
                    <div id="config-buzz-ban-wrap" style="flex:0 0 84px; display:${buzzPenalty === 'time_ban' ? 'flex' : 'none'};">
                        ${col(`<select id="config-buzz-ban-sec" class="btn-block config-select" style="margin:0; padding:4px;">
                            ${[1, 2, 3, 5, 10].map(n => `<option value="${n}" ${banSec === n ? 'selected' : ''}>${n}秒</option>`).join('')}
                        </select>`, '押せない時間')}
                    </div>
                    <div id="config-buzz-rest-wrap" style="flex:0 0 84px; display:${buzzPenalty === 'rest' ? 'flex' : 'none'};">
                        ${col(`<select id="config-buzz-rest-count" class="btn-block config-select" style="margin:0; padding:4px;">
                            ${[1, 2, 3].map(n => `<option value="${n}" ${restN === n ? 'selected' : ''}>${n}問</option>`).join('')}
                        </select>`, '休み')}
                    </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    ${rowHead('減点')}
                    ${col(`<select id="config-buzz-deduct-on" class="btn-block config-select" style="margin:0; padding:4px;">
                        <option value="none" ${!deductOn ? 'selected' : ''}>しない</option>
                        <option value="on" ${deductOn ? 'selected' : ''}>する</option>
                    </select>`, '')}
                    <div id="config-buzz-deduct-wrap" style="flex:1; min-width:0; display:${deductOn ? 'flex' : 'none'};">
                        ${col(`<select id="config-buzz-deduct" class="btn-block config-select" style="margin:0; padding:4px;">
                            ${[1, 2, 3, 5, 10].map(n => `<option value="${n}" ${deductNum === n ? 'selected' : ''}>-${n}点</option>`).join('')}
                        </select>`, '')}
                    </div>
                </div>`;
            return `
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                    ${rowHead('誤答したら問題は')}
                    ${col(`<select id="config-buzz-wrong-action" class="btn-block config-select" style="margin:0; padding:4px;">
                        <option value="next" ${buzzAction === 'next' ? 'selected' : ''}>続ける（他の人が押せる）</option>
                        <option value="end" ${buzzAction === 'end' ? 'selected' : ''}>終わる（正解発表へ）</option>
                    </select>`, '')}
                </div>
                ${this.advancedBlock('buzzWrong', adv)}
            `;
        } else if (mode === 'turn') {
            // 回し方（ダウトが出るまで回す）はダウトの時だけ — 多答では毎問次の人から
            const showRotateMode = isDobon;
            if (!showRotateMode) {
                conf.turnRotateMode = 'per_q';
                return '<p style="color:#666; font-size:0.8em;">追加の設定はありません</p>';
            }
            const currentRotate = conf.turnRotateMode || 'per_q';
            return `
                <label class="config-label" style="font-size:0.8em;">解答者の回し方</label>
                <select id="config-turn-rotate-mode" class="btn-block config-select" style="margin-top:4px; padding:4px;">
                    <option value="per_q" ${currentRotate === 'per_q' ? 'selected' : ''}>問題ごとに変える（毎問、次の人が最初）</option>
                    <option value="until_end" ${currentRotate === 'until_end' ? 'selected' : ''}>ダウトが出るまで回す（全員解答まで繰り返し）</option>
                </select>
            `;
        } else if (mode === 'solo') {
            return `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div>
                        <label class="config-label">${APP_TEXT.Config.LabelSoloTimeValue}</label>
                        <div class="flex-center">
                            <input type="number" id="config-solo-time-val" class="btn-block" value="${conf.soloTimeVal || 5}" min="0" placeholder="0=なし">
                            <span class="unit-text">秒</span>
                        </div>
                    </div>
                    <div>
                        <label class="config-label">${APP_TEXT.Config.LabelSoloRecovery}</label>
                        <select id="config-solo-recovery" class="btn-block config-select">
                            <option value="none" ${conf.soloRecovery === 0 ? 'selected' : ''}>なし</option>
                            <option value="1" ${conf.soloRecovery === 1 ? 'selected' : ''}>+1s</option>
                            <option value="3" ${conf.soloRecovery === 3 ? 'selected' : ''}>+3s</option>
                            <option value="5" ${conf.soloRecovery === 5 ? 'selected' : ''}>+5s</option>
                        </select>
                    </div>
                </div>
            `;
        }
        return '';
    },

    // Wires the interactive bits of _modeDetailFieldsHtml and writes
    // straight into `conf` (no intermediate hidden DOM round-trip).
    _wireModeDetailFields: function (area, mode, conf, rerender) {
        this.wireAdvancedBlocks(area);
        area.querySelectorAll('.ans-attempt-btn').forEach(btn => {
            btn.onclick = () => {
                area.querySelectorAll('.ans-attempt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                conf.answerAttempts = btn.dataset.val;
                const desc = area.querySelector('#ans-attempt-desc');
                if (desc) desc.textContent = btn.dataset.val === 'single'
                    ? '正解表示ボタンを押した時に全員に結果が一斉に届きます'
                    : '採点の都度結果が届き、不正解でも再解答できます';
            };
        });
        const buzzActionSel = area.querySelector('#config-buzz-wrong-action');
        if (buzzActionSel) {
            buzzActionSel.onchange = () => {
                conf.buzzWrongAction = buzzActionSel.value;
                // 選べるペナルティが変わるので描き直す
                if (rerender) rerender();
            };
        }
        const buzzPenaltySel = area.querySelector('#config-buzz-penalty');
        if (buzzPenaltySel) {
            buzzPenaltySel.onchange = () => {
                conf.buzzPenalty = buzzPenaltySel.value;
                const ban = area.querySelector('#config-buzz-ban-wrap');
                const rest = area.querySelector('#config-buzz-rest-wrap');
                if (ban) ban.style.display = conf.buzzPenalty === 'time_ban' ? 'flex' : 'none';
                if (rest) rest.style.display = conf.buzzPenalty === 'rest' ? 'flex' : 'none';
                if (conf.buzzPenalty === 'time_ban' && !conf.buzzPenaltyTime) conf.buzzPenaltyTime = 3;
                if (conf.buzzPenalty === 'rest' && !conf.buzzRestCount) conf.buzzRestCount = 1;
            };
        }
        const banSel = area.querySelector('#config-buzz-ban-sec');
        if (banSel) banSel.onchange = () => { conf.buzzPenaltyTime = parseInt(banSel.value) || 3; };
        const restSel = area.querySelector('#config-buzz-rest-count');
        if (restSel) restSel.onchange = () => { conf.buzzRestCount = parseInt(restSel.value) || 1; };
        const buzzDeductSel = area.querySelector('#config-buzz-deduct');
        const buzzDeductOn = area.querySelector('#config-buzz-deduct-on');
        const buzzDeductWrap = area.querySelector('#config-buzz-deduct-wrap');
        if (buzzDeductOn) {
            buzzDeductOn.onchange = () => {
                const on = buzzDeductOn.value === 'on';
                if (buzzDeductWrap) buzzDeductWrap.style.display = on ? 'flex' : 'none';
                conf.buzzDeduct = on ? (parseInt(buzzDeductSel?.value) || 1) : 0;
            };
        }
        if (buzzDeductSel) {
            buzzDeductSel.onchange = () => {
                conf.buzzDeduct = parseInt(buzzDeductSel.value) || 1;
            };
        }
        const turnRotateSel = area.querySelector('#config-turn-rotate-mode');
        if (turnRotateSel) turnRotateSel.onchange = () => { conf.turnRotateMode = turnRotateSel.value; };
        const soloTimeInput = area.querySelector('#config-solo-time-val');
        if (soloTimeInput) soloTimeInput.oninput = () => { conf.soloTimeVal = parseInt(soloTimeInput.value) || 0; };
        const soloRecoverySel = area.querySelector('#config-solo-recovery');
        if (soloRecoverySel) soloRecoverySel.onchange = () => { conf.soloRecovery = soloRecoverySel.value === 'none' ? 0 : parseInt(soloRecoverySel.value) || 0; };
    },

    // 解答権 — pick mode + edit that mode's fields, in one compact modal.
    // All three renderInlineXxx functions below render directly into a
    // given container (no modal/backdrop) and apply every change to `conf`
    // immediately — the container lives inside the fixed-height
    // #creator-inline-edit-area, so there's no confirm step and no popup.

    // 解答権 — pick mode (via the #creator-mode-select pulldown, alongside
    // 解答形式's pulldown) + edit that mode's fields below.
    renderInlineModeChooser: function (container, conf, questions, onChange) {
        const { qType, isOral, isDobon, isBlackjack } = this.deriveTypeInfo(questions);
        // ソロ対戦 is no longer a creator-configured 解答権 — it's now chosen
        // by the host at load time (プログラム/セットの読込 screen), as a
        // per-session override on top of whatever mode the set was created
        // with. See host_studio.js loadProgramList()/setupPeriod().
        // 選べる解答権は rule_engine.js の相性の表で決める（自動補正と同じ基準）
        const RE = window.App.RuleEngine;
        const ctx = RE.context(conf, questions);
        const modes = RE.modes(ctx).filter(m => !m.hidden);
        let current = conf.mode || 'normal';
        if (modes.find(m => m.value === current)?.disabled) current = modes.find(m => !m.disabled).value;
        conf.mode = current;

        const sel = document.getElementById('creator-mode-select');

        // 早押しの誤答時の設定（問題の処理/誤答者の解答権/減点）は
        // 「誤答時処理」タブ（#creator-inline-wrong-body）に出す
        const wrongBody = document.getElementById('creator-inline-wrong-body');
        const renderDetail = () => {
            const isBuzz = current === 'buzz';
            container.innerHTML = `<div id="mode-chooser-detail"></div>`;
            const detailArea = container.querySelector('#mode-chooser-detail');
            if (wrongBody) {
                wrongBody.innerHTML = isBuzz
                    ? this._modeDetailFieldsHtml(current, conf, qType, isDobon)
                    : '<p style="color:#666; font-size:0.8em; text-align:center; padding:12px 0;">早押し（早く押した人から解答）の時に設定できます</p>';
                if (isBuzz) this._wireModeDetailFields(wrongBody, current, conf, renderDetail);
            }
            if (!isBuzz || !wrongBody) {
                detailArea.innerHTML = this._modeDetailFieldsHtml(current, conf, qType, isDobon);
                this._wireModeDetailFields(detailArea, current, conf, renderDetail);
            }
        };

        if (sel) {
            sel.innerHTML = modes.map(m => `<option value="${m.value}" ${m.disabled ? 'disabled' : ''} ${m.value === current ? 'selected' : ''}>${m.label}</option>`).join('');
            sel.value = current;
            sel.onchange = () => {
                current = sel.value;
                conf.mode = current;
                renderDetail();
                if (onChange) onChange();
            };
        }
        renderDetail();
    },

    // 勝利条件 — 得点が高い人が勝ち（score）/ 最後まで残った人が勝ち
    // （survival: 規定回数ミスすると脱落 — host_studio.js checkSurvival）。
    // パネル・変動得点制は廃止 — 保存済みのセットでそれらを選んでいた
    // 場合は、ここを開いた時点で「得点が高い人が勝ち」に置き換える。
    // 1人で挑戦するときのルール — 司会者が読み込み時に「ソロモード」を
    // 選んだ時だけ使う（ふだんはセットの解答権・勝利条件のまま）。
    // タイムショック風なら、制限時間を「セット全体の持ち時間」にする。
    _renderSoloRules: function (box, conf, onChange) {
        if (!box) return;
        const selStyle = 'width:100%; margin:0; padding:6px 8px; background:#1e293b; border:1px solid #475569; border-radius:8px; color:#fff; font-size:0.85rem;';
        const life = conf.soloLife === undefined ? 3 : Number(conf.soloLife);
        const clear = Number(conf.soloClearCount) || 0;
        const row = (label, inner) => `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;"><span style="flex:0 0 96px; color:#94a3b8; font-size:0.72rem; font-weight:bold;">${label}</span><div style="flex:1; min-width:0;">${inner}</div></div>`;
        const inner = `
            ${row('ライフ', `<select id="conf-solo-life" style="${selStyle}">${[1, 2, 3, 5, 0].map(n => `<option value="${n}" ${life === n ? 'selected' : ''}>${n ? `${n}回まで間違えられる` : '無制限（最後まで続ける）'}</option>`).join('')}</select>`)}
            ${row('クリア条件', `<select id="conf-solo-clear" style="${selStyle}">${[0, 3, 5, 7, 10, 12].map(n => `<option value="${n}" ${clear === n ? 'selected' : ''}>${n ? `${n}問正解でクリア` : 'なし（全問やる）'}</option>`).join('')}</select>`)}
            <p class="rule-adv-note" style="margin:0;">司会者が出題の読み込み時に「ソロモード」を選んだ時だけ使います。タイムショック風にするなら、制限時間を「セット全体」にしてください。</p>`;
        box.innerHTML = this.advancedBlock('solo', inner, null, '1人で挑戦するとき（ソロモード）');
        this.wireAdvancedBlocks(box);
        const l = box.querySelector('#conf-solo-life');
        if (l) l.onchange = () => { conf.soloLife = parseInt(l.value) || 0; if (onChange) onChange(); };
        const c = box.querySelector('#conf-solo-clear');
        if (c) c.onchange = () => { conf.soloClearCount = parseInt(c.value) || 0; if (onChange) onChange(); };
    },

    // 作成中のセットの問題（相性の判定に使う）
    _ruleQuestions: function () {
        const C = window.App.Creator;
        try { return (C && C.effectiveQuestionsForRestrictions) ? C.effectiveQuestionsForRestrictions() : (window.App.Data.createdQuestions || []); }
        catch (e) { return window.App.Data.createdQuestions || []; }
    },
    _ruleContext: function (conf) {
        return window.App.RuleEngine.context(conf, this._ruleQuestions());
    },

    renderInlineGameTypeChooser: function (container, conf, onChange) {
        const types = [
            { value: 'score', label: '得点の高い人が勝ち', disabled: false },
            { value: 'survival', label: '最後まで残った人が勝ち', disabled: false }
        ];
        let current = types.some(t => t.value === conf.gameType) ? conf.gameType : 'score';

        // 勝利条件と、その詳細（得点ルール／何回ミスで脱落）を1行に並べる
        // — 下に小さく項目名。得点ルールの細かい数値だけ次の段に出す。
        const col = (inner, caption) => `
            <div style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:3px;">
                ${inner}
                <span style="font-size:0.58rem; color:#94a3b8; white-space:nowrap;">${caption}</span>
            </div>
        `;
        const selStyle = 'width:100%; margin:0; padding:6px 8px; background:#1e293b; border:1px solid #475569; border-radius:8px; color:#fff; font-size:0.85rem;';

        const renderDetail = () => {
            const side = container.querySelector('#gametype-chooser-side');
            const area = container.querySelector('#gametype-chooser-detail');
            if (current === 'score') {
                // 選べる配点・同点の扱いは相性の表で決める（rule_engine.js）
                const RE = window.App.RuleEngine;
                const ctx = this._ruleContext(conf);
                RE.normalize(conf, this._ruleQuestions());
                const canRanked = RE.can('scoreRanked', ctx);
                const canHint = RE.can('scoreHint', ctx);
                const canTie = RE.can('tieBreakTime', ctx);
                const scoreType = conf.scoreType || 'uniform';
                const optionRows = [{ value: 'uniform', label: '正解者全員に同得点' }]
                    .concat(canRanked.ok ? [{ value: 'ranked', label: '正解スピードに応じて得点を傾斜' }] : [])
                    .concat(canHint.ok ? [{ value: 'hint', label: 'ヒント数に応じて得点を傾斜' }] : []);
                side.innerHTML = col(`
                    <select id="score-type-select" style="${selStyle}">
                        ${optionRows.map(o => `<option value="${o.value}" ${scoreType === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>`, '配点');
                const tie = conf.tieBreak || 'none';
                const tieHtml = canTie.ok ? `
                    <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
                        <span style="flex:0 0 72px; color:#94a3b8; font-size:0.72rem; font-weight:bold;">同点のとき</span>
                        <select id="conf-tie-break" style="${selStyle}">
                            <option value="none" ${tie === 'none' ? 'selected' : ''}>同じ順位にする</option>
                            <option value="time" ${tie === 'time' ? 'selected' : ''}>正解した問題の解答時間の合計が短い人が上</option>
                        </select>
                    </div>
                    <p style="color:#777; font-size:0.68rem; margin:4px 0 0; line-height:1.4;">順位発表と、番組の足切りの並び順に使います。</p>` : '';
                area.innerHTML = this.advancedBlock('score', `
                    <div id="score-type-sheet-detail" style="background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);"></div>
                    ${tieHtml}`, [!canRanked.ok ? canRanked.why : '', !canTie.ok ? canTie.why : '']);
                this.wireAdvancedBlocks(area);
                side.querySelector('#score-type-select').onchange = (e) => {
                    conf.scoreType = e.target.value;
                    renderDetail();
                    if (onChange) onChange();
                };
                const tieSel = area.querySelector('#conf-tie-break');
                if (tieSel) tieSel.onchange = () => { conf.tieBreak = tieSel.value; if (onChange) onChange(); };
                this.renderScoreDetailInSheet(conf.scoreType || 'uniform', conf);
                // Commit score-detail field edits to conf as the user types,
                // since there's no explicit confirm step anymore.
                area.querySelectorAll('#score-type-sheet-detail input').forEach(inp => {
                    inp.addEventListener('input', () => this._collectScoreDetailFromSheet(conf));
                });
            } else if (current === 'survival') {
                const lives = conf.survivalLives || 1;
                side.innerHTML = col(`
                    <select id="conf-survival-lives" style="${selStyle}">
                        ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${lives === n ? 'selected' : ''}>${n}回</option>`).join('')}
                    </select>`, '何回ミスしたら脱落');
                const RE = window.App.RuleEngine;
                const canSlow = RE.can('survivalSlowDrop', this._ruleContext(conf));
                if (!canSlow.ok) conf.survivalSlowDrop = 0;
                const slow = parseInt(conf.survivalSlowDrop) || 0;
                const slowHtml = canSlow.ok ? `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="flex:0 0 96px; color:#94a3b8; font-size:0.72rem; font-weight:bold;">遅い人も脱落</span>
                        <select id="conf-survival-slow" style="${selStyle}">
                            ${[0, 1, 2, 3].map(n => `<option value="${n}" ${slow === n ? 'selected' : ''}>${n ? `毎問、正解者のうち遅い${n}人が脱落` : 'しない'}</option>`).join('')}
                        </select>
                    </div>
                    <p style="color:#777; font-size:0.68rem; margin:4px 0 0; line-height:1.4;">正解しても、解答時間が遅い人から脱落します（一番速い人は必ず残ります）。</p>` : '';
                area.innerHTML = `<p style="color:#666; font-size:0.72em; margin:6px 0 0;">※不正解・無回答がミスになります（1問につき1回まで）。脱落した人は以降の問題に答えられません</p>`
                    + this.advancedBlock('survival', slowHtml, [!canSlow.ok ? canSlow.why : '']);
                this.wireAdvancedBlocks(area);
                side.querySelector('#conf-survival-lives').onchange = (e) => {
                    conf.survivalLives = parseInt(e.target.value) || 1;
                    if (onChange) onChange();
                };
                const slowSel = area.querySelector('#conf-survival-slow');
                if (slowSel) slowSel.onchange = () => { conf.survivalSlowDrop = parseInt(slowSel.value) || 0; if (onChange) onChange(); };
            } else {
                side.innerHTML = '';
                area.innerHTML = '';
            }
        };

        const render = () => {
            container.innerHTML = `
                <div style="display:flex; gap:8px;">
                    ${col(`
                        <select id="gametype-chooser-select" style="${selStyle}">
                            ${types.map(t => `<option value="${t.value}" ${t.value === current ? 'selected' : ''}>${t.label}</option>`).join('')}
                        </select>`, '勝利条件')}
                    <div id="gametype-chooser-side" style="flex:1; min-width:0; display:flex;"></div>
                </div>
                <div id="gametype-chooser-detail"></div>
                <div id="gametype-solo"></div>
            `;
            this._renderSoloRules(container.querySelector('#gametype-solo'), conf, onChange);
            container.querySelector('#gametype-chooser-select').onchange = (e) => {
                current = e.target.value;
                conf.gameType = current;
                render();
                if (onChange) onChange();
            };
            renderDetail();
        };
        conf.gameType = current;
        render();
    },

    // 制限時間（タイマーの動き）
    //   基本 … なし／1問ごと／セット全体の持ち時間、と秒数
    //   詳細 … 時間切れのとき、早押しで止めるか、正誤での持ち時間の増減
    // 見た目（バー・円・時計・導火線など）はデザインの「タイマー」タブ。
    renderInlineTimeLimitChooser: function (container, conf, onChange) {
        const RE = window.App.RuleEngine;
        const render = () => {
            const enabled = (conf.timeLimitEnabled || 'off') === 'on';
            const kind = conf.timerKind === 'pool' ? 'pool' : 'per_q';
            const current = !enabled ? 'off' : kind;
            const seconds = parseInt(conf.timeLimitSeconds) || 30;
            const presets = kind === 'pool' ? [30, 60, 90, 120, 180, 300] : [5, 10, 15, 20, 30, 60];
            const ctx = this._ruleContext(conf);
            const isBuzz = ctx.mode === 'buzz';
            const kindBtn = (v, label, sub) => `
                <button type="button" class="tl-kind-btn" data-kind="${v}" style="flex:1; padding:8px 4px; border-radius:10px; cursor:pointer; text-align:center;
                    border:2px solid ${current === v ? '#f39c12' : '#333'}; background:${current === v ? 'rgba(243,156,18,0.1)' : '#1a1a1a'}; color:${current === v ? '#f39c12' : '#ccc'};">
                    <div style="font-weight:bold; font-size:0.85em;">${label}</div>
                    <div style="font-size:0.66em; opacity:0.8; margin-top:2px;">${sub}</div>
                </button>`;
            const onExpire = conf.timerOnExpire === 'skip' ? 'skip' : 'close';
            const pauseOnBuzz = conf.timerPauseOnBuzz !== false;
            const sel = (id, opts, val) => `<select id="${id}" class="btn-block config-select" style="margin:0; padding:4px;">${opts.map(o => `<option value="${o.v}" ${String(val) === String(o.v) ? 'selected' : ''}>${o.t}</option>`).join('')}</select>`;
            const row = (label, inner) => `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;"><span style="flex:0 0 96px; color:#94a3b8; font-size:0.72rem; font-weight:bold;">${label}</span><div style="flex:1; min-width:0;">${inner}</div></div>`;
            let adv = '';
            if (enabled) {
                if (kind === 'per_q') {
                    adv += row('時間切れのとき', sel('tl-on-expire', [{ v: 'close', t: '締め切って正解発表へ' }, { v: 'skip', t: '正解を出さずに次の問題へ' }], onExpire));
                } else {
                    adv += `<p class="rule-adv-note" style="margin:0 0 8px;">持ち時間がなくなったら、残りの問題は出さずにセット終了します。時計は解答中だけ進みます。</p>`;
                    adv += row('正解したら', sel('tl-bonus', [0, 1, 2, 3, 5].map(n => ({ v: n, t: n ? `+${n}秒` : '増減なし' })), parseFloat(conf.timerBonusCorrect) || 0));
                    adv += row('不正解なら', sel('tl-penalty', [0, 1, 2, 3, 5].map(n => ({ v: n, t: n ? `−${n}秒` : '増減なし' })), parseFloat(conf.timerPenaltyWrong) || 0));
                }
                if (isBuzz) {
                    adv += `<label style="display:flex; align-items:center; gap:8px; color:#cbd5e1; font-size:0.8em; cursor:pointer;"><input type="checkbox" id="tl-pause-buzz" ${pauseOnBuzz ? 'checked' : ''} style="width:auto; height:auto; min-height:0; margin:0;">誰かが早押ししたら時計を止める</label>`;
                }
            }
            container.innerHTML = `
                <div style="display:flex; gap:6px; margin-bottom:12px;">
                    ${kindBtn('off', 'なし', '時間制限なし')}
                    ${kindBtn('per_q', '1問ごと', '毎問、満タンから')}
                    ${kindBtn('pool', 'セット全体', '持ち時間が減っていく')}
                </div>
                <div id="tl-seconds-area" style="${enabled ? '' : 'display:none;'}">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                        <input type="number" id="tl-seconds-input" value="${seconds}" min="1" max="1800" step="1" style="
                            flex:1; text-align:center; font-size:1.4em; font-weight:800;
                            background:rgba(243,156,18,0.1); border:2px solid #f39c12; border-radius:12px; color:#f39c12; padding:6px;">
                        <span style="color:#aaa;">秒${kind === 'pool' ? '（セット全体）' : '（1問あたり）'}</span>
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${presets.map(sec => `
                            <button type="button" class="tl-preset-btn" data-sec="${sec}" style="
                                flex:1; min-width:46px; padding:6px 4px; border-radius:8px; font-size:0.8em; font-weight:bold; cursor:pointer;
                                background:${seconds === sec ? 'rgba(243,156,18,0.2)' : '#222'};
                                border:1px solid ${seconds === sec ? '#f39c12' : '#444'};
                                color:${seconds === sec ? '#f39c12' : '#aaa'};">${sec >= 60 && sec % 60 === 0 ? `${sec / 60}分` : `${sec}秒`}</button>
                        `).join('')}
                    </div>
                    ${this.advancedBlock('timer', adv)}
                    <p class="rule-adv-note">タイマーの見た目（バー・円・時計・導火線など）は「見た目」の「タイマー」で選べます。</p>
                </div>
            `;
            this.wireAdvancedBlocks(container);
            container.querySelectorAll('.tl-kind-btn').forEach(btn => {
                btn.onclick = () => {
                    const v = btn.dataset.kind;
                    if (v === 'off') conf.timeLimitEnabled = 'off';
                    else {
                        const wasKind = conf.timerKind === 'pool' ? 'pool' : 'per_q';
                        conf.timeLimitEnabled = 'on';
                        conf.timerKind = v;
                        // 種類を変えた時は、それらしい秒数にしておく
                        if (wasKind !== v) conf.timeLimitSeconds = v === 'pool' ? 60 : 10;
                    }
                    render();
                    if (onChange) onChange();
                };
            });
            const input = container.querySelector('#tl-seconds-input');
            if (input) input.oninput = () => {
                conf.timeLimitSeconds = Math.max(1, Math.min(1800, parseInt(input.value) || 30));
                if (onChange) onChange();
            };
            container.querySelectorAll('.tl-preset-btn').forEach(btn => {
                btn.onclick = () => { conf.timeLimitSeconds = parseInt(btn.dataset.sec); render(); if (onChange) onChange(); };
            });
            const exp = container.querySelector('#tl-on-expire');
            if (exp) exp.onchange = () => { conf.timerOnExpire = exp.value; if (onChange) onChange(); };
            const bonus = container.querySelector('#tl-bonus');
            if (bonus) bonus.onchange = () => { conf.timerBonusCorrect = parseFloat(bonus.value) || 0; if (onChange) onChange(); };
            const pen = container.querySelector('#tl-penalty');
            if (pen) pen.onchange = () => { conf.timerPenaltyWrong = parseFloat(pen.value) || 0; if (onChange) onChange(); };
            const pb = container.querySelector('#tl-pause-buzz');
            if (pb) pb.onchange = () => { conf.timerPauseOnBuzz = pb.checked; if (onChange) onChange(); };
        };
        if (!conf.timeLimitSeconds) conf.timeLimitSeconds = 30;
        render();
    },

    renderScoreDetailInSheet: function (scoreType, conf) {
        const detailArea = document.getElementById('score-type-sheet-detail');
        if (!detailArea) return;
        let html = '';
        if (scoreType === 'uniform') {
            const uniformPts = conf.uniformPts !== undefined ? conf.uniformPts : 1;
            html = `<div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#aaa; font-size:0.9em;">正解者に一律</span>
                <input type="number" id="conf-score-uniform" style="width:70px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px; font-size:1em;" value="${uniformPts}" min="0">
                <span style="color:#aaa; font-size:0.9em;">点</span>
            </div>`;
        } else if (scoreType === 'ranked') {
            const ranks = conf.rankPts || [10, 5, 3];
            const otherPts = conf.rankOtherPts !== undefined ? conf.rankOtherPts : 1;
            html = `<div id="ranked-inputs">`;
            ranks.forEach((pts, i) => {
                html += `<div class="ranked-row" style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <span style="color:#aaa; font-size:0.85em; width:32px; text-align:right;">${i + 1}位</span>
                    <input type="number" class="rank-pt-input" data-index="${i}" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${pts}" min="0">
                    <span style="color:#aaa; font-size:0.85em;">点</span>
                    <button class="remove-rank-btn" data-index="${i}" style="background:#5c0000; border:1px solid #ff4444; color:#ff4444; border-radius:6px; padding:4px 10px; font-size:0.8em; cursor:pointer;">✕</button>
                </div>`;
            });
            html += `</div>
            <button id="add-rank-btn" style="margin-bottom:14px; padding:7px 14px; background:rgba(255,255,255,0.06); border:1px solid #444; color:#aaa; border-radius:6px; font-size:0.85em; cursor:pointer;">＋ 順位を追加</button>
            <div style="display:flex; align-items:center; gap:10px; border-top:1px dashed #333; padding-top:12px;">
                <span style="color:#888; font-size:0.85em;">上記以降は一律</span>
                <input type="number" id="conf-score-rank-other" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${otherPts}" min="0">
                <span style="color:#888; font-size:0.85em;">点</span>
            </div>`;
        } else if (scoreType === 'hint') {
            // ヒントの数は、問題作成のプレビューにある連想クイズのヒント欄の数
            const n = Math.max(1, document.querySelectorAll('#creator-form-container .assoc-text-input').length
                || (Array.isArray(conf.hintPts) ? conf.hintPts.length : 4));
            const saved = Array.isArray(conf.hintPts) ? conf.hintPts : [];
            // 未入力の段は、少ないヒントで当てるほど高得点になる初期値
            const pts = Array.from({ length: n }, (_, i) => (saved[i] !== undefined ? saved[i] : n - i));
            conf.hintPts = pts;
            html = pts.map((p, i) => `
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <span style="color:#aaa; font-size:0.85em; width:90px; text-align:right;">ヒント${i + 1}までで正解</span>
                    <input type="number" class="hint-pt-input" data-index="${i}" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${p}" min="0">
                    <span style="color:#aaa; font-size:0.85em;">点</span>
                </div>`).join('');
        } else if (scoreType === 'first_come') {
            const fcCount = conf.firstComeCount || 1;
            const fcPts = conf.firstComePts !== undefined ? conf.firstComePts : 10;
            html = `<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span style="color:#aaa; font-size:0.9em;">先着</span>
                <input type="number" id="conf-score-fc-count" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${fcCount}" min="1">
                <span style="color:#aaa; font-size:0.9em;">名に</span>
                <input type="number" id="conf-score-fc-pts" style="width:65px; text-align:center; padding:8px; background:#222; border:1px solid #555; color:#fff; border-radius:6px;" value="${fcPts}" min="0">
                <span style="color:#aaa; font-size:0.9em;">点</span>
            </div>`;
        }
        detailArea.innerHTML = html;

        if (scoreType === 'ranked') {
            const self = this;
            const addBtn = document.getElementById('add-rank-btn');
            if (addBtn) {
                addBtn.onclick = () => {
                    const inputs = document.querySelectorAll('#score-type-sheet-detail .rank-pt-input');
                    const newRanks = Array.from(inputs).map(inp => parseInt(inp.value) || 0);
                    newRanks.push(1);
                    conf.rankPts = newRanks;
                    const otherInp = document.getElementById('conf-score-rank-other');
                    if (otherInp) conf.rankOtherPts = parseInt(otherInp.value) || 0;
                    self.renderScoreDetailInSheet('ranked', conf);
                };
            }
            document.querySelectorAll('#score-type-sheet-detail .remove-rank-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const inputs = document.querySelectorAll('#score-type-sheet-detail .rank-pt-input');
                    const newRanks = Array.from(inputs).map(inp => parseInt(inp.value) || 0);
                    newRanks.splice(idx, 1);
                    conf.rankPts = newRanks;
                    const otherInp = document.getElementById('conf-score-rank-other');
                    if (otherInp) conf.rankOtherPts = parseInt(otherInp.value) || 0;
                    self.renderScoreDetailInSheet('ranked', conf);
                };
            });
        }
    },

    _collectScoreDetailFromSheet: function (conf) {
        // Called on Done, reads current sheet values into conf
        const scoreType = conf.scoreType || 'uniform';
        if (scoreType === 'uniform') {
            const el = document.getElementById('conf-score-uniform');
            if (el) conf.uniformPts = parseInt(el.value) || 0;
        } else if (scoreType === 'ranked') {
            const inputs = document.querySelectorAll('#score-type-sheet-detail .rank-pt-input');
            if (inputs.length > 0) {
                conf.rankPts = Array.from(inputs).map(inp => parseInt(inp.value) || 0);
            }
            const otherInp = document.getElementById('conf-score-rank-other');
            if (otherInp) conf.rankOtherPts = parseInt(otherInp.value) || 0;
        } else if (scoreType === 'hint') {
            const inputs = document.querySelectorAll('#score-type-sheet-detail .hint-pt-input');
            if (inputs.length > 0) conf.hintPts = Array.from(inputs).map(inp => parseInt(inp.value) || 0);
        } else if (scoreType === 'first_come') {
            const fcCount = document.getElementById('conf-score-fc-count');
            const fcPts = document.getElementById('conf-score-fc-pts');
            if (fcCount) conf.firstComeCount = parseInt(fcCount.value) || 1;
            if (fcPts) conf.firstComePts = parseInt(fcPts.value) || 0;
        }
    },
};
