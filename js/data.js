// js/data.js
// Estado centralizado (store) y utilidades derivadas del estado.
// ESM limpio, sin comas colgantes y con JSDoc para mantenimiento.

import {
  // funciones puras desde utils (reciben festivos por parámetro)
  getFestivosByMonthSede as _uGetFestivosByMonthSede,
  getWorkingDaysYYYYMM as _uGetWorkingDaysYYYYMM,
  getRelativeTodayDay as _uGetRelativeTodayDay,
  monthOf as _uMonthOf
} from './utils.js';

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} nombre
 * @property {string} email
 * @property {"usuario"|"supervisor"} rol
 * @property {string} [sede]
 * @property {string} [vacaciones]  // CSV YYYY-MM-DD
 */

/**
 * @typedef {Object} TipoEscrito
 * @property {string} id
 * @property {string} nombre
 * @property {number} puntuacion
 * @property {boolean} activo
 */

/**
 * @typedef {Object} Configuracion
 * @property {number} puntosPorDia
 * @property {number} bonoMensual
 * @property {string} fechaVigencia  // YYYY-MM-DD
 */

/**
 * @typedef {Object} Entry
 * @property {string} id
 * @property {string} usuario
 * @property {string} email
 * @property {string} fecha       // YYYY-MM-DD
 * @property {string} expediente
 * @property {string} tipoId
 * @property {number} puntos
 * @property {string} [comentario]
 */

/**
 * @typedef {Object} HistChange
 * @property {string} fecha       // ISO
 * @property {string} usuario
 * @property {string} accion
 * @property {string} detalle
 */

/** @type {{
 *   currentUser: any,
 *   currentUserData: User|null,
 *   entries: Entry[],
 *   users: User[],
 *   tiposEscritos: TipoEscrito[],
 *   configuracion: Configuracion,
 *   historialCambios: HistChange[],
 *   festivos: {fecha:string, sede:string, descripcion:string}[],
 *   rowIndexMaps: { Entradas: Map<string, number>, Usuarios: Map<string, number>, Tipos: Map<string, number> }
 * }} */
const state = {
  currentUser: null,
  currentUserData: null,
  entries: [],
  users: [],
  tiposEscritos: [],
  configuracion: {
    puntosPorDia: 2,
    bonoMensual: 300,
    fechaVigencia: new Date().toISOString().slice(0, 10)
  },
  historialCambios: [],
  festivos: [],
  rowIndexMaps: {
    Entradas: new Map(),
    Usuarios: new Map(),
    Tipos: new Map()
  }
};

/* =========================
   Getters de estado
========================= */

/** @returns {any} */
export const currentUser = () => state.currentUser;
/** @returns {User|null} */
export const currentUserData = () => state.currentUserData;
/** @returns {Entry[]} */
export const entries = () => state.entries;
/** @returns {User[]} */
export const users = () => state.users;
/** @returns {TipoEscrito[]} */
export const tiposEscritos = () => state.tiposEscritos;
/** @returns {Configuracion} */
export const configuracion = () => state.configuracion;
/** @returns {HistChange[]} */
export const historialCambios = () => state.historialCambios;
/** @returns {{fecha:string, sede:string, descripcion:string}[]} */
export const festivos = () => state.festivos;
/** @returns {{ Entradas: Map<string,number>, Usuarios: Map<string,number>, Tipos: Map<string,number> }} */
export const rowIndexMaps = () => state.rowIndexMaps;

/* =========================
   Setters / mutaciones
========================= */

/** @param {any} u */
export function setCurrentUser(u) {
  state.currentUser = u;
}

/** @param {User|null} u */
export function setCurrentUserData(u) {
  state.currentUserData = u;
}

/** @param {Entry[]} list */
export function setEntries(list) {
  state.entries = Array.isArray(list) ? list : [];
}

/** @param {User[]} list */
export function setUsers(list) {
  state.users = Array.isArray(list) ? list : [];
}

