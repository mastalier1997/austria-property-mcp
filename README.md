# austria-property

A deterministic underwriting engine for Austrian residential buy-to-let property. Every number it returns cites its legal source. AI agents use it through MCP, and apps through an HTTP API.

> **Status: M4 — published.** The engine (acquisition costs, underwriting, rent-regulation check, rental income tax) is tested against verified rules (see [docs/rules.md](docs/rules.md)). The MCP server is on npm (`austria-property-mcp`) and runs as a free hosted endpoint on Cloudflare Workers. See [docs/plan.md](docs/plan.md) for the milestones and [docs/releasing.md](docs/releasing.md) for publishing.

## Use it from Claude (MCP)

The server offers three read-only tools:

| Tool | What it does |
|---|---|
| `estimate_acquisition_costs` | Purchase costs on top of the price (Grunderwerbsteuer, land-register fees, broker commission with legal-cap check, contract costs) |
| `underwrite_property` | Full buy-to-let analysis: costs, loan payment, cash flow before and after income tax, yields, break-even rent, MRG rent caps with the Richtwert, AfA, Liebhaberei check, risk flags |
| `get_rules` | The statutory values and default assumptions behind the numbers, with legal basis and source links |

Each result has a short readable summary followed by the full result as JSON.

**Claude Code** (add `--scope user` to use it in every project; on native Windows put `cmd /c` before `npx`):

```bash
claude mcp add austria-property -- npx -y austria-property-mcp
```

To run from a local checkout instead: `pnpm install && pnpm build`, then use `node <absolute path>/packages/mcp-server/dist/cli.js` as the command.

**Claude Desktop:** add this to `claude_desktop_config.json` (Windows: `%APPDATA%\Claude\`, macOS: `~/Library/Application Support/Claude/`) and restart the app:

```json
{
  "mcpServers": {
    "austria-property": {
      "command": "npx",
      "args": ["-y", "austria-property-mcp"]
    }
  }
}
```

**Hosted endpoint** (no install; stateless streamable HTTP):

```bash
claude mcp add --transport http austria-property https://austria-property-mcp.jan-mastalier.workers.dev/mcp
```

**MCP Inspector**, to try the tools by hand:

```bash
npx @modelcontextprotocol/inspector npx -y austria-property-mcp
```

Then ask, for example: *"What does a €249,000 flat in Graz cost to buy with 3% broker commission?"* or *"Underwrite this listing: €269k, 54 m² Eigentumswohnung built 1978, rent €795, 65% loan at 3.9% over 25 years."*

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
  tax: { otherTaxableIncome: 45_000, municipalityInhabitants: 2_000_000 }, // optional
});

result.acquisition.total;              // 29659 (acquisition costs, each line with its legal basis)
result.financing?.monthlyPayment;      // 913.3
result.metrics.monthlyCashFlow;        // -246.16 (before tax)
result.metrics.breakEvenRentCents;     // 105142 → €1,051.42 rent needed to break even
result.rentRegulation.status;          // "partial": no statutory rent cap (estimated from the build year)
result.tax.years[0].taxCents;          // tax saved in year 1 thanks to the accelerated AfA (negative = saving)
result.tax.liebhaberei.status;         // "totalSurplus" within 25 years, so the losses count for tax
result.flags;                          // negative cash flow, assumptions used, ...
```

`acquisitionCosts()` gives just the purchase costs.

## What it does

- **Acquisition costs:** Grunderwerbsteuer, Grundbuch fees and broker commission, using the rules valid on a given date.
- **Underwriting:** loan payment, cash flow, gross and net yield, cash-on-cash return, break-even rent and DSCR.
- **Rent regulation:** whether the MRG caps the rent, from the building permit date, ownership type and building size, and for capped flats the Richtwert base (Richtwert × m², −25% for fixed-term leases) compared with the assumed rent.
- **Income tax on rent:** AfA (including the accelerated rates) with the land share from the Grundanteilverordnung, the yearly rental result, income tax at a marginal rate or with the exact § 33 tariff, cash flow after tax, and a 25-year Liebhaberei check.
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
