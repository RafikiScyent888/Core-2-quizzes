// Drives the score card, question map, filters, Shuffle order, the lasting
// Missed list ("Study these first", "Retake all missed", "Practice this
// topic"), Reset and Easier reading (31 October 2026) in Chromium, the way a
// student meets them, and checks:
//   - the topic colours: one each, all different, white lettering over 7:1 on
//     every one (deep shades for this light page), and each map square's
//     border is its question's topic colour
//   - the parts bar: one part per topic, each as wide as its share
//   - the chips: true counts (All, each topic, new questions, Missed), and each
//     shows exactly its questions on the map; pressing one again shows all
//   - the map: right and wrong told by fill, a mark and words, a wrong number
//     struck through, the current question ringed; a square jumps there
//   - the score card: the score is right of answered, never of the whole
//     quiz; each topic's "n/t right" and its bar
//   - the Missed list: a wrong answer goes on, a right answer comes off, in
//     any quiz; "Study these first" lists its topics, most missed first;
//     "Retake all missed" is exactly the list; "Practice this topic" draws
//     only from that topic and includes its missed questions
//   - Reset asks first, clears this quiz only and keeps the Missed list
//   - leaving a quiz part-way asks first; finishing with questions left asks
//     first and can take the student to the first one left
//   - Shuffle order: off gives the bank's order and the answers as written,
//     remembered across visits; switching part-way keeps every answer
//   - review from the results: a square opens that question, locked
//   - Easier reading stays on across a reload
//   - light or dark (31 October 2026): with nothing chosen the page follows the
//     device, even when its setting changes while the page is open; nothing is
//     saved until the button is pressed; the button names where it goes and
//     saves the choice under the program's key "cwp:theme", which then wins over
//     the device; a choice made on another site is honoured; in dark mode every
//     topic is its bright shade, dark lettering over 7:1
//   - answers can be chosen from the keyboard; no script errors
//   node verify/scorecard.mjs [file]    file defaults to index.html
//   node verify/scorecard.mjs --plant   proves each check can fail
// Needs Playwright. Not needed to run the site. Exit 1 on any failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const KEY = 'core2_quiz_session_v2', MISSED = 'core2_missed_v1', SHUF = 'core2_shuffle_v1', EASY = 'cwp-easier-reading';

const lum = c => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const cssRgb = s => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
const INK = [255, 255, 255];   // white lettering on the deep topic colours
const DARK_INK = [7, 16, 33], THEME = 'cwp:theme';   // dark lettering on the bright shades (dark mode)

