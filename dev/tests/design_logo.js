// 確認用（docs/ARCHITECTURE.md の「確かめ方」）。node dev/tests/design_logo.js で動かし、写真は dev/tests/out/ に出る
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
  await p.evaluate(() => document.querySelector('#select-type-view .type-select-card[data-type="free"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#ps-overlay .ps-go').click()); await p.waitForTimeout(600);
  await p.evaluate(() => window.App.CreatorMobile.openSheet('design', 'look')); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-theme-id="newspaper"]').click()); await p.waitForTimeout(300);
  await p.setInputFiles('input[data-logo-input]', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
  await p.waitForTimeout(800);
  await p.evaluate(() => { const i = document.querySelector('input[data-decor-text]'); i.value = '社内クイズ大会'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('button[data-decor="logoPos"][data-val="bl"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.ds-decor').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: OUT + '/tht-tab.png' }); await p.evaluate(() => document.getElementById('cm-sheet-stage').scrollIntoView()); await p.screenshot({ path: OUT + '/tht-stage.png', clip: { x: 0, y: 0, width: 390, height: 420 } });
  console.log('design', await p.evaluate(() => { const d = window.App.Data.currentDesign; return JSON.stringify({ theme: d.themeId, logo: (d.logoImage || '').slice(0, 22), logoPos: d.logoPos, text: d.cornerText }); }));
  await p.evaluate(() => window.App.CreatorMobile.closeSheet()); await p.waitForTimeout(300);
  // この問題だけの見た目
  await p.evaluate(() => { const s = document.querySelector('[data-rvq="themeId"]'); s.value = 'golden'; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.rv-lookbox').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: OUT + '/tht-q.png' });
  console.log('preview theme', await p.evaluate(() => window.App.CreatorMobile.previewQuestion().design.accentColor), JSON.stringify(await p.evaluate(() => window.App.Creator.qReveal)));
  await b.close();
})();
