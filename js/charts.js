/**
 * Gestión de gráficos Chart.js
 * @module charts
 */

export let dailyPointsChart = null;
export let gaugeChart = null;

/** Plugin texto centrado en doughnut */
const centerText = {
  id: 'centerText',
  afterDraw(chart, args, opts) {
    const text = opts?.text || '';
    if (!text) return;
    const { ctx, chartArea: { top, bottom, left, right } } = chart;
    ctx.save();
    ctx.font = '600 20px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, (left + right) / 2, (top + bottom) / 2);
    ctx.restore();
  }
};
Chart.register(centerText);

/** Inicializa gráficos (recrea si existen). */
export function initCharts() {
  const ctxDaily = document.getElementById('dailyPointsChart').getContext('2d');
  const ctxGauge = document.getElementById('gaugeChart').getContext('2d');

  if (dailyPointsChart) dailyPointsChart.destroy();
  if (gaugeChart) gaugeChart.destroy();

  const grad = ctxDaily.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, 'rgba(76,146,255,.55)');
  grad.addColorStop(1, 'rgba(76,146,255,.18)');

  dailyPointsChart = new Chart(ctxDaily, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Puntos diarios', data: [], backgroundColor: grad, borderWidth: 0, borderRadius: 8, maxBarThickness: 28 },
        { label: 'Meta diaria', data: [], type: 'line', borderColor: 'rgba(239,68,68,.95)', backgroundColor: 'rgba(239,68,68,.08)', borderWidth: 2, pointRadius: 0, tension: .35, fill: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label(ctx) { const v = ctx.parsed.y ?? 0; return `${ctx.dataset.label}: ${v.toFixed(2)} pts`; } } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(31,41,55,.08)' } },
        x: { grid: { display: false } }
      }
    }
  });

  gaugeChart = new Chart(ctxGauge, {
    type: 'doughnut',
    data: { labels: ['Progreso', 'Pendiente'], datasets: [{ data: [0, 100], cutout: '72%', backgroundColor: ['#4c92ff', '#e9eef7'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false }, centerText: { text: '0%' } } }
  });
}

/** Actualiza gauge (0–100). */
export function renderGauge(percentage) {
  const val = Math.max(0, Math.min(100, percentage));
  gaugeChart.data.datasets[0].data = [val, 100 - val];
  gaugeChart.options.plugins.centerText.text = `${val.toFixed(0)}%`;
  gaugeChart.update('none');

  const gc = document.getElementById('gaugeChart');
  gc.setAttribute('aria-label', `Indicador de progreso general: ${val.toFixed(0)}%`);
}
