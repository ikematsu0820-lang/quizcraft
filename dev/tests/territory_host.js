// 確認用: 陣取りパネルの司会者の盤面（本番の画面）とモニター
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
  await ctx.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
  await h.goto(APP); await h.waitForTimeout(800);
  const qs = [[7, '鯨', 'くじら'], [8, '鰆', 'さわら'], [12, '鮪', 'まぐろ'], [13, '鰐', 'わに'], [6, '鮭', 'さけ'], [11, '鯛', 'たい']].map(([c, q, a]) => ({ type: 'free_oral', q, correct: [a], tpCell: c }));
  await h.evaluate((qs) => { window.open = () => null; window.App.State.currentShowId = 'S'; window.App.Studio.quickStart({ title: '陣取り', config: { mode: 'buzz', gameType: 'territory', tpRows: 5, tpCols: 5, tpPrompt: '魚へんの漢字の読み' }, questions: qs }); }, qs);
  await h.waitForTimeout(1200);
  const room = await h.evaluate(() => window.App.State.currentRoomId);
  await h.evaluate((room) => window.__fakeDb.ref(`rooms/${room}/players`).update({ a: { name: '赤井', periodScore: 0, isAlive: true }, b: { name: '青木', periodScore: 0, isAlive: true } }), room);
  await h.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { if (await h.evaluate(() => !!document.getElementById('tp-host'))) break; await h.evaluate(() => document.getElementById('console-btn-phase-main').click()); await h.waitForTimeout(500); }
  await h.screenshot({ path: `${OUT}/tph-1-open.png` });
  await h.evaluate((room) => window.__fakeDb.ref(`rooms/${room}/players/a`).update({ buzzTime: Date.now(), buzzPressAt: Date.now() }), room);
  await h.waitForTimeout(900);
  await h.screenshot({ path: `${OUT}/tph-2-pick.png` });
  await h.evaluate(() => document.querySelector('#tp-host .tp-cell.can[data-tp="12"]')?.click()); await h.waitForTimeout(400);
  await h.screenshot({ path: `${OUT}/tph-3-judge.png` });
  await h.evaluate(() => document.querySelector('#tp-host [data-act="ok"]')?.click()); await h.waitForTimeout(600);
  await h.screenshot({ path: `${OUT}/tph-4-result.png` });
  console.log('scores', await h.evaluate(() => JSON.stringify(Object.values(window.App.Data.players || {}).map(p => p.name + p.periodScore))));
  // モニター
  const m = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await m.addInitScript({ path: FAKEFB });
  await m.route(/gstatic|googleapis|jsdelivr/, r => r.abort());
  await m.goto(APP); await m.waitForTimeout(800);
  const tp = await h.evaluate((room) => window.__fakeDb._get(`rooms/${room}/status/tp`), room);
  const players = await h.evaluate((room) => window.__fakeDb._get(`rooms/${room}/players`), room);
  await m.evaluate(([tp, players]) => { window.App.Ui.showView(window.App.Ui.views.viewerMain); window.App.Territory._role = 'viewer'; window.App.Territory._remote = { tp, players }; window.App.Territory._watchRoom = 'X'; window.App.Territory.watch = () => {}; window.App.Territory.renderRemote(); }, [tp, players]);
  await m.waitForTimeout(500);
  await m.screenshot({ path: `${OUT}/tph-monitor.png` });
  await b.close();
})();
