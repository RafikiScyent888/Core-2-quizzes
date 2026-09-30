// Drives the "Retake the ones I missed" option in Chromium, the way a student
// meets it, and checks:
//   - after a quiz, the retake holds exactly the questions answered wrong
//     (or not answered): no correct ones, none missing
//   - each retake round is labelled on every question and on the results
//   - rounds repeat until nothing is missed, then say "Every one right"
//     and offer no further retake
//   - a retake round survives a reload (pause and resume)
//   - the Full Practice Exam (the custom quiz) offers the retake too
//   - the new text meets WCAG AAA on painted pixels (7:1 body, 4.5:1 large)
//   - no script errors
//   node verify/retake.mjs [file]     file defaults to index.html
//   node verify/retake.mjs --plant    proves each check can fail
// Needs Playwright. Not needed to run the site. Exit 1 on any failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const KEY = 'core2_quiz_session_v2';

const lum = c => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// Measure the text inside `selector` against the pixels actually painted under it.
async function contrast(page, selector) {
  const runs = await page.evaluate(sel => {
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement, cs = getComputedStyle(el);
        let op = 1; for (let a = el; a; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) if (r.width > 2 && r.height > 2)
          out.push({ t: n.textContent.trim().slice(0, 40), c: cs.color, op, s: parseFloat(cs.fontSize), b: parseInt(cs.fontWeight) >= 700, x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height });
      }
    }
    return out;
  }, selector);
  await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}' });
  const png = (await page.screenshot({ fullPage: true })).toString('base64');
  await page.evaluate(() => [...document.querySelectorAll('style')].pop().remove());
  const grounds = await page.evaluate(async ({ png, runs }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    return runs.map(r => { const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
      const d = g.getImageData(x0, y0, Math.max(1, Math.min(Math.floor(r.w), im.width - x0)), Math.max(1, Math.min(Math.floor(r.h), im.height - y0))).data;
      const px = []; for (let i = 0; i < d.length; i += 16) px.push([d[i], d[i + 1], d[i + 2]]); return px; });
  }, { png, runs });
  const bad = [];
  runs.forEach((r, i) => {
    const m = r.c.match(/\d+(\.\d+)?/g).map(Number); const a = (m.length > 3 ? m[3] : 1) * r.op;
    const need = (r.s >= 24 || (r.b && r.s >= 18.66)) ? 4.5 : 7;
    let worst = 99; for (const bg of grounds[i]) { const fg = [0, 1, 2].map(k => m[k] * a + bg[k] * (1 - a)); worst = Math.min(worst, ratio(fg, bg)); }
    if (worst < need) bad.push(`${worst.toFixed(2)}:1 < ${need} "${r.t}"`);
  });
  return { n: runs.length, bad };
}

