# austria-property

A deterministic underwriting engine for Austrian residential buy-to-let property. Every number it returns cites its legal source. AI agents use it through MCP, and apps through an HTTP API.

> **Status: M1.** Acquisition costs work and are tested against verified rules (see [docs/rules.md](docs/rules.md)). Underwriting and the MCP server come next. See [docs/plan.md](docs/plan.md) for the milestones.

## Example

```ts
import { acquisitionCosts } from "@austria-property/engine";

const result = acquisitionCosts({
  valuationDate: "2026-10-18",
  purchasePrice: 250_000,
  broker: { commissionPct: 3, sellerPaysCommission: true },
  financing: { loanAmount: 200_000 },
});

result.total;            // 28151
result.totalPctOfPrice;  // 11.26
result.lineItems[1];     // Grundbuch ownership fee: €2,720, with calculation and legal basis
```

## What it will do

- **Acquisition costs:** Grunderwerbsteuer, Grundbuch fees and broker commission, using the rules valid on a given date.
- **Underwriting:** financing, cash flow, gross and net yield, cash-on-cash return, break-even rent and DSCR.
- **Risk flags:** negative cash flow, high LTV, missing inputs, and signs that rent regulation (MRG) may apply.
- **Sources:** every statutory line item carries its legal basis and a source URL, so an agent can cite it.

## Development

Requires Node ≥ 22.12 (CI uses Node 24) and pnpm 12, installed with `npm i -g pnpm@12`.

```bash
pnpm install
pnpm check   # build + typecheck + test
```

## Disclaimer

This software produces calculations. It is not investment, tax or legal advice.

## License

[GNU AGPL-3.0-only](LICENSE). You may use, modify and host this software. If you modify it and let others use it over a network, you must publish your changes under the same licence.

For commercial licensing without AGPL obligations, contact the author.
