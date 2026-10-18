"""Independent oracle for the golden test cases.

Re-implements the rules with Python Decimal and Fraction (no shared code with
the TS engine) and writes one JSON fixture per case, including a human-readable
derivation.

Usage: python3 fixtures/golden/oracle.py fixtures/golden
"""
import json
import sys
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_CEILING
from fractions import Fraction as F
from math import floor, ceil
from pathlib import Path

ROOT = Path(sys.argv[1])

def cent(x):  # commercial rounding to the cent
    return x.quantize(D("0.01"), rounding=ROUND_HALF_UP)

def euro_up(x):
    return x.quantize(D("1"), rounding=ROUND_CEILING)

def rules(date):
    new = date >= "2026-08-01"
    assert date >= "2025-04-01"
    return {
        "eingabe": D(61) if new else D(58),
        "paper": D(24) if new else D(23),
        "reduction": D(30) if new else D(28),
    }

def broker_cap(price):
    limit = D("36336.42")
    if price <= limit:
        exact = price * D("0.04")
    else:
        exact = max(price * D("0.03"), limit * D("0.04"))
    return cent(exact), cent(exact * 2)

def eur(x):
    return f"€{x:,.2f}"

def run(case):
    i = case["input"]
    date = i["valuationDate"]
    r = rules(date)
    a = {"contractFeePct": 1.5, "mortgageRegistrationFactor": 1.3,
         "grundbuchFiling": "electronic", "grundbuchApplications": 1}
    a.update(i.get("assumptions", {}))
    price = D(str(i["purchasePrice"]))
    items, deriv, flags = {}, [], []

    items["grest"] = cent(price * D("0.035"))
    deriv.append(f"Grunderwerbsteuer: 3.5% × {eur(price)} = {eur(items['grest'])}")

    base = euro_up(price)
    fee = euro_up(base * D("0.011"))
    if a["grundbuchFiling"] == "electronic":
        items["grundbuch.eigentum"] = max(D(0), fee - r["reduction"])
        deriv.append(f"Eigentum: 1.1% × {eur(base)} = {eur(base * D('0.011'))}, up to {eur(fee)}, minus {eur(r['reduction'])} direct debit = {eur(items['grundbuch.eigentum'])}")
    else:
        items["grundbuch.eigentum"] = fee
        deriv.append(f"Eigentum: 1.1% × {eur(base)} = {eur(base * D('0.011'))}, up to {eur(fee)} (paper, no reduction)")

    fin = i.get("financing")
    if fin and D(str(fin["loanAmount"])) > 0:
        loan = D(str(fin["loanAmount"]))
        if "registeredMortgageAmount" in fin:
            reg = D(str(fin["registeredMortgageAmount"]))
        else:
            reg = cent(loan * D(str(a["mortgageRegistrationFactor"])))
            flags.append("assumption.mortgageRegistration")
        rbase = euro_up(reg)
        items["grundbuch.pfandrecht"] = euro_up(rbase * D("0.012"))
        deriv.append(f"Pfandrecht: 1.2% × {eur(rbase)} = {eur(rbase * D('0.012'))}, up to {eur(items['grundbuch.pfandrecht'])}")

    per = r["eingabe"] + (r["paper"] if a["grundbuchFiling"] == "paper" else 0)
    items["grundbuch.eingabe"] = per * a["grundbuchApplications"]
    deriv.append(f"Eingabengebühr: {eur(per)} × {a['grundbuchApplications']} = {eur(items['grundbuch.eingabe'])}")

    b = i["broker"]
    if b != "none" and b["commissionPct"] > 0:
        pct = D(str(b["commissionPct"])) / 100
        net = cent(price * pct)
        items["broker.commission"] = net
        items["broker.vat"] = cent(net * D("0.2"))
        deriv.append(f"Broker: {b['commissionPct']}% × {eur(price)} = {eur(net)} + 20% USt {eur(items['broker.vat'])}")
        cap, one = broker_cap(price)
        seller = b.get("sellerPaysCommission")
        limit = cap if seller is True else one
        if net > limit:
            flags.append("broker.aboveCap")
        elif net > cap:
            flags.append("broker.lawfulOnlyIfSellerPaysNothing")
        deriv.append(f"Broker cap: {eur(cap)} per party, {eur(one)} if the seller pays nothing")

    cpct = D(str(a["contractFeePct"])) / 100
    if cpct > 0:
        net = cent(price * cpct)
        items["contract.fee"] = net
        items["contract.vat"] = cent(net * D("0.2"))
        deriv.append(f"Contract: {a['contractFeePct']}% × {eur(price)} = {eur(net)} + 20% USt {eur(items['contract.vat'])}")
        if "contractFeePct" not in i.get("assumptions", {}):
            flags.append("assumption.contractFee")

    total = sum(items.values())
    pct_total = (total / price * 100).quantize(D("0.01"), rounding=ROUND_HALF_UP)
    deriv.append(f"Total: {eur(total)} = {pct_total}% of the price")
    return {
        "name": case["name"],
        "description": case["description"],
        "input": i,
        "expected": {
            "lineItems": {k: int(v * 100) for k, v in items.items()},
            "totalCents": int(total * 100),
            "totalPctOfPrice": float(pct_total),
            "flags": sorted(flags),
        },
        "derivation": deriv,
        "oracle": "Independent Python Decimal implementation, cross-checked by hand for vienna-250k-standard.",
    }

