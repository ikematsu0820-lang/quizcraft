// 確認用: 陣取りパネルの出題中のモニター（すみの小さな盤面）
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript({ path: FAKEFB });
  const m = await ctx.newPage();
  m.on('pageerror', e => console.log('ERR', e.message));
  await m.route(/gstatic|googleapis|jsdelivr/, r => r.abort());
  await m.goto(APP); await m.waitForTimeout(800);
  await m.evaluate(() => {
    const d = {}; window.App.Themes.apply(d, 'classic');
    const V = window.App.Viewer; window.App.Ui.showView(window.App.Ui.views.viewerMain);
    V.config = { mode: 'buzz', gameType: 'territory', tpRows: 4, tpCols: 4 };
    V.questions = [{ type: 'free_oral', q: '日本で一番長い川は？', correct: '信濃川', tpCell: 6, design: d }];
    window.App.Territory._remote = { tp: { rows: 4, cols: 4, cells: ['a', 'a', '', '', 'b', '', '', '', '', '', '', '', '', '', '', ''], colors: { a: 0, b: 1 } } };
    V.render({ step: 'answering', qIndex: 0 });
  });
  await m.waitForTimeout(600);
  await m.screenshot({ path: OUT + '/tp-monitor.png' });
  await b.close();
})();
