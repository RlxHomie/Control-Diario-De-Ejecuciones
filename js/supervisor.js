// js/supervisor.js
// Panel de supervisión: ranking, gestión de usuarios y tipos

import { EXCEL } from './config.js';
import { replaceRow, deleteRow, addRow } from './api.js';
import {
  entries, users, tiposEscritos, configuracion, rowIndexMaps,
  currentUserData,
  setUsers, setTiposEscritos
} from './data.js';
import { getUserByEmail } from './data.js';

/**
 * Calcula el ranking y métricas para un mes dado y (opcional) un email.
 * @param {string} yyyyMM
 * @param {string} [emailFilter]
 */
export function buildStatsForMonth(yyyyMM, emailFilter = '') {
  const tipoMap = new Map(tiposEscritos().map(t => [t.id, t]));
  const byUser = new Map(); // email -> stats

  // base: todos los usuarios
  users().forEach(u => byUser.set(u.email, {
    nombre: u.nombre, email: u.email, rol: u.rol, sede: u.sede,
    puntos: 0, entradas: 0, dias: 0, porcentaje: 0
  }));

  // entradas del mes (y filtro por usuario si aplica)
  entries()
    .filter(e => e.fecha.startsWith(yyyyMM) && (!emailFilter || e.email === emailFilter))
    .forEach(e => {
      const st = byUser.get(e.email);
      if (!st) return;
      const pts = Number(e.puntos) || Number(tipoMap.get(e.tipoId)?.puntuacion) || 0;
      st.puntos += pts;
      st.entradas += 1;
    });

  // días laborables y % meta
  Array.from(byUser.values()).forEach(st => {
    if (emailFilter && st.email !== emailFilter) return;
    const u = getUserByEmail(st.email);
    const dias = getWorkingDaysYYYYMM(yyyyMM, u?.sede, u?.vacaciones).length;
    st.dias = dias;
    const req = dias * Number(configuracion().puntosPorDia || 0);
    st.porcentaje = req > 0 ? (st.puntos / req * 100) : 0;
  });

  const list = Array.from(byUser.values())
    .filter(s => !emailFilter || s.email === emailFilter)
    .sort((a, b) => b.puntos - a.puntos);

  return list;
}

/**
 * Renderiza la tabla de ranking.
 * @param {ReturnType<typeof buildStatsForMonth>} stats
 */
