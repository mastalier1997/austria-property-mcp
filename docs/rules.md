# Rule catalogue

Every statutory number the engine uses, where it comes from, and how it was checked. The code is the source of truth (`packages/engine/src/rules/`); a test fails if a rule id is missing from this page.

**Coverage:** valuation dates from **2025-04-01** to **2027-12-31**. Earlier dates throw `RuleNotCoveredError`, because the court-fee amounts before the April 2025 valorisation have not been verified. From 2028 the statutory minimum repair reserve is re-indexed; until that amount is added, underwriting needs `ownerCosts.reserveFundMonthly` for 2028 dates. The income tax tariff is known up to 2027, so `tax.otherTaxableIncome` works only for valuation dates up to 2027-12-31; the marginal-rate method has no such limit.

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

## Income tax on rent

The `tax` section of `underwrite()` estimates the yearly rental result (Einkünfte aus Vermietung und Verpachtung), the income tax it causes or saves, the cash flow after tax and whether the letting passes the Liebhaberei test.

### Depreciation (AfA)

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.estg.afa.buildingRate` | 1.5% a year | from 2025-04-01 | [§ 16 Abs. 1 Z 8 lit. d EStG 1988](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004570&Paragraf=16) |
| `at.estg.afa.firstYearMultiplier` | at most 3 × in year 1 (4.5%) | from 2025-04-01 | § 16 Abs. 1 Z 8 lit. e EStG 1988 |
| `at.estg.afa.secondYearMultiplier` | at most 2 × in year 2 (3%) | from 2025-04-01 | § 16 Abs. 1 Z 8 lit. e EStG 1988 |

- Checked in the versions valid 2025-12-24 to 2026-12-31 and from 2027-01-01; the wording is the same. Earlier versions not checked.
- The accelerated rates apply to buildings acquired after 30 June 2020 (transitional rule in § 124b, not checked separately), which covers every purchase in the engine's date range. The half-year rule of § 7 Abs. 2 does not apply, so year 1 gets the full 4.5% whatever the month.
- The engine takes the accelerated rates in full. They are maximums; a taxpayer may claim less.
- **Base:** price plus acquisition costs, minus the mortgage registration fee (a cost of borrowing, below), minus the land share. VAT on broker and contract fees stays in the base, as for a landlord using the small-business exemption.
- **Rounding:** each year's AfA is base × rate, rounded half up to the cent, and never more than the remaining building value.
- **Not modelled:** a temporary higher AfA for residential buildings completed in 2024 to 2026 that meet an ecological standard. Its statute text has not been checked; the engine only flags such buildings (`tax.newBuildAfaNotModelled`).

### Land share (Grundanteilverordnung 2016)

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.grundanteil.smallTownPct` | 20% | from 2016-01-01 | [§ 2 Abs. 1 GrundanteilV 2016](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20009521) |
| `at.grundanteil.largeBuildingPct` | 30% | from 2016-01-01 | § 2 Abs. 2 GrundanteilV 2016 |
| `at.grundanteil.standardPct` | 40% | from 2016-01-01 | § 2 Abs. 2 GrundanteilV 2016 |
| `at.grundanteil.inhabitantsLimit` | 100,000 inhabitants | from 2016-01-01 | § 2 Abs. 1 and 2 GrundanteilV 2016 |
| `at.grundanteil.landPriceLimitPerM2` | €400 per m² | from 2016-01-01 | § 2 Abs. 1 and 2 GrundanteilV 2016 |
| `at.grundanteil.unitsLimit` | 10 units | from 2016-01-01 | § 2 Abs. 2 GrundanteilV 2016 |

- BGBl. II Nr. 99/2016, no amendments, checked on 2026-10-18.
- **20%** in municipalities under 100,000 inhabitants where building land (zoned and fully serviced, *baureifes Land*) costs under €400/m² on average. **Elsewhere 30%** if the building has more than 10 flats or business units, **40%** if it has up to 10. Each started 400 m² of business space counts as one unit.
- Inhabitants are those of the latest census published before the year AfA is first claimed (§ 2 Abs. 3).
- A different share can be proven, e.g. by an expert opinion, and the presumption does not apply where the actual share differs by at least 50% (§ 3). Pass `tax.landSharePct` in that case.
- **Missing facts** (heuristic): the 20% and 30% shares need facts, so without them the engine uses 40% (the share § 16 Abs. 1 Z 8 lit. d presumes too) and flags `assumption.landShare`, naming the inputs that would refine it.

