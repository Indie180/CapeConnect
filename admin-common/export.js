(function () {
  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toCsv(rows) {
    if (!rows || !rows.length) return '';
    const headers = Object.keys(rows[0]);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(esc).join(',')];
    rows.forEach((r) => lines.push(headers.map((h) => esc(r[h])).join(',')));
    return lines.join('\n');
  }

  function exportCsv(filename, rows) {
    const csv = toCsv(rows);
    downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  }

  function exportJson(filename, value) {
    downloadBlob(filename, new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  }

  function exportXlsx(filename, rows, sheetName) {
    if (!window.XLSX) {
      alert('SheetJS not loaded.');
      return;
    }
    const ws = window.XLSX.utils.json_to_sheet(rows || []);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Data');
    window.XLSX.writeFile(wb, filename);
  }

  function exportPdfTable(filename, head, body, title) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('jsPDF not loaded.');
      return;
    }
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title || 'Report', 14, 16);
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: 22,
        head: [head],
        body,
        styles: { fontSize: 8 }
      });
    }
    doc.save(filename);
  }

  window.GAExport = {
    exportCsv,
    exportJson,
    exportXlsx,
    exportPdfTable
  };
})();
