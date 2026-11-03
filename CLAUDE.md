# Systems Atlas

Static GitHub Pages site teaching system design to senior, staff, and principal engineers: 326 topics,
32 system dissections, and one patterns page. Live at https://jishnukoottala.github.io/systems-atlas/

`SPEC.md` is the full brief. Read it before starting a new phase, and always before the first system
dissection. `README.md` covers the repository layout and the commands.

## Where the work stands

Never trust a count written in a document. Read the state instead:

```bash
node -e "const s=require('./generation-state.json');console.log(s.phase,s.nextItems,Object.keys(s.items).length,s.notes)"
```

- `generation-state.json`: `nextItems`, per-item status and example results, `claimsRequiringVerification`, `notes`.
- `curriculum-manifest.json`: every topic and system with its status. Both files are updated by scripts; do not hand-edit statuses.
- "Continue" or "next batch" means: write the items in `nextItems`, verify them, and report.
- Phases: 2 topics, 3 system dissections, 4 validation, 5 final report. The spec lists what the final report must contain.

## Writing a batch

1. Read one finished lesson as the model, such as `topics/tail-latency/content.md`, then the entries in `scripts/lib/catalog.mjs` for level, prerequisites, and related topics.
2. `node scripts/scaffold-example.mjs <slug> [--express] [--fastapi]`, then hand-write `src/index.ts`, `src/index.test.ts`, `app/main.py`, `tests/test_main.py`, and a `README.md` for each example.
3. Run the examples first. Copy measured output into the lesson's "Expected output". Never write expected output from a guess.
4. Write `topics/<slug>/content.md`. Its first line is `lastReviewed: YYYY-MM-DD`.
5. Check every calculation by hand, and make the examples or tests confirm it.
6. Run `node scripts/finish-batch.mjs ID ID ...`. Only this script marks an item complete. List IDs literally: zsh does not split an unquoted `$IDS`.
7. Check the new pages in the browser (below), remove `node_modules` and `.venv` from the examples, then report. Commit and push only when the owner asks; the live site changes only after a push to `main`.

A failed assumption in an example is often the best lesson. Investigate it and teach it rather than adjusting the test until it passes.

## Content rules

- Required sections and minimums are in `scripts/lib/contract.mjs`: at least 3 failure modes, 12 interview questions, 3 source links, and a 5-question quiz. Diagrams `context`, `component`, `sequence`, and `failure-path`, plus a `state-*` diagram in Mechanism.
- Block syntax is in `scripts/lib/markdown.mjs`: `:::q`, `:::failure`, `:::challenge`, `:::quiz`, `:::details`, `:::note`, closed by `:::`.
- Mermaid fences take the form ```` ```mermaid name | Title | Text alternative ````, with no `|` in the title or alternative. The text right after a diagram's closing fence must start with a capital letter, not a backtick.
- Every other code fence needs a language tag; use `text` for plain output. Write × for multiplication, not `*`.
- Cross-references use the short ID, such as `[[a8]]` or `[[o13]]`.
- Prefer primary sources. Never invent benchmarks, citations, or private company details. Label anything unverified or inferred, and name a standard rather than saying "industry standard".
- A link that returns 401, 403, or 429 goes to `claimsRequiringVerification`. It does not count as verified.
- Do not rename IDs, slugs, or the storage key `principal-system-design-curriculum:v1`: saved progress depends on them.
- Unwritten items stay unlinked. Do not add placeholder pages or TODOs.

## Code rules

- TypeScript: Node 23.6+ runs it directly, with no tsx or build step. Use `process.argv[1] === fileURLToPath(import.meta.url)` rather than `import.meta.main`. Test with `node --test src/*.test.ts`.
- Python: 3.12+ with uv. Only add FastAPI when an HTTP API serves the lesson.
- Go and Rust examples are required only for the topics in `GO_TOPICS` and `RUST_TOPICS` in `scripts/lib/catalog.mjs`.
- A missing toolchain is reported as `not-executed`, never as passed, and is listed in the final report. Check `notes` in the state file, then re-check with `which go cargo protoc docker kubectl`.

## Verifying

```bash
node scripts/validate-manifest.mjs
```

```bash
node scripts/validate-links.mjs --external
```

```bash
node scripts/validate-examples.mjs
```

- `validate-manifest.mjs --final` is meant to fail until everything is written. Never report the project as complete before it passes.
- In the browser, preview the `curriculum` config in `.claude/launch.json`, or run `node scripts/serve.mjs`. On each new page, check in both light and dark themes: all diagrams rendered, no Mermaid errors, 12 or more questions, 5 quiz items, no horizontal overflow.
- Clear any test progress from the preview's `localStorage` afterward.
- Passing validators do not prove the prose or the sources are right. Say what was not checked.

## Shell

The shell is zsh and the working directory can drift, so `cd` to the project root before running scripts.