### Income tax

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.estg.tariff.limit1` | €13,308 / €13,539 / €13,846 | calendar years 2025 / 2026 / 2027 | [§ 33 Abs. 1 EStG 1988](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004570&Paragraf=33) |
| `at.estg.tariff.limit2` | €21,617 / €21,992 / €22,491 | 2025 / 2026 / 2027 | § 33 Abs. 1 EStG 1988 |
| `at.estg.tariff.limit3` | €35,836 / €36,458 / €37,285 | 2025 / 2026 / 2027 | § 33 Abs. 1 EStG 1988 |
| `at.estg.tariff.limit4` | €69,166 / €70,365 / €71,960 | 2025 / 2026 / 2027 | § 33 Abs. 1 EStG 1988 |
| `at.estg.tariff.limit5` | €103,072 / €104,859 / €107,236 | 2025 / 2026 / 2027 | § 33 Abs. 1 EStG 1988 |
| `at.estg.tariff.limit6` | €1,000,000 | 2025-04-01 – 2029-12-31 | § 33 Abs. 1 EStG 1988 |
| `at.estg.tariff.rate1` … `at.estg.tariff.rate6` | 0%, 20%, 30%, 40%, 48%, 50% | from 2025-04-01 | § 33 Abs. 1 EStG 1988 |
| `at.estg.tariff.rate7` | 55% above €1 million | 2025-04-01 – 2029-12-31 | § 33 Abs. 1 EStG 1988 |

- 2025 amounts checked in the version valid 2025-07-01 to 2025-12-23 (BGBl. I Nr. 25/2025); 2026 in the versions from 2026-01-01 (BGBl. I Nr. 97/2025) and 2026-07-30 (BGBl. I Nr. 62/2026); 2027 from the "für 2027" footnotes in the version from 2026-07-30.
- The rate ids are `at.estg.tariff.rate1`, `at.estg.tariff.rate2`, `at.estg.tariff.rate3`, `at.estg.tariff.rate4`, `at.estg.tariff.rate5` and `at.estg.tariff.rate6`.
- **Two methods:**
  - With `tax.otherTaxableIncome`: tax = tariff(other income + rental result) − tariff(other income), using the tariff of the valuation date's year for every projected year. Each tariff amount is computed exactly and rounded half up to the cent (§ 204 BAO). A loss that pushes income below the first limit saves nothing more.
  - Otherwise: tax = rental result × `marginalTaxRatePct` (default 40%), rounded to the cent, half away from zero. A loss saves tax at the same rate, which assumes enough other income to absorb it.
- Tax credits (Absetzbeträge), other deductions, social security and later valorisation of the brackets are ignored. Losses are offset only within the same year; the engine carries nothing forward.

### Rental result per year

- Tax years are treated as loan years, and year 1 has a full year of rent.
- **Income:** 12 × (net cold rent − vacancy line). Operating costs passed to the tenant are income and expense at once and cancel out, except the vacancy share, which is in the vacancy line.
- **Deductions:** loan interest of that year (from the monthly schedule), AfA, 12 × (management + owner's maintenance), and the share of the mortgage registration fee.
- **Mortgage registration fee:** treated as a cost of borrowing and spread evenly over the loan term ([§ 19 Abs. 3 EStG 1988](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004570&Paragraf=19)); year 1 takes the rounding remainder. For loans of up to two years it is deducted in year 1, because prepayments for only the current and the following year are not spread. Applying § 19 Abs. 3 to this fee is common practice; it was not checked against case law.
- **Repair reserve:** contributions are deductible only when the reserve is spent on repairs ([BFG 23.10.2014, RV/3100573/2014](https://linda.lindeverlag.at/Dokument/153221/); also UFS 29.2.2008, RV/1908-W/07). The yearly rows leave them out (`reserveNotDeductedCents`).
- **Cash flow after tax:** 12 × NOI − loan payments of that year − tax. Payments stop after the term.
- The output shows years 1 to 5 and the year-1 monthly cash flow after tax (yearly ÷ 12, half away from zero).

### Liebhaberei

| Rule id | Value | Valid | Legal basis |
|---|---|---|---|
| `at.lvo.smallLettingYears` | total surplus within 25 years | from 2025-04-01 | [§ 2 Abs. 4 iVm § 1 Abs. 2 Z 3 LVO](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004804) |

- Losses from letting condominiums and houses are presumed Liebhaberei unless the letting is expected to produce a total surplus within 25 years from the start of letting (at most 28 years from the first expenses). Then the losses do not reduce tax.
- The engine projects the rental result for 25 years with rent and costs held constant and **deducts the repair reserve** in each year, assuming it is spent and deducted within the horizon. `totalSurplusFromYear` is the first year from which the cumulative result stays positive.
- Constant rents make the projection conservative; a real prognosis would usually index the rent.
- Whole buildings fall under § 1 Abs. 1 LVO (income presumed) and are not checked.
- Checked in the version current on 2026-10-18.

### Tax flags

| Flag | When |
|---|---|
| `tax.liebhabereiRisk` (warn) | no total surplus within 25 years |
| `assumption.taxRate` (info) | the default 40% marginal rate was used |
| `assumption.landShare` (info) | the land share had to assume missing facts |
| `tax.newBuildAfaNotModelled` (info) | building completed 2024 to 2026 |

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
| `marginalTaxRatePct` | 40% of the rental result | § 33 EStG: 40% applies to taxable income from €36,458 to €70,365 (2026), a typical range for employed investors. Not used when `tax.otherTaxableIncome` is given |

The output lists which assumptions were defaulted, and flags the ones that move the result most.

## Money handling

- All amounts are integer cents; rates are integer parts per million. Products use BigInt, so nothing is lost to floating point.
- Rounding follows the law where the law says something (GGG: up to the euro; BAO: commercial to the cent). Broker and contract fees, where no rule exists, round commercially to the cent.
- Signed amounts (a tax saving, a negative monthly cash flow) round half away from zero.

## Known limitations

- Arm's-length purchase from a third party only. Family transfers and purchases below full value use other GrESt rules.
- The purchase price is the base everywhere. Separately priced furniture, assumed liabilities and the exact base rules (§ 5 GrEStG, § 26 GGG) are not modelled yet.
- No exemptions, e.g. the time-limited Grundbuch fee exemption for buying a primary residence. The engine targets buy-to-let.
- Rules are applied as valid on `valuationDate`. Grundbuch fees really depend on when the fee claim arises, usually at registration.
- Bank fees, valuation fees and signature certification are not included in acquisition costs.
- Metrics are before income tax; the tax section adds the after-tax view with the simplifications listed under "Income tax on rent".
- Rent, costs and the interest rate are held constant; no indexation or rate resets.
- Rent inputs are net of VAT; VAT on rent is not modelled.

## Open checks

- Cross-check the golden cases against a public calculator (e.g. durchblicker) and record the differences.
- Verify the base rules (§ 4–5 GrEStG, § 26 GGG) and model assumed liabilities.
- Extend coverage before 2025-04-01 if historical analysis is needed.
- Check the Wirtschaftskammer's 2024 notice for the €1.06 reserve amount; add the 2028 amount when published (by November 2027).
- Compute Richtwert caps for fully regulated flats (Richtwerte per Bundesland via RIS).
- Add the 2028 tariff amounts when they are published.
- Check the statute text of the temporary AfA for buildings completed 2024–2026 before modelling it.
- Check the tax treatment of the mortgage registration fee (§ 19 Abs. 3 EStG) against the EStR and case law.
- Check § 2 Abs. 3 LVO for whole buildings.

## Adding or changing a rule

1. Find the provision in RIS and, for valorised amounts, the regulation in the Bundesgesetzblatt.
2. Add a new version with `validFrom`; close the previous one with `validTo` the day before. `validateCatalogue()` rejects overlaps and gaps.
3. Set `verifiedOn` and write in `note` exactly what was checked.
4. Add a date-boundary test and regenerate the golden cases with `python3 fixtures/golden/oracle.py fixtures/golden` after updating the oracle.
5. Update this page.
