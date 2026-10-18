# austria-property-mcp

An MCP server for Austrian residential property. It gives AI agents deterministic calculations in which every statutory number cites its legal source (RIS):

| Tool | What it does |
|---|---|
| `estimate_acquisition_costs` | Costs on top of the purchase price: Grunderwerbsteuer, land-register court fees, broker commission with a check against the legal maximum, contract costs |
| `underwrite_property` | Buy-to-let analysis: acquisition costs, loan payment, monthly cash flow before tax, yields, DSCR, break-even rent, whether MRG rent caps apply, risk flags |
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

## Example question

> Underwrite this listing: €269,000, 54 m² Eigentumswohnung built 1978, rent €795 plus €132 Betriebskosten, 65% loan at 3.9% over 25 years.

The agent gets a short summary (cash flow, yields, break-even rent, rent-regulation status, flags) followed by the full result as JSON, with the legal basis for each line.

## Limits

- Calculations only, not investment, tax or legal advice.
- No income tax on rental income yet; rent, costs and interest are held constant.
- The rent-regulation check uses building size, permit dates and public funding; it does not compute the Richtwert.

Rule catalogue and sources: [docs/rules.md](https://github.com/mastalier1997/austria-property-mcp/blob/main/docs/rules.md).

## License

AGPL-3.0-only. Source: [github.com/mastalier1997/austria-property-mcp](https://github.com/mastalier1997/austria-property-mcp).