CASES = [
    {"name": "vienna-250k-standard",
     "description": "Typical buy-to-let: €250k, 3% broker (seller also pays), €200k loan, default assumptions.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 250000,
               "broker": {"commissionPct": 3, "sellerPaysCommission": True},
               "financing": {"loanAmount": 200000}}},
    {"name": "vienna-250k-before-aug-2026",
     "description": "Same purchase one day before the 1 Aug 2026 court-fee valorisation: €58 filing fee, €28 reduction.",
     "input": {"valuationDate": "2026-07-31", "purchasePrice": 250000,
               "broker": {"commissionPct": 3, "sellerPaysCommission": True},
               "financing": {"loanAmount": 200000}}},
    {"name": "cash-no-broker",
     "description": "Cash purchase without broker, contract fee set to 2%.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 189900, "broker": "none",
               "assumptions": {"contractFeePct": 2}}},
    {"name": "odd-cents-paper-filing",
     "description": "Price and loan with cents, paper filing in two applications, explicit registered mortgage, 3.6% broker with unknown seller commission.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 123456.78,
               "broker": {"commissionPct": 3.6},
               "financing": {"loanAmount": 98765.43, "registeredMortgageAmount": 125000},
               "assumptions": {"grundbuchFiling": "paper", "grundbuchApplications": 2}}},
    {"name": "favoriten-3-6-pct-broker",
     "description": "The 'flagged' mock listing from property-cashflow: €198.5k, 3.6% broker, 70% loan.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 198500,
               "broker": {"commissionPct": 3.6},
               "financing": {"loanAmount": 138950}}},
    {"name": "broker-above-one-sided-cap",
     "description": "7% commission with the seller paying nothing: above even the doubled cap.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 300000,
               "broker": {"commissionPct": 7, "sellerPaysCommission": False},
               "assumptions": {"contractFeePct": 1.5}}},
    {"name": "small-flat-lower-bracket",
     "description": "€30k flat: lower 4% bracket, broker exactly at the cap.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 30000,
               "broker": {"commissionPct": 4, "sellerPaysCommission": True},
               "assumptions": {"contractFeePct": 1}}},
    {"name": "floor-band-40k",
     "description": "€40k: 3% would be €1,200, but the § 12 Abs. 4 floor keeps the cap at €1,453.46, so 3.5% is lawful.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 40000,
               "broker": {"commissionPct": 3.5, "sellerPaysCommission": True},
               "assumptions": {"contractFeePct": 1}}},
]

