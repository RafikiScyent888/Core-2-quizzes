# CompTIA A+ Core 2 Practice Exam

A self-contained, single-file practice exam for CompTIA A+ Core 2
(220-1202, V15). Part of the Cyber Warrior Program.

**Live:** https://rafikiscyent888.github.io/Core-2-quizzes/

## Features

- **630 questions**, every one with an explanation of the right answer and a
  reason why each wrong answer is wrong.
- **11 topics, at least 20 questions on every one:**
  - Operating Systems: 1.1 OS installation, 1.2 Windows tools, 1.3 File systems
  - Security: 2.1 Security measures, 2.2 Malware prevention
  - Software Troubleshooting: 3.1 OS issues, 3.2 Mobile troubleshooting,
    3.3 Security concerns
  - Operational Procedures: 4.1 Documentation, 4.2 Safety and communication,
    4.3 Backup and recovery

  The topics come from the instructor's objectives list and are numbered in
  its order; they are not CompTIA's official objective numbers.
- **Full Practice Exam:** choose topics and 45–245 questions. There are also
  Quick Quizzes of 10, 15, 20 or 25 questions.
- **Retake the ones you missed.** After any quiz, one button starts a new
  round with only the questions you got wrong or didn't answer, in a new order
  and with the answers reshuffled. Keep retaking, round after round, until
  you've got every one right.
- **Pause and resume:** progress is saved in your browser, on your own device.
- A score out of 100 with a per-topic breakdown, and a review of every missed
  question.

## Files

- `index.html` is the whole site: the app, the styles and the question bank.
  No build step.
- `verify/` holds instructor checks. The site does not need them to run; they
  need Playwright.
  - `objectives.mjs` checks the topics and question bank against the
    objectives list.
  - `retake.mjs` drives the retake option end to end.
  - Each has a `--plant` mode that proves it catches mistakes.

---

Cyber Warrior Program — built by an instructor, for students, to make
certification study more interactive. For educational purposes only. Not
affiliated with, endorsed by, or sponsored by CompTIA®. All trademarks belong
to their respective owners.