async function run(file) {
  const dir = path.dirname(path.resolve(file)), base = path.basename(file);
  const srv = http.createServer((q, r) => fs.readFile(path.join(dir, decodeURIComponent(q.url.split('?')[0])), (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': 'text/html' }); r.end(e ? '' : b); })).listen(0);
  const URL = `http://127.0.0.1:${srv.address().port}/${base}`;
  const pw = await import(PW); const { chromium } = pw.default || pw;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(5000);
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const session = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const missed = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), MISSED);
  const text = sel => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
  const bank = id => page.evaluate(id => { const q = QUESTION_BANK.find(x => x.id === id); return { sub: q.sub, correct: q.correct, src: q.source || '' }; }, id);
  // answer the current question right or wrong
  async function answer(right) {
    const s = await session(), e = s.order[s.current], b = await bank(e.id);
    const cp = e.displayOrder.indexOf(b.correct);
    await page.locator('#choicesWrap .choice').nth(right ? cp : (cp + 1) % 4).click();
    return e.id;
  }
  const dialogOpen = () => page.evaluate(() => document.getElementById('confirmDlg').open);
  const shown = () => page.$$eval('.qtile', ts => ts.map(t => +t.dataset.pos));

  try {
    await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.reload();

    // ---- topic colours ----
    const COL = await page.evaluate(() => TOPIC_COLOR);
    const subs = await page.evaluate(() => ALL_SUB_IDS);
    ok(subs.every(id => /^#[0-9a-f]{6}$/i.test(COL[id] || '')), 'a topic has no colour');
    ok(new Set(subs.map(id => (COL[id] || '').toLowerCase())).size === subs.length, 'two topics share a colour');
    for (const id of subs) if (COL[id]) ok(ratio(hexRgb(COL[id]), INK) >= 7, `white lettering on ${id}'s colour ${COL[id]} is ${ratio(hexRgb(COL[id]), INK).toFixed(2)}:1, under 7:1`);
    ok(!(await page.$('.missed-card')), 'a fresh start shows a Missed list');
    ok(await page.isChecked('#shuffleChk'), 'Shuffle order is not on by default');
    await page.click('#fullExamTile');
    ok(await page.isChecked('#shuffleSetup'), 'the Full Practice Exam screen does not show Shuffle order on');
    const dots = await page.$$eval('.domain-item', els => els.map(e => [e.querySelector('label').textContent.split(' ')[0], getComputedStyle(e.querySelector('.dot')).backgroundColor]));
    ok(dots.length === subs.length, `setup shows ${dots.length} topic colours`);
    for (const [id, bg] of dots) ok(cssRgb(bg).join() === hexRgb(COL[id]).join(), `setup paints ${id} in ${bg}, not ${COL[id]}`);
    await page.click('#backToDash');

    // ---- "Study these first": most missed first ----
    const pick = await page.evaluate(() => ({ a: QUESTION_BANK.filter(q => q.sub === '1.1').slice(0, 1).map(q => q.id), b: QUESTION_BANK.filter(q => q.sub === '4.3').slice(0, 2).map(q => q.id) }));
    await page.evaluate(([k, ids]) => { const m = {}; ids.forEach(id => m[id] = { n: 1, at: '2026-10-31' }); localStorage.setItem(k, JSON.stringify(m)); }, [MISSED, [...pick.a, ...pick.b]]);
    await page.reload();
    const study = await page.$$eval('.st-item', els => els.map(e => e.querySelector('.st-name').textContent.split(' ')[0] + ' ' + e.querySelector('.st-n').textContent.trim()));
    ok(study.join(' | ') === '4.3 2 missed | 1.1 1 missed', `"Study these first" reads [${study.join(' | ')}], expected 4.3 (2) before 1.1 (1)`);
    ok((await text('#missedAllBtn')) === 'Retake all missed (3)', `setup's retake button reads "${await text('#missedAllBtn')}"`);
    const link = await page.$eval('.st-item a.linkish', a => [a.href, a.target]).catch(() => []);
    ok(link[0] === 'https://www.comptia.org/en-us/resources/certmaster-training/learn/' && link[1] === '_blank', `"Review in CertMaster Learn" goes to ${link[0]}`);
    const ptext = await page.$eval('.st-item [data-practise]', b => b.childNodes[0].textContent.trim()).catch(() => '');
    ok(ptext === 'Practice this topic', `the topic's link reads "${ptext}"`);
    ok(!/Practis/i.test(await page.evaluate(() => document.body.innerText)), 'no British "Practise" anywhere on the page');
    await page.evaluate(k => localStorage.removeItem(k), MISSED); await page.reload();

    // ---- a known quiz: 6 from 1.3 (one of them new), 2 from 2.1, 2 from 4.1 ----
    const ids = await page.evaluate(() => {
      const of = (s, f, n) => QUESTION_BANK.filter(q => q.sub === s && f(q)).slice(0, n).map(q => q.id);
      const nw = q => (q.source || '').startsWith('Added 30 Sept 2026');
      return [...of('1.3', q => !nw(q), 5), ...of('1.3', nw, 1), ...of('2.1', q => (q.source || '') !== '' && !nw(q), 1), ...of('2.1', q => !q.source, 1), ...of('4.1', () => true, 2)];
    });
    ok(ids.length === 10, 'could not build the known quiz');
    await page.evaluate(([k, ids]) => localStorage.setItem(k, JSON.stringify({ v: 1, kind: 'quiz', domains: ['1.3', '2.1', '4.1'], order: ids.map(id => ({ id, displayOrder: [0, 1, 2, 3] })), answers: ids.map(() => null), current: 0, finished: false, filter: 'all', startedAt: '2026-10-31T00:00:00Z' })), [KEY, ids]);
    await page.reload(); await page.click('#resumeBtn');

    ok((await text('.sc-big')) === '—', `the score before any answer reads "${await text('.sc-big')}"`);
    ok((await text('.sc-sub')) === '0 right of 0 answered · 10 left', `score line reads "${await text('.sc-sub')}"`);
    ok((await page.$$('.qtile')).length === 10, 'the map does not show the 10 questions');
    ok(await page.$eval('.qtile[data-pos="0"]', t => t.classList.contains('cur') && t.getAttribute('aria-current') === 'step').catch(() => false), 'question 1 is not ringed as the current one');
    const borders = await page.$$eval('.qtile', ts => ts.map(t => getComputedStyle(t).borderTopColor));
    for (let i = 0; i < 10; i++) { const s = (await bank(ids[i])).sub; ok(cssRgb(borders[i]).join() === hexRgb(COL[s]).join(), `square ${i + 1}'s border is ${borders[i]}, not ${s}'s colour`); }
    // parts bar
    const segs = await page.$$eval('.seg', ss => ss.map(s => [s.dataset.filter, s.getBoundingClientRect().width]));
    ok(segs.map(s => s[0]).join() === '1.3,2.1,4.1', `parts bar shows [${segs.map(s => s[0])}]`);
    const sw = segs.reduce((a, s) => a + s[1], 0), want = { '1.3': 0.6, '2.1': 0.2, '4.1': 0.2 };
    for (const [id, w] of segs) ok(Math.abs(w / sw - want[id]) < 0.02, `part ${id} is ${(w / sw * 100).toFixed(0)}% of the bar, expected ${want[id] * 100}%`);
    // chips
    const chips = await page.$$eval('.chip', cs => cs.map(c => [c.dataset.filter, c.querySelector('.chip-n').textContent, c.disabled]));
    const cmap = Object.fromEntries(chips.map(c => [c[0], c[1]]));
    ok(cmap.all === '0/10' && cmap['1.3'] === '0/6' && cmap['2.1'] === '0/2' && cmap['4.1'] === '0/2', `chip counts read ${JSON.stringify(cmap)}`);
    ok(cmap.new === '0/1', `the "New for the updated objectives" chip reads ${cmap.new}, expected 0/1`);
    ok(cmap.missed === '0' && chips.find(c => c[0] === 'missed')[2], 'the Missed chip is offered with nothing missed');

    // answers: 1 wrong, 2 right, 3 wrong (keyboard for the second)
    const q1 = await answer(false); await page.click('#nextBtn');
    await page.focus('#choicesWrap .choice');
    { const s = await session(), e = s.order[1], b = await bank(e.id), cp = e.displayOrder.indexOf(b.correct);
      await page.locator('#choicesWrap .choice').nth(cp).focus(); await page.keyboard.press('Enter'); }
    ok((await session()).answers[1] !== null, 'an answer cannot be chosen with the keyboard (Enter)');
    await page.click('#nextBtn');
    const q3 = await answer(false);
    const tile = i => page.$eval(`.qtile[data-pos="${i}"]`, t => ({ cls: t.className, txt: t.textContent, label: t.getAttribute('aria-label'), strike: getComputedStyle(t.querySelector('.qn')).textDecorationLine })).catch(() => ({}));
    const t1 = await tile(0), t2 = await tile(1);
    ok(/st-wrong/.test(t1.cls) && t1.txt.includes('✗') && /wrong$/.test(t1.label) && /line-through/.test(t1.strike), `a wrong square is not shown three ways: ${JSON.stringify(t1)}`);
    ok(/st-right/.test(t2.cls) && t2.txt.includes('✓') && /right$/.test(t2.label), `a right square is not marked: ${JSON.stringify(t2)}`);
    ok((await text('.sc-big')) === '33%', `score after 1 right of 3 reads "${await text('.sc-big')}"`);
    ok((await text('.sc-sub')) === '1 right of 3 answered · 7 left', `score line reads "${await text('.sc-sub')}"`);
    const rows = await page.$$eval('.sc-item', ls => ls.map(l => [l.querySelector('.sc-name').textContent.split(' ')[0], l.querySelector('.sc-n').textContent, l.querySelector('.sc-fill').style.width]));
    ok(JSON.stringify(rows) === JSON.stringify([['1.3', '1/6 right', '16.7%'], ['2.1', '0/2 right', '0%'], ['4.1', '0/2 right', '0%']]), `score card rows read ${JSON.stringify(rows)}`);
    const m1 = await missed();
    ok(Object.keys(m1).sort().join() === [q1, q3].map(String).sort().join(), `the Missed list holds [${Object.keys(m1)}], expected the two answered wrong [${q1}, ${q3}]`);
    ok((await text('.chip[data-filter="missed"] .chip-n')) === '2', 'the Missed chip does not count 2');
    ok((await text('.st-item .st-n')) === '2 missed', `"Study these first" reads "${await text('.st-item .st-n')}"`);

    // map jump
    await page.click('.qtile[data-pos="5"]');
    ok(((await text('.qmeta span')) || '').startsWith('Question 6 of 10'), `jumping to square 6 shows "${await text('.qmeta span')}"`);
    ok(await page.$eval('.qtile[data-pos="5"]', t => t.classList.contains('cur')), 'square 6 is not ringed after the jump');
    ok(await page.$eval('#nextBtn', b => b.disabled), 'Next works before the question is answered');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'qtext'), 'a jump does not move focus to the question');

    // filters
    await page.click('.chip[data-filter="missed"]');
    ok((await shown()).join() === '0,2', `the Missed chip shows squares [${(await shown()).map(p => p + 1)}], expected 1 and 3`);
    ok(((await text('.qmap-n')) || '').includes('showing 2 of 10'), `map count reads "${await text('.qmap-n')}"`);
    ok(((await text('.qmeta span')) || '').startsWith('Question 1 of 10'), 'the Missed chip does not move to the first missed question');
    ok((await text('#nextBtn')) === 'Next ▶', 'Next does not step through the missed questions');
    await page.click('#nextBtn');
    ok((await text('#nextBtn')) === 'Show all questions', `at the last missed question Next reads "${await text('#nextBtn')}"`);
    await page.click('.chip[data-filter="missed"]');
    ok((await shown()).length === 10, 'pressing the Missed chip again does not show all');
    await page.click('.chip[data-filter="4.1"]');
    const s41 = []; for (let i = 0; i < 10; i++) if ((await bank(ids[i])).sub === '4.1') s41.push(i);
    ok((await shown()).join() === s41.join(), `the 4.1 chip shows [${await shown()}], expected [${s41}]`);
    await page.click('.chip[data-filter="new"]');
    ok((await shown()).length === 1, `the new-questions chip shows ${(await shown()).length} squares, expected 1`);
    await page.click('.seg[data-filter="2.1"]');
    ok(await page.$eval('.seg[data-filter="2.1"]', s => s.getAttribute('aria-pressed') === 'true'), 'a part of the bar does not show as chosen');
    ok((await shown()).length === 2, 'choosing a part of the bar does not show its questions');
    await page.click('.chip[data-filter="all"]');

    // reset: asks first, keeps the Missed list
    const before = (await session()).answers.join();
    await page.click('#resetBtn');
    ok(await dialogOpen(), 'Reset does not ask first');
    if (await dialogOpen()) await page.click('#confirmNo');
    ok((await session()).answers.join() === before, '"Keep my answers" still reset the quiz');
    await page.click('#resetBtn'); if (await dialogOpen()) await page.click('#confirmYes');
    const rs = await session();
    ok(rs.answers.every(a => a === null) && rs.current === 0, 'Reset did not clear the answers');
    ok(Object.keys(await missed()).sort().join() === [q1, q3].map(String).sort().join(), 'Reset changed the Missed list');

    // shuffle part-way keeps answers
    await answer(false);
    const a0 = await session(), cid = a0.order[a0.current].id, chose = a0.order[a0.current].displayOrder[a0.answers[a0.current]];
    await page.uncheck('#shuffleQuiz');
    const off = await session(), pos = await page.evaluate(() => Object.fromEntries(QUESTION_BANK.map((q, i) => [q.id, i])));
    ok(off.order.every((e, i) => i === 0 || pos[off.order[i - 1].id] < pos[e.id]), 'Shuffle order off: the questions are not in the bank\'s order');
    ok(off.order.every(e => e.displayOrder.join() === '0,1,2,3'), 'Shuffle order off: the answers are not as written');
    ok(off.order[off.current].id === cid, 'switching Shuffle order moved to another question');
    const k2 = off.order.findIndex(e => e.id === cid);
    ok(off.answers[k2] !== null && off.order[k2].displayOrder[off.answers[k2]] === chose, 'switching Shuffle order lost the answer given');
    ok(await page.evaluate(k => localStorage.getItem(k), SHUF) === '0', 'Shuffle order off is not remembered');
    await page.check('#shuffleQuiz');

    // finishing with questions left asks first
    const last = (await session()).order.length - 1;
    await page.click(`.qtile[data-pos="${last}"]`); await answer(true); await page.click('#nextBtn');
    ok(await dialogOpen(), 'finishing with questions left does not ask first');
    if (await dialogOpen()) await page.click('#confirmNo');
    const fs1 = await session();
    ok(!fs1.finished && fs1.current === fs1.answers.indexOf(null), '"Go to the first unanswered" did not go there');
    for (let i = 0; i < 12 && !(await session()).finished; i++) {
      const s = await session(); if (s.answers[s.current] === null) await answer(true);
      await page.click('#nextBtn');
    }
    ok(await dialogOpen() === false, 'finishing with every question answered still asks');
    const fin = await session();
    ok(fin.finished, 'the quiz did not finish');

    // results: score card, review from the map
    ok(((await text('h1')) || '').startsWith('Results'), 'no results screen');
    ok((await text('.sc-sub')) === '9 right of 10 answered · 0 left', `results score line reads "${await text('.sc-sub')}"`);
    ok(!(await page.$('.qtile.cur')), 'the results map rings a current question');
    await page.click('.qtile[data-pos="0"]');
    ok(((await text('h1')) || '').includes('review'), 'a square on the results does not open the question for review');
    ok(await page.$$eval('#choicesWrap .choice', cs => cs.length === 4 && cs.every(c => c.classList.contains('locked'))), 'a reviewed question can be answered again');
    await page.click('#backBtn');
    ok(((await text('h1')) || '').startsWith('Results'), '"Back to results" does not go back');

    // retake all missed: exactly the list; right answers clear it
    const ml = Object.keys(await missed());
    ok((await text('#missedAllBtn')) === `Retake all missed (${ml.length})`, `results retake button reads "${await text('#missedAllBtn')}"`);
    await page.click('#missedAllBtn');
    const ma = await session();
    ok(ma.kind === 'missed' && ma.order.every(e => typeof e.id === 'number') && ma.order.map(e => String(e.id)).sort().join() === ml.sort().join(), `"Retake all missed" holds [${ma.order.map(e => e.id)}], expected the list [${ml}]`);
    ok(((await text('.retake-banner')) || '').startsWith('Your Missed list'), `its banner reads "${await text('.retake-banner')}"`);
    for (let i = 0; i < ma.order.length; i++) { await answer(true); await page.click('#nextBtn'); }
    ok(Object.keys(await missed()).length === 0, 'answering right did not take questions off the Missed list');
    ok(((await text('.retake-banner')) || '').startsWith('Every one right. Your Missed list is empty.'), `finish reads "${await text('.retake-banner')}"`);

    // leaving part-way asks; practice a topic
    await page.click('#newQuizBtn'); await page.click('#quick10Tile');
    const wrongId = await answer(false), wsub = (await bank(wrongId)).sub; await page.click('#nextBtn');
    const started = (await session()).startedAt;
    await page.click('#missedAllBtn');
    ok(await dialogOpen(), 'leaving a quiz part-way does not ask first');
    if (await dialogOpen()) await page.click('#confirmNo');
    ok((await session()).startedAt === started, '"Stay on this quiz" left the quiz');
    await page.click(`[data-practise="${wsub}"]`); if (await dialogOpen()) await page.click('#confirmYes');
    const tp = await session(), tsubs = await page.evaluate(ids => ids.map(id => QUESTION_BANK.find(q => q.id === id).sub), tp.order.map(e => e.id));
    const nTopic = await page.evaluate(s => QUESTION_BANK.filter(q => q.sub === s).length, wsub);
    ok(tp.kind === 'topic' && tp.topic === wsub && tsubs.every(s => s === wsub), `"Practice this topic" (${wsub}) drew [${[...new Set(tsubs)]}]`);
    ok(tp.order.length === Math.min(25, nTopic) && tp.order.some(e => e.id === wrongId), `"Practice this topic" has ${tp.order.length} questions${tp.order.some(e => e.id === wrongId) ? '' : ', without the missed one'}`);
    { const body = await page.evaluate(() => document.body.innerText); ok(/Practicing /.test(body) && !/Practis/i.test(body), 'the topic quiz says "Practicing", with no British spelling on it'); }

    // shuffle off from setup, remembered
    await page.click('#pauseBtn'); await page.click('#discardBtn');
    await page.uncheck('#shuffleChk'); await page.reload();
    ok(!(await page.isChecked('#shuffleChk')), 'Shuffle order off is forgotten on the next visit');
    await page.click('#quick10Tile');
    const so = await session();
    ok(so.order.every((e, i) => i === 0 || pos[so.order[i - 1].id] < pos[e.id]) && so.order.every(e => e.displayOrder.join() === '0,1,2,3'), 'a quiz started with Shuffle order off is shuffled');
    await page.click('#pauseBtn'); await page.click('#discardBtn'); await page.check('#shuffleChk');

    // easier reading
    await page.click('#easierBtn');
    ok((await text('#easierBtn')) === 'Easier reading: on' && await page.$eval('#easierBtn', b => b.getAttribute('aria-pressed') === 'true'), 'the Easier reading button does not say it is on');
    await page.reload();
    ok(await page.evaluate(() => document.documentElement.classList.contains('easier')), 'Easier reading is forgotten on reload');
    ok((await text('#easierBtn')) === 'Easier reading: on', 'after a reload the button says off');
    ok(await page.evaluate(() => parseFloat(getComputedStyle(document.body).letterSpacing) > 0), 'Easier reading does not widen the letter spacing');
    await page.click('#easierBtn'); await page.reload();
    ok(!(await page.evaluate(() => document.documentElement.classList.contains('easier'))), 'Easier reading cannot be turned off');

    // light or dark
    const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const saved = () => page.evaluate(k => localStorage.getItem(k), THEME);
    const btn = () => page.$eval('#themeBtn', b => [b.textContent.replace(/\s+/g, ' ').trim(), b.getAttribute('aria-label')]).catch(() => []);
    const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    await page.evaluate(k => localStorage.removeItem(k), THEME); await page.reload();
    ok((await theme()) === 'light', `on a light device with nothing chosen the page starts ${await theme()}, not light`);
    ok((await saved()) === null, `a theme (${await saved()}) is saved before the student chooses one`);
    let b1 = await btn();
    ok(b1[0] === 'Dark mode' && b1[1] === 'Switch to dark mode. Currently light mode.', `on the light page the theme button reads ${JSON.stringify(b1)}`);
    const lightBg = await bodyBg();
    await page.click('#themeBtn');
    ok((await theme()) === 'dark', 'the theme button does not switch to dark');
    ok((await saved()) === 'dark', `the dark choice is saved as ${await saved()}, not under the program's key`);
    ok((await bodyBg()) !== lightBg, 'dark mode does not repaint the page');
    b1 = await btn();
    ok(b1[0] === 'Light mode' && b1[1] === 'Switch to light mode. Currently dark mode.', `on the dark page the theme button reads ${JSON.stringify(b1)}`);
    await page.reload();
    ok((await theme()) === 'dark', 'dark mode is forgotten on reload');
    const SH = await page.evaluate(() => typeof TOPIC_BRIGHT === 'object' ? TOPIC_BRIGHT : {});
    ok(subs.every(id => /^#[0-9a-f]{6}$/i.test(SH[id] || '')), 'a topic has no bright shade for the dark page');
    ok(new Set(subs.map(id => (SH[id] || '').toLowerCase())).size === subs.length, 'two topics share a bright shade');
    for (const id of subs) if (SH[id]) ok(ratio(hexRgb(SH[id]), DARK_INK) >= 7, `dark lettering on ${id}'s bright shade ${SH[id]} is ${ratio(hexRgb(SH[id]), DARK_INK).toFixed(2)}:1, under 7:1`);
    await page.click('#fullExamTile');
    const ddots = await page.$$eval('.domain-item', els => els.map(e => [e.querySelector('label').textContent.split(' ')[0], getComputedStyle(e.querySelector('.dot')).backgroundColor]));
    ok(ddots.length === subs.length, `in dark mode the setup shows ${ddots.length} topic colours`);
    for (const [id, bg] of ddots) if (SH[id]) ok(cssRgb(bg).join() === hexRgb(SH[id]).join(), `in dark mode ${id} is painted ${bg}, not its bright shade ${SH[id]}`);
    await page.click('#backToDash');
    await page.click('#themeBtn'); await page.reload();
    ok((await theme()) === 'light' && (await saved()) === 'light', 'switching back to light is not kept');
    // the device: followed until the student chooses, live; then the choice wins
    for (const scheme of ['light', 'dark']) {
      const other = scheme === 'light' ? 'dark' : 'light';
      const ctx = await browser.newContext({ colorScheme: scheme }); const p2 = await ctx.newPage();
      const th2 = () => p2.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await p2.goto(URL); await p2.evaluate(() => localStorage.clear()); await p2.reload();
      ok((await th2()) === scheme, `on a device set to ${scheme}, with nothing chosen, the page starts ${await th2()}`);
      await p2.emulateMedia({ colorScheme: other }); await p2.waitForTimeout(100);
      ok((await th2()) === other, `with nothing chosen, the device changing to ${other} leaves the page ${await th2()}`);
      await p2.emulateMedia({ colorScheme: scheme });
      await p2.evaluate(([k, v]) => localStorage.setItem(k, v), [THEME, other]); await p2.reload();
      ok((await th2()) === other, `${other} chosen on another of the program's sites shows ${await th2()} here`);
      // flip the device and back, a beat apart: two flips in one frame report no change at all
      await p2.emulateMedia({ colorScheme: other }); await p2.waitForTimeout(150); await p2.emulateMedia({ colorScheme: scheme }); await p2.waitForTimeout(150);
      ok((await th2()) === other, `the device changing overrode the student's choice of ${other}: the page is ${await th2()}`);
      await ctx.close();
    }
  } catch (e) { fails.push('could not drive the page — ' + String(e.message).split('\n')[0]); }
  ok(!errors.length, 'script errors: ' + errors.join(' | '));
  await browser.close(); srv.close();
  return fails;
}

if (process.argv.includes('--plant')) {
  const src = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
  const PLANTS = {
    'British spelling back on the link': ['">Practice this topic<span', '">Practise this topic<span'],
    'British spelling back on the banner': ['<strong>Practicing ', '<strong>Practising '],
    'the old CertMaster address': ['const CERTMASTER_URL = "https://www.comptia.org/en-us/resources/certmaster-training/learn/";', 'const CERTMASTER_URL = "https://learn.comptia.org/login";'],
    'wrong answer not saved': ["else m[id] = { n: ((m[id] && m[id].n) || 0) + 1, at: new Date().toISOString() };", "else {}"],
    'right answer left on the list': ['if(right) delete m[id];', 'if(right) {}'],
    'wrong square has no cross': [`s === 'wrong' ? '<span class="mk" aria-hidden="true">&#10007;</span>'`, `s === 'wrong' ? ''`],
    'wrong number not struck': ['button.qtile.st-wrong .qn{text-decoration:line-through;text-decoration-thickness:2px}', 'button.qtile.st-wrong .qn{}'],
    'current square not ringed': ["class=\"qtile st-${s}${i === cur ? ' cur' : ''}\"", 'class="qtile st-${s}"'],
    'score over the whole quiz': ['Math.round(right / answered * 100)', 'Math.round(right / st.length * 100)'],
    'Missed chip takes unanswered': ["if(f === 'missed') return st[i] === 'wrong';", "if(f === 'missed') return st[i] !== 'right';"],
    'new chip counts every sourced one': ["return typeof q.source === 'string' && q.source.indexOf(NEW_SOURCE) === 0;", "return typeof q.source === 'string';"],
    'parts all one width': ['style="${tc(id)};flex-grow:${t}"', 'style="${tc(id)};flex-grow:1"'],
    'two topics share a colour': ['"4.3": "#892e75"', '"4.3": "#992645"'],
    'a colour too light for lettering': ['"4.1": "#3d4daa"', '"4.1": "#6b7cff"'],
    'ids looked up as numbers': ['  return BY_ID.get(String(id));', '  return BY_ID.get(id);'],
    'study list in topic order': ['.sort((a, b) => b.n - a.n || ALL_SUB_IDS.indexOf(a.id) - ALL_SUB_IDS.indexOf(b.id));', '.sort((a, b) => ALL_SUB_IDS.indexOf(a.id) - ALL_SUB_IDS.indexOf(b.id));'],
    'Reset empties the Missed list': ["  if(!ok) return;\n  const order = makeOrder(session.order.map(e => e.id), shuffleOn());", "  if(!ok) return;\n  saveMissed({});\n  const order = makeOrder(session.order.map(e => e.id), shuffleOn());"],
    'Reset without asking': ["const ok = await askConfirm({\n    title: 'Reset this quiz?',", "const ok = true || await askConfirm({\n    title: 'Reset this quiz?',"],
    'leaving without asking': ['  const s = quizUnderway();\n  if(s){', '  const s = null;\n  if(s){'],
    'finishing without asking': ['  if(left){\n    const ok = await askConfirm({', '  if(false){\n    const ok = await askConfirm({'],
    'Shuffle order off ignored': ['const list = mix ? shuffle(ids) :', 'const list = true ? shuffle(ids) :'],
    'shuffle part-way loses answers': ['session.answers = order.map(e => { const o = chosen.get(e.id); return o === null ? null : e.displayOrder.indexOf(o); });', 'session.answers = order.map(() => null);'],
    'retake all uses this quiz': ['  const ids = missedList();\n  if(!ids.length) return;', '  const ids = (loadSession() || { order: [] }).order.map(e => e.id);\n  if(!ids.length) return;'],
    'practice draws from every topic': ['const all = QUESTION_BANK.filter(q => q.sub === sub).map(q => q.id);', 'const all = QUESTION_BANK.map(q => q.id);'],
    'no keyboard answers': ["if(e.key === 'Enter' || e.key === ' ')", 'if(false)'],
    'easier reading forgotten': ["try{ localStorage.setItem(EASIER_KEY, on ? '1' : '0'); }catch(e){}", ''],
    'theme ignores the device': ['t = (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";', 't = "light";'],
    'theme saved before choosing': ['try{ t = localStorage.getItem("cwp:theme"); }catch(e){}', 'try{ t = localStorage.getItem("cwp:theme") || (localStorage.setItem("cwp:theme", "light"), "light"); }catch(e){}'],
    'theme choice not saved': ['try{ localStorage.setItem(THEME_KEY, next); }catch(e){}', ''],
    'theme saved on its own key': ['const THEME_KEY = "cwp:theme";', 'const THEME_KEY = "core2_theme";'],
    'button names the theme it is in': ["(next === 'light' ? 'Light mode' : 'Dark mode')", "(next === 'light' ? 'Dark mode' : 'Light mode')"],
    'device change not followed': ["if(mq){ if(mq.addEventListener) mq.addEventListener('change', follow); else if(mq.addListener) mq.addListener(follow); }", ''],
    'device change beats a choice': ['const follow = e => { if(chosen()) return;', 'const follow = e => {'],
    'a bright shade too dark for lettering': ['"4.1": "#879ffe"', '"4.1": "#4d5fc0"'],
    'dark mode keeps the deep colours': [':root[data-theme="dark"] .dot{background:var(--tcb);', ':root[data-theme="dark"] .dot{background:var(--tc);'],
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scorecard-plant-'));
  let missedN = 0;
  const only = (process.argv.find((x) => x.startsWith('--only=')) || '').slice(7);   /* --only=<name>: just that plant */
  for (const [name, [a, b]] of Object.entries(PLANTS)) {
    if (only && name !== only) continue;
    if (src.split(a).length !== 2) { console.log(`STALE  ${name}: its target text is not in index.html exactly once`); missedN++; continue; }
    fs.writeFileSync(path.join(tmp, 'index.html'), src.replace(a, () => b));
    const f = await run(path.join(tmp, 'index.html'));
    console.log(`${f.length ? 'CAUGHT' : 'MISSED'} ${name.padEnd(36)} ${(f[0] || '').slice(0, 100)}`);
    if (!f.length) missedN++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(missedN ? `${missedN} plant(s) got through` : `all ${Object.keys(PLANTS).length} plants caught`);
  process.exit(missedN ? 1 : 0);
} else {
  const fails = await run(process.argv[2] || path.join(HERE, '..', 'index.html'));
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS — topic colours, parts bar, chips, map, score card, Missed list (Study these first, Retake all missed, Practice this topic), Reset, leave and finish prompts, Shuffle order, review, Easier reading, light or dark (follows the device until chosen, the choice kept for the program), keyboard answers, no script errors');
}
