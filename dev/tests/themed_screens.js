// 確認用（docs/ARCHITECTURE.md の「確かめ方」）。node dev/tests/themed_screens.js で動かし、写真は dev/tests/out/ に出る
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><rect width="300" height="100" rx="20" fill="#e11d48"/><text x="150" y="65" font-size="44" font-weight="bold" text-anchor="middle" fill="#fff">QUIZ!</text></svg>');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript({ path: FAKEFB });
  const m = await ctx.newPage();
  m.on('pageerror', e => { if (!/firebase/.test(e.message)) console.log('ERR', e.message); });
  await m.route(/gstatic|googleapis|jsdelivr/, r => r.abort());
  await m.goto(APP); await m.waitForTimeout(800);
  const players = { a: { name: '赤井', periodScore: 30, lastAnswer: 1, lastResult: 'win' }, b: { name: '青木', periodScore: 20, lastAnswer: 0 }, c: { name: '黄田', periodScore: 10, lastAnswer: 1, lastResult: 'win' }, d: { name: '白石', periodScore: 0, lastAnswer: 3 } };
  const themes = process.argv[2] ? process.argv[2].split(',') : ['classic', 'newspaper', 'pop'];
  const steps = [
    ['winners', { step: 'reveal_player', resultShowWinners: true, resultWinners: ['赤井', '黄田'] }],
    ['flip', { step: 'reveal_player', displayMode: 'flip' }],
    ['dist', { step: 'reveal_player', displayMode: 'distribution' }],
    ['rank', { step: 'final_ranking' }],
    ['elim', { step: 'elimination', eliminationData: { mode: 'dropout', count: 1, survivors: [{ name: '赤井', score: 30 }, { name: '青木', score: 20 }, { name: '黄田', score: 10 }], droppedOut: [{ name: '白石', score: 0 }] } }],
    ['choice', { step: 'reveal_correct', correct: '午' }],
  ];
  for (const th of themes) {
    for (const [name, st] of steps) {
      await m.evaluate(([th, st, players, LOGO]) => {
        const d = {}; window.App.Themes.apply(d, th); d.logoImage = LOGO; d.logoPos = 'tr'; d.logoSize = 's'; d.cornerText = '第3回 社内クイズ大会'; d.cornerPos = 'tl';
        const V = window.App.Viewer; window.App.Ui.showView(window.App.Ui.views.viewerMain);
        V.roomId = 'R'; V.config = { mode: 'normal' }; V._players = players;
        window.__fakeDb.ref('rooms/R/players').set(players);
        V.questions = [{ type: 'choice', q: '2026年の干支は？', c: ['子', '午', '寅', '辰'], correct: [1], design: d }];
        V.render(Object.assign({ qIndex: 0 }, st));
      }, [th, st, players, LOGO]);
      await m.waitForTimeout(name === 'flip' ? 2200 : 1300);
      await m.screenshot({ path: `${OUT}/th-${th}-${name}.png` });
    }
  }
  // この問題だけのテーマ
  await m.evaluate(() => { const d = {}; window.App.Themes.apply(d, 'classic'); const V = window.App.Viewer; V.questions = [{ type: 'free_oral', q: '決勝問題', correct: 'X', design: d }].map(q => window.App.Themes.forQuestion(Object.assign(q, { themeId: 'golden' }))); V.render({ qIndex: 0, step: 'answering' }); });
  await m.waitForTimeout(500); await m.screenshot({ path: `${OUT}/th-perq.png` });
  console.log('perq accent', await m.evaluate(() => window.App.Viewer.questions[0].design.accentColor));
  await b.close();
})();
