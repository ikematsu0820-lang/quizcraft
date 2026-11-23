// 確認用（docs/ARCHITECTURE.md の「確かめ方」）。node dev/tests/viewer_reveal.js で動かし、写真は dev/tests/out/ に出る
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#3b82f6"/><circle cx="200" cy="120" r="80" fill="#fbbf24"/><text x="200" y="135" font-size="48" text-anchor="middle" fill="#111">FUJI</text></svg>');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const m = await b.newPage({ viewport: { width: 1280, height: 720 } });
  m.on('pageerror', e => { if (!/firebase/.test(e.message)) console.log('ERR', e.message); });
  m.on('console', e => { if (e.type() === 'warning' || e.type() === 'error') console.log('CONSOLE', e.text().slice(0, 200)); });
  await m.route(/gstatic|googleapis|jsdelivr/, r => r.abort());
  await m.goto(APP); await m.waitForTimeout(800);
  const shot = async (name, conf, q, st, players, wait = 600, theme = 'default') => {
    await m.evaluate(([conf, q, st, players, theme]) => {
      const d = {}; window.App.Themes.apply(d, theme); q.design = d;
      const V = window.App.Viewer; window.App.Ui.showView(window.App.Ui.views.viewerMain);
      V.config = conf; V._players = players || {};
      V.questions = [q];
      V.render({ step: 'standby', qIndex: 0 });
      V.render(Object.assign({ qIndex: 0 }, st));
      window.App.Themes.applyToElement(document.getElementById('viewer-main-view'), d);
    }, [conf, q, st, players, theme]);
    await m.waitForTimeout(wait);
    await m.screenshot({ path: `${OUT}/v-${name}.png` });
  };
  const free = { type: 'free_oral', q: '日本で一番高い山は何でしょう？', correct: 'ふじさん', commentary: '標高3776m', publicRate: 62 };
  const pl = { a: { name: '赤井', lastResult: 'win' }, b: { name: '青木' }, c: { name: '黄田', lastResult: 'win' } };
  await shot('letters', { mode: 'buzz', revealStyle: 'letters', rvGain: 'on', rvCount: 'on' }, { ...free }, { step: 'reveal_correct', correct: 'ふじさん', revealWinners: ['赤井'], revealGains: [{ n: '赤井', g: 10 }] }, pl, 2200);
  await shot('count', { mode: 'normal' }, { type: 'free_written', q: '富士山の標高は何メートル？', correct: '3,776m', revealStyle: 'count' }, { step: 'reveal_correct', correct: '3,776m' }, pl, 2200);
  // ため: 途中と後
  await shot('tame1', { mode: 'buzz', revealPause: 'tame' }, { ...free }, { step: 'reveal_correct', correct: '富士山', revealWinners: ['赤井'] }, pl, 500, 'newspaper');
  await m.waitForTimeout(1900); await m.screenshot({ path: `${OUT}/v-tame2.png` });
  // 選択式: 選んだ人数・人数・正解率・解説
  const ch = { type: 'choice', q: '2026年の干支は？', c: ['子', '午', '寅', '辰'], correct: [1], commentary: 'うま年です', publicRate: 81 };
  const chp = { a: { name: '赤井', lastAnswer: 1 }, b: { name: '青木', lastAnswer: 0 }, c: { name: '黄田', lastAnswer: 1 }, d: { name: '白石', lastAnswer: 3 } };
  await shot('choice', { mode: 'normal', rvDist: 'on', rvCount: 'on' }, ch, { step: 'reveal_correct', correct: '午' }, chp, 900);
  // 並べ替え 1つずつ
  const so = { type: 'sort', q: '古い順に並べよ', c: ['平安', '縄文', '江戸', '鎌倉'], correct: [1, 0, 3, 2] };
  await shot('sort1', { mode: 'normal', revealSort: 'one' }, so, { step: 'reveal_correct', correct: 'BADC' }, chp, 1200);
  await m.waitForTimeout(2600); await m.screenshot({ path: `${OUT}/v-sort2.png` });
  // 画像の答え合わせ
  const im = { type: 'free_oral', q: 'これは何の写真？', correct: '富士山', image: IMG, imgReveal: 'blur' };
  await shot('img1', { mode: 'buzz' }, im, { step: 'answering' }, {}, 500);
  console.log('img asking class', await m.evaluate(() => document.querySelector('img.q-photo')?.className));
  await m.evaluate(() => window.App.Viewer.render({ qIndex: 0, step: 'reveal_correct', correct: '富士山' })); await m.waitForTimeout(1700);
  console.log('img answer class', await m.evaluate(() => document.querySelector('img.q-photo')?.className));
  await m.screenshot({ path: `${OUT}/v-img2.png` });
  const iz = { ...im, imgReveal: 'zoom', revealStyle: 'inline' };
  await shot('zoom1', { mode: 'buzz' }, iz, { step: 'answering' }, {}, 500);
  // 判定の合図
  await shot('judge', { mode: 'buzz', judgeCue: 'big_name' }, { ...free }, { step: 'answering', judgeCue: { ok: true, name: '赤井', at: Date.now() } }, pl, 350);
  await shot('judgeng', { mode: 'buzz', judgeCue: 'big' }, { ...free }, { step: 'answering', judgeCue: { ok: false, name: '青木', at: Date.now() + 1 } }, pl, 350);
  await b.close();
})();
