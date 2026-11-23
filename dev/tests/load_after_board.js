// 確認用: パネルクイズを開いたあとに、ふつうのセットを開いても「＋ 新しい問題」「まとめて入力」が出るか
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
  // 1) パネルクイズを開く
  await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
  await p.evaluate(() => document.querySelector('#select-type-view .type-select-card[data-type="panel_quiz"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#ps-overlay .ps-go')?.click()); await p.waitForTimeout(600);
  console.log('board flag after panel quiz:', await p.evaluate(() => window.App.PanelBoard.board));
  // 2) ふつうのセットを開く
  await p.evaluate(() => { window.App.Ui.showView(window.App.Ui.views.creator); window.App.Creator.loadSet('k1', { title: '早押しセット', config: { mode: 'buzz' }, questions: [{ type: 'free_oral', q: '次の歌、', correct: ['なんだ'] }] }); });
  await p.waitForTimeout(600);
  console.log(await p.evaluate(() => JSON.stringify({ board: window.App.PanelBoard.board, chip: document.getElementById('cm-type-chip')?.textContent, add: !document.getElementById('cm-add-btn')?.classList.contains('hidden'), bulk: !document.getElementById('cm-bulk-btn')?.classList.contains('hidden') })));
  await p.screenshot({ path: `${OUT}/load-after-board.png` });
  await b.close();
})();
