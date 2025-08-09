// js/app.js
// Inicialización y coordinación general de la aplicación

import { initMSAL, login, logout, getAccounts } from './auth.js';
import { loadAllData, addRow } from './api.js';
import {
  currentUser, setCurrentUser, currentUserData, setCurrentUserData,
  entries, setEntries, users, setUsers, tiposEscritos, setTiposEscritos,
  configuracion, setConfiguracion, festivos, setFestivos, historialCambios, setHistorialCambios,
  rowIndexMaps, getUserByEmail
} from './data.js';
import { toast, showLoading } from './utils.js';
import { initCharts } from './charts.js';
import { loadDashboard } from './dashboard.js';
import { bindFormEvents } from './forms.js';
import { bindSupervisorEvents, loadSupervisorDashboard, displayEscritoTypes, showEscritoModal } from './supervisor.js';
import { bindExportEvents } from './export.js';
import { bindHistoryEvents } from './history.js';
import { EXCEL } from './config.js';

/**
 * Rellena selects de tipos y usuarios (supervisor/export).
 */
function populateTipoSelects() {
  const actives = tiposEscritos().filter(t => t.activo);
  const selects = [
    /** @type {HTMLSelectElement} */ (document.getElementById('tipoEscrito')),
    /** @type {HTMLSelectElement} */ (document.getElementById('editTipoEscrito')),
    /** @type {HTMLSelectElement} */ (document.getElementById('filterType'))
  ];

  selects.forEach((sel, i) => {
    if (!sel) return;
    sel.innerHTML = i === 2 ? '<option value="">Todos</option>' : '<option value="">Seleccione un tipo…</option>';
    actives.forEach(t => {
      const opt = new Option(`${t.nombre} (${t.puntuacion} pts)`, t.id);
      sel.add(opt.cloneNode(true));
    });
  });
}

function populateUsersForSupervisor() {
  const sel = /** @type {HTMLSelectElement} */ (document.getElementById('supervisorUser'));
  const sel2 = /** @type {HTMLSelectElement} */ (document.getElementById('exportUser'));
  if (!sel || !sel2) return;
  sel.innerHTML = '<option value="">Todos</option>';
  sel2.innerHTML = '';
  users().forEach(u => {
    sel.add(new Option(u.nombre, u.email));
    sel2.add(new Option(u.nombre, u.email));
  });
}

/**
 * Controla la navegación por secciones y refrescos asociados.
 * @param {"dashboard"|"register"|"history"|"supervisor"|"config"} sec
 */
