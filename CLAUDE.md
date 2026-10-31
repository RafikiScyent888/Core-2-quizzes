# Core 2 quizzes — project context

Read with `/root/.claude/CLAUDE.md`, which sets the rules and wins over this
file: push to GitHub after each verified change, AAA contrast on painted
pixels, objectives from the owner's Google Doc, 20+ questions per topic.

## What this is

`index.html` holds the whole A+ Core 2 (220-1202) practice exam, with the
question bank as JSON in `<script id="question-data">`. Question ids are
integers. It has a dashboard with a Full Practice Exam (the custom quiz) and
Quick Quizzes. GitHub Pages serves `main`.

## Topics (30 September 2026)

- **Source:** the 11 topics come from the owner's "All updated Objectives"
  doc (Core 2 V15), numbered in its order. They are not CompTIA's official
  numbers.
- **The remap:** before this, the quiz had 26 home-made labels that often
  didn't fit their questions; question 1, about choosing a Windows edition,
  was filed under "Windows Networking & Settings". So all 619 questions were
  read and filed one by one. The owner saw the full preview first and
  approved it: "Go. Do what you showed me in the preview."
- **Filing rules used:**
  - The doc has no scripting or remote-access topic. Scripting and
    remote-access tools went to 1.2 Windows tools; remote-access security (VPN,
    MFA, exposure) went to 2.1 Security measures. If the owner adds those
    topics to the doc, give them their own topics and top each up to 20.
  - Macs and Linux commands went to 1.1 OS installation ("working with
    Windows, macOS, Linux, and mobile operating systems").
  - Removing or preventing malware went to 2.2 Malware prevention; a question
    that starts from a symptom (pop-ups, redirects, a strange app) went to
    3.3 Security concerns.
- **The floor:** 20+ per topic. Only 1.3 File systems was short (14). It got
  11 new questions, `620`–`630`, reaching 20 plus the standing five extra
  scenarios.

## Score card, question map and filters (31 October 2026)

Built to the owner's decisions in the doc "Test banks: score card, question
map and filters (plan)" (https://claude.ai/artifact/6vcGwyvSsrwfHBWaKp6rq5),
the same features the owner approved on Core 1, built on this page and its
light look. The owner saw the preview (the 11 deep colours, a quiz, the
filters, Reset, results, the dashboard, the Full Practice Exam screen, Easier
reading, a phone) and approved it: "I like Core 2, push it." Live on `main`
the same day. Still open: the CertMaster Learn address students use.
- **Topic colours:** `TOPIC_COLOR`, the owner's rainbow in deep shades, because
  light colours vanish on this light page (previewed first, outside the royal
  six). White lettering on each is over 7:1. A colour always goes with the
  topic's number and name. The current question has a dark ring, not white.
- **Dashboard:** "Study these first" and "Retake all missed" (when the Missed
  list has anything on it), and Shuffle order under the tiles. The Full
  Practice Exam screen has its own Shuffle order box (the same setting) and a
  colour dot beside each topic.
- **Quiz and results screens:** the parts bar, chips (All, each topic by
  number, "New for the updated objectives" for questions 620-630, Missed),
  the "Jump to any question" map, the score card, "Study these first", "Retake
  all missed" and "Reset this quiz", as on Core 1. A square on the results map
  opens that question for review.
- **Keys:** `core2_missed_v1` (`{id: {n, at}}`; ids are numbers, stored as
  text, looked up as text), `core2_shuffle_v1`, and `cwp-easier-reading`,
  shared with the other test banks.
- **CertMaster Learn:** `CERTMASTER_URL` is CompTIA's sign-in page
  (learn.comptia.org/login) until the owner confirms the address students use.
- Reset, leaving a quiz part-way, and finishing with questions left all ask
  first. Answers can be chosen with the keyboard.

## Light or dark (31 October 2026)

The owner asked for a dark/light switch on every test bank ("we need to keep
things easy for my students to read"). Core 1 was previewed first; the owner
approved it and said of the other four: "Push it and do the rest". Decided by
the owner before building:
- **One choice for the whole program:** the key is `cwp:theme` ("light" or
  "dark"), the same key the acronym sites use, so a choice made there holds
  here. Nothing is saved until the student presses the button.
- **Until the student chooses, the page follows the device** (only Core 1
  starts dark), and keeps following if the device changes while it is open.
  Once chosen, the choice wins over the device.

How it works:
- A script in the head stamps `data-theme` on `<html>` before the page
  paints, so it never flashes.
- `#themeBtn` sits beside Easier reading and names where it goes ("Dark mode"
  on the light page), with a moon or sun; its label says both ("Switch to dark
  mode. Currently light mode."), as on the acronym sites.
- **Dark mode** is one block, `<style id="dark-theme">`, every rule under
  `:root[data-theme="dark"]`: the program's dark look, as on Core 1 (light
  lettering on deep navy, cyan buttons with dark lettering, a yellow focus
  ring, a dark banner on the dashboard).
- **Topic colours in dark mode:** `TOPIC_BRIGHT`, a bright shade of each
  topic's own hue, dark lettering over 7:1, neighbours alternating in
  lightness. `tc(id)` carries both (`--tc` deep, `--tcb` bright).
- **Light mode is unchanged**, apart from the gradient fix below.

## AAA on gradients (fixed 31 October 2026)

The contrast check only took a background colour that covered 8% of a text's
box, so on a gradient it found none and passed the text unmeasured. Fixed in
`verify/contrast.mjs`: the darkest and lightest parts of a gradient are now
measured too. It found real failures, in `<style id="aaa-gradients">` now:
- white on the bright tiles was 2.4:1 (green), 3.0:1 (orange) and 3.5:1
  (purple): the tiles are now deep purple, deep red and deep green, same
  hues, white lettering over 7:1
- the dashboard banner's subtitle was 2.8:1 where the sky deepened: the
  banner is a lighter sky with navy lettering

## Checks: `verify/` (needs Playwright; not needed to run the site)

- `node verify/objectives.mjs` checks the bank against
  `verify/objectives-core2-2026-09-30.md` (the doc, verbatim), and drives the
  Full Practice Exam setup. `--plant` runs 10 plants.
- `node verify/retake.mjs` drives the retake end to end, including a
  45-question Full Practice Exam. `--plant` runs 7 plants.
- `node verify/scorecard.mjs` drives the score card, map, chips, parts bar,
  Missed list, Reset, the prompts, Shuffle order, review, Easier reading and
  light or dark (follows a light and a dark device, live, until chosen;
  nothing saved until then; the button's words; `cwp:theme`; a choice from
  another site; the choice beats the device; the bright shades).
  `--plant` runs 32 plants.

## Contrast (fixed 30 September 2026)

Every student-facing screen meets AAA on painted pixels. The owner approved
the before/after preview: "I like all of the changes in all of the quizzes".
- The approved colours are in a block marked "AAA contrast" (`<style id="aaa-contrast">` at the end of the head in `index.html`).
- Colour changes stay in the royal palette, with no new hues.
- Disabled buttons are no longer faded out. They're solid silver with a dashed
  border and readable text.
- `node verify/contrast.mjs` drives every screen (dashboard, setup, question
  before and after answering, results, paused-quiz banner; since 31 October
  also a chip and a part chosen, the confirm dialog, Easier reading on every
  screen, and a phone) and fails on
  anything under 7:1 (4.5:1 for large text). `--plant` puts back the old
  sky-blue buttons and must fail.
- Since 31 October it drives every screen twice, dark then light, each in a
  fresh browser, fails if a sweep finds the page in the other theme, and
  measures text on gradients (above). `--theme=dark` runs one. Calibrated
  with plants: faint dark-only text, an unreadable dark chip, the dark banner
  override removed, a bright tile put back, the theme setting ignored; all
  were caught.

Run it after any colour or layout change.