ACQ_OUT = ROOT / "acquisition"
ACQ_OUT.mkdir(parents=True, exist_ok=True)
for c in CASES:
    out = run(c)
    (ACQ_OUT / f"{c['name']}.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    e = out["expected"]
    print(f"{c['name']}: total {e['totalCents']/100:,.2f} ({e['totalPctOfPrice']}%) flags={e['flags']}")


# ---------------------------------------------------------------------------
# Underwriting (M2)
# ---------------------------------------------------------------------------

def to_cents(x):
    return int((D(str(x)) * 100).to_integral_value())

def round_half_up(x: F) -> int:
    """Nearest integer, ties away from zero."""
    sign = -1 if x < 0 else 1
    return sign * floor(abs(x) + F(1, 2))

def two_dec(x: F) -> float:
    """Round to two decimals, ties away from zero."""
    return round_half_up(x * 100) / 100

def reserve_min_cents(date):
    assert "2022-07-01" <= date <= "2027-12-31"
    if date >= "2026-01-01":
        return 112
    if date >= "2024-01-01":
        return 106
    return 90

def annuity(loan, ppm, months):
    if loan == 0:
        return 0
    if ppm == 0:
        return round_half_up(F(loan, months))
    r = F(ppm, 12_000_000)
    q = (1 + r) ** months
    return round_half_up(loan * r * q / (q - 1))

def schedule(loan, ppm, months):
    pay = annuity(loan, ppm, months)
    bal, total_int, y1i, y1p = loan, 0, 0, 0
    for m in range(1, months + 1):
        interest = round_half_up(F(bal * ppm, 12_000_000))
        principal = pay - interest
        if m == months or principal > bal:
            principal = bal
        bal -= principal
        total_int += interest
        if m <= 12:
            y1i += interest
            y1p += principal
    return pay, y1i, y1p, total_int

def rent_regulation(prop):
    own = prop.get("ownership")
    units = prop.get("unitsInBuilding", 1 if own == "house" else None)
    if units is not None and units <= 2:
        return "excluded", "unitCount"

    def after(cutoff_date, cutoff_year):
        if "buildingPermitDate" in prop:
            return prop["buildingPermitDate"] > cutoff_date, "permitDate"
        if "buildingYear" in prop:
            y = prop["buildingYear"]
            if y <= cutoff_year - 1:
                return False, "buildingYear"
            if y >= cutoff_year + 5:
                return True, "buildingYear"
            return None, "buildingYear"
        return None, "none"

    z3, b3 = after("1945-05-08", 1945)
    z1, b1 = after("1953-06-30", 1953)
    pf = prop.get("publicFunding")
    no_pub = None if pf is None else (not pf)
    if z1 is False or no_pub is False:
        bp = False
    elif z1 is True and no_pub is True:
        bp = True
    else:
        bp = None
    if own == "condominium":
        partial = True if (z3 is True or bp is True) else z3
    elif own == "wholeBuilding":
        partial = bp
    else:
        partial = True if (z3 is True and bp is True) else (False if (z3 is False and bp is False) else None)
    basis = b1 if b3 == "none" else b3
    status = {True: "partial", False: "full", None: "unknown"}[partial]
    return status, basis

def underwrite(case):
    i = case["input"]
    date = i["valuationDate"]
    acq_input = {k: i[k] for k in ("valuationDate", "purchasePrice", "broker")}
    fin = i.get("financing")
    if fin:
        acq_input["financing"] = {k: v for k, v in fin.items() if k in ("loanAmount", "registeredMortgageAmount")}
    acq_keys = {"contractFeePct", "mortgageRegistrationFactor", "grundbuchFiling", "grundbuchApplications"}
    given = i.get("assumptions", {})
    acq_input["assumptions"] = {k: v for k, v in given.items() if k in acq_keys}
    acq = run({"name": case["name"], "description": "", "input": acq_input})["expected"]

    op = {"vacancyPct": 4, "maintenancePctPerYear": 0.2, "managementPct": 0}
    op.update({k: v for k, v in given.items() if k in op})
    price = to_cents(i["purchasePrice"])
    total_inv = price + acq["totalCents"]
    rent = to_cents(i["rent"]["netColdMonthly"])
    bk = to_cents(i["rent"].get("operatingCostsMonthly", 0))
    prop = i.get("property", {})
    owner = i.get("ownerCosts", {})
    deriv, flags = [], list(acq["flags"])

    v_ppm = int(D(str(op["vacancyPct"])) * 10_000)
    m_ppm = int(D(str(op["managementPct"])) * 10_000)
    mt_ppm = int(D(str(op["maintenancePctPerYear"])) * 10_000)

    loan = to_cents(fin["loanAmount"]) if fin else 0
    financing = None
    pay = 0
    if loan > 0:
        rate_ppm = int(D(str(fin["ratePct"])) * 10_000)
        pay, y1i, y1p, tot = schedule(loan, rate_ppm, fin["termYears"] * 12)
        financing = {
            "monthlyPaymentCents": pay,
            "year1InterestCents": y1i,
            "year1PrincipalCents": y1p,
            "totalInterestCents": tot,
            "ltvPct": two_dec(F(loan * 100, price)),
        }
        deriv.append(f"Loan: annuity {eur(D(loan) / 100)} at {fin['ratePct']}% over {fin['termYears']} years = {eur(D(pay) / 100)} a month")

    lines = {"rent": rent}
    lines["vacancy"] = round_half_up(F((rent + bk) * v_ppm, 1_000_000))
    deriv.append(f"Vacancy: {op['vacancyPct']}% × {eur(D(rent + bk) / 100)} = {eur(D(lines['vacancy']) / 100)}")
    if m_ppm > 0:
        lines["management"] = round_half_up(F(rent * m_ppm, 1_000_000))
    own = prop.get("ownership")
    weg = own in (None, "condominium")
    area = to_cents(prop["livingAreaM2"]) if "livingAreaM2" in prop else None  # hundredths of m²
    if "reserveFundMonthly" in owner:
        lines["reserveFund"] = to_cents(owner["reserveFundMonthly"])
    elif weg and area is not None:
        lines["reserveFund"] = round_half_up(F(reserve_min_cents(date) * area, 100))
        flags.append("assumption.reserveMinimum")
        deriv.append(f"Reserve: statutory minimum {reserve_min_cents(date)} ct/m² × {area / 100} m² = {eur(D(lines['reserveFund']) / 100)}")
    elif weg:
        flags.append("inputs.reserveUnknown")
    if "maintenanceMonthly" in owner:
        lines["maintenance"] = to_cents(owner["maintenanceMonthly"])
    else:
        lines["maintenance"] = round_half_up(F(total_inv * mt_ppm, 12_000_000))
        deriv.append(f"Maintenance: {op['maintenancePctPerYear']}% × {eur(D(total_inv) / 100)} ÷ 12 = {eur(D(lines['maintenance']) / 100)}")

    noi = rent - sum(v for k, v in lines.items() if k != "rent")
    cf = noi - pay
    equity = total_inv - loan
    share = 1_000_000 - v_ppm - m_ppm
    fixed = pay + lines.get("reserveFund", 0) + lines["maintenance"]
    be = ceil(F(fixed * 1_000_000 + v_ppm * bk, share)) if share > 0 else None
    metrics = {
        "monthlyNoiCents": noi,
        "monthlyCashFlowCents": cf,
        "grossYieldPct": two_dec(F(rent * 12 * 100, price)),
        "netYieldPct": two_dec(F(noi * 12 * 100, total_inv)),
        "cashOnCashPct": two_dec(F(cf * 12 * 100, equity)) if equity > 0 else None,
        "dscr": two_dec(F(noi, pay)) if pay > 0 else None,
        "totalInvestmentCents": total_inv,
        "equityCents": equity,
        "breakEvenRentCents": be,
        "breakEvenRentPerM2": two_dec(F(be, area)) if (be is not None and area) else None,
    }
    deriv.append(f"NOI {eur(D(noi) / 100)}, cash flow {eur(D(cf) / 100)} a month, break-even rent {eur(D(be) / 100) if be is not None else '-'}")

    status, basis = rent_regulation(prop)
    if status == "full":
        flags.append("rent.fullMrg")
    elif status == "unknown":
        flags.append("rent.regulationUnknown")
    elif basis == "buildingYear":
        flags.append("rent.regulationEstimated")
    if prop.get("publicFunding") is True:
        flags.append("rent.publicFunding")
    if noi < 0:
        flags.append("cashflow.operatingLoss")
    elif cf < 0:
        flags.append("cashflow.negative")
    if financing:
        if financing["ltvPct"] > 80:
            flags.append("financing.highLtv")
        if metrics["dscr"] is not None and 1 <= metrics["dscr"] < 1.2:
            flags.append("financing.thinDscr")
    if equity <= 0:
        flags.append("financing.noEquity")
    if "vacancyPct" not in given or ("maintenancePctPerYear" not in given and "maintenanceMonthly" not in owner):
        flags.append("assumption.operatingDefaults")

    return {
        "name": case["name"],
        "description": case["description"],
        "input": i,
        "expected": {
            "acquisitionTotalCents": acq["totalCents"],
            "financing": financing,
            "operating": lines,
            "metrics": metrics,
            "rentRegulation": {"status": status, "basis": basis},
            "flags": sorted(flags),
        },
        "derivation": deriv,
        "oracle": "Independent Python Fraction implementation (exact annuity, explicit rounding).",
    }

UW_CASES = [
    {"name": "meidling-condo-1978",
     "description": "The 'clean' mock listing: 54 m² condo built 1978, 65% loan at 3.9% over 25 years, reserve and operating costs from the listing.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 269000,
               "broker": {"commissionPct": 3, "sellerPaysCommission": True},
               "financing": {"loanAmount": 174850, "ratePct": 3.9, "termYears": 25},
               "property": {"livingAreaM2": 54, "ownership": "condominium", "buildingYear": 1978},
               "rent": {"netColdMonthly": 795, "operatingCostsMonthly": 132},
               "ownerCosts": {"reserveFundMonthly": 41}}},
    {"name": "favoriten-unknown-regulation",
     "description": "The 'flagged' mock listing: no build year, reserve folded into operating costs (so the statutory minimum is used), 6% vacancy, 3.5% management.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 198500,
               "broker": {"commissionPct": 3.6},
               "financing": {"loanAmount": 138950, "ratePct": 4.3, "termYears": 25},
               "property": {"livingAreaM2": 41, "ownership": "condominium"},
               "rent": {"netColdMonthly": 560, "operatingCostsMonthly": 168},
               "assumptions": {"vacancyPct": 6, "managementPct": 3.5}}},
    {"name": "cash-purchase-1962-permit",
     "description": "Cash purchase, condo with a 1962 building permit: no rent cap, no loan metrics.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 150000, "broker": "none",
               "property": {"livingAreaM2": 50, "ownership": "condominium", "buildingPermitDate": "1962-03-01"},
               "rent": {"netColdMonthly": 700, "operatingCostsMonthly": 150},
               "ownerCosts": {"reserveFundMonthly": 60},
               "assumptions": {"vacancyPct": 3, "maintenancePctPerYear": 0.3, "contractFeePct": 1.2}}},
    {"name": "altbau-full-mrg",
     "description": "Gründerzeit condo (permit 1905): the MRG applies in full, so the assumed rent may be capped.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 320000,
               "broker": {"commissionPct": 3, "sellerPaysCommission": True},
               "financing": {"loanAmount": 200000, "ratePct": 3.6, "termYears": 30},
               "property": {"livingAreaM2": 70, "ownership": "condominium", "buildingPermitDate": "1905-06-01"},
               "rent": {"netColdMonthly": 1400, "operatingCostsMonthly": 210}}},
    {"name": "zero-rate-loan",
     "description": "Interest-free family loan over 10 years: payment is loan ÷ 120.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 180000, "broker": "none",
               "financing": {"loanAmount": 100000, "ratePct": 0, "termYears": 10},
               "property": {"livingAreaM2": 45, "ownership": "condominium", "buildingPermitDate": "1995-01-01"},
               "rent": {"netColdMonthly": 690}}},
    {"name": "house-excluded",
     "description": "Single-family house: outside the MRG, no WEG reserve, maintenance given directly.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 450000,
               "broker": {"commissionPct": 3, "sellerPaysCommission": True},
               "financing": {"loanAmount": 300000, "ratePct": 3.5, "termYears": 30},
               "property": {"livingAreaM2": 120, "ownership": "house", "buildingYear": 1985},
               "rent": {"netColdMonthly": 1800},
               "ownerCosts": {"maintenanceMonthly": 150},
               "assumptions": {"vacancyPct": 2}}},
    {"name": "subsidised-building-full-mrg",
     "description": "Whole rental building built with public funds (permit 1970): the new-building exemption does not apply.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 1200000,
               "broker": {"commissionPct": 3, "sellerPaysCommission": True},
               "financing": {"loanAmount": 800000, "ratePct": 3.8, "termYears": 25},
               "property": {"livingAreaM2": 600, "ownership": "wholeBuilding", "buildingPermitDate": "1970-04-15",
                            "publicFunding": True, "unitsInBuilding": 9},
               "rent": {"netColdMonthly": 6600, "operatingCostsMonthly": 1500},
               "ownerCosts": {"maintenanceMonthly": 900}}},
    {"name": "full-financing-no-equity",
     "description": "Loan covers price and costs: no equity, very high LTV, operating defaults.",
     "input": {"valuationDate": "2026-10-18", "purchasePrice": 200000, "broker": "none",
               "financing": {"loanAmount": 225000, "ratePct": 4, "termYears": 35},
               "property": {"livingAreaM2": 48, "ownership": "condominium", "buildingYear": 2005},
               "rent": {"netColdMonthly": 980, "operatingCostsMonthly": 140}}},
    {"name": "reserve-before-2026-valorisation",
     "description": "Valuation date 2025-12-31: statutory minimum reserve still €1.06 per m².",
     "input": {"valuationDate": "2025-12-31", "purchasePrice": 240000,
               "broker": {"commissionPct": 3, "sellerPaysCommission": True},
               "financing": {"loanAmount": 150000, "ratePct": 3.7, "termYears": 25},
               "property": {"livingAreaM2": 60, "ownership": "condominium", "buildingPermitDate": "1988-09-01"},
               "rent": {"netColdMonthly": 1050, "operatingCostsMonthly": 180}}},
]

UW_OUT = ROOT / "underwrite"
UW_OUT.mkdir(parents=True, exist_ok=True)
for c in UW_CASES:
    out = underwrite(c)
    (UW_OUT / f"{c['name']}.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    e = out["expected"]
    m = e["metrics"]
    print(f"{c['name']}: CF {m['monthlyCashFlowCents']/100:,.2f}/mo, gross {m['grossYieldPct']}%, net {m['netYieldPct']}%, "
          f"DSCR {m['dscr']}, BE {m['breakEvenRentCents']}, MRG {e['rentRegulation']['status']} flags={e['flags']}")
