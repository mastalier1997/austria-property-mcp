# Austrian Property Underwriting Engine: Plan v0

## Goal

Build a deterministic engine for underwriting Austrian residential buy-to-let property. Every number it returns cites its source. AI agents reach it through an MCP server and an HTTP API.

The core is open source. A paid hosted tier may come later.

## Principles

1. **The engine is pure.** It makes no LLM calls, no network calls and no I/O. The same input and valuation date always give the same output.
2. **Statutory numbers are versioned rules.** Each rule records its value, validity dates, legal basis and source URL.
3. **Rules and assumptions are kept apart.**
   - *Rules* are set by law, for example Grunderwerbsteuer.
   - *Assumptions* are market defaults the caller can override, for example notary fees, vacancy or maintenance.
4. **Every output line explains itself.** It carries the rule id, legal basis and source URL, so an agent can cite it.
5. **The valuation date is an input.** The engine applies the rules that were valid on that date.
6. **The output is a calculation, not investment advice.** The README and the tool descriptions both say so.

## Repo layout

```
<repo>/
  packages/
    engine/            pure TS, zero runtime deps
      src/rules/       versioned rule tables, one file per rule family
      src/calc/        acquisitionCosts, financing, cashflow, yields, breakEven
      src/types.ts
      test/            golden + property-based tests
    mcp-server/        MCP wrapper (stdio first, streamable HTTP later), zod schemas
  fixtures/golden/     hand-checked cases as JSON (synthetic inputs only)
  docs/rules.md        human-readable rule catalogue with sources
  .github/workflows/ci.yml
```

**Tooling:** pnpm workspaces, TypeScript in strict mode, Vitest, fast-check and zod, on Node LTS. Add Changesets later for npm releases.

The existing SvelteKit app stays in its own private repo and imports `engine` as a package.

## Rule model

```ts
type Rule<T> = {
  id: string;           // e.g. "at.grest.rate"
  value: T;
  validFrom: string;    // ISO date
  validTo?: string;
  legalBasis: string;   // e.g. "§ 7 GrEStG 1987"
  sourceUrl: string;
  verifiedOn: string;   // date the source was last checked
};

getRule(id, valuationDate) // throws if no version covers the date
```

## Initial rules (M1)

The values come from oesterreich.gv.at. Verify each one against the statute itself before marking it verified.

| id | value | basis (verify) |
|---|---|---|
| at.grest.rate | 3.5% of purchase price | GrEStG |
| at.grundbuch.eigentum | 1.1% of purchase price | GGG TP 9 |
| at.grundbuch.pfandrecht | 1.2% of mortgage amount | GGG TP 9 |
| at.grundbuch.eingabe | €85 flat | GGG TP 9 |
| at.makler.max | 4% up to €36,336.42; flat €1,453.46 up to €48,448.51; 3% above that; plus 20% USt | Immobilienmaklerverordnung |

**Later rule families:**
- Richtwerte per Bundesland, published in the BGBl. Pull them via the RIS API in phase 2.
- Owner-occupier fee exemptions introduced in 2024. Check their scope and end date if owner-occupier mode is ever added. They make a good test of date versioning.

**Assumptions:** each one is an overridable default with a documented range. The list:
- contract drafting and Treuhand
- loan valuation fee
- vacancy rate
- maintenance
- management
- Reparaturrücklage, which the owner pays and can't pass on to the tenant

## Calculations

### M1: acquisition costs

`acquisitionCosts(input, date)` returns the line items and the total.

### M2: underwriting

- **Financing:** annuity loan (amount, rate, term). Returns the monthly payment and the year-1 split between interest and principal.
- **Cash flow:** net cold rent, minus non-recoverable costs (Rücklage, vacancy, maintenance, management), minus debt service.
- **Yields:** gross, net and cash-on-cash.
- **Break-even:** break-even rent and DSCR.
- **Flags v0:**
  - negative cash flow
  - high LTV
  - missing inputs
  - building age that suggests the MRG may apply ("check rent regulation")

### Phase 3: tax

Tax on rental income comes later: AfA, the land-share split and V&V results.

## Money handling

- Work in integer cents internally.
- Round only at the output stage.
- Document the rounding rules in docs/rules.md.

## Input and output (sketch)

