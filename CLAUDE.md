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

## Checks: `verify/` (needs Playwright; not needed to run the site)

- `node verify/objectives.mjs` checks the bank against
  `verify/objectives-core2-2026-09-30.md` (the doc, verbatim), and drives the
  Full Practice Exam setup. `--plant` runs 10 plants.
- `node verify/retake.mjs` drives the retake end to end, including a
  45-question Full Practice Exam. `--plant` runs 7 plants.

## Known, not yet fixed

The grey `--muted` text (#5b7186 on the light background) measures about
4.6:1, under the 7:1 floor, and it is used widely. New text avoids it. The fix
is a colour change, so it needs a preview for the owner first.
