/**
 * Estado global y carga inicial de datos.
 * @module data
 */

import { EXCEL, ENV } from './config.js';
import { graphBatch } from './api.js';
import { parseDateCell } from './utils.js';

/** Estado centralizado */
export const state = {
  currentUser: null,         // {name, username} (MSAL)
  currentUserData: null,     // fila en Usuarios
  entries: [],               // Entradas
  users: [],                 // Usuarios
  tiposEscritos: [],         // TiposEscritos
  configuracion: {},         // Configuracion
  historialCambios: [],      // HistorialCambios
  festivos: [],              // Calendario
  rowIndexMaps: {
    Entradas: new Map(),
    Usuarios: new Map(),
    Tipos: new Map()
  },
  charts: { dailyPointsChart: null, gaugeChart: null }
};

/** Helpers lectura batch segura */
function readBatchBody(subresp) {
  const body = subresp?.body;
  if (body == null) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return { raw: body }; }
  }
  return body;
}
function mapResp(resps, id) {
  const r = resps.find(x => x.id === id);
  if (!r) return [];
  if (r.status !== 200) {
    const body = readBatchBody(r);
    const code = body?.error?.code || body?.code || r.status;
    // tolera tabla no encontrada
    if (code === 'ItemNotFound' || String(code).includes('0x8002802B')) return [];
    const msg = body?.error?.message || body?.message || JSON.stringify(body);
    throw new Error(`$batch[${id}] status=${r.status} code=${code} msg=${msg}`);
  }
  const body = readBatchBody(r);
  return body?.value || [];
}

/**
 * Carga todas las tablas con $batch y rellena el estado.
 * @returns {Promise<void>}
 */
export async function loadAllData() {
  const b = `/me/drive/items/${EXCEL.fileId}/workbook/tables`;
  const reqs = [
    { id: "usuarios", method: "GET", url: `${b}('${EXCEL.tables.Usuarios}')/rows` },
    { id: "tipos",    method: "GET", url: `${b}('${EXCEL.tables.Tipos}')/rows` },
    { id: "config",   method: "GET", url: `${b}('${EXCEL.tables.Config}')/rows` },
    { id: "entradas", method: "GET", url: `${b}('${EXCEL.tables.Entradas}')/rows` },
    { id: "hist",     method: "GET", url: `${b}('${EXCEL.tables.Historial}')/rows` },
    { id: "cal",      method: "GET", url: `${b}('${EXCEL.tables.Calendario}')/rows` }
  ];
  const resps = await graphBatch(reqs);

  // Usuarios: [id,nombre,email,rol,sede,vacaciones]
  state.users = mapResp(resps, "usuarios").map(r => {
    const [id, nombre, email, rol, sede, vac] = r.values[0];
    if (id) state.rowIndexMaps.Usuarios.set(String(id), r.index);
    return { id: String(id), nombre: nombre || "", email: (email || "").toLowerCase(), rol: rol || "usuario", sede: sede || "", vacaciones: vac || "" };
  });

  // Tipos: [id,nombre,puntuacion,activo]
  state.tiposEscritos = mapResp(resps, "tipos").map(r => {
    const [id, nombre, p, pActivo] = r.values[0];
    if (id) state.rowIndexMaps.Tipos.set(String(id), r.index);
    return { id: String(id), nombre: nombre || "", puntuacion: parseFloat(p) || 0, activo: String(pActivo).toLowerCase() !== "false" };
  });

  // Config (primera fila)
  const confRows = mapResp(resps, "config");
  if (confRows.length) {
    const [ppd, bono, vig] = confRows[0].values[0];
    state.configuracion = {
      puntosPorDia: parseFloat(ppd) || 2,
      bonoMensual: parseFloat(bono) || 300,
      fechaVigencia: parseDateCell(vig) || new Date().toISOString().slice(0, 10)
    };
  } else {
    state.configuracion = { puntosPorDia: 2, bonoMensual: 300, fechaVigencia: new Date().toISOString().slice(0, 10) };
  }

  // Entradas: [id,usuario,email,fecha,expediente,tipoId,puntos,comentario]
  state.entries = mapResp(resps, "entradas").map(r => {
    const [id, usuario, email, fecha, expediente, tipoId, puntos, comentario] = r.values[0];
    if (id) state.rowIndexMaps.Entradas.set(String(id), r.index);
    return {
      id: String(id), usuario: usuario || "", email: (email || "").toLowerCase(),
      fecha: parseDateCell(fecha), expediente: expediente || "", tipoId: String(tipoId || ""),
      puntos: parseFloat(puntos) || 0, comentario: comentario || ""
    };
  });

  // Historial: [fechaISO,usuario,accion,detalle]
  state.historialCambios = mapResp(resps, "hist").map(r => {
    const [f, u, a, d] = r.values[0];
    return { fecha: f, usuario: u || "", accion: a || "", detalle: d || "" };
  });

  // Calendario: [fecha,sede,descripcion]
  state.festivos = mapResp(resps, "cal").map(r => {
    const [f, sede, desc] = r.values[0];
    const fecha = parseDateCell(f);
    return fecha ? { fecha, sede: (sede || "").toLowerCase(), descripcion: desc || "" } : null;
  }).filter(Boolean);
}

/** Utils de estado */
export function getUserByEmail(email) {
  return state.users.find(u => u.email === (email || '').toLowerCase());
}
export function getTipoMap() {
  const m = new Map(); state.tiposEscritos.forEach(t => m.set(t.id, t)); return m;
}
