/* =========================================================
 * host_sound_library.js (v1: Shared Sound Library)
 * =======================================================*/

// サウンドライブラリ — ホストメニューの「サウンド編集」から各カテゴリ
// （シンキングBGM/ボタンSE/正解音/不正解音）に複数の音源をアップロード
// して名前を付けておき、問題作成側（host_design.js の _openSoundModal）
// はここに登録済みの音源から選ぶだけになる。app_defaults/sounds（アプリ
// 全体のデフォルト4つ）とは別の、選べる「候補の集まり」という位置づけ。
window.App.SoundLibrary = {
    _keys: ['bgmThinking', 'seButton', 'seCorrect', 'seWrong'],
    _labels: {
        bgmThinking: '🎵 シンキングBGM',
        seButton: '🔘 ボタンSE',
        seCorrect: '⭕ 正解音',
        seWrong: '❌ 不正解音',
    },
    _cache: { bgmThinking: [], seButton: [], seCorrect: [], seWrong: [] },

    // 確認再生（▶ボタン）は常にこの1本の <audio> だけを使い回す —
    // 別々に `new Audio().play()` していると、連打した分だけ同時に鳴って
    // 重なってしまう。次の再生前に必ず一旦止めるので、常に最新の1つだけ
    // が鳴る。サウンド編集画面／問題作成側のピッカー、両方の▶から使う。
    _previewAudioEl: null,
    preview: function (url) {
        if (!url) return;
        if (!this._previewAudioEl) this._previewAudioEl = new Audio();
        const el = this._previewAudioEl;
        el.pause();
        el.currentTime = 0;
        el.src = url;
        el.play().catch(() => { /* noop — e.g. blocked before a user gesture */ });
    },

    // ライブラリを常時リアルタイム購読 — サウンド編集画面を開いていれば
    // 追加/削除が即座に反映され、問題作成側の _openSoundModal もモーダル
    // を開いた時点の最新キャッシュを読むだけで済む（都度フェッチ不要）。
    preload: function () {
        if (!window.db) return;
        window.db.ref('sound_library').on('value', snap => {
            const val = snap.val() || {};
            this._keys.forEach(key => {
                const cat = val[key] || {};
                this._cache[key] = Object.keys(cat).map(id => ({
                    id,
                    name: (cat[id] && cat[id].name) || '(無題)',
                    data: (cat[id] && cat[id].data) || '',
                }));
            });
            const view = document.getElementById('sound-library-view');
            if (view && !view.classList.contains('hidden')) this.render();
        });
    },

    init: function () {
        this.render();
    },

    render: function () {
        const container = document.getElementById('sound-library-body');
        if (!container) return;
        container.innerHTML = this._keys.map(key => this._categoryHtml(key)).join('');
        this._wireBody(container);
    },

    _categoryHtml: function (key) {
        const items = this._cache[key] || [];
        return `
            <div style="margin-bottom:18px; background:#111; border:1px solid #333; border-radius:12px; padding:14px;">
                <h4 style="margin:0 0 10px; color:#fff; font-size:0.95rem;">${this._labels[key]}</h4>
                <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
                    ${items.length ? items.map(it => `
                        <div style="display:flex; align-items:center; gap:8px; background:#1e293b; border:1px solid #475569; border-radius:8px; padding:8px 10px;">
                            <button type="button" data-key="${key}" data-play="${it.id}" title="再生して確認" style="flex:0 0 auto; background:none; border:none; color:#00e5ff; cursor:pointer; font-size:1rem;">▶</button>
                            <span style="flex:1; min-width:0; color:#fff; font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${it.name}</span>
                            <button type="button" data-key="${key}" data-delete="${it.id}" style="flex:0 0 auto; background:none; border:none; color:#ff6666; cursor:pointer; font-size:0.78rem;">削除</button>
                        </div>
                    `).join('') : '<p style="color:#666; font-size:0.8rem; margin:0;">まだ音源がありません</p>'}
                </div>
                <div style="display:flex; gap:6px;">
                    <input type="text" data-name-input="${key}" placeholder="名前（例：正解音A）" style="
                        flex:1; min-width:0; padding:8px; background:#0d1b2a; border:1px solid #475569;
                        border-radius:8px; color:#fff; font-size:0.85rem; box-sizing:border-box;
                    ">
                    <button type="button" data-upload-btn="${key}" style="
                        flex:0 0 auto; padding:8px 14px; background:rgba(0,229,255,0.08); border:1px dashed rgba(0,229,255,0.4);
                        border-radius:8px; color:#00e5ff; cursor:pointer; font-size:0.85rem; white-space:nowrap;
                    ">＋ 追加</button>
                    <input type="file" accept="audio/*" data-file-input="${key}" style="display:none;">
                </div>
            </div>
        `;
    },

    _wireBody: function (container) {
        container.querySelectorAll('[data-upload-btn]').forEach(btn => {
            btn.onclick = () => container.querySelector(`[data-file-input="${btn.dataset.uploadBtn}"]`)?.click();
        });
        container.querySelectorAll('[data-file-input]').forEach(inp => {
            inp.onchange = (e) => {
                const key = inp.dataset.fileInput;
                const file = e.target.files[0];
                if (!file) return;
                const nameInput = container.querySelector(`[data-name-input="${key}"]`);
                const name = (nameInput && nameInput.value.trim()) || file.name || '無題';
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this._addSound(key, name, ev.target.result);
                    if (nameInput) nameInput.value = '';
                    inp.value = '';
                };
                reader.readAsDataURL(file);
            };
        });
        container.querySelectorAll('[data-play]').forEach(btn => {
            btn.onclick = () => {
                const key = btn.dataset.key;
                const item = (this._cache[key] || []).find(it => it.id === btn.dataset.play);
                if (item) this.preview(item.data);
            };
        });
        container.querySelectorAll('[data-delete]').forEach(btn => {
            btn.onclick = () => {
                if (!confirm('この音源を削除しますか？（この音源を使っている問題では、以後「未設定」扱いになります）')) return;
                const key = btn.dataset.key;
                window.db.ref(`sound_library/${key}/${btn.dataset.delete}`).remove();
            };
        });
    },

    _addSound: function (key, name, data) {
        if (!window.db) return;
        if (window.App.Ui) window.App.Ui.showToast('追加中...');
        const ref = window.db.ref(`sound_library/${key}`).push();
        ref.set({ name, data }).then(() => {
            if (window.App.Ui) window.App.Ui.showToast('✅ 追加しました');
        }).catch(() => {
            if (window.App.Ui) window.App.Ui.showToast('⚠️ 追加に失敗しました（ファイルが大きすぎる可能性があります）');
        });
    },
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('menu-btn-sound-library')?.addEventListener('click', () => {
        window.App.Ui.showView('sound-library-view');
        window.App.SoundLibrary.init();
    });
});

App.SoundLibrary.preload();
