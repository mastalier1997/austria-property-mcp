# austria-property

A deterministic underwriting engine for Austrian residential buy-to-let property. Every number it returns cites its legal source. AI agents use it through MCP, and apps through an HTTP API.

> **Status: M0, scaffold only.** Nothing here is usable yet. See [docs/plan.md](docs/plan.md) for the plan and milestones.

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

To be decided before the repository goes public.
