#!/usr/bin/env python3
"""Genera data.js: serie diaria de MSCI ACWI en EUR (retorno total aproximado), base 100.

Fuentes:
  - ^892400-USD-STRD (Yahoo): índice MSCI ACWI de precio, USD, desde 1988.
  - ACWI (Yahoo): ETF iShares MSCI ACWI, cierre ajustado (dividendos reinvertidos), USD, desde 2008.
  - Tipo de cambio EUR/USD de referencia del BCE, diario desde 1999-01-04.

Serie USD de retorno total:
  - desde el inicio del ETF: retornos del ETF (cierre ajustado)
  - antes: retornos del índice de precio + dividendo estimado (rentabilidad media
    por dividendo medida en el periodo en que ambas series se solapan)
Después se convierte a EUR con el tipo de cambio diario del BCE.
"""
import bisect, csv, io, json, math, os, urllib.request
from datetime import date, datetime, timezone

START = date(1999, 1, 4)
OUT = os.path.join(os.path.dirname(__file__), "..", "data.js")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=60).read().decode()


def yahoo(symbol, field):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           + symbol.replace("^", "%5E") + "?period1=0&period2=4000000000&interval=1d&events=div")
    r = json.loads(get(url))["chart"]["result"][0]
    vals = r["indicators"][field][0][field] if field == "adjclose" else r["indicators"]["quote"][0]["close"]
    out = {}
    for t, v in zip(r["timestamp"], vals):
        if v is not None:
            out[datetime.fromtimestamp(t, timezone.utc).date()] = v
    return out


def ecb_fx():
    url = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata&startPeriod=1999-01-01"
    rows = csv.DictReader(io.StringIO(get(url)))
    return {date.fromisoformat(r["TIME_PERIOD"]): float(r["OBS_VALUE"]) for r in rows if r["OBS_VALUE"]}


def asof(series, dates):
    """Último valor disponible <= cada fecha (forward fill)."""
    keys = sorted(series)
    out = []
    for d in dates:
        i = bisect.bisect_right(keys, d) - 1
        out.append(series[keys[i]] if i >= 0 else None)
    return out


def main():
    idx = yahoo("^892400-USD-STRD", "close")
    etf = yahoo("ACWI", "adjclose")
    fx = ecb_fx()
    dates = [d for d in sorted(fx) if d >= START]
    # Un día EUR/USD del BCE suele existir cuando hay mercado europeo; forward-fill del resto.
    p = asof(idx, dates)
    e = asof(etf, dates)
    r = [fx[d] for d in dates]

    first_etf = next(i for i, v in enumerate(e) if v is not None)
    # Dividendo implícito: diferencia de CAGR entre ETF (ajustado) e índice de precio en el solapamiento
    years = (dates[-1] - dates[first_etf]).days / 365.25
    div = (e[-1] / e[first_etf]) ** (1 / years) / (p[-1] / p[first_etf]) ** (1 / years) - 1
    print(f"Dividendo implícito estimado: {div:.2%}/año")

    usd = [None] * len(dates)
    usd[first_etf] = 100.0
    for i in range(first_etf + 1, len(dates)):
        usd[i] = usd[i - 1] * e[i] / e[i - 1]
    for i in range(first_etf - 1, -1, -1):
        days = (dates[i + 1] - dates[i]).days
        usd[i] = usd[i + 1] / ((p[i + 1] / p[i]) * (1 + div) ** (days / 365.25))

    eur = [u / x for u, x in zip(usd, r)]
    base = eur[0]
    eur = [round(v / base * 100, 4) for v in eur]
    payload = {"updated": dates[-1].isoformat(), "start": dates[0].isoformat(),
               "etfStart": dates[first_etf].isoformat(), "dividendYield": round(div, 4),
               "dates": [d.isoformat() for d in dates], "values": eur}
    with open(OUT, "w") as f:
        f.write("window.ACWI_DATA=" + json.dumps(payload, separators=(",", ":")) + ";\n")
    print(f"{len(eur)} puntos, {dates[0]} → {dates[-1]}, último valor {eur[-1]}")


if __name__ == "__main__":
    main()
