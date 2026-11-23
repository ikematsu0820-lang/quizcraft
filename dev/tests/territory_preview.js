// 確認用（docs/ARCHITECTURE.md の「確かめ方」）。陣取りパネルの問題を書く画面とプレビュー
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript({ path: FAKEFB });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
  await p.goto(APP); await p.waitForTimeout(800);
  await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
  await p.evaluate(() => document.querySelector('#select-type-view .type-select-card[data-type="territory"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#ps-overlay .ps-go')?.click()); await p.waitForTimeout(700);
  await p.fill('#question-text', process.argv[2] || '鯖');
  await p.screenshot({ path: OUT + '/tp-edit.png' });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.offsetParent && x.textContent.trim().startsWith('プレビュー')).click()); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + '/tp-preview.png' });
  console.log(await p.evaluate(() => { const d = window.App.Data.currentDesign || {}; const q = window.App.CreatorMobile.previewQuestion(); return JSON.stringify({ type: q.type, layout: q.layout, qWritingMode: d.qWritingMode, qPos: d.qPos, keys: Object.keys(d).filter(k => /layout|split|Writing|qPos|qImg|Layout/i.test(k)).map(k => k + '=' + d[k]) }); }));
  await b.close();
})();
