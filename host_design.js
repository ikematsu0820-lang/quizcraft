/* =========================================================
 * host_design.js (v90: WYSIWYG Preview Calibration)
 * =======================================================*/

App.Design = {
    _activeDesignTab: 'text',

    defaults: {
        mainBgColor: "#0a0a0a",
        qTextColor: "#ffffff",
        qBgColor: "rgba(255, 255, 255, 0.05)",
        qBorderColor: "#00bfff",
        qFontSize: "36px",
        cTextColor: "#a0a0a0",
        cBgColor: "transparent",
        cBorderColor: "#333333",
        cFontSize: "25px",
        align: "center",
        cAlign: "left",
        layout: "top",
        bgmThinking: "",
        seButton: "",
        seCorrect: "",
        seWrong: ""
    },

    // サウンドのデフォルト保存 — one fixed default for the 4 サウンド
    // fields, shared app-wide (Firebase, not per-browser/per-account), so
    // every new question/set on any device starts with the same sounds.
    // Saved explicitly (a button in the サウンド tab); loaded into a local
    // cache as early as possible (see preloadAppDefaultSounds below) so
    // App.Creator.init()/loadSet() can read it synchronously.
    _soundKeys: ['bgmThinking', 'seButton', 'seCorrect', 'seWrong'],
    _cachedAppDefaultSounds: null,

    preloadAppDefaultSounds: function () {
        if (!window.db) return;
        window.db.ref('app_defaults/sounds').once('value')
            .then(snap => { this._cachedAppDefaultSounds = snap.val() || {}; })
            .catch(() => { this._cachedAppDefaultSounds = this._cachedAppDefaultSounds || {}; });
    },

    saveSoundDefaults: function (design) {
        const toSave = {};
        this._soundKeys.forEach(k => { toSave[k] = design[k] || ''; });
        if (!window.db) return Promise.resolve(false);
        return window.db.ref('app_defaults/sounds').set(toSave)
            .then(() => { this._cachedAppDefaultSounds = toSave; return true; })
            .catch(e => { console.error('saveSoundDefaults failed:', e); return false; });
    },

    // this.defaults, with the app-wide サウンドのデフォルト overlaid on
    // top (from the preload cache — synchronous, may be empty if the
    // preload hasn't resolved yet) — the base a brand-new question's/set's
    // design should start from.
    defaultsWithSavedSounds: function () {
        const base = { ...this.defaults };
        const saved = this._cachedAppDefaultSounds;
        if (saved) this._soundKeys.forEach(k => { if (saved[k]) base[k] = saved[k]; });
        return base;
    },

    // 問題文の位置 — normalizes legacy values ('standard'/'split') saved by
    // older sets to the current 4-direction vocabulary.
    normalizeLayout: function (v) {
        if (v === 'standard') return 'top';
        if (v === 'split') return 'right';
        if (['top', 'bottom', 'left', 'right'].includes(v)) return v;
        return 'top';
    },

    // Compact デザイン panel for the Creator's inline action-bar system
    // (mirrors App.Config's renderInlineXxx pattern: render into a given
    // container, mutate `design` directly on every change, no confirm
    // step). Only the core per-question visual fields — title/qnumber
    // reveal-card styling (prodDesign) is intentionally left out, per the
    // request to drop that entirely.
    // Native <input type=color> only accepts strict #rrggbb — fall back to
    // a neutral swatch color for values like "transparent"/rgba(...)/"" so
    // opening the picker doesn't silently coerce those to black.
    _toHexOrDefault: function (value, fallback = '#000000') {
        return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback;
    },

    renderInlineChooser: function (container, design, onChange) {
        if (!container) return;
        design.layout = this.normalizeLayout(design.layout);

        // Compact color swatches, 3 per row (no hex text field taking up
        // room — the current value is still available as a hover tooltip).
        const colorSwatch = (label, key) => `
            <div style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1 1 38px; min-width:0;">
                <input type="color" data-color-key="${key}" value="${this._toHexOrDefault(design[key])}" title="${design[key] ?? ''}" style="
                    width:100%; height:30px; padding:0; border:1px solid #475569; border-radius:6px; background:none; cursor:pointer;
                ">
                <span style="font-size:0.58rem; color:#94a3b8; white-space:nowrap;">${label}</span>
            </div>
        `;
        const colorRow = (items) => `
            <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
                ${items.map(([label, key]) => colorSwatch(label, key)).join('')}
            </div>
        `;

        // Compact 3-per-row variants (control on top, small caption below —
        // matches colorSwatch's look) used to fit 文字色/サイズ/配置 in one
        // row for 問題文 and 選択肢 each.
        const miniText = (label, key) => `
            <div style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; min-width:0;">
                <input type="text" data-key="${key}" value="${design[key] ?? ''}" style="
                    width:100%; padding:5px 4px; background:#1e293b; border:1px solid #475569;
                    border-radius:6px; color:#fff; font-size:0.72rem; text-align:center; box-sizing:border-box;
                ">
                <span style="font-size:0.58rem; color:#94a3b8; white-space:nowrap;">${label}</span>
            </div>
        `;
        const miniSelect = (label, key, options) => `
            <div style="display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; min-width:0;">
                <select data-key="${key}" style="
                    width:100%; padding:5px 2px; background:#1e293b; border:1px solid #475569;
                    border-radius:6px; color:#fff; font-size:0.66rem; box-sizing:border-box;
                ">
                    ${options.map(o => `<option value="${o.v}" ${design[key] === o.v ? 'selected' : ''}>${o.t}</option>`).join('')}
                </select>
                <span style="font-size:0.58rem; color:#94a3b8; white-space:nowrap;">${label}</span>
            </div>
        `;
        const ALIGN_OPTS = [{ v: 'left', t: '左寄せ' }, { v: 'center', t: '中央' }, { v: 'right', t: '右寄せ' }];

        const gridSummary = () => {
            const r = parseInt(design.gridRows) || 0;
            const c = parseInt(design.gridCols) || 0;
            return (r > 0 && c > 0) ? `${r}行 × ${c}列` : '自動';
        };

        const bodyHtml = {
            text: () => `
                <div style="color:#666; font-size:0.7rem; margin:0 0 4px;">問題文</div>
                <div style="display:flex; gap:6px; margin-bottom:10px;">
                    ${colorSwatch('文字色', 'qTextColor')}
                    ${miniText('サイズ', 'qFontSize')}
                    ${miniSelect('配置', 'align', ALIGN_OPTS)}
                </div>
                <div style="color:#666; font-size:0.7rem; margin:0 0 4px;">選択肢</div>
                <div style="display:flex; gap:6px; margin-bottom:6px;">
                    ${colorSwatch('文字色', 'cTextColor')}
                    ${miniText('サイズ', 'cFontSize')}
                    ${miniSelect('配置', 'cAlign', ALIGN_OPTS)}
                </div>
            `,
            object: () => {
                const transparentToggle = (label, key) => `
                    <label style="display:flex; align-items:center; gap:3px; cursor:pointer; color:#94a3b8; font-size:0.62rem; white-space:nowrap;">
                        <input type="checkbox" data-transparent-key="${key}" ${design[key] === 'transparent' ? 'checked' : ''} style="width:12px; height:12px; accent-color:#00e5ff;">
                        ${label}を透明に
                    </label>
                `;
                const bgImg = design.bgImage || '';
                const hasBgImg = bgImg.startsWith('data:') || bgImg.startsWith('http');
                return `
                ${colorRow([
                    ['全体背景', 'mainBgColor'],
                    ['問題枠', 'qBorderColor'], ['問題背景', 'qBgColor'],
                    ['選択枠', 'cBorderColor'], ['選択背景', 'cBgColor'],
                ])}
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin:-4px 0 10px;">
                    ${transparentToggle('問題枠', 'qBorderColor')}
                    ${transparentToggle('問題背景', 'qBgColor')}
                    ${transparentToggle('選択枠', 'cBorderColor')}
                    ${transparentToggle('選択背景', 'cBgColor')}
                </div>
                <div style="margin-bottom:10px; padding:8px; background:#1e293b; border:1px solid #475569; border-radius:8px;">
                    <div style="color:#94a3b8; font-size:0.75rem; margin-bottom:4px;">全体背景に画像を使う</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button type="button" id="design-bgimg-file-btn" style="flex:0 0 auto; padding:5px 10px; background:#333; border:none; border-radius:6px; color:#00e5ff; cursor:pointer; font-size:0.7rem;">📁 画像を選択</button>
                        <span id="design-bgimg-status" style="font-size:0.68rem; color:${hasBgImg ? '#00ff88' : '#666'};">${hasBgImg ? '画像設定済み' : '未設定（色のみ）'}</span>
                        <button type="button" id="design-bgimg-clear-btn" title="クリア" style="margin-left:auto; padding:4px 9px; background:#442222; border:none; border-radius:6px; color:#ff8888; cursor:pointer; font-size:0.68rem;">×</button>
                    </div>
                    <input type="file" accept="image/*" id="design-bgimg-file-input" style="display:none;">
                </div>
                <div style="color:#666; font-size:0.7rem; margin:8px 0 4px; border-top:1px dashed #333; padding-top:6px;">選択肢の配置（選択式のみ）／問題文の位置</div>
                <div style="display:flex; gap:6px; margin-bottom:6px;">
                    <button type="button" id="design-grid-config-btn" style="
                        flex:1; min-width:0; padding:6px 6px; background:#1e293b; border:1px solid #475569;
                        border-radius:8px; color:#fff; font-size:0.72rem; cursor:pointer;
                        display:flex; flex-direction:column; align-items:center; gap:2px;
                    ">
                        <span>選択肢の配置</span>
                        <span id="design-grid-summary" style="color:#00e5ff; font-weight:bold;">${gridSummary()}</span>
                    </button>
                    <select data-key="layout" style="
                        flex:1; min-width:0; padding:6px 4px; background:#1e293b; border:1px solid #475569;
                        border-radius:8px; color:#fff; font-size:0.72rem; box-sizing:border-box;
                    ">
                        ${[{ v: 'top', t: '問題文: 上側' }, { v: 'left', t: '問題文: 左側' }, { v: 'right', t: '問題文: 右側' }, { v: 'bottom', t: '問題文: 下側' }]
                            .map(o => `<option value="${o.v}" ${design.layout === o.v ? 'selected' : ''}>${o.t}</option>`).join('')}
                    </select>
                </div>
            `;
            },
            sound: () => {
                const soundRow = (label, key) => {
                    const val = design[key] || '';
                    const hasFile = val.startsWith('data:');
                    const isUrl = val && !hasFile;
                    return `
                        <div style="margin-bottom:10px; padding:8px; background:#1e293b; border:1px solid #475569; border-radius:8px;">
                            <div style="color:#94a3b8; font-size:0.75rem; margin-bottom:4px;">${label}</div>
                            <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
                                <input type="text" data-sound-key="${key}" value="${isUrl ? val : ''}" placeholder="音声URLを入力" style="
                                    flex:1; min-width:0; padding:5px 7px; background:#0d1b2a; border:1px solid #475569;
                                    border-radius:6px; color:#fff; font-size:0.72rem;
                                ">
                                <button type="button" data-sound-play-btn="${key}" title="再生して確認" style="flex:0 0 auto; padding:5px 9px; background:#00a8cc; border:none; border-radius:6px; color:#fff; cursor:pointer;">▶</button>
                                <button type="button" data-sound-clear-btn="${key}" title="クリア" style="flex:0 0 auto; padding:5px 9px; background:#442222; border:none; border-radius:6px; color:#ff8888; cursor:pointer;">×</button>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button type="button" data-sound-file-btn="${key}" style="flex:0 0 auto; padding:4px 10px; background:#333; border:none; border-radius:6px; color:#00e5ff; cursor:pointer; font-size:0.7rem;">📁 ファイルを選択</button>
                                <span data-sound-status="${key}" style="font-size:0.68rem; color:${hasFile ? '#00ff88' : (isUrl ? '#00e5ff' : '#666')};">${hasFile ? 'ファイル登録済み' : (isUrl ? 'URL設定済み' : '未設定')}</span>
                            </div>
                            <input type="file" accept="audio/*" data-sound-file-input="${key}" style="display:none;">
                        </div>
                    `;
                };
                return `
                    ${soundRow('シンキングタイムBGM', 'bgmThinking')}
                    ${soundRow('ボタンを押した時のSE', 'seButton')}
                    ${soundRow('正解時の音', 'seCorrect')}
                    ${soundRow('不正解時の音', 'seWrong')}
                    <p style="color:#555; font-size:0.65rem; margin:4px 0 10px;">※シンキングタイムBGMはモニター画面、その他は各プレイヤーの端末で再生されます</p>
                    <button type="button" id="design-save-sound-defaults-btn" style="
                        width:100%; padding:8px; font-size:0.78rem; font-weight:bold;
                        background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4);
                        border-radius:8px; color:#00e5ff; cursor:pointer;
                    ">💾 この4つをアプリ全体のデフォルトにする</button>
                    <p style="color:#555; font-size:0.62rem; margin:4px 0 0;">※新規の問題・セットを作るとき、端末やアカウントに関係なく、ここで保存した音が最初から設定された状態で始まります</p>
                `;
            },
            animation: () => `<p style="color:#666; font-size:0.8rem; text-align:center; padding:30px 0;">アニメーションは準備中です</p>`,
        };

        const tabs = [
            { key: 'text', label: 'テキスト' },
            { key: 'object', label: 'オブジェクト' },
            { key: 'sound', label: 'サウンド' },
            { key: 'animation', label: 'アニメーション' },
        ];
        if (!bodyHtml[this._activeDesignTab]) this._activeDesignTab = 'text';

        const wireBody = (body) => {
            body.querySelector('#design-grid-config-btn')?.addEventListener('click', () => this._openGridModal(design, onChange));
            body.querySelectorAll('input[type="text"][data-key], input[type="number"][data-key]').forEach(inp => {
                inp.oninput = () => {
                    design[inp.dataset.key] = inp.value;
                    if (onChange) onChange();
                };
            });
            body.querySelectorAll('input[type="color"][data-color-key]').forEach(picker => {
                picker.oninput = () => {
                    const key = picker.dataset.colorKey;
                    design[key] = picker.value;
                    picker.title = picker.value;
                    // Picking a real color exits 透明 for that field.
                    const chk = body.querySelector(`input[data-transparent-key="${key}"]`);
                    if (chk) chk.checked = false;
                    if (onChange) onChange();
                };
            });
            body.querySelectorAll('select[data-key]').forEach(sel => {
                sel.onchange = () => {
                    design[sel.dataset.key] = sel.value;
                    if (onChange) onChange();
                    if (sel.dataset.key === 'layout' && window.App.Creator) window.App.Creator.applyDesignToPreview();
                };
            });

            // オブジェクト tab: 無色透明 — <input type=color> can't represent
            // transparency, so this is a separate checkbox that stores the
            // literal string 'transparent' (already the app's convention —
            // see cBgColor's default) instead of a hex value.
            body.querySelectorAll('input[data-transparent-key]').forEach(chk => {
                const key = chk.dataset.transparentKey;
                const picker = body.querySelector(`input[type="color"][data-color-key="${key}"]`);
                const syncSwatch = () => {
                    if (!picker) return;
                    picker.disabled = chk.checked;
                    picker.style.opacity = chk.checked ? '0.35' : '1';
                };
                chk.onchange = () => {
                    design[key] = chk.checked ? 'transparent' : this._toHexOrDefault('');
                    syncSwatch();
                    if (onChange) onChange();
                };
                syncSwatch(); // reflect initial checked state without mutating design
            });

            // オブジェクト tab: 全体背景 image upload (file → base64) or clear.
            body.querySelector('#design-bgimg-file-btn')?.addEventListener('click', () => {
                body.querySelector('#design-bgimg-file-input')?.click();
            });
            body.querySelector('#design-bgimg-file-input')?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    design.bgImage = ev.target.result;
                    const status = body.querySelector('#design-bgimg-status');
                    if (status) { status.textContent = '画像設定済み'; status.style.color = '#00ff88'; }
                    if (onChange) onChange();
                };
                reader.readAsDataURL(file);
            });
            body.querySelector('#design-bgimg-clear-btn')?.addEventListener('click', () => {
                design.bgImage = '';
                const status = body.querySelector('#design-bgimg-status');
                if (status) { status.textContent = '未設定（色のみ）'; status.style.color = '#666'; }
                if (onChange) onChange();
            });

            // サウンド tab: URL text field, file upload (→ base64), preview
            // playback, and clear — per soundRow above.
            const refreshSoundStatus = (key, val) => {
                const status = body.querySelector(`span[data-sound-status="${key}"]`);
                if (!status) return;
                const hasFile = (val || '').startsWith('data:');
                const isUrl = val && !hasFile;
                status.textContent = hasFile ? 'ファイル登録済み' : (isUrl ? 'URL設定済み' : '未設定');
                status.style.color = hasFile ? '#00ff88' : (isUrl ? '#00e5ff' : '#666');
            };
            body.querySelectorAll('input[data-sound-key]').forEach(inp => {
                inp.oninput = () => {
                    const key = inp.dataset.soundKey;
                    design[key] = inp.value;
                    refreshSoundStatus(key, inp.value);
                    if (onChange) onChange();
                };
            });
            body.querySelectorAll('button[data-sound-file-btn]').forEach(btn => {
                btn.onclick = () => body.querySelector(`input[data-sound-file-input="${btn.dataset.soundFileBtn}"]`)?.click();
            });
            body.querySelectorAll('input[data-sound-file-input]').forEach(fileInp => {
                fileInp.onchange = (e) => {
                    const key = fileInp.dataset.soundFileInput;
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        design[key] = ev.target.result;
                        const textInp = body.querySelector(`input[data-sound-key="${key}"]`);
                        if (textInp) textInp.value = '';
                        refreshSoundStatus(key, design[key]);
                        if (onChange) onChange();
                    };
                    reader.readAsDataURL(file);
                };
            });
            body.querySelectorAll('button[data-sound-play-btn]').forEach(btn => {
                btn.onclick = () => {
                    const url = design[btn.dataset.soundPlayBtn];
                    if (!url) { if (window.App.Ui) window.App.Ui.showToast('音声が未設定です'); return; }
                    try { new Audio(url).play().catch(() => {}); } catch (e) { /* noop */ }
                };
            });
            body.querySelectorAll('button[data-sound-clear-btn]').forEach(btn => {
                btn.onclick = () => {
                    const key = btn.dataset.soundClearBtn;
                    design[key] = '';
                    const textInp = body.querySelector(`input[data-sound-key="${key}"]`);
                    if (textInp) textInp.value = '';
                    refreshSoundStatus(key, '');
                    if (onChange) onChange();
                };
            });
            body.querySelector('#design-save-sound-defaults-btn')?.addEventListener('click', () => {
                if (window.App.Ui) window.App.Ui.showToast('保存中...');
                this.saveSoundDefaults(design).then(ok => {
                    if (window.App.Ui) {
                        window.App.Ui.showToast(ok ? '✅ アプリ全体のデフォルトとして保存しました' : '⚠️ 保存に失敗しました（音声ファイルが大きすぎる可能性があります）');
                    }
                });
            });
        };

        const renderBody = () => {
            const body = container.querySelector('#design-subtab-body');
            body.innerHTML = bodyHtml[this._activeDesignTab]();
            wireBody(body);
        };

        container.innerHTML = `
            <div style="display:flex; gap:0; margin:-4px -4px 10px; border-radius:8px; overflow:hidden; border:1px solid #333;">
                ${tabs.map(t => `
                    <button type="button" class="design-subtab-btn" data-tab="${t.key}" style="
                        flex:1; padding:8px 2px; font-size:0.72rem; font-weight:bold; border:none; cursor:pointer;
                        background:${this._activeDesignTab === t.key ? '#00a8cc' : '#1e293b'}; color:#fff;
                    ">${t.label}</button>
                `).join('')}
            </div>
            <div id="design-subtab-body"></div>
        `;
        container.querySelectorAll('.design-subtab-btn').forEach(btn => {
            btn.onclick = () => {
                this._activeDesignTab = btn.dataset.tab;
                container.querySelectorAll('.design-subtab-btn').forEach(b => {
                    b.style.background = (b.dataset.tab === this._activeDesignTab) ? '#00a8cc' : '#1e293b';
                });
                renderBody();
            };
        });
        renderBody();
    },

    // 選択肢の配置 popup — rows × cols must cover every choice already
    // added, or the grid would silently drop some off-screen; block
    // confirming until it does instead of letting that happen quietly.
    _openGridModal: function (design, onChange) {
        const existing = document.getElementById('design-grid-modal');
        if (existing) existing.remove();

        const choiceCount = document.querySelectorAll('#creator-form-container .choice-text-input').length;

        const overlay = document.createElement('div');
        overlay.id = 'design-grid-modal';
        overlay.className = 'design-modal-overlay';
        overlay.innerHTML = `
            <div class="design-modal-content" style="max-width:300px; padding:22px !important;">
                <h3 class="modal-title" style="font-size:1.05em; margin-bottom:6px;">選択肢の配置</h3>
                <p style="color:#888; font-size:0.75rem; text-align:center; margin:0 0 16px;">
                    左上から順に敷き詰められ、余ったマスは空欄になります${choiceCount ? `（現在 ${choiceCount} 個）` : ''}
                </p>
                <div style="display:flex; gap:12px; margin-bottom:6px;">
                    <div style="flex:1;">
                        <label style="color:#94a3b8; font-size:0.75rem; display:block; margin-bottom:4px; text-align:center;">行数</label>
                        <input type="number" id="grid-modal-rows" min="1" max="10" value="${design.gridRows || ''}" placeholder="自動" style="
                            width:100%; padding:8px; text-align:center; background:#1e293b; border:1px solid #475569;
                            border-radius:8px; color:#fff; font-size:1rem; box-sizing:border-box;
                        ">
                    </div>
                    <div style="flex:1;">
                        <label style="color:#94a3b8; font-size:0.75rem; display:block; margin-bottom:4px; text-align:center;">列数</label>
                        <input type="number" id="grid-modal-cols" min="1" max="10" value="${design.gridCols || ''}" placeholder="自動" style="
                            width:100%; padding:8px; text-align:center; background:#1e293b; border:1px solid #475569;
                            border-radius:8px; color:#fff; font-size:1rem; box-sizing:border-box;
                        ">
                    </div>
                </div>
                <div id="grid-modal-error" style="color:#ff5555; font-size:0.75rem; text-align:center; min-height:1.2em; margin-bottom:6px;"></div>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button type="button" id="grid-modal-cancel" style="flex:1; padding:10px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">キャンセル</button>
                    <button type="button" id="grid-modal-clear" style="flex:1; padding:10px; border-radius:8px; background:#333; border:none; color:#ccc; cursor:pointer;">自動に戻す</button>
                    <button type="button" id="grid-modal-ok" style="flex:1; padding:10px; border-radius:8px; background:#00e5ff; border:none; color:#000; font-weight:bold; cursor:pointer;">決定</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('#grid-modal-cancel').onclick = close;
        overlay.querySelector('#grid-modal-clear').onclick = () => {
            design.gridRows = '';
            design.gridCols = '';
            close();
            if (window.App.Creator) window.App.Creator.applyDesignToPreview();
            const summary = document.getElementById('design-grid-summary');
            if (summary) summary.textContent = '自動';
            if (onChange) onChange();
        };
        overlay.querySelector('#grid-modal-ok').onclick = () => {
            const rowsInp = overlay.querySelector('#grid-modal-rows');
            const colsInp = overlay.querySelector('#grid-modal-cols');
            const rows = parseInt(rowsInp.value) || 0;
            const cols = parseInt(colsInp.value) || 0;
            const errEl = overlay.querySelector('#grid-modal-error');

            if ((rowsInp.value && !colsInp.value) || (!rowsInp.value && colsInp.value)) {
                errEl.textContent = '行数・列数は両方入力してください';
                return;
            }
            if (rows > 0 && cols > 0 && choiceCount > 0 && rows * cols < choiceCount) {
                errEl.textContent = `行列が足りません（選択肢は${choiceCount}個あります）`;
                return;
            }

            design.gridRows = rowsInp.value ? rows : '';
            design.gridCols = colsInp.value ? cols : '';
            close();
            if (window.App.Creator) window.App.Creator.applyDesignToPreview();
            const summary = document.getElementById('design-grid-summary');
            if (summary) summary.textContent = (rows > 0 && cols > 0) ? `${rows}行 × ${cols}列` : '自動';
            if (onChange) onChange();
        };
    },

};

// Kick off the app-wide サウンドのデフォルト fetch as soon as this script
// loads (firebase.js runs first, so window.db is already available) —
// by the time a user opens the Creator, the cache is almost always ready.
App.Design.preloadAppDefaultSounds();
