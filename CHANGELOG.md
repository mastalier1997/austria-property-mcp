# Changelog

Versions are those of the npm package `austria-property-mcp`. The same version runs on the hosted endpoint and is listed in the MCP registry.

## 0.6.0 (2026-10-18)

- `detail: "summary" | "full"` on `underwrite_property` and `estimate_acquisition_costs`, default `summary`. The compact JSON keeps key figures, flags and deduplicated citations; `underwrite_property` output is about 60% smaller.

## 0.5.0 (2026-10-18)

- Richtwert rent cap for fully regulated flats: Richtwerte per Bundesland (2023 and 2026 amounts), base = Richtwert × m², −25% for fixed-term leases. New inputs `property.state` and `rent.fixedTerm`.

## 0.4.0 (2026-10-18)

- Rental income tax: AfA (including the accelerated rates) with the GrundanteilV land share, yearly rental result, income tax by flat marginal rate or the exact § 33 tariff, after-tax cash flow for years 1–5, and a 25-year Liebhaberei check.

## 0.3.0 (2026-10-18)

- First public release: `estimate_acquisition_costs`, `underwrite_property` and `get_rules` over stdio (npm) and streamable HTTP (hosted on Cloudflare Workers).
