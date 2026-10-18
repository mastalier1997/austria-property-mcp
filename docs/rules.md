# Rule catalogue

Every statutory number the engine uses, where it comes from, and how it was checked. The code is the source of truth (`packages/engine/src/rules/`); a test fails if a rule id is missing from this page.

**Coverage:** valuation dates from **2025-04-01** onward. Earlier dates throw `RuleNotCoveredError`, because the court-fee amounts before the April 2025 valorisation have not been verified.

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

## Assumptions

Not set by law; every one can be overridden in `assumptions`.

| Assumption | Default | Source of the default |
|---|---|---|
| `contractFeePct` | 1.5% + USt | [oesterreich.gv.at](https://www.oesterreich.gv.at/de/themen/bauen_und_wohnen/wohnen/8/Seite.210150.html): about 1–3% per the chambers' tariffs |
| `mortgageRegistrationFactor` | 1.3 × loan | [Hypo Tirol HIKrG information sheet](https://www.hypotirol.com/fileadmin/oesterreich/download/pdf/recht/hypo_tirol_informationsblatt_hypothekar_und_immobilienkreditgesetz_HIKrG.pdf): usually about 30% above the loan |
| `grundbuchFiling` | `electronic` | Purchase handled by a lawyer or notary |
| `grundbuchApplications` | 1 | Ownership and mortgage filed together |

The output lists which assumptions were defaulted, and flags the two that move the total most.

## Money handling

- All amounts are integer cents; rates are integer parts per million. Products use BigInt, so nothing is lost to floating point.
- Rounding follows the law where the law says something (GGG: up to the euro; BAO: commercial to the cent). Broker and contract fees, where no rule exists, round commercially to the cent.

## Known limitations

- Arm's-length purchase from a third party only. Family transfers and purchases below full value use other GrESt rules.
- The purchase price is the base everywhere. Separately priced furniture, assumed liabilities and the exact base rules (§ 5 GrEStG, § 26 GGG) are not modelled yet.
- No exemptions, e.g. the time-limited Grundbuch fee exemption for buying a primary residence. The engine targets buy-to-let.
- Rules are applied as valid on `valuationDate`. Grundbuch fees really depend on when the fee claim arises, usually at registration.
- Bank fees, valuation fees, signature certification and loan interest are not included.

## Open checks

- Cross-check the golden cases against a public calculator (e.g. durchblicker) and record the differences.
- Verify the base rules (§ 4–5 GrEStG, § 26 GGG) and model assumed liabilities.
- Extend coverage before 2025-04-01 if historical analysis is needed.

## Adding or changing a rule

1. Find the provision in RIS and, for valorised amounts, the regulation in the Bundesgesetzblatt.
2. Add a new version with `validFrom`; close the previous one with `validTo` the day before. `validateCatalogue()` rejects overlaps and gaps.
3. Set `verifiedOn` and write in `note` exactly what was checked.
4. Add a date-boundary test and regenerate the golden cases with `python3 fixtures/golden/oracle.py fixtures/golden/acquisition` after updating the oracle.
5. Update this page.
