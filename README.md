# austria-property

A deterministic underwriting engine for Austrian residential buy-to-let property. Every number it returns cites its legal source. AI agents use it through MCP, and apps through an HTTP API.

> **Status: M2.** Acquisition costs and underwriting (loan, cash flow, yields, break-even, rent-regulation check) work and are tested against verified rules (see [docs/rules.md](docs/rules.md)). The MCP server comes next. See [docs/plan.md](docs/plan.md) for the milestones.

## Example

```ts
import { underwrite } from "@austria-property/engine";

const result = underwrite({
  valuationDate: "2026-10-18",
  purchasePrice: 269_000,
  broker: { commissionPct: 3, sellerPaysCommission: true },
  financing: { loanAmount: 174_850, ratePct: 3.9, termYears: 25 },
  property: { livingAreaM2: 54, ownership: "condominium", buildingYear: 1978 },
  rent: { netColdMonthly: 795, operatingCostsMonthly: 132 },
  ownerCosts: { reserveFundMonthly: 41 },
});

result.acquisition.total;              // 29659 (acquisition costs, each line with its legal basis)
result.financing?.monthlyPayment;      // 913.3
result.metrics.monthlyCashFlow;        // -246.16 (before tax)
result.metrics.breakEvenRentCents;     // 105142 → €1,051.42 rent needed to break even
result.rentRegulation.status;          // "partial": no statutory rent cap (estimated from the build year)
result.flags;                          // negative cash flow, assumptions used, ...
```

`acquisitionCosts()` gives just the purchase costs.

## What it does

- **Acquisition costs:** Grunderwerbsteuer, Grundbuch fees and broker commission, using the rules valid on a given date.
- **Underwriting:** loan payment, cash flow, gross and net yield, cash-on-cash return, break-even rent and DSCR.
- **Rent regulation:** whether the MRG caps the rent, from the building permit date, ownership type and building size.
- **Risk flags:** negative cash flow, high LTV, thin debt cover, missing inputs, and rent that may exceed a legal cap.
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
