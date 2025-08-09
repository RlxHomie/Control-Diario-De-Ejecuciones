/**
 * Módulo de historial de entradas
 * @module history
 */

import { entries, currentUser, currentUserData, tiposEscritos } from './data.js';
import { esc } from './utils.js';

/**
 * Renderiza la tabla de historial con filtros.
 */
export function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const fromDate = /** @type {HTMLInputElement} */ (document.getElementById('filterDateFrom'))?.value || '';
  const toDate = /** @type {HTMLInputElement} */ (document.getElementById('filterDateTo'))?.value || '';
  const filterTypeId = /** @type {HTMLSelectElement} */ (document.getElementById('filterType'))?.value || '';

  const myEmail = (currentUser()?.username || '').toLowerCase();
  const isSupervisor = currentUserData()?.rol === 'supervisor';

  // Filtrar entradas
  let filtered = entries().filter(e => {
    // Si no es supervisor, solo sus propias entradas
    if (!isSupervisor && e.email !== myEmail) return false;
    
    // Filtros de fecha
    if (fromDate && e.fecha < fromDate) return false;
    if (toDate && e.fecha > toDate) return false;
    
    // Filtro de tipo
    if (filterTypeId && e.tipoId !== filterTypeId) return false;
    
    return true;
  });

  // Ordenar por fecha descendente
  filtered.sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center subtle">No hay entradas que mostrar</td></tr>';
    return;
  }

  const tipoMap = new Map(tiposEscritos().map(t => [t.id, t]));

  tbody.innerHTML = filtered.map(e => {
    const tipo = tipoMap.get(e.tipoId);
    const canEdit = e.email === myEmail || isSupervisor;
    
    return `
      <tr>
        <td>${esc(e.fecha)}</td>
        <td>${esc(e.expediente)}</td>
        <td>${esc(tipo?.nombre || e.tipoId)}</td>
        <td><span class="badge bg-success">${e.puntos} pts</span></td>
        <td>${e.comentario ? esc(e.comentario) : '-'}</td>
        <td>
          ${canEdit ? `
            <button class="btn btn-sm btn-primary me-1" data-action="edit-entry" data-id="${e.id}">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-sm btn-danger" data-action="delete-entry" data-id="${e.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Renderiza el log de auditoría (solo supervisores).
 */
export function renderAuditLog() {
  const tbody = document.getElementById('auditLogTable');
  if (!tbody) return;

  // Solo supervisores pueden ver el log
  if (currentUserData()?.rol !== 'supervisor') {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center subtle">Sin permisos para ver el historial</td></tr>';
    return;
  }

  // Por ahora, mostrar un placeholder
  // En una implementación completa, aquí se mostrarían los cambios registrados
  tbody.innerHTML = '<tr><td colspan="4" class="text-center subtle">Función en desarrollo</td></tr>';
}

/**
 * Enlaza los eventos del módulo de historial.
 */
export function bindHistoryEvents() {
  // Botón de aplicar filtros
  const applyBtn = document.getElementById('applyFilters');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      renderHistoryTable();
    });
  }

  // Eventos de refresco
  document.addEventListener('history:refresh', () => {
    renderHistoryTable();
  });

  document.addEventListener('auditlog:refresh', () => {
    renderAuditLog();
  });
}
