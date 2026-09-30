// Checks the quiz's topics and question bank against the owner's objectives
// doc (verify/objectives-core2-2026-09-30.md, copied verbatim), then drives
// the page in Chromium:
//   - the topics are the doc's, in its order, numbered 1.1, 1.2 ... per domain
//   - every question is filed under one of them, in the right domain
//   - every topic has at least 20 questions
//   - every question is well formed: 4 choices, a correct answer, an
//     explanation, and a "why it's wrong" for each other choice; ids unique
//   - the setup screen lists every topic with its true count, and a quiz on
//     one topic draws only that topic's questions
//   - no script errors
//   node verify/objectives.mjs [file]   file defaults to index.html
//   node verify/objectives.mjs --plant  proves each check can fail
// Needs Playwright. Not needed to run the site. Exit 1 on any failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIN = 20;

// ---- the doc: domains in order, each with its topics in order ----
const DOC = [];
for (const line of fs.readFileSync(path.join(HERE, 'objectives-core2-2026-09-30.md'), 'utf8').split('\n')) {
  let m;
  if ((m = line.match(/^### \*\*(.+) \((\d+)%\)\*\*/))) DOC.push({ name: m[1], topics: [] });
  else if ((m = line.match(/^\s+- \*\*(.+?):\*\*/)) && DOC.length) DOC[DOC.length - 1].topics.push(m[1]);
}

async function run(file) {
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  const h = fs.readFileSync(file, 'utf8');
  let Q = [];
  try { Q = JSON.parse(h.match(/<script id="question-data" type="application\/json">([\s\S]*?)<\/script>/)[1]); }
  catch (e) { fails.push('question bank does not parse: ' + e.message); }

  const dir = path.dirname(path.resolve(file)), base = path.basename(file);
  const srv = http.createServer((q, r) => fs.readFile(path.join(dir, decodeURIComponent(q.url.split('?')[0])), (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': 'text/html' }); r.end(e ? '' : b); })).listen(0);
  const pw = await import(PW); const { chromium } = pw.default || pw;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${srv.address().port}/${base}`);
    await page.evaluate(() => localStorage.clear()); await page.reload();
    const { domains, subs } = await page.evaluate(() => ({ domains: DOMAINS, subs: SUB_OBJECTIVES }));
    await page.click('#fullExamTile');  // the topic list is on the Full Practice Exam setup screen

    // topics are the doc's, in order
    ok(domains.length === DOC.length, `${domains.length} domains, doc has ${DOC.length}`);
    DOC.forEach((d, i) => {
      const dn = domains[i];
      ok(dn && dn.toLowerCase() === d.name.toLowerCase(), `domain ${i + 1} is "${dn}", doc says "${d.name}"`);
      const list = (subs[dn] || []);
      ok(list.length === d.topics.length, `${d.name}: ${list.length} topics, doc has ${d.topics.length}`);
      d.topics.forEach((t, j) => {
        const s = list[j];
        ok(s && s.id === `${i + 1}.${j + 1}` && s.label === t, `${d.name} topic ${j + 1} is ${JSON.stringify(s)}, doc says ${i + 1}.${j + 1} "${t}"`);
      });
    });

    // every question filed, well formed, in the right domain; every topic >= MIN
    const where = {}; domains.forEach(dn => (subs[dn] || []).forEach(s => where[s.id] = dn));
    const ids = new Set(), count = {};
    for (const q of Q) {
      ok(!ids.has(q.id), `duplicate question id ${q.id}`); ids.add(q.id);
      ok(q.sub in where, `${q.id} is filed under "${q.sub}", which isn't a topic`);
      ok(where[q.sub] === q.domain, `${q.id} is in domain "${q.domain}" but its topic ${q.sub} is in "${where[q.sub]}"`);
      ok(Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every(c => typeof c === 'string' && c.trim()), `${q.id}: choices malformed`);
      ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4, `${q.id}: correct answer index ${q.correct}`);
      ok(typeof q.explain === 'string' && q.explain.trim(), `${q.id}: no explanation`);
      ok(Array.isArray(q.wrongExplain) && q.wrongExplain.length === 4 && q.wrongExplain.every((w, i) => i === q.correct ? w === '' : typeof w === 'string' && w.trim()), `${q.id}: a wrong choice has no "why it's wrong"`);
      count[q.sub] = (count[q.sub] || 0) + 1;
    }
    for (const id of Object.keys(where)) ok((count[id] || 0) >= MIN, `topic ${id} has ${count[id] || 0} questions, fewer than ${MIN}`);

    // the setup screen shows every topic with its true count
    const shown = await page.$$eval('.domain-item', els => els.map(e => [e.querySelector('label').textContent.replace(/\s+/g, ' ').trim(), e.querySelector('.domain-count').textContent.trim()]));
    ok(shown.length === Object.keys(where).length, `setup lists ${shown.length} topics, expected ${Object.keys(where).length}`);
    for (const [label, n] of shown) {
      const id = label.split(' ')[0];
      ok(n === `${count[id]} question${count[id] === 1 ? '' : 's'}`, `setup shows "${label}" with "${n}", bank has ${count[id]}`);
    }

    // a quiz on one topic (the one topped up in this update) draws only from it
    await page.click('#selectNoneBtn');
    await page.check('#sub_1_3');
    await page.click('#startBtn');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('core2_quiz_session_v2')));
    const drawn = await page.evaluate(ids => ids.map(id => QUESTION_BANK.find(q => q.id === id).sub), s.order.map(e => e.id));
    ok(drawn.length === count['1.3'] && drawn.every(x => x === '1.3'), `a 1.3-only quiz drew [${[...new Set(drawn)]}] x${drawn.length}`);
    const meta = await page.$eval('.qmeta span', e => e.textContent);
    ok(meta.includes('1.3 File systems'), `question header reads "${meta}"`);
  } catch (e) { fails.push('could not drive the page — ' + String(e.message).split('\n')[0]); }
  ok(!errors.length, 'script errors: ' + errors.join(' | '));
  await browser.close(); srv.close();
  return fails;
}

if (process.argv.includes('--plant')) {
  const src = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
  const bank = src.match(/<script id="question-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  const Q = JSON.parse(bank);
  const withBank = f => { const q = JSON.parse(bank); f(q); return src.replace(bank, JSON.stringify(q, null, 2)); };
  const PLANTS = {
    'topic renamed': () => src.replace('{ id: "1.2", label: "Windows tools" }', '{ id: "1.2", label: "Windows utilities" }'),
    'topic dropped': () => src.replace('    { id: "3.3", label: "Security concerns" },\n', ''),
    'topics out of order': () => src.replace('{ id: "2.1", label: "Security measures" },\n    { id: "2.2", label: "Malware prevention" },', '{ id: "2.1", label: "Malware prevention" },\n    { id: "2.2", label: "Security measures" },'),
    'question on an old label': () => withBank(q => { q[0].sub = '4.8'; }),
    'question in the wrong domain': () => withBank(q => { q.find(x => x.sub === '3.1').domain = 'Security'; }),
    'topic below 20': () => withBank(q => { const keep = q.filter(x => x.sub !== '1.3'); keep.push(...q.filter(x => x.sub === '1.3').slice(0, 19)); q.length = 0; q.push(...keep); }),
    'wrong answer left unexplained': () => withBank(q => { const x = q[q.length - 1]; x.wrongExplain[(x.correct + 1) % 4] = ''; }),
    'correct answer out of range': () => withBank(q => { q[10].correct = 4; }),
    'duplicate id': () => withBank(q => { q[q.length - 1].id = q[0].id; }),
    'setup miscounts': () => src.replace("QUESTION_BANK.forEach(q => { if(c[q.sub] !== undefined) c[q.sub]++; });", "QUESTION_BANK.forEach(q => { if(c[q.sub] !== undefined && q.id !== 620) c[q.sub]++; });"),
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obj-plant-'));
  let missed = 0;
  for (const [name, make] of Object.entries(PLANTS)) {
    const out = make();
    if (out === src) { console.log(`STALE  ${name}: the plant changed nothing`); missed++; continue; }
    fs.writeFileSync(path.join(tmp, 'index.html'), out);
    const f = await run(path.join(tmp, 'index.html'));
    console.log(`${f.length ? 'CAUGHT' : 'MISSED'} ${name.padEnd(30)} ${(f[0] || '').slice(0, 110)}`);
    if (!f.length) missed++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(missed ? `${missed} plant(s) got through` : `all ${Object.keys(PLANTS).length} plants caught`);
  process.exit(missed ? 1 : 0);
} else {
  const fails = await run(process.argv[2] || path.join(HERE, '..', 'index.html'));
  if (fails.length) { console.log('FAIL ' + fails.length); fails.slice(0, 30).forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log(`PASS — ${DOC.reduce((a, d) => a + d.topics.length, 0)} topics from the doc, every question filed and well formed, every topic at ${MIN}+, setup counts true, a one-topic quiz draws only from it, no script errors`);
}
