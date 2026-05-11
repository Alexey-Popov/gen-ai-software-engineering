# Screenshots — AI workflow evidence

These four captures document the two-agent loop described in the main [`README.md`](../../README.md) §5: **Claude Code (Opus) authors → Cursor (Sonnet) reviews → I analyze → Claude applies the agreed changes.**

---

## Included screenshots

### `screenshot1.png` — Initial planning prompt to Claude Code

The starting moment. I asked Claude Code to read both `homework-3/TASKS.md` and the course-wide `README.md`, then produce a general overview of what the assignment requires and a concrete action plan.

Visible in the capture:
- The Ukrainian prompt at the top of the Claude pane.
- Claude's response laying out the deliverables (`specification.md`, `agents.md`, AI rules, README) and the grading-criteria-driven action plan (Етап 1 — вибір домену, Етап 2 — розробка спеки, тощо).
- The file tree on the left showing `homework-3/` as the active directory.

This is the entry point — establishes what the model knew when it started.

---

### `screenshot2.png` — Claude executes the plan and drafts the specification

After several rounds of outline iteration and approval (do we keep §10? do we add a glossary? which domain?), Claude starts producing the actual artifacts.

Visible in the capture:
- The agreed-upon outline decisions in chat (glossary removed, inline acronym expansion, §11 → §10).
- The "Writing specification.md (~12k chars, ~2.2k tokens)" status line — Claude actively producing the file.
- The git branch already on `homework-3-submission`.
- The Crunched-for status showing the model thought through the plan before writing.

This is the **authoring** phase — Opus turning the agreed outline into the full text.

---

### `screenshot3.png` — Cursor (Sonnet 4.6) second-opinion review prompt

The review handoff. With the spec drafted, I switched to Cursor running Sonnet 4.6 and asked it to read the document independently and return a structured list of improvements.

Visible in the capture:
- Split workspace: Claude Code on the left (showing the spec it just wrote), Cursor on the right with the open chat panel.
- The Ukrainian review prompt in Cursor's chat: *"ПЕРЕВІРКА СПЕЦИФІКАЦІЇ ТА ПОКРАЩЕННЯ — перевір специфікацію та надай список покращень…"* with three explicit asks (compare to template, compare to main file requirements, return specific clear improvements).
- Model selector showing **Claude Sonnet 4.6** — proves this is the second-opinion model, not the same one that wrote the document.

This is the **review** phase — different model, independent read, structured output.

---

### `screenshot4.png` — Analysis of Cursor's feedback and live application of the agreed changes

The third leg of the loop. After Cursor returned its improvement list, I analyzed each item, validated some, partially accepted others, and pushed back on a few. Claude then applied the agreed changes in place.

Visible in the capture:
- The "Проаналізувала всі 7 пропозицій" pane on the left — itemized response to Cursor's review with "Точно погоджуюсь" / "Погоджуюсь з нюансом" / pushback verdicts.
- Spec file open on the right showing the actual applied changes (§4 Non-Functional & Policy Requirements with reduced nesting, the No-fly list condensed, etc.).
- Visible follow-up: "Видалити §10 цілком?", "Mid-level objectives — прибрати зайві деталі реалізації" — exactly the items debated and resolved.

This is the **decision + application** phase — proves the improvements were filtered by human judgement, not blindly applied.

---

## How to embed in the PR body

These four screenshots, in this order, tell the workflow story end-to-end. Embed all of them (not just link) — the course README is explicit that PRs without embedded visuals are rejected.

Suggested PR-body block:

```markdown
### AI workflow — two-agent loop

**1. Initial planning prompt → Claude Code (Opus)**
![Initial planning](docs/screenshots/screenshot1.png)

**2. Claude authors the spec per the agreed plan**
![Authoring](docs/screenshots/screenshot2.png)

**3. Cursor (Sonnet 4.6) — independent second-opinion review**
![Cursor review prompt](docs/screenshots/screenshot3.png)

**4. Analysis of feedback and selective application**
![Analysis and application](docs/screenshots/screenshot4.png)
```
