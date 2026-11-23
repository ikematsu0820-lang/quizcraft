/* =========================================================
 * firebase.js (v66: Core DB Init Only)
 * =======================================================*/

const firebaseConfig = {
  apiKey: "AIzaSyDl9kq_jJb_zvYc3lfTfL_oTQrdqv2Abww",
  databaseURL: "https://quizcraft-56950-default-rtdb.asia-southeast1.firebasedatabase.app/",
  authDomain: "quizcraft-56950.firebaseapp.com",
  projectId: "quizcraft-56950",
  storageBucket: "quizcraft-56950.firebasestorage.app",
  messagingSenderId: "556267695492",
  appId: "1:556267695492:web:9855ff279731300b4101d1",
  measurementId: "G-3HRYY8ZC2W"
};

// お試し（trial.js）の画面: 通信せず、親のページの「端末の中だけのデータベース」を使う（local_db.js）
const __localTrial = (() => {
    try {
        if (!new URLSearchParams(location.search).has('local')) return null;
        // 親、その親…と上へたどる（お試しの解答者の中に、さらにモニターを入れる時）
        let w = window;
        while (w.parent && w.parent !== w) { w = w.parent; if (w.__trialStore) return w.__trialStore; }
        return null;
    } catch (e) { return null; }
})();

if (__localTrial && window.LocalDb) {
    window.__isTrial = true;
    if (typeof firebase === 'undefined') window.firebase = { apps: [1], initializeApp: () => {}, database: { ServerValue: { TIMESTAMP: { '.sv': 'timestamp' } } } };
    window.db = window.LocalDb.client(__localTrial);
} else {
    // 二重初期化防止
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    // グローバルなDB参照ショートカット（これだけは便利なので残す）
    window.db = firebase.database();
}
