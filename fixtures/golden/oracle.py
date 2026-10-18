"""Independent oracle for golden acquisition-cost cases.

Re-implements the rules with Python Decimal (no shared code with the TS engine)
and writes one JSON fixture per case, including a human-readable derivation.
"""
import json
import sys
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_CEILING
from pathlib import Path

# Usage: python3 fixtures/golden/oracle.py fixtures/golden/acquisition
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

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

for c in CASES:
    out = run(c)
    (OUT / f"{c['name']}.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    e = out["expected"]
    print(f"{c['name']}: total {e['totalCents']/100:,.2f} ({e['totalPctOfPrice']}%) flags={e['flags']}")
