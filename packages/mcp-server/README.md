# austria-property-mcp

An MCP server for Austrian residential property. It gives AI agents deterministic calculations in which every statutory number cites its legal source (RIS):

| Tool | What it does |
|---|---|
| `estimate_acquisition_costs` | Costs on top of the purchase price: Grunderwerbsteuer, land-register court fees, broker commission with a check against the legal maximum, contract costs |
| `underwrite_property` | Buy-to-let analysis: acquisition costs, loan payment, monthly cash flow before and after income tax, yields, DSCR, break-even rent, whether MRG rent caps apply and the Richtwert cap, depreciation (AfA) with the legal land share, a 25-year Liebhaberei check, risk flags |
| `get_rules` | The statutory values and default assumptions behind the numbers, with legal basis, source links and verification dates |

Rules are versioned by date (for example the court-fee changes of 1 August 2026), covering valuation dates from 2025-04-01 to 2027-12-31.

## Use it

**Claude Code:**

```bash
claude mcp add austria-property -- npx -y austria-property-mcp
```

On native Windows, wrap npx: `claude mcp add austria-property -- cmd /c npx -y austria-property-mcp`.

**Claude Desktop and other MCP clients** (`claude_desktop_config.json` or equivalent):

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

Requires Node.js 20 or later.

**Hosted endpoint** (no install; stateless streamable HTTP):

```bash
claude mcp add --transport http austria-property-hosted https://austria-property-mcp.jan-mastalier.workers.dev/mcp
```

## Example question

> Underwrite this listing: €269,000, 54 m² Eigentumswohnung built 1978, rent €795 plus €132 Betriebskosten, 65% loan at 3.9% over 25 years.

The agent gets a short summary followed by the result as JSON. Excerpt of the summary (rules as of 2026-10-26; no reserve fund given, so the statutory minimum is used):

```text
Purchase: €269,000.00 + acquisition costs €29,659.00 (11.03%) = €298,659.00; equity €123,809.00.
Loan: €174,850.00 at 3.9% over 25 years = €913.30 a month (LTV 65%).
Monthly: net cold rent €795.00 − vacancy and rent loss €37.08 − repair reserve contribution (statutory minimum) €60.48 − owner's maintenance €49.78 = NOI €647.66; cash flow before tax -€265.64.
Returns: gross yield 3.55%, net yield 2.6%, cash-on-cash -2.57%, DSCR 0.71.
Break-even rent: €1,071.71 (€19.85 per m²).
Rent regulation (MRG): partial. Only parts of the MRG apply, so there is no statutory rent cap (estimated from the build year; confirm the Baubewilligung date). Tenancy protection and minimum fixed terms still apply.

Income tax: flat 40% marginal rate. AfA on €177,558.60 building value (land share 40%), 4.5% in year 1, 3% in year 2, then 1.5%.
...
Liebhaberei (25 years): total surplus from year 21, cumulative €17,857.41.
```

The summary goes on with after-tax cash flow for years 1–5 and flags for every assumption used. The JSON is compact by default (key figures, flags, deduplicated citations); pass `"detail": "full"` for every line with its calculation and legal basis.

## Limits

- Calculations only, not investment, tax or legal advice.
- Income tax uses a flat marginal rate, or the exact § 33 tariff when the other taxable income is given; tax credits are ignored. Rent, costs and interest are held constant.
- The rent-regulation check uses building size, permit dates and public funding. The Richtwert cap is the base amount; surcharges and deductions (Zuschläge/Abschläge) and the angemessener Mietzins are not computed.

Rule catalogue and sources: [docs/rules.md](https://github.com/mastalier1997/austria-property-mcp/blob/main/docs/rules.md).

## License

AGPL-3.0-only. Source: [github.com/mastalier1997/austria-property-mcp](https://github.com/mastalier1997/austria-property-mcp).
