// 確認用: 解答者の早押し（口頭）の押し面。押す前・押した後を撮る
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 844, height: 390 }]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript({ path: FAKEFB });
    const h = await ctx.newPage();
    h.on('pageerror', e => console.log('ERR', e.message));
    await ctx.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
    await h.goto(APP); await h.waitForTimeout(800);
    await h.evaluate(() => { window.open = () => null; window.App.State.currentShowId = 'S'; window.App.Studio.quickStart({ title: 'T', config: { mode: 'buzz' }, questions: [{ type: 'free_oral', q: '日本で一番高い山は何でしょう？ 標高も合わせて答えてください', correct: '富士山' }] }); });
    await h.waitForTimeout(1200);
    const room = await h.evaluate(() => window.App.State.currentRoomId);
    for (let i = 0; i < 4; i++) { const s = await h.evaluate(() => window.App.Studio.currentStepId); if (s === 2) break; await h.evaluate(() => document.getElementById('console-btn-phase-main').click()); await h.waitForTimeout(400); }
    await h.evaluate((room) => { window.App.Ui.showView(window.App.Ui.views.respondent || document.getElementById('room-code-input').closest('.view')); document.getElementById('room-code-input').value = room; document.getElementById('player-name-input').value = 'あなた'; document.getElementById('join-room-btn').click(); }, room);
    await h.waitForTimeout(1500);
    await h.evaluate(([room, pm]) => window.__fakeDb.ref(`rooms/${room}/status`).update({ step: 'answering', qIndex: 0, isBuzzActive: true, t: Date.now(), playerMonitor: pm }), [room, process.env.PMON ? true : null]);
    await h.waitForTimeout(1000);
    const tag = `${vp.width}x${vp.height}${process.env.PMON ? '-mon' : ''}`;
    await h.screenshot({ path: `${OUT}/pbuzz-${tag}-1.png` });
    console.log(tag, await h.evaluate(() => { const b = document.getElementById('player-buzz-btn').getBoundingClientRect(); const q = document.querySelector('#question-text-disp, .player-q-text'); const qr = q ? q.getBoundingClientRect() : null; return `pad y=${Math.round(b.y)} h=${Math.round(b.height)} | q bottom=${qr ? Math.round(qr.bottom) : '-'} | overlap=${qr ? qr.bottom > b.y : '-'}`; }));
    const box = await h.$('#player-buzz-btn');
    const bb = await box.boundingBox();
    await h.touchscreen.tap(bb.x + bb.width * 0.3, bb.y + bb.height * 0.4);
    await h.waitForTimeout(150);
    await h.screenshot({ path: `${OUT}/pbuzz-${tag}-2.png` });
    console.log('pressed', await h.evaluate((room) => { const pl = Object.values(window.__fakeDb._get(`rooms/${room}/players`) || {}); return JSON.stringify(pl.map(p => [p.name, !!p.buzzTime])); }, room));
    await ctx.close();
  }
  await b.close();
})();
