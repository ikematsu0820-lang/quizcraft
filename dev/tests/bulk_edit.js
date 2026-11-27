// 確認用: まとめて入力の「まとめて編集」（今の問題をメモの形で出し、直して置き換える）
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const kind of ['free', 'choice']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript({ path: FAKEFB });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
    await p.goto(APP); await p.waitForTimeout(800);
    const qs = kind === 'free'
      ? [{ type: 'free_oral', q: '日本一高い山は？', correct: ['富士山'], qImg: 'IMG' }, { type: 'free_oral', q: '日本の首都は？', correct: ['東京'] }, { type: 'free_oral', q: '消える問題', correct: ['x'] }]
      : [{ type: 'choice', q: '一番大きい数は？', c: ['1', '3', '9'], correct: [2], correctIndex: 2, mode: 'single' }];
    await p.evaluate((qs) => { window.App.Ui.showView(window.App.Ui.views.creator); window.App.Creator.loadSet('k1', { title: 'セット', config: { mode: 'buzz' }, questions: qs }); }, qs);
    await p.waitForTimeout(600);
    await p.evaluate(() => document.getElementById('cm-bulk-btn').click()); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('.bulk-mode-btn[data-mode="edit"]').click()); await p.waitForTimeout(300);
    console.log(kind, 'text:\n' + await p.inputValue('#creator-bulk-input'));
    await p.screenshot({ path: `${OUT}/bulk-edit-${kind}.png` });
    const next = kind === 'free' ? '日本一高い山は？\n富士山\nふじさん\n\n日本の首都はどこ？\n東京' : '一番大きい数は？\n1\n*3\n5\n\n二番目は？\n*a\nb';
    await p.fill('#creator-bulk-input', next);
    await p.evaluate(() => document.getElementById('creator-bulk-add-btn').click()); await p.waitForTimeout(500);
    await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.trim() === '消して置き換える')?.click()); await p.waitForTimeout(600);
    console.log(kind, 'after:', await p.evaluate(() => JSON.stringify(window.App.Data.createdQuestions.map(q => ({ q: q.q, c: q.c, correct: q.correct, img: q.qImg })))));
    await p.screenshot({ path: `${OUT}/bulk-edit-${kind}-after.png` });
    await ctx.close();
  }
  await b.close();
})();
