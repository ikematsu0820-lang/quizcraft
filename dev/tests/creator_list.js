// 確認用: スマホの問題一覧の画面（保存したセットを開いた時）
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
  await ctx.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
  await p.goto(APP); await p.waitForTimeout(800);
  await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
  await p.evaluate(() => document.querySelector('#select-type-view .type-select-card[data-type="free"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#ps-overlay .ps-go').click()); await p.waitForTimeout(700);
  for (const [q, a] of [['日本一高い山は？', '富士山'], ['日本一長い川は？', '信濃川']]) {
    await p.fill('#question-text', q); await p.fill('#creator-text-answer', a);
    await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.offsetParent && /追加して次へ/.test(x.textContent)).click()); await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/cnext-flash.png` }); await p.waitForTimeout(250);
  }
  await p.waitForTimeout(2600); // お知らせが消えるのを待つ
  await p.screenshot({ path: `${OUT}/cnext.png` });
  await p.evaluate(() => window.App.CreatorMobile.showList()); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/clist.png` });
  await b.close();
})();
