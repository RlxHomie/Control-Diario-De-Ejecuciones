/**
 * Capa de acceso a Microsoft Graph / Excel en SharePoint.
 * @module api
 */

import { getAccessToken } from './auth.js';
import { EXCEL } from './config.js';
import { parseDateCell } from './utils.js';

/** Fetch a Graph API con token + retry 429. */
export async function graphFetch(url, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });
  if (res.status === 429) {
    const wait = parseInt(res.headers.get("Retry-After") || "2", 10) * 1000;
    await new Promise(r => setTimeout(r, wait));
    return graphFetch(url, options);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Graph error ${res.status}: ${txt}`);
  }
  return res;
}

/** Ejecuta $batch. */
export async function graphBatch(requests) {
  const token = await getAccessToken();
  const res = await fetch("https://graph.microsoft.com/v1.0/$batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests })
  });
  if (!res.ok) throw new Error(`Batch error ${res.status}`);
  return (await res.json()).responses;
}

/** Helpers tablas */
const base = (fileId) => `/sites/${EXCEL.siteId}/drive/items/${fileId}/workbook/tables`;

export async function getTableRows(tableName) {
  const url = `https://graph.microsoft.com/v1.0${base(EXCEL.fileId)}('${tableName}')/rows`;
  const res = await graphFetch(url);
  const data = await res.json();
  return data.value || [];
}

export async function addRow(tableName, rowValues) {
  const url = `https://graph.microsoft.com/v1.0${base(EXCEL.fileId)}('${tableName}')/rows/add`;
  await graphFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [rowValues] }) });
}

export async function replaceRow(tableName, rowIndex, rowValues) {
  const url = `https://graph.microsoft.com/v1.0${base(EXCEL.fileId)}('${tableName}')/rows/${rowIndex}/range`;
  await graphFetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [rowValues] }) });
}

export async function deleteRow(tableName, rowIndex) {
  const url = `https://graph.microsoft.com/v1.0${base(EXCEL.fileId)}('${tableName}')/rows/${rowIndex}`;
  await graphFetch(url, { method: "DELETE" });
}

/** Reconstruye mapa id→rowIndex tras add/delete. */
export async function refreshRowIndex(tableName, map) {
  map.clear();
  const rows = await getTableRows(tableName);
  rows.forEach(r => {
    const id = String(r.values[0][0] || "");
    if (id) map.set(id, r.index);
  });
}

/**
 * Carga todos los datos necesarios del Excel en una sola operación batch.
 * @returns {Promise<Object>}
 */
export async function loadAllData() {
  const basePath = `/sites/${EXCEL.siteId}/drive/items/${EXCEL.fileId}/workbook/tables`;

  const requests = [
    { id: "1", method: "GET", url: `${basePath}('${EXCEL.tables.Usuarios}')/rows` },
    { id: "2", method: "GET", url: `${basePath}('${EXCEL.tables.Tipos}')/rows` },
    { id: "3", method: "GET", url: `${basePath}('${EXCEL.tables.Config}')/rows` },
    { id: "4", method: "GET", url: `${basePath}('${EXCEL.tables.Entradas}')/rows` },
    { id: "5", method: "GET", url: `${basePath}('${EXCEL.tables.Historial}')/rows` },
    { id: "6", method: "GET", url: `${basePath}('${EXCEL.tables.Calendario}')/rows` }
  ];

  const responses = await graphBatch(requests);

  const result = {
    users: [],
    tiposEscritos: [],
    configuracion: {},
    entries: [],
    historialCambios: [],
    festivos: [],
    rowIndexMaps: {
      Entradas: new Map(),
      Usuarios: new Map(),
      Tipos: new Map()
    }
  };

  // Procesar usuarios
  const usersResp = responses.find(r => r.id === "1");
  if (usersResp?.status === 200) {
    usersResp.body.value.forEach(row => {
      const [id, nombre, email, rol, sede, vacaciones] = row.values[0];
      if (id) {
        result.users.push({
          id: String(id),
          nombre: String(nombre || ""),
          email: String(email || "").toLowerCase(),
          rol: String(rol || "usuario"),
          sede: String(sede || ""),
          vacaciones: String(vacaciones || "")
        });
        result.rowIndexMaps.Usuarios.set(String(id), row.index);
      }
    });
  }

  // Procesar tipos de escritos
  const tiposResp = responses.find(r => r.id === "2");
  if (tiposResp?.status === 200) {
    tiposResp.body.value.forEach(row => {
      const [id, nombre, puntuacion, activo] = row.values[0];
      if (id) {
        result.tiposEscritos.push({
          id: String(id),
          nombre: String(nombre || ""),
          puntuacion: Number(puntuacion) || 0,
          activo: activo !== false
        });
        result.rowIndexMaps.Tipos.set(String(id), row.index);
      }
    });
  }

  // Procesar configuración
  const configResp = responses.find(r => r.id === "3");
  if (configResp?.status === 200 && configResp.body.value.length > 0) {
    const [puntosPorDia, bonoMensual, fechaVigencia] = configResp.body.value[0].values[0];
    result.configuracion = {
      puntosPorDia: Number(puntosPorDia) || 2,
      bonoMensual: Number(bonoMensual) || 300,
      fechaVigencia: parseDateCell(fechaVigencia) || new Date().toISOString().slice(0, 10)
    };
  }

  // Procesar entradas
  const entriesResp = responses.find(r => r.id === "4");
  if (entriesResp?.status === 200) {
    entriesResp.body.value.forEach(row => {
      const [id, usuario, email, fecha, expediente, tipoId, puntos, comentario] = row.values[0];
      if (id) {
        result.entries.push({
          id: String(id),
          usuario: String(usuario || ""),
          email: String(email || "").toLowerCase(),
          fecha: parseDateCell(fecha),
          expediente: String(expediente || ""),
          tipoId: String(tipoId || ""),
          puntos: Number(puntos) || 0,
          comentario: String(comentario || "")
        });
        result.rowIndexMaps.Entradas.set(String(id), row.index);
      }
    });
  }

  // Procesar historial de cambios
  const historialResp = responses.find(r => r.id === "5");
  if (historialResp?.status === 200) {
    historialResp.body.value.forEach(row => {
      const [fecha, usuario, accion, detalle] = row.values[0];
      if (fecha) {
        result.historialCambios.push({
          fecha: parseDateCell(fecha),
          usuario: String(usuario || ""),
          accion: String(accion || ""),
          detalle: String(detalle || "")
        });
      }
    });
  }

  // Procesar festivos
  const festivosResp = responses.find(r => r.id === "6");
  if (festivosResp?.status === 200) {
    festivosResp.body.value.forEach(row => {
      const [fecha, sede, descripcion] = row.values[0];
      if (fecha) {
        result.festivos.push({
          fecha: parseDateCell(fecha),
          sede: String(sede || "").toLowerCase(),
          descripcion: String(descripcion || "")
        });
      }
    });
  }

  return result;
}
