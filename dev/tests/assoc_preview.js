// 確認用: 連想クイズのプレビューでヒントが見えるか
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
  await p.evaluate(() => document.querySelector('#select-type-view .type-select-card[data-type="assoc_group"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#ps-overlay .ps-go').click()); await p.waitForTimeout(700);
  await p.fill('#question-text', 'なんでしょう？');
  const hs = await p.$$('.assoc-text-input');
  await hs[0].fill('きてぃちゃん'); await hs[1].fill('スティーブジョブズ'); await hs[2].fill('ジュース');
  await p.evaluate(() => { const a = document.getElementById('creator-assoc-answer') || document.getElementById('creator-text-answer'); a.value = 'りんご'; a.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => window.App.CreatorMobile.openPreview()); await p.waitForTimeout(600);
  console.log(await p.evaluate(() => [...document.querySelectorAll('.cm-stage-main .choice-item')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await p.screenshot({ path: `${OUT}/assoc-preview.png` });
  await b.close();
})();
