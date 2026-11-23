// 確認用（docs/ARCHITECTURE.md の「確かめ方」）。node dev/tests/words.js で動かし、写真は dev/tests/out/ に出る
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(__dirname, '../../index.html');
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const out = {};
  const add = (k, arr) => { out[k] = out[k] || []; arr.forEach(x => { if (!out[k].includes(x)) out[k].push(x); }); };
  const harvest = (sel) => (s => { const root = document.querySelector(s); if (!root) return []; const res = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const el = n.parentElement; if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') continue; const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t && /[぀-ヿ一-鿿]/.test(t)) res.push(t); } root.querySelectorAll('option').forEach(o => { const t = o.textContent.trim(); if (t) res.push('［選択肢］' + t); }); root.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(i => { if (i.offsetParent && i.placeholder) res.push('［入力例］' + i.placeholder); }); return res; })(sel);
  for (const [type, mode] of [['free', null], ['choice', null], ['sort', null], ['multi_group', null]]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript({ path: FAKEFB });
    const p = await ctx.newPage();
    await p.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
    await p.goto(APP); await p.waitForTimeout(800);
    await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
    if (type === 'free') add('形式を選ぶ画面', await p.evaluate(harvest, '#select-type-view'));
    await p.evaluate((t) => document.querySelector(`#select-type-view .type-select-card[data-type="${t}"]`).click(), type); await p.waitForTimeout(400);
    add('遊び方を選ぶ', await p.evaluate(harvest, '#ps-overlay'));
    await p.evaluate(() => document.querySelector('#ps-overlay .ps-go')?.click()); await p.waitForTimeout(700);
    add('問題を書く画面', await p.evaluate(() => { document.querySelectorAll('details.rv-qbox').forEach(d => d.open = true); }).then(() => p.evaluate(harvest, '#creator-view')));
    await p.evaluate(() => window.App.CreatorMobile.openSheet('menu')); await p.waitForTimeout(300);
    add('セットの設定（一覧）', await p.evaluate(harvest, '#cm-sheet'));
    for (const sub of ['format', 'correct', 'wrong', 'win', 'time', 'reveal']) {
      await p.evaluate((sub) => window.App.CreatorMobile.openSheet('rules', sub), sub); await p.waitForTimeout(350);
      await p.evaluate(() => document.querySelectorAll('#cm-sheet details').forEach(d => d.open = true)); await p.waitForTimeout(100);
      add('ルール › ' + sub, await p.evaluate(harvest, '#cm-sheet-body'));
    }
    for (const sub of ['look', 'fx']) {
      await p.evaluate((sub) => window.App.CreatorMobile.openSheet('design', sub), sub); await p.waitForTimeout(400);
      const tabs = await p.evaluate(() => [...document.querySelectorAll('#cm-sheet-body button')].filter(b => b.offsetParent && b.dataset.tab).map(b => b.dataset.tab).filter(Boolean));
      await p.evaluate(() => document.querySelectorAll('#cm-sheet details').forEach(d => d.open = true));
      add('見た目 › ' + sub, await p.evaluate(harvest, '#cm-sheet-body'));
      for (const t of [...new Set(tabs)]) {
        await p.evaluate((t) => document.querySelector(`#cm-sheet-body button[data-tab="${t}"]`)?.click(), t); await p.waitForTimeout(300);
        await p.evaluate(() => document.querySelectorAll('#cm-sheet details').forEach(d => d.open = true)); await p.waitForTimeout(100);
        add('見た目 › ' + sub, await p.evaluate(harvest, '#cm-sheet-body'));
      }
    }
    await ctx.close();
  }
  require('fs').writeFileSync(OUT + '/words.json', JSON.stringify(out, null, 1));
  Object.entries(out).forEach(([k, v]) => console.log(k, v.length));
  await b.close();
})();
