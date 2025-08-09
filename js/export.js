// js/export.js
// Exportaciones CSV y PDF + modal de exportación

import { configuracion } from './data.js';
import { fmtEUR, toast } from './utils.js';
import { buildStatsForMonth } from './supervisor.js';

/**
 * Exporta ranking como CSV.
 * @param {ReturnType<typeof buildStatsForMonth>} stats
 * @param {string} yyyyMM
 */
export function exportRankingCSV(stats, yyyyMM) {
  const rows = [['Pos', 'Usuario', 'Puntos', 'Entradas', '% Meta', 'Bono (€)']];
  stats.forEach((s, i) => {
    const bonus = s.porcentaje >= 100 ? Number(configuracion().bonoMensual || 0) : 0;
    rows.push([i + 1, s.nombre, s.puntos.toFixed(2), s.entradas, `${s.porcentaje.toFixed(0)}%`, bonus.toFixed(2)]);
  });

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ranking_${yyyyMM}.csv`;
  a.click();
}

/**
 * Exporta un PDF de reporte (departamento o usuario).
 * requiere jsPDF + autotable presentes en index.html
 * @param {string} yyyyMM
 * @param {"departamento"|"usuario"} scope
 * @param {string} [email]
 */
export async function exportPDFReport(yyyyMM, scope, email = '') {
  // @ts-ignore
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF && !window.jspdf?.default) {
    toast('Librería jsPDF no disponible', 'error');
    return;
  }
  // @ts-ignore
  const doc = new (window.jspdf.jsPDF || window.jspdf.default)({ unit: 'pt', format: 'a4' });
  const title = scope === 'usuario' ? `Reporte de rendimiento — ${yyyyMM}` : `Reporte departamento — ${yyyyMM}`;

  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(11);

  const stats = buildStatsForMonth(yyyyMM, scope === 'usuario' ? email : '');
  const rows = stats.map((s, i) => ([
    i + 1, s.nombre, s.rol, s.sede || '-', s.entradas, s.puntos.toFixed(2),
    `${s.porcentaje.toFixed(0)}%`, (s.porcentaje >= 100 ? Number(configuracion().bonoMensual || 0) : 0).toFixed(2)
  ]));

  doc.text(`Meta diaria: ${configuracion().puntosPorDia} pts — Bono mensual: ${fmtEUR.format(Number(configuracion().bonoMensual || 0))}`, 40, 62);

  // @ts-ignore autotable está cargado en global por script
  doc.autoTable({
    startY: 80,
    head: [['Pos', 'Usuario', 'Rol', 'Sede', 'Entradas', 'Puntos', '% Meta', 'Bono (€)']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 }
  });

  const suffix = scope === 'usuario' ? `${(email || '').replace(/@.*/, '')}_` : '';
  doc.save(`reporte_${suffix}${yyyyMM}.pdf`);
}

/**
 * Enlaza eventos del modal de exportación y botones rápidos.
 */
export function bindExportEvents() {
  // Botón "Exportar" del panel superior
  const openExport = document.getElementById('openExportModal');
  if (openExport) {
    openExport.addEventListener('click', () => {
      const month = /** @type {HTMLInputElement} */ (document.getElementById('supervisorMonth'))?.value || new Date().toISOString().slice(0, 7);
      /** @type {HTMLInputElement} */ (document.getElementById('exportMonth')).value = month;

      /** @type {HTMLSelectElement} */ (document.getElementById('exportScope')).value = 'departamento';
      document.getElementById('exportUserWrap')?.classList.add('d-none');

      const modal = document.getElementById('exportModal');
      if (modal) new bootstrap.Modal(modal).show();
    });
  }

  // Cambia alcance y muestra selector de usuario si aplica
  const scopeSel = document.getElementById('exportScope');
  if (scopeSel) {
    scopeSel.addEventListener('change', (e) => {
      const val = /** @type {HTMLSelectElement} */ (e.target).value;
      document.getElementById('exportUserWrap')?.classList.toggle('d-none', val !== 'usuario');
    });
  }

  // Botones de exportación del modal
  const btnPdf = document.getElementById('exportPdf');
  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      const m = /** @type {HTMLInputElement} */ (document.getElementById('exportMonth')).value;
      const scope = /** @type {HTMLSelectElement} */ (document.getElementById('exportScope')).value;
      const email = scope === 'usuario' ? /** @type {HTMLSelectElement} */ (document.getElementById('exportUser')).value : '';
      exportPDFReport(m, /** @type any */ (scope), email);
    });
  }

  const btnCsv = document.getElementById('exportCsv');
  if (btnCsv) {
    btnCsv.addEventListener('click', () => {
      const m = /** @type {HTMLInputElement} */ (document.getElementById('exportMonth')).value;
      const scope = /** @type {HTMLSelectElement} */ (document.getElementById('exportScope')).value;
      const email = scope === 'usuario' ? /** @type {HTMLSelectElement} */ (document.getElementById('exportUser')).value : '';
      const stats = buildStatsForMonth(m, email);
      exportRankingCSV(stats, m);
    });
  }

  // Botón CSV rápido del panel
  const quickCsv = document.getElementById('exportRankingCsv');
  if (quickCsv) {
    quickCsv.addEventListener('click', () => {
      const yyyyMM = /** @type {HTMLInputElement} */ (document.getElementById('supervisorMonth'))?.value || new Date().toISOString().slice(0, 7);
      const emailSel = /** @type {HTMLSelectElement} */ (document.getElementById('supervisorUser'))?.value || '';
      const stats = buildStatsForMonth(yyyyMM, emailSel || '');
      exportRankingCSV(stats, yyyyMM);
    });
  }
}
