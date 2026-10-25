# MSCI ACWI en EUR

Web estática con la evolución del MSCI ACWI en euros desde 1999: gráfico por periodo (1D, 1S, 1M, YTD, 1A, 3A, 5A, 10A, 20A, Todo), KPIs del periodo y tabla de rentabilidades mensuales.

## Datos
`data.js` se genera con `python3 scripts/build_data.py` (solo librería estándar). Serie **aproximada** de retorno total en EUR:

- 1999–2008: índice MSCI ACWI de precio (Yahoo `^892400-USD-STRD`) + dividendo estimado (~2%/año, medido en el solape con el ETF).
- 2008→hoy: ETF iShares MSCI ACWI (`ACWI`, cierre ajustado) → incluye comisión (~0,32%) y tracking error.
- Conversión USD→EUR con el tipo de referencia diario del BCE (disponible desde 4-ene-1999).

Se actualiza a diario con GitHub Actions (`.github/workflows/update.yml`).

## Uso
Abre `index.html` en el navegador, o activa GitHub Pages (Settings → Pages → rama `main`, carpeta `/`).
