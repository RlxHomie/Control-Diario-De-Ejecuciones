// js/forms.js
// Manejo de formularios (registro, edición) y helpers asociados

import { EXCEL } from './config.js';
import { addRow, replaceRow, deleteRow, getTableRows } from './api.js';
import {
  entries, users, tiposEscritos, /* configuracion <- eliminado */,
  rowIndexMaps, currentUser, currentUserData, setEntries
} from './data.js';
import {
  esc, fmtEUR, parseDateCell, showLoading, toast,
  getWorkingDaysYYYYMM, getRelativeTodayDay, monthOf, getUserByEmail
} from './utils.js';

/** @typedef {{id:string, usuario:string, email:string, fecha:string, expediente:string, tipoId:string, puntos:number, comentario:string}} Entry */

/**
 * Reconstruye el mapa id->rowIndex para una tabla de Excel.
 * Úsalo tras add/delete para mantener consistencia de índices.
 * @param {string} tableName
 * @param {Map<string, number>} map
 */
export async function refreshRowIndex(tableName, map) {
  map.clear();
  const rows = await getTableRows(tableName);
  rows.forEach(r => {
    const id = String(r.values[0][0] || '');
    if (id) map.set(id, r.index);
  });
}

/**
 * Comprueba si existe expediente duplicado para el usuario/mes.
 * @param {string} email
 * @param {string} yyyyMM
 * @param {string} expediente
 * @param {string|null} [ignoreEntryId]
 * @returns {boolean}
 */
export function isExpedienteDuplicateForUserMonth(email, yyyyMM, expediente, ignoreEntryId = null) {
  return entries().some(e =>
    e.email === email.toLowerCase() &&
    e.fecha.startsWith(yyyyMM) &&
    e.expediente === expediente &&
    e.id !== ignoreEntryId
  );
}

/**
 * Pinta el preview de puntos al seleccionar tipo.
 */
export function updatePointsPreview() {
  const sel = /** @type {HTMLSelectElement} */ (document.getElementById('tipoEscrito'));
  const out = document.getElementById('puntosPreview');
  if (!sel || !out) return;
  const t = tiposEscritos().find(x => x.id === sel.value);
  out.textContent = t ? `${t.puntuacion} puntos` : '-';
}

/**
 * Maneja el submit del formulario de registro.
 * Crea una entrada en Excel y actualiza el estado.
 * @param {SubmitEvent} ev
 */