/** @param {TipoEscrito[]} list */
export function setTiposEscritos(list) {
  state.tiposEscritos = Array.isArray(list) ? list : [];
}

/** @param {Configuracion} cfg */
export function setConfiguracion(cfg) {
  const safe = cfg || {};
  state.configuracion = {
    puntosPorDia: Number(safe.puntosPorDia) || 0,
    bonoMensual: Number(safe.bonoMensual) || 0,
    fechaVigencia: typeof safe.fechaVigencia === 'string'
      ? safe.fechaVigencia
      : new Date().toISOString().slice(0, 10)
  };
}

/** @param {HistChange[]} list */
export function setHistorialCambios(list) {
  state.historialCambios = Array.isArray(list) ? list : [];
}

/** @param {{fecha:string, sede:string, descripcion:string}[]} list */
export function setFestivos(list) {
  state.festivos = Array.isArray(list) ? list : [];
}

/**
 * Reemplaza por completo los Mapas de índices (útil tras una carga inicial).
 * @param {{ Entradas?: Map<string,number>, Usuarios?: Map<string,number>, Tipos?: Map<string,number> }} maps
 */
export function setRowIndexMaps(maps) {
  if (maps && maps.Entradas instanceof Map) state.rowIndexMaps.Entradas = maps.Entradas;
  if (maps && maps.Usuarios instanceof Map) state.rowIndexMaps.Usuarios = maps.Usuarios;
  if (maps && maps.Tipos instanceof Map) state.rowIndexMaps.Tipos = maps.Tipos;
}

/* =========================
   Derivados del estado
========================= */

/**
 * Mapa id -> TipoEscrito (derivado del estado actual).
 * Se usa, por ejemplo, en dashboard para resolver puntos/nombres rápido.
 * @returns {Map<string, TipoEscrito>}
 */
export function getTipoMap() {
  const m = new Map();
  for (const t of state.tiposEscritos) m.set(t.id, t);
  return m;
}

/**
 * Busca un usuario por email en el estado actual.
 * @param {string} email
 * @returns {User|null}
 */
export function getUserByEmail(email) {
  const em = String(email || '').toLowerCase();
  return users().find(u => u.email.toLowerCase() === em) || null;
}

/**
 * Festivos del mes por sede, inyectando el estado actual.
 * @param {string} yyyyMM
 * @param {string} sede
 */
export function getFestivosByMonthSede(yyyyMM, sede) {
  return _uGetFestivosByMonthSede(festivos(), yyyyMM, sede);
}

/**
 * Días laborables L–V del mes menos festivos/vacaciones, inyectando festivos de estado.
 * @param {string} yyyyMM
 * @param {string} sede
 * @param {string} vacacionesCsv
 * @returns {number[]} días del mes (1..n)
 */
export function getWorkingDaysYYYYMM(yyyyMM, sede, vacacionesCsv) {
  return _uGetWorkingDaysYYYYMM(yyyyMM, festivos(), sede, vacacionesCsv);
}

/** Día de hoy si cae dentro de yyyyMM, o null */
export const getRelativeTodayDay = _uGetRelativeTodayDay;
/** Devuelve 'YYYY-MM' de una fecha 'YYYY-MM-DD' */
export const monthOf = _uMonthOf;

/* =========================
   Utilidades de mantenimiento
========================= */

/**
 * Reinicia el estado a valores por defecto.
 * Mantiene referencias de Maps (clear) para no romper consumidores.
 */
export function resetState() {
  state.currentUser = null;
  state.currentUserData = null;
  state.entries = [];
  state.users = [];
  state.tiposEscritos = [];
  state.configuracion = {
    puntosPorDia: 2,
    bonoMensual: 300,
    fechaVigencia: new Date().toISOString().slice(0, 10)
  };
  state.historialCambios = [];
  state.festivos = [];
  state.rowIndexMaps.Entradas.clear();
  state.rowIndexMaps.Usuarios.clear();
  state.rowIndexMaps.Tipos.clear();
}
