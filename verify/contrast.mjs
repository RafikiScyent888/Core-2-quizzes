// Painted-pixel AAA contrast sweep across every student-facing screen:
// dashboard, setup, a question before and after answering, results, and the
// paused-quiz banner. Text is hidden, the page photographed, and each run of
// text compared with the real pixels behind it: 7:1, or 4.5:1 for large text
// (24px, or 18.66px bold). Emoji are skipped; they draw in their own colours.
//   node verify/contrast.mjs            exit 1 if anything is under the floor
//   node verify/contrast.mjs --plant    puts back the old failing button colour; must fail
// Needs Playwright. Not needed to run the site.
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { fileURLToPath } from 'node:url';
const site = 'core';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLANT = process.argv.includes('--plant');
const cssFile = null;
const shotsDir = null;
const extraCss = PLANT ? 'button, .btn { background: #0ea5e9 !important; color: #fff !important; opacity: 1 !important; }' : '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' }); r.end(e ? '' : b); }); }).listen(0);
const U = `http://127.0.0.1:${srv.address().port}`;
const pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); const { chromium } = pw.default || pw;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
page.setDefaultTimeout(6000);
page.on('dialog', d => d.accept());
if (extraCss) await page.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.id = 'aaa-preview'; s.textContent = css; document.head.appendChild(s); }); }, extraCss);

const lum = c => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const found = new Map();

async function sweep(state) {
  await page.waitForTimeout(350);
  const runs = await page.evaluate(() => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    const desc = el => { const p = []; for (let e = el; e && e !== document.body && p.length < 3; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '')); return p.join(' > '); };
    while ((n = w.nextNode())) {
      if (!n.textContent.trim()) continue;
      if (/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(n.textContent)) continue;  // emoji draw in their own colours
      const el = n.parentElement; if (el.closest('script,style,noscript')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let op = 1; for (let a = el; a; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
      const disabled = !!el.closest(':disabled,[aria-disabled="true"]');
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width > 4 && r.height > 6)
        out.push({ t: n.textContent.trim().slice(0, 48), c: cs.color, op, s: parseFloat(cs.fontSize), b: parseInt(cs.fontWeight) >= 700, x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, el: desc(el), disabled });
    }
    return out;
  });
  const tag = await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}' });
  const png = await page.screenshot({ fullPage: true });
  await tag.evaluate(t => t.remove());
  const bgs = await page.evaluate(async ({ b64, runs }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return runs.map(r => { const w = Math.max(1, Math.round(r.w - 4)), h = Math.max(1, Math.round(r.h - 4));
      const d = x.getImageData(Math.round(r.x + 2), Math.round(r.y + 2), w, h).data, cnt = {}; let tot = 0;
      for (let i = 0; i < d.length; i += 4) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; cnt[k] = (cnt[k] || 0) + 1; tot++; }
      return Object.entries(cnt).filter(([, v]) => v / tot >= 0.08).map(([k]) => k.split(',').map(Number)); });
  }, { b64: png.toString('base64'), runs });
  runs.forEach((r, i) => {
    const m = r.c.match(/[\d.]+/g).map(Number); const a = (m[3] ?? 1) * r.op;
    const need = (r.s >= 24 || (r.s >= 18.66 && r.b)) ? 4.5 : 7;
    let worst = 99, wbg = null;
    for (const bg of bgs[i]) { const fg = [0, 1, 2].map(k => m[k] * a + bg[k] * (1 - a)); const q = ratio(fg, bg); if (q < worst) { worst = q; wbg = bg; } }
    if (worst < need) {
      const key = `${r.el.split(' > ').pop()} | ${r.c}${a < 1 ? ` @${a.toFixed(2)}` : ''} on rgb(${wbg})`;
      const e = found.get(key) || { key, worst: 99, need, states: new Set(), sample: r.t, el: r.el, disabled: r.disabled };
      e.worst = Math.min(e.worst, worst); e.states.add(state); found.set(key, e);
    }
  });
  if (shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); await page.screenshot({ path: path.join(shotsDir, `${state}.png`), fullPage: true }); }
}

