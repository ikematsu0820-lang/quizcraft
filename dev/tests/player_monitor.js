// 確認用: 解答者のスマホの上にモニター（status.playerMonitor）。お試しの中で、選択式（一斉）と一問一答（早押し）を撮る。
// http で開く（リポジトリの一番上で python3 -m http.server 8765）
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const FAKEFB = path.resolve(__dirname, '../fakefb.js');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const kind of ['choice', 'free']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript({ path: FAKEFB });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('ERR', e.message));
    await ctx.route(/gstatic|googleapis\.com\/(?!css)|jsdelivr/, r => r.abort());
    await p.goto(APP); await p.waitForTimeout(800);
    await p.evaluate(() => window.App.Ui.showView(window.App.Ui.views.selectType));
    await p.evaluate((k) => document.querySelector(`#select-type-view .type-select-card[data-type="${k}"]`).click(), kind); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#ps-overlay .ps-go').click()); await p.waitForTimeout(700);
    if (kind === 'choice') {
      await p.fill('#question-text', '明石家さんま「生きてるだけで丸もうけ」');
      const tas = await p.$$('textarea.choice-text-input');
      await tas[0].fill('言った'); await tas[1].fill('言ってない');
      await p.evaluate(() => { const r = document.querySelectorAll('.choice-row'); [...r].slice(2).forEach(x => x.querySelector('[class^="btn-remove"], .btn-remove-choice, .choice-del')?.click()); });
      await p.evaluate(() => document.querySelectorAll('.choice-correct-chk')[0].click());
    } else {
      await p.fill('#question-text', '日本で一番高い山は何でしょう？');
      await p.fill('#creator-text-answer', '富士山');
    }
    await p.evaluate(() => window.App.Trial.open()); await p.waitForTimeout(3000);
    await p.evaluate(() => { const st = window.__trialStore; const id = Object.keys(st.root.rooms)[0]; window.LocalDb.client(st).ref(`rooms/${id}/status`).update({ playerMonitor: true }); });
    const press = () => p.evaluate(() => document.querySelector('#trial-ov .tr-b')?.click());
    await press(); await p.waitForTimeout(1500); await press(); await p.waitForTimeout(2500);
    await p.screenshot({ path: `${OUT}/pmon-${kind}.png` });
    const pf = p.frames().find(f => /autoName/.test(f.url()));
    await pf.setViewportSize ? null : null;
    console.log(kind, await pf.evaluate(() => { const m = document.getElementById('player-monitor'); const r = m && m.getBoundingClientRect(); return JSON.stringify({ on: document.body.classList.contains('pl-mon'), mon: r ? [Math.round(r.y), Math.round(r.height)] : null, frames: document.querySelectorAll('#player-monitor iframe').length }); }));
    // 自分の端末の画面（お試しの解答者の枠）だけを撮る
    const el = await p.$('#trial-ov .tr-f-pl');
    await el.screenshot({ path: `${OUT}/pmon-${kind}-player.png` });
    await ctx.close();
  }
  await b.close();
})();
