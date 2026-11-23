// 確認用: 司会者の待合室（第1問の前）— 「解答者のスマホにモニターを映す」の切り替え
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
  await h.evaluate(() => { window.open = () => null; window.App.State.currentShowId = 'S'; window.App.Studio.quickStart({ title: '名言クイズ', config: { mode: 'normal' }, questions: [{ type: 'choice', q: 'Q', c: ['言った', '言ってない'], correct: [0] }] }); });
  await h.waitForTimeout(1500);
  await h.evaluate(() => document.querySelector('.hl-pmon')?.scrollIntoView({ block: 'center' }));
  await h.evaluate(() => { const c = document.querySelector('.hl-pmon-chk'); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } });
  await h.waitForTimeout(300);
  console.log('status.playerMonitor =', await h.evaluate(() => window.__fakeDb._get(`rooms/${window.App.State.currentRoomId}/status/playerMonitor`)));
  await h.screenshot({ path: `${OUT}/lobby-pmon.png` });
  await b.close();
})();
