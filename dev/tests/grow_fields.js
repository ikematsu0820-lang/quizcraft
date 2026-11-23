// 確認用（docs/ARCHITECTURE.md の「確かめ方」）。node dev/tests/grow_fields.js で動かし、写真は dev/tests/out/ に出る
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript({ path: FAKEFB });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
  await p.goto(APP); await p.waitForTimeout(800);
  await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
  await p.evaluate(() => document.querySelector('#select-type-view .type-select-card[data-type="choice"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#ps-overlay .ps-go').click()); await p.waitForTimeout(600);
  await p.fill('#question-text', 'テスト問題');
  const tas = await p.$$('textarea.choice-text-input');
  await tas[0].fill('とても長い選択肢 A&B <x>'); await tas[1].fill('二');
  await p.evaluate(() => document.querySelector('.choice-correct-chk').click());
  await tas[1].press('Enter'); await p.waitForTimeout(100);
  console.log('focus after Enter:', await p.evaluate(() => document.activeElement.className), 'value2:', JSON.stringify(await tas[1].inputValue()));
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.offsetParent && /追加して次へ/.test(b.textContent)).click()); await p.waitForTimeout(500);
  console.log('saved', await p.evaluate(() => JSON.stringify((window.App.Data.createdQuestions || []).map(q => ({ q: q.q, c: q.c, correct: q.correct })))));
  await p.evaluate(() => window.App.Creator.edit(0)); await p.waitForTimeout(400);
  console.log('reload', await p.evaluate(() => [...document.querySelectorAll('textarea.choice-text-input')].map(t => t.value).join(' | ')));
  await b.close();
})();
