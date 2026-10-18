# CLAUDE.md

Deterministic underwriting engine for Austrian residential buy-to-let property. AI agents call it through MCP; apps call it through an HTTP API. The full plan and milestones are in `docs/plan.md`.

## Commands

```bash
pnpm install
pnpm check        # build + typecheck + test (what CI runs)
pnpm test         # vitest, all packages
pnpm test:watch
```

## Layout

- `packages/engine`: pure TypeScript with zero runtime dependencies. Tests live in `packages/engine/test`.
- `packages/mcp-server`: thin MCP wrapper, added in M3.
- `fixtures/golden`: golden cases with synthetic inputs. Expected values come from `fixtures/golden/oracle.py`, an independent Python implementation. Never generate them from the engine itself.
- `docs/rules.md`: rule catalogue with sources. A test fails if a rule id or assumption is missing from it.

## Engine rules (non-negotiable)

- **Pure.** No I/O, no network, no `Date.now()`, no `Math.random()`, no `console`. The engine tsconfig loads no Node or DOM types, which enforces this. The valuation date is always an input.
- **Money in integer cents.** Round only at the output stage, and document the rounding rules.
- **Statutory numbers live in `src/rules/`.** Each is a versioned `Rule` with `validFrom`, an optional `validTo`, `legalBasis`, `sourceUrl` and `verifiedOn`. Never inline a statutory number in calculation code.
- **Assumptions are separate from rules.** Notary fees, vacancy, maintenance and the like have documented defaults and ranges, and the caller can override every one.
- **Output lines cite their source.** Each line item carries `ruleId`, `legalBasis` and `sourceUrl` where they apply.
- **Verify against the statute.** A rule counts as verified only after checking the statute text in RIS. Secondary sites like oesterreich.gv.at or durchblicker are cross-checks, not sources.
- **The output is a calculation**, not investment, tax or legal advice.

## Tests

- Every calculation gets golden cases, boundary cases (tier edges, the day before and after a rule change) and fast-check property tests.
- Never change a golden expectation to make a test pass without recording why in the fixture.

## Data hygiene

- No real listing text, agent names, phone numbers or personal data in this repo. `fixtures/private/` is gitignored.
- Nothing from the author's employer or client work.

## Prior art

The SvelteKit app at github.com/mastalier1997/property-cashflow has a mock calculation in `src/lib/underwriting.ts`. Use it as a reference for domain logic and risk flags, not as code to copy: it uses flat rates and floats and has no tests.

Known gaps to fix when porting:
- The broker fee is not checked against the statutory maximum.
- The AfA land share is a flat 80%.
- The MRG check uses Baujahr. Whether the MRG applies depends on the date of the Baubewilligung and on whether the flat is Wohnungseigentum; verify this in RIS.
