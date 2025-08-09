/**
 * Dashboard principal (KPIs, gráficos y últimas entradas).
 * @module dashboard
 */

import { state, getUserByEmail, getTipoMap } from './data.js';
import { fmtEUR, esc, getWorkingDaysYYYYMM, getRelativeTodayDay } from './utils.js';
import { initCharts, dailyPointsChart, renderGauge } from './charts.js';

/** Renderiza dashboard para el mes seleccionado. */
export function loadDashboard() {
  const yyyyMM = document.getElementById('monthSelector').value;
  const tipoMap = getTipoMap();
  const myEmail = state.currentUser.username.toLowerCase();
  const myUser = getUserByEmail(myEmail) || state.currentUserData;

  const myEntries = state.entries.filter(e => e.email === myEmail && e.fecha.startsWith(yyyyMM));
  const workDays = getWorkingDaysYYYYMM(yyyyMM, state.festivos, myUser?.sede, myUser?.vacaciones);

  const dailyPoints = {};
  myEntries.forEach(e => {
    const day = parseInt(e.fecha.split('-')[2], 10);
    dailyPoints[day] = (dailyPoints[day] || 0) + (e.puntos || tipoMap.get(e.tipoId)?.puntuacion || 0);
  });

  const totalPoints = Object.values(dailyPoints).reduce((a, b) => a + b, 0);
  const required = workDays.length * state.configuracion.puntosPorDia;
  const perc = required > 0 ? (totalPoints / required * 100) : 0;
  const bonus = perc >= 100 ? state.configuracion.bonoMensual : 0;

  // KPIs
  document.getElementById('monthPoints').textContent = totalPoints.toFixed(2);
  document.getElementById('workDays').textContent = workDays.length;
  document.getElementById('goalPercentage').textContent = `${perc.toFixed(1)}%`;
  document.getElementById('monthlyBonus').textContent = fmtEUR.format(bonus);

  // Estado + barra
  const bar = document.getElementById('progressBar');
  const val = Math.max(0, Math.min(100, Math.round(perc)));
  bar.style.width = `${val}%`;
  bar.setAttribute('aria-valuenow', String(val));
  bar.setAttribute('aria-valuetext', `${val}% de la meta del mes`);

  const badge = document.getElementById('stateBadge');
  if (val >= 100) {
    badge.textContent = 'Meta alcanzada'; badge.className = 'badge badge-chip bg-success';
    document.getElementById('progressMessage').textContent = '¡Excelente! Has alcanzado la meta del mes.';
  } else if (val >= 75) {
    badge.textContent = 'En buen camino'; badge.className = 'badge badge-chip bg-warning';
    document.getElementById('progressMessage').textContent = 'Vas bien, un empujón final y llegas.';
  } else {
    badge.textContent = 'Baja'; badge.className = 'badge badge-chip bg-danger';
    document.getElementById('progressMessage').textContent = 'Aún lejos de la meta. Revisa tu planificación.';
  }

  renderGauge(perc);

  // Chart diario
  const labels = workDays.map(d => String(d));
  const data = workDays.map(d => (dailyPoints[d] || 0));
  dailyPointsChart.data.labels = labels;
  dailyPointsChart.data.datasets[0].data = data;
  dailyPointsChart.data.datasets[1].data = labels.map(() => state.configuracion.puntosPorDia);
  dailyPointsChart.update('none');

  // Chips día a día
  const todayRel = getRelativeTodayDay(yyyyMM);
  const chips = workDays.map(d => {
    const pts = dailyPoints[d] || 0;
    const ok = pts >= state.configuracion.puntosPorDia;
    const isPastOrToday = todayRel === null ? true : (d <= todayRel);
    const cls = isPastOrToday ? (ok ? 'bg-success' : 'bg-danger') : 'bg-secondary';
    return `<span class="badge ${cls} badge-chip me-1 mb-1">Día ${d}: ${pts.toFixed(2)}/${state.configuracion.puntosPorDia}</span>`;
  }).join("");
  document.getElementById('dailyStatus').innerHTML = chips;

  // Entradas recientes
  const recent = myEntries.slice(-10).reverse();
  document.getElementById('recentEntries').innerHTML = recent.length ? recent.map(e => {
    const tipo = tipoMap.get(e.tipoId);
    return `<div class="d-flex justify-content-between align-items-center p-2 border-bottom">
      <div>
        <strong>${esc(tipo?.nombre || e.tipoId)}</strong><br>
        <small class="subtle">${esc(e.expediente)} — ${esc(e.fecha)}</small>
        ${e.comentario ? `<br><small>${esc(e.comentario)}</small>` : ""}
      </div>
      <span class="badge bg-success">${(e.puntos || tipo?.puntuacion || 0)} pts</span>
    </div>`;
  }).join("") : '<div class="subtle text-center">Sin registros este mes</div>';
}

/** Setup inicial de gráficos del dashboard. */
export function setupDashboardCharts() {
  initCharts();
}
