// 確認用（docs/ARCHITECTURE.md の「確かめ方」）。node dev/tests/player_theme.js で動かし、写真は dev/tests/out/ に出る
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript({ path: FAKEFB });
  const h = await ctx.newPage();
  h.on('pageerror', e => console.log('ERR', e.message));
  await h.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
  await h.goto(APP); await h.waitForTimeout(800);
  await h.evaluate(() => { window.open = () => null; window.App.State.currentShowId = 'S'; const d = {}; window.App.Themes.apply(d, 'newspaper'); window.App.Studio.quickStart({ title: 'T', config: { mode: 'buzz' }, questions: [{ type: 'free_oral', q: '日本一高い山は？', correct: '富士山', design: d }] }); });
  await h.waitForTimeout(1200);
  const room = await h.evaluate(() => window.App.State.currentRoomId);
  for (let i = 0; i < 4; i++) { const s = await h.evaluate(() => window.App.Studio.currentStepId); if (s === 2 || s === 3) break; await h.evaluate(() => document.getElementById('console-btn-phase-main').click()); await h.waitForTimeout(400); }
  // 同じページで回答者として入る
  await h.evaluate((room) => { window.App.Ui.showView(window.App.Ui.views.playerJoin || document.getElementById('room-code-input').closest('.view')); document.getElementById('room-code-input').value = room; document.getElementById('player-name-input').value = '赤井'; document.getElementById('join-room-btn').click(); }, room);
  await h.waitForTimeout(1500);
  await h.evaluate((room) => window.__fakeDb.ref(`rooms/${room}/status`).update({ step: 'answering', qIndex: 0, t: Date.now() }), room);
  await h.waitForTimeout(1200);
  console.log(await h.evaluate(() => { const pv = document.getElementById('player-game-view'); const sb = pv.querySelector('.player-status-bar'); return [pv.className, pv.style.cssText.slice(0, 200), sb && getComputedStyle(sb).backgroundColor, !pv.classList.contains('hidden')].join(' | '); }));
  console.log(await h.evaluate(() => { const out = []; let e = document.elementFromPoint(200, 1000); while (e) { const cs = getComputedStyle(e); if ((cs.backgroundImage && cs.backgroundImage !== 'none') || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') out.push(e.tagName + '#' + e.id + '.' + e.className + ' => ' + cs.backgroundImage.slice(0, 50) + ' ' + cs.backgroundColor); e = e.parentElement; } const n = document.getElementById('player-name-disp'); const q = [...document.querySelectorAll('#player-game-view *')].find(x => x.textContent.trim() === '日本一高い山は？' && x.children.length === 0); return out.join('\n') + '\nNAME ' + (n && n.className + ' ' + getComputedStyle(n).color) + '\nQ ' + (q && (q.tagName + '#' + q.id + '.' + q.className + ' < ' + q.parentElement.tagName + '#' + q.parentElement.id + '.' + q.parentElement.className)); }));
  await h.screenshot({ path: OUT + '/plth.png' });
  await b.close();
})();