```ts
type UnderwriteInput = {
  valuationDate: string;
  bundesland: Bundesland;
  postcode?: string;
  propertyType: "apartment" | "house";
  purchasePrice: number;          // EUR
  livingAreaM2: number;
  buildingYear?: number;
  broker: { pct: number } | "none";
  expectedRentNetMonthly: number; // net cold rent, EUR
  reserveFundMonthly?: number;    // Reparaturrücklage, EUR
  financing?: { loanAmount: number; ratePct: number; termYears: number };
  assumptions?: Partial<Assumptions>;
};

type UnderwriteOutput = {
  engineVersion: string;
  rulesetHash: string;
  lineItems: {
    id: string; labelDe: string; labelEn: string; amount: number;
    ruleId?: string; legalBasis?: string; sourceUrl?: string;
  }[];
  totals: { acquisitionCosts: number; totalInvestment: number };
  metrics: { grossYield: number; netYield: number; cashOnCash?: number;
             monthlyCashflow: number; breakEvenRent: number; dscr?: number };
  flags: { id: string; severity: "info" | "warn" | "high"; message: string }[];
  assumptionsUsed: Assumptions;
};
```

## MCP tools (M3)

- `estimate_acquisition_costs`
- `underwrite_property`
- `get_rules`: returns the rule catalogue for a given date, so agents can cite it

**Later:**
- `check_rent_regulation` (phase 2)
- `extract_listing`, which needs an LLM and so belongs in the paid tier

Write tool descriptions for agents. Each should say when to call the tool, the units (EUR, monthly or yearly) and what the tool does not cover.

## Testing (from M1)

**Golden cases:** 20–30 hand-calculated JSON fixtures. Cross-check the acquisition costs against a public calculator such as durchblicker. Record any discrepancy and decide it by the statute.

**Boundary cases:**
- broker tiers at €36,336.42, €36,336.43, €48,448.51 and €48,448.52
- no broker
- with and without a mortgage
- valuation date one day before and one day after a rule change

**Property tests (fast-check):**
- costs never fall when the price rises
- valid input never produces NaN or negative totals
- the yield identities hold

**Listings:** no real listing text goes in this repo. Extraction fixtures live in the private app repo.

## Milestones

| | Scope | Done when |
|---|---|---|
| M0 | Repo, pnpm workspace, TS strict, Vitest, CI, LICENSE, README stub (private repo) | CI green on an empty test |
| M1 | Rule model, initial rules, acquisition costs, golden and property tests | All golden cases pass and every rule is verified |
| M2 | Financing, cash flow, yields, break-even, flags v0 (port logic from the existing app) | Golden cases cover full underwriting |
| M3 | MCP server over stdio | Works in Claude Desktop, Claude Code and MCP Inspector |
| M4 | Go public: flip repo public, publish to npm, list in the MCP registry, hosted HTTP endpoint (EU region) with API keys and a free tier | First external user calls it |

**After M4:**
- MRG/Richtwert check
- extraction tool
- paid metered tier
- tax module
- Germany

## Open decisions

- **Name** for the repo, npm scope and MCP server.
- **Hosting** for M4.

## Status

- **M0 done** (2026-10-18): workspace, CI.
- **M1 done** (2026-10-18): rule model, 11 verified rules (14 versions), `acquisitionCosts`, 8 golden cases from an independent oracle, boundary and property tests. Still open: grow to 20–30 golden cases and cross-check against a public calculator (see docs/rules.md, "Open checks").

- **M2 done** (2026-10-18): exact annuity loan, NOI, cash flow, gross and net yield, cash-on-cash, DSCR, break-even rent, MRG check (permit dates, building size, public funds), statutory minimum repair reserve, flags v0. 9 underwriting golden cases from the oracle, MRG and reserve date boundaries, property tests. Deviation from the sketch: inputs are grouped (`property`, `rent`, `ownerCosts`) and N/A metrics are `null`.

- **M3 done** (2026-10-18): `packages/mcp-server` with `estimate_acquisition_costs`, `underwrite_property` and `get_rules` over stdio (MCP SDK 1.32). Each result is a readable summary plus the full JSON; input errors and uncovered dates come back as tool errors the agent can fix. `valuationDate` defaults to today in Vienna. Tested in-memory, over stdio against the built CLI, and with MCP Inspector 2.11. Setup is in the README; verified in Claude Code on Windows on 2026-10-18.

## Decided

- **License: AGPL-3.0-only** (October 2026). Anyone who modifies the engine and offers it to others, including as a hosted service, must publish their changes under AGPL. Commercial licences without AGPL terms stay possible while all the code has a single author. Decide on a CLA before accepting outside contributions.

## Ground rules

- Build on your own hardware and accounts, outside work hours. Nothing from client work goes in.
- No real listing text or personal data in this repo.