export function showSection(sec) {
  document.querySelectorAll('.content-section').forEach(s => (s).setAttribute('style', 'display:none'));
  const target = document.getElementById(`${sec}Section`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.nav-link[data-section]').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-section="${sec}"]`);
  if (link) link.classList.add('active');

  if (sec === 'dashboard') loadDashboard();
  if (sec === 'history') document.dispatchEvent(new CustomEvent('history:refresh'));
  if (sec === 'supervisor') loadSupervisorDashboard();
  if (sec === 'config') {
    displayEscritoTypes();
    // precargar formulario de bonos
    /** @type {HTMLInputElement} */ (document.getElementById('puntosPorDia')).value = String(configuracion().puntosPorDia || 2);
    /** @type {HTMLInputElement} */ (document.getElementById('bonoMensual')).value = String(configuracion().bonoMensual || 300);
    /** @type {HTMLInputElement} */ (document.getElementById('fechaVigencia')).value = configuracion().fechaVigencia || new Date().toISOString().slice(0, 10);
    document.dispatchEvent(new CustomEvent('auditlog:refresh'));
  }
}

/**
 * Muestra login o app y prepara datos iniciales.
 */
async function showMainApp() {
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  if (!loginScreen || !mainApp) return;

  loginScreen.style.display = 'none';
  mainApp.style.display = 'block';

  showLoading(true);
  try {
    // Carga inicial desde Graph/Excel ($batch).
    const initial = await loadAllData();

    // Volcar al store
    if (initial?.users) setUsers(initial.users);
    if (initial?.tiposEscritos) setTiposEscritos(initial.tiposEscritos);
    if (initial?.configuracion) setConfiguracion(initial.configuracion);
    if (initial?.entries) setEntries(initial.entries);
    if (initial?.historialCambios) setHistorialCambios(initial.historialCambios);
    if (initial?.festivos) setFestivos(initial.festivos);
    if (initial?.rowIndexMaps) Object.assign(rowIndexMaps(), initial.rowIndexMaps);

    // currentUserData (auto-alta si no existe)
    const email = (currentUser()?.username || '').toLowerCase();
    let cud = getUserByEmail(email);
    if (!cud) {
      const newUser = {
        id: Date.now().toString(),
        nombre: currentUser()?.name || email.split('@')[0],
        email,
        rol: 'usuario', sede: '', vacaciones: ''
      };
      await addRow(EXCEL.tables.Usuarios, [newUser.id, newUser.nombre, newUser.email, newUser.rol, newUser.sede, newUser.vacaciones]);
      setUsers([...users(), newUser]);
      cud = newUser;
    }
    setCurrentUserData(cud);

    // UI inicial
    const roleBadge = document.getElementById('userRoleBadge');
    if (roleBadge) roleBadge.innerHTML = cud.rol === 'supervisor' ? '<span class="supervisor-badge">SUPERVISOR</span>' : '';
    document.querySelectorAll('.supervisor-only').forEach(el => (el).setAttribute('style', `display:${cud.rol === 'supervisor' ? 'block' : 'none'}`));

    // Prefills
    const todayMonth = new Date().toISOString().slice(0, 7);
    const todayDate = new Date().toISOString().slice(0, 10);
    /** @type {HTMLInputElement} */ (document.getElementById('monthSelector')).value = todayMonth;
    /** @type {HTMLInputElement} */ (document.getElementById('supervisorMonth')).value = todayMonth;
    /** @type {HTMLInputElement} */ (document.getElementById('fecha')).value = todayDate;

    // Selects
    populateTipoSelects();
    populateUsersForSupervisor();

    // Gráficos + primer render
    initCharts();
    loadDashboard();
  } catch (err) {
    console.error(err);
    toast('Error cargando datos', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Enlaza navegación y otros listeners globales.
 */
function bindGlobalEvents() {
  // Tabs/secciones
  document.querySelectorAll('.nav-link[data-section]').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const sec = /** @type {HTMLElement} */ (ev.currentTarget).getAttribute('data-section');
      if (sec) showSection(/** @type any */ (sec));
    });
  });

  // Selector de mes del dashboard
  const monthSel = document.getElementById('monthSelector');
  if (monthSel) monthSel.addEventListener('change', loadDashboard);

  // Logout
  const logoutBtn = document.getElementById('logoutButton');
  if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });

  // Login (pantalla)
  const loginBtn = document.getElementById('loginButton');
  if (loginBtn) loginBtn.addEventListener('click', (e) => { e.preventDefault(); login(); });

  // Eventos transversales para refrescar vistas
  document.addEventListener('entries:changed', () => {
    const dashVisible = document.getElementById('dashboardSection')?.style.display !== 'none';
    const historyVisible = document.getElementById('historySection')?.style.display !== 'none';
    if (dashVisible) loadDashboard();
    if (historyVisible) document.dispatchEvent(new CustomEvent('history:refresh'));
  });

  document.addEventListener('users:changed', () => {
    populateUsersForSupervisor();
    const supVisible = document.getElementById('supervisorSection')?.style.display !== 'none';
    if (supVisible) loadSupervisorDashboard();
  });

  document.addEventListener('types:changed', () => {
    populateTipoSelects();
    const cfgVisible = document.getElementById('configSection')?.style.display !== 'none';
    if (cfgVisible) displayEscritoTypes();
  });

  document.addEventListener('supervisor:refresh', () => loadSupervisorDashboard());
}

/**
 * Autotest de integraciones clave (opcional pero útil en prod).
 * Lanza un Toast si detecta algo crítico.
 */
function selfTest() {
  const must = (cond, msg) => { if (!cond) throw new Error('[SelfTest] ' + msg); };
  try {
    must(typeof bootstrap !== 'undefined', 'Bootstrap no disponible');
    must(typeof Chart !== 'undefined', 'Chart.js no disponible');
    must(window.jspdf && (window.jspdf.jsPDF || window.jspdf.default), 'jsPDF no disponible');
    console.info('%cSelfTest OK: librerías cargadas', 'color:#16a34a;font-weight:700');
  } catch (err) {
    console.error(err);
    (window.Toastify ? Toastify({
      text: 'Fallo de integraciones: ' + err.message, duration: 5000, gravity: 'top', position: 'right', style: { background: '#ef4444' }
    }).showToast() : alert('Fallo de integraciones: ' + err.message));
  }
}

/**
 * Punto de entrada de la app.
 * - En producción: MSAL real con redirect
 */
export async function bootstrap() {
  await initMSAL();

  // ¿Hay cuenta en caché?
  const accounts = getAccounts();
  if (!accounts || (Array.isArray(accounts) && accounts.length === 0)) {
    // Mostrar login; showMainApp se llamará al volver del redirect
    document.getElementById('loginScreen')?.setAttribute('style', 'display:block');
    document.getElementById('mainApp')?.setAttribute('style', 'display:none');
  } else {
    setCurrentUser(accounts[0]);
    await showMainApp();
  }

  // Enlaces de módulos
  bindGlobalEvents();
  bindFormEvents();
  bindSupervisorEvents();
  bindExportEvents();
  bindHistoryEvents();

  // Render inicial "seguro"
  showSection('dashboard');

  // Autotest rápido
  selfTest();
}

// Exponer helpers globales para compatibilidad con onclick inline
import { editEntry, deleteEntry, saveEdit } from './forms.js';
import { editUser, saveUserData, saveEscritoType, editEscritoType, deleteEscritoType } from './supervisor.js';
Object.assign(window, {
  editEntry, deleteEntry, saveEdit,
  editUser, saveUserData, saveEscritoType, editEscritoType, deleteEscritoType
});

// Auto arranque cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  if (!window.__APP_BOOTSTRAPPED__) {
    window.__APP_BOOTSTRAPPED__ = true;
    bootstrap();
  }
});
