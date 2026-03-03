(function () {
  function groupByDay(tickets, days) {
    const out = [];
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      labels.push(key);
      const sum = tickets
        .filter((t) => (t.purchasedAt || '').slice(0, 10) === key && t.status === 'PAID')
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      out.push(sum);
    }
    return { labels, out };
  }

  function byProduct(tickets) {
    const m = {};
    tickets.forEach((t) => {
      const k = t.productName || 'Unknown';
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }

  function topRoutes(tickets, topN) {
    const m = {};
    tickets.forEach((t) => {
      const key = `${t.routeFrom} -> ${t.routeTo}`;
      m[key] = (m[key] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, topN || 6);
  }

  function destroyIf(chartRef) {
    if (chartRef && typeof chartRef.destroy === 'function') chartRef.destroy();
  }

  window.GACharts = {
    groupByDay,
    byProduct,
    topRoutes,
    destroyIf
  };
})();
