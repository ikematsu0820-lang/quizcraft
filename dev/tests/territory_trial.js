// 確認用: 陣取りパネル（「13番、まぐろ」の形）— 作る画面のプレビューと、盤面ごとのお試し。
// http で開く（リポジトリの一番上で python3 -m http.server 8765）。node dev/tests/territory_trial.js [buzz|turn]
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const MODE = process.argv[2] || 'buzz';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript({ path: FAKEFB });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) console.log('CE', m.text().slice(0, 200)); });
  await ctx.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
  await p.goto(APP); await p.waitForTimeout(800);
  await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
  await p.evaluate(() => document.querySelector('#select-type-view .type-select-card[data-type="territory"]').click()); await p.waitForTimeout(300);
  if (MODE === 'turn') await p.evaluate(() => { const t = [...document.querySelectorAll('#ps-overlay button, #ps-overlay [data-who]')].find(x => /^順番/.test(x.textContent.trim())); t && t.click(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#ps-overlay .ps-go').click()); await p.waitForTimeout(700);
  console.log('mode', await p.evaluate(() => window.App.Data.currentConfig.mode));
  // 盤面に4マス（8・9・13・14）
  const cells = [[7, '鯨', 'くじら'], [8, '鰆', 'さわら'], [12, '鮪', 'まぐろ'], [13, '鰐', 'わに']];
  for (const [c, q, a] of cells) {
    await p.evaluate((c) => window.App.Territory.openCell(c), c); await p.waitForTimeout(300);
    await p.fill('#question-text', q);
    await p.fill('#creator-text-answer', a);
    await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.offsetParent && /追加して次へ|直して次へ/.test(x.textContent)).click()); await p.waitForTimeout(400);
  }
  await p.evaluate(() => { const i = document.querySelector('[data-tp-prompt]'); if (i) { i.value = '魚へんの漢字の読み'; i.dispatchEvent(new Event('input')); } });
  console.log('cells', await p.evaluate(() => JSON.stringify((window.App.Data.createdQuestions || []).map(q => [q.tpCell, q.q, q.correct]))));
  await p.evaluate(() => window.App.CreatorMobile.openPreview()); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/tpt-preview.png` });
  await p.click('#cm-preview-try'); await p.waitForTimeout(3000);
  const bar = () => p.evaluate(() => { const o = document.getElementById('trial-ov'); return o ? o.querySelector('.tr-hint').textContent + ' | ' + [...o.querySelectorAll('.tr-b')].map(x => x.textContent).join(' / ') : 'none'; });
  const press = (re) => p.evaluate((src) => { const r = new RegExp(src); const x = [...document.querySelectorAll('#trial-ov .tr-b')].find(b => r.test(b.textContent)); x && x.click(); return !!x; }, re.source);
  const pf = () => p.frames().find(f => /autoName/.test(f.url()));
  console.log('0', await bar());
  await press(/開始/); await p.waitForTimeout(1500);
  console.log('1', await bar());
  await p.screenshot({ path: `${OUT}/tpt-1.png` });
  for (let round = 0; round < 6; round++) {
    const bt = await bar();
    if (/お試しが終わりました/.test(bt)) break;
    if (/早押し受付中/.test(bt)) {
      await pf().evaluate(() => { const x = document.getElementById('player-buzz-btn'); if (x && !x.disabled && x.getBoundingClientRect().height > 0) x.click(); }).catch(() => {});
      await p.waitForTimeout(1500);
    }
    let b2 = await bar();
    if (/あなた/.test(b2) && /答えます|あなたの番/.test(b2)) {
      // 自分のスマホの盤面からマスを選ぶ
      await pf().evaluate(() => { const c = document.querySelector('#tp-remote .tp-cell.can'); c && c.click(); }).catch(() => {});
      await p.waitForTimeout(1200);
    } else if (/答えます/.test(b2)) {
      await p.waitForTimeout(2200); // 仮の参加者が選ぶのを待つ
    }
    b2 = await bar();
    console.log('r' + round, b2);
    await p.screenshot({ path: `${OUT}/tpt-r${round}.png` });
    if (/〇 正解/.test(b2)) { await press(round % 3 === 2 ? /不正解/ : /^〇/); await p.waitForTimeout(1200); console.log('  judged', await bar()); }
    const b3 = await bar();
    if (/次へ/.test(b3)) { await press(/^次へ$/); await p.waitForTimeout(1500); }
    else if (/結果発表へ/.test(b3) && !/早押し受付中|答えます/.test(b3)) { await press(/結果発表へ/); await p.waitForTimeout(1500); }
    else if (!/〇 正解|早押し受付中|答えます/.test(b3)) await p.waitForTimeout(2500);
  }
  console.log('end', await bar());
  console.log('scores', await p.evaluate(() => { const r = Object.values(window.__trialStore.root.rooms || {})[0] || {}; return JSON.stringify(Object.values(r.players || {}).map(x => x.name + ':' + (x.periodScore || 0))); }));
  await p.screenshot({ path: `${OUT}/tpt-end.png` });
  await b.close();
})();