async function run(file) {
  const dir = path.dirname(path.resolve(file)), base = path.basename(file);
  const srv = http.createServer((q, r) => fs.readFile(path.join(dir, decodeURIComponent(q.url.split('?')[0])), (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': 'text/html' }); r.end(e ? '' : b); })).listen(0);
  const URL = `http://127.0.0.1:${srv.address().port}/${base}`;
  const pw = await import(PW); const { chromium } = pw.default || pw;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.setDefaultTimeout(5000);
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const session = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);

  // Answer every question of the current round: wrong on the ids in `wrong`.
  async function play(wrong) {
    const s0 = await session();
    for (let i = 0; i < s0.order.length; i++) {
      const s = await session(), entry = s.order[s.current];
      const correct = await page.evaluate(id => QUESTION_BANK.find(q => q.id === id).correct, entry.id);
      const correctPos = entry.displayOrder.indexOf(correct);
      const pos = wrong.has(entry.id) ? (correctPos + 1) % 4 : correctPos;
      await page.locator('#choicesWrap .choice').nth(pos).click();
      await page.click('#nextBtn');
    }
  }

  try {
    await page.goto(URL); await page.evaluate(k => localStorage.removeItem(k), KEY); await page.reload();
    await page.click('#quick10Tile');
    const first = await session();
    ok(first.order.length === 10, `quick quiz has ${first.order.length} questions`);
    const wrong1 = new Set(first.order.slice(0, 10).filter((_, i) => i % 3 === 0).map(e => e.id)); // 4 wrong
    ok(!(await page.$('.retake-banner')), 'a first attempt is labelled as a retake');
    await play(wrong1);

    // results: retake offered for exactly the 4 missed
    const btn = await page.$('#retakeBtn');
    ok(btn, 'no retake button after missing questions');
    ok(btn && (await btn.textContent()).trim() === `Retake the ${wrong1.size} I missed`, `retake button reads "${btn && (await btn.textContent()).trim()}"`);
    const rc = await contrast(page, '#retakeBtn, #newQuizBtn, .retake-note, h1');
    rc.bad.forEach(b => fails.push('contrast, results: ' + b));
    ok(rc.n >= 3, 'contrast sweep measured nothing on the results screen');
    await btn.click();

    const r2 = await session();
    ok(r2.round === 2, `retake round is ${r2.round}, expected 2`);
    const ids2 = r2.order.map(e => e.id).sort().join();
    ok(ids2 === [...wrong1].sort().join(), `round 1 retake holds [${ids2}], expected exactly the missed [${[...wrong1].sort()}]`);
    ok(r2.answers.every(a => a === null), 'retake round starts with answers filled in');
    // answer positions are reshuffled, so a student can't retake by position
    // (all four in A-B-C-D order by chance: 1 in 331,776)
    ok(r2.order.some(e => e.displayOrder.join() !== '0,1,2,3'), 'retake round keeps the answers in their original order');
    const banner = await page.$eval('.retake-banner', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    ok(banner.startsWith('Retake round 1'), `question banner reads "${banner}"`);
    const bc = await contrast(page, '.retake-banner');
    bc.bad.forEach(b => fails.push('contrast, retake banner: ' + b));
    ok(bc.n >= 1, 'contrast sweep did not see the retake banner');

    // pause and resume keeps the round
    await page.reload();
    await page.click('#resumeBtn');
    ok((await page.$eval('.retake-banner', e => e.textContent).catch(() => '')).includes('Retake round 1'), 'resuming loses the retake round');

    // round 2: miss one of them
    const oneWrong = new Set([r2.order[0].id]);
    await play(oneWrong);
    const h1 = await page.$eval('h1', e => e.textContent.replace(/\s+/g, ' ').trim());
    ok(h1 === 'Results — retake round 1', `results heading reads "${h1}"`);
    ok(!(await page.$('.retake-banner')), '"Every one right" shown while one is still missed');
    const btn2 = await page.$('#retakeBtn');
    ok(btn2 && (await btn2.textContent()).trim() === 'Retake the 1 I missed', `second retake button reads "${btn2 && (await btn2.textContent()).trim()}"`);
    await btn2.click();
    const r3 = await session();
    ok(r3.round === 3 && r3.order.length === 1 && r3.order[0].id === r2.order[0].id, `round 2 retake is ${JSON.stringify(r3.order.map(e => e.id))} in round ${r3.round}`);

    // round 3: all right, the end
    await play(new Set());
    ok(!(await page.$('#retakeBtn')), 'a retake is still offered with nothing missed');
    const done = await page.$eval('.retake-banner', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    ok(done.startsWith('Every one right.'), `finish message reads "${done}"`);
    const dc = await contrast(page, '.retake-banner');
    dc.bad.forEach(b => fails.push('contrast, finish message: ' + b));

    // a perfect first attempt offers no retake
    await page.click('#newQuizBtn');
    await page.click('#quick10Tile');
    await play(new Set());
    ok(!(await page.$('#retakeBtn')), 'a perfect quiz offers a retake');
    ok(!(await page.$('.retake-banner')), 'a perfect first quiz shows the retake finish message');

    // the Full Practice Exam (the custom quiz) offers the retake too
    await page.click('#newQuizBtn');
    await page.click('#fullExamTile');
    await page.fill('#countNum', '45'); await page.dispatchEvent('#countNum', 'change');
    await page.click('#startBtn');
    const full = await session();
    ok(full.order.length === 45, `full practice exam has ${full.order.length} questions, asked for 45`);
    const wrongFull = new Set([full.order[3].id, full.order[40].id]);
    await play(wrongFull);
    const fb = await page.$('#retakeBtn');
    ok(fb && (await fb.textContent()).trim() === 'Retake the 2 I missed', `full exam retake button reads "${fb && (await fb.textContent()).trim()}"`);
    if (fb) { await fb.click(); const fr = await session();
      ok(fr.order.map(e => e.id).sort().join() === [...wrongFull].sort().join(), 'full exam retake does not hold exactly its two misses'); }
  } catch (e) { fails.push('could not drive the page — ' + String(e.message).split('\n')[0]); }
  ok(!errors.length, 'script errors: ' + errors.join(' | '));
  await browser.close(); srv.close();
  return fails;
}

if (process.argv.includes('--plant')) {
  const src = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
  const PLANTS = {
    'retake uses the whole quiz': ["retakeBtn.addEventListener('click', () => startRetake(session, missedIds));", "retakeBtn.addEventListener('click', () => startRetake(session, session.order.map(e => e.id)));"],
    'retake drops one missed question': ["retakeBtn.addEventListener('click', () => startRetake(session, missedIds));", "retakeBtn.addEventListener('click', () => startRetake(session, missedIds.slice(1)));"],
    'round not counted': ['    round: (prev.round || 1) + 1,', '    round: 1,'],
    'no retake button': ["      ${missed.length ? `<button id=\"retakeBtn\">", "      ${false ? `<button id=\"retakeBtn\">"],
    'finish message too early': ['${round > 1 && missed.length === 0 ?', '${round > 1 ?'],
    'banner in the muted grey': ['.retake-banner{border:1px solid var(--sky-deep);background:var(--card);border-radius:10px;padding:10px 14px;margin-bottom:14px;color:var(--text);', '.retake-banner{border:1px solid var(--sky-deep);background:var(--card);border-radius:10px;padding:10px 14px;margin-bottom:14px;color:#8aa0b4;'],
    'answers not reshuffled on retake': ['const order = shuffle(ids).map(id => ({ id: id, displayOrder: shuffle([0,1,2,3]) }));', 'const order = shuffle(ids).map(id => ({ id: id, displayOrder: [0,1,2,3] }));'],
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retake-plant-'));
  let missed = 0;
  for (const [name, [a, b]] of Object.entries(PLANTS)) {
    if (!src.includes(a)) { console.log(`STALE  ${name}: its target text is no longer in index.html`); missed++; continue; }
    fs.writeFileSync(path.join(tmp, 'index.html'), src.replace(a, b));
    const f = await run(path.join(tmp, 'index.html'));
    console.log(`${f.length ? 'CAUGHT' : 'MISSED'} ${name.padEnd(34)} ${(f[0] || '').slice(0, 110)}`);
    if (!f.length) missed++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(missed ? `${missed} plant(s) got through` : `all ${Object.keys(PLANTS).length} plants caught`);
  process.exit(missed ? 1 : 0);
} else {
  const fails = await run(process.argv[2] || path.join(HERE, '..', 'index.html'));
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS — retake holds exactly the missed questions, rounds repeat and are labelled, resume keeps the round, "Every one right" at the end, AAA on the new text, no script errors');
}
