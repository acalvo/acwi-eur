(() => {
  const D = window.ACWI_DATA;
  const t = D.dates.map(d => Date.parse(d + "T00:00:00Z"));
  const v = D.values;
  const N = v.length;
  const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const fmtN = (x, d = 2) => x.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtP = (x, d = 2) => (x > 0 ? "+" : "") + fmtN(x * 100, d) + "%";
  const fmtDate = ms => new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const cls = x => (x >= 0 ? "pos" : "neg");

  const PERIODS = [
    ["1D", "Último día"], ["1S", "Última semana"], ["1M", "Último mes"], ["YTD", "YTD"], ["1A", "1 año"],
    ["3A", "3 años"], ["5A", "5 años"], ["10A", "10 años"], ["20A", "20 años"], ["Todo", "Todo"],
  ];

  // índice del primer punto (base) del periodo: último dato <= fecha de corte
  function startIndex(key) {
    const last = new Date(t[N - 1]);
    if (key === "Todo") return 0;
    if (key === "1D") return N - 2;
    let cut;
    if (key === "YTD") cut = Date.UTC(last.getUTCFullYear() - 1, 11, 31);
    else if (key === "1S") cut = t[N - 1] - 7 * 864e5;
    else if (key === "1M") cut = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - 1, last.getUTCDate());
    else cut = Date.UTC(last.getUTCFullYear() - parseInt(key), last.getUTCMonth(), last.getUTCDate());
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (t[m] <= cut) lo = m; else hi = m - 1; }
    return lo;
  }

  function stats(i0) {
    const n = N - 1 - i0;
    const total = v[N - 1] / v[i0] - 1;
    const years = (t[N - 1] - t[i0]) / (365.25 * 864e5);
    const rets = [];
    let peak = v[i0], mdd = 0, best = -Infinity, worst = Infinity, bi = 0, wi = 0;
    for (let i = i0 + 1; i < N; i++) {
      const r = v[i] / v[i - 1] - 1;
      rets.push(r);
      if (r > best) { best = r; bi = i; }
      if (r < worst) { worst = r; wi = i; }
    }
    for (let i = i0; i < N; i++) { peak = Math.max(peak, v[i]); mdd = Math.min(mdd, v[i] / peak - 1); }
    let vol = null;
    if (rets.length >= 15) {
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
      vol = sd * Math.sqrt(252);
    }
    const cagr = years >= 1 ? Math.pow(1 + total, 1 / years) - 1 : null;
    return { total, cagr, vol, mdd, best, worst, bi, wi, n, hi: Math.max(...v.slice(i0)), lo: Math.min(...v.slice(i0)) };
  }

  const chartEl = document.getElementById("chart");
  let chart;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function render(key) {
    const i0 = startIndex(key);
    const s = stats(i0);
    document.getElementById("last").textContent = fmtN(v[N - 1]);
    const ch = document.getElementById("change");
    ch.textContent = fmtP(s.total) + " · " + PERIODS.find(p => p[0] === key)[1];
    ch.className = "chg " + cls(s.total);

    const kp = [
      ["Rentabilidad", fmtP(s.total), cls(s.total), `${fmtDate(t[i0])} → ${fmtDate(t[N - 1])}`],
      ["Anualizada (CAGR)", s.cagr == null ? "–" : fmtP(s.cagr), s.cagr == null ? "" : cls(s.cagr), s.cagr == null ? "Solo periodos ≥ 1 año" : ""],
      ["Volatilidad anual", s.vol == null ? "–" : fmtN(s.vol * 100) + "%", "", s.vol == null ? "Pocos datos" : "Desv. típica diaria × √252"],
      ["Máx. caída (drawdown)", fmtN(s.mdd * 100) + "%", "neg", "Desde máximo previo"],
      ["Mejor día", s.n ? fmtP(s.best) : "–", "pos", s.n ? fmtDate(t[s.bi]) : ""],
      ["Peor día", s.n ? fmtP(s.worst) : "–", "neg", s.n ? fmtDate(t[s.wi]) : ""],
      ["Máximo", fmtN(s.hi), "", ""],
      ["Mínimo", fmtN(s.lo), "", ""],
    ];
    document.getElementById("kpis").innerHTML = kp.map(([l, val, c, sub]) =>
      `<div class="kpi"><small>${l}</small><b class="${c}">${val}</b><i>${sub}</i></div>`).join("");

    const pts = [];
    for (let i = i0; i < N; i++) pts.push({ x: t[i], y: v[i] });
    const up = s.total >= 0;
    const color = css(up ? "--pos" : "--neg");
    const data = { datasets: [{ data: pts, borderColor: color, backgroundColor: color + "22", borderWidth: 1.8, fill: true,
      pointRadius: pts.length < 40 ? 3 : 0, pointHoverRadius: 4, tension: 0 }] };
    if (chart) { chart.data = data; chart.options.scales.x.min = pts[0].x; chart.options.scales.x.max = pts[pts.length - 1].x; chart.update("none"); return; }
    chart = new Chart(chartEl, {
      type: "line", data,
      options: {
        parsing: false, normalized: true, animation: false, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          decimation: { enabled: true, algorithm: "lttb", samples: 600 },
          tooltip: { callbacks: { title: it => fmtDate(it[0].parsed.x), label: it => fmtN(it.parsed.y) } },
        },
        scales: {
          x: { type: "linear", min: pts[0].x, max: pts[pts.length - 1].x, ticks: { maxTicksLimit: 7, color: css("--muted"), callback(val) {
                const d = new Date(val); const span = this.max - this.min;
                return span < 120 * 864e5 ? d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" })
                     : d.toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" }); } },
               grid: { display: false } },
          y: { ticks: { color: css("--muted") }, grid: { color: css("--line") } },
        },
      },
    });
  }

  // tabla mensual: rentabilidad = cierre del mes / cierre del mes anterior (enero 1999 parte del 4-ene)
  function monthly() {
    const closes = new Map(); // "YYYY-M" -> valor al último día del mes
    for (let i = 0; i < N; i++) { const d = new Date(t[i]); closes.set(d.getUTCFullYear() * 12 + d.getUTCMonth(), v[i]); }
    const keys = [...closes.keys()].sort((a, b) => a - b);
    const rows = new Map();
    keys.forEach((k, j) => {
      const prev = j ? closes.get(keys[j - 1]) : v[0];
      const y = Math.floor(k / 12);
      if (!rows.has(y)) rows.set(y, { m: Array(12).fill(null), first: v[0], last: null });
      rows.get(y).m[k % 12] = closes.get(k) / prev - 1;
    });
    // anual: del cierre del año anterior al cierre de este
    const yearEnd = y => closes.get(y * 12 + 11) ?? closes.get(Math.max(...keys.filter(k => Math.floor(k / 12) === y)));
    let html = "<thead><tr><th>Año</th>" + MONTHS.map(m => `<th>${m}</th>`).join("") + "<th>Año</th></tr></thead><tbody>";
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const base = closes.get((y - 1) * 12 + 11) ?? v[0];
      const ann = yearEnd(y) / base - 1;
      html += `<tr><td>${y}</td>` + rows.get(y).m.map(r => {
        if (r == null) return `<td class="empty">·</td>`;
        const a = Math.min(Math.abs(r) / 0.08, 1) * 0.55;
        const bg = `rgba(var(${r >= 0 ? "--posbg" : "--negbg"}),${a.toFixed(2)})`;
        return `<td style="background:${bg}">${fmtN(r * 100, 1)}%</td>`;
      }).join("") + `<td class="year ${cls(ann)}">${fmtN(ann * 100, 1)}%</td></tr>`;
    }
    document.getElementById("monthly").innerHTML = html + "</tbody>";
  }

  document.getElementById("meta").textContent =
    `Datos hasta ${fmtDate(t[N - 1])} · histórico desde ${fmtDate(t[0])} · base 100 = ${fmtDate(t[0])}`;
  const bar = document.getElementById("periods");
  bar.innerHTML = PERIODS.map(([k, l]) => `<button role="tab" data-k="${k}" title="${l}">${k}</button>`).join("");
  function select(k) {
    bar.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.k === k));
    render(k);
  }
  bar.addEventListener("click", e => { if (e.target.dataset.k) select(e.target.dataset.k); });
  monthly();
  select("5A");
})();
