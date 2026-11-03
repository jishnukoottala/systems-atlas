# Systems Atlas

Master system design from first principles to production.

Systems Atlas is a static, repository-hosted curriculum that takes senior, staff, and principal engineers from
foundational mental models to principal-level architectural judgment.

## Purpose and audience

The curriculum prepares readers to design large production systems, quantify capacity and
reliability, reason about distributed guarantees, diagnose failures, defend trade-offs, lead
architecture reviews, and handle principal-level design interviews. It teaches mechanisms,
operations, and judgment rather than definitions.

## Current status

Generation is incremental. `generation-state.json` and `curriculum-manifest.json` hold the exact
status, and the catalog page shows which items are written. Unwritten items appear without a link,
so the site never contains placeholder pages or broken links.

## Curriculum structure

- 326 canonical topics in 15 domains: 111 original topics (`O001` to `O111`) and 215 additional
  topics (`A001` to `A215`). `traceability.html` maps each one to its page.
- 32 system dissections (`S01` to `S32`), plus a cross-cutting patterns page.

Each topic has 17 content sections plus progress controls: orientation, production scenario, mental
model, foundations, mechanism, architecture, trade-offs, capacity planning, failure modes, security,
observability, implementation, terminal lab, challenges, standards and trends, interview preparation,
and review.

## Repository structure

```text
index.html                 Catalog with search, filters, and progress
traceability.html          Coverage of every required item
curriculum-manifest.json   Source of truth for topics and systems
generation-state.json      Resumable generation state
assets/                    CSS, vanilla JavaScript, and the pinned Mermaid build
topics/<slug>/
  content.md               Authored source of the lesson
  index.html, README.md    Generated from content.md
  diagrams/*.mmd           Generated Mermaid sources
  exercises/*.md           Generated challenges and solutions
  examples/<language>/     Hand-written runnable examples
systems-dissect/           System dissections and patterns
scripts/                   Build, validation, and scaffolding scripts
```

## Browse locally

You can open `index.html` directly, but `localStorage` behavior is most reliable over HTTP, so serve
the directory instead of using `file://`. Any of these work:

```bash
python -m http.server 8000
```

```bash
uv run python -m http.server 8000
```

```bash
npx serve .
```

```bash
pnpm dlx serve .
```

```bash
node scripts/serve.mjs 8000
```

## Progress tracking

Progress and the theme live under one `localStorage` key,
`principal-system-design-curriculum:v1`, and are keyed by stable manifest IDs rather than titles or
URLs. They stay in your browser. Use the catalog's export and import controls to move them between
browsers. Reading works without JavaScript, but search, progress, and rendered diagrams need it. Without
JavaScript, diagrams appear as Mermaid source with a written text alternative.

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. Under Settings, then Pages, choose "Deploy from a branch" and select the branch and root folder.

The repository includes `.nojekyll`, so GitHub Pages serves files as they are.

All links are relative, so the site works below a subpath such as
`https://example.github.io/systems-atlas/`.

## Add a topic

1. Add a line to the right domain in `scripts/lib/catalog.mjs`. Never reuse or renumber an ID.
2. Run `node scripts/init-manifest.mjs`, which preserves existing statuses.
3. Follow "Regenerate a topic" below.

## Regenerate a topic

1. Run `node scripts/scaffold-example.mjs <slug> [--express] [--fastapi]` for new example config.
2. Write `topics/<slug>/content.md` and the example sources. `scripts/lib/contract.mjs` defines the
   required sections, and `scripts/lib/markdown.mjs` defines the `:::` blocks.
3. Run `node scripts/finish-batch.mjs <ID>`. An entry becomes `complete` only if its content
   contract, sources, examples, and links all pass.

To change only the prose of a finished topic, edit `content.md` and run `node scripts/build.mjs`.

## Resume interrupted generation

Read `nextItems` in `generation-state.json`, write those topics, and run
`node scripts/finish-batch.mjs <IDs>`. Completed content is not regenerated.

## Validate

```bash
node scripts/validate-manifest.mjs
```

```bash
node scripts/validate-links.mjs
```

```bash
node scripts/validate-examples.mjs
```

Add `--final` to `validate-manifest.mjs` to fail while anything is unwritten, and `--external` to
`validate-links.mjs` to fetch external links. A link refusing automated clients (401, 403, or 429) is
listed in `claimsRequiringVerification` for a manual check rather than being treated as verified.

## Language toolchains

| Language | Toolchain |
| --- | --- |
| TypeScript | Node.js 23.6+ (runs TypeScript directly) and pnpm |
| Python | Python 3.12+ and uv |
| Go | Go 1.23+, plus `protoc` for gRPC examples |
| Rust | Rust with the 2024 edition (1.85+) and Cargo, plus `protoc` for tonic examples |

A missing toolchain makes `validate-examples.mjs` report `not-executed`, never `passed`.

## Mermaid

Diagrams use Mermaid 11.12.0, pinned at `assets/mermaid.min.js`. Mermaid is MIT licensed, and its
license is at `assets/mermaid.LICENSE.txt`. Diagrams render locally, with no CDN request.

## Educational limitations

Examples teach one idea each and leave out production concerns, and each lesson lists what they omit.
Capacity figures are worked examples built on stated assumptions, not benchmarks. Company names
describe a class of system, and nothing here claims to reproduce a private architecture. Standards
and trends can change, so check each topic's last-reviewed date.