export function renderRanking(stats) {
  const container = document.getElementById('rankingTable');
  if (!container) return;

  if (!stats.length) {
    container.innerHTML = '<div class="subtle text-center">Sin datos</div>';
    return;
  }

  let html = `
  <div class="table-responsive">
    <table class="table align-middle table-hover">
      <thead>
        <tr><th>Pos.</th><th>Usuario</th><th>Puntos</th><th>Entradas</th><th>% Meta</th><th>Bono</th></tr>
      </thead>
      <tbody>
  `;

  stats.forEach((s, i) => {
    const pos = i + 1;
    const medal = pos === 1 ? '<i class="fa-solid fa-trophy text-warning rank-medal"></i>'
      : (pos <= 3 ? '<i class="fa-solid fa-medal text-secondary rank-medal"></i>' : '');
    const bonus = s.porcentaje >= 100 ? Number(configuracion().bonoMensual || 0) : 0;
    html += `
      <tr>
        <td>${medal} ${pos}</td>
        <td>${esc(s.nombre)} ${s.rol === 'supervisor' ? '<span class="supervisor-badge">SUP</span>' : ''}</td>
        <td><span class="badge bg-primary">${s.puntos.toFixed(2)}</span></td>
        <td>${s.entradas}</td>
        <td>
          <div class="progress" style="width:120px">
            <div class="progress-bar ${s.porcentaje >= 100 ? 'bg-success' : 'bg-warning'}" style="width:${Math.min(s.porcentaje, 100)}%">
              ${s.porcentaje.toFixed(0)}%
            </div>
          </div>
        </td>
        <td>${fmtEUR.format(bonus)}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

/**
 * Renderiza la tabla de gestión de usuarios.
 */
export function renderUsersManagement() {
  const tbody = document.getElementById('usersManagementTable');
  if (!tbody) return;

  tbody.innerHTML = users().map(u => `
    <tr>
      <td>${esc(u.nombre)}</td>
      <td>${esc(u.email)}</td>
      <td>${esc(u.sede || '-')}</td>
      <td><span class="badge ${u.rol === 'supervisor' ? 'bg-warning' : 'bg-secondary'}">${u.rol}</span></td>
      <td>${u.vacaciones ? u.vacaciones.split(',').filter(Boolean).length : 0} días</td>
      <td><button class="btn btn-sm btn-primary" data-action="edit-user" data-id="${u.id}"><i class="fa-solid fa-pen"></i> Editar</button></td>
    </tr>
  `).join('');
}

/**
 * Abre modal de edición de usuario (solo supervisor).
 * @param {string} userId
 */
export function editUser(userId) {
  if (currentUserData()?.rol !== 'supervisor') {
    toast('Sin permisos', 'error');
    return;
  }
  const u = users().find(x => x.id === userId);
  if (!u) return;

  /** @type {HTMLInputElement} */
  (document.getElementById('userId')).value = u.id;
  /** @type {HTMLInputElement} */
  (document.getElementById('userNombre')).value = u.nombre;
  /** @type {HTMLInputElement} */
  (document.getElementById('userEmail')).value = u.email;
  /** @type {HTMLSelectElement} */
  (document.getElementById('userRol')).value = u.rol;
  /** @type {HTMLInputElement} */
  (document.getElementById('userSede')).value = u.sede || '';
  /** @type {HTMLTextAreaElement} */
  (document.getElementById('userVacaciones')).value = u.vacaciones || '';

  const modal = document.getElementById('editUserModal');
  if (modal) new bootstrap.Modal(modal).show();
}

/**
 * Persiste cambios de usuario.
 */
export async function saveUserData() {
  const id = /** @type {HTMLInputElement} */ (document.getElementById('userId')).value;
  const uIdx = users().findIndex(u => u.id === id);
  if (uIdx < 0) return;

  const rol = /** @type {HTMLSelectElement} */ (document.getElementById('userRol')).value;
  const sede = /** @type {HTMLInputElement} */ (document.getElementById('userSede')).value.trim();
  const vacaciones = /** @type {HTMLTextAreaElement} */ (document.getElementById('userVacaciones')).value.trim();

  try {
    showLoading(true);
    const rowIndex = rowIndexMaps().Usuarios.get(id);
    const u = { ...users()[uIdx], rol, sede, vacaciones };
    await replaceRow(EXCEL.tables.Usuarios, rowIndex, [u.id, u.nombre, u.email, u.rol, u.sede, u.vacaciones]);

    const newUsers = [...users()];
    newUsers[uIdx] = u;
    setUsers(newUsers);

    const modal = document.getElementById('editUserModal');
    if (modal) bootstrap.Modal.getInstance(modal)?.hide();

    toast('Usuario actualizado', 'success');
    document.dispatchEvent(new CustomEvent('users:changed'));
  } catch (err) {
    console.error(err);
    toast('Error al actualizar usuario', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Pinta tabla de tipos de escritos.
 */
export function displayEscritoTypes() {
  const tbody = document.getElementById('escritosTypesTable');
  if (!tbody) return;

  tbody.innerHTML = tiposEscritos().map(t => {
    const inUse = entries().some(e => e.tipoId === t.id);
    return `
      <tr>
        <td>${esc(t.id)}</td>
        <td>${esc(t.nombre)}</td>
        <td>${t.puntuacion}</td>
        <td><span class="badge ${t.activo ? 'bg-success' : 'bg-danger'}">${t.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn btn-sm btn-primary me-1" data-action="edit-type" data-id="${t.id}">
            <i class="fa-solid fa-pen"></i>
          </button>
          ${!inUse ? `<button class="btn btn-sm btn-danger" data-action="delete-type" data-id="${t.id}">
            <i class="fa-solid fa-trash"></i>
          </button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Abre modal para crear/editar tipo de escrito.
 * @param {string|null} id
 */
export function showEscritoModal(id = null) {
  if (currentUserData()?.rol !== 'supervisor') {
    toast('Sin permisos', 'error');
    return;
  }
  const title = document.getElementById('editEscritoTitle');

  if (id) {
    const t = tiposEscritos().find(x => x.id === id);
    if (!t) return;
    if (title) title.textContent = 'Editar tipo de escrito';
    /** @type {HTMLInputElement} */
    (document.getElementById('escritoId')).value = t.id;
    /** @type {HTMLInputElement} */
    (document.getElementById('escritoNombre')).value = t.nombre;
    /** @type {HTMLInputElement} */
    (document.getElementById('escritoPuntuacion')).value = String(t.puntuacion);
    /** @type {HTMLInputElement} */
    (document.getElementById('escritoActivo')).checked = !!t.activo;
  } else {
    if (title) title.textContent = 'Nuevo tipo de escrito';
    /** @type {HTMLInputElement} */ (document.getElementById('escritoId')).value = '';
    /** @type {HTMLInputElement} */ (document.getElementById('escritoNombre')).value = '';
    /** @type {HTMLInputElement} */ (document.getElementById('escritoPuntuacion')).value = '';
    /** @type {HTMLInputElement} */ (document.getElementById('escritoActivo')).checked = true;
  }

  const modal = document.getElementById('editEscritoModal');
  if (modal) new bootstrap.Modal(modal).show();
}

export const editEscritoType = (id) => showEscritoModal(id);

/**
 * Guarda tipo de escrito (crea o actualiza).
 */
export async function saveEscritoType() {
  const id = /** @type {HTMLInputElement} */ (document.getElementById('escritoId')).value || Date.now().toString();
  const nombre = /** @type {HTMLInputElement} */ (document.getElementById('escritoNombre')).value.trim();
  const puntuacion = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('escritoPuntuacion')).value);
  const activo = /** @type {HTMLInputElement} */ (document.getElementById('escritoActivo')).checked;

  if (!nombre || Number.isNaN(puntuacion)) {
    toast('Completa los campos', 'warning');
    return;
  }

  try {
    showLoading(true);
    const tipos = tiposEscritos();
    const idx = tipos.findIndex(t => t.id === id);

    if (idx >= 0) {
      const rowIndex = rowIndexMaps().Tipos.get(id);
      await replaceRow(EXCEL.tables.Tipos, rowIndex, [id, nombre, puntuacion, activo]);
      const copy = [...tipos];
      copy[idx] = { id, nombre, puntuacion, activo };
      setTiposEscritos(copy);
    } else {
      await addRow(EXCEL.tables.Tipos, [id, nombre, puntuacion, activo]);
      const copy = [...tipos, { id, nombre, puntuacion, activo }];
      setTiposEscritos(copy);
    }

    const modal = document.getElementById('editEscritoModal');
    if (modal) bootstrap.Modal.getInstance(modal)?.hide();

    toast('Tipo guardado', 'success');
    document.dispatchEvent(new CustomEvent('types:changed'));
  } catch (err) {
    console.error(err);
    toast('Error guardando tipo', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Elimina tipo (si no está en uso).
 * @param {string} id
 */
export async function deleteEscritoType(id) {
  const t = tiposEscritos().find(x => x.id === id);
  if (!t) return;

  if (entries().some(e => e.tipoId === id)) {
    toast('Está en uso, desactívalo en su lugar', 'warning');
    return;
  }
  if (!confirm(`¿Eliminar "${t.nombre}"?`)) return;

  try {
    showLoading(true);
    const rowIndex = rowIndexMaps().Tipos.get(id);
    await deleteRow(EXCEL.tables.Tipos, rowIndex);

    setTiposEscritos(tiposEscritos().filter(x => x.id !== id));
    toast('Tipo eliminado', 'success');
    document.dispatchEvent(new CustomEvent('types:changed'));
  } catch (err) {
    console.error(err);
    toast('Error al eliminar tipo', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Enlaza eventos del panel de supervisor.
 */
export function bindSupervisorEvents() {
  const filterBtn = document.getElementById('supervisorFilter');
  if (filterBtn) filterBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('supervisor:refresh'));
  });

  const addTypeBtn = document.getElementById('addEscritoType');
  if (addTypeBtn) addTypeBtn.addEventListener('click', () => showEscritoModal());

  const saveTypeBtn = document.getElementById('saveEscritoType');
  if (saveTypeBtn) saveTypeBtn.addEventListener('click', saveEscritoType);

  const saveUserBtn = document.getElementById('saveUser');
  if (saveUserBtn) saveUserBtn.addEventListener('click', saveUserData);

  // Delegación de clicks dentro de la sección de supervisor
  document.addEventListener('click', (ev) => {
    const el = /** @type {HTMLElement} */ (ev.target instanceof HTMLElement ? ev.target.closest('[data-action]') : null);
    if (!el) return;
    if (el.dataset.action === 'edit-user' && el.dataset.id) editUser(el.dataset.id);
    if (el.dataset.action === 'edit-type' && el.dataset.id) showEscritoModal(el.dataset.id);
    if (el.dataset.action === 'delete-type' && el.dataset.id) deleteEscritoType(el.dataset.id);
  });
}

/**
 * Refresca el panel de supervisión: ranking + gestión.
 */
export function loadSupervisorDashboard() {
  const yyyyMM = /** @type {HTMLInputElement} */ (document.getElementById('supervisorMonth'))?.value || new Date().toISOString().slice(0, 7);
  const selectedEmail = /** @type {HTMLSelectElement} */ (document.getElementById('supervisorUser'))?.value || '';
  const stats = buildStatsForMonth(yyyyMM, selectedEmail || '');
  renderRanking(stats);
  renderUsersManagement();
}

