// 確認用: スマホの問題入力画面で、入力欄がひと目で分かるか（一問一答・連想・選択式）。写真は dev/tests/out/edit-*.png
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const kind of (process.env.KINDS || 'free,assoc,choice').split(',')) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript({ path: FAKEFB });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
    await p.goto(APP); await p.waitForTimeout(800);
    await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
    const ok = await p.evaluate((k) => { const c = document.querySelector(`#select-type-view .type-select-card[data-type="${k}"]`); if (c) c.click(); return !!c; }, kind);
    if (!ok) { console.log('no card', kind); await ctx.close(); continue; }
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#ps-overlay .ps-go')?.click()); await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/edit-${kind}.png` });
    if (process.env.FOCUS) {
      await p.focus(process.env.FOCUS).catch(() => {}); await p.waitForTimeout(200);
      await p.screenshot({ path: `${OUT}/edit-${kind}-focus.png` });
    }
    await ctx.close();
  }
  await b.close();
})();
