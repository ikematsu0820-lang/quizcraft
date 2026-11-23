// 確認用（docs/ARCHITECTURE.md の「確かめ方」）。node dev/tests/host_reveal.js で動かし、写真は dev/tests/out/ に出る
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
  await h.evaluate(() => { window.open = () => null; window.App.State.currentShowId = 'S'; window.App.Studio.quickStart({ title: '発表', config: { mode: 'buzz', judgeCue: 'big_name', revealTiming: 'auto', rvGain: 'on', revealStyle: 'band' }, questions: [{ type: 'free_oral', q: '問1', correct: '答え', points: 10 }, { type: 'multi', q: '多答', c: ['あ', 'い', 'う', 'え'], correct: ['あ', 'い', 'う', 'え'] }] }); });
  await h.waitForTimeout(1200);
  const room = await h.evaluate(() => window.App.State.currentRoomId);
  await h.evaluate((room) => window.__fakeDb.ref(`rooms/${room}/players`).update({ a: { name: '赤井', periodScore: 0, isAlive: true }, b: { name: '青木', periodScore: 0, isAlive: true } }), room);
  const main = () => h.evaluate(() => document.getElementById('console-btn-phase-main').click());
  const status = () => h.evaluate((room) => new Promise(r => window.__fakeDb.ref(`rooms/${room}/status`).once('value', s => r(s.val()))), room);
  for (let i = 0; i < 6; i++) { const s = await h.evaluate(() => window.App.Studio.currentStepId); if (s === 2 || s === 3) break; await main(); await h.waitForTimeout(400); }
  // 青木が押して不正解 → 赤井が押して正解
  await h.evaluate((room) => window.__fakeDb.ref(`rooms/${room}/players/b`).update({ buzzTime: Date.now(), buzzPressAt: Date.now() }), room); await h.waitForTimeout(600);
  await h.evaluate(() => window.App.Studio.judgeBuzz(false)); await h.waitForTimeout(500);
  let s = await status(); console.log('after wrong cue', JSON.stringify(s.judgeCue), s.step);
  await h.evaluate((room) => window.__fakeDb.ref(`rooms/${room}/players/a`).update({ buzzTime: Date.now(), buzzPressAt: Date.now() }), room); await h.waitForTimeout(600);
  await h.evaluate(() => window.App.Studio.judgeBuzz(true)); await h.waitForTimeout(800);
  s = await status(); console.log('after correct', s.step, JSON.stringify(s.judgeCue), JSON.stringify(s.revealWinners), JSON.stringify(s.revealGains), 'host step', await h.evaluate(() => window.App.Studio.currentStepId), await h.evaluate(() => document.getElementById('console-btn-phase-main').innerText));
  await h.screenshot({ path: OUT + '/h-after.png' });
  // 次の問題（多答）
  await main(); await h.waitForTimeout(600);
  for (let i = 0; i < 6; i++) { const st = await h.evaluate(() => [window.App.Studio.currentStepId, window.App.State.currentQIndex]); if (st[1] === 1 && (st[0] === 2 || st[0] === 3)) break; await main(); await h.waitForTimeout(400); }
  s = await status(); console.log('q2', s.step, s.qIndex, 'cue cleared?', s.judgeCue);
  await h.evaluate(() => window.App.Studio.toggleMultiAnswer(3)); await h.waitForTimeout(300);
  await h.screenshot({ path: OUT + '/h-multi.png' });
  console.log('buttons', await h.evaluate(() => [...document.querySelectorAll('.mans-open')].map(b => b.textContent).join(',')));
  await h.evaluate(() => document.querySelector('.mans-open[data-open="rest"]').click()); await h.waitForTimeout(400);
  s = await status(); console.log('revealedMulti', JSON.stringify(s.revealedMulti), await h.evaluate(() => document.querySelector('.mans-count')?.textContent), 'scores', await h.evaluate(() => JSON.stringify(Object.values(window.App.Data.players || {}).map(p => p.name + p.periodScore))));
  await b.close();
})();