export async function handleRegister(ev) {
  ev.preventDefault();

  const fecha = /** @type {HTMLInputElement} */ (document.getElementById('fecha')).value;
  const expediente = /** @type {HTMLInputElement} */ (document.getElementById('expediente')).value.trim();
  const tipoId = /** @type {HTMLSelectElement} */ (document.getElementById('tipoEscrito')).value;
  const comentario = /** @type {HTMLTextAreaElement} */ (document.getElementById('comentario')).value.trim();

  const myEmail = (currentUser()?.username || '').toLowerCase();
  const yyyyMM = fecha.slice(0, 7);

  if (!fecha || !expediente || !tipoId) {
    toast('Completa los campos obligatorios', 'warning');
    return;
  }

  const expErr = document.getElementById('expedienteError');
  if (isExpedienteDuplicateForUserMonth(myEmail, yyyyMM, expediente)) {
    if (expErr) expErr.textContent = 'Este expediente ya existe este mes para ti.';
    return;
  } else if (expErr) {
    expErr.textContent = '';
  }

  const tipo = tiposEscritos().find(t => t.id === tipoId);
  if (!tipo) {
    toast('Tipo inválido', 'error');
    return;
  }

  /** @type {Entry} */
  const entry = {
    id: Date.now().toString(),
    usuario: (currentUserData()?.nombre || currentUser()?.name || myEmail),
    email: myEmail,
    fecha, expediente, tipoId,
    puntos: Number(tipo.puntuacion) || 0,
    comentario
  };

  try {
    showLoading(true);
    await addRow(EXCEL.tables.Entradas, [
      entry.id, entry.usuario, entry.email, entry.fecha, entry.expediente, entry.tipoId, entry.puntos, entry.comentario
    ]);

    // Releer índices e inyectar en memoria
    await refreshRowIndex(EXCEL.tables.Entradas, rowIndexMaps().Entradas);
    setEntries([...entries(), entry]);

    toast('Entrada registrada', 'success');

    // Reset ligero
    const form = /** @type {HTMLFormElement} */ (document.getElementById('registerForm'));
    if (form) form.reset();
    const f = /** @type {HTMLInputElement} */ (document.getElementById('fecha'));
    if (f) f.value = new Date().toISOString().slice(0, 10);
    const pp = document.getElementById('puntosPreview');
    if (pp) pp.textContent = '-';

    // Dejar que el dashboard/historial se refresquen
    document.dispatchEvent(new CustomEvent('entries:changed'));
  } catch (err) {
    console.error(err);
    toast('Error al guardar', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Abre modal de edición y precarga valores.
 * Control básico de permisos: propio o supervisor.
 * @param {string} id
 */
export function editEntry(id) {
  const e = entries().find(x => x.id === id);
  if (!e) return;

  const myEmail = (currentUser()?.username || '').toLowerCase();
  if (e.email !== myEmail && currentUserData()?.rol !== 'supervisor') {
    toast('Sin permisos', 'error');
    return;
  }

  /** @type {HTMLInputElement} */
  (document.getElementById('editId')).value = e.id;
  /** @type {HTMLInputElement} */
  (document.getElementById('editFecha')).value = e.fecha;
  /** @type {HTMLInputElement} */
  (document.getElementById('editExpediente')).value = e.expediente;
  /** @type {HTMLSelectElement} */
  (document.getElementById('editTipoEscrito')).value = e.tipoId;
  /** @type {HTMLTextAreaElement} */
  (document.getElementById('editComentario')).value = e.comentario || '';

  const modalEl = document.getElementById('editModal');
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

/**
 * Guarda edición de una entrada.
 */
export async function saveEdit() {
  const id = /** @type {HTMLInputElement} */ (document.getElementById('editId')).value;
  const fecha = /** @type {HTMLInputElement} */ (document.getElementById('editFecha')).value;
  const expediente = /** @type {HTMLInputElement} */ (document.getElementById('editExpediente')).value.trim();
  const tipoId = /** @type {HTMLSelectElement} */ (document.getElementById('editTipoEscrito')).value;
  const comentario = /** @type {HTMLTextAreaElement} */ (document.getElementById('editComentario')).value.trim();

  const idx = entries().findIndex(e => e.id === id);
  if (idx < 0) return;

  const myEmail = entries()[idx].email;
  const yyyyMM = fecha.slice(0, 7);

  if (isExpedienteDuplicateForUserMonth(myEmail, yyyyMM, expediente, id)) {
    toast('Expediente duplicado para ese mes', 'warning');
    return;
  }
  const tipo = tiposEscritos().find(t => t.id === tipoId);
  if (!tipo) {
    toast('Tipo inválido', 'error');
    return;
  }

  try {
    showLoading(true);
    const rowIndex = rowIndexMaps().Entradas.get(id);
    const rowValues = [id, entries()[idx].usuario, myEmail, fecha, expediente, tipoId, Number(tipo.puntuacion) || 0, comentario];
    await replaceRow(EXCEL.tables.Entradas, rowIndex, rowValues);

    const newList = [...entries()];
    newList[idx] = { ...newList[idx], fecha, expediente, tipoId, puntos: Number(tipo.puntuacion) || 0, comentario };
    setEntries(newList);

    const modalEl = document.getElementById('editModal');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

    toast('Entrada actualizada', 'success');
    document.dispatchEvent(new CustomEvent('entries:changed'));
  } catch (err) {
    console.error(err);
    toast('Error al actualizar', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Elimina una entrada (con permisos).
 * @param {string} id
 */
export async function deleteEntry(id) {
  const e = entries().find(x => x.id === id);
  if (!e) return;

  const myEmail = (currentUser()?.username || '').toLowerCase();
  if (e.email !== myEmail && currentUserData()?.rol !== 'supervisor') {
    toast('Sin permisos', 'error');
    return;
  }
  if (!confirm('¿Eliminar entrada?')) return;

  try {
    showLoading(true);
    const rowIndex = rowIndexMaps().Entradas.get(id);
    await deleteRow(EXCEL.tables.Entradas, rowIndex);

    setEntries(entries().filter(x => x.id !== id));
    await refreshRowIndex(EXCEL.tables.Entradas, rowIndexMaps().Entradas);

    toast('Entrada eliminada', 'success');
    document.dispatchEvent(new CustomEvent('entries:changed'));
  } catch (err) {
    console.error(err);
    toast('Error al eliminar', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Registra listeners propios del módulo de formularios.
 * Llamado desde app.js
 */
export function bindFormEvents() {
  const form = document.getElementById('registerForm');
  if (form) form.addEventListener('submit', handleRegister);

  const tipoSel = document.getElementById('tipoEscrito');
  if (tipoSel) tipoSel.addEventListener('change', updatePointsPreview);

  const expInput = document.getElementById('expediente');
  if (expInput) expInput.addEventListener('input', () => {
    const expErr = document.getElementById('expedienteError');
    if (expErr) expErr.textContent = '';
  });

  const saveEditBtn = document.getElementById('saveEdit');
  if (saveEditBtn) saveEditBtn.addEventListener('click', saveEdit);

  // Delegación segura para botones inline en tablas
  document.addEventListener('click', (ev) => {
    const btn = /** @type {HTMLElement} */ (ev.target instanceof HTMLElement ? ev.target.closest('[data-action]') : null);
    if (!btn) return;
    if (btn.dataset.action === 'edit-entry' && btn.dataset.id) editEntry(btn.dataset.id);
    if (btn.dataset.action === 'delete-entry' && btn.dataset.id) deleteEntry(btn.dataset.id);
  });
}