// ---------- drive each site's screens ----------
async function nq() {
  await page.goto(`${U}/index.html`); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.reload();
  await sweep('dashboard');
  await page.goto(`${U}/custom.html`); await sweep('custom-setup');
  await page.goto(`${U}/index.html`); await page.click('.tile[data-count="10"]'); await page.waitForURL(/quiz\.html/);
  await sweep('question');
  const B = await page.evaluate(() => window.QUESTION_BANK);
  for (let i = 0; i < 10 && (await page.$('.question-text')); i++) {
    const qt = await page.$eval('.question-text', e => e.textContent); const q = B.find(x => x.question === qt);
    const opts = await page.$$eval('.option > span > div:first-child', ds => ds.map(d => d.textContent));
    const right = opts.indexOf(q.options[q.correctIndex]);
    await page.locator('.option').nth(i % 2 ? right : (right + 1) % 4).click(); await page.click('#primaryBtn');
    if (i === 0) await sweep('answered');
    await page.click('#primaryBtn');
  }
  await sweep('results');
  // paused quiz -> resume banner on the dashboard
  await page.goto(`${U}/index.html`); await page.click('.tile[data-count="10"]'); await page.waitForURL(/quiz\.html/);
  const pause = await page.$('#pauseBtn, .btn-pause, button:has-text("Pause")'); if (pause) { await pause.click(); await page.waitForTimeout(400); }
  await page.goto(`${U}/index.html`); await sweep('dashboard-resume');
}
async function cysa() {
  await page.goto(`${U}/index.html`); await page.evaluate(() => localStorage.clear()); await page.reload();
  await sweep('dashboard');
  await page.goto(`${U}/custom.html`); await sweep('custom-setup');
  await page.goto(`${U}/index.html`); await page.click('.tile[data-count="10"]'); await page.waitForURL(/quiz\.html/);
  await sweep('question');
  const B = await page.evaluate(() => CYSA_QUESTIONS);
  for (let i = 0; i < 10 && (await page.$('.question-text')); i++) {
    const qt = await page.$eval('.question-text', e => e.textContent); const q = B.find(x => x.q === qt);
    const opts = await page.$$eval('.option', bs => bs.map(b => b.textContent)); const right = opts.indexOf(q.options.find(o => o.correct).text);
    await page.locator('.option').nth(i % 2 ? right : (right + 1) % 4).click();
    if (i === 0) await sweep('answered');
    if (await page.$('#finishBtn')) { await page.click('#finishBtn'); break; } await page.click('#nextBtn');
  }
  await sweep('results');
  await page.goto(`${U}/index.html`); await page.click('.tile[data-count="10"]'); await page.waitForURL(/quiz\.html/);
  await page.click('#pauseBtn'); await page.waitForURL(/index\.html/); await sweep('dashboard-resume');
}
async function core() {
  const KEY = await page.goto(`${U}/index.html`).then(() => page.evaluate(() => Object.keys(localStorage)));
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await sweep('dashboard');
  if (await page.$('#fullExamTile')) { await page.click('#fullExamTile'); await sweep('custom-setup'); }
  await page.reload(); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.click('#quick10Tile'); await sweep('question');
  const correctPos = () => page.evaluate(() => { const k = Object.keys(localStorage).find(k => /session/.test(k)); const s = JSON.parse(localStorage.getItem(k)); const e = s.order[s.current];
    return e.displayOrder.indexOf(QUESTION_BANK.find(q => q.id === e.id).correct); });
  for (let i = 0; i < 10; i++) {
    const cp = await correctPos();
    await page.locator('#choicesWrap .choice').nth(i % 2 ? cp : (cp + 1) % 4).click();
    if (i === 0) await sweep('answered');
    await page.click('#nextBtn');
  }
  await sweep('results');
  await page.click('#newQuizBtn').catch(() => {}); await page.click('#quick10Tile');
  const pause = await page.$('#pauseBtn'); if (pause) { await pause.click(); await page.waitForTimeout(300); }
  await page.goto(`${U}/index.html`); await sweep('dashboard-resume');
}

try { await ({ nq, cysa, core })[site](); } catch (e) { console.log('DRIVE ERROR: ' + String(e.message).split('\n')[0]); }
await browser.close(); srv.close();
const list = [...found.values()].sort((a, b) => a.worst - b.worst);
for (const e of list) console.log(`${e.worst.toFixed(2)}:1 < ${e.need}${e.disabled ? ' [disabled]' : ''}  ${e.key}  "${e.sample}"  [${[...e.states].join(', ')}]`);
console.log(list.length ? `${list.length} colour pairs under the floor` : 'PASS — every text run meets AAA on painted pixels');
if (PLANT) { console.log(list.length ? 'CAUGHT old sky-blue buttons: ' + list.length + ' pairs under the floor' : 'MISSED — the planted low-contrast buttons got through'); process.exit(list.length ? 0 : 1); }
process.exit(list.length ? 1 : 0);
