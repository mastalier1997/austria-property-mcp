# Rule catalogue

Every statutory number the engine uses, where it comes from, and how it was checked. The code is the source of truth (`packages/engine/src/rules/`); a test fails if a rule id is missing from this page.

**Coverage:** valuation dates from **2025-04-01** to **2027-12-31**. Earlier dates throw `RuleNotCoveredError`, because the court-fee amounts before the April 2025 valorisation have not been verified. From 2028 the statutory minimum repair reserve is re-indexed; until that amount is added, underwriting needs `ownerCosts.reserveFundMonthly` for 2028 dates.

**Last full check:** 2026-10-18, against the statute texts in RIS.

## Purchase costs

### Grunderwerbsteuer

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.grest.rate` | 3.5% of the consideration | from 2016-01-01 | [§ 7 Abs. 1 Z 3 GrEStG 1987](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004531&Paragraf=7) |

- Checked in the version in force since 2026-04-01 (BGBl. I Nr. 97/2025) and in the 2009 version. The 3.5% rate for acquisitions from third parties is the same in both.
- **Rounding:** commercial, to the cent ([§ 204 Abs. 1 BAO](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=204)).

### Grundbuch (court fees)

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.ggg.eigentum.rate` | 1.1% of the purchase price | from 2014-01-01 | TP 9 lit. b Z 1 GGG |
| `at.ggg.pfandrecht.rate` | 1.2% of the registered mortgage | from 2014-01-01 | TP 9 lit. b Z 4 GGG |
| `at.ggg.eingabe.fee` | €58 per application | 2025-04-01 – 2026-07-31 | TP 9 lit. a GGG, [BGBl. II Nr. 51/2025](https://www.ris.bka.gv.at/Dokumente/BgblAuth/BGBLA_2025_II_51/BGBLA_2025_II_51.pdf) |
| `at.ggg.eingabe.fee` | €61 per application | from 2026-08-01 | TP 9 lit. a GGG, [BGBl. II Nr. 227/2026](https://www.ris.bka.gv.at/Dokumente/BgblAuth/BGBLA_2026_II_227/BGBLA_2026_II_227.pdf) |
| `at.ggg.eingabe.paperSurcharge` | +€23 if filed on paper | 2025-04-01 – 2026-07-31 | TP 9 Anm. 1a GGG, BGBl. II Nr. 51/2025 |
| `at.ggg.eingabe.paperSurcharge` | +€24 if filed on paper | from 2026-08-01 | TP 9 Anm. 1a GGG, BGBl. II Nr. 227/2026 |
| `at.ggg.eigentum.directDebitReduction` | −€28 on the ownership fee | 2025-04-01 – 2026-07-31 | TP 9 Anm. 6 GGG, BGBl. II Nr. 51/2025 |
| `at.ggg.eigentum.directDebitReduction` | −€30 on the ownership fee | from 2026-08-01 | TP 9 Anm. 6 GGG, BGBl. II Nr. 227/2026 |

- The percentages were checked in the TP 9 versions of 2014 and 2022. The valorisation regulations of 2025 and 2026 change only fixed euro amounts.
- The fixed amounts are valorised by regulation under § 31a GGG. The 2026 regulation applies to fee claims arising after 2026-07-31.
- **Rounding:** the base and the percentage fee are both rounded **up** to the next whole euro ([§ 6 Abs. 2 GGG](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10002667)). Most online calculators skip this.
- **Direct-debit reduction:** lawyers and notaries file electronically (ERV) and pay by Abbuchung und Einziehung, which reduces the ownership fee. The engine applies the reduction when `grundbuchFiling` is `"electronic"` (the default) and never lets the fee go below zero.
- **oesterreich.gv.at quotes an €85 filing fee.** That is the paper price: €61 + €24 surcharge.

### Broker commission (Makler)

Source: [Standes- und Ausübungsregeln für Immobilienmakler](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10007765), BGBl. Nr. 297/1996; § 15 Abs. 2 rates in force since 2002-01-01 (BGBl. II Nr. 490/2001).

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.makler.lowerBracketLimit` | €36,336.42 | from 2002-01-01 | § 15 Abs. 2 Z 1 |
| `at.makler.lowerBracketRate` | 4% per party | from 2002-01-01 | § 15 Abs. 2 Z 1 |
| `at.makler.upperBracketRate` | 3% per party | from 2002-01-01 | § 15 Abs. 2 Z 2 |
| `at.makler.oneSidedIncrease` | up to +100% | from 2002-01-01 | § 12 Abs. 2 |

How the cap works:
- **Per party, excluding USt** (§ 12 Abs. 1). The base is the agreed price plus assumed liabilities (§ 16 Abs. 1); the engine uses the purchase price.
- **Floor between brackets** (§ 12 Abs. 4): above €36,336.42 the cap never falls below 4% of €36,336.42 = €1,453.46. 3% catches up at €48,448.56. oesterreich.gv.at gives €48,448.51 because it rounds the cap first; the difference is below one cent.
- **One-sided commission** (§ 12 Abs. 2): if the seller pays no commission, the buyer's may be up to double the cap. If the seller pays less than the cap, the buyer may pay the cap plus the seller's shortfall.

Flags:
- `broker.lawfulOnlyIfSellerPaysNothing` (warn): above the cap but within the doubled cap, and the input doesn't say what the seller pays.
- `broker.aboveCap` (high): above the doubled cap, or above the cap when the seller is known to pay commission.

### VAT

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.ust.standardRate` | 20% | from 2016-01-01 | [§ 10 Abs. 1 UStG 1994](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004873&Paragraf=10) |

Applied to broker commission and contract fees. Checked in the version in force since 2026-07-01.

## Underwriting

### Repair reserve (WEG)

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.weg.minReservePerM2` | €0.90 per m² per month | 2022-07-01 – 2023-12-31 | [§ 31 Abs. 1 WEG 2002](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001921&Paragraf=31) idF BGBl. I Nr. 222/2021 |
| `at.weg.minReservePerM2` | €1.06 per m² per month | 2024-01-01 – 2025-12-31 | § 31 WEG, valorised; amount from [ÖVI](https://www.ovi.at/aktuelles/detailansicht/anhebung-der-mindestruecklage-1-1-2026) |
| `at.weg.minReservePerM2` | €1.12 per m² per month | 2026-01-01 – 2027-12-31 | § 31 WEG, valorised; [Wirtschaftskammer notice](https://www.wko.at/information-consulting/immobilien-vermoegenstreuhaender/mindestruecklage-wohnungseigentumsgesetz) of 2025-09-10 |

- The statute sets €0.90 and links it to VPI 2020 every second year from 2024 (base June 2021 = 102.6). The Wirtschaftskammer publishes each new amount. 2026: 0.90 × 128.1 / 102.6 = €1.1237 → €1.12.
- The 2024 amount comes from the property association ÖVI; the Wirtschaftskammer's 2024 notice itself has not been checked.
- Used only when the flat's reserve contribution is not given, for condominiums (or when ownership is unknown, with a flag). Applied to the flat's own floor area; the real share follows the co-ownership ratio.

### Rent regulation (MRG)

| Rule id | Value | Legal basis |
|---|---|---|
| `at.mrg.condominiumPermitAfter` | permit after 1945-05-08 | [§ 1 Abs. 4 Z 3 MRG](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10002531&Paragraf=1) |
| `at.mrg.newBuildingPermitAfter` | permit after 1953-06-30, built without public funds | § 1 Abs. 4 Z 1 MRG |
| `at.mrg.exclusionMaxUnits` | at most 2 units in the building | § 1 Abs. 2 Z 5 MRG |

All three valid from 2025-04-01 (the engine's coverage start; earlier versions not checked).

How the check works:
- **Excluded:** a building with at most two separate units (a house counts as one) is outside the MRG; rent is free.
- **Partial:** a condominium whose building permit is after 8 May 1945, or a building newly built without public funds with a permit after 30 June 1953. Only §§ 14, 16b, 29–36, 45, 46 and 49 apply, so § 16's rent caps do not. Tenancy protection still applies.
- **Full:** otherwise. Rent is capped at the Richtwert or the angemessener Mietzins (§ 16); the engine flags this but does not compute the cap yet.
- **Unknown:** when the inputs don't settle it (no permit date or build year, unknown ownership, or unknown public funding for a whole building).
- **Build year as an estimate** (heuristic): without a permit date, a building completed at least one year before the cut-off year counts as permitted before it, one completed at least five years after as permitted after it; years in between stay unknown. Results based on the build year are marked as estimates.
- Not checked: attic conversions and extensions (§ 1 Abs. 4 Z 2, 2a), other exclusions, and subsidy rules. A publicly funded building gets its own flag.

### Calculations

- **Loan payment:** constant-rate annuity with monthly payments, monthly rate = annual rate ÷ 12. Computed exactly with rational arithmetic and rounded half up to the cent. Interest each month = balance × monthly rate, rounded half up; the final payment absorbs rounding.
- **NOI (monthly):** net cold rent − vacancy − management − repair reserve − owner's maintenance. Operating costs pass through to the tenant, except during vacancy.
- **Vacancy:** `vacancyPct` × (net cold rent + operating costs), because the owner pays the operating costs of an empty flat.
- **Cash flow:** NOI − loan payment, before income tax.
- **Gross yield:** annual net cold rent ÷ purchase price.
- **Net yield:** annual NOI ÷ (price + acquisition costs).
- **Cash-on-cash:** annual cash flow ÷ equity, where equity = price + acquisition costs − loan. Empty if equity ≤ 0.
- **DSCR:** NOI ÷ loan payment.
- **Break-even rent:** the net cold rent at which cash flow is zero, (payment + reserve + maintenance + vacancy × operating costs) ÷ (1 − vacancy − management), rounded up to the cent.
- Percentages and ratios are rounded to two decimals, half away from zero.

### Heuristic thresholds

Rules of thumb for flags, not law (`HEURISTICS` in code):

| Flag | Threshold |
|---|---|
| `financing.highLtv` | loan above 80% of the price (high severity above 100%) |
| `financing.thinDscr` | DSCR at least 1.0 but below 1.2 |
| `cashflow.negative` | monthly cash flow below zero |
| `cashflow.operatingLoss` | NOI below zero |

## Assumptions

Not set by law; every one can be overridden in `assumptions`.

| Assumption | Default | Source of the default |
|---|---|---|
| `contractFeePct` | 1.5% + USt | [oesterreich.gv.at](https://www.oesterreich.gv.at/de/themen/bauen_und_wohnen/wohnen/8/Seite.210150.html): about 1–3% per the chambers' tariffs |
| `mortgageRegistrationFactor` | 1.3 × loan | [Hypo Tirol HIKrG information sheet](https://www.hypotirol.com/fileadmin/oesterreich/download/pdf/recht/hypo_tirol_informationsblatt_hypothekar_und_immobilienkreditgesetz_HIKrG.pdf): usually about 30% above the loan |
| `grundbuchFiling` | `electronic` | Purchase handled by a lawyer or notary |
| `grundbuchApplications` | 1 | Ownership and mortgage filed together |
| `vacancyPct` | 4% of gross rent | [GELD-Magazin 02/2021](https://www.infina.at/fileadmin/content/Presse/202102_GELD_Magazin_Anlegerwohnungen_Richtig_kalkulieren.pdf), tax adviser C. Klausner: 3–5% of gross annual rent |
| `maintenancePctPerYear` | 0.2% of price + acquisition costs | Same article: 0.2% of acquisition costs per year |
| `managementPct` | 0% of net cold rent | Owner manages the letting |

The output lists which assumptions were defaulted, and flags the ones that move the result most.

## Money handling

- All amounts are integer cents; rates are integer parts per million. Products use BigInt, so nothing is lost to floating point.
- Rounding follows the law where the law says something (GGG: up to the euro; BAO: commercial to the cent). Broker and contract fees, where no rule exists, round commercially to the cent.

## Known limitations

- Arm's-length purchase from a third party only. Family transfers and purchases below full value use other GrESt rules.
- The purchase price is the base everywhere. Separately priced furniture, assumed liabilities and the exact base rules (§ 5 GrEStG, § 26 GGG) are not modelled yet.
- No exemptions, e.g. the time-limited Grundbuch fee exemption for buying a primary residence. The engine targets buy-to-let.
- Rules are applied as valid on `valuationDate`. Grundbuch fees really depend on when the fee claim arises, usually at registration.
- Bank fees, valuation fees and signature certification are not included in acquisition costs.
- Cash flow is before income tax; AfA and rental-income tax come later.
- Rent, costs and the interest rate are held constant; no indexation or rate resets.
- Rent inputs are net of VAT; VAT on rent is not modelled.

## Open checks

- Cross-check the golden cases against a public calculator (e.g. durchblicker) and record the differences.
- Verify the base rules (§ 4–5 GrEStG, § 26 GGG) and model assumed liabilities.
- Extend coverage before 2025-04-01 if historical analysis is needed.
- Check the Wirtschaftskammer's 2024 notice for the €1.06 reserve amount; add the 2028 amount when published (by November 2027).
- Compute Richtwert caps for fully regulated flats (Richtwerte per Bundesland via RIS).

## Adding or changing a rule

1. Find the provision in RIS and, for valorised amounts, the regulation in the Bundesgesetzblatt.
2. Add a new version with `validFrom`; close the previous one with `validTo` the day before. `validateCatalogue()` rejects overlaps and gaps.
3. Set `verifiedOn` and write in `note` exactly what was checked.
4. Add a date-boundary test and regenerate the golden cases with `python3 fixtures/golden/oracle.py fixtures/golden` after updating the oracle.
5. Update this page.
