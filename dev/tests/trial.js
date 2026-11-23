// 確認用: お試し（プレビューの「お試し」— trial.js）。node dev/tests/trial.js [choice|free]
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
// iframe を同じページとして扱うため http で開く（python3 -m http.server 8765 をリポジトリの一番上で）
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const KIND = process.argv[2] || 'choice';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript({ path: FAKEFB });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 200)); });
  await ctx.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
  await p.goto(APP); await p.waitForTimeout(800);
  await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
  await p.evaluate((k) => document.querySelector(`#select-type-view .type-select-card[data-type="${k}"]`).click(), KIND); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#ps-overlay .ps-go').click()); await p.waitForTimeout(700);
  await p.fill('#question-text', KIND === 'choice' ? '2026年の干支は？' : '日本で一番高い山は？');
  if (KIND === 'choice') {
    const tas = await p.$$('textarea.choice-text-input');
    for (const [i, t] of ['子', '午', '寅', '辰'].entries()) await tas[i].fill(t);
    await p.evaluate(() => document.querySelectorAll('.choice-correct-chk')[1].click());
  } else {
    await p.fill('#creator-text-answer', '富士山');
  }
  await p.evaluate(() => window.App.CreatorMobile.openPreview()); await p.waitForTimeout(300);
  await p.click('#cm-preview-try'); await p.waitForTimeout(2500);
  const bar = () => p.evaluate(() => { const o = document.getElementById('trial-ov'); return o ? o.querySelector('.tr-hint').textContent + ' | ' + [...o.querySelectorAll('.tr-b')].map(b => b.textContent).join(' / ') : 'no overlay'; });
  const press = (i = 0) => p.evaluate((i) => document.querySelectorAll('#trial-ov .tr-b')[i]?.click(), i);
  const plFrame = () => p.frames().find(f => /autoName/.test(f.url()));
  console.log('1', await bar());
  await p.screenshot({ path: `${OUT}/trial-${KIND}-1.png` });
  for (let step = 2; step <= 9; step++) {
    const bt = await bar();
    await press(0);
    await p.waitForTimeout(KIND === 'choice' ? 1500 : 600);
    // 自分も答える／押す
    const pf = plFrame();
    if (pf) {
      if (KIND === 'choice') await pf.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && /午/.test(x.textContent)); b && b.click(); }).catch(() => {});
      else await pf.evaluate(() => { const b = document.getElementById('player-buzz-btn'); if (b && !b.disabled && b.offsetParent) { b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); } }).catch(() => {});
    }
    await p.waitForTimeout(1800);
    console.log(step, await bar(), await p.evaluate(() => JSON.stringify(Object.values((window.__trialStore && window.__trialStore.root.rooms && Object.values(window.__trialStore.root.rooms)[0] || {}).players || {}).map(x => x.name + ':' + (x.periodScore || 0) + ':' + (x.lastResult || '')))));
    await p.screenshot({ path: `${OUT}/trial-${KIND}-${step}.png` });
  }
  await p.click('#trial-ov .tr-close'); await p.waitForTimeout(300);
  console.log('closed', await p.evaluate(() => !document.getElementById('trial-ov') && !window.__trialStore));
  await b.close();
})();
